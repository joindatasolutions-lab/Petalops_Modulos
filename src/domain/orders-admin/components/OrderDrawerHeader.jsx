import { IconX } from "@tabler/icons-react";
import { Copy, Pencil, RefreshCw } from "lucide-react";

import { formatearCOP } from "../../../shared/utils.js";
import { formatDisplayDate } from "../orderDetailFormatters.js";
import { getOrderFinancialTotal } from "../ordersDomain.js";
import { statusBadgeClass } from "../ordersUiRules.js";

/**
 * Encabezado del drawer de detalle de pedido.
 *
 * Resume estado, fecha, total y acciones principales del detalle seleccionado.
 */

export function OrderDrawerHeader({
  detalle,
  selectedPedidoId,
  isEditing,
  isDuplicating,
  onToggleEdit,
  onStartDuplicate,
  onRefresh,
  onClose,
}) {
  return (
    <div className="orders-drawer-head orders-detail-premium-head">
      <div className="orders-detail-head-copy">
        <span className="orders-detail-eyebrow">Detalle pedido</span>
        <strong className="orders-drawer-title">
          Pedido #{detalle && !detalle.error ? (detalle.numeroPedido ?? selectedPedidoId ?? "-") : (selectedPedidoId ?? "-")}
        </strong>
        {detalle && !detalle.error ? (
          <div className="orders-detail-head-meta">
            <span className={`order-badge ${statusBadgeClass(detalle.estado)}`}>{detalle.estado || "-"}</span>
            <span>{formatDisplayDate(detalle.destinatario?.fechaEntrega)}</span>
            <span>${formatearCOP(getOrderFinancialTotal(detalle.financiero))}</span>
          </div>
        ) : null}
      </div>
      <div className="orders-drawer-head-main-actions">
        {!detalle?.error && detalle ? (
          <button type="button" className="btn-primary orders-detail-action-primary" onClick={onToggleEdit} title="Editar arreglo y entrega">
            <Pencil size={17} strokeWidth={2} />
            <span>{isEditing ? "Cancelar edicion" : "Editar"}</span>
          </button>
        ) : null}
        {!detalle?.error && detalle ? (
          <button
            type="button"
            className="btn-outline"
            onClick={onStartDuplicate}
            title="Duplicar pedido usando este detalle como base"
          >
            <Copy size={17} strokeWidth={2} />
            <span>Duplicar</span>
          </button>
        ) : null}
        <button type="button" className="btn-outline orders-detail-action-ghost" onClick={onRefresh} title="Recargar detalle del pedido">
          <RefreshCw size={17} strokeWidth={2} />
          <span>Recargar</span>
        </button>
      </div>
      <div className="orders-drawer-head-close">
        <button type="button" className="icon-btn" onClick={onClose} title="Cerrar detalle">
          <IconX size={18} stroke={2} />
        </button>
      </div>
    </div>
  );
}
