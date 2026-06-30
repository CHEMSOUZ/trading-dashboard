import { useState, useEffect, useCallback, useMemo } from 'react';

// ── Design tokens ──────────────────────────────────────────────
const T = {
  bg:        '#0c0d16',
  surface:   '#0f1120',
  border:    'rgba(136,153,187,0.13)',
  borderHov: 'rgba(136,153,187,0.28)',
  text:      '#dde4ef',
  muted:     '#5a6a82',
  faint:     '#3a4a5a',
  accent:    '#8899bb',
};

// ── Pockets ────────────────────────────────────────────────────
const POCKETS = {
  essentials: { label: 'Essentials',  color: '#4a9eff', default_pct: 50 },
  growth:     { label: 'Growth',      color: '#00cc77', default_pct: 25 },
  stability:  { label: 'Stability',   color: '#f59e0b', default_pct: 15 },
  rewards:    { label: 'Rewards',     color: '#a855f7', default_pct: 10 },
};
const POCKET_KEYS = ['essentials', 'growth', 'stability', 'rewards'];

// ── Helpers ────────────────────────────────────────────────────
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtEur(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n) { return `${Math.round(n ?? 0)} %`; }

function daysLeft() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return end.getDate() - now.getDate();
}

// ── Style helpers ──────────────────────────────────────────────
const S = {
  input: {
    width: '100%', padding: '8px 10px', background: 'rgba(136,153,187,0.07)',
    border: '1px solid rgba(136,153,187,0.18)', borderRadius: '6px',
    color: '#dde4ef', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  },
  label: { fontSize: '11px', color: '#5a6a82', marginBottom: '4px', display: 'block', letterSpacing: '0.5px' },
  btn: (col='#8899bb') => ({
    padding: '8px 18px', background: `${col}18`, border: `1px solid ${col}55`,
    borderRadius: '6px', color: col, fontSize: '12px', fontFamily: 'inherit',
    fontWeight: 700, cursor: 'pointer', letterSpacing: '1px',
  }),
  cancelBtn: {
    padding: '8px 18px', background: 'transparent', border: '1px solid rgba(136,153,187,0.20)',
    borderRadius: '6px', color: '#5a6a82', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
  },
  modal: {
    position: 'fixed', inset: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
  },
  modalBox: {
    background: '#0f1120', border: '1px solid rgba(136,153,187,0.22)',
    borderRadius: '14px', padding: '28px', width: '400px', maxWidth: '94vw',
    boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
  },
};

