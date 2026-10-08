import { Search } from "lucide-react";

import { OrderListRow } from "./OrderListRow.jsx";
import { resolveOrderId } from "../ordersDomain.js";

/**
 * Seccion de listado de pedidos.
 *
 * Controla estados visuales de carga/vacio/error y delega cada fila a
 * `OrderListRow`. Las acciones se reciben desde la pagina principal.
 */

export function OrdersListSection({
  error,
  loading,
  onRetry,
  hasLoaded = false,
  updatedAt,
  items,
  empresaId,
  session,
  approvingPedidoIds,
  finalizingPedidoIds,
  finalizedPickupPedidoIds,
  selectedPedidoId,
  drawerOpen,
  openOrderActionsId,
  setOpenOrderActionsId,
  openDetail,
  approveOrder,
  rejectOrder,
  finalizeOrder,
  downloadInvoice,
  openMessageCard,
}) {
  return (
    <>
      <section className="orders-page-section" aria-busy={loading}>
        <div className="orders-list-heading">
          <h2 className="orders-section-title">Listado de pedidos</h2>
          <div className="orders-result-status" role="status" aria-live="polite">
            {loading && !error ? <span>{hasLoaded ? "Actualizando; se muestran los resultados anteriores…" : "Buscando pedidos…"}</span> : null}
            {error ? <><span title={`${error}${updatedAt ? ` Última actualización: ${new Date(updatedAt).toLocaleTimeString("es-CO")}` : ""}`}>{error}</span><button type="button" onClick={onRetry} disabled={loading}>{loading ? "Reintentando…" : "Reintentar"}</button></> : null}
          </div>
        </div>
        {!loading && !error && items.length === 0 ? (
          <div className="orders-empty-state" role="status" aria-live="polite">
            <span className="orders-empty-state-icon" aria-hidden="true">
              <Search size={22} strokeWidth={2.2} />
            </span>
            <strong>No hay pedidos</strong>
            <span>Ajusta los filtros o limpia la busqueda para ver otros resultados.</span>
          </div>
        ) : (
          <div className="orders-table-wrap orders-page-table-wrap">
            <table className="orders-table orders-list-table">
              <colgroup>
                <col className="orders-list-col-number" />
                <col className="orders-list-col-created" />
                <col className="orders-list-col-client" />
                <col className="orders-list-col-delivery" />
                <col className="orders-list-col-products" />
                <col className="orders-list-col-total" />
                <col className="orders-list-col-payment" />
                <col className="orders-list-col-status" />
                <col className="orders-list-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Fecha / Hora</th>
                  <th>Cliente · Destinatario</th>
                  <th>Entrega</th>
                  <th>Producto(s)</th>
                  <th>Total</th>
                  <th>Metodo pago</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
              {items.map(item => (
                <OrderListRow
                  key={resolveOrderId(item) || `${item.numeroPedido}-${item.fecha}`}
                  item={item}
                  empresaId={empresaId}
                  session={session}
                  approvingPedidoIds={approvingPedidoIds}
                  finalizingPedidoIds={finalizingPedidoIds}
                  finalizedPickupPedidoIds={finalizedPickupPedidoIds}
                  selectedPedidoId={selectedPedidoId}
                  drawerOpen={drawerOpen}
                  openOrderActionsId={openOrderActionsId}
                  totalVisibleItems={items.length}
                  setOpenOrderActionsId={setOpenOrderActionsId}
                  openDetail={openDetail}
                  approveOrder={approveOrder}
                  rejectOrder={rejectOrder}
                  finalizeOrder={finalizeOrder}
                  downloadInvoice={downloadInvoice}
                  openMessageCard={openMessageCard}
                />
              ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
