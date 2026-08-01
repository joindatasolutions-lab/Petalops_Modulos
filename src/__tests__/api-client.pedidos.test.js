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

  it("preserva codigo, modulo y request_id en errores estructurados del API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: {
          code: "PIPELINE_INTERNAL_ERROR",
          message: "Error interno del servidor",
          module: "pipeline",
          request_id: "b84befc7-3ecc-4878-b0bd-646dbbaf05f3",
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "token-test",
    });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });

    await expect(api.listarPipelinePedidos({ empresaId: 1 })).rejects.toMatchObject({
      message: "Error interno del servidor (PIPELINE_INTERNAL_ERROR · modulo pipeline · request_id b84befc7-3ecc-4878-b0bd-646dbbaf05f3)",
      detail: "Error interno del servidor",
      code: "PIPELINE_INTERNAL_ERROR",
      module: "pipeline",
      requestId: "b84befc7-3ecc-4878-b0bd-646dbbaf05f3",
      status: 500,
    });
  });

  it("envia celular como criterio explicito al listar clientes", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "token-test",
    });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.listarClientes({
      empresaId: 3,
      celular: "3128896624",
      telefono: "3128896624",
      q: "3128896624",
      soloActivos: true,
    });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/clientes");
    expect(parsed.searchParams.get("empresaID")).toBe("3");
    expect(parsed.searchParams.get("celular")).toBe("3128896624");
    expect(parsed.searchParams.get("telefono")).toBe("3128896624");
    expect(parsed.searchParams.get("q")).toBe("3128896624");
    expect(parsed.searchParams.get("soloActivos")).toBe("true");
  });

  it("envia domicilio obsequiado al actualizar detalle de pedido", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "token-test",
    });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.actualizarDetallePedidoPipeline({
      pedidoId: 77,
      barrioNombre: "El Prado",
      direccion: "Calle 1 #2-3",
      domicilio: 0,
      domicilioOriginal: 15000,
      descuentoDomicilio: 15000,
      domicilioObsequiado: true,
      omitirCostoDomicilio: true,
      forzarRecalculoFinanciero: true,
    });

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe("https://api.test/pedido/77/detalle");
    expect(body.barrioNombre).toBe("El Prado");
    expect(body.direccion).toBe("Calle 1 #2-3");
    expect(body.domicilio).toBe(0);
    expect(body.costoDomicilio).toBe(0);
    expect(body.costo_domicilio).toBe(0);
    expect(body.domicilioOriginal).toBe(15000);
    expect(body.descuentoDomicilio).toBe(15000);
    expect(body.domicilioObsequiado).toBe(true);
    expect(body.omitirCostoDomicilio).toBe(true);
    expect(body.forzarRecalculoFinanciero).toBe(true);
  });

  it("sincroniza finanzas recalculadas antes de generar factura", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "token-test",
    });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.actualizarFinanzasPedidoPipeline({
      pedidoId: 77,
      subtotal: 350000,
      iva: 0,
      domicilio: 8000,
      domicilioOriginal: 8000,
      descuentoDomicilio: 0,
      total: 358000,
      domicilioObsequiado: false,
      omitirCostoDomicilio: false,
    });

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe("https://api.test/pedido/77/detalle");
    expect(options.method).toBe("PUT");
    expect(body.subtotal).toBe(350000);
    expect(body.domicilio).toBe(8000);
    expect(body.costoDomicilio).toBe(8000);
    expect(body.costo_domicilio).toBe(8000);
    expect(body.domicilioOriginal).toBe(8000);
    expect(body.descuentoDomicilio).toBe(0);
    expect(body.total).toBe(358000);
    expect(body.domicilioObsequiado).toBe(false);
    expect(body.omitirCostoDomicilio).toBe(false);
    expect(body.forzarRecalculoFinanciero).toBe(true);
  });

  it("crea nuevo pedido manual usando /pedido/manual", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ pedidoID: 123 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "token-test",
    });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.crearPedidoManual({
      empresaID: 3,
      sucursalID: 3,
      productos: [{ productoID: 123, cantidad: 1, productoPrecio: 90000 }],
      domicilioObsequiado: true,
      omitirCostoDomicilio: true,
      domicilio: 0,
      domicilioOriginal: 15000,
      descuentoDomicilio: 15000,
    });

    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    const body = JSON.parse(options.body);

    expect(parsed.pathname).toBe("/pedido/manual");
    expect(options.method).toBe("POST");
    expect(body.domicilio).toBe(0);
    expect(body.domicilioOriginal).toBe(15000);
    expect(body.descuentoDomicilio).toBe(15000);
    expect(body.domicilioObsequiado).toBe(true);
    expect(body.omitirCostoDomicilio).toBe(true);
  });
});
