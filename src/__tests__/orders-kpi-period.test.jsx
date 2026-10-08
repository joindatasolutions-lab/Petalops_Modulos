import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrdersHeader, ordersMetricPeriod } from "../domain/orders-admin/components/OrdersHeader.jsx";
import { todayIsoDate } from "../domain/orders-admin/ordersDomain.js";

describe("Período visible de KPI", () => {
  it.each([
    [{ fechaDesde: todayIsoDate(), fechaHasta: todayIsoDate() }, "hoy", "Hoy"],
    [{ fechaDesde: "2026-10-01", fechaHasta: "2026-10-31", datePeriod: "mes" }, "este mes", "01/10/2026 – 31/10/2026"],
    [{ fechaDesde: "2020-01-02", fechaHasta: "2020-01-05", datePeriod: "custom" }, "del período", "02/01/2020 – 05/01/2020"],
    [{ q: "rosa", datePeriod: "mes" }, "del período", "Todas las fechas · búsqueda activa"],
  ])("refleja la consulta en títulos, detalles y accesibilidad: %j", (filters, suffix, period) => {
    const html = renderToStaticMarkup(<OrdersHeader
      filters={filters}
      metricCards={[{ key: "hoy", value: 157, Icon: () => null }]}
      headerSalesSummary={23904057}
    />);
    expect(html).toContain(`Ventas ${suffix}`);
    expect(html).toContain(`Pedidos ${suffix}`);
    expect(html).toContain(`<small>${period} · COP</small>`);
    expect(html).toContain(`aria-label="Pedidos ${suffix}: 157. ${period}"`);
    expect(html).not.toContain("Creados hoy");
    expect(html).not.toContain("corresponden al día actual");
  });
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
