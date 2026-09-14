const crypto = require('crypto');
const db = require('../db/client');
const { hashPassword, verifyPassword } = require('../lib/passwords');
const { createSessionId, createExpiry } = require('../lib/sessionToken');
const { SESSION_COOKIE } = require('../middleware/session');

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
const MIN_PASSWORD_LENGTH = 8;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function validateCredentials(username, password) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-24 characters: letters, numbers, and underscores only.';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

async function createSession(res, userId) {
  const sessionId = createSessionId();
  const expiresAt = createExpiry();

  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    args: [sessionId, userId, expiresAt],
  });

  res.cookie(SESSION_COOKIE, sessionId, {
    ...COOKIE_OPTIONS,
    expires: new Date(expiresAt),
  });
}

async function register(req, res, next) {
  try {
    const { username, password } = req.body || {};
    const validationError = validateCredentials(username, password);
    if (validationError) return res.status(400).json({ error: validationError });

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username],
    });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await db.execute({
      sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      args: [id, username, passwordHash],
    });

    await createSession(res, id);
    res.status(201).json({ username });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = await db.execute({
      sql: 'SELECT id, username, password_hash FROM users WHERE username = ?',
      args: [username],
    });
    const user = result.rows[0];

    const genericError = { error: 'Incorrect username or password.' };
    if (!user) return res.status(401).json(genericError);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json(genericError);

    await createSession(res, user.id);
    res.json({ username: user.username });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    if (req.sessionId) {
      await db.execute({
        sql: 'DELETE FROM sessions WHERE id = ?',
        args: [req.sessionId],
      });
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ username: req.user.username });
}

module.exports = { register, login, logout, me };
