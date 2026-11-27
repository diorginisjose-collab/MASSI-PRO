// PERSONAL MASSI - fase 5: "Como foi seu treino?" depois de concluir um treino enviado pelo personal.
import React, { useEffect, useState } from "react";
import { COR, E } from "./estilos.js";
import { Etiqueta } from "./ui.jsx";
import { montarConclusao, enviarConclusao, lerConsentimento, esvaziarFila, ROTULO_DIFICULDADE } from "./conclusao.js";
import { atualizarConsentimento } from "./vinculos.js";
import { mensagemDeErro } from "./dados.js";

function Opcoes({ valor, opcoes, aoMudar, testid }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {opcoes.map(([v, rot]) => (
        <button key={String(v)} type="button" aria-pressed={valor === v} onClick={() => aoMudar(v)} data-testid={testid + "-" + v} style={{ flex: "1 1 120px", minHeight: 48, padding: "6px 10px", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 14, fontFamily: "inherit", border: "1.5px solid " + (valor === v ? COR.lima : COR.borda), background: valor === v ? "rgba(198,255,77,0.16)" : COR.cartao, color: valor === v ? COR.lima : COR.texto }}>{rot}</button>
      ))}
    </div>
  );
}

const MENSAGENS = {
  enviado: "Enviado ao seu personal. Bom descanso!",
  fila: "Sem conexão agora. Guardei o resumo e envio quando você abrir o Personal Massi com internet.",
  privado: "Seu personal não vê este treino porque você não compartilha o histórico com ele. O treino continua salvo no seu histórico do Massi Pro.",
  encerrado: "Seu vínculo com este personal foi encerrado. O treino ficou só no seu histórico do Massi Pro.",
  negado: "Não consegui enviar por falta de permissão no servidor. O treino continua salvo no seu histórico do Massi Pro. Avise o suporte do Massi Pro.",
};

