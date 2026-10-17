// Cálculos e metadados da Central de Suplementos. Sem IA e sem chamadas externas.
// Conteúdo com status "em revisão": as faixas e limites abaixo precisam ser validados por profissional.

// ---------- metadados do catálogo (sinônimos, flags de filtro) ----------
export const META = {
  "whey": { sinonimos: ["whey protein", "soro do leite", "proteína do soro"], fonteProteica: true, alergenos: ["leite"] },
  "caseina": { sinonimos: ["caseína", "proteína do leite"], fonteProteica: true, alergenos: ["leite"] },
  "proteina-vegetal": { sinonimos: ["proteína vegetal", "proteína de soja", "proteína de ervilha", "vegana"], fonteProteica: true, alergenos: ["soja"] },
  "ovo": { sinonimos: ["albumina", "clara de ovo", "proteína do ovo"], fonteProteica: true, alergenos: ["ovo"] },
  "colageno": { sinonimos: ["colágeno", "gelatina", "colágeno hidrolisado"], fonteProteica: true, alergenos: [] },
  "creatina": { sinonimos: ["creatina monohidratada", "creatine", "monohidrato"], estimulante: false },
  "beta-alanina": { sinonimos: ["beta alanina", "carnosina"] },
  "citrulina": { sinonimos: ["citrulina malato", "L-citrulina"] },
  "beterraba": { sinonimos: ["nitrato", "suco de beterraba", "nitrato dietético"] },
  "cafeina": { sinonimos: ["cafeína", "café", "chá"], estimulante: true },
  "guarana": { sinonimos: ["guaraná", "paullinia"], estimulante: true },
  "carboidrato": { sinonimos: ["maltodextrina", "dextrose", "carboidrato em pó"] },
  "bcaa": { sinonimos: ["BCAA", "aminoácidos de cadeia ramificada"] },
  "glutamina": { sinonimos: ["L-glutamina"] },
  "hmb": { sinonimos: ["beta-hidroxi-beta-metilbutirato"] },
  "taurina": { sinonimos: ["L-taurina"] },
  "vitamina-d": { sinonimos: ["colecalciferol", "vitamina D3"] },
  "magnesio": { sinonimos: ["magnésio", "citrato de magnésio", "óxido de magnésio"] },
  "ferro": { sinonimos: ["sulfato ferroso", "ferro quelato"] },
  "zinco": { sinonimos: ["gluconato de zinco"] },
  "calcio": { sinonimos: ["cálcio", "carbonato de cálcio"] },
  "vitamina-b12": { sinonimos: ["cobalamina", "B12"] },
  "vitamina-c": { sinonimos: ["ácido ascórbico"] },
  "omega-3": { sinonimos: ["ômega-3", "EPA", "DHA", "óleo de peixe"] },
  "curcuma": { sinonimos: ["cúrcuma", "curcumina"] },
  "gengibre": { sinonimos: ["gingerol"] },
  "probioticos": { sinonimos: ["probiótico", "lactobacilos", "bifidobactérias"] },
  "fibra-psyllium": { sinonimos: ["psyllium", "fibra solúvel", "isabgol"] },
  "bicarbonato": { sinonimos: ["bicarbonato de sódio", "sodium bicarbonate", "bicarbonato"] },
  "eaa": { sinonimos: ["EAA", "aminoácidos essenciais", "essential amino acids"] },
  "leucina": { sinonimos: ["L-leucina", "leucine"] },
  "colina": { sinonimos: ["colina", "choline", "fosfatidilcolina"] },
  "gelatina": { sinonimos: ["gelatina", "colágeno animal"], fonteProteica: true, alergenos: [] },
  "bebida-esportiva": { sinonimos: ["isotônico", "bebida isotônica", "sports drink", "eletrólitos"] },
  "gel-energetico": { sinonimos: ["gel", "gel de carboidrato", "energy gel"] },
  "pre-treino-composto": { sinonimos: ["pré-treino", "pre workout", "pré treino"], estimulante: true },
  "mel": { sinonimos: ["açúcar natural"] },
  "banana": { sinonimos: ["potássio"] },
  "aveia": { sinonimos: ["aveia em flocos"] },
  "spirulina": { sinonimos: ["spirulina", "chlorella", "alga"] },
};

export const ALERGENOS = ["leite", "ovo", "soja"];

export function sinonimosDe(id) { return (META[id] && META[id].sinonimos) || []; }
export function ehEstimulante(id) { return !!(META[id] && META[id].estimulante); }
export function ehFonteProteica(id) { return !!(META[id] && META[id].fonteProteica); }
export function alergenosDe(id) { return (META[id] && META[id].alergenos) || []; }

