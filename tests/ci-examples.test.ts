import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('additional CI examples', () => {
  it('keeps GitLab analysis revision-safe and retains gated evidence', async () => {
    const workflow = await readFile(
      new URL('../examples/gitlab-ci.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain("GIT_DEPTH: '0'");
    expect(workflow).toContain('CI_MERGE_REQUEST_DIFF_BASE_SHA');
    expect(workflow).toContain('--head "$CI_COMMIT_SHA"');
    expect(workflow).toContain('--fail-on high > change-risk-report.json');
    expect(workflow).toContain('when: always');
    expect(workflow).toContain('npm ci --ignore-scripts');
    expect(workflow).not.toMatch(/\beval\b|npm test|npx/u);
  });
});
