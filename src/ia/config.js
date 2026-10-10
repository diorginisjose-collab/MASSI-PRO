// Configurações do módulo de IA do Massi Pro. Mexa só aqui.
export const IA_CONFIG = {
  // Endereço da função de servidor. No site (Vercel) basta "/api/ia".
  // No app de celular (Capacitor) use a URL completa: "https://SEU-SITE.vercel.app/api/ia".
  apiUrl: "/api/ia",

  // Ids dos recursos no controle de uso do plano (RECURSOS_IA / LIMITES_IA_MENSAL do App.jsx).
  recursoChat: "chat",
  recursoFoto: "foto",

  // Assistente
  maxCaracteresPergunta: 1000, // tamanho máximo de cada pergunta
  mensagensEnviadas: 10, // quantas mensagens anteriores vão junto a cada pergunta
  mensagensSalvas: 30, // quantas ficam guardadas no aparelho
  chaveHistoricoChat: "assistente-ia-historico",
  chaveUsarDados: "assistente-ia-usar-dados",

  // Foto de alimentos
  fotoMaxLado: 1024, // a foto é reduzida antes de enviar (mais rápido e barato)
  fotoQualidade: 0.82,
  chaveDiario: "diario-alimentar",
  maxEntradasDiario: 500,

  // Identificação anônima do aparelho (só pra limitar abuso no servidor)
  chaveDispositivo: "massi-ia-dispositivo",
};

export function urlApi() {
  return (typeof window !== "undefined" && window.__MASSI_IA_URL__) || IA_CONFIG.apiUrl;
}
