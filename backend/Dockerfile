# Imagen de producción del monolito Spring Boot. Multi-etapa: se compila con Maven y el runtime solo
# lleva el JRE y el jar, sin código fuente ni dependencias de compilación. Corre como usuario sin
# privilegios y expone la sonda de readiness que ya usa Compose.
#
# Lo que esta imagen NO resuelve, a propósito: la URL, el usuario y la contraseña de la base de datos
# llegan por entorno (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`); el perfil `local-preview` no se activa
# aquí; y OIDC sigue cerrado hasta la configuración aprobada por DTIC.
FROM maven:3-eclipse-temurin-25 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn --batch-mode --no-transfer-progress -DskipTests package

FROM eclipse-temurin:25-jre
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists \
    && addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY --from=build /build/target/universiry-backend-*.jar app.jar
RUN chown app:app /app/app.jar
USER app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=12 \
    CMD curl --fail --silent --output /dev/null --max-time 3 http://127.0.0.1:8080/actuator/health/readiness
ENTRYPOINT ["java", "-jar", "app.jar"]
