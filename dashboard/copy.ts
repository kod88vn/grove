/**
 * Copying a set of links out of a table.
 *
 * The rest of the dashboard is deliberately script-free — every filter and sort is a plain
 * `<a href>` so the page works cold. Writing to the clipboard is the one thing that cannot be
 * done from the server, so this is the only client script, it is served from a fixed path
 * rather than inlined (so the CSP stays `script-src 'self'` instead of `unsafe-inline`), and
 * it reads nothing but the values the server already put in the markup.
 */

/** Path the script is served from, and the `src` the layout points at. */
export const COPY_SCRIPT_PATH = '/copy.js';

/** A row is copyable when the page gave it a link. Rows without one get a disabled checkbox. */
export interface CopyCell {
  readonly url: string | null;
  readonly label: string;
}

/** The header cell: a checkbox that selects or clears every row in this table. */
export function copyHeaderCell(): string {
  return '<th class="pick"><input type="checkbox" data-copy-all aria-label="Select all links"></th>';
}

export function copyRowCell(cell: CopyCell, escape: (value: string) => string): string {
  if (cell.url === null) {
    return '<td class="pick"></td>';
  }
  return `<td class="pick"><input type="checkbox" class="pick-row" value="${escape(cell.url)}" aria-label="${escape(`Select ${cell.label}`)}"></td>`;
}

/**
 * The button, plus the live region that reports what happened.
 *
 * `type="button"` matters: these tables sit on pages that also carry action forms, and a bare
 * button inside a form submits it.
 */
export function copyButton(): string {
  return (
    '<button type="button" class="copy" data-copy>Copy links</button>' +
    '<span class="copy-said" data-copy-said role="status" aria-live="polite"></span>'
  );
}

/**
 * The client script, verbatim.
 *
 * Kept as one string rather than a separate `.js` file because the dashboard has no build step
 * and no static directory; adding either for twenty lines would be the larger change.
 */
export const COPY_SCRIPT = `"use strict";
document.addEventListener("click", function (event) {
  var target = event.target;
  if (!(target instanceof HTMLElement)) return;
  var scope = target.closest(".copy-table");
  if (scope === null) return;
  if (target.hasAttribute("data-copy-all")) {
    toggleAll(scope, target.checked === true);
    return;
  }
  if (target.hasAttribute("data-copy")) {
    copy(scope);
  }
});

function toggleAll(scope, checked) {
  boxes(scope).forEach(function (box) {
    box.checked = checked;
  });
}

function boxes(scope) {
  return Array.prototype.slice.call(scope.querySelectorAll("input.pick-row"));
}

/** With nothing ticked, copy every link in the table — the common case is "all of them". */
function selected(scope) {
  var all = boxes(scope);
  var ticked = all.filter(function (box) {
    return box.checked;
  });
  return (ticked.length === 0 ? all : ticked).map(function (box) {
    return box.value;
  });
}

function copy(scope) {
  var links = selected(scope);
  if (links.length === 0) {
    say(scope, "Nothing to copy");
    return;
  }
  var text = links.join("\\n");
  if (navigator.clipboard === undefined) {
    say(scope, "Clipboard unavailable");
    return;
  }
  navigator.clipboard.writeText(text).then(
    function () {
      say(scope, "Copied " + links.length + (links.length === 1 ? " link" : " links"));
    },
    function () {
      say(scope, "Copy refused by the browser");
    },
  );
}

function say(scope, message) {
  var said = scope.querySelector("[data-copy-said]");
  if (said !== null) said.textContent = message;
}
`;
