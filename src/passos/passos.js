// Contador de passos: cálculos (distância, calorias, resumo do dia) e detecção de passos.
// Sem IA e sem serviços externos. A contagem em segundo plano exige código nativo (ver LEIA-ME).

export const CADENCIA_PASSOS_MIN = 100;   // passos por minuto em caminhada moderada (referência usual)
export const MET_CAMINHADA = 3.5;         // equivalente metabólico de caminhada moderada (~5 km/h)

// Comprimento médio do passo (em metros), a partir da altura e do sexo.
// Fórmula usual: altura × 0,415 (homens) e × 0,413 (mulheres). Sem sexo, usa 0,414.
export function comprimentoPassoM(alturaCm, sexo) {
  const h = Number(alturaCm);
  if (!(h >= 120 && h <= 230)) return null;
  const fator = sexo === "masculino" ? 0.415 : sexo === "feminino" ? 0.413 : 0.414;
  return Math.round((h * fator) / 100 * 1000) / 1000; // metros, 3 casas
}

export function distanciaKm(passos, alturaCm, sexo) {
  const n = Number(passos);
  const comp = comprimentoPassoM(alturaCm, sexo);
  if (!(n >= 0) || comp === null) return null;
  return Math.round((n * comp) / 10) / 100; // km com 2 casas
}

// Calorias: tempo estimado pela cadência × MET × peso / 200 por minuto (fórmula padrão do Compendium).
export function caloriasKcal(passos, pesoKg) {
  const n = Number(passos);
  const p = Number(pesoKg);
  if (!(n >= 0) || !(p >= 30 && p <= 250)) return null;
  const minutos = n / CADENCIA_PASSOS_MIN;
  // kcal/min = MET × 3,5 × peso(kg) / 200
  return Math.round(minutos * MET_CAMINHADA * 3.5 * p / 200 * 10) / 10;
}

// Resumo de um dia com os dados do perfil (altura, sexo, peso)
export function resumoDia(data, passos, perfil) {
  const p = perfil || {};
  return {
    data,
    passos: Math.max(0, Math.round(Number(passos) || 0)),
    km: distanciaKm(passos, p.altura, p.sexo),
    kcal: caloriasKcal(passos, p.peso),
    minutos: Math.round((Number(passos) || 0) / CADENCIA_PASSOS_MIN),
  };
}

export function textoResumo(r) {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(r.data) ? r.data.slice(8, 10) + "/" + r.data.slice(5, 7) + "/" + r.data.slice(0, 4) : r.data;
  const linhas = [
    "Meu dia no Massi Pro — " + data,
    "Passos: " + r.passos.toLocaleString("pt-BR"),
    "Distância: " + (r.km === null ? "—" : String(r.km).replace(".", ",") + " km"),
    "Calorias estimadas: " + (r.kcal === null ? "—" : Math.round(r.kcal) + " kcal"),
    "(estimativas aproximadas)",
  ];
  return linhas.join("\n");
}

// ---------- detecção de passos a partir do acelerômetro (com o app aberto) ----------
// Um passo só conta quando faz parte de um RITMO: pelo menos três passadas seguidas,
// com intervalo entre 0,25 s e 1,3 s. Movimentos isolados (balanço, pegar o celular)
// não entram, e o ritmo se desfaz quando a caminhada para.
export function contarPassosAmostras(amostras, opcoes) {
  const limiar = (opcoes && opcoes.limiar) || 11.5;
  const minIntervaloMs = 250;
  const maxIntervaloMs = 1300;
  let contagem = 0;
  let ultimoPico = -Infinity;
  let seqValidos = 0;      // quantos intervalos válidos seguidos já houve
  let confirmado = false;  // ritmo já confirmado (3 passadas)
  let anterior = null, anteriorMag = 0, subindo = false;
  for (const a of amostras || []) {
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    if (anterior !== null) {
      const agora = mag > anteriorMag;
      if (subindo && !agora && anteriorMag >= limiar) {
        const intervalo = a.t - ultimoPico;
        if (intervalo >= minIntervaloMs && intervalo <= maxIntervaloMs) {
          seqValidos += 1;
          if (!confirmado && seqValidos >= 2) {
            contagem += 3; confirmado = true;       // as três primeiras passadas do ritmo
          } else if (confirmado) {
            contagem += 1;
          }
          ultimoPico = a.t;
        } else {
          // ritmo quebrado: este pico começa um novo candidato
          seqValidos = 0; confirmado = false; ultimoPico = a.t;
        }
      }
      subindo = agora;
    }
    anterior = a; anteriorMag = mag;
  }
  return contagem;
}

// Dia com passos: soma e mantém o histórico ordenado
export function somarRegistros(registros) {
  return (registros || []).reduce((s, r) => s + (Number(r.passos) || 0), 0);
}
