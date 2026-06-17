const { getUserById } = require('../services/userService');

// A executer apres requireAuth. Recharge l'utilisateur depuis la base (le JWT
// ne contient pas le statut d'abonnement, qui peut changer entre deux requetes)
// et enrichit req.user avec subscription_plan/status pour les middlewares suivants.
function requireActiveSubscription(req, res, next) {
  const user = getUserById(req.user.id);

  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Utilisateur introuvable.' });
  }

  if (user.subscription_status !== 'active') {
    return res.status(403).json({
      error: 'SUBSCRIPTION_INACTIVE',
      message: 'Un abonnement actif est requis pour utiliser l\'assistant IA.',
    });
  }

  req.user = {
    id: user.id,
    email: user.email,
    subscription_plan: user.subscription_plan,
    subscription_status: user.subscription_status,
  };
  next();
}

module.exports = requireActiveSubscription;
