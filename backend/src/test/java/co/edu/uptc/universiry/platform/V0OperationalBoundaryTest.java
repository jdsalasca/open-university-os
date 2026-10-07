package co.edu.uptc.universiry.platform;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.io.InputStream;
import java.util.Collections;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(properties = "spring.flyway.enabled=true")
@ActiveProfiles("test")
class V0OperationalBoundaryTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

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

    private static Set<String> readMigratedTableNames(JdbcTemplate jdbcTemplate) {
        return jdbcTemplate.execute((ConnectionCallback<Set<String>>) connection -> readTableNames(connection.getMetaData().getTables(
                connection.getCatalog(), null, "%", new String[]{"TABLE"}
        )));
    }

    private static Set<String> readTableNames(java.sql.ResultSet tables) throws java.sql.SQLException {
        Set<String> names = new TreeSet<>();
        try (tables) {
            while (tables.next()) {
                names.add(tables.getString("TABLE_NAME").toLowerCase(Locale.ROOT));
            }
        }
        return names;
    }
}
