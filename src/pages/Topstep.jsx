import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const ACCOUNT_SIZE  = 50000;
const MAX_LOSS      = 2000;
const FLOOR_INITIAL = ACCOUNT_SIZE - MAX_LOSS; // 48 000$
const LOCK_LEVEL    = 52000;

function fmt(n, sign = false) {
  if (n == null) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(0)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', fontFamily: 'inherit' }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.name === 'Floor' ? '#ff4455' : '#00ff88', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? `${p.value.toFixed(0)}$` : p.value}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, color = '#c8d8c8', alert = false }) {
  return (
    <div style={{
      background: alert ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.5)',
      border: `1px solid ${alert ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`,
      borderTop: `2px solid ${color}`,
      borderRadius: '6px', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: alert ? '#ff8888' : '#3a6a4a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, current, max, color, displayText }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', color: '#8aaa90' }}>{label}</span>
        <span style={{ fontSize: '10px', color, fontWeight: '700' }}>{displayText}</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(0,255,136,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  );
}

function DayDot({ date, pnl }) {
  const isWin = pnl > 0;
  return (
    <div title={`${date}: ${fmt(pnl, true)}`} style={{
      width: '30px', height: '30px', borderRadius: '50%',
      background: isWin ? 'rgba(0,255,136,0.12)' : 'rgba(255,68,85,0.12)',
      border: `1.5px solid ${isWin ? '#00ff88' : '#ff4455'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '9px', color: isWin ? '#00ff88' : '#ff4455', fontWeight: '700',
      boxShadow: isWin ? '0 0 8px rgba(0,255,136,0.2)' : 'none',
      cursor: 'default',
    }}>
      {isWin ? '✓' : '✗'}
    </div>
  );
}

export default function Topstep() {
  const navigate = useNavigate();
  const [trades, setTrades]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [balanceInput, setBalanceInput] = useState('');
  const [manualBalance, setManualBalance] = useState(() => {
    try { return parseFloat(localStorage.getItem('ts_balance') || '0') || 0; } catch { return 0; }
  });
  // Option A = Standard, Option B = Consistency
  const [payoutOption, setPayoutOption] = useState(() => {
    return localStorage.getItem('ts_payout_option') || 'A';
  });

  useEffect(() => {
    (async () => {
      const res = await window.db.getAllTrades();
      if (res.ok) setTrades(res.data);
      setLoading(false);
    })();
  }, []);

  function selectOption(opt) {
    setPayoutOption(opt);
    localStorage.setItem('ts_payout_option', opt);
  }

  function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) {
      setManualBalance(v);
      localStorage.setItem('ts_balance', String(v));
      setBalanceInput('');
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>
      CHARGEMENT...
    </div>
  );

  // ── Compute ───────────────────────────────────────────────
  const totalPnl = trades.reduce((s, t) => s + (t.result ?? 0), 0);
  const currentBalance = manualBalance > 0 ? manualBalance : ACCOUNT_SIZE + totalPnl;

  // Trailing drawdown
  const sorted = [...trades].filter(t => t.result != null).sort((a, b) => a.date.localeCompare(b.date));
  let runBal = manualBalance > 0 ? manualBalance - totalPnl : ACCOUNT_SIZE;
  let hwm    = runBal;
  let floor  = runBal - MAX_LOSS;

  const byDayArr = sorted.reduce((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.date === t.date) { last.pnl += t.result ?? 0; }
    else acc.push({ date: t.date, pnl: t.result ?? 0 });
    return acc;
  }, []);

  const equityPoints = [{ date: 'Start', balance: runBal, floor }];
  byDayArr.forEach(({ date, pnl }) => {
    runBal += pnl;
    if (runBal > hwm) { hwm = runBal; floor = hwm - MAX_LOSS; }
    equityPoints.push({ date: date.slice(5), balance: Math.round(runBal * 100) / 100, floor: Math.round(floor * 100) / 100 });
  });

  const currentFloor    = floor;
  const distanceToFloor = currentBalance - currentFloor;
  const accountLost     = currentBalance <= currentFloor;
  const isAboveLock     = currentBalance >= LOCK_LEVEL;

  // Daily P&L
  const byDay = trades.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = 0;
    acc[t.date] += t.result ?? 0;
    return acc;
  }, {});
  const dailyArr = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  // Payout
  const winningDaysArr = Object.entries(byDay).filter(([,p]) => p > 0).sort(([a],[b]) => a.localeCompare(b));
  const winDayCount    = winningDaysArr.length;
  const positivePnl    = trades.filter(t => (t.result ?? 0) > 0).reduce((s,t) => s + t.result, 0);
  const bestDayVal     = Math.max(...Object.values(byDay).filter(p => p > 0), 0);
  const bestDayPct     = positivePnl > 0 ? (bestDayVal / positivePnl) * 100 : 0;

  // Option A: 5 winning days
  const optionAReady = winDayCount >= 5;
  // Option B: 3 winning days + rule 40%
  const optionBReady = winDayCount >= 3 && bestDayPct <= 40;

  const activeOptionReady = payoutOption === 'A' ? optionAReady : optionBReady;

  const status = accountLost
    ? { label: 'COMPTE PERDU', color: '#ff4455' }
    : isAboveLock ? { label: '🔒 ZONE SÉCURISÉE', color: '#00ff88' }
    : distanceToFloor < 500 ? { label: '⚠️ DANGER', color: '#ff4455' }
    : distanceToFloor < 1000 ? { label: '⚡ ATTENTION', color: '#f0a020' }
    : { label: '✓ EN COURS', color: '#00cc66' };

  const allDays = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>TOPSTEP</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Express Funded — 50K</h1>
          <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '4px' }}>
            Trailing drawdown -{MAX_LOSS}$ · 5 minis / 50 micros max
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Calendar shortcut */}
          <button onClick={() => navigate('/calendar')} style={{
            background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a',
            padding: '7px 14px', borderRadius: '5px', fontSize: '10px',
            fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
          >
            📅 Calendrier
          </button>
          {/* Balance input */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <input type="number" placeholder="Balance réelle ($)" value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveBalance()}
              style={{ background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '4px', padding: '6px 10px', color: '#c8d8c8', fontSize: '11px', fontFamily: 'inherit', outline: 'none', width: '150px' }} />
            <button onClick={saveBalance} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '6px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>MAJ</button>
          </div>
          {/* Status */}
          <div style={{ background: `rgba(${status.color==='#ff4455'?'255,68,85':status.color==='#f0a020'?'240,160,32':'0,255,136'},0.08)`, border: `1px solid ${status.color}40`, borderRadius: '6px', padding: '8px 14px', fontSize: '11px', fontWeight: '700', color: status.color, letterSpacing: '1px' }}>
            {status.label}
          </div>
        </div>
      </div>

      {/* ── PAYOUT OPTION SELECTOR ── */}
      <div style={{
        background: 'rgba(10,28,18,0.4)',
        border: '1px solid rgba(0,255,136,0.1)',
        borderRadius: '8px', padding: '18px 20px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>
          💸 MON PROGRAMME DE PAYOUT
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

          {/* Option A */}
          <div
            onClick={() => selectOption('A')}
            style={{
              background: payoutOption === 'A' ? 'rgba(0,255,136,0.08)' : 'rgba(10,28,18,0.5)',
              border: `2px solid ${payoutOption === 'A' ? '#00ff88' : 'rgba(0,255,136,0.1)'}`,
              borderRadius: '8px', padding: '16px 18px',
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: payoutOption === 'A' ? '0 0 20px rgba(0,255,136,0.1)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: `2px solid ${payoutOption === 'A' ? '#00ff88' : '#2a5a3a'}`,
                  background: payoutOption === 'A' ? '#00ff88' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {payoutOption === 'A' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#060c10' }} />}
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: payoutOption === 'A' ? '#00ff88' : '#c8d8c8' }}>
                  OPTION A — Standard
                </span>
              </div>
              {optionAReady && payoutOption === 'A' && (
                <span style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', color: '#00ff88', fontSize: '8px', padding: '2px 7px', borderRadius: '3px', fontWeight: '700' }}>
                  ÉLIGIBLE ✓
                </span>
              )}
            </div>

            <div style={{ fontSize: '11px', color: '#5a8a6a', marginBottom: '12px', lineHeight: '1.5' }}>
              5 jours gagnants minimum requis avant de demander un payout.
              Aucune contrainte sur la taille des gains journaliers.
            </div>

            <ProgressBar
              label="Jours gagnants"
              current={Math.min(winDayCount, 5)}
              max={5}
              color={winDayCount >= 5 ? '#00ff88' : '#f0a020'}
              displayText={`${winDayCount} / 5 jours`}
            />

            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
              {allDays.slice(-8).map(([date, pnl]) => (
                <DayDot key={date} date={date} pnl={pnl} />
              ))}
              {Array.from({ length: Math.max(0, 5 - Math.min(winDayCount, 5)) }).map((_, i) => (
                <div key={`e-${i}`} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px dashed #1a3a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#2a4a30' }}>—</div>
              ))}
            </div>

            {payoutOption === 'A' && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: optionAReady ? '#00ff88' : '#4a7a5a', lineHeight: '1.5' }}>
                {optionAReady
                  ? '✅ Tu peux demander un payout maintenant.'
                  : `⏳ Encore ${5 - winDayCount} jour${5 - winDayCount > 1 ? 's' : ''} gagnant${5 - winDayCount > 1 ? 's' : ''} requis.`}
              </div>
            )}
          </div>

          {/* Option B */}
          <div
            onClick={() => selectOption('B')}
            style={{
              background: payoutOption === 'B' ? 'rgba(0,255,136,0.08)' : 'rgba(10,28,18,0.5)',
              border: `2px solid ${payoutOption === 'B' ? '#00ff88' : 'rgba(0,255,136,0.1)'}`,
              borderRadius: '8px', padding: '16px 18px',
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: payoutOption === 'B' ? '0 0 20px rgba(0,255,136,0.1)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: `2px solid ${payoutOption === 'B' ? '#00ff88' : '#2a5a3a'}`,
                  background: payoutOption === 'B' ? '#00ff88' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {payoutOption === 'B' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#060c10' }} />}
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: payoutOption === 'B' ? '#00ff88' : '#c8d8c8' }}>
                  OPTION B — Consistency
                </span>
              </div>
              {optionBReady && payoutOption === 'B' && (
                <span style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid #00ff88', color: '#00ff88', fontSize: '8px', padding: '2px 7px', borderRadius: '3px', fontWeight: '700' }}>
                  ÉLIGIBLE ✓
                </span>
              )}
            </div>

            <div style={{ fontSize: '11px', color: '#5a8a6a', marginBottom: '12px', lineHeight: '1.5' }}>
              3 jours gagnants minimum + règle des 40% : ton meilleur jour
              ne doit pas dépasser 40% de ton profit brut total.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ProgressBar
                label="Jours gagnants (min 3)"
                current={Math.min(winDayCount, 3)}
                max={3}
                color={winDayCount >= 3 ? '#00ff88' : '#f0a020'}
                displayText={`${winDayCount} / 3 jours`}
              />
              <ProgressBar
                label="Règle 40% — Meilleur jour"
                current={Math.min(bestDayPct, 40)}
                max={40}
                color={bestDayPct <= 40 ? '#00ff88' : '#ff4455'}
                displayText={`${bestDayPct.toFixed(1)}% / 40% max`}
              />
            </div>

            {/* Consistency detail */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginTop: '10px' }}>
              {[
                { label: 'MEILLEUR JOUR', value: fmt(bestDayVal, true), color: '#00ff88' },
                { label: 'PROFIT BRUT', value: fmt(positivePnl, true), color: '#c8d8c8' },
                { label: 'LIMITE 40%', value: fmt(positivePnl * 0.4), color: bestDayPct <= 40 ? '#3a6a4a' : '#ff4455' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '4px', padding: '7px', textAlign: 'center' }}>
                  <div style={{ fontSize: '7px', color: '#3a6a4a', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color }}>{value}</div>
                </div>
              ))}
            </div>

            {payoutOption === 'B' && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: optionBReady ? '#00ff88' : '#4a7a5a', lineHeight: '1.5' }}>
                {optionBReady
                  ? '✅ Tu peux demander un payout consistency.'
                  : winDayCount < 3
                  ? `⏳ Encore ${3 - winDayCount} jour(s) gagnant(s) requis.`
                  : `⚠️ Meilleur jour trop élevé — cible max ${fmt(positivePnl * 0.4)} par jour.`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TRAILING DRAWDOWN ── */}
      <div style={{
        background: accountLost ? 'rgba(255,68,85,0.06)' : distanceToFloor < 500 ? 'rgba(255,68,85,0.04)' : 'rgba(10,28,18,0.4)',
        border: `1px solid ${accountLost || distanceToFloor < 500 ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.08)'}`,
        borderRadius: '8px', padding: '20px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>
          ⚠️ TRAILING DRAWDOWN — RÈGLE PRINCIPALE
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '16px' }}>
          <MetricCard label="BALANCE" value={`${currentBalance.toFixed(0)}$`}
            color={currentBalance >= LOCK_LEVEL ? '#00ff88' : '#c8d8c8'}
            sub={manualBalance > 0 ? 'Manuelle' : 'Estimée'} />
          <MetricCard label="HIGH WATER MARK" value={`${hwm.toFixed(0)}$`} color="#f0a020" sub="Plus haut atteint" />
          <MetricCard label="FLOOR ACTUEL" value={`${currentFloor.toFixed(0)}$`} color="#ff4455"
            sub="Ne pas descendre sous" alert={distanceToFloor < 500} />
          <MetricCard label="MARGE" value={`${distanceToFloor.toFixed(0)}$`}
            color={distanceToFloor < 500 ? '#ff4455' : distanceToFloor < 1000 ? '#f0a020' : '#00ff88'}
            sub={`${((distanceToFloor / MAX_LOSS) * 100).toFixed(0)}% de sécurité`}
            alert={distanceToFloor < 500} />
        </div>

        {/* Visual bar */}
        <div style={{ height: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${Math.min((distanceToFloor / MAX_LOSS) * 100, 100)}%`,
            background: distanceToFloor < 500 ? 'linear-gradient(90deg,#ff4455,#ff6677)' : distanceToFloor < 1000 ? 'linear-gradient(90deg,#f0a020,#f0c040)' : 'linear-gradient(90deg,#00aa55,#00ff88)',
            borderRadius: '4px', transition: 'width 0.5s ease',
          }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
            {distanceToFloor.toFixed(0)}$ de marge · Floor: {currentFloor.toFixed(0)}$
          </div>
        </div>

        {isAboveLock && (
          <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '10px', color: '#00ff88' }}>
            🔒 Au-dessus de {LOCK_LEVEL}$ — trailing se stabilise. Réduire encore le risque.
          </div>
        )}
      </div>

      {/* ── CHARTS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Equity curve */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '18px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>COURBE CAPITAL + FLOOR</div>
          {equityPoints.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityPoints} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs>
                  <linearGradient id="balG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={LOCK_LEVEL} stroke="#f0a020" strokeDasharray="4 4" strokeOpacity={0.4} />
                <Area type="monotone" dataKey="balance" name="Capital" stroke="#00ff88" strokeWidth={2} fill="url(#balG)" dot={false} activeDot={{ r: 3, fill: '#00ff88' }} />
                <Area type="monotone" dataKey="floor" name="Floor" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>
              Enregistrez des trades pour voir la courbe
            </div>
          )}
        </div>

        {/* Daily bars */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '18px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>P&L PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
            {[
              { label: 'JOURS +', value: winDayCount, color: '#00ff88' },
              { label: 'JOURS -', value: Object.values(byDay).filter(p => p <= 0).length, color: '#ff4455' },
              { label: 'P&L NET', value: fmt(totalPnl, true), color: pnlColor(totalPnl) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '4px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '7px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rules reminder */}
      <div style={{ marginTop: '16px', background: 'rgba(10,28,18,0.3)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '6px', padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '8px' }}>
        {[
          { icon: '📉', text: 'Trailing drawdown -2 000$' },
          { icon: '🔒', text: 'Floor se fixe au-dessus de 52K' },
          { icon: '📊', text: '5 minis OU 50 micros max' },
          { icon: '💸', text: `Programme actif : Option ${payoutOption}` },
          { icon: '🎯', text: 'Objectif : régularité + survie' },
          { icon: '⚡', text: 'Réduire le risque après HWM' },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>{icon}</span>
            <span style={{ fontSize: '10px', color: '#4a7a5a' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
