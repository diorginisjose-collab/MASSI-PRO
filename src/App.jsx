import React, { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import logoImg from "./assets/logo.png.jpg";

// ---------- Biblioteca de exercícios (base para iniciantes) ----------
// cada exercício traz opções de máquina/equipamento alternativas
const LIBRARY = {
  Peito: [
    { name: "Supino reto", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Halteres", "Máquina smith", "Máquina de supino (chest press)"] },
    { name: "Supino inclinado", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra livre", "Máquina smith"] },
    { name: "Crossover / peck deck", sets: 3, reps: "12-15", maquinas: ["Cabo (crossover)", "Peck deck (voador)"] },
    { name: "Flexão de braço", sets: 3, reps: "até a falha", maquinas: ["Peso corporal"] },
  ],
  Costas: [
    { name: "Puxada frontal", sets: 3, reps: "10-12", maquinas: ["Pulley (puxada alta)"] },
    { name: "Remada baixa", sets: 3, reps: "10-12", maquinas: ["Cabo (remada baixa)", "Máquina de remada"] },
    { name: "Remada curvada", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra livre"] },
    { name: "Puxada supinada", sets: 3, reps: "10-12", maquinas: ["Pulley (pegada supinada)"] },
  ],
  Perna: [
    { name: "Leg press", sets: 3, reps: "12-15", maquinas: ["Leg press 45°"] },
    { name: "Cadeira extensora", sets: 3, reps: "12-15", maquinas: ["Cadeira extensora"] },
    { name: "Mesa/cadeira flexora", sets: 3, reps: "12-15", maquinas: ["Mesa flexora", "Cadeira flexora"] },
    { name: "Agachamento", sets: 3, reps: "15", maquinas: ["Peso corporal", "Barra livre", "Máquina smith"] },
    { name: "Panturrilha em pé", sets: 3, reps: "15-20", maquinas: ["Máquina de panturrilha", "Halteres"] },
  ],
  Ombro: [
    { name: "Desenvolvimento", sets: 3, reps: "10-12", maquinas: ["Halteres", "Máquina de desenvolvimento", "Barra livre"] },
    { name: "Elevação lateral", sets: 3, reps: "12-15", maquinas: ["Halteres", "Cabo (polia baixa)"] },
    { name: "Elevação frontal", sets: 3, reps: "12-15", maquinas: ["Halteres", "Barra", "Cabo"] },
    { name: "Remada alta", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Cabo"] },
  ],
  Braço: [
    { name: "Rosca bíceps", sets: 3, reps: "10-12", maquinas: ["Barra reta", "Barra W", "Halteres"] },
    { name: "Rosca alternada", sets: 3, reps: "10-12", maquinas: ["Halteres"] },
    { name: "Tríceps corda", sets: 3, reps: "10-12", maquinas: ["Pulley (corda)"] },
    { name: "Tríceps testa", sets: 3, reps: "10-12", maquinas: ["Barra W", "Halteres"] },
  ],
  "Corpo inteiro": [
    { name: "Agachamento", sets: 3, reps: "12", maquinas: ["Peso corporal", "Barra livre", "Máquina smith"] },
    { name: "Supino reto", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Halteres", "Máquina smith"] },
    { name: "Remada baixa", sets: 3, reps: "10-12", maquinas: ["Cabo (remada baixa)", "Máquina de remada"] },
    { name: "Desenvolvimento", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra livre"] },
    { name: "Prancha abdominal", sets: 3, reps: "30-40s", maquinas: ["Peso corporal"] },
  ],
};

const FOCOS = ["Peito", "Costas", "Perna", "Ombro", "Braço", "Corpo inteiro", "Cardio", "Descanso"];
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_ABREV = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const CARDIO_TIPOS = ["Esteira", "Bicicleta", "Elíptico", "Corrida ao ar livre", "Pular corda"];
const DESCANSO_OPCOES = ["1 min", "1:30 min", "2 min", "2:30 min", "3 min"];
const DESCANSO_PADRAO = "2 min";

// ---------- Modelos prontos de semana ----------
const MODELOS_SEMANA = [
  {
    id: "fullbody3",
    nome: "Full Body 3x",
    descricao: "3 dias de corpo inteiro + 1 dia de cardio. Ótimo pra começar.",
    focos: ["Corpo inteiro", "Cardio", "Corpo inteiro", "Descanso", "Corpo inteiro", "Descanso", "Descanso"],
  },
  {
    id: "abc",
    nome: "Divisão ABC",
    descricao: "3 dias separando grupos: Peito, Costas e Perna, com cardio no meio.",
    focos: ["Peito", "Costas", "Cardio", "Perna", "Descanso", "Descanso", "Descanso"],
  },
  {
    id: "upperlower",
    nome: "Upper / Lower (4x)",
    descricao: "Alterna parte superior e inferior do corpo, 4 dias por semana.",
    focos: ["Peito", "Perna", "Costas", "Perna", "Descanso", "Descanso", "Descanso"],
  },
  {
    id: "abcde",
    nome: "ABCDE (5x)",
    descricao: "Um grupo muscular por dia: Peito, Costas, Perna, Ombro, Braço.",
    focos: ["Peito", "Costas", "Perna", "Ombro", "Braço", "Descanso", "Descanso"],
  },
];

// ---------- Objetivos — ajustam reps, descanso e cardio do modelo escolhido ----------
const OBJETIVOS = [
  {
    id: "hipertrofia",
    nome: "Hipertrofia",
    descricao: "Ganhar músculo. Cargas moderadas/altas, mais descanso entre séries.",
    reps: null, // mantém os reps padrão de cada exercício (10-12 aprox.)
    descanso: "2 min",
    cardioMin: 20,
    cardioIntensidade: "Moderada",
    adicionarCardioExtra: false,
  },
  {
    id: "emagrecer",
    nome: "Emagrecer",
    descricao: "Perder peso. Mais repetições, descanso curto, mais cardio.",
    reps: "15-20",
    descanso: "1 min",
    cardioMin: 30,
    cardioIntensidade: "Intensa",
    adicionarCardioExtra: true,
  },
  {
    id: "secar",
    nome: "Definição / Secar",
    descricao: "Manter músculo e reduzir gordura. Reps um pouco mais altas, descanso curto.",
    reps: "12-15",
    descanso: "1:30 min",
    cardioMin: 25,
    cardioIntensidade: "Intensa",
    adicionarCardioExtra: true,
  },
];

// ---------- Avaliação física: biotipo, nível, e diretriz de treino ----------
const BIOTIPOS = [
  { id: "ectomorfo", nome: "Ectomorfo", descricao: "Corpo naturalmente magro, mais dificuldade pra ganhar peso e músculo." },
  { id: "mesomorfo", nome: "Mesomorfo", descricao: "Ganha músculo com relativa facilidade, estrutura mais atlética." },
  { id: "endomorfo", nome: "Endomorfo", descricao: "Tendência a acumular gordura mais fácil, estrutura mais robusta." },
];

const NIVEIS = ["Iniciante", "Intermediário", "Avançado"];

const RECOMENDACAO_MODELO = {
  hipertrofia: { Iniciante: "fullbody3", Intermediário: "abc", Avançado: "abcde" },
  emagrecer: { Iniciante: "fullbody3", Intermediário: "upperlower", Avançado: "abc" },
  secar: { Iniciante: "upperlower", Intermediário: "abc", Avançado: "abcde" },
};

function gerarDicas(objetivoId, biotipoId) {
  const dicasObjetivo = {
    hipertrofia: [
      "Priorize progressão: some peso ou repetições aos poucos, toda semana.",
      "Inclua uma fonte de proteína em cada refeição principal.",
      "Durma bem — é no descanso que o músculo se recupera e cresce.",
    ],
    emagrecer: [
      "Mantenha o treino de força — é o que evita perder músculo junto com a gordura.",
      "Cardio de 3 a 4x por semana ajuda bastante nesse objetivo.",
      "Prefira um déficit calórico leve e gradual, sem cortar demais de uma vez.",
    ],
    secar: [
      "Mantenha a carga dos exercícios de força pra não perder o músculo conquistado.",
      "O cardio regular ajuda a reduzir gordura mantendo a definição.",
      "Ajustes pequenos e graduais na alimentação tendem a durar mais que cortes drásticos.",
    ],
  };
  const dicasBiotipo = {
    ectomorfo: "Seu biotipo tende a ter mais dificuldade pra ganhar peso — não exagere no cardio e garanta que está comendo o suficiente.",
    mesomorfo: "Seu biotipo costuma responder bem a treino e alimentação equilibrados — a consistência é sua maior aliada.",
    endomorfo: "Seu biotipo tende a acumular gordura mais fácil — cardio regular e atenção à alimentação fazem bastante diferença.",
  };
  return [...(dicasObjetivo[objetivoId] || []), dicasBiotipo[biotipoId]].filter(Boolean);
}

// ---------- Planos (sugestão de valores — ajuste depois de integrar pagamento real) ----------
const PLANOS = [
  {
    id: "mensal",
    nome: "Mensal",
    preco: "R$ 19,90",
    periodo: "/mês",
    economia: null,
  },
  {
    id: "semestral",
    nome: "Semestral",
    preco: "R$ 14,90",
    periodo: "/mês",
    totalNota: "R$ 89,40 a cada 6 meses",
    economia: "Economize 25%",
  },
  {
    id: "anual",
    nome: "Anual",
    preco: "R$ 9,90",
    periodo: "/mês",
    totalNota: "R$ 118,80 por ano",
    economia: "Economize 50%",
    destaque: true,
  },
];

const BENEFICIOS_PREMIUM = [
  "Rotinas e histórico ilimitados",
  "Sugestões de progressão de carga",
];

// Vídeos curtos (shorts), um específico por combinação de exercício + equipamento escolhido
const VIDEOS_EXERCICIO = {
  "Supino reto": {
    "Barra livre": "https://www.youtube.com/shorts/Dgya0jXreXk",
    "Halteres": "https://www.youtube.com/shorts/kgZwiUZvhOU",
    "Máquina smith": "https://www.youtube.com/watch?v=RS_AkiwHtu0",
    "Máquina de supino (chest press)": "https://www.youtube.com/shorts/3nKRhr_fYME",
  },
  "Supino inclinado": {
    "Halteres": "https://www.youtube.com/shorts/oN48at2Zw7s",
    "Barra livre": "https://www.youtube.com/shorts/01hWm0_TxmU",
    "Máquina smith": "https://www.youtube.com/shorts/3pV9sa-kHvg",
  },
  "Crossover / peck deck": {
    "Cabo (crossover)": "https://www.youtube.com/shorts/zUpoL205xcI",
    "Peck deck (voador)": "https://www.youtube.com/shorts/iQD461A66CM",
  },
  "Flexão de braço": {
    "Peso corporal": "https://www.youtube.com/shorts/cmH9E_DEEKo",
  },
  "Puxada frontal": {
    "Pulley (puxada alta)": "https://www.youtube.com/shorts/y8hwkR2Puwg",
  },
  "Remada baixa": {
    "Cabo (remada baixa)": "https://www.youtube.com/shorts/eM0iMLxRIlM",
    "Máquina de remada": "https://www.youtube.com/shorts/Rol3VyfWzJ8",
  },
  "Remada curvada": {
    "Halteres": "https://www.youtube.com/shorts/krw3W1_PM18",
    "Barra livre": "https://www.youtube.com/shorts/r2BIpnqmoJA",
  },
  "Puxada supinada": {
    "Pulley (pegada supinada)": "https://www.youtube.com/shorts/5afXrSb51Ak",
  },
  "Leg press": {
    "Leg press 45°": "https://www.youtube.com/shorts/ydEAJPDckm4",
  },
  "Cadeira extensora": {
    "Cadeira extensora": "https://www.youtube.com/shorts/s_5HG9UWIj4",
  },
  "Mesa/cadeira flexora": {
    "Mesa flexora": "https://www.youtube.com/shorts/ne-J--fK0tE",
    "Cadeira flexora": "https://www.youtube.com/shorts/BrVJvDECpWM",
  },
  "Agachamento": {
    "Peso corporal": "https://www.youtube.com/shorts/m3MYREmGL1I",
    "Barra livre": "https://www.youtube.com/shorts/7DzHTQC2Rek",
    "Máquina smith": "https://www.youtube.com/shorts/8pjN_4fkxgU",
  },
  "Panturrilha em pé": {
    "Máquina de panturrilha": "https://www.youtube.com/shorts/aDebZhb6beQ",
    "Halteres": "https://www.youtube.com/shorts/Yv-HBl6VUpA",
  },
  "Desenvolvimento": {
    "Halteres": "https://www.youtube.com/shorts/NgrouG-wQZk",
    "Máquina de desenvolvimento": "https://www.youtube.com/shorts/JzicyWYUw0c",
    "Barra livre": "https://www.youtube.com/shorts/tZH8QkgWkL0",
  },
  "Elevação lateral": {
    "Halteres": "https://www.youtube.com/shorts/L80dGu0bTV8",
    "Cabo (polia baixa)": "https://www.youtube.com/shorts/Xnd-vzXqQSY",
  },
  "Elevação frontal": {
    "Halteres": "https://www.youtube.com/shorts/upvQnASGckQ",
    "Barra": "https://www.youtube.com/shorts/wZ6R1Egg4w8",
    "Cabo": "https://www.youtube.com/shorts/fD6PMQLVdPQ",
  },
  "Remada alta": {
    "Barra livre": "https://www.youtube.com/shorts/csF_uw7niTI",
    "Cabo": "https://www.youtube.com/shorts/VW_QBk-Ls1U",
  },
  "Rosca bíceps": {
    "Barra reta": "https://www.youtube.com/shorts/_eoH4C5HAzQ",
    "Barra W": "https://www.youtube.com/shorts/OlhyhVmtL_c",
    "Halteres": "https://www.youtube.com/shorts/WL9wrobiAbo",
  },
  "Rosca alternada": {
    "Halteres": "https://www.youtube.com/shorts/1LpnsHK6uMw",
  },
  "Tríceps corda": {
    "Pulley (corda)": "https://www.youtube.com/shorts/44bGFYA6DmI",
  },
  "Tríceps testa": {
    "Barra W": "https://www.youtube.com/shorts/LTHWfSZSa2Q",
    "Halteres": "https://www.youtube.com/shorts/NNx0w_PDumY",
  },
  "Prancha abdominal": {
    "Peso corporal": "https://www.youtube.com/shorts/XqPlCDe37lA",
  },
};

function getVideoUrl(exercicio) {
  const porMaquina = VIDEOS_EXERCICIO[exercicio.name];
  if (!porMaquina) return null;
  if (porMaquina[exercicio.maquina]) return porMaquina[exercicio.maquina];
  // fallback: primeira opção cadastrada, caso a máquina exata não tenha vídeo específico ainda
  const primeira = Object.values(porMaquina)[0];
  return primeira || null;
}

const GUIA_EXECUCAO = {
  "Supino reto": {
    grupoMuscular: "Peito, ombro, tríceps",
    comoExecutar: [
      "Deite no banco com os pés firmes no chão e a lombar levemente arqueada",
      "Segure a barra/halteres um pouco mais aberto que a largura dos ombros",
      "Desça controlado até quase tocar o peito",
      "Empurre para cima sem travar o cotovelo com força no topo",
    ],
    errosComuns: ["Arquear demais as costas", "Deixar o cotovelo abrir 90° e forçar o ombro"],
    dica: "Expire ao empurrar o peso pra cima, inspire na descida.",
  },
  "Supino inclinado": {
    grupoMuscular: "Peito superior, ombro",
    comoExecutar: [
      "Ajuste o banco entre 30° e 45°",
      "Segure os halteres/barra na altura do peito superior",
      "Empurre pra cima em linha reta, sem jogar pra trás",
      "Desça controlado até sentir alongar o peito",
    ],
    errosComuns: ["Inclinar demais o banco (vira mais ombro que peito)", "Descer rápido demais"],
    dica: "Se sentir mais no ombro que no peito, reduza a inclinação.",
  },
  "Crossover / peck deck": {
    grupoMuscular: "Peito",
    comoExecutar: [
      "Ajuste o banco/altura da polia conforme o aparelho",
      "Cotovelos levemente flexionados durante todo o movimento",
      "Puxe as manoplas em direção ao centro do peito",
      "Volte controlado até sentir o alongamento",
    ],
    errosComuns: ["Usar peso alto e perder o controle na volta", "Esticar totalmente o cotovelo"],
    dica: "É um exercício de acabamento — priorize a conexão mente-músculo, não a carga.",
  },
  "Flexão de braço": {
    grupoMuscular: "Peito, ombro, tríceps, core",
    comoExecutar: [
      "Mãos um pouco mais abertas que os ombros, corpo alinhado",
      "Desça controlado até o peito quase tocar o chão",
      "Empurre de volta mantendo o abdômen contraído",
    ],
    errosComuns: ["Deixar o quadril cair ou subir demais", "Amplitude curta"],
    dica: "Se não conseguir completar, apoie os joelhos no chão pra reduzir a carga.",
  },
  "Puxada frontal": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Sente-se e prenda as pernas sob o apoio",
      "Pegada um pouco mais aberta que os ombros",
      "Puxe a barra até a altura do peito, levando o cotovelo pra baixo",
      "Suba controlado sem deixar o peso bater",
    ],
    errosComuns: ["Puxar com o corpo em vez das costas", "Usar impulso"],
    dica: "Imagine 'levar o cotovelo ao bolso' pra ativar as costas de verdade.",
  },
  "Remada baixa": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Sente-se com joelhos levemente flexionados, coluna neutra",
      "Puxe o cabo em direção ao abdômen",
      "Aperte as escápulas no final do movimento",
      "Volte controlado sem arredondar as costas",
    ],
    errosComuns: ["Balançar o tronco pra frente e pra trás", "Encolher o ombro perto da orelha"],
    dica: "Mantenha o peito aberto o tempo todo.",
  },
  "Remada curvada": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Incline o tronco à frente mantendo a coluna reta",
      "Puxe o peso em direção ao abdômen/quadril",
      "Aperte as costas no topo do movimento",
      "Desça controlado",
    ],
    errosComuns: ["Arredondar a lombar", "Usar embalo do corpo"],
    dica: "Se sentir dor lombar, reduza a inclinação do tronco.",
  },
  "Puxada supinada": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Pegada supinada (palmas voltadas pra você), mais fechada que os ombros",
      "Puxe a barra até perto do peito",
      "Foque em levar o cotovelo pra baixo, não pra trás",
      "Suba controlado",
    ],
    errosComuns: ["Puxar só com o braço", "Ombros subindo durante o movimento"],
    dica: "Essa pegada recruta mais o bíceps junto com as costas.",
  },
  "Leg press": {
    grupoMuscular: "Quadríceps, glúteo, posterior",
    comoExecutar: [
      "Pés na largura dos ombros, apoiados na plataforma",
      "Desça controlado até formar cerca de 90° no joelho",
      "Empurre sem travar o joelho no topo",
      "Mantenha a lombar apoiada no banco o tempo todo",
    ],
    errosComuns: ["Descer demais e tirar a lombar do banco", "Travar o joelho com força no topo"],
    dica: "Pés mais altos na plataforma ativam mais glúteo e posterior.",
  },
  "Cadeira extensora": {
    grupoMuscular: "Quadríceps",
    comoExecutar: [
      "Ajuste o encosto pra costas ficarem apoiadas",
      "Estenda a perna até quase travar o joelho",
      "Segure um instante no topo",
      "Desça controlado, sem soltar o peso",
    ],
    errosComuns: ["Deixar o peso bater no final", "Movimento rápido demais"],
    dica: "Controle a descida — é onde mais se ganha força.",
  },
  "Mesa/cadeira flexora": {
    grupoMuscular: "Posterior de coxa",
    comoExecutar: [
      "Ajuste o apoio na altura do tornozelo",
      "Flexione o joelho trazendo o calcanhar em direção ao glúteo",
      "Aperte no topo do movimento",
      "Volte controlado",
    ],
    errosComuns: ["Levantar o quadril durante o movimento", "Amplitude curta"],
    dica: "Mantenha o quadril colado no banco/apoio o tempo todo.",
  },
  "Agachamento": {
    grupoMuscular: "Quadríceps, glúteo, posterior, core",
    comoExecutar: [
      "Pés na largura dos ombros, ponta levemente pra fora",
      "Desça como se fosse sentar, quadril pra trás",
      "Desça até coxa paralela ao chão (ou seu limite confortável)",
      "Suba empurrando o chão com os pés",
    ],
    errosComuns: ["Joelho colapsando pra dentro", "Tirar o calcanhar do chão"],
    dica: "Olhe pra frente e mantenha o peito aberto durante todo o movimento.",
  },
  "Panturrilha em pé": {
    grupoMuscular: "Panturrilha",
    comoExecutar: [
      "Fique na ponta dos pés na plataforma, apoio nos ombros/mãos",
      "Suba o máximo possível na ponta dos pés",
      "Desça controlado até alongar bem a panturrilha",
    ],
    errosComuns: ["Movimento curto e rápido demais", "Não descer até alongar"],
    dica: "Pausa de 1 segundo no topo aumenta bastante a ativação.",
  },
  "Desenvolvimento": {
    grupoMuscular: "Ombro, tríceps",
    comoExecutar: [
      "Sentado ou em pé, core contraído",
      "Segure o peso na altura dos ombros",
      "Empurre pra cima até quase estender o cotovelo",
      "Desça controlado até a altura dos ombros",
    ],
    errosComuns: ["Arquear muito a lombar", "Descer rápido demais"],
    dica: "Se sentir dor no ombro, reduza a amplitude no topo.",
  },
  "Elevação lateral": {
    grupoMuscular: "Ombro (deltóide lateral)",
    comoExecutar: [
      "Halteres ao lado do corpo, cotovelo levemente flexionado",
      "Eleve os braços até a altura dos ombros",
      "Segure um instante no topo",
      "Desça controlado",
    ],
    errosComuns: ["Usar embalo do corpo", "Subir acima da linha do ombro"],
    dica: "Peso leve com execução controlada funciona melhor que peso alto aqui.",
  },
  "Elevação frontal": {
    grupoMuscular: "Ombro (deltóide anterior)",
    comoExecutar: [
      "Segure o peso à frente do corpo",
      "Eleve até a altura dos ombros, braço quase reto",
      "Desça controlado sem balançar o tronco",
    ],
    errosComuns: ["Impulsionar com o corpo", "Subir além da linha do ombro"],
    dica: "Alterne um braço de cada vez se for difícil manter o controle.",
  },
  "Remada alta": {
    grupoMuscular: "Ombro, trapézio",
    comoExecutar: [
      "Segure o peso à frente do corpo, pegada fechada",
      "Puxe pra cima levando os cotovelos acima das mãos",
      "Suba até a altura do peito",
      "Desça controlado",
    ],
    errosComuns: ["Puxar demais alto (sobrecarrega o ombro)", "Usar embalo"],
    dica: "Se sentir desconforto no ombro, pare na altura do peito, sem subir mais.",
  },
  "Rosca bíceps": {
    grupoMuscular: "Bíceps",
    comoExecutar: [
      "Cotovelos colados ao corpo",
      "Flexione o braço levando o peso até o ombro",
      "Aperte o bíceps no topo",
      "Desça controlado até estender o braço",
    ],
    errosComuns: ["Balançar o tronco pra ajudar", "Cotovelo saindo do lugar"],
    dica: "Se está balançando o corpo, o peso está pesado demais.",
  },
  "Rosca alternada": {
    grupoMuscular: "Bíceps",
    comoExecutar: [
      "Halteres ao lado do corpo",
      "Flexione um braço de cada vez, girando levemente a palma pra cima",
      "Aperte no topo",
      "Desça controlado antes de trocar de braço",
    ],
    errosComuns: ["Balançar o ombro", "Não descer totalmente"],
    dica: "Alternar os braços ajuda a manter o controle e a postura.",
  },
  "Tríceps corda": {
    grupoMuscular: "Tríceps",
    comoExecutar: [
      "Cotovelos colados ao corpo, presos ao lado das costelas",
      "Estenda os braços puxando a corda pra baixo",
      "Abra levemente a corda no final do movimento",
      "Volte controlado sem deixar o cotovelo sair do lugar",
    ],
    errosComuns: ["Cotovelo se afastando do corpo", "Usar o ombro pra empurrar"],
    dica: "Só o antebraço se move — cotovelo fica fixo.",
  },
  "Tríceps testa": {
    grupoMuscular: "Tríceps",
    comoExecutar: [
      "Deitado, segure o peso com os braços estendidos acima do peito",
      "Flexione só o cotovelo, descendo o peso em direção à testa",
      "Estenda de volta sem mover o ombro",
    ],
    errosComuns: ["Mover o ombro/cotovelo pra frente e pra trás", "Descer rápido demais"],
    dica: "Cotovelo fica apontando pro teto o tempo todo, só o antebraço mexe.",
  },
  "Prancha abdominal": {
    grupoMuscular: "Core (abdômen e lombar)",
    comoExecutar: [
      "Apoie antebraços e pontas dos pés no chão",
      "Corpo em linha reta da cabeça aos calcanhares",
      "Contraia o abdômen e o glúteo",
      "Segure a posição pelo tempo definido",
    ],
    errosComuns: ["Deixar o quadril cair ou subir demais", "Prender a respiração"],
    dica: "Respire normalmente enquanto mantém a contração do abdômen.",
  },
};

