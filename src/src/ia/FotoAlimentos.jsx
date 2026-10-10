import React, { useEffect, useRef, useState } from "react";
import { IA_CONFIG } from "./config.js";
import { analisarFoto, prepararImagem, mensagemDeErro, ErroIA } from "./clienteIA.js";
import { adicionarEntrada, somarItens } from "./diarioStorage.js";
import { COR, FONTE, tela, cabecalho, botaoFechar, botaoPrimario, botaoSecundario, cartao } from "./tema.js";

const REFEICOES = ["Café da manhã", "Almoço", "Lanche", "Jantar"];
function refeicaoPorHorario() {
  const h = new Date().getHours();
  return h < 10 ? "Café da manhã" : h < 15 ? "Almoço" : h < 18 ? "Lanche" : "Jantar";
}
const arred1 = (n) => Math.round(n * 10) / 10;

// Cada item guarda os valores "por grama" para recalcular quando a pessoa muda a porção.
function prepararItens(itens) {
  return itens.map((i, k) => {
    const g = Math.max(1, Number(i.porcao_g) || 1);
    return { id: "i" + k, nome: i.nome, porcao_g: g, confianca: i.confianca,
      porG: { cal: (Number(i.calorias) || 0) / g, p: (Number(i.proteinas_g) || 0) / g, c: (Number(i.carboidratos_g) || 0) / g, g: (Number(i.gorduras_g) || 0) / g },
      calorias: Math.round(Number(i.calorias) || 0), proteinas_g: arred1(Number(i.proteinas_g) || 0), carboidratos_g: arred1(Number(i.carboidratos_g) || 0), gorduras_g: arred1(Number(i.gorduras_g) || 0) };
  });
}
function recalcular(item, novaPorcao) {
  const g = Math.max(0, Math.min(3000, Number(novaPorcao) || 0));
  return { ...item, porcao_g: g, calorias: Math.round(item.porG.cal * g), proteinas_g: arred1(item.porG.p * g), carboidratos_g: arred1(item.porG.c * g), gorduras_g: arred1(item.porG.g * g) };
}

/**
 * Reconhecimento de alimentos por foto: foto → IA identifica → calorias e macros → salvar no diário.
 * Props: onFechar, i18n {tr,trt}, idioma, quota (MassiIA), temIA, onVerPlanos, onAbrirDiario
 */
