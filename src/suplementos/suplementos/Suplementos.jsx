// Entrada da central de suplementos na aba Notas. A central completa fica em central/CentralSuplementos.jsx.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import CentralErroBoundary from "./central/ErroBoundary.jsx";
import CentralSuplementos from "./central/CentralSuplementos.jsx";

export default function GuiaSuplementos({ estilos = {}, tr = (x) => x }) {
  const [aberta, setAberta] = useState(false);
  return (
    <section style={estilos.card}>
      <div style={estilos.label}>{tr("Suplementos: guia completo")}</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12, lineHeight: 1.45 }}>
        {tr("Busca, comparador, favoritos e calculadoras de proteína, porção, rótulos e cafeína. Conteúdo educativo, sem uso de IA.")}
      </div>
      <button
        type="button"
        onClick={() => setAberta(true)}
        style={{ width: "100%", background: "linear-gradient(135deg, #A7FF00, #7BC400)", color: "#15181B", border: "none", borderRadius: 14, padding: "13px 16px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
      >
        {tr("Abrir central de suplementos")}
      </button>
      {aberta && createPortal(
        <CentralErroBoundary onFechar={() => setAberta(false)}>
          <CentralSuplementos estilos={estilos} tr={tr} onFechar={() => setAberta(false)} />
        </CentralErroBoundary>,
        document.body
      )}
    </section>
  );
}
