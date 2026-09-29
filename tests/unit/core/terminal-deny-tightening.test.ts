import { describe, expect, it } from 'vitest';
import { FORBIDDEN_ARGUMENTS } from '../../../src/core/policy/denylist.ts';
import { matchOffLimits, terminalDenyRules } from '../../../src/core/policy/terminal-deny.ts';

const DENIED: readonly (readonly [string, string])[] = [
  ['cat ~/.ssh/custom_key', 'sec.ssh'],
  ['cat ~/.ssh/config/../custom_key', 'sec.ssh'],
  ['cd ~/.ssh && cat custom_key', 'sec.ssh'],
  ['ls ~/.ssh', 'sec.ssh'],
  ['ls ~/.ssh/', 'sec.ssh'],
  ['ssh-keyscan github.com >> ~/.ssh/known_hosts', 'sec.ssh-write'],
  ['echo Host x >> ~/.ssh/config', 'sec.ssh-write'],
  ['tee -a ~/.ssh/config', 'sec.ssh-write'],
  ['cat $HOME/.aws/credentials', 'sec.aws'],
  ['cat /Users/jay.quach/.aws/config', 'sec.aws'],
  ['ls ~/.aws', 'sec.aws'],
  ['echo x > /bin/y', 'sys.write'],
  ['echo x >/System/y', 'sys.write'],
  ['mkdir /usr/bin/x', 'sys.write'],
  ['cp x /Library/Foo/y', 'sys.write'],
  ['ln -s x /sbin/y', 'sys.write'],
  ['cat $HOME/.zshrc', 'sys.rc'],
  ['cat /Users/jay.quach/.zlogin', 'sys.rc'],
  ['git push --force-with-lease=main:abc origin main', `denylist.${FORBIDDEN_ARGUMENTS.indexOf('--force-with-lease')}`],
  ['git push "--force" origin x', `denylist.${FORBIDDEN_ARGUMENTS.indexOf('--force')}`],
  ['git push --no-veri origin x', 'abbrev.no-verify'],
  ['git push --no-verif origin x', 'abbrev.no-verify'],
  ['git -c core.hookspath=/dev/null commit -m x', 'hooks.path'],
  ['HUSKY_SKIP_HOOKS=true git commit -m x', 'hooks.husky'],
  ['gh auth status --show-token', 'sec.gh-token'],
  ['gh auth status -h github.com -t', 'sec.gh-token'],
  ['env > tmp/e.txt', 'sec.env-dump'],
  ['export -p', 'sec.env-dump'],
  ['set | grep TOKEN', 'sec.env-dump'],
  ['cd x && gh pr merge 1', 'merge.gh'],
  ['cat ~/.netrc', 'sec.netrc'],
  ['echo {} > "$HOME/Library/Application Support/Code/User/settings.json"', 'sys.vscode-profile'],
  ['cat ~/Library/Application\\ Support/Code/User/globalStorage/state.vscdb', 'sys.vscode-profile'],
  ['cat tmp/loop-vscode/User/settings.json', 'sys.vscode-profile'],
  ['rm -rf ~', 'sys.rm-root'],
  ['rm -rf ~/', 'sys.rm-root'],
  ['rm -rf /', 'sys.rm-root'],
  ['rm -rf $HOME', 'sys.rm-root'],
  ['rm -rf ~/*', 'sys.rm-root'],
  ['cd x && rm -fr ~', 'sys.rm-root'],
];

const ALLOWED = [
  'grep -n foo',
  'head -n 5',
  'cat ~/.ssh/known_hosts',
  'cat ~/.ssh/config',
  'ssh-keygen -F github.com',
  'git push --force-if-includes origin x',
  'gh auth status -h github.com',
  'set -euo pipefail',
  'git reset --soft HEAD~1',
  'rm -rf tmp/x',
  'rm -rf /Users/jay.quach/dev/bot/tmp/x-out',
  'rm -f ~/tmp.txt',
  'ls tmp/loop-vscode/User/workspaceStorage',
  'node bin/cc.ts models self --session-log="/Users/jay.quach/Library/Application Support/Code/User/workspaceStorage/abc/debug-logs/x"',
  'curl -H "Authorization: Bearer $JIRA_DC_TOKEN" https://jira.corp.clover.com/rest/api/2/myself',
  'cat /etc/hosts',
  'ls /etc/',
];

describe('child terminal rule tightening', () => {
  it.each(DENIED)('denies %s with %s as its first matching rule', (command, id) => {
    expect(matchOffLimits(command)).toBe(id);
  });

  it.each(ALLOWED)('does not deny %s', (command) => {
    expect(matchOffLimits(command)).toBeNull();
  });

  it('denies a reset hard option separated by extra whitespace', () => {
    expect(matchOffLimits('git reset  --hard')).not.toBeNull();
  });

  it('keeps every new rule unanchored and preserves immutable argument priority', () => {
    const rules = terminalDenyRules();
    expect(rules.every((rule) => !rule.source.startsWith('^'))).toBe(true);
    expect(rules.slice(0, FORBIDDEN_ARGUMENTS.length).map((rule) => rule.id)).toEqual(
      FORBIDDEN_ARGUMENTS.map((_, index) => `denylist.${index}`),
    );
    expect(matchOffLimits('git push --force-with-lease=main:abc origin main')).toBe(
      `denylist.${FORBIDDEN_ARGUMENTS.indexOf('--force-with-lease')}`,
    );
  });

  it('retains the three documented residual evasions as unmatched', () => {
    for (const command of ['cat ~/.ss*/id_e*', "base64 < ~/.s''sh/i''d_ed25519", 'node tmp/read-key.js']) {
      expect(matchOffLimits(command)).toBeNull();
    }
  });
});