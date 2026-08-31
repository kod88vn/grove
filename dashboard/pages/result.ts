import type { ActionResult } from '../actions.ts';
import { escapeHtml, layout } from '../html.ts';

/**
 * What happened after a button press.
 *
 * A refusal is shown as plainly as a success. The reason a guard declined is the most useful
 * thing this system can tell me — it is usually the next piece of work.
 */
export function resultPage(result: ActionResult): string {
  const heading = result.ok ? 'Done' : 'Not done';
  return layout(
    heading,
    '',
    `<section class="card ${result.ok ? 'ok' : 'refused'}">
      <h1>${heading}</h1>
      <p class="mono">${escapeHtml(result.message)}</p>
      <p><a href="/">Back to what needs a push</a></p>
    </section>`,
  );
}
