import { useState, useEffect } from 'react';

// ── Redesign tokens (header / nav / créneaux / 5-steps / routine / règles) ──
const ST = {
  border:          'rgba(136,153,187,0.14)',
  borderSecondary: 'rgba(136,153,187,0.35)',
  surfSecondary:   'rgba(20,23,34,0.75)',
  textPrimary:     '#dde4ef',
  textSecondary:   '#8898aa',
  textTertiary:    '#5a6a82',
  success:         '#1D9E75',
  danger:          '#E24B4A',
  warn:            '#BA7517',
  radiusLg:        '10px',
  radiusMd:        '8px',
};

function IconX({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
function IconAlertTriangle({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.871l-8.106 -13.534a1.914 1.914 0 0 0 -3.274 0z" />
      <path d="M12 16h.01" />
    </svg>
  );
}
function IconTrophy({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21l8 0" />
      <path d="M12 17l0 4" />
      <path d="M7 4l10 0" />
      <path d="M17 4v8a5 5 0 0 1 -10 0v-8" />
      <path d="M5 9a2 2 0 0 1 -2 -2v-1a2 2 0 0 1 2 -2h2" />
      <path d="M19 9a2 2 0 0 0 2 -2v-1a2 2 0 0 0 -2 -2h-2" />
    </svg>
  );
}
function IconFlame({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 1.79 -4 2z" />
    </svg>
  );
}

// ── Créneaux horaires (grille 4 colonnes) — utilisé par les 2 tabs ──
function SessionsQuickGrid({ sessions }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
      {sessions.map(s => {
        const featured = s.label === 'London Open' || s.label.includes('Silver Bullet');
        const badgeStyle = s.badge === 'MANIPULATION'
          ? { background:'rgba(186,117,23,0.14)', color:ST.warn, border:'none' }
          : s.badge === 'FENETRE PRINCIPALE'
          ? { background:'#1a1230', color:'#9F95E8', border:'1px solid #534AB7' }
          : { background:ST.surfSecondary, color:ST.textTertiary, border:`1px solid ${ST.border}` };
        return (
          <div key={s.id} style={{
            border: featured ? '2px solid #534AB7' : `0.5px solid ${ST.border}`,
            background: featured ? '#0d0b1a' : 'transparent',
            borderRadius: ST.radiusLg, padding:'10px 12px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
              <span style={{ fontSize:'16px' }}>{s.emoji}</span>
              <span style={{ fontSize:'13px', fontWeight:'500', color: featured ? '#9F95E8' : ST.textPrimary }}>{s.label}</span>
            </div>
            <div style={{ fontSize:'11px', color:ST.textTertiary }}>{s.time}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'6px' }}>
              {s.badge && (
                <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', fontWeight:'500', ...badgeStyle }}>{s.badge}</span>
              )}
              {s.danger && (
                <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'4px', fontWeight:'500', background:'rgba(226,75,74,0.12)', color:ST.danger }}>DANGER</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modèle d'entrée ICT 5 étapes — utilisé par les 2 tabs ──
function EntrySteps({ steps, mantra }) {
  return (
    <div style={{ border:`0.5px solid ${ST.border}`, borderRadius:ST.radiusLg, overflow:'hidden' }}>
      <div style={{ background:ST.surfSecondary, borderBottom:`1px solid ${ST.border}`, padding:'10px 16px' }}>
        <span style={{ fontSize:'11px', fontWeight:'500', color:ST.textSecondary, textTransform:'uppercase', letterSpacing:'0.06em' }}>MODÈLE D'ENTRÉE ICT — 5 ÉTAPES</span>
      </div>
      {steps.map((s, i) => {
        const isEarly = s.step <= 2;
        return (
          <div key={i} style={{ display:'flex', gap:'14px', padding:'14px 16px', borderBottom: i < steps.length - 1 ? `1px solid ${ST.border}` : 'none' }}>
            <div style={{
              width:'24px', height:'24px', borderRadius:'50%', flexShrink:0,
              background: isEarly ? '#1a1230' : ST.surfSecondary,
              border: `1px solid ${isEarly ? '#534AB7' : ST.border}`,
              color: isEarly ? '#9F95E8' : ST.textSecondary,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'500',
            }}>{s.step}</div>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'500', color:ST.textPrimary, marginBottom:'3px' }}>{s.label}</div>
              <div style={{ fontSize:'12px', color:ST.textSecondary, lineHeight:'1.55' }}>{s.desc}</div>
            </div>
          </div>
        );
      })}
      <div style={{ padding:'12px 16px', background:'#120a00', borderTop:'1px solid #3a2500', display:'flex', alignItems:'center', gap:'8px' }}>
        <IconFlame color={ST.warn} />
        <span style={{ fontSize:'13px', fontWeight:'500', color:ST.warn }}>{mantra}</span>
      </div>
    </div>
  );
}

// ── Colonne Routine (bas de page) ──
function RoutineColumn({ title, routine }) {
  return (
    <div style={{ border:`1px solid ${ST.border}`, borderRadius:ST.radiusLg, overflow:'hidden' }}>
      <div style={{ background:ST.surfSecondary, borderBottom:`1px solid ${ST.border}`, padding:'10px 16px' }}>
        <span style={{ fontSize:'11px', fontWeight:'500', color:ST.textSecondary, textTransform:'uppercase', letterSpacing:'0.06em' }}>{title}</span>
      </div>
      {routine.map((r, i) => (
        <div key={i} style={{ display:'flex', gap:'12px', padding:'10px 14px', borderBottom: i < routine.length - 1 ? `1px solid ${ST.border}` : 'none' }}>
          <span style={{ fontSize:'12px', fontWeight:'500', color: r.time === '11h00' ? '#E24B4A' : '#7F77DD', minWidth:'48px', flexShrink:0 }}>{r.time}</span>
          <div>
            <div style={{ fontSize:'12px', fontWeight:'500', color:ST.textPrimary }}>{r.action}</div>
            <div style={{ fontSize:'11px', color:ST.textTertiary, marginTop:'2px' }}>{r.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Colonne Interdictions & Risk Management (bas de page) ──
function RulesColumn({ rules }) {
  return (
    <div style={{ border:`1px solid ${ST.border}`, borderRadius:ST.radiusLg, overflow:'hidden' }}>
      <div style={{ background:ST.surfSecondary, borderBottom:`1px solid ${ST.border}`, padding:'10px 16px' }}>
        <span style={{ fontSize:'11px', fontWeight:'500', color:ST.textSecondary, textTransform:'uppercase', letterSpacing:'0.06em' }}>INTERDICTIONS & RISK MANAGEMENT</span>
      </div>
      {rules.map((r, i) => {
        const isProhibition = r.icon === '❌';
        const isPositive    = r.icon === '🏆';
        const Icon  = isProhibition ? IconX : isPositive ? IconTrophy : IconAlertTriangle;
        const color = isProhibition ? ST.danger : isPositive ? ST.success : ST.warn;
        return (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'9px 14px', borderBottom: i < rules.length - 1 ? `1px solid ${ST.border}` : 'none' }}>
            <span style={{ marginTop:'2px', flexShrink:0 }}><Icon color={color} /></span>
            <span style={{ fontSize:'12px', color: r.critical ? ST.textPrimary : ST.textSecondary, fontWeight: r.critical ? '500' : '400', lineHeight:'1.5' }}>{r.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// -- ICT Sessions (New York) ------------------------------------
const ICT_SESSIONS = [
  {
    id: "premarket",
    label: "NY Pre-Market",
    time: "13h00 - 15h30",
    color: "#aa88ff",
    emoji: "🌅",
    danger: false,
    badge: null,
    objective: "Préparer l'open US, construire la liquidité, identifier le biais initial.",
    observe: [
      { label: "London High / Low",  note: "Souvent ciblés plus tard" },
      { label: "Asian High / Low",   note: "Toujours importants" },
      { label: "PDH / PDL",          note: "Previous Day High / Low" },
      { label: "Equal Highs / Lows", note: "Consolidations & équilibres" },
    ],
    doList:   ["Tracer les niveaux clés", "Attendre la prise de liquidité", "Définir le Draw On Liquidity (DOL)"],
    dontList: ["Entrer trop tôt", "Anticiper le move", "FOMO avant 15h30"],
    subsessions: null,
    checklist: null,
    mindset: null,
  },
  {
    id: "nyam",
    label: "NY AM Session",
    time: "15h30 - 18h00",
    color: "#8899bb",
    emoji: "🚀",
    danger: false,
    badge: "LA PLUS IMPORTANTE",
    objective: "C'est LE coeur du trading ICT sur MNQ. La majorité des setups A+ arrivent ici.",
    observe: null,
    doList:   ["Trader uniquement dans le sens du DOL", "Entrer après sweep de liquidité", "Attendre un displacement clair"],
    dontList: ["Pas de trade au milieu du range", "Pas de revenge trade après 16h30", "Pas de setup sans liquidité prise"],
    subsessions: [
      { label: "Opening Drive",              time: "15h30 - 16h00", color: "#f0a020", hot: false, desc: "Sweep violent, Judas Swing, faux départ, prise de liquidité Londres." },
      { label: "Silver Bullet Principal",    time: "16h00 - 17h00", color: "#8899bb", hot: true,  desc: "Fenêtre la plus importante. Chercher MSS/CHOCH, displacement, FVG, retracement propre." },
      { label: "Continuation / Distribution",time: "17h00 - 18h00", color: "#7888a0", hot: false, desc: "Extension du move, prise de profits, second push possible." },
    ],
    checklist: [
      { step: 1, question: "Quelle liquidité a été prise ?", items: ["Asian High ?", "London Low ?", "PDH / PDL ?"] },
      { step: 2, question: "Où est le Draw On Liquidity ?",  items: ["Highs visibles ?", "Lows visibles ?", "Imbalance ?", "Daily target ?"] },
      { step: 3, question: "Y a-t-il un displacement ?",     items: ["Sans displacement → PAS DE TRADE"] },
      { step: 4, question: "Le FVG est-il propre ?",         items: ["Attendre l'impulsion", "Retracement propre", "Entrée sur le FVG"] },
    ],
    mindset: null,
  },
  {
    id: "lunch",
    label: "NY Lunch",
    time: "18h00 - 19h30",
    color: "#ff4455",
    emoji: "🍽",
    danger: true,
    badge: null,
    objective: "Session dangereuse : chop, ranges, faux signaux, faible volatilité.",
    observe: null,
    doList:   ["Terminer ta journée si objectif atteint", "Réduire énormément le risque", "Observer sans trader"],
    dontList: ["Overtrading", "Vouloir se refaire", "Scalping émotionnel"],
    subsessions: null,
    checklist: null,
    mindset: "La majorité des pertes arrivent souvent après NY AM — fatigue, euphorie, frustration, baisse de qualité des setups.",
  },
  {
    id: "nypm",
    label: "NY PM Session",
    time: "19h30 - 22h00",
    color: "#f0a020",
    emoji: "🌆",
    danger: false,
    badge: null,
    objective: "Le marché redistribue, clôture les positions. Mouvements moins fiables, algos erratiques.",
    observe: null,
    doList:   ["Seulement si déjà rentable sur la journée", "Seulement si mentalement stable", "Seulement si encore concentré"],
    dontList: ["Si tu es en perte → STOP TRADING", "Si tu es fatigué → STOP TRADING", "Forcer un setup de qualité B-"],
    subsessions: [
      { label: "PM Silver Bullet", time: "20h00 - 21h00", color: "#f0a020", hot: false, desc: "Setup possible mais moins puissant que NY AM. Seulement setups A+." },
    ],
    checklist: null,
    mindset: "Autorisé seulement si tu es déjà rentable et mentalement stable. Sinon → STOP TRADING.",
  },
];

// -- ICT London Sessions ----------------------------------------
const ICT_LONDON_SESSIONS = [
  {
    id: "pre_london",
    label: "Pré-Londres",
    time: "06h00 - 08h00",
    color: "#4488ff",
    emoji: "🌅",
    danger: false,
    badge: null,
    objective: "Le marché finit souvent le range asiatique et prépare la liquidité pour Londres.",
    observe: [
      { label: "Asian High / Low", note: "Limites du range asiatique à tracer" },
      { label: "PDH / PDL",        note: "Previous Day High / Low" },
      { label: "Equal Highs/Lows", note: "Liquidité évidente, stops visibles" },
      { label: "Imbalances H1/M15", note: "FVG utilisables comme Draw On Liquidity" },
    ],
    doList:   ["Tracer Asian High / Low", "Tracer PDH / PDL", "Identifier la liquidité évidente", "Noter le biais de journée"],
    dontList: ["Entrer avant 08h00", "Anticiper le move de Londres", "Ignorer le range asiatique"],
    subsessions: null,
    checklist: null,
    mindset: null,
  },
  {
    id: "london_open",
    label: "London Open",
    time: "08h00 - 09h00",
    color: "#f0a020",
    emoji: "🚀",
    danger: false,
    badge: "MANIPULATION",
    objective: "Très souvent : sweep asiatique, Judas Swing, manipulation initiale. NE PAS se précipiter.",
    observe: null,
    doList:   ["Observer le sweep sans entrer", "Attendre la manipulation complète", "Identifier le Judas Swing"],
    dontList: ["Entrer en FOMO sur l'impulsion", "Anticiper avant le sweep", "Trader au milieu du range asiatique"],
    subsessions: null,
    checklist: null,
    mindset: "Beaucoup perdent ici en anticipant. Observer = discipline. Le move réel vient après le sweep.",
  },
  {
    id: "london_silver",
    label: "London Silver Bullet",
    time: "09h00 - 10h00",
    color: "#8899bb",
    emoji: "🎯",
    danger: false,
    badge: "FENETRE PRINCIPALE",
    objective: "Fenêtre la plus importante de Londres. ICT cherche : liquidité prise, MSS, displacement, FVG propre, entrée disciplinée.",
    observe: null,
    doList:   ["Chercher sweep + MSS", "Attendre displacement clair", "Entrer sur FVG propre", "SL derrière le sweep"],
    dontList: ["Entrer sans MSS", "Entrer sans displacement", "SL aléatoire", "Entrer en milieu de bougie"],
    subsessions: null,
    checklist: null,
    mindset: null,
  },
  {
    id: "london_cont",
    label: "Continuation Londres",
    time: "10h00 - 11h00",
    color: "#7888a0",
    emoji: "📈",
    danger: true,
    badge: null,
    objective: "Continuation possible du move, distribution, ou consolidation avant NY. Moins de qualité.",
    observe: null,
    doList:   ["Possible continuation si setup A+", "Réduire le risque", "Prendre profits partiels"],
    dontList: ["Forcer de nouveaux trades", "Ignorer la baisse de qualité", "FOMO sur second push"],
    subsessions: null,
    checklist: null,
    mindset: "Moins de qualité — attention aux faux setups. Après 11h00 : réduire fortement l'activité.",
  },
];

const ICT_LONDON_STEPS = [
  { step: 1, label: "Liquidité prise", color: "#f0a020", icon: "💧", desc: "Asian Low sweep — stop hunt, bougie impulsive, rejet clair. Ne jamais entrer sans cette étape.", critical: true },
  { step: 2, label: "MSS / CHOCH",    color: "#aa88ff", icon: "🔄", desc: "Changement de structure, break clair. Sans MSS → PAS DE TRADE. C'est la règle absolue.", critical: true },
  { step: 3, label: "Displacement",   color: "#00aaff", icon: "⚡", desc: "Grosse impulsion, bougies agressives, déséquilibre clair. Valide l'intention institutionnelle.", critical: true },
  { step: 4, label: "FVG",            color: "#8899bb", icon: "📦", desc: "Attendre le retracement dans le Fair Value Gap. Pas d'entrée au hasard sur le move.", critical: false },
  { step: 5, label: "Entrée + SL",    color: "#8899bb", icon: "🎯", desc: "Entrée dans le FVG après confirmation. SL toujours derrière le sweep, jamais aléatoire.", critical: false },
];

const ICT_LONDON_RULES = [
  { icon: "❌", text: "Pas de trade sans liquidité prise",            critical: true  },
  { icon: "❌", text: "Pas de trade au milieu du range asiatique",    critical: true  },
  { icon: "❌", text: "Pas de FOMO après impulsion — laisser partir", critical: true  },
  { icon: "❌", text: "Pas de revenge trading — après 2 pertes : STOP", critical: true },
  { icon: "❌", text: "Pas de scalping émotionnel",                   critical: true  },
  { icon: "📊", text: "Risque max : 0.5% à 1% par trade",            critical: false },
  { icon: "🎯", text: "1 à 2 setups MAX par session",                critical: false },
  { icon: "🏆", text: "1 bon trade > 10 mauvais trades",             critical: false },
];

const ICT_LONDON_ROUTINE = [
  { time: "07h00", action: "Préparation",       detail: "Asian H/L, PDH/PDL, liquidité, biais",               color: "#4488ff" },
  { time: "08h00", action: "Observation",       detail: "Observer sweep et manipulation sans entrer",           color: "#f0a020" },
  { time: "09h00", action: "Fenêtre principale",detail: "Chercher sweep + MSS + displacement + FVG",           color: "#8899bb" },
  { time: "10h00", action: "Réduction activité",detail: "Possible continuation — moins de qualité",            color: "#7888a0" },
  { time: "11h00", action: "Arrêt Londres",     detail: "Réduire fortement ou arrêter complètement",           color: "#ff4455" },
];

const ICT_NY_STEPS = [
  { step: 1, label: "Liquidité prise", color: "#f0a020", icon: "💧", desc: "Asian High/Low ou London High/Low sweepé. Stop hunt clair, bougie impulsive, rejet.", critical: true  },
  { step: 2, label: "MSS / CHOCH",     color: "#aa88ff", icon: "🔄", desc: "Changement de structure clair après le sweep. Sans MSS → PAS DE TRADE. Règle absolue.", critical: true  },
  { step: 3, label: "Displacement",    color: "#00aaff", icon: "⚡", desc: "Grosse impulsion, bougies agressives, déséquilibre. Valide l'intention institutionnelle.", critical: true  },
  { step: 4, label: "FVG propre",      color: "#8899bb", icon: "📦", desc: "Attendre le retracement dans le Fair Value Gap. Impulsion + retracement + entrée.", critical: false },
  { step: 5, label: "Entrée + SL",     color: "#8899bb", icon: "🎯", desc: "Entrée dans le FVG après confirmation. SL toujours derrière le sweep, jamais aléatoire.", critical: false },
];

const ICT_NY_RULES = [
  { icon: "❌", text: "Pas de trade sans liquidité prise",                   critical: true  },
  { icon: "❌", text: "Pas de trade au milieu du range",                      critical: true  },
  { icon: "❌", text: "Pas de revenge trade après 16h30",                     critical: true  },
  { icon: "❌", text: "Pas de FOMO après impulsion — laisser partir le move", critical: true  },
  { icon: "❌", text: "Pas de scalping émotionnel pendant Lunch",             critical: true  },
  { icon: "📊", text: "Risque max : 0.5% à 1% par trade",                    critical: false },
  { icon: "🎯", text: "1 à 2 setups MAX par session",                        critical: false },
  { icon: "🏆", text: "1 bon trade > 10 mauvais trades",                     critical: false },
];

const ICT_NY_ROUTINE = [
  { time: "13h00", action: "Préparation",     detail: "London H/L, Asian H/L, PDH/PDL, DOL, news",          color: "#aa88ff" },
  { time: "15h30", action: "Opening Drive",   detail: "Observer sweep + manipulation sans entrer",            color: "#f0a020" },
  { time: "16h00", action: "Silver Bullet",   detail: "Fenêtre principale — sweep+MSS+displacement+FVG",     color: "#8899bb" },
  { time: "17h00", action: "Continuation",    detail: "Second push possible — réduire le risque",            color: "#7888a0" },
  { time: "18h00", action: "NY Lunch — STOP", detail: "Chop dangereux — arrêter ou risque minimal",          color: "#ff4455" },
  { time: "19h30", action: "PM Silver Bullet",detail: "Seulement si rentable + mentalement stable",          color: "#f0a020" },
  { time: "22h00", action: "Fin de session",  detail: "Arrêt complet, bilan de journée",                    color: "#5a6a82" },
];

const ICT_NY_EXAMPLE = [
  { time: "15h30", label: "London H/L identifiés", color: "#4488ff" },
  { time: "15h40", label: "Opening Drive sweep",    color: "#f0a020" },
  { time: "15h55", label: "Réintégration",          color: "#f0a020" },
  { time: "16h05", label: "MSS bullish",            color: "#aa88ff" },
  { time: "16h15", label: "Displacement",           color: "#00aaff" },
  { time: "16h25", label: "Retrace dans FVG",       color: "#8899bb" },
  { time: "16h30", label: "Entrée LONG",            color: "#8899bb" },
];

// -- SessionCard -----------------------------------------------
function SessionCard({ session }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${session.color}25`, borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: session.danger ? 'rgba(255,68,85,0.06)' : 'rgba(14,15,22,0.5)', cursor: 'pointer', borderLeft: `3px solid ${session.color}`, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = `${session.color}08`}
        onMouseLeave={e => e.currentTarget.style.background = session.danger ? 'rgba(255,68,85,0.06)' : 'rgba(14,15,22,0.5)'}
      >
        <span style={{ fontSize: '18px' }}>{session.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: session.color }}>{session.label}</span>
            {session.badge && <span style={{ fontSize:'11px', background: `${session.color}20`, border: `1px solid ${session.color}40`, color: session.color, padding: '1px 6px', borderRadius: '2px', letterSpacing: '0.5px', fontWeight: '700' }}>{session.badge}</span>}
            {session.danger && <span style={{ fontSize:'11px', background: 'rgba(255,68,85,0.15)', border: '1px solid rgba(255,68,85,0.35)', color: '#ff4455', padding: '1px 6px', borderRadius: '2px', letterSpacing: '0.5px', fontWeight: '700' }}>DANGER</span>}
          </div>
          <div style={{ fontSize:'13px', color: '#5868a0', marginTop: '2px' }}>🕒 {session.time}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={session.color} strokeWidth="2" strokeLinecap="round">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
      </div>
      {open && (
        <div style={{ padding: '14px 16px', background: 'rgba(5,12,8,0.6)', borderTop: `1px solid ${session.color}15` }}>
          <div style={{ fontSize:'13px', color: '#7888a0', marginBottom: '14px', lineHeight: '1.6', fontStyle: 'italic', padding: '8px 12px', background: `${session.color}06`, borderRadius: '4px', borderLeft: `2px solid ${session.color}40` }}>
            {session.objective}
          </div>
          {session.subsessions && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '8px' }}>DÉCOUPAGE INTERNE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {session.subsessions.map((s, i) => (
                  <div key={i} style={{ padding: '9px 12px', background: s.hot ? `${s.color}10` : 'rgba(14,15,22,0.4)', border: `1px solid ${s.hot ? s.color + '30' : 'rgba(136,153,187,0.06)'}`, borderRadius: '5px', borderLeft: `2px solid ${s.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize:'13px', fontWeight: '700', color: s.color }}>{s.label}</span>
                      {s.hot && <span style={{ fontSize:'11px', color: s.color, background: `${s.color}15`, padding: '1px 5px', borderRadius: '2px' }}>HOT</span>}
                      <span style={{ fontSize:'12px', color: '#5868a0' }}>{s.time}</span>
                    </div>
                    <div style={{ fontSize:'13px', color: '#7888a0', lineHeight: '1.5' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {session.observe && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '8px' }}>CE QU'IL FAUT OBSERVER</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {session.observe.map((o, i) => (
                  <div key={i} style={{ padding: '7px 10px', background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.08)', borderRadius: '4px' }}>
                    <div style={{ fontSize:'13px', color: '#dde4ef', fontWeight: '600' }}>{o.label}</div>
                    <div style={{ fontSize:'12px', color: '#5a6a82', marginTop: '2px' }}>{o.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: session.checklist || session.mindset ? '14px' : 0 }}>
            <div>
              <div style={{ fontSize:'12px', color: '#8899bb', letterSpacing: '2px', marginBottom: '6px' }}>FAIRE ✓</div>
              {session.doList.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize:'13px', color: '#6aaa7a', marginBottom: '3px' }}>
                  <span style={{ color: '#8899bb', flexShrink: 0 }}>▸</span>{d}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:'12px', color: '#ff4455', letterSpacing: '2px', marginBottom: '6px' }}>EVITER ✗</div>
              {session.dontList.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize:'13px', color: '#aa6a6a', marginBottom: '3px' }}>
                  <span style={{ color: '#ff4455', flexShrink: 0 }}>✗</span>{d}
                </div>
              ))}
            </div>
          </div>
          {session.checklist && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '8px' }}>CHECKLIST ICT AVANT ENTREE</div>
              {session.checklist.map((c, i) => (
                <div key={i} style={{ padding: '8px 12px', background: 'rgba(136,153,187,0.05)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '5px', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(136,153,187,0.12)', border: '1px solid rgba(136,153,187,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize:'12px', color: '#8899bb', flexShrink: 0, fontWeight: '700' }}>{c.step}</div>
                    <span style={{ fontSize:'13px', color: '#dde4ef', fontWeight: '600' }}>{c.question}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingLeft: '28px' }}>
                    {c.items.map((item, j) => (
                      <span key={j} style={{ fontSize:'12px', color: item.includes('PAS DE TRADE') ? '#ff4455' : '#6878a0', background: item.includes('PAS DE TRADE') ? 'rgba(255,68,85,0.1)' : 'rgba(136,153,187,0.06)', border: `1px solid ${item.includes('PAS DE TRADE') ? 'rgba(255,68,85,0.25)' : 'rgba(136,153,187,0.12)'}`, padding: '2px 7px', borderRadius: '3px', fontWeight: item.includes('PAS DE TRADE') ? '700' : '400' }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {session.mindset && (
            <div style={{ padding: '8px 12px', background: 'rgba(240,160,32,0.06)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '5px', fontSize:'13px', color: '#c8a060', lineHeight: '1.5' }}>
              🧠 {session.mindset}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- LondonTab ------------------------------------------------
function LondonTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SessionsQuickGrid sessions={ICT_LONDON_SESSIONS} />

      <div>
        <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '10px' }}>SESSIONS ICT — LONDON (HEURE FRANÇAISE)</div>
        {ICT_LONDON_SESSIONS.map(s => <SessionCard key={s.id} session={s} />)}
      </div>

      <EntrySteps steps={ICT_LONDON_STEPS} mantra="La liquidité d'abord. Le déplacement ensuite." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <RoutineColumn title="ROUTINE IDÉALE LONDON" routine={ICT_LONDON_ROUTINE} />
        <RulesColumn rules={ICT_LONDON_RULES} />
      </div>

      <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', padding: '14px 16px' }}>
        <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '12px' }}>EXEMPLE COMPLET MNQ — SESSION LONDON</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { time: "02h-08h", label: "Asie crée equal lows",   color: "#4488ff" },
            { time: "08h15",   label: "Londres sweep les lows",  color: "#f0a020" },
            { time: "08h25",   label: "Réintégration",           color: "#f0a020" },
            { time: "08h35",   label: "MSS bullish",             color: "#aa88ff" },
            { time: "08h40",   label: "Displacement",            color: "#00aaff" },
            { time: "08h45",   label: "Retrace dans FVG",        color: "#8899bb" },
            { time: "09h00",   label: "Entrée LONG",             color: "#8899bb" },
          ].map((e, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ textAlign: 'center', padding: '6px 10px', background: `${e.color}10`, border: `1px solid ${e.color}30`, borderRadius: '5px' }}>
                <div style={{ fontSize:'12px', color: '#3c4c64', marginBottom: '2px' }}>{e.time}</div>
                <div style={{ fontSize:'13px', color: e.color, fontWeight: '600' }}>{e.label}</div>
              </div>
              {i < arr.length - 1 && <span style={{ color: '#3c4c64', fontSize: '14px' }}>→</span>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '16px', fontSize:'13px' }}>
          <span style={{ color: '#ff4455' }}>SL : sous le sweep</span>
          <span style={{ color: '#8899bb' }}>TP : Asian High / PDH / liquidity pool</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px', background: 'rgba(68,136,255,0.06)', border: '1px solid rgba(68,136,255,0.2)', borderRadius: '8px', borderLeft: '3px solid #4488ff' }}>
        <div style={{ fontSize:'12px', color: '#4488ff', letterSpacing: '2px', marginBottom: '8px' }}>MENTALITE ICT LONDON</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {["Patient", "Sélectif", "Peu de trades", "Exécution mécanique", "Stop si qualité baisse"].map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize:'13px', color: '#7888a0' }}>
              <span style={{ color: '#8899bb' }}>✔</span>{m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- NewYorkTab -----------------------------------------------
function NewYorkTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SessionsQuickGrid sessions={ICT_SESSIONS} />

      <div>
        <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '10px' }}>SESSIONS ICT — NEW YORK (HEURE FRANÇAISE)</div>
        {ICT_SESSIONS.map(s => <SessionCard key={s.id} session={s} />)}
      </div>

      <EntrySteps steps={ICT_NY_STEPS} mantra="La liquidité d'abord. Le déplacement ensuite." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <RoutineColumn title="ROUTINE IDÉALE NEW YORK" routine={ICT_NY_ROUTINE} />
        <RulesColumn rules={ICT_NY_RULES} />
      </div>

      <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', padding: '14px 16px' }}>
        <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '12px' }}>EXEMPLE COMPLET MNQ — SESSION NEW YORK</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {ICT_NY_EXAMPLE.map((e, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ textAlign: 'center', padding: '6px 10px', background: `${e.color}10`, border: `1px solid ${e.color}30`, borderRadius: '5px' }}>
                <div style={{ fontSize:'12px', color: '#3c4c64', marginBottom: '2px' }}>{e.time}</div>
                <div style={{ fontSize:'13px', color: e.color, fontWeight: '600' }}>{e.label}</div>
              </div>
              {i < arr.length - 1 && <span style={{ color: '#3c4c64', fontSize: '14px' }}>→</span>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '16px', fontSize:'13px' }}>
          <span style={{ color: '#ff4455' }}>SL : sous le sweep / derrière la liquidité prise</span>
          <span style={{ color: '#8899bb' }}>TP : London H/L · PDH/PDL · imbalance suivante</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px', background: 'rgba(136,153,187,0.06)', border: '1px solid rgba(136,153,187,0.18)', borderRadius: '8px', borderLeft: '3px solid #8899bb' }}>
        <div style={{ fontSize:'12px', color: '#8899bb', letterSpacing: '2px', marginBottom: '8px' }}>MENTALITE ICT NEW YORK</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {["Patient", "Sélectif", "Peu de trades", "Exécution mécanique", "Stop si qualité baisse"].map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize:'13px', color: '#7888a0' }}>
              <span style={{ color: '#8899bb' }}>✔</span>{m}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
          <div style={{ fontSize:'13px', color: '#6a8a6a' }}>Le travail <span style={{ color: '#ff4455', fontWeight: '700' }}>N'EST PAS</span> trader souvent.</div>
          <div style={{ fontSize: '13px', color: '#dde4ef', fontWeight: '700', marginTop: '4px' }}>Le travail <span style={{ color: '#8899bb' }}>EST</span> attendre le bon moment institutionnel.</div>
        </div>
      </div>
    </div>
  );
}

// -- Main -------------------------------------------------------
export default function StrategieDiscipline() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('strategie_tab') || 'newyork');

  return (
    <div style={{ padding: '24px 28px', width: '100%', boxSizing: 'border-box', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize:'11px', color: ST.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom: '6px' }}>SESSIONS ICT</div>
        <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#e8edf8', margin: '0 0 4px' }}>Stratégie et Discipline</h1>
        <div style={{ fontSize:'12px', color: ST.textTertiary }}>Sessions de trading · Modèles d'entrée ICT · Routines</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
        <button onClick={() => { setActiveTab('newyork'); localStorage.setItem('strategie_tab', 'newyork'); }}
          style={{ padding: '8px 18px', borderRadius: '99px', display:'flex', alignItems:'center', gap:'6px', border: activeTab === 'newyork' ? `1px solid ${ST.borderSecondary}` : `1px solid ${ST.border}`, background: activeTab === 'newyork' ? ST.surfSecondary : 'transparent', color: activeTab === 'newyork' ? ST.textPrimary : ST.textSecondary, fontSize:'12px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s' }}>
          🇺🇸 US New York
        </button>
        <button onClick={() => { setActiveTab('london'); localStorage.setItem('strategie_tab', 'london'); }}
          style={{ padding: '8px 18px', borderRadius: '99px', display:'flex', alignItems:'center', gap:'6px', border: activeTab === 'london' ? `1px solid ${ST.borderSecondary}` : `1px solid ${ST.border}`, background: activeTab === 'london' ? ST.surfSecondary : 'transparent', color: activeTab === 'london' ? ST.textPrimary : ST.textSecondary, fontSize:'12px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s' }}>
          🇬🇧 GB London
        </button>
      </div>

      {activeTab === 'newyork' && <NewYorkTab />}
      {activeTab === 'london'  && <LondonTab />}
    </div>
  );
}
