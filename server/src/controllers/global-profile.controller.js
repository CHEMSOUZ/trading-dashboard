const anthropicService = require('../services/anthropicService');
const usageService = require('../services/usageService');
const globalProfileService = require('../services/globalProfileService');

const SYSTEM_PROMPT = `Tu es un analyste de performance trading. Tu reçois des statistiques agrégées réelles d'un trader. Génère une synthèse structurée en JSON avec exactement ces clés :
- identity : string, 2-3 phrases, identité de trading synthétique, ton direct, chiffres inclus
- strengths : array de 3 strings, points forts identifiés par les données, chiffrés
- weaknesses : array de 3 strings, points faibles structurels, chiffrés
- priority : string, 2-3 phrases, la recommandation la plus impactante, ton direct
Réponds uniquement en JSON valide, sans markdown, sans preambule.`;

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function buildPrompt(stats) {
  const fmtHours = (stats.wrByHour || []).map(h => `${h.hour}h: ${h.wr}% (${h.count} trades)`).join(', ');
  const fmtMonths = (stats.wrByMonth || []).map(m => `${m.month}: ${m.wr}% (${m.count} trades)`).join(', ');
  return `Voici les statistiques agrégées réelles d'un trader :

- Nombre total de trades : ${stats.totalTrades}
- Winrate global : ${stats.wrGlobal}%
- Winrate par tranche horaire (UTC) : ${fmtHours || 'données insuffisantes'}
- Winrate par mois depuis le premier trade : ${fmtMonths || 'données insuffisantes'}
- Moyenne de trades pris dans les 2h suivant un trade perdant (proxy revenge trading) : ${stats.revengeTradingAvg}
- RR moyen global : ${stats.avgRR}
- Meilleur jour de la semaine : ${stats.bestDay?.day ?? 'N/A'} (${stats.bestDay?.wr ?? 0}% WR)
- Pire jour de la semaine : ${stats.worstDay?.day ?? 'N/A'} (${stats.worstDay?.wr ?? 0}% WR)`;
}

function parseProfileJson(text) {
  let parsed;
  try {
    const cleaned = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    parsed = JSON.parse(cleaned);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Réponse IA non parsable.');
    parsed = JSON.parse(m[0]);
  }
  const { identity, strengths, weaknesses, priority } = parsed;
  if (typeof identity !== 'string' || typeof priority !== 'string' ||
      !Array.isArray(strengths) || !Array.isArray(weaknesses)) {
    throw new Error('Réponse IA mal formée.');
  }
  return { identity, strengths, weaknesses, priority };
}

async function generate(req, res, next) {
  try {
    const { stats, force } = req.body || {};
    if (!stats || typeof stats !== 'object') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Le champ "stats" est requis.' });
    }

    const monthKey = currentMonthKey();
    const existing = globalProfileService.getByMonth(req.user.id, monthKey);

    if (existing && !force) {
      return res.json({ profile: globalProfileService.toClientShape(existing) });
    }
    if (existing && force) {
      globalProfileService.deleteByMonth(req.user.id, monthKey);
    }

    const prompt = buildPrompt(stats);
    const { text, usage } = await anthropicService.chat([{ role: 'user', content: prompt }], SYSTEM_PROMPT, 1024);
    const totalTokens = usage.inputTokens + usage.outputTokens;
    usageService.logUsage(req.user.id, totalTokens, '/api/global-profile/generate');

    const parsed = parseProfileJson(text);
    const row = globalProfileService.insert(req.user.id, monthKey, {
      tradeCount: Number(stats.totalTrades) || 0,
      identity: parsed.identity,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      priority: parsed.priority,
      wrEvolution: Array.isArray(stats.wrByMonth) ? stats.wrByMonth : [],
    });

    res.json({ profile: globalProfileService.toClientShape(row) });
  } catch (e) {
    next(e);
  }
}

async function latest(req, res, next) {
  try {
    const row = globalProfileService.getLatest(req.user.id);
    res.json({ profile: globalProfileService.toClientShape(row) });
  } catch (e) {
    next(e);
  }
}

module.exports = { generate, latest };
