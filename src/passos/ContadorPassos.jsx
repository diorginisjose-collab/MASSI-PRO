import React, { useEffect, useRef, useState } from "react";
import * as P from "./passos.js";

const CHAVE = "passos-registros"; // { "AAAA-MM-DD": passos }
const CHAVE_ATIVO = "passos-ativo";
const CHAVE_COMP = "passos-compartilhados"; // lista de dias já compartilhados
const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const ontemISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

async function ler(chave, padrao) {
  try { const r = await window.storage.get(chave); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return padrao;
}
async function gravar(chave, valor) {
  try { await window.storage.set(chave, JSON.stringify(valor)); } catch (e) { /* segue */ }
}

// Perfil para o cálculo: altura, sexo e peso do que o app já tem
async function lerPerfil() {
  const avs = await ler("avaliacoes-evolucao", []);
  const ult = Array.isArray(avs) && avs.length ? avs[avs.length - 1] : {};
  return { altura: ult.altura, sexo: ult.sexo, peso: ult.peso };
}

export default function ContadorPassos({ onCompartilhar }) {
  const [ativo, setAtivo] = useState(false);
  const [registros, setRegistros] = useState({});
  const [perfil, setPerfil] = useState({});
  const [sessao, setSessao] = useState(0);        // passos contados nesta sessão aberta
  const [aviso, setAviso] = useState("");
  const [compartilhados, setCompartilhados] = useState([]);
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
        {resumo.km === null || resumo.kcal === null
          ? "Para calcular distância e calorias, informe altura, sexo e peso na Avaliação."
          : "Distância e calorias são estimativas. Com o app aberto, a contagem usa o sensor do celular."}
      </div>
      {ativo && <div style={{ fontSize: 12, marginTop: 6, color: "#FFB1A8" }}>Com o app fechado, a contagem só funciona na versão para Android com o serviço de segundo plano.</div>}
      {aviso && <div role="alert" style={{ fontSize: 12.5, marginTop: 6, color: "#FFB1A8" }}>{aviso}</div>}
      {temOntem && (
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
