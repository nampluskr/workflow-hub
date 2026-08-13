import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// NAVIGATION.md 행에 있는 이름 = wiki 페이지가 있어야 하는 이름. 반대로
// "핵심 로직 설명" 밖의 이름(display-image-inspection의 main 등)은 NAVIGATION.md에도
// 없으므로 wiki 페이지도 없어야 한다 — 지어내지 않는다 원칙(CLAUDE.md §7)을 검증한다.
const SAMPLES = {
  'display-defect-rate': {
    expectedPages: ['aggregate', 'print_table', 'write_report'],
    forbiddenPages: ['load_rows'],
  },
  'display-image-inspection': {
    expectedPages: ['estimate_background', 'find_defect_clusters', 'DEVIATION_THRESHOLD', 'MIN_CLUSTER_SIZE'],
    forbiddenPages: ['main', 'load_pgm', 'analyze_image'],
  },
};

for (const [name, { expectedPages, forbiddenPages }] of Object.entries(SAMPLES)) {
  const wikiDir = path.join(projectRoot, 'samples', name, 'wiki');

  test(`sample '${name}' has wiki/index.md`, () => {
    assert.ok(existsSync(path.join(wikiDir, 'index.md')), `missing ${wikiDir}/index.md — run the wiki-writer subagent for '${name}'`);
  });

  test(`sample '${name}' wiki has exactly one page per NAVIGATION.md row, no more no less`, () => {
    const navPath = path.join(projectRoot, 'samples', name, 'NAVIGATION.md');
    const navText = readFileSync(navPath, 'utf8');
    const navRows = navText
      .split('\n')
      .filter((line) => line.startsWith('|') && !line.startsWith('|---'))
      .slice(1); // header row

    const pageFiles = readdirSync(wikiDir).filter((f) => f !== 'index.md');
    assert.equal(pageFiles.length, navRows.length, `expected ${navRows.length} wiki page(s) for '${name}' (one per NAVIGATION.md row), found ${pageFiles.length}: ${pageFiles.join(', ')}`);

    for (const fn of expectedPages) {
      const page = pageFiles.find((f) => f === `${fn}.md`);
      assert.ok(page, `wiki/ for '${name}' is missing a page for '${fn}'`);
    }
  });

  test(`sample '${name}' wiki does not fabricate pages for names outside NAVIGATION.md`, () => {
    const existing = existsSync(wikiDir) ? readdirSync(wikiDir) : [];
    for (const fn of forbiddenPages) {
      assert.ok(!existing.includes(`${fn}.md`), `wiki/ for '${name}' should not have a page for '${fn}' — it is outside NAVIGATION.md's "핵심 로직 설명" scope`);
    }
  });

  test(`sample '${name}' wiki pages cite a version and a src/main.py:<line> code location`, () => {
    for (const fn of expectedPages) {
      const pagePath = path.join(wikiDir, `${fn}.md`);
      assert.ok(existsSync(pagePath), `missing ${pagePath}`);
      const text = readFileSync(pagePath, 'utf8');
      assert.match(text, /\*\*설명된 버전\*\*:\s*v\d+\.\d+ report\.md/, `${fn}.md for '${name}' must cite a version and report.md`);
      assert.match(text, /\*\*코드 위치\*\*:\s*src\/main\.py:\d+/, `${fn}.md for '${name}' must cite a src/main.py:<line> code location`);
    }
  });

  test(`sample '${name}' wiki/index.md links to every page`, () => {
    const indexText = readFileSync(path.join(wikiDir, 'index.md'), 'utf8');
    for (const fn of expectedPages) {
      assert.ok(indexText.includes(`(${fn}.md)`), `wiki/index.md for '${name}' should link to ${fn}.md`);
    }
  });
}
