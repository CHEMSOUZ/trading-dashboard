import { useState, useEffect } from 'react';

const TYPE_LABELS = {
  topstep_50k:  { label: 'Topstep Express 50K',  icon: '🏆', color: '#00ff88', desc: 'Funded · Trailing DD -2 000$' },
  topstep_100k: { label: 'Topstep Express 100K', icon: '🏆', color: '#00aaff', desc: 'Funded · Trailing DD -3 000$' },
  topstep_150k: { label: 'Topstep Express 150K', icon: '🏆', color: '#aa88ff', desc: 'Funded · Trailing DD -4 500$' },
  perso:        { label: 'Compte Personnel',      icon: '💼', color: '#ffcc00', desc: 'Compte live ou paper trading' },
  autre:        { label: 'Autre compte',          icon: '📊', color: '#ff6644', desc: 'Broker ou plateforme custom' },
};

const COLORS = ['#00ff88','#00aaff','#aa88ff','#ffcc00','#ff6644','#ff4488','#44ffcc'];

function CreateAccountModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', type: 'topstep_50k', color: '#00ff88', brokerAccountId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!form.name.trim()) { setError('Le nom est obligatoire'); return; }
    setSaving(true);
    const res = await window.accounts.create({
      name: form.name.trim(),
      type: form.type,
      color: form.color,
      brokerAccountId: form.brokerAccountId.trim(),
    });
    setSaving(false);
    if (res.ok) { onCreate(res.data); onClose(); }
    else setError(res.error ?? 'Erreur inconnue');
  }

  const inp = {
    background: 'rgba(10,28,18,0.6)', border: '1px solid rgba(0,255,136,0.15)',
    borderRadius: '5px', padding: '9px 12px', color: '#c8d8c8',
    fontSize: '12px', fontFamily: 'inherit', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#070d12', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '10px', width: '100%', maxWidth: '480px', padding: '28px' }}>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px', marginBottom: '6px' }}>NOUVEAU</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8f8e8' }}>Créer un compte</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Name */}
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>NOM DU COMPTE *</div>
            <input placeholder="Ex: Topstep Mai 2026" value={form.name} onChange={set('name')} style={inp} autoFocus />
          </div>

          {/* Type */}
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>TYPE DE COMPTE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(TYPE_LABELS).map(([key, info]) => (
                <div key={key} onClick={() => setForm(p => ({ ...p, type: key, color: info.color }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '6px', cursor: 'pointer',
                    background: form.type === key ? `rgba(${info.color === '#00ff88' ? '0,255,136' : info.color === '#00aaff' ? '0,170,255' : info.color === '#aa88ff' ? '170,136,255' : info.color === '#ffcc00' ? '255,204,0' : '255,102,68'},0.08)` : 'rgba(10,28,18,0.4)',
                    border: `1px solid ${form.type === key ? info.color + '40' : 'rgba(0,255,136,0.08)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{info.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: form.type === key ? info.color : '#c8d8c8', fontWeight: form.type === key ? '700' : '400' }}>{info.label}</div>
                    <div style={{ fontSize: '10px', color: '#3a6a4a' }}>{info.desc}</div>
                  </div>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: `2px solid ${form.type === key ? info.color : '#2a5a3a'}`,
                    background: form.type === key ? info.color : 'transparent',
                    flexShrink: 0,
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '8px' }}>COULEUR</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: c, cursor: 'pointer',
                  border: form.color === c ? '2px solid white' : '2px solid transparent',
                  boxShadow: form.color === c ? `0 0 8px ${c}` : 'none',
                  transition: 'all 0.15s',
                }} />
              ))}
            </div>
          </div>

          {/* Broker ID */}
          <div>
            <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '2px', marginBottom: '6px' }}>ID COMPTE BROKER (optionnel)</div>
            <input placeholder="Ex: 50KTC-V2-236410-99687742" value={form.brokerAccountId} onChange={set('brokerAccountId')} style={inp} />
          </div>

          {error && (
            <div style={{ padding: '10px', background: 'rgba(255,68,85,0.1)', border: '1px solid rgba(255,68,85,0.3)', borderRadius: '5px', color: '#ff4455', fontSize: '11px' }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #1a3a22', background: 'transparent', color: '#5a8a6a', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer' }}>
              ANNULER
            </button>
            <button onClick={submit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '5px', background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,170,85,0.1))', border: `1px solid ${form.color}60`, color: form.color, fontSize: '11px', fontFamily: 'inherit', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer' }}>
              {saving ? 'CRÉATION...' : 'CRÉER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountSelect({ onSelect }) {
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

  async function handleCreated(account) {
    await loadAccounts();
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060c10', color: '#3a6a4a', fontSize: '11px', letterSpacing: '2px', fontFamily: 'inherit' }}>
      CHARGEMENT...
    </div>
  );

  return (
    <div style={{
      height: '100vh', background: '#060c10',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,40,20,0.5) 0%, transparent 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono','Fira Code',monospace", color: '#c8d8c8',
      padding: '40px 20px',
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '48px' }}>
        <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg,#00ff88,#00aa55)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,255,136,0.3)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#060c10" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8f8e8', letterSpacing: '2px' }}>TRADE DASHBOARD</div>
          <div style={{ fontSize: '10px', color: '#3a6a4a', letterSpacing: '3px' }}>SÉLECTIONNER UN COMPTE</div>
        </div>
      </div>

      {/* Account grid */}
      <div style={{ width: '100%', maxWidth: '800px' }}>

        {data.accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed #1a3a22', borderRadius: '10px', marginBottom: '20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '14px', color: '#c8d8c8', marginBottom: '8px' }}>Aucun compte créé</div>
            <div style={{ fontSize: '11px', color: '#3a6a4a' }}>Créez votre premier compte pour commencer</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px', marginBottom: '20px' }}>
            {data.accounts.map(acc => {
              const typeInfo = TYPE_LABELS[acc.type] ?? TYPE_LABELS.autre;
              const isActive = acc.id === data.activeId;
              return (
                <div key={acc.id} onClick={() => handleSelect(acc.id)} style={{
                  background: isActive ? `rgba(${acc.color === '#00ff88' ? '0,255,136' : '255,255,255'},0.05)` : 'rgba(10,28,18,0.5)',
                  border: `2px solid ${isActive ? acc.color : 'rgba(0,255,136,0.08)'}`,
                  borderRadius: '10px', padding: '20px',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  position: 'relative',
                  boxShadow: isActive ? `0 0 24px ${acc.color}20` : 'none',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 24px ${acc.color}20`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isActive ? `0 0 24px ${acc.color}20` : 'none'; }}
                >
                  {/* Active badge */}
                  {isActive && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: `${acc.color}20`, border: `1px solid ${acc.color}40`, borderRadius: '3px', padding: '2px 6px', fontSize: '7px', color: acc.color, letterSpacing: '1px', fontWeight: '700' }}>
                      ACTIF
                    </div>
                  )}

                  {/* Color dot + icon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${acc.color}20`, border: `1px solid ${acc.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      {typeInfo.icon}
                    </div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: acc.color, boxShadow: `0 0 6px ${acc.color}` }} />
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#e8f8e8', marginBottom: '4px' }}>{acc.name}</div>
                  <div style={{ fontSize: '10px', color: acc.color, marginBottom: '4px' }}>{typeInfo.label}</div>
                  {acc.brokerAccountId && (
                    <div style={{ fontSize: '9px', color: '#3a6a4a', letterSpacing: '0.5px' }}>{acc.brokerAccountId}</div>
                  )}
                  <div style={{ fontSize: '9px', color: '#2a4a30', marginTop: '8px' }}>
                    Créé le {new Date(acc.createdAt).toLocaleDateString('fr-FR')}
                  </div>

                  {/* Delete button */}
                  <button onClick={e => handleDelete(acc.id, e)} style={{
                    position: 'absolute', bottom: '10px', right: '10px',
                    background: 'none', border: 'none', color: '#1a3a20',
                    cursor: 'pointer', fontSize: '14px', padding: '2px 6px',
                    borderRadius: '3px', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ff4455'; e.currentTarget.style.background = 'rgba(255,68,85,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#1a3a20'; e.currentTarget.style.background = 'none'; }}
                    title="Supprimer le compte"
                  >🗑</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Create button */}
        <button onClick={() => setShowCreate(true)} style={{
          width: '100%', padding: '14px',
          background: 'transparent', border: '1px dashed #1a4a2a',
          borderRadius: '8px', color: '#3a6a4a',
          fontSize: '11px', fontFamily: 'inherit', letterSpacing: '2px',
          cursor: 'pointer', transition: 'all 0.2s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff88'; e.currentTarget.style.color = '#00ff88'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a4a2a'; e.currentTarget.style.color = '#3a6a4a'; e.currentTarget.style.background = 'transparent'; }}
        >
          + CRÉER UN NOUVEAU COMPTE
        </button>
      </div>

      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />}
    </div>
  );
}
