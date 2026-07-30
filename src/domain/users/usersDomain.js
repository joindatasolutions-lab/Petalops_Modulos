export const MODULE_HELP = {
  pipeline: "Permite consultar y gestionar el flujo operativo general de pedidos.",
  pedidos: "Permite gestionar pedidos, aprobaciones y consulta operativa.",
  produccion: "Permite planificar y ejecutar la produccion de arreglos.",
  domicilios: "Permite asignar, enrutar y cerrar entregas con evidencia.",
  barrios: "Permite administrar barrios, zonas y costos de domicilio.",
  contabilidad: "Permite revisar resumen de ventas y cierre operativo de caja.",
  trazabilidad: "Permite revisar aprobaciones y acciones operativas por usuario.",
  catalogo: "Permite consultar productos y referencias comerciales.",
  clientes: "Permite consultar y administrar la base de clientes.",
  inventario: "Permite administrar stock, insumos y movimientos de inventario.",
  usuarios: "Permite acceso al panel de gestion de usuarios.",
};

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
      sucursalID: "",
      estado: "Activo",
      modulosAcceso: [],
      ...overrides,
    };
  }

  static normalizeCreate(form) {
    return {
      nombre: String(form.nombre || "").trim(),
      login: String(form.login || "").trim().toLowerCase(),
      password: String(form.password || ""),
      rolID: Number(form.rolID),
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
