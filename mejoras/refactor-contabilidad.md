# Refactor modulo de contabilidad

## Objetivo

Refactorizar el modulo de contabilidad aplicando principios SOLID, buenas practicas y limpieza de codigo, sin cambiar contratos externos ni objetos enviados/recibidos por la API.

## Cambios realizados

- Se separo la logica pura de dominio en `src/domain/accounting/accountingDomain.js`:
  - Filtro de detalle contable por descuentos, saldos, cancelados y notas.
  - Construccion de filas agregadas de ventas.
  - Construccion de metricas por arreglo.
  - Construccion de cuentas/medios de pago.
  - Extraccion de pagos y efectivo.
  - Rangos de periodo contable.
  - Parseo/redondeo de dinero.
  - Normalizacion de cierre de caja y resumen de caja.
  - Formato de notas de ajustes para exportacion.
- Se separaron piezas reutilizables de presentacion en `src/domain/accounting/AccountingViewParts.jsx`:
  - Tooltip de grafico de ventas.
  - Ranking contable.
  - Barras horizontales reutilizadas en metricas.
- `AccountingPage.jsx` quedo mas enfocado en orquestacion:
  - Estado de pantalla.
  - Carga de datos desde API.
  - Guardado de cierre de caja.
  - Exportaciones Excel.
  - Integracion con sidebar, filtros y vistas.
- Se mantuvo compatibilidad con imports existentes:
  - `filterAccountingDetailRows` se sigue reexportando desde `AccountingPage.jsx`, como lo usan las pruebas actuales.
- Se elimino codigo no usado detectado:
  - `isSaleStatus`, que no tenia llamadas activas.
  - Parametro `fallbackTotal` de `extractCashAmount`, que no se usaba dentro de la funcion.

## Principios aplicados

- SRP: reglas de negocio, helpers visuales y orquestacion quedaron separados.
- OCP: nuevas metricas/exportaciones pueden agregarse en dominio sin inflar la pagina principal.
- DIP: `AccountingPage.jsx` depende de funciones puras para transformar datos, no de implementaciones mezcladas dentro del render.
- DRY: se centralizaron calculos contables, normalizacion de caja y render de barras repetidas.

## Lineas de codigo

Conteo antes:

- `src/domain/accounting/AccountingPage.jsx`: 2288 lineas.
- Total modulo contabilidad: 2288 lineas.

Conteo despues:

- `src/domain/accounting/AccountingPage.jsx`: 1843 lineas.
- `src/domain/accounting/accountingDomain.js`: 345 lineas.
- `src/domain/accounting/AccountingViewParts.jsx`: 57 lineas.
- Total modulo contabilidad: 2245 lineas.

Reduccion:

- `AccountingPage.jsx`: 445 lineas menos.
- Total neto del modulo: 43 lineas menos.

## Validaciones ejecutadas

- `git diff --check -- src/domain/accounting`: OK.
- `npm run build`: OK.
- `npm test -- src/__tests__/filter-stability.test.jsx src/__tests__/views.smoke.test.jsx`: OK, 42 pruebas pasaron.
- `npm test`: OK, 7 archivos de prueba y 55 pruebas pasaron.

## Notas

- No se cambiaron endpoints ni nombres de payloads usados para resumen contable, cierres de caja o exportaciones.
- No se tocaron estilos CSS ni otros modulos.
- Quedaron fuera del cambio los archivos locales sin trackear existentes: `.env` y el archivo `.parquet`.