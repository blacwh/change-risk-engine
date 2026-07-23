import {
  parseAnalysisResult,
  parseBlastRadiusVisualization,
  type AnalysisResult,
  type BlastRadiusVisualization,
} from '@change-risk/core';

export type HtmlReportOptions = { blastRadius?: unknown };

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

function shortPath(path: string): string {
  return path.length <= 34 ? path : `…${path.slice(-33)}`;
}

function blastRadiusSection(graph: BlastRadiusVisualization): string {
  if (graph.nodes.length === 0) {
    return `<p class="empty">No changed source modules were available in the dependency graph.</p>${graph.unindexedChangedPaths.length === 0 ? '' : `<p>Changed source paths not indexed: ${paths(graph.unindexedChangedPaths)}</p>`}`;
  }
  const byDistance = new Map<number, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const group = byDistance.get(node.distance) ?? [];
    byDistance.set(node.distance, [...group, node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [distance, nodes] of byDistance) {
    nodes.forEach((node, index) => {
      positions.set(node.path, { x: 30 + distance * 260, y: 55 + index * 72 });
    });
  }
  const maximumDistance = Math.max(
    ...graph.nodes.map(({ distance }) => distance),
  );
  const maximumRows = Math.max(
    ...[...byDistance.values()].map((nodes) => nodes.length),
  );
  const width = maximumDistance * 260 + 280;
  const height = Math.max(190, maximumRows * 72 + 80);
  const edges = graph.edges
    .map((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (from === undefined || to === undefined) return '';
      const leftToRight = from.x < to.x;
      const sameColumn = from.x === to.x;
      const fromX = sameColumn
        ? from.x + 110
        : from.x + (leftToRight ? 220 : 0);
      const toX = sameColumn ? to.x + 110 : to.x + (leftToRight ? 0 : 220);
      return `<line x1="${fromX}" y1="${from.y + 24}" x2="${toX}" y2="${to.y + 24}" marker-end="url(#arrow)"><title>${html(edge.from)} imports ${html(edge.to)}</title></line>`;
    })
    .join('');
  const nodes = graph.nodes
    .map((node) => {
      const position = positions.get(node.path)!;
      return `<g class="graph-node ${node.changed ? 'changed' : 'impacted'}" transform="translate(${position.x} ${position.y})"><title>${html(node.path)} · fan-in ${node.fanIn} · fan-out ${node.fanOut}</title><rect width="220" height="48" rx="8"></rect><text x="10" y="20">${html(shortPath(node.path))}</text><text class="metric" x="10" y="37">${node.changed ? 'changed' : `impact distance ${node.distance}`} · in ${node.fanIn} · out ${node.fanOut}</text></g>`;
    })
    .join('');
  return `<p class="graph-meta">Focused on ${graph.nodes.filter(({ changed }) => changed).length} rendered change seed(s) and their dependents from a ${graph.sourceNodeCount}-node, ${graph.sourceEdgeCount}-edge source graph.</p>
    <div class="legend"><span><i class="changed"></i> Changed module</span><span><i class="impacted"></i> Dependent in blast radius</span><span>Arrows point from importer to dependency</span></div>
    ${graph.truncated ? '<p class="notice">Visualization bounds or traversal depth were reached; this graph is explicitly incomplete.</p>' : ''}
    <div class="graph-scroll"><svg class="graph" role="img" aria-label="Dependency graph with changed modules and transitive dependents highlighted" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"></path></marker></defs>${edges}${nodes}</svg></div>
    <div class="table-scroll"><table><thead><tr><th>Module</th><th>Impact distance</th><th>Fan-in</th><th>Fan-out</th></tr></thead><tbody>${graph.nodes.map((node) => `<tr><td><code>${html(node.path)}</code></td><td>${node.distance}</td><td>${node.fanIn}</td><td>${node.fanOut}</td></tr>`).join('')}</tbody></table></div>
    ${graph.unindexedChangedPaths.length === 0 ? '' : `<p>Changed source paths not indexed: ${paths(graph.unindexedChangedPaths)}</p>`}`;
}

const STYLE = `:root{color-scheme:light dark;--bg:#f6f4ef;--panel:#fff;--ink:#20231f;--muted:#656b63;--line:#d8d6cf;--accent:#5b4bdb;--low:#39734c;--moderate:#9a6500;--high:#bd4b20;--critical:#a1263d;--added:#247447;--deleted:#b13e45}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(1120px,calc(100% - 32px));margin:36px auto 72px}header.hero{margin-bottom:24px}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero h1{font-size:clamp(2rem,5vw,4rem);line-height:1;margin:.2em 0}.hero p{color:var(--muted);margin:.4em 0}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.summary>div,section.panel,.finding,.evidence details{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 30px #0000000a}.summary>div{padding:18px}.summary span{color:var(--muted);display:block;font-size:.8rem;font-weight:700;text-transform:uppercase}.summary strong{display:block;font-size:1.5rem;margin-top:4px}.summary .risk{font-size:1rem;width:max-content;padding:4px 9px;border-radius:999px;color:#fff}.risk.low{background:var(--low)}.risk.moderate{background:var(--moderate)}.risk.high{background:var(--high)}.risk.critical{background:var(--critical)}section.panel{padding:22px;margin-top:16px}h2{font-size:1.25rem;margin:0 0 16px}.contribution{margin:12px 0}.contribution>div:first-child{display:grid;grid-template-columns:1fr auto 60px;gap:12px;align-items:center}.contribution span,.contribution small{color:var(--muted)}.contribution small{display:block;margin-top:5px}.contribution strong{text-align:right}.track{height:7px;background:var(--line);border-radius:99px;overflow:hidden;margin-top:5px}.track i{display:block;height:100%;background:var(--high)}.track i.mitigating{background:var(--low)}.findings{display:grid;gap:12px}.finding{padding:18px}.finding header{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.finding h3{font-size:1rem;margin:0}.severity{font-size:.7rem;font-weight:800;border:1px solid currentColor;border-radius:999px;padding:2px 7px}.severity.info,.severity.low{color:var(--low)}.severity.medium{color:var(--moderate)}.severity.high{color:var(--high)}.severity.critical{color:var(--critical)}dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin-bottom:0}dt{color:var(--muted);font-weight:700}dd{margin:0;min-width:0}code{background:#7772;border-radius:4px;padding:1px 4px;overflow-wrap:anywhere}a{color:var(--accent)}table{border-collapse:collapse;width:100%;text-align:left}th,td{border-bottom:1px solid var(--line);padding:10px;vertical-align:top}th{color:var(--muted);font-size:.75rem;text-transform:uppercase}td small{color:var(--muted);display:block}.table-scroll{overflow:auto}.tag{border:1px solid var(--line);border-radius:999px;display:inline-block;font-size:.75rem;padding:1px 7px}.evidence details{padding:12px 14px;margin:8px 0}.evidence summary{cursor:pointer;font-weight:700}.evidence pre{background:#181a18;color:#f5f3eb;border-radius:8px;max-height:360px;overflow:auto;padding:12px;white-space:pre-wrap}.limitations{margin-bottom:0}.muted,.empty,footer{color:var(--muted)}.added{color:var(--added)}.deleted{color:var(--deleted)}footer{font-size:.85rem;margin-top:20px;text-align:center}@media(max-width:720px){main{width:min(100% - 20px,1120px);margin-top:20px}.summary{grid-template-columns:1fr 1fr}.contribution>div:first-child{grid-template-columns:1fr auto}.contribution>div:first-child span{display:none}section.panel{padding:16px}dl{grid-template-columns:1fr}dd{margin-bottom:6px}}@media(prefers-color-scheme:dark){:root{--bg:#171916;--panel:#21241f;--ink:#f2f0e9;--muted:#adb2a8;--line:#3d413a;--accent:#b7adff;--low:#72c58d;--moderate:#e4ad47;--high:#ef8057;--critical:#f16d89;--added:#77d19a;--deleted:#f17d83}}`;

const GRAPH_STYLE = `.graph-meta{color:var(--muted)}.legend{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted);font-size:.8rem;margin-bottom:10px}.legend span{display:flex;align-items:center;gap:5px}.legend i{width:12px;height:12px;border-radius:3px}.legend i.changed{background:var(--critical)}.legend i.impacted{background:var(--accent)}.notice{border-left:4px solid var(--moderate);background:#9a650018;padding:9px 12px}.graph-scroll{background:var(--bg);border:1px solid var(--line);border-radius:10px;max-height:640px;overflow:auto;margin-bottom:14px}.graph line{stroke:var(--muted);stroke-width:1.5;opacity:.55}.graph marker path{fill:var(--muted)}.graph-node rect{fill:var(--panel);stroke-width:2}.graph-node.changed rect{stroke:var(--critical)}.graph-node.impacted rect{stroke:var(--accent)}.graph-node text{fill:var(--ink);font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.graph-node text.metric{fill:var(--muted);font-size:10px}`;

export function renderHtmlReport(
  input: unknown,
  options: HtmlReportOptions = {},
): string {
  const result = parseAnalysisResult(input);
  const blastRadius =
    options.blastRadius === undefined
      ? undefined
      : parseBlastRadiusVisualization(options.blastRadius);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>Change risk report · ${result.classification.toUpperCase()}</title>
  <style>${STYLE}${GRAPH_STYLE}</style>
</head>
<body>
<main>
  <header class="hero"><span class="eyebrow">Change Risk Engine</span><h1>Repository change report</h1><p>Analyzed <code>${html(result.revisions.base)}</code> → <code>${html(result.revisions.head)}</code></p></header>
  ${summaryCards(result)}
  <section class="panel"><h2>Dependency blast radius</h2>${blastRadius === undefined ? '<p class="empty">Dependency graph visualization was not available for this analysis.</p>' : blastRadiusSection(blastRadius)}</section>
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
