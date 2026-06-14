import { useState, useEffect } from 'react';

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

function RuleItem({ rule }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', background: rule.critical ? 'rgba(255,68,85,0.04)' : 'rgba(14,15,22,0.3)', border: `1px solid ${rule.critical ? 'rgba(255,68,85,0.12)' : 'rgba(136,153,187,0.05)'}`, borderLeft: `2px solid ${rule.critical ? '#ff4455' : '#3c4c64'}`, borderRadius: '5px' }}>
      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{rule.icon}</span>
      <span style={{ fontSize:'13px', color: rule.critical ? '#e8c8c8' : '#7888a0', lineHeight: '1.5' }}>{rule.text}</span>
      {rule.critical && <span style={{ marginLeft: 'auto', fontSize:'11px', color: '#ff4455', background: 'rgba(255,68,85,0.12)', border: '1px solid rgba(255,68,85,0.25)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.5px', flexShrink: 0, alignSelf: 'center' }}>CRITIQUE</span>}
    </div>
  );
}

function DayCycleTable({ plan }) {
  if (!plan.cycle) return null;
  const total = plan.cycle.reduce((s, d) => s + d.target, 0);
  return (
    <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(136,153,187,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px' }}>EXEMPLE DE CYCLE</span>
        <span style={{ fontSize:'13px', color: pnlColor(total), fontWeight: '700' }}>Total : {fmt(total)}</span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '6px 14px', fontSize:'12px', color: '#3c4c64', letterSpacing: '1.5px', borderBottom: '1px solid rgba(136,153,187,0.05)', background: 'rgba(0,0,0,0.2)' }}>
        <span>JOUR</span><span>OBJECTIF</span><span>% DU TOTAL</span><span>NOTE</span>
      </div>
      {plan.cycle.map((d, i) => {
        const pct = total > 0 ? ((d.target / total) * 100).toFixed(0) : '—';
        const over40 = total > 0 && (d.target / total) > 0.4 && d.target > 0;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '9px 14px', fontSize:'13px', borderBottom: i < plan.cycle.length - 1 ? '1px solid rgba(0,255,136,0.03)' : 'none', background: i % 2 === 0 ? 'rgba(14,15,22,0.3)' : 'transparent', alignItems: 'center' }}>
            <span style={{ color: '#5868a0', fontWeight: '700' }}>J{d.day}</span>
            <span style={{ color: pnlColor(d.target), fontWeight: '600' }}>{fmt(d.target)}</span>
            <span style={{ color: over40 ? '#ff4455' : '#6a8a7a' }}>
              {d.target > 0 ? `${pct}%` : '—'}
              {over40 && <span style={{ marginLeft: '4px', fontSize:'12px', color: '#ff4455' }}>⚠ &gt;40%</span>}
            </span>
            <span style={{ color: '#4a6a54', fontSize:'13px' }}>{d.note}</span>
          </div>
        );
      })}
      {/* Total row */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', padding: '10px 14px', fontSize: '13px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(136,153,187,0.10)', alignItems: 'center' }}>
        <span style={{ color: '#5a6a82', fontSize:'12px', letterSpacing: '1px' }}>TOTAL</span>
        <span style={{ color: pnlColor(total), fontWeight: '700' }}>{fmt(total)}</span>
        <span style={{ color: '#5a6a82' }}>100%</span>
        <span style={{ color: plan.color, fontSize:'12px' }}>Payout : {fmt(plan.payoutTarget?.[0])} → {fmt(plan.payoutTarget?.[1])}</span>
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
    <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px' }}>SIMULATEUR DE CYCLE</div>
          <div style={{ fontSize:'12px', color: '#3a1818', marginTop: '2px' }}>Entre tes P&L réels ou simulés — règle des 40% calculée en temps réel</div>
        </div>
        <button onClick={reset} style={{ background: 'none', border: '1px solid #1e2c40', color: '#3a5a32', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize:'12px', fontFamily: 'inherit', letterSpacing: '1px' }}>RESET</button>
      </div>

      {/* Day inputs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
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

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '8px 10px', borderTop: `2px solid ${pnlColor(total)}` }}>
          <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '3px' }}>TOTAL CYCLE</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: pnlColor(total) }}>{fmt(total)}</div>
          {minTotal > 0 && !consistencyOk && (
            <div style={{ fontSize:'12px', color: '#3a4a32', marginTop: '2px' }}>min requis : {fmt(minTotal)}</div>
          )}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '8px 10px', borderTop: `2px solid ${consistencyOk ? '#8899bb' : maxDay > 0 ? '#ff4455' : '#3c4c64'}` }}>
          <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '3px' }}>MEILLEUR JOUR / TOTAL</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: consistencyOk ? '#8899bb' : maxDay > 0 ? '#ff4455' : '#5a6a82' }}>
              {total > 0 && maxDay > 0 ? `${consistency}%` : '—'}
            </span>
            {total > 0 && maxDay > 0 && (
              <span style={{ fontSize:'12px', color: consistencyOk ? '#8899bb' : '#ff4455' }}>{consistencyOk ? '✓ OK' : '✗ >40%'}</span>
            )}
          </div>
          {maxDay > 0 && <div style={{ fontSize:'12px', color: '#3a4a32', marginTop: '2px' }}>max jour : {fmt(maxDay)}</div>}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '8px 10px', borderTop: `2px solid ${plan.color}` }}>
          <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1px', marginBottom: '3px' }}>PAYOUT POSSIBLE</div>
          {total > 0 && consistencyOk ? (
            <>
              <div style={{ fontSize: '15px', fontWeight: '700', color: plan.color }}>{fmt(Math.round(total * 0.5 * 0.9))}</div>
              <div style={{ fontSize:'12px', color: '#5a6a82', marginTop: '2px' }}>50% · -10% frais</div>
            </>
          ) : <div style={{ fontSize: '15px', fontWeight: '700', color: '#3a1818' }}>—</div>}
        </div>
      </div>

      {/* Bloqué → bouton simulation */}
      {!consistencyOk && total > 0 && maxDay > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ padding: '8px 12px', background: 'rgba(255,68,85,0.06)', border: '1px solid rgba(255,68,85,0.18)', borderRadius: '5px', fontSize:'13px', color: '#ff8888', marginBottom: '8px' }}>
            ⚠ J_max ({fmt(maxDay)}) = {consistency}% du total → payout bloqué · il manque encore{' '}
            <strong style={{ color: '#f0a020' }}>{fmt(gap)}</strong> pour atteindre le minimum de {fmt(minTotal)}
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
        <div style={{ padding: '9px 12px', background: 'rgba(136,153,187,0.06)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '5px', fontSize:'13px', color: '#8899bb' }}>
          ✓ Règle des 40% respectée — payout débloqué
        </div>
      )}

      {/* ── Simulation payout panel ── */}
      {showSim && daysNeeded > 0 && (
        <div style={{ marginTop: '12px', background: 'rgba(240,160,32,0.04)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '8px', padding: '14px' }}>

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
      )}
    </div>
  );
}

