import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// MNQ : 1 point = $2.00 (micro contract)
const MNQ_PTS_TO_USD = 2;

function calcPts(a, b) { return Math.abs(a - b); }
function calcUsd(pts)   { return (pts * MNQ_PTS_TO_USD).toFixed(2); }
function calcRR(entry, sl, tp) {
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (!risk) return null;
  return (reward / risk).toFixed(2);
}

// ── Pine Script template ──────────────────────────────────────
const PINE_SCRIPT = `//@version=5
indicator("ICT Bot Signals — MNQ", overlay=true, max_bars_back=500)

// ═══════════════════════════════════════════════════════════
//  CONFIGURATION — remplace l'URL par ton URL ngrok
// ═══════════════════════════════════════════════════════════
// 1. Lance : ngrok http 3001
// 2. Copie l'URL HTTPS dans la variable ci-dessous
// 3. Dans TradingView : Créer Alerte → Webhook URL → {ton_url}/webhook

symbol_name = "MNQ"

// ═══════════════════════════════════════════════════════════
//  INDICATEURS
// ═══════════════════════════════════════════════════════════
ema9   = ta.ema(close, 9)
ema20  = ta.ema(close, 20)
ema50  = ta.ema(close, 50)
ema200 = ta.ema(close, 200)

[vwap_val, _, _] = ta.vwap(high, low, close, volume)
atr = ta.atr(14)

// ═══════════════════════════════════════════════════════════
//  FAIR VALUE GAP (FVG)
// ═══════════════════════════════════════════════════════════
bull_fvg = low[0] > high[2]   // gap haussier : low actuel > high il y a 2 bougies
bear_fvg = high[0] < low[2]   // gap baissier : high actuel < low il y a 2 bougies

// ═══════════════════════════════════════════════════════════
//  MARKET STRUCTURE SHIFT (MSS simplifié)
// ═══════════════════════════════════════════════════════════
swing_high = ta.highest(high, 10)[1]
swing_low  = ta.lowest(low, 10)[1]
mss_bull   = ta.crossover(close, swing_high)   // cassure HH → MSS haussier
mss_bear   = ta.crossunder(close, swing_low)   // cassure LL → MSS baissier

// ═══════════════════════════════════════════════════════════
//  BIAIS DIRECTIONNEL
// ═══════════════════════════════════════════════════════════
bull_bias = ema20 > ema50 and close > vwap_val and close > ema200
bear_bias = ema20 < ema50 and close < vwap_val and close < ema200

// ═══════════════════════════════════════════════════════════
//  SIGNAUX D'ENTRÉE
// ═══════════════════════════════════════════════════════════
// LONG : biais haussier + FVG haussier + MSS
long_signal  = bull_bias and (bull_fvg or mss_bull) and ta.crossover(close, ema9)
// SHORT : biais baissier + FVG baissier + MSS
short_signal = bear_bias and (bear_fvg or mss_bear) and ta.crossunder(close, ema9)

// ═══════════════════════════════════════════════════════════
//  CALCUL SL / TP
// ═══════════════════════════════════════════════════════════
sl_mult  = 1.5   // ATR × 1.5 pour le stop
tp1_mult = 2.0   // ATR × 2.0 pour TP1
tp2_mult = 3.5   // ATR × 3.5 pour TP2

// ═══════════════════════════════════════════════════════════
//  ALERTES WEBHOOK (format JSON pour le dashboard)
// ═══════════════════════════════════════════════════════════
if long_signal
    entry = close
    sl    = math.round(entry - atr * sl_mult, 2)
    tp1   = math.round(entry + atr * tp1_mult, 2)
    tp2   = math.round(entry + atr * tp2_mult, 2)
    rr    = str.tostring(math.round(atr * tp2_mult / (atr * sl_mult) * 10) / 10)
    ctx   = bull_fvg ? "FVG haussier" : "MSS + EMA9 cross"
    msg   = '{"symbol":"' + symbol_name + '","signal":"LONG","entry":' + str.tostring(entry) +
            ',"sl":' + str.tostring(sl) +
            ',"tp1":' + str.tostring(tp1) +
            ',"tp2":' + str.tostring(tp2) +
            ',"rr":"1:' + rr + '"' +
            ',"context":"' + ctx + ' — EMA ' + (ema20 > ema50 ? "haussier" : "neutre") + ' — VWAP ' + (close > vwap_val ? "au-dessus" : "en-dessous") + '"' +
            ',"timeframe":"{{interval}}"' +
            ',"timestamp":"{{time}}"}'
    alert(msg, alert.freq_once_per_bar_close)

if short_signal
    entry = close
    sl    = math.round(entry + atr * sl_mult, 2)
    tp1   = math.round(entry - atr * tp1_mult, 2)
    tp2   = math.round(entry - atr * tp2_mult, 2)
    rr    = str.tostring(math.round(atr * tp2_mult / (atr * sl_mult) * 10) / 10)
    ctx   = bear_fvg ? "FVG baissier" : "MSS + EMA9 cross"
    msg   = '{"symbol":"' + symbol_name + '","signal":"SHORT","entry":' + str.tostring(entry) +
            ',"sl":' + str.tostring(sl) +
            ',"tp1":' + str.tostring(tp1) +
            ',"tp2":' + str.tostring(tp2) +
            ',"rr":"1:' + rr + '"' +
            ',"context":"' + ctx + ' — EMA ' + (ema20 < ema50 ? "baissier" : "neutre") + ' — VWAP ' + (close < vwap_val ? "en-dessous" : "au-dessus") + '"' +
            ',"timeframe":"{{interval}}"' +
            ',"timestamp":"{{time}}"}'
    alert(msg, alert.freq_once_per_bar_close)

// ═══════════════════════════════════════════════════════════
//  AFFICHAGE
// ═══════════════════════════════════════════════════════════
plot(ema9,   "EMA 9",   color.new(color.lime,   20), 1)
plot(ema20,  "EMA 20",  color.new(color.yellow, 20), 1)
plot(ema50,  "EMA 50",  color.new(color.orange, 20), 1)
plot(ema200, "EMA 200", color.new(color.red,    20), 2)
plot(vwap_val, "VWAP",  color.new(color.aqua,   10), 2)

plotshape(long_signal,  "LONG",  shape.triangleup,   location.belowbar, color.lime,   size=size.small)
plotshape(short_signal, "SHORT", shape.triangledown, location.abovebar, color.red,    size=size.small)
`;

