// lib/protecao.mjs — Massi Pro
// Proteção de custo compartilhada pelas funções de servidor (/api/ia, /api/academias):
//   1) assinatura verificada no servidor: um "token de assinatura" assinado (HMAC) emitido por /api/assinatura
//      depois que a loja (Google Play / RevenueCat) confirma que a pessoa paga;
//   2) créditos mensais contados no SERVIDOR (o contador do aparelho vira só um aviso na tela).
//
// Tudo começa DESLIGADO (o app continua funcionando como hoje, com cobrança simulada):
//   EXIGIR_ASSINATURA=1        só atende quem manda um token válido de plano "ia"
//   APLICAR_LIMITE_MENSAL=1    bloqueia quando os créditos do mês acabam
// Mesmo desligado, o servidor já CONTA o uso do mês (dá pra medir o custo real antes de ligar).
//
// Variáveis de ambiente (veja env.protecao.example.txt):
//   ENTITLEMENT_SECRET (mín. 32 caracteres), UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN,
//   CREDITO_MES_CHAT / _FOTO / _ROTINA / _ACADEMIAS (opcionais)

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const memoria = new Map();
let avisouMemoria = false;

// Créditos do mês no servidor = os do app + uma folga (o app devolve crédito quando algo falha, o servidor não).
const PADRAO_MES = { chat: 120, foto: 36, rotina: 36, academias: 18 };
export const PRODUTO_RE = /^massipro_(pro|ia)_(mensal|semestral|anual)$/;

export function nivelDoProduto(produtoId) {
  const m = PRODUTO_RE.exec(String(produtoId || ""));
  return m ? m[1] : null;
}

export function limiteMensal(recurso) {
  const env = Number(process.env["CREDITO_MES_" + String(recurso).toUpperCase()]);
  if (isFinite(env) && env > 0) return Math.floor(env);
  return PADRAO_MES[recurso] || 0;
}

export function redisConfigurado() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ---------- contador (Upstash se configurado; senão memória, que pode zerar a qualquer momento) ----------
export async function contar(chave, ttlSeg) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const r = await fetch(url.replace(/\/$/, "") + "/pipeline", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", chave], ["EXPIRE", chave, ttlSeg]]),
      });
      const j = await r.json();
      const n = j && j[0] && Number(j[0].result);
      if (isFinite(n)) return n;
    } catch (e) { /* cai pra memória */ }
  } else if (!avisouMemoria) {
    avisouMemoria = true;
    console.warn("[protecao] Upstash não configurado: os contadores ficam na memória e podem zerar. Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.");
  }
  const agora = Date.now();
  const e = memoria.get(chave);
  if (!e || e.ate < agora) { memoria.set(chave, { n: 1, ate: agora + ttlSeg * 1000 }); if (memoria.size > 20000) memoria.clear(); return 1; }
  e.n += 1;
  return e.n;
}

// ---------- token de assinatura (HMAC-SHA256) ----------
const b64u = (buf) => Buffer.from(buf).toString("base64url");
function segredo() {
  const s = process.env.ENTITLEMENT_SECRET || "";
  return s.length >= 32 ? s : null;
}
export function tokenConfigurado() { return !!segredo(); }

export function emitirToken({ sub, nivel, validadeSeg }) {
  const seg = segredo();
  if (!seg) throw new Error("sem_segredo");
  if (nivel !== "pro" && nivel !== "ia") throw new Error("nivel_invalido");
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64u(JSON.stringify({ v: 1, sub: String(sub), nivel, iat: agora, exp: agora + (validadeSeg || 86400) }));
  const assinatura = b64u(createHmac("sha256", seg).update(corpo).digest());
  return corpo + "." + assinatura;
}

export function verificarToken(token) {
  const seg = segredo();
  if (!seg || typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  const esperado = createHmac("sha256", seg).update(partes[0]).digest();
  let recebido;
  try { recebido = Buffer.from(partes[1], "base64url"); } catch (e) { return null; }
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  let p;
  try { p = JSON.parse(Buffer.from(partes[0], "base64url").toString("utf8")); } catch (e) { return null; }
  if (!p || p.v !== 1 || !p.sub || (p.nivel !== "pro" && p.nivel !== "ia")) return null;
  if (!(p.exp > Math.floor(Date.now() / 1000))) return null;
  return p;
}

export function tokenDoPedido(req) {
  const h = String((req && req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

function responder(res, status, corpo) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

// Chame depois de validar o pedido e ANTES de gastar com a IA / o Google.
// Devolve { ok:true, ... } ou já responde ao app (401/403/429) e devolve { ok:false }.
export async function protegerPedido(req, res, { recurso, dispositivo }) {
  const exigir = process.env.EXIGIR_ASSINATURA === "1";
  const aplicar = process.env.APLICAR_LIMITE_MENSAL === "1";
  const token = tokenDoPedido(req);
  const p = token ? verificarToken(token) : null;
  if (exigir) {
    if (!p) { responder(res, 401, { ok: false, erro: "assinatura_invalida" }); return { ok: false }; }
    if (p.nivel !== "ia") { responder(res, 403, { ok: false, erro: "sem_plano_ia" }); return { ok: false }; }
  }
  // Com assinatura verificada, o "pote" de créditos é da ASSINATURA (vale em qualquer aparelho).
  // Sem ela, é do aparelho informado pelo app.
  // Sem assinatura verificada: pelo aparelho informado; se o app não informar, pelo IP (guardado só como hash).
  let id;
  if (p) id = "s:" + p.sub;
  else if (dispositivo && dispositivo !== "anon") id = "d:" + String(dispositivo).slice(0, 60);
  else {
    const ip = String((req && req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "ip";
    id = "i:" + createHash("sha256").update(ip).digest("hex").slice(0, 24);
  }
  const mes = new Date().toISOString().slice(0, 7);
  const usado = await contar(`massi:mes:${mes}:${recurso}:${id}`, 40 * 86400);
  const limite = limiteMensal(recurso);
  if (aplicar && limite > 0 && usado > limite) {
    responder(res, 429, { ok: false, erro: "limite_mensal" });
    return { ok: false };
  }
  return { ok: true, usado, limite, assinaturaVerificada: !!p };
}