export default function FotoAlimentos({ onFechar, i18n, idioma, quota, temIA, onVerPlanos, onAbrirDiario }) {
  const tr = (i18n && i18n.tr) || ((x) => x);
  const trt = (i18n && i18n.trt) || ((k, a) => (a || []).reduce((t, v, i) => t.split("{" + i + "}").join(v), k));
  const [etapa, setEtapa] = useState("inicio"); // inicio | analisando | resultado | salvo
  const [previa, setPrevia] = useState("");
  const [miniatura, setMiniatura] = useState("");
  const [itens, setItens] = useState([]);
  const [obs, setObs] = useState("");
  const [refeicao, setRefeicao] = useState(refeicaoPorHorario());
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [, setTick] = useState(0);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const ctrlRef = useRef(null);
  useEffect(() => (quota && quota.inscrever ? quota.inscrever(() => setTick((n) => n + 1)) : undefined), [quota]);
  useEffect(() => () => { if (ctrlRef.current) ctrlRef.current.abort(); }, []);

  const situ = quota ? quota.situacao(IA_CONFIG.recursoFoto) : { limite: 0, usado: 0, restante: 0 };
  const total = somarItens(itens);

  const reiniciar = () => { setEtapa("inicio"); setPrevia(""); setMiniatura(""); setItens([]); setObs(""); setNota(""); setErro(""); setRefeicao(refeicaoPorHorario()); };

  const aoEscolher = async (e) => {
    const arquivo = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    let img;
    try { img = await prepararImagem(arquivo); } catch (er) { setErro(tr(mensagemDeErro(er))); return; }
    setPrevia(img.previa);
    setMiniatura(img.miniatura);
    const uso = await quota.consumir(IA_CONFIG.recursoFoto);
    if (!uso.ok) {
      setErro(uso.motivo === "limite_mensal" ? trt("Você usou as {0} análises de foto deste mês. O limite renova no começo do próximo mês.", [uso.limite]) : tr("Seu plano atual não inclui a análise de fotos por IA."));
      setPrevia("");
      return;
    }
    setEtapa("analisando");
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const r = await analisarFoto({ imagem: img, idioma, nota, signal: ctrl.signal });
      if (!r.comida || !r.itens.length) {
        await quota.devolver(IA_CONFIG.recursoFoto);
        setErro(tr("Não identifiquei comida nessa foto. Tente chegar mais perto do prato, com boa luz."));
        setEtapa("inicio");
        setPrevia("");
        return;
      }
      setItens(prepararItens(r.itens));
      setObs(r.observacoes || "");
      setEtapa("resultado");
    } catch (er) {
      if (!(er instanceof ErroIA && er.codigo === "cancelado")) {
        await quota.devolver(IA_CONFIG.recursoFoto); // falhou: não gasta a sua cota
        setErro(tr(mensagemDeErro(er)));
      }
      setEtapa("inicio");
      setPrevia("");
    }
    ctrlRef.current = null;
  };

  const mudarPorcao = (id, v) => setItens((l) => l.map((i) => (i.id === id ? recalcular(i, v) : i)));
  const mudarNome = (id, v) => setItens((l) => l.map((i) => (i.id === id ? { ...i, nome: v.slice(0, 60) } : i)));
  const remover = (id) => setItens((l) => l.filter((i) => i.id !== id));

  const salvar = async () => {
    if (!itens.length || salvando) return;
    setSalvando(true);
    const limpos = itens.map((i) => ({ nome: i.nome, porcao_g: i.porcao_g, calorias: i.calorias, proteinas_g: i.proteinas_g, carboidratos_g: i.carboidratos_g, gorduras_g: i.gorduras_g }));
    const nova = await adicionarEntrada({ refeicao, itens: limpos, miniatura, origem: "foto" });
    setSalvando(false);
    if (nova) setEtapa("salvo");
    else setErro(tr("Não consegui salvar agora. Tente de novo."));
  };

  const Macro = ({ rotulo, valor, cor }) => (
    <div style={{ flex: 1, minWidth: 0, background: COR.card2, borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: cor }}>{valor}<span style={{ fontSize: 11, fontWeight: 600 }}> g</span></div>
      <div style={{ fontSize: 11.5, color: COR.suave }}>{tr(rotulo)}</div>
    </div>
  );

  return (
    <div style={tela} role="dialog" aria-label={tr("Foto de alimentos")}>
      <div style={cabecalho}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>📷 {tr("Foto de alimentos")}</div>
        <button style={botaoFechar} onClick={onFechar}>✕ {tr("Fechar")}</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 14 }}>
        {!temIA && (
          <div style={{ ...cartao, textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 34 }}>📷</div>
            <div style={{ fontWeight: 800, fontSize: 17, margin: "6px 0" }}>{tr("A análise de fotos faz parte do Massi Pro IA")}</div>
            <div style={{ color: COR.suave, fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>{tr("Tire uma foto do prato e veja calorias, proteínas, carboidratos e gorduras na hora. Experimente 7 dias grátis.")}</div>
            <button style={botaoPrimario} onClick={onVerPlanos}>{tr("Ver planos")}</button>
          </div>
        )}

        {temIA && etapa === "inicio" && (
          <div>
            <div style={{ ...cartao, lineHeight: 1.5, fontSize: 14.5 }}>
              {tr("Tire uma foto do prato (ou escolha uma da galeria). A IA identifica os alimentos e estima as calorias e os macros. Você confere, ajusta as porções e salva no diário.")}
            </div>
            <input value={nota} onChange={(e) => setNota(e.target.value.slice(0, 300))} placeholder={tr("Dica opcional: ex.: 200 g de frango grelhado")} aria-label={tr("Dica sobre o prato")} style={{ width: "100%", boxSizing: "border-box", background: COR.card, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 12, padding: "12px 13px", fontSize: 14.5, fontFamily: FONTE, marginBottom: 12, outline: "none" }} />
            <button style={{ ...botaoPrimario, marginBottom: 10 }} onClick={() => camRef.current && camRef.current.click()}>📷 {tr("Tirar foto")}</button>
            <button style={botaoSecundario} onClick={() => galRef.current && galRef.current.click()}>🖼️ {tr("Escolher da galeria")}</button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={aoEscolher} style={{ display: "none" }} data-testid="foto-camera" />
            <input ref={galRef} type="file" accept="image/*" onChange={aoEscolher} style={{ display: "none" }} data-testid="foto-galeria" />
            {situ.limite > 0 && <div style={{ textAlign: "center", fontSize: 12.5, color: COR.suave, marginTop: 12 }}>{trt("{0} de {1} análises restantes neste mês", [situ.restante, situ.limite])}</div>}
            <div style={{ fontSize: 12, color: COR.suave, lineHeight: 1.5, marginTop: 14 }}>
              {tr("A foto é enviada para análise por IA e não fica guardada no servidor do Massi Pro. No diário, só uma miniatura fica no seu aparelho.")}
            </div>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={onAbrirDiario} style={{ background: "transparent", border: "none", color: COR.lime, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>🍽️ {tr("Ver meu diário alimentar")}</button>
            </div>
          </div>
        )}

        {temIA && etapa === "analisando" && (
          <div style={{ textAlign: "center", paddingTop: 10 }}>
            {previa && <img src={previa} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 14 }} />}
            <div style={{ marginTop: 18, fontSize: 16, fontWeight: 700 }}>🔎 {tr("Analisando seu prato…")}</div>
            <div style={{ color: COR.suave, fontSize: 13.5, marginTop: 6 }}>{tr("Isso leva alguns segundos.")}</div>
            <button style={{ ...botaoSecundario, marginTop: 18 }} onClick={() => { if (ctrlRef.current) ctrlRef.current.abort(); }}>{tr("Cancelar")}</button>
          </div>
        )}

        {temIA && etapa === "resultado" && (
          <div>
            {previa && <img src={previa} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 14, marginBottom: 12 }} />}
            <div style={{ ...cartao, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: COR.suave, letterSpacing: 1 }}>{tr("TOTAL DA REFEIÇÃO")}</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: COR.lime, lineHeight: 1.1 }} data-testid="total-kcal">{total.calorias}<span style={{ fontSize: 15, color: COR.suave }}> kcal</span></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Macro rotulo="Proteínas" valor={total.proteinas_g} cor={COR.azul} />
                <Macro rotulo="Carboidratos" valor={total.carboidratos_g} cor={COR.amarelo} />
                <Macro rotulo="Gorduras" valor={total.gorduras_g} cor={COR.vermelho} />
              </div>
            </div>
            <div style={{ fontWeight: 700, margin: "4px 0 8px 2px" }}>{tr("Alimentos identificados")}</div>
            {itens.map((i) => (
              <div key={i.id} style={{ ...cartao, padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={i.nome} onChange={(e) => mudarNome(i.id, e.target.value)} aria-label={tr("Nome do alimento")} style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", borderBottom: "1px dashed " + COR.borda, color: COR.texto, fontSize: 15, fontWeight: 700, fontFamily: FONTE, padding: "2px 0", outline: "none" }} />
                  <button onClick={() => remover(i.id)} aria-label={tr("Remover")} style={{ background: "transparent", border: "none", color: COR.suave, fontSize: 18, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13.5 }}>
                  <label style={{ color: COR.suave }}>{tr("Porção")}</label>
                  <input type="number" inputMode="decimal" min="0" max="3000" value={i.porcao_g} onChange={(e) => mudarPorcao(i.id, e.target.value)} aria-label={tr("Porção em gramas")} style={{ width: 74, background: COR.card2, color: COR.texto, border: "1px solid " + COR.borda, borderRadius: 8, padding: "6px 8px", fontSize: 14, fontFamily: FONTE }} />
                  <span style={{ color: COR.suave }}>g</span>
                  <span style={{ marginLeft: "auto", fontWeight: 800 }}>{i.calorias} kcal</span>
                </div>
                <div style={{ fontSize: 12.5, color: COR.suave, marginTop: 6 }}>
                  P {i.proteinas_g} g · C {i.carboidratos_g} g · G {i.gorduras_g} g
                  {i.confianca > 0 && i.confianca < 0.55 ? " · " + tr("estimativa incerta") : ""}
                </div>
              </div>
            ))}
            {obs && <div style={{ fontSize: 12.5, color: COR.suave, lineHeight: 1.45, margin: "2px 2px 12px" }}>💡 {obs}</div>}
            <div style={{ fontSize: 12.5, color: COR.suave, margin: "0 0 6px 2px" }}>{tr("Refeição")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {REFEICOES.map((r) => (
                <button key={r} onClick={() => setRefeicao(r)} style={{ padding: "7px 13px", borderRadius: 999, border: "1px solid " + (refeicao === r ? COR.lime : COR.borda), background: refeicao === r ? "rgba(154,205,50,0.15)" : COR.card2, color: refeicao === r ? COR.lime : COR.texto, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{tr(r)}</button>
              ))}
            </div>
            <button style={{ ...botaoPrimario, marginBottom: 10, opacity: itens.length ? 1 : 0.5 }} disabled={!itens.length || salvando} onClick={salvar}>{salvando ? tr("Salvando…") : "💾 " + tr("Salvar no diário")}</button>
            <button style={botaoSecundario} onClick={reiniciar}>{tr("Refazer com outra foto")}</button>
            <div style={{ fontSize: 11.5, color: COR.suave, lineHeight: 1.5, marginTop: 12 }}>{tr("Valores estimados por IA: podem variar bastante conforme o preparo e a porção real. Não substituem orientação de nutricionista.")}</div>
          </div>
        )}

        {temIA && etapa === "salvo" && (
          <div style={{ ...cartao, textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 42 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 18, margin: "6px 0" }}>{tr("Refeição salva no diário!")}</div>
            <div style={{ color: COR.suave, fontSize: 14, marginBottom: 16 }}>{trt("{0} kcal · {1}", [total.calorias, tr(refeicao)])}</div>
            <button style={{ ...botaoPrimario, marginBottom: 10 }} onClick={onAbrirDiario}>🍽️ {tr("Ver diário alimentar")}</button>
            <button style={botaoSecundario} onClick={reiniciar}>📷 {tr("Analisar outra refeição")}</button>
          </div>
        )}

        {erro && <div style={{ background: "rgba(255,107,94,0.12)", border: "1px solid rgba(255,107,94,0.4)", color: "#FFB1A8", borderRadius: 12, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.45, marginTop: 12 }}>⚠️ {erro}</div>}
      </div>
    </div>
  );
}
