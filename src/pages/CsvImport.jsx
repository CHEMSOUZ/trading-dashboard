import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── CSV Parsers ────────────────────────────────────────────────

/**
 * Detect CSV source from headers
 */
function detectSource(headers) {
  const h = headers.map(x => x.trim().toLowerCase());
  if (h.includes('contractname') && h.includes('enteredat') && h.includes('tradeday')) return 'topstep';
  if (h.includes('symbol') && h.includes('buyfillid') && h.includes('clearingfees')) return 'tradovate';
  return 'unknown';
}

/**
 * Parse a raw CSV string → array of row objects
 */
function parseCsv(raw) {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  // Strip BOM if present
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = headerLine.split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
    return obj;
  });
}

/**
 * Normalize contract name → pair symbol
 * MNQM6 → MNQ, ESU6 → ES, MESM6 → MES, etc.
 */
function normalizePair(contractName) {
  if (!contractName) return 'Autre';
  // Strip expiry suffix (last letter + digit(s) at end)
  const clean = contractName.replace(/[A-Z]\d+$/, '').replace(/\d+$/, '');
  const MAP = {
    MNQ: 'MNQ', NQ: 'NQ', MES: 'MES', ES: 'ES',
    MGC: 'MGC', GC: 'GC', M2K: 'M2K', RTY: 'RTY',
    MCL: 'MCL', CL: 'CL',
  };
  return MAP[clean] ?? clean;
}

/**
 * Parse Topstep date string with timezone offset
 * "05/22/2026 08:54:10 +02:00" → ISO string
 */
function parseTopstepDate(str) {
  if (!str) return null;
  try {
    // Format: MM/DD/YYYY HH:MM:SS +HH:MM
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2}:\d{2})$/);
    if (match) {
      const [, mm, dd, yyyy, time, tz] = match;
      return new Date(`${yyyy}-${mm}-${dd}T${time}${tz}`).toISOString();
    }
    return new Date(str).toISOString();
  } catch { return null; }
}

/**
 * Format TradeDuration "00:07:25.333..." → "7m 25s"
 */
function formatDuration(str) {
  if (!str) return null;
  try {
    const parts = str.split(':');
    if (parts.length < 3) return str;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  } catch { return str; }
}

/**
 * Map a Topstep CSV row → trade payload for window.db.insertTrade
 */
function mapTopstepRow(row) {
  const enteredAt  = parseTopstepDate(row['EnteredAt']);
  const exitedAt   = parseTopstepDate(row['ExitedAt']);
  const date       = enteredAt ? enteredAt.slice(0, 10) : '';
  const pnlBrut    = parseFloat(row['PnL']) || 0;
  const fees       = parseFloat(row['Fees']) || 0;
  const commissions = parseFloat(row['Commissions']) || 0;
  const resultNet  = pnlBrut - fees - commissions;
  const direction  = (row['Type'] ?? '').toLowerCase() === 'short' ? 'SHORT' : 'LONG';
  const size       = parseFloat(row['Size']) || null;

  return {
    external_id:  row['Id'] ?? null,
    source:       'topstep_csv',
    date,
    entered_at:   enteredAt,
    exited_at:    exitedAt,
    pair:         normalizePair(row['ContractName']),
    direction,
    entry:        parseFloat(row['EntryPrice']) || 0,
    exit_price:   parseFloat(row['ExitPrice']) || null,
    size,
    result:       pnlBrut,
    fees,
    commissions,
    result_net:   Math.round(resultNet * 100) / 100,
    outcome:      resultNet > 0 ? 'WIN' : resultNet < 0 ? 'LOSS' : 'BE',
    duration:     formatDuration(row['TradeDuration']),
    stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
  };
}

/**
 * Map a Tradovate CSV row → trade payload
 * (structure prête — à affiner quand on aura un vrai export)
 */
