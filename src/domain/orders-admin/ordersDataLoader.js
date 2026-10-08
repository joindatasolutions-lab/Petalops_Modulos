import { applyDeliveryGiftOverridesToItems } from "./deliveryGiftOverrides.js";
import { normalizeOrdersKpis } from "./ordersKpis.js";
import {
  extractOrdersPayloadItems, filterOrdersByCreatedDateRange, filterOrdersByPaymentMethod,
  filterOrdersByStatus, localDateEndParam,
  localDateStartParam, normalizePedidosViewStatus, resolveOrdersPayloadTotal,
} from "./ordersDomain.js";

export function normalizeOrdersQuery(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 64);
}

export function effectiveOrdersFilters(filters, q) {
  q = normalizeOrdersQuery(q);
  const searching = Boolean(String(q || "").trim());
  return {
    ...filters, q,
    estado: searching ? "" : filters.estado,
    metodoPago: searching ? "" : filters.metodoPago,
    soloTienda: searching ? false : filters.soloTienda,
    sinImprimir: searching ? false : filters.sinImprimir,
    fechaDesde: searching ? "" : filters.fechaDesde,
    fechaHasta: searching ? "" : filters.fechaHasta,
    soloEntregasHoy: searching ? false : filters.soloEntregasHoy,
    filtrarPorEntrega: searching ? false : filters.filtrarPorEntrega,
  };
}

// Text search is filtered and paginated by the API; only payment filtering is local.
export async function fetchOrdersPage(api, filters, signal) {
  filters = effectiveOrdersFilters(filters, filters.q);
  const paginateLocally = Boolean(filters.metodoPago);
  const pageSize = Number(filters.pageSize || 10);
  const requestedPage = Number(filters.page || 1);
  const query = {
    ...filters,
    fechaDesde: localDateStartParam(filters.fechaDesde),
    fechaHasta: localDateEndParam(filters.fechaHasta),
    ordenConsecutivo: true, page: paginateLocally ? 1 : requestedPage,
    pageSize: paginateLocally ? 100 : pageSize, signal,
  };
  signal.throwIfAborted();
  const data = await api.listarPedidos(query);
  signal.throwIfAborted();
  const candidates = [...extractOrdersPayloadItems(data)];
  if (paginateLocally) {
    const candidateTotal = resolveOrdersPayloadTotal(data, candidates);
    for (let page = 2; candidates.length < candidateTotal; page += 1) {
      signal.throwIfAborted();
      const nextData = await api.listarPedidos({ ...query, page });
      signal.throwIfAborted();
      const rows = extractOrdersPayloadItems(nextData);
      if (!rows.length) break;
      candidates.push(...rows);
    }
  }
  const loaded = applyDeliveryGiftOverridesToItems(candidates).map(normalizePedidosViewStatus);
  const byDate = filters.soloTienda || filters.soloEntregasHoy || filters.filtrarPorEntrega
    ? loaded : filterOrdersByCreatedDateRange(loaded, filters.fechaDesde, filters.fechaHasta);
  const byPayment = filterOrdersByPaymentMethod(filterOrdersByStatus(byDate, filters.estado), filters.metodoPago);
  // Preserve server matches, including fields absent from the list response.
  const matching = byPayment;
  const total = paginateLocally || byDate.length !== loaded.length
    ? matching.length : resolveOrdersPayloadTotal(data, matching);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  if (!paginateLocally && page !== requestedPage) return fetchOrdersPage(api, { ...filters, page }, signal);
  return {
    items: paginateLocally ? matching.slice((page - 1) * pageSize, page * pageSize) : matching,
    total, page, pageSize,
    kpis: normalizeOrdersKpis(data?.kpis, Number(data.facturasPendientesImpresion || 0)),
  };
}
