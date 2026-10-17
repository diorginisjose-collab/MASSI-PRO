// Interações relevantes e avaliação profissional, por item. Ausência = "pendente de revisão".
// Não reduz a segurança a uma nota: cada campo é separado.
export const SEGURANCA = {
  creatina: { interacoes: "Medicamentos que afetam os rins (como anti-inflamatórios de uso prolongado) merecem avaliação antes de usar.", avaliacao: "Doença renal ou uso de medicamentos que afetam os rins." },
  cafeina: { interacoes: "Soma com outras fontes de cafeína (café, energéticos, pré-treino). Alguns medicamentos, como broncodilatadores e certos antidepressivos, podem interagir.", avaliacao: "Arritmia, hipertensão, ansiedade, gravidez ou uso de medicamentos." },
  "omega-3": { interacoes: "Anticoagulantes e antiagregantes plaquetários aumentam o risco de sangramento em doses altas.", avaliacao: "Uso de anticoagulante, cirurgia programada ou sangramento." },
  curcuma: { interacoes: "Pode potencializar anticoagulantes. Confirmar interações com medicamentos metabolizados pelo fígado.", avaliacao: "Pedras na vesícula, uso de anticoagulante ou problemas hepáticos." },
  magnesio: { interacoes: "Pode reduzir a absorção de alguns antibióticos (como quinolonas e tetraciclinas). Separar os horários.", avaliacao: "Doença renal ou uso de medicamentos com magnésio." },
  ferro: { interacoes: "Reduz a absorção de cálcio e zinco. Separar os horários.", avaliacao: "Sempre, com exame de sangue. Hemocromatose contraindica." },
  calcio: { interacoes: "Reduz a absorção de ferro e zinco, e pode interferir em alguns medicamentos, como a levotiroxina. Separar os horários.", avaliacao: "Cálculo renal ou uso de medicamentos que interagem com cálcio." },
  "vitamina-d": { interacoes: "Somada a outros suplementos de vitamina D e cálcio, pode elevar o cálcio no sangue.", avaliacao: "Sempre, com exame. Hipercalcemia ou doença renal contraindicam o uso sem orientação." },
};

export const AVALIACAO_PADRAO = "Gestantes, lactantes, menores de 18 anos, pessoas com doença renal, hepática ou cardíaca e quem usa medicamentos devem consultar médico ou nutricionista antes de usar.";
