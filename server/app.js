const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { attachSession } = require('./middleware/session');
const authRoutes = require('./routes/auth');

const ROOT_DIR = path.join(__dirname, '..');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use(cookieParser());
  app.use(attachSession);

  app.use('/api/auth', authRoutes);

  app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = createApp;
