import React, { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

// ---------------------------------------------------------------
// Compatibilidade: window.storage só existe dentro do ambiente do
// Claude. Fora dele (ex: app publicado na Vercel), esse polyfill
// usa o localStorage do próprio navegador pra guardar os dados.
// ---------------------------------------------------------------
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const value = window.localStorage.getItem(key);
      if (value === null) throw new Error("chave não encontrada: " + key);
      return { key, value };
    },
    async set(key, value) {
      window.localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      window.localStorage.removeItem(key);
      return { key, deleted: true };
    },
    async list(prefix) {
      const keys = Object.keys(window.localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys };
    },
  };
}

// ---------------------------------------------------------------
// Múltiplos perfis: envolve o window.storage acima pra guardar os
// dados de cada perfil separados por prefixo, de forma transparente
// pro resto do código (que continua chamando window.storage.get/set
// normalmente, sem saber que existem perfis).
// ---------------------------------------------------------------
if (typeof window !== "undefined" && !window.storage.__comPerfis) {
  const storageBase = window.storage;
  const CHAVES_GLOBAIS_PERFIL = new Set(["perfis-lista", "perfil-ativo-id", "tema-app"]);
  const CHAVES_PARA_MIGRAR = [
    "rotina-treino",
    "historico-treinos",
    "avaliacoes-evolucao",
    "notas-treino",
    "status-premium",
    "dores-exercicios",
    "progressao-exercicios",
    "fotos-progresso",
    "onboarding-perfil",
  ];

  let prontoPromise = null;

  async function garantirPerfilPronto() {
    if (prontoPromise) return prontoPromise;
    prontoPromise = (async () => {
      let listaRes = null;
      try {
        listaRes = await storageBase.get("perfis-lista");
      } catch (e) {
        // ainda não existe — primeira vez usando perfis
      }
      if (!listaRes || !listaRes.value) {
        const perfilPadrao = { id: "perfil-1", nome: "Eu" };
        for (const chave of CHAVES_PARA_MIGRAR) {
          try {
            const antigo = await storageBase.get(chave);
            if (antigo && antigo.value !== undefined) {
              await storageBase.set(`${perfilPadrao.id}::${chave}`, antigo.value);
            }
          } catch (e) {
            // essa chave não tinha dado salvo, segue
          }
        }
        await storageBase.set("perfis-lista", JSON.stringify([perfilPadrao]));
        await storageBase.set("perfil-ativo-id", perfilPadrao.id);
        return perfilPadrao.id;
      }
      try {
        const ativoRes = await storageBase.get("perfil-ativo-id");
        if (ativoRes && ativoRes.value) return ativoRes.value;
      } catch (e) {
        // sem perfil ativo definido, cai no padrão abaixo
      }
      const lista = JSON.parse(listaRes.value);
      return lista[0] ? lista[0].id : "perfil-1";
    })();
    return prontoPromise;
  }

  window.storage = {
    __comPerfis: true,
    async get(key) {
      if (CHAVES_GLOBAIS_PERFIL.has(key)) return storageBase.get(key);
      const perfilId = await garantirPerfilPronto();
      return storageBase.get(`${perfilId}::${key}`);
    },
    async set(key, value) {
      if (CHAVES_GLOBAIS_PERFIL.has(key)) return storageBase.set(key, value);
      const perfilId = await garantirPerfilPronto();
      return storageBase.set(`${perfilId}::${key}`, value);
    },
    async delete(key) {
      if (CHAVES_GLOBAIS_PERFIL.has(key)) return storageBase.delete(key);
      const perfilId = await garantirPerfilPronto();
      return storageBase.delete(`${perfilId}::${key}`);
    },
    async list(prefix) {
      return storageBase.list(prefix);
    },
  };
}


