const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^LB-\d{3,}$/;

export const ErrorCode = Object.freeze({
  ROOT_NOT_OBJECT: 'ROOT_NOT_OBJECT',
  SCHEMA_VERSION_INVALID: 'SCHEMA_VERSION_INVALID',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  DATE_FORMAT_INVALID: 'DATE_FORMAT_INVALID',
  ENUM_INVALID: 'ENUM_INVALID',
  ID_FORMAT_INVALID: 'ID_FORMAT_INVALID',
  DUPLICATE_ID: 'DUPLICATE_ID',
  TITLE_EMPTY: 'TITLE_EMPTY',
  REF_MISSING: 'REF_MISSING',
  SELF_REFERENCE: 'SELF_REFERENCE',
  DUPLICATE_DEPS_ENTRY: 'DUPLICATE_DEPS_ENTRY',
  DONE_AT_MISMATCH: 'DONE_AT_MISMATCH',
});

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value) {
  return value === null || typeof value === 'string';
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * @param {unknown} doc
 * @returns {{ valid: boolean, errors: Array<{code: string, path: string, message: string}>, taskCount: number }}
 */
export function validateDocument(doc) {
  const errors = [];
  const push = (code, path, message) => errors.push({ code, path, message });

  if (!isPlainObject(doc)) {
    push(ErrorCode.ROOT_NOT_OBJECT, '$', 'document root must be a JSON object');
    return { valid: false, errors, taskCount: 0 };
  }

  // $schema_version
  if (!('$schema_version' in doc)) {
    push(ErrorCode.REQUIRED_FIELD_MISSING, '$schema_version', 'missing required field $schema_version');
  } else if (doc.$schema_version !== '1') {
    push(ErrorCode.SCHEMA_VERSION_INVALID, '$schema_version', `$schema_version must be the string "1", got ${JSON.stringify(doc.$schema_version)}`);
  }

  // meta
  if (!('meta' in doc)) {
    push(ErrorCode.REQUIRED_FIELD_MISSING, 'meta', 'missing required field meta');
  } else if (!isPlainObject(doc.meta)) {
    push(ErrorCode.TYPE_MISMATCH, 'meta', 'meta must be an object');
  } else {
    const meta = doc.meta;
    if (!('updated' in meta)) {
      push(ErrorCode.REQUIRED_FIELD_MISSING, 'meta.updated', 'missing required field meta.updated');
    } else if (!isValidDateString(meta.updated)) {
      push(ErrorCode.DATE_FORMAT_INVALID, 'meta.updated', 'meta.updated must be a YYYY-MM-DD date string');
    }
    if (!('context_doc' in meta)) {
      push(ErrorCode.REQUIRED_FIELD_MISSING, 'meta.context_doc', 'missing required field meta.context_doc');
    } else if (!isStringOrNull(meta.context_doc)) {
      push(ErrorCode.TYPE_MISMATCH, 'meta.context_doc', 'meta.context_doc must be a string or null');
    }
    if (!('note' in meta)) {
      push(ErrorCode.REQUIRED_FIELD_MISSING, 'meta.note', 'missing required field meta.note');
    } else if (!isStringOrNull(meta.note)) {
      push(ErrorCode.TYPE_MISMATCH, 'meta.note', 'meta.note must be a string or null');
    }
  }

  // enums
  let enumsStatus = null;
  let enumsPriority = null;
  let enumsCategory = null;
  if (!('enums' in doc)) {
    push(ErrorCode.REQUIRED_FIELD_MISSING, 'enums', 'missing required field enums');
  } else if (!isPlainObject(doc.enums)) {
    push(ErrorCode.TYPE_MISMATCH, 'enums', 'enums must be an object');
  } else {
    const enums = doc.enums;
    for (const key of ['status', 'priority', 'category']) {
      if (!(key in enums)) {
        push(ErrorCode.REQUIRED_FIELD_MISSING, `enums.${key}`, `missing required field enums.${key}`);
      } else if (!Array.isArray(enums[key])) {
        push(ErrorCode.TYPE_MISMATCH, `enums.${key}`, `enums.${key} must be an array`);
      }
    }
    if (Array.isArray(enums.status)) enumsStatus = enums.status;
    if (Array.isArray(enums.priority)) enumsPriority = enums.priority;
    if (Array.isArray(enums.category)) enumsCategory = enums.category;
  }

  // tasks
  let tasks = null;
  if (!('tasks' in doc)) {
    push(ErrorCode.REQUIRED_FIELD_MISSING, 'tasks', 'missing required field tasks');
  } else if (!Array.isArray(doc.tasks)) {
    push(ErrorCode.TYPE_MISMATCH, 'tasks', 'tasks must be an array');
  } else {
    tasks = doc.tasks;
  }

  const taskCount = Array.isArray(doc.tasks) ? doc.tasks.length : 0;

  if (tasks === null) {
    return { valid: errors.length === 0, errors, taskCount };
  }

  const REQUIRED_TASK_FIELDS = [
    'id', 'status', 'priority', 'category', 'title',
    'summary', 'where', 'doc', 'note', 'parent', 'deps', 'done_at',
  ];

  const idSet = new Set(); // format-valid ids only; used as the referential-integrity target set
  const seenIdStrings = new Set(); // every string id seen, regardless of format validity

  // Pass 1: per-task field-level checks (type/format/enum), collect known ids.
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const base = `tasks[${i}]`;

    if (!isPlainObject(task)) {
      push(ErrorCode.TYPE_MISMATCH, base, 'task must be an object');
      continue;
    }

    for (const field of REQUIRED_TASK_FIELDS) {
      if (!(field in task)) {
        push(ErrorCode.REQUIRED_FIELD_MISSING, `${base}.${field}`, `missing required field ${base}.${field}`);
      }
    }

    if ('id' in task) {
      if (typeof task.id !== 'string') {
        push(ErrorCode.TYPE_MISMATCH, `${base}.id`, 'id must be a string');
      } else {
        // Duplicate detection runs on the raw string regardless of format
        // validity — two tasks sharing the same malformed id are still a
        // duplicate-id problem, not just two independent format problems.
        if (seenIdStrings.has(task.id)) {
          push(ErrorCode.DUPLICATE_ID, `${base}.id`, `duplicate id ${JSON.stringify(task.id)}`);
        }
        seenIdStrings.add(task.id);

        if (!ID_RE.test(task.id)) {
          push(ErrorCode.ID_FORMAT_INVALID, `${base}.id`, `id must match LB-### (3+ digits), got ${JSON.stringify(task.id)}`);
        } else {
          idSet.add(task.id);
        }
      }
    }

    if ('status' in task) {
      if (typeof task.status !== 'string') {
        push(ErrorCode.TYPE_MISMATCH, `${base}.status`, 'status must be a string');
      } else if (enumsStatus !== null && !enumsStatus.includes(task.status)) {
        push(ErrorCode.ENUM_INVALID, `${base}.status`, `status ${JSON.stringify(task.status)} is not in enums.status`);
      }
    }

    if ('priority' in task) {
      if (task.priority !== null && typeof task.priority !== 'string') {
        push(ErrorCode.TYPE_MISMATCH, `${base}.priority`, 'priority must be a string or null');
      } else if (task.priority !== null && enumsPriority !== null && !enumsPriority.includes(task.priority)) {
        push(ErrorCode.ENUM_INVALID, `${base}.priority`, `priority ${JSON.stringify(task.priority)} is not in enums.priority`);
      }
    }

    if ('category' in task) {
      if (typeof task.category !== 'string') {
        push(ErrorCode.TYPE_MISMATCH, `${base}.category`, 'category must be a string');
      } else if (enumsCategory !== null && !enumsCategory.includes(task.category)) {
        push(ErrorCode.ENUM_INVALID, `${base}.category`, `category ${JSON.stringify(task.category)} is not in enums.category`);
      }
    }

    if ('title' in task) {
      if (typeof task.title !== 'string') {
        push(ErrorCode.TYPE_MISMATCH, `${base}.title`, 'title must be a string');
      } else if (task.title.length === 0) {
        push(ErrorCode.TITLE_EMPTY, `${base}.title`, 'title must not be empty');
      }
    }

    for (const field of ['summary', 'where', 'doc', 'note']) {
      if (field in task && !isStringOrNull(task[field])) {
        push(ErrorCode.TYPE_MISMATCH, `${base}.${field}`, `${field} must be a string or null`);
      }
    }

    if ('parent' in task && !isStringOrNull(task.parent)) {
      push(ErrorCode.TYPE_MISMATCH, `${base}.parent`, 'parent must be a string or null');
    }

    if ('deps' in task) {
      if (!Array.isArray(task.deps)) {
        push(ErrorCode.TYPE_MISMATCH, `${base}.deps`, 'deps must be an array');
      } else {
        task.deps.forEach((entry, j) => {
          if (typeof entry !== 'string') {
            push(ErrorCode.TYPE_MISMATCH, `${base}.deps[${j}]`, 'deps entries must be strings');
          }
        });
      }
    }

    if ('done_at' in task && task.done_at !== null && !isValidDateString(task.done_at)) {
      push(ErrorCode.DATE_FORMAT_INVALID, `${base}.done_at`, 'done_at must be a YYYY-MM-DD date string or null');
    }

    if ('status' in task && 'done_at' in task && typeof task.status === 'string') {
      const isDone = task.status === 'done';
      const hasDoneAt = task.done_at !== null && task.done_at !== undefined;
      if (isDone !== hasDoneAt) {
        push(
          ErrorCode.DONE_AT_MISMATCH,
          `${base}.done_at`,
          isDone
            ? 'status is "done" but done_at is null'
            : `status is ${JSON.stringify(task.status)} but done_at is not null`,
        );
      }
    }
  }

  // Pass 2: referential integrity, using the complete idSet from pass 1.
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!isPlainObject(task)) continue;
    const base = `tasks[${i}]`;
    const ownId = typeof task.id === 'string' ? task.id : undefined;

    if (typeof task.parent === 'string') {
      if (ownId !== undefined && task.parent === ownId) {
        push(ErrorCode.SELF_REFERENCE, `${base}.parent`, 'task cannot reference itself as parent');
      } else if (!idSet.has(task.parent)) {
        push(ErrorCode.REF_MISSING, `${base}.parent`, `parent ${JSON.stringify(task.parent)} does not reference an existing task`);
      }
    }

    if (Array.isArray(task.deps)) {
      const seenDeps = new Set();
      task.deps.forEach((entry, j) => {
        if (typeof entry !== 'string') return;
        const depPath = `${base}.deps[${j}]`;
        if (ownId !== undefined && entry === ownId) {
          push(ErrorCode.SELF_REFERENCE, depPath, 'task cannot reference itself in deps');
        } else if (!idSet.has(entry)) {
          push(ErrorCode.REF_MISSING, depPath, `deps entry ${JSON.stringify(entry)} does not reference an existing task`);
        }
        if (seenDeps.has(entry)) {
          push(ErrorCode.DUPLICATE_DEPS_ENTRY, depPath, `duplicate deps entry ${JSON.stringify(entry)}`);
        }
        seenDeps.add(entry);
      });
    }
  }

  return { valid: errors.length === 0, errors, taskCount };
}
