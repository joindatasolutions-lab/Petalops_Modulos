import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { formatDateOnly, formatTimeOnly } from "../../shared/utils.js";

const FILTROS = [
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Manana" },
  { value: "pendientes", label: "Pendientes" },
  { value: "enruta", label: "En ruta" },
  { value: "noentregado", label: "No entregado" },
];

const DELIVERY_VIEWS = [
  { value: "admin", label: "Vista Admin" },
  { value: "courier", label: "Vista Domiciliario" },
  { value: "barrios", label: "Barrios" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function stateBadgeClass(estado) {
  const key = String(estado || "").toLowerCase();
  if (key === "pendiente") return "is-pendiente";
  if (key === "asignado") return "is-entrega";
  if (key === "enruta") return "is-produccion";
  if (key === "entregado") return "is-entregado";
  if (key === "noentregado") return "is-rechazado";
  return "is-pendiente";
}

async function getCurrentCoords() {
  if (!globalThis.navigator?.geolocation) return null;
  return new Promise(resolve => {
    globalThis.navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

export function DeliveryPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onLogout,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoClientes,
  onGoUsuarios,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminItems, setAdminItems] = useState([]);
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [selectedDomiciliarioByEntrega, setSelectedDomiciliarioByEntrega] = useState({});
  const [filtro, setFiltro] = useState("hoy");
  const [fechaFiltro, setFechaFiltro] = useState(todayIso());

  const [modo, setModo] = useState("admin");
  const [domiciliarioId, setDomiciliarioId] = useState("");
  const [courierItems, setCourierItems] = useState([]);
  const [selectedDeliveryItem, setSelectedDeliveryItem] = useState(null);
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false);
  const [barriosItems, setBarriosItems] = useState([]);
  const [barrioForm, setBarrioForm] = useState({
    zonaID: "",
    nombreBarrio: "",
    costoDomicilio: "",
    activo: true,
  });
  const [barrioSaving, setBarrioSaving] = useState(false);
  const [editingBarrioId, setEditingBarrioId] = useState(null);
  const [barrioEditForm, setBarrioEditForm] = useState({
    nombreBarrio: "",
    costoDomicilio: "",
  });

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

  const loadDomiciliarios = useCallback(async () => {
    const data = await api.listarDomiciliarios({ empresaId, sucursalId, soloActivos: false });
    const rows = Array.isArray(data.items) ? data.items : [];
    setDomiciliarios(rows);
    if (!domiciliarioId && rows.length > 0) {
      setDomiciliarioId(String(rows[0].idDomiciliario));
    }
  }, [api, empresaId, sucursalId, domiciliarioId]);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarDomiciliosAdmin({
        empresaId,
        sucursalId,
        filtro,
        fecha: fechaFiltro,
      });
      setAdminItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando domicilios:", nextError);
      setAdminItems([]);
      setError("No fue posible cargar domicilios.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, sucursalId, filtro, fechaFiltro]);

  const loadCourier = useCallback(async () => {
    if (!domiciliarioId) {
      setCourierItems([]);
      return;
    }

    try {
      const data = await api.listarMisEntregasDomiciliario({
        empresaId,
        sucursalId,
        domiciliarioId: Number(domiciliarioId),
        fecha: fechaFiltro,
      });
      setCourierItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando mis entregas:", nextError);
      setCourierItems([]);
      setError("No fue posible cargar entregas del domiciliario.");
    }
  }, [api, empresaId, sucursalId, domiciliarioId, fechaFiltro]);

  const loadBarrios = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarBarriosDomicilios({ sucursalId });
      setBarriosItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando barrios:", nextError);
      setBarriosItems([]);
      setError(nextError?.detail || nextError?.message || "No fue posible cargar barrios.");
    } finally {
      setLoading(false);
    }
  }, [api, sucursalId]);

  useEffect(() => {
    loadDomiciliarios().catch(() => {});
  }, [loadDomiciliarios]);

  useEffect(() => {
    if (modo === "admin") {
      loadAdmin().catch(() => {});
    } else if (modo === "barrios") {
      loadBarrios().catch(() => {});
    } else {
      loadCourier().catch(() => {});
    }
  }, [modo, loadAdmin, loadBarrios, loadCourier]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const refreshAll = async () => {
    await loadDomiciliarios();
    if (modo === "admin") {
      await loadAdmin();
    } else if (modo === "barrios") {
      await loadBarrios();
    } else {
      await loadCourier();
    }
  };

  const onAsignar = async item => {
    const domiciliarioValue = selectedDomiciliarioByEntrega[item.idEntrega] || item.domiciliarioID || "";
    const usuarioCambio = String(session?.email || session?.nombre || "admin");
    try {
      await api.asignarDomiciliarioEntrega({
        entregaId: item.idEntrega,
        domiciliarioID: domiciliarioValue ? Number(domiciliarioValue) : null,
        usuarioCambio,
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error asignando domiciliario:", nextError);
      globalThis.alert("No fue posible asignar domiciliario.");
    }
  };

  const onEnRuta = async entregaId => {
    const usuarioCambio = String(session?.email || session?.nombre || "admin");
    try {
      await api.marcarEntregaEnRuta({ entregaId, usuarioCambio });
      await refreshAll();
    } catch (nextError) {
      console.error("Error marcando en ruta:", nextError);
      globalThis.alert("No fue posible marcar en ruta.");
    }
  };

  const onEntregado = async entregaId => {
    const usuarioCambio = String(session?.email || session?.nombre || "admin");
    const firmaNombre = String(globalThis.prompt("Nombre quien recibe", "") || "").trim();
    if (!firmaNombre) {
      globalThis.alert("Nombre de quien recibe es obligatorio.");
      return;
    }
    const firmaDocumento = String(globalThis.prompt("Documento quien recibe", "") || "").trim();
    if (!firmaDocumento) {
      globalThis.alert("Documento es obligatorio.");
      return;
    }
    const firmaImagenUrl = String(globalThis.prompt("Firma digital (base64 o URL)", "firma://canvas") || "").trim();
    if (!firmaImagenUrl) {
      globalThis.alert("Firma digital es obligatoria.");
      return;
    }
    const evidenciaFotoUrl = String(globalThis.prompt("Foto opcional (URL)", "") || "").trim() || null;

    const coords = await getCurrentCoords();
    let lat = coords?.lat;
    let lng = coords?.lng;

    if (lat == null || lng == null) {
      const latPrompt = Number(globalThis.prompt("Latitud", "4.710989"));
      const lngPrompt = Number(globalThis.prompt("Longitud", "-74.07209"));
      if (Number.isNaN(latPrompt) || Number.isNaN(lngPrompt)) {
        globalThis.alert("Coordenadas invalidas.");
        return;
      }
      lat = latPrompt;
      lng = lngPrompt;
    }

    try {
      await api.marcarEntregaEntregado({
        entregaId,
        usuarioCambio,
        firmaNombre,
        firmaDocumento,
        firmaImagenUrl,
        evidenciaFotoUrl,
        latitudEntrega: lat,
        longitudEntrega: lng,
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error marcando entregado:", nextError);
      globalThis.alert("No fue posible marcar entregado.");
    }
  };

  const onNoEntregado = async entregaId => {
    const usuarioCambio = String(session?.email || session?.nombre || "admin");
    const motivo = String(globalThis.prompt("Motivo de no entrega", "") || "").trim();
    if (!motivo) {
      globalThis.alert("Motivo es obligatorio.");
      return;
    }

    const reprogramar = String(globalThis.prompt("Reprogramar para (YYYY-MM-DD HH:mm) opcional", "") || "").trim();
    const reprogramarPara = reprogramar ? new Date(reprogramar.replace(" ", "T")).toISOString() : null;

    try {
      await api.marcarEntregaNoEntregado({
        entregaId,
        usuarioCambio,
        motivo,
        reprogramarPara,
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error marcando no entregado:", nextError);
      globalThis.alert("No fue posible marcar no entregado.");
    }
  };

  const openMaps = item => {
    const address = encodeURIComponent(`${item.direccion || ""} ${item.barrio || ""}`.trim());
    globalThis.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank", "noreferrer");
  };

  const openWhatsApp = item => {
    const phone = String(item.telefonoDestino || "").replace(/\+/g, "").trim();
    if (!phone) {
      globalThis.alert("Este pedido no tiene telefono.");
      return;
    }
    const msg = encodeURIComponent(item.mensaje || "Hola, vamos en camino con tu pedido.");
    globalThis.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noreferrer");
  };

  const openDeliveryDetail = item => {
    if (!item) return;
    setSelectedDeliveryItem(item);
    setDeliveryDrawerOpen(true);
  };

  const closeDeliveryDetail = () => {
    setDeliveryDrawerOpen(false);
    setSelectedDeliveryItem(null);
  };

  const onChangeBarrioForm = (field, value) => {
    setBarrioForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const onCrearBarrio = async () => {
    if (barrioSaving) return;
    setBarrioSaving(true);
    setError("");
    try {
      await api.crearBarrioDomicilios({
        sucursalID: sucursalId,
        zonaID: Number(barrioForm.zonaID || 0),
        nombreBarrio: barrioForm.nombreBarrio,
        costoDomicilio: Number(barrioForm.costoDomicilio || 0),
        activo: Boolean(barrioForm.activo),
      });
      setBarrioForm({
        zonaID: "",
        nombreBarrio: "",
        costoDomicilio: "",
        activo: true,
      });
      await loadBarrios();
    } catch (nextError) {
      console.error("Error creando barrio:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible crear el barrio.");
    } finally {
      setBarrioSaving(false);
    }
  };

  const onStartEditBarrio = item => {
    setEditingBarrioId(item?.idBarrio ?? null);
    setBarrioEditForm({
      nombreBarrio: String(item?.nombreBarrio || ""),
      costoDomicilio: String(item?.costoDomicilio ?? ""),
    });
    setError("");
  };

  const onCancelEditBarrio = () => {
    setEditingBarrioId(null);
    setBarrioEditForm({
      nombreBarrio: "",
      costoDomicilio: "",
    });
  };

  const onSaveEditBarrio = async barrioId => {
    if (barrioSaving) return;
    setBarrioSaving(true);
    setError("");
    try {
      await api.actualizarBarrioDomicilios({
        barrioId: Number(barrioId),
        sucursalID: sucursalId,
        nombreBarrio: String(barrioEditForm.nombreBarrio || "").trim(),
        costoDomicilio: Number(barrioEditForm.costoDomicilio || 0),
      });
      onCancelEditBarrio();
      await loadBarrios();
    } catch (nextError) {
      console.error("Error actualizando barrio:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar el barrio.");
    } finally {
      setBarrioSaving(false);
    }
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Módulos">
          {canViewPipeline ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPipeline(); }}>
              <span className="sidebar-nav-icon">▦</span>
              <span className="sidebar-nav-text">Pipeline</span>
            </button>
          ) : null}
          {canViewPedidos ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPedidos(); }}>
              <span className="sidebar-nav-icon">🧾</span>
              <span className="sidebar-nav-text">Pedidos</span>
            </button>
          ) : null}
          {canViewProduccion ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoProduccion(); }}>
              <span className="sidebar-nav-icon">🏭</span>
              <span className="sidebar-nav-text">Producción</span>
            </button>
          ) : null}
          {canViewDomicilios ? (
            <button type="button" className="sidebar-nav-btn is-active" onClick={() => { setSidebarMobileOpen(false); onGoDomicilios(); }}>
              <span className="sidebar-nav-icon">🛵</span>
              <span className="sidebar-nav-text">Domicilios</span>
            </button>
          ) : null}
          {canViewInventario ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoInventario(); }}>
              <span className="sidebar-nav-icon">📦</span>
              <span className="sidebar-nav-text">Inventario</span>
            </button>
          ) : null}
          {canViewClientesPanel ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoClientes(); }}>
              <span className="sidebar-nav-icon">💐</span>
              <span className="sidebar-nav-text">Clientes</span>
            </button>
          ) : null}
          {canViewUsuariosPanel ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoUsuarios(); }}>
              <span className="sidebar-nav-icon">👥</span>
              <span className="sidebar-nav-text">Gestión Usuarios</span>
            </button>
          ) : null}
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesión</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar}>{sidebarPinned ? "←" : "→"}</button>
        <p className="sidebar-caption">Última milla simple y trazable</p>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menú</button>
            <h1>Gestión de Domicilios</h1>
            <p className="orders-admin-subtitle">Desde ParaEntrega hasta Entregado, con evidencia y trazabilidad completa.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary" onClick={refreshAll}>Actualizar</button>
          </div>
        </header>

        <section className="inventory-header-tabs" aria-label="Submenu domicilios">
          {DELIVERY_VIEWS.map(item => (
            <button
              key={item.value}
              type="button"
              className={`btn-outline inventory-tab-btn ${modo === item.value ? "is-active" : ""}`}
              onClick={() => setModo(item.value)}
            >
              {item.label}
            </button>
          ))}
        </section>

        {modo !== "barrios" ? (
          <section className="orders-filters">
            <div className="filter-field">
              <span>Vista</span>
              <select value={filtro} onChange={event => setFiltro(event.target.value)}>
                {FILTROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <span>Fecha Inicio</span>
              <input type="date" value={fechaFiltro} onChange={event => setFechaFiltro(event.target.value)} />
            </div>
            <div className="filter-field">
              <span>Domiciliario</span>
              <select value={domiciliarioId} onChange={event => setDomiciliarioId(event.target.value)}>
                <option value="">Domiciliario...</option>
                {domiciliarios.map(item => <option key={item.idDomiciliario} value={item.idDomiciliario}>{item.nombre}</option>)}
              </select>
            </div>
            <div className="delivery-filter-hint">Modo: {modo === "admin" ? "Administrador" : "Domiciliario"}</div>
          </section>
        ) : null}

        {error ? <p className="orders-message">{error}</p> : null}
        {loading ? <p className="orders-message">Cargando domicilios...</p> : null}

        {modo === "admin" ? (
          <section className="orders-table-wrap">
            <table className="orders-table delivery-admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Direccion</th>
                  <th>Barrio</th>
                  <th>Hora entrega</th>
                  <th>Domiciliario</th>
                  <th>Estado</th>
                  <th>Tiempo restante</th>
                  <th>Prioridad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {adminItems.map(item => (
                  <tr key={item.idEntrega}>
                    <td data-label="Pedido">{item.numeroPedido}</td>
                    <td data-label="Cliente">{item.cliente || "-"}</td>
                    <td data-label="Direccion">{item.direccion || "-"}</td>
                    <td data-label="Barrio">{item.barrio || "-"}</td>
                    <td data-label="Hora entrega">{item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada) || "-"}</td>
                    <td data-label="Domiciliario">
                      <select
                        value={selectedDomiciliarioByEntrega[item.idEntrega] ?? (item.domiciliarioID || "")}
                        onChange={event => setSelectedDomiciliarioByEntrega(current => ({ ...current, [item.idEntrega]: event.target.value }))}
                      >
                        <option value="">Sin asignar</option>
                        {domiciliarios.map(dom => <option key={dom.idDomiciliario} value={dom.idDomiciliario}>{dom.nombre}</option>)}
                      </select>
                    </td>
                    <td data-label="Estado"><span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado}</span></td>
                    <td data-label="Tiempo restante">{typeof item.tiempoRestanteHoras === "number" ? `${item.tiempoRestanteHoras} h` : "-"}</td>
                    <td data-label="Prioridad">{item.prioridad || "MEDIA"}</td>
                    <td data-label="Acciones">
                      <div className="order-actions">
                        <button type="button" className="btn-outline" onClick={() => onAsignar(item)}>Asignar</button>
                        <button type="button" className="btn-outline" onClick={() => onEnRuta(item.idEntrega)}>EnRuta</button>
                        <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(item)}>Ver detalle</button>
                        <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Ver ubicacion</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : modo === "courier" ? (
          <section className="delivery-courier-cards">
            {courierItems.length === 0 ? (
              <p className="orders-message">No hay entregas asignadas para este domiciliario en la fecha seleccionada.</p>
            ) : courierItems.map(item => (
              <article key={item.idEntrega} className="delivery-courier-card">
                <div className="delivery-courier-head">
                  <strong>{item.destinatario || item.numeroPedido}</strong>
                  <span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado}</span>
                </div>

                <p className="delivery-address">{item.direccion || "Sin direccion"}</p>
                <p className="delivery-meta">
                  {item.barrio || ""}
                  {item.fechaEntregaProgramada ? ` · ${formatDateOnly(item.fechaEntregaProgramada) || "-"}` : ""}
                  {(item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada))
                    ? ` · ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
                    : ""}
                </p>

                <div className="delivery-courier-actions">
                  <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(item)}>Ver detalle</button>
                  <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Abrir en Maps</button>
                  <button type="button" className="btn-outline" onClick={() => openWhatsApp(item)}>Mensaje</button>
                </div>

                <div className="delivery-courier-actions">
                  <button type="button" className="btn-outline" onClick={() => onEnRuta(item.idEntrega)}>EnRuta</button>
                  <button type="button" className="btn-primary" onClick={() => onEntregado(item.idEntrega)}>Entregado</button>
                  <button type="button" className="btn-outline" onClick={() => onNoEntregado(item.idEntrega)}>NoEntregado</button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="delivery-barrios-layout">
            <article className="order-block users-top-panel delivery-barrios-form-panel">
              <h4>Crear barrio</h4>
              <div className="users-create-user-form">
                <label className="order-detail-edit-label">
                  Zona ID
                  <input
                    type="number"
                    min="0"
                    value={barrioForm.zonaID}
                    onChange={event => onChangeBarrioForm("zonaID", event.target.value)}
                    placeholder="Ej: 1"
                  />
                </label>
                <label className="order-detail-edit-label">
                  Nombre barrio
                  <input
                    type="text"
                    value={barrioForm.nombreBarrio}
                    onChange={event => onChangeBarrioForm("nombreBarrio", event.target.value)}
                    placeholder="Nombre del barrio"
                  />
                </label>
                <label className="order-detail-edit-label">
                  Costo domicilio
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={barrioForm.costoDomicilio}
                    onChange={event => onChangeBarrioForm("costoDomicilio", event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="order-detail-edit-label">
                  Activo
                  <select
                    value={barrioForm.activo ? "1" : "0"}
                    onChange={event => onChangeBarrioForm("activo", event.target.value === "1")}
                  >
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <button type="button" className="btn-primary" onClick={onCrearBarrio} disabled={barrioSaving}>
                  {barrioSaving ? "Guardando..." : "Crear barrio"}
                </button>
              </div>
            </article>

            <article className="order-block users-table-panel delivery-barrios-table-panel">
              <h4>Barrios registrados</h4>
              <div className="orders-table-wrap">
                <table className="orders-table delivery-admin-table">
                  <thead>
                    <tr>
                      <th>Zona ID</th>
                      <th>Nombre barrio</th>
                      <th>Costo domicilio</th>
                      <th>Activo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barriosItems.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No hay barrios cargados para esta sucursal.</td>
                      </tr>
                    ) : barriosItems.map(item => (
                      <tr key={item.idBarrio}>
                        <td>{item.zonaID ?? "-"}</td>
                        <td>
                          {editingBarrioId === item.idBarrio ? (
                            <input
                              type="text"
                              value={barrioEditForm.nombreBarrio}
                              onChange={event => setBarrioEditForm(current => ({ ...current, nombreBarrio: event.target.value }))}
                              placeholder="Nombre del barrio"
                            />
                          ) : (
                            item.nombreBarrio || "-"
                          )}
                        </td>
                        <td>
                          {editingBarrioId === item.idBarrio ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={barrioEditForm.costoDomicilio}
                              onChange={event => setBarrioEditForm(current => ({ ...current, costoDomicilio: event.target.value }))}
                              placeholder="0"
                            />
                          ) : (
                            Number(item.costoDomicilio || 0)
                          )}
                        </td>
                        <td>{item.activo ? "Sí" : "No"}</td>
                        <td>
                          <div className="order-actions">
                            {editingBarrioId === item.idBarrio ? (
                              <>
                                <button type="button" className="btn-primary" onClick={() => onSaveEditBarrio(item.idBarrio)} disabled={barrioSaving}>
                                  {barrioSaving ? "Guardando..." : "Guardar"}
                                </button>
                                <button type="button" className="btn-outline" onClick={onCancelEditBarrio} disabled={barrioSaving}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button type="button" className="btn-outline" onClick={() => onStartEditBarrio(item)}>
                                Editar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}
      </main>

      <aside className={`orders-drawer ${deliveryDrawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>Detalle Domicilio</strong>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeDeliveryDetail} title="Cerrar barra lateral">✕</button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!deliveryDrawerOpen || !selectedDeliveryItem ? (
            <p className="order-drawer-empty">Selecciona un pedido para ver detalle.</p>
          ) : (
            <section className="order-block">
              <h4>📦 Ver detalle</h4>
              <p><strong>Número del pedido:</strong> {selectedDeliveryItem.numeroPedido || "-"}</p>
              <p><strong>Cliente:</strong> {selectedDeliveryItem.cliente || selectedDeliveryItem.destinatario || "-"}</p>
              <p><strong>Destinatario:</strong> {selectedDeliveryItem.destinatario || "-"}</p>
              <p><strong>Dirección:</strong> {selectedDeliveryItem.direccion || "-"}</p>
              <p><strong>Barrio:</strong> {selectedDeliveryItem.barrio || "-"}</p>
              <p><strong>Fecha de entrega:</strong> {formatDateOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</p>
              <p><strong>Hora de entrega:</strong> {selectedDeliveryItem.horaEntrega || formatTimeOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</p>
              <p><strong>Estado:</strong> {selectedDeliveryItem.estado || "-"}</p>
              <p><strong>Domiciliario:</strong> {selectedDeliveryItem.domiciliario || "-"}</p>
              <p><strong>Teléfono:</strong> {selectedDeliveryItem.telefonoDestino || "-"}</p>
              <p><strong>Mensaje:</strong> {selectedDeliveryItem.mensaje || "-"}</p>
              <p><strong>Observación:</strong> {selectedDeliveryItem.observacion || "-"}</p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}


