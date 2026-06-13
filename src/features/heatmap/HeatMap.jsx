import { useState, useEffect, useMemo } from 'react';

const DAYS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SESSIONS = [
  { label: 'Asia',   start: 0,  end: 6,  color: 'rgba(99,102,241,0.12)' },
  { label: 'London', start: 7,  end: 11, color: 'rgba(245,158,11,0.10)' },
  { label: 'NY',     start: 13, end: 20, color: 'rgba(0,255,136,0.08)'  },
];

function getSessionLabel(h) {
  if (h >= 0  && h < 7)  return 'Asia';
  if (h >= 7  && h < 12) return 'London';
  if (h >= 13 && h < 21) return 'NY';
  return null;
}

function pnlColor(pnl, maxAbs, trades) {
  if (!trades) return 'rgba(136,153,187,0.05)';
  const intensity = Math.min(1, Math.abs(pnl) / (maxAbs || 1));
  const base = Math.round(40 + intensity * 160);
  if (pnl > 0)  return `rgba(0,${base + 60},${Math.round(base * 0.5)},${0.15 + intensity * 0.55})`;
  if (pnl < 0)  return `rgba(${base + 60},${Math.round(base * 0.2)},${Math.round(base * 0.2)},${0.15 + intensity * 0.55})`;
  return 'rgba(136,153,187,0.12)';
}

function pnlBorder(pnl, maxAbs, trades) {
  if (!trades) return 'rgba(136,153,187,0.08)';
  const intensity = Math.min(1, Math.abs(pnl) / (maxAbs || 1));
  if (pnl > 0)  return `rgba(0,255,136,${0.15 + intensity * 0.45})`;
  if (pnl < 0)  return `rgba(255,51,68,${0.15 + intensity * 0.45})`;
  return 'rgba(136,153,187,0.20)';
}

function fmt(n, sign = false) {
  if (n == null) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}

// dow: 0=Sunday in JS → remap to 0=Monday
function jsDowToDisplay(jsDay) {
  return jsDay === 0 ? 6 : jsDay - 1; // Sun→6, Mon→0, ..., Sat→5
}

