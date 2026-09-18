const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { securityHeaders, enforceHttps } = require('./middleware/security');
const { attachSession } = require('./middleware/session');
const pageGuard = require('./middleware/pageGuard');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const modelCacheRoutes = require('./routes/modelCache');

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
  app.use('/api/chat', chatRoutes);
  app.use('/api/model-cache', modelCacheRoutes);

  app.use(pageGuard);

  // Deep links to a specific conversation (/chat/<id>) serve the same
  // chat.html shell; the client reads the id from the URL and loads that
  // conversation. Must come before express.static since there's no file
  // at that literal path.
  app.get('/chat/:id', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'chat.html'));
  });

  // Self-hosted WebLLM runtime for Simplicity Local — served from
  // node_modules rather than a CDN so in-browser inference has no external
  // runtime dependency. Only ever fetched when a user actually opens the
  // model catalog or sends a message in Local mode (lazy dynamic import on
  // the client), so this costs nothing for Cloud-only users.
  app.use('/vendor/web-llm', express.static(path.join(ROOT_DIR, 'node_modules', '@mlc-ai', 'web-llm', 'lib')));

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
