import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  mapBoard,
  mapBoardColumns,
  mapIssue,
  mapSprint,
  type RawJiraIssue,
} from '../../../src/connectors/jira/map.ts';

/**
 * These fixtures are unedited responses captured from jira.corp.clover.com on 2026-08-31.
 * They are the point of this file: a mapper that only ever sees hand-written input passes
 * happily and then falls over on the first real payload.
 */
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../fixtures/jira/${name}`, import.meta.url), 'utf8'));
}

const MIRRORED_AT = '2026-08-31T10:00:00.000Z';

describe('mapIssue against captured Agile responses', () => {
  const page = fixture('agile-sprint-12388-issues.json') as { issues: RawJiraIssue[] };

  it('maps every issue in the active sprint without throwing', () => {
    expect(page.issues.length).toBeGreaterThan(0);
    for (const raw of page.issues) {
      const issue = mapIssue(raw, MIRRORED_AT);
      expect(issue.key).toMatch(/^[A-Z][A-Z0-9]+-\d+$/);
      expect(issue.status).not.toBe('');
      expect(issue.created).not.toBe('');
    }
  });

  it('reads the structured sprint object the Agile API provides', () => {
    const withSprint = page.issues.map((r) => mapIssue(r, MIRRORED_AT)).filter((i) => i.sprint !== null);
    expect(withSprint.length).toBeGreaterThan(0);
    for (const issue of withSprint) {
      expect(typeof issue.sprint?.id).toBe('number');
      expect(issue.sprint?.name).toBeTruthy();
      // The GreenHopper toString blob must never reach the domain model.
      expect(issue.sprint?.name).not.toContain('com.atlassian');
    }
  });

  it('prefers the Agile epic object over the Epic Link custom field', () => {
    const withEpic = page.issues.map((r) => mapIssue(r, MIRRORED_AT)).filter((i) => i.epicKey !== null);
    expect(withEpic.length).toBeGreaterThan(0);
    for (const issue of withEpic) {
      expect(issue.epicKey).toMatch(/^[A-Z][A-Z0-9]+-\d+$/);
    }
  });
});

describe('mapIssue against captured core search responses', () => {
  it('maps issues that carry no sprint or epic field at all', () => {
    const page = fixture('search-mine.json') as { issues: RawJiraIssue[] };
    const issues = page.issues.map((r) => mapIssue(r, MIRRORED_AT));
    expect(issues.length).toBeGreaterThan(0);
    // Core search omits both fields entirely; the mapper must yield null, not undefined.
    for (const issue of issues) {
      expect(issue.sprint).toBeNull();
    }
  });

  it('throws on an issue with no key rather than inventing one', () => {
    expect(() => mapIssue({ fields: {} }, MIRRORED_AT)).toThrow(/no key/);
  });

  it('falls back to the mirror timestamp when created and updated are missing', () => {
    const issue = mapIssue({ key: 'WS-1', fields: {} }, MIRRORED_AT);
    expect(issue.created).toBe(MIRRORED_AT);
    expect(issue.updated).toBe(MIRRORED_AT);
    expect(issue.status).toBe('Unknown');
  });
});

describe('mapSprint', () => {
  it('maps the active sprint from the board', () => {
    const page = fixture('agile-board_1386_sprint_maxResults_3_state_active.json') as {
      values: unknown[];
    };
    const sprint = mapSprint(page.values[0], 1386);
    expect(sprint.id).toBe(12388);
    expect(sprint.name).toBe('Platform_13');
    expect(sprint.state).toBe('active');
    expect(sprint.boardId).toBe(1386);
    expect(sprint.completeDate).toBeNull();
  });

  it('maps closed sprints and keeps their end dates', () => {
    const page = fixture('agile-sprints-closed.json') as { values: unknown[] };
    const sprints = page.values.map((v) => mapSprint(v, 1386));
    expect(sprints.length).toBeGreaterThan(3);
    expect(sprints.every((s) => s.state === 'closed')).toBe(true);
    expect(sprints.at(-1)?.name).toBe('Platform_12');
  });

  it('defaults an unrecognised state to future rather than crashing', () => {
    expect(mapSprint({ id: 1, state: 'PAUSED' }, 1386).state).toBe('future');
  });
});

describe('mapBoard', () => {
  it('reads the board columns in order', () => {
    const columns = mapBoardColumns(fixture('agile-board_1386_configuration.json'));
    expect(columns).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('maps the board itself', () => {
    const board = mapBoard(fixture('agile-board_1386.json'), ['To Do', 'In Progress', 'Done']);
    expect(board.id).toBe(1386);
    expect(board.name).toBe('storefront platform');
    expect(board.type).toBe('scrum');
  });
});
