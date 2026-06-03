import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

// MNQ : 10 contrats × $2.00/pt = $20.00 par point
const MNQ_CONTRACTS  = 10;
const MNQ_PTS_TO_USD = 2 * MNQ_CONTRACTS;

function calcPts(a, b) { return Math.abs(a - b); }
function calcUsd(pts)   { return (pts * MNQ_PTS_TO_USD).toFixed(2); }
function calcRR(entry, sl, tp) {
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (!risk) return null;
  return (reward / risk).toFixed(2);
}

// ── Formatage heure Paris ─────────────────────────────────────
function fmtTime(raw, showSeconds = false) {
  if (!raw) return '—';
  let d;
  const num = Number(raw);
  d = (!isNaN(num) && num > 1_000_000_000_000) ? new Date(num) : new Date(raw);
  if (isNaN(d.getTime())) return '—';
  const tz  = 'Europe/Paris';
  const now  = new Date();
  const opts = { timeZone: tz, hour: '2-digit', minute: '2-digit', ...(showSeconds && { second: '2-digit' }), hour12: false };
  const timeStr = d.toLocaleTimeString('fr-FR', opts);
  const dayD    = d.toLocaleDateString('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit' });
  const dayNow  = now.toLocaleDateString('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit' });
  return dayD !== dayNow ? `${dayD} ${timeStr}` : timeStr;
}

