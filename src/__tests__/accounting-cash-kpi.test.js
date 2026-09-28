import { describe, expect, it } from "vitest";
import { buildSummaryTotals } from "../domain/accounting/accountingSelectors.js";

describe("Contabilidad: KPI de efectivo", () => {
  const salesRows = [{ fecha: "2026-09-28", cantidadPedidos: 1, totalVenta: 180000 }];
  const details = [{ pedidoID: 1, estado: "APROBADO" }];

  it("conserva los 110000 en efectivo cuando ventas diarias no incluye recaudos", () => {
    const summaryRows = [{ fecha: "2026-09-28", totalEfectivo: 110000, totalVenta: 170000 }];
    const totals = buildSummaryTotals(salesRows, details, summaryRows);
    expect(totals.totalEfectivo).toBe(110000);
    expect(totals.totalVenta).toBe(180000);
    expect(totals.cantidadPedidos).toBe(1);
  });

  it("suma el efectivo de todo el periodo, incluso fechas ausentes en ventas diarias", () => {
    const totals = buildSummaryTotals(salesRows, details, [
      { fecha: "2026-09-27", totalEfectivo: "25000" },
      { fecha: "2026-09-28", totalEfectivo: 110000 },
    ]);
    expect(totals.totalEfectivo).toBe(135000);
  });

  it("respeta un cero explicito del resumen contable", () => {
    const totals = buildSummaryTotals([{ ...salesRows[0], totalEfectivo: 110000 }], details, [
      { fecha: "2026-09-28", totalEfectivo: 0 },
    ]);
    expect(totals.totalEfectivo).toBe(0);
  });

  it.each([{ cashRows: [] }, { cashRows: [{ fecha: "2026-09-28" }] }])("usa efectivo de ventas si el resumen no lo proporciona: %j", ({ cashRows }) => {
    const totals = buildSummaryTotals([{ ...salesRows[0], totalEfectivo: 110000 }], details, cashRows);
    expect(totals.totalEfectivo).toBe(110000);
  });
});
