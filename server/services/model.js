const crypto = require('crypto');

const BASE_URL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1';
const API_KEY = process.env.OPENCODE_API_KEY;
const MODEL_ID = process.env.OPENCODE_MODEL || 'big-pickle';

if (!API_KEY) {
  throw new Error('OPENCODE_API_KEY must be set in the environment.');
}

// OpenCode Zen's free-tier models require a stable per-session identifier
// on every request (x-opencode-session), or they reject the call with
// MissingSessionID. One id per server process is sufficient here since
// requests aren't tied to a specific end-user conversation session.
const OPENCODE_SESSION_ID = crypto.randomUUID();
const REQUEST_TIMEOUT_MS = 30000;

async function createChatCompletion({ messages, tools, maxTokens }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        'x-opencode-session': OPENCODE_SESSION_ID,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages,
        tools,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
  } catch (fetchError) {
    if (fetchError.name === 'AbortError') {
      const timeoutError = new Error('Model request timed out.');
      timeoutError.upstreamStatus = 503;
      throw timeoutError;
    }
    throw fetchError;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const error = new Error(`Model request failed (${response.status}): ${errorBody.slice(0, 500)}`);
    error.upstreamStatus = response.status;
    throw error;
  }

  const data = await response.json();
  const message = data.choices && data.choices[0] && data.choices[0].message;
  if (!message) {
    throw new Error('Model response had no message in choices.');
  }
  return message;
}

module.exports = { createChatCompletion };
