# Security Model

## 1. Scope and trust boundary

The research workspace is a single-researcher application. Locally it is trusted only when bound to `127.0.0.1` and used on the researcher’s machine.

The hackathon deployment is a separate **public demonstration profile**: it contains no private research data, accepts only reviewed synthetic fixtures, creates isolated opaque UUID workspaces, expires them after 24 hours, applies exact-origin CORS, and discloses best-effort retention. Credential-free Judge Mode is a usability feature, not an authorization mechanism. Any remote deployment containing real research data still requires authentication, authorization, TLS, tenant isolation, and a separate security review.

## 2. Protected assets

- external service credentials and licensed predictor paths;
- project FASTA inputs and local research metadata;
- scientific observations and approvals;
- SQLite database and artifacts;
- integrity of reference profiles and fixtures;
- local filesystem and subprocess execution boundary.

## 3. Threats

| Threat | Example | Primary controls |
|---|---|---|
| Malicious upload | Huge/invalid FASTA, HTML in header | Size limit, strict parser, output escaping |
| Command injection | FASTA/header passed to shell | Spawn executable with argument array; never shell interpolation |
| SSRF | User-controlled connector URL | Static allowlisted connector registry |
| Path traversal | Artifact path `../../...` | Server-generated paths and containment checks |
| Prompt injection | Metadata says “ignore rules” | Treat evidence as data; fixed system prompt; no tool authority |
| Scientific data poisoning | Corrupt fixture/profile | Manifest hashes, schema validation, reviewer approval |
| Secret leakage | API key in log/error/UI | Environment secrets, Pino redaction, safe error mapper |
| Dependency compromise | Malicious npm package | Lockfile, `npm ci`, audit/review, minimal dependencies |
| Cross-origin use | Web page calls local API | Strict CORS origin and loopback bind |
| Stale/replayed approval | Approve changed ranking | Snapshot hashes and 409 conflicts |

## 4. Network controls

- Default API/MCP bind: `127.0.0.1`.
- Fastify CORS allows only the configured Vite origin in development and same-origin deployment in packaged builds.
- Connector base URLs are code/config registry entries, not request fields.
- Redirects are disabled or revalidated against the allowlist.
- Timeouts, response-size limits, and bounded retries apply to all external calls.
- TLS certificate validation remains enabled.

## 5. Input validation

### FASTA

- maximum request/upload 1 MiB;
- one record;
- header maximum 500 characters;
- normalized protein maximum 10,000 residues by default;
- strict amino-acid alphabet;
- no filenames used as storage paths;
- display escaped as text.

### JSON/API/MCP

- Zod schemas reject unknown keys for security-sensitive commands where appropriate;
- array lengths have maxima;
- pagination maxima are enforced;
- IDs and hashes are format-validated;
- numerical values must be finite and within documented domains.

## 6. Scientific connector execution

For local executables such as MHCflurry:

- configure executable path through validated environment variables;
- resolve and verify the path at startup;
- use `spawn`/`execFile` with an argument array, never a shell command string;
- write inputs only into a unique application temporary directory;
- impose CPU/time/output-size limits where the OS/runtime permits;
- propagate cancellation and terminate child processes;
- parse only expected output files beneath the temporary directory;
- delete temporary files after completion;
- record binary/method version and hash when available.

## 7. Secrets

- Secrets live in environment variables or an OS secret store, never source control or SQLite.
- `.env` is gitignored; `.env.example` contains names and descriptions only.
- Startup validates presence without printing values.
- Connector descriptors exposed to UI include `configured: true|false`, not credentials.
- Rotate a credential immediately if it appears in a log, fixture, screenshot, or commit.

## 8. Database and artifacts

- SQLite and artifact directories are outside publicly served static roots.
- File permissions are restricted to the current user where supported.
- Foreign keys and transactions protect integrity.
- Artifact downloads resolve database-owned relative paths beneath one configured root.
- Generated CSV cells beginning with `=`, `+`, `-`, or `@` are escaped to prevent spreadsheet formula injection.
- Back up before destructive migrations or project deletion.

## 9. LLM security

The LLM is optional and has no MCP/scientific tool authority.

- System instructions are fixed and versioned.
- User/project metadata and evidence are delimited as untrusted data.
- Only whitelisted structured fields enter prompts.
- Full FASTA is not required for explanation and is omitted.
- Output is parsed against a Zod schema.
- All numbers, candidate IDs, categories, and rule IDs are checked against source evidence.
- Unsupported output is discarded in favor of deterministic text.
- Hidden chain-of-thought is neither requested nor stored.

## 10. Browser security

- Render untrusted content as text; no `dangerouslySetInnerHTML` for metadata/evidence.
- Configure a restrictive Content Security Policy in production packaging.
- Avoid secrets in local storage.
- Do not trust client-provided project/run ownership; validate relationships server-side even in single-user mode.
- State-changing routes use JSON and strict CORS; if cookie-based auth is added later, add CSRF protections.

## 11. Audit and approvals

- Approval events are append-only and bound to snapshot hashes.
- Project deletion is logged before deletion and requires typed confirmation.
- Connector fallback and fixture use create durable warning events.
- Profile or fixture hash mismatches block execution.

## 12. Dependency and supply-chain controls

- Commit `package-lock.json`.
- Use `npm ci` in CI.
- Review install scripts for new dependencies.
- Run `npm audit` and a license review before demo freeze.
- Pin Docker/base images by digest if containers are added.
- Do not download predictor binaries/models automatically at runtime unless source, checksum, and license workflow are approved.

## 13. Security verification checklist

- [ ] API binds to loopback by default.
- [ ] CORS rejects unexpected origin.
- [ ] FASTA/upload limits enforced server-side.
- [ ] Connector URLs are allowlisted.
- [ ] Local tools use argument-array spawning.
- [ ] Temporary paths and artifact paths are contained.
- [ ] Logs redact sequences and secrets.
- [ ] CSV formula injection mitigated.
- [ ] Snapshot approvals reject stale data.
- [ ] Fixtures/reference files pass hashes.
- [ ] LLM output grounding validation passes.
- [ ] Dependency and license reviews complete.

## 14. Disclosure

Security issues should be reported privately to the repository maintainers. Do not include sensitive exploit details, secrets, or research inputs in public issues.
