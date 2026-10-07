# Pedidos: prueba local de carga y decisiones

Ejecución: 2026-09-27. No se modificó infraestructura ni se enviaron solicitudes a servicios reales.

## Repetir

Desde la raíz del frontend:

```powershell
node tests/load/orders-load.mjs
npm.cmd test -- src/__tests__/orders-data-controller.test.js src/__tests__/orders-search-dates.test.js --reporter=dot
```

El script sobrescribe `orders-load-results.json`. Usa el controlador y filtrado actuales con una API en memoria. No usa credenciales, fetch, HTTP ni PostgreSQL. Cada empleado representa un controlador independiente, como una pestaña; todos se ejecutan dentro del mismo proceso Node.

## Matriz ejecutada

- 100, 500, 1.000, 5.000 y 10.000 candidatos por empresa.
- 1 empresa x 1 empleado; 1 x 5; 3 x 5; 3 x 20 (60 controladores).
- Flujo normal y filtro por pago: 40 escenarios.
- Un escenario adicional de 3 empresas x 5 empleados, 1.000 candidatos y respuesta simulada de 50 ms.
- En cada carga: dos refrescos simultáneos y una repetición con caché fresca.
- Comprobaciones: filas limitadas a 10, total correcto, empresa de los resultados, deduplicación de solicitudes y reutilización de caché.

Resultado: 41 escenarios aprobados. Además, 30 pruebas de coordinación/búsqueda aprobadas, incluidas respuestas fuera de orden, cancelación, errores, timeout, conservación de resultados e invalidación.

La comprobación multitenant del simulador valida el encaminamiento del cliente y sus cachés; no demuestra autorización ni aislamiento del backend. No se simulan escrituras ni conflictos de PostgreSQL.

## Comparación verificable con la línea base

La línea base procede de la ejecución en memoria anterior a fase 1 registrada el 26 de septiembre. Se comparan conteos por una carga inicial de un empleado, con candidatos coincidentes y página de 10 filas:

| Candidatos | Normal antes/ahora | Pago antes/ahora |
|---:|---:|---:|
| 100 | 1 / 1 | 1 / 1 |
| 500 | 1 / 1 | 5 / 5 |
| 1.000 | 1 / 1 | 10 / 10 |
| 5.000 | 1 / 1 | 50 / 50 |
| 10.000 | 1 / 1 | 100 / 100 |

La primera carga no redujo solicitudes. Sí se verificó que los refrescos simultáneos comparten la petición y la repetición inmediata desde caché añade cero solicitudes. No se publica una mejora porcentual de latencia: las simulaciones tienen distinta metodología, y no existe una línea base HTTP/PostgreSQL.

En el escenario mayor: 60 empleados, 3 empresas y 10.000 candidatos por empresa, filtro de pago:

- 6.000 llamadas al mock; concurrencia máxima de 60.
- 57.617.280 bytes de JSON sintético, sin compresión ni cabeceras HTTP.
- 0 llamadas adicionales por la repetición inmediata con caché.
- Duración local de la tanda: 3.608,83 ms con retardo artificial de 2 ms por respuesta.
- p50/p95/p99 de finalización local: 2.511,34 / 3.505,98 / 3.607,75 ms, sobre 60 muestras.

Estos tiempos incluyen la cola del event loop, la serialización del simulador y el filtrado. No son latencias del backend, resultados de navegador ni estimaciones de capacidad. Una sola tanda no caracteriza percentiles de producción ni carga sostenida.

## Backend local revisado: hay cambios desde la auditoría original

En `joinflower-api/joinflower-api/app/routers/pedido.py`, `listar_pedidos` ya usa LIMIT/OFFSET; `_pedido_list_statistics` agrega en SQL. `app/core/delivery_queries.py` selecciona la entrega por intento descendente y desempata por ID, dentro de empresa/pedido. No se ha verificado despliegue ni ejecutado este backend.

El frontend aún descarga candidatos para pagos y búsqueda combinada con estado. No basta eliminar ese recorrido: el endpoint revisado no recibe `metodoPago` y sigue omitiendo el estado cuando hay `q`. Hay que cerrar ese contrato antes de cambiar ambos consumidores. La migración `sql/create_factura_impresa_function.sql` también es una dependencia declarada del backend; no se ejecutó.

## Índices y planes

Se revisaron los scripts locales de índices para cliente/empresa, pedido/empresa/cliente/fecha/estado, detalles/empresa/pedido/producto, pagos por método y canal de venta. Existen scripts históricos con nombres diferentes del modelo actual: no se presume que estén instalados.

`orders-index-inventory.sql` queda preparado para inventariar índices, estadísticas y la función de impresión en el entorno de prueba autorizado. No se ejecutó. Ningún índice ni plan real quedó comprobado.

Con SQL real capturado de los endpoints, ejecutar EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) exclusivamente sobre SELECT en la base aislada, con límites de tiempo y datos sintéticos. Comparar página inicial/final, filtros de fecha/estado/pago, búsquedas frecuentes/raras e impresión pendiente. Revisar filas estimadas/reales, loops de subconsultas, buffers, sorts, spills y tiempo de cada consulta de página/conteo/KPI por separado.

Candidatos a evaluar, sin crear índices automáticamente:

- Entrega: empresa, pedido, intento descendente e ID descendente.
- Pago: empresa, pedido e ID descendente para el último pago.
- Pedido: empresa/sucursal/fecha; el orden derivado mediante CASE puede necesitar sort aun con índices de número.
- Búsqueda: costo de ILIKE y EXISTS; decidir estrategia según los planes, selectividad y costo de escritura.

## Decisión y trabajo pendiente

No ajustar instancias, pool, memoria, Redis ni infraestructura. No se ha demostrado saturación de ningún servicio. El problema demostrado es la amplificación de solicitudes del frontend, por lo que la siguiente corrección es integrar completamente la paginación y filtros SQL.

Falta identificar y autorizar el entorno aislado. Allí medir HTTP p50/p95/p99, errores/429, bytes, consultas por petición, espera de pool, bloqueos, CPU/memoria y conexiones. Ejecutar rampas y carga sostenida con varios empleados por empresa, una empresa intensiva junto a empresas pequeñas y operaciones de creación/edición/aprobación concurrentes. Fijar duración, límites de carga y criterios de parada antes de ejecutarlas. Comparar después de la integración usando el mismo conjunto sintético y configuración.

Solo si persisten límites medidos después de optimizar consultas se evaluarán ajustes de infraestructura. La prueba local no cierra esa validación.
