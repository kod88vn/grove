import type { ActionPayload } from '../core/model/action.ts';
import type { JiraTransition } from '../connectors/jira/client.ts';
import type { JiraClient } from '../connectors/jira/client.ts';

/**
 * Build a resolve action from the transition metadata Jira reports right now.
 *
 * The transition id and its required fields are per-workflow screen configuration and change
 * without announcement. A remembered payload is a 400 that appears weeks after the code was
 * written, which is why nothing here is hardcoded except the resolution value itself.
 */

/** Names that mean "this is finished and the code shipped", in order of preference. */
const RESOLVE_TRANSITIONS = ['resolve issue', 'resolve', 'done', 'close issue'];

/** The resolution to record. Distinct from the transition: one is why, the other is what. */
const RESOLUTION = 'Fixed';

export interface PreparedResolve {
  readonly action: ActionPayload;
  /** Field ids the screen demanded that we could not fill. Non-empty means do not offer it. */
  readonly unfilled: readonly string[];
}

export async function prepareResolve(
  jira: JiraClient,
  issueKey: string,
): Promise<PreparedResolve | null> {
  const available = await jira.transitions(issueKey);
  const transition = pickResolve(available);
  if (transition === undefined) {
    return null;
  }
  const fields = fieldsFor(transition);
  return {
    action: {
      capability: 'jira:transition',
      payload: {
        issueKey,
        transitionId: transition.id,
        transitionName: transition.name,
        fields,
      },
    },
    unfilled: transition.requiredFields.filter((id) => !(id in fields)),
  };
}

function pickResolve(available: readonly JiraTransition[]): JiraTransition | undefined {
  for (const wanted of RESOLVE_TRANSITIONS) {
    const match = available.find((transition) => transition.name.toLowerCase() === wanted);
    if (match !== undefined) {
      return match;
    }
  }
  return undefined;
}

/**
 * Fill only what the screen asks for.
 *
 * Sending a field the screen does not present is rejected just as firmly as omitting one it
 * does, so this cannot simply send everything it knows.
 */
function fieldsFor(transition: JiraTransition): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (transition.requiredFields.includes('resolution')) {
    fields['resolution'] = { name: RESOLUTION };
  }
  return fields;
}
