# ImmunoGraph Hackathon Top-Tier Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a credential-free, deployment-ready Track 4 submission whose real sequence-to-report workflow and scientific trust evidence can be judged in under three minutes.

**Architecture:** Keep the React/Vite, Fastify, Prisma/SQLite, and separately deployed MCP services. Add a public demo-project factory and run-scoped trust summary to existing service boundaries, then deploy the web on Vercel and API/MCP services on Render with an allowlisted cross-origin API.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, TanStack Query, Fastify 5, Zod 3, Prisma 6 with SQLite, Vitest 4, Playwright 1.62, Docker, Vercel, Render.

## Global Constraints

- Primary submission is `Track 4 — Domain Agents`.
- The public URL must open and launch Judge Mode without credentials or API keys.
- Scientific values are deterministic or come from identified live/cache/fixture sources; an LLM cannot create or alter them.
- Inline logistic/MLP weights are named deterministic demonstration scoring heads, never trained biological models.
- Synthetic and fixture results remain visibly demonstration-only and `scientificUse=false`.
- Structures and Docking are outside the judged workflow and absent from Judge Mode navigation.
- Existing user changes in model predictors, MCP contracts, README, Playwright auth setup, and `.gitignore` must be preserved unless a task explicitly updates the same behavior.
- No fabricated deployed URL, demo-video URL, accuracy number, impact statistic, test result, or Codex authorship claim.
- Node remains `>=20.19.0 <21`; npm remains `>=10 <11`.
- Every feature change begins with a failing test and ends with focused tests plus the repository quality gate.

---

### Task 1: Demo workspace persistence and cleanup

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260803170000_demo_workspaces/migration.sql`
- Modify: `packages/database/src/validation.ts`
- Modify: `packages/database/src/repositories.ts`
- Test: `packages/database/src/repositories.test.ts`
- Create: `packages/database/src/demo-cleanup.ts`
- Create: `scripts/demo-cleanup.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `Project.isDemo: boolean`, `Project.demoExpiresAt: Date | null`.
- Produces: `ProjectRepository.deleteExpiredDemoProjects(before: Date): Promise<number>`.
- Produces: root command `npm run demo:cleanup`.

- [ ] **Step 1: Write failing repository tests**

Add a test that creates one expired demo project, one current demo project, and one research project, calls `deleteExpiredDemoProjects(now)`, and asserts that only the expired demo project is removed.

```ts
expect(await repositories.projects.deleteExpiredDemoProjects(now)).toBe(1);
expect(await repositories.projects.findById(expired.id)).toBeNull();
expect(await repositories.projects.findById(current.id)).not.toBeNull();
expect(await repositories.projects.findById(research.id)).not.toBeNull();
```

- [ ] **Step 2: Run the focused test and confirm the missing method failure**

Run: `npm test -- packages/database/src/repositories.test.ts`

- [ ] **Step 3: Add schema fields, migration, validation, repository cleanup, and command**

Add the following Prisma fields and index:

```prisma
isDemo        Boolean   @default(false)
demoExpiresAt DateTime?
@@index([isDemo, demoExpiresAt])
```

Implement cleanup with a single Prisma `deleteMany` constrained by `isDemo: true` and `demoExpiresAt: { lte: before }`. The script initializes the database, deletes expired demo projects at the current UTC instant, prints only the removed count, and disconnects.

- [ ] **Step 4: Generate Prisma client and run database tests**

Run: `npm run db:generate && npm test -- packages/database/src/repositories.test.ts packages/database/src/schema.test.ts`

- [ ] **Step 5: Commit the database slice**

```powershell
git add packages/database/prisma packages/database/src/validation.ts packages/database/src/repositories.ts packages/database/src/repositories.test.ts packages/database/src/demo-cleanup.ts scripts/demo-cleanup.mjs package.json
git commit -m "feat: add expiring demo workspaces"
```

### Task 2: Credential-free demo factory

