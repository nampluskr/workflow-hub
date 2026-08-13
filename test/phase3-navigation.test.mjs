import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SAMPLE_FUNCTIONS = {
  'display-defect-rate': ['aggregate', 'print_table', 'write_report', 'overall_defect_rate'],
  'display-image-inspection': ['load_pgm', 'estimate_background', 'find_defect_clusters'],
};

const CODE_LOCATION_PATTERN = /src\/main\.py:\d+/;
const VERSION_PATTERN = /v\d+\.\d+/g;

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

  test(`sample '${name}' NAVIGATION.md is a cumulative index spanning at least two versions`, () => {
    const navPath = path.join(projectRoot, 'samples', name, 'NAVIGATION.md');
    const text = readFileSync(navPath, 'utf8');
    const versions = new Set(text.match(VERSION_PATTERN) ?? []);
    assert.ok(
      versions.size >= 2,
      `NAVIGATION.md for '${name}' should reference at least 2 distinct versions across the report.md history, found: ${[...versions].join(', ')}`,
    );
  });
}