function mapTradovateRow(row) {
  const enteredAt = row['boughtTimestamp'] || row['EnteredAt'] || null;
  const exitedAt  = row['soldTimestamp']   || row['ExitedAt']  || null;
  const enteredIso = enteredAt ? new Date(enteredAt).toISOString() : null;
  const date       = enteredIso ? enteredIso.slice(0, 10) : '';
  const pnlBrut    = parseFloat(row['tradePnL'] ?? row['PnL'] ?? 0) || 0;
  const fees       = parseFloat(row['clearingFees'] ?? row['Fees'] ?? 0) || 0;
  const commissions = parseFloat(row['commission'] ?? row['Commissions'] ?? 0) || 0;
  const resultNet  = pnlBrut - fees - commissions;

  return {
    external_id:  row['tradeId'] ?? row['Id'] ?? null,
    source:       'tradovate_csv',
    date,
    entered_at:   enteredIso,
    exited_at:    exitedAt ? new Date(exitedAt).toISOString() : null,
    pair:         normalizePair(row['symbol'] ?? row['ContractName'] ?? ''),
    direction:    (row['action'] ?? '').toLowerCase().includes('sell') ? 'SHORT' : 'LONG',
    entry:        parseFloat(row['price'] ?? row['EntryPrice'] ?? 0) || 0,
    exit_price:   parseFloat(row['exitPrice'] ?? row['ExitPrice'] ?? 0) || null,
    size:         parseFloat(row['qty'] ?? row['Size'] ?? 0) || null,
    result:       pnlBrut,
    fees,
    commissions,
    result_net:   Math.round(resultNet * 100) / 100,
    outcome:      resultNet > 0 ? 'WIN' : resultNet < 0 ? 'LOSS' : 'BE',
    duration:     null,
    stop: 0, tp: 0, rr: null, emotion: null, notes: null, screenshot: null,
  };
}

function mapRow(row, source) {
  if (source === 'topstep')   return mapTopstepRow(row);
  if (source === 'tradovate') return mapTradovateRow(row);
  return null;
}

// ── UI Components ──────────────────────────────────────────────

function fmt(n, sign = false) {
  if (n == null || isNaN(n)) return '—';
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}$`;
}
function pnlColor(v) {
  if (v > 0) return '#00ff88';
  if (v < 0) return '#ff4455';
  return '#8aaa90';
}

const SOURCE_INFO = {
  topstep:   { label: 'Topstep',   color: '#00ff88', icon: <TopstepLogo size={18} /> },
  tradovate: { label: 'Tradovate', color: '#00aaff', icon: <TradovateLogo size={18} /> },
  unknown:   { label: 'Inconnu',   color: '#f0a020', icon: '❓' },
};

function TopstepLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00ff88" fillOpacity="0.15"/>
      <path d="M8 20 L20 8 L32 20 L20 32 Z" stroke="#00ff88" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <circle cx="20" cy="20" r="4" fill="#00ff88"/>
      <path d="M20 8 L20 16 M20 24 L20 32 M8 20 L16 20 M24 20 L32 20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TradovateLogo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00aaff" fillOpacity="0.15"/>
      <path d="M10 28 L20 12 L30 28" stroke="#00aaff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M14 22 L26 22" stroke="#00aaff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function DropZone({ onFile, disabled }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv')) onFile(file);
  }
  function handleChange(e) {
    const file = e.target.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={disabled ? undefined : handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? '#00ff88' : '#1a4a2a'}`,
        borderRadius: '10px',
        padding: '48px 24px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragOver ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.3)',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} style={{ display: 'none' }} />
      <div style={{ fontSize: '36px', marginBottom: '12px' }}>📂</div>
      <div style={{ fontSize: '14px', color: '#c8d8c8', marginBottom: '6px', fontWeight: '600' }}>
        Glisse ton fichier CSV ici
      </div>
      <div style={{ fontSize: '12px', color: '#3a6a4a' }}>
        ou clique pour sélectionner · Topstep &amp; Tradovate supportés
      </div>
    </div>
  );
}

