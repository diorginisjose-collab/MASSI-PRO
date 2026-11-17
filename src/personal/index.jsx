// Porta de entrada do Personal Massi: carrega o módulo só quando é aberto e
// protege o Massi Pro: se algo falhar aqui, o resto do app continua funcionando.
import React from "react";

const PersonalMassi = React.lazy(() => import("./PersonalMassi.jsx"));

const caixa = { position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 600, background: "#0F1417", color: "#EAF0F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "inherit" };

class Limite extends React.Component {
  constructor(props) { super(props); this.state = { erro: false }; }
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(e) { try { console.error("Personal Massi:", e); } catch (_) { /* nada */ } }
  render() {
    if (this.state.erro) {
      return (
        <div style={caixa} data-testid="personal-falha-carga">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Não foi possível abrir o Personal Massi</div>
            <div style={{ color: "#9AA3AE", fontSize: 14, marginBottom: 16 }}>Verifique sua conexão com a internet e tente de novo.</div>
            <button type="button" onClick={this.props.onFechar} style={{ minHeight: 46, padding: "0 22px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #B7E04A, #7FAE1F)", color: "#10150A", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>Voltar ao Massi Pro</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PersonalMassiEntrada({ onFechar }) {
  return (
    <Limite onFechar={onFechar}>
      <React.Suspense fallback={<div style={caixa}>Carregando...</div>}>
        <PersonalMassi onFechar={onFechar} />
      </React.Suspense>
    </Limite>
  );
}
