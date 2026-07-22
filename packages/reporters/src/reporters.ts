import { parseAnalysisResult, type AnalysisResult } from '@change-risk/core';

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
  if (result.limitations.length > 0) {
    lines.push(
      'Limitations:',
      ...result.limitations.map((limitation) => `- ${limitation}`),
    );
  }
  return `${lines.join('\n')}\n`;
}
