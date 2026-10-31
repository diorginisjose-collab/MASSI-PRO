// api/assinatura.mjs — Massi Pro  •  /api/assinatura
// Troca a "prova de compra" da loja por um TOKEN DE ASSINATURA assinado pelo servidor.
// O app guarda o token e o envia no cabeçalho "Authorization: Bearer <token>" para /api/ia e /api/academias.
// O token vale ~24 h; o app pede um novo todo dia (e sempre que abrir depois de expirar).
//
// Dois provedores (use o que você escolher para a cobrança real):
//   { "provedor": "revenuecat", "appUserId": "..." }
//        precisa de REVENUECAT_SECRET_KEY (chave secreta v1). Os "entitlements" devem se chamar
//        "pro" e "ia" (ou defina RC_ENTITLEMENT_PRO / RC_ENTITLEMENT_IA).
//   { "provedor": "googleplay", "produtoId": "massipro_ia_anual", "purchaseToken": "..." }
//        precisa de GOOGLE_PLAY_PACKAGE (ex.: br.com.massipro) e GOOGLE_PLAY_SA_JSON
//        (conteúdo do JSON da conta de serviço com acesso à Google Play Developer API).
//
// Sempre: ENTITLEMENT_SECRET (mínimo 32 caracteres) — a mesma usada por /api/ia e /api/academias.

import { createHash, createSign } from "node:crypto";
import { emitirToken, tokenConfigurado, nivelDoProduto, contar } from "../lib/protecao.mjs";

const hash = (t) => createHash("sha256").update(String(t)).digest("hex").slice(0, 24);

function cabecalhos(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",")[0].trim() : "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}
function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(corpo));
}

// ---------- RevenueCat ----------
export async function validarRevenueCat(appUserId, fetchFn) {
  const chave = process.env.REVENUECAT_SECRET_KEY;
  if (!chave) { const e = new Error("nao_configurado"); e.codigo = "nao_configurado"; throw e; }
  const r = await fetchFn("https://api.revenuecat.com/v1/subscribers/" + encodeURIComponent(appUserId), {
    headers: { Authorization: "Bearer " + chave, "Content-Type": "application/json" },
  });
  if (!r.ok) { const e = new Error("revenuecat_" + r.status); e.codigo = "falha_loja"; throw e; }
  const dados = await r.json();
  const ents = (dados && dados.subscriber && dados.subscriber.entitlements) || {};
  const agora = Date.now();
  const ativo = (id) => {
    const e = ents[id];
    if (!e) return false;
    if (!e.expires_date) return true; // sem data de fim (vitalício)
    return new Date(e.expires_date).getTime() > agora;
  };
  const nivel = ativo(process.env.RC_ENTITLEMENT_IA || "ia") ? "ia" : ativo(process.env.RC_ENTITLEMENT_PRO || "pro") ? "pro" : null;
  return nivel ? { nivel, sub: hash("rc:" + appUserId) } : null;
}

// ---------- Google Play (Play Developer API, assinaturas v2) ----------
async function tokenGoogle(fetchFn) {
  let conta;
  try { conta = JSON.parse(process.env.GOOGLE_PLAY_SA_JSON || ""); } catch (e) { conta = null; }
  if (!conta || !conta.client_email || !conta.private_key) { const e = new Error("nao_configurado"); e.codigo = "nao_configurado"; throw e; }
  const b64u = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64u({ alg: "RS256", typ: "JWT" }) + "." + b64u({
    iss: conta.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600,
  });
  const assinatura = createSign("RSA-SHA256").update(corpo).sign(conta.private_key).toString("base64url");
  const r = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + encodeURIComponent(corpo + "." + assinatura),
  });
  if (!r.ok) { const e = new Error("google_oauth_" + r.status); e.codigo = "falha_loja"; throw e; }
  const j = await r.json();
  if (!j.access_token) { const e = new Error("google_sem_token"); e.codigo = "falha_loja"; throw e; }
  return j.access_token;
}
export async function validarGooglePlay({ produtoId, purchaseToken }, fetchFn) {
  const nivelProduto = nivelDoProduto(produtoId);
  const pacote = process.env.GOOGLE_PLAY_PACKAGE;
  if (!pacote) { const e = new Error("nao_configurado"); e.codigo = "nao_configurado"; throw e; }
  if (!nivelProduto || typeof purchaseToken !== "string" || purchaseToken.length < 10) return null;
  const acesso = await tokenGoogle(fetchFn);
  const r = await fetchFn(
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" + encodeURIComponent(pacote) +
    "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(purchaseToken),
    { headers: { Authorization: "Bearer " + acesso } }
  );
  if (r.status === 404 || r.status === 410) return null; // compra inexistente/antiga
  if (!r.ok) { const e = new Error("google_play_" + r.status); e.codigo = "falha_loja"; throw e; }
  const d = await r.json();
  const estadoOk = d.subscriptionState === "SUBSCRIPTION_STATE_ACTIVE" || d.subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD";
  const itens = Array.isArray(d.lineItems) ? d.lineItems : [];
  const item = itens.find((i) => i && i.productId === produtoId);
  const naoVenceu = item && item.expiryTime ? new Date(item.expiryTime).getTime() > Date.now() : false;
  if (!estadoOk || !item || !naoVenceu) return null;
  return { nivel: nivelProduto, sub: hash("gp:" + purchaseToken) };
}

export default async function handler(req, res) {
  cabecalhos(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "metodo" });
  if (!tokenConfigurado()) return responder(res, 500, { ok: false, erro: "servidor_sem_segredo" });
  const ip = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "ip";
  if ((await contar("massi:assinatura:" + hash(ip) + ":" + new Date().toISOString().slice(0, 13), 3700)) > 40) {
    return responder(res, 429, { ok: false, erro: "muitas_tentativas" });
  }
  let corpo = req.body;
  if (typeof corpo === "string") { try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; } }
  if (!corpo || typeof corpo !== "object") return responder(res, 400, { ok: false, erro: "pedido_invalido" });
  try {
    let r = null;
    if (corpo.provedor === "revenuecat" && typeof corpo.appUserId === "string" && corpo.appUserId.length >= 3 && corpo.appUserId.length <= 200) {
      r = await validarRevenueCat(corpo.appUserId, fetch);
    } else if (corpo.provedor === "googleplay") {
      r = await validarGooglePlay({ produtoId: corpo.produtoId, purchaseToken: corpo.purchaseToken }, fetch);
    } else {
      return responder(res, 400, { ok: false, erro: "pedido_invalido" });
    }
    if (!r) return responder(res, 403, { ok: false, erro: "sem_assinatura_ativa" });
    const horas = Math.max(1, Math.min(72, Number(process.env.VALIDADE_TOKEN_HORAS) || 24));
    const validadeSeg = horas * 3600;
    const token = emitirToken({ sub: r.sub, nivel: r.nivel, validadeSeg });
    return responder(res, 200, { ok: true, token, nivel: r.nivel, validadeSeg });
  } catch (e) {
    if (e && e.codigo === "nao_configurado") return responder(res, 500, { ok: false, erro: "servidor_nao_configurado" });
    return responder(res, 502, { ok: false, erro: "falha_loja" });
  }
}
