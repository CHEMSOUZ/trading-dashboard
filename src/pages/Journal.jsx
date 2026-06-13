import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

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
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthLabel = now.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });

  return (
    <div style={{ background:`${T.bg}0.65)`, border:`1px solid ${T.border}0.10)`, borderRadius:'8px', padding:'14px 16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <span style={{ fontSize:'11px', color:T.text3, letterSpacing:'2.5px' }}>CALENDRIER — {monthLabel.toUpperCase()}</span>
        <div style={{ display:'flex', gap:'8px', fontSize:'11px', color:T.text4 }}>
          <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><span style={{ width:'8px', height:'8px', borderRadius:'2px', background:'rgba(0,204,119,0.4)', display:'inline-block' }} /> Profit</span>
          <span style={{ display:'flex', alignItems:'center', gap:'3px' }}><span style={{ width:'8px', height:'8px', borderRadius:'2px', background:'rgba(255,51,68,0.4)', display:'inline-block' }} /> Perte</span>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'4px' }}>
        {['LUN','MAR','MER','JEU','VEN','SAM','DIM'].map((d,i) => <div key={i} style={{ textAlign:'center', fontSize:'12px', color:T.text3, fontWeight:'700', paddingBottom:'4px' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const ds   = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
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
        })}
      </div>
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

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

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
    </div>
  );
}

// ── TRADES TAB ────────────────────────────────────────────────
function DayHeader({ date, dayTrades }) {
  const dayPnl = dayTrades.reduce((s,t) => s+(getNet(t)??0), 0);
  const wins   = dayTrades.filter(t => (getNet(t)??0) > 0).length;
  const losses = dayTrades.filter(t => (getNet(t)??0) < 0).length;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'7px 16px', borderRadius:'5px', background:`${T.bg}0.65)`, border:`1px solid ${T.border}0.08)`, marginBottom:'4px', marginTop:'14px' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ fontSize:'13px', fontWeight:'700', color:T.text1, textTransform:'capitalize' }}>{fmtDayLabel(date)}</span>
        <span style={{ fontSize:'12px', color:T.text3 }}>{dayTrades.length} trade{dayTrades.length>1?'s':''}</span>
      </div>
      <div style={{ display:'flex', gap:'5px' }}>
        {wins   > 0 && <span style={{ fontSize:'12px', color:'#00cc77', fontWeight:'600', background:'rgba(0,204,119,0.08)', border:'1px solid rgba(0,204,119,0.18)', padding:'1px 5px', borderRadius:'3px' }}>{wins}W</span>}
        {losses > 0 && <span style={{ fontSize:'12px', color:'#ff3344', fontWeight:'600', background:'rgba(255,51,68,0.08)', border:'1px solid rgba(255,51,68,0.18)', padding:'1px 5px', borderRadius:'3px' }}>{losses}L</span>}
      </div>
      <div style={{ fontWeight:'700', fontSize:'14px', color:pnlColor(dayPnl), letterSpacing:'-0.3px', minWidth:'85px', textAlign:'right' }}>{fmt(dayPnl,true)}</div>
    </div>
  );
}

