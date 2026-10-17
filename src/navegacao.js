// Pilha de navegação do botão Voltar do celular.
// Cada troca de aba e cada tela aberta entra na pilha. Voltar desfaz a última ação
// (fecha a tela ou volta à aba anterior) e só sai do app quando não há mais nada a desfazer.
const pilha = [];
let ignorar = 0;

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

export function iniciarNavegacao() {
  const aoVoltar = () => {
    if (ignorar > 0) { ignorar--; return; }
    const desfazer = pilha.pop();
    if (desfazer) desfazer();
  };
  window.addEventListener("popstate", aoVoltar);
  return () => window.removeEventListener("popstate", aoVoltar);
}
