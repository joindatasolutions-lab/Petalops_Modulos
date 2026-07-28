import { IconX } from "@tabler/icons-react";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Notificacion flotante para acciones sobre pedidos.
 *
 * Muestra feedback de aprobacion, rechazo, cancelacion o creacion. La pagina
 * controla el ciclo de vida y cierre.
 */

export function OrderNotification({ notification, onClose }) {
  if (!notification) return null;

  return (
    <aside className={`orders-approval-notification${notification.tone === "danger" ? " is-danger" : ""}`} role="status" aria-live="polite">
      <span className="orders-approval-notification-icon" aria-hidden="true">
        {notification.tone === "danger" ? (
          <XCircle size={21} strokeWidth={2.4} />
        ) : (
          <CheckCircle2 size={21} strokeWidth={2.4} />
        )}
      </span>
      <div>
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        title="Cerrar notificacion"
        aria-label="Cerrar notificacion"
      >
        <IconX size={16} stroke={2.2} />
      </button>
    </aside>
  );
}
