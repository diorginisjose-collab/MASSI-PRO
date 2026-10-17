// Matriz de evidência por objetivo. Só preenchida onde há base documentada para classificar.
// Célula ausente = "Pendente de revisão" (não é "sem evidência"). Não inventar níveis.
export const NIVEIS = ["Forte", "Moderada", "Limitada", "Insuficiente", "Ausência de benefício relevante"];

export const OBJETIVOS = [
  ["hipertrofia", "Hipertrofia (ganho de massa)"],
  ["forca", "Força"],
  ["potencia", "Potência (esforços curtos e intensos)"],
  ["resistencia", "Resistência (esforços longos)"],
  ["recuperacao", "Recuperação"],
  ["fadiga", "Fadiga"],
  ["emagrecimento", "Emagrecimento"],
  ["saciedade", "Saciedade"],
  ["complementacao", "Complementação proteica"],
  ["correcao", "Correção de ingestão insuficiente"],
  ["saude", "Saúde geral"],
];

// refs: chaves de FONTES. Mapas com apenas os objetivos avaliados.
export const MATRIZ = {
  creatina: { refs: ["issn_creatina"], objetivos: { hipertrofia: "Moderada", forca: "Forte", potencia: "Forte", resistencia: "Limitada" } },
  cafeina: { refs: ["issn_cafeina", "efsa_cafeina"], objetivos: { forca: "Moderada", potencia: "Moderada", resistencia: "Forte", fadiga: "Limitada" } },
  "beta-alanina": { refs: [], objetivos: { potencia: "Moderada", resistencia: "Moderada", hipertrofia: "Limitada" } },
  citrulina: { refs: [], objetivos: { resistencia: "Limitada", forca: "Limitada" } },
  beterraba: { refs: [], objetivos: { resistencia: "Moderada" } },
  whey: { refs: ["issn_proteina"], objetivos: { hipertrofia: "Forte", complementacao: "Forte", saciedade: "Limitada" } },
  caseina: { refs: ["issn_proteina"], objetivos: { complementacao: "Moderada", hipertrofia: "Limitada" } },
  "proteina-vegetal": { refs: ["issn_proteina"], objetivos: { hipertrofia: "Moderada", complementacao: "Forte" } },
  carboidrato: { refs: ["acsm_carboidratos"], objetivos: { resistencia: "Forte", recuperacao: "Moderada" } },
  "vitamina-d": { refs: ["ods", "anvisa"], objetivos: { correcao: "Forte", forca: "Insuficiente" } },
  "omega-3": { refs: ["ods"], objetivos: { saude: "Forte", hipertrofia: "Limitada" } },
  bcaa: { refs: ["issn_proteina"], objetivos: { hipertrofia: "Limitada", recuperacao: "Limitada" } },
  glutamina: { refs: [], objetivos: { recuperacao: "Insuficiente", saude: "Insuficiente" } },
  colageno: { refs: [], objetivos: { recuperacao: "Limitada", hipertrofia: "Insuficiente" } },
  "fibra-psyllium": { refs: ["ods"], objetivos: { saciedade: "Moderada", saude: "Moderada" } },
  probioticos: { refs: ["ods"], objetivos: { saude: "Limitada", resistencia: "Insuficiente" } },
  magnesio: { refs: ["ods"], objetivos: { correcao: "Forte", fadiga: "Insuficiente" } },
  // Itens novos
  bicarbonato: { refs: [], objetivos: { potencia: "Moderada", resistencia: "Moderada" } },
  eaa: { refs: ["issn_proteina"], objetivos: { hipertrofia: "Limitada" } },
  leucina: { refs: [], objetivos: { hipertrofia: "Limitada" } },
  colina: { refs: ["dri_iom"], objetivos: { correcao: "Forte", resistencia: "Insuficiente", hipertrofia: "Insuficiente" } },
  gelatina: { refs: [], objetivos: { hipertrofia: "Insuficiente", recuperacao: "Insuficiente" } },
  "bebida-esportiva": { refs: ["acsm_carboidratos", "ioc_suplementos"], objetivos: { resistencia: "Forte", recuperacao: "Moderada" } },
  "gel-energetico": { refs: ["acsm_carboidratos"], objetivos: { resistencia: "Forte" } },
};

export function nivelDe(id, objetivo) { return (MATRIZ[id] && MATRIZ[id].objetivos[objetivo]) || null; }