**Files:**
- Create: `packages/shared/src/api/demo.ts`
- Modify: `packages/shared/src/api/index.ts`
- Modify: `apps/api/src/contracts.ts`
- Modify: `apps/api/src/services.ts`
- Modify: `apps/api/src/routes.ts`
- Create: `apps/api/src/application/services/demo-service.ts`
- Create: `apps/api/src/application/services/demo-service.test.ts`
- Modify: `apps/api/src/application/services/project-service.ts`
- Modify: `apps/api/src/application/create-services.ts`
- Modify: `apps/api/src/application/concrete-rest-api-services.ts`
- Modify: `apps/api/src/application/concrete-rest-api-services.test.ts`
- Modify: `apps/api/src/api.integration.test.ts`

**Interfaces:**
- Produces: `demoWorkspaceSchema` with `{ projectId, runId, expiresAt, fixtureId, mode }`.
- Produces: `DemoService.start(): Promise<DemoWorkspace>`.
- Produces: `POST /api/v1/demo/start` returning HTTP 201.

- [ ] **Step 1: Add failing service and route tests**

Use fixed clock and stubbed `ProjectService`/`RunService` collaborators:

```ts
expect(projects.create).toHaveBeenCalledWith(expect.objectContaining({
  name: 'ImmunoGraph Judge Demo',
  organism: 'Synthetic demonstration',
}));
expect(runs.create).toHaveBeenCalledWith(expect.objectContaining({
  projectId,
  requestedExecutionMode: 'FIXTURE',
  fallbackPolicy: 'FIXTURE_ONLY',
}));
expect(result).toEqual({
  projectId,
  runId,
  expiresAt: '2026-08-04T12:00:00.000Z',
  fixtureId: 'dengue',
  mode: 'PUBLIC_DEMO',
});
```

Route integration must assert `POST /api/v1/demo/start` delegates `demo.start` and rejects a non-empty body with 400.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `npm test -- apps/api/src/application/services/demo-service.test.ts apps/api/src/api.integration.test.ts`

- [ ] **Step 3: Implement shared schema and demo service**

Extend the internal `CreateProjectInput` with optional `isDemo` and `demoExpiresAt` fields; the public `/projects` contract cannot set them. Load `data/fixtures/dengue/input.fasta` through the existing fixture directory helper. Create the project with the exact synthetic metadata from `case.json`, set `isDemo=true` and `demoExpiresAt=clock+24h`, then create this run configuration:

```ts
{
  analysis: {
    mhci: { enabled: true, alleles: ['HLA-A*02:01'], peptideLengths: [9, 10], methods: ['iedb-recommended'] },
    mhcii: { enabled: true, alleles: ['HLA-DRB1*04:01'], peptideLengths: [15], methods: ['iedb-recommended'] },
    bcell: { enabled: true, methods: ['graphbepi'] },
  },
  populations: ['synthetic-population-alpha', 'synthetic-population-beta'],
  fallbackPolicy: 'FIXTURE_ONLY',
  requestedExecutionMode: 'FIXTURE',
  ruleProfileVersion: 'mvp-v1.0',
  rankingProfileVersion: 'mvp-v1.0',
  outputPreferences: { formats: ['JSON', 'CSV'], templateVersion: 'research-report-v1', includeWorkflowTrace: true, includeEvidenceGraph: true },
}
```

- [ ] **Step 4: Wire operation and route, then run tests**

Run: `npm test -- apps/api/src/application/services/demo-service.test.ts apps/api/src/application/concrete-rest-api-services.test.ts apps/api/src/api.integration.test.ts`

- [ ] **Step 5: Commit the demo API slice**

```powershell
git add packages/shared/src/api apps/api/src/contracts.ts apps/api/src/services.ts apps/api/src/routes.ts apps/api/src/application
git commit -m "feat: add credential-free judge demo"
```

