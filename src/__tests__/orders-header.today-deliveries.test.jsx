import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OrdersHeader } from "../domain/orders-admin/components/OrdersHeader.jsx";

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
});
