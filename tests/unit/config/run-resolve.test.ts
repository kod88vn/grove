import { describe, expect, it } from 'vitest';
import { resolvable } from '../../../src/config/run-resolve.ts';
import type { Stall } from '../../../src/core/model/stall.ts';

/**
 * Selection is the dangerous half of `cc resolve`: everything downstream is guarded, but a
 * ticket that should never have been a candidate is a mutation nobody asked for.
 */

function stall(id: Stall['id'], key: string): Stall {
  return {
    id,
    subject: { kind: 'issue', key },
    owner: 'me',
    severity: 'high',
    ageDays: 11,
    summary: `${key} summary`,
    nextMove: { description: `Resolve ${key}`, action: null },
  };
}

describe('resolvable', () => {
  it('selects tickets whose PR merged and ignores every other kind of stall', () => {
    const stalls = [
      stall('pr-merged-ticket-open', 'WS-6114'),
      stall('ticket-stale', 'WS-9999'),
      stall('ticket-in-progress-no-branch', 'WS-8888'),
    ];

    expect(resolvable(stalls, null)).toEqual(['WS-6114']);
  });

  it('proposes one action per ticket when a single PR closed several', () => {
    const stalls = [
      stall('pr-merged-ticket-open', 'WS-6326'),
      stall('pr-merged-ticket-open', 'WS-6326'),
      stall('pr-merged-ticket-open', 'WS-6333'),
    ];

    expect(resolvable(stalls, null)).toEqual(['WS-6326', 'WS-6333']);
  });

  it('narrows to a single key so one ticket can be resolved without the rest', () => {
    const stalls = [
      stall('pr-merged-ticket-open', 'WS-6114'),
      stall('pr-merged-ticket-open', 'WS-6229'),
    ];

    expect(resolvable(stalls, 'WS-6229')).toEqual(['WS-6229']);
  });

  it('returns nothing for a key that is not a candidate, rather than trusting the argument', () => {
    const stalls = [stall('pr-merged-ticket-open', 'WS-6114')];

    expect(resolvable(stalls, 'WS-1234')).toEqual([]);
  });

  it('ignores a merged-PR stall whose subject is the pull request, not a ticket', () => {
    const prStall: Stall = {
      id: 'pr-merged-branch-exists',
      subject: { kind: 'pull_request', repo: 'clover/web-storefront-engine', number: 2351 },
      owner: 'me',
      severity: 'low',
      ageDays: 3,
      summary: 'branch remains',
      nextMove: { description: 'delete it', action: null },
    };

    expect(resolvable([prStall], null)).toEqual([]);
  });
});
