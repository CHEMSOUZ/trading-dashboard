import { useState, useEffect, useCallback, useRef } from 'react';

const FINNHUB_KEY = 'd88v60hr01qs9ff6b430d88v60hr01qs9ff6b43g';

// ── Constants ─────────────────────────────────────────────────
const IMPACT_CONFIG = {
  high:   { label: 'FORT',   color: '#ff4455', bg: 'rgba(255,68,85,0.12)',  border: 'rgba(255,68,85,0.35)',  dot: '#ff4455' },
  medium: { label: 'MOYEN',  color: '#f0a020', bg: 'rgba(240,160,32,0.10)', border: 'rgba(240,160,32,0.30)', dot: '#f0a020' },
  low:    { label: 'FAIBLE', color: '#3a6a4a', bg: 'rgba(0,255,136,0.04)',  border: 'rgba(0,255,136,0.08)',  dot: '#3a6a4a' },
  na:     { label: '—',      color: '#2a4a30', bg: 'rgba(10,28,18,0.3)',    border: 'rgba(0,255,136,0.04)',  dot: '#2a4a30' },
};

const CURRENCY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CAD: '🇨🇦',
  AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭', CNY: '🇨🇳', SEK: '🇸🇪',
  NOK: '🇳🇴', DKK: '🇩🇰', MXN: '🇲🇽', SGD: '🇸🇬', HKD: '🇭🇰',
  KRW: '🇰🇷', INR: '🇮🇳', BRL: '🇧🇷', ZAR: '🇿🇦', TRY: '🇹🇷',
  PLN: '🇵🇱', CZK: '🇨🇿', HUF: '🇭🇺', RUB: '🇷🇺', IDR: '🇮🇩',
};

// ── Timezones ─────────────────────────────────────────────────
const TIMEZONES = [
  { key: 'America/New_York',    label: 'New York',    abbr: 'ET',  flag: '🇺🇸' },
  { key: 'America/Chicago',     label: 'Chicago',     abbr: 'CT',  flag: '🇺🇸' },
  { key: 'America/Denver',      label: 'Denver',      abbr: 'MT',  flag: '🇺🇸' },
  { key: 'America/Los_Angeles', label: 'Los Angeles', abbr: 'PT',  flag: '🇺🇸' },
  { key: 'Europe/London',       label: 'Londres',     abbr: 'GMT', flag: '🇬🇧' },
  { key: 'Europe/Paris',        label: 'Paris',       abbr: 'CET', flag: '🇫🇷' },
  { key: 'Europe/Zurich',       label: 'Zurich',      abbr: 'CET', flag: '🇨🇭' },
  { key: 'Asia/Tokyo',          label: 'Tokyo',       abbr: 'JST', flag: '🇯🇵' },
  { key: 'Asia/Hong_Kong',      label: 'Hong Kong',   abbr: 'HKT', flag: '🇭🇰' },
  { key: 'Asia/Singapore',      label: 'Singapore',   abbr: 'SGT', flag: '🇸🇬' },
  { key: 'Australia/Sydney',    label: 'Sydney',      abbr: 'AEDT',flag: '🇦🇺' },
  { key: 'UTC',                 label: 'UTC',         abbr: 'UTC', flag: '🌐' },
];

const DEFAULT_TZ = 'America/New_York';

function getStoredTz() {
  try { return localStorage.getItem('eco_calendar_tz') || DEFAULT_TZ; } catch { return DEFAULT_TZ; }
}
function storeTz(tz) {
  try { localStorage.setItem('eco_calendar_tz', tz); } catch {}
}

function getImpact(event) {
  const imp = (event.impact ?? '').toLowerCase();
  if (imp === 'high' || imp === '3' || imp === 'high impact') return 'high';
  if (imp === 'medium' || imp === '2' || imp === 'moderate')  return 'medium';
  if (imp === 'low'  || imp === '1')                          return 'low';
  return 'na';
}

function formatTime(dateStr, tz = DEFAULT_TZ) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch { return '—'; }
}

function formatDate(dateStr, tz = DEFAULT_TZ) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
  } catch { return '—'; }
}

