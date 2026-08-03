import { expect, test } from '@playwright/test';

test('dashboard loads API-backed project data and primary navigation works', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: /research projects/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /new project/i }).first()).toBeVisible();

  await page
    .getByRole('link', { name: /new project/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await expect(page.getByRole('heading', { name: /create project/i })).toBeVisible();
  await expect(page.getByLabel(/project name/i)).toBeVisible();
  await expect(page.getByLabel(/protein fasta/i)).toBeVisible();
});

test('core pages have a single main landmark, named controls, and no horizontal overflow', async ({
  page,
}) => {
  for (const path of ['/', '/workspace', '/projects/new', '/system/diagnostics', '/system/about']) {
    await page.goto(path);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `${path} must not overflow horizontally`).toBe(false);
    const buttonCount = await page.getByRole('button').count();
    const namedButtonCount = await page.getByRole('button', { name: /.+/ }).count();
    expect(namedButtonCount, `${path} contains unnamed buttons`).toBe(buttonCount);
  }
});

test('keyboard navigation exposes visible focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  const focusStyle = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(
    focusStyle.outlineStyle !== 'none' ||
      focusStyle.outlineWidth !== '0px' ||
      focusStyle.boxShadow !== 'none',
  ).toBe(true);
});
