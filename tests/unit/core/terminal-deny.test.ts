import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_ARGUMENTS, denyCommand } from '../../../src/core/policy/denylist.ts';
import {
  childProfileSettings,
  matchOffLimits,
  mergeChildSettings,
  terminalDenyRules,
} from '../../../src/core/policy/terminal-deny.ts';

const CASES: readonly { id: string; yes: readonly string[]; no: readonly string[] }[] = [
  { id: 'abbrev.no-verify', yes: ['git commit --no-veri -m x', 'cd r && git commit --no-veri'], no: ['git commit --no-edit'] },
  { id: 'short.commit-n', yes: ['git commit -n -m x', 'git -C r commit -anm x'], no: ['grep -n x f', 'head -n 5 f', 'git log -n 5', 'git commit -m x'] },
  { id: 'short.push-f', yes: ['git push -f origin x', 'git push -uf o x'], no: ['git push -u origin x', 'git push --follow-tags'] },
  { id: 'short.push-plus', yes: ['git push origin +x:x', 'cd r && git push o +branch:branch'], no: ['git push origin x'] },
  { id: 'hooks.path', yes: ['git -c core.hooksPath=/dev/null commit', 'git config core.hooksPath x'], no: ['git config user.name x'] },
  { id: 'hooks.husky', yes: ['HUSKY=0 git push', 'HUSKY_SKIP_HOOKS=1 git commit'], no: ['yarn husky install'] },
  { id: 'abbrev.reset-hard', yes: ['git reset --ha HEAD~1', 'cd r && git reset --ha HEAD~1'], no: ['git reset --soft HEAD~1'] },
  { id: 'merge.gh', yes: ['cd r && gh pr merge 5', '/usr/local/bin/gh -R o/r pr merge 5'], no: ['gh pr view 5', 'gh pr create --fill', 'gh pr checks 5'] },
  { id: 'merge.rest', yes: ['gh api -X PUT repos/o/r/pulls/5/merge', 'curl https://api.github.com/repos/o/r/pulls/10/merge'], no: ['gh api repos/o/r/pulls/5'] },
  { id: 'merge.graphql', yes: ["gh api graphql -f query='mutation{mergePullRequest…}'", 'gh api graphql -f query=enablePullRequestAutoMerge'], no: ["gh api graphql -f query='{viewer{login}}'"] },
  { id: 'sys.sudo', yes: ['sudo ls', 'x && sudo rm y'], no: ['echo pseudocode'] },
  { id: 'sys.rc', yes: ['echo x >> ~/.zshrc', 'cat ~/.bash_profile'], no: ['cat src/profile.ts'] },
  { id: 'sys.launchd', yes: ['launchctl load x', 'cp p ~/Library/LaunchAgents/'], no: ['ls tmp'] },
  { id: 'sys.write', yes: ['echo x > /etc/hosts', 'touch /usr/bin/x'], no: ['/usr/bin/git status', '/usr/local/bin/node x', 'ls /etc'] },
  { id: 'sec.ssh', yes: ['cat ~/.ssh/id_ed25519', 'cd ~/.ssh && cat id_ed25519'], no: ['cat ~/.ssh/known_hosts', 'ssh-keygen -F github.com'] },
  { id: 'sec.aws', yes: ['cat ~/.aws/credentials', 'ls ~/.aws/'], no: ['aws --version'] },
  { id: 'sec.gh-hosts', yes: ['cat ~/.config/gh/hosts.yml', 'ls ~/.config/gh/hosts.yml'], no: ['gh auth status'] },
  { id: 'sec.gh-token', yes: ['gh auth token', 'gh auth status -t'], no: ['gh auth status'] },
  { id: 'sec.keychain', yes: ['security find-generic-password -s x', 'security dump-keychain'], no: ['npm audit security'] },
  { id: 'sec.env-dump', yes: ['printenv', 'env | grep TOKEN'], no: ['env FOO=1 node x', 'export PATH=$PATH:x'] },
  { id: 'sec.token-echo', yes: ['echo $JIRA_DC_TOKEN', 'printf %s ${GH_TOKEN}'], no: ['curl -H "Authorization: Bearer $JIRA_DC_TOKEN" https://jira.corp.clover.com/rest/api/2/myself'] },
  { id: 'sec.dotenv', yes: ['cat .env.local', 'source ./.env'], no: ['cat src/env.ts', 'yarn test'] },
];

