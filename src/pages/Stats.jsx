import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────
function getNet(trade) {
  if (trade.result_net != null) return trade.result_net;
  if (trade.result     != null) return trade.result;
  return 0;
}
function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}
function fmtDur(sec) {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const DOW =['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ── CSV Parser ────────────────────────────────────────────────
function parseCsv(content) {
  const lines  = content.trim().split('\n');
  const header = lines[0].startsWith('\uFEFF') ? lines[0].slice(1) : lines[0];
  const keys   = header.split(',').map(k => k.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    keys.forEach((k, i) => { obj[k] = vals[i] ?? ''; });
    return obj;
  });
}

// ── Tooltip ───────────────────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', fontFamily: 'inherit' }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: (p.value ?? 0) >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, true) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#c8d8c8' }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.08)', borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '12px 14px' }}>
      <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '5px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: '#4a7a5a', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

// ── Import CSV Modal ──────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  async function processContent(content) {
    setStatus('loading');
    try {
      const rows = parseCsv(content);
      const res  = await window.db.importCsvTrades(rows);
      if (res.ok) { setResult(res.data); setStatus('done'); onImported(); }
      else { setStatus('error'); setResult({ error: res.error }); }
    } catch (e) { setStatus('error'); setResult({ error: e.message }); }
  }

  async function handleDialog() {
    const res = await window.electron.openCsvDialog();
    if (res.canceled) return;
    if (!res.ok) { setStatus('error'); setResult({ error: res.error }); return; }
    await processContent(res.content);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => await processContent(ev.target.result);
    reader.readAsText(file, 'utf-8');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', width: '100%', maxWidth: '480px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>TOPSTEPX</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>Import CSV</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
        {status === 'idle' && (
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            style={{ border: `2px dashed ${dragOver ? '#00ff88' : '#1a4a2a'}`, borderRadius: '8px', padding: '32px', textAlign: 'center', background: dragOver ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.4)', cursor: 'pointer', transition: 'all 0.2s' }}
            onClick={handleDialog}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
            <div style={{ fontSize: '12px', color: '#c8d8c8', marginBottom: '4px' }}>Glisse ton fichier CSV ici</div>
            <div style={{ fontSize: '10px', color: '#3a6a4a' }}>ou clique pour ouvrir</div>
          </div>
        )}
        {status === 'loading' && <div style={{ padding: '40px', textAlign: 'center', color: '#3a6a4a', fontSize: '12px', letterSpacing: '2px' }}>IMPORTATION...</div>}
        {status === 'done' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#00ff88', marginBottom: '16px' }}>Import réussi !</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
              {[['IMPORTÉS', result.imported, '#00ff88'], ['IGNORÉS', result.skipped, '#f0a020'], ['ERREURS', result.errors, '#ff4455']].map(([l,v,c]) => (
                <div key={l} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '5px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '4px' }}>{l}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', padding: '10px 24px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>FERMER</button>
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <div style={{ fontSize: '14px', color: '#ff4455', marginBottom: '12px' }}>Erreur d'import</div>
            <div style={{ fontSize: '11px', color: '#8aaa90', marginBottom: '20px' }}>{result?.error}</div>
            <button onClick={() => setStatus('idle')} style={{ background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '8px 16px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>RÉESSAYER</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────
function Calendar({ trades }) {
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const byDay = trades.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = { pnl: 0, count: 0 };
    acc[t.date].pnl   += getNet(t);
    acc[t.date].count += 1;
    return acc;
  }, {});

  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  // Monthly total
  const monthTotal = Object.entries(byDay)
    .filter(([d]) => d.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))
    .reduce((s, [, v]) => s + v.pnl, 0);

  // Weeks for week summary (column on right)
  function getWeekPnl(weekStart) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (byDay[key]) { total += byDay[key].pnl; count += byDay[key].count; }
    }
    return { total, count };
  }

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Build weeks with summaries
  const weeks = [];
  let week = [];
  cells.forEach((day, i) => {
    week.push(day);
    if (week.length === 7 || i === cells.length - 1) {
      while (week.length < 7) week.push(null);
      weeks.push([...week]);
      week = [];
    }
  });

  const cellStyle = (day) => {
    if (!day) return { background: 'transparent', border: '1px solid rgba(0,255,136,0.03)' };
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const data = byDay[key];
    const isToday = key === today;
    const pnl = data?.pnl ?? null;
    const bg = pnl == null ? 'rgba(10,28,18,0.3)'
      : pnl > 0  ? `rgba(0,255,136,${Math.min(0.05 + (pnl / 2000) * 0.2, 0.25)})`
      : pnl < 0  ? `rgba(255,68,85,${Math.min(0.05 + (Math.abs(pnl) / 2000) * 0.2, 0.25)})`
      : 'rgba(240,160,32,0.08)';
    return {
      background: bg,
      border: isToday ? '1.5px solid rgba(0,170,255,0.6)' : '1px solid rgba(0,255,136,0.05)',
    };
  };

  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '3px' }}>CALENDRIER</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#4a7a5a', cursor: 'pointer', fontSize: '14px' }}>‹</button>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8' }}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#4a7a5a', cursor: 'pointer', fontSize: '14px' }}>›</button>
            <button onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }}
              style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)', color: '#00ff88', padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontFamily: 'inherit', cursor: 'pointer' }}>Aujourd'hui</button>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '3px' }}>P&L MENSUEL</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: pnlColor(monthTotal) }}>{fmt(monthTotal, true)}</div>
        </div>
      </div>

      {/* Grid with week summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr) 90px', gap: '2px' }}>
        {/* DOW headers */}
        {['D','L','Ma','Me','J','V','S'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: '#3a6a4a', padding: '4px 0', letterSpacing: '1px' }}>{d}</div>
        ))}
        <div style={{ textAlign: 'center', fontSize: '9px', color: '#3a6a4a', padding: '4px 0' }}>SEMAINE</div>

        {/* Weeks */}
        {weeks.map((week, wi) => {
          const firstNonNull = week.find(d => d != null);
          const weekStartDate = firstNonNull
            ? new Date(year, month, firstNonNull - week.indexOf(firstNonNull))
            : null;
          const weekData = weekStartDate ? getWeekPnl(weekStartDate) : { total: 0, count: 0 };

          return [
            ...week.map((day, di) => {
              if (!day) return <div key={`e-${wi}-${di}`} style={{ ...cellStyle(null), minHeight: '52px', borderRadius: '3px' }} />;
              const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const data = byDay[key];
              const isToday = key === today;
              const style = cellStyle(day);
              return (
                <div key={key} style={{ ...style, minHeight: '52px', borderRadius: '3px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '9px', color: isToday ? '#00aaff' : '#4a7a5a', fontWeight: isToday ? '700' : '400', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{day}</span>
                    {isToday && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00aaff' }} />}
                  </div>
                  {data && (
                    <>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: pnlColor(data.pnl), lineHeight: 1 }}>
                        {fmt(data.pnl, true)}
                      </div>
                      <div style={{ fontSize: '8px', color: '#3a6a4a' }}>{data.count} trade{data.count > 1 ? 's' : ''}</div>
                    </>
                  )}
                </div>
              );
            }),
            // Week summary
            <div key={`week-${wi}`} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '3px', minHeight: '52px', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px' }}>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '0.5px' }}>S{wi+1}</div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: pnlColor(weekData.total) }}>{weekData.total !== 0 ? fmt(weekData.total, true) : '$0.00'}</div>
              <div style={{ fontSize: '8px', color: '#3a6a4a' }}>{weekData.count} trade{weekData.count > 1 ? 's' : ''}</div>
            </div>
          ];
        })}
      </div>
    </div>
  );
}

