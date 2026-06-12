import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Config par type de compte ─────────────────────────────────
const CHALLENGE_MAP = {
  topstep_50k:       { ACCOUNT_SIZE: 50000,  MAX_LOSS: 2000, PROFIT_TARGET: 3000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  topstep_100k:      { ACCOUNT_SIZE: 100000, MAX_LOSS: 3000, PROFIT_TARGET: 6000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  topstep_150k:      { ACCOUNT_SIZE: 150000, MAX_LOSS: 4500, PROFIT_TARGET: 9000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  lucid_eval_25k:    { ACCOUNT_SIZE: 25000,  MAX_LOSS: 1000, PROFIT_TARGET: 1250, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  lucid_eval_50k:    { ACCOUNT_SIZE: 50000,  MAX_LOSS: 2000, PROFIT_TARGET: 3000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  lucid_eval_100k:   { ACCOUNT_SIZE: 100000, MAX_LOSS: 3000, PROFIT_TARGET: 6000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  lucid_eval_150k:   { ACCOUNT_SIZE: 150000, MAX_LOSS: 4500, PROFIT_TARGET: 9000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
  tradovate_live:    { ACCOUNT_SIZE: 50000,  MAX_LOSS: 2000, PROFIT_TARGET: 3000, MIN_DAYS: 2, CONSISTENCY_PCT: 0.50 },
};
const FUNDED_MAP = {
  topstep_ef_50k:    { ACCOUNT_SIZE: 50000,  MAX_LOSS: 2000 },
  topstep_ef_100k:   { ACCOUNT_SIZE: 100000, MAX_LOSS: 3000 },
  topstep_ef_150k:   { ACCOUNT_SIZE: 150000, MAX_LOSS: 4500 },
  lucid_funded_25k:  { ACCOUNT_SIZE: 25000,  MAX_LOSS: 1000 },
  lucid_funded_50k:  { ACCOUNT_SIZE: 50000,  MAX_LOSS: 2000 },
  lucid_funded_100k: { ACCOUNT_SIZE: 100000, MAX_LOSS: 3000 },
  lucid_funded_150k: { ACCOUNT_SIZE: 150000, MAX_LOSS: 4500 },
};

const DEFAULT_CHALLENGE = CHALLENGE_MAP['topstep_50k'];
const DEFAULT_FUNDED    = FUNDED_MAP['topstep_ef_50k'];

function getPhase(accountType) {
  if (CHALLENGE_MAP[accountType]) return 'challenge';
  if (FUNDED_MAP[accountType])   return 'funded';
  return null;
}

// ── Phase selector options ────────────────────────────────────
const PHASE_OPTIONS = [
  { group: 'CHALLENGE — Compte Évaluation', phase: 'challenge', color: '#c41230', options: [
    { value: 'topstep_50k',  label: '50K',  sub: 'Profit: +3 000$ · Max DD: -2 000$ · Min 2 jours' },
    { value: 'topstep_100k', label: '100K', sub: 'Profit: +6 000$ · Max DD: -3 000$ · Min 2 jours' },
    { value: 'topstep_150k', label: '150K', sub: 'Profit: +9 000$ · Max DD: -4 500$ · Min 2 jours' },
  ]},
  { group: 'FUNDED — Compte Live', phase: 'funded', color: '#f0c020', options: [
    { value: 'topstep_ef_50k',  label: '50K',  sub: 'Max DD: -2 000$ · Verrou à 52 000$' },
    { value: 'topstep_ef_100k', label: '100K', sub: 'Max DD: -3 000$ · Verrou à 103 000$' },
    { value: 'topstep_ef_150k', label: '150K', sub: 'Max DD: -4 500$ · Verrou à 154 500$' },
  ]},
];

// ── Helpers ───────────────────────────────────────────────────
function getNet(t) { return t.result_net ?? t.result ?? 0; }
function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) { return v > 0 ? '#00cc77' : v < 0 ? '#ff3344' : '#887070'; }

function buildByDay(trades) {
  const byDay = {};
  for (const t of trades) {
    const d = (t.entered_at || t.date || '').slice(0, 10);
    if (d) byDay[d] = (byDay[d] || 0) + getNet(t);
  }
  return byDay;
}

// Challenge: fixed floor, no trailing
function computeChallengePoints(trades, accountSize, maxLoss) {
  const floor = accountSize - maxLoss;
  const sorted = [...trades].sort((a, b) =>
    (a.entered_at || a.date || '').localeCompare(b.entered_at || b.date || ''));
  const byDayArr = sorted.reduce((acc, t) => {
    const d = (t.entered_at || t.date || '').slice(0, 10);
    const last = acc[acc.length - 1];
    if (last && last.date === d) last.pnl += getNet(t);
    else acc.push({ date: d, pnl: getNet(t) });
    return acc;
  }, []);
  let bal = accountSize;
  const points = [{ date: 'Start', balance: bal, floor }];
  byDayArr.forEach(({ date, pnl }) => {
    bal += pnl;
    points.push({ date: date.slice(5), balance: Math.round(bal * 100) / 100, floor });
  });
  return points;
}

// Funded: floor starts at accountSize-maxLoss, locks at accountSize once lockLevel exceeded
function computeFundedPoints(trades, accountSize, maxLoss) {
  const lockLevel    = accountSize + maxLoss;
  const floorInitial = accountSize - maxLoss;
  const floorLocked  = accountSize;
  const sorted = [...trades].sort((a, b) =>
    (a.entered_at || a.date || '').localeCompare(b.entered_at || b.date || ''));
  const byDayArr = sorted.reduce((acc, t) => {
    const d = (t.entered_at || t.date || '').slice(0, 10);
    const last = acc[acc.length - 1];
    if (last && last.date === d) last.pnl += getNet(t);
    else acc.push({ date: d, pnl: getNet(t) });
    return acc;
  }, []);
  let bal = accountSize, locked = false;
  const points = [{ date: 'Start', balance: bal, floor: floorInitial }];
  byDayArr.forEach(({ date, pnl }) => {
    bal += pnl;
    if (bal >= lockLevel) locked = true;
    points.push({ date: date.slice(5), balance: Math.round(bal * 100) / 100, floor: locked ? floorLocked : floorInitial });
  });
  return { points, isLocked: locked || bal >= lockLevel };
}

// ── Sub-components ────────────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(10,3,6,0.97)', border: '1px solid rgba(196,18,48,0.22)', borderRadius: '4px', padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit' }}>
      <div style={{ color: '#6a3a3a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.name === 'Floor' ? '#ff4455' : '#c41230', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? `${p.value.toFixed(2)}$` : p.value}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, color = '#e0d0d0', alert = false }) {
  return (
    <div style={{ background: alert ? 'rgba(255,68,85,0.06)' : 'rgba(18,6,10,0.5)', border: `1px solid ${alert ? 'rgba(255,68,85,0.3)' : 'rgba(196,18,48,0.10)'}`, borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '1.5px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '21px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: alert ? '#ff8888' : '#6a3a3a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, current, max, color, displayText }) {
  const pct = Math.min((current / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label !== null && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {label && <span style={{ fontSize: '13px', color: '#887070' }}>{label}</span>}
          <span style={{ fontSize: '13px', color, fontWeight: '700' }}>{displayText}</span>
        </div>
      )}
      <div style={{ height: '6px', background: 'rgba(196,18,48,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

function DayDot({ date, pnl }) {
  const isWin = pnl > 0;
  return (
    <div title={`${date}: ${fmt(pnl, true)}`} style={{ width: '34px', height: '34px', borderRadius: '50%', background: isWin ? 'rgba(196,18,48,0.14)' : 'rgba(255,68,85,0.12)', border: `1.5px solid ${isWin ? '#c41230' : '#ff4455'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: isWin ? '#c41230' : '#ff4455', fontWeight: '700', cursor: 'default' }}>
      {isWin ? '✓' : '✗'}
    </div>
  );
}

// ── Phase Selector ────────────────────────────────────────────
function PhaseSelector({ account, onChanged }) {
  const [open, setOpen]     = useState(false);
  const [selected, setSelected] = useState(account?.type ?? '');
  const [saving, setSaving] = useState(false);

  const allOpts = PHASE_OPTIONS.flatMap(g => g.options.map(o => ({ ...o, phase: g.phase, color: g.color })));
  const current = allOpts.find(o => o.value === account?.type);
  const groupColor = current?.color ?? '#6a3a3a';

  async function confirm() {
    if (!account || selected === account?.type) { setOpen(false); return; }
    setSaving(true);
    await window.accounts.update(account.id, { type: selected });
    setSaving(false);
    setOpen(false);
    onChanged(selected);
    window.dispatchEvent(new Event('account-updated'));
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ background: `rgba(${groupColor === '#c41230' ? '0,255,136' : '240,192,32'},0.04)`, border: `1px solid ${groupColor}20`, borderRadius: '6px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '9px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '3px' }}>PHASE DU COMPTE</div>
          {current ? (
            <div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#f0e0e2' }}>{current.phase === 'challenge' ? '🎯' : '💰'} {current.label} — {current.phase === 'challenge' ? 'Challenge' : 'Funded'}</span>
              <span style={{ fontSize: '10px', color: groupColor, marginLeft: '10px' }}>{current.sub}</span>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#f0a020' }}>⚠ Phase non définie — cliquez "Modifier" pour configurer</div>
          )}
        </div>
        <button onClick={() => { setSelected(account?.type ?? ''); setOpen(true); }}
          style={{ background: 'rgba(0,170,255,0.1)', border: '1px solid rgba(0,170,255,0.25)', color: '#00aaff', padding: '7px 14px', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', fontWeight: '600', whiteSpace: 'nowrap' }}>
          Modifier →
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#09050c', border: '1px solid rgba(196,18,48,0.35)', borderRadius: '10px', padding: '24px', width: '560px', maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '4px' }}>PROPFIRM</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f0e0e2' }}>Sélectionner la phase du compte</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid #2a1515', color: '#7a4040', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>

            {PHASE_OPTIONS.map(grp => (
              <div key={grp.group} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: grp.color, letterSpacing: '2px', marginBottom: '8px', opacity: 0.8 }}>{grp.group.toUpperCase()}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                  {grp.options.map(opt => (
                    <div key={opt.value} onClick={() => setSelected(opt.value)}
                      style={{ padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', background: selected === opt.value ? `rgba(${grp.color === '#c41230' ? '0,255,136' : '240,192,32'},0.08)` : 'rgba(18,6,10,0.4)', border: `1px solid ${selected === opt.value ? grp.color + '44' : 'rgba(196,18,48,0.08)'}`, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${selected === opt.value ? grp.color : '#3a1a1a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected === opt.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: grp.color }} />}
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: selected === opt.value ? '#f0e0e2' : '#887070' }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#7a4040', paddingLeft: '22px' }}>{opt.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ background: 'rgba(240,160,32,0.06)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: '4px', padding: '8px 12px', marginBottom: '16px', fontSize: '11px', color: '#f0a020' }}>
              ⚠ Ce choix est permanent. Challenge → validé quand profit target atteint · Funded → compte LIVE dans la sidebar.
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '9px 18px', borderRadius: '5px', border: '1px solid #2a1515', background: 'transparent', color: '#8a5050', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>Annuler</button>
              <button onClick={confirm} disabled={saving || !selected || selected === account?.type}
                style={{ padding: '9px 22px', borderRadius: '5px', background: !selected || selected === account?.type ? 'rgba(18,6,10,0.4)' : 'linear-gradient(135deg,rgba(196,18,48,0.22),rgba(0,170,85,0.1))', border: `1px solid ${!selected || selected === account?.type ? '#2a1515' : 'rgba(196,18,48,0.40)'}`, color: !selected || selected === account?.type ? '#4a2020' : '#c41230', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: saving || !selected || selected === account?.type ? 'not-allowed' : 'pointer' }}>
                {saving ? 'SAUVEGARDE...' : selected === account?.type ? 'DÉJÀ SÉLECTIONNÉ' : '✓ CONFIRMER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHALLENGE TAB ─────────────────────────────────────────────
function ChallengeTab({ trades, manualBalance, setManualBalance, balanceInput, setBalanceInput, accountType }) {
  const { ACCOUNT_SIZE, MAX_LOSS, PROFIT_TARGET, MIN_DAYS, CONSISTENCY_PCT } = CHALLENGE_MAP[accountType] ?? DEFAULT_CHALLENGE;

  const totalNet        = trades.reduce((s, t) => s + getNet(t), 0);
  const currentBalance  = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalNet;
  const floor           = ACCOUNT_SIZE - MAX_LOSS;
  const distanceToFloor = currentBalance - floor;
  const accountLost     = currentBalance <= floor;
  const equityPoints    = computeChallengePoints(trades, ACCOUNT_SIZE, MAX_LOSS);

  const byDay      = buildByDay(trades);
  const sortedDays = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const tradingDays = sortedDays.length;
  const allDays    = sortedDays;
  const dailyArr   = sortedDays.map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  // Consistency & dynamic target
  const bestDayNet   = Math.max(...Object.values(byDay).filter(p => p > 0), 0);
  const baseLimit    = PROFIT_TARGET * CONSISTENCY_PCT;
  const isConsistencyBreached = bestDayNet >= baseLimit && bestDayNet > 0;
  const dynamicProfitTarget   = isConsistencyBreached ? Math.ceil(bestDayNet / CONSISTENCY_PCT) : PROFIT_TARGET;
  const dynamicLimit          = dynamicProfitTarget * CONSISTENCY_PCT;
  const targetAdjusted        = dynamicProfitTarget > PROFIT_TARGET;
  const targetBalance         = ACCOUNT_SIZE + dynamicProfitTarget;
  const netProfit             = Math.max(totalNet, 0);
  const targetReached         = totalNet >= dynamicProfitTarget;

  // Day-2 validation logic
  const day1Pnl          = tradingDays > 0 ? sortedDays[0][1] : null;
  const day1Respected    = day1Pnl !== null && day1Pnl > 0 && day1Pnl <= baseLimit;
  const canValidateDay2  = day1Respected && tradingDays >= 2 && totalNet >= PROFIT_TARGET;
  const day2Possible     = day1Respected && !targetReached; // day 1 ok but target not yet reached

  const rule1 = !accountLost;
  const rule2 = targetReached;
  const rule3 = tradingDays >= MIN_DAYS;
  const allPassed = rule1 && rule2 && rule3;

  const status = accountLost ? { label: 'COMPTE PERDU ❌', color: '#ff4455' }
    : allPassed ? { label: '✅ CHALLENGE VALIDÉ !', color: '#c41230' }
    : { label: '⏳ EN COURS', color: '#f0a020' };

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setManualBalance(v); localStorage.setItem('pf_challenge_balance', String(v)); setBalanceInput(''); }
  }

  const inp = { background: 'rgba(18,6,10,0.6)', border: '1px solid rgba(196,18,48,0.18)', borderRadius: '4px', padding: '7px 10px', color: '#e0d0d0', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };
  const equityWithTarget = equityPoints.map(p => ({ ...p, target: targetBalance }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Day-2 validation banner */}
      {canValidateDay2 && (
        <div style={{ background: 'rgba(196,18,48,0.10)', border: '1px solid rgba(196,18,48,0.35)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>⚡</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#c41230' }}>Validation J+2 possible !</div>
            <div style={{ fontSize: '12px', color: '#7a4040' }}>J1 dans les 50% ({fmt(day1Pnl, true)} ≤ {fmt(baseLimit)}) · Objectif atteint · Minimum 2 jours respecté</div>
          </div>
        </div>
      )}
      {day2Possible && (
        <div style={{ background: 'rgba(0,170,255,0.06)', border: '1px solid rgba(0,170,255,0.2)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>🎯</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#00aaff' }}>J1 respecté — validation possible dès J+2</div>
            <div style={{ fontSize: '12px', color: '#3a6a7a' }}>J1: {fmt(day1Pnl, true)} ≤ 50% de l'objectif ({fmt(baseLimit)}) · Atteins {fmt(PROFIT_TARGET)} au total pour valider</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" placeholder="Balance réelle ($)" value={balanceInput} onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()} style={{ ...inp, width: '170px' }} />
          <button onClick={saveBalance} style={{ background: 'rgba(196,18,48,0.12)', border: '1px solid rgba(196,18,48,0.28)', color: '#c41230', padding: '7px 14px', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
        </div>
        <div style={{ background: `rgba(${status.color === '#ff4455' ? '255,68,85' : status.color === '#c41230' ? '0,255,136' : '240,160,32'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: status.color }}>{status.label}</div>
      </div>

      {targetAdjusted && (
        <div style={{ background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.3)', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '21px', flexShrink: 0 }}>⚡</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f0a020', marginBottom: '4px' }}>Objectif ajusté — règle 50% dépassée</div>
            <div style={{ fontSize: '13px', color: '#887070', lineHeight: '1.6', marginBottom: '8px' }}>
              Meilleur jour net ({fmt(bestDayNet)}) dépasse 50% de l'objectif initial. Recalcul automatique :
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { label: 'FORMULE', value: `${fmt(bestDayNet)} ÷ 0.50 = ${fmt(dynamicProfitTarget)}`, color: '#f0a020' },
                { label: 'ANCIEN TARGET', value: `+${PROFIT_TARGET}$`, color: '#887070', strike: true },
                { label: 'NOUVEAU TARGET', value: `+${dynamicProfitTarget}$`, color: '#f0a020' },
              ].map(({ label, value, color, strike }) => (
                <div key={label} style={{ background: 'rgba(18,6,10,0.5)', borderRadius: '4px', padding: '8px 12px' }}>
                  <div style={{ fontSize: '12px', color: '#6a3a3a', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color, textDecoration: strike ? 'line-through' : 'none' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rules */}
      <div style={{ background: 'rgba(18,6,10,0.4)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '8px', padding: '18px' }}>
        <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '14px' }}>🎯 RÈGLES CHALLENGE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Drawdown fixe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: rule1 ? 'rgba(196,18,48,0.05)' : 'rgba(255,68,85,0.06)', border: `1px solid ${rule1 ? 'rgba(196,18,48,0.14)' : 'rgba(255,68,85,0.3)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{rule1 ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#e0d0d0', fontWeight: '600', marginBottom: '3px' }}>
                Max Drawdown — {MAX_LOSS.toLocaleString()}$
                <span style={{ fontSize: '11px', color: '#6a3a3a', marginLeft: '8px' }}>Fixe — floor {floor.toLocaleString()}$</span>
              </div>
              <div style={{ fontSize: '13px', color: '#7a4040' }}>Balance minimum : {floor.toLocaleString()}$ · Marge : {distanceToFloor.toFixed(2)}$</div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: rule1 ? '#c41230' : '#ff4455', flexShrink: 0 }}>{fmt(distanceToFloor)} de marge</div>
          </div>

          {/* Profit target */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: rule2 ? 'rgba(196,18,48,0.05)' : 'rgba(18,6,10,0.4)', border: `1px solid ${rule2 ? 'rgba(196,18,48,0.14)' : 'rgba(196,18,48,0.08)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{rule2 ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#e0d0d0', fontWeight: '600', marginBottom: '6px' }}>
                Profit Target — +{dynamicProfitTarget.toLocaleString()}$
                {targetAdjusted && <span style={{ fontSize: '12px', color: '#f0a020', marginLeft: '8px' }}>↑ AJUSTÉ</span>}
              </div>
              <ProgressBar label={null} current={Math.min(netProfit, dynamicProfitTarget)} max={dynamicProfitTarget} color={rule2 ? '#c41230' : '#f0a020'} displayText={`${fmt(netProfit, true)} / +${dynamicProfitTarget}$`} />
            </div>
          </div>

          {/* Jours min */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: rule3 ? 'rgba(196,18,48,0.05)' : 'rgba(18,6,10,0.4)', border: `1px solid ${rule3 ? 'rgba(196,18,48,0.14)' : 'rgba(196,18,48,0.08)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{rule3 ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#e0d0d0', fontWeight: '600', marginBottom: '8px' }}>
                Jours de trading ({MIN_DAYS} min)
                {day1Respected && <span style={{ fontSize: '11px', color: '#00aaff', marginLeft: '8px' }}>· J+2 possible si target atteint</span>}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {allDays.slice(0, 7).map(([date, pnl]) => <DayDot key={date} date={date} pnl={pnl} />)}
                {Array.from({ length: Math.max(0, MIN_DAYS - tradingDays) }).map((_, i) => (
                  <div key={i} style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1.5px dashed #2a1515', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#3a1818' }}>—</div>
                ))}
              </div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: rule3 ? '#c41230' : '#f0a020', flexShrink: 0 }}>{tradingDays}/{MIN_DAYS}</div>
          </div>

          {/* Consistency */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px', background: 'rgba(18,6,10,0.3)', border: `1px solid ${isConsistencyBreached ? 'rgba(240,160,32,0.3)' : 'rgba(196,18,48,0.08)'}`, borderRadius: '6px' }}>
            <span style={{ fontSize: '19px' }}>{isConsistencyBreached ? '⚡' : bestDayNet > 0 ? '✅' : '⏳'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#e0d0d0', fontWeight: '600', marginBottom: '4px' }}>Règle 50% — Meilleur jour &lt; 50% du target</div>
              <div style={{ fontSize: '13px', color: '#7a4040', marginBottom: '8px' }}>
                {isConsistencyBreached ? '⚡ Dépassé — objectif ajusté automatiquement' : `✓ Respecté — meilleur jour : ${fmt(bestDayNet)} / limite : ${fmt(dynamicLimit)}`}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                {[
                  { label: 'MEILLEUR JOUR', value: fmt(bestDayNet, true), color: isConsistencyBreached ? '#f0a020' : '#c41230' },
                  { label: 'LIMITE (50%)', value: fmt(dynamicLimit), color: '#e0d0d0' },
                  { label: day1Pnl !== null ? 'J1 P&L' : '—', value: day1Pnl !== null ? fmt(day1Pnl, true) : '—', color: day1Respected ? '#00aaff' : '#887070' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(18,6,10,0.5)', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#6a3a3a', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        <MetricCard label="BALANCE NETTE" value={`${currentBalance.toFixed(2)}$`} color={rule2 ? '#c41230' : '#e0d0d0'} sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
        <MetricCard label="PROFIT NET" value={fmt(netProfit, true)} color={pnlColor(netProfit)} sub={`Objectif: +${dynamicProfitTarget}$${targetAdjusted ? ' ⚡' : ''}`} />
        <MetricCard label="FLOOR (FIXE)" value={`${floor.toLocaleString()}$`} color="#ff4455" alert={distanceToFloor < 500} sub={`Marge: ${distanceToFloor.toFixed(2)}$`} />
        <MetricCard label="JOURS TRADÉS" value={`${tradingDays}`} color={rule3 ? '#c41230' : '#f0a020'} sub={`Min: ${MIN_DAYS} · J1 ok: ${day1Respected ? 'oui ✓' : 'non'}`} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'rgba(18,6,10,0.4)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '12px' }}>PROGRESSION — Target +{dynamicProfitTarget}${targetAdjusted ? ' ⚡' : ''}</div>
          {equityWithTarget.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityWithTarget} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs><linearGradient id="cG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c41230" stopOpacity={0.15}/><stop offset="95%" stopColor="#c41230" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(196,18,48,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={targetBalance} stroke={targetAdjusted ? '#f0a020' : '#c41230'} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `+${dynamicProfitTarget}$`, fill: targetAdjusted ? '#f0a020' : '#c41230', fontSize: 11 }} />
                <ReferenceLine y={floor} stroke="#ff4455" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `${(floor/1000).toFixed(0)}K`, fill: '#ff4455', fontSize: 11 }} />
                <Area type="monotone" dataKey="balance" name="Capital net" stroke="#c41230" strokeWidth={2} fill="url(#cG)" dot={false} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1818', fontSize: '13px' }}>Aucun trade</div>}
        </div>
        <div style={{ background: 'rgba(18,6,10,0.4)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }} barCategoryGap="35%">
                <CartesianGrid stroke="rgba(196,18,48,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(196,18,48,0.18)" />
                <ReferenceLine y={dynamicLimit} stroke={targetAdjusted ? '#f0a020' : '#6a3a3a'} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `50% ${dynamicLimit.toFixed(0)}$`, fill: targetAdjusted ? '#f0a020' : '#6a3a3a', fontSize: 11, position: 'right' }} />
                <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#c41230" isAnimationActive maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1818', fontSize: '13px' }}>Aucun trade</div>}
        </div>
      </div>

      {allPassed && (
        <div style={{ background: 'rgba(196,18,48,0.10)', border: '2px solid #c41230', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '0 0 30px rgba(196,18,48,0.12)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
          <div style={{ fontSize: '19px', fontWeight: '700', color: '#c41230', marginBottom: '6px' }}>CHALLENGE VALIDÉ !</div>
          <div style={{ fontSize: '13px', color: '#7a4040' }}>Toutes les règles sont respectées. Tu peux passer au compte Funded.</div>
        </div>
      )}
    </div>
  );
}

// ── FUNDED TAB ────────────────────────────────────────────────
function FundedTab({ trades, manualBalance, setManualBalance, balanceInput, setBalanceInput, accountType }) {
  const { ACCOUNT_SIZE, MAX_LOSS } = FUNDED_MAP[accountType] ?? DEFAULT_FUNDED;
  const lockLevel    = ACCOUNT_SIZE + MAX_LOSS;
  const floorInitial = ACCOUNT_SIZE - MAX_LOSS;
  const floorLocked  = ACCOUNT_SIZE;

  const totalNet       = trades.reduce((s, t) => s + getNet(t), 0);
  const currentBalance = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalNet;
  const { points: equityPoints, isLocked } = computeFundedPoints(trades, ACCOUNT_SIZE, MAX_LOSS);
  const floor          = isLocked ? floorLocked : floorInitial;
  const distanceToFloor = currentBalance - floor;
  const accountLost    = currentBalance <= floor;
  const aboveLock      = currentBalance >= lockLevel || isLocked;

  const byDay     = buildByDay(trades);
  const allDays   = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const dailyArr  = allDays.map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));
  const winDays   = Object.values(byDay).filter(p => p > 0).length;
  const posNetPnl = trades.filter(t => getNet(t) > 0).reduce((s,t) => s + getNet(t), 0);
  const bestDayNet = Math.max(...Object.values(byDay).filter(p => p > 0), 0);
  const bestDayPct = posNetPnl > 0 ? (bestDayNet / posNetPnl) * 100 : 0;

  const optionAReady = winDays >= 5;
  const optionBReady = winDays >= 3 && bestDayPct <= 40;
  const [localOption, setLocalOption] = useState(localStorage.getItem('pf_payout_option') || 'A');

  const status = accountLost ? { label: 'COMPTE PERDU', color: '#ff4455' }
    : aboveLock ? { label: '🔒 ZONE SÉCURISÉE', color: '#c41230' }
    : distanceToFloor < 500 ? { label: '⚠️ DANGER', color: '#ff4455' }
    : distanceToFloor < 1000 ? { label: '⚡ ATTENTION', color: '#f0a020' }
    : { label: '✓ EN COURS', color: '#00cc66' };

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setManualBalance(v); localStorage.setItem('pf_funded_balance', String(v)); setBalanceInput(''); }
  }

  const inp = { background: 'rgba(18,6,10,0.6)', border: '1px solid rgba(196,18,48,0.18)', borderRadius: '4px', padding: '7px 10px', color: '#e0d0d0', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" placeholder="Balance réelle ($)" value={balanceInput} onChange={e => setBalanceInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()} style={{ ...inp, width: '170px' }} />
          <button onClick={saveBalance} style={{ background: 'rgba(196,18,48,0.12)', border: '1px solid rgba(196,18,48,0.28)', color: '#c41230', padding: '7px 14px', borderRadius: '4px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
        </div>
        <div style={{ background: `rgba(${status.color === '#ff4455' ? '255,68,85' : status.color === '#f0a020' ? '240,160,32' : '0,255,136'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: status.color }}>{status.label}</div>
        <div style={{ fontSize: '13px', color: '#6a3a3a' }}>P&L net: <span style={{ color: pnlColor(totalNet), fontWeight: '700' }}>{fmt(totalNet, true)}</span></div>
      </div>

      {/* Drawdown section */}
      <div style={{ background: 'rgba(18,6,10,0.4)', border: `1px solid ${distanceToFloor < 500 ? 'rgba(255,68,85,0.3)' : 'rgba(196,18,48,0.10)'}`, borderRadius: '8px', padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '2px' }}>MAX DRAWDOWN — {MAX_LOSS.toLocaleString()}$</div>
          {isLocked
            ? <div style={{ background: 'rgba(196,18,48,0.12)', border: '1px solid rgba(196,18,48,0.35)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#c41230', fontWeight: '700', letterSpacing: '1px' }}>🔒 FLOOR VERROUILLÉ À {ACCOUNT_SIZE.toLocaleString()}$</div>
            : <div style={{ background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.25)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#f0a020', letterSpacing: '1px' }}>⚠ Floor se verrouille à {ACCOUNT_SIZE.toLocaleString()}$ dès {lockLevel.toLocaleString()}$ atteints</div>
          }
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '14px' }}>
          <MetricCard label="BALANCE" value={`${currentBalance.toFixed(2)}$`} color={aboveLock ? '#c41230' : '#e0d0d0'} sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
          <MetricCard label="VERROU À" value={`${lockLevel.toLocaleString()}$`} color="#f0a020" sub={isLocked ? '✅ Atteint' : `Reste ${(lockLevel - currentBalance).toFixed(2)}$`} />
          <MetricCard label="FLOOR" value={`${floor.toFixed(2)}$`} color="#ff4455" alert={distanceToFloor < 500} sub={isLocked ? 'Verrouillé' : 'Mobile → verrou'} />
          <MetricCard label="MARGE" value={`${distanceToFloor.toFixed(2)}$`} color={distanceToFloor < 500 ? '#ff4455' : distanceToFloor < 1000 ? '#f0a020' : '#c41230'} alert={distanceToFloor < 500} />
        </div>
        <div style={{ height: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${Math.min((distanceToFloor / MAX_LOSS) * 100, 100)}%`, background: distanceToFloor < 500 ? 'linear-gradient(90deg,#ff4455,#ff6677)' : distanceToFloor < 1000 ? 'linear-gradient(90deg,#f0a020,#f0c040)' : 'linear-gradient(90deg,#991020,#c41230)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>
            {distanceToFloor.toFixed(2)}$ de marge · Floor: {floor.toFixed(2)}$
          </div>
        </div>
        {isLocked && (
          <div style={{ marginTop: '10px', background: 'rgba(196,18,48,0.10)', border: '1px solid rgba(196,18,48,0.22)', borderRadius: '4px', padding: '8px 12px', fontSize: '13px', color: '#c41230' }}>
            🔒 Floor verrouillé à {ACCOUNT_SIZE.toLocaleString()}$ — tu ne peux plus perdre en dessous de ton capital de départ.
          </div>
        )}
      </div>

      {/* Payout options */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {[
          { key: 'A', title: '💸 PAYOUT STANDARD', desc: '5 jours gagnants nets minimum', ready: optionAReady,
            body: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <ProgressBar label="Jours gagnants (net > 0)" current={Math.min(winDays,5)} max={5} color={winDays>=5?'#c41230':'#f0a020'} displayText={`${winDays}/5 jours`} />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {allDays.slice(-7).map(([date,pnl]) => <DayDot key={date} date={date} pnl={pnl}/>)}
                </div>
                <div style={{ fontSize: '13px', color: optionAReady?'#c41230':'#7a4040' }}>
                  {optionAReady ? '✅ Éligible au payout.' : `⏳ Encore ${5-winDays} jour(s) requis.`}
                </div>
              </div>
            )
          },
          { key: 'B', title: '⚡ PAYOUT CONSISTENCY', desc: '3 jours + règle 40% sur P&L net', ready: optionBReady,
            body: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ProgressBar label="Jours gagnants net (min 3)" current={Math.min(winDays,3)} max={3} color={winDays>=3?'#c41230':'#f0a020'} displayText={`${winDays}/3 jours`} />
                <ProgressBar label="Meilleur jour / Total net positif" current={Math.min(bestDayPct,40)} max={40} color={bestDayPct<=40?'#c41230':'#ff4455'} displayText={`${bestDayPct.toFixed(1)}%/40%`} />
                <div style={{ fontSize: '13px', color: optionBReady?'#c41230':'#7a4040' }}>
                  {optionBReady ? '✅ Éligible au payout.' : winDays<3 ? `⏳ Encore ${3-winDays} jour(s).` : '⚠️ Meilleur jour trop élevé.'}
                </div>
              </div>
            )
          },
        ].map(opt => (
          <div key={opt.key} onClick={() => { setLocalOption(opt.key); localStorage.setItem('pf_payout_option', opt.key); }}
            style={{ background: 'rgba(18,6,10,0.4)', border: `2px solid ${localOption===opt.key?'#c41230':'rgba(196,18,48,0.10)'}`, borderRadius: '8px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '17px', height: '17px', borderRadius: '50%', border: `2px solid ${localOption===opt.key?'#c41230':'#3a1a1a'}`, background: localOption===opt.key?'#c41230':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {localOption===opt.key && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#08050a' }} />}
                </div>
                <span style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '1.5px' }}>{opt.title}</span>
              </div>
              {opt.ready && localOption===opt.key && <span style={{ background: 'rgba(196,18,48,0.18)', border: '1px solid #c41230', color: '#c41230', fontSize: '12px', padding: '2px 8px', borderRadius: '3px', fontWeight: '700' }}>ÉLIGIBLE ✓</span>}
            </div>
            <div style={{ fontSize: '13px', color: '#7a4040', marginBottom: '12px' }}>{opt.desc}</div>
            {opt.body}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ background: 'rgba(18,6,10,0.4)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '12px' }}>COURBE CAPITAL + FLOOR</div>
          {equityPoints.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityPoints} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs><linearGradient id="fG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c41230" stopOpacity={0.15}/><stop offset="95%" stopColor="#c41230" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="rgba(196,18,48,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={lockLevel} stroke="#f0a020" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Verrou ${(lockLevel/1000).toFixed(0)}K`, fill: '#f0a020', fontSize: 11 }} />
                <Area type="monotone" dataKey="balance" name="Capital net" stroke="#c41230" strokeWidth={2} fill="url(#fG)" dot={false} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1818', fontSize: '13px' }}>Aucun trade</div>}
        </div>
        <div style={{ background: 'rgba(18,6,10,0.4)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6a3a3a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }} barCategoryGap="35%">
                <CartesianGrid stroke="rgba(196,18,48,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6a3a3a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(196,18,48,0.18)" />
                <Bar dataKey="pnl" name="P&L net" radius={[3,3,0,0]} fill="#c41230" isAnimationActive maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1818', fontSize: '13px' }}>Aucun trade</div>}
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function PropFirm() {
  const navigate = useNavigate();
  const [account, setAccount]   = useState(null);
  const [trades, setTrades]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState(() => localStorage.getItem('pf_tab') || 'challenge');
  const [balanceInput, setBalanceInput] = useState('');
  const [challengeBalance, setChallengeBalance] = useState(() => parseFloat(localStorage.getItem('pf_challenge_balance') || '0') || 0);
  const [fundedBalance, setFundedBalance]       = useState(() => parseFloat(localStorage.getItem('pf_funded_balance') || '0') || 0);

  useEffect(() => {
    (async () => {
      const [accRes, tradesRes] = await Promise.all([window.accounts.getActive(), window.db.getAllTrades()]);
      if (accRes.ok && accRes.data) setAccount(accRes.data);
      if (tradesRes.ok) setTrades(tradesRes.data);
      setLoading(false);
    })();
  }, []);

  const accountType = account?.type ?? 'topstep_50k';
  const phase = getPhase(accountType);

  // Auto-switch tab based on account phase
  useEffect(() => {
    if (phase === 'funded')    setTab('funded');
    else if (phase === 'challenge') setTab('challenge');
  }, [phase]);

  function switchTab(t) { setTab(t); localStorage.setItem('pf_tab', t); setBalanceInput(''); }

  const cfg = CHALLENGE_MAP[accountType] ?? FUNDED_MAP[accountType] ?? DEFAULT_CHALLENGE;
  const sizeLabel = cfg?.ACCOUNT_SIZE ?? 50000;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6a3a3a', fontSize: '13px', letterSpacing: '2px' }}>CHARGEMENT...</div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#6a3a3a', letterSpacing: '3px', marginBottom: '4px' }}>PROPFIRM</div>
          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#f0e0e2', margin: 0 }}>
            {tab === 'funded' ? `💰 Funded — ${(sizeLabel/1000).toFixed(0)}K` : `🎯 Challenge — ${(sizeLabel/1000).toFixed(0)}K`}
          </h1>
        </div>
        <button onClick={() => navigate('/stats')}
          style={{ background: 'transparent', border: '1px solid #2a1515', color: '#7a4040', padding: '8px 16px', borderRadius: '5px', fontSize: '13px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c41230'; e.currentTarget.style.borderColor = '#c41230'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#7a4040'; e.currentTarget.style.borderColor = '#2a1515'; }}
        >📅 Calendrier & Stats</button>
      </div>

      {account && (
        <div style={{ marginBottom: '16px' }}>
          <PhaseSelector account={account} onChanged={newType => setAccount(prev => ({ ...prev, type: newType }))} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: '20px', background: 'rgba(18,6,10,0.5)', border: '1px solid rgba(196,18,48,0.12)', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'challenge', label: '🎯 Challenge',     desc: 'Compte évaluation · Objectif profit' },
          { key: 'funded',    label: '💰 Funded',        desc: 'Compte live · Payout' },
        ].map(({ key, label, desc }) => (
          <button key={key} onClick={() => switchTab(key)}
            style={{ flex: 1, padding: '13px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: tab===key ? 'rgba(196,18,48,0.14)' : 'transparent', fontFamily: 'inherit' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: tab===key ? '#c41230' : '#8a5050', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '12px', color: tab===key ? '#8a3a3a' : '#3a5a3a' }}>{desc}</div>
            {tab===key && <div style={{ height: '2px', background: '#c41230', borderRadius: '2px', marginTop: '8px', boxShadow: '0 0 6px #c41230' }} />}
          </button>
        ))}
      </div>

      {tab === 'funded' ? (
        <FundedTab trades={trades} manualBalance={fundedBalance} setManualBalance={setFundedBalance} balanceInput={balanceInput} setBalanceInput={setBalanceInput} accountType={accountType} />
      ) : (
        <ChallengeTab trades={trades} manualBalance={challengeBalance} setManualBalance={setChallengeBalance} balanceInput={balanceInput} setBalanceInput={setBalanceInput} accountType={accountType} />
      )}
    </div>
  );
}
