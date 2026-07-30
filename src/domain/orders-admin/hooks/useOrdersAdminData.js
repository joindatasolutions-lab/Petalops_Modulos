import { useCallback, useMemo, useRef, useState } from "react";

import { shiftIsoDate } from "../../../shared/utils.js";
import { DEFAULT_ORDERS_KPIS } from "../ordersAdminConstants.js";
import { buildOrdersCacheKey, rememberOrdersCache } from "../ordersCache.js";
import { normalizeOrdersKpis } from "../ordersKpis.js";
import {
  buildOrdersMetrics,
  extractOrdersPayloadItems,
  filterOrdersByCreatedDateRange,
  filterOrdersByPaymentMethod,
  filterOrdersBySearch,
  filterOrdersByStatus,
  isOrderNumberSearchTerm,
  isPaymentSearchTerm,
  localDateEndParam,
  localDateStartParam,
  resolveOrdersPayloadTotal,
  todayIsoDate,
} from "../ordersDomain.js";

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
    if (silent && visibleLoadingRequest.current) return;

    const requestId = silent ? requestTracker.current : requestTracker.current + 1;
    if (!silent) {
      requestTracker.current = requestId;
    }
    const requestFilters = {
      empresaId,
      sucursalId,
      q: debouncedQuery,
      backendQ: isPaymentSearchTerm(debouncedQuery) ? "" : debouncedQuery,
      estado: filters.estado,
      sinImprimir: filters.sinImprimir,
      soloTienda: filters.soloTienda,
      metodoPago: filters.metodoPago,
      fechaDesde: filters.fechaDesde,
      fechaHasta: filters.fechaHasta,
      page: filters.page,
      pageSize: filters.pageSize,
    };
    const searchByOrderNumber = !requestFilters.soloTienda && isOrderNumberSearchTerm(requestFilters.q);
    const requestFechaDesde = searchByOrderNumber ? "" : requestFilters.fechaDesde;
    const requestFechaHasta = searchByOrderNumber ? "" : requestFilters.fechaHasta;
    const cacheKey = buildOrdersCacheKey({
      ...requestFilters,
      fechaDesde: requestFechaDesde,
      fechaHasta: requestFechaHasta,
    });
    const cached = !silent ? filterCache.get(cacheKey) : null;

    if (cached) {
      const cachedItems = requestFilters.soloTienda
        ? cached.items
        : filterOrdersByCreatedDateRange(cached.items, requestFechaDesde, requestFechaHasta);
      const cachedMetricItems = requestFilters.soloTienda
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
        q: requestFilters.backendQ,
        estado: requestFilters.estado,
        sinImprimir: requestFilters.sinImprimir,
        soloTienda: requestFilters.soloTienda,
        fechaDesde: localDateStartParam(requestFechaDesde),
        fechaHasta: localDateEndParam(requestFechaHasta),
        page: requestFilters.page,
        pageSize: requestFilters.pageSize,
      });

      if (!silent && requestId !== requestTracker.current) return;
      if (silent && (requestId !== requestTracker.current || visibleLoadingRequest.current)) return;

      const loadedItems = extractOrdersPayloadItems(data);
      const dateItems = requestFilters.soloTienda
        ? loadedItems
        : filterOrdersByCreatedDateRange(loadedItems, requestFechaDesde, requestFechaHasta);
      const statusItems = filterOrdersByStatus(dateItems, requestFilters.estado);
      const paymentItems = filterOrdersByPaymentMethod(statusItems, requestFilters.metodoPago);
      const visibleItems = filterOrdersBySearch(paymentItems, requestFilters.q, requestFilters.empresaId);
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
  }, [api, debouncedQuery, empresaId, filterCache, filters.estado, filters.fechaDesde, filters.fechaHasta, filters.metodoPago, filters.page, filters.pageSize, filters.sinImprimir, filters.soloTienda, requestTracker, sucursalId]);

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
