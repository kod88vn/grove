import { FORBIDDEN_ARGUMENTS } from './denylist.ts';

/**
 * Pure terminal command denial rules and child VS Code profile generator.
 *
 * Derives unanchored regular expressions that deny dangerous shell commands while
 * permitting standard developer workflows. Used to generate the terminal auto-approve
 * settings for headless and child VS Code loop runners.
 */

export interface TerminalDenyRule {
  readonly id: string;
  readonly source: string;
  readonly flags: string;
}

export interface TerminalApprovalEntry {
  readonly approve: boolean;
  readonly matchCommandLine: boolean;
}

export interface ChildProfileSettings {
  readonly 'chat.agent.sandbox.enabled': 'off';
  readonly 'chat.permissions.default': 'default';
  readonly 'chat.tools.global.autoApprove': false;
  readonly 'chat.tools.terminal.autoApprove': Record<string, TerminalApprovalEntry>;
  readonly 'chat.tools.terminal.enableAutoApprove': true;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STATIC_CASES: readonly { readonly id: string; readonly source: string; readonly flags: string }[] = [
  { id: 'abbrev.no-verify', source: '\\bgit\\b.*?--no-ver', flags: '' },
  { id: 'short.commit-n', source: '\\bgit\\b.*?\\bcommit\\b.*?(?:^|\\s)-[a-zA-Z]*n[a-zA-Z]*\\b', flags: '' },
  { id: 'short.push-f', source: '\\bgit\\b.*?\\bpush\\b.*?(?:^|\\s)-[a-zA-Z]*f[a-zA-Z]*\\b', flags: '' },
  { id: 'short.push-plus', source: '\\bgit\\b.*?\\bpush\\b.*?(?:^|\\s)\\+[^\\s]+', flags: '' },
  { id: 'hooks.path', source: 'core\\.hooks[Pp]ath', flags: '' },
  { id: 'hooks.husky', source: '\\bHUSKY(?:_SKIP_HOOKS)?=(?:\\d+|true|false)', flags: '' },
  { id: 'abbrev.reset-hard', source: '\\bgit\\b.*?\\breset\\b.*?--ha', flags: '' },
  { id: 'merge.gh', source: '\\bgh\\b.*?\\bpr\\s+merge\\b', flags: '' },
  { id: 'merge.rest', source: 'repos\\/[^\\s/]+\\/[^\\s/]+\\/pulls\\/\\d+\\/merge\\b', flags: '' },
  { id: 'merge.graphql', source: '\\b(?:mergePullRequest|enablePullRequestAutoMerge)\\b', flags: '' },
  { id: 'sys.sudo', source: '\\bsudo\\b', flags: '' },
  { id: 'sys.rc', source: '(?:~\\/\\.(?:zshrc|bash_profile|bashrc|profile|zshenv|zprofile)\\b|\\$HOME\\/\\.(?:zshrc|bash_profile|bashrc|profile|zshenv|zprofile)\\b|\\/Users\\/[^\\/\\s]+\\/\\.(?:zshrc|bash_profile|bashrc|profile|zshenv|zprofile|zlogin)\\b)', flags: '' },
  { id: 'sys.launchd', source: '\\blaunchctl\\b|Launch(?:Agents|Daemons)', flags: '' },
  { id: 'sys.write', source: '(?:\\b(?:touch|rm|mv|cp|chmod|chown|tee|mkdir|ln)\\b.*?|>{1,2}\\s*)(?:\\/etc\\/|\\/usr\\/(?!local\\/)|\\/bin\\/|\\/sbin\\/|\\/System\\/|\\/Library\\/)', flags: '' },
  { id: 'sec.ssh', source: '(?:\\bid_(?:ed25519|rsa|ecdsa|dsa)\\b|~\\/\\.ssh(?:\\/(?:config\\/\\.\\.\\/)?custom_key|\\b(?!\\/(?:known_hosts|config)(?:\\b|\\/))))', flags: '' },
  { id: 'sec.aws', source: '(?:~\\/\\.aws\\b|\\$HOME\\/\\.aws\\b|\\/Users\\/[^\\/\\s]+\\/\\.aws\\b)', flags: '' },
  { id: 'sec.gh-hosts', source: 'gh\\/hosts\\.ya?ml\\b', flags: '' },
  { id: 'sec.gh-token', source: '\\bgh\\s+auth\\s+(?:token\\b|status\\s+.*(?:-t|--show-token)\\b)', flags: '' },
  { id: 'sec.keychain', source: '\\bsecurity\\s+(?:find-generic-password|dump-keychain|find-internet-password)\\b', flags: '' },
  { id: 'sec.env-dump', source: '\\bprintenv\\b|(?<![\\w.-])(?:env\\s*(?:[|;&>]|$)|export\\s+-p\\b|set\\s*\\|)', flags: '' },
  { id: 'sec.token-echo', source: '\\b(?:echo|printf)\\b.*?\\$\\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY|AUTH)[A-Z0-9_]*\\}?', flags: '' },
  { id: 'sec.dotenv', source: '(?:\\/|\\s|^)\\.env(?:\\.local|\\.[a-zA-Z0-9_-]+|\\b|$)', flags: '' },
];

const TIGHTENING_CASES: readonly { readonly id: string; readonly source: string; readonly flags: string }[] = [
  { id: 'sec.ssh-write', source: '(?:>{1,2}\\s*|\\btee\\b.*?\\s)(?:~\\/\\.ssh\\/[^\\s;&]+)', flags: '' },
  { id: 'sec.netrc', source: '(?:~|\\$HOME|\\/Users\\/[^\\/\\s]+)\\/\\.netrc\\b', flags: '' },
  { id: 'sys.vscode-profile', source: '(?:settings\\.json|state\\.vscdb)\\b', flags: '' },
  { id: 'sys.rm-root', source: '\\brm\\b.*?\\s(?:~(?:\\/\\*)?\\/?|\\$HOME|\\/)(?:\\s|$)', flags: '' },
];

/**
 * Returns all terminal deny rules in priority order.
 *
 * First-priority rules are derived from immutable forbidden arguments, followed by
 * specific pattern rules for git evasions, secret dumps, and system modifications.
 */
export function terminalDenyRules(): readonly TerminalDenyRule[] {
  const derived = FORBIDDEN_ARGUMENTS.map((arg, index) => ({
    id: `denylist.${index}`,
    source: `(?<![A-Za-z0-9_-])${escapeRegex(arg)}(?![A-Za-z0-9_-])`,
    flags: '',
  }));
  return [...derived, ...STATIC_CASES, ...TIGHTENING_CASES];
}

/**
 * Check whether a shell command matches any off-limits rule.
 *
 * Returns the matching rule's identifier, or null if the command is permitted.
 */
export function matchOffLimits(command: string): string | null {
  for (const rule of terminalDenyRules()) {
    const regex = new RegExp(rule.source, rule.flags);
    if (regex.test(command)) {
      return rule.id;
    }
  }
  return null;
}

/**
 * Generate the child VS Code profile settings that enforce terminal denials
 * with a catch-all allow entry.
 */
export function childProfileSettings(): Record<string, unknown> {
  const terminalAutoApprove: Record<string, TerminalApprovalEntry> = {};
  for (const rule of terminalDenyRules()) {
    terminalAutoApprove[`/${rule.source}/${rule.flags}`] = {
      approve: false,
      matchCommandLine: true,
    };
  }
  terminalAutoApprove['/.*/'] = {
    approve: true,
    matchCommandLine: true,
  };

  return {
    'chat.agent.sandbox.enabled': 'off',
    'chat.permissions.default': 'default',
    'chat.tools.global.autoApprove': false,
    'chat.tools.terminal.autoApprove': terminalAutoApprove,
    'chat.tools.terminal.enableAutoApprove': true,
  };
}

/**
 * Merge managed child settings into an existing settings record,
 * replacing only managed keys while preserving foreign preferences.
 */
export function mergeChildSettings(
  existing: Readonly<Record<string, unknown>>,
  managed: Readonly<Record<string, unknown>> = childProfileSettings(),
): Record<string, unknown> {
  return {
    ...existing,
    ...managed,
  };
}
