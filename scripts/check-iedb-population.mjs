import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(repoRoot, '.env'));

const defaultScriptPath = path.join(
  repoRoot,
  '.iedb-tools',
  'population_coverage',
  'calculate_population_coverage.py',
);
const scriptPath = normalizePath(
  process.env.IEDB_POPULATION_COVERAGE_SCRIPT_PATH ?? defaultScriptPath,
);
const pythonCommand = process.env.IEDB_POPULATION_COVERAGE_PYTHON_COMMAND ?? 'python';

if (!existsSync(scriptPath)) {
  throw new Error(
    `IEDB population coverage script not found at ${scriptPath}. Run npm run connectors:install:iedb-population first.`,
  );
}

await run(pythonCommand, [scriptPath, '--list']);

console.log('IEDB population coverage smoke check passed.');
console.log(`Script: ${scriptPath}`);
console.log(`Python: ${pythonCommand}`);

function loadDotEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const separatorIndex = trimmed.indexOf('=');
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/gu, '');
      }
    }
  } catch {
    // A missing .env is fine; the default local install path is used.
  }
}

function normalizePath(value) {
  if (path.isAbsolute(value)) return value;
  return path.resolve(repoRoot, value);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.dirname(scriptPath),
      stdio: ['ignore', 'ignore', 'pipe'],
      shell: false,
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} IEDB population smoke check exited with code ${code ?? 'unknown'}: ${stderr.slice(0, 2000)}`,
        ),
      );
    });
  });
}
