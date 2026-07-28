import { ORDERS_FILTER_CACHE_LIMIT } from "./ordersAdminConstants.js";

/**
 * Cache local del listado de pedidos.
 *
 * El cache evita parpadeos cuando el usuario vuelve a filtros recientes. La key
 * debe incluir cualquier campo que cambie el resultado visible.
 */

export function buildOrdersCacheKey({ empresaId, sucursalId, q, estado, sinImprimir, soloTienda, metodoPago, fechaDesde, fechaHasta, page, pageSize }) {
  return [
    empresaId,
    sucursalId,
    q || "",
    estado || "",
    sinImprimir ? "1" : "0",
    soloTienda ? "1" : "0",
    metodoPago || "",
    fechaDesde || "",
    fechaHasta || "",
    page || 1,
    pageSize || 50,
  ].join("|");
}

export function rememberOrdersCache(cache, key, value) {
  if (!cache || !key) return;
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > ORDERS_FILTER_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}
