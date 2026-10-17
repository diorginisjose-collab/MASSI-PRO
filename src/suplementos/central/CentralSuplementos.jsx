import React, { useEffect, useMemo, useState } from "react";
import { SUPLEMENTOS, CATEGORIAS, AVISO_GERAL } from "../dados/dados.js";
import * as C from "./calculos.js";
// Busca inteligente definida aqui (não depende de funções novas do calculos.js)
function sugerirSuplementos(termo, lista, max) {
  const t = C.semAcento(termo);
  if (!t) return [];
  const pontuar = (x) => {
    const nome = C.semAcento(x.nome);
    if (nome.startsWith(t)) return 0;
    if (C.sinonimosDe(x.id).some((y) => C.semAcento(y).startsWith(t))) return 1;
    if (nome.split(/[\s(),\/-]+/).some((p) => p.startsWith(t))) return 2;
    if (C.semAcento(C.textoBusca(x)).includes(t)) return 3;
    return -1;
  };
  return (lista || [])
    .map((x) => ({ x, r: pontuar(x) }))
    .filter((y) => y.r >= 0)
    .sort((a, b) => a.r - b.r || a.x.nome.localeCompare(b.x.nome, "pt-BR"))
    .slice(0, max || 6)
    .map((y) => y.x);
}
function completarAuto(termo, lista) {
  const digitado = String(termo || "");
  if (digitado.trim().length < 1) return "";
  const melhor = sugerirSuplementos(digitado, lista, 1)[0];
  if (!melhor) return "";
  if (C.semAcento(melhor.nome.slice(0, digitado.length)) !== C.semAcento(digitado)) return "";
  return melhor.nome.slice(digitado.length);
}
import { MATRIZ, NIVEIS, OBJETIVOS, nivelDe } from "./evidencias.js";
import { FONTES } from "./fontes.js";
import { MITOS, CLASSIFICACOES } from "./mitos.js";
import { SEGURANCA, AVALIACAO_PADRAO } from "./seguranca.js";
import { SECOES_ROTULOS, AVISO_ROTULOS } from "./rotulos.js";
import { CONTEUDO_REVISADO, AVISO_PUBLICO } from "./config.js";
import { AVISO_DIARIO, validarRegistro, agruparPorData, csvDiario } from "./diario.js";

