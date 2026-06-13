import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const SESSIONS = {
  Asia:   { start: 0,  end: 6,  color: '#6366f1' },
  London: { start: 7,  end: 11, color: '#f59e0b' },
  NY:     { start: 12, end: 20, color: '#00ff88' },
  Autres: { start: 21, end: 23, color: '#5a6a82' },
};
const DAYS_FR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const DAYS_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function getSession(entered_at) {
  if (!entered_at) return 'Autres';
  const h = new Date(entered_at).getHours();
  for (const [name, { start, end }] of Object.entries(SESSIONS)) {
    if (h >= start && h <= end) return name;
  }
  return 'Autres';
}

function groupBy(trades, keyFn) {
  const map = {};
  for (const t of trades) {
    const key = keyFn(t);
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return map;
}

function computeStats(trades) {
  const total = trades.length;
  if (total === 0) return null;
  const pnls = trades.map(t => t.result_net ?? t.result ?? 0);
  const pnl  = pnls.reduce((a, b) => a + b, 0);
  const wins  = pnls.filter(p => p > 0).length;
  const losses= pnls.filter(p => p < 0).length;
  const grossWin  = pnls.filter(p => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0));
  const winrate = (wins / total) * 100;
  const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const avgPnl = pnl / total;
  return { total, wins, losses, pnl, winrate, pf, avgPnl, grossWin, grossLoss };
}

function WRBar({ wr, size = 6 }) {
  const color = wr >= 60 ? '#00ff88' : wr >= 45 ? '#f59e0b' : '#ff3344';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: `${size}px`, background: 'rgba(136,153,187,0.10)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${wr}%`, height: '100%', background: color, borderRadius: '3px', boxShadow: `0 0 6px ${color}60`, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: '700', color, minWidth: '38px', textAlign: 'right' }}>{wr.toFixed(0)}%</span>
    </div>
  );
}

function PatternRow({ rank, label, sub, stats, highlight }) {
  const pnlColor = stats.pnl >= 0 ? '#00ff88' : '#ff3344';
  const wrColor  = stats.winrate >= 60 ? '#00ff88' : stats.winrate >= 45 ? '#f59e0b' : '#ff3344';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 90px 80px 70px', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '6px', marginBottom: '4px', background: highlight ? 'rgba(0,255,136,0.05)' : 'rgba(14,15,22,0.5)', border: `1px solid ${highlight ? 'rgba(0,255,136,0.18)' : 'rgba(136,153,187,0.08)'}` }}>
      <span style={{ fontSize: '11px', color: '#3a4a5a', textAlign: 'center' }}>#{rank}</span>
      <div>
        <div style={{ fontSize: '13px', color: '#e8edf8', fontWeight: '600' }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: '#5a6a82' }}>{sub}</div>}
      </div>
      <span style={{ fontSize: '12px', color: '#8899bb', textAlign: 'center' }}>{stats.total} trades</span>
      <WRBar wr={stats.winrate} />
      <span style={{ fontSize: '13px', fontWeight: '700', color: pnlColor, textAlign: 'right' }}>
        {stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(0)}$
      </span>
      <span style={{ fontSize: '12px', color: stats.pf >= 1.5 ? '#00ff88' : stats.pf >= 1 ? '#f59e0b' : '#ff3344', textAlign: 'right' }}>
        PF {stats.pf.toFixed(2)}
      </span>
    </div>
  );
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background: 'rgba(8,9,16,0.97)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontFamily: 'inherit' }}>
      <div style={{ color: '#8899bb', marginBottom: '3px' }}>{label}</div>
      <div style={{ color: v >= 50 ? '#00ff88' : v >= 40 ? '#f59e0b' : '#ff3344', fontWeight: '700' }}>{v.toFixed(1)}% winrate</div>
      {payload[1] && <div style={{ color: payload[1].value >= 0 ? '#00ff88' : '#ff3344', fontWeight: '700' }}>{payload[1].value >= 0 ? '+' : ''}{payload[1].value.toFixed(0)}$ PnL</div>}
    </div>
  );
}

