const { createChatCompletion } = require('../services/model');
const { TOOL_DEFINITIONS, runTool, isTerminalTool } = require('../services/tools');
const conversations = require('../services/conversationService');

const SYSTEM_PROMPT = 'You are Simplicity, a helpful, concise assistant. Keep answers short and direct unless asked for detail. ' +
  'When you need information only the user can provide before you can proceed (missing details, a choice between options, clarification), call the ask_question tool instead of listing questions as plain text. ' +
  'If you have more than one thing to ask, put every question in a single ask_question call as separate entries in the questions array — never ask one, wait, then call the tool again for the next one. ' +
  'You can format replies with standard markdown: bold, italic, `code`, fenced code blocks, links, lists, tables.';

const HIGHLIGHT_SYSTEM_PROMPT = 'You will be given a chat reply written in markdown. Your only job is to re-emit it with the single most important line, sentence, or short passage wrapped in ==double equals== — do not change, add, remove, rephrase, or reformat anything else, not even punctuation or whitespace. ' +
  'Pick the one part the user most needs to walk away with: the main takeaway, the correct answer, or the most important warning/caveat — whichever matters most in this specific reply. Wrap ONLY that one passage (a sentence or two, never a whole paragraph, never the entire reply). If the reply is short/simple with nothing that stands out as clearly most important (e.g. a greeting, a one-line factual answer), return it completely unchanged. ' +
  'Reply with ONLY the full modified text, no preamble, no explanation, no code fences around it.';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_ROUNDS = 3;

const TITLE_SYSTEM_PROMPT = 'Summarize the following exchange as a short chat title: 3-6 words, no quotes, no trailing punctuation, no prefix like "Title:". Reply with only the title.';

const SUGGESTIONS_SYSTEM_PROMPT = 'Based on this exchange, suggest up to 3 short, specific follow-up questions the user might want to ask next. Each must be under 8 words and phrased as something the user would say — never a question, explanation, apology, or comment addressed to the user. Reply with ONLY the questions, one per line, no numbering, no bullets, no quotes, nothing else. If there is truly nothing sensible to suggest (e.g. the exchange is just a greeting), reply with nothing at all — not even a sentence explaining why.';
const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_WORDS = 10;
const MAX_SUGGESTION_CHARS = 80;
// A real follow-up reads as something the user would type: a question, or a
// request starting with one of these. Meta-commentary like "No follow-up
// questions are warranted here" fails this — it's a statement ABOUT
// suggestions, not one, and slips past length checks since it's short.
const SUGGESTION_LEAD_WORDS = /^(what|how|why|when|where|who|which|whose|can|could|would|should|will|shall|is|are|do|does|did|tell|show|explain|give|list|help|walk|compare|describe|suggest|recommend|find|make|create|write|summarize|translate|calculate)\b/i;

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

