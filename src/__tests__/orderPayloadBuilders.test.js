import { describe, expect, it } from "vitest";

import { buildDetailUpdatePayload, buildDuplicateCheckoutPayload } from "../domain/orders-admin/orderPayloadBuilders.js";

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

  it("envia las notas de produccion como nota_produccion al editar el pedido", () => {
    const payload = buildPayload({
      productoObservaciones: "Arreglo en tonos pastel, sin girasoles",
      mensajeTarjeta: "Texto que va en la tarjeta floral",
      firma: "Con carino, Juan",
      observacionGeneral: "Llamar antes de llegar",
    });

    expect(payload.productoObservaciones).toBe("Arreglo en tonos pastel, sin girasoles");
    expect(payload.nota_produccion).toBe("Arreglo en tonos pastel, sin girasoles");
    expect(payload.notaProduccion).toBe("Arreglo en tonos pastel, sin girasoles");
    expect(payload.mensaje_tarjeta).toBe("Texto que va en la tarjeta floral");
    expect(payload.mensajeTarjeta).toBe("Texto que va en la tarjeta floral");
    expect(payload.firma_tarjeta).toBe("Con carino, Juan");
    expect(payload.firma).toBe("Con carino, Juan");
    expect(payload.observaciones_entrega).toBe("Llamar antes de llegar");
    expect(payload.observacionGeneral).toBe("Llamar antes de llegar");
  });

  it("usa el costo del barrio seleccionado al editar el pedido", () => {
    const payload = buildPayload({
      barrioNombre: "Riomar",
      domicilioOriginal: undefined,
      costoDomicilio: 10000,
    });

    expect(payload.domicilio).toBe(10000);
    expect(payload.costoDomicilio).toBe(10000);
    expect(payload.domicilioOriginal).toBe(10000);
  });

  it("preserva notas de produccion desde produccion.observacionesinternas al duplicar", () => {
    const payload = buildDuplicateCheckoutPayload({
      empresaId: 3,
      sucursalId: 4,
      detalle: {
        sucursalID: 4,
        productos: [{ productoID: 20, cantidad: 1 }],
        produccion: { observacionesinternas: "Usar rosas blancas abiertas" },
        destinatario: {
          fechaEntrega: "2026-08-11T14:00:00",
          horaEntrega: "14:00",
          barrio: "Miramar",
          nombre: "DIEGO USTARIZ",
          telefono: "3128896624",
          direccion: "CALLE 99A",
        },
        cliente: { nombre: "Cliente prueba", telefono: "3128896624" },
      },
      edit: {
        fechaEntrega: "2026-08-11",
        horaEntrega: "14:00",
        barrioNombre: "Miramar",
      },
    });

    expect(payload.nota_produccion).toBe("Usar rosas blancas abiertas");
    expect(payload.productos[0].nota_produccion).toBe("Usar rosas blancas abiertas");
  });
});
