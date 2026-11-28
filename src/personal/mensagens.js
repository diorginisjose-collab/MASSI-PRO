// PERSONAL MASSI - fase 6: mensagens entre personal e aluno, com contador de não lidas.
// Mensagens: vinculos/{codigo}/mensagens. Estado de leitura: vinculos/{codigo}/estado/mensagens
// (1 documento pequeno por vínculo, então o contador de não lidas custa 1 leitura por aluno).
// Cada um só escreve os próprios campos: o personal grava "...Personal", o aluno grava "...Aluno".
import { carregarFirebase } from "./firebase.js";

export const LIMITE_TEXTO = 1000;

function campos(papel) {
  return papel === "personal"
    ? { ultima: "ultimaPersonalEm", lido: "lidoPersonalEm" }
    : { ultima: "ultimaAlunoEm", lido: "lidoAlunoEm" };
}
const outro = (papel) => (papel === "personal" ? "aluno" : "personal");

export function milis(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  if (t instanceof Date) return t.getTime();
  return Number(t) || 0;
}

export async function listarMensagens(vinculoId, quantidade) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDocs(F.query(F.collection(db, "vinculos", vinculoId, "mensagens"), F.orderBy("criadoEm", "desc"), F.limit(quantidade || 50)));
  const lista = [];
  snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
  return lista.reverse(); // da mais antiga para a mais nova
}

export async function lerEstado(vinculoId) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDoc(F.doc(db, "vinculos", vinculoId, "estado", "mensagens"));
  return snap.exists() ? snap.data() : null;
}

// Não lidas = a última mensagem do OUTRO é mais nova que a minha última leitura.
// Devolve só "tem ou não tem" (o número exato exige ler as mensagens, o que só acontece ao abrir a conversa).
export function temNaoLida(estado, papel) {
  if (!estado) return false;
  const c = campos(papel);
  const o = campos(outro(papel));
  const recebida = milis(estado[o.ultima]);
  return recebida > 0 && recebida > milis(estado[c.lido]);
}

export async function contarNaoLidasDeVarios(vinculos, papel) {
  const mapa = {};
  for (const v of vinculos.filter((x) => x.status === "ativo")) {
    try { mapa[v.id] = temNaoLida(await lerEstado(v.id), papel); } catch (e) { mapa[v.id] = false; }
  }
  return mapa;
}

async function gravarEstado(vinculoId, chaves) {
  const { db, F } = await carregarFirebase();
  const ref = F.doc(db, "vinculos", vinculoId, "estado", "mensagens");
  const dado = {};
  chaves.forEach((k) => { dado[k] = F.serverTimestamp(); });
  try {
    await F.updateDoc(ref, dado);
  } catch (e) {
    // ainda não existe: cria só com os meus campos
    if (e && (e.code === "not-found" || e.code === "permission-denied")) { await F.setDoc(ref, dado); return; }
    throw e;
  }
}

export async function marcarComoLida(vinculoId, papel) {
  await gravarEstado(vinculoId, [campos(papel).lido]);
}

export async function enviarMensagem(vinculoId, uid, papel, texto) {
  const limpo = String(texto || "").trim().slice(0, LIMITE_TEXTO);
  if (!limpo) throw new Error("mensagem-vazia");
  const { db, F } = await carregarFirebase();
  // O aviso de "não lida" é gravado ANTES da mensagem: assim o horário dele é sempre anterior ao da mensagem,
  // e quem abrir a conversa depois nunca fica com a mensagem marcada como não lida por engano.
  // Quem escreve já leu tudo até aqui. Se esta gravação falhar, a mensagem segue; só o aviso do outro lado atrasa.
  try { await gravarEstado(vinculoId, [campos(papel).ultima, campos(papel).lido]); } catch (e) { /* segue */ }
  await F.addDoc(F.collection(db, "vinculos", vinculoId, "mensagens"), { autorUid: uid, texto: limpo, criadoEm: F.serverTimestamp() });
}
