import { useEffect, useMemo, useState } from "react";
import { buildProductoLabel, dedupeCatalogItems, getProductoCodigo, getProductoId, getProductoNombre, normalizeCatalogItem, normalizeTime, toDateInput } from "./pipelineDomain.js";

export function PedidoModal({ item, detail, onClose, api, empresaId, sucursalId, onSaveEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedProductoID, setSelectedProductoID] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item) return;
    setIsEditing(false);
    setSearchTerm("");
    setError("");
  }, [item]);

  useEffect(() => {
    const firstProduct = Array.isArray(detail?.productos) && detail.productos.length > 0
      ? detail.productos[0]
      : null;

    const productoId = getProductoId(firstProduct);
    const productoName = getProductoNombre(firstProduct);
    const productoCode = getProductoCodigo(firstProduct);

    setSelectedProductoID(productoId != null ? String(productoId) : "");
    setSearchTerm(buildProductoLabel({ codigo: productoCode, nombre: productoName, id: productoId }));
    setFechaEntrega(toDateInput(detail?.destinatario?.fechaEntrega || item?.fecha_entrega || item?.fechaEntrega));
    setHoraEntrega(normalizeTime(detail?.destinatario?.horaEntrega || item?.hora_entrega || item?.horaEntrega));
  }, [detail, item]);

  useEffect(() => {
    const localItems = Array.isArray(detail?.productos)
      ? detail.productos
      : [];
    const normalized = localItems
      .map(producto => normalizeCatalogItem(producto))
      .filter(Boolean);
    setCatalogItems(dedupeCatalogItems(normalized));
  }, [detail]);

  useEffect(() => {
    if (!isEditing || !api || !empresaId) return;
    const q = String(searchTerm || "").trim();
    if (q.length < 2) return;

    let disposed = false;
    const timer = setTimeout(async () => {
      try {
        const payload = await api.buscarArreglosCatalogo({
          empresaId,
          sucursalId,
          q,
        });
        if (disposed) return;
        const rows = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];
        const nextItems = rows
          .map(entry => normalizeCatalogItem(entry))
          .filter(Boolean);
        setCatalogItems(current => dedupeCatalogItems([...current, ...nextItems]));
      } catch {
        // No bloquea edición si el endpoint de búsqueda no está disponible.
      }
    }, 280);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [api, empresaId, isEditing, searchTerm, sucursalId]);

  const filteredCatalog = useMemo(() => {
    const q = String(searchTerm || "").trim().toLowerCase();
    if (!q) return catalogItems;
    return catalogItems.filter(entry => {
      const code = String(entry.codigo || "").toLowerCase();
      const name = String(entry.nombre || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [catalogItems, searchTerm]);

  const handleSelectProducto = event => {
    const value = String(event.target.value || "");
    setSelectedProductoID(value);
    const selectedOption = catalogItems.find(option => String(option.id) === value);
    if (selectedOption) {
      setSearchTerm(buildProductoLabel(selectedOption));
    }
  };

  const toggleEdit = () => {
    if (saving) return;
    setError("");
    setIsEditing(current => !current);
  };

  const handleSave = async () => {
    if (!onSaveEdit || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSaveEdit({
        pedidoId: item.id_pedido,
        productoID: selectedProductoID ? Number(selectedProductoID) : null,
        fechaEntrega,
        horaEntrega,
      });
      setIsEditing(false);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  // Todos los hooks deben ejecutarse siempre en el mismo orden en cada
  // render; este guard va despues de declararlos todos (si no, React lanza
  // "Rendered more hooks than during the previous render" al pasar de
  // item=null a item=algo, lo que tumbaba el arbol entero sin error visible).
  if (!item) return null;

  return (
    <div className="pipeline-modal-overlay" onClick={onClose}>
      <section className="pipeline-modal" onClick={event => event.stopPropagation()}>
        <header className="pipeline-modal-head">
          <h3>Pedido #{item.numero_pedido || 'Pendiente'}</h3>
          <div className="pipeline-modal-actions">
            <button type="button" className="btn-outline" onClick={toggleEdit} disabled={saving}>
              {isEditing ? "Cancelar edición" : "Editar"}
            </button>
            <button type="button" className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </header>
        <div className="pipeline-modal-body">
          <p><strong>Cliente:</strong> {item.cliente_nombre}</p>
          <p><strong>Teléfono:</strong> {item.telefono || "-"}</p>
          <p><strong>Dirección:</strong> {item.direccion || "-"}</p>
          <p><strong>Estado:</strong> {item.estado}</p>
          <p><strong>Total:</strong> ${Number(item.total || 0).toLocaleString()}</p>
          <p><strong>Productos:</strong> {item.resumen_productos || "-"}</p>
          {detail?.motivoRechazo ? <p><strong>Motivo rechazo:</strong> {detail.motivoRechazo}</p> : null}

          {isEditing ? (
            <section className="pipeline-edit-box">
              <h4>Editar programación del pedido</h4>
              <label className="pipeline-edit-label">
                Buscar arreglo (código o nombre)
                <input
                  type="text"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Ej: ROS-001 · Ramo Premium"
                />
              </label>

              <label className="pipeline-edit-label">
                Seleccionar arreglo
                <select value={selectedProductoID} onChange={handleSelectProducto}>
                  <option value="">Sin cambio</option>
                  {filteredCatalog.map(option => (
                    <option key={option.id} value={String(option.id)}>
                      {buildProductoLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pipeline-edit-grid">
                <label className="pipeline-edit-label">
                  Fecha de entrega
                  <input
                    type="date"
                    value={fechaEntrega}
                    onChange={event => setFechaEntrega(event.target.value)}
                  />
                </label>
                <label className="pipeline-edit-label">
                  Hora de entrega
                  <input
                    type="time"
                    value={horaEntrega}
                    onChange={event => setHoraEntrega(event.target.value)}
                  />
                </label>
              </div>

              {error ? <p className="orders-message">{error}</p> : null}

              <div className="pipeline-edit-actions">
                <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </section>
          ) : null}

          {item.imagen_url ? <img className="pipeline-modal-img" src={item.imagen_url} alt="Arreglo" /> : null}
        </div>
      </section>
    </div>
  );
}
