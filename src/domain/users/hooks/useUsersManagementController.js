import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../../config/tenantConfig.js";
import { createApiClient } from "../../../infrastructure/apiClient.js";
import { useSidebarState } from "../../../shared/useSidebarState.js";
import {
  UserFormModel,
  filterVisibleRoles,
  normalizeModuleKey,
  selectedModulesSummary,
  sameStringList,
  syncSelectedModules,
} from "../usersDomain.js";

export function useUsersManagementController({ session, canViewUsuariosGlobal }) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const sidebar = useSidebarState();
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

  const initialEmpresaID = Number(session?.empresaID || 1);
  const [empresaID, setEmpresaID] = useState(initialEmpresaID);
  const [sucursalID, setSucursalID] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [q, setQ] = useState("");
  const [activePanel, setActivePanel] = useState(canViewUsuariosGlobal ? "tenants" : "usuarios");
  const [showTenantCreatePanel, setShowTenantCreatePanel] = useState(false);

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [editForm, setEditForm] = useState(UserFormModel.initial());
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showEditModuleDropdown, setShowEditModuleDropdown] = useState(false);
  const [form, setForm] = useState(UserFormModel.initial());
  const [tenantForm, setTenantForm] = useState({
    nombreComercial: "",
    slug: "",
    planID: "1",
    estado: "Activo",
    sucursalNombre: "",
    adminLogin: "",
    adminPassword: "",
    adminEmail: "",
  });

  const empresaSeleccionadaNombre = useMemo(() => {
    const found = empresas.find(item => Number(item.empresaID) === Number(empresaID));
    return found?.nombre || `Empresa ${empresaID}`;
  }, [empresas, empresaID]);

  const visibleRoles = useMemo(() => filterVisibleRoles(roles, canViewUsuariosGlobal), [roles, canViewUsuariosGlobal]);

  const modulosActivosEmpresa = useMemo(() => (
    moduleItems
      .filter(item => Boolean(item.activo))
      .map(item => normalizeModuleKey(item.modulo))
      .filter(Boolean)
  ), [moduleItems]);

  const modulosConfiguradosEmpresa = useMemo(() => (
    moduleItems
      .map(item => normalizeModuleKey(item.modulo))
      .filter(Boolean)
  ), [moduleItems]);

  const modulosCompatiblesRol = modulosActivosEmpresa;
  const editModulosCompatiblesRol = modulosActivosEmpresa;

  const allUserRoleModulesSelected = modulosCompatiblesRol.length > 0
    && modulosCompatiblesRol.every(modulo => (form.modulosAcceso || []).includes(modulo));
  const allEditRoleModulesSelected = editModulosCompatiblesRol.length > 0
    && editModulosCompatiblesRol.every(modulo => (editForm.modulosAcceso || []).includes(modulo));

  const resetForm = useCallback(() => {
    setForm(current => UserFormModel.initial({
      ...current,
      rolID: current.rolID,
      sucursalID: current.sucursalID,
      modulosAcceso: modulosCompatiblesRol,
    }));
  }, [modulosCompatiblesRol]);

  const closeEditDrawer = useCallback(() => {
    setEditingUserId(null);
    setPasswordVisible(false);
    setShowEditDrawer(false);
    setShowEditModuleDropdown(false);
    setEditForm(current => UserFormModel.initial({
      rolID: current.rolID,
      sucursalID: current.sucursalID,
    }));
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setShowUserModuleDropdown(false);
  }, []);

  const selectedUserModulesCount = (form.modulosAcceso || []).length;
  const selectedEditUserModulesCount = (editForm.modulosAcceso || []).length;

  const userModulesSummary = useMemo(() => selectedModulesSummary({
    loading: modulesLoading,
    activeModulesCount: modulosActivosEmpresa.length,
    compatibleModulesCount: modulosCompatiblesRol.length,
    selectedCount: selectedUserModulesCount,
    hasRole: Boolean(form.rolID),
  }), [modulesLoading, modulosActivosEmpresa.length, modulosCompatiblesRol.length, selectedUserModulesCount, form.rolID]);

  const editUserModulesSummary = useMemo(() => selectedModulesSummary({
    loading: modulesLoading,
    activeModulesCount: modulosActivosEmpresa.length,
    compatibleModulesCount: editModulosCompatiblesRol.length,
    selectedCount: selectedEditUserModulesCount,
    hasRole: Boolean(editForm.rolID),
  }), [modulesLoading, modulosActivosEmpresa.length, editModulosCompatiblesRol.length, selectedEditUserModulesCount, editForm.rolID]);

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
      const exists = next.some(item => Number(item.empresaID) === Number(empresaID));
      if (!exists) setEmpresaID(Number(next[0].empresaID));
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
      const allowed = filterVisibleRoles(nextRoles, canViewUsuariosGlobal);
      if (allowed.length > 0) setForm(current => ({ ...current, rolID: String(allowed[0].rolID) }));
    }
    if (!form.sucursalID && nextSuc.length > 0) {
      const first = String(nextSuc[0].sucursalID);
      setForm(current => ({ ...current, sucursalID: first }));
      if (!sucursalID) setSucursalID(first);
    }
  }, [api, empresaID, form.rolID, form.sucursalID, sucursalID, canViewUsuariosGlobal]);

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
        .map(item => normalizeModuleKey(item.modulo))
        .filter(Boolean);

      setModuleItems(nextItems);
      setForm(current => {
        const currentModules = Array.isArray(current.modulosAcceso) ? current.modulosAcceso : [];
        const filtered = currentModules.filter(module => activeModules.includes(normalizeModuleKey(module)));
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
    if (canViewUsuariosGlobal) return;
    setEmpresaID(initialEmpresaID);
  }, [canViewUsuariosGlobal, initialEmpresaID]);

  useEffect(() => {
    if (visibleRoles.length === 0) return;
    const exists = visibleRoles.some(item => String(item.rolID) === String(form.rolID));
    if (!exists) setForm(current => ({ ...current, rolID: String(visibleRoles[0].rolID) }));
  }, [visibleRoles, form.rolID]);

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
      const nextModules = syncSelectedModules(currentModules, modulosCompatiblesRol, modulosActivosEmpresa);
      if (sameStringList(nextModules, currentModules)) return current;
      return { ...current, modulosAcceso: nextModules };
    });
  }, [modulosActivosEmpresa, modulosCompatiblesRol]);

  useEffect(() => {
    if (editingUserId == null) return;
    setEditForm(current => {
      const currentModules = Array.isArray(current.modulosAcceso) ? current.modulosAcceso : [];
      const nextModules = syncSelectedModules(currentModules, editModulosCompatiblesRol, modulosActivosEmpresa);
      if (sameStringList(nextModules, currentModules)) return current;
      return { ...current, modulosAcceso: nextModules };
    });
  }, [editingUserId, modulosActivosEmpresa, editModulosCompatiblesRol]);

  useEffect(() => {
    loadEmpresasModuloResumen().catch(() => {});
  }, [loadEmpresasModuloResumen]);

  useEffect(() => {
    if (modulosActivosEmpresa.length === 0) {
      setShowUserModuleDropdown(false);
      setShowEditModuleDropdown(false);
    }
  }, [modulosActivosEmpresa.length]);

  useEffect(() => {
    if (!showCreateModal) return undefined;
    const onKeyDown = event => {
      if (event.key === "Escape") closeCreateModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeCreateModal, showCreateModal]);


  const submitCreateTenant = async event => {
    event.preventDefault();
    if (!canViewUsuariosGlobal) return;
    const nombreComercial = String(tenantForm.nombreComercial || "").trim();
    const adminLogin = String(tenantForm.adminLogin || "").trim().toLowerCase();
    const adminPassword = String(tenantForm.adminPassword || "");
    if (nombreComercial.length < 3) {
      setError("El nombre comercial del tenant debe tener al menos 3 caracteres.");
      return;
    }
    if (adminLogin.length < 3 || adminPassword.length < 6) {
      setError("Define un login y una contrasena inicial valida para el admin del tenant.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const response = await api.crearEmpresaGestion({
        nombreComercial,
        slug: tenantForm.slug,
        planID: Number(tenantForm.planID || 1),
        estado: tenantForm.estado || "Activo",
        sucursalNombre: tenantForm.sucursalNombre,
        adminLogin,
        adminPassword,
        adminEmail: tenantForm.adminEmail,
      });
      await loadEmpresas();
      await loadEmpresasModuloResumen();
      if (response?.empresaID) setEmpresaID(Number(response.empresaID));
      setTenantForm({
        nombreComercial: "",
        slug: "",
        planID: "1",
        estado: "Activo",
        sucursalNombre: "",
        adminLogin: "",
        adminPassword: "",
        adminEmail: "",
      });
      setActivePanel("tenants");
      setShowTenantCreatePanel(false);
      setInfo(`Tenant ${nombreComercial} creado con admin ${adminLogin}.`);
    } catch (nextError) {
      console.error("Error creando tenant:", nextError);
      setError(nextError?.message || "No fue posible crear el tenant.");
    } finally {
      setSaving(false);
    }
  };  const submitCreate = async event => {
    event.preventDefault();
    const payload = UserFormModel.normalizeCreate(form);
    const validationError = UserFormModel.validateCreate(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const response = await api.crearUsuarioGestion({
        empresaID: Number(empresaID),
        nombre: payload.nombre,
        login: payload.login,
        password: payload.password,
        rolID: payload.rolID,
        sucursalID: payload.sucursalID,
        estado: payload.estado,
        modulosAcceso: payload.modulosAcceso,
      });

      const createdRole = visibleRoles.find(item => Number(item.rolID) === Number(payload.rolID));
      setItems(current => ([
        {
          userID: response?.userID,
          empresaID: Number(empresaID),
          sucursalID: payload.sucursalID,
          nombre: payload.nombre,
          login: payload.login,
          email: response?.email || "",
          rolID: payload.rolID,
          rol: createdRole?.nombreRol || String(payload.rolID),
          estado: payload.estado,
        },
        ...current.filter(item => Number(item.userID) !== Number(response?.userID)),
      ]));
      resetForm();

      await loadUsers();
      setInfo(`Usuario creado en ${empresaSeleccionadaNombre}.`);
      closeCreateModal();
    } catch (nextError) {
      console.error("Error guardando usuario:", nextError);
      setError(nextError?.message || "No fue posible guardar usuario.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async event => {
    event.preventDefault();
    const payload = UserFormModel.normalizeEdit(editForm);
    const validationError = UserFormModel.validateEdit(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.actualizarUsuarioGestion({
        userId: editingUserId,
        nombre: payload.nombre,
        login: payload.login,
        password: payload.password,
        rolID: payload.rolID,
        sucursalID: payload.sucursalID,
        estado: payload.estado,
        modulosAcceso: payload.modulosAcceso,
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
      if (editingUserId === item.userID) closeEditDrawer();
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
    const normalized = normalizeModuleKey(modulo);
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

  const toggleAllUserModuleAccess = () => {
    setForm(current => ({
      ...current,
      modulosAcceso: allUserRoleModulesSelected ? [] : modulosCompatiblesRol,
    }));
  };

  const toggleEditUserModuleAccess = modulo => {
    const normalized = normalizeModuleKey(modulo);
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

  const toggleAllEditUserModuleAccess = () => {
    setEditForm(current => ({
      ...current,
      modulosAcceso: allEditRoleModulesSelected ? [] : editModulosCompatiblesRol,
    }));
  };

  const createFormProps = {
    form,
    setForm,
    visibleRoles,
    sucursales,
    saving,
    onSubmit: submitCreate,
    modulesPicker: {
      summary: userModulesSummary,
      isOpen: showUserModuleDropdown,
      onToggleOpen: () => setShowUserModuleDropdown(current => !current),
      modulesLoading,
      configuredModules: modulosConfiguradosEmpresa,
      activeModules: modulosActivosEmpresa,
      compatibleModules: modulosCompatiblesRol,
      selectedModules: form.modulosAcceso || [],
      allSelected: allUserRoleModulesSelected,
      onToggleAll: toggleAllUserModuleAccess,
      onToggleModule: toggleUserModuleAccess,
    },
  };

  const editFormProps = {
    form: editForm,
    setForm: setEditForm,
    visibleRoles,
    sucursales,
    canViewUsuariosGlobal,
    passwordVisible,
    onTogglePasswordVisible: () => setPasswordVisible(current => !current),
    saving,
    onSubmit: submitEdit,
    modulesPicker: {
      summary: editUserModulesSummary,
      isOpen: showEditModuleDropdown,
      onToggleOpen: () => setShowEditModuleDropdown(current => !current),
      modulesLoading,
      configuredModules: modulosConfiguradosEmpresa,
      activeModules: modulosActivosEmpresa,
      compatibleModules: editModulosCompatiblesRol,
      selectedModules: editForm.modulosAcceso || [],
      allSelected: allEditRoleModulesSelected,
      onToggleAll: toggleAllEditUserModuleAccess,
      onToggleModule: toggleEditUserModuleAccess,
    },
  };

  return {
    ...sidebar,
    displayUserName,
    activePanel,
    setActivePanel,
    tenantForm,
    setTenantForm,
    showTenantCreatePanel,
    setShowTenantCreatePanel,
    submitCreateTenant,
    empresaID,
    setEmpresaID,
    sucursalID,
    setSucursalID,
    estadoFiltro,
    setEstadoFiltro,
    q,
    setQ,
    items,
    empresas,
    sucursales,
    loading,
    saving,
    error,
    info,
    moduleItems,
    empresasModuloResumen,
    modulesLoading,
    modulesSaving,
    empresasModulesLoading,
    newModulo,
    setNewModulo,
    showAdvancedModules,
    setShowAdvancedModules,
    showCreateModal,
    setShowCreateModal,
    editingUserId,
    editForm,
    showEditDrawer,
    empresaSeleccionadaNombre,
    loadUsers,
    loadEmpresasModuloResumen,
    closeCreateModal,
    closeEditDrawer,
    toggleEstado,
    toggleModule,
    startEditUser,
    deleteUser,
    saveModules,
    addModulo,
    createFormProps,
    editFormProps,
  };
}
