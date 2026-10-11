import React, { useEffect, useRef, useState } from "react";
import {
  OBJETIVOS, ITENS_META, ATIVIDADES, AJUSTES, FAIXAS_IMC,
  fatoresPadrao, calcularMetas, calcularGasto, calcularIMC, calcular1RM, lerNumero, formatar,
} from "./calculos.js";

const CHAVE = "calculadora-massi";
const C = { fundo: "#0F1417", card: "#1A2226", card2: "#222C31", borda: "rgba(255,255,255,0.10)", texto: "#EAF0F2", suave: "#9AA8AF", lime: "#9ACD32", azul: "#6EC1F5", amarelo: "#FFC700", vermelho: "#FF6B5E", verde: "#7FE08F", laranja: "#FF9F43" };
const COR_ITEM = { prot: C.azul, agua: "#4FC3F7", kcal: C.laranja, creatina: C.amarelo, carbo: "#F2C14E", cafeina: "#C79A6B", gord: C.vermelho, fibra: C.verde };

function estadoPadrao() {
  const fatores = {};
  OBJETIVOS.forEach((o) => { fatores[o.id] = fatoresPadrao(o.id); });
  return { peso: "", objetivo: "emagrecer", fatores, kcalManual: null, sexo: "masculino", idade: "", altura: "", atividade: 1.55, ajuste: "def20", rmCarga: "", rmReps: "" };
}
async function carregarEstado() {
  const base = estadoPadrao();
  let salvo = null;
  try { const r = await window.storage.get(CHAVE); if (r && r.value) salvo = JSON.parse(r.value); } catch (e) { /* primeira vez */ }
  if (salvo && typeof salvo === "object") {
    const m = { ...base, ...salvo };
    m.fatores = {};
    OBJETIVOS.forEach((o) => { m.fatores[o.id] = { ...base.fatores[o.id], ...((salvo.fatores && salvo.fatores[o.id]) || {}) }; });
    return m;
  }
  // primeira vez: aproveita o que o app já sabe (última avaliação e data de nascimento)
  try {
    const r = await window.storage.get("avaliacoes-evolucao");
    const l = r && r.value ? JSON.parse(r.value) : [];
    const a = l.length ? l[l.length - 1] : null;
    if (a) { if (a.peso) base.peso = String(a.peso); if (a.altura) base.altura = String(a.altura); if (a.sexo === "feminino" || a.sexo === "masculino") base.sexo = a.sexo; }
  } catch (e) { /* sem avaliação */ }
  try {
    const r = await window.storage.get("onboarding-perfil");
    const o = r && r.value ? JSON.parse(r.value) : null;
    if (o && /^\d{4}-\d{2}-\d{2}/.test(o.nascimento || "")) {
      const n = new Date(o.nascimento + "T12:00:00Z"), h = new Date();
      let idade = h.getUTCFullYear() - n.getUTCFullYear();
      if (h.getUTCMonth() < n.getUTCMonth() || (h.getUTCMonth() === n.getUTCMonth() && h.getUTCDate() < n.getUTCDate())) idade -= 1;
      if (idade >= 10 && idade <= 100) base.idade = String(idade);
    }
  } catch (e) { /* sem onboarding */ }
  return base;
}

function copiarTexto(texto) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(() => true, () => copiarAntigo(texto));
  } catch (e) { /* tenta o jeito antigo */ }
  return Promise.resolve(copiarAntigo(texto));
}
function copiarAntigo(texto) {
  try {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) { return false; }
}

function resumoTexto(est, metas, tr, trt, locale) {
  const o = OBJETIVOS.find((x) => x.id === est.objetivo) || OBJETIVOS[0];
  const f = est.fatores[est.objetivo];
  const n = (v, c) => formatar(v, locale, c === undefined ? 2 : c);
  const linhas = [`🧮 ${tr("Calculadora Massi")} — ${o.emoji} ${tr(o.nome)}`, `${tr("Peso")}: ${n(metas.peso)} kg`, ""];
  ITENS_META.forEach((i) => {
    const kcalManual = i.id === "kcal" && metas.kcalManual;
    linhas.push(`${i.emoji} ${tr(i.nome)}: ${kcalManual ? n(metas.kcal, 0) : `${n(metas.peso)} × ${n(f[i.id])} = ${n(metas.itens[i.id], i.id === "creatina" ? 2 : 1)}`} ${i.unidade}${i.id === "agua" ? ` (≈ ${n(metas.copos, 1)} ${tr("copos")})` : ""}`);
  });
  linhas.push(`🥑 ${tr("Gorduras")}: ≈ ${n(metas.gordG, 0)} g (${tr("o que sobra das calorias")})`);
  linhas.push(`🥦 ${tr("Fibras")}: ≈ ${n(metas.fibras, 0)} g`);
  linhas.push("", tr("Estimativas gerais; não substituem nutricionista.") + " — Massi Pro");
  return linhas.join("\n");
}

