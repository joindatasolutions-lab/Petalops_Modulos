import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../../config/tenantConfig.js";
import { createApiClient } from "../../../infrastructure/apiClient.js";
import { useSidebarState } from "../../../shared/useSidebarState.js";
import {
  UserFormModel,
  DEFAULT_FONT_FAMILY,
  defaultModulesForRoles,
  filterVisibleRoles,
  normalizeTenantSlug,
  normalizeModuleKey,
  selectedModulesSummary,
  sameStringList,
  syncSelectedModules,
  validateTenantSlug,
} from "../usersDomain.js";

const TENANT_S3_CREATE_ERROR_MESSAGE = "No fue posible crear la estructura de archivos del tenant en S3. Intenta nuevamente o contacta soporte.";
const TENANT_CONFLICT_ERROR_MESSAGE = "Ya existe una empresa con ese nombre o slug.";
const TENANT_INVALID_ERROR_MESSAGE = "Revisa el nombre, slug y datos del admin del tenant.";

const INITIAL_TENANT_FORM = {
  nombreComercial: "",
  slug: "",
  planID: "1",
  estado: "Activo",
  sucursalNombre: "",
  adminLogin: "",
  adminPassword: "",
  adminEmail: "",
  nit: "",
  celular: "",
  ciudad: "",
  direccion: "",
  nombreResponsable: "",
  cargoResponsable: "",
  correoResponsable: "",
  celularResponsable: "",
};

const INITIAL_COMPANY_PROFILE_FORM = {
  nombreComercial: "",
  estado: "Activo",
  nit: "",
  celular: "",
  ciudad: "",
  direccion: "",
  nombreResponsable: "",
  cargoResponsable: "",
  correoResponsable: "",
  celularResponsable: "",
};

