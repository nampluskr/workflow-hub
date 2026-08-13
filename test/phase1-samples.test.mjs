import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_MANUAL_HEADINGS = ['## 용도', '## 입출력', '## 실행 방법', '## 수정 시 참고'];
const REQUIRED_ANALYSIS_HEADINGS = [
  '## 구현 개요',
  '## 핵심 로직 설명',
  '## 이번 버전에서 바뀐 점과 이유',
  '## 알려진 제약 · 다음에 볼 사람이 알아야 할 것',
];

const SAMPLES = ['display-defect-rate', 'display-image-inspection'];

function assertHeadingsInOrder(text, headings, label) {
  let searchFrom = 0;
  for (const heading of headings) {
    const idx = text.indexOf(heading, searchFrom);
    assert.notEqual(idx, -1, `${label} missing heading '${heading}' (or out of order)`);
    searchFrom = idx + heading.length;
  }
}

for (const name of SAMPLES) {
  test(`sample '${name}' has main.py at the required path`, () => {
    const mainPath = path.join(projectRoot, 'samples', name, 'main.py');
    assert.ok(existsSync(mainPath), `missing ${mainPath}`);
  });

  test(`sample '${name}' has MANUAL.md with all required sections in order`, () => {
    const manualPath = path.join(projectRoot, 'samples', name, 'MANUAL.md');
    assert.ok(existsSync(manualPath), `missing ${manualPath}`);
    assertHeadingsInOrder(readFileSync(manualPath, 'utf8'), REQUIRED_MANUAL_HEADINGS, `MANUAL.md for '${name}'`);
  });

  test(`sample '${name}' has CODE_ANALYSIS.md with all required sections in order`, () => {
    const analysisPath = path.join(projectRoot, 'samples', name, 'CODE_ANALYSIS.md');
    assert.ok(existsSync(analysisPath), `missing ${analysisPath}`);
    assertHeadingsInOrder(readFileSync(analysisPath, 'utf8'), REQUIRED_ANALYSIS_HEADINGS, `CODE_ANALYSIS.md for '${name}'`);
  });
}
