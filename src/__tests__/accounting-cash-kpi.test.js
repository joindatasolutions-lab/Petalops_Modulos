import { describe, expect, it } from "vitest";
import { buildSummaryTotals } from "../domain/accounting/accountingSelectors.js";

describe("Contabilidad: KPI de efectivo", () => {
  const salesRows = [{ fecha: "2026-09-28", cantidadPedidos: 1, totalVenta: 180000 }];
  const details = [{ pedidoID: 1, estado: "APROBADO" }];

  it("suma el metodo Efectivo aunque el resumen de ventas indique cero", () => {
    const payments = [
      { cuenta: "Efectivo", metodos: ["Efectivo"], totalRecaudado: 110000 },
      { cuenta: "Bancolombia", metodos: ["Transferencia"], totalRecaudado: 70000 },
    ];
    const totals = buildSummaryTotals([{ ...salesRows[0], totalEfectivo: 0 }], details, payments);
    expect(totals.totalEfectivo).toBe(110000);
    expect(totals.totalVenta).toBe(180000);
    expect(totals.cantidadPedidos).toBe(1);
  });

  it("suma cuentas del metodo Efectivo sin duplicar el detalle", () => {
    const totals = buildSummaryTotals(salesRows, details, [
      { cuenta: "Caja local", metodos: [" efectivo "], totalRecaudado: "25000" },
      { cuenta: "Efectivo", totalRecaudado: 110000 },
    ]);
    expect(totals.totalEfectivo).toBe(135000);
  });

  it("no convierte transferencias ni saldos de caja en efectivo", () => {
    const totals = buildSummaryTotals([{ ...salesRows[0], totalEfectivo: 110000 }], details, [
      { cuenta: "Banco", metodos: ["Transferencia"], totalRecaudado: 110000 },
    ]);
    expect(totals.totalEfectivo).toBe(0);
  });

  it("usa el metodo del pedido cuando no hay cuentas agregadas", () => {
    const totals = buildSummaryTotals(salesRows, [
      { pedidoID: 99747, estado: "APROBADO", cuentaPago: "Efectivo", totalVenta: 110000 },
      { pedidoID: 99748, estado: "APROBADO", cuentaPago: "Transferencia", totalVenta: 70000 },
      { pedidoID: 99749, estado: "CANCELADO", cuentaPago: "Efectivo", totalVenta: 90000 },
    ]);
    expect(totals.totalEfectivo).toBe(110000);
  });

  it("en pagos mixtos suma solo la parte pagada en efectivo", () => {
    const totals = buildSummaryTotals(salesRows, [{
      estado: "APROBADO", totalVenta: 180000,
      detallePago: [
        { metodo: "Efectivo", monto: 110000 },
        { metodo: "Transferencia", monto: 70000 },
      ],
    }]);
    expect(totals.totalEfectivo).toBe(110000);
  });
});
