# Frontend API Contract Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing REST contract just enough to support the approved frontend without adding endpoints, scientific logic, or database tables.

**Architecture:** Keep Fastify routes as thin Zod-validated gateway adapters. Add request fields to existing schemas, document exact response payloads supplied by the shared service layer, and prove delegation with integration tests. Persist output preferences inside the existing immutable run configuration JSON snapshot.

**Tech Stack:** Fastify 5, TypeScript 5.9, Zod 3, Vitest 4, npm workspaces.

## Global Constraints

- Preserve the `/api/v1` base path and `{ requestId, data }` response envelope.
- Add no new REST endpoint, Prisma model, migration, scientific calculation, or route-level business logic.
- `GET /projects` remains cursor-paginated; portfolio totals are server-computed and never inferred from a page.
- `search` is a trimmed, case-insensitive service-layer match over candidate ID or peptide text.
- `hasWarnings` accepts only the query strings `true` or `false`.
- Output preferences become immutable with configuration approval and are stored in the existing run configuration JSON snapshot.
- Runtime diagnostics never expose environment secrets, filesystem paths, full fixture payloads, or FASTA sequences.
- All production behavior follows test-first red-green-refactor cycles.
- The workspace is not currently a Git repository. Do not initialize Git without user authorization; use passing-test checkpoints in place of commit steps.

---

## File Structure

- Modify `API_SPEC.md`: authoritative REST request and response contracts.
- Modify `DOMAIN_MODEL.md`: add the output-preference value object to `RunConfiguration`.
- Modify `UI_UX_SPEC.md`: align navigation/settings and identify the server-backed dashboard/filter fields.
- Modify `DECISIONS.md`: record contextual project navigation and the minimal contract extension.
- Modify `SPEC_VERSION.md`: increment the draft specification to `0.6.0-draft` and add the changelog entry.
- Modify `apps/api/src/contracts.ts`: validate candidate filters and output-preference request fields.
- Modify `apps/api/src/api.integration.test.ts`: prove accepted fields, rejected malformed values, and unchanged delegation.
- Modify `TASKS.md`: mark only completed contract-extension items.

### Task 1: Freeze the extended documentation contract

**Files:**
- Modify: `API_SPEC.md`
- Modify: `DOMAIN_MODEL.md`
- Modify: `UI_UX_SPEC.md`
- Modify: `DECISIONS.md`
- Modify: `SPEC_VERSION.md`

**Interfaces:**
- Consumes: approved frontend design in `docs/superpowers/specs/2026-07-24-immunograph-frontend-design.md`.
- Produces: exact DTO names and fields used by all later tests and frontend Zod schemas.

- [ ] **Step 1: Update `GET /projects` in `API_SPEC.md` with the exact response data**

```json
{
  "items": [],
  "nextCursor": null,
  "portfolioSummary": {
    "projectCount": 3,
    "runCounts": {
      "total": 8,
      "running": 1,
      "completed": 6,
      "failed": 1
    },
    "candidateCount": 412,
    "reportCount": 5,
    "recentSince": "2026-06-24T00:00:00.000Z",
    "recentRunCount": 4,
    "asOf": "2026-07-24T12:00:00.000Z"
  }
}
```

Document that all counts cover the whole workspace, not the current page, and that the service chooses the recent window but returns `recentSince` so the UI can label it accurately.

- [ ] **Step 2: Extend the documented candidate-list query**

```text
search=<trimmed candidate UUID or peptide substring, maximum 200 characters>
hasWarnings=true|false
```

Document case-insensitive matching and service-layer filtering before cursor pagination.

- [ ] **Step 3: Add immutable output preferences to run creation and report creation**

```json
{
  "outputPreferences": {
    "formats": ["JSON", "CSV"],
    "templateVersion": "research-report-v1",
    "includeWorkflowTrace": true,
    "includeEvidenceGraph": true
  }
}
```

Add `includeEvidenceGraph` to `POST /runs/:runId/reports`. State that report requests must match the approved run snapshot unless a future API version documents overrides.

- [ ] **Step 4: Define the safe runtime diagnostics payload**

```json
{
  "demoMode": true,
  "llmEnabled": false,
  "databaseStatus": "AVAILABLE",
  "artifactPathStatus": "AVAILABLE",
  "fixtureManifest": {
    "version": "mvp-v1.0",
    "sha256": "64-lowercase-hex",
    "entries": [
      {
        "fixtureId": "dengue-envelope",
        "organism": "Dengue virus",
        "proteinName": "Envelope protein",
        "approved": true,
        "sha256": "64-lowercase-hex"
      }
    ]
  },
  "build": {
    "applicationVersion": "0.1.0",
    "specificationVersion": "0.6.0-draft",
    "commitSha": null,
    "builtAt": null
  }
}
```

Use `AVAILABLE | DEGRADED | UNAVAILABLE` for the two health fields. Explicitly prohibit paths, secrets, and fixture contents.

- [ ] **Step 5: Align dependent specifications**

Add this type to `DOMAIN_MODEL.md` and reference it from `RunConfiguration`:

```ts
type OutputPreferences = {
  formats: Array<'JSON' | 'CSV'>;
  templateVersion: string;
  includeWorkflowTrace: boolean;
  includeEvidenceGraph: boolean;
};
```

Update `UI_UX_SPEC.md` to the approved Dashboard/Project/System navigation and settings separation. Add ADR-021 to `DECISIONS.md`. Change `SPEC_VERSION.md` to `0.6.0-draft` and record these backward-incompatible draft API additions.

- [ ] **Step 6: Check documentation consistency**

Run:

