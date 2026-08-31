import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, table } from '../../../dashboard/html.ts';

describe('local time formatting', () => {
  const originalTz = process.env['TZ'];

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env['TZ'];
    } else {
      process.env['TZ'] = originalTz;
    }
  });

  it('renders a UTC instant in a zone behind UTC as the previous local day', () => {
    process.env['TZ'] = 'America/Los_Angeles';

    // 03:00 UTC on Sept 1 is 20:00 the previous day in Los Angeles (UTC-7 in September).
    expect(formatDate('2026-09-01T03:00:00Z')).toBe('2026-08-31');
    expect(formatDateTime('2026-09-01T03:00:00Z')).toBe('2026-08-31 20:00');
  });

  it('renders the same instant differently in a zone ahead of UTC', () => {
    process.env['TZ'] = 'Asia/Tokyo';

    // 03:00 UTC is 12:00 the same day in Tokyo (UTC+9), unlike the Los Angeles case above.
    expect(formatDate('2026-09-01T03:00:00Z')).toBe('2026-09-01');
    expect(formatDateTime('2026-09-01T03:00:00Z')).toBe('2026-09-01 12:00');
  });
});

describe('dashboard tables', () => {
  beforeEach(() => {
    process.env['TZ'] = 'UTC';
  });

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

  it('adds no copy control to a table whose rows carry no link', () => {
    const body = table(
      [{ key: 'name', label: 'Name' }],
      [{ cells: ['Alpha'], values: ['Alpha'] }],
      { path: '/activity', sort: null, direction: 'asc', group: null },
    );

    expect(body).not.toContain('data-copy');
    expect(body).not.toContain('class="pick"');
  });

  it('renders a checkbox holding the link, and a copy button, when rows carry one', () => {
    const body = table(
      [{ key: 'name', label: 'Name' }],
      [
        { cells: ['Alpha'], values: ['Alpha'], copy: { url: 'https://x.invalid/WS-1', label: 'WS-1' } },
        { cells: ['Beta'], values: ['Beta'], copy: { url: 'https://x.invalid/WS-2', label: 'WS-2' } },
      ],
      { path: '/tickets', sort: null, direction: 'asc', group: null },
    );

    expect(body).toContain('<div class="copy-table">');
    expect(body).toContain('data-copy-all');
    expect(body).toContain('data-copy>Copy links</button>');
    expect(body).toContain('value="https://x.invalid/WS-1"');
    expect(body).toContain('value="https://x.invalid/WS-2"');
  });

  it('escapes a link before putting it in the checkbox value', () => {
    // A URL is data from Jira or GitHub like any other; it is not exempt from escaping.
    const body = table(
      [{ key: 'name', label: 'Name' }],
      [
        {
          cells: ['Alpha'],
          values: ['Alpha'],
          copy: { url: 'https://x.invalid/"><script>alert(1)</script>', label: 'WS-1' },
        },
      ],
      { path: '/tickets', sort: null, direction: 'asc', group: null },
    );

    expect(body).not.toContain('<script>alert(1)</script>');
    expect(body).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('widens the group heading to cover the select column', () => {
    // Miss this and the grouped heading stops short, leaving a ragged first column.
    const body = table(
      [
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
      ],
      [
        { cells: ['Open', 'Alpha'], values: ['Open', 'Alpha'], copy: { url: 'https://x.invalid/1', label: '1' } },
        { cells: ['Done', 'Beta'], values: ['Done', 'Beta'], copy: { url: 'https://x.invalid/2', label: '2' } },
      ],
      { path: '/tickets', sort: null, direction: 'asc', group: 'status' },
    );

    expect(body).toContain('<th colspan="3">Open</th>');
  });

  it('leaves the select cell empty for a row with no link', () => {
    const body = table(
      [{ key: 'name', label: 'Name' }],
      [
        { cells: ['Alpha'], values: ['Alpha'], copy: { url: 'https://x.invalid/1', label: '1' } },
        { cells: ['Beta'], values: ['Beta'], copy: { url: null, label: '2' } },
      ],
      { path: '/tickets', sort: null, direction: 'asc', group: null },
    );

    expect(body).toContain('<td class="pick"></td>');
    expect(body.match(/class="pick-row"/g) ?? []).toHaveLength(1);
  });
});
