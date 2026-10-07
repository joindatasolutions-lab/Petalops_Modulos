import { describe, expect, it } from "vitest";
import { ordersMetricPeriod } from "../domain/orders-admin/components/OrdersHeader.jsx";
import { todayIsoDate } from "../domain/orders-admin/ordersDomain.js";

describe("Período visible de KPI", () => {
  it("distingue hoy de una fecha histórica y de un rango", () => {
    const today = todayIsoDate();
    expect(ordersMetricPeriod({ fechaDesde: today, fechaHasta: today })).toBe("Hoy");
    expect(ordersMetricPeriod({ fechaDesde: "2020-01-02", fechaHasta: "2020-01-02" })).toBe("02/01/2020");
    expect(ordersMetricPeriod({ fechaDesde: "2020-01-02", fechaHasta: "2020-01-05" })).toBe("02/01/2020 – 05/01/2020");
  });
  it("describe fechas abiertas y la prioridad de búsqueda", () => {
    expect(ordersMetricPeriod({})).toBe("Todas las fechas");
    expect(ordersMetricPeriod({ fechaDesde: "2020-01-02" })).toBe("Desde 02/01/2020");
    expect(ordersMetricPeriod({ fechaHasta: "2020-01-02" })).toBe("Hasta 02/01/2020");
    expect(ordersMetricPeriod({ q: "rosa", soloEntregasHoy: true })).toBe("Todas las fechas · búsqueda activa");
    expect(ordersMetricPeriod({ soloEntregasHoy: true })).toBe("Hoy");
  });
});
