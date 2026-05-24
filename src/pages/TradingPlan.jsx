// -- ICT Sessions ------------------------------------------------
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
    color: "#00ff88",
    emoji: "🚀",
    danger: false,
    badge: "LA PLUS IMPORTANTE",
    objective: "C'est LE coeur du trading ICT sur MNQ. La majorité des setups A+ arrivent ici.",
    observe: null,
    doList:   ["Trader uniquement dans le sens du DOL", "Entrer après sweep de liquidité", "Attendre un displacement clair"],
    dontList: ["Pas de trade au milieu du range", "Pas de revenge trade après 16h30", "Pas de setup sans liquidité prise"],
    subsessions: [
      { label: "Opening Drive",              time: "15h30 - 16h00", color: "#f0a020", hot: false, desc: "Sweep violent, Judas Swing, faux départ, prise de liquidité Londres." },
      { label: "Silver Bullet Principal",    time: "16h00 - 17h00", color: "#00ff88", hot: true,  desc: "Fenêtre la plus importante. Chercher MSS/CHOCH, displacement, FVG, retracement propre." },
      { label: "Continuation / Distribution",time: "17h00 - 18h00", color: "#8aaa90", hot: false, desc: "Extension du move, prise de profits, second push possible." },
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

const ICT_TOPSTEP_RULES = [
  { icon: "🎯", label: "Objectif principal", text: "1 à 2 trades MAX par jour.",                    critical: true  },
  { icon: "💧", label: "Règle d'or",          text: "Attendre la liquidité.",                        critical: true  },
  { icon: "🧠", label: "Règle mentale",        text: "Le marché sera encore là demain.",             critical: false },
  { icon: "🛑", label: "Après 2 pertes",       text: "STOP. Sans exception.",                        critical: true  },
  { icon: "✅", label: "Après target",          text: "STOP. Protège ton gain.",                      critical: true  },
  { icon: "❌", label: "Pas de trade si",       text: "Émotions, frustration, besoin de rattraper.", critical: true  },
];

import { useState } from 'react';

// ── Data ──────────────────────────────────────────────────────

const PLANS = {
  payout5j: {
    id: 'payout5j',
    label: 'Payout 5 jours',
    abbr: '5J',
    color: '#00ff88',
    subtitle: 'Cycle régulier · Survie du compte',
    account: 50000,
    drawdown: 2000,
    riskPerTrade: 250,
    maxRiskPerTrade: 500,
    dailyStop: -500,
    dailyTarget: [500, 750],
    payoutTarget: [1000, 1500],
    cycleTarget: [2000, 2500],
    maxTrades: 3,
    instrument: 'MNQ',
    contracts: [3, 5],
    cycle: [
      { day: 1, target: 500,  note: 'Journée type' },
      { day: 2, target: 500,  note: 'Journée type' },
      { day: 3, target: 300,  note: 'Journée calme' },
      { day: 4, target: 700,  note: 'Meilleure journée' },
      { day: 5, target: -200, note: 'Break / petite perte' },
    ],
    rules: [
      { icon: '🛑', text: '2 trades perdants → STOP immédiat', critical: true },
      { icon: '✅', text: '1 bon trade profitable → tu peux arrêter', critical: false },
      { icon: '📊', text: 'Max 3 trades par jour', critical: true },
      { icon: '🧘', text: 'Pas de trade = victoire si pas de setup', critical: false },
      { icon: '🚫', text: 'Ne pas monter les lots après 2 wins', critical: true },
      { icon: '🚫', text: 'Ne jamais rattraper une perte', critical: true },
      { icon: '📅', text: 'Ne pas trader tous les jours absolument', critical: false },
    ],
    phases: null,
  },
  payout3j: {
    id: 'payout3j',
    label: 'Payout 3 jours',
    abbr: '3J',
    color: '#f0a020',
    subtitle: 'Consistance 40% · Cycle court',
    account: 50000,
    drawdown: 2000,
    riskPerTrade: 250,
    maxRiskPerTrade: 500,
    dailyStop: -500,
    dailyTarget: [400, 600],
    payoutTarget: [1000, 1500],
    cycleTarget: [1400, 2500],
    maxTrades: 3,
    instrument: 'MNQ',
    contracts: [3, 5],
    cycle: [
      { day: 1, target: 500,  note: 'Objectif zone idéale' },
      { day: 2, target: 400,  note: 'Journée calme' },
      { day: 3, target: 500,  note: 'Objectif zone idéale' },
    ],
    consistencyNote: 'Règle des 40% : aucun jour ne doit dépasser 40% du total du cycle.\nEx: total 1400$ → max 560$/jour autorisé pour le payout.',
    rules: [
      { icon: '📐', text: 'Aucun jour > 40% du total 3 jours', critical: true },
      { icon: '🛑', text: '2 trades perdants → STOP immédiat', critical: true },
      { icon: '📊', text: 'Max 3 trades par jour', critical: true },
      { icon: '🎯', text: 'Zone idéale : 400$–600$/jour', critical: false },
      { icon: '📦', text: '3–5 MNQ maximum (5 seulement si A+ setup)', critical: false },
      { icon: '🚫', text: 'Ne pas viser 1000$ si ça dépasse 40%', critical: true },
      { icon: "✅", text: "Objectif atteint = STOP, pas d'avidité", critical: false },
    ],
    phases: null,
  },
  liveFunded: {
    id: 'liveFunded',
    label: 'Live Funded',
    abbr: 'LIVE',
    color: '#aa88ff',
    subtitle: 'Conserver & Scaler · Mode revenu',
    account: 50000,
    drawdown: 2000,
    riskPerTrade: 250,
    maxRiskPerTrade: 400,
    dailyStop: -500,
    dailyTarget: [300, 1000],
    payoutTarget: null,
    cycleTarget: null,
    maxTrades: 3,
    instrument: 'MNQ',
    contracts: [3, 5],
    cycle: null,
    rules: [
      { icon: '🏆', text: 'Protéger le compte AVANT de gagner', critical: true },
      { icon: '🛑', text: 'Perdre un live funded = retour à zéro', critical: true },
      { icon: '💰', text: 'Garder un live funded = revenu long terme', critical: false },
      { icon: '🧠', text: 'Mode "conserver et scaler", pas "aller vite"', critical: true },
      { icon: '📊', text: 'Toujours max 1% risque par trade', critical: true },
      { icon: '🚫', text: 'Pas de gros coup rapide', critical: true },
      { icon: '✅', text: 'Petit mais constant = cash régulier', critical: false },
    ],
    phases: [
      {
        label: 'Phase 1',
        range: '0 → +3 000$',
        color: '#00ff88',
        risk: '250$ max',
        target: '300$–500$/jour',
        contracts: '3 MNQ',
        note: 'Sécuriser le compte, ne rien forcer',
      },
      {
        label: 'Phase 2',
        range: '+3 000$ → +8 000$',
        color: '#f0a020',
        risk: '400$',
        target: '500$–700$/jour',
        contracts: '4–5 MNQ',
        note: 'Augmenter légèrement les contrats',
      },
      {
        label: 'Phase 3',
        range: '+8 000$ et +',
        color: '#aa88ff',
        risk: '500$ max (1%)',
        target: "Jusqu'à 1000$/jour",
        contracts: '5–7 MNQ',
        note: 'Toujours max 1% — scale progressif',
      },
    ],
  },
};

const GOLD_RULES = [
  "Ce n'est PAS ta capacité à faire 1000$ qui compte.",
  "C'est ta capacité à faire 500$ tous les jours sans craquer.",
  'Petit mais constant = cash régulier, pas gros coup rapide.',
  'Tu protèges le compte avant de gagner.',
];

// ── Helpers ───────────────────────────────────────────────────
function fmt(n, sign = true) {
  if (n == null) return '—';
  const abs = Math.abs(n).toLocaleString('fr-FR');
  if (!sign) return `${abs}$`;
  return `${n >= 0 ? '+' : '-'}${abs}$`;
}
function pnlColor(n) {
  if (n > 0) return '#00ff88';
  if (n < 0) return '#ff4455';
  return '#8aaa90';
}

// ── Sub-components ────────────────────────────────────────────
function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '7px', padding: '12px 14px', borderTop: `2px solid ${color ?? '#3a6a4a'}` }}>
      <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: color ?? '#c8d8c8', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: '#2a5a32', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function RuleItem({ rule }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', background: rule.critical ? 'rgba(255,68,85,0.04)' : 'rgba(10,28,18,0.3)', border: `1px solid ${rule.critical ? 'rgba(255,68,85,0.12)' : 'rgba(0,255,136,0.04)'}`, borderLeft: `2px solid ${rule.critical ? '#ff4455' : '#2a5a32'}`, borderRadius: '5px' }}>
      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{rule.icon}</span>
      <span style={{ fontSize: '12px', color: rule.critical ? '#e8c8c8' : '#8aaa90', lineHeight: '1.5' }}>{rule.text}</span>
      {rule.critical && <span style={{ marginLeft: 'auto', fontSize: '8px', color: '#ff4455', background: 'rgba(255,68,85,0.12)', border: '1px solid rgba(255,68,85,0.25)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.5px', flexShrink: 0, alignSelf: 'center' }}>CRITIQUE</span>}
    </div>
  );
}

