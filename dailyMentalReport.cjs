// Génération de l'analyse psychologique quotidienne automatique — réutilisée par le
// scheduler 23h00 (electron.cjs) et par le bouton manuel du calendrier Profil Trader (IPC).
// callAnthropicApi est injecté par l'appelant (electron.cjs) pour éviter une dépendance
// circulaire (electron.cjs require ce module, et callAnthropicApi dépend de l'état Electron).
const dbModule   = require('./database.cjs');
const accountsMod = require('./accounts.cjs');

const TRAIT_VALUES = ['Vengeur', 'Discipliné', 'Fragile', 'Serein', 'Stressé', 'Focalisé', 'Impulsif'];
const FALLBACK_TRAIT = 'Stressé';

const SYSTEM_PROMPT = `Tu es un analyste en psychologie du trading. Tu reçois les données de trading d'une journée et tu dois déterminer l'état mental du trader et générer une analyse structurée. Réponds UNIQUEMENT en JSON valide sans markdown ni backticks avec exactement ces clés :
- trait : un seul mot parmi exactement : Vengeur | Discipliné | Fragile | Serein | Stressé | Focalisé | Impulsif
- emotion_text : string, 3-4 phrases, analyse de l'état émotionnel de la journée avec les données chiffrées, ton direct
- patterns_text : string, 2-3 phrases, patterns comportementaux identifiés (revenge trading, FOMO, discipline, etc.), chiffres inclus
- focus_text : string, 1-2 phrases, recommandation concrète et non négociable pour la prochaine session

Critères de classification du trait :
- Vengeur : pertes consécutives + augmentation du nombre de trades ou changement d'instrument en cours de session
- Discipliné : respect du plan, pas de surtrading, ratio trades/gains cohérent
- Fragile : pertes importantes mais trades arrêtés, vulnérabilité visible sans escalade
- Serein : session positive ou neutre, exécution calme
- Stressé : trades erratiques, horaires inhabituels, P&L très volatil
- Focalisé : peu de trades, haute sélectivité, bon RR
- Impulsif : entrées rapides, sorties prématurées, pas de plan visible`;

function pnlOf(t) { return t.result_net ?? t.result ?? 0; }
function round2(n) { return Math.round(n * 100) / 100; }

// Agrège les trades de TOUS les comptes pour une date donnée — même logique que
// tradeStats côté renderer (TraderProfile.jsx) : exclut les micro-trades (<10$, hors BE)
// pour rester cohérent avec les chiffres déjà affichés sur les cases du calendrier.
async function getDayTradesAllAccounts(date) {
  const { accounts: accs } = accountsMod.getAllAccounts();
  let all = [];
  for (const acc of accs) {
    try {
      const db = await dbModule.getDb(acc.dbPath);
      all = all.concat(dbModule.getAllTrades(db));
    } catch (_) {}
  }
  return all.filter(t => {
    if ((t.date ?? '') !== date) return false;
    const net = pnlOf(t);
    if (net !== 0 && Math.abs(net) < 10) return false;
    return true;
  });
}

function computeDayMetrics(trades) {
  const sorted = [...trades].sort((a, b) =>
    (a.entered_at ?? a.date ?? '').localeCompare(b.entered_at ?? b.date ?? ''));
  const count = sorted.length;
  const wins  = sorted.filter(t => pnlOf(t) > 0).length;
  const win_rate = count > 0 ? Math.round((wins / count) * 1000) / 10 : 0;
  const pnl_net  = round2(sorted.reduce((s, t) => s + pnlOf(t), 0));

  let maxLossStreak = 0, cur = 0;
  for (const t of sorted) {
    if (pnlOf(t) < 0) { cur++; maxLossStreak = Math.max(maxLossStreak, cur); }
    else cur = 0;
  }
  const instruments = [...new Set(sorted.map(t => t.pair).filter(Boolean))];
  const entryHours = sorted
    .map(t => (t.entered_at ? new Date(t.entered_at).getUTCHours() : null))
    .filter(h => h != null);

  return { trades_count: count, win_rate, pnl_net, maxLossStreak, instruments, entryHours, sorted };
}

function buildPrompt(date, trades, metrics) {
  const seq = metrics.sorted.map(t => {
    const p = pnlOf(t);
    return `${t.pair} ${t.direction} ${p >= 0 ? '+' : ''}${p.toFixed(2)}$`;
  }).join(' → ');

  return `Analyse la journée de trading du ${date}.

DONNÉES:
- Total trades: ${metrics.trades_count}
- PnL net: ${metrics.pnl_net >= 0 ? '+' : ''}${metrics.pnl_net.toFixed(2)}$
- Winrate: ${metrics.win_rate}%
- Plus longue série de pertes consécutives: ${metrics.maxLossStreak}
- Instruments tradés: ${metrics.instruments.join(', ') || '—'}
- Horaires d'entrée (UTC): ${metrics.entryHours.join('h, ') || '—'}h
- Séquence chronologique: ${seq || '—'}`;
}

function parseDailyMentalJson(text) {
  let parsed;
  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    parsed = JSON.parse(cleaned);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Réponse IA non parsable.');
    parsed = JSON.parse(m[0]);
  }
  const trait = TRAIT_VALUES.includes(parsed.trait) ? parsed.trait : FALLBACK_TRAIT;
  return {
    trait,
    emotion_text:  typeof parsed.emotion_text  === 'string' ? parsed.emotion_text  : '',
    patterns_text: typeof parsed.patterns_text === 'string' ? parsed.patterns_text : '',
    focus_text:    typeof parsed.focus_text    === 'string' ? parsed.focus_text    : '',
  };
}

// generateDailyMentalReport — pipeline complet, réutilisable depuis le scheduler ET
// le bouton manuel. Retourne :
//   - la ligne sauvegardée (existante ou nouvellement générée)
//   - null si aucun trade ce jour-là (pas d'erreur, juste rien à analyser)
async function generateDailyMentalReport(globalDb, globalDbPath, userId, date, { force = false, callAnthropicApi } = {}) {
  const existing = dbModule.getDailyMentalReportForDate(globalDb, userId, date);
  if (existing && !force) return existing;

  const dayTrades = await getDayTradesAllAccounts(date);
  if (dayTrades.length === 0) return null;

  const metrics = computeDayMetrics(dayTrades);
  const raw = await callAnthropicApi(
    [{ role: 'user', content: buildPrompt(date, dayTrades, metrics) }],
    SYSTEM_PROMPT
  );
  const parsed = parseDailyMentalJson(raw);

  return dbModule.saveDailyMentalReport(globalDb, globalDbPath, userId, date, {
    trait: parsed.trait,
    emotion_text: parsed.emotion_text,
    patterns_text: parsed.patterns_text,
    focus_text: parsed.focus_text,
    trades_count: metrics.trades_count,
    win_rate: metrics.win_rate,
    pnl_net: metrics.pnl_net,
  });
}

module.exports = { generateDailyMentalReport, TRAIT_VALUES };
