/**
 * Rewrites (and reads) only the `model:` line in an agent's YAML frontmatter, leaving every
 * other line — including the rest of the frontmatter and the agent's prose — untouched. A
 * full YAML round-trip would risk reformatting content no one asked to change.
 */

const MODEL_LINE_RE = /^model:\s*(\[.*\])\s*$/m;
const NAME_LINE_RE = /^name:\s*(.*)\s*$/m;

/** Parses the model array out of an agent file's frontmatter, or null if there is no such line. */
export function parseModelLine(content: string): string[] | null {
  const match = MODEL_LINE_RE.exec(content);
  const captured = match?.[1];
  if (captured === undefined) {
    return null;
  }
  return JSON.parse(captured) as string[];
}

/** Formats a model list as the YAML flow-sequence line the agent files use. */
export function buildModelLine(models: readonly string[]): string {
  return `model: [${models.map((m) => JSON.stringify(m)).join(', ')}]`;
}

/** Replaces the model line in-place. Throws if the file has no model line to replace. */
export function replaceModelLine(content: string, models: readonly string[]): string {
  if (!MODEL_LINE_RE.test(content)) {
    throw new Error('no model: line found in agent file');
  }
  return content.replace(MODEL_LINE_RE, buildModelLine(models));
}

/** Replaces the `name:` line in-place. Throws if the file has no name line to replace. */
export function replaceNameLine(content: string, name: string): string {
  if (!NAME_LINE_RE.test(content)) {
    throw new Error('no name: line found in agent file');
  }
  return content.replace(NAME_LINE_RE, `name: ${name}`);
}
