import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TradeReplay from '../features/replay/TradeReplay';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

// ── CSV export ───────────────────────────────────────────────
function exportCsv(trades, filename) {
  const HDR = ['Date','Heure Entrée','Heure Sortie','Paire','Direction','Entrée','Sortie','Taille','P&L Brut','Frais','P&L Net','RR','Durée','Outcome','Émotion','Tags','Rating','Notes'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  const rows = trades.map(t => [
    t.date ?? '',
    t.entered_at ? new Date(t.entered_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '',
    t.exited_at  ? new Date(t.exited_at ).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '',
    t.pair ?? '', t.direction ?? '',
    t.entry ?? '', t.exit_price ?? '',
    t.size ?? '',
    t.result != null ? Number(t.result).toFixed(2) : '',
    ((t.fees ?? 0) + (t.commissions ?? 0)).toFixed(2),
    t.result_net != null ? Number(t.result_net).toFixed(2) : t.result != null ? Number(t.result).toFixed(2) : '',
    t.rr ?? '', t.duration ?? '',
    t.outcome ?? '', t.emotion ?? '',
    t.tags ?? '', t.rating ?? '',
    (t.notes ?? '').replace(/Checklist:[^]*$/, '').trim(),
  ].map(esc).join(','));
  const csv = '﻿' + [HDR.map(esc).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:      'rgba(14,15,22,',
  bgHov:   'rgba(16,17,26,',
  border:  'rgba(136,153,187,',
  text1:   '#dde4ef',
  text2:   '#8898aa',
  text3:   '#4a5a72',
  text4:   '#2c3c54',
  accent:  '#8899bb',
  accentL: '#aabbd0',
};

// ── Helpers ───────────────────────────────────────────────────
function getNet(t) {
  if (t.result_net != null) return t.result_net;
  if (t.result     != null) return t.result;
  return null;
}
function fmt(n, sign = false) {
  if (n == null) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00cc77';
  if (v < 0) return '#ff3344';
  return '#606878';
}
function fmtDayLabel(ds) {
  if (!ds) return ds;
  const d     = new Date(ds + 'T00:00:00');
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (ds === today) return "Aujourd'hui";
  if (ds === yest)  return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
const EMOTION_EMOJI = {
  Calme:'😌',Confiant:'💪',Anxieux:'😰',Impatient:'⚡',
  Neutre:'😐',Frustré:'😤',Focalisé:'🎯',Fatigué:'😴',
};
const DOW = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

// ── FraisCell ─────────────────────────────────────────────────
function FraisCell({ trade, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState('');
  const [saving, setSaving]   = useState(false);
  const total = (trade.fees ?? 0) + (trade.commissions ?? 0);

  function startEdit(e) { e.stopPropagation(); setVal(total > 0 ? String(total) : ''); setEditing(true); }
  async function saveEdit(e) {
    e?.stopPropagation(); setSaving(true);
    const newTotal = parseFloat(val) || 0;
    const newNet   = (trade.result ?? 0) - newTotal;
    await window.db.updateTrade(trade.id, { ...trade, fees: newTotal, commissions: 0, result_net: Math.round(newNet * 100) / 100 });
    onUpdate(trade.id, { fees: newTotal, commissions: 0, result_net: Math.round(newNet * 100) / 100 });
    setSaving(false); setEditing(false);
  }
  function cancelEdit(e) { e?.stopPropagation(); setEditing(false); }

  if (editing) return (
    <div onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
      <input autoFocus type="number" min="0" step="0.01" placeholder="0.00" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') saveEdit(e); if (e.key==='Escape') cancelEdit(e); }}
        style={{ width:'70px', background:'rgba(14,15,22,0.9)', border:'1px solid rgba(240,160,32,0.5)', borderRadius:'3px', padding:'3px 6px', color:'#f0a020', fontSize:'13px', fontFamily:'inherit', outline:'none' }} />
      <button onClick={saveEdit} disabled={saving} style={{ background:'rgba(0,204,119,0.12)', border:'1px solid rgba(0,204,119,0.3)', color:'#00cc77', borderRadius:'3px', padding:'2px 6px', fontSize:'12px', cursor:'pointer' }}>✓</button>
      <button onClick={cancelEdit} style={{ background:'transparent', border:'1px solid rgba(136,153,187,0.2)', color:T.text3, borderRadius:'3px', padding:'2px 6px', fontSize:'12px', cursor:'pointer' }}>✕</button>
    </div>
  );

  if (total > 0) return (
    <div onClick={startEdit} title="Modifier" style={{ display:'inline-flex', alignItems:'center', gap:'4px', cursor:'pointer', padding:'2px 6px', borderRadius:'4px', border:'1px solid transparent', transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.border='1px solid rgba(240,160,32,0.3)'; e.currentTarget.style.background='rgba(240,160,32,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.border='1px solid transparent'; e.currentTarget.style.background='transparent'; }}>
      <span style={{ fontSize:'13px', fontWeight:'600', color:'#f0a020' }}>-{total.toFixed(2)}$</span>
      <span style={{ fontSize:'12px', color:'#6a4a20' }}>✎</span>
    </div>
  );

  return (
    <div onClick={startEdit} title="Ajouter des frais" style={{ display:'inline-flex', alignItems:'center', gap:'3px', cursor:'pointer', padding:'2px 7px', borderRadius:'4px', border:'1px dashed rgba(240,160,32,0.2)', color:'#4a3020', fontSize:'12px', transition:'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.border='1px dashed rgba(240,160,32,0.45)'; e.currentTarget.style.color='#f0a020'; }}
      onMouseLeave={e => { e.currentTarget.style.border='1px dashed rgba(240,160,32,0.2)'; e.currentTarget.style.color='#4a3020'; }}>
      + frais
    </div>
  );
}

// ── PnlCell ───────────────────────────────────────────────────
function PnlCell({ trade }) {
  const [hover, setHover] = useState(false);
  const net       = getNet(trade);
  const hasFees   = (trade.fees ?? 0) > 0 || (trade.commissions ?? 0) > 0;
  const totalFees = (trade.fees ?? 0) + (trade.commissions ?? 0);
  const color     = pnlColor(net ?? 0);

  return (
    <div style={{ position:'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize:'14px', fontWeight:'700', color, cursor: hasFees ? 'help' : 'default', letterSpacing:'-0.3px' }}>
        {fmt(net, true)}
        {hasFees && <span style={{ fontSize:'11px', color: T.text3, marginLeft:'2px' }}>net</span>}
      </span>
      {hover && hasFees && (
        <div style={{ position:'absolute', bottom:'100%', right:0, marginBottom:'6px', zIndex:300, background:'rgba(8,9,16,0.98)', border:`1px solid ${T.border}0.22)`, borderRadius:'6px', padding:'10px 12px', minWidth:'170px', pointerEvents:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize:'11px', color:T.text3, letterSpacing:'1px', marginBottom:'6px' }}>DÉTAIL P&L</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:'12px' }}>
              <span style={{ fontSize:'12px', color:T.text2 }}>P&L brut</span>
              <span style={{ fontSize:'12px', fontWeight:'700', color:(trade.result ?? 0) >= 0 ? '#00cc77' : '#ff3344' }}>{fmt(trade.result, true)}</span>
            </div>
            {(trade.commissions ?? 0) > 0 && <div style={{ display:'flex', justifyContent:'space-between', gap:'12px' }}><span style={{ fontSize:'12px', color:T.text2 }}>Commissions</span><span style={{ fontSize:'12px', color:'#ff3344' }}>-{trade.commissions.toFixed(2)}$</span></div>}
            {(trade.fees ?? 0) > 0 && <div style={{ display:'flex', justifyContent:'space-between', gap:'12px' }}><span style={{ fontSize:'12px', color:T.text2 }}>Frais</span><span style={{ fontSize:'12px', color:'#ff3344' }}>-{trade.fees.toFixed(2)}$</span></div>}
            <div style={{ borderTop:`1px solid ${T.border}0.12)`, marginTop:'4px', paddingTop:'4px', display:'flex', justifyContent:'space-between', gap:'12px' }}>
              <span style={{ fontSize:'12px', color:T.text1, fontWeight:'600' }}>P&L net</span>
              <span style={{ fontSize:'13px', fontWeight:'700', color }}>{fmt(net, true)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', gap:'12px' }}>
              <span style={{ fontSize:'12px', color:T.text3 }}>Total frais</span>
              <span style={{ fontSize:'12px', color:'#f0a020' }}>-{totalFees.toFixed(2)}$</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── NotesCell ─────────────────────────────────────────────────
function NotesCell({ trade, notesClean, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState('');
  const [saving, setSaving]   = useState(false);

  function startEdit(e) {
    e.stopPropagation();
    const base = trade.notes ? trade.notes.replace(/\nChecklist:.*$/s, '').trim() : '';
    setVal(base);
    setEditing(true);
  }
  async function saveEdit(e) {
    e?.stopPropagation();
    setSaving(true);
    const checklistPart = trade.notes?.match(/\nChecklist:.*$/s)?.[0] ?? '';
    const newNotes = val.trim() ? val.trim() + checklistPart : checklistPart.replace(/^\n/, '');
    await window.db.updateTrade(trade.id, { ...trade, notes: newNotes || null });
    onUpdate(trade.id, { notes: newNotes || null });
    setSaving(false);
    setEditing(false);
  }
  function cancelEdit(e) { e?.stopPropagation(); setEditing(false); }

  if (editing) return (
    <div onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'flex-start', gap:'4px', width:'100%' }}>
      <textarea autoFocus rows={2} value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(e); } if (e.key==='Escape') cancelEdit(e); }}
        placeholder="Note..."
        style={{ flex:1, resize:'none', background:'rgba(14,15,22,0.9)', border:'1px solid rgba(136,153,187,0.35)', borderRadius:'3px', padding:'4px 6px', color:T.text1, fontSize:'12px', fontFamily:'inherit', outline:'none', lineHeight:'1.4' }} />
      <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
        <button onClick={saveEdit} disabled={saving} style={{ background:'rgba(0,204,119,0.12)', border:'1px solid rgba(0,204,119,0.3)', color:'#00cc77', borderRadius:'3px', padding:'2px 5px', fontSize:'11px', cursor:'pointer' }}>✓</button>
        <button onClick={cancelEdit} style={{ background:'transparent', border:'1px solid rgba(136,153,187,0.2)', color:T.text3, borderRadius:'3px', padding:'2px 5px', fontSize:'11px', cursor:'pointer' }}>✕</button>
      </div>
    </div>
  );

  return (
    <div onClick={startEdit} title="Cliquer pour modifier la note"
      style={{ overflow:'hidden', cursor:'text', padding:'2px 4px', borderRadius:'4px', border:'1px solid transparent', transition:'all 0.15s', minHeight:'20px', width:'100%' }}
      onMouseEnter={e => { e.currentTarget.style.border='1px solid rgba(136,153,187,0.18)'; e.currentTarget.style.background='rgba(136,153,187,0.04)'; }}
      onMouseLeave={e => { e.currentTarget.style.border='1px solid transparent'; e.currentTarget.style.background='transparent'; }}>
      <span style={{ fontSize:'12px', color:notesClean ? T.text3 : T.text4, fontStyle: notesClean ? 'normal' : 'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
        {notesClean || '—'}
      </span>
    </div>
  );
}

// ── Custom Recharts Tooltip ────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(8,9,16,0.97)', border:`1px solid ${T.border}0.22)`, borderRadius:'5px', padding:'8px 12px', fontSize:'13px', fontFamily:'inherit' }}>
      <div style={{ color:T.text3, marginBottom:'4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: typeof p.value === 'number' ? pnlColor(p.value) : T.text1, fontWeight:'700' }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, true) : p.value}
        </div>
      ))}
    </div>
  );
}

// ── Calendar Heatmap ──────────────────────────────────────────
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
}

function CalendarHeatmap({ trades }) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const dayMap = {};
  trades.forEach(t => {
    if (!t.date) return;
    const net = getNet(t); if (net == null) return;
    if (!dayMap[t.date]) dayMap[t.date] = { pnl:0, count:0 };
    dayMap[t.date].pnl += net; dayMap[t.date].count++;
  });
  const daysInMonth = new Date(year, month+1, 0).getDate();
  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;
  const maxPnl = Math.max(...Object.values(dayMap).map(d => Math.abs(d.pnl)), 1);
  const todayStr = now.toISOString().slice(0, 10);

  // Build flat cell list then chunk into rows of 7
  const flatCells = [];
  for (let i = 0; i < firstDay; i++) flatCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) flatCells.push(d);
  // Pad to multiple of 7
  while (flatCells.length % 7 !== 0) flatCells.push(null);
  const rows = [];
  for (let i = 0; i < flatCells.length; i += 7) rows.push(flatCells.slice(i, i + 7));

  const monthLabel = now.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  function renderDay(day, rowIdx, colIdx) {
    const key = day
      ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      : `e${rowIdx}_${colIdx}`;
    if (!day) return <div key={key} />;
    const ds   = key;
    const data = dayMap[ds];
    const isToday = ds === todayStr;
    let bg = `${T.bg}0.35)`, textColor = T.text3, pnlText = null;
    if (data) {
      const int = Math.min(Math.abs(data.pnl)/maxPnl, 1);
      if (data.pnl > 0)      { bg=`rgba(0,204,119,${0.09+int*0.42})`; textColor='#00cc77'; }
      else if (data.pnl < 0) { bg=`rgba(255,51,68,${0.09+int*0.42})`;  textColor='#ff4455'; }
      else                   { bg='rgba(96,104,120,0.15)'; textColor='#606878'; }
      pnlText = `${data.pnl>=0?'+':''}${Math.round(data.pnl)}$`;
    }
    return (
      <div key={ds} title={data ? `${fmt(data.pnl,true)} · ${data.count}t` : ds}
        style={{ minHeight:'52px', borderRadius:'5px', background:bg, border:`1px solid ${isToday?`${T.border}0.60)`:'transparent'}`, outline:isToday?`1px solid ${T.border}0.30)`:'none', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'3px', cursor:data?'pointer':'default', transition:'opacity 0.15s', padding:'4px 2px' }}
        onMouseEnter={e => { if(data) e.currentTarget.style.opacity='0.75'; }}
        onMouseLeave={e => e.currentTarget.style.opacity='1'}>
        <span style={{ fontSize:'13px', color:textColor, fontWeight:data?'700':'400', lineHeight:1 }}>{day}</span>
        {data && <span style={{ fontSize:'12px', color:textColor, opacity:0.90, lineHeight:1, fontWeight:'600' }}>{pnlText}</span>}
        {data && <span style={{ fontSize:'11px', color:textColor, opacity:0.55, lineHeight:1 }}>{data.count}t</span>}
      </div>
    );
  }

  return (
    <div style={{ background:`${T.bg}0.65)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <span style={{ fontSize:'11px', color:T.text3, letterSpacing:'2.5px' }}>CALENDRIER — {monthLabel.toUpperCase()}</span>
        <div style={{ display:'flex', gap:'8px', fontSize:'11px', color:T.text4 }}>
          <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><span style={{ width:'8px', height:'8px', borderRadius:'2px', background:'rgba(0,204,119,0.4)', display:'inline-block' }} /> Profit</span>
          <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><span style={{ width:'8px', height:'8px', borderRadius:'2px', background:'rgba(255,51,68,0.4)', display:'inline-block' }} /> Perte</span>
        </div>
      </div>
      {/* Header row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr) 36px', gap:'4px', marginBottom:'4px' }}>
        {['LUN','MAR','MER','JEU','VEN','SAM','DIM'].map((d,i) => <div key={i} style={{ textAlign:'center', fontSize:'12px', color:T.text3, fontWeight:'700', paddingBottom:'4px' }}>{d}</div>)}
        <div style={{ textAlign:'center', fontSize:'10px', color:T.text4, paddingBottom:'4px' }}>S.</div>
      </div>
      {/* Calendar rows */}
      {rows.map((row, ri) => {
        // Find first non-null day to compute week number
        const firstDayInRow = row.find(d => d != null);
        let weekNum = null;
        if (firstDayInRow) {
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(firstDayInRow).padStart(2,'0')}`;
          weekNum = isoWeek(ds);
        }
        // Compute row P&L for week label color
        const rowPnl = row.reduce((s, day) => {
          if (!day) return s;
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          return s + (dayMap[ds]?.pnl ?? 0);
        }, 0);
        const weekColor = rowPnl > 0 ? '#00cc77' : rowPnl < 0 ? '#ff4455' : T.text4;
        return (
          <div key={ri} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr) 36px', gap:'4px', marginBottom:'4px' }}>
            {row.map((day, ci) => renderDay(day, ri, ci))}
            <div title={weekNum ? `Semaine ${weekNum}${rowPnl !== 0 ? ` · ${rowPnl >= 0 ? '+' : ''}${Math.round(rowPnl)}$` : ''}` : ''}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px', paddingLeft:'4px', borderLeft:`1px solid ${T.border}0.08)` }}>
              {weekNum && <>
                <span style={{ fontSize:'9px', color:T.text4, lineHeight:1 }}>S.</span>
                <span style={{ fontSize:'11px', fontWeight:'700', color:rowPnl !== 0 ? weekColor : T.text4, lineHeight:1 }}>{weekNum}</span>
                {rowPnl !== 0 && <span style={{ fontSize:'9px', color:weekColor, opacity:0.8, lineHeight:1 }}>{rowPnl >= 0 ? '+' : ''}{Math.round(rowPnl)}$</span>}
              </>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color=T.text1 }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? `${T.bgHov}0.75)` : `${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderTop:`2px solid ${color}30`, borderRadius:'7px', padding:'14px 16px', transition:'all 0.18s', transform:hov?'translateY(-1px)':'none', boxShadow:hov?`0 4px 16px rgba(0,0,0,0.3)`:'none' }}>
      <div style={{ fontSize:'11px', color:T.text3, letterSpacing:'1.8px', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'20px', fontWeight:'700', color, letterSpacing:'-0.5px', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'12px', color:T.text3, marginTop:'5px' }}>{sub}</div>}
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize:'11px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ width:'20px', height:'1px', background:T.text4, display:'inline-block' }} />
      {children}
      <span style={{ flex:1, height:'1px', background:`${T.border}0.07)`, display:'inline-block' }} />
    </div>
  );
}

// ── SYNTHÈSE TAB ──────────────────────────────────────────────
function SyntheseTab({ trades, loading }) {
  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:T.text3, fontSize:'13px', letterSpacing:'2px' }}>CHARGEMENT...</div>;

  // Core stats
  const nets   = trades.map(t => getNet(t) ?? 0);
  const total  = nets.reduce((s,v) => s+v, 0);
  const fees   = trades.reduce((s,t) => s+(t.fees??0)+(t.commissions??0), 0);
  const wins   = trades.filter(t => (getNet(t)??0) > 0);
  const losses = trades.filter(t => (getNet(t)??0) < 0);
  const winrate = trades.length > 0 ? Math.round((wins.length/trades.length)*100) : 0;

  const sumWin  = wins.reduce((s,t) => s+(getNet(t)??0), 0);
  const sumLoss = Math.abs(losses.reduce((s,t) => s+(getNet(t)??0), 0));
  const pf      = sumLoss > 0 ? (sumWin/sumLoss) : wins.length > 0 ? 99 : 0;
  const avgWin  = wins.length > 0 ? sumWin/wins.length : 0;
  const avgLoss = losses.length > 0 ? sumLoss/losses.length : 0;
  const bestT   = nets.length > 0 ? Math.max(...nets) : null;
  const worstT  = nets.length > 0 ? Math.min(...nets) : null;

  // Streak
  const byDay = {};
  trades.forEach(t => { if(!t.date) return; byDay[t.date]=(byDay[t.date]??0)+(getNet(t)??0); });
  const sortedDays = Object.entries(byDay).sort((a,b) => b[0].localeCompare(a[0]));
  let streak=0, streakType=null;
  for (const [,pnl] of sortedDays) {
    const type = pnl>0?'W':pnl<0?'L':null; if(!type) break;
    if(!streakType) { streakType=type; streak=1; } else if(type===streakType) streak++; else break;
  }

  // Equity curve data
  const equityData = [];
  let cum = 0;
  [...trades].sort((a,b) => (a.date??'').localeCompare(b.date??'') || a.id-b.id).forEach((t,i) => {
    cum += getNet(t) ?? 0;
    equityData.push({ i:i+1, date: t.date, cum: Math.round(cum*100)/100, pnl: Math.round((getNet(t)??0)*100)/100 });
  });

  // Long vs Short
  const longTrades  = trades.filter(t => t.direction === 'LONG');
  const shortTrades = trades.filter(t => t.direction === 'SHORT');
  const dirStats = ['LONG','SHORT'].map(dir => {
    const dt = dir==='LONG' ? longTrades : shortTrades;
    const dp = dt.reduce((s,t) => s+(getNet(t)??0), 0);
    const dw = dt.filter(t => (getNet(t)??0) > 0).length;
    return { dir, n:dt.length, pnl:dp, wr:dt.length>0?Math.round((dw/dt.length)*100):0, avg:dt.length>0?dp/dt.length:0 };
  }).filter(d => d.n > 0);

  // Top pairs
  const pairMap = {};
  trades.forEach(t => {
    const p = t.pair??'?'; if(!pairMap[p]) pairMap[p]={pnl:0,n:0,w:0};
    pairMap[p].pnl += getNet(t)??0; pairMap[p].n++; if((getNet(t)??0)>0) pairMap[p].w++;
  });
  const topPairs = Object.entries(pairMap).sort((a,b) => b[1].pnl-a[1].pnl).slice(0,5);

  // P&L by DOW
  const dowMap = Array.from({length:7},(_,i) => ({day:DOW[i],pnl:0,n:0}));
  trades.forEach(t => {
    if(!t.date) return;
    const d = new Date(t.date+'T00:00:00').getDay();
    dowMap[d].pnl += getNet(t)??0; dowMap[d].n++;
  });
  const dowData = [1,2,3,4,5].map(i => ({ day:DOW[i], pnl: Math.round(dowMap[i].pnl*100)/100, n:dowMap[i].n }));

  // Emotion impact
  const emotionMap = {};
  trades.forEach(t => {
    if (!t.emotion) return;
    if (!emotionMap[t.emotion]) emotionMap[t.emotion] = { pnl:0, n:0, w:0 };
    emotionMap[t.emotion].pnl += getNet(t)??0;
    emotionMap[t.emotion].n++;
    if ((getNet(t)??0) > 0) emotionMap[t.emotion].w++;
  });
  const emotionStats = Object.entries(emotionMap)
    .sort((a,b) => (b[1].pnl/b[1].n) - (a[1].pnl/a[1].n))
    .map(([emo,d]) => ({ emo, pnl:d.pnl, n:d.n, avg:d.pnl/d.n, wr:Math.round((d.w/d.n)*100) }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* Long vs Short */}
      {dirStats.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${dirStats.length},1fr)`, gap:'10px' }}>
          {dirStats.map(({ dir, n, pnl, wr, avg }) => {
            const isLong = dir === 'LONG';
            const col = pnlColor(pnl);
            const dirCol = isLong ? '#00cc77' : '#ff3344';
            return (
              <div key={dir} style={{ background:`rgba(${isLong?'0,204,119':'255,51,68'},0.04)`, border:`1px solid rgba(${isLong?'0,204,119':'255,51,68'},0.15)`, borderRadius:'8px', padding:'14px 18px', display:'flex', alignItems:'center', gap:'16px' }}>
                <div style={{ fontSize:'22px' }}>{isLong ? '↑' : '↓'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                    <span style={{ fontSize:'13px', fontWeight:'700', color:dirCol, letterSpacing:'1px' }}>{dir}</span>
                    <span style={{ fontSize:'12px', color:T.text3 }}>{n} trade{n>1?'s':''}</span>
                    <span style={{ fontSize:'12px', fontWeight:'600', color:wr>=50?'#00cc77':'#ff3344' }}>{wr}% WR</span>
                  </div>
                  <div style={{ display:'flex', gap:'20px' }}>
                    <div><div style={{ fontSize:'11px', color:T.text4, marginBottom:'2px' }}>P&L TOTAL</div><div style={{ fontSize:'15px', fontWeight:'700', color:col }}>{fmt(pnl,true)}</div></div>
                    <div><div style={{ fontSize:'11px', color:T.text4, marginBottom:'2px' }}>MOY./TRADE</div><div style={{ fontSize:'15px', fontWeight:'700', color:pnlColor(avg) }}>{fmt(avg,true)}</div></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stat cards */}
      <div>
        <SectionTitle>INDICATEURS CLÉS</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'10px' }}>
          <StatCard label="P&L NET TOTAL"    value={fmt(total,true)}           color={pnlColor(total)} />
          <StatCard label="TRADES"           value={String(trades.length)}     color={T.text1} sub={`${wins.length}W · ${losses.length}L`} />
          <StatCard label="WIN RATE"         value={`${winrate}%`}             color={winrate>=50?'#00cc77':'#ff3344'} />
          <StatCard label="PROFIT FACTOR"    value={pf===99?'∞':pf.toFixed(2)} color={pf>=1.5?'#00cc77':pf>=1?T.text1:'#ff3344'} />
          <StatCard label="MOY. WIN"         value={fmt(avgWin,true)}          color='#00cc77' />
          <StatCard label="MOY. LOSS"        value={avgLoss>0?`-${avgLoss.toFixed(2)}$`:'—'} color='#ff3344' />
          <StatCard label="MEILLEUR TRADE"   value={bestT!=null?fmt(bestT,true):'—'} color='#00cc77' />
          <StatCard label="PIRE TRADE"       value={worstT!=null?fmt(worstT,true):'—'} color='#ff3344' />
          <StatCard label={`SÉRIE ${streakType??'—'}`} value={streak>0?`${streak}j`:'—'} color={streakType==='W'?'#00cc77':streakType==='L'?'#ff3344':T.text2} />
          <StatCard label="FRAIS PAYÉS"      value={fees>0?`-${fees.toFixed(2)}$`:'0$'} color='#f0a020' />
        </div>
      </div>

      {/* Equity curve */}
      <div>
        <SectionTitle>COURBE D'ÉQUITÉ</SectionTitle>
        <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'16px', height:'200px' }}>
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={total>=0?'#00cc77':'#ff3344'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={total>=0?'#00cc77':'#ff3344'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} vertical={false} />
                <XAxis dataKey="i" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v => `${v>0?'+':''}${v}$`} width={55} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke={`${T.border}0.20)`} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="cum" name="Équité" stroke={total>=0?'#00cc77':'#ff3344'} strokeWidth={2} fill="url(#eq)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.text3, fontSize:'13px' }}>Pas assez de données</div>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div>
        <SectionTitle>CALENDRIER</SectionTitle>
        <CalendarHeatmap trades={trades} />
      </div>

      {/* Pairs + DOW side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>

        {/* Top pairs */}
        <div>
          <SectionTitle>PERFORMANCE PAR INSTRUMENT</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', overflow:'hidden' }}>
            {topPairs.length === 0
              ? <div style={{ padding:'28px', textAlign:'center', color:T.text3, fontSize:'13px' }}>Aucune donnée</div>
              : topPairs.map(([pair, d]) => {
                  const wr = d.n>0 ? Math.round((d.w/d.n)*100) : 0;
                  const bar = Math.abs(d.pnl)/Math.max(...topPairs.map(([,x]) => Math.abs(x.pnl)),1)*100;
                  const c   = pnlColor(d.pnl);
                  return (
                    <div key={pair} style={{ padding:'10px 16px', borderBottom:`1px solid ${T.border}0.06)`, display:'flex', alignItems:'center', gap:'12px', position:'relative', overflow:'hidden' }}>
                      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${bar}%`, background:`${d.pnl>0?'rgba(0,204,119,':'rgba(255,51,68,'}0.05)`, zIndex:0 }} />
                      <span style={{ fontSize:'13px', fontWeight:'700', color:T.text1, minWidth:'55px', position:'relative' }}>{pair}</span>
                      <span style={{ fontSize:'12px', color:T.text3, position:'relative' }}>{d.n}t · {wr}%WR</span>
                      <span style={{ marginLeft:'auto', fontSize:'13px', fontWeight:'700', color:c, position:'relative' }}>{fmt(d.pnl,true)}</span>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* P&L by DOW */}
        <div>
          <SectionTitle>P&L PAR JOUR DE SEMAINE</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'16px', height:'180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top:5, right:5, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize:10, fill:T.text2 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?'+':''}${v}$`} width={50} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke={`${T.border}0.18)`} />
                <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} maxBarSize={6}>
                  {dowData.map((d,i) => <Cell key={i} fill={pnlColor(d.pnl)} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Emotion impact */}
      {emotionStats.length > 0 && (
        <div>
          <SectionTitle>IMPACT ÉMOTIONNEL</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', fontSize:'11px', color:T.text3, letterSpacing:'1px', padding:'6px 16px', borderBottom:`1px solid ${T.border}0.07)` }}>
              <span style={{ minWidth:'32px' }}></span>
              <span>ÉMOTION</span>
              <span style={{ textAlign:'right', minWidth:'55px' }}>TRADES</span>
              <span style={{ textAlign:'right', minWidth:'52px' }}>WIN%</span>
              <span style={{ textAlign:'right', minWidth:'88px' }}>MOY. P&L</span>
            </div>
            {emotionStats.map(({ emo, n, wr, avg }) => {
              const col = avg > 0 ? '#00cc77' : '#ff3344';
              const maxAbs = Math.max(...emotionStats.map(e => Math.abs(e.avg)));
              const barW = maxAbs > 0 ? Math.round((Math.abs(avg) / maxAbs) * 100) : 0;
              return (
                <div key={emo} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', alignItems:'center', padding:'9px 16px', borderBottom:`1px solid ${T.border}0.05)`, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${barW}%`, background:`${avg>0?'rgba(0,204,119,':'rgba(255,51,68,'}0.05)`, zIndex:0 }} />
                  <span style={{ fontSize:'16px', minWidth:'32px', position:'relative' }}>{EMOTION_EMOJI[emo]||'😐'}</span>
                  <span style={{ fontSize:'12px', color:T.text2, position:'relative' }}>{emo}</span>
                  <span style={{ fontSize:'12px', color:T.text3, textAlign:'right', minWidth:'55px', position:'relative' }}>{n}t</span>
                  <span style={{ fontSize:'12px', color:wr>=50?'#00cc77':'#ff3344', textAlign:'right', minWidth:'52px', position:'relative', fontWeight:'600' }}>{wr}%</span>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:col, textAlign:'right', minWidth:'88px', position:'relative' }}>{avg>=0?'+':''}{avg.toFixed(2)}$</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TRADES TAB ────────────────────────────────────────────────
function DayHeader({ date, dayTrades }) {
  const dayPnl = dayTrades.reduce((s,t) => s+(getNet(t)??0), 0);
  const wins   = dayTrades.filter(t => (getNet(t)??0) > 0).length;
  const losses = dayTrades.filter(t => (getNet(t)??0) < 0).length;
  const wr     = dayTrades.length > 0 ? Math.round((wins/dayTrades.length)*100) : 0;
  const best   = dayTrades.reduce((m,t) => (getNet(t)??0)>(getNet(m)??0)?t:m, dayTrades[0]);
  const worst  = dayTrades.reduce((m,t) => (getNet(t)??0)<(getNet(m)??0)?t:m, dayTrades[0]);
  const fees   = dayTrades.reduce((s,t) => s+(t.fees??0)+(t.commissions??0), 0);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'7px 16px', borderRadius:'5px', background:`${T.bg}0.65)`, border:`1px solid ${T.border}0.08)`, marginBottom:'4px', marginTop:'14px' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'13px', fontWeight:'700', color:T.text1, textTransform:'capitalize' }}>{fmtDayLabel(date)}</span>
        <span style={{ fontSize:'12px', color:T.text3 }}>{dayTrades.length} trade{dayTrades.length>1?'s':''}</span>
        {dayTrades.length > 1 && (
          <span style={{ fontSize:'11px', color:wr>=50?'#00cc77':'#ff3344', background:`rgba(${wr>=50?'0,204,119':'255,51,68'},0.07)`, border:`1px solid rgba(${wr>=50?'0,204,119':'255,51,68'},0.18)`, padding:'1px 5px', borderRadius:'3px', fontWeight:'600' }}>{wr}%</span>
        )}
        {fees > 0 && <span style={{ fontSize:'11px', color:'#f0a020', opacity:0.7 }}>-{fees.toFixed(2)}$ frais</span>}
      </div>
      <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
        {wins   > 0 && <span style={{ fontSize:'12px', color:'#00cc77', fontWeight:'600', background:'rgba(0,204,119,0.08)', border:'1px solid rgba(0,204,119,0.18)', padding:'1px 5px', borderRadius:'3px' }}>{wins}W</span>}
        {losses > 0 && <span style={{ fontSize:'12px', color:'#ff3344', fontWeight:'600', background:'rgba(255,51,68,0.08)', border:'1px solid rgba(255,51,68,0.18)', padding:'1px 5px', borderRadius:'3px' }}>{losses}L</span>}
        {dayTrades.length > 1 && (getNet(best)??0) > 0 && (
          <span title={`Best: ${best.pair} ${fmt(getNet(best),true)}`} style={{ fontSize:'11px', color:'#00cc77', opacity:0.7 }}>↑{fmt(getNet(best),true)}</span>
        )}
        {dayTrades.length > 1 && (getNet(worst)??0) < 0 && (
          <span title={`Worst: ${worst.pair} ${fmt(getNet(worst),true)}`} style={{ fontSize:'11px', color:'#ff3344', opacity:0.7 }}>↓{fmt(getNet(worst),true)}</span>
        )}
      </div>
      <div style={{ fontWeight:'700', fontSize:'14px', color:pnlColor(dayPnl), letterSpacing:'-0.3px', minWidth:'85px', textAlign:'right' }}>{fmt(dayPnl,true)}</div>
    </div>
  );
}

function TradeRow({ trade, onDelete, onFeeUpdate, onNoteUpdate, onClick, onReplay }) {
  const net   = getNet(trade);
  const color = pnlColor(net ?? 0);
  const hasScreenshot = trade.screenshot && trade.screenshot !== 'null' && trade.screenshot.length > 4;
  let checklistScore = null;
  if (trade.notes) { const m=trade.notes.match(/\[(\d+)\/(\d+)\]/); if(m) checklistScore=`${m[1]}/${m[2]}`; }
  const notesClean = trade.notes ? trade.notes.replace(/\nChecklist:.*$/s,'').trim() : '';
  const entryTime = trade.entered_at ? new Date(trade.entered_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : null;
  const exitTime  = trade.exited_at  ? new Date(trade.exited_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})  : null;

  return (
    <div onClick={onClick}
      style={{ display:'grid', gridTemplateColumns:'3px 1fr auto', borderRadius:'6px', overflow:'hidden', background:`${T.bg}0.55)`, border:`1px solid ${T.border}0.07)`, cursor:'pointer', transition:'background 0.15s', marginBottom:'3px' }}
      onMouseEnter={e => e.currentTarget.style.background=`${T.bgHov}0.65)`}
      onMouseLeave={e => e.currentTarget.style.background=`${T.bg}0.55)`}>
      <div style={{ background:color, opacity:0.75 }} />
      <div style={{ padding:'10px 14px', display:'grid', gridTemplateColumns:'110px 68px 90px 90px 60px 1fr 115px 85px 56px', gap:'8px', alignItems:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'13px', fontWeight:'700', color:T.text1 }}>{trade.pair}</span>
          {trade.size != null && <span style={{ fontSize:'12px', color:T.text3 }}>{trade.size} contrat{trade.size>1?'s':''}</span>}
        </div>
        <span style={{ fontSize:'12px', fontWeight:'700', letterSpacing:'0.5px', color:trade.direction==='LONG'?'#00cc77':'#ff3344', background:`rgba(${trade.direction==='LONG'?'0,204,119':'255,51,68'},0.10)`, border:`1px solid rgba(${trade.direction==='LONG'?'0,204,119':'255,51,68'},0.22)`, padding:'3px 7px', borderRadius:'3px', textAlign:'center', width:'fit-content' }}>{trade.direction}</span>
        {/* ENTRÉE */}
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'13px', color:T.text2, fontWeight:'600' }}>{trade.entry??'—'}</span>
          {entryTime && <span style={{ fontSize:'12px', color:T.text3 }}>{entryTime}</span>}
        </div>
        {/* SORTIE */}
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'13px', color:T.text2, fontWeight:'600' }}>{trade.exit_price??trade.tp??'—'}</span>
          {exitTime && <span style={{ fontSize:'12px', color:T.text3 }}>{exitTime}</span>}
        </div>
        {/* DURÉE / R */}
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {trade.duration && <span style={{ fontSize:'12px', color:T.text3 }}>{trade.duration}</span>}
          {trade.rr && <span style={{ fontSize:'12px', color:T.text3 }}>R {trade.rr}</span>}
        </div>
        <div style={{ overflow:'hidden', display:'flex', flexDirection:'column', gap:'3px', minWidth:0 }}>
          <div onClick={e => e.stopPropagation()}>
            <NotesCell trade={trade} notesClean={notesClean} onUpdate={onNoteUpdate} />
          </div>
          {trade.tags && (
            <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
              {trade.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{ fontSize:'10px', padding:'1px 5px', borderRadius:'3px', background:'rgba(124,58,237,0.13)', border:'1px solid rgba(124,58,237,0.28)', color:'#9d72ff', whiteSpace:'nowrap', lineHeight:1.5 }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div onClick={e => e.stopPropagation()}><PnlCell trade={trade} /></div>
        <div onClick={e => e.stopPropagation()}><FraisCell trade={trade} onUpdate={onFeeUpdate} /></div>
        <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
          {trade.rating > 0 && (
            <span title={`Note : ${trade.rating}/5`} style={{ fontSize:'11px', color:'#f59e0b', letterSpacing:'-0.5px', lineHeight:1 }}>{'★'.repeat(trade.rating)}</span>
          )}
          {trade.emotion && <span title={trade.emotion} style={{ fontSize:'13px', cursor:'default' }}>{EMOTION_EMOJI[trade.emotion]||'😐'}</span>}
          {hasScreenshot && <span title="Screenshot" style={{ fontSize:'13px', color:T.text3 }}>📸</span>}
          {checklistScore && <span style={{ fontSize:'11px', color:T.text3, background:`${T.border}0.08)`, border:`1px solid ${T.border}0.15)`, borderRadius:'3px', padding:'1px 4px' }}>✓{checklistScore}</span>}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', padding:'0 8px', gap:'2px' }}>
        <button onClick={e => { e.stopPropagation(); onReplay && onReplay(trade); }}
          title="Replay"
          style={{ background:'none', border:'none', color:T.text4, cursor:'pointer', fontSize:'13px', padding:'4px 5px', lineHeight:1, transition:'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color='#7c3aed'}
          onMouseLeave={e => e.currentTarget.style.color=T.text4}>▶</button>
        <button onClick={e => { e.stopPropagation(); onDelete(trade.id,e); }}
          style={{ background:'none', border:'none', color:T.text4, cursor:'pointer', fontSize:'18px', padding:'4px', lineHeight:1, transition:'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color='#ff3344'}
          onMouseLeave={e => e.currentTarget.style.color=T.text4}>×</button>
      </div>
    </div>
  );
}

function TradesTab({ trades, loading, navigate, onDelete, onFeeUpdate, onNoteUpdate, onReplay }) {
  const [filter,    setFilter]    = useState('ALL');
  const [timeRange, setTimeRange] = useState('ALL');
  const [tagFilter, setTagFilter] = useState(null);
  const [search,    setSearch]    = useState('');

  const todayStr = new Date().toISOString().slice(0,10);
  const weekAgo  = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const now      = new Date();

  const timeFiltered = trades.filter(t => {
    if (timeRange==='ALL') return true; if(!t.date) return false;
    if (timeRange==='TODAY') return t.date===todayStr;
    if (timeRange==='WEEK')  return t.date>=weekAgo;
    if (timeRange==='MONTH') { const d=new Date(t.date+'T00:00:00'); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }
    return true;
  });
  const filtered = timeFiltered.filter(t => {
    if (filter==='ALL') return true;
    const net=getNet(t);
    if (filter==='WIN')  return net!=null&&net>0;
    if (filter==='LOSS') return net!=null&&net<0;
    if (filter==='BE')   return net!=null&&net===0;
    return true;
  }).filter(t => {
    if (!tagFilter) return true;
    return t.tags && t.tags.split(',').map(s=>s.trim()).includes(tagFilter);
  }).filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.pair||'').toLowerCase().includes(q)
      || (t.direction||'').toLowerCase().includes(q)
      || (t.notes||'').toLowerCase().includes(q)
      || (t.tags||'').toLowerCase().includes(q)
      || (t.date||'').includes(q);
  });

  const allTags = [...new Set(timeFiltered.flatMap(t => t.tags ? t.tags.split(',').map(s=>s.trim()).filter(Boolean) : []))].sort();

  const counts = {
    ALL: timeFiltered.length,
    WIN: timeFiltered.filter(t=>(getNet(t)??0)>0).length,
    LOSS:timeFiltered.filter(t=>(getNet(t)??0)<0).length,
    BE:  timeFiltered.filter(t=>(getNet(t)??0)===0).length,
  };
  const totalFees = filtered.reduce((s,t)=>s+(t.fees??0)+(t.commissions??0),0);

  const groups = {};
  filtered.forEach(t => { const d=t.date??'unknown'; if(!groups[d]) groups[d]=[]; groups[d].push(t); });
  const sortedGroups = Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));

  return (
    <div>
      {/* Filters */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'14px', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'4px' }}>
          {[['ALL','Tout'],['TODAY',"Auj."],['WEEK','7j'],['MONTH','Ce mois']].map(([v,l]) => (
            <button key={v} onClick={() => setTimeRange(v)} style={{ padding:'5px 12px', borderRadius:'20px', border:`1px solid ${timeRange===v?`${T.border}0.50)`:`${T.border}0.12)`}`, background:timeRange===v?`${T.border}0.12)`:'transparent', color:timeRange===v?T.text1:T.text3, fontSize:'12px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.15s', fontWeight:timeRange===v?'700':'400' }}>{l}</button>
          ))}
        </div>
        <div style={{ width:'1px', height:'18px', background:`${T.border}0.15)` }} />
        <div style={{ display:'flex', gap:'4px' }}>
          {[['ALL','Tous','#8899bb'],['WIN','Wins','#00cc77'],['LOSS','Losses','#ff3344'],['BE','BE','#f0a020']].map(([v,l,c]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding:'5px 12px', borderRadius:'20px', border:`1px solid ${filter===v?c:`${T.border}0.12)`}`, background:filter===v?`${c}1a`:'transparent', color:filter===v?c:T.text3, fontSize:'12px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.15s', display:'flex', gap:'5px', alignItems:'center' }}>
              {l}<span style={{ fontSize:'12px', opacity:0.65 }}>({counts[v]})</span>
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <>
            <div style={{ width:'1px', height:'18px', background:`${T.border}0.15)` }} />
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {allTags.map(tag => (
                <button key={tag} onClick={() => setTagFilter(tagFilter===tag ? null : tag)}
                  style={{ padding:'3px 9px', borderRadius:'20px', fontSize:'11px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.15s',
                    border:`1px solid ${tagFilter===tag?'rgba(124,58,237,0.55)':'rgba(124,58,237,0.22)'}`,
                    background:tagFilter===tag?'rgba(124,58,237,0.18)':'transparent',
                    color:tagFilter===tag?'#a78bfa':'#7c5abb' }}>
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px' }}>
          {totalFees > 0 && (
            <span style={{ fontSize:'12px', color:'#f0a020' }}>Frais : -{totalFees.toFixed(2)}$</span>
          )}
          {filtered.length > 0 && (
            <button
              onClick={() => {
                const date = new Date().toISOString().slice(0,10);
                exportCsv(filtered, `trades_${date}.csv`);
                window.dispatchEvent(new CustomEvent('toast', { detail: { msg:`${filtered.length} trade${filtered.length>1?'s':''} exportés en CSV`, icon:'↓' } }));
              }}
              title="Exporter en CSV"
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px', borderRadius:'4px', border:'1px solid rgba(136,153,187,0.18)', background:'transparent', color:'#5a6a82', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color='#8899bb'; e.currentTarget.style.borderColor='rgba(136,153,187,0.40)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='#5a6a82'; e.currentTarget.style.borderColor='rgba(136,153,187,0.18)'; }}
            >
              ↓ CSV
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
        <div style={{ position:'relative', maxWidth:'320px', flex:1 }}>
          <input
            type="text"
            placeholder="Rechercher paire, notes, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background:'rgba(14,15,22,0.6)', border:'1px solid rgba(136,153,187,0.14)', borderRadius:'5px', padding:'6px 28px 6px 28px', color:'#dde4ef', fontSize:'12px', fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box', transition:'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'rgba(136,153,187,0.35)'}
            onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'}
          />
          <span style={{ position:'absolute', left:'9px', top:'50%', transform:'translateY(-50%)', color:'#3a4a5a', fontSize:'13px', pointerEvents:'none' }}>⌕</span>
          {search && (
            <button onClick={() => setSearch('')} style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', background:'transparent', border:'none', color:'#5a6a82', cursor:'pointer', fontSize:'15px', padding:'0', lineHeight:1 }}>×</button>
          )}
        </div>
        {search && <span style={{ fontSize:'12px', color:'#5a6a82' }}>{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>}
      </div>

      {loading
        ? <div style={{ padding:'48px', textAlign:'center', color:T.text3, fontSize:'13px', letterSpacing:'2px' }}>CHARGEMENT...</div>
        : filtered.length === 0
          ? <div style={{ padding:'48px', textAlign:'center', border:`1px dashed ${T.border}0.15)`, borderRadius:'6px', color:T.text4, fontSize:'13px', letterSpacing:'2px' }}>
              {filter==='ALL'&&timeRange==='ALL'&&!tagFilter&&!search ? 'Aucun trade — commencez à journaliser !' : 'Aucun trade pour ces filtres'}
            </div>
          : sortedGroups.map(([date, dayTrades]) => (
              <div key={date}>
                <DayHeader date={date} dayTrades={dayTrades} />
                {/* En-têtes directement au-dessus des trades */}
                <div style={{ display:'grid', gridTemplateColumns:'3px 1fr auto', borderBottom:`1px solid ${T.border}0.12)`, marginBottom:'2px' }}>
                  <div />
                  <div style={{ padding:'4px 14px', display:'grid', gridTemplateColumns:'110px 68px 90px 90px 60px 1fr 115px 85px 56px', gap:'8px', fontSize:'11px', color:T.text3, letterSpacing:'1.5px' }}>
                    <span>PAIRE</span><span>DIR.</span><span>ENTRÉE</span><span>SORTIE</span><span>DURÉE</span><span>NOTES</span><span>P&L NET</span><span>FRAIS</span><span>TAGS</span>
                  </div>
                  <div style={{ width:'40px' }} />
                </div>
                {dayTrades.map(t => (
                  <TradeRow key={t.id} trade={t} onDelete={onDelete} onFeeUpdate={onFeeUpdate} onNoteUpdate={onNoteUpdate} onClick={() => navigate(`/journal/${t.id}`)} onReplay={onReplay} />
                ))}
              </div>
            ))
      }
    </div>
  );
}

// ── GRAPHIQUES TAB ────────────────────────────────────────────
function GraphiquesTab({ trades, loading }) {
  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:T.text3, fontSize:'13px', letterSpacing:'2px' }}>CHARGEMENT...</div>;

  // Equity curve (by trade)
  let cum = 0;
  const equityData = [...trades]
    .sort((a,b) => (a.date??'').localeCompare(b.date??'')||a.id-b.id)
    .map((t,i) => { cum+=getNet(t)??0; return { i:i+1, date:t.date, cum:Math.round(cum*100)/100, pnl:Math.round((getNet(t)??0)*100)/100 }; });

  const totalPnl = trades.reduce((s,t)=>s+(getNet(t)??0),0);

  // P&L par mois
  const monthMap = {};
  trades.forEach(t => {
    if(!t.date) return;
    const key = t.date.slice(0,7);
    monthMap[key] = (monthMap[key]??0)+(getNet(t)??0);
  });
  const monthData = Object.entries(monthMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v]) => ({
    month: new Date(k+'-01').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),
    pnl: Math.round(v*100)/100,
  }));

  // P&L par pair
  const pairMap = {};
  trades.forEach(t => {
    const p=t.pair??'?'; pairMap[p]=(pairMap[p]??0)+(getNet(t)??0);
  });
  const pairData = Object.entries(pairMap).sort((a,b)=>b[1]-a[1]).map(([p,v])=>({ pair:p, pnl:Math.round(v*100)/100 }));

  // P&L par DOW
  const dowMap = Array.from({length:7},(_,i)=>({day:DOW[i],pnl:0,n:0}));
  trades.forEach(t => { if(!t.date) return; const d=new Date(t.date+'T00:00:00').getDay(); dowMap[d].pnl+=getNet(t)??0; dowMap[d].n++; });
  const dowData = [1,2,3,4,5].map(i=>({ day:DOW[i], pnl:Math.round(dowMap[i].pnl*100)/100 }));

  // P&L par heure de la journée
  const hourMap = {};
  trades.forEach(t => {
    if (!t.entered_at) return;
    const h = new Date(t.entered_at).getHours();
    if (!hourMap[h]) hourMap[h] = { pnl:0, n:0, w:0 };
    hourMap[h].pnl += getNet(t)??0;
    hourMap[h].n++;
    if ((getNet(t)??0) > 0) hourMap[h].w++;
  });
  const hourData = Object.entries(hourMap)
    .sort((a,b) => +a[0] - +b[0])
    .map(([h,d]) => ({ hour:`${String(h).padStart(2,'0')}h`, pnl:Math.round(d.pnl*100)/100, n:d.n, wr:Math.round((d.w/d.n)*100) }));

  // Drawdown
  let peak = 0;
  const drawdownData = equityData.map(pt => {
    peak = Math.max(peak, pt.cum);
    return { i:pt.i, dd: Math.round((pt.cum - peak)*100)/100 };
  });
  const maxDD = drawdownData.length ? Math.min(...drawdownData.map(d=>d.dd)) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* Equity curve full */}
      <div>
        <SectionTitle>COURBE D'ÉQUITÉ (TRADE PAR TRADE)</SectionTitle>
        <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'20px', height:'260px' }}>
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top:5, right:20, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="eqFull" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={totalPnl>=0?'#00cc77':'#ff3344'} stopOpacity={0.30} />
                    <stop offset="95%" stopColor={totalPnl>=0?'#00cc77':'#ff3344'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} vertical={false} />
                <XAxis dataKey="i" tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?'+':''}${v}$`} width={60} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke={`${T.border}0.20)`} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="cum" name="Équité" stroke={totalPnl>=0?'#00cc77':'#ff3344'} strokeWidth={2} fill="url(#eqFull)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.text3, fontSize:'13px' }}>Pas assez de données</div>}
        </div>
      </div>

      {/* Monthly + DOW */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
        <div>
          <SectionTitle>P&L PAR MOIS</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'16px', height:'200px' }}>
            {monthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize:9, fill:T.text2 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?'+':''}${v}$`} width={55} />
                  <Tooltip content={<CTooltip />} />
                  <ReferenceLine y={0} stroke={`${T.border}0.15)`} />
                  <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} maxBarSize={6}>
                    {monthData.map((d,i) => <Cell key={i} fill={pnlColor(d.pnl)} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.text3, fontSize:'13px' }}>Pas assez de données</div>}
          </div>
        </div>

        <div>
          <SectionTitle>P&L PAR JOUR DE SEMAINE</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'16px', height:'200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize:10, fill:T.text2 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?'+':''}${v}$`} width={50} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke={`${T.border}0.15)`} />
                <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} maxBarSize={6}>
                  {dowData.map((d,i) => <Cell key={i} fill={pnlColor(d.pnl)} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* P&L by pair */}
      <div>
        <SectionTitle>P&L PAR INSTRUMENT</SectionTitle>
        <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'16px', height:'220px' }}>
          {pairData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pairData} layout="vertical" margin={{ top:5, right:20, left:10, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} horizontal={false} />
                <XAxis type="number" tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?'+':''}${v}$`} />
                <YAxis type="category" dataKey="pair" tick={{ fontSize:10, fill:T.text2 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine x={0} stroke={`${T.border}0.18)`} />
                <Bar dataKey="pnl" name="P&L" radius={[0,3,3,0]} maxBarSize={6}>
                  {pairData.map((d,i) => <Cell key={i} fill={pnlColor(d.pnl)} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:T.text3, fontSize:'13px' }}>Pas assez de données</div>}
        </div>
      </div>

      {/* P&L by hour of day */}
      {hourData.length > 0 && (
        <div>
          <SectionTitle>P&L PAR HEURE D'ENTRÉE</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'16px', height:'220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.08)`} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize:9, fill:T.text2 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?'+':''}${v}$`} width={55} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background:'rgba(8,9,16,0.97)', border:'1px solid rgba(136,153,187,0.22)', borderRadius:'4px', padding:'8px 12px', fontSize:'12px', fontFamily:'inherit' }}>
                      <div style={{ color:'#5a6a82', marginBottom:'4px' }}>{label}</div>
                      <div style={{ color:pnlColor(d?.pnl), fontWeight:'700' }}>{d?.pnl>=0?'+':''}{d?.pnl?.toFixed(2)}$</div>
                      <div style={{ color:'#5a6a82', fontSize:'11px' }}>{d?.n} trade{d?.n>1?'s':''} · {d?.wr}% WR</div>
                    </div>
                  );
                }} />
                <ReferenceLine y={0} stroke={`${T.border}0.18)`} />
                <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} maxBarSize={22}>
                  {hourData.map((d,i) => <Cell key={i} fill={pnlColor(d.pnl)} fillOpacity={0.82} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Drawdown chart */}
      {drawdownData.length > 2 && maxDD < 0 && (
        <div>
          <SectionTitle>DRAWDOWN</SectionTitle>
          <div style={{ background:`${T.bg}0.60)`, border:`1px solid rgba(255,51,68,0.12)`, borderRadius:'8px', padding:'16px', height:'180px' }}>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'4px' }}>
              <span style={{ fontSize:'11px', color:'#ff3344' }}>Max DD : {maxDD.toFixed(2)}$</span>
            </div>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={drawdownData} margin={{ top:0, right:10, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ff3344" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ff3344" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${T.border}0.06)`} vertical={false} />
                <XAxis dataKey="i" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:T.text3 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}$`} width={55} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div style={{ background:'rgba(8,9,16,0.97)', border:'1px solid rgba(255,51,68,0.25)', borderRadius:'4px', padding:'6px 10px', fontSize:'12px', fontFamily:'inherit' }}>
                      <span style={{ color:'#ff7788' }}>DD: {payload[0]?.value?.toFixed(2)}$</span>
                    </div>
                  );
                }} />
                <ReferenceLine y={0} stroke={`${T.border}0.20)`} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="dd" name="Drawdown" stroke="#ff3344" strokeWidth={1.5} fill="url(#ddGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HEAT MAP + PATTERNS (fusionné) ───────────────────────────
function HeatMapPatterns({ trades, loading }) {
  if (loading || !trades.length) return null;

  const HOURS  = Array.from({ length: 13 }, (_, i) => i + 7); // 7h..19h
  const DOWS   = [1, 2, 3, 4, 5];
  const DOW_L  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

  // ── Heatmap cells: {dow}_{hour} ──────────────────────────
  const cells = {};
  trades.forEach(t => {
    if (!t.entered_at) return;
    const d = new Date(t.entered_at);
    const dow = d.getDay(); const h = d.getHours();
    if (!DOWS.includes(dow) || h < 7 || h > 19) return;
    const key = `${dow}_${h}`;
    if (!cells[key]) cells[key] = { pnl: 0, n: 0, w: 0 };
    cells[key].pnl += getNet(t) ?? 0; cells[key].n++;
    if ((getNet(t) ?? 0) > 0) cells[key].w++;
  });
  const maxAbs = Math.max(...Object.values(cells).map(c => Math.abs(c.pnl)), 1);

  // Agrégats heure / jour
  const hourAgg = {};
  HOURS.forEach(h => {
    let pnl = 0, n = 0;
    DOWS.forEach(d => { const c = cells[`${d}_${h}`]; if (c) { pnl += c.pnl; n += c.n; } });
    hourAgg[h] = { pnl, n, avg: n > 0 ? pnl / n : 0 };
  });
  const dowAgg = {};
  DOWS.forEach(d => {
    let pnl = 0, n = 0;
    HOURS.forEach(h => { const c = cells[`${d}_${h}`]; if (c) { pnl += c.pnl; n += c.n; } });
    dowAgg[d] = { pnl, n };
  });

  const withTrades = Object.entries(hourAgg).filter(([, d]) => d.n > 0);
  const bestHour  = withTrades.length ? withTrades.reduce((a, b) => b[1].avg > a[1].avg ? b : a) : null;
  const worstHour = withTrades.length ? withTrades.reduce((a, b) => b[1].avg < a[1].avg ? b : a) : null;
  const bestDow   = DOWS.filter(d => dowAgg[d].n > 0).reduce((a, b) => dowAgg[b].pnl > dowAgg[a].pnl ? b : a, DOWS[0]);

  // ── Patterns: pair × direction ────────────────────────────
  const patMap = {};
  trades.forEach(t => {
    if (!t.pair || !t.direction) return;
    const key = `${t.pair}|${t.direction}`;
    if (!patMap[key]) patMap[key] = { pair: t.pair, dir: t.direction, pnl: 0, n: 0, w: 0 };
    patMap[key].pnl += getNet(t) ?? 0; patMap[key].n++;
    if ((getNet(t) ?? 0) > 0) patMap[key].w++;
  });
  const patterns = Object.values(patMap)
    .filter(p => p.n >= 2)
    .map(p => ({ ...p, avg: p.pnl / p.n, wr: Math.round((p.w / p.n) * 100) }))
    .sort((a, b) => b.avg - a.avg);
  const maxAvgAbs = Math.max(...patterns.map(p => Math.abs(p.avg)), 1);
  const worstPats = [...patterns].sort((a, b) => a.avg - b.avg).filter(p => p.avg < -5);

  return (
    <div style={{ background: `${T.bg}0.55)`, border: `1px solid ${T.border}0.10)`, borderRadius: '10px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '11px 18px', borderBottom: `1px solid ${T.border}0.08)`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '11px', color: T.text3, letterSpacing: '2.5px', fontWeight: '700' }}>HEAT MAP</span>
        <div style={{ width: '1px', height: '12px', background: `${T.border}0.15)` }} />
        <span style={{ fontSize: '11px', color: T.text3, letterSpacing: '2.5px', fontWeight: '700' }}>PATTERNS</span>
        <span style={{ fontSize: '11px', color: T.text4 }}>· analyse horaire & setups récurrents</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

        {/* ── LEFT: Heat Map ── */}
        <div style={{ padding: '16px 18px', borderRight: `1px solid ${T.border}0.08)` }}>
          <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '2px', marginBottom: '10px', fontWeight: '600' }}>HEURE × JOUR DE SEMAINE</div>
          {/* Col headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '22px repeat(5,1fr)', gap: '3px', marginBottom: '3px' }}>
            <div />
            {DOW_L.map((d, i) => {
              const col = dowAgg[DOWS[i]]?.n > 0 ? (dowAgg[DOWS[i]].pnl >= 0 ? '#00cc77' : '#ff4455') : T.text4;
              return <div key={i} style={{ textAlign: 'center', fontSize: '10px', color: col, fontWeight: '700' }}>{d}</div>;
            })}
          </div>
          {/* Grid rows */}
          {HOURS.map(h => {
            const hd = hourAgg[h];
            return (
              <div key={h} style={{ display: 'grid', gridTemplateColumns: '22px repeat(5,1fr)', gap: '3px', marginBottom: '3px' }}>
                <div style={{ fontSize: '9px', color: T.text3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '3px', opacity: hd?.n > 0 ? 1 : 0.45 }}>{h}h</div>
                {DOWS.map((dow, di) => {
                  const c = cells[`${dow}_${h}`];
                  let bg = `rgba(136,153,187,0.04)`;
                  let title = `${DOW_L[di]} ${h}h — aucun trade`;
                  if (c) {
                    const int = Math.min(Math.abs(c.pnl) / maxAbs, 1);
                    bg = c.pnl >= 0
                      ? `rgba(0,204,119,${(0.10 + int * 0.52).toFixed(2)})`
                      : `rgba(255,51,68,${(0.10 + int * 0.52).toFixed(2)})`;
                    title = `${DOW_L[di]} ${h}h · ${fmt(c.pnl, true)} · ${c.n}t · ${Math.round((c.w/c.n)*100)}%WR`;
                  }
                  return (
                    <div key={dow} title={title}
                      style={{ height: '19px', borderRadius: '3px', background: bg, cursor: c ? 'default' : 'default', transition: 'opacity 0.12s' }}
                      onMouseEnter={e => { if (c) e.currentTarget.style.opacity = '0.70'; }}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    />
                  );
                })}
              </div>
            );
          })}
          {/* Legend + insights */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '10px', color: T.text4 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(0,204,119,0.5)', display: 'inline-block' }} /> Profit
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255,51,68,0.5)', display: 'inline-block', marginLeft: '4px' }} /> Perte
            </div>
            {bestHour && <span style={{ fontSize: '10px', color: T.text3 }}>✓ <span style={{ color: '#00cc77', fontWeight: '600' }}>{bestHour[0]}h</span></span>}
            {worstHour && bestHour && bestHour[0] !== worstHour[0] && <span style={{ fontSize: '10px', color: T.text3 }}>✗ <span style={{ color: '#ff4455', fontWeight: '600' }}>{worstHour[0]}h</span></span>}
            {bestDow && dowAgg[bestDow]?.n > 0 && <span style={{ fontSize: '10px', color: T.text3 }}>Jour top : <span style={{ color: '#00cc77', fontWeight: '600' }}>{DOW_L[DOWS.indexOf(bestDow)]}</span></span>}
          </div>
        </div>

        {/* ── RIGHT: Patterns ── */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '2px', marginBottom: '6px', fontWeight: '600' }}>SETUPS RÉCURRENTS</div>
          {patterns.length === 0 ? (
            <div style={{ color: T.text4, fontSize: '12px', padding: '32px 0', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Pas assez de données<br /><span style={{ fontSize: '11px', marginTop: '4px', display: 'block' }}>min. 2 trades par setup</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {patterns.slice(0, 7).map(p => {
                  const isLong = p.dir === 'LONG';
                  const col    = pnlColor(p.avg);
                  const barW   = Math.round((Math.abs(p.avg) / maxAvgAbs) * 100);
                  return (
                    <div key={p.pair + p.dir} style={{ position: 'relative', padding: '7px 10px', borderRadius: '5px', background: `rgba(${isLong ? '0,204,119' : '255,51,68'},0.04)`, border: `1px solid rgba(${isLong ? '0,204,119' : '255,51,68'},0.12)`, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barW}%`, background: `${p.avg >= 0 ? 'rgba(0,204,119,' : 'rgba(255,51,68,'}0.07)`, zIndex: 0 }} />
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: T.text1, minWidth: '42px' }}>{p.pair}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: isLong ? '#00cc77' : '#ff3344', background: `rgba(${isLong ? '0,204,119' : '255,51,68'},0.12)`, border: `1px solid rgba(${isLong ? '0,204,119' : '255,51,68'},0.22)`, padding: '1px 5px', borderRadius: '3px' }}>{p.dir}</span>
                        <span style={{ fontSize: '11px', color: T.text3, flex: 1 }}>{p.n}x · <span style={{ color: p.wr >= 50 ? '#00cc77' : '#ff3344', fontWeight: '600' }}>{p.wr}%WR</span></span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: col }}>{p.avg >= 0 ? '+' : ''}{p.avg.toFixed(0)}$<span style={{ fontSize: '10px', color: T.text4, fontWeight: '400' }}>/t</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {worstPats.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${T.border}0.07)` }}>
                  <div style={{ fontSize: '10px', color: '#ff7788', letterSpacing: '1.5px', marginBottom: '5px', opacity: 0.8 }}>⚠ À ÉVITER</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {worstPats.slice(0, 2).map(p => (
                      <div key={p.pair + p.dir + 'w'} style={{ padding: '5px 10px', borderRadius: '4px', background: 'rgba(255,51,68,0.05)', border: '1px solid rgba(255,51,68,0.14)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: T.text2 }}>{p.pair}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#ff3344', background: 'rgba(255,51,68,0.10)', padding: '1px 5px', borderRadius: '3px' }}>{p.dir}</span>
                        <span style={{ fontSize: '11px', color: T.text3 }}>{p.n}x</span>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: '700', color: '#ff3344' }}>{p.avg.toFixed(0)}$/t</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RISK MANAGER ──────────────────────────────────────────────
function RiskManager({ trades, account, loading }) {
  const [settings, setSettings] = useState(() => {
    try { const s = localStorage.getItem('rm_settings'); return s ? JSON.parse(s) : { dailyLimit: 500, riskPct: 1, targetRR: 2 }; }
    catch { return { dailyLimit: 500, riskPct: 1, targetRR: 2 }; }
  });
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(settings);

  function saveSettings() {
    setSettings(draft);
    localStorage.setItem('rm_settings', JSON.stringify(draft));
    setEditing(false);
  }

  if (loading) return null;

  const todayStr    = new Date().toISOString().slice(0, 10);
  const todayTrades = trades.filter(t => t.date === todayStr);
  const todayPnl    = todayTrades.reduce((s, t) => s + (getNet(t) ?? 0), 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekStr    = weekStart.toISOString().slice(0, 10);
  const weekTrades = trades.filter(t => t.date >= weekStr);
  const weekPnl    = weekTrades.reduce((s, t) => s + (getNet(t) ?? 0), 0);
  const weekWR     = weekTrades.length > 0 ? Math.round(weekTrades.filter(t => (getNet(t) ?? 0) > 0).length / weekTrades.length * 100) : 0;

  // Consecutive losses (most recent trades first)
  const sorted = [...trades].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id);
  let consLosses = 0;
  for (const t of sorted) { if ((getNet(t) ?? 0) < 0) consLosses++; else break; }

  // Daily risk status
  const dailyLossUsed = Math.max(0, -todayPnl);
  const dailyLossPct  = Math.min(100, (dailyLossUsed / settings.dailyLimit) * 100);
  const shouldStop     = todayPnl <= -settings.dailyLimit;
  const ddCol          = dailyLossPct >= 80 ? '#ff3344' : dailyLossPct >= 50 ? '#f59e0b' : '#00cc77';

  // Sizing
  const accountSize  = account?.typeInfo?.size ?? 50000;
  const riskPerTrade = accountSize * (settings.riskPct / 100);

  // Global stats
  const wins   = trades.filter(t => (getNet(t) ?? 0) > 0);
  const losses = trades.filter(t => (getNet(t) ?? 0) < 0);
  const wr     = trades.length > 0 ? Math.round(wins.length / trades.length * 100) : 0;
  const rrs    = trades.filter(t => t.rr && !isNaN(parseFloat(t.rr))).map(t => parseFloat(t.rr));
  const avgRR  = rrs.length > 0 ? rrs.reduce((s, v) => s + v, 0) / rrs.length : null;

  // Kelly criterion
  const avgWin  = wins.length  > 0 ? wins.reduce((s, t)  => s + (getNet(t) ?? 0), 0) / wins.length   : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (getNet(t) ?? 0), 0)) / losses.length : 0;
  const kellyPct = avgLoss > 0 && wins.length > 0
    ? Math.max(0, Math.round(((wins.length / trades.length) - (losses.length / trades.length) / (avgWin / avgLoss)) * 100))
    : 0;

  return (
    <div style={{ background: `${T.bg}0.55)`, border: `1px solid ${T.border}0.10)`, borderRadius: '10px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '11px 18px', borderBottom: `1px solid ${T.border}0.08)`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '11px', color: T.text3, letterSpacing: '2.5px', fontWeight: '700' }}>RISK MANAGER</span>
        <span style={{ fontSize: '11px', color: T.text4 }}>· gestion du risque & sizing</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', background: shouldStop ? 'rgba(255,51,68,0.12)' : 'rgba(0,204,119,0.10)', border: `1px solid ${shouldStop ? 'rgba(255,51,68,0.35)' : 'rgba(0,204,119,0.30)'}`, color: shouldStop ? '#ff3344' : '#00cc77' }}>
            {shouldStop ? '⛔ STOP TRADING' : '✓ CONTINUER'}
          </div>
          <button onClick={() => { setDraft(settings); setEditing(e => !e); }}
            style={{ background: 'transparent', border: `1px solid ${T.border}0.18)`, color: T.text3, padding: '4px 9px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text1; e.currentTarget.style.borderColor = `${T.border}0.35)`; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.text3; e.currentTarget.style.borderColor = `${T.border}0.18)`; }}>
            ⚙ Réglages
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {editing && (
        <div style={{ padding: '12px 18px', background: `rgba(136,153,187,0.04)`, borderBottom: `1px solid ${T.border}0.08)`, display: 'flex', gap: '18px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {[
            { key: 'dailyLimit', label: 'Limite perte/jour ($)', min: 50,  max: 10000, step: 50 },
            { key: 'riskPct',    label: 'Risque/trade (%)',       min: 0.1, max: 5,     step: 0.1 },
            { key: 'targetRR',   label: 'R:R cible',              min: 0.5, max: 5,     step: 0.5 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
              <input type="number" min={min} max={max} step={step} value={draft[key]}
                onChange={e => setDraft(prev => ({ ...prev, [key]: parseFloat(e.target.value) || prev[key] }))}
                style={{ width: '95px', background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.25)', borderRadius: '4px', padding: '5px 8px', color: T.text1, fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={saveSettings} style={{ padding: '6px 14px', background: 'rgba(0,204,119,0.12)', border: '1px solid rgba(0,204,119,0.30)', color: '#00cc77', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: '700' }}>✓ Sauvegarder</button>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${T.border}0.18)`, color: T.text3, borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* Cards grid */}
      <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '12px' }}>

        {/* Daily risk card */}
        <div style={{ background: `rgba(${shouldStop ? '255,51,68' : '136,153,187'},0.05)`, border: `1px solid rgba(${shouldStop ? '255,51,68' : '136,153,187'},0.13)`, borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '1.8px', marginBottom: '8px' }}>RISQUE JOURNALIER</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: pnlColor(todayPnl), lineHeight: 1, marginBottom: '6px', letterSpacing: '-0.5px' }}>
            {todayPnl >= 0 ? '+' : ''}{todayPnl.toFixed(2)}<span style={{ fontSize: '13px' }}>$</span>
          </div>
          <div style={{ fontSize: '11px', color: T.text3, marginBottom: '7px' }}>
            Limite : <span style={{ color: '#8899bb' }}>-{settings.dailyLimit}$</span>
            {dailyLossUsed > 0 && <span style={{ color: ddCol, marginLeft: '6px', fontWeight: '600' }}>{dailyLossPct.toFixed(0)}% utilisé</span>}
          </div>
          <div style={{ height: '4px', background: 'rgba(136,153,187,0.10)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dailyLossPct}%`, background: ddCol, borderRadius: '2px', transition: 'width 0.6s ease', boxShadow: `0 0 5px ${ddCol}50` }} />
          </div>
          <div style={{ fontSize: '11px', color: T.text4, marginTop: '6px' }}>
            {todayTrades.length} trade{todayTrades.length !== 1 ? 's' : ''} aujourd'hui
          </div>
        </div>

        {/* Position sizing */}
        <div style={{ background: `${T.bg}0.40)`, border: `1px solid ${T.border}0.10)`, borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '1.8px', marginBottom: '8px' }}>POSITION SIZING</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#8899bb', lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.5px' }}>
            {riskPerTrade.toFixed(0)}<span style={{ fontSize: '13px' }}>$</span>
          </div>
          <div style={{ fontSize: '11px', color: T.text3, marginBottom: '10px' }}>
            risque max/trade · {settings.riskPct}% du compte
          </div>
          {kellyPct > 0 && (
            <div style={{ fontSize: '11px', color: T.text3, padding: '5px 8px', background: 'rgba(136,153,187,0.06)', borderRadius: '4px', border: `1px solid ${T.border}0.08)` }}>
              Kelly : <span style={{ color: T.accentL, fontWeight: '600' }}>{Math.min(kellyPct, 25)}%</span>
              <span style={{ color: T.text4, fontSize: '10px' }}> (plafonné 25%)</span>
            </div>
          )}
        </div>

        {/* Performance globale */}
        <div style={{ background: `${T.bg}0.40)`, border: `1px solid ${T.border}0.10)`, borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '1.8px', marginBottom: '8px' }}>PERFORMANCE GLOBALE</div>
          <div style={{ display: 'flex', gap: '14px', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: T.text4, marginBottom: '2px' }}>WIN RATE</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: wr >= 50 ? '#00cc77' : '#ff3344', lineHeight: 1 }}>{wr}%</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: T.text4, marginBottom: '2px' }}>R:R MOY.</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: avgRR != null ? (avgRR >= settings.targetRR ? '#00cc77' : '#f59e0b') : T.text3, lineHeight: 1 }}>
                {avgRR != null ? avgRR.toFixed(2) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: T.text4, marginBottom: '2px' }}>CIBLE</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: T.text3, lineHeight: 1 }}>{settings.targetRR}</div>
            </div>
          </div>
          {consLosses >= 2 && (
            <div style={{ padding: '5px 8px', background: 'rgba(255,51,68,0.07)', border: '1px solid rgba(255,51,68,0.18)', borderRadius: '4px', fontSize: '11px', color: '#ff7788' }}>
              ⚠ {consLosses} pertes consécutives
            </div>
          )}
        </div>

        {/* Semaine */}
        <div style={{ background: `${T.bg}0.40)`, border: `1px solid ${T.border}0.10)`, borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '10px', color: T.text3, letterSpacing: '1.8px', marginBottom: '8px' }}>SEMAINE EN COURS</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: pnlColor(weekPnl), lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.5px' }}>
            {weekPnl >= 0 ? '+' : ''}{weekPnl.toFixed(2)}<span style={{ fontSize: '13px' }}>$</span>
          </div>
          <div style={{ fontSize: '11px', color: T.text3, marginBottom: '6px' }}>
            {weekTrades.length} trade{weekTrades.length !== 1 ? 's' : ''} cette semaine
          </div>
          {weekTrades.length > 0 && (
            <div style={{ fontSize: '11px', color: T.text3 }}>
              WR semaine : <span style={{ color: weekWR >= 50 ? '#00cc77' : '#ff3344', fontWeight: '600' }}>{weekWR}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
const PF_TARGETS  = { topstep_50k:3000, topstep_100k:6000, topstep_150k:9000, lucid_eval_25k:1250, lucid_eval_50k:3000, lucid_eval_100k:6000, lucid_eval_150k:9000, tradovate_live:3000 };
const PF_MAXLOSS  = { topstep_50k:2000, topstep_100k:3000, topstep_150k:4500, lucid_eval_25k:1000, lucid_eval_50k:2000, lucid_eval_100k:3000, lucid_eval_150k:4500, tradovate_live:2000 };

export default function Journal() {
  const [trades,      setTrades]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [replayTrade, setReplayTrade] = useState(null);
  const [account,     setAccount]     = useState(null);
  const [stats,       setStats]       = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadTrades(); }, []);

  async function loadTrades() {
    setLoading(true);
    const [aRes, sRes] = await Promise.all([window.accounts.getActive(), window.db.getStats()]);
    if (aRes.ok) setAccount(aRes.data);
    if (sRes.ok) setStats(sRes.data);
    const res = await window.db.getAllTrades();
    if (res.ok) setTrades(res.data.sort((a,b) => (b.date??'').localeCompare(a.date??'')||b.id-a.id));
    setLoading(false);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce trade ?')) return;
    await window.db.deleteTrade(id);
    setTrades(prev => prev.filter(t => t.id !== id));
    window.dispatchEvent(new CustomEvent('trades-changed'));
  }

  function handleFeeUpdate(id, patch) {
    setTrades(prev => prev.map(t => t.id===id ? {...t,...patch} : t));
  }

  function handleNoteUpdate(id, patch) {
    setTrades(prev => prev.map(t => t.id===id ? {...t,...patch} : t));
  }

  return (
    <>
    <div style={{ padding:'24px 28px', width:'100%', boxSizing:'border-box', maxWidth:'none' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'12px', color:T.text3, letterSpacing:'3px', marginBottom:'5px' }}>HUB TRADING</div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:T.text1, margin:0, letterSpacing:'-0.5px' }}>Journal</h1>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button
            onClick={() => navigate('/import')}
            style={{ background:'transparent', border:`1px solid ${T.border}0.20)`, color:T.text3, padding:'9px 14px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', letterSpacing:'1.5px', cursor:'pointer', fontWeight:'700', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'6px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=`${T.border}0.40)`; e.currentTarget.style.color=T.text1; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=`${T.border}0.20)`; e.currentTarget.style.color=T.text3; }}
          >↑ IMPORT CSV</button>
          <button
            onClick={() => navigate('/journal/new')}
            style={{ background:`${T.border}0.12)`, border:`1px solid ${T.border}0.35)`, color:T.accentL, padding:'9px 18px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', letterSpacing:'1.5px', cursor:'pointer', fontWeight:'700', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background=`${T.border}0.22)`; e.currentTarget.style.boxShadow='0 0 16px rgba(136,153,187,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background=`${T.border}0.12)`; e.currentTarget.style.boxShadow='none'; }}
          >+ NOUVEAU TRADE</button>
        </div>
      </div>

      {/* PropFirm progress (challenge accounts only) */}
      {account && stats && PF_TARGETS[account.type] && (() => {
        const target  = PF_TARGETS[account.type];
        const maxLoss = PF_MAXLOSS[account.type] ?? 2000;
        const pnl     = stats.totalPnl ?? 0;
        const profPct = Math.min(100, Math.max(0, (pnl / target) * 100));
        const worstDD = Math.min(0, pnl);
        const ddPct   = Math.min(100, Math.max(0, (Math.abs(worstDD) / maxLoss) * 100));
        const ddCol   = ddPct >= 80 ? '#ff3344' : ddPct >= 50 ? '#f59e0b' : '#00cc77';
        const profCol = pnl >= 0 ? '#00cc77' : '#ff3344';
        return (
          <div style={{ display:'flex', gap:'16px', padding:'9px 16px', background:'rgba(14,15,22,0.55)', border:'1px solid rgba(136,153,187,0.08)', borderRadius:'8px', marginBottom:'14px', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ fontSize:'11px', color:T.text3, letterSpacing:'2px', whiteSpace:'nowrap', fontWeight:'700' }}>PROPFIRM</div>
            <div style={{ flex:1, minWidth:'110px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:T.text3, marginBottom:'3px' }}>
                <span>Objectif profit</span>
                <span style={{ color:profCol, fontWeight:'700' }}>{pnl>=0?'+':''}{pnl.toFixed(0)}$ / {target}$</span>
              </div>
              <div style={{ height:'4px', background:'rgba(136,153,187,0.10)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${profPct}%`, background:profCol, borderRadius:'2px', transition:'width 0.8s ease', boxShadow:`0 0 6px ${profCol}50` }} />
              </div>
            </div>
            <div style={{ flex:1, minWidth:'110px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:T.text3, marginBottom:'3px' }}>
                <span>Drawdown utilisé</span>
                <span style={{ color:ddCol, fontWeight:'700' }}>{ddPct.toFixed(0)}% / 100%</span>
              </div>
              <div style={{ height:'4px', background:'rgba(136,153,187,0.10)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${ddPct}%`, background:ddCol, borderRadius:'2px', transition:'width 0.8s ease', boxShadow:`0 0 6px ${ddCol}50` }} />
              </div>
            </div>
            <div style={{ fontSize:'11px', color:T.text4, whiteSpace:'nowrap' }}>{account.name}</div>
          </div>
        );
      })()}

      {/* Today's performance strip */}
      {(() => {
        if (loading) return null;
        const todayStr = new Date().toISOString().slice(0,10);
        const tt = trades.filter(t => t.date === todayStr);
        if (!tt.length) return null;
        const tp  = tt.reduce((s,t) => s+(getNet(t)??0), 0);
        const tw  = tt.filter(t => (getNet(t)??0) > 0).length;
        const tl  = tt.filter(t => (getNet(t)??0) < 0).length;
        const twr = Math.round((tw / tt.length) * 100);
        const c   = tp >= 0 ? '#00cc77' : '#ff3344';
        const rgb = tp >= 0 ? '0,204,119' : '255,51,68';
        return (
          <div style={{ display:'flex', alignItems:'center', gap:'20px', padding:'10px 16px', borderRadius:'8px', marginBottom:'18px', background:`rgba(${rgb},0.055)`, border:`1px solid rgba(${rgb},0.18)`, borderLeft:`3px solid ${c}` }}>
            <div>
              <div style={{ fontSize:'10px', color:T.text3, letterSpacing:'2px', marginBottom:'1px' }}>AUJOURD'HUI</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:c, letterSpacing:'-0.5px', lineHeight:1 }}>{tp>=0?'+':''}{tp.toFixed(2)}<span style={{ fontSize:'13px', marginLeft:'2px' }}>$</span></div>
            </div>
            <div style={{ width:'1px', height:'32px', background:`${T.border}0.12)` }} />
            <div>
              <div style={{ fontSize:'10px', color:T.text3, letterSpacing:'2px', marginBottom:'1px' }}>WINRATE</div>
              <div style={{ fontSize:'16px', fontWeight:'700', color:twr>=50?'#00cc77':'#ff3344', lineHeight:1 }}>{twr}%</div>
            </div>
            <div style={{ width:'1px', height:'32px', background:`${T.border}0.12)` }} />
            <div>
              <div style={{ fontSize:'10px', color:T.text3, letterSpacing:'2px', marginBottom:'1px' }}>RÉSULTATS</div>
              <div style={{ fontSize:'14px', fontWeight:'700', color:T.text2, lineHeight:1 }}>
                <span style={{ color:'#00cc77' }}>{tw}W</span>
                <span style={{ color:T.text3, margin:'0 4px' }}>/</span>
                <span style={{ color:'#ff3344' }}>{tl}L</span>
                <span style={{ color:T.text3, fontSize:'12px', marginLeft:'5px' }}>{tt.length}T</span>
              </div>
            </div>
            <div style={{ marginLeft:'auto', fontSize:'11px', color:T.text3 }}>
              {new Date().toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
            </div>
          </div>
        );
      })()}

      {/* Synthèse — stats + equity + calendar */}
      <SyntheseTab trades={trades} loading={loading} />

      {/* Séparateur Patterns & Heat Map */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>PATTERNS & HEAT MAP</span>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
      </div>
      <HeatMapPatterns trades={trades} loading={loading} />

      {/* Séparateur Trades */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>HISTORIQUE DES TRADES</span>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
      </div>
      <TradesTab trades={trades} loading={loading} navigate={navigate} onDelete={handleDelete} onFeeUpdate={handleFeeUpdate} onNoteUpdate={handleNoteUpdate} onReplay={setReplayTrade} />

      {/* Séparateur Graphiques */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>GRAPHIQUES & ANALYSES</span>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
      </div>
      <GraphiquesTab trades={trades} loading={loading} />

      {/* Séparateur Risk Manager */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>RISK MANAGER</span>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
      </div>
      <RiskManager trades={trades} account={account} loading={loading} />
    </div>
    {replayTrade && <TradeReplay trade={replayTrade} onClose={() => setReplayTrade(null)} />}
    </>
  );
}
