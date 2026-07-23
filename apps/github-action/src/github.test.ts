import { describe, expect, it, vi } from 'vitest';

import { maintainPullRequestComment } from './github.js';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('maintained pull request comment', () => {
  it('updates the existing GitHub Actions bot comment', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 41,
            body: '<!-- change-risk-engine -->\nold',
            user: { login: 'github-actions[bot]', type: 'Bot' },
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 41,
          body: '<!-- change-risk-engine -->\nnew',
          user: { login: 'github-actions[bot]', type: 'Bot' },
        }),
      );
    await expect(
      maintainPullRequestComment({
        apiUrl: 'https://api.github.test/',
        token: 'token',
        owner: 'owner',
        repository: 'repo',
        pullRequestNumber: 7,
        body: '<!-- change-risk-engine -->\nnew',
        fetchImplementation: request,
      }),
    ).resolves.toEqual({ action: 'updated', id: 41 });
    expect(request.mock.calls[1]?.[0]).toBe(
      'https://api.github.test/repos/owner/repo/issues/comments/41',
    );
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
  });

  it('does not adopt a marker placed by a human', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 9,
            body: '<!-- change-risk-engine -->\nspoof',
            user: { login: 'reviewer', type: 'User' },
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          body: '<!-- change-risk-engine -->\nnew',
          user: { login: 'github-actions[bot]', type: 'Bot' },
        }),
      );
    await expect(
      maintainPullRequestComment({
        apiUrl: 'https://api.github.test',
        token: 'token',
        owner: 'owner',
        repository: 'repo',
        pullRequestNumber: 7,
        body: '<!-- change-risk-engine -->\nnew',
        fetchImplementation: request,
      }),
    ).resolves.toEqual({ action: 'created', id: 42 });
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('reports bounded API failures without exposing response content', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret response body', { status: 403 }));
    await expect(
      maintainPullRequestComment({
        apiUrl: 'https://api.github.test',
        token: 'token',
        owner: 'owner',
        repository: 'repo',
        pullRequestNumber: 7,
        body: '<!-- change-risk-engine -->',
        fetchImplementation: request,
      }),
    ).rejects.toThrow('status 403');
  });
});
