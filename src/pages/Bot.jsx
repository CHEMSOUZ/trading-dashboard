import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

// MNQ : 5 contrats × $2.00/pt = $10.00 par point
const MNQ_CONTRACTS  = 5;
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
indicator('ICT Setup — LIQ + MSS + FVG [EDIT v6]', overlay = true, max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500)

// ─── IDENTITÉ ─────────────────────────────────────────────────────────────
bot_name    = "ICT_EDIT"
symbol_name = "MNQ"

// ─── INPUTS ───────────────────────────────────────────────────────────────
var g1 = 'Swing Detection'
swing_len = input.int(5, 'Swing Length', group = g1)

var g2 = 'Liquidity'
liq_len   = input.int(20,     'Lookback Equal H/L',         group = g2)
liq_tol   = input.float(0.10, 'Tolerance % égalité',        group = g2, step = 0.01)
show_sess = input.bool(true,  'Afficher liquidité sessions', group = g2)

var g3 = 'FVG'
fvg_min_pts = input.float(5.0, 'Taille min FVG LTF (pts)',  group = g3)

var g4 = 'Display'
show_liq      = input.bool(true, 'Afficher liquidité EQH/EQL LTF', group = g4)
show_mss      = input.bool(true, 'Afficher MSS',                   group = g4)
show_fvg      = input.bool(true, 'Afficher FVG LTF',               group = g4)
show_ob       = input.bool(true, 'Afficher Order Block',            group = g4)
show_cont     = input.bool(true, 'Afficher Continuation FVG',       group = g4)
show_htf      = input.bool(true, 'Afficher niveaux Daily/Weekly',   group = g4)
show_htf_fvg  = input.bool(true, 'Afficher FVG 4H / Daily',        group = g4)
show_daily_eq = input.bool(true, 'Afficher EQH/EQL Daily semaine',  group = g4)

var g5 = 'Fibonacci'
show_fib    = input.bool(true,  'Afficher Fibonacci',     group = g5)
fib_min_pts = input.float(20.0, 'Taille min jambe (pts)', group = g5)

var g6 = 'Risk / Reward'
min_rr = input.float(2.0, 'RR minimum strict', group = g6, step = 0.1, minval = 1.0)

// ─── COULEURS ─────────────────────────────────────────────────────────────
bull_col     = color.new(color.teal,    0)
bull_bg      = color.new(color.teal,   85)
bear_col     = color.new(color.red,     0)
bear_bg      = color.new(color.red,    85)
liq_col      = color.new(color.orange,  0)
cont_col     = color.new(color.blue,    0)
cont_bg      = color.new(color.blue,   80)
fib_col      = color.new(color.white,  60)
fib_50_col   = color.new(color.yellow,  0)
fib_618_col  = color.new(color.orange,  0)
col_asia     = color.new(color.aqua,    0)
col_lon      = color.new(color.yellow,  0)
col_ny       = color.new(color.lime,    0)
col_daily    = color.new(color.fuchsia, 0)
col_weekly   = color.new(color.white,   0)
col_4h_fvg   = color.new(color.purple, 70)
col_d_fvg    = color.new(color.orange, 70)

// ═══════════════════════════════════════════════════════════════════════════
// ─── DONNÉES HTF via request.security ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ── Daily : H/L/O/C des 5 derniers jours + pivots EQH/EQL ─────────────────
[d_h0, d_l0] = request.security(syminfo.tickerid, "D", [high[1], low[1]], lookahead = barmerge.lookahead_on)
[d_h1, d_l1] = request.security(syminfo.tickerid, "D", [high[2], low[2]], lookahead = barmerge.lookahead_on)
[d_h2, d_l2] = request.security(syminfo.tickerid, "D", [high[3], low[3]], lookahead = barmerge.lookahead_on)
[d_h3, d_l3] = request.security(syminfo.tickerid, "D", [high[4], low[4]], lookahead = barmerge.lookahead_on)
[d_h4, d_l4] = request.security(syminfo.tickerid, "D", [high[5], low[5]], lookahead = barmerge.lookahead_on)

// ── Weekly : H/L semaine en cours et precedente ────────────────────────────
[w_h0, w_l0] = request.security(syminfo.tickerid, "W", [high[1], low[1]], lookahead = barmerge.lookahead_on)
[w_h1, w_l1] = request.security(syminfo.tickerid, "W", [high[2], low[2]], lookahead = barmerge.lookahead_on)

// ── FVG 4H ─────────────────────────────────────────────────────────────────
[h4_high0, h4_low0, h4_high2, h4_low2] = request.security(syminfo.tickerid, "240",
     [high, low, high[2], low[2]], lookahead = barmerge.lookahead_off)

h4_bull_fvg_size = h4_low0  - h4_high2
h4_bear_fvg_size = h4_low2  - h4_high0

// ── FVG Daily ──────────────────────────────────────────────────────────────
[d_high0, d_low0, d_high2, d_low2] = request.security(syminfo.tickerid, "D",
     [high, low, high[2], low[2]], lookahead = barmerge.lookahead_off)

d_bull_fvg_size = d_low0  - d_high2
d_bear_fvg_size = d_low2  - d_high0

// ═══════════════════════════════════════════════════════════════════════════
// ─── TRACE NIVEAUX DAILY / WEEKLY ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
var bool daily_drawn  = false
var bool weekly_drawn = false

is_new_day  = ta.change(time("D"))  != 0
is_new_week = ta.change(time("W"))  != 0

var array<float> daily_highs = array.new_float()
var array<float> daily_lows  = array.new_float()
var array<float> weekly_highs= array.new_float()
var array<float> weekly_lows = array.new_float()

f_htf_line(lvl, col, lbl, lbl_style) =>
    l  = line.new(bar_index, lvl, bar_index + 200, lvl, color = col, style = line.style_dashed, width = 1)
    lb = label.new(bar_index + 200, lvl, lbl, color = color.new(col, 80), textcolor = col, style = lbl_style, size = size.tiny)

if is_new_day and show_htf
    array.clear(daily_highs)
    array.clear(daily_lows)

    days_available = math.min(dayofweek - 2, 4)
    if days_available >= 0
        array.push(daily_highs, d_h0) ; array.push(daily_lows, d_l0)
    if days_available >= 1
        array.push(daily_highs, d_h1) ; array.push(daily_lows, d_l1)
    if days_available >= 2
        array.push(daily_highs, d_h2) ; array.push(daily_lows, d_l2)
    if days_available >= 3
        array.push(daily_highs, d_h3) ; array.push(daily_lows, d_l3)
    if days_available >= 4
        array.push(daily_highs, d_h4) ; array.push(daily_lows, d_l4)

    if not na(d_h0)
        line.new(bar_index, d_h0, bar_index + 200, d_h0, color = col_daily, style = line.style_dashed, width = 2)
        line.new(bar_index, d_l0, bar_index + 200, d_l0, color = col_daily, style = line.style_dashed, width = 2)
        label.new(bar_index + 200, d_h0, 'PDH', color = color.new(col_daily, 80), textcolor = col_daily, style = label.style_label_left, size = size.tiny)
        label.new(bar_index + 200, d_l0, 'PDL', color = color.new(col_daily, 80), textcolor = col_daily, style = label.style_label_left, size = size.tiny)

    if days_available >= 1 and not na(d_h1)
        line.new(bar_index, d_h1, bar_index + 200, d_h1, color = color.new(col_daily, 40), style = line.style_dotted, width = 1)
        line.new(bar_index, d_l1, bar_index + 200, d_l1, color = color.new(col_daily, 40), style = line.style_dotted, width = 1)
    if days_available >= 2 and not na(d_h2)
        line.new(bar_index, d_h2, bar_index + 200, d_h2, color = color.new(col_daily, 55), style = line.style_dotted, width = 1)
        line.new(bar_index, d_l2, bar_index + 200, d_l2, color = color.new(col_daily, 55), style = line.style_dotted, width = 1)
    if days_available >= 3 and not na(d_h3)
        line.new(bar_index, d_h3, bar_index + 200, d_h3, color = color.new(col_daily, 65), style = line.style_dotted, width = 1)
        line.new(bar_index, d_l3, bar_index + 200, d_l3, color = color.new(col_daily, 65), style = line.style_dotted, width = 1)
    if days_available >= 4 and not na(d_h4)
        line.new(bar_index, d_h4, bar_index + 200, d_h4, color = color.new(col_daily, 75), style = line.style_dotted, width = 1)
        line.new(bar_index, d_l4, bar_index + 200, d_l4, color = color.new(col_daily, 75), style = line.style_dotted, width = 1)

if is_new_week and show_htf
    array.clear(weekly_highs)
    array.clear(weekly_lows)
    if not na(w_h0)
        array.push(weekly_highs, w_h0) ; array.push(weekly_lows, w_l0)
        line.new(bar_index, w_h0, bar_index + 300, w_h0, color = col_weekly, style = line.style_dashed, width = 2)
        line.new(bar_index, w_l0, bar_index + 300, w_l0, color = col_weekly, style = line.style_dashed, width = 2)
        label.new(bar_index + 300, w_h0, 'PWH', color = color.new(col_weekly, 80), textcolor = col_weekly, style = label.style_label_left, size = size.tiny)
        label.new(bar_index + 300, w_l0, 'PWL', color = color.new(col_weekly, 80), textcolor = col_weekly, style = label.style_label_left, size = size.tiny)
    if not na(w_h1)
        array.push(weekly_highs, w_h1) ; array.push(weekly_lows, w_l1)

