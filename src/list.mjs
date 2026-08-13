const ID_NUM_RE = /^LB-(\d+)$/;

function idNum(id) {
  const match = typeof id === 'string' ? ID_NUM_RE.exec(id) : null;
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

/**
 * AND-combines status/priority/category filters (each omitted filter is a
 * no-op) and sorts by the numeric id suffix ascending. priority: 'none'
 * matches tasks whose priority is null — the only nullable filterable field.
 * @param {Array<Record<string, unknown>>} tasks
 * @param {{status?: string, priority?: string, category?: string}} filters
 * @returns {Array<Record<string, unknown>>}
 */
export function filterAndSortTasks(tasks, filters = {}) {
  return tasks
    .filter((task) => {
      if (filters.status !== undefined && task.status !== filters.status) return false;
      if (filters.category !== undefined && task.category !== filters.category) return false;
      if (filters.priority !== undefined) {
        if (filters.priority === 'none') {
          if (task.priority !== null) return false;
        } else if (task.priority !== filters.priority) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => idNum(a.id) - idNum(b.id));
}

/**
 * Checks status/category filter values against the document's own enums,
 * and priority against enums.priority unless the filter is the 'none'
 * sentinel (which matches a null priority, not a literal enum member).
 * Enum arrays that are missing or malformed are skipped rather than
 * rejected, consistent with list's read-only, best-effort design.
 * @param {{status?: string, priority?: string, category?: string}} filters
 * @param {{status?: unknown, priority?: unknown, category?: unknown}} [enums]
 * @returns {string[]} human-readable error messages, empty if all filters are valid
 */
export function validateFilters(filters, enums) {
  const errors = [];
  for (const field of ['status', 'category']) {
    if (filters[field] === undefined) continue;
    const allowed = enums && Array.isArray(enums[field]) ? enums[field] : null;
    if (allowed && !allowed.includes(filters[field])) {
      errors.push(`--${field} ${JSON.stringify(filters[field])} is not in enums.${field}`);
    }
  }
  if (filters.priority !== undefined && filters.priority !== 'none') {
    const allowed = enums && Array.isArray(enums.priority) ? enums.priority : null;
    if (allowed && !allowed.includes(filters.priority)) {
      errors.push(`--priority ${JSON.stringify(filters.priority)} is not in enums.priority`);
    }
  }
  return errors;
}

const HEADERS = ['ID', 'STATUS', 'PRIORITY', 'CATEGORY', 'TITLE'];

function cellsFor(task) {
  const priority = task.priority === null || task.priority === undefined ? '(none)' : task.priority;
  return [task.id, task.status, priority, task.category, task.title];
}

/**
 * Renders a fixed-width, space-aligned table (no external dependency). The
 * last column (TITLE) is never truncated. On an empty task list, only the
 * header row is printed — an empty list is a normal, successful result.
 * @param {Array<Record<string, unknown>>} tasks
 * @returns {string}
 */
export function renderTable(tasks) {
  const rows = tasks.map(cellsFor);
  const widths = HEADERS.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => String(row[i] ?? '').length)),
  );
  const padRow = (cells) =>
    cells.map((cell, i) => (i === cells.length - 1 ? String(cell ?? '') : String(cell ?? '').padEnd(widths[i]))).join('  ');
  return [padRow(HEADERS), ...rows.map(padRow)].join('\n') + '\n';
}

/**
 * @param {Array<Record<string, unknown>>} tasks
 * @returns {string}
 */
export function renderJson(tasks) {
  return JSON.stringify(tasks, null, 2) + '\n';
}
