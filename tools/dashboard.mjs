import path from 'node:path';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const historyRoot = path.join(projectRoot, '.claude', 'version-history');
const outputPath = path.join(projectRoot, 'dashboard', 'index.html');

const GITHUB_REPO_URL = 'https://github.com/nampluskr/workflow-hub';
const GITHUB_BRANCH = 'main';

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function extractSection(manualText, heading) {
  const lines = manualText.split('\n');
  const startIdx = lines.findIndex((line) => line.trim() === heading);
  if (startIdx === -1) return '';
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((line) => line.startsWith('## '));
  const body = endIdx === -1 ? rest : rest.slice(0, endIdx);
  return body.join('\n').trim();
}

function loadProjects() {
  if (!existsSync(historyRoot)) return [];
  const names = readdirSync(historyRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return names.map((name) => {
    const historyPath = path.join(historyRoot, name, 'history.json');
    const history = existsSync(historyPath)
      ? JSON.parse(readFileSync(historyPath, 'utf8'))
      : { project: name, versions: [] };

    const manualPath = path.join(projectRoot, 'samples', name, 'MANUAL.md');
    const purpose = existsSync(manualPath)
      ? extractSection(readFileSync(manualPath, 'utf8'), '## 용도')
      : '';

    const versions = [...history.versions].sort((a, b) => b.version - a.version);
    return { name, purpose, versions };
  });
}

function renderProjectCard(project) {
  const rows = project.versions.map((v) => {
    const snapshotPath = `.claude/version-history/${project.name}/v${v.version}`;
    const codeUrl = `${GITHUB_REPO_URL}/blob/${GITHUB_BRANCH}/${snapshotPath}/main.py`;
    const manualUrl = `${GITHUB_REPO_URL}/blob/${GITHUB_BRANCH}/${snapshotPath}/MANUAL.md`;
    const githubUrl = `${GITHUB_REPO_URL}/tree/${GITHUB_BRANCH}/${snapshotPath}`;
    return `
        <tr>
          <td class="version-badge">v${escapeHtml(v.version)}</td>
          <td>${escapeHtml(v.author)}</td>
          <td>${escapeHtml(v.date)}</td>
          <td>${escapeHtml(v.summary)}</td>
          <td class="links">
            <a href="${escapeHtml(codeUrl)}" target="_blank" rel="noopener">코드</a>
            · <a href="${escapeHtml(manualUrl)}" target="_blank" rel="noopener">매뉴얼</a>
            · <a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener">깃헙</a>
          </td>
        </tr>`;
  }).join('');

  const latest = project.versions[0];

  return `
    <section class="card">
      <header>
        <h2>${escapeHtml(project.name)}</h2>
        ${latest ? `<span class="latest-badge">최신 v${escapeHtml(latest.version)} · ${escapeHtml(latest.author)}</span>` : ''}
      </header>
      ${project.purpose ? `<p class="purpose">${escapeHtml(project.purpose)}</p>` : ''}
      <table>
        <thead>
          <tr><th>버전</th><th>작업자</th><th>날짜</th><th>변경 요약</th><th>코드 · 매뉴얼 · 깃헙</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">등록된 버전이 없습니다</td></tr>'}</tbody>
      </table>
    </section>`;
}

function render(projects) {
  const generatedAt = new Date().toISOString().slice(0, 10);
  const cards = projects.map(renderProjectCard).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>workflow-hub 버전 대시보드</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, "Segoe UI", sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; background: #f7f7f8; color: #1a1a1a; }
  h1 { font-size: 1.5rem; }
  .meta { color: #666; margin-bottom: 2rem; }
  .card { background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
  .card header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
  .card h2 { margin: 0; font-size: 1.15rem; }
  .latest-badge { font-size: 0.8rem; color: #2563eb; background: #eff6ff; padding: 0.15rem 0.6rem; border-radius: 999px; white-space: nowrap; }
  .purpose { color: #444; font-size: 0.92rem; margin: 0.5rem 0 1rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid #eee; }
  th { color: #888; font-weight: 600; }
  .version-badge { font-family: ui-monospace, monospace; font-weight: 600; }
  .empty { color: #999; font-style: italic; }
  @media (prefers-color-scheme: dark) {
    body { background: #14151a; color: #eaeaea; }
    .card { background: #1d1e24; border-color: #2c2d33; }
    th, td { border-color: #2c2d33; }
    .purpose { color: #bbb; }
    .latest-badge { background: #17233f; color: #7fa8ff; }
  }
</style>
</head>
<body>
  <h1>workflow-hub 버전 대시보드</h1>
  <p class="meta">생성일: ${generatedAt} · <code>node tools/dashboard.mjs</code>로 재생성</p>
  ${cards || '<p>등록된 프로젝트가 없습니다.</p>'}
</body>
</html>
`;
}

function main() {
  const projects = loadProjects();
  const html = render(projects);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, 'utf8');
  process.stdout.write(`Dashboard written: ${path.relative(projectRoot, outputPath)} (${projects.length} project(s))\n`);
}

main();
