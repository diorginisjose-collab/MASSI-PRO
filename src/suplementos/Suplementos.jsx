import React, { useMemo, useState } from "react";
import { SUPLEMENTOS, CATEGORIAS, AVISO_GERAL } from "./dados/dados.js";

const COR_EVIDENCIA = { "Forte": "#2E7D32", "Moderada": "#B7791F", "Limitada": "#C05621", "Pouca ou inexistente": "#4A5568" };
const FILTROS = ["Todos", "Naturais", ...CATEGORIAS];

const badge = (texto, cor) => (
  <span style={{ background: cor, color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{texto}</span>
);

function Campo({ titulo, texto, tr }) {
  if (!texto) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{tr(titulo)}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.92 }}>{texto}</div>
    </div>
  );
}

/**
 * Guia de suplementos (conteúdo educativo). Fica no topo da aba Notas, recolhido por padrão.
 * estilos: { card, label, input } vindos do App (mesmo visual da aba).
 */
export default function GuiaSuplementos({ estilos = {}, tr = (x) => x }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [expandido, setExpandido] = useState(null);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return SUPLEMENTOS.filter((s) => {
      if (filtro === "Naturais" && !s.natural) return false;
      if (filtro !== "Todos" && filtro !== "Naturais" && s.categoria !== filtro) return false;
      if (!termo) return true;
      return (s.nome + " " + s.paraQueServe + " " + s.categoria).toLowerCase().includes(termo);
    });
  }, [busca, filtro]);

  return (
    <section style={estilos.card}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        style={{ width: "100%", background: "transparent", border: "none", color: "inherit", textAlign: "left", padding: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>
          <span style={estilos.label}>{tr("Suplementos: guia completo")}</span>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{tr("O que é, para que serve, evidência e cuidados de cada um. Naturais e não naturais.")}</div>
        </span>
        <span style={{ fontSize: 18, opacity: 0.7 }}>{aberto ? "▾" : "▸"}</span>
      </button>

      {aberto && (
        <div style={{ marginTop: 12 }}>
          <div style={{ background: "rgba(255,193,7,0.10)", border: "1px solid rgba(255,193,7,0.35)", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>
            {tr(AVISO_GERAL)}
          </div>

          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={tr("Buscar suplemento (ex.: creatina, whey, cafeína)")}
            aria-label={tr("Buscar suplemento")}
            style={{ ...estilos.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }}
          />

          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 6 }}>
            {FILTROS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                aria-pressed={filtro === f}
                style={{ flexShrink: 0, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", border: "1px solid " + (filtro === f ? "#A7FF00" : "rgba(128,128,128,0.4)"), background: filtro === f ? "#A7FF00" : "transparent", color: filtro === f ? "#15181B" : "inherit", fontWeight: filtro === f ? 800 : 500 }}
              >
                {tr(f)}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 12.5, opacity: 0.75, marginBottom: 8 }}>
            {lista.length === 1 ? "1 " + tr("suplemento") : lista.length + " " + tr("suplementos")}
          </div>

          {lista.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.8 }}>{tr("Nenhum suplemento encontrado com essa busca.")}</div>}

          {lista.map((s) => {
            const aberto2 = expandido === s.id;
            return (
              <div key={s.id} style={{ borderTop: "1px solid rgba(128,128,128,0.25)", padding: "10px 0" }}>
                <button
                  type="button"
                  onClick={() => setExpandido(aberto2 ? null : s.id)}
                  aria-expanded={aberto2}
                  style={{ width: "100%", background: "transparent", border: "none", color: "inherit", textAlign: "left", padding: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {s.nome}
                    <span style={{ display: "block", fontSize: 12, fontWeight: 500, opacity: 0.7, marginTop: 2 }}>
                      {tr(s.categoria)}{s.natural ? " · " + tr("natural") : " · " + tr("não natural")}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {badge(tr(s.evidencia), COR_EVIDENCIA[s.evidencia] || "#4A5568")}
                    <span style={{ opacity: 0.7 }}>{aberto2 ? "▾" : "▸"}</span>
                  </span>
                </button>

                {aberto2 && (
                  <div style={{ paddingTop: 4 }}>
                    <Campo titulo="Para que serve" texto={s.paraQueServe} tr={tr} />
                    <Campo titulo="Como funciona" texto={s.comoFunciona} tr={tr} />
                    <Campo titulo="Dose de referência (estudos e diretrizes)" texto={s.dose} tr={tr} />
                    <Campo titulo="Cuidados" texto={s.cuidados} tr={tr} />
                    <Campo titulo="Quem deve evitar ou consultar antes" texto={s.evitar} tr={tr} />
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                      {tr("Evidência científica: ")}{tr(s.evidencia)}. {tr("Não é recomendação médica.")}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
