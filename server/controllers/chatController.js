const { createChatCompletion } = require('../services/model');
const { TOOL_DEFINITIONS, runTool } = require('../services/tools');

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
    const { message } = req.body || {};
    const validationError = validateMessage(message);
    if (validationError) return res.status(400).json({ error: validationError });

    const conversation = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message.trim() },
    ];

    const toolCalls = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const reply = await createChatCompletion({ messages: conversation, tools: TOOL_DEFINITIONS });

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        return res.json({ reply: reply.content, toolCalls });
      }

      conversation.push({
        role: 'assistant',
        content: reply.content || null,
        tool_calls: reply.tool_calls,
      });

      for (const call of reply.tool_calls) {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const result = await runTool(call.function.name, args);
        toolCalls.push({ name: call.function.name, result });
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    res.status(502).json({ error: 'The assistant could not produce a response.' });
  } catch (error) {
    if (error.upstreamStatus === 429) {
      return res.status(503).json({ error: 'The assistant is busy right now. Please try again in a moment.' });
    }
    if (error.upstreamStatus >= 400 && error.upstreamStatus < 500) {
      return res.status(502).json({ error: 'The assistant could not process that message.' });
    }
    next(error);
  }
}

module.exports = { sendMessage };
