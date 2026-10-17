import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useOrdersAdminData } from "../domain/orders-admin/hooks/useOrdersAdminData.js";
import { OrdersFilters } from "../domain/orders-admin/components/OrdersFilters.jsx";
import { createInitialOrdersFilters, updateOrdersFilter } from "../domain/orders-admin/ordersAdminConstants.js";

function setup(api, filters, debouncedQuery = filters.q) {
  let hook;
  function Harness() { hook = useOrdersAdminData({ api, empresaId: 3, sucursalId: 2, filters, debouncedQuery }); return null; }
  renderToStaticMarkup(<Harness />);
  return hook;
}

describe("Buscador prioritario y panel de fechas", () => {
  it("envia texto y fechas juntos y conserva total y KPI al cambiar de pagina", async () => {
    const api = { listarPedidos: vi.fn(async ({ page }) => ({
      items: [{ pedidoID: page, cliente: "tata becerra", fechaPedido: "2026-10-02", estado: "APROBADO" }],
      total: 40, kpis: { ventaPeriodo: 500000, pedidosPeriodo: 40 },
    })) };
    const filters = { ...createInitialOrdersFilters(), q: "tata becerra", fechaDesde: "2026-10-01", fechaHasta: "2026-10-31", estado: "APROBADO", datePeriod: "mes" };
    for (const page of [1, 2]) {
      const result = await setup(api, { ...filters, page }).loadOrders();
      expect(result.total).toBe(40);
      expect(result.kpis).toMatchObject({ ventaPeriodo: 500000, pedidosPeriodo: 40 });
      expect(api.listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({
        q: "tata becerra", estado: "APROBADO", page,
        fechaDesde: expect.stringContaining("2026-10-01"), fechaHasta: expect.stringContaining("2026-10-31"),
      }));
    }
  });
  it.each(["Ana", "Calle Olmos", "rosas", "Efectivo", "123"])("mantiene coincidencias de %s fuera de Hoy y de los filtros seleccionados", async q => {
    const row = { pedidoID: 99, cliente: "Ana", fechaPedido: "2025-01-02", estado: "APROBADO" };
    const api = { listarPedidos: vi.fn(async () => ({ items: [row], total: 40 })) };
    const filters = { ...createInitialOrdersFilters("2026-10-07"), q, estado: "CANCELADO", metodoPago: "Tarjeta", soloTienda: true, sinImprimir: true, soloEntregasHoy: true, filtrarPorEntrega: true };
    const result = await setup(api, updateOrdersFilter({ ...filters, q: "" }, "q", q)).loadOrders();
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(40);
    expect(api.listarPedidos).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ q, empresaId: 3, sucursalId: 2, estado: "", fechaDesde: "", fechaHasta: "", soloTienda: false, sinImprimir: false, soloEntregasHoy: false, filtrarPorEntrega: false, pageSize: 10 }));
  });
  it("no consulta con el texto anterior mientras se escribe", async () => {
    const api = { listarPedidos: vi.fn() };
    await setup(api, { ...createInitialOrdersFilters(), q: "Ana" }, "").loadOrders();
    expect(api.listarPedidos).not.toHaveBeenCalled();
  });
  it("restaura los controles de fecha y explica la prioridad del texto", () => {
    const html = renderToStaticMarkup(<OrdersFilters filters={{ ...createInitialOrdersFilters(), q: "Ana" }} />);
    for (const label of ["Fecha de creaci\u00f3n", "Fecha de entrega", "Hoy", "Este mes", "Elegir fechas", "Los filtros se aplican a los resultados de b\u00fasqueda"]) expect(html).toContain(label);
    expect(html).toContain('value="todos"');
  });
});
