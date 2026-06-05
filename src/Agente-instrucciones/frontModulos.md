# Prompt de continuidad visual para módulos PetalOps

## Objetivo general

Aplicar en los demás módulos el mismo lenguaje visual usado en **Pedidos** y **Producción**, manteniendo la funcionalidad existente intacta.

La interfaz debe sentirse uniforme al cambiar entre módulos: misma estructura de página, misma barra superior, misma tipografía, mismos botones, mismas tarjetas, misma tabla-card y mismo comportamiento responsive.

No rediseñar desde cero. Usar el diseño actual de Pedidos y Producción como referencia visual principal.

---

## Estructura general del módulo

Cada módulo debe usar una vista principal contenida, alineada al menú lateral.

Requisitos:

- El contenido no debe salirse del ancho visible del PC.
- No debe aparecer una “punta” o contenido cortado hacia la derecha.
- Usar `box-sizing: border-box`.
- Usar `width: 100%` y `max-width: 100%`.
- Evitar `width: calc(100% + ...)` salvo que sea estrictamente necesario.
- Evitar márgenes negativos en barras principales si generan desborde.
- El módulo debe iniciar alineado visualmente con el sidebar.
- El padding base recomendado:
  - Desktop: `18px 24px 24px`
  - Tablet: `14px 16px 20px`
  - Mobile: `12px`

La vista debe usar la misma tipografía:

```css
font-family: "Manrope", "Segoe UI", sans-serif;
```

---

## Barra superior del módulo

La barra que contiene el título debe ser homogénea en todos los módulos.

Debe verse como la barra de Pedidos y Producción:

- Fondo blanco translúcido.
- Borde suave.
- Sombra ligera.
- Radio moderado.
- Título a la izquierda.
- Chip de usuario o estado contextual junto al título.
- Botones de acción a la derecha.

Estilo base recomendado:

```css
display: flex;
align-items: center;
justify-content: space-between;
gap: 14px;
min-height: 76px;
width: 100%;
max-width: 100%;
padding: 12px 18px;
margin: 0 0 14px;
box-sizing: border-box;
border: 1px solid rgba(234, 234, 234, 0.92);
border-radius: 18px;
background: rgba(255, 255, 255, 0.94);
box-shadow: 0 10px 26px rgba(17, 24, 39, 0.045);
backdrop-filter: blur(18px);
```

### Título

El título debe tener el mismo estilo en todos los módulos:

```css
font-family: "Manrope", "Segoe UI", sans-serif;
font-size: clamp(24px, 3.5vw, 30px);
font-weight: 700;
line-height: 1.05;
letter-spacing: 0;
color: #111827;
```

No mezclar fuentes distintas entre módulos. Al cambiar de Pedidos a Producción o a otro módulo, el título no debe cambiar de estilo.

### Chip de usuario/contexto

Cuando aplique, mostrar un chip como:

```text
Usuario: Nombre
```

Estilo:

```css
display: inline-flex;
align-items: center;
min-height: 30px;
padding: 0 12px;
border: 1px solid rgba(138, 50, 82, 0.08);
border-radius: 999px;
background: #f7eef2;
color: #8a3252;
font-size: 12px;
font-weight: 650;
white-space: nowrap;
```

---

## Botones del header

Los botones del header deben tener el mismo formato que Pedidos y Producción:

- Alto constante.
- Icono + texto.
- Radio de 14px.
- Sombra suave.
- Texto Manrope.
- Color principal PetalOps.
- No deben quedar cortados en PC.
- En tablet y mobile pueden pasar a segunda línea o grilla.

Estilo base:

```css
display: inline-flex;
align-items: center;
justify-content: center;
gap: 8px;
min-height: 42px;
height: 42px;
padding: 0 15px;
border: 1px solid #e8dfe4;
border-radius: 14px;
background: #ffffff;
color: #8a3252;
box-shadow: 0 8px 20px rgba(17, 24, 39, 0.055);
font-size: 13px;
font-weight: 700;
white-space: nowrap;
```

Botón principal:

```css
border-color: #8a3252;
background: #8a3252;
color: #ffffff;
box-shadow: 0 10px 24px rgba(138, 50, 82, 0.22);
```

Responsive:

- Desktop: botones en línea.
- Si no caben: permitir `flex-wrap`.
- Tablet/mobile: usar grilla de 2 columnas si hay varios botones.
- Mobile muy pequeño: 1 columna.

---

## Cards KPI / Métricas

Las cards de métricas deben verse iguales en todos los módulos.