function descansoParaSegundos(str) {
  const mapa = { "1 min": 60, "1:30 min": 90, "2 min": 120, "2:30 min": 150, "3 min": 180 };
  return mapa[str] || 120;
}

function formatarMMSS(totalSeg) {
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function tocarBip() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.25);
    });
  } catch (e) {
    // ambiente sem suporte a áudio — segue só com vibração/visual
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function toExercicio(base) {
  return { id: uid(), ...base, maquina: base.maquinas[0], descanso: DESCANSO_PADRAO };
}

function makeDayEntry(dia, foco) {
  if (foco === "Cardio") {
    return { dia, foco, cardio: { tipo: "Esteira", duracao: 20, intensidade: "Moderada" }, exercicios: [] };
  }
  if (foco === "Descanso" || !foco) {
    return { dia, foco: foco || "Descanso", cardio: null, exercicios: [] };
  }
  const base = LIBRARY[foco] || [];
  return {
    dia,
    foco,
    cardio: null,
    exercicios: base.slice(0, 4).map(toExercicio),
  };
}

// ================================================================
// ADMOB — estrutura pronta pra integração (sem IDs, sem alterar
// nenhuma funcionalidade existente do app).
//
// IMPORTANTE: este arquivo é um artifact React que roda no
// navegador. O AdMob é um SDK NATIVO (Android/iOS) e não funciona
// dentro de uma página web. Esse bloco só passa a fazer efeito de
// verdade depois que o projeto for empacotado como app nativo/
// híbrido (ex: via Capacitor + @capacitor-community/admob).
// Até lá, todas as funções abaixo ficam inertes (não fazem nada).
//
// Veja o arquivo ADMOB_SETUP.md pra o passo a passo completo de
// onde inserir os IDs e o que configurar antes de publicar.
// ================================================================

// 1) IDs do AdMob — preencha aqui quando tiver os valores reais.
// NUNCA foram inseridos IDs de exemplo/fictícios de propósito:
// use os IDs reais gerados no seu próprio console do AdMob.
const ADMOB_CONFIG = {
  appId: {
    android: "", // TODO ADMOB: App ID do AdMob (Android) — formato ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
    ios: "", // TODO ADMOB: App ID do AdMob (iOS)
  },
  banner: {
    android: "", // TODO ADMOB: Ad Unit ID do banner (Android)
    ios: "", // TODO ADMOB: Ad Unit ID do banner (iOS)
  },
  interstitial: {
    android: "", // TODO ADMOB: Ad Unit ID do intersticial (Android)
    ios: "", // TODO ADMOB: Ad Unit ID do intersticial (iOS)
  },
  rewarded: {
    android: "", // TODO ADMOB: Ad Unit ID do recompensado (Android)
    ios: "", // TODO ADMOB: Ad Unit ID do recompensado (iOS)
  },
};

// Detecta a plataforma quando rodando dentro de um shell Capacitor.
// Em ambiente web puro (este artifact), retorna "web" e todo o
// restante do bloco vira no-op automaticamente.
function plataformaAtual() {
  try {
    const platform = window?.Capacitor?.getPlatform?.();
    return platform || "web";
  } catch (e) {
    return "web";
  }
}

function idAnuncio(tipo) {
  const plataforma = plataformaAtual();
  const chave = plataforma === "ios" ? "ios" : "android";
  return ADMOB_CONFIG[tipo]?.[chave] || "";
}

function admobProntoParaUso() {
  // Só considera "pronto" quando os IDs tiverem sido preenchidos.
  return Boolean(ADMOB_CONFIG.appId.android || ADMOB_CONFIG.appId.ios);
}

function getAdMobPlugin() {
  // O plugin nativo só existe depois que o projeto for portado pra
  // Capacitor com @capacitor-community/admob instalado e sincronizado.
  return typeof window !== "undefined" ? window?.Capacitor?.Plugins?.AdMob : null;
}

// 2) Inicialização — chamar uma vez, no carregamento do app.
async function inicializarAdMob() {
  if (!admobProntoParaUso()) return;
  const plugin = getAdMobPlugin();
  if (!plugin) return; // ambiente sem suporte nativo (ex: preview web deste artifact)
  try {
    await plugin.initialize();
  } catch (e) {
    // ambiente sem AdMob disponível — app continua funcionando normalmente
  }
}

// 3) Intersticial — chamar em transições naturais do app
// (ex: depois de concluir um treino, depois de trocar de modelo de
// semana). Ver comentários "TODO ADMOB" espalhados pelo código pra
// sugestões de onde chamar — nenhum deles está ativo por padrão.
async function mostrarInterstitial() {
  if (!admobProntoParaUso()) return;
  const plugin = getAdMobPlugin();
  const adId = idAnuncio("interstitial");
  if (!plugin || !adId) return;
  try {
    await plugin.prepareInterstitial({ adId });
    await plugin.showInterstitial();
  } catch (e) {
    // falha ao carregar/exibir — o fluxo do app segue normalmente
  }
}

// 4) Recompensado — chamar quando o usuário optar por assistir um
// anúncio em troca de algo (ex: liberar um recurso premium por um
// tempo). onRecompensa recebe o resultado retornado pelo plugin.
async function mostrarRecompensado(onRecompensa) {
  if (!admobProntoParaUso()) return;
  const plugin = getAdMobPlugin();
  const adId = idAnuncio("rewarded");
  if (!plugin || !adId) return;
  try {
    await plugin.prepareRewardVideoAd({ adId });
    const resultado = await plugin.showRewardVideoAd();
    if (resultado && onRecompensa) onRecompensa(resultado);
  } catch (e) {
    // falha ao carregar/exibir — nenhuma recompensa é concedida
  }
}

// 5) Banner — componente pronto pra montar em qualquer tela.
// Renderiza null sempre (o banner nativo é desenhado por cima da
// webview pelo próprio SDK, não como elemento React). Em ambiente
// web (este artifact) não faz nada — zero impacto visual/funcional.
function AdBanner({ posicao = "BOTTOM_CENTER" }) {
  useEffect(() => {
    if (!admobProntoParaUso()) return;
    const plugin = getAdMobPlugin();
    const adId = idAnuncio("banner");
    if (!plugin || !adId) return;
    plugin.showBanner({ adId, position: posicao }).catch(() => {});
    return () => {
      plugin.hideBanner().catch(() => {});
    };
  }, [posicao]);
  return null;
}

export default function App() {
  const [rotina, setRotina] = useState(() =>
    DIAS_SEMANA.map((dia, i) =>
      makeDayEntry(dia, ["Corpo inteiro", "Cardio", "Corpo inteiro"][i] || "Descanso")
    )
  );
  const [diasSelecionados, setDiasSelecionados] = useState(["Segunda", "Terça", "Quarta"]);
  const [saveState, setSaveState] = useState("idle");
  const [loaded, setLoaded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showPlanos, setShowPlanos] = useState(false);
  const [showModelos, setShowModelos] = useState(false);
  const [activeTab, setActiveTab] = useState("rotina");
  const [exercicioAberto, setExercicioAberto] = useState(null);
  const [cronometro, setCronometro] = useState(null); // { totalSeg, restanteSeg, rodando, label }
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("rotina-treino");
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (parsed.rotina) setRotina(parsed.rotina);
          if (parsed.diasSelecionados) setDiasSelecionados(parsed.diasSelecionados);
        }
      } catch (e) {
        // sem rotina salva ainda
      } finally {
        setLoaded(true);
      }
      try {
        const premiumRes = await window.storage.get("status-premium");
        if (premiumRes && premiumRes.value === "true") setIsPremium(true);
      } catch (e) {
        // usuário free por padrão
      }
      try {
        const histRes = await window.storage.get("historico-treinos");
        if (histRes && histRes.value) setHistorico(JSON.parse(histRes.value));
      } catch (e) {
        // sem histórico salvo ainda
      }
    })();

    // TODO ADMOB: inicialização do AdMob (inerte até ter IDs configurados
    // e o projeto estar rodando dentro de um shell nativo/Capacitor)
    inicializarAdMob();
  }, []);

  const assinar = async (planoId) => {
    try {
      await window.storage.set("status-premium", "true");
    } catch (e) {
      // segue mesmo se salvar falhar; estado local já reflete
    }
    setIsPremium(true);
    setShowPlanos(false);
  };

  const iniciarDescanso = (descansoStr, label) => {
    const seg = descansoParaSegundos(descansoStr);
    setCronometro({ totalSeg: seg, restanteSeg: seg, rodando: true, label });
  };

  // contagem regressiva do cronômetro de descanso
  useEffect(() => {
    if (!cronometro || !cronometro.rodando) return;
    if (cronometro.restanteSeg <= 0) return;
    const id = setInterval(() => {
      setCronometro((c) => {
        if (!c || !c.rodando) return c;
        if (c.restanteSeg <= 1) {
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          tocarBip();
          return { ...c, restanteSeg: 0, rodando: false };
        }
        return { ...c, restanteSeg: c.restanteSeg - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cronometro && cronometro.rodando, cronometro && cronometro.label]);

  const toggleDia = (dia) => {
    setDiasSelecionados((prev) => {
      if (prev.includes(dia)) return prev.filter((d) => d !== dia);
      return DIAS_SEMANA.filter((d) => prev.includes(d) || d === dia);
    });
  };

  const mudarFoco = (dia, foco) => {
    setRotina((prev) => prev.map((d) => (d.dia === dia ? makeDayEntry(dia, foco) : d)));
  };

  const aplicarModelo = (modeloId, objetivoId) => {
    const modelo = MODELOS_SEMANA.find((m) => m.id === modeloId);
    const objetivo = OBJETIVOS.find((o) => o.id === objetivoId);
    if (!modelo) return;

    let focos = [...modelo.focos];
    if (objetivo && objetivo.adicionarCardioExtra) {
      const idxDescanso = focos.indexOf("Descanso");
      if (idxDescanso !== -1) focos[idxDescanso] = "Cardio";
    }

    setRotina(
      DIAS_SEMANA.map((dia, i) => {
        const entry = makeDayEntry(dia, focos[i] || "Descanso");
        if (!objetivo) return entry;
        if (entry.cardio) {
          entry.cardio = { ...entry.cardio, duracao: objetivo.cardioMin, intensidade: objetivo.cardioIntensidade };
        }
        if (entry.exercicios.length > 0) {
          entry.exercicios = entry.exercicios.map((ex) => ({
            ...ex,
            reps: objetivo.reps || ex.reps,
            descanso: objetivo.descanso,
          }));
        }
        return entry;
      })
    );
    setDiasSelecionados(DIAS_SEMANA.filter((dia, i) => (focos[i] || "Descanso") !== "Descanso"));
    setShowModelos(false);
  };

  const addExercicio = (dia, foco) => {
    const opcoes = LIBRARY[foco] || [];
    setRotina((prev) =>
      prev.map((d) => {
        if (d.dia !== dia) return d;
        const usados = new Set(d.exercicios.map((e) => e.name));
        const proximo = opcoes.find((o) => !usados.has(o.name));
        if (!proximo) return d;
        return { ...d, exercicios: [...d.exercicios, toExercicio(proximo)] };
      })
    );
  };

  const removerExercicio = (dia, id) => {
    setRotina((prev) =>
      prev.map((d) => (d.dia === dia ? { ...d, exercicios: d.exercicios.filter((e) => e.id !== id) } : d))
    );
  };

  const trocarExercicio = (dia, id) => {
    setRotina((prev) =>
      prev.map((d) => {
        if (d.dia !== dia) return d;
        const opcoes = LIBRARY[d.foco] || [];
        const usados = new Set(d.exercicios.map((e) => e.name));
        const atual = d.exercicios.find((e) => e.id === id);
        if (!atual) return d;
        // libera o nome atual pra poder reaproveitar se só sobrar ele
        usados.delete(atual.name);
        const candidatos = opcoes.filter((o) => !usados.has(o.name));
        const indiceAtual = candidatos.findIndex((o) => o.name === atual.name);
        const proximo = candidatos[(indiceAtual + 1) % candidatos.length] || atual;
        return {
          ...d,
          exercicios: d.exercicios.map((e) =>
            e.id === id ? { id: e.id, ...proximo, maquina: proximo.maquinas[0], descanso: e.descanso } : e
          ),
        };
      })
    );
  };

  const concluirTreino = async (diaEntry) => {
    const registro = {
      id: uid(),
      data: new Date().toISOString().slice(0, 10),
      dia: diaEntry.dia,
      foco: diaEntry.foco,
      totalExercicios: diaEntry.exercicios.length,
      cardio: diaEntry.cardio ? { tipo: diaEntry.cardio.tipo, duracao: diaEntry.cardio.duracao } : null,
    };
    const novoHistorico = [...historico, registro];
    setHistorico(novoHistorico);
    try {
      await window.storage.set("historico-treinos", JSON.stringify(novoHistorico));
    } catch (e) {
      // segue mesmo se falhar salvar
    }
    // TODO ADMOB: bom ponto pra exibir um intersticial, ex: mostrarInterstitial();
    // Deixado comentado de propósito — decida a frequência ideal antes de ativar.
  };

  const editarExercicio = (dia, id, campo, valor) => {
    setRotina((prev) =>
      prev.map((d) =>
        d.dia === dia
          ? {
              ...d,
              exercicios: d.exercicios.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)),
            }
          : d
      )
    );
  };

  const editarCardio = (dia, campo, valor) => {
    setRotina((prev) =>
      prev.map((d) => (d.dia === dia ? { ...d, cardio: { ...d.cardio, [campo]: valor } } : d))
    );
  };

  const salvar = useCallback(async () => {
    setSaveState("saving");
    try {
      const result = await window.storage.set("rotina-treino", JSON.stringify({ diasSelecionados, rotina }));
      setSaveState(result ? "saved" : "error");
      setTimeout(() => setSaveState("idle"), 2200);
    } catch (e) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2200);
    }
  }, [diasSelecionados, rotina]);

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        .chip { transition: background-color .15s ease, color .15s ease, border-color .15s ease; }
        .chip:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible {
          outline: 2px solid #B8433A; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header style={styles.hero}>
        <div style={styles.heroOverlay} />
        <div style={styles.headerTop}>
          <img src={logoImg} alt="Massi Pro" style={styles.logoMark} />
          <button style={isPremium ? styles.premiumBadge : styles.freeBadge} onClick={() => setShowPlanos(true)}>
            {isPremium ? "★ Premium" : "Free — ver planos"}
          </button>
        </div>
        <h1 style={styles.title}>Massi Pro</h1>
        <p style={styles.subtitle}>Treino, evolução e execução — tudo num só lugar.</p>
      </header>

      <div style={styles.content}>
      {showPlanos && <PlanosModal isPremium={isPremium} onAssinar={assinar} onClose={() => setShowPlanos(false)} />}
      {exercicioAberto && (
        <ExercicioModal
          exercicio={exercicioAberto}
          onClose={() => setExercicioAberto(null)}
          onIniciarDescanso={() => {
            iniciarDescanso(exercicioAberto.descanso, exercicioAberto.name);
            setExercicioAberto(null);
          }}
        />
      )}
      {cronometro && (
        <CronometroDescanso
          cronometro={cronometro}
          onPausarContinuar={() =>
            setCronometro((c) => (c ? { ...c, rodando: !c.rodando } : c))
          }
          onAjustar={(delta) =>
            setCronometro((c) =>
              c
                ? {
                    ...c,
                    totalSeg: Math.max(15, c.totalSeg + delta),
                    restanteSeg: Math.max(0, Math.min(c.totalSeg + delta, c.restanteSeg + delta)),
                  }
                : c
            )
          }
          onReiniciar={() => setCronometro((c) => (c ? { ...c, restanteSeg: c.totalSeg, rodando: true } : c))}
          onFechar={() => setCronometro(null)}
        />
      )}

      <div style={styles.tabRow}>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "rotina" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("rotina")}
        >
          Rotina
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "historico" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("historico")}
        >
          Histórico
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "notas" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("notas")}
        >
          Notas
        </button>
        <button
          style={{ ...styles.tabBtn, ...(activeTab === "evolucao" ? styles.tabBtnActive : {}) }}
          onClick={() => setActiveTab("evolucao")}
        >
          Avaliação
        </button>
      </div>

      {activeTab === "rotina" && (
        <>
          <button style={styles.modelosBtn} onClick={() => setShowModelos(true)}>
            🔁 Trocar a semana inteira por um modelo pronto
          </button>

          <section style={styles.card}>
            <div style={styles.cardLabel}>Quais dias você treina? (toque pra ligar/desligar)</div>
            <div style={styles.chipRow}>
              {DIAS_SEMANA.map((dia, i) => (
                <button
                  key={dia}
                  className="chip"
                  onClick={() => toggleDia(dia)}
                  style={{
                    ...styles.chip,
                    ...(diasSelecionados.includes(dia) ? styles.chipActive : {}),
                  }}
                >
                  {DIAS_ABREV[i]}
                </button>
              ))}
            </div>
          </section>

          {showModelos && <ModelosModal onEscolher={aplicarModelo} onClose={() => setShowModelos(false)} />}

          <div style={styles.restBanner}>
            Descanso recomendado entre séries: <strong>2 a 3 min</strong>. Ajuste por exercício se precisar.
          </div>

          <div style={styles.dayList}>
            {rotina
              .filter((d) => diasSelecionados.includes(d.dia))
              .map((d) => (
                <DayCard
                  key={d.dia}
                  entry={d}
                  onFoco={(foco) => mudarFoco(d.dia, foco)}
                  onAddExercicio={() => addExercicio(d.dia, d.foco)}
                  onRemoveExercicio={(id) => removerExercicio(d.dia, id)}
                  onEditExercicio={(id, campo, valor) => editarExercicio(d.dia, id, campo, valor)}
                  onEditCardio={(campo, valor) => editarCardio(d.dia, campo, valor)}
                  onAbrirExercicio={(ex) => setExercicioAberto(ex)}
                  onIniciarDescanso={(descanso, nome) => iniciarDescanso(descanso, nome)}
                  onTrocarExercicio={(id) => trocarExercicio(d.dia, id)}
                  onConcluirTreino={() => concluirTreino(d)}
                />
              ))}
          </div>

          <button style={styles.saveButton} onClick={salvar}>
            {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "✓ Rotina salva" : saveState === "error" ? "Erro ao salvar — tentar de novo" : "Salvar rotina"}
          </button>

          {!loaded && <div style={styles.loadingNote}>Carregando sua última rotina salva…</div>}
        </>
      )}

      {activeTab === "historico" && <HistoricoTab />}

      {activeTab === "notas" && <NotasTab />}

      {activeTab === "evolucao" && (
        <EvolucaoTab
          onAplicarTreino={(modeloId, objetivoId) => {
            aplicarModelo(modeloId, objetivoId);
            setActiveTab("rotina");
          }}
        />
      )}
      </div>

      {/* Banner do AdMob — inerte até ter ID configurado e o app estar
          rodando num shell nativo/Capacitor. Não altera o layout atual. */}
      <AdBanner />
    </div>
  );
}