// ---------- Biblioteca de exercícios (base para iniciantes) ----------
// cada exercício traz opções de máquina/equipamento alternativas
const LIBRARY = {
  Peito: [
    { name: "Supino reto", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Halteres", "Máquina smith", "Máquina de supino (chest press)"], regiao: "medial" },
    { name: "Supino inclinado", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra livre", "Máquina smith", "Máquina"], regiao: "superior" },
    { name: "Supino declinado", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Halteres", "Máquina"], regiao: "inferior" },
    { name: "Crossover / peck deck", sets: 3, reps: "12-15", maquinas: ["Cabo (crossover)", "Peck deck (voador)", "Cabo (crossover) - parte inferior", "Cabo (crossover) - parte superior", "Cabo (crossover) - inclinado"], regiao: "medial" },
    { name: "Crucifixo", sets: 3, reps: "12-15", maquinas: ["Halteres", "Máquina (peck deck)", "Cabo (unilateral, em pé)"], regiao: "medial" },
    { name: "Pullover", sets: 3, reps: "12-15", maquinas: ["Halteres", "Máquina"], regiao: "superior" },
    { name: "Paralelas (mergulho)", sets: 3, reps: "8-12", maquinas: ["Peso corporal"], regiao: "inferior" },
    { name: "Flexão de braço", sets: 3, reps: "até a falha", maquinas: ["Peso corporal", "Peso corporal (apoio no joelho)", "Peso corporal (inclinado)"], regiao: "medial" },
  ],
  Costas: [
    { name: "Puxada frontal", sets: 3, reps: "10-12", maquinas: ["Pulley (puxada alta)", "Pulldown (pegada aberta)", "Máquina (puxada alta)", "Máquina (puxada frente)", "Graviton (assistida)"] },
    { name: "Puxada frontal triângulo", sets: 3, reps: "10-12", maquinas: ["Pulley (pegada triângulo)"] },
    { name: "Remada baixa", sets: 3, reps: "10-12", maquinas: ["Cabo (remada baixa)", "Máquina de remada", "Máquina (pegada supinada)", "Cabo (unilateral)"] },
    { name: "Remada curvada", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra livre", "Barra (pronada)", "Halteres (supinada)"] },
    { name: "Remada unilateral (serrote)", sets: 3, reps: "10-12", maquinas: ["Halteres", "Máquina"] },
    { name: "Puxada supinada", sets: 3, reps: "10-12", maquinas: ["Pulley (pegada supinada)"] },
    { name: "Remada cavalinho", sets: 3, reps: "10-12", maquinas: ["Barra", "Cabo"] },
    { name: "Face pull", sets: 3, reps: "12-15", maquinas: ["Cabo"] },
    { name: "Encolhimento (trapézio)", sets: 3, reps: "12-15", maquinas: ["Halteres", "Barra", "Polia"] },
    { name: "Barra fixa", sets: 3, reps: "até a falha", maquinas: ["Peso corporal", "Peso corporal (com elástico assistido)"] },
  ],
  Perna: [
    { name: "Leg press", sets: 3, reps: "12-15", maquinas: ["Leg press 45°", "Leg press horizontal"] },
    { name: "Cadeira extensora", sets: 3, reps: "12-15", maquinas: ["Cadeira extensora"] },
    { name: "Mesa/cadeira flexora", sets: 3, reps: "12-15", maquinas: ["Mesa flexora", "Cadeira flexora"] },
    { name: "Agachamento", sets: 3, reps: "15", maquinas: ["Peso corporal", "Barra livre", "Máquina smith"] },
    { name: "Agachamento afundo (lunge)", sets: 3, reps: "10-12 cada perna", maquinas: ["Peso corporal"] },
    { name: "Agachamento búlgaro", sets: 3, reps: "10-12 cada perna", maquinas: ["Halteres", "Peso corporal"] },
    { name: "Agachamento sumô", sets: 3, reps: "12-15", maquinas: ["Halteres", "Barra livre"] },
    { name: "Agachamento hack (hack squat)", sets: 3, reps: "12-15", maquinas: ["Máquina hack squat"] },
    { name: "Agachamento articulado (hack invertido)", sets: 3, reps: "12-15", maquinas: ["Máquina"] },
    { name: "Agachamento pêndulo", sets: 3, reps: "12-15", maquinas: ["Máquina"] },
    { name: "Stiff (levantamento terra romeno)", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra"] },
    { name: "Levantamento terra", sets: 3, reps: "8-10", maquinas: ["Barra (sumô)", "Barra (convencional)"] },
    { name: "Elevação pélvica (hip thrust)", sets: 3, reps: "12-15", maquinas: ["Barra livre", "Máquina smith", "Peso corporal", "Máquina"] },
    { name: "Cadeira adutora", sets: 3, reps: "15-20", maquinas: ["Máquina", "Cabo (polia baixa)"] },
    { name: "Cadeira abdutora", sets: 3, reps: "15-20", maquinas: ["Máquina", "Máquina (inclinada)", "Cabo (polia baixa)"] },
    { name: "Glúteo no cabo (coice)", sets: 3, reps: "12-15 cada perna", maquinas: ["Cabo (perna flexionada)"] },
    { name: "Coice (glúteo) na máquina", sets: 3, reps: "12-15", maquinas: ["Máquina"] },
    { name: "Panturrilha em pé", sets: 3, reps: "15-20", maquinas: ["Máquina de panturrilha", "Halteres"] },
    { name: "Panturrilha sentado", sets: 3, reps: "15-20", maquinas: ["Máquina de panturrilha sentado", "Halteres"] },
  ],
  Ombro: [
    { name: "Desenvolvimento", sets: 3, reps: "10-12", maquinas: ["Halteres", "Máquina de desenvolvimento", "Barra livre", "Máquina smith", "Halteres (Arnold press)"] },
    { name: "Elevação lateral", sets: 3, reps: "12-15", maquinas: ["Halteres", "Cabo (polia baixa)", "Máquina (sentado)", "Cabo (unilateral, inclinado)", "Halteres (sentado)", "Halteres (deitado banco 45°)"] },
    { name: "Elevação frontal", sets: 3, reps: "12-15", maquinas: ["Halteres", "Barra", "Cabo", "Corda (polia)", "Halteres (sentado, com rotação)", "Cabo (unilateral)"] },
    { name: "Remada alta", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Cabo"] },
    { name: "Voador invertido (deltoide posterior)", sets: 3, reps: "12-15", maquinas: ["Halteres", "Peck deck invertido", "Cabo"] },
  ],
  Braço: [
    { name: "Rosca bíceps", sets: 3, reps: "10-12", maquinas: ["Barra reta", "Barra W", "Halteres", "Polia baixa", "Polia baixa (unilateral)", "Polia alta (unilateral)"] },
    { name: "Rosca alternada", sets: 3, reps: "10-12", maquinas: ["Halteres"] },
    { name: "Rosca martelo", sets: 3, reps: "10-12", maquinas: ["Halteres", "Corda (polia)"] },
    { name: "Rosca no banco Scott", sets: 3, reps: "10-12", maquinas: ["Barra W", "Halteres", "Máquina Scott", "Halteres (unilateral)"] },
    { name: "Rosca no banco inclinado", sets: 3, reps: "10-12", maquinas: ["Halteres", "Halteres (alternada)"] },
    { name: "Rosca concentrada", sets: 3, reps: "10-12", maquinas: ["Halteres"] },
    { name: "Rosca invertida (pegada pronada)", sets: 3, reps: "10-12", maquinas: ["Halteres", "Polia"] },
    { name: "Flexão de punho", sets: 3, reps: "15-20", maquinas: ["Barra"] },
    { name: "Tríceps corda", sets: 3, reps: "10-12", maquinas: ["Pulley (corda)", "Pulley (barra reta)", "Pulley (barra W)"] },
    { name: "Tríceps francês", sets: 3, reps: "10-12", maquinas: ["Halteres (sentado)", "Corda (polia baixa)", "Barra W"] },
    { name: "Tríceps testa", sets: 3, reps: "10-12", maquinas: ["Barra W", "Halteres", "Polia baixa", "Corda (polia alta)"] },
    { name: "Tríceps coice (kickback)", sets: 3, reps: "12-15", maquinas: ["Halteres", "Cabo (polia)"] },
    { name: "Tríceps no banco (mergulho)", sets: 3, reps: "10-15", maquinas: ["Peso corporal (banco)", "Máquina"] },
  ],
  Abdômen: [
    { name: "Abdominal máquina", sets: 3, reps: "15-20", maquinas: ["Máquina"] },
    { name: "Abdominal na paralela", sets: 3, reps: "10-15", maquinas: ["Peso corporal (paralelas)"] },
    { name: "Elevação de pernas (infra)", sets: 3, reps: "12-15", maquinas: ["Suspenso/paralela", "Solo/banco"] },
    { name: "Prancha", sets: 3, reps: "30-40s", maquinas: ["Peso corporal"] },
    { name: "Abdominal bicicleta", sets: 3, reps: "15-20", maquinas: ["Peso corporal"] },
    { name: "Abdominal na polia (cable crunch)", sets: 3, reps: "15-20", maquinas: ["Cabo"] },
    { name: "Abdominal no chão", sets: 3, reps: "15-20", maquinas: ["Peso corporal"] },
  ],
  "Corpo inteiro": [
    { name: "Agachamento", sets: 3, reps: "12", maquinas: ["Peso corporal", "Barra livre", "Máquina smith"] },
    { name: "Supino reto", sets: 3, reps: "10-12", maquinas: ["Barra livre", "Halteres", "Máquina smith"] },
    { name: "Remada baixa", sets: 3, reps: "10-12", maquinas: ["Cabo (remada baixa)", "Máquina de remada"] },
    { name: "Desenvolvimento", sets: 3, reps: "10-12", maquinas: ["Halteres", "Barra livre"] },
    { name: "Prancha abdominal", sets: 3, reps: "30-40s", maquinas: ["Peso corporal"] },
  ],
  Funcional: [
    { name: "Agachamento na cadeira (sentar e levantar)", sets: 2, reps: "8-12", maquinas: ["Peso corporal", "Cadeira"] },
    { name: "Elevação de perna sentado", sets: 2, reps: "10-15 cada perna", maquinas: ["Peso corporal", "Cadeira"] },
    { name: "Marcha estacionária", sets: 2, reps: "30-45s", maquinas: ["Peso corporal"] },
    { name: "Elevação de braço com faixa elástica", sets: 2, reps: "10-15", maquinas: ["Faixa elástica"] },
    { name: "Ponte de glúteo (deitado)", sets: 2, reps: "10-15", maquinas: ["Peso corporal"] },
    { name: "Ponte de glúteo (sentado)", sets: 2, reps: "10-15", maquinas: ["Peso corporal"] },
    { name: "Rotação de tronco sentado", sets: 2, reps: "10-12 cada lado", maquinas: ["Peso corporal", "Cadeira"] },
    { name: "Funcional livre (escolha no canal)", sets: 2, reps: "conforme o vídeo escolhido", maquinas: ["Canal Women 3D Workouts"] },
  ],
};

// ---------- Grupos derivados, usados pela composição automática dos treinos ----------
// (agonista principal + sinergista + estabilizador, conforme as regras de montagem)
const TRICEPS_POOL = LIBRARY.Braço.filter((e) => e.name.startsWith("Tríceps"));
const BICEPS_POOL = LIBRARY.Braço.filter((e) => e.name.startsWith("Rosca"));
const OMBRO_POSTERIOR_POOL = LIBRARY.Ombro.filter((e) => e.name.includes("posterior"));
const OMBRO_PRINCIPAL_POOL = LIBRARY.Ombro.filter((e) => !e.name.includes("posterior"));
// perna completa: cobre quadríceps, posterior de coxa, glúteo e panturrilha
const PERNA_COMPLETA_POOL = [
  LIBRARY.Perna.find((e) => e.name === "Leg press"),
  LIBRARY.Perna.find((e) => e.name === "Cadeira extensora"),
  LIBRARY.Perna.find((e) => e.name === "Mesa/cadeira flexora"),
  LIBRARY.Perna.find((e) => e.name === "Stiff (levantamento terra romeno)"),
  LIBRARY.Perna.find((e) => e.name === "Elevação pélvica (hip thrust)"),
  LIBRARY.Perna.find((e) => e.name === "Panturrilha em pé"),
].filter(Boolean);

LIBRARY.Superior = [
  ...LIBRARY.Peito.slice(0, 2),
  ...LIBRARY.Costas.slice(0, 2),
  ...OMBRO_PRINCIPAL_POOL.slice(0, 1),
  ...TRICEPS_POOL.slice(0, 1),
  ...BICEPS_POOL.slice(0, 1),
];

// índice plano: nome do exercício -> objeto do exercício (usado pra trocar por uma alternativa)
const LIBRARY_INDEX = {};
Object.values(LIBRARY).forEach((lista) => {
  lista.forEach((ex) => {
    if (!LIBRARY_INDEX[ex.name]) LIBRARY_INDEX[ex.name] = ex;
  });
});

const FOCOS = ["Peito", "Costas", "Perna", "Ombro", "Braço", "Abdômen", "Corpo inteiro", "Funcional", "Superior", "Cardio", "Descanso"];
const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_ABREV = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const CARDIO_TIPOS = ["Esteira", "Bicicleta", "Elíptico", "Corrida ao ar livre", "Pular corda", "Escada"];

// Vídeo curto de execução por tipo de cardio — mesmo esquema dos exercícios.
// Preencha aqui os links (formato "https://www.youtube.com/shorts/ID") conforme forem enviados.
const VIDEOS_CARDIO = {
  "Esteira": "https://www.youtube.com/shorts/VBMqOiiIZAA",
  "Bicicleta": "https://www.youtube.com/shorts/eZPSwRImpfY",
  "Elíptico": "https://www.youtube.com/shorts/wF9uAXm3p70",
  "Corrida ao ar livre": "https://www.youtube.com/shorts/vkxFmxz_GWY",
  "Pular corda": "https://www.youtube.com/shorts/VHgbIIJGBtU",
  "Escada": "https://www.youtube.com/shorts/gpSVC7Y5RIY",
};

function getVideoCardioUrl(tipo) {
  const url = VIDEOS_CARDIO[tipo];
  if (url) return url;
  // sem vídeo específico cadastrado ainda: cai numa busca do YouTube pela forma correta
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(tipo + " forma correta como fazer")}`;
}

function getThumbnailCardio(tipo) {
  const url = VIDEOS_CARDIO[tipo];
  if (!url) return null;
  const match = url.match(/(?:shorts\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  const id = match && match[1];
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}
const DESCANSO_OPCOES = ["1 min", "1:30 min", "2 min", "2:30 min", "3 min", "3:30 min", "4 min", "4:30 min", "5 min"];
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
    descricao: "Peito (com tríceps e ombro), Costas (com bíceps e posterior de ombro) e Perna completa, com cardio no meio.",
    focos: ["Peito", "Costas", "Cardio", "Perna", "Descanso", "Descanso", "Descanso"],
  },
  {
    id: "ab",
    nome: "Divisão AB (2x)",
    descricao: "Alterna Perna completa e Superior (peito, costas, ombro e braço no mesmo dia), 2x cada por semana.",
    focos: ["Perna", "Superior", "Descanso", "Perna", "Superior", "Descanso", "Descanso"],
  },
  {
    id: "upperlower",
    nome: "Upper / Lower (4x)",
    descricao: "Alterna parte superior e inferior do corpo, 4 dias por semana.",
    focos: ["Peito", "Perna", "Costas", "Perna", "Descanso", "Descanso", "Descanso"],
  },
  {
    id: "abcd",
    nome: "Divisão ABCD",
    descricao: "Peito com tríceps, Costas com bíceps, Ombro sozinho completo, Perna completa — um grupo por dia.",
    focos: ["Peito", "Costas", "Ombro", "Perna", "Descanso", "Descanso", "Descanso"],
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
    preco: "R$ 24,90",
    periodo: "/mês",
    economia: null,
  },
  {
    id: "semestral",
    nome: "Semestral",
    preco: "R$ 17,90",
    periodo: "/mês",
    totalNota: "R$ 107,40 a cada 6 meses",
    economia: "Economize 28%",
  },
  {
    id: "anual",
    nome: "Anual",
    preco: "R$ 12,90",
    periodo: "/mês",
    totalNota: "R$ 154,80 por ano",
    economia: "Economize 48%",
    destaque: true,
  },
];

const CONQUISTAS = [
  { id: "t5", label: "5 treinos", tipo: "total", valor: 5, emoji: "🥉" },
  { id: "t10", label: "10 treinos", tipo: "total", valor: 10, emoji: "🥈" },
  { id: "t25", label: "25 treinos", tipo: "total", valor: 25, emoji: "🥇" },
  { id: "t50", label: "50 treinos", tipo: "total", valor: 50, emoji: "🏆" },
  { id: "t100", label: "100 treinos", tipo: "total", valor: 100, emoji: "👑" },
  { id: "s7", label: "7 dias seguidos", tipo: "streak", valor: 7, emoji: "🔥" },
  { id: "s30", label: "30 dias seguidos", tipo: "streak", valor: 30, emoji: "💎" },
];

const BENEFICIOS_PREMIUM = [
  "Rotinas e histórico ilimitados",
  "Sugestões de progressão de carga",
];

// Vídeos curtos (shorts), um específico por combinação de exercício + equipamento escolhido
const VIDEOS_EXERCICIO = {
  "Supino reto": {
    "Barra livre": "https://www.youtube.com/shorts/_WI8KhXfrJI",
    "Halteres": "https://www.youtube.com/shorts/NIzt_fAXL2w",
    "Máquina de supino (chest press)": "https://www.youtube.com/shorts/HNaDJTSrI8s",
  },
  "Supino inclinado": {
    "Halteres": "https://www.youtube.com/shorts/TCpq9yFXea4",
    "Barra livre": "https://www.youtube.com/shorts/XSiWdufUFQ8",
    "Máquina smith": "https://www.youtube.com/shorts/r39cVRTjFU8",
    "Máquina": "https://www.youtube.com/shorts/KK5ZSj22h7s",
  },
  "Crossover / peck deck": {
    "Cabo (crossover)": "https://www.youtube.com/shorts/PlBLZLbe7DY",
    "Cabo (crossover) - parte inferior": "https://www.youtube.com/shorts/LY90W4TS18c",
    "Cabo (crossover) - parte superior": "https://www.youtube.com/shorts/Od9914tc8sg",
    "Cabo (crossover) - inclinado": "https://www.youtube.com/shorts/AX6QUGLnhpQ",
  },
  "Flexão de braço": {
    "Peso corporal": "https://www.youtube.com/shorts/SovA8L60l6A",
    "Peso corporal (apoio no joelho)": "https://www.youtube.com/shorts/QJ7cqXaAp8w",
    "Peso corporal (inclinado)": "https://www.youtube.com/shorts/yMjNpLqQ8Wk",
  },
  "Puxada frontal": {
    "Pulley (puxada alta)": "https://www.youtube.com/shorts/gUfVYr5AaYE",
    "Pulldown (pegada aberta)": "https://www.youtube.com/shorts/B4E5mDSWyKc",
    "Máquina (puxada alta)": "https://www.youtube.com/shorts/jIuOQRw577s",
    "Máquina (puxada frente)": "https://www.youtube.com/shorts/bly0tu3YM-E",
    "Graviton (assistida)": "https://www.youtube.com/shorts/l9URfqutMnk",
  },
  "Remada baixa": {
    "Cabo (remada baixa)": "https://www.youtube.com/shorts/b5I0YVK3U-g",
    "Máquina (pegada supinada)": "https://www.youtube.com/shorts/8EoXjJreuUk",
    "Cabo (unilateral)": "https://www.youtube.com/shorts/LpQMEygJfNY",
  },
  "Remada curvada": {
    "Halteres": "https://www.youtube.com/shorts/r6fkfU_wnVI",
    "Barra (pronada)": "https://www.youtube.com/shorts/e53vSzibkO0",
    "Halteres (supinada)": "https://www.youtube.com/shorts/EPsW8xZ27FI",
  },
  "Leg press": {
    "Leg press 45°": "https://www.youtube.com/shorts/is4vRMSIkjw",
    "Leg press horizontal": "https://www.youtube.com/shorts/F8m05d2upOA",
  },
  "Puxada supinada": {
    "Pulley (pegada supinada)": "https://www.youtube.com/shorts/b5RkrNs_EGM",
  },
  "Cadeira extensora": {
    "Cadeira extensora": "https://www.youtube.com/shorts/hqH5eYJAn4g",
  },
  "Mesa/cadeira flexora": {
    "Mesa flexora": "https://www.youtube.com/shorts/oHdWhQBV79U",
    "Cadeira flexora": "https://www.youtube.com/shorts/T46yKiz8laY",
  },
  "Agachamento": {
    "Barra livre": "https://www.youtube.com/shorts/rq5y8zHeWjM",
    "Máquina smith": "https://www.youtube.com/shorts/U4BMdqPBVLs",
  },
  "Panturrilha em pé": {
    "Máquina de panturrilha": "https://www.youtube.com/shorts/o1CyKLbUPAM",
    "Halteres": "https://www.youtube.com/shorts/fVGkOlkOrnA",
  },
  "Desenvolvimento": {
    "Halteres": "https://www.youtube.com/shorts/5I7ogOjvdnc",
    "Máquina de desenvolvimento": "https://www.youtube.com/shorts/uh0oZorifmM",
    "Barra livre": "https://www.youtube.com/shorts/930c6LGuO6Q",
    "Máquina smith": "https://www.youtube.com/shorts/hejuwn4kffM",
    "Halteres (Arnold press)": "https://www.youtube.com/shorts/VOyrlpBHjuQ",
  },
  "Elevação lateral": {
    "Halteres": "https://www.youtube.com/shorts/ot9nwSC1JnA",
    "Máquina (sentado)": "https://www.youtube.com/shorts/-vzaGAaUDjg",
    "Cabo (unilateral, inclinado)": "https://www.youtube.com/shorts/dgpts8LHOLc",
    "Halteres (sentado)": "https://www.youtube.com/shorts/YbqbspnFnfo",
    "Halteres (deitado banco 45°)": "https://www.youtube.com/shorts/2a4yANFdNys",
  },
  "Elevação frontal": {
    "Halteres": "https://www.youtube.com/shorts/nPYUWLDKl2k",
    "Corda (polia)": "https://www.youtube.com/shorts/7jIaWstlQSI",
    "Halteres (sentado, com rotação)": "https://www.youtube.com/shorts/igVfogfTwHY",
    "Cabo (unilateral)": "https://www.youtube.com/shorts/t7r-yljzlws",
  },
  "Remada alta": {
    "Barra livre": "https://www.youtube.com/shorts/emPow6X_a_E",
  },
  "Rosca bíceps": {
    "Barra reta": "https://www.youtube.com/shorts/dc330H9yN3Y",
    "Halteres": "https://www.youtube.com/shorts/MfsDC0ymFm8",
    "Polia baixa": "https://www.youtube.com/shorts/x6JCKfdzPJE",
    "Polia alta (unilateral)": "https://www.youtube.com/shorts/ZTzF54mFEgI",
    "Polia baixa (unilateral)": "https://www.youtube.com/shorts/ckoG5M9bkZI",
  },
  "Rosca alternada": {
    "Halteres": "https://www.youtube.com/shorts/WUrn8iFf1js",
  },
  "Tríceps corda": {
    "Pulley (corda)": "https://www.youtube.com/shorts/jPl9_JHGxA8",
    "Pulley (barra reta)": "https://www.youtube.com/shorts/M88Bt4MMpkI",
  },
  "Tríceps testa": {
    "Halteres": "https://www.youtube.com/shorts/Cd0-tP9utgM",
    "Polia baixa": "https://www.youtube.com/shorts/PfK51UcnHW0",
    "Corda (polia alta)": "https://www.youtube.com/shorts/etTuALjH3bo",
  },
  "Supino declinado": {
    "Barra livre": "https://www.youtube.com/shorts/v79c-eDjBv8",
    "Halteres": "https://www.youtube.com/shorts/JByJ3hwyRVE",
    "Máquina": "https://www.youtube.com/shorts/0I5WPRsU5TY",
  },
  "Crucifixo": {
    "Máquina (peck deck)": "https://www.youtube.com/shorts/b3EzlAHSM3E",
    "Halteres": "https://www.youtube.com/shorts/cxpTP_WaENw",
    "Cabo (unilateral, em pé)": "https://www.youtube.com/shorts/TyTYjz6dMMs",
  },
  "Pullover": {
    "Halteres": "https://www.youtube.com/shorts/vKCQHaG0Rj0",
    "Máquina": "https://www.youtube.com/shorts/k7tRf_d3WKI",
  },
  "Remada unilateral (serrote)": {
    "Halteres": "https://www.youtube.com/shorts/Ub8-llUEf6c",
    "Máquina": "https://www.youtube.com/shorts/C2U7EB3G3bk",
  },
  "Remada cavalinho": {
    "Barra": "https://www.youtube.com/shorts/Y52OkGQXVCU",
    "Cabo": "https://www.youtube.com/shorts/6NBBrNhX3kA",
  },
  "Puxada frontal triângulo": {
    "Pulley (pegada triângulo)": "https://www.youtube.com/shorts/ySLFHxmJ_Sc",
  },
  "Face pull": {
    "Cabo": "https://www.youtube.com/shorts/wwBcRZgNTkk",
  },
  "Voador invertido (deltoide posterior)": {
    "Halteres": "https://www.youtube.com/shorts/uaBsmPlVyVo",
    "Peck deck invertido": "https://www.youtube.com/shorts/wUT3hmnzq3c",
    "Cabo": "https://www.youtube.com/shorts/VxGLc_ZL_04",
  },
  "Encolhimento (trapézio)": {
    "Halteres": "https://www.youtube.com/shorts/6WQuOJ6DSLU",
    "Barra": "https://www.youtube.com/shorts/9lb8UiMeYrQ",
    "Polia": "https://www.youtube.com/shorts/cQWT11R22Qw",
  },
  "Abdominal máquina": {
    "Máquina": "https://www.youtube.com/shorts/uAe1Uj3Y05k",
  },
  "Abdominal na paralela": {
    "Peso corporal (paralelas)": "https://www.youtube.com/shorts/vmqDIz3dVK4",
  },
  "Elevação de pernas (infra)": {
    "Suspenso/paralela": "https://www.youtube.com/shorts/In0EzoOAILw",
    "Solo/banco": "https://www.youtube.com/shorts/MC5hF4JDLm4",
  },
  "Prancha": {
    "Peso corporal": "https://www.youtube.com/shorts/uxPlAbWFUDs",
  },
  "Abdominal bicicleta": {
    "Peso corporal": "https://www.youtube.com/shorts/OnQNhK0Ekgk",
  },
  "Paralelas (mergulho)": {
    "Peso corporal": "https://www.youtube.com/shorts/qvmH-TpRLBE",
  },
  "Abdominal na polia (cable crunch)": {
    "Cabo": "https://www.youtube.com/shorts/48fdqLhDZy0",
  },
  "Agachamento afundo (lunge)": {
    "Peso corporal": "https://www.youtube.com/shorts/upW_2Tt8-_w",
  },
  "Agachamento hack (hack squat)": {
    "Máquina hack squat": "https://www.youtube.com/shorts/5CJ0Ss--BpY",
  },
  "Stiff (levantamento terra romeno)": {
    "Halteres": "https://www.youtube.com/shorts/SRVkwwXk7I4",
    "Barra": "https://www.youtube.com/shorts/raMtPJQ5f9A",
  },
  "Cadeira adutora": {
    "Máquina": "https://www.youtube.com/shorts/TB4BwvHaK9o",
    "Cabo (polia baixa)": "https://www.youtube.com/shorts/MlzuZq3yC8I",
  },
  "Cadeira abdutora": {
    "Máquina": "https://www.youtube.com/shorts/nabhYLtz8Gg",
    "Máquina (inclinada)": "https://www.youtube.com/shorts/CblCvLRAPB8",
    "Cabo (polia baixa)": "https://www.youtube.com/shorts/1P-k8s2gmGQ",
  },
  "Glúteo no cabo (coice)": {
    "Cabo (perna flexionada)": "https://www.youtube.com/shorts/XqQlpJhB8xU",
  },
  "Levantamento terra": {
    "Barra (sumô)": "https://www.youtube.com/shorts/m6IIorkQe8E",
    "Barra (convencional)": "https://www.youtube.com/shorts/DjsLHZ4jxTU",
  },
  "Agachamento sumô": {
    "Halteres": "https://www.youtube.com/shorts/Jo1DFefVdrg",
  },
  "Elevação pélvica (hip thrust)": {
    "Máquina": "https://www.youtube.com/shorts/Nuoo1XgRtGY",
  },
  "Agachamento búlgaro": {
    "Halteres": "https://www.youtube.com/shorts/cCTC06-Yjqk",
  },
  "Panturrilha sentado": {
    "Máquina de panturrilha sentado": "https://www.youtube.com/shorts/9fIw0ue8iQE",
  },
  "Coice (glúteo) na máquina": {
    "Máquina": "https://www.youtube.com/shorts/A555PryCZ3g",
  },
  "Rosca martelo": {
    "Halteres": "https://www.youtube.com/shorts/0rRpv6o140o",
    "Corda (polia)": "https://www.youtube.com/shorts/EdsGRhdAye0",
  },
  "Rosca no banco Scott": {
    "Máquina Scott": "https://www.youtube.com/shorts/90_d-DsrOkE",
    "Barra W": "https://www.youtube.com/shorts/QkNciumGy14",
    "Halteres (unilateral)": "https://www.youtube.com/shorts/qhRLio6bCRo",
    "Halteres": "https://www.youtube.com/shorts/qkrVKiAadNk",
  },
  "Rosca no banco inclinado": {
    "Halteres": "https://www.youtube.com/shorts/a1NPJFmCJ5o",
    "Halteres (alternada)": "https://www.youtube.com/shorts/N1niow42B5I",
  },
  "Rosca concentrada": {
    "Halteres": "https://www.youtube.com/shorts/c0vYYI_mbXU",
  },
  "Tríceps francês": {
    "Halteres (sentado)": "https://www.youtube.com/shorts/_dtPoiFWZT4",
    "Corda (polia baixa)": "https://www.youtube.com/shorts/dMYGgTbtRIQ",
    "Barra W": "https://www.youtube.com/shorts/_laUZhzeLNc",
  },
  "Tríceps coice (kickback)": {
    "Halteres": "https://www.youtube.com/shorts/IkB040VfrVI",
    "Cabo (polia)": "https://www.youtube.com/shorts/7Gdbq0aq3SA",
  },
  "Tríceps no banco (mergulho)": {
    "Peso corporal (banco)": "https://www.youtube.com/shorts/z_T5hn0fqCE",
    "Máquina": "https://www.youtube.com/shorts/y6_x2qf2VWQ",
  },
  "Rosca invertida (pegada pronada)": {
    "Halteres": "https://www.youtube.com/shorts/nuCsXf93-1A",
    "Polia": "https://www.youtube.com/shorts/-2IqzqP3j1Q",
  },
  "Flexão de punho": {
    "Barra": "https://www.youtube.com/shorts/QvebRmLyEBQ",
  },
  "Agachamento articulado (hack invertido)": {
    "Máquina": "https://www.youtube.com/shorts/j4WcueuCAvU",
  },
  "Agachamento pêndulo": {
    "Máquina": "https://www.youtube.com/shorts/8Ux4MZUvPLo",
  },
  "Barra fixa": {
    "Peso corporal": "https://www.youtube.com/shorts/pdf7tRrVNYc",
    "Peso corporal (com elástico assistido)": "https://www.youtube.com/shorts/JjWJGwbLJ8s",
  },
  "Abdominal no chão": {
    "Peso corporal": "https://www.youtube.com/shorts/bQBDgKEmRN0",
  },
  "Prancha abdominal": {
    "Peso corporal": "https://www.youtube.com/shorts/uxPlAbWFUDs",
  },
  "Agachamento na cadeira (sentar e levantar)": {
    "Cadeira": "https://www.youtube.com/shorts/3uZE_E11eg4",
  },
  "Elevação de perna sentado": {
    "Cadeira": "https://www.youtube.com/shorts/UzyBeMHCN0w",
  },
  "Marcha estacionária": {
    "Peso corporal": "https://www.youtube.com/shorts/yhSQGianV68",
  },
  "Rotação de tronco sentado": {
    "Cadeira": "https://www.youtube.com/shorts/X1GGfsKtD5I",
  },
  "Elevação de braço com faixa elástica": {
    "Faixa elástica": "https://www.youtube.com/shorts/WrsLEE6shGE",
  },
  "Ponte de glúteo (sentado)": {
    "Peso corporal": "https://www.youtube.com/shorts/swTwr189Z08",
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

// Capa (thumbnail) do vídeo cadastrado pro exercício/aparelho atual, extraída do próprio link do YouTube
function getThumbnailExercicio(exercicio) {
  const url = getVideoUrl(exercicio);
  if (!url) return null;
  const match = url.match(/(?:shorts\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  const id = match && match[1];
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

// Exercícios da categoria Funcional: quando não há vídeo específico cadastrado,
// a pessoa é direcionada aos vídeos do canal (em vez de uma busca genérica).
const NOMES_FUNCIONAL = new Set(LIBRARY.Funcional.map((e) => e.name));
const CANAL_FUNCIONAL_URL = "https://www.youtube.com/@Women-3D-Workouts/videos";

function getVideoOuCanalUrl(exercicio) {
  const videoEspecifico = getVideoUrl(exercicio);
  if (videoEspecifico) return { url: videoEspecifico, especifico: true };
  if (NOMES_FUNCIONAL.has(exercicio.name)) {
    return { url: CANAL_FUNCIONAL_URL, especifico: false, canal: true };
  }
  return {
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(exercicio.name + " execução correta")}`,
    especifico: false,
    canal: false,
  };
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
  "Supino declinado": {
    grupoMuscular: "Peito inferior, tríceps",
    comoExecutar: [
      "Deite no banco declinado com os pés presos no apoio",
      "Segure a barra/halteres na altura do peito inferior",
      "Desça controlado até quase tocar o peito",
      "Empurre para cima em linha reta",
    ],
    errosComuns: ["Descer rápido demais sem controle", "Usar amplitude curta"],
    dica: "Foca mais na parte inferior do peito do que o supino reto.",
  },
  "Pullover": {
    grupoMuscular: "Peito, costas (grande dorsal), serrátil",
    comoExecutar: [
      "Deite perpendicular ao banco, só os ombros apoiados",
      "Segure o peso com os dois braços acima do peito",
      "Desça o peso atrás da cabeça mantendo leve flexão no cotovelo",
      "Traga de volta contraindo o peito/costas",
    ],
    errosComuns: ["Descer demais e forçar o ombro", "Dobrar muito o cotovelo (vira mais tríceps)"],
    dica: "Mantenha o abdômen contraído pra proteger a lombar durante a descida.",
  },
  "Paralelas (mergulho)": {
    grupoMuscular: "Peito inferior, tríceps, ombro",
    comoExecutar: [
      "Apoie-se nas barras paralelas com os braços estendidos",
      "Incline levemente o tronco à frente pra focar no peito",
      "Desça até sentir alongamento no peito/ombro",
      "Empurre de volta até estender os braços",
    ],
    errosComuns: ["Descer demais e forçar o ombro", "Manter o tronco ereto demais (vira mais tríceps que peito)"],
    dica: "Quanto mais inclinado à frente, mais foco no peito; mais ereto, mais foco no tríceps.",
  },
  "Remada cavalinho": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Posicione a barra no canto/suporte com um lado fixo",
      "Segure a ponta livre com as duas mãos (ou pegador em V)",
      "Puxe a barra em direção ao abdômen",
      "Volte controlado até quase estender os braços",
    ],
    errosComuns: ["Usar impulso do corpo pra puxar", "Curvar demais as costas"],
    dica: "Mantenha o peito aberto e leve o cotovelo pra trás, não pra cima.",
  },
  "Face pull": {
    grupoMuscular: "Deltoide posterior, trapézio, rotadores do ombro",
    comoExecutar: [
      "Ajuste a polia na altura do rosto/pescoço",
      "Segure a corda com as duas mãos",
      "Puxe em direção ao rosto abrindo os cotovelos",
      "Volte controlado até quase estender os braços",
    ],
    errosComuns: ["Puxar baixo demais (vira mais costas que ombro)", "Usar peso alto e perder a forma"],
    dica: "Ótimo pra saúde do ombro — priorize controle, não carga.",
  },
  "Encolhimento (trapézio)": {
    grupoMuscular: "Trapézio",
    comoExecutar: [
      "Segure o peso (halteres/barra) ao lado ou à frente do corpo",
      "Eleve os ombros em direção às orelhas",
      "Segure 1 segundo no topo",
      "Desça controlado",
    ],
    errosComuns: ["Rodar os ombros (aumenta risco de lesão)", "Usar impulso das pernas"],
    dica: "O movimento é só de subir e descer os ombros, sem girar.",
  },
  "Barra fixa": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Segure a barra com pegada um pouco mais aberta que os ombros",
      "Puxe o corpo para cima até o queixo passar da barra",
      "Desça controlado até os braços quase estenderem",
      "Evite balançar o corpo",
    ],
    errosComuns: ["Usar impulso/balanço", "Amplitude curta (não descer totalmente)"],
    dica: "Se ainda não consegue completar sozinho, use elástico de assistência ou a versão assistida na máquina.",
  },
  "Agachamento afundo (lunge)": {
    grupoMuscular: "Quadríceps, glúteo",
    comoExecutar: [
      "Dê um passo à frente",
      "Desça até o joelho de trás quase tocar o chão",
      "Mantenha o tronco ereto",
      "Empurre de volta à posição inicial",
    ],
    errosComuns: ["Deixar o joelho da frente passar muito da ponta do pé", "Perder o equilíbrio por dar um passo curto demais"],
    dica: "Mantenha o peso mais no calcanhar da perna da frente.",
  },
  "Agachamento articulado (hack invertido)": {
    grupoMuscular: "Quadríceps, glúteo",
    comoExecutar: [
      "Posicione-se no aparelho com as costas apoiadas",
      "Pés na largura dos ombros na plataforma",
      "Desça controlado flexionando o joelho",
      "Empurre de volta sem travar o joelho no topo",
    ],
    errosComuns: ["Descer rápido demais", "Tirar o calcanhar da plataforma"],
    dica: "Ajuste a posição dos pés mais alta ou baixa pra focar mais em glúteo ou quadríceps.",
  },
  "Agachamento pêndulo": {
    grupoMuscular: "Quadríceps, glúteo",
    comoExecutar: [
      "Posicione-se no aparelho com o encosto nas costas",
      "Desça controlado seguindo o trajeto do aparelho",
      "Mantenha os joelhos alinhados com os pés",
      "Empurre de volta até quase estender o joelho",
    ],
    errosComuns: ["Usar amplitude curta", "Deixar o joelho cair pra dentro"],
    dica: "O trajeto em arco do aparelho protege bastante a lombar — bom pra quem sente dor nas costas no agachamento livre.",
  },
  "Stiff (levantamento terra romeno)": {
    grupoMuscular: "Posterior de coxa, glúteo, lombar",
    comoExecutar: [
      "Segure o peso à frente do corpo, joelhos levemente flexionados",
      "Desça o peso deslizando perto das pernas, quadril pra trás",
      "Desça até sentir alongar o posterior da coxa",
      "Suba contraindo o glúteo",
    ],
    errosComuns: ["Curvar as costas", "Dobrar demais o joelho (vira mais agachamento)"],
    dica: "O movimento vem do quadril, não da coluna — mantenha as costas retas o tempo todo.",
  },
  "Levantamento terra": {
    grupoMuscular: "Posterior de coxa, glúteo, lombar, costas",
    comoExecutar: [
      "Posicione a barra perto das canelas, pés na largura do quadril",
      "Segure a barra, quadril pra baixo, costas retas",
      "Suba estendendo quadril e joelho ao mesmo tempo",
      "Desça controlado retornando a barra ao chão",
    ],
    errosComuns: ["Curvar a lombar", "Deixar a barra se afastar do corpo durante o movimento"],
    dica: "Mantenha a barra sempre próxima às pernas durante toda a subida e descida.",
  },
  "Cadeira adutora": {
    grupoMuscular: "Adutores (parte interna da coxa)",
    comoExecutar: [
      "Sente-se no aparelho com as pernas nas almofadas",
      "Feche as pernas contra a resistência",
      "Volte controlado até o alongamento máximo confortável",
      "Repita sem usar impulso",
    ],
    errosComuns: ["Usar amplitude exagerada que force a articulação", "Movimento rápido demais"],
    dica: "Foque em sentir a parte interna da coxa trabalhando, não force a amplitude.",
  },
  "Cadeira abdutora": {
    grupoMuscular: "Glúteo médio, abdutores",
    comoExecutar: [
      "Sente-se no aparelho com as pernas nas almofadas",
      "Abra as pernas contra a resistência",
      "Volte controlado",
      "Mantenha o tronco estável durante o movimento",
    ],
    errosComuns: ["Usar impulso do tronco", "Amplitude curta"],
    dica: "Ótimo pra fortalecer o glúteo médio e estabilizar o quadril.",
  },
  "Glúteo no cabo (coice)": {
    grupoMuscular: "Glúteo",
    comoExecutar: [
      "Prenda o cabo no tornozelo",
      "Apoie-se no aparelho/parede",
      "Empurre a perna pra trás contraindo o glúteo",
      "Volte controlado sem deixar o peso bater",
    ],
    errosComuns: ["Usar as costas pra dar impulso", "Amplitude exagerada que tira o foco do glúteo"],
    dica: "Segure 1 segundo no ponto de contração máxima do glúteo.",
  },
  "Coice (glúteo) na máquina": {
    grupoMuscular: "Glúteo",
    comoExecutar: [
      "Posicione-se no aparelho conforme as instruções",
      "Empurre a plataforma/apoio pra trás contraindo o glúteo",
      "Segure a contração no topo",
      "Volte controlado",
    ],
    errosComuns: ["Usar a lombar pra empurrar", "Movimento rápido sem controle"],
    dica: "Foque em empurrar com o calcanhar, não com a ponta do pé.",
  },
  "Rosca concentrada": {
    grupoMuscular: "Bíceps",
    comoExecutar: [
      "Sente-se e apoie o cotovelo na parte interna da coxa",
      "Segure o halter com o braço estendido",
      "Flexione o cotovelo trazendo o peso até o ombro",
      "Desça controlado",
    ],
    errosComuns: ["Balançar o corpo pra ajudar", "Não estender totalmente o braço na descida"],
    dica: "É um exercício de isolamento — priorize a conexão mente-músculo com carga leve/moderada.",
  },
  "Rosca invertida (pegada pronada)": {
    grupoMuscular: "Antebraço, bíceps braquial",
    comoExecutar: [
      "Segure a barra/halter com as palmas voltadas pra baixo",
      "Flexione o cotovelo mantendo o braço junto ao corpo",
      "Suba controlado",
      "Desça sem estender totalmente com força",
    ],
    errosComuns: ["Usar peso muito alto (a pegada pronada é naturalmente mais fraca)", "Balançar o corpo"],
    dica: "Ótimo pra fortalecer o antebraço, mas use cargas bem mais leves que a rosca normal.",
  },
  "Flexão de punho": {
    grupoMuscular: "Antebraço",
    comoExecutar: [
      "Apoie o antebraço numa superfície com o punho pra fora",
      "Segure a barra/halter e flexione o punho pra cima",
      "Desça controlado até o alongamento",
      "Repita sem mover o antebraço",
    ],
    errosComuns: ["Mover o cotovelo/antebraço junto (deve ficar só o punho se movendo)", "Usar peso alto demais"],
    dica: "Movimento pequeno e controlado — a amplitude é curta por natureza.",
  },
  "Tríceps francês": {
    grupoMuscular: "Tríceps",
    comoExecutar: [
      "Segure o peso acima da cabeça (sentado ou em pé)",
      "Desça o peso atrás da cabeça flexionando só o cotovelo",
      "Mantenha os cotovelos apontando pra frente/cima, sem abrir",
      "Estenda de volta contraindo o tríceps",
    ],
    errosComuns: ["Abrir os cotovelos durante o movimento", "Usar o ombro pra ajudar"],
    dica: "Mantenha os cotovelos fixos e próximos à cabeça o tempo todo.",
  },
  "Tríceps no banco (mergulho)": {
    grupoMuscular: "Tríceps, ombro",
    comoExecutar: [
      "Apoie as mãos no banco atrás do corpo, pernas estendidas ou flexionadas",
      "Desça o corpo flexionando os cotovelos",
      "Desça até sentir alongar o tríceps/ombro",
      "Empurre de volta até quase estender os braços",
    ],
    errosComuns: ["Descer demais e forçar o ombro", "Deixar os cotovelos abrirem pros lados"],
    dica: "Quanto mais esticadas as pernas, mais difícil o exercício.",
  },
  "Abdominal máquina": {
    grupoMuscular: "Abdômen (reto abdominal)",
    comoExecutar: [
      "Sente-se no aparelho e ajuste o apoio",
      "Flexione o tronco contraindo o abdômen",
      "Segure a contração no topo",
      "Volte controlado sem soltar o peso",
    ],
    errosComuns: ["Puxar com os braços em vez de contrair o abdômen", "Movimento rápido demais"],
    dica: "Pense em 'encolher' o abdômen, não só dobrar o tronco.",
  },
  "Abdominal na paralela": {
    grupoMuscular: "Abdômen, flexores do quadril",
    comoExecutar: [
      "Apoie os antebraços nas paralelas/apoio",
      "Eleve os joelhos em direção ao peito contraindo o abdômen",
      "Desça controlado sem balançar",
      "Evite usar impulso do corpo",
    ],
    errosComuns: ["Balançar o corpo pra ganhar impulso", "Amplitude curta"],
    dica: "Controle a descida — é onde o abdômen trabalha mais.",
  },
  "Elevação de pernas (infra)": {
    grupoMuscular: "Abdômen inferior",
    comoExecutar: [
      "Deite ou suspenda-se conforme a variação",
      "Eleve as pernas estendidas ou flexionadas em direção ao tronco",
      "Segure a contração no topo",
      "Desça controlado sem deixar as pernas baterem",
    ],
    errosComuns: ["Usar impulso das pernas em vez do abdômen", "Arquear a lombar durante a descida"],
    dica: "Se sentir na lombar em vez do abdômen, flexione mais os joelhos pra reduzir a alavanca.",
  },
  "Prancha": {
    grupoMuscular: "Abdômen, core, lombar",
    comoExecutar: [
      "Apoie os antebraços e as pontas dos pés no chão",
      "Mantenha o corpo alinhado da cabeça aos pés",
      "Contraia o abdômen e o glúteo",
      "Segure a posição pelo tempo determinado",
    ],
    errosComuns: ["Deixar o quadril cair ou subir demais", "Prender a respiração"],
    dica: "Respire normalmente durante o exercício — não prenda o ar.",
  },
  "Abdominal bicicleta": {
    grupoMuscular: "Abdômen, oblíquos",
    comoExecutar: [
      "Deite com as mãos atrás da cabeça",
      "Leve o cotovelo em direção ao joelho oposto, alternando",
      "Estenda a perna oposta enquanto gira o tronco",
      "Mantenha o movimento controlado, sem puxar o pescoço",
    ],
    errosComuns: ["Puxar a cabeça com as mãos", "Movimento rápido demais sem controle"],
    dica: "Foque em girar o tronco, não só mover os braços.",
  },
  "Abdominal na polia (cable crunch)": {
    grupoMuscular: "Abdômen",
    comoExecutar: [
      "Ajoelhe-se de frente pra polia alta segurando a corda",
      "Flexione o tronco pra baixo contraindo o abdômen",
      "Mantenha o quadril parado, o movimento é só do tronco",
      "Volte controlado",
    ],
    errosComuns: ["Mover o quadril pra trás em vez de flexionar o tronco", "Usar os braços pra puxar"],
    dica: "Imagine que está 'enrolando' a coluna, vértebra por vértebra.",
  },
  "Abdominal no chão": {
    grupoMuscular: "Abdômen",
    comoExecutar: [
      "Deite com os joelhos flexionados e pés no chão",
      "Flexione o tronco em direção aos joelhos",
      "Contraia o abdômen no topo do movimento",
      "Desça controlado",
    ],
    errosComuns: ["Puxar o pescoço com as mãos", "Levantar o tronco todo (vira mais quadril que abdômen)"],
    dica: "Suba só até as escápulas saírem do chão — não precisa sentar completamente.",
  },
  "Agachamento búlgaro": {
    grupoMuscular: "Quadríceps, glúteo",
    comoExecutar: [
      "Coloque o pé de trás apoiado num banco atrás do corpo",
      "Desça controlado flexionando o joelho da frente",
      "Mantenha o tronco levemente inclinado à frente",
      "Empurre de volta usando a perna da frente",
    ],
    errosComuns: ["Deixar o joelho da frente passar demais da ponta do pé", "Apoiar peso demais na perna de trás"],
    dica: "É normal sentir dificuldade de equilíbrio no início — apoie-se em algo se precisar.",
  },
  "Agachamento hack (hack squat)": {
    grupoMuscular: "Quadríceps, glúteo",
    comoExecutar: [
      "Posicione-se no aparelho com as costas apoiadas",
      "Pés na largura dos ombros, levemente à frente do corpo",
      "Desça controlado flexionando o joelho",
      "Empurre de volta sem travar o joelho no topo",
    ],
    errosComuns: ["Descer rápido demais", "Tirar o calcanhar da plataforma"],
    dica: "Pés mais baixos na plataforma focam mais no quadríceps; mais altos, mais no glúteo.",
  },
  "Agachamento sumô": {
    grupoMuscular: "Quadríceps, glúteo, adutores",
    comoExecutar: [
      "Pés bem mais afastados que a largura dos ombros, pontas viradas pra fora",
      "Segure o peso à frente ou entre as pernas",
      "Desça mantendo o tronco ereto",
      "Empurre de volta contraindo o glúteo",
    ],
    errosComuns: ["Joelhos caindo pra dentro na subida", "Não abrir o suficiente o quadril"],
    dica: "A postura mais aberta ativa mais a parte interna da coxa (adutores) que o agachamento tradicional.",
  },
  "Crucifixo": {
    grupoMuscular: "Peito",
    comoExecutar: [
      "Deite no banco segurando um halter em cada mão acima do peito",
      "Abra os braços em arco, cotovelos levemente flexionados",
      "Desça até sentir o alongamento no peito",
      "Feche os braços de volta contraindo o peito",
    ],
    errosComuns: ["Descer demais e forçar o ombro", "Esticar totalmente o cotovelo"],
    dica: "O movimento é em arco, como um abraço — não é o mesmo trajeto do supino.",
  },
  "Elevação pélvica (hip thrust)": {
    grupoMuscular: "Glúteo, posterior de coxa",
    comoExecutar: [
      "Apoie a parte superior das costas num banco, pés no chão",
      "Posicione a barra/peso sobre o quadril",
      "Suba o quadril contraindo o glúteo até formar uma linha reta",
      "Desça controlado sem tocar o chão",
    ],
    errosComuns: ["Arquear demais a lombar no topo", "Empurrar com os pés muito à frente ou muito perto"],
    dica: "Segure a contração no topo por 1-2 segundos antes de descer.",
  },
  "Panturrilha sentado": {
    grupoMuscular: "Panturrilha (sóleo)",
    comoExecutar: [
      "Sente-se no aparelho com os joelhos sob o apoio",
      "Apoie a ponta dos pés na plataforma",
      "Eleve os calcanhares o máximo possível",
      "Desça controlado até alongar bem a panturrilha",
    ],
    errosComuns: ["Amplitude curta", "Movimento rápido sem controle"],
    dica: "Sentado, o foco vai mais pro sóleo (parte de baixo da panturrilha) do que em pé.",
  },
  "Puxada frontal triângulo": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Sente-se e prenda as pernas sob o apoio",
      "Segure o triângulo com as duas mãos",
      "Puxe até a altura do peito, cotovelos pra baixo e pra trás",
      "Suba controlado sem deixar o peso bater",
    ],
    errosComuns: ["Puxar com o corpo em vez das costas", "Usar impulso"],
    dica: "A pegada neutra (triângulo) costuma ser mais confortável pro ombro que a pegada aberta.",
  },
  "Remada unilateral (serrote)": {
    grupoMuscular: "Costas, bíceps",
    comoExecutar: [
      "Apoie um joelho e uma mão no banco",
      "Segure o halter com o braço estendido",
      "Puxe o halter até a altura do quadril, cotovelo pra trás",
      "Desça controlado",
    ],
    errosComuns: ["Girar o tronco pra ajudar a puxar", "Usar impulso"],
    dica: "Mantenha as costas paralelas ao chão durante todo o movimento.",
  },
  "Rosca martelo": {
    grupoMuscular: "Bíceps, antebraço",
    comoExecutar: [
      "Segure os halteres com as palmas voltadas uma pra outra",
      "Flexione o cotovelo mantendo o pulso neutro",
      "Suba até o ombro sem girar o punho",
      "Desça controlado",
    ],
    errosComuns: ["Balançar o corpo pra ajudar", "Girar o punho durante o movimento"],
    dica: "A pegada neutra ativa mais o antebraço que a rosca tradicional.",
  },
  "Rosca no banco Scott": {
    grupoMuscular: "Bíceps",
    comoExecutar: [
      "Apoie os braços no banco Scott com as axilas encostadas no topo",
      "Segure a barra/halter",
      "Flexione o cotovelo levando o peso até o ombro",
      "Desça controlado sem estender rápido demais",
    ],
    errosComuns: ["Não descer até quase estender o braço", "Levantar as axilas do apoio"],
    dica: "O apoio impede o balanço do corpo — ótimo pra isolar o bíceps.",
  },
  "Rosca no banco inclinado": {
    grupoMuscular: "Bíceps (foco na porção longa)",
    comoExecutar: [
      "Sente-se no banco inclinado com os braços soltos ao lado do corpo",
      "Segure os halteres com os braços estendidos pra trás",
      "Flexione o cotovelo trazendo o peso até o ombro",
      "Desça controlado até o alongamento completo",
    ],
    errosComuns: ["Balançar o ombro pra frente durante a subida", "Amplitude curta"],
    dica: "O braço atrás do corpo alonga mais o bíceps — ótimo pra sentir o alongamento completo.",
  },
  "Tríceps coice (kickback)": {
    grupoMuscular: "Tríceps",
    comoExecutar: [
      "Apoie um joelho e uma mão no banco, tronco paralelo ao chão",
      "Segure o halter com o cotovelo fixo junto ao corpo",
      "Estenda o braço pra trás até ficar reto",
      "Volte controlado sem descer demais",
    ],
    errosComuns: ["Deixar o cotovelo cair durante o movimento", "Usar peso alto e balançar o corpo"],
    dica: "Mantenha o braço sempre paralelo ao chão durante o movimento — só o antebraço se move.",
  },
  "Voador invertido (deltoide posterior)": {
    grupoMuscular: "Deltoide posterior, trapézio",
    comoExecutar: [
      "Incline o tronco à frente (ou sente-se de frente pro peck deck invertido)",
      "Segure os halteres/manoplas com os braços levemente flexionados",
      "Abra os braços pra trás e pros lados, contraindo os ombros",
      "Volte controlado",
    ],
    errosComuns: ["Usar impulso do corpo", "Fechar demais o cotovelo (vira mais tríceps)"],
    dica: "Pense em 'juntar as escápulas' no topo do movimento.",
  },
  "Agachamento na cadeira (sentar e levantar)": {
    grupoMuscular: "Quadríceps, glúteo",
    comoExecutar: [
      "Sente na ponta de uma cadeira firme",
      "Incline levemente o tronco à frente",
      "Levante-se usando as pernas, sem usar as mãos se possível",
      "Sente de volta controlado, sem deixar o corpo cair",
    ],
    errosComuns: ["Usar impulso das mãos nos joelhos", "Deixar o corpo cair na cadeira em vez de descer controlado"],
    dica: "Ótimo pra treinar a força que você usa no dia a dia pra levantar de qualquer lugar.",
  },
  "Elevação de perna sentado": {
    grupoMuscular: "Quadríceps, quadril",
    comoExecutar: [
      "Sente-se numa cadeira com as costas retas",
      "Estenda uma perna até ficar reta na frente do corpo",
      "Segure 1-2 segundos no topo",
      "Desça controlado sem bater o pé no chão",
    ],
    errosComuns: ["Balançar o tronco pra ajudar", "Movimento rápido demais"],
    dica: "Pode alternar as pernas ou fazer todas as repetições de um lado antes de trocar.",
  },
  "Marcha estacionária": {
    grupoMuscular: "Cardio, quadríceps, core",
    comoExecutar: [
      "Fique em pé com os pés na largura do quadril",
      "Eleve os joelhos alternadamente, como se estivesse marchando no lugar",
      "Balance os braços naturalmente",
      "Mantenha um ritmo constante",
    ],
    errosComuns: ["Curvar as costas", "Marchar rápido demais sem controle e perder a postura"],
    dica: "Ótimo aquecimento ou exercício cardio de baixo impacto — ajuste o ritmo conforme seu condicionamento.",
  },
  "Rotação de tronco sentado": {
    grupoMuscular: "Oblíquos, core",
    comoExecutar: [
      "Sente-se numa cadeira com as costas retas",
      "Segure as mãos à frente do peito (ou um peso leve)",
      "Gire o tronco pra um lado, depois pro outro",
      "Mantenha o quadril parado durante o giro",
    ],
    errosComuns: ["Girar só os braços em vez do tronco", "Movimento rápido demais sem controle"],
    dica: "O quadril fica fixo — só a parte de cima do corpo gira.",
  },
  "Elevação de braço com faixa elástica": {
    grupoMuscular: "Ombro",
    comoExecutar: [
      "Pise na faixa elástica ou prenda numa base fixa",
      "Segure as pontas com as mãos",
      "Eleve os braços à frente ou pros lados até a altura do ombro",
      "Desça controlado sem deixar a faixa puxar de volta rápido",
    ],
    errosComuns: ["Usar impulso do corpo", "Soltar rápido demais na volta (perde tensão e controle)"],
    dica: "Quanto mais curta a faixa, maior a resistência — ajuste conforme sua força.",
  },
  "Ponte de glúteo (sentado)": {
    grupoMuscular: "Glúteo",
    comoExecutar: [
      "Sente-se na ponta de uma cadeira",
      "Apoie os pés firmes no chão",
      "Empurre o quadril pra frente/cima contraindo o glúteo",
      "Volte controlado sem sentar totalmente",
    ],
    errosComuns: ["Usar a lombar em vez do glúteo pra empurrar", "Movimento rápido demais"],
    dica: "Boa alternativa pra quem tem dificuldade de fazer a ponte de glúteo deitado no chão.",
  },
  "Funcional livre (escolha no canal)": {
    grupoMuscular: "Livre — você escolhe",
    comoExecutar: [
      "Toque no botão pra abrir os vídeos do canal Women 3D Workouts",
      "Escolha o exercício que quiser dentro do canal",
      "Siga o vídeo escolhido",
      "Registre a série normalmente aqui no app depois de terminar",
    ],
    errosComuns: ["Nenhum erro fixo — siga a explicação do vídeo que você escolher"],
    dica: "Use essa opção quando quiser variar o treino funcional com exercícios que ainda não estão cadastrados no app.",
  },
};

