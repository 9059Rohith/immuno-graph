import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

test('credential-free judge flow launches an isolated synthetic workspace', async ({
  page,
}, testInfo) => {
  const browserMessages = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /auditable epitope prioritization/i }),
  ).toBeVisible();
  await expect(page.getByText('Track 4 — Domain Agents')).toBeVisible();
  await expect(page.getByText(/synthetic demonstration only/i)).toBeVisible();
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    ),
  ).toBe(false);

  if (process.env.E2E_CAPTURE_SCREENSHOTS === '1') {
    await page.screenshot({
      path: join(tmpdir(), `immunograph-${testInfo.project.name}-landing.png`),
      fullPage: true,
    });
  }

  await page.getByRole('button', { name: /launch judge demo/i }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/judge mode · synthetic fixture/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '3D Structures' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Docking Lab' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ImmunoGraph Judge Demo' })).toBeVisible();
  const storedWorkspaceKeys = await page.evaluate(() =>
    Object.keys(
      JSON.parse(sessionStorage.getItem('immunograph.judge-workspace.v1') ?? '{}'),
    ).sort(),
  );
  expect(storedWorkspaceKeys).toEqual(['expiresAt', 'projectId', 'runId']);

  if (process.env.E2E_CAPTURE_SCREENSHOTS === '1') {
    await page.screenshot({
      path: join(tmpdir(), `immunograph-${testInfo.project.name}-workspace.png`),
      fullPage: false,
    });
  }

  expect(browserMessages, failedResponses.join('\n')).toEqual([]);
});