function TradeRow({ trade, onDelete, onFeeUpdate, onClick }) {
  const net   = getNet(trade);
  const color = pnlColor(net ?? 0);
  const hasScreenshot = trade.screenshot && trade.screenshot !== 'null' && trade.screenshot.length > 4;
  let checklistScore = null;
  if (trade.notes) { const m=trade.notes.match(/\[(\d+)\/(\d+)\]/); if(m) checklistScore=`${m[1]}/${m[2]}`; }
  const notesClean = trade.notes ? trade.notes.replace(/\nChecklist:.*$/s,'').trim() : '';
  const entryTime  = trade.entered_at ? new Date(trade.entered_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : null;

  return (
    <div onClick={onClick}
      style={{ display:'grid', gridTemplateColumns:'3px 1fr auto', borderRadius:'6px', overflow:'hidden', background:`${T.bg}0.55)`, border:`1px solid ${T.border}0.07)`, cursor:'pointer', transition:'background 0.15s', marginBottom:'3px' }}
      onMouseEnter={e => e.currentTarget.style.background=`${T.bgHov}0.65)`}
      onMouseLeave={e => e.currentTarget.style.background=`${T.bg}0.55)`}>
      <div style={{ background:color, opacity:0.75 }} />
      <div style={{ padding:'10px 14px', display:'grid', gridTemplateColumns:'110px 68px 95px 70px 1fr 115px 85px 56px', gap:'8px', alignItems:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'13px', fontWeight:'700', color:T.text1 }}>{trade.pair}</span>
          {trade.size != null && <span style={{ fontSize:'12px', color:T.text3 }}>{trade.size} contrat{trade.size>1?'s':''}</span>}
        </div>
        <span style={{ fontSize:'12px', fontWeight:'700', letterSpacing:'0.5px', color:trade.direction==='LONG'?'#00cc77':'#ff3344', background:`rgba(${trade.direction==='LONG'?'0,204,119':'255,51,68'},0.10)`, border:`1px solid rgba(${trade.direction==='LONG'?'0,204,119':'255,51,68'},0.22)`, padding:'3px 7px', borderRadius:'3px', textAlign:'center', width:'fit-content' }}>{trade.direction}</span>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          <span style={{ fontSize:'12px', color:T.text3 }}>E <span style={{ color:T.text2 }}>{trade.entry??'—'}</span></span>
          <span style={{ fontSize:'12px', color:T.text3 }}>S <span style={{ color:T.text2 }}>{trade.exit_price??trade.tp??'—'}</span></span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
          {entryTime  && <span style={{ fontSize:'12px', color:T.text2 }}>{entryTime}</span>}
          {trade.duration && <span style={{ fontSize:'12px', color:T.text3 }}>{trade.duration}</span>}
          {trade.rr && <span style={{ fontSize:'12px', color:T.text3 }}>R {trade.rr}</span>}
        </div>
        <span style={{ fontSize:'12px', color:T.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {notesClean || <span style={{ color:T.text4, fontStyle:'italic' }}>—</span>}
        </span>
        <div onClick={e => e.stopPropagation()}><PnlCell trade={trade} /></div>
        <div onClick={e => e.stopPropagation()}><FraisCell trade={trade} onUpdate={onFeeUpdate} /></div>
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          {trade.emotion && <span title={trade.emotion} style={{ fontSize:'13px', cursor:'default' }}>{EMOTION_EMOJI[trade.emotion]||'😐'}</span>}
          {hasScreenshot && <span title="Screenshot" style={{ fontSize:'13px', color:T.text3 }}>📸</span>}
          {checklistScore && <span style={{ fontSize:'11px', color:T.text3, background:`${T.border}0.08)`, border:`1px solid ${T.border}0.15)`, borderRadius:'3px', padding:'1px 4px' }}>✓{checklistScore}</span>}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', padding:'0 10px' }}>
        <button onClick={e => { e.stopPropagation(); onDelete(trade.id,e); }}
          style={{ background:'none', border:'none', color:T.text4, cursor:'pointer', fontSize:'18px', padding:'4px', lineHeight:1, transition:'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color='#ff3344'}
          onMouseLeave={e => e.currentTarget.style.color=T.text4}>×</button>
      </div>
    </div>
  );
}

function TradesTab({ trades, loading, navigate, onDelete, onFeeUpdate }) {
  const [filter,    setFilter]    = useState('ALL');
  const [timeRange, setTimeRange] = useState('ALL');

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
  });

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
        {totalFees > 0 && (
          <span style={{ marginLeft:'auto', fontSize:'12px', color:'#f0a020' }}>Frais : -{totalFees.toFixed(2)}$</span>
        )}
      </div>

      {/* Column header */}
      {filtered.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'3px 1fr auto', marginBottom:'4px' }}>
          <div />
          <div style={{ padding:'0 14px', display:'grid', gridTemplateColumns:'110px 68px 95px 70px 1fr 115px 85px 56px', gap:'8px', fontSize:'11px', color:T.text3, letterSpacing:'1.5px' }}>
            <span>PAIRE</span><span>DIR.</span><span>PRIX</span><span>TEMPS</span><span>NOTES</span><span>P&L NET</span><span>FRAIS</span><span>TAGS</span>
          </div>
          <div style={{ width:'40px' }} />
        </div>
      )}

      {loading
        ? <div style={{ padding:'48px', textAlign:'center', color:T.text3, fontSize:'13px', letterSpacing:'2px' }}>CHARGEMENT...</div>
        : filtered.length === 0
          ? <div style={{ padding:'48px', textAlign:'center', border:`1px dashed ${T.border}0.15)`, borderRadius:'6px', color:T.text4, fontSize:'13px', letterSpacing:'2px' }}>
              {filter==='ALL'&&timeRange==='ALL' ? 'Aucun trade — commencez à journaliser !' : 'Aucun trade pour ces filtres'}
            </div>
          : sortedGroups.map(([date, dayTrades]) => (
              <div key={date}>
                <DayHeader date={date} dayTrades={dayTrades} />
                {dayTrades.map(t => (
                  <TradeRow key={t.id} trade={t} onDelete={onDelete} onFeeUpdate={onFeeUpdate} onClick={() => navigate(`/journal/${t.id}`)} />
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
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Journal() {
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadTrades(); }, []);

  async function loadTrades() {
    setLoading(true);
    const res = await window.db.getAllTrades();
    if (res.ok) setTrades(res.data.sort((a,b) => (b.date??'').localeCompare(a.date??'')||b.id-a.id));
    setLoading(false);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce trade ?')) return;
    await window.db.deleteTrade(id);
    setTrades(prev => prev.filter(t => t.id !== id));
  }

  function handleFeeUpdate(id, patch) {
    setTrades(prev => prev.map(t => t.id===id ? {...t,...patch} : t));
  }

  return (
    <div style={{ padding:'24px 28px', width:'100%', boxSizing:'border-box', maxWidth:'none' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <div style={{ fontSize:'12px', color:T.text3, letterSpacing:'3px', marginBottom:'5px' }}>HUB TRADING</div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:T.text1, margin:0, letterSpacing:'-0.5px' }}>Journal</h1>
        </div>
        <button
          onClick={() => navigate('/journal/new')}
          style={{ background:`${T.border}0.12)`, border:`1px solid ${T.border}0.35)`, color:T.accentL, padding:'9px 18px', borderRadius:'6px', fontSize:'12px', fontFamily:'inherit', letterSpacing:'1.5px', cursor:'pointer', fontWeight:'700', transition:'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background=`${T.border}0.22)`; e.currentTarget.style.boxShadow='0 0 16px rgba(136,153,187,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background=`${T.border}0.12)`; e.currentTarget.style.boxShadow='none'; }}
        >+ NOUVEAU TRADE</button>
      </div>

      {/* Synthèse — stats + equity + calendar */}
      <SyntheseTab trades={trades} loading={loading} />

      {/* Séparateur Trades */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>HISTORIQUE DES TRADES</span>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
      </div>
      <TradesTab trades={trades} loading={loading} navigate={navigate} onDelete={handleDelete} onFeeUpdate={handleFeeUpdate} />

      {/* Séparateur Graphiques */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 16px' }}>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
        <span style={{ fontSize:'12px', color:T.text3, letterSpacing:'2.5px', fontWeight:'700' }}>GRAPHIQUES & ANALYSES</span>
        <div style={{ height:'1px', flex:1, background:`${T.border}0.10)` }} />
      </div>
      <GraphiquesTab trades={trades} loading={loading} />
    </div>
  );
}
