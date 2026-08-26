export const MODULE_HELP = {
  pipeline: "Permite consultar y gestionar el flujo operativo general de pedidos.",
  pedidos: "Permite gestionar pedidos, aprobaciones y consulta operativa.",
  produccion: "Permite planificar y ejecutar la produccion de arreglos.",
  domicilios: "Permite asignar, enrutar y cerrar entregas con evidencia.",
  barrios: "Permite administrar barrios, zonas y costos de domicilio.",
  contabilidad: "Permite revisar resumen de ventas y cierre operativo de caja.",
  catalogo: "Permite consultar productos y referencias comerciales.",
  clientes: "Permite consultar y administrar la base de clientes.",
  inventario: "Permite administrar stock, insumos y movimientos de inventario.",
  usuarios: "Permite acceso al panel de gestion de usuarios.",
};

// Modulos por defecto para un usuario nuevo/al cambiar de rol: exactamente lo que ESE rol
// permite (modulosPermitidos, calculado en el backend desde permiso_modulo), acotado a lo
// que la empresa tiene activo. No usar la lista completa de modulos de la empresa aqui --
// eso le daria a cualquier rol (ej. Florista) acceso a modulos que nunca deberia tener
// (ej. usuarios, contabilidad) solo por no haber tocado el formulario.
export function defaultModulesForRole(role, activeModules) {
  const permitted = Array.isArray(role?.modulosPermitidos) ? role.modulosPermitidos : [];
  const activeSet = new Set(activeModules || []);
  return permitted.filter(modulo => activeSet.has(modulo));
}

export function defaultModulesForRoles(roles, selectedRoleIDs, activeModules) {
  const selected = new Set((selectedRoleIDs || []).map(item => String(item)));
  const activeSet = new Set(activeModules || []);
  const modules = new Set();
  (roles || []).forEach(role => {
    if (!selected.has(String(role?.rolID))) return;
    (role?.modulosPermitidos || []).forEach(modulo => {
      if (activeSet.has(modulo)) modules.add(modulo);
    });
  });
  return [...modules].sort();
}

const ROLE_TYPE_LABELS = [
  { pattern: /admin|administrador/, label: "Admin" },
  { pattern: /florista/, label: "Florista" },
  { pattern: /recepci|recepcion/, label: "Recepcion" },
  { pattern: /pedido|ventas|comercial/, label: "Pedidos" },
  { pattern: /domicili|repart/, label: "Domiciliario" },
  { pattern: /inventar|bodega|almacen/, label: "Inventarista" },
  { pattern: /contab|caja|finan/, label: "Contabilidad" },
];

const STRUCTURAL_ROLES = new Set(["super_admin", "superadmin", "join_admin", "empresa_admin", "admin", "owner"]);

export class UserFormModel {
  static initial(overrides = {}) {
    return {
      nombre: "",
      login: "",
      email: "",
      password: "",
      rolID: "",
      rolesIDs: [],
      sucursalID: "",
      estado: "Activo",
      modulosAcceso: [],
      ...overrides,
    };
  }

  static normalizeCreate(form) {
    const rolesIDs = normalizeRoleIds(form.rolesIDs || form.rolID);
    return {
      nombre: String(form.nombre || "").trim(),
      login: String(form.login || "").trim().toLowerCase(),
      password: String(form.password || ""),
      rolID: Number(form.rolID || rolesIDs[0]),
      rolesIDs,
      sucursalID: Number(form.sucursalID),
      estado: form.estado,
      modulosAcceso: Array.isArray(form.modulosAcceso) ? form.modulosAcceso : [],
    };
  }

  static normalizeEdit(form) {
    return this.normalizeCreate(form);
  }

  static validateCreate(payload) {
    if (payload.nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
    if (payload.login.length < 3) return "El login debe tener al menos 3 caracteres.";
    if (payload.password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    if (!Number.isFinite(payload.rolID) || payload.rolID <= 0) return "Debes seleccionar un rol válido.";
    if (!Number.isFinite(payload.sucursalID) || payload.sucursalID <= 0) return "Debes seleccionar una sucursal válida.";
    return "";
  }

  static validateEdit(payload) {
    if (payload.nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
    if (payload.login.length < 3) return "El login debe tener al menos 3 caracteres.";
    if (payload.password.length > 0 && payload.password.length < 6) return "La nueva contraseña debe tener al menos 6 caracteres.";
    if (!Number.isFinite(payload.rolID) || payload.rolID <= 0) return "Debes seleccionar un rol válido.";
    if (!Number.isFinite(payload.sucursalID) || payload.sucursalID <= 0) return "Debes seleccionar una sucursal válida.";
    return "";
  }
}

export function normalizeRoleIds(values) {
  const source = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const result = [];
  source.forEach(raw => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  });
  return result;
}

export function normalizeRoleKey(roleName) {
  return String(roleName || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function roleTypeLabel(roleName) {
  const normalized = String(roleName || "").trim().toLowerCase();
  const found = ROLE_TYPE_LABELS.find(item => item.pattern.test(normalized));
  return found?.label || "Otro";
}

export function filterVisibleRoles(roles, canViewUsuariosGlobal = false) {
  const rows = Array.isArray(roles) ? roles : [];
  if (canViewUsuariosGlobal) return rows;
  return rows.filter(item => !STRUCTURAL_ROLES.has(normalizeRoleKey(item?.nombreRol)));
}

export function normalizeModuleKey(module) {
  return String(module || "").trim().toLowerCase();
}

export function selectedModulesSummary({
  loading,
  activeModulesCount,
  compatibleModulesCount,
  selectedCount,
  hasRole,
}) {
  if (loading) return "Cargando modulos...";
  if (activeModulesCount === 0) return "Sin modulos activos";
  if (compatibleModulesCount === 0 && hasRole) return "Sin modulos activos";
  if (selectedCount === 0) return "Selecciona modulos";
  if (selectedCount === activeModulesCount) return "Todos los modulos activos";
  return `${selectedCount} ${selectedCount === 1 ? "modulo seleccionado" : "modulos seleccionados"}`;
}

export function syncSelectedModules(currentModules, compatibleModules, activeModules) {
  const source = Array.isArray(currentModules) ? currentModules : [];
  const allowedModules = compatibleModules.length > 0 ? compatibleModules : activeModules;
  const filtered = source.filter(module => allowedModules.includes(normalizeModuleKey(module)));
  return filtered.length > 0 ? filtered : allowedModules;
}

export function sameStringList(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
