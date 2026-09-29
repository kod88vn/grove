import { join } from 'node:path';
import { readAgentFile, writeAgentFile } from '../connectors/agent-frontmatter-file.ts';
import { loadCatalog } from '../connectors/model-catalog-file.ts';
import { loadRegistry } from '../connectors/model-registry-file.ts';
import { agentDriftStatus } from '../core/model/drift.ts';
import { escalationVariants, type EscalationVariant } from '../core/model/escalation.ts';
import { parseModelLine, replaceModelLine, replaceNameLine } from '../core/model/frontmatter.ts';
import { pick, resolveTiers } from '../core/model/resolver.ts';
import { validateRegistry, type Registry } from '../core/model/tiers.ts';
import { defaultAgentsDir, defaultRegistryPath } from './model-paths.ts';

/**
 * Actions behind `cc models` — the file-IO half. Parsing lives in `models-command.ts`; this
 * file is what actually reads the registry, reads/writes agent files, and prints the report.
 */

export interface ModelsContext {
  readonly repoRoot: string;
  readonly catalogPath: string;
}

type Writer = (line: string) => void;

function agentPath(repoRoot: string, agentName: string): string {
  return join(defaultAgentsDir(repoRoot), `${agentName}.agent.md`);
}

function variantPath(repoRoot: string, agentName: string, variant: EscalationVariant): string {
  return join(defaultAgentsDir(repoRoot), `${agentName}.${variant.suffix}.agent.md`);
}

function variantContent(baseContent: string, agentName: string, variant: EscalationVariant): string {
  const withModel = replaceModelLine(baseContent, variant.models);
  return replaceNameLine(withModel, `${agentName}.${variant.suffix}`);
}

function currentModelsFor(repoRoot: string, agentName: string): string[] | null {
  try {
    return parseModelLine(readAgentFile(agentPath(repoRoot, agentName)));
  } catch {
    return null;
  }
}

/** `cc models` — every tier's registered models, their status, candidates, and agent drift. */
export function modelsReport(ctx: ModelsContext, write: Writer): number {
  const registry = loadRegistry(defaultRegistryPath(ctx.repoRoot));
  const catalogue = loadCatalog(ctx.catalogPath);

  for (const report of resolveTiers(registry, catalogue)) {
    write(`## ${report.tier}`);
    for (const model of report.registered) {
      const price = model.outputPrice === null ? '' : ` (in=${model.inputPrice}, out=${model.outputPrice})`;
      write(`  ${model.name}: ${model.status}${price}`);
    }
    if (report.candidates.length > 0) {
      write(`  candidates: ${report.candidates.map((c) => c.name).join(', ')}`);
    }
  }

  for (const agentName of Object.keys(registry.agents)) {
    const status = agentDriftStatus(registry, agentName, currentModelsFor(ctx.repoRoot, agentName));
    write(`${agentName}: ${status}`);
  }

  return 0;
}

/** `cc models pick <role> [--escalate=N]` — one model line, or a DECIDE with candidates. */
export function modelsPick(ctx: ModelsContext, role: string, escalate: number, write: Writer): number {
  const registry = loadRegistry(defaultRegistryPath(ctx.repoRoot));
  const catalogue = loadCatalog(ctx.catalogPath);
  const result = pick(registry, catalogue, role, escalate);

  if (result.kind === 'model') {
    write(`${result.name} (copilot)`);
    return 0;
  }

  write(`DECIDE: ${result.tier}`);
  for (const candidate of result.candidates) {
    write(`  ${candidate.name} (in=${candidate.inputPrice}, out=${candidate.outputPrice})`);
  }
  return 2;
}

/**
 * A headless worker cannot take a runtime model override (`code chat --help` has no such
 * flag), so escalating it means dispatching a *different agent file*. This keeps one variant
 * file per tier above the agent's base tier in sync with the registry, alongside its primary.
 * Returns whether any variant was out of sync.
 */
function applyVariants(
  opts: { readonly repoRoot: string; readonly check: boolean },
  registry: Registry,
  agentName: string,
  baseContent: string,
): boolean {
  let drifted = false;
  for (const variant of escalationVariants(registry, agentName)) {
    const path = variantPath(opts.repoRoot, agentName, variant);
    const expected = variantContent(baseContent, agentName, variant);
    let current: string | null;
    try {
      current = readAgentFile(path);
    } catch {
      current = null;
    }
    if (current === expected) {
      continue;
    }
    drifted = true;
    if (!opts.check) {
      writeAgentFile(path, expected);
    }
  }
  return drifted;
}

/** `cc models apply [--check]` — stamps agent frontmatter from the registry, or checks for drift. */
export function modelsApply(repoRoot: string, check: boolean): number {
  const registry = loadRegistry(defaultRegistryPath(repoRoot));
  const errors = validateRegistry(registry);
  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`${error}\n`);
    }
    return 1;
  }

  let drifted = false;
  for (const [agentName, tierName] of Object.entries(registry.agents)) {
    const tier = registry.tiers.find((t) => t.name === tierName);
    if (tier === undefined) {
      continue;
    }
    const path = agentPath(repoRoot, agentName);
    let content: string;
    try {
      content = readAgentFile(path);
    } catch {
      continue;
    }
    if (applyVariants({ repoRoot, check }, registry, agentName, content)) {
      drifted = true;
    }
    const current = parseModelLine(content);
    if (agentDriftStatus(registry, agentName, current) !== 'drift') {
      continue;
    }
    drifted = true;
    if (!check) {
      writeAgentFile(path, replaceModelLine(content, tier.models));
    }
  }

  return drifted && check ? 1 : 0;
}
