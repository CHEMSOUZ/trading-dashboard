import { useState } from 'react';
import { EMOTION_COLORS, emotionTone, emotionRgb, ToneIcon } from '../../shared/emotionTraits';

const C = {
  bg:      '#090a10',
  panel:   'rgba(10,11,18,0.82)',
  border:  'rgba(136,153,187,0.20)',
  green:   '#00cc77',
  greenD:  '#00aa66',
  text1:   '#e8edf8',
  text2:   '#9aa5bb',
  text3:   '#5a6a82',
  red:     '#ff5566',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mise en scène uniquement : trait fixe, positif, jamais une vraie donnée utilisateur.
const TEASER_EMOTION = 'Discipliné';
const TEASER_TAGLINE = 'Exécution rigoureuse, plan respecté à la lettre.';
const teaserColor = EMOTION_COLORS[TEASER_EMOTION];
const teaserRgb   = emotionRgb(teaserColor);

function validate(mode, email, password, confirmPassword) {
  if (!EMAIL_RE.test(email.trim())) return 'Adresse email invalide.';
  if (!password) return 'Mot de passe requis.';
  if (mode === 'register') {
    if (password.length < 8)          return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (!/[a-zA-Z]/.test(password))   return 'Le mot de passe doit contenir au moins une lettre.';
    if (!/\d/.test(password))          return 'Le mot de passe doit contenir au moins un chiffre.';
    if (password !== confirmPassword)  return 'Les mots de passe ne correspondent pas.';
  }
  return null;
}

const inputStyle = {
  width: '100%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(136,153,187,0.22)',
  borderRadius: '6px', padding: '9px 11px', color: '#e8edf8', fontSize: '13px',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

function ForgotPasswordScreen({ onBack, onCodeSent }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setError('Adresse email invalide.'); return; }
    setError(''); setLoading(true);
    const res = await window.auth.forgotPassword(email.trim());
    setLoading(false);
    if (res.ok) onCodeSent(email.trim());
    else setError(res.error || 'Une erreur est survenue.');
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ fontSize: '11px', color: C.text3, letterSpacing: '1.5px', marginBottom: '6px', textAlign: 'center' }}>MOT DE PASSE OUBLIÉ</div>
      <div style={{ fontSize: '12px', color: C.text2, marginBottom: '18px', textAlign: 'center', lineHeight: '1.5' }}>
        Entrez votre email. Un code à 6 chiffres vous sera envoyé.
      </div>
      <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>EMAIL</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus style={inputStyle} />
      {error && (
        <div style={{ marginTop: '12px', padding: '8px 10px', background: 'rgba(255,51,68,0.08)', border: '1px solid rgba(255,51,68,0.25)', borderRadius: '6px', color: C.red, fontSize: '12px' }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} style={{
        width: '100%', marginTop: '18px', padding: '11px 0',
        background: loading ? 'rgba(0,204,119,0.15)' : `linear-gradient(135deg,${C.green},${C.greenD})`,
        border: `1px solid rgba(0,204,119,0.5)`, borderRadius: '7px',
        color: '#04200f', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700',
        letterSpacing: '1px', cursor: loading ? 'wait' : 'pointer',
        boxShadow: loading ? 'none' : '0 0 16px rgba(0,204,119,0.30)', transition: 'all 0.15s',
      }}>
        {loading ? 'ENVOI...' : 'ENVOYER LE CODE'}
      </button>
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', padding: 0 }}>
          ← Retour à la connexion
        </button>
      </div>
    </form>
  );
}

