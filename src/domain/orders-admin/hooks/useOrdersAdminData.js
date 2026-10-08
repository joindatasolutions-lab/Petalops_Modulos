import { useCallback, useMemo, useRef, useState } from "react";

import { shiftIsoDate } from "../../../shared/utils.js";
import { DEFAULT_ORDERS_KPIS } from "../ordersAdminConstants.js";
import { buildOrdersCacheKey, rememberOrdersCache } from "../ordersCache.js";
import { normalizeOrdersKpis } from "../ordersKpis.js";
import { applyDeliveryGiftOverrideToItem } from "../deliveryGiftOverrides.js";
import {
  buildOrdersMetrics,
  extractOrdersPayloadItems,
  filterOrdersByCreatedDateRange,
  filterOrdersByPaymentMethod,
  filterOrdersByStatus,
  localDateEndParam,
  localDateStartParam,
  normalizePedidosViewStatus,
  resolveOrdersPayloadTotal,
  todayIsoDate,
} from "../ordersDomain.js";

export function buildOrdersRequestFilters(filters, query, empresaId, sucursalId) {
  const q = String(query || "").replace(/\s+/g, " ").trim().slice(0, 64);
  const searching = Boolean(q);
  return {
    ...filters, empresaId, sucursalId, q,
    estado: searching ? "" : filters.estado,
    metodoPago: searching ? "" : filters.metodoPago,
    sinImprimir: searching ? false : filters.sinImprimir,
    soloTienda: searching ? false : filters.soloTienda,
    soloEntregasHoy: searching ? false : filters.soloEntregasHoy,
    filtrarPorEntrega: searching ? false : filters.filtrarPorEntrega,
    fechaDesde: searching ? "" : filters.fechaDesde,
    fechaHasta: searching ? "" : filters.fechaHasta,
  };
}

/**
 * Hook de datos de Pedidos.
 *
 * Maneja la carga de la lista, cache de filtros, KPI y resumen de venta. La UI
 * solo consume estado y dispara `loadOrders`/`loadTodaySalesSummary`.
 */