const INITIAL_COMPANY_THEME_FORM = {
  colorPrimario: "#d94b8a",
  colorSecundario: "#8f2e56",
  fuenteFamilia: DEFAULT_FONT_FAMILY,
};

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
  // Sub-secciones independientes dentro de "Empresas/tenants": cada una es su propia
  // pestana/formulario, no se muestran todas apiladas en la misma pagina.
  const [tenantSection, setTenantSection] = useState("perfil");

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
  const [companyProfileForm, setCompanyProfileForm] = useState(INITIAL_COMPANY_PROFILE_FORM);
  const [companyThemeForm, setCompanyThemeForm] = useState(INITIAL_COMPANY_THEME_FORM);
  const [companyProfileLoading, setCompanyProfileLoading] = useState(false);
  const [companyProfileSaving, setCompanyProfileSaving] = useState(false);
  const [companyThemeSaving, setCompanyThemeSaving] = useState(false);
  const [newModulo, setNewModulo] = useState("");
  const [showAdvancedModules, setShowAdvancedModules] = useState(false);
  const [showUserModuleDropdown, setShowUserModuleDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [paymentMethodForm, setPaymentMethodForm] = useState({ nombre: "" });
  const [paymentMethodSaving, setPaymentMethodSaving] = useState(false);
  const [paymentMethodEditing, setPaymentMethodEditing] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [storedPasswordVisible, setStoredPasswordVisible] = useState(false);
  const [storedPasswordLoading, setStoredPasswordLoading] = useState(false);
  const [storedPasswordValue, setStoredPasswordValue] = useState("");
  const [storedPasswordMessage, setStoredPasswordMessage] = useState("");
  const [editForm, setEditForm] = useState(UserFormModel.initial());
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showEditModuleDropdown, setShowEditModuleDropdown] = useState(false);
  const [form, setForm] = useState(UserFormModel.initial());
  const [tenantForm, setTenantForm] = useState(INITIAL_TENANT_FORM);

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

  const modulosCompatiblesRol = useMemo(
    () => defaultModulesForRoles(roles, form.rolesIDs?.length ? form.rolesIDs : [form.rolID], modulosActivosEmpresa),
    [roles, form.rolesIDs, form.rolID, modulosActivosEmpresa]
  );

  const editModulosCompatiblesRol = useMemo(
    () => defaultModulesForRoles(roles, editForm.rolesIDs?.length ? editForm.rolesIDs : [editForm.rolID], modulosActivosEmpresa),
    [roles, editForm.rolesIDs, editForm.rolID, modulosActivosEmpresa]
  );

  const allUserRoleModulesSelected = modulosCompatiblesRol.length > 0
    && modulosCompatiblesRol.every(modulo => (form.modulosAcceso || []).includes(modulo));
  const allEditRoleModulesSelected = editModulosCompatiblesRol.length > 0
    && editModulosCompatiblesRol.every(modulo => (editForm.modulosAcceso || []).includes(modulo));

  const resetForm = useCallback(() => {
    setForm(UserFormModel.initial());
    setShowUserModuleDropdown(false);
  }, []);

  const closeEditDrawer = useCallback(() => {
    setEditingUserId(null);
    setPasswordVisible(false);
    setStoredPasswordVisible(false);
    setStoredPasswordLoading(false);
    setStoredPasswordValue("");
    setStoredPasswordMessage("");
    setShowEditDrawer(false);
    setShowEditModuleDropdown(false);
    setEditForm(current => UserFormModel.initial({
      rolID: current.rolID,
      sucursalID: current.sucursalID,
    }));
  }, []);

  const openCreateModal = useCallback(() => {
    setForm(UserFormModel.initial());
    setPasswordVisible(false);
    setShowUserModuleDropdown(false);
    setShowCreateModal(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setPasswordVisible(false);
    setShowUserModuleDropdown(false);
    setForm(UserFormModel.initial());
  }, []);

  const openPaymentMethodModal = useCallback(() => {
    setPaymentMethodEditing(null);
    setPaymentMethodForm({ nombre: "" });
    setShowPaymentMethodModal(true);
  }, []);

  const closePaymentMethodModal = useCallback(() => {
    setShowPaymentMethodModal(false);
    setPaymentMethodEditing(null);
    setPaymentMethodForm({ nombre: "" });
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
      if (allowed.length > 0) {
        const defaultRole = allowed[0];
        setForm(current => ({
          ...current,
          rolID: String(defaultRole.rolID),
          rolesIDs: [String(defaultRole.rolID)],
          modulosAcceso: defaultModulesForRoles(allowed, [defaultRole.rolID], modulosActivosEmpresa),
        }));
      }
    }
    if (!form.sucursalID && nextSuc.length > 0) {
      const first = String(nextSuc[0].sucursalID);
      setForm(current => ({ ...current, sucursalID: first }));
      if (!sucursalID) setSucursalID(first);
    }
  }, [api, empresaID, form.rolID, form.sucursalID, sucursalID, canViewUsuariosGlobal, modulosActivosEmpresa]);

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

  const loadCompanyProfile = useCallback(async () => {
    if (!canViewUsuariosGlobal) return;
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) return;
    setCompanyProfileLoading(true);
    try {
      const [empresa, tema] = await Promise.all([
        api.obtenerEmpresaGestion({ empresaId: targetEmpresaID }),
        api.obtenerTemaEmpresa({ empresaId: targetEmpresaID }),
      ]);
      setCompanyProfileForm({
        nombreComercial: empresa?.nombreComercial || "",
        estado: empresa?.estado || "Activo",
        nit: empresa?.nit || "",
        celular: empresa?.celular || "",
        ciudad: empresa?.ciudad || "",
        direccion: empresa?.direccion || "",
        nombreResponsable: empresa?.nombreResponsable || "",
        cargoResponsable: empresa?.cargoResponsable || "",
        correoResponsable: empresa?.correoResponsable || "",
        celularResponsable: empresa?.celularResponsable || "",
      });
      setCompanyThemeForm({
        colorPrimario: tema?.colorPrimario || INITIAL_COMPANY_THEME_FORM.colorPrimario,
        colorSecundario: tema?.colorSecundario || INITIAL_COMPANY_THEME_FORM.colorSecundario,
        fuenteFamilia: tema?.fuenteFamilia || DEFAULT_FONT_FAMILY,
      });
    } catch (nextError) {
      console.error("Error cargando perfil de empresa:", nextError);
      setCompanyProfileForm(INITIAL_COMPANY_PROFILE_FORM);
      setCompanyThemeForm(INITIAL_COMPANY_THEME_FORM);
    } finally {
      setCompanyProfileLoading(false);
    }
  }, [api, empresaID, canViewUsuariosGlobal]);

  const saveCompanyProfile = useCallback(async event => {
    event.preventDefault();
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) return;
    setCompanyProfileSaving(true);
    setError("");
    setInfo("");
    try {
      await api.actualizarEmpresaGestion({ empresaId: targetEmpresaID, ...companyProfileForm });
      await loadEmpresas();
      setInfo("Datos de la empresa actualizados.");
    } catch (nextError) {
      console.error("Error actualizando empresa:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar la empresa.");
    } finally {
      setCompanyProfileSaving(false);
    }
  }, [api, empresaID, companyProfileForm, loadEmpresas]);

  const saveCompanyTheme = useCallback(async event => {
    event.preventDefault();
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) return;
    setCompanyThemeSaving(true);
    setError("");
    setInfo("");
    try {
      await api.actualizarTemaEmpresa({ empresaId: targetEmpresaID, ...companyThemeForm });
      setInfo("Tema (colores y tipografia) actualizado.");
    } catch (nextError) {
      console.error("Error actualizando tema de empresa:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar el tema.");
    } finally {
      setCompanyThemeSaving(false);
    }
  }, [api, empresaID, companyThemeForm]);

  const loadPaymentMethods = useCallback(async () => {
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) {
      setPaymentMethods([]);
      return;
    }
    setPaymentMethodsLoading(true);
    setError("");
    try {
      const data = await api.listarMetodosPagoEmpresa({ empresaId: targetEmpresaID });
      setPaymentMethods(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando metodos de pago:", nextError);
      setPaymentMethods([]);
      setError(nextError?.message || "No fue posible cargar metodos de pago.");
    } finally {
      setPaymentMethodsLoading(false);
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
    const selected = Array.isArray(form.rolesIDs) && form.rolesIDs.length > 0 ? form.rolesIDs : [form.rolID];
    const validSelected = selected.filter(roleID => visibleRoles.some(item => String(item.rolID) === String(roleID)));
    if (validSelected.length === 0) {
      const first = String(visibleRoles[0].rolID);
      setForm(current => ({ ...current, rolID: first, rolesIDs: [first] }));
    }
  }, [visibleRoles, form.rolID, form.rolesIDs]);

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
    loadCompanyProfile().catch(() => {});
  }, [loadCompanyProfile]);

  useEffect(() => {
    loadPaymentMethods().catch(() => {});
  }, [loadPaymentMethods]);

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

  useEffect(() => {
    if (!showPaymentMethodModal) return undefined;
    const onKeyDown = event => {
      if (event.key === "Escape") closePaymentMethodModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePaymentMethodModal, showPaymentMethodModal]);


  const submitCreatePaymentMethod = async event => {
    event.preventDefault();
    const nombre = String(paymentMethodForm.nombre || "").trim();
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) {
      setError("Selecciona una empresa valida para crear el metodo de pago.");
      return;
    }
    if (nombre.length < 2) {
      setError("El metodo de pago debe tener al menos 2 caracteres.");
      return;
    }
    setPaymentMethodSaving(true);
    setError("");
    setInfo("");
    try {
      const response = paymentMethodEditing
        ? await api.actualizarMetodoPagoEmpresa({
            empresaId: targetEmpresaID,
            itemId: paymentMethodEditing.id,
            nombre,
          })
        : await api.crearMetodoPagoEmpresa({
            empresaId: targetEmpresaID,
            nombre,
          });
      closePaymentMethodModal();
      await loadPaymentMethods();
      setInfo(`Metodo de pago ${response?.nombre || nombre} ${paymentMethodEditing ? "actualizado" : "creado"} para ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error creando metodo de pago:", nextError);
      setError(nextError?.message || "No fue posible guardar el metodo de pago.");
    } finally {
      setPaymentMethodSaving(false);
    }
  };

  const editPaymentMethod = item => {
    setPaymentMethodEditing(item);
    setPaymentMethodForm({ nombre: item?.nombre || "" });
    setShowPaymentMethodModal(true);
  };

  const togglePaymentMethodActive = async item => {
    const targetEmpresaID = Number(empresaID);
    if (!item?.id || !Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) return;
    setPaymentMethodSaving(true);
    setError("");
    setInfo("");
    try {
      await api.actualizarMetodoPagoEmpresa({
        empresaId: targetEmpresaID,
        itemId: item.id,
        activo: !Boolean(item.activo),
      });
      await loadPaymentMethods();
      setInfo(`Metodo de pago ${item.nombre} ${item.activo ? "inactivado" : "activado"} para ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error actualizando metodo de pago:", nextError);
      setError(nextError?.message || "No fue posible actualizar el metodo de pago.");
    } finally {
      setPaymentMethodSaving(false);
    }
  };


  const submitCreateTenant = async event => {
    event.preventDefault();
    if (!canViewUsuariosGlobal) return;
    const nombreComercial = String(tenantForm.nombreComercial || "").trim();
    const slug = normalizeTenantSlug(tenantForm.slug);
    const adminLogin = String(tenantForm.adminLogin || "").trim().toLowerCase();
    const adminPassword = String(tenantForm.adminPassword || "");
    if (nombreComercial.length < 3) {
      setError("El nombre comercial del tenant debe tener al menos 3 caracteres.");
      return;
    }
    const slugError = validateTenantSlug(slug);
    if (slugError) {
      setError(slugError);
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
        slug,
        planID: Number(tenantForm.planID || 1),
        estado: tenantForm.estado || "Activo",
        sucursalNombre: tenantForm.sucursalNombre,
        adminLogin,
        adminPassword,
        adminEmail: tenantForm.adminEmail,
        nit: tenantForm.nit,
        celular: tenantForm.celular,
        ciudad: tenantForm.ciudad,
        direccion: tenantForm.direccion,
        nombreResponsable: tenantForm.nombreResponsable,
        cargoResponsable: tenantForm.cargoResponsable,
        correoResponsable: tenantForm.correoResponsable,
        celularResponsable: tenantForm.celularResponsable,
      });
      await loadEmpresas();
      await loadEmpresasModuloResumen();
      if (response?.empresaID) setEmpresaID(Number(response.empresaID));
      const assetsPrefix = String(response?.assetsPrefix || "").trim();
      setTenantForm(INITIAL_TENANT_FORM);
      setActivePanel("tenants");
      setTenantSection("perfil");
      setInfo(assetsPrefix
        ? `Tenant ${nombreComercial} creado con admin ${adminLogin}. Assets: ${assetsPrefix}`
        : `Tenant ${nombreComercial} creado con admin ${adminLogin}.`);
    } catch (nextError) {
      console.error("Error creando tenant:", nextError);
      const isS3CreateError = Number(nextError?.status) === 502 && nextError?.code === "AUTH_EMPRESA_CREATE_S3_ERROR";
      if (isS3CreateError) {
        setError(TENANT_S3_CREATE_ERROR_MESSAGE);
      } else if (Number(nextError?.status) === 409) {
        setError(nextError?.detail || TENANT_CONFLICT_ERROR_MESSAGE);
      } else if (Number(nextError?.status) === 400) {
        setError(nextError?.detail || TENANT_INVALID_ERROR_MESSAGE);
      } else {
        setError(nextError?.message || "No fue posible crear el tenant.");
      }
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
        rolesIDs: payload.rolesIDs,
        modulosAcceso: payload.modulosAcceso,
      });

      const createdRoles = visibleRoles.filter(item => payload.rolesIDs.includes(Number(item.rolID)));
      const createdRole = createdRoles.find(item => Number(item.rolID) === Number(payload.rolID));
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
          rolesIDs: payload.rolesIDs,
          roles: createdRoles.map(item => ({
            rolID: Number(item.rolID),
            nombreRol: item.nombreRol,
            principal: Number(item.rolID) === Number(payload.rolID),
          })),
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
        rolesIDs: payload.rolesIDs,
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
      setStoredPasswordVisible(false);
      setStoredPasswordLoading(false);
      setStoredPasswordValue("");
      setStoredPasswordMessage("");
      setEditForm({
        nombre: detail.nombre || "",
        login: detail.login || "",
        email: detail.email || "",
        password: "",
        rolID: String(detail.rolID || ""),
        rolesIDs: Array.isArray(detail.rolesIDs) && detail.rolesIDs.length > 0
          ? detail.rolesIDs.map(item => String(item))
          : [String(detail.rolID || "")].filter(Boolean),
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

  const revealStoredPassword = async () => {
    if (!editingUserId) return;
    const confirmed = globalThis.confirm("Esta accion quedara auditada. ¿Quieres ver la contrasena guardada de este usuario?");
    if (!confirmed) return;
    setStoredPasswordLoading(true);
    setStoredPasswordValue("");
    setStoredPasswordMessage("");
    setError("");
    try {
      const response = await api.obtenerPasswordUsuarioGestion({ userId: editingUserId });
      if (response?.available && response?.password) {
        setStoredPasswordValue(String(response.password));
        setStoredPasswordVisible(true);
        setStoredPasswordMessage("Contrasena recuperada desde el vault.");
      } else {
        setStoredPasswordVisible(false);
        setStoredPasswordMessage(response?.message || "Este usuario no tiene contrasena recuperable.");
      }
    } catch (nextError) {
      console.error("Error consultando contrasena guardada:", nextError);
      setStoredPasswordVisible(false);
      setStoredPasswordMessage("");
      setError(nextError?.message || "No fue posible consultar la contrasena guardada.");
    } finally {
      setStoredPasswordLoading(false);
    }
  };

  const hideStoredPassword = () => {
    setStoredPasswordVisible(false);
    setStoredPasswordValue("");
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

  const toggleUserRoleAccess = roleID => {
    const normalized = String(roleID);
    setForm(current => {
      const currentRoles = Array.isArray(current.rolesIDs) && current.rolesIDs.length > 0
        ? current.rolesIDs.map(item => String(item))
        : [String(current.rolID || "")].filter(Boolean);
      const exists = currentRoles.includes(normalized);
      const nextRoles = exists
        ? currentRoles.filter(item => item !== normalized)
        : [...currentRoles, normalized];
      const safeRoles = nextRoles.length > 0 ? nextRoles : [normalized];
      return {
        ...current,
        rolID: safeRoles[0],
        rolesIDs: safeRoles,
        modulosAcceso: defaultModulesForRoles(visibleRoles, safeRoles, modulosActivosEmpresa),
      };
    });
  };

  const toggleEditUserRoleAccess = roleID => {
    const normalized = String(roleID);
    setEditForm(current => {
      const currentRoles = Array.isArray(current.rolesIDs) && current.rolesIDs.length > 0
        ? current.rolesIDs.map(item => String(item))
        : [String(current.rolID || "")].filter(Boolean);
      const exists = currentRoles.includes(normalized);
      const nextRoles = exists
        ? currentRoles.filter(item => item !== normalized)
        : [...currentRoles, normalized];
      const safeRoles = nextRoles.length > 0 ? nextRoles : [normalized];
      return {
        ...current,
        rolID: safeRoles[0],
        rolesIDs: safeRoles,
      };
    });
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
    selectedRoleIDs: form.rolesIDs || [],
    modulosActivosEmpresa,
    sucursales,
    passwordVisible,
    onTogglePasswordVisible: () => setPasswordVisible(current => !current),
    saving,
    onToggleRole: toggleUserRoleAccess,
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
    selectedRoleIDs: editForm.rolesIDs || [],
    sucursales,
    canViewUsuariosGlobal,
    passwordVisible,
    onTogglePasswordVisible: () => setPasswordVisible(current => !current),
    storedPasswordVisible,
    storedPasswordLoading,
    storedPasswordValue,
    storedPasswordMessage,
    onRevealStoredPassword: revealStoredPassword,
    onHideStoredPassword: hideStoredPassword,
    saving,
    onToggleRole: toggleEditUserRoleAccess,
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
    tenantSection,
    setTenantSection,
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
    companyProfileForm,
    setCompanyProfileForm,
    companyThemeForm,
    setCompanyThemeForm,
    companyProfileLoading,
    companyProfileSaving,
    companyThemeSaving,
    saveCompanyProfile,
    saveCompanyTheme,
    newModulo,
    setNewModulo,
    showAdvancedModules,
    setShowAdvancedModules,
    showCreateModal,
    setShowCreateModal,
    showPaymentMethodModal,
    paymentMethodForm,
    setPaymentMethodForm,
    paymentMethodSaving,
    paymentMethodEditing,
    paymentMethods,
    paymentMethodsLoading,
    openCreateModal,
    openPaymentMethodModal,
    editingUserId,
    editForm,
    showEditDrawer,
    empresaSeleccionadaNombre,
    loadUsers,
    loadPaymentMethods,
    loadEmpresasModuloResumen,
    closeCreateModal,
    closePaymentMethodModal,
    closeEditDrawer,
    toggleEstado,
    toggleModule,
    startEditUser,
    deleteUser,
    saveModules,
    addModulo,
    submitCreatePaymentMethod,
    editPaymentMethod,
    togglePaymentMethodActive,
    createFormProps,
    editFormProps,
  };
}
