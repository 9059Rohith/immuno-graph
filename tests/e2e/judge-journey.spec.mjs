import { expect, test } from '@playwright/test';

test('judge journey completes the credential-free evidence and approval loop', async ({ page }) => {
  test.setTimeout(60_000);
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
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
  await page.getByRole('button', { name: /launch judge demo/i }).click();

  await expect(page.getByRole('navigation', { name: 'Judge workflow' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Judge workflow' }).getByRole('link', {
    name: /configure/i,
  }).click();
  await expect(page.getByRole('heading', { name: 'Project Settings' })).toBeVisible();
  await expect(page.getByText(/curated judge mode configuration/i)).toBeVisible();
  await page.getByRole('button', { name: /approve configuration and queue/i }).click();

  await expect(page.getByRole('heading', { name: /run revision/i })).toBeVisible();
  await page.getByRole('button', { name: /start approved run/i }).click();
  await expect(page.getByText('AWAITING_SHORTLIST_APPROVAL').first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('link', { name: /review candidates/i }).click();

  await expect(page.getByRole('heading', { name: 'Candidate Rankings' })).toBeVisible();
  const candidate = page.getByRole('checkbox', { name: /^Select / }).first();
  await expect(candidate).toBeEnabled();
  await candidate.check();
  await page.getByRole('button', { name: 'Shortlist approval' }).click();
  await page.getByRole('checkbox', {
    name: 'Acknowledge computational-only shortlist status',
  }).check();
  await page.getByRole('button', { name: 'Approve shortlist' }).click();
  await expect(page.getByText('Shortlist already approved', { exact: true })).toBeVisible();

  const trustCenterLink = page.getByRole('link', { name: 'Trust Center' });
  if (!(await trustCenterLink.isVisible())) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  }
  await trustCenterLink.click();
  await expect(page.getByRole('heading', { name: 'Scientific Trust Center' })).toBeVisible();
  await expect(page.getByText('Fixture manifest integrity')).toBeVisible();
  await expect(page.getByText('Human approval gates')).toBeVisible();
  await expect(page.getByText(/demonstration only — not scientific output/i)).toBeVisible();
  await page.getByRole('link', { name: /continue to reports/i }).click();

  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate report' }).click();
  await expect(page.getByRole('link', { name: 'Download' }).first()).toBeVisible({
    timeout: 30_000,
  });
  const layout = await page.evaluate(() => ({
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll('body *')]
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1;
      })
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: element.textContent?.slice(0, 80),
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }));
  expect(layout.overflows, JSON.stringify(layout, null, 2)).toBe(false);
  expect(browserMessages, failedResponses.join('\n')).toEqual([]);
  expect(failedResponses).toEqual([]);
});
