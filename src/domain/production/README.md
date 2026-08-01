# Modulo Production

Este documento describe la organizacion del modulo `production`, la responsabilidad de cada archivo y la forma recomendada de mantenerlo. El objetivo del modulo es coordinar la operacion de produccion de arreglos: listar pedidos de produccion, filtrar por estado o metricas, asignar/reasignar floristas, cambiar estados, gestionar disponibilidad/incapacidad y mostrar imagenes del producto sin perder la experiencia visual definida por CSS.

## Vision general

El modulo esta separado en capas:

- `ProductionPage.jsx`: orquestador principal. Conecta API, permisos, estado raiz, hooks y componentes.
- `hooks/`: encapsulan efectos, acciones y modelos derivados.
- `components/`: renderizan la interfaz usando las clases CSS existentes.
- `productionDomain.js`: reglas puras del dominio de produccion.
- `productionCatalogImages.js`: resolucion de catalogo, producto e imagenes.
- `productionViewModel.js`: calculos de vista, metricas y filtros derivados.
- `productionConstants.js`: constantes compartidas del modulo.

La regla de mantenimiento es que `ProductionPage.jsx` no debe volver a crecer con JSX complejo ni logica de negocio extensa. Si aparece una nueva responsabilidad, debe ir en un hook, componente o helper del dominio.

## Flujo de datos

1. `ProductionPage.jsx` crea el cliente API y calcula permisos desde `session`.
2. `useProductionItems` carga items de produccion desde backend aplicando filtros de fecha, estado, busqueda y metricas.
3. `useProductionFloristas` carga floristas y deriva el florista actual del usuario.
4. `useProductionListView` calcula lista visible, metricas, pagina actual y filtros activos.
5. `useProductionImages` resuelve catalogo e imagenes para los productos visibles.
6. `useProductionActions` agrupa acciones mutables contra API.
7. Los componentes reciben datos ya preparados y renderizan la UI con las clases CSS existentes.

## Archivos raiz

### `ProductionPage.jsx`

Es el orquestador del modulo. Sus responsabilidades son:

- Crear `api` con `createApiClient`.
- Resolver `empresaId`, `sucursalId` y permisos del usuario.
- Mantener estado raiz necesario para filtros, drawers, formulario de incapacidad, busqueda y paginacion.
- Conectar hooks de datos, imagenes, floristas, acciones y lista.
- Componer `AppSidebar`, `ProductionHeader`, `ProductionOrdersView`, paneles secundarios y drawers.
- Reexportar funciones del dominio que aun usan tests u otros modulos.

No deberia contener:

- Tablas, cards, drawers o paneles completos en JSX.
- Fetches directos nuevos.
- Algoritmos de filtrado, agrupacion o resolucion de imagenes.
- Payloads complejos de acciones contra API.

### `productionDomain.js`

Contiene reglas puras del dominio de produccion. Es el lugar para funciones que:

- Normalizan estados, roles, busquedas y fechas.
- Determinan clases visuales por estado.
- Calculan vencimiento/tiempo de entrega.
- Agrupan items de produccion por pedido.
- Identifican si un florista esta activo.
- Resuelven codigos de producto/catalogo.
- Transforman pedidos cancelados en items de produccion.
- Evalúan metricas como pendientes de hoy, atrasados o sin asignar.

Debe mantenerse sin dependencias de React ni efectos. Sus funciones deben ser testeables con entradas y salidas puras.

### `productionCatalogImages.js`

Centraliza la resolucion de productos e imagenes:

- Normaliza productos del catalogo.
- Extrae filas de distintos formatos de payload.
- Construye indices de catalogo por id, codigo, codigo de catalogo y nombre.
- Busca coincidencias entre item de produccion, pedido, pipeline y catalogo.
- Resuelve imagen directa, imagen cacheada o imagen derivada del catalogo.
- Construye llaves de cache para imagenes.
- Expone helpers de paginacion usados por la vista.

Este archivo existe para que la UI no conozca los detalles de los posibles formatos del backend.

### `productionViewModel.js`

Agrupa calculos orientados a pantalla:

- `calculateProductionMetrics`: calcula totales visibles, pendientes, sin asignar, atrasados y futuros.
- `productionMetricMeta`: devuelve textos descriptivos de la metrica activa.
- `filterProductionItemsByMetric`: filtra la lista segun la metrica seleccionada.

Debe contener logica de presentacion derivada, no llamadas a API ni mutaciones.

### `productionConstants.js`

Define constantes compartidas:

- Estados de filtro por defecto.
- Estados posibles del florista.
- Usuario fallback para auditoria.
- Opciones de tamano de pagina.
- URL de Looker Studio.
- Opciones del submenu de produccion.

Si un valor se comparte entre varios componentes o hooks, debe vivir aqui.

## Hooks

### `hooks/useProductionItems.js`

Carga la lista de produccion desde backend. Maneja:

- `loading`, `error`, `items` y `productionMetricas`.
- Filtros por fecha, estado, busqueda y metrica.
- Fallbacks cuando una metrica no devuelve resultados aunque el contador indique datos.
- Busqueda en pipeline cuando no hay resultados directos.
- Inclusion de pedidos cancelados cuando el filtro lo solicita.
- Normalizacion final de estados antes de exponer la lista.

