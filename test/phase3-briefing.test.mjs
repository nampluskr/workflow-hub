import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_BRIEFING_HEADINGS = ['## 용도', '## 입출력', '## 수정 시 건드릴 파일', '## 최근 버전 이력'];

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
  test(`sample '${name}' has BRIEFING.md with all four handoff sections in order`, () => {
    const briefingPath = path.join(projectRoot, 'samples', name, 'BRIEFING.md');
    assert.ok(existsSync(briefingPath), `missing ${briefingPath} — run the handoff-briefing subagent for '${name}'`);
    assertHeadingsInOrder(readFileSync(briefingPath, 'utf8'), REQUIRED_BRIEFING_HEADINGS, `BRIEFING.md for '${name}'`);
  });

  test(`sample '${name}' BRIEFING.md has non-empty content under every one of the four sections`, () => {
    const briefingPath = path.join(projectRoot, 'samples', name, 'BRIEFING.md');
    const text = readFileSync(briefingPath, 'utf8');
    for (let i = 0; i < REQUIRED_BRIEFING_HEADINGS.length; i++) {
      const heading = REQUIRED_BRIEFING_HEADINGS[i];
      const nextHeading = REQUIRED_BRIEFING_HEADINGS[i + 1];
      const start = text.indexOf(heading) + heading.length;
      const end = nextHeading ? text.indexOf(nextHeading, start) : text.length;
      const body = text.slice(start, end).trim();
      assert.ok(body.length > 0, `BRIEFING.md for '${name}' has an empty '${heading}' section`);
    }
  });
}
