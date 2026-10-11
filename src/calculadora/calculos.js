// Calculadora Massi — todas as contas ficam aqui (funções puras, sem tela).
// Pra mudar qualquer valor padrão ("peso × multiplicador"), mexa só neste arquivo.

// Cada objetivo tem seus multiplicadores (por kg de peso). O usuário pode editar na tela.
export const OBJETIVOS = [
  { id: "emagrecer", nome: "Emagrecer", emoji: "🔥", fatores: { prot: 2, agua: 35, kcal: 25, creatina: 0.07, carbo: 4, cafeina: 3 } },
  { id: "manter", nome: "Manter o peso", emoji: "⚖️", fatores: { prot: 1.8, agua: 35, kcal: 30, creatina: 0.07, carbo: 4, cafeina: 3 } },
  { id: "ganhar", nome: "Ganhar massa", emoji: "💪", fatores: { prot: 2, agua: 40, kcal: 38, creatina: 0.07, carbo: 5, cafeina: 3 } },
];

// Os itens "peso × multiplicador" (a ordem é a da tela). passo/min/max controlam a edição do multiplicador.
export const ITENS_META = [
  { id: "prot", nome: "Proteína", emoji: "🥤", unidade: "g", unFator: "g/kg", passo: 0.1, min: 0.5, max: 4 },
  { id: "agua", nome: "Água", emoji: "💧", unidade: "ml", unFator: "ml/kg", passo: 1, min: 20, max: 80 },
  { id: "kcal", nome: "Calorias", emoji: "🔥", unidade: "kcal", unFator: "kcal/kg", passo: 1, min: 10, max: 60 },
  { id: "creatina", nome: "Creatina", emoji: "⚡", unidade: "g", unFator: "g/kg", passo: 0.01, min: 0.03, max: 0.15 },
  { id: "carbo", nome: "Carboidratos", emoji: "🍞", unidade: "g", unFator: "g/kg", passo: 0.5, min: 0.5, max: 12 },
  { id: "cafeina", nome: "Cafeína", emoji: "☕", unidade: "mg", unFator: "mg/kg", passo: 0.5, min: 0, max: 6 },
];

export const ATIVIDADES = [
  { fator: 1.2, nome: "Sedentário", desc: "pouco ou nenhum exercício" },
  { fator: 1.375, nome: "Leve", desc: "1 a 3 treinos por semana" },
  { fator: 1.55, nome: "Moderado", desc: "3 a 5 treinos por semana" },
  { fator: 1.725, nome: "Intenso", desc: "6 a 7 treinos por semana" },
  { fator: 1.9, nome: "Muito intenso", desc: "2 treinos por dia ou trabalho físico pesado" },
];

export const AJUSTES = [
  { id: "def20", nome: "Emagrecer", nota: "déficit de 20%", pct: -0.2 },
  { id: "def10", nome: "Emagrecer leve", nota: "déficit de 10%", pct: -0.1 },
  { id: "manter", nome: "Manter", nota: "sem ajuste", pct: 0 },
  { id: "sup10", nome: "Ganhar leve", nota: "superávit de 10%", pct: 0.1 },
  { id: "sup15", nome: "Ganhar massa", nota: "superávit de 15%", pct: 0.15 },
];

// Tabela clássica de %1RM → repetições possíveis
export const TABELA_PCT = [
  { pct: 100, reps: 1 }, { pct: 95, reps: 2 }, { pct: 90, reps: 4 }, { pct: 85, reps: 6 }, { pct: 80, reps: 8 },
  { pct: 75, reps: 10 }, { pct: 70, reps: 12 }, { pct: 65, reps: 15 }, { pct: 60, reps: 20 }, { pct: 50, reps: 30 },
];

export const LIMITE_CAFEINA_MG = 400; // teto diário geral para adultos saudáveis
export const KCAL_MINIMA_ALERTA = 1200;

export function fatoresPadrao(objetivoId) {
  const o = OBJETIVOS.find((x) => x.id === objetivoId) || OBJETIVOS[0];
  return { ...o.fatores };
}

// Aceita "75", "75,5" e "75.5". Devolve null se não for um número positivo.
export function lerNumero(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).trim().replace(",", "."));
  return isFinite(n) && n > 0 ? n : null;
}
const arred = (n, casas) => { const f = Math.pow(10, casas === undefined ? 2 : casas); return Math.round(n * f + 1e-9) / f; };

// Formata número com vírgula/ponto conforme o idioma (sem zeros sobrando).
export function formatar(n, locale, casas) {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const c = casas === undefined ? 2 : casas;
  try { return Number(arred(n, c)).toLocaleString(locale || "pt-BR", { maximumFractionDigits: c }); } catch (e) { return String(arred(n, c)); }
}