function DayCycleTable({ plan }) {
  if (!plan.cycle) return null;
  const total = plan.cycle.reduce((s, d) => s + d.target, 0);
  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,255,136,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px' }}>EXEMPLE DE CYCLE</span>
        <span style={{ fontSize: '11px', color: pnlColor(total), fontWeight: '700' }}>Total : {fmt(total)}</span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '6px 14px', fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.04)', background: 'rgba(0,0,0,0.2)' }}>
        <span>JOUR</span><span>OBJECTIF</span><span>% DU TOTAL</span><span>NOTE</span>
      </div>
      {plan.cycle.map((d, i) => {
        const pct = total > 0 ? ((d.target / total) * 100).toFixed(0) : '—';
        const over40 = total > 0 && (d.target / total) > 0.4 && d.target > 0;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '9px 14px', fontSize: '12px', borderBottom: i < plan.cycle.length - 1 ? '1px solid rgba(0,255,136,0.03)' : 'none', background: i % 2 === 0 ? 'rgba(10,28,18,0.3)' : 'transparent', alignItems: 'center' }}>
            <span style={{ color: '#4a7a5a', fontWeight: '700' }}>J{d.day}</span>
            <span style={{ color: pnlColor(d.target), fontWeight: '600' }}>{fmt(d.target)}</span>
            <span style={{ color: over40 ? '#ff4455' : '#6a8a7a' }}>
              {d.target > 0 ? `${pct}%` : '—'}
              {over40 && <span style={{ marginLeft: '4px', fontSize: '9px', color: '#ff4455' }}>⚠ &gt;40%</span>}
            </span>
            <span style={{ color: '#4a6a54', fontSize: '11px' }}>{d.note}</span>
          </div>
        );
      })}
      {/* Total row */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '10px 14px', fontSize: '13px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(0,255,136,0.08)', alignItems: 'center' }}>
        <span style={{ color: '#3a6a4a', fontSize: '10px', letterSpacing: '1px' }}>TOTAL</span>
        <span style={{ color: pnlColor(total), fontWeight: '700' }}>{fmt(total)}</span>
        <span style={{ color: '#3a6a4a' }}>100%</span>
        <span style={{ color: plan.color, fontSize: '10px' }}>Payout : {fmt(plan.payoutTarget?.[0])} → {fmt(plan.payoutTarget?.[1])}</span>
      </div>
    </div>
  );
}

