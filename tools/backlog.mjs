import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDocument, writeDocument, FileReadError, DocumentParseError, FileWriteError } from '../src/document-io.mjs';
import { validateDocument } from '../src/validate.mjs';
import { UPDATABLE_FIELDS, computeFieldUpdates, applyUpdate, TaskNotFoundError, NoUpdateOptionsError } from '../src/update.mjs';
import { filterAndSortTasks, validateFilters, renderTable, renderJson as renderTasksJson } from '../src/list.mjs';
import { findTaskById, renderText, renderJson as renderTaskJson } from '../src/show.mjs';
import { computeCreateFields, buildTask, MissingRequiredFieldsError } from '../src/add.mjs';

const EXIT_CODES = { OK: 0, DATA: 1, ARGS: 2, IO: 3 };

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Uses the local calendar date (not UTC) so "실행 날짜" matches the date the
// user actually sees on their machine — toISOString() would report the wrong
// day for part of the day in timezones ahead of UTC (e.g. KST).
function todayDateString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveFormat(raw, allowed, fallback) {
  if (raw === undefined) return fallback;
  return allowed.includes(raw) ? raw : null;
}

// list/show tolerate referential-integrity problems (dangling parent/deps,
// self-reference) and render best-effort, since they never write and
// `validate` is the dedicated tool for full integrity checks. A document
// whose root isn't even an object with a tasks array has nothing meaningful
// to list/show, so that structural shape is still treated as a data error.
function hasTaskArray(doc) {
  return doc !== null && typeof doc === 'object' && !Array.isArray(doc) && Array.isArray(doc.tasks);
}

function printValidationErrors(headline, result) {
  process.stderr.write(`${headline}\n`);
  for (const error of result.errors) {
    process.stderr.write(`  - ${error.path}: ${error.message} [${error.code}]\n`);
  }
}

