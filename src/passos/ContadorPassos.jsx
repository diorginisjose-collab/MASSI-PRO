import React, { useEffect, useRef, useState } from "react";
import * as P from "./passos.js";

const CHAVE = "passos-registros"; // { "AAAA-MM-DD": passos }
const CHAVE_ATIVO = "passos-ativo";
const CHAVE_COMP = "passos-compartilhados"; // lista de dias já compartilhados
const CHAVE_PERFIL = "passos-perfil";       // altura, sexo e peso informados aqui
const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const ontemISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

async function ler(chave, padrao) {
  try { const r = await window.storage.get(chave); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return padrao;
}
async function gravar(chave, valor) {
  try { await window.storage.set(chave, JSON.stringify(valor)); } catch (e) { /* segue */ }
}

// Perfil para o cálculo: o que foi informado aqui tem prioridade; senão, usa a Avaliação do app
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

export default function ContadorPassos({ onCompartilhar }) {
  const [ativo, setAtivo] = useState(false);
  const [registros, setRegistros] = useState({});
  const [perfil, setPerfil] = useState({});
  const [sessao, setSessao] = useState(0);        // passos contados nesta sessão aberta
  const [aviso, setAviso] = useState("");
  const [compartilhados, setCompartilhados] = useState([]);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ altura: "", sexo: "", peso: "" });
  const [erroForm, setErroForm] = useState([]);
  const amostras = useRef([]);
  const sessaoRef = useRef(0);
  const baseRef = useRef(0);       // passos do dia que já estavam salvos ao ativar
  const registrosRef = useRef({});
  useEffect(() => { registrosRef.current = registros; }, [registros]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await ler(CHAVE, {});
      const a = await ler(CHAVE_ATIVO, false);
      const p = await lerPerfil();
      const c = await ler(CHAVE_COMP, []);
      if (vivo) { setRegistros(r); setAtivo(!!a); setPerfil(p); setCompartilhados(Array.isArray(c) ? c : []); }
    })();
    return () => { vivo = false; };
  }, []);

  // Acelerômetro com o app aberto (estimativa). Em segundo plano, é preciso o código nativo.
  useEffect(() => {
    if (!ativo) return undefined;
    const aoMover = (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g) return;
      amostras.current.push({ t: Date.now(), x: g.x || 0, y: g.y || 0, z: g.z || 0 });
      if (amostras.current.length > 200) amostras.current = amostras.current.slice(-200);
      const novos = P.contarPassosAmostras(amostras.current);
      if (novos > sessaoRef.current) { sessaoRef.current = novos; setSessao(novos); }
    };
    window.addEventListener("devicemotion", aoMover);
    return () => window.removeEventListener("devicemotion", aoMover);
  }, [ativo]);

  // Salva o total do dia sempre que a contagem muda (não se perde se o app fechar)
  useEffect(() => {
    if (!ativo) return;
    const dia = hojeISO();
    const novo = { ...registrosRef.current, [dia]: baseRef.current + sessao };
    registrosRef.current = novo;
    setRegistros(novo);
    gravar(CHAVE, novo);
  }, [sessao, ativo]);

  // O total do dia já inclui a sessão atual (é salvo continuamente), então não soma de novo
  const totalHoje = registros[hojeISO()] || 0;
  const resumo = P.resumoDia(hojeISO(), totalHoje, perfil);

  const ativar = async () => {
    try {
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        const r = await DeviceMotionEvent.requestPermission();
        if (r !== "granted") { setAviso("Permita o acesso ao movimento para contar os passos."); return; }
      }
    } catch (e) { setAviso("Não foi possível acessar o sensor deste aparelho."); return; }
    baseRef.current = registros[hojeISO()] || 0;
    sessaoRef.current = 0; setSessao(0); amostras.current = [];
    setAtivo(true); await gravar(CHAVE_ATIVO, true); setAviso("");
  };

  // Desativar encerra o dia: salva os passos e oferece o resumo para compartilhar
  const desativar = async () => {
    const dia = hojeISO();
    setAtivo(false);                       // para o salvamento automático antes de qualquer outra coisa
    const total = baseRef.current + sessaoRef.current;
    const novo = { ...registrosRef.current, [dia]: total };
    registrosRef.current = novo; setRegistros(novo); await gravar(CHAVE, novo);
    await gravar(CHAVE_ATIVO, false);
    amostras.current = []; sessaoRef.current = 0; setSessao(0); baseRef.current = 0;
    if (onCompartilhar) onCompartilhar(P.resumoDia(dia, total, perfil));
  };

  const marcarCompartilhado = async (dia) => {
    const novo = compartilhados.includes(dia) ? compartilhados : compartilhados.concat([dia]);
    setCompartilhados(novo); await gravar(CHAVE_COMP, novo);
  };

  const perfilCompleto = !!(perfil.altura && perfil.sexo && perfil.peso);
  const abrirForm = () => {
    setForm({ altura: perfil.altura || "", sexo: perfil.sexo || "", peso: perfil.peso || "" });
    setErroForm([]); setEditando(true);
  };
  const salvarForm = async () => {
    const { erros, valores } = validarPerfil(form);
    setErroForm(erros);
    if (erros.length) return;
    const novo = { altura: valores.altura, sexo: valores.sexo || "nd", peso: valores.peso };
    setPerfil(novo); await gravar(CHAVE_PERFIL, novo);
    setEditando(false);
  };

  const ontem = ontemISO();
  const temOntem = (registros[ontem] || 0) > 0 && compartilhados.indexOf(ontem) < 0;

  return (
    <section style={{ background: "rgba(128,128,128,0.12)", borderRadius: 14, padding: 14, marginBottom: 14 }} data-testid="contador-passos">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>👟 Contador de passos</div>
        <button type="button" onClick={ativo ? desativar : ativar} aria-pressed={ativo} style={{ border: "none", borderRadius: 999, padding: "7px 14px", fontWeight: 800, cursor: "pointer", background: ativo ? "#C53030" : "#A7FF00", color: ativo ? "#fff" : "#15181B" }}>
          {ativo ? "Desativar e encerrar o dia" : "Ativar"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{totalHoje.toLocaleString("pt-BR")}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>passos hoje</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{resumo.km === null ? "—" : String(resumo.km).replace(".", ",")}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>km</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }}>{resumo.kcal === null ? "—" : Math.round(resumo.kcal)}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>kcal (estimado)</div></div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10, lineHeight: 1.45 }}>
        {!perfilCompleto
          ? "Para calcular distância e calorias, informe altura, sexo e peso."
          : "Distância e calorias são estimativas. Com o app aberto, a contagem usa o sensor do celular."}
      </div>
      {!perfilCompleto && !editando && (
        <button type="button" onClick={abrirForm} style={{ marginTop: 10, width: "100%", border: "none", borderRadius: 10, padding: "10px", background: "#A7FF00", color: "#15181B", cursor: "pointer", fontWeight: 800 }} data-testid="informar-dados-passos">
          Informar altura, sexo e peso
        </button>
      )}
      {perfilCompleto && !editando && (
        <button type="button" onClick={abrirForm} style={{ marginTop: 8, border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0 }} data-testid="editar-dados-passos">
          Editar altura, sexo e peso
        </button>
      )}
      {editando && (
        <div style={{ marginTop: 10, background: "rgba(0,0,0,0.25)", borderRadius: 12, padding: 12 }} data-testid="form-dados-passos">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Seus dados</div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Altura (cm)
            <input type="text" inputMode="numeric" value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value.replace(/[^0-9.,]/g, "").slice(0, 5) })} aria-label="Altura em cm" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: 15 }} />
          </label>
          <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>Peso (kg)
            <input type="text" inputMode="decimal" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6) })} aria-label="Peso em kg" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4, padding: 10, borderRadius: 8, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: 15 }} />
          </label>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Sexo (para a distância)</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["masculino", "Masculino"], ["feminino", "Feminino"], ["nd", "Prefiro não informar"]].map(([v, rot]) => (
              <button key={v} type="button" aria-pressed={form.sexo === v} onClick={() => setForm({ ...form, sexo: v })} style={{ flex: 1, borderRadius: 999, padding: "7px 6px", fontSize: 12, cursor: "pointer", border: "1px solid " + (form.sexo === v ? "#A7FF00" : "rgba(128,128,128,0.4)"), background: form.sexo === v ? "#A7FF00" : "transparent", color: form.sexo === v ? "#15181B" : "inherit", fontWeight: form.sexo === v ? 800 : 500 }}>{rot}</button>
            ))}
          </div>
          {erroForm.map((er, i) => <div key={i} role="alert" style={{ fontSize: 12.5, color: "#FFB1A8", marginBottom: 4 }}>{er}</div>)}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={salvarForm} data-testid="salvar-dados-passos" style={{ flex: 1, border: "none", borderRadius: 10, padding: 10, background: "#A7FF00", color: "#15181B", fontWeight: 800, cursor: "pointer" }}>Salvar</button>
            <button type="button" onClick={() => setEditando(false)} style={{ flex: 1, border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10, padding: 10, background: "transparent", color: "inherit", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
      {ativo && <div style={{ fontSize: 12, marginTop: 6, color: "#FFB1A8" }}>Com o app fechado, a contagem só funciona na versão para Android com o serviço de segundo plano.</div>}
      {aviso && <div role="alert" style={{ fontSize: 12.5, marginTop: 6, color: "#FFB1A8" }}>{aviso}</div>}
      {temOntem && !editando && (
        <button type="button" onClick={() => { if (onCompartilhar) onCompartilhar(P.resumoDia(ontem, registros[ontem], perfil)); marcarCompartilhado(ontem); }} style={{ marginTop: 10, width: "100%", border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10, padding: "9px", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>
          Compartilhar o resumo de ontem
        </button>
      )}
    </section>
  );
}

// Abre o WhatsApp com o resumo do dia (ou usa o compartilhamento do celular)
export function compartilharResumo(resumo) {
  const texto = P.textoResumo(resumo);
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ text: texto }).catch(() => window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener,noreferrer"));
  } else {
    window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener,noreferrer");
  }
}
