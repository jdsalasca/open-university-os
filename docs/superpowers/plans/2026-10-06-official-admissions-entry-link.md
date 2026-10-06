# Ruta oficial de inscripción 2027-I Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give visitors to the public 2027-I admissions calendar a clear, safe link to the current official UPTC registration route.

**Architecture:** Add an optional presentation source to the public admissions calendar contract, populate it only on the statically verified 2027-I reference calendar, and render an accessible external CTA only when that source exists. Keep all registration behavior on UPTC; no API, persistence, or admissions decision logic changes.

**Tech Stack:** React, TypeScript, Vite, SCSS, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-06-official-admissions-entry-link.md`

## Global Constraints

- Keep the project on one `develop`; implement in a detached worktree based on `origin/develop`.
- Write an AAA test first, observe the expected failure, then add the smallest implementation.
- Use SCSS with existing tokens; do not add inline styles or dependencies.
- Use only the cited public official route; do not receive or send personal data.
- C4 is unchanged; update the admissions process diagram because the visible route changes.
- Integrate and push only by the authorized fast-forward to `origin/develop`.

## Review Focus

- A calendar without a verified registration source must not show a misleading CTA.
- New-tab navigation must protect the opener with `noopener noreferrer`.
- CTA copy must not imply Universiry processes an application or verifies eligibility.
- Narrow mobile layouts must not overflow and keyboard focus must remain visible.
- Existing published calendars and admission-calendar fallback behavior must remain unchanged.

---

### Task 1: Add and verify the official-route contract

**Files:**
- Modify: `frontend/src/features/admissions/admissionsContracts.ts`
- Modify: `frontend/src/features/admissions/official2027ICalendar.ts`
- Test: `frontend/src/features/admissions/AdmissionsCalendarPage.test.tsx`

- [x] Add an AAA test that expects the 2027-I public page to show an official-route link with the exact published UPTC URL and safe external-link attributes.
- [x] Run the focused test and record the expected missing-link failure.
- [x] Add an optional `registrationSource` to `PublicAdmissionsCalendar` and populate it only on the verified 2027-I reference.
- [x] Add an AAA case that removes `registrationSource` from a calendar and expects no registration CTA.
- [x] Run the focused admissions test file; all 10 tests passed.

### Task 2: Present the route and update process documentation

**Files:**
- Modify: `frontend/src/features/admissions/AdmissionsCalendarPage.tsx`
- Modify: `frontend/src/features/admissions/AdmissionsCalendarPage.scss`
- Modify: `docs/architecture/process-flows.md`
- Modify: `docs/ROADMAP.md`

- [x] Render the CTA only when the optional source is present, with explicit copy that the user continues on UPTC and Universiry does not receive data.
- [x] Style the CTA in SCSS for desktop/mobile with focus feedback and contrast-safe semantic tokens that do not depend on the configurable primary color.
- [x] Update the public admissions sequence diagram and source-check date without describing backend behavior.
- [x] Add the milestone and remaining institutional gates to the roadmap.

### Task 3: Validate, review, and integrate

**Files:** all files above.

- [x] Run all frontend tests (Vitest 540/540 across 78 files; Node guards 118/118), build with budgets, lint, and `git diff --check` after final edits.
- [x] Start a local preview and inspect desktop/mobile screenshots of `/#admisiones` in light and dark themes; measured 390px viewport has no horizontal overflow.
- [x] Review the full diff; no application fields, API, persistence, or PII were added. Register a Craft review.
- [ ] Commit atomically, fast-forward local `develop`, push `origin/develop`, and verify the remote SHA and GitHub CI.
- [ ] Remove this task's detached worktree and verify the main checkout is clean and aligned.
