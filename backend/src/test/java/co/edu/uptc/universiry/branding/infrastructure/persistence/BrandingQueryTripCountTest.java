package co.edu.uptc.universiry.branding.infrastructure.persistence;

import co.edu.uptc.universiry.branding.application.BrandingRepository;
import co.edu.uptc.universiry.branding.domain.BrandingConfiguration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
class BrandingQueryTripCountTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Medido el 5 de octubre de 2026 en el backend local con 44 tablas: {@code GET /api/v1/branding}
     * tardaba 92 ms de promedio frente a 18 ms de {@code /api/v1/academic-periods}. El problema no
     * eran las filas —hay 6 colores, 9 modulos y 0 banners, con indice por {@code revision_id}— sino
     * los viajes: la lectura encadenaba el puntero de revision y la cabecera en dos consultas
     * separadas, y cada una paga el tiempo de red entre contenedores.
     *
     * Por eso el puntero y la cabecera van en un solo {@code JOIN}. Quedan tres viajes, uno por
     * coleccion, que es lo que la forma de las tablas permite sin inventar un agregado de JSON.
     *
     * No se cachea en el repositorio a proposito: {@code findCurrentPublic} acepta el instante de la
     * peticion para filtrar banners por vigencia, y una ventana de tiempo serviria una configuracion
     * filtrada para otro instante. El cliente ya guarda 30 s por su cuenta con el
     * {@code Cache-Control: max-age=30} del controlador.
     *
     * Este test cuenta sentencias de verdad, envolviendo el {@code DataSource} en un proxy que
     * registra cada {@code prepareStatement}. Medir el tiempo no serviria: en el host de pruebas la
     * latencia entre contenedores no aparece.
     */
    @Test
    @DisplayName("la configuracion publica se lee en tres viajes, uno por coleccion")
    void la_configuracion_publica_se_lee_en_tres_viajes() {
        // Arrange
        List<String> sentencias = new ArrayList<>();
        JdbcTemplate contando = new JdbcTemplate(dataSourceQueCuenta(sentencias));
        BrandingRepository repositorio = new JdbcBrandingRepositoryAdapter(contando, Clock.systemUTC());
        Instant momento = Instant.parse("2026-09-29T12:00:00Z");

        // Act: diez lecturas seguidas, como las que hace una portada con sus tarjetas y su barra.
        BrandingConfiguration primera = null;
        for (int i = 0; i < 10; i++) {
            primera = repositorio.findCurrentPublic(momento).orElseThrow();
        }

        // Assert
        assertEquals(1, primera.revision(), "la revision debe seguir leyendose bien");
        assertEquals(6, primera.colors().size(), "los colores deben seguir leyendose");
        assertEquals(9, primera.modules().size(), "los modulos deben seguir leyendose");
        assertEquals(30, sentencias.size(),
                () -> "se esperaban 3 viajes por lectura y hubo " + (sentencias.size() / 10)
                        + " en 10 lecturas; el puntero de revision debe ir en el mismo JOIN que la cabecera");
    }

    @Test
    @DisplayName("el viaje unificado devuelve lo mismo que leer la revision por su identificador")
    void el_viaje_unificado_no_altera_el_contenido() {
        // Arrange
        Instant momento = Instant.parse("2026-09-29T12:00:00Z");

        // Act: la ruta publica resuelve el puntero con JOIN; la administrativa recibe el id suelto.
        BrandingConfiguration publica = new JdbcBrandingRepositoryAdapter(jdbcTemplate, Clock.systemUTC())
                .findCurrentPublic(momento).orElseThrow();
        BrandingConfiguration porId = new JdbcBrandingRepositoryAdapter(jdbcTemplate, Clock.systemUTC())
                .findRevision(1L).orElseThrow();

        // Assert
        assertEquals(porId.revision(), publica.revision());
        assertEquals(porId.institutionName(), publica.institutionName());
        assertEquals(porId.colors(), publica.colors());
        assertEquals(porId.modules(), publica.modules());
    }

    private DataSource dataSourceQueCuenta(List<String> destino) {
        return (DataSource) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class<?>[]{DataSource.class},
                (proxy, method, args) -> {
                    Object resultado = invocar(dataSource, method, args);
                    return resultado instanceof Connection real ? conexionQueCuenta(real, destino) : resultado;
                });
    }

    private Connection conexionQueCuenta(Connection real, List<String> destino) {
        return (Connection) Proxy.newProxyInstance(
                getClass().getClassLoader(),
                new Class<?>[]{Connection.class},
                (proxy, method, args) -> {
                    Object resultado = invocar(real, method, args);
                    if ("prepareStatement".equals(method.getName()) && args != null && args.length > 0) {
                        destino.add(String.valueOf(args[0]).replaceAll("\\s+", " ").trim());
                    }
                    return resultado;
                });
    }

    private Object invocar(Object objetivo, Method method, Object[] args) throws Throwable {
        try {
            return method.invoke(objetivo, args);
        } catch (InvocationTargetException e) {
            throw e.getCause();
        }
    }
}
