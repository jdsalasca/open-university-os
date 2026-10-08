# ¿Qué costaría cambiar a SQLite? — 7 de octubre de 2026

## La pregunta

«Una universidad no tiene más de 100 mil estudiantes: todo puede ejecutarse en un SQLite». La escala
en filas nunca fue el argumento en contra —SQLite lee millones de filas sin problema— sino las
transacciones, la concurrencia, las migraciones y la operación. Este inventario mide el costo del
cambio con el código en la mano, en vez de discutirlo en abstracto. No decide el cambio: lo
dimensiona para el ADR que sí lo decidiría.

`inventario.mjs` revisa las 27 migraciones Flyway y los 337 archivos Java del backend buscando
construcciones específicas de MySQL.

```
node docs/evidence/round-2026-10-07-sqlite-inventario/inventario.mjs [salida.txt]
```

## Resultado

**Migraciones (DDL): casi portable.**

| Construcción | Veces | Costo en SQLite |
| --- | ---: | --- |
| `TIMESTAMP(n)` con precisión | 43 | Ninguno: SQLite acepta el nombre de tipo y la ignora |
| `AUTO_INCREMENT` | 11 | Reescribir: solo vale `AUTOINCREMENT` sobre `INTEGER PRIMARY KEY` |
| backticks | 1 | Trivial |

**Consultas Java: aquí está el costo real.**

| Construcción | Veces | Costo en SQLite |
| --- | ---: | --- |
| `SELECT ... FOR UPDATE` | **7**, en 6 adaptadores (academia ×3, admisiones, marca, identidad, biblioteca) | **No existe**: son los bloqueos que protegen reasignaciones, aprobaciones, revocaciones y cierres concurrentes. Habría que repensar el control de concurrencia, no traducir sintaxis |

Cero funciones `JSON_*`, cero `GROUP_CONCAT`, cero `ON DUPLICATE`: el resto del SQL es estándar.

## Lo que el inventario no incluye (y también costaría)

- Las 27 migraciones Flyway son dialecto MySQL y están verificadas por contrato contra MySQL 8.4 en
  CI. Un segundo dialecto duplica cada migración futura.
- Los contratos MySQL (`*MySqlContractTest`), el simulacro de respaldo (`mysqldump`) y el pool medido
  presuponen el motor actual.
- El perfil `sqlite` existe solo para arrancar sin contenedor, con Flyway apagado y sin migraciones:
  correr la suite ahí no prueba nada y no se hizo.

## Conclusión honesta

Técnicamente es viable con trabajo acotado pero no trivial: 11 reescrituras DDL + repensar 7
bloqueos + segundo dialecto de migraciones a perpetuidad. Nada de eso cambia los gates
institucionales, y la escala en filas no decide el motor: lo deciden la concurrencia, las
transacciones, los respaldos y la operación. MySQL sigue siendo el objetivo hasta que un ADR diga lo
contrario con estos números delante.
