# MCP Scientific Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default fixture-report replay with a policy-controlled, separately hosted NitroStack MCP workflow that computes deterministic candidates, constraints, rankings, coverage, confidence, reports, and provenance while retaining exact fixtures as fallback.

**Architecture:** `RunService` delegates to `ScientificWorkflowService`; the service calls the independent NitroStack server through an injected `McpToolGateway`. MCP tools own scientific computation and return validated envelopes. The API owns lifecycle, transactions, persistence, and REST mapping.

**Tech Stack:** TypeScript 5.9, Fastify 5, NitroStack 1.0.13, MCP SDK 1.29, Zod 3, Prisma/SQLite, Pino, Vitest, React/Vite.

## Global Constraints

- Preserve every existing REST method and path.
- Add only backward-compatible optional request fields and additive response fields.
- Use real HTTP MCP transport outside unit tests.
- Never import scientific algorithms or MCP controllers into REST/application services.
- Keep GraphBepi fixture-only.
- Keep conservation and toxicity absent.
- Mark synthetic output `scientificUse: false` and `DEMONSTRATION_ONLY` everywhere.
- Preserve positional candidate identity.
- Never call MCP while a SQLite transaction is open.
- Do not add profile-definition database tables.

---

### Task 1: Execution-mode contracts and persistence

**Files:**
- Modify: `packages/shared/src/api/common.ts`
- Modify: `packages/shared/src/api/runs.ts`
- Modify: `apps/api/src/contracts.ts`
- Modify: `apps/api/src/application/json.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/database/src/validation.ts`
- Modify: `packages/database/src/read-models.ts`
- Modify: `apps/api/src/application/mappers/run-mapper.ts`
- Create: `packages/database/prisma/migrations/20260724170000_execution_modes/migration.sql`
- Test: `packages/shared/src/api/candidates.test.ts`
- Test: `apps/api/src/application/json.test.ts`
- Test: `packages/database/src/schema.test.ts`
- Test: `apps/api/src/application/mappers/run-mapper.test.ts`

**Interfaces:**
- Produces: `requestedExecutionModeSchema`, `executionModeSchema`, and `sourceStatusSchema` including `SYNTHETIC`.
- Produces: optional run-create `requestedExecutionMode` defaulting to `AUTO` during normalization.
- Produces: nullable persisted `WorkflowRun.requestedExecutionMode` and `WorkflowRun.executionMode`.

- [ ] **Step 1: Write failing schema and mapper tests**

```ts
expect(runConfigurationSchema.parse({ ...configuration, requestedExecutionMode: 'SYNTHETIC' }))
  .toMatchObject({ requestedExecutionMode: 'SYNTHETIC' });
expect(sourceStatusSchema.parse('SYNTHETIC')).toBe('SYNTHETIC');
expect(mapped.executionMode).toBe('SYNTHETIC');
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run packages/shared/src/api/candidates.test.ts apps/api/src/application/json.test.ts packages/database/src/schema.test.ts apps/api/src/application/mappers/run-mapper.test.ts`  
Expected: schema and mapper failures for unknown mode fields.

- [ ] **Step 3: Add contracts, migration, validation, and mapping**

```ts
export const requestedExecutionModeSchema = z.enum(['AUTO', 'LIVE', 'SYNTHETIC', 'FIXTURE']);
export const executionModeSchema = z.enum(['LIVE', 'SYNTHETIC', 'FIXTURE', 'HYBRID']);
export const sourceStatusSchema = z.enum(['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE', 'FAILED']);
```

Migration:

```sql
ALTER TABLE "WorkflowRun" ADD COLUMN "requestedExecutionMode" TEXT;
ALTER TABLE "WorkflowRun" ADD COLUMN "executionMode" TEXT;
```

- [ ] **Step 4: Generate Prisma and verify GREEN**

Run: `npm run db:generate && npx vitest run packages/shared/src/api/candidates.test.ts apps/api/src/application/json.test.ts packages/database/src/schema.test.ts apps/api/src/application/mappers/run-mapper.test.ts`  
Expected: all selected tests pass.

### Task 2: Deterministic synthetic algorithms

**Files:**
- Create: `packages/algorithms/src/synthetic-prediction.ts`
- Create: `packages/algorithms/src/synthetic-prediction.test.ts`
- Create: `packages/algorithms/src/synthetic-coverage.ts`
- Create: `packages/algorithms/src/synthetic-coverage.test.ts`
- Modify: `packages/algorithms/src/index.ts`

