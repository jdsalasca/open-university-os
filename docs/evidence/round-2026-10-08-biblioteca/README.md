# Ciclo de biblioteca de punta a punta — 8 de octubre de 2026

## Lo que se comprobó

`ciclo-biblioteca.mjs` recorre con sesión de preview el ciclo de creación de la biblioteca, que
ninguna ronda había ejercitado en el navegador: registrar título, elegirlo en el catálogo, registrar
un ejemplar con código sintético y recuperarlo por ese código.

```
OK   registrar un título sintético :: título visible en el catálogo
OK   registrar un ejemplar del título :: ejemplar SINT-xxx visible en la lista
OK   recuperar el ejemplar por su código de barras :: ejemplar recuperado por búsqueda
```

Todo el contenido va marcado como sintético y la sesión se revoca al terminar (el token se captura
de la respuesta del POST, como en los auditores endurecidos).

## Notas del camino

- El formulario de ejemplar solo aparece **después** de elegir el título en el selector: el script lo
  descubre en vivo en vez de suponer el DOM.
- Préstamo, devolución y retiro no se recorrieron en el navegador en esta ronda: tienen cobertura
  unitaria y de concurrencia (`LibraryLoanConcurrencyTest`, 19 tests de la página). El cableado que
  faltaba por probar —cliente → API → MySQL → refresco de vista— es el que este ciclo cubre.
