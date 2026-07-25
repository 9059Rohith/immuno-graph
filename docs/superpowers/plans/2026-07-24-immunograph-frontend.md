# ImmunoGraph Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete API-only ImmunoGraph React frontend in the approved Research Console revision 2 visual system.

**Architecture:** A Vite SPA uses React Router for directly addressable project/run routes and TanStack React Query for all server state. Shared Zod transport contracts validate every API response; feature service modules and display-only adapters sit between transport and presentational components. React Flow, Recharts, and a bounded SVG sequence track render only server-provided view models and always include accessible list/table alternatives.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, Tailwind CSS 4, shadcn/ui (Radix/New York), TanStack React Query, React Router, React Hook Form, Zod, React Flow, Recharts, Vitest, Testing Library.

## Global Constraints

- Implement the accepted `Research Console, revision 2` design without changing its information hierarchy, palette, navigation, density, or visible terminology.
- Deep evergreen `#123C38`, action teal `#176D62`, mineral canvas `#F4F7F5`, and primary ink `#17221F` are semantic CSS variables, not repeated arbitrary utilities.
- The Dashboard is `/`; there is no global Current Run item and no dashboard run-quality indicator.
- Project Settings owns project analysis configuration. System Diagnostics is read-only and owns infrastructure/runtime information.
- Production code consumes only `VITE_API_BASE_URL`; it contains no scientific mock data, fixture fallback, ranking, graph-edge derivation, or missing-value substitution.
- Components receive formatted view models. Scientific state and eligibility remain API-owned.
- Every async screen has loading, actionable error, explanatory empty, partial-evidence, and data behavior where applicable.
- Every status uses text, icon, and supplementary color.
- Mobile is a first-class surface; graph/chart information remains available by keyboard and in list/table form.
- At most one React Flow instance and one Recharts instance render on a page. Sequence maps render at most 500 server-provided segments.
- Candidate subview, candidate selection, filters, pagination, evidence depth, and graph/list mode are URL-backed.
- Use shadcn components through the CLI and semantic variants; do not hand-roll primitives already provided by shadcn.
- Use direct imports for heavy graph/chart modules and route-level lazy loading to limit initial bundle cost.
- Follow TDD: write a failing behavior test, verify RED, implement the minimum, verify GREEN, then refactor.
- The workspace is not currently a Git repository. Do not initialize Git without user authorization; use passing-test checkpoints instead of commit steps.

---

## Visualization Technical Design

| Surface | Analytical job | Renderer owner | Immediate evidence | Accessible/mobile fallback |
|---|---|---|---|---|
| Dashboard | Workspace monitoring | semantic cards + table | project/run counts, health, recency | identical text/table |
| Candidate rankings | comparison/ranking | server-paginated table | rank, score, confidence, provenance | responsive table with labelled horizontal scroll |
| Population coverage | population comparison | Recharts horizontal bars | estimated coverage and unavailable values | adjacent data table; no zero for missing data |
| Workflow | dependency/status network | React Flow | stage state, source, duration | ordered stage list with same actions |
| Evidence | provenance relationship network | React Flow | stored nodes and edges | relationship table |
| Sequence map | positional interval comparison | bounded semantic SVG | track, coordinates, overlap | coordinate input and textual candidate list |

Remote data remains stale-but-visible during background refresh. Every visual exposes source/method/timestamp caveats without hover. URL state survives refresh and back/forward navigation. React Flow views use server positions/edges; the frontend never runs a scientific layout or creates relations.

## File Structure

### Shared transport contracts

- Create `packages/shared/src/api/common.ts`: identifiers, dates, status enums, envelopes, API errors.
- Create `packages/shared/src/api/projects.ts`: project create/list/detail DTO schemas.
- Create `packages/shared/src/api/runs.ts`: run configuration, lifecycle, connector, stage, approval DTO schemas.
- Create `packages/shared/src/api/candidates.ts`: list/detail/coverage/shortlist DTO schemas.
- Create `packages/shared/src/api/graphs.ts`: workflow, evidence, and visualization DTO schemas.
- Create `packages/shared/src/api/reports.ts`: report job and artifact DTO schemas.
- Create `packages/shared/src/api/settings.ts`: connector, profile, runtime, fixture, and build DTO schemas.
- Create `packages/shared/src/api/index.ts`: narrow API-contract exports.
- Modify `packages/shared/src/index.ts`: export the API schemas and inferred types.

### Frontend foundation

- Modify `apps/web/package.json` and `package-lock.json`: runtime/test dependencies.
- Modify `vitest.config.ts`: shared browser test setup.
- Create `apps/web/src/test/setup.ts`: jest-dom, matchMedia, ResizeObserver, pointer/scroll shims.
- Create `apps/web/src/test/render.tsx`: fresh QueryClient and MemoryRouter test harness.
- Modify `apps/web/src/styles.css`: approved semantic theme, typography, focus, graph/chart imports.
- Create `apps/web/src/lib/env.ts`: validated `VITE_API_BASE_URL`.
- Create `apps/web/src/lib/api-error.ts`: typed client error.
- Create `apps/web/src/lib/api-client.ts`: envelope parsing and artifact download.
- Create `apps/web/src/lib/query-client.ts`: retry and stale-time policy.
- Create `apps/web/src/lib/query-keys.ts`: centralized keys.
- Create `apps/web/src/lib/run-events.ts`: EventSource lifecycle and normalized cache updates.
- Create `apps/web/src/lib/format.ts`: presentation-only dates, durations, scores, hashes.

### Application and UI

