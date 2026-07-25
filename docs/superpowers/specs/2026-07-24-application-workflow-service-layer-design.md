# Application and Workflow Service Layer Design

**Status:** Frozen and approved  
**Date:** 2026-07-24  
**Scope:** Integration of the existing Fastify REST boundary with the existing Prisma repositories and explicit ports for capabilities that are absent from the repository.

## 1. Objective

Replace the process-wide `unavailableRestApiServices` placeholder with a concrete application layer. The application layer is the only orchestration boundary between Fastify, persistence, workflow execution, report generation, connector diagnostics, artifacts, and SSE delivery.

This work is integration, not redesign. Existing endpoint paths, request schemas, response schemas, frontend behavior, deterministic algorithms, MCP tool contracts, and the Prisma schema remain unchanged.

## 2. Verified repository baseline

The repository contains:

- strict Fastify route validation and all documented REST paths;
- Prisma models, migrations, validation schemas, and repository classes;
- deterministic algorithms;
- one NitroStack server with Prediction, Evidence, Constraint, and Report tool groups;
- shared REST response schemas;
- a React frontend that consumes those schemas.

The repository does not contain:

- a workflow DAG scheduler or execution engine;
- an API-to-MCP client or selected transport;
- live predictor connector implementations;
- approved scientific fixture payloads;
- an artifact generator;
- a configured connector registry.

The service layer must not fabricate these missing capabilities. They are represented by injected ports and produce a documented dependency error when absent.

## 3. Architecture

```text
Fastify routes
    |
ConcreteRestApiServices
    |
    +-- ProjectService
    +-- RunService -------- WorkflowExecutionPort
    +-- CandidateService
    +-- EvidenceService
    +-- ReportService ----- ReportGenerationPort
    +-- DiagnosticsService - ConnectorDiagnosticsPort
    +-- EventService
    |
API DTO mappers
    |
Existing repository classes and transaction-bound repository factory
    |
Prisma + SQLite
```

Fastify routes continue to validate transport input, enforce HTTP idempotency, select status codes, and serialize the response envelope. They contain no application or scientific business logic.

`ConcreteRestApiServices` implements the existing `RestApiServices` interface and performs operation dispatch only. Each focused service owns its domain workflow and returns existing API DTOs through pure mappers.

## 4. Application services

### 4.1 ProjectService

Operations:

- `projects.create`
- `projects.list`
- `projects.get`
- `projects.delete`

Behavior:

- Reuse the deterministic FASTA validator and canonical hashing implementation.
- Create a `Project` and its `ProteinInput` in one transaction.
- Return metadata only; never echo the full sequence.
- List projects with cursor pagination ordered by `updatedAt` descending and a stable ID tie-breaker.
- Compute portfolio totals from the complete workspace rather than the returned page.
- Retrieve project metadata, the current protein input, ordered run summaries, and latest approval state.
- Require exact project-name confirmation before deletion.
- Coordinate database deletion and contained artifact deletion without accepting a client path.

There is no project-settings update REST endpoint. Analysis settings and output preferences remain immutable run configuration data.

### 4.2 RunService

Operations:

- `runs.create`
- `runs.get`
- `runs.approveConfiguration`
- `runs.start`
- `runs.cancel`
- `runs.retryStage`
- `runs.approveShortlist`

Behavior:

- Create the next project-local revision transactionally.
- Load the selected immutable files from `data/profiles`, validate them, and compute SHA-256 metadata.
- Store the existing REST configuration plus file-backed profile metadata in `configurationJson`.
- Compute `configurationHash` from canonical JSON.
- Persist new runs as `DRAFT` and expose `CONFIGURATION` as an approval requirement.
- Verify configuration and ranking hashes before approval.
- Write approvals, lifecycle transitions, and workflow events atomically.
- Invoke `WorkflowExecutionPort` for start, cancellation, and retry.
- Never calculate predictions, evidence, constraints, or rankings.

### 4.3 CandidateService

Operations:

- `candidates.list`
- `candidates.get`
- `candidates.compare`
- `coverage.get`
- `coverage.getShortlistOptimization`

Behavior:

