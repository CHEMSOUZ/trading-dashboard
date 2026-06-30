import { useState, useEffect, useCallback } from 'react';

// ── Design tokens ────────────────────────────────────────────
const T = {
  border:   'rgba(136,153,187,0.12)',
  borderMd: 'rgba(136,153,187,0.20)',
  bg2:      'rgba(20,23,34,0.75)',
  text:     '#dde4ef',
  textSub:  '#8899bb',
  textTert: '#5a6a82',
  success:  '#1D9E75',
  danger:   '#E24B4A',
  warn:     '#BA7517',
  rLg:      '10px',
  rMd:      '8px',
  rSm:      '6px',
};

const POCKETS = {
  essentials: { label: 'Essentials', color: '#6FA83B', bg: 'rgba(111,168,59,0.07)'  },
  growth:     { label: 'Growth',     color: '#1D9E75', bg: 'rgba(29,158,117,0.07)'  },
  stability:  { label: 'Stability',  color: '#3B82C4', bg: 'rgba(59,130,196,0.07)'  },
  rewards:    { label: 'Rewards',    color: '#7F77DD', bg: 'rgba(127,119,221,0.07)' },
};
const POCKET_KEYS = ['essentials', 'growth', 'stability', 'rewards'];
const DEFAULT_TARGETS = { essentials: 50, growth: 25, stability: 15, rewards: 10 };
const CAT_COLORS = ['#E24B4A','#1D9E75','#3B82C4','#7F77DD','#6FA83B','#BA7517','#00ddff','#8899bb','#f59e0b','#e879f9'];

// ── Helpers ──────────────────────────────────────────────────
function fmt(n) {
  return (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function offsetMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysRemainingInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  const today = new Date();
  const endOfMonth = new Date(y, m, 0);
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.ceil((endOfMonth - todayMid) / 86400000));
}

function parseTargets(raw) {
  if (raw && typeof raw === 'object') return { ...DEFAULT_TARGETS, ...raw };
  try { return { ...DEFAULT_TARGETS, ...JSON.parse(raw ?? '{}') }; } catch { return { ...DEFAULT_TARGETS }; }
}

// ── Donut SVG ────────────────────────────────────────────────
function DonutChart({ segments, total }) {
  const R = 54, SW = 16, cx = 80, cy = 80;
  const circ = 2 * Math.PI * R;
  let acc = 0;
  const visibleSegments = segments.filter(s => s.value > 0);
  return (
    <svg width="160" height="160" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(136,153,187,0.10)" strokeWidth={SW} />
      {visibleSegments.map((seg, i) => {
        if (total <= 0) return null;
        const len = (seg.value / total) * circ;
        const offset = circ / 4 - acc;
        acc += len;
        return (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none"
            stroke={seg.color} strokeWidth={SW}
            strokeDasharray={`${len} ${circ}`}
            strokeDashoffset={offset}
          />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fill={T.text} fontSize="15" fontWeight="600" fontFamily="inherit">
        {fmt(total)}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill={T.textTert} fontSize="9" fontFamily="inherit">
        dépensé
      </text>
    </svg>
  );
}

// ── Modal helpers ─────────────────────────────────────────────
function ModalBackdrop({ children, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9001 }}>
        {children}
      </div>
    </>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: T.text }}>{title}</div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textTert, cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}>✕</button>
    </div>
  );
}

