// Peças de interface compartilhadas do Personal Massi.
import React, { useEffect, useRef, useState } from "react";
import { COR, E } from "./estilos.js";
import { empilhar, removerTopo } from "../navegacao.js";

export function Avatar({ nome, foto, tamanho = 44 }) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase() || "?";
  const base = { width: tamanho, height: tamanho, borderRadius: "50%", flexShrink: 0, border: "2px solid " + COR.lima, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(198,255,77,0.1)", color: COR.lima, fontWeight: 900, fontSize: tamanho * 0.42 };
  if (foto) return <div style={base}><img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={base} aria-hidden="true">{inicial}</div>;
}

export function Etiqueta({ texto, cor = "lima" }) {
  const c = cor === "ok" ? COR.ok : cor === "aviso" ? "#F5A524" : cor === "suave" ? COR.suave : COR.lima;
  return <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 800, color: c, border: "1px solid " + c, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{texto}</span>;
}

// Botão de ação perigosa com confirmação no próprio lugar (sem janela do navegador).
export function BotaoPerigo({ rotulo, aviso, confirmar, aoConfirmar, ocupado, testid }) {
  const [pedindo, setPedindo] = useState(false);
  if (!pedindo) {
    return <button type="button" style={{ ...E.btnSec, borderColor: "rgba(255,122,112,0.6)", color: COR.erro }} onClick={() => setPedindo(true)} data-testid={testid}>{rotulo}</button>;
  }
  return (
    <div style={{ ...E.erro, marginTop: 10 }} data-testid={testid ? testid + "-confirmacao" : undefined}>
      <div style={{ marginBottom: 10 }}>{aviso}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={ocupado} onClick={aoConfirmar} data-testid={testid ? testid + "-sim" : undefined} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "none", background: COR.erro, color: "#2A0B08", fontWeight: 900, fontSize: 14.5, cursor: "pointer", opacity: ocupado ? 0.6 : 1 }}>{ocupado ? "Aguarde..." : confirmar}</button>
        <button type="button" disabled={ocupado} onClick={() => setPedindo(false)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid " + COR.borda, background: "transparent", color: COR.texto, fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>Voltar</button>
      </div>
    </div>
  );
}

export function textoConsentimento(c) {
  if (!c) return "Nada compartilhado";
  const itens = [];
  if (c.historico) itens.push("histórico de treinos");
  if (c.peso) itens.push("peso");
  if (c.medidas) itens.push("medidas");
  return itens.length ? "Compartilha: " + itens.join(", ") : "Nada compartilhado";
}

// Faz o botão "voltar" do celular fechar a tela interna (mesmo padrão das outras telas do app).
export function useVoltarDoCelular(ativo, chave, aoVoltar) {
  const fechouRef = useRef(false);
  const voltarRef = useRef(aoVoltar);
  voltarRef.current = aoVoltar;
  useEffect(() => {
    if (!ativo) return undefined;
    empilhar(() => { fechouRef.current = true; voltarRef.current(); });
    return () => { if (!fechouRef.current) removerTopo(); fechouRef.current = false; };
  }, [ativo, chave]);
}