function EvolucaoTab({ onAplicarTreino }) {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [cintura, setCintura] = useState("");
  const [quadril, setQuadril] = useState("");
  const [peito, setPeito] = useState("");
  const [braco, setBraco] = useState("");
  const [coxa, setCoxa] = useState("");
  const [objetivo, setObjetivo] = useState("hipertrofia");
  const [biotipo, setBiotipo] = useState("mesomorfo");
  const [nivel, setNivel] = useState("Iniciante");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("avaliacoes-evolucao");
        if (res && res.value) setAvaliacoes(JSON.parse(res.value));
      } catch (e) {
        // sem avaliações salvas ainda
      } finally {
        setCarregado(true);
      }
    })();
  }, []);

  const salvarAvaliacao = async () => {
    if (!peso) return;
    const nova = {
      id: uid(),
      data: new Date().toISOString().slice(0, 10),
      peso: Number(peso),
      altura: altura ? Number(altura) : null,
      cintura: cintura ? Number(cintura) : null,
      quadril: quadril ? Number(quadril) : null,
      peito: peito ? Number(peito) : null,
      braco: braco ? Number(braco) : null,
      coxa: coxa ? Number(coxa) : null,
      objetivo,
      biotipo,
      nivel,
    };
    const novaLista = [...avaliacoes, nova];
    setSalvando(true);
    try {
      await window.storage.set("avaliacoes-evolucao", JSON.stringify(novaLista));
      setAvaliacoes(novaLista);
      setPeso("");
      setCintura("");
      setQuadril("");
      setPeito("");
      setBraco("");
      setCoxa("");
    } catch (e) {
      // segue mesmo se falhar o storage
    } finally {
      setSalvando(false);
    }
  };

  const ultima = avaliacoes[avaliacoes.length - 1];
  const anterior = avaliacoes[avaliacoes.length - 2];
  const deltaPeso = ultima && anterior ? +(ultima.peso - anterior.peso).toFixed(1) : null;

  const modeloRecomendadoId = RECOMENDACAO_MODELO[objetivo] && RECOMENDACAO_MODELO[objetivo][nivel];
  const modeloRecomendado = MODELOS_SEMANA.find((m) => m.id === modeloRecomendadoId);
  const dicas = gerarDicas(objetivo, biotipo);

  const dadosGrafico = avaliacoes.map((a) => ({ data: a.data.slice(5), peso: a.peso }));

  return (
    <div>
      <section style={styles.card}>
        <div style={styles.cardLabel}>Registrar avaliação de hoje</div>

        <div style={styles.avalGrid}>
          <label style={styles.avalField}>
            Peso (kg) *
            <input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} style={styles.avalInput} placeholder="ex: 72.5" />
          </label>
          <label style={styles.avalField}>
            Altura (cm)
            <input type="number" value={altura} onChange={(e) => setAltura(e.target.value)} style={styles.avalInput} placeholder="ex: 175" />
          </label>
          <label style={styles.avalField}>
            Cintura (cm)
            <input type="number" value={cintura} onChange={(e) => setCintura(e.target.value)} style={styles.avalInput} />
          </label>
          <label style={styles.avalField}>
            Quadril (cm)
            <input type="number" value={quadril} onChange={(e) => setQuadril(e.target.value)} style={styles.avalInput} />
          </label>
          <label style={styles.avalField}>
            Peito (cm)
            <input type="number" value={peito} onChange={(e) => setPeito(e.target.value)} style={styles.avalInput} />
          </label>
          <label style={styles.avalField}>
            Braço (cm)
            <input type="number" value={braco} onChange={(e) => setBraco(e.target.value)} style={styles.avalInput} />
          </label>
          <label style={styles.avalField}>
            Coxa (cm)
            <input type="number" value={coxa} onChange={(e) => setCoxa(e.target.value)} style={styles.avalInput} />
          </label>
        </div>

        <div style={styles.cardLabel}>Objetivo</div>
        <div style={styles.chipRow}>
          {OBJETIVOS.map((o) => (
            <button
              key={o.id}
              className="chip"
              onClick={() => setObjetivo(o.id)}
              style={{ ...styles.chip, ...(objetivo === o.id ? styles.chipActive : {}) }}
            >
              {o.nome}
            </button>
          ))}
        </div>

        <div style={styles.cardLabel}>Biotipo (o que mais parece com você)</div>
        <div style={styles.chipRow}>
          {BIOTIPOS.map((b) => (
            <button
              key={b.id}
              className="chip"
              onClick={() => setBiotipo(b.id)}
              style={{ ...styles.chip, ...(biotipo === b.id ? styles.chipActive : {}) }}
              title={b.descricao}
            >
              {b.nome}
            </button>
          ))}
        </div>
        <div style={styles.biotipoDescricao}>{BIOTIPOS.find((b) => b.id === biotipo)?.descricao}</div>

        <div style={styles.cardLabel}>Nível de experiência</div>
        <div style={styles.chipRow}>
          {NIVEIS.map((n) => (
            <button
              key={n}
              className="chip"
              onClick={() => setNivel(n)}
              style={{ ...styles.chip, ...(nivel === n ? styles.chipActive : {}) }}
            >
              {n}
            </button>
          ))}
        </div>

        <button style={styles.saveButton} onClick={salvarAvaliacao} disabled={!peso || salvando}>
          {salvando ? "Salvando..." : "Salvar avaliação de hoje"}
        </button>
      </section>

      {ultima && (
        <section style={styles.card}>
          <div style={styles.cardLabel}>Sua evolução</div>
          {deltaPeso !== null && (
            <div style={styles.deltaPeso}>
              {deltaPeso === 0 ? "Peso estável desde a última avaliação" : deltaPeso > 0 ? `+${deltaPeso} kg desde a última avaliação` : `${deltaPeso} kg desde a última avaliação`}
            </div>
          )}
          {avaliacoes.length >= 2 && (
            <div style={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(43,42,40,0.1)" />
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: PENCIL }} />
                  <YAxis tick={{ fontSize: 11, fill: PENCIL }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="peso" stroke={MARGIN_RED} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div style={styles.historicoLista}>
            {[...avaliacoes].reverse().slice(0, 6).map((a) => (
              <div key={a.id} style={styles.historicoLinha}>
                <span>{a.data}</span>
                <span>{a.peso} kg</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={styles.card}>
        <div style={styles.cardLabel}>Diretriz pra você</div>
        <ul style={styles.dicasList}>
          {dicas.map((d, i) => (
            <li key={i} style={styles.dicasItem}>{d}</li>
          ))}
        </ul>

        {modeloRecomendado && (
          <div style={styles.recomendacaoBox}>
            <div style={styles.planNome}>Treino recomendado: {modeloRecomendado.nome}</div>
            <div style={styles.modeloDescricao}>{modeloRecomendado.descricao}</div>
            <button style={styles.planBtnDestaque} onClick={() => onAplicarTreino(modeloRecomendado.id, objetivo)}>
              Aplicar esse treino agora
            </button>
          </div>
        )}

        <p style={styles.modalDisclaimer}>
          Essa avaliação é uma referência prática, não substitui uma avaliação física profissional (educador físico ou nutricionista).
        </p>
      </section>
    </div>
  );
}


function PlanosModal({ isPremium, onAssinar, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose} aria-label="Fechar">×</button>
        <div style={styles.eyebrow}>CARTEIRINHA DE SÓCIO</div>
        <h2 style={styles.modalTitle}>Vire Premium</h2>
        <p style={styles.modalSubtitle}>O app continua aberto e livre pra todo mundo. O plano premium libera o essencial pra evoluir mais rápido:</p>

        <ul style={styles.benefitList}>
          {BENEFICIOS_PREMIUM.map((b) => (
            <li key={b} style={styles.benefitItem}>✓ {b}</li>
          ))}
        </ul>

        {isPremium ? (
          <div style={styles.jaPremium}>Você já é premium. Aproveita! 🎉</div>
        ) : (
          <div style={styles.planGrid}>
            {PLANOS.map((p) => (
              <div key={p.id} style={{ ...styles.planCard, ...(p.destaque ? styles.planCardDestaque : {}) }}>
                {p.economia && <div style={styles.planTag}>{p.economia}</div>}
                <div style={styles.planNome}>{p.nome}</div>
                <div style={styles.planPreco}>
                  {p.preco}<span style={styles.planPeriodo}>{p.periodo}</span>
                </div>
                {p.totalNota && <div style={styles.planTotalNota}>{p.totalNota}</div>}
                <button style={p.destaque ? styles.planBtnDestaque : styles.planBtn} onClick={() => onAssinar(p.id)}>
                  Assinar {p.nome.toLowerCase()}
                </button>
              </div>
            ))}
          </div>
        )}

        <p style={styles.modalDisclaimer}>
          Valores sugeridos, ajustáveis. Aqui é só a prévia do fluxo — a cobrança de verdade entra quando o app for publicado, via loja de apps ou checkout próprio.
        </p>
      </div>
    </div>
  );
}


function ExercicioModal({ exercicio, onClose, onIniciarDescanso }) {
  const guia = GUIA_EXECUCAO[exercicio.name];
  const videoUrl = getVideoUrl(exercicio);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose} aria-label="Fechar">×</button>
        <div style={styles.eyebrow}>COMO EXECUTAR</div>
        <h2 style={styles.modalTitle}>{exercicio.name}</h2>
        <div style={styles.modalMaquinaTag}>{exercicio.maquina}</div>

        {guia ? (
          <>
            {videoUrl && (
              <>
                <button
                  style={styles.videoLinkBtn}
                  onClick={() => window.open(videoUrl, "_blank", "noopener,noreferrer")}
                >
                  ▶ Ver vídeo curto ({exercicio.maquina.toLowerCase()})
                </button>
                <div style={styles.videoNote}>Vídeo de ~20-30s, específico dessa variação do exercício.</div>
              </>
            )}

            <button style={styles.timerLinkBtn} onClick={onIniciarDescanso}>
              ⏱ Iniciar descanso ({exercicio.descanso})
            </button>

            <div style={styles.resultTag}>{guia.grupoMuscular}</div>

            <div style={styles.resultSection}>
              <div style={styles.resultSectionTitle}>Passo a passo</div>
              <ol style={styles.resultListOrdered}>
                {guia.comoExecutar.map((passo, i) => (
                  <li key={i}>{passo}</li>
                ))}
              </ol>
            </div>

            <div style={styles.resultSection}>
              <div style={styles.resultSectionTitle}>Erros comuns</div>
              <ul style={styles.resultList}>
                {guia.errosComuns.map((erro, i) => (
                  <li key={i}>{erro}</li>
                ))}
              </ul>
            </div>

            <div style={styles.dicaBox}>💡 {guia.dica}</div>

            <div style={styles.modalExtraInfo}>
              Nesse dia: {ex_display(exercicio)}
            </div>
          </>
        ) : (
          <p style={styles.modalSubtitle}>Ainda não tenho o passo a passo desse exercício. Peça pra eu adicionar.</p>
        )}
      </div>
    </div>
  );
}

function ex_display(ex) {
  return `${ex.sets} séries de ${ex.reps} • descanso ${ex.descanso} • ${ex.maquina}`;
}

function CronometroDescanso({ cronometro, onPausarContinuar, onAjustar, onReiniciar, onFechar }) {
  const { totalSeg, restanteSeg, rodando, label } = cronometro;
  const acabou = restanteSeg <= 0;
  const progresso = totalSeg > 0 ? restanteSeg / totalSeg : 0;
  const raio = 90;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia * (1 - progresso);

  return (
    <div style={styles.cronoOverlay}>
      <button style={styles.cronoClose} onClick={onFechar} aria-label="Fechar cronômetro">×</button>
      <div style={styles.cronoLabel}>DESCANSO — {label.toUpperCase()}</div>

      <div style={styles.cronoRingWrap}>
        <svg viewBox="0 0 200 200" style={styles.cronoSvg}>
          <circle cx="100" cy="100" r={raio} fill="none" stroke="rgba(239,232,216,0.15)" strokeWidth="10" />
          <circle
            cx="100"
            cy="100"
            r={raio}
            fill="none"
            stroke={acabou ? "#D9A441" : "#B8433A"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div style={styles.cronoDigits}>{acabou ? "PRONTO!" : formatarMMSS(restanteSeg)}</div>
      </div>

      <div style={styles.cronoBtnRow}>
        <button style={styles.cronoAjusteBtn} onClick={() => onAjustar(-15)}>-15s</button>
        <button style={styles.cronoPrincipalBtn} onClick={onPausarContinuar}>
          {acabou ? "Concluído" : rodando ? "Pausar" : "Continuar"}
        </button>
        <button style={styles.cronoAjusteBtn} onClick={() => onAjustar(15)}>+15s</button>
      </div>

      <button style={styles.cronoReiniciarBtn} onClick={onReiniciar}>↺ Reiniciar</button>
    </div>
  );
}

function ModelosModal({ onEscolher, onClose }) {
  const [objetivo, setObjetivo] = useState(null);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose} aria-label="Fechar">×</button>
        <div style={styles.eyebrow}>MODELOS PRONTOS</div>
        <h2 style={styles.modalTitle}>Trocar a semana</h2>

        {!objetivo ? (
          <>
            <p style={styles.modalSubtitle}>Antes de tudo: qual é o seu objetivo agora?</p>
            <div style={styles.planGrid}>
              {OBJETIVOS.map((o) => (
                <button key={o.id} style={styles.objetivoCard} onClick={() => setObjetivo(o.id)}>
                  <div style={styles.planNome}>{o.nome}</div>
                  <div style={styles.modeloDescricao}>{o.descricao}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button style={styles.voltarObjetivoBtn} onClick={() => setObjetivo(null)}>
              ← Trocar objetivo
            </button>
            <p style={styles.modalSubtitle}>Escolha um modelo — os reps, descanso e cardio já vêm ajustados pro seu objetivo.</p>

            <div style={styles.planGrid}>
              {MODELOS_SEMANA.map((m) => (
                <div key={m.id} style={styles.planCard}>
                  <div style={styles.planNome}>{m.nome}</div>
                  <div style={styles.modeloDescricao}>{m.descricao}</div>
                  <button style={styles.planBtn} onClick={() => onEscolher(m.id, objetivo)}>
                    Usar esse modelo
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <p style={styles.modalDisclaimer}>Isso substitui a rotina atual da semana inteira. Exercícios trocados individualmente voltam ao padrão do modelo.</p>
      </div>
    </div>
  );
}

function HistoricoTab() {
  const [historico, setHistorico] = useState([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("historico-treinos");
        if (res && res.value) setHistorico(JSON.parse(res.value));
      } catch (e) {
        // sem histórico ainda
      } finally {
        setCarregado(true);
      }
    })();
  }, []);

  const removerRegistro = async (id) => {
    const nova = historico.filter((h) => h.id !== id);
    setHistorico(nova);
    try {
      await window.storage.set("historico-treinos", JSON.stringify(nova));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const totalTreinos = historico.length;
  const ultimos7dias = historico.filter((h) => {
    const dias = (Date.now() - new Date(h.data).getTime()) / 86400000;
    return dias <= 7;
  }).length;

  return (
    <div>
      <section style={styles.card}>
        <div style={styles.historicoResumoRow}>
          <div style={styles.historicoResumoItem}>
            <div style={styles.historicoResumoNumero}>{totalTreinos}</div>
            <div style={styles.historicoResumoLabel}>treinos no total</div>
          </div>
          <div style={styles.historicoResumoItem}>
            <div style={styles.historicoResumoNumero}>{ultimos7dias}</div>
            <div style={styles.historicoResumoLabel}>nos últimos 7 dias</div>
          </div>
        </div>
      </section>

      {carregado && historico.length === 0 && (
        <div style={styles.restNote}>
          Nenhum treino concluído ainda. Toque em "✓ Concluir treino de hoje" na aba Rotina depois de treinar.
        </div>
      )}

      <div style={styles.dayList}>
        {[...historico]
          .reverse()
          .map((h) => (
            <div key={h.id} style={styles.dayCard}>
              <div style={styles.dayCardBody}>
                <div style={styles.dayCardTop}>
                  <div>
                    <div style={styles.dayName}>{h.dia}</div>
                    <div style={styles.focoLabel}>{h.data}</div>
                  </div>
                  <div style={styles.focoTag}>{h.foco}</div>
                </div>
                <div style={styles.historicoDetalhe}>
                  {h.totalExercicios > 0 && <span>{h.totalExercicios} exercícios</span>}
                  {h.cardio && <span> • {h.cardio.tipo} ({h.cardio.duracao} min)</span>}
                </div>
                <button style={styles.removerHistoricoBtn} onClick={() => removerRegistro(h.id)}>
                  Remover registro
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function NotasTab() {
  const [notas, setNotas] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [itens, setItens] = useState([{ id: uid(), exercicio: "", carga: "" }]);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("notas-treino");
        if (res && res.value) setNotas(JSON.parse(res.value));
      } catch (e) {
        // sem notas ainda
      } finally {
        setCarregado(true);
      }
    })();
  }, []);

  const addItem = () => {
    setItens((prev) => [...prev, { id: uid(), exercicio: "", carga: "" }]);
  };

  const removerItem = (id) => {
    setItens((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const editarItem = (id, campo, valor) => {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  };

  const salvarNota = async () => {
    const itensPreenchidos = itens.filter((i) => i.exercicio || i.carga);
    if (!texto && itensPreenchidos.length === 0) return;
    const nova = {
      id: uid(),
      data: new Date().toISOString().slice(0, 10),
      itens: itensPreenchidos,
      texto: texto || null,
    };
    const novaLista = [...notas, nova];
    setNotas(novaLista);
    setItens([{ id: uid(), exercicio: "", carga: "" }]);
    setTexto("");
    try {
      await window.storage.set("notas-treino", JSON.stringify(novaLista));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const removerNota = async (id) => {
    const nova = notas.filter((n) => n.id !== id);
    setNotas(nova);
    try {
      await window.storage.set("notas-treino", JSON.stringify(nova));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  return (
    <div>
      <section style={styles.card}>
        <div style={styles.cardLabel}>Nova anotação</div>

        {itens.map((item, idx) => (
          <div key={item.id} style={styles.itemNotaRow}>
            <div style={styles.avalGrid}>
              <label style={styles.avalField}>
                Exercício {idx > 0 ? `#${idx + 1}` : "(opcional)"}
                <input
                  type="text"
                  value={item.exercicio}
                  onChange={(e) => editarItem(item.id, "exercicio", e.target.value)}
                  style={styles.avalInput}
                  placeholder="ex: Supino reto"
                />
              </label>
              <label style={styles.avalField}>
                Carga (opcional)
                <input
                  type="text"
                  value={item.carga}
                  onChange={(e) => editarItem(item.id, "carga", e.target.value)}
                  style={styles.avalInput}
                  placeholder="ex: 40kg"
                />
              </label>
            </div>
            {itens.length > 1 && (
              <button style={styles.removerItemBtn} onClick={() => removerItem(item.id)} aria-label="Remover exercício">
                × remover
              </button>
            )}
          </div>
        ))}

        <button style={styles.addItemBtn} onClick={addItem}>
          + adicionar outro exercício e carga
        </button>

        <label style={styles.avalField}>
          Anotação
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={styles.notaTextarea}
            placeholder="ex: consegui completar todas as séries sem dor no ombro"
            rows={3}
          />
        </label>
        <button style={styles.saveButton} onClick={salvarNota}>
          Salvar anotação
        </button>
      </section>

      {carregado && notas.length === 0 && <div style={styles.restNote}>Nenhuma anotação ainda.</div>}

      <div style={styles.dayList}>
        {[...notas].reverse().map((n) => (
          <div key={n.id} style={styles.dayCard}>
            <div style={styles.dayCardBody}>
              <div style={styles.dayCardTop}>
                <div style={styles.focoLabel}>{n.data}</div>
              </div>
              {n.itens && n.itens.length > 0 && (
                <div style={styles.itensNotaLista}>
                  {n.itens.map((it, i) => (
                    <div key={i} style={styles.itemNotaLinha}>
                      {it.exercicio && <span style={styles.dayName}>{it.exercicio}</span>}
                      {it.carga && <span style={styles.focoTag}>{it.carga}</span>}
                    </div>
                  ))}
                </div>
              )}
              {n.texto && <div style={styles.notaTexto}>{n.texto}</div>}
              <button style={styles.removerHistoricoBtn} onClick={() => removerNota(n.id)}>
                Remover anotação
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCard({ entry, onFoco, onAddExercicio, onRemoveExercicio, onEditExercicio, onEditCardio, onAbrirExercicio, onIniciarDescanso, onTrocarExercicio, onConcluirTreino }) {
  const { dia, foco, cardio, exercicios } = entry;
  const isDescanso = foco === "Descanso";
  const isCardio = foco === "Cardio";
  const podeAdicionar = !isDescanso && !isCardio && (LIBRARY[foco] || []).length > exercicios.length;

  return (
    <div style={styles.dayCard}>
      <div style={styles.dayCardBody}>
        <div style={styles.dayCardTop}>
          <div>
            <div style={styles.dayName}>{dia}</div>
            <div style={styles.focoLabel}>Trocar foco do dia:</div>
            <select value={foco} onChange={(e) => onFoco(e.target.value)} style={styles.select}>
              {FOCOS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.focoTag}>{foco}</div>
        </div>

        {isDescanso && <div style={styles.restNote}>Dia de descanso. O músculo cresce na recuperação, não pula essa parte.</div>}

        {isCardio && cardio && (
          <div style={styles.cardioBlock}>
            <label style={styles.fieldLabel}>
              Tipo
              <div style={styles.cardioTipoRow}>
                <select value={cardio.tipo} onChange={(e) => onEditCardio("tipo", e.target.value)} style={styles.selectSmall}>
                  {CARDIO_TIPOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  style={styles.trocarCardioBtn}
                  onClick={() => {
                    const idx = CARDIO_TIPOS.indexOf(cardio.tipo);
                    const proximo = CARDIO_TIPOS[(idx + 1) % CARDIO_TIPOS.length];
                    onEditCardio("tipo", proximo);
                  }}
                  aria-label="Trocar tipo de cardio"
                  title="Trocar cardio"
                >
                  🔄
                </button>
              </div>
            </label>
            <label style={styles.fieldLabel}>
              Duração (min)
              <input
                type="number"
                min={5}
                max={120}
                value={cardio.duracao}
                onChange={(e) => onEditCardio("duracao", Number(e.target.value))}
                style={styles.inputSmall}
              />
            </label>
            <label style={styles.fieldLabel}>
              Intensidade
              <select value={cardio.intensidade} onChange={(e) => onEditCardio("intensidade", e.target.value)} style={styles.selectSmall}>
                <option>Leve</option>
                <option>Moderada</option>
                <option>Intensa</option>
              </select>
            </label>
          </div>
        )}

        {!isDescanso && !isCardio && (
          <div>
            {exercicios.map((ex) => (
              <div key={ex.id} style={styles.exRow}>
                <div style={styles.exTopLine}>
                  <button
                    style={styles.exNameBtn}
                    onClick={() => onAbrirExercicio(ex)}
                    aria-label={`Ver como executar ${ex.name}`}
                  >
                    {ex.name} <span style={styles.exNameIcon}>ⓘ</span>
                  </button>
                  <button
                    style={styles.trocarBtn}
                    onClick={() => onTrocarExercicio(ex.id)}
                    aria-label={`Trocar ${ex.name} por outro exercício`}
                    title="Trocar exercício"
                  >
                    🔄 Trocar
                  </button>
                  <button onClick={() => onRemoveExercicio(ex.id)} style={styles.removeBtn} aria-label={`Remover ${ex.name}`}>
                    ×
                  </button>
                </div>

                {ex.maquinas.length > 1 ? (
                  <select
                    value={ex.maquina}
                    onChange={(e) => onEditExercicio(ex.id, "maquina", e.target.value)}
                    style={styles.machineSelect}
                  >
                    {ex.maquinas.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div style={styles.machineFixed}>{ex.maquinas[0]}</div>
                )}

                <div style={styles.exFieldsRow}>
                  <div style={styles.exFieldGroup}>
                    <input
                      type="number"
                      value={ex.sets}
                      min={1}
                      max={10}
                      onChange={(e) => onEditExercicio(ex.id, "sets", Number(e.target.value))}
                      style={styles.numMini}
                    />
                    <span style={styles.times}>×</span>
                    <input
                      type="text"
                      value={ex.reps}
                      onChange={(e) => onEditExercicio(ex.id, "reps", e.target.value)}
                      style={styles.repsMini}
                    />
                  </div>
                  <div style={styles.exFieldGroup}>
                    <span style={styles.restIcon}>⏱</span>
                    <select
                      value={ex.descanso}
                      onChange={(e) => onEditExercicio(ex.id, "descanso", e.target.value)}
                      style={styles.restSelect}
                    >
                      {DESCANSO_OPCOES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      style={styles.startTimerBtn}
                      onClick={() => onIniciarDescanso(ex.descanso, ex.name)}
                      aria-label={`Iniciar descanso de ${ex.name}`}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {exercicios.length === 0 && <div style={styles.restNote}>Nenhum exercício adicionado ainda.</div>}
            {podeAdicionar && (
              <button onClick={onAddExercicio} style={styles.addBtn}>
                + adicionar exercício de {foco.toLowerCase()}
              </button>
            )}
          </div>
        )}

        {!isDescanso && (
          <button style={styles.concluirBtn} onClick={onConcluirTreino}>
            ✓ Concluir treino de hoje
          </button>
        )}
      </div>
    </div>
  );
}

const INK = "#151A21";
const PAPER = "#F6F7F9";
const PAPER_ALT = "#EDEFF3";
const MARGIN_RED = "#1CA7E0";
const PENCIL = "#6B7280";
const HIGHLIGHT = "#7ED957";
const GRAPHITE = "#131A1D";

const monoFont = "'Helvetica Neue', Arial, sans-serif";
const sansFont = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const styles = {
  page: {
    minHeight: "100vh",
    background: PAPER,
    color: INK,
    fontFamily: sansFont,
    maxWidth: 520,
    margin: "0 auto",
    paddingBottom: 60,
  },
  content: { padding: "0 18px" },
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "34px 18px 30px",
    marginBottom: 20,
    background:
      "radial-gradient(120% 100% at 10% 0%, #1CA7E0 0%, transparent 55%), " +
      "radial-gradient(100% 90% at 90% 15%, #C6E24B 0%, transparent 45%), " +
      "radial-gradient(120% 100% at 50% 120%, #1FD1A6 0%, transparent 50%), " +
      `linear-gradient(180deg, ${GRAPHITE} 0%, #182226 100%)`,
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    backdropFilter: "blur(40px)",
    background: "rgba(18,21,26,0.28)",
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    objectFit: "contain",
    position: "relative",
    zIndex: 1,
  },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, position: "relative", zIndex: 1 },
  freeBadge: {
    fontFamily: monoFont,
    fontSize: 11,
    padding: "6px 12px",
    borderRadius: 20,
    border: `1px solid rgba(255,255,255,0.3)`,
    background: "rgba(255,255,255,0.06)",
    color: "#F1F2F4",
    cursor: "pointer",
    flexShrink: 0,
  },
  premiumBadge: {
    fontFamily: monoFont,
    fontSize: 11,
    padding: "6px 12px",
    borderRadius: 20,
    border: `1px solid ${HIGHLIGHT}`,
    background: "rgba(232,163,61,0.22)",
    color: HIGHLIGHT,
    cursor: "pointer",
    flexShrink: 0,
    fontWeight: 700,
  },
  eyebrow: {
    fontFamily: monoFont,
    fontSize: 12,
    letterSpacing: "0.12em",
    color: MARGIN_RED,
    fontWeight: 700,
    marginBottom: 6,
  },
  title: {
    fontFamily: monoFont,
    fontSize: 42,
    fontWeight: 800,
    margin: "0 0 8px",
    color: "#FFFFFF",
    letterSpacing: "-0.02em",
    position: "relative",
    zIndex: 1,
  },
  subtitle: { margin: 0, color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 1.4, maxWidth: 400, position: "relative", zIndex: 1 },
  card: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.15)`,
    borderRadius: 10,
    padding: "16px 16px 14px",
    marginBottom: 16,
  },
  cardLabel: { fontWeight: 600, fontSize: 14, marginBottom: 10, color: GRAPHITE },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: {
    fontFamily: monoFont,
    fontSize: 13,
    padding: "7px 12px",
    borderRadius: 20,
    border: `1px solid ${PENCIL}`,
    background: "transparent",
    color: INK,
    cursor: "pointer",
  },
  chipActive: { background: GRAPHITE, color: PAPER, borderColor: GRAPHITE },
  modelosBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: `1px dashed ${MARGIN_RED}`,
    background: "rgba(184,67,58,0.06)",
    color: MARGIN_RED,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
    marginBottom: 16,
  },
  modeloDescricao: { fontSize: 12.5, color: PENCIL, lineHeight: 1.4, marginBottom: 6 },
  objetivoCard: {
    textAlign: "left",
    border: `1px solid rgba(43,42,40,0.18)`,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#FFFFFF",
    cursor: "pointer",
  },
  voltarObjetivoBtn: {
    fontFamily: monoFont,
    fontSize: 12,
    color: PENCIL,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    marginBottom: 10,
  },
  restBanner: {
    fontSize: 12.5,
    color: GRAPHITE,
    background: "rgba(217,164,65,0.22)",
    border: `1px solid rgba(217,164,65,0.55)`,
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 18,
  },
  dayList: { display: "flex", flexDirection: "column", gap: 14 },
  dayCard: {
    display: "flex",
    background: "#FFFFFF",
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(18,21,26,0.06), 0 8px 24px -12px rgba(18,21,26,0.12)",
    overflow: "hidden",
  },
  dayCardBody: { flex: 1, padding: "18px 18px 20px" },
  dayCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  dayName: { fontFamily: monoFont, fontWeight: 800, fontSize: 16, color: GRAPHITE, marginBottom: 6, letterSpacing: "-0.01em" },
  focoLabel: { fontSize: 10.5, color: PENCIL, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" },
  focoTag: {
    fontFamily: monoFont,
    fontSize: 10.5,
    fontWeight: 700,
    color: MARGIN_RED,
    background: "rgba(225,38,59,0.08)",
    padding: "4px 10px",
    borderRadius: 20,
    marginTop: 4,
    whiteSpace: "nowrap",
  },
  select: {
    fontFamily: sansFont,
    fontSize: 14,
    padding: "5px 8px",
    borderRadius: 6,
    border: `1px solid ${PENCIL}`,
    background: PAPER,
    color: INK,
  },
  restNote: { color: PENCIL, fontSize: 13, fontStyle: "italic", padding: "6px 0" },
  cardioBlock: { display: "flex", flexDirection: "column", gap: 10, marginTop: 4 },
  fieldLabel: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: PENCIL, gap: 10 },
  selectSmall: { fontFamily: sansFont, fontSize: 13, padding: "5px 7px", borderRadius: 6, border: `1px solid ${PENCIL}`, background: PAPER, color: INK, flex: "0 0 auto" },
  cardioTipoRow: { display: "flex", alignItems: "center", gap: 6 },
  trocarCardioBtn: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "none",
    background: "rgba(217,164,65,0.22)",
    fontSize: 11,
    cursor: "pointer",
    lineHeight: 1,
    flexShrink: 0,
  },
  inputSmall: { fontFamily: sansFont, fontSize: 13, padding: "5px 7px", borderRadius: 6, border: `1px solid ${PENCIL}`, background: PAPER, color: INK, width: 64 },
  exRow: { padding: "10px 0", borderBottom: "1px solid rgba(43,42,40,0.10)" },
  exTopLine: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 },
  exName: { fontSize: 13.5, fontWeight: 600, color: INK, flex: 1, lineHeight: 1.3 },
  exNameBtn: {
    fontSize: 13.5,
    fontWeight: 600,
    color: INK,
    flex: 1,
    lineHeight: 1.3,
    background: "transparent",
    border: "none",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
  },
  exNameIcon: { color: MARGIN_RED, fontSize: 12 },
  modalExtraInfo: { fontSize: 12.5, color: PENCIL, marginTop: 4, borderTop: "1px solid rgba(43,42,40,0.12)", paddingTop: 12 },
  videoLinkBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: MARGIN_RED,
    color: PAPER,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
    marginBottom: 6,
  },
  videoNote: { fontSize: 11.5, color: PENCIL, textAlign: "center", marginBottom: 14, fontStyle: "italic" },
  videoLinkBtnSecundario: {
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: `1px solid ${MARGIN_RED}`,
    background: "transparent",
    color: MARGIN_RED,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    marginTop: 10,
  },
  timerLinkBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: `2px solid ${GRAPHITE}`,
    background: "transparent",
    color: GRAPHITE,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
    marginBottom: 16,
  },
  machineSelect: {
    fontFamily: sansFont,
    fontSize: 12.5,
    padding: "4px 6px",
    borderRadius: 5,
    border: `1px solid rgba(43,42,40,0.2)`,
    background: PAPER,
    color: PENCIL,
    width: "100%",
    marginBottom: 6,
  },
  machineFixed: { fontSize: 12.5, color: PENCIL, marginBottom: 6, fontStyle: "italic" },
  exFieldsRow: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  exFieldGroup: { display: "flex", alignItems: "center", gap: 4 },
  numMini: { width: 34, fontSize: 13, padding: "4px", borderRadius: 5, border: `1px solid ${PENCIL}`, textAlign: "center" },
  times: { color: PENCIL, fontSize: 13 },
  repsMini: { width: 56, fontSize: 13, padding: "4px", borderRadius: 5, border: `1px solid ${PENCIL}`, textAlign: "center" },
  restIcon: { fontSize: 13, color: MARGIN_RED },
  restSelect: { fontSize: 12.5, padding: "4px 5px", borderRadius: 5, border: `1px solid ${PENCIL}`, background: PAPER, color: INK },
  startTimerBtn: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "none",
    background: GRAPHITE,
    color: HIGHLIGHT,
    fontSize: 10,
    cursor: "pointer",
    flexShrink: 0,
    lineHeight: 1,
  },

  cronoOverlay: {
    position: "fixed",
    inset: 0,
    background: GRAPHITE,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 24,
  },
  cronoClose: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: `1px solid rgba(239,232,216,0.4)`,
    background: "transparent",
    color: PAPER,
    fontSize: 22,
    cursor: "pointer",
  },
  cronoLabel: {
    fontFamily: monoFont,
    fontSize: 14,
    letterSpacing: "0.12em",
    color: HIGHLIGHT,
    fontWeight: 700,
    marginBottom: 28,
    textAlign: "center",
  },
  cronoRingWrap: { position: "relative", width: "min(80vw, 300px)", height: "min(80vw, 300px)" },
  cronoSvg: { width: "100%", height: "100%" },
  cronoDigits: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: monoFont,
    fontSize: "clamp(40px, 12vw, 56px)",
    fontWeight: 700,
    color: PAPER,
  },
  cronoBtnRow: { display: "flex", alignItems: "center", gap: 16, marginTop: 32 },
  cronoAjusteBtn: {
    fontFamily: monoFont,
    fontSize: 14,
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid rgba(239,232,216,0.35)`,
    background: "transparent",
    color: PAPER,
    cursor: "pointer",
  },
  cronoPrincipalBtn: {
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: 700,
    padding: "14px 28px",
    borderRadius: 10,
    border: "none",
    background: HIGHLIGHT,
    color: GRAPHITE,
    cursor: "pointer",
  },
  cronoReiniciarBtn: {
    marginTop: 20,
    fontFamily: monoFont,
    fontSize: 12.5,
    color: PENCIL,
    background: "transparent",
    border: "none",
    cursor: "pointer",
  },
  trocarBtn: {
    padding: "4px 8px",
    borderRadius: 20,
    border: "none",
    background: "rgba(217,164,65,0.22)",
    color: "#8A5E12",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1.4,
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  removeBtn: { width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(184,67,58,0.12)", color: MARGIN_RED, fontSize: 15, cursor: "pointer", lineHeight: 1, flexShrink: 0 },
  addBtn: {
    fontFamily: monoFont,
    fontSize: 12.5,
    marginTop: 8,
    padding: "7px 10px",
    borderRadius: 6,
    border: `1px dashed ${PENCIL}`,
    background: "transparent",
    color: GRAPHITE,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  },
  saveButton: {
    marginTop: 24,
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: GRAPHITE,
    color: HIGHLIGHT,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.03em",
    cursor: "pointer",
  },
  loadingNote: { textAlign: "center", color: PENCIL, fontSize: 12, marginTop: 10 },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(31,30,28,0.55)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 50,
    padding: 0,
  },
  modalCard: {
    background: PAPER,
    width: "100%",
    maxWidth: 520,
    maxHeight: "88vh",
    overflowY: "auto",
    borderRadius: "18px 18px 0 0",
    padding: "22px 20px 28px",
    position: "relative",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.2)",
  },
  modalClose: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: `1px solid ${PENCIL}`,
    background: "transparent",
    color: INK,
    fontSize: 18,
    cursor: "pointer",
    lineHeight: 1,
  },
  modalTitle: { fontFamily: monoFont, fontSize: 26, fontWeight: 700, color: GRAPHITE, margin: "4px 0 8px" },
  modalMaquinaTag: { fontSize: 12.5, color: PENCIL, marginBottom: 14, fontStyle: "italic" },
  modalSubtitle: { color: PENCIL, fontSize: 14, lineHeight: 1.45, margin: "0 0 14px", maxWidth: 420 },
  benefitList: { listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 },
  benefitItem: { fontSize: 14, color: INK },
  jaPremium: { fontSize: 15, fontWeight: 600, color: "#8A5E12", background: "rgba(217,164,65,0.18)", padding: "12px 14px", borderRadius: 10, textAlign: "center" },
  planGrid: { display: "flex", flexDirection: "column", gap: 12 },
  planCard: {
    border: `1px solid rgba(43,42,40,0.18)`,
    borderRadius: 12,
    padding: "14px 16px",
    background: "#FFFFFF",
    position: "relative",
  },
  planCardDestaque: { border: `2px solid ${MARGIN_RED}`, background: "#FDF6EF" },
  planTag: {
    position: "absolute",
    top: -10,
    right: 14,
    fontFamily: monoFont,
    fontSize: 10.5,
    fontWeight: 700,
    color: PAPER,
    background: MARGIN_RED,
    padding: "3px 8px",
    borderRadius: 10,
  },
  planNome: { fontFamily: monoFont, fontSize: 13, color: PENCIL, marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" },
  planPreco: { fontSize: 24, fontWeight: 700, color: GRAPHITE, marginBottom: 2 },
  planPeriodo: { fontSize: 13, fontWeight: 400, color: PENCIL, marginLeft: 3 },
  planTotalNota: { fontSize: 12, color: PENCIL, marginBottom: 10 },
  planBtn: {
    marginTop: 10,
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    border: `1px solid ${GRAPHITE}`,
    background: "transparent",
    color: GRAPHITE,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  planBtnDestaque: {
    marginTop: 10,
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    border: "none",
    background: GRAPHITE,
    color: HIGHLIGHT,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  modalDisclaimer: { fontSize: 11.5, color: PENCIL, marginTop: 18, lineHeight: 1.4, fontStyle: "italic" },

  tabRow: { display: "flex", gap: 6, marginBottom: 18, background: PAPER_ALT, borderRadius: 10, padding: 4 },
  tabBtn: {
    flex: 1,
    fontFamily: monoFont,
    fontSize: 12.5,
    padding: "9px 6px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: PENCIL,
    cursor: "pointer",
    fontWeight: 600,
  },
  tabBtnActive: { background: GRAPHITE, color: PAPER },

  premiumNote: {
    fontSize: 12.5,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.18)",
    border: `1px solid rgba(217,164,65,0.5)`,
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 14,
  },
  uploadBtn: {
    display: "inline-block",
    fontFamily: monoFont,
    fontSize: 13,
    padding: "10px 16px",
    borderRadius: 8,
    border: `1px dashed ${PENCIL}`,
    color: GRAPHITE,
    cursor: "pointer",
    textAlign: "center",
  },
  previewWrap: { marginTop: 12, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(43,42,40,0.15)" },
  previewImg: { width: "100%", display: "block", maxHeight: 260, objectFit: "cover" },
  analisarBtn: {
    marginTop: 12,
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: GRAPHITE,
    color: HIGHLIGHT,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  erroNote: { marginTop: 10, fontSize: 13, color: MARGIN_RED },
  resultCard: {
    display: "flex",
    background: "#FFFFFF",
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(18,21,26,0.06), 0 8px 24px -12px rgba(18,21,26,0.12)",
    overflow: "hidden",
    marginTop: 16,
  },
  resultNome: { fontFamily: monoFont, fontWeight: 800, fontSize: 19, color: GRAPHITE, marginBottom: 6, letterSpacing: "-0.01em" },
  resultTag: {
    display: "inline-block",
    fontSize: 11.5,
    fontFamily: monoFont,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.18)",
    padding: "3px 9px",
    borderRadius: 12,
    marginBottom: 14,
  },
  resultSection: { marginBottom: 14 },
  resultSectionTitle: { fontWeight: 700, fontSize: 13, color: GRAPHITE, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" },
  resultList: { margin: 0, paddingLeft: 18, fontSize: 13.5, color: INK, lineHeight: 1.6 },
  resultListOrdered: { margin: 0, paddingLeft: 18, fontSize: 13.5, color: INK, lineHeight: 1.6 },
  dicaBox: {
    fontSize: 13.5,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.18)",
    padding: "10px 12px",
    borderRadius: 8,
    marginTop: 4,
  },

  avalGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  avalField: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PENCIL },
  avalInput: {
    fontFamily: sansFont,
    fontSize: 14,
    padding: "8px 9px",
    borderRadius: 7,
    border: `1px solid ${PENCIL}`,
    background: PAPER,
    color: INK,
  },
  biotipoDescricao: { fontSize: 12, color: PENCIL, fontStyle: "italic", marginBottom: 16, marginTop: -6 },
  deltaPeso: {
    fontSize: 13,
    fontWeight: 700,
    color: MARGIN_RED,
    marginBottom: 10,
  },
  chartWrap: { marginBottom: 12 },
  historicoLista: { display: "flex", flexDirection: "column", gap: 4 },
  historicoLinha: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12.5,
    color: INK,
    padding: "5px 0",
    borderBottom: "1px solid rgba(43,42,40,0.08)",
  },
  dicasList: { margin: "0 0 16px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 },
  dicasItem: { fontSize: 13.5, color: INK, lineHeight: 1.5 },
  recomendacaoBox: {
    background: "rgba(217,164,65,0.14)",
    border: `1px solid rgba(217,164,65,0.5)`,
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 12,
  },

  concluirBtn: {
    width: "100%",
    marginTop: 14,
    padding: "11px",
    borderRadius: 10,
    border: "none",
    background: "rgba(232,163,61,0.16)",
    color: "#8A5E12",
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
  },
  historicoResumoRow: { display: "flex", gap: 20 },
  historicoResumoItem: { flex: 1, textAlign: "center" },
  historicoResumoNumero: { fontFamily: monoFont, fontWeight: 800, fontSize: 28, color: MARGIN_RED },
  historicoResumoLabel: { fontSize: 11.5, color: PENCIL, marginTop: 2 },
  historicoDetalhe: { fontSize: 12.5, color: PENCIL, marginTop: 8, marginBottom: 10 },
  removerHistoricoBtn: {
    fontFamily: monoFont,
    fontSize: 11,
    color: PENCIL,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  itemNotaRow: { marginBottom: 6, paddingBottom: 10, borderBottom: "1px solid rgba(21,26,33,0.08)" },
  removerItemBtn: {
    fontFamily: monoFont,
    fontSize: 11,
    color: MARGIN_RED,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    marginTop: -4,
    marginBottom: 4,
  },
  addItemBtn: {
    fontFamily: monoFont,
    fontSize: 12.5,
    padding: "9px 10px",
    borderRadius: 8,
    border: `1px dashed ${PENCIL}`,
    background: "transparent",
    color: GRAPHITE,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    marginBottom: 16,
  },
  itensNotaLista: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 },
  itemNotaLinha: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  notaTextarea: {
    fontFamily: sansFont,
    fontSize: 14,
    padding: "9px 10px",
    borderRadius: 8,
    border: `1px solid ${PENCIL}`,
    background: PAPER,
    color: INK,
    resize: "vertical",
    marginBottom: 14,
  },
  notaTexto: { fontSize: 13.5, color: INK, lineHeight: 1.5, margin: "6px 0 10px" },
};
