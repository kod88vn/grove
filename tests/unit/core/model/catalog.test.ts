import { describe, expect, it } from 'vitest';
import { parseCatalog } from '../../../../src/core/model/catalog.ts';

describe('parseCatalog', () => {
  it('converts input/output price from the raw per-batch integer to AIC per 1M tokens', () => {
    const raw = [
      {
        name: 'Claude Opus 5.5',
        billing: { token_prices: { input_price: 400000000000, output_price: 2000000000000 } },
      },
    ];
    expect(parseCatalog(raw)).toEqual([{ name: 'Claude Opus 5.5', inputPrice: 400, outputPrice: 2000 }]);
  });

  it('skips an entry with no billing information rather than throwing', () => {
    const raw = [{ name: 'Trajectory Compaction (Preview)' }];
    expect(parseCatalog(raw)).toEqual([]);
  });

  it('skips an entry whose prices are not numbers', () => {
    const raw = [
      { name: 'Broken', billing: { token_prices: { input_price: 'lots', output_price: 1 } } },
    ];
    expect(parseCatalog(raw)).toEqual([]);
  });

  it('returns an empty catalogue for anything that is not an array', () => {
    expect(parseCatalog({ not: 'an array' })).toEqual([]);
  });
});
