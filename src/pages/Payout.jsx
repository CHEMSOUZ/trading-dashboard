import { useState, useEffect } from 'react';

// ── Persistence ───────────────────────────────────────────────
const STORAGE_KEY = 'payout_data_v1';

const DEFAULT_DATA = {
  propfirm: [
    { id: 1, label: 'Dépenses PropFirm', amount: -12713, currency: 'EUR', note: 'Comptes challenge / funded' },
  ],
  fixed: [
    { id: 1, label: 'Société',    amount: -6000,  currency: 'EUR', note: 'Création & frais' },
    { id: 2, label: 'Mensualité', amount: -2100,  currency: 'EUR', note: 'Charges mensuelles' },
    { id: 3, label: 'Formation',  amount: -2500,  currency: 'EUR', note: 'Coaching & formation' },
  ],
  payouts: [
    { id: 1, label: 'Payout total', amount: 14001, currency: 'EUR', note: 'Depuis début trading', date: '' },
  ],
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_DATA;
}
function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ── Helpers ───────────────────────────────────────────────────
let _id = Date.now();
function uid() { return ++_id; }

function fmt(n, sign = true) {
  const abs = Math.abs(n).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (sign) return `${n >= 0 ? '+' : '-'}${abs}`;
  return abs;
}

function pnlColor(n) {
  if (n > 0) return '#00cc77';
  if (n < 0) return '#ff3344';
  return '#7888a0';
}

// ── Design tokens ────────────────────────────────────────────────
const PY = {
  border:        'rgba(136,153,187,0.14)',   // border-tertiary
  surfSecondary: 'rgba(20,23,34,0.75)',       // background-secondary
  textPrimary:   '#dde4ef',
  textTertiary:  '#5a6a82',
  success:       '#1D9E75',
  danger:        '#E24B4A',
  warn:          '#BA7517',
  radiusLg:      '10px',
  radiusMd:      '8px',
};

// ── Icons (tabler-style inline SVG) ─────────────────────────────
function IconTrendingDown({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l6 6l4 -4l8 8" />
      <path d="M14 17l7 0l0 -7" />
    </svg>
  );
}
function IconTrendingUp({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6 -6l4 4l8 -8" />
      <path d="M14 7l7 0l0 7" />
    </svg>
  );
}
function IconPlus({ color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </svg>
  );
}

