import type { CatalogueModel } from './catalog.ts';
import { pick } from './resolver.ts';
import type { Registry, TierName } from './tiers.ts';

export interface SelectedCatalogModel {
  readonly id: string;
  readonly name: string;
  readonly inputPrice: number | null;
  readonly outputPrice: number | null;
}

export interface SelfReport {
  readonly modelId: string;
  readonly model: SelectedCatalogModel | null;
  readonly tier: TierName | null;
  readonly recommendation: string;
  readonly recommendationTier: TierName;
  readonly higherTier: boolean;
  readonly exceedsCeiling: boolean;
}

function modelName(modelId: string): string {
  return modelId.startsWith('copilot/') ? modelId.slice('copilot/'.length) : modelId;
}

function tierFor(registry: Registry, name: string): TierName | null {
  for (const tier of registry.tiers) {
    if (tier.models.includes(name)) return tier.name;
  }
  return null;
}

function catalogueModels(catalogue: readonly SelectedCatalogModel[]): CatalogueModel[] {
  return catalogue
    .filter((model): model is SelectedCatalogModel & { inputPrice: number; outputPrice: number } =>
      model.inputPrice !== null && model.outputPrice !== null,
    )
    .map((model) => ({ name: model.name, inputPrice: model.inputPrice, outputPrice: model.outputPrice }));
}

export function resolveSelf(
  registry: Registry,
  catalogue: readonly SelectedCatalogModel[],
  modelId: string,
  requestedTier: TierName,
): SelfReport {
  const selectedName = modelName(modelId);
  const model = catalogue.find((candidate) => candidate.id === selectedName) ?? null;
  const resolvedTier = model === null ? null : tierFor(registry, model.name);
  const recommendationResult = pick(registry, catalogueModels(catalogue), requestedTier, 0);
  const recommendation = recommendationResult.kind === 'model'
    ? recommendationResult.name
    : recommendationResult.candidates[0]?.name ?? 'none available';
  const ordered = [...registry.tiers].sort((a, b) => a.rank - b.rank);
  const requested = ordered.find((tier) => tier.name === requestedTier);
  const selected = resolvedTier === null ? null : ordered.find((tier) => tier.name === resolvedTier);
  const ceiling = requested?.maxOutputPrice ?? null;
  const exceedsCeiling = model?.outputPrice != null && ceiling != null && model.outputPrice > ceiling;
  return {
    modelId,
    model,
    tier: resolvedTier,
    recommendation,
    recommendationTier: requestedTier,
    higherTier: selected != null && requested !== undefined && selected.rank > requested.rank,
    exceedsCeiling,
  };
}
