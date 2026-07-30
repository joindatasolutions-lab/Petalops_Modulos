import { describe, expect, it } from "vitest";

import {
  UserFormModel,
  filterVisibleRoles,
  selectedModulesSummary,
  syncSelectedModules,
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
      sucursalID: "2",
      estado: "Activo",
      modulosAcceso: ["produccion"],
    });

    expect(payload).toMatchObject({
      nombre: "Diego Ustariz",
      login: "dustarizfl",
      rolID: 7,
      sucursalID: 2,
    });
    expect(UserFormModel.validateCreate(payload)).toBe("");
    expect(UserFormModel.validateCreate({ ...payload, password: "123" })).toBe("La contraseña debe tener al menos 6 caracteres.");
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
});
