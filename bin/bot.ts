#!/usr/bin/env -S npx tsx
import { doctor, type CheckResult } from '../src/config/doctor.ts';

const COMMANDS = ['doctor'] as const;

async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0] ?? 'doctor';

  switch (command) {
    case 'doctor':
      return report(await doctor());
    default:
      process.stderr.write(`unknown command "${command}". Known: ${COMMANDS.join(', ')}\n`);
      return 2;
  }
}

function report(results: readonly CheckResult[]): number {
  for (const result of results) {
    process.stdout.write(`${result.ok ? '✓' : '✗'} ${result.name}: ${result.detail}\n`);
  }
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    process.stdout.write(`\n${failed} check(s) failed.\n`);
  }
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
