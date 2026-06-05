# Prompt maestro de sistema visual para modulos PetalOps

## Objetivo

Aplicar en cualquier modulo de PetalOps el mismo sistema visual usado actualmente en Pedidos, Produccion y Pipeline.

No modificar logica, endpoints, estados, permisos, filtros funcionales ni procesos de negocio. El cambio debe ser solo visual, de estructura responsive y de consistencia UI.

El resultado debe sentirse como un SaaS operativo moderno: limpio, premium, rapido de leer, denso pero ordenado, con una experiencia homogena entre modulos.

Referencias visuales:

- Pedidos
- Produccion
- Pipeline
- Estilo operativo tipo Linear, Monday, HubSpot y Stripe Dashboard

No usar estilo ERP clasico.

---

## Estructura general de pagina

Cada modulo debe usar un contenedor principal alineado al sidebar.

Requisitos:

- El contenido debe ocupar `width: 100%`.
- Debe tener `max-width: 100%`.
- Debe usar `box-sizing: border-box`.
- Debe cubrir el fondo rosado global del `app-shell` con el mismo fondo operativo de Produccion.
- No debe desbordarse horizontalmente en PC.
- No debe quedar desplazado hacia un lado.
- No usar margenes negativos en headers o tablas si generan desajuste.
- Mantener el mismo padding entre modulos.

Fondo obligatorio del modulo:

```css
--production-bg: #fafafb;
--production-card: #ffffff;
--production-border: #eaeaea;
--production-text: #111827;
--production-muted: #6b7280;

min-height: 100vh;
background: var(--production-bg);
color: var(--production-text);
```

Los submenus, paneles, cards, tablas y drawers internos deben usar:

```css
background: var(--production-card, #ffffff);
border-color: var(--production-border, #eaeaea);
```

No dejar secciones con fondo rosado heredado del shell.

Padding base recomendado:

```css
padding: 18px 24px 24px;
```

Responsive:

```css
@media (max-width: 760px) {
  padding: 18px 16px 18px;
}
```

Tipografia global del modulo:

```css
font-family: "Manrope", "Segoe UI", sans-serif;
```

---

## Header del modulo

El header debe verse igual en todos los modulos.

Debe tener:

- Titulo del modulo a la izquierda.
- Chip contextual junto al titulo, normalmente `Usuario: Nombre`.
- Botones de accion a la derecha.
- Fondo blanco translucido.
- Borde suave.
- Sombra ligera.
- Radio uniforme.
- Misma altura que Pedidos, Produccion y Pipeline.
- No debe llevar descripcion secundaria debajo del titulo.

Estilo base:

```css
display: flex;
align-items: center;
justify-content: space-between;
gap: 14px;
width: 100%;
max-width: 100%;
min-height: 76px;
margin: 0 0 14px;
padding: 12px 18px;
box-sizing: border-box;
border: 1px solid rgba(234, 234, 234, 0.92);
border-radius: 18px;
background: rgba(255, 255, 255, 0.94);
box-shadow: 0 10px 26px rgba(17, 24, 39, 0.045);
backdrop-filter: blur(18px);
overflow: visible;
```

### Titulo

```css
margin: 0;
color: #111827;
font-family: "Manrope", "Segoe UI", sans-serif;
font-size: clamp(24px, 3.5vw, 30px);
font-weight: 700;
line-height: 1.05;
letter-spacing: 0;
```

No mezclar fuentes entre modulos.

Regla visual:

- El titulo debe ser limpio, dominante y sin parrafos debajo.
- Si hace falta contexto, usar el chip o el contenido del modulo, no una descripcion extra en el header.

### Chip de usuario o contexto

```css
display: inline-flex;
align-items: center;
width: auto;
max-width: min(360px, 34vw);
min-height: 30px;
margin: 0;
padding: 0 12px;
border: 1px solid rgba(138, 50, 82, 0.08);
border-radius: 999px;
background: #f7eef2;
color: #8a3252;
font-size: 12px;
font-weight: 650;
line-height: 1;
white-space: nowrap;
```

En mobile puede permitir salto:

```css
white-space: normal;
line-height: 1.2;
```

---

## Botones del header

Los botones del header deben tener icono + texto.

Usar iconos de `lucide-react` siempre que exista un icono adecuado.

Formato:

```css
display: inline-flex;
align-items: center;
justify-content: center;
gap: 8px;
height: 42px;
min-height: 42px;
max-width: 100%;
padding: 0 15px;
border: 1px solid #e8dfe4;
border-radius: 14px;
background: #ffffff;
color: #8a3252;
box-shadow: 0 8px 20px rgba(17, 24, 39, 0.055);
font-size: 13px;
font-weight: 700;
line-height: 1;
white-space: nowrap;
```

