/**
 * Parses the raw `models.json` catalogue shape into the flat list the resolver needs.
 *
 * The catalogue is not our data — it comes from the Copilot Chat debug logs — so a malformed
 * or priceless entry is skipped rather than treated as a fatal error. A preview model with no
 * billing information is common and not a bug in this code.
 *
 * The raw file also lists entries no chat agent could ever be pointed at: embeddings/completion
 * models (`capabilities.type !== 'chat'`), models hidden from the picker
 * (`model_picker_enabled !== true`), and the same display name repeated across several dated
 * IDs (e.g. three "GPT-4o" entries). All three are dropped here so every other reader of the
 * catalogue — `resolveTiers`, `pick`, the CLI report — only ever sees models a user could
 * actually select, one entry per name.
 */

export interface CatalogueModel {
  readonly name: string;
  /** AIC per 1M input tokens. */
  readonly inputPrice: number;
  /** AIC per 1M output tokens. */
  readonly outputPrice: number;
}

const RAW_UNITS_PER_AIC_PER_MILLION = 1_000_000_000;

function parseCatalogEntry(raw: unknown): CatalogueModel | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const entry = raw as Record<string, unknown>;
  if (typeof entry.name !== 'string') {
    return null;
  }
  const capabilities = entry.capabilities as Record<string, unknown> | undefined;
  if (capabilities?.type !== 'chat') {
    return null;
  }
  if (entry.model_picker_enabled !== true) {
    return null;
  }
  const billing = entry.billing as Record<string, unknown> | undefined;
  const tokenPrices = billing?.token_prices as Record<string, unknown> | undefined;
  const inputRaw = tokenPrices?.input_price;
  const outputRaw = tokenPrices?.output_price;
  if (typeof inputRaw !== 'number' || typeof outputRaw !== 'number') {
    return null;
  }
  return {
    name: entry.name,
    inputPrice: inputRaw / RAW_UNITS_PER_AIC_PER_MILLION,
    outputPrice: outputRaw / RAW_UNITS_PER_AIC_PER_MILLION,
  };
}

/** Parses a raw catalogue JSON value. Never throws — an unusable entry is dropped, not fatal. */
export function parseCatalog(raw: unknown): CatalogueModel[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const models: CatalogueModel[] = [];
  const seenNames = new Set<string>();
  for (const entry of raw) {
    const parsed = parseCatalogEntry(entry);
    if (parsed !== null && !seenNames.has(parsed.name)) {
      seenNames.add(parsed.name);
      models.push(parsed);
    }
  }
  return models;
}
