import { describe, expect, it, vi } from "vitest";
import { createOrdersDataController } from "../domain/orders-admin/ordersDataController.js";
import { effectiveOrdersFilters } from "../domain/orders-admin/ordersDataLoader.js";
import { initialFilters } from "../domain/orders-admin/ordersAdminConstants.js";

function useOrdersAdminData({ api, empresaId, sucursalId, filters, debouncedQuery }) {
  const controller = createOrdersDataController(api);
  return { loadOrders: () => controller.load(effectiveOrdersFilters({ ...filters, empresaId, sucursalId }, debouncedQuery)) };
}

const filters = {
  fechaDesde: "2026-09-26",
  fechaHasta: "2026-09-26",
  page: 1,
  pageSize: 50,
};
const historicalOrder = {
  numeroPedido: 123,
  estado: "APROBADO",
  fecha_pedido: "2026-08-01 10:00:00",
  productosDetalle: [{ nombreProducto: "Virgen Guadalupe" }],
};

function setup(query, overrides = {}) {
  const api = { listarPedidos: vi.fn(async () => ({ items: [historicalOrder], total: 1 })) };
  const hook = useOrdersAdminData({
    api, empresaId: 3, sucursalId: 1,
    filters: { ...filters, ...overrides }, debouncedQuery: query,
  });
  return { api, hook };
}

describe("Pedidos: busqueda independiente de fechas", () => {
  it("ignora todos los filtros al buscar y los recupera al borrar el texto", async () => {
    const selected = {
      ...filters, empresaId: 3, sucursalId: 1, estado: "CREADO", metodoPago: "Efectivo",
      soloTienda: true, sinImprimir: true, soloEntregasHoy: true, filtrarPorEntrega: true,
    };
    const original = { ...selected };
    const api = { listarPedidos: vi.fn(async () => ({ items: [historicalOrder], total: 1 })) };
    const controller = createOrdersDataController(api);
    const result = await controller.loadWhenSettled({ ...selected, q: "virgen" }, "virgen");
    expect(result.items).toEqual([historicalOrder]);
    expect(api.listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({
      empresaId: 3, sucursalId: 1, estado: "", metodoPago: "", fechaDesde: "", fechaHasta: "",
      soloTienda: false, sinImprimir: false, soloEntregasHoy: false, filtrarPorEntrega: false,
    }));
    await controller.loadWhenSettled({ ...selected, q: "" }, "");
    expect(api.listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({
      ...selected, q: "", pageSize: 100,
      fechaDesde: "2026-09-26 00:00:00", fechaHasta: "2026-09-26 23:59:59",
    }));
    expect(selected).toEqual(original);
  });
  it.each([false, true])("consulta el tipo de fecha elegido: entrega=%s", async filtrarPorEntrega => {
    const { api, hook } = setup("", { filtrarPorEntrega });
    const result = await hook.loadOrders();
    expect(api.listarPedidos).toHaveBeenCalledWith(expect.objectContaining({
      filtrarPorEntrega, fechaDesde: "2026-09-26 00:00:00", fechaHasta: "2026-09-26 23:59:59",
    }));
    expect(result.items).toHaveLength(filtrarPorEntrega ? 1 : 0);
  });
  it("filtra por pago antes de paginar, incluyendo coincidencias de otras paginas", async () => {
    const api = { listarPedidos: vi.fn(async ({ page }) => page === 1
      ? { items: [{ ...historicalOrder, numeroPedido: 3, metodoPago: "Efectivo" }], total: 3 }
      : { items: [{ ...historicalOrder, numeroPedido: 2, metodoPago: "Transferencia" }, { ...historicalOrder, numeroPedido: 1, metodoPago: "Transferencia" }], total: 3 }) };
    const hook = useOrdersAdminData({ api, empresaId: 3, sucursalId: 1, debouncedQuery: "",
      filters: { ...initialFilters, metodoPago: "Transferencia", page: 2, pageSize: 1 } });
    const result = await hook.loadOrders();
    expect(result.total).toBe(2);
    expect(result.items.map(item => item.numeroPedido)).toEqual([1]);
    expect(api.listarPedidos).toHaveBeenCalledTimes(2);
  });
  it("abre sin fechas y solicita consecutivos descendentes al servidor", async () => {
    expect(initialFilters.fechaDesde).toBe("");
    expect(initialFilters.fechaHasta).toBe("");
    const { api, hook } = setup("", initialFilters);
    expect((await hook.loadOrders()).items).toHaveLength(1);
    expect(api.listarPedidos).toHaveBeenCalledWith(expect.objectContaining({
      fechaDesde: "", fechaHasta: "", ordenConsecutivo: true, page: 1,
    }));
  });
  it("la busqueda tiene prioridad sobre el estado seleccionado", async () => {
    const approved = setup("virgen", { estado: "APROBADO" });
    expect((await approved.hook.loadOrders()).items).toHaveLength(1);
    expect(approved.api.listarPedidos).toHaveBeenCalledWith(expect.objectContaining({
      estado: "", q: "", fechaDesde: "", fechaHasta: "",
    }));
    const pending = setup("virgen", { estado: "CREADO" });
    expect((await pending.hook.loadOrders()).items).toHaveLength(1);
  });
  it.each([{}, { soloTienda: true }, { soloEntregasHoy: true, filtrarPorEntrega: true }])(
    "encuentra virgen fuera del rango seleccionado con %j, tambien al recargar cache",
    async overrides => {
      const { api, hook } = setup("virgen", overrides);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await hook.loadOrders();
        expect(result.items).toHaveLength(1);
        expect(result.items[0].numeroPedido).toBe(123);
      }
      expect(api.listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({
        empresaId: 3, sucursalId: 1, q: "",
        fechaDesde: "", fechaHasta: "", soloEntregasHoy: false, filtrarPorEntrega: false,
      }));
    }
  );

  it.each(["", "   "])("aplica el rango cuando no hay texto: %j", async query => {
    const { api, hook } = setup(query);
    const result = await hook.loadOrders();
    expect(result.items).toEqual([]);
    expect(api.listarPedidos).toHaveBeenCalledWith(expect.objectContaining({
      fechaDesde: "2026-09-26 00:00:00", fechaHasta: "2026-09-26 23:59:59",
    }));
  });
});
