import { foldSessionJsonl } from '../model/session.ts';

/**
 * What a driver's `code chat` dispatch became, read from the target window's chat sessions.
 *
 * `code chat` prints nothing and its exit code means nothing, so before this the driver could
 * only poll the verifier: a worker that refused in three seconds cost six minutes of red polling
 * per iteration (run 147, three times). The request is found by the sentinel the driver puts on
 * the first line of every dispatch, which names the run and iteration, so it is unambiguous.
 */

export type DispatchStatus = 'none' | 'running' | 'done' | 'refused';

export interface DispatchObservation {
  readonly status: DispatchStatus;
  readonly agent: string | null;
  readonly model: string | null;
  readonly reply: string;
}

const REFUSAL = /^\s*WRONG AGENT\b/;
const NOT_FOUND: DispatchObservation = { status: 'none', agent: null, model: null, reply: '' };

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringAt(value: unknown, ...path: string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!isJson(current)) return null;
    current = current[key];
  }
  return typeof current === 'string' ? current : null;
}

/** The markdown the agent wrote. Tool calls and thinking carry a `kind`; plain text does not. */
function replyOf(request: Json): string {
  const parts = Array.isArray(request.response) ? request.response : [];
  return parts
    .filter((part): part is Json => isJson(part) && part.kind === undefined && typeof part.value === 'string')
    .map((part) => String(part.value))
    .join('')
    .trim();
}

function finished(request: Json): boolean {
  const state = request.modelState;
  if (!isJson(state)) return false;
  return state.completedAt !== undefined || (typeof state.value === 'number' && state.value !== 0);
}

function observe(request: Json): DispatchObservation {
  const reply = replyOf(request);
  const done = finished(request);
  let status: DispatchStatus = done ? 'done' : 'running';
  if (done && REFUSAL.test(reply)) status = 'refused';
  return {
    status,
    agent: stringAt(request, 'modeInfo', 'modeInstructions', 'name'),
    model: typeof request.modelId === 'string' ? request.modelId : null,
    reply,
  };
}

/** Sessions oldest first; the last request whose message starts with the sentinel wins. */
export function observeDispatch(
  sessions: readonly (readonly string[])[],
  sentinel: string,
): DispatchObservation {
  let seen = NOT_FOUND;
  for (const lines of sessions) {
    const state = foldSessionJsonl(lines);
    const requests = isJson(state) && Array.isArray(state.requests) ? state.requests : [];
    for (const request of requests) {
      const text = stringAt(request, 'message', 'text');
      if (isJson(request) && text !== null && text.trimStart().startsWith(sentinel)) {
        seen = observe(request);
      }
    }
  }
  return seen;
}
