export interface SessionRecord {
  readonly kind?: unknown;
  readonly v?: unknown;
  readonly k?: unknown;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}

function setAt(root: unknown, path: readonly unknown[], value: unknown): unknown {
  if (path.length === 0) return clone(value);
  const [head, ...tail] = path;
  if (typeof head !== 'string' && typeof head !== 'number') return root;
  const container = (Array.isArray(root) ? [...root] : { ...(root as Record<string, unknown> | null) }) as Record<string | number, unknown>;
  const key = head as string | number;
  container[key] = setAt(container[key], tail, value);
  return container;
}

function appendAt(root: unknown, path: readonly unknown[], value: unknown): unknown {
  const current = path.length === 0 ? root : readAt(root, path);
  if (!Array.isArray(current)) return root;
  return setAt(root, path, [...current, ...((Array.isArray(value) ? value : [value]).map(clone))]);
}

function readAt(root: unknown, path: readonly unknown[]): unknown {
  let current = root;
  for (const key of path) {
    if ((typeof key !== 'string' && typeof key !== 'number') || current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Folds Copilot Chat's root, set-at-path, and append-at-path JSONL events into one state. */
export function foldSessionJsonl(lines: readonly string[]): unknown {
  let state: unknown = {};
  for (const line of lines) {
    if (line.trim() === '') continue;
    const record = JSON.parse(line) as SessionRecord;
    if (record.kind === 0) state = clone(record.v);
    else if (record.kind === 1 && Array.isArray(record.k)) state = setAt(state, record.k, record.v);
    else if (record.kind === 2 && Array.isArray(record.k)) state = appendAt(state, record.k, record.v);
  }
  return state;
}

export function latestSessionModelId(state: unknown): string | null {
  const requests = readAt(state, ['requests']);
  if (!Array.isArray(requests)) return null;
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const request = requests[index];
    if (typeof request === 'object' && request !== null && typeof request.modelId === 'string') return request.modelId;
  }
  return null;
}
