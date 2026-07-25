# Coding Guidelines

## 1. Core rules

- TypeScript is strict everywhere.
- Scientific decisions are pure deterministic functions.
- Zod validates every trust boundary.
- Never use `any` in application code; use `unknown` and narrow.
- Never hide connector provenance.
- Never log secrets, full FASTA sequences, or unbounded provider responses.
- No TODO/FIXME placeholders in merged MVP code. Track future work in `TASKS.md`.
- Prefer small modules with explicit dependencies over generic utility collections.

## 2. Package management

- Use npm workspaces and commit `package-lock.json`.
- Run commands from the repository root unless a script says otherwise.
- Pin direct dependency ranges deliberately; do not use `latest` in committed manifests.
- Do not add a dependency when a small, well-tested standard-library implementation is sufficient.
- Document dependencies that carry scientific models, binaries, or restrictive licenses.

## 3. TypeScript configuration

Required compiler behavior:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "useUnknownInCatchVariables": true
}
```

Use ESM. Follow the installed NitroStack version’s ESM requirement; official examples currently require `.js` extensions in relative TypeScript import specifiers that emit to ESM.

## 4. Naming

| Item | Convention | Example |
|---|---|---|
| Files | kebab-case | `candidate-ranking.service.ts` |
| React components | PascalCase export, kebab-case file | `candidate-table.tsx` |
| Functions/variables | camelCase | `computeConsensus` |
| Types/classes | PascalCase | `PredictionObservation` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FASTA_BYTES` |
| Database models | PascalCase singular | `WorkflowRun` |
| REST paths | plural kebab-case | `/prediction-observations` |
| MCP tool names | snake_case | `compute_consensus` |
| Error codes | SCREAMING_SNAKE_CASE | `FIXTURE_HASH_MISMATCH` |
| Rule IDs | NAMESPACE-NAME-NNN | `BIO-OVERLAP-001` |

Booleans start with `is`, `has`, `can`, or `should`.

## 5. Module design

- One public responsibility per module.
- Constructor/function dependencies are explicit; do not read global singletons inside domain logic.
- Keep functions below roughly 50 lines where practical; split by behavior, not arbitrary length.
- Avoid cyclic workspace dependencies.
- Export through narrow package entry points.
- Do not expose provider-specific types outside connector capability-port modules.

## 6. Domain types and Zod

Define the runtime schema first and infer the TypeScript type:

```ts
export const candidateTypeSchema = z.enum(['MHCI', 'MHCII', 'BCELL']);
export type CandidateType = z.infer<typeof candidateTypeSchema>;
```

Do not create separate handwritten types that can drift from schemas. Brand UUIDs, SHA-256 values, and coordinate types when it prevents accidental mixing.

Parse at boundaries only. Internal functions receive already-validated domain types.

## 7. Deterministic code

- Sort unordered collections explicitly.
- Never depend on object insertion order from external data.
- Inject clocks and ID generators into tests.
- Do not use `Math.random()` in scientific logic.
- Keep raw and normalized scores in separate fields.
- Persist effective weights and profile versions.
- Compare unrounded values; round only in presentation.
- Reject non-finite numbers.

## 8. Error handling

Expected failures use typed domain errors:

```ts
class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly details?: Record<string, unknown>,
  ) { super(message); }
}
```

- Never branch on error message strings.
- Preserve the original error as `cause` internally.
- Map internal errors to safe API/MCP responses centrally.
- Stack traces are logs, not client responses.
- Retries are limited to errors explicitly marked retryable.

## 9. Logging

Use Pino structured fields:

```ts
logger.info({ requestId, runId, stageKey, toolName, durationMs }, 'stage completed');
```

Do not interpolate JSON into message strings. Use redaction paths for authorization headers, API keys, environment secrets, FASTA bodies, and provider payloads.

## 10. Fastify

- Define schema for params, query, body, and response.
- Route handlers translate HTTP to application commands; they do not implement algorithms.
- Business transactions live in services.
- All list endpoints are paginated.
- Long work returns `202`; it does not hold an HTTP request open.
- Request IDs are accepted only if format-valid; otherwise generate one.

## 11. NitroStack MCP

- Use `@Tool`, `@Resource`, `@Prompt`, modules, dependency injection, and Zod according to the pinned NitroStack version.
- Keep decorated tool classes thin; delegate to tested services.
- Add task support for long-running predictors.
- Check cooperative cancellation before expensive loops/subprocess waits.
- MCP responses use canonical domain envelopes, never provider-shaped bodies.

## 12. Prisma/SQLite

- Use repositories; do not import Prisma directly into routes, UI, or algorithms.
- External calls never occur inside transactions.
- Select only needed columns.
- Avoid N+1 queries in candidate lists.
- Append-only records have no public update method.
- All migrations are committed and tested.

## 13. React

- Use feature folders and composition.
- Server data is distinct from transient UI state.
- Prefer URL query parameters for shareable filters.
- Components receive formatted view models; they do not recalculate scientific scores.
- shadcn/ui components are customized through tokens, not duplicated source variants.
- Recharts and React Flow receive validated versioned view models.
- Status uses text/icon plus color.
- Every async view handles loading, empty, partial, error, and retry states.

## 14. CSS and design tokens

- Use Tailwind semantic tokens (`bg-background`, `text-muted-foreground`) rather than arbitrary repeated colors.
- Connector provenance has a consistent badge vocabulary across the app.
- Avoid dense dashboard cards when a table or progressive detail view is clearer.
- Do not reduce scientific table text below 12px.

## 15. Testing style

- Tests follow Arrange–Act–Assert.
- Test names describe behavior and condition.
- Numerical tests use explicit tolerances.
- Do not snapshot large opaque JSON; assert important fields and hash canonical fixtures.
- Mock at system boundaries, not pure internal functions.
- Every bug fix adds a regression test.

## 16. Comments and documentation

Comments explain why, scientific assumptions, coordinate conversions, and source constraints. Do not narrate obvious code.

Public algorithms and connector parsers include:

- input/output contract;
- score direction and units;
- source/method/version;
- error behavior;
- link to relevant specification section.

## 17. Pull-request gate

Before review:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Changes to algorithms, schemas, migrations, MCP/API contracts, or fixtures require the relevant focused test suite and documentation update.
