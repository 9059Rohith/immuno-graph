# ImmunoGraph Hackathon Top-Tier Submission Design

**Date:** 2026-08-03  
**Primary track:** Track 4 — Domain Agents  
**Secondary strengths:** Building Evals; AI for Societal Good  
**Submission objective:** Make ImmunoGraph pass the hackathon viability gate without credentials, communicate its originality in under one minute, and prove a complete, reproducible scientific decision-support workflow in under three minutes.

## 1. Product position

ImmunoGraph is an MCP-native scientific decision-support agent that turns a pathogen protein sequence into an auditable epitope shortlist without allowing an LLM to invent biological evidence. It coordinates typed scientific tools, deterministic rules, explicit fallback policies, provenance tracking, uncertainty disclosure, and researcher approval.

The project will be submitted as a Domain Agent because its main value is automating a real computational-immunology workflow. Evaluation and safety features support that story; they do not change the primary track.

The submission must never claim vaccine discovery, clinical validity, experimentally validated predictions, or trained-model accuracy unless the repository contains reproducible evidence for the claim.

## 2. Success criteria

A first-time judge can:

1. open the deployed Vercel URL without credentials;
2. understand the problem and product within 20 seconds;
3. enter a seeded Judge Mode in one click;
4. run or replay the curated dengue workflow without an API key;
5. observe MCP stages, provenance, fallback behavior, and human approval gates;
6. inspect why a candidate was recommended, held for review, or rejected;
7. approve a shortlist and download a reproducibility artifact;
8. inspect a trust/evaluation summary proving determinism and fixture integrity;
9. complete the core demonstration in less than three minutes.

The repository passes typecheck, lint, formatting, unit/integration tests, production build, desktop E2E, mobile E2E, internal-link validation, and deployment smoke checks. Remaining dependency advisories must either be fixed or documented with applicability and mitigation.

## 3. Scope and priorities

### P0 — eligibility and viability

- Credential-free Judge Mode with a seeded, resettable workspace.
- Complete end-to-end sequence-to-report flow.
- Production deployment configuration for Vercel web plus Render API and MCP services.
- A judge-first README with live-demo, video, track, architecture, Codex evidence, safety, and verification sections.
- Removal of broken commands, broken links, contradictory claims, malformed environment examples, and misleading model terminology.
- CI that verifies formatting, lint, typecheck, tests, and build.
- MIT license and repository-level agent guidance.

### P1 — scoring differentiators

- A Scientific Trust Center summarizing source provenance, execution policy, deterministic checks, uncertainty, approval history, and artifact hashes.
- An evaluation summary derived from real repository fixtures and deterministic checks, not invented percentages.
- A visible MCP activity timeline that reports tool, stage, status, duration, source, and fallback reason using actual workflow data.
- A deliberate abstention example showing that strong binding evidence does not bypass disagreement or completeness rules.
- Focused visual polish across the opening viewport and core judge path.

### Explicit non-goals

- No new general-purpose chatbot.
- No additional unrelated scientific modules.
- No fabricated wet-lab, accuracy, clinical, or impact statistics.
- No history rewriting or artificial commits.
- No complex production identity system for the public hackathon demo.
- No framework migration.
- No trained ML/DL claim for inline deterministic scoring weights.

## 4. Judge experience and information architecture

### Public entry

The default `/` route becomes a concise product landing and judge entry surface. It contains only:

- ImmunoGraph name and one-sentence value proposition;
- Track 4 — Domain Agents;
- primary `Launch judge demo` action;
- three proof points: deterministic evidence, MCP orchestration, reproducible approval;
- a prominent research-use disclaimer.

The first viewport must not contain decorative dashboards, invented metrics, or multiple competing calls to action.

### Judge Mode

`Launch judge demo` calls `POST /api/v1/demo/start`, which creates a new project and draft run from the curated dengue case without asking for a name, email, or password. The response returns the new `projectId` and `runId`; the browser stores only these opaque IDs in `sessionStorage` and redirects to the real project overview. A `Reset demo` confirmation calls the same endpoint and starts a new clean workspace.

Judge Mode is visibly labelled as public demonstration data. It must not suggest privacy, tenancy, or persistence guarantees. The existing login/signup screens are removed from the judge-facing navigation because the current data model does not associate projects with users. Authentication can return only after project ownership and authorization are implemented and tested end to end.

