import { describe, expect, it } from 'vitest';
import { issueKeysForPullRequest, parseIssueKeys } from '../../../src/core/issue-key.ts';

describe('parseIssueKeys', () => {
  it('finds a key in a branch-style string', () => {
    expect(parseIssueKeys('feature/WS-6316-centralise-config')).toEqual(['WS-6316']);
  });

  it('finds a key in a PR title suffix', () => {
    expect(parseIssueKeys('docs: add verified stack fact ledger [WS-6337]')).toEqual(['WS-6337']);
  });

  it('preserves first-seen order and drops duplicates', () => {
    const text = 'fix: zone rewrite (WS-6211, WS-6230, WS-6238)\n\nSupersedes WS-6211.';
    expect(parseIssueKeys(text)).toEqual(['WS-6211', 'WS-6230', 'WS-6238']);
  });

  it('does not match a key embedded in a longer word', () => {
    expect(parseIssueKeys('PAWS-1 and xWS-2')).toEqual(['PAWS-1']);
  });

  it('returns nothing when there is no key', () => {
    expect(parseIssueKeys('chore: bump dependencies')).toEqual([]);
  });

  it('filters to the allowed projects when given', () => {
    const text = 'WS-6316 relates to SV-4870 and ENG-12';
    expect(parseIssueKeys(text, ['WS'])).toEqual(['WS-6316']);
  });

  it('is case sensitive, because lowercase is not a Jira key', () => {
    expect(parseIssueKeys('ws-6316')).toEqual([]);
  });
});

describe('issueKeysForPullRequest', () => {
  it('unions keys across branch, title and body', () => {
    const keys = issueKeysForPullRequest({
      branch: 'feature/WS-6326-adopt-config',
      title: 'chore(copilot): adopt shared config (WS-6326)',
      body: 'Also unblocks WS-6334.',
    });
    expect(keys).toEqual(['WS-6326', 'WS-6334']);
  });

  it('returns an empty list for a PR with no Jira link at all', () => {
    // This is the real shape of clover/web-storefront-engine#2390, which is why the
    // `pr-no-jira-link` stall exists.
    const keys = issueKeysForPullRequest({
      branch: 'docs/stack-fact-ledger',
      title: 'docs: add verified stack fact ledger',
      body: '',
    });
    expect(keys).toEqual([]);
  });
});
