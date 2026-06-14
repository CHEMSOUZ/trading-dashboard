import { useEffect, useRef } from 'react';
import { createChart, createSeriesMarkers } from 'lightweight-charts';

export default function NQChart({ candles, zones, label }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !candles?.length) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: '#0a0e14' },
        textColor: '#8899bb',
      },
      grid: {
        vertLines: { color: 'rgba(136,153,187,0.06)' },
        horzLines: { color: 'rgba(136,153,187,0.06)' },
      },
      timeScale: {
        borderColor: 'rgba(136,153,187,0.15)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(136,153,187,0.15)',
      },
      crosshair: { mode: 1 },
    });

    const series = chart.addCandlestickSeries({
      upColor:       '#26a69a',
      downColor:     '#ef5350',
      borderVisible: false,
      wickUpColor:   '#26a69a',
      wickDownColor: '#ef5350',
    });

    const sorted = [...candles].sort((a, b) => a.ts - b.ts);
    series.setData(sorted.map(c => ({
      time:  c.ts,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    })));

    // FVG price lines (two lines per FVG — high and low)
    for (const fvg of zones?.fvgs ?? []) {
      const color = fvg.type === 'bullish' ? 'rgba(38,166,154,0.75)' : 'rgba(239,83,80,0.75)';
      const tag   = fvg.type === 'bullish' ? 'FVG▲' : 'FVG▼';
      series.createPriceLine({ price: fvg.high, color, lineWidth: 1, lineStyle: 3, title: `${tag} H`, axisLabelVisible: false });
      series.createPriceLine({ price: fvg.low,  color, lineWidth: 1, lineStyle: 3, title: `${tag} L`, axisLabelVisible: false });
    }

    // Liquidity price lines
    for (const l of zones?.liquidity ?? []) {
      const color = l.type === 'BSL' ? '#26a69a' : '#ef5350';
      series.createPriceLine({ price: l.price, color, lineWidth: 2, lineStyle: 2, title: l.label ?? l.type });
    }

    // Swing markers via createSeriesMarkers (v5 API)
    const swings = zones?.swings ?? [];
    if (swings.length > 0) {
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

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 320);
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [candles, zones]);

  if (!candles?.length) return null;

  return (
    <div style={{ marginBottom: '24px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(136,153,187,0.12)', background: '#0a0e14' }}>
      <div style={{ padding: '8px 14px', fontSize: '10px', color: '#3a4a5a', letterSpacing: '1px', borderBottom: '1px solid rgba(136,153,187,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>NQ FUTURES · {label ?? 'ICT ZONES'}</span>
        <span style={{ display: 'flex', gap: '14px' }}>
          <span>FVG <span style={{ color: 'rgba(38,166,154,0.75)' }}>▲</span><span style={{ color: 'rgba(239,83,80,0.75)' }}>▼</span></span>
          <span>BSL <span style={{ color: '#26a69a' }}>━</span></span>
          <span>SSL <span style={{ color: '#ef5350' }}>━</span></span>
          <span style={{ color: '#3a4a5a' }}>{candles.length} bougies</span>
        </span>
      </div>
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}
