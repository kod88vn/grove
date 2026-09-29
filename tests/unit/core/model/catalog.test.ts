import { describe, expect, it } from 'vitest';
import { parseCatalog } from '../../../../src/core/model/catalog.ts';

function chatModel(name: string, outputPrice = 2000000000000): Record<string, unknown> {
  return {
    name,
    capabilities: { type: 'chat' },
    model_picker_enabled: true,
    billing: { token_prices: { input_price: 400000000000, output_price: outputPrice } },
  };
}

describe('parseCatalog', () => {
  it('converts input/output price from the raw per-batch integer to AIC per 1M tokens', () => {
    const raw = [chatModel('Claude Opus 5.5')];
    expect(parseCatalog(raw)).toEqual([{ name: 'Claude Opus 5.5', inputPrice: 400, outputPrice: 2000 }]);
  });

  it('skips an entry with no billing information rather than throwing', () => {
    const raw = [{ name: 'Trajectory Compaction (Preview)', capabilities: { type: 'chat' }, model_picker_enabled: true }];
    expect(parseCatalog(raw)).toEqual([]);
  });

  it('skips an entry whose prices are not numbers', () => {
    const raw = [
      {
        name: 'Broken',
        capabilities: { type: 'chat' },
        model_picker_enabled: true,
        billing: { token_prices: { input_price: 'lots', output_price: 1 } },
      },
    ];
    expect(parseCatalog(raw)).toEqual([]);
  });

  it('returns an empty catalogue for anything that is not an array', () => {
    expect(parseCatalog({ not: 'an array' })).toEqual([]);
  });

  it('skips a non-chat entry (e.g. an embeddings model) even when priced and picker-enabled', () => {
    const raw = [{ ...chatModel('Embedding V3 small'), capabilities: { type: 'embeddings' } }];
    expect(parseCatalog(raw)).toEqual([]);
  });

  it('skips a chat model that is not model-picker-enabled', () => {
    const raw = [{ ...chatModel('GPT-4o'), model_picker_enabled: false }];
    expect(parseCatalog(raw)).toEqual([]);
  });

  it('dedupes entries with the same display name, keeping the first', () => {
    const raw = [chatModel('GPT-4o', 550000000000), chatModel('GPT-4o', 999000000000)];
    expect(parseCatalog(raw)).toEqual([{ name: 'GPT-4o', inputPrice: 400, outputPrice: 550 }]);
  });
});
