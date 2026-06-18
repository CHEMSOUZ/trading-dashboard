import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';

// ── Configuration complète par type de compte ──────────────────
const ACCOUNT_CONFIGS = {
  // Trading Combine — Évaluation (MLL trailing, cible profit, consistency)
  topstep_50k:       { phase:'combine',        size:50000,  maxLoss:2000, target:3000, consistency:0.50, minDays:5 },
  topstep_100k:      { phase:'combine',        size:100000, maxLoss:3000, target:6000, consistency:0.50, minDays:5 },
  topstep_150k:      { phase:'combine',        size:150000, maxLoss:4500, target:9000, consistency:0.50, minDays:5 },
  lucid_eval_25k:    { phase:'combine',        size:25000,  maxLoss:1000, target:1250, consistency:0.50, minDays:5 },
  lucid_eval_50k:    { phase:'combine',        size:50000,  maxLoss:2000, target:3000, consistency:0.50, minDays:5 },
  lucid_eval_100k:   { phase:'combine',        size:100000, maxLoss:3000, target:6000, consistency:0.50, minDays:5 },
  lucid_eval_150k:   { phase:'combine',        size:150000, maxLoss:4500, target:9000, consistency:0.50, minDays:5 },
  tradovate_live:    { phase:'combine',        size:50000,  maxLoss:2000, target:3000, consistency:0.50, minDays:5 },
  // Express Funded Standard — MLL trailing + 5 jours ≥150$
  topstep_ef_50k:    { phase:'ef_standard',   size:50000,  maxLoss:2000, winDaysNeeded:5, winDayMin:150 },
  topstep_ef_100k:   { phase:'ef_standard',   size:100000, maxLoss:3000, winDaysNeeded:5, winDayMin:150 },
  topstep_ef_150k:   { phase:'ef_standard',   size:150000, maxLoss:4500, winDaysNeeded:5, winDayMin:150 },
  lucid_funded_25k:  { phase:'ef_standard',   size:25000,  maxLoss:1000, winDaysNeeded:5, winDayMin:150 },
  lucid_funded_50k:  { phase:'ef_standard',   size:50000,  maxLoss:2500, winDaysNeeded:5, winDayMin:150 },
  lucid_funded_100k: { phase:'ef_standard',   size:100000, maxLoss:3000, winDaysNeeded:5, winDayMin:150 },
  lucid_funded_150k: { phase:'ef_standard',   size:150000, maxLoss:4500, winDaysNeeded:5, winDayMin:150 },
  // Express Funded Consistency — MLL trailing + 3 jours + consistency ≤40%
  topstep_cons_50k:  { phase:'ef_consistency', size:50000,  maxLoss:2000, minTradeDays:3, maxConsistency:0.40 },
  topstep_cons_100k: { phase:'ef_consistency', size:100000, maxLoss:3000, minTradeDays:3, maxConsistency:0.40 },
  topstep_cons_150k: { phase:'ef_consistency', size:150000, maxLoss:4500, minTradeDays:3, maxConsistency:0.40 },
  // Live Funded — Floor $0, Daily Loss Limit, 5 jours ≥150$
  topstep_live_50k:  { phase:'live', size:50000,  dailyLoss:1000, winDaysNeeded:5, winDayMin:150 },
  topstep_live_100k: { phase:'live', size:100000, dailyLoss:2000, winDaysNeeded:5, winDayMin:150 },
  topstep_live_150k: { phase:'live', size:150000, dailyLoss:3000, winDaysNeeded:5, winDayMin:150 },
};
const DEFAULT_CFG = ACCOUNT_CONFIGS['topstep_50k'];

const PHASE_OPTIONS = [
  { group:'TRADING COMBINE — Évaluation', phase:'combine', color:'#8899bb', options:[
    { value:'topstep_50k',  label:'50K',  sub:'Target +3 000$ · MLL -2 000$ · Consistency <50%' },
    { value:'topstep_100k', label:'100K', sub:'Target +6 000$ · MLL -3 000$ · Consistency <50%' },
    { value:'topstep_150k', label:'150K', sub:'Target +9 000$ · MLL -4 500$ · Consistency <50%' },
  ]},
  { group:'EXPRESS FUNDED STANDARD', phase:'ef_standard', color:'#f0c020', options:[
    { value:'topstep_ef_50k',  label:'50K',  sub:'MLL trailing · 5 jours ≥150$ · Verrou 52 000$' },
    { value:'topstep_ef_100k', label:'100K', sub:'MLL trailing · 5 jours ≥150$ · Verrou 103 000$' },
    { value:'topstep_ef_150k', label:'150K', sub:'MLL trailing · 5 jours ≥150$ · Verrou 154 500$' },
  ]},
  { group:'EXPRESS FUNDED CONSISTENCY', phase:'ef_consistency', color:'#aa88ff', options:[
    { value:'topstep_cons_50k',  label:'50K',  sub:'MLL trailing · 3 jours tradés · Consistency ≤40%' },
    { value:'topstep_cons_100k', label:'100K', sub:'MLL trailing · 3 jours tradés · Consistency ≤40%' },
    { value:'topstep_cons_150k', label:'150K', sub:'MLL trailing · 3 jours tradés · Consistency ≤40%' },
  ]},
  { group:'LIVE FUNDED ACCOUNT', phase:'live', color:'#00cc77', options:[
    { value:'topstep_live_50k',  label:'50K',  sub:'Floor 0$ · Daily Limit -1 000$ · 5 jours ≥150$' },
    { value:'topstep_live_100k', label:'100K', sub:'Floor 0$ · Daily Limit -2 000$ · 5 jours ≥150$' },
    { value:'topstep_live_150k', label:'150K', sub:'Floor 0$ · Daily Limit -3 000$ · 5 jours ≥150$' },
  ]},
];

const PHASE_COLORS = {
  combine:        '#8899bb',
  ef_standard:    '#f0c020',
  ef_consistency: '#aa88ff',
  live:           '#00cc77',
};
const PHASE_LABELS = {
  combine:        '🎯 Trading Combine',
  ef_standard:    '💰 Express Funded Standard',
  ef_consistency: '⚡ Express Funded Consistency',
  live:           '🌟 Live Funded Account',
};

// ── Helpers ────────────────────────────────────────────────────
const getNet   = t => t.result_net ?? t.result ?? 0;
const round2   = n => Math.round(n * 100) / 100;
const pnlColor = v => v > 0 ? '#00cc77' : v < 0 ? '#ff3344' : '#7888a0';
function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}

function buildByDay(trades) {
  const m = {};
  for (const t of trades) {
    const d = (t.entered_at || t.date || '').slice(0, 10);
    if (d) m[d] = (m[d] || 0) + getNet(t);
  }
  return m;
}
function sortedByDay(trades) {
  return Object.entries(buildByDay(trades)).sort(([a],[b]) => a.localeCompare(b));
}

