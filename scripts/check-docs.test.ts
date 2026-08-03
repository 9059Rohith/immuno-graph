import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkMarkdownText } from './check-docs.mjs';

describe('documentation checker', () => {
  it('reports a missing relative link with file, line, and target', async () => {
    const root = join(tmpdir(), `immunograph-docs-${crypto.randomUUID()}`);
    await mkdir(root, { recursive: true });
    const issues = await checkMarkdownText(
      join(root, 'README.md'),
      '# Demo\n\nSee [missing](docs/missing.md).\n',
      { rootDir: root, scripts: new Set(['test']) },
    );

    expect(issues).toContainEqual({
      file: 'README.md',
      line: 3,
      target: 'docs/missing.md',
      message: 'relative link target does not exist',
    });
  });

  it('reports an unknown root npm script but accepts a real link and script', async () => {
    const root = join(tmpdir(), `immunograph-docs-${crypto.randomUUID()}`);
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'docs', 'guide.md'), '# Guide\n', 'utf8');
    const issues = await checkMarkdownText(
      join(root, 'README.md'),
      '[Guide](docs/guide.md)\n\n`npm run verify`\n\n`npm run missing-script`\n',
      { rootDir: root, scripts: new Set(['verify']) },
    );

    expect(issues).toEqual([
      {
        file: 'README.md',
        line: 5,
        target: 'missing-script',
        message: 'root npm script does not exist',
      },
    ]);
  });
});
