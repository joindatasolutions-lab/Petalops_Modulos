import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";

const MODULE_HELP = {
  pedidos: "Permite gestionar pedidos, aprobaciones y consulta operativa.",
  produccion: "Permite planificar y ejecutar la produccion de arreglos.",
  domicilios: "Permite asignar, enrutar y cerrar entregas con evidencia.",
  catalogo: "Permite consultar productos y referencias comerciales.",
  usuarios: "Permite acceso al panel de gestion de usuarios.",
};

const ROLE_TYPE_LABELS = [
  { pattern: /admin|administrador/, label: "Admin" },
  { pattern: /florista/, label: "Florista" },
  { pattern: /pedido|ventas|comercial/, label: "Pedidos" },
  { pattern: /domicili|repart/, label: "Domiciliario" },
  { pattern: /inventar|bodega|almacen/, label: "Inventarista" },
];

function roleTypeLabel(roleName) {
  const normalized = String(roleName || "").trim().toLowerCase();
  const found = ROLE_TYPE_LABELS.find(item => item.pattern.test(normalized));
  return found?.label || "Otro";
}

export function UsersManagementPage({
  session,
  canViewUsuariosGlobal,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const initialEmpresaID = Number(session?.empresaID || 1);
  const [empresaID, setEmpresaID] = useState(initialEmpresaID);
  const [sucursalID, setSucursalID] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [q, setQ] = useState("");

  const [items, setItems] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [moduleItems, setModuleItems] = useState([]);
  const [empresasModuloResumen, setEmpresasModuloResumen] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesSaving, setModulesSaving] = useState(false);
  const [empresasModulesLoading, setEmpresasModulesLoading] = useState(false);
  const [newModulo, setNewModulo] = useState("");
  const [showAdvancedModules, setShowAdvancedModules] = useState(false);
  const [showUserModuleDropdown, setShowUserModuleDropdown] = useState(false);

  const empresaSeleccionadaNombre = useMemo(() => {
    const found = empresas.find(item => Number(item.empresaID) === Number(empresaID));
    return found?.nombre || `Empresa ${empresaID}`;
  }, [empresas, empresaID]);

  const visibleRoles = useMemo(() => {
    const structuralRoles = new Set(["super_admin", "superadmin", "join_admin", "empresa_admin", "admin", "owner"]);
    if (canViewUsuariosGlobal) return roles;
    return roles.filter(item => {
      const normalized = String(item?.nombreRol || "").trim().toLowerCase().replace(/\s+/g, "_");
      return !structuralRoles.has(normalized);
    });
  }, [roles, canViewUsuariosGlobal]);

  const [form, setForm] = useState({
    nombre: "",
    login: "",
    email: "",
    password: "",
    rolID: "",
    sucursalID: "",
    estado: "Activo",
    modulosAcceso: [],
  });

  const modulosActivosEmpresa = useMemo(() => (
    moduleItems
      .filter(item => Boolean(item.activo))
      .map(item => String(item.modulo || "").trim().toLowerCase())
      .filter(Boolean)
  ), [moduleItems]);

  const selectedUserModulesCount = (form.modulosAcceso || []).length;

  const userModulesSummary = useMemo(() => {
    if (modulesLoading) return "Cargando modulos...";
    if (modulosActivosEmpresa.length === 0) return "Sin modulos activos";
    if (selectedUserModulesCount === 0) return "Selecciona modulos";
    if (selectedUserModulesCount === modulosActivosEmpresa.length) return "Todos los modulos activos";
    return `${selectedUserModulesCount} modulos seleccionados`;
  }, [modulesLoading, modulosActivosEmpresa.length, selectedUserModulesCount]);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

  const loadEmpresas = useCallback(async () => {
    const data = await api.listarEmpresasGestion();
    const next = Array.isArray(data.items) ? data.items : [];
    setEmpresas(next);
    if (next.length > 0) {
      if (!canViewUsuariosGlobal) {
        const inScope = next.some(item => Number(item.empresaID) === Number(initialEmpresaID));
        setEmpresaID(inScope ? Number(initialEmpresaID) : Number(next[0].empresaID));
        return;
      }
      const exists = next.some(item => Number(item.empresaID) === Number(empresaID));
      if (!exists) {
        setEmpresaID(Number(next[0].empresaID));
      }
    }
  }, [api, empresaID, canViewUsuariosGlobal, initialEmpresaID]);

  const loadCatalogos = useCallback(async () => {
    const [rolesData, sucData] = await Promise.all([
      api.listarRolesEmpresa({ empresaId: empresaID }),
      api.listarSucursalesEmpresa({ empresaId: empresaID }),
    ]);

    const nextRoles = Array.isArray(rolesData.items) ? rolesData.items : [];
    const nextSuc = Array.isArray(sucData.items) ? sucData.items : [];

    setRoles(nextRoles);
    setSucursales(nextSuc);

    if (!form.rolID && nextRoles.length > 0) {
      const allowed = canViewUsuariosGlobal
        ? nextRoles
        : nextRoles.filter(item => {
          const normalized = String(item?.nombreRol || "").trim().toLowerCase().replace(/\s+/g, "_");
          return !["super_admin", "superadmin", "join_admin", "empresa_admin", "admin", "owner"].includes(normalized);
        });
      if (allowed.length > 0) {
        setForm(current => ({ ...current, rolID: String(allowed[0].rolID) }));
      }
    }
    if (!form.sucursalID && nextSuc.length > 0) {
      const first = String(nextSuc[0].sucursalID);
      setForm(current => ({ ...current, sucursalID: first }));
      if (!sucursalID) setSucursalID(first);
    }
  }, [api, empresaID, form.rolID, form.sucursalID, sucursalID, canViewUsuariosGlobal]);

  useEffect(() => {
    if (canViewUsuariosGlobal) return;
    setEmpresaID(initialEmpresaID);
  }, [canViewUsuariosGlobal, initialEmpresaID]);

  useEffect(() => {
    if (visibleRoles.length === 0) return;
    const exists = visibleRoles.some(item => String(item.rolID) === String(form.rolID));
    if (!exists) {
      setForm(current => ({ ...current, rolID: String(visibleRoles[0].rolID) }));
    }
  }, [visibleRoles, form.rolID]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarUsuariosGestion({
        empresaId: empresaID,
        sucursalId: sucursalID ? Number(sucursalID) : null,
        estado: estadoFiltro || null,
        q: q || null,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error listando usuarios:", nextError);
      setItems([]);
      setError("No fue posible cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaID, sucursalID, estadoFiltro, q]);

  const loadModules = useCallback(async () => {
    setModulesLoading(true);
    setError("");
    try {
      const data = await api.listarModulosEmpresaGestion({ empresaId: empresaID });
      const nextItems = Array.isArray(data.items) ? data.items : [];
      const activeModules = nextItems
        .filter(item => Boolean(item?.activo))
        .map(item => String(item.modulo || "").trim().toLowerCase())
        .filter(Boolean);

      setModuleItems(nextItems);
      setForm(current => {
        const currentModules = Array.isArray(current.modulosAcceso) ? current.modulosAcceso : [];
        const filtered = currentModules.filter(module => activeModules.includes(String(module).toLowerCase()));
        return {
          ...current,
          modulosAcceso: filtered.length > 0 ? filtered : activeModules,
        };
      });
    } catch (nextError) {
      console.error("Error cargando modulos empresa:", nextError);
      setModuleItems([]);
      setError(nextError?.message || "No fue posible cargar configuracion de modulos.");
    } finally {
      setModulesLoading(false);
    }
  }, [api, empresaID]);

  const loadEmpresasModuloResumen = useCallback(async () => {
    if (!canViewUsuariosGlobal) return;
    setEmpresasModulesLoading(true);
    try {
      const data = await api.listarEmpresasModulosGestion();
      setEmpresasModuloResumen(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando resumen de modulos por empresa:", nextError);
      setEmpresasModuloResumen([]);
    } finally {
      setEmpresasModulesLoading(false);
    }
  }, [api, canViewUsuariosGlobal]);

  useEffect(() => {
    loadEmpresas().catch(() => {});
  }, [loadEmpresas]);

  useEffect(() => {
    loadCatalogos().catch(() => {});
  }, [loadCatalogos]);

  useEffect(() => {
    loadUsers().catch(() => {});
  }, [loadUsers]);

  useEffect(() => {
    loadModules().catch(() => {});
  }, [loadModules]);

  useEffect(() => {
    loadEmpresasModuloResumen().catch(() => {});
  }, [loadEmpresasModuloResumen]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const submitCreate = async event => {
    event.preventDefault();
    if (modulosActivosEmpresa.length > 0 && (form.modulosAcceso || []).length === 0) {
      setError("Selecciona al menos un modulo de acceso para el usuario.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.crearUsuarioGestion({
        empresaID: Number(empresaID),
        nombre: String(form.nombre || "").trim(),
        login: String(form.login || "").trim().toLowerCase(),
        email: String(form.email || "").trim().toLowerCase(),
        password: String(form.password || ""),
        rolID: Number(form.rolID),
        sucursalID: Number(form.sucursalID),
        estado: form.estado,
        modulosAcceso: Array.isArray(form.modulosAcceso) ? form.modulosAcceso : [],
      });

      setForm(current => ({
        ...current,
        nombre: "",
        login: "",
        email: "",
        password: "",
        modulosAcceso: modulosActivosEmpresa,
      }));

      await loadUsers();
      setInfo(`Usuario creado en ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error creando usuario:", nextError);
      setError(nextError?.message || "No fue posible crear usuario.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEstado = async item => {
    const nextEstado = String(item.estado || "").toLowerCase() === "activo" ? "Inactivo" : "Activo";
    try {
      setInfo("");
      await api.actualizarEstadoUsuario({ userId: item.userID, estado: nextEstado });
      await loadUsers();
      setInfo(`Estado actualizado para ${item.nombre}.`);
    } catch (nextError) {
      console.error("Error actualizando estado:", nextError);
      setError(nextError?.message || "No fue posible actualizar estado.");
    }
  };

  const toggleModule = modulo => {
    setModuleItems(current => current.map(item => (
      item.modulo === modulo ? { ...item, activo: !item.activo } : item
    )));
  };

  const saveModules = async () => {
    if (!canViewUsuariosGlobal) return;
    setModulesSaving(true);
    setError("");
    setInfo("");
    try {
      await api.actualizarModulosEmpresaGestion({
        empresaID: Number(empresaID),
        items: moduleItems.map(item => ({ modulo: item.modulo, activo: Boolean(item.activo) })),
      });
      await loadModules();
      await loadEmpresasModuloResumen();
      setInfo(`Módulos guardados para ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error guardando modulos empresa:", nextError);
      setError(nextError?.message || "No fue posible guardar configuracion de modulos.");
    } finally {
      setModulesSaving(false);
    }
  };

  const addModulo = () => {
    const normalized = String(newModulo || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!normalized) return;
    const exists = moduleItems.some(item => String(item.modulo).toLowerCase() === normalized);
    if (exists) {
      setNewModulo("");
      setInfo(`El módulo '${normalized}' ya existe para esta empresa.`);
      return;
    }
    setModuleItems(current => ([...current, { modulo: normalized, activo: true }]));
    setNewModulo("");
    setInfo(`Módulo '${normalized}' agregado en borrador. Recuerda guardar.`);
  };

  const toggleUserModuleAccess = modulo => {
    const normalized = String(modulo || "").trim().toLowerCase();
    if (!normalized) return;
    setForm(current => {
      const currentModules = Array.isArray(current.modulosAcceso) ? current.modulosAcceso : [];
      const exists = currentModules.includes(normalized);
      return {
        ...current,
        modulosAcceso: exists
          ? currentModules.filter(item => item !== normalized)
          : [...currentModules, normalized],
      };
    });
  };

  useEffect(() => {
    if (modulosActivosEmpresa.length === 0) {
      setShowUserModuleDropdown(false);
    }
  }, [modulosActivosEmpresa.length]);

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/PetalOps.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/PetalOps%20Logo.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Modulos">
          {canViewPedidos ? <button type="button" className="sidebar-nav-btn" onClick={onGoPedidos}><span className="sidebar-nav-icon">🧾</span><span className="sidebar-nav-text">Pedidos</span></button> : null}
          {canViewProduccion ? <button type="button" className="sidebar-nav-btn" onClick={onGoProduccion}><span className="sidebar-nav-icon">🏭</span><span className="sidebar-nav-text">Produccion</span></button> : null}
          {canViewDomicilios ? <button type="button" className="sidebar-nav-btn" onClick={onGoDomicilios}><span className="sidebar-nav-icon">🛵</span><span className="sidebar-nav-text">Domicilios</span></button> : null}
          {canViewInventario ? <button type="button" className="sidebar-nav-btn" onClick={onGoInventario}><span className="sidebar-nav-icon">📦</span><span className="sidebar-nav-text">Inventario</span></button> : null}
          <button type="button" className="sidebar-nav-btn is-active" onClick={onGoUsuarios}><span className="sidebar-nav-icon">👥</span><span className="sidebar-nav-text">Gestion Usuarios</span></button>
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesion">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesion</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar}>{sidebarPinned ? "←" : "→"}</button>
        <p className="sidebar-caption">{canViewUsuariosGlobal ? "Consola global JOIN" : "Consola administracion de empresa"}</p>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menu" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menu</button>
            <h1>Gestion de Usuarios</h1>
            <p className="orders-admin-subtitle">
              {canViewUsuariosGlobal
                ? "Control global de administradores, usuarios operativos, domiciliarios y floristas."
                : "Control de usuarios operativos para tu empresa y sus sucursales."}
            </p>
          </div>
        </header>

        <section className="orders-filters users-filters">
          {canViewUsuariosGlobal ? (
            <select value={empresaID} onChange={event => setEmpresaID(Number(event.target.value))}>
              {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.nombre}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={empresaSeleccionadaNombre}
              readOnly
              title="Tu alcance esta limitado a tu empresa"
            />
          )}
          <select value={sucursalID} onChange={event => setSucursalID(event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(item => <option key={item.sucursalID} value={item.sucursalID}>Sucursal {item.sucursalID}</option>)}
          </select>
          <select value={estadoFiltro} onChange={event => setEstadoFiltro(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
          <input type="text" placeholder="Buscar por nombre, login o email" value={q} onChange={event => setQ(event.target.value)} />
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}
        {loading ? <p className="orders-message">Cargando usuarios...</p> : null}

        <section className="users-grid-layout">
          <article className="order-block users-create-block users-top-panel">
            <h4>Crear usuario</h4>
            <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
            {canViewUsuariosGlobal ? <p className="orders-admin-subtitle">Nota: esta pantalla crea usuarios, no empresas nuevas.</p> : null}
            <form className="users-create-form users-create-user-form" onSubmit={submitCreate}>
              <input type="text" placeholder="Nombre completo" value={form.nombre} onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))} required />
              <input type="text" placeholder="Login unico" value={form.login} onChange={event => setForm(current => ({ ...current, login: event.target.value }))} required />
              <input type="email" placeholder="Email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
              <input type="password" placeholder="Contrasena" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} required />

              <label className="users-modulo-company-label" htmlFor="usuario-tipo-rol">Tipo de usuario (rol)</label>
              <select id="usuario-tipo-rol" value={form.rolID} onChange={event => setForm(current => ({ ...current, rolID: event.target.value }))} required>
                {visibleRoles.map(item => (
                  <option key={item.rolID} value={item.rolID}>{roleTypeLabel(item.nombreRol)} - {item.nombreRol}</option>
                ))}
              </select>

              {!canViewUsuariosGlobal && visibleRoles.length === 0 ? (
                <p className="orders-message">No hay roles operativos disponibles para asignar en tu empresa.</p>
              ) : null}

              <select value={form.sucursalID} onChange={event => setForm(current => ({ ...current, sucursalID: event.target.value }))} required>
                {sucursales.map(item => <option key={item.sucursalID} value={item.sucursalID}>Sucursal {item.sucursalID}</option>)}
              </select>

              <select value={form.estado} onChange={event => setForm(current => ({ ...current, estado: event.target.value }))}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>

              <div className="users-user-module-picker">
                <p className="users-modulo-company-label">Modulos de acceso para este usuario</p>
                {modulesLoading ? <p className="orders-admin-subtitle">Cargando modulos disponibles...</p> : null}
                {!modulesLoading && modulosActivosEmpresa.length === 0 ? <p className="orders-admin-subtitle">No hay modulos activos para esta empresa.</p> : null}
                <button
                  type="button"
                  className={`users-module-dropdown-trigger ${showUserModuleDropdown ? "is-open" : ""}`}
                  onClick={() => setShowUserModuleDropdown(current => !current)}
                  disabled={modulesLoading || modulosActivosEmpresa.length === 0}
                >
                  <span>{userModulesSummary}</span>
                  <span aria-hidden="true">▾</span>
                </button>
                {showUserModuleDropdown && modulosActivosEmpresa.length > 0 ? (
                  <div className="users-module-dropdown-panel">
                    <div className="users-user-module-grid">
                      {modulosActivosEmpresa.map(modulo => {
                        const checked = (form.modulosAcceso || []).includes(modulo);
                        return (
                          <label key={modulo} className="users-user-module-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUserModuleAccess(modulo)}
                            />
                            <span>{modulo}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <button type="submit" className="btn-primary" disabled={saving || visibleRoles.length === 0 || (modulosActivosEmpresa.length > 0 && (form.modulosAcceso || []).length === 0)}>{saving ? "Guardando..." : "Crear usuario"}</button>
            </form>
          </article>

          {canViewUsuariosGlobal ? (
            <article className="order-block users-create-block users-top-panel">
              <h4>Habilitacion comercial de modulos</h4>
              <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
              <p className="orders-admin-subtitle">Activa o desactiva modulos segun lo contratado para esta empresa.</p>

              <div className="users-create-form users-modulos-form" style={{ gap: 10 }}>
                <label className="users-modulo-company-label" htmlFor="empresa-modulos-target">Empresa a configurar</label>
                <select
                  id="empresa-modulos-target"
                  value={empresaID}
                  onChange={event => setEmpresaID(Number(event.target.value))}
                >
                  {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.nombre}</option>)}
                </select>
              </div>

              {modulesLoading ? <p className="orders-message">Cargando modulos...</p> : null}
              {!modulesLoading && moduleItems.length === 0 ? <p className="orders-message">No hay modulos configurables.</p> : null}
              <div className="users-create-form users-modulos-form" style={{ gap: 10 }}>
                {moduleItems.map(item => (
                  <div key={item.modulo} className="users-modulo-item">
                    <div className="users-modulo-head">
                      <div>
                        <strong>{item.modulo}</strong>
                        <p className="users-modulo-help">{MODULE_HELP[item.modulo] || "Modulo personalizado para habilitacion comercial."}</p>
                      </div>
                      <label className="users-switch" title={`Activar o desactivar ${item.modulo}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.activo)}
                          onChange={() => toggleModule(item.modulo)}
                        />
                        <span className="users-switch-slider" />
                      </label>
                    </div>
                  </div>
                ))}

                <button type="button" className="btn-outline" onClick={() => setShowAdvancedModules(current => !current)}>
                  {showAdvancedModules ? "Ocultar configuracion avanzada" : "Mostrar configuracion avanzada"}
                </button>

                {showAdvancedModules ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Nuevo modulo (ej: marketing)"
                      value={newModulo}
                      onChange={event => setNewModulo(event.target.value)}
                    />
                    <button type="button" className="btn-outline" onClick={addModulo}>Adicionar</button>
                  </div>
                ) : null}

                <button type="button" className="btn-primary" onClick={saveModules} disabled={modulesSaving || modulesLoading || moduleItems.length === 0}>
                  {modulesSaving ? "Guardando..." : `Guardar modulos en ${empresaSeleccionadaNombre}`}
                </button>
              </div>
            </article>
          ) : null}

          <article className="orders-table-wrap users-table-wrap users-table-panel">
            <table className="orders-table users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  {canViewUsuariosGlobal ? <th>Empresa</th> : null}
                  <th>Sucursal</th>
                  <th>Nombre</th>
                  <th>Login</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.userID}>
                    <td data-label="ID">{item.userID}</td>
                    {canViewUsuariosGlobal ? <td data-label="Empresa">{item.empresaID}</td> : null}
                    <td data-label="Sucursal">{item.sucursalID}</td>
                    <td data-label="Nombre">{item.nombre}</td>
                    <td data-label="Login">{item.login}</td>
                    <td data-label="Email">{item.email}</td>
                    <td data-label="Rol">{item.rol}</td>
                    <td data-label="Estado"><span className={`order-badge ${String(item.estado).toLowerCase() === "activo" ? "is-entregado" : "is-rechazado"}`}>{item.estado}</span></td>
                    <td data-label="Accion">
                      <button type="button" className="btn-outline" onClick={() => toggleEstado(item)}>
                        {String(item.estado).toLowerCase() === "activo" ? "Inactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          {canViewUsuariosGlobal ? (
            <article className="orders-table-wrap users-table-wrap users-table-panel">
              <table className="orders-table users-table users-company-modules-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Modulos Activos</th>
                    <th>Modulos Inactivos</th>
                  </tr>
                </thead>
                <tbody>
                  {empresasModulesLoading ? (
                    <tr>
                      <td colSpan={5}>Cargando resumen de modulos...</td>
                    </tr>
                  ) : empresasModuloResumen.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No hay empresas para mostrar.</td>
                    </tr>
                  ) : empresasModuloResumen.map(item => {
                    const active = (item.items || []).filter(module => Boolean(module.activo)).map(module => module.modulo);
                    const inactive = (item.items || []).filter(module => !Boolean(module.activo)).map(module => module.modulo);
                    return (
                      <tr key={item.empresaID}>
                        <td data-label="Empresa">{item.nombre} (ID {item.empresaID})</td>
                        <td data-label="Plan">{item.planID != null ? item.planID : "-"}</td>
                        <td data-label="Estado">{item.estado || "-"}</td>
                        <td data-label="Modulos Activos">
                          <div className="users-module-chip-wrap">
                            {active.length === 0 ? <span className="users-module-chip is-inactive">Ninguno</span> : active.map(module => <span key={`${item.empresaID}-a-${module}`} className="users-module-chip is-active">{module}</span>)}
                          </div>
                        </td>
                        <td data-label="Modulos Inactivos">
                          <div className="users-module-chip-wrap">
                            {inactive.length === 0 ? <span className="users-module-chip is-active">Ninguno</span> : inactive.map(module => <span key={`${item.empresaID}-i-${module}`} className="users-module-chip is-inactive">{module}</span>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          ) : null}
        </section>
      </main>
    </div>
  );
}
