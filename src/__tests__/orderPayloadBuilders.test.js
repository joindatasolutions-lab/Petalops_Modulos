import { describe, expect, it } from "vitest";

import { buildDetailUpdatePayload } from "../domain/orders-admin/orderPayloadBuilders.js";

const baseArgs = {
  pedidoId: 77,
  detalle: { destinatario: {} },
  paymentValidation: {
    methods: ["Efectivo"],
    paymentBreakdown: null,
    cashAmount: 115000,
  },
  canalFlora: "WhatsApp",
  canEditClientIdentity: true,
};

function buildPayload(overrides = {}) {
  return buildDetailUpdatePayload({
    ...baseArgs,
    edit: {
      detalleID: 10,
      productoID: 20,
      cantidad: 1,
      barrioNombre: "El Prado",
      domicilioOriginal: 15000,
      domicilioObsequiado: false,
      descuentoMonto: 0,
      saldoFavorMonto: 0,
      ...overrides,
    },
  });
}

describe("buildDetailUpdatePayload domicilio obsequiado", () => {
  it("cobra nuevamente el domicilio cuando se quita el obsequio", () => {
    const payload = buildPayload({ domicilioObsequiado: false });

    expect(payload.domicilio).toBe(15000);
    expect(payload.costoDomicilio).toBe(15000);
    expect(payload.domicilioOriginal).toBe(15000);
    expect(payload.descuentoDomicilio).toBe(0);
    expect(payload.domicilioObsequiado).toBe(false);
    expect(payload.omitirCostoDomicilio).toBe(false);
    expect(payload.forzarRecalculoFinanciero).toBe(true);
  });

  it("descuenta el domicilio cuando se marca como obsequiado", () => {
    const payload = buildPayload({ domicilioObsequiado: true });

    expect(payload.domicilio).toBe(0);
    expect(payload.costoDomicilio).toBe(0);
    expect(payload.domicilioOriginal).toBe(15000);
    expect(payload.descuentoDomicilio).toBe(15000);
    expect(payload.domicilioObsequiado).toBe(true);
    expect(payload.omitirCostoDomicilio).toBe(true);
    expect(payload.forzarRecalculoFinanciero).toBe(true);
  });
});
