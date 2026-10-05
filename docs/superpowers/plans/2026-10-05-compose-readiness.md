# Compose local preview readiness implementation plan

> **For agentic workers:** Use the native execution method in this session; do not create subagents. Track steps with checkboxes.

**Goal:** Make `docker compose up` wait for the Spring Boot readiness probe before starting the Vite preview.

**Architecture:** Compose already waits for MySQL and MongoDB health before starting the backend. Add a backend health check against Spring Actuator readiness, then make frontend depend on the healthy backend. Keep the change in local development orchestration; it does not change application APIs or production behavior.

**Tech Stack:** Docker Compose, Spring Boot Actuator, Node.js built-in test runner.

**Spec:** Harness task `task_0475e4d8-7fd4-4c2c-8ac8-9f85154dec8b`; current Compose startup sequence in `docs/architecture/process-flows.md`.

## Global constraints

- Preserve Java 25/Spring Boot, Vite/React, MySQL/Flyway and the two-monolith boundary.
- Do not read `.env`, expose configuration values, change data, credentials, academic rules, or production deployment.
- Keep the work in a detached worktree based on `origin/develop`; integrate only by fast-forward to `develop`.
- Use AAA for the Compose contract test and observe RED before changing production configuration.

## Review Focus

- Backend still starting: readiness is not healthy and frontend waits.
- Database unavailable: existing database health dependency continues to block backend startup.
- Readiness endpoint returns non-200: Compose does not mark backend healthy.
- Compose config uses host environment values: tests override interpolation values with synthetic values and never print the resolved model.
- Health endpoint details: use the existing readiness endpoint without changing actuator exposure or security policy.

## Tasks

### Task 1: Pin the local startup contract

**Files:**
- Create `frontend/scripts/check-compose-readiness.node-test.mjs`.
- Modify `frontend/package.json` to include the contract test in `npm test`.
- Modify `compose.yaml` with backend health and frontend readiness dependency.
- Modify `docs/architecture/process-flows.md` and `docs/ROADMAP.md` to record the sequence and verified local scope.

**Interfaces:**
- The test reads the resolved Compose model through `docker compose config --format json`.
- The backend health check targets `/actuator/health/readiness`; frontend waits for `service_healthy`.

- [ ] Write the Node contract test with Arrange/Act/Assert and controlled synthetic Compose variables.
- [ ] Run the focused test and confirm RED because backend has no health check.
- [ ] Add the backend readiness check and set the frontend dependency condition to `service_healthy`; include the test in the normal frontend test command.
- [ ] Run the focused test, `docker compose config --quiet`, frontend unit tests, lint, and production build.
- [ ] Update the local startup process diagram and roadmap with the scope and verification limits.
- [ ] Review the diff for secrets, duplicated configuration, unnecessary dependencies, or changes outside local Compose.
- [ ] Commit atomically, fast-forward into `develop`, push the authorized `origin/develop` update, verify CI and the live local preview, then remove the detached worktree.