// ─── EQH/EQL DAILY ────────────────────────────────────────────────────────
var array<float> eq_highs_daily = array.new_float()
var array<float> eq_lows_daily  = array.new_float()

if is_new_day and show_daily_eq
    array.clear(eq_highs_daily)
    array.clear(eq_lows_daily)

    daily_h_pool = array.from(d_h0, d_h1, d_h2, d_h3, d_h4)
    daily_l_pool = array.from(d_l0, d_l1, d_l2, d_l3, d_l4)

    for i = 0 to 4 by 1
        hi = array.get(daily_h_pool, i)
        if na(hi)
            continue
        for j = i + 1 to 4 by 1
            hj = array.get(daily_h_pool, j)
            if na(hj)
                continue
            if math.abs(hi - hj) / hi * 100 < liq_tol * 3.0
                if not array.includes(eq_highs_daily, hi)
                    array.push(eq_highs_daily, hi)
                if show_daily_eq
                    line.new(bar_index - j * 2, hj, bar_index, hi,
                         color = color.new(col_daily, 30), style = line.style_dashed, width = 2)
                    label.new(bar_index, hi, 'EQH D', color = color.new(col_daily, 70), textcolor = col_daily, style = label.style_label_left, size = size.tiny)
                break

    for i = 0 to 4 by 1
        li = array.get(daily_l_pool, i)
        if na(li)
            continue
        for j = i + 1 to 4 by 1
            lj = array.get(daily_l_pool, j)
            if na(lj)
                continue
            if math.abs(li - lj) / li * 100 < liq_tol * 3.0
                if not array.includes(eq_lows_daily, li)
                    array.push(eq_lows_daily, li)
                if show_daily_eq
                    line.new(bar_index - j * 2, lj, bar_index, li,
                         color = color.new(col_daily, 30), style = line.style_dashed, width = 2)
                    label.new(bar_index, li, 'EQL D', color = color.new(col_daily, 70), textcolor = col_daily, style = label.style_label_left, size = size.tiny)
                break

// ═══════════════════════════════════════════════════════════════════════════
// ─── FVG 4H et DAILY ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
var array<float> fvg4h_hi   = array.new_float()
var array<float> fvg4h_lo   = array.new_float()
var array<bool>  fvg4h_bull = array.new_bool()
var array<box>   fvg4h_box  = array.new<box>()

var array<float> fvgD_hi    = array.new_float()
var array<float> fvgD_lo    = array.new_float()
var array<bool>  fvgD_bull  = array.new_bool()
var array<box>   fvgD_box   = array.new<box>()

new_4h_bar = ta.change(time("240")) != 0

if new_4h_bar and show_htf_fvg
    if h4_bull_fvg_size > fvg_min_pts * 2.0
        b = box.new(bar_index - 2, h4_low0, bar_index + 300, h4_high2,
             bgcolor = col_4h_fvg, border_color = color.new(color.purple, 40), border_width = 1,
             text = 'FVG 4H ▲', text_color = color.new(color.purple, 20), text_size = size.tiny)
        array.push(fvg4h_hi, h4_low0) ; array.push(fvg4h_lo, h4_high2)
        array.push(fvg4h_bull, true)  ; array.push(fvg4h_box, b)
        if array.size(fvg4h_hi) > 5
            box.delete(array.shift(fvg4h_box))
            array.shift(fvg4h_hi) ; array.shift(fvg4h_lo) ; array.shift(fvg4h_bull)

    if h4_bear_fvg_size > fvg_min_pts * 2.0
        b = box.new(bar_index - 2, h4_low2, bar_index + 300, h4_high0,
             bgcolor = col_4h_fvg, border_color = color.new(color.purple, 40), border_width = 1,
             text = 'FVG 4H ▼', text_color = color.new(color.purple, 20), text_size = size.tiny)
        array.push(fvg4h_hi, h4_low2) ; array.push(fvg4h_lo, h4_high0)
        array.push(fvg4h_bull, false)  ; array.push(fvg4h_box, b)
        if array.size(fvg4h_hi) > 5
            box.delete(array.shift(fvg4h_box))
            array.shift(fvg4h_hi) ; array.shift(fvg4h_lo) ; array.shift(fvg4h_bull)

new_d_bar = ta.change(time("D")) != 0

if new_d_bar and show_htf_fvg
    if d_bull_fvg_size > fvg_min_pts * 4.0
        b = box.new(bar_index - 2, d_low0, bar_index + 400, d_high2,
             bgcolor = col_d_fvg, border_color = color.new(color.orange, 40), border_width = 1,
             text = 'FVG D ▲', text_color = color.new(color.orange, 20), text_size = size.tiny)
        array.push(fvgD_hi, d_low0) ; array.push(fvgD_lo, d_high2)
        array.push(fvgD_bull, true)  ; array.push(fvgD_box, b)
        if array.size(fvgD_hi) > 5
            box.delete(array.shift(fvgD_box))
            array.shift(fvgD_hi) ; array.shift(fvgD_lo) ; array.shift(fvgD_bull)

    if d_bear_fvg_size > fvg_min_pts * 4.0
        b = box.new(bar_index - 2, d_low2, bar_index + 400, d_high0,
             bgcolor = col_d_fvg, border_color = color.new(color.orange, 40), border_width = 1,
             text = 'FVG D ▼', text_color = color.new(color.orange, 20), text_size = size.tiny)
        array.push(fvgD_hi, d_low2) ; array.push(fvgD_lo, d_high0)
        array.push(fvgD_bull, false)  ; array.push(fvgD_box, b)
        if array.size(fvgD_hi) > 5
            box.delete(array.shift(fvgD_box))
            array.shift(fvgD_hi) ; array.shift(fvgD_lo) ; array.shift(fvgD_bull)

f_clean_htf_fvg(hi_arr, lo_arr, bull_arr, box_arr) =>
    i = 0
    while i < array.size(hi_arr)
        hi      = array.get(hi_arr,   i)
        lo      = array.get(lo_arr,   i)
        is_bull = array.get(bull_arr, i)
        comble  = is_bull ? low <= lo : high >= hi
        if comble
            box.delete(array.get(box_arr, i))
            array.remove(hi_arr,   i)
            array.remove(lo_arr,   i)
            array.remove(bull_arr, i)
            array.remove(box_arr,  i)
        else
            i += 1

f_clean_htf_fvg(fvg4h_hi, fvg4h_lo, fvg4h_bull, fvg4h_box)
f_clean_htf_fvg(fvgD_hi,  fvgD_lo,  fvgD_bull,  fvgD_box)

f_price_in_htf_fvg(hi_arr, lo_arr, bull_arr, is_long_trade) =>
    result = false
    n = array.size(hi_arr)
    if n > 0
        for k = 0 to n - 1 by 1
            hi      = array.get(hi_arr,   k)
            lo      = array.get(lo_arr,   k)
            is_bull = array.get(bull_arr, k)
            if is_long_trade == is_bull
                if close >= lo and close <= hi
                    result := true
    result

in_4h_fvg_bull = f_price_in_htf_fvg(fvg4h_hi, fvg4h_lo, fvg4h_bull, true)
in_4h_fvg_bear = f_price_in_htf_fvg(fvg4h_hi, fvg4h_lo, fvg4h_bull, false)
in_d_fvg_bull  = f_price_in_htf_fvg(fvgD_hi,  fvgD_lo,  fvgD_bull,  true)
in_d_fvg_bear  = f_price_in_htf_fvg(fvgD_hi,  fvgD_lo,  fvgD_bull,  false)

in_htf_fvg_bull = in_4h_fvg_bull or in_d_fvg_bull
in_htf_fvg_bear = in_4h_fvg_bear or in_d_fvg_bear

// ═══════════════════════════════════════════════════════════════════════════
// ─── SESSIONS INTRADAY ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
t_asia_open    = timestamp("UTC", year, month, dayofmonth,  0,  0)
t_asia_close   = timestamp("UTC", year, month, dayofmonth,  6,  0)
t_london_open  = timestamp("UTC", year, month, dayofmonth,  8,  0)
t_london_close = timestamp("UTC", year, month, dayofmonth, 11,  0)
t_ny_open      = timestamp("UTC", year, month, dayofmonth, 13, 30)
t_ny_close     = timestamp("UTC", year, month, dayofmonth, 16,  0)

in_asia   = time >= t_asia_open   and time < t_asia_close
in_london = time >= t_london_open and time < t_london_close
in_ny     = time >= t_ny_open     and time < t_ny_close

var float asia_h = na ; var float asia_l = na
var float lon_h  = na ; var float lon_l  = na
var float ny_h   = na ; var float ny_l   = na
var bool  asia_done = false ; var bool lon_done = false ; var bool ny_done = false

if dayofweek != dayofweek[1]
    asia_h := na ; asia_l := na ; lon_h := na ; lon_l := na ; ny_h := na ; ny_l := na
    asia_done := false ; lon_done := false ; ny_done := false

if in_asia
    asia_h := na(asia_h) ? high : math.max(asia_h, high)
    asia_l := na(asia_l) ? low  : math.min(asia_l, low)
