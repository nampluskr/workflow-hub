import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CASES = [
  {
    project: 'display-defect-rate',
    authors: ['A', 'B'],
    v1OnlyMarker: null,
    v2OnlyMarker: 'overall_defect_rate',
  },
  {
    project: 'display-image-inspection',
    authors: ['C', 'D'],
    v1OnlyMarker: null,
    v2OnlyMarker: '평균 크기',
  },
];

for (const { project, authors, v2OnlyMarker } of CASES) {
  test(`'${project}' v1 snapshot exists and was not overwritten by v2`, () => {
    const v1Main = path.join(projectRoot, '.claude', 'version-history', project, 'v1', 'main.py');
    assert.ok(existsSync(v1Main), `missing ${v1Main}`);

    const v1Text = readFileSync(v1Main, 'utf8');
    assert.ok(
      !v1Text.includes(v2OnlyMarker),
      `v1/main.py for '${project}' already contains the v2-only marker '${v2OnlyMarker}' — v1 was overwritten`,
    );

    const v2Main = path.join(projectRoot, '.claude', 'version-history', project, 'v2', 'main.py');
    assert.ok(existsSync(v2Main), `missing ${v2Main}`);
    const v2Text = readFileSync(v2Main, 'utf8');
    assert.ok(v2Text.includes(v2OnlyMarker), `v2/main.py for '${project}' should contain '${v2OnlyMarker}'`);
  });

  test(`'${project}' registers each author's own MANUAL.md per version, not just code`, () => {
    for (const version of [1, 2]) {
      const manualPath = path.join(projectRoot, '.claude', 'version-history', project, `v${version}`, 'MANUAL.md');
      assert.ok(existsSync(manualPath), `missing ${manualPath} — each version snapshot must include the manual the author wrote for that version`);
    }

    const v1Manual = readFileSync(path.join(projectRoot, '.claude', 'version-history', project, 'v1', 'MANUAL.md'), 'utf8');
    const v2Manual = readFileSync(path.join(projectRoot, '.claude', 'version-history', project, 'v2', 'MANUAL.md'), 'utf8');
    assert.notEqual(v1Manual, v2Manual, `v1 and v2 MANUAL.md for '${project}' are identical — expected the v2 author to have updated it`);
  });

  test(`'${project}' history.json has 2 entries with authors ${authors.join(', ')}`, () => {
    const historyPath = path.join(projectRoot, '.claude', 'version-history', project, 'history.json');
    assert.ok(existsSync(historyPath), `missing ${historyPath}`);

    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    assert.equal(history.versions.length, 2, `expected 2 version entries for '${project}'`);

    const recordedAuthors = history.versions
      .sort((a, b) => a.version - b.version)
      .map((v) => v.author);
    assert.deepEqual(recordedAuthors, authors);
  });
}

test('version-history-guard denies a direct Edit under .claude/version-history/', () => {
  const targetFile = path.join(
    projectRoot,
    '.claude',
    'version-history',
    'display-defect-rate',
    'history.json',
  );

  const event = {
    cwd: projectRoot,
    tool_name: 'Edit',
    tool_input: {
      file_path: targetFile,
      old_string: 'x',
      new_string: 'y',
    },
  };

  const result = spawnSync('node', ['.claude/hooks/version-history-guard.mjs'], {
    cwd: projectRoot,
    input: JSON.stringify(event),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `hook exited non-zero: ${result.stderr}`);
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
});

test('version-history-guard allows a path outside .claude/version-history/', () => {
  const event = {
    cwd: projectRoot,
    tool_name: 'Edit',
    tool_input: {
      file_path: path.join(projectRoot, 'samples', 'display-defect-rate', 'main.py'),
      old_string: 'x',
      new_string: 'y',
    },
  };

  const result = spawnSync('node', ['.claude/hooks/version-history-guard.mjs'], {
    cwd: projectRoot,
    input: JSON.stringify(event),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('dashboard generator produces index.html listing every project, version, and author', () => {
  const result = spawnSync('node', ['tools/dashboard.mjs'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `dashboard.mjs failed: ${result.stderr}`);

  const dashboardPath = path.join(projectRoot, 'dashboard', 'index.html');
  assert.ok(existsSync(dashboardPath), `missing ${dashboardPath}`);

  const html = readFileSync(dashboardPath, 'utf8');
  for (const { project, authors } of CASES) {
    assert.ok(html.includes(project), `dashboard missing project name '${project}'`);
    for (const author of authors) {
      assert.ok(html.includes(`>${author}<`), `dashboard missing author '${author}' for '${project}'`);
    }
  }
  assert.ok(html.includes('>v1<'), 'dashboard missing v1 badge');
  assert.ok(html.includes('>v2<'), 'dashboard missing v2 badge');

  const GITHUB_REPO_URL = 'https://github.com/nampluskr/workflow-hub';
  for (const { project } of CASES) {
    for (const version of [1, 2]) {
      const snapshotPath = `.claude/version-history/${project}/v${version}`;
      assert.ok(
        html.includes(`${GITHUB_REPO_URL}/blob/main/${snapshotPath}/main.py`),
        `dashboard missing GitHub code link for ${snapshotPath}`,
      );
      assert.ok(
        html.includes(`${GITHUB_REPO_URL}/blob/main/${snapshotPath}/MANUAL.md`),
        `dashboard missing GitHub manual link for ${snapshotPath}`,
      );
      assert.ok(
        html.includes(`${GITHUB_REPO_URL}/tree/main/${snapshotPath}`),
        `dashboard missing GitHub tree link for ${snapshotPath}`,
      );
    }
  }
});
