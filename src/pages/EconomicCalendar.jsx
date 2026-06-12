import { useState, useEffect, useCallback, useRef } from 'react';

const FF_THIS_WEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_NEXT_WEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';
const FF_CACHE_TTL = 15 * 60 * 1000;

function ffCacheGet(key) {
  try {
    const raw = localStorage.getItem('ff_cache_' + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > FF_CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function ffCacheSet(key, data) {
  try { localStorage.setItem('ff_cache_' + key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ── Constants ────────────────────────────────────────────────────────────────
const IMPACT_CONFIG = {
  high:   { label: 'FORT',   color: '#ff4455', bg: 'rgba(255,68,85,0.12)',  border: 'rgba(255,68,85,0.35)',  dot: '#ff4455' },
  medium: { label: 'MOYEN',  color: '#f0a020', bg: 'rgba(240,160,32,0.10)', border: 'rgba(240,160,32,0.30)', dot: '#f0a020' },
  low:    { label: 'FAIBLE', color: '#6a3a3a', bg: 'rgba(196,18,48,0.05)',  border: 'rgba(196,18,48,0.10)',  dot: '#6a3a3a' },
  na:     { label: '—',      color: '#3a1818', bg: 'rgba(18,6,10,0.3)',    border: 'rgba(196,18,48,0.05)',  dot: '#3a1818' },
};

const CURRENCY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CAD: '🇨🇦',
  AUD: '🇦🇺', NZD: '🇳🇿', CHF: '🇨🇭', CNY: '🇨🇳', SEK: '🇸🇪',
  NOK: '🇳🇴', DKK: '🇩🇰', MXN: '🇲🇽', SGD: '🇸🇬', HKD: '🇭🇰',
  KRW: '🇰🇷', INR: '🇮🇳', BRL: '🇧🇷', ZAR: '🇿🇦', TRY: '🇹🇷',
  PLN: '🇵🇱', CZK: '🇨🇿', HUF: '🇭🇺', RUB: '🇷🇺', IDR: '🇮🇩',
};

const TIMEZONES = [
  { key: 'Europe/Paris',        label: 'Paris',       abbr: 'CET',  flag: '🇫🇷' },
  { key: 'America/New_York',    label: 'New York',    abbr: 'ET',   flag: '🇺🇸' },
  { key: 'America/Chicago',     label: 'Chicago',     abbr: 'CT',   flag: '🇺🇸' },
  { key: 'America/Los_Angeles', label: 'Los Angeles', abbr: 'PT',   flag: '🇺🇸' },
  { key: 'Europe/London',       label: 'Londres',     abbr: 'GMT',  flag: '🇬🇧' },
  { key: 'Europe/Zurich',       label: 'Zurich',      abbr: 'CET',  flag: '🇨🇭' },
  { key: 'Asia/Tokyo',          label: 'Tokyo',       abbr: 'JST',  flag: '🇯🇵' },
  { key: 'Asia/Hong_Kong',      label: 'Hong Kong',   abbr: 'HKT',  flag: '🇭🇰' },
  { key: 'UTC',                 label: 'UTC',         abbr: 'UTC',  flag: '🌐' },
];

const DEFAULT_TZ = 'Europe/Paris';

const STORAGE_KEYS = {
  tz:            'eco_tz',
  dateMode:      'eco_dateMode',
  impactFilter:  'eco_impactFilter',
  currencyFilter:'eco_currencyFilter',
  showUpcoming:  'eco_showUpcoming',
};

function loadPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function parseEventDate(str) {
  if (!str) return new Date(0);
  if (typeof str === 'number') return new Date(str < 1e10 ? str * 1000 : str);
  return new Date(str);
}

// Extract "YYYY-MM-DD" from any date string (handles full ISO, YYYY-MM-DD, MM-DD-YYYY)
function extractDateParts(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Take only first 10 chars to strip any time portion ("2026-06-09T..." → "2026-06-09")
  const datePart = s.slice(0, 10);
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  // YYYY-MM-DD
  if (a.length === 4) return { yyyy: a, mm: b, dd: c };
  // MM-DD-YYYY
  if (c.length === 4) return { yyyy: c, mm: a, dd: b };
  return null;
}

function parseFFDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // ForexFactory now sends a full ISO datetime with offset e.g. "2026-06-07T05:15:00-04:00"
  if (s.includes('T')) {
    const d = new Date(s);
    return isNaN(d.getTime()) || d.getTime() <= 0 ? null : d;
  }

  // Legacy: separate YYYY-MM-DD date + "8:30am" time string
  const p = extractDateParts(s);
  if (!p) return null;
  const { yyyy, mm, dd } = p;
  if (!+yyyy || !+mm || !+dd) return null;

  let h = 12, min = 0;
  if (timeStr && timeStr !== 'All Day' && timeStr !== 'Tentative') {
    const match12 = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    const match24 = String(timeStr).match(/^(\d{1,2}):(\d{2})$/);
    if (match12) {
      h = parseInt(match12[1]); min = parseInt(match12[2]);
      if (match12[3].toLowerCase() === 'pm' && h !== 12) h += 12;
      if (match12[3].toLowerCase() === 'am' && h === 12) h = 0;
    } else if (match24) {
      h = parseInt(match24[1]); min = parseInt(match24[2]);
    }
  }

  const probe = new Date(Date.UTC(+yyyy, +mm - 1, +dd, h, min, 0));
  if (isNaN(probe.getTime())) return null;
  const nyParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(probe);
  const nyH   = parseInt(nyParts.find(p => p.type === 'hour')?.value   ?? '0') % 24;
  const nyMin = parseInt(nyParts.find(p => p.type === 'minute')?.value ?? '0');
  let diffMin = (h * 60 + min) - (nyH * 60 + nyMin);
  if (diffMin > 720)  diffMin -= 1440;
  if (diffMin < -720) diffMin += 1440;
  const result = new Date(probe.getTime() + diffMin * 60000);
  return isNaN(result.getTime()) || result.getTime() <= 0 ? null : result;
}

function normalizeFFEvent(e) {
  if (!e?.date) return null;
  const p = extractDateParts(e.date);
  if (!p) return null;
  const isoDate = `${p.yyyy}-${p.mm.padStart(2,'0')}-${p.dd.padStart(2,'0')}`;

  const date = parseFFDateTime(e.date, e.time);
  if (!date) return null;

  return {
    event:    e.title    ?? '',
    country:  (e.country ?? '').toUpperCase(),
    impact:   e.impact   ?? 'Low',
    time:     date.toISOString(),
    date:     isoDate,
    prev:     e.previous ?? '',
    estimate: e.forecast ?? '',
    actual:   e.actual   ?? '',
    _time:    date.getTime(),
  };
}

function formatTime(dateStr, tz = DEFAULT_TZ) {
  if (!dateStr) return '—';
  try {
    return parseEventDate(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch { return '—'; }
}

// Full day header: "LUNDI 9 JUIN 2026"
function formatDayHeader(dateStr, tz = DEFAULT_TZ) {
  if (!dateStr) return '—';
  try {
    return parseEventDate(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz,
    }).toUpperCase();
  } catch { return '—'; }
}

// Returns "AUJOURD'HUI", "DEMAIN", or null
function getDayRelLabel(dateStr, tz = DEFAULT_TZ) {
  if (!dateStr) return null;
  try {
    const d = parseEventDate(dateStr);
    const now = new Date();
    const tzFmt = dt => new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(dt);
    const key   = tzFmt(d);
    const today = tzFmt(now);
    const tomorrow = tzFmt(new Date(now.getTime() + 86400000));
    if (key === today)    return "AUJOURD'HUI";
    if (key === tomorrow) return 'DEMAIN';
    return null;
  } catch { return null; }
}

function formatValue(val) {
  if (val == null || val === '') return '—';
  return String(val);
}

function isPast(dateStr) {
  if (!dateStr) return false;
  return parseEventDate(dateStr) < new Date();
}

function isUpcoming(dateStr, minutesWindow = 30) {
  if (!dateStr) return false;
  const d = parseEventDate(dateStr);
  const now = new Date();
  const diff = (d - now) / 60000;
  return diff >= 0 && diff <= minutesWindow;
}

function getImpact(event) {
  const imp = (event.impact ?? '').toLowerCase();
  if (imp === 'high' || imp === '3' || imp === 'high impact') return 'high';
  if (imp === 'medium' || imp === '2' || imp === 'moderate')  return 'medium';
  if (imp === 'low'  || imp === '1')                          return 'low';
  return 'na';
}

function getDateRange(mode) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (mode === 'today') return { from: fmt(now), to: fmt(now) };
  if (mode === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (mode === 'next7') {
    const end = new Date(now); end.setDate(now.getDate() + 7);
    return { from: fmt(now), to: fmt(end) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: fmt(start), to: fmt(end) };
}

// Short "9-15 juin" label for date buttons
function getDateRangeLabel(mode) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmtShort = d => {
    const day = d.getDate();
    const mon = d.toLocaleDateString('fr-FR', { month: 'short' });
    return `${day} ${mon}`;
  };
  if (mode === 'today') return fmtShort(now);
  if (mode === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return `${mon.getDate()}–${sun.getDate()} ${sun.toLocaleDateString('fr-FR', { month: 'short' })}`;
  }
  if (mode === 'next7') {
    const end = new Date(now); end.setDate(now.getDate() + 7);
    return `${fmtShort(now)} → ${fmtShort(end)}`;
  }
  return now.toLocaleDateString('fr-FR', { month: 'long' });
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '60px 0', color: '#6a3a3a', fontSize: '12px', letterSpacing: '2px' }}>
      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(196,18,48,0.22)', borderTop: '2px solid #c41230', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      CHARGEMENT...
    </div>
  );
}

function ImpactDots({ impact }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {['high','medium','low'].map((lvl, i) => {
        const lit = (impact === 'high' && i <= 2) || (impact === 'medium' && i <= 1) || (impact === 'low' && i === 0);
        const col = impact === 'high' ? '#ff4455' : impact === 'medium' ? '#f0a020' : '#8a3a3a';
        return <div key={lvl} style={{ width: '7px', height: '7px', borderRadius: '50%', background: lit ? col : 'rgba(196,18,48,0.12)' }} />;
      })}
    </div>
  );
}

function ValueDelta({ actual, estimate }) {
  if (!actual || !estimate || actual === '' || estimate === '') return null;
  const a = parseFloat(String(actual).replace(/[%KMB]/g, ''));
  const e = parseFloat(String(estimate).replace(/[%KMB]/g, ''));
  if (isNaN(a) || isNaN(e)) return null;
  return <span style={{ fontSize: '10px', marginLeft: '3px', color: a >= e ? '#c41230' : '#ff4455' }}>{a >= e ? '▲' : '▼'}</span>;
}

function Countdown({ dateStr }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const pad = n => String(n).padStart(2,'0');
    function update() {
      const diff = parseEventDate(dateStr) - new Date();
      if (diff <= 0) { setLabel(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `dans ${h}h${pad(m)}` : m > 0 ? `dans ${m}m${pad(s)}s` : `dans ${s}s`);
    }
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [dateStr]);
  if (!label) return null;
  return <span style={{ fontSize: '9px', color: '#f0a020', fontWeight: '700' }}>{label}</span>;
}

// ── Day separator header ─────────────────────────────────────────────────────
function DayHeader({ dateStr, tz }) {
  const label    = formatDayHeader(dateStr, tz);
  const relLabel = getDayRelLabel(dateStr, tz);
  const isToday  = relLabel === "AUJOURD'HUI";
  const isTomorrow = relLabel === 'DEMAIN';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px 8px',
      background: isToday
        ? 'rgba(196,18,48,0.05)'
        : 'rgba(0,0,0,0.2)',
      borderTop: '1px solid rgba(196,18,48,0.10)',
      borderBottom: `1px solid ${isToday ? 'rgba(196,18,48,0.14)' : 'rgba(196,18,48,0.05)'}`,
    }}>
      {/* Colored left accent */}
      <div style={{
        width: '3px', height: '28px', borderRadius: '2px',
        background: isToday ? '#c41230' : isTomorrow ? '#f0a020' : '#1a4a2a',
        flexShrink: 0,
      }} />
      <div>
        <div style={{
          fontSize: '13px', fontWeight: '700', letterSpacing: '2px',
          color: isToday ? '#c41230' : isTomorrow ? '#f0a020' : '#6a9a7a',
        }}>
          {label}
        </div>
        {relLabel && (
          <div style={{
            fontSize: '9px', letterSpacing: '2px', marginTop: '1px',
            color: isToday ? 'rgba(0,255,136,0.6)' : 'rgba(240,160,32,0.6)',
          }}>
            {relLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Event Row ────────────────────────────────────────────────────────────────
function EventRow({ event, isGroupFirst, tz, tzAbbr }) {
  const [expanded, setExpanded] = useState(false);
  const impact     = getImpact(event);
  const cfg        = IMPACT_CONFIG[impact];
  const past       = isPast(event.time ?? event.date);
  const upcoming30 = isUpcoming(event.time ?? event.date, 30);
  const hasActual  = event.actual != null && event.actual !== '';

  return (
    <>
      {isGroupFirst && <DayHeader dateStr={event.time ?? event.date} tz={tz} />}

      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '64px 60px 36px 1fr 90px 90px 90px 16px',
          gap: '8px',
          alignItems: 'center',
          padding: '9px 16px',
          background: upcoming30
            ? 'rgba(240,160,32,0.07)'
            : hasActual ? 'rgba(18,6,10,0.5)'
            : past ? 'rgba(18,6,10,0.2)'
            : 'rgba(18,6,10,0.38)',
          borderLeft: `3px solid ${upcoming30 ? '#f0a020' : cfg.dot}`,
          cursor: 'pointer',
          opacity: past && !hasActual ? 0.5 : 1,
          borderBottom: '1px solid rgba(0,255,136,0.03)',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,18,48,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = upcoming30 ? 'rgba(240,160,32,0.07)' : hasActual ? 'rgba(18,6,10,0.5)' : past ? 'rgba(18,6,10,0.2)' : 'rgba(18,6,10,0.38)'}
      >
        {/* Heure + fuseau */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '12px', color: upcoming30 ? '#f0a020' : '#887070', fontWeight: upcoming30 ? '700' : '400', letterSpacing: '0.5px' }}>
            {formatTime(event.time ?? event.date, tz)}
          </span>
          <span style={{ fontSize: '9px', color: upcoming30 ? 'rgba(240,160,32,0.6)' : '#4a2020', letterSpacing: '1px' }}>
            {upcoming30 ? <Countdown dateStr={event.time ?? event.date} /> : tzAbbr}
          </span>
        </div>

        {/* Devise */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '13px' }}>{CURRENCY_FLAGS[event.country] ?? '🌐'}</span>
          <span style={{ fontSize: '11px', color: '#6a8a7a', fontWeight: '600' }}>{event.country ?? '—'}</span>
        </div>

        {/* Impact */}
        <ImpactDots impact={impact} />

        {/* Nom événement */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', color: past ? '#5a7a6a' : '#f0e0e2', fontWeight: impact === 'high' ? '600' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.event ?? '—'}
          </div>
          {upcoming30 && <div style={{ fontSize: '9px', color: '#f0a020', letterSpacing: '1px' }}>⚡ IMMINENTE</div>}
        </div>

        {/* Précédent */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1px', marginBottom: '2px' }}>PRÉC.</div>
          <div style={{ fontSize: '12px', color: '#7a4040' }}>{formatValue(event.prev)}</div>
        </div>

        {/* Estimé */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1px', marginBottom: '2px' }}>ESTIMÉ</div>
          <div style={{ fontSize: '12px', color: '#887070' }}>{formatValue(event.estimate)}</div>
        </div>

        {/* Réel */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1px', marginBottom: '2px' }}>RÉEL</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '13px', fontWeight: hasActual ? '700' : '400', color: hasActual ? (parseFloat(String(event.actual)) >= parseFloat(String(event.estimate || event.prev || '0')) ? '#c41230' : '#ff4455') : '#2a1515' }}>
              {hasActual ? formatValue(event.actual) : '—'}
            </span>
            {hasActual && <ValueDelta actual={event.actual} estimate={event.estimate || event.prev} />}
          </div>
        </div>

        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4a2020" strokeWidth="2" strokeLinecap="round">
          <polyline points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: '12px 20px 14px 80px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(196,18,48,0.05)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1.5px', marginBottom: '4px' }}>IMPACT</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImpactDots impact={impact} />
              <span style={{ fontSize: '12px', color: cfg.color, fontWeight: '700' }}>{cfg.label}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1.5px', marginBottom: '4px' }}>DEVISE</div>
            <div style={{ fontSize: '12px', color: '#e0d0d0' }}>{CURRENCY_FLAGS[event.country] ?? ''} {event.country}</div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1.5px', marginBottom: '4px' }}>HEURE ({tzAbbr})</div>
            <div style={{ fontSize: '12px', color: '#e0d0d0' }}>{formatTime(event.time ?? event.date, tz)}</div>
          </div>
          <div>
            <div style={{ fontSize: '8px', color: '#1a4a22', letterSpacing: '1.5px', marginBottom: '4px' }}>JOUR</div>
            <div style={{ fontSize: '12px', color: '#e0d0d0' }}>{formatDayHeader(event.time ?? event.date, tz)}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function EconomicCalendar() {
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [tz,             setTz]             = useState(() => loadPref(STORAGE_KEYS.tz, DEFAULT_TZ) || DEFAULT_TZ);
  const [dateMode,       setDateMode]       = useState(() => loadPref(STORAGE_KEYS.dateMode, 'week'));
  const [impactFilter,   setImpactFilter]   = useState(() => loadPref(STORAGE_KEYS.impactFilter, []));
  const [currencyFilter, setCurrencyFilter] = useState(() => loadPref(STORAGE_KEYS.currencyFilter, []));
  const [searchQ,        setSearchQ]        = useState('');
  const [showUpcoming,   setShowUpcoming]   = useState(() => loadPref(STORAGE_KEYS.showUpcoming, false));

  const intervalRef = useRef(null);
  const tzAbbr = TIMEZONES.find(z => z.key === tz)?.abbr ?? 'CET';

  // Clear stale cache on mount (in case previous version stored bad data)
  useEffect(() => {
    try {
      localStorage.removeItem('ff_cache_this');
      localStorage.removeItem('ff_cache_next');
    } catch {}
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const urls = [FF_THIS_WEEK];
      if (dateMode === 'next7' || dateMode === 'month') urls.push(FF_NEXT_WEEK);

      const fetchOne = async (url) => {
        const cacheKey = url.includes('nextweek') ? 'next' : 'this';
        const cached = ffCacheGet(cacheKey);
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (r.status === 429) {
            if (cached) return cached;
            throw new Error('ForexFactory: limite de requêtes atteinte, réessaie dans quelques minutes');
          }
          if (!r.ok) {
            if (cached) return cached;
            throw new Error(`ForexFactory: erreur ${r.status}`);
          }
          const data = await r.json();
          ffCacheSet(cacheKey, data);
          return data;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      };

      const arrays = await Promise.all(urls.map(u => fetchOne(u)));
      const raw = arrays.flat();
      const normalized = raw.map(normalizeFFEvent).filter(Boolean).sort((a, b) => a._time - b._time);

      let ranged = normalized;
      if (dateMode !== 'week') {
        const { from, to } = getDateRange(dateMode);
        ranged = normalized.filter(e => e.date >= from && e.date <= to);
      }

      setEvents(ranged);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message ?? 'Erreur de connexion à ForexFactory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateMode]);

  useEffect(() => { fetchEvents(false); }, [fetchEvents]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchEvents(true), 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetchEvents]);

  // ── Currencies from current events ───────────────────────────────────────
  const allCurrencies = [...new Set(events.map(e => e.country).filter(Boolean))].sort();

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = events.filter(e => {
    const impact = getImpact(e);
    if (impactFilter.length > 0 && !impactFilter.includes(impact)) return false;
    if (currencyFilter.length > 0 && !currencyFilter.includes(e.country)) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!(e.event ?? '').toLowerCase().includes(q) && !(e.country ?? '').toLowerCase().includes(q)) return false;
    }
    if (showUpcoming && isPast(e.time ?? e.date)) return false;
    return true;
  });

  // Group by calendar day (in selected TZ)
  const grouped = {};
  for (const ev of filtered) {
    const key = new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(parseEventDate(ev.time ?? ev.date));
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  }

  const highCount  = filtered.filter(e => getImpact(e) === 'high').length;
  const upcoming30 = filtered.filter(e => isUpcoming(e.time ?? e.date, 30)).length;
  const withActual = filtered.filter(e => e.actual != null && e.actual !== '').length;

  function setDateModePersist(val) { setDateMode(val); savePref(STORAGE_KEYS.dateMode, val); }
  function setTzPersist(val)       { setTz(val);       savePref(STORAGE_KEYS.tz, val); }

  function toggleImpact(val) {
    setImpactFilter(prev => {
      const next = prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val];
      savePref(STORAGE_KEYS.impactFilter, next); return next;
    });
  }
  function toggleCurrency(cur) {
    setCurrencyFilter(prev => {
      const next = prev.includes(cur) ? prev.filter(x => x !== cur) : [...prev, cur];
      savePref(STORAGE_KEYS.currencyFilter, next); return next;
    });
  }
  function toggleUpcoming() {
    setShowUpcoming(prev => { savePref(STORAGE_KEYS.showUpcoming, !prev); return !prev; });
  }
  function resetAll() {
    setImpactFilter([]); savePref(STORAGE_KEYS.impactFilter, []);
    setCurrencyFilter([]); savePref(STORAGE_KEYS.currencyFilter, []);
    setSearchQ('');
    if (showUpcoming) { setShowUpcoming(false); savePref(STORAGE_KEYS.showUpcoming, false); }
  }

  const hasActiveFilters = impactFilter.length > 0 || currencyFilter.length > 0 || showUpcoming || !!searchQ;

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(196,18,48,0.22); border-radius: 2px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#6a3a3a', letterSpacing: '3px', marginBottom: '4px' }}>MACRO</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#f0e0e2', margin: 0 }}>Annonces Économiques</h1>
          <div style={{ fontSize: '10px', color: '#6a3a3a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {filtered.length} événement{filtered.length !== 1 ? 's' : ''}
            {highCount > 0   && <span style={{ color: '#ff4455' }}>· {highCount} fort impact</span>}
            {upcoming30 > 0  && <span style={{ color: '#f0a020', animation: 'blink 1.5s infinite' }}>· ⚡ {upcoming30} dans 30 min</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdate && (
            <div style={{ fontSize: '10px', color: '#4a2020', textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: refreshing ? '#f0a020' : '#c41230', boxShadow: `0 0 6px ${refreshing ? '#f0a020' : '#c41230'}`, animation: 'blink 2s infinite' }} />
                <span>{refreshing ? 'Actualisation...' : `MAJ ${lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}</span>
              </div>
              <div style={{ color: '#2a1515', marginTop: '2px' }}>Fuseau : {TIMEZONES.find(z => z.key === tz)?.flag} {tzAbbr} · {TIMEZONES.find(z => z.key === tz)?.label}</div>
            </div>
          )}
          <button onClick={() => fetchEvents(false)}
            style={{ background: 'rgba(196,18,48,0.10)', border: '1px solid rgba(196,18,48,0.22)', color: '#c41230', padding: '8px 16px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(196,18,48,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(196,18,48,0.10)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ background: 'rgba(18,6,10,0.4)', border: '1px solid rgba(196,18,48,0.10)', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Row 1 : Fuseau horaire (le plus important pour lire les heures) */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#4a2020', letterSpacing: '1.5px', marginRight: '4px', flexShrink: 0 }}>FUSEAU</span>
          {TIMEZONES.map(zone => (
            <button key={zone.key} onClick={() => setTzPersist(zone.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${tz === zone.key ? '#aa88ff' : '#2a1515'}`, background: tz === zone.key ? 'rgba(170,136,255,0.15)' : 'transparent', color: tz === zone.key ? '#aa88ff' : '#7a4040', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: tz === zone.key ? '700' : '400', transition: 'all 0.12s' }}
            >
              <span style={{ fontSize: '11px' }}>{zone.flag}</span>
              <span>{zone.abbr}</span>
              {tz === zone.key && <span style={{ fontSize: '9px', opacity: 0.75 }}>· {zone.label}</span>}
            </button>
          ))}
        </div>

        {/* Row 2 : Période + recherche + à venir */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#4a2020', letterSpacing: '1.5px', marginRight: '4px', flexShrink: 0 }}>PÉRIODE</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'today', label: "Aujourd'hui" },
              { key: 'week',  label: 'Cette semaine' },
              { key: 'next7', label: '7 prochains jours' },
              { key: 'month', label: 'Ce mois' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setDateModePersist(key)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${dateMode === key ? '#c41230' : '#2a1515'}`, background: dateMode === key ? 'rgba(196,18,48,0.14)' : 'transparent', color: dateMode === key ? '#c41230' : '#6a3a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s', lineHeight: '1.3' }}
              >
                <span>{label}</span>
                <span style={{ fontSize: '8px', opacity: 0.65 }}>{getDateRangeLabel(key)}</span>
              </button>
            ))}
          </div>
          <input
            placeholder="Rechercher..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ background: 'rgba(18,6,10,0.6)', border: '1px solid rgba(196,18,48,0.12)', borderRadius: '4px', padding: '5px 10px', color: '#e0d0d0', fontSize: '10px', fontFamily: 'inherit', outline: 'none', width: '160px', caretColor: '#c41230' }}
          />
          <div onClick={toggleUpcoming} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: showUpcoming ? '#f0a020' : '#6a3a3a', marginLeft: 'auto', userSelect: 'none' }}>
            <div style={{ width: '28px', height: '16px', borderRadius: '8px', background: showUpcoming ? 'rgba(240,160,32,0.3)' : 'rgba(196,18,48,0.10)', border: `1px solid ${showUpcoming ? '#f0a020' : 'rgba(196,18,48,0.18)'}`, position: 'relative', transition: 'all 0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: showUpcoming ? '14px' : '2px', width: '10px', height: '10px', borderRadius: '50%', background: showUpcoming ? '#f0a020' : '#6a3a3a', transition: 'left 0.2s' }} />
            </div>
            À venir
          </div>
        </div>

        {/* Row 3 : Impact */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#4a2020', letterSpacing: '1.5px', marginRight: '4px', flexShrink: 0 }}>IMPACT</span>
          {Object.entries(IMPACT_CONFIG).filter(([k]) => k !== 'na').map(([key, cfg]) => (
            <button key={key} onClick={() => toggleImpact(key)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${impactFilter.includes(key) ? cfg.color : '#2a1515'}`, background: impactFilter.includes(key) ? cfg.bg : 'transparent', color: impactFilter.includes(key) ? cfg.color : '#6a3a3a', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}
            >
              <ImpactDots impact={impactFilter.includes(key) ? key : 'na'} />
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Row 4 : Devises */}
        {allCurrencies.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', color: '#4a2020', letterSpacing: '1.5px', marginRight: '4px', flexShrink: 0 }}>DEVISE</span>
            {allCurrencies.map(cur => (
              <button key={cur} onClick={() => toggleCurrency(cur)}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${currencyFilter.includes(cur) ? '#00aaff' : '#2a1515'}`, background: currencyFilter.includes(cur) ? 'rgba(0,170,255,0.1)' : 'transparent', color: currencyFilter.includes(cur) ? '#00aaff' : '#7a4040', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.12s' }}>
                <span style={{ fontSize: '11px' }}>{CURRENCY_FLAGS[cur] ?? '🌐'}</span>
                {cur}
              </button>
            ))}
            {hasActiveFilters && (
              <button onClick={resetAll} style={{ marginLeft: '8px', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(255,68,85,0.3)', background: 'rgba(255,68,85,0.06)', color: '#ff6677', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer' }}>
                ✕ Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats bar ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            { label: 'TOTAL',       value: filtered.length, color: '#e0d0d0' },
            { label: 'FORT IMPACT', value: highCount,        color: '#ff4455' },
            { label: 'PUBLIÉS',     value: withActual,       color: '#c41230' },
            { label: '< 30 MIN',    value: upcoming30,       color: '#f0a020' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(18,6,10,0.5)', border: '1px solid rgba(196,18,48,0.08)', borderRadius: '6px', padding: '10px 14px', borderTop: `2px solid ${color}` }}>
              <div style={{ fontSize: '8px', color: '#4a2020', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table header ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '64px 60px 36px 1fr 90px 90px 90px 16px', gap: '8px', padding: '6px 16px', fontSize: '8px', color: '#4a2020', letterSpacing: '1.5px', borderBottom: '1px solid rgba(196,18,48,0.08)', marginBottom: '2px' }}>
          <span>HEURE ({tzAbbr})</span>
          <span>DEVISE</span>
          <span>IMP.</span>
          <span>ANNONCE</span>
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
          <button onClick={() => fetchEvents(false)} style={{ background: 'rgba(196,18,48,0.12)', border: '1px solid rgba(196,18,48,0.28)', color: '#c41230', padding: '8px 20px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed #2a1515', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: '#3a1818', letterSpacing: '2px', marginBottom: '16px' }}>
            Aucune annonce pour cette période / ces filtres
          </div>
          {hasActiveFilters && (
            <button onClick={resetAll} style={{ background: 'rgba(196,18,48,0.12)', border: '1px solid rgba(196,18,48,0.35)', color: '#c41230', padding: '8px 20px', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
              Réinitialiser tous les filtres
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: 'rgba(18,6,10,0.3)', border: '1px solid rgba(196,18,48,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
          {Object.entries(grouped).map(([, dayEvents]) =>
            dayEvents.map((ev, idx) => (
              <EventRow
                key={`${ev.time ?? ev.date}-${ev.event}-${idx}`}
                event={ev}
                isGroupFirst={idx === 0}
                tz={tz}
                tzAbbr={tzAbbr}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
