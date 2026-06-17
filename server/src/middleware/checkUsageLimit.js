const { getPlanLimit, getMonthlyUsage, getNextResetDate } = require('../services/usageService');

// A executer apres requireAuth + requireActiveSubscription, avant tout appel
// a l'API Anthropic : bloque la requete si le quota mensuel est deja consomme,
// au lieu de se contenter de logguer l'usage apres coup.
function checkUsageLimit(req, res, next) {
  const { id, subscription_plan } = req.user;
  const limit = getPlanLimit(subscription_plan);
  const used = getMonthlyUsage(id);

  if (used >= limit.tokensPerMonth) {
    const resetDate = getNextResetDate();
    return res.status(429).json({
      error: 'QUOTA_EXCEEDED',
      message: `Quota mensuel de ${limit.tokensPerMonth} tokens atteint pour le plan "${subscription_plan}". Reinitialisation le ${resetDate}.`,
      used,
      limit: limit.tokensPerMonth,
      resetDate,
    });
  }

  next();
}

module.exports = checkUsageLimit;
