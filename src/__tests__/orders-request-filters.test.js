import { describe, expect, it, vi } from "vitest";
import { buildOrdersRequestFilters } from "../domain/orders-admin/hooks/useOrdersAdminData.js";
import { createInitialOrdersFilters } from "../domain/orders-admin/ordersAdminConstants.js";
import { createApiClient } from "../infrastructure/apiClient.js";

describe("Pedidos: inicio y busqueda remota", () => {
  it("calcula Hoy al entrar, incluso si cambia el dia con la app abierta", () => {
    expect(createInitialOrdersFilters("2026-10-07")).toMatchObject({ fechaDesde: "2026-10-07", fechaHasta: "2026-10-07", page: 1, pageSize: 10 });
    expect(createInitialOrdersFilters("2026-10-08").fechaDesde).toBe("2026-10-08");
  });
  it.each(["Ana", "Efectivo", "123", "direccion oculta"])("envia %s sin restricciones de fecha ni estado", async query => {
    const filters = { ...createInitialOrdersFilters("2026-10-07"), estado: "CREADO", soloTienda: true, sinImprimir: true, soloEntregasHoy: true, filtrarPorEntrega: true, metodoPago: "Tarjeta" };
    const request = buildOrdersRequestFilters(filters, query, 3, 2);
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
