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

const ROLE_MODULE_DEFAULTS = {
  admin: ["pedidos", "produccion", "domicilios", "catalogo", "usuarios", "inventario"],
  florista: ["produccion", "catalogo"],
  pedidos: ["pedidos", "catalogo"],
  domiciliario: ["domicilios"],
  inventarista: ["catalogo", "inventario"],
  operativo: ["pedidos", "produccion", "inventario"],
  otro: [],
};

function roleTypeLabel(roleName) {
  const normalized = String(roleName || "").trim().toLowerCase();
  const found = ROLE_TYPE_LABELS.find(item => item.pattern.test(normalized));
  return found?.label || "Otro";
}

function defaultModulesForRole(roleName) {
  const roleType = roleTypeLabel(roleName).toLowerCase();
  return ROLE_MODULE_DEFAULTS[roleType] || [];
}

export function UsersManagementPage({
  session,
  canViewUsuariosGlobal,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  onGoPipeline,
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
  const [editingUserId, setEditingUserId] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: "",
    login: "",
    email: "",
    password: "",
    rolID: "",
    sucursalID: "",
    estado: "Activo",
    modulosAcceso: [],
  });
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showEditModuleDropdown, setShowEditModuleDropdown] = useState(false);

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

  const modulosCompatiblesRol = useMemo(() => {
    const currentRole = visibleRoles.find(item => String(item.rolID) === String(form.rolID));
    const allowedByRole = defaultModulesForRole(currentRole?.nombreRol);
    if (allowedByRole.length === 0) return modulosActivosEmpresa;
    return modulosActivosEmpresa.filter(modulo => allowedByRole.includes(modulo));
  }, [visibleRoles, form.rolID, modulosActivosEmpresa]);

  const editModulosCompatiblesRol = useMemo(() => {
    const currentRole = visibleRoles.find(item => String(item.rolID) === String(editForm.rolID));
    const allowedByRole = defaultModulesForRole(currentRole?.nombreRol);
    if (allowedByRole.length === 0) return modulosActivosEmpresa;
    return modulosActivosEmpresa.filter(modulo => allowedByRole.includes(modulo));
  }, [visibleRoles, editForm.rolID, modulosActivosEmpresa]);

  const resetForm = useCallback(() => {
    setForm(current => ({
      ...current,
      nombre: "",
      login: "",
      email: "",
      password: "",
      estado: "Activo",
      modulosAcceso: modulosCompatiblesRol,
    }));
  }, [modulosCompatiblesRol]);

  const closeEditDrawer = useCallback(() => {
    setEditingUserId(null);
    setPasswordVisible(false);
    setShowEditDrawer(false);
    setShowEditModuleDropdown(false);
    setEditForm(current => ({
      ...current,
      nombre: "",
      login: "",
      email: "",
      password: "",
      estado: "Activo",
      modulosAcceso: [],
    }));
  }, []);

  const selectedUserModulesCount = (form.modulosAcceso || []).length;
  const selectedEditUserModulesCount = (editForm.modulosAcceso || []).length;

  const userModulesSummary = useMemo(() => {
    if (modulesLoading) return "Cargando modulos...";
    if (modulosActivosEmpresa.length === 0) return "Sin modulos activos";
    if (modulosCompatiblesRol.length === 0) return "Sin modulos compatibles";
    if (selectedUserModulesCount === 0) return "Selecciona modulos";
    if (selectedUserModulesCount === modulosCompatiblesRol.length) return "Todos los modulos compatibles";
    return `${selectedUserModulesCount} modulos seleccionados`;
  }, [modulesLoading, modulosActivosEmpresa.length, modulosCompatiblesRol.length, selectedUserModulesCount]);

  const editUserModulesSummary = useMemo(() => {
    if (modulesLoading) return "Cargando modulos...";
    if (modulosActivosEmpresa.length === 0) return "Sin modulos activos";
    if (editModulosCompatiblesRol.length === 0) return "Sin modulos compatibles";
    if (selectedEditUserModulesCount === 0) return "Selecciona modulos";
    if (selectedEditUserModulesCount === editModulosCompatiblesRol.length) return "Todos los modulos compatibles";
    return `${selectedEditUserModulesCount} modulos seleccionados`;
  }, [modulesLoading, modulosActivosEmpresa.length, editModulosCompatiblesRol.length, selectedEditUserModulesCount]);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

  const loadEmpresas = useCallback(async () => {
    if (!canViewUsuariosGlobal) {
      setEmpresas([
        {
          empresaID: Number(initialEmpresaID),
          nombre: session?.empresaNombre || `Empresa ${initialEmpresaID}`,
        },
      ]);
      setEmpresaID(Number(initialEmpresaID));
      return;
    }

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
  }, [api, empresaID, canViewUsuariosGlobal, initialEmpresaID, session?.empresaNombre]);

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
    setForm(current => {
      const currentModules = Array.isArray(current.modulosAcceso) ? current.modulosAcceso : [];
      const filtered = currentModules.filter(module => modulosCompatiblesRol.includes(String(module).toLowerCase()));
      const nextModules = filtered.length > 0 ? filtered : modulosCompatiblesRol;
      const sameLength = nextModules.length === currentModules.length;
      const sameValues = sameLength && nextModules.every((module, index) => module === currentModules[index]);
      if (sameValues) return current;
      return {
        ...current,
        modulosAcceso: nextModules,
      };
    });
  }, [modulosCompatiblesRol]);

  useEffect(() => {
    if (editingUserId == null) return;
    setEditForm(current => {
      const currentModules = Array.isArray(current.modulosAcceso) ? current.modulosAcceso : [];
      const filtered = currentModules.filter(module => editModulosCompatiblesRol.includes(String(module).toLowerCase()));
      const nextModules = filtered.length > 0 ? filtered : editModulosCompatiblesRol;
      const sameLength = nextModules.length === currentModules.length;
      const sameValues = sameLength && nextModules.every((module, index) => module === currentModules[index]);
      if (sameValues) return current;
      return {
        ...current,
        modulosAcceso: nextModules,
      };
    });
  }, [editingUserId, editModulosCompatiblesRol]);

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
    const nombre = String(form.nombre || "").trim();
    const login = String(form.login || "").trim().toLowerCase();
    const email = String(form.email || "").trim().toLowerCase();
    const password = String(form.password || "");
    const rolID = Number(form.rolID);
    const sucursalValue = Number(form.sucursalID);

    if (nombre.length < 3) {
      setError("El nombre debe tener al menos 3 caracteres.");
      return;
    }
    if (login.length < 3) {
      setError("El login debe tener al menos 3 caracteres.");
      return;
    }
    if (email.length < 3) {
      setError("El email es obligatorio.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!Number.isFinite(rolID) || rolID <= 0) {
      setError("Debes seleccionar un rol válido.");
      return;
    }
    if (!Number.isFinite(sucursalValue) || sucursalValue <= 0) {
      setError("Debes seleccionar una sucursal válida.");
      return;
    }
    if (modulosCompatiblesRol.length > 0 && (form.modulosAcceso || []).length === 0) {
      setError("Selecciona al menos un modulo de acceso para el usuario.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.crearUsuarioGestion({
        empresaID: Number(empresaID),
        nombre,
        login,
        email,
        password,
        rolID,
        sucursalID: sucursalValue,
        estado: form.estado,
        modulosAcceso: Array.isArray(form.modulosAcceso) ? form.modulosAcceso : [],
      });

      resetForm();

      await loadUsers();
      setInfo(`Usuario creado en ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error guardando usuario:", nextError);
      setError(nextError?.message || "No fue posible guardar usuario.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async event => {
    event.preventDefault();
    const nombre = String(editForm.nombre || "").trim();
    const login = String(editForm.login || "").trim().toLowerCase();
    const email = String(editForm.email || "").trim().toLowerCase();
    const password = String(editForm.password || "");
    const rolID = Number(editForm.rolID);
    const sucursalValue = Number(editForm.sucursalID);

    if (nombre.length < 3) {
      setError("El nombre debe tener al menos 3 caracteres.");
      return;
    }
    if (login.length < 3) {
      setError("El login debe tener al menos 3 caracteres.");
      return;
    }
    if (email.length < 3) {
      setError("El email es obligatorio.");
      return;
    }
    if (password.length > 0 && password.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!Number.isFinite(rolID) || rolID <= 0) {
      setError("Debes seleccionar un rol válido.");
      return;
    }
    if (!Number.isFinite(sucursalValue) || sucursalValue <= 0) {
      setError("Debes seleccionar una sucursal válida.");
      return;
    }
    if (editModulosCompatiblesRol.length > 0 && (editForm.modulosAcceso || []).length === 0) {
      setError("Selecciona al menos un modulo de acceso para el usuario.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.actualizarUsuarioGestion({
        userId: editingUserId,
        nombre,
        login,
        email,
        password,
        rolID,
        sucursalID: sucursalValue,
        estado: editForm.estado,
        modulosAcceso: Array.isArray(editForm.modulosAcceso) ? editForm.modulosAcceso : [],
      });
      closeEditDrawer();
      await loadUsers();
      setInfo("Usuario actualizado correctamente.");
    } catch (nextError) {
      console.error("Error actualizando usuario:", nextError);
      setError(nextError?.message || "No fue posible actualizar usuario.");
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

  const startEditUser = async item => {
    try {
      setError("");
      setInfo("");
      const detail = await api.obtenerUsuarioGestion({ userId: item.userID });
      setEditingUserId(item.userID);
      setPasswordVisible(false);
      setEditForm({
        nombre: detail.nombre || "",
        login: detail.login || "",
        email: detail.email || "",
        password: "",
        rolID: String(detail.rolID || ""),
        sucursalID: String(detail.sucursalID || ""),
        estado: detail.estado || "Activo",
        modulosAcceso: Array.isArray(detail.modulosAcceso) ? detail.modulosAcceso : [],
      });
      setShowUserModuleDropdown(false);
      setShowEditModuleDropdown(false);
      setShowEditDrawer(true);
    } catch (nextError) {
      console.error("Error cargando usuario:", nextError);
      setError(nextError?.message || "No fue posible cargar el usuario.");
    }
  };

  const deleteUser = async item => {
    const confirmed = globalThis.confirm(`¿Eliminar permanentemente a ${item.login}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      setError("");
      setInfo("");
      await api.eliminarUsuarioGestion({ userId: item.userID });
      if (editingUserId === item.userID) {
        closeEditDrawer();
      }
      await loadUsers();
      setInfo(`Usuario ${item.login} eliminado.`);
    } catch (nextError) {
      console.error("Error eliminando usuario:", nextError);
      setError(nextError?.message || "No fue posible eliminar el usuario.");
    }
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
      setInfo(`Modulos guardados para ${empresaSeleccionadaNombre}.`);
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
      setInfo(`El modulo '${normalized}' ya existe para esta empresa.`);
      return;
    }
    setModuleItems(current => ([...current, { modulo: normalized, activo: true }]));
    setNewModulo("");
    setInfo(`Modulo '${normalized}' agregado en borrador. Recuerda guardar.`);
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

  const toggleEditUserModuleAccess = modulo => {
    const normalized = String(modulo || "").trim().toLowerCase();
    if (!normalized) return;
    setEditForm(current => {
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
      setShowEditModuleDropdown(false);
    }
  }, [modulosActivosEmpresa.length]);

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Módulos">
          <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPipeline(); }}><span className="sidebar-nav-icon">▦</span><span className="sidebar-nav-text">Pipeline</span></button>
          {canViewPedidos ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPedidos(); }}><span className="sidebar-nav-icon">🧾</span><span className="sidebar-nav-text">Pedidos</span></button> : null}
          {canViewProduccion ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoProduccion(); }}><span className="sidebar-nav-icon">🏭</span><span className="sidebar-nav-text">Producción</span></button> : null}
          {canViewDomicilios ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoDomicilios(); }}><span className="sidebar-nav-icon">🛵</span><span className="sidebar-nav-text">Domicilios</span></button> : null}
          {canViewInventario ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoInventario(); }}><span className="sidebar-nav-icon">📦</span><span className="sidebar-nav-text">Inventario</span></button> : null}
          <button type="button" className="sidebar-nav-btn is-active" onClick={() => { setSidebarMobileOpen(false); onGoUsuarios(); }}><span className="sidebar-nav-icon">👥</span><span className="sidebar-nav-text">Gestión Usuarios</span></button>
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesión</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar}>{sidebarPinned ? "←" : "→"}</button>
        <p className="sidebar-caption">{canViewUsuariosGlobal ? "Consola global JOIN" : "Consola administración de empresa"}</p>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menu" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menú</button>
            <h1>Gestión de Usuarios</h1>
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
              <input
                type="password"
                placeholder="Contrasena"
                value={form.password}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                required
              />

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
              {!modulesLoading && modulosActivosEmpresa.length > 0 && modulosCompatiblesRol.length === 0 ? <p className="orders-admin-subtitle">El rol seleccionado no tiene modulos operativos compatibles.</p> : null}
              <button
                type="button"
                className={`users-module-dropdown-trigger ${showUserModuleDropdown ? "is-open" : ""}`}
                onClick={() => setShowUserModuleDropdown(current => !current)}
                disabled={modulesLoading || modulosCompatiblesRol.length === 0}
              >
                <span>{userModulesSummary}</span>
                <span aria-hidden="true">▾</span>
              </button>
                {showUserModuleDropdown && modulosCompatiblesRol.length > 0 ? (
                  <div className="users-module-dropdown-panel">
                    <div className="users-user-module-grid">
                      {modulosCompatiblesRol.map(modulo => {
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

              <button type="submit" className="btn-primary" disabled={saving || visibleRoles.length === 0 || (modulosCompatiblesRol.length > 0 && (form.modulosAcceso || []).length === 0)}>
                {saving ? "Guardando..." : "Crear usuario"}
              </button>
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
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="btn-outline" onClick={() => startEditUser(item)}>
                          Editar
                        </button>
                        <button type="button" className="btn-outline" onClick={() => toggleEstado(item)}>
                          {String(item.estado).toLowerCase() === "activo" ? "Inactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => deleteUser(item)}
                          disabled={Number(item.userID) === Number(session?.userID)}
                          title={Number(item.userID) === Number(session?.userID) ? "No puedes eliminar tu propio usuario" : "Eliminar usuario"}
                        >
                          Eliminar
                        </button>
                      </div>
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

      {showEditDrawer ? (
        <>
          <button
            type="button"
            aria-label="Cerrar edición de usuario"
            onClick={closeEditDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(64, 31, 52, 0.28)",
              border: "none",
              padding: 0,
              margin: 0,
              zIndex: 80,
              cursor: "pointer",
            }}
          />
          <section
            aria-label="Panel de edición de usuario"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(720px, calc(100vw - 24px))",
              maxHeight: "min(88vh, 920px)",
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(14px)",
              borderRadius: "28px",
              border: "1px solid rgba(206, 164, 183, 0.45)",
              boxShadow: "0 28px 80px rgba(110, 49, 77, 0.20)",
              zIndex: 81,
              overflowY: "auto",
              padding: "24px 20px 28px",
              display: "grid",
              alignContent: "start",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <p className="orders-admin-subtitle" style={{ marginBottom: 6 }}>Editar usuario</p>
                <h3 style={{ margin: 0 }}>#{editingUserId} {editForm.nombre || editForm.login || "Usuario"}</h3>
                <p className="orders-admin-subtitle" style={{ marginTop: 8 }}>Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
              </div>
              <button type="button" className="btn-outline" onClick={closeEditDrawer}>Cerrar</button>
            </div>

            <form className="users-create-form users-create-user-form" onSubmit={submitEdit}>
              <input type="text" placeholder="Nombre completo" value={editForm.nombre} onChange={event => setEditForm(current => ({ ...current, nombre: event.target.value }))} required />
              <input type="text" placeholder="Login unico" value={editForm.login} onChange={event => setEditForm(current => ({ ...current, login: event.target.value }))} required />
              <input type="email" placeholder="Email" value={editForm.email} onChange={event => setEditForm(current => ({ ...current, email: event.target.value }))} required />
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  type={passwordVisible ? "text" : "password"}
                  placeholder="Nueva contrasena (opcional)"
                  value={editForm.password}
                  onChange={event => setEditForm(current => ({ ...current, password: event.target.value }))}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button type="button" className="btn-outline" onClick={() => setPasswordVisible(current => !current)}>
                    {passwordVisible ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                  </button>
                  <span className="orders-admin-subtitle">La contraseña actual no se puede ver porque se guarda cifrada; aquí solo puedes escribir y revisar una nueva.</span>
                </div>
              </div>

              <label className="users-modulo-company-label" htmlFor="drawer-usuario-tipo-rol">Tipo de usuario (rol)</label>
              <select id="drawer-usuario-tipo-rol" value={editForm.rolID} onChange={event => setEditForm(current => ({ ...current, rolID: event.target.value }))} required>
                {visibleRoles.map(item => (
                  <option key={item.rolID} value={item.rolID}>{roleTypeLabel(item.nombreRol)} - {item.nombreRol}</option>
                ))}
              </select>

              <select value={editForm.sucursalID} onChange={event => setEditForm(current => ({ ...current, sucursalID: event.target.value }))} required>
                {sucursales.map(item => <option key={item.sucursalID} value={item.sucursalID}>Sucursal {item.sucursalID}</option>)}
              </select>

              <select value={editForm.estado} onChange={event => setEditForm(current => ({ ...current, estado: event.target.value }))}>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>

              <div className="users-user-module-picker">
                <p className="users-modulo-company-label">Modulos de acceso para este usuario</p>
                {modulesLoading ? <p className="orders-admin-subtitle">Cargando modulos disponibles...</p> : null}
                {!modulesLoading && modulosActivosEmpresa.length === 0 ? <p className="orders-admin-subtitle">No hay modulos activos para esta empresa.</p> : null}
                {!modulesLoading && modulosActivosEmpresa.length > 0 && editModulosCompatiblesRol.length === 0 ? <p className="orders-admin-subtitle">El rol seleccionado no tiene modulos operativos compatibles.</p> : null}
                {!modulesLoading && modulosActivosEmpresa.length > 0 && editModulosCompatiblesRol.length > 0 && editModulosCompatiblesRol.length !== modulosActivosEmpresa.length ? (
                  <p className="orders-admin-subtitle">Se muestran todos los modulos activos de la empresa. Los no compatibles con el rol quedan bloqueados.</p>
                ) : null}
                <button
                  type="button"
                  className={`users-module-dropdown-trigger ${showEditModuleDropdown ? "is-open" : ""}`}
                  onClick={() => setShowEditModuleDropdown(current => !current)}
                  disabled={modulesLoading || modulosActivosEmpresa.length === 0}
                >
                  <span>{editUserModulesSummary}</span>
                  <span aria-hidden="true">▾</span>
                </button>
                {showEditModuleDropdown && modulosActivosEmpresa.length > 0 ? (
                  <div className="users-module-dropdown-panel">
                    <div className="users-user-module-grid">
                      {modulosActivosEmpresa.map(modulo => {
                        const checked = (editForm.modulosAcceso || []).includes(modulo);
                        const compatible = editModulosCompatiblesRol.includes(modulo);
                        return (
                          <label
                            key={modulo}
                            className="users-user-module-item"
                            style={{
                              opacity: compatible ? 1 : 0.48,
                              cursor: compatible ? "pointer" : "not-allowed",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!compatible}
                              onChange={() => toggleEditUserModuleAccess(modulo)}
                            />
                            <span>{modulo}{compatible ? "" : " (no compatible con este rol)"}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="submit" className="btn-primary" disabled={saving || (editModulosCompatiblesRol.length > 0 && (editForm.modulosAcceso || []).length === 0)}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button type="button" className="btn-outline" onClick={closeEditDrawer}>
                  Cancelar edición
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}



