// MASSI PRO — Evolução 360 (cálculos locais, sem IA e sem internet).
// Junta o que o app já guarda: treinos concluídos, peso e medidas, passos, check-ins e perfil da Rotina Inteligente.
// Tudo aqui são ESTIMATIVAS para acompanhamento. Nada é diagnóstico médico nem promessa de resultado.

const MS_DIA = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const hojeISO = (d) => { const x = d || new Date(); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
const ehData = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
const utc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const diasEntre = (a, b) => Math.round((utc(b) - utc(a)) / MS_DIA);
export function somarDias(iso, n) { const d = new Date(utc(iso) + n * MS_DIA); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const arred = (n, c) => { const f = Math.pow(10, c || 0); return Math.round(n * f) / f; };
const limitar = (n, a, b) => Math.max(a, Math.min(b, n));
export const fmt = (n, c) => (n === null || n === undefined || !isFinite(n) ? "—" : arred(n, c === undefined ? 1 : c).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: c === undefined ? 1 : c }));

const lista = (v) => (Array.isArray(v) ? v : []);
function treinosValidos(historico, hoje) {
  return lista(historico).filter((h) => h && ehData(h.data) && h.data <= hoje).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}
const ehMusculacao = (h) => !h.arLivre && Number(h.totalExercicios) > 0;

// ---------- treinos ----------
export function resumoTreinos(historico, hoje) {
  const todos = treinosValidos(historico, hoje);
  const ini28 = somarDias(hoje, -27), ini56 = somarDias(hoje, -55);
  const u = todos.filter((h) => h.data >= ini28);
  const a = todos.filter((h) => h.data >= ini56 && h.data < ini28);
  const soma = (l, k) => l.reduce((s, h) => s + (num(h[k]) || 0), 0);
  const ultimo = todos.length ? todos[todos.length - 1] : null;
  return {
    total: todos.length,
    ult28: u.length, ant28: a.length,
    mediaSemana: arred(u.length / 4, 1), mediaSemanaAnt: arred(a.length / 4, 1),
    variacao: a.length ? arred(((u.length - a.length) / a.length) * 100, 0) : null,
    volume28: Math.round(soma(u.filter(ehMusculacao), "volumeTotal")), volumeAnt28: Math.round(soma(a.filter(ehMusculacao), "volumeTotal")),
    diasDesdeUltimo: ultimo ? diasEntre(ultimo.data, hoje) : null,
    treinosUltimos7: todos.filter((h) => h.data >= somarDias(hoje, -6)).length,
  };
}

// ---------- peso e medidas ----------
function regressao(pontos) { // pontos: [{x, y}] -> { a (inclinação), b }
  const n = pontos.length; if (n < 2) return null;
  const mx = media(pontos.map((p) => p.x)), my = media(pontos.map((p) => p.y));
  let sxx = 0, sxy = 0;
  pontos.forEach((p) => { sxx += (p.x - mx) * (p.x - mx); sxy += (p.x - mx) * (p.y - my); });
  if (sxx === 0) return null;
  const a = sxy / sxx; return { a, b: my - a * mx };
}
function serieDe(avaliacoes, campo, hoje, janela) {
  return lista(avaliacoes).filter((x) => x && ehData(x.data) && x.data <= hoje && num(x[campo]) !== null && num(x[campo]) > 0)
    .map((x) => ({ data: x.data, v: num(x[campo]) })).sort((p, q) => (p.data < q.data ? -1 : 1)).filter((x) => (janela ? diasEntre(x.data, hoje) <= janela : true));
}
export function tendenciaPeso(avaliacoes, hoje) {
  const todas = serieDe(avaliacoes, "peso", hoje, 0);
  if (!todas.length) return null;
  const s = serieDe(avaliacoes, "peso", hoje, 90);
  const ultimo = todas[todas.length - 1], primeiro = todas[0];
  const base = { n: todas.length, ultimo: ultimo.v, dataUltimo: ultimo.data, primeiro: primeiro.v, variacaoTotal: arred(ultimo.v - primeiro.v, 1), diasDesdeUltimo: diasEntre(ultimo.data, hoje), serie: todas };
  if (s.length >= 3 && diasEntre(s[0].data, s[s.length - 1].data) >= 10) {
    const r = regressao(s.map((p) => ({ x: diasEntre(s[0].data, p.data), y: p.v })));
    if (r) return { ...base, kgPorSemana: arred(r.a * 7, 2), delta30: arred(r.a * 30, 1), confiavel: true };
  }
  return { ...base, kgPorSemana: null, delta30: null, confiavel: false };
}
export function medidasVariacao(avaliacoes, hoje) {
  const nomes = { cintura: "Cintura", quadril: "Quadril", peito: "Peito", braco: "Braço", coxa: "Coxa" };
  const out = [];
  Object.keys(nomes).forEach((k) => {
    const s = serieDe(avaliacoes, k, hoje, 0);
    if (s.length >= 2 && diasEntre(s[0].data, s[s.length - 1].data) >= 7) out.push({ chave: k, nome: nomes[k], de: s[0].v, para: s[s.length - 1].v, delta: arred(s[s.length - 1].v - s[0].v, 1) });
  });
  return out;
}

