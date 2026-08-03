# Hackathon Release Verification — 2026-08-03

Status: local release gate passed. Hosted deployment remains an owner action because no Vercel or Render account was connected.

## Release identity

- Verified application commit: `6c4c62a67d7db74ced2751d042f19e28030df02b`
- Deployment URLs: pending owner deployment
- Production contract: Node.js `>=20.19.0 <21`, npm `>=10 <11`
- Verification host: Node.js 24.11.1 / npm 11.6.2; the engine mismatch was explicitly bypassed only for local dependency installation

## Automated quality gate

| Command | Observed result |
|---|---|
| `npm run format:check` | Passed after formatting the release changes |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Passed |
| `npm test` | 79 files passed; 333 tests passed |
| `npm run test:coverage` | 74.43% statements, 58.62% branches, 69.05% functions, 74.48% lines |
| `npm run build` | Passed; Vite transformed 2,689 modules and produced the production web bundle |
| `npm run docs:check` | Documentation links and npm scripts valid |
| `npm run test:e2e` | 11/11 passed in 1.2 minutes |
| `docker compose config --quiet` | Passed |
| Vercel/Render config parsing and formatting | Passed |

## Browser and visual evidence

The final Playwright matrix exercised authenticated core flows and the complete credential-free journey:

- Desktop Chrome: landing → isolated demo → configuration approval → run → candidate review → shortlist approval → Trust Center → report generation → artifact download.
- Pixel 7 emulation: the same complete path passed with no horizontal overflow.
- Keyboard focus visibility, named controls, single-main landmarks, and primary navigation passed on both profiles.
- Console warnings and errors are asserted absent in the Judge Mode journey.

Visual captures inspected during the release audit:

- `C:\Users\BhaviChasvi\AppData\Local\Temp\immunograph-judge-chromium-landing.png`
- `C:\Users\BhaviChasvi\AppData\Local\Temp\immunograph-judge-mobile-chromium-landing.png`
- `C:\Users\BhaviChasvi\AppData\Local\Temp\immunograph-judge-chromium-workspace.png`
- `C:\Users\BhaviChasvi\AppData\Local\Temp\immunograph-judge-mobile-chromium-workspace.png`

## Dependency audit

The MCP SDK was upgraded to 1.30.0 and `@hono/node-server` was pinned to 2.0.12, eliminating the reported path-traversal advisory. `npm audit --omit=dev` reports two high-severity package entries that map to one React Router RSC/server-action advisory. This Vite SPA does not import or execute the affected RSC/server path. The precise scope and required future upgrade are recorded in [SECURITY.md](../../SECURITY.md).

## Container and hosted smoke

- Compose configuration is valid.
- Docker images could not be built locally because the Docker Desktop Linux engine was not running (`dockerDesktopLinuxEngine` pipe absent).
- Hosted smoke testing is pending the owner's Render and Vercel deployment URLs. No hosted success is claimed.

## Known limitations

The curated results are deterministic synthetic demonstration evidence, not clinical, wet-lab, efficacy, or pathogen-reference findings. See [responsible-use limitations](../../LIMITATIONS.md) and complete every item in the [submission checklist](../../SUBMISSION_CHECKLIST.md) before the irreversible final submission.
