# Refactor modulo de pipeline

## Objetivo

Refactorizar el modulo de pipeline aplicando separacion de responsabilidades, limpieza de codigo y reduccion de lineas sin cambiar contratos publicos, props, payloads ni objetos usados por la UI/API.

## Cambios realizados

- Se extrajo configuracion estatica a `src/domain/pipeline/pipelineConfig.jsx`:
  - etapas y columnas del tablero;
  - mapa de etapa a estado;
  - tabs del modulo;
  - filtros iniciales;
  - opciones del selector de estados;
  - configuracion visual y estados vacios de columnas.
- Se extrajo logica pura a `src/domain/pipeline/pipelineDomain.js`:
  - normalizacion del tablero;
  - metricas del header;
  - filtrado de items por columna;
  - formato de historial y auditoria;
  - reglas del filtro de estado;
  - prioridad, tiempo restante, progreso y tipo de entrega de tarjetas;
  - normalizacion/dedupe de productos del catalogo para el modal.
- `PipelineOperativo.jsx` queda enfocado en estado React, efectos, handlers y composicion de vistas.
- `PipelineFilters.jsx`, `PipelineColumn.jsx`, `PedidoCard.jsx` y `PedidoModal.jsx` quedan mas declarativos al consumir configuracion/helpers compartidos.
- Se eliminaron imports locales y helpers duplicados que quedaron cubiertos por el dominio/configuracion.

## Principios aplicados

- Responsabilidad unica: configuracion, reglas de dominio y componentes visuales quedan separados.
- Abierto/cerrado: nuevas etapas, columnas o reglas pueden cambiar en archivos dedicados.
- Segregacion de interfaces: cada componente recibe los mismos props, pero delega calculos al helper que le corresponde.
- Bajo acoplamiento: no se alteraron payloads enviados al API ni nombres de props existentes.

## Reduccion de lineas

- Total del modulo pipeline antes: 1127 lineas.
- Total del modulo pipeline despues: 1070 lineas.
- Reduccion neta contando archivos nuevos: 57 lineas.

Detalle antes:
- `PipelineOperativo.jsx`: 537 lineas.
- `PipelineFilters.jsx`: 129 lineas.
- `PipelineColumn.jsx`: 71 lineas.
- `PedidoCard.jsx`: 112 lineas.
- `PedidoModal.jsx`: 278 lineas.

Detalle despues:
- `PipelineOperativo.jsx`: 415 lineas.
- `PipelineFilters.jsx`: 107 lineas.
- `PipelineColumn.jsx`: 46 lineas.
- `PedidoCard.jsx`: 88 lineas.
- `PedidoModal.jsx`: 210 lineas.
- `pipelineConfig.jsx`: 68 lineas.
- `pipelineDomain.js`: 136 lineas.

## Validacion

- `git diff --check -- src/domain/pipeline`: sin errores.
- `npm run build`: exitoso.
- `npm test -- src/__tests__/pipeline.filters.test.jsx src/__tests__/views.smoke.test.jsx`: 12 pruebas exitosas.
- `npm test`: 55 pruebas exitosas.

## Alcance

Solo se modifico el modulo de pipeline y este documento de mejora. No se tocaron modulos de inventario, contabilidad, usuarios, clientes, barrios ni domicilios.
