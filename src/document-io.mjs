import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class FileReadError extends Error {
  constructor(filePath, cause) {
    super(`failed to read file: ${filePath} (${cause.message})`);
    this.name = 'FileReadError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

export class DocumentParseError extends Error {
  constructor(filePath, cause) {
    super(`failed to parse JSON in ${filePath}: ${cause.message}`);
    this.name = 'DocumentParseError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

export class FileWriteError extends Error {
  constructor(filePath, cause) {
    super(`failed to write file: ${filePath} (${cause.message})`);
    this.name = 'FileWriteError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

/**
 * Reads and JSON.parse's a backlog document, distinguishing I/O failures
 * (FileReadError) from JSON syntax failures (DocumentParseError) so callers
 * can map them to different exit codes.
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
export async function readDocument(filePath) {
  let text;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (err) {
    throw new FileReadError(filePath, err);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new DocumentParseError(filePath, err);
  }
}

/**
 * Serializes doc and atomically replaces filePath: write to a unique temp
 * file in the same directory, then rename over the original. On any failure
 * the original file is left byte-for-byte untouched.
 * @param {string} filePath
 * @param {unknown} doc
 * @returns {Promise<void>}
 */
export async function writeDocument(filePath, doc) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tempPath = path.join(dir, `.${base}.${process.pid}-${randomUUID()}.tmp`);
  const text = JSON.stringify(doc, null, 2) + '\n';

  try {
    // 'wx' refuses to overwrite if tempPath already exists (should be
    // unreachable given the UUID, but costs nothing to guard against).
    await writeFile(tempPath, text, { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      // best-effort cleanup; may not exist if writeFile failed before creating it
    }
    throw new FileWriteError(filePath, err);
  }

  try {
    await rename(tempPath, filePath);
  } catch (err) {
    try {
      await unlink(tempPath);
    } catch {
      // best-effort cleanup; the rename error below is the real cause
    }
    throw new FileWriteError(filePath, err);
  }
}
