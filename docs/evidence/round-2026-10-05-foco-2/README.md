# Mutación de las cuatro guardas restantes — 5 de octubre de 2026

Continúa la [auditoría anterior](./README.md), que dejó cuatro guardas sin comprobar por mutación. Esta
ronda las somete al mismo método: mutar la condición vigilada, **verificar que la mutación se aplicó y
que realmente viola la propiedad**, ejecutar y restaurar.

## `check-test-timeouts` — 2 de 2 ramas con dientes

| Mutación | Resultado |
| --- | --- |
| `testTimeout: 30000` → `5000` | la prueba de `testTimeout` **falla** |
| `asyncUtilTimeout: 15000` → `1000` | la prueba de `asyncUtilTimeout` **falla** |

Las dos ramas tienen su propia aserción sobre su propio umbral, no una compartida.

## `check-touch-targets` — 3 de 3 ramas con dientes

| Mutación | Resultado |
| --- | --- |
| `padding-block: 6px` → `3px` en los enlaces de ficha | **falla** (el área táctil baja de 24 a 18 px) |
| Se elimina `align-self: stretch` del input del buscador | **falla** |
| `<label className="spaces-search-field">` → `<div>` | **falla** |

## `check-bundle-budget` — caída exacta de la prueba correcta

En lugar de mutar el test, se mutó **la implementación**: `if (Object.keys(manifest).some((key) =>
key.startsWith(ADMISSIONS_DEMO_PREFIX)))` pasó a `if (false)`, desactivando la exclusión del
laboratorio de admisiones.

```
tests 19 · pass 18 · fail 1
expected: ['El laboratorio de admisiones de desarrollo no debe entrar al build de producción']
actual:   []
```

Cae exactamente una prueba y es la que corresponde. Un guard que detecta una =-1 línea es el caso
fácil; lo notable es que una desactivación quirúrgica no arrastra falsos positivos.

## `check-dark-theme-feedback` — 10 de 17 pruebas caen

Se degradó `--ui-text-primary` en el tema oscuro. Es el guard más sólido de los cuatro: compila el
SCSS real con `sass`, resuelve tokens y **calcula el ratio WCAG**, en lugar de buscar literales.

### La primera mutación no violaba la propiedad

Con `--ui-text-primary: #cfc9a0` sobre `--ui-surface-raised: #252b25` la suite pasó **17 de 17**. El
color es visualmente distinto, pero el ratio es **8,82**: muy por encima de AA.

Es la segunda vez en estas rondas que una mutación «pasa» porque no rompe lo que dice romper. Un beige
claro sobre una superficie casi negra sigue siendo legible. La mutación correcta fue `#6b6d63`
(ratio 2,5), y entonces:

```
tests 17 · pass 7 · fail 10
```

## Conclusión

Los nueve guards comprobados detectan la violación que vigilan. De ellos, **uno estaba realmente
desprotegido** — la reserva de altura que arregla el CLS — y ya tiene prueba.

Sobre el método, la lección se repite y conviene dejarla escrita: mutar no es «cambiar algo», es
**cambiar algo que rompe la propiedad observada**. Las dos mutaciones que pasaron sin detectar nada
—el color que ya no existía en el archivo y el beige legible sobre fondo oscuro— no fue un fallo del
guard en ninguno de los dos casos. El guard acertó; el experimento estaba mal.

| Guard | Mutaciones | Detecta |
| --- | ---: | --- |
| `check-test-timeouts` | 2 | 2 |
| `check-touch-targets` | 3 | 3 |
| `check-bundle-budget` | 1 | 1 |
| `check-dark-theme-feedback` | 2 | 1 de 2 (la primera no violaba la propiedad) |

## Un flake encontrado de paso: nueve pruebas seleccionaban antes de tiempo

La suite completa falló una vez durante esta ronda con
`TestingLibraryElementError: Value "15" not found in options`, sobre un `<select disabled>` que solo
contenía la opción vacía. Aislada pasaba 7 de 7: era una **carrera**, no un defecto de aserción. La
prueba culprit era

```ts
await user.selectOptions(await screen.findByLabelText('Departamento de referencia'), '15')
```

`findByLabelText` espera a que el elemento **exista**, no a que esté listo. El componente declara
`disabled={currentDepartmentState.status !== 'ready'}` y solo renderiza las opciones cuando el estado
es `ready`, así que bajo carga la prueba seleccionaba sobre un desplegable vacío y deshabilitado.

El patrón estaba en **nueve sitios de tres archivos**: `LibraryAdminPage`, `TerritorialCatalogSelector`
y `AdmissionsWorkflowLab`. `toBeEnabled()` es exactamente la condición correcta, porque el componente
habilita el desplegable y pinta sus opciones en la misma rama:

```ts
const select1 = await screen.findByLabelText('Departamento de referencia')
await waitFor(() => expect(select1).toBeEnabled())
await user.selectOptions(select1, '15')
```

Arreglar solo el que falló habría dejado ocho trampas idénticas, así que se parchearon los nueve.

### Por qué no hay un RED determinista

Un flake no se reproduce a voluntad: depende del orden de carga. La evidencia es la repetición bajo
carga, no un test que falle a propósito:

| Corrida | Resultado |
| --- | --- |
| `npm test` completa, corrida 1 | **527 pruebas en 78 archivos**, todas aprobadas |
| `npm test` completa, corrida 2 | **527 pruebas en 78 archivos**, todas aprobadas |
| Guardas de Node | **76 de 76** |
| `tsc --noEmit` | sin errores |
| `npm run lint` | 189 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos de bundle verificados |

## Nota de concurrencia

Durante esta ronda otra sesión publicó `2461444 Add public 2026-II student calendar` en `develop`, lo que
subió la suite de 521 a 527 pruebas. El fallo que se investigó venía de ese commit, no de las guardas
auditadas. La corrección se limitó a las nueve pruebas con la carrera, sin tocar el calendario.

