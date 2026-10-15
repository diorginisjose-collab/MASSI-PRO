// ===================================================================
// MASSI PRO — Rotina Inteligente (lógica, sem tela)
// -------------------------------------------------------------------
// O que tem aqui: perguntas (com condicionais), validação, estimativas
// nutricionais, adaptação do treino do gerador do app aos dias livres da
// pessoa, leitura/gravação dos dados e o resumo que vai para a IA.
// A tela fica em RotinaInteligente.jsx.
//
// Dados (todos no window.storage do app, que já separa por perfil):
//   ri-rascunho        respostas ainda NÃO confirmadas (retomar depois)
//   ri-avaliacoes      respostas originais de cada avaliação (só cresce)
//   ri-perfil          perfil atual confirmado (muda com os check-ins)
//   ri-proposta        plano gerado que ainda espera o "Ativar"
//   ri-plano-treino    plano de treino ativo
//   ri-plano-alimentar plano alimentar ativo
//   ri-planos-anteriores planos substituídos (últimos 5)
//   ri-checkins        registros de evolução (só cresce)
// ===================================================================

export const RI_CHAVES = {
  rascunho: "ri-rascunho",
  avaliacoes: "ri-avaliacoes",
  perfil: "ri-perfil",
  proposta: "ri-proposta",
  planoTreino: "ri-plano-treino",
  planoAlimentar: "ri-plano-alimentar",
  anteriores: "ri-planos-anteriores",
  checkins: "ri-checkins",
};

export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const DIAS_ABREV = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const DIAS_PARA_REAVALIAR = 14; // a partir daqui o app sugere reavaliar (sem impor nada)

// ---------- utilidades ----------
export const hojeISO = () => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
export const novoId = () => "ri" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const limparTexto = (t, max) =>
  String(t === undefined || t === null ? "" : t).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 200);
export function paraNumero(v) {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  if (v === undefined || v === null || String(v).trim() === "") return NaN;
  const n = Number(String(v).replace(",", ".").trim());
  return isFinite(n) ? n : NaN;
}
const arred = (n, c) => { const f = Math.pow(10, c || 0); return Math.round(n * f) / f; };
const noIntervalo = (n, a, b) => Math.max(a, Math.min(b, n));
export function diasEntre(isoA, isoB) {
  const a = new Date(isoA + "T12:00:00"), b = new Date(isoB + "T12:00:00");
  return Math.round((b - a) / 86400000);
}
export function dataCurta(iso) {
  return /^\d{4}-\d{2}-\d{2}/.test(iso || "") ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
}
export function idadeDeNascimento(nascimento) {
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}/.test(nascimento)) return null;
  const n = new Date(nascimento + "T12:00:00"), h = new Date();
  let idade = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) idade -= 1;
  return idade >= 5 && idade <= 110 ? idade : null;
}
const opc = (v, l) => ({ v, l: l || v });
const lista = (r, id) => (Array.isArray(r[id]) ? r[id] : []);
const temTexto = (r, id) => limparTexto(r[id], 300).length > 0;

// ---------- as perguntas ----------
// tipo: numero | escolha | multi | texto | dias
// opcional: true  → pode pular.  obrigatorioSe(r) → vira obrigatória quando a regra vale.
// se(r) → só aparece quando a regra vale.  exclusivas → opções que desmarcam as outras (ex.: "Nenhuma").
const OBJ = {
  massa: "Ganhar massa muscular",
  gordura: "Perder gordura",
  recomp: "Ganhar músculos e perder gordura simultaneamente",
  forca: "Melhorar força",
  condicionamento: "Melhorar condicionamento físico",
  saude: "Melhorar saúde e consistência da rotina",
  manter: "Manter os resultados atuais",
};
export const OBJETIVOS_RI = Object.values(OBJ);
const REGIOES = ["Peito", "Costas", "Ombros", "Braços", "Pernas", "Glúteos", "Abdômen"];
const COND_NENHUMA = "Nenhuma";
const NAO_INFORMAR = "Prefiro não informar";

