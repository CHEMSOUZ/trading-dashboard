import { useState, useEffect } from 'react';

// ── Platform logos ────────────────────────────────────────────
function TopstepLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 4 L36 20 L20 36 L4 20 Z" stroke="#00ff88" strokeWidth="2.5" fill="rgba(0,255,136,0.08)" strokeLinejoin="round"/>
      <circle cx="20" cy="20" r="4.5" fill="#00ff88"/>
      <line x1="20" y1="4"  x2="20" y2="15.5" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="24.5" x2="20" y2="36" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4"  y1="20" x2="15.5" y2="20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="24.5" y1="20" x2="36" y2="20" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TradovateLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M8 30 L20 10 L32 30" stroke="#00aaff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="12" y1="23" x2="28" y2="23" stroke="#00aaff" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function PersonalLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="4" y="14" width="32" height="22" rx="3" stroke="#ffcc00" strokeWidth="2.5" fill="none"/>
      <path d="M13 14 V10 C13 7.2 27 7.2 27 10 V14" stroke="#ffcc00" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="20" cy="24" r="3" fill="#ffcc00"/>
      <line x1="20" y1="27" x2="20" y2="31" stroke="#ffcc00" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// Platform groups → account types
const PLATFORMS = {
  topstep: {
    label: 'Topstep',
    color: '#00ff88',
    Logo: TopstepLogo,
    desc: 'Express Funded · Trading Combine',
    types: {
      topstep_50k:  { label: 'Express 50K',  desc: 'Trailing DD -2 000$' },
      topstep_100k: { label: 'Express 100K', desc: 'Trailing DD -3 000$' },
      topstep_150k: { label: 'Express 150K', desc: 'Trailing DD -4 500$' },
    },
  },
  tradovate: {
    label: 'Tradovate',
    color: '#00aaff',
    Logo: TradovateLogo,
    desc: 'Compte broker Tradovate',
    soon: true,
    types: {
      tradovate_live: { label: 'Live',  desc: 'Compte live Tradovate' },
      tradovate_demo: { label: 'Demo',  desc: 'Compte simulation' },
    },
  },
  perso: {
    label: 'Personnel',
    color: '#ffcc00',
    Logo: PersonalLogo,
    desc: 'Compte live ou paper trading',
    types: {
      perso: { label: 'Compte Personnel', desc: 'Live ou paper trading' },
      autre: { label: 'Autre',            desc: 'Broker ou plateforme custom' },
    },
  },
};

// Flat TYPE_LABELS for account cards
const TYPE_LABELS = {
  topstep_50k:    { label: 'Topstep 50K',    color: '#00ff88', platform: 'topstep' },
  topstep_100k:   { label: 'Topstep 100K',   color: '#00aaff', platform: 'topstep' },
  topstep_150k:   { label: 'Topstep 150K',   color: '#aa88ff', platform: 'topstep' },
  tradovate_live: { label: 'Tradovate Live',  color: '#00aaff', platform: 'tradovate' },
  tradovate_demo: { label: 'Tradovate Demo',  color: '#4488ff', platform: 'tradovate' },
  perso:          { label: 'Compte Personnel',color: '#ffcc00', platform: 'perso' },
  autre:          { label: 'Autre compte',    color: '#ff6644', platform: 'perso' },
};

const COLORS = ['#00ff88','#00aaff','#aa88ff','#ffcc00','#ff6644','#ff4488','#44ffcc'];

