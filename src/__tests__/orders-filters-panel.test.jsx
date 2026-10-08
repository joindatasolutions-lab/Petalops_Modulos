import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrdersFilters } from "../domain/orders-admin/components/OrdersFilters.jsx";
import { initialFilters } from "../domain/orders-admin/ordersAdminConstants.js";

const props = { onFilterChange: vi.fn(), onClearFilters: vi.fn(), onClearDateRange: vi.fn(), onApplyDatePreset: vi.fn() };
describe("Panel de filtros de Pedidos", () => {
  it("abre sin fechas y muestra los filtros disponibles con etiquetas accesibles", () => {
    const html = renderToStaticMarkup(<OrdersFilters {...props} filters={initialFilters} paymentOptions={["Transferencia"]} total={12} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Este Mes");
    expect(html).not.toContain("Todas las fechas");
    expect(html).toContain("12 pedidos encontrados");
    expect(html).toContain("Tipo de fecha");
    expect(html).toContain("Elegir fechas");
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain("of-active");
    expect(html).not.toContain("Ayer");
    expect(html).not.toContain("Zona de entrega");
  });
  it("explica que la busqueda ignora fechas y permite quitar filtros individuales", () => {
    const html = renderToStaticMarkup(<OrdersFilters {...props} filters={{ ...initialFilters, q: "virgen", fechaDesde: "2026-09-26", estado: "APROBADO" }} />);
    expect(html).toContain("La búsqueda tiene prioridad sobre todos los filtros");
    expect(html).toContain('aria-label="Quitar Estado: Aprobados"');
    expect(html).not.toContain('aria-label="Quitar Fecha del pedido');
  });
  it("muestra el rango personalizado sin duplicarlo como chip", () => {
    const html = renderToStaticMarkup(<OrdersFilters {...props} filters={{ ...initialFilters, fechaDesde: "2026-09-01", fechaHasta: "2026-09-12", datePeriod: "custom" }} />);
    expect(html).toContain("01/09/2026 – 12/09/2026");
    expect(html).not.toContain("of-active");
  });
});