**Interfaces:**
- Produces: `predictSyntheticBinding(input): SyntheticBindingObservation[]`.
- Produces: `calculateSyntheticCoverage(input): SyntheticCoverageResult | null`.

- [ ] **Step 1: Write determinism and edge-case tests**

```ts
const first = predictSyntheticBinding(input);
expect(predictSyntheticBinding(input)).toEqual(first);
expect(first.map(({ percentileRank }) => percentileRank)).toEqual(
  [...first].map(({ percentileRank }) => percentileRank).sort((a, b) => a - b),
);
expect(calculateSyntheticCoverage({ frequencies: [0.24] })?.projectedCoverage)
  .toBeCloseTo(1 - (1 - 0.24) ** 2, 12);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run packages/algorithms/src/synthetic-prediction.test.ts packages/algorithms/src/synthetic-coverage.test.ts`  
Expected: module-not-found failures.

- [ ] **Step 3: Implement pure deterministic functions**

Use canonical SHA-256 seeds, stable lexical ordering, ordinal percentile rank, and the approved
synthetic carrier formula. Return `null` for missing frequency evidence. No I/O or global state.

- [ ] **Step 4: Verify GREEN and algorithm benchmarks**

Run: `npx vitest run packages/algorithms/src/synthetic-prediction.test.ts packages/algorithms/src/synthetic-coverage.test.ts packages/algorithms/src/algorithms.benchmark.test.ts`  
Expected: all tests pass within existing benchmark limits.

### Task 3: Synthetic MCP tools and profile-driven ranking

**Files:**
- Modify: `apps/mcp/src/tool-contracts.ts`
- Modify: `apps/mcp/src/prediction/prediction.controller.ts`
- Modify: `apps/mcp/src/evidence/evidence.controller.ts`
- Modify: `apps/mcp/src/tool-catalog.test.ts`
- Test: `apps/mcp/src/prediction/prediction.controller.test.ts`
- Test: `apps/mcp/src/evidence/evidence.controller.test.ts`

**Interfaces:**
- Produces MCP tool: `predict_synthetic_binding`.
- Produces MCP tool: `calculate_synthetic_population_coverage`.
- Extends MCP tool: `rank_candidates` requires explicit validated weights and returns numeric confidence plus label.

- [ ] **Step 1: Add failing discoverability and execution tests**

Assert both new tools are discoverable, reject malformed input, return `SYNTHETIC`, carry the full
disclosure object, and produce identical `outputHash` for identical inputs after excluding timing
metadata.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run apps/mcp/src/tool-catalog.test.ts apps/mcp/src/prediction/prediction.controller.test.ts apps/mcp/src/evidence/evidence.controller.test.ts`  
Expected: missing-tool and missing-contract failures.

- [ ] **Step 3: Implement focused MCP tools**

```ts
@ToolDecorator(toolOptions(predictSyntheticBindingContract, CATEGORY))
predictSyntheticBinding(input: unknown, context: ExecutionContext) {
  return executeTool({
    toolName: predictSyntheticBindingContract.name,
    input,
    inputSchema: predictSyntheticBindingContract.inputSchema,
    dataSchema: predictSyntheticBindingContract.dataSchema,
    context,
    operation: predictSyntheticBinding,
  });
}
```

Load synthetic HLA frequencies and ranking-profile definitions inside MCP capability boundaries,
not REST. Include profile/dataset hashes in outputs.

- [ ] **Step 4: Verify GREEN**

Run the Task 3 test command. Expected: all selected tests pass.

### Task 4: Real HTTP MCP gateway

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/config/environment.ts`
- Create: `apps/api/src/application/mcp-tool-gateway.ts`
- Create: `apps/api/src/application/http-mcp-tool-gateway.ts`
- Create: `apps/api/src/application/http-mcp-tool-gateway.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `McpToolGateway.call<T>(toolName, input, schema, context): Promise<ToolSuccess<T>>`.
- Produces: `HttpMcpToolGateway` using `MCP_SERVER_URL`, default `http://127.0.0.1:3001/mcp`.

- [ ] **Step 1: Write failing gateway tests**

