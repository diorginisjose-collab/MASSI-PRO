// Contagem diária de passos a partir do TYPE_STEP_COUNTER do Android.
//
// O sensor entrega um número que só cresce: os passos acumulados desde que o celular
// ligou pela última vez (volta a zero quando o celular reinicia). Este arquivo transforma
// esse número em "passos de hoje". Não usa sensor, Capacitor nem IA: só recebe a leitura
// e devolve o novo estado, por isso dá para testar sozinho.
//
// Estado guardado (um por aparelho): { dia: "AAAA-MM-DD", ultimo: número, acumulado: número }
//   dia        dia a que o "acumulado" pertence
//   ultimo     última leitura bruta do sensor (para calcular a diferença sem duplicar)
//   acumulado  passos já contados nesse dia

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function diasEntre(de, ate) {
  const a = de.split("-").map(Number);
  const b = ate.split("-").map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

// estado: estado anterior (ou null na primeira leitura)
// bruto:  valor atual do sensor
// hoje:   data local de hoje, "AAAA-MM-DD"
//
// Devolve:
//   estado     novo estado para salvar
//   passosHoje passos de hoje
//   fechados   dias encerrados nesta leitura: { "AAAA-MM-DD": passos } (para gravar no histórico)
//   evento     "inicio" | "normal" | "reinicio" | "virada" | "lacuna" | "invalido"
//   estimado   true quando o número de algum dia depende de uma suposição (veja abaixo)
export function atualizarContagem(estado, bruto, hoje) {
  // Só aceita número (ou texto numérico). null, "", true etc. viram inválidos: Number(null) seria 0
  // e uma leitura vazia do plugin seria confundida com reinício do celular.
  const n = typeof bruto === "number" ? bruto : (typeof bruto === "string" && bruto.trim() !== "" ? Number(bruto) : NaN);
  const valido = Number.isFinite(n) && n >= 0 && ISO.test(String(hoje));
  const temEstado = !!(estado && ISO.test(String(estado.dia)) && Number.isFinite(estado.ultimo) && Number.isFinite(estado.acumulado));

  if (!valido) {
    return { estado: temEstado ? estado : null, passosHoje: temEstado ? estado.acumulado : null, fechados: {}, evento: "invalido", estimado: false };
  }
  const leitura = Math.floor(n);

  // Primeira leitura: o sensor não diz quantos passos foram dados hoje (só o total desde o boot),
  // então a contagem de hoje começa em zero a partir daqui.
  if (!temEstado) {
    return { estado: { dia: hoje, ultimo: leitura, acumulado: 0 }, passosHoje: 0, fechados: {}, evento: "inicio", estimado: false };
  }

  const gap = diasEntre(estado.dia, hoje);
  if (gap < 0) {
    // O relógio do celular voltou no tempo: não mexe em nada.
    return { estado, passosHoje: estado.acumulado, fechados: {}, evento: "invalido", estimado: false };
  }

  // Leitura menor que a anterior = o celular reiniciou e o sensor voltou a zero.
  // Os passos dados entre a última leitura e o desligamento não podem ser recuperados.
  const reinicio = leitura < estado.ultimo;
  const delta = reinicio ? leitura : leitura - estado.ultimo;

  // Mesmo dia
  if (gap === 0) {
    const acumulado = estado.acumulado + delta;
    return { estado: { dia: hoje, ultimo: leitura, acumulado }, passosHoje: acumulado, fechados: {}, evento: reinicio ? "reinicio" : "normal", estimado: false };
  }

  // Virou o dia desde a última leitura
  const fechados = {};
  let passosHoje = 0;
  let evento;
  if (reinicio) {
    // Passos desde o reinício: não dá para saber em que dia foram; contam para hoje.
    fechados[estado.dia] = estado.acumulado;
    passosHoje = leitura;
    evento = "reinicio";
  } else if (gap === 1) {
    // Intervalo sem abrir o app que cruzou a meia-noite: a diferença vai para o dia anterior
    // (o caso mais comum é a noite + madrugada). É uma estimativa.
    fechados[estado.dia] = estado.acumulado + delta;
    evento = "virada";
  } else {
    // Vários dias sem abrir o app: a diferença não pode ser atribuída a nenhum dia, então
    // não é contada. Os dias do meio ficam sem registro.
    fechados[estado.dia] = estado.acumulado;
    evento = "lacuna";
  }
  return { estado: { dia: hoje, ultimo: leitura, acumulado: passosHoje }, passosHoje, fechados, evento, estimado: true };
}
