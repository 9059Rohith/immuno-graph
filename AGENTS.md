# ImmunoGraph Agent Guide

## Mission

Improve ImmunoGraph as transparent computational decision support. Never represent demonstration values as validated biology, a vaccine recommendation, trained-model accuracy, or a clinical result.

## Commands

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run dev
npm run verify
npm run docs:check
npm run test:e2e -- --project=judge-chromium
```

## Non-negotiable boundaries

- Preserve `LIVE`, `CACHED`, `SYNTHETIC`, `FIXTURE`, and `FAILED` exactly.
- Preserve `scientificUse=false` on demonstration data and exports.
- LLM output may explain stored evidence; it may not generate or mutate scores, constraints, rankings, provenance, approvals, or graph facts.
- Configuration and shortlist approvals are immutable, hash-bound human gates.
- Missing evidence must remain unavailable, partial, rejected, or failed.
- Fixed demonstration scoring coefficients are not trained or biologically validated models.
- Keep the public judge deployment free of private research data and credentials.

## Implementation requirements

Use strict Zod schemas at API/MCP boundaries, deterministic pure functions in `packages/algorithms`, repository interfaces for persistence, and focused tests before implementation. Preserve append-only evidence. Reuse existing UI primitives and source-status badges.

Before completion, run focused tests plus format, lint, typecheck, full tests, build, docs validation, and the affected Playwright projects. Record failures honestly; do not claim a deployment, screenshot, test result, or external validation that was not observed.
