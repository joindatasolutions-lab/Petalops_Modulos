# Probar el despacho administrativo localmente

Desde la raíz del repositorio:

```sh
npm ci
npm run dev
```

Abre la ruta `/dev/domicilios.html` en el servidor Vite (puerto 5173 por defecto).
Es una entrada independiente de desarrollo con datos ficticios en memoria:
no inicia sesión, no almacena tokens y no se conecta a la API de producción.
El build de producción no incluye esta página. Reiniciar la demo restaura los datos.

## Recorrido

1. Selecciona #98047, #98051 y #98056, o filtra por Chapinero y marca la casilla del encabezado.
2. Elige Juan Pérez. El panel muestra sus entregas activas **en la vista actual** y la carga visible resultante.
3. Pulsa **Revisar asignación (3)**. Comprueba los pedidos y el responsable.
4. Pulsa **Confirmar asignación (3)**. La lista cambia a Asignado y el resultado indica qué pedidos se guardaron.

Solo son seleccionables entregas identificadas, pendientes o listas para entrega,
sin domiciliario, que no sean recogidas en tienda ni tengan producción sin terminar.
Cambiar fecha, búsqueda, barrio, estado o pestaña descarta la selección.

Para probar fallos, activa **Simular fallo en #98051** antes de confirmar.
Los otros pedidos se asignan y el resultado conserva el fallo. Desactívalo,
actualiza la lista y vuelve a seleccionar únicamente el pedido pendiente.

Para probar un conflicto, selecciona #98047 y después pulsa **Simular asignación
externa de #98047**. Al confirmar, se detecta que ya tiene responsable y no se
sobrescribe esa asignación. Los otros pedidos elegibles pueden continuar.

La demo se concentra en el tablero y la asignación. No simula los cambios de
estado, regularizaciones ni todas las operaciones de las otras pestañas.
La interfaz de selección por lote está preparada para escritorio y tablet;
la vista móvil anterior conserva sus acciones individuales.

## Comprobaciones automatizadas

```sh
npm test -- src/__tests__/delivery-batch-assignment.test.js src/__tests__/delivery.filters.test.jsx src/__tests__/api-client.pedidos.test.js
npm run build
```

Con Vite activo y Chromium instalado:

```sh
CHROMIUM_PATH=/usr/bin/chromium node scripts/delivery-demo.smoke.mjs
```

También se puede omitir `CHROMIUM_PATH` si los navegadores de Playwright ya
están instalados, o establecerlo a otro ejecutable local. `DELIVERY_DEMO_URL`
permite cambiar la dirección base del servidor. La prueba bloquea solicitudes
a hosts externos, verifica éxito, fallo parcial, conflicto y limpieza de
selección, y guarda una captura en `/tmp/domicilios-lote-local.png`.

## Integración con el backend existente

La vista real usa el cliente autenticado existente. Antes del lote consulta
los pendientes de la empresa/sucursal y verifica que el domiciliario siga
activo. Ejecuta las asignaciones secuencialmente, sin reintentar escrituras
automáticamente ni solicitar sobrecupo, y muestra los resultados por pedido.
No es una transacción única: puede haber éxitos y fallos en el mismo lote.
Un error de red puede ocurrir después de guardar; hay que actualizar antes de
reintentar. La API debe seguir validando autorización, capacidad y concurrencia.
Una garantía de todo o nada requiere una operación de lote en el backend,
que no está incluido en este repositorio.
