import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';

const TF_LIST = [
  { tf: '1m',  label: 'M1'  },
  { tf: '5m',  label: 'M5'  },
  { tf: '15m', label: 'M15' },
  { tf: '30m', label: 'M30' },
  { tf: '1h',  label: 'H1'  },
  { tf: '4h',  label: 'H4'  },
  { tf: '1d',  label: 'D1'  },
];

function buildChart(container, candles, zones, isDefaultTf) {
  const chart = createChart(container, {
    width:  container.clientWidth,
    height: 340,
    layout: {
      background: { color: '#0a0e14' },
      textColor:  '#8899bb',
    },
    grid: {
      vertLines: { color: 'rgba(136,153,187,0.06)' },
      horzLines: { color: 'rgba(136,153,187,0.06)' },
    },
    localization: {
      locale: 'fr-FR',
      timeFormatter: (ts) => {
        const d = new Date(ts * 1000);
        return d.toLocaleString('fr-FR', {
          timeZone: 'Europe/Paris',
          day: '2-digit', month: '2-digit',
          hour: '2-digit', minute: '2-digit',
          hour12: false,
        });
      },
    },
    timeScale: {
      borderColor: 'rgba(136,153,187,0.15)',
      timeVisible: true,
      tickMarkFormatter: (ts, tickMarkType) => {
        const d = new Date(ts * 1000);
        const tz = 'Europe/Paris';
        if (tickMarkType === 0) return d.toLocaleDateString('fr-FR', { timeZone: tz, year: 'numeric' });
        if (tickMarkType === 1) return d.toLocaleDateString('fr-FR', { timeZone: tz, month: 'short', year: 'numeric' });
        if (tickMarkType === 2) return d.toLocaleDateString('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit' });
        return d.toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      },
    },
    rightPriceScale: {
      borderColor: 'rgba(136,153,187,0.15)',
    },
    crosshair: { mode: 1 },
  });

  const series = chart.addSeries(CandlestickSeries, {
    upColor:       '#26a69a',
    downColor:     '#ef5350',
    borderVisible: false,
    wickUpColor:   '#26a69a',
    wickDownColor: '#ef5350',
  });

  const sorted = [...candles]
    .filter(c => c.ts != null && c.open != null && c.high != null && c.low != null && c.close != null)
    .sort((a, b) => a.ts - b.ts);

  series.setData(sorted.map(c => ({
    time:  c.ts,
    open:  Number(c.open),
    high:  Number(c.high),
    low:   Number(c.low),
    close: Number(c.close),
  })));


  // Key levels — drawn as LineSeries starting from the origin candle
  const LEVEL_STYLE = {
    PWH: { color: '#ff6b6b', lineWidth: 2, lineStyle: 0 },
    PWL: { color: '#51cf66', lineWidth: 2, lineStyle: 0 },
    PDH: { color: '#ffa94d', lineWidth: 1, lineStyle: 2 },
    PDL: { color: '#a9e34b', lineWidth: 1, lineStyle: 2 },
    BSL: { color: '#26a69a', lineWidth: 2, lineStyle: 2 },
    SSL: { color: '#ef5350', lineWidth: 2, lineStyle: 2 },
    EQH: { color: '#ff6b6b', lineWidth: 1, lineStyle: 1 },
    EQL: { color: '#51cf66', lineWidth: 1, lineStyle: 1 },
  };
  const firstTs = sorted[0]?.ts;
  const lastTs  = sorted[sorted.length - 1]?.ts;
  for (const l of zones?.liquidity ?? []) {
    if (!l.price || !firstTs || !lastTs) continue;
    const s = LEVEL_STYLE[l.type] ?? { color: '#8899bb', lineWidth: 1, lineStyle: 2 };
    const startTs = (l.ts && l.ts >= firstTs) ? l.ts : firstTs;
    const lvl = chart.addSeries(LineSeries, {
      color: s.color,
      lineWidth: s.lineWidth,
      lineStyle: s.lineStyle,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: l.label ?? l.type,
    });
    lvl.setData([
      { time: startTs, value: Number(l.price) },
      { time: lastTs,  value: Number(l.price) },
    ]);
  }

  // Swing markers — only shown on the original TF (idx is TF-dependent)
  if (isDefaultTf) {
    const swings = zones?.swings ?? [];
    if (swings.length > 0 && sorted.length > 0) {
      const markers = swings
        .map(sw => {
          const candle = sorted[sw.idx] ?? sorted[sorted.length - 1];
          if (!candle) return null;
          return {
            time:     candle.ts,
            position: sw.type === 'high' ? 'aboveBar' : 'belowBar',
            color:    sw.type === 'high' ? '#ef5350'  : '#26a69a',
            shape:    sw.type === 'high' ? 'arrowDown' : 'arrowUp',
            text:     sw.label ?? (sw.type === 'high' ? 'SSH' : 'SSL'),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);
      try { createSeriesMarkers(series, markers); } catch(_) {}
    }
  }

  chart.timeScale().fitContent();
  return chart;
}

export default function NQChart({ candles, zones, label, defaultTf, dateRange, symbol, yahooSym }) {
  const containerRef                 = useRef(null);
  const chartRef                     = useRef(null);
  const [activeTf, setActiveTf]      = useState(defaultTf ?? '15m');
  const [displayCandles, setDisplay] = useState(candles ?? []);
  const [loading, setLoading]        = useState(false);

  // Rebuild chart whenever displayCandles or zones change
  useEffect(() => {
    if (!containerRef.current || !displayCandles?.length) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    chartRef.current = buildChart(
      containerRef.current,
      displayCandles,
      zones,
      activeTf === (defaultTf ?? '15m'),
    );

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(containerRef.current.clientWidth, 340);
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCandles, zones]);

  // On TF change: fetch new candles if range is known, else keep stored
  const switchTf = useCallback(async (tf) => {
    if (tf === activeTf) return;
    setActiveTf(tf);
    if (tf === (defaultTf ?? '15m') && candles?.length) {
      setDisplay(candles);
      return;
    }
    if (!dateRange?.from || !window.market?.getCandles) return;
    setLoading(true);
    try {
      const res = await window.market.getCandles(dateRange.from, dateRange.to, tf, yahooSym);
      if (res.ok && res.data?.length) setDisplay(res.data);
    } catch(_) {}
    setLoading(false);
  }, [activeTf, defaultTf, candles, dateRange]);

  if (!candles?.length) return null;

  return (
    <div style={{ marginBottom: '24px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(136,153,187,0.12)', background: '#0a0e14' }}>
      {/* Header */}
      <div style={{ padding: '8px 14px', fontSize: '10px', color: '#3a4a5a', letterSpacing: '1px', borderBottom: '1px solid rgba(136,153,187,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ color: '#5a6a82' }}>{symbol ?? 'MNQ'}! · {label ?? 'ICT ZONES'}</span>

        {/* TF selector */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {loading && <span style={{ fontSize: '9px', color: '#3a4a5a', marginRight: '6px' }}>chargement…</span>}
          {TF_LIST.map(({ tf, label: tlabel }) => {
            const isActive = tf === activeTf;
            const isDefault = tf === (defaultTf ?? '15m');
            return (
              <button key={tf} onClick={() => switchTf(tf)}
                style={{
                  padding: '3px 7px',
                  background:   isActive ? 'rgba(136,153,187,0.15)' : 'transparent',
                  border:       isActive ? '1px solid rgba(136,153,187,0.35)' : '1px solid transparent',
                  borderRadius: '4px',
                  color:        isActive ? '#8899bb' : isDefault ? '#5a6a82' : '#3a4a5a',
                  fontSize:     '10px',
                  fontFamily:   'inherit',
                  cursor:       'pointer',
                  fontWeight:   isActive ? '700' : '400',
                  letterSpacing: '0.5px',
                }}>
                {tlabel}
              </button>
            );
          })}

          {/* Legend */}
          <span style={{ marginLeft: '8px', display: 'flex', gap: '8px', borderLeft: '1px solid rgba(136,153,187,0.10)', paddingLeft: '10px', flexWrap: 'wrap' }}>
            <span>BSL <span style={{ color: '#26a69a' }}>╌</span></span>
            <span>SSL <span style={{ color: '#ef5350' }}>╌</span></span>
            <span>EQH <span style={{ color: '#ff6b6b' }}>╌</span></span>
            <span>EQL <span style={{ color: '#51cf66' }}>╌</span></span>
            <span>PWH <span style={{ color: '#ff6b6b' }}>━</span></span>
            <span>PWL <span style={{ color: '#51cf66' }}>━</span></span>
            <span>PDH <span style={{ color: '#ffa94d' }}>╌</span></span>
            <span>PDL <span style={{ color: '#a9e34b' }}>╌</span></span>
            <span style={{ color: '#3a4a5a' }}>{displayCandles.length} bougies</span>
          </span>
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}
