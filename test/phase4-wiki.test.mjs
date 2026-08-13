import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// report.md의 "핵심 로직 설명" 절에 실제로 등장하는 이름만 wiki 페이지가 있어야
// 한다. 반대로 그 절 밖의 이름(display-image-inspection의 main 등)은 위키가
// 지어내지 않아야 하므로 페이지가 없어야 한다(CLAUDE.md §6, Codex 반박 검증
// 2026-08-13에서 확인). NAVIGATION.md는 wiki/index.md와 중복이라 폐지됐으므로
// (같은 날, 사용자 지적) 여기서는 wiki/만을 기준으로 검증한다.
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

  test(`sample '${name}' wiki has exactly one page per core function/constant, no more no less`, () => {
    const pageFiles = readdirSync(wikiDir).filter((f) => f !== 'index.md');
    assert.equal(
      pageFiles.length,
      expectedPages.length,
      `expected ${expectedPages.length} wiki page(s) for '${name}', found ${pageFiles.length}: ${pageFiles.join(', ')}`,
    );

    for (const fn of expectedPages) {
      const page = pageFiles.find((f) => f === `${fn}.md`);
      assert.ok(page, `wiki/ for '${name}' is missing a page for '${fn}'`);
    }
  });

  test(`sample '${name}' wiki does not fabricate pages for names outside report.md "핵심 로직 설명"`, () => {
    const existing = existsSync(wikiDir) ? readdirSync(wikiDir) : [];
    for (const fn of forbiddenPages) {
      assert.ok(!existing.includes(`${fn}.md`), `wiki/ for '${name}' should not have a page for '${fn}' — it is outside report.md's "핵심 로직 설명" scope`);
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

  test(`sample '${name}' wiki/index.md links to every page and cites a version + code location per row`, () => {
    const indexText = readFileSync(path.join(wikiDir, 'index.md'), 'utf8');
    for (const fn of expectedPages) {
      assert.ok(indexText.includes(`(${fn}.md)`), `wiki/index.md for '${name}' should link to ${fn}.md`);

      const row = indexText.split('\n').find((line) => line.includes(`(${fn}.md)`));
      assert.match(row, /v\d+\.\d+ report\.md/, `wiki/index.md row for '${fn}' in '${name}' must cite a version and report.md, got: ${row}`);
      assert.match(row, /src\/main\.py:\d+/, `wiki/index.md row for '${fn}' in '${name}' must cite a src/main.py:<line> code location, got: ${row}`);
    }
  });
}
