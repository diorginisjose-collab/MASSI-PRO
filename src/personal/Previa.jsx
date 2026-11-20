// PERSONAL MASSI - fase 4: como o aluno enxerga o treino (usado na prévia do personal e na tela do aluno).
import React, { useState } from "react";
import { COR, E } from "./estilos.js";
import { Etiqueta } from "./ui.jsx";
import { descreverExercicio, dataBR } from "./treinos.js";

export function GuiaDoExercicio({ nome, biblioteca }) {
  const [aberto, setAberto] = useState(false);
  const guia = biblioteca && biblioteca.GUIA_EXECUCAO ? biblioteca.GUIA_EXECUCAO[nome] : null;
  const video = biblioteca && biblioteca.getVideoUrl ? biblioteca.getVideoUrl(nome) : null;
  if (!guia && !video) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" onClick={() => setAberto(!aberto)} style={E.btnLink} aria-expanded={aberto}>{aberto ? "Esconder como fazer" : "Ver como fazer"}</button>
      {aberto && (
        <div style={{ background: "#0F1417", border: "1px solid " + COR.borda, borderRadius: 12, padding: 10, fontSize: 13, lineHeight: 1.45 }}>
          {guia && guia.grupoMuscular && <div style={{ color: COR.suave, marginBottom: 6 }}>Trabalha: {guia.grupoMuscular}</div>}
          {guia && Array.isArray(guia.comoExecutar) && <ol style={{ margin: "0 0 6px", paddingLeft: 18 }}>{guia.comoExecutar.map((t, i) => <li key={i}>{t}</li>)}</ol>}
          {guia && guia.dica && <div style={{ color: COR.lima }}>Dica: {guia.dica}</div>}
          {video && <a href={video} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, color: COR.lima, fontWeight: 800 }}>Ver vídeo</a>}
        </div>
      )}
    </div>
  );
}

export function PreviaPrograma({ programa, biblioteca, rodape }) {
  return (
    <div data-testid="previa-programa">
      <div style={E.cartao}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{programa.nome || "Treino sem nome"}</div>
        <div style={{ ...E.suave, marginTop: 4 }}>
          {programa.frequencia} {programa.frequencia === 1 ? "dia" : "dias"} por semana
          {programa.inicio ? " · início " + dataBR(programa.inicio) : ""}
          {programa.validade ? " · válido até " + dataBR(programa.validade) : ""}
        </div>
        {programa.orientacoes && <div style={{ marginTop: 10, fontSize: 14, whiteSpace: "pre-wrap" }}>{programa.orientacoes}</div>}
        {rodape}
      </div>
      {(programa.dias || []).map((d) => (
        <div key={d.letra} style={E.cartao} data-testid={"previa-dia-" + d.letra}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#B7E04A,#7FAE1F)", color: "#10150A", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{d.letra}</span>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{d.titulo || "Treino " + d.letra}</div>
          </div>
          {d.grupos && d.grupos.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{d.grupos.map((g) => <Etiqueta key={g} texto={g} cor="suave" />)}</div>}
          {(d.exercicios || []).map((e, i) => (
            <div key={e.id || i} style={{ padding: "10px 0", borderTop: "1px solid " + COR.borda }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{i + 1}. {e.nome}</div>
              <div style={{ color: COR.lima, fontSize: 13.5, fontWeight: 700, marginTop: 2 }}>{descreverExercicio(e)}</div>
              {e.instrucoes && <div style={{ ...E.suave, marginTop: 4, whiteSpace: "pre-wrap" }}>{e.instrucoes}</div>}
              {e.obs && <div style={{ fontSize: 13, marginTop: 4, color: "#F5A524" }}>Atenção: {e.obs}</div>}
              <GuiaDoExercicio nome={e.nome} biblioteca={biblioteca} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
