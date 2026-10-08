import { describe, expect, it, vi } from "vitest";
import { fetchOrdersPage } from "../domain/orders-admin/ordersDataLoader.js";
import { filterOrdersBySearch } from "../domain/orders-admin/ordersDomain.js";

const order = {
  numeroPedido: 90,
  cliente: { nombre: "María López", identificacion: "1.023.456.789", telefono: "+57 300-123-4567" },
  entrega: { barrioNombre: "Belén", direccionEntrega: "Calle Olmos" },
  productosDetalle: [{ nombreProducto: "Corazón de rosas" }],
  metodoPago: "Convenio empresarial",
};

describe("Búsqueda general de pedidos", () => {
  it.each(["maria", "belen", "3001234567", "1023456789", "corazon", "convenio", "olmos"])(
    "env?a %s al servidor sin descargar el historial", async q => {
      const api = { listarPedidos: vi.fn(async () => ({ items: [order], total: 10000 })) };
      const result = await fetchOrdersPage(api, { empresaId: 3, sucursalId: 1, q, page: 2, pageSize: 10 }, new AbortController().signal);
      expect(result.items).toEqual([order]);
      expect(result.total).toBe(10000);
      expect(result.page).toBe(2);
      expect(api.listarPedidos).toHaveBeenCalledTimes(1);
      expect(api.listarPedidos).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 3, sucursalId: 1, q, page: 2, pageSize: 10 }));
    },
  );
  it("conserva coincidencias por campos que no vienen en el listado", async () => {
    const row = { numeroPedido: 90, cliente: "Ana" };
    const api = { listarPedidos: vi.fn(async () => ({ items: [row], total: 1 })) };
    const result = await fetchOrdersPage(api, { empresaId: 3, q: "referencia de pago", page: 1, pageSize: 10 }, new AbortController().signal);
    expect(result.items).toEqual([row]);
    expect(result.total).toBe(1);
  });
  it("no oculta una cédula que coincide con otro número de pedido", () => {
    const rows = [{ numeroPedido: 12345 }, { numeroPedido: 99, clienteIdentificacion: "12345" }];
    expect(filterOrdersBySearch(rows, "12345")).toEqual(rows);
  });
  it("no devuelve filas sin coincidencias", () => {
    expect(filterOrdersBySearch([order], "inexistente")).toEqual([]);
  });
});