// ── Calcul stats signaux ──────────────────────────────────────
function computeTradeStats(signals) {
  const rated  = signals.filter(s => s._outcome === 'win' || s._outcome === 'loss' || s._outcome === 'be');
  const wins   = rated.filter(s => s._outcome === 'win');
  const losses = rated.filter(s => s._outcome === 'loss');
  const bes    = rated.filter(s => s._outcome === 'be');
  const wl     = wins.length + losses.length;

  const winrate = wl > 0 ? Math.round(wins.length / wl * 100) : null;

  const rrVals = signals
    .filter(s => s.rr)
    .map(s => { const n = parseFloat(String(s.rr).replace('1:', '')); return isNaN(n) ? null : n; })
    .filter(Boolean);
  const avgRR = rrVals.length > 0 ? (rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(2) : null;

  let totalPts = 0;
  for (const sig of rated) {
    const e  = parseFloat(sig.entry) || 0;
    const sl = parseFloat(sig.sl)    || 0;
    const tp = parseFloat(sig.tp2) || parseFloat(sig.tp1) || parseFloat(sig.tp) || 0;
    if (sig._outcome === 'win'  && tp) totalPts += Math.abs(tp - e);
    if (sig._outcome === 'loss' && sl) totalPts -= Math.abs(e - sl);
  }

  return {
    total: rated.length, wins: wins.length, losses: losses.length, bes: bes.length,
    winrate, avgRR,
    totalPts: Math.round(totalPts * 100) / 100,
    totalUsd: Math.round(totalPts * MNQ_PTS_TO_USD * 100) / 100,
  };
}

// ── Pine Script multi-bot (ICT Full Strategy) ─────────────────
const PINE_BOTS = [
  { id: 'ultra',    name: 'ICT Ultra',    botId: 'ICT_1min',  tf: '1min',  color: '#ff6644', sl: 0.8, htfTf: '15',  minScore: 3, desc: 'Scalping · HTF 15min · score ≥ 3 · TP R:R 1:2' },
  { id: 'micro',    name: 'ICT Micro',    botId: 'ICT_2min',  tf: '2min',  color: '#ff44aa', sl: 0.8, htfTf: '15',  minScore: 3, desc: 'Scalping · HTF 15min · score ≥ 3 · TP R:R 1:2' },
  { id: 'rapide',   name: 'ICT Rapide',   botId: 'ICT_3min',  tf: '3min',  color: '#aa44ff', sl: 0.9, htfTf: '15',  minScore: 3, desc: 'Scalping · HTF 15min · score ≥ 3 · TP R:R 1:2' },
  { id: 'agressif', name: 'ICT Agressif', botId: 'ICT_5min',  tf: '5min',  color: '#f0c020', sl: 1.0, htfTf: '60',  minScore: 3, desc: 'Scalping · HTF 1H · score ≥ 3 · TP R:R 1:2' },
  { id: 'standard', name: 'ICT Standard', botId: 'ICT_15min', tf: '15min', color: '#00ff88', sl: 1.5, htfTf: '240', minScore: 4, desc: 'Intraday · HTF 4H · score ≥ 4 · TP R:R 1:2' },
];

const PINE_EDIT_SCRIPT = `//@version=6
indicator('ICT Setup — Liquidity + MSS + FVG', overlay = true, max_boxes_count = 50, max_lines_count = 100)

// ─── INPUTS ───────────────────────────────────────────────────────────────
var g1 = 'Swing Detection'
swing_len = input.int(5, 'Swing Length', group = g1)

var g2 = 'Liquidity'
liq_len = input.int(20, 'Lookback Equal H/L', group = g2)
liq_tol = input.float(0.10, 'Tolerance % égalité', group = g2, step = 0.01)

var g3 = 'FVG'
fvg_min_pts = input.float(5.0, 'Taille min FVG (pts)', group = g3)

var g4 = 'Display'
show_liq = input.bool(true, 'Afficher liquidité', group = g4)
show_mss = input.bool(true, 'Afficher MSS', group = g4)
show_fvg = input.bool(true, 'Afficher FVG', group = g4)
show_ob  = input.bool(true, 'Afficher Order Block', group = g4)

// ─── COULEURS ─────────────────────────────────────────────────────────────
bull_col = color.new(color.teal, 0)
bull_bg  = color.new(color.teal, 85)
bear_col = color.new(color.red, 0)
bear_bg  = color.new(color.red, 85)
liq_col  = color.new(color.orange, 0)
mss_col  = color.new(color.purple, 0)

// ─── SWING HIGH / LOW ─────────────────────────────────────────────────────
swing_high = ta.pivothigh(high, swing_len, swing_len)
swing_low  = ta.pivotlow(low,  swing_len, swing_len)

var float last_sh     = na
var float last_sl     = na
var int   last_sh_bar = na
var int   last_sl_bar = na

if not na(swing_high)
    last_sh     := swing_high
    last_sh_bar := bar_index - swing_len

if not na(swing_low)
    last_sl     := swing_low
    last_sl_bar := bar_index - swing_len

// ─── EQUAL HIGHS / LOWS (LIQUIDITÉ) ───────────────────────────────────────
var array<float> eq_highs = array.new_float()
var array<float> eq_lows  = array.new_float()

if not na(swing_high)
    sh = swing_high
    for i = 1 to liq_len by 1
        prev = high[i + swing_len]
        if math.abs(sh - prev) / sh * 100 < liq_tol
            array.push(eq_highs, sh)
            if show_liq
                line.new(bar_index - swing_len - i, prev, bar_index - swing_len, sh, color = liq_col, style = line.style_dashed, width = 1)
            break

if not na(swing_low)
    sl = swing_low
    for i = 1 to liq_len by 1
        prev = low[i + swing_len]
        if math.abs(sl - prev) / sl * 100 < liq_tol
            array.push(eq_lows, sl)
            if show_liq
                line.new(bar_index - swing_len - i, prev, bar_index - swing_len, sl, color = liq_col, style = line.style_dashed, width = 1)
            break

// ─── LIQUIDITY SWEEP ──────────────────────────────────────────────────────
var bool  bull_sweep      = false
var bool  bear_sweep      = false
var float sweep_low_val   = na
var float sweep_high_val  = na

if array.size(eq_lows) > 0
    lvl = array.get(eq_lows, array.size(eq_lows) - 1)
    if low < lvl and close > lvl
        bull_sweep    := true
        sweep_low_val := low
        array.clear(eq_lows)

if array.size(eq_highs) > 0
    lvl = array.get(eq_highs, array.size(eq_highs) - 1)
    if high > lvl and close < lvl
        bear_sweep     := true
        sweep_high_val := high
        array.clear(eq_highs)

// ─── MSS (MARKET STRUCTURE SHIFT) ─────────────────────────────────────────
var bool bull_mss = false
var bool bear_mss = false

if bull_sweep and not na(last_sh)
    if close > last_sh
        bull_mss   := true
        bull_sweep := false
        if show_mss
            label.new(bar_index, high, 'MSS ▲', color = bull_bg, textcolor = bull_col, style = label.style_label_down, size = size.small)

if bear_sweep and not na(last_sl)
    if close < last_sl
        bear_mss   := true
        bear_sweep := false
        if show_mss
            label.new(bar_index, low, 'MSS ▼', color = bear_bg, textcolor = bear_col, style = label.style_label_up, size = size.small)

// ─── FVG (FAIR VALUE GAP) ─────────────────────────────────────────────────
var bool  bull_fvg_active = false
var float bull_fvg_hi     = na
var float bull_fvg_lo     = na
var bool  bear_fvg_active = false
var float bear_fvg_hi     = na
var float bear_fvg_lo     = na

bull_fvg_size = low - high[2]
if bull_fvg_size > fvg_min_pts
    bull_fvg_active := true
    bull_fvg_hi     := low
    bull_fvg_lo     := high[2]
    if show_fvg
        box.new(bar_index - 2, bull_fvg_hi, bar_index + 20, bull_fvg_lo, bgcolor = bull_bg, border_color = bull_col, border_width = 1)

bear_fvg_size = low[2] - high
if bear_fvg_size > fvg_min_pts
    bear_fvg_active := true
    bear_fvg_hi     := low[2]
    bear_fvg_lo     := high
    if show_fvg
        box.new(bar_index - 2, bear_fvg_hi, bar_index + 20, bear_fvg_lo, bgcolor = bear_bg, border_color = bear_col, border_width = 1)

// ─── ORDER BLOCK ──────────────────────────────────────────────────────────
displacement_up   = close > close[1] * 1.002 and close[1] > close[2] * 1.002
displacement_down = close < close[1] * 0.998 and close[1] < close[2] * 0.998

bull_ob = displacement_up   and close[3] < open[3]
bear_ob = displacement_down and close[3] > open[3]

if bull_ob and show_ob
    box.new(bar_index - 3, high[3], bar_index + 20, low[3], bgcolor = color.new(color.teal, 80), border_color = color.teal, border_width = 1, text = 'OB Bull', text_color = color.teal, text_size = size.small)

if bear_ob and show_ob
    box.new(bar_index - 3, high[3], bar_index + 20, low[3], bgcolor = color.new(color.red, 80), border_color = color.red, border_width = 1, text = 'OB Bear', text_color = color.red, text_size = size.small)

// ─── SIGNAL D'ENTRÉE COMPLET ──────────────────────────────────────────────
buy_signal  = bull_mss and bull_fvg_active and close >= bull_fvg_lo and close <= bull_fvg_hi
sell_signal = bear_mss and bear_fvg_active and close >= bear_fvg_lo and close <= bear_fvg_hi

// ─── BUY ──────────────────────────────────────────────────────────────────
if buy_signal
    label.new(bar_index, low, 'BUY ✓', color = bull_col, textcolor = color.white, style = label.style_label_up, size = size.normal)
    if not na(sweep_low_val)
        sl_v  = sweep_low_val - 5.0
        risk  = close - sl_v
        tp_v  = close + risk * 2.0
        tp2_v = close + risk * 3.0
        line.new(bar_index, sl_v,  bar_index + 30, sl_v,  color = bear_col, style = line.style_dotted, width = 2)
        line.new(bar_index, tp_v,  bar_index + 30, tp_v,  color = bull_col, style = line.style_dotted, width = 1)
        line.new(bar_index, tp2_v, bar_index + 30, tp2_v, color = bull_col, style = line.style_dashed, width = 1)
        alert('{"type":"test","bot":"ICT_EDIT","symbol":"MNQ","signal":"LONG","entry":' + str.tostring(close) + ',"sl":' + str.tostring(sl_v) + ',"tp":' + str.tostring(tp_v) + ',"rr":"1:2","context":"LIQ+MSS+FVG","timeframe":"' + timeframe.period + '"}', alert.freq_once_per_bar_close)
    else
        alert('{"type":"test","bot":"ICT_EDIT","symbol":"MNQ","signal":"LONG","entry":' + str.tostring(close) + ',"rr":"1:2","context":"LIQ+MSS+FVG","timeframe":"' + timeframe.period + '"}', alert.freq_once_per_bar_close)

// ─── SELL ─────────────────────────────────────────────────────────────────
if sell_signal
    label.new(bar_index, high, 'SELL ✓', color = bear_col, textcolor = color.white, style = label.style_label_down, size = size.normal)
    if not na(sweep_high_val)
        sl_v  = sweep_high_val + 5.0
        risk  = sl_v - close
        tp_v  = close - risk * 2.0
        tp2_v = close - risk * 3.0
        line.new(bar_index, sl_v,  bar_index + 30, sl_v,  color = bull_col, style = line.style_dotted, width = 2)
        line.new(bar_index, tp_v,  bar_index + 30, tp_v,  color = bear_col, style = line.style_dotted, width = 1)
        line.new(bar_index, tp2_v, bar_index + 30, tp2_v, color = bear_col, style = line.style_dashed, width = 1)
        alert('{"type":"test","bot":"ICT_EDIT","symbol":"MNQ","signal":"SHORT","entry":' + str.tostring(close) + ',"sl":' + str.tostring(sl_v) + ',"tp":' + str.tostring(tp_v) + ',"rr":"1:2","context":"LIQ+MSS+FVG","timeframe":"' + timeframe.period + '"}', alert.freq_once_per_bar_close)
    else
        alert('{"type":"test","bot":"ICT_EDIT","symbol":"MNQ","signal":"SHORT","entry":' + str.tostring(close) + ',"rr":"1:2","context":"LIQ+MSS+FVG","timeframe":"' + timeframe.period + '"}', alert.freq_once_per_bar_close)
`.trim();

function generateScript({ name, botId, sl, htfTf, minScore }) {
  return `//@version=6
indicator("${name}", overlay=true, max_bars_back=500, max_lines_count=200, max_boxes_count=200, max_labels_count=200)

// ── Identité ──────────────────────────────────────────────────
bot_name    = "${botId}"
symbol_name = "MNQ"

// ── Inputs ───────────────────────────────────────────────────
htf_tf      = input.timeframe("${htfTf}", "Timeframe HTF")
show_bias   = input.bool(true,  "Afficher le bias HTF")
liq_len     = input.int(10,     "Longueur swing (EQH/EQL)", minval=3)
eq_thresh   = input.float(0.05, "Seuil Equal H/L (%)", step=0.01)
show_liq    = input.bool(true,  "Afficher les zones de liquidité")
mss_len     = input.int(5,      "Sensibilité MSS", minval=2)
show_mss    = input.bool(true,  "Afficher MSS")
show_bos    = input.bool(true,  "Afficher BOS")
show_fvg    = input.bool(true,  "Afficher les FVG")
fvg_min_pct = input.float(0.03, "Taille min FVG (%)", step=0.01)
show_ob     = input.bool(true,  "Afficher les Order Blocks")
show_entry  = input.bool(true,  "Afficher les signaux d'entrée")
show_kz     = input.bool(true,  "Afficher Kill Zones")

col_bull  = color.new(#00e676, 0)
col_bear  = color.new(#ff1744, 0)
col_fvg_b = color.new(#00e676, 80)
col_fvg_s = color.new(#ff1744, 80)
col_ob_b  = color.new(#29b6f6, 75)
col_ob_s  = color.new(#ffa726, 75)

// ── 1. HTF BIAS ───────────────────────────────────────────────
htf_close = request.security(syminfo.tickerid, htf_tf, close)
htf_ema20 = request.security(syminfo.tickerid, htf_tf, ta.ema(close, 20))
htf_ema50 = request.security(syminfo.tickerid, htf_tf, ta.ema(close, 50))

htf_bullish = htf_close > htf_ema20 and htf_ema20 > htf_ema50
htf_bearish = htf_close < htf_ema20 and htf_ema20 < htf_ema50

if show_bias and barstate.islast
    bias_txt = htf_bullish ? "BULLISH ▲" : htf_bearish ? "BEARISH ▼" : "RANGE ↔"
    bias_col = htf_bullish ? col_bull : htf_bearish ? col_bear : color.gray
    label.new(bar_index, high, "HTF Bias: " + bias_txt + " (" + htf_tf + ")",
      color=bias_col, textcolor=color.white, style=label.style_label_left, size=size.normal)

// ── 2. LIQUIDITÉ ─────────────────────────────────────────────
swing_high = ta.pivothigh(high, liq_len, liq_len)
swing_low  = ta.pivotlow(low,  liq_len, liq_len)

if show_liq and not na(swing_high)
    line.new(bar_index - liq_len, swing_high, bar_index + liq_len, swing_high,
      color=color.new(col_bear, 40), style=line.style_dotted)
    label.new(bar_index - liq_len, swing_high, "SSL",
      color=color.new(col_bear, 20), textcolor=color.white, style=label.style_label_right, size=size.tiny)

if show_liq and not na(swing_low)
    line.new(bar_index - liq_len, swing_low, bar_index + liq_len, swing_low,
      color=color.new(col_bull, 40), style=line.style_dotted)
    label.new(bar_index - liq_len, swing_low, "BSL",
      color=color.new(col_bull, 20), textcolor=color.white, style=label.style_label_right, size=size.tiny)

var float prev_sh = na
var float prev_sl = na

if not na(swing_high)
    if not na(prev_sh) and math.abs(swing_high - prev_sh) / prev_sh * 100 <= eq_thresh
        if show_liq
            box.new(bar_index - liq_len * 2, math.max(swing_high, prev_sh),
              bar_index + 5, math.min(swing_high, prev_sh),
              border_color=col_bear, bgcolor=color.new(col_bear, 85))
            label.new(bar_index - liq_len, math.max(swing_high, prev_sh), "EQH 🎯",
              color=col_bear, textcolor=color.white, style=label.style_label_down, size=size.small)
    prev_sh := swing_high

if not na(swing_low)
    if not na(prev_sl) and math.abs(swing_low - prev_sl) / prev_sl * 100 <= eq_thresh
        if show_liq
            box.new(bar_index - liq_len * 2, math.max(swing_low, prev_sl),
              bar_index + 5, math.min(swing_low, prev_sl),
              border_color=col_bull, bgcolor=color.new(col_bull, 85))
            label.new(bar_index - liq_len, math.min(swing_low, prev_sl), "EQL 🎯",
              color=col_bull, textcolor=color.white, style=label.style_label_up, size=size.small)
    prev_sl := swing_low

// ── 3. MSS / BOS ─────────────────────────────────────────────
ph = ta.pivothigh(high, mss_len, mss_len)
pl = ta.pivotlow(low,  mss_len, mss_len)

var float last_ph      = na
var float last_pl      = na
var bool  in_downtrend = false
var bool  in_uptrend   = false

if not na(ph)
    last_ph := ph
if not na(pl)
    last_pl := pl

bos_bull = not na(last_ph) and close > last_ph and close[1] <= last_ph[1]
bos_bear = not na(last_pl) and close < last_pl and close[1] >= last_pl[1]

mss_bull_sig = in_downtrend and bos_bull
mss_bear_sig = in_uptrend   and bos_bear

if bos_bear
    in_downtrend := true
    in_uptrend   := false
if bos_bull
    in_uptrend   := true
    in_downtrend := false

if show_mss
    if mss_bull_sig
        label.new(bar_index, low,  "MSS ▲", color=col_bull, textcolor=color.white, style=label.style_label_up,   size=size.small)
    if mss_bear_sig
        label.new(bar_index, high, "MSS ▼", color=col_bear, textcolor=color.white, style=label.style_label_down, size=size.small)

if show_bos
    if bos_bull and not mss_bull_sig
        label.new(bar_index, low,  "BOS ▲", color=color.new(col_bull, 40), textcolor=color.white, style=label.style_label_up,   size=size.tiny)
    if bos_bear and not mss_bear_sig
        label.new(bar_index, high, "BOS ▼", color=color.new(col_bear, 40), textcolor=color.white, style=label.style_label_down, size=size.tiny)

// ── 4. DISPLACEMENT ──────────────────────────────────────────
candle_body  = math.abs(close - open)
candle_range = high - low
body_ratio   = candle_range > 0 ? candle_body / candle_range : 0
avg_range    = ta.sma(candle_range, 14)

displacement_bull = close > open and body_ratio > 0.6 and candle_range > avg_range * 1.5
displacement_bear = close < open and body_ratio > 0.6 and candle_range > avg_range * 1.5

// ── 5. FVG ───────────────────────────────────────────────────
fvg_bull_cond = low > high[2] and (low - high[2]) / high[2] * 100 >= fvg_min_pct
fvg_bear_cond = high < low[2] and (low[2] - high) / low[2] * 100 >= fvg_min_pct

if show_fvg
    if fvg_bull_cond
        box.new(bar_index - 2, low, bar_index + 20, high[2],
          border_color=color.new(col_bull, 60), bgcolor=col_fvg_b)
        label.new(bar_index, low, "FVG ▲",
          color=color.new(col_bull, 40), textcolor=color.white, style=label.style_label_up, size=size.tiny)
    if fvg_bear_cond
        box.new(bar_index - 2, low[2], bar_index + 20, high,
          border_color=color.new(col_bear, 60), bgcolor=col_fvg_s)
        label.new(bar_index, high, "FVG ▼",
          color=color.new(col_bear, 40), textcolor=color.white, style=label.style_label_down, size=size.tiny)

// ── 6. ORDER BLOCK ────────────────────────────────────────────
ob_bull_cond = displacement_bull and close[1] < open[1]
ob_bear_cond = displacement_bear and close[1] > open[1]

if show_ob
    if ob_bull_cond
        box.new(bar_index - 1, math.min(open[1], close[1]),
          bar_index + 30, math.max(open[1], close[1]),
          border_color=color.new(col_ob_b, 20), bgcolor=col_ob_b)
        label.new(bar_index - 1, math.min(open[1], close[1]), "OB ▲",
          color=col_ob_b, textcolor=color.white, style=label.style_label_up, size=size.tiny)
    if ob_bear_cond
        box.new(bar_index - 1, math.min(open[1], close[1]),
          bar_index + 30, math.max(open[1], close[1]),
          border_color=color.new(col_ob_s, 20), bgcolor=col_ob_s)
        label.new(bar_index - 1, math.max(open[1], close[1]), "OB ▼",
          color=col_ob_s, textcolor=color.white, style=label.style_label_down, size=size.tiny)

// ── 7. KILL ZONES (heure française — Europe/Paris) ────────────
h_fr    = hour(time,   "Europe/Paris")
m_fr    = minute(time, "Europe/Paris")
time_fr = h_fr + m_fr / 60.0

asia_kz     = time_fr >= 2.0  and time_fr < 6.0
london_kz   = time_fr >= 8.0  and time_fr < 11.0
ny_am_kz    = time_fr >= 13.0 and time_fr < 17.5
ny_lunch_kz = time_fr >= 17.5 and time_fr < 19.5
ny_pm_kz    = time_fr >= 19.5 and time_fr < (22.0 + 14.0 / 60.0)
in_kz       = asia_kz or london_kz or ny_am_kz or ny_lunch_kz or ny_pm_kz

kz_col = asia_kz     ? color.new(#7b1fa2, 88) :
         london_kz   ? color.new(#ffd600, 88) :
         ny_am_kz    ? color.new(#00bcd4, 88) :
         ny_lunch_kz ? color.new(#ff6d00, 88) :
         ny_pm_kz    ? color.new(#ab47bc, 88) : color.new(color.gray, 100)
bgcolor(show_kz and in_kz ? kz_col : na)

prev_kz = asia_kz[1] or london_kz[1] or ny_am_kz[1] or ny_lunch_kz[1] or ny_pm_kz[1]
if show_kz and in_kz and not prev_kz
    kz_txt = asia_kz     ? "🌏 Asia KZ (2h-6h)"          :
             london_kz   ? "🇬🇧 London KZ (8h-11h)"      :
             ny_am_kz    ? "🗽 NY AM KZ (13h-17h30)"     :
             ny_lunch_kz ? "🍽 NY Lunch (17h30-19h30)"   : "🗽 NY PM KZ (19h30-22h14)"
    label.new(bar_index, high * 1.001, kz_txt,
      color=color.new(color.gray, 60), textcolor=color.white, style=label.style_label_down, size=size.small)

// ── 8. SCORE & SIGNAL ─────────────────────────────────────────
lookback = 5

recent_mss_bull  = ta.barssince(mss_bull_sig)      < lookback
recent_mss_bear  = ta.barssince(mss_bear_sig)      < lookback
recent_disp_bull = ta.barssince(displacement_bull) < lookback
recent_disp_bear = ta.barssince(displacement_bear) < lookback
recent_fvg_bull  = ta.barssince(fvg_bull_cond)     < lookback
recent_fvg_bear  = ta.barssince(fvg_bear_cond)     < lookback
recent_ob_bull   = ta.barssince(ob_bull_cond)       < lookback
recent_ob_bear   = ta.barssince(ob_bear_cond)       < lookback

poi_bull = recent_fvg_bull or recent_ob_bull
poi_bear = recent_fvg_bear or recent_ob_bear

score_bull = (htf_bullish      ? 1 : 0) + (recent_mss_bull  ? 1 : 0) +
             (recent_disp_bull ? 1 : 0) + (poi_bull          ? 1 : 0) + (in_kz ? 1 : 0)
score_bear = (htf_bearish      ? 1 : 0) + (recent_mss_bear  ? 1 : 0) +
             (recent_disp_bear ? 1 : 0) + (poi_bear          ? 1 : 0) + (in_kz ? 1 : 0)

entry_long  = show_entry and score_bull >= ${minScore}
entry_short = show_entry and score_bear >= ${minScore}

plotshape(entry_long,  title="ICT Long",  style=shape.triangleup,   location=location.belowbar, color=col_bull, size=size.normal, text="ICT L")
plotshape(entry_short, title="ICT Short", style=shape.triangledown,  location=location.abovebar, color=col_bear, size=size.normal, text="ICT S")

// ── 9. ALERTES WEBHOOK (JSON → dashboard) ─────────────────────
atr     = ta.atr(14)
sl_mult = ${sl}
tp_mult = ${sl * 2}

// Tracking position ouverte pour détection automatique TP/SL
var float trk_entry = na
var float trk_sl    = na
var float trk_tp    = na
var bool  trk_long  = false
var bool  trk_open  = false

// ── Clôture automatique (prioritaire sur tout nouveau signal) ──
if trk_open
    hit_tp = trk_long ? high >= trk_tp : low  <= trk_tp
    hit_sl = trk_long ? low  <= trk_sl : high >= trk_sl
    if hit_tp
        alert('{"type":"close","result":"win","bot":"' + bot_name + '"}', alert.freq_once_per_bar_close)
        trk_open := false
    else if hit_sl
        alert('{"type":"close","result":"loss","bot":"' + bot_name + '"}', alert.freq_once_per_bar_close)
        trk_open := false

// ── Nouveau signal uniquement si aucune position ouverte sur ce TF ──
if entry_long and not trk_open
    e   = close
    s   = math.round((e - atr * sl_mult) * 100) / 100
    t   = math.round((e + atr * tp_mult) * 100) / 100
    ctx = (recent_fvg_bull ? "FVG " : "") + (recent_ob_bull ? "OB " : "") + (mss_bull_sig ? "MSS " : "") + "KZ:" + (in_kz ? "Y" : "N") + " score:" + str.tostring(score_bull)
    msg = '{"bot":"' + bot_name + '","symbol":"' + symbol_name +
          '","signal":"LONG","entry":' + str.tostring(e) +
          ',"sl":' + str.tostring(s) +
          ',"tp":' + str.tostring(t) +
          ',"rr":"1:2' +
          '","context":"' + ctx +
          '","timeframe":"' + timeframe.period + '","timestamp":"{{time}}"}'
    alert(msg, alert.freq_once_per_bar_close)
    trk_entry := e
    trk_sl    := s
    trk_tp    := t
    trk_long  := true
    trk_open  := true

if entry_short and not trk_open
    e   = close
    s   = math.round((e + atr * sl_mult) * 100) / 100
    t   = math.round((e - atr * tp_mult) * 100) / 100
    ctx = (recent_fvg_bear ? "FVG " : "") + (recent_ob_bear ? "OB " : "") + (mss_bear_sig ? "MSS " : "") + "KZ:" + (in_kz ? "Y" : "N") + " score:" + str.tostring(score_bear)
    msg = '{"bot":"' + bot_name + '","symbol":"' + symbol_name +
          '","signal":"SHORT","entry":' + str.tostring(e) +
          ',"sl":' + str.tostring(s) +
          ',"tp":' + str.tostring(t) +
          ',"rr":"1:2' +
          '","context":"' + ctx +
          '","timeframe":"' + timeframe.period + '","timestamp":"{{time}}"}'
    alert(msg, alert.freq_once_per_bar_close)
    trk_entry := e
    trk_sl    := s
    trk_tp    := t
    trk_long  := false
    trk_open  := true

// Alerte barre — fallback détection TP/SL côté dashboard
alert('{"type":"bar","bot":"' + bot_name + '","h":' + str.tostring(math.round(high * 100) / 100) + ',"l":' + str.tostring(math.round(low * 100) / 100) + '}', alert.freq_once_per_bar_close)

// ── 10. DASHBOARD TABLE ───────────────────────────────────────
var table dash = table.new(position.top_right, 2, 10,
  border_color=color.new(color.gray, 60), border_width=1,
  bgcolor=color.new(#1a1a2e, 10))

f_ok(v) => v ? "✅" : "❌"
f_row(t, ok, r, v) =>
    table.cell(t, 0, r, v,      text_color=color.white, bgcolor=color.new(#1a1a2e, 30),   text_size=size.small)
    table.cell(t, 1, r, f_ok(ok), text_color=color.white, bgcolor=ok ? color.new(#00e676, 60) : color.new(#ff1744, 60), text_size=size.small)

if barstate.islast
    table.cell(dash, 0, 0, "ICT [" + bot_name + "] " + timeframe.period + "m",
      text_color=color.white, bgcolor=color.new(#0d1117, 20), text_size=size.small)
    table.cell(dash, 1, 0, htf_bullish ? "BULL" : htf_bearish ? "BEAR" : "RANGE",
      text_color=color.white,
      bgcolor=htf_bullish ? color.new(col_bull, 40) : htf_bearish ? color.new(col_bear, 40) : color.new(color.gray, 40),
      text_size=size.small)
    f_row(dash, htf_bullish or htf_bearish,          1, "1. Bias HTF")
    f_row(dash, recent_mss_bull or recent_mss_bear,   2, "2. MSS")
    f_row(dash, recent_disp_bull or recent_disp_bear, 3, "3. Displacement")
    f_row(dash, recent_fvg_bull or recent_fvg_bear,   4, "4. FVG")
    f_row(dash, recent_ob_bull or recent_ob_bear,     5, "5. Order Block")
    f_row(dash, in_kz,                                6, "6. Kill Zone")
    f_row(dash, entry_long or entry_short,            7, "→ SETUP ≥ ${minScore}/5")
    score_max = math.max(score_bull, score_bear)
    table.cell(dash, 0, 8, "Score: " + str.tostring(score_max) + "/5",
      text_color=color.white, bgcolor=color.new(#0d1117, 20), text_size=size.small)
    table.cell(dash, 1, 8, entry_long and not trk_open ? "LONG 🟢" : entry_short and not trk_open ? "SHORT 🔴" : trk_open ? "⏳ EN COURS" : "—",
      text_color=color.white,
      bgcolor=entry_long and not trk_open ? color.new(col_bull, 40) : entry_short and not trk_open ? color.new(col_bear, 40) : trk_open ? color.new(#f0c020, 50) : color.new(color.gray, 60),
      text_size=size.small)
    table.cell(dash, 0, 9, trk_open ? "🔒 SLOT " + timeframe.period + "m OCCUPÉ" : "🟢 SLOT " + timeframe.period + "m LIBRE",
      text_color=color.white,
      bgcolor=trk_open ? color.new(#f0c020, 40) : color.new(#00e676, 70),
      text_size=size.small)
    table.cell(dash, 1, 9, trk_open ? (trk_long ? "▲ " + str.tostring(trk_entry) : "▼ " + str.tostring(trk_entry)) : "—",
      text_color=color.white,
      bgcolor=trk_open ? color.new(#1a1a2e, 20) : color.new(color.gray, 80),
      text_size=size.small)
`;
}

// ── Signal Card ───────────────────────────────────────────────
function SignalCard({ signal, onSave, isLatest }) {
  const dir      = (signal.signal ?? signal.direction ?? '').toUpperCase();
  const isLong   = dir === 'LONG';
  const entry    = parseFloat(signal.entry)  || 0;
  const sl       = parseFloat(signal.sl)     || 0;
  const tp       = parseFloat(signal.tp) || parseFloat(signal.tp2) || parseFloat(signal.tp1) || 0;
  const slPts    = calcPts(entry, sl);
  const tpPts    = tp ? calcPts(entry, tp) : null;
  const rrAuto   = tp ? calcRR(entry, sl, tp) : null;
  const rrDisplay= signal.rr || (rrAuto ? `1:${rrAuto}` : '—');

  const accentColor = isLong ? '#00ff88' : '#ff4455';
  const bgColor     = isLong ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,85,0.04)';

  const timeRecu  = fmtTime(signal._receivedAt, true);
  const timeBougie = signal.timestamp && isNaN(Number(signal.timestamp))
    ? fmtTime(signal.timestamp) : null;

  return (
    <div style={{ background: bgColor, border: `1px solid ${accentColor}25`, borderLeft: `3px solid ${accentColor}`, borderRadius: '8px', padding: '18px 20px', position: 'relative' }}>
      {/* Direction + Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ padding: '4px 14px', borderRadius: '4px', background: `${accentColor}18`, border: `1px solid ${accentColor}50`, fontSize: '15px', fontWeight: '700', color: accentColor, letterSpacing: '2px' }}>
          {isLong ? '▲' : '▼'} {dir}
        </div>
        <div style={{ fontSize: '13px', color: '#8aaa90', fontWeight: '600' }}>{signal.symbol || 'MNQ'}</div>
        {signal.bot && (() => { const b = PINE_BOTS.find(x => x.botId === signal.bot); const c = b?.color ?? '#aa88ff'; return <div style={{ fontSize: '10px', color: c, background: `${c}15`, border: `1px solid ${c}40`, padding: '2px 8px', borderRadius: '3px', fontWeight: '700', letterSpacing: '1px' }}>{signal.bot}</div>; })()}
        {fmtTf(signal.timeframe) && <div style={{ fontSize: '11px', color: '#3a6a4a', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)', padding: '2px 7px', borderRadius: '3px' }}>{fmtTf(signal.timeframe)}</div>}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
          <div style={{ fontSize: '13px', color: '#c8d8c8', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{timeRecu}</div>
          {timeBougie && timeBougie !== timeRecu && (
            <div style={{ fontSize: '9px', color: '#3a6a4a' }}>bougie : {timeBougie}</div>
          )}
          <div style={{ fontSize: '9px', color: '#2a4a30' }}>heure Paris</div>
        </div>
        {signal.type === 'test' && <div style={{ fontSize: '8px', background: 'rgba(240,120,32,0.15)', border: '1px solid rgba(240,120,32,0.4)', color: '#f07820', padding: '2px 6px', borderRadius: '3px', letterSpacing: '1px', fontWeight: '700' }}>TEST</div>}
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
            <span style={{ color: '#3a2a2a', marginLeft: '4px' }}>(10 MNQ)</span>
          </div>
        </div>
        {/* TP unique */}
        {tp > 0 && (
          <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontSize: '9px', color: '#2a5a3a', letterSpacing: '2px', marginBottom: '4px' }}>🎯 TP  <span style={{ color: '#3a9a5a', fontSize: '8px', marginLeft: '4px' }}>R:R 1:2</span></div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00ff88' }}>{tp.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: '#2a5a3a', marginTop: '2px' }}>
              {tpPts.toFixed(2)} pts · <span style={{ color: '#00ff88' }}>+${calcUsd(tpPts)}</span>
              <span style={{ color: '#2a5a3a', marginLeft: '4px' }}>(10 MNQ)</span>
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

// ── Bot Stats helpers ─────────────────────────────────────────
function pnlColor(v) { return v > 0 ? '#00ff88' : v < 0 ? '#ff4455' : '#8aaa90'; }
function fmtUsd(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function getTimeFrDec(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0');
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0');
  return h + m / 60;
}
function getKZLabel(iso) {
  const t = getTimeFrDec(iso);
  if (t === null) return 'Hors KZ';
  if (t >= 2    && t < 6)                return '🌏 Asia';
  if (t >= 8    && t < 11)               return '🇬🇧 London';
  if (t >= 13   && t < 17.5)             return '🗽 NY AM';
  if (t >= 17.5 && t < 19.5)             return '🍽 NY Lunch';
  if (t >= 19.5 && t < (22 + 14 / 60))   return '🗽 NY PM';
  return 'Hors KZ';
}
function signalPnl(sig) {
  const e  = parseFloat(sig.entry) || 0;
  const sl = parseFloat(sig.sl)    || 0;
  const tp = parseFloat(sig.tp2) || parseFloat(sig.tp1) || parseFloat(sig.tp) || 0;
  if (sig._outcome === 'win'  && tp && e) return  Math.abs(tp - e) * MNQ_PTS_TO_USD;
  if (sig._outcome === 'loss' && sl && e) return -Math.abs(e - sl) * MNQ_PTS_TO_USD;
  return 0;
}
function signalPts(sig) { return signalPnl(sig) / MNQ_PTS_TO_USD; }
function fmtTf(tf) {
  if (!tf || String(tf).includes('{')) return null;
  const n = parseInt(tf);
  if (isNaN(n)) return String(tf).toUpperCase(); // D, W…
  if (n >= 60 && n % 60 === 0) return `${n / 60}H`;
  return `${n}M`;
}
function getHourFr(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).formatToParts(d);
  return parts.find(p => p.type === 'hour')?.value ?? null;
}
function getDayFr(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short' }).format(d);
}

// ── GlobalView-style sub-components ──────────────────────────
function BSStatCard({ label, value, sub, color = '#c8d8c8' }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.08)', borderTop: `2px solid ${color}`, borderRadius: '6px', padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#4a7a5a', marginTop: '5px' }}>{sub}</div>}
    </div>
  );
}
function BSSection({ title, children }) {
  return (
    <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '2px', fontWeight: '700' }}>{title}</div>
      {children}
    </div>
  );
}
function BSInsight({ icon, title, value, desc, color, onClick, active }) {
  const rgb = color === '#00ff88' ? '0,255,136' : color === '#ff4455' ? '255,68,85' : color === '#00aaff' ? '0,170,255' : color === '#f0c020' ? '240,192,32' : '170,136,255';
  return (
    <div onClick={onClick} style={{ background: active ? `rgba(${rgb},0.14)` : `rgba(${rgb},0.06)`, border: `1px solid ${active ? color + '70' : color + '25'}`, borderRadius: '8px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s', position: 'relative' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = `rgba(${rgb},0.12)`; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = active ? `rgba(${rgb},0.14)` : `rgba(${rgb},0.06)`; }}
    >
      <div style={{ fontSize: '26px', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '3px' }}>{title}</div>
        <div style={{ fontSize: '15px', fontWeight: '700', color, marginBottom: '2px' }}>{value}</div>
        <div style={{ fontSize: '11px', color: '#4a7a5a' }}>{desc}</div>
      </div>
      {onClick && <div style={{ fontSize: '10px', color: active ? color : '#2a4a30', letterSpacing: '1px' }}>{active ? '▲' : '▼'}</div>}
    </div>
  );
}
function BSTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(6,18,12,0.97)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', fontFamily: 'inherit' }}>
      <div style={{ color: '#3a6a4a', marginBottom: '4px' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: (p.value ?? 0) >= 0 ? '#00ff88' : '#ff4455', fontWeight: '700' }}>
          {fmtUsd(p.value, true)} · {p.payload?.wr ?? '—'}% WR
        </div>
      ))}
    </div>
  );
}

