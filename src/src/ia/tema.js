// Visual das telas de IA (segue o tema escuro do Massi Pro).
export const COR = {
  fundo: "#0F1417",
  card: "#1A2226",
  card2: "#222C31",
  borda: "rgba(255,255,255,0.10)",
  texto: "#EAF0F2",
  suave: "#9AA8AF",
  lime: "#9ACD32",
  grafite: "#10150A",
  vermelho: "#FF6B5E",
  amarelo: "#FFC700",
  azul: "#6EC1F5",
};
export const FONTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const tela = { position: "fixed", inset: 0, zIndex: 720, background: COR.fundo, color: COR.texto, display: "flex", flexDirection: "column", fontFamily: FONTE };
export const cabecalho = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", paddingTop: "calc(36px + env(safe-area-inset-top, 0px))", borderBottom: "1px solid " + COR.borda, flexShrink: 0 };
export const botaoFechar = { background: COR.card2, color: COR.texto, border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer" };
export const botaoPrimario = { width: "100%", padding: "14px", borderRadius: 12, border: "none", background: COR.lime, color: COR.grafite, fontWeight: 800, fontSize: 15, cursor: "pointer" };
export const botaoSecundario = { width: "100%", padding: "13px", borderRadius: 12, border: "1px solid " + COR.borda, background: COR.card2, color: COR.texto, fontWeight: 700, fontSize: 14.5, cursor: "pointer" };
export const cartao = { background: COR.card, borderRadius: 14, padding: 14, marginBottom: 12 };
// Texto simples com **negrito**, listas e quebras de linha (sem HTML perigoso).
export function formatarTexto(React, texto) {
  const linhas = String(texto || "").split("\n");
  return linhas.map((l, i) => {
    const lista = /^\s*([-•*]|\d+[.)])\s+/.exec(l);
    const conteudo = lista ? l.slice(lista[0].length) : l;
    const partes = conteudo.split(/(\*\*[^*]+\*\*)/g).map((p, k) => (/^\*\*[^*]+\*\*$/.test(p) ? React.createElement("strong", { key: k }, p.slice(2, -2)) : p));
    if (!conteudo.trim()) return React.createElement("div", { key: i, style: { height: 6 } });
    return React.createElement("div", { key: i, style: { paddingLeft: lista ? 14 : 0, textIndent: lista ? -12 : 0, marginBottom: 3, lineHeight: 1.5 } }, lista ? "• " : null, partes);
  });
}