// ── Signal Card ───────────────────────────────────────────────
function SignalCard({ signal, onSave, isLatest }) {
  const dir      = (signal.signal ?? signal.direction ?? '').toUpperCase();
  const isLong   = dir === 'LONG';
  const entry    = parseFloat(signal.entry)  || 0;
  const sl       = parseFloat(signal.sl)     || 0;
  const tp1      = parseFloat(signal.tp1)    || 0;
  const tp2      = parseFloat(signal.tp2)    || parseFloat(signal.tp) || 0;
  const slPts    = calcPts(entry, sl);
  const tp1Pts   = tp1 ? calcPts(entry, tp1) : null;
  const tp2Pts   = tp2 ? calcPts(entry, tp2) : null;
  const rrAuto   = tp2 ? calcRR(entry, sl, tp2) : tp1 ? calcRR(entry, sl, tp1) : null;
  const rrDisplay= signal.rr || (rrAuto ? `1:${rrAuto}` : '—');

  const accentColor = isLong ? '#00ff88' : '#ff4455';
  const bgColor     = isLong ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,85,0.04)';

  const time = signal.timestamp || signal._receivedAt?.slice(11, 16) || '—';

  return (
    <div style={{ background: bgColor, border: `1px solid ${accentColor}25`, borderLeft: `3px solid ${accentColor}`, borderRadius: '8px', padding: '18px 20px', position: 'relative' }}>
      {/* Direction + Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '4px 14px', borderRadius: '4px', background: `${accentColor}18`, border: `1px solid ${accentColor}50`, fontSize: '15px', fontWeight: '700', color: accentColor, letterSpacing: '2px' }}>
          {isLong ? '▲' : '▼'} {dir}
        </div>
        <div style={{ fontSize: '13px', color: '#8aaa90', fontWeight: '600' }}>{signal.symbol || 'MNQ'}</div>
        {signal.timeframe && <div style={{ fontSize: '11px', color: '#3a6a4a', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)', padding: '2px 7px', borderRadius: '3px' }}>{signal.timeframe}M</div>}
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#3a6a4a' }}>{time}</div>
        {isLatest && <div style={{ fontSize: '8px', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', padding: '2px 6px', borderRadius: '3px', letterSpacing: '1px', fontWeight: '700' }}>NOUVEAU</div>}
      </div>

      {/* Levels grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
        {/* Entry */}
        <div style={{ background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>📍 ENTRÉE</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>{entry.toFixed(2)}</div>
        </div>
        {/* SL */}
        <div style={{ background: 'rgba(255,68,85,0.05)', border: '1px solid rgba(255,68,85,0.15)', borderRadius: '6px', padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', color: '#5a2a2a', letterSpacing: '2px', marginBottom: '4px' }}>🛑 STOP LOSS</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ff7788' }}>{sl.toFixed(2)}</div>
          <div style={{ fontSize: '10px', color: '#5a3a3a', marginTop: '2px' }}>
            {slPts.toFixed(2)} pts · <span style={{ color: '#ff4455' }}>-${calcUsd(slPts)}</span>
          </div>
        </div>
        {/* TP1 */}
        {tp1 > 0 && (
          <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontSize: '9px', color: '#2a5a3a', letterSpacing: '2px', marginBottom: '4px' }}>🎯 TP1</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00cc66' }}>{tp1.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: '#2a5a3a', marginTop: '2px' }}>
              {tp1Pts.toFixed(2)} pts · <span style={{ color: '#00ff88' }}>+${calcUsd(tp1Pts)}</span>
            </div>
          </div>
        )}
        {/* TP2 */}
        {tp2 > 0 && (
          <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontSize: '9px', color: '#2a5a3a', letterSpacing: '2px', marginBottom: '4px' }}>🎯 TP2</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00ff88' }}>{tp2.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: '#2a5a3a', marginTop: '2px' }}>
              {tp2Pts.toFixed(2)} pts · <span style={{ color: '#00ff88' }}>+${calcUsd(tp2Pts)}</span>
            </div>
          </div>
        )}
      </div>

      {/* R:R + Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}30`, borderRadius: '4px', padding: '4px 12px', fontSize: '13px', fontWeight: '700', color: accentColor }}>
          R:R {rrDisplay}
        </div>
        {signal.context && (
          <div style={{ fontSize: '11px', color: '#5a8a6a', fontStyle: 'italic', flex: 1 }}>{signal.context}</div>
        )}
      </div>

      {/* Save button */}
      {onSave && (
        <button onClick={() => onSave(signal)}
          style={{ width: '100%', padding: '9px', background: 'transparent', border: `1px dashed ${accentColor}50`, borderRadius: '5px', color: accentColor, fontSize: '11px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}10`; e.currentTarget.style.borderStyle = 'solid'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed'; }}
        >+ ENREGISTRER DANS LE JOURNAL</button>
      )}
    </div>
  );
}

