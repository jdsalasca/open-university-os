package co.edu.uptc.universiry.platform;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprueba que ninguna respuesta de error exponga la maquinaria interna del servidor.
 *
 * <p>Auditoria del 5 de octubre de 2026: diez peticiones que provocan 400, 401, 403 y 404
 * devolvieron mensajes limpios en todos los casos, y {@code ApiExceptionHandler} responde siempre
 * con una clave de {@code MessageCatalog}. Eso correcto puede romperse sin que nadie se entere:
 * un manejador nuevo que interpole {@code getMessage()}, o una propiedad que reactive las trazas,
 * filtrarian nombres de clase, rutas del servidor o consultas SQL.
 */
class ApiErrorExposureGuardTest {

    private static final Path MAIN = Path.of("src", "main");
    private static final Path PROPERTIES = MAIN.resolve(Path.of("resources", "application.properties"));

    private static List<Path> javaFiles() {
        try (Stream<Path> archivos = Files.walk(MAIN.resolve("java"))) {
            return archivos.filter((f) -> f.toString().endsWith(".java")).toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String leer(Path archivo) {
        try {
            return Files.readString(archivo, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Test
    @DisplayName("el servidor no incluye nunca el mensaje ni la traza de la excepcion en el cuerpo")
    void errorResponsesNeverCarryServerInternals() throws IOException {
        String configuracion = leer(PROPERTIES);
        assertThat(configuracion)
                .as("server.error.include-message debe quedar explicito en never")
                .contains("server.error.include-message=never");
        // El valor por defecto de Spring Boot es never, pero dejarlo explicito evita que una
        // actualizacion de la dependencia o un ajuste futuro expongan la traza.
        assertThat(configuracion)
                .as("server.error.include-stacktrace debe quedar explicito en never")
                .contains("server.error.include-stacktrace=never");
    }

    @Test
    @DisplayName("ningun manejador de excepciones construye el mensaje con la excepcion recibida")
    void handlersNeverInterpolateTheExceptionMessage() {
        // Los manejadores son clases cortas dedicadas a una familia de errores, asi que
        // cualquier getMessage() dentro de un archivo con @ExceptionHandler es una fuga.
        // Un parseo metodo a metodo por regular expresion resultaba demasiado fragil: la
        // primera version del guard aceptaba una fuga inyectada sin notar nada.
        List<String> culpables = javaFiles().stream()
                .filter((f) -> leer(f).contains("@ExceptionHandler"))
                .filter((f) -> leer(f).contains(".getMessage()"))
                .map((f) -> MAIN.relativize(f).toString())
                .toList();
        assertThat(culpables)
                .as("un manejador que use getMessage() expone el detalle interno de la excepcion")
                .isEmpty();
    }

    @Test
    @DisplayName("la respuesta de error solo lleva codigo y mensaje")
    void errorBodyHasNoTraceField() {
        Path api = MAIN.resolve(Path.of(
                "java", "co", "edu", "uptc", "universiry", "branding", "infrastructure", "web", "ApiExceptionHandler.java"));
        assertThat(api).as("debe existir el manejador global").exists();
        Matcher record = Pattern.compile("record\\s+ApiError\\s*\\(([^)]*)\\)").matcher(leer(api));
        assertThat(record.find()).as("ApiError debe ser un record").isTrue();
        assertThat(record.group(1).split(","))
                .as("el cuerpo de error no puede llevar traza, excepcion ni marca de tiempo")
                .hasSize(2)
                .allMatch((campo) -> campo.trim().equals("String error") || campo.trim().equals("String message"));
    }
}