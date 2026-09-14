const db = require('./client');

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

async function sweepExpiredSessions() {
  await db.execute("DELETE FROM sessions WHERE expires_at < datetime('now')");
}

function startSessionCleanup() {
  sweepExpiredSessions().catch((error) => console.error('Session cleanup failed:', error));
  const timer = setInterval(() => {
    sweepExpiredSessions().catch((error) => console.error('Session cleanup failed:', error));
  }, SWEEP_INTERVAL_MS);
  timer.unref();
}

module.exports = { startSessionCleanup, sweepExpiredSessions };
