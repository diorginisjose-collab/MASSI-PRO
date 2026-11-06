// Configurações do módulo de IA do Massi Pro. Mexa só aqui.
export const IA_CONFIG = {
  // Endereço da função de servidor. No site (Vercel) basta "/api/ia".
  apiUrl: "/api/ia",
  // No app Android (Capacitor) as telas rodam de dentro do aparelho, então o endereço precisa ser completo.
  // O app escolhe sozinho: site usa apiUrl, app Android usa apiUrlNativo.
  apiUrlNativo: "https://massi-pro.vercel.app/api/ia",

  // Ids dos recursos no controle de uso do plano (RECURSOS_IA / LIMITES_IA_MENSAL do App.jsx).
  recursoChat: "chat",
  recursoFoto: "foto",
  recursoRotina: "treino", // Rotina Inteligente: cada plano gerado ou reavaliação com IA gasta 1 uso

  // Assistente
  maxCaracteresPergunta: 1000, // tamanho máximo de cada pergunta
  mensagensEnviadas: 10, // quantas mensagens anteriores vão junto a cada pergunta
  mensagensSalvas: 30, // quantas ficam guardadas no aparelho
  chaveHistoricoChat: "assistente-ia-historico",
  chaveUsarDados: "assistente-ia-usar-dados",

  // Rotina Inteligente
  // Tempo máximo da geração inteira (treino + alimentação, com uma nova tentativa se a resposta vier incompleta).
  tempoMaxGeracaoMs: 200000, // se a IA demorar mais que isso, a geração é cancelada

  // Foto de alimentos
  fotoMaxLado: 1024, // a foto é reduzida antes de enviar (mais rápido e barato)
  fotoQualidade: 0.82,
  chaveDiario: "diario-alimentar",
  maxEntradasDiario: 500,

  // Identificação anônima do aparelho (só pra limitar abuso no servidor)
  chaveDispositivo: "massi-ia-dispositivo",
};

function appNativo() {
  try {
    const cap = typeof window !== "undefined" && window.Capacitor;
    return !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  } catch (e) { return false; }
}

export function urlApi() {
  if (typeof window !== "undefined" && window.__MASSI_IA_URL__) return window.__MASSI_IA_URL__;
  return appNativo() ? IA_CONFIG.apiUrlNativo : IA_CONFIG.apiUrl;
}