Estructura visual:

- Card con fondo pastel suave.
- Icono claro y entendible.
- Título breve.
- Número fuerte.
- Sin descripciones largas como “Ver pedidos de hoy”.
- El contenido no debe montarse en tablet/celular.

Layout desktop:

- 5 cards en una fila cuando haya 5 métricas.
- Usar `grid-template-columns: repeat(5, minmax(0, 1fr))`.
- Gap aproximado: `10px`.

Colores sugeridos:

```css
1: fondo #eef2ff, acento #4f46e5
2: fondo #ecfdf5, acento #16a34a
3: fondo #fff7ed, acento #ea580c
4: fondo #fef2f2, acento #dc2626
5: fondo #f5f3ff, acento #7c3aed
```

Formato interno:

```css
display: grid;
grid-template-columns: 36px minmax(0, 1fr);
align-items: center;
min-height: 104px;
padding: 13px 12px;
border-radius: 20px;
box-shadow: 0 12px 28px rgba(17, 24, 39, 0.055);
```

Iconos:

- Usar iconos reales de `lucide-react`.
- No usar pseudo-iconos hechos con rayas CSS.
- El icono debe representar claramente la métrica.

Ejemplos:

- Lista / visibles: `ListChecks`
- Hoy: `CalendarCheck2`
- Sin asignar: `UserX`
- Atrasados: `TriangleAlert`
- Futuros: `CalendarClock`
- Aprobados: `CheckCircle2`
- Pendientes: `Clock3`
- Cancelados: `XCircle`
- Facturas: `Receipt`

Responsive KPI:

- Tablet:
  - Si son 5 cards, mantener una misma fila si cabe.
  - Compactar icono, fuente y padding.
- Celular:
  - Dos cards por fila.
  - Icono a la izquierda.
  - Título y número a la derecha.
  - Evitar que el icono se monte encima del título.

---

## Filtros

Los filtros deben tener el mismo formato que Pedidos y Producción:

- Barra blanca.
- Borde suave.
- Radio 16px.
- Controles de 46px de alto.
- Icono + input/select/dropdown.
- Sin títulos visibles encima del control.
- Alineados en una misma altura.

Estilo base:

```css
display: grid;
gap: 10px;
padding: 10px;
margin-bottom: 8px;
border: 1px solid #eaeaea;
border-radius: 16px;
background: #ffffff;
box-shadow: none;
align-items: center;
```

Control:

```css
min-height: 46px;
height: 46px;
border: 1px solid #e2e8f0;
border-radius: 14px;
background: #ffffff;
box-shadow: none;
```

### Filtro Estados

El filtro de estados debe ser desplegable tipo Producción:

- Texto visible: `Estados`
- Icono de filtro.
- Panel dropdown.
- Checkboxes si permite múltiples estados.
- Radio buttons si permite solo un estado.
- Debe ir de último en la fila cuando aplique.

No usar texto “Todos los estados” como label visible principal. Esa opción puede estar dentro del dropdown como `Todos`.

---

## Tablas tipo tabla-card

Las tablas deben adoptar el formato híbrido de Pedidos:

- No tabla ERP clásica.
- Filas como cards horizontales.
- Separación vertical entre filas.
- Borde lateral de color según estado.
- Radio en primera y última celda.
- Sombra suave.
- Header compacto.

Contenedor:

```css
padding: 8px;
border: 1px solid #eaeaea;
border-radius: 20px;
background: linear-gradient(180deg, #ffffff 0%, #fafafb 100%);
box-shadow: 0 18px 42px rgba(17, 24, 39, 0.06);
```

Tabla:

```css
border-collapse: separate;
border-spacing: 0 10px;
font-family: "Manrope", "Segoe UI", sans-serif;
```

Encabezados:

```css
padding: 10px 16px 12px;
background: transparent;
border-bottom: 0;
color: #64748b;
font-size: 12px;
font-weight: 700;
letter-spacing: 0.08em;
text-transform: uppercase;
```

Celdas:

```css
padding: 16px;
background: #ffffff;
color: #111827;
font-size: 14px;
font-weight: 500;
box-shadow: 0 8px 22px rgba(17, 24, 39, 0.035);
```

Primera celda:

```css
border-radius: 18px 0 0 18px;
box-shadow: inset 4px 0 0 var(--row-accent), 0 8px 22px rgba(17, 24, 39, 0.035);
```

Última celda:

```css
border-radius: 0 18px 18px 0;
```

Hover:

