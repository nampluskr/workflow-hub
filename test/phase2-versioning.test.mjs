import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 프로젝트별 버전 계보. 각 버전은 등록 당시의 디렉터리 관례를 그대로 반영한다 —
// v1.0/v2.0: main.py+MANUAL.md만 있던 최초 구조.
// v2.1: 같은 구조에 CODE_ANALYSIS.md만 루트에 추가(2026-08-13, 문서 요구사항 도입).
// v2.2: README.md/src/main.py/docs/report.md로 재정리(2026-08-13, 개별 레포 전환 대비).
// 과거 버전에 새 관례를 소급 적용하지 않는다는 원칙(CLAUDE.md §1)을 그대로 검증한다.
const CASES = [
  {
    project: 'display-defect-rate',
    v2OnlyMarker: 'overall_defect_rate',
    versions: [
      { version: '1.0', author: 'A', main: 'main.py', manual: 'MANUAL.md', analysis: null },
      { version: '2.0', author: 'B', main: 'main.py', manual: 'MANUAL.md', analysis: null },
      { version: '2.1', author: 'B', main: 'main.py', manual: 'MANUAL.md', analysis: 'CODE_ANALYSIS.md' },
      { version: '2.2', author: 'B', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.3', author: 'B', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.4', author: 'B', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.5', author: 'B', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.6', author: 'B', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
    ],
  },
  {
    project: 'display-image-inspection',
    v2OnlyMarker: '평균 크기',
    versions: [
      { version: '1.0', author: 'C', main: 'main.py', manual: 'MANUAL.md', analysis: null },
      { version: '2.0', author: 'D', main: 'main.py', manual: 'MANUAL.md', analysis: null },
      { version: '2.1', author: 'D', main: 'main.py', manual: 'MANUAL.md', analysis: 'CODE_ANALYSIS.md' },
      { version: '2.2', author: 'D', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.3', author: 'D', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.4', author: 'D', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.5', author: 'D', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
      { version: '2.6', author: 'D', main: 'src/main.py', manual: 'README.md', analysis: 'docs/report.md' },
    ],
  },
];

function snapshotPath(project, version, ...rest) {
  return path.join(projectRoot, '.claude', 'version-history', project, `v${version}`, ...rest);
}

for (const { project, v2OnlyMarker, versions } of CASES) {
  const [v1, v2, v3, v4, v5, v6] = versions;

  test(`'${project}' v${v1.version} snapshot exists and was not overwritten by v${v2.version}`, () => {
    const v1Main = snapshotPath(project, v1.version, v1.main);
    assert.ok(existsSync(v1Main), `missing ${v1Main}`);

    const v1Text = readFileSync(v1Main, 'utf8');
    assert.ok(
      !v1Text.includes(v2OnlyMarker),
      `v${v1.version}/${v1.main} for '${project}' already contains the v${v2.version}-only marker '${v2OnlyMarker}' — v${v1.version} was overwritten`,
    );

    const v2Main = snapshotPath(project, v2.version, v2.main);
    assert.ok(existsSync(v2Main), `missing ${v2Main}`);
    const v2Text = readFileSync(v2Main, 'utf8');
    assert.ok(v2Text.includes(v2OnlyMarker), `v${v2.version}/${v2.main} for '${project}' should contain '${v2OnlyMarker}'`);
  });

  test(`'${project}' registers each author's own manual per version, not just code`, () => {
    for (const v of [v1, v2]) {
      const manualPath = snapshotPath(project, v.version, v.manual);
      assert.ok(existsSync(manualPath), `missing ${manualPath} — each version snapshot must include the manual the author wrote for that version`);
    }

    const v1Manual = readFileSync(snapshotPath(project, v1.version, v1.manual), 'utf8');
    const v2Manual = readFileSync(snapshotPath(project, v2.version, v2.manual), 'utf8');
    assert.notEqual(v1Manual, v2Manual, `v${v1.version} and v${v2.version} manuals for '${project}' are identical — expected the v${v2.version} author to have updated it`);
  });

  test(`'${project}' v${v3.version} (same author as v${v2.version}) is a minor bump and adds an analysis doc without touching earlier versions`, () => {
    const [v2Major] = v2.version.split('.').map(Number);
    const [v3Major] = v3.version.split('.').map(Number);
    assert.equal(v3Major, v2Major, `v${v3.version} should share v${v2.version}'s major version (same author) — got major ${v3Major}`);

    const v3Analysis = snapshotPath(project, v3.version, v3.analysis);
    assert.ok(existsSync(v3Analysis), `missing ${v3Analysis} — analysis doc is a 2026-08-13+ requirement, only mandatory from v${v3.version} onward`);

    for (const v of [v1, v2]) {
      assert.equal(v.analysis, null, `test data inconsistency: v${v.version} should not have an analysis doc yet`);
    }

    const text = readFileSync(v3Analysis, 'utf8');
    for (const heading of ['## 구현 개요', '## 핵심 로직 설명', '## 이번 버전에서 바뀐 점과 이유', '## 알려진 제약 · 다음에 볼 사람이 알아야 할 것']) {
      assert.ok(text.includes(heading), `v${v3.version} analysis doc for '${project}' missing heading '${heading}'`);
    }
  });

  test(`'${project}' v${v4.version} (same author as v${v3.version}) restructures into README.md/src/docs without touching earlier versions`, () => {
    const [v3Major] = v3.version.split('.').map(Number);
    const [v4Major] = v4.version.split('.').map(Number);
    assert.equal(v4Major, v3Major, `v${v4.version} should share v${v3.version}'s major version (same author) — got major ${v4Major}`);

    for (const rel of ['README.md', path.join('src', 'main.py'), path.join('docs', 'report.md')]) {
      const p = snapshotPath(project, v4.version, rel);
      assert.ok(existsSync(p), `missing ${p}`);
    }

    // v3(v2.1)의 옛 구조(main.py/MANUAL.md/CODE_ANALYSIS.md가 루트)는 그대로 남아 있어야 한다.
    for (const rel of ['main.py', 'MANUAL.md', 'CODE_ANALYSIS.md']) {
      const p = snapshotPath(project, v3.version, rel);
      assert.ok(existsSync(p), `v${v3.version} snapshot should retain its original flat layout at ${p}`);
    }
    // v4(v2.2)에는 옛 이름의 파일이 루트에 남아있으면 안 된다(구조 자체가 바뀐 것이므로).
    for (const rel of ['main.py', 'MANUAL.md', 'CODE_ANALYSIS.md']) {
      const p = snapshotPath(project, v4.version, rel);
      assert.ok(!existsSync(p), `v${v4.version} should not have the old flat-layout file at ${p}`);
    }
  });

  test(`'${project}' v${v5.version} (same author as v${v4.version}) adds NAVIGATION.md, generated before registration (Phase 3 redefinition)`, () => {
    const [v4Major] = v4.version.split('.').map(Number);
    const [v5Major] = v5.version.split('.').map(Number);
    assert.equal(v5Major, v4Major, `v${v5.version} should share v${v4.version}'s major version (same author) — got major ${v5Major}`);

    const v5Nav = snapshotPath(project, v5.version, 'NAVIGATION.md');
    assert.ok(existsSync(v5Nav), `missing ${v5Nav} — version-navigator must run before tools/version.mjs register so NAVIGATION.md lands in this snapshot`);

    // v4(v2.2)는 NAVIGATION.md 도입 이전 스냅샷이므로 없어야 정상이다(소급 적용 금지).
    const v4Nav = snapshotPath(project, v4.version, 'NAVIGATION.md');
    assert.ok(!existsSync(v4Nav), `v${v4.version} predates NAVIGATION.md — should not retroactively have it at ${v4Nav}`);
  });

  // v5(v2.3)의 NAVIGATION.md는 Codex 검증(2026-08-13)에서 두 가지 문제가 지적됐다 —
  // ①"핵심 로직 설명"에 없는 이름까지 행에 넣음, ②코드 위치를 여러 줄로 병기함.
  // v6(v2.4)에서 고쳤다. 이력 불변 원칙상 v5 스냅샷은 그 결함 있는 상태 그대로 남아야
  // 하고, v6은 고쳐진 상태여야 한다 — 즉 두 스냅샷의 NAVIGATION.md는 서로 달라야 한다.
  test(`'${project}' v${v6.version} (same author as v${v5.version}) fixes NAVIGATION.md accuracy issues found by Codex review without touching v${v5.version}'s snapshot`, () => {
    const [v5Major] = v5.version.split('.').map(Number);
    const [v6Major] = v6.version.split('.').map(Number);
    assert.equal(v6Major, v5Major, `v${v6.version} should share v${v5.version}'s major version (same author) — got major ${v6Major}`);

    const v5Nav = snapshotPath(project, v5.version, 'NAVIGATION.md');
    const v6Nav = snapshotPath(project, v6.version, 'NAVIGATION.md');
    assert.ok(existsSync(v6Nav), `missing ${v6Nav}`);
    assert.ok(existsSync(v5Nav), `missing ${v5Nav} — v${v5.version}'s (flawed) snapshot must still exist, not be deleted`);

    const v5Text = readFileSync(v5Nav, 'utf8');
    const v6Text = readFileSync(v6Nav, 'utf8');
    assert.notEqual(v6Text, v5Text, `v${v6.version} NAVIGATION.md for '${project}' should differ from v${v5.version}'s — the fix should be visible`);

    // v6의 각 행은 코드 위치가 정확히 하나여야 한다(여러 줄 병기 금지).
    for (const line of v6Text.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---'))) {
      const locationCells = line.match(/src\/main\.py:\d+/g) ?? [];
      assert.ok(locationCells.length <= 1, `v${v6.version} NAVIGATION.md row should not list multiple code locations: ${line}`);
    }
  });

  test(`'${project}' history.json has ${versions.length} entries: versions ${versions.map((v) => v.version).join(', ')} with authors ${versions.map((v) => v.author).join(', ')}`, () => {
    const historyPath = path.join(projectRoot, '.claude', 'version-history', project, 'history.json');
    assert.ok(existsSync(historyPath), `missing ${historyPath}`);

    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    assert.equal(history.versions.length, versions.length, `expected ${versions.length} version entries for '${project}'`);

    const sorted = [...history.versions].sort((a, b) => {
      const [aMajor, aMinor] = a.version.split('.').map(Number);
      const [bMajor, bMinor] = b.version.split('.').map(Number);
      return aMajor - bMajor || aMinor - bMinor;
    });
    assert.deepEqual(sorted.map((v) => v.version), versions.map((v) => v.version));
    assert.deepEqual(sorted.map((v) => v.author), versions.map((v) => v.author));
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
      file_path: path.join(projectRoot, 'samples', 'display-defect-rate', 'src', 'main.py'),
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
  for (const { project, versions } of CASES) {
    assert.ok(html.includes(project), `dashboard missing project name '${project}'`);
    for (const { author } of versions) {
      assert.ok(html.includes(`>${author}<`), `dashboard missing author '${author}' for '${project}'`);
    }
  }

  // 링크 라벨은 "보고서"(분석 문서, 있을 때만) · "코드"(저장소/폴더로 이동)
  // 둘뿐이다 — "매뉴얼"은 GitHub 폴더 페이지에서 README.md가 자동
  // 렌더링되므로 따로 두지 않고, 예전 라벨("분석"·"깃헙")도 더 이상 안 쓴다.
  assert.ok(!html.includes('>매뉴얼<'), 'dashboard should not render a "매뉴얼" link');
  assert.ok(!html.includes('>분석<'), 'dashboard should use the "보고서" label, not "분석"');
  assert.ok(!html.includes('>깃헙<'), 'dashboard should use the "코드" label, not "깃헙"');
  assert.ok(html.includes('>코드<'), 'dashboard should render a "코드" link');

  const GITHUB_REPO_URL = 'https://github.com/nampluskr/workflow-hub';
  for (const { project, versions } of CASES) {
    for (const v of versions) {
      assert.ok(html.includes(`>v${v.version}<`), `dashboard missing v${v.version} badge for '${project}'`);

      const snap = `.claude/version-history/${project}/v${v.version}`;
      assert.ok(
        html.includes(`${GITHUB_REPO_URL}/tree/main/${snap}`),
        `dashboard missing GitHub tree link for ${snap}`,
      );

      const analysisUrl = v.analysis ? `${GITHUB_REPO_URL}/blob/main/${snap}/${v.analysis.replaceAll('\\', '/')}` : null;
      if (analysisUrl) {
        assert.ok(html.includes(analysisUrl), `dashboard missing analysis link for v${v.version} of '${project}'`);
      }
    }
  }
});