export const ETAPAS = [
  {
    id: "fisico", titulo: "Perfil físico", icone: "🧍",
    campos: [
      { id: "idade", tipo: "numero", rotulo: "Idade", unidade: "anos", min: 14, max: 90, passo: 1 },
      { id: "sexo", tipo: "escolha", rotulo: "Sexo (usado só para estimar o gasto de energia)", opcoes: [opc("masculino", "Masculino"), opc("feminino", "Feminino"), opc("nd", "Prefiro não informar")] },
      { id: "altura", tipo: "numero", rotulo: "Altura", unidade: "cm", min: 120, max: 230, passo: 1 },
      { id: "peso", tipo: "numero", rotulo: "Peso atual", unidade: "kg", min: 30, max: 250, passo: 0.1 },
      { id: "pesoDesejado", tipo: "numero", rotulo: "Peso desejado (se tiver)", unidade: "kg", min: 30, max: 250, passo: 0.1, opcional: true },
      { id: "cintura", tipo: "numero", rotulo: "Medida da cintura (opcional)", unidade: "cm", min: 40, max: 200, passo: 0.5, opcional: true },
      { id: "experiencia", tipo: "escolha", rotulo: "Sua experiência com musculação", opcoes: [opc("Iniciante", "Iniciante"), opc("Intermediário", "Intermediário"), opc("Avançado", "Avançado")] },
      { id: "tempoTreino", tipo: "escolha", rotulo: "Há quanto tempo treina de forma regular?", opcoes: ["Ainda não treino", "Menos de 3 meses", "De 3 a 12 meses", "De 1 a 3 anos", "Mais de 3 anos"].map((x) => opc(x)) },
      { id: "frequenciaAtual", tipo: "numero", rotulo: "Quantos dias por semana você treina hoje?", unidade: "dias", min: 0, max: 7, passo: 1 },
    ],
  },
  {
    id: "objetivos", titulo: "Objetivos", icone: "🎯",
    campos: [
      { id: "objetivo", tipo: "escolha", rotulo: "Seu objetivo principal", opcoes: OBJETIVOS_RI.map((x) => opc(x)) },
      { id: "objetivosSecundarios", tipo: "multi", rotulo: "Objetivos secundários (opcional)", opcional: true, opcoes: (r) => OBJETIVOS_RI.filter((x) => x !== r.objetivo).map((x) => opc(x)) },
      { id: "prioridade", tipo: "escolha", rotulo: "Qual região você quer priorizar?", opcoes: [opc("equilibrado", "Sem prioridade (equilibrado)")].concat(REGIOES.map((x) => opc(x))) },
      { id: "desenvolverMenos", tipo: "multi", rotulo: "Alguma região que prefere desenvolver menos?", opcional: true, exclusivas: ["Nenhuma"], opcoes: REGIOES.concat(["Nenhuma"]).map((x) => opc(x)) },
      { id: "resultado3meses", tipo: "texto", rotulo: "Que resultado seria o mais importante nos próximos 3 meses?", opcional: true, maxLen: 140 },
      { id: "desafio", tipo: "escolha", rotulo: "Seu principal desafio hoje", opcoes: ["Alimentação", "Falta de tempo", "Motivação", "Progressão (evoluir nos treinos)", "Recuperação", "Consistência"].map((x) => opc(x)) },
    ],
  },
  {
    id: "disponibilidade", titulo: "Disponibilidade e treino", icone: "📅",
    campos: [
      { id: "local", tipo: "escolha", rotulo: "Onde você treina?", opcoes: ["Academia completa", "Academia básica", "Casa"].map((x) => opc(x)) },
      { id: "diasDisponiveis", tipo: "dias", rotulo: "Em quais dias você consegue treinar? (mínimo 2)", min: 2 },
      { id: "periodo", tipo: "escolha", rotulo: "Horário em que costuma treinar", opcoes: ["Manhã", "Tarde", "Noite"].map((x) => opc(x)) },
      { id: "tempoSessao", tipo: "escolha", rotulo: "Tempo disponível por treino", opcoes: [opc("30", "30 min"), opc("45", "45 min"), opc("60", "60 min"), opc("75", "75 min"), opc("90", "90 min")] },
      { id: "equipamentos", tipo: "multi", rotulo: "Quais equipamentos você tem?", se: (r) => r.local === "Academia básica" || r.local === "Casa", exclusivas: ["Nenhum equipamento"], opcoes: ["Halteres", "Barra e anilhas", "Banco", "Elásticos", "Barra fixa", "Kettlebell", "Esteira ou bicicleta", "Nenhum equipamento"].map((x) => opc(x)) },
      { id: "exerciciosPreferidos", tipo: "texto", rotulo: "Exercícios que você prefere (opcional)", opcional: true, maxLen: 200 },
      { id: "exerciciosEvitar", tipo: "texto", rotulo: "Exercícios que quer evitar (opcional)", opcional: true, maxLen: 200 },
      { id: "motivoEvitar", tipo: "escolha", rotulo: "Por que quer evitar?", se: (r) => temTexto(r, "exerciciosEvitar"), opcoes: ["Sinto dor ou desconforto", "Orientação profissional", "Não gosto", "Não tenho o equipamento"].map((x) => opc(x)) },
      { id: "outrosEsportes", tipo: "texto", rotulo: "Pratica outros esportes ou atividades? (opcional)", opcional: true, maxLen: 120 },
      { id: "cardioFrequencia", tipo: "numero", rotulo: "Dias de cardio por semana hoje", unidade: "dias", min: 0, max: 7, passo: 1 },
      { id: "ocupacao", tipo: "escolha", rotulo: "No seu dia a dia você fica mais…", opcoes: ["Sentado", "Em pé", "Caminhando", "Com esforço físico intenso"].map((x) => opc(x)) },
    ],
  },
  {
    id: "recuperacao", titulo: "Limitações e recuperação", icone: "🛌",
    campos: [
      { id: "limitacoes", tipo: "multi", rotulo: "Tem alguma limitação física que queira informar?", exclusivas: ["nenhuma"], opcoes: [opc("nenhuma", "Nenhuma"), opc("joelho", "Joelho"), opc("ombro", "Ombro"), opc("lombar", "Lombar"), opc("punho", "Punho"), opc("outra", "Outra")] },
      { id: "movimentoDor", tipo: "texto", rotulo: "Algum movimento causa dor ou desconforto? Qual? (opcional)", opcional: true, maxLen: 160 },
      { id: "orientacaoProfissional", tipo: "texto", rotulo: "Há orientação de médico ou fisioterapeuta que devemos respeitar? (opcional)", opcional: true, maxLen: 200, se: (r) => (lista(r, "limitacoes").some((x) => x !== "nenhuma")) || temTexto(r, "movimentoDor") },
      { id: "sono", tipo: "escolha", rotulo: "Como você avalia a qualidade do seu sono?", opcoes: ["Boa", "Regular", "Ruim"].map((x) => opc(x)) },
      { id: "horasSono", tipo: "numero", rotulo: "Quantas horas costuma dormir por noite?", unidade: "h", min: 3, max: 12, passo: 0.5 },
      { id: "disposicao", tipo: "escolha", rotulo: "Sua disposição durante o dia", opcoes: ["Alta", "Média", "Baixa"].map((x) => opc(x)) },
      { id: "dorMuscularLonga", tipo: "escolha", rotulo: "Sente dores musculares por muitos dias após treinar?", opcoes: ["Não", "Às vezes", "Sim"].map((x) => opc(x)) },
      { id: "recuperacaoDificil", tipo: "escolha", rotulo: "Tem dificuldade para se recuperar entre os treinos?", opcoes: ["Não", "Às vezes", "Sim"].map((x) => opc(x)) },
    ],
  },
  {
    id: "alimentacao", titulo: "Alimentação", icone: "🍽️",
    campos: [
      { id: "refeicoesPorDia", tipo: "numero", rotulo: "Quantas refeições você costuma fazer por dia?", unidade: "refeições", min: 1, max: 8, passo: 1 },
      { id: "horariosRefeicoes", tipo: "texto", rotulo: "Em quais horários costuma comer? (opcional)", opcional: true, maxLen: 100 },
      { id: "alimentosComuns", tipo: "texto", rotulo: "Alimentos que você come com frequência (opcional)", opcional: true, maxLen: 240 },
      { id: "alimentosNaoGosta", tipo: "texto", rotulo: "Alimentos que você não gosta (opcional)", opcional: true, maxLen: 160 },
      { id: "restricoesAlimentares", tipo: "multi", rotulo: "Tem restrição, alergia ou intolerância alimentar?", exclusivas: [COND_NENHUMA], opcoes: [COND_NENHUMA, "Vegetariano", "Vegano", "Sem lactose", "Sem glúten", "Alergia alimentar", "Outra"].map((x) => opc(x)) },
      { id: "restricaoDetalhe", tipo: "texto", rotulo: "Quais alimentos você precisa evitar?", maxLen: 160, se: (r) => lista(r, "restricoesAlimentares").some((x) => x !== COND_NENHUMA), obrigatorioSe: (r) => lista(r, "restricoesAlimentares").some((x) => x === "Alergia alimentar" || x === "Outra") },
      { id: "estiloAlimentar", tipo: "escolha", rotulo: "Que tipo de alimentação combina mais com você?", opcoes: [opc("economica", "Simples e econômica"), opc("variada", "Com mais variedade")] },
      { id: "ondeCome", tipo: "escolha", rotulo: "Você costuma…", opcoes: ["Cozinhar em casa", "Comer fora com frequência", "Os dois"].map((x) => opc(x)) },
      { id: "orcamento", tipo: "escolha", rotulo: "Orçamento aproximado para alimentação", opcoes: ["Apertado", "Médio", "Confortável", NAO_INFORMAR].map((x) => opc(x)) },
      { id: "suplementos", tipo: "texto", rotulo: "Usa suplementos? Quais? (opcional)", opcional: true, maxLen: 120 },
      { id: "fomeHorario", tipo: "escolha", rotulo: "Sente mais fome em algum horário?", opcoes: ["Manhã", "Tarde", "Noite", "Madrugada", "Nenhum horário específico"].map((x) => opc(x)) },
      { id: "dificuldades", tipo: "multi", rotulo: "Tem dificuldade com…", exclusivas: ["Nenhuma"], opcoes: ["Consumir proteínas", "Beber água", "Controlar porções", "Nenhuma"].map((x) => opc(x)) },
      { id: "treinoJejum", tipo: "escolha", rotulo: "Costuma treinar…", opcoes: ["Em jejum", "Depois de comer", "Varia"].map((x) => opc(x)) },
      {
        id: "condicaoEspecial", tipo: "multi", opcional: true, exclusivas: [COND_NENHUMA, NAO_INFORMAR],
        rotulo: "Algo disto se aplica a você? (opcional — usamos só para decidir se as orientações podem ser gerais)",
        opcoes: ["Gravidez ou amamentação", "Condição clínica que exige dieta específica", "Histórico de transtorno alimentar", COND_NENHUMA, NAO_INFORMAR].map((x) => opc(x)),
      },
    ],
  },
];

export const ETAPA_RESUMO = ETAPAS.length; // índice da tela de confirmação

