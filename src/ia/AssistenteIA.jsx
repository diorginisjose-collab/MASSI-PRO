import React, { useEffect, useRef, useState } from "react";
import { IA_CONFIG } from "./config.js";
import { perguntarStream, mensagemDeErro, ErroIA } from "./clienteIA.js";
import { separarAcoes, descreverAcao, aplicarAcao } from "./acoesAssistente.js";
import { COR, FONTE, tela, cabecalho, botaoFechar, botaoPrimario, formatarTexto } from "./tema.js";

const SUGESTOES = [
  "Monte um treino de peito e tríceps para hoje",
  "Como melhorar meu agachamento?",
  "O que comer antes de treinar?",
  "Troque um exercício do meu treino de segunda",
];
const idMsg = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Assistente Massi — caixa de perguntas com resposta em tempo real.
 *
 * Props:
 *  onFechar()                  fecha a tela
 *  i18n { tr, trt }            funções de tradução do app
 *  idioma                      "pt" | "en" | "es"
 *  quota                       objeto MassiIA do app (consumir/devolver/situacao/inscrever)
 *  temIA                       true se o plano atual inclui IA
 *  onVerPlanos()               abre a tela de planos
 *  getContexto()               função (pode ser async) que devolve o texto de contexto do usuário
 *  acoes                       { irAba, trocarExercicio, ajustarExercicio, abrirFoto, abrirDiario }
 *  buscaLocal(texto)           opcional: devolve até 5 nomes de exercícios do app que combinam com o texto
 */