- Query only persisted workflow results.
- Perform pagination, track/category/source/allele/score filtering, candidate-ID and peptide search, and warning filtering in SQLite.
- Preserve the stored track-specific rank.
- Map missing scientific values to the existing unavailable representation, never zero.
- Build comparison responses by aligning stored ranking components and constraint outcomes.
- Reject cross-track comparisons.
- Return stored singleton/set coverage and shortlist-optimization results.

Shortlist approval remains in `RunService` because it changes approval and lifecycle state. Candidate eligibility is verified against stored category, snapshot, and run membership.

### 4.4 EvidenceService

Operations:

- `graphs.evidence`
- `graphs.workflow`
- `visualizations.get`

Behavior:

- Map stored `GraphNode` and `GraphEdge` records without inventing relationships.
- Restrict evidence neighborhoods by run, optional candidate, and depth.
- Map persisted workflow stages and dependency keys into the existing workflow graph DTO.
- Produce sequence-map, population-coverage, constraint-summary, score-distribution, and connector-status DTOs only from stored records.
- Apply deterministic display geometry only where already required by an existing response contract; no scientific layout or scoring is performed.

### 4.5 ReportService

Operations:

- `explanations.generate`
- `reports.create`
- `artifacts.list`
- artifact download

Behavior:

- Require approved shortlist state before report generation.
- Require report options to match the immutable run output preferences.
- Delegate generation to `ReportGenerationPort`.
- Use the deterministic explanation algorithm for deterministic mode.
- Treat optional LLM mode as unavailable unless a configured provider exists; deterministic text remains authoritative.
- List stored artifact metadata.
- Resolve database-owned relative paths beneath the configured artifact root.
- Reject missing, escaping, directory, size-mismatched, or hash-mismatched artifacts.
- Return streams and safe metadata to the existing Fastify download route.

### 4.6 DiagnosticsService

Operations:

- `connectors.list`
- `connectors.health`
- `settings.profiles`
- `settings.runtime`

Behavior:

- Remain read-only.
- Return configured connector descriptors and health from `ConnectorDiagnosticsPort`.
- Return empty connector lists when no registry is configured; do not invent connectors.
- Load and hash approved profile files.
- Report database and artifact-root health without exposing paths.
- Report an empty, versioned fixture manifest while no approved fixture payloads exist.
- Return application/specification/build metadata without secrets.

### 4.7 EventService

Operations:

- `events.history`
- `streamRunEvents`

Behavior:

- Persist every application lifecycle event as a `WorkflowEvent`.
- Allocate `sequenceNumber` transactionally per run.
- Use the decimal sequence number as the SSE `id`.
- Resume strictly after `Last-Event-ID`.
- Read replay history from SQLite and use an in-process notifier only to wake active streams after commits.
- Close subscriptions on client disconnect.
- Represent queued, running, completed, and failed lifecycle updates using the existing `run.status_changed` event and status in `data`.

## 5. Capability ports

### WorkflowExecutionPort

Owns the boundary to a future workflow supervisor and API-to-MCP transport. It supports availability assertion, start, cancellation, and stage retry. A configured implementation may persist scientific outputs only through repository-backed application integration. The default unavailable implementation throws a typed dependency error before lifecycle state is changed.

### ReportGenerationPort

Owns deterministic artifact creation outside the REST service. It accepts an approved run and immutable output preferences and returns artifact-job metadata using the existing response contract. The default unavailable implementation returns a typed dependency error.

### ConnectorDiagnosticsPort

Owns connector descriptors and health checks. The default implementation returns an empty descriptor and health set because no registry exists. It never implies that an unconfigured connector is live.

## 6. Repository integration

Existing repository classes remain the persistence boundary. They will be extended with the missing operations rather than bypassed or duplicated:

- project listing, counting, and controlled deletion;
- protein lookup for a project;
- run lookup, revision allocation, lifecycle transitions, and workspace counts;
- event sequence allocation and paginated replay;
- stage lookup and retry queries;
- candidate server-side filtering, comparison inputs, and counts;
- graph neighborhood queries;
- artifact lookup and counts;
- approval lookup by type and snapshot.

A transaction-bound repository factory will accept Prisma transaction clients. Application services use it for atomic commands. Read-model methods may use typed Prisma includes/selects inside repository implementations but never inside Fastify routes.

## 7. DTO mapping

Pure mapper modules translate repository read models into the existing shared DTOs. Each top-level mapper validates its result using the corresponding shared Zod response schema before returning it.

