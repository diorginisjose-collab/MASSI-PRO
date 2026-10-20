import React, { useEffect, useState } from "react";
import * as P from "./passos.js";

// Passos informados pela pessoa (copiados do app de passos do celular).
// Distância e calorias são calculadas a partir desse número.
const CHAVE = "passos-registros";        // { "AAAA-MM-DD": passos }
const CHAVE_PERFIL = "passos-perfil";    // altura, sexo e peso informados aqui
const CHAVE_COMP = "passos-compartilhados";

const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const ontemISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

async function ler(chave, padrao) {
  try { const r = await window.storage.get(chave); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return padrao;
}
async function gravar(chave, valor) {
  try { await window.storage.set(chave, JSON.stringify(valor)); } catch (e) { /* segue */ }
}

// Perfil: o que foi informado aqui tem prioridade; senão, usa a Avaliação do app
async function lerPerfil() {
  const aqui = await ler(CHAVE_PERFIL, null);
  if (aqui && aqui.altura) return aqui;
  const avs = await ler("avaliacoes-evolucao", []);
  const ult = Array.isArray(avs) && avs.length ? avs[avs.length - 1] : {};
  return { altura: ult.altura, sexo: ult.sexo, peso: ult.peso };
}

function validarPerfil(f) {
  const erros = [];
  const alt = Number(String(f.altura).replace(",", "."));
  const peso = Number(String(f.peso).replace(",", "."));
  if (!(alt >= 120 && alt <= 230)) erros.push("Altura entre 120 e 230 cm.");
  if (!["masculino", "feminino", "nd"].includes(f.sexo)) erros.push("Escolha o sexo (usado para a distância).");
  if (!(peso >= 30 && peso <= 250)) erros.push("Peso entre 30 e 250 kg.");
  return { erros, valores: { altura: alt, sexo: f.sexo === "nd" ? undefined : f.sexo, peso } };
}

const campo = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: 15 };

