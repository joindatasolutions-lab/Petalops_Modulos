import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../infrastructure/apiClient.js";

describe("apiClient caja: correccion de gastos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupApi() {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "ok" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => "token-test" });
    return { api: createApiClient({ apiBaseUrl: "https://api.test" }), fetchMock };
  }

  it("edita un gasto conservando el alcance de empresa y sucursal", async () => {
    const { api, fetchMock } = setupApi();
    await api.actualizarGastoCaja({
      gastoId: 18,
      empresaId: 4,
      sucursalId: 2,
      fecha: "2026-11-11",
      concepto: "Transporte",
      descripcion: "Valor corregido",
      monto: 25000,
      usuarioId: 9,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/contabilidad/caja/gastos/18");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toMatchObject({
      empresaID: 4,
      sucursalID: 2,
      fecha: "2026-11-11",
      concepto: "Transporte",
      monto: 25000,
    });
  });

  it("elimina un gasto enviando el alcance tenant en la URL", async () => {
    const { api, fetchMock } = setupApi();
    await api.eliminarGastoCaja({ gastoId: 18, empresaId: 4, sucursalId: 2 });

    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/contabilidad/caja/gastos/18");
    expect(parsed.searchParams.get("empresaID")).toBe("4");
    expect(parsed.searchParams.get("sucursalID")).toBe("2");
    expect(options.method).toBe("DELETE");
  });

  it("guarda caja menor sin convertir un cierre sin arqueo en conteo fisico", async () => {
    const { api, fetchMock } = setupApi();
    await api.guardarCierreCaja({
      empresaId: 3,
      sucursalId: 3,
      fecha: "2026-11-07",
      base: 60100,
      efectivo: 514000,
      gasto: 22000,
      totalEfectivo: 552100,
      totalContado: null,
      guardado: 500000,
      nuevaBase: 52100,
      observacion: "",
      usuarioId: 9,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/contabilidad/caja/cierre");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toMatchObject({
      empresaID: 3,
      sucursalID: 3,
      totalContado: null,
      guardado: 500000,
      nuevaBase: 52100,
    });
  });
});
