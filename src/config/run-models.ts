import { basename, dirname, join, join as pathJoin } from 'node:path';
import { readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { readAgentFile, writeAgentFile } from '../connectors/agent-frontmatter-file.ts';
import { loadCatalog } from '../connectors/model-catalog-file.ts';
import { loadRegistry } from '../connectors/model-registry-file.ts';
import { agentDriftStatus } from '../core/model/drift.ts';
import { singleModelVariants, type EscalationVariant } from '../core/model/escalation.ts';
import { parseModelLine, replaceModelLine, replaceNameLine } from '../core/model/frontmatter.ts';
import { pick, resolveRole, resolveTiers } from '../core/model/resolver.ts';
import { latestSessionModelId, foldSessionJsonl } from '../core/model/session.ts';
import { resolveSelf, type SelectedCatalogModel } from '../core/model/self.ts';
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

function singleVariantPath(repoRoot: string, agentName: string, variant: EscalationVariant): string {
  return join(defaultAgentsDir(repoRoot), `${agentName}.${variant.suffix}.agent.md`);
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
      write('  candidates:');
      for (const candidate of report.candidates) {
        write(`    ${candidate.name} (in=${candidate.inputPrice}, out=${candidate.outputPrice})`);
      }
    }
  }

  for (const agentName of Object.keys(registry.agents)) {
    const status = agentDriftStatus(registry, agentName, currentModelsFor(ctx.repoRoot, agentName));
    write(`${agentName}: ${status}`);
  }

  return 0;
}

/**
 * `cc models pick <role> [--escalate=N]` — one model line, or a DECIDE with candidates.
 *
 * Validates the role against the registry before calling the pure resolver: `pick` throws on
 * an unknown role (a programmer error from its point of view), but a typo'd role on the CLI is
 * a normal user mistake and must never surface as an uncaught stack trace.
 */
export function modelsPick(ctx: ModelsContext, role: string, escalate: number, write: Writer): number {
  const registry = loadRegistry(defaultRegistryPath(ctx.repoRoot));
  if (resolveRole(registry, role) === null) {
    const known = [...Object.keys(registry.agents), ...registry.tiers.map((t) => t.name)];
    process.stderr.write(`unknown role: ${role} (known: ${known.join(', ')})\n`);
    return 1;
  }
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

function sessionPath(debugLog: string): string {
  const workspaceStorage = dirname(dirname(dirname(debugLog)));
  return pathJoin(workspaceStorage, 'chatSessions', `${basename(debugLog)}.jsonl`);
}

function selectedCatalog(path: string): SelectedCatalogModel[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): SelectedCatalogModel[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const value = entry as Record<string, unknown>;
    if (typeof value.id !== 'string' || typeof value.name !== 'string') return [];
    const billing = value.billing as Record<string, unknown> | undefined;
    const prices = billing?.token_prices as Record<string, unknown> | undefined;
    const input = typeof prices?.input_price === 'number' ? prices.input_price / 1_000_000_000 : null;
    const output = typeof prices?.output_price === 'number' ? prices.output_price / 1_000_000_000 : null;
    return [{ id: value.id, name: value.name, inputPrice: input, outputPrice: output }];
  });
}

/** Reports the model selected in the persisted session, not the backend-served model. */
export function modelsSelf(
  ctx: ModelsContext,
  debugLog: string,
  requestedTier: string,
  write: Writer,
): number {
  const registry = loadRegistry(defaultRegistryPath(ctx.repoRoot));
  const tier = resolveRole(registry, requestedTier);
  if (tier === null) {
    process.stderr.write(`unknown tier: ${requestedTier}\n`);
    return 1;
  }
  const path = sessionPath(debugLog);
  let state: unknown;
  try {
    state = foldSessionJsonl(readFileSync(path, 'utf8').split('\n'));
  } catch {
    process.stderr.write(`session not found: ${path}\n`);
    return 1;
  }
  const modelId = latestSessionModelId(state);
  if (modelId === null) {
    process.stderr.write(`session contains no selected model: ${path}\n`);
    return 1;
  }
  const report = resolveSelf(registry, selectedCatalog(ctx.catalogPath), modelId, tier);
  const model = report.model;
  const label = model?.name ?? modelId;
  const cost = model?.outputPrice === null || model === null ? 'unknown' : `out=${model.outputPrice}`;
  write(`selected model: ${label} (${modelId}; ${cost})`);
  write(`selected tier: ${report.tier ?? 'unknown'}; recommendation: ${report.recommendation} (${report.recommendationTier})`);
  if (report.higherTier) write(`warning: selected model is above requested ${tier} tier`);
  if (report.exceedsCeiling) write(`warning: selected model output price exceeds ${tier} tier price band`);
  if (model === null || model.outputPrice === null) write('warning: selected model cost is unknown');
  return 0;
}

function applySingleModelVariants(
  opts: { readonly repoRoot: string; readonly check: boolean },
  registry: Registry,
  agentName: string,
  baseContent: string,
): boolean {
  let drifted = false;
  for (const variant of singleModelVariants(registry, agentName)) {
    const path = singleVariantPath(opts.repoRoot, agentName, variant);
    const expected = replaceNameLine(replaceModelLine(baseContent, variant.models), `${agentName}.${variant.suffix}`);
    let current: string | null;
    try { current = readAgentFile(path); } catch { current = null; }
    if (current === expected) continue;
    drifted = true;
    if (!opts.check) writeAgentFile(path, expected);
  }
  return drifted;
}

/** `cc models apply [--check]` — stamps agent frontmatter from the registry, or checks for drift. */
function applyAgent(
  opts: { readonly repoRoot: string; readonly check: boolean },
  registry: Registry,
  agentName: string,
  tierName: string,
): boolean {
  const tier = registry.tiers.find((entry) => entry.name === tierName);
  if (tier === undefined) return false;
  const path = agentPath(opts.repoRoot, agentName);
  let content: string;
  try { content = readAgentFile(path); } catch { return false; }
  let drifted = applySingleModelVariants(opts, registry, agentName, content);
  const expected = new Set([
    ...singleModelVariants(registry, agentName).map((variant) => `${agentName}.${variant.suffix}.agent.md`),
  ]);
  for (const file of readdirSync(defaultAgentsDir(opts.repoRoot))) {
    const isStaleEscalation = file.startsWith(`${agentName}.t`);
    const isStaleSingleModel = file.startsWith(`${agentName}.m-`);
    if ((!isStaleEscalation && !isStaleSingleModel) || !file.endsWith('.agent.md') || expected.has(file)) continue;
    drifted = true;
    if (!opts.check) unlinkSync(join(defaultAgentsDir(opts.repoRoot), file));
  }
  if (agentDriftStatus(registry, agentName, parseModelLine(content)) === 'drift') {
    drifted = true;
    if (!opts.check) writeAgentFile(path, replaceModelLine(content, tier.models));
  }
  return drifted;
}

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
    drifted = applyAgent({ repoRoot, check }, registry, agentName, tierName) || drifted;
  }

  return drifted && check ? 1 : 0;
}