if in_london
    lon_h  := na(lon_h)  ? high : math.max(lon_h,  high)
    lon_l  := na(lon_l)  ? low  : math.min(lon_l,  low)
if in_ny
    ny_h   := na(ny_h)   ? high : math.max(ny_h,   high)
    ny_l   := na(ny_l)   ? low  : math.min(ny_l,   low)

f_sess_lines(h, l, col, lbl_h, lbl_l) =>
    line.new(bar_index - 50, h, bar_index + 100, h, color = col, style = line.style_dashed, width = 2)
    line.new(bar_index - 50, l, bar_index + 100, l, color = col, style = line.style_dashed, width = 2)
    label.new(bar_index, h, lbl_h, color = color.new(col, 70), textcolor = col, style = label.style_label_left, size = size.tiny)
    label.new(bar_index, l, lbl_l, color = color.new(col, 70), textcolor = col, style = label.style_label_left, size = size.tiny)

if not in_asia   and not na(asia_h) and not asia_done and show_sess
    f_sess_lines(asia_h, asia_l, col_asia, 'Asia H', 'Asia L')
    asia_done := true
if not in_london and not na(lon_h)  and not lon_done  and show_sess
    f_sess_lines(lon_h, lon_l, col_lon, 'London H', 'London L')
    lon_done := true
if not in_ny     and not na(ny_h)   and not ny_done   and show_sess
    f_sess_lines(ny_h, ny_l, col_ny, 'NY H', 'NY L')
    ny_done := true

// ═══════════════════════════════════════════════════════════════════════════
// ─── EQH/EQL LTF ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
var array<float> eq_highs_1m = array.new_float()
var array<float> eq_lows_1m  = array.new_float()

[htf_ph, htf_pl] = request.security(syminfo.tickerid, "1",
     [ta.pivothigh(high, 3, 3), ta.pivotlow(low, 3, 3)], lookahead = barmerge.lookahead_off)

if not na(htf_ph) and show_liq
    for i = 1 to 10 by 1
        [ph_prev, _] = request.security(syminfo.tickerid, "1",
             [ta.pivothigh(high, 3, 3)[i], ta.pivotlow(low, 3, 3)[i]], lookahead = barmerge.lookahead_off)
        if not na(ph_prev) and math.abs(htf_ph - ph_prev) / htf_ph * 100 < liq_tol
            line.new(bar_index - i, ph_prev, bar_index, htf_ph, color = color.new(color.orange, 50), style = line.style_dotted, width = 1)
            array.push(eq_highs_1m, htf_ph)
            break

if not na(htf_pl) and show_liq
    for i = 1 to 10 by 1
        [_, pl_prev] = request.security(syminfo.tickerid, "1",
             [ta.pivothigh(high, 3, 3)[i], ta.pivotlow(low, 3, 3)[i]], lookahead = barmerge.lookahead_off)
        if not na(pl_prev) and math.abs(htf_pl - pl_prev) / htf_pl * 100 < liq_tol
            line.new(bar_index - i, pl_prev, bar_index, htf_pl, color = color.new(color.orange, 50), style = line.style_dotted, width = 1)
            array.push(eq_lows_1m, htf_pl)
            break

// ─── SWING HIGH / LOW LTF ─────────────────────────────────────────────────
swing_high = ta.pivothigh(high, swing_len, swing_len)
swing_low  = ta.pivotlow(low,  swing_len, swing_len)

// ─── STRUCTURE ────────────────────────────────────────────────────────────
var float last_sh     = na ; var float last_sl     = na
var float prev_sh     = na ; var float prev_sl     = na
var int   last_sh_bar = na ; var int   last_sl_bar = na
var bool  bull_structure = na

if not na(swing_high)
    prev_sh := last_sh ; last_sh := swing_high ; last_sh_bar := bar_index - swing_len
    if not na(prev_sh)
        bull_structure := swing_high > prev_sh ? true : swing_high < prev_sh ? false : bull_structure

if not na(swing_low)
    prev_sl := last_sl ; last_sl := swing_low ; last_sl_bar := bar_index - swing_len
    if not na(prev_sl)
        bull_structure := swing_low < prev_sl ? false : swing_low > prev_sl ? true : bull_structure

// ─── EQH/EQL LTF courant ──────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// ─── FONCTION TP ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
f_find_tp(entry, sl, is_long) =>
    risk       = math.abs(entry - sl)
    candidates = array.new_float()

    if is_long
        for k = 0 to array.size(eq_highs) - 1 by 1
            lvl = array.get(eq_highs, k)
            if lvl > entry
                array.push(candidates, lvl)
        for k = 0 to array.size(eq_highs_1m) - 1 by 1
            lvl = array.get(eq_highs_1m, k)
            if lvl > entry
                array.push(candidates, lvl)
    else
        for k = 0 to array.size(eq_lows) - 1 by 1
            lvl = array.get(eq_lows, k)
            if lvl < entry
                array.push(candidates, lvl)
        for k = 0 to array.size(eq_lows_1m) - 1 by 1
            lvl = array.get(eq_lows_1m, k)
            if lvl < entry
                array.push(candidates, lvl)

    if is_long
        if not na(asia_h) and asia_h > entry
            array.push(candidates, asia_h)
        if not na(lon_h)  and lon_h  > entry
            array.push(candidates, lon_h)
        if not na(ny_h)   and ny_h   > entry
            array.push(candidates, ny_h)
    else
        if not na(asia_l) and asia_l < entry
            array.push(candidates, asia_l)
        if not na(lon_l)  and lon_l  < entry
            array.push(candidates, lon_l)
        if not na(ny_l)   and ny_l   < entry
            array.push(candidates, ny_l)

    if is_long
        for k = 0 to array.size(daily_highs) - 1 by 1
            lvl = array.get(daily_highs, k)
            if not na(lvl) and lvl > entry
                array.push(candidates, lvl)
    else
        for k = 0 to array.size(daily_lows) - 1 by 1
            lvl = array.get(daily_lows, k)
            if not na(lvl) and lvl < entry
                array.push(candidates, lvl)

    if is_long
        for k = 0 to array.size(eq_highs_daily) - 1 by 1
            lvl = array.get(eq_highs_daily, k)
            if not na(lvl) and lvl > entry
                array.push(candidates, lvl)
    else
        for k = 0 to array.size(eq_lows_daily) - 1 by 1
            lvl = array.get(eq_lows_daily, k)
            if not na(lvl) and lvl < entry
                array.push(candidates, lvl)

    if is_long
        for k = 0 to array.size(weekly_highs) - 1 by 1
            lvl = array.get(weekly_highs, k)
            if not na(lvl) and lvl > entry
                array.push(candidates, lvl)
    else
        for k = 0 to array.size(weekly_lows) - 1 by 1
            lvl = array.get(weekly_lows, k)
            if not na(lvl) and lvl < entry
                array.push(candidates, lvl)

    for k = 0 to array.size(fvg4h_hi) - 1 by 1
        h4hi = array.get(fvg4h_hi, k)
        h4lo = array.get(fvg4h_lo, k)
        if is_long and h4hi > entry
            array.push(candidates, h4hi)
        if not is_long and h4lo < entry
            array.push(candidates, h4lo)

    for k = 0 to array.size(fvgD_hi) - 1 by 1
        dhi = array.get(fvgD_hi, k)
        dlo = array.get(fvgD_lo, k)
        if is_long and dhi > entry
            array.push(candidates, dhi)
        if not is_long and dlo < entry
            array.push(candidates, dlo)

    best_tp = float(na)
    for k = 0 to array.size(candidates) - 1 by 1
        lvl    = array.get(candidates, k)
        rr_lvl = is_long ? (lvl - entry) / risk : (entry - lvl) / risk
        if rr_lvl >= min_rr
            if na(best_tp)
                best_tp := lvl
            else
                best_tp := is_long ? (lvl < best_tp ? lvl : best_tp)
                                   : (lvl > best_tp ? lvl : best_tp)
    best_tp

// ═══════════════════════════════════════════════════════════════════════════
// ─── LIQUIDITY SWEEP ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
var bool  bull_sweep     = false
var bool  bear_sweep     = false
var float sweep_low_val  = na
var float sweep_high_val = na
var bool  bull_cont      = false
var bool  bear_cont      = false

bear_fvg_on_break = (low[2] - high)    > fvg_min_pts
bull_fvg_on_break = (low    - high[2]) > fvg_min_pts

if array.size(eq_lows) > 0
    lvl = array.get(eq_lows, array.size(eq_lows) - 1)
    if low < lvl and close > lvl
        bull_sweep := true ; sweep_low_val := low
        array.clear(eq_lows)

if array.size(eq_highs) > 0
    lvl = array.get(eq_highs, array.size(eq_highs) - 1)
    if high > lvl and close < lvl
        bear_sweep := true ; sweep_high_val := high
        array.clear(eq_highs)

if array.size(eq_highs) > 0
    lvl_h = array.get(eq_highs, array.size(eq_highs) - 1)
    if high > lvl_h and close > lvl_h and bull_fvg_on_break
        bull_cont := true
        if show_cont
            box.new(bar_index - 2, low, bar_index + 20, high[2], bgcolor = cont_bg, border_color = cont_col, border_width = 1, text = 'CONT ▲', text_color = cont_col, text_size = size.small)
        array.clear(eq_highs)

