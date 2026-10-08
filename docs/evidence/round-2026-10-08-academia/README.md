# Alta de lugar raíz con referencia DEMO- de punta a punta — 8 de octubre de 2026

## Lo que se comprobó

`ciclo-lugar.mjs` abre `#academia` con sesión de preview, crea un lugar raíz con referencia `DEMO-`
y verifica las tres vistas del dominio:

```
OK   crear el lugar raíz con referencia DEMO- :: visible en la consola
OK   el árbol público excluye la referencia DEMO- :: limpio de la referencia sintética
OK   la auditoría registra el alta :: bitácora con el evento de alta
```

`DEMO-` es la convención del propio dominio para datos sintéticos: el árbol público los excluye y la
consola administrativa los conserva con su auditoría. Nada de esto toca datos institucionales.

## Tres errores del instrumento antes del verde

1. **Inputs sin `name`.** Los campos usan React Hook Form no controlado: `form:has(input[name=...])`
   no matchea nada. Se selecciona el formulario por su botón.
2. **Misma etiqueta en varios formularios.** `#academia` tiene varios "Referencia institucional"
   (afiliaciones, cierres); sin ámbito se rellenaba el primero de la página y el campo correcto
   quedaba vacío con "Completa este campo". Todos los selectores van con ámbito al formulario.
3. **El POST ni se enviaba.** La pista definitiva fue contar peticiones de red: un formulario que no
   dispara nada es validación nativa bloqueando, no un bug del backend.

## La lección que queda

Cuando un submit no produce red, el diagnóstico no es "no funciona" sino preguntarle al formulario
(`checkValidity` + `validationMessage` por campo). Ese bloque de diagnóstico queda en el script para
la próxima vez.
