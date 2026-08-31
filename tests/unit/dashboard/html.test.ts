import { describe, expect, it } from 'vitest';
import { table } from '../../../dashboard/html.ts';

describe('dashboard tables', () => {
  it('renders sortable column links and preserves the table path', () => {
    const body = table(
      [
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
      ],
      [
        { cells: ['Beta', 'Open'], values: ['Beta', 'Open'] },
        { cells: ['Alpha', 'Done'], values: ['Alpha', 'Done'] },
      ],
      { path: '/tickets', sort: 'name', direction: 'asc', group: null },
    );

    expect(body).toContain('href="/tickets?sort=name&amp;direction=desc"');
    expect(body).toContain('href="/tickets?sort=status&amp;direction=asc"');
    expect(body.indexOf('Alpha')).toBeLessThan(body.indexOf('Beta'));
  });

  it('groups rows under escaped group headings', () => {
    const body = table(
      [
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
      ],
      [
        { cells: ['Open', 'Alpha'], values: ['Open', 'Alpha'] },
        { cells: ['Done', 'Beta'], values: ['Done', 'Beta'] },
        { cells: ['Open', 'Gamma'], values: ['Open', 'Gamma'] },
      ],
      { path: '/tickets', sort: null, direction: 'asc', group: 'status' },
    );

    expect(body).toContain('Grouped by <strong>Status</strong>');
    expect(body).toContain('<th colspan="2">Done</th>');
    expect(body).toContain('<th colspan="2">Open</th>');
    expect(body.indexOf('<th colspan="2">Done</th>')).toBeLessThan(
      body.indexOf('<th colspan="2">Open</th>'),
    );
  });
});