if array.size(eq_lows) > 0
    lvl_l = array.get(eq_lows, array.size(eq_lows) - 1)
    if low < lvl_l and close < lvl_l and bear_fvg_on_break
        bear_cont := true
        if show_cont
            box.new(bar_index - 2, low[2], bar_index + 20, high, bgcolor = color.new(color.blue, 80), border_color = cont_col, border_width = 1, text = 'CONT ▼', text_color = cont_col, text_size = size.small)
        array.clear(eq_lows)

// ─── MSS ──────────────────────────────────────────────────────────────────
var bool bull_mss = false
var bool bear_mss = false

if bull_sweep and not na(last_sh)
    if close > last_sh and (na(bull_structure) or bull_structure == false)
        bull_mss := true ; bull_sweep := false
        if show_mss
            label.new(bar_index, high, 'MSS ▲', color = bull_bg, textcolor = bull_col, style = label.style_label_down, size = size.small)

if bear_sweep and not na(last_sl)
    if close < last_sl and (na(bull_structure) or bull_structure == true)
        bear_mss := true ; bear_sweep := false
        if show_mss
            label.new(bar_index, low, 'MSS ▼', color = bear_bg, textcolor = bear_col, style = label.style_label_up, size = size.small)

// ─── ORDER BLOCK ──────────────────────────────────────────────────────────
displacement_up   = close > close[1] * 1.002 and close[1] > close[2] * 1.002
displacement_down = close < close[1] * 0.998 and close[1] < close[2] * 0.998
bull_ob = displacement_up   and close[3] < open[3]
bear_ob = displacement_down and close[3] > open[3]

var float ob_bull_hi = na ; var float ob_bull_lo = na
var float ob_bear_hi = na ; var float ob_bear_lo = na
var bool  ob_bull_valid = false ; var bool ob_bear_valid = false

if bull_ob
    ob_bull_hi := high[3] ; ob_bull_lo := low[3] ; ob_bull_valid := true
    if show_ob
        box.new(bar_index - 3, high[3], bar_index + 20, low[3], bgcolor = color.new(color.teal, 80), border_color = color.teal, border_width = 1, text = 'OB Bull', text_color = color.teal, text_size = size.small)
if bear_ob
    ob_bear_hi := high[3] ; ob_bear_lo := low[3] ; ob_bear_valid := true
    if show_ob
        box.new(bar_index - 3, high[3], bar_index + 20, low[3], bgcolor = color.new(color.red, 80), border_color = color.red, border_width = 1, text = 'OB Bear', text_color = color.red, text_size = size.small)

if ob_bull_valid and close < ob_bull_lo
    ob_bull_valid := false
if ob_bear_valid and close > ob_bear_hi
    ob_bear_valid := false

// ─── FVG LTF ──────────────────────────────────────────────────────────────
var bool  bull_fvg_active = false ; var float bull_fvg_hi = na ; var float bull_fvg_lo = na
var bool  bear_fvg_active = false ; var float bear_fvg_hi = na ; var float bear_fvg_lo = na

bull_fvg_size = low - high[2]
if bull_fvg_size > fvg_min_pts
    bull_fvg_active := true ; bull_fvg_hi := low ; bull_fvg_lo := high[2]
    if show_fvg
        box.new(bar_index - 2, bull_fvg_hi, bar_index + 50, bull_fvg_lo, bgcolor = bull_bg, border_color = bull_col, border_width = 1)

bear_fvg_size = low[2] - high
if bear_fvg_size > fvg_min_pts
    bear_fvg_active := true ; bear_fvg_hi := low[2] ; bear_fvg_lo := high
    if show_fvg
        box.new(bar_index - 2, bear_fvg_hi, bar_index + 50, bear_fvg_lo, bgcolor = bear_bg, border_color = bear_col, border_width = 1)

if bull_fvg_active and low  < bull_fvg_lo
    bull_fvg_active := false
if bear_fvg_active and high > bear_fvg_hi
    bear_fvg_active := false

// ─── CONTINUATION OB+FVG ──────────────────────────────────────────────────
var bool  ob_fvg_bull_waiting = false ; var float ob_fvg_bull_sl = na
var bool  ob_fvg_bear_waiting = false ; var float ob_fvg_bear_sl = na

if ob_bull_valid and bull_fvg_active and not na(ob_bull_lo) and not na(bull_fvg_lo) and ob_bull_lo < bull_fvg_lo and not ob_fvg_bull_waiting
    ob_fvg_bull_waiting := true ; ob_fvg_bull_sl := ob_bull_lo - 5.0
if ob_bear_valid and bear_fvg_active and not na(ob_bear_hi) and not na(bear_fvg_hi) and ob_bear_hi > bear_fvg_hi and not ob_fvg_bear_waiting
    ob_fvg_bear_waiting := true ; ob_fvg_bear_sl := ob_bear_hi + 5.0

if not ob_bull_valid or not bull_fvg_active
    ob_fvg_bull_waiting := false
if not ob_bear_valid or not bear_fvg_active
    ob_fvg_bear_waiting := false

ob_fvg_bull_signal = ob_fvg_bull_waiting and close >= bull_fvg_lo and close <= bull_fvg_hi
ob_fvg_bear_signal = ob_fvg_bear_waiting and close >= bear_fvg_lo and close <= bear_fvg_hi

if ob_fvg_bull_signal
    ob_fvg_bull_waiting := false
if ob_fvg_bear_signal
    ob_fvg_bear_waiting := false

// ─── SIGNAL MSS + FVG ─────────────────────────────────────────────────────
var bool waiting_buy  = false
var bool waiting_sell = false

if bull_mss and bull_fvg_active
    waiting_buy := true ; bull_mss := false
if bear_mss and bear_fvg_active
    waiting_sell := true ; bear_mss := false
if not bull_fvg_active
    waiting_buy := false
if not bear_fvg_active
    waiting_sell := false

buy_signal  = waiting_buy  and close >= bull_fvg_lo and close <= bull_fvg_hi
sell_signal = waiting_sell and close >= bear_fvg_lo and close <= bear_fvg_hi

if buy_signal
    waiting_buy := false
if sell_signal
    waiting_sell := false

// ─── FIBONACCI ────────────────────────────────────────────────────────────
var array<float> fib_sh_arr  = array.new_float()
var array<float> fib_sl_arr  = array.new_float()
var array<int>   fib_bar_sh  = array.new_int()
var array<int>   fib_bar_sl  = array.new_int()
var array<bool>  fib_is_bull = array.new_bool()
fib_levels = array.from(0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0)
var float pending_sh = na ; var float pending_sl = na
var int   pending_sh_bar = na ; var int pending_sl_bar = na
var bool  last_pivot_was_high = na

if not na(swing_high)
    if not na(pending_sl) and (na(last_pivot_was_high) or last_pivot_was_high == false)
        if swing_high - pending_sl >= fib_min_pts and show_fib
            array.push(fib_sh_arr, swing_high) ; array.push(fib_sl_arr, pending_sl)
            array.push(fib_bar_sh, bar_index - swing_len) ; array.push(fib_bar_sl, pending_sl_bar)
            array.push(fib_is_bull, true)
            if array.size(fib_sh_arr) > 6
                array.shift(fib_sh_arr) ; array.shift(fib_sl_arr)
                array.shift(fib_bar_sh) ; array.shift(fib_bar_sl) ; array.shift(fib_is_bull)
    pending_sh := swing_high ; pending_sh_bar := bar_index - swing_len
    last_pivot_was_high := true

if not na(swing_low)
    if not na(pending_sh) and (na(last_pivot_was_high) or last_pivot_was_high == true)
        if pending_sh - swing_low >= fib_min_pts and show_fib
            array.push(fib_sh_arr, pending_sh) ; array.push(fib_sl_arr, swing_low)
            array.push(fib_bar_sh, pending_sh_bar) ; array.push(fib_bar_sl, bar_index - swing_len)
            array.push(fib_is_bull, false)
            if array.size(fib_sh_arr) > 6
                array.shift(fib_sh_arr) ; array.shift(fib_sl_arr)
                array.shift(fib_bar_sh) ; array.shift(fib_bar_sl) ; array.shift(fib_is_bull)
    pending_sl := swing_low ; pending_sl_bar := bar_index - swing_len
    last_pivot_was_high := false

var line[]  fib_lines  = array.new<line>()
var label[] fib_labels = array.new<label>()

if barstate.islast and show_fib
    for l  in fib_lines  => line.delete(l)
    for lb in fib_labels => label.delete(lb)
    array.clear(fib_lines) ; array.clear(fib_labels)
    n = array.size(fib_sh_arr)
    for i = 0 to n - 1 by 1
        sh = array.get(fib_sh_arr, i) ; sl = array.get(fib_sl_arr, i)
        bar_sh = array.get(fib_bar_sh, i) ; bar_sl = array.get(fib_bar_sl, i)
        is_bull = array.get(fib_is_bull, i)
        mid = (sh + sl) / 2.0
        end_bar = is_bull ? bar_sh : bar_sl
        bars_since = bar_index - end_bar
        touched_50 = false
        if bars_since > 0
            for b = 0 to math.min(bars_since - 1, 500) by 1
                if is_bull and low[b] <= mid
                    touched_50 := true ; break
                if not is_bull and high[b] >= mid
                    touched_50 := true ; break
        if not touched_50
            fib_lv_labels = array.from("0", "0.236", "0.382", "0.5", "0.618", "0.786", "1")
            for j = 0 to 6 by 1
                lv = array.get(fib_levels, j)
                px = sl + (sh - sl) * (1.0 - lv)
                lv_col   = lv == 0.5 ? fib_50_col : lv == 0.618 ? fib_618_col : fib_col
                lv_width = (lv == 0.5 or lv == 0.618) ? 2 : 1
                array.push(fib_lines, line.new(is_bull ? bar_sl : bar_sh, px, bar_index + 30, px, color = lv_col, style = line.style_solid, width = lv_width))
                if lv == 0.0 or lv == 0.5 or lv == 0.618 or lv == 1.0
                    array.push(fib_labels, label.new(bar_index + 30, px, array.get(fib_lv_labels, j),
                         color = color.new(color.black, 100), textcolor = lv_col, style = label.style_label_left, size = size.tiny))