export default function PatternRecognition() {
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('pairs'); // 'pairs'|'sessions'|'days'|'combos'
  const [minTrades, setMinTrades] = useState(3);

  useEffect(() => {
    (async () => {
      const res = await window.db.getAllTrades();
      if (res.ok) setTrades((res.data ?? []).filter(t => (t.result_net ?? t.result) != null));
      setLoading(false);
    })();
  }, []);

  // ── Groupings ────────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!trades.length) return null;

    function topN(grouped, n, ascending = false) {
      return Object.entries(grouped)
        .map(([key, ts]) => ({ key, stats: computeStats(ts) }))
        .filter(e => e.stats && e.stats.total >= minTrades)
        .sort((a, b) => ascending
          ? a.stats.winrate - b.stats.winrate
          : b.stats.winrate - a.stats.winrate)
        .slice(0, n);
    }

    const byPair    = groupBy(trades, t => t.pair);
    const byDir     = groupBy(trades, t => t.direction);
    const bySession = groupBy(trades, t => getSession(t.entered_at));
    const byDow     = groupBy(trades, t => {
      const ts = t.entered_at || (t.date ? t.date + 'T12:00:00' : null);
      return ts ? new Date(ts).getDay() : -1;
    });
    const byComboPairDir = groupBy(trades, t => `${t.pair}·${t.direction}`);
    const byComboPairSess= groupBy(trades, t => `${t.pair}·${getSession(t.entered_at)}`);

    // Chart data
    const pairChart = Object.entries(byPair)
      .map(([k, ts]) => ({ name: k, ...computeStats(ts) }))
      .filter(e => e.total >= minTrades)
      .sort((a, b) => b.winrate - a.winrate);

    const sessionChart = Object.entries(bySession)
      .map(([k, ts]) => ({ name: k, ...computeStats(ts) }))
      .filter(e => e.total >= minTrades)
      .sort((a, b) => b.winrate - a.winrate);

    const dowChart = [1,2,3,4,5,6,0]
      .map(d => {
        const ts = byDow[d] ?? [];
        const s  = computeStats(ts);
        return s ? { name: DAYS_FR[d], fullName: DAYS_FULL[d], dow: d, ...s } : { name: DAYS_FR[d], total: 0, winrate: 0, pnl: 0 };
      })
      .filter(e => e.total >= 1);

    const dirStats = Object.fromEntries(
      Object.entries(byDir).map(([k, ts]) => [k, computeStats(ts)]).filter(([,s]) => s)
    );

    const topCombos = [...Object.entries(byComboPairDir), ...Object.entries(byComboPairSess)]
      .map(([key, ts]) => ({ key, stats: computeStats(ts) }))
      .filter(e => e.stats && e.stats.total >= minTrades)
      .sort((a, b) => b.stats.winrate - a.stats.winrate);

    // Best/worst
    const bestPair  = topN(byPair, 1)[0];
    const bestSess  = topN(bySession, 1)[0];
    const worstPair = topN(byPair, 1, true)[0];
    const worstSess = topN(bySession, 1, true)[0];

    return { byPair, bySession, byDow, pairChart, sessionChart, dowChart, dirStats, topCombos, bestPair, bestSess, worstPair, worstSess };
  }, [trades, minTrades]);

  if (loading) return <div style={{ padding: '40px', color: '#5a6a82', textAlign: 'center' }}>Chargement...</div>;
  if (!trades.length) return (
    <div style={{ padding: '60px', textAlign: 'center', color: '#5a6a82' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
      Aucun trade avec P&L enregistré pour l'analyse.
    </div>
  );

  const { pairChart, sessionChart, dowChart, dirStats, topCombos, bestPair, bestSess, worstPair, worstSess } = analysis;

  return (
    <div style={{ padding: '24px', color: '#dde4ef', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '4px' }}>PATTERN RECOGNITION</div>
        <div style={{ fontSize: '12px', color: '#5a6a82' }}>{trades.length} trades analysés — détection automatique de tes setups gagnants et perdants</div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Meilleure paire',   value: bestPair?.key  ?? '—', sub: bestPair  ? `${bestPair.stats.winrate.toFixed(0)}% WR · ${bestPair.stats.total} trades`  : '', color: '#00ff88' },
          { label: 'Meilleure session', value: bestSess?.key  ?? '—', sub: bestSess  ? `${bestSess.stats.winrate.toFixed(0)}% WR · ${bestSess.stats.total} trades`  : '', color: '#7c3aed' },
          { label: 'Paire difficile',   value: worstPair?.key ?? '—', sub: worstPair ? `${worstPair.stats.winrate.toFixed(0)}% WR · ${worstPair.stats.total} trades` : '', color: '#ff3344' },
          { label: 'Session difficile', value: worstSess?.key ?? '—', sub: worstSess ? `${worstSess.stats.winrate.toFixed(0)}% WR · ${worstSess.stats.total} trades` : '', color: '#f59e0b' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ padding: '14px 16px', background: 'rgba(14,15,22,0.8)', border: `1px solid ${color}22`, borderRadius: '10px', boxShadow: `0 0 16px ${color}0a` }}>
            <div style={{ fontSize: '10px', color: '#5a6a82', letterSpacing: '1.5px', marginBottom: '5px' }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#5a6a82', marginTop: '3px' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Direction comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {['LONG','SHORT'].map(dir => {
          const s = dirStats[dir];
          if (!s) return null;
          const color = dir === 'LONG' ? '#00ff88' : '#ff3344';
          return (
            <div key={dir} style={{ padding: '14px 16px', background: 'rgba(14,15,22,0.8)', border: `1px solid ${color}22`, borderRadius: '10px', display: 'flex', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#5a6a82', marginBottom: '2px' }}>{dir === 'LONG' ? '▲ LONG' : '▼ SHORT'}</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color }}>{s.winrate.toFixed(0)}%</div>
                <div style={{ fontSize: '11px', color: '#5a6a82' }}>winrate</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[['Trades', s.total], ['PnL total', `${s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(0)}$`], ['Avg PnL', `${s.avgPnl >= 0 ? '+' : ''}${s.avgPnl.toFixed(0)}$`], ['PF', s.pf.toFixed(2)]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: '10px', color: '#5a6a82' }}>{l}</div>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#dde4ef' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', alignItems: 'center' }}>
        {[['pairs','Par Paire'],['sessions','Par Session'],['days','Par Jour'],['combos','Combos']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '7px 16px', borderRadius: '6px', fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer', fontWeight: tab === k ? '700' : '400', transition: 'all 0.15s',
              background: tab === k ? 'rgba(0,255,136,0.10)' : 'rgba(136,153,187,0.06)',
              border: `1px solid ${tab === k ? 'rgba(0,255,136,0.35)' : 'rgba(136,153,187,0.15)'}`,
              color: tab === k ? '#00ff88' : '#5a6a82',
            }}>
            {l}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5a6a82' }}>
          Min. trades:
          {[2,3,5,10].map(n => (
            <button key={n} onClick={() => setMinTrades(n)}
              style={{ padding: '3px 9px', borderRadius: '4px', fontFamily: 'inherit', fontSize: '11px', cursor: 'pointer',
                background: minTrades === n ? 'rgba(136,153,187,0.15)' : 'transparent',
                border: `1px solid ${minTrades === n ? 'rgba(136,153,187,0.35)' : 'rgba(136,153,187,0.15)'}`,
                color: minTrades === n ? '#dde4ef' : '#5a6a82',
              }}>
              {n}+
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* Chart */}
        <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#5a6a82', letterSpacing: '1.5px', marginBottom: '16px' }}>
            {tab === 'pairs' ? 'WINRATE PAR PAIRE' : tab === 'sessions' ? 'WINRATE PAR SESSION' : tab === 'days' ? 'WINRATE PAR JOUR' : 'TOP COMBOS — WINRATE'}
          </div>

          {tab !== 'combos' ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={tab === 'pairs' ? pairChart : tab === 'sessions' ? sessionChart : dowChart} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <XAxis dataKey="name" tick={{ fill: '#5a6a82', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#5a6a82', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<MiniTooltip />} />
                <ReferenceLine y={50} stroke="rgba(136,153,187,0.2)" strokeDasharray="3 3" />
                <Bar dataKey="winrate" radius={[4,4,0,0]} maxBarSize={50}>
                  {(tab === 'pairs' ? pairChart : tab === 'sessions' ? sessionChart : dowChart).map((e, i) => (
                    <Cell key={i} fill={e.winrate >= 60 ? '#00ff88' : e.winrate >= 45 ? '#f59e0b' : '#ff3344'}
                      fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ fontSize: '12px', color: '#5a6a82', textAlign: 'center', padding: '30px 0' }}>
              Voir le tableau à droite pour les combos détaillés
            </div>
          )}
        </div>

        {/* Pattern table */}
        <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 90px 80px 70px', gap: '8px', padding: '0 12px 8px', borderBottom: '1px solid rgba(136,153,187,0.08)', marginBottom: '8px' }}>
            {['#','Setup','Trades','Winrate','PnL','PF'].map(h => (
              <span key={h} style={{ fontSize: '10px', color: '#3a4a5a', letterSpacing: '1.5px', textAlign: h === '#' ? 'center' : h === 'PnL' || h === 'PF' ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {tab === 'pairs' && pairChart.map((e, i) => (
            <PatternRow key={e.name} rank={i+1} label={e.name} sub={`${e.total} trades`} stats={e} highlight={e.winrate >= 60 && e.total >= 5} />
          ))}

          {tab === 'sessions' && sessionChart.map((e, i) => (
            <PatternRow key={e.name} rank={i+1} label={e.name} sub={`Session ${e.name}`} stats={e} highlight={e.winrate >= 60} />
          ))}

          {tab === 'days' && dowChart.filter(e => e.total >= minTrades).map((e, i) => (
            <PatternRow key={e.name} rank={i+1} label={e.fullName ?? e.name} sub={`${e.total} trades`} stats={e} highlight={e.winrate >= 60} />
          ))}

          {tab === 'combos' && topCombos.slice(0, 12).map((e, i) => {
            const parts = e.key.split('·');
            return <PatternRow key={e.key} rank={i+1} label={parts[0]} sub={parts[1]} stats={e.stats} highlight={e.stats.winrate >= 65 && e.stats.total >= minTrades} />;
          })}

          {/* Worst patterns */}
          {tab !== 'combos' && (
            <div style={{ marginTop: '16px', padding: '10px 12px', background: 'rgba(255,51,68,0.05)', border: '1px solid rgba(255,51,68,0.12)', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#ff3344', letterSpacing: '2px', marginBottom: '8px' }}>SETUPS À ÉVITER</div>
              {(tab === 'pairs' ? pairChart : tab === 'sessions' ? sessionChart : dowChart.filter(e => e.total >= minTrades))
                .filter(e => e.winrate < 45 && e.total >= minTrades)
                .sort((a, b) => a.winrate - b.winrate)
                .slice(0, 3)
                .map(e => (
                  <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#ff7788' }}>{e.fullName ?? e.name}</span>
                    <span style={{ color: '#ff3344', fontWeight: '700' }}>{e.winrate.toFixed(0)}% WR · {e.pnl.toFixed(0)}$</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
