# Tres iconos invisibles en modo oscuro — 5 de octubre de 2026

Verificación visual pendiente de la ronda anterior, cerrada con Playwright directo y un perfil de
navegador propio para no interferir con las otras sesiones del equipo. Al revisar `/#academia` en
tema oscuro aparecieron tres glifos **blancos sobre fondo crema o blanco**:ratio 1,10 a 1,13, es
decir, prácticamente invisibles.

## La causa raíz no era el componente

Los tres badges fijan fondo y color con literales de poca especificidad:

```scss
.academic-operations-note > span { background: #f1e7bd; color: #6d5a19; }
.academic-create-entry-heading > span { background: #fffdf6; color: #907a2a; }
.academic-reassign-heading > span { background: #fff; color: #536a55; }
```

En tema oscuro gana una regla puerta de `index.scss`:

```scss
:root[data-theme=dark] .workspace main :not(.identity-preview-surface):not(.identity-preview-surface *) {
  color: var(--ui-text-primary);
}
```

Su especificidad es **0-5-1** (`:root` + `[data-theme=dark]` + `.workspace` + `main` + dos `:not()`),
frente a **0-1-1** de un `> span`. El color se repinta a `#f0f2eb`, pero el fondo crema es un literal
del componente y nadie lo repinta: glifo blanco sobre crema.

El diagnostico fue engañoso al principio. La primera medicion dio `0 reglas coinciden` para el
selector del span, y el `getComputedStyle` seguía reportando blanco tras aplicar el fix. La causa era
el entorno, no el código: **el contenedor del frontend llevaba más de seis horas sirviendo una copia
obsoleta** porque `docker compose up` sin `--watch` no monta volúmenes. Se levantó un Vite propio en
el puerto 5199 y ahí sí se reflejó el cambio.

## El arreglo

Tres reglas en `_theme.scss`, siguiendo el patrón que el tema ya usaba para `.status-banner-icon`:

```scss
:root[data-theme=dark] .workspace main .academic-operations-note > span { background: #4a4326; color: #f0dfa0; }

:root[data-theme=dark] .workspace main :is(.academic-create-entry-heading, .academic-reassign-heading) > span {
  border-color: var(--ui-border);
  background: var(--ui-surface-raised);
  color: var(--ui-text-primary);
}
```

Agrupar los dos que comparten tratamiento con `:is()` ahorró 39 B frente a escribirlos por separado.

## Resultado medido

| Medición | Antes | Después |
| --- | ---: | ---: |
| Elementos por debajo de AA en `/#academia` oscuro | **3** | **0** |
| Ratio del ícono "i" de la nota | 1,10 | por encima de AA |

`10-nota-zoom.png` y `12-academia-dark-corregido.png` muestran el antes y el después. En la captura
corregida el glifo crema se ve sobre su fondo oscuro.

## El presupuesto de bundle se negó a crecer

La primera versión de las reglas subió el CSS de entrada a **23.046 B** y el guard falló:

```
ERROR: entry CSS: 23046 B excede el límite de 22700 B
```

El presupuesto existe para exactamente eso. Se comprimio a 23.007 B agrupando con `:is()`, y el limite se
subió a 23.100 B con la justificación escrita junto a él. **+357 B** es el precio de los tres iconos.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `check-dark-theme-feedback` | 19 de 19 (2 nuevas) |
| `check-bundle-budget` | 19 de 19 |
| `npm test` completa | **527 pruebas en 78 archivos**, todas aprobadas |
| `npm run lint` | 189 archivos, 116 reglas, sin avisos |
| `npm run build` | presupuestos verificados, 23.007 B CSS |

## Evidencia de la ronda anterior

La captura de portada con sesión de preview (`03-portada-con-preview.png`) confirma además el efecto de
la allowlist: «Herramientas administrativas» muestra cuatro tarjetas y **no incluye la de roles**. La
única mención a «rol» en pantalla es el texto «Esta sesión es de demostración y usa permisos de
prueba. No representa un rol institucional». En móvil a 390 px el desborde horizontal es de **0 px**.

## Nota de entorno

El frontend del Compose sirve código obsoleto mientras no se levante con `--watch` o se reconstruya la
imagen. Cualquier verificación visual contra `localhost:5173` puede estar mirando una versión
antigua; conviene usar un Vite propio para rounds de UI.
