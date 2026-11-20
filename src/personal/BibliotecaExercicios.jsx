// PERSONAL MASSI - fase 4: escolher exercícios da biblioteca do próprio Massi Pro (sem duplicar nada).
import React, { useMemo, useState } from "react";
import { COR, E } from "./estilos.js";
import { GuiaDoExercicio } from "./Previa.jsx";
import { useVoltarDoCelular } from "./ui.jsx";
import { gruposPrincipais } from "./treinos.js";

const sem = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function BibliotecaExercicios({ biblioteca, aoEscolher, aoFechar }) {
  const LIB = (biblioteca && biblioteca.LIBRARY) || {};
  const grupos = gruposPrincipais(biblioteca);
  const [grupo, setGrupo] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [proprio, setProprio] = useState("");
  const [adicionados, setAdicionados] = useState([]);
  useVoltarDoCelular(true, "biblioteca", aoFechar);

  const itens = useMemo(() => {
    const lista = [];
    const vistos = new Set();
    grupos.forEach((g) => {
      (LIB[g] || []).forEach((ex) => {
        const chave = g + "::" + ex.name;
        if (vistos.has(chave)) return;
        vistos.add(chave);
        lista.push({ nome: ex.name, grupo: g, sets: ex.sets, reps: ex.reps });
      });
    });
    return lista;
  }, [biblioteca]);

  const vistosNomes = new Set();
  const filtrados = itens.filter((i) => (grupo === "Todos" || i.grupo === grupo) && (!busca.trim() || sem(i.nome).indexOf(sem(busca)) >= 0))
    .filter((i) => { if (grupo !== "Todos") return true; if (vistosNomes.has(i.nome)) return false; vistosNomes.add(i.nome); return true; });

  const adicionar = (ex) => {
    aoEscolher(ex);
    setAdicionados((a) => [...a, ex.nome]);
  };

  return (
    <div style={{ ...E.pagina, zIndex: 620 }} data-testid="biblioteca">
      <div style={E.miolo}>
        <div style={E.topo}>
          <button type="button" style={E.btnIcone} onClick={aoFechar} aria-label="Fechar biblioteca" data-testid="bib-fechar">←</button>
          <div style={E.marca}>Escolher exercício<div style={E.marcaSub}>{adicionados.length ? adicionados.length + " adicionado(s) neste treino" : "Biblioteca do Massi Pro"}</div></div>
          <button type="button" style={{ ...E.btnSec, width: "auto", marginTop: 0, padding: "0 16px", minHeight: 42 }} onClick={aoFechar} data-testid="bib-concluir">Concluir</button>
        </div>

        <input style={E.campo} type="search" placeholder="Buscar exercício" value={busca} onChange={(e) => setBusca(e.target.value)} data-testid="bib-busca" />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 0", WebkitOverflowScrolling: "touch" }}>
          {["Todos", ...grupos].map((g) => (
            <button key={g} type="button" onClick={() => setGrupo(g)} data-testid={"bib-grupo-" + g} style={{ flexShrink: 0, minHeight: 38, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontWeight: 800, fontSize: 13.5, border: "1px solid " + (grupo === g ? COR.lima : COR.borda), background: grupo === g ? "rgba(198,255,77,0.14)" : COR.cartao, color: grupo === g ? COR.lima : COR.texto }}>{g}</button>
          ))}
        </div>

        {filtrados.length === 0 && <div style={E.emBreve}>Nenhum exercício encontrado. Você pode criar um abaixo.</div>}
        {filtrados.map((i) => (
          <div key={i.grupo + i.nome} style={{ ...E.cartao, padding: 12, marginBottom: 10 }} data-testid={"bib-item-" + i.nome}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{i.nome}</div>
                <div style={E.suave}>{i.grupo} · sugestão {i.sets} x {i.reps}</div>
              </div>
              <button type="button" onClick={() => adicionar(i)} data-testid={"bib-add-" + i.nome} style={{ minHeight: 42, padding: "0 16px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#B7E04A,#7FAE1F)", color: "#10150A", fontWeight: 900, cursor: "pointer" }}>Adicionar</button>
            </div>
            <GuiaDoExercicio nome={i.nome} biblioteca={biblioteca} />
          </div>
        ))}

        <div style={{ ...E.cartao, marginTop: 10 }}>
          <div style={E.h2}>Exercício que não está na lista</div>
          <input style={E.campo} type="text" maxLength={60} placeholder="Nome do exercício" value={proprio} onChange={(e) => setProprio(e.target.value)} data-testid="bib-proprio" />
          <button type="button" style={E.btnSec} onClick={() => { const n = proprio.trim(); if (!n) return; adicionar({ nome: n, grupo: grupo === "Todos" ? "" : grupo, sets: 3, reps: "10-12" }); setProprio(""); }} data-testid="bib-add-proprio">Adicionar exercício próprio</button>
        </div>
      </div>
    </div>
  );
}
