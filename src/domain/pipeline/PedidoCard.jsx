const PRIORITY_CLASS = {
  BAJA: "is-low",
  MEDIA: "is-medium",
  ALTA: "is-high",
  URGENTE: "is-high",
  CRITICA: "is-high",
};

function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) return "-";
  return `${Math.round(minutes)} min`;
}

function isDelayed(item) {
  const remaining = Number(item?.tiempo_restante_entrega);
  return Number.isFinite(remaining) && remaining < 0;
}

export function PedidoCard({ item, onOpen, onDragStart }) {
  const priorityClass = PRIORITY_CLASS[String(item.prioridad || "MEDIA").toUpperCase()] || "is-medium";
  const delayed = isDelayed(item);
  const progressWidth = Math.max(0, Math.min(100, Number(item.progreso_porcentaje || 0)));

  return (
    <article
      className="pipeline-card"
      draggable
      onDragStart={event => onDragStart(event, item)}
      onDoubleClick={() => onOpen(item)}
      onClick={() => onOpen(item)}
    >
      <header className="pipeline-card-head">
        <strong className="pipeline-card-order">#{item.numero_pedido || "Pendiente"}</strong>
        <span className={`pipeline-priority ${priorityClass}`}>{String(item.prioridad || "MEDIA").toUpperCase()}</span>
      </header>

      <p className="pipeline-card-client">{item.cliente_nombre || "Cliente sin nombre"}</p>
      <p className="pipeline-card-mini">{item.telefono || "-"}</p>
      <p className="pipeline-card-mini">{item.direccion || "-"}</p>
      <p className="pipeline-card-products">{item.resumen_productos || "Sin productos"}</p>

      <div className="pipeline-card-meta">
        <span>Total ${Number(item.total || 0).toLocaleString("es-CO")}</span>
        <span>Florista <strong className="pipeline-card-florista">{item.florista || "Sin asignar"}</strong></span>
      </div>

      <div className="pipeline-card-meta">
        <span>{item.hora_entrega || "-"}</span>
        <span>{item.domiciliario || "Sin dom."}</span>
      </div>

      <div className="pipeline-progress-wrap">
        <div
          className={`pipeline-progress${delayed ? " is-warning" : ""}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <div className="pipeline-card-times">
        <span>Entrega {formatMinutes(item.tiempo_restante_entrega)}</span>
        <span>Prod. {formatMinutes(item.tiempo_estimado_produccion)}</span>
      </div>
    </article>
  );
}
