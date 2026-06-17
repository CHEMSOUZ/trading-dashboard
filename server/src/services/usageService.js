const db = require('../db/connection');

// Limites mensuelles en tokens (input + output cumules) par plan d'abonnement.
// Volontairement en dur ici plutot que dans l'env : ce sont des regles produit,
// pas de la config d'infra. A ajuster quand les vrais plans de facturation existeront.
const PLAN_LIMITS = {
  basic: { tokensPerMonth: 100_000 },
  pro:   { tokensPerMonth: 1_000_000 },
};

function getPlanLimit(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.basic;
}

// Comparaison faite cote SQL (strftime) pour rester dans le meme format que
// `datetime('now')` utilise par defaut sur created_at -- evite tout decalage
// de format entre une date JS et une date SQLite.
function getMonthlyUsage(userId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(tokens_used), 0) AS total
    FROM usage_logs
    WHERE user_id = ?
      AND created_at >= strftime('%Y-%m-01 00:00:00', 'now')
  `).get(userId);
  return row.total;
}

function logUsage(userId, tokensUsed, endpoint) {
  db.prepare(`
    INSERT INTO usage_logs (user_id, tokens_used, endpoint)
    VALUES (?, ?, ?)
  `).run(userId, tokensUsed, endpoint);
}

function getNextResetDate() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().slice(0, 10);
}

module.exports = { PLAN_LIMITS, getPlanLimit, getMonthlyUsage, logUsage, getNextResetDate };