// ---------- passos ----------
export function resumoPassos(passos, hoje) {
  const reg = passos && typeof passos === "object" ? passos : {};
  const pega = (de, ate) => { const v = []; for (let d = de; d <= ate; d = somarDias(d, 1)) { const n = num(reg[d]); if (n !== null && n > 0) v.push(n); } return v; };
  const u = pega(somarDias(hoje, -6), hoje), a = pega(somarDias(hoje, -13), somarDias(hoje, -7));
  return { media7: u.length ? Math.round(media(u)) : null, dias7: u.length, mediaAnt7: a.length ? Math.round(media(a)) : null };
}

// ---------- estagnação e grupos musculares ----------
export function estagnacao(historico, hoje) {
  const todos = treinosValidos(historico, hoje).filter((h) => ehMusculacao(h) && h.data >= somarDias(hoje, -55));
  const porFoco = {};
  todos.forEach((h) => { const v = num(h.volumeTotal); if (v && v > 0 && h.foco) (porFoco[h.foco] = porFoco[h.foco] || []).push(v); });
  const focos = Object.keys(porFoco).filter((f) => porFoco[f].length >= 3).map((f) => {
    const v = porFoco[f].slice(-3);
    const status = v[2] > v[0] * 1.05 ? "evoluindo" : Math.max(v[1], v[2]) <= v[0] * 1.02 ? "estagnado" : "estavel";
    return { foco: f, status, de: Math.round(v[0]), para: Math.round(v[2]) };
  });
  const porEx = {};
  todos.forEach((h) => lista(h.cargasExercicios).forEach((e) => { const c = num(e && e.c); if (e && e.n && c && c > 0) (porEx[e.n] = porEx[e.n] || []).push(c); }));
  const exercicios = Object.keys(porEx).filter((n) => porEx[n].length >= 3).map((n) => ({ exercicio: n, ult: porEx[n].slice(-3) }))
    .filter((x) => x.ult[0] === x.ult[1] && x.ult[1] === x.ult[2]).map((x) => ({ exercicio: x.exercicio, carga: x.ult[2] }));
  return { focos, exercicios };
}
export function gruposNegligenciados(historico, hoje) {
  const todos = treinosValidos(historico, hoje).filter((h) => ehMusculacao(h) && h.data >= somarDias(hoje, -55));
  const visto = {}, recente = {};
  todos.forEach((h) => {
    const at = h.ativacaoMusculos && typeof h.ativacaoMusculos === "object" ? h.ativacaoMusculos : {};
    Object.keys(at).forEach((g) => { visto[g] = (visto[g] || 0) + (at[g] === "forte" ? 1 : 0.5); if (h.data >= somarDias(hoje, -13)) recente[g] = true; });
  });
  return Object.keys(visto).filter((g) => visto[g] >= 2 && !recente[g]);
}

