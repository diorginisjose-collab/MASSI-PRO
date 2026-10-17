// Diário pessoal de suplementos: registro do que a pessoa tomou. O app NÃO recomenda doses.
export const AVISO_DIARIO = "Registro pessoal. O Massi Pro não recomenda doses: anote o que você usa e confira as orientações com um profissional.";

const escaparCsv = (v) => {
  const t = String(v === undefined || v === null ? "" : v).replace(/"/g, '""');
  return /[;"\n]/.test(t) ? '"' + t + '"' : t;
};

export function validarRegistro(r) {
  const erros = [];
  if (!r || !r.suplementoId) erros.push("Escolha um suplemento.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r && r.data || ""))) erros.push("Informe a data.");
  if (String(r && r.dose || "").length > 60) erros.push("A dose deve ter até 60 caracteres.");
  if (String(r && r.obs || "").length > 200) erros.push("A observação deve ter até 200 caracteres.");
  return erros;
}

// Agrupa por data (mais recente primeiro)
export function agruparPorData(registros) {
  const mapa = {};
  (registros || []).forEach((r) => { (mapa[r.data] = mapa[r.data] || []).push(r); });
  return Object.keys(mapa).sort((a, b) => (a < b ? 1 : -1)).map((d) => ({ data: d, itens: mapa[d] }));
}

// CSV com separador ";". nomes: mapa id -> nome do suplemento
export function csvDiario(registros, nomes) {
  const cab = ["Data", "Suplemento", "Dose registrada", "Observação"];
  const linhas = (registros || []).slice().sort((a, b) => (a.data < b.data ? -1 : 1))
    .map((r) => [r.data, nomes[r.suplementoId] || r.suplementoId, r.dose || "", r.obs || ""].map(escaparCsv).join(";"));
  return [cab.map(escaparCsv).join(";")].concat(linhas).join("\r\n");
}
