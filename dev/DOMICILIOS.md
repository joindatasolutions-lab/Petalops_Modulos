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
2. Pulsa **Asignar domiciliario** en la barra de selección. Elige Juan Pérez en el diálogo. Se muestran sus entregas activas **en el contexto filtrado** y la carga visible resultante.
3. Pulsa **Revisar asignación (3)**. Comprueba los pedidos y el responsable.
4. Pulsa **Confirmar asignación (3)**. La lista cambia a Asignado y el resultado indica qué pedidos se guardaron.

Solo son seleccionables entregas identificadas, pendientes o listas para entrega,
sin domiciliario, que no sean recogidas en tienda ni tengan producción sin terminar.
Cambiar fecha, búsqueda efectiva, zona, estado o vista operativa descarta la selección con un aviso. Abrir filtros, abrir acciones o cancelar el diálogo conserva la selección. Los resultados del último lote permanecen visibles al cambiar filtros.

Para probar fallos, activa **Simular fallo en #98051** antes de confirmar.
Los otros pedidos se asignan y el resultado conserva el fallo. Desactívalo,
actualiza la lista y vuelve a seleccionar únicamente el pedido pendiente.

Para probar un conflicto, selecciona #98047 y, antes de abrir el diálogo, pulsa **Simular asignación
externa de #98047**. Al confirmar, se detecta que ya tiene responsable y no se
sobrescribe esa asignación. Los otros pedidos elegibles pueden continuar.

La demo se concentra en el tablero y la asignación. No simula los cambios de
estado, regularizaciones ni todas las operaciones de las otras pestañas.
La tabla compacta ocupa todo el ancho. En móvil tiene desplazamiento horizontal y el botón **Filtros** despliega zona, período y fecha. El menú de acciones se abre por encima de la tabla, sin cambiar la altura de las filas; admite Tab, flechas, Inicio/Fin, Escape y clic fuera.

**Por gestionar** excluye entregados; **Finalizados** contiene entregados; **Incidencias** contiene no entregados y reprogramados; **Todos** permite consultar el conjunto completo de la fecha. Las tarjetas cuentan el contexto de la vista, fecha, búsqueda y zona; filtran localmente por estado. La tarjeta **Todos** vuelve al conjunto de esa vista. Buscar un número mantiene el comportamiento existente de ampliar fecha/estado/vista, indicado en pantalla. **Restablecer** vuelve a hoy, por gestionar y todas las zonas.

La demo incluye un administrador vinculado al domiciliario Juan Pérez: ese vínculo no debe ocultar los pedidos sin asignar. Incluye un pedido entregado (#98072) para comprobar Todos/Finalizados; no es seleccionable.

## Comprobaciones automatizadas

```sh
npm test -- src/__tests__/delivery-batch-assignment.test.js src/__tests__/delivery.filters.test.jsx src/__tests__/api-client.pedidos.test.js
npm run build
```

En Windows PowerShell, con Vite activo (puerto de ejemplo 5178):

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5178
```

Abre `http://127.0.0.1:5178/dev/domicilios.html`. En otra terminal del mismo repositorio:

```powershell
$env:DELIVERY_DEMO_URL = 'http://127.0.0.1:5178'
node scripts/delivery-demo.smoke.mjs
```

También se puede omitir `CHROMIUM_PATH` si los navegadores de Playwright ya
están instalados, o establecerlo a otro ejecutable local. `DELIVERY_DEMO_URL`
permite cambiar la dirección base del servidor. La prueba bloquea solicitudes
a hosts externos, verifica éxito, fallo parcial, conflicto y limpieza de
selección, menú flotante, vistas operativas y filtros móviles. Guarda capturas `domicilios-lote-local.png` y `domicilios-mobile-local.png` en la carpeta temporal del sistema (`$env:TEMP` en Windows).

La prueba también abre la aplicación real con una sesión administrativa ficticia. Intercepta todas las solicitudes API y responde en memoria; bloquea las escrituras. Comprueba el recorrido hasta la revisión, sin confirmar asignaciones reales.

Si Vite no está instalado, usa `npm.cmd ci --include=dev` antes de arrancar. Ante EPERM de esbuild/Rollup, identifica y cierra únicamente el Vite de este repositorio antes de reintentar; no borres `package-lock.json` ni cierres todos los procesos Node. La demo requiere Vite de desarrollo: no existe en `npm run preview` ni en el sitio publicado.

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