export function opcoesDoCampo(campo, r) {
  const o = typeof campo.opcoes === "function" ? campo.opcoes(r || {}) : campo.opcoes || [];
  return o.map((x) => (typeof x === "string" ? opc(x) : x));
}
export function campoVisivel(campo, r) {
  return typeof campo.se === "function" ? !!campo.se(r || {}) : true;
}
export function camposVisiveis(etapa, r) {
  return etapa.campos.filter((c) => campoVisivel(c, r));
}
function ehObrigatorio(campo, r) {
  if (campo.tipo === "dias") return true;
  if (typeof campo.obrigatorioSe === "function") return !!campo.obrigatorioSe(r);
  return !campo.opcional;
}

// Devolve uma mensagem de erro (ou null se estiver tudo certo)
export function validarCampo(campo, r) {
  const v = r[campo.id];
  const obrig = ehObrigatorio(campo, r);
  if (campo.tipo === "numero") {
    if (v === undefined || v === null || String(v).trim() === "") return obrig ? "Preencha este campo." : null;
    const n = paraNumero(v);
    if (isNaN(n)) return "Digite um número válido.";
    if (n < campo.min || n > campo.max) return "Use um valor entre " + campo.min + " e " + campo.max + " " + (campo.unidade || "") + ".";
    return null;
  }
  if (campo.tipo === "escolha") {
    if (v === undefined || v === null || v === "") return obrig ? "Escolha uma opção." : null;
    return opcoesDoCampo(campo, r).some((o) => o.v === v) ? null : "Escolha uma das opções.";
  }
  if (campo.tipo === "multi") {
    const l = Array.isArray(v) ? v : [];
    if (!l.length) return obrig ? "Escolha ao menos uma opção." : null;
    const validas = opcoesDoCampo(campo, r).map((o) => o.v);
    return l.every((x) => validas.indexOf(x) >= 0) ? null : "Alguma opção não é válida.";
  }
  if (campo.tipo === "dias") {
    const l = Array.isArray(v) ? v : [];
    if (l.length < (campo.min || 1)) return "Escolha ao menos " + (campo.min || 1) + " dias.";
    return l.every((x) => DIAS.indexOf(x) >= 0) ? null : "Algum dia não é válido.";
  }
  const t = limparTexto(v, 400);
  if (!t) return obrig ? "Preencha este campo." : null;
  return t.length > (campo.maxLen || 200) ? "Texto longo demais (máx. " + (campo.maxLen || 200) + " letras)." : null;
}
export function errosDaEtapa(etapa, r) {
  const erros = {};
  camposVisiveis(etapa, r).forEach((c) => { const e = validarCampo(c, r); if (e) erros[c.id] = e; });
  return erros;
}
export function primeiraEtapaComErro(r) {
  for (let i = 0; i < ETAPAS.length; i++) if (Object.keys(errosDaEtapa(ETAPAS[i], r)).length) return i;
  return -1;
}

// Troca de opção em campo "multi" respeitando as exclusivas
export function alternarMulti(campo, atual, valor) {
  const l = Array.isArray(atual) ? atual.slice() : [];
  const ex = campo.exclusivas || [];
  const i = l.indexOf(valor);
  if (i >= 0) { l.splice(i, 1); return l; }
  if (ex.indexOf(valor) >= 0) return [valor];
  return l.filter((x) => ex.indexOf(x) < 0).concat([valor]);
}

// Tira respostas de perguntas que não aparecem mais (ex.: mudou "Casa" para "Academia completa")
export function limparRespostas(r) {
  const out = {};
  ETAPAS.forEach((et) => et.campos.forEach((c) => {
    if (!campoVisivel(c, r)) return;
    const v = r[c.id];
    if (v === undefined || v === null) return;
    if (c.tipo === "numero") { const n = paraNumero(v); if (!isNaN(n)) out[c.id] = n; }
    else if (c.tipo === "multi" || c.tipo === "dias") { if (Array.isArray(v) && v.length) out[c.id] = v.slice(); }
    else if (c.tipo === "texto") { const t = limparTexto(v, c.maxLen || 200); if (t) out[c.id] = t; }
    else if (v !== "") out[c.id] = String(v);
  }));
  return out;
}

// Pré-preenche com o que o app já sabe (onboarding, última avaliação, nível, restrições)
export function respostasIniciais(dados) {
  const d = dados || {};
  const r = {};
  const idade = d.onboarding && idadeDeNascimento(d.onboarding.nascimento);
  if (idade && idade >= 14 && idade <= 90) r.idade = idade;
  const av = d.avaliacao;
  if (av) {
    if (av.sexo === "masculino" || av.sexo === "feminino") r.sexo = av.sexo;
    const peso = paraNumero(av.peso), alt = paraNumero(av.altura);
    if (peso >= 30 && peso <= 250) r.peso = peso;
    if (alt >= 120 && alt <= 230) r.altura = alt;
  }
  if (["Iniciante", "Intermediário", "Avançado"].indexOf(d.nivel) >= 0) r.experiencia = d.nivel;
  const lim = (d.restricoes || []).filter((x) => ["joelho", "ombro", "lombar", "punho"].indexOf(x) >= 0);
  if (lim.length) r.limitacoes = lim;
  return r;
}

// ---------- estimativas nutricionais (sempre ESTIMATIVAS) ----------
export const AJUSTE_KCAL = {
  [OBJ.massa]: 0.1, [OBJ.gordura]: -0.15, [OBJ.recomp]: -0.05, [OBJ.forca]: 0.05,
  [OBJ.condicionamento]: 0, [OBJ.saude]: 0, [OBJ.manter]: 0,
};
export function calcularIMC(peso, alturaCm) {
  const p = paraNumero(peso), h = paraNumero(alturaCm) / 100;
  return p > 0 && h > 0 ? arred(p / (h * h), 1) : null;
}
export function motivosLimiteNutricional(r) {
  const m = [];
  const idade = paraNumero(r.idade);
  if (idade < 18) m.push("menor");
  const c = lista(r, "condicaoEspecial");
  if (c.indexOf("Gravidez ou amamentação") >= 0) m.push("gestacao");
  if (c.indexOf("Condição clínica que exige dieta específica") >= 0) m.push("clinica");
  if (c.indexOf("Histórico de transtorno alimentar") >= 0) m.push("transtorno");
  return m;
}
export const TEXTO_LIMITE = {
  menor: "Para menores de 18 anos o Massi Pro não calcula calorias nem metas: o ideal é acompanhamento de um nutricionista, com participação de um responsável.",
  gestacao: "Na gravidez ou amamentação as necessidades mudam; por isso o Massi Pro não calcula calorias nem metas. Procure seu médico ou nutricionista.",
  clinica: "Com uma condição clínica que exige dieta específica, as orientações do Massi Pro ficam gerais. Siga o plano do seu médico ou nutricionista.",
  transtorno: "Por cuidado, o Massi Pro não mostra números de calorias ou macros nesse caso. Um acompanhamento profissional é o melhor caminho.",
};

