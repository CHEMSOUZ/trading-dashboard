import { useState, useEffect, useCallback, useRef } from 'react';

// ── Default instruments ───────────────────────────────────────
const DEFAULT_INSTRUMENTS = ['MNQ','NQ','MES','ES','MGC','GC','MCL','CL','M2K','RTY','EUR/USD','GBP/USD','USD/JPY','BTC/USD'];

const TIMEFRAMES = ['1M','5M','15M','30M','1H','4H','D','W'];
const BIAS_OPTIONS = ['Haussier 📈','Baissier 📉','Neutre ➡️','Indécis 🤔'];

// ── Helpers ───────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0,10);
}

function getWeekLabel(weekStart) {
  const start = new Date(weekStart + 'T12:00');
  const end   = new Date(start); end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function loadCustomInstruments() {
  try { return JSON.parse(localStorage.getItem('analysis_instruments') ?? 'null') ?? DEFAULT_INSTRUMENTS; }
  catch { return DEFAULT_INSTRUMENTS; }
}
function saveCustomInstruments(list) { localStorage.setItem('analysis_instruments', JSON.stringify(list)); }

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <img src={src} alt="Screenshot" onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 0 40px rgba(136,153,187,0.18)' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '24px', background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.35)', color: '#8899bb', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>×</button>
    </div>
  );
}

