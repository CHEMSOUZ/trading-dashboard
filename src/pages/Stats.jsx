import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────
function fmt(n, sign = false, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(decimals)}$`;
}
function pct(n) { return n == null ? '—' : `${n.toFixed(2)}%`; }
function color(v) { return v > 0 ? '#00ff88' : v < 0 ? '#ff4455' : '#8aaa90'; }

const DOW_LABELS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// ── CSV Parser ────────────────────────────────────────────────
function parseCsv(content) {
  const lines  = content.trim().split('\n');
  const BOM    = '\uFEFF';
  const header = lines[0].startsWith(BOM) ? lines[0].slice(1) : lines[0];
  const keys   = header.split(',').map(k => k.trim().replace(/^"/, '').replace(/"$/, ''));
  const rows   = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"/, '').replace(/"$/, ''));
    const obj  = {};
    keys.forEach((k, idx) => { obj[k] = vals[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

// ── Small stat card ───────────────────────────────────────────
function StatCard({ label, value, sub, color: c = '#c8d8c8', border, wide = false }) {
  return (
    <div style={{
      background: 'rgba(10,28,18,0.5)',
      border: `1px solid ${border ?? 'rgba(0,255,136,0.08)'}`,
      borderTop: `2px solid ${c}`,
      borderRadius: '6px', padding: '14px 16px',
      gridColumn: wide ? 'span 2' : 'span 1',
    }}>
      <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: c, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: '#4a7a5a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}

// ── Gauge (semi-circle) ───────────────────────────────────────
function Gauge({ value, max = 100, color: c = '#00ff88', label, size = 100 }) {
  const pctVal  = Math.min(Math.max(value / max, 0), 1);
  const r       = size * 0.38;
  const cx      = size / 2;
  const cy      = size * 0.58;
  const start   = Math.PI;
  const end     = 2 * Math.PI;
  const angle   = start + pctVal * Math.PI;
  const x1s = cx + r * Math.cos(start); const y1s = cy + r * Math.sin(start);
  const x1e = cx + r * Math.cos(end);   const y1e = cy + r * Math.sin(end);
  const x2e = cx + r * Math.cos(angle); const y2e = cy + r * Math.sin(angle);
  const largeArc = pctVal > 0.5 ? 1 : 0;
  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <path d={`M ${x1s} ${y1s} A ${r} ${r} 0 1 1 ${x1e} ${y1e}`}
        fill="none" stroke="rgba(0,255,136,0.08)" strokeWidth="8" strokeLinecap="round" />
      {pctVal > 0 && (
        <path d={`M ${x1s} ${y1s} A ${r} ${r} 0 ${largeArc} 1 ${x2e} ${y2e}`}
          fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={c} fontSize="14" fontWeight="700" fontFamily="monospace">
        {label}
      </text>
    </svg>
  );
}

// ── Custom tooltip ────────────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', fontFamily: 'inherit' }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: (p.value ?? 0) >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
          {p.name}: {typeof p.value === 'number' ? `${(p.value ?? 0) >= 0 ? '+' : ''}${(p.value ?? 0).toFixed(0)}$` : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [status, setStatus]   = useState('idle'); // idle | loading | done | error
  const [result, setResult]   = useState(null);
  const [dragOver, setDragOver] = useState(false);

  async function processContent(content) {
    setStatus('loading');
    try {
      const rows    = parseCsv(content);
      const res     = await window.db.importCsvTrades(rows);
      if (res.ok) {
        setResult(res.data);
        setStatus('done');
        onImported();
      } else {
        setStatus('error');
        setResult({ error: res.error });
      }
    } catch (e) {
      setStatus('error');
      setResult({ error: e.message });
    }
  }

  async function handleFileDialog() {
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
    reader.onload = async (ev) => { await processContent(ev.target.result); };
    reader.readAsText(file, 'utf-8');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', width: '100%', maxWidth: '500px', padding: '28px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>TOPSTEPX</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>Import CSV</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        {status === 'idle' && (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? '#00ff88' : '#1a4a2a'}`,
                borderRadius: '8px', padding: '32px',
                textAlign: 'center', marginBottom: '16px',
                background: dragOver ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.4)',
                transition: 'all 0.2s ease', cursor: 'pointer',
              }}
              onClick={handleFileDialog}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <div style={{ fontSize: '12px', color: '#c8d8c8', marginBottom: '4px' }}>
                Glisse ton fichier CSV ici
              </div>
              <div style={{ fontSize: '10px', color: '#3a6a4a' }}>ou clique pour ouvrir</div>
            </div>

            <div style={{ fontSize: '10px', color: '#3a6a4a', lineHeight: '1.6' }}>
              <div style={{ marginBottom: '6px', color: '#4a7a5a' }}>Comment exporter depuis TopstepX :</div>
              <div>1. Ouvre le dashboard TopstepX</div>
              <div>2. Va dans la section "Trades"</div>
              <div>3. Clique sur "Export" → CSV</div>
              <div>4. Importe le fichier ici</div>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#3a6a4a', fontSize: '12px', letterSpacing: '2px' }}>
            IMPORTATION EN COURS...
          </div>
        )}

        {status === 'done' && result && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#00ff88', marginBottom: '16px' }}>Import réussi !</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { label: 'IMPORTÉS', value: result.imported, color: '#00ff88' },
                { label: 'IGNORÉS', value: result.skipped, color: '#f0a020' },
                { label: 'ERREURS', value: result.errors, color: result.errors > 0 ? '#ff4455' : '#3a6a4a' },
              ].map(({ label, value, color: c }) => (
                <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '5px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: c }}>{value}</div>
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', padding: '10px 24px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px' }}>
              FERMER
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
            <div style={{ fontSize: '14px', color: '#ff4455', marginBottom: '12px' }}>Erreur d'import</div>
            <div style={{ fontSize: '11px', color: '#8aaa90', marginBottom: '20px' }}>{result?.error}</div>
            <button onClick={() => setStatus('idle')} style={{ background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '8px 16px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
              RÉESSAYER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quick Trade Form ──────────────────────────────────────────
function QuickTradeModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ pair: 'MNQ', direction: 'LONG', entry: '', exit_price: '', size: '', result: '', outcome: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const PAIRS_QUICK = ['MNQ','NQ','MES','ES','MGC','GC','MCL','CL','M2K','RTY'];

  async function submit() {
    if (!form.entry || !form.result) return;
    setSaving(true);
    const pnl     = parseFloat(form.result) || 0;
    const outcome = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE';
    const payload = {
      date:       form.date,
      pair:       form.pair,
      direction:  form.direction,
      entry:      parseFloat(form.entry) || 0,
      exit_price: parseFloat(form.exit_price) || null,
      stop:       0, tp: 0,
      result:     pnl,
      result_net: pnl,
      size:       parseFloat(form.size) || null,
      outcome:    form.outcome || outcome,
      source:     'manual_quick',
    };
    await window.db.insertTrade(payload);
    setSaving(false);
    onAdded();
    onClose();
  }

  const s = key => e => setForm(p => ({ ...p, [key]: e.target.value }));
  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '4px', padding: '8px 10px', color: '#c8d8c8', fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', width: '100%', maxWidth: '480px', padding: '24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>SAISIE RAPIDE</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>Trade Express ⚡</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Row 1: Date, Pair, Direction */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>DATE</div>
              <input type="date" value={form.date} onChange={s('date')} style={{ ...inp, colorScheme: 'dark' }} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>INSTRUMENT</div>
              <select value={form.pair} onChange={s('pair')} style={inp}>
                {PAIRS_QUICK.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>DIRECTION</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['LONG','SHORT'].map(d => (
                  <button key={d} onClick={() => setForm(p => ({ ...p, direction: d }))} style={{
                    flex: 1, padding: '8px 4px', borderRadius: '4px',
                    border: `1px solid ${form.direction===d ? (d==='LONG'?'#00ff88':'#ff4455') : 'rgba(0,255,136,0.12)'}`,
                    background: form.direction===d ? `rgba(${d==='LONG'?'0,255,136':'255,68,85'},0.12)` : 'rgba(10,28,18,0.6)',
                    color: form.direction===d ? (d==='LONG'?'#00ff88':'#ff4455') : '#5a8a6a',
                    fontSize: '10px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer',
                  }}>{d}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Entry, Exit, Size */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>ENTRÉE *</div>
              <input type="number" placeholder="28900" value={form.entry} onChange={s('entry')} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>SORTIE</div>
              <input type="number" placeholder="28920" value={form.exit_price} onChange={s('exit_price')} style={inp} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>TAILLE</div>
              <input type="number" placeholder="10" value={form.size} onChange={s('size')} style={inp} />
            </div>
          </div>

          {/* Row 3: P&L + Outcome */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>P&L NET * ($)</div>
              <input type="number" placeholder="+500 ou -250" value={form.result} onChange={s('result')} style={{ ...inp, color: form.result ? (parseFloat(form.result) >= 0 ? '#00ff88' : '#ff4455') : '#c8d8c8' }} />
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '4px' }}>RÉSULTAT</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {['WIN','LOSS','BE'].map(o => {
                  const c = o==='WIN'?'#00ff88':o==='LOSS'?'#ff4455':'#f0a020';
                  return (
                    <button key={o} onClick={() => setForm(p => ({ ...p, outcome: o }))} style={{
                      flex: 1, padding: '8px 2px', borderRadius: '4px',
                      border: `1px solid ${form.outcome===o ? c : 'rgba(0,255,136,0.12)'}`,
                      background: form.outcome===o ? `rgba(${o==='WIN'?'0,255,136':o==='LOSS'?'255,68,85':'240,160,32'},0.12)` : 'rgba(10,28,18,0.6)',
                      color: form.outcome===o ? c : '#5a8a6a',
                      fontSize: '9px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer',
                    }}>{o}</button>
                  );
                })}
              </div>
            </div>
          </div>

          <button onClick={submit} disabled={saving} style={{
            padding: '12px', borderRadius: '5px',
            background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.1))',
            border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88',
            fontSize: '11px', fontFamily: 'inherit', fontWeight: '700',
            letterSpacing: '1.5px', cursor: saving ? 'wait' : 'pointer',
          }}>
            {saving ? 'ENREGISTREMENT...' : '⚡ ENREGISTRER'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Stats Page ───────────────────────────────────────────
export default function Stats() {
  const [stats, setStats]   = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('ALL');
  const [showImport, setShowImport] = useState(false);
  const [showQuick, setShowQuick]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, tRes] = await Promise.all([window.db.getStats(), window.db.getAllTrades()]);
    if (sRes.ok) setStats(sRes.data);
    if (tRes.ok) setTrades(tRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px' }}>
      CALCUL EN COURS...
    </div>
  );

  const s = stats ?? {};

  // Filter by period
  const now = new Date();
  const filtered = trades.filter(t => {
    if (period === 'ALL') return true;
    const d = new Date(t.date);
    if (period === 'TODAY') return t.date === new Date().toISOString().slice(0,10);
    if (period === '7D')    return (now - d) <= 7  * 86400000;
    if (period === '30D')   return (now - d) <= 30 * 86400000;
    return true;
  });

  // Equity curve
  const sortedTrades = [...filtered].sort((a,b) => (a.entered_at||a.date).localeCompare(b.entered_at||b.date));
  let cum = 0;
  const equityData = [{ label: 'Départ', pnl: 0 }];
  sortedTrades.forEach((t, i) => {
    cum += t.result ?? 0;
    equityData.push({ label: `#${i+1}`, pnl: Math.round(cum * 100) / 100 });
  });

  // Daily P&L
  const byDay = filtered.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = 0;
    acc[t.date] += t.result ?? 0;
    return acc;
  }, {});
  const dailyArr = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  // Filtered stats
  const fTotal   = filtered.length;
  const fWins    = filtered.filter(t => t.outcome === 'WIN').length;
  const fLosses  = filtered.filter(t => t.outcome === 'LOSS').length;
  const fBe      = filtered.filter(t => t.outcome === 'BE').length;
  const fPnl     = filtered.reduce((s, t) => s + (t.result ?? 0), 0);
  const fGrossW  = filtered.filter(t => (t.result??0) > 0).reduce((s,t) => s + t.result, 0);
  const fGrossL  = filtered.filter(t => (t.result??0) < 0).reduce((s,t) => s + Math.abs(t.result), 0);
  const fWR      = fTotal > 0 ? (fWins / fTotal) * 100 : 0;
  const fPF      = fGrossL > 0 ? fGrossW / fGrossL : fGrossW > 0 ? 999 : 0;
  const fAvgW    = fWins > 0 ? fGrossW / fWins : 0;
  const fAvgL    = fLosses > 0 ? fGrossL / fLosses : 0;
  const fFees    = filtered.reduce((s,t) => s + (t.fees??0) + (t.commissions??0), 0);
  const fBestDay = Math.max(...Object.values(byDay).filter(p => p > 0), 0);
  const bestDayPct = fGrossW > 0 ? (fBestDay / fGrossW) * 100 : 0;

  // Best/worst trade
  const bestTrade  = filtered.reduce((a, b) => ((b.result??-Infinity) > (a?.result??-Infinity)) ? b : a, null);
  const worstTrade = filtered.reduce((a, b) => ((b.result??Infinity)  < (a?.result??Infinity))  ? b : a, null);

  // By pair
  const byPair = filtered.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = { total: 0, wins: 0, pnl: 0 };
    acc[t.pair].total++;
    if (t.outcome === 'WIN') acc[t.pair].wins++;
    acc[t.pair].pnl += t.result ?? 0;
    return acc;
  }, {});
  const pairArr = Object.entries(byPair).sort(([,a],[,b]) => b.total - a.total)
    .map(([pair, d]) => ({ pair, ...d, wr: Math.round(d.wins/d.total*100) }));

  // By direction
  const byDir = filtered.reduce((acc, t) => {
    const dir = t.direction ?? 'LONG';
    if (!acc[dir]) acc[dir] = { total: 0, wins: 0 };
    acc[dir].total++;
    if (t.outcome === 'WIN') acc[dir].wins++;
    return acc;
  }, {});
  const dirPie = Object.entries(byDir).map(([d, v]) => ({ name: d, value: v.total, color: d === 'LONG' ? '#00ff88' : '#ff4455' }));

  // By DOW
  const dowArr = DOW_LABELS.map((label, i) => {
    const data = (s.byDow ?? []).find(d => parseInt(d.dow) === i) ?? { cnt: 0, pnl: 0, wins: 0 };
    return { label, count: Number(data.cnt ?? 0), pnl: Math.round(Number(data.pnl ?? 0) * 100) / 100, wins: Number(data.wins ?? 0) };
  });

  const mostActiveDay  = dowArr.reduce((a, b) => b.count > a.count ? b : a, dowArr[0]);
  const mostProfDay    = dowArr.reduce((a, b) => b.pnl > a.pnl ? b : a, dowArr[0]);
  const leastProfDay   = dowArr.reduce((a, b) => b.pnl < a.pnl ? b : a, dowArr[0]);

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>ANALYSE</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Statistiques & Performance</h1>
          <div style={{ fontSize: '11px', color: '#3a6a4a', marginTop: '4px' }}>
            {filtered.length} trade{filtered.length > 1 ? 's' : ''} ·{' '}
            <span style={{ color: fPnl >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
              {fPnl >= 0 ? '+' : ''}{fPnl.toFixed(2)}$
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Import CSV */}
          <button onClick={() => setShowImport(true)} style={{
            background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)',
            color: '#00ff88', padding: '8px 14px', borderRadius: '5px',
            fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,136,0.08)'}
          >
            📥 Import CSV TopstepX
          </button>
          {/* Quick trade */}
          <button onClick={() => setShowQuick(true)} style={{
            background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.35)',
            color: '#00ff88', padding: '8px 14px', borderRadius: '5px',
            fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(0,255,136,0.2)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            ⚡ Trade Express
          </button>

          {/* Period filter */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {['TODAY','7D','30D','ALL'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '7px 12px', borderRadius: '4px',
                border: `1px solid ${period === p ? '#00ff88' : '#1a3a22'}`,
                background: period === p ? 'rgba(0,255,136,0.1)' : 'transparent',
                color: period === p ? '#00ff88' : '#3a6a4a',
                fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer',
              }}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TOP KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '20px' }}>
        <StatCard label="TOTAL P&L" value={fmt(fPnl, true)} color={fPnl >= 0 ? '#00ff88' : '#ff4455'} sub={`Net: ${fmt(fPnl - fFees, true)}`} />
        <StatCard label="TRADE WIN %" value={`${fWR.toFixed(1)}%`} color={fWR >= 50 ? '#00ff88' : '#ff4455'} sub={`${fWins}W / ${fLosses}L / ${fBe}BE`} />
        <StatCard label="PROFIT FACTOR" value={fPF === 999 ? '∞' : fPF.toFixed(2)} color={fPF >= 1.5 ? '#00ff88' : fPF >= 1 ? '#f0a020' : '#ff4455'} />
        <StatCard label="AVG WIN" value={fmt(fAvgW)} color="#00ff88" sub={`Gross: +${fGrossW.toFixed(0)}$`} />
        <StatCard label="AVG LOSS" value={fmt(-fAvgL)} color="#ff4455" sub={`Gross: -${fGrossL.toFixed(0)}$`} />
        <StatCard label="FRAIS TOTAUX" value={fmt(-fFees)} color="#f0a020" sub={`${fTotal} trades`} />
      </div>

      {/* ── GAUGES ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
        {/* WR Gauge */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>WINRATE</div>
          <Gauge value={fWR} max={100} color={fWR >= 50 ? '#00ff88' : '#ff4455'} label={`${fWR.toFixed(0)}%`} size={110} />
          <div style={{ fontSize: '10px', color: '#4a7a5a', marginTop: '4px' }}>{fWins}W · {fLosses}L · {fBe}BE</div>
        </div>

        {/* PF Gauge */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>PROFIT FACTOR</div>
          <Gauge value={Math.min(fPF, 3)} max={3} color={fPF >= 1.5 ? '#00ff88' : fPF >= 1 ? '#f0a020' : '#ff4455'} label={fPF === 999 ? '∞' : fPF.toFixed(2)} size={110} />
          <div style={{ fontSize: '10px', color: '#4a7a5a', marginTop: '4px' }}>Objectif: {'>'}1.5</div>
        </div>

        {/* Avg W vs L */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>AVG WIN / AVG LOSS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', color: '#00ff88' }}>Win</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#00ff88' }}>+{fAvgW.toFixed(0)}$</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(0,255,136,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((fAvgW / Math.max(fAvgW, fAvgL)) * 100, 100)}%`, background: '#00ff88', borderRadius: '3px' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', color: '#ff4455' }}>Loss</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#ff4455' }}>-{fAvgL.toFixed(0)}$</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,68,85,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((fAvgL / Math.max(fAvgW, fAvgL)) * 100, 100)}%`, background: '#ff4455', borderRadius: '3px' }} />
              </div>
            </div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', marginTop: '4px' }}>
              Ratio: {fAvgL > 0 ? (fAvgW / fAvgL).toFixed(2) : '—'}
            </div>
          </div>
        </div>

        {/* Direction */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>DIRECTION</div>
          {dirPie.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <PieChart width={80} height={80}>
                <Pie data={dirPie} cx={35} cy={35} innerRadius={22} outerRadius={36} dataKey="value" strokeWidth={0}>
                  {dirPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dirPie.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }} />
                    <span style={{ fontSize: '10px', color: '#8aaa90' }}>{d.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: d.color }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div style={{ color: '#2a4a30', fontSize: '10px' }}>Aucune donnée</div>}
        </div>
      </div>

      {/* ── DAY OF WEEK ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'JOUR LE PLUS ACTIF', day: mostActiveDay, value: `${mostActiveDay.count} trades`, color: '#c8d8c8' },
          { label: 'JOUR LE PLUS RENTABLE', day: mostProfDay, value: fmt(mostProfDay.pnl, true), color: color(mostProfDay.pnl) },
          { label: 'JOUR LE MOINS RENTABLE', day: leastProfDay, value: fmt(leastProfDay.pnl, true), color: color(leastProfDay.pnl) },
        ].map(({ label, day, value, color: c }) => (
          <div key={label} style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '6px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>{day.label}</div>
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: c }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── BEST / WORST TRADE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'MEILLEUR TRADE', trade: bestTrade, c: '#00ff88' },
          { label: 'PIRE TRADE', trade: worstTrade, c: '#ff4455' },
        ].map(({ label, trade, c }) => (
          <div key={label} style={{ background: 'rgba(10,28,18,0.4)', border: `1px solid ${c}20`, borderLeft: `3px solid ${c}`, borderRadius: '6px', padding: '14px 16px' }}>
            <div style={{ fontSize: '8px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '8px' }}>{label}</div>
            {trade ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#c8d8c8' }}>{trade.pair}</span>
                  <span style={{ fontSize: '10px', color: trade.direction === 'LONG' ? '#00ff88' : '#ff4455', marginLeft: '8px', background: `rgba(${trade.direction==='LONG'?'0,255,136':'255,68,85'},0.1)`, padding: '2px 6px', borderRadius: '3px' }}>{trade.direction}</span>
                  <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '4px' }}>
                    {trade.entry && `Entrée: ${trade.entry}`}
                    {trade.exit_price && ` → ${trade.exit_price}`}
                    {trade.entered_at && ` · ${new Date(trade.entered_at).toLocaleString('fr-FR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: c }}>
                  {fmt(trade.result, true)}
                </div>
              </div>
            ) : <div style={{ color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Equity curve */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '18px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>P&L CUMULÉ NET</div>
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={equityData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={fPnl >= 0 ? '#00ff88' : '#ff4455'} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={fPnl >= 0 ? '#00ff88' : '#ff4455'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Area type="monotone" dataKey="pnl" name="P&L" stroke={fPnl >= 0 ? '#00ff88' : '#ff4455'} strokeWidth={2} fill="url(#eqGrad)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
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
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a4a30', fontSize: '10px' }}>Aucun trade</div>}
        </div>
      </div>

      {/* ── BY DOW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '18px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>ACTIVITÉ PAR JOUR DE LA SEMAINE</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={dowArr.filter(d => d.count > 0)} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
              <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a6a4a', fontSize: 8 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CTooltip />} />
              <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} fill="#00ff88" isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By pair */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '18px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '14px' }}>PERFORMANCE PAR INSTRUMENT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pairArr.slice(0, 6).map(p => (
              <div key={p.pair}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#c8d8c8', fontWeight: '600' }}>{p.pair}</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '10px', color: color(p.pnl), fontWeight: '700' }}>{fmt(p.pnl, true)}</span>
                    <span style={{ fontSize: '10px', color: p.wr >= 50 ? '#00ff88' : '#ff4455' }}>{p.wr}% WR</span>
                    <span style={{ fontSize: '9px', color: '#3a6a4a' }}>{p.total}T</span>
                  </div>
                </div>
                <div style={{ height: '4px', background: 'rgba(0,255,136,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.wr}%`, background: p.pnl >= 0 ? 'linear-gradient(90deg,#00aa55,#00ff88)' : 'linear-gradient(90deg,#aa2233,#ff4455)', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
            {pairArr.length === 0 && <div style={{ color: '#2a4a30', fontSize: '10px', padding: '20px 0', textAlign: 'center' }}>Aucune donnée</div>}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={load} />}
      {showQuick  && <QuickTradeModal onClose={() => setShowQuick(false)} onAdded={load} />}
    </div>
  );
}