// ---------- recuperação (orientação, não é diagnóstico) ----------
export function recuperacao({ historico, checkins, perfilRI }, hoje) {
  const todos = treinosValidos(historico, hoje);
  const u7 = todos.filter((h) => h.data >= somarDias(hoje, -6));
  const duros = u7.filter((h) => /dif[ií]cil|pesad|exaust|cans/i.test(String(h.sentimento || "")));
  const ck = lista(checkins).filter((c) => c && ehData(c.data) && diasEntre(c.data, hoje) <= 21 && diasEntre(c.data, hoje) >= 0).sort((a, b) => (a.data < b.data ? -1 : 1));
  const ult = ck.length ? ck[ck.length - 1] : null;
  const p = perfilRI || {};
  const temInfo = !!(ult || p.sono || p.horasSono || u7.length);
  if (!temInfo) return { nivel: null, pontos: null, motivos: [], dica: "Faça um check-in na Rotina Inteligente ou conclua treinos para ver sua recuperação." };
  let pts = 100; const m = [];
  const tira = (n, txt) => { pts -= n; m.push(txt); };
  if (p.sono === "Ruim") tira(20, "sono ruim"); else if (p.sono === "Regular") tira(8, "sono regular");
  const h = num(p.horasSono); if (h !== null) { if (h < 6) tira(12, "poucas horas de sono"); else if (h < 7) tira(5, "sono um pouco curto"); }
  if (ult) {
    if (ult.recuperacao === "Ruim") tira(25, "recuperação ruim no último check-in"); else if (ult.recuperacao === "Regular") tira(10, "recuperação regular no último check-in");
    if (ult.disposicao === "Baixa") tira(15, "disposição baixa"); else if (ult.disposicao === "Média") tira(5, "disposição média");
  }
  if (p.dorMuscularLonga === "Sim") tira(12, "dores musculares prolongadas"); else if (p.dorMuscularLonga === "Às vezes") tira(5, "dores musculares às vezes");
  if (p.recuperacaoDificil === "Sim") tira(12, "dificuldade de se recuperar entre treinos");
  if (u7.length >= 6) tira(15, u7.length + " treinos em 7 dias"); else if (u7.length === 5) tira(6, "5 treinos em 7 dias");
  if (duros.length >= 3) tira(15, "vários treinos pesados seguidos"); else if (duros.length === 2) tira(7, "treinos pesados recentes");
  pts = limitar(Math.round(pts), 0, 100);
  const nivel = pts >= 75 ? "favoravel" : pts >= 50 ? "atencao" : "priorizar";
  return { nivel, pontos: pts, motivos: m, treinos7: u7.length };
}

