# Refactor modulo de barrios

## Objetivo

Refactorizar el modulo de barrios aplicando principios SOLID, buenas practicas y limpieza de codigo, sin cambiar contratos externos ni objetos enviados a la API.

## Cambios realizados

- Se separo la logica pura de dominio en `src/domain/neighborhoods/neighborhoodsDomain.js`:
  - Normalizacion de busqueda.
  - Formato de moneda.
  - Resolucion de zona visible.
  - Filtros por busqueda, estado, zona y costo.
  - Ordenamiento por nombre y costo.
  - Calculo de metricas.
  - Construccion de payloads para crear y actualizar barrios.
  - Construccion de filas de exportacion Excel.
  - Parseo de filas de importacion Excel.
- Se separo la UI en `src/domain/neighborhoods/NeighborhoodsView.jsx`:
  - Header de Barrios.
  - Tarjetas de metricas.
  - Panel de creacion.
  - Toolbar, tabla, paginacion y acciones por fila.
  - Tip/importacion Excel.
- `NeighborhoodsPage.jsx` quedo como orquestador:
  - Estado de pantalla.
  - Llamadas API.
  - Guardado, borrado, importacion/exportacion.
  - Integracion con sidebar, permisos y navegacion.
- Se mantuvieron exports existentes:
  - `filterNeighborhoodItems` y `sortNeighborhoods` se siguen exportando desde `NeighborhoodsPage.jsx`, para no romper pruebas ni imports actuales.
- Se elimino codigo no usado:
  - La metrica interna `active`, que se calculaba pero no se renderizaba ni se usaba en ninguna decision.

## Principios aplicados

- SRP: dominio, vista y orquestacion quedaron separados.
- OCP: nuevos filtros, metricas o paneles pueden agregarse extendiendo archivos especificos sin crecer la pagina principal.
- DIP: la pagina depende de funciones puras para transformar datos y payloads, no de reglas mezcladas dentro del JSX.
- DRY: exportacion, importacion, filtros, paginacion y payloads quedaron centralizados.

## Lineas de codigo

Conteo antes:

- `src/domain/neighborhoods/NeighborhoodsPage.jsx`: 681 lineas.
- Total modulo barrios: 681 lineas.

Conteo despues:

- `src/domain/neighborhoods/NeighborhoodsPage.jsx`: 206 lineas.
- `src/domain/neighborhoods/neighborhoodsDomain.js`: 105 lineas.
- `src/domain/neighborhoods/NeighborhoodsView.jsx`: 79 lineas.
- Total modulo barrios: 390 lineas.

Reduccion:

- `NeighborhoodsPage.jsx`: 475 lineas menos.
- Total neto del modulo: 291 lineas menos.

## Validaciones ejecutadas

- `git diff --check -- src/domain/neighborhoods`: OK.
- `npm run build`: OK.
- `npm test -- src/__tests__/filter-stability.test.jsx src/__tests__/views.smoke.test.jsx`: OK, 42 pruebas pasaron.
- `npm test`: OK, 7 archivos de prueba y 55 pruebas pasaron.

## Notas

- No se cambiaron endpoints ni nombres de objetos enviados a `crearBarrioDomicilios`, `actualizarBarrioDomicilios` o `borrarBarrioDomicilios`.
- Se conservaron clases CSS existentes para evitar afectar estilos.
- Quedaron fuera del cambio los archivos locales sin trackear existentes: `.env` y el archivo `.parquet`.