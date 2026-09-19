const crypto = require('crypto');
const db = require('../db/client');

const TITLE_MAX_LENGTH = 60;

function deriveTitle(text) {
  const trimmed = text.trim().replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '');
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return trimmed.slice(0, TITLE_MAX_LENGTH - 1) + '…';
}

async function listConversations(userId) {
  const result = await db.execute({
    sql: 'SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return result.rows;
}

async function getConversation(userId, conversationId) {
  const convResult = await db.execute({
    sql: 'SELECT id, title FROM conversations WHERE id = ? AND user_id = ?',
    args: [conversationId, userId],
  });
  const conversation = convResult.rows[0];
  if (!conversation) return null;

  const messagesResult = await db.execute({
    sql: 'SELECT id, role, content, tool_calls, generation_times, trace, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC',
    args: [conversationId],
  });

  return {
    id: conversation.id,
    title: conversation.title,
    messages: messagesResult.rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
      generationTimes: row.generation_times ? JSON.parse(row.generation_times) : null,
      trace: row.trace ? JSON.parse(row.trace) : null,
      createdAt: row.created_at,
    })),
  };
}

async function createConversation(userId, firstMessage) {
  const id = crypto.randomUUID();
  await db.execute({
    sql: 'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
    args: [id, userId, deriveTitle(firstMessage)],
  });
  return id;
}

async function touchConversation(conversationId) {
  await db.execute({
    sql: "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
    args: [conversationId],
  });
}

async function updateTitle(conversationId, title) {
  await db.execute({
    sql: 'UPDATE conversations SET title = ? WHERE id = ?',
    args: [deriveTitle(title), conversationId],
  });
}

async function getConversationHistory(conversationId) {
  const result = await db.execute({
    sql: 'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
    args: [conversationId],
  });
  return result.rows.map((row) => ({ role: row.role, content: row.content }));
}

async function saveMessage(conversationId, role, content, toolCalls, generationTimes, trace) {
  const id = crypto.randomUUID();
  await db.execute({
    sql: 'INSERT INTO messages (id, conversation_id, role, content, tool_calls, generation_times, trace) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, conversationId, role, content, toolCalls ? JSON.stringify(toolCalls) : null, generationTimes ? JSON.stringify(generationTimes) : null, trace ? JSON.stringify(trace) : null],
  });
  return id;
}

async function updateLastAssistantMessage(conversationId, content) {
  const result = await db.execute({
    sql: "SELECT id FROM messages WHERE conversation_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1",
    args: [conversationId],
  });
  const message = result.rows[0];
  if (!message) return;
  await db.execute({
    sql: 'UPDATE messages SET content = ? WHERE id = ?',
    args: [content, message.id],
  });
}

async function deleteConversation(userId, conversationId) {
  const result = await db.execute({
    sql: 'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
    args: [conversationId, userId],
  });
  if (!result.rows[0]) return false;

  await db.execute({ sql: 'DELETE FROM messages WHERE conversation_id = ?', args: [conversationId] });
  await db.execute({ sql: 'DELETE FROM conversations WHERE id = ?', args: [conversationId] });
  return true;
}

async function deleteAllConversations(userId) {
  const convs = await db.execute({
    sql: 'SELECT id FROM conversations WHERE user_id = ?',
    args: [userId],
  });
  for (const row of convs.rows) {
    await db.execute({ sql: 'DELETE FROM messages WHERE conversation_id = ?', args: [row.id] });
  }
  await db.execute({ sql: 'DELETE FROM conversations WHERE user_id = ?', args: [userId] });
  return true;
}

async function ownsConversation(userId, conversationId) {
  const result = await db.execute({
    sql: 'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
    args: [conversationId, userId],
  });
  return Boolean(result.rows[0]);
}

module.exports = {
  listConversations,
  getConversation,
  createConversation,
  touchConversation,
  updateTitle,
  getConversationHistory,
  saveMessage,
  updateLastAssistantMessage,
  deleteConversation,
  deleteAllConversations,
  ownsConversation,
};
