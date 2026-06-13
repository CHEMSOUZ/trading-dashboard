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
const DRAFT_KEY = 'trade_draft_v2';

const POINT_VALUES = {
  MNQ:2, NQ:20, MES:5, ES:50, MGC:10, GC:100,
  M2K:5, RTY:50, MCL:10, CL:100, MYM:0.5, YM:5,
};

function loadChecklistItems() {
  try { const raw = localStorage.getItem(CHECKLIST_KEY); if (raw) return JSON.parse(raw); } catch {}
  return DEFAULT_CHECKLIST;
}
function saveChecklistItems(items) {
  try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items)); } catch {}
}
function saveDraft(form) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
}
function loadDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch {}
  return null;
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

const inputStyle = {
  background: 'rgba(14,15,22,0.6)', border: '1px solid rgba(136,153,187,0.14)',
  borderRadius: '5px', padding: '9px 12px', color: '#dde4ef',
  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1.5px' }}>{label}</label>
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
        style={{ maxWidth: '100%', maxHeight: '95vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 0 40px rgba(136,153,187,0.18)' }} />
      <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '20px', background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.35)', color: '#8899bb', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', fontSize:'13px', color: 'rgba(255,255,255,0.4)' }}>Appuie sur Échap pour fermer</div>
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
          border: `2px dashed ${dragOver ? '#8899bb' : '#1a4a2a'}`,
          borderRadius: '6px', padding: '18px',
          textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(136,153,187,0.06)' : 'rgba(14,15,22,0.3)',
          transition: 'all 0.2s',
          marginBottom: screenshots.length > 0 ? '10px' : '0',
        }}
      >
        <div style={{ fontSize: '22px', marginBottom: '5px' }}>📸</div>
        <div style={{ fontSize: '13px', color: '#dde4ef', marginBottom: '3px' }}>
          Glisse tes screenshots ici · Clique pour sélectionner
        </div>
        <div style={{ fontSize:'13px', color: '#5a6a82' }}>
          ou{' '}
          <kbd style={{ background: 'rgba(136,153,187,0.12)', border: '1px solid rgba(136,153,187,0.22)', padding: '1px 5px', borderRadius: '3px', fontSize:'13px', color: '#8899bb' }}>Ctrl+V</kbd>
          {' '}pour coller depuis le presse-papier
        </div>
      </div>

      {/* Thumbnails */}
      {screenshots.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {screenshots.map(sc => (
            <div key={sc.id} style={{ position: 'relative', borderRadius: '5px', overflow: 'hidden', background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.12)', aspectRatio: '16/10' }}>
              <img src={sc.dataUrl} alt={sc.name}
                onClick={() => setLightbox(sc.dataUrl)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
              />
              <button onClick={e => { e.stopPropagation(); remove(sc.id); }}
                style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,68,85,0.5)', color: '#ff4455', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', fontSize:'13px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '3px 6px', fontSize:'12px', color: '#7888a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</div>
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
    <div style={{ background: 'rgba(8,9,16,0.8)', border: '1px solid rgba(136,153,187,0.14)', borderRadius: '6px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(136,153,187,0.10)', background: 'rgba(0,255,136,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ratio === 1 ? '#8899bb' : '#566880', boxShadow: ratio === 1 ? '0 0 8px #8899bb' : 'none' }} />
          <span style={{ fontSize:'13px', color: '#00cc66', letterSpacing: '2px' }}>CONFIRMATION CHECKLIST</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: 'rgba(136,153,187,0.10)', border: `1px solid ${ratio === 1 ? '#8899bb' : '#1a4a2a'}`, borderRadius: '3px', padding: '2px 8px', fontSize: '13px', fontWeight: '700', color: ratio === 1 ? '#8899bb' : '#dde4ef' }}>{score}/{total}</div>
          <button onClick={resetAll} style={{ background: 'transparent', border: '1px solid #141e2e', color: '#3a5a3a', padding: '2px 6px', borderRadius: '2px', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.borderColor = '#ff4455'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#3a5a3a'; e.currentTarget.style.borderColor = '#141e2e'; }}
          >↺</button>
        </div>
      </div>
      {/* Progress */}
      <div style={{ height: '2px', background: 'rgba(14,40,24,0.8)' }}>
        <div style={{ height: '100%', width: `${ratio * 100}%`, background: 'linear-gradient(90deg,#566880,#8899bb)', transition: 'width 0.3s ease', boxShadow: ratio > 0 ? '0 0 6px #8899bb60' : 'none' }} />
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
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 8px', background: isDragging ? 'rgba(136,153,187,0.14)' : isChecked ? 'rgba(136,153,187,0.06)' : 'rgba(14,15,22,0.5)', border: `1px solid ${isDragOver ? '#8899bb' : isChecked ? '#1a4a2a' : 'rgba(14,40,24,0.8)'}`, borderLeft: `2px solid ${isChecked ? '#8899bb' : '#1e2c40'}`, borderRadius: '3px', opacity: isDragging ? 0.4 : 1, transform: isDragOver ? 'translateX(3px)' : 'none', transition: 'all 0.15s ease', userSelect: 'none' }}
            >
              <div style={{ cursor: 'grab', flexShrink: 0, opacity: 0.35 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.35'}
              >
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                  {[1.5, 5.5, 9.5].map(y => <g key={y}><circle cx="2" cy={y} r="1" fill="#3a4a5a"/><circle cx="6" cy={y} r="1" fill="#3a4a5a"/></g>)}
                </svg>
              </div>
              <div onClick={() => toggle(item.id)} style={{ width: '15px', height: '15px', flexShrink: 0, border: `1.5px solid ${isChecked ? '#8899bb' : '#3a4a5a'}`, borderRadius: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isChecked ? 'rgba(136,153,187,0.14)' : 'transparent', transition: 'all 0.15s', boxShadow: isChecked ? '0 0 6px #8899bb30' : 'none' }}>
                {isChecked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><polyline points="1,3.5 3,6 8,1" stroke="#8899bb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span onClick={() => toggle(item.id)} style={{ flex: 1, fontSize:'13px', cursor: 'pointer', color: isChecked ? '#5a6a82' : '#7888a0', textDecoration: isChecked ? 'line-through' : 'none', textDecorationColor: '#5a6a82', transition: 'color 0.15s', lineHeight: '1.3' }}>{item.label}</span>
              <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0, transition: 'color 0.15s', lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
                onMouseLeave={e => e.currentTarget.style.color = '#3a4a5a'}
              >×</button>
            </div>
          );
        })}
      </div>
      {/* Add */}
      <div style={{ padding: '4px 8px 8px' }}>
        {adding ? (
          <div style={{ display: 'flex', gap: '5px', background: 'rgba(14,15,22,0.8)', border: '1px solid #1a4a2a', borderRadius: '3px', padding: '4px 8px' }}>
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); } }}
              placeholder="Nouvelle confirmation..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#dde4ef', fontSize:'13px', fontFamily: 'inherit', caretColor: '#8899bb' }} />
            <button onClick={addItem} style={{ background: '#8899bb', border: 'none', color: '#040d08', padding: '2px 8px', borderRadius: '2px', fontSize:'13px', fontFamily: 'inherit', fontWeight: '700', cursor: 'pointer' }}>ADD</button>
            <button onClick={() => { setAdding(false); setNewLabel(''); }} style={{ background: 'transparent', border: '1px solid #1e2c40', color: '#5868a0', padding: '2px 5px', borderRadius: '2px', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>ESC</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%', background: 'transparent', border: '1px dashed #1e2c40', color: '#5a6a82', padding: '5px', borderRadius: '3px', fontSize:'13px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3c4c64'; e.currentTarget.style.color = '#8899bb'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c40'; e.currentTarget.style.color = '#5a6a82'; }}
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
    entry: '', stop: '', tp: '', exit_price: '', rr: '',
    result: '', fees: '', commissions: '', outcome: '', emotion: 'Calme', notes: '',
    entered_time: '', exited_time: '', size: '', duration: '',
    rating: 0, tags: '',
  });

  const [screenshots, setScreenshots]       = useState([]);
  const [checklistItems, setChecklistItems] = useState(loadChecklistItems);
  const [checklistChecked, setChecklistChecked] = useState({});
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [draftBanner, setDraftBanner] = useState(false);

  useEffect(() => { saveChecklistItems(checklistItems); }, [checklistItems]);

  // Restore draft on new trade mount
  useEffect(() => {
    if (isEdit) return;
    const draft = loadDraft();
    if (draft && (draft.entry || draft.notes || draft.pair !== 'MNQ')) {
      setForm(prev => ({ ...prev, ...draft }));
      setDraftBanner(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on form change (new trade only)
  useEffect(() => {
    if (isEdit) return;
    saveDraft(form);
  }, [form, isEdit]);

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

  // Auto exit_price from result + entry + size + pair + direction
  useEffect(() => {
    const entry  = parseFloat(form.entry);
    const result = parseFloat(form.result);
    const size   = parseFloat(form.size);
    const pv     = POINT_VALUES[form.pair];
    if (!entry || !result || !size || !pv || form.exit_price) return;
    const sign = form.direction === 'LONG' ? 1 : -1;
    const exit = Math.round((entry + sign * result / (size * pv)) * 100) / 100;
    if (isFinite(exit)) setForm(prev => ({ ...prev, exit_price: String(exit) }));
  }, [form.result, form.entry, form.size, form.pair, form.direction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load trade for edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const res = await window.db.getTradeById(Number(id));
      if (res.ok && res.data) {
        const t = res.data;
        const toTime = iso => {
          if (!iso) return '';
          const d = new Date(iso);
          return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        };
        setForm({
          date: t.date ?? '', pair: t.pair ?? 'MNQ',
          direction: t.direction ?? 'LONG',
          entry: String(t.entry ?? ''), stop: String(t.stop ?? ''),
          tp: String(t.tp ?? ''), exit_price: String(t.exit_price ?? ''), rr: String(t.rr ?? ''),
          result: String(t.result ?? ''), fees: String(t.fees ?? ''), commissions: String(t.commissions ?? ''),
          outcome: t.outcome ?? '', emotion: t.emotion ?? 'Calme', notes: t.notes ?? '',
          entered_time: toTime(t.entered_at),
          exited_time:  toTime(t.exited_at),
          size:     String(t.size ?? ''),
          duration: t.duration ?? '',
          rating: t.rating ?? 0,
          tags:   t.tags   ?? '',
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
      entry:      parseFloat(form.entry)      || 0,
      stop:       parseFloat(form.stop)       || 0,
      tp:         parseFloat(form.tp)         || 0,
      exit_price: parseFloat(form.exit_price) || null,
      rr:         parseFloat(form.rr)         || null,
      fees:       parseFloat(form.fees)        || 0,
      commissions: parseFloat(form.commissions) || 0,
      result: form.result !== '' ? parseFloat(form.result) : null,
      result_net: form.result !== ''
        ? (parseFloat(form.result) || 0) - (parseFloat(form.fees) || 0) - (parseFloat(form.commissions) || 0)
        : null,
      outcome:    form.outcome || null,
      emotion:    form.emotion || null,
      notes: form.notes ? `${form.notes}\n\nChecklist: ${checklistSummary}` : `Checklist: ${checklistSummary}`,
      screenshot: screenshots.length > 0 ? JSON.stringify(screenshots) : null,
      entered_at: form.entered_time ? `${form.date}T${form.entered_time}:00` : null,
      exited_at:  form.exited_time  ? `${form.date}T${form.exited_time}:00`  : null,
      size:       form.size !== '' ? parseFloat(form.size) : null,
      duration:   form.duration || null,
      rating:     form.rating  > 0 ? form.rating : null,
      tags:       form.tags.trim() || null,
    };

    const res = isEdit
      ? await window.db.updateTrade(Number(id), payload)
      : await window.db.insertTrade(payload);

    setSaving(false);
    if (res.ok) {
      clearDraft();
      window.dispatchEvent(new CustomEvent('toast', { detail: { msg: isEdit ? 'Trade mis à jour' : 'Trade enregistré', icon: '✓' } }));
      navigate('/journal?tab=trades');
    }
    else setError(res.error ?? 'Erreur inconnue');
  }

  return (
    <div style={{ padding: '24px 28px', width: '100%', boxSizing: 'border-box', maxWidth: 'none' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => navigate('/journal')} style={{ background: 'none', border: '1px solid rgba(136,153,187,0.15)', color: '#5a6a82', cursor: 'pointer', fontSize:'13px', fontFamily: 'inherit', padding: '6px 12px', borderRadius: '5px', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color='#dde4ef'; e.currentTarget.style.borderColor='rgba(136,153,187,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='#5a6a82'; e.currentTarget.style.borderColor='rgba(136,153,187,0.15)'; }}>
          ← Journal
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#dde4ef', margin: 0, letterSpacing: '-0.5px' }}>
          {isEdit ? 'Modifier le trade' : 'Nouveau trade'}
        </h1>
        {isEdit && <span style={{ fontSize:'12px', color: '#5a6a82', background: 'rgba(136,153,187,0.08)', border: '1px solid rgba(136,153,187,0.15)', padding: '3px 8px', borderRadius: '4px', letterSpacing: '1.5px' }}>ÉDITION</span>}
      </div>

      {/* Draft restored banner */}
      {draftBanner && !isEdit && (
        <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.22)', borderRadius:'6px', padding:'8px 14px', marginBottom:'16px', fontSize:'12px', color:'#a78bfa' }}>
          <span>💾</span>
          <span>Brouillon restauré depuis ta dernière session</span>
          <button onClick={() => {
            clearDraft();
            setDraftBanner(false);
            setForm({ date: new Date().toISOString().slice(0,10), pair:'MNQ', direction:'LONG', entry:'', stop:'', tp:'', exit_price:'', rr:'', result:'', fees:'', commissions:'', outcome:'', emotion:'Calme', notes:'', entered_time:'', exited_time:'', size:'', duration:'', rating:0, tags:'' });
          }} style={{ marginLeft:'auto', background:'transparent', border:'1px solid rgba(124,58,237,0.25)', color:'#7c5abb', borderRadius:'4px', padding:'3px 10px', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' }}>
            Effacer
          </button>
          <button onClick={() => setDraftBanner(false)} style={{ background:'transparent', border:'none', color:'#5a6a82', cursor:'pointer', fontSize:'16px', padding:'0 2px', lineHeight:1 }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr clamp(280px,28%,380px)', gap: '20px', alignItems: 'start' }}>

        {/* ── Left — Form ── */}
        <div style={{ background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

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
                  <button key={d} onClick={() => setForm(p => ({ ...p, direction: d }))} style={{ flex: 1, padding: '8px', borderRadius: '5px', border: `1px solid ${form.direction===d?(d==='LONG'?'#00cc77':'#ff3344'):'rgba(136,153,187,0.14)'}`, background: form.direction===d?`rgba(${d==='LONG'?'0,204,119':'255,51,68'},0.12)`:'rgba(14,15,22,0.6)', color: form.direction===d?(d==='LONG'?'#00cc77':'#ff3344'):'#6878a0', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}>{d}</button>
                ))}
              </div>
            </Field>
          </div>

          {/* Entry, Stop, TP, Exit, RR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '14px' }}>
            <Field label="ENTRÉE *">
              <input type="number" placeholder="21450" value={form.entry} onChange={set('entry')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#8899bb'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="STOP">
              <input type="number" placeholder="21425" value={form.stop} onChange={set('stop')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#ff4455'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="TP">
              <input type="number" placeholder="21500" value={form.tp} onChange={set('tp')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#00cc77'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="PRIX SORTIE">
              <input type="number" placeholder="21490" value={form.exit_price} onChange={set('exit_price')} style={{ ...inputStyle, color: form.exit_price ? '#f59e0b' : '#dde4ef' }}
                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="RR (AUTO)">
              <input readOnly value={form.rr ? `1:${form.rr}` : ''} style={{ ...inputStyle, color: '#8899bb', fontWeight: '700', background: 'rgba(136,153,187,0.06)' }} />
            </Field>
          </div>

          {/* Heure, Sortie, Taille, Durée */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
            <Field label="HEURE D'ENTRÉE">
              <input type="time" value={form.entered_time} onChange={set('entered_time')}
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={e => e.target.style.borderColor = '#8899bb'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="HEURE DE SORTIE">
              <input type="time" value={form.exited_time} onChange={set('exited_time')}
                style={{ ...inputStyle, colorScheme: 'dark' }}
                onFocus={e => e.target.style.borderColor = '#00aaff'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="TAILLE (CONTRATS)">
              <input type="number" placeholder="1" min="0.01" step="0.01" value={form.size} onChange={set('size')}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#8899bb'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="DURÉE">
              <input type="text" placeholder="2h 30m" value={form.duration} onChange={set('duration')}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#8899bb'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
          </div>

          {/* Résultat, Frais, Commissions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <Field label="RÉSULTAT BRUT ($)">
              <input type="number" placeholder="+500 ou -250" value={form.result} onChange={set('result')}
                style={{ ...inputStyle, color: form.result ? (parseFloat(form.result) >= 0 ? '#00cc77' : '#ff3344') : '#dde4ef' }}
                onFocus={e => e.target.style.borderColor = '#8899bb'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="FRAIS ($)">
              <input type="number" placeholder="0.00" min="0" step="0.01" value={form.fees} onChange={set('fees')}
                style={{ ...inputStyle, color: parseFloat(form.fees) > 0 ? '#f0a020' : '#dde4ef' }}
                onFocus={e => e.target.style.borderColor = '#f0a020'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
            <Field label="COMMISSIONS ($)">
              <input type="number" placeholder="0.00" min="0" step="0.01" value={form.commissions} onChange={set('commissions')}
                style={{ ...inputStyle, color: parseFloat(form.commissions) > 0 ? '#f0a020' : '#dde4ef' }}
                onFocus={e => e.target.style.borderColor = '#f0a020'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
            </Field>
          </div>

          {/* P&L net calculé */}
          {(form.result !== '' || form.fees !== '' || form.commissions !== '') && (
            <div style={{ background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.10)', borderRadius: '5px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px' }}>P&L NET :</span>
              {(() => {
                const net = (parseFloat(form.result) || 0) - (parseFloat(form.fees) || 0) - (parseFloat(form.commissions) || 0);
                return <span style={{ fontSize: '15px', fontWeight: '700', color: net >= 0 ? '#00cc77' : '#ff3344' }}>{net >= 0 ? '+' : ''}{net.toFixed(2)}$</span>;
              })()}
              {((parseFloat(form.fees) || 0) + (parseFloat(form.commissions) || 0)) > 0 && (
                <span style={{ fontSize:'12px', color: '#4a6a4a', marginLeft: 'auto' }}>
                  -{((parseFloat(form.fees) || 0) + (parseFloat(form.commissions) || 0)).toFixed(2)}$ de frais
                </span>
              )}
            </div>
          )}

          {/* Outcome, Émotion */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="OUTCOME">
              <div style={{ display: 'flex', gap: '5px' }}>
                {['WIN','LOSS','BE'].map(o => {
                  const c = o==='WIN'?'#00cc77':o==='LOSS'?'#ff3344':'#f0a020';
                  return (
                    <button key={o} onClick={() => setForm(p => ({ ...p, outcome: o }))} style={{ flex: 1, padding: '7px 4px', borderRadius: '5px', border: `1px solid ${form.outcome===o?c:'rgba(136,153,187,0.14)'}`, background: form.outcome===o?`rgba(${o==='WIN'?'0,255,136':o==='LOSS'?'255,68,85':'240,160,32'},0.12)`:'rgba(14,15,22,0.6)', color: form.outcome===o?c:'#6878a0', fontSize:'13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}>{o}</button>
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
              onFocus={e => e.target.style.borderColor = '#8899bb'}
              onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
          </Field>

          {/* Quality rating + tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="QUALITÉ D'EXÉCUTION">
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                {[1,2,3,4,5].map(star => (
                  <span key={star} onClick={() => setForm(p => ({ ...p, rating: p.rating === star ? 0 : star }))}
                    style={{ fontSize: '22px', cursor: 'pointer', transition: 'transform 0.1s', filter: form.rating >= star ? 'none' : 'grayscale(1) opacity(0.3)' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    ⭐
                  </span>
                ))}
                {form.rating > 0 && (
                  <span style={{ fontSize: '11px', color: '#5a6a82', marginLeft: '4px' }}>
                    {['','Très mauvais','Mauvais','Moyen','Bon','Excellent'][form.rating]}
                  </span>
                )}
              </div>
            </Field>
            <Field label="TAGS (séparés par virgule)">
              <input type="text" placeholder="FVG, OB, London, news..." value={form.tags}
                onChange={set('tags')} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = 'rgba(136,153,187,0.14)'} />
              {form.tags.trim() && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
                  {form.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (
                    <span key={tag} style={{ padding: '2px 8px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '20px', fontSize: '11px', color: '#a78bfa' }}>{tag}</span>
                  ))}
                </div>
              )}
            </Field>
          </div>

          {/* ── SCREENSHOTS ── */}
          <div>
            <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1.5px', marginBottom: '8px' }}>
              SCREENSHOTS DU TRADE {screenshots.length > 0 && <span style={{ color: '#8899bb', marginLeft: '8px' }}>({screenshots.length} image{screenshots.length > 1 ? 's' : ''})</span>}
            </div>
            <ScreenshotZone screenshots={screenshots} onChange={setScreenshots} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '5px', color: '#ff4455', fontSize: '13px' }}>⚠ {error}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => navigate('/journal')} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid rgba(136,153,187,0.15)', background: 'transparent', color: '#6878a0', fontSize: '13px', fontFamily: 'inherit', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#dde4ef'}
              onMouseLeave={e => e.currentTarget.style.color='#6878a0'}>ANNULER</button>
            <button onClick={handleSubmit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '5px', background: 'linear-gradient(135deg,rgba(136,153,187,0.28),rgba(0,170,85,0.15))', border: '1px solid rgba(136,153,187,0.40)', color: '#8899bb', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1.5px', cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.boxShadow = '0 0 16px rgba(136,153,187,0.22)'; }}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {saving ? 'ENREGISTREMENT...' : isEdit ? 'METTRE À JOUR' : 'ENREGISTRER'}
            </button>
          </div>
        </div>

        {/* ── Right — Checklist ── */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <div style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '8px' }}>CONFIRMATIONS</div>
          <Checklist
            checked={checklistChecked}
            onChange={setChecklistChecked}
            items={checklistItems}
            onItemsChange={setChecklistItems}
          />
          <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.08)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize:'13px', color: '#5a6a82', letterSpacing: '1px' }}>SCORE</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: checklistScore === checklistTotal && checklistTotal > 0 ? '#8899bb' : '#dde4ef' }}>
              {checklistScore}/{checklistTotal}
              <span style={{ fontSize:'13px', color: '#5a6a82', marginLeft: '4px' }}>({Math.round((checklistScore / Math.max(checklistTotal, 1)) * 100)}%)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
