# Pasada funcional por flujos públicos — 8 de octubre de 2026

## Por qué

Las rondas anteriores midieron contraste, foco, consola, enlaces y resiliencia con el backend caído.
Faltaba lo obvio: usar la aplicación como una persona, con el backend arriba, y comprobar que los
flujos responden. `pasada-funcional.mjs` hace cuatro cosas que un visitante haría y afirma un
resultado observable en cada una; si algo no responde, falla con el nombre del flujo.

```
PLAYWRIGHT_CORE=<...> CHROMIUM=<...> BASE=http://localhost:5179 \
node docs/evidence/round-2026-10-08-jornada/pasada-funcional.mjs [salida.txt]
```

## Resultado: 4 de 4

- **Programas**: buscar «ingeniería» filtra la vista (24 menciones).
- **Espacios**: filtrar por municipio reduce la lista (29 → 9 tarjetas).
- **Admisiones**: el control descarga un ICS real y válido con **22 eventos** (`BEGIN:VCALENDAR` …
  `END:VCALENDAR`, 22 `VEVENT`). No solo se comprobó que el botón existe: se descargó y se validó.
- **Avisos**: la página pinta su título y su contenido (404 caracteres).
