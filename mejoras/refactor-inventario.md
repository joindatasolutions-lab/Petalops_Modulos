# Refactor modulo de inventario

## Objetivo

Refactorizar el modulo de inventario aplicando separacion de responsabilidades, limpieza de codigo y reduccion de lineas sin cambiar contratos publicos ni objetos usados por la UI/API.

## Cambios realizados

- Se extrajo la configuracion estatica del modulo a `src/domain/inventory/inventoryConfig.jsx`:
  - definicion de submodulos de inventario;
  - opciones de color;
  - tipos de movimiento;
  - formulario base de proveedores;
  - clases de estado de inventario.
- Se extrajo logica de dominio pura a `src/domain/inventory/inventoryDomain.js`:
  - filtros de inventario;
  - calculo de niveles de stock y rotacion;
  - metricas generales y metricas de bases;
  - resumen por categorias;
  - alertas de vencimiento;
  - top de salidas;
  - ultimo movimiento por item;
  - calculos de receta y simulacion de pedido;
  - builders de payload/form para creacion de items y proveedores.
- `InventoryPage.jsx` queda enfocado en estado React, efectos, handlers y renderizado.
- Se mantuvo el re-export de `filterInventoryItems` desde `InventoryPage.jsx` para no romper pruebas/imports existentes.
- Se elimino un import sin uso (`normalizeStatus`) de `InventoryPage.jsx`.

## Principios aplicados

- Responsabilidad unica: configuracion, dominio y vista quedaron separados.
- Abierto/cerrado: las metricas y builders ahora pueden evolucionar fuera del componente principal.
- Inversion de dependencia practica: la pagina consume funciones puras en lugar de implementar reglas directamente dentro del render.
- Bajo acoplamiento: se conservaron nombres y estructura de objetos enviados al API.

## Reduccion de lineas

- `InventoryPage.jsx` antes: 2006 lineas.
- `InventoryPage.jsx` despues: 1687 lineas.
- Reduccion directa del componente: 319 lineas.
- Nuevos archivos del modulo:
  - `inventoryConfig.jsx`: 79 lineas.
  - `inventoryDomain.js`: 190 lineas.
- Total actual del modulo inventario refactorizado: 1956 lineas.
- Reduccion neta contando archivos nuevos: 50 lineas.

## Validacion

- `git diff --check -- src/domain/inventory`: sin errores.
- `npm run build`: exitoso.
- `npm test -- src/__tests__/filter-stability.test.jsx src/__tests__/views.smoke.test.jsx`: 42 pruebas exitosas.
- `npm test`: 55 pruebas exitosas.

## Alcance

Solo se modifico el modulo de inventario y este documento de mejora. No se tocaron modulos de contabilidad, usuarios, clientes, barrios ni domicilios.
