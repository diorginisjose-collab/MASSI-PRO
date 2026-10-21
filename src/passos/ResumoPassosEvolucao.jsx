import React, { useEffect, useState } from "react";

// Resumo de passos, calorias da caminhada e TMB na aba Evolução (dados já salvos no histórico do aparelho).
const CHAVE_HIST = "passos-historico";

async function lerHistorico() {
  try { const r = await window.storage.get(CHAVE_HIST); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return {};
}

const dataBR = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : iso);
const numBR = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("pt-BR"));

export default function ResumoPassosEvolucao() {
  const [hist, setHist] = useState({});
  useEffect(() => {
    let vivo = true;
    (async () => { const h = await lerHistorico(); if (vivo) setHist(h); })();
    return () => { vivo = false; };
  }, []);

  const dias = Object.keys(hist).sort((a, b) => (a < b ? 1 : -1));
  const ultimos7 = dias.slice(0, 7).map((d) => hist[d]);
  const media = (lista, campo) => {
    const v = lista.map((x) => x[campo]).filter((x) => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const tmbAtual = dias.length ? hist[dias[0]].tmb : null;
  const card = { background: "rgba(128,128,128,0.12)", borderRadius: 14, padding: 14, marginBottom: 14 };

  return (
    <section style={card} data-testid="resumo-passos-evolucao">
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>👟 Passos e metabolismo</div>
      {dias.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.85 }}>Nenhum dia registrado ainda. Informe seus passos na tela Início para ver os indicadores aqui.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", marginBottom: 12 }}>
            <div><div style={{ fontSize: 18, fontWeight: 800 }} data-testid="indicador-tmb">{numBR(tmbAtual)}</div><div style={{ fontSize: 11, opacity: 0.75 }}>TMB (kcal/dia)</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800 }} data-testid="indicador-media-passos">{numBR(media(ultimos7, "passos"))}</div><div style={{ fontSize: 11, opacity: 0.75 }}>passos/dia (7 dias)</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{numBR(media(ultimos7, "kcal"))}</div><div style={{ fontSize: 11, opacity: 0.75 }}>kcal caminhada/dia</div></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }} data-testid="tabela-passos">
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(128,128,128,0.4)" }}>
                  <th style={{ padding: "6px 4px" }}>Data</th>
                  <th style={{ padding: "6px 4px" }}>Passos</th>
                  <th style={{ padding: "6px 4px" }}>km</th>
                  <th style={{ padding: "6px 4px" }}>kcal</th>
                  <th style={{ padding: "6px 4px" }}>TMB</th>
                </tr>
              </thead>
              <tbody>
                {dias.slice(0, 14).map((d) => (
                  <tr key={d} style={{ borderBottom: "1px solid rgba(128,128,128,0.2)" }}>
                    <td style={{ padding: "6px 4px" }}>{dataBR(d)}</td>
                    <td style={{ padding: "6px 4px" }}>{numBR(hist[d].passos)}</td>
                    <td style={{ padding: "6px 4px" }}>{hist[d].km === null || hist[d].km === undefined ? "—" : String(hist[d].km).replace(".", ",")}</td>
                    <td style={{ padding: "6px 4px" }}>{numBR(hist[d].kcal)}</td>
                    <td style={{ padding: "6px 4px" }}>{numBR(hist[d].tmb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 8, lineHeight: 1.4 }}>
            Passos vêm do que você informou. Calorias da caminhada e TMB são estimativas.
          </div>
        </>
      )}
    </section>
  );
}