export function calcularNutricao(r) {
  const idade = paraNumero(r.idade), peso = paraNumero(r.peso), alt = paraNumero(r.altura);
  const imc = calcularIMC(peso, alt);
  const limites = motivosLimiteNutricional(r);
  const base = { imc, avisos: [], limites };
  if (!(idade > 0 && peso > 0 && alt > 0)) return { ...base, modo: "limitado", motivo: "dados" };
  if (limites.length) return { ...base, modo: "limitado", motivo: limites[0], textoLimite: limites.map((x) => TEXTO_LIMITE[x]).filter(Boolean) };

  // Mifflin-St Jeor; sem informar o sexo usamos a média das duas constantes
  const constante = r.sexo === "masculino" ? 5 : r.sexo === "feminino" ? -161 : -78;
  const tmb = 10 * peso + 6.25 * alt - 5 * idade + constante;
  const ocup = { "Sentado": 0, "Em pé": 0.05, "Caminhando": 0.1, "Com esforço físico intenso": 0.2 }[r.ocupacao] || 0;
  const diasTreino = noIntervalo(lista(r, "diasDisponiveis").length ? Math.min(lista(r, "diasDisponiveis").length, diasRecomendados(r)) : paraNumero(r.frequenciaAtual) || 0, 0, 7);
  const fator = noIntervalo(1.2 + 0.05 * diasTreino + ocup, 1.2, 1.9);
  const manutencao = tmb * fator;

  let ajuste = AJUSTE_KCAL[r.objetivo] || 0;
  if (r.objetivo === OBJ.gordura && imc >= 30) ajuste = -0.2;
  if (ajuste < 0 && imc !== null && imc < 18.5) {
    ajuste = 0;
    base.avisos.push("Seu IMC está abaixo de 18,5: por segurança, as estimativas ficam na manutenção (sem déficit).");
  }
  const piso = r.sexo === "masculino" ? 1500 : 1200;
  let kcal = manutencao * (1 + ajuste);
  if (kcal < piso) { kcal = piso; base.avisos.push("A estimativa foi mantida no mínimo de segurança de " + piso + " kcal."); }

  // proteína por kg; com IMC alto usa um peso de referência ajustado
  const h2 = (alt / 100) * (alt / 100);
  const ideal = 25 * h2;
  const pesoRef = imc !== null && imc > 30 ? ideal + 0.4 * (peso - ideal) : peso;
  const gkg = r.objetivo === OBJ.gordura || r.objetivo === OBJ.recomp ? 2.0 : r.objetivo === OBJ.massa || r.objetivo === OBJ.forca ? 1.8 : 1.6;
  const prot = Math.round(Math.min(pesoRef * gkg, pesoRef * 2.2));
  const gord = Math.round(Math.max(0.7 * pesoRef, (0.22 * kcal) / 9));
  let carb = (kcal - 4 * prot - 9 * gord) / 4;
  if (carb < 100) { carb = 100; base.avisos.push("Os carboidratos foram mantidos em no mínimo 100 g por dia."); }
  carb = Math.round(carb);
  kcal = 4 * prot + 4 * carb + 9 * gord; // calorias sempre batem com os macros
  const kcalFinal = Math.round(kcal / 10) * 10;

  const faixa = (x, pct) => ({ alvo: x, min: Math.round(x * (1 - pct)), max: Math.round(x * (1 + pct)) });
  return {
    ...base, modo: "completo", tmb: Math.round(tmb), fator: arred(fator, 2), manutencao: Math.round(manutencao / 10) * 10,
    ajustePct: Math.round(ajuste * 100), kcal: faixa(kcalFinal, 0.05), proteina: faixa(prot, 0.1), carbo: faixa(carb, 0.1), gordura: faixa(gord, 0.15),
    pesoReferencia: arred(pesoRef, 1),
  };
}

// ---------- treino: parâmetros do gerador do app ----------
export function diasRecomendados(r) {
  const disp = lista(r, "diasDisponiveis").length || 3;
  let max = r.experiencia === "Iniciante" ? 4 : r.experiencia === "Intermediário" ? 5 : 6;
  max = Math.min(max, disp, 6);
  const horas = paraNumero(r.horasSono);
  const pior = (r.recuperacaoDificil === "Sim" ? 1 : 0) + (r.sono === "Ruim" ? 1 : 0) + (horas > 0 && horas < 6 ? 1 : 0) + (r.dorMuscularLonga === "Sim" ? 1 : 0);
  if (pior >= 1) max -= 1;
  if (pior >= 3) max -= 1;
  return noIntervalo(max, 2, 6);
}
export function escolherDiasSemana(indicesDisponiveis, n) {
  const d = indicesDisponiveis.slice().sort((a, b) => a - b);
  if (n >= d.length) return d;
  if (n <= 1) return [d[0]];
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = Math.round((i * (d.length - 1)) / (n - 1));
    if (out.indexOf(d[k]) < 0) out.push(d[k]);
  }
  for (let k = 0; out.length < n && k < d.length; k++) if (out.indexOf(d[k]) < 0) out.push(d[k]);
  return out.sort((a, b) => a - b);
}
export const PRIORIDADE_GERADOR = { Peito: "peito_costas", Costas: "peito_costas", Ombros: "bracos_ombros", "Braços": "bracos_ombros", Pernas: "inferiores", "Glúteos": "gluteos", "Abdômen": "equilibrado", equilibrado: "equilibrado" };
export function objetivoDoGerador(r) {
  const o = r.objetivo;
  if (o === OBJ.massa || o === OBJ.recomp) return "hipertrofia";
  if (o === OBJ.gordura) return "emagrecer";
  if (o === OBJ.forca) return "forca";
  if (o === OBJ.condicionamento) return "condicionamento";
  if (o === OBJ.saude) return "saude";
  return r.experiencia === "Iniciante" ? "saude" : "hipertrofia"; // manter resultados
}
export function paramsGerador(r) {
  return {
    objetivo: objetivoDoGerador(r),
    nivel: r.experiencia || "Iniciante",
    dias: diasRecomendados(r),
    duracao: paraNumero(r.tempoSessao) || 60,
    prioridade: PRIORIDADE_GERADOR[r.prioridade] || "equilibrado", // nunca "sugerida": a prioridade vem da pessoa
    local: r.local === "Casa" ? "casa" : r.local === "Academia básica" ? "limitado" : "academia",
    sexo: r.sexo === "masculino" || r.sexo === "feminino" ? r.sexo : null,
    restricoes: lista(r, "limitacoes").filter((x) => ["joelho", "ombro", "lombar", "punho"].indexOf(x) >= 0),
    variacao: 0,
  };
}
// Leva a semana montada pelo gerador (dias fixos) para os dias que a pessoa realmente tem livres
export function ajustarSemanaAosDias(semana, r) {
  const disp = lista(r, "diasDisponiveis").map((d) => DIAS.indexOf(d)).filter((i) => i >= 0);
  const periodo = r.periodo || "Manhã";
  const treinos = semana.filter((e) => e && e.foco !== "Descanso" && e.foco !== "Cardio" && (e.exercicios || []).length > 0);
  const soCardio = semana.filter((e) => e && e.foco === "Cardio");
  if (!disp.length || !treinos.length) return semana;
  const alvo = escolherDiasSemana(disp, treinos.length);
  const nova = DIAS.map((dia) => ({ dia, foco: "Descanso", cardio: null, exercicios: [] }));
  treinos.forEach((e, i) => { const t = alvo[i]; if (t !== undefined) nova[t] = { ...e, dia: DIAS[t], periodo }; });
  const livres = DIAS.map((_, i) => i).filter((i) => alvo.indexOf(i) < 0);
  const preferidos = livres.filter((i) => disp.indexOf(i) >= 0).concat(livres.filter((i) => disp.indexOf(i) < 0));
  soCardio.forEach((c, i) => { const t = preferidos[i]; if (t !== undefined) nova[t] = { ...c, dia: DIAS[t], periodo }; });
  return nova;
}
export function resumirSemana(semana) {
  return (semana || []).map((e) => ({
    dia: e.dia, foco: e.foco,
    exercicios: (e.exercicios || []).map((x) => ({ nome: x.name, series: x.sets, reps: x.reps, descanso: x.descanso || "", maquina: x.maquina || "" })),
    cardio: e.cardio ? { tipo: e.cardio.tipo, duracao: e.cardio.duracao, intensidade: e.cardio.intensidade } : null,
  }));
}
export function diasDeTreino(semana) {
  return (semana || []).filter((e) => e && e.foco !== "Descanso" && ((e.exercicios || []).length > 0 || e.cardio)).length;
}

