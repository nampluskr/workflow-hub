import { UPDATABLE_FIELDS, NULLABLE_FIELDS, parseDepsValue } from './update.mjs';

export const REQUIRED_CREATE_FIELDS = Object.freeze(['title', 'category']);

const ID_NUM_RE = /^LB-(\d+)$/;

export class MissingRequiredFieldsError extends Error {
  constructor(missingFields) {
    super(`add requires ${missingFields.map((field) => `--${field}`).join(' and ')}`);
    this.name = 'MissingRequiredFieldsError';
    this.missingFields = missingFields;
  }
}

/**
 * Scans tasks for ids matching LB-<digits> (format-validity is validate.mjs's
 * job, not this function's) and returns the next id as max+1, formatted
 * LB-### with a 3-digit minimum. padStart only pads up to 3 chars — it does
 * not truncate, so LB-999 correctly rolls over to LB-1000.
 * @param {Array<{id?: unknown}>} tasks
 * @returns {string}
 */
export function computeNextId(tasks) {
  let max = 0;
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string') continue;
    const match = ID_NUM_RE.exec(task.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isSafeInteger(n) && n > max) max = n;
  }
  return `LB-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Reads parseArgs()'s `values` object and builds the field map for a new
 * task. Requires --title and --category to be present (throws
 * MissingRequiredFieldsError otherwise, before any file I/O). Other
 * UPDATABLE_FIELDS are optional and only included when supplied, using the
 * same 'none'->null and --deps comma-parsing rules as update.
 * @param {Record<string, unknown>} rawOptions
 * @returns {Record<string, unknown>}
 */
export function computeCreateFields(rawOptions) {
  const missing = REQUIRED_CREATE_FIELDS.filter((field) => rawOptions[field] === undefined);
  if (missing.length > 0) {
    throw new MissingRequiredFieldsError(missing);
  }

  const fields = {};
  for (const field of UPDATABLE_FIELDS) {
    const raw = rawOptions[field];
    if (raw === undefined) continue;

    if (field === 'deps') {
      fields.deps = parseDepsValue(raw);
    } else if (NULLABLE_FIELDS.includes(field) && raw === 'none') {
      fields[field] = null;
    } else {
      fields[field] = raw;
    }
  }

  return fields;
}

/**
 * Returns a new document with a new task appended. `doc` is never mutated.
 * The caller must re-validate the returned document — this function does not
 * check enums or referential integrity itself.
 * @param {{tasks: Array<{id: string}>, meta: {updated: string}}} doc - a document that already passed validateDocument
 * @param {Record<string, unknown>} fields - output of computeCreateFields
 * @param {string} todayStr - YYYY-MM-DD, the date to stamp on done_at/meta.updated
 * @returns {{doc: unknown, id: string}}
 */
export function buildTask(doc, fields, todayStr) {
  const id = computeNextId(doc.tasks);
  const next = structuredClone(doc);

  const status = 'status' in fields ? fields.status : 'todo';
  const task = {
    id,
    status,
    priority: 'priority' in fields ? fields.priority : null,
    category: fields.category,
    title: fields.title,
    summary: 'summary' in fields ? fields.summary : null,
    where: 'where' in fields ? fields.where : null,
    parent: 'parent' in fields ? fields.parent : null,
    deps: 'deps' in fields ? fields.deps : [],
    doc: 'doc' in fields ? fields.doc : null,
    done_at: status === 'done' ? todayStr : null,
    note: 'note' in fields ? fields.note : null,
  };

  next.tasks.push(task);
  next.meta.updated = todayStr;
  return { doc: next, id };
}