// ── Donut SVG ──────────────────────────────────────────────────
function DonutChart({ subcategories, transactions }) {
  const R = 80, cx = 100, cy = 100, stroke = 20;
  const circ = 2 * Math.PI * R;

  const spent = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      const sid = tx.subcategory_id;
      map[sid] = (map[sid] || 0) + tx.amount;
    }
    return map;
  }, [transactions]);

  const total = Object.values(spent).reduce((a, b) => a + b, 0);

  const { active, zero } = useMemo(() => {
    const act = subcategories
      .map(sub => ({ id: sub.id, name: sub.name, color: sub.color, amount: spent[sub.id] || 0 }))
      .filter(s => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const z = subcategories
      .filter(sub => !spent[sub.id])
      .map(sub => ({ id: sub.id, name: sub.name, color: '#3a4a5a', amount: 0 }));
    return { active: act, zero: z };
  }, [subcategories, spent]);

  let offset = circ / 4;
  const arcs = active.map(seg => {
    const len = (seg.amount / total) * circ;
    const arc = { ...seg, len, offset };
    offset += len;
    return arc;
  });

  return (
    <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={200} height={200} viewBox="0 0 200 200">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(136,153,187,0.08)" strokeWidth={stroke} />
          {arcs.map(seg => (
            <circle key={seg.id} cx={cx} cy={cy} r={R} fill="none"
              stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${seg.len} ${circ - seg.len}`}
              strokeDashoffset={-seg.offset + circ}
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#dde4ef' }}>{fmtEur(total)}</div>
          <div style={{ fontSize: '10px', color: '#5a6a82', letterSpacing: '1px' }}>dépensé</div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: '180px', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {[...active, ...zero].map(seg => {
          const pct = total > 0 ? (seg.amount / total) * 100 : 0;
          return (
            <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <div style={{ fontSize: '12px', color: seg.amount === 0 ? '#3a4a5a' : '#5a6a82', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.name}</div>
              <div style={{ fontSize: '12px', color: seg.amount === 0 ? '#3a4a5a' : '#8899bb', flexShrink: 0 }}>
                {seg.amount === 0 ? '0 €' : fmtEur(seg.amount)}
              </div>
              {seg.amount > 0 && <div style={{ fontSize: '10px', color: '#3a4a5a', flexShrink: 0 }}>{Math.round(pct)}%</div>}
            </div>
          );
        })}
        <div style={{ borderTop: '1px solid rgba(136,153,187,0.13)', marginTop: '4px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#5a6a82', fontWeight: 700 }}>Total</span>
          <span style={{ fontSize: '12px', color: '#dde4ef', fontWeight: 700 }}>{fmtEur(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── SubcategoryModal ───────────────────────────────────────────
function SubcategoryModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    color: initial?.color ?? '#4a9eff',
    allocated_amount: initial?.allocated_amount ?? '',
    pocket: initial?.pocket ?? 'essentials',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name.trim() && parseFloat(form.allocated_amount) >= 0;

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#dde4ef', marginBottom: '20px', letterSpacing: '1px' }}>
          {initial?.id ? 'MODIFIER' : 'NOUVELLE'} SOUS-CATÉGORIE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={S.label}>Poche</label>
            <select value={form.pocket} onChange={e => set('pocket', e.target.value)}
              style={{ ...S.input, cursor: 'pointer' }}>
              {POCKET_KEYS.map(k => (
                <option key={k} value={k}>{POCKETS[k].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Nom</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="ex: Loyer, Épicerie…" style={S.input} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Budget (€ / mois)</label>
              <input type="number" min="0" value={form.allocated_amount}
                onChange={e => set('allocated_amount', e.target.value)}
                placeholder="0" style={S.input} />
            </div>
            <div>
              <label style={S.label}>Couleur</label>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                style={{ ...S.input, width: '56px', padding: '4px', cursor: 'pointer', height: '36px' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.cancelBtn}>Annuler</button>
          <button disabled={!valid} onClick={() => valid && onSave(form)} style={S.btn('#4a9eff')}>
            {initial?.id ? 'Sauvegarder' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TransactionModal (add + edit) ─────────────────────────────
function TransactionModal({ subcategories, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    subcategory_id: initial?.subcategory_id ?? subcategories[0]?.id ?? '',
    amount:         initial?.amount ?? '',
    label:          initial?.label  ?? '',
    date:           initial?.date   ?? new Date().toISOString().slice(0, 10),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.subcategory_id && parseFloat(form.amount) > 0 && form.date;
  const isEdit = !!initial;

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#dde4ef', marginBottom: '20px', letterSpacing: '1px' }}>
          {isEdit ? 'MODIFIER LA DÉPENSE' : 'NOUVELLE DÉPENSE'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={S.label}>Sous-catégorie</label>
            <select value={form.subcategory_id} onChange={e => set('subcategory_id', parseInt(e.target.value))}
              style={{ ...S.input, cursor: 'pointer' }}>
              {POCKET_KEYS.flatMap(pk =>
                subcategories.filter(s => s.pocket === pk).map(s => (
                  <option key={s.id} value={s.id}>{POCKETS[pk].label} › {s.name}</option>
                ))
              )}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Montant (€)</label>
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => set('amount', e.target.value)} placeholder="0.00" style={S.input} autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={S.input} />
            </div>
          </div>
          <div>
            <label style={S.label}>Libellé (optionnel)</label>
            <input value={form.label} onChange={e => set('label', e.target.value)}
              placeholder="ex: Courses Lidl" style={S.input} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.cancelBtn}>Annuler</button>
          <button disabled={!valid} onClick={() => valid && onSave(form)} style={S.btn('#00cc77')}>
            {isEdit ? 'Sauvegarder' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TargetsModal ───────────────────────────────────────────────
function TargetsModal({ settings, onSave, onClose }) {
  const [income, setIncome] = useState(settings?.monthly_income ?? '');
  const [targets, setTargets] = useState(() => {
    const t = settings?.pocket_targets || {};
    return {
      essentials: t.essentials ?? 50,
      growth:     t.growth     ?? 25,
      stability:  t.stability  ?? 15,
      rewards:    t.rewards    ?? 10,
    };
  });
  const inc = parseFloat(income) || 0;
  const totalPct = Object.values(targets).reduce((a, b) => a + Number(b), 0);

  return (
    <div style={S.modal} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#dde4ef', marginBottom: '20px', letterSpacing: '1px' }}>
          CIBLES D'ALLOCATION
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={S.label}>Revenu mensuel net (€)</label>
            <input type="number" min="0" value={income}
              onChange={e => setIncome(e.target.value)} placeholder="ex: 3000" style={S.input} autoFocus />
          </div>
          {POCKET_KEYS.map(pk => {
            const col = POCKETS[pk].color;
            const pct = Number(targets[pk]) || 0;
            const eur = inc > 0 ? Math.round(inc * pct / 100) : null;
            return (
              <div key={pk}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', color: col, marginBottom: 0, display: 'block' }}>{POCKETS[pk].label}</label>
                  <span style={{ fontSize: '11px', color: '#5a6a82' }}>
                    {eur !== null ? `${fmtEur(eur)} · ` : ''}{pct}%
                  </span>
                </div>
                <input type="number" min="0" max="100" value={targets[pk]}
                  onChange={e => setTargets(t => ({ ...t, [pk]: e.target.value }))}
                  style={{ ...S.input, borderColor: `${col}44` }} />
              </div>
            );
          })}
          {totalPct !== 100 && (
            <div style={{ fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '8px 12px' }}>
              Total : {totalPct}% — doit être égal à 100%
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.cancelBtn}>Annuler</button>
          <button onClick={() => onSave(income, targets)} style={S.btn('#8899bb')}>
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PocketAccordion ────────────────────────────────────────────
function PocketAccordion({ pocketKey, subcategories, transactions, targetEur, targetPct, onAddSub, onEditSub, onDeleteSub, isDemoMode }) {
  const [open, setOpen] = useState(pocketKey === 'essentials');
  const { label, color } = POCKETS[pocketKey];

  const spent = useMemo(() => {
    const subIds = new Set(subcategories.map(s => s.id));
    return transactions
      .filter(tx => subIds.has(tx.subcategory_id))
      .reduce((a, tx) => a + tx.amount, 0);
  }, [subcategories, transactions]);

  const subSpent = useCallback((subId) =>
    transactions.filter(tx => tx.subcategory_id === subId).reduce((a, tx) => a + tx.amount, 0),
  [transactions]);

  const delta = targetEur ? spent - targetEur : null;
  const overBudget = delta !== null && delta > 0;
  const barPct = targetEur > 0 ? Math.min((spent / targetEur) * 100, 100) : 0;

  return (
    <div style={{ border: `1px solid rgba(136,153,187,0.13)`, borderLeft: `3px solid ${color}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer', background: open ? 'rgba(136,153,187,0.04)' : 'transparent', userSelect: 'none' }}>
        <span style={{ fontSize: '11px', color: '#3a4a5a', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', lineHeight: 1 }}>▶</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color }}>{label}</span>
            {targetEur !== null && targetEur > 0 && (
              <span style={{ fontSize: '11px', color: '#5a6a82' }}>{fmtEur(targetEur)} · {fmtPct(targetPct)}</span>
            )}
            <span style={{ fontSize: '11px', color: '#3a4a5a' }}>· {subcategories.length} sous-cat.</span>
          </div>
          <div style={{ marginTop: '6px', height: '4px', background: 'rgba(136,153,187,0.10)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${barPct}%`, background: overBudget ? '#ff3344' : color, borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: overBudget ? '#ff3344' : '#dde4ef' }}>{fmtEur(spent)}</div>
          {delta !== null && delta !== 0 && (
            <div style={{ fontSize: '11px', color: overBudget ? '#ff3344' : '#00cc77', marginTop: '1px' }}>
              {overBudget ? '+' : ''}{fmtEur(delta)}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {subcategories.length === 0 && (
            <div style={{ fontSize: '12px', color: '#3a4a5a', padding: '8px 0 4px' }}>Aucune sous-catégorie</div>
          )}
          {subcategories.map(sub => {
            const s = subSpent(sub.id);
            const alloc = sub.allocated_amount || 0;
            const subPct = alloc > 0 ? Math.min((s / alloc) * 100, 100) : 0;
            const over = alloc > 0 && s > alloc;
            return (
              <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0 7px 12px', borderTop: '1px solid rgba(136,153,187,0.09)' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: sub.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#dde4ef', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</div>
                  <div style={{ width: '110px', height: '3px', background: 'rgba(136,153,187,0.10)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${subPct}%`, background: over ? '#ff3344' : sub.color, borderRadius: '2px' }} />
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#5a6a82', textAlign: 'right', flexShrink: 0, minWidth: '100px' }}>
                  <span style={{ color: over ? '#ff3344' : '#dde4ef' }}>{fmtEur(s)}</span>
                  {alloc > 0 && <span style={{ color: '#3a4a5a' }}> / {fmtEur(alloc)}</span>}
                </div>
                {!isDemoMode && <button onClick={() => onEditSub(sub)} title="Modifier"
                  style={{ background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', padding: '2px 4px', fontSize: '12px' }}>✎</button>}
                {!isDemoMode && <button onClick={() => onDeleteSub(sub.id)} title="Supprimer"
                  style={{ background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', padding: '2px 4px', fontSize: '12px' }}>✕</button>}
              </div>
            );
          })}
          {!isDemoMode && (
            <button onClick={() => onAddSub(pocketKey)}
              style={{ marginTop: '8px', background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', fontSize: '12px', padding: '4px 0', fontFamily: 'inherit' }}>
              + Ajouter une sous-catégorie à {label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function Budget() {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(monthKey(now));
  const [subcategories, setSubcategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState(null);

  const [isDemoMode, setIsDemoMode]       = useState(false);
  const [modalSubcat, setModalSubcat]     = useState(null);
  const [modalTx, setModalTx]             = useState(false);
  const [modalEditTx, setModalEditTx]     = useState(null); // transaction à éditer
  const [modalTargets, setModalTargets]   = useState(false);
  const [txExpanded, setTxExpanded]       = useState(false);

  const load = useCallback(async (mk) => {
    const [subRes, txRes, stRes] = await Promise.all([
      window.budget.getSubcategories(),
      window.budget.getTransactions(mk),
      window.budget.getSettings(mk),
    ]);
    if (subRes?.ok)  setSubcategories(subRes.data ?? []);
    if (txRes?.ok)   setTransactions(txRes.data ?? []);
    if (stRes?.ok && stRes.data?.length) {
      setSettings(stRes.data[0]);
    } else {
      const latest = await window.budget.getLatestSettings();
      if (latest?.ok && latest.data) setSettings({ ...latest.data, month_key: mk });
      else setSettings(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res  = await window.auth.getSession();
      const user = res?.data?.user;
      setIsDemoMode(!!user && user.subscription_status !== 'active');
    })();
  }, []);

  useEffect(() => { load(currentMonth); }, [currentMonth, load]);

  // ── Derived ───────────────────────────────────────────────────
  const income = parseFloat(settings?.monthly_income) || 0;

  const parsedTargets = useMemo(() => {
    const t = settings?.pocket_targets;
    return (t && typeof t === 'object') ? t : {};
  }, [settings?.pocket_targets]);

  const pocketTargetPct = pk => Number(parsedTargets[pk] ?? POCKETS[pk].default_pct);
  const pocketTargetEur = pk => income > 0 ? income * pocketTargetPct(pk) / 100 : null;
  const pocketSubcats   = pk => subcategories.filter(s => s.pocket === pk);

  const pocketSpent = useCallback(pk => {
    const ids = new Set(pocketSubcats(pk).map(s => s.id));
    return transactions.filter(tx => ids.has(tx.subcategory_id)).reduce((a, tx) => a + tx.amount, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcategories, transactions]);

  const totalSpent = transactions.reduce((a, tx) => a + tx.amount, 0);
  const totalLeft  = income - totalSpent;

  // ── Priority banner ───────────────────────────────────────────
  const priorityBanner = useMemo(() => {
    if (!income) return null;
    let worstKey = null, worstOverflow = 0;
    let mostUnderKey = null, mostUnderDelta = 0;
    for (const pk of POCKET_KEYS) {
      const tgt = pocketTargetEur(pk) || 0;
      const sp  = pocketSpent(pk);
      if (sp - tgt > worstOverflow) { worstOverflow = sp - tgt; worstKey = pk; }
      if (tgt - sp > mostUnderDelta) { mostUnderDelta = tgt - sp; mostUnderKey = pk; }
    }
    if (!worstKey) return null;
    return { worstKey, worstOverflow, mostUnderKey, mostUnderDelta };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, subcategories, transactions, parsedTargets]);

  // ── Handlers ──────────────────────────────────────────────────
  async function handleSaveSub(form) {
    const payload = {
      name: form.name.trim(), color: form.color,
      allocated_amount: parseFloat(form.allocated_amount) || 0,
      pocket: form.pocket, sort_order: 0,
    };
    if (modalSubcat.mode === 'edit') {
      await window.budget.updateSubcategory(modalSubcat.sub.id, payload);
    } else {
      await window.budget.addSubcategory(payload);
    }
    setModalSubcat(null);
    load(currentMonth);
  }

  async function handleDeleteSub(id) {
    if (!window.confirm('Supprimer cette sous-catégorie et ses dépenses associées ?')) return;
    await window.budget.deleteSubcategory(id);
    load(currentMonth);
  }

  async function handleSaveTx(form) {
    await window.budget.addTransaction({
      subcategory_id: parseInt(form.subcategory_id),
      amount: parseFloat(form.amount),
      label: form.label.trim(),
      date: form.date,
      month_key: currentMonth,
    });
    setModalTx(false);
    load(currentMonth);
  }

  async function handleUpdateTx(form) {
    await window.budget.updateTransaction(modalEditTx.id, {
      subcategory_id: parseInt(form.subcategory_id),
      amount: parseFloat(form.amount),
      label: form.label.trim(),
      date: form.date,
    });
    setModalEditTx(null);
    load(currentMonth);
  }

  async function handleDeleteTx(id) {
    await window.budget.deleteTransaction(id);
    load(currentMonth);
  }

  async function handleSaveTargets(incomeVal, targets) {
    await window.budget.updateSettings(currentMonth, parseFloat(incomeVal) || 0, targets);
    setModalTargets(false);
    load(currentMonth);
  }

  function navigateMonth(dir) {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setCurrentMonth(monthKey(d));
  }

  // ── Render ────────────────────────────────────────────────────
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const [cy, cm] = currentMonth.split('-').map(Number);
  const isCurrentMonth = currentMonth === monthKey(now);

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto', fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: '14px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#dde4ef', letterSpacing: '-0.5px' }}>Budget</div>
          <div style={{ fontSize: '12px', color: '#5a6a82', marginTop: '2px', letterSpacing: '0.5px' }}>Gestion de vos finances personnelles</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => navigateMonth(-1)} style={{ ...S.btn(), padding: '6px 10px' }}>‹</button>
          <span style={{ fontSize: '13px', color: '#dde4ef', minWidth: '100px', textAlign: 'center' }}>
            {MONTHS[cm - 1]} {cy}
          </span>
          <button onClick={() => navigateMonth(1)} style={{ ...S.btn(), padding: '6px 10px' }}>›</button>
        </div>
      </div>

      {isDemoMode && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(136,153,187,0.07)', border: '1px solid rgba(136,153,187,0.20)', borderRadius: '8px', fontSize: '12px', color: '#8899bb' }}>
          🔒 <strong style={{ color: '#dde4ef' }}>Mode démo</strong> — Données fictives à titre d'exemple. Les modifications sont désactivées.
        </div>
      )}

      {/* ── Hero cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Revenu mensuel', value: fmtEur(income), sub: income === 0 ? 'non défini' : null, col: '#8899bb' },
          { label: 'Dépensé', value: fmtEur(totalSpent), sub: income > 0 ? `${Math.round((totalSpent / income) * 100)}% du budget` : null, col: totalSpent > income ? '#ff3344' : '#dde4ef' },
          { label: 'Restant', value: fmtEur(totalLeft), sub: null, col: totalLeft < 0 ? '#ff3344' : '#00cc77', big: true },
          { label: 'Jours restants', value: isCurrentMonth ? daysLeft() : '—', sub: isCurrentMonth ? 'avant fin de mois' : null, col: '#dde4ef' },
        ].map(({ label, value, sub, col, big }) => (
          <div key={label} style={{ background: '#0f1120', border: '1px solid rgba(136,153,187,0.13)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '12px', color: '#5a6a82', marginBottom: '6px', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: big ? '32px' : '22px', fontWeight: 700, color: col, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: '11px', color: '#3a4a5a', marginTop: '4px' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Priority banner ── */}
      {priorityBanner && (
        <div style={{ background: 'rgba(255,51,68,0.07)', border: '1px solid rgba(255,51,68,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px' }}>⚠</span>
          <div>
            <div style={{ fontSize: '13px', color: '#ff6677', fontWeight: 700 }}>
              {POCKETS[priorityBanner.worstKey].label} dépasse la cible de {fmtEur(priorityBanner.worstOverflow)}
            </div>
            {priorityBanner.mostUnderKey && priorityBanner.mostUnderKey !== priorityBanner.worstKey && (
              <div style={{ fontSize: '12px', color: '#5a6a82', marginTop: '2px' }}>
                Suggestion : réduire {POCKETS[priorityBanner.worstKey].label} · la poche {POCKETS[priorityBanner.mostUnderKey].label} dispose encore de {fmtEur(priorityBanner.mostUnderDelta)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Allocation par poche ── */}
      <div style={{ background: '#0f1120', border: '1px solid rgba(136,153,187,0.13)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#8899bb', letterSpacing: '1px' }}>ALLOCATION PAR POCHE</div>
          <button onClick={() => !isDemoMode && setModalTargets(true)} disabled={isDemoMode}
            style={{ ...S.btn(), padding: '5px 12px', fontSize: '11px', opacity: isDemoMode ? 0.4 : 1, cursor: isDemoMode ? 'not-allowed' : 'pointer' }}>Configurer</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {POCKET_KEYS.map(pk => {
            const tgtPct = pocketTargetPct(pk);
            const tgtEur = pocketTargetEur(pk);
            const sp = pocketSpent(pk);
            const pct = tgtEur > 0 ? Math.min((sp / tgtEur) * 100, 100) : 0;
            const over = tgtEur && sp > tgtEur;
            const { color, label } = POCKETS[pk];
            return (
              <div key={pk}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color }}>{label}</span>
                  <span style={{ fontSize: '12px', color: '#5a6a82' }}>
                    <span style={{ color: over ? '#ff3344' : '#dde4ef' }}>{fmtEur(sp)}</span>
                    {tgtEur !== null && <span style={{ color: '#3a4a5a' }}> / {fmtEur(tgtEur)} ({tgtPct}%)</span>}
                  </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(136,153,187,0.09)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: over ? '#ff3344' : color, borderRadius: '3px', transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sous-catégories accordion ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#8899bb', letterSpacing: '1px' }}>SOUS-CATÉGORIES</div>
          <button onClick={() => !isDemoMode && setModalSubcat({ mode: 'add', pocket: 'essentials' })} disabled={isDemoMode}
            style={{ ...S.btn(), padding: '5px 12px', fontSize: '11px', opacity: isDemoMode ? 0.4 : 1, cursor: isDemoMode ? 'not-allowed' : 'pointer' }}>+ Ajouter</button>
        </div>
        {POCKET_KEYS.map(pk => (
          <PocketAccordion
            key={pk}
            pocketKey={pk}
            subcategories={pocketSubcats(pk)}
            transactions={transactions}
            targetEur={pocketTargetEur(pk)}
            targetPct={pocketTargetPct(pk)}
            onAddSub={pocket => setModalSubcat({ mode: 'add', pocket })}
            onEditSub={sub => setModalSubcat({ mode: 'edit', sub })}
            onDeleteSub={handleDeleteSub}
            isDemoMode={isDemoMode}
          />
        ))}
      </div>

      {/* ── Donut ── */}
      {subcategories.length > 0 && (
        <div style={{ background: '#0f1120', border: '1px solid rgba(136,153,187,0.13)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#8899bb', letterSpacing: '1px', marginBottom: '16px' }}>RÉPARTITION DES DÉPENSES</div>
          <DonutChart subcategories={subcategories} transactions={transactions} />
        </div>
      )}

      {/* ── Transactions ── */}
      <div style={{ background: '#0f1120', border: '1px solid rgba(136,153,187,0.13)', borderRadius: '12px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#8899bb', letterSpacing: '1px' }}>DÉPENSES</div>
            <span style={{ fontSize: '11px', color: '#3a4a5a' }}>({transactions.length})</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {transactions.length > 5 && (
              <button onClick={() => setTxExpanded(e => !e)} style={{ ...S.btn(), padding: '5px 12px', fontSize: '11px' }}>
                {txExpanded ? 'Réduire' : 'Tout voir'}
              </button>
            )}
            <button onClick={() => !isDemoMode && subcategories.length > 0 && setModalTx(true)} disabled={isDemoMode}
              style={{ ...S.btn('#00cc77'), padding: '5px 12px', fontSize: '11px', opacity: isDemoMode ? 0.4 : 1, cursor: isDemoMode ? 'not-allowed' : 'pointer' }}>
              + Dépense
            </button>
          </div>
        </div>
        {transactions.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#3a4a5a', textAlign: 'center', padding: '20px 0' }}>
            Aucune dépense pour {MONTHS[cm - 1]} {cy}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {(txExpanded ? transactions : transactions.slice(0, 5)).map(tx => (
              <div key={tx.id}
                onClick={() => !isDemoMode && setModalEditTx(tx)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 4px', borderTop: '1px solid rgba(136,153,187,0.09)', cursor: isDemoMode ? 'default' : 'pointer', borderRadius: '4px', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(136,153,187,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: tx.subcategory_color || '#3a4a5a', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#dde4ef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.label || tx.subcategory_name || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#3a4a5a' }}>
                    {tx.subcategory_name}{tx.subcategory_name && ' · '}{tx.date}
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#dde4ef', fontWeight: 700, flexShrink: 0 }}>{fmtEur(tx.amount)}</div>
                {!isDemoMode && <button onClick={e => { e.stopPropagation(); setModalEditTx(tx); }} title="Modifier"
                  style={{ background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', padding: '2px 4px', fontSize: '12px' }}>✎</button>}
                {!isDemoMode && <button onClick={e => { e.stopPropagation(); handleDeleteTx(tx.id); }} title="Supprimer"
                  style={{ background: 'none', border: 'none', color: '#3a4a5a', cursor: 'pointer', padding: '2px 4px', fontSize: '12px' }}>✕</button>}
              </div>
            ))}
            {!txExpanded && transactions.length > 5 && (
              <div style={{ fontSize: '11px', color: '#3a4a5a', textAlign: 'center', paddingTop: '8px' }}>
                +{transactions.length - 5} dépenses masquées
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modalSubcat && (
        <SubcategoryModal
          initial={modalSubcat.mode === 'edit' ? modalSubcat.sub : { pocket: modalSubcat.pocket }}
          onSave={handleSaveSub}
          onClose={() => setModalSubcat(null)}
        />
      )}
      {modalTx && subcategories.length > 0 && (
        <TransactionModal subcategories={subcategories} onSave={handleSaveTx} onClose={() => setModalTx(false)} />
      )}
      {modalEditTx && subcategories.length > 0 && (
        <TransactionModal subcategories={subcategories} initial={modalEditTx} onSave={handleUpdateTx} onClose={() => setModalEditTx(null)} />
      )}
      {modalTargets && (
        <TargetsModal settings={settings} onSave={handleSaveTargets} onClose={() => setModalTargets(false)} />
      )}
    </div>
  );
}
