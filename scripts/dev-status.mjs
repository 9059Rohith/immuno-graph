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
      $ports = @(3000,3001,5173)
      $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $ports -contains $_.LocalPort } |
        Select-Object LocalAddress,LocalPort,OwningProcess
      $processes = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -like "*$workspace*" -and ($_.CommandLine -match "tsx|vite|node|npm") } |
        Select-Object ProcessId,Name,CommandLine
      [pscustomobject]@{ listeners = $listeners; processes = $processes } | ConvertTo-Json -Depth 4
    `,
  ],
  { encoding: 'utf8' },
);

process.stdout.write(output);
