import { parseAnalysisResult, type AnalysisResult } from '@change-risk/core';

export const GITHUB_COMMENT_MARKER = '<!-- change-risk-engine -->';

function totalLines(
  result: AnalysisResult,
  field: 'additions' | 'deletions',
): number {
  return result.changedFiles.reduce((total, file) => total + file[field], 0);
}

export function renderJsonReport(input: unknown): string {
  return `${JSON.stringify(parseAnalysisResult(input), null, 2)}\n`;
}

export function renderTerminalReport(input: unknown): string {
  const result = parseAnalysisResult(input);
  const binaryCount = result.changedFiles.filter(({ binary }) => binary).length;
  const lines = [
    `Change risk: ${result.classification.toUpperCase()} (${result.score})`,
    `Revisions: ${result.revisions.base}..${result.revisions.head}`,
    `Changed files: ${result.changedFiles.length} (+${totalLines(result, 'additions')} -${totalLines(result, 'deletions')}; ${binaryCount} binary)`,
  ];

  if (result.findings.length > 0) {
    lines.push('Findings:');
    for (const finding of result.findings) {
      const weight =
        finding.weight >= 0 ? `+${finding.weight}` : String(finding.weight);
      lines.push(
        `- [${finding.severity.toUpperCase()}] ${finding.title} (${weight}): ${finding.explanation}`,
      );
    }
  }
  if (result.scoreContributions.length > 0) {
    lines.push('Score contributions:');
    for (const contribution of result.scoreContributions) {
      const weight =
        contribution.weight >= 0
          ? `+${contribution.weight}`
          : String(contribution.weight);
      lines.push(
        `- ${contribution.ruleId}: ${weight} (${contribution.findingIds.length} finding${contribution.findingIds.length === 1 ? '' : 's'})`,
      );
    }
  }
  if (result.limitations.length > 0) {
    lines.push(
      'Limitations:',
      ...result.limitations.map((limitation) => `- ${limitation}`),
    );
  }
  return `${lines.join('\n')}\n`;
}

function markdownText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('\\', '&#92;')
    .replaceAll('`', '&#96;')
    .replaceAll('*', '&#42;')
    .replaceAll('_', '&#95;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replace(/[\r\n]+/gu, ' ');
}

export function renderGitHubMarkdownReport(input: unknown): string {
  const result = parseAnalysisResult(input);
  const lines = [
    GITHUB_COMMENT_MARKER,
    '## Change risk report',
    '',
    `**${result.classification.toUpperCase()}** — score ${result.score}`,
    '',
    `Analyzed \`${markdownText(result.revisions.base)}..${markdownText(result.revisions.head)}\` with ${result.changedFiles.length} changed file(s).`,
    '',
  ];
  if (result.findings.length === 0) {
    lines.push('No risk-rule findings.', '');
  } else {
    lines.push(
      '| Severity | Rule | Finding | Weight |',
      '| --- | --- | --- | ---: |',
    );
    for (const finding of result.findings) {
      const affected = finding.affectedPaths
        .slice(0, 5)
        .map((path) => `\`${markdownText(path)}\``)
        .join(', ');
      const suffix = affected.length === 0 ? '' : `<br>Paths: ${affected}`;
      const evidence = finding.evidenceIds
        .map((id) => `\`${markdownText(id)}\``)
        .join(', ');
      lines.push(
        `| ${finding.severity.toUpperCase()} | \`${markdownText(finding.ruleId)}\` | ${markdownText(finding.title)} — ${markdownText(finding.explanation)}${suffix}<br>Evidence: ${evidence} | ${finding.weight >= 0 ? '+' : ''}${finding.weight} |`,
      );
      if (lines.join('\n').length > 52_000) {
        lines.push(
          '| … | … | Remaining findings are available in the JSON artifact. | … |',
        );
        break;
      }
    }
    lines.push('');
  }
  if (result.scoreContributions.length > 0) {
    lines.push(
      '<details>',
      '<summary>Effective score contributions</summary>',
      '',
      '| Rule | Findings | Effective contribution |',
      '| --- | ---: | ---: |',
    );
    for (const contribution of result.scoreContributions) {
      lines.push(
        `| \`${markdownText(contribution.ruleId)}\` | ${contribution.findingIds.length} | ${contribution.weight >= 0 ? '+' : ''}${contribution.weight} |`,
      );
      if (lines.join('\n').length > 56_000) {
        lines.push(
          '| … | … | Remaining contributions are available in the JSON artifact. |',
        );
        break;
      }
    }
    lines.push('', '</details>', '');
  }
  if (result.limitations.length > 0) {
    lines.push('<details>', '<summary>Analysis limitations</summary>', '');
    for (const limitation of result.limitations) {
      lines.push(`- ${markdownText(limitation)}`);
    }
    lines.push('', '</details>', '');
  }
  lines.push(
    '_Heuristic review aid; this classification is not a safety guarantee._',
  );
  const output = `${lines.join('\n')}\n`;
  if (output.length > 60_000) {
    return `${GITHUB_COMMENT_MARKER}\n## Change risk report\n\n**${result.classification.toUpperCase()}** — score ${result.score}\n\nThe detailed comment exceeded the safe size limit. See the JSON artifact.\n\n_Heuristic review aid; this classification is not a safety guarantee._\n`;
  }
  return output;
}
