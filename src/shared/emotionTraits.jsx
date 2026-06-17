// Couleurs / tonalités / icônes par trait psychologique — utilisé par
// TraderProfile.jsx (portrait du jour + calendrier mensuel) et LoginScreen.jsx (teaser).
export const EMOTION_COLORS = {
  'Discipliné':'#00cc77', 'Serein':'#00cc77',
  'Focalisé':  '#00aaff', 'Stressé':'#f59e0b',
  'Fragile':   '#f59e0b', 'Surconfiant':'#e07010',
  'Impulsif':  '#ff3344', 'Vengeur':'#ff3344',
};

// Tonalité dérivée de la couleur ci-dessus : vert -> positif, rouge/orange -> négatif,
// le reste -> neutre. Pas une nouvelle classification, juste un regroupement.
export function emotionTone(emotion) {
  const c = EMOTION_COLORS[emotion];
  if (c === '#00cc77') return 'positive';
  if (c === '#ff3344' || c === '#e07010') return 'negative';
  return 'neutral';
}

// Equivalent rgb (sans #) de chaque couleur de EMOTION_COLORS, pour construire
// des rgba(...) dans des dégradés/fonds.
export function emotionRgb(color) {
  return color === '#00cc77' ? '0,204,119'
       : color === '#f59e0b' ? '245,158,11'
       : color === '#ff3344' ? '255,51,68'
       : color === '#00aaff' ? '0,170,255'
       : color === '#e07010' ? '224,112,16'
       : '136,153,187';
}

// Icône par tonalité (bouclier / éclair / cible) — SVG inline, cohérent avec le
// reste de l'app qui n'utilise aucune librairie d'icônes.
export function ToneIcon({ tone, color, size = 26 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (tone === 'positive') {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (tone === 'negative') {
    return (
      <svg {...common}>
        <polygon points="13 2 3 14 11 14 9 22 21 10 13 10 13 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
    </svg>
  );
}