function ResetPasswordScreen({ email, onSuccess, onResend }) {
  const [code,            setCode]            = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.trim().length !== 6) { setError('Le code doit contenir 6 chiffres.'); return; }
    if (newPassword.length < 8)          { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (!/[a-zA-Z]/.test(newPassword))   { setError('Le mot de passe doit contenir au moins une lettre.'); return; }
    if (!/\d/.test(newPassword))          { setError('Le mot de passe doit contenir au moins un chiffre.'); return; }
    if (newPassword !== confirmPassword)  { setError('Les mots de passe ne correspondent pas.'); return; }
    setError(''); setLoading(true);
    const res = await window.auth.resetPassword(email, code.trim(), newPassword);
    setLoading(false);
    if (res.ok) onSuccess();
    else setError(res.error || 'Une erreur est survenue.');
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ fontSize: '11px', color: C.text3, letterSpacing: '1.5px', marginBottom: '6px', textAlign: 'center' }}>NOUVEAU MOT DE PASSE</div>
      <div style={{ fontSize: '12px', color: C.text2, marginBottom: '18px', textAlign: 'center', lineHeight: '1.5' }}>
        Code envoyé à <span style={{ color: C.green }}>{email}</span>
      </div>

      <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginBottom: '6px', letterSpacing: '0.5px' }}>CODE À 6 CHIFFRES</label>
      <input
        type="text" inputMode="numeric" maxLength={6} value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        autoFocus placeholder="000000"
        style={{ ...inputStyle, textAlign: 'center', fontSize: '22px', letterSpacing: '8px', fontWeight: '700' }}
      />

      <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginTop: '14px', marginBottom: '6px', letterSpacing: '0.5px' }}>NOUVEAU MOT DE PASSE</label>
      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />

      <label style={{ display: 'block', fontSize: '11px', color: C.text3, marginTop: '14px', marginBottom: '6px', letterSpacing: '0.5px' }}>CONFIRMER</label>
      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />

      {error && (
        <div style={{ marginTop: '12px', padding: '8px 10px', background: 'rgba(255,51,68,0.08)', border: '1px solid rgba(255,51,68,0.25)', borderRadius: '6px', color: C.red, fontSize: '12px' }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} style={{
        width: '100%', marginTop: '18px', padding: '11px 0',
        background: loading ? 'rgba(0,204,119,0.15)' : `linear-gradient(135deg,${C.green},${C.greenD})`,
        border: `1px solid rgba(0,204,119,0.5)`, borderRadius: '7px',
        color: '#04200f', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700',
        letterSpacing: '1px', cursor: loading ? 'wait' : 'pointer',
        boxShadow: loading ? 'none' : '0 0 16px rgba(0,204,119,0.30)', transition: 'all 0.15s',
      }}>
        {loading ? 'RÉINITIALISATION...' : 'RÉINITIALISER LE MOT DE PASSE'}
      </button>
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button type="button" onClick={onResend} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', padding: 0 }}>
          ← Renvoyer un code
        </button>
      </div>
    </form>
  );
}