Boton primario:

```css
border-color: #8a3252;
background: #8a3252;
color: #ffffff;
box-shadow: 0 10px 24px rgba(138, 50, 82, 0.22);
```

Hover:

```css
transform: translateY(-1px);
box-shadow: 0 16px 34px rgba(17, 24, 39, 0.09);
```

Si hay muchos accesos, usar un submenu desplegable.

El submenu debe:

- Abrirse junto al boton principal.
- Cerrarse al hacer click fuera o al seleccionar opcion.
- Tener fondo blanco, borde suave, sombra y radio 16px.
- Estar por encima de cards y tablas con z-index alto.

---

## Filtros

Todos los filtros deben usar el formato consolidado de Pipeline/Pedidos.

Objetivo:

```text
[ icono | contenido ]
```

Reglas:

- Un solo contenedor visual por filtro.
- Un solo borde.
- Sin label superior.
- Sin input dentro de otro input visual.
- Sin doble padding.
- Sin bordes internos en `input` o `select`.
- Sin lineas cortadas.
- Icono alineado verticalmente.
- Misma altura en todos los filtros.

Contenedor general:

```css
display: grid;
gap: 10px;
width: 100%;
max-width: 100%;
margin: 0 0 8px;
padding: 10px;
overflow: visible;
border: 1px solid #eadde3;
border-radius: 16px;
background: #ffffff;
box-shadow: none;
```

Grid recomendado:

```css
grid-template-columns: minmax(260px, 1.45fr) repeat(3, minmax(150px, 1fr));
```

Para modulos con mas filtros:

```css
grid-template-columns: minmax(230px, 1.35fr) repeat(5, minmax(132px, 1fr));
```

Control individual:

```css
display: flex;
align-items: center;
gap: 9px;
width: 100%;
min-width: 0;
height: 46px;
min-height: 46px;
padding: 0 12px;
overflow: hidden;
border: 1px solid rgba(138, 50, 82, 0.16);
border-radius: 14px;
background: #ffffff;
color: #9f2f5f;
box-shadow: none;
```

Input/select dentro del control:

```css
flex: 1 1 auto;
min-width: 0;
width: 100%;
height: auto;
min-height: 0;
padding: 0;
border: 0;
border-radius: 0;
background: transparent;
box-shadow: none;
outline: none;
color: #475569;
font-size: 13px;
```

Focus:

```css
border-color: rgba(138, 50, 82, 0.42);
box-shadow: 0 0 0 4px rgba(138, 50, 82, 0.08);
```

Responsive:

```css
@media (max-width: 1180px) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 760px) {
  grid-template-columns: 1fr;
}
```

---

## KPI cards / metricas

Las cards de metricas deben ser compactas, claras, llamativas y tecnologicas.

Cada card debe tener:

- Icono decorativo, no protagonista.
- Label corto.
- Valor principal enorme y dominante.
- Sin descripcion, nota o texto secundario debajo del valor.
- Color semantico con mas presencia visual.
- Fondo con mas contraste interno.
- Sombra multicapa premium.
- Radio consistente.
- Sensacion de energia visual, profundidad y glow.
- Jerarquia visual real entre cards segun el valor.
- Cuando el valor sea critico, la card debe verse mas intensa automaticamente.

Estilo recomendado:

```css
display: grid;
grid-template-rows: auto auto 1fr;
align-content: start;
justify-items: start;
gap: 0;
min-height: 132px;
padding: 14px 15px 16px;
border: 1px solid color-mix(in srgb, var(--metric-accent, #8a3252) 22%, rgba(148, 163, 184, 0.4));
border-radius: 24px;
background:
  radial-gradient(circle at 85% 18%, color-mix(in srgb, var(--metric-accent, #8a3252) 28%, transparent), transparent 32%),
  radial-gradient(circle at 18% 0%, rgba(255, 255, 255, 0.28), transparent 38%),
  linear-gradient(160deg, color-mix(in srgb, var(--metric-accent, #8a3252) 22%, #0f172a) 0%, color-mix(in srgb, var(--metric-accent, #8a3252) 9%, #111827) 58%, #0b1220 100%);
box-shadow:
  0 18px 40px rgba(2, 6, 23, 0.18),
  inset 0 1px 0 rgba(255, 255, 255, 0.16),
  inset 0 -24px 34px rgba(15, 23, 42, 0.14);
overflow: hidden;
position: relative;
isolation: isolate;
```

Icono:

```css
width: 30px;
height: 30px;
border-radius: 11px;
display: inline-flex;
align-items: center;
justify-content: center;
background: color-mix(in srgb, var(--metric-accent, #8a3252) 18%, rgba(255, 255, 255, 0.92));
color: color-mix(in srgb, var(--metric-accent, #8a3252) 56%, #ffffff);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.42),
  0 10px 18px color-mix(in srgb, var(--metric-accent, #8a3252) 14%, transparent);
```