// ── Custom TradingView Input ──────────────────────────────────
function CustomTVInput() {
  const [sym, setSym]   = useState('CME_MINI:MNQ1!');
  const [tf, setTf]     = useState('5');
  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '5px', padding: '8px 11px', color: '#c8d8c8', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  function open() {
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}&interval=${tf}`;
    window.shell.openExternal(url);
  }
  return (
    <>
      <input value={sym} onChange={e => setSym(e.target.value)} placeholder="CME_MINI:MNQ1!" style={{ ...inp, flex: 2 }} onKeyDown={e => e.key === 'Enter' && open()} />
      <select value={tf} onChange={e => setTf(e.target.value)} style={{ ...inp, width: '90px' }}>
        {[['1','1 min'],['3','3 min'],['5','5 min'],['15','15 min'],['30','30 min'],['60','1H'],['240','4H'],['D','1J']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button onClick={open} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '5px', color: '#00ff88', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.08)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >OUVRIR ↗</button>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Bot() {
  const navigate  = useNavigate();
  const [signals, setSignals]   = useState([]);
  const [port, setPort]         = useState(3001);
  const [portInput, setPortInput] = useState('3001');
  const [tab, setTab]           = useState('signals');
  const [copied, setCopied]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');
  const [serverOk, setServerOk] = useState(true);
  const flashRef = useRef(null);

  useEffect(() => {
    (async () => {
      const portRes = await window.bot.getPort();
      if (portRes.ok) { setPort(portRes.data); setPortInput(String(portRes.data)); }
      const sigRes  = await window.bot.getSignals();
      if (sigRes.ok) setSignals(sigRes.data);
    })();

    const onSignal = (sig) => {
      setSignals(prev => [sig, ...prev].slice(0, 200));
      setTab('signals');
      if (flashRef.current) {
        flashRef.current.style.boxShadow = '0 0 40px rgba(0,255,136,0.4)';
        setTimeout(() => { if (flashRef.current) flashRef.current.style.boxShadow = 'none'; }, 800);
      }
    };
    const onReady = (p) => { setPort(p); setPortInput(String(p)); setServerOk(true); };
    const onError = () => setServerOk(false);

    window.bot.onSignal(onSignal);
    window.bot.onServerReady(onReady);
    window.bot.onServerError(onError);
    return () => { window.bot.offSignal(onSignal); };
  }, []);

  async function handleClearSignals() {
    if (!window.confirm('Effacer tout l\'historique des signaux ?')) return;
    await window.bot.clearSignals();
    setSignals([]);
  }

  async function handleSetPort() {
    const p = parseInt(portInput);
    if (!p || p < 1024 || p > 65535) return;
    await window.bot.setPort(p);
  }

  async function handleSaveSignal(signal) {
    setSaving(true); setSaveMsg('');
    const dir   = (signal.signal ?? signal.direction ?? '').toUpperCase();
    const entry = parseFloat(signal.entry)  || 0;
    const sl    = parseFloat(signal.sl)     || 0;
    const tp    = parseFloat(signal.tp2)    || parseFloat(signal.tp1) || parseFloat(signal.tp) || 0;
    const rr    = tp ? parseFloat(calcRR(entry, sl, tp)) : null;
    const date  = (signal._receivedAt ?? new Date().toISOString()).slice(0, 10);
    const payload = {
      date, pair: signal.symbol || 'MNQ', direction: dir,
      entry, stop: sl, tp,
      rr: rr || null,
      outcome: null, result: null, result_net: null,
      notes: `[BOT SIGNAL] ${signal.context || ''}\nR:R ${signal.rr || (rr ? `1:${rr}` : '—')} · ${signal.timeframe || '—'}M`,
    };
    const res = await window.db.insertTrade(payload);
    setSaving(false);
    if (res.ok) { setSaveMsg('Enregistré dans le journal ✓'); setTimeout(() => setSaveMsg(''), 3000); }
    else setSaveMsg(`Erreur: ${res.error}`);
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000); });
  }

  const webhookUrl = `http://localhost:${port}/webhook`;
  const latest     = signals[0] ?? null;

  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '5px', padding: '7px 10px', color: '#c8d8c8', fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '80px', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '960px' }} ref={flashRef}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#3a6a4a', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px', padding: '0' }}>
          ← Retour au dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: '0 0 4px 0', letterSpacing: '1px' }}>
              BOT TRADING
            </h1>
            <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px' }}>MNQ · SIGNAUX ICT / SMC EN TEMPS RÉEL</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: serverOk ? '#00ff88' : '#ff4455', boxShadow: serverOk ? '0 0 8px #00ff88' : '0 0 8px #ff4455', animation: serverOk ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ fontSize: '11px', color: serverOk ? '#00aa55' : '#ff4455', letterSpacing: '1px' }}>{serverOk ? 'SERVEUR ACTIF' : 'SERVEUR ERREUR'}</span>
          </div>
        </div>
      </div>

      {/* Webhook URL bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px' }}>
        <span style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', flexShrink: 0 }}>WEBHOOK URL</span>
        <code style={{ flex: 1, fontSize: '12px', color: '#00ff88', background: 'rgba(0,255,136,0.06)', padding: '4px 10px', borderRadius: '4px', letterSpacing: '0.5px' }}>
          {webhookUrl}
        </code>
        <button onClick={() => copyText(webhookUrl, 'url')}
          style={{ padding: '5px 12px', background: copied === 'url' ? 'rgba(0,255,136,0.2)' : 'transparent', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '4px', color: '#00ff88', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '1px' }}>
          {copied === 'url' ? '✓ COPIÉ' : 'COPIER'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', borderLeft: '1px solid rgba(0,255,136,0.08)', paddingLeft: '10px' }}>
          <span style={{ fontSize: '10px', color: '#3a6a4a' }}>PORT</span>
          <input value={portInput} onChange={e => setPortInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSetPort()} style={{ ...inp, width: '60px' }} />
          <button onClick={handleSetPort} style={{ padding: '5px 8px', background: 'transparent', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', color: '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>OK</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(0,255,136,0.08)', paddingBottom: '0' }}>
        {[
          { key: 'signals', label: `SIGNAUX${signals.length > 0 ? ` (${signals.length})` : ''}` },
          { key: 'chart',   label: 'GRAPHIQUE TV' },
          { key: 'setup',   label: 'CONFIGURATION' },
          { key: 'pine',    label: 'PINE SCRIPT' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.key ? '#00ff88' : 'transparent'}`, color: tab === t.key ? '#00ff88' : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.15s', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
        {signals.length > 0 && (
          <button onClick={handleClearSignals} style={{ marginLeft: 'auto', padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,68,85,0.15)', borderRadius: '4px', color: '#5a3a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', transition: 'all 0.15s', marginBottom: '2px' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.borderColor = 'rgba(255,68,85,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#5a3a3a'; e.currentTarget.style.borderColor = 'rgba(255,68,85,0.15)'; }}
          >EFFACER</button>
        )}
      </div>

      {/* ── Tab: SIGNAUX ── */}
      {tab === 'signals' && (
        <div>
          {saveMsg && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: saveMsg.startsWith('Erreur') ? 'rgba(255,68,85,0.1)' : 'rgba(0,255,136,0.1)', border: `1px solid ${saveMsg.startsWith('Erreur') ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.3)'}`, borderRadius: '5px', fontSize: '12px', color: saveMsg.startsWith('Erreur') ? '#ff4455' : '#00ff88' }}>
              {saveMsg}
            </div>
          )}

          {signals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(0,255,136,0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📡</div>
              <div style={{ fontSize: '13px', color: '#3a6a4a', marginBottom: '6px' }}>En attente de signaux...</div>
              <div style={{ fontSize: '11px', color: '#2a4a30' }}>Configure ngrok + TradingView pour recevoir les alertes</div>
              <button onClick={() => setTab('setup')} style={{ marginTop: '14px', padding: '7px 16px', background: 'transparent', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', color: '#00aa55', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px' }}>
                VOIR LA CONFIGURATION →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Latest signal — large */}
              <div>
                <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>DERNIER SIGNAL</div>
                <SignalCard signal={latest} onSave={saving ? null : handleSaveSignal} isLatest={true} />
              </div>

              {/* History */}
              {signals.length > 1 && (
                <div>
                  <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>HISTORIQUE — {signals.length - 1} signal{signals.length > 2 ? 's' : ''} précédent{signals.length > 2 ? 's' : ''}</div>
                  <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,255,136,0.04)', borderBottom: '1px solid rgba(0,255,136,0.08)' }}>
                          {['HEURE', 'DIR', 'ENTRY', 'SL', 'TP1', 'TP2', 'R:R', 'CONTEXTE', ''].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', fontWeight: '700' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {signals.slice(1).map((sig, i) => {
                          const dir   = (sig.signal ?? sig.direction ?? '').toUpperCase();
                          const isL   = dir === 'LONG';
                          const color = isL ? '#00ff88' : '#ff4455';
                          const time  = sig.timestamp?.slice(-5) || sig._receivedAt?.slice(11, 16) || '—';
                          return (
                            <tr key={sig._id ?? i} style={{ borderBottom: '1px solid rgba(0,255,136,0.04)', transition: 'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.03)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '8px 12px', color: '#5a8a6a' }}>{time}</td>
                              <td style={{ padding: '8px 12px', fontWeight: '700', color }}>{isL ? '▲' : '▼'} {dir}</td>
                              <td style={{ padding: '8px 12px', color: '#c8d8c8' }}>{parseFloat(sig.entry)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#ff7788' }}>{parseFloat(sig.sl)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#00cc66' }}>{parseFloat(sig.tp1)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#00ff88' }}>{parseFloat(sig.tp2)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 12px', color }}>{sig.rr || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#4a7a5a', fontSize: '10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sig.context || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <button onClick={() => handleSaveSignal(sig)}
                                  style={{ background: 'none', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '3px', color: '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', padding: '2px 7px', transition: 'all 0.12s' }}
                                  onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.4)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.15)'; }}
                                >+</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: GRAPHIQUE TV ── */}
      {tab === 'chart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Explanation */}
          <div style={{ padding: '14px 18px', background: 'rgba(0,170,255,0.05)', border: '1px solid rgba(0,170,255,0.15)', borderRadius: '6px', fontSize: '12px', color: '#5a8a9a', lineHeight: '1.7' }}>
            <span style={{ color: '#00aaff', fontWeight: '700' }}>Pourquoi pas en iframe ?</span> — Le symbole <code style={{ background: 'rgba(0,170,255,0.1)', padding: '1px 6px', borderRadius: '3px', color: '#00ddff' }}>MNQ1!</code> sur TradingView nécessite ta session active (compte + données CME). Un iframe ne peut pas accéder à tes cookies de connexion. Ouvre TradingView dans ton navigateur : ta session est déjà là, les données sont en temps réel.
          </div>

          {/* Quick open buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              {
                label: 'MNQ1! — 5 min',
                sub: 'Micro E-mini Nasdaq · Scalping',
                url: 'https://www.tradingview.com/chart/?symbol=CME_MINI%3AMNQ1%21&interval=5',
                color: '#00ff88',
              },
              {
                label: 'MNQ1! — 15 min',
                sub: 'Micro E-mini Nasdaq · Intraday',
                url: 'https://www.tradingview.com/chart/?symbol=CME_MINI%3AMNQ1%21&interval=15',
                color: '#00ff88',
              },
              {
                label: 'NQ1! — 5 min',
                sub: 'E-mini Nasdaq · Vue macro',
                url: 'https://www.tradingview.com/chart/?symbol=CME_MINI%3ANQ1%21&interval=5',
                color: '#00aaff',
              },
              {
                label: 'NQ1! — 1H',
                sub: 'E-mini Nasdaq · Contexte HTF',
                url: 'https://www.tradingview.com/chart/?symbol=CME_MINI%3ANQ1%21&interval=60',
                color: '#00aaff',
              },
            ].map(btn => (
              <button key={btn.url} onClick={() => window.shell.openExternal(btn.url)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', background: `${btn.color}06`, border: `1px solid ${btn.color}20`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${btn.color}12`; e.currentTarget.style.borderColor = `${btn.color}50`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${btn.color}06`; e.currentTarget.style.borderColor = `${btn.color}20`; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: `${btn.color}15`, border: `1px solid ${btn.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={btn.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: btn.color, marginBottom: '2px' }}>{btn.label}</div>
                  <div style={{ fontSize: '11px', color: '#3a6a4a' }}>{btn.sub}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '16px', color: `${btn.color}60` }}>↗</div>
              </button>
            ))}
          </div>

          {/* Custom URL */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '14px 18px' }}>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>OUVRIR UN SYMBOLE PERSONNALISÉ</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <CustomTVInput />
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: '10px 14px', background: 'rgba(240,192,32,0.04)', border: '1px solid rgba(240,192,32,0.12)', borderRadius: '5px', fontSize: '11px', color: '#6a5a20', lineHeight: '1.6' }}>
            <strong style={{ color: '#f0c020' }}>Astuce :</strong> Dans TradingView, active les alertes sur l'indicateur Pine Script (onglet PINE SCRIPT) et configure le webhook vers ton URL ngrok. Le dashboard recevra les signaux automatiquement pendant que le graphique tourne en parallèle.
          </div>
        </div>
      )}

      {/* ── Tab: CONFIGURATION ── */}
      {tab === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: '#5a8a6a', lineHeight: '1.6', background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '6px', padding: '16px 20px' }}>
            <div style={{ fontSize: '10px', color: '#00ff88', letterSpacing: '2px', marginBottom: '12px', fontWeight: '700' }}>COMMENT ÇA FONCTIONNE</div>
            Le bot reçoit les alertes de TradingView via un <strong style={{ color: '#00ff88' }}>webhook</strong>. Comme TradingView envoie depuis ses serveurs, il faut exposer ton serveur local sur Internet via <strong style={{ color: '#00ff88' }}>ngrok</strong> (gratuit).
          </div>

          {/* Steps */}
          {[
            {
              n: '1', title: 'Installe ngrok',
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#5a8a6a' }}>Télécharge ngrok sur <span style={{ color: '#00aaff' }}>ngrok.com</span> (gratuit) puis lance :</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#00ff88', fontFamily: 'monospace' }}>
                      ngrok http {port}
                    </code>
                    <button onClick={() => copyText(`ngrok http ${port}`, 'ngrok')} style={{ padding: '7px 12px', background: 'transparent', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', color: '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copied === 'ngrok' ? '✓' : 'COPIER'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#3a6a4a' }}>Tu obtiendras une URL du type : <span style={{ color: '#f0c020' }}>https://abc123.ngrok.io</span></div>
                </div>
              )
            },
            {
              n: '2', title: 'Configure l\'alerte TradingView',
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#5a8a6a', lineHeight: '1.7' }}>
                  <div>1. Dans TradingView, ajoute le <strong style={{ color: '#c8d8c8' }}>Pine Script</strong> (onglet PINE SCRIPT)</div>
                  <div>2. Clique <strong style={{ color: '#c8d8c8' }}>Créer une Alerte</strong> sur l'indicateur</div>
                  <div>3. Active <strong style={{ color: '#c8d8c8' }}>Webhook URL</strong> et colle :</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <code style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(240,192,32,0.2)', borderRadius: '4px', padding: '7px 12px', fontSize: '12px', color: '#f0c020', fontFamily: 'monospace' }}>
                      https://TON_URL_NGROK/webhook
                    </code>
                  </div>
                  <div style={{ marginTop: '4px' }}>4. Dans <strong style={{ color: '#c8d8c8' }}>Message</strong>, laisse <code style={{ color: '#00ff88', fontSize: '10px', background: 'rgba(0,255,136,0.08)', padding: '1px 5px', borderRadius: '3px' }}>{'{{strategy.order.alert_message}}'}</code> (le Pine Script gère le JSON)</div>
                </div>
              )
            },
            {
              n: '3', title: 'Teste la connexion',
              content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#5a8a6a' }}>Envoie un signal de test depuis le terminal :</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '4px', padding: '8px 12px', fontSize: '11px', color: '#c8d8c8', fontFamily: 'monospace', lineHeight: '1.4' }}>
                      {`curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d "{\\"symbol\\":\\"MNQ\\",\\"signal\\":\\"LONG\\",\\"entry\\":21450,\\"sl\\":21425,\\"tp1\\":21487,\\"tp2\\":21512,\\"rr\\":\\"1:2.5\\",\\"context\\":\\"TEST\\"}"`}
                    </code>
                    <button onClick={() => copyText(`curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d "{\\"symbol\\":\\"MNQ\\",\\"signal\\":\\"LONG\\",\\"entry\\":21450,\\"sl\\":21425,\\"tp1\\":21487,\\"tp2\\":21512,\\"rr\\":\\"1:2.5\\",\\"context\\":\\"TEST\\"}"`, 'curl')} style={{ padding: '7px 12px', background: 'transparent', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', color: '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {copied === 'curl' ? '✓' : 'COPIER'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#3a6a4a' }}>Si la connexion est OK, le signal apparaît dans l'onglet SIGNAUX.</div>
                </div>
              )
            },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: '14px', background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px 18px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#00ff88', flexShrink: 0 }}>{step.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#c8d8c8', marginBottom: '8px', letterSpacing: '1px' }}>{step.title}</div>
                {step.content}
              </div>
            </div>
          ))}

          {/* Format JSON */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>FORMAT JSON ACCEPTÉ PAR LE WEBHOOK</div>
            <pre style={{ margin: 0, fontSize: '11px', color: '#5a8a6a', fontFamily: 'monospace', lineHeight: '1.6', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>{`{
  "symbol":    "MNQ",          // requis
  "signal":    "LONG",         // requis : "LONG" ou "SHORT"
  "entry":     21450.25,       // requis
  "sl":        21424.00,       // requis
  "tp1":       21487.50,       // optionnel
  "tp2":       21512.50,       // optionnel (utilisé pour R:R si présent)
  "rr":        "1:2.5",        // optionnel (calculé automatiquement)
  "context":   "FVG + OB",     // optionnel : description du signal
  "timeframe": "5"             // optionnel : unité en minutes
}`}</pre>
          </div>
        </div>
      )}

      {/* ── Tab: PINE SCRIPT ── */}
      {tab === 'pine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, fontSize: '11px', color: '#5a8a6a', lineHeight: '1.6' }}>
              Copie ce script dans TradingView → Pine Script Editor, puis active-le sur le graphique <strong style={{ color: '#c8d8c8' }}>MNQ1!</strong>.
              Le script détecte automatiquement les setups ICT (FVG, MSS, VWAP, EMA alignment) et génère des alertes webhook.
            </div>
            <button onClick={() => copyText(PINE_SCRIPT, 'pine')}
              style={{ padding: '8px 16px', background: copied === 'pine' ? 'rgba(0,255,136,0.15)' : 'transparent', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '5px', color: '#00ff88', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {copied === 'pine' ? '✓ COPIÉ' : 'COPIER LE SCRIPT'}
            </button>
          </div>
          <div style={{ background: 'rgba(4,12,8,0.9)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '6px', overflow: 'auto', maxHeight: '520px' }}>
            <pre style={{ margin: 0, padding: '16px 18px', fontSize: '11px', color: '#7aaa8a', fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: '1.65', whiteSpace: 'pre' }}>
              {PINE_SCRIPT.split('\n').map((line, i) => {
                let color = '#7aaa8a';
                if (line.startsWith('//')) color = '#3a6a4a';
                else if (line.startsWith('//@')) color = '#3a5a4a';
                else if (line.match(/^(if|and|or|not|var|varip|import|export|strategy|indicator|library)\b/)) color = '#aa88ff';
                else if (line.match(/\b(alert|plot|plotshape|ta\.|math\.|str\.)\b/)) color = '#00aaff';
                else if (line.match(/["'][^"']*["']/)) color = '#f0c020';
                return <span key={i} style={{ display: 'block', color }}>{line}</span>;
              })}
            </pre>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(240,192,32,0.05)', border: '1px solid rgba(240,192,32,0.15)', borderRadius: '5px', fontSize: '11px', color: '#8a7a30', lineHeight: '1.6' }}>
            <strong style={{ color: '#f0c020' }}>Note :</strong> Ce script est un point de départ ICT/SMC. Ajuste les multiplicateurs ATR (sl_mult, tp1_mult, tp2_mult) selon ton style de trading. Tu peux aussi le combiner avec d'autres indicateurs dans ta bibliothèque TradingView.
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
