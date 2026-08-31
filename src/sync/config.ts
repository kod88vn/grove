/**
 * What the sync engine needs to know about the world.
 *
 * Declared here rather than imported from `src/config/` because dependencies point downward:
 * the entrypoint that assembles real configuration may depend on the sync engine, never the
 * reverse. `Config` satisfies this structurally, so nothing has to adapt between them.
 */
export interface SyncRepo {
  readonly fullName: string;
  readonly path: string | null;
}

export interface SyncConfig {
  readonly jira: {
    /** Jira username, used to decide whether a sprint ticket is mine. */
    readonly me: string;
    readonly projectKeys: readonly string[];
  };
  readonly github: {
    readonly me: string;
  };
  readonly repos: readonly SyncRepo[];
}
