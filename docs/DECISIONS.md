# Architecture Decision Records

Status values: `Accepted`, `Proposed`, `Superseded`.

## ADR-001 — Narrow the product to epitope prioritization

**Status:** Accepted  
**Decision:** The MVP maps one pathogen protein to a ranked epitope shortlist. Docking, antiviral discovery, protein folding, and construct design are excluded.  
**Why:** A single defensible pipeline is implementable, testable, and easier to evaluate than a broad discovery platform.  
**Consequence:** Future workflows require separate proposals; the current data model keeps extensible identifiers but no unused features.

## ADR-002 — Deterministic scientific decisions

**Status:** Accepted  
**Decision:** Validation, peptide generation, normalization, consensus, constraints, categorization, and ranking are pure deterministic modules.  
**Why:** Scientific decisions must be reproducible and independently testable.  
**Consequence:** LLM output is never an input to ranking or constraint evaluation.

## ADR-003 — Hybrid live/cache/fixture connectors

**Status:** Accepted  
**Decision:** Use live predictors as authoritative sources when available. Reuse exact cached live results. Use exact-match fixtures under an explicit fallback policy.  
**Why:** This preserves scientific relevance while guaranteeing a reliable offline demo.  
**Consequence:** Every result records `LIVE`, `CACHED`, `SYNTHETIC`, `FIXTURE`, or `FAILED`, and UI/export surfaces must display it. ADR-022 governs the explicitly non-scientific synthetic demonstration path.

## ADR-004 — Four domain MCP servers

**Status:** Superseded  
**Superseded by:** ADR-016  
**Decision:** Implement Prediction, Evidence, Constraint, and Report MCP servers.  
**Why:** These are stable domain boundaries with meaningful typed capabilities. One server per agent would create unnecessary coupling and deployment overhead.  
**Consequence:** Agents have allowlists across the four servers; the Fastify supervisor remains outside the MCP domain logic.

## ADR-005 — TypeScript npm-workspace monorepo

**Status:** Accepted  
**Decision:** Use npm workspaces with strict TypeScript for frontend, API, MCP, domain, algorithms, and database packages.  
**Why:** Shared schemas and end-to-end typing reduce translation errors and match NitroStack’s TypeScript-first design.  
**Consequence:** ESM imports include `.js` extensions in emitted-code import paths where NitroStack requires them.

## ADR-006 — React/Vite frontend

**Status:** Accepted  
**Decision:** Use React, Vite, Tailwind CSS, shadcn/ui, Recharts, and React Flow.  
**Why:** Fast local iteration, clear component boundaries, and suitable scientific workflow visualizations.  
**Consequence:** NitroStack widgets are not the primary researcher UI; MCP remains the backend capability interface.

## ADR-007 — Fastify REST boundary

**Status:** Accepted  
**Decision:** The React application calls a Fastify API. The API owns orchestration, persistence transactions, approval transitions, and client-safe view models.  
**Why:** The browser should not call scientific processes or SQLite directly.  
**Consequence:** MCP contracts and REST contracts are distinct but share domain schemas.

## ADR-008 — SQLite and Prisma

**Status:** Accepted  
**Decision:** Use Prisma with SQLite for the single-researcher MVP. Enable WAL mode during application startup.  
**Why:** Local setup is simple and sufficient for one writer with modest workflow volume.  
**Consequence:** No multi-instance API deployment; migration to PostgreSQL requires a later ADR.

## ADR-009 — No authentication in MVP

**Status:** Accepted  
**Decision:** Run as a trusted local single-researcher workspace without accounts. Bind to loopback by default.  
**Why:** Authentication is outside the agreed hackathon scope.  
**Consequence:** Remote exposure is unsupported unless an authenticated reverse proxy is added and reviewed.

## ADR-010 — Separate scientific ranking tracks

**Status:** Accepted  
**Decision:** Rank MHC-I, MHC-II, and B-cell candidates independently. Cross-track views are summaries, not a single leaderboard.  
**Why:** Predictor outputs represent different tasks and score semantics.  
**Consequence:** The UI uses track tabs and exports `candidateType` with every score.

## ADR-011 — Versioned rule and ranking profiles

**Status:** Superseded  
**Superseded by:** ADR-019  
**Decision:** Persist the complete rule and weight profile with each run. Profiles are immutable after run approval.  
**Why:** Reproducibility requires knowing exactly which thresholds and weights produced a decision.  
**Consequence:** Editing settings after approval creates a new run revision.

## ADR-012 — Asynchronous long-running operations

**Status:** Accepted  
**Decision:** Predictor tools support NitroStack task semantics where practical; the API represents the overall workflow asynchronously and supports cancellation.  
**Why:** Live predictions can take minutes and must not block HTTP requests.  
**Consequence:** Progress is reported through workflow events and streamed to the UI.

## ADR-013 — Append-only evidence and event history

**Status:** Accepted  
**Decision:** Scientific observations and workflow events are append-only. Corrections create new records linked by supersession metadata.  
**Why:** Auditability is lost when historical evidence is mutated in place.  
**Consequence:** Read models select the current valid record while exports include lineage.

