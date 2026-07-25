# Local Scientific Data and Offline Fixture Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated, versioned local reference data and synthetic exact-match prediction fixtures, then make the approved fixture-only workflow produce persisted scientific decision-support records instead of returning dependency-unavailable placeholders.

**Architecture:** Reference facts and immutable profiles remain file-backed under `data/`; profile definitions are never stored in SQLite. A database-package loader validates schemas, verifies manifest hashes, and exposes typed records to API/MCP composition. Synthetic predictor and population outputs use the same public schemas as live results but are always marked `FIXTURE`, carry explicit synthetic provenance, require an exact protein/configuration match, and never enter the live cache. A local inline workflow adapter consumes fixture records, delegates scoring and constraints to `@immunograph/algorithms`, and persists results through repositories.

**Tech Stack:** TypeScript 5.9, Zod, Vitest, Prisma/SQLite, Fastify, NitroStack MCP, React/Vite, npm workspaces.

## Global Constraints

- Do not introduce `RuleProfile`, `WeightProfile`, or `BiologicalConstraint` database tables.
- Do not calculate or claim conservation in MVP v1.0.
- GraphBepi can return only `FIXTURE` or `FAILED` and can never populate `CacheEntry`.
- Every fixture selection must match protein SHA-256, track, method/version, allele set, peptide lengths, parameter hash, schema version, and run profile.
- No patient-level, clinical, identifiable, secret, or restricted source data may be committed.
- Restricted, license-unclear, or sensitive values must be schema-identical synthetic data labeled `SYNTHETIC` and `scientificUse: false`.
- Synthetic data must never be presented as `LIVE`, `CACHED`, fresh prediction, efficacy, validation, or a clinical result.
- All new behavior follows RED-GREEN-REFACTOR; production functions require a test that first fails for the expected reason.
- Algorithms remain pure: no filesystem, database, network, logging, or MCP imports.
- Public API and MCP contracts remain backward compatible.

---

### Task 1: Reference-data schemas, manifest, and hash-verifying loader

**Files:**
- Create: `packages/database/src/reference-validation.ts`
- Create: `packages/database/src/reference-loader.ts`
- Create: `packages/database/src/reference-loader.test.ts`
- Modify: `packages/database/src/index.ts`
- Create: `data/reference/manifest.v1.json`
- Create: `data/reference/amino-acids.v1.json`
- Create: `data/reference/fasta-validation-rules.v1.json`
- Create: `data/reference/hla-alleles.synthetic-v1.json`
- Create: `data/reference/normalization-profiles.v1.json`
- Create: `data/reference/connector-registry.v1.json`

**Interfaces:**
- Produces: `loadReferenceBundle(directory?): Promise<ReferenceBundle>`.
- Produces: `findHlaAllele(bundle, input): HlaAlleleRecord | null` with canonical-name and alias lookup.
- Produces: `validateHlaSelection(bundle, selection): HlaSelectionIssue[]` for class/method/length compatibility.
- Produces: `ReferenceBundle` containing manifest, amino acids, FASTA rules, HLA registry, normalization profiles, and connector registry.

- [ ] **Step 1: Write failing loader tests**

  Cover successful load; all 20 standard amino acids; ambiguous residues explicitly disallowed; HLA alias resolution; class/method/length compatibility; finite unit-interval synthetic frequencies; and rejection after one file byte or manifest hash is changed.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npx vitest run packages/database/src/reference-loader.test.ts`

  Expected: FAIL because `reference-loader.ts` and committed data files do not exist.

- [ ] **Step 3: Add strict Zod schemas and the loader**

  Parse every file as `unknown`, reject unknown fields, canonicalize JSON before SHA-256 verification, and reject duplicate IDs/alleles/aliases. Do not add filesystem access to `packages/algorithms`.

- [ ] **Step 4: Add reviewed public facts and synthetic aggregate values**

  Use source-backed amino-acid names and HLA nomenclature. Store only a small MVP allele subset. Any population frequency values must use `sourceKind: "SYNTHETIC"`, synthetic population IDs, `scientificUse: false`, and a local URN source; they are demo inputs only.

- [ ] **Step 5: Run the focused tests and verify GREEN**

  Run: `npx vitest run packages/database/src/reference-loader.test.ts packages/database/src/validation.test.ts`

  Expected: all tests pass; a tampered copied dataset fails with a hash mismatch.

### Task 2: Fixture schemas, exact matcher, and three deterministic demo cases

**Files:**
- Create: `packages/database/src/fixture-validation.ts`
- Create: `packages/database/src/fixture-loader.ts`
- Create: `packages/database/src/fixture-loader.test.ts`
- Modify: `packages/database/src/index.ts`
- Create: `data/schemas/reference-manifest.schema.json`
- Create: `data/schemas/prediction-observation.schema.json`
- Create: `data/schemas/fixture-case.schema.json`
- Create: `data/fixtures/manifest.v1.json`
- Create for each of `covid-spike`, `influenza`, and `dengue`: `input.fasta`, `case.json`, `expected-candidates.json`, `expected-report.json`

**Interfaces:**
- Produces: `loadFixtureRegistry(directory?): Promise<LoadedFixtureRegistry>`.
- Produces: `matchFixture(registry, query): FixtureCase | null`.
- Produces: `fixtureManifestSummary(registry)` for safe API diagnostics.

- [ ] **Step 1: Write failing exact-match and provenance tests**

  Assert that each case validates and matches its own protein/configuration. Change each match dimension independently and assert no match. Assert every observation has `sourceStatus: "FIXTURE"`, every synthetic payload declares `sourceKind: "SYNTHETIC"`, GraphBepi is never live/cached, and no case is selectable unless `reviewStatus` is `APPROVED`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npx vitest run packages/database/src/fixture-loader.test.ts`

  Expected: FAIL because the fixture registry and case files are absent.