### Task 3: Vercel-to-Render API boundary

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/config/environment.ts`
- Modify: `apps/api/src/config/environment.test.ts`
- Modify: `apps/api/src/application.ts`
- Modify: `apps/api/src/api.integration.test.ts`
- Modify: `.env.example`
- Modify: `.env.production.example`
- Create: `render.yaml`
- Create: `vercel.json`
- Create: `docs/DEPLOYMENT.md`

**Interfaces:**
- Produces: `parseApiEnvironment(input: NodeJS.ProcessEnv): ParsedApiEnvironment` and `CORS_ORIGINS: string[]` parsed from a comma-separated environment variable.
- Produces: exact Vercel build output `apps/web/dist`.
- Produces: Render services `immunograph-api` and `immunograph-mcp`, with `/data` persistent disk on API.

- [ ] **Step 1: Write failing environment and CORS tests**

```ts
expect(parseApiEnvironment({ CORS_ORIGINS: 'https://one.vercel.app, https://two.vercel.app' }).CORS_ORIGINS)
  .toEqual(['https://one.vercel.app', 'https://two.vercel.app']);
expect(response.headers['access-control-allow-origin']).toBe('https://one.vercel.app');
```

Also assert an unlisted origin receives no allow-origin header.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `npm test -- apps/api/src/config/environment.test.ts apps/api/src/api.integration.test.ts`

- [ ] **Step 3: Add `@fastify/cors` and implement an exact-origin allowlist**

Register CORS before routes. Allow requests with no `Origin` for server-to-server and health checks. Echo only an exact configured origin; do not use `*`.

- [ ] **Step 4: Add deployment manifests and exact documentation**

`vercel.json` builds with `npm run build --workspace @immunograph/web` and serves `apps/web/dist`. `render.yaml` builds API/MCP from their Dockerfiles, sets health paths, and mounts `/data` for SQLite/artifacts. `docs/DEPLOYMENT.md` gives the order MCP → API → Vercel and the exact environment names without fake URLs.

- [ ] **Step 5: Validate configs and commit**

Run: `npm test -- apps/api/src/config/environment.test.ts apps/api/src/api.integration.test.ts && docker compose config --quiet`

```powershell
git add apps/api/package.json package-lock.json apps/api/src/config apps/api/src/application.ts apps/api/src/api.integration.test.ts .env.example .env.production.example render.yaml vercel.json docs/DEPLOYMENT.md
git commit -m "feat: configure Vercel and Render deployment"
```

### Task 4: Public landing page and Judge Mode state

**Files:**
- Create: `apps/web/src/features/judge-mode.tsx`
- Create: `apps/web/src/features/judge-mode.test.tsx`
- Create: `apps/web/src/features/landing-page.tsx`
- Create: `apps/web/src/features/landing-page.test.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/features/auth.tsx`
- Modify: `apps/web/src/lib/query-keys.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `JudgeModeProvider`, `useJudgeMode()`, and `startJudgeDemo()`.
- Persists only `{ projectId, runId, expiresAt }` in `sessionStorage` key `immunograph.judge-workspace.v1`.
- Produces: `/` landing page and `/judge` launcher; real app routes remain available without `Protected`.

- [ ] **Step 1: Write failing landing and provider tests**

```tsx
expect(screen.getByRole('heading', { name: /auditable epitope prioritization/i })).toBeVisible();
await user.click(screen.getByRole('button', { name: /launch judge demo/i }));
expect(apiRequest).toHaveBeenCalledWith('/demo/start', demoWorkspaceSchema, expect.anything());
expect(navigate).toHaveBeenCalledWith(`/projects/${projectId}`);
```

Assert the page contains `Track 4 — Domain Agents` and the research-use disclaimer, but no email/password fields.

- [ ] **Step 2: Run focused tests and confirm failures**

Run: `npm test -- apps/web/src/features/landing-page.test.tsx apps/web/src/features/judge-mode.test.tsx`

- [ ] **Step 3: Implement public entry and session-scoped judge state**

Use exact hero copy:

```text
From protein sequence to an auditable epitope shortlist.
ImmunoGraph coordinates typed scientific tools, deterministic rules, provenance, and human approval—without letting an LLM invent biological evidence.
```

The primary action calls `/demo/start`; pending, failure, and retry states remain on the page. Remove the global `Protected` wrapper and do not advertise the existing auth routes as private data protection.

