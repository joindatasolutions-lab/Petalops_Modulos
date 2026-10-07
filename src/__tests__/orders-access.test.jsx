import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasModuleAccess } from "../shared/moduleAccess.js";
import { OrderListRow } from "../domain/orders-admin/components/OrderListRow.jsx";
import { OrderDetailCustomerSection } from "../domain/orders-admin/components/OrderDetailEditorParts.jsx";
import { NewOrderModal } from "../domain/orders-admin/components/NewOrderModal.jsx";
import { DEFAULT_NEW_ORDER_FORM } from "../domain/orders-admin/ordersAdminConstants.js";
import { buildQuickSaleOrderPayload } from "../domain/orders-admin/orderPayloadBuilders.js";
import { createApiClient } from "../infrastructure/apiClient.js";

const session = { rol: "Ventas", empresaID: 7, modulosActivosPlan: ["pedidos"], permisos: [
  { modulo: "pedidos", puedeVer: true, puedeCrear: true, puedeEditar: true, puedeEliminar: true },
] };
const row = (estado, currentSession = session) => renderToStaticMarkup(<OrderListRow
  item={{ pedidoID: 1, estado }} session={currentSession} empresaId={7} openOrderActionsId={1}
/>);
const cancelButton = html => html.match(/<button[^>]*class="is-cancel"[^>]*>/)?.[0];

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("operaciones con acceso a Pedidos", () => {
  it("permite cancelar aprobados sin rol administrador y respeta estados cerrados", () => {
    expect(cancelButton(row("APROBADO"))).not.toContain("disabled");
    expect(cancelButton(row("CREADO"))).not.toContain("disabled");
    expect(cancelButton(row("ENTREGADO"))).toContain("disabled");
    expect(cancelButton(row("CANCELADO"))).toContain("disabled");
  });
  it("deniega acceso sin puedeVer o sin modulo en el plan aunque tenga otros permisos", () => {
    for (const denied of [null, { ...session, modulosActivosPlan: [] }, {
      ...session, permisos: [{ ...session.permisos[0], puedeVer: false }],
    }]) {
      expect(hasModuleAccess(denied, "pedidos")).toBe(false);
      expect(cancelButton(row("APROBADO", denied))).toContain("disabled");
    }
  });
  it("habilita nombre y telefono del cliente para ventas", () => {
    const html = renderToStaticMarkup(<OrderDetailCustomerSection nombre="Cliente" telefono="3001234567"
      email="" tipoIdentificacion="CC" identificacion="" canEditClientIdentity={hasModuleAccess(session, "pedidos")} />);
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("administrador");
  });
  it("muestra pago, canal y Guardar y entregar en la venta por unidad", () => {
    const html = renderToStaticMarkup(<NewOrderModal form={{ ...DEFAULT_NEW_ORDER_FORM, ventaRapida: true }}
      normalizeDeliveryType={() => ""} paymentFieldConfig={{ titulo: "Metodo de pago" }}
      paymentFieldOptions={["Efectivo"]} salesChannelFieldConfig={{ titulo: "Canal", opciones: ["Local"] }} />);
    expect(html).toContain('value="Efectivo"');
    expect(html).toContain('value="Local"');
    expect(html).toContain("Guardar y entregar");
  });
  it("conserva permisos de la respuesta de sesion y envia la venta al backend", async () => {
    const fetchMock = vi.fn(async url => ({ ok: true, json: async () => url.endsWith('/auth/me') ? session : { pedidoID: 42, estado: "ENTREGADO" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => "session-token" });
    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    expect((await api.me()).permisos).toEqual(session.permisos);
    const form = { ventaRapidaItems: [{ inventarioID: 5, cantidad: 1, precioUnitario: 10000 }], metodoPago: "Efectivo", canalFlora: "Local" };
    expect(() => buildQuickSaleOrderPayload({ form: { ...form, metodoPago: "" }, empresaId: 7, sucursalId: 2 })).toThrow("obligatorio");
    const payload = buildQuickSaleOrderPayload({ form, empresaId: 7, sucursalId: 2 });
    expect(await api.crearPedidoVentaRapida(payload)).toMatchObject({ estado: "ENTREGADO" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ empresaID: 7, metodoPago: "Efectivo", canalFlora: "Local" });
  });
  it("muestra el mensaje estructurado del backend para operaciones rechazadas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ detail: { code: "FORBIDDEN", message: "Sin acceso a pedidos" } }) })));
    const api = createApiClient({ apiBaseUrl: "https://api.test" });
    await expect(api.crearPedidoVentaRapida({})).rejects.toMatchObject({ status: 403, detail: "Sin acceso a pedidos", code: "FORBIDDEN" });
  });
});
