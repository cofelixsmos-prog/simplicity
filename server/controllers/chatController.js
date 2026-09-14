const { createChatCompletion } = require('../services/model');
const { TOOL_DEFINITIONS, runTool } = require('../services/tools');
const conversations = require('../services/conversationService');

const SYSTEM_PROMPT = 'You are Simplicity, a helpful, concise assistant. Keep answers short and direct unless asked for detail.';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_ROUNDS = 3;

function validateMessage(message) {
  if (typeof message !== 'string') return 'Message is required.';
  const trimmed = message.trim();
  if (!trimmed) return 'Message cannot be empty.';
  if (trimmed.length > MAX_MESSAGE_LENGTH) return `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`;
  return null;
}

async function sendMessage(req, res, next) {
  try {
    const { message, conversationId } = req.body || {};
    const validationError = validateMessage(message);
    if (validationError) return res.status(400).json({ error: validationError });

    const trimmedMessage = message.trim();
    let activeConversationId = conversationId;

    if (activeConversationId) {
      const owns = await conversations.ownsConversation(req.user.id, activeConversationId);
      if (!owns) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      activeConversationId = await conversations.createConversation(req.user.id, trimmedMessage);
    }

    const history = await conversations.getConversationHistory(activeConversationId);
    await conversations.saveMessage(activeConversationId, 'user', trimmedMessage, null);

    const modelMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: trimmedMessage },
    ];

    const toolCalls = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await createChatCompletion({ messages: modelMessages, tools: TOOL_DEFINITIONS });

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        await conversations.saveMessage(activeConversationId, 'assistant', reply.content, toolCalls.length ? toolCalls : null);
        await conversations.touchConversation(activeConversationId);
        return res.json({ reply: reply.content, toolCalls, conversationId: activeConversationId });
      }

      modelMessages.push({
        role: 'assistant',
        content: reply.content || null,
        tool_calls: reply.tool_calls,
      });

      for (const call of reply.tool_calls) {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const result = await runTool(call.function.name, args);
        toolCalls.push({ name: call.function.name, result });
        modelMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    res.status(502).json({ error: 'The assistant could not produce a response.' });
  } catch (error) {
    if (error.upstreamStatus === 429 || error.upstreamStatus === 503) {
      return res.status(503).json({ error: 'The assistant is busy right now. Please try again in a moment.' });
    }
    if (error.upstreamStatus >= 400 && error.upstreamStatus < 500) {
      return res.status(502).json({ error: 'The assistant could not process that message.' });
    }
    if (error.upstreamStatus >= 500) {
      return res.status(502).json({ error: 'The assistant is temporarily unavailable. Please try again shortly.' });
    }
    next(error);
  }
}

async function listConversations(req, res, next) {
  try {
    const rows = await conversations.listConversations(req.user.id);
    res.json({
      conversations: rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at })),
    });
  } catch (error) {
    next(error);
  }
}

async function getConversation(req, res, next) {
  try {
    const conversation = await conversations.getConversation(req.user.id, req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
}

async function deleteConversation(req, res, next) {
  try {
    const deleted = await conversations.deleteConversation(req.user.id, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Conversation not found.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { sendMessage, listConversations, getConversation, deleteConversation };
