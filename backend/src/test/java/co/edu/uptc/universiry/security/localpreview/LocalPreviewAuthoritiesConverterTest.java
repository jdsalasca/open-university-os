package co.edu.uptc.universiry.security.localpreview;

import co.edu.uptc.universiry.security.ApplicationPermission;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class LocalPreviewAuthoritiesConverterTest {

    private final LocalPreviewAuthoritiesConverter converter = new LocalPreviewAuthoritiesConverter();

    private static Jwt localJwt() {
        return Jwt.withTokenValue("preview-token")
                .header("alg", "none")
                .issuer(InMemoryLocalPreviewSessionService.LOCAL_ISSUER)
                .subject(InMemoryLocalPreviewSessionService.LOCAL_SUBJECT)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
    }

    private Set<String> granted() {
        return converter.convert(localJwt()).stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
    }

    @Test
    @DisplayName("el preview local no concede permisos de gestion de roles")
    void noConcedeGestionDeRoles() {
        // Arrange + Act
        List<String> concedidos = List.copyOf(granted());

        // Assert: asignar roles es una operacion institucional prohibida mientras el
        // diseno de identidad siga sin aprobar, y el preview no necesita alcanzarla.
        assertThat(concedidos).doesNotContain(
                ApplicationPermission.IDENTITY_ROLES_READ.authority(),
                ApplicationPermission.IDENTITY_ROLES_WRITE.authority());
    }

    @Test
    @DisplayName("el preview concede una lista declarada, no todos los permisos existentes")
    void concedeSoloLaListaDeclarada() {
        // Arrange + Act
        Set<String> concedidos = granted();

        // Assert
        assertThat(concedidos).isEqualTo(LocalPreviewAuthoritiesConverter.LOCAL_PREVIEW_PERMISSIONS);
        assertThat(concedidos).isNotEqualTo(java.util.Arrays.stream(ApplicationPermission.values())
                .map(ApplicationPermission::authority)
                .collect(Collectors.toSet()));
    }

    @Test
    @DisplayName("agregar un permiso nuevo no abre el preview local por descuido")
    void unPermisoNuevoNoSeConcedeSolo() {
        // Arrange: el enum sigue siendo la fuente de la verdad de los permisos, pero el
        // preview declara los suyos. Sin esta separacion, añadir un permiso al enum lo
        // entregaba al portador del bearer de preview sin revisar nada.
        Set<String> declarados = LocalPreviewAuthoritiesConverter.LOCAL_PREVIEW_PERMISSIONS;

        // Assert
        assertThat(declarados).hasSizeLessThan(ApplicationPermission.values().length);
        Set<String> conocidos = java.util.Arrays.stream(ApplicationPermission.values())
                .map(ApplicationPermission::authority)
                .collect(Collectors.toSet());
        assertThat(declarados).allMatch(conocidos::contains);
    }

    @Test
    @DisplayName("un token ajeno no recibe ninguna autoridad")
    void unTokenAjenoNoRecibeNada() {
        // Arrange
        Jwt ajeno = Jwt.withTokenValue("otro")
                .header("alg", "none")
                .issuer("https://issuer.institucion.invalid")
                .subject("otra-persona")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();

        // Act + Assert
        assertThat(converter.convert(ajeno)).isEmpty();
        assertThat(converter.convert(Jwt.withTokenValue("otro")
                .header("alg", "none")
                .issuer(InMemoryLocalPreviewSessionService.LOCAL_ISSUER)
                .subject("otra-persona")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build())).isEmpty();
    }
}
