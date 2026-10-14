import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../infrastructure/apiClient.js";

describe("apiClient inventario: arreglos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia los datos comerciales del producto de catalogo", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ idReceta: 10 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => "token-test" });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.crearReceta({
      empresaId: 3,
      nombre: "Bouquet especial",
      descripcion: "24 rosas",
      precioVenta: 120000,
      imagenUrl: "https://example.test/arreglo.jpg",
      capacidadManual: 4,
      codigoProducto: "ARR-024",
      categoria: "Bouquets",
      coleccion: "Madres",
      activo: false,
    });

    const [url, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);

    expect(new URL(url).searchParams.get("empresaID")).toBe("3");
    expect(payload).toMatchObject({
      codigoProducto: "ARR-024",
      categoria: "Bouquets",
      coleccion: "Madres",
      activo: false,
      precioVenta: 120000,
      capacidadManual: 4,
    });
  });
});
