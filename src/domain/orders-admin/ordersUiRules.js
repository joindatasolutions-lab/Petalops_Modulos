import { normalizeStatus } from "../../shared/utils.js";
import { isPendingOutsideToday } from "./ordersDomain.js";

/**
 * Reglas de presentacion para Pedidos.
 *
 * Mantiene separadas las decisiones visuales que nacen del estado del pedido:
 * clases CSS de badges y disponibilidad de acciones visibles. No debe llamar al
 * API ni modificar datos.
 */

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  CREADO: "is-pendiente",
  APROBADO: "is-aprobado",
  CANCELADO: "is-rechazado",
};

export function statusBadgeClass(status, item = null) {
  const key = normalizeStatus(status);
  if (key === "PENDIENTE" && item && isPendingOutsideToday(item)) {
    return "is-pendiente-other-date";
  }
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

export function isPendingStatus(status) {
  const key = normalizeStatus(status);
  return key === "PENDIENTE" || key === "CREADO";
}

export function canInvoiceStatus(status) {
  const key = normalizeStatus(status);
  return key === "APROBADO";
}

export function canMessageCardStatus(status) {
  const key = normalizeStatus(status);
  return key === "APROBADO";
}
