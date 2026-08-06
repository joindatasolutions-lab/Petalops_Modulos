# Fix: concurrencia de resolucion de imagenes en Produccion

## Problema encontrado (2026-08-06)

Reportado como "los pedidos aparecen y desaparecen" / "el admin cambia el estado y se revierte". Se investigo con logs reales del backend (Cloud Run) cruzados con el historial de cambios de estado en la base de datos.

### Lo que se confirmo

- El cambio de estado en si **siempre funciono correctamente** (`PUT /produccion/{id}/estado` -> `200 OK`, y el historial en BD (`produccion_historial`) confirma que el estado nuevo quedo guardado y nunca se revirtio).
- Al mismo tiempo que se hace cualquier cambio que refresca la lista de produccion (como marcar "Listo para entrega"), el `useEffect` de resolucion de imagenes de `ProductionPage.jsx` (linea ~1681) tomaba hasta **20 items** sin imagen en cache y los resolvia **todos en paralelo** con `Promise.allSettled(...)`.
- Cada item, dentro de ese paralelismo, podia disparar **hasta 6 busquedas secuenciales al catalogo** (`resolveCatalogImageByProductionCode`) mas, en cascada si ninguna encuentra imagen, llamadas a pedidos, detalle de pedido, pipeline, detalle de pedido otra vez, y una segunda ronda de busquedas al catalogo.
- En la practica esto disparaba decenas de requests HTTP simultaneos al backend justo en el momento de refrescar la pantalla — confirmado en logs reales del mismo segundo en que un admin cambiaba el estado de un pedido (docena y media de busquedas de catalogo distintas en <1 segundo).
- Esa rafaga de trafico saturaba la misma instancia de Cloud Run que estaba atendiendo el refresco de la lista, generando latencia y (segun la evidencia disponible) respuestas desordenadas — la hipotesis mas consistente con "se revierte y al actualizar se ve bien".

### Por que no era un bug de perdida de datos

Se valido con el historial real (`produccion_historial`, timestamps y usuario de cada cambio) que el backend/base de datos nunca perdieron ni revirtieron ningun estado. El problema era enteramente de **rendimiento/concurrencia en el frontend**, no de integridad de datos.

## Cambio aplicado

`src/domain/production/ProductionPage.jsx`:

- Nueva funcion pura `mapWithConcurrencyLimit(items, limit, mapper)`: procesa un arreglo con un maximo de `limit` tareas corriendo a la vez (patron de "worker pool"), devolviendo resultados en el mismo formato que `Promise.allSettled` (`{status: "fulfilled", value}` o `{status: "rejected", reason}`) para no tener que tocar el codigo que consume los resultados.
- Nueva constante `IMAGE_RESOLUTION_CONCURRENCY = 3`.
- El `useEffect` que resuelve imagenes de produccion ahora usa `mapWithConcurrencyLimit(missingItems, IMAGE_RESOLUTION_CONCURRENCY, async item => {...})` en vez de `Promise.allSettled(missingItems.map(async item => {...}))`.

**No se toco:**
- La logica interna de cada resolucion (catalogo -> pedido -> detalle -> pipeline -> detalle -> catalogo otra vez) — exactamente la misma cadena de fallback que antes.
- El manejo de resultados (`.then(results => {...})`) — sigue esperando el mismo formato `{status, value|reason}`.
- El limite de 20 items (`slice(0, 20)`) — sigue igual, solo cambia cuantos de esos 20 corren en simultaneo (3 en vez de 20).

## Validado

- `npm run build`: OK, sin errores.
- `npm test`: OK, 9 archivos y 76 pruebas pasaron (nada se rompio).
- Prueba aislada de `mapWithConcurrencyLimit` en Node (20 items, limite 3, uno de ellos fallando a proposito): confirma que el pico real de concurrencia nunca supera 3 (vs 20 antes), que los 20 items se procesan igual, y que el formato de resultado (`{status, value}` / `{status, reason}`) es identico a `Promise.allSettled` — el codigo downstream no necesito cambios.

## Relacionado

Es la misma causa raiz que los `429` (demasiadas solicitudes) vistos en los logs de Cloud Run la mañana del 2026-08-06 en `/catalogo/{empresaId}` — la misma rafaga de busquedas de catalogo disparadas por esta funcion, en un momento de alto trafico concurrente.
