import { useEffect, useMemo, useState } from "react";

export function PedidoModal({ item, detail, onClose, api, empresaId, sucursalId, onSaveEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedProductoID, setSelectedProductoID] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!item) return null;

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

function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  return {
    id,
    codigo: getProductoCodigo(raw),
    nombre: getProductoNombre(raw),
  };
}

function getProductoId(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.productoID, raw.productoId, raw.id_producto, raw.idProducto, raw.id];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

function getProductoCodigo(raw) {
  if (!raw || typeof raw !== "object") return "";
  return String(raw.codigoProducto || raw.codigo || raw.sku || "").trim();
}

function getProductoNombre(raw) {
  if (!raw || typeof raw !== "object") return "";
  return String(raw.nombreProducto || raw.nombre || raw.descripcion || "").trim();
}

function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item || item.id == null) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

function buildProductoLabel(producto) {
  const codigo = String(producto?.codigo || "").trim();
  const nombre = String(producto?.nombre || "").trim();
  if (codigo && nombre) return `${codigo} - ${nombre}`;
  if (nombre) return nombre;
  if (codigo) return codigo;
  return "Producto sin nombre";
}

function toDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