Label:

```css
font-size: 10px;
font-weight: 850;
letter-spacing: 0.12em;
text-transform: uppercase;
color: color-mix(in srgb, var(--metric-accent, #8a3252) 24%, #cbd5e1);
```

Valor:

```css
margin-top: 16px;
font-size: clamp(34px, 3vw, 48px);
font-weight: 950;
line-height: 0.92;
letter-spacing: -0.04em;
color: #ffffff;
text-shadow:
  0 1px 0 rgba(255, 255, 255, 0.05),
  0 8px 20px color-mix(in srgb, var(--metric-accent, #8a3252) 22%, transparent);
```

Reglas visuales obligatorias:

- No agregar texto explicativo debajo del numero.
- No convertir la card en mini dashboard.
- El impacto debe salir del color, glow, relieve, contraste y jerarquia, no de mas texto.
- No usar barras laterales gruesas ni bordes administrativos.
- El numero debe dominar la composicion.
- El icono debe sentirse decorativo.
- Deben verse vivas, premium, oscuras y tecnicas.
- Si una metrica es critica, debe ganar glow, contraste y presencia visual automaticamente.
- Una card con valor alto debe sentirse mas importante que una con valor bajo.

Hover recomendado:

```css
transform: translateY(-2px);
border-color: color-mix(in srgb, var(--metric-accent, #8a3252) 34%, rgba(226, 232, 240, 0.82));
box-shadow:
  0 24px 44px rgba(2, 6, 23, 0.24),
  0 0 0 1px color-mix(in srgb, var(--metric-accent, #8a3252) 30%, transparent),
  inset 0 1px 0 rgba(255, 255, 255, 0.18);
```

Layout de cards:

- Desktop: todas en una fila cuando el ancho lo permita.
- Tablet: si son 6, usar 3 y 3.
- Mobile: usar 2 por fila.

Ejemplo:

