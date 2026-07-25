import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageUrl = 'https://downloads.iedb.org/tools/retrieve_package.php?tool=population';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installRoot = path.join(repoRoot, '.iedb-tools');
const archivePath = path.join(installRoot, 'iedb-population-coverage.tar.gz');
const scriptPath = path.join(
  installRoot,
  'population_coverage',
  'calculate_population_coverage.py',
);

mkdirSync(installRoot, { recursive: true });

const response = await fetch(packageUrl, {
  headers: { 'user-agent': 'ImmunoGraph/0.1 (+https://tools.iedb.org/population/download/)' },
});
if (!response.ok || response.body === null) {
  throw new Error(`IEDB population package download failed with HTTP ${response.status}.`);
}
await pipeline(response.body, createWriteStream(archivePath));

await run('tar', ['-xzf', archivePath, '-C', installRoot]);
await rm(archivePath, { force: true });

if (!existsSync(scriptPath)) {
  throw new Error(`IEDB population coverage script was not found at ${scriptPath}`);
}

console.log('IEDB population coverage standalone tool installed.');
console.log(`Set IEDB_POPULATION_COVERAGE_SCRIPT_PATH=${scriptPath}`);
console.log(
  'Set IEDB_POPULATION_COVERAGE_ENABLED=true after running npm run connectors:check:iedb-population.',
);

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