// ═══════════════════════════════════════════════════════════════════════════
// ─── BE MANUEL + TRACKING ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
be_count = input.int(0, "🟡 BE Manuel — incrementer pour liberer (0→1→2…)", group = "Tracking", minval = 0, step = 1)
var int    be_last   = 0
var float  trk_entry = na ; var float trk_sl   = na ; var float trk_tp  = na
var float  trk_rr    = na ; var bool  trk_long  = false
var bool   trk_open  = false ; var float trk_peak = na ; var string trk_type = ""
var string trk_htf_ctx = ""

new_be_req = be_count > be_last and barstate.islast
if trk_open
    trk_peak := trk_long ? (na(trk_peak) ? high : math.max(trk_peak, high))
                         : (na(trk_peak) ? low  : math.min(trk_peak, low))
    hit_tp  = trk_long ? high >= trk_tp : low  <= trk_tp
    hit_sl  = trk_long ? low  <= trk_sl : high >= trk_sl
    had_run = trk_long ? trk_peak >= trk_entry + 5.0 : trk_peak <= trk_entry - 5.0
    hit_be  = new_be_req or (had_run and (trk_long ? close <= trk_entry : close >= trk_entry))
    if hit_tp
        alert('{"type":"close","result":"win","bot":"' + bot_name + '","setup":"' + trk_type + '","rr":"' + str.tostring(trk_rr, "#.##") + '"}', alert.freq_once_per_bar_close)
        trk_open := false ; trk_peak := na
    else if hit_sl
        alert('{"type":"close","result":"loss","bot":"' + bot_name + '","setup":"' + trk_type + '"}', alert.freq_once_per_bar_close)
        trk_open := false ; trk_peak := na
    else if hit_be
        alert('{"type":"close","result":"be","bot":"' + bot_name + '","setup":"' + trk_type + '"}', alert.freq_once_per_bar_close)
        trk_open := false ; trk_peak := na
        if new_be_req
            be_last := be_count
if not trk_open and new_be_req
    be_last := be_count

// ─── FONCTION ENTREE ──────────────────────────────────────────────────────
f_enter(entry, sl_v, is_long, setup_type, htf_ctx) =>
    tp_v    = f_find_tp(entry, sl_v, is_long)
    valid   = not na(tp_v)
    rr_real = valid ? math.abs(tp_v - entry) / math.abs(entry - sl_v) : float(na)
    if valid and not trk_open
        tp2_v   = is_long ? entry + math.abs(entry - sl_v) * (rr_real + 1.0)
                          : entry - math.abs(entry - sl_v) * (rr_real + 1.0)
        sig_col = is_long ? bull_col : bear_col
        htf_tag = htf_ctx != "" ? "\n📊 " + htf_ctx : ""
        sig_txt = (is_long ? "BUY ✓\n" : "SELL ✓\n") + setup_type + "\nRR " + str.tostring(rr_real, "#.##") + htf_tag
        label.new(bar_index, is_long ? low : high, sig_txt,
             color = sig_col, textcolor = color.white,
             style = is_long ? label.style_label_up : label.style_label_down, size = size.normal)
        line.new(bar_index, sl_v,  bar_index + 40, sl_v,  color = is_long ? bear_col : bull_col, style = line.style_dotted, width = 2)
        line.new(bar_index, tp_v,  bar_index + 40, tp_v,  color = sig_col, style = line.style_dotted, width = 2)
        line.new(bar_index, tp2_v, bar_index + 40, tp2_v, color = sig_col, style = line.style_dashed, width = 1)
        sig_dir = is_long ? "LONG" : "SHORT"
        alert('{"bot":"' + bot_name + '","symbol":"' + symbol_name + '","signal":"' + sig_dir + '","entry":' + str.tostring(entry) + ',"sl":' + str.tostring(sl_v) + ',"tp":' + str.tostring(tp_v) + ',"rr":"' + str.tostring(rr_real, "#.##") + '","setup":"' + setup_type + '","htf":"' + htf_ctx + '","timeframe":"' + timeframe.period + '"}', alert.freq_once_per_bar_close)
        trk_entry   := entry ; trk_sl := sl_v ; trk_tp := tp_v
        trk_rr      := rr_real ; trk_long := is_long ; trk_open := true
        trk_type    := setup_type ; trk_htf_ctx := htf_ctx
    valid

f_htf_context(is_long) =>
    ctx = ""
    if is_long
        if in_htf_fvg_bull
            ctx := ctx + "FVG HTF"
        if not na(d_h0) and close < d_h0
            ctx := ctx + (ctx != "" ? "+" : "") + "PDH"
        if not na(w_h0) and close < w_h0
            ctx := ctx + (ctx != "" ? "+" : "") + "PWH"
    else
        if in_htf_fvg_bear
            ctx := ctx + "FVG HTF"
        if not na(d_l0) and close > d_l0
            ctx := ctx + (ctx != "" ? "+" : "") + "PDL"
        if not na(w_l0) and close > w_l0
            ctx := ctx + (ctx != "" ? "+" : "") + "PWL"
    ctx

var bool last_rejected = false

if buy_signal and not trk_open and not na(sweep_low_val)
    sl_v = sweep_low_val - 5.0
    last_rejected := not f_enter(close, sl_v, true, "MSS", f_htf_context(true))

if sell_signal and not trk_open and not na(sweep_high_val)
    sl_v = sweep_high_val + 5.0
    last_rejected := not f_enter(close, sl_v, false, "MSS", f_htf_context(false))

if ob_fvg_bull_signal and not trk_open
    last_rejected := not f_enter(close, ob_fvg_bull_sl, true, "OB_CONT", f_htf_context(true))

if ob_fvg_bear_signal and not trk_open
    last_rejected := not f_enter(close, ob_fvg_bear_sl, false, "OB_CONT", f_htf_context(false))

// ─── BAR ALERT ────────────────────────────────────────────────────────────
alert('{"type":"bar","bot":"' + bot_name + '","h":' + str.tostring(math.round(high * 100) / 100) + ',"l":' + str.tostring(math.round(low * 100) / 100) + '}', alert.freq_once_per_bar_close)