### Guided demo rail

The application shell includes a compact judge-progress rail for the demo workspace:

1. Review input
2. Confirm configuration
3. Run analysis
4. Inspect evidence
5. Approve shortlist
6. Export report

Each step links to the existing real screen and derives completion from API state. It does not fake workflow progress.

### Primary navigation

The judge path emphasizes Dashboard, Workflow, Candidates, Evidence, Trust Center, and Reports. Structures and Docking are removed from Judge Mode navigation, remain available by direct route for repository continuity, and display an `Experimental — outside the judged workflow` notice. They are not part of the three-minute core story.

## 5. Scientific Trust Center

The Trust Center is a read-only view backed by a new shared `trustSummarySchema` and `GET /api/v1/runs/:runId/trust-summary` endpoint. The API assembles the response from existing runtime, run, event, candidate, evidence, fixture-manifest, approval, and artifact repositories plus pure deterministic evaluation functions in `packages/algorithms`.

It displays:

- requested and resolved execution mode;
- connector/source status counts for `LIVE`, `CACHED`, `SYNTHETIC`, `FIXTURE`, and `FAILED`;
- predictor/tool names, versions, and parameters when available;
- fixture manifest and configuration identifiers;
- input/configuration/output hashes;
- candidate disagreement, completeness, and constraint status summaries;
- configuration and shortlist approval events;
- generated artifact hashes;
- deterministic replay/evaluation results;
- explicit scientific-use and demonstration-only notices.

Every score or status shown must be computed from actual data. Empty evidence is displayed as unavailable, never as zero.

## 6. Evaluation design

The evaluation surface uses the existing curated fixtures and deterministic algorithms. It must expose named checks with boolean or measured results:

- fixture manifest validation;
- deterministic predictor replay for the selected demo case;
- candidate ranking stability;
- source-provenance completeness;
- constraint safety: rejected candidates cannot be approved;
- approval gate: report generation requires shortlist approval;
- artifact hash presence;
- expected disagreement/abstention example;
- workflow completion duration.

The evaluation result is a transparent list of checks, not a vague trust percentage. If a check is unavailable, the UI says why.

## 7. Model and terminology correction

The inline logistic and MLP calculations are deterministic demonstration scoring heads with versioned weights. Because the repository has no documented training dataset or validation experiment, UI and documentation must not call them trained ML/DL binding models or imply biological accuracy.

They may be described as:

> Two deterministic demonstration scoring heads over peptide/HLA features, ensembled to exercise model-integration and uncertainty plumbing. They are not experimentally validated biological predictors.

Scientific results continue to prefer identified live predictors, exact cached outputs, and curated fixtures according to the execution policy.

## 8. Application architecture

The existing monorepo boundaries remain:

```text
Vercel
  React/Vite web application
        |
        | HTTPS API requests
        v
Render API service
  Fastify application + Prisma/SQLite + artifacts
        |
        | Streamable HTTP MCP
        v
Render MCP service
  Prediction | Evidence | Constraint | Report tools
```

No client imports database, connector, or secret-bearing code. The API owns demo-project creation and project mutation. The MCP service remains separately deployable and validates every tool boundary.

### Deployment persistence

The Render API service mounts a persistent disk at `/data` and uses:

```env
DATABASE_URL=file:/data/immunograph.db
ARTIFACT_ROOT=/data/artifacts
```

The MCP service is stateless. Demo mode defaults to deterministic synthetic/fixture behavior so the public demo does not depend on optional scientific services.

### Cross-origin behavior

The web API base URL is supplied through `VITE_API_BASE_URL`. The Vercel application calls the Render API directly over HTTPS. Fastify uses `@fastify/cors` and accepts only the comma-separated origins in `CORS_ORIGINS`; production configuration contains the exact Vercel origin. Judge Mode sends no cookies and therefore does not depend on third-party-cookie behavior. State-changing demo calls use opaque UUID resources, strict Zod bodies, request-size limits, and endpoint rate limits.

## 9. Demo workspace and data isolation

Each demo launch creates a new UUID project and run containing only curated demonstration data. `Project` gains `isDemo Boolean @default(false)` and nullable `demoExpiresAt DateTime`; an index on `(isDemo, demoExpiresAt)` supports bounded cleanup. Demo projects set `isDemo=true` and expire 24 hours after creation. The browser keeps the returned opaque identifiers for the current tab session. Reset creates a new clean workspace rather than mutating another judge's workspace. Dashboard queries in Judge Mode are scoped in the client to the current demo project instead of displaying all public demo projects.

