# Plan: hide the mobile skip link until keyboard focus

## Root cause

At widths up to 650 px, `.sidebar` becomes a fixed bottom bar. `.skip-link` remains absolutely positioned at `top: -60px`, so its containing block moves to the bottom bar and the link lands inside the viewport over the admissions notice even when it is not focused.

## One delivery round

1. Extend the existing Node regression guard to require a mobile override that positions `.skip-link` against the viewport and keeps it above the viewport when unfocused.
2. Run the guard and confirm it fails because the mobile override is absent.
3. Add the smallest SCSS override under the existing 650 px breakpoint. Keep the current `:focus-visible` rule and DOM order so keyboard users still reach the main content.
4. Run the frontend suite, lint, and production build. In a real mobile viewport, verify hidden-before-focus, visible-on-focus, Enter-to-main, and inspect a screenshot.
5. Commit the isolated change, fast-forward `develop` if its base is still current, verify the preview/CI, push only the commit, then remove this detached worktree.

## Acceptance criteria

- At 390x844, the unfocused skip link has a bounding box wholly above the viewport and does not cover page content.
- Keyboard focus reveals the link; Enter moves focus to `main`.
- Desktop behavior remains unchanged.
- Regression test, full frontend tests, lint, and build pass.
- No admissions data, layout semantics, or institutional process rules change. No C4 update is needed for this CSS-only correction.