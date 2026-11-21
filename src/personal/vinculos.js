// PERSONAL MASSI - fase 3: convites e vínculos entre personal e aluno.
// O código do convite é o ID do documento em "vinculos" (10 caracteres). As regras do Firestore
// garantem que só o personal cria, só o aluno aceita, e qualquer um dos dois encerra.
import { carregarFirebase } from "./firebase.js";

export const URL_APP = "https://massi-pro.vercel.app/";
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0 e 1 (evita confusão)
export const TAMANHO_CODIGO = 10;

export function gerarCodigo() {
  const bytes = new Uint8Array(TAMANHO_CODIGO);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) s += ALFABETO[bytes[i] % ALFABETO.length]; // 256 é múltiplo de 32: sem viés
  return s;
}
export function normalizarCodigo(texto) {
  return String(texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, TAMANHO_CODIGO);
}
export function formatarCodigo(c) {
  const n = normalizarCodigo(c);
  return n.length > 5 ? n.slice(0, 5) + "-" + n.slice(5) : n;
}
export function linkDoConvite(c) {
  return URL_APP + "?convite=" + normalizarCodigo(c);
}
export function paraData(ts) {
  try { return ts && ts.toDate ? ts.toDate() : null; } catch (e) { return null; }
}
export function dataCurta(ts) {
  const d = paraData(ts);
  return d ? d.toLocaleDateString("pt-BR") : "";
}

function mapear(snap) {
  const lista = [];
  snap.forEach((d) => lista.push({ id: d.id, ...d.data() }));
  lista.sort((a, b) => {
    const ta = paraData(a.criadoEm), tb = paraData(b.criadoEm);
    return (tb ? tb.getTime() : 0) - (ta ? ta.getTime() : 0);
  });
  return lista;
}

export async function listarDoPersonal(uid) {
  const { db, F } = await carregarFirebase();
  return mapear(await F.getDocs(F.query(F.collection(db, "vinculos"), F.where("personalUid", "==", uid))));
}
export async function listarDoAluno(uid) {
  const { db, F } = await carregarFirebase();
  return mapear(await F.getDocs(F.query(F.collection(db, "vinculos"), F.where("alunoUid", "==", uid))));
}

// Cria um convite novo. Se o código já existir (muito raro), tenta de novo.
export async function criarConvite(uid, nomePersonal) {
  const { db, F } = await carregarFirebase();
  let ultimo = null;
  for (let i = 0; i < 4; i++) {
    const codigo = gerarCodigo();
    try {
      await F.setDoc(F.doc(db, "vinculos", codigo), {
        personalUid: uid,
        alunoUid: null,
        status: "convite",
        personalNome: nomePersonal,
        criadoEm: F.serverTimestamp(),
      });
      return codigo;
    } catch (e) {
      ultimo = e;
      if (!e || e.code !== "permission-denied") throw e; // colisão aparece como "sem permissão": gera outro
    }
  }
  throw ultimo;
}

export async function cancelarConvite(codigo) {
  const { db, F } = await carregarFirebase();
  await F.deleteDoc(F.doc(db, "vinculos", codigo));
}

// Devolve o convite ou null (código errado ou convite que não está mais disponível).
export async function buscarConvite(codigo) {
  const { db, F } = await carregarFirebase();
  try {
    const snap = await F.getDoc(F.doc(db, "vinculos", codigo));
    if (!snap.exists()) return null;
    const d = snap.data();
    return d.status === "convite" ? { id: codigo, ...d } : null;
  } catch (e) {
    if (e && e.code === "permission-denied") return null; // inexistente ou já usado: o Firestore responde igual
    throw e;
  }
}

export async function aceitarConvite(codigo, uid, nomeAluno, consent) {
  const { db, F } = await carregarFirebase();
  await F.updateDoc(F.doc(db, "vinculos", codigo), {
    alunoUid: uid,
    status: "ativo",
    alunoNome: nomeAluno,
    aceitoEm: F.serverTimestamp(),
    consent: { historico: !!consent.historico, peso: !!consent.peso, medidas: !!consent.medidas },
  });
}

export async function atualizarConsentimento(codigo, consent) {
  const { db, F } = await carregarFirebase();
  await F.updateDoc(F.doc(db, "vinculos", codigo), {
    consent: { historico: !!consent.historico, peso: !!consent.peso, medidas: !!consent.medidas },
  });
}

export async function encerrarVinculo(codigo, uid) {
  const { db, F } = await carregarFirebase();
  await F.updateDoc(F.doc(db, "vinculos", codigo), {
    status: "encerrado",
    encerradoEm: F.serverTimestamp(),
    encerradoPor: uid,
  });
}

// Tira da lista um vínculo já encerrado.
export async function removerEncerrado(codigo) {
  const { db, F } = await carregarFirebase();
  await F.deleteDoc(F.doc(db, "vinculos", codigo));
}
