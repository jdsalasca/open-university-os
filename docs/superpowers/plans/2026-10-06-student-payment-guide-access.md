# Student payment guide access plan

## Goal

Add a safe, searchable link to the official UPTC payment and receipts guidance in the public student services directory.

## Scope and constraints

- Reuse one shared HTTPS URL in the home page and student services directory.
- Keep the page informational. Do not collect credentials, identity, documents, payment details, receipts, or bank information.
- Do not copy tariffs, bank account numbers, payment decisions, or process steps into Universiry.
- Keep React/Vite/TypeScript, existing filters, accessibility, shared SCSS, and current routes.
- The source was visible in current official-domain search results on 2026-10-06; direct page open timed out. The student directory will link out without repeating payment instructions.

## Files

- `frontend/src/shared/officialUptcLinks.ts`: canonical UPTC public payment guidance URL.
- `frontend/src/features/workspace/WorkspaceHomePage.tsx`: use the canonical URL on the existing link.
- `frontend/src/features/workspace/WorkspaceHomePage.test.tsx`: guard canonical route and safety copy.
- `frontend/src/features/students/StudentServicesPage.tsx`: add one searchable, source-attributed service card.
- `frontend/src/features/students/StudentServicesPage.test.tsx`: assert card, safe external link, count, and search/filter behavior.
- `docs/discovery/uptc-student-services-directory-2026-10.md`: record source scope and verification limitation.
- `docs/ROADMAP.md`: record the completed iteration and its limits.

## TDD and verification

1. Add AAA assertions for the missing card and shared source contract; run the focused tests and observe the expected RED.
2. Add one shared link constant and the card; run focused tests to GREEN.
3. Run `npm test`, `npm run lint`, and `npm run build` from `frontend/`.
4. Verify the Compose preview on desktop and mobile; inspect screenshots and ensure no form, payment capture, or horizontal overflow is introduced.
5. Review `git diff --check`, commit from a detached worktree, integrate into local `develop`, push only `origin/develop`, verify remote SHA and CI, and remove only this worktree.
