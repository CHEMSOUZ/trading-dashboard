import { useState, useEffect } from 'react';

// ── Redesign tokens (header / règles d'or / phases / colonnes / simulateur) ──
const RP = {
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

function IconStar({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3a1 1 0 0 0 1.477 -1.054l-1.091 -6.355l4.624 -4.5a1 1 0 0 0 -.557 -1.706l-6.379 -.925l-2.848 -5.766a1 1 0 0 0 -1.815 .002z" />
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

// ── Data ──────────────────────────────────────────────────────

const PLANS = {
  payout5j: {
    id: 'payout5j',
    label: 'Payout 5 jours',
    abbr: '5J',
    color: '#8899bb',
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
        color: '#8899bb',
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
  if (n > 0) return '#00cc77';
  if (n < 0) return '#ff3344';
  return '#7888a0';
}

// ── Sub-components ────────────────────────────────────────────
function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '7px', padding: '12px 14px', borderTop: `2px solid ${color ?? '#5a6a82'}` }}>
      <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1.5px', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: color ?? '#dde4ef', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize:'12px', color: '#3c4c64', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function RuleItem({ rule, isLast }) {
  const badge = rule.critical ? 'CRITIQUE' : rule.icon === '✅' ? 'OK' : 'INFO';
  const badgeStyle = badge === 'CRITIQUE'
    ? { background: 'rgba(226,75,74,0.14)', color: RP.danger }
    : badge === 'OK'
    ? { background: 'rgba(29,158,117,0.14)', color: RP.success }
    : { background: 'rgba(186,117,23,0.14)', color: RP.warn };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 14px', borderBottom: isLast ? 'none' : `1px solid ${RP.border}` }}>
      <span style={{ fontSize:'10px', fontWeight:'500', textTransform:'uppercase', padding:'2px 6px', borderRadius:'4px', flexShrink: 0, marginTop:'1px', ...badgeStyle }}>{badge}</span>
      <span style={{ fontSize:'12px', color: rule.critical ? RP.textPrimary : RP.textSecondary, fontWeight: rule.critical ? '500' : '400', lineHeight: '1.5' }}>{rule.text}</span>
    </div>
  );
}

