const TASK_FIELD_ORDER = [
  'id', 'status', 'priority', 'category', 'title',
  'summary', 'where', 'parent', 'deps', 'doc', 'done_at', 'note',
];

/**
 * @param {Array<{id?: unknown}>} tasks
 * @param {string} id
 * @returns {Record<string, unknown> | undefined}
 */
export function findTaskById(tasks, id) {
  return tasks.find((task) => task && task.id === id);
}

function formatValue(field, value) {
  if (field === 'deps') {
    return Array.isArray(value) && value.length > 0 ? value.join(', ') : '(none)';
  }
  return value === null || value === undefined ? '(none)' : String(value);
}

/**
 * One "field: value" line per task field, in the same order the fields
 * appear in backlog.json's own tasks. Null scalars and empty deps render as
 * "(none)"; non-empty deps are comma-joined.
 * @param {Record<string, unknown>} task
 * @returns {string}
 */
export function renderText(task) {
  return TASK_FIELD_ORDER.map((field) => `${field}: ${formatValue(field, task[field])}`).join('\n') + '\n';
}

/**
 * @param {Record<string, unknown>} task
 * @returns {string}
 */
export function renderJson(task) {
  return JSON.stringify(task, null, 2) + '\n';
}