export default function AssistenteIA({ onFechar, i18n, idioma, quota, temIA, onVerPlanos, getContexto, acoes, buscaLocal }) {
  const tr = (i18n && i18n.tr) || ((x) => x);
  const trt = (i18n && i18n.trt) || ((k, a) => (a || []).reduce((t, v, i) => t.split("{" + i + "}").join(v), k));
  const [msgs, setMsgs] = useState([]);
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [usarDados, setUsarDados] = useState(true);
  const [carregado, setCarregado] = useState(false);
  const [, setTick] = useState(0);
  const fimRef = useRef(null);
  const ctrlRef = useRef(null);
  const msgsRef = useRef([]);
  msgsRef.current = msgs;

  // histórico + preferência de usar dados do app
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await window.storage.get(IA_CONFIG.chaveHistoricoChat);
        const lista = r && r.value ? JSON.parse(r.value) : [];
        if (vivo && Array.isArray(lista)) setMsgs(lista.map((m) => ({ ...m, aplicadas: m.aplicadas || {} })));
      } catch (e) { /* sem histórico */ }
      try {
        const r = await window.storage.get(IA_CONFIG.chaveUsarDados);
        if (vivo && r && r.value === "nao") setUsarDados(false);
      } catch (e) { /* padrão: usar */ }
      if (vivo) setCarregado(true);
    })();
    return () => { vivo = false; if (ctrlRef.current) ctrlRef.current.abort(); };
  }, []);
  useEffect(() => (quota && quota.inscrever ? quota.inscrever(() => setTick((n) => n + 1)) : undefined), [quota]);
  useEffect(() => { if (fimRef.current && fimRef.current.scrollIntoView) fimRef.current.scrollIntoView({ block: "end" }); }, [msgs, erro]);

  const salvarHistorico = (lista) => {
    const ultimas = lista.filter((m) => m.texto).slice(-IA_CONFIG.mensagensSalvas).map((m) => ({ id: m.id, role: m.role, texto: m.texto, acoes: m.acoes || [], aplicadas: m.aplicadas || {} }));
    try { window.storage.set(IA_CONFIG.chaveHistoricoChat, JSON.stringify(ultimas)).catch(() => {}); } catch (e) { /* segue */ }
  };
  const alternarDados = () => {
    const novo = !usarDados;
    setUsarDados(novo);
    try { window.storage.set(IA_CONFIG.chaveUsarDados, novo ? "sim" : "nao").catch(() => {}); } catch (e) { /* segue */ }
  };
  const novaConversa = () => {
    if (enviando) return;
    setMsgs([]);
    setErro("");
    salvarHistorico([]);
  };

  const situ = quota ? quota.situacao(IA_CONFIG.recursoChat) : { limite: 0, usado: 0, restante: 0, planoComIA: temIA };
  const sugestoesLocais = entrada.trim().length >= 3 && buscaLocal ? buscaLocal(entrada.trim()).slice(0, 5) : [];

  const parar = () => { if (ctrlRef.current) ctrlRef.current.abort(); };

  const enviar = async (textoManual) => {
    const texto = String(textoManual !== undefined ? textoManual : entrada).trim().slice(0, IA_CONFIG.maxCaracteresPergunta);
    if (!texto || enviando) return;
    setErro("");
    if (!temIA) return;
    const uso = await quota.consumir(IA_CONFIG.recursoChat);
    if (!uso.ok) {
      setErro(uso.motivo === "limite_mensal" ? trt("Você usou as {0} perguntas deste mês. O limite renova no começo do próximo mês.", [uso.limite]) : tr("Seu plano atual não inclui o assistente de IA."));
      return;
    }
    const idResp = idMsg();
    const historicoAntes = msgsRef.current;
    const novos = [...historicoAntes, { id: idMsg(), role: "user", texto }, { id: idResp, role: "assistant", texto: "", acoes: [], aplicadas: {}, gerando: true }];
    setMsgs(novos);
    setEntrada("");
    setEnviando(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const paraEnviar = [...historicoAntes.filter((m) => m.texto), { role: "user", texto }]
      .slice(-IA_CONFIG.mensagensEnviadas)
      .map((m) => ({ role: m.role, content: m.texto }));
    let contexto = "";
    if (usarDados && getContexto) { try { contexto = await getContexto(); } catch (e) { contexto = ""; } }
    let bruto = "";
    try {
      bruto = await perguntarStream({
        mensagens: paraEnviar, contexto, idioma, signal: ctrl.signal,
        onTexto: (t) => {
          const p = separarAcoes(t);
          setMsgs((atual) => atual.map((m) => (m.id === idResp ? { ...m, texto: p.texto } : m)));
        },
      });
      const final = separarAcoes(bruto);
      setMsgs((atual) => {
        const lista = atual.map((m) => (m.id === idResp ? { ...m, texto: final.texto || tr("(sem resposta)"), acoes: final.acoes, gerando: false } : m));
        salvarHistorico(lista);
        return lista;
      });
    } catch (e) {
      const cancelado = e instanceof ErroIA && e.codigo === "cancelado";
      setMsgs((atual) => {
        const lista = atual.filter((m) => !(m.id === idResp && !m.texto)).map((m) => (m.id === idResp ? { ...m, gerando: false } : m));
        salvarHistorico(lista);
        return lista;
      });
      if (!cancelado) {
        await quota.devolver(IA_CONFIG.recursoChat); // falhou: não gasta a sua cota
        setErro(tr(mensagemDeErro(e)));
      }
    }
    ctrlRef.current = null;
    setEnviando(false);
  };

  const aplicar = (msg, indice) => {
    const a = msg.acoes[indice];
    const r = aplicarAcao(a, acoes || {});
    setMsgs((atual) => {
      const lista = atual.map((m) => (m.id === msg.id ? { ...m, aplicadas: { ...m.aplicadas, [indice]: r.ok ? "ok" : "erro:" + (r.msg || "") } } : m));
      salvarHistorico(lista);
      return lista;
    });
  };

  const vazio = carregado && msgs.length === 0;
  return (
    <div style={tela} role="dialog" aria-label={tr("Assistente Massi")}>
      <div style={cabecalho}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>✨ {tr("Assistente Massi")}</div>
          {temIA && situ.limite > 0 && <div style={{ fontSize: 12, color: COR.suave }}>{trt("{0} de {1} perguntas restantes neste mês", [situ.restante, situ.limite])}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {msgs.length > 0 && <button style={{ ...botaoFechar, fontSize: 13 }} onClick={novaConversa} disabled={enviando}>{tr("Nova conversa")}</button>}
          <button style={botaoFechar} onClick={onFechar}>✕ {tr("Fechar")}</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 14 }}>
        {!temIA && (
          <div style={{ background: COR.card, borderRadius: 14, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>✨</div>
            <div style={{ fontWeight: 800, fontSize: 17, margin: "6px 0" }}>{tr("O assistente faz parte do Massi Pro IA")}</div>
            <div style={{ color: COR.suave, fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>{tr("Tire dúvidas, peça um treino adaptado ao seu perfil e peça ajustes na sua rotina, com respostas em tempo real. Experimente 7 dias grátis.")}</div>
            <button style={botaoPrimario} onClick={onVerPlanos}>{tr("Ver planos")}</button>
          </div>
        )}

        {temIA && vazio && (
          <div>
            <div style={{ background: COR.card, borderRadius: 14, padding: 14, marginBottom: 12, lineHeight: 1.5, fontSize: 14.5 }}>
              <strong>{tr("Oi! Sou o assistente do Massi Pro.")}</strong>{" "}
              {tr("Pergunte sobre treino, execução, alimentação ou peça ajustes na sua rotina. Eu uso o seu perfil e a sua rotina para responder.")}
              <div style={{ color: COR.suave, fontSize: 12.5, marginTop: 8 }}>{tr("Respostas geradas por IA. Não substituem profissional de saúde.")}</div>
            </div>
            <div style={{ fontSize: 12.5, color: COR.suave, margin: "0 0 6px 2px" }}>{tr("Experimente perguntar:")}</div>
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => enviar(tr(s))} style={{ display: "block", width: "100%", textAlign: "left", background: COR.card2, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 12, padding: "11px 13px", marginBottom: 8, fontSize: 14, cursor: "pointer", fontFamily: FONTE }}>
                💬 {tr(s)}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m) => (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div style={{ maxWidth: "88%", background: m.role === "user" ? COR.lime : COR.card, color: m.role === "user" ? COR.grafite : COR.texto, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 13px", fontSize: 14.5, wordBreak: "break-word" }}>
              {m.role === "user" ? m.texto : formatarTexto(React, m.texto)}
              {m.gerando && <span style={{ display: "inline-block", marginLeft: 4, color: COR.suave }}>{m.texto ? "▍" : tr("Pensando…")}</span>}
            </div>
            {m.role === "assistant" && m.acoes && m.acoes.length > 0 && (
              <div style={{ maxWidth: "88%", width: "100%", marginTop: 6 }}>
                {m.acoes.map((a, i) => {
                  const d = descreverAcao(a);
                  const estado = m.aplicadas && m.aplicadas[i];
                  const falhou = estado && String(estado).indexOf("erro") === 0;
                  return (
                    <div key={i} style={{ background: COR.card2, border: "1px solid " + COR.borda, borderRadius: 12, padding: "9px 11px", marginBottom: 6 }}>
                      <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{d.icone} {trt(d.chave, d.args)}</div>
                      {estado === "ok" ? (
                        <div style={{ fontSize: 12.5, color: COR.lime, marginTop: 4 }}>
                          ✅ {tr("Feito!")} {(a.tipo === "trocar_exercicio" || a.tipo === "ajustar_exercicio") && tr("Lembre de salvar a rotina.")}
                        </div>
                      ) : (
                        <>
                          {falhou && <div style={{ fontSize: 12.5, color: COR.vermelho, marginTop: 4 }}>{tr(String(estado).slice(5) || "Não consegui aplicar.")}</div>}
                          <button onClick={() => aplicar(m, i)} style={{ marginTop: 6, background: COR.lime, color: COR.grafite, border: "none", borderRadius: 999, padding: "6px 14px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{falhou ? tr("Tentar de novo") : tr("Aplicar")}</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {erro && <div style={{ background: "rgba(255,107,94,0.12)", border: "1px solid rgba(255,107,94,0.4)", color: "#FFB1A8", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.45, marginBottom: 12 }}>⚠️ {erro}</div>}
        <div ref={fimRef} />
      </div>

      {temIA && (
        <div style={{ borderTop: "1px solid " + COR.borda, padding: "8px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))", flexShrink: 0, background: COR.fundo }}>
          {sugestoesLocais.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
              {sugestoesLocais.map((n) => (
                <button key={n} onClick={() => setEntrada(trt("Como executar corretamente o exercício {0}?", [n]))} style={{ flexShrink: 0, background: COR.card2, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                  🔎 {n}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !/Android|iPhone|iPad/i.test(navigator.userAgent)) { e.preventDefault(); enviar(); } }}
              placeholder={tr("Pergunte ou peça algo…")}
              rows={1}
              maxLength={IA_CONFIG.maxCaracteresPergunta}
              aria-label={tr("Sua pergunta")}
              style={{ flex: 1, minWidth: 0, resize: "none", background: COR.card, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 14, padding: "11px 13px", fontSize: 15, fontFamily: FONTE, outline: "none", maxHeight: 110 }}
            />
            {enviando ? (
              <button onClick={parar} aria-label={tr("Parar")} style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 14, border: "none", background: COR.vermelho, color: "#fff", fontSize: 18, cursor: "pointer" }}>■</button>
            ) : (
              <button onClick={() => enviar()} disabled={!entrada.trim()} aria-label={tr("Enviar")} style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 14, border: "none", background: entrada.trim() ? COR.lime : COR.card2, color: entrada.trim() ? COR.grafite : COR.suave, fontSize: 20, fontWeight: 800, cursor: entrada.trim() ? "pointer" : "default" }}>➤</button>
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: COR.suave, cursor: "pointer" }}>
            <input type="checkbox" checked={usarDados} onChange={alternarDados} />
            {tr("Usar meu perfil e minha rotina para personalizar (enviados à IA)")}
          </label>
        </div>
      )}
    </div>
  );
}