export function useOrdersAdminData({
  api,
  empresaId,
  sucursalId,
  filters,
  debouncedQuery,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facturasPendientesImpresion, setFacturasPendientesImpresion] = useState(0);
  const [ordersKpis, setOrdersKpis] = useState(DEFAULT_ORDERS_KPIS);
  const [metricItems, setMetricItems] = useState([]);
  const [metricFacturasPendientesImpresion, setMetricFacturasPendientesImpresion] = useState(0);
  const [yesterdayMetrics, setYesterdayMetrics] = useState(() => buildOrdersMetrics([], 0, shiftIsoDate(todayIsoDate(), -1)));
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const requestTracker = useMemo(() => ({ current: 0 }), []);
  const visibleLoadingRequest = useRef(0);
  const filterCache = useMemo(() => new Map(), []);

  const clearCache = useCallback(() => {
    filterCache.clear();
  }, [filterCache]);

  const loadOrders = useCallback(async (silent = false) => {
    // Invalidate old responses as soon as typing starts, including background refreshes.
    if (String(filters.q || "").trim() !== String(debouncedQuery || "").trim()) {
      requestTracker.current += 1;
      visibleLoadingRequest.current = 0;
      setLoading(true);
      return;
    }
    if (silent && visibleLoadingRequest.current) return;

    const requestId = silent ? requestTracker.current : requestTracker.current + 1;
    if (!silent) {
      requestTracker.current = requestId;
    }
    const requestFilters = buildOrdersRequestFilters(filters, debouncedQuery, empresaId, sucursalId);
    const requestFechaDesde = requestFilters.fechaDesde;
    const requestFechaHasta = requestFilters.fechaHasta;
    const cacheKey = buildOrdersCacheKey({
      ...requestFilters,
      fechaDesde: requestFechaDesde,
      fechaHasta: requestFechaHasta,
    });
    const cached = !silent ? filterCache.get(cacheKey) : null;

    const skipCreatedDateRefilter = requestFilters.soloTienda || requestFilters.soloEntregasHoy || requestFilters.filtrarPorEntrega;

    if (cached) {
      const cachedItems = skipCreatedDateRefilter
        ? cached.items
        : filterOrdersByCreatedDateRange(cached.items, requestFechaDesde, requestFechaHasta);
      const cachedMetricItems = skipCreatedDateRefilter
        ? cached.metricItems
        : filterOrdersByCreatedDateRange(cached.metricItems, requestFechaDesde, requestFechaHasta);
      const cachedHadOutOfRangeItems = cachedItems.length !== (Array.isArray(cached.items) ? cached.items.length : 0);
      setItems(cachedItems);
      setTotal(cachedHadOutOfRangeItems ? cachedItems.length : cached.total);
      setFacturasPendientesImpresion(cached.facturasPendientesImpresion);
      setOrdersKpis(cached.kpis || DEFAULT_ORDERS_KPIS);
      setMetricItems(cachedMetricItems);
      setMetricFacturasPendientesImpresion(cached.metricFacturasPendientesImpresion);
      setError("");
      if (!silent) {
        visibleLoadingRequest.current = 0;
        setLoading(false);
      }
    }

    if (!silent && !cached) {
      visibleLoadingRequest.current = requestId;
      setLoading(true);
      setError("");
    }

    try {
      const data = await api.listarPedidos({
        empresaId: requestFilters.empresaId,
        sucursalId: requestFilters.sucursalId,
        q: requestFilters.q,
        estado: requestFilters.estado,
        sinImprimir: requestFilters.sinImprimir,
        soloTienda: requestFilters.soloTienda,
        soloEntregasHoy: requestFilters.soloEntregasHoy,
        fechaDesde: localDateStartParam(requestFechaDesde),
        fechaHasta: localDateEndParam(requestFechaHasta),
        filtrarPorEntrega: requestFilters.filtrarPorEntrega,
        page: requestFilters.page,
        pageSize: requestFilters.pageSize,
      });

      if (!silent && requestId !== requestTracker.current) return;
      if (silent && (requestId !== requestTracker.current || visibleLoadingRequest.current)) return;

      const loadedItems = extractOrdersPayloadItems(data)
        .map(applyDeliveryGiftOverrideToItem)
        .map(normalizePedidosViewStatus);
      const dateItems = skipCreatedDateRefilter
        ? loadedItems
        : filterOrdersByCreatedDateRange(loadedItems, requestFechaDesde, requestFechaHasta);
      const statusItems = filterOrdersByStatus(dateItems, requestFilters.estado);
      const paymentItems = filterOrdersByPaymentMethod(statusItems, requestFilters.metodoPago);
      // The server also searches fields omitted from the list response.
      const visibleItems = paymentItems;
      const backendReturnedOutOfRangeItems = dateItems.length !== loadedItems.length;
      const nextTotal = requestFilters.estado || backendReturnedOutOfRangeItems
        ? visibleItems.length
        : resolveOrdersPayloadTotal(data, visibleItems);
      const nextFacturasPendientesImpresion = Number(data.facturasPendientesImpresion || 0);
      const nextKpis = normalizeOrdersKpis(data?.kpis, nextFacturasPendientesImpresion);
      const nextCacheValue = {
        items: visibleItems,
        total: nextTotal,
        facturasPendientesImpresion: nextFacturasPendientesImpresion,
        kpis: nextKpis,
        metricItems: visibleItems,
        metricFacturasPendientesImpresion: nextFacturasPendientesImpresion,
      };
      rememberOrdersCache(filterCache, cacheKey, nextCacheValue);
      setItems(visibleItems);
      setTotal(nextTotal);
      setFacturasPendientesImpresion(nextFacturasPendientesImpresion);
      setOrdersKpis(nextKpis);
      setMetricItems(visibleItems);
      setMetricFacturasPendientesImpresion(nextFacturasPendientesImpresion);
      setError("");
      return nextCacheValue;
    } catch (nextError) {
      if (!silent && requestId !== requestTracker.current) return;
      if (silent && (requestId !== requestTracker.current || visibleLoadingRequest.current)) return;
      if (cached) {
        setError("");
        return cached;
      }
      console.error("Error cargando pedidos:", nextError);
      setItems([]);
      setTotal(0);
      setFacturasPendientesImpresion(0);
      setOrdersKpis(DEFAULT_ORDERS_KPIS);
      setMetricItems([]);
      setMetricFacturasPendientesImpresion(0);
      setError("No fue posible cargar pedidos.");
    } finally {
      if (!silent && visibleLoadingRequest.current === requestId) {
        visibleLoadingRequest.current = 0;
        setLoading(false);
      }
    }
  }, [api, filters.q, debouncedQuery, empresaId, filterCache, filters.estado, filters.fechaDesde, filters.fechaHasta, filters.filtrarPorEntrega, filters.metodoPago, filters.page, filters.pageSize, filters.sinImprimir, filters.soloEntregasHoy, filters.soloTienda, requestTracker, sucursalId]);

  const loadYesterdayMetrics = useCallback(async () => {
    setYesterdayMetrics(buildOrdersMetrics([], 0, shiftIsoDate(todayIsoDate(), -1)));
  }, []);

  const loadTodaySalesSummary = useCallback(async () => {
    setTodaySalesTotal(0);
  }, []);

  return {
    loading,
    error,
    items,
    setItems,
    total,
    facturasPendientesImpresion,
    ordersKpis,
    metricItems,
    metricFacturasPendientesImpresion,
    yesterdayMetrics,
    todaySalesTotal,
    loadOrders,
    loadYesterdayMetrics,
    loadTodaySalesSummary,
    clearOrdersCache: clearCache,
  };
}
