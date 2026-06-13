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

// ── Small components ──────────────────────────────────────────
function SectionHeader({ icon, label, total, color, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <span style={{ fontSize:'12px', color: color ?? '#5a6a82', letterSpacing: '2.5px', fontWeight: '700' }}>{label}</span>
        </div>
        <span style={{ fontSize: '15px', fontWeight: '700', color: pnlColor(total) }}>
          {fmt(total)} €
        </span>
      </div>
      {children}
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete, accentColor }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        gap: '10px',
        alignItems: 'center',
        padding: '10px 14px',
        background: hover ? 'rgba(0,255,136,0.03)' : 'rgba(14,15,22,0.4)',
        border: `1px solid ${hover ? 'rgba(136,153,187,0.12)' : 'rgba(136,153,187,0.05)'}`,
        borderLeft: `2px solid ${accentColor ?? pnlColor(entry.amount)}`,
        borderRadius: '5px',
        transition: 'all 0.15s',
        marginBottom: '4px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#dde4ef', fontWeight: '500', marginBottom: '2px' }}>{entry.label}</div>
        {entry.note && <div style={{ fontSize:'12px', color: '#5a6a82' }}>{entry.note}</div>}
        {entry.date && <div style={{ fontSize:'12px', color: '#3c4c64' }}>{entry.date}</div>}
      </div>
      <span style={{ fontSize: '14px', fontWeight: '700', color: pnlColor(entry.amount), letterSpacing: '0.5px' }}>
        {fmt(entry.amount)} {entry.currency}
      </span>
      <button onClick={() => onEdit(entry)}
        style={{ background: 'none', border: '1px solid #1e2c40', color: '#5a6a82', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize:'13px', fontFamily: 'inherit', transition: 'all 0.15s', opacity: hover ? 1 : 0 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#8899bb'; e.currentTarget.style.color = '#8899bb'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c40'; e.currentTarget.style.color = '#5a6a82'; }}
      >✏</button>
      <button onClick={() => onDelete(entry.id)}
        style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '16px', padding: '0 2px', transition: 'color 0.15s', opacity: hover ? 1 : 0 }}
        onMouseEnter={e => e.currentTarget.style.color = '#ff4455'}
        onMouseLeave={e => e.currentTarget.style.color = '#1a3a20'}
      >×</button>
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
  return (
    <button onClick={onClick}
      style={{ width: '100%', padding: '9px', background: 'transparent', border: '1px dashed #1e2c40', borderRadius: '5px', color: '#3c4c64', fontSize:'13px', fontFamily: 'inherit', letterSpacing: '1.5px', cursor: 'pointer', transition: 'all 0.15s', marginTop: '4px' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#8899bb'; e.currentTarget.style.color = '#8899bb'; e.currentTarget.style.background = 'rgba(0,255,136,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c40'; e.currentTarget.style.color = '#3c4c64'; e.currentTarget.style.background = 'transparent'; }}
    >+ {label}</button>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Payout() {
  const [data, setData] = useState(load);
  const [modal, setModal] = useState(null); // { section, entry? }

  // Persist on every change
  useEffect(() => { save(data); }, [data]);

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

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '3px', marginBottom: '4px' }}>FINANCES</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#e8edf8', margin: '0 0 4px' }}>Investissements & Payouts</h1>
          <div style={{ fontSize:'13px', color: '#5a6a82' }}>Toutes les dépenses et revenus depuis le début</div>
        </div>
        <button onClick={resetAll}
          style={{ background: 'none', border: '1px solid #1e2c40', color: '#3a1818', padding: '7px 14px', borderRadius: '5px', cursor: 'pointer', fontSize:'12px', fontFamily: 'inherit', letterSpacing: '1px', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff4455'; e.currentTarget.style.color = '#ff4455'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c40'; e.currentTarget.style.color = '#3a1818'; }}
        >↺ Reset</button>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px', marginBottom: '28px' }}>
        {[
          { label: 'TOTAL INVESTI',    value: totalInvested, sub: 'PropFirm + frais' },
          { label: 'TOTAL PAYOUTS',    value: totalPayouts,  sub: `${data.payouts.length} payout${data.payouts.length > 1 ? 's' : ''}` },
          { label: 'RÉSULTAT NET',     value: netResult,     sub: 'Après payouts' },
          { label: 'ROI',              value: null,          sub: 'Payouts / investi', special: `${roi}%`, specialColor: parseFloat(roi) >= 100 ? '#00cc77' : parseFloat(roi) >= 50 ? '#f0a020' : '#ff3344' },
        ].map(({ label, value, sub, special, specialColor }) => (
          <div key={label} style={{ background: 'rgba(14,15,22,0.5)', border: '1px solid rgba(136,153,187,0.08)', borderRadius: '8px', padding: '14px 16px', borderTop: `2px solid ${value != null ? pnlColor(value) : (specialColor ?? '#5a6a82')}` }}>
            <div style={{ fontSize:'12px', color: '#3c4c64', letterSpacing: '1.5px', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: value != null ? pnlColor(value) : (specialColor ?? '#dde4ef'), lineHeight: 1 }}>
              {value != null ? `${fmt(value)} €` : special}
            </div>
            <div style={{ fontSize:'12px', color: '#3c4c64', marginTop: '4px' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      <div style={{ marginBottom: '28px', background: 'rgba(14,15,22,0.4)', border: '1px solid rgba(136,153,187,0.08)', borderRadius: '8px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px' }}>RÉCUPÉRATION</span>
          <span style={{ fontSize:'13px', color: parseFloat(roi) >= 100 ? '#8899bb' : '#f0a020', fontWeight: '700' }}>{roi}% récupéré</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(136,153,187,0.10)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, parseFloat(roi)))}%`,
            background: parseFloat(roi) >= 100 ? 'linear-gradient(90deg,#566880,#8899bb)' : parseFloat(roi) >= 50 ? 'linear-gradient(90deg,#f0a020,#ffcc44)' : 'linear-gradient(90deg,#ff4455,#ff7755)',
            borderRadius: '3px',
            transition: 'width 0.5s ease',
            boxShadow: `0 0 8px ${parseFloat(roi) >= 100 ? 'rgba(136,153,187,0.45)' : 'rgba(240,160,32,0.4)'}`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize:'12px', color: '#3c4c64' }}>
          <span>0€</span>
          <span style={{ color: '#ff4455' }}>{fmt(totalInvested)} € invested</span>
          <span style={{ color: '#8899bb' }}>{fmt(totalPayouts, false)} € payouts</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

        {/* ── LEFT: Dépenses ── */}
        <div>
          <div style={{ fontSize:'12px', color: '#ff4455', letterSpacing: '2.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4455' }} />
            DÉPENSES — {fmt(totalInvested)} €
          </div>

          {/* PropFirm */}
          <SectionHeader icon="🏆" label="PROPFIRM" total={totalPropfirm} color="#f0a020">
            {data.propfirm.map(e => (
              <EntryRow key={e.id} entry={e} accentColor="#f0a020"
                onEdit={entry => openEdit('propfirm', entry)}
                onDelete={id => handleDelete('propfirm', id)}
              />
            ))}
            <AddButton label="AJOUTER PROPFIRM" onClick={() => openAdd('propfirm')} />
          </SectionHeader>

          {/* Frais fixes */}
          <SectionHeader icon="💼" label="FRAIS FIXES" total={totalFixed} color="#ff4455">
            {data.fixed.map(e => (
              <EntryRow key={e.id} entry={e} accentColor="#ff4455"
                onEdit={entry => openEdit('fixed', entry)}
                onDelete={id => handleDelete('fixed', id)}
              />
            ))}
            <AddButton label="AJOUTER FRAIS" onClick={() => openAdd('fixed')} />
          </SectionHeader>

          {/* Total dépenses */}
          <div style={{ padding: '10px 14px', background: 'rgba(255,68,85,0.06)', border: '1px solid rgba(255,68,85,0.15)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize:'12px', color: '#ff4455', letterSpacing: '2px' }}>TOTAL DÉPENSES</span>
            <span style={{ fontSize: '17px', fontWeight: '700', color: '#ff4455' }}>{fmt(totalInvested)} €</span>
          </div>
        </div>

        {/* ── RIGHT: Payouts ── */}
        <div>
          <div style={{ fontSize:'12px', color: '#8899bb', letterSpacing: '2.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8899bb', boxShadow: '0 0 6px #8899bb' }} />
            REVENUS — {fmt(totalPayouts)} €
          </div>

          <SectionHeader icon="💸" label="PAYOUTS" total={totalPayouts} color="#8899bb">
            {data.payouts.map(e => (
              <EntryRow key={e.id} entry={e} accentColor="#8899bb"
                onEdit={entry => openEdit('payouts', entry)}
                onDelete={id => handleDelete('payouts', id)}
              />
            ))}
            <AddButton label="AJOUTER PAYOUT" onClick={() => openAdd('payouts')} />
          </SectionHeader>

          {/* Total payouts */}
          <div style={{ padding: '10px 14px', background: 'rgba(136,153,187,0.08)', border: '1px solid rgba(136,153,187,0.18)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize:'12px', color: '#8899bb', letterSpacing: '2px' }}>TOTAL PAYOUTS</span>
            <span style={{ fontSize: '17px', fontWeight: '700', color: '#8899bb' }}>{fmt(totalPayouts)} €</span>
          </div>

          {/* Net result box */}
          <div style={{
            padding: '16px',
            background: netResult >= 0 ? 'rgba(136,153,187,0.10)' : 'rgba(255,68,85,0.08)',
            border: `1px solid ${netResult >= 0 ? 'rgba(136,153,187,0.28)' : 'rgba(255,68,85,0.25)'}`,
            borderRadius: '8px',
            boxShadow: `0 0 20px ${netResult >= 0 ? 'rgba(136,153,187,0.10)' : 'rgba(255,68,85,0.08)'}`,
          }}>
            <div style={{ fontSize:'12px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '6px' }}>RÉSULTAT NET APRÈS PAYOUTS</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: pnlColor(netResult), letterSpacing: '-0.5px' }}>
              {fmt(netResult)} €
            </div>
            <div style={{ fontSize:'12px', color: '#5a6a82', marginTop: '6px' }}>
              {netResult >= 0 ? '✓ En bénéfice' : `Il manque ${fmt(Math.abs(netResult), false)} € pour rentabiliser`}
            </div>
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
