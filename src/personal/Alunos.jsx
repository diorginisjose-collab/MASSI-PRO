// PERSONAL MASSI - fase 3: telas do personal (lista de alunos, convites e ficha básica).
import React, { useEffect, useState } from "react";
import { COR, E } from "./estilos.js";
import { Avatar, Etiqueta, BotaoPerigo, textoConsentimento } from "./ui.jsx";
import { criarConvite, cancelarConvite, encerrarVinculo, removerEncerrado, formatarCodigo, linkDoConvite, dataCurta } from "./vinculos.js";
import { mensagemDeErro } from "./dados.js";
import { listarTreinos, treinoAtual, dataBR } from "./treinos.js";

async function copiar(texto) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch (e) { /* tenta o método antigo */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function CartaoConvite({ codigo, nomePersonal, onCancelar, ocupado, destaque }) {
  const [msg, setMsg] = useState("");
  const texto = nomePersonal + " convidou você para o Personal Massi. Código: " + formatarCodigo(codigo) + ". Ou abra: " + linkDoConvite(codigo);
  const avisar = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };
  const compartilhar = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Convite do Personal Massi", text: texto }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    avisar((await copiar(texto)) ? "Mensagem copiada. Cole no WhatsApp." : "Não consegui copiar. Copie o código acima.");
  };
  return (
    <div style={{ ...E.cartao, borderColor: destaque ? "rgba(198,255,77,0.55)" : COR.borda }} data-testid="cartao-convite">
      <div style={{ ...E.suave, marginBottom: 6 }}>Código do convite</div>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "0.08em", color: COR.lima, wordBreak: "break-all" }} data-testid="codigo-convite">{formatarCodigo(codigo)}</div>
      <div style={{ ...E.suave, marginTop: 6 }}>Envie para seu aluno. Ele cria uma conta de aluno no Massi Pro, digita o código e aceita. O convite vale até você cancelar.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" style={{ ...E.btnSec, flex: 1, marginTop: 0, minWidth: 130 }} onClick={async () => avisar((await copiar(formatarCodigo(codigo))) ? "Código copiado." : "Não consegui copiar.")} data-testid="btn-copiar-codigo">Copiar código</button>
        <button type="button" style={{ ...E.btn, flex: 1, marginTop: 0, minWidth: 130 }} onClick={compartilhar} data-testid="btn-compartilhar">Compartilhar</button>
      </div>
      {onCancelar && <button type="button" style={{ ...E.btnLink, color: COR.erro }} onClick={onCancelar} disabled={ocupado} data-testid="btn-cancelar-convite">Cancelar este convite</button>}
      {msg && <div style={E.aviso} role="status">{msg}</div>}
    </div>
  );
}

