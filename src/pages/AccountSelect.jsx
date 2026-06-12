import { useState, useEffect } from 'react';

// ── Constants ─────────────────────────────────────────────────
const COLORS = ['#00ff88','#00aaff','#aa88ff','#ffcc00','#ff6644','#ff4488','#44ffcc'];

const TYPE_LABELS = {
  topstep_50k:       { label: 'Topstep 50K',     color: '#00ff88', platform: 'topstep' },
  topstep_100k:      { label: 'Topstep 100K',    color: '#00aaff', platform: 'topstep' },
  topstep_150k:      { label: 'Topstep 150K',    color: '#aa88ff', platform: 'topstep' },
  topstep_ef_50k:    { label: 'Funded 50K',      color: '#f0c020', platform: 'topstep' },
  topstep_ef_100k:   { label: 'Funded 100K',     color: '#f0c020', platform: 'topstep' },
  topstep_ef_150k:   { label: 'Funded 150K',     color: '#f0c020', platform: 'topstep' },
  lucid_eval_50k:    { label: 'LucidFlex 50K',   color: '#00aaff', platform: 'tradovate' },
  lucid_eval_100k:   { label: 'LucidFlex 100K',  color: '#00aaff', platform: 'tradovate' },
  lucid_eval_150k:   { label: 'LucidFlex 150K',  color: '#00aaff', platform: 'tradovate' },
  lucid_funded_50k:  { label: 'Funded 50K',      color: '#f0c020', platform: 'tradovate' },
  lucid_funded_100k: { label: 'Funded 100K',     color: '#f0c020', platform: 'tradovate' },
  lucid_funded_150k: { label: 'Funded 150K',     color: '#f0c020', platform: 'tradovate' },
  lucid_live_50k:    { label: 'Live 50K',        color: '#00ddff', platform: 'tradovate' },
  lucid_live_100k:   { label: 'Live 100K',       color: '#00ddff', platform: 'tradovate' },
  lucid_live_150k:   { label: 'Live 150K',       color: '#00ddff', platform: 'tradovate' },
  tradovate_live:    { label: 'Tradovate Live',  color: '#00aaff', platform: 'tradovate' },
  tradovate_demo:    { label: 'Tradovate Demo',  color: '#4488ff', platform: 'tradovate' },
  perso:             { label: 'Compte Personnel', color: '#ffcc00', platform: 'perso' },
  autre:             { label: 'Autre compte',    color: '#ff6644', platform: 'perso' },
};

const ACCOUNT_RULES = {
  topstep_50k:       { size: 50000,  maxLoss: 2000,  profitTarget: 3000 },
  topstep_100k:      { size: 100000, maxLoss: 3000,  profitTarget: 6000 },
  topstep_150k:      { size: 150000, maxLoss: 4500,  profitTarget: 9000 },
  topstep_ef_50k:    { size: 50000,  maxLoss: 2000 },
  topstep_ef_100k:   { size: 100000, maxLoss: 3000 },
  topstep_ef_150k:   { size: 150000, maxLoss: 4500 },
  lucid_eval_50k:    { size: 50000,  maxLoss: 2000,  profitTarget: 3000 },
  lucid_eval_100k:   { size: 100000, maxLoss: 3000,  profitTarget: 6000 },
  lucid_eval_150k:   { size: 150000, maxLoss: 4500,  profitTarget: 9000 },
  lucid_funded_50k:  { size: 50000,  maxLoss: 2500 },
  lucid_funded_100k: { size: 100000, maxLoss: 3000 },
  lucid_funded_150k: { size: 150000, maxLoss: 4500 },
  lucid_live_50k:    { size: null,   maxLoss: null },
  lucid_live_100k:   { size: null,   maxLoss: null },
  lucid_live_150k:   { size: null,   maxLoss: null },
  tradovate_live:    { size: null,   maxLoss: null },
  tradovate_demo:    { size: null,   maxLoss: null },
  perso:             { size: null,   maxLoss: null },
  autre:             { size: null,   maxLoss: null },
};

const CHALLENGE_TYPES = new Set(['topstep_50k','topstep_100k','topstep_150k','lucid_eval_50k','lucid_eval_100k','lucid_eval_150k']);
const EXPRESS_FUNDED_TYPES = new Set(['topstep_ef_50k','topstep_ef_100k','topstep_ef_150k','lucid_funded_50k','lucid_funded_100k','lucid_funded_150k']);
const LIVE_TYPES = new Set(['lucid_live_50k','lucid_live_100k','lucid_live_150k','tradovate_live']);

