# Production V0 Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a verifiable production-V0 boundary: a releasable read-only public-information envelope, explicit gates for applicant, enrollment, payment, reservation, and identity operations, and no remote publish until an authorized target exists.

**Architecture:** Keep MySQL/Flyway as the relational target and keep all PII, payment, reservation, selection, enrollment, and production-identity behavior behind institutional gates. V0 may publish only public configuration/catalog snapshots, immutable public admission calendars, external official links, and closed local-preview authentication. Remote SSH/DNS changes require an explicitly authorized deployment target.

**Tech Stack:** Java 25/Spring Boot, MySQL 8.4/Flyway, Vite/React/TypeScript/SCSS, Docker Compose, GitHub CI on `develop`.

**Spec:** `docs/PROJECT.md`, `AGENTS.md`, `frontend/AGENTS.md`, `docs/security/frontend-production-gate.md`, `docs/discovery/sponsor-university-platform-scope-2026-10.md`, `docs/discovery/student-lifecycle-baseline.md`, `docs/discovery/uptc-payment-channel-2026-10.md`, `docs/discovery/uptc-space-reservations.md`.

## Global Constraints

- Work only on `develop`; do not create feature branches, remote branches, worktrees left behind, or pull requests.
- Never commit or publish secrets, `.env` files, tokens, private SSH keys, payment credentials, or production credentials.
- Do not capture or use real applicant/student PII, PINs, documents, scores, results, payments, bank data, passwords, or tokens in code, fixtures, tests, screenshots, logs, or evidence.
- Do not implement applicant registration/selection, enrollment/matriculation, user registration, space reservations, receipt generation, or payment processing without the institutional owner, source system, contract, permissions matrix, retention rule, and acceptance decision recorded first.
- Backend remains the authority for permissions, validation, and persistence; React only provides early UX validation.
- Keep MySQL/Flyway as the relational target; the SQLite test profile does not replace MySQL without an approved architecture decision.
- Administrative routes require server-side authorization; hiding controls in React is not protection.
- Follow TDD with AAA tests; cover happy paths, permissions, missing/invalid values, limits, duplicates, relevant concurrency, and regressions.
- New styles belong in SCSS with existing tokens/mixins; no loose CSS or inline styles.
- Any UI change must be verified visually with screenshots for desktop/mobile, light/dark, loading/error/empty states, and keyboard behavior.
- Save runnable evidence under `docs/evidence/`.
- Report only observed results; do not claim production readiness without the listed gates.

## Review Focus

- An applicant-facing form that captures PII must remain absent; expected behavior is a read-only official calendar/link, not an intake form.
- A local username/password registration flow must remain absent; expected behavior is closed federated identity with no production accounts.
- A payment/receipt flow must remain absent; expected behavior is an external official payment-guidance link with no amounts, receipts, bank data, or transaction state.
- A room/space reservation write must remain absent; expected behavior is a published directory plus official external request routes.
- A production SQLite switch must remain absent; expected behavior is MySQL/Flyway unless an approved ADR changes the target.

---

### Task 1: Codify the V0 operational boundary in the migrated schema

**Files:**
- Create: `backend/src/test/java/co/edu/uptc/universiry/platform/V0OperationalBoundaryTest.java`
- Modify: none
- Test: `backend/src/test/java/co/edu/uptc/universiry/platform/V0OperationalBoundaryTest.java`

**Interfaces:**
- Consumes: existing Flyway-managed H2/MySQL-compatible `JdbcTemplate` test setup.
- Produces: a regression signal that blocks applicant, enrollment, payment, receipt, reservation, and local-credential tables until their gates are approved and this test is intentionally updated.

- [ ] **Step 1: Write the failing test**

```java
@Test
void production_v0_schema_contains_no_operational_applicant_enrollment_payment_or_reservation_tables() {
    Set<String> tables = readMigratedTableNames(jdbcTemplate);
    assertTrue(Collections.disjoint(tables, Set.of(
        "applicant", "applicant_document", "admissions_selection",
        "enrollment", "matriculation",
        "payment", "payment_attempt", "receipt", "receipt_item",
        "space_reservation", "room_reservation",
        "local_user_credential", "local_password_account"
    )));
}

@Test
void production_v0_keeps_mysql_flyway_as_the_relational_default() throws Exception {
    Properties properties = new Properties();
    try (InputStream input = getClass().getResourceAsStream("/application.properties")) {
        assertNotNull(input);
        properties.load(input);
    }
    assertTrue(properties.getProperty("spring.datasource.url", "").contains("jdbc:mysql://"));
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && ./mvnw -Dtest=V0OperationalBoundaryTest test`
Expected: compilation failure because `readMigratedTableNames` does not exist.

- [ ] **Step 3: Implement the smallest table-name reader needed by the test**