const CHAVE_DIARIO = "central-diario";
function baixarCsv(nome, conteudo) {
  const blob = new Blob(["\ufeff" + conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

const COR_CLASSE = { "Verdadeiro": "#2E7D32", "Parcialmente verdadeiro": "#B7791F", "Falso": "#C53030", "Evidência insuficiente": "#4A5568" };

const COR_EVIDENCIA_GERAL = { "Forte": "#2E7D32", "Moderada": "#B7791F", "Limitada": "#C05621", "Insuficiente": "#4A5568", "Ausência de benefício relevante": "#2B6CB0" };
const COR_NIVEL = { "Forte": "#2E7D32", "Moderada": "#B7791F", "Limitada": "#C05621", "Insuficiente": "#4A5568", "Ausência de benefício relevante": "#2B6CB0" };

const COR_EVIDENCIA = { "Forte": "#2E7D32", "Moderada": "#B7791F", "Limitada": "#C05621", "Pouca ou inexistente": "#4A5568" };
const LIME = "#A7FF00";
const CHAVE_FAV = "central-favoritos";
const CHAVE_HIST = "central-historico";
const ABAS = [["inicio", "Início"], ["catalogo", "Catálogo"], ["rotulos", "Rótulos"], ["diario", "Diário"], ["comparar", "Comparar"], ["calc", "Calculadoras"], ["favoritos", "Favoritos"]];

async function lerLista(chave) {
  try { const r = await window.storage.get(chave); const v = r && r.value ? JSON.parse(r.value) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
async function gravarLista(chave, lista) {
  try { await window.storage.set(chave, JSON.stringify(lista)); } catch (e) { /* sem armazenamento: segue */ }
}

const Badge = ({ texto, cor }) => (
  <span style={{ background: cor, color: "#fff", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{texto}</span>
);
const Bloco = ({ titulo, texto }) => (!texto ? null : (
  <div style={{ marginTop: 10 }}>
    <div style={{ fontWeight: 700, fontSize: 13 }}>{titulo}</div>
    <div style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.92 }}>{texto}</div>
  </div>
));
const Campo = ({ rotulo, children }) => (
  <label style={{ display: "block", fontSize: 13, marginBottom: 10 }}>
    <span style={{ display: "block", fontWeight: 700, marginBottom: 4 }}>{rotulo}</span>
    {children}
  </label>
);
const entrada = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontSize: 15 };
const chip = (on) => ({ flexShrink: 0, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", border: "1px solid " + (on ? LIME : "rgba(128,128,128,0.4)"), background: on ? LIME : "transparent", color: on ? "#15181B" : "inherit", fontWeight: on ? 800 : 500 });

// Campo de busca com sugestões automáticas e completar (Tab aceita; Enter escolhe a primeira sugestão).
function CampoBuscaInteligente({ value, onChange, onEscolher, placeholder, ariaLabel, estilo }) {
  const [aberto, setAberto] = useState(false);
  const campoRef = React.useRef(null);
  const aoFocar = () => {
    setAberto(true);
    setTimeout(() => { if (campoRef.current && campoRef.current.scrollIntoView) campoRef.current.scrollIntoView({ block: "start", behavior: "smooth" }); }, 300);
  };
  const sugestoes = useMemo(() => sugerirSuplementos(value, SUPLEMENTOS, 6), [value]);
  const complemento = useMemo(() => completarAuto(value, SUPLEMENTOS), [value]);
  const mostrarLista = aberto && String(value || "").trim().length > 0 && sugestoes.length > 0;
  return (
    <div style={{ position: "relative", marginBottom: estilo.marginBottom || 0 }}>
      <div aria-hidden="true" style={{ ...estilo, marginBottom: 0, position: "absolute", left: 0, right: 0, top: 0, pointerEvents: "none", color: "transparent", background: "transparent", whiteSpace: "pre", overflow: "hidden" }}>
        {value}<span style={{ color: "rgba(160,170,180,0.8)" }}>{complemento}</span>
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => { onChange(e.target.value); setAberto(true); }}
        onFocus={aoFocar}
        ref={campoRef}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Tab" && complemento && sugestoes[0]) { e.preventDefault(); onChange(sugestoes[0].nome); setAberto(false); }
          else if (e.key === "Enter" && sugestoes[0]) { e.preventDefault(); onEscolher(sugestoes[0]); setAberto(false); }
          else if (e.key === "Escape") { setAberto(false); }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        style={{ ...estilo, marginBottom: 0, position: "relative", background: "transparent" }}
      />
      {mostrarLista && (
        <ul role="listbox" aria-label="Sugestões" style={{ position: "relative", left: 0, right: 0, listStyle: "none", margin: "6px 0 0", padding: 4, maxHeight: 260, overflowY: "auto", background: "#1B1F23", border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10 }}>
          {sugestoes.map((sg) => (
            <li key={sg.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(sg); setAberto(false); }} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: "inherit", padding: "9px 10px", cursor: "pointer", fontSize: 14, borderRadius: 8 }}>
                {sg.nome} <span style={{ opacity: 0.6, fontSize: 12 }}>· {sg.categoria}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CentralSuplementos({ estilos = {}, tr = (x) => x, onFechar }) {
  const [aba, setAba] = useState("inicio");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [evidencia, setEvidencia] = useState("Todas");
  const [estim, setEstim] = useState("todos");
  const [fonte, setFonte] = useState(false);
  const [alerg, setAlerg] = useState("nenhum");
  const [ordem, setOrdem] = useState("az");
  const [aberto, setAberto] = useState(null);
  const [favs, setFavs] = useState([]);
  const [diario, setDiario] = useState([]);
  const [formD, setFormD] = useState({ suplementoId: "", data: hojeISO(), dose: "", obs: "" });
  const [errosD, setErrosD] = useState([]);
  const [hist, setHist] = useState([]);
  const [comp, setComp] = useState([]);
  const [prot, setProt] = useState({ peso: "", objetivo: "forca", consumida: "" });
  const [porc, setPorc] = useState({ pote: "", porcao: "", prot: "", alvo: "" });
  const [rot, setRot] = useState({ a: { nome: "Produto A", preco: "", peso: "", porcao: "", prot: "", ativo: "" }, b: { nome: "Produto B", preco: "", peso: "", porcao: "", prot: "", ativo: "" } });
  const [caf, setCaf] = useState([{ nome: "Café", mg: "95", porcoes: "1" }]);

  useEffect(() => {
    let vivo = true;
    (async () => { const f = await lerLista(CHAVE_FAV); const h = await lerLista(CHAVE_HIST); const d = await lerLista(CHAVE_DIARIO); if (vivo) { setFavs(f); setHist(h); setDiario(d); } })();
    return () => { vivo = false; };
  }, []);

  const porId = useMemo(() => Object.fromEntries(SUPLEMENTOS.map((s) => [s.id, s])), []);

  const resultados = useMemo(() => {
    const termo = C.semAcento(busca);
    let lista = SUPLEMENTOS.filter((s) => {
      if (categoria !== "Todas" && s.categoria !== categoria) return false;
      if (evidencia !== "Todas" && s.evidencia !== evidencia) return false;
      if (estim === "sim" && !C.ehEstimulante(s.id)) return false;
      if (estim === "nao" && C.ehEstimulante(s.id)) return false;
      if (fonte && !C.ehFonteProteica(s.id)) return false;
      if (alerg !== "nenhum" && C.alergenosDe(s.id).indexOf(alerg) >= 0) return false;
      if (termo && !C.semAcento(C.textoBusca(s)).includes(termo)) return false;
      return true;
    });
    if (ordem === "az") lista = lista.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (ordem === "evid") {
      const peso = { "Forte": 0, "Moderada": 1, "Limitada": 2, "Pouca ou inexistente": 3 };
      lista = lista.slice().sort((a, b) => (peso[a.evidencia] - peso[b.evidencia]) || a.nome.localeCompare(b.nome, "pt-BR"));
    }
    return lista;
  }, [busca, categoria, evidencia, estim, fonte, alerg, ordem]);

  const limparFiltros = () => { setBusca(""); setCategoria("Todas"); setEvidencia("Todas"); setEstim("todos"); setFonte(false); setAlerg("nenhum"); setOrdem("az"); };

  const abrirFicha = (id) => {
    setAberto(aberto === id ? null : id);
    if (aberto !== id) {
      const novo = [id].concat(hist.filter((x) => x !== id)).slice(0, 15);
      setHist(novo); gravarLista(CHAVE_HIST, novo);
    }
  };
  const alternarFav = (id) => {
    const novo = favs.indexOf(id) >= 0 ? favs.filter((x) => x !== id) : favs.concat([id]);
    setFavs(novo); gravarLista(CHAVE_FAV, novo);
  };
  const alternarComp = (id) => {
    if (comp.indexOf(id) >= 0) return setComp(comp.filter((x) => x !== id));
    if (comp.length >= 3) return;
    setComp(comp.concat([id]));
  };

  const renderMatriz = (id) => {
    const m = MATRIZ[id];
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Evidência por objetivo (em revisão)</div>
        {!m && <div style={{ fontSize: 13, opacity: 0.8 }}>Pendente de revisão para todos os objetivos. Nenhum nível foi atribuído.</div>}
        {m && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {OBJETIVOS.map(([chave, rotulo]) => {
                const n = nivelDe(id, chave);
                return (
                  <tr key={chave}>
                    <td style={{ padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.2)" }}>{rotulo}</td>
                    <td style={{ padding: "5px 0", borderTop: "1px solid rgba(128,128,128,0.2)", textAlign: "right" }}>
                      {n ? <Badge texto={n} cor={COR_NIVEL[n] || "#4A5568"} /> : <span style={{ opacity: 0.6 }}>Pendente</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 6, lineHeight: 1.4 }}>
          Níveis: {NIVEIS.join(" · ")}. "Pendente" significa que ainda não foi avaliado, e não que o item não tem efeito.
        </div>
      </div>
    );
  };

  const renderMitos = (id) => {
    const lista = MITOS[id];
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Mitos e verdades (em revisão)</div>
        {!lista && <div style={{ fontSize: 13, opacity: 0.8 }}>Pendente de revisão para este item.</div>}
        {lista && lista.map((m, i) => (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>"{m.afirmacao}"</div>
            <div><Badge texto={m.classificacao} cor={COR_CLASSE[m.classificacao] || "#4A5568"} /></div>
            <div style={{ opacity: 0.9, marginTop: 4 }}>{m.explicacao}</div>
          </div>
        ))}
        <div style={{ fontSize: 11.5, opacity: 0.7 }}>Classificações: {CLASSIFICACOES.join(" · ")}.</div>
      </div>
    );
  };

  const renderSeguranca = (s, id) => {
    const seg = SEGURANCA[id] || {};
    const blocos = [
      ["Riscos conhecidos e cuidados", s.cuidados],
      ["Contraindicações", s.evitar],
      ["Interações relevantes", seg.interacoes || "Pendente de revisão."],
      ["Quando procurar avaliação profissional", seg.avaliacao || AVALIACAO_PADRAO],
      ["Incertezas relevantes", "Dados de segurança em populações específicas (gestantes, crianças, doenças) ainda estão em revisão."],
    ];
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Perfil de segurança</div>
        {blocos.map(([titulo, texto]) => <Bloco key={titulo} titulo={titulo} texto={texto} />)}
      </div>
    );
  };

  const renderFontes = (id) => {
    const refs = (MATRIZ[id] && MATRIZ[id].refs) || [];
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Referências</div>
        {refs.length === 0 && <div style={{ fontSize: 13, opacity: 0.8 }}>Fontes ainda não cadastradas para este item (pendente).</div>}
        {refs.map((r) => {
          const f = FONTES[r];
          return f ? (
            <div key={r} style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 8 }}>
              <div>{f.citacao}</div>
              <div style={{ opacity: 0.8 }}>{f.instituicao} · {f.ano} · {f.tipo}</div>
              {f.link && <div><a href={f.link} target="_blank" rel="noopener noreferrer" style={{ color: LIME }}>{f.link}</a></div>}
              <div style={{ opacity: 0.7, fontStyle: "italic" }}>{f.verificacao}</div>
            </div>
          ) : null;
        })}
      </div>
    );
  };

  const cartaoItem = (s, opcoes = {}) => {
    const ficha = aberto === s.id;
    const favorito = favs.indexOf(s.id) >= 0;
    return (
      <div key={s.id} style={{ borderTop: "1px solid rgba(128,128,128,0.25)", padding: "10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => abrirFicha(s.id)} aria-expanded={ficha} style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", color: "inherit", textAlign: "left", padding: 0, cursor: "pointer" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{s.nome}</span>
            <span style={{ display: "block", fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              {s.categoria}{C.ehEstimulante(s.id) ? " · estimulante" : ""}
            </span>
          </button>
          {CONTEUDO_REVISADO && <Badge texto={s.evidencia} cor={COR_EVIDENCIA[s.evidencia] || "#4A5568"} />}
          <button type="button" onClick={() => alternarFav(s.id)} aria-label={favorito ? "Remover dos favoritos" : "Favoritar"} style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: favorito ? LIME : "inherit" }}>{favorito ? "★" : "☆"}</button>
          {opcoes.comparador && (
            <input type="checkbox" aria-label={"Comparar " + s.nome} checked={comp.indexOf(s.id) >= 0} onChange={() => alternarComp(s.id)} />
          )}
        </div>
        {ficha && !CONTEUDO_REVISADO && (
          <div style={{ paddingTop: 4 }}>
            <Bloco titulo="Quem deve consultar antes" texto={AVALIACAO_PADRAO} />
            <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 10, opacity: 0.9 }}>
              Informações sobre uso, dose, efeitos e evidência científica serão publicadas após revisão por profissional habilitado. Consulte um nutricionista ou médico antes de usar este suplemento.
            </div>
          </div>
        )}
        {ficha && CONTEUDO_REVISADO && (
          <div style={{ paddingTop: 4 }}>
            <Bloco titulo="Para que serve" texto={s.paraQueServe} />
            <Bloco titulo="Como funciona" texto={s.comoFunciona} />
            <Bloco titulo="Dose de referência (estudos e diretrizes)" texto={s.dose} />
            <Bloco titulo="Cuidados" texto={s.cuidados} />
            <Bloco titulo="Quem deve evitar ou consultar antes" texto={s.evitar} />
            {renderMatriz(s.id)}
            {renderMitos(s.id)}
            {renderSeguranca(s, s.id)}
            {renderFontes(s.id)}
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
              Evidência (estado atual da revisão): {s.evidencia}. Conteúdo educativo, não é recomendação médica.
            </div>
          </div>
        )}
      </div>
    );
  };

  const aviso = (
    <div style={{ background: "rgba(255,193,7,0.10)", border: "1px solid rgba(255,193,7,0.35)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.45, marginBottom: 12 }}>
      {CONTEUDO_REVISADO ? (<><strong>Conteúdo em revisão.</strong> Fontes, doses e classificações de evidência ainda precisam de validação por profissional antes de serem consideradas definitivas. {AVISO_GERAL}</>) : AVISO_PUBLICO}
    </div>
  );

  // ---------- Catálogo ----------
  const telaCatalogo = (
    <div>
      {aviso}
      <CampoBuscaInteligente
        value={busca}
        onChange={(v) => setBusca(v)}
        onEscolher={(sg) => { setBusca(sg.nome); setAberto(sg.id); }}
        placeholder="Buscar por nome, sinônimo ou finalidade (ex.: creatina, BCAA, sono)"
        ariaLabel="Buscar suplemento"
        estilo={{ ...entrada, marginBottom: 10 }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <Campo rotulo="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={entrada} aria-label="Filtrar por categoria">
            <option value="Todas">Todas</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Campo>
        {CONTEUDO_REVISADO && (<Campo rotulo="Evidência">
          <select value={evidencia} onChange={(e) => setEvidencia(e.target.value)} style={entrada} aria-label="Filtrar por evidência">
            <option value="Todas">Todas</option>
            {["Forte", "Moderada", "Limitada", "Pouca ou inexistente"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Campo>)}
        <Campo rotulo="Estimulante">
          <select value={estim} onChange={(e) => setEstim(e.target.value)} style={entrada} aria-label="Filtrar por estimulante">
            <option value="todos">Todos</option>
            <option value="sim">Com estimulante</option>
            <option value="nao">Sem estimulante</option>
          </select>
        </Campo>
        <Campo rotulo="Restrição / alérgeno">
          <select value={alerg} onChange={(e) => setAlerg(e.target.value)} style={entrada} aria-label="Excluir por alérgeno">
            <option value="nenhum">Não excluir</option>
            {C.ALERGENOS.map((a) => <option key={a} value={a}>Sem {a}</option>)}
          </select>
        </Campo>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={fonte} onChange={(e) => setFonte(e.target.checked)} /> Só fontes proteicas
        </label>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value)} style={{ ...entrada, width: "auto" }} aria-label="Ordenar">
          <option value="az">Ordem A–Z</option>
          {CONTEUDO_REVISADO && <option value="evid">Maior evidência primeiro</option>}
        </select>
        <button type="button" onClick={limparFiltros} style={{ ...entrada, width: "auto", cursor: "pointer" }}>Limpar filtros</button>
      </div>

      <div style={{ fontSize: 12.5, opacity: 0.75, marginBottom: 6 }}>{resultados.length} {resultados.length === 1 ? "suplemento" : "suplementos"}</div>
      {resultados.length === 0 && (
        <div style={{ padding: "18px 12px", textAlign: "center", fontSize: 14, opacity: 0.85 }}>
          Nenhum suplemento encontrado com esses filtros.
          <div><button type="button" onClick={limparFiltros} style={{ ...chip(false), marginTop: 10 }}>Limpar filtros</button></div>
        </div>
      )}
      {resultados.map((s) => cartaoItem(s))}
    </div>
  );

  // ---------- Comparar ----------
  const selecionados = comp.map((id) => porId[id]).filter(Boolean);
  const telaComparar = (
    <div>
      {aviso}
      <div style={{ fontSize: 13, marginBottom: 8 }}>Escolha de 2 a 3 suplementos na lista abaixo. Seleção atual: {comp.length} de 3.</div>
      {comp.length > 0 && <button type="button" onClick={() => setComp([])} style={{ ...chip(false), marginBottom: 10 }}>Limpar seleção</button>}
      <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 10, padding: "0 10px", marginBottom: 14 }}>
        {SUPLEMENTOS.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((s) => (
          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(128,128,128,0.2)", fontSize: 14 }}>
            <input type="checkbox" checked={comp.indexOf(s.id) >= 0} onChange={() => alternarComp(s.id)} disabled={comp.length >= 3 && comp.indexOf(s.id) < 0} />
            {s.nome}
          </label>
        ))}
      </div>
      {selecionados.length < 2 ? (
        <div style={{ fontSize: 13.5, opacity: 0.8 }}>Selecione pelo menos 2 suplementos para comparar.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 6, borderBottom: "1px solid rgba(128,128,128,0.4)" }}>Critério</th>
                {selecionados.map((s) => <th key={s.id} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid rgba(128,128,128,0.4)", color: LIME }}>{s.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {(CONTEUDO_REVISADO ? [
                ["Categoria", (s) => s.categoria],
                ["Evidência (geral)", (s) => s.evidencia],
                ["Para que serve", (s) => s.paraQueServe],
                ["Dose de referência", (s) => s.dose],
                ["Cuidados", (s) => s.cuidados],
                ["Quem deve evitar", (s) => s.evitar],
                ["Estimulante", (s) => (C.ehEstimulante(s.id) ? "Sim" : "Não")],
                ["Fonte proteica", (s) => (C.ehFonteProteica(s.id) ? "Sim" : "Não")],
                ["Alérgenos comuns", (s) => (C.alergenosDe(s.id).join(", ") || "Nenhum listado")],
                ["Tempo observado nos estudos", () => "Pendente de validação"],
                ["Quando pode ser desnecessário", () => "Pendente de validação (depende de alimentação e objetivo)"],
              ] : [
                ["Categoria", (s) => s.categoria],
                ["Estimulante", (s) => (C.ehEstimulante(s.id) ? "Sim" : "Não")],
                ["Fonte proteica", (s) => (C.ehFonteProteica(s.id) ? "Sim" : "Não")],
                ["Alérgenos comuns", (s) => (C.alergenosDe(s.id).join(", ") || "Nenhum listado")],
              ]).map(([rotulo, f]) => (
                <tr key={rotulo}>
                  <td style={{ padding: 6, fontWeight: 700, verticalAlign: "top", borderBottom: "1px solid rgba(128,128,128,0.2)" }}>{rotulo}</td>
                  {selecionados.map((s) => <td key={s.id} style={{ padding: 6, verticalAlign: "top", borderBottom: "1px solid rgba(128,128,128,0.2)", lineHeight: 1.4 }}>{f(s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 10, lineHeight: 1.5 }}>
            Esta comparação não indica um vencedor. A escolha depende do objetivo, da alimentação atual, de condições de saúde e do orçamento.
          </div>
        </div>
      )}
    </div>
  );

  // ---------- Calculadoras ----------
  const num = (v) => (v === "" || v === null || v === undefined ? "" : String(v).replace(",", "."));
  // Cada cálculo roda sem alterar estado: devolve { v } ou { erro } (sem setState durante a renderização)
  const seguro = (fn) => { try { return { v: fn() }; } catch (e) { return { erro: traduzirErro(e) }; } };
  const traduzirErro = (e) => {
    const m = {
      peso_invalido: "Informe um peso entre 30 e 250 kg.",
      objetivo_invalido: "Escolha um objetivo.",
      consumo_invalido: "Informe um consumo entre 0 e 500 g.",
      pote_invalido: "Informe o peso do pote em gramas (até 10.000 g).",
      porcao_invalida: "Informe a porção em gramas (entre 1 e 200 g).",
      proteina_invalida: "A proteína por porção não pode ser maior que a porção (e não pode ser negativa).",
      alvo_invalido: "Informe um alvo entre 1 e 500 g.",
      sem_proteina: "Este produto não declara proteína por porção.",
      preco_invalido: "Informe um preço maior que zero.",
      mg_invalido: "Informe a cafeína em mg (entre 0 e 1.000).",
      porcoes_invalidas: "Informe um número de porções entre 0 e 20.",
      ativo_invalido: "A concentração do ingrediente ativo deve estar entre 0 e 100 g por 100 g.",
    };
    return m[e.message] || "Confira os valores informados.";
  };
  const campoNum = (rotulo, valor, onChange, props = {}) => (
    <Campo rotulo={rotulo}><input type="text" inputMode="decimal" value={valor} onChange={(e) => onChange(num(e.target.value))} style={entrada} {...props} /></Campo>
  );

  const erros = [];
  const usar = (r) => { if (r.erro) erros.push(r.erro); return r.v || null; };
  const pr = usar(seguro(() => (prot.peso ? C.faixaProteina(prot.peso, prot.objetivo) : null)));
  const sit = pr && prot.consumida !== "" ? usar(seguro(() => C.situacaoProteina(prot.consumida, pr))) : null;
  const po = usar(seguro(() => (porc.pote && porc.porcao && porc.prot !== "" ? C.analisarPorcao({ pesoPoG: porc.pote, porcaoG: porc.porcao, proteinaPorPorcaoG: porc.prot, alvoG: porc.alvo || undefined }) : null)));
  const ra = usar(seguro(() => (rot.a.preco && rot.a.peso && rot.a.porcao ? C.analisarRotulo({ preco: rot.a.preco, pesoLiquidoG: rot.a.peso, porcaoG: rot.a.porcao, proteinaPorPorcaoG: rot.a.prot || undefined, ativoPor100g: rot.a.ativo || undefined }) : null)));
  const rb = usar(seguro(() => (rot.b.preco && rot.b.peso && rot.b.porcao ? C.analisarRotulo({ preco: rot.b.preco, pesoLiquidoG: rot.b.peso, porcaoG: rot.b.porcao, proteinaPorPorcaoG: rot.b.prot || undefined, ativoPor100g: rot.b.ativo || undefined }) : null)));
  const cafe = usar(seguro(() => C.somarCafeina(caf.filter((x) => x.mg !== "" && x.porcoes !== "").map((x) => ({ nome: x.nome, mgPorPorcao: x.mg, porcoes: x.porcoes })))));

  const telaCalc = (
    <div>
      {aviso}
      {erros.length > 0 && <div role="alert" style={{ background: "rgba(255,107,94,0.12)", border: "1px solid rgba(255,107,94,0.4)", borderRadius: 10, padding: "8px 12px", fontSize: 13, marginBottom: 10 }}>{erros[0]}</div>}

      {CONTEUDO_REVISADO ? (<div style={estilos.card ? { ...estilos.card, marginBottom: 12 } : { marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: LIME, marginBottom: 8 }}>1. Proteína diária</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {campoNum("Peso (kg)", prot.peso, (v) => setProt({ ...prot, peso: v }), { placeholder: "ex.: 80", "aria-label": "Peso em kg" })}
          {campoNum("Já consumida hoje (g)", prot.consumida, (v) => setProt({ ...prot, consumida: v }), { placeholder: "ex.: 90", "aria-label": "Proteína consumida em gramas" })}
        </div>
        <Campo rotulo="Objetivo">
          <select value={prot.objetivo} onChange={(e) => setProt({ ...prot, objetivo: e.target.value })} style={entrada} aria-label="Objetivo">
            {Object.entries(C.OBJETIVOS_PROTEINA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
        </Campo>
        {pr && (
          <div style={{ fontSize: 14, lineHeight: 1.55 }} data-testid="resultado-proteina">
            <div>Faixa de referência: <strong>{pr.minG} a {pr.maxG} g por dia</strong> ({pr.gkgMin} a {pr.gkgMax} g/kg).</div>
            {sit && sit.status === "abaixo" && <div>Faltam cerca de <strong>{sit.diferencaG} g</strong> para entrar na faixa.</div>}
            {sit && sit.status === "dentro" && <div>Consumo dentro da faixa escolhida.</div>}
            {sit && sit.status === "acima" && <div>Acima da faixa em cerca de {sit.diferencaG} g. Para a maioria dos adultos isso não é um problema, mas converse com um profissional se houver doença renal.</div>}
            <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 6 }}>{pr.fonte}. As metas dependem do indivíduo; pessoas com doença renal ou outras condições precisam de orientação específica.</div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>Exemplos aproximados (g de proteína):</div>
            <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 13 }}>
              {C.EXEMPLOS_PROTEINA.map((e) => <li key={e.alimento}>{e.alimento} ({e.porcao}): ~{e.proteinaG} g</li>)}
            </ul>
          </div>
        )}
      </div>) : (<div style={{ background: "rgba(128,128,128,0.12)", borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>1. Proteína diária</div>
        Esta calculadora será publicada após revisão por profissional habilitado, porque sugere metas individuais. Enquanto isso, consulte um nutricionista.
      </div>)}

      <div style={estilos.card ? { ...estilos.card, marginBottom: 12 } : { marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: LIME, marginBottom: 8 }}>2. Porção proteica (pó)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {campoNum("Peso do pote (g)", porc.pote, (v) => setPorc({ ...porc, pote: v }), { placeholder: "ex.: 900", "aria-label": "Peso do pote em gramas" })}
          {campoNum("Porção (g)", porc.porcao, (v) => setPorc({ ...porc, porcao: v }), { placeholder: "ex.: 30", "aria-label": "Porção em gramas" })}
          {campoNum("Proteína por porção (g, do rótulo)", porc.prot, (v) => setPorc({ ...porc, prot: v }), { placeholder: "ex.: 24", "aria-label": "Proteína por porção" })}
          {campoNum("Alvo de proteína (g, opcional)", porc.alvo, (v) => setPorc({ ...porc, alvo: v }), { placeholder: "ex.: 50", "aria-label": "Alvo de proteína" })}
        </div>
        {po && (
          <div style={{ fontSize: 14, lineHeight: 1.55 }} data-testid="resultado-porcao">
            <div>Porções no pote: <strong>{po.porcoes}</strong>. Proteína no pote: <strong>~{po.proteinaNoPoteG} g</strong>.</div>
            <div>Proteína por grama de pó: {po.proteinaPorGramoDePo} g. Ou seja, o pó não é só proteína: a diferença é o peso de carboidrato, gordura e outros componentes.</div>
            {po.gramasDePoParaAlvo !== undefined && <div>Para chegar a <strong>{porc.alvo} g</strong> de proteína: <strong>{po.gramasDePoParaAlvo} g de pó</strong> (~{po.porcoesParaAlvo} porções).</div>}
          </div>
        )}
      </div>

      <div style={estilos.card ? { ...estilos.card, marginBottom: 12 } : { marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: LIME, marginBottom: 4 }}>3. Comparador de rótulos</div>
        <div style={{ fontSize: 12.5, opacity: 0.8, marginBottom: 8 }}>Preencha manualmente os dados de dois produtos. Preço mais baixo não significa mais eficaz nem mais seguro.</div>
        {["a", "b"].map((k) => (
          <div key={k} style={{ borderTop: k === "b" ? "1px solid rgba(128,128,128,0.25)" : "none", paddingTop: k === "b" ? 10 : 0, marginTop: k === "b" ? 10 : 0 }}>
            <Campo rotulo="Nome do produto">
              <input type="text" value={rot[k].nome} onChange={(e) => setRot({ ...rot, [k]: { ...rot[k], nome: e.target.value } })} style={entrada} aria-label={"Nome do produto " + k.toUpperCase()} />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {campoNum("Preço (R$)", rot[k].preco, (v) => setRot({ ...rot, [k]: { ...rot[k], preco: v } }), { "aria-label": "Preço " + k.toUpperCase() })}
              {campoNum("Peso líquido (g)", rot[k].peso, (v) => setRot({ ...rot, [k]: { ...rot[k], peso: v } }), { "aria-label": "Peso líquido " + k.toUpperCase() })}
              {campoNum("Porção (g)", rot[k].porcao, (v) => setRot({ ...rot, [k]: { ...rot[k], porcao: v } }), { "aria-label": "Porção " + k.toUpperCase() })}
              {campoNum("Proteína por porção (g, opcional)", rot[k].prot, (v) => setRot({ ...rot, [k]: { ...rot[k], prot: v } }), { "aria-label": "Proteína por porção " + k.toUpperCase() })}
              {campoNum("Ingrediente ativo por 100 g (g, opcional)", rot[k].ativo, (v) => setRot({ ...rot, [k]: { ...rot[k], ativo: v } }), { "aria-label": "Ativo por 100 g " + k.toUpperCase() })}
            </div>
          </div>
        ))}
        {(ra || rb) && (
          <div style={{ overflowX: "auto", marginTop: 12 }} data-testid="resultado-rotulos">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr><th style={{ textAlign: "left", padding: 6 }}>Resultado</th><th style={{ textAlign: "left", padding: 6 }}>{rot.a.nome}</th><th style={{ textAlign: "left", padding: 6 }}>{rot.b.nome}</th></tr></thead>
              <tbody>
                {[
                  ["Porções", (r) => r && r.porcoes],
                  ["Custo por porção (R$)", (r) => r && r.custoPorPorcao],
                  ["Custo por g de proteína (R$)", (r) => r && r.custoPorGramoProteina],
                  ["Custo por g de ativo (R$)", (r) => r && r.custoPorGramoAtivo],
                ].map(([rotulo, f]) => (
                  <tr key={rotulo}>
                    <td style={{ padding: 6, borderTop: "1px solid rgba(128,128,128,0.2)" }}>{rotulo}</td>
                    <td style={{ padding: 6, borderTop: "1px solid rgba(128,128,128,0.2)" }}>{f(ra) ?? "—"}</td>
                    <td style={{ padding: 6, borderTop: "1px solid rgba(128,128,128,0.2)" }}>{f(rb) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={estilos.card ? { ...estilos.card, marginBottom: 12 } : { marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: LIME, marginBottom: 4 }}>4. Cafeína somada</div>
        <div style={{ fontSize: 12.5, opacity: 0.8, marginBottom: 8 }}>Some a cafeína de tudo que você tomou no dia (café, chá, energéticos, pré-treino). Não é uma dose personalizada.</div>
        {caf.map((x, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, marginBottom: 6 }}>
            <input type="text" value={x.nome} onChange={(e) => setCaf(caf.map((y, j) => (j === i ? { ...y, nome: e.target.value } : y)))} style={entrada} aria-label={"Produto com cafeína " + (i + 1)} />
            <input type="text" inputMode="decimal" value={x.mg} onChange={(e) => setCaf(caf.map((y, j) => (j === i ? { ...y, mg: num(e.target.value) } : y)))} style={entrada} aria-label={"mg por porção " + (i + 1)} placeholder="mg" />
            <input type="text" inputMode="decimal" value={x.porcoes} onChange={(e) => setCaf(caf.map((y, j) => (j === i ? { ...y, porcoes: num(e.target.value) } : y)))} style={entrada} aria-label={"Porções " + (i + 1)} placeholder="porções" />
            <button type="button" onClick={() => setCaf(caf.filter((_, j) => j !== i))} aria-label={"Remover " + (i + 1)} style={{ ...entrada, width: "auto", cursor: "pointer" }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setCaf(caf.concat([{ nome: "", mg: "", porcoes: "1" }]))} style={{ ...chip(false), marginBottom: 8 }}>+ Adicionar produto</button>
        {cafe && (
          <div style={{ fontSize: 14, lineHeight: 1.55 }} data-testid="resultado-cafeina">
            <div>Total no dia: <strong>{cafe.totalMg} mg</strong>.</div>
            {CONTEUDO_REVISADO && cafe.alertas.indexOf("acima_adulto") >= 0 && <div style={{ color: "#FFB1A8" }}>Acima de 400 mg/dia (referência para adultos saudáveis, EFSA 2015). Reduza as fontes.</div>}
            {CONTEUDO_REVISADO && cafe.alertas.indexOf("acima_gestante") >= 0 && <div>Acima de 200 mg/dia, limite de referência para gestantes. Converse com o médico.</div>}
            {CONTEUDO_REVISADO && <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 6 }}>Evite cafeína à tarde e à noite se ela atrapalha seu sono. Não use para crianças e adolescentes.</div>}
          </div>
        )}
      </div>
    </div>
  );

  // ---------- Favoritos ----------
  const telaFavs = (
    <div>
      {aviso}
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Favoritos ({favs.length})</div>
      {favs.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.8, marginBottom: 14 }}>Toque na estrela ☆ de um suplemento no catálogo para salvá-lo aqui.</div>}
      {favs.map((id) => porId[id]).filter(Boolean).map((s) => cartaoItem(s))}
      <div style={{ fontWeight: 700, margin: "16px 0 6px" }}>Vistos recentemente</div>
      {hist.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.8 }}>Nenhum item visualizado ainda.</div>}
      {hist.map((id) => porId[id]).filter(Boolean).map((s) => cartaoItem(s))}
      {hist.length > 0 && (
        <button type="button" onClick={() => { setHist([]); gravarLista(CHAVE_HIST, []); }} style={{ ...chip(false), marginTop: 10 }}>Limpar histórico</button>
      )}
    </div>
  );

  // ---------- Início ----------
  const resumoEvidencia = useMemo(() => {
    const cont = { "Forte": 0, "Moderada": 0, "Limitada": 0, "Insuficiente": 0, "Ausência de benefício relevante": 0 };
    let pendentes = 0;
    SUPLEMENTOS.forEach((s) => {
      const m = MATRIZ[s.id];
      if (!m) { pendentes += 1; return; }
      Object.values(m.objetivos).forEach((n) => { cont[n] = (cont[n] || 0) + 1; });
    });
    const comAvaliacao = SUPLEMENTOS.length - pendentes;
    return { cont, pendentes, comAvaliacao, total: SUPLEMENTOS.length };
  }, []);

  const telaInicio = (
    <div>
      <div style={{ padding: "6px 0 12px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{tr("Suplementos com base científica")}</div>
        <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 6, lineHeight: 1.5 }}>
          {tr("Para cada suplemento você encontra o que é, para que serve, o nível de evidência por objetivo, doses de referência, cuidados e fontes. Tudo funciona no aparelho, sem IA.")}
        </div>
      </div>

      <CampoBuscaInteligente
        value={busca}
        onChange={(v) => setBusca(v)}
        onEscolher={(sg) => { setBusca(sg.nome); setAba("catalogo"); }}
        placeholder={tr("Buscar suplemento, sinônimo ou finalidade")}
        ariaLabel={tr("Buscar suplemento")}
        estilo={{ ...entrada, fontSize: 16, padding: "13px 14px", marginBottom: 14 }}
      />

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{tr("Explorar por categoria")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {CATEGORIAS.map((c) => {
          const n = SUPLEMENTOS.filter((s) => s.categoria === c).length;
          return (
            <button key={c} type="button" onClick={() => { setCategoria(c); setAba("catalogo"); }} style={{ textAlign: "left", background: "rgba(128,128,128,0.12)", border: "1px solid rgba(128,128,128,0.3)", borderRadius: 12, padding: "12px", cursor: "pointer", color: "inherit" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{tr(c)}</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{n} {n === 1 ? tr("item") : tr("itens")}</div>
            </button>
          );
        })}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{tr("Atalhos")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setAba("comparar")} style={chip(false)}>⚖️ {tr("Comparar")}</button>
        <button type="button" onClick={() => setAba("calc")} style={chip(false)}>🧮 {tr("Calculadoras")}</button>
        <button type="button" onClick={() => setAba("favoritos")} style={chip(false)}>★ {tr("Favoritos")}</button>
      </div>

      {CONTEUDO_REVISADO && <div style={{ background: "rgba(128,128,128,0.12)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{tr("Resumo da evidência")}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {resumoEvidencia.comAvaliacao} {tr("de")} {resumoEvidencia.total} {tr("itens têm evidência avaliada por objetivo")}; {resumoEvidencia.pendentes} {tr("ainda estão pendentes de revisão.")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {NIVEIS.map((n) => (
            <Badge key={n} texto={n + ": " + (resumoEvidencia.cont[n] || 0)} cor={COR_EVIDENCIA_GERAL[n] || "#4A5568"} />
          ))}
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 8 }}>{tr("Contagem de células (item × objetivo) já avaliadas. A classificação é do estado atual da revisão.")}</div>
      </div>}

      {aviso}
    </div>
  );

  // ---------- Rótulos e qualidade ----------
  const telaRotulos = (
    <div>
      <div style={{ background: "rgba(167,255,0,0.08)", border: "1px solid rgba(167,255,0,0.3)", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>{AVISO_ROTULOS}</div>
      {SECOES_ROTULOS.map((sec) => (
        <details key={sec.titulo} style={{ borderTop: "1px solid rgba(128,128,128,0.25)", padding: "10px 0" }}>
          <summary style={{ fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{sec.titulo}</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55 }}>
            {sec.itens.map((t, i) => <li key={i} style={{ marginBottom: 6 }}>{t}</li>)}
          </ul>
        </details>
      ))}
    </div>
  );

  // ---------- Diário (registro pessoal, sem recomendação) ----------
  const nomesPorId = useMemo(() => Object.fromEntries(SUPLEMENTOS.map((s) => [s.id, s.nome])), []);
  const salvarDiario = (lista) => { setDiario(lista); gravarLista(CHAVE_DIARIO, lista); };
  const adicionarRegistro = () => {
    const erros = validarRegistro(formD);
    setErrosD(erros);
    if (erros.length) return;
    const novo = { id: "d" + Date.now().toString(36), suplementoId: formD.suplementoId, data: formD.data, dose: formD.dose.trim(), obs: formD.obs.trim() };
    salvarDiario([novo].concat(diario));
    setFormD({ ...formD, dose: "", obs: "" });
  };
  const removerRegistro = (id) => salvarDiario(diario.filter((r) => r.id !== id));
  const telaDiario = (
    <div>
      <div style={{ background: "rgba(128,128,128,0.12)", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>{tr(AVISO_DIARIO)}</div>
      <Campo rotulo="Suplemento">
        <select value={formD.suplementoId} onChange={(e) => setFormD({ ...formD, suplementoId: e.target.value })} style={entrada} aria-label="Suplemento do registro">
          <option value="">Escolha um suplemento</option>
          {SUPLEMENTOS.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </Campo>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Campo rotulo="Data">
          <input type="date" value={formD.data} onChange={(e) => setFormD({ ...formD, data: e.target.value })} style={entrada} aria-label="Data do registro" />
        </Campo>
        <Campo rotulo="Dose que você usou (opcional)">
          <input type="text" value={formD.dose} maxLength={60} onChange={(e) => setFormD({ ...formD, dose: e.target.value })} placeholder="ex.: 5 g" style={entrada} aria-label="Dose registrada" />
        </Campo>
      </div>
      <Campo rotulo="Observação (opcional)">
        <input type="text" value={formD.obs} maxLength={200} onChange={(e) => setFormD({ ...formD, obs: e.target.value })} style={entrada} aria-label="Observação do registro" />
      </Campo>
      {errosD.length > 0 && <div role="alert" style={{ color: "#FFB1A8", fontSize: 13, marginBottom: 8 }}>{errosD.join(" ")}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={adicionarRegistro} style={{ ...chip(true), flex: 1 }}>Adicionar registro</button>
        {diario.length > 0 && <button type="button" onClick={() => baixarCsv("diario-suplementos.csv", csvDiario(diario, nomesPorId))} style={{ ...chip(false), flex: 1 }}>📊 Exportar planilha</button>}
      </div>
      {diario.length === 0 && <div style={{ fontSize: 13.5, opacity: 0.8 }}>Nenhum registro ainda.</div>}
      {agruparPorData(diario).map((grupo) => (
        <div key={grupo.data} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{grupo.data.slice(8, 10)}/{grupo.data.slice(5, 7)}/{grupo.data.slice(0, 4)}</div>
          {grupo.itens.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderTop: "1px solid rgba(128,128,128,0.2)", padding: "6px 0", fontSize: 13.5 }}>
              <span>{nomesPorId[r.suplementoId] || r.suplementoId}{r.dose ? " · " + r.dose : ""}{r.obs ? " — " + r.obs : ""}</span>
              <button type="button" onClick={() => removerRegistro(r.id)} aria-label={"Remover " + (nomesPorId[r.suplementoId] || "registro")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: 0.7 }}>✕</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const conteudo = { inicio: telaInicio, diario: telaDiario, rotulos: telaRotulos, catalogo: telaCatalogo, comparar: telaComparar, calc: telaCalc, favoritos: telaFavs }[aba];

  return (
    <div role="dialog" aria-label={tr("Central de suplementos")} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100vh", maxHeight: "100vh", boxSizing: "border-box", zIndex: 3000, background: "#101214", color: "#F2F4F6", display: "flex", flexDirection: "column", margin: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid rgba(128,128,128,0.3)", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: LIME }}>{tr("Central de suplementos")}</div>
        <button type="button" onClick={onFechar} style={{ background: "transparent", color: "inherit", border: "1px solid rgba(128,128,128,0.5)", borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}>✕ {tr("Fechar")}</button>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 12px", overflowX: "auto", flexShrink: 0 }} role="tablist">
        {ABAS.map(([k, rotulo]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} style={chip(aba === k)}>{tr(rotulo)}{k === "favoritos" && favs.length ? " (" + favs.length + ")" : ""}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 14px 24px" }}>{conteudo}</div>
    </div>
  );
}