- Modify `apps/web/src/main.tsx` and `apps/web/src/app.tsx`: providers and router.
- Create `apps/web/src/app-router.tsx`: lazy route definitions.
- Create `apps/web/src/components/ui/*`: shadcn-generated primitives.
- Create `apps/web/src/components/app-shell.tsx`, `app-sidebar.tsx`, `project-nav.tsx`, `page-header.tsx`: responsive shell.
- Create `apps/web/src/components/page-state.tsx`, `status-badge.tsx`, `source-status-badge.tsx`, `metric-summary.tsx`, `hash-value.tsx`: shared application components.
- Replace the scaffold-only feature indexes with feature services, hooks, adapters, pages, and focused components under `features/projects`, `features/runs`, `features/workflow`, `features/candidates`, `features/evidence`, `features/reports`, and `features/settings`.

### Verification artifacts

- Create `docs/superpowers/specs/assets/research-console-v2.png`: stable screenshot of the accepted concept.
- Create `docs/superpowers/verification/2026-07-24-frontend-fidelity.md`: concept/render comparison ledger.
- Modify `TASKS.md`: mark only verified Phase 7 items.

### Task 1: Install the frontend runtime and test foundation

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/test/render.tsx`

**Interfaces:**
- Produces: `renderApp(ui, initialEntries)` and a fresh React Query client for every test.

- [ ] **Step 1: Install pinned runtime dependencies**

Run from the repository root:

```powershell
npm install --workspace @immunograph/web @tanstack/react-query@5.101.4 react-router-dom@7.18.1 react-hook-form@7.82.0 @hookform/resolvers@5.4.0 zod@3.25.76 sonner@2.0.7
npm install --save-dev --workspace @immunograph/web @testing-library/react@16.3.2 @testing-library/user-event@14.6.1 @testing-library/jest-dom@6.9.1 jsdom@27.2.0
```

Expected: package manifests and lockfile update without peer-dependency errors.

- [ ] **Step 2: Add the browser test setup**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }),
});

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver;
HTMLElement.prototype.scrollIntoView = () => undefined;
```

Configure `vitest.config.ts` with `setupFiles: ['apps/web/src/test/setup.ts']`. Web tests use the `// @vitest-environment jsdom` file directive; Node package tests remain in the Node environment.

- [ ] **Step 3: Create the reusable test renderer**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

export function renderApp(ui: ReactNode, initialEntries = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
```

Use `userEvent.setup()` inside each test so timer/input state cannot leak.

- [ ] **Step 4: Verify the scaffold still builds**

```powershell
npm run typecheck
npm run build --workspace @immunograph/web
```

Expected: both commands exit `0` before feature work begins.

### Task 2: Install shadcn primitives and lock the Research Console theme

**Files:**
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/components/ui/*` through the shadcn CLI
- Test: `apps/web/src/components/status-badge.test.tsx`
- Create: `apps/web/src/components/status-badge.tsx`
- Create: `apps/web/src/components/source-status-badge.tsx`

**Interfaces:**
- Produces: semantic tokens and consistent text/icon/color status components.

- [ ] **Step 1: Inspect component APIs before installation**

```powershell
Set-Location apps/web
npx shadcn@latest info --json
npx shadcn@latest docs alert alert-dialog badge breadcrumb button card chart checkbox dialog drawer empty field input pagination progress select separator sheet sidebar skeleton sonner switch table tabs textarea tooltip
```

Read the returned component documentation URLs before composing them.

- [ ] **Step 2: Add the required primitives**

```powershell
npx shadcn@latest add alert alert-dialog badge breadcrumb button card chart checkbox dialog drawer empty field input pagination progress select separator sheet sidebar skeleton sonner switch table tabs textarea tooltip
```

Read every generated file, keep Radix/New York APIs, replace no semantic component with custom markup, and return to the repository root.

- [ ] **Step 3: Write the failing provenance badge test**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Activity, Database, FlaskConical, TriangleAlert } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { SourceStatusBadge } from './source-status-badge';