// ---------- JSON da IA: leitura segura ----------
export function extrairJSON(bruto) {
  const t = String(bruto || "");
  try { const o = JSON.parse(t); return o && typeof o === "object" ? o : null; } catch (e) { /* tenta recortar */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === "object" ? o : null; } catch (e2) { return null; } }
  return null;
}
const textoIA = (v, max) => limparTexto(v, max || 240);
function listaTextos(v, n, max) {
  return (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? textoIA(x, max || 220) : x && typeof x === "object" ? textoIA(Object.values(x).join(": "), max || 220) : "")).filter(Boolean).slice(0, n || 6);
}
const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function higienizarTreinoIA(bruto, semana) {
  const o = extrairJSON(bruto);
  if (!o) return null;
  const justificativa = textoIA(o.justificativaDivisao || o.justificativa, 500);
  if (!justificativa) return null;
  const nomes = {};
  (semana || []).forEach((d) => (d.exercicios || []).forEach((x) => { nomes[norm(x.name)] = x.name; }));
  const dicas = [];
  (Array.isArray(o.dicasExecucao) ? o.dicasExecucao : []).forEach((d) => {
    if (!d || typeof d !== "object") return;
    const nome = nomes[norm(d.exercicio)];
    const dica = textoIA(d.dica, 220);
    if (nome && dica && dicas.length < 10 && !dicas.some((x) => x.exercicio === nome)) dicas.push({ exercicio: nome, dica });
  });
  return {
    justificativaDivisao: justificativa,
    prioridades: listaTextos(o.prioridades, 4, 160),
    progressao: listaTextos(o.progressao, 5, 220),
    recuperacao: listaTextos(o.recuperacao, 5, 220),
    cardioAtividade: textoIA(o.cardioAtividade, 300),
    dicasExecucao: dicas,
    medirEvolucao: listaTextos(o.medirEvolucao, 5, 200),
    alertas: listaTextos(o.alertas, 4, 220),
  };
}

function horarioValido(h) {
  const m = /^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/.exec(String(h || "").trim());
  if (!m) return "";
  const hh = Number(m[1]), mm = m[2] ? Number(m[2]) : 0;
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 ? String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") : "";
}
const numOuNulo = (v, a, b) => { const n = paraNumero(v); return isNaN(n) ? null : noIntervalo(n, a, b); };

// Confere o cardápio da IA: números em faixas possíveis, calorias coerentes com macros, soma do dia
export function higienizarAlimentarIA(bruto, nutri) {
  const o = extrairJSON(bruto);
  if (!o) return null;
  const completo = !nutri || nutri.modo === "completo";
  const refeicoes = (Array.isArray(o.refeicoes) ? o.refeicoes : []).slice(0, 8).map((m) => {
    if (!m || typeof m !== "object") return null;
    const itens = (Array.isArray(m.itens) ? m.itens : []).slice(0, 10).map((it) => {
      if (!it || typeof it !== "object") return null;
      const alimento = textoIA(it.alimento, 60);
      if (!alimento) return null;
      const item = { alimento, quantidade: textoIA(it.quantidade, 60) };
      if (completo) {
        const p = numOuNulo(it.proteinas_g, 0, 200), c = numOuNulo(it.carboidratos_g, 0, 400), g = numOuNulo(it.gorduras_g, 0, 200);
        let kcal = numOuNulo(it.calorias, 0, 2500);
        if (p !== null && c !== null && g !== null) {
          const calc = 4 * p + 4 * c + 9 * g;
          if (kcal === null || (calc > 0 && Math.abs(kcal - calc) > calc * 0.25)) kcal = calc;
          item.proteinas_g = arred(p, 1); item.carboidratos_g = arred(c, 1); item.gorduras_g = arred(g, 1);
        }
        if (kcal !== null) item.calorias = Math.round(kcal);
      }
      return item;
    }).filter(Boolean);
    const nome = textoIA(m.nome, 40);
    if (!nome || !itens.length) return null;
    return { nome, horario: horarioValido(m.horario), itens, observacao: textoIA(m.observacao, 200) };
  }).filter(Boolean);
  if (!refeicoes.length) return null;

  let totais = null, desvio = null;
  const avisos = [];
  if (completo) {
    totais = { calorias: 0, proteinas_g: 0, carboidratos_g: 0, gorduras_g: 0, completo: true };
    refeicoes.forEach((m) => m.itens.forEach((it) => {
      if (it.calorias === undefined || it.proteinas_g === undefined) { totais.completo = false; return; }
      totais.calorias += it.calorias; totais.proteinas_g += it.proteinas_g; totais.carboidratos_g += it.carboidratos_g; totais.gorduras_g += it.gorduras_g;
    }));
    totais.calorias = Math.round(totais.calorias); totais.proteinas_g = Math.round(totais.proteinas_g);
    totais.carboidratos_g = Math.round(totais.carboidratos_g); totais.gorduras_g = Math.round(totais.gorduras_g);
    if (!totais.completo) avisos.push("Alguns itens vieram sem valores nutricionais; o total do dia pode estar subestimado.");
    if (nutri && nutri.kcal && totais.calorias > 0) {
      desvio = (totais.calorias - nutri.kcal.alvo) / nutri.kcal.alvo;
      if (Math.abs(desvio) > 0.15) avisos.push("O cardápio soma cerca de " + totais.calorias + " kcal, diferente da estimativa de " + nutri.kcal.alvo + " kcal. Ajuste as porções ou gere um novo plano.");
    }
  }
  const subs = (Array.isArray(o.substituicoes) ? o.substituicoes : []).slice(0, 8).map((s) => {
    if (!s || typeof s !== "object") return null;
    const de = textoIA(s.de, 60), por = listaTextos(Array.isArray(s.por) ? s.por : [s.por], 4, 60);
    return de && por.length ? { de, por } : null;
  }).filter(Boolean);
  return {
    plano: {
      estrategia: textoIA(o.estrategia, 400), refeicoes, substituicoes: subs,
      opcoesEconomicas: listaTextos(o.opcoesEconomicas, 5, 160),
      preTreino: textoIA(o.preTreino, 260), posTreino: textoIA(o.posTreino, 260),
      ajustesDias: textoIA(o.ajustesDias, 260), acompanhamento: listaTextos(o.acompanhamento, 5, 200),
      alertas: listaTextos(o.alertas, 4, 220),
    },
    totais, desvio, avisos,
  };
}

export function higienizarReavaliacaoIA(bruto) {
  const o = extrairJSON(bruto);
  if (!o) return null;
  const avaliacao = textoIA(o.avaliacao, 600);
  if (!avaliacao) return null;
  const mudancas = (Array.isArray(o.mudancas) ? o.mudancas : []).slice(0, 6).map((m) => {
    if (!m || typeof m !== "object") return null;
    const mudanca = textoIA(m.mudanca, 220);
    return mudanca ? { area: textoIA(m.area, 30), mudanca, motivo: textoIA(m.motivo, 220) } : null;
  }).filter(Boolean);
  return { avaliacao, manter: o.manter === true, mudancas, proximoPasso: textoIA(o.proximoPasso, 240) };
}

