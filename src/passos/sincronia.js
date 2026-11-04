// Sincronização da contagem automática: lê o sensor, calcula os passos de hoje (contagemSensor.js)
// e grava nos mesmos lugares que o contador manual já usava:
//   passos-registros  { "AAAA-MM-DD": passos }        (por perfil, via window.storage)
//   passos-historico  { "AAAA-MM-DD": { passos, km, kcal, tmb, idade } }
// O estado do sensor (valor da última leitura) fica no próprio aparelho, fora dos perfis, porque o
// sensor é um só por celular: assim dois perfis nunca contam o mesmo passo duas vezes.
// Os passos entram no perfil que estiver ativo na hora da leitura.

import * as P from "./passos.js";
import { tmbKcal, idadeDeNascimento } from "./tmb.js";
import { atualizarContagem } from "./contagemSensor.js";
import { nativoDisponivel, estadoPassosNativos, pedirPermissaoPassos, lerContadorBruto } from "./ponte.js";

const CHAVE_REG = "passos-registros";
const CHAVE_HIST = "passos-historico";
const CHAVE_PERFIL = "passos-perfil";
const CHAVE_SENSOR = "massi-passos-sensor"; // localStorage: { ativo, contagem: { dia, ultimo, acumulado } }

export const hojeISO = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

async function ler(chave, padrao) {
  try { const r = await window.storage.get(chave); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return padrao;
}
async function gravar(chave, valor) {
  try { await window.storage.set(chave, JSON.stringify(valor)); } catch (e) { /* segue */ }
}

function lerSensorLocal() {
  try {
    const t = window.localStorage.getItem(CHAVE_SENSOR);
    if (t) { const o = JSON.parse(t); if (o && typeof o === "object") return o; }
  } catch (e) { /* sem dado */ }
  return { ativo: false, contagem: null };
}
function gravarSensorLocal(o) {
  try { window.localStorage.setItem(CHAVE_SENSOR, JSON.stringify(o)); return true; } catch (e) { return false; }
}

export function contagemAutomaticaLigada() { return lerSensorLocal().ativo === true; }

// Perfil: o que foi informado na tela de passos tem prioridade; senão, usa a Avaliação do app
export async function lerPerfilPassos() {
  const aqui = await ler(CHAVE_PERFIL, null);
  if (aqui && aqui.altura) return aqui;
  const avs = await ler("avaliacoes-evolucao", []);
  const ult = Array.isArray(avs) && avs.length ? avs[avs.length - 1] : {};
  return { altura: ult.altura, sexo: ult.sexo, peso: ult.peso };
}

// Registra um dia no histórico: passos, km, kcal da caminhada e TMB (se houver dados)
export async function gravarDiaNoHistorico(dia, passos) {
  const perfil = await lerPerfilPassos();
  const cad = await ler("onboarding-perfil", null);
  const idade = idadeDeNascimento(cad && cad.nascimento);
  const hist = await ler(CHAVE_HIST, {});
  const r = P.resumoDia(dia, passos, perfil);
  const tmb = tmbKcal({ sexo: perfil.sexo, peso: perfil.peso, altura: perfil.altura, idade });
  hist[dia] = { passos, km: r.km, kcal: r.kcal === null ? null : Math.round(r.kcal), tmb, idade };
  await gravar(CHAVE_HIST, hist);
}

// Liga a contagem automática. Pede a permissão do Android se ainda não foi dada.
// Os passos que a pessoa já tinha digitado hoje são mantidos como ponto de partida.
export async function ativarContagemAutomatica() {
  if (!nativoDisponivel()) return { status: "indisponivel" };
  let e = await estadoPassosNativos();
  if (e.status === "sem_permissao") e = await pedirPermissaoPassos();
  if (e.status !== "ok") return { status: e.status };
  const bruto = await lerContadorBruto();
  if (bruto === null) return { status: "erro" };
  const registros = await ler(CHAVE_REG, {});
  const hoje = hojeISO();
  const jaHoje = Number(registros[hoje]) > 0 ? Math.round(Number(registros[hoje])) : 0;
  if (!gravarSensorLocal({ ativo: true, contagem: { dia: hoje, ultimo: bruto, acumulado: jaHoje } })) return { status: "erro" };
  return { status: "ok", passosHoje: jaHoje };
}

export function desativarContagemAutomatica() {
  gravarSensorLocal({ ativo: false, contagem: null });
}

// Lê o sensor e atualiza os registros. Chamadas simultâneas compartilham a mesma leitura.
let emAndamento = null;
export function sincronizarPassos() {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    try { return await sincronizarInterno(); } finally { emAndamento = null; }
  })();
  return emAndamento;
}

async function sincronizarInterno() {
  if (!nativoDisponivel()) return { status: "indisponivel" };
  const local = lerSensorLocal();
  if (!local.ativo) return { status: "desligado" };
  const e = await estadoPassosNativos();
  if (e.status !== "ok") return { status: e.status };
  const bruto = await lerContadorBruto();
  if (bruto === null) return { status: "erro" };

  const hoje = hojeISO();
  const r = atualizarContagem(local.contagem, bruto, hoje);
  if (r.evento === "invalido") return { status: "erro" };
  if (!gravarSensorLocal({ ativo: true, contagem: r.estado })) return { status: "erro" };

  const dias = { ...r.fechados, [hoje]: r.passosHoje };
  const registros = { ...(await ler(CHAVE_REG, {})), ...dias };
  await gravar(CHAVE_REG, registros);
  for (const dia of Object.keys(dias)) await gravarDiaNoHistorico(dia, dias[dia]);
  return { status: "ok", passosHoje: r.passosHoje, evento: r.evento, estimado: r.estimado, registros };
}

// "Reiniciar hoje" com a contagem automática ligada: zera hoje e começa a contar daqui.
export async function reiniciarHojeAutomatico() {
  const bruto = await lerContadorBruto();
  if (bruto === null) return { status: "erro" };
  const hoje = hojeISO();
  if (!gravarSensorLocal({ ativo: true, contagem: { dia: hoje, ultimo: bruto, acumulado: 0 } })) return { status: "erro" };
  const registros = { ...(await ler(CHAVE_REG, {})), [hoje]: 0 };
  await gravar(CHAVE_REG, registros);
  const hist = await ler(CHAVE_HIST, {});
  delete hist[hoje];
  await gravar(CHAVE_HIST, hist);
  return { status: "ok", registros };
}
