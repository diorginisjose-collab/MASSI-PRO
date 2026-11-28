// PERSONAL MASSI - fase 6: Central de Acompanhamento (quem treina, quem está pendente, quem não tem registros).
// Usa só dados reais do resumo que o aluno envia, e só de quem compartilha o histórico.
import React, { useMemo, useState } from "react";
import { COR, E } from "./estilos.js";
import { Avatar, Etiqueta } from "./ui.jsx";
import { situacaoDoAluno, ordenarCentral, totaisDaCentral } from "./semana.js";
import { dataBR, hojeISO } from "./treinos.js";
import { Bolinha } from "./Mensagens.jsx";

const FILTROS = [
  { id: "todos", rotulo: "Todos" },
  { id: "atencao", rotulo: "Atenção" },
  { id: "pendente", rotulo: "Pendentes" },
  { id: "treinando", rotulo: "Treinando" },
  { id: "semRegistros", rotulo: "Sem registros" },
];

function linhaDaSituacao(sit) {
  if (sit.estado === "semAcesso") return "Não compartilha o histórico com você.";
  if (sit.estado === "semRegistros") return "Ainda não enviou nenhum treino concluído.";
  const ultimo = "último treino em " + dataBR(sit.ultimaAtividade) + (sit.diasSemTreinar === 0 ? " (hoje)" : sit.diasSemTreinar === 1 ? " (ontem)" : " (há " + sit.diasSemTreinar + " dias)");
  if (sit.estado === "pendente") return "Nenhum treino nos últimos 7 dias · " + ultimo;
  return sit.treinosSemana + (sit.treinosSemana === 1 ? " treino" : " treinos") + " nos últimos 7 dias" + (sit.meta ? " (meta " + sit.meta + ", adesão " + sit.aderenciaPct + "%)" : "") + " · " + ultimo;
}

const ROTULO_ESTADO = { treinando: ["Treinando", "ok"], pendente: ["Pendente", "aviso"], semRegistros: ["Sem registros", "suave"], semAcesso: ["Sem acesso ao histórico", "suave"] };

export function TelaCentral({ vinculos, resumos, naoLidas, onAbrirAluno, onRecarregar }) {
  const [filtro, setFiltro] = useState("todos");
  const [ocupado, setOcupado] = useState(false);
  const hoje = hojeISO();
  const itens = useMemo(() => ordenarCentral(vinculos.filter((v) => v.status === "ativo").map((v) => ({ vinculo: v, sit: situacaoDoAluno(v, resumos && resumos[v.id], hoje) }))), [vinculos, resumos, hoje]);
  const t = totaisDaCentral(itens);
  const visiveis = itens.filter(({ sit }) => filtro === "todos" || (filtro === "atencao" ? sit.desconforto : sit.estado === filtro));
  const atualizar = async () => { setOcupado(true); try { await onRecarregar(); } finally { setOcupado(false); } };

  return (
    <div data-testid="tela-central">
      <div style={E.cartao}>
        <h1 style={E.h1}>Central de Acompanhamento</h1>
        <div style={E.suave}>Visão dos últimos 7 dias dos seus alunos. Aparecem só os dados que cada um autorizou.</div>
        <button type="button" style={E.btnLink} onClick={atualizar} disabled={ocupado} data-testid="btn-atualizar-central">{ocupado ? "Atualizando..." : "Atualizar"}</button>
      </div>

      {t.alunos === 0 ? (
        <div style={E.emBreve} data-testid="central-vazia">Você ainda não tem alunos ativos. Convide o primeiro em Meus alunos.</div>
      ) : (
        <>
          <div style={E.cartao} data-testid="central-totais">
            <div style={E.h2}>Resumo da semana</div>
            <div style={{ fontSize: 15, marginTop: 6 }}>
              <strong data-testid="total-treinando">{t.treinando}</strong> de {t.alunos} {t.alunos === 1 ? "aluno treinou" : "alunos treinaram"} · {t.treinosNaSemana} {t.treinosNaSemana === 1 ? "treino" : "treinos"} no total
            </div>
            <div style={{ ...E.suave, marginTop: 6 }}>
              {t.pendentes} {t.pendentes === 1 ? "pendente" : "pendentes"} · {t.semRegistros} sem registros · {t.semAcesso} sem acesso ao histórico{t.comDesconforto ? " · " + t.comDesconforto + " com desconforto relatado" : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 12px" }} role="tablist">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)} data-testid={"filtro-" + f.id}
                style={{ border: "1px solid " + (filtro === f.id ? COR.lima : COR.borda), background: filtro === f.id ? "rgba(198,255,77,0.14)" : "transparent", color: filtro === f.id ? COR.lima : COR.texto, borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{f.rotulo}</button>
            ))}
          </div>

          {visiveis.length === 0 && <div style={E.emBreve} data-testid="central-filtro-vazio">Nenhum aluno neste filtro.</div>}
          {visiveis.map(({ vinculo: v, sit }) => {
            const [rot, cor] = ROTULO_ESTADO[sit.estado];
            return (
              <button key={v.id} type="button" onClick={() => onAbrirAluno(v.id)} data-testid={"central-aluno-" + v.id} style={{ ...E.cartao, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, color: COR.texto, fontFamily: "inherit" }}>
                <Avatar nome={v.alunoNome} tamanho={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{v.alunoNome}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                    <Etiqueta texto={rot} cor={cor} />
                    {sit.desconforto && <Etiqueta texto="Desconforto relatado" cor="aviso" />}
                  </div>
                  <div style={E.suave}>{linhaDaSituacao(sit)}</div>
                  {sit.desconforto && sit.desconfortoTexto && <div style={{ marginTop: 4, fontSize: 13, color: "#F5A524" }}>Relato: {sit.desconfortoTexto}</div>}
                </div>
                {naoLidas && naoLidas[v.id] && <Bolinha testid={"central-nova-" + v.id} />}
                <span aria-hidden="true" style={{ color: COR.suave, fontSize: 20 }}>›</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
