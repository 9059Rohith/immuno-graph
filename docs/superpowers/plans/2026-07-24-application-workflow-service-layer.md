# Application and Workflow Service Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the API-wide unavailable gateway with database-backed application services that orchestrate existing repositories and deterministic algorithms while isolating absent workflow, report, and connector capabilities behind explicit ports.

**Architecture:** `ConcreteRestApiServices` dispatches the existing operation names to focused Project, Run, Candidate, Evidence, Report, Diagnostics, and Event services. Commands use a transaction-bound repository factory; pure DTO mappers validate all completed response objects with the existing shared Zod schemas. Workflow execution and report generation remain injected capability ports, so only an invocation that genuinely needs an absent capability returns `503`.

**Tech Stack:** Node.js 20, TypeScript 5.9, Fastify 5, Zod 3, Prisma 6, SQLite, Vitest 4, existing `@immunograph/algorithms`, `@immunograph/database`, and `@immunograph/shared` workspaces.

## Global Constraints

- Treat `docs/superpowers/specs/2026-07-24-application-workflow-service-layer-design.md` as frozen.
- Do not change endpoint paths, route request schemas, shared response schemas, frontend behavior, Prisma models, migrations, deterministic scientific algorithms, or MCP tool contracts.
- Fastify routes remain transport-only. They validate, coordinate HTTP idempotency, select status codes, and serialize envelopes.
- `RunService` is the only owner of run lifecycle transitions.
- `EventService` owns event persistence, replay, notification, and SSE iteration; it never starts, cancels, or retries workflow execution.
- DTO mappers are pure, have no repository/filesystem/network access, and never calculate a scientific result or relationship.
- All profile definitions remain immutable files under `data/profiles`; only name, version, and SHA-256 metadata enter `WorkflowRun.configurationJson`.
- The only approved profile version is `mvp-v1.0`. A request for `demo-v1` fails with `422 PROFILE_NOT_FOUND`; no alias is introduced.
- The missing workflow engine, API-to-MCP transport, live connectors, curated fixture payloads, and artifact generator are not fabricated.
- Default workflow/report ports fail before their commands mutate lifecycle state. Default connector diagnostics returns an empty set.
- Every write spanning more than one record uses `PrismaClient.$transaction` with repositories bound to the transaction client.
- Full FASTA sequences, filesystem paths, secrets, and raw provider payloads never appear in API responses or logs.
- Follow TDD for every task: establish RED, implement the minimum behavior, establish GREEN, then refactor.
- The workspace is not a Git repository. Do not initialize Git; each task ends with a passing-test checkpoint instead of a commit.

---

## Locked file structure

### Database integration

- Create `packages/database/src/repository-client.ts`: the Prisma client subset accepted by repositories, including transaction clients.
- Create `packages/database/src/transaction.ts`: `PrismaTransactionManager` and transaction-bound `Repositories` creation.
- Create `packages/database/src/read-models.ts`: query inputs and typed Prisma read models returned to the API application layer.
- Modify `packages/database/src/repositories.ts`: add the approved list/count/detail/transition/event/candidate/graph/artifact/approval operations.
- Modify `packages/database/src/profile-loader.ts`: version-selecting immutable profile loading with path-safe filenames.
- Modify `packages/database/src/index.ts`: export the new integration contracts.
- Modify `packages/database/src/repositories.test.ts` and `packages/database/src/profile-loader.test.ts`: repository and profile integration coverage.
- Modify `packages/database/src/seed.ts`: deterministic UUID seed identifiers.

### API application foundation

- Create `apps/api/src/application/errors.ts`: typed application/dependency errors and Prisma translation.
- Create `apps/api/src/application/json.ts`: focused JSON-column parsing schemas and canonical configuration normalization.
- Create `apps/api/src/application/cursor.ts`: opaque base64url cursors for project, candidate, and event pages.
- Create `apps/api/src/application/ports.ts`: workflow, report, connector diagnostics, and optional explanation capability contracts.
- Create `apps/api/src/application/event-notifier.ts`: in-process post-commit wakeups only.
- Create `apps/api/src/application/artifact-store.ts`: contained artifact verification, streaming, and project-file removal.
- Create `apps/api/src/application/response-schemas.ts`: strict internal schemas only for documented responses that currently have no shared schema (event history, shortlist optimization, explanation, and three unused visualization variants).
- Create `apps/api/src/application/test-context.test-support.ts`: migrated temporary SQLite test context and fixed clock helpers.

### Pure DTO mappers

- Create `apps/api/src/application/mappers/project-mapper.ts`.
- Create `apps/api/src/application/mappers/run-mapper.ts`.
- Create `apps/api/src/application/mappers/candidate-mapper.ts`.
- Create `apps/api/src/application/mappers/graph-mapper.ts`.
- Create `apps/api/src/application/mappers/report-mapper.ts`.
- Create `apps/api/src/application/mappers/settings-mapper.ts`.
- Create `apps/api/src/application/mappers/event-mapper.ts`.
- Add one focused `*.test.ts` beside each mapper.

### Focused application services and composition

- Create `apps/api/src/application/services/project-service.ts`.
- Create `apps/api/src/application/services/run-service.ts`.
- Create `apps/api/src/application/services/candidate-service.ts`.
- Create `apps/api/src/application/services/evidence-service.ts`.
- Create `apps/api/src/application/services/report-service.ts`.
- Create `apps/api/src/application/services/diagnostics-service.ts`.
- Create `apps/api/src/application/services/event-service.ts`.
- Add one focused `*.test.ts` beside each service.
- Create `apps/api/src/application/concrete-rest-api-services.ts`: exhaustive operation dispatch.
- Create `apps/api/src/application/create-services.ts`: production dependency composition.
- Create `apps/api/src/bootstrap.ts`: initialized database/application lifecycle.
- Modify `apps/api/src/services.ts`, `apps/api/src/application.ts`, `apps/api/src/routes.ts`, `apps/api/src/config/environment.ts`, and `apps/api/src/index.ts`: remove the unavailable production gateway and propagate SSE disconnects.
- Modify `apps/api/package.json`, `apps/api/tsconfig.json`, `package-lock.json`, and `.env.example`: algorithms dependency, project reference, and validated local paths/build metadata.
- Create `apps/api/src/application/application-services.integration.test.ts`: real-service end-to-end API coverage.
- Modify `docs/TASKS.md`: record only the integration work verified by the final quality gates.

---

### Task 1: Make repositories transaction-bindable and version profiles explicitly

