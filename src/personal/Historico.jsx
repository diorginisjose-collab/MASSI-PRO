// PERSONAL MASSI - fase 6 (ajuste): "Minha semana" no topo de cada personal.
// PERSONAL MASSI - fase 5: lista de treinos concluídos (usada pelo aluno e na ficha do aluno para o personal).
import React, { useEffect, useState } from "react";
import { COR, E } from "./estilos.js";
import { Etiqueta } from "./ui.jsx";
import { listarConclusoes, lerResumo, ROTULO_DIFICULDADE, ROTULO_COMPLETOU } from "./conclusao.js";
import { dataBR, hojeISO } from "./treinos.js";
import { resumirSemana } from "./semana.js";
import { mensagemDeErro } from "./dados.js";

export function ListaConclusoes({ itens }) {
  return (
    <div data-testid="lista-conclusoes">
      {itens.map((c) => {
        const ck = c.checkin;
        return (
          <div key={c.id} style={{ ...E.cartao, padding: 12, marginBottom: 10 }} data-testid={"conclusao-" + c.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <div style={{ fontWeight: 800 }}>{c.letra ? "Treino " + c.letra + " · " : ""}{c.foco || "Treino"}</div>
              <div style={E.suave}>{dataBR(c.data)}{c.duracaoMin ? " · " + c.duracaoMin + " min" : ""}</div>
            </div>
            {ck ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ck.completou && <Etiqueta texto={ROTULO_COMPLETOU[ck.completou] || ck.completou} cor="suave" />}
                  {ck.dificuldade && <Etiqueta texto={"Dificuldade: " + ROTULO_DIFICULDADE[ck.dificuldade]} cor="suave" />}
                  {ck.todasSeries === false && <Etiqueta texto="Não fez todas as séries" cor="aviso" />}
                  {ck.desconforto && <Etiqueta texto="Desconforto" cor="aviso" />}
                </div>
                {ck.desconforto && ck.desconfortoTexto && <div style={{ marginTop: 6, fontSize: 13.5, color: "#F5A524" }}>Relato: {ck.desconfortoTexto}</div>}
                {ck.obs && <div style={{ marginTop: 6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>"{ck.obs}"</div>}
              </div>
            ) : <div style={{ ...E.suave, marginTop: 6 }}>Sem respostas do check-in.</div>}
          </div>
        );
      })}
    </div>
  );
}


export function CartaoMinhaSemana({ vinculo, conclusoes, meta }) {
  const compartilha = !!(vinculo.consent && vinculo.consent.historico);
  if (!compartilha) {
    return <div style={E.emBreve} data-testid={"semana-privada-" + vinculo.id}>Você não compartilha o histórico com este personal, então o resumo da semana não é enviado nem calculado aqui. Seu histórico completo continua na aba Progresso.</div>;
  }
  const r = resumirSemana(conclusoes, meta, hojeISO());
  return (
    <div style={E.cartao} data-testid={"minha-semana-" + vinculo.id}>
      <div style={E.h2}>Minha semana (últimos 7 dias)</div>
      <div style={{ fontSize: 15, marginTop: 6 }} data-testid="semana-treinos">
        <strong>{r.treinos}</strong> {r.treinos === 1 ? "treino concluído" : "treinos concluídos"}{r.meta ? " de " + r.meta + " da meta (" + r.aderenciaPct + "%)" : ""}
      </div>
      <div style={{ ...E.suave, marginTop: 6 }}>
        {r.minutos ? r.minutos + " min de treino · " : ""}
        {r.dificuldadeMedia !== null ? "Dificuldade média " + String(r.dificuldadeMedia).replace(".", ",") + " de 5 (" + r.respostasCheckin + (r.respostasCheckin === 1 ? " resposta" : " respostas") + ")" : "Sem respostas de check-in na semana"}
        {r.desconfortos ? " · " + r.desconfortos + (r.desconfortos === 1 ? " treino com desconforto" : " treinos com desconforto") : ""}
      </div>
      {r.treinos === 0 && <div style={{ ...E.suave, marginTop: 6 }}>Nenhum treino do seu personal concluído nesta semana.</div>}
    </div>
  );
}

export function TelaHistoricoAluno({ vinculos }) {
  const ativos = vinculos.filter((v) => v.status === "ativo");
  const [dados, setDados] = useState({});
  const [metas, setMetas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const carregar = async () => {
    setErro(""); setCarregando(true);
    try {
      const acc = {}; const ms = {};
      for (const v of ativos) {
        acc[v.id] = await listarConclusoes(v.id, 30);
        try { const r = await lerResumo(v.id); ms[v.id] = r && r.metaSemanal ? r.metaSemanal : 0; } catch (e) { ms[v.id] = 0; }
      }
      setDados(acc); setMetas(ms);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);
  return (
    <div data-testid="tela-historico">
      <div style={E.cartao}>
        <h1 style={E.h1}>Meu histórico</h1>
        <div style={E.suave}>Treinos do seu personal que você concluiu e o que respondeu no check-in. O histórico completo do Massi Pro continua na aba Progresso.</div>
        <button type="button" style={E.btnLink} onClick={carregar} disabled={carregando}>Atualizar</button>
        {erro && <div style={E.erro} role="alert">{erro}</div>}
      </div>
      {carregando && <div style={{ ...E.cartao, textAlign: "center", color: COR.suave }}>Carregando...</div>}
      {!carregando && ativos.length === 0 && <div style={E.emBreve}>Você ainda não tem um personal vinculado.</div>}
      {!carregando && ativos.map((v) => (
        <div key={v.id}>
          <div style={{ ...E.h2, margin: "6px 2px 8px" }}>Personal {v.personalNome}</div>
          <CartaoMinhaSemana vinculo={v} conclusoes={dados[v.id] || []} meta={metas[v.id]} />
          {(dados[v.id] || []).length === 0 ? <div style={E.emBreve} data-testid="sem-conclusoes">Nenhum treino enviado ao seu personal ainda.</div> : <ListaConclusoes itens={dados[v.id]} />}
        </div>
      ))}
    </div>
  );
}