// ---------- simulador 30/60/90 (estimativa) ----------
export function tipoDeObjetivo(txt) {
  const t = String(txt || "").toLowerCase();
  if (/perd|emagre|defin|gordura|secar/.test(t)) return "perder";
  if (/ganh|massa|hipert|volume/.test(t)) return "ganhar";
  return "manter";
}
export function projecao(avaliacoes, objetivo, hoje) {
  const t = tendenciaPeso(avaliacoes, hoje);
  if (!t || !t.confiavel) return { ok: false, motivo: "Para projetar, registre o peso pelo menos 3 vezes em 2 semanas ou mais (Peso e medidas).", n: t ? t.n : 0 };
  const tipo = tipoDeObjetivo(objetivo);
  const limite = Math.abs(t.ultimo) * 0.01; // no máximo ~1% do peso por semana (limite de segurança da estimativa)
  const porSemana = limitar(t.kgPorSemana, -limite, limite * 0.5);
  const porDia = porSemana / 7;
  const recentes = t.serie.filter((x) => diasEntre(x.data, hoje) <= 30).length;
  const confianca = t.n >= 6 && recentes >= 3 ? "média" : "baixa";
  const cenarios = [30, 60, 90].map((d) => {
    const est = t.ultimo + porDia * d;
    const a = t.ultimo + porDia * 0.5 * d, b = t.ultimo + porDia * 1.25 * d;
    return { dias: d, estimado: arred(est, 1), min: arred(Math.min(a, b), 1), max: arred(Math.max(a, b), 1) };
  });
  let nota = "";
  if (tipo === "perder" && porSemana > -0.03) nota = "No ritmo atual, o peso não está caindo. Reveja alimentação e constância antes de mudar metas.";
  else if (tipo === "ganhar" && porSemana < 0.03) nota = "No ritmo atual, o peso não está subindo. Pode faltar comida ou constância.";
  else if (tipo === "manter" && Math.abs(porSemana) > 0.15) nota = "O peso está variando mais do que o esperado para manter.";
  return { ok: true, ultimo: t.ultimo, dataUltimo: t.dataUltimo, kgPorSemana: arred(porSemana, 2), tipo, confianca, cenarios, nota, serie: t.serie.filter((x) => diasEntre(x.data, hoje) <= 90) };
}