```css
grid-template-columns: repeat(6, minmax(0, 1fr));

@media (max-width: 1024px) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 760px) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

---

## Tablas tipo card

Las tablas no deben sentirse como ERP clasico.

Desktop:

- Mantener densidad de informacion.
- Usar tabla-card hibrida.
- Filas con fondo blanco.
- Separacion vertical entre filas.
- Borde lateral o superior semantico.
- Radio 16px a 20px.
- Sombra suave.

Fila recomendada:

```css
border-radius: 18px;
background: #ffffff;
box-shadow: 0 10px 24px rgba(15, 23, 42, 0.055);
```

Indicador semantico:

```css
box-shadow:
  inset 4px 0 0 var(--row-accent, #8a3252),
  0 10px 24px rgba(15, 23, 42, 0.055);
```

Textos:

- Titulos: `13px - 14.5px`, peso `750 - 800`.
- Secundarios: `11px - 12px`, color `#64748b`.
- Valores importantes: peso `800`, color `#111827`.
- Badges: compactos, con radio `999px`.

Responsive:

- Tablet: card por fila, compacta.
- Mobile: card por fila, sin scroll horizontal.
- No dejar columnas cortadas.
- Mostrar `data-label` si la tabla colapsa a cards.

---

## Cards operativas / Kanban

Para tarjetas que representan pedidos, produccion, entregas o pipeline:

El diseño debe sentirse tecnologico y operativo, sin ser recargado.

Card base:

```css
position: relative;
isolation: isolate;
border: 1px solid rgba(148, 163, 184, 0.24);
border-radius: 18px;
padding: 14px 14px 13px 16px;
background:
  linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 62%, rgba(255, 255, 255, 0.98) 100%);
box-shadow:
  inset 4px 0 0 var(--card-accent, #8a3252),
  inset 0 1px 0 rgba(255, 255, 255, 0.88),
  0 10px 24px rgba(15, 23, 42, 0.075);
overflow: hidden;
```

Hover:

```css
transform: translateY(-3px);
box-shadow:
  inset 4px 0 0 var(--card-accent, #8a3252),
  inset 0 1px 0 rgba(255, 255, 255, 0.92),
  0 18px 36px rgba(15, 23, 42, 0.13),
  0 0 0 4px rgba(138, 50, 82, 0.08);
```

Usar colores semanticos:

- Retrasado: rojo `#dc2626`.
- A tiempo: verde `#16a34a`.
- Proximo a vencer: naranja `#d97706`.
- Pendiente/creado: rosado `#8a3252`.
- Produccion: azul `#2563eb`.
- Entregado/listo: verde `#15803d`.
- Cancelado: rojo `#dc2626`.

Contenido recomendado:

1. ID o numero como badge.
2. Nombre principal.
3. Producto o descripcion.
4. Valor si aplica.
5. Asignado a / responsable.
6. Estado de tiempo o estado operativo.
7. Barra de progreso si aplica.

Badges:

```css
display: inline-flex;
align-items: center;
min-height: 26px;
padding: 0 9px;
border-radius: 999px;
font-size: 11.5px;
font-weight: 800;
```

---

## Badges de estado

Todos los modulos deben usar badges consistentes.

Formato:

```css
display: inline-flex;
align-items: center;
justify-content: center;
min-height: 28px;
padding: 0 10px;
border-radius: 999px;
font-size: 11px;
font-weight: 800;
white-space: nowrap;
```

Colores:

- Creado: rosado suave.
- Aprobado: verde.
- Cancelado: rojo.
- Pendiente: naranja.
- Produccion: azul.
- Entregado: verde.
- Retrasado: rojo.
- A tiempo: verde.
- Proximo a vencer: naranja.

---

## Iconos

Usar `lucide-react`.

Reglas:

- No usar SVG manual si existe icono lucide.
- Iconos dentro de botones: `size={18}`.
- Iconos en filtros: `size={17}`.
- Iconos en cards compactas: `size={11}` a `size={18}` segun jerarquia.
- Iconos decorativos siempre con `aria-hidden="true"`.
- Botones de solo icono deben tener `aria-label`.

Iconos recomendados:

- Buscar: `Search`
- Fecha: `CalendarDays` o `Calendar`
- Filtro/estado: `Filter`
- Actualizar: `RefreshCw` o `RotateCw`
- Ver detalle: `Eye`
- Mas acciones: `EllipsisVertical`
- Pedido/lista: `ListChecks`, `ClipboardList`
- Produccion: `Flower2`, `Timer`, `Package2`
- Domicilio: `Truck`, `Bike`, `MapPin`
- Inventario: `Boxes`, `Archive`, `PackagePlus`
- Dinero/valor: `DollarSign`, `Receipt`
- Advertencia: `TriangleAlert`, `CircleX`

---

## Botones de acciones en tablas

Evitar columnas gigantes de acciones.

Usar:

- Boton compacto `Ver detalle` con icono `Eye`.
- Menu de mas acciones con `EllipsisVertical`.
- No usar muchos botones cuadrados juntos.
- Si hay varias acciones, agrupar en dropdown.

Boton compacto:

```css
display: inline-flex;
align-items: center;
justify-content: center;
gap: 7px;
height: 34px;
padding: 0 10px;
border-radius: 12px;
font-size: 12px;
font-weight: 750;
```

---

## Drawers y paneles laterales

Cuando un modulo abre detalle:

- El fondo debe quedar opaco.
- El drawer debe estar por encima del overlay.
- El drawer debe tener `z-index` mayor al backdrop.
- El overlay no debe bloquear los controles del drawer.

Recomendado:

```css
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.38);
  z-index: 80;
}

.drawer-panel {
  position: fixed;
  z-index: 90;
}
```

---

## Responsive obligatorio

Desktop:

- Header en una fila.
- Filtros en toolbar.
- Cards de metricas en una fila si caben.
- Tablas densas pero sin desborde.

Tablet:

- Header puede envolver acciones.
- Filtros en 2 o 3 columnas segun cantidad.
- Cards en filas pares, por ejemplo 3 y 3.
- Tablas/card deben conservar margen.

Mobile:

- Header en una columna.
- Botones ocupan ancho disponible.
- Filtros en una columna.
- KPI cards 2 por fila cuando sea posible.
- Tablas como cards una por fila.
- Sin scroll horizontal salvo kanban o casos estrictamente necesarios.

---

## Checklist de aplicacion

Antes de terminar cualquier modulo, validar:

- Header alineado con sidebar.
- Header con mismo alto y estilo que Pedidos/Produccion/Pipeline.
- Filtros sin doble borde.
- Inputs sin borde interno.
- Iconos alineados.
- Cards sin textos montados.
- Tablas sin columnas cortadas.
- Botones visibles y completos en PC.
- Mobile sin desbordes.
- Tablet sin cards demasiado altas.
- Build exitoso con `npm run build`.

---

## Instruccion final para el agente

Implementa este sistema visual en el modulo solicitado usando las clases existentes cuando sea posible.

No rompas funcionalidad.

No cambies logica de negocio.

No cambies endpoints.

No cambies permisos.

No elimines datos.

Si debes cambiar JSX, que sea solo para aplicar estructura visual, clases, iconos o wrappers necesarios.

Despues de aplicar los cambios, ejecutar:

```bash
npm run build
```

Y reportar los archivos modificados.
