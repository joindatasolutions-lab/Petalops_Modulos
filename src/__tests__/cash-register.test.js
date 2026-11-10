import { describe, expect, it } from "vitest";
import { calculateCashBalance, calculateCashCount } from "../domain/accounting/cashRegisterDomain.js";
import { normalizeCashClosingRow } from "../domain/accounting/accountingDomain.js";
import { buildCashExportRows } from "../domain/accounting/accountingExports.js";

describe("Caja: arqueo y diferencias", () => {
  it("reproduce el ejemplo con monedas de denominación explícita", () => {
    const contado = calculateCashCount({ 100000: 1, 50000: 1, 20000: 1, 5000: 1, 200: 6 });
    expect(contado).toBe(176200);
    expect(calculateCashBalance({ base: 88200, efectivo: 88000, contado })).toEqual({
      esperado: 176200, diferencia: 0, faltante: 0, sobrante: 0, nuevaBase: 176200,
    });
  });
  it("descuenta gastos, faltantes y guardado sin descontar dos veces el faltante", () => {
    expect(calculateCashBalance({ base: 100000, efectivo: 80000, gasto: 10000, guardado: 20000, contado: 165000 })).toEqual({
      esperado: 170000, diferencia: -5000, faltante: 5000, sobrante: 0, nuevaBase: 145000,
    });
  });
  it("incluye el sobrante en el efectivo físico de la nueva base", () => {
    const result = calculateCashBalance({ base: 100000, contado: 105000, guardado: 10000 });
    expect(result.sobrante).toBe(5000);
    expect(result.nuevaBase).toBe(95000);
  });
  it("distingue un arqueo pendiente de una caja vacía", () => {
    expect(calculateCashCount(null)).toBeNull();
    expect(calculateCashCount({ 100000: 0 })).toBe(0);
    expect(calculateCashBalance({ base: 100000 }).diferencia).toBeNull();
    expect(calculateCashBalance({ base: 100000, contado: 0 }).faltante).toBe(100000);
  });
  it.each([-1, 0.5, "abc", Infinity])("rechaza cantidades inválidas: %s", cantidad => {
    expect(() => calculateCashCount({ 1000: cantidad })).toThrow();
  });
  it("no inventa arqueos en cierres históricos", () => {
    const row = normalizeCashClosingRow({ fecha: "2026-10-22", base: 100, efectivo: 50, nuevaBase: 150 });
    expect(row.totalContado).toBeNull();
    expect(row.diferencia).toBeNull();
    expect(buildCashExportRows([row])[0].TotalContado).toBe("");
  });
  it("recupera y exporta el conteo persistido", () => {
    const row = normalizeCashClosingRow({ fecha_operacion: "2026-10-22", base_inicial: 100000, total_contado: 95000, arqueo_denominaciones: { 5000: 19 } });
    expect(row.arqueo).toEqual({ 5000: 19 });
    expect(row.diferencia).toBe(-5000);
    expect(buildCashExportRows([row])[0].Diferencia).toBe(-5000);
  });
});
