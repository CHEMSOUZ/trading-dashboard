import { useState, useEffect, useRef } from 'react';

const BTN = {
  background: 'rgba(136,153,187,0.07)',
  border: '1px solid rgba(136,153,187,0.18)',
  borderRadius: '5px',
  color: '#8899bb',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '5px 9px',
  lineHeight: 1,
  fontFamily: 'inherit',
  transition: 'all 0.15s',
};

export default function TradeReplay({ trade, onClose }) {
  const [candles, setCandles] = useState([]);
  const [visible, setVisible] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed,   setSpeed]   = useState(80);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tf,      setTf]      = useState('5m');
  const timerRef = useRef(null);

  const W = 760, H = 300;
  const PAD = { top: 20, right: 72, bottom: 28, left: 4 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  async function loadData() {
    setLoading(true); setError(''); setCandles([]); setVisible(0); setPlaying(false);
    const date = (trade.entered_at || trade.date || '').slice(0, 10);
    if (!date) { setError('Date de trade invalide'); setLoading(false); return; }
    const res = await window.market.getOHLCV(trade.pair, date, tf);
    if (!res.ok) { setError(res.error || 'Données indisponibles'); setLoading(false); return; }
    if (!res.data.length) { setError('Aucune bougie disponible pour ce symbole/date'); setLoading(false); return; }
    const data = res.data;
    setCandles(data);
    const entryTs = trade.entered_at ? Math.floor(new Date(trade.entered_at).getTime() / 1000) : null;
    const idx = entryTs ? data.findIndex(c => c.ts >= entryTs) : -1;
    setVisible(idx > 0 ? idx : Math.min(20, data.length));
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [trade.id, tf]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      { onClose(); return; }
      if (e.key === 'ArrowRight')  { setPlaying(false); setVisible(v => Math.min(v + 1, candles.length)); }
      if (e.key === 'ArrowLeft')   { setPlaying(false); setVisible(v => Math.max(v - 1, 0)); }
      if (e.key === ' ')           { e.preventDefault(); setPlaying(p => !p); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [candles.length, onClose]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setVisible(v => {
        if (v >= candles.length) { setPlaying(false); return v; }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(timerRef.current);
  }, [playing, speed, candles.length]);

  const shown = candles.slice(0, visible);

  const pnl  = trade.result_net ?? trade.result ?? 0;
  const pnlC = pnl >= 0 ? '#00ff88' : '#ff3344';

  const LEVELS = [
    { price: +trade.entry,      label: 'ENTRY', color: '#8899bb', dash: '' },
    { price: +trade.stop,       label: 'SL',    color: '#ff3344', dash: '5 3' },
    { price: +trade.tp,         label: 'TP',    color: '#00ff88', dash: '5 3' },
    { price: +trade.exit_price, label: 'EXIT',  color: '#f59e0b', dash: '3 2' },
  ].filter(l => l.price && !isNaN(l.price));

  const allP = [
    ...LEVELS.map(l => l.price),
    ...shown.flatMap(c => [c.high, c.low]),
  ].filter(p => p > 0);

  const minP = allP.length ? Math.min(...allP) : 0;
  const maxP = allP.length ? Math.max(...allP) : 1;
  const span = maxP - minP || 1;
  const lo   = minP - span * 0.08;
  const hi   = maxP + span * 0.08;

  const yS = p => PAD.top + chartH - ((p - lo) / (hi - lo)) * chartH;
  const cW  = shown.length > 0 ? Math.max(2, Math.min(14, Math.floor(chartW / shown.length) - 1)) : 8;
  const xS  = i => PAD.left + (chartW / Math.max(shown.length, 1)) * (i + 0.5) - cW / 2;

  const entryTs = trade.entered_at ? Math.floor(new Date(trade.entered_at).getTime() / 1000) : null;
  const exitTs  = trade.exited_at  ? Math.floor(new Date(trade.exited_at).getTime()  / 1000) : null;

  const priceGrid = [0, 0.25, 0.5, 0.75, 1].map(f => lo + f * (hi - lo));
  const tStep = Math.max(1, Math.floor(shown.length / 6));

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(6px)' }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:1201, width:'860px', maxWidth:'96vw', background:'#0b0c16', border:'1px solid rgba(136,153,187,0.18)', borderRadius:'14px', padding:'22px 24px 18px', boxShadow:'0 24px 64px rgba(0,0,0,0.9)' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'15px', fontWeight:'700', color:'#dde4ef', letterSpacing:'-0.3px' }}>
              ▶ Replay &mdash; {trade.pair}{' '}
              <span style={{ color:trade.direction==='LONG'?'#00cc77':'#ff3344', fontSize:'13px' }}>{trade.direction}</span>
            </div>
            <div style={{ fontSize:'11px', color:'#5a6a82', marginTop:'2px' }}>
              {(trade.entered_at||trade.date||'').slice(0,10)}
              {' · '}
              <span style={{ color:pnlC }}>{pnl>=0?'+':''}{pnl.toFixed(2)}$</span>
              {trade.rr && <span style={{ marginLeft:'6px', color:'#3a4a5a' }}>R{trade.rr}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
            {['1m','2m','5m','15m'].map(i => (
              <button key={i} onClick={() => setTf(i)} style={{ ...BTN, background:tf===i?'rgba(136,153,187,0.14)':'transparent', border:`1px solid rgba(136,153,187,${tf===i?0.40:0.14})`, color:tf===i?'#dde4ef':'#5a6a82', padding:'4px 8px', fontSize:'11px' }}>{i}</button>
            ))}
            <button onClick={onClose} style={{ ...BTN, marginLeft:'6px', color:'#5a6a82', padding:'5px 10px' }}>✕</button>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <div style={{ height:`${H}px`, display:'flex', alignItems:'center', justifyContent:'center', color:'#5a6a82', fontSize:'12px', letterSpacing:'2px' }}>CHARGEMENT DES DONNÉES...</div>
        ) : error ? (
          <div style={{ height:`${H}px`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px' }}>
            <div style={{ fontSize:'28px', opacity:0.4 }}>📊</div>
            <div style={{ color:'#5a6a82', fontSize:'13px', textAlign:'center', lineHeight:1.7 }}>{error}</div>
            <div style={{ fontSize:'11px', color:'#3a4a5a' }}>Yahoo Finance ne couvre pas tous les instruments ou toutes les dates</div>
            <button onClick={loadData} style={{ ...BTN, marginTop:'4px', color:'#8899bb', padding:'6px 16px' }}>Réessayer</button>
          </div>
        ) : (
          <>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block', borderRadius:'8px', background:'rgba(5,6,12,0.9)', border:'1px solid rgba(136,153,187,0.07)' }}>

              {/* Horizontal grid + price labels */}
              {priceGrid.map((p, i) => (
                <g key={i}>
                  <line x1={PAD.left} y1={yS(p)} x2={W-PAD.right} y2={yS(p)} stroke="rgba(136,153,187,0.055)" />
                  <text x={W-PAD.right+4} y={yS(p)+4} fill="#2e3d52" fontSize="8.5">{p.toFixed(p < 100 ? 2 : 0)}</text>
                </g>
              ))}

              {/* Time labels */}
              {shown.filter((_, i) => i % tStep === 0).map((c, i) => {
                const origIdx = shown.indexOf(c);
                const x = PAD.left + (chartW / shown.length) * (origIdx + 0.5);
                const t = new Date(c.ts*1000).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
                return (
                  <g key={i}>
                    <line x1={x} y1={PAD.top} x2={x} y2={PAD.top+chartH} stroke="rgba(136,153,187,0.04)" />
                    <text x={x} y={H-4} fill="#2e3d52" fontSize="8.5" textAnchor="middle">{t}</text>
                  </g>
                );
              })}

              {/* Price level lines */}
              {LEVELS.map(({ price, label, color, dash }) => {
                const y = yS(price);
                if (y < PAD.top - 6 || y > PAD.top + chartH + 6) return null;
                return (
                  <g key={label}>
                    <line x1={PAD.left} y1={y} x2={W-PAD.right} y2={y} stroke={color} strokeWidth={1.5} strokeDasharray={dash} opacity={0.85} />
                    <text x={W-PAD.right+4} y={y-2} fill={color} fontSize="8.5" fontWeight="bold">{label}</text>
                    <text x={W-PAD.right+4} y={y+9} fill={color} fontSize="8" opacity={0.7}>{price}</text>
                  </g>
                );
              })}

              {/* Candles */}
              {shown.map((c, i) => {
                const x   = xS(i);
                const o   = yS(c.open);
                const cl  = yS(c.close);
                const hy  = yS(c.high);
                const ly  = yS(c.low);
                const top = Math.min(o, cl);
                const bH  = Math.max(1, Math.abs(o - cl));
                const col = c.close >= c.open ? '#00b558' : '#e02535';
                const cx  = x + cW / 2;
                return (
                  <g key={i}>
                    <line x1={cx} y1={hy} x2={cx} y2={ly} stroke={col} strokeWidth={1} />
                    <rect x={x} y={top} width={Math.max(1.5, cW)} height={bH} fill={col} fillOpacity={0.88} />
                  </g>
                );
              })}

              {/* Entry / Exit vertical markers */}
              {candles.slice(0, visible).map((c, i) => {
                const isEntry = entryTs && c.ts <= entryTs && (candles[i+1]?.ts > entryTs || i === visible-1);
                const isExit  = exitTs  && c.ts <= exitTs  && (candles[i+1]?.ts > exitTs  || i === visible-1);
                if (!isEntry && !isExit) return null;
                const x = xS(i) + cW/2;
                const col = isExit ? pnlC : '#8899bb';
                return (
                  <g key={`mk-${i}`}>
                    <line x1={x} y1={PAD.top} x2={x} y2={PAD.top+chartH} stroke={col} strokeWidth={1.8} strokeDasharray="4 3" opacity={0.75} />
                    <text x={x+3} y={PAD.top+12} fill={col} fontSize="8.5">{isExit?'EXIT':'ENTRY'}</text>
                  </g>
                );
              })}
            </svg>

            {/* Controls */}
            <div style={{ display:'flex', alignItems:'center', gap:'7px', marginTop:'12px' }}>
              <button onClick={() => { setPlaying(false); setVisible(0); }} title="Retour au début" style={BTN}>⏮</button>
              <button
                onClick={() => setPlaying(p => !p)}
                style={{ ...BTN, minWidth:'36px', background:playing?'rgba(255,51,68,0.10)':'rgba(0,255,136,0.08)', border:`1px solid ${playing?'rgba(255,51,68,0.35)':'rgba(0,255,136,0.30)'}`, color:playing?'#ff3344':'#00ff88' }}>
                {playing ? '⏸' : '▶'}
              </button>
              <button onClick={() => { setPlaying(false); setVisible(candles.length); }} title="Aller à la fin" style={BTN}>⏭</button>

              <input type="range" min="0" max={candles.length} value={visible}
                onChange={e => { setPlaying(false); setVisible(+e.target.value); }}
                style={{ flex:1, cursor:'pointer', accentColor:'#7c3aed' }} />

              <div style={{ display:'flex', gap:'3px' }}>
                {[{s:200,l:'½x'},{s:100,l:'1x'},{s:50,l:'2x'},{s:20,l:'5x'}].map(({s,l}) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    style={{ ...BTN, padding:'4px 8px', fontSize:'11px', background:speed===s?'rgba(124,58,237,0.14)':'transparent', border:`1px solid rgba(124,58,237,${speed===s?0.45:0.14})`, color:speed===s?'#9d72ff':'#5a6a82' }}>
                    {l}
                  </button>
                ))}
              </div>

              <span style={{ fontSize:'11px', color:'#5a6a82', whiteSpace:'nowrap', minWidth:'72px', textAlign:'right' }}>
                {visible}/{candles.length} bougies
              </span>
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap', alignItems:'center' }}>
              {LEVELS.map(({ label, color, price }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <div style={{ width:'14px', height:'2px', background:color, borderRadius:'1px', flexShrink:0 }} />
                  <span style={{ fontSize:'11px', color:'#5a6a82' }}>{label} <span style={{ color:'#3a4a5a' }}>{price}</span></span>
                </div>
              ))}
              {shown.length > 1 && (
                <span style={{ marginLeft:'auto', fontSize:'11px', color:'#2e3d52' }}>
                  {new Date(shown[0].ts*1000).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                  {' → '}
                  {new Date(shown[shown.length-1].ts*1000).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