const PLATFORMS = {
  topstep: {
    label: 'Topstep', color: '#00ff88',
    desc: 'Express Funded · Trading Combine',
    types: {
      topstep_50k:     { label: 'Combine 50K',  desc: 'Trading Combine · Trailing DD -2 000$' },
      topstep_100k:    { label: 'Combine 100K', desc: 'Trading Combine · Trailing DD -3 000$' },
      topstep_150k:    { label: 'Combine 150K', desc: 'Trading Combine · Trailing DD -4 500$' },
      topstep_ef_50k:  { label: 'Funded 50K',   desc: 'Express Funded · Trailing DD -2 000$', funded: true },
      topstep_ef_100k: { label: 'Funded 100K',  desc: 'Express Funded · Trailing DD -3 000$', funded: true },
      topstep_ef_150k: { label: 'Funded 150K',  desc: 'Express Funded · Trailing DD -4 500$', funded: true },
    },
  },
  tradovate: {
    label: 'Lucid', color: '#00aaff',
    desc: 'LucidFlex Combine · Funded · Live',
    types: {
      lucid_eval_50k:    { label: 'LucidFlex 50K',  desc: 'Combine · Max loss -2 000$' },
      lucid_eval_100k:   { label: 'LucidFlex 100K', desc: 'Combine · Max loss -3 000$' },
      lucid_eval_150k:   { label: 'LucidFlex 150K', desc: 'Combine · Max loss -4 500$' },
      lucid_funded_50k:  { label: 'Funded 50K',     desc: 'Funded · Max loss -2 500$', funded: true },
      lucid_funded_100k: { label: 'Funded 100K',    desc: 'Funded · Max loss -3 000$', funded: true },
      lucid_funded_150k: { label: 'Funded 150K',    desc: 'Funded · Max loss -4 500$', funded: true },
      lucid_live_50k:    { label: 'Live 50K',       desc: 'Compte live réel', live: true },
      lucid_live_100k:   { label: 'Live 100K',      desc: 'Compte live réel', live: true },
      lucid_live_150k:   { label: 'Live 150K',      desc: 'Compte live réel', live: true },
    },
  },
};

// ── SVG Logos ─────────────────────────────────────────────────
function TopstepLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 4 L36 20 L20 36 L4 20 Z" stroke="#00ff88" strokeWidth="2.5"
        fill="rgba(0,255,136,0.08)" strokeLinejoin="round"/>
      <circle cx="20" cy="20" r="4.5" fill="#00ff88"/>
      <line x1="20" y1="4"    x2="20" y2="15.5" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="24.5" x2="20" y2="36"   stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4"  y1="20"   x2="15.5" y2="20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="24.5" y1="20" x2="36"   y2="20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function TradovateLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M8 30 L20 10 L32 30" stroke="#00aaff" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="12" y1="23" x2="28" y2="23" stroke="#00aaff" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function PersonalLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="4" y="14" width="32" height="22" rx="3" stroke="#ffcc00" strokeWidth="2.5" fill="none"/>
      <path d="M13 14 V10 C13 7.2 27 7.2 27 10 V14" stroke="#ffcc00" strokeWidth="2.5"
        strokeLinecap="round" fill="none"/>
      <circle cx="20" cy="24" r="3" fill="#ffcc00"/>
      <line x1="20" y1="27" x2="20" y2="31" stroke="#ffcc00" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function PlatformLogo({ platform, size = 28 }) {
  if (platform === 'topstep')   return <TopstepLogo size={size} />;
  if (platform === 'tradovate') return <TradovateLogo size={size} />;
  return <PersonalLogo size={size} />;
}

