import { afterEach, expect, it, vi } from "vitest";
import { createApiClient } from "../infrastructure/apiClient.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(response) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => response }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", { getItem: () => "test-token" });
  return { api: createApiClient({ apiBaseUrl: "https://api.test" }), fetchMock };
}
it.each(["entregar", "nuevo_intento", "devolver_disponibles"])("resuelve %s usando multipart", async accion => {
  const { api, fetchMock } = setup({ status: "ok", idEntrega: 123, estado: "Asignado" });
  const result = await api.resolverNovedadEntrega({ entregaId: 10, accion, usuarioCambio: "admin", observaciones: "Cliente confirmado", reprogramarPara: "2026-11-11T09:00:00-05:00" });
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.test/domicilios/10/resolver-novedad");
  expect(request.method).toBe("PUT");
  expect(request.body).toBeInstanceOf(FormData);
  expect(request.body.get("accion")).toBe(accion);
  expect(request.body.get("reprogramarPara")).toBe("2026-11-11T09:00:00-05:00");
  expect(result.idEntrega).toBe(123);
});
it("consulta historial paginado y conserva los contadores del servidor", async () => {
  const response = { items: [{ idNovedad: 71, estado: "resuelta" }], abiertas: 2, resueltas: 51, total: 51 };
  const { api, fetchMock } = setup(response);
  expect(await api.listarNovedadesDomicilios({ sucursalId: 3, estado: "resuelta", limite: 50, offset: 50 })).toEqual(response);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.pathname).toBe("/domicilios/novedades");
  expect(Object.fromEntries(url.searchParams)).toEqual({ sucursalID: "3", estado: "resuelta", limite: "50", offset: "50" });
});