// ---------- check-ins e análise (feita no app, sem inventar) ----------
export const CAMPOS_CHECKIN = [
  { id: "peso", tipo: "numero", rotulo: "Peso atual", unidade: "kg", min: 30, max: 250, passo: 0.1 },
  { id: "cintura", tipo: "numero", rotulo: "Cintura (opcional)", unidade: "cm", min: 40, max: 200, passo: 0.5, opcional: true },
  { id: "forca", tipo: "escolha", rotulo: "Sua força nos exercícios principais", opcoes: ["Melhorou", "Igual", "Piorou"].map((x) => opc(x)) },
  { id: "frequenciaReal", tipo: "numero", rotulo: "Em média, quantos dias por semana você treinou?", unidade: "dias", min: 0, max: 7, passo: 0.5 },
  { id: "dificuldadeAlimentar", tipo: "escolha", rotulo: "Dificuldade para seguir a alimentação", opcoes: ["Nenhuma", "Alguma", "Muita"].map((x) => opc(x)) },
  { id: "fome", tipo: "escolha", rotulo: "Fome ao longo do dia", opcoes: ["Baixa", "Normal", "Alta"].map((x) => opc(x)) },
  { id: "disposicao", tipo: "escolha", rotulo: "Disposição", opcoes: ["Alta", "Média", "Baixa"].map((x) => opc(x)) },
  { id: "recuperacao", tipo: "escolha", rotulo: "Recuperação entre os treinos", opcoes: ["Boa", "Regular", "Ruim"].map((x) => opc(x)) },
  { id: "mudouDisponibilidade", tipo: "escolha", rotulo: "Seus horários ou dias livres mudaram?", opcoes: ["Não", "Sim"].map((x) => opc(x)) },
  { id: "observacao", tipo: "texto", rotulo: "Algo mais que queira registrar? (opcional)", opcional: true, maxLen: 200 },
];
export function errosCheckin(c) {
  const erros = {};
  CAMPOS_CHECKIN.forEach((campo) => { const e = validarCampo(campo, c); if (e) erros[campo.id] = e; });
  return erros;
}
export function limparCheckin(c) {
  const out = { id: novoId(), data: hojeISO() };
  CAMPOS_CHECKIN.forEach((campo) => {
    const v = c[campo.id];
    if (v === undefined || v === null || v === "") return;
    if (campo.tipo === "numero") { const n = paraNumero(v); if (!isNaN(n)) out[campo.id] = n; }
    else if (campo.tipo === "texto") { const t = limparTexto(v, campo.maxLen); if (t) out[campo.id] = t; }
    else out[campo.id] = String(v);
  });
  return out;
}

// Compara check-ins e devolve observações. Nada é alterado automaticamente.
export function analisarEvolucao(perfil, checkins, planoTreino) {
  const lista_ = (checkins || []).slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  const sinais = [];
  if (!lista_.length) return { sinais, manter: false, dados: 0 };
  const ult = lista_[lista_.length - 1], ant = lista_.length > 1 ? lista_[lista_.length - 2] : null;
  const objetivo = perfil && perfil.objetivo;
  const pesoInicial = perfil && perfil.pesoInicial;
  const planejados = planoTreino && planoTreino.semana ? diasDeTreino(planoTreino.semana) : 0;
  let problemas = 0, bons = 0;

  if (ult.frequenciaReal !== undefined && planejados > 0) {
    const adesao = ult.frequenciaReal / planejados;
    if (adesao < 0.6) { sinais.push({ tipo: "atencao", texto: "Você treinou em média " + ult.frequenciaReal + " de " + planejados + " dias planejados. Antes de mudar o treino, vale ver o que está atrapalhando a rotina." }); problemas++; }
    else if (adesao >= 0.85) { sinais.push({ tipo: "ok", texto: "Boa adesão: " + ult.frequenciaReal + " de " + planejados + " treinos por semana." }); bons++; }
  }
  const ref = ant && ant.peso !== undefined ? ant : null;
  const base = ref ? ref : pesoInicial ? { peso: pesoInicial, data: perfil.pesoInicialData } : null;
  if (base && ult.peso !== undefined && base.data) {
    const dias = diasEntre(base.data, ult.data);
    if (dias >= 7) {
      const taxa = ((ult.peso - base.peso) / base.peso) * 100 / (dias / 7); // % do peso por semana
      const deltaTxt = (ult.peso - base.peso >= 0 ? "+" : "") + arred(ult.peso - base.peso, 1).toString().replace(".", ",") + " kg em " + dias + " dias";
      const querPerder = objetivo === OBJ.gordura || objetivo === OBJ.recomp;
      const querGanhar = objetivo === OBJ.massa;
      if (querPerder && taxa > -0.05) { sinais.push({ tipo: "atencao", texto: "Peso: " + deltaTxt + ". Com o objetivo de perder gordura, o ponteiro quase não se mexeu — confira a adesão à alimentação antes de ajustar calorias." }); problemas++; }
      else if (querPerder && taxa < -1) { sinais.push({ tipo: "atencao", texto: "Peso: " + deltaTxt + ". A queda está rápida demais; pode ser sinal de déficit grande e perda de massa magra." }); problemas++; }
      else if (querGanhar && taxa < 0.05) { sinais.push({ tipo: "atencao", texto: "Peso: " + deltaTxt + ". Com o objetivo de ganhar massa, o peso não subiu; talvez falte comida ou constância." }); problemas++; }
      else { sinais.push({ tipo: "info", texto: "Peso: " + deltaTxt + "." }); }
    }
  }
  if (ult.forca === "Melhorou") { sinais.push({ tipo: "ok", texto: "Sua força melhorou desde o último registro." }); bons++; }
  if (ult.forca === "Piorou") { sinais.push({ tipo: "atencao", texto: "Sua força piorou; confira sono, alimentação e se o volume de treino está alto." }); problemas++; }
  if (ult.forca === "Igual" && ant && ant.forca === "Igual" && ult.data > ant.data && diasEntre(ant.data, ult.data) >= 10) {
    sinais.push({ tipo: "atencao", texto: "A força ficou igual em dois registros seguidos: pode ser hora de ajustar a progressão." }); problemas++;
  }
  if (ult.recuperacao === "Ruim" || ult.disposicao === "Baixa") { sinais.push({ tipo: "atencao", texto: "Recuperação ou disposição baixas: sinal de possível fadiga. Considere reduzir o volume por uma semana e cuidar do sono." }); problemas++; }
  if (ult.dificuldadeAlimentar === "Muita") { sinais.push({ tipo: "atencao", texto: "Muita dificuldade para seguir a alimentação: um plano mais simples pode funcionar melhor que um perfeito." }); problemas++; }
  if (ult.fome === "Alta" && (objetivo === OBJ.gordura || objetivo === OBJ.recomp)) { sinais.push({ tipo: "atencao", texto: "Fome alta com meta de perder gordura: vale revisar proteína, fibras e distribuição das refeições." }); problemas++; }
  if (ult.mudouDisponibilidade === "Sim") { sinais.push({ tipo: "atencao", texto: "Sua disponibilidade mudou: o treino pode ser reorganizado para os novos dias." }); problemas++; }
  const manter = problemas === 0 && bons > 0;
  return { sinais, manter, dados: lista_.length, problemas };
}
export function diasDesdeUltimaAtualizacao(estado) {
  const datas = [];
  (estado.checkins || []).forEach((c) => c.data && datas.push(c.data));
  if (estado.planoTreino && estado.planoTreino.geradoEm) datas.push(estado.planoTreino.geradoEm.slice(0, 10));
  if (!datas.length) return null;
  datas.sort();
  return diasEntre(datas[datas.length - 1], hojeISO());
}

