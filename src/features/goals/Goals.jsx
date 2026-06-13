import { useState, useEffect, useMemo } from 'react';

const ACCOUNT_RULES = {
  topstep_50k:      { size: 50000,  maxLoss: 2000, dailyLoss: 1000, profitTarget: 3000 },
  topstep_100k:     { size: 100000, maxLoss: 3000, dailyLoss: 2000, profitTarget: 6000 },
  topstep_150k:     { size: 150000, maxLoss: 4500, dailyLoss: 3000, profitTarget: 9000 },
  topstep_ef_50k:   { size: 50000,  maxLoss: 2000, dailyLoss: 1000, profitTarget: null },
  topstep_ef_100k:  { size: 100000, maxLoss: 3000, dailyLoss: 2000, profitTarget: null },
  lucid_eval_25k:   { size: 25000,  maxLoss: 1000, dailyLoss: null, profitTarget: 1250 },
  lucid_eval_50k:   { size: 50000,  maxLoss: 2000, dailyLoss: null, profitTarget: 3000 },
  lucid_eval_100k:  { size: 100000, maxLoss: 3000, dailyLoss: null, profitTarget: 6000 },
  lucid_funded_50k: { size: 50000,  maxLoss: 2500, dailyLoss: 2000, profitTarget: null },
  lucid_funded_100k:{ size: 100000, maxLoss: 3000, dailyLoss: 3000, profitTarget: null },
};

const BADGES = [
  { id: 'first_blood',   label: 'Premiers Pas',    emoji: '🎯', desc: 'Premier trade enregistré',            check: (s) => s.total >= 1 },
  { id: 'centurion',     label: 'Centurion',        emoji: '💯', desc: '100 trades au compteur',             check: (s) => s.total >= 100 },
  { id: 'precision',     label: 'Précision',        emoji: '🎖️', desc: '60%+ winrate avec 20+ trades',       check: (s) => s.total >= 20 && s.winrate >= 60 },
  { id: 'machine',       label: 'Machine',          emoji: '⚙️', desc: 'Profit Factor 2.0+ sur 20+ trades', check: (s) => s.total >= 20 && s.pf >= 2 },
  { id: 'green_week',    label: 'Semaine Verte',    emoji: '🌿', desc: '70%+ winrate cette semaine (5+ trades)', check: (s, w) => w.total >= 5 && w.winrate >= 70 },
  { id: 'survivor',     label: 'Résilience',       emoji: '🛡️', desc: 'Rebond positif après 3 pertes consécutives', check: (s) => s.hasBounce },
  { id: 'discipline',   label: 'Discipline',       emoji: '🧘', desc: 'Pas de daily loss breach en 30 jours', check: (s) => s.noDailyBreach },
  { id: 'streak3',      label: 'Streak x3',        emoji: '🔥', desc: '3 jours verts consécutifs',          check: (s) => s.maxStreak >= 3 },
  { id: 'streak7',      label: 'Streak x7',        emoji: '⚡', desc: '7 jours verts consécutifs',          check: (s) => s.maxStreak >= 7 },
  { id: 'profitable',   label: 'Profitable',       emoji: '💰', desc: 'PnL total positif',                  check: (s) => s.totalPnl > 0 },
];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function GoalInput({ label, value, onChange, suffix = '$', placeholder = '0' }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#5a6a82', marginBottom: '4px', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '90px', background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.18)', borderRadius: '5px', padding: '7px 10px', color: '#dde4ef', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }} />
        <span style={{ fontSize: '12px', color: '#5a6a82' }}>{suffix}</span>
      </div>
    </div>
  );
}

