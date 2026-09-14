const { createChatCompletion } = require('../services/model');
const { TOOL_DEFINITIONS, runTool } = require('../services/tools');
const conversations = require('../services/conversationService');

const SYSTEM_PROMPT = 'You are Simplicity, a helpful, concise assistant. Keep answers short and direct unless asked for detail.';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_ROUNDS = 3;

const TITLE_SYSTEM_PROMPT = 'Summarize the following exchange as a short chat title: 3-6 words, no quotes, no trailing punctuation, no prefix like "Title:". Reply with only the title.';

function validateMessage(message) {
  if (typeof message !== 'string') return 'Message is required.';
  const trimmed = message.trim();
  if (!trimmed) return 'Message cannot be empty.';
  if (trimmed.length > MAX_MESSAGE_LENGTH) return `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`;
  return null;
}

async function generateTitle(userMessage, assistantReply) {
  try {
    const reply = await createChatCompletion({
      messages: [
        { role: 'system', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: `User: ${userMessage}\nAssistant: ${assistantReply}` },
      ],
      // Some models (e.g. ling-3.0-flash-fin-free) emit an internal
      // "reasoning" pass before the final content — a small token budget
      // gets exhausted there and content ends up empty. 200 gives enough
      // headroom for that plus a short title.
      maxTokens: 200,
    });
    return reply.content ? reply.content.trim() : null;
  } catch (error) {
    console.error('Title generation failed:', error.message);
    return null;
  }
}

async function sendMessage(req, res, next) {
  const { message, conversationId } = req.body || {};
  const validationError = validateMessage(message);
  if (validationError) return res.status(400).json({ error: validationError });

  const trimmedMessage = message.trim();
  let activeConversationId = conversationId;
  const isNewConversation = !conversationId;

  function sendEvent(event) {
    if (!res.writableEnded) res.write(JSON.stringify(event) + '\n');
  }

  async function finishTurn(replyText, toolCalls) {
    await conversations.saveMessage(activeConversationId, 'assistant', replyText, toolCalls.length ? toolCalls : null);
    await conversations.touchConversation(activeConversationId);

    sendEvent({
      type: 'reply',
      reply: replyText,
      toolCalls,
      conversationId: activeConversationId,
    });

    // Best-effort: the reply itself is already saved by this point, so a
    // title-generation or title-write failure must never turn into an error
    // response for a turn that actually succeeded.
    let title;
    if (isNewConversation) {
      try {
        title = await generateTitle(trimmedMessage, replyText);
        if (title) await conversations.updateTitle(activeConversationId, title);
      } catch (titleError) {
        console.error('Failed to save generated title:', titleError);
        title = null;
      }
    }

    sendEvent({ type: 'done', conversationId: activeConversationId, title: title || undefined });
    return res.end();
  }

  try {
    if (activeConversationId) {
      const owns = await conversations.ownsConversation(req.user.id, activeConversationId);
      if (!owns) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      activeConversationId = await conversations.createConversation(req.user.id, trimmedMessage);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const history = await conversations.getConversationHistory(activeConversationId);
    await conversations.saveMessage(activeConversationId, 'user', trimmedMessage, null);

    const modelMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: trimmedMessage },
    ];

    const toolCalls = [];
    const seenCalls = new Set();
    let forceFinalAnswer = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      sendEvent({ type: 'thinking', phase: round + 1, label: 'Simplifying' });
      const reply = await createChatCompletion({
        messages: modelMessages,
        tools: forceFinalAnswer ? undefined : TOOL_DEFINITIONS,
      });

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        const replyText = reply.content || "I don't have a response for that.";
        return await finishTurn(replyText, toolCalls);
      }

      modelMessages.push({
        role: 'assistant',
        content: reply.content || null,
        tool_calls: reply.tool_calls,
      });

      let sawRepeat = false;
      for (const [index, call] of reply.tool_calls.entries()) {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const callKey = call.function.name + ':' + JSON.stringify(args);
        if (seenCalls.has(callKey)) sawRepeat = true;
        seenCalls.add(callKey);

        sendEvent({ type: 'tool_start', index, name: call.function.name, args, round: round + 1 });
        const toolStartedAt = Date.now();
        const result = await runTool(call.function.name, args);
        const toolCall = {
          name: call.function.name,
          args,
          result,
          durationMs: Date.now() - toolStartedAt,
        };
        toolCalls.push(toolCall);
        sendEvent({ type: 'tool_done', index, round: round + 1, ...toolCall });
        modelMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      if (sawRepeat) {
        forceFinalAnswer = true;
        modelMessages.push({
          role: 'system',
          content: "You already have the result of that tool call above. Answer the user's question now using it.",
        });
      }
    }

    const finalReply = await createChatCompletion({ messages: modelMessages, tools: undefined });
    const fallbackReply = finalReply.content || "I wasn't able to finish that — could you try asking again?";
    return await finishTurn(fallbackReply, toolCalls);
  } catch (error) {
    let statusCode = 500;
    let errorMessage = 'Something went wrong.';

    if (error.upstreamStatus === 429 || error.upstreamStatus === 503) {
      statusCode = 503;
      errorMessage = 'The assistant is busy right now. Please try again in a moment.';
    } else if (error.upstreamStatus >= 400 && error.upstreamStatus < 500) {
      statusCode = 502;
      errorMessage = 'The assistant could not process that message.';
    } else if (error.upstreamStatus >= 500) {
      statusCode = 502;
      errorMessage = 'The assistant is temporarily unavailable. Please try again shortly.';
    } else {
      console.error(error);
    }

    // The user's message may already be saved by this point (it's saved before
    // the model call). Leaving it with no reply makes the conversation look
    // like it silently lost data on reload, so always pair it with something,
    // even on failure. This save is best-effort: a DB hiccup here must not
    // mask the original error.
    if (activeConversationId) {
      try {
        await conversations.saveMessage(activeConversationId, 'assistant', errorMessage, null);
        await conversations.touchConversation(activeConversationId);
      } catch (saveError) {
        console.error('Failed to save error reply:', saveError);
      }
    }

    if (res.headersSent) {
      sendEvent({ type: 'error', error: errorMessage, conversationId: activeConversationId || null });
      return res.end();
    }
    return res.status(statusCode).json({ error: errorMessage, conversationId: activeConversationId || null });
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