// ---------- Metas do dia (peso × multiplicador) ----------
export function calcularMetas(peso, fatores, kcalManual) {
  const p = lerNumero(peso);
  if (!p) return null;
  const itens = {};
  ITENS_META.forEach((i) => { itens[i.id] = arred(p * (Number(fatores[i.id]) || 0), 2); });
  const kcal = kcalManual ? Math.round(kcalManual) : Math.round(itens.kcal);
  const kcalProt = 4 * itens.prot, kcalCarbo = 4 * itens.carbo;
  const sobra = kcal - kcalProt - kcalCarbo;
  const kcalGord = Math.max(0, sobra);
  const gordG = kcalGord / 9;
  const totalKcalMacros = kcalProt + kcalCarbo + kcalGord;
  const pct = totalKcalMacros > 0 ? { prot: kcalProt / totalKcalMacros, carbo: kcalCarbo / totalKcalMacros, gord: kcalGord / totalKcalMacros } : { prot: 0, carbo: 0, gord: 0 };
  const alertas = [];
  if (sobra < 0) alertas.push({ id: "excede", nivel: "alto", chave: "Proteína e carboidrato somam {0} kcal, acima da meta de {1} kcal. Reduza o multiplicador de um deles ou aumente as calorias.", args: [Math.round(kcalProt + kcalCarbo), kcal] });
  else if (gordG / p < 0.5) alertas.push({ id: "gordura", nivel: "atencao", chave: "Sobram só {0} kcal (≈ {1} g) para gorduras. Gordura muito baixa por muito tempo prejudica hormônios e a absorção de vitaminas: ajuste o carboidrato ou as calorias (toque no ✎ do item).", args: [Math.round(kcalGord), Math.round(gordG)] });
  if (kcal < KCAL_MINIMA_ALERTA) alertas.push({ id: "kcalBaixa", nivel: "alto", chave: "Abaixo de {0} kcal por dia só com acompanhamento de médico ou nutricionista.", args: [KCAL_MINIMA_ALERTA] });
  if (itens.cafeina > LIMITE_CAFEINA_MG) alertas.push({ id: "cafeina", nivel: "atencao", chave: "Cafeína acima de {0} mg por dia passa do limite geral de segurança para adultos.", args: [LIMITE_CAFEINA_MG] });
  if (itens.creatina > 10) alertas.push({ id: "creatina", nivel: "atencao", chave: "Creatina acima de 10 g por dia é mais do que o usual (3 a 5 g costumam bastar).", args: [] });
  if (itens.prot / p > 2.5) alertas.push({ id: "prot", nivel: "info", chave: "Proteína acima de 2,5 g por kg é mais do que costuma ser necessário.", args: [] });
  return {
    peso: p, itens, kcal, kcalManual: !!kcalManual, sobra: Math.round(sobra), kcalGord: Math.round(kcalGord), gordG: arred(gordG, 1),
    pct, fibras: Math.round((kcal / 1000) * 14), copos: arred(itens.agua / 250, 1), alertas,
  };
}

// ---------- Gasto energético (Mifflin-St Jeor) ----------
export function calcularTMB(sexo, peso, alturaCm, idade) {
  const p = lerNumero(peso), h = lerNumero(alturaCm), a = lerNumero(idade);
  if (!p || !h || !a) return null;
  return Math.round(10 * p + 6.25 * h - 5 * a + (sexo === "feminino" ? -161 : 5));
}
export function calcularGasto(sexo, peso, alturaCm, idade, fatorAtividade, ajusteId) {
  const tmb = calcularTMB(sexo, peso, alturaCm, idade);
  if (!tmb) return null;
  const get = Math.round(tmb * (Number(fatorAtividade) || 1.2));
  const ajuste = AJUSTES.find((x) => x.id === ajusteId) || AJUSTES[2];
  const alvo = Math.round(get * (1 + ajuste.pct));
  const alertas = [];
  if (alvo < KCAL_MINIMA_ALERTA) alertas.push({ id: "kcalBaixa", chave: "Abaixo de {0} kcal por dia só com acompanhamento de médico ou nutricionista.", args: [KCAL_MINIMA_ALERTA] });
  else if (alvo < tmb) alertas.push({ id: "abaixoTmb", chave: "A meta ficou abaixo da sua taxa metabólica basal. Déficits assim pedem acompanhamento profissional.", args: [] });
  return { tmb, get, alvo, ajuste, diff: alvo - get, alertas };
}

// ---------- IMC ----------
export const FAIXAS_IMC = [
  { ate: 18.5, nome: "Abaixo do peso", cor: "#6EC1F5" },
  { ate: 25, nome: "Peso normal", cor: "#7FE08F" },
  { ate: 30, nome: "Sobrepeso", cor: "#FFC700" },
  { ate: 35, nome: "Obesidade grau I", cor: "#FF9F43" },
  { ate: 40, nome: "Obesidade grau II", cor: "#FF6B5E" },
  { ate: 999, nome: "Obesidade grau III", cor: "#E04848" },
];
export function calcularIMC(peso, alturaCm) {
  const p = lerNumero(peso), h = lerNumero(alturaCm);
  if (!p || !h || h < 80 || h > 250) return null;
  const m = h / 100;
  const imc = p / (m * m);
  const faixa = FAIXAS_IMC.find((f) => imc < f.ate) || FAIXAS_IMC[FAIXAS_IMC.length - 1];
  const minSaudavel = arred(18.5 * m * m, 1), maxSaudavel = arred(24.9 * m * m, 1);
  const paraFaixa = p < minSaudavel ? arred(minSaudavel - p, 1) : p > maxSaudavel ? arred(p - maxSaudavel, 1) : 0;
  return { imc: arred(imc, 1), faixa, minSaudavel, maxSaudavel, paraFaixa, direcao: p < minSaudavel ? "ganhar" : p > maxSaudavel ? "perder" : "dentro" };
}

// ---------- 1RM ----------
export function calcular1RM(carga, reps) {
  const c = lerNumero(carga), r = Math.round(lerNumero(reps) || 0);
  if (!c || r < 1 || r > 30) return null;
  const epley = r === 1 ? c : c * (1 + r / 30);
  const brzycki = r >= 37 ? null : (r === 1 ? c : (c * 36) / (37 - r));
  const media = brzycki ? (epley + brzycki) / 2 : epley;
  return { epley: arred(epley, 1), brzycki: brzycki === null ? null : arred(brzycki, 1), media: arred(media, 1), confiavel: r <= 12, tabela: TABELA_PCT.map((t) => ({ ...t, carga: arred((media * t.pct) / 100, 1) })) };
}