```powershell
rg -n "Current Run|0\.5\.0-draft|hasWarnings|outputPreferences|portfolioSummary|fixtureManifest" API_SPEC.md DOMAIN_MODEL.md UI_UX_SPEC.md DECISIONS.md SPEC_VERSION.md
```

Expected: no active global `Current Run` requirement; every new term is defined once in its authoritative document and referenced consistently.

### Task 2: Validate candidate search and warning filters

**Files:**
- Modify: `apps/api/src/api.integration.test.ts`
- Modify: `apps/api/src/contracts.ts`

**Interfaces:**
- Consumes: `candidateListQuery`.
- Produces: parsed `search?: string` and `hasWarnings?: boolean` fields passed to `candidates.list`.

- [ ] **Step 1: Write failing integration assertions**

Add a request to the endpoint-registration test:

```ts
{
  method: 'GET',
  url: `/api/v1/runs/${runId}/candidates?track=MHCI&search=LLFGYPVYV&hasWarnings=false&sort=rank&limit=50`,
  status: 200,
}
```

After the request loop, assert the delegated input contains:

```ts
expect(gateway.execute).toHaveBeenCalledWith(
  'candidates.list',
  expect.objectContaining({ search: 'LLFGYPVYV', hasWarnings: false }),
  expect.objectContaining({ requestId: expect.any(String) }),
);
```

Add a separate test proving `hasWarnings=not-a-boolean` and a 201-character `search` both return `400 VALIDATION_ERROR` without calling the gateway.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- apps/api/src/api.integration.test.ts
```

Expected: FAIL because strict `candidateListQuery` rejects the new fields.

- [ ] **Step 3: Implement the minimal Zod fields**

Add to `apps/api/src/contracts.ts`:

```ts
const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');
```

Add to `candidateListQuery`:

```ts
search: z.string().trim().min(1).max(200).optional(),
hasWarnings: queryBoolean.optional(),
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command. Expected: all API integration tests pass.

### Task 3: Validate immutable output preferences

**Files:**
- Modify: `apps/api/src/api.integration.test.ts`
- Modify: `apps/api/src/contracts.ts`

**Interfaces:**
- Produces: `outputPreferences` on `runs.create` and `includeEvidenceGraph` on `reports.create`.

- [ ] **Step 1: Add output preferences to the test request fixtures**

```ts
const outputPreferences = {
  formats: ['JSON', 'CSV'] as const,
  templateVersion: 'research-report-v1',
  includeWorkflowTrace: true,
  includeEvidenceGraph: true,
};
```

Spread it into `runBody` as `outputPreferences` and add `includeEvidenceGraph: true` to the report request. Add a rejection test for duplicate formats, an empty format list, and an unknown format.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- apps/api/src/api.integration.test.ts
```

Expected: FAIL because `runCreate` is strict and `reportBody` does not accept `includeEvidenceGraph`.

- [ ] **Step 3: Add the shared request schema and refinements**

```ts
const reportFormat = z.enum(['JSON', 'CSV']);

export const outputPreferences = z
  .object({
    formats: z.array(reportFormat).min(1),
    templateVersion: z.string().trim().min(1).max(100),
    includeWorkflowTrace: z.boolean(),
    includeEvidenceGraph: z.boolean(),
  })
  .strict()
  .refine((value) => new Set(value.formats).size === value.formats.length, {
    path: ['formats'],
    message: 'formats must be unique',
  });
```

Add `outputPreferences` to `runCreate`. Reuse `reportFormat` in `reportBody` and require `includeEvidenceGraph` there.

- [ ] **Step 4: Run the focused test and verify GREEN**

Expected: the valid fields reach the gateway and malformed preferences return `400 VALIDATION_ERROR`.

### Task 4: Prove the new response payloads pass through unchanged

**Files:**
- Modify: `apps/api/src/api.integration.test.ts`

**Interfaces:**
- Consumes: service-layer payloads for `projects.list` and `settings.runtime`.
- Produces: unchanged payloads inside the API `{ requestId, data }` envelope.

- [ ] **Step 1: Write response contract tests**

Create a gateway whose `execute` returns operation-specific payloads:

```ts
const portfolioSummary = {
  projectCount: 3,
  runCounts: { total: 8, running: 1, completed: 6, failed: 1 },
  candidateCount: 412,
  reportCount: 5,
  recentSince: '2026-06-24T00:00:00.000Z',
  recentRunCount: 4,
  asOf: '2026-07-24T12:00:00.000Z',
};

const runtime = {
  demoMode: true,
  llmEnabled: false,
  databaseStatus: 'AVAILABLE',
  artifactPathStatus: 'AVAILABLE',
  fixtureManifest: { version: 'mvp-v1.0', sha256: hash, entries: [] },
  build: {
    applicationVersion: '0.1.0',
    specificationVersion: '0.6.0-draft',
    commitSha: null,
    builtAt: null,
  },
};
```

Assert `GET /projects` returns `{ requestId, data: { items: [], nextCursor: null, portfolioSummary } }` and `GET /settings/runtime` returns `{ requestId, data: runtime }` exactly.

- [ ] **Step 2: Run the focused test**

Expected: PASS without route changes, proving routes preserve the service-owned values and add only `requestId`.

### Task 5: Close the contract-extension checkpoint

**Files:**
- Modify: `TASKS.md`

- [ ] **Step 1: Mark the narrow completed items**

Add checked Phase 5 items for portfolio summaries, candidate search/warning query validation, output-preference snapshots, and safe fixture/build diagnostics. Do not mark service implementations or UI work complete.

- [ ] **Step 2: Run all quality gates**

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits `0`; no new warning or error is emitted.
