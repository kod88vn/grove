import { afterEach, describe, expect, it, vi } from 'vitest';
import { jiraRequest, JiraRequestError } from '../../../src/connectors/jira/http.ts';

/**
 * Response handling, not Jira itself.
 *
 * The empty-body case is here because getting it wrong is silent and expensive: a successful
 * transition answers 204, and parsing that as JSON made the executor record `failed` for a
 * change Jira had already applied.
 */

const credentials = { baseUrl: 'https://jira.example.invalid', token: 'unused' };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: string): void {
  // A 204 must be constructed with a null body — the Response constructor rejects '' outright.
  const payload = body === '' ? null : body;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(payload, { status }))),
  );
}

describe('jiraRequest', () => {
  it('treats an empty 204 body as success rather than a parse failure', async () => {
    stubFetch(204, '');

    await expect(
      jiraRequest(credentials, { method: 'POST', path: '/rest/api/2/issue/WS-1/transitions' }),
    ).resolves.toBeUndefined();
  });

  it('parses a normal JSON body', async () => {
    stubFetch(200, '{"key":"WS-1"}');

    await expect(jiraRequest(credentials, { method: 'GET', path: '/x' })).resolves.toEqual({
      key: 'WS-1',
    });
  });

  it('keeps the error body, because Jira names the missing field there', async () => {
    stubFetch(400, '{"errors":{"fixVersions":"Please add a Fix/Version "}}');

    await expect(
      jiraRequest(credentials, { method: 'POST', path: '/rest/api/2/issue/WS-1/transitions' }),
    ).rejects.toThrow(/fixVersions/);
  });

  it('reports the status on the error, so a caller can tell 400 from 500', async () => {
    stubFetch(500, 'upstream exploded');

    const failure = await jiraRequest(credentials, { method: 'GET', path: '/x' }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(JiraRequestError);
    expect((failure as JiraRequestError).httpStatus).toBe(500);
  });
});
