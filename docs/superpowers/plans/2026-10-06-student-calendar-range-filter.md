# Student calendar range filter

## Goal

Make the public `/#estudiantes` calendar easier to scan by showing events whose inclusive end date is today or later in Colombia by default. Let visitors show the full published snapshot at any time.

## Constraints

- Keep the calendar as the existing static, attributed 2026-II snapshot.
- Compare date-only values in `America/Bogota`; include events ending today and events already in progress.
- Preserve source order and all 18 events in the `.ics` download regardless of the visible filter.
- Do not infer whether an event applies to a particular student or change any published date, audience, or modality.
- Add no API, persistence, student data, new dependency, database schema, or C4 boundary.
- Use React, TypeScript and SCSS already present in the frontend monolith.

## Acceptance criteria

1. Initial view shows events with `endsOn >= todayInBogota` and exposes a keyboard-operable control to show every published event.
2. The control indicates its pressed state and the number of events in each view.
3. If no events remain, an accessible empty message offers a direct way to show all dates.
4. Downloading `.ics` always exports the original complete snapshot.
5. AAA tests cover the inclusive boundary, active ranges, expired dates, all-events mode, date conversion at a UTC/Colombia day boundary, view switching, empty state and complete export.
6. The process-flow description and roadmap describe this behavior and retain the informational-only disclaimer.

## Implementation sequence

1. Add pure calendar-date/filter tests and component tests; run them and confirm the missing filter behavior fails for the expected reason.
2. Implement the Colombia date helper and event filter with the smallest interface required by the tests.
3. Add accessible controls, counts and empty-state copy; keep the `.ics` source untouched.
4. Run the focused tests, the complete frontend suite, lint and production build.
5. Review the diff for duplicate helpers, unapproved event classifications and unintended API/data changes.
6. Update `docs/architecture/process-flows.md` and `docs/ROADMAP.md`.
7. Check desktop/mobile behavior in a local preview and review screenshots; repeat the smoke check in Compose after integration.
8. Re-run required checks in the integrated `develop`, push the authorized fast-forward, verify SHA/CI, then remove the detached worktree.

## Verification log

- RED: the new fixed-date component test failed because the existing page rendered all 18 events instead of the expected 13 current/upcoming events.
- GREEN: focused frontend checks passed for the calendar and containing page (14 tests); the complete frontend suite passed (79 files, 546 tests, plus 118 Node guards), Oxlint passed without warnings, and the TypeScript/Vite production build and bundle guard passed.
- Visual review: the isolated Vite preview at `http://127.0.0.1:5175/#estudiantes` returned HTTP 200. A desktop screenshot was reviewed in the user browser at 1366×792; the 13/18 controls, source attribution, download and event cards were legible. A 390×844 mobile Chromium capture was reviewed after scrolling the filter into view; document width equaled viewport width (390 px), and both controls fit in the 287 px filter panel. Captures are temporary review evidence, not product assets.
- Remaining: after fast-forward, verify the same behavior through the Compose preview, rerun full checks on `develop`, and verify the pushed SHA and CI before removing the worktree.

## Risks and controls

- **Timezone boundary:** build the date key from `Intl.DateTimeFormat(...).formatToParts()` with an explicit `America/Bogota` timezone and test an instant near UTC midnight.
- **Date inclusivity:** use the source's date-only `endsOn` and an inclusive comparison; test an event ending today.
- **Stale source data:** retain the source link, checked/updated dates and disclaimer. This filter is only relative to the stored snapshot; it never asserts institutional applicability.
- **Export regression:** keep the download wired to the unfiltered snapshot and verify the emitted file still contains all published event IDs.

## Integration

Start from the verified `origin/develop` SHA in a detached worktree. Commit one atomic UI increment, fast-forward local `develop`, run checks after integration, push only to `origin/develop` under the user's standing authorization, verify remote reachability and CI, and clean the worktree. Do not create a branch or PR.
