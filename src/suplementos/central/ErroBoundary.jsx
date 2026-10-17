import React from "react";

// Se a central falhar ao desenhar, mostra uma mensagem em vez de deixar a tela branca.
export default class CentralErroBoundary extends React.Component {
  constructor(props) { super(props); this.state = { erro: false }; }
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(err) { try { console.error("Central de suplementos:", err); } catch (e) { /* segue */ } }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="dialog" aria-label="Central de suplementos" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, height: "100vh", zIndex: 3000, background: "#101214", color: "#F2F4F6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Não foi possível abrir a central agora.</div>
        <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5, marginBottom: 18 }}>Feche e abra de novo. Se continuar, atualize a página do app (em aba anônima, se necessário).</div>
        <button type="button" onClick={this.props.onFechar} style={{ background: "#A7FF00", color: "#15181B", border: "none", borderRadius: 12, padding: "12px 20px", fontWeight: 800, cursor: "pointer" }}>Fechar</button>
      </div>
    );
  }
}