// ── BotStats main component ───────────────────────────────────
function BotStats({ signals }) {
  const [filter, setFilter]       = useState('ALL');
  const [botFilter, setBotFilter] = useState('TOUS');
  const [drill, setDrill]         = useState(null); // { type, value, label, color }

  const rated  = signals.filter(s => s._outcome === 'win' || s._outcome === 'loss' || s._outcome === 'be');
  const wins   = rated.filter(s => s._outcome === 'win');
  const losses = rated.filter(s => s._outcome === 'loss');
  const bes    = rated.filter(s => s._outcome === 'be');
  const wl     = wins.length + losses.length;

  const winrate  = wl > 0 ? Math.round(wins.length / wl * 100) : null;
  const totalPnl = rated.reduce((s, sig) => s + signalPnl(sig), 0);
  const grossW   = wins.reduce((s, sig) => s + signalPnl(sig), 0);
  const grossL   = losses.reduce((s, sig) => s + Math.abs(signalPnl(sig)), 0);
  const pf       = grossL > 0 ? grossW / grossL : grossW > 0 ? 999 : 0;

  const rrVals = signals.filter(s => s.rr).map(s => parseFloat(String(s.rr).replace('1:', ''))).filter(v => !isNaN(v));
  const avgRR  = rrVals.length > 0 ? (rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(2) : null;

  // ── By bot ────────────────────────────────────────────────
  const botNames = [...new Set(signals.map(s => s.bot).filter(Boolean))];
  const byBot = botNames.map(b => {
    const bs   = rated.filter(s => s.bot === b);
    const bw   = bs.filter(s => s._outcome === 'win').length;
    const bpnl = bs.reduce((s, sig) => s + signalPnl(sig), 0);
    return { label: b, total: bs.length, wins: bw, pnl: Math.round(bpnl * 100) / 100, wr: bs.length > 0 ? Math.round(bw / bs.length * 100) : 0 };
  }).sort((a, b) => b.pnl - a.pnl);

  // ── By direction ──────────────────────────────────────────
  const byDir = ['LONG', 'SHORT'].map(dir => {
    const ds   = rated.filter(s => (s.signal ?? s.direction ?? '').toUpperCase() === dir);
    const dw   = ds.filter(s => s._outcome === 'win').length;
    const dpnl = ds.reduce((s, sig) => s + signalPnl(sig), 0);
    return { label: dir, total: ds.length, wins: dw, pnl: Math.round(dpnl * 100) / 100, wr: ds.length > 0 ? Math.round(dw / ds.length * 100) : 0 };
  });

  // ── By Kill Zone ──────────────────────────────────────────
  const KZ_LABELS = ['🌏 Asia', '🇬🇧 London', '🗽 NY AM', '🍽 NY Lunch', '🗽 NY PM', 'Hors KZ'];
  const byKZ = KZ_LABELS.map(kz => {
    const ks   = rated.filter(s => getKZLabel(s._receivedAt) === kz);
    const kw   = ks.filter(s => s._outcome === 'win').length;
    const kpnl = ks.reduce((s, sig) => s + signalPnl(sig), 0);
    return { label: kz, total: ks.length, wins: kw, pnl: Math.round(kpnl * 100) / 100, wr: ks.length > 0 ? Math.round(kw / ks.length * 100) : 0 };
  }).filter(k => k.total > 0);

  // ── By Hour ───────────────────────────────────────────────
  const allHours = [...new Set(rated.map(s => getHourFr(s._receivedAt)).filter(Boolean))].sort();
  const byHour = allHours.map(h => {
    const hs   = rated.filter(s => getHourFr(s._receivedAt) === h);
    const hw   = hs.filter(s => s._outcome === 'win').length;
    const hpnl = hs.reduce((s, sig) => s + signalPnl(sig), 0);
    return { label: `${h}h`, total: hs.length, wins: hw, pnl: Math.round(hpnl * 100) / 100, wr: hs.length > 0 ? Math.round(hw / hs.length * 100) : 0 };
  }).filter(h => h.total > 0);

  // ── By Day ────────────────────────────────────────────────
  const DAY_ORDER = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  const allDays   = [...new Set(rated.map(s => getDayFr(s._receivedAt)).filter(Boolean))];
  const byDay = allDays.map(day => {
    const ds   = rated.filter(s => getDayFr(s._receivedAt) === day);
    const dw   = ds.filter(s => s._outcome === 'win').length;
    const dpnl = ds.reduce((s, sig) => s + signalPnl(sig), 0);
    return { label: day, total: ds.length, wins: dw, pnl: Math.round(dpnl * 100) / 100, wr: ds.length > 0 ? Math.round(dw / ds.length * 100) : 0 };
  }).sort((a, b) => (DAY_ORDER.indexOf(a.label) ?? 9) - (DAY_ORDER.indexOf(b.label) ?? 9));

  // ── Insights ──────────────────────────────────────────────
  const bestBot   = [...byBot].sort((a, b) => b.pnl - a.pnl)[0];
  const worstBot  = [...byBot].filter(b => b.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
  const bestDir   = [...byDir].filter(d => d.total > 0).sort((a, b) => b.pnl - a.pnl)[0];
  const worstDir  = [...byDir].filter(d => d.total > 0).sort((a, b) => a.pnl - b.pnl)[0];
  const bestKZ    = [...byKZ].sort((a, b) => b.pnl - a.pnl)[0];
  const worstKZ   = [...byKZ].filter(k => k.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
  const bestHour  = [...byHour].sort((a, b) => b.pnl - a.pnl)[0];
  const worstHour = [...byHour].filter(h => h.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];
  const bestDay   = [...byDay].sort((a, b) => b.pnl - a.pnl)[0];
  const worstDay  = [...byDay].filter(d => d.pnl < 0).sort((a, b) => a.pnl - b.pnl)[0];

  // ── Drill helpers ─────────────────────────────────────────
  function getDrillSignals(d) {
    if (!d) return [];
    if (d.type === 'bot')  return rated.filter(s => s.bot === d.value);
    if (d.type === 'dir')  return rated.filter(s => (s.signal ?? s.direction ?? '').toUpperCase() === d.value);
    if (d.type === 'kz')   return rated.filter(s => getKZLabel(s._receivedAt) === d.value);
    if (d.type === 'hour') return rated.filter(s => getHourFr(s._receivedAt) === d.value);
    if (d.type === 'day')  return rated.filter(s => getDayFr(s._receivedAt) === d.value);
    return [];
  }
  function toggleDrill(type, value, label, color) {
    setDrill(prev => prev && prev.type === type && prev.value === value ? null : { type, value, label, color });
  }

  const drillSignals = getDrillSignals(drill);

  // ── Filtered signal list ──────────────────────────────────
  const botList = ['TOUS', ...new Set(rated.map(s => s.bot).filter(Boolean))];
  const listSignals = rated
    .filter(s => filter === 'ALL' || s._outcome === filter.toLowerCase())
    .filter(s => botFilter === 'TOUS' || s.bot === botFilter)
    .sort((a, b) => (b._receivedAt ?? '').localeCompare(a._receivedAt ?? ''));

  if (rated.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(0,255,136,0.1)', borderRadius: '8px' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📊</div>
      <div style={{ fontSize: '13px', color: '#3a6a4a', marginBottom: '6px' }}>Aucun signal noté</div>
      <div style={{ fontSize: '11px', color: '#2a4a30' }}>Utilise les boutons W / L / BE dans l'onglet SIGNAUX pour noter chaque position</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
        <BSStatCard label="P&L NET (10 MNQ)"  value={fmtUsd(totalPnl, true)}         color={pnlColor(totalPnl)}           sub={`Pts: ${(totalPnl / MNQ_PTS_TO_USD >= 0 ? '+' : '') + (totalPnl / MNQ_PTS_TO_USD).toFixed(2)}`} />
        <BSStatCard label="WINRATE"            value={winrate != null ? `${winrate}%` : '—'} color={winrate != null && winrate >= 50 ? '#00ff88' : '#ff4455'} sub={`${wins.length}W · ${losses.length}L · ${bes.length}BE`} />
        <BSStatCard label="PROFIT FACTOR"      value={pf === 999 ? '∞' : pf.toFixed(2)} color={pf >= 1.5 ? '#00ff88' : '#f0c020'} sub={`Gains $${grossW.toFixed(0)} / Pertes $${grossL.toFixed(0)}`} />
        <BSStatCard label="R:R MOYEN"          value={avgRR ? `1:${avgRR}` : '—'}      color="#f0c020"                       sub={`${rrVals.length} signaux`} />
        <BSStatCard label="SIGNAUX NOTÉS"      value={rated.length}                    color="#c8d8c8"                       sub={`sur ${signals.length} reçus`} />
      </div>

      {/* ── Points forts ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ height: '1px', flex: 1, background: 'rgba(0,255,136,0.1)' }} />
        <span style={{ fontSize: '11px', color: '#00ff88', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>✅ POINTS FORTS — cliquer pour voir les positions</span>
        <div style={{ height: '1px', flex: 1, background: 'rgba(0,255,136,0.1)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {bestBot  && <BSInsight icon="🤖" title="MEILLEUR BOT"         value={bestBot.label}  desc={`${fmtUsd(bestBot.pnl, true)} · ${bestBot.wr}% WR · ${bestBot.total}T`}  color="#00ff88" onClick={() => toggleDrill('bot', bestBot.label, bestBot.label, '#00ff88')} active={drill?.type === 'bot' && drill?.value === bestBot.label} />}
        {bestDir  && <BSInsight icon="📊" title="MEILLEURE DIRECTION"  value={bestDir.label}  desc={`${fmtUsd(bestDir.pnl, true)} · ${bestDir.wr}% WR · ${bestDir.total}T`}  color="#00aaff" onClick={() => toggleDrill('dir', bestDir.label, bestDir.label, '#00aaff')} active={drill?.type === 'dir' && drill?.value === bestDir.label} />}
        {bestKZ   && <BSInsight icon="⏰" title="MEILLEURE SESSION KZ" value={bestKZ.label}   desc={`${fmtUsd(bestKZ.pnl, true)} · ${bestKZ.wr}% WR · ${bestKZ.total}T`}    color="#f0c020" onClick={() => toggleDrill('kz', bestKZ.label, bestKZ.label, '#f0c020')} active={drill?.type === 'kz' && drill?.value === bestKZ.label} />}
        {bestHour && <BSInsight icon="🕐" title="MEILLEUR HORAIRE"     value={bestHour.label} desc={`${fmtUsd(bestHour.pnl, true)} · ${bestHour.wr}% WR · ${bestHour.total}T`} color="#00ff88" onClick={() => toggleDrill('hour', bestHour.label.replace('h',''), bestHour.label, '#00ff88')} active={drill?.type === 'hour' && drill?.label === bestHour.label} />}
        {bestDay  && <BSInsight icon="📅" title="MEILLEUR JOUR"        value={bestDay.label}  desc={`${fmtUsd(bestDay.pnl, true)} · ${bestDay.wr}% WR · ${bestDay.total}T`}  color="#00ff88" onClick={() => toggleDrill('day', bestDay.label, bestDay.label, '#00ff88')} active={drill?.type === 'day' && drill?.value === bestDay.label} />}
      </div>

      {/* ── Points faibles ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ height: '1px', flex: 1, background: 'rgba(255,68,85,0.1)' }} />
        <span style={{ fontSize: '11px', color: '#ff4455', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>❌ POINTS FAIBLES — cliquer pour voir les positions</span>
        <div style={{ height: '1px', flex: 1, background: 'rgba(255,68,85,0.1)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {worstBot  && <BSInsight icon="🤖" title="PIRE BOT"            value={worstBot.label}  desc={`${fmtUsd(worstBot.pnl, true)} · ${worstBot.wr}% WR · ${worstBot.total}T`}  color="#ff4455" onClick={() => toggleDrill('bot', worstBot.label, worstBot.label, '#ff4455')} active={drill?.type === 'bot' && drill?.value === worstBot.label} />}
        {worstDir  && <BSInsight icon="📊" title="PIRE DIRECTION"      value={worstDir.label}  desc={`${fmtUsd(worstDir.pnl, true)} · ${worstDir.wr}% WR · ${worstDir.total}T`}  color="#ff4455" onClick={() => toggleDrill('dir', worstDir.label, worstDir.label, '#ff4455')} active={drill?.type === 'dir' && drill?.value === worstDir.label} />}
        {worstKZ   && <BSInsight icon="⏰" title="PIRE SESSION KZ"     value={worstKZ.label}   desc={`${fmtUsd(worstKZ.pnl, true)} · ${worstKZ.wr}% WR · ${worstKZ.total}T`}   color="#ff4455" onClick={() => toggleDrill('kz', worstKZ.label, worstKZ.label, '#ff4455')} active={drill?.type === 'kz' && drill?.value === worstKZ.label} />}
        {worstHour && <BSInsight icon="🕐" title="PIRE HORAIRE"        value={worstHour.label} desc={`${fmtUsd(worstHour.pnl, true)} · ${worstHour.wr}% WR · ${worstHour.total}T`} color="#ff4455" onClick={() => toggleDrill('hour', worstHour.label.replace('h',''), worstHour.label, '#ff4455')} active={drill?.type === 'hour' && drill?.label === worstHour.label} />}
        {worstDay  && <BSInsight icon="📅" title="PIRE JOUR"           value={worstDay.label}  desc={`${fmtUsd(worstDay.pnl, true)} · ${worstDay.wr}% WR · ${worstDay.total}T`}  color="#ff4455" onClick={() => toggleDrill('day', worstDay.label, worstDay.label, '#ff4455')} active={drill?.type === 'day' && drill?.value === worstDay.label} />}
      </div>

      {/* ── Drill-down panel ── */}
      {drill && drillSignals.length > 0 && (
        <div style={{ background: 'rgba(6,18,12,0.6)', border: `1px solid ${drill.color}30`, borderRadius: '8px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: drill.color, letterSpacing: '2px', fontWeight: '700' }}>{drill.label}</span>
            <span style={{ fontSize: '10px', background: `${drill.color}15`, border: `1px solid ${drill.color}30`, color: drill.color, padding: '1px 8px', borderRadius: '10px' }}>{drillSignals.length} trades</span>
            <span style={{ fontSize: '10px', color: '#00ff88', fontWeight: '700' }}>✓ {drillSignals.filter(s => s._outcome === 'win').length}W</span>
            <span style={{ fontSize: '10px', color: '#ff4455', fontWeight: '700' }}>✗ {drillSignals.filter(s => s._outcome === 'loss').length}L</span>
            {drillSignals.filter(s => s._outcome === 'be').length > 0 && <span style={{ fontSize: '10px', color: '#f0c020', fontWeight: '700' }}>— {drillSignals.filter(s => s._outcome === 'be').length}BE</span>}
            <button onClick={() => setDrill(null)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,68,85,0.2)', borderRadius: '3px', color: '#5a3a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', padding: '2px 8px' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.borderColor = 'rgba(255,68,85,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5a3a3a'; e.currentTarget.style.borderColor = 'rgba(255,68,85,0.2)'; }}
            >✕ FERMER</button>
          </div>
          {['win', 'loss', 'be'].map(oc => {
            const ocSigs = drillSignals.filter(s => s._outcome === oc);
            if (ocSigs.length === 0) return null;
            const ocColor = oc === 'win' ? '#00ff88' : oc === 'loss' ? '#ff4455' : '#f0c020';
            const ocLabel = oc === 'win' ? '✅ WIN' : oc === 'loss' ? '❌ LOSS' : '🔄 BE';
            return (
              <div key={oc} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', color: ocColor, letterSpacing: '2px', fontWeight: '700', marginBottom: '6px' }}>{ocLabel} ({ocSigs.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {ocSigs.map((sig, i) => {
                    const dir = (sig.signal ?? sig.direction ?? '').toUpperCase();
                    const isL = dir === 'LONG';
                    const pnl = signalPnl(sig);
                    const tf  = fmtTf(sig.timeframe);
                    return (
                      <div key={sig._id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 10px', background: 'rgba(10,28,18,0.5)', borderRadius: '4px', borderLeft: `2px solid ${ocColor}60` }}>
                        <span style={{ fontSize: '10px', color: '#4a7a5a', minWidth: '70px' }}>{fmtTime(sig._receivedAt)}</span>
                        {tf && <span style={{ fontSize: '9px', color: '#3a7a5a', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.1)', padding: '0px 4px', borderRadius: '2px', fontWeight: '700' }}>{tf}</span>}
                        <span style={{ fontSize: '10px', color: isL ? '#00ff88' : '#ff4455', fontWeight: '700' }}>{isL ? '▲' : '▼'} {dir}</span>
                        {sig.bot && <span style={{ fontSize: '9px', color: '#7a5a9a' }}>{sig.bot}</span>}
                        <span style={{ fontSize: '10px', color: '#6a8a7a' }}>{parseFloat(sig.entry)?.toFixed(2) ?? '—'}</span>
                        <span style={{ fontSize: '10px', color: pnlColor(pnl), fontWeight: '700', marginLeft: 'auto' }}>{fmtUsd(pnl, true)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Graphiques ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* By bot */}
        {byBot.length > 0 && (
          <BSSection title="🤖 P&L NET PAR BOT (10 MNQ)">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byBot} barSize={32} barCategoryGap="35%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={60} />
                <Tooltip content={<BSTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {byBot.map((d, i) => <Cell key={i} fill={pnlColor(d.pnl)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {byBot.map(b => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'rgba(10,28,18,0.4)', borderRadius: '4px', borderLeft: `2px solid ${pnlColor(b.pnl)}` }}>
                  <span style={{ fontSize: '12px', color: '#c8d8c8', flex: 1 }}>{b.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: pnlColor(b.pnl) }}>{fmtUsd(b.pnl, true)}</span>
                  <span style={{ fontSize: '11px', color: b.wr >= 50 ? '#00ff88' : '#ff4455' }}>{b.wr}% WR</span>
                  <span style={{ fontSize: '11px', color: '#3a6a4a' }}>{b.total}T</span>
                </div>
              ))}
            </div>
          </BSSection>
        )}

        {/* By direction */}
        <BSSection title="📊 P&L NET PAR DIRECTION (10 MNQ)">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={byDir.filter(d => d.total > 0)} barSize={48} barCategoryGap="40%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
              <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={60} />
              <Tooltip content={<BSTooltip />} />
              <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={60}>
                {byDir.filter(d => d.total > 0).map((d, i) => <Cell key={i} fill={d.label === 'LONG' ? '#00ff88' : '#ff4455'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {byDir.filter(d => d.total > 0).map(d => (
              <div key={d.label} style={{ background: 'rgba(10,28,18,0.4)', borderRadius: '6px', padding: '10px 14px', borderLeft: `3px solid ${d.label === 'LONG' ? '#00ff88' : '#ff4455'}` }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: d.label === 'LONG' ? '#00ff88' : '#ff4455', marginBottom: '4px' }}>{d.label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: pnlColor(d.pnl) }}>{fmtUsd(d.pnl, true)}</div>
                <div style={{ fontSize: '11px', color: '#4a7a5a', marginTop: '3px' }}>{d.wr}% WR · {d.wins}W {d.total - d.wins}L</div>
              </div>
            ))}
          </div>
        </BSSection>
      </div>

      {/* ── Kill Zones ── */}
      {byKZ.length > 0 && (
        <BSSection title="⏰ P&L NET PAR SESSION KILL ZONE (10 MNQ)">
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={byKZ} barSize={28} barCategoryGap="30%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
              <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={60} />
              <Tooltip content={<BSTooltip />} />
              <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {byKZ.map((k, i) => <Cell key={i} fill={pnlColor(k.pnl)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {byKZ.map(k => (
              <div key={k.label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '5px', padding: '6px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#4a7a5a', marginBottom: '2px' }}>{k.label}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: pnlColor(k.pnl) }}>{fmtUsd(k.pnl, true)}</div>
                <div style={{ fontSize: '10px', color: k.wr >= 50 ? '#00ff88' : '#ff4455' }}>{k.wr}% WR · {k.total}T</div>
              </div>
            ))}
          </div>
        </BSSection>
      )}

      {/* ── Horaire & Jour ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {byHour.length > 0 && (
          <BSSection title="🕐 P&L NET PAR HEURE (Paris)">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byHour} barSize={18} barCategoryGap="20%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={55} />
                <Tooltip content={<BSTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                  {byHour.map((h, i) => <Cell key={i} fill={pnlColor(h.pnl)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </BSSection>
        )}
        {byDay.length > 0 && (
          <BSSection title="📅 P&L NET PAR JOUR">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byDay} barSize={32} barCategoryGap="30%" margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                <CartesianGrid stroke="rgba(0,255,136,0.04)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a6a4a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}$`} width={55} />
                <Tooltip content={<BSTooltip />} />
                <ReferenceLine y={0} stroke="rgba(0,255,136,0.15)" />
                <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={40}>
                  {byDay.map((d, i) => <Cell key={i} fill={pnlColor(d.pnl)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {byDay.map(d => (
                <div key={d.label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '5px', padding: '5px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#4a7a5a', textTransform: 'capitalize' }}>{d.label}</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: pnlColor(d.pnl) }}>{fmtUsd(d.pnl, true)}</div>
                  <div style={{ fontSize: '9px', color: d.wr >= 50 ? '#00ff88' : '#ff4455' }}>{d.wr}% · {d.total}T</div>
                </div>
              ))}
            </div>
          </BSSection>
        )}
      </div>

      {/* ── Tableau des signaux notés ── */}
      <BSSection title={`📋 TOUS LES SIGNAUX NOTÉS (${rated.length})`}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['ALL', 'WIN', 'LOSS', 'BE'].map(f => {
            const c = f === 'WIN' ? '#00ff88' : f === 'LOSS' ? '#ff4455' : f === 'BE' ? '#f0c020' : '#c8d8c8';
            const count = f === 'ALL' ? rated.length : f === 'WIN' ? wins.length : f === 'LOSS' ? losses.length : bes.length;
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${filter === f ? c : '#1a3a22'}`, background: filter === f ? `${c}18` : 'transparent', color: filter === f ? c : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
                {f} ({count})
              </button>
            );
          })}
          {botList.length > 2 && botList.map(b => (
            <button key={b} onClick={() => setBotFilter(b)}
              style={{ padding: '4px 10px', borderRadius: '4px', border: `1px solid ${botFilter === b ? '#aa88ff' : 'rgba(0,255,136,0.08)'}`, background: botFilter === b ? 'rgba(170,136,255,0.12)' : 'transparent', color: botFilter === b ? '#aa88ff' : '#3a5a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>
              {b}
            </button>
          ))}
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: 'rgba(6,12,8,0.95)', borderBottom: '1px solid rgba(0,255,136,0.08)' }}>
                {['HEURE', 'TF', 'BOT', 'DIR', 'ENTRY', 'SL', 'TP', 'R:R', 'PTS', 'P&L (10 MNQ)', 'SESSION KZ', 'RÉSULTAT'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listSignals.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: '#2a4a30', fontSize: '12px' }}>Aucun signal</td></tr>
              )}
              {listSignals.map((sig, i) => {
                const dir    = (sig.signal ?? sig.direction ?? '').toUpperCase();
                const isL    = dir === 'LONG';
                const pnl    = signalPnl(sig);
                const pts    = signalPts(sig);
                const oc     = sig._outcome;
                const ocC    = oc === 'win' ? '#00ff88' : oc === 'loss' ? '#ff4455' : '#f0c020';
                const ocTxt  = oc === 'win' ? '✅ WIN' : oc === 'loss' ? '❌ LOSS' : '🔄 BE';
                const kzLabel = getKZLabel(sig._receivedAt);
                const tp      = parseFloat(sig.tp2) || parseFloat(sig.tp1) || parseFloat(sig.tp) || null;
                return (
                  <tr key={sig._id ?? i}
                    style={{ borderBottom: '1px solid rgba(0,255,136,0.04)', borderLeft: `2px solid ${pnlColor(pnl)}` }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '7px 10px', color: '#4a7a5a', fontSize: '11px', whiteSpace: 'nowrap' }}>{fmtTime(sig._receivedAt)}</td>
                    <td style={{ padding: '7px 6px' }}>
                      {fmtTf(sig.timeframe) ? <span style={{ fontSize: '9px', color: '#3a9a5a', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: '700' }}>{fmtTf(sig.timeframe)}</span> : <span style={{ color: '#2a4a30' }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 10px', fontSize: '10px', color: '#aa88ff' }}>{sig.bot ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ color: isL ? '#00ff88' : '#ff4455', background: `rgba(${isL ? '0,255,136' : '255,68,85'},0.08)`, padding: '1px 5px', borderRadius: '3px', fontSize: '11px', fontWeight: '600' }}>{dir}</span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#8aaa90' }}>{parseFloat(sig.entry)?.toFixed(2) ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#ff7788' }}>{parseFloat(sig.sl)?.toFixed(2) ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#00ff88' }}>{tp?.toFixed(2) ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#f0c020' }}>{sig.rr ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: pnlColor(pts), fontWeight: '600' }}>{pts ? `${pts >= 0 ? '+' : ''}${pts.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '7px 10px', color: pnlColor(pnl), fontWeight: '700' }}>{fmtUsd(pnl, true)}</td>
                    <td style={{ padding: '7px 10px', fontSize: '10px', color: '#3a6a4a', whiteSpace: 'nowrap' }}>{kzLabel}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: ocC, background: `${ocC}15`, border: `1px solid ${ocC}40`, padding: '2px 7px', borderRadius: '3px' }}>{ocTxt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </BSSection>
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
  const [stats, setStats]       = useState(null);
  const [port, setPort]         = useState(3001);
  const [portInput, setPortInput] = useState('3001');
  const [tab, setTab]           = useState('signals');
  const [selectedBot, setSelectedBot] = useState('TOUS');
  const [selectedPine, setSelectedPine] = useState('standard');
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
      const stRes   = await window.bot.getStats();
      if (stRes.ok) setStats(stRes.data);
    })();

    const onSignal = (sig) => {
      setSignals(prev => [sig, ...prev].slice(0, 2000));
      setStats(prev => prev ? {
        ...prev,
        total:  prev.total + 1,
        longs:  (sig.signal ?? '').toUpperCase() === 'LONG'  ? prev.longs + 1 : prev.longs,
        shorts: (sig.signal ?? '').toUpperCase() === 'SHORT' ? prev.shorts + 1 : prev.shorts,
        newest: sig._receivedAt,
        bots:   [...new Set([...(prev.bots ?? []), sig.bot].filter(Boolean))],
      } : null);
      setTab('signals');
      if (flashRef.current) {
        flashRef.current.style.boxShadow = '0 0 40px rgba(0,255,136,0.4)';
        setTimeout(() => { if (flashRef.current) flashRef.current.style.boxShadow = 'none'; }, 800);
      }
    };
    const onReady = (p) => { setPort(p); setPortInput(String(p)); setServerOk(true); };
    const onError = () => setServerOk(false);

    const onOutcome = ({ id, outcome, auto }) => {
      setSignals(prev => prev.map(s =>
        String(s._id) === String(id)
          ? { ...s, _outcome: outcome, _autoOutcome: auto }
          : s
      ));
    };

    window.bot.onSignal(onSignal);
    window.bot.onServerReady(onReady);
    window.bot.onServerError(onError);
    window.bot.onOutcomeUpdate(onOutcome);
    return () => {
      window.bot.offSignal(onSignal);
      window.bot.offOutcomeUpdate(onOutcome);
    };
  }, []);

  async function handleUpdateOutcome(id, current, outcome) {
    const next = current === outcome ? null : outcome;
    await window.bot.updateOutcome(id, next);
    setSignals(prev => prev.map(s => String(s._id) === String(id)
      ? { ...s, _outcome: next === null ? undefined : next }
      : s
    ));
  }

  async function handleClearSignals() {
    if (!window.confirm(`Effacer l'historique complet ? (${signals.length} signaux supprimés définitivement)`)) return;
    await window.bot.clearSignals();
    setSignals([]);
    setStats(s => s ? { ...s, total: 0, longs: 0, shorts: 0, oldest: null, newest: null } : null);
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
    const tp    = parseFloat(signal.tp) || parseFloat(signal.tp2) || parseFloat(signal.tp1) || 0;
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

  const webhookUrl       = `http://localhost:${port}/webhook`;
  const botIds           = ['TOUS', ...Array.from(new Set(signals.map(s => s.bot).filter(Boolean)))];
  const filtered         = selectedBot === 'TOUS' ? signals : signals.filter(s => s.bot === selectedBot);
  const latest           = filtered[0] ?? null;
  const activePine       = PINE_BOTS.find(b => b.id === selectedPine) ?? PINE_BOTS[0];
  const activeSignals    = filtered.filter(s => !s._outcome);
  const completedSignals = filtered.filter(s => s._outcome === 'win' || s._outcome === 'loss' || s._outcome === 'be');

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
          { key: 'stats',   label: 'STATS' },
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

      {/* ── Bandeau historique persistant ── */}
      {stats && stats.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px', background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
            <span style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px' }}>HISTORIQUE SAUVEGARDÉ</span>
          </div>
          <div style={{ display: 'flex', gap: '14px', flex: 1, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#c8d8c8', fontWeight: '700' }}>{stats.total} signal{stats.total > 1 ? 's' : ''}</span>
            <span style={{ fontSize: '12px', color: '#00ff88' }}>▲ {stats.longs} LONG</span>
            <span style={{ fontSize: '12px', color: '#ff4455' }}>▼ {stats.shorts} SHORT</span>
            {stats.oldest && (
              <span style={{ fontSize: '11px', color: '#3a6a4a' }}>
                depuis {fmtTime(stats.oldest)}
              </span>
            )}
            {stats.bots?.length > 0 && (
              <span style={{ fontSize: '11px', color: '#3a6a4a' }}>
                {stats.bots.join(' · ')}
              </span>
            )}
          </div>
          <div style={{ fontSize: '9px', color: '#2a4a30', fontStyle: 'italic' }}>persisté au redémarrage</div>
        </div>
      )}

      {/* ── Tab: SIGNAUX ── */}
      {tab === 'signals' && (
        <div>
          {/* Bot selector */}
          {botIds.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {botIds.map(bid => {
                const bot  = PINE_BOTS.find(b => b.botId === bid);
                const c    = bid === 'TOUS' ? '#c8d8c8' : (bot?.color ?? '#aa88ff');
                const cnt  = bid === 'TOUS' ? signals.length : signals.filter(s => s.bot === bid).length;
                const sel  = selectedBot === bid;
                return (
                  <button key={bid} onClick={() => setSelectedBot(bid)}
                    style={{ padding: '5px 14px', borderRadius: '4px', border: `1px solid ${sel ? c + '80' : 'rgba(0,255,136,0.1)'}`, background: sel ? `${c}15` : 'transparent', color: sel ? c : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', fontWeight: sel ? '700' : '400', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '1px' }}>
                    {bid} <span style={{ opacity: 0.6 }}>({cnt})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Stats panel — signaux terminés uniquement */}
          {completedSignals.length > 0 && (() => {
            const st = computeTradeStats(completedSignals);
            const ptsColor = st.totalPts >= 0 ? '#00ff88' : '#ff4455';
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                {[
                  { label: 'WINRATE', value: st.winrate != null ? `${st.winrate}%` : '—', sub: `${st.wins}W · ${st.losses}L${st.bes > 0 ? ` · ${st.bes}BE` : ''}`, color: st.winrate != null && st.winrate >= 50 ? '#00ff88' : '#ff4455' },
                  { label: 'R:R MOYEN', value: st.avgRR ? `1:${st.avgRR}` : '—', sub: `${st.total} terminé${st.total > 1 ? 's' : ''}`, color: '#f0c020' },
                  { label: 'POINTS NET', value: `${st.totalPts >= 0 ? '+' : ''}${st.totalPts} pts`, sub: '10 MNQ', color: ptsColor },
                  { label: 'P&L NET', value: `${st.totalUsd >= 0 ? '+' : ''}$${st.totalUsd}`, sub: '10 × $2/pt', color: ptsColor },
                ].map(card => (
                  <div key={card.label} style={{ background: 'rgba(10,28,18,0.5)', border: `1px solid ${card.color}20`, borderRadius: '6px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '4px' }}>{card.label}</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: '10px', color: '#3a5a3a', marginTop: '2px' }}>{card.sub}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {saveMsg && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', background: saveMsg.startsWith('Erreur') ? 'rgba(255,68,85,0.1)' : 'rgba(0,255,136,0.1)', border: `1px solid ${saveMsg.startsWith('Erreur') ? 'rgba(255,68,85,0.3)' : 'rgba(0,255,136,0.3)'}`, borderRadius: '5px', fontSize: '12px', color: saveMsg.startsWith('Erreur') ? '#ff4455' : '#00ff88' }}>
              {saveMsg}
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(0,255,136,0.1)', borderRadius: '8px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📡</div>
              <div style={{ fontSize: '13px', color: '#3a6a4a', marginBottom: '6px' }}>{signals.length > 0 ? `Aucun signal pour ${selectedBot}` : 'En attente de signaux...'}</div>
              <div style={{ fontSize: '11px', color: '#2a4a30' }}>Configure ngrok + TradingView pour recevoir les alertes</div>
              <button onClick={() => setTab('setup')} style={{ marginTop: '14px', padding: '7px 16px', background: 'transparent', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '4px', color: '#00aa55', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px' }}>
                VOIR LA CONFIGURATION →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Latest signal — large */}
              <div>
                <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>DERNIER SIGNAL</div>
                <SignalCard signal={latest} onSave={saving ? null : handleSaveSignal} isLatest={true} />
              </div>

              {/* ── EN COURS ── */}
              {activeSignals.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f0c020', boxShadow: '0 0 6px #f0c020', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: '#f0c020', letterSpacing: '2px', fontWeight: '700' }}>EN COURS</span>
                    <span style={{ fontSize: '10px', background: 'rgba(240,192,32,0.12)', border: '1px solid rgba(240,192,32,0.3)', color: '#f0c020', padding: '1px 8px', borderRadius: '10px', fontWeight: '700' }}>{activeSignals.length}</span>
                    <span style={{ fontSize: '10px', color: '#3a5a3a' }}>— en attente de résultat</span>
                  </div>
                  <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(240,192,32,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(240,192,32,0.03)', borderBottom: '1px solid rgba(240,192,32,0.07)' }}>
                          {['HEURE', 'TF', 'DIR', 'ENTRY', 'SL', 'TP', 'R:R', 'CONTEXTE', 'RÉSULTAT', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '9px', color: '#5a6a3a', letterSpacing: '1.5px', fontWeight: '700' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSignals.map((sig, i) => {
                          const dir   = (sig.signal ?? sig.direction ?? '').toUpperCase();
                          const isL   = dir === 'LONG';
                          const color = isL ? '#00ff88' : '#ff4455';
                          const time  = fmtTime(sig._receivedAt);
                          const tp    = parseFloat(sig.tp) || parseFloat(sig.tp2) || parseFloat(sig.tp1) || null;
                          const tf    = fmtTf(sig.timeframe);
                          return (
                            <tr key={sig._id ?? i} style={{ borderBottom: '1px solid rgba(240,192,32,0.04)', transition: 'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,192,32,0.02)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '8px 10px', color: '#5a8a6a' }}>{time}</td>
                              <td style={{ padding: '8px 6px' }}>
                                {tf
                                  ? <span style={{ fontSize: '10px', color: '#b09020', background: 'rgba(240,192,32,0.08)', border: '1px solid rgba(240,192,32,0.2)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>{tf}</span>
                                  : <span style={{ fontSize: '10px', color: '#3a4a2a' }}>—</span>
                                }
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color }}>{isL ? '▲' : '▼'} {dir}</td>
                              <td style={{ padding: '8px 10px', color: '#c8d8c8' }}>{parseFloat(sig.entry)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#ff7788' }}>{parseFloat(sig.sl)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#00ff88' }}>{tp?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color }}>{sig.rr || '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#4a7a5a', fontSize: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sig.context || '—'}</td>
                              <td style={{ padding: '6px 8px' }}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  {sig.type === 'test' && <span style={{ fontSize: '8px', background: 'rgba(240,120,32,0.15)', border: '1px solid rgba(240,120,32,0.4)', color: '#f07820', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', letterSpacing: '1px', marginRight: '2px' }}>TEST</span>}
                                  {[['win','W','#00ff88'],['loss','L','#ff4455'],['be','BE','#f0c020']].map(([key, label, c]) => {
                                    const sel = sig._outcome === key;
                                    return (
                                      <button key={key} onClick={() => handleUpdateOutcome(sig._id, sig._outcome, key)}
                                        style={{ padding: '2px 6px', borderRadius: '3px', border: `1px solid ${sel ? c + '80' : 'rgba(0,255,136,0.1)'}`, background: sel ? `${c}20` : 'transparent', color: sel ? c : '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', fontWeight: sel ? '700' : '400', cursor: 'pointer', transition: 'all 0.12s' }}
                                        onMouseEnter={e => { if (!sel) { e.currentTarget.style.color = c; e.currentTarget.style.borderColor = `${c}50`; }}}
                                        onMouseLeave={e => { if (!sel) { e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.1)'; }}}
                                      >{label}</button>
                                    );
                                  })}
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
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

              {/* ── TERMINÉS ── */}
              {completedSignals.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', fontWeight: '700' }}>TERMINÉS</span>
                    <span style={{ fontSize: '10px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)', color: '#3a9a5a', padding: '1px 8px', borderRadius: '10px', fontWeight: '700' }}>{completedSignals.length}</span>
                    {completedSignals.filter(s => s._outcome === 'win').length > 0 && (
                      <span style={{ fontSize: '10px', color: '#00ff88', fontWeight: '700' }}>✓ {completedSignals.filter(s => s._outcome === 'win').length}W</span>
                    )}
                    {completedSignals.filter(s => s._outcome === 'loss').length > 0 && (
                      <span style={{ fontSize: '10px', color: '#ff4455', fontWeight: '700' }}>✗ {completedSignals.filter(s => s._outcome === 'loss').length}L</span>
                    )}
                    {completedSignals.filter(s => s._outcome === 'be').length > 0 && (
                      <span style={{ fontSize: '10px', color: '#f0c020', fontWeight: '700' }}>— {completedSignals.filter(s => s._outcome === 'be').length}BE</span>
                    )}
                  </div>
                  <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,255,136,0.04)', borderBottom: '1px solid rgba(0,255,136,0.08)' }}>
                          {['HEURE', 'TF', 'DIR', 'ENTRY', 'SL', 'TP', 'R:R', 'CONTEXTE', 'RÉSULTAT', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', fontWeight: '700' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {completedSignals.map((sig, i) => {
                          const dir      = (sig.signal ?? sig.direction ?? '').toUpperCase();
                          const isL      = dir === 'LONG';
                          const color    = isL ? '#00ff88' : '#ff4455';
                          const time     = fmtTime(sig._receivedAt);
                          const outColor = sig._outcome === 'win' ? '#00ff88' : sig._outcome === 'loss' ? '#ff4455' : '#f0c020';
                          const tp       = parseFloat(sig.tp) || parseFloat(sig.tp2) || parseFloat(sig.tp1) || null;
                          const tf       = fmtTf(sig.timeframe);
                          return (
                            <tr key={sig._id ?? i} style={{ borderBottom: '1px solid rgba(0,255,136,0.04)', transition: 'background 0.1s', borderLeft: `2px solid ${outColor}25` }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.03)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ padding: '8px 10px', color: '#5a8a6a' }}>{time}</td>
                              <td style={{ padding: '8px 6px' }}>
                                {tf
                                  ? <span style={{ fontSize: '10px', color: '#3a9a5a', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.12)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>{tf}</span>
                                  : <span style={{ fontSize: '10px', color: '#2a4a30' }}>—</span>
                                }
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color }}>{isL ? '▲' : '▼'} {dir}</td>
                              <td style={{ padding: '8px 10px', color: '#c8d8c8' }}>{parseFloat(sig.entry)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#ff7788' }}>{parseFloat(sig.sl)?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#00ff88' }}>{tp?.toFixed(2) ?? '—'}</td>
                              <td style={{ padding: '8px 10px', color }}>{sig.rr || '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#4a7a5a', fontSize: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sig.context || '—'}</td>
                              <td style={{ padding: '6px 8px' }}>
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  {sig.type === 'test' && <span style={{ fontSize: '8px', background: 'rgba(240,120,32,0.15)', border: '1px solid rgba(240,120,32,0.4)', color: '#f07820', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', letterSpacing: '1px', marginRight: '2px' }}>TEST</span>}
                                  {sig._autoOutcome && sig._outcome && (
                                    <span style={{ fontSize: '8px', background: 'rgba(0,170,255,0.15)', border: '1px solid rgba(0,170,255,0.3)', color: '#00aaff', padding: '1px 4px', borderRadius: '2px', fontWeight: '700', letterSpacing: '1px', marginRight: '2px' }}>AUTO</span>
                                  )}
                                  {[['win','W','#00ff88'],['loss','L','#ff4455'],['be','BE','#f0c020']].map(([key, label, c]) => {
                                    const sel = sig._outcome === key;
                                    return (
                                      <button key={key} onClick={() => handleUpdateOutcome(sig._id, sig._outcome, key)}
                                        style={{ padding: '2px 6px', borderRadius: '3px', border: `1px solid ${sel ? c + '80' : 'rgba(0,255,136,0.1)'}`, background: sel ? `${c}20` : 'transparent', color: sel ? c : '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', fontWeight: sel ? '700' : '400', cursor: 'pointer', transition: 'all 0.12s' }}
                                        onMouseEnter={e => { if (!sel) { e.currentTarget.style.color = c; e.currentTarget.style.borderColor = `${c}50`; }}}
                                        onMouseLeave={e => { if (!sel) { e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.1)'; }}}
                                      >{label}</button>
                                    );
                                  })}
                                </div>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
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

      {/* ── Tab: STATS ── */}
      {tab === 'stats' && <BotStats signals={filtered} />}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Bot selector — grille adaptative */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: '8px' }}>
            {PINE_BOTS.map(bot => (
              <button key={bot.id} onClick={() => setSelectedPine(bot.id)}
                style={{ padding: '12px 14px', borderRadius: '7px', border: `1px solid ${selectedPine === bot.id ? bot.color + '60' : 'rgba(0,255,136,0.1)'}`, background: selectedPine === bot.id ? `${bot.color}12` : 'rgba(10,28,18,0.4)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: selectedPine === bot.id ? bot.color : '#c8d8c8' }}>{bot.name}</div>
                  <div style={{ fontSize: '9px', background: `${bot.color}18`, border: `1px solid ${bot.color}30`, color: bot.color, padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>{bot.tf}</div>
                </div>
                <div style={{ fontSize: '10px', color: '#3a6a4a' }}>SL ×{bot.sl} · TP ×{(bot.sl * 2).toFixed(1)} · R:R 1:2</div>
                <div style={{ fontSize: '10px', color: '#3a6a4a' }}>HTF {bot.htfTf === 'D' ? '1J' : bot.htfTf + 'min'} · score ≥ {bot.minScore}/5</div>
              </button>
            ))}
          </div>

          {/* Info + copy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: `${activePine.color}08`, border: `1px solid ${activePine.color}25`, borderRadius: '7px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#5a8a6a', lineHeight: '1.7' }}>
                Bot ID : <code style={{ color: activePine.color, background: `${activePine.color}15`, padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>{activePine.botId}</code>
                {' '}— TF <strong style={{ color: activePine.color }}>{activePine.tf}</strong> · HTF {activePine.htfTf === 'D' ? '1J' : activePine.htfTf + 'min'} · SL ×{activePine.sl} · TP ×{(activePine.sl * 2).toFixed(1)}
              </div>
              <div style={{ fontSize: '10px', color: '#3a5a3a', marginTop: '2px' }}>
                Déployer sur une chart MNQ1! <strong style={{ color: '#c8d8c8' }}>{activePine.tf}</strong> · créer une alerte → webhook vers l'URL ngrok
              </div>
            </div>
            <button onClick={() => copyText(generateScript(activePine), `pine_${activePine.id}`)}
              style={{ padding: '8px 16px', background: copied === `pine_${activePine.id}` ? `${activePine.color}25` : 'transparent', border: `1px solid ${activePine.color}50`, borderRadius: '5px', color: activePine.color, fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {copied === `pine_${activePine.id}` ? '✓ COPIÉ' : 'COPIER'}
            </button>
          </div>

          {/* Script preview */}
          <div style={{ background: 'rgba(4,12,8,0.9)', border: `1px solid ${activePine.color}18`, borderRadius: '6px', overflow: 'auto', maxHeight: '480px' }}>
            <pre style={{ margin: 0, padding: '16px 18px', fontSize: '11px', color: '#7aaa8a', fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: '1.65', whiteSpace: 'pre' }}>
              {generateScript(activePine).split('\n').map((line, i) => {
                let color = '#7aaa8a';
                if (line.startsWith('//')) color = '#3a6a4a';
                else if (line.startsWith('//@')) color = '#3a5a4a';
                else if (line.match(/^(if|and|or|not)\b/)) color = '#aa88ff';
                else if (line.match(/\b(alert|plot|plotshape|ta\.|math\.|str\.)\b/)) color = '#00aaff';
                else if (line.match(/["'][^"']*["']/)) color = activePine.color;
                return <span key={i} style={{ display: 'block', color }}>{line}</span>;
              })}
            </pre>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(0,170,255,0.04)', border: '1px solid rgba(0,170,255,0.12)', borderRadius: '6px', fontSize: '11px', color: '#3a5a6a', lineHeight: '1.8' }}>
            <div style={{ color: '#00aaff', fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' }}>DÉPLOIEMENT MULTI-BOT — 1 chart TradingView par bot</div>
            {PINE_BOTS.map(bot => (
              <div key={bot.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '9px', background: `${bot.color}18`, border: `1px solid ${bot.color}30`, color: bot.color, padding: '1px 5px', borderRadius: '2px', fontWeight: '700', minWidth: '36px', textAlign: 'center' }}>{bot.tf}</span>
                <span style={{ color: '#4a7a5a' }}>→ chart MNQ1! <strong style={{ color: '#8aaa90' }}>{bot.tf}</strong> · indicateur <code style={{ color: bot.color, fontSize: '10px' }}>{bot.botId}</code> · alerte webhook</span>
              </div>
            ))}
            <div style={{ marginTop: '6px', color: '#2a5a4a', fontSize: '10px' }}>Tous les bots pointent vers le même webhook URL ngrok — les signaux arrivent séparés par bot ID.</div>
          </div>

          {/* ── PINE EDIT — Indicateur Analyse ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
            <div style={{ height: '1px', flex: 1, background: 'rgba(240,120,32,0.2)' }} />
            <span style={{ fontSize: '10px', color: '#f07820', letterSpacing: '2px', fontWeight: '700', whiteSpace: 'nowrap' }}>🔬 INDICATEUR ANALYSE — ICT EDIT</span>
            <div style={{ height: '1px', flex: 1, background: 'rgba(240,120,32,0.2)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 16px', background: 'rgba(240,120,32,0.05)', border: '1px solid rgba(240,120,32,0.2)', borderRadius: '7px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#f07820', marginBottom: '5px' }}>ICT Setup — Liquidity + MSS + FVG</div>
              <div style={{ fontSize: '11px', color: '#5a5a3a', lineHeight: '1.7' }}>
                Indicateur d'analyse visuelle qui envoie des signaux <span style={{ background: 'rgba(240,120,32,0.15)', border: '1px solid rgba(240,120,32,0.4)', color: '#f07820', padding: '0px 5px', borderRadius: '2px', fontSize: '9px', fontWeight: '700' }}>TEST</span> dans le dashboard.
              </div>
              <div style={{ fontSize: '10px', color: '#4a4a2a', lineHeight: '1.8', marginTop: '4px' }}>
                <div>→ Liquidity sweep (EQH/EQL) · MSS · FVG · Order Block</div>
                <div>→ Bot ID : <code style={{ color: '#f07820', fontSize: '10px' }}>ICT_EDIT</code> · R:R 1:2 · TP calculé dynamiquement</div>
                <div>→ Signaux intégrés aux stats globales — noter W/L/BE manuellement</div>
              </div>
            </div>
            <button onClick={() => copyText(PINE_EDIT_SCRIPT, 'pine_edit')}
              style={{ padding: '8px 16px', background: copied === 'pine_edit' ? 'rgba(240,120,32,0.25)' : 'transparent', border: '1px solid rgba(240,120,32,0.5)', borderRadius: '5px', color: '#f07820', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '1px', transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {copied === 'pine_edit' ? '✓ COPIÉ' : 'COPIER'}
            </button>
          </div>

          <div style={{ background: 'rgba(4,12,8,0.9)', border: '1px solid rgba(240,120,32,0.15)', borderRadius: '6px', overflow: 'auto', maxHeight: '320px' }}>
            <pre style={{ margin: 0, padding: '16px 18px', fontSize: '11px', color: '#7aaa8a', fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: '1.65', whiteSpace: 'pre' }}>
              {PINE_EDIT_SCRIPT.split('\n').map((line, i) => {
                let color = '#7aaa8a';
                if (line.startsWith('//')) color = '#3a6a4a';
                else if (line.startsWith('//@')) color = '#3a5a4a';
                else if (line.match(/^(if|and|or|not)\b/)) color = '#aa88ff';
                else if (line.match(/\b(alert|label\.new|line\.new|box\.new|ta\.)\b/)) color = '#00aaff';
                else if (line.match(/["'][^"']*["']/)) color = '#f07820';
                return <span key={i} style={{ display: 'block', color }}>{line}</span>;
              })}
            </pre>
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
