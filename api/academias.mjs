// api/academias.mjs — Massi Pro
// Recebe a posição do celular (lat/lng), acha as academias mais próximas (Google Places) e lê o
// site de cada uma procurando menção ao TotalPass e ao Wellhub (antigo Gympass).
//
// Variável de ambiente necessária (Vercel → Settings → Environment Variables):
//   GOOGLE_PLACES_API_KEY  — chave do Google Maps Platform com a "Places API (New)" ativada.
//
// Proteção de custo (assinatura verificada + créditos do mês no servidor): veja lib/protecao.mjs.
//   Começa desligada; liga com EXIGIR_ASSINATURA=1 e APLICAR_LIMITE_MENSAL=1.
//
// Importante: o resultado "citado no site" é um SINAL, não uma garantia. TotalPass e Wellhub não
// oferecem lista pública para outros apps; por isso o app sempre pede pra confirmar no app do plano.

import { protegerPedido } from "../lib/protecao.mjs";

const CACHE_SITES = new Map(); // placeId -> { ate, totalpass, wellhub }
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LIMITE_POR_IP = new Map(); // ip -> { janela, qtd }
const MAX_BUSCAS_POR_HORA = 30;
const MAX_ACADEMIAS = 8;
const RAIO_METROS = 5000;
const TIMEOUT_SITE_MS = 4500;
const MAX_BYTES_SITE = 400000;

const RE_TOTALPASS = /total\s*-?\s*pass/i;
const RE_WELLHUB = /well\s*-?\s*hub|gympass/i;
// Frases que indicam o contrário ("não aceitamos", "deixamos de ser parceiros"...)
const RE_NEGACAO = /n[ãa]o\s+(aceit|trabalh|atend|somos|fazemos|temos)|deix(ou|amos|ar)\s+de|sem\s+(parceria|convenio|convênio)|n[ãa]o\s+[ée]\s+(mais\s+)?parceir/i;

function cabecalhos(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function hostSeguro(urlTexto) {
  try {
    const u = new URL(urlTexto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h)) return false;
    if (h.includes(":")) return false; // IPv6 literal
    return true;
  } catch (e) {
    return false;
  }
}

// Procura o serviço no texto e devolve "citado" | "verificar" | "nao_confirmado".
export function classificar(texto, regex) {
  const alvo = String(texto || "");
  let achou = false;
  let negou = false;
  const g = new RegExp(regex.source, "gi");
  let m;
  while ((m = g.exec(alvo)) !== null) {
    achou = true;
    const trecho = alvo.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70);
    if (RE_NEGACAO.test(trecho)) negou = true;
    if (m.index === g.lastIndex) g.lastIndex++;
  }
  if (!achou) return "nao_confirmado";
  return negou ? "verificar" : "citado";
}

async function lerSite(url, fetchFn) {
  if (!hostSeguro(url)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_SITE_MS);
  try {
    const r = await fetchFn(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MassiProBot/1.0)", Accept: "text/html,application/xhtml+xml" },
    });
    if (!r.ok) return null;
    const tipo = (r.headers && r.headers.get && r.headers.get("content-type")) || "";
    if (tipo && !/html|text/i.test(tipo)) return null;
    const txt = await r.text();
    return txt.slice(0, MAX_BYTES_SITE);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function sinalDoSite(lugar, fetchFn) {
  const emCache = CACHE_SITES.get(lugar.id);
  if (emCache && emCache.ate > Date.now()) return emCache;
  let totalpass = "nao_confirmado";
  let wellhub = "nao_confirmado";
  let leu = false;
  if (lugar.websiteUri) {
    const html = await lerSite(lugar.websiteUri, fetchFn);
    if (html) {
      leu = true;
      totalpass = classificar(html, RE_TOTALPASS);
      wellhub = classificar(html, RE_WELLHUB);
    }
  }
  const r = { totalpass, wellhub, leuSite: leu, ate: Date.now() + CACHE_TTL_MS };
  CACHE_SITES.set(lugar.id, r);
  return r;
}

function limiteExcedido(ip) {
  const agora = Date.now();
  const atual = LIMITE_POR_IP.get(ip);
  if (!atual || agora - atual.janela > 3600000) {
    LIMITE_POR_IP.set(ip, { janela: agora, qtd: 1 });
    return false;
  }
  atual.qtd += 1;
  return atual.qtd > MAX_BUSCAS_POR_HORA;
}

export async function buscarAcademias({ lat, lng, chave, fetchFn }) {
  const resp = await fetchFn("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": chave,
      // Só os campos necessários (cada faixa de campos muda o preço da chamada).
      "X-Goog-FieldMask": [
        "places.id", "places.displayName", "places.formattedAddress", "places.location", "places.rating",
        "places.userRatingCount", "places.websiteUri", "places.googleMapsUri", "places.nationalPhoneNumber",
        "places.currentOpeningHours.openNow",
      ].join(","),
    },
    body: JSON.stringify({
      includedTypes: ["gym", "fitness_center"],
      maxResultCount: 12,
      rankPreference: "DISTANCE",
      languageCode: "pt-BR",
      regionCode: "BR",
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: RAIO_METROS } },
    }),
  });
  if (!resp.ok) {
    const e = new Error("places_" + resp.status);
    e.status = resp.status;
    throw e;
  }
  const dados = await resp.json();
  const lugares = (dados.places || []).slice(0, MAX_ACADEMIAS);
  const sinais = await Promise.all(lugares.map((l) => sinalDoSite(l, fetchFn)));
  return lugares
    .map((l, i) => ({
      id: l.id,
      nome: (l.displayName && l.displayName.text) || "Academia",
      endereco: l.formattedAddress || "",
      lat: l.location ? l.location.latitude : null,
      lng: l.location ? l.location.longitude : null,
      distanciaM: l.location ? distanciaMetros(lat, lng, l.location.latitude, l.location.longitude) : null,
      nota: typeof l.rating === "number" ? l.rating : null,
      avaliacoes: l.userRatingCount || 0,
      aberto: l.currentOpeningHours && typeof l.currentOpeningHours.openNow === "boolean" ? l.currentOpeningHours.openNow : null,
      telefone: l.nationalPhoneNumber || "",
      site: l.websiteUri || "",
      mapsUrl: l.googleMapsUri || "",
      totalpass: sinais[i].totalpass,
      wellhub: sinais[i].wellhub,
      leuSite: sinais[i].leuSite,
    }))
    .sort((a, b) => (a.distanciaM ?? 1e9) - (b.distanciaM ?? 1e9));
}

export default async function handler(req, res) {
  cabecalhos(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "metodo_invalido" });
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) return res.status(500).json({ ok: false, erro: "servidor_sem_chave" });
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || "")) || "").split(",")[0].trim() || "desconhecido";
  if (limiteExcedido(ip)) return res.status(429).json({ ok: false, erro: "muitas_buscas" });
  let corpo = req.body;
  if (typeof corpo === "string") {
    try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; }
  }
  const lat = Number(corpo && corpo.lat);
  const lng = Number(corpo && corpo.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ ok: false, erro: "posicao_invalida" });
  }
  const prot = await protegerPedido(req, res, { recurso: "academias", dispositivo: corpo && corpo.dispositivo });
  if (!prot.ok) return;
  try {
    const academias = await buscarAcademias({ lat, lng, chave, fetchFn: fetch });
    return res.status(200).json({ ok: true, academias, geradoEm: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: "falha_busca" });
  }
}