Mappers must:

- convert dates to UTC ISO strings;
- parse JSON columns through focused internal schemas;
- preserve `LIVE`, `CACHED`, `FIXTURE`, and `FAILED` provenance;
- distinguish run status from run quality;
- derive approval requirements from stored lifecycle and approvals;
- never expose full FASTA, filesystem paths, or unbounded provider payloads;
- never compute a scientific score or relation.

## 8. Transactions and lifecycle

Atomic command boundaries:

1. project and protein creation;
2. run revision and initial state creation;
3. configuration approval, `QUEUED` transition, and event insertion;
4. accepted workflow start transition and event insertion;
5. cancellation transition and event insertion;
6. retry attempt creation and event insertion;
7. shortlist approval, lifecycle transition, and event insertion.

The state machine enforces:

```text
DRAFT -> QUEUED -> RUNNING -> AWAITING_SHORTLIST_APPROVAL -> COMPLETED
                    |                                  |
                    +-> FAILED/CANCELLED               +-> CANCELLED
```

The database schema also supports `AWAITING_CONFIGURATION_APPROVAL`; draft creation continues to use `DRAFT` because the REST specification calls the created resource a draft run. Disabled stages remain `SKIPPED`.

## 9. Error mapping

Application and dependency errors carry code, HTTP status, retryability, and optional field errors. The central Fastify error handler remains responsible for envelopes.

Mappings:

- missing project/run/candidate/stage → `404 RESOURCE_NOT_FOUND`;
- missing artifact → `404 ARTIFACT_NOT_FOUND`;
- stale configuration → `409 CONFIGURATION_CHANGED`;
- stale ranking → `409 RANKING_CHANGED`;
- unapproved start → `409 RUN_NOT_APPROVED`;
- duplicate start → `409 RUN_ALREADY_STARTED`;
- terminal cancellation → `409 RUN_ALREADY_TERMINAL`;
- invalid retry → `409 STAGE_NOT_RETRYABLE`;
- ineligible shortlist candidate → `422 CANDIDATE_NOT_APPROVABLE`;
- report without approval → `422 REPORT_REQUIRES_APPROVAL`;
- missing selected profile → `422 PROFILE_NOT_FOUND`;
- unavailable workflow/report dependency → `503 SERVICE_UNAVAILABLE`;
- unexpected failures → `500 INTERNAL_ERROR`.

Prisma error codes are translated at the application boundary. Raw database errors, paths, sequences, and provider payloads are never returned.

## 10. Existing data inconsistencies

The seed uses non-UUID identifiers while the REST contract requires UUIDs. Seed identifiers will be changed to deterministic UUIDs without changing the Prisma schema.

The REST example and frontend default request profile version `demo-v1`, while the only immutable profile files are `mvp-v1.0`. The service fails closed with `422 PROFILE_NOT_FOUND`; it does not silently alias scientific profiles. Aligning the example/frontend default is a separate contract/frontend change and is excluded from this implementation.

## 11. Testing strategy

Tests use temporary SQLite databases, real repositories, and injected fake capability ports.

Required integration coverage:

- project and protein creation are atomic;
- project listing and portfolio totals cover the complete workspace;
- project retrieval maps runs and approvals;
- run revision creation hashes immutable configuration and profile metadata;
- configuration approval rejects stale hashes and atomically queues the run;
- a fake workflow port receives start/cancel/retry and lifecycle events persist;
- unavailable workflow/report ports return `503` without partial state;
- candidate pagination, filters, search, warning filters, detail, and comparison use stored data;
- evidence/workflow graphs contain only stored relations/stages;
- report approval gating and artifact metadata work;
- artifact download enforces containment, size, and hash checks;
- diagnostics expose safe profile/build/runtime data;
- SSE replay is ordered and resumes after `Last-Event-ID`;
- all existing route, MCP, algorithm, repository, and frontend tests remain unchanged and passing.

## 12. Completion boundary

This implementation is complete when the API starts with `ConcreteRestApiServices`, no production reference to `unavailableRestApiServices` remains, all database-backed operations function, absent capabilities fail only at their explicit ports, and all quality gates pass.

This implementation does not claim to provide scientific workflow execution, live prediction, fixture prediction, or report generation until their missing engines/data/providers are separately implemented and injected.
