export function PedidoModal({ item, detail, onClose }) {
  if (!item) return null;

  return (
    <div className="pipeline-modal-overlay" onClick={onClose}>
      <section className="pipeline-modal" onClick={event => event.stopPropagation()}>
        <header className="pipeline-modal-head">
          <h3>Pedido #{item.numero_pedido}</h3>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </header>
        <div className="pipeline-modal-body">
          <p><strong>Cliente:</strong> {item.cliente_nombre}</p>
          <p><strong>Teléfono:</strong> {item.telefono || "-"}</p>
          <p><strong>Dirección:</strong> {item.direccion || "-"}</p>
          <p><strong>Estado:</strong> {item.estado}</p>
          <p><strong>Total:</strong> ${Number(item.total || 0).toLocaleString()}</p>
          <p><strong>Productos:</strong> {item.resumen_productos || "-"}</p>
          {detail?.motivoRechazo ? <p><strong>Motivo rechazo:</strong> {detail.motivoRechazo}</p> : null}
          {item.imagen_url ? <img className="pipeline-modal-img" src={item.imagen_url} alt="Arreglo" /> : null}
        </div>
      </section>
    </div>
  );
}

