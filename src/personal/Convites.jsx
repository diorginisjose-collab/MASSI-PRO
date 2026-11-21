// PERSONAL MASSI - fase 3: telas do aluno (digitar código, aceitar convite e gerenciar vínculos).
import React, { useEffect, useState } from "react";
import { COR, E } from "./estilos.js";
import { Avatar, Etiqueta, BotaoPerigo } from "./ui.jsx";
import { buscarConvite, aceitarConvite, atualizarConsentimento, encerrarVinculo, removerEncerrado, normalizarCodigo, formatarCodigo, TAMANHO_CODIGO, dataCurta } from "./vinculos.js";
import { mensagemDeErro } from "./dados.js";

function Interruptor({ rotulo, descricao, valor, aoMudar, desabilitado, testid }) {
  return (
    <label style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid " + COR.borda, cursor: desabilitado ? "default" : "pointer" }}>
      <input type="checkbox" checked={!!valor} disabled={desabilitado} onChange={(e) => aoMudar(e.target.checked)} data-testid={testid} style={{ width: 24, height: 24, marginTop: 1, accentColor: COR.lima, flexShrink: 0 }} />
      <span><strong style={{ display: "block", fontSize: 15 }}>{rotulo}</strong><span style={E.suave}>{descricao}</span></span>
    </label>
  );
}

export function TelaConvite({ perfil, codigoInicial, onConcluir }) {
  const [codigo, setCodigo] = useState(normalizarCodigo(codigoInicial));
  const [convite, setConvite] = useState(null);
  const [consent, setConsent] = useState({ historico: false, peso: false, medidas: false });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const procurar = async (valor) => {
    const c = normalizarCodigo(valor);
    setErro("");
    if (c.length !== TAMANHO_CODIGO) { setErro("O código tem " + TAMANHO_CODIGO + " letras e números."); return; }
    setOcupado(true);
    try {
      const achado = await buscarConvite(c);
      if (!achado) { setErro("Código não encontrado ou convite que não está mais disponível. Peça um novo ao seu personal."); }
      else setConvite(achado);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(false); }
  };

  useEffect(() => { if (normalizarCodigo(codigoInicial).length === TAMANHO_CODIGO) procurar(codigoInicial); }, []);

  const aceitar = async () => {
    setErro(""); setOcupado(true);
    try { await aceitarConvite(convite.id, perfil.uid, perfil.nome, consent); await onConcluir(); } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); }
  };

  if (convite) {
    return (
      <div data-testid="tela-aceitar">
        <div style={E.cartao}>
          <h1 style={E.h1}>{convite.personalNome} quer te acompanhar</h1>
          <div style={E.suave}>Escolha o que ele pode ver. Se não marcar nada, ele só sabe que vocês estão vinculados e pode enviar treinos. Você muda isso quando quiser.</div>
          <div style={{ marginTop: 10 }}>
            <Interruptor testid="cons-historico" rotulo="Histórico de treinos" descricao="Treinos que você concluir, frequência e cargas." valor={consent.historico} aoMudar={(v) => setConsent({ ...consent, historico: v })} />
            <Interruptor testid="cons-peso" rotulo="Peso" descricao="Seus registros de peso." valor={consent.peso} aoMudar={(v) => setConsent({ ...consent, peso: v })} />
            <Interruptor testid="cons-medidas" rotulo="Medidas" descricao="Suas medidas corporais." valor={consent.medidas} aoMudar={(v) => setConsent({ ...consent, medidas: v })} />
          </div>
          <button type="button" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={aceitar} data-testid="btn-aceitar">{ocupado ? "Vinculando..." : "Aceitar e vincular"}</button>
          <button type="button" style={E.btnSec} disabled={ocupado} onClick={() => { setConvite(null); setCodigo(""); }} data-testid="btn-agora-nao">Agora não</button>
          {erro && <div style={E.erro} role="alert" data-testid="msg-erro">{erro}</div>}
        </div>
      </div>
    );
  }

  return (
    <form data-testid="tela-codigo" style={E.cartao} onSubmit={(ev) => { ev.preventDefault(); procurar(codigo); }}>
      <h1 style={E.h1}>Código de convite</h1>
      <div style={E.suave}>Digite o código que seu personal enviou.</div>
      <label style={E.rotulo} htmlFor="cv-codigo">Código</label>
      <input id="cv-codigo" data-testid="campo-codigo" style={{ ...E.campo, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 800 }} type="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={TAMANHO_CODIGO + 2} placeholder="K7M2Q-X9P4A" value={formatarCodigo(codigo)} onChange={(e) => setCodigo(normalizarCodigo(e.target.value))} />
      <button type="submit" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} data-testid="btn-continuar-codigo">{ocupado ? "Procurando..." : "Continuar"}</button>
      {erro && <div style={E.erro} role="alert" data-testid="msg-erro">{erro}</div>}
    </form>
  );
}

