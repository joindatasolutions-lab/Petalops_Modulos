import { describe, expect, it, vi } from "vitest";
import { buildOrdersRequestFilters } from "../domain/orders-admin/hooks/useOrdersAdminData.js";
import { createInitialOrdersFilters, updateOrdersFilter } from "../domain/orders-admin/ordersAdminConstants.js";
import { createApiClient } from "../infrastructure/apiClient.js";

describe("Pedidos: inicio y busqueda remota", () => {
  it("calcula Hoy al entrar, incluso si cambia el dia con la app abierta", () => {
    expect(createInitialOrdersFilters("2026-10-07")).toMatchObject({ fechaDesde: "2026-10-07", fechaHasta: "2026-10-07", page: 1, pageSize: 10 });
    expect(createInitialOrdersFilters("2026-10-08").fechaDesde).toBe("2026-10-08");
  });
  it.each(["Ana", "Efectivo", "123", "direccion oculta"])("envia %s sin restricciones de fecha ni estado", async query => {
    const filters = { ...createInitialOrdersFilters("2026-10-07"), estado: "CREADO", soloTienda: true, sinImprimir: true, soloEntregasHoy: true, filtrarPorEntrega: true, metodoPago: "Tarjeta" };
    const request = buildOrdersRequestFilters(updateOrdersFilter(filters, "q", query), query, 3, 2);
    expect(request).toMatchObject({ q: query, empresaId: 3, sucursalId: 2, fechaDesde: "", fechaHasta: "", estado: "", metodoPago: "", soloTienda: false, sinImprimir: false, soloEntregasHoy: false, filtrarPorEntrega: false, pageSize: 10 });
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: [], total: 0 }) }));
    vi.stubGlobal("fetch", fetch);
    try {
      await createApiClient({ apiBaseUrl: "https://api.test" }).listarPedidos(request);
      const url = new URL(fetch.mock.calls[0][0]);
      expect(url.searchParams.get("q")).toBe(query);
      expect(url.searchParams.has("fechaDesde")).toBe(false);
      expect(url.searchParams.get("pageSize")).toBe("10");
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
    expect(buildOrdersRequestFilters(filters, "", 3, 2)).toMatchObject(filters);
  });
});


describe("Busqueda combinada con filtros", () => {
  it("conserva texto y filtros al pasar de todas las fechas al mes y volver", () => {
    let filters = updateOrdersFilter({ ...createInitialOrdersFilters(), estado: "CREADO", page: 4 }, "q", "tata becerra");
    expect(filters).toMatchObject({ q: "tata becerra", fechaDesde: "", fechaHasta: "", estado: "", datePeriod: "todos", page: 1 });
    filters = { ...filters, fechaDesde: "2026-10-01", fechaHasta: "2026-10-31", datePeriod: "mes" };
    filters = updateOrdersFilter(filters, "estado", "APROBADO");
    const request = buildOrdersRequestFilters(filters, filters.q, 3, 2);
    expect(request).toMatchObject({ q: "tata becerra", fechaDesde: "2026-10-01", fechaHasta: "2026-10-31", estado: "APROBADO", empresaId: 3, sucursalId: 2 });
    filters = updateOrdersFilter({ ...filters, page: 3 }, "q", "tata becerra flores");
    expect(filters).toMatchObject({ fechaDesde: "2026-10-01", estado: "APROBADO", page: 1 });
    filters = { ...filters, fechaDesde: "", fechaHasta: "", datePeriod: "todos", soloEntregasHoy: false, page: 1 };
    expect(buildOrdersRequestFilters(filters, filters.q, 3, 2)).toMatchObject({ q: "tata becerra flores", fechaDesde: "", fechaHasta: "", estado: "APROBADO" });
    expect(updateOrdersFilter(filters, "q", "")).toMatchObject({ q: "", estado: "APROBADO", datePeriod: "todos" });
  });
  it("borrar el texto conserva las fechas seleccionadas", () => {
    const filters = { ...createInitialOrdersFilters("2026-10-17"), q: "tata", page: 2 };
    expect(updateOrdersFilter(filters, "q", "")).toMatchObject({ q: "", fechaDesde: "2026-10-17", fechaHasta: "2026-10-17", page: 1 });
  });
});