export default function CheckinTreino({ dados, aoFechar }) {
  const { registro, entry } = dados;
  const ref = entry.personalRef || {};
  const [consent, setConsent] = useState(null);
  const [completou, setCompletou] = useState(null);
  const [dificuldade, setDificuldade] = useState(null);
  const [desconforto, setDesconforto] = useState(null);
  const [desconfortoTexto, setDesconfortoTexto] = useState("");
  const [todasSeries, setTodasSeries] = useState(null);
  const [obs, setObs] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [pendente, setPendente] = useState(null); // conclusão aguardando a decisão sobre compartilhar o histórico

  useEffect(() => {
    esvaziarFila().catch(() => {});
    lerConsentimento(ref.vinculoId).then(setConsent).catch(() => setConsent(null));
  }, []);

  const pronto = completou && dificuldade && desconforto !== null && (desconforto === false || desconfortoTexto.trim().length > 0);

  const mandar = async (checkin) => {
    setErro(""); setOcupado(true);
    try {
      const conclusao = montarConclusao(registro, entry, checkin);
      const sabeNaoCompartilha = consent && consent.ativo && !consent.historico;
      if (sabeNaoCompartilha) { setPendente(conclusao); setOcupado(false); return; }
      const r = await enviarConclusao({ vinculoId: ref.vinculoId, id: registro.id, conclusao, meta: { frequencia: ref.frequencia } });
      setResultado(r);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  };
  const enviarComCheckin = () => mandar({ completou, dificuldade, desconforto, desconfortoTexto: desconforto ? desconfortoTexto.trim().slice(0, 200) : "", todasSeries, obs: obs.trim().slice(0, 500), em: new Date().toISOString() });

  const decidirCompartilhar = async (compartilhar) => {
    setErro(""); setOcupado(true);
    try {
      if (!compartilhar) { setResultado("privado"); return; }
      const atual = (consent && consent.vinculo && consent.vinculo.consent) || {};
      await atualizarConsentimento(ref.vinculoId, { ...atual, historico: true });
      setResultado(await enviarConclusao({ vinculoId: ref.vinculoId, id: registro.id, conclusao: pendente, meta: { frequencia: ref.frequencia } }));
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  };

  return (
    <div style={{ ...E.pagina, zIndex: 700 }} data-testid="checkin">
      <div style={E.miolo}>
        <div style={E.topo}>
          <div style={E.marca}>COMO FOI SEU TREINO?<div style={E.marcaSub}>{ref.titulo || "Treino do personal"} · Treino {ref.letra}</div></div>
        </div>

        {resultado ? (
          <div style={E.cartao} data-testid="checkin-resultado">
            <h1 style={E.h1}>{resultado === "enviado" ? "Pronto!" : "Treino registrado"}</h1>
            <div style={E.suave}>{MENSAGENS[resultado]}</div>
            <button type="button" style={E.btn} onClick={aoFechar} data-testid="checkin-fechar">Fechar</button>
          </div>
        ) : pendente ? (
          <div style={E.cartao} data-testid="checkin-compartilhar">
            <h1 style={E.h1}>Compartilhar este treino?</h1>
            <div style={E.suave}>Você ainda não compartilha seu histórico de treinos com {ref.personalNome || "seu personal"}. Para ele ver este treino e suas respostas, é preciso liberar o histórico. Você pode desligar quando quiser em "Meu personal".</div>
            <button type="button" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={() => decidirCompartilhar(true)} data-testid="checkin-sim-compartilhar">Compartilhar histórico e enviar</button>
            <button type="button" style={E.btnSec} disabled={ocupado} onClick={() => decidirCompartilhar(false)} data-testid="checkin-nao-compartilhar">Manter privado</button>
            {erro && <div style={E.erro} role="alert">{erro}</div>}
          </div>
        ) : (
          <div>
            <div style={E.cartao}>
              <div style={E.h2}>Conseguiu completar o treino?</div>
              <Opcoes testid="ck-completou" valor={completou} aoMudar={setCompletou} opcoes={[["tudo", "Sim, tudo"], ["quase", "Quase tudo"], ["parte", "Só uma parte"]]} />
            </div>
            <div style={E.cartao}>
              <div style={E.h2}>Qual foi o nível de dificuldade?</div>
              <Opcoes testid="ck-dif" valor={dificuldade} aoMudar={setDificuldade} opcoes={[1, 2, 3, 4, 5].map((n) => [n, n + " · " + ROTULO_DIFICULDADE[n]])} />
            </div>
            <div style={E.cartao}>
              <div style={E.h2}>Sentiu algum desconforto?</div>
              <Opcoes testid="ck-desc" valor={desconforto} aoMudar={setDesconforto} opcoes={[[false, "Não"], [true, "Sim"]]} />
              {desconforto === true && (
                <div>
                  <label style={E.rotulo} htmlFor="ck-desc-txt">Onde e como foi?</label>
                  <input id="ck-desc-txt" data-testid="ck-desc-texto" style={E.campo} type="text" maxLength={200} placeholder="Ex.: dor no ombro direito no supino" value={desconfortoTexto} onChange={(e) => setDesconfortoTexto(e.target.value)} />
                  <div style={{ ...E.aviso }}>Seu personal vai receber um aviso. Se a dor for forte ou não passar, procure atendimento de saúde.</div>
                </div>
              )}
            </div>
            <div style={E.cartao}>
              <div style={E.h2}>Conseguiu fazer todas as séries?</div>
              <Opcoes testid="ck-series" valor={todasSeries} aoMudar={setTodasSeries} opcoes={[[true, "Sim"], [false, "Não"]]} />
            </div>
            <div style={E.cartao}>
              <label style={E.h2} htmlFor="ck-obs">Quer deixar uma observação?</label>
              <textarea id="ck-obs" data-testid="ck-obs" style={{ ...E.campo, minHeight: 80, resize: "vertical" }} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <button type="button" style={{ ...E.btn, opacity: pronto && !ocupado ? 1 : 0.5 }} disabled={!pronto || ocupado} onClick={enviarComCheckin} data-testid="ck-enviar">{ocupado ? "Enviando..." : "Enviar ao meu personal"}</button>
            <button type="button" style={E.btnSec} disabled={ocupado} onClick={() => mandar(null)} data-testid="ck-pular">Agora não</button>
            {erro && <div style={E.erro} role="alert" data-testid="ck-erro">{erro}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