async function runValidate(filePath) {
  let doc;
  try {
    doc = await readDocument(filePath);
  } catch (err) {
    if (err instanceof FileReadError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    if (err instanceof DocumentParseError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.DATA;
    }
    throw err;
  }

  const result = validateDocument(doc);
  if (result.valid) {
    process.stdout.write(`VALID ${result.taskCount} task(s)\n`);
    return EXIT_CODES.OK;
  }

  printValidationErrors(`INVALID: ${result.errors.length} problem(s) found in '${filePath}'`, result);
  return EXIT_CODES.DATA;
}

async function runList(filePath, rawFilters, format) {
  let doc;
  try {
    doc = await readDocument(filePath);
  } catch (err) {
    if (err instanceof FileReadError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    if (err instanceof DocumentParseError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.DATA;
    }
    throw err;
  }

  if (!hasTaskArray(doc)) {
    process.stderr.write(`Error: '${filePath}' is not a valid backlog document (root must be an object with a tasks array)\n`);
    return EXIT_CODES.DATA;
  }

  const filterErrors = validateFilters(rawFilters, doc.enums);
  if (filterErrors.length > 0) {
    process.stderr.write(`Error: ${filterErrors.join('; ')}\n`);
    return EXIT_CODES.DATA;
  }

  const filtered = filterAndSortTasks(doc.tasks, rawFilters);
  process.stdout.write(format === 'json' ? renderTasksJson(filtered) : renderTable(filtered));
  return EXIT_CODES.OK;
}

async function runShow(filePath, id, format) {
  let doc;
  try {
    doc = await readDocument(filePath);
  } catch (err) {
    if (err instanceof FileReadError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    if (err instanceof DocumentParseError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.DATA;
    }
    throw err;
  }

  if (!hasTaskArray(doc)) {
    process.stderr.write(`Error: '${filePath}' is not a valid backlog document (root must be an object with a tasks array)\n`);
    return EXIT_CODES.DATA;
  }

  const task = findTaskById(doc.tasks, id);
  if (!task) {
    const err = new TaskNotFoundError(id);
    process.stderr.write(`Error: ${err.message}\n`);
    return EXIT_CODES.DATA;
  }

  process.stdout.write(format === 'json' ? renderTaskJson(task) : renderText(task));
  return EXIT_CODES.OK;
}

async function runAdd(filePath, rawOptions) {
  let fields;
  try {
    fields = computeCreateFields(rawOptions);
  } catch (err) {
    if (err instanceof MissingRequiredFieldsError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.ARGS;
    }
    throw err;
  }

  let doc;
  try {
    doc = await readDocument(filePath);
  } catch (err) {
    if (err instanceof FileReadError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    if (err instanceof DocumentParseError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.DATA;
    }
    throw err;
  }

  const preResult = validateDocument(doc);
  if (!preResult.valid) {
    printValidationErrors(`Error: cannot add — '${filePath}' is already invalid (${preResult.errors.length} problem(s)):`, preResult);
    return EXIT_CODES.DATA;
  }

  const { doc: nextDoc, id } = buildTask(doc, fields, todayDateString());

  const postResult = validateDocument(nextDoc);
  if (!postResult.valid) {
    printValidationErrors(`Error: add would make '${filePath}' invalid (${postResult.errors.length} problem(s)):`, postResult);
    return EXIT_CODES.DATA;
  }

  try {
    await writeDocument(filePath, nextDoc);
  } catch (err) {
    if (err instanceof FileWriteError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    throw err;
  }

  process.stdout.write(`${id}\n`);
  return EXIT_CODES.OK;
}

async function runUpdate(filePath, id, rawOptions) {
  let fieldUpdates;
  try {
    fieldUpdates = computeFieldUpdates(rawOptions);
  } catch (err) {
    if (err instanceof NoUpdateOptionsError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.ARGS;
    }
    throw err;
  }

  let doc;
  try {
    doc = await readDocument(filePath);
  } catch (err) {
    if (err instanceof FileReadError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    if (err instanceof DocumentParseError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.DATA;
    }
    throw err;
  }

  const preResult = validateDocument(doc);
  if (!preResult.valid) {
    printValidationErrors(`Error: cannot update — '${filePath}' is already invalid (${preResult.errors.length} problem(s)):`, preResult);
    return EXIT_CODES.DATA;
  }

  let nextDoc;
  try {
    nextDoc = applyUpdate(doc, id, fieldUpdates, todayDateString());
  } catch (err) {
    if (err instanceof TaskNotFoundError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.DATA;
    }
    throw err;
  }

  const postResult = validateDocument(nextDoc);
  if (!postResult.valid) {
    printValidationErrors(`Error: update would make '${filePath}' invalid (${postResult.errors.length} problem(s)):`, postResult);
    return EXIT_CODES.DATA;
  }

  try {
    await writeDocument(filePath, nextDoc);
  } catch (err) {
    if (err instanceof FileWriteError) {
      process.stderr.write(`Error: ${err.message}\n`);
      return EXIT_CODES.IO;
    }
    throw err;
  }

  process.stdout.write(`Updated ${id}\n`);
  return EXIT_CODES.OK;
}

async function main(argv) {
  const options = { file: { type: 'string' }, format: { type: 'string' } };
  for (const field of UPDATABLE_FIELDS) {
    options[field] = { type: 'string' };
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return EXIT_CODES.ARGS;
  }

  const { values, positionals } = parsed;

  if (positionals.length === 0) {
    process.stderr.write('Error: missing command\n');
    return EXIT_CODES.ARGS;
  }

  const [command, ...rest] = positionals;

  const filePath = values.file !== undefined
    ? path.resolve(values.file)
    : path.join(projectRoot, 'backlog.json');

  if (command === 'validate') {
    const disallowed = [...UPDATABLE_FIELDS, 'format'].filter((field) => values[field] !== undefined);
    if (disallowed.length > 0) {
      process.stderr.write(`Error: unknown option(s) for validate: ${disallowed.map((field) => `--${field}`).join(', ')}\n`);
      return EXIT_CODES.ARGS;
    }
    if (rest.length > 0) {
      process.stderr.write(`Error: unexpected argument(s): ${rest.join(' ')}\n`);
      return EXIT_CODES.ARGS;
    }
    return runValidate(filePath);
  }

  if (command === 'list') {
    const listFilterFields = ['status', 'priority', 'category'];
    const disallowed = UPDATABLE_FIELDS.filter((field) => !listFilterFields.includes(field) && values[field] !== undefined);
    if (disallowed.length > 0) {
      process.stderr.write(`Error: unknown option(s) for list: ${disallowed.map((field) => `--${field}`).join(', ')}\n`);
      return EXIT_CODES.ARGS;
    }
    if (rest.length > 0) {
      process.stderr.write(`Error: unexpected argument(s): ${rest.join(' ')}\n`);
      return EXIT_CODES.ARGS;
    }
    const format = resolveFormat(values.format, ['table', 'json'], 'table');
    if (format === null) {
      process.stderr.write('Error: --format must be one of: table, json\n');
      return EXIT_CODES.ARGS;
    }
    return runList(filePath, { status: values.status, priority: values.priority, category: values.category }, format);
  }

  if (command === 'show') {
    const disallowed = UPDATABLE_FIELDS.filter((field) => values[field] !== undefined);
    if (disallowed.length > 0) {
      process.stderr.write(`Error: unknown option(s) for show: ${disallowed.map((field) => `--${field}`).join(', ')}\n`);
      return EXIT_CODES.ARGS;
    }
    if (rest.length === 0) {
      process.stderr.write('Error: missing task id\n');
      return EXIT_CODES.ARGS;
    }
    if (rest.length > 1) {
      process.stderr.write(`Error: unexpected argument(s): ${rest.slice(1).join(' ')}\n`);
      return EXIT_CODES.ARGS;
    }
    const format = resolveFormat(values.format, ['text', 'json'], 'text');
    if (format === null) {
      process.stderr.write('Error: --format must be one of: text, json\n');
      return EXIT_CODES.ARGS;
    }
    return runShow(filePath, rest[0], format);
  }

  if (command === 'add') {
    if (values.format !== undefined) {
      process.stderr.write('Error: unknown option for add: --format\n');
      return EXIT_CODES.ARGS;
    }
    if (rest.length > 0) {
      process.stderr.write(`Error: unexpected argument(s): ${rest.join(' ')}\n`);
      return EXIT_CODES.ARGS;
    }
    return runAdd(filePath, values);
  }

  if (command === 'update') {
    if (values.format !== undefined) {
      process.stderr.write('Error: unknown option for update: --format\n');
      return EXIT_CODES.ARGS;
    }
    if (rest.length === 0) {
      process.stderr.write('Error: missing task id\n');
      return EXIT_CODES.ARGS;
    }
    if (rest.length > 1) {
      process.stderr.write(`Error: unexpected argument(s): ${rest.slice(1).join(' ')}\n`);
      return EXIT_CODES.ARGS;
    }
    return runUpdate(filePath, rest[0], values);
  }

  process.stderr.write(`Error: unknown command '${command}'\n`);
  return EXIT_CODES.ARGS;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: unexpected failure: ${message}\n`);
  process.exitCode = EXIT_CODES.DATA;
}
