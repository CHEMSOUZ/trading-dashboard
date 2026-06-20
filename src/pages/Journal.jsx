import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

// ── Redesign tokens (header / vue d'ensemble / trades / drawdown / risk manager) ──
const JT = {
  border:          'rgba(136,153,187,0.14)',   // border-tertiary
  borderSecondary: 'rgba(136,153,187,0.35)',
  surfSecondary:   'rgba(20,23,34,0.75)',      // background-secondary
  textPrimary:     '#dde4ef',
  textTertiary:    '#5a6a82',
  success:         '#1D9E75',
  danger:          '#E24B4A',
  warn:            '#BA7517',
  warnBg:          'rgba(186,117,23,0.12)',
  warnBorder:      'rgba(186,117,23,0.35)',
  radiusLg:        '10px',
  radiusMd:        '8px',
};

function JtIconUpload({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
      <path d="M7 9l5 -5l5 5" />
      <path d="M12 4l0 12" />
    </svg>
  );
}
function JtIconAlertTriangle({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.871l-8.106 -13.534a1.914 1.914 0 0 0 -3.274 0z" />
      <path d="M12 16h.01" />
    </svg>
  );
}
function JtIconX({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

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
  const color     = (net ?? 0) >= 0 ? JT.success : (net ?? 0) < 0 ? JT.danger : pnlColor(0);

  return (
    <div style={{ position:'relative', textAlign:'right' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontSize:'13px', fontWeight:'500', color, cursor: hasFees ? 'help' : 'default' }}>
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
function StatCard({ label, value, sub, color=T.text1, featured=false }) {
  const [hov, setHov] = useState(false);

  if (featured) {
    const rgb = color === '#00cc77' ? '0,204,119' : color === '#ff3344' ? '255,51,68' : '136,153,187';
    return (
      <div style={{ gridColumn:'span 2', minWidth:0, background:`linear-gradient(135deg, rgba(${rgb},0.22), rgba(${rgb},0.05))`, border:`1px solid rgba(${rgb},0.35)`, borderRadius:'8px', padding:'18px 20px' }}>
        <div style={{ fontSize:'12px', color:T.text2, letterSpacing:'1.8px', marginBottom:'8px' }}>{label}</div>
        <div style={{ fontSize:'34px', fontWeight:'800', color, letterSpacing:'-0.8px', lineHeight:1, overflowWrap:'anywhere' }}>{value}</div>
        {sub && <div style={{ fontSize:'12px', color:T.text2, marginTop:'7px' }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? `${T.bgHov}0.75)` : `${T.bg}0.60)`, border:`1px solid ${T.border}0.10)`, borderTop:`2px solid ${color}30`, borderRadius:'7px', padding:'14px 16px', transition:'all 0.18s', transform:hov?'translateY(-1px)':'none', boxShadow:hov?`0 4px 16px rgba(0,0,0,0.3)`:'none' }}>
      <div style={{ fontSize:'11px', color:T.text3, letterSpacing:'1.8px', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'16px', fontWeight:'700', color, letterSpacing:'-0.5px', lineHeight:1 }}>{value}</div>
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
  const dirStats = ['LONG','SHORT'].map(dir => {
    const dt = trades.filter(t => t.direction === dir);
    const dp = dt.reduce((s,t) => s+(getNet(t)??0), 0);
    const dw = dt.filter(t => (getNet(t)??0) > 0);
    const dl = dt.filter(t => (getNet(t)??0) < 0);
    const grossW = dw.reduce((s,t) => s+(getNet(t)??0), 0);
    const grossL = Math.abs(dl.reduce((s,t) => s+(getNet(t)??0), 0));
    const dpf = grossL > 0 ? grossW/grossL : dw.length > 0 ? 99 : 0;
    const nets = dt.map(t => getNet(t)??0);
    return {
      dir, n:dt.length, pnl:dp,
      wr:  dt.length>0 ? Math.round((dw.length/dt.length)*100) : 0,
      avg: dt.length>0 ? dp/dt.length : 0,
      wins:dw.length, losses:dl.length,
      pf:  dpf,
      avgWin:  dw.length>0 ? grossW/dw.length : 0,
      avgLoss: dl.length>0 ? grossL/dl.length : 0,
      bestT:   nets.length>0 ? Math.max(...nets) : 0,
      worstT:  nets.length>0 ? Math.min(...nets) : 0,
    };
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

      {/* Hero */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:'10px' }}>
        <div style={{ background:'#120808', border:'0.5px solid #3a1212', borderLeft:'3px solid #E24B4A', borderRadius:JT.radiusLg, padding:'14px 16px' }}>
          <div style={{ fontSize:'11px', color:'#9a6060', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>P&L NET TOTAL</div>
          <div style={{ fontSize:'30px', fontWeight:'500', color:'#E24B4A', lineHeight:1 }}>{fmt(total,true)}</div>
          <div style={{ fontSize:'11px', color:'#9a6060', marginTop:'6px' }}>{wins.length}W · {losses.length}L</div>
        </div>
        <div style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'12px 14px' }}>
          <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>{`SÉRIE ${streakType??'—'}`}</div>
          <div style={{ fontSize:'20px', fontWeight:'500', color:streakType==='W'?JT.success:streakType==='L'?JT.danger:JT.textPrimary, lineHeight:1 }}>{streak>0?`${streak}j`:'—'}</div>
        </div>
        <div style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'12px 14px' }}>
          <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>FRAIS PAYÉS</div>
          <div style={{ fontSize:'20px', fontWeight:'500', color:JT.warn, lineHeight:1 }}>{fees>0?`-${fees.toFixed(2)}$`:'0$'}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
        {[
          { label:'TRADES',         value:String(trades.length),       color:JT.textPrimary },
          { label:'WR',             value:`${winrate}%`,               color:winrate>=50?JT.success:JT.danger },
          { label:'PROFIT FACTOR',  value:pf===99?'∞':pf.toFixed(2),   color:pf>=1.5?JT.success:pf>=1?JT.textPrimary:JT.danger },
          { label:'MOY. WIN',       value:fmt(avgWin,true),            color:JT.success },
          { label:'MOY. LOSS',      value:avgLoss>0?`-${avgLoss.toFixed(2)}$`:'—', color:JT.danger },
          { label:'MEILLEUR TRADE', value:bestT!=null?fmt(bestT,true):'—', color:bestT!=null&&bestT<0?JT.danger:JT.success },
        ].map(k => (
          <div key={k.label} style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusMd, padding:'10px 12px' }}>
            <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>{k.label}</div>
            <div style={{ fontSize:'16px', fontWeight:'500', color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Long vs Short */}
      {dirStats.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${dirStats.length},1fr)`, gap:'10px' }}>
          {dirStats.map(({ dir, n, pnl, wr, avg, avgWin, avgLoss }) => {
            const isLong = dir === 'LONG';
            const dirCol = isLong ? JT.success : JT.danger;
            const stats = [
              { label:'P&L TOTAL', value:fmt(pnl,true) },
              { label:'MOY/TRADE', value:fmt(avg,true) },
              { label:'MOY. WIN',  value:avgWin>0?fmt(avgWin,true):'—' },
              { label:'MOY. LOSS', value:avgLoss>0?`-${avgLoss.toFixed(2)}$`:'—' },
            ];
            return (
              <div key={dir} style={{ border:`0.5px solid ${JT.border}`, borderRadius:JT.radiusLg, overflow:'hidden' }}>
                <div style={{ background:JT.surfSecondary, borderBottom:`0.5px solid ${JT.border}`, padding:'8px 14px', display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'14px', color:dirCol, lineHeight:1 }}>{isLong ? '↑' : '↓'}</span>
                  <span style={{ fontSize:'13px', fontWeight:'500', color:dirCol }}>{isLong ? 'Long' : 'Short'}</span>
                  <span style={{ fontSize:'12px', color:JT.textTertiary }}>{n} trade{n>1?'s':''}</span>
                  <span style={{ marginLeft:'auto', fontSize:'12px', fontWeight:'500', color:wr<40?JT.danger:JT.textTertiary }}>{wr}% WR</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
                  {stats.map(({ label, value }, i) => {
                    const numeric = parseFloat(String(value).replace(/[^-0-9.]/g, ''));
                    const valColor = value === '—' ? JT.textTertiary : numeric < 0 ? JT.danger : numeric > 0 ? JT.success : JT.textPrimary;
                    return (
                      <div key={label} style={{ padding:'10px 12px', borderRight:i<stats.length-1?`0.5px solid ${JT.border}`:'none' }}>
                        <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>{label}</div>
                        <div style={{ fontSize:'12px', fontWeight:'500', color:valColor }}>{value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Equity curve */}
      <div>
        <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>COURBE D'ÉQUITÉ</div>
        <div style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'1rem', height:'200px', boxSizing:'border-box' }}>
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
  const wr     = dayTrades.length > 0 ? Math.round((wins/dayTrades.length)*100) : 0;
  const fees   = dayTrades.reduce((s,t) => s+(t.fees??0)+(t.commissions??0), 0);
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'7px 16px', borderRadius:'5px', background:JT.surfSecondary, border:`1px solid ${JT.border}`, marginBottom:'4px', marginTop:'14px' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}>
        <span style={{ fontSize:'12px', fontWeight:'500', color:JT.textPrimary, textTransform:'capitalize' }}>{fmtDayLabel(date)}</span>
        <span style={{ fontSize:'11px', color:JT.textTertiary }}>
          {dayTrades.length} trade{dayTrades.length>1?'s':''}{fees > 0 ? ` · ${fees.toFixed(2)}$` : ''}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'11px', fontWeight:'500', color:wr>=50?JT.success:JT.danger, background:wr>=50?'rgba(29,158,117,0.12)':'rgba(226,75,74,0.12)', padding:'2px 8px', borderRadius:'99px' }}>{wr}% WR</span>
        <div style={{ fontWeight:'500', fontSize:'13px', color:dayPnl>=0?JT.success:JT.danger, minWidth:'75px', textAlign:'right' }}>{fmt(dayPnl,true)}</div>
      </div>
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

  const isLong  = trade.direction === 'LONG';
  const dirCol  = isLong ? JT.success : JT.danger;
  const dirBg   = isLong ? 'rgba(29,158,117,0.12)' : 'rgba(226,75,74,0.12)';
  const durR    = [trade.duration, trade.rr ? `R ${trade.rr}` : null].filter(Boolean).join(' · ');

  return (
    <div onClick={onClick}
      style={{ display:'grid', gridTemplateColumns:'3px 1fr auto', borderRadius:'6px', overflow:'hidden', background:'transparent', border:`1px solid ${JT.border}`, cursor:'pointer', transition:'background 0.15s', marginBottom:'3px' }}
      onMouseEnter={e => e.currentTarget.style.background=JT.surfSecondary}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <div style={{ background:color, opacity:0.75 }} />
      <div style={{ padding:'8px 10px', display:'grid', gridTemplateColumns:'110px 72px 68px 140px 1fr 115px 85px 56px', gap:'8px', alignItems:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'13px', fontWeight:'700', color:T.text1 }}>{trade.pair}</span>
          {trade.size != null && <span style={{ fontSize:'12px', color:T.text3 }}>{trade.size} contrat{trade.size>1?'s':''}</span>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
          {trade.date
            ? <>
                <span style={{ fontSize:'12px', color:T.text2, fontWeight:'600' }}>{trade.date.slice(8,10)}/{trade.date.slice(5,7)}</span>
                <span style={{ fontSize:'11px', color:T.text3 }}>{trade.date.slice(0,4)}</span>
              </>
            : <span style={{ fontSize:'12px', color:T.text4 }}>—</span>
          }
        </div>
        <span style={{ fontSize:'12px', fontWeight:'500', color:dirCol, background:dirBg, padding:'3px 7px', borderRadius:'4px', textAlign:'center', width:'fit-content' }}>{trade.direction}</span>
        {/* PRIX (entrée → sortie, durée / R) */}
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'13px', color:T.text2, fontWeight:'600' }}>{trade.entry??'—'} → {trade.exit_price??trade.tp??'—'}</span>
          {(entryTime || durR) && <span style={{ fontSize:'11px', color:T.text3 }}>{[entryTime, durR].filter(Boolean).join(' · ')}</span>}
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
            <button key={v} onClick={() => setTimeRange(v)} style={{ padding:'5px 12px', borderRadius:'99px', border:`1px solid ${timeRange===v?JT.borderSecondary:JT.border}`, background:timeRange===v?JT.surfSecondary:'transparent', color:timeRange===v?JT.textPrimary:JT.textTertiary, fontSize:'12px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.15s' }}>{l}</button>
          ))}
        </div>
        <div style={{ width:'1px', height:'18px', background:JT.border }} />
        <div style={{ display:'flex', gap:'4px' }}>
          {[['ALL','Tous'],['WIN','Wins'],['LOSS','Losses'],['BE','BE']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding:'5px 12px', borderRadius:'99px', border:`1px solid ${filter===v?JT.borderSecondary:JT.border}`, background:filter===v?JT.surfSecondary:'transparent', color:filter===v?JT.textPrimary:JT.textTertiary, fontSize:'12px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.15s', display:'flex', gap:'5px', alignItems:'center' }}>
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
        <div style={{ position:'relative', flex:1 }}>
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
                <div style={{ display:'grid', gridTemplateColumns:'3px 1fr auto', borderBottom:`1px solid ${JT.border}`, marginBottom:'2px' }}>
                  <div />
                  <div style={{ padding:'4px 10px', display:'grid', gridTemplateColumns:'110px 72px 68px 140px 1fr 115px 85px 56px', gap:'8px', fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    <span>Paire</span><span>Date</span><span>Dir.</span><span>Prix</span><span>Notes</span><span>P&L net</span><span>Frais</span><span></span>
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

// ── DRAWDOWN ANALYSIS MODULE ───────────────────────────────────
function ddFilterByPeriod(trades, period) {
  if (period === 'all') return trades;
  const days   = period === '30' ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return trades.filter(t => (t.date ?? '') >= cutoff);
}

function computeDrawdownMetrics(trades) {
  const sorted = [...trades]
    .filter(t => getNet(t) != null)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id - b.id);

  let cum = 0, peak = 0, peakDate = null, inDrawdown = false;
  let maxDD = 0, maxDDPeak = 0;
  const recoveries = [];
  const series = [];

  sorted.forEach(t => {
    const pnl = getNet(t) ?? 0;
    cum += pnl;
    series.push({ i: series.length + 1, cum: Math.round(cum * 100) / 100 });

    if (cum > peak) {
      if (inDrawdown && peakDate) {
        const days = (new Date(t.date) - new Date(peakDate)) / 86400000;
        if (days >= 0) recoveries.push(days);
      }
      peak = cum;
      peakDate = t.date;
      inDrawdown = false;
    } else if (cum < peak) {
      inDrawdown = true;
      const dd = peak - cum;
      if (dd > maxDD) { maxDD = dd; maxDDPeak = peak; }
    }
  });

  const maxDDPct        = maxDDPeak > 0 ? (maxDD / maxDDPeak) * 100 : 0;
  const avgRecoveryDays = recoveries.length ? recoveries.reduce((a, b) => a + b, 0) / recoveries.length : null;

  let losingStreaks = 0, curStreak = 0;
  sorted.forEach(t => {
    const pnl = getNet(t) ?? 0;
    if (pnl < 0) { curStreak++; }
    else { if (curStreak >= 2) losingStreaks++; curStreak = 0; }
  });
  if (curStreak >= 2) losingStreaks++;

  const fragile = maxDDPct > 10 || losingStreaks > 3;
  const pnlSeries = sorted.map(t => Math.round((getNet(t) ?? 0) * 100) / 100);

  return { maxDD, maxDDPct, avgRecoveryDays, losingStreaks, fragile, series, pnlSeries };
}

function ddParseRecommendations(text) {
  if (!text) return [];
  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean);
  const numbered = lines.filter(l => /^\d+[.):]/.test(l));
  const source   = numbered.length >= 3 ? numbered : lines;
  return source.slice(0, 3).map(l => l.replace(/^\d+[.):]\s*/, '').replace(/^[-*]\s*/, ''));
}

function DDMiniBarChart({ data }) {
  if (!data.length) return null;
  const maxAbs = Math.max(1, ...data.map(d => Math.abs(d.cum)));
  return (
    <div style={{ position:'relative', height:'120px', display:'flex', alignItems:'stretch', gap:'1px', background:`${T.bg}0.40)`, border:`1px solid ${T.border}0.08)`, borderRadius:'6px', padding:'10px 8px', boxSizing:'border-box' }}>
      <div style={{ position:'absolute', left:'8px', right:'8px', top:'50%', height:'1px', background:`${T.border}0.20)` }} />
      {data.map((d, i) => {
        const h     = Math.max(1, (Math.abs(d.cum) / maxAbs) * 50);
        const color = d.cum >= 0 ? '#00cc77' : '#ff3344';
        return (
          <div key={i} title={`#${d.i}: ${fmt(d.cum, true)}`} style={{ flex:1, position:'relative', minWidth:'1px' }}>
            <div style={{ position:'absolute', left:0, right:0, [d.cum >= 0 ? 'bottom' : 'top']:'50%', height:`${h}%`, background:color, opacity:0.85, borderRadius:'1px' }} />
          </div>
        );
      })}
    </div>
  );
}