function DayCycleTable({ plan }) {
  if (!plan.cycle) return null;
  const total = plan.cycle.reduce((s, d) => s + d.target, 0);
  return (
    <div style={{ border: `1px solid ${RP.border}`, borderRadius: RP.radiusLg, overflow: 'hidden' }}>
      <div style={{ background: RP.surfSecondary, borderBottom: `1px solid ${RP.border}`, padding: '10px 14px' }}>
        <span style={{ fontSize:'11px', fontWeight:'500', color: RP.textSecondary, textTransform:'uppercase', letterSpacing:'0.06em' }}>EXEMPLE DE CYCLE · Total : {fmt(total)}</span>
      </div>
      {plan.cycle.map((d, i) => {
        const pct = total > 0 ? ((d.target / total) * 100).toFixed(0) : '—';
        const over40 = total > 0 && (d.target / total) > 0.4 && d.target > 0;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '8px 14px', fontSize:'12px', borderBottom: i < plan.cycle.length - 1 ? `1px solid ${RP.border}` : 'none', alignItems: 'center' }}>
            <span style={{ color: RP.textTertiary, fontWeight: '500' }}>J{d.day}</span>
            <span style={{ color: pnlColor(d.target), fontWeight: '500' }}>{fmt(d.target)}</span>
            <span style={{ color: over40 ? RP.danger : RP.textTertiary }}>
              {d.target > 0 ? `${pct}%` : '—'}
              {over40 && <span style={{ marginLeft: '4px' }}>⚠ &gt;40%</span>}
            </span>
            <span style={{ color: RP.textTertiary }}>{d.note}</span>
          </div>
        );
      })}
      {/* Total row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', fontSize: '12px', fontWeight:'500', background: RP.surfSecondary, borderTop: `1px solid ${RP.border}` }}>
        <span style={{ color: RP.textTertiary }}>TOTAL</span>
        <span style={{ color: pnlColor(total) }}>{fmt(total)}</span>
        <span style={{ color: RP.textTertiary }}>100%</span>
        <span style={{ color: plan.color }}>Payout : {fmt(plan.payoutTarget?.[0])} → {fmt(plan.payoutTarget?.[1])}</span>
      </div>
    </div>
  );
}

function Simulator({ plan }) {
  const key = `sim_days_${plan.id}`;
  const [days, setDays] = useState(() => {
    try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch {}
    return plan.cycle ? plan.cycle.map(d => String(d.target)) : ['500', '400', '500'];
  });
  const [showSim, setShowSim] = useState(false);
  useEffect(() => { localStorage.setItem(key, JSON.stringify(days)); }, [days]);

  const values = days.map(d => parseFloat(String(d).replace(',', '.')) || 0);
  const total = values.reduce((s, v) => s + v, 0);
  const positiveVals = values.filter(v => v > 0);
  const maxDay = positiveVals.length > 0 ? Math.max(...positiveVals) : 0;
  const consistency = total > 0 && maxDay > 0 ? (maxDay / total * 100).toFixed(1) : 0;
  const consistencyOk = total > 0 && maxDay > 0 && maxDay / total <= 0.40;

  // ── Simulation payout calculations ───────────────────────────
  const minTotal   = maxDay > 0 ? Math.ceil(maxDay / 0.40) : 0;
  const gap        = Math.max(0, minTotal - total);
  const maxPerDay  = maxDay > 1 ? maxDay - 1 : maxDay;
  const daysNeeded = gap > 0 && maxPerDay > 0 ? Math.ceil(gap / maxPerDay) : 0;
  const suggestedAmt = daysNeeded > 0 ? Math.ceil(gap / daysNeeded) : 0;

  const suggestedDays = (() => {
    if (daysNeeded === 0 || suggestedAmt === 0) return [];
    const arr = [];
    let remaining = gap;
    for (let i = 0; i < daysNeeded; i++) {
      const isLast = i === daysNeeded - 1;
      arr.push(isLast ? Math.max(1, Math.ceil(remaining)) : suggestedAmt);
      remaining -= suggestedAmt;
    }
    return arr;
  })();

  const totalAfter = total + suggestedDays.reduce((s, v) => s + v, 0);
  const maxAfter   = Math.max(maxDay, ...suggestedDays);
  const pctAfter   = totalAfter > 0 && maxAfter > 0 ? (maxAfter / totalAfter * 100).toFixed(1) : 0;
  const payoutAfter = parseFloat(pctAfter) <= 40 && totalAfter > 0
    ? fmt(Math.round(totalAfter * 0.5 * 0.9)) : '—';

  function addDay() { if (days.length < 14) { setDays(d => [...d, '']); setShowSim(false); } }
  function removeDay() { if (days.length > 1) { setDays(d => d.slice(0, -1)); setShowSim(false); } }
  function reset() { setDays(plan.cycle ? plan.cycle.map(d => String(d.target)) : ['500', '400', '500']); setShowSim(false); }

  return (
    <div style={{ border: `1px solid ${RP.border}`, borderRadius: RP.radiusLg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: RP.surfSecondary, borderBottom: `1px solid ${RP.border}`, padding: '10px 14px' }}>
        <div>
          <div style={{ fontSize:'11px', fontWeight:'500', color: RP.textSecondary, textTransform:'uppercase', letterSpacing:'0.06em' }}>SIMULATEUR DE CYCLE</div>
          <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop: '2px' }}>Entre tes P&L réels ou simulés — règle des 40% calculée en temps réel</div>
        </div>
        <button onClick={reset} style={{ background: 'none', border: `1px solid ${RP.border}`, color: RP.textSecondary, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize:'11px', fontFamily: 'inherit', letterSpacing: '0.06em' }}>RESET</button>
      </div>

      <div style={{ padding: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

        {/* Gauche : day inputs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {days.map((d, i) => {
            const v = parseFloat(String(d).replace(',', '.')) || 0;
            const isMax = v === maxDay && v > 0 && positiveVals.filter(x => x === maxDay).length === 1;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize:'12px', color: isMax ? '#f0a020' : '#3c4c64', letterSpacing: '1px' }}>
                  J{i + 1}{isMax ? ' ★' : ''}
                </span>
                <input
                  type="number"
                  value={d}
                  onChange={e => { setDays(prev => { const n = [...prev]; n[i] = e.target.value; return n; }); setShowSim(false); }}
                  style={{ width: '72px', background: 'rgba(14,15,22,0.6)', border: `1px solid ${v < 0 ? 'rgba(255,68,85,0.3)' : isMax ? 'rgba(240,160,32,0.4)' : 'rgba(136,153,187,0.18)'}`, borderRadius: '4px', padding: '6px 8px', color: v < 0 ? '#ff4455' : isMax ? '#f0a020' : '#8899bb', fontSize: '13px', fontFamily: 'inherit', outline: 'none', textAlign: 'center', caretColor: '#8899bb' }}
                />
              </div>
            );
          })}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={addDay} title="Ajouter un jour" style={{ background: 'none', border: '1px solid #1e2c40', color: '#5a6a82', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', lineHeight: 1 }}>+</button>
            <button onClick={removeDay} title="Retirer un jour" style={{ background: 'none', border: '1px solid #1e2c40', color: '#5a6a82', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', lineHeight: 1 }}>−</button>
          </div>
        </div>

        {/* Droite : 3-card grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(150px,1fr))', gap: '8px', flex: 1 }}>
          <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
            <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom: '4px' }}>TOTAL CYCLE</div>
            <div style={{ fontSize: '15px', fontWeight: '500', color: pnlColor(total) }}>{fmt(total)}</div>
            {minTotal > 0 && !consistencyOk && (
              <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop: '3px' }}>min requis : {fmt(minTotal)}</div>
            )}
          </div>
          <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
            <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom: '4px' }}>MEILLEUR JOUR / TOTAL</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '15px', fontWeight: '500', color: consistencyOk ? RP.success : maxDay > 0 ? RP.danger : RP.textSecondary }}>
                {total > 0 && maxDay > 0 ? `${consistency}%` : '—'}
              </span>
              {total > 0 && maxDay > 0 && (
                <span style={{ fontSize:'11px', color: consistencyOk ? RP.success : RP.danger }}>{consistencyOk ? '✓ OK' : '✗ >40%'}</span>
              )}
            </div>
            {maxDay > 0 && <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop: '3px' }}>max jour : {fmt(maxDay)}</div>}
          </div>
          <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
            <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom: '4px' }}>PAYOUT POSSIBLE</div>
            {total > 0 && consistencyOk ? (
              <>
                <div style={{ fontSize: '15px', fontWeight: '500', color: plan.color }}>{fmt(Math.round(total * 0.5 * 0.9))}</div>
                <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop: '3px' }}>50% · -10% frais</div>
              </>
            ) : <div style={{ fontSize: '15px', fontWeight: '500', color: RP.textTertiary }}>—</div>}
          </div>
        </div>
      </div>

      {/* Bloqué → bouton simulation */}
      {!consistencyOk && total > 0 && maxDay > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: '#120a00', borderTop: `1px solid #3a2500`, borderRadius: '0 0 5px 5px', fontSize:'13px', color: RP.warn, marginBottom: '8px' }}>
            <span style={{ flexShrink: 0, marginTop: '2px' }}><IconAlertTriangle color={RP.warn} /></span>
            <span>
              J_max ({fmt(maxDay)}) = {consistency}% du total → payout bloqué · il manque encore{' '}
              <strong>{fmt(gap)}</strong> pour atteindre le minimum de {fmt(minTotal)}
            </span>
          </div>

          {daysNeeded > 0 && (
            <button
              onClick={() => setShowSim(s => !s)}
              style={{ width: '100%', padding: '11px 16px', background: showSim ? 'rgba(240,160,32,0.12)' : 'rgba(240,160,32,0.07)', border: `1px solid ${showSim ? 'rgba(240,160,32,0.5)' : 'rgba(240,160,32,0.25)'}`, borderRadius: '6px', color: '#f0a020', fontSize:'13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1.5px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <span>📊</span>
              <span>SIMULATION PAYOUT — Calculer les jours suivants</span>
              <span style={{ fontSize:'12px', opacity: 0.7 }}>{showSim ? '▲' : '▼'}</span>
            </button>
          )}
        </div>
      )}

      {consistencyOk && total > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ padding: '9px 12px', background: 'rgba(136,153,187,0.06)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '5px', fontSize:'13px', color: '#8899bb' }}>
            ✓ Règle des 40% respectée — payout débloqué
          </div>
        </div>
      )}

      {/* ── Simulation payout panel ── */}
      {showSim && daysNeeded > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: 'rgba(240,160,32,0.04)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '8px', padding: '14px' }}>

          {/* Info banner */}
          <div style={{ fontSize:'12px', color: '#f0a020', letterSpacing: '2px', marginBottom: '10px' }}>SIMULATION PAYOUT · JOURS SUIVANTS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', borderTop: '2px solid #f0a020' }}>
              <div style={{ fontSize:'12px', color: '#5a4a20', letterSpacing: '1px', marginBottom: '3px' }}>MAX PAR JOUR</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#f0d090' }}>{fmt(maxPerDay)}</div>
              <div style={{ fontSize:'12px', color: '#4a3a18', marginTop: '2px' }}>sans créer de nouveau max</div>
            </div>
            <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', borderTop: '2px solid #aa88ff' }}>
              <div style={{ fontSize:'12px', color: '#5a4a20', letterSpacing: '1px', marginBottom: '3px' }}>JOURS REQUIS</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#aa88ff' }}>{daysNeeded} jour{daysNeeded > 1 ? 's' : ''}</div>
              <div style={{ fontSize:'12px', color: '#4a3a18', marginTop: '2px' }}>à ~{fmt(suggestedAmt)}/jour</div>
            </div>
            <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', borderTop: '2px solid #8899bb' }}>
              <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '3px' }}>PAYOUT ESTIMÉ</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#8899bb' }}>{payoutAfter}</div>
              <div style={{ fontSize:'12px', color: '#3a1818', marginTop: '2px' }}>50% · -10% frais</div>
            </div>
          </div>

          {/* Timeline table */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '50px 90px 90px 90px 1fr', gap: '6px', padding: '6px 12px', fontSize:'12px', color: '#3c4c64', letterSpacing: '1.5px', borderBottom: '1px solid rgba(136,153,187,0.08)', background: 'rgba(0,0,0,0.2)' }}>
              <span>JOUR</span><span>P&L</span><span>TOTAL</span><span>%</span><span>STATUT</span>
            </div>
            {/* Real days */}
            {values.map((v, i) => {
              const runTotal = values.slice(0, i + 1).reduce((s, x) => s + x, 0);
              const runMax = Math.max(0, ...values.slice(0, i + 1).filter(x => x > 0));
              const runPct = runTotal > 0 && runMax > 0 ? (runMax / runTotal * 100).toFixed(0) : '—';
              const isMaxDay = v === maxDay && v > 0;
              return (
                <div key={`r${i}`} style={{ display: 'grid', gridTemplateColumns: '50px 90px 90px 90px 1fr', gap: '6px', padding: '7px 12px', fontSize:'13px', alignItems: 'center', borderBottom: '1px solid rgba(0,255,136,0.03)', background: i % 2 === 0 ? 'rgba(14,15,22,0.3)' : 'transparent', borderLeft: `2px solid ${v < 0 ? '#ff4455' : '#3c4c64'}` }}>
                  <span style={{ color: '#5868a0', fontWeight: '700' }}>J{i + 1}</span>
                  <span style={{ color: pnlColor(v), fontWeight: '600' }}>{fmt(v)}{isMaxDay ? ' ★' : ''}</span>
                  <span style={{ color: pnlColor(runTotal) }}>{fmt(runTotal)}</span>
                  <span style={{ color: runPct === '—' ? '#3a1818' : parseFloat(runPct) > 40 ? '#ff4455' : '#8899bb', fontSize:'12px' }}>{runPct !== '—' ? `${runPct}%` : '—'}</span>
                  <span style={{ fontSize:'12px', color: '#3a5a32' }}>réel</span>
                </div>
              );
            })}
            {/* Suggested days */}
            {suggestedDays.map((v, i) => {
              const allSoFar = [...values, ...suggestedDays.slice(0, i + 1)];
              const runTotal = allSoFar.reduce((s, x) => s + x, 0);
              const runMax = Math.max(0, ...allSoFar.filter(x => x > 0));
              const runPct = runTotal > 0 && runMax > 0 ? (runMax / runTotal * 100).toFixed(0) : '—';
              const compliant = runPct !== '—' && parseFloat(runPct) <= 40;
              return (
                <div key={`s${i}`} style={{ display: 'grid', gridTemplateColumns: '50px 90px 90px 90px 1fr', gap: '6px', padding: '7px 12px', fontSize:'13px', alignItems: 'center', borderBottom: i < suggestedDays.length - 1 ? '1px solid rgba(240,160,32,0.08)' : 'none', background: 'rgba(240,160,32,0.05)', borderLeft: '2px solid #f0a020' }}>
                  <span style={{ color: '#f0a020', fontWeight: '700' }}>J{values.length + i + 1}</span>
                  <span style={{ color: '#f0d090', fontWeight: '600' }}>{fmt(v)}</span>
                  <span style={{ color: pnlColor(runTotal) }}>{fmt(runTotal)}</span>
                  <span style={{ color: runPct === '—' ? '#3a1818' : compliant ? '#8899bb' : '#f0a020', fontSize:'12px' }}>{runPct !== '—' ? `${runPct}%` : '—'}</span>
                  <span style={{ fontSize:'12px', color: compliant ? '#8899bb' : '#f0a020' }}>{compliant ? '✓ OK' : 'suggéré'}</span>
                </div>
              );
            })}
          </div>

          {/* Final summary */}
          <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '5px', borderTop: `2px solid ${parseFloat(pctAfter) <= 40 ? '#8899bb' : '#f0a020'}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '2px' }}>TOTAL FINAL</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: pnlColor(totalAfter) }}>{fmt(totalAfter)}</div>
            </div>
            <div>
              <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '2px' }}>CONSISTANCE</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: parseFloat(pctAfter) <= 40 ? '#8899bb' : '#f0a020' }}>{pctAfter}%</div>
            </div>
            <div>
              <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '2px' }}>PAYOUT NET</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: plan.color }}>{payoutAfter}</div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function PhasesGrid({ phases, selected, onSelect }) {
  if (!phases) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
      {phases.map((p, i) => {
        const active = i === selected;
        return (
          <div key={i} onClick={() => onSelect(i)} style={{
            border: active ? '2px solid #534AB7' : `0.5px solid ${RP.border}`,
            background: active ? '#0d0b1a' : 'transparent',
            borderRadius: RP.radiusLg, padding: '12px 14px', cursor: 'pointer',
          }}>
            <div style={{ fontSize:'11px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>PHASE {i + 1}</div>
            <div style={{ fontSize:'14px', fontWeight:'500', color: active ? '#9F95E8' : RP.textPrimary, marginBottom:'3px' }}>{p.range}</div>
            <div style={{ fontSize:'11px', color: RP.textTertiary }}>{p.note}</div>
          </div>
        );
      })}
    </div>
  );
}

function PhaseParams({ risk, riskSub, dailyStop, target, contracts, contractsSub }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
      <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
        <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>RISQUE / TRADE</div>
        <div style={{ fontSize:'14px', fontWeight:'500', color: RP.success }}>{risk}</div>
        {riskSub && <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop:'3px' }}>{riskSub}</div>}
      </div>
      <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
        <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>STOP JOURNALIER</div>
        <div style={{ fontSize:'14px', fontWeight:'500', color: RP.danger }}>{dailyStop}</div>
        <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop:'3px' }}>Arrêt obligatoire</div>
      </div>
      <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
        <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>OBJECTIF / JOUR</div>
        <div style={{ fontSize:'14px', fontWeight:'500', color: RP.success }}>{target}</div>
        <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop:'3px' }}>Zone idéale</div>
      </div>
      <div style={{ background: RP.surfSecondary, border: `1px solid ${RP.border}`, borderRadius: RP.radiusMd, padding: '10px 12px' }}>
        <div style={{ fontSize:'10px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>CONTRATS</div>
        <div style={{ fontSize:'14px', fontWeight:'500', color: RP.textPrimary }}>{contracts}</div>
        {contractsSub && <div style={{ fontSize:'11px', color: RP.textTertiary, marginTop:'3px' }}>{contractsSub}</div>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function TradingPlan() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('trading_plan_tab') || 'payout5j');
  const plan = PLANS[activeTab] ?? PLANS.payout5j;
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const activePhase = plan.phases ? plan.phases[selectedPhaseIdx] ?? plan.phases[0] : null;

  return (
    <div style={{ padding: '24px 28px', width: '100%', boxSizing: 'border-box', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize:'11px', color: RP.textTertiary, textTransform:'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>DISCIPLINE</div>
        <h1 style={{ fontSize: '22px', fontWeight: '500', color: RP.textPrimary, margin: '0 0 4px' }}>Règles & Plan de Trading</h1>
        <div style={{ fontSize:'12px', color: RP.textSecondary }}>
          {plan.account.toLocaleString('fr-FR')}$ · {plan.instrument} · {(plan.riskPerTrade / plan.account * 100).toFixed(1)}% risque · Max {plan.maxTrades} trades/jour
        </div>
      </div>

      {/* ── Gold rules banner ── */}
      <div style={{ marginBottom: '22px', background: '#120a00', border: '0.5px solid #3a2500', borderLeft: '3px solid #BA7517', borderRadius: RP.radiusLg, padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize:'11px', color: '#9a6040', textTransform:'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
          <IconStar color="#BA7517" />
          <span>RÈGLES D'OR</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {GOLD_RULES.map((r, i) => (
            <div key={i} style={{ fontSize:'14px', color: '#BA7517', fontWeight: '500', lineHeight: '1.5', paddingLeft: '12px', borderLeft: '1.5px solid #3a2500' }}>{r}</div>
          ))}
        </div>
      </div>

      {/* -- Tabs -- */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '22px', background: 'rgba(14,15,22,0.4)', padding: '5px', borderRadius: '8px', border: '1px solid rgba(0,255,136,0.07)' }}>
        {Object.values(PLANS).map(p => (
          <button key={p.id} onClick={() => { setActiveTab(p.id); localStorage.setItem('trading_plan_tab', p.id); }}
            style={{ flex: 1, padding: '10px 6px', borderRadius: '5px', border: activeTab === p.id ? `1px solid ${p.color}40` : '1px solid transparent', background: activeTab === p.id ? `${p.color}12` : 'transparent', color: activeTab === p.id ? p.color : '#5a6a82', fontSize:'13px', fontFamily: 'inherit', fontWeight: activeTab === p.id ? '700' : '400', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.5px' }}>
            <div style={{ fontSize: '13px', marginBottom: '2px' }}>{p.abbr}</div>
            <div style={{ fontSize:'12px', opacity: 0.8 }}>{p.label}</div>
          </button>
        ))}
      </div>

      <div>
      {/* Plan header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: plan.color, boxShadow: `0 0 8px ${plan.color}`, animation: 'pulse 2s infinite' }} />
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: plan.color }}>{plan.label}</div>
          <div style={{ fontSize:'13px', color: '#5a6a82' }}>{plan.subtitle}</div>
        </div>
      </div>

      {/* ── Phases (liveFunded only) ── */}
      {plan.phases && (
        <div style={{ marginBottom: '14px' }}>
          <PhasesGrid phases={plan.phases} selected={selectedPhaseIdx} onSelect={setSelectedPhaseIdx} />
        </div>
      )}

      {/* ── Paramètres phase ── */}
      <div style={{ marginBottom: '20px' }}>
        {plan.phases ? (
          <PhaseParams
            risk={activePhase.risk}
            dailyStop={fmt(plan.dailyStop)}
            target={activePhase.target}
            contracts={activePhase.contracts}
          />
        ) : (
          <PhaseParams
            risk={fmt(plan.riskPerTrade)}
            riskSub={`Max ${fmt(plan.maxRiskPerTrade)}`}
            dailyStop={fmt(plan.dailyStop)}
            target={`${fmt(plan.dailyTarget[0])} → ${fmt(plan.dailyTarget[1])}`}
            contracts={`${plan.contracts[0]}–${plan.contracts[1]} MNQ`}
            contractsSub="5 seulement si A+ setup"
          />
        )}
      </div>

      {/* ── Two columns: left = cycle/phases, right = rules ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Cycle table */}
          {plan.cycle && <DayCycleTable plan={plan} />}

          {/* Consistency note for 3j */}
          {plan.consistencyNote && (
            <div style={{ padding: '12px 14px', background: 'rgba(240,160,32,0.06)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '6px' }}>
              <div style={{ fontSize:'12px', color: '#f0a020', letterSpacing: '2px', marginBottom: '6px' }}>RÈGLE DES 40%</div>
              {plan.consistencyNote.split('\n').map((line, i) => (
                <div key={i} style={{ fontSize:'13px', color: i === 0 ? '#f0d090' : '#8a7a5a', marginBottom: '3px' }}>{line}</div>
              ))}
            </div>
          )}

          {/* Monthly projection */}
          {plan.cycleTarget && (
            <div style={{ padding: '12px 14px', background: 'rgba(14,15,22,0.5)', border: `1px solid ${plan.color}20`, borderRadius: '6px' }}>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '8px' }}>PROJECTION 30 JOURS</div>
              {activeTab === 'payout5j' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize:'13px', color: '#6a8a7a' }}>6 cycles × {fmt(plan.cycleTarget[0])} → {fmt(plan.cycleTarget[1])}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: plan.color }}>6 000$ → 9 000$ retirés</div>
                  <div style={{ fontSize:'12px', color: '#5a6a82', marginTop: '3px' }}>Sans risque excessif</div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize:'13px', color: '#6a8a7a' }}>~10 cycles × {fmt(plan.cycleTarget[0])} → {fmt(plan.cycleTarget[1])}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: plan.color }}>10 000$ → 15 000$ potentiel</div>
                  <div style={{ fontSize:'12px', color: '#5a6a82', marginTop: '3px' }}>Si la règle des 40% est respectée</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Rules */}
        <div style={{ border: `1px solid ${RP.border}`, borderRadius: RP.radiusLg, overflow: 'hidden' }}>
          <div style={{ background: RP.surfSecondary, borderBottom: `1px solid ${RP.border}`, padding: '10px 14px' }}>
            <span style={{ fontSize:'11px', fontWeight:'500', color: RP.textSecondary, textTransform:'uppercase', letterSpacing:'0.06em' }}>RÈGLES — {plan.rules.filter(r => r.critical).length} CRITIQUES</span>
          </div>
          <div>
            {plan.rules.map((r, i) => <RuleItem key={i} rule={r} isLast={i === plan.rules.length - 1} />)}
          </div>
        </div>
      </div>

      {/* ── Simulator ── */}
      <Simulator plan={plan} />

      {/* ── Weekly progression (5j & 3j) ── */}
      {activeTab !== 'liveFunded' && (
        <div style={{ marginTop: '20px', background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '12px' }}>PROGRESSION HEBDOMADAIRE (SEMAINES 1-2)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Semaine 1', contracts: '3 MNQ', target: '400$/jour', risk: '250$', note: 'Prendre les habitudes, ne pas forcer', color: '#8899bb' },
              { label: 'Semaine 2+', contracts: '5 MNQ', target: '500$–600$/jour', risk: '250$', note: 'Monter progressivement après stabilité', color: plan.color },
            ].map((w, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${w.color}20`, borderRadius: '6px', borderLeft: `2px solid ${w.color}` }}>
                <div style={{ fontSize:'13px', color: w.color, fontWeight: '700', marginBottom: '6px' }}>{w.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'13px' }}>
                    <span style={{ color: '#5868a0' }}>Contrats</span>
                    <span style={{ color: '#dde4ef' }}>{w.contracts}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'13px' }}>
                    <span style={{ color: '#5868a0' }}>Objectif</span>
                    <span style={{ color: '#8899bb' }}>{w.target}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'13px' }}>
                    <span style={{ color: '#5868a0' }}>Risque/trade</span>
                    <span style={{ color: '#f0a020' }}>{w.risk}</span>
                  </div>
                  <div style={{ fontSize:'12px', color: '#3a5a32', marginTop: '4px', fontStyle: 'italic' }}>{w.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