// ---------- peças de tela ----------
const estCampo = { width: "100%", boxSizing: "border-box", background: C.card2, color: C.texto, border: "1px solid " + C.borda, borderRadius: 12, padding: "12px 13px", fontSize: 16, fontFamily: "inherit", outline: "none" };

function Campo({ rotulo, valor, onChange, unidade, ph, grande, testid }) {
  return (
    <label style={{ display: "block", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.suave, marginBottom: 5 }}>{rotulo}</div>
      <div style={{ position: "relative" }}>
        <input type="text" inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 7))} placeholder={ph || ""} data-testid={testid}
          style={{ ...estCampo, fontSize: grande ? 30 : 16, fontWeight: grande ? 800 : 500, paddingRight: unidade ? 46 : 13, padding: grande ? "10px 46px 10px 13px" : estCampo.padding }} />
        {unidade && <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: C.suave, fontSize: grande ? 15 : 13, pointerEvents: "none" }}>{unidade}</span>}
      </div>
    </label>
  );
}
function Chips({ opcoes, valor, onChange, tr }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {opcoes.map((o) => {
        const sel = o.id === valor;
        return (
          <button key={String(o.id)} type="button" onClick={() => onChange(o.id)} style={{ padding: "8px 13px", borderRadius: 999, border: "1px solid " + (sel ? C.lime : C.borda), background: sel ? "rgba(154,205,50,0.16)" : C.card2, color: sel ? C.lime : C.texto, fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
            {o.emoji ? o.emoji + " " : ""}{tr(o.nome)}
          </button>
        );
      })}
    </div>
  );
}
function Donut({ partes, centro, sub }) {
  const r = 46, c = 2 * Math.PI * r;
  let acum = 0;
  return (
    <svg viewBox="0 0 120 120" width="124" height="124" role="img" aria-label={sub}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
      {partes.map((p) => {
        const len = Math.max(0, c * p.v - 1.5);
        const el = <circle key={p.id} cx="60" cy="60" r={r} fill="none" stroke={p.cor} strokeWidth="14" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acum * c} transform="rotate(-90 60 60)" />;
        acum += p.v;
        return el;
      })}
      <text x="60" y="60" textAnchor="middle" fontSize="21" fontWeight="800" fill="#fff">{centro}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="10" fill={C.suave}>{sub}</text>
    </svg>
  );
}
const Bolha = ({ emoji, cor }) => (
  <div style={{ width: 42, height: 42, borderRadius: 14, background: cor + "26", border: "1px solid " + cor + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{emoji}</div>
);
const Caixa = ({ children, style }) => <div style={{ background: C.card, borderRadius: 16, padding: 14, marginBottom: 12, border: "1px solid " + C.borda, ...(style || {}) }}>{children}</div>;
const Botao = ({ children, onClick, primario, disabled, testid }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={testid} style={{ flex: 1, minWidth: 0, padding: "12px 8px", borderRadius: 12, border: primario ? "none" : "1px solid " + C.borda, background: primario ? C.lime : C.card2, color: primario ? "#10150A" : C.texto, fontWeight: 800, fontSize: 13.5, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit" }}>{children}</button>
);

// ---------- card da aba Notas ----------
/**
 * Card "Calculadora Massi" (cabe na aba Notas) + a calculadora completa em tela cheia.
 * Props: cardStyle / labelStyle (estilos de card do app), i18n {tr,trt}, idioma, onSalvarNota(texto)
 */
export default function CalculadoraMassiCard({ cardStyle, labelStyle, i18n, idioma, onSalvarNota }) {
  const tr = (i18n && i18n.tr) || ((x) => x);
  const trt = (i18n && i18n.trt) || ((k, a) => (a || []).reduce((t, v, i) => t.split("{" + i + "}").join(v), k));
  const locale = idioma === "en" ? "en-US" : idioma === "es" ? "es-ES" : "pt-BR";
  const [est, setEst] = useState(estadoPadrao);
  const [pronto, setPronto] = useState(false);
  const [aberta, setAberta] = useState(false);
  const f = est.fatores[est.objetivo];
  const metas = calcularMetas(est.peso, f, est.kcalManual);
  const n = (v, c) => formatar(v, locale, c === undefined ? 2 : c);

  useEffect(() => { let vivo = true; carregarEstado().then((e) => { if (vivo) { setEst(e); setPronto(true); } }); return () => { vivo = false; }; }, []);
  useEffect(() => {
    if (!pronto) return undefined;
    const id = setTimeout(() => { try { window.storage.set(CHAVE, JSON.stringify(est)).catch(() => {}); } catch (e) { /* segue */ } }, 400);
    return () => clearTimeout(id);
  }, [est, pronto]);
  const mudar = (patch) => setEst((e) => ({ ...e, ...patch }));

  return (
    <>
      <section style={{ ...(cardStyle || {}), marginBottom: 14 }} data-testid="calc-card">
        <div style={{ ...(labelStyle || {}), color: C.texto }}>🧮 {tr("Calculadora Massi")}</div>
        <div style={{ color: C.suave, fontSize: 13, lineHeight: 1.45, margin: "2px 0 10px" }}>{tr("Digite seu peso e veja suas metas do dia: proteína, água, calorias e mais.")}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
          <Campo rotulo={tr("Seu peso")} valor={est.peso} onChange={(v) => mudar({ peso: v })} unidade="kg" ph="75" testid="calc-peso" />
        </div>
        <div style={{ marginBottom: 12 }}><Chips opcoes={OBJETIVOS} valor={est.objetivo} onChange={(id) => mudar({ objetivo: id })} tr={tr} /></div>
        {metas ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ITENS_META.map((i) => (
              <div key={i.id} style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0, boxSizing: "border-box", background: "rgba(0,0,0,0.28)", border: "1px solid " + C.borda, borderRadius: 14, padding: "10px 11px" }}>
                <div style={{ fontSize: 12.5, color: C.suave, fontWeight: 700 }}>{i.emoji} {tr(i.nome)}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2 }} data-testid={"calc-tile-" + i.id}>
                  {i.id === "kcal" && metas.kcalManual ? n(metas.kcal, 0) : n(metas.itens[i.id], i.id === "creatina" ? 2 : 1)} <span style={{ fontSize: 12, fontWeight: 600, color: C.suave }}>{i.unidade}</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.suave }}>{i.id === "kcal" && metas.kcalManual ? tr("do gasto energético") : `${n(metas.peso)} × ${n(f[i.id])}`}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: C.suave, fontSize: 13.5, padding: "6px 2px" }}>{tr("Informe o peso para calcular.")}</div>
        )}
        <button type="button" onClick={() => setAberta(true)} data-testid="calc-abrir" style={{ marginTop: 12, width: "100%", padding: "13px", borderRadius: 12, border: "none", background: C.lime, color: "#10150A", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>
          {tr("Abrir calculadora completa")} →
        </button>
      </section>
      {aberta && <CalculadoraMassiTela est={est} mudar={mudar} onFechar={() => setAberta(false)} tr={tr} trt={trt} locale={locale} onSalvarNota={onSalvarNota} />}
    </>
  );
}

