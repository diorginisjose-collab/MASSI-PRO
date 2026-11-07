// Pilha de navegação do botão Voltar do celular.
// Cada troca de aba e cada tela aberta entra na pilha. Voltar desfaz a última ação
// (fecha a tela ou volta à aba anterior). Quando não há mais nada a desfazer, o app
// pergunta "Tem certeza que deseja sair?" antes de fechar.
const pilha = [];
let ignorar = 0;
let saindo = false;
let pedirSaida = null; // função da tela que abre a pergunta "Tem certeza que deseja sair?"

export function empilhar(desfazer) {
  pilha.push(desfazer);
  try { window.history.pushState({ massi: pilha.length }, ""); } catch (e) { /* sem histórico: segue */ }
}

// Fechamento feito pela própria tela (botão Fechar): remove a entrada sem disparar a ação
export function removerTopo() {
  if (!pilha.length) return;
  pilha.pop();
  ignorar++;
  try { window.history.back(); } catch (e) { ignorar--; }
}

// A tela diz qual função mostra a pergunta de saída. Devolve uma função para desligar.
export function definirPedidoDeSaida(fn) {
  pedirSaida = fn;
  return () => { if (pedirSaida === fn) pedirSaida = null; };
}

// Chamada quando a pessoa confirma "Sim, sair". Devolve true se o app foi fechado pelo próprio app (Android).
export function confirmarSaida() {
  saindo = true;
  try { window.localStorage.setItem("massi-ultima-aba", JSON.stringify({ aba: "inicio", em: Date.now(), saiu: true })); } catch (e) { /* segue */ }
  try {
    const cap = window.Capacitor;
    if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
      const app = (cap.Plugins && cap.Plugins.App) || (typeof cap.registerPlugin === "function" ? cap.registerPlugin("App") : null);
      if (app && typeof app.exitApp === "function") { app.exitApp(); return true; }
    }
  } catch (e) { /* tenta o outro jeito */ }
  // Navegador / app instalado pelo site: o Android não deixa o site se fechar sozinho; tenta sair do histórico.
  try { window.history.go(-2); } catch (e) { /* segue */ }
  try { window.close(); } catch (e) { /* segue */ }
  setTimeout(() => { saindo = false; }, 1500);
  return false;
}

export function iniciarNavegacao() {
  // Entrada-base: o primeiro Voltar cai aqui e vira a pergunta de saída, em vez de fechar o app de uma vez.
  try { window.history.pushState({ massi: "base" }, ""); } catch (e) { /* sem histórico: segue */ }
  const aoVoltar = () => {
    if (saindo) return;
    if (ignorar > 0) { ignorar--; return; }
    const desfazer = pilha.pop();
    if (desfazer) { desfazer(); return; }
    // Nada para desfazer: recoloca a entrada-base e pergunta se a pessoa quer sair.
    try { window.history.pushState({ massi: "base" }, ""); } catch (e) { /* segue */ }
    if (pedirSaida) pedirSaida();
  };
  window.addEventListener("popstate", aoVoltar);
  return () => window.removeEventListener("popstate", aoVoltar);
}
