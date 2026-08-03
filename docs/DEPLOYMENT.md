# ImmunoGraph deployment runbook

ImmunoGraph deploys as a Vite SPA on Vercel, a stateful Fastify API on Render, and a separate stateless MCP service on Render. The public judge path uses deterministic synthetic fixtures and requires no credentials.

## Prerequisites

- A public GitHub repository containing the commit being judged.
- A Render account that can create a Starter web service and a 1 GB persistent disk.
- A Vercel account linked to the same repository.
- Node 20 and npm 10 for local verification.

Render persistent disks are available only on paid services and disable zero-downtime deploys. The API is deliberately pinned to one Starter instance because SQLite and generated artifacts live under `/data`. See [Render persistent disks](https://render.com/docs/disks) and the [Blueprint specification](https://render.com/docs/blueprint-spec).

## 1. Verify the release locally

```powershell
npm ci --ignore-scripts --engine-strict=false
npm run db:generate
npm run build:types
npm test
npm run build --workspace @immunograph/web
npm run deployment:check
```

Commit and push the exact verified revision before creating the services.

## 2. Create the Render services

1. In Render, create a Blueprint from the repository-root `render.yaml`.
2. Supply `CORS_ORIGINS` with the planned exact Vercel production origin. Use no trailing slash. Multiple origins are comma-separated.
3. Supply `MCP_SERVER_URL` with the MCP service's public HTTPS URL followed by `/mcp`. If the URL is not yet visible, use a temporary valid URL, finish the Blueprint creation, then update this value after `immunograph-mcp` is live.
4. Wait for `immunograph-mcp` to return HTTP 200 from `/health`.
5. Redeploy `immunograph-api` after setting the final MCP URL, then verify `/health/live` and `/health/ready` both return HTTP 200.

The API container runs Prisma migrations during startup and stores its SQLite database and artifacts on `/data`. The MCP service is stateless and its public-demo image deliberately avoids downloading optional scientific tools during the image build. The judged fixture path therefore remains deterministic and deployable even when third-party scientific services are unavailable.

## 3. Deploy the Vercel SPA

1. Import the same repository into Vercel with the repository root as the project root.
2. Keep the commands and output directory from `vercel.json`.
3. Set `VITE_API_BASE_URL` to the public Render API HTTPS URL followed by `/api/v1`.
4. Deploy Production.
5. Copy the exact production origin, update the Render API's `CORS_ORIGINS`, and redeploy the API if the planned origin differed.

Vercel's official Vite guide requires the catch-all rewrite in `vercel.json` for SPA deep links: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## 4. Production smoke test

Run these checks in a private browser window:

1. Open the Vercel root URL and hard-refresh it.
2. Open a nested route directly and confirm it does not return 404.
3. Select **Launch judge demo** without signing in.
4. Confirm the network call to `POST /api/v1/demo/start` returns 201.
5. Complete the configuration approval, start the fixture workflow, inspect evidence, approve the shortlist, and export a report.
6. Repeat the launcher and core navigation at a mobile viewport.
7. Confirm the UI labels every fixture result as synthetic demonstration data and never presents it as clinical evidence.

## Required environment variables

| Platform | Variable | Value shape |
| --- | --- | --- |
| Vercel | `VITE_API_BASE_URL` | Render API HTTPS URL ending in `/api/v1` |
| Render API | `CORS_ORIGINS` | Exact Vercel origin(s), comma-separated, no paths or trailing slash |
| Render API | `MCP_SERVER_URL` | Render MCP HTTPS URL ending in `/mcp` |
| Render API | `DATABASE_URL` | `file:/data/immunograph.db` |
| Render API | `ARTIFACT_ROOT` | `/data/artifacts` |

Do not place secrets in `VITE_*` variables; Vite embeds them in the browser bundle.

## Continuous deployment verification

The GitHub Actions workflow validates formatting, types, tests, production builds, documentation, and deployment contracts. Its `container-smoke` job additionally builds both production Dockerfiles, starts MCP and API containers on an isolated Docker network, and requires their health endpoints to return HTTP 200 before the revision can pass CI.

Both Render services use `autoDeployTrigger: checksPass`, so a revision is not deployed automatically until these repository checks succeed.