// ── CategoryModal ─────────────────────────────────────────────
function CategoryModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? CAT_COLORS[0]);
  const [amount, setAmount] = useState(initial?.allocated_amount != null ? String(initial.allocated_amount) : '');
  const [pocket, setPocket] = useState(initial?.pocket ?? '');

  async function handleSave() {
    if (!name.trim()) return;
    await onSave({ name: name.trim(), color, allocated_amount: parseFloat(amount) || 0, pocket: pocket || null });
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={modalStyle}>
        <ModalHeader title={initial ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={onClose} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <label style={labelStyle}>
            Nom
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Courses, Loyer..."
              style={inputStyle} autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </label>
          <label style={labelStyle}>
            Montant alloué (€/mois)
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" style={inputStyle} min="0" />
          </label>
          <label style={labelStyle}>
            Poche budgétaire
            <select value={pocket} onChange={e => setPocket(e.target.value)} style={inputStyle}>
              <option value="">Aucune</option>
              {POCKET_KEYS.map(k => <option key={k} value={k}>{POCKETS[k].label}</option>)}
            </select>
          </label>
          <div>
            <div style={{ fontSize: '11px', color: T.textTert, marginBottom: '6px' }}>Couleur</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CAT_COLORS.map(c => (
                <div key={c} onClick={() => setColor(c)} style={{
                  width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer',
                  border: `2px solid ${color === c ? 'white' : 'transparent'}`, boxSizing: 'border-box',
                }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
            <button onClick={handleSave} style={saveBtnStyle}>Enregistrer</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ── TransactionModal ──────────────────────────────────────────
function TransactionModal({ categories, prefillCatId, monthKey, onClose, onSave }) {
  const [catId, setCatId] = useState(prefillCatId ?? categories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  async function handleSave() {
    if (!label.trim() || !amount || !catId) return;
    await onSave({ category_id: Number(catId), amount: parseFloat(amount), label: label.trim(), date, month_key: monthKey });
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={modalStyle}>
        <ModalHeader title="Ajouter une dépense" onClose={onClose} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          <label style={labelStyle}>
            Catégorie
            <select value={catId} onChange={e => setCatId(e.target.value)} style={inputStyle}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Libellé
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Lidl, EDF..."
              style={inputStyle} autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </label>
          <label style={labelStyle}>
            Montant (€)
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" style={inputStyle} min="0" step="0.01" />
          </label>
          <label style={labelStyle}>
            Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
            <button onClick={handleSave} style={saveBtnStyle}>Ajouter</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ── TargetsModal ──────────────────────────────────────────────
function TargetsModal({ targets, onClose, onSave }) {
  const [vals, setVals] = useState({ ...targets });
  const total = POCKET_KEYS.reduce((s, k) => s + (parseFloat(vals[k]) || 0), 0);

  async function handleSave() {
    const t = {};
    for (const k of POCKET_KEYS) t[k] = parseFloat(vals[k]) || 0;
    await onSave(t);
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div style={modalStyle}>
        <ModalHeader title="Modifier les cibles d'allocation" onClose={onClose} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          {POCKET_KEYS.map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: POCKETS[k].color, fontWeight: '600', minWidth: '80px' }}>{POCKETS[k].label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                <input type="number" value={vals[k]} onChange={e => setVals(v => ({ ...v, [k]: e.target.value }))}
                  style={{ ...inputStyle, width: '70px', textAlign: 'right' }} min="0" max="100" />
                <span style={{ fontSize: '12px', color: T.textTert }}>%</span>
              </div>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: Math.abs(total - 100) < 0.1 ? T.success : T.danger, textAlign: 'right' }}>
            Total : {total.toFixed(0)} % {Math.abs(total - 100) < 0.1 ? '✓' : '(doit être = 100 %)'}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
            <button onClick={handleSave} style={{ ...saveBtnStyle, opacity: Math.abs(total - 100) > 0.1 ? 0.5 : 1 }}
              disabled={Math.abs(total - 100) > 0.1}>
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ── Budget (main) ─────────────────────────────────────────────
export default function Budget() {
  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState({ monthly_income: 0, pocket_targets: { ...DEFAULT_TARGETS } });
  const [expandedCat, setExpandedCat] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddCat, setShowAddCat] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [showAddTx, setShowAddTx] = useState(false);
  const [prefillCatId, setPrefillCatId] = useState(null);
  const [showTargets, setShowTargets] = useState(false);

  // Inline income edit
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, txRes, setRes] = await Promise.all([
        window.budget.getCategories(),
        window.budget.getTransactions(monthKey),
        window.budget.getSettings(monthKey),
      ]);
      setCategories(catRes.ok ? catRes.data : []);
      setTransactions(txRes.ok ? txRes.data : []);

      if (setRes.ok && setRes.data) {
        setSettings({ monthly_income: setRes.data.monthly_income, pocket_targets: parseTargets(setRes.data.pocket_targets) });
      } else {
        // Initialize from latest month or defaults
        const latestRes = await window.budget.getLatestSettings();
        let income = 0, targets = { ...DEFAULT_TARGETS };
        if (latestRes.ok && latestRes.data) {
          income = latestRes.data.monthly_income;
          targets = parseTargets(latestRes.data.pocket_targets);
        }
        await window.budget.updateSettings(monthKey, income, targets);
        setSettings({ monthly_income: income, pocket_targets: targets });
      }
    } catch (e) {
      console.error('Budget load error:', e);
    }
    setLoading(false);
  }, [monthKey]);

  useEffect(() => { load(); }, [load]);

  // ── Computed values
  const totalBudget = settings.monthly_income;
  const spent = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const remaining = totalBudget - spent;
  const spentPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;
  const daysLeft = daysRemainingInMonth(monthKey);
  const perDay = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;
  const targets = settings.pocket_targets;

  const catSpent = {};
  for (const tx of transactions) catSpent[tx.category_id] = (catSpent[tx.category_id] || 0) + tx.amount;

  const pocketSpent = { essentials: 0, growth: 0, stability: 0, rewards: 0 };
  let unassignedSpent = 0;
  for (const cat of categories) {
    const s = catSpent[cat.id] || 0;
    if (s <= 0) continue;
    if (cat.pocket && pocketSpent[cat.pocket] !== undefined) pocketSpent[cat.pocket] += s;
    else unassignedSpent += s;
  }

  async function saveIncome() {
    const val = parseFloat(incomeInput) || 0;
    await window.budget.updateSettings(monthKey, val, targets);
    setSettings(s => ({ ...s, monthly_income: val }));
    setEditingIncome(false);
  }

  async function handleDeleteTx(id) {
    await window.budget.deleteTransaction(id);
    await load();
  }

  async function handleDeleteCat(id) {
    if (!window.confirm('Supprimer cette catégorie et toutes ses dépenses ?')) return;
    await window.budget.deleteCategory(id);
    setExpandedCat(null);
    await load();
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', color: T.textTert, fontSize: '12px', letterSpacing: '2px', textAlign: 'center' }}>
        CHARGEMENT...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '11px', color: T.textTert, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
            FINANCES PERSONNELLES
          </div>
          <div style={{ fontSize: '22px', fontWeight: '500', color: T.text }}>Gestion du budget</div>
          <div style={{ fontSize: '12px', color: T.textTert, marginTop: '3px' }}>Vie courante · Séparé du trading</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setMonthKey(k => offsetMonth(k, -1))} style={navBtnStyle}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontSize: '13px', fontWeight: '500', color: T.text, minWidth: '140px', textAlign: 'center', textTransform: 'capitalize' }}>
            {monthLabel(monthKey)}
          </span>
          <button onClick={() => setMonthKey(k => offsetMonth(k, +1))} style={navBtnStyle}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* ── HERO (4 colonnes) ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        {/* Restant */}
        <div style={{
          background: remaining >= 0 ? 'rgba(8,26,16,0.9)' : 'rgba(18,8,8,0.9)',
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${remaining >= 0 ? T.success : T.danger}`,
          borderRadius: T.rLg, padding: '14px 16px',
        }}>
          <div style={{ fontSize: '10px', color: T.textTert, letterSpacing: '1.5px', marginBottom: '8px' }}>RESTANT À DÉPENSER</div>
          <div style={{ fontSize: '28px', fontWeight: '500', color: remaining >= 0 ? T.success : T.danger }}>
            {remaining >= 0 ? '+' : ''}{fmt(remaining)} €
          </div>
          <div style={{ fontSize: '11px', color: T.textTert, marginTop: '4px' }}>Sur {fmt(totalBudget)} € de budget</div>
        </div>

        {/* Revenus */}
        <div onClick={() => { setIncomeInput(String(totalBudget)); setEditingIncome(true); }} title="Cliquer pour modifier"
          style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: '14px 16px', cursor: 'pointer' }}>
          <div style={{ fontSize: '10px', color: T.textTert, letterSpacing: '1.5px', marginBottom: '8px' }}>REVENUS DU MOIS</div>
          {editingIncome ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
              <input autoFocus value={incomeInput} onChange={e => setIncomeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveIncome(); if (e.key === 'Escape') setEditingIncome(false); }}
                style={{ flex: 1, background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.borderMd}`, borderRadius: '4px', color: T.text, fontSize: '18px', padding: '2px 6px', fontFamily: 'inherit', outline: 'none', width: '0' }} />
              <button onClick={saveIncome} style={{ background: 'none', border: 'none', color: T.success, cursor: 'pointer', fontSize: '16px', padding: '0 2px' }}>✓</button>
            </div>
          ) : (
            <div style={{ fontSize: '22px', fontWeight: '500', color: T.success }}>{fmt(totalBudget)} €</div>
          )}
          <div style={{ fontSize: '11px', color: T.textTert, marginTop: '4px' }}>Revenus mensuels nets</div>
        </div>

        {/* Dépensé */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: '14px 16px' }}>
          <div style={{ fontSize: '10px', color: T.textTert, letterSpacing: '1.5px', marginBottom: '8px' }}>DÉPENSÉ</div>
          <div style={{ fontSize: '22px', fontWeight: '500', color: T.text }}>{fmt(spent)} €</div>
          <div style={{ fontSize: '11px', color: T.textTert, marginTop: '4px' }}>{spentPct.toFixed(0)} % du budget</div>
        </div>

        {/* Jours restants */}
        <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: '14px 16px' }}>
          <div style={{ fontSize: '10px', color: T.textTert, letterSpacing: '1.5px', marginBottom: '8px' }}>JOURS RESTANTS</div>
          <div style={{ fontSize: '22px', fontWeight: '500', color: T.text }}>{daysLeft} j</div>
          <div style={{ fontSize: '11px', color: T.textTert, marginTop: '4px' }}>
            {perDay > 0 ? `${fmt(perDay)} €/jour dispo` : remaining <= 0 ? 'Budget dépassé' : '—'}
          </div>
        </div>
      </div>

      {/* ── RÉPARTITION GLOBALE ─────────────────────────────── */}
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: T.rLg, padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: T.textTert, letterSpacing: '1.5px' }}>RÉPARTITION DU BUDGET</span>
          <span style={{ fontSize: '12px', color: spentPct > 100 ? T.danger : T.textSub }}>{spentPct.toFixed(0)} % utilisé</span>
        </div>
        <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(136,153,187,0.10)', overflow: 'hidden', display: 'flex' }}>
          {categories.map(cat => {
            const s = catSpent[cat.id] || 0;
            if (s <= 0 || totalBudget <= 0) return null;
            const w = Math.min(100, (s / totalBudget) * 100);
            return <div key={cat.id} title={`${cat.name}: ${fmt(s)} €`}
              style={{ width: `${w}%`, background: cat.color, flexShrink: 0 }} />;
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: T.textTert }}>
          <span>0 €</span>
          <span style={{ color: T.textSub }}>{fmt(spent)} € sur {fmt(totalBudget)} €</span>
          <span>{fmt(totalBudget)} €</span>
        </div>
      </div>

      {/* ── MODULE 50/25/15/10 ──────────────────────────────── */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.rLg, overflow: 'hidden', marginBottom: '16px' }}>
        {/* Header */}
        <div style={{ background: T.bg2, padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textTert} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
            <span style={{ fontSize: '11px', color: T.textTert, letterSpacing: '1.5px' }}>
              ALLOCATION {POCKET_KEYS.map(k => targets[k]).join('/')}
            </span>
          </div>
          <button onClick={() => setShowTargets(true)} style={actionBtnStyle}>Modifier les cibles</button>
        </div>

        {/* 4 pocket cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {POCKET_KEYS.map((key, i) => {
            const p = POCKETS[key];
            const target = targets[key] || 0;
            const actual = spent > 0 ? (pocketSpent[key] / spent) * 100 : 0;
            const delta = actual - target;
            const isOver  = delta > 3;
            const isUnder = delta < -3;
            const badgeColor = isOver ? T.danger : isUnder ? T.success : T.textTert;
            const badgeBg    = isOver ? 'rgba(226,75,74,0.12)' : isUnder ? 'rgba(29,158,117,0.12)' : 'rgba(136,153,187,0.08)';
            const deltaLabel = Math.abs(delta) < 3 ? '✓' : `${isOver ? '+' : '-'}${Math.abs(delta).toFixed(0)}pt`;
            return (
              <div key={key} style={{
                background: p.bg, borderLeft: `3px solid ${p.color}`,
                borderRight: i < 3 ? `1px solid ${T.border}` : 'none',
                padding: '12px 14px',
              }}>
                <div style={{ fontSize: '9px', color: p.color, letterSpacing: '1.5px', fontWeight: '600', marginBottom: '4px' }}>
                  {p.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '500', color: T.text }}>{fmt(pocketSpent[key])} €</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: T.textTert }}>Cible {target} %</span>
                  <span style={{ fontSize: '9px', background: badgeBg, color: badgeColor, padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>{deltaLabel}</span>
                </div>
                <div style={{ fontSize: '10px', color: T.textTert, marginTop: '2px' }}>Réel : {actual.toFixed(1)} %</div>
              </div>
            );
          })}
        </div>

        {/* Stacked bar */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ position: 'relative', height: '14px', borderRadius: '7px', background: 'rgba(136,153,187,0.08)', overflow: 'hidden', display: 'flex' }}>
            {POCKET_KEYS.map(key => {
              const s = pocketSpent[key];
              if (s <= 0 || spent <= 0) return null;
              return <div key={key} style={{ width: `${(s / spent) * 100}%`, background: POCKETS[key].color, flexShrink: 0 }} />;
            })}
            {/* Target markers */}
            {(() => {
              let cum = 0;
              return POCKET_KEYS.slice(0, -1).map(key => {
                cum += targets[key] || 0;
                return (
                  <div key={key} style={{
                    position: 'absolute', left: `${cum}%`, top: 0, bottom: 0,
                    width: '2px', background: 'rgba(255,255,255,0.25)', transform: 'translateX(-50%)',
                  }} />
                );
              });
            })()}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            {POCKET_KEYS.map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: POCKETS[key].color }} />
                <span style={{ fontSize: '10px', color: T.textTert }}>{POCKETS[key].label}</span>
              </div>
            ))}
          </div>
        </div>

        {unassignedSpent > 0 && (
          <div style={{ padding: '8px 16px', background: 'rgba(186,117,23,0.08)', borderTop: `1px solid rgba(186,117,23,0.20)`, fontSize: '11px', color: T.warn }}>
            ⚠ {fmt(unassignedSpent)} € non assignés à une poche — édite les catégories pour les assigner
          </div>
        )}
      </div>

      {/* ── CATÉGORIES ─────────────────────────────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: T.textTert, letterSpacing: '1.5px' }}>CATÉGORIES</span>
          <button onClick={() => { setEditCat(null); setShowAddCat(true); }} style={actionBtnStyle}>
            + Ajouter une catégorie
          </button>
        </div>

        {categories.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: T.textTert, fontSize: '12px', border: `1px dashed ${T.border}`, borderRadius: T.rLg }}>
            Aucune catégorie. Créez votre première catégorie de dépenses.
          </div>
        )}

        {categories.map(cat => {
          const s = catSpent[cat.id] || 0;
          const pct = cat.allocated_amount > 0 ? Math.min(100, (s / cat.allocated_amount) * 100) : 0;
          const isOver = s > cat.allocated_amount && cat.allocated_amount > 0;
          const isExpanded = expandedCat === cat.id;
          const catTxs = transactions.filter(t => t.category_id === cat.id);
          const pocket = cat.pocket ? POCKETS[cat.pocket] : null;

          return (
            <div key={cat.id} style={{ border: `1px solid ${T.border}`, borderRadius: T.rLg, marginBottom: '6px', overflow: 'hidden' }}>
              <div onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: T.text }}>{cat.name}</span>
                    {pocket && (
                      <span style={{ fontSize: '9px', background: `${pocket.color}22`, color: pocket.color, padding: '1px 5px', borderRadius: '3px', fontWeight: '600' }}>
                        {pocket.label}
                      </span>
                    )}
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(136,153,187,0.10)', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isOver ? T.danger : cat.color, borderRadius: '3px' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginRight: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: isOver ? T.danger : T.text }}>{fmt(s)} €</div>
                  <div style={{ fontSize: '10px', color: T.textTert }}>/ {fmt(cat.allocated_amount)} €</div>
                </div>
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}>
                  <button onClick={e => { e.stopPropagation(); setEditCat(cat); setShowAddCat(true); }}
                    style={iconBtnStyle} title="Modifier">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteCat(cat.id); }}
                    style={iconBtnStyle} title="Supprimer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textTert} strokeWidth="2" strokeLinecap="round"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: '10px 14px', background: 'rgba(0,0,0,0.15)' }}>
                  {catTxs.length === 0 ? (
                    <div style={{ fontSize: '11px', color: T.textTert, textAlign: 'center', padding: '8px' }}>
                      Aucune dépense ce mois
                    </div>
                  ) : (
                    catTxs.map(tx => (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid rgba(136,153,187,0.06)` }}>
                        <span style={{ fontSize: '12px', color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</span>
                        <span style={{ fontSize: '11px', color: T.textTert, flexShrink: 0 }}>{tx.date?.slice(5)}</span>
                        <span style={{ fontSize: '13px', color: T.danger, fontWeight: '500', flexShrink: 0 }}>−{fmt(tx.amount)} €</span>
                        <button onClick={() => handleDeleteTx(tx.id)}
                          style={{ background: 'none', border: 'none', color: T.textTert, cursor: 'pointer', fontSize: '11px', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
                      </div>
                    ))
                  )}
                  <button onClick={() => { setPrefillCatId(cat.id); setShowAddTx(true); }}
                    style={{ ...actionBtnStyle, marginTop: '8px' }}>
                    + Ajouter une dépense ici
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── BOTTOM ROW ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

        {/* Dernières dépenses */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: T.rLg, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', background: T.bg2, borderBottom: `1px solid ${T.border}`, fontSize: '11px', color: T.textTert, letterSpacing: '1.5px' }}>
            DERNIÈRES DÉPENSES
          </div>
          <div style={{ padding: '10px 14px' }}>
            {transactions.length === 0 ? (
              <div style={{ fontSize: '12px', color: T.textTert, textAlign: 'center', padding: '16px' }}>Aucune dépense ce mois</div>
            ) : (
              transactions.slice(0, 8).map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid rgba(136,153,187,0.06)` }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: tx.category_color || '#8899bb', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
                    <div style={{ fontSize: '10px', color: T.textTert }}>{tx.category_name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', color: T.danger, fontWeight: '500' }}>−{fmt(tx.amount)} €</div>
                    <div style={{ fontSize: '10px', color: T.textTert }}>{tx.date?.slice(5)}</div>
                  </div>
                </div>
              ))
            )}
            <button onClick={() => { setPrefillCatId(null); setShowAddTx(true); }}
              style={{ ...actionBtnStyle, width: '100%', marginTop: '10px', justifyContent: 'center' }}>
              + Ajouter une dépense
            </button>
          </div>
        </div>

        {/* Donut + légende */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: T.rLg, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', background: T.bg2, borderBottom: `1px solid ${T.border}`, fontSize: '11px', color: T.textTert, letterSpacing: '1.5px' }}>
            RÉPARTITION VISUELLE
          </div>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <DonutChart
              segments={categories.filter(c => (catSpent[c.id] || 0) > 0).map(c => ({ color: c.color, value: catSpent[c.id], label: c.name }))}
              total={spent}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              {categories.filter(c => (catSpent[c.id] || 0) > 0).length === 0 && (
                <div style={{ fontSize: '11px', color: T.textTert }}>Aucune dépense</div>
              )}
              {categories.filter(c => (catSpent[c.id] || 0) > 0).map(cat => {
                const s = catSpent[cat.id];
                const pct = spent > 0 ? (s / spent) * 100 : 0;
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: cat.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: T.textSub, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                    <span style={{ fontSize: '11px', color: T.textTert, flexShrink: 0 }}>{pct.toFixed(0)} %</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────── */}
      {showAddCat && (
        <CategoryModal
          initial={editCat}
          onClose={() => { setShowAddCat(false); setEditCat(null); }}
          onSave={async data => {
            if (editCat) await window.budget.updateCategory(editCat.id, data);
            else await window.budget.addCategory(data);
            setShowAddCat(false); setEditCat(null);
            await load();
          }}
        />
      )}

      {showAddTx && categories.length > 0 && (
        <TransactionModal
          categories={categories}
          prefillCatId={prefillCatId}
          monthKey={monthKey}
          onClose={() => { setShowAddTx(false); setPrefillCatId(null); }}
          onSave={async data => {
            await window.budget.addTransaction(data);
            setShowAddTx(false); setPrefillCatId(null);
            await load();
          }}
        />
      )}

      {showTargets && (
        <TargetsModal
          targets={targets}
          onClose={() => setShowTargets(false)}
          onSave={async newTargets => {
            await window.budget.updateSettings(monthKey, totalBudget, newTargets);
            setSettings(s => ({ ...s, pocket_targets: newTargets }));
            setShowTargets(false);
          }}
        />
      )}
    </div>
  );
}

// ── Module-level style constants ─────────────────────────────
const navBtnStyle = {
  width: '28px', height: '28px', borderRadius: T.rMd,
  background: 'rgba(136,153,187,0.06)', border: `1px solid ${T.border}`,
  color: T.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'inherit', padding: 0,
};

const actionBtnStyle = {
  background: 'rgba(136,153,187,0.06)', border: `1px solid ${T.border}`,
  borderRadius: T.rSm, color: T.textSub, fontSize: '11px', padding: '5px 10px',
  cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px',
};

const iconBtnStyle = {
  background: 'none', border: 'none', color: T.textTert,
  cursor: 'pointer', padding: '3px 4px', display: 'flex', alignItems: 'center',
  borderRadius: '4px', transition: 'color 0.15s',
};

const modalStyle = {
  background: '#0d0f1a',
  border: `1px solid rgba(136,153,187,0.20)`,
  borderRadius: '12px',
  width: '380px',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  fontSize: '11px',
  color: T.textTert,
};

const inputStyle = {
  background: 'rgba(0,0,0,0.3)',
  border: `1px solid ${T.border}`,
  borderRadius: T.rSm,
  color: T.text,
  fontSize: '13px',
  padding: '7px 10px',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const saveBtnStyle = {
  background: 'rgba(136,153,187,0.15)',
  border: `1px solid rgba(136,153,187,0.35)`,
  borderRadius: T.rSm,
  color: T.text,
  fontSize: '12px',
  padding: '7px 14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: '600',
};

const cancelBtnStyle = {
  background: 'transparent',
  border: `1px solid ${T.border}`,
  borderRadius: T.rSm,
  color: T.textTert,
  fontSize: '12px',
  padding: '7px 14px',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