- [ ] **Step 3: Add schemas and hash-verifying exact matcher**

  Canonicalize unordered allele/length/method sets before comparison, but never fuzzy-match a protein, profile, method version, parameters hash, or output schema version.

- [ ] **Step 4: Add three synthetic demo proteins and prediction payloads**

  Use strict 20-residue alphabet sequences, descriptive headers beginning with `SYNTHETIC_DEMO`, deterministic T-cell rows, fixture-only GraphBepi regions, synthetic coverage results, expected rankings, and the mandatory computational-only disclaimer. Names may describe the UI scenario, but metadata must state that sequences and scores are synthetic and not pathogen reference data.

- [ ] **Step 5: Compute and freeze manifest/content/replay hashes**

  Use the repository canonical JSON/hash helper. Do not hand-enter unchecked hashes.

- [ ] **Step 6: Run the focused tests and verify GREEN**

  Run: `npx vitest run packages/database/src/fixture-loader.test.ts packages/algorithms/src`

  Expected: all fixture integrity and algorithm regression tests pass.

### Task 3: Feed local references into FASTA and HLA validation

**Files:**
- Create: `apps/api/src/application/reference-data-service.ts`
- Create: `apps/api/src/application/reference-data-service.test.ts`
- Modify: `apps/api/src/application/services/project-service.ts`
- Modify: `apps/api/src/application/services/run-service.ts`
- Modify: `apps/api/src/application/create-services.ts`
- Modify: `apps/mcp/src/prediction/prediction.controller.ts`
- Modify: `apps/mcp/src/tool-catalog.test.ts`

**Interfaces:**
- Consumes: `ReferenceBundle` from Task 1.
- Produces: boundary validation options for `validateFasta` and domain errors `UNSUPPORTED_ALLELE`, `UNSUPPORTED_METHOD`, and `UNSUPPORTED_PEPTIDE_LENGTH`.

- [ ] **Step 1: Write failing API/MCP tests**

  Assert that the file-backed alphabet controls sequence validation; canonical aliases normalize; an unknown allele, class mismatch, unsupported method, or unsupported peptide length is rejected before a run is created; and HLA frequency absence is not converted to zero.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npx vitest run apps/api/src/application/reference-data-service.test.ts apps/mcp/src/tool-catalog.test.ts`

- [ ] **Step 3: Implement boundary injection**

  Load data once during composition, pass validated alphabet/limits into pure FASTA functions, and validate run selections in `RunService.create`. Do not read files inside pure algorithms or route handlers.

- [ ] **Step 4: Run tests and verify GREEN**

  Run: `npx vitest run apps/api/src/application/reference-data-service.test.ts apps/api/src/application/services/run-service.test.ts apps/mcp/src/tool-catalog.test.ts`

### Task 4: Local fixture capability port for MCP prediction and coverage tools

**Files:**
- Create: `apps/mcp/src/common/local-fixture-capability-port.ts`
- Create: `apps/mcp/src/common/local-fixture-capability-port.test.ts`
- Modify: `apps/mcp/src/prediction/prediction.module.ts`
- Modify: `apps/mcp/src/evidence/evidence.module.ts`
- Modify: `apps/mcp/src/app.module.ts`
- Modify: `apps/mcp/src/tool-catalog.test.ts`

**Interfaces:**
- Consumes: `LoadedFixtureRegistry` and a protein-reference resolver.
- Produces: `CapabilityPort.invoke()` support for `predict_mhci`, `predict_mhcii`, `predict_bcell_fixture`, `calculate_population_coverage`, and `optimize_shortlist_coverage` in fixture-permitting modes.

- [ ] **Step 1: Write failing real-tool tests**

  Call the actual controller methods with a matching fixture and assert non-empty observations/regions, deterministic values, and `FIXTURE` provenance. Assert mismatch returns the documented typed fixture error and GraphBepi never invokes cache/live branches.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npx vitest run apps/mcp/src/common/local-fixture-capability-port.test.ts apps/mcp/src/tool-catalog.test.ts`

- [ ] **Step 3: Implement and compose the port**

  Delegate all normalization, consensus, constraints, and ranking to `@immunograph/algorithms`. The capability adapter performs only reference resolution, exact fixture matching, and contract mapping.

- [ ] **Step 4: Run tests and verify GREEN**

  Run: `npx vitest run apps/mcp/src`

### Task 5: Inline offline workflow execution and persisted functional results

