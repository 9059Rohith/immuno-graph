import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const venvDir = path.join(repoRoot, '.venv-mhcflurry');
const isWindows = process.platform === 'win32';
const pythonCommand = process.env.PYTHON ?? (isWindows ? 'python' : 'python3');
const venvPython = path.join(venvDir, isWindows ? 'Scripts/python.exe' : 'bin/python');
const downloadsCommand = path.join(
  venvDir,
  isWindows ? 'Scripts/mhcflurry-downloads.exe' : 'bin/mhcflurry-downloads',
);
const scanCommand = path.join(
  venvDir,
  isWindows ? 'Scripts/mhcflurry-predict-scan.exe' : 'bin/mhcflurry-predict-scan',
);

await run(pythonCommand, ['-m', 'venv', venvDir]);
await run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel']);
await run(venvPython, ['-m', 'pip', 'install', 'mhcflurry']);
await run(downloadsCommand, ['fetch', 'models_class1_presentation']);

if (!existsSync(scanCommand)) {
  throw new Error(`MHCflurry scan command was not found at ${scanCommand}`);
}

console.log('MHCflurry local connector installed.');
console.log(`Set MHCFLURRY_COMMAND=${scanCommand}`);
console.log('Set MHCFLURRY_ENABLED=true after running npm run connectors:check:mhcflurry.');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}