async function highlightReply(replyText) {
  try {
    if (!replyText || replyText.length < 40) return null;
    const reply = await createChatCompletion({
      messages: [
        { role: 'system', content: HIGHLIGHT_SYSTEM_PROMPT },
        { role: 'user', content: replyText },
      ],
      // This model's internal reasoning pass alone has been observed to run
      // to ~10,000 characters (~3000+ tokens) for a single moderate-length
      // reply — far more than the reply itself — and that reasoning is
      // billed against maxTokens before any content is emitted. Title/
      // suggestion generation get away with a small budget because they
      // only need a short output; this pass echoes the whole reply back
      // (often 500-1500+ chars), so it needs enough room for both the
      // reasoning AND the full echo, or content silently comes back empty.
      maxTokens: 8000,
    });
    if (!reply.content) { console.log('[highlight] rejected: empty content from model'); return null; }
    const highlighted = reply.content.trim();
    // Sanity check: this call must only ADD == markers, never rewrite the
    // reply. If stripping the markers doesn't reproduce the original text
    // (near enough), the model deviated from the instruction, so discard
    // the result rather than risk showing altered content to the user.
    const stripped = highlighted.replace(/==([\s\S]+?)==/g, '$1');
    // This model can't reliably echo long text back byte-for-byte — it
    // tends to drop a stray punctuation mark, or occasionally add/reword a
    // clause, even when told not to. An exact-match check rejects almost
    // every attempt, so this compares word-set OVERLAP instead: if most of
    // the original's words are still present and few new ones were
    // introduced, treat it as "annotated," not "rewritten." A wholesale
    // rewrite or fabricated addition drops the overlap ratio enough to
    // still get caught.
    const wordsOf = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const originalWords = wordsOf(replyText);
    const strippedWords = wordsOf(stripped);
    // Word-COUNT closeness catches duplication (the model repeating the
    // highlighted sentence as an extra block instead of marking it in
    // place) and fabrication — both inflate the word count. Kept tight
    // since a correct "wrap only" pass changes length by ~0.
    // Sequence match against the ORIGINAL length (not the shorter of the
    // two) — this catches both truncation (dropped an ending) and the more
    // common failure mode with this model, appending extra sentences after
    // the real content (which a shared-prefix-only check would miss, since
    // everything up to the original's length still lines up).
    let inOrder = 0;
    for (let i = 0; i < originalWords.length; i++) {
      if (originalWords[i] === strippedWords[i]) inOrder++;
    }
    const sequenceMatch = originalWords.length ? inOrder / originalWords.length : 0;
    const lengthRatio = originalWords.length ? strippedWords.length / originalWords.length : 1;
    if (sequenceMatch < 0.95) { console.log('[highlight] rejected: sequenceMatch', sequenceMatch.toFixed(3)); return null; }
    if (lengthRatio > 1.1 || lengthRatio < 0.95) { console.log('[highlight] rejected: lengthRatio', lengthRatio.toFixed(3)); return null; }
    if (stripped === highlighted) { console.log('[highlight] rejected: no markers added'); return null; }
    console.log('[highlight] accepted');
    return highlighted;
  } catch (error) {
    console.error('Highlight pass failed:', error.message);
    return null;
  }
}

