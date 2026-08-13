import { parseArgs } from 'node:util';
import path from 'node:path';
import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readDocument, writeDocument, FileReadError, DocumentParseError } from '../src/document-io.mjs';

const EXIT_CODES = { OK: 0, DATA: 1, ARGS: 2, IO: 3 };

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function todayDateString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function historyPathFor(project) {
  return path.join(projectRoot, '.claude', 'version-history', project, 'history.json');
}

function snapshotDirFor(project, version) {
  return path.join(projectRoot, '.claude', 'version-history', project, `v${version}`);
}

async function loadHistory(project) {
  const filePath = historyPathFor(project);
  if (!existsSync(filePath)) {
    return { project, versions: [] };
  }
  try {
    return await readDocument(filePath);
  } catch (err) {
    if (err instanceof FileReadError || err instanceof DocumentParseError) {
      throw new Error(`failed to read history for '${project}': ${err.message}`);
    }
    throw err;
  }
}

// version 문자열 "major.minor"를 {major, minor}로 변환한다.
function parseVersion(v) {
  const [major, minor] = String(v).split('.').map(Number);
  return { major, minor: minor ?? 0 };
}

function formatVersion({ major, minor }) {
  return `${major}.${minor}`;
}

// 이력에서 가장 높은 (major, minor) 항목을 찾는다. 없으면 null.
function latestEntry(history) {
  let latest = null;
  let latestParsed = null;
  for (const entry of history.versions) {
    const parsed = parseVersion(entry.version);
    if (!latestParsed || parsed.major > latestParsed.major || (parsed.major === latestParsed.major && parsed.minor > latestParsed.minor)) {
      latest = entry;
      latestParsed = parsed;
    }
  }
  return latest;
}

// 담당자 변경 = 메이저 버전 증가(vN.0), 같은 담당자의 연속 수정 = 마이너 버전 증가(vN.M -> vN.(M+1)).
// 최초 등록은 언제나 v1.0이다.
function nextVersion(history, author) {
  const latest = latestEntry(history);
  if (!latest) return { major: 1, minor: 0 };

  const parsed = parseVersion(latest.version);
  if (latest.author === author) {
    return { major: parsed.major, minor: parsed.minor + 1 };
  }
  return { major: parsed.major + 1, minor: 0 };
}

async function runRegister({ project, author, summary }) {
  const sampleDir = path.join(projectRoot, 'samples', project);
  if (!existsSync(sampleDir)) {
    process.stderr.write(`Error: no such sample project 'samples/${project}'\n`);
    return EXIT_CODES.ARGS;
  }

  const history = await loadHistory(project);
  const version = formatVersion(nextVersion(history, author));
  const snapshotDir = snapshotDirFor(project, version);

  if (existsSync(snapshotDir)) {
    process.stderr.write(`Error: snapshot already exists at ${path.relative(projectRoot, snapshotDir)} — refusing to overwrite\n`);
    return EXIT_CODES.DATA;
  }

  mkdirSync(path.dirname(snapshotDir), { recursive: true });
  cpSync(sampleDir, snapshotDir, { recursive: true });

  history.project = project;
  history.versions.push({
    version,
    author,
    date: todayDateString(),
    summary,
  });

  await writeDocument(historyPathFor(project), history);

  process.stdout.write(`Registered ${project} v${version} (${author})\n`);
  return EXIT_CODES.OK;
}

async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        project: { type: 'string' },
        author: { type: 'string' },
        summary: { type: 'string' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return EXIT_CODES.ARGS;
  }

  const { values, positionals } = parsed;
  const [command] = positionals;

  if (command !== 'register') {
    process.stderr.write("Error: unknown command (expected 'register')\n");
    return EXIT_CODES.ARGS;
  }

  const missing = ['project', 'author', 'summary'].filter((field) => values[field] === undefined);
  if (missing.length > 0) {
    process.stderr.write(`Error: register requires ${missing.map((f) => `--${f}`).join(', ')}\n`);
    return EXIT_CODES.ARGS;
  }

  return runRegister(values);
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: unexpected failure: ${message}\n`);
  process.exitCode = EXIT_CODES.DATA;
}
