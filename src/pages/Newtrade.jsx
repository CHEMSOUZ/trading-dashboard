import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const PAIRS = ['MNQ','NQ','MES','ES','MGC','GC','M2K','RTY','MCL','CL','NASDAQ','S&P500','DAX','GOLD','EUR/USD','GBP/USD','BTC/USD','ETH/USD','Autre'];
const EMOTIONS = ['Calme','Confiant','Anxieux','Impatient','Neutre','Frustré','Focalisé','Fatigué'];

const DEFAULT_CHECKLIST = [
  { id: 1, label: 'Zone HTF (D,H4,H1,30M,15M)' },
  { id: 2, label: 'Prise de Liquidité (OB,FVG,EQH,PDH,PWH,PMH,PSH)' },
  { id: 3, label: 'Market Shift (MS,MSS)' },
  { id: 4, label: 'FVG' },
  { id: 5, label: 'Breaker' },
  { id: 6, label: 'Niveau Fibonacci 0.5' },
  { id: 7, label: 'Niveau Fibonacci 0.382' },
  { id: 8, label: 'Niveau Fibonacci 0.618' },
];

const CHECKLIST_KEY = 'trade_checklist_items';

function loadChecklistItems() {
  try { const raw = localStorage.getItem(CHECKLIST_KEY); if (raw) return JSON.parse(raw); } catch {}
  return DEFAULT_CHECKLIST;
}
function saveChecklistItems(items) {
  try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items)); } catch {}
}

const inputStyle = {
  background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.12)',
  borderRadius: '5px', padding: '9px 12px', color: '#c8d8c8',
  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', color: '#3a6a4a', letterSpacing: '1.5px' }}>{label}</label>
      {children}
    </div>
  );
}

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
        style={{ maxWidth: '100%', maxHeight: '95vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 0 40px rgba(0,255,136,0.15)' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '20px', background: 'rgba(10,28,18,0.8)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Appuie sur Échap pour fermer</div>
    </div>
  );
}

