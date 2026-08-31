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
<title>${escapeHtml(title)} · bot</title>
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

export function table(headers: readonly string[], rows: readonly string[][]): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const STYLE = `
:root { color-scheme: light dark; --edge: color-mix(in srgb, currentColor 15%, transparent); }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
nav { display: flex; gap: 1.5rem; padding: 1rem 2rem; border-bottom: 1px solid var(--edge); }
nav a { text-decoration: none; color: inherit; opacity: .6; }
nav a.current, nav a:hover { opacity: 1; }
main { padding: 2rem; max-width: 72rem; }
h1 { font-size: 1.5rem; margin: 0 0 1.5rem; }
h2 { font-size: 1rem; margin: 2rem 0 .75rem; font-weight: 600; }
.count { opacity: .5; font-weight: 400; }
.empty { opacity: .6; }
table { border-collapse: collapse; width: 100%; }
th { text-align: left; font-weight: 600; opacity: .6; padding: .4rem .75rem .4rem 0; }
td { padding: .4rem .75rem .4rem 0; border-top: 1px solid var(--edge); vertical-align: top; }
.stall { border-top: 1px solid var(--edge); padding: .6rem 0; }
.move { opacity: .75; }
.sev { font-size: .75rem; padding: .1rem .4rem; border-radius: 3px; border: 1px solid var(--edge); }
.sev-high { color: #c0392b; border-color: currentColor; }
.sev-medium { color: #b9770e; border-color: currentColor; }
.mono { font-family: ui-monospace, monospace; font-size: .85em; }
.age { opacity: .5; white-space: nowrap; }
`;