function formatValue(val, unit) {
  if (val == null || val === '') return '—';
  const u = unit ?? '';
  return `${val}${u}`;
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isPast(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isUpcoming(dateStr, minutesWindow = 30) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (d - now) / 60000;
  return diff >= 0 && diff <= minutesWindow;
}

// ── Date range helpers ────────────────────────────────────────
function getDateRange(mode) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if (mode === 'today') {
    return { from: fmt(now), to: fmt(now) };
  }
  if (mode === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (mode === 'next7') {
    const end = new Date(now); end.setDate(now.getDate() + 7);
    return { from: fmt(now), to: fmt(end) };
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmt(start), to: fmt(end) };
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '60px 0', color: '#3a6a4a', fontSize: '12px', letterSpacing: '2px' }}>
      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(0,255,136,0.2)', borderTop: '2px solid #00ff88', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      CHARGEMENT...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Impact dots ───────────────────────────────────────────────
function ImpactBadge({ impact }) {
  const cfg = IMPACT_CONFIG[impact] ?? IMPACT_CONFIG.na;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {['high','medium','low'].map((lvl, i) => (
        <div key={lvl} style={{ width: '8px', height: '8px', borderRadius: '50%', background: impact === 'high' && i <= 2 ? '#ff4455' : impact === 'medium' && i <= 1 ? '#f0a020' : impact === 'low' && i === 0 ? '#3a8a4a' : 'rgba(0,255,136,0.1)', transition: 'all 0.2s' }} />
      ))}
    </div>
  );
}

// ── Value delta indicator ─────────────────────────────────────
function ValueDelta({ actual, estimate }) {
  if (actual == null || estimate == null || actual === '' || estimate === '') return null;
  const a = parseFloat(String(actual).replace('%','').replace('K','000').replace('M','000000'));
  const e = parseFloat(String(estimate).replace('%','').replace('K','000').replace('M','000000'));
  if (isNaN(a) || isNaN(e)) return null;
  const better = a > e;
  return (
    <span style={{ fontSize: '10px', marginLeft: '4px', color: better ? '#00ff88' : '#ff4455' }}>
      {better ? '▲' : '▼'}
    </span>
  );
}

