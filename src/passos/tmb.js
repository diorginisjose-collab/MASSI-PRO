// Taxa Metabólica Basal (TMB) pela equação de Mifflin-St Jeor.
// Estimativa calculada no próprio aparelho, a partir do perfil. Não substitui avaliação profissional.
export function idadeDeNascimento(nascimento, hoje) {
  if (!nascimento) return null;
  const [a, m, d] = String(nascimento).split("-").map(Number);
  if (!a || !m || !d) return null;
  const h = hoje || new Date();
  let idade = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) idade -= 1;
  return idade;
}

// Retorna kcal/dia inteiras, ou null se faltar algum dado ou o sexo não for masculino/feminino
export function tmbKcal({ sexo, peso, altura, idade }) {
  const p = Number(String(peso).replace(",", "."));
  const al = Number(String(altura).replace(",", "."));
  if (!(p >= 30 && p <= 250) || !(al >= 120 && al <= 230) || !(idade >= 10 && idade <= 110)) return null;
  let base;
  if (sexo === "masculino") base = 10 * p + 6.25 * al - 5 * idade + 5;
  else if (sexo === "feminino") base = 10 * p + 6.25 * al - 5 * idade - 161;
  else return null;
  return Math.round(base);
}
