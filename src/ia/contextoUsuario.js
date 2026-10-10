// Monta o "resumo do usuário" que o assistente recebe a cada pergunta (só se o usuário permitir).
const corta = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + "…" : String(t));

function idadeDe(nascimento) {
  if (!nascimento || !/^\d{4}-\d{2}-\d{2}/.test(nascimento)) return null;
  const n = new Date(nascimento + "T12:00:00Z");
  const h = new Date();
  let idade = h.getUTCFullYear() - n.getUTCFullYear();
  if (h.getUTCMonth() < n.getUTCMonth() || (h.getUTCMonth() === n.getUTCMonth() && h.getUTCDate() < n.getUTCDate())) idade -= 1;
  return idade >= 5 && idade <= 110 ? idade : null;
}

export function montarContextoUsuario(d) {
  const linhas = [];
  const hoje = new Date();
  const diasPt = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  linhas.push("HOJE: " + diasPt[hoje.getDay()] + ", " + hoje.toISOString().slice(0, 10));

  // perfil
  const p = [];
  if (d.nome) p.push("primeiro nome: " + String(d.nome).split(" ")[0]);
  const idade = idadeDe(d.nascimento);
  if (idade) p.push("idade: " + idade);
  if (d.nivel) p.push("nível: " + d.nivel);
  if (d.objetivo) p.push("objetivo: " + (typeof d.objetivo === "object" ? d.objetivo.nome || d.objetivo.id || JSON.stringify(d.objetivo) : d.objetivo));
  if (d.restricoes && d.restricoes.length) p.push("RESTRIÇÕES FÍSICAS: " + d.restricoes.join(", "));
  const av = d.avaliacao;
  if (av) {
    if (av.peso) p.push("peso: " + av.peso + " kg");
    if (av.altura) p.push("altura: " + av.altura + " cm");
    if (av.sexo) p.push("sexo: " + av.sexo);
    if (av.percentualGordura) p.push("gordura corporal estimada: " + av.percentualGordura + "%");
  }
  linhas.push("PERFIL: " + (p.length ? p.join("; ") : "não informado"));

  // rotina
  const dias = (d.rotina || []).filter((x) => (d.diasSelecionados || []).indexOf(x.dia) >= 0 && x.foco !== "Descanso");
  if (dias.length) {
    linhas.push("ROTINA ATUAL (dias de treino):");
    dias.forEach((x) => {
      const ex = (x.exercicios || []).map((e) => e.name + " " + (e.sets || "?") + "x" + (e.reps || "?") + (e.maquina ? " (" + e.maquina + ")" : "") + (e.carga ? " carga " + e.carga : "")).join("; ");
      let cardio = "";
      if (x.cardio) cardio = " | cardio: " + x.cardio.tipo + " " + x.cardio.duracao + "min " + (x.cardio.intensidade || "");
      linhas.push("- " + x.dia + " — foco " + x.foco + ": " + (ex || "sem exercícios") + cardio);
    });
  } else linhas.push("ROTINA ATUAL: ainda não montada.");

  // histórico
  const hist = (d.historico || []).slice(-7);
  if (hist.length) {
    linhas.push("ÚLTIMOS TREINOS: " + hist.map((h) => h.data + " " + (h.foco || "") + (h.sentimento ? " (" + h.sentimento + ")" : "")).join(" | "));
  }
  if (d.indice) linhas.push("ÍNDICE MASSI: nível " + (d.indice.nivelIdx + 1) + " (" + d.indice.nomeNivel + "), " + d.indice.total + "/100 pontos, sequência " + (d.indice.streak || 0) + " dias");

  // biblioteca (só dos focos que aparecem na rotina) para o assistente sugerir trocas válidas
  if (d.biblioteca && dias.length) {
    const focos = Array.from(new Set(dias.map((x) => x.foco)));
    const bl = focos.map((f) => (d.biblioteca[f] ? f + ": " + d.biblioteca[f].map((e) => e.name).slice(0, 24).join(", ") : null)).filter(Boolean);
    if (bl.length) linhas.push("BIBLIOTECA DE EXERCÍCIOS (para trocas):\n" + bl.join("\n"));
  }
  return corta(linhas.join("\n"), 6500);
}
