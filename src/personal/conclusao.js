// PERSONAL MASSI - fase 6 (ajuste): o resumo agora guarda as datas dos últimos treinos, para a Central contar a semana sem ficar desatualizada.
// PERSONAL MASSI - fase 5: treinos concluídos, check-in e resumo para o painel do personal.
// O treino é executado pelo treino guiado do próprio Massi Pro (que já grava histórico e Progresso).
// Aqui só vai para a nuvem um RESUMO, e somente se o aluno liberou o histórico para aquele personal.
import { carregarFirebase } from "./firebase.js";
import { hojeISO } from "./treinos.js";

const CHAVE_FILA = "personal-fila";

export const ROTULO_DIFICULDADE = { 1: "Muito fácil", 2: "Fácil", 3: "Médio", 4: "Difícil", 5: "Muito difícil" };
export const ROTULO_COMPLETOU = { tudo: "Completou tudo", quase: "Quase tudo", parte: "Só uma parte" };

async function lerFila() {
  try { const r = await window.storage.get(CHAVE_FILA); return r && r.value ? JSON.parse(r.value) : []; } catch (e) { return []; }
}
async function gravarFila(f) {
  try { await window.storage.set(CHAVE_FILA, JSON.stringify(f.slice(-30))); } catch (e) { /* segue sem fila */ }
}

export async function usuarioLogado() {
  const { auth, A } = await carregarFirebase();
  return new Promise((resolve) => {
    let feito = false;
    const parar = A.onAuthStateChanged(auth, (u) => {
      if (feito) return;
      feito = true;
      resolve(u ? { uid: u.uid } : null);
      setTimeout(() => { try { parar(); } catch (e) { /* ok */ } }, 0);
    });
  });
}

export function montarConclusao(registro, entry, checkin) {
  const ref = (entry && entry.personalRef) || {};
  const exercicios = ((entry && entry.exercicios) || []).slice(0, 40).map((e) => ({
    nome: String(e.name || ""),
    series: Number(e.sets) || 0,
    reps: String(e.reps || ""),
    cargas: (Array.isArray(e.cargas) && e.cargas.length ? e.cargas : [e.carga || ""]).map((c) => String(c || "")).slice(0, 20),
    concluido: !!e.concluido,
  }));
  const c = {
    data: (registro && registro.data) || hojeISO(),
    foco: String((entry && entry.foco) || ""),
    duracaoMin: Number(registro && registro.duracaoMin) || 0,
    exercicios,
    treinoId: ref.treinoId || "",
    versao: Number(ref.versao) || 0,
    letra: ref.letra || "",
  };
  if (checkin) c.checkin = checkin;
  return c;
}

export async function lerConsentimento(vinculoId) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDoc(F.doc(db, "vinculos", vinculoId));
  const d = snap.exists() ? snap.data() : null;
  if (!d || d.status !== "ativo") return { ativo: false, historico: false, vinculo: d };
  return { ativo: true, historico: !!(d.consent && d.consent.historico), vinculo: d };
}

export async function listarConclusoes(vinculoId, quantidade) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDocs(F.query(F.collection(db, "vinculos", vinculoId, "conclusoes"), F.orderBy("criadoEm", "desc"), F.limit(quantidade || 30)));
  const lista = [];
  snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
  return lista;
}

export async function lerResumo(vinculoId) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDoc(F.doc(db, "vinculos", vinculoId, "resumo", "atual"));
  return snap.exists() ? snap.data() : null;
}
// Resumos dos alunos ativos que compartilham o histórico (para os avisos na lista do personal).
export async function listarResumos(vinculos) {
  const mapa = {};
  for (const v of vinculos.filter((x) => x.status === "ativo" && x.consent && x.consent.historico)) {
    try { mapa[v.id] = await lerResumo(v.id); } catch (e) { /* sem resumo ainda */ }
  }
  return mapa;
}

