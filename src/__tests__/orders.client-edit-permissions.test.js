import { describe, expect, it } from "vitest";

import { canEditOrderClientIdentity } from "../domain/orders-admin/ordersDomain.js";


describe("permisos para editar datos del cliente desde Pedidos", () => {
  it("permite editar a un usuario no administrador con Pedidos asignado", () => {
    expect(canEditOrderClientIdentity({
      rol: "Pedidos",
      modulosActivosPlan: ["pedidos"],
      permisos: [{ modulo: "pedidos", puedeVer: true, puedeEditar: true }],
    })).toBe(true);
  });

  it("mantiene habilitados a administradores y superadministradores", () => {
    expect(canEditOrderClientIdentity({ rol: "Admin" })).toBe(true);
    expect(canEditOrderClientIdentity({ esGlobalJoin: true })).toBe(true);
  });

  it("bloquea a quien no tiene asignado el modulo Pedidos", () => {
    expect(canEditOrderClientIdentity({
      rol: "Florista",
      modulosActivosPlan: ["produccion"],
      permisos: [{ modulo: "produccion", puedeVer: true, puedeEditar: true }],
    })).toBe(false);
  });
});
