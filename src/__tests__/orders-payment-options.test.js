import { describe, expect, it } from "vitest";

import { normalizeConfiguredPaymentOptions } from "../domain/orders-admin/ordersDomain.js";


describe("opciones de metodos de pago por tenant", () => {
  it("no agrega RAPPI cuando no viene configurado", () => {
    expect(normalizeConfiguredPaymentOptions(["Nequi", "Daviplata", "Efectivo"])).toEqual([
      "Nequi",
      "Daviplata",
      "Efectivo",
    ]);
  });

  it("conserva RAPPI cuando el tenant lo recibe desde la base", () => {
    expect(normalizeConfiguredPaymentOptions(["Efectivo", "RAPPI"])).toEqual(["Efectivo", "RAPPI"]);
  });
});
