// Home premium do Massi Pro.
// Só apresentação: todos os dados vêm do App (InicioTab) e nada aqui grava no armazenamento.
// Tradução: tr/trt chegam por props (são as mesmas funções do App).
// Imagens: o prop opcional `imagens` aceita { semana, recuperacao, motivacao } com URLs locais.
// Sem imagem, o cartão usa só gradiente.
import React, { useEffect, useState } from "react";

const LIMAO = "#C6FF4D";
const SUAVE = "#9AA3AE";
const VERMELHO = "#F0524F";
const AMBAR = "#F5A524";

const cartao = {
  background: "linear-gradient(160deg, rgba(27,32,38,0.96) 0%, rgba(17,20,25,0.96) 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
  padding: "13px 14px",
  marginBottom: 12,
  color: "#fff",
  boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
};
const tituloCartao = { fontSize: 14, fontWeight: 800, color: "#fff" };
const notaPequena = { fontSize: 11, color: SUAVE, lineHeight: 1.35 };

function comFoto(img, base) {
  if (!img) return base;
  return {
    ...base,
    backgroundImage: `linear-gradient(180deg, rgba(10,12,14,0.8) 0%, rgba(10,12,14,0.94) 100%), url(${img})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

function reduzMovimento() {
  try {
    return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

function fmt(n, locale) {
  return Number(n).toLocaleString(locale || undefined);
}
function fmtCompacto(n, locale) {
  const v = Number(n);
  if (v >= 10000) return Number(v / 1000).toLocaleString(locale || undefined, { maximumFractionDigits: 1 }) + "k";
  return fmt(v, locale);
}

// ---------------------------------------------------------------------------
// Leitura defensiva dos registros que o app já guarda (mesmos formatos do passosDeHoje)
// ---------------------------------------------------------------------------
function numeroValido(x) {
  return typeof x === "number" && isFinite(x) && x >= 0 ? x : null;
}
function valorDoItem(it) {
  if (numeroValido(it) !== null) return it;
  if (it && typeof it === "object") {
    for (const k of ["passos", "steps", "total", "quantidade", "qtd", "valor"]) {
      if (numeroValido(it[k]) !== null) return it[k];
    }
  }
  return null;
}

// Soma dos passos dos dias da semana que têm registro. Retorna null se não houver nenhum.
// datas: [{ local: "YYYY-MM-DD", utc: "YYYY-MM-DD" }]
export function passosDaSemana(valor, datas) {
  try {
    const v = typeof valor === "string" ? JSON.parse(valor) : valor;
    let soma = 0;
    let achou = false;
    (datas || []).forEach((d) => {
      const chaves = [d.local, d.utc];
      let val = null;
      if (Array.isArray(v)) {
        const it = v.find((x) => x && typeof x === "object" && chaves.indexOf(x.data || x.dia || x.date) >= 0);
        if (it) val = valorDoItem(it);
      } else if (v && typeof v === "object") {
        for (const c of chaves) {
          if (Object.prototype.hasOwnProperty.call(v, c)) {
            val = valorDoItem(v[c]);
            break;
          }
        }
      }
      if (val !== null) {
        soma += val;
        achou = true;
      }
    });
    return achou ? soma : null;
  } catch (e) {
    return null;
  }
}

// Meta diária de passos, se o contador já tiver uma salva no perfil. Senão, null (nada é inventado).
export function lerMetaPassos(perfil) {
  try {
    const v = typeof perfil === "string" ? JSON.parse(perfil) : perfil;
    if (!v || typeof v !== "object") return null;
    for (const k of Object.keys(v)) {
      if (/meta/i.test(k) && typeof v[k] === "number" && v[k] >= 1000 && v[k] <= 100000) return v[k];
    }
  } catch (e) {
    /* formato desconhecido */
  }
  return null;
}

// Calorias registradas hoje (mapa data -> lista de itens com kcal). Retorna null se não houver.
export function kcalDeHoje(mapa, chaves) {
  try {
    const v = typeof mapa === "string" ? JSON.parse(mapa) : mapa;
    if (!v || typeof v !== "object") return null;
    for (const c of chaves) {
      const lista = v[c];
      if (Array.isArray(lista) && lista.length > 0) {
        const soma = lista.reduce((a, it) => a + (it && typeof it.kcal === "number" && isFinite(it.kcal) ? it.kcal : 0), 0);
        return soma > 0 ? Math.round(soma) : null;
      }
    }
  } catch (e) {
    /* formato desconhecido */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Anel de progresso (o único movimento automático da Home: ele enche uma vez ao abrir)
// ---------------------------------------------------------------------------
function Anel({ valor, max, tamanho = 62, espessura = 7, cor = LIMAO, rotulo, children }) {
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, valor / max)) : 0;
  const parado = reduzMovimento();
  return (
    <div role="img" aria-label={rotulo} style={{ position: "relative", width: tamanho, height: tamanho, flexShrink: 0 }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={espessura} />
        {pct > 0 && (
          <circle
            cx={tamanho / 2}
            cy={tamanho / 2}
            r={r}
            fill="none"
            stroke={cor}
            strokeWidth={espessura}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={pronto || parado ? c * (1 - pct) : c}
            style={{ transition: parado ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.22, 0.8, 0.3, 1)" }}
          />
        )}
      </svg>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", lineHeight: 1.05 }}>
        {children}
      </div>
    </div>
  );
}

function Barra({ pct, cor = LIMAO }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }} aria-hidden="true">
      <div style={{ width: Math.max(2, Math.min(100, pct)) + "%", height: "100%", background: cor, borderRadius: 999 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Cabeçalho: saudação por horário, nome, frase do dia e acesso ao menu (Perfil e configurações)
// ---------------------------------------------------------------------------
export function HomeCabecalho({ tr, nome, frase, onMenu }) {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiro = String(nome || "").trim().split(/\s+/)[0];
  const inicial = primeiro ? primeiro.charAt(0).toUpperCase() : "M";
  return (
    <header data-testid="home-cabecalho" style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0 12px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
          {tr(saudacao)}
          {primeiro ? `, ${primeiro}` : ""}
        </div>
        {frase ? (
          <div style={{ fontSize: 12.5, color: SUAVE, marginTop: 3, lineHeight: 1.35 }}>
            {frase}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onMenu}
        aria-label={tr("Perfil e configurações")}
        data-testid="home-perfil"
        style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "50%", border: `1.5px solid ${LIMAO}`, background: "rgba(198,255,77,0.1)", color: LIMAO, fontWeight: 900, fontSize: 17, cursor: "pointer" }}
      >
        {inicial}
      </button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// 2. Meta semanal dentro do cartão principal
// ---------------------------------------------------------------------------
export function HomeMetaSemana({ tr, trt, feitos, meta }) {
  const total = Math.min(7, Math.max(1, meta));
  const batida = feitos >= meta;
  return (
    <div data-testid="home-meta-semana" style={{ margin: "9px 0 11px" }}>
      <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: i < feitos ? LIMAO : "rgba(255,255,255,0.18)" }} />
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: batida ? LIMAO : "#DDE3EA", marginTop: 5 }}>
        {batida ? tr("Meta da semana batida") : trt("{0} de {1} treinos na semana", [feitos, meta])}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Resumo do dia: anéis (treino de hoje, semana, passos, calorias se houver)
// ---------------------------------------------------------------------------
function Tile({ rotulo, sub, onClick, testid, children }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { type: "button", onClick } : {})}
      data-testid={testid}
      style={{ background: "none", border: "none", padding: "4px 0", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0, cursor: onClick ? "pointer" : "default", font: "inherit" }}
    >
      {children}
      <span style={{ fontSize: 12, fontWeight: 800 }}>{rotulo}</span>
      <span style={{ fontSize: 11, color: SUAVE, minHeight: 13, textAlign: "center", lineHeight: 1.2 }}>{sub}</span>
    </Comp>
  );
}

export function HomeResumoDia({ tr, trt, locale, hoje, semana, passos, kcal, onPassos, onDiario }) {
  const numStyle = (txt) => ({ fontSize: String(txt).length > 4 ? 12.5 : 15, fontWeight: 900, color: "#fff" });
  const tiles = [];

  tiles.push(
    <Tile key="hoje" testid="resumo-hoje" rotulo={tr("Hoje")} sub={hoje.estado === "feito" ? tr("Treino feito") : hoje.estado === "pendente" ? tr(hoje.foco || "Treino") : tr("Descanso")}>
      <Anel valor={hoje.estado === "feito" ? 1 : 0} max={1} rotulo={tr("Treino de hoje")}>
        <span style={{ fontSize: hoje.estado === "descanso" ? 20 : 17, fontWeight: 900, color: LIMAO }}>{hoje.estado === "feito" ? "✓" : hoje.estado === "descanso" ? "😌" : "0/1"}</span>
      </Anel>
    </Tile>
  );

  tiles.push(
    <Tile key="semana" testid="resumo-semana" rotulo={tr("Semana")} sub={tr("treinos")}>
      <Anel valor={semana.feitos} max={semana.meta} rotulo={trt("{0} de {1} treinos na semana", [semana.feitos, semana.meta])}>
        <span style={numStyle(`${semana.feitos}/${semana.meta}`)}>
          {semana.feitos}/{semana.meta}
        </span>
      </Anel>
    </Tile>
  );

  const temPassos = passos.valor !== null && passos.valor !== undefined;
  tiles.push(
    <Tile key="passos" testid="resumo-passos" rotulo={tr("Passos")} onClick={onPassos} sub={passos.meta ? trt("meta {0}", [fmtCompacto(passos.meta, locale)]) : temPassos ? "" : tr("Registrar")}>
      <Anel valor={temPassos ? passos.valor : 0} max={passos.meta || 0} cor="#4FCB6B" rotulo={tr("Passos")}>
        <span style={numStyle(temPassos ? fmtCompacto(passos.valor, locale) : "—")}>{temPassos ? fmtCompacto(passos.valor, locale) : "—"}</span>
      </Anel>
    </Tile>
  );

  if (kcal) {
    tiles.push(
      <Tile key="kcal" testid="resumo-kcal" rotulo={tr("Calorias")} onClick={onDiario} sub={tr("registradas")}>
        <Anel valor={0} max={0} rotulo={tr("Calorias")}>
          <span style={numStyle(fmtCompacto(kcal, locale))}>{fmtCompacto(kcal, locale)}</span>
        </Anel>
      </Tile>
    );
  }

  return (
    <section data-testid="home-resumo-diario" style={cartao}>
      <div style={{ ...tituloCartao, marginBottom: 8 }}>{tr("Resumo de hoje")}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 6 }}>{tiles}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Acessos rápidos (os itens, rotas e refs de tour vêm do App)
// ---------------------------------------------------------------------------
export function HomeAcessos({ tr, itens }) {
  return (
    <div data-testid="home-ferramentas" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
      {itens.map((f) => (
        <button
          key={f.id}
          ref={f.ref}
          type="button"
          onClick={f.onClick}
          data-testid={f.testid}
          aria-label={tr(f.nome)}
          style={{ minHeight: 84, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 2px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", background: "linear-gradient(160deg, rgba(27,32,38,0.96), rgba(17,20,25,0.96))", color: "#fff", cursor: "pointer" }}
        >
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(198,255,77,0.12)", border: "1px solid rgba(198,255,77,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{f.icone}</span>
          <span style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.15, textAlign: "center" }}>{tr(f.nome)}</span>
          {f.sub ? <span style={{ fontSize: 10.5, fontWeight: 700, color: LIMAO }}>{f.sub}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Evolução da semana: dias, comparação com a semana passada e totais
// ---------------------------------------------------------------------------
function barraDoDia(d) {
  if (d.concluido) return { h: "100%", bg: LIMAO, border: "none" };
  if (!d.planejado) return { h: "8%", bg: "rgba(255,255,255,0.14)", border: "none" };
  if (d.hoje) return { h: "62%", bg: "transparent", border: `1.5px dashed ${LIMAO}` };
  if (d.passado) return { h: "30%", bg: "rgba(240,82,79,0.45)", border: "none" };
  return { h: "45%", bg: "transparent", border: "1.5px solid rgba(255,255,255,0.25)" };
}

export function HomeSemana({ tr, trt, locale, dias, feitos, meta, passada, temComparacao, volume, volumePassada, passosSemana, ultimo, proximo, onVerRotina, imagem }) {
  const diff = feitos - passada;
  const stats = [{ id: "treinos", rotulo: tr("Treinos"), valor: `${feitos}/${meta}` }];
  if (volume > 0) {
    let delta = "";
    if (temComparacao && volumePassada > 0) {
      const pct = Math.round(((volume - volumePassada) / volumePassada) * 100);
      delta = (pct > 0 ? "+" : "") + pct + "%";
    }
    stats.push({ id: "volume", rotulo: tr("Volume"), valor: fmt(Math.round(volume), locale) + " kg", sub: delta });
  }
  if (passosSemana !== null && passosSemana !== undefined) stats.push({ id: "passos", rotulo: tr("Passos"), valor: fmt(passosSemana, locale) });

  return (
    <section data-testid="home-treinos" style={comFoto(imagem, cartao)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={tituloCartao}>{tr("Evolução da semana")}</div>
        {temComparacao ? (
          <span style={{ fontSize: 11.5, fontWeight: 800, color: diff > 0 ? LIMAO : diff < 0 ? AMBAR : SUAVE }}>
            {diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${Math.abs(diff)}` : "="} {tr("vs semana passada")}
          </span>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, margin: "12px 0 4px", alignItems: "end" }}>
        {dias.map((d) => {
          const b = barraDoDia(d);
          return (
            <div key={d.nome} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ height: 54, width: "100%", display: "flex", alignItems: "flex-end" }}>
                <div style={{ width: "100%", height: b.h, background: b.bg, border: b.border, borderRadius: 8, boxSizing: "border-box" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: d.hoje ? 900 : 700, color: d.hoje ? LIMAO : SUAVE }}>{String(tr(d.nome)).slice(0, 3)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 8, marginTop: 10 }}>
        {stats.map((s) => (
          <div key={s.id} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px 6px", textAlign: "center", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: SUAVE }}>{s.rotulo}</div>
            <div style={{ fontSize: 14, fontWeight: 900, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.valor}</div>
            <div style={{ fontSize: 11, color: LIMAO, fontWeight: 700, minHeight: 13 }}>{s.sub || ""}</div>
          </div>
        ))}
      </div>

      {ultimo || proximo ? (
        <div style={{ ...notaPequena, marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          {ultimo ? (
            <span>
              {tr("Último")}: {tr(ultimo.foco)} {ultimo.quando ? `(${ultimo.quando})` : ""}
            </span>
          ) : null}
          {proximo ? (
            <span>
              {tr("Próximo")}: {tr(proximo.foco)} ({proximo.hoje ? tr("hoje") : tr(proximo.dia)})
            </span>
          ) : null}
        </div>
      ) : (
        <div style={{ ...notaPequena, marginTop: 8 }}>{tr("Nenhum treino registrado ainda. Conclua o primeiro na Rotina e ele aparece aqui.")}</div>
      )}

      <button
        type="button"
        onClick={onVerRotina}
        data-testid="home-ver-treinos"
        style={{ width: "100%", marginTop: 10, minHeight: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}
      >
        {tr("Ver rotina")}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. Recuperação: estimativa pelo histórico de treinos (não é medição)
// ---------------------------------------------------------------------------
export function HomeRecuperacao({ tr, trt, regioes, regioesHoje, onVer, imagem }) {
  const emRecuperacao = regioes.filter((r) => r.dias !== null && r.dias < 2);
  const prontos = regioes.filter((r) => r.dias === null || r.dias >= 2);
  const conflitoHoje = regioesHoje.length > 0 && emRecuperacao.some((r) => regioesHoje.indexOf(r.regiao) >= 0);
  const nomes = (lista) => lista.slice(0, 3).map((r) => tr(r.label)).join(", ");

  let estado = "";
  let orientacao = "";
  let cor = LIMAO;
  if (regioes.length === 0) {
    estado = tr("Sem rotina montada");
    orientacao = tr("Monte sua rotina para acompanhar a recuperação por grupo muscular.");
    cor = SUAVE;
  } else if (emRecuperacao.length === 0) {
    estado = tr("Descansado");
    orientacao = tr("Todos os grupos da sua rotina já tiveram pelo menos 2 dias de descanso.");
  } else {
    estado = trt("Em recuperação: {0}", [nomes(emRecuperacao)]);
    cor = AMBAR;
    orientacao = conflitoHoje
      ? tr("O foco de hoje inclui um grupo treinado há pouco. Considere reduzir o volume ou variar.")
      : prontos.length > 0
      ? trt("Prontos para treinar: {0}.", [nomes(prontos)])
      : tr("Priorize descanso e sono hoje.");
  }

  return (
    <section data-testid="home-recuperacao" style={comFoto(imagem, cartao)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: cor, flexShrink: 0 }} aria-hidden="true" />
        <div style={tituloCartao}>{tr("Recuperação")}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, color: cor, margin: "8px 0 4px", lineHeight: 1.25 }}>{estado}</div>
      <div style={{ fontSize: 12.5, color: "#C9D1D9", lineHeight: 1.4 }}>{orientacao}</div>
      <div style={{ ...notaPequena, marginTop: 8 }}>{tr("Estimativa pelo seu histórico de treinos. Não é uma medição de saúde.")}</div>
      <button
        type="button"
        onClick={onVer}
        data-testid="home-ver-recuperacao"
        style={{ width: "100%", marginTop: 10, minHeight: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}
      >
        {tr("Ver detalhes")}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 7. Motivação: próxima conquista e desafio ativo (usa as medalhas e os desafios que já existem)
// ---------------------------------------------------------------------------
export function HomeMotivacao({ tr, trt, locale, conquista, desafio, onIrDesafios, imagem }) {
  const falta = conquista ? Math.max(0, conquista.valor - conquista.atual) : 0;
  const pertoDaMedalha = conquista && conquista.tipo !== "volume" && falta > 0 && falta <= 2;
  return (
    <section data-testid="home-motivacao" style={comFoto(imagem, cartao)}>
      <div style={tituloCartao}>{tr("Conquistas e desafios")}</div>

      {conquista ? (
        <div data-testid="home-proxima-conquista" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{conquista.emoji}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: SUAVE, fontWeight: 700 }}>{tr("Próxima conquista")}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{tr(conquista.label)}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: LIMAO, whiteSpace: "nowrap" }}>
              {fmt(Math.round(conquista.atual), locale)}/{fmt(conquista.valor, locale)}
            </span>
          </div>
          <div style={{ marginTop: 7 }}>
            <Barra pct={conquista.pct * 100} />
          </div>
          {pertoDaMedalha ? <div style={{ ...notaPequena, color: LIMAO, marginTop: 5 }}>{trt("Faltam só {0} para a próxima medalha.", [falta])}</div> : null}
        </div>
      ) : (
        <div style={{ ...notaPequena, marginTop: 10 }}>{tr("Você desbloqueou todas as medalhas. 🏆")}</div>
      )}

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "12px 0" }} />

      {desafio ? (
        <div data-testid="home-desafio-ativo">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{desafio.emoji}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: SUAVE, fontWeight: 700 }}>{tr("Desafio ativo")}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{tr(desafio.nome)}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: LIMAO, whiteSpace: "nowrap" }}>
              {fmt(desafio.progresso, locale)}/{fmt(desafio.meta, locale)} {tr(desafio.unidade)}
            </span>
          </div>
          <div style={{ marginTop: 7 }}>
            <Barra pct={desafio.pct * 100} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ ...notaPequena, flex: 1 }}>{tr("Nenhum desafio ativo. Escolha um no Cross para acompanhar o progresso aqui.")}</div>
          <button
            type="button"
            onClick={onIrDesafios}
            data-testid="home-ver-desafios"
            style={{ minHeight: 40, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(198,255,77,0.55)", background: "transparent", color: LIMAO, fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {tr("Ver desafios")}
          </button>
        </div>
      )}
    </section>
  );
}