- [ ] **Step 4: Run UI and app integration tests**

Run: `npm test -- apps/web/src/features/landing-page.test.tsx apps/web/src/features/judge-mode.test.tsx apps/web/src/app.integration.test.tsx`

- [ ] **Step 5: Commit the public entry slice**

```powershell
git add apps/web/src/features apps/web/src/app.tsx apps/web/src/main.tsx apps/web/src/lib/query-keys.ts apps/web/src/styles.css
git commit -m "feat: add public hackathon judge mode"
```

### Task 5: Guided judge journey

**Files:**
- Create: `apps/web/src/features/judge-journey.tsx`
- Create: `apps/web/src/features/judge-journey.test.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/features/workspace-pages.tsx`
- Modify: `apps/web/src/features/structural-pages.tsx`

**Interfaces:**
- Produces: `deriveJudgeSteps(project: ProjectDetail, run: RunDetail): JudgeStep[]`.
- Produces step IDs `input`, `configuration`, `analysis`, `evidence`, `approval`, `report` with real destination URLs.

- [ ] **Step 1: Write failing step-derivation tests**

```ts
expect(deriveJudgeSteps(project, draftRun).map(({ status }) => status))
  .toEqual(['complete', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
expect(deriveJudgeSteps(project, completedRun).at(-1)?.status).toBe('current');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- apps/web/src/features/judge-journey.test.tsx`

- [ ] **Step 3: Implement the compact journey rail and navigation focus**

Render it only when the current project matches `JudgeModeProvider`. Hide Structures and Docking in Judge Mode navigation. Add `Experimental — outside the judged workflow` alerts to their direct-route pages.

- [ ] **Step 4: Run focused UI tests**

Run: `npm test -- apps/web/src/features/judge-journey.test.tsx apps/web/src/app.integration.test.tsx`

- [ ] **Step 5: Commit the journey slice**

```powershell
git add apps/web/src/features/judge-journey* apps/web/src/components/app-shell.tsx apps/web/src/features/workspace-pages.tsx apps/web/src/features/structural-pages.tsx
git commit -m "feat: guide judges through the scientific workflow"
```

### Task 6: Deterministic trust evaluation and API summary

**Files:**
- Create: `packages/algorithms/src/trust-evaluation.ts`
- Create: `packages/algorithms/src/trust-evaluation.test.ts`
- Modify: `packages/algorithms/src/index.ts`
- Create: `packages/shared/src/api/trust.ts`
- Modify: `packages/shared/src/api/index.ts`
- Modify: `apps/api/src/services.ts`
- Modify: `apps/api/src/routes.ts`
- Create: `apps/api/src/application/services/trust-service.ts`
- Create: `apps/api/src/application/services/trust-service.test.ts`
- Modify: `apps/api/src/application/create-services.ts`
- Modify: `apps/api/src/application/concrete-rest-api-services.ts`
- Modify: `apps/api/src/contracts.ts`

**Interfaces:**
- Produces: `evaluateTrust(input: TrustEvaluationInput): TrustCheck[]`.
- Produces: `trustSummarySchema` and `TrustSummary`.
- Produces: `GET /api/v1/runs/:runId/trust-summary`.

- [ ] **Step 1: Write failing pure evaluation tests**

Cover `fixture_manifest_valid`, `provenance_complete`, `constraints_enforced`, `approval_gate`, `artifact_hashes`, and `abstention_visible`. Each result has `id`, `label`, `status: 'PASS'|'FAIL'|'UNAVAILABLE'`, `detail`, and `evidence`.

```ts
expect(evaluateTrust(validInput).every(({ status }) => status === 'PASS')).toBe(true);
expect(evaluateTrust({ ...validInput, artifactHashes: [] }))
  .toContainEqual(expect.objectContaining({ id: 'artifact_hashes', status: 'UNAVAILABLE' }));
```

- [ ] **Step 2: Run tests and confirm missing implementation**