// ---------- gravação e leitura ----------
async function ler(chave, padrao) {
  try {
    const r = await window.storage.get(chave);
    if (r && r.value) { const v = JSON.parse(r.value); return v === null || v === undefined ? padrao : v; }
  } catch (e) { /* ainda não existe */ }
  return padrao;
}
async function gravar(chave, valor) {
  const r = await window.storage.set(chave, JSON.stringify(valor));
  if (r === null) throw new Error("falha_ao_salvar");
}
export async function lerEstadoRI() {
  const [perfil, planoTreino, planoAlimentar, checkins, rascunho, proposta, avaliacoes] = await Promise.all([
    ler(RI_CHAVES.perfil, null), ler(RI_CHAVES.planoTreino, null), ler(RI_CHAVES.planoAlimentar, null),
    ler(RI_CHAVES.checkins, []), ler(RI_CHAVES.rascunho, null), ler(RI_CHAVES.proposta, null), ler(RI_CHAVES.avaliacoes, []),
  ]);
  return { perfil, planoTreino, planoAlimentar, checkins: Array.isArray(checkins) ? checkins : [], rascunho, proposta, avaliacoes: Array.isArray(avaliacoes) ? avaliacoes : [] };
}
export const salvarRascunho = (rascunho) => gravar(RI_CHAVES.rascunho, { ...rascunho, atualizadoEm: new Date().toISOString() });
export async function apagarRascunho() { try { await window.storage.delete(RI_CHAVES.rascunho); } catch (e) { /* segue */ } }
export async function apagarProposta() { try { await window.storage.delete(RI_CHAVES.proposta); } catch (e) { /* segue */ } }
export const salvarProposta = (p) => gravar(RI_CHAVES.proposta, p);

// Confirma as respostas: guarda o registro original (nunca é editado) e atualiza o perfil atual.
export async function confirmarAvaliacao(respostasBrutas, tipo) {
  const respostas = limparRespostas(respostasBrutas);
  const registro = { id: novoId(), data: hojeISO(), tipo: tipo || "inicial", respostas };
  const avaliacoes = await ler(RI_CHAVES.avaliacoes, []);
  await gravar(RI_CHAVES.avaliacoes, (Array.isArray(avaliacoes) ? avaliacoes : []).concat([registro]).slice(-20));
  const antigo = await ler(RI_CHAVES.perfil, null);
  const perfil = {
    ...respostas, avaliacaoId: registro.id, confirmadoEm: hojeISO(),
    pesoInicial: antigo && antigo.pesoInicial ? antigo.pesoInicial : respostas.peso,
    pesoInicialData: antigo && antigo.pesoInicialData ? antigo.pesoInicialData : hojeISO(),
  };
  await gravar(RI_CHAVES.perfil, perfil);
  await apagarRascunho();
  return { perfil, registro };
}
// Ativa a proposta: o plano que estava ativo vai para "anteriores" (nada é apagado de verdade)
export async function ativarProposta(proposta) {
  const [t, a, ant] = await Promise.all([ler(RI_CHAVES.planoTreino, null), ler(RI_CHAVES.planoAlimentar, null), ler(RI_CHAVES.anteriores, [])]);
  if (t || a) await gravar(RI_CHAVES.anteriores, (Array.isArray(ant) ? ant : []).concat([{ arquivadoEm: hojeISO(), treino: t, alimentar: a }]).slice(-5));
  const agora = new Date().toISOString();
  const treino = { ...proposta.treino, geradoEm: agora, avaliacaoId: proposta.avaliacaoId, aplicadoNaRotina: false };
  const alimentar = { ...proposta.alimentar, geradoEm: agora, avaliacaoId: proposta.avaliacaoId };
  await gravar(RI_CHAVES.planoTreino, treino);
  await gravar(RI_CHAVES.planoAlimentar, alimentar);
  await apagarProposta();
  return { treino, alimentar };
}
export async function marcarTreinoAplicado() {
  const t = await ler(RI_CHAVES.planoTreino, null);
  if (t) await gravar(RI_CHAVES.planoTreino, { ...t, aplicadoNaRotina: true, aplicadoEm: hojeISO() });
}
// Registro de evolução: só acrescenta. Peso e cintura também atualizam o perfil atual.
export async function adicionarCheckin(dados) {
  const c = limparCheckin(dados);
  const todos = await ler(RI_CHAVES.checkins, []);
  await gravar(RI_CHAVES.checkins, (Array.isArray(todos) ? todos : []).concat([c]).slice(-120));
  const perfil = await ler(RI_CHAVES.perfil, null);
  if (perfil) {
    const novo = { ...perfil };
    if (c.peso !== undefined) { novo.peso = c.peso; novo.pesoAtualizadoEm = c.data; }
    if (c.cintura !== undefined) novo.cintura = c.cintura;
    await gravar(RI_CHAVES.perfil, novo);
  }
  return c;
}

