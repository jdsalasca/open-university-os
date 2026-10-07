package co.edu.uptc.universiry.platform;

import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Pins the measured HikariCP pool default.
 *
 * <p>Measured 2026-10-06 under declared load (200 requests per endpoint, concurrency 20,
 * 5 repetitions): the HikariCP default of 10 connections left all 12 endpoints above the 50 ms
 * objective, while a pool of 24 left 0 of 12 above it. 24 is not magic: it sits just above the
 * measured concurrency, which is what avoids the connection queue. If this default ever drops back
 * toward 10, latency regresses silently under load with no failing query in sight.
 */
class DatasourcePoolDefaultsTest {

    @Test
    void hikari_maximum_pool_size_defaults_to_the_measured_value() throws Exception {
        Properties properties = new Properties();
        try (InputStream input = getClass().getResourceAsStream("/application.properties")) {
            assertNotNull(input);
            properties.load(input);
        }

        String configured = properties.getProperty("spring.datasource.hikari.maximum-pool-size", "");
        // Formato esperado: ${DB_POOL_MAX_SIZE:24}. Si cambia la forma, este substring falla en voz alta
        // en vez de dejar pasar un valor distinto en silencio.
        assertEquals("24", configured.substring(configured.lastIndexOf(':') + 1, configured.length() - 1));
    }
}
