# Contributing to ImmunoGraph

## 1. Before contributing

Read:

1. [PROJECT_SPEC.md](PROJECT_SPEC.md)
2. [ARCHITECTURE.md](ARCHITECTURE.md)
3. [CODING_GUIDELINES.md](CODING_GUIDELINES.md)
4. The specification for the component being changed
5. [LIMITATIONS.md](LIMITATIONS.md)

Scientific semantics must not be changed through code alone.

## 2. Development prerequisites

- Node.js version supported by the root `engines` field.
- npm version in the root `engines` field.
- SQLite runtime supported by Prisma.
- NitroStudio for interactive MCP testing.
- Optional licensed/local scientific predictor runtimes only when configuring those connectors.

## 3. Setup

Once implementation exists:

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

On PowerShell, create `.env` through the editor or `Copy-Item .env.example .env`.

Never commit `.env`, database files, generated artifacts, licensed binaries, or downloaded model weights.

## 4. Branches and commits

Create a short-lived branch from the current integration branch:

```text
feat/fixture-resolver
fix/overlap-boundary
docs/mcp-contracts
test/dengue-regression
```

Use focused conventional commits:

```text
feat(evidence): add registered inverse-percentile normalization
fix(constraints): preserve allele boundary during overlap pruning
test(fixtures): add dengue replay expectations
docs(api): define stale approval conflict
```

Do not combine unrelated refactors, dependency upgrades, and scientific changes in one pull request.

## 5. Local quality checks

Before requesting review:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run focused suites for migrations, fixtures, MCP contracts, and UI when affected.

## 6. Pull-request requirements

Include:

- problem and approach;
- affected specification sections;
- test commands and results;
- screenshots for UI changes;
- before/after contract examples for API/MCP changes;
- data source/license/reviewer details for scientific data changes;
- migration and rollback notes for schema changes;
- security/privacy impact.

### PR checklist

- [ ] Change is inside current scope.
- [ ] No scientific value comes from an LLM.
- [ ] Zod schemas cover new boundaries.
- [ ] Provenance status is preserved.
- [ ] Tests include failures and edge cases.
- [ ] Documentation is updated.
- [ ] No secrets, full research inputs, database, artifacts, or licensed binaries are committed.
- [ ] UI is keyboard accessible and does not rely on color alone.
- [ ] Errors use stable codes.
- [ ] Logs are bounded and redacted.

## 7. Changing algorithms or scientific rules

Required sequence:

1. Propose the change in `ALGORITHM_SPEC.md`.
2. Explain scientific rationale and source.
3. Add or revise an ADR if architecture/scope changes.
4. Create a new immutable normalization/rule/ranking profile version.
5. Add unit vectors and update golden fixtures through review.
6. Show effect on recommended/review/rejected results.
7. Obtain domain review before marking the profile suitable for non-demo use.

Never silently change a default threshold or reuse a profile version for changed semantics.

## 8. Adding a scientific connector

Provide:

- supported programmatic interface or executable path;
- license and usage restrictions;
- method/version discovery;
- supported alleles, lengths, and parameters;
- timeout, rate-limit, retry, and cancellation behavior;
- parser and captured redacted responses;
- Zod output contract;
- normalization registry entries;
- cache-key fields;
- health check;
- contract tests and fallback tests;
- UI provenance label.

Unsupported screen scraping is not accepted.

## 9. Contributing fixtures/reference data

- Use publicly distributable or team-owned demo inputs.
- Do not add patient/clinical data.
- Record source, license, retrieval date, transformation, reviewer, and SHA-256.
- Keep raw prediction values and expected derived values separate.
- Mark fixture evidence clearly.
- Update manifest and replay hashes.
- Two-person review is preferred for expected scientific decisions.

## 10. Database changes

- Edit Prisma schema.
- Create and commit a named migration.
- Test migration from empty and previous schema.
- Preserve append-only evidence lineage.
- Document backup/rollback implications.
- Do not use `prisma db push` as a substitute for migration.

## 11. UI changes

- Use existing shadcn/ui primitives and semantic tokens.
- Provide loading, empty, partial, error, and keyboard states.
- Keep unlike scientific tracks separate.
- Show connector provenance on any new evidence surface.
- Add chart/graph text or table alternative.
- Attach screenshots at desktop and narrow width.

## 12. Reporting bugs

Include sanitized steps, expected/actual behavior, error code, relevant run/stage IDs, connector/method/version, source status, and logs with sequences/secrets removed.

Do not upload proprietary research sequences or credentials to a public issue.

## 13. Review priorities

Review in this order:

1. scientific correctness and scope;
2. provenance and failure honesty;
3. deterministic behavior and tests;
4. security and data integrity;
5. maintainability;
6. user experience.

## 14. Definition of done

A contribution is complete when its implementation, tests, observability, error behavior, documentation, and acceptance criteria are all satisfied. Demo-only manual success is not enough.

