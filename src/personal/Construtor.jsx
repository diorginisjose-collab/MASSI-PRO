// PERSONAL MASSI - fase 4: lista de treinos do personal e o editor (dados > treinos A a E > prévia > enviar).
import React, { useEffect, useRef, useState } from "react";
import { COR, E } from "./estilos.js";
import { Etiqueta, BotaoPerigo } from "./ui.jsx";
import { PreviaPrograma } from "./Previa.jsx";
import BibliotecaExercicios from "./BibliotecaExercicios.jsx";
import { LETRAS, gruposPrincipais, novoExercicio, descreverExercicio, validarPrograma, contarExercicios, dataBR } from "./treinos.js";
import { dataCurta } from "./vinculos.js";
import { mensagemDeErro } from "./dados.js";

// ---------------------------------------------------------------------------
// Lista: rascunhos e modelos
// ---------------------------------------------------------------------------
export function TelaTreinos({ modelos, alunos, aviso, erro, ocupado, onNovo, onAbrir, onDuplicar, onApagar }) {
  const rascunhos = modelos.filter((m) => m.categoria === "rascunho");
  const salvos = modelos.filter((m) => m.categoria === "modelo");
  const nomeAluno = (id) => { const v = alunos.find((a) => a.id === id); return v ? v.alunoNome : ""; };

  const Linha = ({ m }) => {
    const prog = m.programa || {};
    const dias = (prog.dias || []).length;
    return (
      <div style={E.cartao} data-testid={"modelo-" + m.id}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{m.nome}</div>
        <div style={E.suave}>
          {dias} {dias === 1 ? "treino" : "treinos"} · {contarExercicios(prog)} exercícios
          {m.categoria === "rascunho" && m.vinculoId && nomeAluno(m.vinculoId) ? " · para " + nomeAluno(m.vinculoId) : ""}
          {" · " + dataCurta(m.atualizadoEm)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" style={{ ...E.btn, marginTop: 0, flex: 1, minWidth: 120, minHeight: 44 }} onClick={() => onAbrir(m)} data-testid={"abrir-modelo-" + m.id}>Abrir</button>
          <button type="button" style={{ ...E.btnSec, marginTop: 0, flex: 1, minWidth: 120, minHeight: 44 }} disabled={ocupado} onClick={() => onDuplicar(m)} data-testid={"duplicar-" + m.id}>Duplicar</button>
        </div>
        <BotaoPerigo testid={"apagar-" + m.id} rotulo="Apagar" aviso="Apagar este treino da sua lista? Treinos já enviados a alunos não são afetados." confirmar="Apagar" aoConfirmar={() => onApagar(m)} ocupado={ocupado} />
      </div>
    );
  };

  return (
    <div data-testid="tela-treinos">
      <div style={E.cartao}>
        <h1 style={E.h1}>Construtor de treinos</h1>
        <div style={E.suave}>Monte treinos A a E, salve como rascunho ou modelo e envie para o aluno.</div>
        <button type="button" style={E.btn} onClick={onNovo} data-testid="btn-novo-treino">Novo treino</button>
        {aviso && <div style={E.aviso} role="status" data-testid="aviso-treinos">{aviso}</div>}
        {erro && <div style={E.erro} role="alert">{erro}</div>}
      </div>
      <div style={{ ...E.h2, margin: "6px 2px 8px" }}>Rascunhos</div>
      {rascunhos.length === 0 ? <div style={E.emBreve} data-testid="sem-rascunhos">Nenhum rascunho. Toque em "Novo treino".</div> : rascunhos.map((m) => <Linha key={m.id} m={m} />)}
      <div style={{ ...E.h2, margin: "14px 2px 8px" }}>Modelos</div>
      {salvos.length === 0 ? <div style={E.emBreve}>Nenhum modelo. Na prévia de um treino, use "Salvar como modelo" para reaproveitar depois.</div> : salvos.map((m) => <Linha key={m.id} m={m} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
const PASSOS = [["dados", "1 Dados"], ["dias", "2 Treinos"], ["previa", "3 Prévia"]];

export function EditorTreino({ inicial, alunos, biblioteca, aoSalvar, aoEnviar, aoSair, registrarSaida }) {
  const [p, setP] = useState(inicial.programa);
  const base = useRef(JSON.stringify(inicial.programa));
  const sujoRef = useRef(false);
  const [modeloId, setModeloId] = useState(inicial.modeloId || null);
  const [passo, setPasso] = useState("dados");
  const [diaIdx, setDiaIdx] = useState(0);
  const [abrirBib, setAbrirBib] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [confirmaEnvio, setConfirmaEnvio] = useState(false);

  const sujo = JSON.stringify(p) !== base.current;
  sujoRef.current = sujo;
  useEffect(() => {
    registrarSaida(() => { if (sujoRef.current) { setSaindo(true); return true; } return false; });
    return () => registrarSaida(null);
  }, []);

  const grupos = gruposPrincipais(biblioteca);
  const dia = p.dias[Math.min(diaIdx, p.dias.length - 1)];
  const idx = Math.min(diaIdx, p.dias.length - 1);

  const set = (campo, valor) => setP({ ...p, [campo]: valor });
  const setDia = (i, mud) => setP({ ...p, dias: p.dias.map((d, k) => (k === i ? { ...d, ...mud } : d)) });
  const setEx = (i, id, mud) => setDia(i, { exercicios: p.dias[i].exercicios.map((e) => (e.id === id ? { ...e, ...mud } : e)) });
  const mover = (i, id, delta) => {
    const lista = [...p.dias[i].exercicios];
    const pos = lista.findIndex((e) => e.id === id);
    const novo = pos + delta;
    if (pos < 0 || novo < 0 || novo >= lista.length) return;
    [lista[pos], lista[novo]] = [lista[novo], lista[pos]];
    setDia(i, { exercicios: lista });
  };
  const duplicarEx = (i, id) => {
    const lista = [...p.dias[i].exercicios];
    const pos = lista.findIndex((e) => e.id === id);
    const copia = { ...lista[pos], id: novoExercicio("x").id };
    lista.splice(pos + 1, 0, copia);
    setDia(i, { exercicios: lista });
  };
  const removerEx = (i, id) => setDia(i, { exercicios: p.dias[i].exercicios.filter((e) => e.id !== id) });
  const addDia = () => {
    if (p.dias.length >= 5) return;
    setP({ ...p, dias: [...p.dias, { letra: LETRAS[p.dias.length], titulo: "", grupos: [], exercicios: [] }] });
    setDiaIdx(p.dias.length);
  };
  const removerDia = () => {
    const resto = p.dias.filter((_, k) => k !== idx).map((d, k) => ({ ...d, letra: LETRAS[k] }));
    setP({ ...p, dias: resto });
    setDiaIdx(Math.max(0, idx - 1));
  };
  const escolheu = (ex) => {
    const novo = novoExercicio(ex.nome, ex.grupo, ex);
    setDia(idx, { exercicios: [...dia.exercicios, novo] });
    setExpandido(novo.id);
  };

  const guardar = async (categoria) => {
    setErro(""); setMsg(""); setOcupado(true);
    try {
      const id = await aoSalvar({ id: categoria === "rascunho" ? modeloId : null, categoria, programa: p });
      if (categoria === "rascunho") { setModeloId(id); base.current = JSON.stringify(p); setMsg("Rascunho salvo."); }
      else setMsg("Modelo salvo na sua lista de modelos.");
      return true;
    } catch (e) { setErro(mensagemDeErro(e)); return false; } finally { setOcupado(false); }
  };
  const enviar = async () => {
    setErro(""); setMsg(""); setOcupado(true);
    try { await aoEnviar(p, modeloId); } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setConfirmaEnvio(false); }
  };

  const problemas = validarPrograma(p);
  const vinculo = alunos.find((a) => a.id === p.vinculoId);
  const campoNum = { ...E.campo, textAlign: "center" };

  return (
    <div data-testid="editor-treino">
      {saindo && (
        <div style={{ ...E.erro, marginTop: 0, marginBottom: 14 }} data-testid="confirmar-saida">
          <div style={{ marginBottom: 10 }}>Você tem alterações que não foram salvas.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={{ ...E.btn, marginTop: 0, flex: 1, minWidth: 140, minHeight: 44 }} onClick={async () => { if (await guardar("rascunho")) aoSair(); }} data-testid="saida-salvar">Salvar rascunho e sair</button>
            <button type="button" style={{ ...E.btnSec, marginTop: 0, flex: 1, minWidth: 120, minHeight: 44, borderColor: "rgba(255,122,112,0.6)", color: COR.erro }} onClick={aoSair} data-testid="saida-descartar">Sair sem salvar</button>
            <button type="button" style={{ ...E.btnSec, marginTop: 0, flex: 1, minWidth: 120, minHeight: 44 }} onClick={() => setSaindo(false)} data-testid="saida-continuar">Continuar editando</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 14 }}>
        {PASSOS.map(([id, rot]) => (
          <button key={id} type="button" onClick={() => setPasso(id)} data-testid={"passo-" + id} style={{ minHeight: 42, borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 13.5, border: "1px solid " + (passo === id ? COR.lima : COR.borda), background: passo === id ? "rgba(198,255,77,0.14)" : COR.cartao, color: passo === id ? COR.lima : COR.texto }}>{rot}</button>
        ))}
      </div>

      {passo === "dados" && (
        <div style={E.cartao} data-testid="passo-dados">
          <label style={E.rotulo} htmlFor="ed-nome">Nome do treino</label>
          <input id="ed-nome" data-testid="ed-nome" style={E.campo} type="text" maxLength={100} placeholder="Ex.: Hipertrofia 4x semana" value={p.nome} onChange={(e) => set("nome", e.target.value)} />
          <label style={E.rotulo} htmlFor="ed-aluno">Para qual aluno</label>
          <select id="ed-aluno" data-testid="ed-aluno" style={E.campo} value={p.vinculoId} onChange={(e) => set("vinculoId", e.target.value)}>
            <option value="">Sem aluno (só modelo ou rascunho)</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.alunoNome}</option>)}
          </select>
          <label style={E.rotulo} htmlFor="ed-freq">Dias por semana</label>
          <select id="ed-freq" data-testid="ed-freq" style={E.campo} value={p.frequencia} onChange={(e) => set("frequencia", Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} {n === 1 ? "dia" : "dias"}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={E.rotulo} htmlFor="ed-ini">Início</label><input id="ed-ini" data-testid="ed-inicio" style={E.campo} type="date" value={p.inicio} onChange={(e) => set("inicio", e.target.value)} /></div>
            <div><label style={E.rotulo} htmlFor="ed-val">Validade (opcional)</label><input id="ed-val" data-testid="ed-validade" style={E.campo} type="date" value={p.validade} onChange={(e) => set("validade", e.target.value)} /></div>
          </div>
          <label style={E.rotulo} htmlFor="ed-orient">Orientações gerais para o aluno</label>
          <textarea id="ed-orient" data-testid="ed-orient" style={{ ...E.campo, minHeight: 90, resize: "vertical" }} maxLength={2000} value={p.orientacoes} onChange={(e) => set("orientacoes", e.target.value)} />
        </div>
      )}

      {passo === "dias" && (
        <div data-testid="passo-dias">
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {p.dias.map((d, k) => (
              <button key={d.letra} type="button" onClick={() => setDiaIdx(k)} data-testid={"dia-" + d.letra} style={{ width: 48, height: 48, borderRadius: 12, cursor: "pointer", fontWeight: 900, fontSize: 17, border: "1.5px solid " + (k === idx ? COR.lima : COR.borda), background: k === idx ? "linear-gradient(135deg,#B7E04A,#7FAE1F)" : COR.cartao, color: k === idx ? "#10150A" : COR.texto }}>{d.letra}</button>
            ))}
            {p.dias.length < 5 && <button type="button" onClick={addDia} data-testid="add-dia" style={{ minWidth: 48, height: 48, padding: "0 12px", borderRadius: 12, cursor: "pointer", fontWeight: 800, border: "1.5px dashed " + COR.lima, background: "transparent", color: COR.lima }}>+ Treino {LETRAS[p.dias.length]}</button>}
          </div>

          <div style={E.cartao}>
            <label style={E.rotulo} htmlFor="ed-dia-titulo">Nome do treino {dia.letra}</label>
            <input id="ed-dia-titulo" data-testid="ed-dia-titulo" style={E.campo} type="text" maxLength={40} placeholder="Ex.: Peito e tríceps" value={dia.titulo} onChange={(e) => setDia(idx, { titulo: e.target.value })} />
            <div style={E.rotulo}>Grupos musculares</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {grupos.map((g) => {
                const ativo = dia.grupos.indexOf(g) >= 0;
                return <button key={g} type="button" onClick={() => setDia(idx, { grupos: ativo ? dia.grupos.filter((x) => x !== g) : [...dia.grupos, g] })} data-testid={"grupo-" + g} aria-pressed={ativo} style={{ minHeight: 38, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontWeight: 800, fontSize: 13.5, border: "1px solid " + (ativo ? COR.lima : COR.borda), background: ativo ? "rgba(198,255,77,0.14)" : "transparent", color: ativo ? COR.lima : COR.texto }}>{g}</button>;
              })}
            </div>
          </div>

          {dia.exercicios.length === 0 && <div style={E.emBreve} data-testid="sem-exercicios">Nenhum exercício neste treino. Toque em "Adicionar exercício".</div>}
          {dia.exercicios.map((e, pos) => {
            const aberto = expandido === e.id;
            return (
              <div key={e.id} style={E.cartao} data-testid={"ex-" + pos}>
                <button type="button" onClick={() => setExpandido(aberto ? null : e.id)} aria-expanded={aberto} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: COR.texto, fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5 }}>{pos + 1}. {e.nome}</div>
                  <div style={{ color: COR.lima, fontSize: 13.5, fontWeight: 700 }}>{descreverExercicio(e)} <span style={{ color: COR.suave, fontWeight: 600 }}>{aberto ? "▲" : "▼ editar"}</span></div>
                </button>
                {aberto && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div><label style={E.rotulo}>Séries</label><input data-testid={"ex-series-" + pos} style={campoNum} type="number" inputMode="numeric" min={1} max={20} value={e.series} onChange={(ev) => setEx(idx, e.id, { series: ev.target.value === "" ? "" : Number(ev.target.value) })} /></div>
                      <div><label style={E.rotulo}>Repetições</label><input data-testid={"ex-reps-" + pos} style={campoNum} type="text" maxLength={20} value={e.reps} onChange={(ev) => setEx(idx, e.id, { reps: ev.target.value })} /></div>
                      <div><label style={E.rotulo}>Carga sugerida</label><input data-testid={"ex-carga-" + pos} style={campoNum} type="text" maxLength={30} placeholder="Ex.: 40 kg" value={e.carga} onChange={(ev) => setEx(idx, e.id, { carga: ev.target.value })} /></div>
                      <div><label style={E.rotulo}>Descanso (segundos)</label><input data-testid={"ex-descanso-" + pos} style={campoNum} type="number" inputMode="numeric" min={0} max={600} step={15} value={e.descanso} onChange={(ev) => setEx(idx, e.id, { descanso: ev.target.value === "" ? "" : Number(ev.target.value) })} /></div>
                    </div>
                    <label style={E.rotulo}>Instruções</label>
                    <textarea data-testid={"ex-instr-" + pos} style={{ ...E.campo, minHeight: 70, resize: "vertical" }} maxLength={600} value={e.instrucoes} onChange={(ev) => setEx(idx, e.id, { instrucoes: ev.target.value })} />
                    <label style={E.rotulo}>Observação para este aluno</label>
                    <textarea data-testid={"ex-obs-" + pos} style={{ ...E.campo, minHeight: 60, resize: "vertical" }} maxLength={400} value={e.obs} onChange={(ev) => setEx(idx, e.id, { obs: ev.target.value })} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={{ ...E.btnSec, width: "auto", marginTop: 0, minHeight: 40, padding: "0 14px" }} onClick={() => mover(idx, e.id, -1)} disabled={pos === 0} aria-label="Subir" data-testid={"ex-subir-" + pos}>↑</button>
                  <button type="button" style={{ ...E.btnSec, width: "auto", marginTop: 0, minHeight: 40, padding: "0 14px" }} onClick={() => mover(idx, e.id, 1)} disabled={pos === dia.exercicios.length - 1} aria-label="Descer" data-testid={"ex-descer-" + pos}>↓</button>
                  <button type="button" style={{ ...E.btnSec, width: "auto", marginTop: 0, minHeight: 40, padding: "0 14px" }} onClick={() => duplicarEx(idx, e.id)} data-testid={"ex-dup-" + pos}>Duplicar</button>
                  <button type="button" style={{ ...E.btnSec, width: "auto", marginTop: 0, minHeight: 40, padding: "0 14px", borderColor: "rgba(255,122,112,0.6)", color: COR.erro }} onClick={() => removerEx(idx, e.id)} data-testid={"ex-rem-" + pos}>Remover</button>
                </div>
              </div>
            );
          })}
          <button type="button" style={E.btn} onClick={() => setAbrirBib(true)} data-testid="btn-add-exercicio">Adicionar exercício</button>
          {p.dias.length > 1 && <div style={{ marginTop: 12 }}><BotaoPerigo testid="rem-dia" rotulo={"Remover treino " + dia.letra} aviso={"Remover o treino " + dia.letra + " e seus " + dia.exercicios.length + " exercícios?"} confirmar="Remover" aoConfirmar={removerDia} /></div>}
        </div>
      )}

      {passo === "previa" && (
        <div data-testid="passo-previa">
          <div style={E.aviso}>É assim que o aluno vai ver o treino. Confira antes de enviar.</div>
          <div style={{ height: 12 }} />
          <PreviaPrograma programa={p} biblioteca={biblioteca} />
          {problemas.length > 0 && (
            <div style={{ ...E.erro, marginTop: 0, marginBottom: 12 }} role="alert" data-testid="problemas">
              <div style={{ marginBottom: 6 }}>Para enviar, ajuste:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{problemas.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          {!vinculo && <div style={{ ...E.emBreve, marginBottom: 12 }}>Escolha um aluno no passo "Dados" para poder enviar.</div>}
          {vinculo && problemas.length === 0 && !confirmaEnvio && <button type="button" style={E.btn} onClick={() => setConfirmaEnvio(true)} data-testid="btn-enviar">Enviar para {vinculo.alunoNome}</button>}
          {confirmaEnvio && vinculo && (
            <div style={{ ...E.aviso, marginTop: 0 }} data-testid="confirmar-envio">
              <div style={{ marginBottom: 10 }}>Enviar agora para {vinculo.alunoNome}? Ele recebe na hora. Se já houver um treino, este vira a nova versão e o anterior fica guardado no histórico.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={{ ...E.btn, marginTop: 0, flex: 1, minHeight: 44, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={enviar} data-testid="btn-confirmar-envio">{ocupado ? "Enviando..." : "Confirmar envio"}</button>
                <button type="button" style={{ ...E.btnSec, marginTop: 0, flex: 1, minHeight: 44 }} disabled={ocupado} onClick={() => setConfirmaEnvio(false)}>Voltar</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" style={{ ...E.btnSec, flex: 1, marginTop: 0, minWidth: 140 }} disabled={ocupado} onClick={() => guardar("rascunho")} data-testid="btn-salvar-rascunho">Salvar rascunho</button>
        {passo === "previa" && <button type="button" style={{ ...E.btnSec, flex: 1, marginTop: 0, minWidth: 140 }} disabled={ocupado} onClick={() => guardar("modelo")} data-testid="btn-salvar-modelo">Salvar como modelo</button>}
        {passo !== "previa" && <button type="button" style={{ ...E.btn, flex: 1, marginTop: 0, minWidth: 140 }} onClick={() => setPasso(passo === "dados" ? "dias" : "previa")} data-testid="btn-proximo">Próximo</button>}
      </div>
      {msg && <div style={E.aviso} role="status" data-testid="msg-editor">{msg}</div>}
      {erro && <div style={E.erro} role="alert" data-testid="erro-editor">{erro}</div>}

      {abrirBib && <BibliotecaExercicios biblioteca={biblioteca} aoEscolher={escolheu} aoFechar={() => setAbrirBib(false)} />}
    </div>
  );
}
