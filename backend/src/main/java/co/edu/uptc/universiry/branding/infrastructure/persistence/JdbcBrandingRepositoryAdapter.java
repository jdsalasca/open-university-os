package co.edu.uptc.universiry.branding.infrastructure.persistence;

import co.edu.uptc.universiry.branding.application.Actor;
import co.edu.uptc.universiry.branding.application.BrandingRepository;
import co.edu.uptc.universiry.branding.domain.BrandBanner;
import co.edu.uptc.universiry.branding.domain.BrandColor;
import co.edu.uptc.universiry.branding.domain.BrandModule;
import co.edu.uptc.universiry.branding.domain.BrandingConfiguration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.SqlParameterValue;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
public class JdbcBrandingRepositoryAdapter implements BrandingRepository {

    private static final RowMapper<BrandBanner> BANNER_ROW_MAPPER = (resultSet, rowNumber) -> new BrandBanner(
            resultSet.getString("banner_key"),
            resultSet.getString("asset_id"),
            resultSet.getString("title"),
            resultSet.getString("alt_text"),
            resultSet.getString("placement"),
            resultSet.getInt("display_order"),
            toInstant(resultSet.getObject("starts_at", LocalDateTime.class)),
            toInstant(resultSet.getObject("ends_at", LocalDateTime.class))
    );

    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    public JdbcBrandingRepositoryAdapter(JdbcTemplate jdbcTemplate, Clock clock) {
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BrandingConfiguration> findCurrentPublic(Instant requestTime) {
        return currentPublicHeader().flatMap(header -> loadConfiguration(header, requestTime, true));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BrandingConfiguration> findCurrentAdministrative() {
        return currentRevision(false).flatMap(revision -> loadConfiguration(revision, clock.instant(), false));
    }

    @Override
    @Transactional
    public Optional<BrandingConfiguration> lockCurrentAdministrative() {
        return currentRevision(true).flatMap(revision -> loadConfiguration(revision, clock.instant(), false));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BrandingConfiguration> findRevision(long revision) {
        return loadConfiguration(revision, clock.instant(), false);
    }

    @Override
    @Transactional
    public void insertRevision(BrandingConfiguration configuration, Actor actor, Long sourceRevision) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        BrandingConfiguration.Assets assets = configuration.assets();

        jdbcTemplate.update(
                """
                        INSERT INTO institution_branding_revision (
                            revision_id, institution_name, logo_light_asset_id, logo_dark_asset_id,
                            favicon_asset_id, created_by, created_at, source_revision_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                configuration.revision(),
                configuration.institutionName(),
                nullableChar(assets.logoLight()),
                nullableChar(assets.logoDark()),
                nullableChar(assets.favicon()),
                actor.subject(),
                now,
                new SqlParameterValue(Types.BIGINT, sourceRevision)
        );

        configuration.colors().forEach((key, color) -> jdbcTemplate.update(
                "INSERT INTO institution_color_token (revision_id, token_key, color_hex) VALUES (?, ?, ?)",
                configuration.revision(), key, color.hex()
        ));

        configuration.modules().forEach(module -> jdbcTemplate.update(
                """
                        INSERT INTO institution_module_label (
                            revision_id, module_key, label, available, visible, display_order
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                configuration.revision(), module.key(), module.label(), module.available(), module.visible(), module.displayOrder()
        ));

        configuration.banners().forEach(banner -> jdbcTemplate.update(
                """
                        INSERT INTO institution_banner (
                            revision_id, banner_key, asset_id, title, alt_text, placement,
                            display_order, starts_at, ends_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                configuration.revision(), banner.id(), banner.assetId(), banner.title(), banner.altText(), banner.placement(),
                banner.displayOrder(), nullableTimestamp(banner.startsAt()), nullableTimestamp(banner.endsAt())
        ));
    }

    @Override
    @Transactional
    public void moveCurrentTo(long revision) {
        int rows = jdbcTemplate.update(
                "UPDATE institution_branding_current SET revision_id = ?, row_version = row_version + 1 WHERE singleton_id = 1",
                revision
        );
        if (rows != 1) {
            throw new IllegalStateException("The branding current-revision pointer is missing.");
        }
    }

    @Override
    @Transactional
    public void appendAuditEvent(Actor actor, String action, long revision, String changeSummary) {
        jdbcTemplate.update(
                """
                        INSERT INTO administrative_audit_event (
                            actor_sub, action_key, entity_type, revision_id, occurred_at, change_summary
                        ) VALUES (?, ?, 'institution-branding', ?, ?, ?)
                        """,
                actor.subject(), action, revision, LocalDateTime.now(ZoneOffset.UTC), changeSummary
        );
    }

    @Override
    @Transactional(readOnly = true)
    public long countAuditEvents(long revision) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM administrative_audit_event WHERE revision_id = ?", Long.class, revision
        );
        return count == null ? 0 : count;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> findExistingAssetIds(Set<String> assetIds) {
        if (assetIds.isEmpty()) {
            return Set.of();
        }
        String placeholders = assetIds.stream().map(ignored -> "?").collect(Collectors.joining(", "));
        return Set.copyOf(jdbcTemplate.query(
                "SELECT asset_id FROM media_asset WHERE asset_id IN (" + placeholders + ")",
                (resultSet, rowNumber) -> resultSet.getString("asset_id"),
                assetIds.toArray()
        ));
    }

    private Optional<Long> currentRevision(boolean lock) {
        String sql = "SELECT revision_id FROM institution_branding_current WHERE singleton_id = 1" + (lock ? " FOR UPDATE" : "");
        List<Long> revisions = jdbcTemplate.query(sql, (resultSet, rowNumber) -> resultSet.getLong("revision_id"));
        return revisions.stream().findFirst();
    }

    /**
     * Puntero de revision y cabecera en un solo viaje. Antes eran dos consultas encadenadas —el
     * puntero y despues la fila de {@code institution_branding_revision}— y cada una paga el tiempo
     * de red entre contenedores. Medido el 5 de octubre de 2026, {@code GET /api/v1/branding} tardaba
     * 92 ms de promedio; con 6 colores, 9 modulos y 0 banners el problema no eran las filas.
     */
    private Optional<RevisionHeader> currentPublicHeader() {
        return jdbcTemplate.query(
                """
                        SELECT r.revision_id, r.institution_name, r.logo_light_asset_id, r.logo_dark_asset_id,
                               r.favicon_asset_id
                        FROM institution_branding_current c
                        JOIN institution_branding_revision r ON r.revision_id = c.revision_id
                        WHERE c.singleton_id = 1
                        """,
                (resultSet, rowNumber) -> headerOf(resultSet)
        ).stream().findFirst();
    }

    private Optional<BrandingConfiguration> loadConfiguration(long revision, Instant requestTime, boolean onlyActiveBanners) {
        List<RevisionHeader> headers = jdbcTemplate.query(
                """
                        SELECT revision_id, institution_name, logo_light_asset_id, logo_dark_asset_id, favicon_asset_id
                        FROM institution_branding_revision WHERE revision_id = ?
                        """,
                (resultSet, rowNumber) -> headerOf(resultSet),
                revision
        );
        if (headers.isEmpty()) {
            return Optional.empty();
        }
        return loadConfiguration(headers.getFirst(), requestTime, onlyActiveBanners);
    }

    private Optional<BrandingConfiguration> loadConfiguration(RevisionHeader header, Instant requestTime, boolean onlyActiveBanners) {
        long revision = header.revision();
        Map<String, BrandColor> colors = new LinkedHashMap<>();
        jdbcTemplate.query(
                "SELECT token_key, color_hex FROM institution_color_token WHERE revision_id = ? ORDER BY token_key",
                (resultSet, rowNumber) -> Map.entry(resultSet.getString("token_key"), BrandColor.fromHex(resultSet.getString("color_hex"))),
                revision
        ).forEach(entry -> colors.put(entry.getKey(), entry.getValue()));

        List<BrandModule> modules = jdbcTemplate.query(
                """
                        SELECT module_key, label, available, visible, display_order
                        FROM institution_module_label WHERE revision_id = ? ORDER BY display_order, module_key
                        """,
                (resultSet, rowNumber) -> new BrandModule(
                        resultSet.getString("module_key"),
                        resultSet.getString("label"),
                        resultSet.getBoolean("available"),
                        resultSet.getBoolean("visible"),
                        resultSet.getInt("display_order")
                ),
                revision
        );

        List<BrandBanner> banners;
        if (onlyActiveBanners) {
            LocalDateTime now = toUtc(requestTime);
            banners = jdbcTemplate.query(
                    """
                            SELECT banner_key, asset_id, title, alt_text, placement, display_order, starts_at, ends_at
                            FROM institution_banner
                            WHERE revision_id = ?
                              AND (starts_at IS NULL OR starts_at <= ?)
                              AND (ends_at IS NULL OR ends_at > ?)
                            ORDER BY display_order, banner_key
                            """,
                    BANNER_ROW_MAPPER, revision, now, now
            );
        } else {
            banners = jdbcTemplate.query(
                    """
                            SELECT banner_key, asset_id, title, alt_text, placement, display_order, starts_at, ends_at
                            FROM institution_banner WHERE revision_id = ? ORDER BY display_order, banner_key
                            """,
                    BANNER_ROW_MAPPER, revision
            );
        }

        return Optional.of(new BrandingConfiguration(
                header.revision(),
                header.institutionName(),
                colors,
                new BrandingConfiguration.Assets(header.logoLight(), header.logoDark(), header.favicon()),
                modules,
                banners
        ));
    }

    private static RevisionHeader headerOf(ResultSet resultSet) throws SQLException {
        return new RevisionHeader(
                resultSet.getLong("revision_id"),
                resultSet.getString("institution_name"),
                resultSet.getString("logo_light_asset_id"),
                resultSet.getString("logo_dark_asset_id"),
                resultSet.getString("favicon_asset_id")
        );
    }

    private static SqlParameterValue nullableChar(String value) {
        return new SqlParameterValue(Types.CHAR, value);
    }

    private static SqlParameterValue nullableTimestamp(Instant instant) {
        return new SqlParameterValue(Types.TIMESTAMP, instant == null ? null : toUtc(instant));
    }

    private static LocalDateTime toUtc(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }

    private record RevisionHeader(
            long revision,
            String institutionName,
            String logoLight,
            String logoDark,
            String favicon
    ) {
    }
}