export function TelaMeuPersonal({ perfil, vinculos, onRecarregar, onVoltar }) {
  const [ocupado, setOcupado] = useState(null);
  const [erro, setErro] = useState("");
  const [verEncerrados, setVerEncerrados] = useState(false);
  const ativos = vinculos.filter((v) => v.status === "ativo");
  const encerrados = vinculos.filter((v) => v.status === "encerrado");

  const executar = async (id, fn) => {
    setErro(""); setOcupado(id);
    try { await fn(); await onRecarregar(); } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(null); }
  };

  return (
    <div data-testid="tela-meu-personal">
      <div style={E.cartao}>
        <h1 style={E.h1}>Meu personal</h1>
        <div style={E.suave}>Aqui você vê com quem está vinculado e escolhe o que cada personal pode ver.</div>
        {erro && <div style={E.erro} role="alert" data-testid="msg-erro">{erro}</div>}
      </div>
      {ativos.length === 0 && <div style={E.emBreve} data-testid="sem-personal">Você ainda não tem um personal vinculado. Volte e use "Código de convite".</div>}
      {ativos.map((v) => {
        const c = v.consent || {};
        const trabalhando = ocupado === v.id;
        const mudar = (campo) => (valor) => executar(v.id, async () => { await atualizarConsentimento(v.id, { ...c, [campo]: valor }); });
        return (
          <div key={v.id} style={E.cartao} data-testid={"personal-" + v.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar nome={v.personalNome} tamanho={48} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 17 }}>{v.personalNome}</div>
                <div style={E.suave}>Vinculado desde {dataCurta(v.aceitoEm)}</div>
              </div>
            </div>
            <div style={{ ...E.rotulo, marginTop: 14 }}>O que este personal pode ver</div>
            <Interruptor testid={"cons-historico-" + v.id} rotulo="Histórico de treinos" descricao="Treinos concluídos, frequência e cargas." valor={c.historico} aoMudar={mudar("historico")} desabilitado={trabalhando} />
            <Interruptor testid={"cons-peso-" + v.id} rotulo="Peso" descricao="Seus registros de peso." valor={c.peso} aoMudar={mudar("peso")} desabilitado={trabalhando} />
            <Interruptor testid={"cons-medidas-" + v.id} rotulo="Medidas" descricao="Suas medidas corporais." valor={c.medidas} aoMudar={mudar("medidas")} desabilitado={trabalhando} />
            <div style={{ marginTop: 8 }}>
              <BotaoPerigo testid={"encerrar-" + v.id} rotulo="Encerrar vínculo" aviso="Tem certeza? Este personal perde o acesso aos seus dados na hora. Os treinos que você já recebeu continuam com você." confirmar="Encerrar" aoConfirmar={() => executar(v.id, async () => { await encerrarVinculo(v.id, perfil.uid); })} ocupado={trabalhando} />
            </div>
          </div>
        );
      })}
      {encerrados.length > 0 && (
        <div>
          <button type="button" style={E.btnLink} onClick={() => setVerEncerrados(!verEncerrados)}>{verEncerrados ? "Ocultar encerrados" : "Ver encerrados (" + encerrados.length + ")"}</button>
          {verEncerrados && encerrados.map((v) => (
            <div key={v.id} style={{ ...E.cartao, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{v.personalNome}</div>
                <div style={E.suave}>Encerrado em {dataCurta(v.encerradoEm)}</div>
              </div>
              <button type="button" style={{ ...E.btnLink, color: COR.erro }} disabled={ocupado === v.id} onClick={() => executar(v.id, async () => { await removerEncerrado(v.id); })}>Remover</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