Add a private helper in `V0OperationalBoundaryTest.java` that:
1. enables Flyway through the existing test datasource;
2. reads `TABLE_NAME` values from JDBC metadata;
3. lowercases them with `Locale.ROOT`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw -Dtest=V0OperationalBoundaryTest test`
Expected: `Tests run: 2, Failures: 0, Errors: 0, Skipped: 0`.

- [ ] **Step 5: Run the backend suite**

Run: `cd backend && ./mvnw verify`
Expected: `BUILD SUCCESS` with no new failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/co/edu/uptc/universiry/platform/V0OperationalBoundaryTest.java
git commit -m "test: guard production V0 against operational tables"
```

### Task 2: Codify the V0 frontend boundary for operational intake

**Files:**
- Modify: `frontend/scripts/check-api-surface.node-test.mjs`
- Test: `frontend/scripts/check-api-surface.node-test.mjs`

**Interfaces:**
- Consumes: the existing backend-mapping and client-route parser in the same guard.
- Produces: two passing tests that fail if applicant, enrollment, payment, receipt, reservation, or registration API resources appear on either side; no new scanner file and no `package.json` change.

- [ ] **Step 1: Write the failing tests**

```js
test('el backend no expone rutas operativas fuera del alcance V0', () => {
  assert.deepEqual(findOperationalIntakeRoutes(mapeos.map((m) => m.ruta)), [])
})

test('el cliente no llama rutas operativas fuera del alcance V0', () => {
  assert.deepEqual(findOperationalIntakeRoutes(rutas), [])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && node --test scripts/check-api-surface.node-test.mjs`
Expected: two `ReferenceError` failures because `findOperationalIntakeRoutes` does not exist.

- [ ] **Step 3: Implement the smallest route scan needed by the tests**

Add `RECURSOS_OPERATIVOS_FUERA_DE_V0` and `findOperationalIntakeRoutes` to the same guard. Match only the
first API resource after `/api/v1/`, including the resource after `/api/v1/admin/`. Do not duplicate the
existing route parser.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && node --test scripts/check-api-surface.node-test.mjs`
Expected: `tests 5, pass 5, fail 0`.

- [ ] **Step 5: Verify the new tests detect a real violation**

Temporarily add an existing route resource to the forbidden set, run the guard, confirm both new tests
fail on that route, restore the set, and rerun green.

- [ ] **Step 6: Run frontend checks**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: all tests pass, lint has no errors, build and bundle budgets pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/test/java/co/edu/uptc/universiry/platform/V0OperationalBoundaryTest.java frontend/scripts/check-api-surface.node-test.mjs docs/superpowers/plans/2026-10-07-production-v0-readiness.md
git commit -m "test: guard production V0 operational boundaries"
```

### Task 3: Publish only after a clean, secret-free repository and green CI

**Files:**
- Modify: none unless a prior task changed code
- Test: existing backend and frontend suites plus GitHub Platform CI

**Interfaces:**
- Consumes: completed Tasks 1–2.
- Produces: a pushed `develop` commit only when the tree is clean, secret-free, and CI is green.

- [ ] **Step 1: Verify the working tree**

Run: `git status --short`
Expected: no output.

- [ ] **Step 2: Scan the staged diff for secrets**

Run: `git diff --cached --check` and inspect `git diff --cached --stat`
Expected: no `.env`, token, private-key, password, payment-credential, or PII additions.

- [ ] **Step 3: Run the full local verification already required by Tasks 1–2**
- [ ] **Step 4: Push only the requested `develop` update**

Run: `git push origin develop`
Expected: fast-forward/pushed `develop`.

- [ ] **Step 5: Verify GitHub Platform CI**

Run: `gh run list --workflow=ci.yml --branch develop --limit 1`
Expected: latest run for the pushed SHA has conclusion `success`.

### Task 4: Do not connect to the mini computer or publish the subdomain without an authorized target

**Files:**
- Modify: none
- Test: none; this is an explicit safety gate, not code.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: no remote change.

- [ ] **Step 1: Record the missing deployment target as a blocker**

Required before any SSH/DNS step:
1. explicit `user@host` or SSH config alias;
2. key-based authentication with no password or secret in the repo/chat;
3. written authority to modify that host;
4. DNS delegation/control for `universidad.eridu.top`;
5. TLS termination, reverse-proxy, backup, rollback, log, and secret-management decisions.

- [ ] **Step 2: Take no remote action while any item is missing**

Do not run SSH, copy files, restart services, create DNS records, issue certificates, import databases, or publish the application.

- [ ] **Step 3: Keep SQLite out of production until an ADR approves it**

Scale assertions alone do not select a database engine. MySQL/Flyway remains the target until backup, concurrency, migration, audit, access-control, and operational requirements are decided in an approved ADR.