Run: `npm test -- packages/algorithms/src/trust-evaluation.test.ts apps/api/src/application/services/trust-service.test.ts`

- [ ] **Step 3: Implement pure checks, schemas, and repository aggregation**

The summary contains run identity/mode, source counts, stage evidence, configuration hash, approval snapshots, artifact hashes, checks, and the mandatory scientific disclaimer. It contains no invented aggregate percentage.

- [ ] **Step 4: Wire the operation and run focused tests**

Run: `npm test -- packages/algorithms/src/trust-evaluation.test.ts apps/api/src/application/services/trust-service.test.ts apps/api/src/application/concrete-rest-api-services.test.ts apps/api/src/api.integration.test.ts`

- [ ] **Step 5: Commit the trust backend slice**

```powershell
git add packages/algorithms/src packages/shared/src/api apps/api/src
git commit -m "feat: expose deterministic scientific trust evidence"
```

### Task 7: Scientific Trust Center UI

**Files:**
- Create: `apps/web/src/features/trust-center-page.tsx`
- Create: `apps/web/src/features/trust-center-page.test.tsx`
- Modify: `apps/web/src/features/data-hooks.ts`
- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `useTrustSummary(runId)`.
- Produces: route `/runs/:runId/trust` and navigation label `Trust Center`.

- [ ] **Step 1: Write failing page tests**

```tsx
expect(screen.getByRole('heading', { name: /scientific trust center/i })).toBeVisible();
expect(screen.getByText('Fixture manifest integrity')).toBeVisible();
expect(screen.getByText('Demonstration only — not scientific output')).toBeVisible();
expect(screen.queryByText(/trust score/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- apps/web/src/features/trust-center-page.test.tsx`

- [ ] **Step 3: Implement the evidence-first page**

Use an open status list and provenance table, not a dense card grid. Show hash values in copyable code text, source states with existing badges, and explicit `UNAVAILABLE` reasons. Add a single `Continue to reports` action.

- [ ] **Step 4: Run page and navigation tests**

Run: `npm test -- apps/web/src/features/trust-center-page.test.tsx apps/web/src/app.integration.test.tsx`

- [ ] **Step 5: Commit the Trust Center UI**

```powershell
git add apps/web/src/features/trust-center-page* apps/web/src/features/data-hooks.ts apps/web/src/components/app-shell.tsx apps/web/src/app.tsx apps/web/src/styles.css
git commit -m "feat: add scientific trust center"
```

### Task 8: Full judge-journey E2E and terminology correction

**Files:**
- Modify: `tests/e2e/core-workspace.spec.mjs`
- Create: `tests/e2e/judge-journey.spec.mjs`
- Modify: `playwright.config.mjs`
- Modify: `packages/algorithms/src/model-predictors.ts`
- Modify: `packages/algorithms/src/model-predictors.test.ts`
- Modify: `apps/mcp/src/prediction/prediction.controller.ts`
- Modify: `README.md`

**Interfaces:**
- Produces one browser test that enters without auth and completes launch → approval → run → candidate review → shortlist → Trust Center → report.
- Changes external terminology from `ML+DL ensemble` to `deterministic dual-head demonstration scorer`.

- [ ] **Step 1: Write the failing credential-free E2E test**

The test starts at `/`, asserts no credential input exists, launches Judge Mode, approves the configuration, starts the run, waits for the shortlist gate, approves at least one eligible candidate, opens Trust Center, creates a report, and verifies a download link. Repeat the same core path in the mobile project.

- [ ] **Step 2: Run E2E and capture the first failure**

Run: `npm run test:e2e -- --grep "judge journey" --project=chromium`

- [ ] **Step 3: Correct scorer naming in code, provenance, tests, and documentation**

Keep exported function names stable where changing them would add unrelated churn; change user-visible metadata and comments to the truthful deterministic terminology.

- [ ] **Step 4: Fix only journey blockers, then run desktop and mobile E2E**

Run: `npm run test:e2e -- --grep "judge journey"`

- [ ] **Step 5: Commit the completed journey**

