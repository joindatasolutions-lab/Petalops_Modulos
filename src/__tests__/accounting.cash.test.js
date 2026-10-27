import { describe, expect, it } from "vitest";

import { normalizeCashClosingRow } from "../domain/accounting/accountingDomain.js";

describe("arqueo de caja", () => {
  it("conserva historicos sin conteo fisico", () => {
    const row = normalizeCashClosingRow({
      fecha: "2026-10-20",
      base: 100000,
      efectivo: 500000,
      gasto: 100000,
      totalEfectivo: 500000,
      guardado: 400000,
      nuevaBase: 100000,
    });

    expect(row.totalContado).toBeNull();
    expect(row.sobrante).toBe(0);
    expect(row.faltante).toBe(0);
    expect(row.nuevaBase).toBe(100000);
  });

  it("normaliza un cierre con faltante sin volver negativa la nueva base", () => {
    const row = normalizeCashClosingRow({
      fecha_operacion: "2026-10-21",
      base_inicial: 200000,
      efectivo_ventas: 500000,
      total_gastos: 100000,
      total_efectivo: 600000,
      total_contado: 590000,
      monto_guardado: 500000,
      nueva_base: 90000,
      sobrante: 0,
      faltante: 10000,
    });

    expect(row.totalContado).toBe(590000);
    expect(row.sobrante).toBe(0);
    expect(row.faltante).toBe(10000);
    expect(row.nuevaBase).toBe(90000);
  });
});