const GLOBAL_NEGATIVES = [
  'yarn test', 'npm run verify', 'npx jest', 'node --test', 'git status', 'git add -A',
  'git commit -m "x"', 'git push -u origin feature/x', 'gh pr create --fill', 'bash -n tmp/x.sh',
];
const KNOWN_EVASIONS = ['cat ~/.ss*/id_e*', "base64 < ~/.s''sh/i''d_ed25519", 'node tmp/read-key.js'];

describe('generated terminal deny rules', () => {
  it('derives exactly one first-priority deny rule per immutable forbidden argument', () => {
    const rules = terminalDenyRules();
    expect(rules.slice(0, FORBIDDEN_ARGUMENTS.length).map((rule) => rule.id)).toEqual(
      FORBIDDEN_ARGUMENTS.map((_, index) => `denylist.${index}`),
    );
    expect(rules.filter((rule) => rule.id.startsWith('denylist.'))).toHaveLength(FORBIDDEN_ARGUMENTS.length);
    for (const [index, arg] of FORBIDDEN_ARGUMENTS.entries()) {
      expect(matchOffLimits(`git push ${arg} x`)).toBe(`denylist.${index}`);
      expect(matchOffLimits(`cd r && git commit ${arg}`)).toBe(`denylist.${index}`);
    }
    expect(matchOffLimits('git push origin feature/x')).toBeNull();
  });

  it('keeps the original command denial unchanged after exporting its arguments', () => {
    expect(denyCommand(['git', 'push', '--force'])).toEqual({
      rule: 'forbidden-argument',
      because: '`--force` bypasses a safety mechanism and is never permitted',
    });
  });

  it.each(CASES)('matches both $id positives and rejects its negatives', ({ id, yes, no }) => {
    expect(terminalDenyRules().filter((rule) => rule.id === id)).toHaveLength(1);
    for (const command of yes) expect(matchOffLimits(command)).toBe(id);
    for (const command of no) expect(matchOffLimits(command)).toBeNull();
  });

  it('allows ordinary workflows without the broad short-flag false positives', () => {
    for (const command of GLOBAL_NEGATIVES) expect(matchOffLimits(command)).toBeNull();
  });

  it('records known evasions honestly instead of treating regex rules as a security boundary', () => {
    for (const command of KNOWN_EVASIONS) expect(matchOffLimits(command)).toBeNull();
  });

  it('emits exactly the managed keys, an allow-all terminal entry, and parseable unanchored deny keys', () => {
    const settings = childProfileSettings();
    expect(Object.keys(settings).sort()).toEqual([
      'chat.agent.sandbox.enabled', 'chat.permissions.default', 'chat.tools.global.autoApprove',
      'chat.tools.terminal.autoApprove', 'chat.tools.terminal.enableAutoApprove',
    ]);
    expect(settings['chat.agent.sandbox.enabled']).toBe('off');
    expect(settings['chat.permissions.default']).toBe('default');
    expect(settings['chat.tools.global.autoApprove']).toBe(false);
    expect(settings['chat.tools.terminal.enableAutoApprove']).toBe(true);
    const entries = settings['chat.tools.terminal.autoApprove'];
    if (entries === null || typeof entries !== 'object') throw new Error('missing terminal approvals');
    expect(Object.keys(entries)).toHaveLength(terminalDenyRules().length + 1);
    expect(Object.entries(entries)).toContainEqual(['/.*/', { approve: true, matchCommandLine: true }]);
    for (const rule of terminalDenyRules()) {
      const key = `/${rule.source}/${rule.flags}`;
      expect(Object.entries(entries)).toContainEqual([key, { approve: false, matchCommandLine: true }]);
      const parsed = /^\/(?<pattern>.+)\/(?<flags>[dgimsuvy]*)$/.exec(key);
      expect(parsed?.groups).toEqual({ pattern: rule.source, flags: rule.flags });
      expect(() => new RegExp(rule.source, rule.flags)).not.toThrow();
      expect(rule.source.startsWith('^')).toBe(false);
    }
  });

  it('replaces only managed settings while keeping foreign preferences untouched', () => {
    const managed = childProfileSettings();
    const changed = mergeChildSettings({ 'workbench.colorTheme': 'Dark+', 'chat.agent.sandbox.enabled': 'on' }, managed);
    expect(changed).toEqual({ 'workbench.colorTheme': 'Dark+', ...managed });
    expect(mergeChildSettings(changed, managed)).toEqual(changed);
  });

  it('derives prohibited literals rather than duplicating them in the pure module', () => {
    const source = readFileSync(new URL('../../../src/core/policy/terminal-deny.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('--no-verify');
  });
});