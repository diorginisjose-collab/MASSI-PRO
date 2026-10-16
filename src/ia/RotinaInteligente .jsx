import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IA_CONFIG } from "./config.js";
import { gerarParteRotina, mensagemDeErro, ErroIA } from "./clienteIA.js";
import { COR, FONTE, tela, cabecalho, botaoFechar, botaoPrimario } from "./tema.js";
import * as RI from "./rotinaInteligente.js";

const TEXTO_APRESENTACAO = "Vamos conhecer seu corpo, seus objetivos e sua rotina para criar um plano personalizado de treino e alimentação. Quanto melhor conhecermos seu perfil, mais adequadas serão as recomendações do Massi Pro.";

// ---------- estilos ----------
const cartao = { background: COR.card, borderRadius: 14, padding: 14, marginBottom: 12 };
const rotuloCampo = { fontSize: 14.5, fontWeight: 700, marginBottom: 6, lineHeight: 1.35 };
const textoSuave = { color: COR.suave, fontSize: 12.5, lineHeight: 1.45 };
const botaoSec = { background: COR.card2, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 12, padding: "11px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONTE };
const botaoPrim = { ...botaoPrimario, width: "100%", marginTop: 0 };
const chipEstilo = (sel) => ({ background: sel ? COR.lime : COR.card2, color: sel ? COR.grafite : COR.texto, border: "1px solid " + (sel ? COR.lime : COR.borda), borderRadius: 999, padding: "9px 14px", fontSize: 14, fontWeight: sel ? 800 : 600, cursor: "pointer", fontFamily: FONTE, marginRight: 8, marginBottom: 8, minHeight: 40 });
const inputEstilo = { width: "100%", boxSizing: "border-box", background: COR.card2, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 12, padding: "12px 13px", fontSize: 16, fontFamily: FONTE, outline: "none" };
const erroEstilo = { color: "#FFB1A8", fontSize: 12.5, marginTop: 5 };
const avisoEstilo = { background: "rgba(255,193,7,0.10)", border: "1px solid rgba(255,193,7,0.35)", color: COR.texto, borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, marginBottom: 10 };
const milhar = (n) => (typeof n === "number" ? n.toLocaleString("pt-BR") : n);

// ---------- campo genérico (numérico, escolha, múltipla escolha, texto, dias) ----------
function Campo({ campo, valor, onMudar, erro, respostas, tr }) {
  const opcoes = RI.opcoesDoCampo(campo, respostas);
  const rotulo = tr(campo.rotulo);
  return (
    <div style={{ marginBottom: 18 }} data-campo={campo.id}>
      <div style={rotuloCampo}>{rotulo}</div>
      {campo.tipo === "numero" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text" inputMode="decimal" aria-label={rotulo} value={valor === undefined || valor === null ? "" : String(valor).replace(".", ",")}
            onChange={(e) => onMudar(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6))}
            style={{ ...inputEstilo, maxWidth: 150 }} placeholder={campo.opcional ? tr("opcional") : ""}
          />
          {campo.unidade && <span style={{ color: COR.suave, fontSize: 14 }}>{tr(campo.unidade)}</span>}
        </div>
      )}
      {campo.tipo === "escolha" && (
        <div role="radiogroup" aria-label={rotulo}>
          {opcoes.map((o) => (
            <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} onClick={() => onMudar(valor === o.v && campo.opcional ? "" : o.v)} style={chipEstilo(valor === o.v)}>{tr(o.l)}</button>
          ))}
        </div>
      )}
      {campo.tipo === "multi" && (
        <div role="group" aria-label={rotulo}>
          {opcoes.map((o) => {
            const sel = Array.isArray(valor) && valor.indexOf(o.v) >= 0;
            return <button key={o.v} type="button" aria-pressed={sel} onClick={() => onMudar(RI.alternarMulti(campo, valor, o.v))} style={chipEstilo(sel)}>{tr(o.l)}</button>;
          })}
        </div>
      )}
      {campo.tipo === "dias" && (
        <div role="group" aria-label={rotulo}>
          {RI.DIAS.map((d, i) => {
            const sel = Array.isArray(valor) && valor.indexOf(d) >= 0;
            return <button key={d} type="button" aria-pressed={sel} onClick={() => onMudar(sel ? valor.filter((x) => x !== d) : (valor || []).concat([d]))} style={{ ...chipEstilo(sel), minWidth: 56, padding: "9px 10px" }}>{tr(RI.DIAS_ABREV[i])}</button>;
          })}
        </div>
      )}
      {campo.tipo === "texto" && (
        <textarea aria-label={rotulo} value={valor || ""} rows={2} maxLength={campo.maxLen || 200} onChange={(e) => onMudar(e.target.value)} style={{ ...inputEstilo, resize: "none" }} />
      )}
      {erro && <div style={erroEstilo} role="alert">{tr(erro)}</div>}
    </div>
  );
}

function rotuloResposta(campo, valor, respostas, tr) {
  if (valor === undefined || valor === null || valor === "" || (Array.isArray(valor) && !valor.length)) return "—";
  if (campo.tipo === "numero") return milhar(RI.paraNumero(valor)) + (campo.unidade ? " " + campo.unidade : "");
  if (campo.tipo === "escolha") { const o = RI.opcoesDoCampo(campo, respostas).find((x) => x.v === valor); return tr(o ? o.l : String(valor)); }
  if (campo.tipo === "multi") { const ops = RI.opcoesDoCampo(campo, respostas); return valor.map((v) => { const o = ops.find((x) => x.v === v); return tr(o ? o.l : v); }).join(", "); }
  if (campo.tipo === "dias") return valor.map((d) => tr(RI.DIAS_ABREV[RI.DIAS.indexOf(d)] || d)).join(", ");
  return String(valor);
}