// ── Screenshot zone ───────────────────────────────────────────
function ScreenshotZone({ screenshots, onChange }) {
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const zoneRef = useRef(null);

  // Ctrl+V paste
  useEffect(() => {
    function onPaste(e) {
      if (!zoneRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          readFile(blob);
        }
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [screenshots, onChange]);

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const name    = file.name || `screenshot_${Date.now()}.png`;
      onChange([...screenshots, { dataUrl, name, id: Date.now() + Math.random() }]);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(readFile);
  }

  async function handleClick() {
    const res = await window.electron.openImagesDialog();
    if (!res.ok || res.canceled) return;
    const newScreens = res.images.map(img => ({ dataUrl: img.dataUrl, name: img.name, id: Date.now() + Math.random() }));
    onChange([...screenshots, ...newScreens]);
  }

  function removeScreenshot(id) {
    onChange(screenshots.filter(s => s.id !== id));
  }

  return (
    <div ref={zoneRef}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          border: `2px dashed ${dragOver ? '#8899bb' : '#1a4a2a'}`,
          borderRadius: '8px', padding: '20px',
          textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(136,153,187,0.06)' : 'rgba(14,15,22,0.3)',
          transition: 'all 0.2s', marginBottom: screenshots.length > 0 ? '12px' : '0',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>📸</div>
        <div style={{ fontSize: '13px', color: '#dde4ef', marginBottom: '3px' }}>
          Glisse tes screenshots ici · Clique pour sélectionner
        </div>
        <div style={{ fontSize:'13px', color: '#5a6a82' }}>
          ou <kbd style={{ background: 'rgba(136,153,187,0.12)', border: '1px solid rgba(136,153,187,0.22)', padding: '1px 5px', borderRadius: '3px', fontSize:'13px', color: '#8899bb' }}>Ctrl+V</kbd> pour coller depuis le presse-papier
        </div>
      </div>

      {/* Thumbnails grid */}
      {screenshots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {screenshots.map(sc => (
            <div key={sc.id} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.12)', aspectRatio: '16/10' }}>
              <img
                src={sc.dataUrl}
                alt={sc.name}
                onClick={() => setLightbox(sc.dataUrl)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
              />
              {/* Delete btn */}
              <button
                onClick={e => { e.stopPropagation(); removeScreenshot(sc.id); }}
                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,68,85,0.4)', color: '#ff4455', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
              >×</button>
              {/* Name tooltip */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '3px 6px', fontSize:'12px', color: '#7888a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sc.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────
function Textarea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div>
      {label && <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1.5px', marginBottom: '6px' }}>{label}</div>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ width: '100%', background: 'rgba(14,15,22,0.6)', border: '1px solid rgba(136,153,187,0.14)', borderRadius: '5px', padding: '10px 12px', color: '#dde4ef', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.6', caretColor: '#8899bb' }}
      />
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '8px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', fontWeight: '700' }}>{title}</div>
      {children}
    </div>
  );
}

// ── DAILY EDITOR ─────────────────────────────────────────────
function DailyEditor({ date, instrument, onBack, onSaved }) {
  const [form, setForm] = useState({
    bias: '', timeframes: [], notes: '', key_levels: '',
    screenshots: [], positives: '', negatives: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    (async () => {
      const res = await window.db.getDailyAnalyses();
      if (res.ok) {
        const existing = res.data.find(a => a.date === date && a.instrument === instrument);
        if (existing) {
          setForm({
            bias:        existing.bias        ?? '',
            timeframes:  JSON.parse(existing.timeframes  ?? '[]'),
            notes:       existing.notes       ?? '',
            key_levels:  existing.key_levels  ?? '',
            screenshots: JSON.parse(existing.screenshots ?? '[]'),
            positives:   existing.positives   ?? '',
            negatives:   existing.negatives   ?? '',
          });
        }
      }
    })();
  }, [date, instrument]);

  async function save() {
    setSaving(true);
    await window.db.upsertDailyAnalysis({
      date, instrument,
      bias:        form.bias,
      timeframes:  JSON.stringify(form.timeframes),
      notes:       form.notes,
      key_levels:  form.key_levels,
      screenshots: JSON.stringify(form.screenshots),
      positives:   form.positives,
      negatives:   form.negatives,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSaved?.();
  }

  function toggleTF(tf) {
    setForm(p => ({
      ...p,
      timeframes: p.timeframes.includes(tf)
        ? p.timeframes.filter(t => t !== tf)
        : [...p.timeframes, tf],
    }));
  }

  const inp = { background: 'rgba(14,15,22,0.6)', border: '1px solid rgba(136,153,187,0.14)', borderRadius: '5px', padding: '8px 12px', color: '#dde4ef', fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid #1e2c40', color: '#5868a0', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>← Retour</button>
          <div>
            <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '2px' }}>ANALYSE JOURNALIÈRE</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8edf8' }}>
              {instrument} · {new Date(date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{ background: saved ? 'rgba(136,153,187,0.22)' : 'rgba(136,153,187,0.12)', border: `1px solid rgba(136,153,187,${saved?'0.50':'0.30'})`, color: '#8899bb', padding: '10px 22px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', letterSpacing: '1px' }}>
          {saved ? '✅ SAUVEGARDÉ' : saving ? 'SAUVEGARDE...' : '💾 SAUVEGARDER'}
        </button>
      </div>

      {/* Bias */}
      <Section title="📊 BIAIS DU JOUR">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BIAS_OPTIONS.map(b => (
            <button key={b} onClick={() => setForm(p => ({ ...p, bias: p.bias === b ? '' : b }))} style={{ padding: '8px 16px', borderRadius: '5px', border: `1px solid ${form.bias===b?'rgba(136,153,187,0.45)':'rgba(136,153,187,0.12)'}`, background: form.bias===b?'rgba(136,153,187,0.14)':'rgba(14,15,22,0.5)', color: form.bias===b?'#8899bb':'#7888a0', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s' }}>{b}</button>
          ))}
        </div>
      </Section>

      {/* Timeframes */}
      <Section title="⏱ TIMEFRAMES ANALYSÉS">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => toggleTF(tf)} style={{ padding: '7px 14px', borderRadius: '5px', border: `1px solid ${form.timeframes.includes(tf)?'rgba(136,153,187,0.45)':'rgba(136,153,187,0.12)'}`, background: form.timeframes.includes(tf)?'rgba(136,153,187,0.14)':'rgba(14,15,22,0.5)', color: form.timeframes.includes(tf)?'#8899bb':'#7888a0', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', fontWeight: form.timeframes.includes(tf)?'700':'400' }}>{tf}</button>
          ))}
        </div>
      </Section>

      {/* Notes */}
      <Section title="📝 NOTES D'ANALYSE">
        <Textarea value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Contexte macro, structure de marché, zones importantes, catalyseurs du jour..." rows={5} />
      </Section>

      {/* Key levels */}
      <Section title="🎯 NIVEAUX CLÉS">
        <Textarea value={form.key_levels} onChange={v => setForm(p => ({ ...p, key_levels: v }))} placeholder="Support: 28 500&#10;Résistance: 29 200&#10;Zone de liquidité: 28 800..." rows={4} />
      </Section>

      {/* Screenshots */}
      <Section title="📸 SCREENSHOTS">
        <ScreenshotZone screenshots={form.screenshots} onChange={ss => setForm(p => ({ ...p, screenshots: ss }))} />
      </Section>

      {/* Review */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Section title="✅ POINTS POSITIFS">
          <Textarea value={form.positives} onChange={v => setForm(p => ({ ...p, positives: v }))} placeholder="Ce qui s'est bien passé, bonnes décisions, respect du plan..." rows={4} />
        </Section>
        <Section title="❌ POINTS À AMÉLIORER">
          <Textarea value={form.negatives} onChange={v => setForm(p => ({ ...p, negatives: v }))} placeholder="Erreurs commises, biais cognitifs, règles non respectées..." rows={4} />
        </Section>
      </div>
    </div>
  );
}

// ── WEEKLY EDITOR ─────────────────────────────────────────────
function WeeklyEditor({ weekStart, instrument, onBack, onSaved }) {
  const [form, setForm] = useState({
    macro_bias: '', notes: '', key_levels: '',
    screenshots: [], positives: '', negatives: '', plan: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    (async () => {
      const res = await window.db.getWeeklyAnalyses();
      if (res.ok) {
        const existing = res.data.find(a => a.week_start === weekStart && a.instrument === instrument);
        if (existing) {
          setForm({
            macro_bias:  existing.macro_bias  ?? '',
            notes:       existing.notes       ?? '',
            key_levels:  existing.key_levels  ?? '',
            screenshots: JSON.parse(existing.screenshots ?? '[]'),
            positives:   existing.positives   ?? '',
            negatives:   existing.negatives   ?? '',
            plan:        existing.plan        ?? '',
          });
        }
      }
    })();
  }, [weekStart, instrument]);

  async function save() {
    setSaving(true);
    await window.db.upsertWeeklyAnalysis({
      week_start: weekStart, instrument,
      macro_bias:  form.macro_bias,
      notes:       form.notes,
      key_levels:  form.key_levels,
      screenshots: JSON.stringify(form.screenshots),
      positives:   form.positives,
      negatives:   form.negatives,
      plan:        form.plan,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSaved?.();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid #1e2c40', color: '#5868a0', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>← Retour</button>
          <div>
            <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '2px' }}>ANALYSE HEBDOMADAIRE</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8edf8' }}>{instrument} · {getWeekLabel(weekStart)}</div>
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{ background: saved?'rgba(136,153,187,0.22)':'rgba(136,153,187,0.12)', border:`1px solid rgba(136,153,187,${saved?'0.50':'0.30'})`, color: '#8899bb', padding: '10px 22px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', letterSpacing: '1px' }}>
          {saved ? '✅ SAUVEGARDÉ' : saving ? 'SAUVEGARDE...' : '💾 SAUVEGARDER'}
        </button>
      </div>

      {/* Macro bias */}
      <Section title="🌍 BIAIS MACRO DE LA SEMAINE">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BIAS_OPTIONS.map(b => (
            <button key={b} onClick={() => setForm(p => ({ ...p, macro_bias: p.macro_bias === b ? '' : b }))} style={{ padding: '8px 16px', borderRadius: '5px', border: `1px solid ${form.macro_bias===b?'rgba(136,153,187,0.45)':'rgba(136,153,187,0.12)'}`, background: form.macro_bias===b?'rgba(136,153,187,0.14)':'rgba(14,15,22,0.5)', color: form.macro_bias===b?'#8899bb':'#7888a0', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer' }}>{b}</button>
          ))}
        </div>
      </Section>

      <Section title="📝 ANALYSE DE LA SEMAINE">
        <Textarea value={form.notes} onChange={v => setForm(p => ({ ...p, notes: v }))} placeholder="Contexte macro semaine, événements importants (NFP, FOMC...), structure HTF..." rows={5} />
      </Section>

      <Section title="🎯 NIVEAUX CLÉS SEMAINE">
        <Textarea value={form.key_levels} onChange={v => setForm(p => ({ ...p, key_levels: v }))} placeholder="Niveaux hebdomadaires, zones de liquidité H4/D/W..." rows={4} />
      </Section>

      <Section title="📋 PLAN POUR LA SEMAINE À VENIR">
        <Textarea value={form.plan} onChange={v => setForm(p => ({ ...p, plan: v }))} placeholder="Scénarios attendus, setups à surveiller, règles de risk management cette semaine..." rows={5} />
      </Section>

      <Section title="📸 SCREENSHOTS (Multi-timeframe)">
        <ScreenshotZone screenshots={form.screenshots} onChange={ss => setForm(p => ({ ...p, screenshots: ss }))} />
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Section title="✅ POINTS POSITIFS SEMAINE">
          <Textarea value={form.positives} onChange={v => setForm(p => ({ ...p, positives: v }))} placeholder="Bonnes décisions, respect du plan, progrès..." rows={4} />
        </Section>
        <Section title="❌ AXES D'AMÉLIORATION">
          <Textarea value={form.negatives} onChange={v => setForm(p => ({ ...p, negatives: v }))} placeholder="Erreurs répétées, manque de discipline, trades ratés..." rows={4} />
        </Section>
      </div>
    </div>
  );
}

// ── ANALYSIS LIST (home) ──────────────────────────────────────
function AnalysisList({ mode, analyses, instruments, onSelect, onNew, onDelete }) {
  const isDaily  = mode === 'daily';
  const empty    = analyses.length === 0;

  function getBiasColor(bias) {
    if (!bias) return '#5a6a82';
    if (bias.includes('Hauss')) return '#00cc77';
    if (bias.includes('Baiss')) return '#ff3344';
    return '#f0a020';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {empty ? (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed #1e2c40', borderRadius: '8px', color: '#3a1818', fontSize: '13px' }}>
          Aucune analyse — créez votre première analyse {isDaily ? 'journalière' : 'hebdomadaire'}
        </div>
      ) : (
        analyses.map(a => {
          const bias    = isDaily ? a.bias : a.macro_bias;
          const screens = JSON.parse(a.screenshots ?? '[]');
          const label   = isDaily
            ? new Date(a.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : getWeekLabel(a.week_start);
          return (
            <div key={a.id}
              onClick={() => onSelect(a)}
              style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '8px', padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: '14px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(136,153,187,0.05)'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(14,15,22,0.4)'; e.currentTarget.style.borderColor = 'rgba(136,153,187,0.10)'; }}
            >
              {/* Thumbnail */}
              {screens.length > 0 ? (
                <img src={screens[0].dataUrl} alt="" style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, border: '1px solid rgba(136,153,187,0.12)' }} />
              ) : (
                <div style={{ width: '80px', height: '50px', borderRadius: '4px', background: 'rgba(14,15,22,0.6)', border: '1px dashed #1e2c40', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📊</div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#e8edf8' }}>{a.instrument}</span>
                  <span style={{ fontSize:'13px', color: '#5868a0' }}>{label}</span>
                  {bias && <span style={{ fontSize:'13px', color: getBiasColor(bias), background: `rgba(${getBiasColor(bias)==='#00cc77'?'0,204,119':getBiasColor(bias)==='#ff3344'?'255,51,68':'240,160,32'},0.12)`, padding: '2px 8px', borderRadius: '3px' }}>{bias}</span>}
                  {screens.length > 0 && <span style={{ fontSize:'13px', color: '#5a6a82' }}>📸 {screens.length}</span>}
                </div>
                {a.notes && <div style={{ fontSize:'13px', color: '#5868a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes}</div>}
                {(a.positives || a.negatives) && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    {a.positives && <span style={{ fontSize:'13px', color: '#00cc66' }}>✅ {a.positives.split('\n')[0]}</span>}
                    {a.negatives && <span style={{ fontSize:'13px', color: '#cc4444' }}>❌ {a.negatives.split('\n')[0]}</span>}
                  </div>
                )}
              </div>

              <button onClick={e => { e.stopPropagation(); if (window.confirm('Supprimer cette analyse ?')) onDelete(a.id); }}
                style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '18px', padding: '0', flexShrink: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
              >×</button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Analysis() {
  const [mode, setMode]               = useState('daily'); // 'daily' | 'weekly'
  const [editing, setEditing]         = useState(null);    // { date/weekStart, instrument }
  const [dailyList, setDailyList]     = useState([]);
  const [weeklyList, setWeeklyList]   = useState([]);
  const [instruments, setInstruments] = useState(loadCustomInstruments);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate]         = useState(new Date().toISOString().slice(0,10));
  const [newInstrument, setNewInstrument] = useState('MNQ');
  const [newCustomInst, setNewCustomInst] = useState('');
  const [showAddInst, setShowAddInst] = useState(false);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [dRes, wRes] = await Promise.all([window.db.getDailyAnalyses(), window.db.getWeeklyAnalyses()]);
    if (dRes.ok) setDailyList(dRes.data);
    if (wRes.ok) setWeeklyList(wRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function addInstrument() {
    const inst = newCustomInst.trim().toUpperCase();
    if (!inst || instruments.includes(inst)) return;
    const updated = [...instruments, inst];
    setInstruments(updated);
    saveCustomInstruments(updated);
    setNewCustomInst('');
    setShowAddInst(false);
  }

  function removeInstrument(inst) {
    const updated = instruments.filter(i => i !== inst);
    setInstruments(updated);
    saveCustomInstruments(updated);
  }

  async function deleteAnalysis(id) {
    if (mode === 'daily') {
      await window.db.deleteDailyAnalysis(id);
      setDailyList(prev => prev.filter(a => a.id !== id));
    } else {
      await window.db.deleteWeeklyAnalysis(id);
      setWeeklyList(prev => prev.filter(a => a.id !== id));
    }
  }

  function startNew() {
    const instrument = newInstrument;
    if (mode === 'daily') {
      setEditing({ date: newDate, instrument });
    } else {
      setEditing({ weekStart: getWeekStart(newDate), instrument });
    }
    setShowNewForm(false);
  }

  const inp = { background: 'rgba(14,15,22,0.6)', border: '1px solid rgba(136,153,187,0.14)', borderRadius: '5px', padding: '8px 12px', color: '#dde4ef', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  // ── If editing ────────────────────────────────────────────
  if (editing) {
    if (mode === 'daily') {
      return (
        <div style={{ padding: '24px 28px', maxWidth: 'none' }}>
          <DailyEditor date={editing.date} instrument={editing.instrument} onBack={() => { setEditing(null); load(); }} onSaved={load} />
        </div>
      );
    } else {
      return (
        <div style={{ padding: '24px 28px', maxWidth: 'none' }}>
          <WeeklyEditor weekStart={editing.weekStart} instrument={editing.instrument} onBack={() => { setEditing(null); load(); }} onSaved={load} />
        </div>
      );
    }
  }

  // ── List view ─────────────────────────────────────────────
  const currentList = mode === 'daily' ? dailyList : weeklyList;

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '3px', marginBottom: '6px' }}>TRADING JOURNAL</div>
          <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#e8edf8', margin: 0 }}>Analyse de Marché</h1>
          <div style={{ fontSize: '13px', color: '#5a6a82', marginTop: '3px' }}>
            {currentList.length} analyse{currentList.length > 1 ? 's' : ''} · {mode === 'daily' ? 'Vue journalière' : 'Vue hebdomadaire'}
          </div>
        </div>
        <button onClick={() => setShowNewForm(true)} style={{ background: 'linear-gradient(135deg,rgba(136,153,187,0.22),rgba(0,170,85,0.1))', border: '1px solid rgba(136,153,187,0.35)', color: '#8899bb', padding: '10px 18px', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer', letterSpacing: '1px' }}>
          + NOUVELLE ANALYSE
        </button>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'daily',  label: '📅 Journalière', desc: 'Analyse par jour' },
          { key: 'weekly', label: '📆 Hebdomadaire', desc: 'Bilan par semaine' },
        ].map(({ key, label, desc }) => (
          <button key={key} onClick={() => setMode(key)} style={{ flex: 1, padding: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: mode===key?'rgba(136,153,187,0.14)':'transparent', fontFamily: 'inherit', transition: 'all 0.2s' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: mode===key?'#8899bb':'#6878a0', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize:'13px', color: mode===key?'#8a3a3a':'#3a5a3a' }}>{desc}</div>
            {mode===key && <div style={{ height: '2px', background: '#8899bb', borderRadius: '2px', marginTop: '8px', boxShadow: '0 0 6px #8899bb' }} />}
          </button>
        ))}
      </div>

      {/* Instruments management */}
      <div style={{ background: 'rgba(14,15,22,0.3)', border: '1px solid rgba(136,153,187,0.08)', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px', flexShrink: 0 }}>INSTRUMENTS :</span>
          {instruments.map(inst => (
            <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(136,153,187,0.08)', border: '1px solid rgba(136,153,187,0.14)', borderRadius: '4px', padding: '3px 8px' }}>
              <span style={{ fontSize:'13px', color: '#8899bb' }}>{inst}</span>
              {!DEFAULT_INSTRUMENTS.includes(inst) && (
                <button onClick={() => removeInstrument(inst)} style={{ background: 'none', border: 'none', color: '#5a6a82', cursor: 'pointer', fontSize:'13px', padding: '0 0 0 2px', lineHeight: 1 }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                  onMouseLeave={e => e.currentTarget.style.color = '#5a6a82'}
                >×</button>
              )}
            </div>
          ))}
          {showAddInst ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input autoFocus placeholder="Ex: EUR/GBP" value={newCustomInst} onChange={e => setNewCustomInst(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addInstrument(); if (e.key === 'Escape') setShowAddInst(false); }}
                style={{ ...inp, width: '120px', padding: '4px 8px', fontSize:'13px' }} />
              <button onClick={addInstrument} style={{ background: 'rgba(136,153,187,0.12)', border: '1px solid rgba(136,153,187,0.22)', color: '#8899bb', padding: '4px 10px', borderRadius: '4px', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>+</button>
              <button onClick={() => setShowAddInst(false)} style={{ background: 'none', border: 'none', color: '#5a6a82', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowAddInst(true)} style={{ background: 'none', border: '1px dashed #1a4a2a', color: '#5a6a82', padding: '3px 10px', borderRadius: '4px', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>+ Ajouter</button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#5a6a82', fontSize: '13px', letterSpacing: '2px' }}>CHARGEMENT...</div>
      ) : (
        <AnalysisList
          mode={mode}
          analyses={currentList}
          instruments={instruments}
          onSelect={a => setEditing(mode === 'daily' ? { date: a.date, instrument: a.instrument } : { weekStart: a.week_start, instrument: a.instrument })}
          onNew={() => setShowNewForm(true)}
          onDelete={deleteAnalysis}
        />
      )}

      {/* New analysis modal */}
      {showNewForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowNewForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0c0d16', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '10px', width: '100%', maxWidth: '440px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '4px' }}>NOUVELLE</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8edf8' }}>Analyse {mode === 'daily' ? 'Journalière' : 'Hebdomadaire'}</div>
              </div>
              <button onClick={() => setShowNewForm(false)} style={{ background: 'none', border: '1px solid #1e2c40', color: '#5868a0', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px', marginBottom: '6px' }}>{mode === 'daily' ? 'DATE' : 'SEMAINE DU'}</div>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inp, width: '100%', colorScheme: 'dark' }} />
                {mode === 'weekly' && <div style={{ fontSize:'13px', color: '#5a6a82', marginTop: '4px' }}>Semaine du {getWeekLabel(getWeekStart(newDate))}</div>}
              </div>

              <div>
                <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px', marginBottom: '6px' }}>INSTRUMENT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '6px' }}>
                  {instruments.map(inst => (
                    <button key={inst} onClick={() => setNewInstrument(inst)} style={{ padding: '8px 4px', borderRadius: '5px', border: `1px solid ${newInstrument===inst?'rgba(136,153,187,0.45)':'rgba(136,153,187,0.12)'}`, background: newInstrument===inst?'rgba(136,153,187,0.14)':'rgba(14,15,22,0.5)', color: newInstrument===inst?'#8899bb':'#7888a0', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer', fontWeight: newInstrument===inst?'700':'400' }}>{inst}</button>
                  ))}
                </div>
              </div>

              <button onClick={startNew} style={{ padding: '12px', borderRadius: '6px', background: 'linear-gradient(135deg,rgba(136,153,187,0.22),rgba(0,170,85,0.1))', border: '1px solid rgba(136,153,187,0.35)', color: '#8899bb', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
                ✏️ CRÉER L'ANALYSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
