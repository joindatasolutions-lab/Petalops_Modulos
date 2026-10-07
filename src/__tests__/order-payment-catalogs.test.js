import { describe, expect, it } from "vitest";
import { loadOrderPaymentCatalogs, mergeOrderPaymentCatalogs } from "../domain/orders-admin/orderPaymentCatalogs.js";

const fields = [
  { codigo: "pedido_metodos_pago", activo: true, opciones: ["Efectivo"] },
  { codigo: "pedido_canal_venta", activo: true, opciones: ["Local"] },
];
const forbidden = () => Promise.reject(new Error("403"));

describe("order payment catalogs with restricted configuration access", () => {
  it("keeps authorized menu options when configuration catalogs fail", async () => {
    const catalog = await loadOrderPaymentCatalogs({
      listarMenuPedidoEmpresa: async () => ({ items: fields }),
      listarMetodosPagoEmpresa: forbidden,
      listarCanalesVentaEmpresa: forbidden,
    }, 7);
    expect(mergeOrderPaymentCatalogs(catalog.fields, catalog)).toEqual(fields);
    expect(catalog.errors).toHaveLength(2);
  });

  it("keeps successful payment results when another request fails and uses detail fields", async () => {
    const catalog = await loadOrderPaymentCatalogs({
      listarMenuPedidoEmpresa: forbidden,
      listarMetodosPagoEmpresa: async ({ empresaId }) => {
        expect(empresaId).toBe(7);
        return { items: [{ nombre: "Tarjeta", activo: true }, { nombre: "Inactivo", activo: false }] };
      },
      listarCanalesVentaEmpresa: forbidden,
    }, 7);
    const merged = mergeOrderPaymentCatalogs(fields, catalog);
    expect(merged[0].opciones).toEqual(["Tarjeta"]);
    expect(merged[1].opciones).toEqual(["Local"]);
  });

  it("does not restore old options when the catalog succeeds with no active methods", () => {
    expect(mergeOrderPaymentCatalogs(fields, { paymentOptions: [] })[0].opciones).toEqual([]);
  });
});
