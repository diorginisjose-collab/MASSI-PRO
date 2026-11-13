import React, { useEffect, useState } from "react";
import { evolucao360, projecao, hojeISO, fmt, diasEntre, somarDias } from "./evolucao360.js";

// Painel "Evolução 360" da aba Progresso. Lê o que o app já guarda (nada é pedido de novo) e faz TODAS as contas
// no aparelho: não chama a IA e não gasta crédito. Tudo são estimativas, não diagnóstico nem promessa de resultado.

const LIME = "#C6FF4D", AZUL = "#4DB6FF", AMBAR = "#FFC24D", VERM = "#FF6B5E", TEXTO = "#F2F4F6", SUAVE = "#9AA3AE";
const cartao = { background: "rgba(20,23,28,0.94)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" };

async function ler(chave, padrao) {
  try { const r = await window.storage.get(chave); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return padrao;
}
export async function carregarDadosEvolucao() {
  const [historico, avaliacoes, passos, checkins, perfilRI, rotinaSalva, onboarding] = await Promise.all([
    ler("historico-treinos", []), ler("avaliacoes-evolucao", []), ler("passos-registros", {}), ler("ri-checkins", []),
    ler("ri-perfil", null), ler("rotina-treino", null), ler("onboarding-perfil", null),
  ]);
  const dias = rotinaSalva && Array.isArray(rotinaSalva.diasSelecionados) ? rotinaSalva.diasSelecionados : [];
  const metaSemana = dias.length || 3;
  const ult = Array.isArray(avaliacoes) && avaliacoes.length ? avaliacoes[avaliacoes.length - 1] : null;
  let objetivo = (perfilRI && perfilRI.objetivo) || (ult && ult.objetivo) || (onboarding && onboarding.objetivo) || "";
  if (objetivo && typeof objetivo === "object") objetivo = objetivo.nome || objetivo.id || "";
  return { historico, avaliacoes, passos, checkins, perfilRI, metaSemana, objetivo: String(objetivo) };
}

function Anel({ pct, cor, centro, titulo, sub }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0)), R = 26, C = 2 * Math.PI * R;
  return (
    <div style={{ textAlign: "center", minWidth: 0 }}>
      <svg width="76" height="76" viewBox="0 0 72 72" role="img" aria-label={titulo + ": " + centro}>
        <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="7" />
        <circle cx="36" cy="36" r={R} fill="none" stroke={cor} strokeWidth="7" strokeLinecap="round" strokeDasharray={(C * p) / 100 + " " + C} transform="rotate(-90 36 36)" style={{ transition: "stroke-dasharray .8s ease" }} />
        <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="800" fill={TEXTO}>{centro}</text>
      </svg>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: TEXTO, marginTop: -2 }}>{titulo}</div>
      <div style={{ fontSize: 10.5, color: SUAVE, lineHeight: 1.25 }}>{sub}</div>
    </div>
  );
}

function Lista({ itens, icone, cor }) {
  if (!itens || !itens.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {itens.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, lineHeight: 1.4, marginBottom: 5, color: TEXTO }}>
          <span style={{ color: cor, flexShrink: 0 }}>{icone}</span><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t}</span>
        </div>
      ))}
    </div>
  );
}

function GraficoProjecao({ proj, hoje }) {
  const W = 300, H = 130, PX = 10, PY = 14;
  const reais = proj.serie.map((s) => ({ x: diasEntre(hoje, s.data), y: s.v }));
  const fut = proj.cenarios.map((c) => ({ x: c.dias, y: c.estimado, min: c.min, max: c.max }));
  const ys = reais.map((p) => p.y).concat(fut.map((p) => p.y), fut.map((p) => p.min), fut.map((p) => p.max));
  const yMin = Math.min(...ys) - 0.5, yMax = Math.max(...ys) + 0.5;
  const xMin = Math.min(-90, ...reais.map((p) => p.x)), xMax = 90;
  const sx = (x) => PX + ((x - xMin) / (xMax - xMin)) * (W - 2 * PX);
  const sy = (y) => H - PY - ((y - yMin) / (yMax - yMin || 1)) * (H - 2 * PY);
  const real = reais.map((p) => sx(p.x) + "," + sy(p.y)).join(" ");
  const ultimo = reais[reais.length - 1];
  const proje = [ultimo].concat(fut).map((p) => sx(p.x) + "," + sy(p.y)).join(" ");
  const banda = fut.map((p) => sx(p.x) + "," + sy(p.max)).concat(fut.slice().reverse().map((p) => sx(p.x) + "," + sy(p.min))).join(" ");
  return (
    <svg viewBox={"0 0 " + W + " " + H} width="100%" role="img" aria-label="Gráfico do peso registrado e da projeção para 30, 60 e 90 dias" style={{ marginTop: 8 }}>
      <line x1={sx(0)} y1={PY - 6} x2={sx(0)} y2={H - PY + 4} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
      <polygon points={banda} fill="rgba(77,182,255,0.16)" />
      <polyline fill="none" stroke={AZUL} strokeWidth="2" strokeDasharray="5 4" points={proje} />
      <polyline fill="none" stroke={LIME} strokeWidth="2.5" points={real} />
      {reais.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={LIME} />)}
      {fut.map((p, i) => <circle key={"f" + i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={AZUL} />)}
      <text x={sx(0)} y={H - 1} fontSize="8.5" fill={SUAVE} textAnchor="middle">hoje</text>
      {fut.map((p, i) => <text key={"t" + i} x={sx(p.x)} y={H - 1} fontSize="8.5" fill={SUAVE} textAnchor="middle">{p.x}d</text>)}
    </svg>
  );
}