// ── Screenshot Zone ───────────────────────────────────────────
function ScreenshotZone({ screenshots, onChange }) {
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const zoneRef = useRef(null);

  // Ctrl+V paste from clipboard
  useEffect(() => {
    function onPaste(e) {
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
  }, [screenshots]);

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
    const newScreens = res.images.map(img => ({
      dataUrl: img.dataUrl, name: img.name, id: Date.now() + Math.random(),
    }));
    onChange([...screenshots, ...newScreens]);
  }

  function remove(id) { onChange(screenshots.filter(s => s.id !== id)); }

  return (
    <div ref={zoneRef}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          border: `2px dashed ${dragOver ? '#00ff88' : '#1a4a2a'}`,
          borderRadius: '6px', padding: '18px',
          textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.3)',
          transition: 'all 0.2s',
          marginBottom: screenshots.length > 0 ? '10px' : '0',
        }}
      >
        <div style={{ fontSize: '22px', marginBottom: '5px' }}>📸</div>
        <div style={{ fontSize: '13px', color: '#c8d8c8', marginBottom: '3px' }}>
          Glisse tes screenshots ici · Clique pour sélectionner
        </div>
        <div style={{ fontSize: '12px', color: '#3a6a4a' }}>
          ou{' '}
          <kbd style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', padding: '1px 5px', borderRadius: '3px', fontSize: '11px', color: '#00ff88' }}>Ctrl+V</kbd>
          {' '}pour coller depuis le presse-papier
        </div>
      </div>

      {/* Thumbnails */}
      {screenshots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {screenshots.map(sc => (
            <div key={sc.id} style={{ position: 'relative', borderRadius: '5px', overflow: 'hidden', background: 'rgba(10,28,18,0.5)', border: '1px solid rgba(0,255,136,0.1)', aspectRatio: '16/10' }}>
              <img src={sc.dataUrl} alt={sc.name}
                onClick={() => setLightbox(sc.dataUrl)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
              />
              <button onClick={e => { e.stopPropagation(); remove(sc.id); }}
                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,68,85,0.5)', color: '#ff4455', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '3px 6px', fontSize: '10px', color: '#8aaa90', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</div>
            </div>
          ))}
        </div>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ── Checklist ─────────────────────────────────────────────────
function Checklist({ checked, onChange, items, onItemsChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding]     = useState(false);
  const [dragId, setDragId]     = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const score = items.filter(i => checked[i.id]).length;
  const total = items.length;
  const ratio = total > 0 ? score / total : 0;

  const toggle    = id => onChange({ ...checked, [id]: !checked[id] });
  const removeItem= id => { const u = items.filter(i => i.id !== id); onItemsChange(u); const c = { ...checked }; delete c[id]; onChange(c); };
  const addItem   = () => { const t = newLabel.trim(); if (!t) return; onItemsChange([...items, { id: Date.now(), label: t }]); setNewLabel(''); setAdding(false); };
  const resetAll  = () => onChange({});

  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver  = (e, id) => { e.preventDefault(); if (id !== dragId) setDragOverId(id); };
  const onDrop      = (e, targetId) => {
    e.preventDefault();
    if (dragId === targetId) return;
    const arr = [...items];
    const from = arr.findIndex(i => i.id === dragId);
    const to   = arr.findIndex(i => i.id === targetId);
    const [m]  = arr.splice(from, 1); arr.splice(to, 0, m);
    onItemsChange(arr); setDragId(null); setDragOverId(null);
  };
  const onDragEnd = () => { setDragId(null); setDragOverId(null); };

  return (
    <div style={{ background: 'rgba(6,18,12,0.8)', border: '1px solid rgba(0,255,136,0.12)', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(0,255,136,0.08)', background: 'rgba(0,255,136,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ratio === 1 ? '#00ff88' : '#00aa55', boxShadow: ratio === 1 ? '0 0 8px #00ff88' : 'none' }} />
          <span style={{ fontSize: '12px', color: '#00cc66', letterSpacing: '2px' }}>CONFIRMATION CHECKLIST</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'rgba(0,255,136,0.08)', border: `1px solid ${ratio === 1 ? '#00ff88' : '#1a4a2a'}`, borderRadius: '3px', padding: '2px 8px', fontSize: '13px', fontWeight: '700', color: ratio === 1 ? '#00ff88' : '#c8d8c8' }}>{score}/{total}</div>
          <button onClick={resetAll} style={{ background: 'transparent', border: '1px solid #1a2a1a', color: '#3a5a3a', padding: '2px 6px', borderRadius: '2px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.borderColor = '#ff4455'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#3a5a3a'; e.currentTarget.style.borderColor = '#1a2a1a'; }}
          >↺</button>
        </div>
      </div>
      {/* Progress */}
      <div style={{ height: '2px', background: 'rgba(14,40,24,0.8)' }}>
        <div style={{ height: '100%', width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#00aa55,#00ff88)', transition: 'width 0.3s ease', boxShadow: ratio > 0 ? '0 0 6px #00ff8860' : 'none' }} />
      </div>
      {/* Items */}
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {items.map(item => {
          const isChecked  = !!checked[item.id];
          const isDragging = dragId === item.id;
          const isDragOver = dragOverId === item.id;
          return (
            <div key={item.id} draggable
              onDragStart={e => onDragStart(e, item.id)}
              onDragOver={e => onDragOver(e, item.id)}
              onDrop={e => onDrop(e, item.id)}
              onDragEnd={onDragEnd}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 8px', background: isDragging ? 'rgba(0,255,136,0.12)' : isChecked ? 'rgba(0,255,136,0.05)' : 'rgba(10,28,18,0.5)', border: `1px solid ${isDragOver ? '#00ff88' : isChecked ? '#1a4a2a' : 'rgba(14,40,24,0.8)'}`, borderLeft: `2px solid ${isChecked ? '#00ff88' : '#1a3a22'}`, borderRadius: '3px', opacity: isDragging ? 0.4 : 1, transform: isDragOver ? 'translateX(3px)' : 'none', transition: 'all 0.15s ease', userSelect: 'none' }}
            >
              <div style={{ cursor: 'grab', flexShrink: 0, opacity: 0.35 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.35'}
              >
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                  {[1.5, 5.5, 9.5].map(y => <g key={y}><circle cx="2" cy={y} r="1" fill="#2a5a3a"/><circle cx="6" cy={y} r="1" fill="#2a5a3a"/></g>)}
                </svg>
              </div>
              <div onClick={() => toggle(item.id)} style={{ width: '15px', height: '15px', flexShrink: 0, border: `1.5px solid ${isChecked ? '#00ff88' : '#2a5a3a'}`, borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? 'rgba(0,255,136,0.12)' : 'transparent', transition: 'all 0.15s', boxShadow: isChecked ? '0 0 6px #00ff8830' : 'none' }}>
                {isChecked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1,3.5 3,6 8,1" stroke="#00ff88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span onClick={() => toggle(item.id)} style={{ flex: 1, fontSize: '12px', cursor: 'pointer', color: isChecked ? '#3a8a4a' : '#8aaa90', textDecoration: isChecked ? 'line-through' : 'none', textDecorationColor: '#2a6a3a', transition: 'color 0.15s', lineHeight: '1.3' }}>{item.label}</span>
              <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0, transition: 'color 0.15s', lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
              >×</button>
            </div>
          );
        })}
      </div>
      {/* Add */}
      <div style={{ padding: '4px 8px 8px' }}>
        {adding ? (
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(10,28,18,0.8)', border: '1px solid #1a4a2a', borderRadius: '3px', padding: '4px 8px' }}>
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); } }}
              placeholder="Nouvelle confirmation..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#c8d8c8', fontSize: '12px', fontFamily: 'inherit', caretColor: '#00ff88' }} />
            <button onClick={addItem} style={{ background: '#00ff88', border: 'none', color: '#040d08', padding: '2px 8px', borderRadius: '2px', fontSize: '11px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer' }}>ADD</button>
            <button onClick={() => { setAdding(false); setNewLabel(''); }} style={{ background: 'transparent', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '2px 5px', borderRadius: '2px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>ESC</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'transparent', border: '1px dashed #1a3a22', color: '#3a6a4a', padding: '5px', borderRadius: '3px', fontSize: '11px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a5a32'; e.currentTarget.style.color = '#00ff88'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a3a22'; e.currentTarget.style.color = '#3a6a4a'; }}
          >+ AJOUTER</button>
        )}
      </div>
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────
export default function NewTrade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    pair: 'MNQ', direction: 'LONG',
    entry: '', stop: '', tp: '', rr: '',
    result: '', outcome: '', emotion: 'Calme', notes: '',
  });

  const [screenshots, setScreenshots]       = useState([]);
  const [checklistItems, setChecklistItems] = useState(loadChecklistItems);
  const [checklistChecked, setChecklistChecked] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { saveChecklistItems(checklistItems); }, [checklistItems]);

  // Auto RR
  useEffect(() => {
    const e = parseFloat(form.entry);
    const s = parseFloat(form.stop);
    const t = parseFloat(form.tp);
    if (e && s && t && e !== s) {
      const rr = Math.round((Math.abs(t - e) / Math.abs(e - s)) * 100) / 100;
      setForm(prev => ({ ...prev, rr: String(rr) }));
    }
  }, [form.entry, form.stop, form.tp]);

  // Load trade for edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const res = await window.db.getTradeById(Number(id));
      if (res.ok && res.data) {
        const t = res.data;
        setForm({
          date: t.date ?? '', pair: t.pair ?? 'MNQ',
          direction: t.direction ?? 'LONG',
          entry: String(t.entry ?? ''), stop: String(t.stop ?? ''),
          tp: String(t.tp ?? ''), rr: String(t.rr ?? ''),
          result: String(t.result ?? ''), outcome: t.outcome ?? '',
          emotion: t.emotion ?? 'Calme', notes: t.notes ?? '',
        });
        // Load screenshots from screenshot field (stored as JSON)
        if (t.screenshot) {
          try { setScreenshots(JSON.parse(t.screenshot)); } catch { setScreenshots([]); }
        }
        if (t.checklist) {
          try { setChecklistChecked(JSON.parse(t.checklist)); } catch {}
        }
      }
    })();
  }, [id]);

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }));
  const checklistScore = checklistItems.filter(i => checklistChecked[i.id]).length;
  const checklistTotal = checklistItems.length;

  async function handleSubmit() {
    setError('');
    if (!form.date || !form.pair || !form.entry) {
      setError('Champs obligatoires : date, paire, entrée');
      return;
    }
    setSaving(true);

    const checklistSummary = `[${checklistScore}/${checklistTotal}] ${
      checklistItems.filter(i => checklistChecked[i.id]).map(i => i.label).join(', ')
    }`;

    const payload = {
      date: form.date, pair: form.pair, direction: form.direction,
      entry:  parseFloat(form.entry)  || 0,
      stop:   parseFloat(form.stop)   || 0,
      tp:     parseFloat(form.tp)     || 0,
      rr:     parseFloat(form.rr)     || null,
      result: form.result !== '' ? parseFloat(form.result) : null,
      result_net: form.result !== '' ? parseFloat(form.result) : null,
      outcome:    form.outcome || null,
      emotion:    form.emotion || null,
      notes: form.notes ? `${form.notes}\n\nChecklist: ${checklistSummary}` : `Checklist: ${checklistSummary}`,
      // Store screenshots as JSON in screenshot field
      screenshot: screenshots.length > 0 ? JSON.stringify(screenshots) : null,
    };

    const res = isEdit
      ? await window.db.updateTrade(Number(id), payload)
      : await window.db.insertTrade(payload);

    setSaving(false);
    if (res.ok) navigate('/dashboard');
    else setError(res.error ?? 'Erreur inconnue');
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#3a6a4a', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px', padding: '0' }}>
          ← Retour au dashboard
        </button>
        <h1 style={{ fontSize: '23px', fontWeight: '700', color: '#e8f8e8', margin: 0 }}>
          {isEdit ? 'Modifier le trade' : 'Nouveau trade'}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

        {/* ── Left — Form ── */}
        <div style={{ background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Date, Paire, Direction */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <Field label="DATE *">
              <input type="date" value={form.date} onChange={set('date')} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </Field>
            <Field label="PAIRE *">
              <select value={form.pair} onChange={set('pair')} style={inputStyle}>
                {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="DIRECTION *">
              <div style={{ display: 'flex', gap: '6px' }}>
                {['LONG','SHORT'].map(d => (
                  <button key={d} onClick={() => setForm(p => ({ ...p, direction: d }))} style={{ flex: 1, padding: '8px', borderRadius: '5px', border: `1px solid ${form.direction===d?(d==='LONG'?'#00ff88':'#ff4455'):'rgba(0,255,136,0.12)'}`, background: form.direction===d?`rgba(${d==='LONG'?'0,255,136':'255,68,85'},0.12)`:'rgba(10,28,18,0.6)', color: form.direction===d?(d==='LONG'?'#00ff88':'#ff4455'):'#5a8a6a', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}>{d}</button>
                ))}
              </div>
            </Field>
          </div>

          {/* Entry, Stop, TP, RR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
            <Field label="ENTRÉE *">
              <input type="number" placeholder="21450" value={form.entry} onChange={set('entry')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#00ff88'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,255,136,0.12)'} />
            </Field>
            <Field label="STOP">
              <input type="number" placeholder="21425" value={form.stop} onChange={set('stop')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#ff4455'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,255,136,0.12)'} />
            </Field>
            <Field label="TP">
              <input type="number" placeholder="21500" value={form.tp} onChange={set('tp')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#00ff88'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,255,136,0.12)'} />
            </Field>
            <Field label="RR (AUTO)">
              <input readOnly value={form.rr ? `1:${form.rr}` : ''} style={{ ...inputStyle, color: '#00ff88', fontWeight: '700', background: 'rgba(0,255,136,0.05)' }} />
            </Field>
          </div>

          {/* Résultat, Outcome, Émotion */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <Field label="RÉSULTAT ($)">
              <input type="number" placeholder="+500 ou -250" value={form.result} onChange={set('result')}
                style={{ ...inputStyle, color: form.result ? (parseFloat(form.result) >= 0 ? '#00ff88' : '#ff4455') : '#c8d8c8' }}
                onFocus={e => e.target.style.borderColor = '#00ff88'}
                onBlur={e => e.target.style.borderColor = 'rgba(0,255,136,0.12)'} />
            </Field>
            <Field label="OUTCOME">
              <div style={{ display: 'flex', gap: '5px' }}>
                {['WIN','LOSS','BE'].map(o => {
                  const c = o==='WIN'?'#00ff88':o==='LOSS'?'#ff4455':'#f0a020';
                  return (
                    <button key={o} onClick={() => setForm(p => ({ ...p, outcome: o }))} style={{ flex: 1, padding: '7px 4px', borderRadius: '5px', border: `1px solid ${form.outcome===o?c:'rgba(0,255,136,0.12)'}`, background: form.outcome===o?`rgba(${o==='WIN'?'0,255,136':o==='LOSS'?'255,68,85':'240,160,32'},0.12)`:'rgba(10,28,18,0.6)', color: form.outcome===o?c:'#5a8a6a', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}>{o}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="ÉMOTION">
              <select value={form.emotion} onChange={set('emotion')} style={inputStyle}>
                {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
          </div>

          {/* Notes */}
          <Field label="NOTES">
            <textarea placeholder="Contexte, erreurs, leçons..." value={form.notes} onChange={set('notes')}
              rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
              onFocus={e => e.target.style.borderColor = '#00ff88'}
              onBlur={e => e.target.style.borderColor = 'rgba(0,255,136,0.12)'} />
          </Field>

          {/* ── SCREENSHOTS ── */}
          <div>
            <div style={{ fontSize: '12px', color: '#3a6a4a', letterSpacing: '1.5px', marginBottom: '8px' }}>
              SCREENSHOTS DU TRADE {screenshots.length > 0 && <span style={{ color: '#00ff88', marginLeft: '8px' }}>({screenshots.length} image{screenshots.length > 1 ? 's' : ''})</span>}
            </div>
            <ScreenshotZone screenshots={screenshots} onChange={setScreenshots} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '5px', color: '#ff4455', fontSize: '13px' }}>⚠ {error}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '13px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer' }}>ANNULER</button>
            <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '5px', background: 'linear-gradient(135deg,rgba(0,255,136,0.25),rgba(0,170,85,0.15))', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1.5px', cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = '0 0 16px rgba(0,255,136,0.2)'; }}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {saving ? 'ENREGISTREMENT...' : isEdit ? 'METTRE À JOUR' : 'ENREGISTRER'}
            </button>
          </div>
        </div>

        {/* ── Right — Checklist ── */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <div style={{ fontSize: '12px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>CONFIRMATIONS</div>
          <Checklist
            checked={checklistChecked}
            onChange={setChecklistChecked}
            items={checklistItems}
            onItemsChange={setChecklistItems}
          />
          <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(10,28,18,0.4)', border: '1px solid rgba(0,255,136,0.06)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#3a6a4a', letterSpacing: '1px' }}>SCORE</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: checklistScore === checklistTotal && checklistTotal > 0 ? '#00ff88' : '#c8d8c8' }}>
              {checklistScore}/{checklistTotal}
              <span style={{ fontSize: '12px', color: '#3a6a4a', marginLeft: '4px' }}>({Math.round((checklistScore / Math.max(checklistTotal, 1)) * 100)}%)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
