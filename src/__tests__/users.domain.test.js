import { describe, expect, it } from "vitest";

import {
  UserFormModel,
  buildSlug,
  defaultModulesForRoles,
  filterVisibleRoles,
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
      rolID: 7,
      rolesIDs: [7, 8],
      sucursalID: 2,
    });
    expect(UserFormModel.validateCreate(payload)).toBe("");
    expect(UserFormModel.validateCreate({ ...payload, password: "123" })).toBe("La contraseña debe tener al menos 6 caracteres.");
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
    expect(validateTenantSlug("la")).toBe("El slug catalogo debe tener al menos 3 caracteres.");
    expect(validateTenantSlug("a".repeat(81))).toBe("El slug catalogo no puede superar 80 caracteres.");
    expect(validateTenantSlug("-lafiore")).toBe("El slug catalogo solo puede usar letras minusculas, numeros y guiones, sin guiones al inicio o al final.");
  });
});
