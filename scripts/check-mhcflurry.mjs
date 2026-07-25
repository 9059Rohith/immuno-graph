import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(repoRoot, '.env'));

const isWindows = process.platform === 'win32';
const defaultCommand = path.join(
  repoRoot,
  '.venv-mhcflurry',
  isWindows ? 'Scripts/mhcflurry-predict-scan.exe' : 'bin/mhcflurry-predict-scan',
);
const command = normalizeCommand(process.env.MHCFLURRY_COMMAND ?? defaultCommand);
const generatedDir = path.join(repoRoot, 'data', 'generated');
mkdirSync(generatedDir, { recursive: true });

const outputPath = path.join(generatedDir, `mhcflurry-smoke-${Date.now()}.csv`);
const args = [
  '--sequences',
  'ACDEFGHIKLMNPQRST',
  '--alleles',
  'HLA-A*02:01',
  '--peptide-lengths',
  '9',
  '--results-all',
  '--out',
  outputPath,
];

await run(command, args);

const lineCount = readFileSync(outputPath, 'utf8')
  .split(/\r?\n/u)
  .filter((line) => line.length > 0).length;
const sizeBytes = statSync(outputPath).size;

if (lineCount < 2) {
  throw new Error('MHCflurry smoke check completed but produced no prediction rows.');
}

console.log('MHCflurry smoke check passed.');
console.log(`Command: ${command}`);
console.log(`Rows including header: ${lineCount}`);
console.log(`Output bytes: ${sizeBytes}`);

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
    // A missing .env is fine; the default virtualenv path is used.
  }
}

function normalizeCommand(commandValue) {
  if (path.isAbsolute(commandValue)) return commandValue;
  if (commandValue.includes('/') || commandValue.includes('\\')) {
    return path.resolve(repoRoot, commandValue);
  }
  return commandValue;
}

function run(commandValue, argsValue) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandValue, argsValue, {
      cwd: repoRoot,
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
          `${commandValue} smoke check exited with code ${code ?? 'unknown'}: ${stderr.slice(0, 2000)}`,
        ),
      );
    });
  });
}
