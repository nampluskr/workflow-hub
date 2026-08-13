import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// report.md의 "핵심 로직 설명" 절에 실제로 등장하는 이름만 넣는다 — 그 절 밖에서만
// 언급되는 이름(예: display-image-inspection의 load_pgm/analyze_image/main)은
// NAVIGATION.md 행에 나오면 안 된다(CLAUDE.md §6, Codex 반박 검증 2026-08-13에서 확인).
const SAMPLE_FUNCTIONS = {
  'display-defect-rate': ['aggregate', 'print_table', 'write_report'],
  'display-image-inspection': ['estimate_background', 'find_defect_clusters'],
};

const CODE_LOCATION_PATTERN = /src\/main\.py:\d+/;

for (const [name, functions] of Object.entries(SAMPLE_FUNCTIONS)) {
  test(`sample '${name}' has NAVIGATION.md`, () => {
    const navPath = path.join(projectRoot, 'samples', name, 'NAVIGATION.md');
    assert.ok(existsSync(navPath), `missing ${navPath} — run the version-navigator subagent for '${name}'`);
  });

  test(`sample '${name}' NAVIGATION.md has a row for every core function with a version and a src/main.py:<line> location`, () => {
    const navPath = path.join(projectRoot, 'samples', name, 'NAVIGATION.md');
    const text = readFileSync(navPath, 'utf8');

    for (const fn of functions) {
      const lineWithFn = text.split('\n').find((line) => line.includes(fn));
      assert.ok(lineWithFn, `NAVIGATION.md for '${name}' has no row mentioning '${fn}'`);
      assert.match(
        lineWithFn,
        CODE_LOCATION_PATTERN,
        `row for '${fn}' in '${name}' NAVIGATION.md must include a 'src/main.py:<line>' code location, got: ${lineWithFn}`,
      );
      assert.match(
        lineWithFn,
        /report\.md/,
        `row for '${fn}' in '${name}' NAVIGATION.md must reference which report.md section documents it, got: ${lineWithFn}`,
      );
    }
  });

  // 두 샘플 모두 "핵심 로직 설명" 내용이 최초 도입 버전(v2.1) 이후 바뀐 적이 없어서,
  // 정확한 인덱스는 매 행마다 같은(가장 높은) 버전 하나만 가리키는 게 맞다 — 실제로 안 바뀐
  // 내용을 여러 버전에 걸쳐 있다고 중복 표기하면 그게 오히려 지어내는 것이다. 그래서 "여러
  // 버전이 언급돼야 한다"를 강제하는 테스트는 두지 않는다(2026-08-13, Codex 검증 이후 결정).
  test(`sample '${name}' NAVIGATION.md rows all cite the single highest version where each name appears`, () => {
    const navPath = path.join(projectRoot, 'samples', name, 'NAVIGATION.md');
    const text = readFileSync(navPath, 'utf8');
    for (const fn of functions) {
      const lineWithFn = text.split('\n').find((line) => line.includes(fn));
      const versionsInRow = lineWithFn.match(/v\d+\.\d+/g) ?? [];
      assert.equal(
        versionsInRow.length,
        1,
        `row for '${fn}' in '${name}' NAVIGATION.md should cite exactly one version (the highest where it's documented), got: ${lineWithFn}`,
      );
    }
  });
}
