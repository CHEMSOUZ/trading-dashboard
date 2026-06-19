const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const env = require('./config/env');
const migrate = require('./db/migrate');
const authRoutes = require('./routes/auth.routes');
const aiRoutes = require('./routes/ai.routes');
const globalProfileRoutes = require('./routes/global-profile.routes');
const errorHandler = require('./middleware/errorHandler');

migrate();

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/global-profile', globalProfileRoutes);

app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND', message: 'Route inconnue.' }));
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
