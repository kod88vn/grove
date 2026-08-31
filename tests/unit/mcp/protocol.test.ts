import { describe, expect, it } from 'vitest';
import { handleMessage, SUPPORTED_VERSIONS, type ServerInfo, type Tool } from '../../../src/mcp/protocol.ts';

/**
 * Protocol conformance, checked against the shapes in the MCP specification.
 *
 * These are cheap tests for an expensive failure: a malformed initialize result or an answered
 * notification makes the client disconnect with a parse error that says nothing about why.
 */

const INFO: ServerInfo = { name: 'central-command', version: '0.1.0' };

const echo: Tool = {
  definition: {
    name: 'echo',
    title: 'Echo',
    description: 'Returns its argument.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } } },
  },
  run: (args) => String(args['text'] ?? ''),
};

const explodes: Tool = {
  definition: { name: 'explodes', title: 'Explodes', description: '', inputSchema: {} },
  run: () => {
    throw new Error('the mirror is missing');
  },
};

const tools = [echo, explodes];

function send(message: unknown): Record<string, unknown> | null {
  return handleMessage(message, tools, INFO) as Record<string, unknown> | null;
}

describe('initialize', () => {
  it('echoes back a protocol version the client asked for', () => {
    const response = send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    expect((response?.['result'] as Record<string, unknown>)['protocolVersion']).toBe('2025-06-18');
  });

  it('offers its newest version when the client asks for one it does not know', () => {
    const response = send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1.0.0' } });
    expect((response?.['result'] as Record<string, unknown>)['protocolVersion']).toBe(
      SUPPORTED_VERSIONS[0],
    );
  });

  it('declares tools and nothing else, so clients do not ask for resources we lack', () => {
    const response = send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    const result = response?.['result'] as Record<string, unknown>;
    expect(result['capabilities']).toEqual({ tools: {} });
    expect(result['serverInfo']).toEqual(INFO);
  });
});

describe('notifications', () => {
  it('does not answer a notification, which has no id', () => {
    expect(send({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });
});

describe('tools/list', () => {
  it('returns every tool definition', () => {
    const response = send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const list = (response?.['result'] as { tools: unknown[] }).tools;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: 'echo' });
  });
});

describe('tools/call', () => {
  it('wraps the result in a text content block', () => {
    const response = send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'echo', arguments: { text: 'hello' } },
    });
    expect(response?.['result']).toEqual({
      content: [{ type: 'text', text: 'hello' }],
      isError: false,
    });
  });

  it('reports a thrown tool as isError rather than crashing the server', () => {
    const response = send({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'explodes', arguments: {} },
    });
    const result = response?.['result'] as { isError: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('the mirror is missing');
  });

  it('returns a protocol error for an unknown tool', () => {
    const response = send({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'nope' },
    });
    expect(response?.['error']).toMatchObject({ code: -32602 });
  });

  it('tolerates a call with no arguments at all', () => {
    const response = send({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'echo' } });
    expect(response?.['result']).toMatchObject({ isError: false });
  });
});

describe('unknown methods', () => {
  it('answers with method-not-found rather than silence', () => {
    const response = send({ jsonrpc: '2.0', id: 7, method: 'resources/list' });
    expect(response?.['error']).toMatchObject({ code: -32601 });
  });

  it('answers a ping, which clients use as a liveness check', () => {
    expect(send({ jsonrpc: '2.0', id: 8, method: 'ping' })?.['result']).toEqual({});
  });
});