// ── Small components ──────────────────────────────────────────
function SectionHeader({ icon, label, total, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>{icon}</span>
          <span style={{ fontSize:'10px', color: PY.textTertiary, letterSpacing: '0.06em', fontWeight: '600', textTransform: 'uppercase' }}>{label}</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: '500', color: pnlColor(total) }}>
          {fmt(total)} €
        </span>
      </div>
      {children}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderBottom: `1px solid ${PY.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: PY.textPrimary, marginBottom: '2px' }}>{entry.label}</div>
        {(entry.note || entry.date) && (
          <div style={{ fontSize: '11px', color: PY.textTertiary }}>{[entry.note, entry.date].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: '500', color: pnlColor(entry.amount) }}>
          {fmt(entry.amount)} {entry.currency}
        </span>
        {!disabled && (
          <>
            <button onClick={() => onEdit(entry)}
              style={{ background: 'none', border: '1px solid #1e2c40', color: '#5a6a82', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize:'12px', fontFamily: 'inherit', transition: 'all 0.15s', opacity: hover ? 1 : 0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#8899bb'; e.currentTarget.style.color = '#8899bb'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c40'; e.currentTarget.style.color = '#5a6a82'; }}
            >✏</button>
            <button onClick={() => onDelete(entry.id)}
              style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '15px', padding: '0 2px', transition: 'color 0.15s', opacity: hover ? 1 : 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
              onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
            >×</button>
          </>
        )}
      </div>
    </div>
  );
}

function EditModal({ entry, section, onSave, onClose }) {
  const isNew = !entry;
  const [form, setForm] = useState(entry ? { ...entry } : {
    label: '', amount: '', currency: 'EUR', note: '', date: '',
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const inp = {
    background: 'rgba(14,15,22,0.6)',
    border: '1px solid rgba(136,153,187,0.18)',
    borderRadius: '5px', padding: '8px 12px',
    color: '#dde4ef', fontSize: '13px',
    fontFamily: 'inherit', outline: 'none',
    width: '100%', boxSizing: 'border-box',
    caretColor: '#8899bb',
  };

  const isPayout = section === 'payouts';
  const isPropfirm = section === 'propfirm';

  function handleSave() {
    if (!form.label.trim()) return;
    const amount = parseFloat(String(form.amount).replace(',', '.'));
    if (isNaN(amount)) return;
    onSave({ ...form, amount, id: form.id ?? uid() });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0d16', border: '1px solid rgba(136,153,187,0.22)', borderRadius: '10px', width: '100%', maxWidth: '420px', padding: '24px', boxShadow: '0 0 60px rgba(0,0,0,0.7)' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '3px', marginBottom: '4px' }}>
            {section === 'propfirm' ? 'PROPFIRM' : section === 'fixed' ? 'FRAIS FIXES' : 'PAYOUT'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8edf8' }}>
            {isNew ? 'Ajouter une entrée' : 'Modifier'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '5px' }}>LIBELLÉ *</div>
            <input value={form.label} onChange={set('label')} placeholder="Ex: Challenge Topstep 50K" style={inp} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '10px' }}>
            <div>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '5px' }}>
                MONTANT {isPayout ? '(positif)' : '(négatif = dépense)'}
              </div>
              <input
                type="number"
                value={form.amount}
                onChange={set('amount')}
                placeholder={isPayout ? '1500' : '-500'}
                style={{ ...inp, color: form.amount ? pnlColor(parseFloat(String(form.amount))) : '#dde4ef' }}
              />
            </div>
            <div>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '5px' }}>DEVISE</div>
              <select value={form.currency} onChange={set('currency')} style={{ ...inp, appearance: 'none' }}>
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
                <option>CAD</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '5px' }}>NOTE (optionnel)</div>
            <input value={form.note} onChange={set('note')} placeholder="Détails..." style={inp} />
          </div>

          {isPayout && (
            <div>
              <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '5px' }}>DATE (optionnel)</div>
              <input type="date" value={form.date ?? ''} onChange={set('date')} style={{ ...inp, colorScheme: 'dark' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '5px', border: '1px solid #1e2c40', background: 'transparent', color: '#6878a0', fontSize:'13px', fontFamily: 'inherit', cursor: 'pointer' }}>ANNULER</button>
            <button onClick={handleSave} style={{ padding: '9px 22px', borderRadius: '5px', background: 'rgba(136,153,187,0.14)', border: '1px solid rgba(136,153,187,0.40)', color: '#8899bb', fontSize:'13px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
              {isNew ? 'AJOUTER' : 'ENREGISTRER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddButton({ label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', borderTop: `1px solid ${PY.border}`, color: hover ? '#8899bb' : PY.textTertiary, fontSize:'12px', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
    >
      <IconPlus color={hover ? '#8899bb' : PY.textTertiary} />
      {label}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Payout() {
  const [ready,      setReady]      = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [data,       setData]       = useState(null);
  const [modal,      setModal]      = useState(null); // { section, entry? }

  useEffect(() => {
    (async () => {
      const res  = await window.auth.getSession();
      const user = res?.data?.user;
      const demo = !!user && user.subscription_status !== 'active';
      setIsDemoMode(demo);
      if (demo) {
        const pRes = await window.demo.getPayoutData();
        setData(pRes?.ok ? pRes.data : DEFAULT_DATA);
      } else {
        setData(load());
      }
      setReady(true);
    })();
  }, []);

  // Persist on every change — JAMAIS en mode démo
  useEffect(() => {
    if (!ready || isDemoMode || !data) return;
    save(data);
  }, [data, isDemoMode, ready]);

  if (!ready || !data) {
    return <div style={{ padding: '24px 28px', color: PY.textTertiary, fontSize: '13px' }}>Chargement...</div>;
  }

  // ── Computed totals ──────────────────────────────────────────
  const totalPropfirm = data.propfirm.reduce((s, e) => s + e.amount, 0);
  const totalFixed    = data.fixed.reduce((s, e) => s + e.amount, 0);
  const totalInvested = totalPropfirm + totalFixed;
  const totalPayouts  = data.payouts.reduce((s, e) => s + e.amount, 0);
  const netResult     = totalInvested + totalPayouts;
  const roi           = totalInvested !== 0 ? ((totalPayouts / Math.abs(totalInvested)) * 100).toFixed(1) : 0;

  // ── CRUD ──────────────────────────────────────────────────────
  function handleSave(section, updatedEntry) {
    setData(prev => {
      const list = prev[section];
      const exists = list.find(e => e.id === updatedEntry.id);
      const next = exists
        ? list.map(e => e.id === updatedEntry.id ? updatedEntry : e)
        : [...list, updatedEntry];
      return { ...prev, [section]: next };
    });
    setModal(null);
  }

  function handleDelete(section, id) {
    if (!window.confirm('Supprimer cette entrée ?')) return;
    setData(prev => ({ ...prev, [section]: prev[section].filter(e => e.id !== id) }));
  }

  function openAdd(section) { setModal({ section, entry: null }); }
  function openEdit(section, entry) { setModal({ section, entry }); }

  function resetAll() {
    if (!window.confirm('Réinitialiser toutes les données aux valeurs par défaut ?')) return;
    setData(DEFAULT_DATA);
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 'none', width: '100%', boxSizing: 'border-box', fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>

      {/* ── Bannière démo ── */}
      {isDemoMode && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(136,153,187,0.07)', border: '1px solid rgba(136,153,187,0.20)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px' }}>🔒</span>
          <div style={{ fontSize: '12px', color: '#8899bb', lineHeight: '1.5' }}>
            <strong style={{ color: '#dde4ef' }}>Mode démo</strong> — Données fictives à titre d'exemple.
            Les modifications sont désactivées. Activez votre abonnement pour saisir vos données réelles.
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize:'11px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>FINANCES</div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#e8edf8', margin: '0 0 4px' }}>Investissements & Payouts</h1>
          <div style={{ fontSize:'12px', color: PY.textTertiary }}>Toutes les dépenses et revenus depuis le début</div>
        </div>
        <button onClick={isDemoMode ? undefined : resetAll} disabled={isDemoMode}
          style={{ background: 'none', border: '1px solid #1e2c40', color: isDemoMode ? '#2a3a50' : '#3a1818', padding: '7px 14px', borderRadius: '5px', cursor: isDemoMode ? 'not-allowed' : 'pointer', fontSize:'12px', fontFamily: 'inherit', letterSpacing: '1px', transition: 'all 0.15s', opacity: isDemoMode ? 0.4 : 1 }}
          onMouseEnter={e => { if (!isDemoMode) { e.currentTarget.style.borderColor = '#ff4455'; e.currentTarget.style.color = '#ff4455'; } }}
          onMouseLeave={e => { if (!isDemoMode) { e.currentTarget.style.borderColor = '#1e2c40'; e.currentTarget.style.color = '#3a1818'; } }}
        >↺ Reset</button>
      </div>

      {/* ── Hero metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        <div style={{ background: '#120808', border: '0.5px solid #3a1212', borderLeft: '3px solid #E24B4A', borderRadius: PY.radiusLg, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '11px', color: '#9a6060', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>RÉSULTAT NET APRÈS PAYOUTS</div>
          <div style={{ fontSize: '32px', fontWeight: '500', color: '#E24B4A', lineHeight: 1 }}>{fmt(netResult)} €</div>
          <div style={{ fontSize: '11px', marginTop: '6px', color: netResult >= 0 ? PY.success : '#9a6060' }}>
            {netResult >= 0 ? 'Rentabilisé ✓' : `Il manque ${fmt(Math.abs(netResult), false)} € pour rentabiliser`}
          </div>
        </div>
        <div style={{ background: PY.surfSecondary, border: `1px solid ${PY.border}`, borderRadius: PY.radiusLg, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>TOTAL INVESTI</div>
          <div style={{ fontSize: '20px', fontWeight: '500', color: PY.danger, lineHeight: 1 }}>{fmt(totalInvested)} €</div>
          <div style={{ fontSize: '11px', color: PY.textTertiary, marginTop: '5px' }}>PropFirm + frais</div>
        </div>
        <div style={{ background: PY.surfSecondary, border: `1px solid ${PY.border}`, borderRadius: PY.radiusLg, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>TOTAL PAYOUTS</div>
          <div style={{ fontSize: '20px', fontWeight: '500', color: PY.success, lineHeight: 1 }}>{fmt(totalPayouts)} €</div>
          <div style={{ fontSize: '11px', color: PY.textTertiary, marginTop: '5px' }}>{data.payouts.length} payout{data.payouts.length > 1 ? 's' : ''}</div>
        </div>
        <div style={{ background: PY.surfSecondary, border: `1px solid ${PY.border}`, borderRadius: PY.radiusLg, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>ROI</div>
          <div style={{ fontSize: '20px', fontWeight: '500', color: parseFloat(roi) < 50 ? PY.warn : parseFloat(roi) > 100 ? PY.success : PY.textPrimary, lineHeight: 1 }}>{roi}%</div>
          <div style={{ fontSize: '11px', color: PY.textTertiary, marginTop: '5px' }}>Payouts / investi</div>
        </div>
      </div>

      {/* ── Barre de récupération ── */}
      <div style={{ marginBottom: '20px', background: PY.surfSecondary, border: `1px solid ${PY.border}`, borderRadius: PY.radiusLg, padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize:'11px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RÉCUPÉRATION DE L'INVESTISSEMENT</span>
          <span style={{ fontSize:'13px', color: parseFloat(roi) < 50 ? PY.warn : parseFloat(roi) > 100 ? PY.success : PY.textPrimary, fontWeight: '600' }}>{roi}% récupéré</span>
        </div>
        <div style={{ height: '8px', background: PY.border, borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, parseFloat(roi)))}%`,
            background: PY.success,
            borderRadius: '4px',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize:'11px', color: PY.textTertiary }}>
          <span>0€</span>
          <span style={{ color: PY.success }}>{fmt(totalPayouts, false)} € payouts reçus</span>
          <span>{fmt(Math.abs(totalInvested), false)} € investis</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>

        {/* ── LEFT: Dépenses ── */}
        <div style={{ border: `0.5px solid ${PY.border}`, borderRadius: PY.radiusLg, overflow: 'hidden' }}>
          <div style={{ background: PY.surfSecondary, borderBottom: `1px solid ${PY.border}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconTrendingDown color={PY.danger} />
              <span style={{ fontSize: '13px', fontWeight: '500', color: PY.textPrimary }}>Dépenses</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: PY.danger }}>{fmt(totalInvested)} €</span>
          </div>

          {/* PropFirm */}
          <SectionHeader icon="🏆" label="PropFirm" total={totalPropfirm}>
            {data.propfirm.map(e => (
              <EntryRow key={e.id} entry={e}
                onEdit={isDemoMode ? () => {} : entry => openEdit('propfirm', entry)}
                onDelete={isDemoMode ? () => {} : id => handleDelete('propfirm', id)}
                disabled={isDemoMode}
              />
            ))}
            {!isDemoMode && <AddButton label="Ajouter PropFirm" onClick={() => openAdd('propfirm')} />}
          </SectionHeader>

          {/* Frais fixes */}
          <SectionHeader icon="💼" label="Frais fixes" total={totalFixed}>
            {data.fixed.map(e => (
              <EntryRow key={e.id} entry={e}
                onEdit={isDemoMode ? () => {} : entry => openEdit('fixed', entry)}
                onDelete={isDemoMode ? () => {} : id => handleDelete('fixed', id)}
                disabled={isDemoMode}
              />
            ))}
            {!isDemoMode && <AddButton label="Ajouter Frais" onClick={() => openAdd('fixed')} />}
          </SectionHeader>

          {/* Footer */}
          <div style={{ background: PY.surfSecondary, borderTop: `1px solid ${PY.border}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize:'12px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL DÉPENSES</span>
            <span style={{ fontSize: '15px', fontWeight: '500', color: PY.danger }}>{fmt(totalInvested)} €</span>
          </div>
        </div>

        {/* ── RIGHT: Revenus ── */}
        <div style={{ border: `0.5px solid ${PY.border}`, borderRadius: PY.radiusLg, overflow: 'hidden' }}>
          <div style={{ background: PY.surfSecondary, borderBottom: `1px solid ${PY.border}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconTrendingUp color={PY.success} />
              <span style={{ fontSize: '13px', fontWeight: '500', color: PY.textPrimary }}>Revenus</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: '500', color: PY.success }}>{fmt(totalPayouts)} €</span>
          </div>

          {data.payouts.map(e => (
            <EntryRow key={e.id} entry={e}
              onEdit={isDemoMode ? () => {} : entry => openEdit('payouts', entry)}
              onDelete={isDemoMode ? () => {} : id => handleDelete('payouts', id)}
              disabled={isDemoMode}
            />
          ))}
          {!isDemoMode && <AddButton label="Ajouter Payout" onClick={() => openAdd('payouts')} />}

          {/* Footer */}
          <div style={{ background: PY.surfSecondary, borderTop: `1px solid ${PY.border}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize:'12px', color: PY.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL PAYOUTS</span>
            <span style={{ fontSize: '15px', fontWeight: '500', color: PY.success }}>{fmt(totalPayouts)} €</span>
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <EditModal
          section={modal.section}
          entry={modal.entry}
          onSave={entry => handleSave(modal.section, entry)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