describe('SourceStatusBadge', () => {
  it.each([
    ['LIVE', 'Live', Activity],
    ['CACHED', 'Cached live result', Database],
    ['FIXTURE', 'Demo fixture', FlaskConical],
    ['FAILED', 'Failed', TriangleAlert],
  ] as const)('renders %s with an accessible label', (status, label) => {
    render(<SourceStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
```

- [ ] **Step 4: Verify RED, then implement semantic status variants**

Run `npm test -- apps/web/src/components/status-badge.test.tsx`; expect module-not-found failure. Implement `SourceStatusBadge` and `StatusBadge` with `Badge`, a typed exhaustive status map, Lucide icon objects, and no raw color classes.

- [ ] **Step 5: Implement the approved CSS variables**

Define light/dark semantic variables in `styles.css`; the light values include:

```css
:root {
  --background: #f4f7f5;
  --foreground: #17221f;
  --card: #ffffff;
  --card-foreground: #17221f;
  --primary: #176d62;
  --primary-foreground: #ffffff;
  --sidebar: #123c38;
  --sidebar-foreground: #f4f7f5;
  --border: #d8e1dd;
  --ring: #176d62;
  --radius: 0.625rem;
}
```

Add deliberate control typography, `:focus-visible`, reduced-motion behavior, React Flow base CSS imports, and minimum 12px scientific-table text.

- [ ] **Step 6: Verify GREEN and theme compilation**

Run the focused test, then `npm run build --workspace @immunograph/web`.

### Task 3: Define shared response contracts and the API client

**Files:**
- Create: `packages/shared/src/api/common.ts`
- Create: `packages/shared/src/api/projects.ts`
- Create: `packages/shared/src/api/runs.ts`
- Create: `packages/shared/src/api/candidates.ts`
- Create: `packages/shared/src/api/graphs.ts`
- Create: `packages/shared/src/api/reports.ts`
- Create: `packages/shared/src/api/settings.ts`
- Create: `packages/shared/src/api/index.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/web/src/lib/api-client.test.ts`
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/api-error.ts`
- Create: `apps/web/src/lib/api-client.ts`

**Interfaces:**
- Produces: `apiClient.get/post/delete/download`, strict response schemas, and inferred DTO types.

- [ ] **Step 1: Define strict common transport schemas**

```ts
import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const isoInstantSchema = z.string().datetime({ offset: true });
export const sourceStatusSchema = z.enum(['LIVE', 'CACHED', 'FIXTURE', 'FAILED']);
export const runStatusSchema = z.enum([
  'DRAFT', 'AWAITING_CONFIGURATION_APPROVAL', 'QUEUED', 'RUNNING',
  'AWAITING_SHORTLIST_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED',
]);
export const runQualitySchema = z.enum(['COMPLETE', 'PARTIAL', 'FIXTURE_ONLY']);
export const trackSchema = z.enum(['MHCI', 'MHCII', 'BCELL']);
export const categorySchema = z.enum(['RECOMMENDED', 'REVIEW', 'REJECTED']);
export const apiErrorSchema = z.object({
  requestId: uuidSchema,
  error: z.object({
    code: z.string().min(1), message: z.string().min(1), retryable: z.boolean(),
    fieldErrors: z.record(z.array(z.string())).optional(),
  }).strict(),
}).strict();
export const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ requestId: uuidSchema, data }).strict();
```

- [ ] **Step 2: Define exact feature DTO schemas**

Implement the documented view models with strict building blocks. The following shapes are the required public surface; split them among the feature files listed above and infer every TypeScript type with `z.infer`:

```ts
const sourceMixSchema = z.array(sourceStatusSchema).max(4);
const runSummarySchema = z.object({
  id: uuidSchema,
  revision: z.number().int().positive(),
  status: runStatusSchema,
  quality: runQualitySchema.nullable(),
  sourceMix: sourceMixSchema,
  updatedAt: isoInstantSchema,
}).strict();

export const projectSummarySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  organism: z.string().nullable(),
  proteinName: z.string().nullable(),
  latestRun: runSummarySchema.nullable(),
  sourceMix: sourceMixSchema,
  updatedAt: isoInstantSchema,
}).strict();

export const projectListSchema = z.object({
  items: z.array(projectSummarySchema),
  nextCursor: z.string().nullable(),
  portfolioSummary: z.object({
    projectCount: z.number().int().nonnegative(),
    runCounts: z.object({
      total: z.number().int().nonnegative(),
      running: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
    }).strict(),
    candidateCount: z.number().int().nonnegative(),
    reportCount: z.number().int().nonnegative(),
    recentSince: isoInstantSchema,
    recentRunCount: z.number().int().nonnegative(),
    asOf: isoInstantSchema,
  }).strict(),
}).strict();

const connectorExecutionSchema = z.object({
  connectorId: z.string().min(1),
  method: z.string().min(1),
  sourceStatus: sourceStatusSchema,
  version: z.string().min(1),
  durationMs: z.number().nonnegative(),
  note: z.string().nullable(),
}).strict();

const stageSchema = z.object({
  stageKey: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED']),
  attempt: z.number().int().positive(),
  progress: z.number().min(0).max(1),
  durationMs: z.number().nonnegative().nullable(),
  sourceStatus: sourceStatusSchema.nullable(),
  warningCode: z.string().nullable(),
  errorCode: z.string().nullable(),
  retryable: z.boolean(),
}).strict();

const tCellConfigurationSchema = z.object({
  enabled: z.boolean(),
  alleles: z.array(z.string().min(1)),
  peptideLengths: z.array(z.number().int().positive()),
  methods: z.array(z.string().min(1)),
}).strict();
const bCellConfigurationSchema = z.object({
  enabled: z.boolean(),
  methods: z.array(z.string().min(1)),
}).strict();

export const runDetailSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  revision: z.number().int().positive(),
  status: runStatusSchema,
  quality: runQualitySchema.nullable(),
  configurationHash: sha256Schema,
  configuration: z.object({
    analysis: z.object({
      mhci: tCellConfigurationSchema,
      mhcii: tCellConfigurationSchema,
      bcell: bCellConfigurationSchema,
    }).strict(),
    populations: z.array(z.string().min(1)),
    fallbackPolicy: z.string().min(1),
    ruleProfileVersion: z.string().min(1),
    rankingProfileVersion: z.string().min(1),
    outputPreferences: z.object({
      formats: z.array(z.enum(['JSON', 'CSV'])).min(1),
      templateVersion: z.string().min(1),
      includeWorkflowTrace: z.boolean(),
      includeEvidenceGraph: z.boolean(),
    }).strict(),
  }).strict(),
  candidateCounts: z.record(trackSchema, z.object({
    recommended: z.number().int().nonnegative(),
    review: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }).strict()),
  stageProgress: z.array(stageSchema),
  connectors: z.array(connectorExecutionSchema),
  approvalRequirements: z.array(z.enum(['CONFIGURATION', 'SHORTLIST'])),
  createdAt: isoInstantSchema,
  startedAt: isoInstantSchema.nullable(),
  completedAt: isoInstantSchema.nullable(),
  updatedAt: isoInstantSchema,
}).strict();

const measuredValueSchema = z.object({
  value: z.number().finite().nullable(),
  unavailableReason: z.string().nullable(),
  sourceStatus: sourceStatusSchema.nullable(),
}).strict().refine((item) => (item.value === null) === (item.unavailableReason !== null), {
  message: 'Unavailable values require a reason and available values cannot have one',
});

export const candidateCardSchema = z.object({
  id: uuidSchema,
  track: trackSchema,
  rank: z.number().int().positive(),
  peptide: z.string().min(1),
  start: z.number().int().positive(),
  end: z.number().int().positive(),
  allele: z.string().nullable(),
  predictorScore: measuredValueSchema,
  agreement: measuredValueSchema,
  completeness: measuredValueSchema,
  singletonCoverage: measuredValueSchema,
  finalScore: z.number().finite(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  category: categorySchema,
  topReasons: z.array(z.string()),
  warnings: z.array(z.string()),
  sourceMix: sourceMixSchema,
  selectable: z.boolean(),
}).strict();

export const candidateListSchema = z.object({
  items: z.array(candidateCardSchema),
  nextCursor: z.string().nullable(),
  rankingSnapshotHash: sha256Schema,
}).strict();

const observationSchema = z.object({
  method: z.string().min(1), version: z.string().min(1), sourceStatus: sourceStatusSchema,
  rawValue: z.number().finite(), normalizedValue: z.number().min(0).max(1).nullable(),
  transformation: z.string().nullable(),
}).strict();
const ruleOutcomeSchema = z.object({
  ruleId: z.string().min(1), label: z.string().min(1), outcome: z.enum(['PASS', 'REVIEW', 'FAIL']),
  reason: z.string().min(1),
}).strict();
export const candidateDetailSchema = z.object({
  candidate: candidateCardSchema,
  observations: z.array(observationSchema),
  consensus: measuredValueSchema,
  completeness: measuredValueSchema,
  singletonCoverage: measuredValueSchema,
  shortlistCoverage: measuredValueSchema,
  constraints: z.array(ruleOutcomeSchema),
  ranking: z.object({
    components: z.array(z.object({ name: z.string(), value: z.number(), effectiveWeight: z.number() }).strict()),
    penalties: z.array(z.object({ name: z.string(), value: z.number() }).strict()),
    finalScore: z.number().finite(),
  }).strict(),
  graphNeighborIds: z.array(z.string().min(1)),
  deterministicExplanation: z.string().min(1),
  llmExplanation: z.object({ text: z.string().min(1), generationModeUsed: z.enum(['DETERMINISTIC', 'LLM']) }).nullable(),
}).strict();

const graphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }).strict(),
  data: z.object({
    label: z.string().min(1), subtitle: z.string().nullable(), status: z.string().nullable(),
    sourceStatus: sourceStatusSchema.nullable(), warningCode: z.string().nullable(), detailLines: z.array(z.string()),
  }).strict(),
}).strict();
const graphEdgeSchema = z.object({
  id: z.string().min(1), source: z.string().min(1), target: z.string().min(1),
  label: z.string().nullable(), relation: z.string().min(1), provenance: z.string().nullable(),
}).strict();
export const graphSchema = z.object({
  version: z.string().min(1), nodes: z.array(graphNodeSchema), edges: z.array(graphEdgeSchema), generatedAt: isoInstantSchema,
}).strict();

export const sequenceMapSchema = z.object({
  version: z.string().min(1), proteinLength: z.number().int().positive(),
  tracks: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
  segments: z.array(z.object({
    candidateId: uuidSchema, trackId: z.string(), start: z.number().int().positive(), end: z.number().int().positive(),
    category: categorySchema, label: z.string(), lane: z.number().int().nonnegative(),
  }).strict()),
  generatedAt: isoInstantSchema,
}).strict();

export const coverageVisualizationSchema = z.object({
  version: z.string().min(1),
  populations: z.array(z.object({
    populationId: z.string(), label: z.string(), classMode: z.enum(['CLASS_I', 'CLASS_II', 'COMBINED']),
    coverage: measuredValueSchema, method: z.string().nullable(), observedAt: isoInstantSchema.nullable(),
  }).strict()),
  generatedAt: isoInstantSchema,
}).strict();

export const artifactSchema = z.object({
  id: uuidSchema,
  type: z.enum(['JSON', 'CSV', 'EVIDENCE_GRAPH', 'WORKFLOW_TRACE']),
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: sha256Schema,
  createdAt: isoInstantSchema,
}).strict();
export const artifactListSchema = z.object({ items: z.array(artifactSchema) }).strict();
export const reportJobSchema = z.object({
  artifactJobId: uuidSchema,
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
}).strict();

const healthSchema = z.enum(['AVAILABLE', 'DEGRADED', 'UNAVAILABLE']);
export const connectorSchema = z.object({
  connectorId: z.string().min(1),
  displayName: z.string().min(1),
  methods: z.array(z.string().min(1)),
  liveSupported: z.boolean(),
  fixtureOnly: z.boolean(),
  licenseStatus: z.enum(['APPROVED', 'RESTRICTED', 'UNKNOWN']),
}).strict();
export const connectorHealthSchema = z.object({
  connectorId: z.string().min(1),
  health: healthSchema,
  sourceStatus: sourceStatusSchema.nullable(),
  checkedAt: isoInstantSchema,
  message: z.string().nullable(),
}).strict();
export const profileSchema = z.object({
  name: z.string().min(1), version: z.string().min(1), sha256: sha256Schema, approved: z.boolean(),
}).strict();
export const runtimeSettingsSchema = z.object({
  demoMode: z.boolean(),
  llmEnabled: z.boolean(),
  databaseStatus: healthSchema,
  artifactPathStatus: healthSchema,
  fixtureManifest: z.object({
    version: z.string().min(1),
    sha256: sha256Schema,
    entries: z.array(z.object({
      fixtureId: z.string().min(1), organism: z.string().min(1), proteinName: z.string().min(1),
      approved: z.boolean(), sha256: sha256Schema,
    }).strict()),
  }).strict(),
  build: z.object({
    applicationVersion: z.string().min(1), specificationVersion: z.string().min(1),
    commitSha: z.string().min(7).nullable(), builtAt: isoInstantSchema.nullable(),
  }).strict(),
}).strict();
```

Add the remaining composition schemas exactly:

```ts
export const projectDetailSchema = z.object({
  project: z.object({
    id: uuidSchema, name: z.string().min(1), organism: z.string().nullable(),
    proteinName: z.string().nullable(), description: z.string().nullable(),
    createdAt: isoInstantSchema, updatedAt: isoInstantSchema,
  }).strict(),
  protein: z.object({
    id: uuidSchema, header: z.string().min(1), length: z.number().int().positive(),
    sha256: sha256Schema, validationProfile: z.string().min(1), warnings: z.array(z.string()),
  }).strict(),
  runs: z.array(runSummarySchema),
  latestApproval: z.object({
    kind: z.enum(['CONFIGURATION', 'SHORTLIST']),
    status: z.enum(['REQUIRED', 'APPROVED']),
    approvedAt: isoInstantSchema.nullable(),
  }).strict().nullable(),
}).strict();
export const connectorListSchema = z.object({ items: z.array(connectorSchema) }).strict();
export const connectorHealthListSchema = z.object({ items: z.array(connectorHealthSchema) }).strict();
export const profileListSchema = z.object({ items: z.array(profileSchema) }).strict();
```

Nullable scientific values use `measuredValueSchema`; they never default to zero.

- [ ] **Step 3: Write failing client tests**

Test three behaviors with `vi.stubGlobal('fetch', vi.fn())`: a valid envelope parses, an API error becomes `ApiError` with `requestId/code/retryable/fieldErrors`, and an invalid success payload becomes `INVALID_API_RESPONSE` without exposing raw response content.

- [ ] **Step 4: Verify RED and implement the minimal client**

```ts
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(new URL(path, API_BASE_URL), {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw ApiError.fromPayload(payload, response.status);
  return envelope(schema).parse(payload).data;
}
```

Use Zod-safe parsing to map invalid payloads to a client-safe error. `download` verifies `Content-Disposition`/content type but never constructs a server filesystem path.

- [ ] **Step 5: Verify GREEN**

Run `npm test -- apps/web/src/lib/api-client.test.ts` and `npm run typecheck`.

### Task 4: Add query policy, SSE state updates, providers, and routes

**Files:**
- Create: `apps/web/src/lib/query-client.ts`
- Create: `apps/web/src/lib/query-keys.ts`
- Test: `apps/web/src/lib/run-events.test.ts`
- Create: `apps/web/src/lib/run-events.ts`
- Create: `apps/web/src/app-router.tsx`
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: `createAppQueryClient()`, `queryKeys`, `subscribeToRunEvents()`, and all approved routes.

- [ ] **Step 1: Write the failing SSE lifecycle test**

Provide a fake EventSource and assert `subscribeToRunEvents(runId, queryClient)` opens `/runs/:id/events`, invalidates the affected run/candidate/artifact keys for named events, reconnects through EventSource semantics, and closes on cleanup. Assert malformed event JSON is ignored and reported through the supplied logger without mutating cache data.

- [ ] **Step 2: Verify RED and implement SSE ownership**

```ts
export function subscribeToRunEvents(runId: string, queryClient: QueryClient): () => void {
  const source = new EventSource(apiUrl(`/runs/${runId}/events`));
  source.addEventListener('run.status_changed', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) });
  });
  source.addEventListener('candidate.summary_ready', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.candidates(runId) });
  });
  source.addEventListener('artifact.created', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.artifacts(runId) });
  });
  return () => source.close();
}
```

Add the remaining documented event types with targeted invalidation; components never parse event meaning.

- [ ] **Step 3: Define query defaults**

Retry idempotent queries at most twice only when `ApiError.retryable` is true; do not retry validation, 404, or conflict errors. Keep previous paginated data during cursor changes and set a five-minute stale time for immutable completed-run detail.

- [ ] **Step 4: Define lazy application routes**

Create all routes from the approved spec, including `/`, `/projects/new`, project overview/settings, run overview/workflow/candidates/evidence/reports, system diagnostics/about, and a not-found route. Candidate `view` and `candidate` remain search parameters on `/runs/:runId/candidates`.

- [ ] **Step 5: Compose providers**

`main.tsx` renders `StrictMode -> QueryClientProvider -> BrowserRouter -> App -> Toaster`. `App` contains only the router and app-level error boundary.

- [ ] **Step 6: Run tests, typecheck, and build**

Expected: all pass; route chunks are emitted separately for graph/chart-heavy pages.

### Task 5: Build the responsive application shell

**Files:**
- Test: `apps/web/src/components/app-shell.test.tsx`
- Create: `apps/web/src/components/app-shell.tsx`
- Create: `apps/web/src/components/app-sidebar.tsx`
- Create: `apps/web/src/components/project-nav.tsx`
- Create: `apps/web/src/components/page-header.tsx`
- Create: `apps/web/src/components/page-state.tsx`
- Create: `apps/web/src/components/metric-summary.tsx`
- Create: `apps/web/src/components/hash-value.tsx`

**Interfaces:**
- Consumes: route matches and optional project/run context.
- Produces: consistent global/local navigation and reusable page-state framing.

- [ ] **Step 1: Write failing shell behavior tests**

Assert Dashboard/Projects and System/Diagnostics/About are always present; `Current Run` is absent; project links appear only with project context; the API indicator says `API Connected` or `API Unavailable`; and the mobile menu opens, focuses its first item, closes on navigation, and restores focus.

- [ ] **Step 2: Verify RED and implement the shell**

Use shadcn `Sidebar`, `Breadcrumb`, `Sheet`, `Button`, and `Separator`. Keep the compact title-to-card spacing from revision 2. Desktop uses a persistent evergreen rail; tablet uses the collapsed icon state; mobile uses a labelled drawer.

- [ ] **Step 3: Implement page states**

`PageState` is a discriminated union:

```ts
type PageStateProps =
  | { state: 'loading'; label: string }
  | { state: 'error'; title: string; message: string; onRetry: () => void }
  | { state: 'empty'; title: string; message: string; action?: ReactNode };
```

Use shadcn `Skeleton`, `Alert`, and `Empty`; error retry is a real button and loading regions have accessible labels.

- [ ] **Step 4: Verify GREEN at desktop and mobile widths**

Run the focused tests and confirm no horizontal page overflow at 1440px, 1024px, and 390px.

### Task 6: Implement Dashboard, project creation, and project overview

**Files:**
- Create: `apps/web/src/features/projects/projects-api.ts`
- Create: `apps/web/src/features/projects/projects-hooks.ts`
- Create: `apps/web/src/features/projects/project-view-models.ts`
- Test/Create: `apps/web/src/features/projects/dashboard-page.test.tsx`
- Create: `apps/web/src/features/projects/dashboard-page.tsx`
- Test/Create: `apps/web/src/features/projects/create-project-page.test.tsx`
- Create: `apps/web/src/features/projects/create-project-page.tsx`
- Test/Create: `apps/web/src/features/projects/project-page.test.tsx`
- Create: `apps/web/src/features/projects/project-page.tsx`
- Create: `apps/web/src/features/projects/project-table.tsx`

**Interfaces:**
- Produces: project queries/mutations and portfolio pages with no scientific calculations.

- [ ] **Step 1: Write Dashboard state tests**

Mock only `fetch`. Assert loading skeleton, retryable API error, empty create action, and data state. In data state assert **Research Projects**, exact server portfolio counts, **Healthy · 2 / 3**, `GraphBepi using fixture`, Quick Actions, source badges, project rows, and cursor navigation. Assert the page never labels the current page length as total projects.

- [ ] **Step 2: Verify RED and implement API hooks/adapters**

`projects-api.ts` calls the centralized client with shared schemas. `project-view-models.ts` formats dates and source labels only. `useProjects(cursor)` keeps previous data and exposes server totals unchanged.

- [ ] **Step 3: Implement Dashboard and verify GREEN**

Use open summary panels plus one primary project table; do not turn rows into a card grid. Quick Actions navigate to new project, FASTA form focus, latest project, and diagnostics.

- [ ] **Step 4: Write project-creation tests**

Assert required name/FASTA feedback, optional metadata, paste/upload behavior, no silent sequence mutation, server validation positions/context, mutation pending state, and successful navigation to the created project. Client checks are advisory; submission still uses `POST /projects`.

- [ ] **Step 5: Implement the accessible form and verify GREEN**

Use React Hook Form, Zod, `FieldGroup`, `Field`, `Input`, and `Textarea`. File input reads text only after explicit selection. Show validated header, length, copyable abbreviated SHA-256, profile, and warnings from the response.

- [ ] **Step 6: Write and implement project overview tests**

Cover loading/error, project/protein metadata, recent run rows, new-analysis action, and delete confirmation requiring both `DELETE` and exact project name. On success invalidate project lists and navigate home.

### Task 7: Implement project Settings and configuration approval

**Files:**
- Create: `apps/web/src/features/runs/runs-api.ts`
- Create: `apps/web/src/features/runs/runs-hooks.ts`
- Test/Create: `apps/web/src/features/settings/project-settings-page.test.tsx`
- Create: `apps/web/src/features/settings/project-settings-page.tsx`
- Create: `apps/web/src/features/settings/analysis-form.tsx`
- Create: `apps/web/src/features/settings/configuration-review.tsx`

**Interfaces:**
- Produces: draft-run creation and configuration approval using exact snapshot hashes.

- [ ] **Step 1: Write failing configuration tests**

Test MHC-I/MHC-II/B-cell sections, populations, fallback policy, immutable profiles/constraints, and output preferences. Assert GraphBepi's non-dismissible **Fixture only in MVP** label. Unsupported combinations display the API reason. The review shows the exact abbreviated hash and the button says **Approve and queue**, never Continue.

- [ ] **Step 2: Verify RED and implement the draft-run mutation**

Serialize only the documented `runCreate` contract. Keep unordered choice normalization server-owned. After `POST /projects/:projectId/runs`, show the returned normalized summary and configuration hash.

- [ ] **Step 3: Implement configuration approval**

Post `{ decision: 'APPROVE', expectedConfigurationHash, note }`, invalidate project/run queries, and route to the run. For `CONFIGURATION_CHANGED`, refetch and return focus to the changed review summary.

- [ ] **Step 4: Verify GREEN and keyboard completion**

Complete the full form, review, and approval using keyboard only; fieldsets have legends and invalid controls use `aria-invalid`.

### Task 8: Implement Run View and Workflow Visualization

**Files:**
- Test/Create: `apps/web/src/features/runs/run-page.test.tsx`
- Create: `apps/web/src/features/runs/run-page.tsx`
- Create: `apps/web/src/features/runs/connector-matrix.tsx`
- Test/Create: `apps/web/src/features/workflow/workflow-page.test.tsx`
- Create: `apps/web/src/features/workflow/workflow-page.tsx`
- Create: `apps/web/src/features/workflow/workflow-graph.tsx`
- Create: `apps/web/src/features/workflow/workflow-list.tsx`

**Interfaces:**
- Consumes: run detail, workflow graph, run events.
- Produces: overview/graph/list actions without interpreting workflow semantics.

- [ ] **Step 1: Write Run View tests**

Cover status/quality, elapsed time, counts, approval requirements, source matrix, persistent fixture banner, partial evidence, start/cancel actions, and polite live announcements only for meaningful status changes.

- [ ] **Step 2: Implement Run View and verify GREEN**

Render API values through display adapters. Connector rows contain connector, method, status, version, duration, and note. Start/cancel mutations use documented endpoints and invalidate only the run/workflow keys.

- [ ] **Step 3: Write Workflow tests**

Assert React Flow receives API nodes/edges unchanged; the list exposes identical stage/state/attempt/progress/duration/source/error data; retry exists only for API-marked retryable failed stages; cancel warns completed evidence is retained; mobile defaults to list mode.

- [ ] **Step 4: Implement Workflow and verify GREEN**

Lazy-load React Flow. Node selection opens a titled shadcn `Sheet` with event history. Retry sends `expectedAttempt`. Provide fit-view and graph/list URL state. Do not generate edges or relayout scientific stages.

### Task 9: Implement Candidate Rankings and Candidate Detail

**Files:**
- Create: `apps/web/src/features/candidates/candidates-api.ts`
- Create: `apps/web/src/features/candidates/candidates-hooks.ts`
- Create: `apps/web/src/features/candidates/candidate-view-models.ts`
- Test/Create: `apps/web/src/features/candidates/candidates-page.test.tsx`
- Create: `apps/web/src/features/candidates/candidates-page.tsx`
- Create: `apps/web/src/features/candidates/candidate-table.tsx`
- Test/Create: `apps/web/src/features/candidates/candidate-detail.test.tsx`
- Create: `apps/web/src/features/candidates/candidate-detail.tsx`

**Interfaces:**
- Produces: URL-backed server filters/pagination and structured candidate review.

- [ ] **Step 1: Write ranking workspace tests**

Assert separate MHC-I/MHC-II/B-cell tabs, required columns, `search`/`hasWarnings`/category/allele/source/score filters, cursor pagination, source mix, and rejected-row disabled selection. Assert switching tracks resets incompatible allele/cursor state but preserves the route.

- [ ] **Step 2: Verify RED and implement URL/query ownership**

Parse search parameters with Zod, canonicalize them, and pass them directly to the candidate endpoint. Debounce only the transport request for search; the input remains responsive. Never client-filter a server page.

- [ ] **Step 3: Implement the table and verify GREEN**

Use shadcn `Table`, labelled horizontal scrolling, a caption, row/column headers, and 12px-or-larger text. Missing numeric evidence renders **Unavailable — reason**, not `0`.

- [ ] **Step 4: Write candidate-detail tests**

Assert all nine required sections, raw/normalized separation, effective weights/penalties, coverage provenance, every rule, graph neighbors, deterministic explanation, LLM generation label, and structured-number highlighting. Desktop uses a titled sheet; mobile uses the full content route state.

- [ ] **Step 5: Implement detail and verify GREEN**

Open from `candidate=<id>`; closing removes only that parameter and restores row focus. Never request LLM mode automatically.

### Task 10: Implement Sequence Map, Population Coverage, and Shortlist Approval

**Files:**
- Test/Create: `apps/web/src/features/candidates/sequence-map.test.tsx`
- Create: `apps/web/src/features/candidates/sequence-map.tsx`
- Test/Create: `apps/web/src/features/candidates/coverage-view.test.tsx`
- Create: `apps/web/src/features/candidates/coverage-view.tsx`
- Test/Create: `apps/web/src/features/candidates/shortlist-approval.test.tsx`
- Create: `apps/web/src/features/candidates/shortlist-approval.tsx`

**Interfaces:**
- Consumes: versioned visualization/coverage/optimization responses.
- Produces: candidate workspace subviews at `view=sequence|coverage|shortlist`.

- [ ] **Step 1: Write Sequence Map tests**

Assert separate API tracks, positional segments, vertically stacked overlaps, coordinate navigation, candidate opening, the textual list, and an explicit state when the API returns more than 500 unaggregated segments.

- [ ] **Step 2: Implement bounded SVG rendering and verify GREEN**

Use one responsive semantic SVG with a documented coordinate transform from `[1, proteinLength]` to the viewBox. This is display geometry only. Each segment has a keyboard-focusable control and accessible label; the list is the primary mobile surface.

- [ ] **Step 3: Write Population Coverage tests**

Assert the title **Estimated population coverage**, direct value labels, source/method/timestamp, live/cached/fixture status, adjacent table, and unavailable states with no zero bars.

- [ ] **Step 4: Implement one Recharts horizontal bar chart and verify GREEN**

Memoize the API view model, render essential values without hover, keep source/caveats adjacent, and use the table as the mobile/accessibility fallback.

- [ ] **Step 5: Write and implement Shortlist Approval tests**

Test selected groups by track, rejected attempts, run quality/source/warnings/disclaimer, required computational-only checkbox, optional note, ranking hash, empty-shortlist rule, explicit **Approve shortlist**, and `RANKING_CHANGED` recovery back to refreshed rankings.

### Task 11: Implement Evidence Explorer

**Files:**
- Create: `apps/web/src/features/evidence/evidence-api.ts`
- Test/Create: `apps/web/src/features/evidence/evidence-page.test.tsx`
- Create: `apps/web/src/features/evidence/evidence-page.tsx`
- Create: `apps/web/src/features/evidence/evidence-graph.tsx`
- Create: `apps/web/src/features/evidence/relationship-table.tsx`

**Interfaces:**
- Consumes: validated React Flow-compatible evidence nodes/edges.
- Produces: graph and equivalent relation table with URL-backed filters.

- [ ] **Step 1: Write evidence tests**

Assert node-type/candidate/depth 1–4 filters, fit view, graph/table switch, unchanged nodes/edges, partial warnings, and table-default mobile behavior. Verify invalid depth is normalized to `2` before requesting.

- [ ] **Step 2: Verify RED and implement graph/table views**

Use one lazy React Flow instance and the server's node positions. The table has columns relation, source, target, provenance, and details. Graph selection and filter state live in the URL.

- [ ] **Step 3: Verify GREEN and keyboard equivalence**

Every graph relation must be discoverable and actionable through the table without pointer input.

### Task 12: Implement Reports and artifact downloads

**Files:**
- Create: `apps/web/src/features/reports/reports-api.ts`
- Test/Create: `apps/web/src/features/reports/reports-page.test.tsx`
- Create: `apps/web/src/features/reports/reports-page.tsx`
- Create: `apps/web/src/features/reports/artifact-list.tsx`

**Interfaces:**
- Produces: report job creation and safe browser downloads.

- [ ] **Step 1: Write report tests**

Assert generation is disabled until API approval; JSON/CSV/evidence graph/workflow trace artifacts show size/time/hash/download; provenance, quality, and disclaimer remain visible; job pending/error/success states work; and downloaded filenames come from safe response headers.

- [ ] **Step 2: Verify RED and implement report mutations**

Send the approved snapshot output preferences, including `includeEvidenceGraph`. Invalidate artifact queries when the job starts and when SSE reports artifact creation. Create/revoke an object URL only for the downloaded blob.

- [ ] **Step 3: Verify GREEN**

Test report-disabled, report-job, empty-artifact, and populated-artifact states.

### Task 13: Implement System Diagnostics and About

**Files:**
- Create: `apps/web/src/features/settings/settings-api.ts`
- Test/Create: `apps/web/src/features/settings/diagnostics-page.test.tsx`
- Create: `apps/web/src/features/settings/diagnostics-page.tsx`
- Create: `apps/web/src/features/settings/about-page.tsx`

**Interfaces:**
- Consumes: connectors, health, profiles, and safe runtime endpoints.
- Produces: read-only operational views separate from project settings.

- [ ] **Step 1: Write diagnostics tests**

Assert connector descriptors/health, runtime health, fixture manifest, loaded profile versions/approval, database/artifact status, LLM state, app/spec/build information, stale timestamp, and partial endpoint failures. Assert there are no edit controls or displayed secret/path fields.

- [ ] **Step 2: Implement parallel diagnostics queries**

Start connectors, health, profiles, and runtime queries together. Preserve successful panels when one fails and label the page **Partial diagnostics**. The GraphBepi row says fixture-only without implying live availability.

- [ ] **Step 3: Implement About and verify GREEN**

Show application/spec versions, computational-only boundary, and links to local About/help content supplied by the API/build contract. No project configuration controls appear.

### Task 14: Complete cross-page accessibility, resilience, and performance checks

**Files:**
- Test: `apps/web/src/app.integration.test.tsx`
- Modify: feature/component files only where tests expose defects

- [ ] **Step 1: Add full-route state coverage**

For every route, exercise loading, error, empty, and data. Exercise partial evidence for run/candidates/evidence/coverage/reports. Assert API unavailable is never replaced by scientific mock results.

- [ ] **Step 2: Add keyboard/focus regression coverage**

Test global/mobile navigation, tabs, filters, dialogs, sheets, delete confirmation, configuration approval, candidate detail restoration, shortlist acknowledgement, and artifact actions.

- [ ] **Step 3: Add performance assertions**

Verify graph/chart routes are lazy chunks, URL search changes do not remount the app shell, long lists use server pagination, and no view renders more than the bounded graph/sequence payload.

- [ ] **Step 4: Run the frontend gate**

```powershell
npm test -- apps/web
npm run lint
npm run typecheck
npm run build
```

Expected: all pass with no warnings or console errors.

### Task 15: Browser verification and concept fidelity

**Files:**
- Create: `docs/superpowers/specs/assets/research-console-v2.png`
- Create: `docs/superpowers/verification/2026-07-24-frontend-fidelity.md`
- Modify: `TASKS.md`

- [ ] **Step 1: Preserve the accepted concept as an image**

Open `.superpowers/brainstorm/224-1784883013/content/research-console-visual-system-v2.html` in the built-in browser at its native concept viewport and capture `docs/superpowers/specs/assets/research-console-v2.png`.

- [ ] **Step 2: Run the application and exercise the core path**

Use Browser/IAB first: Dashboard → create/open project → settings/config approval → run/workflow → candidates/detail → evidence → shortlist → reports → diagnostics. Use transport-level test responses only in the verification environment; production code remains API-only.

- [ ] **Step 3: Verify desktop, tablet, and mobile**

Capture the Dashboard at the concept's native dimensions plus 1024px and 390px widths. Check all route layouts, graph alternatives, table overflow, focus visibility, reduced motion, error states, and zero console errors.

- [ ] **Step 4: Perform the mandatory image comparison**

Use `view_image` on both `research-console-v2.png` and the latest Dashboard screenshot in the same QA pass. Record at least these comparison points in the fidelity ledger: visible copy/navigation, first-viewport layout, typography, palette, sidebar/icon treatment, summary density, table anatomy, spacing/container model, mobile collapse, and status/provenance treatment.

- [ ] **Step 5: Fix every material mismatch and repeat verification**

Do not hand off with clipped content, altered palette, generic card-grid drift, missing icons, added copy, mobile overflow, inert controls, or console errors.

- [ ] **Step 6: Update the implementation checklist**

Mark only Phase 7 items whose implementation, tests, accessibility, responsive, browser, and fidelity checks passed.

### Task 16: Run the repository-wide completion gate

- [ ] **Step 1: Run every repository gate from the root**

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits `0`; the browser console remains clean; no production scientific fixture or mock fallback exists in `apps/web`.

- [ ] **Step 2: Scan forbidden frontend behavior**

```powershell
rg -n "Math\.random|mock.*candidate|fixture.*fallback|calculate.*score|derive.*edge|vaccine efficacy|Current Run" apps/web/src
```

Expected: no scientific calculation/mock/edge-derivation behavior, no prohibited efficacy claim, and no global Current Run navigation.
