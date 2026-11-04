import React, { useEffect, useState } from "react";
import * as P from "./passos.js";
import { tmbKcal, idadeDeNascimento } from "./tmb.js";
import { nativoDisponivel, pluginPassos, estadoPassosNativos } from "./ponte.js";
import {
  hojeISO, lerPerfilPassos, gravarDiaNoHistorico, contagemAutomaticaLigada,
  ativarContagemAutomatica, desativarContagemAutomatica, sincronizarPassos, reiniciarHojeAutomatico,
} from "./sincronia.js";

// Passos de hoje: vêm do sensor de passos do celular (app Android, contagem automática ligada)
// ou são informados pela pessoa. As duas formas nunca ficam ativas ao mesmo tempo.
// Distância e calorias são calculadas a partir desse número.
const CHAVE = "passos-registros";        // { "AAAA-MM-DD": passos }
const CHAVE_HIST = "passos-historico";   // { "AAAA-MM-DD": { passos, km, kcal, tmb, idade } }
const CHAVE_PERFIL = "passos-perfil";    // altura, sexo e peso informados aqui
const CHAVE_COMP = "passos-compartilhados";

const ontemISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

async function ler(chave, padrao) {
  try { const r = await window.storage.get(chave); if (r && r.value) return JSON.parse(r.value); } catch (e) { /* sem dado */ }
  return padrao;
}
async function gravar(chave, valor) {
  try { await window.storage.set(chave, JSON.stringify(valor)); } catch (e) { /* segue */ }
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
const botaoVerde = { width: "100%", border: "none", borderRadius: 8, padding: 8, background: "#A7FF00", color: "#15181B", cursor: "pointer", fontWeight: 800 };
const botaoContorno = { width: "100%", border: "1px solid rgba(128,128,128,0.4)", borderRadius: 8, padding: 8, background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 };

const AJUDA_PERMISSAO = "Sem a permissão de atividade física o Android não deixa o Massi ler os passos. Para liberar: Configurações do Android › Apps › Massi Pro › Permissões › Atividade física.";

export default function ContadorPassos({ onCompartilhar }) {
  const [registros, setRegistros] = useState({});
  const [idade, setIdade] = useState(null);
  const [perfil, setPerfil] = useState({});
  const [compartilhados, setCompartilhados] = useState([]);
  const [passosInformados, setPassosInformados] = useState("");
  const [editandoDados, setEditandoDados] = useState(false);
  const [form, setForm] = useState({ altura: "", sexo: "", peso: "" });
  const [erroForm, setErroForm] = useState([]);
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const [aviso, setAviso] = useState("");
  // "carregando" | "indisponivel" | "sem_sensor" | "desligado" | "ligado" | "sem_permissao" | "erro"
  const [auto, setAuto] = useState({ status: "carregando" });

  // Atualiza a contagem automática ao abrir o cartão e sempre que o app volta para a tela.
  // O celular conta os passos sozinho, mesmo com a tela apagada; aqui só lemos o total.
  useEffect(() => {
    let vivo = true;
    const atualizarInterno = async () => {
      if (!(nativoDisponivel() && pluginPassos())) { if (vivo) setAuto({ status: "indisponivel" }); return; }
      if (!contagemAutomaticaLigada()) {
        const e = await estadoPassosNativos();
        if (vivo) setAuto({ status: e.status === "sem_sensor" ? "sem_sensor" : "desligado" });
        return;
      }
      const r = await sincronizarPassos();
      if (!vivo) return;
      if (r.status === "ok") {
        setRegistros(r.registros);
        setAuto({ status: "ligado", estimado: !!r.estimado });
      } else setAuto({ status: r.status === "sem_permissao" ? "sem_permissao" : "erro" });
    };
    // Se algo falhar, o estado vira "erro" e o campo manual aparece (a tela nunca fica sem opção).
    const atualizar = async () => { try { await atualizarInterno(); } catch (e) { if (vivo) setAuto({ status: "erro" }); } };
    atualizar();
    const aoVoltar = () => { if (document.visibilityState === "visible") atualizar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { vivo = false; document.removeEventListener("visibilitychange", aoVoltar); };
  }, []);

  const ativarContagem = async () => {
    setAviso("");
    const r = await ativarContagemAutomatica();
    if (r.status === "ok") {
      const s = await sincronizarPassos();
      if (s.status === "ok") setRegistros(s.registros);
      setAuto({ status: "ligado", estimado: false });
    } else if (r.status === "sem_permissao") { setAuto({ status: "sem_permissao" }); setAviso(AJUDA_PERMISSAO); }
    else if (r.status === "sem_sensor") setAuto({ status: "sem_sensor" });
    else { setAuto({ status: "erro" }); setAviso("Não foi possível ativar a contagem automática agora."); }
  };
  const desativarContagem = () => {
    desativarContagemAutomatica();
    setAuto({ status: "desligado" });
    setAviso("Contagem automática desativada. Você pode digitar os passos.");
  };
  const atualizarAgora = async () => {
    setAviso("");
    const r = await sincronizarPassos();
    if (r.status === "ok") { setRegistros(r.registros); setAuto({ status: "ligado", estimado: !!r.estimado }); }
    else { setAuto({ status: r.status === "sem_permissao" ? "sem_permissao" : "erro" }); setAviso(r.status === "sem_permissao" ? AJUDA_PERMISSAO : "Não foi possível ler os passos do celular agora."); }
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await ler(CHAVE, {});
      const p = await lerPerfilPassos();
      const c = await ler(CHAVE_COMP, []);
      const cad = await ler("onboarding-perfil", null);
      if (vivo) {
        // não sobrescreve a leitura do sensor, se ela já chegou primeiro
        setRegistros((atual) => (Object.keys(atual).length ? { ...r, ...atual } : r));
        setPerfil(p); setCompartilhados(Array.isArray(c) ? c : []); setIdade(idadeDeNascimento(cad && cad.nascimento));
      }
    })();
    return () => { vivo = false; };
  }, []);

  const hoje = hojeISO();
  const totalHoje = registros[hoje] || 0;
  const resumo = P.resumoDia(hoje, totalHoje, perfil);
  const perfilCompleto = !!(perfil.altura && perfil.sexo && perfil.peso);
  const ontem = ontemISO();
  const temOntem = (registros[ontem] || 0) > 0 && compartilhados.indexOf(ontem) < 0;
  const automatico = auto.status === "ligado";

  // Salva os passos informados para hoje (só quando a contagem automática está desligada)
  const salvarPassos = async () => {
    const n = Number(String(passosInformados).replace(/\./g, "").replace(",", "."));
    if (!(Number.isInteger(n) && n >= 0 && n <= 100000)) { setAviso("Digite um número de passos entre 0 e 100.000."); return; }
    const novo = { ...registros, [hoje]: n };
    setRegistros(novo); await gravar(CHAVE, novo);
    await gravarDiaNoHistorico(hoje, n);
    setPassosInformados(""); setAviso("");
  };

  const reiniciarHoje = async () => {
    if (automatico) {
      const r = await reiniciarHojeAutomatico();
      if (r.status === "ok") setRegistros(r.registros);
      else setAviso("Não foi possível zerar agora: o celular não respondeu.");
      setConfirmandoReinicio(false);
      return;
    }
    const novo = { ...registros, [hoje]: 0 };
    setRegistros(novo); await gravar(CHAVE, novo);
    const hist = await ler(CHAVE_HIST, {});
    delete hist[hoje];
    await gravar(CHAVE_HIST, hist);
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

  const t = tmbKcal({ sexo: perfil.sexo, peso: perfil.peso, altura: perfil.altura, idade });

  return (
    <section style={{ background: "rgba(128,128,128,0.12)", borderRadius: 14, padding: 14, marginBottom: 14 }} data-testid="contador-passos">
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>👟 Passos do dia</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center", marginBottom: 10 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800 }} data-testid="total-passos">{totalHoje.toLocaleString("pt-BR")}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>passos hoje</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }} data-testid="total-km">{resumo.km === null ? "—" : String(resumo.km).replace(".", ",")}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>km</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800 }} data-testid="total-kcal">{resumo.kcal === null ? "—" : Math.round(resumo.kcal)}</div><div style={{ fontSize: 11.5, opacity: 0.75 }}>kcal (estimado)</div></div>
      </div>

      {auto.status === "indisponivel" && (
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45, marginBottom: 8 }} data-testid="aviso-sem-nativo">
          A contagem automática depende do aplicativo Android do Massi. No navegador, digite os passos abaixo.
        </div>
      )}
      {auto.status === "sem_sensor" && (
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45, marginBottom: 8 }} data-testid="aviso-sem-sensor">
          Este celular não tem sensor de passos, então a contagem automática não está disponível. Digite os passos abaixo.
        </div>
      )}
      {(auto.status === "desligado" || auto.status === "sem_permissao" || auto.status === "erro") && (
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12.5 }} data-testid="bloco-contagem-automatica">
          <div style={{ marginBottom: 6, lineHeight: 1.45 }}>Contagem automática: desligada.</div>
          <div style={{ marginBottom: 8, opacity: 0.85, lineHeight: 1.45 }}>
            Para contar seus passos o Android pede a permissão de atividade física. O Massi usa só o contador de passos do próprio celular, que continua contando com a tela apagada. Nada é enviado para fora do aparelho.
          </div>
          <button type="button" onClick={ativarContagem} data-testid="ativar-contagem" style={botaoVerde}>{auto.status === "desligado" ? "Ativar" : "Tentar de novo"}</button>
        </div>
      )}
      {automatico && (
        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 12.5 }} data-testid="bloco-contagem-automatica">
          <div style={{ marginBottom: 8, lineHeight: 1.45 }}>Contagem automática ativa: os passos de hoje vêm do sensor do celular.</div>
          {auto.estimado && <div style={{ marginBottom: 8, color: "#FFD27A", lineHeight: 1.45 }} data-testid="aviso-estimado">O app ficou fechado na virada do dia, então parte dos passos de ontem foi estimada.</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={atualizarAgora} data-testid="sincronizar-passos" style={{ ...botaoVerde, flex: 1 }}>Atualizar agora</button>
            <button type="button" onClick={desativarContagem} data-testid="desativar-contagem" style={{ ...botaoContorno, flex: 1 }}>Desativar</button>
          </div>
        </div>
      )}

      {!automatico && auto.status !== "carregando" && (
        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Quantos passos você deu hoje? (copie do app de passos do celular)
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input type="text" inputMode="numeric" value={passosInformados} onChange={(e) => setPassosInformados(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))} placeholder="ex.: 8432" aria-label="Passos de hoje" style={{ ...campo, marginTop: 0, flex: 1 }} data-testid="input-passos" />
            <button type="button" onClick={salvarPassos} data-testid="salvar-passos" style={{ border: "none", borderRadius: 8, padding: "0 16px", background: "#A7FF00", color: "#15181B", fontWeight: 800, cursor: "pointer" }}>Salvar</button>
          </div>
        </label>
      )}
      {aviso && <div role="alert" style={{ fontSize: 12.5, color: "#FFB1A8", marginBottom: 6, lineHeight: 1.45 }}>{aviso}</div>}

      <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.45, marginBottom: 6 }}>
        {automatico
          ? "Os passos vêm do sensor de passos do celular, que conta sozinho. Abra o Massi de vez em quando durante o dia para manter o total em dia."
          : "Os passos são copiados por você do app de passos do seu celular. Sem a contagem automática, o Massi não conta passos sozinho."}
      </div>
      <div style={{ fontSize: 12.5, marginBottom: 8 }} data-testid="tmb-valor">
        {t === null ? "TMB: informe sexo, altura, peso e data de nascimento para calcular." : "TMB estimada: " + t.toLocaleString("pt-BR") + " kcal/dia (Mifflin-St Jeor)."}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45, marginBottom: 8 }}>
        {!perfilCompleto
          ? "Para calcular distância e calorias, informe altura, sexo e peso."
          : "Distância e calorias são estimativas, calculadas a partir dos passos."}
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
