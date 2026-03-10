import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { normalizeStatus } from "../../shared/utils.js";

const ESTADOS_UI = ["Pendiente", "EnProduccion", "ParaEntrega", "Cancelado"];
const ESTADOS_FLORISTA = ["Activo", "Inactivo", "Incapacidad"];
const DEFAULT_USER = "admin.demo";
const LOOKER_STUDIO_URL = "https://lookerstudio.google.com/embed/reporting/d08a04af-ed8e-4dde-a83c-90888bfde39d/page/p_mp7qxa6dzd";
const SUBMENU_OPTIONS = [
  { key: "pedidos", label: "Pedidos" },
  { key: "historial", label: "Historial reasignaciones" },
  { key: "incapacidad", label: "Gestión incapacidad" },
  { key: "looker", label: "Looker" }
];

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  ENPRODUCCION: "is-produccion",
  PARAENTREGA: "is-entrega",
  CANCELADO: "is-rechazado"
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.includes("T")) {
    const [datePart, timePart = ""] = text.split("T");
    return `${datePart} ${timePart.slice(0, 5)}`.trim();
  }
  return text;
}

function statusBadgeClass(status) {
  const key = normalizeStatus(status).replace(/_/g, "");
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

export function ProductionPage({ session, canViewPedidos, canViewProduccion, canViewDomicilios, canViewInventario, canViewUsuariosPanel, onLogout, onGoPedidos, onGoProduccion, onGoDomicilios, onGoInventario, onGoUsuarios }) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);

  const [fecha, setFecha] = useState(todayIsoDate());
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [floristas, setFloristas] = useState([]);

  const [selectedFloristaById, setSelectedFloristaById] = useState({});
  const [selectedEstadoById, setSelectedEstadoById] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [usuarioCambio, setUsuarioCambio] = useState(DEFAULT_USER);
  const [motivoAccion, setMotivoAccion] = useState("");

  const [floristaGestionID, setFloristaGestionID] = useState("");
  const [floristaEstado, setFloristaEstado] = useState("Activo");
  const [fechaInicioIncapacidad, setFechaInicioIncapacidad] = useState(todayIsoDate());
  const [fechaFinIncapacidad, setFechaFinIncapacidad] = useState(todayIsoDate());

  const [metricasDesde, setMetricasDesde] = useState(todayIsoDate());
  const [metricasHasta, setMetricasHasta] = useState(todayIsoDate());
  const [historial, setHistorial] = useState([]);
  const [submenu, setSubmenu] = useState("pedidos");
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const submenuRef = useRef(null);

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [produccion, floristasData] = await Promise.all([
        api.listarProduccion({
          empresaId,
          sucursalId,
          fecha,
          estado: estado || undefined,
          incluirCancelado: false
        }),
        api.listarFloristas({
          empresaId,
          sucursalId,
          soloActivos: false
        })
      ]);

      const nextItems = Array.isArray(produccion.items) ? produccion.items : [];
      const nextFloristas = Array.isArray(floristasData.items) ? floristasData.items : [];

      setItems(nextItems);
      setFloristas(nextFloristas);
      if (!floristaGestionID && nextFloristas.length > 0) {
        setFloristaGestionID(String(nextFloristas[0].idFlorista));
      }
      setError("");
      return nextItems;
    } catch (nextError) {
      console.error("Error cargando producción:", nextError);
      setItems([]);
      setFloristas([]);
      setError("No fue posible cargar el módulo de producción.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [api, fecha, estado, floristaGestionID, empresaId, sucursalId]);

  const loadInsights = useCallback(async () => {
    try {
      const hist = await api.obtenerHistorialReasignaciones({
        empresaId,
        sucursalId,
        fechaDesde: metricasDesde,
        fechaHasta: metricasHasta
      });

      setHistorial(Array.isArray(hist.items) ? hist.items : []);
    } catch (nextError) {
      console.error("Error cargando insights de producción:", nextError);
    }
  }, [api, metricasDesde, metricasHasta, empresaId, sucursalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

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
    if (submenu !== "pedidos") {
      setDrawerOpen(false);
      setSelectedItem(null);
    }
  }, [submenu]);

  useEffect(() => {
    const handleDocumentClick = event => {
      if (!submenuOpen) return;
      const submenuNode = submenuRef.current;
      if (!submenuNode) return;
      if (!submenuNode.contains(event.target)) {
        setSubmenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [submenuOpen]);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }

    setSidebarPinned(current => !current);
  };

  const refreshAll = async () => {
    await loadData();
    await loadInsights();
  };

  const generarDesdePedidos = async () => {
    try {
      await api.generarProduccionDesdePedidos({
        empresaId,
        sucursalId,
        diasAnticipacion: 1,
        autoAsignar: true
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error generando producción desde pedidos:", nextError);
      globalThis.alert("No fue posible generar producción desde pedidos aprobados/pagados.");
    }
  };

  const openActionsDrawer = item => {
    if (!item) return;
    setSelectedItem(item);
    setDrawerOpen(true);
    setMotivoAccion("");
  };

  const closeActionsDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  const refreshAndKeepSelection = async produccionId => {
    const nextItems = await loadData();
    await loadInsights();
    const nextSelected = nextItems.find(item => Number(item.idProduccion) === Number(produccionId));
    if (nextSelected) {
      setSelectedItem(nextSelected);
      setDrawerOpen(true);
      return;
    }
    closeActionsDrawer();
  };

  const asignar = async item => {
    const floristaId = selectedFloristaById[item.idProduccion];

    try {
      await api.asignarProduccion({
        produccionId: item.idProduccion,
        floristaId: floristaId ? Number(floristaId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion
      });
      await refreshAndKeepSelection(item.idProduccion);
    } catch (nextError) {
      console.error("Error asignando producción:", nextError);
      globalThis.alert("No fue posible asignar el florista.");
    }
  };

  const reasignarAuditable = async item => {
    const floristaNuevoId = selectedFloristaById[item.idProduccion] || null;
    const motivo = String(motivoAccion || "").trim();
    if (!motivo) {
      globalThis.alert("Debes escribir un motivo para la reasignación auditada.");
      return;
    }

    try {
      await api.reasignarProduccion({
        produccionId: item.idProduccion,
        floristaNuevoId: floristaNuevoId ? Number(floristaNuevoId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion,
        motivo,
        usuarioCambio
      });
      await refreshAndKeepSelection(item.idProduccion);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error en reasignación auditada:", nextError);
      globalThis.alert("No fue posible realizar la reasignación auditada.");
    }
  };

  const cambiarEstado = async item => {
    const nuevoEstado = selectedEstadoById[item.idProduccion];
    if (!nuevoEstado) {
      globalThis.alert("Selecciona un estado.");
      return;
    }

    try {
      await api.cambiarEstadoProduccion({
        produccionId: item.idProduccion,
        nuevoEstado,
        observacionesInternas: motivoAccion || null
      });
      await refreshAndKeepSelection(item.idProduccion);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error cambiando estado:", nextError);
      globalThis.alert("No fue posible cambiar el estado. Verifica transición válida.");
    }
  };

  const recalcularPedido = async item => {
    try {
      await api.recalcularProduccionPedido({
        pedidoId: item.pedidoID,
        usuarioCambio,
        motivo: motivoAccion || "Recalculo desde front",
        productoEstructuralCambiado: false,
        forceCancelarYCrearNueva: false
      });
      await refreshAndKeepSelection(item.idProduccion);
    } catch (nextError) {
      console.error("Error recalculando producción por pedido:", nextError);
      globalThis.alert("No fue posible recalcular la producción del pedido.");
    }
  };

  const actualizarEstadoFlorista = async () => {
    if (!floristaGestionID) {
      globalThis.alert("Selecciona un florista.");
      return;
    }

    try {
      await api.actualizarEstadoFlorista({
        floristaId: Number(floristaGestionID),
        estado: floristaEstado,
        fechaInicioIncapacidad: floristaEstado === "Incapacidad" ? fechaInicioIncapacidad : null,
        fechaFinIncapacidad: floristaEstado === "Incapacidad" ? fechaFinIncapacidad : null,
        motivo: motivoAccion || "Cambio de estado florista",
        usuarioCambio
      });
      await refreshAll();
      globalThis.alert("Estado del florista actualizado.");
    } catch (nextError) {
      console.error("Error actualizando estado del florista:", nextError);
      globalThis.alert("No fue posible actualizar el estado del florista.");
    }
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/PetalOps.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/PetalOps%20Logo.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Módulos">
          {canViewPedidos ? (
            <button
              type="button"
              className="sidebar-nav-btn"
              title="Pedidos"
              onClick={() => {
                setSidebarMobileOpen(false);
                setSubmenuOpen(false);
                onGoPedidos();
              }}
            >
              <span className="sidebar-nav-icon">🧾</span>
              <span className="sidebar-nav-text">Pedidos</span>
            </button>
          ) : null}
          {canViewProduccion ? (
            <div ref={submenuRef} className="sidebar-submenu-wrap">
              <button
                type="button"
                className="sidebar-nav-btn is-active"
                title="Producción"
                onClick={() => {
                  onGoProduccion();
                  setSubmenuOpen(current => !current);
                }}
              >
                <span className="sidebar-nav-icon">🏭</span>
                <span className="sidebar-nav-text">Producción {submenuOpen ? "▾" : "▸"}</span>
              </button>

              {submenuOpen && (
                <div className="sidebar-submenu-panel">
                  {SUBMENU_OPTIONS.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      className={`sidebar-submenu-btn ${submenu === item.key ? "is-active" : ""}`}
                      title={`Ir a ${item.label}`}
                      onClick={() => {
                        setSubmenu(item.key);
                        setSubmenuOpen(false);
                        setSidebarMobileOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {canViewDomicilios ? (
            <button
              type="button"
              className="sidebar-nav-btn"
              title="Domicilios"
              onClick={() => {
                setSidebarMobileOpen(false);
                setSubmenuOpen(false);
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
                setSubmenuOpen(false);
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
              title="Gestion Usuarios"
              onClick={() => {
                setSidebarMobileOpen(false);
                setSubmenuOpen(false);
                onGoUsuarios();
              }}
            >
              <span className="sidebar-nav-icon">👥</span>
              <span className="sidebar-nav-text">Gestion Usuarios</span>
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

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar} title="Abrir o cerrar menú">☰ Menú</button>
            <h1>Módulo de Producción</h1>
            <p className="orders-admin-subtitle">Asignación inteligente, carga equitativa y control por fecha programada.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-outline" title="Crear tareas desde pedidos aprobados/pagados" onClick={generarDesdePedidos}>Sincronizar pedidos</button>
            <button type="button" className="btn-primary" title="Recargar vista" onClick={refreshAll}>Actualizar</button>
          </div>
        </header>

        <section className="orders-filters">
          <input type="text" value={usuarioCambio} onChange={event => setUsuarioCambio(event.target.value)} placeholder="usuarioCambio" title="Usuario de auditoría" />
        </section>

        {submenu === "pedidos" && (
          <>
            <section className="orders-filters">
              <input type="date" value={fecha} onChange={event => setFecha(event.target.value)} title="Filtrar por fecha programada" />
              <select value={estado} onChange={event => setEstado(event.target.value)} title="Filtrar por estado">
                <option value="">Todos menos cancelados</option>
                {ESTADOS_UI.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </section>

            {error && <p className="orders-message">{error}</p>}
            {loading && <p className="orders-message">Cargando producción...</p>}

            <section className="orders-table-wrap production-table-wrap">
              <table className="orders-table production-orders-table">
                <thead>
                  <tr>
                    <th>N° Pedido</th>
                    <th>Producto</th>
                    <th>Cliente</th>
                    <th>Fecha Entrega</th>
                    <th>Hora Entrega</th>
                    <th>Florista Asignado</th>
                    <th>Estado</th>
                    <th>Fecha Asignación</th>
                    <th>Tiempo restante</th>
                    <th>Estimado/Real (min)</th>
                    <th>Prioridad</th>
                    <th>Acciones Domicilios</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.idProduccion}>
                      <td>
                        <button type="button" className="btn-outline" title="Abrir acciones del pedido" onClick={() => openActionsDrawer(item)}>
                          {item.numeroPedido ?? "-"}
                        </button>
                      </td>
                      <td>{item.producto || "-"}</td>
                      <td>{item.cliente || "-"}</td>
                      <td>{formatDateTime(item.fechaEntrega)}</td>
                      <td>{item.horaEntrega || "-"}</td>
                      <td>{item.floristaAsignado || "Sin asignar"}</td>
                      <td><span className={`order-badge ${statusBadgeClass(item.estado)}`}>{item.estado || "-"}</span></td>
                      <td>{formatDateTime(item.fechaAsignacion)}</td>
                      <td>{typeof item.tiempoRestanteHoras === "number" ? `${item.tiempoRestanteHoras} h` : "-"}</td>
                      <td>{`${item.tiempoEstimadoMin ?? "-"} / ${item.tiempoRealMin ?? "-"}`}</td>
                      <td>{item.prioridad || "MEDIA"}</td>
                      <td>
                        <button type="button" className="btn-outline" title="Abrir barra lateral de acciones" onClick={() => openActionsDrawer(item)}>
                          Ver acciones
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="production-capsules" aria-label="Pedidos en cápsulas">
              {items.map(item => (
                <article key={`cap-${item.idProduccion}`} className="production-capsule">
                  <header className="production-capsule-head">
                    <strong>{item.numeroPedido ?? "-"}</strong>
                    <span className={`order-badge ${statusBadgeClass(item.estado)}`}>{item.estado || "-"}</span>
                  </header>

                  <div className="production-capsule-grid">
                    <p><span>Producto</span><strong>{item.producto || "-"}</strong></p>
                    <p><span>Cliente</span><strong>{item.cliente || "-"}</strong></p>
                    <p><span>Fecha entrega</span><strong>{formatDateTime(item.fechaEntrega)}</strong></p>
                    <p><span>Hora entrega</span><strong>{item.horaEntrega || "-"}</strong></p>
                    <p><span>Florista</span><strong>{item.floristaAsignado || "Sin asignar"}</strong></p>
                    <p><span>Asignación</span><strong>{formatDateTime(item.fechaAsignacion)}</strong></p>
                    <p><span>Tiempo</span><strong>{typeof item.tiempoRestanteHoras === "number" ? `${item.tiempoRestanteHoras} h` : "-"}</strong></p>
                    <p><span>Estimado/Real</span><strong>{`${item.tiempoEstimadoMin ?? "-"} / ${item.tiempoRealMin ?? "-"}`}</strong></p>
                    <p><span>Prioridad</span><strong>{item.prioridad || "MEDIA"}</strong></p>
                  </div>

                  <div className="production-capsule-actions">
                    <button type="button" className="btn-outline" title="Abrir barra lateral de acciones" onClick={() => openActionsDrawer(item)}>
                      Ver acciones
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}


        {submenu === "historial" && (
          <section className="order-block" style={{ marginTop: 12 }}>
            <h4>🧾 Historial de reasignaciones</h4>
            <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <input type="date" value={metricasDesde} onChange={event => setMetricasDesde(event.target.value)} title="Desde" />
              <input type="date" value={metricasHasta} onChange={event => setMetricasHasta(event.target.value)} title="Hasta" />
              <button type="button" className="btn-outline" onClick={loadInsights} title="Consultar">Consultar</button>
            </div>
            <ul className="order-products-list">
              {historial.length === 0 ? <li>Sin datos</li> : historial.map((item, idx) => (
                <li key={`${item.produccionID}-${item.fechaCambio}-${idx}`}>
                  <span>P{item.produccionID} · {item.usuarioCambio} · {item.motivo}</span>
                  <strong>{formatDateTime(item.fechaCambio)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        {submenu === "incapacidad" && (
          <section className="order-block" style={{ marginTop: 12 }}>
            <h4>🩺 Gestión de incapacidad</h4>
            <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={floristaGestionID} onChange={event => setFloristaGestionID(event.target.value)} title="Seleccionar florista">
                <option value="">Florista...</option>
                {floristas.map(f => <option key={f.idFlorista} value={f.idFlorista}>{f.nombre}</option>)}
              </select>
              <select value={floristaEstado} onChange={event => setFloristaEstado(event.target.value)} title="Estado del florista">
                {ESTADOS_FLORISTA.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <input type="date" value={fechaInicioIncapacidad} onChange={event => setFechaInicioIncapacidad(event.target.value)} title="Inicio incapacidad" />
              <input type="date" value={fechaFinIncapacidad} onChange={event => setFechaFinIncapacidad(event.target.value)} title="Fin incapacidad" />
              <input type="text" value={motivoAccion} onChange={event => setMotivoAccion(event.target.value)} placeholder="Motivo" title="Motivo de cambio" />
              <button type="button" className="btn-outline" onClick={actualizarEstadoFlorista} title="Aplicar estado florista">Aplicar estado</button>
            </div>
          </section>
        )}

        {submenu === "looker" && (
          <section className="order-block looker-block" style={{ marginTop: 12 }}>
            <div className="looker-header">
              <h4>📊 Looker Studio</h4>
              <a
                href={LOOKER_STUDIO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-outline looker-open-link"
                title="Abrir tablero en nueva pestaña"
              >
                Abrir en nueva pestaña
              </a>
            </div>

            <p className="orders-admin-subtitle looker-subtitle">
              Vista embebida del tablero operativo de Producción.
            </p>

            <div className="looker-frame-wrap">
              <iframe
                className="looker-frame"
                src={LOOKER_STUDIO_URL}
                title="Looker Studio - Producción"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                allowFullScreen
              />
            </div>
          </section>
        )}
      </main>

      <aside className={`orders-drawer ${drawerOpen && submenu === "pedidos" ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>Acciones Domicilios</strong>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeActionsDrawer} title="Cerrar barra lateral">✕</button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!drawerOpen || !selectedItem ? (
            <p className="order-drawer-empty">Selecciona un pedido para ver acciones.</p>
          ) : (
            <>
              <section className="order-block">
                <h4>📦 Pedido</h4>
                <p><strong>Número:</strong> {selectedItem.numeroPedido ?? "-"}</p>
                <p><strong>Cliente:</strong> {selectedItem.cliente || "-"}</p>
                <p><strong>Producto:</strong> {selectedItem.producto || "-"}</p>
                <p><strong>Estado:</strong> {selectedItem.estado || "-"}</p>
                <p><strong>Fecha Entrega:</strong> {formatDateTime(selectedItem.fechaEntrega)}</p>
                <p><strong>Hora Entrega:</strong> {selectedItem.horaEntrega || "-"}</p>
              </section>

              <section className="order-block">
                <h4>📝 Auditoría acción</h4>
                <input
                  type="text"
                  value={motivoAccion}
                  onChange={event => setMotivoAccion(event.target.value)}
                  placeholder="Motivo de acción (recomendado/obligatorio para reasignar)"
                  title="Motivo"
                />
              </section>

              <section className="order-block">
                <h4>👩‍🎨 Asignación</h4>
                <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={selectedFloristaById[selectedItem.idProduccion] || ""}
                    onChange={event => setSelectedFloristaById(current => ({ ...current, [selectedItem.idProduccion]: event.target.value }))}
                    title="Seleccionar florista"
                  >
                    <option value="">Auto</option>
                    {floristas.map(florista => (
                      <option key={florista.idFlorista} value={florista.idFlorista}>{florista.nombre}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-outline" title="Asignar florista" onClick={() => asignar(selectedItem)}>Asignar</button>
                  <button type="button" className="btn-outline" title="Reasignación auditada" onClick={() => reasignarAuditable(selectedItem)}>Reasignar auditado</button>
                </div>
              </section>

              <section className="order-block">
                <h4>🔄 Estado</h4>
                <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={selectedEstadoById[selectedItem.idProduccion] || ""}
                    onChange={event => setSelectedEstadoById(current => ({ ...current, [selectedItem.idProduccion]: event.target.value }))}
                    title="Seleccionar nuevo estado"
                  >
                    <option value="">Estado...</option>
                    {ESTADOS_UI.filter(state => normalizeStatus(state) !== normalizeStatus(selectedItem.estado)).map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-outline" title="Aplicar cambio de estado" onClick={() => cambiarEstado(selectedItem)}>Cambiar estado</button>
                </div>
              </section>

              <section className="order-block">
                <h4>♻️ Recalcular pedido</h4>
                <button type="button" className="btn-outline" title="Recalcular impacto del pedido" onClick={() => recalcularPedido(selectedItem)}>
                  Recalcular producción
                </button>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