function DrawdownAnalysisModule({ trades, loading }) {
  const [period,          setPeriod]          = useState('30');
  const [metrics,         setMetrics]         = useState(null);
  const [aiLoading,       setAiLoading]       = useState(false);
  const [aiError,         setAiError]         = useState(null);
  const [quotaResetDate,  setQuotaResetDate]  = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  async function handleAnalyze() {
    const filtered = ddFilterByPeriod(trades, period);
    const m = computeDrawdownMetrics(filtered);
    setMetrics(m);
    setRecommendations(null);
    setAiError(null);
    setQuotaResetDate(null);

    if (m.series.length < 2) return;

    setAiLoading(true);
    const prompt = `Voici la séquence de P&L d'une série de trades, dans l'ordre chronologique (en $) :\n[${m.pnlSeries.join(', ')}]\n\nMétriques calculées :\n- Drawdown maximum : -${m.maxDD.toFixed(2)}$ (${m.maxDDPct.toFixed(1)}% du pic d'équité)\n- Durée moyenne de recovery : ${m.avgRecoveryDays != null ? m.avgRecoveryDays.toFixed(1) + ' jours' : 'aucune recovery complète observée'}\n- Séquences perdantes consécutives (≥2 trades) : ${m.losingStreaks}\n\nRéponds avec exactement 3 recommandations, une par ligne, au format :\n1. ...\n2. ...\n3. ...`;

    try {
      const res = await window.ai.chat(
        [{ role: 'user', content: prompt }],
        'Tu es un analyste de risque trading. À partir de ces données réelles, génère exactement 3 recommandations concrètes et chiffrées pour réduire le drawdown. Sois direct, pas de généralités.'
      );
      if (!res.ok) {
        if (['unauthenticated', 'subscription_inactive', 'quota_exceeded'].includes(res.error)) {
          setAiError(res.error);
          if (res.error === 'quota_exceeded') setQuotaResetDate(res.resetDate ?? null);
        } else {
          setAiError(res.error || res.message || 'Erreur lors de la génération des recommandations.');
        }
        return;
      }
      setRecommendations(ddParseRecommendations(res.data));
    } catch (e) {
      setAiError(e.message || 'Erreur lors de la génération des recommandations.');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return null;

  return (
    <div style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'1rem 1.25rem' }}>
      <style>{`@keyframes ddPulse{0%,80%,100%{opacity:.25;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}`}</style>

      <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'12px' }}>DRAWDOWN ANALYSIS</div>

      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          style={{ background:'rgba(14,15,22,0.7)', border:`1px solid ${JT.border}`, color:T.text1, padding:'7px 10px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', outline:'none' }}>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="all">Tout l'historique</option>
        </select>
        <button onClick={handleAnalyze} disabled={aiLoading}
          style={{ background:JT.textPrimary, border:'none', color:'#0c0d16', padding:'8px 16px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', fontWeight:'500', cursor:aiLoading?'default':'pointer', opacity:aiLoading?0.6:1 }}>
          Analyser ↗
        </button>
        {metrics && (
          <span style={{ marginLeft:'auto', fontSize:'11px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', color: metrics.fragile?JT.danger:JT.success, background: metrics.fragile?'rgba(226,75,74,0.10)':'rgba(29,158,117,0.10)', border:`1px solid ${metrics.fragile?'rgba(226,75,74,0.30)':'rgba(29,158,117,0.30)'}` }}>
            {metrics.fragile ? 'FRAGILE' : 'ROBUSTE'}
          </span>
        )}
      </div>

      {metrics && metrics.series.length < 2 && (
        <div style={{ textAlign:'center', color:T.text4, fontSize:'12px', padding:'30px' }}>Pas assez de données sur cette période.</div>
      )}

      {metrics && metrics.series.length >= 2 && (<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
          <div style={{ padding:'10px 12px', background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusMd }}>
            <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>Drawdown max</div>
            <div style={{ fontSize:'16px', fontWeight:'500', color:JT.danger }}>-{metrics.maxDD.toFixed(2)}$</div>
            <div style={{ fontSize:'11px', color:JT.textTertiary, marginTop:'2px' }}>{metrics.maxDDPct.toFixed(1)}% du pic</div>
          </div>
          <div style={{ padding:'10px 12px', background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusMd }}>
            <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>Recovery moyen</div>
            <div style={{ fontSize:'16px', fontWeight:'500', color:JT.warn }}>{metrics.avgRecoveryDays != null ? `${metrics.avgRecoveryDays.toFixed(1)}j` : '—'}</div>
            <div style={{ fontSize:'11px', color:JT.textTertiary, marginTop:'2px' }}>temps pour retrouver le pic</div>
          </div>
          <div style={{ padding:'10px 12px', background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusMd }}>
            <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>Séquences perdantes</div>
            <div style={{ fontSize:'16px', fontWeight:'500', color:JT.textPrimary }}>{metrics.losingStreaks}</div>
            <div style={{ fontSize:'11px', color:JT.textTertiary, marginTop:'2px' }}>≥2 trades consécutifs</div>
          </div>
        </div>

        <DDMiniBarChart data={metrics.series} />

        {aiLoading && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'16px 0 4px' }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:T.accent, display:'inline-block', animation:`ddPulse 1.2s ease ${i*0.18}s infinite` }} />
            ))}
            <span style={{ fontSize:'12px', color:T.text3, marginLeft:'6px' }}>Claude analyse les drawdowns...</span>
          </div>
        )}

        {aiError && (
          <div style={{ marginTop:'16px', padding:'10px 12px', background:JT.warnBg, border:`1px solid ${JT.warnBorder}`, borderRadius:JT.radiusMd, fontSize:'13px', color:JT.warn, lineHeight:'1.7', display:'flex', gap:'8px', alignItems:'flex-start' }}>
            <span style={{ marginTop:'2px', flexShrink:0 }}><JtIconAlertTriangle color={JT.warn} /></span>
            <div>
              <div style={{ fontWeight:'700', marginBottom:'4px' }}>
                {aiError === 'unauthenticated'      ? 'Connexion requise'
                  : aiError === 'subscription_inactive' ? 'Abonnement requis'
                  : aiError === 'quota_exceeded'        ? 'Quota atteint'
                  : 'Erreur'}
              </div>
              {aiError === 'unauthenticated'
                ? "Connecte-toi pour activer l'analyse IA des drawdowns."
                : aiError === 'subscription_inactive'
                ? "Abonnement requis pour activer l'analyse IA des drawdowns."
                : aiError === 'quota_exceeded'
                ? `Quota IA mensuel atteint${quotaResetDate ? `, réessaie après le ${quotaResetDate}` : ''}.`
                : aiError}
            </div>
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginTop:'16px' }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ padding:'14px', background:`${T.bg}0.65)`, border:`1px solid ${T.border}0.12)`, borderRadius:'7px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:T.accentL, marginBottom:'6px' }}>#{i + 1}</div>
                <div style={{ fontSize:'12.5px', color:T.text1, lineHeight:'1.6' }}>{rec}</div>
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}

