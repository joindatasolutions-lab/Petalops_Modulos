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

describe("apiClient inventario: proveedores", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia todos los datos al editar un proveedor", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ idProveedor: 8 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => "token-test" });

    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api.actualizarProveedorInventario({
      empresaId: 4,
      proveedorId: 8,
      nombre: "Proveedor actualizado",
      codigoProveedor: "PROV-08",
      telefono: "3001234567",
      email: "ventas@proveedor.test",
      direccion: "Calle 10",
      activo: false,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/inventario/proveedores/8");
    expect(new URL(url).searchParams.get("empresaID")).toBe("4");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({
      nombre: "Proveedor actualizado",
      codigoProveedor: "PROV-08",
      telefono: "3001234567",
      email: "ventas@proveedor.test",
      direccion: "Calle 10",
      activo: false,
    });
  });
});
