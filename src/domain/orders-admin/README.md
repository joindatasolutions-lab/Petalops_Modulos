# Guia del modulo Pedidos (`orders-admin`)

Este directorio contiene el modulo de administracion de pedidos. En la interfaz se ve como **Pedidos**; internamente algunas piezas usan el nombre historico `orders-admin`.

## Objetivo del modulo

El modulo permite consultar, filtrar, crear, aprobar, cancelar, editar, duplicar e imprimir informacion relacionada con pedidos. Tambien coordina acciones laterales como factura, tarjeta de mensaje y apertura del detalle.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `OrdersAdminPage.jsx` | Contenedor principal de la pagina. Orquesta estado de pantalla, carga de datos, acciones de pedido y render general. Debe mantenerse como coordinador, no como lugar para meter reglas nuevas complejas. |
| `ordersDomain.js` | Funciones puras de dominio: normalizacion, filtros, totales financieros, busqueda, metodos de pago, productos y payloads del API. |
| `orderPayloadBuilders.js` | Constructores puros de payloads para crear, duplicar, editar y agregar productos al pedido. |
| `ordersUiRules.js` | Reglas visuales derivadas del estado del pedido: clases de badge y permisos de acciones de UI. |
| `ordersAdminConstants.js` | Constantes, defaults del formulario, filtros iniciales y opciones de la tarjeta. |
| `ordersCache.js` | Construccion y mantenimiento del cache de filtros del listado. |
| `ordersKpis.js` | Normalizacion de KPIs recibidos del backend. |
| `orderCatalogAdapters.js` | Adaptadores para convertir respuestas del catalogo y barrios al formato que usa la UI. |
| `orderDateFormatters.js` | Normalizacion de fechas/horas y formatos especificos de tarjeta de mensaje. |
| `orderDetailFormatters.js` | Formateadores del drawer de detalle: fecha visible, documento de cliente y metodo de pago. |
| `orderDeliveryType.js` | Regla de tipo de entrega: domicilio vs recogida en tienda. |
| `paymentBreakdown.js` | Extrae desglose de pagos desde diferentes variantes de payload financiero. |

## Componentes

| Archivo | Responsabilidad |
| --- | --- |
| `components/NewOrderModal.jsx` | Modal para crear pedidos manuales desde atencion directa. Recibe todo por props y no llama el API directamente. |
| `components/OrderListRow.jsx` | Fila/card de pedido para desktop y mobile. Calcula datos visuales de una orden individual y delega acciones al menu. |
| `components/OrderActionsMenu.jsx` | Menu contextual de acciones: ver detalle, aprobar, cancelar, WhatsApp, factura y tarjeta. |
| `components/OrdersHeader.jsx` | Encabezado de la pagina: titulo, busqueda, acciones principales y tarjetas metricas. |
| `components/OrdersFilters.jsx` | Banda de filtros de fecha y acciones de limpieza. |
| `components/OrdersListSection.jsx` | Estados de carga/vacio y tabla principal del listado. |
| `components/OrdersPager.jsx` | Paginacion y selector de registros por pagina. |
| `components/OrderNotification.jsx` | Notificacion flotante para acciones de pedidos. |
| `components/OrderDrawerHeader.jsx` | Encabezado del drawer de detalle con acciones de editar, duplicar, recargar y cerrar. |
| `components/OrderDetailDrawer.jsx` | Contenedor del drawer. Compone encabezado, vista de detalle y editor sin mezclar carga de datos. |
| `components/OrderDetail.jsx` | Vista del detalle del pedido dentro del drawer. Renderiza datos generales, cliente, destinatario, productos y resumen financiero. |
| `components/OrderDetailEditorParts.jsx` | Piezas del editor de detalle: producto, agenda, cliente, entrega, notas, pagos y acciones. |
| `components/MessageCardModal.jsx` | Modal imprimible para editar y previsualizar la tarjeta de mensaje floral. |

## Hooks

| Archivo | Responsabilidad |
| --- | --- |
| `hooks/useOrdersAdminData.js` | Estado y carga del listado: pedidos, total, KPIs, cache de filtros y resumen comercial. |
| `hooks/useOrdersCatalogs.js` | Filtros y busquedas de catalogo de arreglos/barrios para editor y pedido nuevo. |
| `hooks/useMessageCardController.js` | Estado, apertura, cierre y guardado del modal de tarjeta de mensaje. |
| `hooks/useOrderDetailEditor.js` | View model del editor: agrupa estado plano en contratos por seccion para el drawer. |

## Flujo de datos principal

1. `OrdersAdminPage` crea el cliente API con `createApiClient`.
2. Los filtros de pantalla se guardan en `filters`.
3. `useOrdersAdminData` arma parametros, consulta `api.listarPedidos`, aplica filtros locales cuando hace falta y actualiza `items`, `total` y KPIs.
4. Cada pedido se renderiza con `OrderListRow`.
5. Las acciones del menu vuelven a `OrdersAdminPage`, que ejecuta el API y refresca datos.
6. El detalle se obtiene con `api.obtenerDetallePedido` y se muestra dentro de `OrderDetailDrawer`.

## Reglas de arquitectura

- Mantener `OrdersAdminPage.jsx` como orquestador. Si una funcion no necesita estado React directo, moverla a un helper puro.
- Si una pieza solo renderiza UI y recibe datos/callbacks, moverla a `components/`.
- Si una regla decide comportamiento de negocio o normaliza payloads, moverla a `ordersDomain.js` o a un helper de dominio mas pequeno.
- Si una regla solo afecta estilos, permisos visibles o textos de UI, usar `ordersUiRules.js` o un componente.
- Evitar que componentes llamen directamente al API. La pagina o un hook de orquestacion debe controlar efectos secundarios.

## Siguientes cortes recomendados

- Extraer acciones de aprobar/cancelar/factura a un hook `useOrderActions`.
- Mover el estado plano del editor desde `OrdersAdminPage` a un hook controlador completo.
- Agregar pruebas unitarias directas para `orderPayloadBuilders.js`.

## Verificacion esperada

Despues de cambiar este modulo:

```bash
npm.cmd test
npm.cmd run build
```

En PowerShell, si `npm` falla por politicas de ejecucion, usar `npm.cmd`.