// MLL trailing: starts at size-maxLoss, trails up with highWater, locks at size, after payout → 0
function computeTrailingMLL(trades, size, maxLoss, postPayout = false) {
  const entries = sortedByDay(trades);
  const mllInit = postPayout ? 0 : size - maxLoss;
  let bal = size, highBal = size, mll = mllInit;
  const pts = [{ date:'Début', balance:bal, mll:round2(mll) }];
  for (const [d, pnl] of entries) {
    bal += pnl;
    if (!postPayout) {
      highBal = Math.max(highBal, bal);
      mll = Math.min(size, Math.max(mll, highBal - maxLoss));
    }
    pts.push({ date:d.slice(5), balance:round2(bal), mll:round2(postPayout ? 0 : mll) });
  }
  return { points:pts, mll: postPayout ? 0 : mll, isLocked: postPayout || mll >= size };
}

// ── Sub-components ─────────────────────────────────────────────
function CTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(8,9,16,0.97)', border:'1px solid rgba(136,153,187,0.22)', borderRadius:'4px', padding:'8px 12px', fontSize:'13px', fontFamily:'inherit' }}>
      <div style={{ color:'#5a6a82', marginBottom:'4px' }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.name==='MLL'?'#ff4455':p.name==='Balance'?'#8899bb':pnlColor(p.value??0), fontWeight:'700' }}>
          {p.name}: {typeof p.value==='number' ? `${p.value.toFixed(2)}$` : p.value}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, color='#dde4ef', alert=false, featured=false }) {
  if (featured) {
    const rgb = color === '#00cc77' ? '0,204,119' : color === '#ff3344' ? '255,51,68' : '136,153,187';
    return (
      <div style={{ gridColumn:'span 2', minWidth:0, background:`linear-gradient(135deg, rgba(${rgb},0.22), rgba(${rgb},0.05))`, border:`1px solid rgba(${rgb},0.35)`, borderRadius:'8px', padding:'18px 20px' }}>
        <div style={{ fontSize:'14px', color:'#8898aa', letterSpacing:'1.5px', marginBottom:'8px' }}>{label}</div>
        <div style={{ fontSize:'34px', fontWeight:'800', color, letterSpacing:'-0.8px', lineHeight:1, overflowWrap:'anywhere' }}>{value}</div>
        {sub && <div style={{ fontSize:'13px', color:'#8898aa', marginTop:'7px' }}>{sub}</div>}
      </div>
    );
  }
  return (
    <div style={{ background:alert?'rgba(255,68,85,0.06)':'rgba(14,15,22,0.5)', border:`1px solid ${alert?'rgba(255,68,85,0.30)':'rgba(136,153,187,0.10)'}`, borderTop:`2px solid ${color}`, borderRadius:'6px', padding:'14px 16px' }}>
      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'1.5px', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'16px', fontWeight:'700', color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'13px', color:alert?'#ff8888':'#5a6a82', marginTop:'5px' }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ label, current, max, color, displayText, note }) {
  const pct = Math.min((Math.max(current,0)/Math.max(max,1))*100, 100);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
      {(label || displayText) && (
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          {label && <span style={{ fontSize:'13px', color:'#7888a0' }}>{label}</span>}
          {displayText && <span style={{ fontSize:'13px', color, fontWeight:'700' }}>{displayText}</span>}
        </div>
      )}
      <div style={{ height:'6px', background:'rgba(136,153,187,0.08)', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:'3px', transition:'width 0.5s ease', boxShadow:`0 0 6px ${color}60` }} />
      </div>
      {note && <div style={{ fontSize:'12px', color:'#5a6a82' }}>{note}</div>}
    </div>
  );
}

function ObjRow({ ok, pending, label, detail, children }) {
  const icon  = ok ? '✅' : pending ? '⏳' : '❌';
  const border= ok ? 'rgba(0,204,119,0.18)' : pending ? 'rgba(136,153,187,0.10)' : 'rgba(255,68,85,0.28)';
  const bg    = ok ? 'rgba(0,204,119,0.04)'  : pending ? 'rgba(14,15,22,0.4)'     : 'rgba(255,68,85,0.05)';
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:'6px', padding:'14px 16px', display:'flex', gap:'12px', alignItems:'flex-start' }}>
      <span style={{ fontSize:'18px', flexShrink:0, marginTop:'1px' }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'13px', color:'#dde4ef', fontWeight:'600', marginBottom:(children||detail)?'8px':0 }}>{label}</div>
        {detail && <div style={{ fontSize:'13px', color:'#5868a0', marginBottom:children?'8px':0 }}>{detail}</div>}
        {children}
      </div>
    </div>
  );
}

