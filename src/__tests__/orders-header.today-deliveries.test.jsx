import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OrdersHeader } from "../domain/orders-admin/components/OrdersHeader.jsx";
import { toggleTodayDeliveriesFilters } from "../domain/orders-admin/ordersDomain.js";

function renderHeader(soloEntregasHoy) {
  return renderToStaticMarkup(
    <OrdersHeader
      filters={{ q: "", soloTienda: false, soloEntregasHoy }}
      metricCards={[]}
      activeMetric=""
      headerSalesSummary={0}
      onFilterChange={vi.fn()}
      onToggleTodayDeliveries={vi.fn()}
      onToggleStoreDeliveries={vi.fn()}
      onRefresh={vi.fn()}
      onNewOrder={vi.fn()}
      onFocusMetric={vi.fn()}
    />,
  );
}

describe("OrdersHeader entregas de hoy", () => {
  it("muestra la accion Entregas hoy cuando el filtro esta inactivo", () => {
    const html = renderHeader(false);

    expect(html).toContain("Entregas hoy");
    expect(html).toContain('title="Ver entregas de hoy"');
  });

  it("permite volver a todos los pedidos cuando el filtro esta activo", () => {
    const html = renderHeader(true);

    expect(html).toContain("Todos los pedidos");
    expect(html).toContain('title="Ver todos los pedidos"');
    expect(html).toContain("orders-today-toggle is-active");
  });

  it("restaura el filtro Hoy al volver a todos los pedidos", () => {
    const active = toggleTodayDeliveriesFilters(
      { soloEntregasHoy: false, soloTienda: true, fechaDesde: "2026-09-01", fechaHasta: "2026-09-30", page: 4 },
      "2026-09-13",
    );
    const restored = toggleTodayDeliveriesFilters(active, "2026-09-13");

    expect(active).toMatchObject({
      soloEntregasHoy: true,
      soloTienda: false,
      fechaDesde: "",
      fechaHasta: "",
      page: 1,
    });
    expect(restored).toMatchObject({
      soloEntregasHoy: false,
      soloTienda: false,
      fechaDesde: "2026-09-13",
      fechaHasta: "2026-09-13",
      page: 1,
    });
  });
});
