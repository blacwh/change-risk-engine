import { GITHUB_COMMENT_MARKER } from '@change-risk/reporters';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_COMMENT_PAGES = 10;

export type GitHubCommentOptions = {
  apiUrl: string;
  token: string;
  owner: string;
  repository: string;
  pullRequestNumber: number;
  body: string;
  fetchImplementation?: typeof fetch;
};

export type CommentResult = { action: 'created' | 'updated'; id: number };

type IssueComment = {
  id: number;
  body: string;
  user: { login: string; type: string };
};

function commentFrom(input: unknown): IssueComment | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const value = input as Record<string, unknown>;
  const user = value.user;
  if (
    typeof value.id !== 'number' ||
    typeof value.body !== 'string' ||
    typeof user !== 'object' ||
    user === null
  ) {
    return undefined;
  }
  const userValue = user as Record<string, unknown>;
  if (
    typeof userValue.login !== 'string' ||
    typeof userValue.type !== 'string'
  ) {
    return undefined;
  }
  return {
    id: value.id,
    body: value.body,
    user: { login: userValue.login, type: userValue.type },
  };
}

async function responseJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error('GitHub API response exceeded the size limit');
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (response.body !== null) {
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('GitHub API response exceeded the size limit');
      }
      chunks.push(chunk.value);
    }
  }
  const text = Buffer.concat(chunks, total).toString('utf8');
  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }
  return text.length === 0 ? undefined : (JSON.parse(text) as unknown);
}

export async function maintainPullRequestComment(
  options: GitHubCommentOptions,
): Promise<CommentResult> {
  if (options.body.length > 60_000) {
    throw new Error('GitHub comment exceeded the safe size limit');
  }
  const request = options.fetchImplementation ?? fetch;
  const apiUrl = options.apiUrl.replace(/\/+$/u, '');
  const repositoryPath = `${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repository)}`;
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${options.token}`,
    'content-type': 'application/json',
  };
  let existing: IssueComment | undefined;
  for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
    const response = await request(
      `${apiUrl}/repos/${repositoryPath}/issues/${options.pullRequestNumber}/comments?per_page=100&page=${page}`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    const value = await responseJson(response);
    if (!Array.isArray(value)) {
      throw new Error('GitHub comments response was not an array');
    }
    const comments = value
      .map(commentFrom)
      .filter((item) => item !== undefined);
    existing = comments.find(
      (comment) =>
        comment.user.type === 'Bot' &&
        comment.user.login === 'github-actions[bot]' &&
        comment.body.includes(GITHUB_COMMENT_MARKER),
    );
    if (existing !== undefined || value.length < 100) break;
    if (page === MAX_COMMENT_PAGES) {
      throw new Error('GitHub comment search reached the pagination limit');
    }
  }

  const endpoint =
    existing === undefined
      ? `${apiUrl}/repos/${repositoryPath}/issues/${options.pullRequestNumber}/comments`
      : `${apiUrl}/repos/${repositoryPath}/issues/comments/${existing.id}`;
  const response = await request(endpoint, {
    method: existing === undefined ? 'POST' : 'PATCH',
    headers,
    body: JSON.stringify({ body: options.body }),
    signal: AbortSignal.timeout(15_000),
  });
  const value = commentFrom(await responseJson(response));
  if (value === undefined) {
    throw new Error('GitHub comment response was invalid');
  }
  return {
    action: existing === undefined ? 'created' : 'updated',
    id: value.id,
  };
}
