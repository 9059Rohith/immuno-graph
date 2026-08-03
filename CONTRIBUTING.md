# Contributing to ImmunoGraph

## Before changing code

Read the [product specification](docs/PROJECT_SPEC.md), [architecture](docs/ARCHITECTURE.md), [coding guidelines](docs/CODING_GUIDELINES.md), [security model](docs/SECURITY.md), and [responsible-use boundary](docs/LIMITATIONS.md). Scientific semantics must not change through code alone.

Use Node.js 20.19.x and npm 10.x. Never commit `.env` files, research sequences, SQLite databases, generated artifacts, licensed binaries, downloaded model weights, or credentials.

## Setup

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

## Required quality gate

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run docs:check
```

Run the credential-free browser path for UI, API, workflow, or deployment changes:

```bash
npm run test:e2e -- --project=judge-chromium
```

## Pull requests

Keep commits focused and include the affected specification, tests run, UI screenshots when relevant, API/MCP contract examples, migration notes, and security/privacy impact.

Before review, confirm:

- scientific values never come from an LLM;
- new boundaries use strict Zod contracts;
- source status and `scientificUse` survive every transformation;
- insufficient evidence remains unavailable, partial, rejected, or failed;
- configuration and shortlist approvals cannot be bypassed;
- UI changes have loading, empty, failure, keyboard, and narrow-width behavior;
- docs contain no fake URLs, accuracy claims, or secrets.

## Scientific rules, connectors, and fixtures

Algorithm or threshold changes require a new immutable profile version, rationale and source, unit vectors, fixture/golden review, and impact on recommended/review/rejected candidates. Never reuse a profile version for changed semantics.

New connectors must document interface and license restrictions, version discovery, supported inputs, timeout/retry behavior, cache keys, provenance mapping, health checks, captured redacted samples, and failure/fallback tests. Screen scraping is not accepted.

Fixtures may contain only publicly distributable or team-owned demonstration inputs—never patient or clinical data. Record license, review status, transformation, SHA-256, and replay hash. Demo evidence must remain visibly synthetic or fixture-backed.

## Database and security

Create and commit named Prisma migrations; test empty and prior-schema migration paths; preserve append-only evidence lineage. Do not use `prisma db push` as a migration substitute.

Report vulnerabilities privately to the repository owner. Public issues must contain only sanitized identifiers and logs, never proprietary inputs or credentials.