// ---------- texto para a IA ----------
const lst = (v) => (Array.isArray(v) ? v.join(", ") : v || "");
export function perfilParaIA(p) {
  if (!p) return [];
  const L = [];
  const corpo = [];
  if (p.idade) corpo.push("idade " + p.idade);
  if (p.sexo && p.sexo !== "nd") corpo.push("sexo " + p.sexo);
  if (p.altura) corpo.push(p.altura + " cm");
  if (p.peso) corpo.push(p.peso + " kg" + (p.pesoAtualizadoEm ? " (pesado em " + dataCurta(p.pesoAtualizadoEm) + ")" : ""));
  if (p.pesoDesejado) corpo.push("meta " + p.pesoDesejado + " kg");
  if (p.cintura) corpo.push("cintura " + p.cintura + " cm");
  L.push("- corpo: " + (corpo.join("; ") || "não informado"));
  L.push("- experiência: " + (p.experiencia || "?") + (p.tempoTreino ? " (" + p.tempoTreino.toLowerCase() + ")" : "") + (p.frequenciaAtual !== undefined ? "; treinava " + p.frequenciaAtual + "x/semana ao responder" : ""));
  L.push("- objetivo: " + (p.objetivo || "?") + (p.objetivosSecundarios ? "; secundários: " + lst(p.objetivosSecundarios) : "") + "; prioridade muscular: " + (p.prioridade === "equilibrado" ? "nenhuma (equilibrado)" : p.prioridade || "?") + (p.desenvolverMenos && p.desenvolverMenos[0] !== "Nenhuma" ? "; prefere desenvolver menos: " + lst(p.desenvolverMenos) : ""));
  if (p.resultado3meses) L.push("- resultado desejado em 3 meses: " + p.resultado3meses);
  if (p.desafio) L.push("- maior desafio: " + p.desafio);
  L.push("- agenda: " + (p.local || "?") + "; dias livres: " + (lst((p.diasDisponiveis || []).map((d) => DIAS_ABREV[DIAS.indexOf(d)] || d)) || "?") + "; " + (p.tempoSessao || "?") + " min por treino; período: " + (p.periodo || "?") + "; rotina diária: " + (p.ocupacao || "?") + "; cardio hoje: " + (p.cardioFrequencia !== undefined ? p.cardioFrequencia + "x/semana" : "?") + (p.outrosEsportes ? "; outras atividades: " + p.outrosEsportes : ""));
  if (p.equipamentos) L.push("- equipamentos: " + lst(p.equipamentos));
  if (p.exerciciosPreferidos) L.push("- exercícios preferidos: " + p.exerciciosPreferidos);
  if (p.exerciciosEvitar) L.push("- EVITAR exercícios: " + p.exerciciosEvitar + (p.motivoEvitar ? " (motivo: " + p.motivoEvitar.toLowerCase() + ")" : ""));
  const lim = (p.limitacoes || []).filter((x) => x !== "nenhuma");
  if (lim.length || p.movimentoDor || p.orientacaoProfissional) L.push("- LIMITAÇÕES: " + (lim.length ? lst(lim) : "nenhuma listada") + (p.movimentoDor ? "; dor/desconforto em: " + p.movimentoDor : "") + (p.orientacaoProfissional ? "; orientação profissional: " + p.orientacaoProfissional : ""));
  L.push("- recuperação: sono " + (p.sono || "?") + " (" + (p.horasSono || "?") + " h); disposição " + (p.disposicao || "?") + "; dor muscular prolongada: " + (p.dorMuscularLonga || "?") + "; dificuldade de recuperar: " + (p.recuperacaoDificil || "?"));
  const restr = (p.restricoesAlimentares || []).filter((x) => x !== COND_NENHUMA);
  L.push("- alimentação: " + (p.refeicoesPorDia || "?") + " refeições/dia" + (p.horariosRefeicoes ? " (" + p.horariosRefeicoes + ")" : "") + "; estilo " + (p.estiloAlimentar === "economica" ? "simples e econômico" : "com variedade") + "; " + (p.ondeCome || "?").toLowerCase() + "; orçamento " + (p.orcamento && p.orcamento !== NAO_INFORMAR ? p.orcamento.toLowerCase() : "não informado") + "; treina " + (p.treinoJejum || "?").toLowerCase() + "; fome maior: " + (p.fomeHorario || "?").toLowerCase());
  if (p.alimentosComuns) L.push("- come com frequência: " + p.alimentosComuns);
  if (p.alimentosNaoGosta) L.push("- não gosta: " + p.alimentosNaoGosta);
  if (restr.length) L.push("- RESTRIÇÕES ALIMENTARES: " + lst(restr) + (p.restricaoDetalhe ? " — evitar: " + p.restricaoDetalhe : ""));
  const dif = (p.dificuldades || []).filter((x) => x !== "Nenhuma");
  if (dif.length) L.push("- dificuldades: " + lst(dif));
  if (p.suplementos) L.push("- suplementos: " + p.suplementos);
  return L;
}
export function resumoParaIA(estado) {
  if (!estado || !estado.perfil) return "";
  const p = estado.perfil;
  const L = ["ROTINA INTELIGENTE (respostas confirmadas pela pessoa em " + dataCurta(p.confirmadoEm) + "; use sem pedir de novo; se faltar um dado, pergunte):"];
  perfilParaIA(p).forEach((x) => L.push(x));
  const nut = calcularNutricao(p);
  if (nut.modo === "completo") L.push("- metas nutricionais (ESTIMATIVA, não prescrição): ~" + nut.kcal.alvo + " kcal; proteína ~" + nut.proteina.alvo + " g; carboidratos ~" + nut.carbo.alvo + " g; gorduras ~" + nut.gordura.alvo + " g por dia");
  else L.push("- nutrição: SEM metas numéricas (menor de idade, condição especial ou dados faltando); dê só orientações gerais e recomende nutricionista/médico");
  const t = estado.planoTreino;
  if (t && t.semana) {
    const dias = resumirSemana(t.semana).filter((d) => d.exercicios.length || d.cardio).map((d) => (DIAS_ABREV[DIAS.indexOf(d.dia)] || d.dia) + " " + d.foco);
    L.push("- PLANO DE TREINO ATIVO (gerado em " + dataCurta((t.geradoEm || "").slice(0, 10)) + (t.aplicadoNaRotina ? "; já aplicado na aba Rotina" : "; ainda NÃO aplicado na aba Rotina") + "): " + dias.join(" | "));
    if (t.ia && t.ia.progressao && t.ia.progressao.length) L.push("- progressão combinada: " + t.ia.progressao.slice(0, 2).join(" / "));
  }
  const a = estado.planoAlimentar;
  if (a && a.plano && a.plano.refeicoes) {
    L.push("- PLANO ALIMENTAR ATIVO (" + dataCurta((a.geradoEm || "").slice(0, 10)) + "): " + a.plano.refeicoes.map((m) => m.nome + (m.horario ? " " + m.horario : "") + ": " + m.itens.slice(0, 4).map((i) => i.alimento + (i.quantidade ? " " + i.quantidade : "")).join(", ")).join(" | "));
  }
  const c = estado.checkins || [];
  if (c.length) {
    const u = c[c.length - 1];
    L.push("- EVOLUÇÃO REGISTRADA: " + c.length + " check-in(s); último em " + dataCurta(u.data) + ": " + [u.peso !== undefined ? "peso " + u.peso + " kg" : "", u.cintura !== undefined ? "cintura " + u.cintura + " cm" : "", u.forca ? "força " + u.forca.toLowerCase() : "", u.frequenciaReal !== undefined ? "treinou ~" + u.frequenciaReal + "x/semana" : "", u.recuperacao ? "recuperação " + u.recuperacao.toLowerCase() : "", u.disposicao ? "disposição " + u.disposicao.toLowerCase() : ""].filter(Boolean).join("; "));
  } else L.push("- EVOLUÇÃO REGISTRADA: nenhum check-in ainda (não afirme que viu evolução; peça os dados se a pessoa perguntar)");
  return L.join("\n");
}
// Contexto completo que vai ao servidor na geração do plano (parte: treino | alimentar | reavaliacao)
export function contextoGeracao(parte, perfil, nutri, semana, estado) {
  const L = ["PERFIL CONFIRMADO PELA PESSOA:"].concat(perfilParaIA(perfil));
  if (parte === "treino" || parte === "reavaliacao") {
    L.push("");
    L.push("SEMANA DE TREINO PROPOSTA PELO APP (gerador do Massi Pro; foco da semana, não invente exercícios fora dela):");
    resumirSemana(semana).forEach((d) => {
      if (!d.exercicios.length && !d.cardio) return;
      L.push("- " + d.dia + " — " + d.foco + ": " + (d.exercicios.map((e) => e.nome + " " + e.series + "x" + e.reps).join("; ") || "sem exercícios") + (d.cardio ? " | cardio " + d.cardio.tipo + " " + d.cardio.duracao + " min " + d.cardio.intensidade : ""));
    });
  }
  if (parte === "alimentar") {
    L.push("");
    if (nutri && nutri.modo === "completo") {
      L.push("METAS DO DIA (calculadas pelo app; siga exatamente):");
      L.push("- kcal " + nutri.kcal.alvo + " (faixa " + nutri.kcal.min + "–" + nutri.kcal.max + "); proteína " + nutri.proteina.alvo + " g; carboidratos " + nutri.carbo.alvo + " g; gorduras " + nutri.gordura.alvo + " g");
    } else {
      L.push("MODO LIMITADO: NÃO informe calorias nem macros. Dê só orientações gerais e recomende acompanhamento profissional.");
    }
    const t = semana ? resumirSemana(semana).filter((d) => d.exercicios.length).map((d) => (DIAS_ABREV[DIAS.indexOf(d.dia)] || d.dia) + " " + d.foco).join(" | ") : "";
    if (t) L.push("TREINOS DA SEMANA: " + t);
  }
  if (parte === "reavaliacao") {
    L.push("");
    const c = (estado && estado.checkins) || [];
    L.push("CHECK-INS (do mais antigo ao mais novo; use só estes dados):");
    c.slice(-6).forEach((x) => L.push("- " + dataCurta(x.data) + ": " + ["peso", "cintura", "forca", "frequenciaReal", "dificuldadeAlimentar", "fome", "disposicao", "recuperacao", "mudouDisponibilidade", "observacao"].filter((k) => x[k] !== undefined).map((k) => k + "=" + x[k]).join("; ")));
    if (perfil.pesoInicial) L.push("Peso quando começou: " + perfil.pesoInicial + " kg em " + dataCurta(perfil.pesoInicialData));
    const an = analisarEvolucao(perfil, c, estado && estado.planoTreino);
    if (an.sinais.length) L.push("OBSERVAÇÕES DO APP: " + an.sinais.map((s) => s.texto).join(" "));
  }
  return L.join("\n").slice(0, 8800);
}
