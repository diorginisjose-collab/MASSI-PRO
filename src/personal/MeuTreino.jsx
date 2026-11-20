// PERSONAL MASSI - fase 4: o aluno vê o treino enviado pelo personal (a execução e o registro de cargas vêm na fase 5).
import React, { useEffect, useState } from "react";
import { COR, E } from "./estilos.js";
import { Etiqueta } from "./ui.jsx";
import { PreviaPrograma } from "./Previa.jsx";
import { listarTreinos, treinoAtual, dataBR } from "./treinos.js";
import { dataCurta } from "./vinculos.js";
import { mensagemDeErro } from "./dados.js";

function programaDoDocumento(t) {
  const c = t.conteudo || {};
  return { nome: t.titulo, frequencia: c.frequencia || 3, inicio: t.inicio || "", validade: t.validade || "", orientacoes: c.orientacoes || "", dias: c.dias || [] };
}

export function TelaMeuTreino({ vinculos, biblioteca }) {
  const ativos = vinculos.filter((v) => v.status === "ativo");
  const [dados, setDados] = useState({}); // { vinculoId: [treinos] }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [verAntigas, setVerAntigas] = useState({});

  const carregar = async () => {
    setErro(""); setCarregando(true);
    try {
      const acc = {};
      for (const v of ativos) acc[v.id] = await listarTreinos(v.id);
      setDados(acc);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  return (
    <div data-testid="tela-meu-treino">
      <div style={E.cartao}>
        <h1 style={E.h1}>Meu treino</h1>
        <div style={E.suave}>O treino que seu personal enviou. Você não altera a prescrição dele.</div>
        <button type="button" style={E.btnLink} onClick={carregar} disabled={carregando} data-testid="btn-atualizar-treino">Atualizar</button>
        {erro && <div style={E.erro} role="alert">{erro}</div>}
      </div>
      {carregando && <div style={{ ...E.cartao, textAlign: "center", color: COR.suave }}>Carregando...</div>}
      {!carregando && ativos.length === 0 && <div style={E.emBreve} data-testid="sem-personal-treino">Você ainda não tem um personal vinculado.</div>}
      {!carregando && ativos.map((v) => {
        const lista = dados[v.id] || [];
        const atual = treinoAtual(lista);
        const antigas = lista.filter((t) => t !== atual);
        return (
          <div key={v.id} data-testid={"treino-de-" + v.id}>
            <div style={{ ...E.h2, margin: "6px 2px 8px" }}>Personal {v.personalNome}</div>
            {!atual ? (
              <div style={E.emBreve} data-testid="sem-treino">Seu personal ainda não enviou um treino.</div>
            ) : (
              <PreviaPrograma programa={programaDoDocumento(atual)} biblioteca={biblioteca} rodape={<div style={{ marginTop: 10 }}><Etiqueta texto={"Versão " + atual.versao} /> <span style={E.suave}>enviada em {dataCurta(atual.criadoEm)}</span></div>} />
            )}
            {antigas.length > 0 && (
              <div>
                <button type="button" style={E.btnLink} onClick={() => setVerAntigas({ ...verAntigas, [v.id]: !verAntigas[v.id] })} data-testid="btn-versoes">{verAntigas[v.id] ? "Esconder versões anteriores" : "Ver versões anteriores (" + antigas.length + ")"}</button>
                {verAntigas[v.id] && antigas.map((t) => (
                  <div key={t.id} data-testid={"versao-" + t.versao}>
                    <div style={{ ...E.suave, margin: "8px 2px" }}>Versão {t.versao} · {dataCurta(t.criadoEm)} · arquivada</div>
                    <PreviaPrograma programa={programaDoDocumento(t)} biblioteca={biblioteca} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