Production safeguards:

- rate-limit demo entry and reset endpoints;
- cap demo projects and artifacts;
- never expose password hashes, provider tokens, or unrestricted filesystem paths;
- label public and best-effort retention behavior in the UI;
- provide `npm run demo:cleanup` for deleting demo projects older than 24 hours, and document an optional Render cron job for that command;
- keep all non-demo research data out of the public hackathon deployment.

The hackathon deployment is explicitly a public demonstration environment, not a production research-data service. Shortlist approval and artifact generation remain real operations against each generated demo project.

## 10. Error handling and fallback behavior

- Public entry failures show a retry action and local-run instructions, not a blank screen.
- Missing optional connectors do not block Judge Mode.
- Synthetic and fixture paths remain conspicuously labelled.
- A failed workflow stage preserves completed evidence and exposes the typed failure reason.
- Trust checks distinguish `failed`, `unavailable`, and `not applicable`.
- Report/export actions explain unmet approval requirements.
- Deployment health endpoints remain independent from the authenticated application UI.

## 11. README and submission documentation

The root README is rewritten in this order:

1. title, one-line pitch, Track 4 label;
2. live demo and three-minute video links;
3. `Launch judge demo` instructions;
4. problem and focused outcome;
5. why ImmunoGraph is original;
6. three-minute product walkthrough;
7. screenshots;
8. system and MCP architecture;
9. deterministic scientific and safety boundaries;
10. Scientific Trust Center and evaluation evidence;
11. how Codex built the project, with links to specifications, plans, review, and verification artifacts;
12. verified test/build results;
13. local development;
14. Vercel + Render deployment;
15. repository map;
16. limitations and authoritative scientific sources;
17. license.

The repository also gains:

- `AGENTS.md` with commands, boundaries, and verification requirements;
- `LICENSE` using the MIT text;
- a concise Codex build log using genuine repository artifacts;
- a deployment guide with exact Vercel and Render steps;
- a demo-video script and submission checklist.

Links supplied only after deployment or recording are represented through a clearly documented environment/submission metadata mechanism; the README must not contain fake live URLs.

## 12. Testing and verification

### Automated tests

- unit tests for demo-project creation/cleanup logic and evaluation checks;
- API integration tests for credential-free demo entry, unique workspace creation, rate limits, and failure envelopes;
- contract tests for any new Trust Center response;
- UI tests for public entry, guided rail, Trust Center states, and terminology;
- Playwright desktop and mobile tests for the full judge journey;
- a deployment-origin test that exercises the web against a separately hosted API origin or proxy;
- internal Markdown link and README command validation;
- environment example validation;
- existing 311 tests remain green.

### Quality gates

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

Docker and hosted smoke checks validate web, API readiness, MCP health, demo entry, workflow completion, and report download.

### Visual verification

The opening viewport, public entry, dashboard, workflow, candidate evidence, Trust Center, and report completion state are checked at desktop and mobile sizes. Verification includes keyboard focus, horizontal overflow, loading/error states, typography, source-status color semantics, and screenshot review.

## 13. Delivery sequence

1. Establish truthful contracts, demo mechanism, and deployment topology.
2. Implement credential-free Judge Mode with tests.
3. Implement the real guided journey and complete E2E test.
4. Implement Trust Center/evaluation checks with tests.
5. Focus navigation and polish the judge-facing UI.
6. Repair dependencies, environment files, documentation contradictions, links, formatting, license, and CI.
7. Rewrite README and create submission/demo assets.
8. Deploy Render MCP and API, then Vercel web.
9. Run hosted smoke tests and record the three-minute demo.
10. Complete the BlockseBlock submission checklist and only then use Final Submit.

## 14. Acceptance gate

The implementation is ready for submission only when:

- the public URL opens without credentials;
- the seeded demo completes end to end twice from a clean reset;
- every visible scientific claim has provenance or an explicit limitation;
- the full automated quality gate passes;
- desktop and mobile screenshots show no material visual defects;
- README links and commands are valid;
- the public repository matches the deployed revision;
- the video and Google Doc are publicly accessible;
- the BlockseBlock project is still editable until all links are verified.