// ── ANALYTICS SECTION (Heat Map + Pattern Recognition) ────────
const HM_DAYS     = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const HM_HOURS    = Array.from({ length: 24 }, (_, i) => i);
const HM_SESSIONS = [
  { label: 'Asia',   start: 0,  end: 6,  color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  { label: 'London', start: 7,  end: 11, color: '#f59e0b', bg: 'rgba(245,158,11,0.07)' },
  { label: 'NY',     start: 13, end: 20, color: '#00cc77', bg: 'rgba(0,204,119,0.06)'  },
];
function hmDowIdx(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }
function hmSess(h) { return HM_SESSIONS.find(s => h >= s.start && h <= s.end) ?? null; }
function hmCellColor(pnl, maxAbs) {
  if (maxAbs === 0) return 'rgba(136,153,187,0.06)';
  const t = Math.min(Math.abs(pnl) / maxAbs, 1);
  return pnl > 0
    ? `rgba(0,204,119,${(0.08 + t * 0.55).toFixed(2)})`
    : `rgba(255,51,68,${(0.08 + t * 0.55).toFixed(2)})`;
}
function prStats(ts) {
  if (!ts.length) return null;
  const pnls    = ts.map(t => getNet(t) ?? 0);
  const pnl     = pnls.reduce((a, b) => a + b, 0);
  const wins    = pnls.filter(p => p > 0).length;
  const gw      = pnls.filter(p => p > 0).reduce((a, b) => a + b, 0);
  const gl      = Math.abs(pnls.filter(p => p < 0).reduce((a, b) => a + b, 0));
  const winrate = (wins / ts.length) * 100;
  const pf      = gl > 0 ? gw / gl : gw > 0 ? 99 : 0;
  return { total: ts.length, wins, pnl, winrate, pf, avgPnl: pnl / ts.length };
}
function prGroupBy(ts, keyFn) {
  return ts.reduce((m, t) => { const k = keyFn(t); (m[k] ??= []).push(t); return m; }, {});
}
function prSession(entered_at) {
  if (!entered_at) return 'Autres';
  const h = new Date(entered_at).getHours();
  if (h <= 6) return 'Asia';
  if (h <= 11) return 'London';
  if (h >= 13 && h <= 20) return 'NY';
  return 'Autres';
}
function WRBar({ wr }) {
  const c = wr >= 60 ? '#00cc77' : wr >= 45 ? '#f59e0b' : '#ff3344';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ flex: 1, height: '4px', background: 'rgba(136,153,187,0.10)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(wr, 100)}%`, height: '100%', background: c, borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '10px', fontWeight: '700', color: c, minWidth: '30px', textAlign: 'right' }}>{wr.toFixed(0)}%</span>
    </div>
  );
}
function PatternRow({ rank, label, sub, stats, highlight }) {
  const pc  = stats.pnl >= 0 ? '#00cc77' : '#ff3344';
  const pfc = stats.pf >= 1.5 ? '#00cc77' : stats.pf >= 1 ? '#f59e0b' : '#ff3344';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 45px 80px 65px 50px', gap: '5px', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', marginBottom: '2px', background: highlight ? 'rgba(0,204,119,0.04)' : 'rgba(14,15,22,0.4)', border: `1px solid ${highlight ? 'rgba(0,204,119,0.15)' : 'rgba(136,153,187,0.07)'}` }}>
      <span style={{ fontSize: '9px', color: T.text4, textAlign: 'center' }}>#{rank}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: T.text1, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sub && <div style={{ fontSize: '10px', color: T.text3 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: '10px', color: T.text3, textAlign: 'center' }}>{stats.total}t</span>
      <WRBar wr={stats.winrate} />
      <span style={{ fontSize: '11px', fontWeight: '700', color: pc, textAlign: 'right' }}>{stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(0)}$</span>
      <span style={{ fontSize: '10px', color: pfc, textAlign: 'right' }}>PF {stats.pf === 99 ? '∞' : stats.pf.toFixed(1)}</span>
    </div>
  );
}
function AnalyticsSection({ trades, loading }) {
  const [activeTab, setActiveTab] = useState('heatmap');
  const [hmMetric,  setHmMetric]  = useState('pnl');
  const [hmHover,   setHmHover]   = useState(null);
  const [hmDrill,   setHmDrill]   = useState(null);
  const [prTab,     setPrTab]     = useState('pairs');
  const [prMin,     setPrMin]     = useState(3);

  const hmData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ trades: 0, pnl: 0, wins: 0 }))
    );
    for (const t of trades) {
      const ts = t.entered_at || (t.date ? t.date + 'T12:00:00' : null);
      if (!ts) continue;
      const d   = new Date(ts);
      if (isNaN(d)) continue;
      const dow = hmDowIdx(d.getDay());
      const h   = d.getHours();
      const pnl = getNet(t) ?? 0;
      grid[dow][h].trades++;
      grid[dow][h].pnl += pnl;
      if (pnl > 0) grid[dow][h].wins++;
    }
    let maxAbs = 0;
    for (const row of grid) for (const c of row) if (Math.abs(c.pnl) > maxAbs) maxAbs = Math.abs(c.pnl);
    let best = null, worst = null;
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
      const c = grid[d][h];
      if (!c.trades) continue;
      if (!best  || c.pnl > best.pnl)  best  = { ...c, dow: d, hour: h };
      if (!worst || c.pnl < worst.pnl) worst = { ...c, dow: d, hour: h };
    }
    const totalPnl = trades.reduce((s, t) => s + (getNet(t) ?? 0), 0);
    return { grid, maxAbs, best, worst, totalPnl };
  }, [trades]);

  const prData = useMemo(() => {
    const fs = trades.filter(t => getNet(t) != null);
    if (!fs.length) return null;
    const byPair = prGroupBy(fs, t => t.pair ?? '?');
    const byDir  = prGroupBy(fs, t => t.direction ?? '?');
    const bySess = prGroupBy(fs, t => prSession(t.entered_at));
    const DOW_FR   = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const DOW_FULL = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const byDow  = prGroupBy(fs, t => {
      const ts = t.entered_at || (t.date ? t.date + 'T12:00:00' : null);
      return ts ? new Date(ts).getDay() : -1;
    });
    const byCombo = prGroupBy(fs, t => `${t.pair ?? '?'}·${t.direction ?? '?'}`);

    const mkRows = (map) => Object.entries(map)
      .map(([k, ts]) => { const s = prStats(ts); return s ? { name: k, ...s } : null; })
      .filter(Boolean).filter(e => e.total >= prMin)
      .sort((a, b) => b.winrate - a.winrate);

    const pairRows  = mkRows(byPair);
    const sessRows  = mkRows(bySess);
    const dowRows   = [1,2,3,4,5,6,0].map(d => {
      const ts = byDow[d] ?? [];
      const s  = prStats(ts);
      return s && s.total >= 1 ? { name: DOW_FR[d], fullName: DOW_FULL[d], dow: d, ...s } : null;
    }).filter(Boolean);
    const dirStats  = Object.fromEntries(
      Object.entries(byDir)
        .map(([k, ts]) => { const s = prStats(ts); return s ? [k, s] : null; })
        .filter(Boolean)
    );
    const comboRows = Object.entries(byCombo)
      .map(([k, ts]) => { const s = prStats(ts); return s && s.total >= prMin ? { name: k, ...s } : null; })
      .filter(Boolean).sort((a, b) => b.winrate - a.winrate);

    const topN = (map, asc = false) => Object.entries(map)
      .map(([k, ts]) => { const s = prStats(ts); return s && s.total >= prMin ? { k, s } : null; })
      .filter(Boolean)
      .sort((a, b) => asc ? a.s.winrate - b.s.winrate : b.s.winrate - a.s.winrate)[0];

    return { pairRows, sessRows, dowRows, dirStats, comboRows,
      bestPair: topN(byPair), worstPair: topN(byPair, true),
      bestSess: topN(bySess), worstSess: topN(bySess, true) };
  }, [trades, prMin]);

  if (loading || !trades.length) return null;

  const { grid, maxAbs, best, worst, totalPnl } = hmData;
  const CELL_W = 48, CELL_H = 38, LABEL_W = 46;
  const maxCount = Math.max(...HM_HOURS.map(h => Math.max(...HM_DAYS.map((_, d) => grid[d][h].trades))), 1);

  function cellBg(cell) {
    if (!cell.trades) return 'rgba(136,153,187,0.03)';
    if (hmMetric === 'pnl')     return hmCellColor(cell.pnl, maxAbs);
    if (hmMetric === 'winrate') {
      const wr = cell.wins / cell.trades;
      return wr >= 0.5
        ? `rgba(0,204,119,${(0.08 + wr * 0.55).toFixed(2)})`
        : `rgba(255,51,68,${(0.08 + (1 - wr) * 0.55).toFixed(2)})`;
    }
    return `rgba(124,58,237,${(0.06 + cell.trades / maxCount * 0.60).toFixed(2)})`;
  }
  function cellBorder(cell, hov) {
    if (hov && cell.trades) return '1px solid rgba(255,255,255,0.30)';
    if (!cell.trades) return '1px solid rgba(136,153,187,0.04)';
    if (hmMetric === 'pnl') {
      const t = Math.min(Math.abs(cell.pnl) / maxAbs, 1);
      return cell.pnl > 0
        ? `1px solid rgba(0,204,119,${(0.10 + t * 0.40).toFixed(2)})`
        : `1px solid rgba(255,51,68,${(0.10 + t * 0.40).toFixed(2)})`;
    }
    return '1px solid rgba(136,153,187,0.09)';
  }
  function cellTxt(cell) {
    if (!cell.trades) return null;
    if (hmMetric === 'count')   return cell.trades;
    if (hmMetric === 'winrate') return `${Math.round(cell.wins / cell.trades * 100)}%`;
    return cell.pnl >= 0 ? `+${Math.round(cell.pnl)}` : `${Math.round(cell.pnl)}`;
  }
  function cellTxtColor(cell) {
    if (hmMetric === 'pnl')     return cell.pnl > 0 ? '#00ff88' : '#ff7788';
    if (hmMetric === 'winrate') return cell.wins / cell.trades >= 0.5 ? '#00ff88' : '#ff7788';
    return '#cc88ff';
  }

  const activeRows = prData
    ? prTab === 'pairs'    ? prData.pairRows
    : prTab === 'sessions' ? prData.sessRows
    : prTab === 'days'     ? prData.dowRows.filter(e => e.total >= prMin)
    : prData.comboRows
    : [];

  return (
    <div style={{ background: `${T.bg}0.55)`, border: `1px solid ${T.border}0.10)`, borderRadius: '10px', overflow: 'hidden' }}>

      {/* ── Tab header ── */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}0.08)`, display: 'flex', alignItems: 'center', gap: '6px' }}>
        {[['heatmap','HEAT MAP'],['patterns','PATTERNS']].map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)} style={{
            padding: '5px 12px', borderRadius: '4px', fontSize: '10px', fontFamily: 'inherit',
            fontWeight: '700', letterSpacing: '1.5px', cursor: 'pointer', transition: 'all 0.15s',
            background: activeTab === k ? 'rgba(136,153,187,0.12)' : 'transparent',
            border: `1px solid ${activeTab === k ? 'rgba(136,153,187,0.28)' : 'rgba(136,153,187,0.10)'}`,
            color: activeTab === k ? T.text1 : T.text4,
          }}>{l}</button>
        ))}
        <span style={{ fontSize: '10px', color: T.text4, marginLeft: '4px' }}>
          {activeTab === 'heatmap' ? '· performance horaire 7×24' : '· setups gagnants & perdants'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: T.text4 }}>{trades.length} trades</span>
      </div>

      {/* ── HEAT MAP ── */}
      {activeTab === 'heatmap' && (
        <div style={{ padding: '14px 16px', position: 'relative' }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '14px' }}>
            {[
              { label: 'TOTAL TRADES', value: trades.length,       color: T.accent },
              { label: 'TOTAL PNL',    value: fmt(totalPnl, true), color: totalPnl >= 0 ? '#00cc77' : '#ff3344' },
              { label: 'MEILLEUR',     value: best  ? `${HM_DAYS[best.dow]} ${String(best.hour).padStart(2,'0')}h`  : '—', sub: best  ? fmt(best.pnl,  true) : '', color: '#00cc77' },
              { label: 'PIRE',         value: worst ? `${HM_DAYS[worst.dow]} ${String(worst.hour).padStart(2,'0')}h` : '—', sub: worst ? fmt(worst.pnl, true) : '', color: '#ff3344' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ padding: '9px 12px', background: `${T.bg}0.65)`, border: `1px solid ${T.border}0.09)`, borderRadius: '7px' }}>
                <div style={{ fontSize: '9px', color: T.text3, letterSpacing: '1.5px', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
                {sub && <div style={{ fontSize: '10px', color: T.text3, marginTop: '1px' }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Metric toggle + session legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[['pnl','PnL','#00cc77'],['winrate','Winrate','#7c3aed'],['count','Nb trades','#f59e0b']].map(([k, l, c]) => (
              <button key={k} onClick={() => setHmMetric(k)} style={{
                padding: '4px 10px', borderRadius: '4px', fontFamily: 'inherit', fontSize: '10px',
                cursor: 'pointer', fontWeight: hmMetric === k ? '700' : '400', transition: 'all 0.15s',
                background: hmMetric === k ? `${c}15` : 'transparent',
                border: `1px solid ${hmMetric === k ? c + '45' : 'rgba(136,153,187,0.12)'}`,
                color: hmMetric === k ? c : T.text3,
              }}>{l}</button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {HM_SESSIONS.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.bg, border: `1px solid ${s.color}44` }} />
                  <span style={{ fontSize: '9px', color: s.color }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 7×24 Grid */}
          <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
            <div style={{ display: 'inline-block', minWidth: `${LABEL_W + 24 * (CELL_W + 2)}px` }}>
              <div style={{ display: 'flex', marginLeft: `${LABEL_W}px`, marginBottom: '2px' }}>
                {HM_HOURS.map(h => {
                  const s = hmSess(h);
                  return (
                    <div key={h} style={{ width: `${CELL_W}px`, marginRight: '2px', textAlign: 'center', fontSize: '9px', color: s ? s.color : T.text4, fontWeight: s ? '700' : '400' }}>
                      {h % 2 === 0 ? `${String(h).padStart(2,'0')}h` : ''}
                    </div>
                  );
                })}
              </div>
              {HM_DAYS.map((day, dow) => (
                <div key={day} style={{ display: 'flex', marginBottom: '2px', alignItems: 'center' }}>
                  <div style={{ width: `${LABEL_W}px`, fontSize: '12px', color: dow < 5 ? T.text2 : T.text4, flexShrink: 0, textAlign: 'right', paddingRight: '6px', fontWeight: dow < 5 ? '600' : '400' }}>{day}</div>
                  {HM_HOURS.map(hour => {
                    const cell = grid[dow][hour];
                    const isHov = hmHover?.dow === dow && hmHover?.hour === hour;
                    const s = hmSess(hour);
                    return (
                      <div key={hour}
                        onClick={() => {
                          if (!cell.trades) return;
                          const trList = trades.filter(t => {
                            const ts = t.entered_at || (t.date ? t.date + 'T12:00:00' : null);
                            if (!ts) return false;
                            const d = new Date(ts);
                            return hmDowIdx(d.getDay()) === dow && d.getHours() === hour;
                          });
                          setHmDrill({ dow, hour, trList });
                        }}
                        onMouseEnter={() => setHmHover({ dow, hour })}
                        onMouseLeave={() => setHmHover(null)}
                        style={{
                          width: `${CELL_W}px`, height: `${CELL_H}px`, marginRight: '2px',
                          background: cellBg(cell),
                          border: cellBorder(cell, isHov),
                          borderRadius: '3px', cursor: cell.trades ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'transform 0.1s',
                          transform: isHov && cell.trades ? 'scale(1.10)' : 'scale(1)',
                          position: 'relative', zIndex: isHov ? 2 : 1,
                          boxShadow: s && !cell.trades ? `inset 0 0 0 1px ${s.color}18` : 'none',
                        }}>
                        {cell.trades > 0 && (
                          <span style={{ fontSize: '9px', color: cellTxtColor(cell), fontWeight: '700', textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1 }}>
                            {cellTxt(cell)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Hover tooltip — fixed bottom-right */}
          {hmHover && (() => {
            const c = grid[hmHover.dow]?.[hmHover.hour];
            if (!c?.trades) return null;
            const s = hmSess(hmHover.hour);
            return (
              <div style={{ position: 'fixed', bottom: '22px', right: '22px', background: 'rgba(8,9,16,0.97)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.65)', zIndex: 9999, minWidth: '160px', pointerEvents: 'none' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: T.text1, marginBottom: '7px' }}>
                  {HM_DAYS[hmHover.dow]} {String(hmHover.hour).padStart(2,'0')}h
                  {s && <span style={{ marginLeft: '6px', fontSize: '9px', color: s.color }}>{s.label}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                  {[['Trades', c.trades], ['Winrate', `${Math.round(c.wins / c.trades * 100)}%`], ['PnL total', fmt(c.pnl, true)], ['PnL moy.', fmt(c.pnl / c.trades, true)]].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: '9px', color: T.text3 }}>{l}</div>
                      <div style={{ fontSize: '11px', color: l.includes('PnL') ? (c.pnl >= 0 ? '#00cc77' : '#ff3344') : T.text1, fontWeight: '600' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Drill-down modal */}
          {hmDrill && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setHmDrill(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#0b0c15', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '12px', padding: '18px', maxWidth: '520px', width: '92%', maxHeight: '65vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.75)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: T.text1 }}>
                    {HM_DAYS[hmDrill.dow]} {String(hmDrill.hour).padStart(2,'0')}h — {hmDrill.trList.length} trade{hmDrill.trList.length > 1 ? 's' : ''}
                  </div>
                  <button onClick={() => setHmDrill(null)} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', fontSize: '15px' }}>✕</button>
                </div>
                {hmDrill.trList.map((t, i) => {
                  const pnl = getNet(t) ?? 0;
                  return (
                    <div key={t.id ?? i} style={{ padding: '8px 10px', borderRadius: '5px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: pnl >= 0 ? 'rgba(0,204,119,0.04)' : 'rgba(255,51,68,0.04)', border: `1px solid ${pnl >= 0 ? 'rgba(0,204,119,0.18)' : 'rgba(255,51,68,0.18)'}` }}>
                      <div>
                        <span style={{ fontSize: '12px', color: T.text1, fontWeight: '600' }}>{t.pair}</span>
                        <span style={{ fontSize: '10px', color: T.text3, marginLeft: '8px' }}>{t.direction}</span>
                        {t.entered_at && <span style={{ fontSize: '9px', color: T.text4, marginLeft: '8px' }}>{new Date(t.entered_at).toLocaleString('fr-FR')}</span>}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: pnl >= 0 ? '#00cc77' : '#ff3344' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}$</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PATTERNS ── */}
      {activeTab === 'patterns' && (
        <div style={{ padding: '14px 16px' }}>
          {!prData ? (
            <div style={{ textAlign: 'center', color: T.text4, fontSize: '12px', padding: '40px' }}>Pas assez de données pour les patterns.</div>
          ) : (<>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'MEILLEURE PAIRE',   value: prData.bestPair?.k  ?? '—', sub: prData.bestPair  ? `${prData.bestPair.s.winrate.toFixed(0)}%WR · ${prData.bestPair.s.total}t`  : '', color: '#00cc77' },
                { label: 'MEILLEURE SESSION', value: prData.bestSess?.k  ?? '—', sub: prData.bestSess  ? `${prData.bestSess.s.winrate.toFixed(0)}%WR · ${prData.bestSess.s.total}t`   : '', color: '#7c3aed' },
                { label: 'PAIRE DIFFICILE',   value: prData.worstPair?.k ?? '—', sub: prData.worstPair ? `${prData.worstPair.s.winrate.toFixed(0)}%WR · ${prData.worstPair.s.total}t` : '', color: '#ff3344' },
                { label: 'SESSION DIFFICILE', value: prData.worstSess?.k ?? '—', sub: prData.worstSess ? `${prData.worstSess.s.winrate.toFixed(0)}%WR · ${prData.worstSess.s.total}t` : '', color: '#f59e0b' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ padding: '9px 12px', background: `${T.bg}0.65)`, border: `1px solid ${T.border}0.09)`, borderRadius: '7px' }}>
                  <div style={{ fontSize: '9px', color: T.text3, letterSpacing: '1.5px', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
                  <div style={{ fontSize: '10px', color: T.text3, marginTop: '1px' }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* LONG vs SHORT */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {['LONG','SHORT'].map(dir => {
                const s   = prData.dirStats[dir];
                if (!s) return <div key={dir} />;
                const c   = dir === 'LONG' ? '#00cc77' : '#ff3344';
                const rgb = dir === 'LONG' ? '0,204,119' : '255,51,68';
                return (
                  <div key={dir} style={{ padding: '10px 14px', background: `rgba(${rgb},0.04)`, border: `1px solid rgba(${rgb},0.14)`, borderRadius: '7px', display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: T.text3, marginBottom: '2px' }}>{dir === 'LONG' ? '▲ LONG' : '▼ SHORT'}</div>
                      <div style={{ fontSize: '22px', fontWeight: '700', color: c, lineHeight: 1 }}>{s.winrate.toFixed(0)}%</div>
                      <div style={{ fontSize: '9px', color: T.text3 }}>winrate</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', flex: 1 }}>
                      {[['Trades', s.total], ['PnL', `${s.pnl>=0?'+':''}${s.pnl.toFixed(0)}$`], ['Moy.', `${s.avgPnl>=0?'+':''}${s.avgPnl.toFixed(0)}$`], ['PF', s.pf===99?'∞':s.pf.toFixed(1)]].map(([l, v]) => (
                        <div key={l}>
                          <div style={{ fontSize: '9px', color: T.text3 }}>{l}</div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: T.text1 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tab selector + min trades filter */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {[['pairs','Par Paire'],['sessions','Par Session'],['days','Par Jour'],['combos','Combos']].map(([k, l]) => (
                <button key={k} onClick={() => setPrTab(k)} style={{
                  padding: '4px 10px', borderRadius: '4px', fontFamily: 'inherit', fontSize: '10px',
                  cursor: 'pointer', fontWeight: prTab === k ? '700' : '400', transition: 'all 0.15s',
                  background: prTab === k ? 'rgba(0,204,119,0.08)' : 'transparent',
                  border: `1px solid ${prTab === k ? 'rgba(0,204,119,0.28)' : 'rgba(136,153,187,0.12)'}`,
                  color: prTab === k ? '#00cc77' : T.text3,
                }}>{l}</button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: T.text3 }}>
                Min:
                {[2,3,5,10].map(n => (
                  <button key={n} onClick={() => setPrMin(n)} style={{
                    padding: '2px 6px', borderRadius: '3px', fontFamily: 'inherit', fontSize: '9px', cursor: 'pointer',
                    background: prMin === n ? 'rgba(136,153,187,0.12)' : 'transparent',
                    border: `1px solid ${prMin === n ? 'rgba(136,153,187,0.28)' : 'rgba(136,153,187,0.10)'}`,
                    color: prMin === n ? T.text1 : T.text3,
                  }}>{n}+</button>
                ))}
              </div>
            </div>

            {/* Chart + Table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
              <div style={{ background: `${T.bg}0.60)`, border: `1px solid ${T.border}0.09)`, borderRadius: '7px', padding: '12px' }}>
                <div style={{ fontSize: '9px', color: T.text3, letterSpacing: '2px', marginBottom: '10px' }}>
                  {prTab === 'pairs' ? 'WINRATE PAR PAIRE' : prTab === 'sessions' ? 'WINRATE PAR SESSION' : prTab === 'days' ? 'WINRATE PAR JOUR' : 'COMBOS PAIR×DIRECTION'}
                </div>
                {prTab !== 'combos' ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={activeRows} margin={{ top: 4, right: 4, bottom: 4, left: -22 }}>
                      <XAxis dataKey="name" tick={{ fill: T.text3, fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: T.text3, fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const v = payload[0].value;
                        return (
                          <div style={{ background: 'rgba(8,9,16,0.97)', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '5px', padding: '6px 10px', fontSize: '11px', fontFamily: 'inherit' }}>
                            <div style={{ color: T.text2, marginBottom: '2px' }}>{label}</div>
                            <div style={{ color: v >= 50 ? '#00cc77' : '#ff3344', fontWeight: '700' }}>{Number(v).toFixed(1)}% WR</div>
                          </div>
                        );
                      }} />
                      <ReferenceLine y={50} stroke="rgba(136,153,187,0.18)" strokeDasharray="3 3" />
                      <Bar dataKey="winrate" radius={[2, 2, 0, 0]} maxBarSize={40}>
                        {activeRows.map((e, i) => (
                          <Cell key={i} fill={e.winrate >= 60 ? '#00cc77' : e.winrate >= 45 ? '#f59e0b' : '#ff3344'} fillOpacity={0.80} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ fontSize: '11px', color: T.text4, textAlign: 'center', padding: '70px 0' }}>→ Voir tableau</div>
                )}
              </div>

              <div style={{ background: `${T.bg}0.60)`, border: `1px solid ${T.border}0.09)`, borderRadius: '7px', padding: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 45px 80px 65px 50px', gap: '5px', padding: '0 8px 6px', borderBottom: `1px solid ${T.border}0.07)`, marginBottom: '4px' }}>
                  {['#','Setup','T','Winrate','PnL','PF'].map(h => (
                    <span key={h} style={{ fontSize: '9px', color: T.text4, letterSpacing: '1.5px', textAlign: h==='#'||h==='T' ? 'center' : h==='PnL'||h==='PF' ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                <div style={{ overflowY: 'auto', maxHeight: '250px' }}>
                  {activeRows.length === 0 ? (
                    <div style={{ textAlign: 'center', color: T.text4, fontSize: '11px', padding: '30px 0' }}>
                      Pas assez de données<br/><span style={{ fontSize: '10px' }}>({prMin}+ trades requis)</span>
                    </div>
                  ) : (
                    activeRows.slice(0, 20).map((e, i) => {
                      const parts = prTab === 'combos' ? e.name.split('·') : [e.name, null];
                      return (
                        <PatternRow key={e.name + i} rank={i + 1}
                          label={parts[0]}
                          sub={prTab === 'pairs' ? `${e.total} trades` : (parts[1] ?? e.fullName ?? null)}
                          stats={e}
                          highlight={e.winrate >= 60 && e.total >= 5} />
                      );
                    })
                  )}
                </div>
                {prTab !== 'combos' && (() => {
                  const worst = activeRows.filter(e => e.winrate < 45 && e.total >= prMin).sort((a, b) => a.winrate - b.winrate).slice(0, 3);
                  if (!worst.length) return null;
                  return (
                    <div style={{ marginTop: '8px', padding: '7px 8px', background: 'rgba(255,51,68,0.04)', border: '1px solid rgba(255,51,68,0.12)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '9px', color: '#ff3344', letterSpacing: '2px', marginBottom: '5px' }}>SETUPS À ÉVITER</div>
                      {worst.map(e => (
                        <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '10px' }}>
                          <span style={{ color: '#ff7788' }}>{e.fullName ?? e.name}</span>
                          <span style={{ color: '#ff3344', fontWeight: '700' }}>{e.winrate.toFixed(0)}%WR · {e.pnl.toFixed(0)}$</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

// ── RISK MANAGER ──────────────────────────────────────────────
// ── Risk Manager — contract specs ────────────────────────────
const RM_CONTRACTS = {
  MNQ:  { label:'Micro NQ',    tickSize:0.25, tickValue:0.50,  pointValue:2    },
  NQ:   { label:'NQ E-mini',   tickSize:0.25, tickValue:5.00,  pointValue:20   },
  MES:  { label:'Micro ES',    tickSize:0.25, tickValue:1.25,  pointValue:5    },
  ES:   { label:'ES E-mini',   tickSize:0.25, tickValue:12.50, pointValue:50   },
  MGC:  { label:'Micro Gold',  tickSize:0.10, tickValue:1.00,  pointValue:10   },
  GC:   { label:'Gold',        tickSize:0.10, tickValue:10.00, pointValue:100  },
  MCL:  { label:'Micro CL',    tickSize:0.01, tickValue:1.00,  pointValue:100  },
  M2K:  { label:'Micro R2K',   tickSize:0.10, tickValue:0.50,  pointValue:5    },
  MYM:  { label:'Micro YM',    tickSize:1,    tickValue:0.50,  pointValue:0.5  },
  AUTRE:{ label:'Autre/Forex', tickSize:1,    tickValue:1,     pointValue:1    },
};

function RmGauge({ label, value, max, warning = 0.7 }) {
  if (!max) return null;
  const pct = Math.min(1, Math.max(0, value / max));
  const barC = pct >= 0.9 ? JT.danger : pct >= warning ? JT.warn : JT.success;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
        <span style={{ fontSize:'11px', color:JT.textTertiary }}>{label}</span>
        <span style={{ fontSize:'11px', fontWeight:'500', color:barC }}>{value.toFixed(0)}$ / {max.toFixed(0)}$</span>
      </div>
      <div style={{ height:'4px', background:JT.border, borderRadius:'2px', overflow:'hidden', marginBottom:'2px' }}>
        <div style={{ height:'100%', width:`${pct*100}%`, background:barC, borderRadius:'2px', transition:'width 0.5s' }} />
      </div>
      <div style={{ fontSize:'10px', color:pct>=0.9?JT.danger:JT.textTertiary, textAlign:'right' }}>
        {(max-value).toFixed(0)}$ restants · {((1-pct)*100).toFixed(0)}%
      </div>
    </div>
  );
}

function RmTradeBar({ label, value, max }) {
  if (!max) return null;
  const pct = Math.min(1, value / max);
  const barC = pct >= 0.9 ? JT.danger : pct >= 0.7 ? JT.warn : JT.success;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
        <span style={{ fontSize:'11px', color:JT.textTertiary }}>{label}</span>
        <span style={{ fontSize:'11px', fontWeight:'500', color:barC }}>{value} / {max}</span>
      </div>
      <div style={{ height:'4px', background:JT.border, borderRadius:'2px', overflow:'hidden', marginBottom:'2px' }}>
        <div style={{ height:'100%', width:`${pct*100}%`, background:barC, borderRadius:'2px', transition:'width 0.5s' }} />
      </div>
      <div style={{ fontSize:'10px', color:JT.textTertiary, textAlign:'right' }}>{max-value} trades restants</div>
    </div>
  );
}

function RiskManager({ trades, account, loading }) {
  const DEFAULT_SETTINGS = { dailyLimit:500, maxDD:2000, maxTrades:0, riskPct:1, riskMode:'pct', riskUsd:'', targetRR:2 };
  const [settings, setSettings] = useState(() => {
    try { const s = localStorage.getItem('rm_settings_v2'); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS; }
    catch { return DEFAULT_SETTINGS; }
  });
  const [editing,    setEditing]    = useState(false);
  const [draft,      setDraft]      = useState(settings);
  const [instrument, setInstrument] = useState('MNQ');
  const [direction,  setDirection]  = useState('LONG');
  const [entry,      setEntry]      = useState('');
  const [stopLoss,   setStopLoss]   = useState('');
  const [accountSz,  setAccountSz]  = useState('');

  // Initialise accountSz depuis le type de compte
  useEffect(() => {
    const sizes = { topstep_50k:50000, topstep_100k:100000, topstep_150k:150000, lucid_eval_25k:25000, lucid_eval_50k:50000, lucid_eval_100k:100000, lucid_eval_150k:150000, topstep_ef_50k:50000, topstep_ef_100k:100000, topstep_ef_150k:150000 };
    if (account?.type && sizes[account.type]) setAccountSz(String(sizes[account.type]));
  }, [account?.type]);

  function saveSettings() {
    setSettings(draft);
    localStorage.setItem('rm_settings_v2', JSON.stringify(draft));
    setEditing(false);
  }

  // ── Calculateur (hook avant tout early return) ──
  const calc = useMemo(() => {
    const spec   = RM_CONTRACTS[instrument] ?? RM_CONTRACTS.MNQ;
    const ent    = parseFloat(entry)||0;
    const sl     = parseFloat(stopLoss)||0;
    const accSz  = parseFloat(accountSz)||50000;
    const rPct   = parseFloat(settings.riskPct)/100||0.01;
    if (!ent||!sl) return null;
    const dist = Math.abs(ent-sl); if(!dist) return null;
    const dolPerContract = dist*spec.pointValue; if(!dolPerContract) return null;
    const riskDollar = settings.riskMode==='pct' ? accSz*rPct : (parseFloat(settings.riskUsd)||0);
    const contracts  = riskDollar/dolPerContract;
    const contractsF = Math.floor(contracts);
    const actualRisk = contractsF*dolPerContract;
    const ticks      = dist/spec.tickSize;
    const rrTargets  = [1,1.5,2,3].map(rr => {
      const tpDist = dist*rr;
      const tpPrice= direction==='LONG' ? ent+tpDist : ent-tpDist;
      return { rr, tpPrice, profit:contractsF*tpDist*spec.pointValue };
    });
    return { spec, dist, dolPerContract, riskDollar, contracts, contractsF, actualRisk, ticks, rrTargets, accSz };
  }, [instrument, entry, stopLoss, accountSz, settings.riskPct, settings.riskMode, settings.riskUsd, direction]);

  if (loading) return null;

  // ── Stats temps réel ──
  const todayStr    = new Date().toISOString().slice(0,10);
  const todayTrades = trades.filter(t => (t.date||'').startsWith(todayStr));
  const todayPnl    = todayTrades.reduce((s,t) => s+(getNet(t)??0), 0);

  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-(weekStart.getDay()||7)+1); weekStart.setHours(0,0,0,0);
  const weekStr    = weekStart.toISOString().slice(0,10);
  const weekTrades = trades.filter(t => (t.date||'')>=weekStr);
  const weekPnl    = weekTrades.reduce((s,t) => s+(getNet(t)??0), 0);
  const weekWins   = weekTrades.filter(t => (getNet(t)??0)>0).length;
  const weekWR     = weekTrades.length>0 ? Math.round(weekWins/weekTrades.length*100) : 0;

  const sorted = [...trades].sort((a,b) => (b.date??'').localeCompare(a.date??'')||b.id-a.id);
  let consLosses=0; for (const t of sorted) { if ((getNet(t)??0)<0) consLosses++; else break; }

  const wins    = trades.filter(t => (getNet(t)??0)>0);
  const losses  = trades.filter(t => (getNet(t)??0)<0);
  const totalPnl= trades.reduce((s,t)=>s+(getNet(t)??0),0);
  const wr      = trades.length>0 ? Math.round(wins.length/trades.length*100) : 0;
  const grossW  = wins.reduce((s,t)=>s+(getNet(t)??0),0);
  const grossL  = Math.abs(losses.reduce((s,t)=>s+(getNet(t)??0),0));
  const pf      = grossL>0 ? grossW/grossL : wins.length>0 ? 99 : 0;
  const avgWin  = wins.length>0   ? grossW/wins.length   : 0;
  const avgLoss = losses.length>0 ? grossL/losses.length : 0;
  const rrs     = trades.filter(t=>t.rr&&!isNaN(parseFloat(t.rr))).map(t=>parseFloat(t.rr));
  const avgRR   = rrs.length>0 ? rrs.reduce((s,v)=>s+v,0)/rrs.length : null;

  // Max drawdown (peak-to-trough on running P&L)
  let cum=0, peak=0, maxDD=0;
  for (const t of [...trades].sort((a,b)=>(a.date??'').localeCompare(b.date??'')||a.id-b.id)) {
    cum += getNet(t)??0; if(cum>peak) peak=cum; maxDD=Math.max(maxDD,peak-cum);
  }

  // Kelly
  const kellyPct = avgLoss>0 && wins.length>0
    ? Math.max(0, Math.round(((wins.length/trades.length)-(losses.length/trades.length)/(avgWin/avgLoss))*100)) : 0;

  // Health score
  let health=100;
  if (settings.maxDD  && maxDD/settings.maxDD>0.8)          health-=30;
  else if (settings.maxDD && maxDD/settings.maxDD>0.5)       health-=15;
  if (settings.dailyLimit && Math.abs(todayPnl)/settings.dailyLimit>0.7 && todayPnl<0) health-=20;
  if (consLosses>=3)  health-=20;
  if (wr<35)          health-=15;
  if (settings.maxTrades>0 && todayTrades.length>settings.maxTrades*0.8) health-=10;
  health = Math.max(0, Math.min(100, health));
  const healthC = health>=70?'#00cc77':health>=40?'#f59e0b':'#ff3344';
  const healthL = health>=70?'BON':health>=40?'ATTENTION':'DANGER';

  // Limites journalières
  const dailyLossUsed = Math.max(0,-todayPnl);
  const shouldStop    = todayPnl<=-settings.dailyLimit;

  const inp = { width:'100%', background:`${T.bg}0.80)`, border:`1px solid ${T.border}0.20)`, borderRadius:'5px', padding:'7px 10px', color:T.text1, fontSize:'12px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:'10px', color:T.text3, letterSpacing:'1px', display:'block', marginBottom:'4px' };

  return (
    <div style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, overflow:'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding:'11px 18px', borderBottom:`1px solid ${JT.border}`, display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500' }}>RISK MANAGER</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ padding:'4px 12px', borderRadius:'99px', fontSize:'11px', fontWeight:'500',
            background:shouldStop?'rgba(226,75,74,0.12)':'rgba(29,158,117,0.10)',
            border:`1px solid ${shouldStop?'rgba(226,75,74,0.35)':'rgba(29,158,117,0.30)'}`,
            color:shouldStop?JT.danger:JT.success }}>
            {shouldStop?'⛔ Stop trading':'✓ Continuer'}
          </div>
          <button onClick={() => { setDraft(settings); setEditing(e => !e); }}
            style={{ background:'transparent', border:`1px solid ${JT.border}`, color:JT.textTertiary, padding:'4px 9px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
            ⚙ Réglages
          </button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {editing && (
        <div style={{ padding:'12px 18px', background:`rgba(136,153,187,0.04)`, borderBottom:`1px solid ${T.border}0.08)`, display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
          {[
            { key:'dailyLimit', label:'Perte max/jour ($)', min:50,  max:10000, step:50   },
            { key:'maxDD',      label:'Max Drawdown ($)',   min:100, max:50000, step:100  },
            { key:'maxTrades',  label:'Max trades/jour',    min:0,   max:50,    step:1    },
            { key:'riskPct',    label:'Risque/trade (%)',   min:0.1, max:5,     step:0.1  },
            { key:'targetRR',   label:'R:R cible',          min:0.5, max:5,     step:0.5  },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} style={{ flex:'0 0 auto' }}>
              <div style={lbl}>{label}</div>
              <input type="number" min={min} max={max} step={step} value={draft[key]}
                onChange={e => setDraft(prev => ({ ...prev, [key]:parseFloat(e.target.value)||prev[key] }))}
                style={{ ...inp, width:'100px' }} />
            </div>
          ))}
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={saveSettings} style={{ padding:'6px 14px', background:'rgba(0,204,119,0.12)', border:'1px solid rgba(0,204,119,0.30)', color:'#00cc77', borderRadius:'4px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', fontWeight:'700' }}>✓ Sauvegarder</button>
            <button onClick={() => setEditing(false)} style={{ padding:'6px 10px', background:'transparent', border:`1px solid ${T.border}0.18)`, color:T.text3, borderRadius:'4px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* ── Ligne du haut : Score santé + Limites + Alertes ── */}
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:'12px', alignItems:'stretch' }}>

          {/* Score santé */}
          <div style={{ background:'#120808', border:'0.5px solid #3a1212', borderRadius:JT.radiusLg, padding:'16px 20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px' }}>
            <div style={{ position:'relative', width:'72px', height:'72px' }}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(154,96,96,0.18)" strokeWidth="7"/>
                <circle cx="36" cy="36" r="28" fill="none" stroke={healthC}
                  strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${2*Math.PI*28}`}
                  strokeDashoffset={`${2*Math.PI*28*(1-health/100)}`}
                  transform="rotate(-90 36 36)"
                  style={{ filter:`drop-shadow(0 0 4px ${healthC})`, transition:'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'500', color:healthC, lineHeight:1 }}>{health}</div>
              </div>
            </div>
            <div style={{ fontSize:'11px', color:healthC, textTransform:'uppercase', letterSpacing:'0.06em' }}>{healthL}</div>
          </div>

          {/* Limites */}
          <div style={{ border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'14px' }}>
            <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'12px' }}>UTILISATION DES LIMITES</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <RmGauge label="Max Drawdown utilisé" value={maxDD} max={settings.maxDD} />
              <RmGauge label="Perte du jour" value={dailyLossUsed} max={settings.dailyLimit} warning={0.6} />
              {settings.maxTrades>0 && <RmTradeBar label="Trades du jour" value={todayTrades.length} max={settings.maxTrades} />}
            </div>
          </div>

          {/* Alertes */}
          <div style={{ background:'#120808', border:'0.5px solid #3a1212', borderRadius:JT.radiusLg, padding:'14px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
              <JtIconAlertTriangle color="#9a6060" />
              <span style={{ fontSize:'11px', color:'#9a6060', textTransform:'uppercase', letterSpacing:'0.06em' }}>ALERTES</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {shouldStop && <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:JT.textPrimary }}><JtIconX color={JT.danger} /> Limite de perte journalière atteinte</div>}
              {consLosses>=2 && <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:JT.textPrimary }}><JtIconX color={JT.danger} /> {consLosses} pertes consécutives</div>}
              {wr<40 && <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:JT.textPrimary }}><JtIconX color={JT.danger} /> Winrate bas : {wr}%</div>}
              {!shouldStop && consLosses<2 && wr>=40 && <div style={{ fontSize:'12px', color:'#9a6060' }}>Aucune alerte active</div>}
            </div>
          </div>
        </div>

        {/* ── Row 3 : Calculateur + Stats ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', alignItems:'start' }}>

          {/* Calculateur */}
          <div style={{ border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'12px', flexWrap:'wrap', gap:'6px' }}>
              <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em' }}>Calculateur de position</div>
              {instrument && (
                <div style={{ fontSize:'10px', color:JT.textTertiary }}>
                  {RM_CONTRACTS[instrument].label} · {RM_CONTRACTS[instrument].pointValue}$/pt · tick {RM_CONTRACTS[instrument].tickSize}={RM_CONTRACTS[instrument].tickValue}$
                </div>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {/* Instrument pills */}
              <div style={{ gridColumn:'1 / -1' }}>
                <div style={lbl}>INSTRUMENT</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {Object.keys(RM_CONTRACTS).map(k => (
                    <button key={k} onClick={() => setInstrument(k)} style={{
                      padding:'3px 9px', borderRadius:'99px', fontSize:'10px', cursor:'pointer', fontFamily:'inherit',
                      fontWeight:instrument===k?'500':'400', transition:'all 0.15s',
                      background:instrument===k?JT.surfSecondary:'transparent',
                      border:`1px solid ${instrument===k?JT.borderSecondary:JT.border}`,
                      color:instrument===k?JT.textPrimary:JT.textTertiary,
                    }}>{k}</button>
                  ))}
                </div>
              </div>

              {/* Direction */}
              <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                {['LONG','SHORT'].map(d => (
                  <button key={d} onClick={() => setDirection(d)} style={{
                    padding:'6px', borderRadius:'5px', fontSize:'11px', cursor:'pointer', fontFamily:'inherit', fontWeight:'500',
                    background:direction===d?(d==='LONG'?'rgba(29,158,117,0.10)':'rgba(226,75,74,0.10)'):'transparent',
                    border:`1px solid ${direction===d?(d==='LONG'?'rgba(29,158,117,0.32)':'rgba(226,75,74,0.32)'):JT.border}`,
                    color:direction===d?(d==='LONG'?JT.success:JT.danger):JT.textTertiary,
                  }}>{d==='LONG'?'▲ LONG':'▼ SHORT'}</button>
                ))}
              </div>

              {/* Inputs */}
              <div>
                <label style={lbl}>TAILLE COMPTE ($)</label>
                <input type="number" value={accountSz} onChange={e=>setAccountSz(e.target.value)} placeholder="50000" style={inp} />
              </div>
              <div>
                <label style={lbl}>
                  RISQUE&nbsp;
                  <span onClick={()=>setSettings(s=>({...s,riskMode:s.riskMode==='pct'?'usd':'pct'}))}
                    style={{ color:'#7c3aed', cursor:'pointer', textDecoration:'underline', fontSize:'9px' }}>
                    {settings.riskMode==='pct'?'(%) → $':'($) → %'}
                  </span>
                </label>
                {settings.riskMode==='pct'
                  ? <input type="number" value={settings.riskPct} onChange={e=>setSettings(s=>({...s,riskPct:parseFloat(e.target.value)||s.riskPct}))} placeholder="1" min="0.1" max="10" step="0.1" style={inp} />
                  : <input type="number" value={settings.riskUsd} onChange={e=>setSettings(s=>({...s,riskUsd:e.target.value}))} placeholder="500" style={inp} />
                }
              </div>
              <div>
                <label style={lbl}>ENTRÉE</label>
                <input type="number" value={entry} onChange={e=>setEntry(e.target.value)} placeholder="20000" style={inp} />
              </div>
              <div>
                <label style={lbl}>STOP LOSS</label>
                <input type="number" value={stopLoss} onChange={e=>setStopLoss(e.target.value)} placeholder="19950" style={inp} />
              </div>
            </div>

            {/* Résultat */}
            {calc ? (
              <div style={{ marginTop:'10px', padding:'12px', background:'rgba(29,158,117,0.06)', border:'1px solid rgba(29,158,117,0.20)', borderRadius:JT.radiusMd }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <div>
                    <div style={{ fontSize:'9px', color:JT.textTertiary }}>CONTRATS</div>
                    <div style={{ fontSize:'22px', fontWeight:'500', color:JT.success, lineHeight:1 }}>{calc.contractsF}</div>
                    <div style={{ fontSize:'9px', color:JT.textTertiary }}>exact: {calc.contracts.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:'9px', color:JT.textTertiary }}>$ RISQUÉS</div>
                    <div style={{ fontSize:'22px', fontWeight:'500', color:JT.warn, lineHeight:1 }}>{calc.actualRisk.toFixed(0)}</div>
                    <div style={{ fontSize:'9px', color:JT.textTertiary }}>{(calc.actualRisk/calc.accSz*100).toFixed(2)}% du compte</div>
                  </div>
                </div>
                <div style={{ fontSize:'10px', color:JT.textTertiary, marginBottom:'8px' }}>
                  SL: {calc.dist.toFixed(2)} pts · {calc.ticks} ticks · {calc.dolPerContract.toFixed(2)}$/contrat
                </div>
                <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>Objectifs TP</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'5px' }}>
                  {calc.rrTargets.map(({ rr, tpPrice, profit }) => (
                    <div key={rr} style={{ padding:'6px 4px', background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:'5px', textAlign:'center' }}>
                      <div style={{ fontSize:'9px', color:JT.success, fontWeight:'500' }}>1:{rr}</div>
                      <div style={{ fontSize:'10px', color:JT.textPrimary, fontWeight:'500' }}>{tpPrice.toFixed(2)}</div>
                      <div style={{ fontSize:'9px', color:JT.success }}>+{profit.toFixed(0)}$</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop:'10px', padding:'10px', background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:'6px', fontSize:'11px', color:JT.textTertiary, textAlign:'center' }}>
                Renseigne l'entrée et le stop loss pour calculer
              </div>
            )}
          </div>

          {/* Stats globales */}
          <div style={{ background:JT.surfSecondary, border:`1px solid ${JT.border}`, borderRadius:JT.radiusLg, padding:'14px' }}>
            <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>Statistiques du compte</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {[
                ['PnL TOTAL',      totalPnl>=0?`+${totalPnl.toFixed(2)}$`:`${totalPnl.toFixed(2)}$`, totalPnl>=0?JT.success:JT.danger],
                ['WIN RATE',       `${wr}%`,                                 wr>=50?JT.success:JT.danger],
                ['PROFIT FACTOR',  pf===99?'∞':pf.toFixed(2),               pf>=1.5?JT.success:pf>=1?JT.textPrimary:JT.danger],
                ['R:R MOYEN',      avgRR!=null?avgRR.toFixed(2):'—',        avgRR!=null?(avgRR>=settings.targetRR?JT.success:JT.warn):JT.textTertiary],
                ['MOY. WIN',       `+${avgWin.toFixed(2)}$`,                JT.success],
                ['MOY. LOSS',      avgLoss>0?`-${avgLoss.toFixed(2)}$`:'—', JT.danger],
                ['MAX DRAWDOWN',   `${maxDD.toFixed(2)}$`,                  maxDD>settings.maxDD*0.8?JT.danger:JT.warn],
                ['TOTAL TRADES',   String(trades.length),                    JT.textPrimary],
              ].map(([l,v,c]) => (
                <div key={l} style={{ padding:'8px 10px', background:'rgba(0,0,0,0.15)', borderRadius:JT.radiusMd, border:`1px solid ${JT.border}` }}>
                  <div style={{ fontSize:'10px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'4px' }}>{l}</div>
                  <div style={{ fontSize:'16px', fontWeight:'500', color:c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
const PF_TARGETS  = { topstep_50k:3000, topstep_100k:6000, topstep_150k:9000, lucid_eval_25k:1250, lucid_eval_50k:3000, lucid_eval_100k:6000, lucid_eval_150k:9000, tradovate_live:3000 };
const PF_MAXLOSS  = { topstep_50k:2000, topstep_100k:3000, topstep_150k:4500, lucid_eval_25k:1000, lucid_eval_50k:2000, lucid_eval_100k:3000, lucid_eval_150k:4500, tradovate_live:2000 };

const JOURNAL_TABS = [
  { key: 'overview', label: "VUE D'ENSEMBLE" },
  { key: 'trades',   label: 'TRADES' },
  { key: 'analyse',  label: 'ANALYSE' },
  { key: 'risk',     label: 'RISK MANAGER' },
];

export default function Journal() {
  const [trades,      setTrades]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [replayTrade, setReplayTrade] = useState(null);
  const [account,     setAccount]     = useState(null);
  const [stats,       setStats]       = useState(null);
  const location = useLocation();
  const [activeTab,   setActiveTab]   = useState(location.state?.tab ?? 'overview');
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
          <div style={{ fontSize:'11px', color:JT.textTertiary, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>HUB TRADING</div>
          <h1 style={{ fontSize:'22px', fontWeight:'500', color:T.text1, margin:0 }}>Journal</h1>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button
            onClick={() => navigate('/import')}
            style={{ background:'transparent', border:`1px solid ${JT.border}`, color:JT.textTertiary, padding:'9px 14px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'6px' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=JT.borderSecondary; e.currentTarget.style.color=JT.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=JT.border; e.currentTarget.style.color=JT.textTertiary; }}
          ><JtIconUpload color="currentColor" /> Import CSV</button>
          <button
            onClick={() => navigate('/journal/new')}
            style={{ background:JT.textPrimary, border:'none', color:'#0c0d16', padding:'9px 18px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', fontWeight:'500', cursor:'pointer', transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity='0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity='1'; }}
          >+ Nouveau trade</button>
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

      {/* Onglets */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:`1px solid ${T.border}0.10)` }}>
        {JOURNAL_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding:'8px 16px', background:'transparent', border:'none', borderBottom:`2px solid ${activeTab===t.key?T.accentL:'transparent'}`, color:activeTab===t.key?T.accentL:T.text3, fontSize:'13px', fontFamily:'inherit', letterSpacing:'2px', fontWeight:'700', cursor:'pointer', transition:'all 0.15s', marginBottom:'-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Vue d'ensemble */}
      <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
        <SyntheseTab trades={trades} loading={loading} />
      </div>

      {/* Trades */}
      <div style={{ display: activeTab === 'trades' ? 'block' : 'none' }}>
        <TradesTab trades={trades} loading={loading} navigate={navigate} onDelete={handleDelete} onFeeUpdate={handleFeeUpdate} onNoteUpdate={handleNoteUpdate} onReplay={setReplayTrade} />
      </div>

      {/* Analyse */}
      <div style={{ display: activeTab === 'analyse' ? 'block' : 'none' }}>
        <DrawdownAnalysisModule trades={trades} loading={loading} />

        <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'24px 0 16px' }}>
          <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
          <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>PATTERNS & HEAT MAP</span>
          <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        </div>
        <AnalyticsSection trades={trades} loading={loading} />

        <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
          <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
          <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>GRAPHIQUES & ANALYSES</span>
          <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        </div>
        <GraphiquesTab trades={trades} loading={loading} />
      </div>

      {/* Risk Manager */}
      <div style={{ display: activeTab === 'risk' ? 'block' : 'none' }}>
        <RiskManager trades={trades} account={account} loading={loading} />
      </div>
    </div>
    {replayTrade && <TradeReplay trade={replayTrade} onClose={() => setReplayTrade(null)} />}
    </>
  );
}
