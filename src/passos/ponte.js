// Ponte para o plugin nativo "MassiPassos" (Android, sensor TYPE_STEP_COUNTER).
// Só fica ativa quando o app roda como app Android (Capacitor) E o plugin está instalado.
// No navegador (versão da Vercel) nada é lido do celular e a entrada manual continua valendo.
//
// O plugin tem 3 comandos (código em android-app/MassiPassosPlugin.java):
//   estado()         -> { sensor: boolean, permitido: boolean }
//   pedirPermissao() -> { permitido: boolean }
//   lerContador()    -> { valor: número }  (passos acumulados desde que o celular ligou)

export function nativoDisponivel() {
  try {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  } catch (e) { return false; }
}

let pluginEmCache = null;
export function pluginPassos() {
  if (pluginEmCache) return pluginEmCache;
  try {
    const cap = window.Capacitor;
    if (!cap) return null;
    if (typeof cap.isPluginAvailable === "function" && !cap.isPluginAvailable("MassiPassos")) return null;
    if (cap.Plugins && cap.Plugins.MassiPassos) pluginEmCache = cap.Plugins.MassiPassos;
    else if (typeof cap.registerPlugin === "function") pluginEmCache = cap.registerPlugin("MassiPassos");
  } catch (e) { pluginEmCache = null; }
  return pluginEmCache;
}

// "indisponivel" | "sem_sensor" | "sem_permissao" | "ok" | "erro"
export async function estadoPassosNativos() {
  const p = pluginPassos();
  if (!nativoDisponivel() || !p) return { status: "indisponivel" };
  try {
    const r = await p.estado();
    if (!r || r.sensor !== true) return { status: "sem_sensor" };
    return { status: r.permitido === true ? "ok" : "sem_permissao" };
  } catch (e) { return { status: "erro" }; }
}

export async function pedirPermissaoPassos() {
  const p = pluginPassos();
  if (!nativoDisponivel() || !p) return { status: "indisponivel" };
  try {
    const r = await p.pedirPermissao();
    return { status: r && r.permitido === true ? "ok" : "sem_permissao" };
  } catch (e) { return { status: "erro" }; }
}

// Valor bruto do sensor (passos desde que o celular ligou). Devolve número inteiro ou null.
export async function lerContadorBruto() {
  const p = pluginPassos();
  if (!nativoDisponivel() || !p) return null;
  try {
    const r = await p.lerContador();
    const n = Number(r && r.valor);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  } catch (e) { return null; }
}
