// Conta, login e perfil do Personal Massi (Firebase Authentication + Firestore).
// Nada aqui toca nos dados do Massi Pro atual.
import { carregarFirebase } from "./firebase.js";

export function mensagemDeErro(e) {
  const c = (e && e.code) || "";
  const mapa = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-email": "Digite o e-mail.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Esse e-mail já tem conta. Use \"Entrar\".",
    "auth/weak-password": "Senha fraca. Use pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet. Tente de novo.",
    "auth/operation-not-allowed": "O login por e-mail e senha não está ativado no Firebase.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "A chave do Firebase está errada. Confira o arquivo firebaseConfig.js.",
    "auth/invalid-api-key": "A chave do Firebase está errada. Confira o arquivo firebaseConfig.js.",
    "auth/unauthorized-domain": "Este endereço do app não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).",
    "auth/requires-recent-login": "Por segurança, saia e entre de novo antes de fazer isso.",
    "permission-denied": "Sem permissão. Se isso persistir, as regras de segurança precisam ser conferidas.",
    "unavailable": "Serviço indisponível no momento. Tente de novo.",
  };
  if (mapa[c]) return mapa[c];
  if (e && e.message === "foto-grande") return "A foto ficou grande demais. Escolha outra.";
  if (e && e.message === "foto-invalida") return "Não consegui ler essa imagem. Escolha outra foto.";
  return "Algo deu errado. Tente de novo." + (c ? " (" + c + ")" : "");
}

// Observa o login. Devolve uma função para parar de observar.
export async function observarLogin(aoMudar) {
  const { auth, A } = await carregarFirebase();
  return A.onAuthStateChanged(auth, aoMudar);
}

// Lê o perfil. Devolve null se o cadastro ainda não foi concluído.
export async function carregarPerfil(uid) {
  const { db, F } = await carregarFirebase();
  const snap = await F.getDoc(F.doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  const base = snap.data();
  const perfil = { uid, tipo: base.tipo, nome: base.nome, foto: base.foto || null, profissional: null };
  if (base.tipo === "personal") {
    const ps = await F.getDoc(F.doc(db, "personais", uid));
    perfil.profissional = ps.exists() ? ps.data() : null;
  }
  return perfil;
}

// Cria os documentos do perfil (usuarios primeiro, porque a regra de "personais" confere o tipo).
export async function criarPerfil(uid, { tipo, nome }) {
  const { db, F } = await carregarFirebase();
  await F.setDoc(F.doc(db, "usuarios", uid), { tipo, nome: nome.trim(), criadoEm: F.serverTimestamp() });
  if (tipo === "personal") {
    await F.setDoc(F.doc(db, "personais", uid), { especialidades: [], planoId: "gratuito", criadoEm: F.serverTimestamp() });
  }
}

// Se o documento profissional não existir (cadastro interrompido), cria agora.
export async function garantirProfissional(uid) {
  const { db, F } = await carregarFirebase();
  const ref = F.doc(db, "personais", uid);
  const snap = await F.getDoc(ref);
  if (!snap.exists()) {
    await F.setDoc(ref, { especialidades: [], planoId: "gratuito", criadoEm: F.serverTimestamp() });
  }
}

export async function cadastrar({ tipo, nome, email, senha }) {
  const { auth, A } = await carregarFirebase();
  const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), senha);
  await criarPerfil(cred.user.uid, { tipo, nome });
  return cred.user.uid;
}

export async function entrar(email, senha) {
  const { auth, A } = await carregarFirebase();
  const cred = await A.signInWithEmailAndPassword(auth, email.trim(), senha);
  return cred.user.uid;
}

export async function sair() {
  const { auth, A } = await carregarFirebase();
  await A.signOut(auth);
}

export async function recuperarSenha(email) {
  const { auth, A } = await carregarFirebase();
  await A.sendPasswordResetEmail(auth, email.trim());
}

export async function salvarPerfil(uid, { nome, foto }) {
  const { db, F } = await carregarFirebase();
  const mudanca = { nome: nome.trim() };
  mudanca.foto = foto ? foto : F.deleteField();
  await F.updateDoc(F.doc(db, "usuarios", uid), mudanca);
}

export async function salvarProfissional(uid, { cref, especialidades, bio }) {
  const { db, F } = await carregarFirebase();
  const mudanca = { especialidades: especialidades.slice(0, 12) };
  mudanca.cref = cref && cref.trim() ? cref.trim() : F.deleteField();
  mudanca.bio = bio && bio.trim() ? bio.trim() : F.deleteField();
  await F.updateDoc(F.doc(db, "personais", uid), mudanca);
}

// Reduz a foto para um quadrado pequeno (cabe no perfil sem usar armazenamento pago).
export async function reduzirFoto(arquivo, lado = 192, qualidade = 0.72) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("foto-invalida"));
      i.src = url;
    });
    const min = Math.min(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = lado;
    c.height = lado;
    c.getContext("2d").drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, lado, lado);
    const data = c.toDataURL("image/jpeg", qualidade);
    if (data.length > 80000) throw new Error("foto-grande");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