// ── Status computation ────────────────────────────────────────
async function computeAccountStatus(acc, currentActiveId) {
  const rules = ACCOUNT_RULES[acc.type];
  const isExpressFunded = EXPRESS_FUNDED_TYPES.has(acc.type);
  const manuallyBlown = acc.blown ?? false;

  if (!rules?.size || !rules?.maxLoss) {
    return { pnl: null, isBlown: manuallyBlown, manuallyBlown, floor: null, tradeCount: 0, winrate: 0, isValidated: false, isExpressFunded };
  }
  try {
    await window.accounts.setActive(acc.id);
    const res = await window.db.getAllTrades();
    if (currentActiveId) await window.accounts.setActive(currentActiveId);
    if (!res.ok) return { pnl: null, isBlown: manuallyBlown, manuallyBlown, floor: null, tradeCount: 0, winrate: 0, isValidated: false, isExpressFunded };
    const trades = res.data;
    const sorted = [...trades]
      .filter(t => (t.result_net ?? t.result) != null)
      .sort((a, b) => (a.entered_at || a.date || '').localeCompare(b.entered_at || b.date || ''));
    // Floor capped at account size (same trailing DD logic as Lucid/Topstep pages)
    let hwm = rules.size, floor = rules.size - rules.maxLoss, bal = rules.size;
    for (const t of sorted) {
      bal += t.result_net ?? t.result ?? 0;
      if (bal > hwm) { hwm = bal; floor = Math.min(rules.size, hwm - rules.maxLoss); }
    }
    const totalPnl = trades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);
    const wins = trades.filter(t => (t.result_net ?? t.result ?? 0) > 0).length;
    const autoBlown = rules.size + totalPnl <= floor;

    let isValidated = false;
    if (CHALLENGE_TYPES.has(acc.type) && sorted.length > 0 && rules?.profitTarget) {
      isValidated = totalPnl >= rules.profitTarget;
    }

    return {
      pnl:          Math.round(totalPnl * 100) / 100,
      isBlown:      manuallyBlown || autoBlown,
      manuallyBlown,
      floor:        Math.round(floor * 100) / 100,
      tradeCount:   trades.length,
      winrate:      trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
      isValidated,
      isExpressFunded,
    };
  } catch {
    if (currentActiveId) { try { await window.accounts.setActive(currentActiveId); } catch {} }
    return { pnl: null, isBlown: manuallyBlown, manuallyBlown, floor: null, tradeCount: 0, winrate: 0, isValidated: false, isExpressFunded };
  }
}

