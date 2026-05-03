export const GET_CURRENT_TIME_TOOL = {
  type: 'function',
  function: {
    name: 'get_current_time',
    description: 'Returns the current date and time.',
    parameters: { type: 'object', properties: {} },
  },
}

export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the public web for current information and return relevant sources.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The web search query.',
        },
      },
      required: ['query'],
    },
  },
}

export const READ_WEBPAGE_TOOL = {
  type: 'function',
  function: {
    name: 'read_webpage',
    description:
      'Fetch and read the main text content from a specific webpage URL.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'A full http(s) URL to read.',
        },
      },
      required: ['url'],
    },
  },
}

export const DEEP_RESEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'deep_research',
    description:
      'Perform multi-angle web research on a complex topic. Generates several targeted sub-queries, searches each, reads the top source per angle, and returns a structured synthesis. Use for broad "why", "how", "explain", or comparative questions where a single search would be too shallow.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The research topic or question to investigate in depth.',
        },
      },
      required: ['topic'],
    },
  },
}

export const TOOL_DEFINITIONS = [
  GET_CURRENT_TIME_TOOL,
  WEB_SEARCH_TOOL,
  READ_WEBPAGE_TOOL,
  DEEP_RESEARCH_TOOL,
]
