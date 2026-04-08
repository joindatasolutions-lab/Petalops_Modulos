import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { formatearCOP, normalizeStatus, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
import { useDebouncedValue } from "../../shared/useDebouncedValue.js";

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  CREADO: "is-pendiente",
  APROBADO: "is-aprobado",
  CANCELADO: "is-rechazado",
};

const initialFilters = {
  q: "",
  estado: "",
  fechaDesde: "",
  fechaHasta: "",
  page: 1,
  pageSize: 20
};

export function OrdersAdminPage({ session, canViewPedidos, canViewProduccion, canViewDomicilios, canViewInventario, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoInventario, onGoUsuarios }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPedidoId, setSelectedPedidoId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [messageCardOpen, setMessageCardOpen] = useState(false);
  const [messageCardData, setMessageCardData] = useState(null);
  const [messageCardOrder, setMessageCardOrder] = useState(null);
  const [cardFontFamily, setCardFontFamily] = useState("Georgia, serif");
  const [cardFontSize, setCardFontSize] = useState(24);
  const [cardTextColor, setCardTextColor] = useState("#1f2937");
  const [cardTextAlign, setCardTextAlign] = useState("center");
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const api = useMemo(() => createApiClient(tenantConfig), []);
  const debouncedQuery = useDebouncedValue(filters.q, 300);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data = await api.listarPedidos({
        empresaId,
        sucursalId,
        q: debouncedQuery,
        estado: filters.estado,
        fechaDesde: toIsoDateStart(filters.fechaDesde),
        fechaHasta: toIsoDateEnd(filters.fechaHasta),
        page: filters.page,
        pageSize: filters.pageSize
      });

      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setError("");
    } catch (nextError) {
      console.error("Error cargando pedidos:", nextError);
      setItems([]);
      setTotal(0);
      setError("No fue posible cargar pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, debouncedQuery, filters.estado, filters.fechaDesde, filters.fechaHasta, filters.page, filters.pageSize, empresaId, sucursalId]);

  useEffect(() => {
    loadOrders(false);
  }, [loadOrders]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) {
        setSidebarMobileOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    if (messageCardOpen) {
      body.classList.add("print-message-card-mode");
    } else {
      body.classList.remove("print-message-card-mode");
    }

    return () => body.classList.remove("print-message-card-mode");
  }, [messageCardOpen]);

  const applyFilterValue = (name, value) => {
    setFilters(current => ({
      ...current,
      [name]: value,
      page: 1
    }));
  };

  const openDetail = async pedidoId => {
    setDrawerOpen(true);
    setSelectedPedidoId(pedidoId);
    setDetalle(null);

    try {
      const detail = await api.obtenerDetallePedido(pedidoId);
      setDetalle(detail);
    } catch (nextError) {
      console.error("Error obteniendo detalle:", nextError);
      setDetalle({ error: true });
    }
  };

  const optimisticStatusPatch = (pedidoId, nextStatus) => {
    setItems(current => current.map(item => Number(item.pedidoID) === Number(pedidoId)
      ? { ...item, estado: nextStatus }
      : item));

    setDetalle(current => {
      if (!current || Number(selectedPedidoId) !== Number(pedidoId)) return current;
      return { ...current, estado: nextStatus };
    });
  };

  const approveOrder = async pedidoId => {
    const ok = globalThis.confirm("¿Aprobar este pedido?");
    if (!ok) return;

    try {
      const response = await api.aprobarPedido(pedidoId);
      optimisticStatusPatch(pedidoId, response.estado || "APROBADO");
    } catch (nextError) {
      console.error("Error aprobando pedido:", nextError);
      globalThis.alert("No fue posible aprobar el pedido.");
    }
  };

  const rejectOrder = async pedidoId => {
    const motivo = String(globalThis.prompt("Motivo de rechazo", "") || "").trim();
    if (!motivo) {
      globalThis.alert("Debes ingresar un motivo de rechazo.");
      return;
    }

    try {
      const response = await api.rechazarPedido(pedidoId, motivo);
      optimisticStatusPatch(pedidoId, response.estado || "RECHAZADO");
    } catch (nextError) {
      console.error("Error rechazando pedido:", nextError);
      globalThis.alert("No fue posible rechazar el pedido.");
    }
  };

  const downloadInvoice = async pedidoId => {
    try {
      const { blob, filename } = await api.descargarFacturaPedido(pedidoId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `factura_pedido_${pedidoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (nextError) {
      console.error("Error descargando factura:", nextError);
      globalThis.alert("No fue posible descargar la factura del pedido.");
    }
  };

  const openMessageCard = async item => {
    const pedidoId = Number(item?.pedidoID);
    setMessageCardOrder(item || null);
    try {
      const payload = await api.obtenerMensajeTarjeta(pedidoId);
      setMessageCardData(payload);
      setMessageCardOpen(true);
    } catch (nextError) {
      console.error("Error obteniendo mensaje de tarjeta:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible consultar el mensaje del pedido.");
    }
  };

  const closeMessageCard = () => {
    setMessageCardOpen(false);
  };

  const refresh = () => loadOrders(false);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedPedidoId(null);
  };

  const reloadDrawer = async () => {
    if (!selectedPedidoId) return;
    await openDetail(selectedPedidoId);
    await loadOrders(true);
  };

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }

    setSidebarPinned(current => !current);
  };

  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 20);
  const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));

  return (
    <>
      <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
            <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
          </div>

          <nav className="sidebar-nav" aria-label="Módulos">
            <button
              type="button"
              className="sidebar-nav-btn"
              title="Pipeline"
              onClick={() => {
                setSidebarMobileOpen(false);
                onGoPipeline();
              }}
            >
              <span className="sidebar-nav-icon">▦</span>
              <span className="sidebar-nav-text">Pipeline</span>
            </button>
            {canViewPedidos ? (
              <button
                type="button"
                className="sidebar-nav-btn is-active"
                title="Pedidos"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoPedidos();
                }}
              >
                <span className="sidebar-nav-icon">🧾</span>
                <span className="sidebar-nav-text">Pedidos</span>
              </button>
            ) : null}
            {canViewProduccion ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Producción"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoProduccion();
                }}
              >
                <span className="sidebar-nav-icon">🏭</span>
                <span className="sidebar-nav-text">Producción</span>
              </button>
            ) : null}
            {canViewDomicilios ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Domicilios"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoDomicilios();
                }}
              >
                <span className="sidebar-nav-icon">🛵</span>
                <span className="sidebar-nav-text">Domicilios</span>
              </button>
            ) : null}
            {canViewInventario ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Inventario"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoInventario();
                }}
              >
                <span className="sidebar-nav-icon">📦</span>
                <span className="sidebar-nav-text">Inventario</span>
              </button>
            ) : null}
            {canViewUsuariosPanel ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Gestión Usuarios"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoUsuarios();
                }}
              >
                <span className="sidebar-nav-icon">👥</span>
                <span className="sidebar-nav-text">Gestión Usuarios</span>
              </button>
            ) : null}
          </nav>

          <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
            <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
            <span className="sidebar-logout-text">Cerrar sesión</span>
          </button>

          <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar} title={sidebarPinned ? "Contraer menú" : "Expandir menú"}>
            {sidebarPinned ? "←" : "→"}
          </button>

          <p className="sidebar-caption">Escalable para nuevos módulos</p>
        </aside>

        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setSidebarMobileOpen(false)}
        />

        <main className="orders-admin-view">
          <header className="orders-admin-header">
            <div>
              <button type="button" className="sidebar-trigger" onClick={toggleSidebar} title="Abrir o cerrar menú">☰ Menú</button>
              <h1>Gestión de Pedidos</h1>
              <p className="orders-admin-subtitle">Panel operativo para administrar pedidos de tus floristerías</p>
            </div>
            <button type="button" className="btn-primary" onClick={refresh} title="Actualizar pedidos">Actualizar</button>
          </header>

          <section className="orders-filters">
            <input
              type="text"
              placeholder="Buscar pedido, cliente, destinatario..."
              value={filters.q}
              onChange={event => applyFilterValue("q", event.target.value)}
            />
            <select value={filters.estado} onChange={event => applyFilterValue("estado", event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="CREADO">Creado</option>
              <option value="APROBADO">Aprobado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={event => applyFilterValue("fechaDesde", event.target.value)}
            />
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={event => applyFilterValue("fechaHasta", event.target.value)}
            />
          </section>

          {error && <p className="orders-message">{error}</p>}
          {loading && <p className="orders-message">Cargando pedidos...</p>}
          {!loading && !error && items.length === 0 && (
            <p className="orders-message">No hay pedidos para los filtros seleccionados.</p>
          )}

          <section className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Fecha Pedido</th>
                  <th>Hora Pedido</th>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Destinatario</th>
                  <th>Fecha Entrega</th>
                  <th>Hora Entrega</th>
                  <th>Producto(s)</th>
                  <th>Total</th>
                  <th>Método pago</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const statusClass = statusBadgeClass(item.estado);
                  const productText = (item.productos || []).slice(0, 2).join(", ");
                  const phone = String(item.telefonoCompleto || item.telefono || "").trim();
                  const waPhone = phone.replace(/\+/g, "");
                  const canAct = isPendingStatus(item.estado);
                  const canDownloadInvoice = canInvoiceStatus(item.estado);
                  const canViewMessageCard = canMessageCardStatus(item.estado);
                  const pedidoId = Number(item.pedidoID);
                  const { fechaPedido, horaPedido } = splitDateTime(item.fechaPedido || item.fecha);
                  const { fechaPedido: fechaEntrega, horaPedido: horaEntrega } = splitDateTime(item.fechaEntrega);

                  return (
                    <tr key={pedidoId || `${item.numeroPedido}-${item.fecha}`}>
                      <td data-label="Fecha Pedido">{fechaPedido || "-"}</td>
                      <td data-label="Hora Pedido">{item.horaPedido || horaPedido || "-"}</td>
                      <td data-label="Número">{item.numeroPedido || "-"}</td>
                      <td data-label="Cliente">{item.cliente || "-"}</td>
                      <td data-label="Destinatario">{item.destinatario || "-"}</td>
                      <td data-label="Fecha Entrega">{fechaEntrega || "-"}</td>
                      <td data-label="Hora Entrega">{item.horaEntrega || horaEntrega || "-"}</td>
                      <td data-label="Producto(s)" title={(item.productos || []).join(", ")}>{productText || "-"}</td>
                      <td data-label="Total">${formatearCOP(Number(item.total || 0))}</td>
                      <td data-label="Método pago">{item.metodoPago || "-"}</td>
                      <td data-label="Estado"><span className={`order-badge ${statusClass}`}>{item.estado || "-"}</span></td>
                      <td data-label="Acciones">
                        <div className="order-actions">
                          <a href={`tel:${phone}`} className="order-icon" title="Llamar">📞</a>
                          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="order-icon" title="WhatsApp">💬</a>
                          <button type="button" className="order-icon" onClick={() => openDetail(pedidoId)} title="Ver detalle">👁</button>
                          <button type="button" className="order-icon" onClick={() => approveOrder(pedidoId)} disabled={!canAct} title="Aprobar pedido">✔</button>
                          <button type="button" className="order-icon" onClick={() => rejectOrder(pedidoId)} disabled={!canAct} title="Rechazar pedido">✖</button>
                          {canDownloadInvoice && (
                            <button type="button" className="order-icon" onClick={() => downloadInvoice(pedidoId)} title="Descargar factura">🧾</button>
                          )}
                          {canViewMessageCard && (
                            <button
                              type="button"
                              className="btn-outline order-message-btn"
                              onClick={() => openMessageCard(item)}
                              title="Ver mensaje e imprimir tarjeta"
                            >
                              Ver mensaje / Imprimir tarjeta
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <footer className="orders-pager">
            <button
              type="button"
              className="btn-outline"
              title="Ir a la página anterior"
              onClick={() => setFilters(current => ({ ...current, page: Math.max(1, Number(current.page || 1) - 1) }))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>Página {page} de {pages} · {total} pedidos</span>
            <button
              type="button"
              className="btn-outline"
              title="Ir a la página siguiente"
              onClick={() => setFilters(current => ({ ...current, page: Number(current.page || 1) + 1 }))}
              disabled={page >= pages}
            >
              Siguiente
            </button>
          </footer>
        </main>
      </div>

      <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>Detalle pedido</strong>
          <div className="orders-drawer-head-actions">
            {canInvoiceStatus(detalle?.estado) && selectedPedidoId && (
              <button type="button" className="btn-outline" onClick={() => downloadInvoice(selectedPedidoId)} title="Descargar factura en PDF">Descargar factura</button>
            )}
            <button type="button" className="btn-outline" onClick={reloadDrawer} title="Recargar detalle del pedido">Recargar</button>
            <button type="button" className="icon-btn" onClick={closeDrawer} title="Cerrar detalle">✕</button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!drawerOpen ? null : !detalle ? (
            <p className="order-drawer-empty">Cargando detalle...</p>
          ) : detalle.error ? (
            <p className="order-drawer-empty">No fue posible cargar el detalle.</p>
          ) : (
            <OrderDetail detalle={detalle} />
          )}
        </div>
      </aside>

      {messageCardOpen && (
        <div className="message-card-overlay" role="dialog" aria-modal="true" aria-label="Tarjeta de mensaje floral">
          <div className="message-card-panel">
            <div className="message-card-toolbar no-print-card">
              <h3>Tarjeta de mensaje floral</h3>
              <div className="message-card-controls">
                <label>
                  Fuente
                  <select value={cardFontFamily} onChange={event => setCardFontFamily(event.target.value)}>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                    <option value="'Courier New', monospace">Courier New</option>
                  </select>
                </label>
                <label>
                  Tamaño
                  <input
                    type="range"
                    min={14}
                    max={48}
                    step={1}
                    value={cardFontSize}
                    onChange={event => setCardFontSize(Number(event.target.value))}
                  />
                </label>
                <label>
                  Color
                  <input type="color" value={cardTextColor} onChange={event => setCardTextColor(event.target.value)} />
                </label>
                <label>
                  Alineación
                  <select value={cardTextAlign} onChange={event => setCardTextAlign(event.target.value)}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
              </div>
              <div className="message-card-actions">
                <button type="button" className="btn-primary" onClick={() => globalThis.print()}>Imprimir tarjeta</button>
                <button type="button" className="btn-outline" onClick={closeMessageCard}>Cerrar</button>
              </div>
            </div>

            <section className="message-card-canvas" aria-label="Tarjeta imprimible">
              <div className="message-card-content" style={{ textAlign: cardTextAlign }}>
              <p className="message-card-meta">
                {String(messageCardOrder?.numeroPedido || "-")}
              </p>
              <p className="message-card-meta">
                {formatFechaEntregaTarjeta(messageCardData?.fechaEntrega || messageCardOrder?.fechaEntrega)}
              </p>
              <p className="message-card-meta message-card-destinatario-meta">
                {String(messageCardData?.destinatario || "Sin destinatario")}
              </p>
              <p
                className="message-card-message"
                style={{
                  fontFamily: cardFontFamily,
                  fontSize: `${cardFontSize}px`,
                  color: cardTextColor,
                }}
              >
                "{String(messageCardData?.mensaje || "Sin mensaje")}" 
              </p>
              <p className="message-card-meta">
                {resolveFirmaTarjeta(messageCardData?.firma)}
              </p>
              <p className="message-card-brand">Flora Tienda de Flores</p>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function statusBadgeClass(status) {
  const key = normalizeStatus(status);
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

function isPendingStatus(status) {
  const key = normalizeStatus(status);
  return key === "PENDIENTE" || key === "CREADO";
}

function canInvoiceStatus(status) {
  const key = normalizeStatus(status);
  return key === "APROBADO";
}

function canMessageCardStatus(status) {
  const key = normalizeStatus(status);
  return key === "APROBADO";
}

function OrderDetail({ detalle }) {
  const productos = Array.isArray(detalle.productos) ? detalle.productos : [];
  const { fechaPedido, horaPedido } = splitDateTime(detalle.fechaPedido || detalle.fecha);

  return (
    <>
      <section className="order-block">
        <h4>📦 Información General</h4>
        <p><strong>Número:</strong> {detalle.numeroPedido || "-"}</p>
        <p><strong>Fecha Pedido:</strong> {fechaPedido || "-"}</p>
        <p><strong>Hora Pedido:</strong> {detalle.horaPedido || horaPedido || "-"}</p>
        <p><strong>Estado:</strong> {detalle.estado || "-"}</p>
        <p><strong>Empresa:</strong> {detalle.empresaID || "-"}</p>
        <p><strong>Sucursal:</strong> {detalle.sucursalID || "-"}</p>
        {detalle.motivoRechazo && <p><strong>Motivo rechazo:</strong> {detalle.motivoRechazo}</p>}
      </section>

      <section className="order-block">
        <h4>👤 Cliente</h4>
        <p><strong>Nombre:</strong> {detalle.cliente?.nombre || "-"}</p>
        <p><strong>Teléfono:</strong> {detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono || "-"}</p>
        <p><strong>Email:</strong> {detalle.cliente?.email || "-"}</p>
      </section>

      <section className="order-block">
        <h4>🎁 Destinatario</h4>
        <p><strong>Nombre:</strong> {detalle.destinatario?.nombre || "-"}</p>
        <p><strong>Teléfono:</strong> {detalle.destinatario?.telefono || "-"}</p>
        <p><strong>Dirección:</strong> {detalle.destinatario?.direccion || "-"}</p>
        <p><strong>Barrio:</strong> {detalle.destinatario?.barrio || "-"}</p>
        <p><strong>Fecha entrega:</strong> {detalle.destinatario?.fechaEntrega || "-"}</p>
        <p><strong>Hora entrega:</strong> {detalle.destinatario?.horaEntrega || "-"}</p>
        <p><strong>Mensaje:</strong> {detalle.destinatario?.mensajeTarjeta || "-"}</p>
      </section>

      <section className="order-block">
        <h4>💰 Resumen financiero</h4>
        <p><strong>Subtotal:</strong> ${formatearCOP(Number(detalle.financiero?.subtotal || 0))}</p>
        <p><strong>IVA:</strong> ${formatearCOP(Number(detalle.financiero?.iva || 0))}</p>
        <p><strong>Domicilio:</strong> ${formatearCOP(Number(detalle.financiero?.domicilio || 0))}</p>
        <p><strong>Total:</strong> ${formatearCOP(Number(detalle.financiero?.total || 0))}</p>
        <p><strong>Estado pago:</strong> {detalle.financiero?.estadoPago || "-"}</p>
        <p><strong>Cuenta bancaria:</strong> {detalle.financiero?.cuentaBancaria || "-"}</p>
      </section>

      <section className="order-block">
        <h4>🧾 Productos</h4>
        <ul className="order-products-list">
          {productos.length === 0 ? (
            <li>Sin productos</li>
          ) : (
            productos.map((producto, index) => (
              <li key={`${producto.nombreProducto}-${index}`}>
                <span>{producto.nombreProducto} x{Number(producto.cantidad || 0)}</span>
                <strong>${formatearCOP(Number(producto.subtotal || 0))}</strong>
              </li>
            ))
          )}
        </ul>
      </section>
    </>
  );
}

function splitDateTime(value) {
  const text = String(value || "").trim();
  if (!text) {
    return { fechaPedido: "", horaPedido: "" };
  }

  if (text.includes("T")) {
    const [datePart, timePart = ""] = text.split("T");
    return { fechaPedido: datePart || "", horaPedido: timePart.slice(0, 8) };
  }

  if (text.includes(" ")) {
    const [datePart, timePart = ""] = text.split(" ");
    return { fechaPedido: datePart || "", horaPedido: timePart.slice(0, 8) };
  }

  return { fechaPedido: text, horaPedido: "" };
}

function formatFechaEntregaTarjeta(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveFirmaTarjeta(value) {
  const text = String(value || "").trim();
  if (text) return text;
  return "Con carino, Flora";
}