const NIVEL_REC = {
  favoravel: { cor: LIME, titulo: "Recuperação favorável", texto: "Pelos dados informados, seu corpo parece estar se recuperando bem. Mantenha o sono e a progressão." },
  atencao: { cor: AMBAR, titulo: "Atenção à intensidade", texto: "Alguns sinais pedem cuidado. Evite aumentar muito a carga nos próximos treinos e capriche no descanso." },
  priorizar: { cor: VERM, titulo: "Priorizar recuperação", texto: "Há vários sinais de cansaço acumulado. Considere reduzir o volume por alguns dias e dormir melhor." },
};

export default function Evolucao360({ tr, dados: dadosProp, hoje: hojeProp }) {
  const t = tr || ((x) => x);
  const hoje = hojeProp || hojeISO();
  const [dados, setDados] = useState(dadosProp || null);
  const [aberto, setAberto] = useState({ detalhes: false, recuperacao: false, simulador: false });
  useEffect(() => {
    if (dadosProp) return undefined;
    let vivo = true;
    carregarDadosEvolucao().then((d) => { if (vivo) setDados(d); }).catch(() => { if (vivo) setDados({}); });
    return () => { vivo = false; };
  }, [dadosProp]);
  const alterna = (k) => setAberto((a) => ({ ...a, [k]: !a[k] }));

  if (!dados) return <section style={cartao} data-testid="evolucao-360"><div style={{ fontSize: 13, color: SUAVE }}>{t("Carregando sua evolução…")}</div></section>;
  const r = evolucao360(dados, hoje);
  const proj = projecao(dados.avaliacoes, dados.objetivo, hoje);
  const tr_ = r.treinos, rec = r.recuperacao;
  const pctTreino = Math.round((tr_.mediaSemana / r.meta) * 100);
  const corTreino = pctTreino >= 85 ? LIME : pctTreino >= 50 ? AMBAR : VERM;
  const pesoOk = r.peso && r.peso.confiavel;
  const pesoDir = pesoOk ? (r.tipoObjetivo === "perder" ? (r.peso.delta30 < -0.2 ? 100 : r.peso.delta30 > 0.2 ? 20 : 60) : r.tipoObjetivo === "ganhar" ? (r.peso.delta30 > 0.2 ? 100 : r.peso.delta30 < -0.2 ? 20 : 60) : (Math.abs(r.peso.delta30) <= 0.5 ? 100 : 50)) : 0;
  const pctPassos = r.passos.media7 ? Math.min(100, Math.round((r.passos.media7 / 8000) * 100)) : 0;
  const rc = rec.nivel ? NIVEL_REC[rec.nivel] : null;

  return (
    <section style={cartao} data-testid="evolucao-360">
      <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 2 }}>🧭 {t("Evolução 360")}</div>
      <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 12 }}>{t("Tudo calculado no seu aparelho, com os dados que você já registrou.")}</div>

      {!r.temDados ? (
        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{t("Conclua alguns treinos e registre seu peso em Peso e medidas. Assim que houver dados, esta tela mostra sua evolução, pontos fortes e o que melhorar.")}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            <Anel pct={pctTreino} cor={corTreino} centro={fmt(tr_.mediaSemana) } titulo={t("Treinos")} sub={t("por semana") + " · " + t("meta") + " " + r.meta} />
            <Anel pct={pesoDir} cor={pesoOk ? (pesoDir >= 60 ? LIME : AMBAR) : SUAVE} centro={r.peso ? fmt(r.peso.ultimo) : "—"} titulo={t("Peso")} sub={pesoOk ? (r.peso.delta30 > 0 ? "+" : "") + fmt(r.peso.delta30) + " kg/30d" : t("kg")} />
            <Anel pct={pctPassos} cor={AZUL} centro={r.passos.media7 ? Math.round(r.passos.media7 / 100) / 10 + "k" : "—"} titulo={t("Passos")} sub={t("média 7 dias")} />
            <Anel pct={rec.pontos === null ? 0 : rec.pontos} cor={rc ? rc.cor : SUAVE} centro={rec.pontos === null ? "—" : rec.pontos} titulo={t("Recup.")} sub={rc ? t(rc.titulo) : t("sem dados")} />
          </div>

          <button type="button" onClick={() => alterna("detalhes")} aria-expanded={aberto.detalhes} data-testid="evolucao-360-detalhes" style={{ width: "100%", marginTop: 12, background: "transparent", color: LIME, border: "1px solid rgba(198,255,77,0.45)", borderRadius: 12, padding: "9px 12px", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
            {aberto.detalhes ? "▾ " : "▸ "}{t("Pontos fortes, o que melhorar e sugestões")}
          </button>
          {aberto.detalhes && (
            <div style={{ marginTop: 6 }}>
              {r.positivos.length > 0 && <><div style={{ fontWeight: 800, fontSize: 13, color: LIME, marginTop: 8 }}>✅ {t("Pontos positivos")}</div><Lista itens={r.positivos} icone="•" cor={LIME} /></>}
              {r.melhorar.length > 0 && <><div style={{ fontWeight: 800, fontSize: 13, color: AMBAR, marginTop: 10 }}>⚠️ {t("Pontos a melhorar")}</div><Lista itens={r.melhorar} icone="•" cor={AMBAR} /></>}
              {r.sugestoes.length > 0 && <><div style={{ fontWeight: 800, fontSize: 13, color: AZUL, marginTop: 10 }}>💡 {t("Sugestões")}</div><Lista itens={r.sugestoes} icone="•" cor={AZUL} /></>}
              {r.positivos.length === 0 && r.melhorar.length === 0 && <div style={{ fontSize: 13, color: SUAVE, marginTop: 8 }}>{t("Ainda há poucos dados para comparar. Continue registrando.")}</div>}
              {r.medidas.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: SUAVE }}>📏 {r.medidas.map((m) => m.nome + " " + (m.delta > 0 ? "+" : "") + fmt(m.delta) + " cm").join(" · ")}</div>
              )}
            </div>
          )}
        </>
      )}

      <button type="button" onClick={() => alterna("recuperacao")} aria-expanded={aberto.recuperacao} data-testid="evolucao-360-recuperacao" style={{ width: "100%", marginTop: 10, background: "rgba(255,255,255,0.04)", color: TEXTO, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", textAlign: "left" }}>
        🔋 {t("Recuperação muscular")} <span style={{ float: "right", color: SUAVE }}>{aberto.recuperacao ? "▾" : "▸"}</span>
      </button>
      {aberto.recuperacao && (
        <div style={{ padding: "10px 4px 2px" }}>
          {rc ? (
            <>
              <div style={{ fontWeight: 900, fontSize: 15, color: rc.cor }}>{t(rc.titulo)}</div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.09)", overflow: "hidden", margin: "8px 0" }}><div style={{ width: rec.pontos + "%", height: "100%", background: rc.cor, transition: "width .8s" }} /></div>
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>{t(rc.texto)}</div>
              {rec.motivos.length > 0 && <div style={{ fontSize: 12.5, color: SUAVE, marginTop: 6 }}>{t("O que pesou:")} {rec.motivos.join(", ")}.</div>}
            </>
          ) : <div style={{ fontSize: 13, lineHeight: 1.45 }}>{rec.dica}</div>}
          <div style={{ fontSize: 11, color: SUAVE, marginTop: 8, lineHeight: 1.4 }}>{t("Orientação feita com o que você informou (sono, cansaço, dores, treinos recentes). Não é diagnóstico nem medição fisiológica.")}</div>
        </div>
      )}

      <button type="button" onClick={() => alterna("simulador")} aria-expanded={aberto.simulador} data-testid="evolucao-360-simulador" style={{ width: "100%", marginTop: 8, background: "rgba(255,255,255,0.04)", color: TEXTO, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px", fontWeight: 800, fontSize: 13.5, cursor: "pointer", textAlign: "left" }}>
        🔮 {t("Simulador de evolução (30, 60 e 90 dias)")} <span style={{ float: "right", color: SUAVE }}>{aberto.simulador ? "▾" : "▸"}</span>
      </button>
      {aberto.simulador && (
        <div style={{ padding: "10px 4px 2px" }}>
          {!proj.ok ? <div style={{ fontSize: 13, lineHeight: 1.45 }}>{t(proj.motivo)}</div> : (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>
                {t("Seu peso hoje:")} <strong>{fmt(proj.ultimo)} kg</strong> · {t("ritmo estimado:")} <strong>{proj.kgPorSemana > 0 ? "+" : ""}{fmt(proj.kgPorSemana, 2)} kg/{t("semana")}</strong>
              </div>
              <GraficoProjecao proj={proj} hoje={hoje} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
                {proj.cenarios.map((c) => (
                  <div key={c.dias} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: SUAVE }}>{c.dias} {t("dias")}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: AZUL }}>{fmt(c.estimado)} kg</div>
                    <div style={{ fontSize: 10.5, color: SUAVE }}>{fmt(c.min)} – {fmt(c.max)}</div>
                  </div>
                ))}
              </div>
              {proj.nota && <div style={{ fontSize: 12.5, color: AMBAR, marginTop: 8, lineHeight: 1.4 }}>{t(proj.nota)}</div>}
              <div style={{ fontSize: 11, color: SUAVE, marginTop: 8, lineHeight: 1.4 }}>
                {t("Confiança da estimativa:")} {t(proj.confianca)}. {t("É uma projeção feita com o seu ritmo recente. Peso muda com alimentação, água e sono, e nada garante resultado. Não substitui avaliação profissional.")}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
