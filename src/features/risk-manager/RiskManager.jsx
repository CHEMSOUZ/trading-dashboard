import { useState, useEffect, useMemo } from 'react';

// ── Contract specs (futures) ──────────────────────────────────
const CONTRACTS = {
  MNQ:  { label: 'Micro NQ',       tickSize: 0.25,  tickValue: 0.50,  pointValue: 2    },
  NQ:   { label: 'NQ (E-mini)',     tickSize: 0.25,  tickValue: 5.00,  pointValue: 20   },
  MES:  { label: 'Micro ES',        tickSize: 0.25,  tickValue: 1.25,  pointValue: 5    },
  ES:   { label: 'ES (E-mini)',     tickSize: 0.25,  tickValue: 12.50, pointValue: 50   },
  MGC:  { label: 'Micro Gold',      tickSize: 0.10,  tickValue: 1.00,  pointValue: 10   },
  GC:   { label: 'Gold',            tickSize: 0.10,  tickValue: 10.00, pointValue: 100  },
  MCL:  { label: 'Micro CL',        tickSize: 0.01,  tickValue: 1.00,  pointValue: 100  },
  CL:   { label: 'Crude Oil',       tickSize: 0.01,  tickValue: 10.00, pointValue: 1000 },
  M2K:  { label: 'Micro R2K',       tickSize: 0.10,  tickValue: 0.50,  pointValue: 5    },
  RTY:  { label: 'Russell 2000',    tickSize: 0.10,  tickValue: 5.00,  pointValue: 50   },
  AUTRE:{ label: 'Autre / Forex',   tickSize: 1,     tickValue: 1,     pointValue: 1    },
};

const ACCOUNT_RULES_DEFAULT = {
  topstep_50k:      { size: 50000,  maxLoss: 2000, dailyLoss: 1000  },
  topstep_100k:     { size: 100000, maxLoss: 3000, dailyLoss: 2000  },
  topstep_150k:     { size: 150000, maxLoss: 4500, dailyLoss: 3000  },
  topstep_ef_50k:   { size: 50000,  maxLoss: 2000, dailyLoss: 1000  },
  topstep_ef_100k:  { size: 100000, maxLoss: 3000, dailyLoss: 2000  },
  lucid_eval_50k:   { size: 50000,  maxLoss: 2000, dailyLoss: null  },
  lucid_eval_100k:  { size: 100000, maxLoss: 3000, dailyLoss: null  },
  lucid_funded_50k: { size: 50000,  maxLoss: 2500, dailyLoss: 2000  },
  lucid_funded_100k:{ size: 100000, maxLoss: 3000, dailyLoss: 3000  },
  perso:            { size: null,   maxLoss: null,  dailyLoss: null  },
  autre:            { size: null,   maxLoss: null,  dailyLoss: null  },
};

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

