/**
 * HTML shell and escaping for the dashboard.
 *
 * Every value that reaches a page comes from Jira or GitHub — PR titles, branch names, ticket
 * summaries — none of which this project controls. All of it is escaped on the way out.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for interpolation into HTML, including attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

export interface NavItem {
  readonly path: string;
  readonly label: string;
}

export const NAV: readonly NavItem[] = [
  { path: '/', label: 'Needs a push' },
  { path: '/tickets', label: 'Tickets' },
  { path: '/prs', label: 'Pull requests' },
  { path: '/sprint', label: 'Sprint' },
  { path: '/activity', label: 'Activity' },
];

export function layout(title: string, activePath: string, body: string): string {
  const nav = NAV.map((item) => {
    const current = item.path === activePath ? ' class="current"' : '';
    return `<a href="${escapeHtml(item.path)}"${current}>${escapeHtml(item.label)}</a>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · central command</title>
<style>${STYLE}</style>
</head>
<body>
<nav>${nav}</nav>
<main>${body}</main>
</body>
</html>`;
}

/** A section heading with the count of what is under it. */
export function section(heading: string, count: number, body: string): string {
  return `<section><h2>${escapeHtml(heading)} <span class="count">${count}</span></h2>${body}</section>`;
}

export function empty(message: string): string {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}

