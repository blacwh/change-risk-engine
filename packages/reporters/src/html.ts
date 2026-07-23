import { parseAnalysisResult, type AnalysisResult } from '@change-risk/core';

function html(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function paths(values: readonly string[]): string {
  if (values.length === 0) return '<span class="muted">None</span>';
  return values.map((value) => `<code>${html(value)}</code>`).join(' ');
}

function summaryCards(result: AnalysisResult): string {
  const additions = result.changedFiles.reduce(
    (total, file) => total + file.additions,
    0,
  );
  const deletions = result.changedFiles.reduce(
    (total, file) => total + file.deletions,
    0,
  );
  return `<section class="summary" aria-label="Analysis summary">
    <div><span>Classification</span><strong class="risk ${result.classification}">${result.classification.toUpperCase()}</strong></div>
    <div><span>Score</span><strong>${result.score}</strong></div>
    <div><span>Changed files</span><strong>${result.changedFiles.length}</strong></div>
    <div><span>Line change</span><strong><b class="added">+${additions}</b> <b class="deleted">−${deletions}</b></strong></div>
  </section>`;
}

function contributionSection(result: AnalysisResult): string {
  if (result.scoreContributions.length === 0) {
    return '<p class="empty">No score contributions.</p>';
  }
  const maximum = Math.max(
    1,
    ...result.scoreContributions.map(({ weight }) => Math.abs(weight)),
  );
  return `<div class="contributions">${result.scoreContributions
    .map(
      (contribution) => `<div class="contribution">
        <div><code>${html(contribution.ruleId)}</code><span>${contribution.findingIds.length} finding${contribution.findingIds.length === 1 ? '' : 's'}</span><strong>${signed(contribution.weight)}</strong></div>
        <div class="track" aria-hidden="true"><i class="${contribution.weight < 0 ? 'mitigating' : 'positive'}" style="width:${(Math.abs(contribution.weight) / maximum) * 100}%"></i></div>
        <small>Findings: ${paths(contribution.findingIds)}</small>
      </div>`,
    )
    .join('')}</div>`;
}

function findingsSection(result: AnalysisResult): string {
  if (result.findings.length === 0) {
    return '<p class="empty">No risk-rule findings.</p>';
  }
  const evidenceIndexes = new Map(
    result.evidence.map((evidence, index) => [evidence.id, index + 1]),
  );
  return `<div class="findings">${result.findings
    .map(
      (finding) => `<article class="finding">
        <header><span class="severity ${finding.severity}">${finding.severity.toUpperCase()}</span><h3>${html(finding.title)}</h3><strong>${signed(finding.weight)}</strong></header>
        <p>${html(finding.explanation)}</p>
        <dl>
          <dt>Finding ID</dt><dd><code>${html(finding.id)}</code></dd>
          <dt>Rule</dt><dd><code>${html(finding.ruleId)}</code></dd>
          <dt>Paths</dt><dd>${paths(finding.affectedPaths)}</dd>
          <dt>Evidence</dt><dd>${finding.evidenceIds
            .map((id) => {
              const index = evidenceIndexes.get(id);
              return index === undefined
                ? `<code>${html(id)}</code>`
                : `<a href="#evidence-${index}"><code>${html(id)}</code></a>`;
            })
            .join(' ')}</dd>
          ${finding.remediation === undefined ? '' : `<dt>Review guidance</dt><dd>${html(finding.remediation)}</dd>`}
        </dl>
      </article>`,
    )
    .join('')}</div>`;
}

function changedFilesSection(result: AnalysisResult): string {
  if (result.changedFiles.length === 0) {
    return '<p class="empty">No changed files.</p>';
  }
  return `<div class="table-scroll"><table>
    <thead><tr><th>Path</th><th>Status</th><th>Categories</th><th>Lines</th></tr></thead>
    <tbody>${result.changedFiles
      .map(
        (file) =>
          `<tr><td><code>${html(file.path)}</code>${file.previousPath === undefined ? '' : `<small>from <code>${html(file.previousPath)}</code></small>`}</td><td>${file.status}${file.binary ? ' · binary' : ''}</td><td>${file.categories.map((category) => `<span class="tag">${category}</span>`).join(' ')}</td><td><b class="added">+${file.additions}</b> <b class="deleted">−${file.deletions}</b></td></tr>`,
      )
      .join('')}</tbody>
  </table></div>`;
}

function evidenceSection(result: AnalysisResult): string {
  if (result.evidence.length === 0) {
    return '<p class="empty">No evidence records.</p>';
  }
  return `<div class="evidence">${result.evidence
    .map(
      (evidence, index) => `<details id="evidence-${index + 1}">
        <summary><code>${html(evidence.id)}</code> ${html(evidence.summary)}</summary>
        <p><span class="tag">${html(evidence.kind)}</span> ${paths(evidence.sourcePaths ?? [])}</p>
        <pre>${html(JSON.stringify(evidence.data, null, 2))}</pre>
      </details>`,
    )
    .join('')}</div>`;
}

const STYLE = `:root{color-scheme:light dark;--bg:#f6f4ef;--panel:#fff;--ink:#20231f;--muted:#656b63;--line:#d8d6cf;--accent:#5b4bdb;--low:#39734c;--moderate:#9a6500;--high:#bd4b20;--critical:#a1263d;--added:#247447;--deleted:#b13e45}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(1120px,calc(100% - 32px));margin:36px auto 72px}header.hero{margin-bottom:24px}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero h1{font-size:clamp(2rem,5vw,4rem);line-height:1;margin:.2em 0}.hero p{color:var(--muted);margin:.4em 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.summary>div,section.panel,.finding,.evidence details{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 30px #0000000a}.summary>div{padding:18px}.summary span{color:var(--muted);display:block;font-size:.8rem;font-weight:700;text-transform:uppercase}.summary strong{display:block;font-size:1.5rem;margin-top:4px}.summary .risk{font-size:1rem;width:max-content;padding:4px 9px;border-radius:999px;color:#fff}.risk.low{background:var(--low)}.risk.moderate{background:var(--moderate)}.risk.high{background:var(--high)}.risk.critical{background:var(--critical)}section.panel{padding:22px;margin-top:16px}h2{font-size:1.25rem;margin:0 0 16px}.contribution{margin:12px 0}.contribution>div:first-child{display:grid;grid-template-columns:1fr auto 60px;gap:12px;align-items:center}.contribution span,.contribution small{color:var(--muted)}.contribution small{display:block;margin-top:5px}.contribution strong{text-align:right}.track{height:7px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:5px}.track i{display:block;height:100%;background:var(--high)}.track i.mitigating{background:var(--low)}.findings{display:grid;gap:12px}.finding{padding:18px}.finding header{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.finding h3{font-size:1rem;margin:0}.severity{font-size:.7rem;font-weight:800;border:1px solid currentColor;border-radius:999px;padding:2px 7px}.severity.info,.severity.low{color:var(--low)}.severity.medium{color:var(--moderate)}.severity.high{color:var(--high)}.severity.critical{color:var(--critical)}dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin-bottom:0}dt{color:var(--muted);font-weight:700}dd{margin:0;min-width:0}code{background:#7772;border-radius:4px;padding:1px 4px;overflow-wrap:anywhere}a{color:var(--accent)}table{border-collapse:collapse;width:100%;text-align:left}th,td{border-bottom:1px solid var(--line);padding:10px;vertical-align:top}th{color:var(--muted);font-size:.75rem;text-transform:uppercase}td small{color:var(--muted);display:block}.table-scroll{overflow:auto}.tag{border:1px solid var(--line);border-radius:999px;display:inline-block;font-size:.75rem;padding:1px 7px}.evidence details{padding:12px 14px;margin:8px 0}.evidence summary{cursor:pointer;font-weight:700}.evidence pre{background:#181a18;color:#f5f3eb;border-radius:8px;max-height:360px;overflow:auto;padding:12px;white-space:pre-wrap}.limitations{margin-bottom:0}.muted,.empty,footer{color:var(--muted)}.added{color:var(--added)}.deleted{color:var(--deleted)}footer{font-size:.85rem;margin-top:20px;text-align:center}@media(max-width:720px){main{width:min(100% - 20px,1120px);margin-top:20px}.summary{grid-template-columns:1fr 1fr}.contribution>div:first-child{grid-template-columns:1fr auto}.contribution>div:first-child span{display:none}section.panel{padding:16px}dl{grid-template-columns:1fr}dd{margin-bottom:6px}}@media(prefers-color-scheme:dark){:root{--bg:#171916;--panel:#21241f;--ink:#f2f0e9;--muted:#adb2a8;--line:#3d413a;--accent:#b7adff;--low:#72c58d;--moderate:#e4ad47;--high:#ef8057;--critical:#f16d89;--added:#77d19a;--deleted:#f17d83}}`;

export function renderHtmlReport(input: unknown): string {
  const result = parseAnalysisResult(input);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>Change risk report · ${result.classification.toUpperCase()}</title>
  <style>${STYLE}</style>
</head>
<body>
<main>
  <header class="hero"><span class="eyebrow">Change Risk Engine</span><h1>Repository change report</h1><p>Analyzed <code>${html(result.revisions.base)}</code> → <code>${html(result.revisions.head)}</code></p></header>
  ${summaryCards(result)}
  <section class="panel"><h2>Score contributions</h2>${contributionSection(result)}</section>
  <section class="panel"><h2>Findings</h2>${findingsSection(result)}</section>
  <section class="panel"><h2>Changed files</h2>${changedFilesSection(result)}</section>
  <section class="panel"><h2>Evidence</h2>${evidenceSection(result)}</section>
  <section class="panel"><h2>Analysis limitations</h2>${result.limitations.length === 0 ? '<p class="empty">No limitations reported.</p>' : `<ul class="limitations">${result.limitations.map((limitation) => `<li>${html(limitation)}</li>`).join('')}</ul>`}</section>
  <footer>Schema version ${result.schemaVersion}. Heuristic review aid; this classification is not a safety guarantee.</footer>
</main>
</body>
</html>
`;
}
