import { IconCheck, IconX } from "@tabler/icons-react";
import { Eye, Mail, MessageCircle, MoreVertical, Receipt } from "lucide-react";

import { canInvoiceStatus } from "../ordersUiRules.js";

/**
 * Menu contextual de acciones de un pedido.
 *
 * Solo decide que botones mostrar/habilitar con las props recibidas. Las
 * operaciones reales se ejecutan en callbacks del contenedor.
 */

export function OrderActionsMenu({
  as: Wrapper = "div",
  className = "order-actions",
  item,
  pedidoId,
  waPhone,
  isOpen,
  openDown,
  approveDisabled,
  approveTitle,
  canCancelAction,
  canDownloadInvoice,
  canViewMessageCard,
  onToggle,
  onClose,
  onOpenDetail,
  onApprove,
  onReject,
  onDownloadInvoice,
  onOpenMessageCard,
}) {
  const closeAndRun = action => {
    onClose();
    action();
  };

  return (
    <Wrapper className={className}>
      <button type="button" className="order-icon order-icon-view" onClick={() => onOpenDetail(pedidoId)} title="Ver detalle" aria-label="Ver detalle">
        <Eye size={17} strokeWidth={2} />
      </button>
      <div className="order-actions-menu">
        <button
          type="button"
          className="order-icon order-icon-more"
          onClick={onToggle}
          title="Mas acciones"
          aria-label="Mas acciones"
          aria-expanded={isOpen}
        >
          <MoreVertical size={17} strokeWidth={2} />
        </button>
        {isOpen ? (
          <div className={`order-actions-popover ${openDown ? "order-actions-popover--open-down" : ""}`} role="menu">
            <button type="button" role="menuitem" onClick={() => closeAndRun(() => onOpenDetail(pedidoId))}>
              <Eye size={14} strokeWidth={2} />
              <span>Ver detalle</span>
            </button>
            <button type="button" role="menuitem" className="is-approve" onClick={() => closeAndRun(() => onApprove(pedidoId))} disabled={approveDisabled} title={approveTitle}>
              <IconCheck size={14} stroke={2.1} />
              <span>Aprobar</span>
            </button>
            <button type="button" role="menuitem" className="is-cancel" onClick={() => closeAndRun(() => onReject(pedidoId))} disabled={!canCancelAction} title={canInvoiceStatus(item.estado) ? "Cancelar pedido aprobado" : "Rechazar pedido"}>
              <IconX size={14} stroke={2.1} />
              <span>Cancelar</span>
            </button>
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" role="menuitem" className="is-whatsapp" onClick={onClose}>
              <MessageCircle size={14} strokeWidth={2} />
              <span>Enviar WhatsApp</span>
            </a>
            {canDownloadInvoice && (
              <button type="button" role="menuitem" className="is-invoice" onClick={() => closeAndRun(() => onDownloadInvoice(pedidoId))}>
                <Receipt size={14} strokeWidth={2} />
                <span>Generar factura</span>
              </button>
            )}
            {canViewMessageCard && (
              <button type="button" role="menuitem" className="is-card" onClick={() => closeAndRun(() => onOpenMessageCard(item))}>
                <Mail size={14} strokeWidth={2} />
                <span>Mensaje</span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}