// ── Create Account Modal ──────────────────────────────────────
function CreateAccountModal({ onClose, onCreate }) {
  const [step, setStep]         = useState('platform');
  const [platform, setPlatform] = useState(null);
  const [form, setForm]         = useState({ name: '', type: 'topstep_50k', color: '#00ff88', brokerAccountId: '' });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '5px', padding: '9px 12px', color: '#c8d8c8', fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

  function selectPlatform(key) {
    const p = PLATFORMS[key];
    const firstType = Object.keys(p.types)[0];
    setPlatform(key);
    setForm(f => ({ ...f, type: firstType, color: TYPE_LABELS[firstType]?.color ?? p.color }));
    setStep('details');
  }

  async function submit() {
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return; }
    setSaving(true);
    const res = await window.accounts.create({
      name: form.name.trim(), type: form.type, color: form.color,
      brokerAccountId: form.brokerAccountId.trim(), platform,
    });
    setSaving(false);
    if (res.ok) { onCreate(res.data); onClose(); }
    else setError(res.error ?? 'Erreur inconnue');
  }

  const plat = platform ? PLATFORMS[platform] : null;
  const stepTitles = { platform: 'Choisir la plateforme', details: `Compte ${plat?.label ?? ''}` };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '28px', boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {step !== 'platform' && (
              <button onClick={() => setStep('platform')} style={{ background: 'none', border: 'none', color: '#3a6a4a', cursor: 'pointer', fontSize: '18px', padding: '0', lineHeight: 1 }}
                onMouseEnter={e => e.currentTarget.style.color = '#00ff88'}
                onMouseLeave={e => e.currentTarget.style.color = '#3a6a4a'}
              >←</button>
            )}
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>NOUVEAU COMPTE</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>{stepTitles[step]}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        {/* ── Step 1: Platform ── */}
        {step === 'platform' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(PLATFORMS).map(([key, p]) => (
              <div key={key} onClick={() => selectPlatform(key)}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 18px', borderRadius: '8px', cursor: 'pointer', background: `rgba(${p.color === '#00ff88' ? '0,255,136' : p.color === '#00aaff' ? '0,170,255' : '255,204,0'},0.05)`, border: `1px solid ${p.color}20`, transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = `rgba(${p.color === '#00ff88' ? '0,255,136' : p.color === '#00aaff' ? '0,170,255' : '255,204,0'},0.1)`}
                onMouseLeave={e => e.currentTarget.style.background = `rgba(${p.color === '#00ff88' ? '0,255,136' : p.color === '#00aaff' ? '0,170,255' : '255,204,0'},0.05)`}
              >
                <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: `${p.color}12`, border: `1px solid ${p.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PlatformLogo platform={key} size={30} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: p.color, marginBottom: '3px' }}>{p.label}</div>
                  <div style={{ fontSize: '12px', color: '#4a7a5a', marginBottom: '6px' }}>{p.desc}</div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {Object.values(p.types).map(t => (
                      <span key={t.label} style={{ fontSize: '10px', color: '#2a5a32', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.1)', padding: '2px 7px', borderRadius: '3px' }}>{t.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '18px', color: `${p.color}60`, flexShrink: 0 }}>›</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 'details' && plat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: `${plat.color}08`, border: `1px solid ${plat.color}20`, borderRadius: '6px' }}>
              <PlatformLogo platform={platform} size={20} />
              <span style={{ fontSize: '13px', color: plat.color, fontWeight: '600' }}>{plat.label}</span>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>NOM DU COMPTE *</div>
              <input placeholder={`Ex: ${plat.label} Mai 2026`} value={form.name} onChange={set('name')} style={inp} autoFocus onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>TYPE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {Object.entries(plat.types).map(([key, info], idx, arr) => {
                  const typeColor = TYPE_LABELS[key]?.color ?? plat.color;
                  const prevInfo  = arr[idx - 1]?.[1];
                  const showSep   = idx > 0 && (
                    (!!info.funded && !prevInfo?.funded && !prevInfo?.live) ||
                    (!!info.live && !prevInfo?.live)
                  );
                  const sepLabel  = info.live ? 'LIVE' : 'FUNDED';
                  const sepColor  = info.live ? '#00ddff' : '#f0c020';
                  return (
                    <div key={key}>
                      {showSep && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0 6px' }}>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(0,255,136,0.08)' }} />
                          <span style={{ fontSize: '9px', color: sepColor, letterSpacing: '2px' }}>{sepLabel}</span>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(0,255,136,0.08)' }} />
                        </div>
                      )}
                      <div onClick={() => setForm(p => ({ ...p, type: key, color: typeColor }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', background: form.type === key ? `${typeColor}10` : 'rgba(10,28,18,0.4)', border: `1px solid ${form.type === key ? typeColor + '40' : 'rgba(0,255,136,0.08)'}`, transition: 'all 0.12s' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', color: form.type === key ? typeColor : '#c8d8c8', fontWeight: form.type === key ? '700' : '400' }}>{info.label}</span>
                            {info.funded && <span style={{ fontSize: '8px', background: 'rgba(240,192,32,0.15)', border: '1px solid rgba(240,192,32,0.3)', color: '#f0c020', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>LIVE</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#3a6a4a' }}>{info.desc}</div>
                        </div>
                        <div style={{ width: '15px', height: '15px', borderRadius: '50%', border: `2px solid ${form.type === key ? typeColor : '#2a5a3a'}`, background: form.type === key ? typeColor : 'transparent', flexShrink: 0 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>COULEUR</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid white' : '2px solid transparent', boxShadow: form.color === c ? `0 0 8px ${c}` : 'none', transition: 'all 0.15s' }} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>ID BROKER (optionnel)</div>
              <input placeholder="Ex: 50KTC-236410" value={form.brokerAccountId} onChange={set('brokerAccountId')} style={inp} />
            </div>
            {error && <div style={{ padding: '10px', background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '5px', color: '#ff4455', fontSize: '12px' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>ANNULER</button>
              <button onClick={submit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '5px', background: `${form.color}22`, border: `1px solid ${form.color}60`, color: form.color, fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'CRÉATION...' : 'CRÉER'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Account Modal ────────────────────────────────────────
function EditAccountModal({ acc, onClose, onSave }) {
  const [form, setForm] = useState({
    name:            acc.name,
    type:            acc.type,
    color:           acc.color ?? '#00ff88',
    brokerAccountId: acc.brokerAccountId ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '5px', padding: '9px 12px', color: '#c8d8c8', fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

  async function submit() {
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return; }
    setSaving(true);
    const res = await window.accounts.update(acc.id, {
      name:            form.name.trim(),
      type:            form.type,
      color:           form.color,
      brokerAccountId: form.brokerAccountId.trim(),
      platform:        TYPE_LABELS[form.type]?.platform ?? acc.platform,
    });
    setSaving(false);
    if (res.ok) onSave();
    else setError(res.error ?? 'Erreur inconnue');
  }

  const currentPlat = TYPE_LABELS[form.type]?.platform;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '28px', boxShadow: '0 0 60px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>MODIFIER LE COMPTE</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>{acc.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Name */}
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>NOM DU COMPTE *</div>
            <input value={form.name} onChange={set('name')} style={inp} autoFocus onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </div>

          {/* Type — grouped by platform */}
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '10px' }}>TYPE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(PLATFORMS).map(([platKey, plat]) => (
                <div key={platKey}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <PlatformLogo platform={platKey} size={14} />
                    <span style={{ fontSize: '9px', color: plat.color, letterSpacing: '2px', fontWeight: '700' }}>{plat.label.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {Object.entries(plat.types).map(([typeKey, typeInfo], tidx, tarr) => {
                      const tc = TYPE_LABELS[typeKey]?.color ?? plat.color;
                      const sel = form.type === typeKey;
                      const prevTypeInfo = tarr[tidx - 1]?.[1];
                      const showTypeSep  = tidx > 0 && (
                        (!!typeInfo.funded && !prevTypeInfo?.funded && !prevTypeInfo?.live) ||
                        (!!typeInfo.live && !prevTypeInfo?.live)
                      );
                      const typeSepLabel = typeInfo.live ? 'LIVE' : 'FUNDED';
                      const typeSepColor = typeInfo.live ? '#00ddff' : '#f0c020';
                      return (
                        <div key={typeKey} style={{ display: 'contents' }}>
                          {showTypeSep && (
                            <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', marginBottom: '2px' }}>
                              <div style={{ flex: 1, height: '1px', background: 'rgba(0,255,136,0.08)' }} />
                              <span style={{ fontSize: '8px', color: typeSepColor, letterSpacing: '2px' }}>{typeSepLabel}</span>
                              <div style={{ flex: 1, height: '1px', background: 'rgba(0,255,136,0.08)' }} />
                            </div>
                          )}
                          <div onClick={() => setForm(p => ({ ...p, type: typeKey, color: tc }))}
                            style={{ padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: sel ? '700' : '400', color: sel ? tc : '#5a8a6a', background: sel ? `${tc}15` : 'rgba(10,28,18,0.5)', border: `1px solid ${sel ? tc + '50' : 'rgba(0,255,136,0.08)'}`, transition: 'all 0.12s' }}>
                            {typeInfo.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>COULEUR</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid white' : '2px solid transparent', boxShadow: form.color === c ? `0 0 8px ${c}` : 'none', transition: 'all 0.15s' }} />
              ))}
              {/* Custom color if not in palette */}
              {!COLORS.includes(form.color) && (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: form.color, border: '2px solid white', boxShadow: `0 0 8px ${form.color}` }} />
              )}
            </div>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="color" value={form.color} onChange={set('color')} style={{ width: '32px', height: '28px', padding: '0', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px' }} />
              <span style={{ fontSize: '11px', color: '#3a6a4a' }}>Couleur personnalisée</span>
            </div>
          </div>

          {/* Broker ID */}
          <div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>ID BROKER (optionnel)</div>
            <input value={form.brokerAccountId} onChange={set('brokerAccountId')} placeholder="Ex: 50KTC-236410" style={inp} />
          </div>

          {error && (
            <div style={{ padding: '10px', background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '5px', color: '#ff4455', fontSize: '12px' }}>⚠ {error}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>ANNULER</button>
            <button onClick={submit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '5px', background: `${form.color}22`, border: `1px solid ${form.color}60`, color: form.color, fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────────
function AccountCard({ acc, isActive, status, onSelect, onEdit, onDelete, onMarkBlown, onRestoreBlown }) {
  const typeInfo    = TYPE_LABELS[acc.type] ?? { label: 'Autre', color: acc.color ?? '#ff6644', platform: 'perso' };
  const isBlown     = status?.isBlown ?? false;
  const hasStats    = status?.pnl != null;
  const pnl         = status?.pnl ?? 0;
  const pnlColor    = isBlown ? '#ff4455' : pnl >= 0 ? '#00ff88' : '#ff4455';
  const isTdvLive   = LIVE_TYPES.has(acc.type);
  const isTdvDemo   = acc.type === 'tradovate_demo';
  const isChallenge = CHALLENGE_TYPES.has(acc.type) && !isBlown && !status?.isValidated && !status?.isExpressFunded;

  return (
    <div onClick={() => onSelect(acc.id)}
      style={{ background: isBlown ? 'rgba(255,68,85,0.06)' : isActive ? `${acc.color}0d` : 'rgba(10,28,18,0.5)', border: `2px solid ${isBlown ? '#ff4455' : isActive ? acc.color : 'rgba(0,255,136,0.08)'}`, borderRadius: '10px', padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', boxShadow: isBlown ? '0 0 20px rgba(255,68,85,0.12)' : isActive ? `0 0 24px ${acc.color}20` : 'none', opacity: isBlown ? 0.85 : 1 }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isBlown ? '0 0 28px rgba(255,68,85,0.2)' : `0 0 24px ${acc.color}20`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isBlown ? '0 0 20px rgba(255,68,85,0.12)' : isActive ? `0 0 24px ${acc.color}20` : 'none'; }}
    >
      {/* Badges top-right */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '170px' }}>
        {isBlown && (
          <div style={{ background: 'rgba(255,68,85,0.2)', border: '1px solid rgba(255,68,85,0.5)', borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: '#ff4455', letterSpacing: '1px', fontWeight: '700' }}>💀 CRAMÉ</div>
        )}
        {!isBlown && status?.isExpressFunded && (
          <div style={{ background: 'rgba(240,192,32,0.2)', border: '1px solid rgba(240,192,32,0.5)', borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: '#f0c020', letterSpacing: '1px', fontWeight: '700' }}>💰 FUNDED</div>
        )}
        {!isBlown && isTdvLive && (
          <div style={{ background: 'rgba(0,170,255,0.2)', border: '1px solid rgba(0,170,255,0.5)', borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: '#00aaff', letterSpacing: '1px', fontWeight: '700' }}>● LIVE</div>
        )}
        {!isBlown && isTdvDemo && (
          <div style={{ background: 'rgba(0,170,255,0.1)', border: '1px solid rgba(0,170,255,0.3)', borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: '#4a8aaa', letterSpacing: '1px', fontWeight: '700' }}>DEMO</div>
        )}
        {!isBlown && isChallenge && (
          <div style={{ background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: '#00dd77', letterSpacing: '1px', fontWeight: '700' }}>CHALLENGE</div>
        )}
        {!isBlown && status?.isValidated && (
          <div style={{ background: 'rgba(0,255,136,0.2)', border: '1px solid rgba(0,255,136,0.5)', borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: '#00ff88', letterSpacing: '1px', fontWeight: '700' }}>✅ VALIDÉ</div>
        )}
        {!isBlown && isActive && (
          <div style={{ background: `${acc.color}20`, border: `1px solid ${acc.color}40`, borderRadius: '4px', padding: '2px 7px', fontSize: '8px', color: acc.color, letterSpacing: '1px', fontWeight: '700' }}>ACTIF</div>
        )}
      </div>

      {/* Logo + dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '9px', background: isBlown ? 'rgba(255,68,85,0.12)' : `${acc.color}12`, border: `1px solid ${isBlown ? 'rgba(255,68,85,0.3)' : acc.color + '30'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PlatformLogo platform={typeInfo.platform} size={24} />
        </div>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isBlown ? '#ff4455' : acc.color, boxShadow: `0 0 6px ${isBlown ? '#ff4455' : acc.color}` }} />
      </div>

      {/* Name + type */}
      <div style={{ fontSize: '14px', fontWeight: '700', color: isBlown ? '#c88a8a' : '#e8f8e8', marginBottom: '3px' }}>{acc.name}</div>
      <div style={{ fontSize: '11px', color: isBlown ? '#ff6666' : acc.color, marginBottom: '8px' }}>{typeInfo.label}</div>

      {/* P&L + stats */}
      {hasStats && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: pnlColor, lineHeight: 1 }}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}$
            </div>
            <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '2px' }}>
              {status.winrate}% WR · {status.tradeCount}T
            </div>
          </div>
          {isBlown && status.floor != null && (
            <div style={{ fontSize: '10px', color: '#ff4455', textAlign: 'right' }}>
              ⚠ Floor {status.floor.toFixed(0)}$<br/>franchi
            </div>
          )}
        </div>
      )}

      {acc.brokerAccountId && <div style={{ fontSize: '10px', color: '#3a6a4a', marginTop: '4px' }}>{acc.brokerAccountId}</div>}
      <div style={{ fontSize: '10px', color: '#2a4a30', marginTop: '2px' }}>Créé le {new Date(acc.createdAt).toLocaleDateString('fr-FR')}</div>

      <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '4px' }}>
        {/* Restaurer — uniquement si cramé manuellement */}
        {status?.manuallyBlown && (
          <button onClick={e => { e.stopPropagation(); onRestoreBlown(acc.id); }}
            style={{ background: 'none', border: 'none', color: '#2a4a30', cursor: 'pointer', fontSize: '13px', padding: '2px 6px', borderRadius: '3px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.background = 'rgba(0,255,136,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#2a4a30'; e.currentTarget.style.background = 'none'; }}
            title="Restaurer ce compte"
          >↺</button>
        )}
        {/* Marquer cramé — uniquement si pas encore cramé */}
        {!isBlown && (
          <button onClick={e => { e.stopPropagation(); onMarkBlown(acc.id); }}
            style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '13px', padding: '2px 6px', borderRadius: '3px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.background = 'rgba(255,68,85,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#1a3a20'; e.currentTarget.style.background = 'none'; }}
            title="Marquer comme cramé"
          >💀</button>
        )}
        <button onClick={e => { e.stopPropagation(); onEdit(acc); }}
          style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '13px', padding: '2px 6px', borderRadius: '3px', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00aaff'; e.currentTarget.style.background = 'rgba(0,170,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#1a3a20'; e.currentTarget.style.background = 'none'; }}
          title="Modifier"
        >✏</button>
        <button onClick={e => onDelete(acc.id, e)}
          style={{ background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', borderRadius: '3px', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.background = 'rgba(255,68,85,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#1a3a20'; e.currentTarget.style.background = 'none'; }}
          title="Supprimer"
        >🗑</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AccountSelect({ onSelect, onBack }) {
  const [data, setData]             = useState({ accounts: [], activeId: null });
  const [statuses, setStatuses]     = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoading(true);
    const res = await window.accounts.getAll();
    if (res.ok) {
      setData(res.data);
      loadStatuses(res.data.accounts, res.data.activeId);
    }
    setLoading(false);
  }

  async function loadStatuses(accounts, activeId) {
    if (!accounts.length) return;
    setLoadingStats(true);
    const results = {};
    for (const acc of accounts) {
      results[acc.id] = await computeAccountStatus(acc, activeId);
    }
    if (activeId) { try { await window.accounts.setActive(activeId); } catch {} }
    setStatuses(results);
    setLoadingStats(false);
  }

  async function handleSelect(id) {
    await window.accounts.setActive(id);
    const res = await window.accounts.getActive();
    if (res.ok) onSelect(res.data);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce compte et TOUS ses trades ? Cette action est irréversible.')) return;
    await window.accounts.delete(id);
    loadAccounts();
  }

  async function handleMarkBlown(id) {
    if (!window.confirm('Marquer ce compte comme cramé ? Il sera déplacé dans la section CRAMÉS.')) return;
    await window.accounts.update(id, { blown: true });
    loadAccounts();
  }

  async function handleRestoreBlown(id) {
    if (!window.confirm('Restaurer ce compte ? Il reviendra dans sa section d\'origine.')) return;
    await window.accounts.update(id, { blown: false });
    loadAccounts();
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060c10', color: '#3a6a4a', fontSize: '12px', letterSpacing: '2px', fontFamily: 'monospace' }}>CHARGEMENT...</div>
  );

  // ── Section ordering (top → bottom) ──────────────────────────
  // 0. ACTIF    : compte actuellement sélectionné (épinglé en tête)
  // 1. LIVE     : Lucid Live + Tradovate Live
  // 2. FUNDED   : Express Funded Topstep + Lucid Funded
  // 3. CHALLENGE: Topstep Combine + Lucid Eval non validés
  // 4. VALIDÉ   : challenges réussis
  // 5. CRAMÉS   : blown (manuellement ou auto)
  const activeAcc = data.accounts.find(a => a.id === data.activeId && !statuses[a.id]?.isBlown);
  const isNotActive = a => a.id !== data.activeId;

  const blownAccounts     = data.accounts.filter(a => statuses[a.id]?.isBlown);
  const liveAccounts      = data.accounts.filter(a =>
    !statuses[a.id]?.isBlown && isNotActive(a) && LIVE_TYPES.has(a.type)
  );
  const fundedAccounts    = data.accounts.filter(a =>
    !statuses[a.id]?.isBlown && isNotActive(a) &&
    statuses[a.id]?.isExpressFunded && !LIVE_TYPES.has(a.type)
  );
  const challengeAccounts = data.accounts.filter(a =>
    !statuses[a.id]?.isBlown && isNotActive(a) &&
    !statuses[a.id]?.isExpressFunded && !LIVE_TYPES.has(a.type) &&
    !statuses[a.id]?.isValidated && CHALLENGE_TYPES.has(a.type)
  );
  const validatedAccounts = data.accounts.filter(a =>
    !statuses[a.id]?.isBlown && isNotActive(a) &&
    !statuses[a.id]?.isExpressFunded && !LIVE_TYPES.has(a.type) &&
    statuses[a.id]?.isValidated
  );

  function renderSection(accounts, header) {
    return (
      <div style={{ marginBottom: '28px' }}>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '14px' }}>
          {accounts.map(acc => (
            <AccountCard key={acc.id} acc={acc} isActive={acc.id === data.activeId} status={statuses[acc.id]} onSelect={handleSelect} onEdit={setEditingAcc} onDelete={handleDelete} onMarkBlown={handleMarkBlown} onRestoreBlown={handleRestoreBlown} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#060c10', backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,40,20,0.5) 0%, transparent 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', fontFamily: "'JetBrains Mono','Fira Code',monospace", color: '#c8d8c8', padding: '40px 20px' }}>

      {onBack && (
        <div style={{ position: 'fixed', top: '20px', left: '20px' }}>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '8px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
          >← Retour</button>
        </div>
      )}

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }}>
        <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg,#00ff88,#00aa55)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,255,136,0.3)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#060c10" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            <polyline points="16 7 22 7 22 13"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8f8e8', letterSpacing: '2px' }}>TRADE DASHBOARD</div>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '3px' }}>
            SÉLECTIONNER UN COMPTE
            {loadingStats && <span style={{ marginLeft: '8px', color: '#2a5a32' }}>· calcul en cours...</span>}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '920px' }}>
        {data.accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed #1a3a22', borderRadius: '10px', marginBottom: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '14px', color: '#c8d8c8', marginBottom: '8px' }}>Aucun compte créé</div>
            <div style={{ fontSize: '12px', color: '#3a6a4a' }}>Créez votre premier compte pour commencer</div>
          </div>
        ) : (
          <>
            {/* ── 0. COMPTE ACTIF (épinglé en tête) ── */}
            {activeAcc && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: activeAcc.color, boxShadow: `0 0 12px ${activeAcc.color}` }} />
                  <span style={{ fontSize: '10px', color: activeAcc.color, letterSpacing: '2px', fontWeight: '700' }}>COMPTE ACTIF</span>
                  <span style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1px' }}>En cours de trading</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '14px' }}>
                  <AccountCard acc={activeAcc} isActive={true} status={statuses[activeAcc.id]} onSelect={handleSelect} onEdit={setEditingAcc} onDelete={handleDelete} onMarkBlown={handleMarkBlown} onRestoreBlown={handleRestoreBlown} />
                </div>
              </div>
            )}

            {/* ── 1. LIVE : Lucid Live + Tradovate Live ── */}
            {liveAccounts.length > 0 && renderSection(liveAccounts, (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00ddff', boxShadow: '0 0 10px #00ddff' }} />
                <span style={{ fontSize: '10px', color: '#00ddff', letterSpacing: '2px', fontWeight: '700' }}>LIVE — {liveAccounts.length}</span>
                <span style={{ fontSize: '9px', color: '#2a7a8a', letterSpacing: '1px' }}>Compte live réel</span>
              </div>
            ))}

            {/* ── 2. FUNDED : Express Funded Topstep + Lucid Funded ── */}
            {fundedAccounts.length > 0 && renderSection(fundedAccounts, (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f0c020', boxShadow: '0 0 10px #f0c020' }} />
                <span style={{ fontSize: '10px', color: '#f0c020', letterSpacing: '2px', fontWeight: '700' }}>FUNDED — {fundedAccounts.length}</span>
                <span style={{ fontSize: '9px', color: '#8a7a30', letterSpacing: '1px' }}>Express Funded · Lucid Funded</span>
              </div>
            ))}

            {/* ── 3. CHALLENGE : Topstep Combine + Lucid Eval non validés ── */}
            {challengeAccounts.length > 0 && renderSection(challengeAccounts, (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00dd77', boxShadow: '0 0 8px #00dd77' }} />
                <span style={{ fontSize: '10px', color: '#00dd77', letterSpacing: '2px', fontWeight: '700' }}>CHALLENGE — {challengeAccounts.length}</span>
                <span style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1px' }}>En cours</span>
              </div>
            ))}

            {/* ── 4. VALIDÉ : challenges réussis ── */}
            {validatedAccounts.length > 0 && renderSection(validatedAccounts, (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
                <span style={{ fontSize: '10px', color: '#00ff88', letterSpacing: '2px', fontWeight: '700' }}>VALIDÉ — {validatedAccounts.length}</span>
                <span style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '1px' }}>Challenge réussi ✓</span>
              </div>
            ))}

            {/* ── 5. CRAMÉS ── */}
            {blownAccounts.length > 0 && renderSection(blownAccounts, (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ff4455', boxShadow: '0 0 8px #ff4455' }} />
                <span style={{ fontSize: '10px', color: '#ff4455', letterSpacing: '2px', fontWeight: '700', opacity: 0.8 }}>CRAMÉS — {blownAccounts.length}</span>
                <span style={{ fontSize: '9px', color: '#5a2a2a', letterSpacing: '1px' }}>↺ = restaurer</span>
              </div>
            ))}
          </>
        )}

        <button onClick={() => setShowCreate(true)}
          style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px dashed #1a4a2a', borderRadius: '8px', color: '#3a6a4a', fontSize: '12px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s ease' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff88'; e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a4a2a'; e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.background = 'transparent'; }}
        >+ CRÉER UN NOUVEAU COMPTE</button>
      </div>

      {showCreate  && <CreateAccountModal onClose={() => setShowCreate(false)} onCreate={() => loadAccounts()} />}
      {editingAcc  && <EditAccountModal acc={editingAcc} onClose={() => setEditingAcc(null)} onSave={() => { setEditingAcc(null); loadAccounts(); }} />}
    </div>
  );
}