async function generateSuggestions(userMessage, assistantReply) {
  try {
    const reply = await createChatCompletion({
      messages: [
        { role: 'system', content: SUGGESTIONS_SYSTEM_PROMPT },
        { role: 'user', content: `User: ${userMessage}\nAssistant: ${assistantReply}` },
      ],
      // Same reasoning-budget concern as generateTitle above — this model's
      // reasoning-token usage varies per call, so leave extra headroom.
      maxTokens: 500,
    });
    if (!reply.content) return [];
    return reply.content
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean)
      // A real follow-up is a short conversational phrase. Filter out:
      // - anything longer than that (the model explaining itself instead of
      //   following the "reply with nothing" instruction), and
      // - LaTeX/code/notation artifacts (e.g. "\boxed{}") that have
      //   occasionally leaked out of this model's reasoning — no genuine
      //   follow-up question contains backslashes, braces, or math delimiters.
      .filter((line) => {
        if (line.length > MAX_SUGGESTION_CHARS) return false;
        if (line.split(/\s+/).length > MAX_SUGGESTION_WORDS) return false;
        if (/[\\{}$<>]/.test(line)) return false;
        const letters = line.replace(/[^a-zA-Z]/g, '').length;
        if (letters < 3 || letters / line.length <= 0.5) return false;
        return line.endsWith('?') || SUGGESTION_LEAD_WORDS.test(line);
      })
      .slice(0, MAX_SUGGESTIONS);
  } catch (error) {
    console.error('Suggestion generation failed:', error.message);
    return [];
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

    // Same best-effort contract as the title: never let a suggestions
    // failure affect a turn whose reply already succeeded and was saved.
    let suggestions = [];
    try {
      suggestions = await generateSuggestions(trimmedMessage, replyText);
    } catch (suggestionError) {
      console.error('Failed to generate suggestions:', suggestionError);
    }

    // Best-effort second pass that adds ==yellow==/++green++ highlight
    // markers to the reply already shown to the user. Runs after the
    // typewriter would have finished, so the client swaps it in once ready
    // rather than delaying the initial reply for this.
    const highlighted = await highlightReply(replyText);
    if (highlighted) {
      await conversations.updateLastAssistantMessage(activeConversationId, highlighted);
      sendEvent({
        type: 'highlight',
        reply: highlighted,
        conversationId: activeConversationId,
      });
    }

    sendEvent({
      type: 'done',
      conversationId: activeConversationId,
      title: title || undefined,
      suggestions: suggestions.length ? suggestions : undefined,
    });
    return res.end();
  }

  async function finishWithQuestion(questionCall, toolCalls) {
    const questions = questionCall.result.questions;
    const summary = questions.map((q) => '- ' + q.question).join('\n');
    const replyText = 'I need a bit more information before I continue:\n' + summary;

    await conversations.saveMessage(activeConversationId, 'assistant', replyText, toolCalls);
    await conversations.touchConversation(activeConversationId);

    sendEvent({
      type: 'question',
      questions,
      toolCalls,
      conversationId: activeConversationId,
    });
    sendEvent({ type: 'done', conversationId: activeConversationId });
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

        if (isTerminalTool(call.function.name)) {
          return await finishWithQuestion(toolCall, toolCalls);
        }

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

// Simplicity Local support: the actual reply is generated client-side by
// WebLLM (in-browser inference), but persistence — conversations, messages,
// sidebar history, titles, suggestions — stays entirely server-side and
// identical to Cloud mode, per the user's explicit requirement ("everything
// remains the same, just the model changes"). These two endpoints split
// sendMessage's responsibilities so the client can drive inference itself
// while still reusing every bit of existing save/best-effort logic.

async function startLocalMessage(req, res, next) {
  const { message, conversationId } = req.body || {};
  const validationError = validateMessage(message);
  if (validationError) return res.status(400).json({ error: validationError });

  const trimmedMessage = message.trim();
  let activeConversationId = conversationId;
  const isNewConversation = !conversationId;

  try {
    if (activeConversationId) {
      const owns = await conversations.ownsConversation(req.user.id, activeConversationId);
      if (!owns) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      activeConversationId = await conversations.createConversation(req.user.id, trimmedMessage);
    }

    const history = await conversations.getConversationHistory(activeConversationId);
    await conversations.saveMessage(activeConversationId, 'user', trimmedMessage, null);

    res.json({
      conversationId: activeConversationId,
      isNewConversation,
      history,
      systemPrompt: SYSTEM_PROMPT,
    });
  } catch (error) {
    next(error);
  }
}

async function finishLocalMessage(req, res, next) {
  const { conversationId, message, reply, toolCalls, isNewConversation } = req.body || {};
  if (!conversationId || typeof reply !== 'string' || !reply.trim()) {
    return res.status(400).json({ error: 'conversationId and reply are required.' });
  }

  try {
    const owns = await conversations.ownsConversation(req.user.id, conversationId);
    if (!owns) return res.status(404).json({ error: 'Conversation not found.' });

    const replyText = reply.trim();
    const cleanToolCalls = Array.isArray(toolCalls) && toolCalls.length ? toolCalls : null;
    await conversations.saveMessage(conversationId, 'assistant', replyText, cleanToolCalls);
    await conversations.touchConversation(conversationId);

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    let title;
    if (isNewConversation) {
      try {
        title = await generateTitle(trimmedMessage, replyText);
        if (title) await conversations.updateTitle(conversationId, title);
      } catch (titleError) {
        console.error('Failed to save generated title:', titleError);
        title = null;
      }
    }

    let suggestions = [];
    try {
      suggestions = await generateSuggestions(trimmedMessage, replyText);
    } catch (suggestionError) {
      console.error('Failed to generate suggestions:', suggestionError);
    }

    let highlighted = null;
    try {
      highlighted = await highlightReply(replyText);
      if (highlighted) await conversations.updateLastAssistantMessage(conversationId, highlighted);
    } catch (highlightError) {
      console.error('Failed to generate highlight:', highlightError);
    }

    res.json({
      conversationId,
      title: title || undefined,
      suggestions: suggestions.length ? suggestions : undefined,
      highlighted: highlighted || undefined,
    });
  } catch (error) {
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

module.exports = { sendMessage, startLocalMessage, finishLocalMessage, listConversations, getConversation, deleteConversation };