Use an ephemeral HTTP MCP endpoint to prove tool discovery, `tools/call`, envelope parsing,
correlation metadata, timeout mapping, and tool failure mapping.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run apps/api/src/application/http-mcp-tool-gateway.test.ts`  
Expected: missing gateway module.

- [ ] **Step 3: Implement the MCP SDK transport adapter**

Use `@modelcontextprotocol/sdk/client/index.js` and
`@modelcontextprotocol/sdk/client/streamableHttp.js`. Connect lazily, validate every structured
payload with Zod, and close the client during application shutdown.

- [ ] **Step 4: Verify GREEN**

Run the Task 4 test command. Expected: HTTP protocol calls pass.

### Task 5: Policy resolver and workflow value model

**Files:**
- Create: `apps/api/src/application/execution-policy.ts`
- Create: `apps/api/src/application/execution-policy.test.ts`
- Create: `apps/api/src/application/scientific-workflow-types.ts`

**Interfaces:**
- Produces: `resolveExecutionPlan(requestedMode, fallbackPolicy, demoMode): EvidenceSource[]`.
- Produces: `deriveExecutionMode(statuses): ExecutionMode`.
- Produces: typed intermediate workflow records independent of Prisma.

- [ ] **Step 1: Write the complete policy-matrix tests**

```ts
expect(resolveExecutionPlan('AUTO', 'LIVE_THEN_CACHE_THEN_FIXTURE', true))
  .toEqual(['LIVE', 'CACHE', 'SYNTHETIC', 'FIXTURE']);
