# Hackathon Release Verification — 2026-08-03

Status: local release gate passed. Hosted deployment remains an owner action because no Vercel or Render account was connected.

## Release identity

- Verified application commit: `91b71d96b9271d0ea0582962625007944288edbe`
- Deployment URLs: pending owner deployment
- Production contract: Node.js `>=20.19.0 <21`, npm `>=10 <11`
- Verification host: Node.js 24.11.1 / npm 11.6.2; the engine mismatch was explicitly bypassed only for local dependency installation

## Automated quality gate

| Command | Observed result |
|---|---|
| `npm run format:check` | Passed after formatting the release changes |
| `npm run lint` | Passed with zero warnings |
| `npm run typecheck` | Passed |
| `npm test` | 81 files passed; 338 tests passed |
| `npm run test:coverage` | 74.38% statements, 58.69% branches, 69.11% functions, 74.45% lines |
| `npm run build` | Passed; Vite transformed 2,689 modules and produced the production web bundle |
| `npm run docs:check` | Documentation links and npm scripts valid |
| `npm run deployment:check` | API health-probe dependency and deterministic MCP image contracts valid |
| `npm run test:e2e` | 11/11 passed in 1.2 minutes |
| `npm run test:e2e -- --project=judge-chromium` | 2/2 passed after deployment hardening |
| `docker compose config --quiet` | Passed |
| Vercel JSON parsing and Vercel/Render/Compose formatting | Passed |

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
- The exact production MCP and API entry points were started against fresh storage. MCP `/health` and API `/health/ready` returned HTTP 200, exact-origin CORS was present, migrations and seed completed, and `POST /api/v1/demo/start` created an isolated expiring workspace.
- A new CI `container-smoke` job builds both Docker images, starts them on an isolated network, and requires both health endpoints to pass when GitHub Actions is available. Render deploys on commits so an account-level CI outage cannot block an explicitly verified release.
- GitHub Actions run `30827902798` did not start any job because GitHub reported that the `9059Rohith` account was locked for a billing issue. This is an account blocker, not an observed application or test failure; resolve it before relying on hosted CI evidence.
- Docker images could not be built on this workstation because the Docker Desktop Linux engine was not running (`dockerDesktopLinuxEngine` pipe absent); the CI container job is committed but cannot be claimed as executed until the revision is pushed.
- Hosted smoke testing is pending the owner's Render and Vercel deployment URLs. No hosted success is claimed.

## Known limitations

The curated results are deterministic synthetic demonstration evidence, not clinical, wet-lab, efficacy, or pathogen-reference findings. See [responsible-use limitations](../../LIMITATIONS.md) and complete every item in the [submission checklist](../../SUBMISSION_CHECKLIST.md) before the irreversible final submission.
