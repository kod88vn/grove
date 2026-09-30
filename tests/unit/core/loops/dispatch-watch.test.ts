import { describe, expect, it } from 'vitest';
import { observeDispatch } from '../../../../src/core/loops/dispatch-watch.ts';
import { foldSessionJsonl } from '../../../../src/core/model/session.ts';

// Shapes copied from real chat session files in the cloverpedia window (2026-09-30): a one-line
// snapshot (bfb1b6f0…, the WRONG AGENT refusal) and a delta log whose response appends carry a
// splice index `i` (9ab9427b…). modelState 0 is in flight; 1 and 3 both arrived with completedAt.

const SENTINEL = 'LOOP DRIVER DISPATCH — M2-c run 147 iteration 2 of 4';

function request(text: string, state: object, reply: string): object {
  return {
    message: { text },
    modelId: 'copilot/gpt-6-luna',
    modelState: state,
    modeInfo: { kind: 'agent', modeInstructions: { name: 'loop-worker.m-gpt-6-luna' } },
    response: [
      { kind: 'thinking', value: 'checking preflight' },
      { value: reply, supportThemeIcons: false, supportHtml: false },
    ],
  };
}

function snapshot(...requests: object[]): string[] {
  return [JSON.stringify({ kind: 0, v: { requests } })];
}

describe('the driver can see what its dispatch became', () => {
  it('reports a refusal with the agent and model that refused', () => {
    const refused = request(
      `${SENTINEL}\n\nRequirement …`,
      { value: 1, completedAt: 1790781401964 },
      'WRONG AGENT: this is not a driver dispatch. Pick loop-architect with GPT-6 Sol.',
    );
    expect(observeDispatch([snapshot(refused)], SENTINEL)).toEqual({
      status: 'refused',
      agent: 'loop-worker.m-gpt-6-luna',
      model: 'copilot/gpt-6-luna',
      reply: 'WRONG AGENT: this is not a driver dispatch. Pick loop-architect with GPT-6 Sol.',
    });
  });

  it('says none when no request carries this iteration’s sentinel', () => {
    const other = request('LOOP DRIVER DISPATCH — M2-c run 147 iteration 1 of 4', { value: 1 }, 'done');
    expect(observeDispatch([snapshot(other)], SENTINEL).status).toBe('none');
    expect(observeDispatch([], SENTINEL).status).toBe('none');
  });

  it('distinguishes a worker still running from one that has finished', () => {
    const running = request(SENTINEL, { value: 0 }, 'editing src/discover.mjs');
    expect(observeDispatch([snapshot(running)], SENTINEL).status).toBe('running');
    const finished = request(SENTINEL, { value: 3, completedAt: 1790779919228 }, 'Changed two files.');
    expect(observeDispatch([snapshot(finished)], SENTINEL).status).toBe('done');
  });

  it('reports an unanswered tool permission as pending, not a completed worker', () => {
    const pending = {
      ...request(SENTINEL, { value: 4 }, ''),
      response: [{ kind: 'toolInvocationSerialized', toolId: 'read_file', invocationMessage: 'Read external file' }],
    };
    expect(observeDispatch([snapshot(pending)], SENTINEL).status).toBe('pending');
    expect(observeDispatch([snapshot(request(SENTINEL, { value: 4 }, ''))], SENTINEL).status).toBe('pending');
    expect(observeDispatch([snapshot(request(SENTINEL, { value: 0 }, 'working'))], SENTINEL).status).toBe('running');
    expect(observeDispatch([snapshot(request(SENTINEL, { value: 4, completedAt: 42 }, 'done'))], SENTINEL).status).toBe('done');
  });

  it('takes the last matching request across sessions', () => {
    const first = request(SENTINEL, { value: 1, completedAt: 1 }, 'WRONG AGENT: no');
    const retry = request(SENTINEL, { value: 0 }, 'working');
    expect(observeDispatch([snapshot(first), snapshot(retry)], SENTINEL).status).toBe('running');
  });

  it('reads a delta log, where response appends re-send from a splice index', () => {
    const lines = [
      ...snapshot({ ...request(SENTINEL, { value: 0 }, ''), response: [] }),
      JSON.stringify({ kind: 2, k: ['requests', 0, 'response'], v: [{ value: 'WRONG' }] }),
      JSON.stringify({ kind: 2, k: ['requests', 0, 'response'], v: [{ value: 'WRONG AGENT: stop' }], i: 0 }),
      JSON.stringify({ kind: 1, k: ['requests', 0, 'modelState'], v: { value: 1, completedAt: 5 } }),
    ];
    const seen = observeDispatch([lines], SENTINEL);
    expect(seen.status).toBe('refused');
    expect(seen.reply).toBe('WRONG AGENT: stop');
  });
});

describe('foldSessionJsonl honours the splice index', () => {
  it('truncates to i before appending, instead of duplicating the re-sent items', () => {
    const state = foldSessionJsonl([
      JSON.stringify({ kind: 0, v: { items: ['a', 'b', 'c'] } }),
      JSON.stringify({ kind: 2, k: ['items'], v: ['B', 'C', 'D'], i: 1 }),
      JSON.stringify({ kind: 2, k: ['items'], v: ['E'] }),
    ]);
    expect(state).toEqual({ items: ['a', 'B', 'C', 'D', 'E'] });
  });
});
