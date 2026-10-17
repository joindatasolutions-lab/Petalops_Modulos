import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../infrastructure/apiClient.js";
import { buildAddDetailProductPayload, buildDetailUpdatePayload } from "../domain/orders-admin/orderPayloadBuilders.js";

afterEach(() => vi.unstubAllGlobals());
const methods = ["actualizarDetallePedidoPipeline", "actualizarFinanzasPedidoPipeline", "agregarDetallePedidoPipeline", "eliminarDetallePedidoPipeline"];

describe("Concurrencia de pedidos", () => {
  it.each(methods)("%s envía la versión leída sin reemplazarla", async method => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 9 }) });
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await api[method]({ pedidoId: 6589, detalleID: 42, productoID: 10, version: 8 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    if (method === "eliminarDetallePedidoPipeline") {
      expect(url).toBe("https://api.test/pedido/6589/detalle/42?version=8");
      expect(options.method).toBe("DELETE");
    } else expect(JSON.parse(options.body).version).toBe(8);
  });

  it.each(methods)("%s bloquea versiones ausentes o inválidas antes de escribir", async method => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    for (const version of [undefined, null, 0, -1, 1.5, "8"]) {
      await expect(api[method]({ pedidoId: 6589, detalleID: 42, version })).rejects.toThrow("pedido");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(methods)("%s conserva el conflicto 409 sin repetir la escritura", async method => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ detail: "El pedido fue modificado por otro usuario" }) });
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await expect(api[method]({ pedidoId: 6589, detalleID: 42, version: 8 })).rejects.toMatchObject({ status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("conserva la versión del detalle al construir edición y adición", () => {
    expect(buildDetailUpdatePayload({ pedidoId: 6589, detalle: { version: 8 }, edit: {}, paymentValidation: {} }).version).toBe(8);
    expect(buildAddDetailProductPayload({ pedidoId: 6589, version: 8, productoID: 10 }).version).toBe(8);
  });
});
