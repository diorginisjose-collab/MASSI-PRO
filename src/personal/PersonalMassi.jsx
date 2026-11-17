// PERSONAL MASSI - fase 2: cadastro, login, perfil e painéis iniciais.
// Módulo independente: não lê nem altera nenhum dado do Massi Pro atual.
import React, { useEffect, useRef, useState } from "react";
import { COR, E } from "./estilos.js";
import {
  observarLogin, carregarPerfil, cadastrar, entrar, sair, recuperarSenha,
  salvarPerfil, salvarProfissional, garantirProfissional, criarPerfil, reduzirFoto, mensagemDeErro,
} from "./dados.js";

function Avatar({ nome, foto, tamanho = 44 }) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase() || "?";
  const base = { width: tamanho, height: tamanho, borderRadius: "50%", flexShrink: 0, border: "2px solid " + COR.lima, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(198,255,77,0.1)", color: COR.lima, fontWeight: 900, fontSize: tamanho * 0.42 };
  if (foto) return <div style={base}><img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={base} aria-hidden="true">{inicial}</div>;
}

function Topo({ aoFechar, titulo, direita }) {
  return (
    <div style={E.topo}>
      <button type="button" style={E.btnIcone} onClick={aoFechar} aria-label="Voltar ao Massi Pro" data-testid="personal-fechar">←</button>
      <div style={E.marca}>
        PERSONAL MASSI
        <div style={E.marcaSub}>{titulo || "Treinos e acompanhamento com seu personal"}</div>
      </div>
      {direita}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entrar e criar conta
// ---------------------------------------------------------------------------
function TelaAcesso({ onEntrar, onCadastrar, ocupado, erro, aviso, onRecuperar }) {
  const [modo, setModo] = useState("entrar");
  const [tipo, setTipo] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [aceito, setAceito] = useState(false);
  const [erroLocal, setErroLocal] = useState("");

  const enviarEntrar = (ev) => {
    ev.preventDefault();
    setErroLocal("");
    if (!email.trim() || !senha) { setErroLocal("Preencha e-mail e senha."); return; }
    onEntrar(email, senha);
  };
  const enviarCadastro = (ev) => {
    ev.preventDefault();
    setErroLocal("");
    if (!tipo) { setErroLocal("Escolha se você é personal ou aluno."); return; }
    if (!nome.trim()) { setErroLocal("Digite seu nome."); return; }
    if (!email.trim()) { setErroLocal("Digite o e-mail."); return; }
    if (senha.length < 6) { setErroLocal("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (senha !== senha2) { setErroLocal("As senhas não são iguais."); return; }
    if (!aceito) { setErroLocal("Para criar a conta, marque que você leu e concorda."); return; }
    onCadastrar({ tipo, nome, email, senha });
  };

  return (
    <div>
      <div style={E.cartao}>
        <h1 style={E.h1}>Bem-vindo ao Personal Massi</h1>
        <div style={E.suave}>Personal trainers montam e enviam treinos. Alunos recebem, executam e acompanham a evolução. Tudo integrado ao Massi Pro.</div>
      </div>

      <div style={E.abas} role="tablist">
        <button type="button" role="tab" aria-selected={modo === "entrar"} style={E.aba(modo === "entrar")} onClick={() => { setModo("entrar"); setErroLocal(""); }} data-testid="aba-entrar">Entrar</button>
        <button type="button" role="tab" aria-selected={modo === "cadastro"} style={E.aba(modo === "cadastro")} onClick={() => { setModo("cadastro"); setErroLocal(""); }} data-testid="aba-cadastro">Criar conta</button>
      </div>

      {modo === "entrar" ? (
        <form style={E.cartao} onSubmit={enviarEntrar} noValidate>
          <label style={E.rotulo} htmlFor="pm-email">E-mail</label>
          <input id="pm-email" data-testid="campo-email" style={E.campo} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label style={E.rotulo} htmlFor="pm-senha">Senha</label>
          <input id="pm-senha" data-testid="campo-senha" style={E.campo} type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button type="submit" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} data-testid="btn-entrar">{ocupado ? "Entrando..." : "Entrar"}</button>
          <div style={{ textAlign: "center" }}>
            <button type="button" style={E.btnLink} onClick={() => onRecuperar(email)} disabled={ocupado} data-testid="btn-esqueci">Esqueci minha senha</button>
          </div>
          {(erroLocal || erro) && <div style={E.erro} role="alert" data-testid="msg-erro">{erroLocal || erro}</div>}
          {aviso && <div style={E.aviso} role="status" data-testid="msg-aviso">{aviso}</div>}
        </form>
      ) : (
        <form style={E.cartao} onSubmit={enviarCadastro} noValidate>
          <div style={{ ...E.h2, marginBottom: 10 }}>Como você vai usar?</div>
          <button type="button" style={E.escolha(tipo === "personal")} onClick={() => setTipo("personal")} data-testid="tipo-personal" aria-pressed={tipo === "personal"}>
            <span style={{ fontSize: 28 }} aria-hidden="true">🏋️</span>
            <span><strong style={{ display: "block", fontSize: 15.5 }}>Sou Personal Trainer</strong><span style={E.suave}>Quero acompanhar meus alunos e enviar treinos.</span></span>
          </button>
          <button type="button" style={E.escolha(tipo === "aluno")} onClick={() => setTipo("aluno")} data-testid="tipo-aluno" aria-pressed={tipo === "aluno"}>
            <span style={{ fontSize: 28 }} aria-hidden="true">💪</span>
            <span><strong style={{ display: "block", fontSize: 15.5 }}>Sou Aluno</strong><span style={E.suave}>Quero receber treinos do meu personal.</span></span>
          </button>

          <label style={E.rotulo} htmlFor="pm-nome">Nome</label>
          <input id="pm-nome" data-testid="campo-nome" style={E.campo} type="text" autoComplete="name" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
          <label style={E.rotulo} htmlFor="pm-email2">E-mail</label>
          <input id="pm-email2" data-testid="campo-email" style={E.campo} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label style={E.rotulo} htmlFor="pm-senha-n">Senha (mínimo 6 caracteres)</label>
          <input id="pm-senha-n" data-testid="campo-senha" style={E.campo} type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <label style={E.rotulo} htmlFor="pm-senha-c">Repita a senha</label>
          <input id="pm-senha-c" data-testid="campo-senha2" style={E.campo} type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} />

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
            <input type="checkbox" data-testid="aceite" checked={aceito} onChange={(e) => setAceito(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, accentColor: COR.lima, flexShrink: 0 }} />
            <span style={{ ...E.suave, fontSize: 13 }}>
              Li e concordo. Ao criar a conta, meu nome, e-mail e foto ficam guardados na nuvem (Google Firebase). Dados de treino, peso e medidas só são vistos por um personal depois que eu aceitar o convite e escolher o que compartilhar, e posso cancelar quando quiser.
            </span>
          </label>

          <button type="submit" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} data-testid="btn-criar">{ocupado ? "Criando conta..." : "Criar conta"}</button>
          {(erroLocal || erro) && <div style={E.erro} role="alert" data-testid="msg-erro">{erroLocal || erro}</div>}
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completar cadastro (conta existe, mas o perfil não foi criado)
// ---------------------------------------------------------------------------
function TelaCompletar({ onConcluir, onSair, ocupado, erro }) {
  const [tipo, setTipo] = useState(null);
  const [nome, setNome] = useState("");
  const [erroLocal, setErroLocal] = useState("");
  const enviar = (ev) => {
    ev.preventDefault();
    if (!tipo) { setErroLocal("Escolha se você é personal ou aluno."); return; }
    if (!nome.trim()) { setErroLocal("Digite seu nome."); return; }
    setErroLocal("");
    onConcluir({ tipo, nome });
  };
  return (
    <form style={E.cartao} onSubmit={enviar} noValidate data-testid="tela-completar">
      <h1 style={E.h1}>Falta pouco</h1>
      <div style={E.suave}>Sua conta foi criada, mas o cadastro não terminou. Complete abaixo.</div>
      <button type="button" style={{ ...E.escolha(tipo === "personal"), marginTop: 14 }} onClick={() => setTipo("personal")} data-testid="tipo-personal"><span style={{ fontSize: 26 }}>🏋️</span><strong>Sou Personal Trainer</strong></button>
      <button type="button" style={E.escolha(tipo === "aluno")} onClick={() => setTipo("aluno")} data-testid="tipo-aluno"><span style={{ fontSize: 26 }}>💪</span><strong>Sou Aluno</strong></button>
      <label style={E.rotulo} htmlFor="pm-nome-c">Nome</label>
      <input id="pm-nome-c" data-testid="campo-nome" style={E.campo} type="text" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
      <button type="submit" style={{ ...E.btn, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} data-testid="btn-completar">{ocupado ? "Salvando..." : "Concluir cadastro"}</button>
      <button type="button" style={E.btnSec} onClick={onSair}>Sair desta conta</button>
      {(erroLocal || erro) && <div style={E.erro} role="alert">{erroLocal || erro}</div>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Perfil (nome, foto e dados profissionais)
// ---------------------------------------------------------------------------
function TelaPerfil({ perfil, aoSalvar, aoVoltar, aoSair }) {
  const [nome, setNome] = useState(perfil.nome || "");
  const [foto, setFoto] = useState(perfil.foto || null);
  const prof = perfil.profissional || {};
  const [cref, setCref] = useState(prof.cref || "");
  const [bio, setBio] = useState(prof.bio || "");
  const [espec, setEspec] = useState(Array.isArray(prof.especialidades) ? prof.especialidades : []);
  const [novaEspec, setNovaEspec] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const entradaFoto = useRef(null);

  const escolherFoto = async (ev) => {
    const arq = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!arq) return;
    setErro("");
    try { setFoto(await reduzirFoto(arq)); } catch (e) { setErro(mensagemDeErro(e)); }
  };
  const addEspec = () => {
    const t = novaEspec.trim();
    if (!t || espec.length >= 12 || espec.indexOf(t) >= 0) { setNovaEspec(""); return; }
    setEspec([...espec, t.slice(0, 40)]);
    setNovaEspec("");
  };
  const salvar = async () => {
    setErro(""); setMsg("");
    if (!nome.trim()) { setErro("O nome não pode ficar vazio."); return; }
    setSalvando(true);
    try {
      await salvarPerfil(perfil.uid, { nome, foto });
      if (perfil.tipo === "personal") await salvarProfissional(perfil.uid, { cref, especialidades: espec, bio });
      await aoSalvar();
      setMsg("Perfil salvo.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div data-testid="tela-perfil">
      <div style={E.cartao}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar nome={nome} foto={foto} tamanho={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <button type="button" style={E.btnSec} onClick={() => entradaFoto.current && entradaFoto.current.click()} data-testid="btn-foto">{foto ? "Trocar foto" : "Adicionar foto"}</button>
            {foto && <button type="button" style={E.btnLink} onClick={() => setFoto(null)}>Remover foto</button>}
            <input ref={entradaFoto} type="file" accept="image/*" onChange={escolherFoto} style={{ display: "none" }} data-testid="input-foto" />
          </div>
        </div>
        <label style={E.rotulo} htmlFor="pf-nome">Nome</label>
        <input id="pf-nome" data-testid="perfil-nome" style={E.campo} type="text" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />

        {perfil.tipo === "personal" && (
          <>
            <label style={E.rotulo} htmlFor="pf-cref">CREF (opcional, apenas informativo)</label>
            <input id="pf-cref" style={E.campo} type="text" maxLength={30} value={cref} onChange={(e) => setCref(e.target.value)} />
            <label style={E.rotulo} htmlFor="pf-bio">Sobre você (opcional)</label>
            <textarea id="pf-bio" style={{ ...E.campo, minHeight: 90, resize: "vertical" }} maxLength={600} value={bio} onChange={(e) => setBio(e.target.value)} />
            <div style={E.rotulo}>Especialidades</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {espec.map((t) => (
                <button key={t} type="button" onClick={() => setEspec(espec.filter((x) => x !== t))} style={{ border: "1px solid rgba(198,255,77,0.5)", background: "rgba(198,255,77,0.1)", color: COR.lima, borderRadius: 999, padding: "6px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer" }} aria-label={"Remover " + t}>{t} ✕</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={E.campo} type="text" placeholder="Ex.: Hipertrofia" maxLength={40} value={novaEspec} onChange={(e) => setNovaEspec(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEspec(); } }} data-testid="campo-especialidade" />
              <button type="button" style={{ ...E.btnSec, width: "auto", padding: "0 16px", marginTop: 0 }} onClick={addEspec}>Adicionar</button>
            </div>
          </>
        )}

        <button type="button" style={{ ...E.btn, opacity: salvando ? 0.6 : 1 }} onClick={salvar} disabled={salvando} data-testid="btn-salvar-perfil">{salvando ? "Salvando..." : "Salvar perfil"}</button>
        {erro && <div style={E.erro} role="alert">{erro}</div>}
        {msg && <div style={E.aviso} role="status">{msg}</div>}
      </div>
      <button type="button" style={E.btnSec} onClick={aoVoltar}>Voltar ao painel</button>
      <button type="button" style={{ ...E.btnSec, borderColor: "rgba(255,122,112,0.6)", color: COR.erro }} onClick={aoSair} data-testid="btn-sair">Sair da conta</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painéis iniciais (as próximas fases preenchem estes cartões)
// ---------------------------------------------------------------------------
function PainelPersonal({ perfil }) {
  const itens = [
    ["👥", "Meus alunos", "Convites, vínculos e acompanhamento de cada aluno."],
    ["📋", "Construtor de treinos", "Monte treinos A a E e envie direto para o aluno."],
    ["💬", "Mensagens", "Converse com seus alunos dentro do app."],
  ];
  return (
    <div data-testid="painel-personal">
      <div style={E.cartao}>
        <h1 style={E.h1}>Olá, {perfil.nome.split(" ")[0]}</h1>
        <div style={E.suave}>Seu painel de Personal Trainer. Sua conta está pronta; os recursos abaixo chegam nas próximas etapas.</div>
      </div>
      <div style={E.grade}>
        {itens.map(([ic, t, d]) => (
          <div key={t} style={E.emBreve}>
            <div style={{ fontSize: 26 }} aria-hidden="true">{ic}</div>
            <div style={{ fontWeight: 800, color: COR.texto, margin: "6px 0 4px" }}>{t}</div>
            <div style={{ fontSize: 13 }}>{d}</div>
            <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 800, color: COR.lima }}>EM BREVE</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PainelAluno({ perfil }) {
  const itens = [
    ["🔑", "Código de convite", "Digite o código que seu personal enviou para se vincular."],
    ["🏋️", "Treinos do meu personal", "Os treinos enviados aparecem na sua Rotina do Massi Pro."],
    ["💬", "Mensagens", "Converse com seu personal dentro do app."],
  ];
  return (
    <div data-testid="painel-aluno">
      <div style={E.cartao}>
        <h1 style={E.h1}>Olá, {perfil.nome.split(" ")[0]}</h1>
        <div style={E.suave}>Seu painel de Aluno. Sua conta está pronta; os recursos abaixo chegam nas próximas etapas.</div>
      </div>
      <div style={E.grade}>
        {itens.map(([ic, t, d]) => (
          <div key={t} style={E.emBreve}>
            <div style={{ fontSize: 26 }} aria-hidden="true">{ic}</div>
            <div style={{ fontWeight: 800, color: COR.texto, margin: "6px 0 4px" }}>{t}</div>
            <div style={{ fontSize: 13 }}>{d}</div>
            <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 800, color: COR.lima }}>EM BREVE</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export default function PersonalMassi({ onFechar }) {
  const [fase, setFase] = useState("carregando"); // carregando | falha | acesso | perfilCarregando | completar | painel | perfil
  const [perfil, setPerfil] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const cadastrandoRef = useRef(false);
  const vivoRef = useRef(true);

  const lerPerfil = async (uid) => {
    setFase("perfilCarregando");
    try {
      const p = await carregarPerfil(uid);
      if (!vivoRef.current) return;
      if (!p) { setPerfil(null); setFase("completar"); return; }
      if (p.tipo === "personal" && !p.profissional) {
        try { await garantirProfissional(uid); } catch (e) { /* tenta de novo no próximo acesso */ }
        const p2 = await carregarPerfil(uid);
        if (!vivoRef.current) return;
        setPerfil(p2 || p);
      } else {
        setPerfil(p);
      }
      setFase("painel");
    } catch (e) {
      if (!vivoRef.current) return;
      setErro(mensagemDeErro(e));
      setFase("falha");
    }
  };

  const pararRef = useRef(null);
  const iniciarObservador = async () => {
    try {
      const parar = await observarLogin((u) => {
        if (!vivoRef.current) return;
        if (cadastrandoRef.current) return; // o cadastro termina sozinho e recarrega o perfil
        setUsuario(u ? { uid: u.uid, email: u.email } : null);
        if (u) lerPerfil(u.uid); else { setPerfil(null); setFase("acesso"); }
      });
      if (!vivoRef.current) { if (typeof parar === "function") parar(); return; }
      if (typeof pararRef.current === "function") pararRef.current();
      pararRef.current = parar;
    } catch (e) {
      if (vivoRef.current) { setErro(mensagemDeErro(e)); setFase("falha"); }
    }
  };

  useEffect(() => {
    vivoRef.current = true;
    iniciarObservador();
    return () => { vivoRef.current = false; if (typeof pararRef.current === "function") pararRef.current(); };
  }, []);

  const aoEntrar = async (email, senha) => {
    setOcupado(true); setErro(""); setAviso("");
    try { await entrar(email, senha); } catch (e) { setErro(mensagemDeErro(e)); } finally { if (vivoRef.current) setOcupado(false); }
  };
  const aoCadastrar = async (dados) => {
    setOcupado(true); setErro(""); setAviso("");
    cadastrandoRef.current = true;
    try {
      const uid = await cadastrar(dados);
      cadastrandoRef.current = false;
      setUsuario({ uid, email: dados.email });
      await lerPerfil(uid);
    } catch (e) {
      cadastrandoRef.current = false;
      setErro(mensagemDeErro(e));
    } finally {
      if (vivoRef.current) setOcupado(false);
    }
  };
  const aoRecuperar = async (email) => {
    setErro(""); setAviso("");
    if (!email || !email.trim()) { setErro("Digite seu e-mail acima e toque de novo em \"Esqueci minha senha\"."); return; }
    setOcupado(true);
    try {
      await recuperarSenha(email);
      setAviso("Se esse e-mail tiver conta, enviamos um link para criar uma nova senha. Olhe também a caixa de spam.");
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      if (vivoRef.current) setOcupado(false);
    }
  };
  const aoCompletar = async (dados) => {
    if (!usuario) return;
    setOcupado(true); setErro("");
    try { await criarPerfil(usuario.uid, dados); await lerPerfil(usuario.uid); } catch (e) { setErro(mensagemDeErro(e)); } finally { if (vivoRef.current) setOcupado(false); }
  };
  const aoSair = async () => {
    try { await sair(); } catch (e) { setErro(mensagemDeErro(e)); }
  };
  const tentarDeNovo = () => { setErro(""); setFase("carregando"); iniciarObservador(); };

  const direita = perfil && (fase === "painel" || fase === "perfil") ? (
    <button type="button" onClick={() => setFase(fase === "perfil" ? "painel" : "perfil")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }} aria-label="Meu perfil" data-testid="btn-perfil">
      <Avatar nome={perfil.nome} foto={perfil.foto} tamanho={42} />
    </button>
  ) : null;

  return (
    <div style={E.pagina} data-testid="personal-massi">
      <div style={E.miolo}>
        <Topo aoFechar={onFechar} direita={direita} titulo={perfil ? (perfil.tipo === "personal" ? "Painel do Personal" : "Painel do Aluno") : undefined} />

        {(fase === "carregando" || fase === "perfilCarregando") && <div style={{ ...E.cartao, textAlign: "center", color: COR.suave }} data-testid="carregando">Carregando...</div>}

        {fase === "falha" && (
          <div style={E.cartao} data-testid="falha">
            <div style={E.h2}>Não foi possível abrir o Personal Massi</div>
            <div style={E.suave}>Verifique sua conexão com a internet e tente de novo.</div>
            {erro && <div style={E.erro}>{erro}</div>}
            <button type="button" style={E.btn} onClick={tentarDeNovo}>Tentar de novo</button>
          </div>
        )}

        {fase === "acesso" && <TelaAcesso onEntrar={aoEntrar} onCadastrar={aoCadastrar} onRecuperar={aoRecuperar} ocupado={ocupado} erro={erro} aviso={aviso} />}
        {fase === "completar" && <TelaCompletar onConcluir={aoCompletar} onSair={aoSair} ocupado={ocupado} erro={erro} />}
        {fase === "painel" && perfil && (perfil.tipo === "personal" ? <PainelPersonal perfil={perfil} /> : <PainelAluno perfil={perfil} />)}
        {fase === "perfil" && perfil && (
          <TelaPerfil perfil={perfil} aoSalvar={() => lerPerfilSilencioso(perfil.uid, setPerfil)} aoVoltar={() => setFase("painel")} aoSair={aoSair} />
        )}
      </div>
    </div>
  );
}

async function lerPerfilSilencioso(uid, setPerfil) {
  const p = await carregarPerfil(uid);
  if (p) setPerfil(p);
}
