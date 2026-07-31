import { Clock, DollarSign, MapPin, Package2, Store, User, Bike } from "lucide-react";

const PRIORITY_CONFIG = {
  BAJA:    { label: "Baja",    className: "is-low" },
  MEDIA:   { label: "Media",   className: "is-medium" },
  ALTA:    { label: "Alta",    className: "is-high" },
  URGENTE: { label: "Urgente", className: "is-urgent" },
  CRITICA: { label: "Crítica", className: "is-urgent" },
};

function getTimeStatus(tiempoRestante) {
  const remaining = Number(tiempoRestante);
  if (!Number.isFinite(remaining)) return { label: "-", className: "is-unknown", icon: null };
  if (remaining < 0) {
    const abs = Math.round(Math.abs(remaining));
    return { label: `Retrasado ${abs} min`, className: "is-late", icon: "alert" };
  }
  if (remaining <= 30) {
    return { label: `${Math.round(remaining)} min restantes`, className: "is-soon", icon: "warn" };
  }
  return { label: "A tiempo", className: "is-ontime", icon: "ok" };
}

function formatProgress(progress) {
  return Math.max(0, Math.min(100, Number(progress || 0)));
}

export function PedidoCard({ item, onOpen, onDragStart }) {
  const priorityKey = String(item.prioridad || "MEDIA").toUpperCase();
  const priority = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.MEDIA;
  const timeStatus = getTimeStatus(item.tiempo_restante_entrega);
  const progressWidth = formatProgress(item.progreso_porcentaje);

  const isPickup = String(item.tipo_entrega || "").toLowerCase().includes("recog") ||
                   String(item.tipo_entrega || "").toLowerCase().includes("tienda");

  return (
    <article
      className={`pipeline-card ${timeStatus.className}`}
      draggable
      onDragStart={event => onDragStart(event, item)}
      onClick={() => onOpen(item)}
    >
      {/* Fila 1: Número pedido + Prioridad */}
      <header className="pipeline-card-head">
        <strong className="pipeline-card-order">#{item.numero_pedido || "—"}</strong>
        <span className={`pipeline-priority ${priority.className}`}>{priority.label}</span>
      </header>

      {/* Cliente — peso visual principal */}
      <p className="pipeline-card-client">{item.cliente_nombre || "Cliente sin nombre"}</p>

      {/* Tipo de entrega */}
      <div className="pipeline-card-delivery">
        {isPickup
          ? <Store size={11} strokeWidth={2} aria-hidden="true" />
          : <MapPin size={11} strokeWidth={2} aria-hidden="true" />}
        <span>{isPickup ? "Recoger en tienda" : (item.direccion || "Domicilio")}</span>
      </div>

      {/* Producto */}
      {item.resumen_productos ? (
        <div className="pipeline-card-product">
          <Package2 size={11} strokeWidth={2} aria-hidden="true" />
          <span>{item.resumen_productos}</span>
        </div>
      ) : null}

      {/* Valor + Asignaciones */}
      <div className="pipeline-card-info-row">
        <div className="pipeline-card-value">
          <DollarSign size={11} strokeWidth={2} aria-hidden="true" />
          <strong>${Number(item.total || 0).toLocaleString("es-CO")}</strong>
        </div>
        <div className="pipeline-card-assign">
          <User size={11} strokeWidth={2} aria-hidden="true" />
          <span className={item.florista ? "pipeline-card-assignee" : "pipeline-card-unassigned"}>
            {item.florista || "Sin asignar"}
          </span>
        </div>
      </div>

      {/* Domiciliario (si aplica) */}
      {item.domiciliario ? (
        <div className="pipeline-card-assign pipeline-card-assign--muted">
          <Bike size={11} strokeWidth={2} aria-hidden="true" />
          <span>{item.domiciliario}</span>
          {item.hora_entrega || item.rango_hora ? <span className="pipeline-card-time-chip">{item.hora_entrega || item.rango_hora}</span> : null}
        </div>
      ) : null}

      {/* Estado tiempo */}
      {timeStatus.label !== "-" ? (
        <div className={`pipeline-time-status ${timeStatus.className}`}>
          <Clock size={11} strokeWidth={2} aria-hidden="true" />
          <span>{timeStatus.label}</span>
        </div>
      ) : null}

      {/* Barra de progreso */}
      <div className="pipeline-progress-wrap" title={`Progreso: ${progressWidth}%`}>
        <div
          className={`pipeline-progress ${timeStatus.className === "is-late" ? "is-warning" : ""}`}
          style={{ width: `${progressWidth}%` }}
        />
        {progressWidth > 0 ? (
          <span className="pipeline-progress-label">{progressWidth}%</span>
        ) : null}
      </div>
    </article>
  );
}
