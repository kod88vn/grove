import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    super(`${command} failed (exit ${exitCode ?? 'null'}): ${stderr.trim().slice(0, 400)}`);
    this.name = 'CommandError';
  }
}

export interface RunOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
}

/**
 * Run a program with an argument array.
 *
 * `execFile`, never `exec`: arguments go straight to the process rather than through a shell,
 * so a branch named `foo;rm -rf ~` is an argument and not a second command. Every caller here
 * passes branch names, PR titles and JQL that originate from other people.
 */
export async function run(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, [...args], {
      // gh can return several megabytes when hydrating many PRs at once.
      maxBuffer: 32 * 1024 * 1024,
      timeout: options.timeoutMs ?? 60_000,
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });
    return stdout;
  } catch (error) {
    const shaped = error as { code?: number | null; stderr?: string; message?: string };
    throw new CommandError(
      `${command} ${args.join(' ')}`,
      shaped.code ?? null,
      shaped.stderr ?? shaped.message ?? '',
    );
  }
}

/** Run a program and parse its stdout as JSON. */
export async function runJson<T>(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<T> {
  const stdout = await run(command, args, options);
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new CommandError(
      `${command} ${args.join(' ')}`,
      0,
      `expected JSON but got: ${stdout.slice(0, 200)}`,
    );
  }
}
