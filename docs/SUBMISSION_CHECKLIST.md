# BlockseBlock Submission Checklist

Final Submit is irreversible. Keep the BlockseBlock entry in draft until every required item below is verified in a signed-out/incognito browser.

## Owner-supplied publication values

- [ ] `LIVE_DEMO_URL=` points to the public Vercel deployment of the final commit.
- [ ] `DEMO_VIDEO_URL=` points to a public video no longer than three minutes.
- [ ] `PUBLIC_GITHUB_URL=` is public and shows visible, meaningful commit history.
- [ ] `PUBLIC_GOOGLE_DOC_URL=` is public and contains the project description.
- [ ] `FINAL_COMMIT_SHA=` matches GitHub, Vercel, and Render.

Do not replace these fields with guessed or placeholder hyperlinks elsewhere in the repository.

## Public access

- [ ] Demo opens without credentials and **Launch judge demo** succeeds.
- [ ] GitHub repository opens while signed out.
- [ ] Video plays while signed out and is at most 3:00.
- [ ] Google Doc opens while signed out.
- [ ] No submission asset requests access or exposes credentials.

## Three-minute viability gate

- [ ] Landing communicates problem, Track 4, and safety boundary in 20 seconds.
- [ ] Curated configuration can be approved without creating a duplicate run.
- [ ] Fixture workflow reaches shortlist review reliably.
- [ ] At least one eligible candidate can be approved.
- [ ] Trust Center displays checks, hashes, source states, and disclaimer.
- [ ] Report generation produces a visible download link.
- [ ] Video narration follows [the demo script](DEMO_SCRIPT.md).

## Technical evidence

- [ ] Final [release ledger](superpowers/verification/2026-08-03-hackathon-release.md) is complete.
- [ ] Local quality gate and credential-free desktop/mobile browser projects pass.
- [ ] Vercel landing and SPA deep links return HTTP 200.
- [ ] Render API `/health/live` and MCP health return HTTP 200.
- [ ] Demo data remains `SYNTHETIC`/`FIXTURE` with `scientificUse=false`.
- [ ] No trained-model accuracy, wet-lab, clinical, or guaranteed-impact claim appears.
- [ ] `npm audit` findings are resolved or precisely disclosed.

## Final BlockseBlock review

- [ ] Track is **Track 4 — Domain Agents**.
- [ ] Title and description match README and Google Doc.
- [ ] All URLs point to the final public artifacts.
- [ ] Submission remains a draft during the last signed-out smoke test.
- [ ] Only the owner performs **Final Submit** after all boxes are checked.
