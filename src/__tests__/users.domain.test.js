import { describe, expect, it } from "vitest";

import {
  UserFormModel,
  TenantCompanyFormModel,
  buildSlug,
  defaultModulesForRoles,
  filterVisibleRoles,
  normalizeAsignacionConfig,
  normalizeTenantSlug,
  selectedModulesSummary,
  syncSelectedModules,
  validateTenantSlug,
} from "../domain/users/usersDomain.js";

describe("dominio de usuarios", () => {
  it("filtra roles estructurales para administradores de empresa", () => {
    const roles = [
      { rolID: 1, nombreRol: "super_admin" },
      { rolID: 2, nombreRol: "Florista" },
      { rolID: 3, nombreRol: "Contabilidad" },
      { rolID: 4, nombreRol: "owner" },
    ];

    expect(filterVisibleRoles(roles, false)).toEqual([roles[1], roles[2]]);
    expect(filterVisibleRoles(roles, true)).toEqual(roles);
  });

  it("normaliza y valida la creacion de usuario", () => {
    const payload = UserFormModel.normalizeCreate({
      nombre: "  Diego Ustariz  ",
      login: "  DUSTARIZFL  ",
      email: "  DIEGO@EXAMPLE.COM  ",
      celular: " 3007252222 ",
      password: "secret1",
      rolID: "7",
      rolesIDs: ["7", "8"],
      sucursalID: "2",
      estado: "Activo",
      modulosAcceso: ["produccion"],
    });

    expect(payload).toMatchObject({
      nombre: "Diego Ustariz",
      login: "dustarizfl",
      email: "diego@example.com",
      celular: "3007252222",
      rolID: 7,
      rolesIDs: [7, 8],
      sucursalID: 2,
    });
    expect(UserFormModel.validateCreate(payload)).toBe("");
    expect(UserFormModel.validateCreate({ ...payload, password: "123" })).toBe("La contraseña debe tener al menos 6 caracteres.");
  });

  it("mantiene activas las notificaciones existentes y apaga la nueva por defecto", () => {
    expect(normalizeAsignacionConfig({})).toMatchObject({
      notificacionPedidoAceptadoActiva: true,
      notificacionPedidoEntregadoActiva: true,
      notificacionNuevoPedidoDomiciliarioActiva: false,
    });

    expect(normalizeAsignacionConfig({
      notificacionPedidoAceptadoActiva: false,
      notificacionPedidoEntregadoActiva: false,
      notificacionNuevoPedidoDomiciliarioActiva: true,
    })).toMatchObject({
      notificacionPedidoAceptadoActiva: false,
      notificacionPedidoEntregadoActiva: false,
      notificacionNuevoPedidoDomiciliarioActiva: true,
    });
  });

  it("suma los modulos permitidos por multiples roles activos", () => {
    const roles = [
      { rolID: 7, nombreRol: "Contabilidad", modulosPermitidos: ["contabilidad"] },
      { rolID: 8, nombreRol: "Inventarista", modulosPermitidos: ["inventario", "catalogo"] },
      { rolID: 9, nombreRol: "Florista", modulosPermitidos: ["produccion"] },
    ];

    expect(defaultModulesForRoles(roles, ["7", "8"], ["contabilidad", "inventario", "pedidos"])).toEqual([
      "contabilidad",
      "inventario",
    ]);
  });

  it("mantiene modulos permitidos y repone activos cuando la seleccion queda vacia", () => {
    expect(syncSelectedModules(["produccion", "reportes"], ["produccion"], ["produccion", "pedidos"])).toEqual(["produccion"]);
    expect(syncSelectedModules(["reportes"], ["produccion"], ["produccion", "pedidos"])).toEqual(["produccion"]);
  });

  it("resume seleccion de modulos con textos consistentes", () => {
    expect(selectedModulesSummary({
      loading: false,
      activeModulesCount: 8,
      compatibleModulesCount: 8,
      selectedCount: 1,
      hasRole: true,
    })).toBe("1 modulo seleccionado");

    expect(selectedModulesSummary({
      loading: false,
      activeModulesCount: 8,
      compatibleModulesCount: 8,
      selectedCount: 8,
      hasRole: true,
    })).toBe("Todos los modulos activos");
  });

  it("normaliza y valida slug de tenant para prefijo de assets", () => {
    expect(normalizeTenantSlug("  La Fiore Casa de Flores  ")).toBe("la-fiore-casa-de-flores");
    expect(normalizeTenantSlug("Jardin & Cafe")).toBe("jardin-cafe");
    expect(buildSlug("FlorMar Caribe")).toBe("flormar-caribe");
    expect(buildSlug("a".repeat(90))).toHaveLength(80);

    expect(validateTenantSlug("lafiore")).toBe("");
    expect(validateTenantSlug("la-fiore")).toBe("");
    expect(validateTenantSlug("la")).toBe("La URL del catalogo debe tener al menos 3 caracteres.");
    expect(validateTenantSlug("a".repeat(81))).toBe("La URL del catalogo no puede superar 80 caracteres.");
    expect(validateTenantSlug("-lafiore")).toBe("Usa solo letras minusculas, numeros y guiones, sin guiones al inicio o al final.");
  });

  it("normaliza y valida datos nuevos de empresa para crear tenant", () => {
    const payload = TenantCompanyFormModel.normalize({
      nombreComercial: "  La Fiore  ",
      nombreEmpresa: "  La Fiore SAS  ",
      nit: " ",
      ciudad: " Barranquilla ",
      direccion: " Calle 84 ",
      nombreResponsable: " Maria Perez ",
      cargoResponsable: "",
      correoResponsable: " RESPONSABLE@EMPRESA.COM ",
      celularResponsable: " 3001112233 ",
      celular: " 3019998877 ",
      slug: "",
      planID: "2",
      estado: "Activo",
      adminLogin: " ADMIN ",
      adminPassword: "secret1",
    });

    expect(payload).toMatchObject({
      nombreComercial: "La Fiore",
      nombreEmpresa: "La Fiore SAS",
      nit: null,
      ciudad: "Barranquilla",
      direccion: "Calle 84",
      nombreResponsable: "Maria Perez",
      correoResponsable: "responsable@empresa.com",
      celularResponsable: "3001112233",
      celular: "3019998877",
      slug: "la-fiore",
      planID: 2,
      adminLogin: "admin",
    });
    expect(TenantCompanyFormModel.validate(payload, { requireAdmin: true })).toBe("");
    expect(TenantCompanyFormModel.validate({ ...payload, correoResponsable: "correo-malo" })).toBe("Ingresa un correo electronico valido.");
    expect(TenantCompanyFormModel.validate({ ...payload, celular: "" })).toBe("El celular para recibir pedidos es obligatorio.");
    expect(TenantCompanyFormModel.validate({ ...payload, adminEmail: "admin-malo" }, { requireAdmin: true })).toBe("Ingresa un correo electronico valido.");
    expect(TenantCompanyFormModel.validate({ ...payload, estado: "Suspendido" })).toBe("Selecciona Activo o Inactivo.");
    expect(TenantCompanyFormModel.validate({ ...payload, adminLogin: "", adminPassword: "" }, { requireAdmin: true })).toBe("");
    expect(TenantCompanyFormModel.validate({ ...payload, adminLogin: "ad", adminPassword: "secret1" }, { requireAdmin: true })).toBe("Minimo 3 caracteres.");
    expect(TenantCompanyFormModel.validate({ ...payload, adminLogin: "admin", adminPassword: "123" }, { requireAdmin: true })).toBe("Minimo 6 caracteres.");
    expect(TenantCompanyFormModel.validate({
      ...payload,
      logoFile: new File(["logo"], "logo.gif", { type: "image/gif" }),
    })).toBe("Formato no permitido. Usa JPG, PNG, WebP, HEIC o HEIF.");
    expect(TenantCompanyFormModel.validate({
      ...payload,
      logoFile: new File(["logo"], "logo.webp", { type: "image/webp" }),
    })).toBe("");
  });
});
