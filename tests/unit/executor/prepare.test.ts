import { describe, expect, it } from 'vitest';
import type { JiraClient, JiraTransition } from '../../../src/connectors/jira/client.ts';
import { prepareResolve } from '../../../src/executor/prepare.ts';

/**
 * The fix-version rule is the part worth pinning down.
 *
 * WS enforces a Fix/Version through a transition validator, which
 * `transitions?expand=transitions.fields` does not report. Supplying one unconditionally would
 * be an easy fix and a bad one: it would overwrite a real release train to make a button work.
 */

const RESOLVE: JiraTransition = {
  id: '5',
  name: 'Resolve Issue',
  to: 'Resolved',
  requiredFields: ['resolution'],
};

/** A stand-in for the two calls prepare makes. Fake, not a mock: it answers, it asserts nothing. */
function fakeJira(transitions: JiraTransition[], fixVersions: string[]): JiraClient {
  return {
    transitions: () => Promise.resolve(transitions),
    fixVersions: () => Promise.resolve(fixVersions),
  } as unknown as JiraClient;
}

function payloadOf(prepared: NonNullable<Awaited<ReturnType<typeof prepareResolve>>>) {
  if (prepared.action.capability !== 'jira:transition') {
    throw new Error('expected a jira:transition action');
  }
  return prepared.action.payload;
}

describe('prepareResolve', () => {
  it('adds the fallback fix version when the ticket has none', async () => {
    const prepared = await prepareResolve(fakeJira([RESOLVE], []), 'WS-6114', 'NA');

    expect(prepared).not.toBeNull();
    expect(payloadOf(prepared!).fields).toEqual({
      resolution: { name: 'Fixed' },
      fixVersions: [{ name: 'NA' }],
    });
  });

  it('leaves an existing fix version alone rather than overwriting a release train', async () => {
    const prepared = await prepareResolve(fakeJira([RESOLVE], ['ws-26.09.07']), 'WS-6229', 'NA');

    expect(payloadOf(prepared!).fields).toEqual({ resolution: { name: 'Fixed' } });
  });

  it('reads the transition id live instead of assuming one', async () => {
    const moved: JiraTransition = { ...RESOLVE, id: '931' };

    const prepared = await prepareResolve(fakeJira([moved], []), 'WS-6232', 'NA');

    expect(payloadOf(prepared!).transitionId).toBe('931');
  });

  it('returns null when the workflow offers no way to resolve', async () => {
    const onlyStart: JiraTransition = {
      id: '4',
      name: 'Start Progress',
      to: 'In Progress',
      requiredFields: [],
    };

    expect(await prepareResolve(fakeJira([onlyStart], []), 'WS-1', 'NA')).toBeNull();
  });

  it('reports a required field it cannot fill, so the caller can decline to offer the action', async () => {
    const demanding: JiraTransition = {
      ...RESOLVE,
      requiredFields: ['resolution', 'customfield_99999'],
    };

    const prepared = await prepareResolve(fakeJira([demanding], []), 'WS-2', 'NA');

    expect(prepared!.unfilled).toEqual(['customfield_99999']);
  });
});
