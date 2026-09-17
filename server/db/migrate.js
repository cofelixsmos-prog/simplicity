const db = require('./client');

async function migrate() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL DEFAULT 'New chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try {
    await db.execute('ALTER TABLE messages ADD COLUMN generation_times TEXT');
  } catch (error) {
    // The column already exists on databases that have been migrated.
  }

  try {
    await db.execute('ALTER TABLE messages ADD COLUMN trace TEXT');
  } catch (error) {
    // The column already exists on databases that have been migrated.
  }

  await db.execute('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)');
}

module.exports = migrate;
