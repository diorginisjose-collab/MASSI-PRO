// Mitos e verdades por suplemento. Classificações: Verdadeiro · Parcialmente verdadeiro · Falso · Evidência insuficiente.
// Conteúdo em revisão: validar por profissional antes de publicar como definitivo.
export const CLASSIFICACOES = ["Verdadeiro", "Parcialmente verdadeiro", "Falso", "Evidência insuficiente"];

export const MITOS = {
  creatina: [
    { afirmacao: "A creatina faz mal aos rins.", classificacao: "Falso", explicacao: "Em pessoas saudáveis, com doses de uso habitual, estudos não mostram dano renal. Quem já tem doença renal deve consultar médico antes." },
    { afirmacao: "A creatina precisa de uma fase de carga para funcionar.", classificacao: "Parcialmente verdadeiro", explicacao: "A carga satura os músculos mais rápido, mas 3 a 5 g por dia chegam ao mesmo nível em algumas semanas." },
    { afirmacao: "A creatina causa queda de cabelo.", classificacao: "Evidência insuficiente", explicacao: "Há um único estudo pequeno sobre o tema, e ele não permite conclusão." },
  ],
  whey: [
    { afirmacao: "O whey só funciona se for tomado logo após o treino.", classificacao: "Parcialmente verdadeiro", explicacao: "O efeito do horário é pequeno. O que mais pesa é atingir a meta diária de proteína." },
    { afirmacao: "Whey é anabolizante.", classificacao: "Falso", explicacao: "É uma proteína alimentar, derivada do soro do leite. Não tem ação hormonal." },
  ],
  cafeina: [
    { afirmacao: "A cafeína desidrata.", classificacao: "Falso", explicacao: "Em consumo habitual, o efeito diurético é leve e não causa desidratação relevante na maioria das pessoas." },
    { afirmacao: "Tomar cafeína à tarde pode atrapalhar o sono.", classificacao: "Verdadeiro", explicacao: "A cafeína tem meia-vida de várias horas e pode reduzir a qualidade do sono." },
  ],
  "vitamina-d": [
    { afirmacao: "Quanto mais vitamina D, melhor.", classificacao: "Falso", explicacao: "Doses excessivas são tóxicas e elevam o cálcio no sangue. A dose deve vir de exame e orientação médica." },
  ],
  bcaa: [
    { afirmacao: "BCAA é essencial para ganhar massa muscular.", classificacao: "Falso", explicacao: "Quem já consome proteína suficiente recebe esses aminoácidos pela alimentação." },
  ],
  glutamina: [
    { afirmacao: "A glutamina melhora a imunidade de atletas.", classificacao: "Evidência insuficiente", explicacao: "Os estudos são pequenos e não permitem conclusão para atletas saudáveis." },
  ],
  "omega-3": [
    { afirmacao: "Ômega-3 aumenta a massa muscular.", classificacao: "Evidência insuficiente", explicacao: "Não há evidência consistente de ganho muscular. Os benefícios mais estudados são para o coração." },
  ],
  colageno: [
    { afirmacao: "Colágeno hidrolisado regenera a cartilagem.", classificacao: "Evidência insuficiente", explicacao: "Alguns estudos sugerem alívio de sintomas, mas a evidência é limitada e variável." },
  ],
};
