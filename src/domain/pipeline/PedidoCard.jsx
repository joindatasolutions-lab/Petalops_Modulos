const PRIORITY_CLASS = {
  BAJA: "is-low",
  MEDIA: "is-medium",
  ALTA: "is-high",
  URGENTE: "is-high",
  CRITICA: "is-high"
};

export function PedidoCard({ item, onOpen, onDragStart }) {
  const priorityClass = PRIORITY_CLASS[String(item.prioridad || "MEDIA").toUpperCase()] || "is-medium";

  return (
    <article
      className="pipeline-card"
      draggable
      onDragStart={event => onDragStart(event, item)}
      onDoubleClick={() => onOpen(item)}
      style={{ borderLeftColor: item.color_estado }}
    >
      <header className="pipeline-card-head">
        <strong>#{item.numero_pedido || 'Pendiente'}</strong>
        <span className={`pipeline-priority ${priorityClass}`}>{item.prioridad || "MEDIA"}</span>
      </header>

      <p className="pipeline-card-client">{item.cliente_nombre}</p>
      <p className="pipeline-card-mini">{item.telefono || "-"}</p>
      <p className="pipeline-card-mini">{item.direccion || "-"}</p>
      <p className="pipeline-card-products">{item.resumen_productos || "Sin productos"}</p>

      <div className="pipeline-card-meta">
        <span>Total ${Number(item.total || 0).toLocaleString()}</span>
        <span>{item.hora_entrega || "-"}</span>
      </div>

      <div className="pipeline-card-meta">
        <span>{item.sucursal || "-"}</span>
        <span>{item.domiciliario || "Sin dom."}</span>
      </div>

      <div className="pipeline-card-icons">
        {item.urgente ? <span title="Urgente">⚠️</span> : null}
        {item.tiene_tarjeta ? <span title="Con tarjeta">💌</span> : null}
        {item.es_domicilio ? <span title="Domicilio">🛵</span> : null}
      </div>

      <div className="pipeline-progress-wrap">
        <div className="pipeline-progress" style={{ width: `${item.progreso_porcentaje || 0}%` }} />
      </div>
      <div className="pipeline-card-meta">
        <span>Restante: {item.tiempo_restante_entrega ?? "-"} min</span>
        <span>Prod: {item.tiempo_estimado_produccion ?? "-"} min</span>
      </div>

      {item.imagen_url ? (
        <img className="pipeline-card-img" src={item.imagen_url} alt={`Pedido ${item.numero_pedido || 'Pendiente'}`} />
      ) : null}
    </article>
  );
}

