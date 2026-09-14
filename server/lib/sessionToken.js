const crypto = require('crypto');

const SESSION_ID_BYTES = 32;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionId() {
  return crypto.randomBytes(SESSION_ID_BYTES).toString('hex');
}

function createExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

module.exports = { createSessionId, createExpiry, SESSION_TTL_MS };
