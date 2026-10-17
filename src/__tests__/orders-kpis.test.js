import { describe, expect, it } from "vitest";
import { normalizeOrdersKpis } from "../domain/orders-admin/ordersKpis.js";

describe("KPI del periodo consultado", () => {
  it("usa el periodo aunque hoy no tenga pedidos", () => {
    const result = normalizeOrdersKpis({
      ventaPeriodo: "319", pedidosPeriodo: "4", ventaHoy: 0, pedidosHoy: 0,
    });
    expect(result.ventaPeriodo).toBe(319);
    expect(result.pedidosPeriodo).toBe(4);
  });

  it("respeta ceros explicitos del periodo", () => {
    const result = normalizeOrdersKpis({
      ventaPeriodo: 0, pedidosPeriodo: 0, ventaHoy: 100, pedidosHoy: 1,
    });
    expect(result.ventaPeriodo).toBe(0);
    expect(result.pedidosPeriodo).toBe(0);
  });

  it("usa cero si falta el periodo, sin sustituirlo por los valores diarios", () => {
    expect(normalizeOrdersKpis({ ventaHoy: 100, pedidosHoy: 1 })).toMatchObject({
      ventaPeriodo: 0, pedidosPeriodo: 0, ventaHoy: 100, pedidosHoy: 1,
    });
    expect(normalizeOrdersKpis(null, 3)).toMatchObject({
      ventaPeriodo: 0, pedidosPeriodo: 0, sinImprimir: 3,
    });
  });
});
