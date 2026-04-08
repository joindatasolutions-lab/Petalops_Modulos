import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";

const FILTROS = [
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Manana" },
  { value: "pendientes", label: "Pendientes" },
  { value: "enruta", label: "En ruta" },
  { value: "noentregado", label: "No entregado" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateTime(value) {
  if (!value) return "-";
  const text = String(value);
  if (text.includes("T")) {
    const [datePart, timePart = ""] = text.split("T");
    return `${datePart} ${timePart.slice(0, 5)}`.trim();
  }
  return text;
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
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewUsuariosPanel,
  onLogout,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
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

  useEffect(() => {
    loadDomiciliarios().catch(() => {});
  }, [loadDomiciliarios]);

  useEffect(() => {
    if (modo === "admin") {
      loadAdmin().catch(() => {});
    } else {
      loadCourier().catch(() => {});
    }
  }, [modo, loadAdmin, loadCourier]);

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

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Módulos">
          <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPipeline(); }}>
            <span className="sidebar-nav-icon">▦</span>
            <span className="sidebar-nav-text">Pipeline</span>
          </button>
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
            <h1>Módulo de Domicilios</h1>
            <p className="orders-admin-subtitle">Desde ParaEntrega hasta Entregado, con evidencia y trazabilidad completa.</p>
          </div>
          <div className="header-actions">
            <button type="button" className={`btn-outline ${modo === "admin" ? "is-selected" : ""}`} onClick={() => setModo("admin")}>Vista Admin</button>
            <button type="button" className={`btn-outline ${modo === "courier" ? "is-selected" : ""}`} onClick={() => setModo("courier")}>Vista Domiciliario</button>
            <button type="button" className="btn-primary" onClick={refreshAll}>Actualizar</button>
          </div>
        </header>

        <section className="orders-filters">
          <select value={filtro} onChange={event => setFiltro(event.target.value)}>
            {FILTROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input type="date" value={fechaFiltro} onChange={event => setFechaFiltro(event.target.value)} />
          <select value={domiciliarioId} onChange={event => setDomiciliarioId(event.target.value)}>
            <option value="">Domiciliario...</option>
            {domiciliarios.map(item => <option key={item.idDomiciliario} value={item.idDomiciliario}>{item.nombre}</option>)}
          </select>
          <div className="delivery-filter-hint">Modo: {modo === "admin" ? "Administrador" : "Domiciliario"}</div>
        </section>

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
                    <td data-label="Hora entrega">{item.horaEntrega || fmtDateTime(item.fechaEntregaProgramada)}</td>
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
                        <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Ver ubicacion</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
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
                <p className="delivery-meta">{item.barrio || ""} {item.horaEntrega ? `Â· ${item.horaEntrega}` : ""}</p>

                <div className="delivery-courier-actions">
                  <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Abrir en Maps</button>
                  <a className="btn-outline" href={`tel:${item.telefonoDestino || ""}`}>Llamar</a>
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
        )}
      </main>
    </div>
  );
}


