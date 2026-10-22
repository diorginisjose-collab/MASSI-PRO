// Ponte para o plugin nativo de passos (Capacitor, Android: Health Connect).
// Só fica ativa quando o app roda como app nativo E o plugin "MassiPassos" está instalado.
// Enquanto isso, nada é lido do celular e a entrada manual continua valendo.

export function nativoDisponivel() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  } catch (e) { return false; }
}

export function pluginPassos() {
  try {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    return (plugins && plugins.MassiPassos) || null;
  } catch (e) { return null; }
}

// Estado real da leitura nativa: "indisponivel" | "sem_permissao" | "ok" | "erro"
export async function estadoPassosNativos() {
  const p = pluginPassos();
  if (!nativoDisponivel() || !p) return { status: "indisponivel" };
  try {
    const r = await p.estado();
    return { status: r && r.permitido ? "ok" : "sem_permissao" };
  } catch (e) { return { status: "erro" }; }
}

export async function pedirPermissaoPassos() {
  const p = pluginPassos();
  if (!p) return { status: "indisponivel" };
  try { const r = await p.pedirPermissao(); return { status: r && r.permitido ? "ok" : "sem_permissao" }; }
  catch (e) { return { status: "erro" }; }
}

// Passos de hoje lidos do celular (Health Connect). Devolve número ou null.
export async function lerPassosHojeNativos() {
  const p = pluginPassos();
  if (!p) return null;
  try { const r = await p.lerPassosHoje(); const n = Number(r && r.passos); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; }
  catch (e) { return null; }
}

// Contagem automática (quando o plugin nativo existir): iniciar e parar o serviço de passos.
export async function iniciarContagemNativa() {
  const p = pluginPassos();
  if (!p) return { status: "indisponivel" };
  try { await p.iniciar(); return { status: "ativo" }; } catch (e) { return { status: "erro" }; }
}

export async function pararContagemNativa() {
  const p = pluginPassos();
  if (!p) return { status: "indisponivel" };
  try { await p.parar(); return { status: "inativo" }; } catch (e) { return { status: "erro" }; }
}
