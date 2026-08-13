import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// v1.0 = 최초 등록. v2.0 = 담당자가 A->B로 바뀌어 메이저 증가. v2.1 = v2.0과 같은
// 담당자(B)가 다시 등록해 마이너 증가. CLAUDE.md §4의 메이저/마이너 규칙 그대로.
const CASES = [
  {
    project: 'display-defect-rate',
    versions: ['1.0', '2.0', '2.1'],
    authors: ['A', 'B', 'B'],
    v1OnlyMarker: null,
    v2OnlyMarker: 'overall_defect_rate',
  },
  {
    project: 'display-image-inspection',
    versions: ['1.0', '2.0', '2.1'],
    authors: ['C', 'D', 'D'],
    v1OnlyMarker: null,
    v2OnlyMarker: '평균 크기',
  },
];

for (const { project, versions, authors, v2OnlyMarker } of CASES) {
  const [v1, v2, v3] = versions;

  test(`'${project}' v${v1} snapshot exists and was not overwritten by v${v2}`, () => {
    const v1Main = path.join(projectRoot, '.claude', 'version-history', project, `v${v1}`, 'main.py');
    assert.ok(existsSync(v1Main), `missing ${v1Main}`);

    const v1Text = readFileSync(v1Main, 'utf8');
    assert.ok(
      !v1Text.includes(v2OnlyMarker),
      `v${v1}/main.py for '${project}' already contains the v${v2}-only marker '${v2OnlyMarker}' — v${v1} was overwritten`,
    );

    const v2Main = path.join(projectRoot, '.claude', 'version-history', project, `v${v2}`, 'main.py');
    assert.ok(existsSync(v2Main), `missing ${v2Main}`);
    const v2Text = readFileSync(v2Main, 'utf8');
    assert.ok(v2Text.includes(v2OnlyMarker), `v${v2}/main.py for '${project}' should contain '${v2OnlyMarker}'`);
  });

  test(`'${project}' registers each author's own MANUAL.md per version, not just code`, () => {
    for (const version of [v1, v2]) {
      const manualPath = path.join(projectRoot, '.claude', 'version-history', project, `v${version}`, 'MANUAL.md');
      assert.ok(existsSync(manualPath), `missing ${manualPath} — each version snapshot must include the manual the author wrote for that version`);
    }

    const v1Manual = readFileSync(path.join(projectRoot, '.claude', 'version-history', project, `v${v1}`, 'MANUAL.md'), 'utf8');
    const v2Manual = readFileSync(path.join(projectRoot, '.claude', 'version-history', project, `v${v2}`, 'MANUAL.md'), 'utf8');
    assert.notEqual(v1Manual, v2Manual, `v${v1} and v${v2} MANUAL.md for '${project}' are identical — expected the v${v2} author to have updated it`);
  });

  test(`'${project}' v${v3} (same author as v${v2}) is a minor bump and adds CODE_ANALYSIS.md without touching earlier versions`, () => {
    const [v2Major] = v2.split('.').map(Number);
    const [v3Major] = v3.split('.').map(Number);
    assert.equal(v3Major, v2Major, `v${v3} should share v${v2}'s major version (same author) — got major ${v3Major}`);

    const v3Analysis = path.join(projectRoot, '.claude', 'version-history', project, `v${v3}`, 'CODE_ANALYSIS.md');
    assert.ok(existsSync(v3Analysis), `missing ${v3Analysis} — CODE_ANALYSIS.md is a 2026-08-13+ requirement, only mandatory from v${v3} onward`);

    for (const version of [v1, v2]) {
      const oldAnalysis = path.join(projectRoot, '.claude', 'version-history', project, `v${version}`, 'CODE_ANALYSIS.md');
      assert.ok(
        !existsSync(oldAnalysis),
        `${oldAnalysis} should not exist — CODE_ANALYSIS.md postdates v${version} and must not be backfilled into an already-registered snapshot`,
      );
    }

    const text = readFileSync(v3Analysis, 'utf8');
    for (const heading of ['## 구현 개요', '## 핵심 로직 설명', '## 이번 버전에서 바뀐 점과 이유', '## 알려진 제약 · 다음에 볼 사람이 알아야 할 것']) {
      assert.ok(text.includes(heading), `v${v3} CODE_ANALYSIS.md for '${project}' missing heading '${heading}'`);
    }
  });

  test(`'${project}' history.json has 3 entries: versions ${versions.join(', ')} with authors ${authors.join(', ')}`, () => {
    const historyPath = path.join(projectRoot, '.claude', 'version-history', project, 'history.json');
    assert.ok(existsSync(historyPath), `missing ${historyPath}`);

    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    assert.equal(history.versions.length, 3, `expected 3 version entries for '${project}'`);

    const sorted = [...history.versions].sort((a, b) => {
      const [aMajor, aMinor] = a.version.split('.').map(Number);
      const [bMajor, bMinor] = b.version.split('.').map(Number);
      return aMajor - bMajor || aMinor - bMinor;
    });
    assert.deepEqual(sorted.map((v) => v.version), versions);
    assert.deepEqual(sorted.map((v) => v.author), authors);
  });
}

test('tools/version.mjs bumps the major version when the author changes and the minor version when the author repeats', () => {
  const scratchProject = `__test-versioning-scratch-${process.pid}`;
  const scratchDir = path.join(projectRoot, 'samples', scratchProject);
  const historyDir = path.join(projectRoot, '.claude', 'version-history', scratchProject);

  try {
    mkdirSync(scratchDir, { recursive: true });
    writeFileSync(path.join(scratchDir, 'main.py'), 'print("scratch")\n');

    const register = (author) => spawnSync(
      'node',
      ['tools/version.mjs', 'register', '--project', scratchProject, '--author', author, '--summary', 'scratch test'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    const r1 = register('X');
    assert.equal(r1.status, 0, r1.stderr);
    assert.match(r1.stdout, /v1\.0/);

    const r2 = register('X');
    assert.equal(r2.status, 0, r2.stderr);
    assert.match(r2.stdout, /v1\.1/, 'same author should bump the minor version');

    const r3 = register('Y');
    assert.equal(r3.status, 0, r3.stderr);
    assert.match(r3.stdout, /v2\.0/, 'a different author should bump the major version and reset minor to 0');
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
    rmSync(historyDir, { recursive: true, force: true });
  }
});

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

  const GITHUB_REPO_URL = 'https://github.com/nampluskr/workflow-hub';
  for (const { project, versions } of CASES) {
    const [v1, v2, v3] = versions;

    for (const version of versions) {
      assert.ok(html.includes(`>v${version}<`), `dashboard missing v${version} badge for '${project}'`);

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

    const v3AnalysisUrl = `${GITHUB_REPO_URL}/blob/main/.claude/version-history/${project}/v${v3}/CODE_ANALYSIS.md`;
    assert.ok(html.includes(v3AnalysisUrl), `dashboard missing v${v3} analysis link for '${project}'`);

    for (const version of [v1, v2]) {
      const oldAnalysisUrl = `${GITHUB_REPO_URL}/blob/main/.claude/version-history/${project}/v${version}/CODE_ANALYSIS.md`;
      assert.ok(
        !html.includes(oldAnalysisUrl),
        `dashboard should not link an analysis doc for v${version} of '${project}' (it doesn't exist in that snapshot)`,
      );
    }
  }
});