```powershell
git add tests/e2e playwright.config.mjs packages/algorithms/src/model-predictors* apps/mcp/src/prediction/prediction.controller.ts README.md
git commit -m "test: verify the complete hackathon judge journey"
```

### Task 9: Judge-first README and repository evidence

**Files:**
- Replace: `README.md`
- Create: `AGENTS.md`
- Create: `LICENSE`
- Create: `docs/CODEX_BUILD_LOG.md`
- Create: `docs/DEMO_SCRIPT.md`
- Create: `docs/SUBMISSION_CHECKLIST.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/PROJECT_SPEC.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `docs/TEST_PLAN.md`
- Create: `.github/workflows/ci.yml`
- Create: `scripts/check-docs.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run docs:check` validating relative Markdown links and `npm run` references.
- Produces: CI jobs for format, lint, typecheck, tests, build, docs, and credential-free E2E.

- [ ] **Step 1: Write the failing docs checker and fixtures**

The checker exits nonzero for a missing relative link or an unknown root npm script and prints `file:line target`. Add a Vitest or direct Node fixture test proving both cases.

- [ ] **Step 2: Run docs check and record current failures**

Run: `npm run docs:check`

Expected initial failures include the missing NitroCloud guide, root-relative CONTRIBUTING links, and `nitro:verify`.

- [ ] **Step 3: Rewrite documentation with verified facts**

The README follows the 17-section order in the design specification. Use `LIVE_DEMO_URL` and `DEMO_VIDEO_URL` only in `docs/SUBMISSION_CHECKLIST.md` as values the owner inserts after deployment/recording; do not publish fake links. Document 311 as the pre-change baseline and replace it with the final verified count after the quality gate.

- [ ] **Step 4: Add CI, license, agent guide, format authored files, and run docs validation**

Run: `npm run format && npm run docs:check && npm run format:check`

- [ ] **Step 5: Commit the submission package**

```powershell
git add README.md AGENTS.md LICENSE CONTRIBUTING.md docs .github/workflows/ci.yml scripts/check-docs.mjs package.json
git commit -m "docs: package ImmunoGraph for hackathon judging"
```

### Task 10: Final verification, visual fidelity, and deployment smoke

**Files:**
- Create: `docs/superpowers/verification/2026-08-03-hackathon-release.md`
- Modify only if a check exposes a defect: files already named in Tasks 1–9

**Interfaces:**
- Produces a release ledger containing exact commands, results, desktop/mobile screenshots, hosted endpoints checked, known limitations, and final commit SHA.

- [ ] **Step 1: Run the complete local quality gate**

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run docs:check
npm run test:e2e
npm audit
```

- [ ] **Step 2: Build and smoke-test containers**

Run Docker Desktop, then:

```powershell
docker compose build
docker compose up -d
Invoke-WebRequest http://127.0.0.1:8080/health -UseBasicParsing
Invoke-RestMethod http://127.0.0.1:8080/api/v1/settings/runtime
docker compose down
```

- [ ] **Step 3: Perform visual verification**

Capture landing, project, workflow, candidate evidence, Trust Center, and report states at Desktop Chrome and Pixel 7 sizes. Inspect the screenshots for copy, hierarchy, source-status semantics, typography, focus, overflow, and experimental-module exclusion. Record at least five comparison points in the release ledger.

- [ ] **Step 4: Run hosted smoke checks after owner deployment**

Against the actual Vercel/Render URLs, verify landing HTTP 200, Render API readiness, MCP health, demo creation, one complete workflow, Trust Center, and report download. Record exact URLs only in the release ledger and README after they are real.

- [ ] **Step 5: Final diff and submission audit**

Run:

```powershell
git diff --check
git status --short
git log -10 --oneline
```

Confirm the public repository revision matches the deployed revision, the Google Doc and video are public, and BlockseBlock still shows a draft before Final Submit.

- [ ] **Step 6: Commit verification evidence**

```powershell
git add docs/superpowers/verification/2026-08-03-hackathon-release.md
git commit -m "docs: record hackathon release verification"
```
