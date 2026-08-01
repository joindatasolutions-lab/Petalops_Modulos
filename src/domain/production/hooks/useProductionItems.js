/*
 * Hook de carga de items de produccion.
 * Consulta el backend, aplica filtros de fecha/estado/busqueda/metrica y expone
 * loading, error, metricas y una funcion de recarga.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toIsoDateEnd, toIsoDateStart } from "../../../shared/utils.js";

const EMPTY_PRODUCTION_METRICS = {
  pendientesHoy: null,
  sinAsignar: null,
  atrasados: null,
  pendientesFuturos: 0,
};
const PRODUCTION_LOAD_TIMEOUT_MS = 20000;

function productionLoadTimeoutError(label) {
  const error = new Error(`La carga de ${label} tardó demasiado.`);
  error.code = "PRODUCTION_LOAD_TIMEOUT";
  return error;
}

function withProductionLoadTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(productionLoadTimeoutError(label)), PRODUCTION_LOAD_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function normalizeMetricas(metricas = {}) {
  return {
    pendientesHoy: Object.prototype.hasOwnProperty.call(metricas, "pendientesHoy") ? Number(metricas.pendientesHoy || 0) : null,
    sinAsignar: Object.prototype.hasOwnProperty.call(metricas, "sinAsignar") ? Number(metricas.sinAsignar || 0) : null,
    atrasados: Object.prototype.hasOwnProperty.call(metricas, "atrasados") ? Number(metricas.atrasados || 0) : null,
    pendientesFuturos: Number(metricas.pendientesFuturos || 0),
  };
}

function mergeProductionRows(leftItems, rightItems) {
  const byKey = new Map();
  [...(Array.isArray(leftItems) ? leftItems : []), ...(Array.isArray(rightItems) ? rightItems : [])].forEach(item => {
    if (!item) return;
    const key = String(item.idProduccion || item.pedidoDetalleID || item.pedidoID || item.numeroPedido || byKey.size);
    byKey.set(key, item);
  });
  return Array.from(byKey.values());
}

export function useProductionItems({
  api,
  empresaId,
  sucursalId,
  fecha,
  estadosFiltro,
  activeMetricFilter,
  searchOverridesFilters,
  busquedaGeneral,
  canLoadCanceledOrders = false,
  rules,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [productionMetricas, setProductionMetricas] = useState(EMPTY_PRODUCTION_METRICS);
  const productionMetricasRef = useRef(productionMetricas);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    productionMetricasRef.current = productionMetricas;
  }, [productionMetricas]);

  const loadItems = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const isLatestRequest = () => requestSeqRef.current === requestSeq;
    setLoading(true);
    setError("");

    try {
      const shouldIncludeCanceled = rules.shouldIncludeCanceledProduction(estadosFiltro);
      const backendStatusFilter = rules.productionBackendStatusFilter(estadosFiltro);
      const expectedMetricCount = activeMetricFilter
        ? Number(productionMetricasRef.current?.[activeMetricFilter] || 0)
        : 0;
      const produccion = await withProductionLoadTimeout(api.listarProduccion({
        empresaId,
        sucursalId,
        fecha: searchOverridesFilters || activeMetricFilter ? undefined : fecha,
        estado: searchOverridesFilters || activeMetricFilter ? undefined : backendStatusFilter,
        q: searchOverridesFilters ? busquedaGeneral : undefined,
        metricFilter: searchOverridesFilters ? undefined : activeMetricFilter,
        todasFechas: !searchOverridesFilters && !activeMetricFilter && !fecha,
        incluirCancelado: shouldIncludeCanceled,
        autoAsignarPendientesHoy: false,
      }), "producción");
      let nextItemsRaw = (Array.isArray(produccion.items) ? produccion.items : []).map(rules.normalizeProductionItemStatus);
      const responseMetricas = produccion.metricas || {};
      const activeMetricCount = activeMetricFilter ? Number(responseMetricas?.[activeMetricFilter] || 0) : 0;
      const overdueMetricCount = Number(responseMetricas?.atrasados || 0);

      if (activeMetricFilter && nextItemsRaw.length === 0 && Math.max(activeMetricCount, expectedMetricCount) > 0) {
        const fallbackResponse = await withProductionLoadTimeout(api.listarProduccion({
          empresaId,
          sucursalId,
          fecha: undefined,
          estado: undefined,
          metricFilter: undefined,
          todasFechas: true,
          incluirCancelado: shouldIncludeCanceled,
          autoAsignarPendientesHoy: false,
        }), "producción por métrica");
        nextItemsRaw = (Array.isArray(fallbackResponse.items) ? fallbackResponse.items : [])
          .map(rules.normalizeProductionItemStatus)
          .filter(item => rules.matchesProductionMetric(item, activeMetricFilter));
      }

      if (!activeMetricFilter && !searchOverridesFilters && fecha && overdueMetricCount > 0) {
        const fallbackResponse = await withProductionLoadTimeout(api.listarProduccion({
          empresaId,
          sucursalId,
          fecha: undefined,
          estado: backendStatusFilter,
          metricFilter: undefined,
          todasFechas: true,
          incluirCancelado: shouldIncludeCanceled,
          autoAsignarPendientesHoy: false,
        }), "producción atrasada");
        const overdueItems = (Array.isArray(fallbackResponse.items) ? fallbackResponse.items : [])
          .map(rules.normalizeProductionItemStatus)
          .filter(item => rules.matchesProductionMetric(item, "atrasados"));
        nextItemsRaw = mergeProductionRows(nextItemsRaw, overdueItems);
      }

      if (searchOverridesFilters && nextItemsRaw.length === 0) {
        const pipelinePayload = await withProductionLoadTimeout(api.listarPipelinePedidos({
          empresaId,
          sucursalId,
          numeroPedido: String(busquedaGeneral || "").trim(),
          soloHoy: false,
          soloAtrasados: false,
          soloEnProduccion: false,
        }), "pipeline de pedidos");
        const pipelineMatches = rules.flattenPipelineCards(pipelinePayload);
        const candidateDates = Array.from(
          new Set(
            pipelineMatches
              .map(item => rules.toIsoDate(item.fecha_entrega))
              .filter(Boolean)
          )
        );
        if (candidateDates.length > 0) {
          const fallbackResponses = await Promise.all(
            candidateDates.map(candidateDate =>
              withProductionLoadTimeout(api.listarProduccion({
                empresaId,
                sucursalId,
                fecha: candidateDate,
                estado: backendStatusFilter,
                incluirCancelado: shouldIncludeCanceled,
                autoAsignarPendientesHoy: false,
              }), "producción por fecha candidata")
            )
          );
          nextItemsRaw = fallbackResponses
            .flatMap(response => (Array.isArray(response.items) ? response.items : []))
            .map(rules.normalizeProductionItemStatus);
        }
      }

      if (searchOverridesFilters && nextItemsRaw.length === 0) {
        const fallbackResponse = await withProductionLoadTimeout(api.listarProduccion({
          empresaId,
          sucursalId,
          fecha: undefined,
          estado: backendStatusFilter,
          metricFilter: undefined,
          todasFechas: true,
          incluirCancelado: shouldIncludeCanceled,
          autoAsignarPendientesHoy: false,
        }), "producción global");
        nextItemsRaw = (Array.isArray(fallbackResponse.items) ? fallbackResponse.items : [])
          .map(rules.normalizeProductionItemStatus)
          .filter(item => rules.productionItemMatchesSearch(item, busquedaGeneral));
      }

      if (canLoadCanceledOrders && shouldIncludeCanceled && !activeMetricFilter) {
        try {
          const canceledOrdersPayload = await withProductionLoadTimeout(api.listarPedidos({
            empresaId,
            sucursalId,
            q: searchOverridesFilters ? busquedaGeneral : "",
            estado: "CANCELADO",
            sinImprimir: false,
            soloTienda: false,
            fechaDesde: searchOverridesFilters || !fecha ? undefined : toIsoDateStart(fecha),
            fechaHasta: searchOverridesFilters || !fecha ? undefined : toIsoDateEnd(fecha),
            page: 1,
            pageSize: 300,
          }), "pedidos cancelados");
          const canceledProductionItems = rules.extractListPayloadItems(canceledOrdersPayload)
            .map(rules.productionItemFromCanceledOrder)
            .filter(Boolean);
          nextItemsRaw = rules.mergeProductionItemsByOrder(nextItemsRaw, canceledProductionItems);
        } catch (canceledOrdersError) {
          console.warn("No fue posible cargar pedidos cancelados para producción:", canceledOrdersError);
        }
      }

      const nextItems = activeMetricFilter
        ? nextItemsRaw.filter(item => !rules.isCanceledProductionStatus(item))
        : searchOverridesFilters
          ? nextItemsRaw.filter(item => rules.productionItemMatchesSearch(item, busquedaGeneral))
        : nextItemsRaw.filter(item =>
          estadosFiltro.some(estadoItem => rules.normalizeProductionStatusKey(estadoItem) === rules.normalizeProductionStatusKey(item.estado))
        );

      if (!isLatestRequest()) return [];

      setItems(nextItems);
      setProductionMetricas(normalizeMetricas(responseMetricas));
      setError("");
      return nextItems;
    } catch (nextError) {
      if (!isLatestRequest()) return [];
      console.error("Error cargando producción:", nextError);
      setItems([]);
      setProductionMetricas(EMPTY_PRODUCTION_METRICS);
      setError(nextError?.code === "PRODUCTION_LOAD_TIMEOUT"
        ? "La carga de producción tardó demasiado. Intenta actualizar de nuevo."
        : "No fue posible cargar el módulo de producción.");
      return [];
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [api, empresaId, sucursalId, fecha, estadosFiltro, activeMetricFilter, searchOverridesFilters, busquedaGeneral, canLoadCanceledOrders, rules]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return {
    items,
    loading,
    error,
    productionMetricas,
    loadItems,
  };
}
