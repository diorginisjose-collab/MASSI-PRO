// PERSONAL MASSI - fase 6: telas de mensagens (lista de conversas e conversa).
import React, { useEffect, useRef, useState } from "react";
import { COR, E } from "./estilos.js";
import { Avatar } from "./ui.jsx";
import { listarMensagens, enviarMensagem, marcarComoLida, contarNaoLidasDeVarios, milis, LIMITE_TEXTO } from "./mensagens.js";
import { mensagemDeErro } from "./dados.js";

const INTERVALO_MS = 20000; // atualização enquanto a conversa está aberta

export function horaCurta(t) {
  const ms = milis(t);
  if (!ms) return "";
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function Bolinha({ testid }) {
  return <span data-testid={testid} aria-label="Mensagem não lida" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: COR.lima, flexShrink: 0 }} />;
}

export function Conversa({ vinculo, perfil, papel, onVoltar, aoLer }) {
  const [msgs, setMsgs] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef(null);
  const vivoRef = useRef(true);
  const ativo = vinculo.status === "ativo";
  const nomeOutro = papel === "personal" ? vinculo.alunoNome : vinculo.personalNome;

  const lidoAteRef = useRef(-1); // horário da última mensagem recebida que já marquei como lida (-1 = ainda não marquei nada)
  const carregar = async () => {
    try {
      const l = await listarMensagens(vinculo.id, 50);
      if (!vivoRef.current) return;
      setMsgs(l);
      if (ativo) {
        const recebidas = l.filter((m) => m.autorUid !== perfil.uid).map((m) => milis(m.criadoEm));
        const maisNova = recebidas.length ? Math.max(...recebidas) : 0;
        // marca como lida ao abrir a conversa e, depois, só quando chega mensagem nova (evita uma gravação a cada atualização)
        if (lidoAteRef.current < 0 || maisNova > lidoAteRef.current) {
          const antes = lidoAteRef.current;
          lidoAteRef.current = maisNova; // mesmo se falhar, só tenta de novo quando chegar mensagem nova (não insiste a cada atualização)
          try { await marcarComoLida(vinculo.id, papel); if (aoLer) aoLer(vinculo.id); } catch (e) { void antes; /* o contador se acerta na próxima vez */ }
        }
      }
    } catch (e) {
      if (vivoRef.current) { setMsgs((m) => m || []); setErro(mensagemDeErro(e)); }
    }
  };
  useEffect(() => {
    vivoRef.current = true;
    carregar();
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) carregar(); }, INTERVALO_MS);
    return () => { vivoRef.current = false; clearInterval(t); };
  }, [vinculo.id]);
  useEffect(() => { if (fimRef.current && fimRef.current.scrollIntoView) fimRef.current.scrollIntoView({ block: "end" }); }, [msgs && msgs.length]);

  const enviar = async (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (!texto.trim() || enviando || !ativo) return;
    setErro(""); setEnviando(true);
    try {
      await enviarMensagem(vinculo.id, perfil.uid, papel, texto);
      setTexto("");
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e)); // o texto fica na caixa para tentar de novo
    } finally {
      if (vivoRef.current) setEnviando(false);
    }
  };

  return (
    <div data-testid="tela-conversa">
      <div style={{ ...E.cartao, display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar nome={nomeOutro || "?"} tamanho={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{nomeOutro}</div>
          <div style={E.suave}>{papel === "personal" ? "Seu aluno" : "Seu personal"}</div>
        </div>
        <button type="button" style={{ ...E.btnLink, marginTop: 0 }} onClick={carregar} data-testid="btn-atualizar-conversa">Atualizar</button>
      </div>
      <div style={{ ...E.cartao, minHeight: 200 }} data-testid="lista-mensagens">
        {msgs === null && <div style={E.suave}>Carregando...</div>}
        {msgs && msgs.length === 0 && <div style={E.suave} data-testid="sem-mensagens">Nenhuma mensagem ainda. Escreva a primeira abaixo.</div>}
        {msgs && msgs.map((m) => {
          const minha = m.autorUid === perfil.uid;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: minha ? "flex-end" : "flex-start", marginBottom: 8 }} data-testid={minha ? "msg-minha" : "msg-outro"}>
              <div style={{ maxWidth: "82%", padding: "8px 12px", borderRadius: 14, background: minha ? "rgba(198,255,77,0.16)" : "rgba(255,255,255,0.07)", border: "1px solid " + (minha ? "rgba(198,255,77,0.4)" : COR.borda) }}>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14.5 }}>{m.texto}</div>
                <div style={{ ...E.suave, fontSize: 11, marginTop: 3, textAlign: "right" }}>{horaCurta(m.criadoEm)}</div>
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>
      {ativo ? (
        <form style={E.cartao} onSubmit={enviar} noValidate>
          <textarea data-testid="campo-mensagem" style={{ ...E.campo, minHeight: 70, resize: "vertical" }} maxLength={LIMITE_TEXTO} placeholder="Escreva sua mensagem" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensagem" />
          <button type="submit" style={{ ...E.btn, opacity: enviando || !texto.trim() ? 0.6 : 1 }} disabled={enviando || !texto.trim()} data-testid="btn-enviar-mensagem">{enviando ? "Enviando..." : "Enviar"}</button>
          {erro && <div style={E.erro} role="alert" data-testid="msg-erro">{erro}</div>}
        </form>
      ) : (
        <div style={E.emBreve} data-testid="vinculo-encerrado">Este vínculo foi encerrado. Não dá mais para enviar mensagens.</div>
      )}
      <button type="button" style={E.btnSec} onClick={onVoltar} data-testid="btn-voltar-conversas">Voltar às conversas</button>
    </div>
  );
}

export function TelaMensagens({ vinculos, perfil, papel, vinculoInicialId, onNaoLidasMudou }) {
  const ativos = vinculos.filter((v) => v.status === "ativo");
  const [abertoId, setAbertoId] = useState(vinculoInicialId || (ativos.length === 1 && papel === "aluno" ? ativos[0].id : null));
  const [naoLidas, setNaoLidas] = useState(null);
  const vivoRef = useRef(true);
  const recarregar = async () => {
    const m = await contarNaoLidasDeVarios(ativos, papel);
    if (vivoRef.current) { setNaoLidas(m); if (onNaoLidasMudou) onNaoLidasMudou(m); }
  };
  // Com uma conversa aberta, ela mesma avisa quando marca como lida (evita ler o estado antes da gravação terminar).
  // Ao voltar para a lista, os avisos são lidos de novo.
  useEffect(() => { vivoRef.current = true; if (!abertoId) recarregar(); return () => { vivoRef.current = false; }; }, [abertoId]);
  const aoLer = (id) => {
    setNaoLidas((m) => ({ ...(m || {}), [id]: false }));
    if (onNaoLidasMudou) onNaoLidasMudou({ [id]: false }); // o painel junta isto aos avisos que já tem
  };

  const aberto = abertoId ? ativos.find((v) => v.id === abertoId) : null;
  if (aberto) {
    return <Conversa vinculo={aberto} perfil={perfil} papel={papel} onVoltar={() => setAbertoId(null)} aoLer={aoLer} />;
  }
  return (
    <div data-testid="tela-mensagens">
      <div style={E.cartao}>
        <h1 style={E.h1}>Mensagens</h1>
        <div style={E.suave}>{papel === "personal" ? "Converse com seus alunos." : "Converse com seu personal."} Só vocês dois veem estas mensagens.</div>
        <button type="button" style={E.btnLink} onClick={recarregar} data-testid="btn-atualizar-mensagens">Atualizar</button>
      </div>
      {ativos.length === 0 && <div style={E.emBreve} data-testid="sem-conversas">{papel === "personal" ? "Você ainda não tem alunos ativos." : "Você ainda não tem um personal vinculado."}</div>}
      {ativos.map((v) => {
        const nome = papel === "personal" ? v.alunoNome : v.personalNome;
        const nova = !!(naoLidas && naoLidas[v.id]);
        return (
          <button key={v.id} type="button" onClick={() => setAbertoId(v.id)} data-testid={"conversa-" + v.id} style={{ ...E.cartao, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, color: COR.texto, fontFamily: "inherit" }}>
            <Avatar nome={nome || "?"} tamanho={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: nova ? 900 : 800, fontSize: 15.5 }}>{nome}</div>
              <div style={E.suave}>{nova ? "Mensagem nova" : "Abrir conversa"}</div>
            </div>
            {nova && <Bolinha testid={"nova-" + v.id} />}
            <span aria-hidden="true" style={{ color: COR.suave, fontSize: 20 }}>›</span>
          </button>
        );
      })}
    </div>
  );
}
