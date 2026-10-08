# Publicación de convocatoria de punta a punta — 8 de octubre de 2026

## Lo que se comprobó

`ciclo-convocatoria.mjs` recorre con sesión de preview el flujo transaccional más exigente del
dominio: crear borrador de convocatoria, publicarlo con referencia oficial (pasando por el
`window.confirm`, que el script acepta) y leerlo en la API pública.

```
OK   guardar el borrador de la convocatoria sintética :: visible en la consola
OK   publicar la convocatoria con referencia oficial :: visible; estado publicado
OK   la convocatoria publicada se lee en la vista pública
```

Todo el contenido va marcado como sintético; las URL apuntan al portal genérico sin afirmar nada; la
sesión se revoca al terminar. Las fechas van en tiempo institucional (lección de la ronda de avisos).

## Notas del camino

- El diálogo `window.confirm` de publicación lo descarta Playwright por defecto: hay que aceptarlo
  explícitamente o la publicación nunca ocurre y el fallo parece del backend.
- El formulario expone `id` estables (`#admissions-call-key`, `#admissions-milestone-key-0`, ...),
  así que los selectores van por `id`, no por posición.
