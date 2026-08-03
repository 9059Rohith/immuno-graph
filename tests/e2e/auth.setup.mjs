import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test as setup, expect } from '@playwright/test';

const authFile = resolve('tests/.auth/e2e-user.json');
const apiBaseUrl = process.env.E2E_API_BASE ?? 'http://127.0.0.1:3100/api/v1';
const credentials = {
  displayName: 'E2E Researcher',
  email: 'e2e@immunograph.local',
  password: 'ImmunoGraphE2E!2026',
};

async function postWhenReady(request, url, options) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await request.post(url, options);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`E2E API did not become ready: ${String(lastError)}`);
}

setup('authenticate browser tests', async ({ request }) => {
  await mkdir(dirname(authFile), { recursive: true });
  const loginPayload = { email: credentials.email, password: credentials.password };
  let login = await postWhenReady(request, `${apiBaseUrl}/auth/login`, { data: loginPayload });
  if (!login.ok()) {
    const signup = await postWhenReady(request, `${apiBaseUrl}/auth/signup`, { data: credentials });
    expect([200, 409]).toContain(signup.status());
    login = await postWhenReady(request, `${apiBaseUrl}/auth/login`, { data: loginPayload });
  }
  expect(login.ok(), await login.text()).toBe(true);
  const state = await request.storageState();
  await writeFile(authFile, JSON.stringify(state), 'utf8');
});