function StatCard({ label, value, sub, color = '#dde4ef', glow = false }) {
  return (
    <div style={{ padding: '16px 18px', background: 'rgba(14,15,22,0.8)', border: `1px solid ${glow ? color + '30' : 'rgba(136,153,187,0.12)'}`, borderRadius: '10px', boxShadow: glow ? `0 0 20px ${color}15` : 'none' }}>
      <div style={{ fontSize: '10px', color: '#5a6a82', letterSpacing: '1.5px', marginBottom: '6px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#5a6a82', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function GaugeBar({ label, value, max, color, warning }) {
  if (!max) return null;
  const pct = Math.min(1, Math.max(0, value / max));
  const isWarn = warning && pct >= warning;
  const barColor = pct >= 0.9 ? '#ff3344' : pct >= (warning ?? 0.7) ? '#f59e0b' : color;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', color: '#8899bb' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: '700', color: barColor }}>{fmt(value)}$ / {fmt(max)}$</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(136,153,187,0.12)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: barColor, borderRadius: '3px', transition: 'width 0.4s ease', boxShadow: `0 0 8px ${barColor}60` }} />
      </div>
      <div style={{ fontSize: '10px', color: pct >= 0.9 ? '#ff3344' : '#5a6a82', marginTop: '3px', textAlign: 'right' }}>
        {fmt(max - value)}$ restants ({fmt((1 - pct) * 100, 0)}%)
      </div>
    </div>
  );
}

export default function RiskManager() {
  const [account,    setAccount]    = useState(null);
  const [trades,     setTrades]     = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);

  // Calculator state
  const [instrument, setInstrument] = useState('MNQ');
  const [accountSz,  setAccountSz]  = useState('');
  const [riskMode,   setRiskMode]   = useState('pct'); // 'pct' | 'usd'
  const [riskPct,    setRiskPct]    = useState('1');
  const [riskUsd,    setRiskUsd]    = useState('');
  const [entry,      setEntry]      = useState('');
  const [stopLoss,   setStopLoss]   = useState('');
  const [direction,  setDirection]  = useState('LONG');

  // Rules override
  const [maxLossOverride,  setMaxLossOverride]  = useState('');
  const [dailyLossOverride,setDailyLossOverride] = useState('');
  const [maxTradesDay,     setMaxTradesDay]      = useState('');

  useEffect(() => {
    (async () => {
      const [accRes, tradesRes, statsRes] = await Promise.all([
        window.accounts.getActive(),
        window.db.getAllTrades(),
        window.db.getStats(),
      ]);
      if (accRes.ok && accRes.data) {
        const acc = accRes.data;
        setAccount(acc);
        const rules = ACCOUNT_RULES_DEFAULT[acc.type] ?? {};
        if (rules.size)       setAccountSz(String(rules.size));
        if (rules.maxLoss)    setMaxLossOverride(String(rules.maxLoss));
        if (rules.dailyLoss)  setDailyLossOverride(String(rules.dailyLoss));
      }
      if (tradesRes.ok) setTrades(tradesRes.data ?? []);
      if (statsRes.ok)  setStats(statsRes.data ?? null);
      setLoading(false);
    })();
  }, []);

  // Today's PnL
  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = useMemo(() => trades.filter(t => (t.entered_at || t.date || '').startsWith(today)), [trades, today]);
  const todayPnl    = useMemo(() => todayTrades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0), [todayTrades]);

  // Max drawdown from peak
  const totalPnl = stats?.totalPnl ?? 0;

  // Calculator
  const calc = useMemo(() => {
    const spec    = CONTRACTS[instrument] ?? CONTRACTS.MNQ;
    const accSize = parseFloat(accountSz) || 0;
    const ent     = parseFloat(entry) || 0;
    const sl      = parseFloat(stopLoss) || 0;
    const rPct    = parseFloat(riskPct) / 100 || 0.01;

    if (!ent || !sl) return null;

    const distPoints = Math.abs(ent - sl);
    if (distPoints === 0) return null;

    const dollarPerContract = distPoints * spec.pointValue;
    if (dollarPerContract === 0) return null;

    const riskDollar = riskMode === 'pct'
      ? accSize * rPct
      : (parseFloat(riskUsd) || 0);

    const contracts = riskDollar / dollarPerContract;
    const contractsFloor = Math.floor(contracts);
    const actualRisk     = contractsFloor * dollarPerContract;
    const ticks          = distPoints / spec.tickSize;

    // RR needed for 1:1, 1:2, 1:3
    const rrTargets = [1, 1.5, 2, 3].map(rr => {
      const tpDist = distPoints * rr;
      const tpPrice = direction === 'LONG' ? ent + tpDist : ent - tpDist;
      const profit  = contractsFloor * tpDist * spec.pointValue;
      return { rr, tpPrice, profit };
    });

    return { spec, distPoints, dollarPerContract, riskDollar, contracts, contractsFloor, actualRisk, ticks, rrTargets };
  }, [instrument, accountSz, riskMode, riskPct, riskUsd, entry, stopLoss, direction]);

  // Health score (0-100)
  const healthScore = useMemo(() => {
    let score = 100;
    const mL  = parseFloat(maxLossOverride) || 0;
    const dL  = parseFloat(dailyLossOverride) || 0;
    const mT  = parseInt(maxTradesDay) || 0;

    if (stats?.maxDrawdown && mL) {
      const ddRatio = stats.maxDrawdown / mL;
      if (ddRatio > 0.8) score -= 30;
      else if (ddRatio > 0.5) score -= 15;
    }
    if (dL && Math.abs(todayPnl) / dL > 0.7 && todayPnl < 0) score -= 20;
    if (stats?.streak < -3) score -= 20;
    if (stats?.winrate < 35) score -= 15;
    if (mT && todayTrades.length > mT * 0.8) score -= 10;

    return Math.max(0, Math.min(100, score));
  }, [stats, todayPnl, todayTrades, maxLossOverride, dailyLossOverride, maxTradesDay]);

  const healthColor = healthScore >= 70 ? '#00ff88' : healthScore >= 40 ? '#f59e0b' : '#ff3344';
  const healthLabel = healthScore >= 70 ? 'BON' : healthScore >= 40 ? 'ATTENTION' : 'DANGER';

  const inputStyle = {
    width: '100%', background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.18)',
    borderRadius: '6px', padding: '9px 12px', color: '#dde4ef', fontSize: '13px',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = { fontSize: '11px', color: '#5a6a82', marginBottom: '5px', letterSpacing: '0.5px', display: 'block' };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#5a6a82' }}>Chargement...</div>;

  return (
    <div style={{ padding: '24px', color: '#dde4ef', fontFamily: 'inherit', maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '4px' }}>
          RISK MANAGER
        </div>
        <div style={{ fontSize: '12px', color: '#5a6a82' }}>
          {account?.name ?? '—'} · Calculateur de position et gestion du risque en temps réel
        </div>
      </div>

      {/* Health score + today stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '16px', marginBottom: '24px' }}>

        {/* Health Score */}
        <div style={{ padding: '20px', background: 'rgba(14,15,22,0.8)', border: `1px solid ${healthColor}30`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${healthColor}10` }}>
          <div style={{ fontSize: '11px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '12px' }}>SANTÉ DU COMPTE</div>
          <div style={{ position: 'relative', width: '90px', height: '90px' }}>
            <svg width="90" height="90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(136,153,187,0.1)" strokeWidth="8"/>
              <circle cx="45" cy="45" r="36" fill="none" stroke={healthColor}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - healthScore / 100)}`}
                transform="rotate(-90 45 45)"
                style={{ filter: `drop-shadow(0 0 6px ${healthColor})`, transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: healthColor }}>{healthScore}</div>
              <div style={{ fontSize: '8px', color: healthColor, letterSpacing: '1px' }}>{healthLabel}</div>
            </div>
          </div>
        </div>

        {/* Today summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <StatCard label="PnL du jour" value={`${todayPnl >= 0 ? '+' : ''}${fmt(todayPnl)}$`}
            color={todayPnl >= 0 ? '#00ff88' : '#ff3344'} glow />
          <StatCard label="Trades aujourd'hui" value={todayTrades.length}
            sub={`${parseFloat(maxTradesDay) > 0 ? `/ ${maxTradesDay} max` : 'pas de limite'}`} color="#8899bb" />
          <StatCard label="WR aujourd'hui"
            value={todayTrades.length > 0 ? `${Math.round(todayTrades.filter(t => (t.result_net ?? t.result ?? 0) > 0).length / todayTrades.length * 100)}%` : '—'}
            sub={`Global: ${stats?.winrate?.toFixed(1) ?? '—'}%`} color="#f59e0b" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── LEFT: Calculator ───────────────────────────────── */}
        <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg>
            CALCULATEUR DE POSITION
          </div>

          {/* Instrument */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>INSTRUMENT</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {Object.keys(CONTRACTS).map(key => (
                <button key={key} onClick={() => setInstrument(key)}
                  style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: instrument === key ? '700' : '400', transition: 'all 0.15s',
                    background: instrument === key ? 'rgba(124,58,237,0.20)' : 'rgba(136,153,187,0.06)',
                    border: `1px solid ${instrument === key ? 'rgba(124,58,237,0.5)' : 'rgba(136,153,187,0.15)'}`,
                    color: instrument === key ? '#a78bfa' : '#5a6a82',
                  }}>
                  {key}
                </button>
              ))}
            </div>
            {instrument && (
              <div style={{ fontSize: '11px', color: '#5a6a82', marginTop: '5px' }}>
                {CONTRACTS[instrument].label} · {CONTRACTS[instrument].pointValue}$/point · tick {CONTRACTS[instrument].tickSize} = {CONTRACTS[instrument].tickValue}$
              </div>
            )}
          </div>

          {/* Direction */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>DIRECTION</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['LONG', 'SHORT'].map(d => (
                <button key={d} onClick={() => setDirection(d)}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700', transition: 'all 0.15s',
                    background: direction === d ? (d === 'LONG' ? 'rgba(0,255,136,0.12)' : 'rgba(255,51,68,0.12)') : 'rgba(136,153,187,0.06)',
                    border: `1px solid ${direction === d ? (d === 'LONG' ? 'rgba(0,255,136,0.35)' : 'rgba(255,51,68,0.35)') : 'rgba(136,153,187,0.15)'}`,
                    color: direction === d ? (d === 'LONG' ? '#00ff88' : '#ff3344') : '#5a6a82',
                  }}>
                  {d === 'LONG' ? '▲ LONG' : '▼ SHORT'}
                </button>
              ))}
            </div>
          </div>

          {/* Account size + Risk */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>TAILLE DU COMPTE ($)</label>
              <input type="number" value={accountSz} onChange={e => setAccountSz(e.target.value)}
                placeholder="50000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>
                RISQUE&nbsp;
                <span onClick={() => setRiskMode(m => m === 'pct' ? 'usd' : 'pct')}
                  style={{ cursor: 'pointer', color: '#7c3aed', textDecoration: 'underline' }}>
                  {riskMode === 'pct' ? '(%) → $' : '($) → %'}
                </span>
              </label>
              {riskMode === 'pct'
                ? <input type="number" value={riskPct} onChange={e => setRiskPct(e.target.value)} placeholder="1" min="0.1" max="10" step="0.1" style={inputStyle} />
                : <input type="number" value={riskUsd} onChange={e => setRiskUsd(e.target.value)} placeholder="500" style={inputStyle} />
              }
            </div>
          </div>

          {/* Entry / SL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={labelStyle}>ENTRÉE</label>
              <input type="number" value={entry} onChange={e => setEntry(e.target.value)} placeholder="20000" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>STOP LOSS</label>
              <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="19950" style={inputStyle} />
            </div>
          </div>

          {/* Result */}
          {calc ? (
            <div style={{ marginTop: '18px', padding: '16px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.20)', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '12px' }}>RÉSULTAT</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#5a6a82' }}>CONTRATS</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#00ff88' }}>{calc.contractsFloor}</div>
                  <div style={{ fontSize: '10px', color: '#5a6a82' }}>(exact: {calc.contracts.toFixed(2)})</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#5a6a82' }}>$ RISQUÉS</div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{fmt(calc.actualRisk)}</div>
                  <div style={{ fontSize: '10px', color: '#5a6a82' }}>{accountSz ? `${(calc.actualRisk / parseFloat(accountSz) * 100).toFixed(2)}% du compte` : ''}</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#5a6a82', marginBottom: '8px' }}>
                Distance SL: {fmt(calc.distPoints)} pts · {calc.ticks} ticks · {fmt(calc.dollarPerContract)}$/contrat
              </div>

              {/* TP targets */}
              <div style={{ borderTop: '1px solid rgba(136,153,187,0.10)', paddingTop: '12px' }}>
                <div style={{ fontSize: '10px', color: '#5a6a82', marginBottom: '8px', letterSpacing: '1.5px' }}>OBJECTIFS TP</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                  {calc.rrTargets.map(({ rr, tpPrice, profit }) => (
                    <div key={rr} style={{ padding: '8px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#00ff88', fontWeight: '700' }}>1:{rr}</div>
                      <div style={{ fontSize: '11px', color: '#dde4ef', fontWeight: '600' }}>{fmt(tpPrice)}</div>
                      <div style={{ fontSize: '10px', color: '#00cc6a' }}>+{fmt(profit)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px', background: 'rgba(136,153,187,0.05)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '8px', fontSize: '12px', color: '#5a6a82', textAlign: 'center' }}>
              Renseigne l'entrée et le stop loss pour calculer
            </div>
          )}
        </div>

        {/* ── RIGHT: Rules + Gauges ──────────────────────────── */}
        <div>
          {/* Rules config */}
          <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              RÈGLES DU COMPTE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Max Drawdown ($)', val: maxLossOverride,   set: setMaxLossOverride,   ph: '2000' },
                { label: 'Daily Loss Max ($)', val: dailyLossOverride, set: setDailyLossOverride, ph: '1000' },
                { label: 'Max Trades / Jour', val: maxTradesDay,      set: setMaxTradesDay,      ph: '5' },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                    style={{ ...inputStyle, fontSize: '12px' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Gauges */}
          <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '16px' }}>
              UTILISATION DES LIMITES
            </div>
            <GaugeBar label="Drawdown total utilisé" value={Math.max(0, stats?.maxDrawdown ?? 0)} max={parseFloat(maxLossOverride) || null} color="#7c3aed" warning={0.7} />
            <GaugeBar label="Perte du jour" value={Math.max(0, -todayPnl)} max={parseFloat(dailyLossOverride) || null} color="#f59e0b" warning={0.6} />
            {parseInt(maxTradesDay) > 0 && (
              <GaugeBar label="Trades du jour" value={todayTrades.length} max={parseInt(maxTradesDay)} color="#00ff88" warning={0.8} />
            )}
            {!parseFloat(maxLossOverride) && !parseFloat(dailyLossOverride) && (
              <div style={{ fontSize: '12px', color: '#5a6a82', textAlign: 'center', padding: '8px' }}>
                Configure les règles ci-dessus pour voir les barres de progression
              </div>
            )}
          </div>

          {/* Account stats */}
          <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '16px' }}>
              STATISTIQUES GLOBALES
            </div>
            {stats && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  ['PnL Total',    `${stats.totalPnl >= 0 ? '+' : ''}${fmt(stats.totalPnl)}$`,    stats.totalPnl >= 0 ? '#00ff88' : '#ff3344'],
                  ['Winrate',      `${stats.winrate?.toFixed(1)}%`,  stats.winrate >= 50 ? '#00ff88' : '#f59e0b'],
                  ['Profit Factor', stats.profitFactor?.toFixed(2),  stats.profitFactor >= 1.5 ? '#00ff88' : stats.profitFactor >= 1 ? '#f59e0b' : '#ff3344'],
                  ['Streak actuel', stats.streak > 0 ? `+${stats.streak} vert` : `${stats.streak} rouge`, stats.streak > 0 ? '#00ff88' : '#ff3344'],
                  ['Avg Win',      `+${fmt(stats.avgWin)}$`,  '#00cc6a'],
                  ['Avg Loss',     `-${fmt(stats.avgLoss)}$`, '#ff3344'],
                  ['Max Drawdown', `${fmt(stats.maxDrawdown)}$`, '#f59e0b'],
                  ['Total trades', stats.total, '#8899bb'],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ padding: '10px 12px', background: 'rgba(136,153,187,0.04)', borderRadius: '6px', border: '1px solid rgba(136,153,187,0.08)' }}>
                    <div style={{ fontSize: '10px', color: '#5a6a82', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