// ---------- painel 360 ----------
export function evolucao360(dados, hoje) {
  const d = dados || {};
  const meta = Math.max(1, Math.min(7, num(d.metaSemana) || 3));
  const tr = resumoTreinos(d.historico, hoje);
  const peso = tendenciaPeso(d.avaliacoes, hoje);
  const med = medidasVariacao(d.avaliacoes, hoje);
  const pas = resumoPassos(d.passos, hoje);
  const est = estagnacao(d.historico, hoje);
  const neg = gruposNegligenciados(d.historico, hoje);
  const rec = recuperacao({ historico: d.historico, checkins: d.checkins, perfilRI: d.perfilRI }, hoje);
  const tipo = tipoDeObjetivo(d.objetivo);
  const positivos = [], melhorar = [], sugestoes = [];

  if (tr.total === 0) melhorar.push("Ainda não há treinos concluídos registrados.");
  else {
    if (tr.mediaSemana >= meta * 0.85) positivos.push("Constância: média de " + fmt(tr.mediaSemana) + " treinos por semana nas últimas 4 semanas.");
    else if (tr.mediaSemana < meta * 0.6) { melhorar.push("Constância: média de " + fmt(tr.mediaSemana) + " treinos por semana (sua meta é " + meta + ")."); sugestoes.push("Escolha dias fixos e horários para treinar; começar com " + Math.max(2, Math.round(meta * 0.7)) + " dias por semana ajuda a criar o hábito."); }
    if (tr.variacao !== null && tr.variacao >= 15) positivos.push("Você treinou " + tr.variacao + "% mais do que nas 4 semanas anteriores.");
    if (tr.variacao !== null && tr.variacao <= -25) melhorar.push("Você treinou " + Math.abs(tr.variacao) + "% menos do que nas 4 semanas anteriores.");
    if (tr.volumeAnt28 > 0 && tr.volume28 > tr.volumeAnt28 * 1.1) positivos.push("O volume de carga levantada subiu " + Math.round(((tr.volume28 - tr.volumeAnt28) / tr.volumeAnt28) * 100) + "% em relação ao período anterior.");
    if (tr.volumeAnt28 > 0 && tr.volume28 < tr.volumeAnt28 * 0.85) melhorar.push("O volume de carga levantada caiu em relação ao período anterior.");
    if (tr.diasDesdeUltimo !== null && tr.diasDesdeUltimo >= 5) { melhorar.push("Faz " + tr.diasDesdeUltimo + " dias desde o último treino."); sugestoes.push("Retome com um treino mais leve e reorganize a semana na aba Rotina."); }
  }
  est.focos.filter((f) => f.status === "evoluindo").forEach((f) => positivos.push("Treino de " + f.foco + ": volume subindo (" + f.de.toLocaleString("pt-BR") + " → " + f.para.toLocaleString("pt-BR") + " kg)."));
  est.focos.filter((f) => f.status === "estagnado").forEach((f) => { melhorar.push("Treino de " + f.foco + ": volume parado nas últimas 3 vezes."); sugestoes.push("Em " + f.foco + ", tente subir a carga em 2 a 5% ou 1 repetição por série quando fechar todas as séries."); });
  est.exercicios.slice(0, 3).forEach((e) => { melhorar.push(e.exercicio + ": mesma carga (" + fmt(e.carga) + " kg) nas últimas 3 vezes."); });
  if (neg.length) { melhorar.push("Grupos sem treino há mais de 2 semanas: " + neg.slice(0, 4).join(", ") + "."); sugestoes.push("Inclua " + neg[0] + " na próxima semana ou veja um treino que cubra esse grupo."); }

  if (peso) {
    if (peso.confiavel) {
      const dt = peso.delta30;
      if (tipo === "perder") { if (dt <= -0.3) positivos.push("Peso: tendência de " + fmt(dt) + " kg em 30 dias, na direção do seu objetivo."); else if (dt >= 0.3) melhorar.push("Peso: tendência de +" + fmt(dt) + " kg em 30 dias, contra o objetivo de perder gordura."); }
      else if (tipo === "ganhar") { if (dt >= 0.3) positivos.push("Peso: tendência de +" + fmt(dt) + " kg em 30 dias, na direção do seu objetivo."); else if (dt <= -0.3) melhorar.push("Peso: tendência de " + fmt(dt) + " kg em 30 dias, contra o objetivo de ganhar massa."); }
      else if (Math.abs(dt) <= 0.5) positivos.push("Peso estável nos últimos 30 dias.");
    }
    if (peso.diasDesdeUltimo >= 21) { melhorar.push("Seu último peso foi registrado há " + peso.diasDesdeUltimo + " dias."); sugestoes.push("Atualize seu peso e medidas em Peso e medidas para o acompanhamento ficar preciso."); }
  } else sugestoes.push("Registre seu peso e medidas para liberar gráficos e o simulador de evolução.");
  med.filter((x) => x.chave === "cintura").forEach((x) => { if (x.delta <= -1) positivos.push("Cintura: " + fmt(x.delta) + " cm desde o primeiro registro."); else if (x.delta >= 1.5 && tipo === "perder") melhorar.push("Cintura: +" + fmt(x.delta) + " cm desde o primeiro registro."); });

  if (pas.media7 !== null) {
    if (pas.media7 >= 7000) positivos.push("Passos: média de " + pas.media7.toLocaleString("pt-BR") + " por dia nesta semana.");
    else if (pas.media7 < 4000) { melhorar.push("Passos: média de " + pas.media7.toLocaleString("pt-BR") + " por dia nesta semana."); sugestoes.push("Uma caminhada de 15 minutos após as refeições soma mais de 3.000 passos por dia."); }
  }
  if (rec.nivel === "priorizar") { melhorar.push("Recuperação: sinais de que vale priorizar o descanso."); sugestoes.push("Reduza uma série por exercício por alguns dias e cuide do sono."); }
  if (rec.nivel === "favoravel") positivos.push("Recuperação favorável pelos dados informados.");

  return {
    meta, treinos: tr, peso, medidas: med, passos: pas, estagnacao: est, negligenciados: neg, recuperacao: rec, tipoObjetivo: tipo,
    positivos: positivos.slice(0, 6), melhorar: melhorar.slice(0, 6), sugestoes: sugestoes.filter((x, i, a) => a.indexOf(x) === i).slice(0, 4),
    temDados: tr.total > 0 || !!peso || pas.media7 !== null,
  };
}
