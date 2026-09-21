import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { sourceEmailSchema } from '../schemas/challengeSchemas.js';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function resolveInside(rootPath, relativePath) {
  const root = path.resolve(rootPath);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the dataset root: ${relativePath}`);
  }
  return target;
}

export function createDatasetRepository(rootPath) {
  const root = path.resolve(rootPath);
  const inboxPath = resolveInside(root, 'inbox');

  async function assertAvailable() {
    await access(inboxPath);
  }

  async function listEmails() {
    await assertAvailable();
    const filenames = (await readdir(inboxPath))
      .filter((filename) => /^email_[0-9]+\.json$/i.test(filename))
      .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

    return Promise.all(filenames.map(async (filename) => {
      const filePath = resolveInside(inboxPath, filename);
      const raw = await readFile(filePath, 'utf8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        throw new Error(`Invalid JSON in ${filename}: ${error.message}`);
      }
      const email = sourceEmailSchema.parse(parsed);
      return {
        ...email,
        sourceHash: sha256(JSON.stringify(email))
      };
    }));
  }

  function resolveAttachmentPath(reference) {
    return resolveInside(root, reference);
  }

  async function inspectAttachment(reference) {
    const filePath = resolveAttachmentPath(reference);
    try {
      const fileStat = await stat(filePath);
      const contents = await readFile(filePath);
      return {
        reference,
        filename: path.basename(filePath),
        extension: path.extname(filePath).toLowerCase(),
        exists: true,
        size: fileStat.size,
        contentHash: sha256(contents)
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return {
        reference,
        filename: path.basename(filePath),
        extension: path.extname(filePath).toLowerCase(),
        exists: false,
        size: null,
        contentHash: null
      };
    }
  }

  async function readAttachment(reference) {
    return readFile(resolveAttachmentPath(reference));
  }

  return {
    root,
    listEmails,
    inspectAttachment,
    readAttachment,
    resolveAttachmentPath
  };
}

