// PERSONAL MASSI - fase 6: contas da semana (funções puras, sem Firebase, fáceis de testar).
// A janela da semana é a mesma do resumo: hoje e os 6 dias anteriores.
import { hojeISO } from "./treinos.js";

export const DIAS_JANELA = 7;

function dataDeISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : null;
}

// Quantos dias se passaram de "iso" até "hoje" (0 = hoje). null se a data for inválida.
export function diasDesde(iso, hoje) {
  const a = dataDeISO(iso);
  const b = dataDeISO(hoje || hojeISO());
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function dentroDaJanela(iso, hoje) {
  const d = diasDesde(iso, hoje);
  return d !== null && d >= 0 && d < DIAS_JANELA;
}

// Lista de datas (ISO) -> quantos treinos caem na semana.
export function contarNaSemana(datas, hoje) {
  return (datas || []).filter((d) => dentroDaJanela(d, hoje)).length;
}

// Situação de um aluno na Central de Acompanhamento. Usa só o que o aluno compartilhou.
// estado: "semAcesso" | "semRegistros" | "pendente" | "treinando"
export function situacaoDoAluno(vinculo, resumo, hoje) {
  const compartilha = !!(vinculo && vinculo.consent && vinculo.consent.historico);
  if (!compartilha) return { estado: "semAcesso", desconforto: false };
  if (!resumo || !resumo.ultimaAtividade) return { estado: "semRegistros", desconforto: false };
  // resumos antigos não têm a lista de datas: usa o número guardado, mas só se o último treino ainda cabe na semana
  const treinosSemana = Array.isArray(resumo.datas)
    ? contarNaSemana(resumo.datas, hoje)
    : (dentroDaJanela(resumo.ultimaAtividade, hoje) ? Number(resumo.treinosSemana) || 0 : 0);
  const meta = Number(resumo.metaSemanal) || 0;
  return {
    estado: treinosSemana > 0 ? "treinando" : "pendente",
    treinosSemana,
    meta,
    aderenciaPct: meta ? Math.min(100, Math.round((treinosSemana / meta) * 100)) : null,
    diasSemTreinar: diasDesde(resumo.ultimaAtividade, hoje),
    ultimaAtividade: resumo.ultimaAtividade,
    desconforto: !!resumo.alertaDesconforto,
    desconfortoTexto: resumo.alertaTexto || "",
    desconfortoEm: resumo.alertaEm || "",
  };
}

const PESO = { pendente: 1, semRegistros: 2, treinando: 3, semAcesso: 4 };

// Quem precisa de atenção vem primeiro: desconforto, depois quem está parado há mais tempo.
export function ordenarCentral(itens) {
  return itens.slice().sort((a, b) => {
    if (a.sit.desconforto !== b.sit.desconforto) return a.sit.desconforto ? -1 : 1;
    if (PESO[a.sit.estado] !== PESO[b.sit.estado]) return PESO[a.sit.estado] - PESO[b.sit.estado];
    if (a.sit.estado === "pendente") return (b.sit.diasSemTreinar || 0) - (a.sit.diasSemTreinar || 0);
    return String(a.vinculo.alunoNome || "").localeCompare(String(b.vinculo.alunoNome || ""), "pt-BR");
  });
}

export function totaisDaCentral(itens) {
  const t = { alunos: itens.length, treinando: 0, pendentes: 0, semRegistros: 0, semAcesso: 0, comDesconforto: 0, treinosNaSemana: 0 };
  itens.forEach(({ sit }) => {
    if (sit.estado === "treinando") { t.treinando++; t.treinosNaSemana += sit.treinosSemana || 0; }
    else if (sit.estado === "pendente") t.pendentes++;
    else if (sit.estado === "semRegistros") t.semRegistros++;
    else t.semAcesso++;
    if (sit.desconforto) t.comDesconforto++;
  });
  return t;
}

// Resumo da semana do próprio aluno, a partir dos treinos concluídos que ele já enviou.
export function resumirSemana(conclusoes, meta, hoje) {
  const naSemana = (conclusoes || []).filter((c) => dentroDaJanela(c.data, hoje));
  const dif = naSemana.map((c) => c.checkin && Number(c.checkin.dificuldade)).filter((n) => n >= 1 && n <= 5);
  const m = Number(meta) || 0;
  return {
    treinos: naSemana.length,
    meta: m,
    aderenciaPct: m ? Math.min(100, Math.round((naSemana.length / m) * 100)) : null,
    dificuldadeMedia: dif.length ? Math.round((dif.reduce((s, n) => s + n, 0) / dif.length) * 10) / 10 : null,
    respostasCheckin: dif.length,
    desconfortos: naSemana.filter((c) => c.checkin && c.checkin.desconforto).length,
    minutos: naSemana.reduce((s, c) => s + (Number(c.duracaoMin) || 0), 0),
  };
}
