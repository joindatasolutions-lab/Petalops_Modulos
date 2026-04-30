import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";

const initialForm = {
  tipoIdent: "CC",
  identificacion: "",
  indicativo: "+57",
  nombreCompleto: "",
  telefono: "",
  telefonoCompleto: "",
  email: "",
  fechaCumpleanos: "",
  fechaAniversario: "",
  activo: true,
};

function normalizePhoneComplete(indicativo, telefono) {
  const prefix = String(indicativo || "").trim();
  const number = String(telefono || "").trim();
  if (!prefix && !number) return "";
  if (!prefix) return number;
  if (!number) return prefix;
  return `${prefix}${number}`;
}

export function ClientsPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewContabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoContabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarClientes({ empresaId, q, soloActivos });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando clientes:", nextError);
      setItems([]);
      setError(nextError?.message || "No fue posible cargar clientes.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, q, soloActivos]);

  useEffect(() => {
    loadClientes().catch(() => {});
  }, [loadClientes]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const openCreate = () => {
    setEditingClienteId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
    setInfo("");
  };

  const openEdit = item => {
    setEditingClienteId(item.clienteID);
    setForm({
      tipoIdent: item.tipoIdent || "CC",
      identificacion: item.identificacion || "",
      indicativo: item.indicativo || "+57",
      nombreCompleto: item.nombreCompleto || "",
      telefono: item.telefono || "",
      telefonoCompleto: item.telefonoCompleto || "",
      email: item.email || "",
      fechaCumpleanos: item.fechaCumpleanos || "",
      fechaAniversario: item.fechaAniversario || "",
      activo: Boolean(item.activo),
    });
    setDrawerOpen(true);
    setError("");
    setInfo("");
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingClienteId(null);
    setForm(initialForm);
  };

  const onChangeForm = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const onSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        empresaID: empresaId,
        tipoIdent: String(form.tipoIdent || "").trim() || null,
        identificacion: String(form.identificacion || "").trim() || null,
        indicativo: String(form.indicativo || "").trim() || null,
        nombreCompleto: String(form.nombreCompleto || "").trim(),
        telefono: String(form.telefono || "").trim() || null,
        telefonoCompleto: normalizePhoneComplete(form.indicativo, form.telefono) || null,
        email: String(form.email || "").trim() || null,
        fechaCumpleanos: form.fechaCumpleanos || null,
        fechaAniversario: form.fechaAniversario || null,
        activo: Boolean(form.activo),
      };
      if (editingClienteId != null) {
        await api.actualizarCliente({ clienteId: editingClienteId, ...payload });
        setInfo("Cliente actualizado correctamente.");
      } else {
        await api.crearCliente(payload);
        setInfo("Cliente creado correctamente.");
      }
      closeDrawer();
      await loadClientes();
    } catch (nextError) {
      console.error("Error guardando cliente:", nextError);
      setError(nextError?.message || "No fue posible guardar el cliente.");
    } finally {
      setSaving(false);
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
          {canViewPipeline ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPipeline(); }}><span className="sidebar-nav-icon">▦</span><span className="sidebar-nav-text">Pipeline</span></button> : null}
          {canViewPedidos ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPedidos(); }}><span className="sidebar-nav-icon">🧾</span><span className="sidebar-nav-text">Pedidos</span></button> : null}
          {canViewProduccion ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoProduccion(); }}><span className="sidebar-nav-icon">🏭</span><span className="sidebar-nav-text">Producción</span></button> : null}
          {canViewDomicilios ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoDomicilios(); }}><span className="sidebar-nav-icon">🛵</span><span className="sidebar-nav-text">Domicilios</span></button> : null}
          {canViewInventario ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoInventario(); }}><span className="sidebar-nav-icon">📦</span><span className="sidebar-nav-text">Inventario</span></button> : null}
          {canViewClientesPanel ? <button type="button" className="sidebar-nav-btn is-active" onClick={() => { setSidebarMobileOpen(false); onGoClientes(); }}><span className="sidebar-nav-icon">💐</span><span className="sidebar-nav-text">Clientes</span></button> : null}
          {canViewUsuariosPanel ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoUsuarios(); }}><span className="sidebar-nav-icon">👥</span><span className="sidebar-nav-text">Gestión Usuarios</span></button> : null}
          {canViewContabilidad ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoContabilidad(); }}><span className="sidebar-nav-icon">📊</span><span className="sidebar-nav-text">Contabilidad</span></button> : null}
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesión</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar}>{sidebarPinned ? "←" : "→"}</button>
        <p className="sidebar-caption">Base de clientes y fechas especiales</p>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menú</button>
            <h1>Clientes</h1>
            <p className="orders-admin-subtitle">Consulta y mantenimiento de clientes con datos de contacto y fechas clave.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary" onClick={openCreate}>Agregar</button>
            <button type="button" className="btn-outline" onClick={() => loadClientes()}>Actualizar</button>
          </div>
        </header>

        <section className="orders-filters">
          <div className="filter-field filter-field--wide">
            <span>Búsqueda</span>
            <input
              type="text"
              placeholder="Buscar por nombre, documento, teléfono o email"
              value={q}
              onChange={event => setQ(event.target.value)}
            />
          </div>
          <button type="button" className={`btn-outline ${soloActivos ? "is-selected" : ""}`} onClick={() => setSoloActivos(current => !current)}>
            {soloActivos ? "Solo activos" : "Todos"}
          </button>
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}
        {loading ? <p className="orders-message">Cargando clientes...</p> : null}

        <section className="orders-table-wrap clients-table-wrap">
          <table className="orders-table users-table clients-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo Doc</th>
                <th>Documento</th>
                <th>Nombre</th>
                <th>Indicativo</th>
                <th>Teléfono</th>
                <th>Teléfono completo</th>
                <th>Email</th>
                <th>Cumpleaños</th>
                <th>Aniversario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12}>No hay clientes registrados.</td>
                </tr>
              ) : items.map(item => (
                <tr key={item.clienteID}>
                  <td data-label="ID">{item.clienteID}</td>
                  <td data-label="Tipo Doc">{item.tipoIdent || "-"}</td>
                  <td data-label="Documento">{item.identificacion || "-"}</td>
                  <td data-label="Nombre">{item.nombreCompleto || "-"}</td>
                  <td data-label="Indicativo">{item.indicativo || "-"}</td>
                  <td data-label="Teléfono">{item.telefono || "-"}</td>
                  <td data-label="Teléfono completo">{item.telefonoCompleto || "-"}</td>
                  <td data-label="Email">{item.email || "-"}</td>
                  <td data-label="Cumpleaños">{item.fechaCumpleanos || "-"}</td>
                  <td data-label="Aniversario">{item.fechaAniversario || "-"}</td>
                  <td data-label="Estado">
                    <span className={`order-badge ${item.activo ? "is-entregado" : "is-cancelado"}`}>
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <button type="button" className="btn-outline" onClick={() => openEdit(item)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>{editingClienteId != null ? "Editar cliente" : "Agregar cliente"}</strong>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeDrawer} title="Cerrar barra lateral">✕</button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!drawerOpen ? (
            <p className="order-drawer-empty">Usa Agregar o Editar para administrar clientes.</p>
          ) : (
            <form className="users-create-form" onSubmit={onSubmit}>
              <label className="order-detail-edit-label">
                Tipo documento
                <select value={form.tipoIdent} onChange={event => onChangeForm("tipoIdent", event.target.value)}>
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">CE</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </label>
              <label className="order-detail-edit-label">
                Documento
                <input type="text" value={form.identificacion} onChange={event => onChangeForm("identificacion", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Nombre completo
                <input type="text" value={form.nombreCompleto} onChange={event => onChangeForm("nombreCompleto", event.target.value)} required />
              </label>
              <label className="order-detail-edit-label">
                Indicativo
                <input type="text" value={form.indicativo} onChange={event => onChangeForm("indicativo", event.target.value)} placeholder="+57" />
              </label>
              <label className="order-detail-edit-label">
                Teléfono
                <input type="text" value={form.telefono} onChange={event => onChangeForm("telefono", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Email
                <input type="email" value={form.email} onChange={event => onChangeForm("email", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Fecha cumpleaños
                <input type="date" value={form.fechaCumpleanos} onChange={event => onChangeForm("fechaCumpleanos", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Fecha aniversario
                <input type="date" value={form.fechaAniversario} onChange={event => onChangeForm("fechaAniversario", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Estado
                <select value={form.activo ? "1" : "0"} onChange={event => onChangeForm("activo", event.target.value === "1")}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </label>
              <div className="order-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Guardando..." : editingClienteId != null ? "Editar" : "Agregar"}</button>
                <button type="button" className="btn-outline" onClick={closeDrawer} disabled={saving}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
