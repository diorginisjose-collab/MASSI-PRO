import React from "react";

// Ilustração própria (sem fundo) do tipo de aparelho, em estilo 3D: sombra, brilho e volume.
// O tipo é escolhido pelo nome do aparelho. Não usa imagens de terceiros.
export function tipoAparelho(nome) {
  const n = String(nome || "").toLowerCase();
  if (/smith/.test(n)) return "smith";
  if (/halter/.test(n)) return "halter";
  if (/barra|livre/.test(n)) return "barra";
  if (/cabo|polia|pulley|crossover/.test(n)) return "cabo";
  if (/peso corporal|corporal|flex|abdomin|prancha|agachamento isom/.test(n)) return "corpo";
  if (/máquina|maquina|hack|leg|extensor|flexor|cadeira|pêndulo|pendulo|articulado/.test(n)) return "maquina";
  return "halter";
}

const defs = (
  <defs>
    <radialGradient id="sombra" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
      <stop offset="100%" stopColor="#000" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#8E969E" />
      <stop offset="45%" stopColor="#3A4046" />
      <stop offset="100%" stopColor="#1A1D21" />
    </linearGradient>
    <linearGradient id="borracha" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#3B3F45" />
      <stop offset="100%" stopColor="#0E1013" />
    </linearGradient>
    <linearGradient id="lime" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#CFFF5A" />
      <stop offset="100%" stopColor="#6FCF00" />
    </linearGradient>
  </defs>
);

const Sombra = () => <ellipse cx="120" cy="146" rx="92" ry="9" fill="url(#sombra)" />;

function Halter() {
  return (
    <g>
      <rect x="52" y="74" width="136" height="12" rx="6" fill="url(#metal)" />
      {[[40, 76], [22, 84]].map(([x, h], i) => (
        <g key={i}>
          <rect x={x} y={70 - (h - 76) / 2} width="18" height={h + 40} rx="8" fill="url(#borracha)" />
          <rect x={x + 3} y={70 - (h - 76) / 2 + 4} width="4" height={h + 32} rx="2" fill="#fff" opacity="0.10" />
        </g>
      ))}
      {[[188, 76], [206, 84]].map(([x, h], i) => (
        <g key={i}>
          <rect x={x} y={70 - (h - 76) / 2} width="18" height={h + 40} rx="8" fill="url(#borracha)" />
          <rect x={x + 3} y={70 - (h - 76) / 2 + 4} width="4" height={h + 32} rx="2" fill="#fff" opacity="0.10" />
        </g>
      ))}
    </g>
  );
}

function Barra() {
  return (
    <g>
      <rect x="18" y="77" width="204" height="6" rx="3" fill="url(#metal)" />
      {[[40, 60, 28], [58, 70, 24], [176, 60, 28], [158, 70, 24]].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={y === 60 ? 52 : 40} rx="6" fill="url(#borracha)" />
      ))}
      <rect x="84" y="79" width="72" height="3" fill="#fff" opacity="0.15" />
    </g>
  );
}

