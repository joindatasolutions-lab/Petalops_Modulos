# Refactor modulo de clientes

## Objetivo

Refactorizar el modulo de clientes aplicando principios SOLID, reduciendo responsabilidades dentro de `ClientsPage.jsx`, eliminando codigo no usado y manteniendo el comportamiento actual del modulo.

## Cambios realizados

- Se separo la logica pura de dominio en `src/domain/clients/clientsDomain.js`:
  - Normalizacion de telefono completo.
  - Validacion de rol administrador de empresa.
  - Construccion del payload para crear/actualizar clientes.
  - Adaptacion de cliente API a formulario.
  - Calculo de metricas/inteligencia de clientes.
  - Construccion de filas para exportar Excel de clientes y metricas.
- Se modularizo la interfaz en componentes de presentacion:
  - `ClientDrawer.jsx`: formulario lateral para agregar/editar clientes.
  - `ClientsHeader.jsx`: header, menu de vistas y KPIs de metricas.
  - `ClientsMetricsView.jsx`: paneles de business intelligence.
  - `ClientsTableView.jsx`: toolbar, buscador, exportacion y tabla.
- `ClientsPage.jsx` quedo como orquestador:
  - Estado de UI.
  - Carga desde API.
  - Guardado de cliente.
  - Exportacion Excel.
  - Integracion con sidebar y permisos.
- Se elimino codigo no usado detectado:
  - `displayUserName`, que se calculaba pero no se renderizaba ni se usaba en efectos/logica.
- Se mantuvieron los contratos externos:
  - `ClientsPage` conserva la misma firma de props.
  - No se cambiaron endpoints ni objetos enviados a `api.crearCliente` / `api.actualizarCliente`.
  - Se conservaron clases CSS existentes para no alterar estilos por cambio de selectores.

## Principios aplicados

- SRP: cada archivo tiene una responsabilidad concreta: dominio, header, tabla, metricas o drawer.
- OCP: nuevas vistas/paneles de clientes pueden agregarse extendiendo componentes o `CLIENTS_VIEWS` sin crecer el componente principal.
- DIP: `ClientsPage` depende de funciones puras para transformar datos, no de implementaciones visuales mezcladas con reglas de negocio.
- DRY: se centralizo el calculo de metricas y la preparacion de exportaciones para evitar duplicacion dentro del render.

## Lineas de codigo

Conteo antes:

- `src/domain/clients/ClientsPage.jsx`: 762 lineas.
- Total modulo clientes: 762 lineas.

Conteo despues:

- `src/domain/clients/ClientsPage.jsx`: 251 lineas.
- `src/domain/clients/clientsDomain.js`: 170 lineas.
- `src/domain/clients/ClientsHeader.jsx`: 97 lineas.
- `src/domain/clients/ClientsMetricsView.jsx`: 109 lineas.
- `src/domain/clients/ClientsTableView.jsx`: 63 lineas.
- `src/domain/clients/ClientDrawer.jsx`: 44 lineas.
- Total modulo clientes: 734 lineas.

Reduccion:

- `ClientsPage.jsx`: 511 lineas menos.
- Total neto del modulo: 28 lineas menos.

## Validaciones ejecutadas

- `git diff --check -- src/domain/clients`: OK.
- `npm run build`: OK.
- `npm test -- src/__tests__/views.smoke.test.jsx`: OK, 11 pruebas pasaron.
- `npm test`: OK, 7 archivos de prueba y 55 pruebas pasaron.

## Notas

- Fue necesario ejecutar `npm install` porque `node_modules` estaba incompleto y faltaba `recharts`; no se dejaron cambios en `package.json` ni `package-lock.json`.
- Quedaron fuera del cambio los archivos sin trackear existentes: `.env` y el archivo `.parquet`.

## Paginacion real de la tabla (50 por pagina)

Motivado por el punto 9 del documento de arquitectura del backend ("sin paginación consistente"): Flora ya tiene 2409 clientes reales, y `ClientsTableView` los renderizaba todos de una sola vez en una tabla plana sin virtualizar.

### Decision de diseno: paginacion en cliente, no en el fetch

Se evaluo hacer paginacion real contra el backend (que ya soporta `page`/`pageSize` desde el punto 9 del backend), pero se opto por paginar **la lista ya cargada en memoria** (`items`) en vez de cambiar la llamada a `api.listarClientes`, porque:

- `clientsIntelligence` (metricas) y `exportClientesExcel`/`exportMetricasExcel` (Excel) necesitan la lista **completa**, no solo la pagina visible. Paginar el fetch hubiera roto ambas funciones (metricas y export solo verian los primeros 50) a menos que se agregara logica adicional para volver a traer todo en esos casos.
- El backend ya devuelve toda la lista de una empresa en un solo request (acotado a 3000 por defecto, ver `pendientes/Mejoras/paginacion-fase1-clientes-inventario.md` en el repo de la API), asi que no hay ganancia real de red al paginar el fetch todavia.

Con esto, `items` (estado completo) sigue alimentando busqueda, metricas y exportacion exactamente igual que antes. Solo se agrego `pagedItems` (un `slice` de `items`) para lo que se le pasa a `ClientsTableView`.

### Cambios

- `src/domain/clients/ClientsPager.jsx` (nuevo): componente de paginacion, mismo patron visual que `OrdersPager.jsx` (reutiliza las clases CSS ya existentes `records-pager*`, sin CSS nuevo).
- `src/domain/clients/ClientsPage.jsx`:
  - Nueva constante `CLIENTS_PAGE_SIZE = 50`.
  - Nuevo estado `page`, reseteado a 1 cada vez que `items` cambia (nueva busqueda o recarga).
  - `pagedItems` (slice de `items` para la pagina actual) se pasa a `ClientsTableView` en vez de `items`.
  - `clientsIntelligence`, `exportClientesExcel`, `exportMetricasExcel` y el conteo en `ClientsMetricsView` siguen usando `items` completo, sin cambios.
  - Se reutiliza `buildPaginationItems` de `../orders-admin/ordersDomain.js` (funcion pura ya usada por el paginador de pedidos) para los numeros de pagina.

### Validado

- `npm run build`: OK, sin errores de compilacion ni imports rotos.
- `npm test`: OK, 9 archivos de prueba y 76 pruebas pasaron (nada se rompio).
- Simulacion en Node de la matematica de paginacion con datos reales: 2409 clientes (Flora) -> 49 paginas, pagina 1 muestra 1-50, ultima pagina muestra 2401-2409 (9 items); 18 clientes (Petalops) -> 1 sola pagina, paginador oculto (`pages <= 1`), comportamiento identico al actual.
- Busqueda, edicion, creacion y exportacion a Excel no se tocaron — siguen usando la lista completa (`items`), no la pagina visible.