function PhaseTable({ phases }) {
  if (!phases) return null;
  return (
    <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(0,255,136,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(136,153,187,0.08)' }}>
        <span style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px' }}>PROGRESSION PAR PHASE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 80px 130px 80px 1fr', padding: '6px 14px', fontSize:'12px', color: '#3c4c64', letterSpacing: '1.5px', borderBottom: '1px solid rgba(136,153,187,0.05)', background: 'rgba(0,0,0,0.2)' }}>
        <span>PHASE</span><span>CAPITAL</span><span>RISQUE</span><span>OBJECTIF/JOUR</span><span>CONTRATS</span><span>NOTE</span>
      </div>
      {phases.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 120px 80px 130px 80px 1fr', padding: '11px 14px', fontSize:'13px', borderBottom: i < phases.length - 1 ? '1px solid rgba(0,255,136,0.03)' : 'none', background: i % 2 === 0 ? 'rgba(14,15,22,0.3)' : 'transparent', alignItems: 'center', borderLeft: `2px solid ${p.color}` }}>
          <span style={{ color: p.color, fontWeight: '700', fontSize:'13px' }}>{p.label}</span>
          <span style={{ color: '#dde4ef', fontSize:'13px' }}>{p.range}</span>
          <span style={{ color: '#f0a020' }}>{p.risk}</span>
          <span style={{ color: '#8899bb' }}>{p.target}</span>
          <span style={{ color: '#7888a0' }}>{p.contracts}</span>
          <span style={{ color: '#4a6a54', fontSize:'13px' }}>{p.note}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function TradingPlan() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('trading_plan_tab') || 'payout5j');
  const plan = PLANS[activeTab] ?? PLANS.payout5j;

  return (
    <div style={{ padding: '24px 28px', width: '100%', boxSizing: 'border-box', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '3px', marginBottom: '4px' }}>DISCIPLINE</div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8edf8', margin: '0 0 4px' }}>Règles & Plan de Trading</h1>
        <div style={{ fontSize:'13px', color: '#5a6a82' }}>50 000$ · MNQ · 0.5% risque · Max 3 trades/jour</div>
      </div>

      {/* ── Gold rules banner ── */}
      <div style={{ marginBottom: '22px', padding: '14px 18px', background: 'rgba(240,160,32,0.07)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '8px', borderLeft: '3px solid #f0a020' }}>
        <div style={{ fontSize:'12px', color: '#f0a020', letterSpacing: '2px', marginBottom: '8px' }}>RÈGLES D'OR</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {GOLD_RULES.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize:'13px', color: i < 2 ? '#f0d090' : '#8a7a5a' }}>
              <span style={{ color: '#f0a020', flexShrink: 0 }}>▸</span>
              <span>{r}</span>
            </div>
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

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '8px', marginBottom: '20px' }}>
        <StatBox label="RISQUE / TRADE" value={`${fmt(plan.riskPerTrade)}`} color="#f0a020" sub={`Max ${fmt(plan.maxRiskPerTrade)}`} />
        <StatBox label="STOP JOURNALIER" value={fmt(plan.dailyStop)} color="#ff4455" sub="Arrêt obligatoire" />
        <StatBox label="OBJECTIF / JOUR" value={`${fmt(plan.dailyTarget[0])} → ${fmt(plan.dailyTarget[1])}`} color={plan.color} sub="Zone idéale" />
        <StatBox label="CONTRATS" value={`${plan.contracts[0]}–${plan.contracts[1]} MNQ`} color="#7888a0" sub="5 seulement si A+ setup" />
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
        <div>
          <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '10px' }}>RÈGLES — {plan.rules.filter(r => r.critical).length} CRITIQUES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {plan.rules.map((r, i) => <RuleItem key={i} rule={r} />)}
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
