import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
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

export function OrdersAdminPage({ session, canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewInventario, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoInventario, onGoUsuarios }) {
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
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailEditFilterText, setDetailEditFilterText] = useState("");
  const [detailEditCatalog, setDetailEditCatalog] = useState([]);
  const [detailEditCatalogLoading, setDetailEditCatalogLoading] = useState(false);
  const [detailEditProductoID, setDetailEditProductoID] = useState("");
  const [detailEditNombreArreglo, setDetailEditNombreArreglo] = useState("");
  const [detailEditPrecio, setDetailEditPrecio] = useState(null);
  const [detailEditFechaEntrega, setDetailEditFechaEntrega] = useState("");
  const [detailEditHoraEntrega, setDetailEditHoraEntrega] = useState("");
  const [detailEditDestinatarioNombre, setDetailEditDestinatarioNombre] = useState("");
  const [detailEditTelefonoDestino, setDetailEditTelefonoDestino] = useState("");
  const [detailEditDireccion, setDetailEditDireccion] = useState("");
  const [detailEditBarrioNombre, setDetailEditBarrioNombre] = useState("");
  const [detailEditMensajeTarjeta, setDetailEditMensajeTarjeta] = useState("");
  const [detailEditMetodosPago, setDetailEditMetodosPago] = useState([]);
  const [detailEditCanalFlora, setDetailEditCanalFlora] = useState("");
  const [detailEditSaving, setDetailEditSaving] = useState(false);
  const [detailEditError, setDetailEditError] = useState("");
  const [detailEditDropdownOpen, setDetailEditDropdownOpen] = useState(false);

  const api = useMemo(() => createApiClient(tenantConfig), []);
  const debouncedQuery = useDebouncedValue(filters.q, 300);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const isFlora = empresaId === 3;

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

  useEffect(() => {
    if (!detalle || detalle.error) {
      setIsEditingDetail(false);
      setDetailEditFilterText("");
      setDetailEditCatalog([]);
      setDetailEditProductoID("");
      setDetailEditNombreArreglo("");
      setDetailEditPrecio(null);
      setDetailEditFechaEntrega("");
      setDetailEditHoraEntrega("");
      setDetailEditDestinatarioNombre("");
      setDetailEditTelefonoDestino("");
      setDetailEditDireccion("");
      setDetailEditBarrioNombre("");
      setDetailEditMensajeTarjeta("");
      setDetailEditMetodosPago([]);
      setDetailEditCanalFlora("");
      setDetailEditError("");
      setDetailEditDropdownOpen(false);
      return;
    }

    const firstProduct = Array.isArray(detalle.productos) && detalle.productos.length > 0
      ? detalle.productos[0]
      : null;
    const productoId = getProductoId(firstProduct);
    const productoNombre = firstProduct
      ? String(firstProduct.nombreProducto || firstProduct.nombre || "").trim()
      : "";
    const productoPrecio = firstProduct ? Number(firstProduct.precioUnitario || firstProduct.precio || firstProduct.subtotal || 0) : null;

    setDetailEditProductoID(productoId != null ? String(productoId) : "");
    setDetailEditNombreArreglo(productoNombre);
    setDetailEditPrecio(productoPrecio);
    setDetailEditFechaEntrega(toDateInput(detalle.destinatario?.fechaEntrega));
    setDetailEditHoraEntrega(normalizeTime(detalle.destinatario?.horaEntrega));
    setDetailEditDestinatarioNombre(String(detalle.destinatario?.nombre || ""));
    setDetailEditTelefonoDestino(String(detalle.destinatario?.telefono || ""));
    setDetailEditDireccion(String(detalle.destinatario?.direccion || ""));
    setDetailEditBarrioNombre(String(detalle.destinatario?.barrio || ""));
    setDetailEditMensajeTarjeta(String(detalle.destinatario?.mensajeTarjeta || ""));
    setDetailEditMetodosPago(Array.isArray(detalle.financiero?.metodosPago) ? detalle.financiero.metodosPago.map(item => String(item)) : []);
    setDetailEditCanalFlora(String(detalle.financiero?.canalFlora || ""));

    const initialCatalog = (Array.isArray(detalle.productos) ? detalle.productos : [])
      .map(item => normalizeCatalogItem(item))
      .filter(Boolean);
    setDetailEditCatalog(dedupeCatalogItems(initialCatalog));
    setDetailEditError("");
  }, [detalle]);

  useEffect(() => {
    if (!drawerOpen) {
      setIsEditingDetail(false);
      setDetailEditError("");
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!isEditingDetail) return;
    // Carga el catálogo completo al abrir modo edición.
    let disposed = false;
    setDetailEditCatalogLoading(true);
    api.buscarArreglosCatalogo({ empresaId, sucursalId, q: "" })
      .then(payload => {
        if (disposed) return;
        const rows = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];
        const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
        setDetailEditCatalog(current => dedupeCatalogItems([...current, ...loaded]));
      })
      .catch(() => {})
      .finally(() => { if (!disposed) setDetailEditCatalogLoading(false); });

    return () => { disposed = true; };
  }, [api, empresaId, isEditingDetail, sucursalId]);

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

  const filteredDetailCatalog = useMemo(() => {
    const q = String(detailEditFilterText || "").trim().toLowerCase();
    if (!q) return detailEditCatalog;
    return detailEditCatalog.filter(item => {
      const codigo = String(item.codigo || "").toLowerCase();
      const nombre = String(item.nombre || "").toLowerCase();
      return codigo.includes(q) || nombre.includes(q);
    });
  }, [detailEditCatalog, detailEditFilterText]);

  const onSearchCatalog = async () => {
    const q = String(detailEditFilterText || "").trim();
    if (!q) return;
    setDetailEditCatalogLoading(true);
    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
      setDetailEditCatalog(current => dedupeCatalogItems([...current, ...loaded]));
    } catch {
      // Silencioso.
    } finally {
      setDetailEditCatalogLoading(false);
    }
  };

  const onToggleDetailEdit = () => {
    if (detailEditSaving) return;
    setDetailEditError("");
    setIsEditingDetail(current => !current);
  };

  const onSaveDetailEdit = async () => {
    if (!selectedPedidoId || detailEditSaving) return;
    setDetailEditError("");
    setDetailEditSaving(true);
    try {
      await api.actualizarDetallePedidoPipeline({
        pedidoId: selectedPedidoId,
        productoID: detailEditProductoID ? Number(detailEditProductoID) : null,
        fechaEntrega: detailEditFechaEntrega,
        horaEntrega: detailEditHoraEntrega,
        destinatarioNombre: detailEditDestinatarioNombre,
        telefonoDestino: detailEditTelefonoDestino,
        direccion: detailEditDireccion,
        barrioNombre: detailEditBarrioNombre,
        mensajeTarjeta: detailEditMensajeTarjeta,
        metodosPago: isFlora ? detailEditMetodosPago : null,
        canalFlora: isFlora ? detailEditCanalFlora : null,
      });
      await reloadDrawer();
      setIsEditingDetail(false);
    } catch (nextError) {
      setDetailEditError(nextError?.message || "No fue posible guardar la edición del pedido.");
    } finally {
      setDetailEditSaving(false);
    }
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
            {canViewPipeline ? (
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
            ) : null}
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
                  const waPhone = String(item.telefonoCompleto || item.telefono || "").trim().replace(/\+/g, "");
                  const canAct = isPendingStatus(item.estado);
                  const canDownloadInvoice = canInvoiceStatus(item.estado);
                  const canViewMessageCard = canMessageCardStatus(item.estado);
                  const pedidoId = Number(item.pedidoID);
                  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(item.fechaPedido || item.fecha);
                  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(item.fechaEntrega);

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
            {!detalle?.error && detalle ? (
              <button type="button" className="btn-outline" onClick={onToggleDetailEdit} title="Editar arreglo y entrega">
                {isEditingDetail ? "Cancelar edición" : "Editar"}
              </button>
            ) : null}
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
            <>
              {isEditingDetail ? (
                <section className="order-block order-detail-edit-box">
                  <h4>Editar pedido</h4>

                  <div className="order-detail-edit-label">
                    <span>Arreglo actual</span>
                    <input
                      type="text"
                      value={detailEditNombreArreglo || "(sin arreglo)"}
                      readOnly
                      className="order-detail-edit-readonly"
                    />
                  </div>

                  {detailEditPrecio != null ? (
                    <div className="order-detail-edit-label">
                      <span>Precio arreglo</span>
                      <input
                        type="text"
                        value={`$${formatearCOP(detailEditPrecio)}`}
                        readOnly
                        className="order-detail-edit-readonly"
                      />
                    </div>
                  ) : null}

                  <div className="order-detail-edit-label">
                    Cambiar arreglo
                    <div className="order-combobox">
                      <button
                        type="button"
                        className="order-combobox-trigger"
                        onClick={() => setDetailEditDropdownOpen(open => !open)}
                      >
                        <span>{detailEditProductoID
                          ? buildProductoLabel(detailEditCatalog.find(i => String(i.id) === detailEditProductoID) || {})
                          : "— Selecciona un arreglo —"}
                        </span>
                        <span className="order-combobox-arrow">{detailEditDropdownOpen ? "▲" : "▼"}</span>
                      </button>

                      {detailEditDropdownOpen ? (
                        <div className="order-combobox-panel">
                          <div className="order-combobox-search-row">
                            <input
                              autoFocus
                              type="text"
                              value={detailEditFilterText}
                              onChange={event => setDetailEditFilterText(event.target.value)}
                              onKeyDown={event => { if (event.key === "Enter") onSearchCatalog(); }}
                              placeholder="Buscar por código o nombre..."
                              className="order-combobox-search"
                            />
                            <button
                              type="button"
                              className="btn-outline order-detail-search-btn"
                              onClick={onSearchCatalog}
                              disabled={detailEditCatalogLoading}
                            >
                              {detailEditCatalogLoading ? "..." : "Buscar"}
                            </button>
                          </div>
                          <ul className="order-combobox-list">
                            {filteredDetailCatalog.length === 0 ? (
                              <li className="order-combobox-empty">Sin resultados</li>
                            ) : filteredDetailCatalog.map(item => (
                              <li
                                key={item.id}
                                className={`order-combobox-option${String(item.id) === detailEditProductoID ? " is-selected" : ""}`}
                                onClick={() => {
                                  setDetailEditProductoID(String(item.id));
                                  setDetailEditNombreArreglo(String(item.nombre || ""));
                                  setDetailEditPrecio(item.precio != null ? Number(item.precio) : null);
                                  setDetailEditDropdownOpen(false);
                                  setDetailEditFilterText("");
                                }}
                              >
                                {buildProductoLabel(item)}
                                {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Fecha entrega
                      <input
                        type="date"
                        value={detailEditFechaEntrega}
                        onChange={event => setDetailEditFechaEntrega(event.target.value)}
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Hora entrega
                      <input
                        type="time"
                        value={detailEditHoraEntrega}
                        onChange={event => setDetailEditHoraEntrega(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Nombre destinatario
                      <input
                        type="text"
                        value={detailEditDestinatarioNombre}
                        onChange={event => setDetailEditDestinatarioNombre(event.target.value)}
                        placeholder="Nombre de quien recibe"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Teléfono destinatario
                      <input
                        type="text"
                        value={detailEditTelefonoDestino}
                        onChange={event => setDetailEditTelefonoDestino(event.target.value)}
                        placeholder="Teléfono de contacto"
                      />
                    </label>
                  </div>

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Dirección
                      <input
                        type="text"
                        value={detailEditDireccion}
                        onChange={event => setDetailEditDireccion(event.target.value)}
                        placeholder="Dirección de entrega"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Barrio
                      <input
                        type="text"
                        value={detailEditBarrioNombre}
                        onChange={event => setDetailEditBarrioNombre(event.target.value)}
                        placeholder="Barrio de entrega"
                      />
                    </label>
                  </div>

                  <label className="order-detail-edit-label">
                    Mensaje tarjeta
                    <textarea
                      rows={3}
                      value={detailEditMensajeTarjeta}
                      onChange={event => setDetailEditMensajeTarjeta(event.target.value)}
                      placeholder="Mensaje para la tarjeta floral"
                    />
                  </label>

                  {isFlora ? (
                    <>
                      <div className="order-detail-edit-label">
                        <span>Métodos de pago</span>
                        <div className="order-detail-edit-checklist">
                          {FLORA_PAYMENT_METHODS.map(option => (
                            <label key={option} className="order-detail-edit-checkitem">
                              <input
                                type="checkbox"
                                checked={detailEditMetodosPago.includes(option)}
                                onChange={() => {
                                  setDetailEditMetodosPago(current => current.includes(option)
                                    ? current.filter(item => item !== option)
                                    : [...current, option]);
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="order-detail-edit-label">
                        Celular Flora
                        <select value={detailEditCanalFlora} onChange={event => setDetailEditCanalFlora(event.target.value)}>
                          <option value="">Selecciona un canal</option>
                          {FLORA_SALES_CHANNELS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}

                  {detailEditError ? <p className="orders-message">{detailEditError}</p> : null}

                  <div className="order-detail-edit-actions">
                    <button type="button" className="btn-primary" onClick={onSaveDetailEdit} disabled={detailEditSaving}>
                      {detailEditSaving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </section>
              ) : null}

              <OrderDetail detalle={detalle} />
            </>
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
  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(detalle.fechaPedido || detalle.fecha);
  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(detalle.destinatario?.fechaEntrega);

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
        <p><strong>Fecha entrega:</strong> {fechaEntrega || "-"}</p>
        <p><strong>Hora entrega:</strong> {detalle.destinatario?.horaEntrega || horaEntrega || "-"}</p>
        <p><strong>Mensaje:</strong> {detalle.destinatario?.mensajeTarjeta || "-"}</p>
      </section>

      <section className="order-block">
        <h4>💰 Resumen financiero</h4>
        <p><strong>Subtotal:</strong> ${formatearCOP(Number(detalle.financiero?.subtotal || 0))}</p>
        <p><strong>IVA:</strong> ${formatearCOP(Number(detalle.financiero?.iva || 0))}</p>
        <p><strong>Domicilio:</strong> ${formatearCOP(Number(detalle.financiero?.domicilio || 0))}</p>
        <p><strong>Total:</strong> ${formatearCOP(Number(detalle.financiero?.total || 0))}</p>
        <p><strong>Estado pago:</strong> {detalle.financiero?.estadoPago || "-"}</p>
        <p><strong>Método pago:</strong> {detalle.financiero?.metodoPago || "-"}</p>
        <p><strong>Cuenta bancaria:</strong> {detalle.financiero?.cuentaBancaria || "-"}</p>
        <p><strong>Celular Flora:</strong> {detalle.financiero?.canalFlora || "-"}</p>
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

function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  const precio = raw?.precio != null
    ? Number(raw.precio)
    : raw?.precioUnitario != null
      ? Number(raw.precioUnitario)
      : null;
  return {
    id,
    codigo: String(raw?.codigoProducto || raw?.codigo || raw?.sku || "").trim(),
    nombre: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    precio,
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

const FLORA_PAYMENT_METHODS = [
  "Cuenta por cobrar",
  "Efectivo",
  "Canje",
  "Contraentrega",
  "Cotizacion",
  "Obsequio",
  "Paypal",
  "Link bold",
  "Link payu",
  "Link wompi",
  "Datafono credibanco",
  "Datafono Bold",
  "Transferencia 0257",
  "Transferencia 0005",
  "Transferencia 3220",
  "Transferencia 4038",
  "Transferencia 4966",
  "Transferencia 3671",
  "Transferencia 6913",
  "Transferencia 5431",
  "Transferencia 1340",
  "Transferencia Jaque",
  "Transferencia QR",
  "Anulado",
];

const FLORA_SALES_CHANNELS = [
  "Huawei",
  "Samsung",
  "Andrea",
  "Página Web",
  "Presencial",
  "Rappi",
];