// ═══════════════════════════════════════════════════════════════════════════
// ─── DASHBOARD ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
var table dash = table.new(position.top_right, 2, 18,
    border_color = color.new(color.gray, 60), border_width = 1,
    bgcolor      = color.new(#1a1a2e, 10))

f_ok(v) => v ? "✅" : "❌"
f_row(t, ok, r, v) =>
    table.cell(t, 0, r, v,        text_color = color.white, bgcolor = color.new(#1a1a2e, 30),                                text_size = size.small)
    table.cell(t, 1, r, f_ok(ok), text_color = color.white, bgcolor = ok ? color.new(#00e676, 60) : color.new(#ff1744, 60), text_size = size.small)

if barstate.islast
    c1 = array.size(eq_lows) > 0 or array.size(eq_highs) > 0
    c2 = bull_sweep or bear_sweep
    c3 = waiting_buy or waiting_sell
    c4 = bull_fvg_active or bear_fvg_active
    c5 = not na(sweep_low_val) or not na(sweep_high_val)
    c6 = bull_cont or bear_cont
    c7 = ob_fvg_bull_waiting or ob_fvg_bear_waiting
    score = (c1?1:0)+(c2?1:0)+(c3?1:0)+(c4?1:0)+(c5?1:0)

    sess_txt = in_asia ? "🌏 ASIA" : in_london ? "🇬🇧 LONDON" : in_ny ? "🇺🇸 NY" : "😴 OFF"

    table.cell(dash, 0, 0, "ICT EDIT v6 [" + timeframe.period + "m]",
        text_color = color.white, bgcolor = color.new(#0d1117, 20), text_size = size.small)
    table.cell(dash, 1, 0, sess_txt,
        text_color = color.white, bgcolor = color.new(#0d1117, 40), text_size = size.small)

    f_row(dash, c1, 1, "1. EQH/EQL (LTF + 1m)")
    f_row(dash, c2, 2, "2. Sweep liquidite")
    f_row(dash, c3, 3, "3. MSS + attente FVG")
    f_row(dash, c4, 4, "4. FVG LTF actif")
    f_row(dash, c5, 5, "5. SL reference")
    f_row(dash, c6, 6, "→ CONT EQH/EQL")
    f_row(dash, c7, 7, "→ CONT OB+FVG")

    htf_fvg_bull_active = array.size(fvg4h_hi) > 0 or array.size(fvgD_hi) > 0
    f_row(dash, htf_fvg_bull_active, 8, "FVG 4H/Daily actif")
    f_row(dash, in_htf_fvg_bull or in_htf_fvg_bear, 9, "Prix dans FVG HTF")

    daily_loaded = array.size(daily_highs) > 0
    f_row(dash, daily_loaded, 10, "Liq. Daily/Weekly chargee")

    f_row(dash, buy_signal or sell_signal or ob_fvg_bull_signal or ob_fvg_bear_signal, 11, "→ SIGNAL")

    rr_txt = trk_open ? "RR actif : " + str.tostring(trk_rr, "#.##") + "R"
                      : last_rejected ? "⚠️ Rejete RR < " + str.tostring(min_rr, "#.#") : "RR min : " + str.tostring(min_rr, "#.#") + "R"
    rr_bg  = trk_open ? color.new(color.teal, 50) : last_rejected ? color.new(color.orange, 40) : color.new(#1a1a2e, 20)
    table.cell(dash, 0, 12, rr_txt, text_color = color.white, bgcolor = rr_bg, text_size = size.small)
    table.cell(dash, 1, 12, trk_open ? "TP " + str.tostring(math.round(trk_tp)) : "—",
        text_color = color.white, bgcolor = color.new(#1a1a2e, 20), text_size = size.small)

    table.cell(dash, 0, 13,
        na(bull_structure) ? "📊 Indefinie" : bull_structure ? "📈 Haussiere" : "📉 Baissiere",
        text_color = color.white,
        bgcolor    = na(bull_structure) ? color.new(color.gray, 60) : bull_structure ? color.new(color.teal, 60) : color.new(color.red, 60),
        text_size  = size.small)
    table.cell(dash, 1, 13, ob_bull_valid ? "OB Bull ✅" : ob_bear_valid ? "OB Bear ✅" : "OB —",
        text_color = color.white,
        bgcolor    = ob_bull_valid ? color.new(color.teal, 60) : ob_bear_valid ? color.new(color.red, 60) : color.new(color.gray, 70),
        text_size  = size.small)

    table.cell(dash, 0, 14, trk_open ? "🔒 SLOT OCCUPE" : "🟢 SLOT LIBRE",
        text_color = color.white,
        bgcolor    = trk_open ? color.new(#f0c020, 40) : color.new(#00e676, 70),
        text_size  = size.small)
    table.cell(dash, 1, 14,
        trk_open ? (trk_long ? "▲ " + str.tostring(trk_entry) : "▼ " + str.tostring(trk_entry)) : "—",
        text_color = color.white, bgcolor = color.new(#1a1a2e, 20), text_size = size.small)

    table.cell(dash, 0, 15, trk_open ? "📐 " + trk_type : "—",
        text_color = color.white,
        bgcolor    = trk_open and trk_type == "OB_CONT" ? color.new(color.purple, 50) : color.new(#1a1a2e, 20),
        text_size  = size.small)
    table.cell(dash, 1, 15, trk_open ? "SL " + str.tostring(math.round(trk_sl)) : "—",
        text_color = color.white, bgcolor = color.new(#1a1a2e, 20), text_size = size.small)

    htf_ctx_live = trk_open and trk_htf_ctx != "" ? trk_htf_ctx : in_htf_fvg_bull ? "Dans FVG HTF Bull" : in_htf_fvg_bear ? "Dans FVG HTF Bear" : "—"
    table.cell(dash, 0, 16, "🏛 HTF: " + htf_ctx_live,
        text_color = in_htf_fvg_bull ? col_asia : in_htf_fvg_bear ? color.new(color.red, 0) : color.new(color.gray, 40),
        bgcolor    = color.new(#1a1a2e, 20), text_size = size.small)
    table.cell(dash, 1, 16, "", bgcolor = color.new(#1a1a2e, 20))

    sess_lvl = not na(asia_h) ? "Asia " + str.tostring(math.round(asia_l)) + "/" + str.tostring(math.round(asia_h)) : "Asia: -"
    pdh_txt  = not na(d_h0)  ? "PDH " + str.tostring(math.round(d_h0)) + " PDL " + str.tostring(math.round(d_l0)) : "PDH/PDL: -"
    table.cell(dash, 0, 17, pdh_txt,  text_color = col_daily,  bgcolor = color.new(#1a1a2e, 20), text_size = size.small)
    table.cell(dash, 1, 17, sess_lvl, text_color = col_asia,   bgcolor = color.new(#1a1a2e, 20), text_size = size.small)

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

// ── BE Manuel — compteur (incrémenter = libérer le slot une fois) ─────────
be_count = input.int(0, "🟡 BE Manuel — incrémenter pour libérer (0→1→2…)", group="Tracking", minval=0, step=1)
var int be_last = 0

// Tracking position ouverte pour détection automatique TP/SL/BE
var float trk_entry = na
var float trk_sl    = na
var float trk_tp    = na
var bool  trk_long  = false
var bool  trk_open  = false
var float trk_peak  = na   // meilleur prix atteint depuis l'entrée

// ── Clôture automatique (prioritaire sur tout nouveau signal) ──
new_be_req = be_count > be_last and barstate.islast
if trk_open
    trk_peak := trk_long ? (na(trk_peak) ? high : math.max(trk_peak, high))
                         : (na(trk_peak) ? low  : math.min(trk_peak, low))
    hit_tp   = trk_long ? high >= trk_tp : low  <= trk_tp
    hit_sl   = trk_long ? low  <= trk_sl : high >= trk_sl
    had_run  = trk_long ? trk_peak >= trk_entry + 5.0 : trk_peak <= trk_entry - 5.0
    hit_be   = new_be_req or (had_run and (trk_long ? close <= trk_entry : close >= trk_entry))
    if hit_tp
        alert('{"type":"close","result":"win","bot":"' + bot_name + '"}', alert.freq_once_per_bar_close)
        trk_open := false
        trk_peak := na
    else if hit_sl
        alert('{"type":"close","result":"loss","bot":"' + bot_name + '"}', alert.freq_once_per_bar_close)
        trk_open := false
        trk_peak := na
    else if hit_be
        alert('{"type":"close","result":"be","bot":"' + bot_name + '"}', alert.freq_once_per_bar_close)
        trk_open := false
        trk_peak := na
        if new_be_req
            be_last := be_count

// Consommer l'incrément si slot déjà libre
if not trk_open and new_be_req
    be_last := be_count

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
            <span style={{ color: '#3a2a2a', marginLeft: '4px' }}>(5 MNQ)</span>
          </div>
        </div>
        {/* TP unique */}
        {tp > 0 && (
          <div style={{ background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '6px', padding: '10px 14px' }}>
            <div style={{ fontSize: '9px', color: '#2a5a3a', letterSpacing: '2px', marginBottom: '4px' }}>🎯 TP  <span style={{ color: '#3a9a5a', fontSize: '8px', marginLeft: '4px' }}>R:R 1:2</span></div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#00ff88' }}>{tp.toFixed(2)}</div>
            <div style={{ fontSize: '10px', color: '#2a5a3a', marginTop: '2px' }}>
              {tpPts.toFixed(2)} pts · <span style={{ color: '#00ff88' }}>+${calcUsd(tpPts)}</span>
              <span style={{ color: '#2a5a3a', marginLeft: '4px' }}>(5 MNQ)</span>
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
function getBotScriptName(botId) {
  if (!botId) return null;
  if (botId === 'ICT_EDIT') return { name: 'ICT TEST', color: '#f07820' };
  const b = PINE_BOTS.find(x => x.botId === botId);
  return b ? { name: b.name, color: b.color } : null;
}

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
        <BSStatCard label="P&L NET (5 MNQ)"  value={fmtUsd(totalPnl, true)}         color={pnlColor(totalPnl)}           sub={`Pts: ${(totalPnl / MNQ_PTS_TO_USD >= 0 ? '+' : '') + (totalPnl / MNQ_PTS_TO_USD).toFixed(2)}`} />
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
          <BSSection title="🤖 P&L NET PAR BOT (5 MNQ)">
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
        <BSSection title="📊 P&L NET PAR DIRECTION (5 MNQ)">
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
        <BSSection title="⏰ P&L NET PAR SESSION KILL ZONE (5 MNQ)">
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
                {['HEURE', 'TF', 'BOT', 'SCRIPT', 'DIR', 'ENTRY', 'BE', 'SL', 'TP', 'R:R', 'PTS', 'P&L (5 MNQ)', 'SESSION KZ', 'RÉSULTAT'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listSignals.length === 0 && (
                <tr><td colSpan={14} style={{ padding: '24px', textAlign: 'center', color: '#2a4a30', fontSize: '12px' }}>Aucun signal</td></tr>
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
                    <td style={{ padding: '7px 6px' }}>
                      {(() => { const s = getBotScriptName(sig.bot); return s ? <span style={{ fontSize: '9px', color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}40`, padding: '2px 6px', borderRadius: '3px', fontWeight: '700', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{s.name}</span> : <span style={{ color: '#2a4a30' }}>—</span>; })()}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ color: isL ? '#00ff88' : '#ff4455', background: `rgba(${isL ? '0,255,136' : '255,68,85'},0.08)`, padding: '1px 5px', borderRadius: '3px', fontSize: '11px', fontWeight: '600' }}>{dir}</span>
                    </td>
                    <td style={{ padding: '7px 10px', color: '#8aaa90' }}>{parseFloat(sig.entry)?.toFixed(2) ?? '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#f0c020', fontVariantNumeric: 'tabular-nums' }}>{parseFloat(sig.entry) ? parseFloat(sig.entry).toFixed(2) : '—'}</td>
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
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [serverOk, setServerOk]   = useState(true);
  const [webhookLogs, setWebhookLogs] = useState([]);
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

    window.bot.getWebhookLogs().then(r => { if (r.ok) setWebhookLogs(r.data); });
    const onLog = (entry) => setWebhookLogs(prev => [entry, ...prev].slice(0, 50));

    window.bot.onSignal(onSignal);
    window.bot.onServerReady(onReady);
    window.bot.onServerError(onError);
    window.bot.onOutcomeUpdate(onOutcome);
    window.bot.onWebhookLog(onLog);
    return () => {
      window.bot.offSignal(onSignal);
      window.bot.offOutcomeUpdate(onOutcome);
      window.bot.offWebhookLog(onLog);
    };
  }, []);

  async function handleUpdateOutcome(id, current, outcome) {
    const next = outcome === 'skip' ? 'skip' : (current === outcome ? null : outcome);
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

  const [testStatus, setTestStatus] = useState(null); // null | 'ok' | 'err'

  async function handleTestWebhook() {
    setTestStatus(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot: 'ICT_5min', symbol: 'MNQ', signal: 'LONG',
          entry: 20000, sl: 19950, tp: 20100, rr: '1:2',
          context: 'TEST LOCAL', timeframe: '5'
        })
      });
      const data = await res.json();
      setTestStatus(data.ok ? 'ok' : 'err');
      if (data.ok) { setTab('signals'); setTimeout(() => setTestStatus(null), 4000); }
    } catch(e) {
      setTestStatus('err');
    }
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
  const latest           = signals[0] ?? null; // toujours le signal le plus récent, tous bots confondus
  const activePine       = PINE_BOTS.find(b => b.id === selectedPine) ?? PINE_BOTS[0];
  const activeSignals    = signals.filter(s => !s._outcome); // TOUS bots — aucune position ouverte cachée
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
                const bot      = PINE_BOTS.find(b => b.botId === bid);
                const c        = bid === 'TOUS' ? '#c8d8c8' : (bot?.color ?? '#aa88ff');
                const cnt      = bid === 'TOUS' ? signals.length : signals.filter(s => s.bot === bid).length;
                const activeCnt = bid === 'TOUS'
                  ? signals.filter(s => !s._outcome).length
                  : signals.filter(s => s.bot === bid && !s._outcome).length;
                const sel      = selectedBot === bid;
                return (
                  <button key={bid} onClick={() => setSelectedBot(bid)}
                    style={{ padding: '5px 14px', borderRadius: '4px', border: `1px solid ${sel ? c + '80' : 'rgba(0,255,136,0.1)'}`, background: sel ? `${c}15` : 'transparent', color: sel ? c : '#3a6a4a', fontSize: '11px', fontFamily: 'inherit', fontWeight: sel ? '700' : '400', cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '1px', position: 'relative' }}>
                    {bid} <span style={{ opacity: 0.6 }}>({cnt})</span>
                    {activeCnt > 0 && (
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#f0c020', color: '#1a1a00', fontSize: '8px', fontWeight: '900', borderRadius: '8px', padding: '0px 4px', minWidth: '14px', textAlign: 'center', lineHeight: '14px', animation: 'pulse 2s infinite' }}>{activeCnt}</span>
                    )}
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
                  { label: 'POINTS NET', value: `${st.totalPts >= 0 ? '+' : ''}${st.totalPts} pts`, sub: '5 MNQ', color: ptsColor },
                  { label: 'P&L NET', value: `${st.totalUsd >= 0 ? '+' : ''}$${st.totalUsd}`, sub: '5 × $2/pt', color: ptsColor },
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

              {/* DERNIER SIGNAL — affiché uniquement quand aucun slot actif (évite le double affichage) */}
              {activeSignals.length === 0 && latest && (
                <div>
                  <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>DERNIER SIGNAL</div>
                  <SignalCard signal={latest} onSave={saving ? null : handleSaveSignal} isLatest={true} />
                </div>
              )}

              {/* ── SLOTS EN COURS — cartes de position ── */}
              {activeSignals.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f0c020', boxShadow: '0 0 6px #f0c020', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: '#f0c020', letterSpacing: '2px', fontWeight: '700' }}>SLOTS EN COURS</span>
                    <span style={{ fontSize: '10px', background: 'rgba(240,192,32,0.12)', border: '1px solid rgba(240,192,32,0.3)', color: '#f0c020', padding: '1px 8px', borderRadius: '10px', fontWeight: '700' }}>{activeSignals.length}</span>
                    <span style={{ fontSize: '10px', color: '#3a5a3a' }}>— BE manuel ou auto (retour entrée) libère le slot TradingView</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeSignals.map((sig, i) => {
                      const dir      = (sig.signal ?? sig.direction ?? '').toUpperCase();
                      const isL      = dir === 'LONG';
                      const dirColor = isL ? '#00ff88' : '#ff4455';
                      const dirRgb   = isL ? '0,255,136' : '255,68,85';
                      const entry    = parseFloat(sig.entry) || 0;
                      const sl       = parseFloat(sig.sl) || 0;
                      const tp       = parseFloat(sig.tp) || parseFloat(sig.tp2) || parseFloat(sig.tp1) || 0;
                      const tf       = fmtTf(sig.timeframe);
                      const botMeta  = PINE_BOTS.find(b => b.botId === sig.bot);
                      const botColor = botMeta?.color ?? '#aa88ff';
                      const slPts    = entry && sl ? Math.abs(entry - sl).toFixed(2) : null;
                      const tpPts    = entry && tp ? Math.abs(tp - entry).toFixed(2) : null;
                      return (
                        <div key={sig._id ?? i} style={{ background: `rgba(${dirRgb},0.04)`, border: `1px solid rgba(${dirRgb},0.15)`, borderLeft: `3px solid ${dirColor}`, borderRadius: '7px', padding: '12px 16px' }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: dirColor, letterSpacing: '1px' }}>{isL ? '▲' : '▼'} {dir}</div>
                            {sig.bot && <span style={{ fontSize: '9px', color: botColor, background: `${botColor}15`, border: `1px solid ${botColor}40`, padding: '1px 6px', borderRadius: '3px', fontWeight: '700' }}>{sig.bot}</span>}
                            {tf && <span style={{ fontSize: '9px', color: '#b09020', background: 'rgba(240,192,32,0.1)', border: '1px solid rgba(240,192,32,0.25)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>{tf}</span>}
                            {sig.type === 'test' && <span style={{ fontSize: '8px', background: 'rgba(240,120,32,0.15)', border: '1px solid rgba(240,120,32,0.4)', color: '#f07820', padding: '1px 4px', borderRadius: '2px', fontWeight: '700' }}>TEST</span>}
                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#4a7a5a' }}>{fmtTime(sig._receivedAt)}</span>
                          </div>
                          {/* Niveaux */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                            <div style={{ background: 'rgba(10,28,18,0.5)', borderRadius: '5px', padding: '7px 10px' }}>
                              <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1px', marginBottom: '2px' }}>📍 ENTRÉE</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8f8e8' }}>{entry.toFixed(2)}</div>
                            </div>
                            <div style={{ background: 'rgba(255,68,85,0.06)', borderRadius: '5px', padding: '7px 10px' }}>
                              <div style={{ fontSize: '9px', color: '#5a2a2a', letterSpacing: '1px', marginBottom: '2px' }}>🛑 SL {slPts && <span style={{ color: '#3a2a2a' }}>−{slPts}pts</span>}</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#ff7788' }}>{sl ? sl.toFixed(2) : '—'}</div>
                            </div>
                            <div style={{ background: `rgba(${dirRgb},0.05)`, borderRadius: '5px', padding: '7px 10px' }}>
                              <div style={{ fontSize: '9px', color: '#2a5a3a', letterSpacing: '1px', marginBottom: '2px' }}>🎯 TP {tpPts && <span style={{ color: '#2a5a3a' }}>+{tpPts}pts</span>}</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#00ff88' }}>{tp ? tp.toFixed(2) : '—'}</div>
                            </div>
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#3a5a3a', marginRight: '2px' }}>Clôturer :</span>
                            {[['win','✓ WIN','#00ff88'],['loss','✗ LOSS','#ff4455'],['be','— BE','#f0c020']].map(([key, label, c]) => (
                              <button key={key} onClick={() => handleUpdateOutcome(sig._id, sig._outcome, key)}
                                style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${c}60`, background: `${c}15`, color: c, fontSize: '11px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', transition: 'all 0.12s', letterSpacing: '0.5px' }}
                                onMouseEnter={e => e.currentTarget.style.background = `${c}25`}
                                onMouseLeave={e => e.currentTarget.style.background = `${c}15`}
                              >{label}</button>
                            ))}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                              <button onClick={() => handleSaveSignal(sig)} title="Sauvegarder dans le journal"
                                style={{ padding: '4px 10px', background: 'none', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '4px', color: '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.borderColor = 'rgba(0,255,136,0.15)'; }}
                              >+ Journal</button>
                              <button onClick={() => { if (window.confirm('Ignorer ce signal ?')) handleUpdateOutcome(sig._id, sig._outcome, 'skip'); }} title="Ignorer — sortie non comptabilisée"
                                style={{ padding: '4px 8px', background: 'none', border: '1px solid rgba(100,100,100,0.15)', borderRadius: '4px', color: '#3a3a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = 'rgba(100,100,100,0.35)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.borderColor = 'rgba(100,100,100,0.15)'; }}
                              >✕</button>
                            </div>
                          </div>
                          {sig.context && <div style={{ marginTop: '6px', fontSize: '10px', color: '#3a6a4a', fontStyle: 'italic' }}>{sig.context}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '10px', color: '#2a4a30', lineHeight: '1.6' }}>
                    💡 <strong style={{ color: '#f0c020' }}>BE = Break Even</strong> — libère le slot dans le dashboard. Sur TradingView, cocher "🟡 Clôturer en BE" dans les settings du script OU attendre le retour auto au prix d'entrée (≥5pts de profit puis retour).
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

          {/* ── DIAGNOSTIQUE RAPIDE ── */}
          <div style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '8px', padding: '16px 20px' }}>
            <div style={{ fontSize: '10px', color: '#00ff88', letterSpacing: '2px', marginBottom: '14px', fontWeight: '700' }}>🔍 DIAGNOSTIQUE RAPIDE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              {/* Serveur local */}
              <div style={{ background: serverOk ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,85,0.06)', border: `1px solid ${serverOk ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,85,0.2)'}`, borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>SERVEUR LOCAL</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: serverOk ? '#00ff88' : '#ff4455', boxShadow: serverOk ? '0 0 6px #00ff88' : '0 0 6px #ff4455' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: serverOk ? '#00ff88' : '#ff4455' }}>{serverOk ? 'ACTIF' : 'ERREUR'}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '4px' }}>Port {port}</div>
              </div>
              {/* Test local */}
              <div style={{ background: testStatus === 'ok' ? 'rgba(0,255,136,0.06)' : testStatus === 'err' ? 'rgba(255,68,85,0.06)' : 'rgba(10,28,18,0.3)', border: `1px solid ${testStatus === 'ok' ? 'rgba(0,255,136,0.2)' : testStatus === 'err' ? 'rgba(255,68,85,0.2)' : 'rgba(0,255,136,0.08)'}`, borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>TEST LOCAL</div>
                {testStatus === 'ok' && <div style={{ fontSize: '11px', color: '#00ff88', fontWeight: '700' }}>✓ Signal reçu !</div>}
                {testStatus === 'err' && <div style={{ fontSize: '11px', color: '#ff4455', fontWeight: '700' }}>✗ Serveur KO</div>}
                {testStatus === null && <div style={{ fontSize: '10px', color: '#3a6a4a' }}>Envoi direct localhost</div>}
                <button onClick={handleTestWebhook} style={{ marginTop: '6px', padding: '4px 10px', background: 'transparent', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '4px', color: '#00aa55', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >TESTER →</button>
              </div>
              {/* Signaux reçus */}
              <div style={{ background: 'rgba(10,28,18,0.3)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>SIGNAUX REÇUS</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: signals.length > 0 ? '#00ff88' : '#3a6a4a' }}>{signals.length}</div>
                <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '2px' }}>
                  {signals.length > 0 ? `dernier : ${fmtTime(signals[0]?._receivedAt)}` : 'aucun signal reçu'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#3a5a3a', lineHeight: '1.7', background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: '5px' }}>
              <strong style={{ color: '#f0c020' }}>Alertes non reçues ?</strong> Vérifie dans l'ordre :<br/>
              <span style={{ color: '#c8d8c8' }}>① Clique TESTER</span> — si ça fonctionne, le serveur local est OK → le problème est <strong style={{ color: '#f0c020' }}>ngrok ou TradingView</strong><br/>
              <span style={{ color: '#c8d8c8' }}>② Vérifie que ngrok tourne</span> avec la bonne URL dans l'alerte TradingView<br/>
              <span style={{ color: '#c8d8c8' }}>③ Dans TradingView → Alerte</span> : condition = <strong style={{ color: '#00ff88' }}>"Alert() function calls only"</strong>, message = <strong style={{ color: '#00ff88' }}>vide</strong>
            </div>
          </div>

          {/* ── LOG WEBHOOK EN TEMPS RÉEL ── */}
          <div style={{ background: 'rgba(4,12,8,0.8)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '8px', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: '#00ff88', letterSpacing: '2px', fontWeight: '700' }}>📡 LOG WEBHOOK — TEMPS RÉEL</div>
              <span style={{ fontSize: '10px', color: '#3a6a4a' }}>{webhookLogs.length} requête{webhookLogs.length > 1 ? 's' : ''}</span>
              {webhookLogs.length > 0 && (
                <button onClick={() => setWebhookLogs([])} style={{ marginLeft: 'auto', fontSize: '9px', padding: '1px 7px', background: 'transparent', border: '1px solid rgba(255,68,85,0.2)', borderRadius: '3px', color: '#4a2a2a', cursor: 'pointer', fontFamily: 'inherit' }}>EFFACER</button>
              )}
            </div>
            {webhookLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: '#2a4a30' }}>
                Aucune requête reçue — les alertes TradingView apparaîtront ici en temps réel
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '220px', overflowY: 'auto' }}>
                {webhookLogs.map((log, i) => {
                  const typeColor = log.status === 400 ? '#ff4455' : log.type === 'signal' ? '#00ff88' : log.type === 'close' ? '#00aaff' : '#3a6a4a';
                  const typeBg = log.status === 400 ? 'rgba(255,68,85,0.08)' : log.type === 'signal' ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.4)';
                  const time = log.ts ? new Date(log.ts).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 8px', background: typeBg, borderRadius: '4px', borderLeft: `2px solid ${typeColor}` }}>
                      <span style={{ fontSize: '9px', color: '#3a6a4a', minWidth: '50px', fontFamily: 'monospace' }}>{time}</span>
                      <span style={{ fontSize: '9px', background: `${typeColor}20`, color: typeColor, padding: '0px 5px', borderRadius: '2px', fontWeight: '700', minWidth: '45px', textAlign: 'center' }}>{log.status}</span>
                      <span style={{ fontSize: '10px', color: log.status === 400 ? '#ff7766' : '#8aaa90', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.label}</span>
                      <span style={{ fontSize: '9px', color: '#2a4a30', fontFamily: 'monospace' }}>{log.from?.replace('::ffff:', '') ?? ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#2a5a3a', lineHeight: '1.6' }}>
              Si les alertes TradingView <strong style={{ color: '#c8d8c8' }}>n'apparaissent pas ici</strong> mais que le test local fonctionne → <strong style={{ color: '#f0c020' }}>ngrok n'est plus actif ou l'URL a changé.</strong> Relance ngrok et mets à jour l'URL dans TradingView.
            </div>
          </div>

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#5a8a6a', lineHeight: '1.7' }}>
                  <div>1. Dans TradingView, ajoute le <strong style={{ color: '#c8d8c8' }}>Pine Script</strong> (onglet PINE SCRIPT) sur la chart MNQ1! au bon TF</div>
                  <div>2. Clique l'icône <strong style={{ color: '#c8d8c8' }}>Horloge ⏰ → Créer une Alerte</strong></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,68,85,0.05)', border: '1px solid rgba(255,68,85,0.15)', borderRadius: '5px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#ff6644', fontWeight: '700', letterSpacing: '1px' }}>⚠ RÉGLAGES CRITIQUES</div>
                    <div>• Condition : <code style={{ color: '#00ff88', background: 'rgba(0,255,136,0.1)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>Alert() function calls only</code></div>
                    <div>• Message : <code style={{ color: '#00ff88', background: 'rgba(0,255,136,0.1)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>laisser VIDE</code> — le script envoie son propre JSON</div>
                    <div>• Webhook URL : <code style={{ color: '#f0c020', background: 'rgba(240,192,32,0.1)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>https://TON_URL_NGROK/webhook</code></div>
                  </div>
                  <div style={{ color: '#2a5a3a', fontSize: '10px' }}>→ Si "Alert() function calls only" n'est pas sélectionné, TradingView envoie le champ Message (vide ou texte) au lieu du JSON du script → 400 Bad Request</div>
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
                <div>→ BE auto si retour à l'entrée · BE manuel via settings Pine</div>
              </div>
              <div style={{ marginTop: '8px', background: 'rgba(255,68,85,0.06)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: '5px', padding: '8px 12px', fontSize: '10px', color: '#7a4a3a', lineHeight: '1.7' }}>
                <strong style={{ color: '#ff6644' }}>⚠ Alertes ICT EDIT non reçues ?</strong><br/>
                Les signaux ne se déclenchent que si <strong style={{ color: '#c8d8c8' }}>toutes les conditions s'alignent</strong> : EQH/EQL présent → Sweep → MSS → FVG actif → prix dans le FVG. Vérifier le tableau de bord sur la chart TradingView (5 ✅).<br/>
                Alerte TradingView : condition = <strong style={{ color: '#00ff88' }}>"Alert() function calls only"</strong>, message = <strong style={{ color: '#00ff88' }}>vide</strong>.
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
