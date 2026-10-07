import { DEFAULT_ORDERS_KPIS } from "./ordersAdminConstants.js";
import { buildOrdersCacheKey, rememberOrdersCache } from "./ordersCache.js";
import { effectiveOrdersFilters, fetchOrdersPage, normalizeOrdersQuery } from "./ordersDataLoader.js";

export const ORDERS_CACHE_FRESH_MS = 15000;
const REQUEST_TIMEOUT_MS = 60000;

// One owner for committed rows, pagination, cache and in-flight work.
export function createOrdersDataController(api, { now = Date.now, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  let state = { items: [], total: 0, kpis: DEFAULT_ORDERS_KPIS, page: 1, pageSize: 10,
    loading: false, error: "", hasLoaded: false, key: "", updatedAt: null };
  let active = null;
  let generation = 0;
  const cache = new Map();
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const cancel = () => {
    generation += 1;
    if (active) { clearTimeout(active.timer); active.controller.abort(); active = null; }
    if (state.loading) publish({ loading: false });
  };
  const invalidate = () => { cache.clear(); cancel(); };
  const load = (filters, { silent = false, force = false } = {}) => {
    const key = buildOrdersCacheKey(filters);
    if (!force && active?.key === key) return active.promise;
    if (silent && active && !force) return Promise.resolve(undefined);
    cancel();
    const cached = cache.get(key);
    if (cached && !silent && !force) {
      publish({ ...cached, hasLoaded: true, error: "", loading: false });
      if (now() - cached.updatedAt < ORDERS_CACHE_FRESH_MS) return Promise.resolve(cached);
    }
    const id = ++generation;
    const controller = new AbortController();
    const request = { key, controller, promise: null, timer: null };
    active = request;
    // Keep the failure and retry control visible until recovery is confirmed.
    publish({ loading: true });
    let timedOut = false;
    request.timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    request.promise = (async () => {
      try {
        const result = await fetchOrdersPage(api, filters, controller.signal);
        if (id !== generation) return;
        const value = { ...result, key: buildOrdersCacheKey({ ...filters, page: result.page }), updatedAt: now() };
        rememberOrdersCache(cache, value.key, value);
        publish({ ...value, hasLoaded: true, error: "" });
        return value;
      } catch (error) {
        if (id !== generation || (controller.signal.aborted && !timedOut)) return;
        const reason = timedOut ? "La consulta tardó demasiado." : error?.status === 429
          ? "El servidor está ocupado. Espera unos segundos antes de reintentar." : "No fue posible actualizar los pedidos.";
        publish({ error: state.hasLoaded ? `${reason} Se conservan los últimos resultados disponibles.` : reason });
      } finally {
        clearTimeout(request.timer);
        if (active === request) { active = null; publish({ loading: false }); }
      }
    })();
    return request.promise;
  };
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    load, cancel, invalidate,
    loadWhenSettled: (filters, debouncedQuery, options) => {
      if (normalizeOrdersQuery(filters.q) !== normalizeOrdersQuery(debouncedQuery)) {
        cancel();
        return Promise.resolve(undefined);
      }
      return load(effectiveOrdersFilters(filters, debouncedQuery), options);
    },
    setItems: updater => publish({ items: typeof updater === "function" ? updater(state.items) : updater }),
  };
}
