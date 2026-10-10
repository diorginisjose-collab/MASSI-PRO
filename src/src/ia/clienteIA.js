// Conversa com a função de servidor /api/ia (assistente em tempo real e foto de alimentos).
import { IA_CONFIG, urlApi } from "./config.js";

export class ErroIA extends Error {
  constructor(codigo, mensagem) {
    super(mensagem || codigo);
    this.codigo = codigo;
  }
}

// Texto amigável (em português; a tela traduz com tr()) para cada código de erro.
export const MENSAGENS_ERRO = {
  rede: "Sem conexão com o servidor. Confira sua internet e tente de novo.",
  servidor: "A IA não respondeu agora. Tente de novo em instantes.",
  ocupado: "A IA está muito ocupada agora. Tente de novo em alguns segundos.",
  limite_dispositivo: "Você atingiu o limite diário de uso neste aparelho. Volte amanhã.",
  nao_configurado: "A IA ainda não foi ativada neste app (falta configurar o servidor).",
  pedido_invalido: "Não consegui enviar esse pedido. Tente reescrever.",
  imagem_invalida: "Essa imagem não pôde ser usada. Tente outra foto.",
  imagem_grande: "A imagem ficou grande demais. Tente outra foto.",
  resposta_invalida: "Não consegui entender a resposta da IA. Tente outra foto ou descreva o prato.",
  cancelado: "Pedido cancelado.",
  origem: "Este endereço não tem permissão para usar a IA.",
};
export function mensagemDeErro(e) {
  const codigo = e && e.codigo ? e.codigo : "servidor";
  return MENSAGENS_ERRO[codigo] || MENSAGENS_ERRO.servidor;
}

export function idDispositivo() {
  try {
    let id = localStorage.getItem(IA_CONFIG.chaveDispositivo);
    if (!id) {
      id = "d" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(IA_CONFIG.chaveDispositivo, id);
    }
    return id;
  } catch (e) {
    return "anon";
  }
}

async function postar(corpo, signal) {
  try {
    return await fetch(urlApi(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...corpo, dispositivo: idDispositivo() }),
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ErroIA("cancelado");
    throw new ErroIA("rede");
  }
}
async function erroDaResposta(resp) {
  let j = null;
  try { j = await resp.json(); } catch (e) { /* sem corpo */ }
  return new ErroIA((j && j.erro) || (resp.status === 404 ? "nao_configurado" : "servidor"));
}

// Pergunta ao assistente. `onTexto(textoAteAgora)` é chamado a cada pedaço que chega (tempo real).
export async function perguntarStream({ mensagens, contexto, idioma, onTexto, signal }) {
  const resp = await postar({ tipo: "chat", idioma, contexto, mensagens }, signal);
  if (!resp.ok) throw await erroDaResposta(resp);
  const tipoResp = resp.headers.get("content-type") || "";
  if (tipoResp.indexOf("application/json") >= 0) throw await erroDaResposta(resp);
  if (!resp.body || !resp.body.getReader) {
    // navegador sem streaming: lê tudo de uma vez
    return interpretarEventos(await resp.text(), onTexto, "").texto;
  }
  const leitor = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let total = "";
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const corte = buf.lastIndexOf("\n\n");
      if (corte < 0) continue;
      const r = interpretarEventos(buf.slice(0, corte + 2), onTexto, total);
      buf = buf.slice(corte + 2);
      total = r.texto;
      if (r.fim) break;
    }
  } catch (e) {
    if (e && e.name === "AbortError") throw new ErroIA("cancelado");
    if (e instanceof ErroIA) throw e;
    throw new ErroIA("rede");
  }
  if (buf.trim()) total = interpretarEventos(buf, onTexto, total).texto;
  return total;
}

function interpretarEventos(bloco, onTexto, totalAtual) {
  let total = totalAtual;
  let fim = false;
  bloco.split("\n\n").forEach((ev) => {
    const linha = ev.split("\n").find((l) => l.startsWith("data:"));
    if (!linha) return;
    let o = null;
    try { o = JSON.parse(linha.slice(5).trim()); } catch (e) { return; }
    if (o.t === "delta" && o.x) { total += o.x; if (onTexto) onTexto(total); }
    else if (o.t === "erro") throw new ErroIA(o.codigo || "servidor");
    else if (o.t === "fim") fim = true;
  });
  return { texto: total, fim };
}

// Reconhecimento de alimentos. Devolve { comida, itens:[{nome,porcao_g,calorias,proteinas_g,carboidratos_g,gorduras_g,confianca}], observacoes }.
export async function analisarFoto({ imagem, idioma, nota, signal }) {
  const resp = await postar({ tipo: "foto", idioma, nota, imagem: { base64: imagem.base64, mediaType: imagem.mediaType } }, signal);
  if (!resp.ok) throw await erroDaResposta(resp);
  let j = null;
  try { j = await resp.json(); } catch (e) { throw new ErroIA("resposta_invalida"); }
  if (!j || !j.ok) throw new ErroIA((j && j.erro) || "servidor");
  return { comida: !!j.comida, itens: j.itens || [], observacoes: j.observacoes || "" };
}

// ---------- imagem: reduz a foto antes de enviar ----------
async function abrirImagem(arquivo) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(arquivo, { imageOrientation: "from-image" }); } catch (e) { /* tenta o outro jeito */ }
    try { return await createImageBitmap(arquivo); } catch (e) { /* tenta o outro jeito */ }
  }
  return new Promise((ok, erro) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); erro(new ErroIA("imagem_invalida")); };
    img.src = url;
  });
}
function desenhar(img, maxLado, qualidade) {
  const largura = img.naturalWidth || img.width, altura = img.naturalHeight || img.height;
  const escala = Math.min(1, maxLado / Math.max(largura, altura));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(largura * escala));
  c.height = Math.max(1, Math.round(altura * escala));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/jpeg", qualidade), largura: c.width, altura: c.height };
}
export async function prepararImagem(arquivo) {
  if (!arquivo || !/^image\//.test(arquivo.type || "image/jpeg")) throw new ErroIA("imagem_invalida");
  const img = await abrirImagem(arquivo);
  const grande = desenhar(img, IA_CONFIG.fotoMaxLado, IA_CONFIG.fotoQualidade);
  const mini = desenhar(img, 96, 0.6);
  if (img.close) img.close();
  return { base64: grande.url.split(",")[1], mediaType: "image/jpeg", previa: grande.url, miniatura: mini.url, largura: grande.largura, altura: grande.altura };
}
