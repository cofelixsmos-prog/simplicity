const db = require('../db/client');

const SESSION_COOKIE = 'simplicity-session';

async function attachSession(req, res, next) {
  req.user = null;
  req.sessionId = null;

  const sessionId = req.cookies[SESSION_COOKIE];
  if (!sessionId) return next();

  try {
    const result = await db.execute({
      sql: `SELECT users.id, users.username, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.id = ?`,
      args: [sessionId],
    });

    const row = result.rows[0];
    if (!row || new Date(row.expires_at) < new Date()) {
      return next();
    }

    req.user = { id: row.id, username: row.username };
    req.sessionId = sessionId;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
  next();
}

module.exports = { attachSession, requireAuth, SESSION_COOKIE };
