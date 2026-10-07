import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrdersDataController, ORDERS_CACHE_FRESH_MS } from "../domain/orders-admin/ordersDataController.js";
import { initialFilters } from "../domain/orders-admin/ordersAdminConstants.js";
import { buildOrdersCacheKey } from "../domain/orders-admin/ordersCache.js";

const filters = { ...initialFilters, empresaId: 3, sucursalId: 1 };
const payload = id => ({ items: [{ pedidoID: id, numeroPedido: id, estado: "APROBADO" }], total: 1, kpis: { pedidosHoy: 7 } });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Pedidos: coordinación de consultas", () => {
  it("no consulta la página reiniciada con texto anterior durante el debounce ni por polling", async () => {
    const api = { listarPedidos: vi.fn(async () => ({ items: Array.from({ length: 30 }, (_, i) => ({ pedidoID: i + 1, cliente: "rosas orquideas" })), total: 30 })) };
    const controller = createOrdersDataController(api);
    await controller.loadWhenSettled({ ...filters, page: 3, q: "rosas" }, "rosas");
    await controller.loadWhenSettled({ ...filters, page: 1, q: "orquideas" }, "rosas");
    await controller.loadWhenSettled({ ...filters, page: 1, q: "orquideas" }, "rosas", { silent: true });
    expect(api.listarPedidos).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().page).toBe(3);
    await controller.loadWhenSettled({ ...filters, page: 1, q: "orquideas" }, "orquideas");
    expect(api.listarPedidos).toHaveBeenCalledTimes(2);
    expect(api.listarPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ q: "", page: 1 }));
    expect(controller.getSnapshot().page).toBe(1);
  });
  it("normaliza el texto igual que el API y reutiliza la misma caché", async () => {
    const api = { listarPedidos: vi.fn(async () => payload(1)) };
    const controller = createOrdersDataController(api);
    await controller.loadWhenSettled({ ...filters, q: "  rosas   rojas  " }, "rosas rojas");
    await controller.loadWhenSettled({ ...filters, q: "rosas rojas" }, "rosas rojas");
    expect(api.listarPedidos).toHaveBeenCalledTimes(1);
    expect(api.listarPedidos).toHaveBeenCalledWith(expect.objectContaining({ q: "" }));
  });
  it("mantiene coincidencias del servidor por dirección junto con su contador", async () => {
    const api = { listarPedidos: vi.fn(async () => ({ items: [{ pedidoID: 1, estado: "APROBADO", direccionEntrega: "Sector Olmos" }], total: 1 })) };
    const controller = createOrdersDataController(api);
    await controller.loadWhenSettled({ ...filters, q: "Olmos" }, "Olmos");
    expect(controller.getSnapshot().items).toHaveLength(1);
    expect(controller.getSnapshot().total).toBe(1);
  });
  it("no confunde claves con separadores dentro del texto", () => {
    expect(buildOrdersCacheKey({ ...filters, q: "x|y", estado: "z" }))
      .not.toBe(buildOrdersCacheKey({ ...filters, q: "x", estado: "y|z" }));
  });
  it("invalida también las otras combinaciones de filtros después de guardar", async () => {
    const api = { listarPedidos: vi.fn(async () => payload(1)) };
    const controller = createOrdersDataController(api);
    const store = { ...filters, soloTienda: true };
    await controller.load(filters); await controller.load(store);
    controller.invalidate();
    await controller.load(filters); await controller.load(store);
    expect(api.listarPedidos).toHaveBeenCalledTimes(4);
  });
  it("conserva el aviso y los resultados durante el reintento y limpia el error al recuperar", async () => {
    const retry = deferred();
    const api = { listarPedidos: vi.fn().mockResolvedValueOnce(payload(1))
      .mockRejectedValueOnce(Error("offline")).mockReturnValueOnce(retry.promise) };
    const controller = createOrdersDataController(api);
    await controller.load(filters);
    await controller.load(filters, { silent: true });
    const failed = controller.getSnapshot();
    controller.invalidate();
    const request = controller.load(filters);
    expect(controller.getSnapshot().error).toBe(failed.error);
    expect(controller.getSnapshot().items).toBe(failed.items);
    expect(controller.getSnapshot().page).toBe(failed.page);
    expect(controller.getSnapshot().loading).toBe(true);
    retry.resolve(payload(2)); await request;
    expect(controller.getSnapshot().error).toBe("");
    expect(controller.getSnapshot().items[0].pedidoID).toBe(2);
    expect(controller.getSnapshot().loading).toBe(false);
  });
  it("reutiliza un refresco en curso sin crear otra solicitud", async () => {
    const pending = deferred();
    const api = { listarPedidos: vi.fn(() => pending.promise) };
    const controller = createOrdersDataController(api);
    const first = controller.load(filters, { silent: true });
    const second = controller.load(filters, { silent: true });
    expect(second).toBe(first);
    expect(api.listarPedidos).toHaveBeenCalledTimes(1);
    pending.resolve(payload(1)); await first;
    expect(controller.getSnapshot().loading).toBe(false);
  });
  it("cancela filtros anteriores e ignora la respuesta aunque el transporte no respete abort", async () => {
    const old = deferred(), latest = deferred();
    const api = { listarPedidos: vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise) };
    const controller = createOrdersDataController(api);
    const first = controller.load(filters);
    const second = controller.load({ ...filters, soloTienda: true });
    expect(api.listarPedidos.mock.calls[0][0].signal.aborted).toBe(true);
    latest.resolve(payload(2)); await second;
    old.resolve(payload(1)); await first;
    expect(controller.getSnapshot().items[0].pedidoID).toBe(2);
  });
  it("conserva filas, totales y KPI después de un error silencioso", async () => {
    const api = { listarPedidos: vi.fn().mockResolvedValueOnce(payload(1)).mockRejectedValueOnce(new TypeError("offline")) };
    const controller = createOrdersDataController(api);
    await controller.load(filters);
    const before = controller.getSnapshot();
    await controller.load(filters, { silent: true });
    const after = controller.getSnapshot();
    expect(after.items).toBe(before.items);
    expect(after.kpis).toBe(before.kpis);
    expect(after.total).toBe(1);
    expect(after.error).toContain("Se conservan");
    expect(after.loading).toBe(false);
  });
  it("mantiene la página confirmada mientras llega la siguiente o falla", async () => {
    const pending = deferred();
    const api = { listarPedidos: vi.fn().mockResolvedValueOnce({ ...payload(1), total: 50 }).mockReturnValueOnce(pending.promise) };
    const controller = createOrdersDataController(api);
    await controller.load(filters);
    const next = controller.load({ ...filters, page: 2 });
    expect(controller.getSnapshot().page).toBe(1);
    pending.reject(Error("offline")); await next;
    expect(controller.getSnapshot().page).toBe(1);
  });
  it("reutiliza caché fresca, revalida al vencer e informa errores de revalidación", async () => {
    let time = 100;
    const api = { listarPedidos: vi.fn().mockResolvedValueOnce(payload(1)).mockRejectedValueOnce(Error("offline")) };
    const controller = createOrdersDataController(api, { now: () => time });
    await controller.load(filters); await controller.load(filters);
    expect(api.listarPedidos).toHaveBeenCalledTimes(1);
    time += ORDERS_CACHE_FRESH_MS;
    await controller.load(filters);
    expect(api.listarPedidos).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().error).toContain("Se conservan");
  });
  it("una mutación invalida todas las páginas y las respuestas previas", async () => {
    const pending = deferred();
    const api = { listarPedidos: vi.fn().mockResolvedValueOnce(payload(1)).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(payload(3)) };
    const controller = createOrdersDataController(api);
    await controller.load(filters);
    const poll = controller.load(filters, { silent: true });
    controller.invalidate();
    await controller.load(filters);
    pending.resolve(payload(2)); await poll;
    expect(api.listarPedidos).toHaveBeenCalledTimes(3);
    expect(controller.getSnapshot().items[0].pedidoID).toBe(3);
  });
  it("no continúa recorriendo páginas canceladas", async () => {
    const pending = deferred();
    const api = { listarPedidos: vi.fn(() => pending.promise) };
    const controller = createOrdersDataController(api);
    const request = controller.load({ ...filters, metodoPago: "Efectivo" });
    controller.cancel();
    pending.resolve({ items: payload(1).items, total: 10000 }); await request;
    expect(api.listarPedidos).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().hasLoaded).toBe(false);
  });
  it("corrige páginas fuera del total sin dejar un listado vacío", async () => {
    const api = { listarPedidos: vi.fn(async ({ page }) => ({ items: page === 1 ? payload(1).items : [], total: 1 })) };
    const controller = createOrdersDataController(api);
    await controller.load({ ...filters, page: 5 });
    expect(controller.getSnapshot().page).toBe(1);
    expect(controller.getSnapshot().items).toHaveLength(1);
    expect(api.listarPedidos).toHaveBeenCalledTimes(2);
  });
  it("el timeout termina la carga sin borrar los resultados", async () => {
    vi.useFakeTimers();
    const api = { listarPedidos: vi.fn().mockResolvedValueOnce(payload(1)).mockImplementationOnce(({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))) };
    const controller = createOrdersDataController(api, { timeoutMs: 100 });
    await controller.load(filters);
    const request = controller.load(filters, { silent: true });
    await vi.advanceTimersByTimeAsync(100); await request;
    expect(controller.getSnapshot().items).toHaveLength(1);
    expect(controller.getSnapshot().error).toContain("tardó demasiado");
    expect(controller.getSnapshot().loading).toBe(false);
  });
  it.each([100, 500, 1000, 5000, 10000])("acota filas y reutiliza una consulta de %i candidatos", async count => {
    const rows = Array.from({ length: count }, (_, i) => ({ pedidoID: i + 1, estado: "APROBADO", metodoPago: "Efectivo" }));
    const getItem = vi.fn(() => "{}");
    vi.stubGlobal("localStorage", { getItem });
    const api = { listarPedidos: vi.fn(async ({ page, pageSize }) => ({ items: rows.slice((page - 1) * pageSize, page * pageSize), total: count })) };
    const controller = createOrdersDataController(api);
    const payment = { ...filters, metodoPago: "Efectivo" };
    await controller.load(payment); await controller.load(payment);
    expect(api.listarPedidos).toHaveBeenCalledTimes(Math.ceil(count / 100));
    expect(controller.getSnapshot().items).toHaveLength(10);
    expect(getItem).toHaveBeenCalledTimes(1);
  });
});