function Smith() {
  // Vista em três quartos: coluna da frente, coluna de trás (mais escura) e barra com anilhas
  const disco = (x, y, r, w) => (
    <g key={x + "-" + y + "-" + r}>
      <rect x={x} y={y - r} width={w} height={r * 2} rx={w / 2} fill="#0E1013" />
      <rect x={x + w * 0.25} y={y - r + 2} width={w * 0.25} height={r * 2 - 4} rx={2} fill="#2A2F35" />
      <ellipse cx={x + w} cy={y} rx={w * 0.25} ry={r} fill="#1B1F24" />
    </g>
  );
  return (
    <g>
      {/* base em L */}
      <path d="M44 138 L120 138 L186 126 L186 134 L120 146 L44 146 Z" fill="url(#metal)" />
      <rect x="40" y="140" width="32" height="8" rx="3" fill="#0E1013" />
      <rect x="180" y="128" width="26" height="8" rx="3" fill="#0E1013" />
      {/* coluna de trás (sombra) */}
      <rect x="150" y="8" width="8" height="118" rx="2" fill="#5A6168" opacity="0.8" />
      <rect x="110" y="8" width="8" height="10" fill="#5A6168" opacity="0.8" />
      <path d="M156 126 Q168 122 178 128" fill="none" stroke="#5A6168" strokeWidth="3" />
      {/* travessa superior de trás */}
      <rect x="76" y="6" width="84" height="6" rx="2" fill="#5A6168" opacity="0.85" />
      {/* coluna da frente */}
      <rect x="62" y="16" width="10" height="122" rx="3" fill="url(#metal)" />
      <rect x="63" y="20" width="2" height="112" fill="#fff" opacity="0.25" />
      {[30, 40, 50, 60, 70, 80, 90, 100, 110].map((y) => (
        <circle key={y} cx="67" cy={y} r="1.6" fill="#15181B" />
      ))}
      {/* travessa superior da frente com alças */}
      <rect x="62" y="16" width="100" height="7" rx="3" fill="url(#metal)" />
      <path d="M92 16 Q100 6 112 14" fill="none" stroke="#C8CED4" strokeWidth="3" strokeLinecap="round" />
      <path d="M124 16 Q132 6 144 14" fill="none" stroke="#C8CED4" strokeWidth="3" strokeLinecap="round" />
      {/* coluna direita da frente */}
      <rect x="150" y="14" width="10" height="122" rx="3" fill="url(#metal)" />
      <rect x="151" y="18" width="2" height="112" fill="#fff" opacity="0.22" />
      {[30, 40, 50, 60, 70, 80, 90, 100, 110].map((y) => (
        <circle key={y} cx="155" cy={y} r="1.6" fill="#15181B" />
      ))}
      {/* trava de segurança (braços laterais) */}
      <rect x="72" y="74" width="20" height="5" rx="2" fill="url(#metal)" />
      <rect x="84" y="70" width="10" height="13" rx="2" fill="#0E1013" />
      <rect x="140" y="74" width="18" height="5" rx="2" fill="url(#metal)" />
      <rect x="136" y="70" width="10" height="13" rx="2" fill="#0E1013" />
      {/* guias verticais da barra */}
      <rect x="111" y="20" width="2.6" height="110" fill="#B9C0C7" />
      <rect x="128" y="20" width="2.6" height="110" fill="#B9C0C7" />
      {/* barra com anilhas */}
      <rect x="22" y="58" width="196" height="3.5" rx="1.5" fill="#D6DCE2" />
      <rect x="20" y="56" width="22" height="7" rx="2" fill="#B9C0C7" />
      <rect x="194" y="56" width="22" height="7" rx="2" fill="#B9C0C7" />
      <rect x="112" y="58" width="16" height="4" fill="#0E1013" />
      {disco(44, 60, 22, 10)}
      {disco(32, 60, 16, 8)}
      {disco(190, 60, 22, 10)}
      {disco(204, 60, 16, 8)}
      {/* carrinho de travamento */}
      <rect x="104" y="52" width="10" height="16" rx="2" fill="#0E1013" />
      <rect x="140" y="52" width="10" height="16" rx="2" fill="#0E1013" />
      {/* sombra no chão */}
      <ellipse cx="120" cy="150" rx="88" ry="7" fill="url(#sombra)" />
    </g>
  );
}

function Cabo() {
  return (
    <g>
      <rect x="54" y="16" width="8" height="122" rx="3" fill="url(#metal)" />
      <rect x="178" y="16" width="8" height="122" rx="3" fill="url(#metal)" />
      <rect x="54" y="16" width="132" height="6" rx="3" fill="url(#metal)" />
      {[[120, 26], [60, 26]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + 6} r="8" fill="url(#borracha)" stroke="#8E969E" strokeWidth="2" />
      ))}
      <line x1="120" y1="32" x2="120" y2="72" stroke="#B9C0C7" strokeWidth="2" />
      <rect x="92" y="72" width="56" height="10" rx="4" fill="url(#lime)" />
      <rect x="28" y="100" width="36" height="34" rx="6" fill="url(#borracha)" />
      <rect x="62" y="110" width="40" height="8" rx="3" fill="url(#metal)" />
    </g>
  );
}

function Maquina() {
  return (
    <g>
      <rect x="40" y="58" width="160" height="10" rx="4" fill="url(#metal)" />
      <rect x="54" y="68" width="10" height="66" rx="3" fill="url(#metal)" />
      <rect x="176" y="68" width="10" height="66" rx="3" fill="url(#metal)" />
      <rect x="78" y="40" width="84" height="56" rx="12" fill="url(#borracha)" />
      <rect x="86" y="44" width="68" height="6" rx="3" fill="#fff" opacity="0.10" />
      <rect x="112" y="96" width="16" height="30" rx="4" fill="url(#lime)" />
      <rect x="40" y="128" width="160" height="8" rx="3" fill="url(#metal)" />
    </g>
  );
}

function Corpo() {
  return (
    <g>
      <circle cx="120" cy="36" r="14" fill="url(#borracha)" />
      <rect x="104" y="52" width="32" height="50" rx="14" fill="url(#borracha)" />
      <rect x="92" y="60" width="12" height="46" rx="6" fill="url(#borracha)" />
      <rect x="136" y="60" width="12" height="46" rx="6" fill="url(#borracha)" />
      <rect x="104" y="98" width="13" height="42" rx="6" fill="url(#borracha)" />
      <rect x="123" y="98" width="13" height="42" rx="6" fill="url(#borracha)" />
      <rect x="92" y="62" width="56" height="3" fill="#CFFF5A" opacity="0.7" />
    </g>
  );
}

const PARTES = { halter: Halter, barra: Barra, smith: Smith, cabo: Cabo, maquina: Maquina, corpo: Corpo };

export default function IlustracaoAparelho({ nome, altura = 150 }) {
  const tipo = tipoAparelho(nome);
  const Parte = PARTES[tipo] || Halter;
  return (
    <svg viewBox="0 0 240 160" width="100%" height={altura} role="img" aria-label={nome || "aparelho"} style={{ display: "block", maxHeight: altura }}>
      {defs}
      <Sombra />
      <Parte />
    </svg>
  );
}
