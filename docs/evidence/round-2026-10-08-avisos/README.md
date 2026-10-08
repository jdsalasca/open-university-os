# Publicar y leer un aviso de punta a punta — 8 de octubre de 2026

## Lo que se comprobó

`publicar-aviso.mjs` abre `#avisos-admin` con sesión de preview, publica un aviso sintético y
comprueba que se lee en la página pública `#avisos`:

```
OK   abrir la consola de avisos :: título "Avisos institucionales"
OK   publicar un aviso sintético :: visible tras publicar
OK   el aviso publicado se lee en la página pública
```

## Tres falsas alarmas antes del verde, todas del instrumento

1. **Selector en español contra `name` en inglés.** Buscaba `input[name*="titul"]`; el campo se llama
   `title`. El formulario existía (la sesión sí tiene `NOTICES_WRITE`).
2. **`$eval` no activa los `onChange` de React.** Poner `.value` por DOM y disparar `input` no llega
   al estado del formulario: cero peticiones de red. Con `fill()` de confianza sí.
3. **Campos `required` sin llenar.** `publishedFrom`, `publishedThrough` y `reference` son obligatorios:
   la validación nativa bloquea el envío en silencio. Hay que llenarlos todos.
4. **La fecha iba en UTC y la visibilidad en Bogotá.** Con `toISOString()` un aviso creado de noche
   quedaba con inicio "de mañana": el `Clock` del backend es `America/Bogota` (`AcademicTimeConfiguration`),
   así que la lectura pública lo excluía **correctamente**. No era un bug: era la regla de vigencia
   funcionando. Las fechas del script van en tiempo institucional.

## Verificación de la regla de vigencia

- La consulta pública (`published_from <= ? AND published_through >= ?`) ejecutada a mano devuelve
  los 3 avisos; la API solo sirve los vigentes a la fecha institucional.
- Los 2 avisos sintéticos de las pruebas quedan en la base DEV, marcados como tales, con vigencia
  hasta noviembre de 2026. Son inmutables por diseño, así que no se borran por SQL.
