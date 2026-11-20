// PERSONAL MASSI - fase 4: dados do construtor de treinos.
// Rascunhos e modelos ficam em personais/{uid}/modelos (privados do personal).
// Treinos enviados ficam em vinculos/{codigo}/treinos. Cada ENVIO é um documento novo (uma versão):
// o anterior vira "arquivado" e continua guardado, então o histórico do aluno nunca se perde.
import { carregarFirebase } from "./firebase.js";

export const LETRAS = ["A", "B", "C", "D", "E"];
export const GRUPOS_FALLBACK = ["Peito", "Costas", "Perna", "Ombro", "Braço", "Abdômen", "Corpo inteiro", "Funcional"];
// Só os grupos musculares de verdade (a biblioteca do app também guarda treinos prontos, como "Peito, ombros e tríceps").
export function gruposPrincipais(biblioteca) {
  const chaves = biblioteca && biblioteca.LIBRARY ? Object.keys(biblioteca.LIBRARY) : [];
  const lista = GRUPOS_FALLBACK.filter((g) => chaves.indexOf(g) >= 0).concat(chaves.filter((g) => /^Casa:/.test(g)));
  return lista.length ? lista : GRUPOS_FALLBACK;
}

export function gerarId() {
  const alfabeto = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 10; i++) s += alfabeto[bytes[i] % alfabeto.length];
  return s;
}
export function hojeISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}

export function novoPrograma(extra) {
  return {
    nome: "",
    vinculoId: "",
    frequencia: 3,
    inicio: hojeISO(),
    validade: "",
    orientacoes: "",
    dias: [{ letra: "A", titulo: "", grupos: [], exercicios: [] }],
    ...(extra || {}),
  };
}
export function novoExercicio(nome, grupo, base) {
  const b = base || {};
  return { id: gerarId(), nome, grupo: grupo || "", series: b.sets || 3, reps: b.reps || "10-12", carga: "", descanso: 60, instrucoes: "", obs: "" };
}
export function descreverExercicio(e) {
  const partes = [e.series + " x " + e.reps];
  if (e.carga && String(e.carga).trim()) partes.push(String(e.carga).trim());
  if (e.descanso) partes.push(e.descanso + " s de descanso");
  return partes.join(" · ");
}
export function contarExercicios(p) {
  return (p.dias || []).reduce((a, d) => a + (d.exercicios || []).length, 0);
}

// Devolve a lista de problemas que impedem o envio (vazia = pode enviar).
export function validarPrograma(p) {
  const erros = [];
  if (!p.nome || !p.nome.trim()) erros.push("Dê um nome ao treino.");
  if (p.nome && p.nome.trim().length > 100) erros.push("O nome do treino é longo demais (máximo 100 letras).");
  if (!p.dias || !p.dias.length) erros.push("Adicione pelo menos um dia de treino.");
  (p.dias || []).forEach((d) => {
    if (!d.exercicios || !d.exercicios.length) erros.push("O treino " + d.letra + " ainda não tem exercícios.");
    (d.exercicios || []).forEach((e) => {
      if (!e.nome || !e.nome.trim()) erros.push("Tem um exercício sem nome no treino " + d.letra + ".");
      if (!(Number(e.series) >= 1 && Number(e.series) <= 20)) erros.push("Séries de \"" + e.nome + "\" (treino " + d.letra + "): use de 1 a 20.");
      if (!e.reps || !String(e.reps).trim()) erros.push("Repetições de \"" + e.nome + "\" (treino " + d.letra + ") estão vazias.");
    });
  });
  if (p.validade && p.inicio && p.validade < p.inicio) erros.push("A validade não pode ser antes do início.");
  return erros;
}

// Só o que é do programa (sem o vínculo) vai dentro do treino enviado.
export function conteudoDoPrograma(p) {
  return JSON.parse(JSON.stringify({ frequencia: p.frequencia, orientacoes: p.orientacoes || "", dias: p.dias }));
}

function ordenarPorData(lista, campo) {
  lista.sort((a, b) => {
    const ta = a[campo] && a[campo].toDate ? a[campo].toDate().getTime() : 0;
    const tb = b[campo] && b[campo].toDate ? b[campo].toDate().getTime() : 0;
    return tb - ta;
  });
  return lista;
}

// ---------- rascunhos e modelos do personal ----------
export async function listarModelos(uid) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDocs(F.collection(db, "personais", uid, "modelos"));
  const lista = [];
  snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
  return ordenarPorData(lista, "atualizadoEm");
}
export async function salvarModelo(uid, { id, categoria, programa }) {
  const { db, F } = await carregarFirebase();
  const mid = id || gerarId();
  await F.setDoc(F.doc(db, "personais", uid, "modelos", mid), {
    categoria,
    nome: programa.nome || "Sem nome",
    vinculoId: categoria === "modelo" ? "" : programa.vinculoId || "",
    programa: { ...programa, vinculoId: categoria === "modelo" ? "" : programa.vinculoId || "" },
    atualizadoEm: F.serverTimestamp(),
  });
  return mid;
}
export async function apagarModelo(uid, id) {
  const { db, F } = await carregarFirebase();
  await F.deleteDoc(F.doc(db, "personais", uid, "modelos", id));
}

// ---------- treinos enviados ----------
export async function listarTreinos(vinculoId) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDocs(F.collection(db, "vinculos", vinculoId, "treinos"));
  const lista = [];
  snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
  lista.sort((a, b) => (b.versao || 0) - (a.versao || 0));
  return lista;
}
export function treinoAtual(lista) {
  return (lista || []).find((t) => t.status === "enviado") || null;
}

// Envia como NOVA versão e arquiva a anterior (sem apagar nada).
export async function enviarTreino(uid, vinculo, programa) {
  const { db, F } = await carregarFirebase();
  const existentes = await listarTreinos(vinculo.id);
  const versao = existentes.reduce((m, t) => Math.max(m, t.versao || 0), 0) + 1;
  const ref = await F.addDoc(F.collection(db, "vinculos", vinculo.id, "treinos"), {
    personalUid: uid,
    alunoUid: vinculo.alunoUid,
    titulo: programa.nome.trim(),
    conteudo: conteudoDoPrograma(programa),
    inicio: programa.inicio || "",
    validade: programa.validade || "",
    versao,
    status: "enviado",
    criadoEm: F.serverTimestamp(),
  });
  for (const t of existentes.filter((x) => x.status === "enviado")) {
    await F.updateDoc(F.doc(db, "vinculos", vinculo.id, "treinos", t.id), { status: "arquivado", atualizadoEm: F.serverTimestamp() });
  }
  return { id: ref.id, versao };
}

// Transforma um treino já enviado em programa editável (vira uma nova versão ao reenviar).
export function programaDoTreino(treino, vinculoId) {
  const c = treino.conteudo || {};
  return novoPrograma({ nome: treino.titulo || "", vinculoId, frequencia: c.frequencia || 3, inicio: treino.inicio || hojeISO(), validade: treino.validade || "", orientacoes: c.orientacoes || "", dias: JSON.parse(JSON.stringify(c.dias || [])) });
}