export default function HeatMap() {
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [hover,   setHover]   = useState(null); // { dow, hour }
  const [metric,  setMetric]  = useState('pnl'); // 'pnl' | 'winrate' | 'count'
  const [drill,   setDrill]   = useState(null);  // { dow, hour, trades }

  useEffect(() => {
    (async () => {
      const res = await window.db.getAllTrades();
      if (res.ok) setTrades(res.data ?? []);
      setLoading(false);
    })();
  }, []);

  // Build 7×24 grid
  const { grid, maxAbs, totalStats } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ trades: 0, pnl: 0, wins: 0 })));

    for (const t of trades) {
      const ts = t.entered_at || (t.date ? t.date + 'T12:00:00' : null);
      if (!ts) continue;
      const d   = new Date(ts);
      if (isNaN(d)) continue;
      const dow  = jsDowToDisplay(d.getDay());
      const hour = d.getHours();
      const pnl  = t.result_net ?? t.result ?? 0;
      g[dow][hour].trades++;
      g[dow][hour].pnl += pnl;
      if (pnl > 0) g[dow][hour].wins++;
    }

    let maxA = 0;
    for (const row of g) for (const cell of row) {
      if (Math.abs(cell.pnl) > maxA) maxA = Math.abs(cell.pnl);
    }

    const total   = trades.length;
    const wins    = trades.filter(t => (t.result_net ?? t.result ?? 0) > 0).length;
    const totalPnl= trades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);

    return { grid: g, maxAbs: maxA, totalStats: { total, wins, totalPnl } };
  }, [trades]);

  // Hover cell trades
  const hoverCell = hover ? grid[hover.dow]?.[hover.hour] : null;

  // Best / worst cells
  const { bestCell, worstCell } = useMemo(() => {
    let best = null, worst = null;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const c = grid[d][h];
      if (c.trades === 0) continue;
      if (!best  || c.pnl > best.pnl)   best  = { ...c, dow: d, hour: h };
      if (!worst || c.pnl < worst.pnl)  worst = { ...c, dow: d, hour: h };
    }
    return { bestCell: best, worstCell: worst };
  }, [grid]);

  function getCellValue(cell) {
    if (!cell || cell.trades === 0) return null;
    if (metric === 'pnl')     return cell.pnl;
    if (metric === 'winrate') return cell.wins / cell.trades * 100;
    return cell.trades;
  }

  function getCellColor(cell) {
    if (!cell || cell.trades === 0) return 'rgba(136,153,187,0.05)';
    if (metric === 'pnl')     return pnlColor(cell.pnl, maxAbs, cell.trades);
    if (metric === 'winrate') {
      const wr = cell.wins / cell.trades;
      return wr >= 0.5
        ? `rgba(0,255,136,${0.10 + wr * 0.50})`
        : `rgba(255,51,68,${0.10 + (1 - wr) * 0.50})`;
    }
    const norm = cell.trades / Math.max(...HOURS.map(h => Math.max(...DAYS.map((_, d) => grid[d][h].trades))), 1);
    return `rgba(124,58,237,${0.08 + norm * 0.55})`;
  }

  function getCellBorder(cell, dow, hour) {
    const isHover = hover?.dow === dow && hover?.hour === hour;
    if (isHover) return '1px solid rgba(255,255,255,0.4)';
    if (!cell || cell.trades === 0) return '1px solid rgba(136,153,187,0.06)';
    if (metric === 'pnl') return `1px solid ${pnlBorder(cell.pnl, maxAbs, cell.trades)}`;
    return '1px solid rgba(136,153,187,0.15)';
  }

  const CELL_W = 38, CELL_H = 34, LABEL_W = 40;

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#5a6a82', fontSize: '13px' }}>Chargement...</div>
  );

  if (trades.length === 0) return (
    <div style={{ padding: '60px', textAlign: 'center', color: '#5a6a82', fontSize: '14px' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
      Aucun trade enregistré pour afficher la Heat Map.
    </div>
  );

  return (
    <div style={{ padding: '24px', color: '#dde4ef', fontFamily: 'inherit', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '4px' }}>
          HEAT MAP DE PERFORMANCE
        </div>
        <div style={{ fontSize: '12px', color: '#5a6a82' }}>
          {trades.length} trades analysés — identifiez vos créneaux rentables
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total trades', value: totalStats.total, color: '#8899bb' },
          { label: 'Total PnL', value: fmt(totalStats.totalPnl, true), color: totalStats.totalPnl >= 0 ? '#00ff88' : '#ff3344' },
          { label: 'Meilleur créneau', value: bestCell  ? `${DAYS[bestCell.dow]}  ${String(bestCell.hour).padStart(2,'0')}h` : '—', color: '#00ff88' },
          { label: 'Pire créneau',    value: worstCell ? `${DAYS[worstCell.dow]} ${String(worstCell.hour).padStart(2,'0')}h` : '—', color: '#ff3344' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '14px 16px', background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '10px' }}>
            <div style={{ fontSize: '11px', color: '#5a6a82', letterSpacing: '1px', marginBottom: '5px' }}>{label.toUpperCase()}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
        {[
          { key: 'pnl',     label: 'PnL moyen',    color: '#00ff88' },
          { key: 'winrate', label: 'Winrate',       color: '#7c3aed' },
          { key: 'count',   label: 'Nb de trades',  color: '#f59e0b' },
        ].map(({ key, label, color }) => (
          <button key={key} onClick={() => setMetric(key)}
            style={{ padding: '7px 16px', borderRadius: '6px', fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer', fontWeight: metric === key ? '700' : '400', transition: 'all 0.15s',
              background: metric === key ? `${color}20` : 'rgba(136,153,187,0.06)',
              border: `1px solid ${metric === key ? color + '50' : 'rgba(136,153,187,0.15)'}`,
              color: metric === key ? color : '#5a6a82',
              boxShadow: metric === key ? `0 0 12px ${color}20` : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Session legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '12px' }}>
        {SESSIONS.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: s.color, border: '1px solid rgba(136,153,187,0.2)' }} />
            <span style={{ fontSize: '11px', color: '#5a6a82' }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#5a6a82' }}>Heure locale • Cliquez sur une cellule pour voir les trades</div>
      </div>

      {/* Grid container */}
      <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
        <div style={{ display: 'inline-block', minWidth: `${LABEL_W + 24 * CELL_W + 20}px` }}>

          {/* Hour labels */}
          <div style={{ display: 'flex', marginLeft: `${LABEL_W}px`, marginBottom: '4px' }}>
            {HOURS.map(h => {
              const sess = getSessionLabel(h);
              return (
                <div key={h} style={{ width: `${CELL_W}px`, textAlign: 'center', fontSize: '9px', color: sess ? (sess === 'NY' ? '#00ff88' : sess === 'London' ? '#f59e0b' : '#6366f1') : '#3a4a5a', fontWeight: sess ? '700' : '400' }}>
                  {h % 3 === 0 ? `${String(h).padStart(2,'0')}h` : ''}
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {DAYS.map((day, dow) => (
            <div key={day} style={{ display: 'flex', marginBottom: '3px', alignItems: 'center' }}>
              {/* Day label */}
              <div style={{ width: `${LABEL_W}px`, fontSize: '11px', color: '#5a6a82', flexShrink: 0, paddingRight: '6px', textAlign: 'right', fontWeight: dow < 5 ? '600' : '400' }}>
                {day}
              </div>

              {/* Cells */}
              {HOURS.map(hour => {
                const cell    = grid[dow][hour];
                const isHover = hover?.dow === dow && hover?.hour === hour;
                const sessColor = SESSIONS.find(s => hour >= s.start && hour <= s.end)?.color ?? 'transparent';
                const val     = getCellValue(cell);

                return (
                  <div
                    key={hour}
                    onClick={() => cell.trades > 0 && setDrill({ dow, hour, tradesList: trades.filter(t => {
                      const ts = t.entered_at || (t.date ? t.date + 'T12:00:00' : null);
                      if (!ts) return false;
                      const d = new Date(ts);
                      return jsDowToDisplay(d.getDay()) === dow && d.getHours() === hour;
                    })})}
                    onMouseEnter={() => setHover({ dow, hour })}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      width: `${CELL_W}px`, height: `${CELL_H}px`,
                      background: `${getCellColor(cell)}, ${sessColor}`,
                      border: getCellBorder(cell, dow, hour),
                      borderRadius: '4px', cursor: cell.trades > 0 ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: '2px',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      transform: isHover && cell.trades > 0 ? 'scale(1.06)' : 'scale(1)',
                      boxShadow: isHover && cell.trades > 0 ? '0 2px 12px rgba(0,0,0,0.5)' : 'none',
                      position: 'relative', zIndex: isHover ? 2 : 1,
                    }}
                    title={cell.trades > 0 ? `${DAYS[dow]} ${String(hour).padStart(2,'0')}h — ${cell.trades} trade${cell.trades > 1 ? 's' : ''} | PnL: ${fmt(cell.pnl, true)} | WR: ${Math.round(cell.wins / cell.trades * 100)}%` : ''}
                  >
                    {cell.trades > 0 && (
                      <span style={{ fontSize: '9px', color: val != null && val > 0 ? '#00ff88' : val != null && val < 0 ? '#ff7788' : '#8899bb', fontWeight: '700', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                        {metric === 'count'   ? cell.trades
                         : metric === 'winrate' ? `${Math.round(cell.wins / cell.trades * 100)}%`
                         : cell.pnl >= 0 ? '+' + Math.round(cell.pnl) : Math.round(cell.pnl)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Color legend */}
          <div style={{ marginTop: '16px', marginLeft: `${LABEL_W}px`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: '#3a4a5a' }}>
              {metric === 'pnl' ? 'Perte' : metric === 'winrate' ? 'Faible WR' : 'Peu de trades'}
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {metric === 'pnl' ? (
                ['rgba(220,40,40,0.6)','rgba(180,40,40,0.3)','rgba(136,153,187,0.1)','rgba(0,180,80,0.3)','rgba(0,255,136,0.6)'].map((c, i) => (
                  <div key={i} style={{ width: '24px', height: '12px', borderRadius: '2px', background: c }} />
                ))
              ) : metric === 'winrate' ? (
                ['rgba(255,51,68,0.5)','rgba(255,51,68,0.2)','rgba(136,153,187,0.1)','rgba(0,255,136,0.2)','rgba(0,255,136,0.5)'].map((c, i) => (
                  <div key={i} style={{ width: '24px', height: '12px', borderRadius: '2px', background: c }} />
                ))
              ) : (
                ['rgba(124,58,237,0.08)','rgba(124,58,237,0.2)','rgba(124,58,237,0.35)','rgba(124,58,237,0.5)','rgba(124,58,237,0.65)'].map((c, i) => (
                  <div key={i} style={{ width: '24px', height: '12px', borderRadius: '2px', background: c }} />
                ))
              )}
            </div>
            <span style={{ fontSize: '10px', color: '#3a4a5a' }}>
              {metric === 'pnl' ? 'Gain' : metric === 'winrate' ? 'WR élevé' : 'Beaucoup'}
            </span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hover && hoverCell && hoverCell.trades > 0 && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'rgba(10,11,20,0.95)', border: '1px solid rgba(136,153,187,0.25)', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', zIndex: 100, minWidth: '180px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#e8edf8', marginBottom: '8px' }}>
            {DAYS[hover.dow]} {String(hover.hour).padStart(2,'0')}h–{String(hover.hour + 1).padStart(2,'0')}h
            {getSessionLabel(hover.hour) && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#5a6a82' }}>({getSessionLabel(hover.hour)})</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              ['Trades', hoverCell.trades],
              ['Winrate', `${Math.round(hoverCell.wins / hoverCell.trades * 100)}%`],
              ['PnL total', fmt(hoverCell.pnl, true)],
              ['PnL moyen', fmt(hoverCell.pnl / hoverCell.trades, true)],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: '10px', color: '#5a6a82' }}>{l}</div>
                <div style={{ fontSize: '13px', color: l === 'PnL total' || l === 'PnL moyen'
                  ? hoverCell.pnl >= 0 ? '#00ff88' : '#ff3344' : '#dde4ef', fontWeight: '600' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      {drill && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDrill(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0c0d16', border: '1px solid rgba(136,153,187,0.25)', borderRadius: '12px', padding: '20px', maxWidth: '560px', width: '90%', maxHeight: '70vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8edf8' }}>
                {DAYS[drill.dow]} {String(drill.hour).padStart(2,'0')}h — {drill.tradesList.length} trade{drill.tradesList.length > 1 ? 's' : ''}
              </div>
              <button onClick={() => setDrill(null)} style={{ background: 'none', border: 'none', color: '#5a6a82', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            {drill.tradesList.map(t => {
              const pnl = t.result_net ?? t.result ?? 0;
              return (
                <div key={t.id} style={{ padding: '10px 12px', borderRadius: '6px', marginBottom: '6px', background: pnl >= 0 ? 'rgba(0,255,136,0.05)' : 'rgba(255,51,68,0.05)', border: `1px solid ${pnl >= 0 ? 'rgba(0,255,136,0.18)' : 'rgba(255,51,68,0.18)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#dde4ef', fontWeight: '600' }}>{t.pair}</span>
                    <span style={{ fontSize: '11px', color: '#5a6a82', marginLeft: '8px' }}>{t.direction}</span>
                    {t.entered_at && <span style={{ fontSize: '10px', color: '#3a4a5a', marginLeft: '8px' }}>{new Date(t.entered_at).toLocaleString('fr-FR')}</span>}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: pnl >= 0 ? '#00ff88' : '#ff3344' }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}$
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
