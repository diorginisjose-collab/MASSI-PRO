import React, { useEffect, useState } from "react";
import { carregarDiario, removerEntrada, totalDoDia, somarItens, dataLocal } from "./diarioStorage.js";
import { COR, tela, cabecalho, botaoFechar, botaoPrimario, cartao } from "./tema.js";

function somaDias(dataStr, n) {
  const d = new Date(dataStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dataLocal(d);
}

/** Diário alimentar: refeições salvas por dia, com totais. Props: onFechar, i18n {tr,trt}, idioma, onNovaFoto */
export default function DiarioAlimentar({ onFechar, i18n, idioma, onNovaFoto }) {
  const tr = (i18n && i18n.tr) || ((x) => x);
  const trt = (i18n && i18n.trt) || ((k, a) => (a || []).reduce((t, v, i) => t.split("{" + i + "}").join(v), k));
  const hoje = dataLocal();
  const [lista, setLista] = useState([]);
  const [dia, setDia] = useState(hoje);
  const [apagar, setApagar] = useState(null);
  useEffect(() => { let vivo = true; carregarDiario().then((l) => { if (vivo) setLista(l); }); return () => { vivo = false; }; }, []);

  const locale = idioma === "en" ? "en-US" : idioma === "es" ? "es-ES" : "pt-BR";
  const rotuloDia = (d) => (d === hoje ? tr("Hoje") : d === somaDias(hoje, -1) ? tr("Ontem") : new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" }));
  const doDia = lista.filter((e) => e.data === dia).sort((a, b) => (a.hora < b.hora ? -1 : 1));
  const total = totalDoDia(lista, dia);
  const ultimos = [6, 5, 4, 3, 2, 1, 0].map((n) => { const d = somaDias(hoje, -n); return { d, kcal: totalDoDia(lista, d).calorias }; });
  const maxKcal = Math.max(1, ...ultimos.map((x) => x.kcal));

  const confirmarApagar = async (id) => { setLista(await removerEntrada(id)); setApagar(null); };

  return (
    <div style={tela} role="dialog" aria-label={tr("Diário alimentar")}>
      <div style={cabecalho}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>🍽️ {tr("Diário alimentar")}</div>
        <button style={botaoFechar} onClick={onFechar}>✕ {tr("Fechar")}</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => setDia(somaDias(dia, -1))} aria-label={tr("Dia anterior")} style={{ ...botaoFechar, padding: "8px 16px" }}>◀</button>
          <div style={{ fontWeight: 800, fontSize: 16, textTransform: "capitalize" }}>{rotuloDia(dia)}</div>
          <button onClick={() => setDia(somaDias(dia, 1))} disabled={dia >= hoje} aria-label={tr("Próximo dia")} style={{ ...botaoFechar, padding: "8px 16px", opacity: dia >= hoje ? 0.35 : 1 }}>▶</button>
        </div>

        <div style={{ ...cartao, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: COR.suave, letterSpacing: 1 }}>{tr("TOTAL DO DIA")}</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: COR.lime, lineHeight: 1.1 }} data-testid="diario-kcal">{total.calorias}<span style={{ fontSize: 15, color: COR.suave }}> kcal</span></div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {[["Proteínas", total.proteinas_g, COR.azul], ["Carboidratos", total.carboidratos_g, COR.amarelo], ["Gorduras", total.gorduras_g, COR.vermelho]].map(([r, v, c]) => (
              <div key={r} style={{ flex: 1, minWidth: 0, background: COR.card2, borderRadius: 10, padding: "8px 4px" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}<span style={{ fontSize: 11 }}> g</span></div>
                <div style={{ fontSize: 11.5, color: COR.suave }}>{tr(r)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cartao }}>
          <div style={{ fontSize: 12.5, color: COR.suave, marginBottom: 8 }}>{tr("Últimos 7 dias (kcal)")}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
            {ultimos.map((x) => (
              <button key={x.d} onClick={() => setDia(x.d)} aria-label={x.d + " " + x.kcal + " kcal"} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", alignItems: "flex-end", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                <div style={{ width: "100%", height: Math.max(3, Math.round((x.kcal / maxKcal) * 60)) + "px", background: x.d === dia ? COR.lime : "rgba(154,205,50,0.35)", borderRadius: 4 }} />
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {ultimos.map((x) => <div key={x.d} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: x.d === dia ? COR.lime : COR.suave }}>{x.d.slice(8)}</div>)}
          </div>
        </div>

        {doDia.length === 0 && (
          <div style={{ ...cartao, textAlign: "center", color: COR.suave, lineHeight: 1.5 }}>
            {tr("Nenhuma refeição registrada neste dia.")}
            <div style={{ marginTop: 12 }}><button style={botaoPrimario} onClick={onNovaFoto}>📷 {tr("Analisar uma refeição")}</button></div>
          </div>
        )}

        {doDia.map((e) => {
          const t = somarItens(e.itens);
          return (
            <div key={e.id} style={{ ...cartao, padding: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                {e.miniatura && <img src={e.miniatura} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 800 }}>{tr(e.refeicao || "Refeição")} <span style={{ color: COR.suave, fontWeight: 600, fontSize: 12.5 }}>{e.hora}</span></div>
                    <div style={{ fontWeight: 800, color: COR.lime, flexShrink: 0 }}>{t.calorias} kcal</div>
                  </div>
                  <div style={{ fontSize: 13, color: COR.suave, lineHeight: 1.4, marginTop: 2 }}>{(e.itens || []).map((i) => i.nome + " (" + i.porcao_g + " g)").join(", ")}</div>
                  <div style={{ fontSize: 12.5, color: COR.suave, marginTop: 4 }}>P {t.proteinas_g} g · C {t.carboidratos_g} g · G {t.gorduras_g} g</div>
                </div>
              </div>
              <div style={{ textAlign: "right", marginTop: 6 }}>
                {apagar === e.id ? (
                  <span style={{ fontSize: 13 }}>
                    {tr("Apagar esta refeição?")}{" "}
                    <button onClick={() => confirmarApagar(e.id)} style={{ background: COR.vermelho, color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 700, cursor: "pointer" }}>{tr("Apagar")}</button>{" "}
                    <button onClick={() => setApagar(null)} style={{ background: COR.card2, color: COR.texto, border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 700, cursor: "pointer" }}>{tr("Cancelar")}</button>
                  </span>
                ) : (
                  <button onClick={() => setApagar(e.id)} style={{ background: "transparent", border: "none", color: COR.suave, fontSize: 13, cursor: "pointer" }}>🗑️ {tr("Apagar")}</button>
                )}
              </div>
            </div>
          );
        })}
        {doDia.length > 0 && <button style={{ ...botaoPrimario, marginTop: 4 }} onClick={onNovaFoto}>📷 {tr("Analisar outra refeição")}</button>}
      </div>
    </div>
  );
}