```css
background: var(--row-bg-hover);
box-shadow: 0 12px 28px rgba(17, 24, 39, 0.06);
```

---

## Badges

Los badges deben ser compactos, legibles y consistentes.

Base:

```css
display: inline-flex;
align-items: center;
justify-content: center;
min-height: 34px;
padding: 0 12px;
border-radius: 999px;
font-size: 13px;
font-weight: 850;
white-space: nowrap;
box-shadow: inset 0 0 0 1px rgba(17, 24, 39, 0.04);
```

Estados sugeridos:

```css
Creado / Pendiente: fondo #ffedd5, texto #c2410c
Aprobado / Entregado: fondo #dcfce7, texto #166534
Producción: fondo #dbeafe, texto #1d4ed8
Cancelado / Rechazado: fondo #fee2e2, texto #991b1b
Futuro: fondo #f5f3ff, texto #6d28d9
```

---

## Valores y números

Los valores monetarios y números importantes no deben cortarse.

Reglas:

- Usar `white-space: nowrap`.
- Evitar `overflow: hidden` en columnas críticas.
- Dar ancho suficiente a columnas de `Estado`, `Valor`, `Estado tiempo` o similares.
- Si la pantalla no alcanza, usar scroll controlado dentro del contenedor, no desbordar toda la página.

---

## Drawers / panel lateral de detalle

Cuando se abre `Ver detalle`:

- El fondo puede verse opaco.
- El drawer debe estar por encima del fondo.
- El usuario debe poder presionar todos los botones y controles dentro del drawer.

Z-index recomendado:

```css
backdrop: z-index 70;
drawer: z-index 90;
```

El drawer debe tener:

- Fondo blanco o gris muy claro.
- Header compacto.
- Información organizada en bloques.
- En mobile puede ser bottom sheet.

---

## Responsive y adaptabilidad

### Desktop

- Header en una fila.
- Botones a la derecha.
- KPIs en una fila si caben.
- Tabla tipo card horizontal.
- No debe existir desborde horizontal global.

### Tablet

- Header puede partir acciones a segunda línea si no caben.
- KPIs pueden mantenerse en una fila si son compactos.
- Tablas pueden convertirse en cards o usar scroll controlado dentro del contenedor.
- Si se usan cards responsive, deben ser compactas, una por fila si el módulo lo requiere.
- Evitar cards excesivamente altas.

### Celular

- Header en una columna.
- Botones en 1 o 2 columnas según cantidad.
- KPIs en 2 columnas.
- Tablas complejas deben transformarse a cards.
- Cards una por fila para listados operativos.
- Reducir padding, gap, iconos y fuente sin perder legibilidad.

---

## Cards responsive de listados

Cuando una tabla se convierte en cards en tablet/celular:

- Una card por fila si representa un registro completo.
- No crear “cards dentro de cards” pesadas.
- Usar secciones compactas con etiqueta + valor.
- Mantener borde lateral por estado.
- Usar fondo suave según estado.
- Evitar altura excesiva en tablet.

Card base:

```css
padding: 11px 12px;
border: 1px solid #eaeaea;
border-radius: 16px;
background: #ffffff;
box-shadow: inset 4px 0 0 var(--accent), 0 8px 22px rgba(17, 24, 39, 0.04);
```

Tablet:

- Compactar a varias columnas internas.
- Reducir `padding`.
- Reducir `gap`.
- Botones más bajos.

Mobile:

- Una columna.
- Etiqueta + valor.
- Evitar truncar información crítica.

---

## Reglas de no romper funcionalidad

Al aplicar estas instrucciones:

- No cambiar endpoints.
- No cambiar filtros funcionales.
- No cambiar handlers.
- No cambiar estados ni reglas de negocio.
- No cambiar permisos.
- No tocar base de datos.
- Preferir CSS y estructura visual.
- Si se modifica JSX, que sea solo para agrupar contenido visual o reemplazar iconos.

---

## Prompt corto para usar en otros módulos

Aplicar al módulo actual el mismo lenguaje visual de Pedidos y Producción en PetalOps. Unificar header, título, chip de usuario, botones, filtros, KPIs, tabla-card, badges, drawer y responsive. Usar fuente Manrope, colores PetalOps, sombras suaves, radios consistentes, filas tipo card con borde lateral por estado, controles de filtro de 46px, cards KPI compactas y responsive. En desktop evitar cualquier desborde horizontal; en tablet compactar sin perder información; en celular usar 2 columnas para KPIs y cards una por fila para listados. Mantener toda la funcionalidad existente intacta.

