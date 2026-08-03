import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const markdownLink = /!?(?:\[[^\]]*\])\((<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\)/gu;
const npmRun = /\bnpm\s+run\s+([a-zA-Z0-9:_-]+)/gu;

const slash = (value) => value.split(sep).join('/');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function localTarget(rawTarget) {
  const target = rawTarget.replace(/^<|>$/gu, '');
  if (target === '' || target.startsWith('#') || /^(?:https?:|mailto:|data:|tel:)/iu.test(target)) {
    return null;
  }
  return decodeURIComponent(target.split('#', 1)[0].split('?', 1)[0]);
}

export async function checkMarkdownText(filePath, text, options) {
  const issues = [];
  const displayFile = slash(relative(options.rootDir, filePath));
  let fenced = false;
  const lines = text.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (/^\s*```/u.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) {
      for (const match of line.matchAll(markdownLink)) {
        const target = localTarget(match[1] ?? '');
        if (target === null) continue;
        const absoluteTarget = target.startsWith('/')
          ? resolve(options.rootDir, target.slice(1))
          : resolve(dirname(filePath), target);
        if (!(await exists(absoluteTarget))) {
          issues.push({
            file: displayFile,
            line: index + 1,
            target,
            message: 'relative link target does not exist',
          });
        }
      }
    }

    for (const match of line.matchAll(npmRun)) {
      const target = match[1] ?? '';
      if (!options.scripts.has(target)) {
        issues.push({
          file: displayFile,
          line: index + 1,
          target,
          message: 'root npm script does not exist',
        });
      }
    }
  }
  return issues;
}

async function markdownFiles(rootDir) {
  const rootFiles = ['README.md', 'CONTRIBUTING.md', 'AGENTS.md'];
  const files = [];
  for (const name of rootFiles) {
    const path = resolve(rootDir, name);
    if (await exists(path)) files.push(path);
  }
  const docsRoot = resolve(rootDir, 'docs');
  const entries = await readdir(docsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(resolve(docsRoot, entry.name));
  }
  return files.sort();
}

export async function checkDocumentation(rootDir) {
  const packageDocument = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
  const scripts = new Set(Object.keys(packageDocument.scripts ?? {}));
  const issues = [];
  for (const filePath of await markdownFiles(rootDir)) {
    issues.push(
      ...(await checkMarkdownText(filePath, await readFile(filePath, 'utf8'), {
        rootDir,
        scripts,
      })),
    );
  }
  return issues;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const issues = await checkDocumentation(rootDir);
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.file}:${issue.line} ${issue.target} - ${issue.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Documentation links and npm scripts are valid.');
  }
}
