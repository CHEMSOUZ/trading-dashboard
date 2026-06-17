function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    error: 'INTERNAL_ERROR',
    message: err.message || 'Erreur serveur.',
  });
}

module.exports = errorHandler;
