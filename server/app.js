const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { securityHeaders, enforceHttps } = require('./middleware/security');
const { attachSession } = require('./middleware/session');
const pageGuard = require('./middleware/pageGuard');
const authRoutes = require('./routes/auth');

const ROOT_DIR = path.join(__dirname, '..');

function createApp() {
  const app = express();

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(enforceHttps);
  app.use(securityHeaders);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(attachSession);

  app.use('/api/auth', authRoutes);

  app.use(pageGuard);
  app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

  app.use((err, req, res, next) => {
    console.error(err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request payload is too large.' });
    }
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: 'Invalid request.' });
    }
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = createApp;
