// Ações que o assistente pode PROPOR (o usuário sempre confirma antes de aplicar).
export const ABAS_VALIDAS = ["inicio", "rotina", "historico", "notas", "evolucao", "sobre"];
const TIPOS = ["ir_aba", "trocar_exercicio", "ajustar_exercicio", "abrir_foto", "abrir_diario"];
const txt = (v, max) => String(v === undefined || v === null ? "" : v).replace(/[\u0000-\u001F]/g, " ").trim().slice(0, max || 80);

// Separa o texto da resposta do bloco <acoes>[...]</acoes>. Funciona também com a resposta pela metade (streaming).
export function separarAcoes(texto) {
  const t = String(texto || "");
  const i = t.search(/<acoes>/i);
  if (i < 0) return { texto: t.trimEnd(), acoes: [] };
  const limpo = t.slice(0, i).trimEnd();
  const resto = t.slice(i + 7);
  const fim = resto.search(/<\/acoes>/i);
  if (fim < 0) return { texto: limpo, acoes: [] }; // ainda chegando
  let lista = [];
  try { lista = JSON.parse(resto.slice(0, fim)); } catch (e) { lista = []; }
  const acoes = [];
  (Array.isArray(lista) ? lista : []).slice(0, 4).forEach((a) => {
    if (!a || TIPOS.indexOf(a.tipo) < 0) return;
    if (a.tipo === "ir_aba") {
      if (ABAS_VALIDAS.indexOf(a.aba) >= 0) acoes.push({ tipo: a.tipo, aba: a.aba });
    } else if (a.tipo === "trocar_exercicio") {
      if (a.dia && a.de && a.para) acoes.push({ tipo: a.tipo, dia: txt(a.dia, 20), de: txt(a.de), para: txt(a.para) });
    } else if (a.tipo === "ajustar_exercicio") {
      if (!a.dia || !a.exercicio) return;
      const campos = {};
      if (a.series !== undefined && isFinite(Number(a.series))) campos.sets = Math.max(1, Math.min(10, Math.round(Number(a.series))));
      if (a.reps !== undefined && txt(a.reps, 12)) campos.reps = txt(a.reps, 12);
      if (a.descanso !== undefined && txt(a.descanso, 12)) campos.descanso = txt(a.descanso, 12);
      if (Object.keys(campos).length) acoes.push({ tipo: a.tipo, dia: txt(a.dia, 20), exercicio: txt(a.exercicio), campos });
    } else acoes.push({ tipo: a.tipo });
  });
  return { texto: limpo, acoes };
}

const NOMES_ABA = { inicio: "Início", rotina: "Rotina", historico: "Histórico", notas: "Notas", evolucao: "Evolução", sobre: "Sobre" };

// Descrição curta da ação para o cartão (devolve chaves de tradução + valores).
export function descreverAcao(a) {
  switch (a.tipo) {
    case "ir_aba": return { icone: "➡️", chave: "Abrir a tela {0}", args: [NOMES_ABA[a.aba] || a.aba] };
    case "trocar_exercicio": return { icone: "🔁", chave: "{0}: trocar {1} por {2}", args: [a.dia, a.de, a.para] };
    case "ajustar_exercicio": {
      const partes = [];
      if (a.campos.sets) partes.push(a.campos.sets + " séries");
      if (a.campos.reps) partes.push(a.campos.reps + " reps");
      if (a.campos.descanso) partes.push("descanso " + a.campos.descanso);
      return { icone: "🛠️", chave: "{0}: ajustar {1} ({2})", args: [a.dia, a.exercicio, partes.join(", ")] };
    }
    case "abrir_foto": return { icone: "📷", chave: "Abrir o reconhecimento de alimentos por foto", args: [] };
    case "abrir_diario": return { icone: "🍽️", chave: "Abrir o diário alimentar", args: [] };
    default: return { icone: "•", chave: "Ação", args: [] };
  }
}

// Executa a ação usando as funções que o App fornece. Devolve { ok, msg, precisaSalvar }.
export function aplicarAcao(a, h) {
  try {
    switch (a.tipo) {
      case "ir_aba": h.irAba(a.aba); return { ok: true };
      case "trocar_exercicio": return h.trocarExercicio(a.dia, a.de, a.para);
      case "ajustar_exercicio": return h.ajustarExercicio(a.dia, a.exercicio, a.campos);
      case "abrir_foto": h.abrirFoto(); return { ok: true };
      case "abrir_diario": h.abrirDiario(); return { ok: true };
      default: return { ok: false, msg: "Ação desconhecida." };
    }
  } catch (e) {
    return { ok: false, msg: "Não consegui aplicar essa ação." };
  }
}