// ---------- calculadora completa ----------
const ABAS = [
  { id: "metas", nome: "Metas do dia", emoji: "🎯" },
  { id: "gasto", nome: "Gasto calórico", emoji: "🔥" },
  { id: "imc", nome: "IMC", emoji: "📏" },
  { id: "rm", nome: "1RM", emoji: "🏋️" },
];

export function CalculadoraMassiTela({ est, mudar, onFechar, tr, trt, locale, onSalvarNota }) {
  const [aba, setAba] = useState("metas");
  const [aviso, setAviso] = useState("");
  const avisoRef = useRef(null);
  const mostrarAviso = (t) => { setAviso(t); if (avisoRef.current) clearTimeout(avisoRef.current); avisoRef.current = setTimeout(() => setAviso(""), 2200); };
  useEffect(() => () => { if (avisoRef.current) clearTimeout(avisoRef.current); }, []);
  const n = (v, c) => formatar(v, locale, c === undefined ? 2 : c);

  return (
    <div role="dialog" aria-label={tr("Calculadora Massi")} style={{ position: "fixed", inset: 0, zIndex: 720, background: C.fundo, color: C.texto, display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", paddingTop: "calc(36px + env(safe-area-inset-top, 0px))", borderBottom: "1px solid " + C.borda, flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>🧮 {tr("Calculadora Massi")}</div>
        <button type="button" onClick={onFechar} style={{ background: C.card2, color: C.texto, border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>✕ {tr("Fechar")}</button>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto", flexShrink: 0, borderBottom: "1px solid " + C.borda }}>
        {ABAS.map((a) => {
          const sel = a.id === aba;
          return (
            <button key={a.id} type="button" onClick={() => setAba(a.id)} data-testid={"calc-aba-" + a.id} style={{ flexShrink: 0, padding: "9px 14px", borderRadius: 12, border: "1px solid " + (sel ? C.lime : C.borda), background: sel ? "rgba(154,205,50,0.16)" : C.card2, color: sel ? C.lime : C.texto, fontWeight: 800, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
              {a.emoji} {tr(a.nome)}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 14, paddingBottom: 30 }}>
        {aba === "metas" && <AbaMetas est={est} mudar={mudar} tr={tr} trt={trt} n={n} locale={locale} onSalvarNota={onSalvarNota} mostrarAviso={mostrarAviso} />}
        {aba === "gasto" && <AbaGasto est={est} mudar={mudar} tr={tr} trt={trt} n={n} irParaMetas={() => setAba("metas")} />}
        {aba === "imc" && <AbaIMC est={est} mudar={mudar} tr={tr} trt={trt} n={n} />}
        {aba === "rm" && <AbaRM est={est} mudar={mudar} tr={tr} trt={trt} n={n} />}
        <div style={{ fontSize: 11.5, color: C.suave, lineHeight: 1.5, marginTop: 6 }}>
          {tr("Estimativas gerais para adultos saudáveis. Não substituem a avaliação de um médico ou nutricionista. Se você tem histórico de transtorno alimentar, use com acompanhamento profissional.")}
        </div>
      </div>
      {aviso && <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", background: C.lime, color: "#10150A", fontWeight: 800, borderRadius: 999, padding: "10px 18px", fontSize: 14, zIndex: 730 }}>{aviso}</div>}
    </div>
  );
}

function Alertas({ lista, tr, trt }) {
  if (!lista || !lista.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      {lista.map((a) => (
        <div key={a.id} style={{ background: a.nivel === "alto" ? "rgba(255,107,94,0.12)" : "rgba(255,199,0,0.10)", border: "1px solid " + (a.nivel === "alto" ? "rgba(255,107,94,0.45)" : "rgba(255,199,0,0.35)"), color: a.nivel === "alto" ? "#FFB1A8" : "#FFE08A", borderRadius: 12, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, marginBottom: 8 }}>
          ⚠️ {trt(a.chave, a.args)}
        </div>
      ))}
    </div>
  );
}

function AbaMetas({ est, mudar, tr, trt, n, locale, onSalvarNota, mostrarAviso }) {
  const [editando, setEditando] = useState(null);
  const f = est.fatores[est.objetivo];
  const metas = calcularMetas(est.peso, f, est.kcalManual);
  const padrao = fatoresPadrao(est.objetivo);
  const setFator = (id, v) => mudar({ fatores: { ...est.fatores, [est.objetivo]: { ...f, [id]: v } } });
  const info = (id) => ITENS_META.find((x) => x.id === id);
  const passo = (id, dir) => {
    const i = info(id);
    const novo = Math.min(i.max, Math.max(i.min, Math.round(((Number(f[id]) || 0) + dir * i.passo) * 1000) / 1000));
    setFator(id, novo);
  };
  const copiar = async () => { if (!metas) return; const ok = await copiarTexto(resumoTexto(est, metas, tr, trt, locale)); mostrarAviso(ok ? tr("Resumo copiado!") : tr("Não consegui copiar.")); };
  const compartilhar = async () => {
    if (!metas) return;
    const texto = resumoTexto(est, metas, tr, trt, locale);
    try { if (navigator.share) { await navigator.share({ text: texto }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    const ok = await copiarTexto(texto);
    mostrarAviso(ok ? tr("Resumo copiado!") : tr("Não consegui copiar."));
  };
  const salvarNota = () => { if (!metas || !onSalvarNota) return; onSalvarNota(resumoTexto(est, metas, tr, trt, locale)); mostrarAviso(tr("Salvo nas notas!")); };

  return (
    <div>
      <Caixa>
        <Campo rotulo={tr("Seu peso")} valor={est.peso} onChange={(v) => mudar({ peso: v })} unidade="kg" ph="75" grande testid="calc-peso-tela" />
        <div style={{ fontSize: 12, color: C.suave, margin: "12px 0 6px" }}>{tr("Objetivo")}</div>
        <Chips opcoes={OBJETIVOS} valor={est.objetivo} onChange={(id) => { setEditando(null); mudar({ objetivo: id }); }} tr={tr} />
      </Caixa>

      {!metas && <Caixa style={{ textAlign: "center", color: C.suave }}>{tr("Informe o peso para calcular.")}</Caixa>}

      {metas && (
        <>
          <Caixa style={{ background: "linear-gradient(150deg, #243038, #151C20)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flexShrink: 0 }}>
                <Donut centro={n(metas.kcal, 0)} sub="kcal" partes={[{ id: "p", v: metas.pct.prot, cor: COR_ITEM.prot }, { id: "c", v: metas.pct.carbo, cor: COR_ITEM.carbo }, { id: "g", v: metas.pct.gord, cor: COR_ITEM.gord }]} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {[["prot", "Proteína", metas.itens.prot, metas.pct.prot], ["carbo", "Carboidratos", metas.itens.carbo, metas.pct.carbo], ["gord", "Gorduras", metas.gordG, metas.pct.gord]].map(([id, nome, g, p]) => (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, fontSize: 13.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: COR_ITEM[id], flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{tr(nome)}</span>
                    <strong>{n(g, 0)} g</strong>
                    <span style={{ color: C.suave, width: 38, textAlign: "right" }}>{Math.round(p * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            {metas.kcalManual && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: C.suave }}>
                {tr("Calorias vindas do gasto calórico.")}{" "}
                <button type="button" onClick={() => mudar({ kcalManual: null })} style={{ background: "transparent", border: "none", color: C.lime, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12.5 }}>{tr("Voltar ao multiplicador")}</button>
              </div>
            )}
          </Caixa>

          <Alertas lista={metas.alertas} tr={tr} trt={trt} />

          {ITENS_META.map((i) => {
            const aberto = editando === i.id;
            const usaGasto = i.id === "kcal" && metas.kcalManual;
            return (
              <Caixa key={i.id} style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Bolha emoji={i.emoji} cor={COR_ITEM[i.id]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{tr(i.nome)}</div>
                    <div style={{ fontSize: 12.5, color: C.suave }}>
                      {usaGasto ? tr("do gasto calórico") : `${n(metas.peso)} kg × ${n(f[i.id])} ${i.unFator}`}
                      {i.id === "agua" && ` · ≈ ${n(metas.copos, 1)} ${tr("copos")}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }} data-testid={"calc-valor-" + i.id}>{usaGasto ? n(metas.kcal, 0) : n(metas.itens[i.id], i.id === "creatina" ? 2 : 1)}</div>
                    <div style={{ fontSize: 12, color: C.suave }}>{i.unidade}</div>
                  </div>
                  {!usaGasto && (
                    <button type="button" onClick={() => setEditando(aberto ? null : i.id)} aria-label={tr("Editar multiplicador")} data-testid={"calc-editar-" + i.id} style={{ background: aberto ? "rgba(154,205,50,0.2)" : C.card2, color: aberto ? C.lime : C.suave, border: "1px solid " + C.borda, borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>✎</button>
                  )}
                </div>
                {aberto && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.borda }}>
                    <div style={{ fontSize: 12, color: C.suave, marginBottom: 6 }}>{trt("Multiplicador ({0})", [i.unFator])}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button type="button" onClick={() => passo(i.id, -1)} aria-label="−" data-testid={"calc-menos-" + i.id} style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid " + C.borda, background: C.card2, color: C.texto, fontSize: 22, cursor: "pointer" }}>−</button>
                      <input type="text" inputMode="decimal" value={f[i.id]} onChange={(e) => { const v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""); setFator(i.id, v); }} data-testid={"calc-fator-" + i.id} style={{ ...estCampo, textAlign: "center", fontWeight: 800, fontSize: 18 }} />
                      <button type="button" onClick={() => passo(i.id, 1)} aria-label="+" data-testid={"calc-mais-" + i.id} style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid " + C.borda, background: C.card2, color: C.texto, fontSize: 22, cursor: "pointer" }}>+</button>
                    </div>
                    <div style={{ textAlign: "right", marginTop: 8 }}>
                      <button type="button" onClick={() => setFator(i.id, padrao[i.id])} style={{ background: "transparent", border: "none", color: C.lime, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{trt("Restaurar padrão ({0})", [n(padrao[i.id])])}</button>
                    </div>
                  </div>
                )}
              </Caixa>
            );
          })}

          <Caixa style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Bolha emoji="🥑" cor={COR_ITEM.gord} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{tr("Gorduras")}</div>
                <div style={{ fontSize: 12.5, color: C.suave }}>{trt("o que sobra das calorias: {0} kcal", [n(metas.kcalGord, 0)])}</div>
              </div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>≈ {n(metas.gordG, 0)}</div><div style={{ fontSize: 12, color: C.suave }}>g</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid " + C.borda }}>
              <Bolha emoji="🥦" cor={COR_ITEM.fibra} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{tr("Fibras")}</div>
                <div style={{ fontSize: 12.5, color: C.suave }}>{tr("14 g a cada 1.000 kcal")}</div>
              </div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>≈ {n(metas.fibras, 0)}</div><div style={{ fontSize: 12, color: C.suave }}>g</div></div>
            </div>
          </Caixa>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Botao onClick={copiar} testid="calc-copiar">📋 {tr("Copiar")}</Botao>
            <Botao onClick={compartilhar} testid="calc-compartilhar">📤 {tr("Compartilhar")}</Botao>
            {onSalvarNota && <Botao primario onClick={salvarNota} testid="calc-salvar-nota">📝 {tr("Salvar nas notas")}</Botao>}
          </div>
        </>
      )}
    </div>
  );
}

function AbaGasto({ est, mudar, tr, trt, n, irParaMetas }) {
  const g = calcularGasto(est.sexo, est.peso, est.altura, est.idade, est.atividade, est.ajuste);
  return (
    <div>
      <Caixa>
        <div style={{ fontSize: 12, color: C.suave, marginBottom: 6 }}>{tr("Sexo biológico")}</div>
        <Chips opcoes={[{ id: "masculino", nome: "Homem" }, { id: "feminino", nome: "Mulher" }]} valor={est.sexo} onChange={(v) => mudar({ sexo: v })} tr={tr} />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <Campo rotulo={tr("Idade")} valor={est.idade} onChange={(v) => mudar({ idade: v })} unidade={tr("anos")} ph="30" testid="calc-idade" />
          <Campo rotulo={tr("Altura")} valor={est.altura} onChange={(v) => mudar({ altura: v })} unidade="cm" ph="175" testid="calc-altura" />
          <Campo rotulo={tr("Peso")} valor={est.peso} onChange={(v) => mudar({ peso: v })} unidade="kg" ph="75" testid="calc-peso-gasto" />
        </div>
      </Caixa>
      <Caixa>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{tr("Nível de atividade")}</div>
        {ATIVIDADES.map((a) => {
          const sel = a.fator === Number(est.atividade);
          return (
            <button key={a.fator} type="button" onClick={() => mudar({ atividade: a.fator })} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid " + (sel ? C.lime : C.borda), background: sel ? "rgba(154,205,50,0.14)" : C.card2, color: C.texto, cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: sel ? C.lime : C.texto }}>{tr(a.nome)} <span style={{ color: C.suave, fontWeight: 600 }}>× {n(a.fator, 3)}</span></div>
              <div style={{ fontSize: 12.5, color: C.suave }}>{tr(a.desc)}</div>
            </button>
          );
        })}
      </Caixa>
      <Caixa>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{tr("Seu objetivo")}</div>
        <Chips opcoes={AJUSTES} valor={est.ajuste} onChange={(v) => mudar({ ajuste: v })} tr={tr} />
        <div style={{ fontSize: 12.5, color: C.suave, marginTop: 8 }}>{tr((AJUSTES.find((x) => x.id === est.ajuste) || AJUSTES[2]).nota)}</div>
      </Caixa>
      {!g ? (
        <Caixa style={{ textAlign: "center", color: C.suave }}>{tr("Preencha idade, altura e peso para calcular.")}</Caixa>
      ) : (
        <>
          <Caixa style={{ background: "linear-gradient(150deg, #243038, #151C20)" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11.5, color: C.suave }}>{tr("Basal (TMB)")}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }} data-testid="calc-tmb">{n(g.tmb, 0)}</div><div style={{ fontSize: 11, color: C.suave }}>kcal</div>
              </div>
              <div style={{ flex: 1, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11.5, color: C.suave }}>{tr("Gasto total (GET)")}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }} data-testid="calc-get">{n(g.get, 0)}</div><div style={{ fontSize: 11, color: C.suave }}>kcal</div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12.5, color: C.suave }}>{tr("Meta de calorias")}</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: C.lime, lineHeight: 1.1 }} data-testid="calc-alvo">{n(g.alvo, 0)}<span style={{ fontSize: 15, color: C.suave }}> kcal</span></div>
              {g.diff !== 0 && <div style={{ fontSize: 12.5, color: C.suave }}>{g.diff > 0 ? "+" : ""}{n(g.diff, 0)} kcal {tr("em relação ao gasto")}</div>}
            </div>
          </Caixa>
          <Alertas lista={g.alertas.map((a) => ({ ...a, nivel: "alto" }))} tr={tr} trt={trt} />
          <Botao primario testid="calc-usar-alvo" onClick={() => { mudar({ kcalManual: g.alvo }); irParaMetas(); }}>{tr("Usar como meta de calorias nas Metas")}</Botao>
          <div style={{ fontSize: 12, color: C.suave, lineHeight: 1.5, marginTop: 10 }}>{tr("Fórmula de Mifflin-St Jeor, uma das mais usadas para estimar o gasto energético em adultos.")}</div>
        </>
      )}
    </div>
  );
}

function AbaIMC({ est, mudar, tr, trt, n }) {
  const r = calcularIMC(est.peso, est.altura);
  const pos = r ? Math.max(0, Math.min(1, (r.imc - 15) / 25)) : 0;
  const cores = FAIXAS_IMC.map((f) => f.cor);
  return (
    <div>
      <Caixa>
        <div style={{ display: "flex", gap: 10 }}>
          <Campo rotulo={tr("Altura")} valor={est.altura} onChange={(v) => mudar({ altura: v })} unidade="cm" ph="175" testid="calc-altura-imc" />
          <Campo rotulo={tr("Peso")} valor={est.peso} onChange={(v) => mudar({ peso: v })} unidade="kg" ph="75" testid="calc-peso-imc" />
        </div>
      </Caixa>
      {!r ? <Caixa style={{ textAlign: "center", color: C.suave }}>{tr("Informe altura e peso para calcular.")}</Caixa> : (
        <>
          <Caixa style={{ background: "linear-gradient(150deg, #243038, #151C20)", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: C.suave }}>{tr("Seu IMC")}</div>
            <div style={{ fontSize: 52, fontWeight: 800, color: r.faixa.cor, lineHeight: 1.1 }} data-testid="calc-imc">{n(r.imc, 1)}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: r.faixa.cor }} data-testid="calc-imc-faixa">{tr(r.faixa.nome)}</div>
            <div style={{ position: "relative", margin: "18px 4px 6px" }}>
              <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden" }}>
                {[cores[0], cores[1], cores[2], cores[3], cores[4]].map((c, i) => <div key={i} style={{ flex: [3.5, 6.5, 5, 5, 5][i], background: c }} />)}
              </div>
              <div style={{ position: "absolute", top: -5, left: `calc(${(pos * 100).toFixed(1)}% - 3px)`, width: 6, height: 22, borderRadius: 3, background: "#fff", boxShadow: "0 0 0 2px #0F1417" }} />
            </div>
            <div style={{ position: "relative", height: 14, margin: "0 4px", fontSize: 10.5, color: C.suave }}>
              {[[0, "15"], [14, "18,5"], [40, "25"], [60, "30"], [80, "35"], [100, "40"]].map(([p, t]) => <span key={t} style={{ position: "absolute", left: p + "%", transform: "translateX(-50%)" }}>{t}</span>)}
            </div>
          </Caixa>
          <Caixa>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{tr("Faixa de peso saudável para sua altura")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.verde }} data-testid="calc-faixa-saudavel">{n(r.minSaudavel, 1)} – {n(r.maxSaudavel, 1)} kg</div>
            <div style={{ fontSize: 13, color: C.suave, marginTop: 6, lineHeight: 1.45 }}>
              {r.direcao === "dentro" ? tr("Você está dentro da faixa.") : r.direcao === "perder" ? trt("{0} kg acima do limite da faixa.", [n(r.paraFaixa, 1)]) : trt("{0} kg abaixo do limite da faixa.", [n(r.paraFaixa, 1)])}
            </div>
          </Caixa>
          <div style={{ fontSize: 12, color: C.suave, lineHeight: 1.5 }}>{tr("O IMC não separa músculo de gordura: pessoas musculosas podem ter IMC alto sem excesso de gordura. Use junto com medidas e % de gordura (aba Avaliação).")}</div>
        </>
      )}
    </div>
  );
}

function AbaRM({ est, mudar, tr, trt, n }) {
  const r = calcular1RM(est.rmCarga, est.rmReps);
  return (
    <div>
      <Caixa>
        <div style={{ fontSize: 13, color: C.suave, marginBottom: 10, lineHeight: 1.45 }}>{tr("Informe a maior carga que você fez e quantas repetições conseguiu. Quanto menos repetições (até 12), mais preciso.")}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Campo rotulo={tr("Carga")} valor={est.rmCarga} onChange={(v) => mudar({ rmCarga: v })} unidade="kg" ph="100" testid="calc-rm-carga" />
          <Campo rotulo={tr("Repetições")} valor={est.rmReps} onChange={(v) => mudar({ rmReps: v.replace(/[.,]/g, "") })} ph="5" testid="calc-rm-reps" />
        </div>
      </Caixa>
      {!r ? <Caixa style={{ textAlign: "center", color: C.suave }}>{tr("Informe carga e repetições (de 1 a 30).")}</Caixa> : (
        <>
          <Caixa style={{ background: "linear-gradient(150deg, #243038, #151C20)", textAlign: "center" }}>
            <div style={{ fontSize: 12.5, color: C.suave }}>{tr("Sua carga máxima estimada (1RM)")}</div>
            <div style={{ fontSize: 46, fontWeight: 800, color: C.lime, lineHeight: 1.1 }} data-testid="calc-1rm">{n(r.media, 1)}<span style={{ fontSize: 16, color: C.suave }}> kg</span></div>
            <div style={{ fontSize: 12.5, color: C.suave }}>Epley {n(r.epley, 1)} kg{r.brzycki ? ` · Brzycki ${n(r.brzycki, 1)} kg` : ""}</div>
            {!r.confiavel && <div style={{ marginTop: 8, fontSize: 12.5, color: "#FFE08A" }}>⚠️ {tr("Acima de 12 repetições a estimativa perde precisão.")}</div>}
          </Caixa>
          <Caixa>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{tr("Cargas por porcentagem")}</div>
            {r.tabela.map((t) => (
              <div key={t.pct} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid " + C.borda, fontSize: 14 }}>
                <span style={{ width: 52, fontWeight: 800, color: t.pct >= 90 ? C.vermelho : t.pct >= 75 ? C.amarelo : C.verde }}>{t.pct}%</span>
                <span style={{ flex: 1, fontWeight: 700 }}>{n(t.carga, 1)} kg</span>
                <span style={{ color: C.suave, fontSize: 13 }}>≈ {t.reps} {tr(t.reps === 1 ? "repetição" : "repetições")}</span>
              </div>
            ))}
          </Caixa>
        </>
      )}
    </div>
  );
}
