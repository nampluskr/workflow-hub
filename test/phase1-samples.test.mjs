import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_MANUAL_HEADINGS = ['## 용도', '## 입출력', '## 실행 방법', '## 수정 시 참고'];

const SAMPLES = ['display-defect-rate', 'display-image-inspection'];

for (const name of SAMPLES) {
  test(`sample '${name}' has main.py at the required path`, () => {
    const mainPath = path.join(projectRoot, 'samples', name, 'main.py');
    assert.ok(existsSync(mainPath), `missing ${mainPath}`);
  });

  test(`sample '${name}' has MANUAL.md with all required sections in order`, () => {
    const manualPath = path.join(projectRoot, 'samples', name, 'MANUAL.md');
    assert.ok(existsSync(manualPath), `missing ${manualPath}`);

    const text = readFileSync(manualPath, 'utf8');
    let searchFrom = 0;
    for (const heading of REQUIRED_MANUAL_HEADINGS) {
      const idx = text.indexOf(heading, searchFrom);
      assert.notEqual(idx, -1, `MANUAL.md for '${name}' missing heading '${heading}' (or out of order)`);
      searchFrom = idx + heading.length;
    }
  });
}