function WinDayBadge({ date, pnl, minAmount }) {
  const qual  = pnl >= minAmount;
  const color = pnl > 0 ? (qual ? '#00cc77' : '#f0a020') : '#ff4455';
  return (
    <div title={`${date}: ${fmt(pnl,true)}${qual?' ✓ qualifiant':''}`}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', minWidth:'38px' }}>
      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:`rgba(${pnl>0?(qual?'0,204,119':'240,160,32'):'255,68,85'},0.12)`, border:`2px solid ${color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', color, fontWeight:'700' }}>
        {pnl > 0 ? (qual ? '✓' : '+') : '✗'}
      </div>
      <span style={{ fontSize:'11px', color:'#5a6a82', textAlign:'center' }}>{date.slice(5)}</span>
    </div>
  );
}

function MLLSection({ mll, size, maxLoss, balance, isLocked, postPayout }) {
  const dist      = balance - mll;
  const alert     = dist < 500 && !postPayout;
  const lockLevel = size + maxLoss;
  return (
    <div style={{ background:alert?'rgba(255,68,85,0.06)':'rgba(14,15,22,0.4)', border:`1px solid ${alert?'rgba(255,68,85,0.30)':'rgba(136,153,187,0.10)'}`, borderRadius:'8px', padding:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
        <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>MAXIMUM LOSS LIMIT (MLL)</div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {postPayout
            ? <span style={{ background:'rgba(0,204,119,0.12)', border:'1px solid rgba(0,204,119,0.35)', borderRadius:'4px', padding:'3px 10px', fontSize:'12px', color:'#00cc77', fontWeight:'700' }}>🔒 FIXÉE À 0$ — APRÈS PAYOUT</span>
            : isLocked
              ? <span style={{ background:'rgba(136,153,187,0.12)', border:'1px solid rgba(136,153,187,0.35)', borderRadius:'4px', padding:'3px 10px', fontSize:'12px', color:'#8899bb', fontWeight:'700' }}>🔒 VERROUILLÉE À {size.toLocaleString()}$</span>
              : <span style={{ background:'rgba(240,160,32,0.08)', border:'1px solid rgba(240,160,32,0.25)', borderRadius:'4px', padding:'3px 10px', fontSize:'12px', color:'#f0a020' }}>⚡ Verrou dès {lockLevel.toLocaleString()}$ → MLL = {size.toLocaleString()}$</span>
          }
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'8px', marginBottom:'12px' }}>
        <MetricCard label="MLL ACTUEL" value={`${mll.toLocaleString()}$`}
          color={postPayout?'#00cc77':isLocked?'#8899bb':'#ff4455'}
          sub={postPayout?'Fixée à 0$ à vie':isLocked?'Verrouillée définitivement':'Trailing ↑ jamais ↓'} />
        <MetricCard label="MARGE RESTANTE" value={`${dist.toFixed(0)}$`}
          color={alert?'#ff4455':dist<1000?'#f0a020':'#8899bb'}
          alert={alert} sub="Balance − MLL" />
        {!isLocked && !postPayout && (
          <MetricCard label="VERROU À" value={`${lockLevel.toLocaleString()}$`} color="#f0a020"
            sub={`+ ${(lockLevel-balance).toFixed(0)}$ restant`} />
        )}
      </div>

      <div style={{ height:'16px', background:'rgba(0,0,0,0.3)', borderRadius:'4px', overflow:'hidden', position:'relative' }}>
        <div style={{ height:'100%', width:`${Math.min((dist/Math.max(maxLoss,1))*100,100)}%`, background:alert?'linear-gradient(90deg,#ff4455,#ff6677)':dist<1000?'linear-gradient(90deg,#f0a020,#f0c040)':'linear-gradient(90deg,#566880,#8899bb)', borderRadius:'4px', transition:'width 0.5s ease' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'rgba(255,255,255,0.80)', fontWeight:'700' }}>
          Marge: {dist.toFixed(0)}$ · MLL: {mll.toLocaleString()}$
        </div>
      </div>

      {isLocked && !postPayout && (
        <div style={{ marginTop:'10px', background:'rgba(136,153,187,0.08)', border:'1px solid rgba(136,153,187,0.20)', borderRadius:'4px', padding:'8px 12px', fontSize:'13px', color:'#8899bb' }}>
          🔒 MLL verrouillée à {size.toLocaleString()}$ — ton capital de départ est protégé définitivement.
        </div>
      )}

      <div style={{ marginTop:'10px', background:'rgba(0,170,255,0.05)', border:'1px solid rgba(0,170,255,0.12)', borderRadius:'4px', padding:'8px 12px', fontSize:'12px', color:'#5a6a82' }}>
        ℹ La MLL peut augmenter mais ne diminue jamais · Se verrouille définitivement au solde de départ · Après 1er payout → fixée à 0$
      </div>
    </div>
  );
}

function PayoutBox() {
  return (
    <div style={{ background:'rgba(240,192,32,0.05)', border:'1px solid rgba(240,192,32,0.18)', borderRadius:'6px', padding:'12px 16px', display:'flex', gap:'14px', alignItems:'center', flexWrap:'wrap' }}>
      <span style={{ fontSize:'18px' }}>💸</span>
      <div>
        <div style={{ fontSize:'13px', color:'#f0c020', letterSpacing:'1.5px', fontWeight:'700', marginBottom:'4px' }}>PAYOUT</div>
        <div style={{ fontSize:'13px', color:'#7888a0', display:'flex', gap:'16px', flexWrap:'wrap' }}>
          <span>Minimum : <strong style={{ color:'#f0c020' }}>125$</strong></span>
          <span>Répartition : <strong style={{ color:'#f0c020' }}>90% / 10%</strong></span>
          <span>Pendant les heures CME</span>
          <span>Via le dashboard Topstep</span>
        </div>
      </div>
    </div>
  );
}

function BalanceRow({ balanceInput, setBalanceInput, onSave, status }) {
  return (
    <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
      <div style={{ display:'flex', gap:'6px' }}>
        <input type="number" placeholder="Balance réelle ($)" value={balanceInput}
          onChange={e => setBalanceInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && onSave()}
          style={{ background:'rgba(14,15,22,0.6)', border:'1px solid rgba(136,153,187,0.18)', borderRadius:'4px', padding:'7px 10px', color:'#dde4ef', fontSize:'13px', fontFamily:'inherit', outline:'none', width:'170px' }} />
        <button onClick={onSave}
          style={{ background:'rgba(136,153,187,0.12)', border:'1px solid rgba(136,153,187,0.28)', color:'#8899bb', padding:'7px 14px', borderRadius:'4px', fontSize:'13px', fontFamily:'inherit', cursor:'pointer' }}>MAJ</button>
      </div>
      <div style={{ background:`rgba(${status.color==='#ff4455'?'255,68,85':status.color==='#00cc77'?'0,204,119':status.color==='#8899bb'?'136,153,187':'240,160,32'},0.10)`, border:`1px solid ${status.color}40`, borderRadius:'6px', padding:'8px 16px', fontSize:'13px', fontWeight:'700', color:status.color }}>
        {status.label}
      </div>
    </div>
  );
}

function PostPayoutToggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ background:value?'rgba(0,204,119,0.12)':'rgba(14,15,22,0.5)', border:`1px solid ${value?'rgba(0,204,119,0.40)':'rgba(136,153,187,0.18)'}`, color:value?'#00cc77':'#5a6a82', padding:'7px 14px', borderRadius:'4px', fontSize:'13px', fontFamily:'inherit', cursor:'pointer' }}>
      {value ? '✓ 1er Payout reçu — MLL=0$' : '⬜ Marquer 1er Payout reçu'}
    </button>
  );
}

// ── Charts ─────────────────────────────────────────────────────
function MLLChart({ points, lockLevel, targetBalance }) {
  if (points.length < 2) return (
    <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#3a4a62', fontSize:'13px' }}>Aucun trade</div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={points} margin={{ top:5, right:10, bottom:0, left:10 }}>
        <defs>
          <linearGradient id="balG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#8899bb" stopOpacity={0.20}/>
            <stop offset="95%" stopColor="#8899bb" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(136,153,187,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
        <Tooltip content={<CTooltip />} />
        {targetBalance && <ReferenceLine y={targetBalance} stroke="#8899bb" strokeDasharray="4 4" strokeOpacity={0.55} label={{ value:'Target', fill:'#8899bb', fontSize:10, position:'insideTopRight' }} />}
        {lockLevel && <ReferenceLine y={lockLevel} stroke="#f0a020" strokeDasharray="4 4" strokeOpacity={0.45} label={{ value:'Verrou', fill:'#f0a020', fontSize:10, position:'insideTopRight' }} />}
        <Area type="monotone" dataKey="balance" name="Balance" stroke="#8899bb" strokeWidth={2} fill="url(#balG)" dot={false} />
        <Area type="monotone" dataKey="mll" name="MLL" stroke="#ff4455" strokeWidth={1.5} fill="none" strokeDasharray="3 3" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DailyBarChart({ dailyArr, consistencyLine, winDayMin }) {
  if (!dailyArr.length) return (
    <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#3a4a62', fontSize:'13px' }}>Aucun trade</div>
  );
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={dailyArr} margin={{ top:5, right:10, bottom:0, left:5 }} barCategoryGap="35%">
        <CartesianGrid stroke="rgba(136,153,187,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${v}$`} />
        <Tooltip content={<CTooltip />} />
        <ReferenceLine y={0} stroke="rgba(136,153,187,0.18)" />
        {consistencyLine != null && (
          <ReferenceLine y={consistencyLine} stroke="#f0a020" strokeDasharray="4 4" strokeOpacity={0.65}
            label={{ value:`${consistencyLine.toFixed(0)}$`, fill:'#f0a020', fontSize:10, position:'right' }} />
        )}
        {winDayMin != null && (
          <ReferenceLine y={winDayMin} stroke="#00cc77" strokeDasharray="4 4" strokeOpacity={0.55}
            label={{ value:`${winDayMin}$`, fill:'#00cc77', fontSize:10, position:'right' }} />
        )}
        <Bar dataKey="pnl" name="P&L" radius={[3,3,0,0]} maxBarSize={6} isAnimationActive>
          {dailyArr.map((d,i) => (
            <Cell key={i} fill={d.pnl>0?(winDayMin&&d.pnl>=winDayMin?'#00cc77':'#f0a020'):'#ff4455'} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Phase Selector ─────────────────────────────────────────────
function PhaseSelector({ account, onChanged }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel]   = useState(account?.type ?? '');
  const [saving, setSaving] = useState(false);

  const allOpts = PHASE_OPTIONS.flatMap(g => g.options.map(o => ({ ...o, groupColor:g.color })));
  const current = allOpts.find(o => o.value === account?.type);
  const cfg     = ACCOUNT_CONFIGS[account?.type] ?? DEFAULT_CFG;
  const phColor = PHASE_COLORS[cfg.phase] ?? '#5a6a82';
  const phLabel = PHASE_LABELS[cfg.phase]  ?? 'Non défini';

  async function confirm() {
    if (!account || sel === account?.type) { setOpen(false); return; }
    setSaving(true);
    await window.accounts.update(account.id, { type:sel });
    setSaving(false); setOpen(false);
    onChanged(sel);
    window.dispatchEvent(new Event('account-updated'));
  }

  return (
    <div>
      <div style={{ background:'rgba(0,0,0,0.25)', border:`1px solid ${phColor}22`, borderLeft:`3px solid ${phColor}`, borderRadius:'6px', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'3px' }}>PHASE DU COMPTE</div>
          {current ? (
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'14px', fontWeight:'700', color:'#e8edf8' }}>{phLabel}</span>
              <span style={{ fontSize:'13px', color:phColor, fontWeight:'600' }}>{current.label}</span>
              <span style={{ fontSize:'12px', color:'#5a6a82' }}>{current.sub}</span>
            </div>
          ) : (
            <div style={{ fontSize:'13px', color:'#f0a020' }}>⚠ Phase non définie — configurer →</div>
          )}
        </div>
        <button onClick={() => { setSel(account?.type ?? ''); setOpen(true); }}
          style={{ background:'rgba(0,170,255,0.10)', border:'1px solid rgba(0,170,255,0.25)', color:'#00aaff', padding:'7px 14px', borderRadius:'4px', fontSize:'13px', fontFamily:'inherit', cursor:'pointer', letterSpacing:'1px', fontWeight:'600', whiteSpace:'nowrap' }}>
          Changer →
        </button>
      </div>

      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#0c0d16', border:'1px solid rgba(136,153,187,0.35)', borderRadius:'10px', padding:'24px', width:'620px', maxWidth:'100%', maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'4px' }}>TOPSTEP PROPFIRM</div>
                <div style={{ fontSize:'16px', fontWeight:'700', color:'#e8edf8' }}>Sélectionner le type de compte</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'1px solid #1e2c40', color:'#5868a0', width:'28px', height:'28px', borderRadius:'50%', cursor:'pointer', fontSize:'16px' }}>×</button>
            </div>

            {PHASE_OPTIONS.map(grp => {
              const rStr = grp.color==='#8899bb'?'136,153,187':grp.color==='#f0c020'?'240,192,32':grp.color==='#aa88ff'?'170,136,255':'0,204,119';
              return (
                <div key={grp.group} style={{ marginBottom:'16px' }}>
                  <div style={{ fontSize:'12px', color:grp.color, letterSpacing:'2px', marginBottom:'8px', opacity:0.9 }}>— {grp.group}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:'6px' }}>
                    {grp.options.map(opt => {
                      const isAct = sel === opt.value;
                      return (
                        <div key={opt.value} onClick={() => setSel(opt.value)}
                          style={{ padding:'10px 12px', borderRadius:'6px', cursor:'pointer', background:isAct?`rgba(${rStr},0.10)`:'rgba(14,15,22,0.4)', border:`1px solid ${isAct?grp.color+'55':'rgba(136,153,187,0.08)'}`, transition:'all 0.15s' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                            <div style={{ width:'12px', height:'12px', borderRadius:'50%', border:`2px solid ${isAct?grp.color:'#2a3a52'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              {isAct && <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:grp.color }} />}
                            </div>
                            <span style={{ fontSize:'14px', fontWeight:'700', color:isAct?'#e8edf8':'#7888a0' }}>{opt.label}</span>
                          </div>
                          <div style={{ fontSize:'12px', color:'#4a5a72', paddingLeft:'20px', lineHeight:'1.5' }}>{opt.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'16px' }}>
              <button onClick={() => setOpen(false)} style={{ padding:'9px 18px', borderRadius:'5px', border:'1px solid #1e2c40', background:'transparent', color:'#6878a0', fontSize:'13px', fontFamily:'inherit', cursor:'pointer' }}>Annuler</button>
              <button onClick={confirm} disabled={saving || !sel || sel===account?.type}
                style={{ padding:'9px 22px', borderRadius:'5px', background:!sel||sel===account?.type?'rgba(14,15,22,0.4)':'rgba(136,153,187,0.18)', border:`1px solid ${!sel||sel===account?.type?'#1e2c40':'rgba(136,153,187,0.40)'}`, color:!sel||sel===account?.type?'#3c4c64':'#8899bb', fontSize:'13px', fontFamily:'inherit', fontWeight:'700', letterSpacing:'1px', cursor:saving||!sel||sel===account?.type?'not-allowed':'pointer' }}>
                {saving ? 'SAUVEGARDE...' : sel===account?.type ? 'DÉJÀ ACTIF' : '✓ CONFIRMER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TRADING COMBINE ────────────────────────────────────────────
function CombineTab({ trades, cfg, manualBalance, balanceInput, setBalanceInput, onSaveBalance }) {
  const { size, maxLoss, target, consistency, minDays = 5 } = cfg;
  const totalNet = trades.reduce((s,t) => s + getNet(t), 0);
  const balance  = manualBalance > 0 ? manualBalance : size + totalNet;

  const { points:mllPts, mll, isLocked } = computeTrailingMLL(trades, size, maxLoss, false);
  const dist = balance - mll;
  const lost = balance <= mll;

  const byDay      = buildByDay(trades);
  const dayEntries = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const dailyArr   = dayEntries.map(([d,p]) => ({ date:d.slice(5), pnl:round2(p) }));

  // Consistency rule: best day < 50% of target; if breached, target adjusts
  const posDays  = dayEntries.filter(([,p]) => p > 0);
  const bestDay  = posDays.length > 0 ? Math.max(...posDays.map(([,p]) => p)) : 0;
  const consLimit = target * consistency;
  const consBreach= bestDay > 0 && bestDay >= consLimit;
  const dynTarget = consBreach ? Math.ceil(bestDay / consistency) : target;
  const dynLimit  = dynTarget * consistency;
  const targetOk  = totalNet >= dynTarget;
  // consOk requires at least one positive day AND no breach
  const consOk    = posDays.length > 0 && !consBreach;
  // Minimum trading days (all days with any activity, positive or not)
  const tradeDays = dayEntries.length;
  const daysOk    = tradeDays >= minDays;

  const status = lost
    ? { label:'COMPTE ÉLIMINÉ ❌', color:'#ff4455' }
    : (targetOk && consOk && daysOk)
      ? { label:'✅ CHALLENGE VALIDÉ', color:'#00cc77' }
      : { label:'⏳ EN COURS', color:'#f0a020' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>RÈGLE</div>
      <ObjRow ok={!lost} pending={!lost}
        label={`Ne pas descendre sous la MLL — trailing depuis ${(size-maxLoss).toLocaleString()}$`}
        detail={`Balance : ${balance.toFixed(2)}$ · MLL : ${mll.toFixed(2)}$ · Marge : ${dist.toFixed(2)}$`} />

      <BalanceRow balanceInput={balanceInput} setBalanceInput={setBalanceInput} onSave={onSaveBalance} status={status} />

      {consBreach && (
        <div style={{ background:'rgba(240,160,32,0.08)', border:'1px solid rgba(240,160,32,0.30)', borderRadius:'6px', padding:'12px 16px', display:'flex', gap:'12px' }}>
          <span style={{ fontSize:'20px', flexShrink:0 }}>⚡</span>
          <div>
            <div style={{ fontSize:'13px', color:'#f0a020', fontWeight:'700', marginBottom:'4px' }}>Règle Consistency — Target ajusté</div>
            <div style={{ fontSize:'13px', color:'#7888a0' }}>
              Meilleur jour ({fmt(bestDay)}) ≥ {(consistency*100).toFixed(0)}% du target initial ({fmt(consLimit)}).
              Nouveau target nécessaire : <strong style={{ color:'#f0c020' }}>{dynTarget.toLocaleString()}$</strong>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>OBJECTIFS</div>

      <ObjRow ok={targetOk} pending={!targetOk&&!lost}
        label={`Profit Target — atteindre et maintenir +${dynTarget.toLocaleString()}$${consBreach?' ⚡ ajusté':''}`}>
        <ProgressBar current={Math.max(totalNet,0)} max={dynTarget} color={targetOk?'#00cc77':'#f0a020'}
          displayText={`${fmt(totalNet,true)} / +${dynTarget.toLocaleString()}$`} />
      </ObjRow>

      <ObjRow ok={consOk} pending={posDays.length===0}
        label={`Consistency — aucun jour ≥ ${(consistency*100).toFixed(0)}% du target (< ${dynLimit.toFixed(0)}$)`}
        detail={bestDay>0 ? `Meilleur jour : ${fmt(bestDay)} · Limite : ${fmt(dynLimit)}` : 'Aucun jour positif pour le moment'} />

      <ObjRow ok={daysOk} pending={!daysOk&&!lost}
        label={`Jours tradés minimum — ${minDays} jours requis`}
        detail={`${tradeDays} jour${tradeDays>1?'s':''} tradé${tradeDays>1?'s':''} · Requis : ${minDays}`} />

      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>DRAWDOWN — MLL TRAILING</div>
      <MLLSection mll={mll} size={size} maxLoss={maxLoss} balance={balance} isLocked={isLocked} postPayout={false} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px' }}>
        <MetricCard label="BALANCE" value={`${balance.toFixed(0)}$`} color={targetOk?'#00cc77':'#dde4ef'} sub={manualBalance>0?'Manuelle':'Calculée'} />
        <MetricCard label="PROFIT NET" value={fmt(totalNet,true)} color={pnlColor(totalNet)} sub={`Objectif +${dynTarget.toLocaleString()}$`} featured />
        <MetricCard label="MLL" value={`${mll.toLocaleString()}$`} color={isLocked?'#8899bb':'#ff4455'} alert={dist<500} sub={isLocked?'🔒 Verrouillée':'Trailing ↑'} />
        <MetricCard label="MEILLEUR JOUR" value={bestDay>0?fmt(bestDay,true):'—'} color={consBreach?'#f0a020':'#8899bb'} sub={`< ${dynLimit.toFixed(0)}$ requis`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>CAPITAL + MLL TRAILING</div>
          <MLLChart points={mllPts} lockLevel={size+maxLoss} targetBalance={size+dynTarget} />
        </div>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>P&L PAR JOUR · limite consistency</div>
          <DailyBarChart dailyArr={dailyArr} consistencyLine={dynLimit} />
        </div>
      </div>

      {targetOk && consOk && daysOk && !lost && (
        <div style={{ background:'rgba(0,204,119,0.08)', border:'2px solid rgba(0,204,119,0.50)', borderRadius:'8px', padding:'20px', textAlign:'center', boxShadow:'0 0 30px rgba(0,204,119,0.08)' }}>
          <div style={{ fontSize:'26px', marginBottom:'6px' }}>🎉</div>
          <div style={{ fontSize:'18px', fontWeight:'700', color:'#00cc77', marginBottom:'4px' }}>TRADING COMBINE VALIDÉ !</div>
          <div style={{ fontSize:'13px', color:'#5868a0' }}>Profit target atteint · Consistency respectée · {minDays} jours tradés · Demande ton compte Funded.</div>
        </div>
      )}
    </div>
  );
}

// ── EXPRESS FUNDED STANDARD ────────────────────────────────────
function ExpressStdTab({ trades, cfg, manualBalance, balanceInput, setBalanceInput, onSaveBalance, postPayout, setPostPayout }) {
  const { size, maxLoss, winDaysNeeded, winDayMin } = cfg;
  const totalNet = trades.reduce((s,t) => s + getNet(t), 0);
  const balance  = manualBalance > 0 ? manualBalance : size + totalNet;
  const { points, mll, isLocked } = computeTrailingMLL(trades, size, maxLoss, postPayout);

  const byDay      = buildByDay(trades);
  const dayEntries = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const dailyArr   = dayEntries.map(([d,p]) => ({ date:d.slice(5), pnl:round2(p) }));
  const qualDays   = dayEntries.filter(([,p]) => p >= winDayMin);
  const payoutOk   = qualDays.length >= winDaysNeeded;
  const dist       = balance - mll;
  const lost       = balance <= mll;

  const status = lost
    ? { label:'COMPTE PERDU ❌', color:'#ff4455' }
    : isLocked ? { label:'🔒 MLL VERROUILLÉE — ZONE SÉCURISÉE', color:'#8899bb' }
    : dist < 500 ? { label:'⚠️ DANGER — MLL PROCHE', color:'#ff4455' }
    : { label:'✓ ACTIF', color:'#00cc77' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>RÈGLE</div>
      <MLLSection mll={mll} size={size} maxLoss={maxLoss} balance={balance} isLocked={isLocked} postPayout={postPayout} />

      <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
        <BalanceRow balanceInput={balanceInput} setBalanceInput={setBalanceInput} onSave={onSaveBalance} status={status} />
        <PostPayoutToggle value={postPayout} onChange={setPostPayout} />
      </div>

      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>OBJECTIFS</div>

      <ObjRow ok={payoutOk} pending={!payoutOk&&!lost}
        label={`5 jours gagnants ≥ ${winDayMin}$ chacun (éligibilité payout)`}
        detail={`${qualDays.length}/${winDaysNeeded} jours qualifiants · ${dayEntries.filter(([,p])=>p>0&&p<winDayMin).length} jour(s) < ${winDayMin}$ (non comptés)`}>
        <ProgressBar current={qualDays.length} max={winDaysNeeded} color={payoutOk?'#00cc77':'#f0a020'}
          displayText={`${qualDays.length} / ${winDaysNeeded} jours ≥ ${winDayMin}$`} />
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'10px' }}>
          {dayEntries.slice(-14).map(([d,p]) => <WinDayBadge key={d} date={d} pnl={p} minAmount={winDayMin} />)}
        </div>
      </ObjRow>

      <ObjRow ok pending label="Scaling Plan — respecter la taille de position selon les profits" detail="Le plan de scaling Topstep détermine le nombre de contrats autorisés selon ton niveau de profit" />

      <PayoutBox />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px' }}>
        <MetricCard label="BALANCE" value={`${balance.toFixed(0)}$`} color={isLocked?'#8899bb':'#dde4ef'} sub={manualBalance>0?'Manuelle':'Calculée'} />
        <MetricCard label="P&L NET" value={fmt(totalNet,true)} color={pnlColor(totalNet)} featured />
        <MetricCard label="MLL" value={`${mll.toLocaleString()}$`} color={postPayout?'#00cc77':isLocked?'#8899bb':'#ff4455'} sub={postPayout?'0$ à vie':isLocked?'🔒 Verrouillée':'Trailing ↑'} />
        <MetricCard label="JOURS QUALIFIANTS" value={`${qualDays.length}/${winDaysNeeded}`} color={payoutOk?'#00cc77':'#f0a020'} sub={`≥${winDayMin}$ net/jour`} />
        <MetricCard label="MARGE MLL" value={`${dist.toFixed(0)}$`} color={dist<500?'#ff4455':dist<1000?'#f0a020':'#8899bb'} alert={dist<500} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>CAPITAL + MLL TRAILING</div>
          <MLLChart points={points} lockLevel={!postPayout?size+maxLoss:undefined} />
        </div>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>P&L PAR JOUR — vert ≥ {winDayMin}$</div>
          <DailyBarChart dailyArr={dailyArr} winDayMin={winDayMin} />
        </div>
      </div>

      {payoutOk && !lost && (
        <div style={{ background:'rgba(240,192,32,0.08)', border:'2px solid rgba(240,192,32,0.45)', borderRadius:'8px', padding:'18px', display:'flex', gap:'16px', alignItems:'center' }}>
          <span style={{ fontSize:'26px' }}>💸</span>
          <div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#f0c020', marginBottom:'4px' }}>ÉLIGIBLE AU PAYOUT !</div>
            <div style={{ fontSize:'13px', color:'#7888a0' }}>{qualDays.length} jours qualifiants · Min 125$ · 90% pour toi · Pendant les heures CME</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EXPRESS FUNDED CONSISTENCY ─────────────────────────────────
function ExpressConsTab({ trades, cfg, manualBalance, balanceInput, setBalanceInput, onSaveBalance, postPayout, setPostPayout }) {
  const { size, maxLoss, minTradeDays, maxConsistency } = cfg;
  const totalNet = trades.reduce((s,t) => s + getNet(t), 0);
  const balance  = manualBalance > 0 ? manualBalance : size + totalNet;
  const { points, mll, isLocked } = computeTrailingMLL(trades, size, maxLoss, postPayout);

  const byDay      = buildByDay(trades);
  const dayEntries = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const dailyArr   = dayEntries.map(([d,p]) => ({ date:d.slice(5), pnl:round2(p) }));
  const tradeDays  = dayEntries.length;

  // Consistency = meilleur jour gagnant / total net positif ≤ 40%
  const bestWinDay = Math.max(...dayEntries.map(([,p])=>p).filter(p=>p>0), 0);
  const totalPos   = dayEntries.filter(([,p])=>p>0).reduce((s,[,p])=>s+p, 0);
  const consPct    = totalPos > 0 ? bestWinDay / totalPos : 0;
  const consOk     = totalPos > 0 && consPct <= maxConsistency;

  const daysOk    = tradeDays >= minTradeDays;
  const payoutOk  = daysOk && consOk;
  const dist      = balance - mll;
  const lost      = balance <= mll;

  const status = lost
    ? { label:'COMPTE PERDU ❌', color:'#ff4455' }
    : isLocked ? { label:'🔒 MLL VERROUILLÉE — ZONE SÉCURISÉE', color:'#8899bb' }
    : { label:'✓ ACTIF', color:'#aa88ff' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>RÈGLE</div>
      <MLLSection mll={mll} size={size} maxLoss={maxLoss} balance={balance} isLocked={isLocked} postPayout={postPayout} />

      <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
        <BalanceRow balanceInput={balanceInput} setBalanceInput={setBalanceInput} onSave={onSaveBalance} status={status} />
        <PostPayoutToggle value={postPayout} onChange={setPostPayout} />
      </div>

      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>OBJECTIFS</div>

      <ObjRow ok={daysOk} pending={!daysOk} label={`Trader au moins ${minTradeDays} jours — 1 trade minimum par jour`} detail={`${tradeDays} jour(s) tradés sur ${minTradeDays} requis`}>
        <ProgressBar current={tradeDays} max={minTradeDays} color={daysOk?'#00cc77':'#f0a020'}
          displayText={`${tradeDays} / ${minTradeDays} jours`} />
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px' }}>
          {dayEntries.slice(-8).map(([d,p]) => <WinDayBadge key={d} date={d} pnl={p} minAmount={0.01} />)}
        </div>
      </ObjRow>

      <ObjRow ok={consOk} pending={!consOk&&totalPos===0}
        label={`Consistency ≤ ${(maxConsistency*100).toFixed(0)}% — meilleur jour gagnant / total net positif`}
        detail={totalPos>0 ? `${fmt(bestWinDay)} / ${fmt(totalPos)} = ${(consPct*100).toFixed(1)}% (limite ${(maxConsistency*100).toFixed(0)}%)` : 'Pas encore de profits nets'}>
        {totalPos > 0 && (
          <ProgressBar current={Math.min(consPct*100, 100)} max={100}
            color={consOk?'#00cc77':consPct>maxConsistency?'#ff4455':'#f0a020'}
            displayText={`${(consPct*100).toFixed(1)}% / ${(maxConsistency*100).toFixed(0)}%`}
            note={consOk ? '✓ Objectif atteint' : `Réduire l'impact du meilleur jour — max ${(maxConsistency*100).toFixed(0)}%`} />
        )}
      </ObjRow>

      <ObjRow ok pending label="Scaling Plan — respecter la taille de position selon les profits" detail="Le plan de scaling Topstep détermine le nombre de contrats autorisés" />

      <PayoutBox />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px' }}>
        <MetricCard label="BALANCE" value={`${balance.toFixed(0)}$`} color='#dde4ef' sub={manualBalance>0?'Manuelle':'Calculée'} />
        <MetricCard label="MLL" value={`${mll.toLocaleString()}$`} color={postPayout?'#00cc77':isLocked?'#8899bb':'#ff4455'} sub={postPayout?'0$ à vie':isLocked?'🔒 Verrouillée':'Trailing ↑'} />
        <MetricCard label="JOURS TRADÉS" value={String(tradeDays)} color={daysOk?'#00cc77':'#f0a020'} sub={`Min ${minTradeDays} requis`} />
        <MetricCard label="CONSISTENCY" value={totalPos>0?`${(consPct*100).toFixed(1)}%`:'—'} color={consOk?'#00cc77':consPct>maxConsistency?'#ff4455':'#7888a0'} sub={`Max ${(maxConsistency*100).toFixed(0)}%`} />
        <MetricCard label="MARGE MLL" value={`${dist.toFixed(0)}$`} color={dist<500?'#ff4455':dist<1000?'#f0a020':'#8899bb'} alert={dist<500} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>CAPITAL + MLL TRAILING</div>
          <MLLChart points={points} lockLevel={!postPayout?size+maxLoss:undefined} />
        </div>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>P&L PAR JOUR</div>
          <DailyBarChart dailyArr={dailyArr} />
        </div>
      </div>

      {payoutOk && !lost && (
        <div style={{ background:'rgba(170,136,255,0.08)', border:'2px solid rgba(170,136,255,0.45)', borderRadius:'8px', padding:'18px', display:'flex', gap:'16px', alignItems:'center' }}>
          <span style={{ fontSize:'26px' }}>💸</span>
          <div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#aa88ff', marginBottom:'4px' }}>ÉLIGIBLE AU PAYOUT !</div>
            <div style={{ fontSize:'13px', color:'#7888a0' }}>{tradeDays} jours tradés · Consistency {(consPct*100).toFixed(1)}% ≤ {(maxConsistency*100).toFixed(0)}% · Min 125$ · 90% pour toi</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LIVE FUNDED ACCOUNT ────────────────────────────────────────
function LiveFundedTab({ trades, cfg, manualBalance, balanceInput, setBalanceInput, onSaveBalance }) {
  const { size, dailyLoss, winDaysNeeded, winDayMin } = cfg;
  const totalNet = trades.reduce((s,t) => s + getNet(t), 0);
  const balance  = manualBalance > 0 ? manualBalance : size + totalNet;

  const byDay      = buildByDay(trades);
  const dayEntries = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
  const dailyArr   = dayEntries.map(([d,p]) => ({ date:d.slice(5), pnl:round2(p) }));
  const qualDays   = dayEntries.filter(([,p]) => p >= winDayMin);
  const payoutOk   = qualDays.length >= winDaysNeeded;

  const todayStr    = new Date().toISOString().slice(0,10);
  const todayPnl    = byDay[todayStr] ?? null;
  const dailyLimHit = dailyLoss != null && todayPnl !== null && todayPnl <= -dailyLoss;
  const bust        = balance <= 0;

  const status = bust
    ? { label:'COMPTE PERDU ❌', color:'#ff4455' }
    : dailyLimHit ? { label:'⛔ DAILY LIMIT ATTEINT', color:'#ff4455' }
    : balance < size * 0.15 ? { label:'⚠️ BALANCE CRITIQUE', color:'#f0a020' }
    : { label:'✓ ACTIF', color:'#00cc77' };

  const eqPts = [{ date:'Début', balance:size }];
  for (const [d, pnl] of dayEntries)
    eqPts.push({ date:d.slice(5), balance:round2(eqPts[eqPts.length-1].balance + pnl) });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>RÈGLES</div>

      <ObjRow ok={!bust} pending={!bust}
        label="Ne pas laisser le solde atteindre ou passer sous 0$"
        detail={`Balance actuelle : ${balance.toFixed(2)}$ · Floor absolu : 0$`} />

      {dailyLoss != null && (
        <ObjRow ok={!dailyLimHit&&todayPnl!==null} pending={todayPnl===null}
          label={`Daily Loss Limit — max -${dailyLoss.toLocaleString()}$ par journée de trading`}
          detail={todayPnl!==null ? `Aujourd'hui : ${fmt(todayPnl,true)} · Marge : ${fmt(Math.max(0, dailyLoss + (todayPnl??0)))}` : "Aucun trade aujourd'hui"} />
      )}

      <BalanceRow balanceInput={balanceInput} setBalanceInput={setBalanceInput} onSave={onSaveBalance} status={status} />

      {dailyLimHit && (
        <div style={{ background:'rgba(255,68,85,0.10)', border:'1px solid rgba(255,68,85,0.40)', borderRadius:'6px', padding:'14px 16px', display:'flex', gap:'12px', alignItems:'center' }}>
          <span style={{ fontSize:'22px' }}>⛔</span>
          <div>
            <div style={{ fontSize:'13px', color:'#ff4455', fontWeight:'700', marginBottom:'4px' }}>Daily Loss Limit atteint — compte désactivé pour aujourd'hui</div>
            <div style={{ fontSize:'13px', color:'#7888a0' }}>P&L aujourd'hui : {fmt(todayPnl,true)} · Limite : -{dailyLoss.toLocaleString()}$</div>
          </div>
        </div>
      )}

      <div style={{ fontSize:'13px', color:'#5a6a82', letterSpacing:'2px' }}>OBJECTIF — PAYOUT</div>

      <ObjRow ok={payoutOk} pending={!payoutOk&&!bust}
        label={`5 jours gagnants ≥ ${winDayMin}$ chacun`}
        detail={`${qualDays.length}/${winDaysNeeded} jours qualifiants`}>
        <ProgressBar current={qualDays.length} max={winDaysNeeded} color={payoutOk?'#00cc77':'#f0a020'}
          displayText={`${qualDays.length} / ${winDaysNeeded} jours ≥ ${winDayMin}$`} />
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'10px' }}>
          {dayEntries.slice(-14).map(([d,p]) => <WinDayBadge key={d} date={d} pnl={p} minAmount={winDayMin} />)}
        </div>
      </ObjRow>

      <PayoutBox />

      <div style={{ background:'rgba(255,68,85,0.05)', border:'1px solid rgba(255,68,85,0.15)', borderRadius:'5px', padding:'10px 14px', fontSize:'12px', color:'#6878a0' }}>
        ⚠ Interdit : account stacking · Intentional depletion d'un Live Funded Account
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'8px' }}>
        <MetricCard label="BALANCE" value={`${balance.toFixed(0)}$`} color={bust?'#ff4455':'#00cc77'} sub={manualBalance>0?'Manuelle':'Calculée'} />
        <MetricCard label="P&L NET" value={fmt(totalNet,true)} color={pnlColor(totalNet)} featured />
        <MetricCard label="FLOOR ABSOLU" value="0$" color="#ff4455" sub="Compte perdu si atteint" />
        {dailyLoss!=null && <MetricCard label="DAILY LIMIT" value={`-${dailyLoss.toLocaleString()}$`} color={dailyLimHit?'#ff4455':'#f0a020'} sub={dailyLimHit?"⛔ Atteint auj.":'Par jour de trading'} />}
        <MetricCard label="JOURS QUALIFIANTS" value={`${qualDays.length}/${winDaysNeeded}`} color={payoutOk?'#00cc77':'#f0a020'} sub={`≥${winDayMin}$ net/jour`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>COURBE DE CAPITAL</div>
          {eqPts.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={eqPts} margin={{ top:5, right:10, bottom:0, left:10 }}>
                <defs>
                  <linearGradient id="liveG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00cc77" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#00cc77" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(136,153,187,0.05)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#5a6a82', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}K`} domain={['auto','auto']} />
                <Tooltip content={<CTooltip />} />
                <ReferenceLine y={0} stroke="#ff4455" strokeDasharray="3 3" strokeOpacity={0.8} label={{ value:'0$ Floor', fill:'#ff4455', fontSize:10, position:'insideTopRight' }} />
                <Area type="monotone" dataKey="balance" name="Balance" stroke="#00cc77" strokeWidth={2} fill="url(#liveG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#3a4a62', fontSize:'13px' }}>Aucun trade</div>}
        </div>
        <div style={{ background:'rgba(14,15,22,0.4)', border:'1px solid rgba(136,153,187,0.10)', borderRadius:'6px', padding:'14px' }}>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'2px', marginBottom:'10px' }}>P&L PAR JOUR — vert ≥ {winDayMin}$</div>
          <DailyBarChart dailyArr={dailyArr} winDayMin={winDayMin} />
        </div>
      </div>

      {payoutOk && !bust && (
        <div style={{ background:'rgba(0,204,119,0.08)', border:'2px solid rgba(0,204,119,0.45)', borderRadius:'8px', padding:'18px', display:'flex', gap:'16px', alignItems:'center' }}>
          <span style={{ fontSize:'26px' }}>💸</span>
          <div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#00cc77', marginBottom:'4px' }}>ÉLIGIBLE AU PAYOUT !</div>
            <div style={{ fontSize:'13px', color:'#7888a0' }}>{qualDays.length} jours qualifiants · Min 125$ · 90% pour toi · Pendant les heures CME</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────
export default function PropFirm() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [trades,  setTrades]  = useState([]);
  const [loading, setLoading] = useState(true);

  const [balanceInput, setBalanceInput] = useState('');
  const [balCombine, setBalCombine] = useState(() => parseFloat(localStorage.getItem('pf_bal_combine')  || '0') || 0);
  const [balEfStd,   setBalEfStd]   = useState(() => parseFloat(localStorage.getItem('pf_bal_efstd')    || '0') || 0);
  const [balEfCons,  setBalEfCons]  = useState(() => parseFloat(localStorage.getItem('pf_bal_efcons')   || '0') || 0);
  const [balLive,    setBalLive]    = useState(() => parseFloat(localStorage.getItem('pf_bal_live')      || '0') || 0);
  const [ppStd,  setPpStd]  = useState(() => localStorage.getItem('pf_pp_std')  === 'true');
  const [ppCons, setPpCons] = useState(() => localStorage.getItem('pf_pp_cons') === 'true');

  useEffect(() => {
    (async () => {
      const [accRes, tradesRes] = await Promise.all([window.accounts.getActive(), window.db.getAllTrades()]);
      if (accRes.ok && accRes.data) setAccount(accRes.data);
      if (tradesRes.ok) setTrades(tradesRes.data);
      setLoading(false);
    })();
  }, []);

  const cfg     = ACCOUNT_CONFIGS[account?.type] ?? DEFAULT_CFG;
  const phase   = cfg.phase;
  const phColor = PHASE_COLORS[phase]  ?? '#5a6a82';
  const phLabel = PHASE_LABELS[phase]  ?? '—';
  const sizeK   = `${(cfg.size/1000).toFixed(0)}K`;

  function saveBalance(key, setFn) {
    const v = parseFloat(balanceInput);
    if (!isNaN(v) && v > 0) { setFn(v); localStorage.setItem(key, String(v)); setBalanceInput(''); }
  }
  function togglePP(prev, setPp, key) {
    const next = !prev; setPp(next); localStorage.setItem(key, String(next));
  }

  const shared = { balanceInput, setBalanceInput };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#5a6a82', fontSize:'13px', letterSpacing:'2px' }}>CHARGEMENT...</div>
  );

  return (
    <div style={{ padding:'24px 28px', maxWidth:'none', fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'12px', color:'#5a6a82', letterSpacing:'3px', marginBottom:'4px' }}>PROPFIRM — TOPSTEP</div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e8edf8', margin:0 }}>
            <span style={{ color:phColor }}>{phLabel}</span>
            <span style={{ fontSize:'15px', color:'#5a6a82', marginLeft:'12px' }}>{sizeK}</span>
          </h1>
        </div>
        <button onClick={() => navigate('/journal')}
          style={{ background:'transparent', border:'1px solid #1e2c40', color:'#5868a0', padding:'8px 16px', borderRadius:'5px', fontSize:'13px', fontFamily:'inherit', letterSpacing:'1px', cursor:'pointer', transition:'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color='#8899bb'; e.currentTarget.style.borderColor='#8899bb'; }}
          onMouseLeave={e => { e.currentTarget.style.color='#5868a0'; e.currentTarget.style.borderColor='#1e2c40'; }}>
          ← Journal
        </button>
      </div>

      {account && (
        <div style={{ marginBottom:'20px' }}>
          <PhaseSelector account={account} onChanged={t => setAccount(prev => ({ ...prev, type:t }))} />
        </div>
      )}

      {phase === 'combine' && (
        <CombineTab {...shared} trades={trades} cfg={cfg}
          manualBalance={balCombine}
          onSaveBalance={() => saveBalance('pf_bal_combine', setBalCombine)} />
      )}
      {phase === 'ef_standard' && (
        <ExpressStdTab {...shared} trades={trades} cfg={cfg}
          manualBalance={balEfStd}
          onSaveBalance={() => saveBalance('pf_bal_efstd', setBalEfStd)}
          postPayout={ppStd}
          setPostPayout={() => togglePP(ppStd, setPpStd, 'pf_pp_std')} />
      )}
      {phase === 'ef_consistency' && (
        <ExpressConsTab {...shared} trades={trades} cfg={cfg}
          manualBalance={balEfCons}
          onSaveBalance={() => saveBalance('pf_bal_efcons', setBalEfCons)}
          postPayout={ppCons}
          setPostPayout={() => togglePP(ppCons, setPpCons, 'pf_pp_cons')} />
      )}
      {phase === 'live' && (
        <LiveFundedTab {...shared} trades={trades} cfg={cfg}
          manualBalance={balLive}
          onSaveBalance={() => saveBalance('pf_bal_live', setBalLive)} />
      )}

      {!phase && (
        <div style={{ padding:'60px', textAlign:'center', color:'#5a6a82', fontSize:'13px', border:'1px dashed rgba(136,153,187,0.15)', borderRadius:'8px' }}>
          Sélectionnez un type de compte ci-dessus pour commencer
        </div>
      )}
    </div>
  );
}
