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