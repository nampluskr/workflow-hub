export const UPDATABLE_FIELDS = Object.freeze([
  'status', 'priority', 'category', 'title',
  'summary', 'where', 'parent', 'deps', 'doc', 'note',
]);

export const NULLABLE_FIELDS = Object.freeze([
  'priority', 'summary', 'where', 'doc', 'note', 'parent',
]);

export class TaskNotFoundError extends Error {
  constructor(id) {
    super(`no task with id ${JSON.stringify(id)}`);
    this.name = 'TaskNotFoundError';
    this.id = id;
  }
}

export class NoUpdateOptionsError extends Error {
  constructor() {
    super(`update requires at least one field to change (${UPDATABLE_FIELDS.join(', ')})`);
    this.name = 'NoUpdateOptionsError';
  }
}

export function parseDepsValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'none') return [];
  return trimmed.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

/**
 * Reads parseArgs()'s `values` object and builds the field-update map for
 * update. Only UPDATABLE_FIELDS are considered — any other key (e.g. `file`)
 * is ignored. Throws NoUpdateOptionsError if nothing was actually supplied,
 * before any file I/O happens.
 * @param {Record<string, unknown>} rawOptions
 * @returns {Record<string, unknown>}
 */
export function computeFieldUpdates(rawOptions) {
  const updates = {};
  for (const field of UPDATABLE_FIELDS) {
    const raw = rawOptions[field];
    if (raw === undefined) continue;

    if (field === 'deps') {
      updates.deps = parseDepsValue(raw);
    } else if (NULLABLE_FIELDS.includes(field) && raw === 'none') {
      updates[field] = null;
    } else {
      updates[field] = raw;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new NoUpdateOptionsError();
  }

  return updates;
}

/**
 * Returns a new document with task `id` updated by fieldUpdates. `doc` is
 * never mutated. The caller must re-validate the returned document — this
 * function does not check enums or referential integrity itself.
 * @param {{tasks: Array<{id: string}>, meta: {updated: string}}} doc - a document that already passed validateDocument
 * @param {string} id
 * @param {Record<string, unknown>} fieldUpdates
 * @param {string} todayStr - YYYY-MM-DD, the date to stamp on done_at/meta.updated
 * @returns {unknown}
 */
export function applyUpdate(doc, id, fieldUpdates, todayStr) {
  const index = doc.tasks.findIndex((task) => task && task.id === id);
  if (index === -1) {
    throw new TaskNotFoundError(id);
  }

  const next = structuredClone(doc);
  const task = next.tasks[index];
  Object.assign(task, fieldUpdates);

  if ('status' in fieldUpdates) {
    if (task.status === 'done') {
      if (task.done_at == null) task.done_at = todayStr;
    } else {
      task.done_at = null;
    }
  }

  next.meta.updated = todayStr;
  return next;
}