expect(resolveExecutionPlan('LIVE', 'FIXTURE_ONLY', true)).toEqual([]);
expect(deriveExecutionMode(['LIVE', 'SYNTHETIC'])).toBe('HYBRID');
```

- [ ] **Step 2: Verify RED, implement pure resolver, verify GREEN**

Run: `npx vitest run apps/api/src/application/execution-policy.test.ts`  
Expected before implementation: module-not-found; after implementation: all matrix cases pass.

### Task 6: Scientific workflow orchestration and persistence

**Files:**
- Create: `apps/api/src/application/scientific-workflow-service.ts`
- Create: `apps/api/src/application/scientific-workflow-service.test.ts`
- Create: `apps/api/src/application/scientific-workflow-persistence.ts`
- Create: `apps/api/src/application/scientific-workflow-persistence.test.ts`
- Modify: `apps/api/src/application/ports.ts`
- Modify: `apps/api/src/application/create-services.ts`
- Modify: `apps/api/src/application/workflow-definition.ts`
- Retain: `apps/api/src/application/inline-fixture-workflow-port.ts` as non-default legacy/fallback support until migration tests pass.

**Interfaces:**
- Produces: `ScientificWorkflowService implements WorkflowExecutionPort`.
- Consumes: `McpToolGateway`, repositories, transactions, execution policy, profile/fixture loaders.
- Produces: persisted observations, summaries, constraints, rankings, coverage, execution mode, graph, stages, and events.

- [ ] **Step 1: Write failing orchestration tests**

Cover ordered tool calls, no algorithm imports, no MCP call inside transaction, source fallback,
fixture-only behavior, GraphBepi fixture-only behavior, mode derivation, stage logs, and persistence
mapping.

- [ ] **Step 2: Run tests and verify RED**

Run: `npx vitest run apps/api/src/application/scientific-workflow-service.test.ts apps/api/src/application/scientific-workflow-persistence.test.ts`  
Expected: missing service and persistence modules.

- [ ] **Step 3: Implement the smallest complete orchestrator**

The service calls the approved sequence, validates each envelope, and passes immutable value
objects to a persistence component. Fixture evidence supplies raw observations only; constraints,
ranking, confidence, and graph records are recomputed through MCP outputs rather than copied from
`expected-report.json`.

- [ ] **Step 4: Make the service the production default**

```ts
const gateway = new HttpMcpToolGateway(environment.MCP_SERVER_URL);
const workflow = overrides.workflow ?? new ScientificWorkflowService({
  gateway,
  repositories,
  transactions,
  demoMode: environment.DEMO_MODE,
});
```

- [ ] **Step 5: Verify GREEN**

Run the Task 6 test command plus `apps/api/src/application/create-services.test.ts`.

### Task 7: MCP report generation

**Files:**
- Modify: `apps/mcp/src/report/report.controller.ts`
- Modify: `apps/mcp/src/tool-contracts.ts`
- Create: `apps/mcp/src/report/report.controller.test.ts`
- Create: `apps/api/src/application/mcp-report-generation-port.ts`
- Create: `apps/api/src/application/mcp-report-generation-port.test.ts`
- Modify: `apps/api/src/application/create-services.ts`

**Interfaces:**
- MCP returns deterministic JSON/CSV content with mode-specific disclosure and provenance.
- API writes bytes through `ArtifactStore` and persists metadata.

- [ ] **Step 1: Write failing report tests**

Assert synthetic reports contain the exact approved disclaimer and cannot emit scientific-use true.
Assert live/fixture/hybrid mode labels and stable content hashes.

- [ ] **Step 2: Verify RED, implement, and verify GREEN**

Run: `npx vitest run apps/mcp/src/report/report.controller.test.ts apps/api/src/application/mcp-report-generation-port.test.ts`  
Expected before implementation: failures; after implementation: pass.

### Task 8: REST and UI provenance surfaces

**Files:**
- Modify: `packages/shared/src/api/candidates.ts`
- Modify: `packages/shared/src/api/graphs.ts`
- Modify: `apps/api/src/application/mappers/candidate-mapper.ts`
- Modify: `apps/api/src/application/mappers/graph-mapper.ts`
- Modify: `apps/web/src/components/source-status-badge.tsx`
- Modify: `apps/web/src/features/workspace-pages.tsx`
- Modify: `apps/web/src/features/graph-canvas.tsx`
- Modify: `apps/web/src/features/workflow-actions.ts`
- Test: corresponding mapper/component/action tests.

**Interfaces:**
- Adds requested mode selector to run configuration.
- Adds non-dismissible mode banner and explicit source badges to Run, Candidates, Evidence,
  Workflow, and Reports.

- [ ] **Step 1: Write failing frontend and mapper tests**

Assert the exact text `OFFLINE SYNTHETIC DEMONSTRATION`, `scientificUse: false`, and the validated
binding disclaimer. Assert color is accompanied by visible text.

- [ ] **Step 2: Verify RED, implement surfaces, and verify GREEN**

Run the focused web and mapper tests. Expected before implementation: missing disclosure; after
implementation: all pass.

### Task 9: Real API-to-MCP integration tests

**Files:**
- Create: `apps/api/src/mcp-workflow.integration.test.ts`
- Modify: `apps/api/src/application/inline-fixture-workflow-port.integration.test.ts`
- Modify: `apps/api/src/application/application-services.integration.test.ts`

**Interfaces:**
- Proves real NitroStack discovery and HTTP tool calls.
- Proves synthetic, fixture, hybrid, deterministic replay, and fail-closed modes.

- [ ] **Step 1: Write failing end-to-end tests**

Start NitroStack on an ephemeral port, start Fastify with that MCP URL and a temporary SQLite DB,
create/approve/start runs, and verify persisted values—not only HTTP status codes.

- [ ] **Step 2: Verify RED, complete missing integration behavior, verify GREEN**

Run: `npx vitest run apps/api/src/mcp-workflow.integration.test.ts --testTimeout=90000`  
Expected: all execution modes and reproducibility assertions pass.

### Task 10: Documentation and completion verification

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MCP_SPEC.md`
- Modify: `docs/ALGORITHM_SPEC.md`
- Modify: `docs/API_SPEC.md`
- Modify: `docs/DATABASE_SCHEMA.md`
- Modify: `docs/DATA_SPEC.md`
- Modify: `docs/UI_UX_SPEC.md`
- Modify: `docs/OBSERVABILITY.md`
- Modify: `docs/SECURITY.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/TASKS.md`
- Modify: `docs/SPEC_VERSION.md`
- Modify: `.env.example`

- [ ] **Step 1: Document the implemented architecture and responsible-use boundary**

Add an accepted ADR for the real HTTP MCP boundary and synthetic demonstration execution. Remove
claims that fixture replay is the default. Preserve GraphBepi and no-conservation decisions.

- [ ] **Step 2: Run complete verification**

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm run format:check
npx vitest run --testTimeout=90000 --hookTimeout=90000
npm run build
```

Expected: every command exits zero; the end-to-end test confirms real API-to-MCP tool calls and
persisted scientific/demo provenance.

## Self-review

- Every attached requirement maps to Tasks 1-10.
- Synthetic execution is impossible without explicit disclosures.
- Existing REST routes remain unchanged.
- No conservation or toxicity work is included.
- Profile values are passed into MCP tools rather than duplicated in API code.
- Exact fixtures remain available but are no longer the default computation path.
- Real HTTP MCP integration is tested separately from injected unit-test gateways.