// ---------- blocos de exibição do plano ----------
function Secao({ titulo, icone, abertaInicial, children }) {
  const [aberta, setAberta] = useState(!!abertaInicial);
  return (
    <div style={{ ...cartao, padding: 0, overflow: "hidden" }}>
      <button type="button" onClick={() => setAberta(!aberta)} aria-expanded={aberta} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: COR.texto, padding: "13px 14px", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: FONTE, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{icone} {titulo}</span><span style={{ color: COR.suave }}>{aberta ? "▾" : "▸"}</span>
      </button>
      {aberta && <div style={{ padding: "0 14px 14px", fontSize: 14, lineHeight: 1.5 }}>{children}</div>}
    </div>
  );
}
const Lista = ({ itens }) => (itens && itens.length ? <ul style={{ margin: "4px 0 10px", paddingLeft: 18 }}>{itens.map((x, i) => <li key={i} style={{ marginBottom: 3 }}>{x}</li>)}</ul> : null);
const Sub = ({ children }) => <div style={{ fontWeight: 800, fontSize: 13, color: COR.lime, margin: "10px 0 2px", textTransform: "uppercase", letterSpacing: 0.3 }}>{children}</div>;

function VisaoPlano({ treino, alimentar, tr }) {
  const ia = (treino && treino.ia) || {};
  const nutri = alimentar && alimentar.nutri;
  const plano = alimentar && alimentar.plano;
  const dias = RI.resumirSemana(treino && treino.semana).filter((d) => d.exercicios.length || d.cardio);
  const dica = (nome) => (ia.dicasExecucao || []).find((x) => x.exercicio === nome);
  return (
    <div>
      <Secao titulo={tr("Por que este plano")} icone="🧭" abertaInicial>
        <div>{ia.justificativaDivisao}</div>
        {ia.prioridades && ia.prioridades.length > 0 && (<><Sub>{tr("Principais prioridades")}</Sub><Lista itens={ia.prioridades} /></>)}
        {ia.alertas && ia.alertas.length > 0 && (<div style={{ ...avisoEstilo, marginTop: 8 }}>{ia.alertas.map((a, i) => <div key={i}>⚠️ {a}</div>)}</div>)}
        <div style={{ ...textoSuave, marginTop: 8 }}>{tr("Estimativas e sugestões geradas por IA. Não substituem profissional de saúde e não garantem resultado em prazo definido.")}</div>
      </Secao>

      <Secao titulo={tr("Treino da semana")} icone="🏋️" abertaInicial>
        {treino && treino.resumoGerador && <div style={{ ...textoSuave, marginBottom: 8 }}>{treino.resumoGerador}</div>}
        {dias.map((d) => (
          <div key={d.dia} style={{ background: COR.card2, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{tr(d.dia)} · {tr(d.foco)}</div>
            {d.exercicios.map((e) => (
              <div key={e.nome} style={{ fontSize: 13.5, marginBottom: 3 }}>
                {e.nome} <span style={{ color: COR.suave }}>— {e.series}×{e.reps}{e.descanso ? " · " + e.descanso : ""}</span>
                {dica(e.nome) && <div style={{ ...textoSuave, marginLeft: 8 }}>💡 {dica(e.nome).dica}</div>}
              </div>
            ))}
            {d.cardio && <div style={{ fontSize: 13.5, color: COR.suave }}>🏃 {tr("Cardio")}: {d.cardio.tipo} · {d.cardio.duracao} min · {tr(d.cardio.intensidade)}</div>}
          </div>
        ))}
        {ia.progressao && ia.progressao.length > 0 && (<><Sub>{tr("Progressão")}</Sub><Lista itens={ia.progressao} /></>)}
        {ia.cardioAtividade && (<><Sub>{tr("Cardio e atividade")}</Sub><div>{ia.cardioAtividade}</div></>)}
        {ia.recuperacao && ia.recuperacao.length > 0 && (<><Sub>{tr("Recuperação e descanso")}</Sub><Lista itens={ia.recuperacao} /></>)}
      </Secao>

      <Secao titulo={tr("Alimentação")} icone="🍽️" abertaInicial>
        {nutri && nutri.modo === "completo" && (
          <div style={{ background: COR.card2, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ fontWeight: 800 }}>≈ {milhar(nutri.kcal.alvo)} kcal/dia <span style={{ color: COR.suave, fontWeight: 600 }}>({milhar(nutri.kcal.min)}–{milhar(nutri.kcal.max)})</span></div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>{tr("Proteínas")} {nutri.proteina.min}–{nutri.proteina.max} g · {tr("Carboidratos")} {nutri.carbo.min}–{nutri.carbo.max} g · {tr("Gorduras")} {nutri.gordura.min}–{nutri.gordura.max} g</div>
            <div style={{ ...textoSuave, marginTop: 6 }}>{tr("É uma estimativa inicial (fórmula de gasto energético + objetivo), não uma prescrição. Ajuste com base na sua evolução.")}</div>
          </div>
        )}
        {nutri && nutri.modo !== "completo" && nutri.textoLimite && (<div style={avisoEstilo}>{nutri.textoLimite.map((x, i) => <div key={i}>{tr(x)}</div>)}</div>)}
        {nutri && nutri.avisos && nutri.avisos.map((a, i) => <div key={i} style={avisoEstilo}>{tr(a)}</div>)}
        {alimentar && alimentar.avisos && alimentar.avisos.map((a, i) => <div key={"a" + i} style={avisoEstilo}>⚠️ {a}</div>)}
        {plano && plano.estrategia && <div style={{ marginBottom: 8 }}>{plano.estrategia}</div>}
        {plano && plano.refeicoes.map((m) => {
          const kcal = m.itens.every((i) => i.calorias !== undefined) ? m.itens.reduce((s, i) => s + i.calorias, 0) : null;
          return (
            <div key={m.nome + m.horario} style={{ background: COR.card2, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{m.nome}{m.horario ? " · " + m.horario : ""}{kcal ? <span style={{ color: COR.suave, fontWeight: 600 }}> · ~{kcal} kcal</span> : null}</div>
              {m.itens.map((i, k) => <div key={k} style={{ fontSize: 13.5 }}>• {i.alimento}{i.quantidade ? <span style={{ color: COR.suave }}> — {i.quantidade}</span> : null}</div>)}
              {m.observacao && <div style={{ ...textoSuave, marginTop: 3 }}>{m.observacao}</div>}
            </div>
          );
        })}
        {alimentar && alimentar.totais && alimentar.totais.calorias > 0 && (
          <div style={{ ...textoSuave, marginBottom: 8 }}>{tr("Total estimado do cardápio")}: ~{milhar(alimentar.totais.calorias)} kcal · P {alimentar.totais.proteinas_g} g · C {alimentar.totais.carboidratos_g} g · G {alimentar.totais.gorduras_g} g</div>
        )}
        {plano && plano.preTreino && (<><Sub>{tr("Pré-treino")}</Sub><div>{plano.preTreino}</div></>)}
        {plano && plano.posTreino && (<><Sub>{tr("Pós-treino")}</Sub><div>{plano.posTreino}</div></>)}
        {plano && plano.ajustesDias && (<><Sub>{tr("Dias de treino e de descanso")}</Sub><div>{plano.ajustesDias}</div></>)}
        {plano && plano.substituicoes.length > 0 && (<><Sub>{tr("Substituições equivalentes")}</Sub><Lista itens={plano.substituicoes.map((s) => s.de + " → " + s.por.join(" ou "))} /></>)}
        {plano && plano.opcoesEconomicas.length > 0 && (<><Sub>{tr("Opções econômicas")}</Sub><Lista itens={plano.opcoesEconomicas} /></>)}
        {plano && plano.alertas.length > 0 && (<div style={avisoEstilo}>{plano.alertas.map((a, i) => <div key={i}>⚠️ {a}</div>)}</div>)}
      </Secao>

      <Secao titulo={tr("Como medir sua evolução")} icone="📈">
        <Lista itens={(ia.medirEvolucao || []).concat((plano && plano.acompanhamento) || [])} />
        <div style={textoSuave}>{tr("Faça um check-in a cada 2 a 4 semanas. O Massi Pro compara com os registros anteriores e só sugere mudanças; você decide.")}</div>
      </Secao>
    </div>
  );
}

// ---------- cartão que aparece na aba Rotina ----------
export function CartaoRotinaInteligente({ onAbrir, temIA, versao, tr }) {
  const t = tr || ((x) => x);
  const [estado, setEstado] = useState(null);
  useEffect(() => { let vivo = true; RI.lerEstadoRI().then((e) => { if (vivo) setEstado(e); }).catch(() => {}); return () => { vivo = false; }; }, [versao]);
  const ativo = estado && estado.planoTreino;
  const rotulo = !temIA ? "Conhecer a Rotina Inteligente" : ativo ? "Abrir minha rotina inteligente" : estado && estado.rascunho ? "Continuar personalização" : "Personalizar minha rotina";
  return (
    <div style={{ background: COR.card, border: "1px solid " + COR.borda, borderRadius: 16, padding: 14, marginBottom: 12, fontFamily: FONTE, color: COR.texto }} data-testid="cartao-rotina-inteligente">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 16.5 }}>✨ {t("Minha Rotina Inteligente")}</div>
        {!temIA && <span style={{ background: COR.lime, color: COR.grafite, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>PREMIUM</span>}
      </div>
      <div style={{ ...textoSuave, margin: "6px 0 10px", fontSize: 13.5 }}>
        {ativo ? t("Seu plano personalizado está ativo. Faça um check-in para acompanhar a evolução ou refaça a avaliação quando algo mudar.") : t(TEXTO_APRESENTACAO)}
      </div>
      <button type="button" onClick={onAbrir} style={botaoPrim}>{t(rotulo)}</button>
    </div>
  );
}

// ---------- tela principal ----------
export default function RotinaInteligente({ onFechar, i18n, idioma, quota, temIA, onVerPlanos, gerarSemana, aplicarSemana, onAlterado }) {
  const tr = (i18n && i18n.tr) || ((x) => x);
  const trt = (i18n && i18n.trt) || ((k, a) => (a || []).reduce((t, v, i) => t.split("{" + i + "}").join(v), k));
  const [estado, setEstado] = useState(null);
  const [fase, setFase] = useState("inicio"); // inicio | perguntas | resumo | gerando | proposta | plano | checkin | analise
  const [respostas, setRespostas] = useState({});
  const [tipoAval, setTipoAval] = useState("inicial");
  const [etapa, setEtapa] = useState(0);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [salvoEm, setSalvoEm] = useState(null);
  const [proposta, setProposta] = useState(null);
  const [passo, setPasso] = useState(0);
  const [erroGeracao, setErroGeracao] = useState("");
  const [checkin, setCheckin] = useState({});
  const [errosCk, setErrosCk] = useState({});
  const [analise, setAnalise] = useState(null);
  const [reav, setReav] = useState(null);
  const [reavErro, setReavErro] = useState("");
  const [reavCarregando, setReavCarregando] = useState(false);
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erroSalvar, setErroSalvar] = useState("");
  const [, setTick] = useState(0);
  const topoRef = useRef(null);
  const ctrlRef = useRef(null);
  const ocupadoRef = useRef(false);
  const vivoRef = useRef(true);

  useEffect(() => { vivoRef.current = true; return () => { vivoRef.current = false; if (ctrlRef.current) ctrlRef.current.abort(); }; }, []);
  useEffect(() => (quota && quota.inscrever ? quota.inscrever(() => setTick((n) => n + 1)) : undefined), [quota]);
  const rolarTopo = () => { if (topoRef.current && topoRef.current.scrollTo) topoRef.current.scrollTo({ top: 0 }); };

  const recarregar = useCallback(async () => { const e = await RI.lerEstadoRI(); if (vivoRef.current) setEstado(e); return e; }, []);
  useEffect(() => { recarregar().catch(() => setEstado({ perfil: null, planoTreino: null, planoAlimentar: null, checkins: [], rascunho: null, proposta: null, avaliacoes: [] })); }, [recarregar]);

  // dados que o app já tem, para pré-preencher
  const lerPrefill = async () => {
    let onboarding = null, avaliacao = null;
    try { const r = await window.storage.get("onboarding-perfil"); if (r && r.value) onboarding = JSON.parse(r.value); } catch (e) { /* sem onboarding */ }
    try { const r = await window.storage.get("avaliacoes-evolucao"); const l = r && r.value ? JSON.parse(r.value) : []; if (l.length) avaliacao = l[l.length - 1]; } catch (e) { /* sem avaliação */ }
    return { onboarding, avaliacao, nivel: onboarding && onboarding.nivel, restricoes: onboarding && onboarding.restricoes };
  };

  // salva o rascunho (NÃO é perfil confirmado) enquanto a pessoa responde
  useEffect(() => {
    if (fase !== "perguntas" && fase !== "resumo") return undefined;
    const id = setTimeout(() => {
      RI.salvarRascunho({ respostas, etapa, tipo: tipoAval }).then(() => { if (vivoRef.current) { setSalvoEm(Date.now()); setErroSalvar(""); } }).catch(() => { if (vivoRef.current) setErroSalvar("Não consegui salvar o progresso neste aparelho."); });
    }, 500);
    return () => clearTimeout(id);
  }, [respostas, etapa, fase, tipoAval]);

  const situ = quota ? quota.situacao(IA_CONFIG.recursoRotina) : { limite: 0, usado: 0, restante: 0 };

  // ---------- início ----------
  const comecar = async (modo) => {
    setErroGeracao(""); setMostrarErros(false); setAviso("");
    if (modo === "retomar" && estado.rascunho) { setRespostas(estado.rascunho.respostas || {}); setEtapa(Math.min(estado.rascunho.etapa || 0, RI.ETAPAS.length)); setTipoAval(estado.rascunho.tipo || "inicial"); setFase(estado.rascunho.etapa >= RI.ETAPAS.length ? "resumo" : "perguntas"); return; }
    if ((modo === "reavaliar" || modo === "editar") && estado.perfil) { setRespostas(RI.limparRespostas(estado.perfil)); setTipoAval(estado.planoTreino || estado.avaliacoes.length > 1 ? "reavaliacao" : "inicial"); }
    else { setRespostas(RI.respostasIniciais(await lerPrefill())); setTipoAval("inicial"); }
    setEtapa(0); setFase("perguntas"); rolarTopo();
  };
  const mudar = (id, v) => setRespostas((r) => ({ ...r, [id]: v }));

  const proxima = () => {
    const et = RI.ETAPAS[etapa];
    const erros = RI.errosDaEtapa(et, respostas);
    if (Object.keys(erros).length) { setMostrarErros(true); rolarTopo(); return; }
    setMostrarErros(false);
    if (etapa + 1 >= RI.ETAPAS.length) { setRespostas((r) => RI.limparRespostas(r)); setFase("resumo"); setEtapa(RI.ETAPA_RESUMO); } else setEtapa(etapa + 1);
    rolarTopo();
  };
  const voltar = () => { setMostrarErros(false); if (fase === "resumo") { setFase("perguntas"); setEtapa(RI.ETAPAS.length - 1); } else if (etapa > 0) setEtapa(etapa - 1); else setFase("inicio"); rolarTopo(); };
  const editarEtapa = (i) => { setFase("perguntas"); setEtapa(i); setMostrarErros(false); rolarTopo(); };
  const salvarESair = async () => { try { await RI.salvarRascunho({ respostas, etapa, tipo: tipoAval }); } catch (e) { /* segue */ } await recarregar(); if (onAlterado) onAlterado(); setFase("inicio"); };

  // ---------- gerar plano ----------
  const gerarPlano = async () => {
    if (ocupadoRef.current) return;
    const limpas = RI.limparRespostas(respostas);
    const e = RI.primeiraEtapaComErro(limpas);
    if (e >= 0) { setEtapa(e); setFase("perguntas"); setMostrarErros(true); return; }
    if (!quota || !temIA) { onVerPlanos && onVerPlanos(); return; }
    ocupadoRef.current = true; setErroGeracao("");
    const uso = await quota.consumir(IA_CONFIG.recursoRotina);
    if (!uso.ok) {
      ocupadoRef.current = false;
      setErroGeracao(uso.motivo === "limite_mensal" ? trt("Você usou os {0} planos e ajustes de IA deste mês. O limite renova no começo do próximo mês.", [uso.limite]) : tr("Seu plano atual não inclui a geração de rotina por IA."));
      setFase("resumo"); return;
    }
    setFase("gerando"); setPasso(0);
    const ctrl = new AbortController(); ctrlRef.current = ctrl;
    let estourou = false;
    const relogio = setTimeout(() => { estourou = true; ctrl.abort(); }, IA_CONFIG.tempoMaxGeracaoMs);
    try {
      // 1) confirma as respostas (só agora viram perfil); não duplica o registro se nada mudou
      let atual = estado || (await recarregar());
      const ultima = atual.avaliacoes[atual.avaliacoes.length - 1];
      let perfil = atual.perfil;
      if (!perfil || !ultima || JSON.stringify(ultima.respostas) !== JSON.stringify(limpas) || atual.perfil.avaliacaoId !== ultima.id) {
        perfil = (await RI.confirmarAvaliacao(limpas, tipoAval)).perfil;
        atual = await recarregar();
      }
      // 2) treino: o gerador do app monta a semana e encaixa nos dias livres; a IA explica e refina
      const params = RI.paramsGerador(perfil);
      const gerado = gerarSemana(params);
      const semana = RI.ajustarSemanaAosDias(gerado.semana, perfil);
      const nutri = RI.calcularNutricao(perfil);
      const brutoT = await gerarParteRotina({ parte: "treino", contexto: RI.contextoGeracao("treino", perfil, nutri, semana, atual), idioma, signal: ctrl.signal });
      const treinoIA = RI.higienizarTreinoIA(brutoT, semana);
      if (!treinoIA) throw new ErroIA("resposta_invalida");
      if (!vivoRef.current) throw new ErroIA("cancelado");
      setPasso(1);
      // 3) alimentação: metas calculadas aqui; a IA monta o cardápio dentro delas e o app confere
      const brutoA = await gerarParteRotina({ parte: "alimentar", contexto: RI.contextoGeracao("alimentar", perfil, nutri, semana, atual), idioma, signal: ctrl.signal });
      const alim = RI.higienizarAlimentarIA(brutoA, nutri);
      if (!alim) throw new ErroIA("resposta_invalida");
      const nova = {
        avaliacaoId: perfil.avaliacaoId, criadaEm: new Date().toISOString(),
        treino: { semana, ia: treinoIA, params, diasPlanejados: RI.diasDeTreino(semana), diasDisponiveis: (perfil.diasDisponiveis || []).length, resumoGerador: gerado.resumo ? (gerado.resumo.dias + " dias de treino · " + (gerado.resumo.sequencia || []).join(" / ")) : "" },
        alimentar: { plano: alim.plano, totais: alim.totais, avisos: alim.avisos, nutri },
      };
      await RI.salvarProposta(nova);
      if (!vivoRef.current) return;
      setProposta(nova); setFase("proposta"); rolarTopo();
    } catch (err) {
      await quota.devolver(IA_CONFIG.recursoRotina); // falhou: não gasta o seu uso
      const cancelado = err instanceof ErroIA && err.codigo === "cancelado" && !estourou;
      if (vivoRef.current) {
        if (cancelado) setFase("resumo");
        else { setErroGeracao(tr(mensagemDeErro(estourou ? new ErroIA("demorou") : err instanceof ErroIA ? err : new ErroIA("servidor")))); setFase("resumo"); }
      }
    } finally { clearTimeout(relogio); ctrlRef.current = null; ocupadoRef.current = false; }
  };
  const cancelarGeracao = () => { if (ctrlRef.current) ctrlRef.current.abort(); };

  // ---------- proposta / plano ativo ----------
  const ativar = async () => {
    try {
      const r = await RI.ativarProposta(proposta);
      await recarregar(); setProposta(null); setAviso(tr("Plano ativado! Ele já faz parte do contexto do assistente de IA.")); setFase("plano"); rolarTopo();
      if (onAlterado) onAlterado();
      return r;
    } catch (e) { setAviso(tr("Não consegui salvar o plano neste aparelho. Tente de novo.")); return null; }
  };
  const descartar = async () => { await RI.apagarProposta(); setProposta(null); await recarregar(); setFase("inicio"); };
  const aplicarNaRotina = async () => {
    const t = estado && estado.planoTreino;
    if (!t || !aplicarSemana) return;
    aplicarSemana(t.semana);
    try { await RI.marcarTreinoAplicado(); } catch (e) { /* segue */ }
    await recarregar(); setConfirmarAplicar(false);
    setAviso(tr("Treino aplicado na aba Rotina. Revise e toque em Salvar rotina para guardar."));
    if (onAlterado) onAlterado();
  };

  // ---------- check-in e reavaliação ----------
  const iniciarCheckin = () => { setCheckin({ peso: estado && estado.perfil && estado.perfil.peso ? String(estado.perfil.peso) : "" }); setErrosCk({}); setAnalise(null); setReav(null); setReavErro(""); setFase("checkin"); rolarTopo(); };
  const enviarCheckin = async () => {
    const erros = RI.errosCheckin(checkin);
    if (Object.keys(erros).length) { setErrosCk(erros); rolarTopo(); return; }
    try {
      await RI.adicionarCheckin(checkin);
      const novo = await recarregar();
      setAnalise(RI.analisarEvolucao(novo.perfil, novo.checkins, novo.planoTreino)); setFase("analise"); rolarTopo();
      if (onAlterado) onAlterado();
    } catch (e) { setErrosCk({ peso: "Não consegui salvar o registro neste aparelho." }); }
  };
  const pedirAnaliseIA = async () => {
    if (ocupadoRef.current || !estado || !estado.perfil) return;
    ocupadoRef.current = true; setReavErro(""); setReavCarregando(true);
    const uso = await quota.consumir(IA_CONFIG.recursoRotina);
    if (!uso.ok) { ocupadoRef.current = false; setReavCarregando(false); setReavErro(uso.motivo === "limite_mensal" ? trt("Você usou os {0} usos de IA deste mês.", [uso.limite]) : tr("Seu plano atual não inclui esse recurso.")); return; }
    const ctrl = new AbortController(); ctrlRef.current = ctrl;
    let estourou = false; const relogio = setTimeout(() => { estourou = true; ctrl.abort(); }, IA_CONFIG.tempoMaxGeracaoMs);
    try {
      const semana = estado.planoTreino ? estado.planoTreino.semana : [];
      const bruto = await gerarParteRotina({ parte: "reavaliacao", contexto: RI.contextoGeracao("reavaliacao", estado.perfil, RI.calcularNutricao(estado.perfil), semana, estado), idioma, signal: ctrl.signal });
      const r = RI.higienizarReavaliacaoIA(bruto);
      if (!r) throw new ErroIA("resposta_invalida");
      if (vivoRef.current) setReav(r);
    } catch (err) {
      await quota.devolver(IA_CONFIG.recursoRotina);
      if (vivoRef.current && !(err instanceof ErroIA && err.codigo === "cancelado" && !estourou)) setReavErro(tr(mensagemDeErro(estourou ? new ErroIA("demorou") : err instanceof ErroIA ? err : new ErroIA("servidor"))));
    } finally { clearTimeout(relogio); ctrlRef.current = null; ocupadoRef.current = false; if (vivoRef.current) setReavCarregando(false); }
  };

  // ---------- derivados ----------
  const nutriPrevia = useMemo(() => (fase === "resumo" ? RI.calcularNutricao(RI.limparRespostas(respostas)) : null), [fase, respostas]);
  const diasDesde = estado ? RI.diasDesdeUltimaAtualizacao(estado) : null;
  const titulos = { inicio: "Minha Rotina Inteligente", perguntas: RI.ETAPAS[Math.min(etapa, RI.ETAPAS.length - 1)].titulo, resumo: "Revise suas respostas", gerando: "Montando seu plano", proposta: "Seu plano está pronto", plano: "Meu plano", checkin: "Check-in", analise: "Como você está indo" };

  // ---------- telas ----------
  const corpoInicio = () => {
    if (!temIA) {
      return (
        <div style={{ ...cartao, textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>✨</div>
          <div style={{ fontWeight: 800, fontSize: 17, margin: "6px 0" }}>{tr("A Rotina Inteligente faz parte do Massi Pro IA")}</div>
          <div style={{ ...textoSuave, fontSize: 14, margin: "0 0 12px" }}>{tr(TEXTO_APRESENTACAO)}</div>
          <div style={{ textAlign: "left", fontSize: 14, lineHeight: 1.6, margin: "0 0 14px" }}>
            <div>✅ {tr("Treino semanal ajustado aos seus dias, nível e recuperação")}</div>
            <div>✅ {tr("Alimentação com metas estimadas, porções e substituições")}</div>
            <div>✅ {tr("O assistente de IA passa a conhecer o seu perfil")}</div>
            <div>✅ {tr("Check-ins para acompanhar a evolução sem mudanças automáticas")}</div>
          </div>
          <button type="button" style={botaoPrim} onClick={onVerPlanos}>{tr("Conhecer o Massi Pro IA")}</button>
        </div>
      );
    }
    const e = estado;
    return (
      <div>
        <div style={cartao}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>✨ {tr("Minha Rotina Inteligente")}</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{tr(TEXTO_APRESENTACAO)}</div>
        </div>
        {aviso && <div style={avisoEstilo} role="status">{aviso}</div>}
        {e && e.proposta && (
          <div style={cartao}>
            <div style={{ fontWeight: 800 }}>{tr("Há um plano gerado esperando a sua confirmação")}</div>
            <div style={{ ...textoSuave, margin: "4px 0 10px" }}>{e.planoTreino ? tr("Seu plano atual continua ativo até você ativar este.") : tr("Revise e ative para ele valer.")}</div>
            <button type="button" style={botaoPrim} onClick={() => { setProposta(e.proposta); setFase("proposta"); }}>{tr("Ver plano gerado")}</button>
          </div>
        )}
        {e && e.planoTreino && (
          <div style={cartao}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>✅ {tr("Seu plano está ativo")}</div>
            <div style={{ ...textoSuave, marginBottom: 10 }}>{trt("Gerado em {0} · {1} dias de treino por semana{2}", [RI.dataCurta((e.planoTreino.geradoEm || "").slice(0, 10)), RI.diasDeTreino(e.planoTreino.semana), e.planoTreino.aplicadoNaRotina ? "" : " · " + tr("ainda não aplicado na aba Rotina")])}</div>
            {diasDesde !== null && diasDesde >= RI.DIAS_PARA_REAVALIAR && <div style={avisoEstilo}>{trt("Faz {0} dias desde o último registro. Que tal fazer um check-in para ver como você está indo?", [diasDesde])}</div>}
            <button type="button" style={botaoPrim} onClick={() => { setFase("plano"); rolarTopo(); }}>{tr("Ver meu plano")}</button>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={iniciarCheckin}>{tr("Fazer check-in")}</button>
              <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={() => comecar("reavaliar")}>{tr("Refazer avaliação")}</button>
            </div>
          </div>
        )}
        {e && !e.planoTreino && (
          <div style={cartao}>
            {e.rascunho ? (
              <>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{tr("Você parou no meio")}</div>
                <div style={{ ...textoSuave, marginBottom: 10 }}>{tr("Suas respostas ficaram salvas neste aparelho.")}</div>
                <button type="button" style={botaoPrim} onClick={() => comecar("retomar")}>{tr("Continuar de onde parei")}</button>
                <button type="button" style={{ ...botaoSec, width: "100%", marginTop: 8 }} onClick={() => comecar("novo")}>{tr("Recomeçar")}</button>
              </>
            ) : (
              <button type="button" style={botaoPrim} onClick={() => comecar("novo")}>{tr("Personalizar minha rotina")}</button>
            )}
          </div>
        )}
        {e && e.planoTreino && e.rascunho && (
          <button type="button" style={{ ...botaoSec, width: "100%", marginBottom: 10 }} onClick={() => comecar("retomar")}>{tr("Continuar avaliação salva")}</button>
        )}
        {situ.limite > 0 && <div style={textoSuave}>{trt("Gerar um plano ou pedir análise da IA usa 1 dos seus {0} usos mensais ({1} restantes).", [situ.limite, situ.restante])}</div>}
      </div>
    );
  };

  const corpoPerguntas = () => {
    const et = RI.ETAPAS[etapa];
    const erros = mostrarErros ? RI.errosDaEtapa(et, respostas) : {};
    return (
      <div>
        {tipoAval === "reavaliacao" && <div style={avisoEstilo}>{tr("Reavaliação: as respostas vêm do seu perfil atual. Mude só o que mudou; seu histórico e registros anteriores são mantidos.")}</div>}
        {RI.camposVisiveis(et, respostas).map((c) => (
          <Campo key={c.id} campo={c} valor={respostas[c.id]} onMudar={(v) => mudar(c.id, v)} erro={erros[c.id]} respostas={respostas} tr={tr} />
        ))}
        {etapa === 3 && <div style={textoSuave}>{tr("Não fazemos diagnóstico. Se houver dor ou lesão, o plano evita movimentos que possam agravar e recomenda avaliação profissional.")}</div>}
        {mostrarErros && Object.keys(erros).length > 0 && <div style={{ ...erroEstilo, marginTop: 6 }} role="alert">{tr("Confira os campos destacados para continuar.")}</div>}
      </div>
    );
  };

  const corpoResumo = () => {
    const limpas = RI.limparRespostas(respostas);
    const dispo = (limpas.diasDisponiveis || []).length, usados = RI.diasRecomendados(limpas);
    return (
      <div>
        <div style={{ ...textoSuave, marginBottom: 10 }}>{tr("Confira antes de gerar. Você pode editar qualquer etapa.")}</div>
        {RI.ETAPAS.map((et, i) => (
          <div key={et.id} style={cartao}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 800 }}>{et.icone} {tr(et.titulo)}</div>
              <button type="button" onClick={() => editarEtapa(i)} style={{ ...botaoSec, padding: "5px 12px", fontSize: 13 }} aria-label={tr("Editar") + " " + tr(et.titulo)}>{tr("Editar")}</button>
            </div>
            {RI.camposVisiveis(et, limpas).map((c) => (
              <div key={c.id} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.4 }}><span style={{ color: COR.suave }}>{tr(c.rotulo.replace(/\s*\(opcional.*?\)\??/i, "").replace(/\?$/, ""))}: </span>{rotuloResposta(c, limpas[c.id], limpas, tr)}</div>
            ))}
          </div>
        ))}
        {usados < dispo && <div style={avisoEstilo}>{trt("Você marcou {0} dias livres. Para o seu nível e recuperação, o plano vai usar {1} dias de treino; os outros ficam para descanso ou atividade leve.", [dispo, usados])}</div>}
        {nutriPrevia && nutriPrevia.modo !== "completo" && nutriPrevia.textoLimite && <div style={avisoEstilo}>{nutriPrevia.textoLimite.map((x, i) => <div key={i}>{tr(x)}</div>)}</div>}
        {nutriPrevia && nutriPrevia.avisos.map((a, i) => <div key={i} style={avisoEstilo}>{tr(a)}</div>)}
        {erroGeracao && <div style={{ ...avisoEstilo, borderColor: "rgba(255,107,94,0.5)", background: "rgba(255,107,94,0.12)" }} role="alert">⚠️ {erroGeracao}</div>}
        <button type="button" style={botaoPrim} onClick={gerarPlano} data-testid="gerar-rotina">{tr("Gerar minha rotina")}</button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={() => editarEtapa(0)}>{tr("Editar respostas")}</button>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={salvarESair}>{tr("Salvar e continuar depois")}</button>
        </div>
        {situ.limite > 0 && <div style={{ ...textoSuave, marginTop: 10 }}>{trt("Usa 1 dos seus {0} usos mensais de IA ({1} restantes). Se a geração falhar, o uso é devolvido.", [situ.limite, situ.restante])}</div>}
      </div>
    );
  };

  const corpoGerando = () => (
    <div style={{ ...cartao, textAlign: "center" }} role="status" aria-live="polite">
      <div style={{ fontSize: 34 }}>⚙️</div>
      <div style={{ fontWeight: 800, fontSize: 16, margin: "6px 0" }}>{passo === 0 ? tr("Montando seu treino…") : tr("Montando sua alimentação…")}</div>
      <div style={{ ...textoSuave, marginBottom: 14 }}>{tr("Isso leva cerca de 30 a 60 segundos. Pode deixar o app aberto.")}</div>
      <div style={{ height: 8, background: COR.card2, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}><div style={{ width: (passo === 0 ? 40 : 80) + "%", height: "100%", background: COR.lime, transition: "width .6s" }} /></div>
      <button type="button" style={botaoSec} onClick={cancelarGeracao}>{tr("Cancelar")}</button>
    </div>
  );

  const corpoProposta = () => {
    const p = proposta;
    if (!p) return null;
    return (
      <div>
        <div style={avisoEstilo}>{estado && estado.planoTreino ? tr("Este plano só substitui o atual quando você tocar em Ativar. O atual fica guardado no histórico.") : tr("Leia com calma e toque em Ativar para começar a usar.")}</div>
        <VisaoPlano treino={p.treino} alimentar={p.alimentar} tr={tr} />
        {aviso && <div style={avisoEstilo}>{aviso}</div>}
        <button type="button" style={botaoPrim} onClick={ativar} data-testid="ativar-plano">{tr("Ativar este plano")}</button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={() => comecar("editar")}>{tr("Editar respostas")}</button>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={descartar}>{tr("Descartar")}</button>
        </div>
      </div>
    );
  };

  // Compartilhar e exportar o plano (texto gerado a partir do que está salvo; nada é inventado)
  const compartilharPlanoWhats = () => {
    const e = estado;
    if (!e || !e.planoTreino) return;
    let txt = RI.textoDoPlano(e.planoTreino, e.planoAlimentar);
    const LIMITE = 3000;
    if (txt.length > LIMITE) txt = txt.slice(0, LIMITE) + "\n\n" + tr("(Resumo. O plano completo está no PDF do Massi Pro.)");
    window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank", "noopener,noreferrer");
  };
  const exportarPlanoPDF = () => {
    const e = estado;
    if (!e || !e.planoTreino) return;
    const texto = RI.textoDoPlano(e.planoTreino, e.planoAlimentar);
    const w = window.open("", "_blank");
    if (!w) { setAviso(tr("Permita pop-ups do Massi Pro para exportar o PDF.")); return; }
    const escapar = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Meu plano - Massi Pro</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111;line-height:1.5;white-space:pre-wrap}@media print{body{margin:0}}</style></head><body>' + escapar(texto) + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (err) { /* o usuário pode imprimir pelo menu */ } }, 300);
  };

  const corpoPlano = () => {
    const e = estado;
    if (!e || !e.planoTreino) return null;
    return (
      <div>
        {aviso && <div style={avisoEstilo} role="status">{aviso}</div>}
        {diasDesde !== null && diasDesde >= RI.DIAS_PARA_REAVALIAR && <div style={avisoEstilo}>{trt("Faz {0} dias desde o último registro. Que tal fazer um check-in?", [diasDesde])}</div>}
        {!e.planoTreino.aplicadoNaRotina && (
          <div style={cartao}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{tr("Treino ainda não está na aba Rotina")}</div>
            {!confirmarAplicar ? (
              <button type="button" style={botaoPrim} onClick={() => setConfirmarAplicar(true)} data-testid="aplicar-treino">{tr("Aplicar treino na aba Rotina")}</button>
            ) : (
              <div>
                <div style={{ ...avisoEstilo }}>{tr("Isso substitui os treinos que estão no editor da aba Rotina. Sua rotina salva só muda quando você tocar em Salvar rotina.")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={{ ...botaoPrim, flex: 1 }} onClick={aplicarNaRotina} data-testid="confirmar-aplicar">{tr("Substituir")}</button>
                  <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={() => setConfirmarAplicar(false)}>{tr("Cancelar")}</button>
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={compartilharPlanoWhats} data-testid="compartilhar-plano">💬 {tr("WhatsApp")}</button>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={exportarPlanoPDF} data-testid="exportar-plano">📄 {tr("Exportar PDF")}</button>
        </div>
        <VisaoPlano treino={e.planoTreino} alimentar={e.planoAlimentar} tr={tr} />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={iniciarCheckin}>{tr("Fazer check-in")}</button>
          <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={() => comecar("reavaliar")}>{tr("Refazer avaliação")}</button>
        </div>
      </div>
    );
  };

  const corpoCheckin = () => (
    <div>
      <div style={{ ...textoSuave, marginBottom: 12 }}>{tr("Leva um minuto. Seus registros anteriores são mantidos; nada no seu plano muda sozinho.")}</div>
      {RI.CAMPOS_CHECKIN.map((c) => <Campo key={c.id} campo={c} valor={checkin[c.id]} onMudar={(v) => setCheckin((x) => ({ ...x, [c.id]: v }))} erro={errosCk[c.id]} respostas={checkin} tr={tr} />)}
      <button type="button" style={botaoPrim} onClick={enviarCheckin} data-testid="salvar-checkin">{tr("Salvar check-in")}</button>
    </div>
  );

  const corpoAnalise = () => {
    const a = analise || { sinais: [] };
    const pode = estado && estado.checkins.length > 0;
    return (
      <div>
        <div style={{ ...avisoEstilo, background: "rgba(167,255,0,0.08)", borderColor: "rgba(167,255,0,0.3)" }}>✅ {tr("Check-in salvo.")}</div>
        <div style={cartao}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{tr("O que os seus registros mostram")}</div>
          {a.sinais.length === 0 && <div style={textoSuave}>{tr("Ainda há poucos registros para comparar. Continue registrando a cada 2 a 4 semanas.")}</div>}
          {a.sinais.map((s, i) => <div key={i} style={{ fontSize: 14, marginBottom: 6, lineHeight: 1.45 }}>{s.tipo === "ok" ? "✅" : s.tipo === "atencao" ? "⚠️" : "ℹ️"} {s.texto}</div>)}
          {a.manter && <div style={{ fontWeight: 700, marginTop: 6 }}>{tr("Tudo indica que vale manter o plano como está.")}</div>}
        </div>
        {reav && (
          <div style={cartao} data-testid="resultado-reavaliacao">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>🤖 {tr("Análise da IA")}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{reav.avaliacao}</div>
            <div style={{ fontWeight: 700, margin: "8px 0 4px" }}>{reav.manter ? tr("Sugestão: manter o plano.") : tr("Mudanças sugeridas (nada foi alterado):")}</div>
            {reav.mudancas.map((m, i) => <div key={i} style={{ fontSize: 13.5, marginBottom: 6 }}>• {m.area ? <strong>{m.area}: </strong> : null}{m.mudanca}{m.motivo ? <span style={{ color: COR.suave }}> — {m.motivo}</span> : null}</div>)}
            {reav.proximoPasso && <div style={{ ...textoSuave, marginTop: 6 }}>{reav.proximoPasso}</div>}
            {!reav.manter && <button type="button" style={{ ...botaoPrim, marginTop: 10 }} onClick={() => comecar("reavaliar")}>{tr("Refazer avaliação com esses dados")}</button>}
          </div>
        )}
        {reavErro && <div style={{ ...avisoEstilo, borderColor: "rgba(255,107,94,0.5)", background: "rgba(255,107,94,0.12)" }} role="alert">⚠️ {reavErro}</div>}
        {!reav && pode && (
          <button type="button" style={{ ...botaoSec, width: "100%", marginBottom: 8 }} onClick={pedirAnaliseIA} disabled={reavCarregando}>
            {reavCarregando ? tr("Analisando…") : tr("Pedir análise da IA")} {situ.limite > 0 && !reavCarregando ? "(1 uso)" : ""}
          </button>
        )}
        <button type="button" style={botaoSec} onClick={() => { setFase("inicio"); rolarTopo(); }}>{tr("Concluir")}</button>
      </div>
    );
  };

  const emPerguntas = fase === "perguntas";
  const progresso = emPerguntas ? ((etapa + 1) / (RI.ETAPAS.length + 1)) * 100 : fase === "resumo" ? (RI.ETAPAS.length / (RI.ETAPAS.length + 1)) * 100 : 0;
  const mostrarRodape = emPerguntas;

  return (
    <div style={tela} role="dialog" aria-label={tr("Minha Rotina Inteligente")} data-testid="rotina-inteligente">
      <div style={cabecalho}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>✨ {tr(titulos[fase] || "Minha Rotina Inteligente")}</div>
          {emPerguntas && <div style={{ fontSize: 12, color: COR.suave }}>{trt("Etapa {0} de {1}", [etapa + 1, RI.ETAPAS.length])}{salvoEm ? " · " + tr("progresso salvo") : ""}</div>}
        </div>
        <button type="button" style={botaoFechar} onClick={fase === "gerando" ? cancelarGeracao : onFechar} aria-label={tr("Fechar")}>✕ {tr("Fechar")}</button>
      </div>
      {(emPerguntas || fase === "resumo") && <div style={{ height: 4, background: COR.card2, flexShrink: 0 }} role="progressbar" aria-valuenow={Math.round(progresso)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: progresso + "%", height: "100%", background: COR.lime, transition: "width .3s" }} /></div>}
      <div ref={topoRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 14, color: COR.texto, fontFamily: FONTE }}>
        {!estado && <div style={textoSuave}>{tr("Carregando…")}</div>}
        {estado && fase === "inicio" && corpoInicio()}
        {estado && fase === "perguntas" && corpoPerguntas()}
        {estado && fase === "resumo" && corpoResumo()}
        {fase === "gerando" && corpoGerando()}
        {fase === "proposta" && corpoProposta()}
        {estado && fase === "plano" && corpoPlano()}
        {estado && fase === "checkin" && corpoCheckin()}
        {estado && fase === "analise" && corpoAnalise()}
        {erroSalvar && <div style={erroEstilo}>{tr(erroSalvar)}</div>}
        {fase !== "inicio" && fase !== "perguntas" && fase !== "gerando" && fase !== "resumo" && (
          <button type="button" onClick={() => { setFase("inicio"); rolarTopo(); }} style={{ ...botaoSec, marginTop: 12, background: "transparent" }}>← {tr("Início da Rotina Inteligente")}</button>
        )}
      </div>
      {mostrarRodape && (
        <div style={{ borderTop: "1px solid " + COR.borda, padding: "10px 12px", paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))", flexShrink: 0, background: COR.fundo }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...botaoSec, flex: 1 }} onClick={voltar}>{tr("Voltar")}</button>
            <button type="button" style={{ ...botaoPrim, flex: 2 }} onClick={proxima} data-testid="proxima">{etapa + 1 >= RI.ETAPAS.length ? tr("Revisar") : tr("Próxima")}</button>
          </div>
          <button type="button" onClick={salvarESair} style={{ background: "transparent", border: "none", color: COR.suave, fontSize: 13, marginTop: 8, width: "100%", cursor: "pointer", fontFamily: FONTE }}>{tr("Salvar e continuar depois")}</button>
        </div>
      )}
      {fase === "resumo" && (
        <div style={{ borderTop: "1px solid " + COR.borda, padding: "8px 12px", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))", flexShrink: 0, background: COR.fundo }}>
          <button type="button" style={{ ...botaoSec, width: "100%" }} onClick={voltar}>{tr("Voltar")}</button>
        </div>
      )}
    </div>
  );
}