// ── MAIN STATS PAGE ───────────────────────────────────────────
export default function Stats() {
  const [trades, setTrades]     = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [period, setPeriod]     = useState('ALL');
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, tRes] = await Promise.all([window.db.getStats(), window.db.getAllTrades()]);
    if (sRes.ok) setStats(sRes.data);
    if (tRes.ok) setTrades(tRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>CALCUL EN COURS...</div>
  );

  const s = stats ?? {};

  // Filter by period
  const now = new Date();
  const filtered = trades.filter(t => {
    if (period === 'ALL')   return true;
    const d = new Date(t.date);
    if (period === 'TODAY') return t.date === now.toISOString().slice(0,10);
    if (period === '7D')    return (now - d) <= 7  * 86400000;
    if (period === '30D')   return (now - d) <= 30 * 86400000;
    return true;
  });

  // Stats on filtered
  const fTotal   = filtered.length;
  const fPnl     = filtered.reduce((s, t) => s + getNet(t), 0);
  const fWins    = filtered.filter(t => getNet(t) > 0).length;
  const fLosses  = filtered.filter(t => getNet(t) < 0).length;
  const fBe      = filtered.filter(t => getNet(t) === 0).length;
  const fGrossW  = filtered.filter(t => getNet(t) > 0).reduce((s,t) => s + getNet(t), 0);
  const fGrossL  = filtered.filter(t => getNet(t) < 0).reduce((s,t) => s + Math.abs(getNet(t)), 0);
  const fWR      = fTotal > 0 ? (fWins / fTotal) * 100 : 0;
  const fPF      = fGrossL > 0 ? fGrossW / fGrossL : fGrossW > 0 ? 999 : 0;
  const fAvgW    = fWins   > 0 ? fGrossW / fWins   : 0;
  const fAvgL    = fLosses > 0 ? fGrossL / fLosses : 0;
  const fFees    = filtered.reduce((s,t) => s + (t.fees ?? 0) + (t.commissions ?? 0), 0);

  // Equity curve (net)
  const sortedTrades = [...filtered].sort((a,b) => (a.entered_at||a.date).localeCompare(b.entered_at||b.date));
  let cum = 0;
  const equityData = [{ label: 'Départ', pnl: 0 }];
  sortedTrades.forEach((t, i) => { cum += getNet(t); equityData.push({ label: `#${i+1}`, pnl: Math.round(cum * 100) / 100 }); });

  // Daily P&L (net)
  const byDay = filtered.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = 0;
    acc[t.date] += getNet(t);
    return acc;
  }, {});
  const dailyArr = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  // Best/worst trade (net)
  const bestTrade  = filtered.reduce((a, b) => (getNet(b) > getNet(a ?? {})) ? b : a, null);
  const worstTrade = filtered.reduce((a, b) => (getNet(b) < getNet(a ?? {})) ? b : a, null);

  // By pair (net)
  const byPair = filtered.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = { total: 0, wins: 0, pnl: 0 };
    acc[t.pair].total++;
    if (getNet(t) > 0) acc[t.pair].wins++;
    acc[t.pair].pnl += getNet(t);
    return acc;
  }, {});
  const pairArr = Object.entries(byPair).sort(([,a],[,b]) => b.total - a.total)
    .map(([pair, d]) => ({ pair, ...d, wr: Math.round(d.wins / d.total * 100) }));

  // By direction (net)
  const byDir = filtered.reduce((acc, t) => {
    const dir = t.direction ?? 'LONG';
    if (!acc[dir]) acc[dir] = { total: 0, wins: 0 };
    acc[dir].total++;
    if (getNet(t) > 0) acc[dir].wins++;
    return acc;
  }, {});
  const dirPie = Object.entries(byDir).map(([d, v]) => ({ name: d, value: v.total, color: d === 'LONG' ? '#00ff88' : '#ff4455' }));

  // By DOW (net)
  const dowArr = DOW.map((label, i) => {
    const data = (s.byDow ?? []).find(d => parseInt(d.dow) === i) ?? { cnt: 0, pnl: 0 };
    return { label, count: Number(data.cnt ?? 0), pnl: Math.round(Number(data.pnl ?? 0) * 100) / 100 };
  });

  // Duration analysis (computed from entered_at / exited_at timestamps)
  const withDur = filtered.filter(t => t.entered_at && t.exited_at);
  const _avgDur = arr => arr.length > 0 ? arr.reduce((s, t) => s + (new Date(t.exited_at) - new Date(t.entered_at)) / 1000, 0) / arr.length : 0;
  const avgDurSec     = _avgDur(withDur);
  const avgDurWinSec  = _avgDur(withDur.filter(t => getNet(t) > 0));
  const avgDurLossSec = _avgDur(withDur.filter(t => getNet(t) < 0));

  // Size analysis
  const withSize    = filtered.filter(t => t.size && t.size > 0);
  const _avgSize = arr => arr.length > 0 ? arr.reduce((s, t) => s + t.size, 0) / arr.length : 0;
  const avgSize     = _avgSize(withSize);
  const avgSizeWin  = _avgSize(withSize.filter(t => getNet(t) > 0));
  const avgSizeLoss = _avgSize(withSize.filter(t => getNet(t) < 0));

  // By hour of entry
  const byHourMap = {};
  filtered.forEach(t => {
    if (!t.entered_at) return;
    const h = new Date(t.entered_at).getHours();
    if (!byHourMap[h]) byHourMap[h] = { cnt: 0, pnl: 0, wins: 0 };
    byHourMap[h].cnt++;
    byHourMap[h].pnl += getNet(t);
    if (getNet(t) > 0) byHourMap[h].wins++;
  });
  const byHourArr = Object.entries(byHourMap)
    .sort(([a], [b]) => +a - +b)
    .map(([h, d]) => ({ label: `${h}h`, pnl: Math.round(d.pnl * 100) / 100, cnt: d.cnt, wr: Math.round(d.wins / d.cnt * 100) }));

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ANALYSE</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Statistiques & Performance</h1>
          <div style={{ fontSize: '11px', color: '#3a6a4a', marginTop: '4px' }}>
            {fTotal} trade{fTotal > 1 ? 's' : ''} · P&L net: <span style={{ color: pnlColor(fPnl), fontWeight: '700' }}>{fmt(fPnl, true)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setShowImport(true)} style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '7px 13px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>
            📥 Import CSV TopstepX
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['TODAY','7D','30D','ALL'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 10px', borderRadius: '4px', border: `1px solid ${period===p?'#00ff88':'#1a3a22'}`, background: period===p?'rgba(0,255,136,0.1)':'transparent', color: period===p?'#00ff88':'#3a6a4a', fontSize: '9px', fontFamily: 'inherit', cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatCard label="P&L NET" value={fmt(fPnl, true)} color={pnlColor(fPnl)} sub={`Frais: -${fFees.toFixed(2)}$`} />
        <StatCard label="WINRATE" value={`${fWR.toFixed(1)}%`} color={fWR >= 50 ? '#00ff88' : '#ff4455'} sub={`${fWins}W / ${fLosses}L / ${fBe}BE`} />
        <StatCard label="PROFIT FACTOR" value={fPF === 999 ? '∞' : fPF.toFixed(2)} color={fPF >= 1.5 ? '#00ff88' : fPF >= 1 ? '#f0a020' : '#ff4455'} />
        <StatCard label="AVG WIN NET" value={fmt(fAvgW, true)} color="#00ff88" sub={`Gross: ${fmt(fGrossW, true)}`} />
        <StatCard label="AVG LOSS NET" value={fmt(-fAvgL)} color="#ff4455" sub={`Gross: -${fGrossL.toFixed(2)}$`} />
        <StatCard label="RATIO W/L" value={fAvgL > 0 ? (fAvgW / fAvgL).toFixed(2) : '—'} color="#c8d8c8" sub="Avg Win / Avg Loss" />
      </div>

      {/* Best/Worst */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'MEILLEUR TRADE (NET)', trade: bestTrade,  c: '#00ff88' },
          { label: 'PIRE TRADE (NET)',     trade: worstTrade, c: '#ff4455' },
        ].map(({ label, trade, c }) => (
          <div key={label} style={{ background: 'rgba(10,28,18,0.4)', border: `1px solid ${c}20`, borderLeft: `3px solid ${c}`, borderRadius: '6px', padding: '12px 16px' }}>
            <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '8px' }}>{label}</div>
            {trade ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#c8d8c8' }}>{trade.pair}</span>
                  <span style={{ fontSize: '9px', color: trade.direction==='LONG'?'#00ff88':'#ff4455', marginLeft: '8px', background: `rgba(${trade.direction==='LONG'?'0,255,136':'255,68,85'},0.1)`, padding: '1px 5px', borderRadius: '3px' }}>{trade.direction}</span>
                  <div style={{ fontSize: '9px', color: '#3a6a4a', marginTop: '3px' }}>{trade.date}{trade.entered_at ? ` · ${new Date(trade.entered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: c }}>{fmt(getNet(trade), true)}</div>
              </div>
            ) : <div style={{ color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        {/* Equity curve */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L CUMULÉ NET</div>
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs>
                  <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={fPnl >= 0 ? '#00ff88' : '#ff4455'} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={fPnl >= 0 ? '#00ff88' : '#ff4455'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Area type="monotone" dataKey="pnl" name="P&L net" stroke={fPnl >= 0 ? '#00ff88' : '#ff4455'} strokeWidth={2} fill="url(#eqG)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>

        {/* Daily bars */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR JOUR</div>
          {dailyArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart barCategoryGap="35%" data={dailyArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" name="P&L net" maxBarSize={28} radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>
      </div>

      {/* ── CHARTS ROW 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        {/* By pair */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>PERFORMANCE PAR INSTRUMENT (NET)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pairArr.slice(0, 6).map(p => (
              <div key={p.pair}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600' }}>{p.pair}</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '10px', color: pnlColor(p.pnl), fontWeight: '700' }}>{fmt(p.pnl, true)}</span>
                    <span style={{ fontSize: '10px', color: p.wr >= 50 ? '#00ff88' : '#ff4455' }}>{p.wr}% WR</span>
                    <span style={{ fontSize: '9px', color: '#3a6a4a' }}>{p.total}T</span>
                  </div>
                </div>
                <div style={{ height: '4px', background: 'rgba(0,255,136,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.wr}%`, background: p.pnl >= 0 ? '#00ff88' : '#ff4455', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
            {pairArr.length === 0 && <div style={{ color: '#2a4a30', fontSize: '10px', textAlign: 'center', padding: '20px 0' }}>Aucune donnée</div>}
          </div>
        </div>

        {/* Direction + DOW */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Direction */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px', flex: 1 }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>DIRECTION</div>
            {dirPie.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <PieChart width={80} height={80}>
                  <Pie data={dirPie} cx={35} cy={35} innerRadius={22} outerRadius={36} dataKey="value" strokeWidth={0}>
                    {dirPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dirPie.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }} />
                      <span style={{ fontSize: '11px', color: '#8aaa90' }}>{d.name}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: d.color }}>{d.value}</span>
                      <span style={{ fontSize: '9px', color: '#3a6a4a' }}>{fTotal > 0 ? Math.round(d.value/fTotal*100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div style={{ color: '#2a4a30', fontSize: '10px' }}>Aucune donnée</div>}
          </div>

          {/* DOW */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px', flex: 1 }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>P&L NET PAR JOUR DE LA SEMAINE</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart barCategoryGap="35%" data={dowArr.filter(d => d.count > 0)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" name="P&L net" maxBarSize={28} radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 3: ANALYSE PAR HEURE & DURÉE/TAILLE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

        {/* P&L par heure d'entrée */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>P&L NET PAR HEURE D'ENTRÉE</div>
          {byHourArr.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart barCategoryGap="30%" data={byHourArr} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', fontFamily: 'inherit' }}>
                      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{d?.label}</div>
                      <div style={{ color: (d?.pnl ?? 0) >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>P&L: {fmt(d?.pnl ?? 0, true)}</div>
                      <div style={{ color: '#8aaa90', marginTop: '2px' }}>{d?.cnt} trade{d?.cnt > 1 ? 's' : ''} · {d?.wr}% WR</div>
                    </div>
                  );
                }} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" maxBarSize={30} radius={[3,3,0,0]} isAnimationActive>
                  {byHourArr.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? '#00ff88' : '#ff4455'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucune donnée horaire disponible</div>}
        </div>

        {/* Durée + Taille */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Durée */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '14px 16px', flex: 1 }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>DURÉE DES POSITIONS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
              {[
                { label: 'MOYENNE', sec: avgDurSec, color: '#c8d8c8' },
                { label: 'WIN AVG', sec: avgDurWinSec, color: '#00ff88' },
                { label: 'LOSS AVG', sec: avgDurLossSec, color: '#ff4455' },
              ].map(({ label, sec, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color }}>{fmtDur(sec)}</div>
                </div>
              ))}
            </div>
            {withDur.length === 0 && (
              <div style={{ fontSize: '9px', color: '#2a4a30', textAlign: 'center', marginTop: '8px' }}>Disponible avec les imports CSV</div>
            )}
          </div>

          {/* Taille */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '14px 16px', flex: 1 }}>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>TAILLE DES POSITIONS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
              {[
                { label: 'MOYENNE', val: avgSize, color: '#c8d8c8' },
                { label: 'WIN AVG', val: avgSizeWin, color: '#00ff88' },
                { label: 'LOSS AVG', val: avgSizeLoss, color: '#ff4455' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color }}>{val > 0 ? val.toFixed(2) : '—'}</div>
                </div>
              ))}
            </div>
            {withSize.length === 0 && (
              <div style={{ fontSize: '9px', color: '#2a4a30', textAlign: 'center', marginTop: '8px' }}>Aucune donnée de taille disponible</div>
            )}
          </div>
        </div>
      </div>

      {/* ── CALENDAR ── */}
      <Calendar trades={trades} />

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={load} />}
    </div>
  );
}
