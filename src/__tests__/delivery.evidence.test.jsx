import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDeliveryEvidenceSummary } from "../domain/delivery/DeliveryPage.jsx";
import { deliveryEvidenceErrorMessage, loadDeliveryEvidence } from "../domain/delivery/deliveryEvidence.js";
import { AUTH_EXPIRED_EVENT, createApiClient } from "../infrastructure/apiClient.js";

const pedido = {
  id_pedido: 42, numero_pedido: 100117,
  evidencia_entrega_url: "https://example.test/foto.png",
  evidencia_firma_url: "https://example.test/firma.png",
  firma_nombre: "Receptor de prueba", firma_documento: "123456", observaciones: "Entregado",
};
const scope = { empresaId: 3, sucursalId: 3 };
afterEach(() => vi.unstubAllGlobals());

describe("Evidencias de entrega", () => {
  it("mapea dos evidencias y los datos del receptor del historial", () => {
    const summary = buildDeliveryEvidenceSummary(pedido);
    expect(summary.evidences.map(record => record.url)).toEqual([pedido.evidencia_entrega_url, pedido.evidencia_firma_url]);
    expect(summary).toMatchObject({ order: "100117", receivedBy: "Receptor de prueba", receivedDocument: "123456", observations: "Entregado" });
  });
  it.each([[null, pedido.evidencia_firma_url, 1], [pedido.evidencia_entrega_url, " ", 1], [" ", null, 0], [pedido.evidencia_firma_url, pedido.evidencia_firma_url, 2]])("cuenta foto y firma por separado (%s, %s)", (photo, signature, count) => {
    expect(buildDeliveryEvidenceSummary({ ...pedido, evidencia_entrega_url: photo, evidencia_firma_url: signature, firma: "https://example.test/antigua.png" }).evidences).toHaveLength(count);
  });
  it.each(["https://api.test", "https://api.test/api/v1"])("consulta evidencias desde %s por número con sesión y contexto", async apiBaseUrl => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => pedido }));
    vi.stubGlobal("localStorage", { getItem: key => key === "petalops_access_token" ? "test-session" : null });
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ apiBaseUrl });
    expect(await loadDeliveryEvidence(api, { pedidoID: 42, numeroPedido: 100117 }, scope)).toEqual(pedido);
    await loadDeliveryEvidence(api, { pedidoID: 42, numeroPedido: 100117 }, scope);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`${apiBaseUrl}/domicilios/pedidos/100117/evidencias?empresaID=3&sucursalID=3`);
    expect(options.headers.Authorization).toBe("Bearer test-session");
    expect(options.method || "GET").toBe("GET");
    expect(options.cache).toBe("no-store");
  });
  it.each([null, {}, { items: [pedido] }, { ...pedido, numero_pedido: 100118 }, { numero_pedido: 100117 }, { ...pedido, evidencia_firma_url: 123 }])("no confunde una respuesta inválida con ausencia de evidencias", async payload => {
    const api = { obtenerEvidenciasDomicilio: vi.fn().mockResolvedValue(payload) };
    await expect(loadDeliveryEvidence(api, pedido, scope)).rejects.toThrow();
  });
  it("propaga los errores de consulta", async () => {
    const api = { obtenerEvidenciasDomicilio: vi.fn().mockRejectedValue(new Error("Sin conexión")) };
    await expect(loadDeliveryEvidence(api, pedido, scope)).rejects.toThrow("Sin conexión");
  });
  it("acepta ambas URLs vacías cuando la consulta es válida", async () => {
    const empty = { ...pedido, evidencia_entrega_url: null, evidencia_firma_url: null };
    const api = { obtenerEvidenciasDomicilio: vi.fn().mockResolvedValue(empty) };
    expect(buildDeliveryEvidenceSummary(await loadDeliveryEvidence(api, pedido, scope)).evidences).toEqual([]);
  });
  it("no consulta por ID interno cuando falta el número", async () => {
    const api = { obtenerEvidenciasDomicilio: vi.fn() };
    await expect(loadDeliveryEvidence(api, { id_pedido: 6589 }, scope)).rejects.toThrow("número");
    expect(api.obtenerEvidenciasDomicilio).not.toHaveBeenCalled();
  });
  it.each([[401, "Inicia sesión"], [403, "No tienes permisos"], [404, "Pedido no encontrado"], [500, "Error al consultar"]])("maneja HTTP %s sin mostrar ausencia de evidencias y permite otra consulta", async (status, message) => {
    const dispatch = vi.fn();
    vi.stubGlobal("dispatchEvent", dispatch);
    vi.stubGlobal("CustomEvent", class { constructor(type, options) { this.type = type; this.detail = options.detail; } });
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status, json: async () => ({ detail: "Error de consulta" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => pedido });
    vi.stubGlobal("fetch", fetch);
    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    const error = await loadDeliveryEvidence(api, pedido, scope).catch(error => error);
    expect(error.status).toBe(status);
    expect(deliveryEvidenceErrorMessage(error)).toContain(message);
    expect(deliveryEvidenceErrorMessage(error)).not.toContain("no tiene evidencias");
    if (status === 401) expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: AUTH_EXPIRED_EVENT }));
    else expect(dispatch).not.toHaveBeenCalled();
    expect(await loadDeliveryEvidence(api, pedido, scope)).toEqual(pedido);
  });
});
