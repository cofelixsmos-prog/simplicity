const BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_ID = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

if (!API_KEY) {
  throw new Error('OPENROUTER_API_KEY must be set in the environment.');
}

const REQUEST_TIMEOUT_MS = 30000;

async function createChatCompletion({ messages, tools, maxTokens, onToken }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages,
        tools,
        max_tokens: maxTokens,
        stream: true,
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

  const reader = response.body && response.body.getReader();
  if (!reader) throw new Error('Model response did not provide a stream.');

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const toolCalls = [];

  function processLine(line) {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch (error) {
      throw new Error('Model stream contained invalid JSON.');
    }

    const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (!delta) return;

    if (delta.content) {
      content += delta.content;
      if (onToken) onToken(delta.content, content);
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index || 0;
        if (!toolCalls[index]) {
          toolCalls[index] = {
            id: toolCall.id || '',
            type: toolCall.type || 'function',
            function: { name: '', arguments: '' },
          };
        }
        const current = toolCalls[index];
        if (toolCall.id) current.id = toolCall.id;
        if (toolCall.function && toolCall.function.name) current.function.name += toolCall.function.name;
        if (toolCall.function && toolCall.function.arguments) current.function.arguments += toolCall.function.arguments;
      }
    }
  }

  while (true) {
    const part = await reader.read();
    buffer += decoder.decode(part.value || new Uint8Array(), { stream: !part.done });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) processLine(line.trimEnd());
    if (part.done) break;
  }
  if (buffer.trim()) processLine(buffer.trimEnd());

  if (!content && !toolCalls.length) {
    throw new Error('Model response had no message in choices.');
  }
  return {
    role: 'assistant',
    content: content || null,
    tool_calls: toolCalls.length ? toolCalls : undefined,
  };
}

module.exports = { createChatCompletion };