**Files:**
- Create: `apps/api/src/application/inline-fixture-workflow-port.ts`
- Create: `apps/api/src/application/inline-fixture-workflow-port.test.ts`
- Modify: `apps/api/src/application/create-services.ts`
- Modify: `apps/api/src/application/services/run-service.ts`
- Modify: `apps/api/src/application/application-services.integration.test.ts`

**Interfaces:**
- Consumes: repositories, transactions, EventService, fixture/reference loaders, and pure algorithms.
- Produces: `WorkflowExecutionPort` that asynchronously processes an exact fixture run from `RUNNING` to `AWAITING_SHORTLIST_APPROVAL`.

- [ ] **Step 1: Write a failing database-backed functional workflow test**

  Execute project creation, run creation, configuration approval, start, fixture completion, candidate query, evidence query, and ranking query. Assert persisted candidates, raw and normalized values, constraints, population coverage, ranks, replay hash, `FIXTURE_ONLY` quality, source status, events, and no `CacheEntry` rows.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npx vitest run apps/api/src/application/inline-fixture-workflow-port.test.ts --testTimeout=30000 --hookTimeout=60000`

- [ ] **Step 3: Implement minimal stage execution**

  Persist every stage/event transition, use positional candidate identity, evaluate constraints before final ranking, keep tracks separate, and fail closed on any manifest/hash/profile mismatch. The port must not duplicate formulas from the algorithms package.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `npx vitest run apps/api/src/application/inline-fixture-workflow-port.test.ts apps/api/src/application/application-services.integration.test.ts --testTimeout=30000 --hookTimeout=60000`

### Task 6: Diagnostics, seed data, frontend defaults, and documentation

**Files:**
- Modify: `apps/api/src/application/services/diagnostics-service.ts`
- Modify: `apps/api/src/application/services/diagnostics-service.test.ts`
- Modify: `packages/database/src/seed.ts`
- Modify: `packages/database/src/seed-support.ts`
- Modify: `packages/database/src/seed-support.test.ts`
- Modify: `apps/web/src/features/workspace-pages.tsx`
- Modify: `apps/web/src/features/workflow-actions.test.ts`
- Modify: `data/README.md`
- Modify: `data/reference/README.md`
- Modify: `data/fixtures/README.md`
- Modify: `docs/DATA_SPEC.md`
- Modify: `docs/LIMITATIONS.md`
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes: safe fixture manifest summary and exact synthetic demo FASTAs.
- Produces: runtime diagnostics with real fixture entries, a seed workspace using fixture inputs, and UI defaults matching `mvp-v1.0` profiles.

- [ ] **Step 1: Write failing diagnostics/seed/UI tests**

  Assert diagnostics list three approved fixtures without full sequences/payloads/paths; seed protein hashes equal committed fixture FASTAs; and the run form submits `mvp-v1.0` rather than the nonexistent `demo-v1` profile.

- [ ] **Step 2: Run tests and verify RED**

  Run: `npx vitest run apps/api/src/application/services/diagnostics-service.test.ts packages/database/src/seed-support.test.ts apps/web/src/features/workflow-actions.test.ts`

- [ ] **Step 3: Implement mappings and documentation**

  Keep diagnostics read-only and safe. Update task checkboxes only for behavior proven by tests. Document synthetic provenance and prohibit research interpretation.

- [ ] **Step 4: Run tests and verify GREEN**

  Run: `npx vitest run apps/api/src/application/services/diagnostics-service.test.ts packages/database/src/seed-support.test.ts apps/web/src/features/workflow-actions.test.ts`

### Task 7: Full functional verification

**Files:**
- Modify only if a verification-discovered defect has a reproducing test.

- [ ] **Step 1: Verify data integrity and offline scenarios**

  Run: `npm run test:fixtures` after adding the root script for the fixture, loader, MCP, and inline workflow suites.

- [ ] **Step 2: Verify database setup**

  Run: `npm run db:migrate`

  Run: `npm run db:seed`

- [ ] **Step 3: Run all quality gates with stable test budgets**

  Run: `npm run format:check`

  Run: `npm run lint`

  Run: `npm run typecheck`

  Run: `npm test -- --testTimeout=30000 --hookTimeout=60000`

  Run: `npm run build`

- [ ] **Step 4: Manually exercise one API workflow**

  Start the local stack, create a project using one committed synthetic fixture FASTA, approve/start the run, wait for shortlist review, and verify the UI/API exposes non-empty candidates, evidence, rankings, coverage, workflow events, fixture provenance, and connector diagnostics. Capture any defect as a failing automated test before fixing it.

## Plan self-review

- Scope is limited to small local data, deterministic fixture execution, and the minimum composition needed to make it functional.
- No live connector, conservation, authentication, profile table, model training, or clinical claim is introduced.
- Reference, fixture, API, MCP, persistence, UI-default, and functional E2E requirements each map to a task.
- All cross-task interfaces use existing public contracts or additive internal interfaces.
- No predictor score is claimed to originate from IEDB, MHCflurry, or GraphBepi; synthetic provenance is explicit even when the fixture emulates their output shape.
