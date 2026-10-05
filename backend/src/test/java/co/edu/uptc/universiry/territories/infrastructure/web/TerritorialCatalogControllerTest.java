package co.edu.uptc.universiry.territories.infrastructure.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TerritorialCatalogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void returns_attributed_departments_to_an_anonymous_visitor() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source.datasetVersion").value("MGN 2025"))
                .andExpect(jsonPath("$.departments.length()").value(33))
                .andExpect(jsonPath("$.departments[0].code").value("05"))
                .andExpect(jsonPath("$.departments[0].name").value("ANTIOQUIA"));
    }

    @Test
    void returns_only_the_selected_departments_entities_and_preserves_text_codes() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments/15/entities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source.publisher").value("DANE"))
                .andExpect(jsonPath("$.department.code").value("15"))
                .andExpect(jsonPath("$.entities.length()").value(123))
                .andExpect(jsonPath("$.entities[0].code").value("15001"))
                .andExpect(jsonPath("$.entities[0].localCode").value("001"))
                .andExpect(jsonPath("$.entities[0].name").value("TUNJA"))
                .andExpect(jsonPath("$.entities[0].type").value("MUNICIPIO"))
                .andExpect(jsonPath("$.entities[0].dataYear").value(2025));
    }

    @Test
    void returns_a_spanish_detail_for_a_malformed_department_code_by_default() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments/1/entities"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("El código del departamento debe contener dos dígitos."));
    }

    @Test
    void returns_a_spanish_detail_for_a_missing_department_code_by_default() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments/00/entities"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("No se encontró el código del departamento."));
    }

    @Test
    void returns_the_english_detail_for_a_malformed_department_code_when_requested() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments/1/entities")
                        .header("Accept-Language", "en"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Department code must contain two digits."));
    }

    @Test
    void returns_the_english_detail_for_a_missing_department_code_when_requested() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments/00/entities")
                        .header("Accept-Language", "en"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Department code was not found."));
    }

    @Test
    void identifies_islands_and_non_municipalized_areas_without_calling_them_municipalities() throws Exception {
        mockMvc.perform(get("/api/v1/territorial-catalog/departments/88/entities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entities[0].code").value("88001"))
                .andExpect(jsonPath("$.entities[0].type").value("ISLA"));

        mockMvc.perform(get("/api/v1/territorial-catalog/departments/91/entities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entities[1].code").value("91263"))
                .andExpect(jsonPath("$.entities[1].type").value("AREA_NO_MUNICIPALIZADA"))
                .andExpect(jsonPath("$.entities[1].dataYear").value(2024));
    }

    @Test
    void denies_mutations_to_the_public_reference_catalog() throws Exception {
        mockMvc.perform(post("/api/v1/territorial-catalog/departments").with(jwt())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden());
    }
}