export default function ContadorPassos({ onCompartilhar }) {
  const [registros, setRegistros] = useState({});
  const [perfil, setPerfil] = useState({});
  const [compartilhados, setCompartilhados] = useState([]);
  const [passosInformados, setPassosInformados] = useState("");
  const [editandoDados, setEditandoDados] = useState(false);
  const [form, setForm] = useState({ altura: "", sexo: "", peso: "" });
  const [erroForm, setErroForm] = useState([]);
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await ler(CHAVE, {});
      const p = await lerPerfil();
      const c = await ler(CHAVE_COMP, []);
      if (vivo) { setRegistros(r); setPerfil(p); setCompartilhados(Array.isArray(c) ? c : []); }
    })();
    return () => { vivo = false; };
  }, []);

  const hoje = hojeISO();
  const totalHoje = registros[hoje] || 0;
  const resumo = P.resumoDia(hoje, totalHoje, perfil);
  const perfilCompleto = !!(perfil.altura && perfil.sexo && perfil.peso);
  const ontem = ontemISO();
  const temOntem = (registros[ontem] || 0) > 0 && compartilhados.indexOf(ontem) < 0;

  // Salva os passos informados para hoje
  const salvarPassos = async () => {
    const n = Number(String(passosInformados).replace(/\./g, "").replace(",", "."));
    if (!(Number.isInteger(n) && n >= 0 && n <= 100000)) { setAviso("Digite um número de passos entre 0 e 100.000."); return; }
    const novo = { ...registros, [hoje]: n };
    setRegistros(novo); await gravar(CHAVE, novo);
    setPassosInformados(""); setAviso("");
  };

  const reiniciarHoje = async () => {
    const novo = { ...registros, [hoje]: 0 };
    setRegistros(novo); await gravar(CHAVE, novo);
    setConfirmandoReinicio(false);
  };

  // Encerra o dia: marca como compartilhado e abre o resumo para enviar
  const encerrarDia = async () => {
    if (onCompartilhar) onCompartilhar(P.resumoDia(hoje, totalHoje, perfil));
    const novo = compartilhados.indexOf(hoje) < 0 ? compartilhados.concat([hoje]) : compartilhados;
    setCompartilhados(novo); await gravar(CHAVE_COMP, novo);
  };

  const abrirDados = () => {
    setForm({ altura: perfil.altura || "", sexo: perfil.sexo || "", peso: perfil.peso || "" });
    setErroForm([]); setEditandoDados(true);
  };
  const salvarDados = async () => {
    const { erros, valores } = validarPerfil(form);
    setErroForm(erros);
    if (erros.length) return;
    const novo = { altura: valores.altura, sexo: valores.sexo || "nd", peso: valores.peso };
    setPerfil(novo); await gravar(CHAVE_PERFIL, novo);
    setEditandoDados(false);
  };

  return (
    <section style={{ background: "rgba(128,128,128,0.12)", borderRadius: 14, padding: 14, marginBottom: 14 }} data-testid="contador-passos">
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>👟 Passos do dia</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", marginBottom: 10 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }} data-testid="total-passos">{totalHoje.toLocaleString("pt-BR")}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>passos hoje</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }} data-testid="total-km">{resumo.km === null ? "—" : String(resumo.km).replace(".", ",")}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>km</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }} data-testid="total-kcal">{resumo.kcal === null ? "—" : Math.round(resumo.kcal)}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>kcal (estimado)</div></div>
      </div>

      <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Quantos passos você deu hoje? (copie do app de passos do celular)
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <input type="text" inputMode="numeric" value={passosInformados} onChange={(e) => setPassosInformados(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))} placeholder="ex.: 8432" aria-label="Passos de hoje" style={{ ...campo, marginTop: 0, flex: 1 }} data-testid="input-passos" />
          <button type="button" onClick={salvarPassos} data-testid="salvar-passos" style={{ border: "none", borderRadius: 8, padding: "0 16px", background: "#A7FF00", color: "#15181B", fontWeight: 800, cursor: "pointer" }}>Salvar</button>
        </div>
      </label>
      {aviso && <div role="alert" style={{ fontSize: 12.5, color: "#FFB1A8", marginBottom: 6 }}>{aviso}</div>}

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45, marginBottom: 8 }}>
        {!perfilCompleto
          ? "Para calcular distância e calorias, informe altura, sexo e peso."
          : "Distância e calorias são estimativas, calculadas a partir dos passos informados."}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        {!perfilCompleto && !editandoDados && (
          <button type="button" onClick={abrirDados} data-testid="informar-dados-passos" style={{ flex: 1, border: "none", borderRadius: 10, padding: "10px", background: "#A7FF00", color: "#15181B", cursor: "pointer", fontWeight: 800 }}>Informar altura, sexo e peso</button>
        )}
        {perfilCompleto && !editandoDados && (
          <button type="button" onClick={abrirDados} data-testid="editar-dados-passos" style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0 }}>Editar altura, sexo e peso</button>
        )}
        {totalHoje > 0 && !confirmandoReinicio && (
          <button type="button" onClick={() => setConfirmandoReinicio(true)} data-testid="reiniciar-passos" style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0, marginLeft: "auto" }}>↺ Reiniciar hoje</button>
        )}
      </div>

      {confirmandoReinicio && (
        <div role="alertdialog" aria-label="Confirmar reinício" style={{ background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: 10, marginBottom: 10, fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>Zerar os passos de hoje?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={reiniciarHoje} data-testid="confirmar-reiniciar" style={{ flex: 1, border: "none", borderRadius: 8, padding: 9, background: "#C53030", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Zerar</button>
            <button type="button" onClick={() => setConfirmandoReinicio(false)} style={{ flex: 1, border: "1px solid rgba(128,128,128,0.4)", borderRadius: 8, padding: 9, background: "transparent", color: "inherit", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {editandoDados && (
        <div style={{ marginTop: 6, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 12 }} data-testid="form-dados-passos">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Seus dados</div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Altura (cm)
            <input type="text" inputMode="numeric" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value.replace(/[^0-9.,]/g, "").slice(0, 5) })} aria-label="Altura em cm" style={campo} />
          </label>
          <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Peso (kg)
            <input type="text" inputMode="decimal" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6) })} aria-label="Peso em kg" style={campo} />
          </label>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Sexo (para a distância)</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["masculino", "Masculino"], ["feminino", "Feminino"], ["nd", "Prefiro não informar"]].map(([v, rot]) => (
              <button key={v} type="button" aria-pressed={form.sexo === v} onClick={() => setForm({ ...form, sexo: v })} style={{ flex: 1, borderRadius: 999, padding: "7px 6px", fontSize: 12, cursor: "pointer", border: "1px solid " + (form.sexo === v ? "#A7FF00" : "rgba(128,128,128,0.4)"), background: form.sexo === v ? "#A7FF00" : "transparent", color: form.sexo === v ? "#15181B" : "inherit", fontWeight: form.sexo === v ? 800 : 500 }}>{rot}</button>
            ))}
          </div>
          {erroForm.map((er, i) => <div key={i} role="alert" style={{ fontSize: 12.5, color: "#FFB1A8", marginBottom: 4 }}>{er}</div>)}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={salvarDados} data-testid="salvar-dados-passos" style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, background: "#A7FF00", color: "#15181B", fontWeight: 800, cursor: "pointer" }}>Salvar</button>
            <button type="button" onClick={() => setEditandoDados(false)} style={{ flex: 1, border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10, padding: 10, background: "transparent", color: "inherit", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {temOntem && !editandoDados && (
        <button type="button" onClick={() => { if (onCompartilhar) onCompartilhar(P.resumoDia(ontem, registros[ontem], perfil)); const n = compartilhados.concat([ontem]); setCompartilhados(n); gravar(CHAVE_COMP, n); }} style={{ marginTop: 10, width: "100%", border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10, padding: "9px", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>
          Compartilhar o resumo de ontem
        </button>
      )}
      {totalHoje > 0 && (
        <button type="button" onClick={encerrarDia} style={{ marginTop: 8, width: "100%", border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10, padding: "9px", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>
          Compartilhar resumo de hoje
        </button>
      )}
    </section>
  );
}

// Abre o WhatsApp com o resumo (ou usa o compartilhamento do celular)
export function compartilharResumo(resumo) {
  const texto = P.textoResumo(resumo);
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ text: texto }).catch(() => window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener,noreferrer"));
  } else {
    window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener,noreferrer");
  }
}