export async function atualizarResumo(vinculoId, conclusao, meta) {
  const { db, F } = await carregarFirebase();
  const lista = await listarConclusoes(vinculoId, 100);
  const hoje = hojeISO();
  const d7 = new Date(); d7.setDate(d7.getDate() - 6);
  const desde = hojeISO(d7);
  const semana = lista.filter((c) => c.data >= desde && c.data <= hoje).length;
  const ref = F.doc(db, "vinculos", vinculoId, "resumo", "atual");
  let atual = {};
  try { const s = await F.getDoc(ref); if (s.exists()) atual = s.data(); } catch (e) { atual = {}; }
  const novo = {
    ultimaAtividade: lista.length ? lista[0].data : conclusao.data,
    treinosSemana: semana,
    treinosTotal: lista.length,
    datas: lista.slice(0, 14).map((c) => c.data).filter((d) => typeof d === "string"),
    atualizadoEm: F.serverTimestamp(),
  };
  const metaSemanal = Number(meta && meta.frequencia) || atual.metaSemanal || 0;
  if (metaSemanal) { novo.metaSemanal = metaSemanal; novo.aderenciaPct = Math.min(100, Math.round((semana / metaSemanal) * 100)); }
  const ck = conclusao.checkin;
  if (ck) {
    novo.ultimaDificuldade = ck.dificuldade;
    novo.alertaDesconforto = !!ck.desconforto;
    novo.alertaTexto = ck.desconforto ? String(ck.desconfortoTexto || "").slice(0, 200) : "";
    novo.alertaEm = conclusao.data;
  } else {
    ["ultimaDificuldade", "alertaDesconforto", "alertaTexto", "alertaEm"].forEach((k) => { if (atual[k] !== undefined) novo[k] = atual[k]; });
  }
  await F.setDoc(ref, novo);
}

async function gravar(vinculoId, uid, id, conclusao, meta) {
  const { db, F } = await carregarFirebase();
  const ref = F.doc(db, "vinculos", vinculoId, "conclusoes", id);
  try {
    await F.setDoc(ref, { alunoUid: uid, ...conclusao, criadoEm: F.serverTimestamp() });
  } catch (e) {
    if (e && e.code === "permission-denied") {
      // se já existe, é um reenvio (a conclusão tem o mesmo id): considera enviado
      try { const s = await F.getDoc(ref); if (s.exists()) return; } catch (e2) { /* segue */ }
    }
    throw e;
  }
  try { await atualizarResumo(vinculoId, conclusao, meta); } catch (e) { /* o resumo se refaz no próximo treino */ }
}

async function enfileirar(item) {
  const fila = await lerFila();
  if (fila.some((x) => x.id === item.id)) return;
  fila.push(item);
  await gravarFila(fila);
}

// Devolve "enviado" | "fila" | "privado" | "encerrado" | "negado".
// "privado" = o aluno não compartilha o histórico. "negado" = ele compartilha, mas o servidor recusou (regras desatualizadas).
export async function enviarConclusao({ vinculoId, id, conclusao, meta }) {
  let u = null;
  try { u = await usuarioLogado(); } catch (e) { u = null; }
  const item = { uid: u ? u.uid : "", vinculoId, id, conclusao, meta };
  if (!u) { await enfileirar(item); return "fila"; }
  let consentimentoOk = false;
  try {
    const consentimento = await lerConsentimento(vinculoId);
    if (!consentimento.ativo) return "encerrado";
    if (!consentimento.historico) return "privado";
    consentimentoOk = true;
    await gravar(vinculoId, u.uid, id, conclusao, meta);
    return "enviado";
  } catch (e) {
    if (e && e.code === "permission-denied") return consentimentoOk ? "negado" : "privado";
    await enfileirar(item);
    return "fila";
  }
}

// Reenvia o que ficou esperando (sem internet). Chamado ao abrir o painel do aluno e ao terminar um treino.
export async function esvaziarFila() {
  const fila = await lerFila();
  if (!fila.length) return 0;
  let u = null;
  try { u = await usuarioLogado(); } catch (e) { return 0; }
  if (!u) return 0;
  const resto = [];
  let enviados = 0;
  for (const it of fila) {
    if (it.uid && it.uid !== u.uid) { resto.push(it); continue; }
    try {
      const c = await lerConsentimento(it.vinculoId);
      if (!c.ativo || !c.historico) continue; // sem autorização: descarta (o treino segue no histórico do aluno)
      await gravar(it.vinculoId, u.uid, it.id, it.conclusao, it.meta);
      enviados++;
    } catch (e) {
      resto.push(it); // qualquer falha (internet, regras antigas): mantém na fila para tentar de novo depois
    }
  }
  await gravarFila(resto);
  return enviados;
}
