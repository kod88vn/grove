/**
 * Just enough of MCP to answer questions, implemented directly.
 *
 * The official SDK would be a dependency, and this project has none. What is needed here is
 * three methods over newline-delimited JSON, which is smaller than the wrapper around it.
 *
 * Shapes verified against the specification (modelcontextprotocol.io, 2025-06-18):
 * `initialize` echoes back a supported protocol version, `tools/list` returns `{tools}`, and
 * `tools/call` returns `{content: [{type:'text', text}], isError}`.
 */

/**
 * Versions this server will speak, newest first.
 *
 * The spec requires echoing the client's version when we support it, and otherwise replying
 * with one of ours. Hardcoding a single version would make the server refuse clients that are
 * merely newer than it.
 */
export const SUPPORTED_VERSIONS = ['2026-07-28', '2025-06-18', '2024-11-05'] as const;

/** JSON-RPC: the parameters were wrong, including an unknown tool name. */
const INVALID_PARAMS = -32602;
const METHOD_NOT_FOUND = -32601;

export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface Tool {
  readonly definition: ToolDefinition;
  /** Returns the text the model will read. Throwing is reported as a tool error, not a crash. */
  run(args: Record<string, unknown>): string;
}

export interface ServerInfo {
  readonly name: string;
  readonly version: string;
}

interface Request {
  readonly jsonrpc: string;
  readonly id?: string | number;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
}

/**
 * Handle one message.
 *
 * Returns null for notifications, which must not be answered — replying to
 * `notifications/initialized` is a protocol error that some clients treat as fatal.
 */
export function handleMessage(
  raw: unknown,
  tools: readonly Tool[],
  info: ServerInfo,
): unknown | null {
  const request = raw as Request;
  const id = request.id;
  if (id === undefined) {
    return null;
  }
  switch (request.method) {
    case 'initialize':
      return { jsonrpc: '2.0', id, result: initialize(request.params, info) };
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: tools.map((tool) => tool.definition) },
      };
    case 'tools/call':
      return { jsonrpc: '2.0', id, ...call(request.params, tools) };
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: METHOD_NOT_FOUND, message: `Unknown method: ${String(request.method)}` },
      };
  }
}

function initialize(params: Record<string, unknown> | undefined, info: ServerInfo): unknown {
  const requested = String(params?.['protocolVersion'] ?? '');
  const agreed = SUPPORTED_VERSIONS.includes(requested as (typeof SUPPORTED_VERSIONS)[number])
    ? requested
    : SUPPORTED_VERSIONS[0];
  return {
    protocolVersion: agreed,
    // Only tools. This server exposes no resources and no prompts, and saying so keeps clients
    // from asking for things that would 404.
    capabilities: { tools: {} },
    serverInfo: info,
    instructions:
      'Read-only view of my Jira tickets, pull requests and what has stopped moving. ' +
      'It cannot change anything; merging and resolving happen from the dashboard.',
  };
}

/** Either half of a JSON-RPC response, to be merged with the envelope by the caller. */
type Payload = { result: unknown } | { error: { code: number; message: string } };

function call(params: Record<string, unknown> | undefined, tools: readonly Tool[]): Payload {
  const name = String(params?.['name'] ?? '');
  const tool = tools.find((candidate) => candidate.definition.name === name);
  if (tool === undefined) {
    return { error: { code: INVALID_PARAMS, message: `Unknown tool: ${name}` } };
  }
  const args = (params?.['arguments'] ?? {}) as Record<string, unknown>;
  try {
    return { result: textResult(tool.run(args), false) };
  } catch (error) {
    // A failed tool is data, not a crash: report it in the result so the model can react.
    return { result: textResult(errorMessage(error), true) };
  }
}

function textResult(text: string, isError: boolean): unknown {
  return { content: [{ type: 'text', text }], isError };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
