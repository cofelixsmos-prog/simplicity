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
];

const TOOL_EXECUTORS = {
  get_time: async () => {
    const now = new Date();
    return {
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      iso: now.toISOString(),
    };
  },
};

async function runTool(name, args) {
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return executor(args);
}

module.exports = { TOOL_DEFINITIONS, runTool };