export function TelaAlunos({ perfil, vinculos, onRecarregar, onAbrirAluno }) {
  const [novo, setNovo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [verEncerrados, setVerEncerrados] = useState(false);
  const ativos = vinculos.filter((v) => v.status === "ativo");
  const pendentes = vinculos.filter((v) => v.status === "convite");
  const encerrados = vinculos.filter((v) => v.status === "encerrado");

  const executar = async (fn) => {
    setErro(""); setOcupado(true);
    try { await fn(); await onRecarregar(); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  };
  const convidar = () => executar(async () => { setNovo(await criarConvite(perfil.uid, perfil.nome)); });

  return (
    <div data-testid="tela-alunos">
      <div style={E.cartao}>
        <h1 style={E.h1}>Meus alunos</h1>
        <div style={E.suave}>{ativos.length} {ativos.length === 1 ? "aluno ativo" : "alunos ativos"} · {pendentes.length} {pendentes.length === 1 ? "convite pendente" : "convites pendentes"}</div>
        <button type="button" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={convidar} data-testid="btn-convidar">{ocupado ? "Aguarde..." : "Convidar aluno"}</button>
        <button type="button" style={E.btnLink} disabled={ocupado} onClick={() => executar(async () => {})} data-testid="btn-atualizar">Atualizar lista</button>
        {erro && <div style={E.erro} role="alert" data-testid="msg-erro">{erro}</div>}
      </div>

      {novo && <CartaoConvite codigo={novo} nomePersonal={perfil.nome} destaque ocupado={ocupado} onCancelar={() => executar(async () => { await cancelarConvite(novo); setNovo(null); })} />}

      {pendentes.filter((p) => p.id !== novo).length > 0 && (
        <div>
          <div style={{ ...E.h2, margin: "6px 2px 8px" }}>Convites pendentes</div>
          {pendentes.filter((p) => p.id !== novo).map((p) => (
            <CartaoConvite key={p.id} codigo={p.id} nomePersonal={perfil.nome} ocupado={ocupado} onCancelar={() => executar(async () => { await cancelarConvite(p.id); })} />
          ))}
        </div>
      )}

      <div style={{ ...E.h2, margin: "6px 2px 8px" }}>Alunos ativos</div>
      {ativos.length === 0 ? (
        <div style={E.emBreve} data-testid="sem-alunos">Você ainda não tem alunos. Toque em "Convidar aluno" e envie o código para o primeiro.</div>
      ) : (
        ativos.map((v) => (
          <button key={v.id} type="button" onClick={() => onAbrirAluno(v.id)} data-testid={"aluno-" + v.id} style={{ ...E.cartao, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, color: COR.texto, fontFamily: "inherit" }}>
            <Avatar nome={v.alunoNome} tamanho={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5 }}>{v.alunoNome}</div>
              <div style={E.suave}>Aluno desde {dataCurta(v.aceitoEm)} · {textoConsentimento(v.consent)}</div>
            </div>
            <span aria-hidden="true" style={{ color: COR.suave, fontSize: 20 }}>›</span>
          </button>
        ))
      )}

      {encerrados.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button type="button" style={E.btnLink} onClick={() => setVerEncerrados(!verEncerrados)} data-testid="btn-ver-encerrados">{verEncerrados ? "Ocultar encerrados" : "Ver encerrados (" + encerrados.length + ")"}</button>
          {verEncerrados && encerrados.map((v) => (
            <div key={v.id} style={{ ...E.cartao, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{v.alunoNome || "Convite não aceito"}</div>
                <div style={E.suave}>Encerrado em {dataCurta(v.encerradoEm)}</div>
              </div>
              <button type="button" style={{ ...E.btnLink, color: COR.erro }} disabled={ocupado} onClick={() => executar(async () => { await removerEncerrado(v.id); })}>Remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TelaDetalheAluno({ vinculo, perfil, onRecarregar, onVoltar, onMontarTreino, onEditarTreino }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [treinos, setTreinos] = useState(null); // null = carregando
  useEffect(() => {
    let vivo = true;
    if (vinculo && vinculo.status === "ativo") listarTreinos(vinculo.id).then((l) => { if (vivo) setTreinos(l); }).catch(() => { if (vivo) setTreinos([]); });
    return () => { vivo = false; };
  }, [vinculo && vinculo.id]);
  const atual = treinos ? treinoAtual(treinos) : null;
  if (!vinculo) return <div style={E.emBreve}>Aluno não encontrado.</div>;
  const encerrar = async () => {
    setErro(""); setOcupado(true);
    try { await encerrarVinculo(vinculo.id, perfil.uid); await onRecarregar(); onVoltar(); } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); }
  };
  const c = vinculo.consent || {};
  return (
    <div data-testid="tela-detalhe-aluno">
      <div style={E.cartao}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar nome={vinculo.alunoNome} tamanho={60} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ ...E.h1, marginBottom: 2 }}>{vinculo.alunoNome}</h1>
            <div style={E.suave}>Aluno desde {dataCurta(vinculo.aceitoEm)}</div>
          </div>
        </div>
      </div>
      <div style={E.cartao}>
        <div style={E.h2}>O que este aluno compartilha com você</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 8px" }}>
          <Etiqueta texto={"Histórico: " + (c.historico ? "sim" : "não")} cor={c.historico ? "ok" : "suave"} />
          <Etiqueta texto={"Peso: " + (c.peso ? "sim" : "não")} cor={c.peso ? "ok" : "suave"} />
          <Etiqueta texto={"Medidas: " + (c.medidas ? "sim" : "não")} cor={c.medidas ? "ok" : "suave"} />
        </div>
        <div style={E.suave}>O aluno pode mudar isso quando quiser. Você só vê o que ele autorizar.</div>
      </div>
      <div style={E.cartao} data-testid="treino-atual-aluno">
        <div style={E.h2}>Treino atual</div>
        {treinos === null ? <div style={E.suave}>Carregando...</div> : atual ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{atual.titulo}</div>
            <div style={E.suave}>Versão {atual.versao}{atual.validade ? " · válido até " + dataBR(atual.validade) : ""} · {treinos.length} {treinos.length === 1 ? "versão enviada" : "versões enviadas"}</div>
            <button type="button" style={E.btnSec} onClick={() => onEditarTreino(atual, vinculo.id)} data-testid="btn-editar-atual">Editar e enviar nova versão</button>
          </div>
        ) : (
          <div style={E.suave}>Nenhum treino enviado ainda.</div>
        )}
        <button type="button" style={E.btn} onClick={() => onMontarTreino(vinculo.id)} data-testid="btn-montar-treino">Montar novo treino para {vinculo.alunoNome.split(" ")[0]}</button>
      </div>
      <div style={E.emBreve}>Frequência, evolução de cargas, metas e observações chegam nas próximas etapas.</div>
      <div style={{ marginTop: 14 }}>
        <BotaoPerigo testid="btn-encerrar" rotulo="Encerrar vínculo" aviso="Tem certeza? Você perde o acesso aos dados deste aluno na hora." confirmar="Encerrar" aoConfirmar={encerrar} ocupado={ocupado} />
        {erro && <div style={E.erro} role="alert">{erro}</div>}
      </div>
    </div>
  );
}