Recibe un objeto `rules` con funciones puras para reducir acoplamiento y facilitar pruebas.

### `hooks/useProductionImages.js`

Gestiona catalogo e imagenes:

- Carga catalogo base.
- Busca productos adicionales segun items visibles.
- Detecta items sin imagen confiable.
- Resuelve imagen desde catalogo, lista de pedidos, detalle de pedido o pipeline.
- Actualiza la cache `productionProductImages`.
- Retorna `catalogProductIndex` para que los componentes puedan resolver previews.

La pagina mantiene algunos estados por compatibilidad con pruebas, pero la logica de efectos vive aqui.

### `hooks/useProductionFloristas.js`

Gestiona floristas:

- Carga floristas internos y disponibilidad con externos.
- Combina ambas fuentes para detectar el florista actual.
- Deriva `currentFloristaId`.
- Deriva `ownFloristaDisponibilidad`.
- Expone `canChangeOwnProductionState` para validar acciones de florista.
- Expone `loadFloristaData` para refrescos coordinados.

No ejecuta acciones de actualizacion; esas viven en `useProductionActions`.

### `hooks/useProductionListView.js`

Prepara la vista de lista:

- Calcula `visibleItems`.
- Calcula metricas de header.
- Aplica filtro por metrica activa.
- Calcula paginacion, rango visible y paginas.
- Reinicia pagina cuando cambian filtros.
- Corrige pagina si queda fuera de rango.
- Expone acciones de filtro como `focusMetric`, `toggleEstadoFiltro` y `selectAllProductionStatuses`.

Este hook evita que `ProductionPage.jsx` tenga calculos de UI repetidos.

### `hooks/useProductionActions.js`

Agrupa acciones mutables del modulo:

- Refrescar items y floristas.
- Autoasignar pedidos de hoy.
- Generar produccion desde pedidos.
- Abrir/cerrar drawer de detalle.
- Abrir/cerrar drawer de asignacion.
- Actualizar seleccion de florista o estado.
- Asignar y reasignar floristas.
- Cambiar estado de produccion.
- Cambiar estado rapido desde vista de florista.
- Recalcular produccion de un pedido.
- Actualizar estado/incapacidad de florista.
- Alternar disponibilidad de florista.

Debe ser el lugar por defecto para nuevas acciones que llamen API o cambien varios estados coordinados.

## Componentes

### `components/ProductionHeader.jsx`

Renderiza el encabezado superior:

- Titulo del modulo.
- Fecha actual de produccion.
- Busqueda general.
- Menu de vistas: pedidos, disponibilidad, incapacidad y Looker.
- Boton de actualizacion.
- Tarjetas de metricas superiores.

No calcula metricas; solo recibe datos y callbacks.

### `components/ProductionOrdersView.jsx`

Renderiza la vista principal de pedidos:

- Workspace movil.
- Buscador movil.
- KPIs moviles.
- Tabs de estado.
- Filtros desktop.
- Mensajes de loading/error/vacio.
- Tabla desktop.
- Paginador.
- Capsulas/resumen.
- Acciones visibles por item.

Recibe lista y callbacks ya preparados. No debe hacer fetch ni modificar datos directamente.

### `components/ProductionDrawers.jsx`

Renderiza los paneles laterales:

- Drawer de detalle operativo del pedido.
- Hero con imagen/producto.
- Grid de datos del pedido.
- Notas/observaciones.
- Bloque de asignacion/reasignacion.
- Bloque de cambio de estado.
- Bloque de recalculo.
- Drawer independiente de asignacion.

Tambien contiene `ProductionAssignmentCard`, reutilizado por ambos drawers.

### `components/ProductionSecondaryPanels.jsx`

Renderiza vistas secundarias:

- `ProductionAvailabilityPanel`: disponibilidad de floristas, capacidad y toggle activo/inactivo.
- `ProductionIncapacityPanel`: formulario y listado de incapacidades.
- `ProductionLookerPanel`: iframe de Looker Studio.

Estos paneles conservan las clases CSS existentes y reciben acciones desde el orquestador.

## Convenciones de mantenimiento

- Mantener cambios dentro de `src/domain/production` para esta rama.
- No modificar CSS si la tarea es solo modularizacion.
- No mover reglas puras a componentes.
- No meter llamadas API en componentes presentacionales.
- No duplicar normalizaciones de payload; usar `productionDomain.js` o `productionCatalogImages.js`.
- Si se agrega una accion con API, ubicarla en `useProductionActions`.
- Si se agrega una nueva derivacion visual, ubicarla en `productionViewModel.js` o `useProductionListView`.
- Si se agrega una nueva seccion visual, crear componente en `components/`.
- Mantener `ProductionPage.jsx` como composicion y coordinacion.

## Pruebas recomendadas

Despues de cambios en este modulo, ejecutar:

```bash
npm.cmd test -- production.recalculation-flow.test.jsx
npm.cmd run build
```

En este entorno, `npm.cmd run build` puede requerir ejecucion fuera del sandbox porque Vite intenta leer `vite.config.js` y el sandbox bloquea rutas superiores.