## ADR-014 — Optional, grounded LLM explanations

**Status:** Accepted  
**Decision:** Explanation generation is optional. A deterministic template is the fallback and is always sufficient to complete a run.  
**Why:** The core product must work without an LLM or network access.  
**Consequence:** LLM provider/model selection remains deployment configuration, not domain logic.

## ADR-015 — No unsupported screen scraping

**Status:** Accepted  
**Decision:** Connectors use supported APIs, licensed local executables, or explicitly approved adapters.  
**Why:** Screen scraping is fragile and may violate service policies.  
**Consequence:** An unavailable supported integration produces `FAILED` or policy-approved fixture fallback.

## ADR-016 — One NitroStack MCP server with domain capability modules

**Status:** Accepted  
**Decision:** Implement one `immunograph-mcp` NitroStack server process containing Prediction, Evidence, Constraint, and Report capability modules.  
**Why:** The module boundaries preserve typed contracts and test isolation while a single process reduces package, startup, transport, and hackathon operations overhead.  
**Consequence:** Agents retain tool-level allowlists. The capability modules share one server lifecycle and common envelopes, but scientific logic remains in pure domain/algorithm packages and the Fastify supervisor remains outside MCP domain logic.

## ADR-017 — GraphBepi is fixture-only in the MVP

**Status:** Accepted  
**Decision:** Do not implement or attempt live GraphBepi execution during the MVP. Serve GraphBepi output only from exact-match, schema-valid, approved fixtures.  
**Why:** GraphBepi runtime and model dependencies create disproportionate hackathon integration risk.  
**Consequence:** GraphBepi can report only `FIXTURE` or `FAILED` in the MVP, is never written to the live-result cache, and requires a fallback policy that permits fixtures.

## ADR-018 — Defer conservation to Product Phase 2

**Status:** Accepted  
**Decision:** Remove conservation configuration, computation, constraints, ranking components, persistence fields, API fields, and UI views from the MVP.  
**Why:** Binding, consensus, population coverage, and completeness provide a smaller defensible MVP decision surface.  
**Consequence:** Adding conservation later requires a new specification version, algorithm/profile review, persistence migration, API/MCP contract changes, and an explicit Product Phase 2 ADR. This is unrelated to Phase 2 of the MVP implementation plan, which covers data and persistence.

## ADR-019 — File-backed immutable MVP profiles

**Status:** Accepted  
**Decision:** Store immutable profiles under `data/profiles/`. At workflow start, validate the selected files, compute each file's SHA-256 hash, and persist only profile `name`, `version`, and `hash` in the run's immutable configuration snapshot. Do not create profile-definition tables. Freeze MVP v1.0 T-cell weights at binding `0.40`, consensus `0.30`, population coverage `0.20`, and completeness `0.10`; freeze B-cell weights at GraphBepi `0.90` and completeness `0.10`.  
**Why:** File-backed profiles are reviewable and reproducible without duplicating immutable configuration definitions in SQLite.  
**Consequence:** `RuleProfile`, `WeightProfile`, and `BiologicalConstraint` are not Prisma models. Changing a profile requires a new versioned file; weight customization is disabled for MVP v1.0.

## ADR-020 — Positional candidate identity

**Status:** Accepted  
**Decision:** Define canonical candidate identity as `proteinHash | candidateType | start | end | peptide | allele`. Two records are duplicates only when every identity field matches.  
**Why:** The same peptide sequence can occur at biologically distinct coordinates and must remain independently traceable.  
**Consequence:** Duplicate detection preserves identical peptide sequences at different positions; only repeated records of the same positional candidate receive `DUPLICATE_OF` and `DUPLICATE-001` results.

## ADR-021 — Project-contextual navigation and frontend contract support

**Status:** Accepted  
**Decision:** Make Dashboard the project-portfolio home, remove global Current Run navigation, keep project analysis settings separate from read-only System Diagnostics, and extend existing REST contracts with server-computed portfolio totals, candidate search/warning filters, immutable output preferences, and safe fixture/build diagnostics.  
**Consequence:** The frontend never estimates workspace totals from a cursor page, never client-filters paginated scientific candidates, and never invents diagnostic or project configuration persistence.

## ADR-022 — MCP-first execution with explicit synthetic demonstration mode

**Status:** Accepted  
**Decision:** Replace the default inline fixture workflow with `ScientificWorkflowService`, which calls one separately running NitroStack MCP server over Streamable HTTP. Persist requested mode (`AUTO | LIVE | SYNTHETIC | FIXTURE`) separately from resolved mode (`LIVE | SYNTHETIC | FIXTURE | HYBRID`). Allow a deterministic synthetic fallback only in demo mode and mark every synthetic value `scientificUse=false` and `DEMONSTRATION_ONLY`. Preserve exact approved fixture replay as the final emergency fallback.  
**Why:** The hackathon must demonstrate complete MCP orchestration offline without presenting invented values as scientific predictions.  
**Consequence:** Synthetic provenance and disclaimers are mandatory in API responses, SQLite snapshots, evidence graphs, UI badges, explanations, and reports. GraphBepi remains fixture-only. Conservation and toxicity remain outside the frozen MVP.
