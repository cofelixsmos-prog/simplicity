require('dotenv').config();

const createApp = require('./app');
const migrate = require('./db/migrate');
const { startSessionCleanup } = require('./db/sessionCleanup');

const PORT = process.env.PORT || 3000;

async function start() {
  await migrate();
  startSessionCleanup();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Simplicity server listening on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