function PreviewRow({ trade, idx, duplicate }) {
  const net = trade.result_net ?? 0;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px 90px 55px 65px 70px 70px 55px 90px 70px 1fr',
      gap: '6px',
      alignItems: 'center',
      padding: '7px 10px',
      background: duplicate
        ? 'rgba(240,160,32,0.06)'
        : idx % 2 === 0 ? 'rgba(10,28,18,0.4)' : 'rgba(10,28,18,0.25)',
      borderLeft: `2px solid ${duplicate ? '#f0a020' : pnlColor(net)}`,
      borderRadius: '3px',
      fontSize: '11px',
      opacity: duplicate ? 0.7 : 1,
    }}>
      <span style={{ color: '#2a5a32', fontSize: '10px' }}>{idx + 1}</span>
      <span style={{ color: '#4a7a5a', fontSize: '10px' }}>{trade.date}</span>
      <span style={{ color: '#6a8a7a', fontSize: '10px' }}>
        {trade.entered_at ? new Date(trade.entered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
      </span>
      <span style={{ color: '#c8d8c8', fontWeight: '600' }}>{trade.pair}</span>
      <span style={{
        color: trade.direction === 'LONG' ? '#00ff88' : '#ff4455',
        fontSize: '10px',
        background: `rgba(${trade.direction === 'LONG' ? '0,255,136' : '255,68,85'},0.08)`,
        padding: '1px 5px', borderRadius: '3px', textAlign: 'center',
      }}>{trade.direction}</span>
      <span style={{ color: '#8aaa90' }}>{trade.entry?.toFixed(2) ?? '—'}</span>
      <span style={{ color: '#8aaa90' }}>{trade.size ?? '—'}</span>
      <span style={{ color: pnlColor(net), fontWeight: '700' }}>{fmt(net, true)}</span>
      <span style={{ color: '#4a7a5a', fontSize: '10px' }}>{trade.duration ?? '—'}</span>
      {duplicate
        ? <span style={{ color: '#f0a020', fontSize: '10px' }}>⚠ Déjà importé</span>
        : <span style={{ color: '#2a5a32', fontSize: '10px' }}>{trade.outcome ?? '—'}</span>
      }
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function CsvImport() {
  const navigate = useNavigate();
  const [step, setStep]         = useState('drop');   // drop | preview | importing | done
  const [source, setSource]     = useState(null);
  const [trades, setTrades]     = useState([]);
  const [duplicates, setDuplicates] = useState(new Set()); // set of external_ids
  const [result, setResult]     = useState({ imported: 0, skipped: 0, errors: 0 });
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState('');
  const [fileName, setFileName] = useState('');

  // ── Load & parse CSV ──────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    setError('');
    setFileName(file.name);
    const raw = await file.text();
    const rows = parseCsv(raw);
    if (rows.length === 0) { setError('Fichier vide ou format non reconnu.'); return; }

    const detectedSource = detectSource(Object.keys(rows[0]));
    setSource(detectedSource);

    if (detectedSource === 'unknown') {
      setError('Format CSV non reconnu. Seuls les exports Topstep et Tradovate sont supportés pour le moment.');
      return;
    }

    const mapped = rows.map(r => mapRow(r, detectedSource)).filter(Boolean);

    // Check duplicates against existing trades
    let existingIds = new Set();
    try {
      const res = await window.db.getAllTrades();
      if (res.ok) {
        existingIds = new Set(res.data.map(t => t.external_id).filter(Boolean));
      }
    } catch {}

    const dupSet = new Set(mapped.filter(t => t.external_id && existingIds.has(t.external_id)).map(t => t.external_id));
    setDuplicates(dupSet);
    setTrades(mapped);
    setStep('preview');
  }, []);

  // ── Import ────────────────────────────────────────────────────
  async function handleImport(skipDuplicates = true) {
    setStep('importing');
    let imported = 0, skipped = 0, errors = 0;

    // Toujours passer TOUS les trades à la DB :
    // - nouveaux  → INSERT
    // - doublons avec champs manquants → auto-patch (UPDATE timestamps/taille/durée)
    // - doublons complets → SKIP (si skipDuplicates=true et données déjà OK)
    for (let i = 0; i < trades.length; i++) {
      setProgress(Math.round(((i + 1) / trades.length) * 100));
      const t = trades[i];
      const isDup = duplicates.has(t.external_id);
      // Sauter les vrais doublons seulement si l'utilisateur a choisi skipDuplicates
      // Mais on laisse passer si le doublon pourrait être patché (pas de entered_at ISO en DB)
      if (skipDuplicates && isDup) {
        // On appelle quand même insertTrade : il auto-patchera si nécessaire et retournera patched=true
        try {
          const res = await window.db.insertTrade(t);
          if (res.ok && res.data?.patched) imported++;
          else skipped++;
        } catch { skipped++; }
        continue;
      }
      try {
        const res = await window.db.insertTrade(t);
        if (res.ok && !res.data?.skipped) imported++;
        else skipped++;
      } catch { errors++; }
    }
    setResult({ imported, skipped, errors });
    setStep('done');
  }

  // ── Computed ──────────────────────────────────────────────────
  const newTrades = trades.filter(t => !duplicates.has(t.external_id));
  const totalNet  = newTrades.reduce((s, t) => s + (t.result_net ?? 0), 0);
  const wins      = newTrades.filter(t => (t.result_net ?? 0) > 0).length;
  const losses    = newTrades.filter(t => (t.result_net ?? 0) < 0).length;
  const sourceInfo = SOURCE_INFO[source] ?? SOURCE_INFO.unknown;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#3a6a4a', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px', padding: 0 }}>
          ← Retour au dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>IMPORT</div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>Import CSV</h1>
          </div>
        </div>
      </div>

      {/* Platform badges */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        {[
          { key: 'topstep',   label: 'Topstep',   Logo: TopstepLogo,   color: '#00ff88' },
          { key: 'tradovate', label: 'Tradovate',  Logo: TradovateLogo, color: '#00aaff', soon: true },
        ].map(({ key, label, Logo, color, soon }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: `rgba(${color === '#00ff88' ? '0,255,136' : '0,170,255'},0.06)`, border: `1px solid ${color}25`, borderRadius: '6px' }}>
            <Logo size={20} />
            <span style={{ fontSize: '12px', color, fontWeight: '600' }}>{label}</span>
            {soon && <span style={{ fontSize: '9px', color: '#3a6a4a', background: 'rgba(0,255,136,0.08)', border: '1px solid #1a4a2a', padding: '1px 5px', borderRadius: '3px', letterSpacing: '1px' }}>BIENTÔT</span>}
          </div>
        ))}
      </div>

      {/* ── STEP: DROP ── */}
      {step === 'drop' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <DropZone onFile={handleFile} />
          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(255,68,85,0.08)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '6px', color: '#ff4455', fontSize: '13px' }}>
              ⚠ {error}
            </div>
          )}
          {/* Instructions */}
          <div style={{ background: 'rgba(10,28,18,0.3)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '8px', padding: '16px 20px' }}>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '12px' }}>COMMENT EXPORTER DEPUIS TOPSTEP</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'Connecte-toi sur topstep.com',
                'Va dans "Trading History" ou "Performance"',
                'Clique sur "Export" → sélectionne la période',
                'Télécharge le fichier CSV et glisse-le ici',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#00ff88', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                  <span style={{ fontSize: '12px', color: '#8aaa90', lineHeight: '1.5' }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: PREVIEW ── */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Source + file info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: `rgba(${sourceInfo.color === '#00ff88' ? '0,255,136' : '0,170,255'},0.06)`, border: `1px solid ${sourceInfo.color}25`, borderRadius: '8px' }}>
            <div style={{ fontSize: '20px' }}>{sourceInfo.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: sourceInfo.color, fontWeight: '700' }}>{sourceInfo.label} détecté</div>
              <div style={{ fontSize: '11px', color: '#4a7a5a' }}>{fileName} · {trades.length} trade{trades.length > 1 ? 's' : ''}</div>
            </div>
            <button onClick={() => { setStep('drop'); setTrades([]); setSource(null); setFileName(''); }} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
              Changer de fichier
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {[
              { label: 'TOTAL',      value: trades.length,          color: '#c8d8c8' },
              { label: 'NOUVEAUX',   value: newTrades.length,       color: '#00ff88' },
              { label: 'DOUBLONS',   value: duplicates.size,        color: '#f0a020' },
              { label: 'WIN / LOSS', value: `${wins}W / ${losses}L`, color: '#c8d8c8' },
              { label: 'P&L NET',    value: fmt(totalNet, true),    color: pnlColor(totalNet) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '6px', padding: '10px 12px', borderTop: `2px solid ${color}` }}>
                <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Duplicate warning */}
          {duplicates.size > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(240,160,32,0.08)', border: '1px solid rgba(240,160,32,0.3)', borderRadius: '6px', fontSize: '12px', color: '#f0a020' }}>
              ⚠ {duplicates.size} trade{duplicates.size > 1 ? 's' : ''} déjà présent{duplicates.size > 1 ? 's' : ''} dans la base (affiché{duplicates.size > 1 ? 's' : ''} en orange) — ils seront ignorés par défaut.
            </div>
          )}

          {/* Table header */}
          <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 90px 55px 65px 70px 70px 55px 90px 70px 1fr', gap: '6px', padding: '8px 10px', fontSize: '9px', color: '#2a5a32', letterSpacing: '1.5px', borderBottom: '1px solid rgba(0,255,136,0.06)', background: 'rgba(0,0,0,0.2)' }}>
              <span>#</span><span>DATE</span><span>HEURE</span><span>PAIRE</span><span>DIR.</span><span>ENTRÉE</span><span>TAILLE</span><span>P&L NET</span><span>DURÉE</span><span>STATUT</span>
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px' }}>
              {trades.map((t, i) => (
                <PreviewRow key={t.external_id ?? i} trade={t} idx={i} duplicate={duplicates.has(t.external_id)} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
            {duplicates.size > 0 && (
              <button onClick={() => handleImport(false)} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid rgba(240,160,32,0.3)', background: 'rgba(240,160,32,0.08)', color: '#f0a020', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
                Tout importer (avec doublons)
              </button>
            )}
            <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
              ANNULER
            </button>
            <button onClick={() => handleImport(true)} disabled={newTrades.length === 0} style={{ padding: '10px 28px', borderRadius: '5px', background: newTrades.length === 0 ? 'rgba(10,28,18,0.4)' : 'linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,170,85,0.15))', border: `1px solid ${newTrades.length === 0 ? '#1a3a22' : 'rgba(0,255,136,0.35)'}`, color: newTrades.length === 0 ? '#2a5a32' : '#00ff88', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: newTrades.length === 0 ? 'not-allowed' : 'pointer' }}>
              IMPORTER {newTrades.length > 0 ? `${newTrades.length} TRADE${newTrades.length > 1 ? 'S' : ''}` : '(aucun nouveau)'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: IMPORTING ── */}
      {step === 'importing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '60px 0' }}>
          <div style={{ fontSize: '13px', color: '#3a6a4a', letterSpacing: '3px' }}>IMPORT EN COURS...</div>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ height: '6px', background: 'rgba(0,255,136,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#00aa55,#00ff88)', borderRadius: '3px', transition: 'width 0.2s ease', boxShadow: '0 0 8px rgba(0,255,136,0.4)' }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: '#3a6a4a' }}>{progress}%</div>
          </div>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px 0' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: result.errors === 0 ? 'rgba(0,255,136,0.12)' : 'rgba(240,160,32,0.12)', border: `2px solid ${result.errors === 0 ? '#00ff88' : '#f0a020'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: `0 0 24px ${result.errors === 0 ? 'rgba(0,255,136,0.2)' : 'rgba(240,160,32,0.2)'}` }}>
            {result.errors === 0 ? '✓' : '⚠'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8f8e8', marginBottom: '6px' }}>
              {result.errors === 0 ? 'Import réussi !' : 'Import terminé avec des erreurs'}
            </div>
            <div style={{ fontSize: '13px', color: '#4a7a5a' }}>
              {result.imported} importé{result.imported > 1 ? 's' : ''} · {result.skipped} ignoré{result.skipped > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setStep('drop'); setTrades([]); setSource(null); setFileName(''); setError(''); }} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>
              Nouvel import
            </button>
            <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 28px', borderRadius: '5px', background: 'linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,170,85,0.15))', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
              VOIR LE DASHBOARD →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