// Texto de busca: nome + sinônimos + categoria + finalidade (sem acento, minúsculo)
export function textoBusca(s) {
  return [s.nome, s.categoria, s.paraQueServe, ...sinonimosDe(s.id)].join(" ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
export const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ---------- proteína diária ----------
// Faixas de referência em g/kg/dia (documentadas abaixo). Não são prescrição.
export const OBJETIVOS_PROTEINA = {
  saude: { rotulo: "Saúde geral (pouca ou nenhuma atividade)", gkgMin: 0.8, gkgMax: 1.0, fonte: "Ingestão de referência para adultos (0,8 g/kg/dia como mínimo; ver DRI/IOM 2005)" },
  atividade: { rotulo: "Atividade física regular", gkgMin: 1.2, gkgMax: 1.6, fonte: "Faixa usada para pessoas ativas em diretrizes de nutrição esportiva (ISSN, 2017) — validar" },
  forca: { rotulo: "Treino de força / ganho de massa", gkgMin: 1.6, gkgMax: 2.2, fonte: "Faixa de estudos de hipertrofia e metanálises (ex.: ISSN, 2017; Morton et al., 2018) — validar" },
};

export function faixaProteina(pesoKg, objetivo) {
  const p = Number(pesoKg);
  if (!isFinite(p) || p < 30 || p > 250) throw new RangeError("peso_invalido");
  const o = OBJETIVOS_PROTEINA[objetivo];
  if (!o) throw new RangeError("objetivo_invalido");
  return { minG: Math.round(p * o.gkgMin), maxG: Math.round(p * o.gkgMax), gkgMin: o.gkgMin, gkgMax: o.gkgMax, rotulo: o.rotulo, fonte: o.fonte };
}

// Compara o que a pessoa já consome com a faixa escolhida
export function situacaoProteina(consumidaG, faixa) {
  const c = Number(consumidaG);
  if (!isFinite(c) || c < 0 || c > 500) throw new RangeError("consumo_invalido");
  if (c < faixa.minG) return { status: "abaixo", diferencaG: faixa.minG - c };
  if (c > faixa.maxG) return { status: "acima", diferencaG: c - faixa.maxG };
  return { status: "dentro", diferencaG: 0 };
}

// Exemplos aproximados de proteína (g por porção habitual). Valores aproximados; conferir tabela oficial (TACO).
export const EXEMPLOS_PROTEINA = [
  { alimento: "Peito de frango cozido", porcao: "100 g", proteinaG: 31 },
  { alimento: "Ovo inteiro", porcao: "1 unidade", proteinaG: 6 },
  { alimento: "Atum em conserva", porcao: "100 g", proteinaG: 25 },
  { alimento: "Leite", porcao: "200 mL", proteinaG: 6.6 },
  { alimento: "Feijão cozido", porcao: "100 g", proteinaG: 5 },
  { alimento: "Iogurte natural", porcao: "170 g", proteinaG: 6 },
];

// ---------- porção proteica (pó) ----------
export function analisarPorcao({ pesoPoG, porcaoG, proteinaPorPorcaoG, alvoG }) {
  const pote = Number(pesoPoG), porcao = Number(porcaoG), prot = Number(proteinaPorPorcaoG);
  if (!(pote > 0 && pote <= 10000)) throw new RangeError("pote_invalido");
  if (!(porcao > 0 && porcao <= 200)) throw new RangeError("porcao_invalida");
  if (!(prot >= 0 && prot <= porcao)) throw new RangeError("proteina_invalida");
  const proteinaPorG = prot / porcao;
  const porcoes = pote / porcao;
  const r = {
    proteinaPorPorcaoG: arred(prot, 1),
    porcoes: Math.floor(porcoes),
    proteinaPorGramoDePo: arred(proteinaPorG, 3),
    proteinaNoPoteG: arred(pote * proteinaPorG, 0),
  };
  if (alvoG !== undefined && alvoG !== null && alvoG !== "") {
    const a = Number(alvoG);
    if (!(a > 0 && a <= 500)) throw new RangeError("alvo_invalido");
    if (proteinaPorG === 0) throw new RangeError("sem_proteina");
    r.gramasDePoParaAlvo = arred(a / proteinaPorG, 0);
    r.porcoesParaAlvo = arred(a / prot, 2);
  }
  return r;
}

// ---------- comparador de rótulos (preenchimento manual) ----------
export function analisarRotulo({ preco, pesoLiquidoG, porcaoG, proteinaPorPorcaoG, ativoPor100g }) {
  const p = Number(preco), peso = Number(pesoLiquidoG), porcao = Number(porcaoG);
  if (!(p > 0 && p <= 100000)) throw new RangeError("preco_invalido");
  if (!(peso > 0 && peso <= 100000)) throw new RangeError("peso_invalido");
  if (!(porcao > 0 && porcao <= peso)) throw new RangeError("porcao_invalida");
  const porcoes = peso / porcao;
  const custoPorPorcao = p / porcoes;
  const out = { porcoes: Math.floor(porcoes), custoPorPorcao: arred(custoPorPorcao, 2) };
  if (proteinaPorPorcaoG !== undefined && proteinaPorPorcaoG !== "" && proteinaPorPorcaoG !== null) {
    const pr = Number(proteinaPorPorcaoG);
    if (!(pr > 0 && pr <= porcao)) throw new RangeError("proteina_invalida");
    out.custoPorGramoProteina = arred(custoPorPorcao / pr, 3);
    out.proteinaTotalG = arred(porcoes * pr, 0);
  }
  if (ativoPor100g !== undefined && ativoPor100g !== "" && ativoPor100g !== null) {
    const at = Number(ativoPor100g);
    if (!(at > 0 && at <= 100)) throw new RangeError("ativo_invalido");
    const ativoTotalG = peso * at / 100;
    out.ativoTotalG = arred(ativoTotalG, 0);
    out.custoPorGramoAtivo = arred(p / ativoTotalG, 3);
  }
  return out;
}

// ---------- cafeína (soma de produtos) ----------
// Referências: EFSA (2015) — até 400 mg/dia para adultos saudáveis; até 200 mg/dia para gestantes. Validar.
export const LIMITE_CAFEINA_ADULTO_MG = 400;
export const LIMITE_CAFEINA_GESTANTE_MG = 200;

export function somarCafeina(itens) {
  let total = 0;
  const linhas = (itens || []).map((it) => {
    const mg = Number(it.mgPorPorcao), n = Number(it.porcoes);
    if (!(mg >= 0 && mg <= 1000)) throw new RangeError("mg_invalido");
    if (!(n >= 0 && n <= 20)) throw new RangeError("porcoes_invalidas");
    const sub = mg * n;
    total += sub;
    return { nome: it.nome || "Produto", totalMg: arred(sub, 0) };
  });
  total = arred(total, 0);
  const alertas = [];
  if (total > LIMITE_CAFEINA_ADULTO_MG) alertas.push("acima_adulto");
  if (total > LIMITE_CAFEINA_GESTANTE_MG) alertas.push("acima_gestante");
  return { linhas, totalMg: total, alertas };
}

// ---------- utilidades ----------
export function arred(n, casas) { const f = Math.pow(10, casas || 0); return Math.round(n * f) / f; }

// ---------- busca inteligente (sugestão automática, sem IA) ----------
// Ranking: 0 = nome começa com o termo; 1 = sinônimo começa com o termo;
// 2 = alguma palavra do nome começa com o termo; 3 = contém o termo em algum lugar.
export function sugerirSuplementos(termo, lista, max) {
  const t = semAcento(termo);
  if (!t) return [];
  const pontuar = (s) => {
    const nome = semAcento(s.nome);
    if (nome.startsWith(t)) return 0;
    if (sinonimosDe(s.id).some((x) => semAcento(x).startsWith(t))) return 1;
    if (nome.split(/[\s(),\/-]+/).some((p) => p.startsWith(t))) return 2;
    if (semAcento(C_textoBusca(s)).includes(t)) return 3;
    return -1;
  };
  return (lista || [])
    .map((s) => ({ s, r: pontuar(s) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.s.nome.localeCompare(b.s.nome, "pt-BR"))
    .slice(0, max || 6)
    .map((x) => x.s);
}

// Completa automaticamente: devolve o trecho que falta do nome (com a grafia original)
// quando o início do nome bate com o que foi digitado. Caso contrário, "".
export function completarAuto(termo, lista) {
  const digitado = String(termo || "");
  if (digitado.trim().length < 1) return "";
  const melhor = sugerirSuplementos(digitado, lista, 1)[0];
  if (!melhor) return "";
  const prefixo = melhor.nome.slice(0, digitado.length);
  if (semAcento(prefixo) !== semAcento(digitado)) return "";
  return melhor.nome.slice(digitado.length);
}

// textoBusca é declarada acima; alias evita dependência de ordem de definição
const C_textoBusca = (s) => textoBusca(s);