function Simulator({ plan }) {
  const [days, setDays] = useState(plan.cycle ? plan.cycle.map(d => String(d.target)) : ['500', '400', '500']);
  const values = days.map(d => parseFloat(d.replace(',', '.')) || 0);
  const total = values.reduce((s, v) => s + v, 0);
  const max = Math.max(...values);
  const consistency = total > 0 ? (max / total * 100).toFixed(1) : 0;
  const consistencyOk = total > 0 && max / total <= 0.40;

  function addDay() { if (days.length < 10) setDays(d => [...d, '0']); }
  function removeDay() { if (days.length > 1) setDays(d => d.slice(0, -1)); }

  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', padding: '14px' }}>
      <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>SIMULATEUR DE CYCLE</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
        {days.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px' }}>J{i + 1}</span>
            <input
              type="number"
              value={d}
              onChange={e => setDays(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
              style={{ width: '72px', background: 'rgba(10,28,18,0.6)', border: `1px solid ${parseFloat(d) < 0 ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.15)'}`, borderRadius: '4px', padding: '6px 8px', color: parseFloat(d) < 0 ? '#ff4455' : '#00ff88', fontSize: '13px', fontFamily: 'inherit', outline: 'none', textAlign: 'center', caretColor: '#00ff88' }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button onClick={addDay} style={{ background: 'none', border: '1px solid #1a3a22', color: '#3a6a4a', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', lineHeight: 1 }}>+</button>
          <button onClick={removeDay} style={{ background: 'none', border: '1px solid #1a3a22', color: '#3a6a4a', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', lineHeight: 1 }}>−</button>
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '8px 10px', borderTop: `2px solid ${pnlColor(total)}` }}>
          <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px', marginBottom: '3px' }}>TOTAL CYCLE</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: pnlColor(total) }}>{fmt(total)}</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '8px 10px', borderTop: `2px solid ${consistencyOk ? '#00ff88' : '#ff4455'}` }}>
          <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px', marginBottom: '3px' }}>MEILLEUR JOUR / TOTAL</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: consistencyOk ? '#00ff88' : '#ff4455' }}>{consistency}%</span>
            <span style={{ fontSize: '10px', color: consistencyOk ? '#00ff88' : '#ff4455' }}>{consistencyOk ? '✓ OK' : '✗ >40%'}</span>
          </div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '8px 10px', borderTop: `2px solid ${plan.color}` }}>
          <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px', marginBottom: '3px' }}>PAYOUT POSSIBLE</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: plan.color }}>
            {total > 0 && consistencyOk ? fmt(Math.round(total * 0.5)) : '—'}
          </div>
        </div>
      </div>

      {!consistencyOk && total > 0 && (
        <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255,68,85,0.06)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: '4px', fontSize: '11px', color: '#ff8888' }}>
          ⚠ Ton meilleur jour ({fmt(max)}) dépasse 40% du total → payout bloqué
        </div>
      )}
    </div>
  );
}