// ── Countdown ────────────────────────────────────────────────
function Countdown({ dateStr }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function update() {
      const diff = new Date(dateStr) - new Date();
      if (diff <= 0) { setLabel(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setLabel(`dans ${h}h${pad(m)}`);
      else if (m > 0) setLabel(`dans ${m}m${pad(s)}s`);
      else setLabel(`dans ${s}s`);
    }
    function pad(n) { return String(n).padStart(2,'0'); }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [dateStr]);
  if (!label) return null;
  return <span style={{ fontSize: '10px', color: '#f0a020', fontWeight: '700', letterSpacing: '0.5px' }}>{label}</span>;
}

// ── Event Row ─────────────────────────────────────────────────
function EventRow({ event, isGroupFirst, showDate, tz = DEFAULT_TZ }) {
  const [expanded, setExpanded] = useState(false);
  const impact = getImpact(event);
  const cfg    = IMPACT_CONFIG[impact];
  const past   = isPast(event.time ?? event.date);
  const upcoming30 = isUpcoming(event.time ?? event.date, 30);
  const hasActual  = event.actual != null && event.actual !== '';

  return (
    <>
      {isGroupFirst && showDate && (
        <div style={{ padding: '10px 16px 4px', fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(0,255,136,0.04)' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#3a6a4a' }} />
          {formatDate(event.time ?? event.date, tz).toUpperCase()}
          {isToday(event.time ?? event.date) && <span style={{ color: '#00ff88', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }}>AUJOURD'HUI</span>}
        </div>
      )}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '52px 52px 36px 1fr 90px 90px 90px 16px',
          gap: '8px',
          alignItems: 'center',
          padding: '10px 16px',
          background: upcoming30
            ? 'rgba(240,160,32,0.07)'
            : hasActual
            ? 'rgba(10,28,18,0.5)'
            : past
            ? 'rgba(10,28,18,0.25)'
            : 'rgba(10,28,18,0.4)',
          borderLeft: `3px solid ${upcoming30 ? '#f0a020' : cfg.dot}`,
          cursor: 'pointer',
          transition: 'background 0.12s',
          opacity: past && !hasActual ? 0.55 : 1,
          borderBottom: '1px solid rgba(0,255,136,0.03)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = upcoming30 ? 'rgba(240,160,32,0.07)' : hasActual ? 'rgba(10,28,18,0.5)' : past ? 'rgba(10,28,18,0.25)' : 'rgba(10,28,18,0.4)'}
      >
        {/* Time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '12px', color: upcoming30 ? '#f0a020' : '#8aaa90', fontWeight: upcoming30 ? '700' : '400', letterSpacing: '0.5px' }}>
            {formatTime(event.time ?? event.date, tz)}
          </span>
          {upcoming30 && <Countdown dateStr={event.time ?? event.date} />}
        </div>

        {/* Currency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '13px' }}>{CURRENCY_FLAGS[event.country] ?? '🌐'}</span>
          <span style={{ fontSize: '11px', color: '#6a8a7a', fontWeight: '600' }}>{event.country ?? '—'}</span>
        </div>

        {/* Impact */}
        <ImpactBadge impact={impact} />

        {/* Event name */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: past ? '#6a8a7a' : '#e8f8e8', fontWeight: impact === 'high' ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.event ?? event.name ?? '—'}
          </div>
          {upcoming30 && (
            <div style={{ fontSize: '10px', color: '#f0a020', marginTop: '2px', letterSpacing: '1px' }}>⚡ IMMINENTE</div>
          )}
        </div>

        {/* Précédent */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px', marginBottom: '2px' }}>PRÉC.</div>
          <div style={{ fontSize: '12px', color: '#4a7a5a' }}>{formatValue(event.prev, event.unit)}</div>
        </div>

        {/* Estimé */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px', marginBottom: '2px' }}>ESTIMÉ</div>
          <div style={{ fontSize: '12px', color: '#8aaa90' }}>{formatValue(event.estimate, event.unit)}</div>
        </div>

        {/* Réel */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1px', marginBottom: '2px' }}>RÉEL</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: hasActual ? '700' : '400', color: hasActual ? (parseFloat(String(event.actual)) >= parseFloat(String(event.estimate ?? event.prev ?? 0)) ? '#00ff88' : '#ff4455') : '#2a4a30' }}>
              {hasActual ? formatValue(event.actual, event.unit) : '—'}
            </span>
            {hasActual && <ValueDelta actual={event.actual} estimate={event.estimate ?? event.prev} />}
          </div>
        </div>

        {/* Expand chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3a6a4a" strokeWidth="2" strokeLinecap="round">
          <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '12px 20px 14px 76px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(0,255,136,0.04)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginBottom: '4px' }}>IMPACT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImpactBadge impact={impact} />
              <span style={{ fontSize: '12px', color: cfg.color, fontWeight: '700' }}>{cfg.label}</span>
            </div>
          </div>
          {event.country && (
            <div>
              <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginBottom: '4px' }}>DEVISE</div>
              <div style={{ fontSize: '12px', color: '#c8d8c8' }}>{CURRENCY_FLAGS[event.country] ?? ''} {event.country}</div>
            </div>
          )}
          {event.unit && (
            <div>
              <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginBottom: '4px' }}>UNITÉ</div>
              <div style={{ fontSize: '12px', color: '#c8d8c8' }}>{event.unit}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginBottom: '4px' }}>DATE / HEURE (FR)</div>
            <div style={{ fontSize: '12px', color: '#c8d8c8' }}>{formatDate(event.time ?? event.date, tz)} · {formatTime(event.time ?? event.date, tz)}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function EconomicCalendar() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Timezone
  const [tz, setTz] = useState(getStoredTz);

  // Filters
  const [dateMode, setDateMode]   = useState('week');
  const [impactFilter, setImpactFilter] = useState([]); // [] = all
  const [currencyFilter, setCurrencyFilter] = useState([]); // [] = all
  const [searchQ, setSearchQ]     = useState('');
  const [showOnlyUpcoming, setShowOnlyUpcoming] = useState(false);

  const intervalRef = useRef(null);

  // ── Fetch ───────────────────────────────────────────────────
  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const { from, to } = getDateRange(dateMode);
      const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
      const data = await res.json();
      const raw = data.economicCalendar ?? data.economic_calendar ?? data ?? [];
      // Normalize and sort by time
      const normalized = raw
        .map(e => ({ ...e, _time: new Date(e.time ?? e.date ?? 0).getTime() }))
        .sort((a, b) => a._time - b._time);
      setEvents(normalized);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message ?? 'Erreur de connexion à Finnhub');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateMode]);

  // Initial load + on dateMode change
  useEffect(() => {
    fetchEvents(false);
  }, [fetchEvents]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchEvents(true), 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchEvents]);

  // ── Derived currencies list ──────────────────────────────────
  const allCurrencies = [...new Set(events.map(e => e.country).filter(Boolean))].sort();

  // ── Filter logic ─────────────────────────────────────────────
  const filtered = events.filter(e => {
    const impact = getImpact(e);
    if (impactFilter.length > 0 && !impactFilter.includes(impact)) return false;
    if (currencyFilter.length > 0 && !currencyFilter.includes(e.country)) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!(e.event ?? e.name ?? '').toLowerCase().includes(q) && !(e.country ?? '').toLowerCase().includes(q)) return false;
    }
    if (showOnlyUpcoming && isPast(e.time ?? e.date)) return false;
    return true;
  });

  // Group by date for display
  const grouped = filtered.reduce((acc, ev) => {
    const key = new Date(ev.time ?? ev.date).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  // Stats
  const highCount    = filtered.filter(e => getImpact(e) === 'high').length;
  const upcoming30   = filtered.filter(e => isUpcoming(e.time ?? e.date, 30)).length;
  const withActual   = filtered.filter(e => e.actual != null && e.actual !== '').length;

  function toggleImpact(val) {
    setImpactFilter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  }
  function toggleCurrency(cur) {
    setCurrencyFilter(prev => prev.includes(cur) ? prev.filter(x => x !== cur) : [...prev, cur]);
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); border-radius: 2px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>MACRO</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Annonces Économiques</h1>
          <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {filtered.length} événement{filtered.length > 1 ? 's' : ''}
            {highCount > 0 && <span style={{ color: '#ff4455' }}>· {highCount} fort impact</span>}
            {upcoming30 > 0 && <span style={{ color: '#f0a020', animation: 'blink 1.5s infinite' }}>· ⚡ {upcoming30} dans 30min</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdate && (
            <div style={{ fontSize: '10px', color: '#2a5a32', textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: refreshing ? '#f0a020' : '#00ff88', boxShadow: refreshing ? '0 0 6px #f0a020' : '0 0 6px #00ff88', animation: 'blink 2s infinite' }} />
                <span>{refreshing ? 'Actualisation...' : `MAJ ${lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}</span>
              </div>
              <div style={{ color: '#1a3a22', marginTop: '2px' }}>
                Auto-refresh 60s · {TIMEZONES.find(z => z.key === tz)?.label ?? 'New York'}
              </div>
            </div>
          )}
          <button onClick={() => fetchEvents(false)}
            style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', padding: '8px 16px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,136,0.08)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Row 1: Date range + search + upcoming toggle */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'today', label: "Auj." },
              { key: 'week',  label: 'Cette sem.' },
              { key: 'next7', label: '7 prochains j.' },
              { key: 'month', label: 'Ce mois' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setDateMode(key)}
                style={{ padding: '5px 10px', borderRadius: '4px', border: `1px solid ${dateMode === key ? '#00ff88' : '#1a3a22'}`, background: dateMode === key ? 'rgba(0,255,136,0.12)' : 'transparent', color: dateMode === key ? '#00ff88' : '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.12s' }}
              >{label}</button>
            ))}
          </div>
          <input
            placeholder="Rechercher une annonce..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: '4px', padding: '5px 10px', color: '#c8d8c8', fontSize: '10px', fontFamily: 'inherit', outline: 'none', width: '200px', caretColor: '#00ff88' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: showOnlyUpcoming ? '#f0a020' : '#3a6a4a', marginLeft: 'auto' }}>
            <div onClick={() => setShowOnlyUpcoming(s => !s)}
              style={{ width: '28px', height: '16px', borderRadius: '8px', background: showOnlyUpcoming ? 'rgba(240,160,32,0.3)' : 'rgba(0,255,136,0.08)', border: `1px solid ${showOnlyUpcoming ? '#f0a020' : 'rgba(0,255,136,0.15)'}`, position: 'relative', transition: 'all 0.2s', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: '2px', left: showOnlyUpcoming ? '14px' : '2px', width: '10px', height: '10px', borderRadius: '50%', background: showOnlyUpcoming ? '#f0a020' : '#3a6a4a', transition: 'left 0.2s' }} />
            </div>
            À venir seulement
          </label>
        </div>

        {/* Row 2: Impact filter */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginRight: '4px' }}>IMPACT</span>
          {Object.entries(IMPACT_CONFIG).filter(([k]) => k !== 'na').map(([key, cfg]) => (
            <button key={key} onClick={() => toggleImpact(key)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${impactFilter.includes(key) ? cfg.color : '#1a3a22'}`, background: impactFilter.includes(key) ? cfg.bg : 'transparent', color: impactFilter.includes(key) ? cfg.color : '#3a6a4a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}>
              <ImpactBadge impact={impactFilter.includes(key) ? key : 'na'} />
              {cfg.label}
            </button>
          ))}
          {impactFilter.length > 0 && (
            <button onClick={() => setImpactFilter([])} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #1a3a22', background: 'transparent', color: '#3a5a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>✕ Reset</button>
          )}
        </div>

        {/* Row 3: Currency filter */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginRight: '4px' }}>DEVISE</span>
          {allCurrencies.map(cur => (
            <button key={cur} onClick={() => toggleCurrency(cur)}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${currencyFilter.includes(cur) ? '#00aaff' : '#1a3a22'}`, background: currencyFilter.includes(cur) ? 'rgba(0,170,255,0.1)' : 'transparent', color: currencyFilter.includes(cur) ? '#00aaff' : '#4a7a5a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}>
              <span style={{ fontSize: '11px' }}>{CURRENCY_FLAGS[cur] ?? '🌐'}</span>
              {cur}
            </button>
          ))}
          {currencyFilter.length > 0 && (
            <button onClick={() => setCurrencyFilter([])} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #1a3a22', background: 'transparent', color: '#3a5a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>✕ Reset</button>
          )}
        </div>
        {/* Row 4: Timezone selector */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', marginRight: '4px' }}>FUSEAU</span>
          {TIMEZONES.map(zone => (
            <button key={zone.key}
              onClick={() => { setTz(zone.key); storeTz(zone.key); }}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${tz === zone.key ? '#aa88ff' : '#1a3a22'}`, background: tz === zone.key ? 'rgba(170,136,255,0.12)' : 'transparent', color: tz === zone.key ? '#aa88ff' : '#4a7a5a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s', fontWeight: tz === zone.key ? '700' : '400' }}
            >
              <span style={{ fontSize: '11px' }}>{zone.flag}</span>
              <span>{zone.abbr}</span>
              {tz === zone.key && <span style={{ fontSize: '9px', opacity: 0.8 }}>· {zone.label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            { label: 'TOTAL',       value: filtered.length,    color: '#c8d8c8' },
            { label: 'FORT IMPACT', value: highCount,          color: '#ff4455' },
            { label: 'PUBLIÉS',     value: withActual,         color: '#00ff88' },
            { label: '< 30 MIN',    value: upcoming30,         color: '#f0a020' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '6px', padding: '10px 14px', borderTop: `2px solid ${color}` }}>
              <div style={{ fontSize: '8px', color: '#2a5a32', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table header ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '52px 52px 36px 1fr 90px 90px 90px 16px', gap: '8px', padding: '6px 16px', fontSize: '8px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.06)', marginBottom: '2px' }}>
          <span>HEURE ({TIMEZONES.find(z => z.key === tz)?.abbr ?? 'ET'})</span><span>DEVISE</span><span>IMP.</span><span>ANNONCE</span>
          <span style={{ textAlign: 'right' }}>PRÉC.</span>
          <span style={{ textAlign: 'right' }}>ESTIMÉ</span>
          <span style={{ textAlign: 'right' }}>RÉEL</span>
          <span />
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <Spinner />
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,68,85,0.06)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠</div>
          <div style={{ fontSize: '13px', color: '#ff4455', marginBottom: '6px' }}>Erreur de chargement</div>
          <div style={{ fontSize: '11px', color: '#4a3a3a', marginBottom: '16px' }}>{error}</div>
          <button onClick={() => fetchEvents(false)} style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', padding: '8px 20px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#2a4a30', fontSize: '12px', letterSpacing: '2px', border: '1px dashed #1a3a22', borderRadius: '8px' }}>
          Aucune annonce pour cette période / ces filtres
        </div>
      ) : (
        <div style={{ background: 'rgba(10,28,18,0.3)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
          {Object.entries(grouped).map(([dayKey, dayEvents]) =>
            dayEvents.map((ev, idx) => (
              <EventRow
                key={`${ev.time ?? ev.date}-${ev.event ?? ev.name}-${idx}`}
                event={ev}
                isGroupFirst={idx === 0}
                showDate={Object.keys(grouped).length > 1}
                tz={tz}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
