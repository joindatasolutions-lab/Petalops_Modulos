import { Clock3 } from "lucide-react";

import { formatearCOP, normalizeStatus, splitDateTimeParts } from "../../../shared/utils.js";
import {
  isEmpresaAdminRole,
  resolveDisplayOrderNumber,
  resolveOrderId,
  resolveOrderListTotal,
  resolveOrderProductSummary,
  shouldShowPendingInvoiceAlert,
  isDeliveryDelivered,
  isStorePickupOrder,
} from "../ordersDomain.js";
import { canInvoiceStatus, canMessageCardStatus, isPendingStatus, statusBadgeClass } from "../ordersUiRules.js";
import { OrderActionsMenu } from "./OrderActionsMenu.jsx";

/**
 * Fila responsive del listado de pedidos.
 *
 * Prepara los datos visuales de una orden individual y delega las acciones al
 * menu contextual. Mantener aqui solo logica de presentacion por fila.
 */

export function OrderListRow({
  item,
  empresaId,
  session,
  approvingPedidoIds = [],
  finalizingPedidoIds = [],
  finalizedPickupPedidoIds = [],
  selectedPedidoId,
  drawerOpen,
  openOrderActionsId,
  totalVisibleItems,
  setOpenOrderActionsId,
  openDetail,
  approveOrder,
  rejectOrder,
  finalizeOrder,
  downloadInvoice,
  openMessageCard,
}) {
  const deliveryDelivered = isDeliveryDelivered(item);
  const pedidoId = resolveOrderId(item);
  const pickupFinalized = finalizedPickupPedidoIds.includes(Number(pedidoId));
  const orderFinalized = deliveryDelivered || pickupFinalized;
  const displayStatus = item.estado;
  const statusClass = statusBadgeClass(displayStatus, item);
  const productSummary = resolveOrderProductSummary(item, new Map(), empresaId);
  const waPhone = String(item.telefonoCompleto || item.telefono || "").trim().replace(/\+/g, "");
  const displayOrderNumber = resolveDisplayOrderNumber(item);
  const canApproveAction = isPendingStatus(item.estado);
  const canCancelAction = canApproveAction || (isEmpresaAdminRole(session) && canInvoiceStatus(item.estado));
  const isApproving = approvingPedidoIds.includes(Number(pedidoId));
  const approvalBlockedByTenant = canApproveAction && item?.puedeAprobar === false;
  const approveDisabled = !canApproveAction || approvalBlockedByTenant || isApproving;
  const approveTitle = isApproving
    ? "Otro usuario o esta sesion esta aprobando este pedido"
    : approvalBlockedByTenant
      ? (item.motivoBloqueoAprobacion || "Completa la informacion requerida antes de aprobar")
      : "Aprobar pedido";
  const canDownloadInvoice = Boolean(pedidoId) && canInvoiceStatus(item.estado);
  const canViewMessageCard = canMessageCardStatus(item.estado);
  const isFinalizing = finalizingPedidoIds.includes(Number(pedidoId));
  const canFinalizeAction = Boolean(pedidoId) && isStorePickupOrder(item) && canInvoiceStatus(item.estado);
  const finalizeDisabled = isFinalizing || orderFinalized;
  const finalizeLabel = isFinalizing ? "Finalizando..." : orderFinalized ? "Finalizado" : "Finalizar";
  const finalizeTitle = isFinalizing
    ? "Finalizando pedido..."
    : orderFinalized
      ? "Pedido ya finalizado"
      : "Finalizar recogida en tienda";
  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(item.fecha_pedido || item.fechaPedido);
  const { time: horaCreacion } = splitDateTimeParts(item.created_at || item.createdAt);
  const horaRegistroPedido = horaPedido || item.horaPedido || item.hora_pedido || item.hora || horaCreacion;
  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(item.fechaEntrega);
  const productListLabel = productSummary.productText || "-";
  const normalizedStatus = normalizeStatus(item.estado);
  const rowClass = [
    selectedPedidoId === pedidoId && drawerOpen ? "is-active" : "",
    "orders-row-card",
    normalizedStatus === "APROBADO" ? "orders-row-approved" : "",
    normalizedStatus === "CANCELADO" || normalizedStatus === "RECHAZADO" ? "orders-row-cancelled" : "",
    isPendingStatus(item.estado) || normalizedStatus === "CREADO" ? "orders-row-pending" : "",
  ].filter(Boolean).join(" ");

  return (
    <tr className={rowClass}>
      <td className="orders-mobile-card-cell" colSpan={9}>
        <article className="orders-mobile-card">
          <header className="orders-mobile-card-head">
            <span className={`orders-order-badge ${statusClass}`}>{displayOrderNumber}</span>
            <span className={`order-badge ${statusClass}`}>
              <span className="orders-status-icon" aria-hidden="true" />
              {displayStatus || "-"}
            </span>
          </header>

          <div className="orders-mobile-card-grid">
            <section className="orders-mobile-card-block orders-mobile-product-block">
              <span className="orders-mobile-label">Producto</span>
              <div className="orders-mobile-product">
                <strong title={productSummary.title}>{productListLabel}</strong>
              </div>
            </section>

            <section className="orders-mobile-card-block">
              <span className="orders-mobile-label">Cliente</span>
              <strong>{item.cliente || "-"}</strong>
            </section>

            <section className="orders-mobile-card-block">
              <span className="orders-mobile-label">Fecha entrega</span>
              <strong>{fechaEntrega || "-"}</strong>
            </section>

            <section className="orders-mobile-card-block">
              <span className="orders-mobile-label">Hora entrega</span>
              <strong>{item.horaEntrega || horaEntrega || "-"}</strong>
            </section>

            <section className="orders-mobile-card-block">
              <span className="orders-mobile-label">Destinatario</span>
              <strong>{item.destinatario || "-"}</strong>
            </section>

            <section className="orders-mobile-card-block">
              <span className="orders-mobile-label">Total</span>
              <strong>${formatearCOP(resolveOrderListTotal(item))}</strong>
            </section>
          </div>

          <OrderActionsMenu
            as="footer"
            className="orders-mobile-card-actions"
            item={item}
            pedidoId={pedidoId}
            waPhone={waPhone}
            isOpen={openOrderActionsId === pedidoId}
            openDown={totalVisibleItems <= 2}
            approveDisabled={approveDisabled}
            approveTitle={approveTitle}
            canCancelAction={canCancelAction}
            canDownloadInvoice={canDownloadInvoice}
            canViewMessageCard={canViewMessageCard}
            canFinalizeAction={canFinalizeAction}
            finalizeDisabled={finalizeDisabled}
            finalizeLabel={finalizeLabel}
            finalizeTitle={finalizeTitle}
            onToggle={() => setOpenOrderActionsId(current => current === pedidoId ? null : pedidoId)}
            onClose={() => setOpenOrderActionsId(null)}
            onOpenDetail={openDetail}
            onApprove={approveOrder}
            onReject={rejectOrder}
            onDownloadInvoice={downloadInvoice}
            onOpenMessageCard={openMessageCard}
            onFinalize={finalizeOrder}
          />
        </article>
      </td>
      <td data-label="Numero">
        <span className={`orders-order-badge ${statusClass}`}>{displayOrderNumber}</span>
      </td>
      <td data-label="Fecha/Hora">
        <div className="orders-cell-stack">
          <strong>{fechaPedido || "-"}</strong>
          <small>{horaRegistroPedido || "-"}</small>
        </div>
      </td>
      <td data-label="Cliente / Destinatario">
        <div className="orders-cell-stack orders-client-destination-cell">
          <strong>{item.cliente || "-"}</strong>
          <small>-&gt; {item.destinatario || "-"}</small>
        </div>
      </td>
      <td data-label="Entrega">
        <div className="orders-cell-stack orders-cell-stack--delivery">
          <span className="orders-delivery-pill"><Clock3 size={14} strokeWidth={2} /> {item.horaEntrega || horaEntrega || "-"}</span>
          <span>{fechaEntrega || "-"}</span>
        </div>
      </td>
      <td data-label="Producto(s)" title={productSummary.title}>
        <span className="orders-products-inline">{productSummary.productText || "-"}</span>
      </td>
      <td data-label="Total">
        <span className="orders-total-value">${formatearCOP(resolveOrderListTotal(item))}</span>
      </td>
      <td data-label="Metodo pago">{item.metodoPago || "-"}</td>
      <td data-label="Estado">
        <div className="orders-cell-stack">
          <span className={`order-badge ${statusClass}`}>
            <span className="orders-status-icon" aria-hidden="true" />
            {displayStatus || "-"}
          </span>
          {shouldShowPendingInvoiceAlert(item) ? (
            <span className="orders-inline-alert">Factura pendiente</span>
          ) : null}
          {["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item.estado)) && item.motivoRechazo ? (
            <span className="orders-inline-alert" title={item.motivoRechazo}>Nota: {item.motivoRechazo}</span>
          ) : null}
        </div>
      </td>
      <td data-label="Acciones">
        <OrderActionsMenu
          item={item}
          pedidoId={pedidoId}
          waPhone={waPhone}
          isOpen={openOrderActionsId === pedidoId}
          openDown={totalVisibleItems <= 2}
          approveDisabled={approveDisabled}
          approveTitle={approveTitle}
          canCancelAction={canCancelAction}
          canDownloadInvoice={canDownloadInvoice}
          canViewMessageCard={canViewMessageCard}
          canFinalizeAction={canFinalizeAction}
          finalizeDisabled={finalizeDisabled}
          finalizeLabel={finalizeLabel}
          finalizeTitle={finalizeTitle}
          onToggle={() => setOpenOrderActionsId(current => current === pedidoId ? null : pedidoId)}
          onClose={() => setOpenOrderActionsId(null)}
          onOpenDetail={openDetail}
          onApprove={approveOrder}
          onReject={rejectOrder}
          onDownloadInvoice={downloadInvoice}
          onOpenMessageCard={openMessageCard}
          onFinalize={finalizeOrder}
        />
      </td>
    </tr>
  );
}
