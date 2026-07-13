import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../infrastructure/apiClient.js";

describe("apiClient.listarPedidos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("conserva fechas y limita pageSize para evitar requests 422 en /pedidos", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "token-test",
    });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.listarPedidos({
      empresaId: 3,
      sucursalId: 3,
      fechaDesde: "2026-06-25T00:00:00",
      fechaHasta: "2026-06-25T23:59:59",
      sinImprimir: false,
      page: 1,
      pageSize: 10000,
    });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/pedidos");
    expect(parsed.searchParams.get("fechaDesde")).toBe("2026-06-25T00:00:00");
    expect(parsed.searchParams.get("fechaHasta")).toBe("2026-06-25T23:59:59");
    expect(parsed.searchParams.get("pageSize")).toBe("300");
    expect(parsed.searchParams.get("sinImprimir")).toBe("false");
  });
});
