const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_time',
      description: "Get the current server time. Use this when the user asks what time it is.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_question',
      description: "Ask the user one or more clarifying questions before continuing. Use this instead of guessing, and instead of listing questions as plain text, when you need information only the user has. If you have several things to ask, include ALL of them in ONE call as separate entries in the questions array — do not call this tool multiple times in a row for separate questions. Each question can offer multiple-choice options; the user can always type a custom answer instead of picking one. Calling this ends your turn — the user's answer(s) will come back as their next message.",
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: 'One or more questions to ask, in the order they should be shown.',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string', description: 'The question text.' },
                description: { type: 'string', description: 'Optional explanation shown with the question.' },
                options: {
                  type: 'array',
                  description: 'Optional multiple-choice options. Omit or leave empty for a free-text-only question. The user can always type their own answer even when options are given.',
                  items: {
                    anyOf: [
                      { type: 'string' },
                      {
                        type: 'object',
                        properties: { label: { type: 'string' }, description: { type: 'string' } },
                        required: ['label'],
                      },
                    ],
                  },
                },
                multiple: { type: 'boolean', description: 'Allow selecting more than one option.' },
                required: { type: 'boolean', description: 'Whether an answer is required.' },
              },
              required: ['question'],
            },
          },
        },
        required: ['questions'],
      },
    },
  },
];

// Tools marked terminal end the tool loop immediately instead of feeding a
// result back to the model: the "result" is a UI element the user has to act
// on (e.g. answering a question), which can't resolve within one request.
const TERMINAL_TOOLS = new Set(['ask_question']);

const TOOL_EXECUTORS = {
  get_time: async () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      iso: now.toISOString(),
    };
  },
  ask_question: async (args) => {
    const questions = Array.isArray(args.questions) ? args.questions : [];
    return {
      questions: questions
        .filter((q) => q && typeof q.question === 'string' && q.question.trim())
        .map((q) => ({
          question: q.question.trim(),
          description: typeof q.description === 'string' ? q.description.trim() : '',
          options: Array.isArray(q.options) ? q.options.map((option) => {
            if (typeof option === 'string') return { label: option.trim(), description: '' };
            return {
              label: option && typeof option.label === 'string' ? option.label.trim() : '',
              description: option && typeof option.description === 'string' ? option.description.trim() : '',
            };
          }).filter((option) => option.label) : [],
          multiple: q.multiple === true,
          required: q.required !== false,
        })),
    };
  },
};

function isTerminalTool(name) {
  return TERMINAL_TOOLS.has(name);
}

async function runTool(name, args) {
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return executor(args);
}

module.exports = { TOOL_DEFINITIONS, runTool, isTerminalTool };
