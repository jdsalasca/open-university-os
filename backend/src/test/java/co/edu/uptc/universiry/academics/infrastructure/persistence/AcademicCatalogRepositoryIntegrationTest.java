package co.edu.uptc.universiry.academics.infrastructure.persistence;

import co.edu.uptc.universiry.academics.application.AcademicCatalogRepository;
import co.edu.uptc.universiry.academics.application.AcademicCurriculumDetails;
import co.edu.uptc.universiry.academics.application.AcademicCurriculumDraftsPage;
import co.edu.uptc.universiry.academics.application.AcademicProgramSummary;
import co.edu.uptc.universiry.academics.application.CurriculumImportService;
import co.edu.uptc.universiry.academics.application.CurriculumProgramIdentity;
import co.edu.uptc.universiry.academics.application.CurriculumDraftsPageQuery;
import co.edu.uptc.universiry.academics.application.CurriculumPublishResult;
import co.edu.uptc.universiry.academics.application.CurriculumSummary;
import co.edu.uptc.universiry.academics.application.CurriculumVersionConflictException;
import co.edu.uptc.universiry.academics.application.ParsedCurriculum;
import co.edu.uptc.universiry.academics.application.ParsedCurriculumRow;
import co.edu.uptc.universiry.academics.application.ValidatedCurriculum;
import co.edu.uptc.universiry.academics.domain.AcademicCatalogLimits;
import co.edu.uptc.universiry.academics.domain.AcademicLevel;
import co.edu.uptc.universiry.academics.domain.StudyModality;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.HashMap;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class AcademicCatalogRepositoryIntegrationTest {

    @Autowired
    private AcademicCatalogRepository repository;

    @Autowired
    private CurriculumImportService importService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void finds_the_latest_published_curriculum_for_the_exact_program_and_campus() {
        // Arrange
        String targetProgramCode = programCode();
        String otherProgramCode = programCode();
        String actor = actorSub();
        CurriculumSummary exactReference = publishAt(
                curriculum(targetProgramCode, "V1", "Programa sintético", "Facultad de prueba", "Tunja",
                        subjectCode(), "Asignatura de referencia", "3", sourceHash()),
                actor,
                LocalDateTime.of(2037, 1, 1, 10, 0));
        publishAt(
                curriculum(targetProgramCode, AcademicLevel.PREGRADO.name(), StudyModality.PRESENCIAL.name(),
                        "DUITAMA", "V2", "Programa sintético", "Facultad de prueba", "Duitama",
                        subjectCode(), "Asignatura de otra sede", "3", sourceHash()),
                actor,
                LocalDateTime.of(2037, 2, 1, 10, 0));
        publishAt(
                curriculum(otherProgramCode, "V1", "Otro programa sintético", "Facultad de prueba", "Tunja",
                        subjectCode(), "Asignatura de otro programa", "3", sourceHash()),
                actor,
                LocalDateTime.of(2037, 3, 1, 10, 0));
        CurriculumProgramIdentity identity = new CurriculumProgramIdentity(
                targetProgramCode, AcademicLevel.PREGRADO, StudyModality.PRESENCIAL, "TUNJA");

        // Act
        AcademicCurriculumDetails reference = repository.findLatestPublishedCurriculum(identity).orElseThrow();

        // Assert
        assertEquals(exactReference.id(), reference.curriculum().id());
        assertEquals(targetProgramCode, reference.curriculum().programCode());
        assertEquals("TUNJA", reference.curriculum().campusCode());
    }

    @Test
    void creates_a_draft_with_linked_revisions_entries_and_import_audit_atomically() {
        // Arrange
        String programCode = programCode();
        String subjectCode = subjectCode();
        String actor = actorSub();
        String hash = sourceHash();
        ValidatedCurriculum curriculum = curriculum(
                programCode, "V1", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode, "Cálculo Diferencial", "3.00", hash);

        // Act
        CurriculumSummary summary = repository.createDraft(curriculum, actor);

        // Assert
        assertNotNull(summary);
        assertEquals(programCode, summary.programCode());
        assertEquals("V1", summary.curriculumVersion());
        assertEquals("DRAFT", summary.status().name());
        assertEquals(1, summary.entryCount());
        assertEquals(hash, summary.sourceSha256());
        assertEquals(1, count("academic_program", "program_code", programCode));
        assertEquals(1, count("academic_program_revision", "program_id", summary.programId().toString()));
        assertEquals(1, count("academic_subject", "subject_code", subjectCode));
        assertEquals(1, count("academic_curriculum_entry", "curriculum_id", summary.id().toString()));
        assertEquals(1, count("academic_catalog_audit_event", "curriculum_id", summary.id().toString()));
        assertEquals(actor, jdbcTemplate.queryForObject(
                "SELECT actor_sub FROM academic_catalog_audit_event WHERE curriculum_id = ?",
                String.class, summary.id().toString()));
        assertEquals(hash, jdbcTemplate.queryForObject(
                "SELECT source_sha256 FROM academic_catalog_audit_event WHERE curriculum_id = ?",
                String.class, summary.id().toString()));
    }

    @Test
    void stores_immutable_search_snapshots_from_each_validated_curriculum_entry() {
        // Arrange
        String programCode = programCode();
        String subjectCode = "MAT_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8)
                .toUpperCase(Locale.ROOT);
        String subjectName = "Cálculo diferencial sintético";
        ValidatedCurriculum curriculum = curriculum(
                programCode, "V1", "Programa sintético", "Facultad de prueba", "Tunja",
                subjectCode, subjectName, "3.00", sourceHash());

        // Act
        CurriculumSummary draft = repository.createDraft(curriculum, actorSub());
        List<String> searchValues = jdbcTemplate.query(
                "SELECT search_subject_code, search_subject_name FROM academic_curriculum_entry "
                        + "WHERE curriculum_id = ?",
                (resultSet, rowNumber) -> List.of(
                        resultSet.getString("search_subject_code"), resultSet.getString("search_subject_name")),
                draft.id().toString())
                .getFirst();

        // Assert
        assertEquals(subjectCode, searchValues.get(0));
        assertEquals(subjectName, searchValues.get(1));
    }

    @Test
    void duplicate_version_conflict_rolls_back_new_program_and_subject_revisions() {
        // Arrange
        String programCode = programCode();
        CurriculumSummary first = repository.createDraft(curriculum(
                programCode, "V1", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode(), "Cálculo Diferencial", "3", sourceHash()), actorSub());
        assertNotNull(first);
        int programRevisionCount = count("academic_program_revision", "program_id", first.programId().toString());
        int subjectCountBefore = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM academic_subject", Integer.class);
        int auditCountBefore = count("academic_catalog_audit_event", "curriculum_id", first.id().toString());

        ValidatedCurriculum duplicate = curriculum(
                programCode, "V1", "Ingeniería Ambiental renovada", "Ingeniería", "Tunja",
                subjectCode(), "Cálculo Avanzado", "4", sourceHash());

        // Act
        assertThrows(CurriculumVersionConflictException.class,
                () -> repository.createDraft(duplicate, actorSub()));

        // Assert
        assertEquals(programRevisionCount,
                count("academic_program_revision", "program_id", first.programId().toString()));
        assertEquals(subjectCountBefore, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM academic_subject", Integer.class));
        assertEquals(auditCountBefore, count("academic_catalog_audit_event", "curriculum_id", first.id().toString()));
        assertEquals(1, count("academic_curriculum", "program_id", first.programId().toString()));
    }

    @Test
    void reuses_identical_revisions_and_keeps_prior_curriculum_content_immutable() {
        // Arrange
        String programCode = programCode();
        String subjectCode = subjectCode();
        CurriculumSummary first = repository.createDraft(curriculum(
                programCode, "V1", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode, "Cálculo Diferencial", "3.00", sourceHash()), actorSub());
        CurriculumSummary identical = repository.createDraft(curriculum(
                programCode, "V2", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode, "Cálculo Diferencial", "3", sourceHash()), actorSub());
        assertNotNull(first);
        assertNotNull(identical);

        // Act
        CurriculumSummary changed = repository.createDraft(curriculum(
                programCode, "V3", "Ingeniería Ambiental actualizada", "Ingeniería", "Campus Tunja",
                subjectCode, "Cálculo I", "4", sourceHash()), actorSub());

        // Assert
        assertNotNull(changed);
        assertEquals(2, count("academic_program_revision", "program_id", first.programId().toString()));
        assertEquals(2, count("academic_subject_revision", "subject_id", subjectId(subjectCode)));

        AcademicCurriculumDetails oldDetails = repository.findCurriculum(first.id()).orElseThrow();
        AcademicCurriculumDetails changedDetails = repository.findCurriculum(changed.id()).orElseThrow();
        assertEquals("Ingeniería Ambiental", oldDetails.curriculum().programName());
        assertEquals("Cálculo Diferencial", oldDetails.entries().getFirst().subjectName());
        assertEquals("Ingeniería Ambiental actualizada", changedDetails.curriculum().programName());
        assertEquals("Cálculo I", changedDetails.entries().getFirst().subjectName());
        assertNotEquals(oldDetails.entries().getFirst().subjectRevisionId(),
                changedDetails.entries().getFirst().subjectRevisionId());
    }

    @Test
    void public_reads_hide_drafts_and_publish_once_with_an_audit_event() {
        // Arrange
        CurriculumSummary draft = repository.createDraft(curriculum(
                programCode(), "V1", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode(), "Cálculo Diferencial", "3", sourceHash()), actorSub());
        assertNotNull(draft);

        // Act
        List<CurriculumSummary> publicBeforePublish = repository.listPublishedCurricula(draft.programId());
        List<AcademicProgramSummary> programsBeforePublish = repository.listPublishedPrograms();
        List<CurriculumSummary> drafts = repository.listDrafts(new CurriculumDraftsPageQuery(25, null)).drafts();
        CurriculumPublishResult firstPublish = repository.publishDraft(draft.id(), actorSub());
        CurriculumPublishResult secondPublish = repository.publishDraft(draft.id(), actorSub());

        // Assert
        assertTrue(publicBeforePublish.isEmpty());
        assertTrue(programsBeforePublish.stream().noneMatch(program -> program.id().equals(draft.programId())));
        assertTrue(drafts.stream().anyMatch(item -> item.id().equals(draft.id())));
        assertEquals(CurriculumPublishResult.PUBLISHED, firstPublish);
        assertEquals(CurriculumPublishResult.CONFLICT, secondPublish);
        assertEquals(1, repository.listPublishedCurricula(draft.programId()).size());
        assertEquals(1, repository.listPublishedPrograms().stream()
                .filter(program -> program.id().equals(draft.programId())).count());
        assertEquals("PUBLISHED", repository.findCurriculum(draft.id()).orElseThrow().curriculum().status().name());
        assertEquals(2, count("academic_catalog_audit_event", "curriculum_id", draft.id().toString()));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM academic_catalog_audit_event WHERE curriculum_id = ? AND action_key = 'CURRICULUM_PUBLISHED'",
                Integer.class, draft.id().toString()));
    }

    @Test
    void draft_cursor_preserves_uuid_ties_and_unseen_drafts_when_a_page_item_is_published() {
        // Arrange
        long existingDrafts = repository.listDrafts(new CurriculumDraftsPageQuery(100, null)).totalItems();
        String programCode = programCode();
        CurriculumSummary older = repository.createDraft(curriculum(
                programCode, "V1", "Programa sintético", "Facultad de prueba", "Tunja",
                subjectCode(), "Asignatura antigua", "3", sourceHash()), actorSub());
        CurriculumSummary newer = repository.createDraft(curriculum(
                programCode, "V2", "Programa sintético", "Facultad de prueba", "Tunja",
                subjectCode(), "Asignatura reciente", "3", sourceHash()), actorSub());
        LocalDateTime tiedCreatedAt = LocalDateTime.of(2037, 1, 1, 10, 0);
        jdbcTemplate.update("UPDATE academic_curriculum SET created_at = ? WHERE curriculum_id = ?",
                tiedCreatedAt, older.id().toString());
        jdbcTemplate.update("UPDATE academic_curriculum SET created_at = ? WHERE curriculum_id = ?",
                tiedCreatedAt, newer.id().toString());
        // Act
        AcademicCurriculumDraftsPage firstPage = repository.listDrafts(new CurriculumDraftsPageQuery(1, null));
        UUID firstDraftId = firstPage.drafts().getFirst().id();
        CurriculumSummary remaining = firstDraftId.equals(older.id()) ? newer : older;
        assertEquals(CurriculumPublishResult.PUBLISHED, repository.publishDraft(firstDraftId, actorSub()));
        AcademicCurriculumDraftsPage secondPage = repository.listDrafts(
                new CurriculumDraftsPageQuery(1, firstPage.nextCursor()));

        // Assert
        assertEquals(existingDrafts + 2, firstPage.totalItems());
        assertEquals(firstDraftId, firstPage.drafts().getFirst().id());
        assertEquals(existingDrafts + 1, secondPage.totalItems());
        assertEquals(remaining.id(), secondPage.drafts().getFirst().id());
    }

    @Test
    void concurrent_publish_requests_have_one_winner_and_one_publication_audit() throws Exception {
        // Arrange
        CurriculumSummary draft = repository.createDraft(curriculum(
                programCode(), "V1", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode(), "Cálculo Diferencial", "3", sourceHash()), actorSub());
        assertNotNull(draft);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        // Act
        try {
            Future<CurriculumPublishResult> first = executor.submit(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return repository.publishDraft(draft.id(), actorSub());
            });
            Future<CurriculumPublishResult> second = executor.submit(() -> {
                assertTrue(start.await(5, TimeUnit.SECONDS));
                return repository.publishDraft(draft.id(), actorSub());
            });
            start.countDown();
            List<CurriculumPublishResult> results = List.of(
                    first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));

            // Assert
            assertEquals(1, results.stream().filter(result -> result == CurriculumPublishResult.PUBLISHED).count());
            assertEquals(1, results.stream().filter(result -> result == CurriculumPublishResult.CONFLICT).count());
            assertEquals(2, count("academic_catalog_audit_event", "curriculum_id", draft.id().toString()));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void reports_missing_curricula_without_persisting_or_publishing_them() {
        // Arrange
        UUID missingId = UUID.randomUUID();

        // Act
        CurriculumPublishResult result = repository.publishDraft(missingId, actorSub());

        // Assert
        assertEquals(CurriculumPublishResult.NOT_FOUND, result);
        assertTrue(repository.findCurriculum(missingId).isEmpty());
    }

    @Test
    void rejects_missing_or_overlong_actor_subjects_before_creating_any_catalog_records() {
        // Arrange
        String programCode = programCode();
        ValidatedCurriculum curriculum = curriculum(
                programCode, "V1", "Ingeniería Ambiental", "Ingeniería", "Tunja",
                subjectCode(), "Cálculo Diferencial", "3", sourceHash());
        String overlongActor = "x".repeat(AcademicCatalogLimits.MAX_ACTOR_SUB_LENGTH + 1);

        // Act
        IllegalArgumentException missingActor = assertThrows(
                IllegalArgumentException.class, () -> repository.createDraft(curriculum, " "));
        IllegalArgumentException overlongActorError = assertThrows(
                IllegalArgumentException.class, () -> repository.createDraft(curriculum, overlongActor));

        // Assert
        assertNotNull(missingActor);
        assertNotNull(overlongActorError);
        assertEquals(0, count("academic_program", "program_code", programCode));
    }

    private ValidatedCurriculum curriculum(
            String programCode,
            String version,
            String programName,
            String faculty,
            String campusName,
            String subjectCode,
            String subjectName,
            String credits,
            String hash
    ) {
        return curriculum(programCode, AcademicLevel.PREGRADO.name(), StudyModality.PRESENCIAL.name(), "TUNJA",
                version, programName, faculty, campusName, subjectCode, subjectName, credits, hash);
    }

    private ValidatedCurriculum curriculum(
            String programCode,
            String academicLevel,
            String studyModality,
            String campusCode,
            String version,
            String programName,
            String faculty,
            String campusName,
            String subjectCode,
            String subjectName,
            String credits,
            String hash
    ) {
        Map<String, String> values = new HashMap<>();
        values.put("program_code", programCode);
        values.put("academic_level", academicLevel);
        values.put("study_modality", studyModality);
        values.put("snies_code", "12345");
        values.put("program_name", programName);
        values.put("faculty", faculty);
        values.put("campus_code", campusCode);
        values.put("campus_name", campusName);
        values.put("curriculum_version", version);
        values.put("cohort_from", "2026-1");
        values.put("cohort_through", "2028-2");
        values.put("approval_reference", "Acuerdo 01 de 2026");
        values.put("semester", "1");
        values.put("subject_code", subjectCode);
        values.put("subject_name", subjectName);
        values.put("credits", credits);
        values.put("formation_space", "Disciplinar");
        values.put("component", "Obligatorio");
        values.put("choice_group", "");
        return importService.validate(new ParsedCurriculum(
                List.of(new ParsedCurriculumRow(2, values)), hash));
    }

    private CurriculumSummary publishAt(
            ValidatedCurriculum curriculum,
            String actor,
            LocalDateTime publishedAt
    ) {
        CurriculumSummary draft = repository.createDraft(curriculum, actor);
        assertEquals(CurriculumPublishResult.PUBLISHED, repository.publishDraft(draft.id(), actor));
        // Test-only timestamp control makes the newer mismatched references deterministic.
        assertEquals(1, jdbcTemplate.update("UPDATE academic_curriculum SET published_at = ? WHERE curriculum_id = ?",
                publishedAt, draft.id().toString()));
        return repository.findCurriculum(draft.id()).orElseThrow().curriculum();
    }

    private int count(String table, String column, String value) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?", Integer.class, value);
    }

    private String subjectId(String subjectCode) {
        return jdbcTemplate.queryForObject(
                "SELECT subject_id FROM academic_subject WHERE subject_code = ?", String.class, subjectCode);
    }

    private static String programCode() {
        return "PRG-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private static String subjectCode() {
        return "SUB-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private static String actorSub() {
        return "test-actor:" + UUID.randomUUID();
    }

    private static String sourceHash() {
        return UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
    }
}