export function link(href: string, text: string): string {
  // rel=noreferrer keeps ticket and PR URLs out of the Referer header sent to third parties.
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

export interface TableColumn {
  readonly key: string;
  readonly label: string;
}

export interface TableRow {
  readonly cells: readonly string[];
  readonly values: readonly string[];
}

export interface TableQuery {
  readonly path: string;
  readonly sort: string | null;
  readonly direction: 'asc' | 'desc';
  readonly group: string | null;
}

export function table(
  columns: readonly TableColumn[],
  rows: readonly TableRow[],
  query: TableQuery = { path: '/', sort: null, direction: 'asc', group: null },
): string {
  const sortIndex = columnIndex(columns, query.sort);
  const groupIndex = columnIndex(columns, query.group);
  const ordered = orderRows(rows, sortIndex, query.direction, groupIndex);
  const head = columns.map((column) => header(column, query)).join('');
  const body = groupedBody(ordered, columns.length, groupIndex);
  const grouping = groupControls(columns, query);
  return `${grouping}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function columnIndex(columns: readonly TableColumn[], key: string | null): number | null {
  if (key === null) {
    return null;
  }
  const index = columns.findIndex((column) => column.key === key);
  return index === -1 ? null : index;
}

function orderRows(
  rows: readonly TableRow[],
  sortIndex: number | null,
  direction: 'asc' | 'desc',
  groupIndex: number | null,
): readonly TableRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const groupResult = compareValues(left.row, right.row, groupIndex);
      if (groupResult !== 0) {
        return groupResult;
      }
      const sortResult = compareValues(left.row, right.row, sortIndex);
      return sortResult === 0 ? left.index - right.index : sortResult * (direction === 'asc' ? 1 : -1);
    })
    .map(({ row }) => row);
}

function compareValues(left: TableRow, right: TableRow, index: number | null): number {
  if (index === null) {
    return 0;
  }
  return valueAt(left.values, index).localeCompare(valueAt(right.values, index), undefined, {
    sensitivity: 'base',
  });
}

function valueAt(values: readonly string[], index: number): string {
  return values[index] ?? '';
}

function header(column: TableColumn, query: TableQuery): string {
  const direction = query.sort === column.key && query.direction === 'asc' ? 'desc' : 'asc';
  const href = queryUrl(query, { sort: column.key, direction });
  const marker = query.sort === column.key ? (query.direction === 'asc' ? ' ↑' : ' ↓') : '';
  return `<th><a href="${escapeHtml(href)}">${escapeHtml(column.label)}${marker}</a></th>`;
}

function groupControls(columns: readonly TableColumn[], query: TableQuery): string {
  const activeColumn = columns.find((column) => column.key === query.group);
  const label = activeColumn === undefined
    ? '<span>Group by:</span>'
    : `<span>Grouped by <strong>${escapeHtml(activeColumn.label)}</strong>:</span>`;
  const links = columns.map((column) => {
    const active = query.group === column.key;
    const href = queryUrl(query, { group: active ? null : column.key });
    const label = active ? `Ungroup ${column.label}` : column.label;
    return `<a class="pill${active ? ' current' : ''}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  });
  return `<div class="table-tools">${label}${links.join('')}</div>`;
}

function queryUrl(query: TableQuery, changes: { sort?: string | null; direction?: string; group?: string | null }): string {
  const params = new URLSearchParams();
  const sort = changes.sort === undefined ? query.sort : changes.sort;
  const direction = changes.direction ?? query.direction;
  const group = changes.group === undefined ? query.group : changes.group;
  if (sort !== null) params.set('sort', sort);
  if (direction !== 'asc' || sort !== null) params.set('direction', direction);
  if (group !== null) params.set('group', group);
  const suffix = params.toString();
  return suffix === '' ? query.path : `${query.path}?${suffix}`;
}

function groupedBody(rows: readonly TableRow[], columnCount: number, groupIndex: number | null): string {
  let previousGroup: string | null = null;
  return rows.map((row) => {
    const group = groupIndex === null ? null : valueAt(row.values, groupIndex);
    const heading = group !== null && group !== previousGroup
      ? `<tr class="group-heading"><th colspan="${columnCount}">${escapeHtml(group)}</th></tr>`
      : '';
    previousGroup = group;
    return `${heading}<tr>${row.cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
  }).join('');
}

const STYLE = `
:root { color-scheme: light dark; --edge: color-mix(in srgb, currentColor 15%, transparent); }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
nav { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: .35rem .5rem;
  padding: .7rem 2rem; border-bottom: 1px solid var(--edge); background: Canvas;
  box-shadow: 0 2px 12px color-mix(in srgb, CanvasText 8%, transparent); }
nav a { text-decoration: none; color: inherit; opacity: .6; }
nav a { padding: .35rem .65rem; border-radius: 999px; }
nav a.current, nav a:hover { opacity: 1; }
nav a.current { background: color-mix(in srgb, currentColor 12%, transparent); }
main { padding: 2rem; max-width: 72rem; }
h1 { font-size: 1.5rem; margin: 0 0 1.5rem; }
h2 { font-size: 1rem; margin: 2rem 0 .75rem; font-weight: 600; }
.count { opacity: .5; font-weight: 400; }
.empty { opacity: .6; }
table { border-collapse: collapse; width: 100%; }
th { text-align: left; font-weight: 600; opacity: .6; padding: .4rem .75rem .4rem 0; }
th a { color: inherit; }
td { padding: .4rem .75rem .4rem 0; border-top: 1px solid var(--edge); vertical-align: top; }
.table-tools { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; margin: .5rem 0; }
.table-tools > span { opacity: .6; font-size: .8rem; }
.group-heading th { padding-top: 1rem; border-top: 1px solid var(--edge); opacity: .8; }
.stall { border-top: 1px solid var(--edge); padding: .6rem 0; }
.move { opacity: .75; }
.sev { font-size: .75rem; padding: .1rem .4rem; border-radius: 3px; border: 1px solid var(--edge); }
.sev-high { color: #c0392b; border-color: currentColor; }
.sev-medium { color: #b9770e; border-color: currentColor; }
.sev-low { color: #2471a3; border-color: currentColor; }
.mono { font-family: ui-monospace, monospace; font-size: .85em; }
.age { opacity: .5; white-space: nowrap; }
.act { display: inline-block; margin-top: .4rem; }
.act button { font: inherit; padding: .25rem .8rem; border-radius: 4px; cursor: pointer;
  border: 1px solid var(--edge); background: transparent; }
.act button:hover { border-color: currentColor; }
.card { border: 1px solid var(--edge); border-radius: 6px; padding: 1.5rem; max-width: 44rem; }
.card.ok { border-left: 3px solid #1e8449; }
.card.refused { border-left: 3px solid #c0392b; }
.filters { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1.5rem; }
.filter-row { display: flex; flex-wrap: wrap; gap: .4rem; }
.pill { display: inline-flex; align-items: center; gap: .3rem; text-decoration: none; color: inherit;
  font-size: .8rem; padding: .25rem .7rem; border-radius: 999px; border: 1px solid var(--edge);
  opacity: .7; }
.pill:hover { opacity: 1; border-color: currentColor; }
.pill.current { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent);
  border-color: currentColor; font-weight: 600; }
.pill .count { opacity: .6; }
`;