// Aperçu décoratif du badge "Portrait IA" (État Mental) — flouté en arrière-plan,
// jamais interactif, jamais une vraie donnée (cf. TEASER_EMOTION ci-dessus).
function BackgroundTeaser() {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      filter: 'blur(48px)', transform: 'scale(1.3)', pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '620px', borderRadius: '18px', overflow: 'hidden',
        border: `1px solid rgba(${teaserRgb},0.5)`, background: 'rgba(14,15,22,0.35)',
      }}>
        <div style={{ padding: '26px 30px', background: `linear-gradient(135deg, rgba(${teaserRgb},0.50), rgba(${teaserRgb},0.10))` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '58px', height: '58px', borderRadius: '14px',
              background: `rgba(${teaserRgb},0.35)`, border: `1px solid rgba(${teaserRgb},0.7)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ToneIcon tone={emotionTone(TEASER_EMOTION)} color={teaserColor} size={30} />
            </div>
            <div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: teaserColor }}>{TEASER_EMOTION}</div>
              <div style={{ fontSize: '14px', color: '#aebbd4', marginTop: '4px' }}>{TEASER_TAGLINE}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 30px 26px', display: 'flex', gap: '10px' }}>
          {['WIN RATE', 'PROFIT FACTOR', 'SÉRIE'].map(label => (
            <div key={label} style={{ flex: 1, background: 'rgba(136,153,187,0.08)', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '9px', color: '#5a6a82', letterSpacing: '1.5px', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#dde4ef' }}>•••</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginScreen({ onAuthenticated }) {
  const [mode,            setMode]            = useState('login'); // 'login' | 'register' | 'forgot' | 'reset' | 'success'
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [resetEmail,      setResetEmail]      = useState('');

  const isRegister     = mode === 'register';
  const isAuthMode     = mode === 'login' || mode === 'register';

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
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <BackgroundTeaser />

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 50% 45%, rgba(9,10,16,0.25) 0%, rgba(9,10,16,0.72) 55%, rgba(9,10,16,0.92) 100%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '32px 20px', boxSizing: 'border-box',
      }}>
        {/* Logo + nom de l'app */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: `linear-gradient(135deg,${C.green},${C.greenD})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px rgba(0,204,119,0.35)`, flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <line x1="6" y1="3" x2="6" y2="21" stroke="#04200f" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="3.5" y="8" width="5" height="7" rx="1" fill="#04200f" />
              <line x1="13" y1="2" x2="13" y2="13" stroke="#04200f" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="10.5" y="4" width="5" height="6" rx="1" fill="#04200f" />
              <line x1="20" y1="6" x2="20" y2="22" stroke="#04200f" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="17.5" y="11" width="5" height="8" rx="1" fill="#04200f" />
            </svg>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: C.text1, letterSpacing: '2px' }}>TRADING DASHBOARD</div>
        </div>

        {/* Titre accrocheur — masqué sur les écrans forgot/reset/success */}
        {isAuthMode && (
          <div style={{ textAlign: 'center', maxWidth: '380px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: C.text1, margin: '0 0 8px', letterSpacing: '-0.3px', lineHeight: '1.3' }}>
              Découvre ton profil psychologique de trading
            </h1>
            <div style={{ fontSize: '13px', color: C.text2, lineHeight: '1.5' }}>
              Chaque jour, l'IA analyse tes trades et révèle l'état d'esprit derrière tes décisions.
            </div>
          </div>
        )}

        {/* Panneau principal */}
        <div style={{
          width: '360px', background: C.panel, backdropFilter: 'blur(6px)',
          border: `1px solid ${C.border}`, borderRadius: '14px', padding: '28px 30px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}>

          {/* ── Étape 1 : saisie de l'email ── */}
          {mode === 'forgot' && (
            <ForgotPasswordScreen
              onBack={() => switchMode('login')}
              onCodeSent={(em) => { setResetEmail(em); switchMode('reset'); }}
            />
          )}

          {/* ── Étape 2 : saisie du code + nouveau mdp ── */}
          {mode === 'reset' && (
            <ResetPasswordScreen
              email={resetEmail}
              onSuccess={() => switchMode('success')}
              onResend={() => switchMode('forgot')}
            />
          )}

          {/* ── Étape 3 : succès ── */}
          {mode === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', color: C.green, marginBottom: '12px' }}>✓</div>
              <div style={{ fontSize: '11px', color: C.green, fontWeight: '700', letterSpacing: '1.5px', marginBottom: '10px' }}>
                MOT DE PASSE RÉINITIALISÉ
              </div>
              <div style={{ fontSize: '12px', color: C.text2, marginBottom: '22px', lineHeight: '1.6' }}>
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </div>
              <button onClick={() => switchMode('login')} style={{
                width: '100%', padding: '11px 0',
                background: `linear-gradient(135deg,${C.green},${C.greenD})`,
                border: `1px solid rgba(0,204,119,0.5)`, borderRadius: '7px',
                color: '#04200f', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700',
                letterSpacing: '1px', cursor: 'pointer', boxShadow: '0 0 16px rgba(0,204,119,0.30)',
              }}>
                SE CONNECTER
              </button>
            </div>
          )}

          {/* ── Connexion / Inscription ── */}
          {isAuthMode && (
            <>
              <div style={{ fontSize: '11px', color: C.text3, letterSpacing: '1.5px', marginBottom: '18px', textAlign: 'center' }}>
                {isRegister ? 'CRÉER UN COMPTE' : 'CONNEXION'}
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
                    background: loading ? 'rgba(0,204,119,0.15)' : `linear-gradient(135deg,${C.green},${C.greenD})`,
                    border: `1px solid rgba(0,204,119,0.5)`, borderRadius: '7px',
                    color: '#04200f', fontSize: '13px', fontFamily: 'inherit', fontWeight: '700',
                    letterSpacing: '1px', cursor: loading ? 'wait' : 'pointer',
                    boxShadow: loading ? 'none' : '0 0 16px rgba(0,204,119,0.30)', transition: 'all 0.15s',
                  }}>
                  {loading ? (isRegister ? 'CRÉATION...' : 'CONNEXION...') : (isRegister ? 'CRÉER LE COMPTE' : 'SE CONNECTER')}
                </button>
              </form>

              {!isRegister && (
                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <button onClick={() => switchMode('forgot')}
                    style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit', padding: 0 }}>
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <div style={{ marginTop: isRegister ? '20px' : '14px', textAlign: 'center', fontSize: '12px', color: C.text3 }}>
                {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <button onClick={() => switchMode(isRegister ? 'login' : 'register')}
                  style={{ background: 'none', border: 'none', color: C.green, cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: '700', padding: 0 }}>
                  {isRegister ? 'Se connecter' : 'Créer un compte'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
