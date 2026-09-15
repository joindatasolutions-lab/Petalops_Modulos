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

// Fuentes disponibles para el tema de cada empresa (columna tema.fuente_familia). El valor
// completo (stack de CSS font-family) se guarda tal cual, igual que el default historico
// "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" -- asi el catalogo web que lee esta tabla
// no necesita ningun cambio, solo recibe un string de font-family distinto.
// Las familias web (Montserrat, Cormorant, Poppins, Playfair Display, Lora) se cargan via
// Google Fonts en index.html para que el <option> se vea realmente en esa tipografia.
export const FONT_OPTIONS = [
  { label: "Segoe UI (predeterminado)", value: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Cormorant", value: "Cormorant, serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Playfair Display", value: "Playfair Display, serif" },
  { label: "Lora", value: "Lora, serif" },
];

export const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0].value;

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
export const TENANT_LOGO_MAX_SIZE_MB = 15;
export const TENANT_LOGO_MAX_SIZE_BYTES = TENANT_LOGO_MAX_SIZE_MB * 1024 * 1024;
export const TENANT_LOGO_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
export const TENANT_LOGO_ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;
export const TENANT_LOGO_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

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

export function buildSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeTenantSlug(value) {
  return buildSlug(value);
}

export function validateTenantSlug(slug) {
  if (!slug) return "La URL del catalogo es obligatoria.";
  if (slug.length < 3) return "La URL del catalogo debe tener al menos 3 caracteres.";
  if (slug.length > 80) return "La URL del catalogo no puede superar 80 caracteres.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return "Usa solo letras minusculas, numeros y guiones, sin guiones al inicio o al final.";
  }
  return "";
}

function readEmpresaField(source, camelKey, snakeKey, fallback = "") {
  return String(source?.[camelKey] ?? source?.[snakeKey] ?? fallback ?? "");
}

function isValidEmail(value) {
  const text = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export class TenantCompanyFormModel {
  static initial(overrides = {}) {
    return {
      nombreComercial: "",
      nombreEmpresa: "",
      nit: "",
      ciudad: "",
      direccion: "",
      nombreResponsable: "",
      cargoResponsable: "",
      correoResponsable: "",
      celularResponsable: "",
      celular: "",
      slug: "",
      planID: "1",
      estado: "Activo",
      sucursalNombre: "",
      logoFile: null,
      adminLogin: "",
      adminPassword: "",
      adminEmail: "",
      ...overrides,
    };
  }

  static fromEmpresa(empresa = {}) {
    const nombreComercial = readEmpresaField(empresa, "nombreComercial", "nombre_comercial", empresa.nombre);
    return this.initial({
      nombreComercial,
      nombreEmpresa: readEmpresaField(empresa, "nombreEmpresa", "nombre_empresa", nombreComercial),
      nit: readEmpresaField(empresa, "nit", "nit"),
      ciudad: readEmpresaField(empresa, "ciudad", "ciudad"),
      direccion: readEmpresaField(empresa, "direccion", "direccion"),
      nombreResponsable: readEmpresaField(empresa, "nombreResponsable", "nombre_responsable"),
      cargoResponsable: readEmpresaField(empresa, "cargoResponsable", "cargo_responsable"),
      correoResponsable: readEmpresaField(empresa, "correoResponsable", "correo_responsable"),
      celularResponsable: readEmpresaField(empresa, "celularResponsable", "celular_responsable"),
      celular: readEmpresaField(empresa, "celular", "celular"),
      slug: readEmpresaField(empresa, "slug", "slug"),
      planID: String(empresa?.planID ?? empresa?.plan_id ?? 1),
      estado: readEmpresaField(empresa, "estado", "estado", "Activo") || "Activo",
      sucursalNombre: readEmpresaField(empresa, "sucursalNombre", "sucursal_nombre"),
    });
  }

  static normalize(form) {
    const nombreComercial = String(form.nombreComercial || "").trim();
    return {
      nombreComercial,
      nombreEmpresa: String(form.nombreEmpresa || "").trim(),
      nit: String(form.nit || "").trim() || null,
      ciudad: String(form.ciudad || "").trim(),
      direccion: String(form.direccion || "").trim(),
      nombreResponsable: String(form.nombreResponsable || "").trim(),
      cargoResponsable: String(form.cargoResponsable || "").trim(),
      correoResponsable: String(form.correoResponsable || "").trim().toLowerCase(),
      celularResponsable: String(form.celularResponsable || "").trim(),
      celular: String(form.celular || "").trim(),
      slug: normalizeTenantSlug(form.slug || nombreComercial),
      planID: Number(form.planID || 1),
      estado: form.estado || "Activo",
      sucursalNombre: String(form.sucursalNombre || "").trim(),
      logoFile: form.logoFile || null,
      adminLogin: String(form.adminLogin || "").trim().toLowerCase(),
      adminPassword: String(form.adminPassword || ""),
      adminEmail: String(form.adminEmail || "").trim().toLowerCase(),
    };
  }

  static validate(payload, { requireConfig = true, requireAdmin = false } = {}) {
    const errors = this.validateFields(payload, { requireConfig, requireAdmin });
    return Object.values(errors)[0] || "";
  }

  static validateFields(payload, { requireConfig = true, requireAdmin = false } = {}) {
    const errors = {};
    if (payload.nombreComercial.length < 3) errors.nombreComercial = "Minimo 3 caracteres.";
    if (payload.nombreEmpresa.length < 3) errors.nombreEmpresa = "Minimo 3 caracteres.";
    if (!payload.ciudad) errors.ciudad = "La ciudad es obligatoria.";
    if (!payload.direccion) errors.direccion = "La direccion del negocio es obligatoria.";
    if (!payload.nombreResponsable) errors.nombreResponsable = "El nombre del contacto es obligatorio.";
    if (!isValidEmail(payload.correoResponsable)) errors.correoResponsable = "Ingresa un correo electronico valido.";
    if (!payload.celularResponsable) errors.celularResponsable = "El celular del contacto es obligatorio.";
    if (!payload.celular) errors.celular = "El celular para recibir pedidos es obligatorio.";
    if (!["Activo", "Inactivo"].includes(payload.estado)) errors.estado = "Selecciona Activo o Inactivo.";
    if (requireConfig) {
      const slugError = validateTenantSlug(payload.slug);
      if (slugError) errors.slug = slugError;
    }
    if (payload.logoFile) {
      const logoType = String(payload.logoFile.type || "").trim().toLowerCase();
      const logoSize = Number(payload.logoFile.size || 0);
      const logoName = String(payload.logoFile.name || "");
      if (!TENANT_LOGO_ALLOWED_MIME_TYPES.has(logoType) && !TENANT_LOGO_ALLOWED_EXTENSIONS.test(logoName)) {
        errors.logoFile = "Formato no permitido. Usa JPG, PNG, WebP, HEIC o HEIF.";
      }
      if (logoSize > TENANT_LOGO_MAX_SIZE_BYTES) errors.logoFile = `El logo debe pesar maximo ${TENANT_LOGO_MAX_SIZE_MB}MB.`;
    }
    if (payload.adminLogin && payload.adminLogin.length < 3) errors.adminLogin = "Minimo 3 caracteres.";
    if (payload.adminLogin && payload.adminPassword.length < 6) {
      errors.adminPassword = "Minimo 6 caracteres.";
    }
    if (payload.adminEmail && !isValidEmail(payload.adminEmail)) errors.adminEmail = "Ingresa un correo electronico valido.";
    return errors;
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