function extrairNumeroCarga(texto) {
  if (!texto) return null;
  const match = String(texto).replace(",", ".").match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function descansoParaSegundos(str) {
  const mapa = {
    "1 min": 60,
    "1:30 min": 90,
    "2 min": 120,
    "2:30 min": 150,
    "3 min": 180,
    "3:30 min": 210,
    "4 min": 240,
    "4:30 min": 270,
    "5 min": 300,
  };
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

function desenharLogoMassi(ctx, cx, cy, tamanho) {
  const metade = tamanho / 2;
  const raioCanto = tamanho * 0.27;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - metade + raioCanto, cy - metade);
  ctx.arcTo(cx + metade, cy - metade, cx + metade, cy + metade, raioCanto);
  ctx.arcTo(cx + metade, cy + metade, cx - metade, cy + metade, raioCanto);
  ctx.arcTo(cx - metade, cy + metade, cx - metade, cy - metade, raioCanto);
  ctx.arcTo(cx - metade, cy - metade, cx + metade, cy - metade, raioCanto);
  ctx.closePath();
  ctx.fillStyle = "#131A1D";
  ctx.fill();

  const grad = ctx.createLinearGradient(cx - metade, cy, cx + metade, cy);
  grad.addColorStop(0, "#1CA7E0");
  grad.addColorStop(0.55, "#1FD1A6");
  grad.addColorStop(1, "#8BDB4B");
  const escala = tamanho / 44;
  const pontos = [[8, 26], [16, 26], [20, 15], [24, 32], [28, 20], [32, 26], [36, 26]];
  ctx.beginPath();
  pontos.forEach(([x, y], i) => {
    const px = cx - metade + x * escala;
    const py = cy - metade + y * escala;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3 * escala;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function quebrarLinhasCanvas(ctx, texto, x, y, larguraMax, alturaLinha) {
  const palavras = texto.split(" ");
  const linhas = [];
  let linha = "";
  palavras.forEach((palavra) => {
    const teste = linha ? `${linha} ${palavra}` : palavra;
    if (ctx.measureText(teste).width > larguraMax && linha) {
      linhas.push(linha);
      linha = palavra;
    } else {
      linha = teste;
    }
  });
  if (linha) linhas.push(linha);
  const inicioY = y - ((linhas.length - 1) * alturaLinha) / 2;
  linhas.forEach((l, i) => ctx.fillText(l, x, inicioY + i * alturaLinha));
}

function MassiLogoMark() {
  return (
    <svg viewBox="0 0 44 44" width="44" height="44" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id="massiLogoGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1CA7E0" />
          <stop offset="55%" stopColor="#1FD1A6" />
          <stop offset="100%" stopColor="#8BDB4B" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="44" height="44" rx="12" fill="#131A1D" />
      <path
        d="M8,26 L16,26 L20,15 L24,32 L28,20 L32,26 L36,26"
        fill="none"
        stroke="url(#massiLogoGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MarcaCompartilhamento({ foto }) {
  if (!foto) return <MassiLogoMark />;
  return (
    <div style={styles.marcaFotoWrap}>
      <div style={{ ...styles.marcaFotoRing, backgroundImage: `url(${foto})` }} />
      <div style={styles.marcaFotoLogoBadge}>
        <svg viewBox="0 0 44 44" width="20" height="20" style={{ display: "block" }}>
          <defs>
            <linearGradient id="massiLogoGradBadge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1CA7E0" />
              <stop offset="55%" stopColor="#1FD1A6" />
              <stop offset="100%" stopColor="#8BDB4B" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="44" height="44" rx="12" fill="#131A1D" />
          <path
            d="M8,26 L16,26 L20,15 L24,32 L28,20 L32,26 L36,26"
            fill="none"
            stroke="url(#massiLogoGradBadge)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function calcularStreak(historico) {
  if (!historico || historico.length === 0) return 0;
  const datasUnicas = [...new Set(historico.map((h) => h.data))].sort().reverse();
  const hoje = new Date().toISOString().slice(0, 10);
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (datasUnicas[0] !== hoje && datasUnicas[0] !== ontem) return 0;
  let streak = 1;
  for (let i = 0; i < datasUnicas.length - 1; i++) {
    const atual = new Date(datasUnicas[i]);
    const anterior = new Date(datasUnicas[i + 1]);
    const diffDias = Math.round((atual - anterior) / 86400000);
    if (diffDias === 1) streak++;
    else break;
  }
  return streak;
}

function getChaveSemana(dataStr) {
  const d = new Date(dataStr + "T00:00:00");
  const inicioAno = new Date(d.getFullYear(), 0, 1);
  const numSemana = Math.ceil(((d - inicioAno) / 86400000 + inicioAno.getDay() + 1) / 7);
  return `${d.getFullYear()}-S${numSemana}`;
}

// conta quantas semanas seguidas (incluindo a atual) tiveram 3+ treinos, olhando pra trás
function calcularSemanasConsistentes(historico) {
  if (!historico || historico.length === 0) return 0;
  const porSemana = {};
  historico.forEach((h) => {
    const chave = getChaveSemana(h.data);
    porSemana[chave] = (porSemana[chave] || 0) + 1;
  });
  let streakSemanas = 0;
  let cursor = new Date();
  for (let i = 0; i < 20; i++) {
    const chave = getChaveSemana(cursor.toISOString().slice(0, 10));
    if ((porSemana[chave] || 0) >= 3) {
      streakSemanas++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }
  return streakSemanas;
}

function normalizarDecimal(valor) {
  return valor.replace(",", ".").replace(/[^0-9.]/g, "");
}

function calcularAguaLitros(pesoKg) {
  if (!pesoKg || pesoKg <= 0) return null;
  return +(pesoKg * 0.035).toFixed(1);
}

const KCAL_CARDIO_POR_MINUTO = { Leve: 6, Moderada: 8, Intensa: 11 };

function calcularCaloriasTreino(diaEntry) {
  let kcal = 0;
  diaEntry.exercicios.forEach((ex) => {
    const sets = ex.sets || 3;
    kcal += sets * 8; // estimativa média por série de musculação
  });
  if (diaEntry.cardio) {
    const porMinuto = KCAL_CARDIO_POR_MINUTO[diaEntry.cardio.intensidade] || 7;
    kcal += (diaEntry.cardio.duracao || 0) * porMinuto;
  }
  return Math.round(kcal);
}

function toExercicio(base) {
  return { id: uid(), ...base, maquina: base.maquinas[0], descanso: DESCANSO_PADRAO, concluido: false, carga: "", cargas: Array(base.sets || 1).fill("") };
}

function makeDayEntry(dia, foco, nivel) {
  if (foco === "Cardio") {
    return { dia, foco, cardio: { tipo: "Esteira", duracao: 20, intensidade: "Moderada" }, exercicios: [] };
  }
  if (foco === "Descanso" || !foco) {
    return { dia, foco: foco || "Descanso", cardio: null, exercicios: [] };
  }

  const avancado = nivel === "Intermediário" || nivel === "Avançado";

  // ---- Regras de composição: agonista principal + sinergista + estabilizador ----
  if (foco === "Peito") {
    // agonista: 3 exercícios de peito cobrindo as 3 porções (inferior, medial, superior)
    const porRegiao = ["superior", "medial", "inferior"].map(
      (r) => LIBRARY.Peito.find((e) => e.regiao === r)
    ).filter(Boolean);
    const peitoEscolhido = porRegiao.length === 3 ? porRegiao : LIBRARY.Peito.slice(0, 3);
    // sinergista: sempre 3 de tríceps
    const tricepsEscolhido = TRICEPS_POOL.slice(0, 3);
    // estabilizador: 1 ou 2 de ombro, conforme o nível
    const ombroEscolhido = OMBRO_PRINCIPAL_POOL.slice(0, avancado ? 2 : 1);
    return {
      dia,
      foco,
      cardio: null,
      exercicios: [...peitoEscolhido, ...tricepsEscolhido, ...ombroEscolhido].map(toExercicio),
    };
  }

  if (foco === "Costas") {
    // agonista: 2 ou 3 de costas, conforme o nível
    const costasEscolhido = LIBRARY.Costas.slice(0, avancado ? 3 : 2);
    // sinergista: o complemento em bíceps (3 ou 2)
    const bicepsEscolhido = BICEPS_POOL.slice(0, avancado ? 2 : 3);
    // estabilizador: sempre 1 de deltoide posterior
    const posteriorEscolhido = OMBRO_POSTERIOR_POOL.slice(0, 1);
    return {
      dia,
      foco,
      cardio: null,
      exercicios: [...costasEscolhido, ...bicepsEscolhido, ...posteriorEscolhido].map(toExercicio),
    };
  }

  if (foco === "Ombro") {
    // "ombro sozinho completo": todas as porções (frontal, lateral, posterior)
    return {
      dia,
      foco,
      cardio: null,
      exercicios: LIBRARY.Ombro.map(toExercicio),
    };
  }

  if (foco === "Perna") {
    // "perna completa": quadríceps, posterior de coxa, glúteo e panturrilha
    return {
      dia,
      foco,
      cardio: null,
      exercicios: PERNA_COMPLETA_POOL.map(toExercicio),
    };
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
  const [chaveRemount, setChaveRemount] = useState(0);
  return <AppMassiPro key={chaveRemount} onSolicitarRemount={() => setChaveRemount((c) => c + 1)} />;
}

function AppMassiPro({ onSolicitarRemount }) {
  const [rotina, setRotina] = useState(() =>
    DIAS_SEMANA.map((dia, i) =>
      makeDayEntry(dia, ["Corpo inteiro", "Cardio", "Corpo inteiro"][i] || "Descanso")
    )
  );
  const [diasSelecionados, setDiasSelecionados] = useState(["Segunda", "Terça", "Quarta"]);
  const [saveState, setSaveState] = useState("idle");
  const [loaded, setLoaded] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [nivelUsuario, setNivelUsuario] = useState(null); // nível do onboarding — usado pra montar peito/costas/ombro automaticamente
  const [objetivoUsuario, setObjetivoUsuario] = useState(null); // objetivo do onboarding — usado pra pré-selecionar a dieta
  const [recordes, setRecordes] = useState({}); // recorde pessoal (maior carga já registrada) por exercício
  const [novoRecordeAviso, setNovoRecordeAviso] = useState(null); // texto do aviso de novo recorde, some sozinho
  const [sugestaoTroca, setSugestaoTroca] = useState(null); // { dia, nomeAtual, nomeAlternativo } — sugestão após registrar dor
  const [deloadRespostaSemana, setDeloadRespostaSemana] = useState(null); // semana em que a pessoa já aplicou ou dispensou a sugestão de deload
  const [showPlanos, setShowPlanos] = useState(false);
  const [showModelos, setShowModelos] = useState(false);
  const [activeTab, setActiveTab] = useState("inicio");
  const tabRowRef = useRef(null);
  const tabBtnRefs = useRef({});
  const [showTabScrollHint, setShowTabScrollHint] = useState(true);
  useEffect(() => {
    const el = tabBtnRefs.current[activeTab];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeTab]);
  const [exercicioAberto, setExercicioAberto] = useState(null);
  const [cronometro, setCronometro] = useState(null); // { totalSeg, restanteSeg, rodando, label }
  const [historico, setHistorico] = useState([]);
  const [mensagemSucesso, setMensagemSucesso] = useState(null);
  const [ultimoTreinoConcluido, setUltimoTreinoConcluido] = useState(null);
  const [mostrarOpcoesCompartilhar, setMostrarOpcoesCompartilhar] = useState(false);
  const [splashVisivel, setSplashVisivel] = useState(true);
  const [splashSaindo, setSplashSaindo] = useState(false);
  const [feedbackPendente, setFeedbackPendente] = useState(null);
  const [dores, setDores] = useState([]);
  const [dorPendente, setDorPendente] = useState(null); // { exercicio, dia }
  const [fotoCompartilhamento, setFotoCompartilhamento] = useState(null); // base64 da foto opcional pro card de compartilhar
  const [buscaExercicio, setBuscaExercicio] = useState("");
  const [avisoSemTreinar, setAvisoSemTreinar] = useState(null);
  const [guiadoAtivo, setGuiadoAtivo] = useState(null); // dia inteiro (entry) em modo guiado
  const [progressao, setProgressao] = useState({}); // { [nomeExercicio]: contagem }
  const [onboardingPendente, setOnboardingPendente] = useState(false);
  const [tema, setTema] = useState("claro");
  const [perfis, setPerfis] = useState([{ id: "perfil-1", nome: "Eu" }]);
  const [perfilAtivoId, setPerfilAtivoId] = useState("perfil-1");
  const [showPerfis, setShowPerfis] = useState(false);
  const perfilAtivoNome = (perfis.find((p) => p.id === perfilAtivoId) || {}).nome || "Você";

  useEffect(() => {
    const t1 = setTimeout(() => setSplashSaindo(true), 1700);
    const t2 = setTimeout(() => setSplashVisivel(false), 2100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

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
      try {
        const doresRes = await window.storage.get("dores-exercicios");
        if (doresRes && doresRes.value) setDores(JSON.parse(doresRes.value));
      } catch (e) {
        // sem registros de dor ainda
      }
      try {
        const fotoRes = await window.storage.get("foto-compartilhamento");
        if (fotoRes && fotoRes.value) setFotoCompartilhamento(fotoRes.value);
      } catch (e) {
        // sem foto salva ainda
      }
      try {
        const progRes = await window.storage.get("progressao-exercicios");
        if (progRes && progRes.value) setProgressao(JSON.parse(progRes.value));
      } catch (e) {
        // sem progressão salva ainda
      }
      try {
        const recRes = await window.storage.get("recordes-pessoais");
        if (recRes && recRes.value) setRecordes(JSON.parse(recRes.value));
      } catch (e) {
        // sem recordes salvos ainda
      }
      try {
        const onboardingRes = await window.storage.get("onboarding-perfil");
        if (!onboardingRes || !onboardingRes.value) setOnboardingPendente(true);
        else {
          const perfilSalvo = JSON.parse(onboardingRes.value);
          if (perfilSalvo && perfilSalvo.nivel) setNivelUsuario(perfilSalvo.nivel);
          if (perfilSalvo && perfilSalvo.objetivo) setObjetivoUsuario(perfilSalvo.objetivo);
        }
      } catch (e) {
        setOnboardingPendente(true);
      }
      try {
        const temaRes = await window.storage.get("tema-app");
        if (temaRes && temaRes.value) setTema(temaRes.value);
      } catch (e) {
        // usa o padrão "claro"
      }
      try {
        const deloadRes = await window.storage.get("deload-resposta-semana");
        if (deloadRes && deloadRes.value) setDeloadRespostaSemana(deloadRes.value);
      } catch (e) {
        // sem resposta de deload salva ainda
      }
      try {
        // acessar qualquer chave normal primeiro garante que a migração de perfis já rodou
        const perfisRes = await window.storage.get("perfis-lista");
        if (perfisRes && perfisRes.value) setPerfis(JSON.parse(perfisRes.value));
        const ativoRes = await window.storage.get("perfil-ativo-id");
        if (ativoRes && ativoRes.value) setPerfilAtivoId(ativoRes.value);
      } catch (e) {
        // segue com os padrões
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
    setRotina((prev) => prev.map((d) => (d.dia === dia ? makeDayEntry(dia, foco, nivelUsuario) : d)));
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
        const entry = makeDayEntry(dia, focos[i] || "Descanso", nivelUsuario);
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

  const trocarPerfil = async (id) => {
    if (id === perfilAtivoId) return;
    try {
      await window.storage.set("perfil-ativo-id", id);
    } catch (e) {
      // segue mesmo se falhar
    }
    onSolicitarRemount();
  };

  const criarPerfil = async (nome) => {
    const novo = { id: uid(), nome: nome.trim() || "Novo perfil" };
    const novaLista = [...perfis, novo];
    setPerfis(novaLista);
    try {
      await window.storage.set("perfis-lista", JSON.stringify(novaLista));
    } catch (e) {
      // segue mesmo se falhar
    }
    trocarPerfil(novo.id);
  };

  const renomearPerfil = async (id, novoNome) => {
    const novaLista = perfis.map((p) => (p.id === id ? { ...p, nome: novoNome } : p));
    setPerfis(novaLista);
    try {
      await window.storage.set("perfis-lista", JSON.stringify(novaLista));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const apagarPerfil = async (id) => {
    if (id === perfilAtivoId) return; // não deixa apagar o perfil ativo
    const novaLista = perfis.filter((p) => p.id !== id);
    setPerfis(novaLista);
    try {
      await window.storage.set("perfis-lista", JSON.stringify(novaLista));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const alternarTema = async () => {
    const novoTema = tema === "escuro" ? "claro" : "escuro";
    setTema(novoTema);
    try {
      await window.storage.set("tema-app", novoTema);
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const APP_URL = "https://massi-pro.vercel.app";

  const textoCompartilhamento = (registro) =>
    `Acabei de concluir um treino de ${registro.foco} no Massi Pro${
      registro.calorias ? ` — ~${registro.calorias} kcal` : ""
    }! 💪`;

  const gerarImagemCompartilhamento = (registro) =>
    new Promise((resolve) => {
      const W = 1080;
      const H = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      const fundo = ctx.createLinearGradient(0, 0, W, H);
      fundo.addColorStop(0, "#182226");
      fundo.addColorStop(1, "#0F1417");
      ctx.fillStyle = fundo;
      ctx.fillRect(0, 0, W, H);

      const brilho1 = ctx.createRadialGradient(W * 0.12, H * 0.08, 0, W * 0.12, H * 0.08, W * 0.65);
      brilho1.addColorStop(0, "rgba(28,167,224,0.35)");
      brilho1.addColorStop(1, "rgba(28,167,224,0)");
      ctx.fillStyle = brilho1;
      ctx.fillRect(0, 0, W, H);

      const brilho2 = ctx.createRadialGradient(W * 0.9, H * 0.92, 0, W * 0.9, H * 0.92, W * 0.65);
      brilho2.addColorStop(0, "rgba(139,219,75,0.3)");
      brilho2.addColorStop(1, "rgba(139,219,75,0)");
      ctx.fillStyle = brilho2;
      ctx.fillRect(0, 0, W, H);

      const finalizar = () => {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 66px system-ui, sans-serif";
        ctx.fillText("Massi Pro", W / 2, H * 0.66);

        ctx.font = "500 34px system-ui, sans-serif";
        ctx.fillStyle = "#c9d6da";
        quebrarLinhasCanvas(ctx, textoCompartilhamento(registro), W / 2, H * 0.74, W * 0.78, 46);

        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
      };

      if (fotoCompartilhamento) {
        const img = new Image();
        img.onload = () => {
          const cx = W / 2;
          const cy = H * 0.36;
          const r = W * 0.22;
          const anel = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
          anel.addColorStop(0, "#1CA7E0");
          anel.addColorStop(0.55, "#1FD1A6");
          anel.addColorStop(1, "#8BDB4B");
          ctx.beginPath();
          ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
          ctx.fillStyle = anel;
          ctx.fill();
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
          desenharLogoMassi(ctx, cx + r * 0.68, cy + r * 0.68, 96);
          finalizar();
        };
        img.src = fotoCompartilhamento;
      } else {
        desenharLogoMassi(ctx, W / 2, H * 0.34, 200);
        finalizar();
      }
    });

  const copiarTextoTreino = async (registro) => {
    if (!registro) return;
    try {
      await navigator.clipboard.writeText(textoCompartilhamento(registro));
      setMostrarOpcoesCompartilhar(false);
      setMensagemSucesso("Texto copiado! Cole onde quiser compartilhar.");
    } catch (e) {
      // não suportado — sem problema
    }
  };

  const compartilharWhatsapp = (registro) => {
    if (!registro) return;
    const url = `https://wa.me/?text=${encodeURIComponent(textoCompartilhamento(registro) + " " + APP_URL)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMostrarOpcoesCompartilhar(false);
  };

  const compartilharFacebook = (registro) => {
    if (!registro) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}&quote=${encodeURIComponent(
      textoCompartilhamento(registro)
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMostrarOpcoesCompartilhar(false);
  };

  const compartilharTwitter = (registro) => {
    if (!registro) return;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      textoCompartilhamento(registro) + " " + APP_URL
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMostrarOpcoesCompartilhar(false);
  };

  const compartilharTelegram = (registro) => {
    if (!registro) return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(
      textoCompartilhamento(registro)
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setMostrarOpcoesCompartilhar(false);
  };

  const compartilharTreino = async (registro) => {
    if (!registro) return;
    const texto = textoCompartilhamento(registro);
    try {
      if (navigator.share) {
        if (fotoCompartilhamento && navigator.canShare) {
          try {
            const blob = await gerarImagemCompartilhamento(registro);
            const arquivo = new File([blob], "massi-pro-treino.jpg", { type: "image/jpeg" });
            if (navigator.canShare({ files: [arquivo] })) {
              await navigator.share({ files: [arquivo], text: texto });
              setMostrarOpcoesCompartilhar(false);
              return;
            }
          } catch (e) {
            // geração/compartilhamento de imagem falhou — segue com texto simples abaixo
          }
        }
        await navigator.share({ text: texto });
        setMostrarOpcoesCompartilhar(false);
      } else {
        await copiarTextoTreino(registro);
      }
    } catch (e) {
      // usuário cancelou o compartilhamento, ou não suportado — sem problema
    }
  };

  const concluirTreino = async (diaEntry, sentimento) => {
    const calorias = calcularCaloriasTreino(diaEntry);
    const registro = {
      id: uid(),
      data: new Date().toISOString().slice(0, 10),
      dia: diaEntry.dia,
      foco: diaEntry.foco,
      totalExercicios: diaEntry.exercicios.length,
      cardio: diaEntry.cardio ? { tipo: diaEntry.cardio.tipo, duracao: diaEntry.cardio.duracao } : null,
      sentimento: sentimento || null,
      calorias,
    };
    const novoHistorico = [...historico, registro];
    setHistorico(novoHistorico);
    setUltimoTreinoConcluido(registro);
    try {
      await window.storage.set("historico-treinos", JSON.stringify(novoHistorico));
      setMensagemSucesso(`Bom treino! ~${calorias} kcal estimadas. Já salvo no histórico.`);
    } catch (e) {
      setMensagemSucesso("Treino concluído, mas não consegui salvar no histórico agora.");
    }

    // Progressão automática de carga: soma 1 na contagem de cada exercício desse treino
    const novaProgressao = { ...progressao };
    diaEntry.exercicios.forEach((ex) => {
      novaProgressao[ex.name] = (novaProgressao[ex.name] || 0) + 1;
    });
    setProgressao(novaProgressao);
    try {
      await window.storage.set("progressao-exercicios", JSON.stringify(novaProgressao));
    } catch (e) {
      // segue mesmo se falhar
    }
    // TODO ADMOB: bom ponto pra exibir um intersticial, ex: mostrarInterstitial();
    // Deixado comentado de propósito — decida a frequência ideal antes de ativar.
  };

  const encontrarAlternativa = (dia, nomeExercicio) => {
    const diaEntry = rotina.find((d) => d.dia === dia);
    if (!diaEntry) return null;
    const grupo = GUIA_EXECUCAO[nomeExercicio] && GUIA_EXECUCAO[nomeExercicio].grupoMuscular;
    if (!grupo) return null;
    const gruposAtuais = grupo.split(",").map((g) => g.trim().toLowerCase());
    const usados = new Set(diaEntry.exercicios.map((e) => e.name));
    let candidata = null;
    Object.values(LIBRARY).forEach((lista) => {
      if (candidata) return;
      lista.forEach((cand) => {
        if (candidata || cand.name === nomeExercicio || usados.has(cand.name)) return;
        const grupoCand = GUIA_EXECUCAO[cand.name] && GUIA_EXECUCAO[cand.name].grupoMuscular;
        if (!grupoCand) return;
        const gruposCand = grupoCand.split(",").map((g) => g.trim().toLowerCase());
        if (gruposAtuais.some((g) => gruposCand.includes(g))) candidata = cand;
      });
    });
    return candidata;
  };

  const salvarDor = async (nota) => {
    if (!dorPendente) return;
    const { exercicio, dia } = dorPendente;
    const registro = { id: uid(), exercicio, data: new Date().toISOString().slice(0, 10), nota };
    const nova = [...dores, registro];
    setDores(nova);
    setDorPendente(null);
    try {
      await window.storage.set("dores-exercicios", JSON.stringify(nova));
    } catch (e) {
      // segue mesmo se falhar
    }
    const alternativa = encontrarAlternativa(dia, exercicio);
    if (alternativa) {
      setSugestaoTroca({ dia, nomeAtual: exercicio, nomeAlternativo: alternativa.name });
    }
  };

  const aplicarSugestaoTroca = () => {
    if (!sugestaoTroca) return;
    const { dia, nomeAtual, nomeAlternativo } = sugestaoTroca;
    const nova = LIBRARY_INDEX[nomeAlternativo];
    setRotina((prev) =>
      prev.map((d) =>
        d.dia === dia
          ? {
              ...d,
              exercicios: d.exercicios.map((e) => (e.name === nomeAtual && nova ? toExercicio(nova) : e)),
            }
          : d
      )
    );
    setSugestaoTroca(null);
  };

  const semanaAtualChave = getChaveSemana(new Date().toISOString().slice(0, 10));
  const semanasConsistentes = calcularSemanasConsistentes(historico);
  const mostrarSugestaoDeload = semanasConsistentes >= 6 && deloadRespostaSemana !== semanaAtualChave;

  const registrarRespostaDeload = async () => {
    setDeloadRespostaSemana(semanaAtualChave);
    try {
      await window.storage.set("deload-resposta-semana", semanaAtualChave);
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const aplicarSemanaLeve = () => {
    setRotina((prev) =>
      prev.map((d) => ({
        ...d,
        exercicios: d.exercicios.map((e) => {
          if (!e.sets) return e;
          const novoTotal = Math.max(2, e.sets - 1);
          const cargasAtual = e.cargas && e.cargas.length ? e.cargas : [e.carga || ""];
          const novasCargas = Array.from({ length: novoTotal }, (_, i) => cargasAtual[i] || cargasAtual[cargasAtual.length - 1] || "");
          return { ...e, sets: novoTotal, cargas: novasCargas };
        }),
      }))
    );
    registrarRespostaDeload();
  };

  const exportarRotinaImagem = () => {
    const diasComConteudo = rotina.filter((d) => (d.exercicios && d.exercicios.length > 0) || d.cardio);
    const LARGURA = 1000;
    const MARGEM = 50;
    const LINHA = 30;
    let linhasTotal = 0;
    diasComConteudo.forEach((d) => {
      linhasTotal += 1; // título do dia
      linhasTotal += d.cardio ? 1 : d.exercicios.length;
      linhasTotal += 0.5; // respiro entre dias
    });
    const ALTURA_TOPO = 210;
    const ALTURA_RODAPE = 70;
    const altura = Math.max(700, ALTURA_TOPO + linhasTotal * LINHA + ALTURA_RODAPE);

    const canvas = document.createElement("canvas");
    canvas.width = LARGURA;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");

    const fundo = ctx.createLinearGradient(0, 0, LARGURA, altura);
    fundo.addColorStop(0, "#182226");
    fundo.addColorStop(1, "#0F1417");
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, LARGURA, altura);

    desenharLogoMassi(ctx, MARGEM + 34, 56, 68);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText("Minha rotina — Massi Pro", MARGEM + 80, 66);
    ctx.font = "400 16px system-ui, sans-serif";
    ctx.fillStyle = "#8b95a1";
    ctx.fillText(new Date().toLocaleDateString("pt-BR"), MARGEM + 80, 92);

    let y = ALTURA_TOPO;
    diasComConteudo.forEach((d) => {
      ctx.font = "bold 22px system-ui, sans-serif";
      const corTitulo = ctx.createLinearGradient(MARGEM, y, MARGEM + 300, y);
      corTitulo.addColorStop(0, "#1CA7E0");
      corTitulo.addColorStop(1, "#8BDB4B");
      ctx.fillStyle = corTitulo;
      ctx.fillText(`${d.dia} — ${d.foco}`, MARGEM, y);
      y += LINHA;

      ctx.font = "400 17px system-ui, sans-serif";
      ctx.fillStyle = "#e4e9ec";
      if (d.cardio) {
        ctx.fillText(`• ${d.cardio.tipo} — ${d.cardio.duracao} min (${d.cardio.intensidade})`, MARGEM + 16, y);
        y += LINHA;
      } else {
        d.exercicios.forEach((ex) => {
          ctx.fillText(`• ${ex.name} — ${ex.sets}x${ex.reps}`, MARGEM + 16, y);
          y += LINHA;
        });
      }
      y += LINHA * 0.5;
    });

    ctx.font = "italic 14px system-ui, sans-serif";
    ctx.fillStyle = "#8b95a1";
    ctx.fillText("Gerado no Massi Pro", MARGEM, altura - 30);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minha-rotina-massi-pro.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, "image/jpeg", 0.95);
  };

  const escolherFotoCompartilhamento = (arquivo) => {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = async () => {
        // reduz a foto pra um quadrado pequeno antes de salvar, evita pesar o armazenamento local
        const tamanho = 240;
        const canvas = document.createElement("canvas");
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext("2d");
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setFotoCompartilhamento(dataUrl);
        try {
          await window.storage.set("foto-compartilhamento", dataUrl);
        } catch (e) {
          // segue mesmo se falhar
        }
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  };

  const removerFotoCompartilhamento = async () => {
    setFotoCompartilhamento(null);
    try {
      await window.storage.delete("foto-compartilhamento");
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const removerDor = async (id) => {
    const nova = dores.filter((d) => d.id !== id);
    setDores(nova);
    try {
      await window.storage.set("dores-exercicios", JSON.stringify(nova));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  // alerta de 7+ dias sem treinar, calculado a partir do histórico já carregado
  useEffect(() => {
    if (!loaded) return;
    if (historico.length === 0) {
      setAvisoSemTreinar(null);
      return;
    }
    const datas = historico.map((h) => new Date(h.data).getTime());
    const ultimaData = Math.max(...datas);
    const diasSemTreinar = Math.floor((Date.now() - ultimaData) / 86400000);
    setAvisoSemTreinar(diasSemTreinar >= 7 ? diasSemTreinar : null);
  }, [historico, loaded]);

  const editarExercicio = (dia, id, campo, valor) => {
    setRotina((prev) =>
      prev.map((d) =>
        d.dia === dia
          ? {
              ...d,
              exercicios: d.exercicios.map((e) => {
                if (e.id !== id) return e;
                if (campo === "sets") {
                  const novoTotal = Math.max(1, Number(valor) || 1);
                  const cargasAtual = e.cargas && e.cargas.length ? e.cargas : [e.carga || ""];
                  const novasCargas = Array.from({ length: novoTotal }, (_, i) => cargasAtual[i] || cargasAtual[cargasAtual.length - 1] || "");
                  return { ...e, sets: novoTotal, cargas: novasCargas };
                }
                return { ...e, [campo]: valor };
              }),
            }
          : d
      )
    );
  };

  const registrarPossivelRecorde = (nomeExercicio, valorTexto) => {
    const numero = extrairNumeroCarga(valorTexto);
    if (numero === null) return;
    setRecordes((prev) => {
      const atual = prev[nomeExercicio];
      if (atual && atual.valor >= numero) return prev;
      const novo = { ...prev, [nomeExercicio]: { valor: numero, texto: valorTexto, data: new Date().toISOString().slice(0, 10) } };
      window.storage.set("recordes-pessoais", JSON.stringify(novo)).catch(() => {});
      setNovoRecordeAviso(`🏆 Novo recorde em ${nomeExercicio}: ${valorTexto}!`);
      return novo;
    });
  };

  useEffect(() => {
    if (!novoRecordeAviso) return;
    const t = setTimeout(() => setNovoRecordeAviso(null), 4000);
    return () => clearTimeout(t);
  }, [novoRecordeAviso]);

  const editarCargaSerie = (dia, id, indiceSerie, valor) => {
    setRotina((prev) =>
      prev.map((d) =>
        d.dia === dia
          ? {
              ...d,
              exercicios: d.exercicios.map((e) => {
                if (e.id !== id) return e;
                const totalSets = e.sets || 1;
                const cargasAtual = e.cargas && e.cargas.length === totalSets ? e.cargas : Array.from({ length: totalSets }, (_, i) => (e.cargas && e.cargas[i]) || e.carga || "");
                const novasCargas = [...cargasAtual];
                novasCargas[indiceSerie] = valor;
                registrarPossivelRecorde(e.name, valor);
                return { ...e, cargas: novasCargas, carga: novasCargas[0] };
              }),
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
    <div style={styles.page} data-tema={tema === "escuro" ? "escuro" : "claro"}>
      <style>{`
        :root {
          --paper: #F6F7F9;
          --paper-alt: #EDEFF3;
          --ink: #151A21;
          --pencil: #6B7280;
          color-scheme: light;
        }
        [data-tema="escuro"] {
          --paper: #14181B;
          --paper-alt: #1E2327;
          --ink: #EDEFF0;
          --pencil: #9AA3AC;
          color-scheme: dark;
        }
        input, select, textarea { background: var(--paper); color: var(--ink); }
        html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; background: var(--paper); -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
        #root { overflow-x: hidden; }
        * { box-sizing: border-box; }
        img, svg { max-width: 100%; }
        .chip { transition: background-color .15s ease, color .15s ease, border-color .15s ease; }
        .chip:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible {
          outline: 2px solid #B8433A; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }

        .splashPulsoPath {
          fill: none; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 260; stroke-dashoffset: 260;
          animation: splashDraw 1.1s ease-out forwards, splashGlow 2.4s ease-in-out 1.1s infinite;
        }
        @keyframes splashDraw { to { stroke-dashoffset: 0; } }
        @keyframes splashGlow { 0%,100% { filter: drop-shadow(0 0 0px #1FD1A6); } 50% { filter: drop-shadow(0 0 8px #1FD1A6); } }
        .splashFadeUp { opacity: 0; animation: splashFadeUp .7s ease-out .9s forwards; }
        .splashFadeUp2 { opacity: 0; animation: splashFadeUp .7s ease-out 1.15s forwards; }
        @keyframes splashFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {splashVisivel && (
        <div style={{ ...styles.splashOverlay, opacity: splashSaindo ? 0 : 1 }}>
          <svg viewBox="0 0 180 90" style={styles.splashSvg}>
            <path
              className="splashPulsoPath"
              d="M5,45 L55,45 L72,15 L90,70 L108,30 L125,45 L175,45"
              stroke="url(#splashGrad)"
            />
            <defs>
              <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1CA7E0" />
                <stop offset="55%" stopColor="#1FD1A6" />
                <stop offset="100%" stopColor="#8BDB4B" />
              </linearGradient>
            </defs>
          </svg>
          <div className="splashFadeUp" style={styles.splashWordmark}>MASSI PRO</div>
          <div className="splashFadeUp2" style={styles.splashSubtitulo}>TREINO · EVOLUÇÃO · EXECUÇÃO</div>
        </div>
      )}

      <header style={styles.hero}>
        <div style={styles.heroOverlay} />
        <div style={styles.headerTop}>
          <MassiLogoMark />
          <div style={styles.headerBotoesDireita}>
            <button style={styles.perfilHeaderBtn} onClick={() => setShowPerfis(true)} aria-label="Trocar perfil" title="Perfil">
              👤 {perfilAtivoNome}
            </button>
            <button style={styles.temaBtn} onClick={alternarTema} aria-label="Alternar modo claro/escuro" title="Alternar tema">
              {tema === "escuro" ? "☀️" : "🌙"}
            </button>
            <button style={isPremium ? styles.premiumBadge : styles.freeBadge} onClick={() => setShowPlanos(true)}>
              {isPremium ? "★ Premium" : "Free — ver planos"}
            </button>
          </div>
        </div>
        <p style={styles.saudacaoNome}>Olá, {perfilAtivoNome}!</p>
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

      {novoRecordeAviso && (
        <div style={styles.recordeToast} onClick={() => setNovoRecordeAviso(null)}>
          {novoRecordeAviso}
        </div>
      )}

      {mensagemSucesso && (
        <div
          style={styles.toastOverlay}
          onClick={() => {
            setMensagemSucesso(null);
            setMostrarOpcoesCompartilhar(false);
          }}
        >
          <div style={styles.toastCard} onClick={(e) => e.stopPropagation()}>
            {ultimoTreinoConcluido && mostrarOpcoesCompartilhar ? (
              <div style={styles.toastMarca}>
                <MarcaCompartilhamento foto={fotoCompartilhamento} />
                <div style={styles.toastMarcaNome}>Massi Pro</div>
              </div>
            ) : (
              <div style={styles.toastIcone}>✓</div>
            )}
            <div style={styles.toastTexto}>{mensagemSucesso}</div>

            {ultimoTreinoConcluido && !mostrarOpcoesCompartilhar && (
              <div style={styles.toastBotoesRow}>
                <button
                  style={styles.toastCompartilharBtn}
                  onClick={() => setMostrarOpcoesCompartilhar(true)}
                >
                  📤 Compartilhar
                </button>
                <button
                  style={styles.toastOkBtn}
                  onClick={() => setMensagemSucesso(null)}
                >
                  OK
                </button>
              </div>
            )}

            {ultimoTreinoConcluido && mostrarOpcoesCompartilhar && (
              <div style={styles.toastOpcoesCompartilhar}>
                <div style={styles.fotoCompartilharRow}>
                  <label style={styles.fotoCompartilharBtn}>
                    📷 {fotoCompartilhamento ? "Trocar foto" : "Adicionar foto (opcional)"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => escolherFotoCompartilhamento(e.target.files && e.target.files[0])}
                    />
                  </label>
                  {fotoCompartilhamento && (
                    <button style={styles.fotoCompartilharRemover} onClick={removerFotoCompartilhamento}>
                      Remover foto
                    </button>
                  )}
                </div>

                {fotoCompartilhamento && (
                  <div style={styles.fotoCompartilharDica}>
                    A foto só vai junto pelo botão "Mais opções" abaixo (é como o celular consegue anexar imagem). Nos botões diretos de WhatsApp/Facebook/X/Telegram, só o texto é enviado.
                  </div>
                )}

                <div style={styles.tostPreviewCard}>
                  <div style={styles.toastPreviewLabel}>Prévia do que vai ser compartilhado</div>
                  <div style={styles.toastPreviewTexto}>{textoCompartilhamento(ultimoTreinoConcluido)}</div>
                </div>

                <div style={styles.toastRedesGrid}>
                  <button
                    style={{ ...styles.toastRedeBtn, background: "#25D366" }}
                    onClick={() => compartilharWhatsapp(ultimoTreinoConcluido)}
                  >
                    💬 WhatsApp
                  </button>
                  <button
                    style={{ ...styles.toastRedeBtn, background: "#1877F2" }}
                    onClick={() => compartilharFacebook(ultimoTreinoConcluido)}
                  >
                    📘 Facebook
                  </button>
                  <button
                    style={{ ...styles.toastRedeBtn, background: "#000000" }}
                    onClick={() => compartilharTwitter(ultimoTreinoConcluido)}
                  >
                    ✕ X / Twitter
                  </button>
                  <button
                    style={{ ...styles.toastRedeBtn, background: "#26A5E4" }}
                    onClick={() => compartilharTelegram(ultimoTreinoConcluido)}
                  >
                    ✈ Telegram
                  </button>
                </div>

                {typeof navigator !== "undefined" && navigator.share && (
                  <button style={styles.toastOpcaoBtn} onClick={() => compartilharTreino(ultimoTreinoConcluido)}>
                    📤 Mais opções (Instagram e outros apps do celular)
                  </button>
                )}
                <button style={styles.toastOpcaoBtn} onClick={() => copiarTextoTreino(ultimoTreinoConcluido)}>
                  📋 Copiar texto
                </button>

                <button
                  style={styles.toastOkBtn}
                  onClick={() => {
                    setMostrarOpcoesCompartilhar(false);
                    setMensagemSucesso(null);
                  }}
                >
                  OK, fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {feedbackPendente && (
        <FeedbackModal
          onSelecionar={(sentimento) => {
            concluirTreino(feedbackPendente, sentimento);
            setFeedbackPendente(null);
          }}
          onPular={() => {
            concluirTreino(feedbackPendente, null);
            setFeedbackPendente(null);
          }}
        />
      )}

      {dorPendente && (
        <DorModal exercicio={dorPendente.exercicio} onSalvar={salvarDor} onFechar={() => setDorPendente(null)} />
      )}

      {sugestaoTroca && (
        <div style={styles.modalOverlay} onClick={() => setSugestaoTroca(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalClose} onClick={() => setSugestaoTroca(null)} aria-label="Fechar">×</button>
            <div style={styles.eyebrow}>SUGESTÃO</div>
            <h2 style={styles.modalTitle}>Trocar exercício?</h2>
            <p style={styles.modalSubtitle}>
              Sentiu algo em "{sugestaoTroca.nomeAtual}"? "{sugestaoTroca.nomeAlternativo}" trabalha o mesmo grupo muscular e pode ser mais confortável.
            </p>
            <button style={styles.saveButton} onClick={aplicarSugestaoTroca}>Trocar por "{sugestaoTroca.nomeAlternativo}"</button>
            <button style={styles.trocaManterBtn} onClick={() => setSugestaoTroca(null)}>Manter como está</button>
          </div>
        </div>
      )}

      {showPerfis && (
        <PerfilModal
          perfis={perfis}
          perfilAtivoId={perfilAtivoId}
          onTrocar={trocarPerfil}
          onCriar={criarPerfil}
          onApagar={apagarPerfil}
          onRenomear={renomearPerfil}
          onFechar={() => setShowPerfis(false)}
        />
      )}

      {guiadoAtivo && (
        <ModoGuiadoOverlay
          entry={guiadoAtivo}
          onFechar={() => setGuiadoAtivo(null)}
          onAbrirExercicio={(ex) => setExercicioAberto(ex)}
          onConcluirExercicio={(exId) => {
            editarExercicio(guiadoAtivo.dia, exId, "concluido", true);
            setGuiadoAtivo((prev) =>
              prev && {
                ...prev,
                exercicios: prev.exercicios.map((e) => (e.id === exId ? { ...e, concluido: true } : e)),
              }
            );
          }}
          onEditCarga={(exId, serieIndex, valor) => {
            editarCargaSerie(guiadoAtivo.dia, exId, serieIndex, valor);
            setGuiadoAtivo((prev) =>
              prev && {
                ...prev,
                exercicios: prev.exercicios.map((e) => {
                  if (e.id !== exId) return e;
                  const totalSets = e.sets || 1;
                  const atual = e.cargas && e.cargas.length === totalSets ? e.cargas : Array.from({ length: totalSets }, (_, i) => (e.cargas && e.cargas[i]) || e.carga || "");
                  const novas = [...atual];
                  novas[serieIndex] = valor;
                  return { ...e, cargas: novas, carga: novas[0] };
                }),
              }
            );
          }}
        />
      )}

      {onboardingPendente && !splashVisivel && (
        <OnboardingModal
          onConcluir={async (respostas) => {
            setOnboardingPendente(false);
            if (respostas.nivel) setNivelUsuario(respostas.nivel);
            if (respostas.objetivo) setObjetivoUsuario(respostas.objetivo);
            try {
              await window.storage.set("onboarding-perfil", JSON.stringify(respostas));
            } catch (e) {
              // segue mesmo se falhar
            }
            renomearPerfil(perfilAtivoId, respostas.nome);
          }}
        />
      )}

      <div style={styles.tabRowWrapper}>
        <div
          ref={tabRowRef}
          style={styles.tabRow}
          onScroll={() => setShowTabScrollHint(false)}
          onTouchStart={() => setShowTabScrollHint(false)}
          onPointerDown={() => setShowTabScrollHint(false)}
        >
          <button
            ref={(el) => (tabBtnRefs.current["inicio"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "inicio" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("inicio")}
          >
            <span style={styles.tabBtnIcone}>🏠</span>
            Início
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["rotina"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "rotina" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("rotina")}
          >
            <span style={styles.tabBtnIcone}>💪</span>
            Rotina
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["historico"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "historico" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("historico")}
          >
            <span style={styles.tabBtnIcone}>📜</span>
            Histórico
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["notas"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "notas" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("notas")}
          >
            <span style={styles.tabBtnIcone}>📝</span>
            Notas
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["evolucao"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "evolucao" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("evolucao")}
          >
            <span style={styles.tabBtnIcone}>📏</span>
            Avaliação
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["premium"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "premium" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("premium")}
          >
            <span style={styles.tabBtnIcone}>⭐</span>
            Premium
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["sobre"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "sobre" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("sobre")}
          >
            <span style={styles.tabBtnIcone}>ℹ️</span>
            Sobre
          </button>
          <button
            ref={(el) => (tabBtnRefs.current["cross"] = el)}
            style={{ ...styles.tabBtn, ...(activeTab === "cross" ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab("cross")}
          >
            <span style={styles.tabBtnIcone}>🔥</span>
            Cross
          </button>
        </div>
        {showTabScrollHint && (
          <div style={styles.tabScrollHint} aria-hidden="true">
            →
          </div>
        )}
      </div>

      {activeTab === "inicio" && (
        <InicioTab
          perfilAtivoNome={perfilAtivoNome}
          rotina={rotina}
          diasSelecionados={diasSelecionados}
          historico={historico}
          onIrTreino={() => setActiveTab("rotina")}
        />
      )}

      {activeTab === "rotina" && (
        <>
          {avisoSemTreinar && (
            <div style={styles.avisoSemTreinarBox}>
              ⏰ Já faz {avisoSemTreinar} dias que você não conclui um treino. Que tal retomar hoje?
            </div>
          )}

          <input
            type="text"
            value={buscaExercicio}
            onChange={(e) => setBuscaExercicio(e.target.value)}
            placeholder="🔎 Buscar exercício rápido…"
            style={styles.buscaInput}
          />
          {buscaExercicio.trim().length > 0 && (
            <BuscaResultados
              termo={buscaExercicio}
              onAbrir={(ex) => {
                setExercicioAberto(ex);
                setBuscaExercicio("");
              }}
            />
          )}

          <button style={styles.modelosBtn} onClick={() => setShowModelos(true)}>
            🔁 Trocar a semana inteira por um modelo pronto
          </button>

          <button style={styles.exportarRotinaBtn} onClick={exportarRotinaImagem}>
            📄 Exportar rotina como imagem
          </button>

          {mostrarSugestaoDeload && (
            <section style={styles.deloadBox}>
              <div style={styles.deloadTitulo}>💤 {semanasConsistentes} semanas seguidas treinando forte</div>
              <p style={styles.deloadTexto}>
                Que tal uma semana mais leve pra descansar e evitar overtraining? Isso reduz 1 série de cada exercício por essa semana — você pode ajustar de volta quando quiser.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={styles.saveButton} onClick={aplicarSemanaLeve}>Aplicar semana leve</button>
                <button style={styles.trocaManterBtn} onClick={registrarRespostaDeload}>Agora não</button>
              </div>
            </section>
          )}

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
                  onEditCargaSerie={(id, indiceSerie, valor) => editarCargaSerie(d.dia, id, indiceSerie, valor)}
                  onEditCardio={(campo, valor) => editarCardio(d.dia, campo, valor)}
                  onAbrirExercicio={(ex) => setExercicioAberto(ex)}
                  onIniciarDescanso={(descanso, nome) => iniciarDescanso(descanso, nome)}
                  onTrocarExercicio={(id) => trocarExercicio(d.dia, id)}
                  onConcluirTreino={() => setFeedbackPendente(d)}
                  onRegistrarDor={(nome) => setDorPendente({ exercicio: nome, dia: d.dia })}
                  onIniciarGuiado={(d) => setGuiadoAtivo(d)}
                  progressao={progressao}
                  dores={dores}
                  recordes={recordes}
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

      {activeTab === "premium" && <PremiumTab isPremium={isPremium} onVerPlanos={() => setShowPlanos(true)} objetivoUsuario={objetivoUsuario} nivelUsuario={nivelUsuario} />}

      {activeTab === "sobre" && <SobreTab />}

      {activeTab === "cross" && <MassiCrossTab />}
      </div>

      {/* Banner do AdMob — inerte até ter ID configurado e o app estar
          rodando num shell nativo/Capacitor. Não altera o layout atual. */}
      <AdBanner />
    </div>
  );
}

function getDiaHojeNome() {
  const jsDay = new Date().getDay(); // 0=Domingo..6=Sábado
  const indice = (jsDay + 6) % 7; // reindexa pra 0=Segunda...6=Domingo, igual DIAS_SEMANA
  return DIAS_SEMANA[indice];
}

function estimarDuracaoTreinoMin(diaEntry) {
  if (!diaEntry) return 0;
  let minutos = diaEntry.cardio ? diaEntry.cardio.duracao || 0 : 0;
  (diaEntry.exercicios || []).forEach((ex) => {
    const sets = ex.sets || 1;
    const descansoSeg = descansoParaSegundos(ex.descanso);
    minutos += (sets * (45 + descansoSeg)) / 60; // ~45s de execução por série + descanso configurado
  });
  return Math.round(minutos);
}

function estimarDuracaoMinPorRegistro(registro) {
  const base = (registro.totalExercicios || 0) * 6; // média de ~6 min por exercício (séries + descanso)
  const cardio = registro.cardio ? registro.cardio.duracao || 0 : 0;
  return Math.round(base + cardio);
}

const FRASES_MOTIVACIONAIS_INICIO = [
  "Cada treino te deixa mais perto do seu objetivo.",
  "Consistência vale mais que intensidade.",
  "Hoje é um bom dia pra evoluir um pouco mais.",
  "Seu único concorrente é quem você era ontem.",
  "Disciplina é o que sustenta a motivação nos dias difíceis.",
  "Um treino de cada vez constrói o resultado.",
  "Aparecer já é metade da batalha — e você está aqui.",
];

function getFraseDoDiaInicio() {
  const hoje = new Date();
  const semente = hoje.getDate() + hoje.getMonth() * 31;
  return FRASES_MOTIVACIONAIS_INICIO[semente % FRASES_MOTIVACIONAIS_INICIO.length];
}

// ---------- INÍCIO — painel principal ----------
function InicioTab({ perfilAtivoNome, rotina, diasSelecionados, historico, onIrTreino }) {
  const [avaliacoes, setAvaliacoes] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("avaliacoes-evolucao");
        if (res && res.value) setAvaliacoes(JSON.parse(res.value));
      } catch (e) {
        // sem avaliações salvas ainda
      }
    })();
  }, []);

  const diaHoje = getDiaHojeNome();
  const treinoHoje = rotina.find((d) => d.dia === diaHoje);
  const hojeEhDiaDeTreino = diasSelecionados.includes(diaHoje) && treinoHoje && treinoHoje.foco !== "Descanso";

  const streak = calcularStreak(historico);

  const hojeData = new Date();
  const diaSemanaIdx = (hojeData.getDay() + 6) % 7;
  const inicioSemana = new Date(hojeData);
  inicioSemana.setDate(hojeData.getDate() - diaSemanaIdx);
  inicioSemana.setHours(0, 0, 0, 0);
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 7);

  const diasDaSemana = DIAS_SEMANA.map((nomeDia, i) => {
    const dataDia = new Date(inicioSemana);
    dataDia.setDate(inicioSemana.getDate() + i);
    const dataStr = dataDia.toISOString().slice(0, 10);
    return { nomeDia, concluido: historico.some((h) => h.data === dataStr) };
  });

  const historicoSemana = historico.filter((h) => {
    const d = new Date(h.data + "T00:00:00");
    return d >= inicioSemana && d < fimSemana;
  });
  const exerciciosSemana = historicoSemana.reduce((acc, h) => acc + (h.totalExercicios || 0), 0);
  const minutosSemana = historicoSemana.reduce((acc, h) => acc + estimarDuracaoMinPorRegistro(h), 0);

  const dadosPeso = avaliacoes.map((a, i) => ({ indice: i + 1, peso: parseFloat(a.peso) })).filter((d) => !isNaN(d.peso));

  return (
    <div style={styles.crossDarkWrap}>
      <div style={styles.inicioHeader}>
        <div style={styles.inicioAvatar}>{(perfilAtivoNome || "V").charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.inicioSaudacao}>Olá, {perfilAtivoNome} 👋</div>
          <div style={styles.inicioFrase}>{getFraseDoDiaInicio()}</div>
        </div>
        <div style={styles.inicioSino} title="Notificações">🔔</div>
      </div>

      <section style={styles.inicioHeroCard}>
        {hojeEhDiaDeTreino ? (
          <>
            <div style={styles.inicioHeroLabel}>SEU TREINO DE HOJE</div>
            <div style={styles.inicioHeroTitulo}>{treinoHoje.foco}</div>
            <div style={styles.inicioHeroMeta}>
              {treinoHoje.exercicios.length > 0
                ? `${treinoHoje.exercicios.length} exercícios`
                : treinoHoje.cardio
                ? treinoHoje.cardio.tipo
                : ""}
              {estimarDuracaoTreinoMin(treinoHoje) > 0 ? ` • ~${estimarDuracaoTreinoMin(treinoHoje)} min` : ""}
            </div>
            <button style={styles.inicioHeroBtn} onClick={onIrTreino}>COMEÇAR TREINO</button>
          </>
        ) : (
          <>
            <div style={styles.inicioHeroLabel}>HOJE</div>
            <div style={styles.inicioHeroTitulo}>Dia de descanso</div>
            <div style={styles.inicioHeroMeta}>Aproveite pra recuperar — ou dá uma olhada na Rotina pra ver a semana.</div>
            <button style={styles.inicioHeroBtn} onClick={onIrTreino}>VER MINHA ROTINA</button>
          </>
        )}
      </section>

      <div style={styles.inicioCardsGrid}>
        <div style={styles.inicioCard}>
          <div style={styles.inicioCardLabel}>PROGRESSO</div>
          {avaliacoes.length > 0 ? (
            <>
              <div style={styles.inicioCardValor}>{avaliacoes[avaliacoes.length - 1].peso} kg</div>
              <div style={styles.inicioCardSub}>peso mais recente</div>
            </>
          ) : (
            <div style={styles.inicioCardVazio}>Adicione seu peso na aba Avaliação pra acompanhar sua evolução.</div>
          )}
        </div>
        <div style={styles.inicioCard}>
          <div style={styles.inicioCardLabel}>SEQUÊNCIA</div>
          <div style={styles.inicioCardValor}>{streak > 0 ? `🔥 ${streak}` : "—"}</div>
          <div style={styles.inicioCardSub}>
            {streak > 0 ? `dia${streak > 1 ? "s" : ""} treinando` : "treine hoje pra começar"}
          </div>
        </div>
      </div>

      <section style={styles.inicioCard}>
        <div style={styles.inicioCardLabel}>RESUMO SEMANAL</div>
        <div style={styles.inicioSemanaRow}>
          {diasDaSemana.map((d) => (
            <div key={d.nomeDia} style={styles.inicioSemanaDia}>
              <div style={styles.inicioSemanaLabel}>{d.nomeDia.slice(0, 3)}</div>
              <div style={{ ...styles.inicioSemanaCheck, ...(d.concluido ? styles.inicioSemanaCheckOk : {}) }}>
                {d.concluido ? "✓" : "—"}
              </div>
            </div>
          ))}
        </div>
        <div style={styles.inicioResumoLinha}>
          {historicoSemana.length} treino{historicoSemana.length !== 1 ? "s" : ""} • ~{minutosSemana} min • {exerciciosSemana} exercícios concluídos
        </div>
      </section>

      <section style={styles.inicioCard}>
        <div style={styles.inicioCardLabel}>EVOLUÇÃO DO PESO</div>
        {dadosPeso.length >= 2 ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={dadosPeso}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="indice" fontSize={11} stroke={CROSS_TEXT_DIM} />
              <YAxis fontSize={11} stroke={CROSS_TEXT_DIM} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: CROSS_CARD_DARK, border: "none", color: "#fff" }} />
              <Line type="monotone" dataKey="peso" stroke={CROSS_LIME} strokeWidth={2} dot={{ r: 3, fill: CROSS_LIME }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={styles.inicioCardVazio}>
            Registre pelo menos duas avaliações na aba Avaliação pra ver seu gráfico de evolução aqui.
          </div>
        )}
      </section>
    </div>
  );
}


function EvolucaoTab({ onAplicarTreino }) {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [avaliacaoSalva, setAvaliacaoSalva] = useState(false);
  const [erros, setErros] = useState({});
  const [fotos, setFotos] = useState([]);

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
      try {
        const fotosRes = await window.storage.get("fotos-progresso");
        if (fotosRes && fotosRes.value) setFotos(JSON.parse(fotosRes.value));
      } catch (e) {
        // sem fotos salvas ainda
      }
    })();
  }, []);

  const adicionarFoto = async (e) => {
    const arquivo = e.target.files && e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = async () => {
      const nova = { id: uid(), data: new Date().toISOString().slice(0, 10), img: leitor.result };
      const novasFotos = [...fotos, nova];
      setFotos(novasFotos);
      try {
        await window.storage.set("fotos-progresso", JSON.stringify(novasFotos));
      } catch (err) {
        // segue mesmo se falhar
      }
    };
    leitor.readAsDataURL(arquivo);
    e.target.value = "";
  };

  const removerFoto = async (id) => {
    const novasFotos = fotos.filter((f) => f.id !== id);
    setFotos(novasFotos);
    try {
      await window.storage.set("fotos-progresso", JSON.stringify(novasFotos));
    } catch (err) {
      // segue mesmo se falhar
    }
  };

  const validarAvaliacao = () => {
    const novosErros = {};
    if (!peso || isNaN(parseFloat(peso)) || parseFloat(peso) <= 0) {
      novosErros.peso = "Informe um peso válido";
    }
    if (!altura || isNaN(parseFloat(altura)) || parseFloat(altura) <= 0) {
      novosErros.altura = "Informe uma altura válida";
    }
    [
      ["cintura", cintura],
      ["quadril", quadril],
      ["peito", peito],
      ["braco", braco],
      ["coxa", coxa],
    ].forEach(([campo, valor]) => {
      if (valor && (isNaN(parseFloat(valor)) || parseFloat(valor) <= 0)) {
        novosErros[campo] = "Valor inválido";
      }
    });
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const salvarAvaliacao = async () => {
    if (!validarAvaliacao()) return;
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
      setErros({});
      setAvaliacaoSalva(true);
      setTimeout(() => setAvaliacaoSalva(false), 3000);
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
            <input
              type="text"
              inputMode="decimal"
              step="0.1"
              value={peso}
              onChange={(e) => setPeso(normalizarDecimal(e.target.value))}
              style={erros.peso ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
              placeholder="ex: 72,5"
            />
            {erros.peso && <span style={styles.avalErroMsg}>{erros.peso}</span>}
          </label>
          <label style={styles.avalField}>
            Altura (cm) *
            <input
              type="text"
              inputMode="decimal"
              value={altura}
              onChange={(e) => setAltura(normalizarDecimal(e.target.value))}
              style={erros.altura ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
              placeholder="ex: 175"
            />
            {erros.altura && <span style={styles.avalErroMsg}>{erros.altura}</span>}
          </label>
          <label style={styles.avalField}>
            Cintura (cm)
            <input
              type="text"
              inputMode="decimal"
              value={cintura}
              onChange={(e) => setCintura(normalizarDecimal(e.target.value))}
              style={erros.cintura ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
            />
            {erros.cintura && <span style={styles.avalErroMsg}>{erros.cintura}</span>}
          </label>
          <label style={styles.avalField}>
            Quadril (cm)
            <input
              type="text"
              inputMode="decimal"
              value={quadril}
              onChange={(e) => setQuadril(normalizarDecimal(e.target.value))}
              style={erros.quadril ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
            />
            {erros.quadril && <span style={styles.avalErroMsg}>{erros.quadril}</span>}
          </label>
          <label style={styles.avalField}>
            Peito (cm)
            <input
              type="text"
              inputMode="decimal"
              value={peito}
              onChange={(e) => setPeito(normalizarDecimal(e.target.value))}
              style={erros.peito ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
            />
            {erros.peito && <span style={styles.avalErroMsg}>{erros.peito}</span>}
          </label>
          <label style={styles.avalField}>
            Braço (cm)
            <input
              type="text"
              inputMode="decimal"
              value={braco}
              onChange={(e) => setBraco(normalizarDecimal(e.target.value))}
              style={erros.braco ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
            />
            {erros.braco && <span style={styles.avalErroMsg}>{erros.braco}</span>}
          </label>
          <label style={styles.avalField}>
            Coxa (cm)
            <input
              type="text"
              inputMode="decimal"
              value={coxa}
              onChange={(e) => setCoxa(normalizarDecimal(e.target.value))}
              style={erros.coxa ? { ...styles.avalInput, ...styles.avalInputErro } : styles.avalInput}
            />
            {erros.coxa && <span style={styles.avalErroMsg}>{erros.coxa}</span>}
          </label>
        </div>
        {Object.keys(erros).length > 0 && (
          <p style={styles.avalErroResumo}>⚠ Corrija os campos destacados em vermelho acima.</p>
        )}

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

        <button
          style={avaliacaoSalva ? { ...styles.saveButton, ...styles.saveButtonSalvo } : styles.saveButton}
          onClick={salvarAvaliacao}
          disabled={salvando}
        >
          {salvando ? "Salvando..." : avaliacaoSalva ? "✓ Avaliação salva!" : "Salvar avaliação de hoje"}
        </button>
      </section>

      {(peso || ultima) && (
        <section style={styles.card}>
          <div style={styles.cardLabel}>💧 Água recomendada por dia</div>
          <div style={styles.historicoResumoNumero}>{calcularAguaLitros(Number(peso) || (ultima && ultima.peso))} L</div>
          <p style={styles.modalDisclaimer}>
            Estimativa de referência (35 ml por kg de peso corporal). Ajuste conforme clima, intensidade do treino e orientação profissional.
          </p>
        </section>
      )}

      <section style={styles.card}>
        <div style={styles.cardLabel}>📷 Fotos de progresso</div>
        <label style={styles.addItemBtn}>
          + Adicionar foto
          <input type="file" accept="image/*" onChange={adicionarFoto} style={{ display: "none" }} />
        </label>
        {fotos.length > 0 && (
          <div style={styles.fotosGaleria}>
            {[...fotos].reverse().map((f) => (
              <div key={f.id} style={styles.fotoItem}>
                <img src={f.img} alt={`Progresso ${f.data}`} style={styles.fotoImg} />
                <div style={styles.fotoData}>{f.data}</div>
                <button style={styles.removerItemBtn} onClick={() => removerFoto(f.id)}>Remover</button>
              </div>
            ))}
          </div>
        )}
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
                <LineChart data={dadosGrafico} margin={{ left: 8, right: 8, top: 5, bottom: 15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(43,42,40,0.1)" />
                  <XAxis dataKey="data" tick={{ fontSize: 11, fill: PENCIL }} label={{ value: "Data", position: "insideBottom", offset: -5, fontSize: 11, fill: PENCIL }} />
                  <YAxis tick={{ fontSize: 11, fill: PENCIL }} domain={["auto", "auto"]} label={{ value: "Peso (kg)", angle: -90, position: "insideLeft", fontSize: 11, fill: PENCIL }} />
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


function OnboardingModal({ onConcluir }) {
  const [nome, setNome] = useState("");
  const [idade, setIdade] = useState("");
  const [horario, setHorario] = useState("Manhã");
  const [objetivo, setObjetivo] = useState("Hipertrofia");
  const [nivel, setNivel] = useState("Iniciante");
  const [erroNome, setErroNome] = useState(false);

  const confirmar = () => {
    if (!nome.trim()) {
      setErroNome(true);
      return;
    }
    onConcluir({ nome: nome.trim(), idade, horario, objetivo, nivel });
  };

  return (
    <div style={styles.onboardingOverlayNovo}>
      <div style={styles.onboardingCardNovo} onClick={(e) => e.stopPropagation()}>
        <div style={styles.onboardingLogoNovo}>Massi Pro</div>
        <h2 style={styles.onboardingTituloNovo}>Vamos personalizar seu treino</h2>
        <p style={styles.onboardingSubNovo}>Leva 20 segundos — você pode mudar tudo isso depois.</p>

        <div style={styles.onboardingCampoNovo}>
          <div style={styles.onboardingInputWrap(erroNome)}>
            <span style={styles.onboardingIcone}>👤</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErroNome(false);
              }}
              placeholder="Seu nome *"
              style={styles.onboardingInputNovo}
              autoFocus
            />
          </div>
          {erroNome && <span style={styles.avalErroMsg}>Digite seu nome pra continuar</span>}
        </div>

        <div style={styles.onboardingCampoNovo}>
          <div style={styles.onboardingInputWrap(false)}>
            <span style={styles.onboardingIcone}>🎂</span>
            <input
              type="number"
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              placeholder="Sua idade"
              style={styles.onboardingInputNovo}
            />
          </div>
        </div>

        <div style={styles.onboardingCampoNovo}>
          <div style={styles.onboardingInputWrap(false)}>
            <span style={styles.onboardingIcone}>🕐</span>
            <select value={horario} onChange={(e) => setHorario(e.target.value)} style={styles.onboardingSelectNovo}>
              {["Manhã", "Tarde", "Noite", "Varia"].map((h) => (
                <option key={h} value={h}>Costuma treinar de {h.toLowerCase()}</option>
              ))}
            </select>
            <span style={styles.onboardingChevron}>▾</span>
          </div>
        </div>

        <div style={styles.onboardingCampoNovo}>
          <div style={styles.onboardingInputWrap(false)}>
            <span style={styles.onboardingIcone}>🎯</span>
            <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} style={styles.onboardingSelectNovo}>
              {["Hipertrofia", "Emagrecer", "Secar", "Saúde geral"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <span style={styles.onboardingChevron}>▾</span>
          </div>
        </div>

        <div style={styles.onboardingCampoNovo}>
          <div style={styles.onboardingInputWrap(false)}>
            <span style={styles.onboardingIcone}>📈</span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={styles.onboardingSelectNovo}>
              {["Iniciante", "Intermediário", "Avançado"].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span style={styles.onboardingChevron}>▾</span>
          </div>
        </div>

        <button style={styles.onboardingContinuarBtn} onClick={confirmar}>
          Continuar
        </button>
      </div>
    </div>
  );
}

function FeedbackModal({ onSelecionar, onPular }) {
  const opcoes = [
    { emoji: "😫", label: "Difícil" },
    { emoji: "😐", label: "Ok" },
    { emoji: "💪", label: "Bem" },
    { emoji: "🔥", label: "Ótimo" },
  ];
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Como foi o treino?</h2>
        <p style={styles.modalSubtitle}>Seu feedback fica registrado junto com esse treino no histórico.</p>
        <div style={styles.feedbackRow}>
          {opcoes.map((o) => (
            <button key={o.label} style={styles.feedbackBtn} onClick={() => onSelecionar(o.label)}>
              <span style={styles.feedbackEmoji}>{o.emoji}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
        <button style={styles.removerHistoricoBtn} onClick={onPular}>Pular</button>
      </div>
    </div>
  );
}

function BuscaResultados({ termo, onAbrir }) {
  const termoLower = termo.trim().toLowerCase();
  const encontrados = [];
  const vistos = new Set();
  Object.entries(LIBRARY).forEach(([grupo, exercicios]) => {
    exercicios.forEach((ex) => {
      if (!vistos.has(ex.name) && ex.name.toLowerCase().includes(termoLower)) {
        vistos.add(ex.name);
        encontrados.push({ grupo, ...ex });
      }
    });
  });

  if (encontrados.length === 0) {
    return <div style={styles.restNote}>Nenhum exercício encontrado com esse nome.</div>;
  }

  return (
    <div style={styles.buscaResultados}>
      {encontrados.slice(0, 8).map((r) => (
        <button key={r.name} style={styles.buscaResultItem} onClick={() => onAbrir(toExercicio(r))}>
          <span>{r.name}</span>
          <span style={styles.buscaResultGrupo}>{r.grupo}</span>
        </button>
      ))}
    </div>
  );
}

function PerfilModal({ perfis, perfilAtivoId, onTrocar, onCriar, onApagar, onRenomear, onFechar }) {
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState("");

  const iniciarEdicao = (p) => {
    setEditandoId(p.id);
    setNomeEditado(p.nome);
  };

  const confirmarEdicao = () => {
    if (nomeEditado.trim()) onRenomear(editandoId, nomeEditado.trim());
    setEditandoId(null);
  };

  return (
    <div style={styles.modalOverlay} onClick={onFechar}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onFechar} aria-label="Fechar">×</button>
        <div style={styles.eyebrow}>PERFIS</div>
        <h2 style={styles.modalTitle}>Quem está treinando?</h2>
        <p style={styles.modalSubtitle}>Cada perfil tem sua própria rotina, histórico e avaliações. Toque no lápis pra colocar seu nome.</p>

        <div style={styles.perfilLista}>
          {perfis.map((p) =>
            editandoId === p.id ? (
              <div key={p.id} style={styles.perfilItem}>
                <input
                  type="text"
                  value={nomeEditado}
                  onChange={(e) => setNomeEditado(e.target.value)}
                  style={styles.avalInput}
                  autoFocus
                  placeholder="Seu nome"
                />
                <button style={styles.saveButton} onClick={confirmarEdicao}>Salvar</button>
              </div>
            ) : (
              <div key={p.id} style={p.id === perfilAtivoId ? { ...styles.perfilItem, ...styles.perfilItemAtivo } : styles.perfilItem}>
                <button style={styles.perfilNomeBtn} onClick={() => onTrocar(p.id)}>
                  {p.id === perfilAtivoId ? "✓ " : ""}
                  {p.nome}
                </button>
                <button style={styles.perfilEditarBtn} onClick={() => iniciarEdicao(p)} aria-label={`Renomear ${p.nome}`}>
                  ✏️
                </button>
                {p.id !== perfilAtivoId && perfis.length > 1 && (
                  <button style={styles.removerItemBtn} onClick={() => onApagar(p.id)}>Apagar</button>
                )}
              </div>
            )
          )}
        </div>

        <div style={styles.perfilNovoRow}>
          <input
            type="text"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do novo perfil"
            style={styles.avalInput}
          />
          <button
            style={styles.saveButton}
            onClick={() => {
              if (novoNome.trim()) {
                onCriar(novoNome);
                setNovoNome("");
              }
            }}
          >
            + Criar novo perfil
          </button>
        </div>
        <p style={styles.modalDisclaimer}>Trocar de perfil recarrega o app pra carregar os dados certos.</p>
      </div>
    </div>
  );
}

function DorModal({ exercicio, onSalvar, onFechar }) {
  const [nota, setNota] = useState("");
  return (
    <div style={styles.modalOverlay} onClick={onFechar}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onFechar} aria-label="Fechar">×</button>
        <div style={styles.eyebrow}>REGISTRO DE DOR/DESCONFORTO</div>
        <h2 style={styles.modalTitle}>{exercicio}</h2>
        <p style={styles.modalSubtitle}>Descreva rapidamente onde sentiu dor ou desconforto (opcional).</p>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          style={styles.notaTextarea}
          rows={3}
          placeholder="ex: dor no ombro direito ao levantar o peso"
        />
        <button style={styles.saveButton} onClick={() => onSalvar(nota)}>Salvar registro</button>
        <p style={styles.modalDisclaimer}>
          Se a dor persistir ou for intensa, procure orientação de um profissional de saúde antes de continuar treinando esse movimento.
        </p>
      </div>
    </div>
  );
}

const CHAVES_BACKUP = [
  "rotina-treino",
  "historico-treinos",
  "avaliacoes-evolucao",
  "notas-treino",
  "status-premium",
  "dores-exercicios",
  "progressao-exercicios",
  "fotos-progresso",
  "foto-compartilhamento",
  "recordes-pessoais",
  "cross-historico",
  "cross-recordes",
  "cross-desafios-progresso",
];

function ModoGuiadoOverlay({ entry, onFechar, onAbrirExercicio, onEditCarga, onConcluirExercicio }) {
  const [indice, setIndice] = useState(0);
  const [serieAtual, setSerieAtual] = useState(1);
  const [estado, setEstado] = useState("serie"); // "serie" | "descanso" | "treinoConcluido"
  const [restanteSeg, setRestanteSeg] = useState(0);

  const exercicios = entry.exercicios;
  const total = exercicios.length;
  const ex = exercicios[indice];

  // sempre que troca de exercício, reinicia a contagem de séries
  useEffect(() => {
    setSerieAtual(1);
    setEstado("serie");
  }, [indice]);

  // contagem regressiva do descanso, com avanço automático quando zera
  useEffect(() => {
    if (estado !== "descanso") return;
    if (restanteSeg <= 0) {
      const totalSets = ex.sets || 1;
      if (serieAtual < totalSets) {
        setSerieAtual((s) => s + 1);
        setEstado("serie");
      } else if (indice < total - 1) {
        setIndice((i) => i + 1); // reinicia série via effect acima
      } else {
        setEstado("treinoConcluido");
      }
      return;
    }
    const timer = setTimeout(() => setRestanteSeg((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [estado, restanteSeg, serieAtual, ex, indice, total]);

  if (estado === "treinoConcluido") {
    return (
      <div style={styles.guiadoOverlay}>
        <div style={styles.guiadoCorpo}>
          <div style={styles.guiadoNome}>Treino concluído! 🎉</div>
          <p style={styles.guiadoMaquina}>Todos os exercícios e séries foram finalizados.</p>
          <button style={styles.guiadoConcluirBtn} onClick={onFechar}>
            ✓ Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!ex) return null;

  const totalSets = ex.sets || 1;
  const { url: youtubeUrl, canal: isCanalFuncional } = getVideoOuCanalUrl(ex);

  const irParaExercicio = (novoIndice) => {
    setIndice(Math.max(0, Math.min(total - 1, novoIndice)));
  };

  const concluirSerie = () => {
    if (serieAtual >= totalSets) {
      onConcluirExercicio(ex.id);
    }
    setEstado("descanso");
    setRestanteSeg(descansoParaSegundos(ex.descanso));
  };

  return (
    <div style={styles.guiadoOverlay}>
      <div style={styles.guiadoTop}>
        <button style={styles.modalClose} onClick={onFechar} aria-label="Fechar treino guiado">×</button>
        <div style={styles.guiadoProgresso}>
          Exercício {indice + 1} de {total}
        </div>
      </div>

      <div style={styles.guiadoBarraFundo}>
        <div style={{ ...styles.guiadoBarraPreenchida, width: `${((indice + 1) / total) * 100}%` }} />
      </div>

      <div style={styles.guiadoCorpo}>
        <div style={styles.guiadoNome}>{ex.name}</div>
        <div style={styles.guiadoMaquina}>{ex.maquina}</div>

        {estado === "serie" && (
          <>
            <div style={styles.guiadoSeriesReps}>
              Série {serieAtual} de {totalSets} · {ex.reps}
            </div>
            {(() => {
              const cargasAtual = ex.cargas && ex.cargas.length === totalSets ? ex.cargas : Array.from({ length: totalSets }, (_, i) => (ex.cargas && ex.cargas[i]) || ex.carga || "");
              return (
                <div style={styles.guiadoCargaRow}>
                  <span style={styles.guiadoCargaLabel}>Carga desta série:</span>
                  <input
                    type="text"
                    value={cargasAtual[serieAtual - 1] || ""}
                    placeholder="ex: 20kg"
                    onChange={(e) => onEditCarga(ex.id, serieAtual - 1, e.target.value)}
                    style={styles.guiadoCargaInput}
                  />
                </div>
              );
            })()}
            <button style={styles.guiadoVerBtn} onClick={() => window.open(youtubeUrl, "_blank")}>
              {isCanalFuncional ? "▶ Ver exercícios no canal (escolha o seu)" : "▶ Assistir execução no YouTube"}
            </button>
            <button style={styles.guiadoDescansoBtn} onClick={concluirSerie}>
              ✓ Concluí a série — descansar
            </button>
          </>
        )}

        {estado === "descanso" && (
          <>
            <div style={styles.guiadoSeriesReps}>Descansando…</div>
            <div style={styles.guiadoTimerGrande}>{formatarMMSS(restanteSeg)}</div>
            <p style={styles.guiadoMaquina}>
              {serieAtual < totalSets
                ? `Próxima: série ${serieAtual + 1} de ${totalSets}`
                : indice < total - 1
                ? "Depois disso, próximo exercício"
                : "Última série do treino"}
            </p>
            {serieAtual < totalSets && (() => {
              const cargasAtual = ex.cargas && ex.cargas.length === totalSets ? ex.cargas : Array.from({ length: totalSets }, (_, i) => (ex.cargas && ex.cargas[i]) || ex.carga || "");
              const proximaCarga = cargasAtual[serieAtual];
              return proximaCarga ? (
                <p style={styles.guiadoProximaCarga}>Carga da próxima série: {proximaCarga}</p>
              ) : null;
            })()}
            <button style={styles.guiadoVerBtn} onClick={() => setRestanteSeg(0)}>
              Pular descanso
            </button>
          </>
        )}
      </div>

      <div style={styles.guiadoNav}>
        <button
          style={indice === 0 ? styles.guiadoNavBtnDesabilitado : styles.guiadoNavBtn}
          onClick={() => irParaExercicio(indice - 1)}
          disabled={indice === 0}
        >
          ← Anterior
        </button>
        {indice === total - 1 ? (
          <button style={styles.guiadoConcluirBtn} onClick={onFechar}>
            ✓ Encerrar
          </button>
        ) : (
          <button style={styles.guiadoNavBtn} onClick={() => irParaExercicio(indice + 1)}>
            Pular pro próximo →
          </button>
        )}
      </div>
    </div>
  );
}

const DICAS_DIETA = [
  {
    titulo: "Proteína em cada refeição",
    texto: "Inclua uma fonte de proteína (frango, ovos, peixe, leguminosas) em cada refeição principal — ajuda na recuperação muscular e na saciedade.",
  },
  {
    titulo: "Não corte carboidratos antes do treino",
    texto: "Uma fonte de carboidrato de fácil digestão 1-2h antes do treino (banana, aveia, pão integral) melhora seu desempenho e energia.",
  },
  {
    titulo: "Hidratação constante",
    texto: "Beba água ao longo do dia, não só durante o treino. Use a calculadora de água da aba Avaliação como referência.",
  },
  {
    titulo: "Priorize alimentos pouco processados",
    texto: "Troque ultraprocessados por versões mais naturais sempre que possível — frutas em vez de sucos industrializados, por exemplo.",
  },
  {
    titulo: "Sono também é dieta",
    texto: "Dormir mal aumenta a fome e prejudica a recuperação muscular. Tente manter uma rotina de sono regular.",
  },
  {
    titulo: "Ajuste conforme seu objetivo",
    texto: "Hipertrofia pede leve superávit calórico; emagrecimento pede déficit moderado; manutenção da saúde geral pede equilíbrio. Ajuste devagar, sem extremos.",
  },
];

// ---------- Dietas rotativas (Premium) ----------
// O conteúdo das dietas fica em public/dietas.json (arquivo separado, buscado uma
// vez via fetch — assim não pesa o pacote JS do app, mesmo com muitas dietas).
// Formato de cada dieta: título + 2 opções (hipertrofia/emagrecimento), cada uma com 4 refeições.

function PremiumTab({ isPremium, onVerPlanos, objetivoUsuario, nivelUsuario }) {
  const objetivoPadrao = objetivoUsuario === "emagrecer" || objetivoUsuario === "secar" ? "emagrecer" : "hipertrofia";
  const perfilPadrao = nivelUsuario ? nivelUsuario.toLowerCase() : "iniciante";

  const [dietaIndice, setDietaIndice] = useState(0);
  const [dietaCarregada, setDietaCarregada] = useState(false);
  const [objetivoDieta, setObjetivoDieta] = useState(objetivoPadrao);
  const [perfilDieta, setPerfilDieta] = useState(perfilPadrao);
  const [faixaDieta, setFaixaDieta] = useState("18-60");
  const [cliquesHoje, setCliquesHoje] = useState(0);
  const [dietas, setDietas] = useState([]);
  const [alternativasAbertas, setAlternativasAbertas] = useState({}); // { "Café da manhã": true }
  const jaAplicouPadrao = useRef(false);

  useEffect(() => {
    // aplica o objetivo/nível do onboarding assim que chegarem, só uma vez —
    // depois disso a pessoa pode trocar livremente pelos seletores
    if (jaAplicouPadrao.current) return;
    if (objetivoUsuario || nivelUsuario) {
      setObjetivoDieta(objetivoPadrao);
      setPerfilDieta(perfilPadrao);
      jaAplicouPadrao.current = true;
    }
  }, [objetivoUsuario, nivelUsuario]);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const LIMITE_DIARIO = 2;

  useEffect(() => {
    (async () => {
      // busca as dietas só uma vez; o navegador guarda em cache depois disso
      if (isPremium) {
        try {
          const resp = await fetch("/dietas.json");
          if (resp.ok) {
            const dados = await resp.json();
            setDietas(dados.dietas || dados || []);
          }
        } catch (e) {
          // sem conexão ou arquivo ainda não publicado — segue sem dietas
        }
      }
      try {
        const res = await window.storage.get("dieta-indice");
        if (res && res.value !== undefined && res.value !== null) {
          const n = parseInt(res.value, 10);
          if (!isNaN(n)) setDietaIndice(n);
        }
      } catch (e) {
        // primeira vez, começa na dieta 0
      }
      try {
        const cliquesRes = await window.storage.get("dieta-cliques-hoje");
        if (cliquesRes && cliquesRes.value) {
          const salvo = JSON.parse(cliquesRes.value);
          if (salvo.data === hojeStr) setCliquesHoje(salvo.contagem);
        }
      } catch (e) {
        // sem cliques registrados hoje ainda
      }
      setDietaCarregada(true);
    })();
  }, [isPremium]);

  const limiteAtingido = cliquesHoje >= LIMITE_DIARIO;

  const dietasFiltradas = dietas.filter(
    (d) => d.objetivo === objetivoDieta && d.perfil === perfilDieta && (d.faixa_etaria === faixaDieta || faixaDieta === "18-60")
  );

  const proximaDieta = () => {
    if (dietasFiltradas.length === 0 || limiteAtingido) return;
    const novoIndice = (dietaIndice + 1) % dietasFiltradas.length;
    const novaContagem = cliquesHoje + 1;
    setDietaIndice(novoIndice);
    setCliquesHoje(novaContagem);
    setAlternativasAbertas({});
    window.storage.set("dieta-indice", String(novoIndice)).catch(() => {});
    window.storage.set("dieta-cliques-hoje", JSON.stringify({ data: hojeStr, contagem: novaContagem })).catch(() => {});
  };

  const dietaAtual = dietasFiltradas.length > 0 ? dietasFiltradas[dietaIndice % dietasFiltradas.length] : null;

  return (
    <div>
      <section style={styles.card}>
        <div style={styles.cardLabel}>🍽 Sua dieta</div>
        {!isPremium ? (
          <p style={styles.modalDisclaimer}>
            Disponível pra quem assina o Premium — dietas prontas, uma por vez, no seu ritmo.
          </p>
        ) : !dietaCarregada ? null : dietas.length === 0 ? (
          <p style={styles.modalDisclaimer}>Em breve — as dietas ainda estão sendo cadastradas.</p>
        ) : (
          <>
            <p style={styles.modalDisclaimer}>
              Conteúdo educativo — não substitui acompanhamento de um nutricionista.
            </p>

            <div style={styles.dietaOpcoesRow}>
              <button
                style={{ ...styles.dietaOpcaoBtn, ...(objetivoDieta === "hipertrofia" ? styles.dietaOpcaoBtnAtiva : {}) }}
                onClick={() => { setObjetivoDieta("hipertrofia"); setDietaIndice(0); }}
              >
                Hipertrofia
              </button>
              <button
                style={{ ...styles.dietaOpcaoBtn, ...(objetivoDieta === "emagrecer" ? styles.dietaOpcaoBtnAtiva : {}) }}
                onClick={() => { setObjetivoDieta("emagrecer"); setDietaIndice(0); }}
              >
                Emagrecimento
              </button>
            </div>

            <div style={styles.dietaFiltrosRow}>
              <label style={styles.dietaFiltroLabel}>
                Nível
                <select
                  value={perfilDieta}
                  onChange={(e) => { setPerfilDieta(e.target.value); setDietaIndice(0); }}
                  style={styles.dietaFiltroSelect}
                >
                  <option value="iniciante">Iniciante</option>
                  <option value="intermediário">Intermediário</option>
                  <option value="avançado">Avançado</option>
                  <option value="prático">Prático</option>
                </select>
              </label>
              <label style={styles.dietaFiltroLabel}>
                Faixa etária
                <select
                  value={faixaDieta}
                  onChange={(e) => { setFaixaDieta(e.target.value); setDietaIndice(0); }}
                  style={styles.dietaFiltroSelect}
                >
                  <option value="18-60">Todas</option>
                  <option value="18-30">18-30</option>
                  <option value="31-45">31-45</option>
                  <option value="46-60">46-60</option>
                </select>
              </label>
            </div>

            {!dietaAtual ? (
              <p style={styles.modalDisclaimer}>Nenhuma dieta encontrada com esses filtros ainda.</p>
            ) : (
              <div style={styles.dietaCard}>
                <div style={styles.dicaDietaTitulo}>{dietaAtual.nome}</div>
                {dietaAtual.meta_nutricional && (
                  <div style={styles.dietaMacros}>
                    ~{dietaAtual.meta_nutricional.calorias_aprox} kcal · P {dietaAtual.meta_nutricional.proteinas_g}g · C {dietaAtual.meta_nutricional.carboidratos_g}g · G {dietaAtual.meta_nutricional.gorduras_g}g
                  </div>
                )}
                {dietaAtual.refeicoes.map((r) => (
                  <div key={r.nome} style={styles.dietaRefeicao}>
                    <span style={styles.dietaRefeicaoNome}>{r.nome}:</span> {r.opcao_principal}
                    {r.alternativas && r.alternativas.length > 0 && (
                      <>
                        <button
                          style={styles.dietaAltToggle}
                          onClick={() => setAlternativasAbertas((prev) => ({ ...prev, [r.nome]: !prev[r.nome] }))}
                        >
                          {alternativasAbertas[r.nome] ? "▲ ocultar opções" : "▼ ver outras opções"}
                        </button>
                        {alternativasAbertas[r.nome] && (
                          <ul style={styles.dietaAltLista}>
                            {r.alternativas.map((alt, i) => (
                              <li key={i}>{alt}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button style={styles.saveButton} onClick={proximaDieta} disabled={limiteAtingido || !dietaAtual}>
              {limiteAtingido ? "Limite de hoje atingido — volte amanhã" : "🔁 Ver outra dieta"}
            </button>
            {!limiteAtingido && (
              <p style={styles.dietaLimiteTexto}>
                {LIMITE_DIARIO - cliquesHoje} de {LIMITE_DIARIO} trocas disponíveis hoje
              </p>
            )}
          </>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.cardLabel}>★ Dicas gerais de dieta</div>
        <p style={styles.modalDisclaimer}>
          Conteúdo educativo geral, disponível pra todo mundo — não substitui acompanhamento de um nutricionista.
        </p>
        {DICAS_DIETA.map((d) => (
          <div key={d.titulo} style={styles.dicaDietaItem}>
            <div style={styles.dicaDietaTitulo}>{d.titulo}</div>
            <p style={styles.notaTexto}>{d.texto}</p>
          </div>
        ))}
      </section>

      {!isPremium && (
        <section style={styles.card}>
          <div style={styles.cardLabel}>Quer mais?</div>
          <p style={styles.notaTexto}>Assinantes Premium têm acesso a conteúdo extra conforme o app evolui.</p>
          <button style={styles.saveButton} onClick={onVerPlanos}>Ver planos</button>
        </section>
      )}
    </div>
  );
}

function SobreTab() {
  const [mensagemBackup, setMensagemBackup] = useState(null);

  const exportarDados = async () => {
    const dados = {};
    for (const chave of CHAVES_BACKUP) {
      try {
        const res = await window.storage.get(chave);
        if (res && res.value) dados[chave] = res.value;
      } catch (e) {
        // chave sem valor salvo, segue
      }
    }
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `massi-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importarDados = async (e) => {
    const arquivo = e.target.files && e.target.files[0];
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      const dados = JSON.parse(texto);
      for (const chave of CHAVES_BACKUP) {
        if (dados[chave] !== undefined) {
          await window.storage.set(chave, dados[chave]);
        }
      }
      setMensagemBackup("Backup importado! Recarregue o app pra ver os dados atualizados.");
    } catch (err) {
      setMensagemBackup("Não consegui ler esse arquivo de backup. Confira se é o arquivo certo.");
    }
    e.target.value = "";
  };

  return (
    <div>
      <section style={styles.card}>
        <div style={styles.cardLabel}>Sobre o Massi Pro</div>
        <p style={styles.notaTexto}>
          Massi Pro é um app pra ajudar quem está começando a montar e seguir uma rotina de treino de forma simples, com execução guiada, histórico e acompanhamento de evolução — tudo num só lugar.
        </p>
      </section>

      <section style={styles.card}>
        <div style={styles.cardLabel}>Backup dos dados</div>
        <p style={styles.notaTexto}>Exporte um arquivo com sua rotina, histórico, avaliações e notas — ou importe um backup salvo antes.</p>
        <button style={styles.saveButton} onClick={exportarDados}>⬇️ Exportar backup</button>
        <label style={styles.addItemBtn}>
          ⬆️ Importar backup
          <input type="file" accept="application/json" onChange={importarDados} style={{ display: "none" }} />
        </label>
        {mensagemBackup && <p style={styles.modalDisclaimer}>{mensagemBackup}</p>}
      </section>
      <section style={styles.card}>
        <div style={styles.cardLabel}>Termos de uso</div>
        <p style={styles.notaTexto}>
          O conteúdo deste app é educativo e não substitui a orientação de um profissional de educação física, nutricionista ou médico. Use por sua conta e respeite os limites do seu corpo — interrompa qualquer exercício que cause dor.
        </p>
        <p style={styles.notaTexto}>
          Seus dados (rotina, histórico, avaliações e notas) são salvos localmente, no seu próprio navegador/dispositivo.
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
  const { url: videoUrl, especifico: videoEspecifico, canal: isCanalFuncional } = getVideoOuCanalUrl(exercicio);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose} aria-label="Fechar">×</button>
        <div style={styles.eyebrow}>COMO EXECUTAR</div>
        <h2 style={styles.modalTitle}>{exercicio.name}</h2>
        <div style={styles.modalMaquinaTag}>{exercicio.maquina}</div>

        {guia ? (
          <>
            {(videoEspecifico || isCanalFuncional) && (
              <>
                <button
                  style={styles.videoLinkBtn}
                  onClick={() => window.open(videoUrl, "_blank", "noopener,noreferrer")}
                >
                  {videoEspecifico
                    ? `▶ Ver vídeo curto (${exercicio.maquina.toLowerCase()})`
                    : "▶ Ver exercícios no canal (escolha o seu)"}
                </button>
                <div style={styles.videoNote}>
                  {videoEspecifico
                    ? "Vídeo de ~20-30s, específico dessa variação do exercício."
                    : "Sem vídeo específico ainda — escolha o exercício parecido no canal."}
                </div>
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
          <>
            {isCanalFuncional && (
              <>
                <button
                  style={styles.videoLinkBtn}
                  onClick={() => window.open(videoUrl, "_blank", "noopener,noreferrer")}
                >
                  ▶ Ver exercícios no canal (escolha o seu)
                </button>
                <div style={styles.videoNote}>Sem vídeo específico ainda — escolha o exercício parecido no canal.</div>
              </>
            )}
            <p style={styles.modalSubtitle}>Ainda não tenho o passo a passo desse exercício. Peça pra eu adicionar.</p>
          </>
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
        <button style={styles.cronoPrincipalBtn} onClick={acabou ? onFechar : onPausarContinuar}>
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

function ConsistenciaHeatmap({ historico }) {
  const diasTreinados = new Set(historico.map((h) => h.data));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // últimas ~18 semanas, terminando na semana atual, alinhado por domingo
  const TOTAL_SEMANAS = 18;
  const fimSemana = new Date(hoje);
  fimSemana.setDate(fimSemana.getDate() + (6 - fimSemana.getDay()));
  const inicio = new Date(fimSemana);
  inicio.setDate(inicio.getDate() - TOTAL_SEMANAS * 7 + 1);

  const semanas = [];
  let cursor = new Date(inicio);
  for (let s = 0; s < TOTAL_SEMANAS; s++) {
    const dias = [];
    for (let d = 0; d < 7; d++) {
      const chave = cursor.toISOString().slice(0, 10);
      dias.push({ chave, treinado: diasTreinados.has(chave), futuro: cursor > hoje });
      cursor.setDate(cursor.getDate() + 1);
    }
    semanas.push(dias);
  }

  return (
    <div>
      <div style={styles.heatmapGrid}>
        {semanas.map((semana, i) => (
          <div key={i} style={styles.heatmapCol}>
            {semana.map((dia) => (
              <div
                key={dia.chave}
                title={dia.chave}
                style={{
                  ...styles.heatmapCelula,
                  background: dia.futuro ? "transparent" : dia.treinado ? HIGHLIGHT : "rgba(43,42,40,0.08)",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={styles.heatmapLegenda}>
        <span>Menos</span>
        <div style={{ ...styles.heatmapCelula, background: "rgba(43,42,40,0.08)" }} />
        <div style={{ ...styles.heatmapCelula, background: HIGHLIGHT }} />
        <span>Treinou</span>
      </div>
    </div>
  );
}

function HistoricoTab() {
  const [historico, setHistorico] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [dores, setDores] = useState([]);

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
      try {
        const doresRes = await window.storage.get("dores-exercicios");
        if (doresRes && doresRes.value) setDores(JSON.parse(doresRes.value));
      } catch (e) {
        // sem registros de dor ainda
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

  const removerDor = async (id) => {
    const nova = dores.filter((d) => d.id !== id);
    setDores(nova);
    try {
      await window.storage.set("dores-exercicios", JSON.stringify(nova));
    } catch (e) {
      // segue mesmo se falhar
    }
  };

  const totalTreinos = historico.length;
  const ultimos7dias = historico.filter((h) => {
    const dias = (Date.now() - new Date(h.data).getTime()) / 86400000;
    return dias <= 7;
  }).length;
  const streakAtual = calcularStreak(historico);

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
          <div style={styles.historicoResumoItem}>
            <div style={styles.historicoResumoNumero}>{streakAtual}🔥</div>
            <div style={styles.historicoResumoLabel}>dias seguidos</div>
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardLabel}>Conquistas</div>
        <div style={styles.conquistasRow}>
          {CONQUISTAS.map((c) => {
            const desbloqueada = c.tipo === "total" ? totalTreinos >= c.valor : streakAtual >= c.valor;
            return (
              <div key={c.id} style={desbloqueada ? styles.conquistaItem : styles.conquistaItemBloqueada} title={c.label}>
                <div style={styles.conquistaEmoji}>{c.emoji}</div>
                <div style={styles.conquistaLabel}>{c.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardLabel}>Consistência</div>
        <ConsistenciaHeatmap historico={historico} />
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
                  {h.sentimento && <span> • sentiu-se: {h.sentimento}</span>}
                  {h.calorias && <span> • ~{h.calorias} kcal</span>}
                </div>
                <button style={styles.removerHistoricoBtn} onClick={() => removerRegistro(h.id)}>
                  Remover registro
                </button>
              </div>
            </div>
          ))}
      </div>

      {dores.length > 0 && (
        <section style={styles.card}>
          <div style={styles.cardLabel}>⚠️ Registros de dor/desconforto</div>
          <div style={styles.historicoLista}>
            {[...dores].reverse().map((d) => (
              <div key={d.id} style={styles.itemNotaRow}>
                <div style={styles.historicoLinha}>
                  <span>{d.exercicio}</span>
                  <span>{d.data}</span>
                </div>
                {d.nota && <p style={styles.notaTexto}>{d.nota}</p>}
                <button style={styles.removerItemBtn} onClick={() => removerDor(d.id)}>Remover registro</button>
              </div>
            ))}
          </div>
        </section>
      )}
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

// =====================================================================
// MASSI CROSS — treinamento funcional de alta intensidade (WODs)
// Módulo isolado: não usa nem altera nenhum estado das outras abas.
// =====================================================================

const CROSS_EXERCICIOS = [
  { id: "burpee", nome: "Burpee", nivel: "Intermediário", equipamento: "Sem equipamento", musculos: "Corpo inteiro", comoExecutar: "Agache, apoie as mãos no chão, jogue as pernas para trás em prancha, faça uma flexão, volte os pés para perto das mãos e salte esticando os braços para cima." },
  { id: "box-jump", nome: "Box Jump", nivel: "Intermediário", equipamento: "Caixa/plataforma", musculos: "Pernas e glúteos", comoExecutar: "Fique de frente para uma caixa firme, agache levemente e salte com os dois pés para cima dela, aterrissando com os joelhos levemente flexionados. Desça com cuidado, um pé de cada vez." },
  { id: "kettlebell-swing", nome: "Kettlebell Swing", nivel: "Intermediário", equipamento: "Kettlebell", musculos: "Posterior de coxa, glúteo e core", comoExecutar: "Segure o kettlebell com as duas mãos, incline levemente o tronco e balance o peso entre as pernas, depois empurre o quadril à frente para levar o kettlebell até a altura do ombro." },
  { id: "pull-up", nome: "Pull-up", nivel: "Avançado", equipamento: "Barra fixa", musculos: "Costas e bíceps", comoExecutar: "Segure a barra com as mãos afastadas na largura dos ombros, puxe o corpo para cima até o queixo passar da barra e desça com controle." },
  { id: "push-up", nome: "Push-up", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Peito, ombro e tríceps", comoExecutar: "Mantenha o corpo alinhado em prancha, desça o peito em direção ao chão flexionando os cotovelos e empurre de volta até estender os braços." },
  { id: "thruster", nome: "Thruster", nivel: "Avançado", equipamento: "Halteres ou barra", musculos: "Perna, ombro e core", comoExecutar: "Agache com o peso na altura dos ombros e, ao subir, use o impulso das pernas para empurrar o peso acima da cabeça, num movimento só." },
  { id: "double-under", nome: "Double Under", nivel: "Avançado", equipamento: "Corda de pular", musculos: "Panturrilha e ombro", comoExecutar: "Pule corda fazendo a corda passar duas vezes por baixo dos pés a cada salto, com giro de pulso rápido e salto baixo." },
  { id: "mountain-climber", nome: "Mountain Climber", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Core e cardio", comoExecutar: "Em posição de prancha, traga um joelho de cada vez em direção ao peito alternando rapidamente as pernas." },
  { id: "battle-rope", nome: "Battle Rope", nivel: "Intermediário", equipamento: "Corda naval", musculos: "Ombro, braço e core", comoExecutar: "Segure uma extremidade da corda em cada mão e faça ondulações alternadas ou simultâneas, mantendo o core firme." },
  { id: "wall-ball", nome: "Wall Ball", nivel: "Intermediário", equipamento: "Medicine ball", musculos: "Perna, ombro e core", comoExecutar: "Agache segurando a bola na altura do peito e, ao subir, arremesse a bola contra a parede em um alvo, aparando-a na volta." },
  { id: "agachamento-cross", nome: "Agachamento", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Perna e glúteo", comoExecutar: "Pés na largura dos ombros, desça flexionando quadril e joelhos como se fosse sentar, mantendo o peito erguido, e suba controlando o movimento." },
  { id: "corrida-cross", nome: "Corrida", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Cardio e perna", comoExecutar: "Corrida em ritmo constante, ao ar livre ou na esteira, mantendo a postura ereta e a respiração controlada." },
  { id: "remo-cross", nome: "Remo", nivel: "Intermediário", equipamento: "Remo ergômetro", musculos: "Costas, perna e cardio", comoExecutar: "Empurre com as pernas, incline o tronco para trás e puxe a barra até o abdômen, depois retorne na ordem inversa com controle." },
  { id: "situp", nome: "Sit-up", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Abdômen", comoExecutar: "Deitado com os joelhos flexionados, suba o tronco até ficar sentado contraindo o abdômen, e desça com controle." },
  { id: "plank-cross", nome: "Prancha (Plank)", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Core", comoExecutar: "Apoie antebraços e pontas dos pés no chão, mantendo o corpo reto da cabeça aos calcanhares, sem deixar o quadril cair." },
  { id: "jumping-jack", nome: "Polichinelo", nivel: "Iniciante", equipamento: "Sem equipamento", musculos: "Corpo inteiro e cardio", comoExecutar: "Salte abrindo pernas e braços simultaneamente, depois volte à posição inicial em um movimento contínuo." },
];

// Paleta escura própria da Massi Cross (independente do tema claro/escuro do resto do app)
const HERO_TREINO_IMG = "data:image/jpeg;base64,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";

const CROSS_LIME = "#C6FF4D";
const CROSS_BG_DARK = "#0E1013";
const CROSS_CARD_DARK = "#1A1E24";
const CROSS_TEXT_DIM = "#9AA3AE";

const CROSS_EXERCICIOS_INDEX = {};
CROSS_EXERCICIOS.forEach((e) => (CROSS_EXERCICIOS_INDEX[e.nome] = e));

// Preencha aqui os links (formato "https://www.youtube.com/shorts/ID") conforme forem enviados,
// igual já é feito em VIDEOS_CARDIO/VIDEOS_EXERCICIO. Enquanto não tiver o link específico,
// o botão cai automaticamente numa busca do YouTube pela forma correta de execução.
const VIDEOS_CROSS = {};

function getVideoCrossUrl(nomeExercicio) {
  const url = VIDEOS_CROSS[nomeExercicio];
  if (url) return url;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(nomeExercicio + " forma correta como fazer")}`;
}

function getThumbnailCross(nomeExercicio) {
  const url = VIDEOS_CROSS[nomeExercicio];
  if (!url) return null;
  const match = url.match(/(?:shorts\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  const id = match && match[1];
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

function CrossVideoBotao({ nome }) {
  const thumb = getThumbnailCross(nome);
  return (
    <div style={styles.cardioVideoRow}>
      {thumb && (
        <img
          src={thumb}
          alt={`Capa do vídeo de ${nome}`}
          style={styles.exThumb}
          loading="lazy"
          onClick={() => window.open(getVideoCrossUrl(nome), "_blank")}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}
      <button style={styles.guiadoVerBtnMini} onClick={() => window.open(getVideoCrossUrl(nome), "_blank")}>
        ▶ {VIDEOS_CROSS[nome] ? "Assistir execução" : "Ver forma correta no YouTube"}
      </button>
    </div>
  );
}

const CROSS_WODS = [
  { id: "w1", nome: "FULL BODY", tipo: "rounds", rounds: 4, nivel: "Intermediário", duracaoMin: 15, equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Burpee", qtd: "10" }, { exercicio: "Agachamento", qtd: "15" }, { exercicio: "Kettlebell Swing", qtd: "12" }, { exercicio: "Corrida", qtd: "200 m" },
    ] },
  { id: "w2", nome: "CARDIO EXPRESS", tipo: "amrap", duracaoMin: 10, nivel: "Iniciante", equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Polichinelo", qtd: "20" }, { exercicio: "Mountain Climber", qtd: "15" }, { exercicio: "Agachamento", qtd: "10" },
    ] },
  { id: "w3", nome: "TABATA CLÁSSICO", tipo: "tabata", duracaoMin: 4, nivel: "Intermediário", equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Burpee", qtd: "máx. repetições" },
    ] },
  { id: "w4", nome: "FORÇA E CORE", tipo: "fortime", duracaoMin: 20, nivel: "Avançado", equipamento: "Equipamentos básicos", categoria: "Metcon", exercicios: [
      { exercicio: "Thruster", qtd: "21-15-9" }, { exercicio: "Pull-up", qtd: "21-15-9" },
    ] },
  { id: "w5", nome: "EMOM DE PERNA", tipo: "emom", duracaoMin: 12, nivel: "Intermediário", equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Agachamento", qtd: "15" }, { exercicio: "Box Jump", qtd: "10" },
    ] },
  { id: "w6", nome: "RÁPIDO 10", tipo: "amrap", duracaoMin: 10, nivel: "Iniciante", equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Push-up", qtd: "10" }, { exercicio: "Sit-up", qtd: "10" }, { exercicio: "Polichinelo", qtd: "20" },
    ] },
  { id: "w7", nome: "RÁPIDO 15", tipo: "rounds", rounds: 3, duracaoMin: 15, nivel: "Iniciante", equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Agachamento", qtd: "15" }, { exercicio: "Prancha (Plank)", qtd: "30 seg" }, { exercicio: "Mountain Climber", qtd: "20" },
    ] },
  { id: "w8", nome: "RÁPIDO 20", tipo: "fortime", duracaoMin: 20, nivel: "Intermediário", equipamento: "Equipamentos básicos", categoria: "Metcon", exercicios: [
      { exercicio: "Kettlebell Swing", qtd: "50" }, { exercicio: "Wall Ball", qtd: "50" }, { exercicio: "Corrida", qtd: "400 m" },
    ] },
  { id: "w9", nome: "RÁPIDO 30", tipo: "rounds", rounds: 5, duracaoMin: 30, nivel: "Avançado", equipamento: "Academia completa", categoria: "Metcon", exercicios: [
      { exercicio: "Thruster", qtd: "10" }, { exercicio: "Pull-up", qtd: "10" }, { exercicio: "Box Jump", qtd: "10" }, { exercicio: "Remo", qtd: "250 m" },
    ] },
  { id: "w10", nome: "RESISTÊNCIA TOTAL", tipo: "amrap", duracaoMin: 20, nivel: "Avançado", equipamento: "Equipamentos básicos", categoria: "Metcon", exercicios: [
      { exercicio: "Burpee", qtd: "10" }, { exercicio: "Kettlebell Swing", qtd: "15" }, { exercicio: "Double Under", qtd: "30" },
    ] },
  { id: "w11", nome: "PANTERA", tipo: "tabata", duracaoMin: 4, nivel: "Avançado", equipamento: "Sem equipamento", categoria: "Metcon", exercicios: [
      { exercicio: "Mountain Climber", qtd: "máx. repetições" },
    ] },
  { id: "w12", nome: "CONDICIONAMENTO 45", tipo: "fortime", duracaoMin: 45, nivel: "Avançado", equipamento: "Academia completa", categoria: "Metcon", exercicios: [
      { exercicio: "Remo", qtd: "500 m" }, { exercicio: "Thruster", qtd: "30" }, { exercicio: "Pull-up", qtd: "30" }, { exercicio: "Wall Ball", qtd: "30" },
    ] },
  // ---- Força (foco em carga/potência, séries mais curtas) ----
  { id: "w17", nome: "FORÇA DE PERNA", tipo: "rounds", rounds: 5, duracaoMin: 20, nivel: "Avançado", equipamento: "Equipamentos básicos", categoria: "Força", exercicios: [
      { exercicio: "Thruster", qtd: "5" }, { exercicio: "Box Jump", qtd: "5" },
    ] },
  { id: "w18", nome: "FORÇA SUPERIOR", tipo: "rounds", rounds: 5, duracaoMin: 20, nivel: "Avançado", equipamento: "Barra fixa", categoria: "Força", exercicios: [
      { exercicio: "Pull-up", qtd: "5" }, { exercicio: "Push-up", qtd: "10" },
    ] },
  // ---- Benchmarks reais do Cross Training (prescrições clássicas) ----
  { id: "w13", nome: "FRAN", tipo: "fortime", duracaoMin: 15, nivel: "Avançado", equipamento: "Equipamentos básicos", categoria: "Benchmark", famoso: true, exercicios: [
      { exercicio: "Thruster", qtd: "21-15-9" }, { exercicio: "Pull-up", qtd: "21-15-9" },
    ] },
  { id: "w14", nome: "CINDY", tipo: "amrap", duracaoMin: 20, nivel: "Intermediário", equipamento: "Sem equipamento", categoria: "Benchmark", famoso: true, exercicios: [
      { exercicio: "Pull-up", qtd: "5" }, { exercicio: "Push-up", qtd: "10" }, { exercicio: "Agachamento", qtd: "15" },
    ] },
  { id: "w15", nome: "ANNIE", tipo: "fortime", duracaoMin: 20, nivel: "Avançado", equipamento: "Corda de pular", categoria: "Benchmark", famoso: true, exercicios: [
      { exercicio: "Double Under", qtd: "50-40-30-20-10" }, { exercicio: "Sit-up", qtd: "50-40-30-20-10" },
    ] },
  { id: "w16", nome: "HELEN", tipo: "rounds", rounds: 3, duracaoMin: 15, nivel: "Intermediário", equipamento: "Kettlebell", categoria: "Benchmark", famoso: true, exercicios: [
      { exercicio: "Corrida", qtd: "400 m" }, { exercicio: "Kettlebell Swing", qtd: "21" }, { exercicio: "Pull-up", qtd: "12" },
    ] },
];

const CROSS_CATEGORIAS_GRID = [
  { chave: "forca", label: "FORÇA", sub: "Desenvolva sua força", emoji: "🏋️", filtro: (w) => w.categoria === "Força" },
  { chave: "metcon", label: "METCON", sub: "Condicionamento de alta intensidade", emoji: "⚡", filtro: (w) => !w.categoria || w.categoria === "Metcon" },
  { chave: "emom", label: "EMOM", sub: "Exercícios por minuto", emoji: "⏱️", filtro: (w) => w.tipo === "emom" },
  { chave: "amrap", label: "AMRAP", sub: "Máximo de repetições", emoji: "🔁", filtro: (w) => w.tipo === "amrap" },
  { chave: "fortime", label: "FOR TIME", sub: "Complete no menor tempo", emoji: "⏲️", filtro: (w) => w.tipo === "fortime" },
  { chave: "benchmark", label: "BENCHMARK", sub: "Treinos clássicos", emoji: "🏆", filtro: (w) => w.categoria === "Benchmark" },
  { chave: "semequip", label: "SEM EQUIPAMENTO", sub: "Treinos usando apenas o corpo", emoji: "🤸", filtro: (w) => w.equipamento === "Sem equipamento" },
  { chave: "comequip", label: "COM EQUIPAMENTO", sub: "Treinos usando equipamentos", emoji: "🏋️‍♂️", filtro: (w) => w.equipamento !== "Sem equipamento" },
];

const CROSS_DESAFIOS = [
  { id: "d7", nome: "Desafio 7 dias", descricao: "Complete pelo menos um WOD por dia durante 7 dias seguidos.", meta: 7, tipo: "dias-consecutivos", unidade: "dias", emoji: "🗓️" },
  { id: "d30", nome: "Desafio 30 dias", descricao: "Complete pelo menos um WOD por dia durante 30 dias seguidos.", meta: 30, tipo: "dias-consecutivos", unidade: "dias", emoji: "📅" },
  { id: "burpees100", nome: "100 Burpees", descricao: "Acumule 100 burpees, no ritmo que quiser.", meta: 100, tipo: "contagem", unidade: "burpees", emoji: "🔥" },
  { id: "agach500", nome: "500 Agachamentos", descricao: "Acumule 500 agachamentos, no ritmo que quiser.", meta: 500, tipo: "contagem", unidade: "agachamentos", emoji: "🦵" },
  { id: "5km", nome: "5 km", descricao: "Acumule 5 km de corrida ou caminhada.", meta: 5, tipo: "distancia-km", unidade: "km", emoji: "🏃" },
  { id: "resistencia20", nome: "Desafio de resistência", descricao: "Complete 20 WODs no total, no seu ritmo.", meta: 20, tipo: "wods-completados", unidade: "WODs", emoji: "🏆" },
];

function getWodDoDia() {
  const inicio = new Date(2026, 0, 1);
  const hoje = new Date();
  const diaDoAno = Math.max(0, Math.floor((hoje - inicio) / 86400000));
  const indice = diaDoAno % CROSS_WODS.length;
  return { ...CROSS_WODS[indice], numero: 100 + diaDoAno };
}

function formatarTempoCross(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// ---------- Tela de execução do WOD (cronômetro + rounds) ----------
function CrossExecucaoWod({ wod, onFinalizar, onCancelar }) {
  const [pausado, setPausado] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [roundsCompletos, setRoundsCompletos] = useState(0);
  const [finalizado, setFinalizado] = useState(false);

  useEffect(() => {
    if (pausado || finalizado) return undefined;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pausado, finalizado]);

  const duracaoTotalSeg = (wod.duracaoMin || 10) * 60;
  const totalTabataSeg = Math.floor(duracaoTotalSeg / 30) * 30;

  useEffect(() => {
    if (finalizado) return;
    if ((wod.tipo === "amrap" || wod.tipo === "emom") && segundos >= duracaoTotalSeg) {
      setFinalizado(true);
      onFinalizar({ tempoSeg: duracaoTotalSeg, rounds: roundsCompletos });
    }
    if (wod.tipo === "tabata" && segundos >= totalTabataSeg) {
      setFinalizado(true);
      onFinalizar({ tempoSeg: totalTabataSeg, rounds: roundsCompletos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segundos, finalizado]);

  let painelFase = null;
  if (wod.tipo === "emom") {
    const minutoAtual = Math.min(Math.floor(segundos / 60) + 1, wod.duracaoMin);
    const restanteMin = 60 - (segundos % 60);
    const exercicioAtual = wod.exercicios[(minutoAtual - 1) % wod.exercicios.length];
    painelFase = (
      <div style={styles.crossFaseBox}>
        <div style={styles.crossFaseLabel}>Minuto {minutoAtual} de {wod.duracaoMin}</div>
        <div style={styles.crossExercicioAtual}>{exercicioAtual.qtd} {exercicioAtual.exercicio}</div>
        <div style={styles.crossFaseTempo}>{restanteMin}s restantes neste minuto</div>
        <CrossVideoBotao nome={exercicioAtual.exercicio} />
      </div>
    );
  } else if (wod.tipo === "tabata") {
    const cicloSeg = segundos % 30;
    const faseTrabalho = cicloSeg < 20;
    const cicloAtual = Math.min(Math.floor(segundos / 30) + 1, Math.floor(totalTabataSeg / 30));
    painelFase = (
      <div style={styles.crossFaseBox}>
        <div style={styles.crossFaseLabel}>Ciclo {cicloAtual} de {Math.floor(totalTabataSeg / 30)}</div>
        <div style={{ ...styles.crossExercicioAtual, color: faseTrabalho ? HIGHLIGHT : MARGIN_RED }}>
          {faseTrabalho ? "🔥 TRABALHO" : "😮‍💨 DESCANSO"} — {wod.exercicios[0].exercicio}
        </div>
        <div style={styles.crossFaseTempo}>{faseTrabalho ? 20 - cicloSeg : 30 - cicloSeg}s</div>
        <CrossVideoBotao nome={wod.exercicios[0].exercicio} />
      </div>
    );
  } else {
    painelFase = (
      <div style={styles.crossFaseBox}>
        {wod.exercicios.map((ex, i) => (
          <div key={i} style={styles.crossExercicioLinha}>
            <div>• {ex.qtd} {ex.exercicio}</div>
            <CrossVideoBotao nome={ex.exercicio} />
          </div>
        ))}
      </div>
    );
  }

  const mostraRounds = wod.tipo === "rounds" || wod.tipo === "amrap";
  const contagemRegressiva = wod.tipo === "amrap" || wod.tipo === "emom" || wod.tipo === "tabata";
  const tempoExibido = contagemRegressiva
    ? formatarTempoCross(Math.max(0, (wod.tipo === "tabata" ? totalTabataSeg : duracaoTotalSeg) - segundos))
    : formatarTempoCross(segundos);

  return (
    <div>
      <div style={styles.crossExecucaoHeader}>
        <div style={styles.crossExecucaoWodNome}>{wod.nome}</div>
        <div style={styles.crossExecucaoTipo}>{wod.tipo.toUpperCase()}</div>
      </div>
      <div style={styles.crossCronometroGrande}>{tempoExibido}</div>
      {painelFase}
      {mostraRounds && (
        <div style={styles.crossRoundsRow}>
          <button style={styles.crossRoundBtn} onClick={() => setRoundsCompletos((r) => Math.max(0, r - 1))}>−</button>
          <div style={styles.crossRoundsNumero}>{roundsCompletos} rounds</div>
          <button style={styles.crossRoundBtn} onClick={() => setRoundsCompletos((r) => r + 1)}>+</button>
        </div>
      )}
      <div style={styles.crossExecucaoBotoes}>
        <button style={styles.trocaManterBtn} onClick={() => setPausado((p) => !p)}>
          {pausado ? "▶ Retomar" : "⏸ Pausar"}
        </button>
        <button
          style={styles.saveButton}
          onClick={() => {
            if (finalizado) return;
            setFinalizado(true);
            onFinalizar({ tempoSeg: segundos, rounds: roundsCompletos });
          }}
        >
          ✓ Finalizar
        </button>
      </div>
      <button style={styles.removerItemBtn} onClick={onCancelar}>Cancelar treino</button>
    </div>
  );
}

// ---------- Tela principal Massi Cross ----------
function MassiCrossTab() {
  const [tela, setTela] = useState("home");
  const [historico, setHistorico] = useState([]);
  const [recordes, setRecordes] = useState({});
  const [desafiosProgresso, setDesafiosProgresso] = useState({});
  const [wodAtivo, setWodAtivo] = useState(null);
  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [exercicioAberto, setExercicioAberto] = useState(null);
  const [buscaExercicioCross, setBuscaExercicioCross] = useState("");
  const [inputDesafio, setInputDesafio] = useState({});

  const [genObjetivo, setGenObjetivo] = useState("Condicionamento");
  const [genNivel, setGenNivel] = useState("Intermediário");
  const [genDuracao, setGenDuracao] = useState(15);
  const [genEquipamento, setGenEquipamento] = useState("Sem equipamento");
  const [wodGerado, setWodGerado] = useState(null);
  const [categoriaAtual, setCategoriaAtual] = useState(null); // { titulo, lista } — usado pela grade de categorias

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("cross-historico");
        if (res && res.value) setHistorico(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res = await window.storage.get("cross-recordes");
        if (res && res.value) setRecordes(JSON.parse(res.value));
      } catch (e) {}
      try {
        const res = await window.storage.get("cross-desafios-progresso");
        if (res && res.value) setDesafiosProgresso(JSON.parse(res.value));
      } catch (e) {}
    })();
  }, []);

  const wodDoDia = getWodDoDia();

  const atualizarDesafiosAutomaticos = async (hist) => {
    const streak = calcularStreak(hist);
    const totalWods = hist.length;
    setDesafiosProgresso((atual) => {
      const novo = { ...atual };
      CROSS_DESAFIOS.forEach((d) => {
        if (d.tipo === "dias-consecutivos") {
          novo[d.id] = { progresso: Math.min(streak, d.meta), concluido: streak >= d.meta };
        }
        if (d.tipo === "wods-completados") {
          novo[d.id] = { progresso: Math.min(totalWods, d.meta), concluido: totalWods >= d.meta };
        }
      });
      window.storage.set("cross-desafios-progresso", JSON.stringify(novo)).catch(() => {});
      return novo;
    });
  };

  const salvarResultado = async (wod, resultado) => {
    const registro = {
      id: uid(),
      data: new Date().toISOString().slice(0, 10),
      wodId: wod.id || wod.nome,
      wodNome: wod.nome,
      tipo: wod.tipo,
      tempoSeg: resultado.tempoSeg,
      rounds: resultado.rounds,
      nivel: wod.nivel,
    };
    const novoHistorico = [...historico, registro];
    setHistorico(novoHistorico);
    try {
      await window.storage.set("cross-historico", JSON.stringify(novoHistorico));
    } catch (e) {}

    const recAnterior = recordes[registro.wodId];
    let melhorou = false;
    let novoRecorde = recAnterior;
    if (!recAnterior) {
      melhorou = true;
      novoRecorde = { tempoSeg: registro.tempoSeg, rounds: registro.rounds, data: registro.data };
    } else if (wod.tipo === "fortime" || wod.tipo === "rounds") {
      if (registro.tempoSeg < recAnterior.tempoSeg) {
        melhorou = true;
        novoRecorde = { tempoSeg: registro.tempoSeg, rounds: registro.rounds, data: registro.data };
      }
    } else if (wod.tipo === "amrap" || wod.tipo === "tabata") {
      if (registro.rounds > recAnterior.rounds) {
        melhorou = true;
        novoRecorde = { tempoSeg: registro.tempoSeg, rounds: registro.rounds, data: registro.data };
      }
    }
    if (melhorou) {
      const novosRecordes = { ...recordes, [registro.wodId]: novoRecorde };
      setRecordes(novosRecordes);
      try {
        await window.storage.set("cross-recordes", JSON.stringify(novosRecordes));
      } catch (e) {}
    }

    atualizarDesafiosAutomaticos(novoHistorico);

    setUltimoResultado({ registro, anterior: recAnterior, melhorou });
    setWodAtivo(null);
    setTela("resultado");
  };

  const registrarProgressoManual = async (desafio) => {
    const valor = parseFloat((inputDesafio[desafio.id] || "").toString().replace(",", "."));
    if (!valor || valor <= 0) return;
    const atual = desafiosProgresso[desafio.id] || { progresso: 0, concluido: false };
    const novoValor = Math.min(atual.progresso + valor, desafio.meta);
    const novoProgresso = {
      ...desafiosProgresso,
      [desafio.id]: { progresso: novoValor, concluido: novoValor >= desafio.meta },
    };
    setDesafiosProgresso(novoProgresso);
    setInputDesafio((prev) => ({ ...prev, [desafio.id]: "" }));
    try {
      await window.storage.set("cross-desafios-progresso", JSON.stringify(novoProgresso));
    } catch (e) {}
  };

  const gerarWod = () => {
    const candidatos = CROSS_WODS.filter(
      (w) =>
        w.nivel === genNivel &&
        Math.abs(w.duracaoMin - genDuracao) <= 10 &&
        (genEquipamento === "Academia completa" || w.equipamento === genEquipamento || w.equipamento === "Sem equipamento")
    );
    const pool = candidatos.length > 0 ? candidatos : CROSS_WODS.filter((w) => w.nivel === genNivel);
    const escolhido = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : CROSS_WODS[0];
    setWodGerado({ ...escolhido, duracaoMin: genDuracao, objetivoGerado: genObjetivo });
  };

  const totalWodsConcluidos = historico.length;
  const tempoTotalTreinoSeg = historico.reduce((acc, h) => acc + (h.tempoSeg || 0), 0);
  const streakCross = calcularStreak(historico);
  const temposValidos = historico.filter((h) => h.tempoSeg).map((h) => h.tempoSeg);
  const melhorTempoGeral = temposValidos.length > 0 ? Math.min(...temposValidos) : null;
  const desafiosConcluidos = Object.values(desafiosProgresso).filter((d) => d.concluido).length;
  const dadosEvolucao = historico.slice(-10).map((h, i) => ({ treino: i + 1, minutos: Math.round(((h.tempoSeg || 0) / 60) * 10) / 10 }));

  const exercFiltrados = CROSS_EXERCICIOS.filter((e) =>
    e.nome.toLowerCase().includes(buscaExercicioCross.trim().toLowerCase())
  );

  const voltar = () => setTela("home");

  // ---------- WOD ativo (execução) ----------
  if (wodAtivo) {
    return (
      <CrossExecucaoWod
        wod={wodAtivo}
        onCancelar={() => setWodAtivo(null)}
        onFinalizar={(resultado) => salvarResultado(wodAtivo, resultado)}
      />
    );
  }

  // ---------- Resultado ----------
  if (tela === "resultado" && ultimoResultado) {
    const { registro, anterior, melhorou } = ultimoResultado;
    let comparacao = null;
    if (anterior) {
      if (registro.tipo === "fortime" || registro.tipo === "rounds") {
        const diff = anterior.tempoSeg - registro.tempoSeg;
        const pct = anterior.tempoSeg > 0 ? Math.round((diff / anterior.tempoSeg) * 100) : 0;
        comparacao = diff > 0
          ? `⚡ Você foi ${pct}% mais rápido que seu último resultado!`
          : diff < 0
          ? `Seu último tempo foi ${formatarTempoCross(anterior.tempoSeg)} — continue treinando!`
          : "Você repetiu exatamente o seu último tempo!";
      } else if (registro.tipo === "amrap" || registro.tipo === "tabata") {
        const diff = registro.rounds - anterior.rounds;
        comparacao = diff > 0
          ? `⚡ Você fez ${diff} round(s) a mais que da última vez!`
          : diff < 0
          ? `Da última vez você fez ${anterior.rounds} rounds — continue treinando!`
          : "Você repetiu exatamente o resultado anterior!";
      }
    }
    return (
      <div>
        <div style={styles.crossResultadoEmoji}>🏆 WOD CONCLUÍDO!</div>
        <div style={styles.crossResultadoTempo}>{formatarTempoCross(registro.tempoSeg)}</div>
        {(registro.tipo === "rounds" || registro.tipo === "amrap" || registro.tipo === "tabata") && (
          <div style={styles.crossResultadoDetalhe}>{registro.rounds} ROUNDS</div>
        )}
        <div style={styles.crossResultadoDetalhe}>{registro.wodNome}</div>
        {melhorou && !comparacao && (
          <div style={styles.crossResultadoComparacao}>🏅 Novo recorde pessoal nesse WOD!</div>
        )}
        {comparacao && <div style={styles.crossResultadoComparacao}>{comparacao}</div>}
        <button style={styles.saveButton} onClick={voltar}>Voltar pra Massi Cross</button>
      </div>
    );
  }

  // ---------- Biblioteca de exercícios ----------
  if (tela === "biblioteca") {
    if (exercicioAberto) {
      return (
        <div>
          <button style={styles.crossVoltarBtn} onClick={() => setExercicioAberto(null)}>← Voltar</button>
          <section style={styles.card}>
            <div style={styles.cardLabel}>{exercicioAberto.nome}</div>
            <CrossVideoBotao nome={exercicioAberto.nome} />
            <div style={styles.crossExercicioDetalheLabel}>Como executar</div>
            <div style={styles.crossExercicioDetalheValor}>{exercicioAberto.comoExecutar}</div>
            <div style={styles.crossExercicioDetalheLabel}>Nível de dificuldade</div>
            <div style={styles.crossExercicioDetalheValor}>{exercicioAberto.nivel}</div>
            <div style={styles.crossExercicioDetalheLabel}>Equipamento necessário</div>
            <div style={styles.crossExercicioDetalheValor}>{exercicioAberto.equipamento}</div>
            <div style={styles.crossExercicioDetalheLabel}>Músculos/regiões trabalhadas</div>
            <div style={styles.crossExercicioDetalheValor}>{exercicioAberto.musculos}</div>
          </section>
        </div>
      );
    }
    return (
      <div>
        <button style={styles.crossVoltarBtn} onClick={voltar}>← Voltar</button>
        <input
          type="text"
          value={buscaExercicioCross}
          onChange={(e) => setBuscaExercicioCross(e.target.value)}
          placeholder="🔎 Buscar exercício…"
          style={styles.buscaInput}
        />
        <div style={styles.crossListaExercicios}>
          {exercFiltrados.map((ex) => (
            <button key={ex.id} style={styles.crossExercicioCard} onClick={() => setExercicioAberto(ex)}>
              <div style={styles.crossExercicioNome}>{ex.nome}</div>
              <div style={styles.crossExercicioMeta}>{ex.nivel} • {ex.equipamento}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Gerador de WOD ----------
  if (tela === "gerador") {
    return (
      <div>
        <button style={styles.crossVoltarBtn} onClick={voltar}>← Voltar</button>
        <section style={styles.card}>
          <div style={styles.cardLabel}>Gerar meu WOD</div>
          <div style={styles.crossGeradorForm}>
            <label style={styles.crossGeradorLabel}>
              Objetivo
              <select style={styles.crossGeradorSelect} value={genObjetivo} onChange={(e) => setGenObjetivo(e.target.value)}>
                {["Condicionamento", "Emagrecimento", "Resistência", "Força"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <label style={styles.crossGeradorLabel}>
              Nível
              <select style={styles.crossGeradorSelect} value={genNivel} onChange={(e) => setGenNivel(e.target.value)}>
                {["Iniciante", "Intermediário", "Avançado"].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label style={styles.crossGeradorLabel}>
              Duração
              <select style={styles.crossGeradorSelect} value={genDuracao} onChange={(e) => setGenDuracao(Number(e.target.value))}>
                {[10, 15, 20, 30, 45].map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </label>
            <label style={styles.crossGeradorLabel}>
              Equipamento
              <select style={styles.crossGeradorSelect} value={genEquipamento} onChange={(e) => setGenEquipamento(e.target.value)}>
                {["Sem equipamento", "Equipamentos básicos", "Academia completa"].map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </label>
          </div>
          <button style={styles.saveButton} onClick={gerarWod}>Gerar meu WOD</button>
        </section>

        {wodGerado && (
          <section style={styles.crossWodDestaqueCard}>
            <div style={styles.crossWodDestaqueLabel}>SEU WOD — {wodGerado.nome}</div>
            <div style={styles.crossWodDestaqueMeta}>{wodGerado.duracaoMin} minutos • {wodGerado.nivel} • {wodGerado.tipo.toUpperCase()}</div>
            <div style={styles.crossWodDestaqueLista}>
              {wodGerado.exercicios.map((ex, i) => (
                <div key={i} style={styles.crossWodDestaqueItem}>• {ex.qtd} {ex.exercicio}</div>
              ))}
            </div>
            <button style={styles.crossBtnComecar} onClick={() => setWodAtivo(wodGerado)}>COMEÇAR WOD</button>
          </section>
        )}
      </div>
    );
  }

  // ---------- Categoria (grade nova: Força, Metcon, EMOM, AMRAP, For Time, Benchmark, Sem/Com equipamento) ----------
  if (tela === "categoria" && categoriaAtual) {
    return (
      <div>
        <button style={styles.crossVoltarBtn} onClick={voltar}>← Voltar</button>
        <div style={styles.crossSecaoTitulo}>{categoriaAtual.titulo}</div>
        {categoriaAtual.lista.length === 0 ? (
          <div style={styles.restNote}>Nenhum WOD nessa categoria ainda.</div>
        ) : (
          <div style={styles.crossListaExercicios}>
            {categoriaAtual.lista.map((w) => (
              <button key={w.id} style={styles.crossExercicioCard} onClick={() => setWodAtivo(w)}>
                <div style={styles.crossExercicioNome}>{w.famoso ? `🏆 ${w.nome}` : w.nome}</div>
                <div style={styles.crossExercicioMeta}>{w.duracaoMin} min • {w.nivel} • {w.tipo.toUpperCase()} • {w.equipamento}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- Treinos rápidos ----------
  if (tela === "rapidos") {
    return (
      <div>
        <button style={styles.crossVoltarBtn} onClick={voltar}>← Voltar</button>
        <div style={styles.crossListaExercicios}>
          {[10, 15, 20, 30].map((min) => {
            const opcoes = CROSS_WODS.filter((w) => w.duracaoMin === min);
            return opcoes.map((w) => (
              <button key={w.id} style={styles.crossExercicioCard} onClick={() => setWodAtivo(w)}>
                <div style={styles.crossExercicioNome}>{w.nome}</div>
                <div style={styles.crossExercicioMeta}>{w.duracaoMin} min • {w.nivel} • {w.tipo.toUpperCase()}</div>
              </button>
            ));
          })}
        </div>
      </div>
    );
  }

  // ---------- Desafios ----------
  if (tela === "desafios") {
    return (
      <div>
        <button style={styles.crossVoltarBtn} onClick={voltar}>← Voltar</button>
        {CROSS_DESAFIOS.map((d) => {
          const prog = desafiosProgresso[d.id] || { progresso: 0, concluido: false };
          const pct = Math.min(100, Math.round((prog.progresso / d.meta) * 100));
          const manual = d.tipo === "contagem" || d.tipo === "distancia-km";
          return (
            <section key={d.id} style={styles.crossDesafioCard}>
              <div style={styles.crossDesafioNome}>{d.emoji} {d.nome} {prog.concluido && <span style={styles.crossDesafioBadge}>CONCLUÍDO</span>}</div>
              <div style={styles.crossDesafioDescricao}>{d.descricao}</div>
              <div style={styles.crossDesafioBarraFundo}>
                <div style={{ ...styles.crossDesafioBarraPreenchida, width: `${pct}%` }} />
              </div>
              <div style={styles.crossDesafioProgressoTexto}>
                {Math.round(prog.progresso * 10) / 10} / {d.meta} {d.unidade} ({pct}%)
              </div>
              {manual && !prog.concluido && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    type="number"
                    value={inputDesafio[d.id] || ""}
                    onChange={(e) => setInputDesafio((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    placeholder={`+ ${d.unidade}`}
                    style={styles.avalInput}
                  />
                  <button style={styles.trocaManterBtn} onClick={() => registrarProgressoManual(d)}>Registrar</button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  // ---------- Desempenho ----------
  if (tela === "desempenho") {
    return (
      <div>
        <button style={styles.crossVoltarBtn} onClick={voltar}>← Voltar</button>
        <div style={styles.crossDesempenhoGrid}>
          <div style={styles.crossDesempenhoItem}>
            <div style={styles.crossDesempenhoNumero}>{totalWodsConcluidos}</div>
            <div style={styles.crossDesempenhoLabel}>WODs concluídos</div>
          </div>
          <div style={styles.crossDesempenhoItem}>
            <div style={styles.crossDesempenhoNumero}>{formatarTempoCross(tempoTotalTreinoSeg)}</div>
            <div style={styles.crossDesempenhoLabel}>tempo total treinando</div>
          </div>
          <div style={styles.crossDesempenhoItem}>
            <div style={styles.crossDesempenhoNumero}>{streakCross}🔥</div>
            <div style={styles.crossDesempenhoLabel}>dias seguidos</div>
          </div>
          <div style={styles.crossDesempenhoItem}>
            <div style={styles.crossDesempenhoNumero}>{melhorTempoGeral !== null ? formatarTempoCross(melhorTempoGeral) : "—"}</div>
            <div style={styles.crossDesempenhoLabel}>melhor tempo</div>
          </div>
          <div style={styles.crossDesempenhoItem}>
            <div style={styles.crossDesempenhoNumero}>{desafiosConcluidos}</div>
            <div style={styles.crossDesempenhoLabel}>desafios concluídos</div>
          </div>
        </div>

        {dadosEvolucao.length > 1 && (
          <section style={styles.card}>
            <div style={styles.cardLabel}>Evolução (últimos treinos)</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="treino" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="minutos" stroke={MARGIN_RED} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </section>
        )}

        {Object.keys(recordes).length > 0 && (
          <section style={styles.card}>
            <div style={styles.cardLabel}>Recordes pessoais</div>
            {Object.entries(recordes).map(([wodId, r]) => {
              const wodInfo = CROSS_WODS.find((w) => w.id === wodId) || { nome: wodId };
              return (
                <div key={wodId} style={styles.historicoLinha}>
                  <span>{wodInfo.nome}</span>
                  <span>{formatarTempoCross(r.tempoSeg)}{r.rounds ? ` • ${r.rounds} rounds` : ""}</span>
                </div>
              );
            })}
          </section>
        )}

        <section style={styles.card}>
          <div style={styles.cardLabel}>Consistência</div>
          <ConsistenciaHeatmap historico={historico} />
        </section>
      </div>
    );
  }

  // ---------- Home ----------
  return (
    <div style={styles.crossDarkWrap}>
      <div style={styles.crossHeroDark}>
        <div style={styles.crossHeroTituloDark}>Massi <span style={{ color: CROSS_LIME }}>Cross</span></div>
        <div style={styles.crossHeroSubtituloDark}>Supere seus limites. Registre sua evolução.</div>
      </div>

      <section style={styles.crossWodDestaqueCard}>
        <div style={styles.crossWodDestaqueLabel}>🔥 WOD DO DIA</div>
        <div style={styles.crossWodDestaqueNumero}>WOD #{wodDoDia.numero} — {wodDoDia.nome}</div>
        <div style={styles.crossWodDestaqueMeta}>{wodDoDia.duracaoMin} minutos • {wodDoDia.nivel} • {wodDoDia.tipo.toUpperCase()}</div>
        <div style={styles.crossWodDestaqueLista}>
          {wodDoDia.tipo === "rounds" && <div style={styles.crossWodDestaqueItem}>{wodDoDia.rounds} ROUNDS:</div>}
          {wodDoDia.exercicios.map((ex, i) => (
            <div key={i} style={styles.crossWodDestaqueItem}>• {ex.qtd} {ex.exercicio}</div>
          ))}
        </div>
        <button style={styles.crossBtnComecar} onClick={() => setWodAtivo(wodDoDia)}>COMEÇAR WOD</button>
      </section>

      <div style={styles.crossCategoriasGridDark}>
        {CROSS_CATEGORIAS_GRID.map((cat) => (
          <button
            key={cat.chave}
            style={styles.crossCategoriaCardDark}
            onClick={() => {
              setCategoriaAtual({ titulo: cat.label, lista: CROSS_WODS.filter(cat.filtro) });
              setTela("categoria");
            }}
          >
            <div style={styles.crossCategoriaEmojiDark}>{cat.emoji}</div>
            <div style={styles.crossCategoriaLabelDark}>{cat.label}</div>
            <div style={styles.crossCategoriaSubDark}>{cat.sub}</div>
          </button>
        ))}
      </div>

      <div style={styles.crossAtalhosRow}>
        <button style={styles.crossAtalhoBtn} onClick={() => setTela("gerador")}>🧠 Gerar meu WOD</button>
        <button style={styles.crossAtalhoBtn} onClick={() => setTela("biblioteca")}>📚 Biblioteca</button>
        <button style={styles.crossAtalhoBtn} onClick={() => setTela("desafios")}>🏆 Desafios</button>
        <button style={styles.crossAtalhoBtn} onClick={() => setTela("desempenho")}>📊 Desempenho</button>
      </div>
    </div>
  );
}



function getUltimaDorRelacionada(nomeExercicio, dores) {
  if (!dores || dores.length === 0) return null;
  // Prioridade 1: dor registrada nesse exercício exato
  const mesmoExercicio = [...dores]
    .filter((d) => d.exercicio === nomeExercicio)
    .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  if (mesmoExercicio) return { ...mesmoExercicio, mesmoGrupo: false };

  // Prioridade 2: dor registrada em outro exercício do mesmo grupo muscular
  const grupoAtual = GUIA_EXECUCAO[nomeExercicio] && GUIA_EXECUCAO[nomeExercicio].grupoMuscular;
  if (!grupoAtual) return null;
  const gruposAtuais = grupoAtual.split(",").map((g) => g.trim().toLowerCase());

  const mesmoGrupo = [...dores]
    .filter((d) => {
      if (d.exercicio === nomeExercicio) return false;
      const grupoOutro = GUIA_EXECUCAO[d.exercicio] && GUIA_EXECUCAO[d.exercicio].grupoMuscular;
      if (!grupoOutro) return false;
      const gruposOutro = grupoOutro.split(",").map((g) => g.trim().toLowerCase());
      return gruposAtuais.some((g) => gruposOutro.includes(g));
    })
    .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  return mesmoGrupo ? { ...mesmoGrupo, mesmoGrupo: true } : null;
}

function DayCard({ entry, onFoco, onAddExercicio, onRemoveExercicio, onEditExercicio, onEditCargaSerie, onEditCardio, onAbrirExercicio, onIniciarDescanso, onTrocarExercicio, onConcluirTreino, onRegistrarDor, onIniciarGuiado, progressao, dores, recordes }) {
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
            <div style={styles.cardioVideoRow}>
              {(() => {
                const thumb = getThumbnailCardio(cardio.tipo);
                return thumb ? (
                  <img
                    src={thumb}
                    alt={`Capa do vídeo de ${cardio.tipo}`}
                    style={styles.exThumb}
                    loading="lazy"
                    onClick={() => window.open(getVideoCardioUrl(cardio.tipo), "_blank")}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                ) : null;
              })()}
              <button
                style={styles.guiadoVerBtnMini}
                onClick={() => window.open(getVideoCardioUrl(cardio.tipo), "_blank")}
              >
                ▶ {VIDEOS_CARDIO[cardio.tipo] ? "Assistir execução" : "Ver forma correta no YouTube"}
              </button>
            </div>
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
            <div style={styles.aquecimentoBox}>
              🔥 Aquecimento sugerido: 5 min de cardio leve + mobilidade articular antes da primeira série.
            </div>
            {exercicios.map((ex) => (
              <div key={ex.id} style={ex.concluido ? { ...styles.exRow, ...styles.exRowConcluido } : styles.exRow}>
                <div style={styles.exHeaderNovo}>
                  <button
                    style={styles.exRingWrap(ex.concluido)}
                    onClick={() => onEditExercicio(ex.id, "concluido", !ex.concluido)}
                    aria-label={ex.concluido ? `Marcar ${ex.name} como não concluído` : `Marcar ${ex.name} como concluído`}
                    title={ex.concluido ? "Concluído — toque para desmarcar" : "Marcar como concluído"}
                  >
                    <span style={styles.exRingInner}>{ex.concluido ? "✓" : ""}</span>
                  </button>
                  <button
                    style={styles.exNameBtnGrande}
                    onClick={() => onAbrirExercicio(ex)}
                    aria-label={`Ver como executar ${ex.name}`}
                  >
                    {ex.name}
                  </button>
                  <div style={styles.exAcoesMini}>
                    <button
                      style={styles.exAcaoMiniBtn}
                      onClick={() => onRegistrarDor(ex.name)}
                      aria-label={`Registrar dor ou desconforto em ${ex.name}`}
                      title="Registrar dor/desconforto"
                    >
                      ⚠️
                    </button>
                    <button onClick={() => onRemoveExercicio(ex.id)} style={styles.exAcaoMiniBtn} aria-label={`Remover ${ex.name}`} title="Remover exercício">
                      ×
                    </button>
                  </div>
                </div>

                {(() => {
                  const ultimaDor = getUltimaDorRelacionada(ex.name, dores);
                  if (!ultimaDor) return null;
                  return (
                    <div style={styles.dorAlertBox}>
                      ⚠️ {ultimaDor.mesmoGrupo
                        ? `Dor registrada recentemente em "${ultimaDor.exercicio}" (mesmo grupo muscular)`
                        : "Você já registrou dor/desconforto nesse exercício antes"}
                      {" "}— {new Date(ultimaDor.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      {ultimaDor.nota ? `: "${ultimaDor.nota}"` : ""}
                    </div>
                  );
                })()}

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

                {(() => {
                  const thumb = getThumbnailExercicio(ex);
                  if (!thumb) return null;
                  return (
                    <div style={styles.cardioVideoRow}>
                      <img
                        src={thumb}
                        alt={`Capa do vídeo de ${ex.name}`}
                        style={styles.exThumb}
                        loading="lazy"
                        onClick={() => onAbrirExercicio(ex)}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <button style={styles.trocarBtn} onClick={() => onTrocarExercicio(ex.id)} title="Trocar exercício">
                        🔄 Trocar
                      </button>
                    </div>
                  );
                })()}

                <div style={styles.novoCamposRow}>
                  <div style={styles.novoCampoBloco}>
                    <span style={styles.novoCampoLabel}>Séries</span>
                    <div style={styles.setsStepperNovo}>
                      <button
                        type="button"
                        onClick={() => onEditExercicio(ex.id, "sets", Math.max(1, (Number(ex.sets) || 1) - 1))}
                        style={styles.stepperBtnNovo}
                        aria-label={`Diminuir número de séries de ${ex.name}`}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={ex.sets}
                        min={1}
                        max={10}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => onEditExercicio(ex.id, "sets", e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          onEditExercicio(ex.id, "sets", Number.isFinite(v) && v > 0 ? Math.min(10, v) : 1);
                        }}
                        style={styles.numMiniNovo}
                      />
                      <button
                        type="button"
                        onClick={() => onEditExercicio(ex.id, "sets", Math.min(10, (Number(ex.sets) || 0) + 1))}
                        style={styles.stepperBtnNovo}
                        aria-label={`Aumentar número de séries de ${ex.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div style={styles.novoCampoBloco}>
                    <span style={styles.novoCampoLabel}>Repetições</span>
                    <input
                      type="text"
                      value={ex.reps}
                      onChange={(e) => onEditExercicio(ex.id, "reps", e.target.value)}
                      style={styles.novoInputBox}
                    />
                  </div>
                </div>

                <div style={styles.cargaSeriesBox}>
                  <div style={styles.cargaSeriesTitulo}>
                    Carga por série
                    {recordes && recordes[ex.name] && (
                      <span style={styles.recordeTag}>🏆 Recorde: {recordes[ex.name].texto}</span>
                    )}
                    {progressao && progressao[ex.name] > 0 && progressao[ex.name] % 3 === 0 && (
                      <span style={styles.progressaoTag}>🔺 Hora de aumentar a carga</span>
                    )}
                  </div>
                  <div style={styles.cargaSeriesGrid}>
                    {Array.from({ length: ex.sets || 1 }, (_, i) => {
                      const cargasAtual = ex.cargas && ex.cargas.length === (ex.sets || 1) ? ex.cargas : Array.from({ length: ex.sets || 1 }, (_, j) => (ex.cargas && ex.cargas[j]) || ex.carga || "");
                      return (
                        <div key={i} style={styles.cargaSerieItem}>
                          <span style={styles.cargaSerieNum}>Série {i + 1}</span>
                          <input
                            type="text"
                            value={cargasAtual[i] || ""}
                            placeholder="ex: 20kg"
                            onChange={(e) => onEditCargaSerie(ex.id, i, e.target.value)}
                            style={styles.novoInputBox}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={styles.cargaSeriesDica}>
                    Diferente em cada série? Ajuste aqui — no treino guiado, a carga certa aparece automaticamente quando você mudar de série.
                  </div>
                </div>

                <div style={styles.novoRodapeRow}>
                  <div style={styles.novoCampoBloco}>
                    <span style={styles.novoCampoLabel}>DESCANSO</span>
                    <div style={styles.novoDescansoBox}>
                      <select
                        value={ex.descanso}
                        onChange={(e) => onEditExercicio(ex.id, "descanso", e.target.value)}
                        style={styles.novoDescansoSelect}
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
                  <button
                    style={styles.trocarToggleNovo}
                    onClick={() => onTrocarExercicio(ex.id)}
                    aria-label={`Trocar ${ex.name} por outro exercício`}
                    title="Trocar exercício"
                  >
                    <span>Trocar</span>
                    <span style={styles.trocarToggleKnob}>
                      <span style={styles.trocarToggleBall} />
                    </span>
                  </button>
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

        {!isDescanso && exercicios.length > 0 && (
          <button style={styles.guiadoBtn} onClick={() => onIniciarGuiado(entry)}>
            ▶ Iniciar treino guiado
          </button>
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

const INK = "var(--ink)";
const PAPER = "var(--paper)";
const PAPER_ALT = "var(--paper-alt)";
const MARGIN_RED = "#1CA7E0";
const PENCIL = "var(--pencil)";
const HIGHLIGHT = "#7ED957";
const GRAPHITE = "#131A1D";
const TEXTO_CLARO_FIXO = "#F6F7F9";

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
  headerBotoesDireita: { display: "flex", alignItems: "center", gap: 8 },
  temaBtn: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: `1px solid rgba(255,255,255,0.3)`,
    background: "rgba(255,255,255,0.08)",
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  perfilHeaderBtn: {
    height: 34,
    padding: "0 12px",
    borderRadius: 17,
    border: `1px solid rgba(255,255,255,0.3)`,
    background: "rgba(255,255,255,0.08)",
    color: TEXTO_CLARO_FIXO,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    maxWidth: 130,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
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
  saudacaoNome: {
    margin: "0 0 4px",
    color: HIGHLIGHT,
    fontFamily: monoFont,
    fontSize: 22,
    fontWeight: 800,
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
  cardLabel: { fontWeight: 600, fontSize: 14, marginBottom: 10, color: INK },
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
  chipActive: { background: GRAPHITE, color: TEXTO_CLARO_FIXO, borderColor: GRAPHITE },
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
  exportarRotinaBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: `1px dashed ${HIGHLIGHT}`,
    background: "rgba(126,217,87,0.08)",
    color: "#3F7A1E",
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
    marginBottom: 16,
  },
  objetivoCard: {
    textAlign: "left",
    border: `1px solid rgba(43,42,40,0.18)`,
    borderRadius: 12,
    padding: "14px 16px",
    background: PAPER,
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
    color: INK,
    background: "rgba(217,164,65,0.22)",
    border: `1px solid rgba(217,164,65,0.55)`,
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 18,
  },
  dayList: { display: "flex", flexDirection: "column", gap: 14 },
  dayCard: {
    display: "flex",
    background: PAPER,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(18,21,26,0.06), 0 8px 24px -12px rgba(18,21,26,0.12)",
    overflow: "hidden",
  },
  dayCardBody: { flex: 1, padding: "18px 18px 20px" },
  dayCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  dayName: { fontFamily: monoFont, fontWeight: 800, fontSize: 16, color: INK, marginBottom: 6, letterSpacing: "-0.01em" },
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
  cardioVideoRow: { display: "flex", alignItems: "center", gap: 10 },
  guiadoVerBtnMini: {
    fontSize: 12,
    fontWeight: 700,
    color: HIGHLIGHT,
    background: "transparent",
    border: `1px solid ${HIGHLIGHT}`,
    borderRadius: 20,
    padding: "6px 12px",
    cursor: "pointer",
  },
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
  exRow: {
    boxSizing: "border-box",
    width: "100%",
    padding: "20px 18px 18px",
    marginBottom: 18,
    borderRadius: 22,
    background: PAPER_ALT,
    border: "1px solid rgba(43,42,40,0.08)",
    boxShadow: "0 1px 2px rgba(18,21,26,0.04), 0 10px 24px -14px rgba(18,21,26,0.14)",
    overflow: "hidden",
  },
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
    color: TEXTO_CLARO_FIXO,
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
    color: INK,
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
  exThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    objectFit: "cover",
    flexShrink: 0,
    cursor: "pointer",
    border: `1px solid rgba(43,42,40,0.14)`,
  },
  exFieldGroup: { display: "flex", alignItems: "center", gap: 4 },
  numMini: { width: 34, fontSize: 13, padding: "4px", borderRadius: 5, border: `1px solid ${PENCIL}`, textAlign: "center" },
  setsStepper: { display: "flex", alignItems: "center", gap: 4 },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: `1px solid ${PENCIL}`,
    background: PAPER,
    color: PENCIL,
    fontSize: 15,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    flexShrink: 0,
  },
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
    zIndex: 700,
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
    color: TEXTO_CLARO_FIXO,
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
    color: TEXTO_CLARO_FIXO,
  },
  cronoBtnRow: { display: "flex", alignItems: "center", gap: 16, marginTop: 32 },
  cronoAjusteBtn: {
    fontFamily: monoFont,
    fontSize: 14,
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid rgba(239,232,216,0.35)`,
    background: "transparent",
    color: TEXTO_CLARO_FIXO,
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
  exConcluidoBtn: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: `2px solid ${HIGHLIGHT}`,
    background: "transparent",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  exRowConcluido: {
    background: "rgba(126,217,87,0.10)",
    borderColor: "rgba(126,217,87,0.4)",
  },

  // ---------- Novo layout do card de exercício (referência: mockup enviado) ----------
  exHeaderNovo: { display: "flex", alignItems: "center", gap: 14, marginBottom: 16 },
  exRingWrap: (concluido) => ({
    width: 56,
    height: 56,
    borderRadius: "50%",
    flexShrink: 0,
    border: "none",
    cursor: "pointer",
    padding: 4,
    background: concluido
      ? `conic-gradient(${HIGHLIGHT} 360deg, rgba(43,42,40,0.12) 0deg)`
      : `conic-gradient(${HIGHLIGHT} 18deg, rgba(43,42,40,0.12) 0deg)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  exRingInner: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: PAPER,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 800,
    color: HIGHLIGHT,
  },
  exNameBtnGrande: {
    flex: 1,
    minWidth: 0,
    textAlign: "left",
    background: "transparent",
    border: "none",
    fontSize: 19,
    fontWeight: 800,
    color: INK,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1.25,
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  exAcoesMini: { display: "flex", gap: 4, flexShrink: 0 },
  exAcaoMiniBtn: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "none",
    background: "rgba(43,42,40,0.06)",
    color: PENCIL,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  novoCamposRow: { display: "flex", gap: 14, marginBottom: 16 },
  novoRodapeRow: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginTop: 4 },
  novoCampoBloco: { flex: 1, minWidth: 0 },
  novoCampoLabel: { display: "block", fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 },
  setsStepperNovo: { display: "flex", alignItems: "center", gap: 8 },
  stepperBtnNovo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "none",
    background: PAPER,
    boxShadow: "0 1px 2px rgba(18,21,26,0.08)",
    color: INK,
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    flexShrink: 0,
  },
  numMiniNovo: {
    width: 40,
    textAlign: "center",
    fontSize: 17,
    fontWeight: 700,
    color: INK,
    border: "none",
    background: "transparent",
  },
  novoInputBox: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(43,42,40,0.18)",
    background: PAPER,
    color: INK,
    fontSize: 15,
  },
  novoDescansoBox: { display: "flex", alignItems: "center", gap: 8 },
  novoDescansoSelect: {
    flex: 1,
    minWidth: 0,
    boxSizing: "border-box",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(43,42,40,0.18)",
    background: PAPER,
    color: INK,
    fontSize: 14.5,
  },
  trocarToggleNovo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    color: INK,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "0 0 9px",
  },
  trocarToggleKnob: {
    width: 40,
    height: 22,
    borderRadius: 20,
    background: "rgba(43,42,40,0.18)",
    position: "relative",
    display: "inline-block",
  },
  trocarToggleBall: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 16,
    height: 16,
    borderRadius: "50%",
    background: PAPER,
    boxShadow: "0 1px 2px rgba(18,21,26,0.25)",
  },

  // ---------- Onboarding — tela inicial com foto (referência: mockup enviado) ----------
  onboardingOverlayNovo: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    boxSizing: "border-box",
    backgroundImage: `linear-gradient(180deg, rgba(10,8,6,0.55) 0%, rgba(10,8,6,0.85) 100%), url(${HERO_TREINO_IMG})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  onboardingCardNovo: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(30,26,22,0.55)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 26,
    padding: "26px 22px",
    boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
    textAlign: "left",
  },
  onboardingLogoNovo: {
    fontWeight: 900,
    fontStyle: "italic",
    fontSize: 28,
    color: "#fff",
    textAlign: "center",
    marginBottom: 18,
    letterSpacing: "-0.02em",
  },
  onboardingTituloNovo: { fontWeight: 800, fontSize: 23, color: "#fff", margin: "0 0 6px", lineHeight: 1.25 },
  onboardingSubNovo: { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.45, margin: "0 0 20px" },
  onboardingCampoNovo: { marginBottom: 13 },
  onboardingInputWrap: (erro) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(255,255,255,0.10)",
    border: erro ? "1px solid #FF8A8A" : "1px solid rgba(255,255,255,0.22)",
    borderRadius: 14,
    padding: "13px 14px",
  }),
  onboardingIcone: { fontSize: 16, flexShrink: 0, opacity: 0.9 },
  onboardingInputNovo: {
    flex: 1,
    minWidth: 0,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: 15,
  },
  onboardingSelectNovo: {
    flex: 1,
    minWidth: 0,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: 14.5,
    appearance: "none",
    WebkitAppearance: "none",
  },
  onboardingChevron: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginLeft: 6, pointerEvents: "none" },
  onboardingContinuarBtn: {
    width: "100%",
    padding: "15px",
    borderRadius: 14,
    border: "none",
    background: "#fff",
    color: "#171310",
    fontWeight: 800,
    fontSize: 15.5,
    letterSpacing: "0.01em",
    cursor: "pointer",
    marginTop: 8,
  },
  recordeToast: {
    position: "fixed",
    top: 14,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 800,
    background: "#1B7A4A",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13,
    padding: "10px 18px",
    borderRadius: 24,
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
    cursor: "pointer",
    maxWidth: "90vw",
    textAlign: "center",
  },
  cargaRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  cargaLabel: { fontSize: 11.5, color: PENCIL },
  cargaInput: {
    width: 90,
    fontFamily: "inherit",
    fontSize: 12.5,
    padding: "5px 8px",
    borderRadius: 7,
    border: `1px solid rgba(43,42,40,0.18)`,
    background: PAPER,
    color: INK,
  },
  exFieldLabeled: { display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" },
  exFieldLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: PENCIL,
    opacity: 0.75,
  },
  cargaSeriesBox: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 10,
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.1)`,
  },
  cargaSeriesTitulo: {
    fontSize: 11.5,
    fontWeight: 800,
    color: PENCIL,
    marginBottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  cargaSeriesGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  cargaSerieItem: { display: "flex", flexDirection: "column", gap: 3 },
  cargaSerieNum: { fontSize: 10.5, color: PENCIL, opacity: 0.8 },
  cargaSeriesDica: {
    fontSize: 10.5,
    color: PENCIL,
    opacity: 0.7,
    marginTop: 8,
    lineHeight: 1.4,
  },
  progressaoTag: {
    fontSize: 11,
    fontWeight: 700,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.18)",
    borderRadius: 6,
    padding: "3px 8px",
  },
  recordeTag: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1B7A4A",
    background: "rgba(31,209,166,0.18)",
    borderRadius: 6,
    padding: "3px 8px",
  },
  trocaManterBtn: {
    marginTop: 8,
    width: "100%",
    background: "transparent",
    border: "none",
    color: PENCIL,
    fontSize: 13,
    textDecoration: "underline",
    cursor: "pointer",
    padding: "8px 0",
  },
  heatmapGrid: { display: "flex", gap: 3, overflowX: "auto", paddingBottom: 4 },
  heatmapCol: { display: "flex", flexDirection: "column", gap: 3 },
  heatmapCelula: { width: 11, height: 11, borderRadius: 3 },
  heatmapLegenda: { display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: PENCIL },
  deloadBox: {
    background: "rgba(28,167,224,0.08)",
    border: "1px solid rgba(28,167,224,0.3)",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 4,
  },
  deloadTitulo: { fontWeight: 800, fontSize: 14, color: INK, marginBottom: 6 },
  deloadTexto: { fontSize: 12.5, color: PENCIL, lineHeight: 1.45, marginBottom: 10 },
  aquecimentoBox: {
    fontSize: 12.5,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.14)",
    border: "1px solid rgba(217,164,65,0.4)",
    borderRadius: 8,
    padding: "9px 11px",
    marginBottom: 10,
    lineHeight: 1.4,
  },
  feedbackRow: { display: "flex", gap: 8, justifyContent: "center", margin: "18px 0 14px" },
  feedbackBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "12px 6px",
    borderRadius: 12,
    border: "1px solid rgba(43,42,40,0.15)",
    background: PAPER,
    fontFamily: "inherit",
    fontSize: 11.5,
    color: INK,
    cursor: "pointer",
  },
  feedbackEmoji: { fontSize: 24 },
  perfilLista: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, textAlign: "left" },
  perfilItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(43,42,40,0.12)",
    background: PAPER,
  },
  perfilItemAtivo: { border: `1.5px solid ${HIGHLIGHT}`, background: "rgba(126,217,87,0.10)" },
  perfilNomeBtn: {
    flex: 1,
    textAlign: "left",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    color: INK,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  perfilEditarBtn: {
    background: "transparent",
    border: "none",
    fontSize: 14,
    cursor: "pointer",
    padding: "4px 6px",
    flexShrink: 0,
  },
  perfilNovoRow: { display: "flex", flexDirection: "column", gap: 8 },
  onboardingField: { marginBottom: 14, textAlign: "left" },
  onboardingLabel: { display: "block", fontSize: 12, color: PENCIL, marginBottom: 5, fontWeight: 600 },
  avisoSemTreinarBox: {
    fontSize: 13,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.18)",
    border: "1px solid rgba(217,164,65,0.5)",
    borderRadius: 10,
    padding: "11px 14px",
    marginBottom: 12,
    fontWeight: 600,
  },
  buscaInput: {
    width: "100%",
    fontFamily: "inherit",
    fontSize: 14,
    padding: "11px 12px",
    borderRadius: 10,
    border: `1px solid ${PENCIL}`,
    background: PAPER,
    color: INK,
    marginBottom: 8,
  },
  buscaResultados: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  buscaResultItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    fontFamily: "inherit",
    fontSize: 13.5,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(43,42,40,0.12)",
    background: PAPER,
    color: INK,
    cursor: "pointer",
    textAlign: "left",
  },
  buscaResultGrupo: { fontSize: 11.5, color: PENCIL },
  dorBtn: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    background: "rgba(217,164,65,0.18)",
    color: "#8A5E12",
    fontSize: 12,
    cursor: "pointer",
    lineHeight: 1,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  dorAlertBox: {
    fontSize: 12,
    color: "#8A5E12",
    background: "rgba(217,164,65,0.14)",
    border: "1px solid rgba(217,164,65,0.35)",
    borderRadius: 8,
    padding: "6px 10px",
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 1.4,
  },
  conquistasRow: { display: "flex", flexWrap: "wrap", gap: 10 },
  conquistaItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    width: 74,
    padding: "8px 4px",
    borderRadius: 10,
    background: "rgba(126,217,87,0.14)",
  },
  conquistaItemBloqueada: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    width: 74,
    padding: "8px 4px",
    borderRadius: 10,
    background: "rgba(43,42,40,0.06)",
    opacity: 0.45,
  },
  conquistaEmoji: { fontSize: 22 },
  conquistaLabel: { fontSize: 10, color: INK, textAlign: "center", lineHeight: 1.2 },
  addBtn: {
    fontFamily: monoFont,
    fontSize: 12.5,
    marginTop: 8,
    padding: "7px 10px",
    borderRadius: 6,
    border: `1px dashed ${PENCIL}`,
    background: "transparent",
    color: INK,
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
  saveButtonSalvo: {
    background: HIGHLIGHT,
    color: GRAPHITE,
  },
  loadingNote: { textAlign: "center", color: PENCIL, fontSize: 12, marginTop: 10 },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(31,30,28,0.55)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 650,
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
  modalTitle: { fontFamily: monoFont, fontSize: 26, fontWeight: 700, color: INK, margin: "4px 0 8px" },
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
    background: PAPER,
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
    color: TEXTO_CLARO_FIXO,
    background: MARGIN_RED,
    padding: "3px 8px",
    borderRadius: 10,
  },
  planNome: { fontFamily: monoFont, fontSize: 13, color: PENCIL, marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" },
  planPreco: { fontSize: 24, fontWeight: 700, color: INK, marginBottom: 2 },
  planPeriodo: { fontSize: 13, fontWeight: 400, color: PENCIL, marginLeft: 3 },
  planTotalNota: { fontSize: 12, color: PENCIL, marginBottom: 10 },
  planBtn: {
    marginTop: 10,
    width: "100%",
    padding: "10px",
    borderRadius: 8,
    border: `1px solid ${GRAPHITE}`,
    background: "transparent",
    color: INK,
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
  avaliacaoSalvaMsg: { fontSize: 12.5, color: "#2E7D32", fontWeight: 700, marginTop: 10, textAlign: "center" },

  tabRowWrapper: {
    position: "relative",
    marginBottom: 18,
    maxWidth: "100%",
  },
  tabRow: {
    display: "flex",
    gap: 4,
    background: CROSS_BG_DARK,
    borderRadius: 14,
    padding: 6,
    maxWidth: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollBehavior: "smooth",
    flexWrap: "nowrap",
  },
  tabScrollHint: {
    position: "absolute",
    top: 6,
    bottom: 6,
    right: 0,
    width: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 6,
    borderRadius: "0 14px 14px 0",
    background: `linear-gradient(to right, transparent, ${CROSS_BG_DARK} 55%)`,
    color: CROSS_TEXT_DIM,
    fontSize: 14,
    fontWeight: 700,
    pointerEvents: "none",
    transition: "opacity 0.25s ease",
  },
  tabBtn: {
    flex: "0 0 auto",
    minWidth: 68,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    fontFamily: monoFont,
    fontSize: 10.5,
    padding: "9px 8px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: CROSS_TEXT_DIM,
    cursor: "pointer",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  tabBtnActive: { background: "rgba(198,255,77,0.1)", color: CROSS_LIME },
  tabBtnIcone: { fontSize: 17, lineHeight: 1 },

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
    color: INK,
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
    background: PAPER,
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(18,21,26,0.06), 0 8px 24px -12px rgba(18,21,26,0.12)",
    overflow: "hidden",
    marginTop: 16,
  },
  resultNome: { fontFamily: monoFont, fontWeight: 800, fontSize: 19, color: INK, marginBottom: 6, letterSpacing: "-0.01em" },
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
  resultSectionTitle: { fontWeight: 700, fontSize: 13, color: INK, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" },
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
  avalField: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: PENCIL, minWidth: 0 },
  avalInput: {
    width: "100%",
    minWidth: 0,
    fontFamily: sansFont,
    fontSize: 14,
    padding: "8px 9px",
    borderRadius: 7,
    border: `1px solid ${PENCIL}`,
    background: PAPER,
    color: INK,
  },
  avalInputErro: {
    border: "1.5px solid #C0392B",
    background: "rgba(192,57,43,0.06)",
  },
  avalErroMsg: { fontSize: 11, color: "#C0392B", fontWeight: 600, marginTop: 2 },
  avalErroResumo: { fontSize: 12.5, color: "#C0392B", fontWeight: 700, marginTop: 8, textAlign: "center" },
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
  guiadoBtn: {
    width: "100%",
    marginTop: 12,
    padding: "11px",
    borderRadius: 10,
    border: "none",
    background: `linear-gradient(90deg, ${MARGIN_RED}, ${HIGHLIGHT})`,
    color: "#0E1214",
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 12.5,
    cursor: "pointer",
  },
  guiadoOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 600,
    background: GRAPHITE,
    display: "flex",
    flexDirection: "column",
    padding: "20px 20px 28px",
  },
  guiadoTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  guiadoProgresso: { fontFamily: monoFont, fontSize: 12, color: "#8b95a1" },
  guiadoBarraFundo: { width: "100%", height: 6, borderRadius: 4, background: "rgba(255,255,255,0.1)", marginBottom: 24 },
  guiadoBarraPreenchida: { height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${MARGIN_RED}, ${HIGHLIGHT})` },
  guiadoCorpo: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" },
  guiadoNome: { fontFamily: monoFont, fontWeight: 800, fontSize: 24, color: "#F6F7F9" },
  guiadoMaquina: { fontSize: 13, color: "#8b95a1" },
  guiadoSeriesReps: { fontFamily: monoFont, fontSize: 16, color: HIGHLIGHT, marginBottom: 10 },
  guiadoCargaRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 },
  guiadoCargaLabel: { fontSize: 12.5, color: "#8b95a1" },
  guiadoCargaInput: {
    width: 100,
    fontFamily: "inherit",
    fontSize: 14,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    textAlign: "center",
  },
  guiadoProximaCarga: { fontSize: 12.5, color: HIGHLIGHT, marginTop: -4, marginBottom: 8 },
  guiadoTimerGrande: { fontFamily: monoFont, fontSize: 56, fontWeight: 800, color: "#F6F7F9", marginBottom: 6 },
  guiadoVerBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    border: `1px solid rgba(255,255,255,0.2)`,
    background: "transparent",
    color: "#F6F7F9",
    fontFamily: monoFont,
    fontSize: 12.5,
    cursor: "pointer",
  },
  guiadoDescansoBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: "rgba(28,167,224,0.18)",
    color: "#7ED9F0",
    fontFamily: monoFont,
    fontSize: 12.5,
    cursor: "pointer",
  },
  guiadoNav: { display: "flex", gap: 10, marginTop: 20 },
  guiadoNavBtn: {
    flex: 1,
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#F6F7F9",
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  guiadoNavBtnDesabilitado: {
    flex: 1,
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.25)",
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 13,
  },
  guiadoConcluirBtn: {
    flex: 1,
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: HIGHLIGHT,
    color: GRAPHITE,
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 13,
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
    color: INK,
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

  toastOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(19,26,29,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    padding: 24,
  },
  toastCard: {
    background: PAPER,
    borderRadius: 18,
    padding: "28px 26px",
    maxWidth: 340,
    textAlign: "center",
    boxShadow: "0 20px 50px -12px rgba(19,26,29,0.4)",
  },
  toastIcone: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: HIGHLIGHT,
    color: GRAPHITE,
    fontSize: 26,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 14px",
  },
  toastTexto: { fontSize: 15, color: INK, lineHeight: 1.45, fontWeight: 600 },
  toastCompartilharBtn: {
    flex: 1,
    padding: "11px",
    borderRadius: 10,
    border: "none",
    background: HIGHLIGHT,
    color: GRAPHITE,
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 12.5,
    cursor: "pointer",
  },
  toastBotoesRow: {
    marginTop: 16,
    display: "flex",
    gap: 8,
  },
  toastOkBtn: {
    flex: 1,
    padding: "11px",
    borderRadius: 10,
    border: `1px solid ${PENCIL}`,
    background: "transparent",
    color: INK,
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 12.5,
    cursor: "pointer",
  },
  toastOpcoesCompartilhar: {
    marginTop: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  toastOpcaoBtn: {
    width: "100%",
    padding: "11px",
    borderRadius: 10,
    border: `1px solid rgba(43,42,40,0.18)`,
    background: PAPER_ALT,
    color: INK,
    fontFamily: monoFont,
    fontWeight: 700,
    fontSize: 12.5,
    cursor: "pointer",
    textAlign: "left",
  },
  toastMarca: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  toastMarcaNome: {
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: 0.5,
    color: INK,
  },
  marcaFotoWrap: {
    position: "relative",
    width: 56,
    height: 56,
  },
  marcaFotoRing: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    backgroundSize: "cover",
    backgroundPosition: "center",
    border: "3px solid transparent",
    backgroundImage: "linear-gradient(#fff,#fff), linear-gradient(135deg, #1CA7E0 0%, #1FD1A6 55%, #8BDB4B 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "content-box, border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  },
  marcaFotoLogoBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 8,
    background: "#131A1D",
    border: "2px solid " + PAPER,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  fotoCompartilharRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  fotoCompartilharBtn: {
    fontSize: 12.5,
    fontWeight: 700,
    color: INK,
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.18)`,
    borderRadius: 20,
    padding: "7px 14px",
    cursor: "pointer",
  },
  fotoCompartilharRemover: {
    fontSize: 12,
    color: MARGIN_RED,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
    padding: "4px 2px",
  },
  fotoCompartilharDica: {
    fontSize: 11,
    color: PENCIL,
    opacity: 0.75,
    textAlign: "center",
    lineHeight: 1.4,
    marginBottom: 4,
  },
  tostPreviewCard: {
    border: `1px solid rgba(43,42,40,0.14)`,
    borderRadius: 12,
    padding: "12px 14px",
    background: PAPER_ALT,
    textAlign: "left",
  },
  toastPreviewLabel: {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: PENCIL,
    marginBottom: 6,
  },
  toastPreviewTexto: {
    fontSize: 13,
    color: INK,
    lineHeight: 1.4,
    fontWeight: 600,
  },
  toastRedesGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  toastRedeBtn: {
    padding: "12px 8px",
    borderRadius: 10,
    border: "none",
    color: "#FFFFFF",
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "center",
  },
  dicaDietaItem: { marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(43,42,40,0.08)" },
  dicaDietaTitulo: { fontWeight: 700, fontSize: 13.5, color: INK, marginBottom: 4 },
  dietaCard: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.1)`,
    borderRadius: 10,
    padding: "14px 16px",
    marginBottom: 12,
  },
  dietaConteudo: { fontSize: 13, color: PENCIL, lineHeight: 1.55, whiteSpace: "pre-line", marginTop: 6 },
  dietaOpcoesRow: { display: "flex", gap: 8, marginBottom: 12 },
  dietaOpcaoBtn: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 20,
    border: `1px solid rgba(43,42,40,0.2)`,
    background: PAPER,
    color: PENCIL,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  dietaOpcaoBtnAtiva: {
    background: HIGHLIGHT,
    borderColor: HIGHLIGHT,
    color: "#0F1417",
  },
  dietaRefeicao: { fontSize: 13, color: PENCIL, lineHeight: 1.55, marginTop: 8 },
  dietaRefeicaoNome: { fontWeight: 700, color: INK },
  dietaLimiteTexto: { fontSize: 11.5, color: PENCIL, opacity: 0.75, textAlign: "center", marginTop: 6 },
  dietaFiltrosRow: { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  dietaFiltroLabel: { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 700, color: PENCIL, flex: 1, minWidth: 120 },
  dietaFiltroSelect: {
    padding: "7px 8px",
    borderRadius: 8,
    border: `1px solid rgba(43,42,40,0.2)`,
    background: PAPER,
    color: INK,
    fontSize: 12.5,
  },
  dietaMacros: { fontSize: 11.5, fontWeight: 700, color: "#1B7A4A", marginBottom: 8 },
  dietaAltToggle: {
    display: "block",
    background: "transparent",
    border: "none",
    color: "#3F7A1E",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    padding: "4px 0",
  },
  dietaAltLista: { margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: PENCIL, lineHeight: 1.6 },
  fotosGaleria: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 },
  fotoItem: { width: 100, textAlign: "center" },
  fotoImg: { width: 100, height: 130, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(43,42,40,0.12)" },
  fotoData: { fontSize: 10.5, color: PENCIL, marginTop: 4 },

  splashOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    background:
      "radial-gradient(120% 90% at 20% 10%, rgba(28,167,224,0.2) 0%, transparent 55%), " +
      "radial-gradient(120% 90% at 85% 90%, rgba(139,219,75,0.2) 0%, transparent 55%), " +
      `linear-gradient(160deg, ${GRAPHITE} 0%, #182226 100%)`,
    transition: "opacity 0.4s ease",
  },
  splashSvg: { width: 190, height: 95 },
  splashWordmark: {
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: "0.16em",
    color: "#F6F7F9",
  },
  splashSubtitulo: {
    fontFamily: sansFont,
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "#8b95a1",
    marginTop: -12,
  },

  // ---------- Massi Cross ----------
  crossHero: {
    borderRadius: 14,
    padding: "20px 18px",
    marginBottom: 14,
    textAlign: "center",
    background: `linear-gradient(135deg, ${GRAPHITE} 0%, #182226 100%)`,
  },
  crossHeroTitulo: {
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 24,
    letterSpacing: "0.08em",
    color: TEXTO_CLARO_FIXO,
  },
  crossHeroSubtitulo: {
    fontSize: 12.5,
    color: "#8b95a1",
    marginTop: 4,
  },
  crossWodDestaqueCard: {
    borderRadius: 14,
    padding: "18px 16px",
    marginBottom: 18,
    color: TEXTO_CLARO_FIXO,
    background: "linear-gradient(135deg, #1CA7E0 0%, #1FD1A6 55%, #8BDB4B 100%)",
  },
  crossWodDestaqueLabel: {
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 12.5,
    letterSpacing: "0.06em",
    marginBottom: 6,
    opacity: 0.92,
  },
  crossWodDestaqueNumero: {
    fontWeight: 800,
    fontSize: 17,
    marginBottom: 4,
  },
  crossWodDestaqueMeta: {
    fontSize: 12.5,
    opacity: 0.92,
    marginBottom: 10,
  },
  crossWodDestaqueLista: { marginBottom: 14 },
  crossWodDestaqueItem: { fontSize: 13.5, fontWeight: 600, lineHeight: 1.6 },
  crossBtnComecar: {
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: GRAPHITE,
    color: "#8BDB4B",
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: "0.05em",
    cursor: "pointer",
  },
  crossSecaoTitulo: { fontWeight: 700, fontSize: 14, color: INK, margin: "6px 0 10px" },
  crossCategoriasGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 18,
  },
  crossCategoriaCard: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.15)`,
    borderRadius: 12,
    padding: "16px 10px",
    textAlign: "center",
    cursor: "pointer",
  },
  crossCategoriaEmoji: { fontSize: 24, marginBottom: 6 },
  crossCategoriaLabel: { fontSize: 12.5, fontWeight: 700, color: INK },
  crossListaExercicios: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  crossExercicioCard: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.15)`,
    borderRadius: 10,
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
  },
  crossExercicioNome: { fontWeight: 700, fontSize: 14, color: INK },
  crossExercicioMeta: { fontSize: 12, color: PENCIL, marginTop: 2 },
  crossExercicioDetalheLabel: { fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: PENCIL, marginTop: 12 },
  crossExercicioDetalheValor: { fontSize: 13.5, color: INK, lineHeight: 1.55, marginTop: 4 },
  crossGeradorForm: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  crossGeradorLabel: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: PENCIL },
  crossGeradorSelect: {
    padding: "9px 8px",
    borderRadius: 8,
    border: `1px solid rgba(43,42,40,0.2)`,
    background: PAPER,
    color: INK,
    fontSize: 13,
  },
  crossExecucaoHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  crossExecucaoWodNome: { fontWeight: 800, fontSize: 16, color: INK },
  crossExecucaoTipo: { fontFamily: monoFont, fontSize: 11, fontWeight: 800, color: MARGIN_RED, letterSpacing: "0.05em" },
  crossCronometroGrande: {
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 52,
    textAlign: "center",
    color: INK,
    margin: "10px 0 16px",
  },
  crossFaseBox: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.15)`,
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 16,
    textAlign: "center",
  },
  crossFaseLabel: { fontSize: 11.5, fontWeight: 800, color: PENCIL, letterSpacing: "0.04em", textTransform: "uppercase" },
  crossExercicioAtual: { fontSize: 17, fontWeight: 800, color: INK, margin: "6px 0" },
  crossFaseTempo: { fontSize: 12.5, color: PENCIL },
  crossExercicioLinha: { fontSize: 14, color: INK, lineHeight: 1.7, textAlign: "left", marginBottom: 10, fontWeight: 700 },
  crossRoundsRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 18 },
  crossRoundBtn: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    background: GRAPHITE,
    color: TEXTO_CLARO_FIXO,
    fontSize: 20,
    fontWeight: 800,
    cursor: "pointer",
  },
  crossRoundsNumero: { fontWeight: 800, fontSize: 15, color: INK, minWidth: 90, textAlign: "center" },
  crossExecucaoBotoes: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 },
  crossResultadoEmoji: { fontSize: 20, fontWeight: 800, textAlign: "center", color: INK, marginTop: 20, marginBottom: 6 },
  crossResultadoTempo: { fontFamily: monoFont, fontWeight: 800, fontSize: 48, textAlign: "center", color: INK, margin: "8px 0" },
  crossResultadoDetalhe: { fontSize: 14, fontWeight: 700, textAlign: "center", color: PENCIL, marginBottom: 4 },
  crossResultadoComparacao: {
    marginTop: 14,
    marginBottom: 18,
    padding: "12px 14px",
    borderRadius: 10,
    background: "rgba(126,217,87,0.14)",
    color: "#3F7A1E",
    fontWeight: 700,
    fontSize: 13.5,
    textAlign: "center",
  },
  crossDesafioCard: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.15)`,
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 12,
  },
  crossDesafioNome: { fontWeight: 800, fontSize: 14.5, color: INK, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  crossDesafioDescricao: { fontSize: 12.5, color: PENCIL, marginBottom: 10 },
  crossDesafioBarraFundo: { height: 8, borderRadius: 6, background: "rgba(43,42,40,0.1)", overflow: "hidden" },
  crossDesafioBarraPreenchida: { height: "100%", borderRadius: 6, background: "linear-gradient(90deg, #1CA7E0, #8BDB4B)" },
  crossDesafioProgressoTexto: { fontSize: 11.5, color: PENCIL, marginTop: 6 },
  crossDesafioBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#3F7A1E",
    background: "rgba(126,217,87,0.18)",
    borderRadius: 6,
    padding: "2px 8px",
  },
  crossDesempenhoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 },
  crossDesempenhoItem: {
    background: PAPER_ALT,
    border: `1px solid rgba(43,42,40,0.15)`,
    borderRadius: 12,
    padding: "14px 10px",
    textAlign: "center",
  },
  crossDesempenhoNumero: { fontWeight: 800, fontSize: 19, color: INK },
  crossDesempenhoLabel: { fontSize: 11, color: PENCIL, marginTop: 2 },
  crossVoltarBtn: {
    background: "transparent",
    border: "none",
    color: MARGIN_RED,
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
    padding: "4px 0",
    marginBottom: 12,
  },

  // ---------- Início (painel principal) ----------
  inicioHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  inicioAvatar: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: CROSS_CARD_DARK,
    color: CROSS_LIME,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
  },
  inicioSaudacao: { fontWeight: 800, fontSize: 17, color: "#fff" },
  inicioFrase: { fontSize: 12, color: CROSS_TEXT_DIM, marginTop: 2 },
  inicioSino: { fontSize: 20, flexShrink: 0 },
  inicioHeroCard: {
    borderRadius: 18,
    padding: "22px 18px 20px",
    marginBottom: 16,
    color: "#fff",
    minHeight: 300,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    backgroundImage: `linear-gradient(to top, rgba(10,12,14,0.95) 8%, rgba(10,12,14,0.35) 50%, rgba(10,12,14,0.05) 85%), url(${HERO_TREINO_IMG})`,
    backgroundSize: "cover",
    backgroundPosition: "center 20%",
  },
  inicioHeroLabel: { fontFamily: monoFont, fontSize: 12, fontWeight: 800, letterSpacing: "0.07em", opacity: 0.9, marginBottom: 6, color: CROSS_LIME },
  inicioHeroTitulo: { fontWeight: 800, fontSize: 24, marginBottom: 6, textShadow: "0 2px 8px rgba(0,0,0,0.5)" },
  inicioHeroMeta: { fontSize: 13, opacity: 0.95, marginBottom: 16, lineHeight: 1.5 },
  inicioHeroBtn: {
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: CROSS_LIME,
    color: "#0E1013",
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 14.5,
    letterSpacing: "0.04em",
    cursor: "pointer",
  },
  inicioCardsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
  inicioCard: {
    background: CROSS_CARD_DARK,
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: "14px 14px",
    minHeight: 92,
    marginBottom: 16,
  },
  inicioCardLabel: { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", color: CROSS_TEXT_DIM },
  inicioCardValor: { fontWeight: 800, fontSize: 20, color: "#fff", marginTop: 6 },
  inicioCardSub: { fontSize: 11, color: CROSS_TEXT_DIM, marginTop: 2 },
  inicioCardVazio: { fontSize: 12, color: CROSS_TEXT_DIM, marginTop: 8, lineHeight: 1.45 },
  inicioSemanaRow: { display: "flex", justifyContent: "space-between", marginBottom: 10, marginTop: 8 },
  inicioSemanaDia: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 },
  inicioSemanaLabel: { fontSize: 10.5, fontWeight: 700, color: CROSS_TEXT_DIM, textTransform: "uppercase" },
  inicioSemanaCheck: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    color: CROSS_TEXT_DIM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  inicioSemanaCheckOk: { background: CROSS_LIME, color: "#0E1013" },
  inicioResumoLinha: { fontSize: 12, color: CROSS_TEXT_DIM, textAlign: "center", marginTop: 8 },

  // ---------- Massi Cross — visual escuro (independente do tema do app) ----------
  crossDarkWrap: {
    background: CROSS_BG_DARK,
    borderRadius: 18,
    padding: "18px 14px 20px",
  },
  crossHeroDark: { textAlign: "left", marginBottom: 16, padding: "2px 2px 0" },
  crossHeroTituloDark: {
    fontFamily: monoFont,
    fontWeight: 800,
    fontSize: 24,
    color: "#fff",
  },
  crossHeroSubtituloDark: { fontSize: 12.5, color: CROSS_TEXT_DIM, marginTop: 4 },
  crossCategoriasGridDark: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  crossCategoriaCardDark: {
    background: CROSS_CARD_DARK,
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: "14px 12px",
    textAlign: "left",
    cursor: "pointer",
  },
  crossCategoriaEmojiDark: { fontSize: 20, marginBottom: 8, color: CROSS_LIME },
  crossCategoriaLabelDark: { fontFamily: monoFont, fontWeight: 800, fontSize: 12.5, color: "#fff", letterSpacing: "0.02em" },
  crossCategoriaSubDark: { fontSize: 11, color: CROSS_TEXT_DIM, marginTop: 3, lineHeight: 1.4 },
  crossAtalhosRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  crossAtalhoBtn: {
    flex: "1 1 45%",
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: 700,
    padding: "10px 8px",
    borderRadius: 10,
    border: `1px solid ${CROSS_LIME}55`,
    background: "transparent",
    color: CROSS_LIME,
    cursor: "pointer",
  },
};