function CreateAccountModal({ onClose, onCreate }) {
  // Step 1: choose platform. Step 2: fill details.
  const [step, setStep]     = useState('platform'); // 'platform' | 'details'
  const [platform, setPlatform] = useState(null);   // 'topstep' | 'tradovate' | 'perso'
  const [form, setForm]     = useState({ name: '', type: 'topstep_50k', color: '#00ff88', brokerAccountId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const inp = { background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '5px', padding: '9px 12px', color: '#c8d8c8', fontSize: '13px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };

  function selectPlatform(key) {
    const p = PLATFORMS[key];
    const firstType = Object.keys(p.types)[0];
    const firstColor = TYPE_LABELS[firstType]?.color ?? '#00ff88';
    setPlatform(key);
    setForm(f => ({ ...f, type: firstType, color: firstColor }));
    setStep('details');
  }

  async function submit() {
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return; }
    setSaving(true);
    const res = await window.accounts.create({ name: form.name.trim(), type: form.type, color: form.color, brokerAccountId: form.brokerAccountId.trim(), platform });
    setSaving(false);
    if (res.ok) { onCreate(res.data); onClose(); }
    else setError(res.error ?? 'Erreur inconnue');
  }

  const plat = platform ? PLATFORMS[platform] : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {step === 'details' && (
              <button onClick={() => setStep('platform')} style={{ background: 'none', border: 'none', color: '#3a6a4a', cursor: 'pointer', fontSize: '18px', padding: '0', lineHeight: 1 }}>←</button>
            )}
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '4px' }}>NOUVEAU COMPTE</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#e8f8e8' }}>
                {step === 'platform' ? 'Choisir la plateforme' : `Compte ${plat?.label}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>

        {/* ── Step 1: Platform selection ── */}
        {step === 'platform' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(PLATFORMS).map(([key, p]) => {
              const { Logo } = p;
              return (
                <div key={key} onClick={() => !p.soon && selectPlatform(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 18px', borderRadius: '8px', cursor: p.soon ? 'not-allowed' : 'pointer', background: `rgba(${p.color === '#00ff88' ? '0,255,136' : p.color === '#00aaff' ? '0,170,255' : '255,204,0'},0.05)`, border: `1px solid ${p.color}20`, transition: 'all 0.15s', opacity: p.soon ? 0.55 : 1 }}
                  onMouseEnter={e => { if (!p.soon) { e.currentTarget.style.background = `rgba(${p.color === '#00ff88' ? '0,255,136' : p.color === '#00aaff' ? '0,170,255' : '255,204,0'},0.1)`; e.currentTarget.style.borderColor = p.color + '50'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = `rgba(${p.color === '#00ff88' ? '0,255,136' : p.color === '#00aaff' ? '0,170,255' : '255,204,0'},0.05)`; e.currentTarget.style.borderColor = p.color + '20'; }}
                >
                  {/* Logo box */}
                  <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: `${p.color}12`, border: `1px solid ${p.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Logo size={30} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: p.color }}>{p.label}</span>
                      {p.soon && <span style={{ fontSize: '9px', color: '#3a6a4a', background: 'rgba(0,255,136,0.08)', border: '1px solid #1a4a2a', padding: '1px 6px', borderRadius: '3px', letterSpacing: '1px' }}>BIENTÔT</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4a7a5a' }}>{p.desc}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {Object.values(p.types).map(t => (
                        <span key={t.label} style={{ fontSize: '10px', color: '#2a5a32', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.1)', padding: '2px 7px', borderRadius: '3px' }}>{t.label}</span>
                      ))}
                    </div>
                  </div>
                  {!p.soon && <div style={{ fontSize: '18px', color: p.color + '60', flexShrink: 0 }}>›</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Step 2: Account details ── */}
        {step === 'details' && plat && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Platform indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: `${plat.color}08`, border: `1px solid ${plat.color}20`, borderRadius: '6px' }}>
              <plat.Logo size={22} />
              <span style={{ fontSize: '13px', color: plat.color, fontWeight: '600' }}>{plat.label}</span>
            </div>

            {/* Account name */}
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>NOM DU COMPTE *</div>
              <input placeholder={`Ex: ${plat.label} Mai 2026`} value={form.name} onChange={set('name')} style={inp} autoFocus />
            </div>

            {/* Account type (sub-types of platform) */}
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>TYPE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {Object.entries(plat.types).map(([key, info]) => (
                  <div key={key} onClick={() => setForm(p => ({ ...p, type: key, color: TYPE_LABELS[key]?.color ?? plat.color }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', background: form.type === key ? `${plat.color}10` : 'rgba(10,28,18,0.4)', border: `1px solid ${form.type === key ? plat.color + '40' : 'rgba(0,255,136,0.08)'}`, transition: 'all 0.12s' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: form.type === key ? plat.color : '#c8d8c8', fontWeight: form.type === key ? '700' : '400' }}>{info.label}</div>
                      <div style={{ fontSize: '11px', color: '#3a6a4a' }}>{info.desc}</div>
                    </div>
                    <div style={{ width: '15px', height: '15px', borderRadius: '50%', border: `2px solid ${form.type === key ? plat.color : '#2a5a3a'}`, background: form.type === key ? plat.color : 'transparent', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>COULEUR</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid white' : '2px solid transparent', boxShadow: form.color === c ? `0 0 8px ${c}` : 'none', transition: 'all 0.15s' }} />
                ))}
              </div>
            </div>

            {/* Broker ID */}
            <div>
              <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>ID BROKER (optionnel)</div>
              <input placeholder="Ex: 50KTC-236410" value={form.brokerAccountId} onChange={set('brokerAccountId')} style={inp} />
            </div>

            {error && <div style={{ padding: '10px', background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '5px', color: '#ff4455', fontSize: '12px' }}>⚠ {error}</div>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }}>ANNULER</button>
              <button onClick={submit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '5px', background: `${form.color}22`, border: `1px solid ${form.color}60`, color: form.color, fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
                {saving ? 'CRÉATION...' : 'CRÉER'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountSelect({ onSelect, onBack }) {
  const [data, setData]         = useState({ accounts: [], activeId: null });
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoading(true);
    const res = await window.accounts.getAll();
    if (res.ok) setData(res.data);
    setLoading(false);
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

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060c10', color: '#3a6a4a', fontSize: '12px', letterSpacing: '2px', fontFamily: 'monospace' }}>CHARGEMENT...</div>
  );

  return (
    <div style={{ height: '100vh', background: '#060c10', backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,40,20,0.5) 0%, transparent 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono','Fira Code',monospace", color: '#c8d8c8', padding: '40px 20px' }}>

      {/* Back button */}
      {onBack && (
        <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid #1a3a22', color: '#4a7a5a', padding: '8px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.borderColor = '#00ff88'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a7a5a'; e.currentTarget.style.borderColor = '#1a3a22'; }}
          >← Retour</button>
        </div>
      )}

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '48px' }}>
        <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg,#00ff88,#00aa55)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,255,136,0.3)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#060c10" strokeWidth="2.5" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8f8e8', letterSpacing: '2px' }}>TRADE DASHBOARD</div>
          <div style={{ fontSize: '11px', color: '#3a6a4a', letterSpacing: '3px' }}>SÉLECTIONNER UN COMPTE</div>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '800px' }}>
        {data.accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed #1a3a22', borderRadius: '10px', marginBottom: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '14px', color: '#c8d8c8', marginBottom: '8px' }}>Aucun compte créé</div>
            <div style={{ fontSize: '12px', color: '#3a6a4a' }}>Créez votre premier compte pour commencer</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px', marginBottom: '20px' }}>
            {data.accounts.map(acc => {
              const typeInfo = TYPE_LABELS[acc.type] ?? { label: 'Autre', color: acc.color ?? '#ff6644', platform: 'perso' };
              const isActive = acc.id === data.activeId;
              return (
                <div key={acc.id} onClick={() => handleSelect(acc.id)} style={{ background: isActive ? `${acc.color}0d` : 'rgba(10,28,18,0.5)', border: `2px solid ${isActive ? acc.color : 'rgba(0,255,136,0.08)'}`, borderRadius: '10px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', boxShadow: isActive ? `0 0 24px ${acc.color}20` : 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 24px ${acc.color}20`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isActive ? `0 0 24px ${acc.color}20` : 'none'; }}
                >
                  {isActive && <div style={{ position: 'absolute', top: '10px', right: '10px', background: `${acc.color}20`, border: `1px solid ${acc.color}40`, borderRadius: '3px', padding: '2px 6px', fontSize: '8px', color: acc.color, letterSpacing: '1px', fontWeight: '700' }}>ACTIF</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '9px', background: `${acc.color}12`, border: `1px solid ${acc.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {typeInfo.platform === 'topstep'   && <TopstepLogo size={24} />}
                      {typeInfo.platform === 'tradovate' && <TradovateLogo size={24} />}
                      {typeInfo.platform === 'perso'     && <PersonalLogo size={24} />}
                      {!typeInfo.platform                && <span style={{ fontSize: '18px' }}>📊</span>}
                    </div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: acc.color, boxShadow: `0 0 6px ${acc.color}` }} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8', marginBottom: '4px' }}>{acc.name}</div>
                  <div style={{ fontSize: '11px', color: acc.color, marginBottom: '4px' }}>{typeInfo.label}</div>
                  {acc.brokerAccountId && <div style={{ fontSize: '10px', color: '#3a6a4a' }}>{acc.brokerAccountId}</div>}
                  <div style={{ fontSize: '10px', color: '#2a4a30', marginTop: '8px' }}>Créé le {new Date(acc.createdAt).toLocaleDateString('fr-FR')}</div>
                  <button onClick={e => handleDelete(acc.id, e)} style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'none', border: 'none', color: '#1a3a20', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', borderRadius: '3px', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.background = 'rgba(255,68,85,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#1a3a20'; e.currentTarget.style.background = 'none'; }}
                  >🗑</button>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={() => setShowCreate(true)} style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px dashed #1a4a2a', borderRadius: '8px', color: '#3a6a4a', fontSize: '12px', fontFamily: 'inherit', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.2s ease' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff88'; e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a4a2a'; e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.background = 'transparent'; }}
        >+ CRÉER UN NOUVEAU COMPTE</button>
      </div>

      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} onCreate={() => { loadAccounts(); }} />}
    </div>
  );
}