**Files:**
- Create: `packages/database/src/repository-client.ts`
- Create: `packages/database/src/transaction.ts`
- Modify: `packages/database/src/repositories.ts`
- Modify: `packages/database/src/profile-loader.ts`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/database/src/profile-loader.test.ts`
- Modify: `packages/database/src/repositories.test.ts`

**Interfaces:**
- Produces: `RepositoryClient`, `TransactionManager`, `PrismaTransactionManager`, `loadProfileVersion(key, version, directory?)`, and `createRepositories(client)` accepting a root or transaction client.
- Preserves: every existing repository constructor, validation call, and append-only restriction.

- [ ] **Step 1: Write failing tests for transaction rollback and explicit profile selection**

Add these behaviors to the existing database tests:

```ts
it('rolls back all repositories bound to a failed transaction', async () => {
  const manager = new PrismaTransactionManager(prisma);
  const countBefore = await prisma.project.count();
  await expect(
    manager.run(async (tx) => {
      await tx.projects.create({ name: 'Rolled back' });
      throw new Error('force rollback');
    }),
  ).rejects.toThrow('force rollback');
  await expect(prisma.project.count()).resolves.toBe(countBefore);
});

it('loads only the requested immutable profile version', async () => {
  const loaded = await loadProfileVersion('ranking', 'mvp-v1.0');
  expect(loaded.metadata).toMatchObject({ name: 'ranking', version: 'mvp-v1.0' });
  await expect(loadProfileVersion('ranking', 'demo-v1')).rejects.toMatchObject({
    code: 'ENOENT',
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npx vitest run packages/database/src/profile-loader.test.ts packages/database/src/repositories.test.ts
```

Expected: failure because `PrismaTransactionManager`, `countAll`, and `loadProfileVersion` do not exist.

- [ ] **Step 3: Add the transaction-safe repository client and manager**

Use this public contract:

```ts
import type { Prisma, PrismaClient } from '@prisma/client';

export type RepositoryClient = PrismaClient | Prisma.TransactionClient;
```

```ts
import type { PrismaClient } from '@prisma/client';

import { createRepositories, type Repositories } from './repositories.js';

export interface TransactionManager {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly client: PrismaClient) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return this.client.$transaction((transaction) => work(createRepositories(transaction)));
  }
}
```

Change every repository constructor from `PrismaClient` to `RepositoryClient`. Do not add update/delete methods to append-only evidence repositories.

- [ ] **Step 4: Add a version-explicit, path-safe profile loader**

Define descriptors by basename and resolve only the validated version:

```ts
const profileVersionSchema = z.string().regex(/^[a-z0-9][a-z0-9.-]{0,99}$/i);

export async function loadProfileVersion(
  key: ProfileKey,
  version: string,
  directory = DEFAULT_PROFILE_DIRECTORY,
): Promise<LoadedProfile<unknown>> {
  const safeVersion = profileVersionSchema.parse(version);
  const descriptor = profileDefinitions[key];
  const contents = await readFile(join(directory, `${descriptor.baseName}.${safeVersion}.json`));
  const definition = descriptor.schema.parse(JSON.parse(contents.toString('utf8')));
  return {
    definition,
    metadata: profileMetadataSchema.parse({
      name: definition.name,
      version: definition.version,
      hash: computeProfileHash(definition),
    }),
  };
}
```

Keep `loadProfile(key, directory)` as a compatibility wrapper that calls `loadProfileVersion(key, 'mvp-v1.0', directory)`.

- [ ] **Step 5: Run database tests and typecheck**

Run:

```powershell
npx vitest run packages/database/src/profile-loader.test.ts packages/database/src/repositories.test.ts
npm run typecheck --workspace @immunograph/database
```

Expected: both commands pass. Record this as checkpoint 1.

---

### Task 2: Extend repositories with the exact application read/write operations

**Files:**
- Create: `packages/database/src/read-models.ts`
- Modify: `packages/database/src/repositories.ts`
- Modify: `packages/database/src/repositories.test.ts`
- Modify: `packages/database/src/index.ts`

**Interfaces:**
- Consumes: `RepositoryClient` from Task 1.
- Produces: stable query inputs/read models and repository methods used by every application service.

The public query contracts are:

```ts
export interface OrderedCursor {
  updatedAt: Date;
  id: string;
}

export interface CandidateQuery {
  runId: string;
  rankingSnapshotHash: string;
  track?: 'MHCI' | 'MHCII' | 'BCELL';
  category?: 'RECOMMENDED' | 'REVIEW' | 'REJECTED';
  sourceStatus?: 'LIVE' | 'CACHED' | 'FIXTURE' | 'FAILED';
  allele?: string;
  minScore?: number;
  maxScore?: number;
  search?: string;
  hasWarnings?: boolean;
  sort: 'rank' | 'score' | 'start';
  limit: number;
  after?: { rank: number; finalScore: number; start: number; id: string };
}

export interface EventPageQuery {
  runId: string;
  afterSequence: number;
  limit: number;
}
```

- [ ] **Step 1: Write failing repository integration tests**

Cover these exact behaviors with real SQLite records:

```ts
it('orders project pages by updatedAt then id and counts the full workspace', async () => {
  const page = await repositories.projects.listPage({ limit: 1 });
  expect(page.items).toHaveLength(1);
  expect(page.nextCursor).not.toBeNull();
  await expect(repositories.projects.countAll()).resolves.toBeGreaterThanOrEqual(2);
});

it('allocates event sequence numbers and replays strictly after a cursor', async () => {
  const first = await repositories.events.appendNext({
    runId,
    eventType: 'run.status_changed',
    level: 'INFO',
    message: 'Queued',
    payloadJson: '{"status":"QUEUED"}',
  });
  const second = await repositories.events.appendNext({
    runId,
    eventType: 'run.status_changed',
    level: 'INFO',
    message: 'Running',
    payloadJson: '{"status":"RUNNING"}',
  });
  expect([first.sequenceNumber, second.sequenceNumber]).toEqual([1, 2]);
  await expect(
    repositories.events.listPage({ runId, afterSequence: 1, limit: 10 }),
  ).resolves.toMatchObject({ items: [{ sequenceNumber: 2 }], nextSequence: null });
});
```

Add cases for latest protein lookup, next run revision, run-detail aggregation, latest stage attempt, candidate filters/search/warnings, candidate comparison membership, coverage lookup, shortlist steps, graph neighborhood depth, artifact counts/lookups, approval lookup, and controlled project-tree deletion.

- [ ] **Step 2: Run the repository suite and verify RED**

Run:

```powershell
npx vitest run packages/database/src/repositories.test.ts
```

Expected: failures name the missing query methods.

- [ ] **Step 3: Add project/run/event operations**

Extend interfaces with these exact signatures:

```ts
interface IProjectRepository {
  listPage(input: { limit: number; after?: OrderedCursor }): Promise<ProjectPageRecord>;
  countAll(): Promise<number>;
  deleteTree(projectId: string): Promise<void>;
}

interface IProteinInputRepository {
  findCurrentByProject(projectId: string): Promise<ProteinInput | null>;
}

interface IWorkflowRunRepository {
  findDetailById(id: string): Promise<RunDetailRecord | null>;
  nextRevision(projectId: string): Promise<number>;
  transitionControl(
    id: string,
    expectedStatuses: readonly string[],
    input: WorkflowRunControlUpdate,
  ): Promise<WorkflowRun | null>;
  countByStatus(): Promise<Record<string, number>>;
  countCreatedSince(since: Date): Promise<number>;
}

interface IWorkflowEventRepository {
  appendNext(input: Omit<WorkflowEventCreate, 'sequenceNumber'>): Promise<WorkflowEvent>;
  listPage(input: EventPageQuery): Promise<EventPageRecord>;
}
```

`appendNext` executes `aggregate({ _max: { sequenceNumber: true } })` and `create` on the same transaction-bound client. `deleteTree` deletes dependent rows in foreign-key-safe order and is called only through `TransactionManager`.

- [ ] **Step 4: Add candidate/evidence/report/diagnostic operations**

Expose these exact repository methods:

```ts
candidates.listRanked(input: CandidateQuery): Promise<CandidatePageRecord>;
candidates.findDetail(runId: string, candidateId: string, snapshotHash: string): Promise<CandidateDetailRecord | null>;
candidates.findComparison(runId: string, ids: readonly string[], snapshotHash: string): Promise<CandidateComparisonRecord[]>;
stages.findLatestByKey(runId: string, stageKey: string): Promise<WorkflowStage | null>;
populationCoverageResults.findMatch(input: CoverageLookup): Promise<PopulationCoverageResult | null>;
shortlistOptimizationResults.findLatest(runId: string, track: 'MHCI' | 'MHCII'): Promise<ShortlistRecord | null>;
graphNodes.findNeighborhood(input: GraphNeighborhoodQuery): Promise<GraphNeighborhoodRecord>;
artifacts.countAll(): Promise<number>;
approvals.findLatest(runId: string, type: 'CONFIGURATION' | 'SHORTLIST'): Promise<Approval | null>;
rankingResults.findSnapshot(runId: string, snapshotHash: string): Promise<RankingResult[]>;
rankingResults.findLatestSnapshotHash(runId: string): Promise<string | null>;
databaseHealth.check(): Promise<boolean>;
```

Candidate filtering is expressed in Prisma `where` clauses and is restricted to `rankingSnapshotHash`. `hasWarnings=true` means an associated `ConstraintOutcome` with `outcome in ['REVIEW', 'FAIL']`; `false` means none. Source filtering traverses observation to predictor execution and never rewrites provenance. `transitionControl` uses `updateMany` with the expected status set and returns `null` when the compare-and-set loses a race.

- [ ] **Step 5: Verify repository behavior and the unchanged schema**

Run:

```powershell
npx vitest run packages/database/src/repositories.test.ts packages/database/src/schema.test.ts packages/database/src/validation.test.ts
npm run typecheck --workspace @immunograph/database
```

Expected: all pass and `git diff` is not used because the workspace has no Git metadata. Record checkpoint 2.

---

### Task 3: Add application errors, canonical configuration parsing, cursors, and capability ports

**Files:**
- Create: `apps/api/src/application/errors.ts`
- Create: `apps/api/src/application/json.ts`
- Create: `apps/api/src/application/cursor.ts`
- Create: `apps/api/src/application/ports.ts`
- Create: `apps/api/src/application/errors.test.ts`
- Create: `apps/api/src/application/json.test.ts`
- Create: `apps/api/src/application/cursor.test.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/tsconfig.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: existing Fastify request schemas and `@immunograph/algorithms` canonical JSON helpers.
- Produces: typed failures, normalized configuration snapshots, opaque cursors, and injectable external-capability boundaries.

- [ ] **Step 1: Add the algorithms workspace dependency and failing foundation tests**

Run:

```powershell
npm install --workspace @immunograph/api @immunograph/algorithms@0.1.0
```

Add a TypeScript project reference from `apps/api/tsconfig.json` to `../../packages/algorithms`, then write tests that assert:

```ts
expect(normalizeRunConfiguration(input)).toEqual({
  ...input,
  populations: ['INDIA', 'USA'],
  analysis: {
    ...input.analysis,
    mhci: { ...input.analysis.mhci, alleles: ['A', 'B'], peptideLengths: [9, 10] },
  },
});
expect(decodeProjectCursor(encodeProjectCursor({ updatedAt, id }))).toEqual({ updatedAt, id });
expect(() => decodeProjectCursor('not-a-cursor')).toThrowError(
  expect.objectContaining({ code: 'INVALID_CURSOR', statusCode: 400 }),
);
```

- [ ] **Step 2: Run the foundation tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/errors.test.ts apps/api/src/application/json.test.ts apps/api/src/application/cursor.test.ts
```

Expected: module-not-found failures for the new application files.

- [ ] **Step 3: Add typed errors and persistence translation**

Use this single error shape:

```ts
export class ApplicationError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string,
    readonly retryable = false,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export class DependencyUnavailableError extends ApplicationError {
  constructor(capability: string) {
    super('SERVICE_UNAVAILABLE', 503, `The ${capability} capability is not configured.`, true);
  }
}
```

`translatePersistenceError` maps Prisma `P2025` to `404 RESOURCE_NOT_FOUND`, `P2002` to `409 RESOURCE_CONFLICT`, and `P2003` to `409 RESOURCE_IN_USE`; unknown errors are rethrown for the Fastify `500` handler.

- [ ] **Step 4: Add normalized snapshot JSON and opaque cursor helpers**

`normalizeRunConfiguration` performs only presentation-independent canonicalization: trim strings, sort/deduplicate string arrays, sort/deduplicate peptide lengths numerically, and sort/deduplicate output formats. Build snapshots as:

```ts
export interface StoredRunConfiguration {
  request: RunConfiguration;
  profiles: {
    biologicalConstraints: ProfileMetadata;
    ranking: ProfileMetadata;
  };
}

export function configurationHash(snapshot: StoredRunConfiguration): string {
  return canonicalJsonSha256(snapshot as CanonicalJsonValue);
}

export function serializeRunConfiguration(snapshot: StoredRunConfiguration): string {
  return canonicalJson(snapshot as CanonicalJsonValue);
}
```

JSON-column parsers accept these producer-owned shapes and fail as an internal invariant violation when malformed:

```ts
export const rawScoresSchema = z.object({ value: z.number().finite() }).passthrough();
export const evidenceDetailsSchema = z.object({
  topReasons: z.array(z.string()).default([]),
}).passthrough();
export const scoreMapSchema = z.record(z.number().finite());
export const coverageProvenanceSchema = z.object({
  sourceStatus: sourceStatusSchema,
  method: z.string().min(1),
}).passthrough();
export const graphNodePropertiesSchema = z.object({
  subtitle: z.string().nullable().default(null),
  status: z.string().nullable().default(null),
  sourceStatus: sourceStatusSchema.nullable().default(null),
  warningCode: z.string().nullable().default(null),
  detailLines: z.array(z.string()).default([]),
  position: z.object({ x: z.number(), y: z.number() }).strict().optional(),
}).passthrough();
export const graphEdgePropertiesSchema = z.object({
  label: z.string().nullable().default(null),
  provenance: z.string().nullable().default(null),
}).passthrough();
```

Cursor payloads are strict Zod objects encoded with `Buffer.from(JSON.stringify(payload)).toString('base64url')`. Decode errors become `400 INVALID_CURSOR` and never leak parser details.

- [ ] **Step 5: Add exact capability port contracts and unavailable defaults**

```ts
export interface WorkflowExecutionPort {
  assertAvailable(): Promise<void>;
  start(command: { runId: string; requestId: string }): Promise<void>;
  cancel(command: { runId: string; requestId: string }): Promise<void>;
  retry(command: {
    runId: string;
    stageKey: string;
    attempt: number;
    requestId: string;
  }): Promise<void>;
}

export interface ReportGenerationPort {
  assertAvailable(): Promise<void>;
  generate(command: ReportGenerationCommand): Promise<{ artifactJobId: string; status: 'QUEUED' }>;
}

export interface ConnectorDiagnosticsPort {
  list(): Promise<z.infer<typeof connectorListSchema>['items']>;
  health(): Promise<z.infer<typeof connectorHealthListSchema>['items']>;
}
```

`UnavailableWorkflowExecutionPort` and `UnavailableReportGenerationPort` throw `DependencyUnavailableError` from `assertAvailable` and all command methods. `EmptyConnectorDiagnosticsPort` returns `[]` from both methods.

- [ ] **Step 6: Verify foundation behavior**

Run:

```powershell
npx vitest run apps/api/src/application/errors.test.ts apps/api/src/application/json.test.ts apps/api/src/application/cursor.test.ts
npm run typecheck --workspace @immunograph/api
```

Expected: all pass. Record checkpoint 3.

---

### Task 4: Build pure, schema-validated DTO mappers

**Files:**
- Create: `apps/api/src/application/response-schemas.ts`
- Create: `apps/api/src/application/mappers/project-mapper.ts`
- Create: `apps/api/src/application/mappers/run-mapper.ts`
- Create: `apps/api/src/application/mappers/candidate-mapper.ts`
- Create: `apps/api/src/application/mappers/graph-mapper.ts`
- Create: `apps/api/src/application/mappers/report-mapper.ts`
- Create: `apps/api/src/application/mappers/settings-mapper.ts`
- Create: `apps/api/src/application/mappers/event-mapper.ts`
- Create: matching mapper test files.

**Interfaces:**
- Consumes: database read models, fixed `now` values, and existing shared response schemas.
- Produces: pure mapper functions returning only validated API DTOs.

- [ ] **Step 1: Write failing contract tests for every top-level mapper**

Each test supplies a plain record and asserts both exact output and shared-schema acceptance. The minimum assertions are:

```ts
expect(projectListSchema.parse(mapProjectList(record, totals, now))).toEqual(expected);
expect(runDetailSchema.parse(mapRunDetail(record, now))).toEqual(expected);
expect(candidateListSchema.parse(mapCandidatePage(record))).toEqual(expected);
expect(candidateDetailSchema.parse(mapCandidateDetail(record))).toEqual(expected);
expect(graphSchema.parse(mapEvidenceGraph(record, now))).toEqual(expected);
expect(artifactListSchema.parse(mapArtifactList(records))).toEqual(expected);
expect(runtimeSettingsSchema.parse(mapRuntimeSettings(input))).toEqual(expected);
```

Add negative cases proving a full FASTA, relative artifact path, malformed JSON column, and undocumented property cannot appear in returned DTOs.

- [ ] **Step 2: Run mapper tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/mappers
```

Expected: missing mapper modules.

- [ ] **Step 3: Add strict internal response schemas only where shared schemas are absent**

Define and export these closed shapes:

```ts
export const eventHistorySchema = z.object({
  items: z.array(z.object({
    id: z.string().regex(/^\d+$/),
    event: z.enum([
      'run.status_changed', 'stage.status_changed', 'stage.progress',
      'connector.status_changed', 'approval.required', 'candidate.summary_ready',
      'artifact.created', 'run.warning',
    ]),
    data: z.record(z.unknown()),
  }).strict()),
  nextCursor: z.string().nullable(),
}).strict();

export const projectDeleteResponseSchema = z.object({
  projectId: uuidSchema,
  deleted: z.literal(true),
}).strict();

export const explanationResponseSchema = z.object({
  text: z.string().min(1),
  generationModeUsed: z.enum(['DETERMINISTIC', 'LLM']),
}).strict();

export const shortlistOptimizationResponseSchema = z.object({
  rankingSnapshotHash: sha256Schema,
  track: z.enum(['MHCI', 'MHCII']),
  algorithmId: z.string(),
  algorithmVersion: z.string(),
  steps: z.array(z.object({
    step: z.number().int().positive(),
    candidateId: uuidSchema,
    marginalCoverageGain: z.number().min(0).max(1),
    cumulativeCoverage: z.number().min(0).max(1),
    reasonCode: z.string(),
  }).strict()),
  finalCoverage: z.number().min(0).max(1),
}).strict();

export const constraintSummaryResponseSchema = z.object({
  version: z.literal('1'),
  outcomes: z.array(z.object({
    outcome: z.enum(['PASS', 'REVIEW', 'FAIL']),
    count: z.number().int().nonnegative(),
  }).strict()),
  generatedAt: isoInstantSchema,
}).strict();

export const scoreDistributionResponseSchema = z.object({
  version: z.literal('1'),
  bins: z.array(z.object({
    minimum: z.number().min(0).max(1),
    maximum: z.number().min(0).max(1),
    count: z.number().int().nonnegative(),
  }).strict()),
  generatedAt: isoInstantSchema,
}).strict();

export const connectorStatusResponseSchema = z.object({
  version: z.literal('1'),
  connectors: z.array(z.object({
    connectorId: z.string(),
    method: z.string(),
    sourceStatus: sourceStatusSchema,
    count: z.number().int().nonnegative(),
  }).strict()),
  generatedAt: isoInstantSchema,
}).strict();
```

These internal visualization schemas do not alter a shared contract because no shared schema currently exists for these three documented variants. Score distribution uses ten fixed display bins `[0.0,0.1) ... [0.9,1.0]`; this is view aggregation of stored final scores, not ranking logic.

- [ ] **Step 4: Implement project/run/report/settings/event mappers**

Rules are exact:

- dates use `toISOString()`;
- project/run source mixes are unique and sorted `LIVE`, `CACHED`, `FIXTURE`, `FAILED`;
- portfolio `running` counts only `RUNNING`;
- run approval requirements are `CONFIGURATION` for `DRAFT`/`AWAITING_CONFIGURATION_APPROVAL`, `SHORTLIST` for `AWAITING_SHORTLIST_APPROVAL`, otherwise empty;
- stage duration is `completedAt - startedAt` or `now - startedAt` for a running stage;
- stage retryability is true only for a failed latest attempt whose key is `predict_mhci`, `predict_mhcii`, `predict_bcell`, or `calculate_candidate_coverage`;
- artifact filename is `basename(relativePath)` and the relative path itself is never returned;
- the event `id` is `String(sequenceNumber)` and payload JSON is parsed as a record.

- [ ] **Step 5: Implement candidate and graph mappers without scientific derivation**

Map stored data as follows:

- card predictor score = stored `EvidenceSummary.bindingQuality`;
- agreement/completeness = stored evidence fields;
- singleton coverage = stored `CANDIDATE_RANKING` coverage for that candidate;
- missing measurements use `{ value: null, unavailableReason: '<field> unavailable', sourceStatus: null }`;
- source status comes only from associated `PredictorExecution.sourceStatus` or parsed coverage provenance;
- numeric stored confidence maps to the existing display enum: `>= 0.8 HIGH`, `>= 0.6 MEDIUM`, otherwise `LOW`;
- warnings are stored `REVIEW`/`FAIL` constraint messages; top reasons are stored evidence detail reasons followed by passing constraint messages;
- graph edges come only from persisted `GraphEdge` records or workflow stage dependency keys;
- deterministic graph positions use sorted record order on a 4-column grid and do not create relationships.

Every top-level return calls `.parse(...)` on its response schema.

`mapCandidateDetail` accepts an already-produced deterministic explanation string. `CandidateService` and `ReportService` both obtain that string from the existing pure `explainCandidate` algorithm; the mapper never generates prose itself.

- [ ] **Step 6: Verify mapper purity and contracts**

Run:

```powershell
npx vitest run apps/api/src/application/mappers
npm run typecheck --workspace @immunograph/api
```

Expected: all mapper tests pass; imports in mapper files contain no Prisma client, filesystem, Fastify, HTTP, or capability-port modules. Record checkpoint 4.

---

### Task 5: Implement EventService persistence, replay, notification, and SSE cancellation

**Files:**
- Create: `apps/api/src/application/event-notifier.ts`
- Create: `apps/api/src/application/services/event-service.ts`
- Create: `apps/api/src/application/services/event-service.test.ts`
- Modify: `apps/api/src/services.ts`
- Modify: `apps/api/src/routes.ts`
- Modify: `apps/api/src/api.integration.test.ts`

**Interfaces:**
- Consumes: event repositories and event mapper.
- Produces: `append`, `publish`, `history`, and `stream` without workflow-execution authority.

```ts
export interface AppendEventInput {
  runId: string;
  stageId?: string;
  eventType: WorkflowSseEvent['event'];
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data: Record<string, unknown>;
}
```

- [ ] **Step 1: Write failing EventService tests**

Test ordered allocation, history cursor pagination, resume after sequence, post-commit wakeup, terminal completion, missing run, invalid `Last-Event-ID`, and abort cancellation:

```ts
const controller = new AbortController();
const iterator = service.stream({ runId, lastEventId: '1', signal: controller.signal });
const next = iterator[Symbol.asyncIterator]().next();
controller.abort();
await expect(next).resolves.toEqual({ done: true, value: undefined });
```

- [ ] **Step 2: Run the event tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/services/event-service.test.ts
```

Expected: missing EventService modules.

- [ ] **Step 3: Add notifier and EventService**

`EventNotifier.wait(runId, afterSequence, signal)` registers a listener, resolves only when a published sequence is greater than `afterSequence`, and removes the listener on resolve or abort. `publish` is called only after a transaction commits.

`EventService.stream` follows this loop:

```ts
while (!signal?.aborted) {
  const page = await repositories.events.listPage({ runId, afterSequence, limit: 500 });
  for (const record of page.items) {
    afterSequence = record.sequenceNumber;
    yield mapWorkflowEvent(record);
  }
  const run = await repositories.runs.findById(runId);
  if (run === null) throw resourceNotFound('run');
  if (terminalStatuses.has(run.status) && page.items.length === 0) return;
  await notifier.wait(runId, afterSequence, signal);
}
```

No method on EventService accepts a workflow port.

- [ ] **Step 4: Propagate client disconnect through the existing SSE route**

Extend the internal `streamRunEvents` input with `signal?: AbortSignal`. In `sendSse`, create an `AbortController`, register `request.raw.once('close', abort)`, pass its signal, and remove the listener in `finally`. Preserve the existing event names, heartbeat, headers, and decimal IDs.

- [ ] **Step 5: Verify SSE and event history**

Run:

```powershell
npx vitest run apps/api/src/application/services/event-service.test.ts apps/api/src/api.integration.test.ts
```

Expected: event tests and existing SSE transport tests pass without hanging. Record checkpoint 5.

---

### Task 6: Implement ProjectService with atomic FASTA persistence and controlled deletion

**Files:**
- Create: `apps/api/src/application/artifact-store.ts`
- Create: `apps/api/src/application/artifact-store.test.ts`
- Create: `apps/api/src/application/services/project-service.ts`
- Create: `apps/api/src/application/services/project-service.test.ts`

**Interfaces:**
- Consumes: project/protein/run/artifact repositories, `TransactionManager`, `validateFasta`, project mappers, and `ArtifactStore`.
- Produces: `create`, `list`, `get`, and `delete` returning existing project DTOs.

- [ ] **Step 1: Write failing project and artifact-store tests**

Cover valid project creation, invalid FASTA field errors, rollback when protein insertion fails, cursor paging, complete-workspace totals, detail without FASTA, exact-name deletion, deletion refusal, contained file removal, and path escape refusal.

```ts
await expect(service.create(validInput)).resolves.toMatchObject({
  project: { name: validInput.name },
  protein: { length: 10, warnings: [] },
});
await expect(service.delete({ projectId, confirmation: 'DELETE', expectedProjectName: 'wrong' }))
  .rejects.toMatchObject({ code: 'PROJECT_NAME_MISMATCH', statusCode: 409 });
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/artifact-store.test.ts apps/api/src/application/services/project-service.test.ts
```

Expected: missing modules.

- [ ] **Step 3: Add contained ArtifactStore operations**

```ts
export interface VerifiedArtifact {
  absolutePath: string;
  filename: string;
  mediaType: string;
  contentLength: number;
}

export class ArtifactStore {
  constructor(private readonly root: string) {}
  verify(record: Artifact): Promise<VerifiedArtifact>;
  open(record: Artifact): Promise<ArtifactDownload>;
  remove(records: readonly Artifact[]): Promise<void>;
  health(): Promise<'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE'>;
}
```

Resolve the root and target, reject an absolute relative path, and reject when `relative(root, target)` is absolute or begins with `..`. Download verification additionally requires a regular file, compares byte size, streams SHA-256, compares lowercase hashes, and only then creates the read stream. Removal accepts only records already loaded from SQLite, repeats the containment check, and removes individual paths with `force: true`; it does not trust or recursively remove a directory.

- [ ] **Step 4: Add ProjectService**

Creation validates FASTA before opening a transaction, converts algorithm failures to documented 413/422 errors with `fieldErrors.fasta`, and persists project plus protein in one transaction. The validation profile string is `mvp-v1.0`.

Before persistence, reject a project name longer than the domain maximum of 120 characters and a FASTA header longer than 500 characters with `422 INVALID_FASTA`; this prevents repository validation failures from surfacing as `500` while leaving the existing route contract untouched.

Listing uses a fixed 30-day recent window from the injected clock, database totals independent of the requested page, and opaque cursors. Retrieval selects the newest protein input and ordered run summaries. Deletion loads artifact records, validates confirmation and name, deletes the relational tree in one transaction, then removes only the captured contained artifact files.

- [ ] **Step 5: Verify project behavior**

Run:

```powershell
npx vitest run apps/api/src/application/artifact-store.test.ts apps/api/src/application/services/project-service.test.ts
```

Expected: all pass, including rollback and no-sequence-response assertions. Record checkpoint 6.

---

### Task 7: Implement RunService as the sole lifecycle owner

**Files:**
- Create: `apps/api/src/application/services/run-service.ts`
- Create: `apps/api/src/application/services/run-service.test.ts`

**Interfaces:**
- Consumes: run/protein/stage/ranking/candidate/approval repositories, `TransactionManager`, `EventService`, profile loader, run mapper, and `WorkflowExecutionPort`.
- Produces: run creation, detail, configuration approval, start, cancel, stage retry, and shortlist approval.

- [ ] **Step 1: Write failing lifecycle tests with fake and unavailable ports**

Cover:

- revision allocation and immutable profile metadata/hash;
- `demo-v1 -> 422 PROFILE_NOT_FOUND`;
- stale configuration hash with no approval/event write;
- approval atomically writes `APPROVED`, changes `DRAFT -> QUEUED`, and emits sequence 1;
- unavailable start returns 503 while run stays `QUEUED`;
- fake start receives the command and transition becomes `RUNNING`;
- duplicate start, terminal cancel, invalid retry, stale ranking, rejected shortlist member, cross-run candidate, and empty-shortlist rules;
- shortlist approval atomically changes `AWAITING_SHORTLIST_APPROVAL -> COMPLETED`.

```ts
await expect(service.start({ runId }, context)).rejects.toMatchObject({
  code: 'SERVICE_UNAVAILABLE', statusCode: 503,
});
await expect(repositories.runs.findById(runId)).resolves.toMatchObject({ status: 'QUEUED' });
```

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/services/run-service.test.ts
```

Expected: missing RunService.

- [ ] **Step 3: Implement draft creation and configuration approval**

Draft creation:

1. verifies project and current protein;
2. loads both requested profile versions;
3. normalizes the existing REST configuration;
4. stores `{ request, profiles }` as canonical JSON;
5. hashes the complete stored snapshot;
6. allocates the next project revision and inserts `DRAFT` transactionally;
7. returns `mapRunDetail`.

Configuration approval checks status and hash before a transaction, then inserts the approval, transitions to `QUEUED`, and appends `run.status_changed` with `{ runId, status: 'QUEUED', at }`. Publish only after commit.

- [ ] **Step 4: Implement start, cancel, and retry with preflight availability**

Start accepts only `QUEUED`. It calls `workflowPort.assertAvailable()` before any transaction, invokes `workflowPort.start`, then transactionally changes status to `RUNNING`, sets `startedAt`, and appends an event. Cancel rejects terminal statuses, preflights and invokes the port, then writes `CANCELLED`, `completedAt`, and an event. Retry requires the latest stage attempt to be failed, retryable, and equal to `expectedAttempt`; it invokes the port and creates attempt `expectedAttempt + 1` plus a `stage.status_changed` event.

The port never receives repositories and cannot mutate run state.

- [ ] **Step 5: Implement shortlist approval**

Require `AWAITING_SHORTLIST_APPROVAL`. Query ranking rows for `expectedRankingSnapshotHash`; reject empty/mixed snapshots, unknown IDs, cross-run IDs, overlapping approved/excluded IDs, and any approved `REJECTED` row. Insert a `SHORTLIST/APPROVED` approval whose `selectionJson` is canonical, transition to `COMPLETED`, set `completedAt`, append the status event, then publish.

- [ ] **Step 6: Verify all run transitions**

Run:

```powershell
npx vitest run apps/api/src/application/services/run-service.test.ts apps/api/src/application/services/event-service.test.ts
```

Expected: all lifecycle and atomicity tests pass. Record checkpoint 7.

---

### Task 8: Implement CandidateService from stored workflow results only

**Files:**
- Create: `apps/api/src/application/services/candidate-service.ts`
- Create: `apps/api/src/application/services/candidate-service.test.ts`

**Interfaces:**
- Consumes: candidate, ranking, coverage, shortlist, graph repositories and candidate mappers.
- Produces: list, detail, comparison, coverage, and shortlist optimization queries.

- [ ] **Step 1: Write failing persisted-data tests**

Seed candidates with identical peptides at different coordinates, multiple tracks, rankings, warnings, source statuses, observations, constraints, and coverage. Assert:

- both positional candidates remain;
- pagination/filter/search/warning/sort behavior is server-side;
- missing evidence maps to unavailable, not zero;
- candidate detail belongs to the requested run;
- comparison aligns stored components/constraints and rejects mixed tracks;
- B-cell shortlist optimization returns `422 INVALID_COVERAGE_TRACK`;
- coverage lookup distinguishes singleton and set results.

- [ ] **Step 2: Run CandidateService tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/services/candidate-service.test.ts
```

Expected: missing CandidateService.

- [ ] **Step 3: Implement list/detail/comparison dispatch**

`list` resolves `RankingResultRepository.findLatestSnapshotHash(runId)`, passes that hash and validated filters to `CandidateRepository.listRanked`, and maps the returned page. `get` and `compare` use the same latest snapshot hash; `get` requires the run-scoped detail record and obtains its required deterministic explanation from the existing pure `explainCandidate` function, while `compare` requires every requested ID to exist in the run and all records to share one track. It never calls ranking, consensus, normalization, constraint, or overlap algorithms.

- [ ] **Step 4: Implement coverage and shortlist queries**

`coverage.get` looks up the exact population/purpose/candidate combination; absence returns a schema-valid unavailable measurement. `coverage.getShortlistOptimization` rejects `BCELL`, loads the latest stored optimization plus ordered selection steps/final coverage, and returns `404 RESOURCE_NOT_FOUND` when no workflow result exists.

- [ ] **Step 5: Verify CandidateService**

Run:

```powershell
npx vitest run apps/api/src/application/services/candidate-service.test.ts apps/api/src/application/mappers/candidate-mapper.test.ts
```

Expected: all pass and no service imports a scoring/ranking algorithm. Record checkpoint 8.

---

### Task 9: Implement EvidenceService from persisted graph/stage/view records

**Files:**
- Create: `apps/api/src/application/services/evidence-service.ts`
- Create: `apps/api/src/application/services/evidence-service.test.ts`

**Interfaces:**
- Consumes: graph neighborhood, stage, candidate, protein, coverage, constraint, ranking, and predictor-execution queries plus graph mappers.
- Produces: evidence graph, workflow graph, and five documented visualization variants.

- [ ] **Step 1: Write failing evidence tests**

Assert candidate-limited depth 1/2 neighborhoods, exclusion of other-run nodes, exact stored edge preservation, latest stage attempts, dependency-only workflow edges, disabled/skipped stage display, sequence coordinates, missing population coverage, constraint counts, score bins, and connector provenance counts.

- [ ] **Step 2: Run EvidenceService tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/services/evidence-service.test.ts
```

Expected: missing EvidenceService.

- [ ] **Step 3: Implement graph queries**

`evidence` validates the run and optional candidate membership, requests the bounded repository neighborhood, and maps only returned nodes/edges. `workflow` maps latest persisted stage attempts and parses only their stored dependency keys. Neither method constructs scientific evidence relationships.

- [ ] **Step 4: Implement visualization dispatch**

Use an exhaustive switch:

```ts
switch (input.type) {
  case 'sequence-map': return mapSequenceMap(records, now);
  case 'population-coverage': return mapCoverageVisualization(records, now);
  case 'constraint-summary': return mapConstraintSummary(records, now);
  case 'score-distribution': return mapScoreDistribution(records, now);
  case 'connector-status': return mapConnectorStatus(records, now);
}
```

All values are stored values or counts of stored values; no missing value becomes zero scientific evidence.

- [ ] **Step 5: Verify EvidenceService**

Run:

```powershell
npx vitest run apps/api/src/application/services/evidence-service.test.ts apps/api/src/application/mappers/graph-mapper.test.ts
```

Expected: all pass. Record checkpoint 9.

---

### Task 10: Implement ReportService, deterministic explanations, and safe artifacts

**Files:**
- Create: `apps/api/src/application/services/report-service.ts`
- Create: `apps/api/src/application/services/report-service.test.ts`

**Interfaces:**
- Consumes: run/candidate/approval/artifact repositories, `ArtifactStore`, deterministic `explainCandidate`, and `ReportGenerationPort`.
- Produces: explanation, report job, artifact list, and verified artifact download.

- [ ] **Step 1: Write failing report/artifact tests**

Cover deterministic explanation, absent LLM provider fallback, report-before-approval rejection, options mismatch, unavailable generator with no artifacts, fake generator job, artifact listing, safe streaming, missing file, directory, escape path, size mismatch, and hash mismatch.

- [ ] **Step 2: Run report tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/services/report-service.test.ts
```

Expected: missing ReportService.

- [ ] **Step 3: Implement deterministic explanations**

Load the persisted candidate detail and feed only its stored category, rank, final score, component scores, constraint outcomes, and provenance statuses into `explainCandidate`. Map stored `REVIEW` to the algorithm's `WARN`. When mode is `LLM` and no explanation capability is configured, return the same authoritative text with `generationModeUsed: 'DETERMINISTIC'`.

- [ ] **Step 4: Implement report gating and artifact operations**

Require a latest approved shortlist whose snapshot matches stored ranking results. Parse the immutable run snapshot and compare formats as normalized sets plus every other output-preference field. Call `reportPort.assertAvailable()` before generation. `artifacts.list` maps metadata only; `downloadArtifact` loads by database ID and delegates all path/size/hash verification to `ArtifactStore.open`.

- [ ] **Step 5: Verify ReportService**

Run:

```powershell
npx vitest run apps/api/src/application/services/report-service.test.ts apps/api/src/application/artifact-store.test.ts
```

Expected: all pass and unavailable generation produces no partial database write. Record checkpoint 10.

---

### Task 11: Implement read-only DiagnosticsService

**Files:**
- Create: `apps/api/src/application/services/diagnostics-service.ts`
- Create: `apps/api/src/application/services/diagnostics-service.test.ts`

**Interfaces:**
- Consumes: connector diagnostics port, immutable profile loader, database health probe, artifact-store health, build settings, and injected clock.
- Produces: connector list/health, profile list, and safe runtime settings.

- [ ] **Step 1: Write failing diagnostics tests**

Test empty default connectors, fake connector passthrough, both profile hashes, database available/unavailable, artifact available/unavailable, deterministic empty fixture-manifest hash, build metadata, and absence of path/secret/FASTA fields.

- [ ] **Step 2: Run diagnostics tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/services/diagnostics-service.test.ts
```

Expected: missing DiagnosticsService.

- [ ] **Step 3: Implement diagnostics without mutations**

`connectors.list` and `connectors.health` wrap port arrays in the existing shared schemas. `settings.profiles` returns the two actual file-backed profiles as approved. Runtime uses:

```ts
const emptyManifest = { version: 'mvp-v1.0', entries: [] as const };
const fixtureManifest = {
  ...emptyManifest,
  sha256: canonicalJsonSha256(emptyManifest),
};
```

Database health performs `SELECT 1`; artifact health uses access/stat only. Returned build fields are application version `0.1.0`, specification version `0.7.0-draft`, validated optional commit SHA, and optional ISO build time. No diagnostic operation writes configuration or infrastructure state.

- [ ] **Step 4: Verify diagnostics**

Run:

```powershell
npx vitest run apps/api/src/application/services/diagnostics-service.test.ts apps/api/src/application/mappers/settings-mapper.test.ts
```

Expected: all pass. Record checkpoint 11.

---

### Task 12: Add exhaustive dispatch and production composition

**Files:**
- Create: `apps/api/src/application/concrete-rest-api-services.ts`
- Create: `apps/api/src/application/concrete-rest-api-services.test.ts`
- Create: `apps/api/src/application/create-services.ts`
- Create: `apps/api/src/bootstrap.ts`
- Modify: `apps/api/src/services.ts`
- Modify: `apps/api/src/application.ts`
- Modify: `apps/api/src/config/environment.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: all focused services and default capability ports.
- Produces: the single concrete `RestApiServices` implementation used by the production API process.

- [ ] **Step 1: Write failing dispatch/composition tests**

Create spies for all focused services and assert every `ApiOperation` reaches exactly one expected method. Assert `streamRunEvents` reaches only EventService and `downloadArtifact` reaches only ReportService. Add a compile-time exhaustive assertion so a new union member breaks the switch.

- [ ] **Step 2: Run dispatch tests and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/concrete-rest-api-services.test.ts
```

Expected: missing dispatcher.

- [ ] **Step 3: Implement exhaustive operation dispatch**

`ConcreteRestApiServices.execute` uses a switch over all existing operations. The default branch is:

```ts
default: {
  const exhaustive: never = operation;
  throw new Error(`Unhandled API operation: ${String(exhaustive)}`);
}
```

It contains no repository calls, state transitions, DTO assembly, or scientific calculations.

- [ ] **Step 4: Add validated production environment and composition**

Extend `ApiEnvironment` with defaults. Parse booleans through exact string enums rather than JavaScript truthiness:

```ts
DATABASE_URL: z.string().min(1).default('file:./data/immunograph.db'),
ARTIFACT_ROOT: z.string().min(1).default('./artifacts'),
DEMO_MODE: z.enum(['true', 'false']).transform((value) => value === 'true').default('true'),
LLM_ENABLED: z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
APPLICATION_VERSION: z.string().default('0.1.0'),
SPECIFICATION_VERSION: z.string().default('0.7.0-draft'),
COMMIT_SHA: z.string().min(1).optional(),
BUILT_AT: z.string().datetime({ offset: true }).optional(),
```

`createServices` creates root repositories, transaction manager, notifier, artifact store, focused services, and the concrete dispatcher. Defaults are `UnavailableWorkflowExecutionPort`, `UnavailableReportGenerationPort`, and `EmptyConnectorDiagnosticsPort`.

- [ ] **Step 5: Replace unavailable startup wiring**

Make `services` mandatory in `createApiApplication`. `bootstrapApi(environment)` creates and initializes Prisma, composes services, constructs Fastify, and registers an `onClose` hook that disconnects Prisma. `index.ts` awaits bootstrap and listens. Remove `unavailableRestApiServices`; retain only shared interfaces in `services.ts`.

Update `.env.example` comments for existing `DATABASE_URL` and `ARTIFACT_ROOT` and add the non-secret build/demo flags. Do not add connector secrets or URLs.

- [ ] **Step 6: Verify production composition**

Run:

```powershell
npx vitest run apps/api/src/application/concrete-rest-api-services.test.ts apps/api/src/api.integration.test.ts
npm run typecheck --workspace @immunograph/api
```

Expected: dispatcher and legacy transport tests pass; `rg "unavailableRestApiServices" apps/api/src` returns no matches. Record checkpoint 12.

---

### Task 13: Correct seed UUIDs and prove real API-to-SQLite integration

**Files:**
- Modify: `packages/database/src/seed.ts`
- Create: `apps/api/src/application/test-context.test-support.ts`
- Create: `apps/api/src/application/application-services.integration.test.ts`

**Interfaces:**
- Consumes: migrated temporary SQLite, real repositories/services, fake workflow/report/connector ports, and Fastify injection.
- Produces: end-to-end evidence that unchanged REST contracts use the concrete service layer.

- [ ] **Step 1: Write the failing full integration suite**

Create `test-context.test-support.ts` with `createMigratedTestDatabase()` that allocates a uniquely named database beneath `packages/database/prisma`, runs the existing migration through the root Prisma CLI, initializes WAL/foreign keys, and returns `{ client, repositories, transactionManager, cleanup }`. `cleanup` disconnects and removes only that test's explicit `.db`, `-shm`, and `-wal` paths.

Use deterministic UUIDs and that temporary migrated database. Cover:

1. `POST /projects` then `GET /projects` and `GET /projects/:id`;
2. draft run creation with `mvp-v1.0`, hash approval, fake workflow start/cancel/retry;
3. candidate list/detail/comparison from seeded persisted workflow rows;
4. evidence/workflow graphs and sequence/coverage views;
5. shortlist approval and fake report generation;
6. artifact list and verified download;
7. profile/runtime/connector diagnostics;
8. ordered history and SSE resume;
9. unavailable workflow/report `503` with unchanged state;
10. project deletion and artifact removal.

Parse each successful `data` value with the existing shared response schema applicable to that endpoint.

- [ ] **Step 2: Run the integration suite and verify RED**

Run:

```powershell
npx vitest run apps/api/src/application/application-services.integration.test.ts
```

Expected: failures identify any remaining composition or mapping gap.

- [ ] **Step 3: Replace seed IDs with deterministic canonical UUIDs**

Use these stable values:

```ts
const DEMO_PROJECT_ID = '00000000-0000-4000-8000-000000000101';
const DEMO_PROTEIN_IDS = [
  '00000000-0000-4000-8000-000000000111',
  '00000000-0000-4000-8000-000000000112',
  '00000000-0000-4000-8000-000000000113',
] as const;
const DEMO_RUN_ID = '00000000-0000-4000-8000-000000000121';
```

Do not change seed scientific content, profile metadata rules, or the Prisma schema.

- [ ] **Step 4: Resolve only integration defects exposed by the suite**

Corrections are limited to the service/repository/mapper files listed in this plan. A failure caused by a missing workflow engine, report generator, connector registry, or fixture payload remains an explicit port behavior and is asserted as `503` or an empty diagnostic set rather than replaced with fabricated logic.

- [ ] **Step 5: Verify the complete integration suite**

Run:

```powershell
npx vitest run apps/api/src/application/application-services.integration.test.ts
npm run db:seed
```

Expected: integration tests pass and seed prints its success message using UUID records. Record checkpoint 13.

---

### Task 14: Update the implementation ledger and run all quality gates

**Files:**
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes: all previous checkpoints.
- Produces: an accurate project ledger and final verification evidence.

- [ ] **Step 1: Update only verified checklist entries**

Mark the repository transaction service, concrete application-service orchestration, configuration/shortlist lifecycle mutations, database-backed REST integration tests, and SSE persistence/replay as complete. Leave the workflow DAG, scheduler, scientific execution, live connectors, fixture curation, and artifact generation unchecked because they remain absent capabilities.

- [ ] **Step 2: Run formatting and unfinished-marker scans**

Run:

```powershell
npm run format
rg -n "TO[D]O|TB[D]|unavailableRestApiServices" apps/api/src packages/database/src docs/TASKS.md
```

Expected: formatting succeeds; no unavailable production gateway reference or unfinished implementation marker appears. Legitimate explanatory text in tests must not represent unfinished production work.

- [ ] **Step 3: Run focused database and API suites**

Run:

```powershell
npx vitest run packages/database/src apps/api/src
```

Expected: all focused tests pass.

- [ ] **Step 4: Run repository-wide verification**

Run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0.

- [ ] **Step 5: Run clean migration and seed verification on an isolated database**

Run from PowerShell with an explicit workspace-contained test database:

```powershell
$env:DATABASE_URL='file:./application-layer-verification.db'
npm run db:migrate
npm run db:seed
Remove-Item -LiteralPath 'packages/database/prisma/application-layer-verification.db' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'packages/database/prisma/application-layer-verification.db-shm' -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'packages/database/prisma/application-layer-verification.db-wal' -Force -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL
```

Expected: migration and seed succeed; only the explicitly named verification database files are removed.

- [ ] **Step 6: Prepare the completion report**

Report:

- architecture summary and the seven focused service classes;
- repository and transaction integrations;
- workflow/report/connector capability port behavior;
- SSE persistence/replay/disconnect integration;
- tests and every verification command result;
- genuine remaining capabilities: workflow engine/API-to-MCP transport, scientific connectors and fixtures, report generator, and connector registry.

Do not describe those remaining capabilities as implemented.
