import { useState } from 'react';

const C = {
  bg:      '#090a10',
  panel:   'rgba(14,15,22,0.97)',
  border:  'rgba(136,153,187,0.18)',
  accent:  '#7c3aed',
  accentL: '#a78bfa',
  text1:   '#e8edf8',
  text2:   '#9aa5bb',
  text3:   '#5a6a82',
  red:     '#ff5566',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode, email, password, confirmPassword) {
  if (!EMAIL_RE.test(email.trim())) return 'Adresse email invalide.';
  if (!password) return 'Mot de passe requis.';
  if (mode === 'register') {
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (password !== confirmPassword) return 'Les mots de passe ne correspondent pas.';
  }
  return null;
}

const inputStyle = {
  width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(136,153,187,0.20)',
  borderRadius: '6px', padding: '9px 11px', color: '#e8edf8', fontSize: '13px',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

export default function LoginScreen({ onAuthenticated }) {
  const [mode,            setMode]            = useState('login'); // 'login' | 'register'
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const isRegister = mode === 'register';

  function switchMode(next) {
    setMode(next);
    setPassword('');
    setConfirmPassword('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const validationError = validate(mode, email, password, confirmPassword);
    if (validationError) { setError(validationError); return; }

    setError('');
    setLoading(true);
    const res = mode === 'login'
      ? await window.auth.login(email.trim(), password)
      : await window.auth.register(email.trim(), password);
    setLoading(false);

    if (res.ok) onAuthenticated?.(res.data);
    else setError(res.error || 'Une erreur est survenue.');
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <div style={{ width: '360px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '32px 30px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#8899bb,#4a6080)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(136,153,187,0.30)', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8edf8" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: C.text1, letterSpacing: '1px' }}>TRADING DASHBOARD</div>
            <div style={{ fontSize: '11px', color: C.text3 }}>{isRegister ? 'Créer un compte' : 'Connexion'}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            style={inputStyle}
          />

          <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginTop: '14px', marginBottom: '6px', letterSpacing: '0.5px' }}>MOT DE PASSE</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />

          {isRegister && (
            <>
              <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginTop: '14px', marginBottom: '6px', letterSpacing: '0.5px' }}>CONFIRMER LE MOT DE PASSE</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </>
          )}

          {error && (
            <div style={{ marginTop: '14px', padding: '8px 10px', background: 'rgba(255,51,68,0.08)', border: '1px solid rgba(255,51,68,0.25)', borderRadius: '6px', color: C.red, fontSize: '12px', lineHeight: '1.5' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', marginTop: '20px', padding: '11px 0',
              background: loading ? 'rgba(124,58,237,0.15)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              border: '1px solid rgba(124,58,237,0.5)', borderRadius: '7px',
              color: '#fff', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700',
              letterSpacing: '1px', cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 16px rgba(124,58,237,0.30)', transition: 'all 0.15s',
            }}>
            {loading ? (isRegister ? 'CRÉATION...' : 'CONNEXION...') : (isRegister ? 'CRÉER LE COMPTE' : 'SE CONNECTER')}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: C.text3 }}>
          {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
          <button onClick={() => switchMode(isRegister ? 'login' : 'register')}
            style={{ background: 'none', border: 'none', color: C.accentL, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', padding: 0 }}>
            {isRegister ? 'Se connecter' : 'Créer un compte'}
          </button>
        </div>
      </div>
    </div>
  );
}
