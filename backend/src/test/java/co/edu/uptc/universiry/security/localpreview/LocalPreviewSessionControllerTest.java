package co.edu.uptc.universiry.security.localpreview;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:local-preview-session;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@ActiveProfiles({"test", "local-preview"})
@Transactional
class LocalPreviewSessionControllerTest {

    private static final String SESSION_ENDPOINT = "/api/v1/dev/local-preview-session";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void local_preview_issues_a_no_store_bearer_with_its_declared_permissions_and_revokes_it_on_logout()
            throws Exception {
        // Arrange
        var issued = mockMvc.perform(post(SESSION_ENDPOINT))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresAt").isNumber())
                .andReturn();
        String token = com.jayway.jsonpath.JsonPath.read(issued.getResponse().getContentAsString(), "$.accessToken");

        // Act + Assert
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject").value("local-preview-developer"))
                .andExpect(jsonPath("$.permissions.length()").value(
                        LocalPreviewAuthoritiesConverter.LOCAL_PREVIEW_PERMISSIONS.size()))
                .andExpect(jsonPath("$.permissions", hasItems("academic:offerings:read", "academic:offerings:write")))
                // La gestion de roles no pertenece al preview: asignar un rol sigue siendo una
                // operacion institucional sin aprobar.
                .andExpect(jsonPath("$.permissions", not(hasItems("identity:roles:read", "identity:roles:write"))));
        mockMvc.perform(get("/api/v1/admin/academic-structure/audit-events")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(delete(SESSION_ENDPOINT).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer unknown"))
                .andExpect(status().isUnauthorized());
    }
}
