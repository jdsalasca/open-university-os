package co.edu.uptc.universiry.security.localpreview;

import co.edu.uptc.universiry.security.ApplicationPermission;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public final class LocalPreviewAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    /**
     * Permisos que el portador del bearer de preview local puede alcanzar, y solo bajo el
     * perfil {@code local-preview} atado a loopback (ADR-0004).
     *
     * <p>La lista es explicita y no {@code ApplicationPermission.values()}: anadir un permiso al
     * enum no debe entregarselo al preview sin revisar. Quedan fuera los permisos de gestion de
     * roles porque asignar un rol es una operacion institucional que sigue sin aprobar, y el
     * preview no la necesita para revisar las pantallas de la aplicacion.
     */
    public static final Set<String> LOCAL_PREVIEW_PERMISSIONS = Set.of(
            ApplicationPermission.BRANDING_READ.authority(),
            ApplicationPermission.BRANDING_WRITE.authority(),
            ApplicationPermission.ACADEMIC_CATALOG_READ.authority(),
            ApplicationPermission.ACADEMIC_CATALOG_WRITE.authority(),
            ApplicationPermission.ACADEMIC_STRUCTURE_READ.authority(),
            ApplicationPermission.ACADEMIC_STRUCTURE_WRITE.authority(),
            ApplicationPermission.ACADEMIC_PERIOD_READ.authority(),
            ApplicationPermission.ACADEMIC_PERIOD_WRITE.authority(),
            ApplicationPermission.ACADEMIC_OFFERINGS_READ.authority(),
            ApplicationPermission.ACADEMIC_OFFERINGS_WRITE.authority(),
            ApplicationPermission.ADMISSIONS_CALENDAR_READ.authority(),
            ApplicationPermission.ADMISSIONS_CALENDAR_WRITE.authority(),
            ApplicationPermission.NOTICES_READ.authority(),
            ApplicationPermission.NOTICES_WRITE.authority(),
            ApplicationPermission.LIBRARY_READ.authority(),
            ApplicationPermission.LIBRARY_WRITE.authority());

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        if (!InMemoryLocalPreviewSessionService.LOCAL_ISSUER.equals(
                jwt.getIssuer() == null ? null : jwt.getIssuer().toString())
                || !InMemoryLocalPreviewSessionService.LOCAL_SUBJECT.equals(jwt.getSubject())) {
            return List.of();
        }
        return LOCAL_PREVIEW_PERMISSIONS.stream()
                .sorted()
                .map(SimpleGrantedAuthority::new)
                .map(GrantedAuthority.class::cast)
                .toList();
    }
}
