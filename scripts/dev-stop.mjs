import { execFileSync } from 'node:child_process';
import { cwd } from 'node:process';

const workspace = cwd().replaceAll("'", "''");
const output = execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `
      $workspace = '${workspace}'
      $targets = Get-CimInstance Win32_Process |
        Where-Object {
          $_.ProcessId -ne $PID -and
          $_.Name -match "^(node|cmd|esbuild)" -and
          $_.CommandLine -like "*$workspace*" -and
          $_.CommandLine -match "tsx|vite|npm run dev|apps(\\\\|/)mcp(\\\\|/)dist(\\\\|/)index\\.js"
        }
      foreach ($target in $targets) {
        Stop-Process -Id $target.ProcessId -Force
      }
      [pscustomobject]@{ stopped = @($targets | Select-Object ProcessId,Name) } | ConvertTo-Json -Depth 3
    `,
  ],
  { encoding: 'utf8' },
);

process.stdout.write(output);