function PhaseTable({ phases }) {
  if (!phases) return null;
  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,255,136,0.06)' }}>
        <span style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px' }}>PROGRESSION PAR PHASE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 80px 130px 80px 1fr', padding: '6px 14px', fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.04)', background: 'rgba(0,0,0,0.2)' }}>
        <span>PHASE</span><span>CAPITAL</span><span>RISQUE</span><span>OBJECTIF/JOUR</span><span>CONTRATS</span><span>NOTE</span>
      </div>
      {phases.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 120px 80px 130px 80px 1fr', padding: '11px 14px', fontSize: '12px', borderBottom: i < phases.length - 1 ? '1px solid rgba(0,255,136,0.03)' : 'none', background: i % 2 === 0 ? 'rgba(10,28,18,0.3)' : 'transparent', alignItems: 'center', borderLeft: `2px solid ${p.color}` }}>
          <span style={{ color: p.color, fontWeight: '700', fontSize: '11px' }}>{p.label}</span>
          <span style={{ color: '#c8d8c8', fontSize: '11px' }}>{p.range}</span>
          <span style={{ color: '#f0a020' }}>{p.risk}</span>
          <span style={{ color: '#00ff88' }}>{p.target}</span>
          <span style={{ color: '#8aaa90' }}>{p.contracts}</span>
          <span style={{ color: '#4a6a54', fontSize: '11px' }}>{p.note}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

// -- SessionCard -----------------------------------------------
function SessionCard({ session }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${session.color}25`, borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: session.danger ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.5)', cursor: 'pointer', borderLeft: `3px solid ${session.color}`, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = `${session.color}08`}
        onMouseLeave={e => e.currentTarget.style.background = session.danger ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.5)'}
      >
        <span style={{ fontSize: '18px' }}>{session.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: session.color }}>{session.label}</span>
            {session.badge && <span style={{ fontSize: '8px', background: `${session.color}20`, border: `1px solid ${session.color}40`, color: session.color, padding: '1px 6px', borderRadius: '2px', letterSpacing: '0.5px', fontWeight: '700' }}>{session.badge}</span>}
            {session.danger && <span style={{ fontSize: '8px', background: 'rgba(255,68,85,0.15)', border: '1px solid rgba(255,68,85,0.35)', color: '#ff4455', padding: '1px 6px', borderRadius: '2px', letterSpacing: '0.5px', fontWeight: '700' }}>DANGER</span>}
          </div>
          <div style={{ fontSize: '11px', color: '#4a7a5a', marginTop: '2px' }}>🕒 {session.time}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={session.color} strokeWidth="2" strokeLinecap="round">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
      </div>
      {open && (
        <div style={{ padding: '14px 16px', background: 'rgba(5,12,8,0.6)', borderTop: `1px solid ${session.color}15` }}>
          <div style={{ fontSize: '12px', color: '#8aaa90', marginBottom: '14px', lineHeight: '1.6', fontStyle: 'italic', padding: '8px 12px', background: `${session.color}06`, borderRadius: '4px', borderLeft: `2px solid ${session.color}40` }}>
            {session.objective}
          </div>
          {session.subsessions && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>DÉCOUPAGE INTERNE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {session.subsessions.map((s, i) => (
                  <div key={i} style={{ padding: '9px 12px', background: s.hot ? `${s.color}10` : 'rgba(10,28,18,0.4)', border: `1px solid ${s.hot ? s.color + '30' : 'rgba(0,255,136,0.05)'}`, borderRadius: '5px', borderLeft: `2px solid ${s.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: s.color }}>{s.label}</span>
                      {s.hot && <span style={{ fontSize: '8px', color: s.color, background: `${s.color}15`, padding: '1px 5px', borderRadius: '2px' }}>HOT</span>}
                      <span style={{ fontSize: '10px', color: '#4a7a5a' }}>{s.time}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#8aaa90', lineHeight: '1.5' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {session.observe && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>CE QU'IL FAUT OBSERVER</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {session.observe.map((o, i) => (
                  <div key={i} style={{ padding: '7px 10px', background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600' }}>{o.label}</div>
                    <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '2px' }}>{o.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: session.checklist || session.mindset ? '14px' : 0 }}>
            <div>
              <div style={{ fontSize: '9px', color: '#00ff88', letterSpacing: '2px', marginBottom: '6px' }}>FAIRE ✓</div>
              {session.doList.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#6aaa7a', marginBottom: '3px' }}>
                  <span style={{ color: '#00ff88', flexShrink: 0 }}>▸</span>{d}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#ff4455', letterSpacing: '2px', marginBottom: '6px' }}>EVITER ✗</div>
              {session.dontList.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: '#aa6a6a', marginBottom: '3px' }}>
                  <span style={{ color: '#ff4455', flexShrink: 0 }}>✗</span>{d}
                </div>
              ))}
            </div>
          </div>
          {session.checklist && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>CHECKLIST ICT AVANT ENTREE</div>
              {session.checklist.map((c, i) => (
                <div key={i} style={{ padding: '8px 12px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '5px', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#00ff88', flexShrink: 0, fontWeight: '700' }}>{c.step}</div>
                    <span style={{ fontSize: '12px', color: '#c8d8c8', fontWeight: '600' }}>{c.question}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingLeft: '28px' }}>
                    {c.items.map((item, j) => (
                      <span key={j} style={{ fontSize: '10px', color: item.includes('PAS DE TRADE') ? '#ff4455' : '#5a8a6a', background: item.includes('PAS DE TRADE') ? 'rgba(255,68,85,0.1)' : 'rgba(0,255,136,0.05)', border: `1px solid ${item.includes('PAS DE TRADE') ? 'rgba(255,68,85,0.25)' : 'rgba(0,255,136,0.1)'}`, padding: '2px 7px', borderRadius: '3px', fontWeight: item.includes('PAS DE TRADE') ? '700' : '400' }}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {session.mindset && (
            <div style={{ padding: '8px 12px', background: 'rgba(240,160,32,0.06)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '5px', fontSize: '11px', color: '#c8a060', lineHeight: '1.5' }}>
              🧠 {session.mindset}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DisciplineTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
        {ICT_SESSIONS.map(s => (
          <div key={s.id} style={{ padding: '10px 12px', background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: '6px', borderTop: `2px solid ${s.color}` }}>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>{s.emoji}</div>
            <div style={{ fontSize: '11px', color: s.color, fontWeight: '700', marginBottom: '2px' }}>{s.label}</div>
            <div style={{ fontSize: '10px', color: '#3a6a4a' }}>{s.time}</div>
            {s.danger && <div style={{ fontSize: '9px', color: '#ff4455', marginTop: '3px' }}>⚠ DANGER</div>}
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>SESSIONS ICT — MNQ (HEURE FRANÇAISE)</div>
        {ICT_SESSIONS.map(s => <SessionCard key={s.id} session={s} />)}
      </div>
      <div>
        <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>DISCIPLINE ICT — TOPSTEP</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {ICT_TOPSTEP_RULES.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 140px 1fr', gap: '10px', alignItems: 'center', padding: '10px 14px', background: r.critical ? 'rgba(255,68,85,0.04)' : 'rgba(10,28,18,0.3)', border: `1px solid ${r.critical ? 'rgba(255,68,85,0.1)' : 'rgba(0,255,136,0.04)'}`, borderLeft: `2px solid ${r.critical ? '#ff4455' : '#2a5a32'}`, borderRadius: '5px' }}>
              <span style={{ fontSize: '15px' }}>{r.icon}</span>
              <span style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '1px' }}>{r.label.toUpperCase()}</span>
              <span style={{ fontSize: '12px', color: r.critical ? '#e8c8c8' : '#8aaa90' }}>{r.text}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px', background: 'rgba(170,136,255,0.06)', border: '1px solid rgba(170,136,255,0.2)', borderRadius: '8px', borderLeft: '3px solid #aa88ff' }}>
        <div style={{ fontSize: '9px', color: '#aa88ff', letterSpacing: '2px', marginBottom: '8px' }}>MENTALITE ICT PROFESSIONNELLE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '12px', color: '#6a5a8a' }}>Le travail <span style={{ color: '#ff4455', fontWeight: '700' }}>N'EST PAS</span> :</div>
          <div style={{ fontSize: '13px', color: '#aa6aaa', paddingLeft: '12px' }}>→ Trader souvent</div>
          <div style={{ fontSize: '12px', color: '#aa88ff', marginTop: '4px' }}>Le travail <span style={{ color: '#00ff88', fontWeight: '700' }}>EST</span> :</div>
          <div style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '700', paddingLeft: '12px' }}>→ Attendre le bon moment institutionnel.</div>
        </div>
      </div>
    </div>
  );
}

export default function TradingPlan() {
  const [activeTab, setActiveTab] = useState('discipline');
  const plan = PLANS[activeTab] ?? PLANS.payout5j;

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>DISCIPLINE</div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: '0 0 4px' }}>Règles & Plan de Trading</h1>
        <div style={{ fontSize: '11px', color: '#3a6a4a' }}>50 000$ · MNQ · 0.5% risque · Max 3 trades/jour</div>
      </div>

      {/* ── Gold rules banner ── */}
      <div style={{ marginBottom: '22px', padding: '14px 18px', background: 'rgba(240,160,32,0.07)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '8px', borderLeft: '3px solid #f0a020' }}>
        <div style={{ fontSize: '9px', color: '#f0a020', letterSpacing: '2px', marginBottom: '8px' }}>RÈGLES D'OR</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {GOLD_RULES.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: i < 2 ? '#f0d090' : '#8a7a5a' }}>
              <span style={{ color: '#f0a020', flexShrink: 0 }}>▸</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* -- Tabs -- */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', background: 'rgba(10,28,18,0.4)', padding: '5px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.07)' }}>
        <button onClick={() => setActiveTab('discipline')}
          style={{ flex: 1.2, padding: '10px 6px', borderRadius: '5px', border: activeTab === 'discipline' ? '1px solid #aa88ff40' : '1px solid transparent', background: activeTab === 'discipline' ? '#aa88ff12' : 'transparent', color: activeTab === 'discipline' ? '#aa88ff' : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', fontWeight: activeTab === 'discipline' ? '700' : '400', cursor: 'pointer', transition: 'all 0.15s' }}>
          <div style={{ fontSize: '13px', marginBottom: '2px' }}>🧠</div>
          <div style={{ fontSize: '10px', opacity: 0.8 }}>Discipline</div>
        </button>
        {Object.values(PLANS).map(p => (
          <button key={p.id} onClick={() => setActiveTab(p.id)}
            style={{ flex: 1, padding: '10px 6px', borderRadius: '5px', border: activeTab === p.id ? `1px solid ${p.color}40` : '1px solid transparent', background: activeTab === p.id ? `${p.color}12` : 'transparent', color: activeTab === p.id ? p.color : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', fontWeight: activeTab === p.id ? '700' : '400', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.5px' }}>
            <div style={{ fontSize: '13px', marginBottom: '2px' }}>{p.abbr}</div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>{p.label}</div>
          </button>
        ))}
      </div>

      {/* -- Discipline tab -- */}
      {activeTab === 'discipline' && <DisciplineTab />}

      {/* -- Plan tabs content -- */}
      {activeTab !== 'discipline' && (
      <div>
      {/* Plan header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: plan.color, boxShadow: `0 0 8px ${plan.color}`, animation: 'pulse 2s infinite' }} />
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: plan.color }}>{plan.label}</div>
          <div style={{ fontSize: '11px', color: '#3a6a4a' }}>{plan.subtitle}</div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '20px' }}>
        <StatBox label="RISQUE / TRADE" value={`${fmt(plan.riskPerTrade)}`} color="#f0a020" sub={`Max ${fmt(plan.maxRiskPerTrade)}`} />
        <StatBox label="STOP JOURNALIER" value={fmt(plan.dailyStop)} color="#ff4455" sub="Arrêt obligatoire" />
        <StatBox label="OBJECTIF / JOUR" value={`${fmt(plan.dailyTarget[0])} → ${fmt(plan.dailyTarget[1])}`} color={plan.color} sub="Zone idéale" />
        <StatBox label="CONTRATS" value={`${plan.contracts[0]}–${plan.contracts[1]} MNQ`} color="#8aaa90" sub="5 seulement si A+ setup" />
      </div>

      {/* ── Two columns: left = cycle/phases, right = rules ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cycle table or Phase table */}
          {plan.cycle && <DayCycleTable plan={plan} />}
          {plan.phases && <PhaseTable phases={plan.phases} />}

          {/* Consistency note for 3j */}
          {plan.consistencyNote && (
            <div style={{ padding: '12px 14px', background: 'rgba(240,160,32,0.06)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', color: '#f0a020', letterSpacing: '2px', marginBottom: '6px' }}>RÈGLE DES 40%</div>
              {plan.consistencyNote.split('\n').map((line, i) => (
                <div key={i} style={{ fontSize: '11px', color: i === 0 ? '#f0d090' : '#8a7a5a', marginBottom: '3px' }}>{line}</div>
              ))}
            </div>
          )}

          {/* Monthly projection */}
          {plan.cycleTarget && (
            <div style={{ padding: '12px 14px', background: 'rgba(10,28,18,0.5)', border: `1px solid ${plan.color}20`, borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>PROJECTION 30 JOURS</div>
              {activeTab === 'payout5j' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#6a8a7a' }}>6 cycles × {fmt(plan.cycleTarget[0])} → {fmt(plan.cycleTarget[1])}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: plan.color }}>6 000$ → 9 000$ retirés</div>
                  <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '3px' }}>Sans risque excessif</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#6a8a7a' }}>~10 cycles × {fmt(plan.cycleTarget[0])} → {fmt(plan.cycleTarget[1])}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: plan.color }}>10 000$ → 15 000$ potentiel</div>
                  <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '3px' }}>Si la règle des 40% est respectée</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Rules */}
        <div>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>RÈGLES — {plan.rules.filter(r => r.critical).length} CRITIQUES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {plan.rules.map((r, i) => <RuleItem key={i} rule={r} />)}
          </div>
        </div>
      </div>

      {/* ── Simulator ── */}
      <Simulator plan={plan} />

      {/* ── Weekly progression (5j & 3j) ── */}
      {activeTab !== 'liveFunded' && (
        <div style={{ marginTop: '20px', background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>PROGRESSION HEBDOMADAIRE (SEMAINES 1-2)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Semaine 1', contracts: '3 MNQ', target: '400$/jour', risk: '250$', note: 'Prendre les habitudes, ne pas forcer', color: '#00ff88' },
              { label: 'Semaine 2+', contracts: '5 MNQ', target: '500$–600$/jour', risk: '250$', note: 'Monter progressivement après stabilité', color: plan.color },
            ].map((w, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${w.color}20`, borderRadius: '6px', borderLeft: `2px solid ${w.color}` }}>
                <div style={{ fontSize: '11px', color: w.color, fontWeight: '700', marginBottom: '6px' }}>{w.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#4a7a5a' }}>Contrats</span>
                    <span style={{ color: '#c8d8c8' }}>{w.contracts}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#4a7a5a' }}>Objectif</span>
                    <span style={{ color: '#00ff88' }}>{w.target}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#4a7a5a' }}>Risque/trade</span>
                    <span style={{ color: '#f0a020' }}>{w.risk}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#3a5a32', marginTop: '4px', fontStyle: 'italic' }}>{w.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