function ProgressBar({ label, current, target, color = '#00ff88', suffix = '', inverseColor = false }) {
  if (!target || target <= 0) return null;
  const pct    = Math.min(1, Math.max(0, current / target));
  const barCol = inverseColor
    ? (pct >= 0.9 ? '#ff3344' : pct >= 0.6 ? '#f59e0b' : '#00ff88')
    : (pct >= 0.8 ? '#00ff88' : pct >= 0.4 ? '#f59e0b' : '#5a6a82');
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', color: '#8899bb' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: '700', color: barCol }}>{typeof current === 'number' ? current.toFixed(current < 10 ? 1 : 0) : current}{suffix} / {target}{suffix}</span>
      </div>
      <div style={{ height: '8px', background: 'rgba(136,153,187,0.10)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: barCol, borderRadius: '4px', transition: 'width 0.5s ease', boxShadow: `0 0 8px ${barCol}50` }} />
      </div>
      <div style={{ fontSize: '10px', color: '#5a6a82', marginTop: '3px', textAlign: 'right' }}>{(pct * 100).toFixed(0)}%</div>
    </div>
  );
}

function StreakCalendar({ dailyMap }) {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, pnl: dailyMap[key] ?? null, label: `${d.getDate()}/${d.getMonth() + 1}` });
  }

  return (
    <div>
      <div style={{ fontSize: '11px', color: '#5a6a82', letterSpacing: '2px', marginBottom: '10px' }}>30 DERNIERS JOURS</div>
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
        {days.map(({ date, pnl, label }) => {
          const isToday = date === today.toISOString().slice(0, 10);
          const hasData = pnl !== null;
          const isGreen = pnl > 0;
          const isRed   = pnl < 0;
          const color   = !hasData ? 'rgba(136,153,187,0.06)' : isGreen ? `rgba(0,255,136,${0.15 + Math.min(0.65, Math.abs(pnl) / 500)})` : `rgba(255,51,68,${0.15 + Math.min(0.65, Math.abs(pnl) / 500)})`;
          const border  = isToday ? '1px solid rgba(255,255,255,0.4)' : hasData ? `1px solid ${isGreen ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,68,0.25)'}` : '1px solid rgba(136,153,187,0.08)';
          return (
            <div key={date} title={`${label}: ${pnl !== null ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}$` : 'Pas de trade'}`}
              style={{ width: '26px', height: '26px', borderRadius: '4px', background: color, border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: hasData ? (isGreen ? '#00ff88' : '#ff7788') : '#3a4a5a', cursor: 'default', transition: 'transform 0.1s', fontWeight: '700' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              {hasData ? (isGreen ? '▲' : '▼') : '·'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BadgeCard({ badge, unlocked }) {
  return (
    <div style={{ padding: '12px 14px', background: unlocked ? 'rgba(0,255,136,0.05)' : 'rgba(136,153,187,0.03)', border: `1px solid ${unlocked ? 'rgba(0,255,136,0.20)' : 'rgba(136,153,187,0.08)'}`, borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'flex-start', opacity: unlocked ? 1 : 0.45, transition: 'all 0.2s' }}>
      <div style={{ fontSize: '22px', filter: unlocked ? 'none' : 'grayscale(1)', flexShrink: 0 }}>{badge.emoji}</div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: unlocked ? '#e8edf8' : '#5a6a82', marginBottom: '2px' }}>{badge.label}</div>
        <div style={{ fontSize: '11px', color: '#5a6a82', lineHeight: '1.4' }}>{badge.desc}</div>
        {unlocked && <div style={{ fontSize: '10px', color: '#00ff88', marginTop: '3px', letterSpacing: '1px' }}>✓ DÉBLOQUÉ</div>}
      </div>
    </div>
  );
}

export default function Goals() {
  const [trades,  setTrades]  = useState([]);
  const [account, setAccount] = useState(null);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Weekly goals (localStorage)
  const [goalPnl,      setGoalPnl]      = useState(() => localStorage.getItem('goal_weekly_pnl')      ?? '500');
  const [goalWR,       setGoalWR]       = useState(() => localStorage.getItem('goal_weekly_wr')       ?? '55');
  const [goalMaxTrades,setGoalMaxTrades]= useState(() => localStorage.getItem('goal_max_trades_day')  ?? '5');

  useEffect(() => { localStorage.setItem('goal_weekly_pnl',      goalPnl);      }, [goalPnl]);
  useEffect(() => { localStorage.setItem('goal_weekly_wr',       goalWR);       }, [goalWR]);
  useEffect(() => { localStorage.setItem('goal_max_trades_day',  goalMaxTrades);}, [goalMaxTrades]);

  useEffect(() => {
    (async () => {
      const [tRes, aRes, sRes] = await Promise.all([window.db.getAllTrades(), window.accounts.getActive(), window.db.getStats()]);
      if (tRes.ok) setTrades(tRes.data ?? []);
      if (aRes.ok) setAccount(aRes.data);
      if (sRes.ok) setStats(sRes.data);
      setLoading(false);
    })();
  }, []);

  const computed = useMemo(() => {
    if (!trades.length) return null;

    // Daily PnL map
    const dailyMap = {};
    for (const t of trades) {
      const d = (t.entered_at || t.date || '').slice(0, 10);
      if (!d) continue;
      const pnl = t.result_net ?? t.result ?? 0;
      dailyMap[d] = (dailyMap[d] ?? 0) + pnl;
    }

    // Current & max streak
    const sortedDays = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b));
    let curStreak = 0, maxStreak = 0, tempStreak = 0;
    let hasBounce = false, lossCount = 0;

    for (let i = 0; i < sortedDays.length; i++) {
      const [, pnl] = sortedDays[i];
      if (pnl > 0) {
        if (lossCount >= 3) hasBounce = true;
        lossCount = 0;
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        lossCount++;
        tempStreak = 0;
      }
    }
    // Current streak (from end)
    for (let i = sortedDays.length - 1; i >= 0; i--) {
      if (sortedDays[i][1] > 0) curStreak++;
      else break;
    }

    // This week
    const weekStart = getWeekStart(new Date());
    const weekTrades = trades.filter(t => {
      const d = (t.entered_at || t.date || '').slice(0, 10);
      return d >= weekStart;
    });
    const weekPnl  = weekTrades.reduce((s, t) => s + (t.result_net ?? t.result ?? 0), 0);
    const weekWins = weekTrades.filter(t => (t.result_net ?? t.result ?? 0) > 0).length;
    const weekWR   = weekTrades.length > 0 ? (weekWins / weekTrades.length) * 100 : 0;

    // Max trades in a day this week
    const weekDayMap = {};
    for (const t of weekTrades) {
      const d = (t.entered_at || t.date || '').slice(0, 10);
      weekDayMap[d] = (weekDayMap[d] ?? 0) + 1;
    }
    const maxDayTrades = Math.max(0, ...Object.values(weekDayMap));

    // PropFirm
    const rules = account ? (ACCOUNT_RULES[account.type] ?? {}) : {};
    const totalPnl = stats?.totalPnl ?? 0;

    // No daily breach in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const noDailyBreach = !rules.dailyLoss || !Object.entries(dailyMap).some(([d, p]) => d >= thirtyDaysAgo && p <= -rules.dailyLoss);

    // Badge context
    const pf = stats?.profitFactor ?? 0;
    const bagCtx = {
      total: stats?.total ?? 0,
      winrate: stats?.winrate ?? 0,
      pf,
      totalPnl,
      maxStreak,
      hasBounce,
      noDailyBreach,
    };

    return { dailyMap, curStreak, maxStreak, weekPnl, weekWR, weekTrades, maxDayTrades, rules, totalPnl, bagCtx, weekStart };
  }, [trades, account, stats]);

  if (loading) return <div style={{ padding: '40px', color: '#5a6a82', textAlign: 'center' }}>Chargement...</div>;

  const { dailyMap, curStreak, maxStreak, weekPnl, weekWR, weekTrades, maxDayTrades, rules, totalPnl, bagCtx } = computed ?? {};

  const weekCtx = { total: weekTrades?.length ?? 0, winrate: weekWR ?? 0 };
  const unlockedBadges = BADGES.filter(b => computed && b.check(bagCtx, weekCtx));

  return (
    <div style={{ padding: '24px', color: '#dde4ef', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '20px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '4px' }}>OBJECTIFS & GAMIFICATION</div>
        <div style={{ fontSize: '12px', color: '#5a6a82' }}>{account?.name ?? '—'} — Suivi des objectifs, streak et achievements</div>
      </div>

      {/* Streak banner */}
      <div style={{ marginBottom: '24px', padding: '20px 24px', background: curStreak >= 3 ? 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(0,255,136,0.08))' : 'rgba(14,15,22,0.8)', border: `1px solid ${curStreak >= 3 ? 'rgba(245,158,11,0.3)' : 'rgba(136,153,187,0.12)'}`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: curStreak >= 3 ? '0 0 30px rgba(245,158,11,0.08)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '40px', filter: curStreak >= 3 ? 'drop-shadow(0 0 8px #f59e0b)' : 'grayscale(0.5)' }}>
            {curStreak >= 7 ? '⚡' : curStreak >= 3 ? '🔥' : '🎯'}
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: curStreak >= 3 ? '#f59e0b' : '#5a6a82', lineHeight: 1 }}>
              {curStreak} jour{curStreak > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '12px', color: '#5a6a82', marginTop: '2px' }}>
              Streak verte actuelle · Record: {maxStreak} jours
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#5a6a82', marginBottom: '4px' }}>BADGES DÉBLOQUÉS</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#e8edf8' }}>{unlockedBadges.length} / {BADGES.length}</div>
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {unlockedBadges.slice(0, 6).map(b => <span key={b.id} style={{ fontSize: '16px' }}>{b.emoji}</span>)}
            {unlockedBadges.length > 6 && <span style={{ fontSize: '12px', color: '#5a6a82' }}>+{unlockedBadges.length - 6}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* LEFT: Weekly goals + PropFirm */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Weekly goal settings */}
          <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '16px' }}>
              OBJECTIFS DE LA SEMAINE
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <GoalInput label="PnL cible ($)" value={goalPnl}      onChange={setGoalPnl}      suffix="$" placeholder="500" />
              <GoalInput label="Winrate cible" value={goalWR}       onChange={setGoalWR}       suffix="%" placeholder="55" />
              <GoalInput label="Max trades/jour" value={goalMaxTrades} onChange={setGoalMaxTrades} suffix="" placeholder="5" />
            </div>

            <ProgressBar label={`PnL semaine (${weekTrades?.length ?? 0} trades)`} current={weekPnl ?? 0} target={parseFloat(goalPnl) || 0} suffix="$" />
            <ProgressBar label="Winrate semaine" current={weekWR ?? 0} target={parseFloat(goalWR) || 0} suffix="%" />
            {parseInt(goalMaxTrades) > 0 && (
              <ProgressBar label="Max trades/jour cette semaine" current={maxDayTrades ?? 0} target={parseInt(goalMaxTrades) || 5} suffix="" inverseColor />
            )}
          </div>

          {/* PropFirm progress */}
          {rules?.profitTarget && (
            <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>🏆</span>
                OBJECTIF PROPFIRM
              </div>
              <ProgressBar label={`Profit target — ${account?.typeInfo?.label ?? account?.type}`} current={Math.max(0, totalPnl ?? 0)} target={rules.profitTarget} suffix="$" />
              {rules.maxLoss && <ProgressBar label="Drawdown utilisé" current={Math.max(0, stats?.maxDrawdown ?? 0)} target={rules.maxLoss} suffix="$" inverseColor />}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#5a6a82' }}>Restant pour TP</div>
                  <div style={{ fontWeight: '700', color: '#00ff88' }}>{Math.max(0, rules.profitTarget - (totalPnl ?? 0)).toFixed(0)}$</div>
                </div>
                {rules.dailyLoss && (
                  <div>
                    <div style={{ color: '#5a6a82' }}>Daily loss limit</div>
                    <div style={{ fontWeight: '700', color: '#f59e0b' }}>{rules.dailyLoss}$/jour</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Streak calendar */}
          <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
            <StreakCalendar dailyMap={dailyMap ?? {}} />
          </div>
        </div>

        {/* RIGHT: Badges */}
        <div style={{ background: 'rgba(14,15,22,0.8)', border: '1px solid rgba(136,153,187,0.12)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#e8edf8', letterSpacing: '1px', marginBottom: '4px' }}>ACHIEVEMENTS</div>
          <div style={{ fontSize: '11px', color: '#5a6a82', marginBottom: '16px' }}>{unlockedBadges.length}/{BADGES.length} débloqués</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Unlocked first */}
            {BADGES.sort((a, b) => {
              const ua = computed ? a.check(bagCtx, weekCtx) : false;
              const ub = computed ? b.check(bagCtx, weekCtx) : false;
              return (ub ? 1 : 0) - (ua ? 1 : 0);
            }).map(badge => (
              <BadgeCard key={badge.id} badge={badge} unlocked={computed ? badge.check(bagCtx, weekCtx) : false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
