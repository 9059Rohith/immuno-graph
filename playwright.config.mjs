import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'npm run db:migrate && npm run dev --workspace @immunograph/api',
          url: 'http://127.0.0.1:3100/health/live',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { API_PORT: '3100' },
        },
        {
          command: 'npm run dev --workspace @immunograph/web',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: { VITE_DEV_API_TARGET: 'http://127.0.0.1:3100' },
        },
      ],
  projects: [
    {
      name: 'judge-chromium',
      testMatch: /judge-(mode|journey)\.spec\.mjs/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'judge-mobile-chromium',
      testMatch: /judge-(mode|journey)\.spec\.mjs/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'setup',
      testMatch: /auth\.setup\.mjs/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /judge-(mode|journey)\.spec\.mjs/,
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/e2e-user.json' },
    },
    {
      name: 'mobile-chromium',
      dependencies: ['setup'],
      testIgnore: /judge-(mode|journey)\.spec\.mjs/,
      use: { ...devices['Pixel 7'], storageState: 'tests/.auth/e2e-user.json' },
    },
  ],
});
