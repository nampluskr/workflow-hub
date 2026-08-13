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

function nextVersionNumber(history) {
  let max = 0;
  for (const entry of history.versions) {
    if (typeof entry.version === 'number' && entry.version > max) max = entry.version;
  }
  return max + 1;
}

async function runRegister({ project, author, summary }) {
  const sampleDir = path.join(projectRoot, 'samples', project);
  if (!existsSync(sampleDir)) {
    process.stderr.write(`Error: no such sample project 'samples/${project}'\n`);
    return EXIT_CODES.ARGS;
  }

  const history = await loadHistory(project);
  const version = nextVersionNumber(history);
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
