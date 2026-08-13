import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readDocument, FileReadError, DocumentParseError } from '../src/document-io.mjs';
import { validateDocument } from '../src/validate.mjs';
import { filterAndSortTasks, validateFilters, renderTable, renderJson } from '../src/list.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultFilePath = path.join(projectRoot, 'backlog.json');

function resolveFilePath(file) {
  return file !== undefined ? path.resolve(file) : defaultFilePath;
}

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

async function loadDocument(filePath) {
  try {
    return { doc: await readDocument(filePath) };
  } catch (err) {
    if (err instanceof FileReadError || err instanceof DocumentParseError) {
      return { error: err.message };
    }
    throw err;
  }
}

function hasTaskArray(doc) {
  return doc !== null && typeof doc === 'object' && !Array.isArray(doc) && Array.isArray(doc.tasks);
}

const server = new McpServer({ name: 'backlog', version: '1.0.0' });

server.registerTool(
  'backlog_validate',
  {
    title: 'Validate backlog document',
    description: '읽기 전용: backlog.json(또는 지정한 파일)의 스키마·enum·참조 무결성을 검증한다. 데이터를 변경하지 않는다.',
    inputSchema: {
      file: z.string().optional().describe('검증할 파일 경로. 생략하면 프로젝트 루트의 backlog.json'),
    },
  },
  async ({ file }) => {
    const filePath = resolveFilePath(file);
    const { doc, error } = await loadDocument(filePath);
    if (error) return textResult(`Error: ${error}`, true);

    const result = validateDocument(doc);
    return textResult(JSON.stringify({ filePath, ...result }, null, 2));
  },
);

server.registerTool(
  'backlog_list',
  {
    title: 'List backlog tasks',
    description: '읽기 전용: backlog.json(또는 지정한 파일)의 작업을 status/priority/category로 필터링하고 ID 오름차순으로 나열한다. 데이터를 변경하지 않는다.',
    inputSchema: {
      file: z.string().optional().describe('조회할 파일 경로. 생략하면 프로젝트 루트의 backlog.json'),
      status: z.string().optional().describe('문서의 enums.status에 있는 값'),
      priority: z.string().optional().describe('문서의 enums.priority에 있는 값, 또는 null 우선순위를 뜻하는 "none"'),
      category: z.string().optional().describe('문서의 enums.category에 있는 값'),
      format: z.enum(['table', 'json']).optional().describe('출력 형식, 기본값 table'),
    },
  },
  async ({ file, status, priority, category, format }) => {
    const filePath = resolveFilePath(file);
    const { doc, error } = await loadDocument(filePath);
    if (error) return textResult(`Error: ${error}`, true);

    if (!hasTaskArray(doc)) {
      return textResult(`Error: '${filePath}' is not a valid backlog document (root must be an object with a tasks array)`, true);
    }

    const filters = { status, priority, category };
    const filterErrors = validateFilters(filters, doc.enums);
    if (filterErrors.length > 0) {
      return textResult(`Error: ${filterErrors.join('; ')}`, true);
    }

    const filtered = filterAndSortTasks(doc.tasks, filters);
    const text = format === 'json' ? renderJson(filtered) : renderTable(filtered);
    return textResult(text);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
