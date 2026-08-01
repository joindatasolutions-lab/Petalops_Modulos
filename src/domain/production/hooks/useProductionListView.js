/*
 * Hook de modelo de lista de produccion.
 * Prepara items visibles, metricas, filtros activos, paginacion y acciones
 * de foco de metrica/estado para la vista principal.
 */
import { useCallback, useEffect, useMemo } from "react";
import { buildPaginationItems } from "../productionCatalogImages.js";
import { ESTADOS_FILTRO_DEFAULT } from "../productionConstants.js";
import {
  buildVisibleProductionItems,
  ESTADOS_UI,
  productionSelectedStatusKey,
  todayIsoDate,
} from "../productionDomain.js";
import {
  calculateProductionMetrics,
  filterProductionItemsByMetric,
  productionMetricMeta,
} from "../productionViewModel.js";

export function useProductionListView({
  activeMetricFilter,
  busquedaGeneral,
  currentFloristaId,
  currentFloristaName,
  estadosFiltro,
  fecha,
  items,
  productionListRef,
  productionMetricas,
  productionPage,
  productionPageSize,
  setActiveMetricFilter,
  setBusquedaGeneral,
  setEstadosFiltro,
  setFecha,
  setProductionPage,
  setSubmenu,
  soloMisAsignados,
}) {
  const selectedStatusKey = useMemo(
    () => productionSelectedStatusKey(estadosFiltro),
    [estadosFiltro]
  );

  const visibleItems = useMemo(
    () => buildVisibleProductionItems(items, currentFloristaId, busquedaGeneral, activeMetricFilter ? false : soloMisAsignados, !activeMetricFilter, currentFloristaName),
    [items, currentFloristaId, currentFloristaName, busquedaGeneral, soloMisAsignados, activeMetricFilter]
  );

  const metrics = useMemo(
    () => calculateProductionMetrics(visibleItems, productionMetricas),
    [visibleItems, productionMetricas]
  );

  const activeMetricMeta = useMemo(
    () => productionMetricMeta(activeMetricFilter),
    [activeMetricFilter]
  );

  const focusedVisibleItems = useMemo(
    () => filterProductionItemsByMetric(visibleItems, activeMetricFilter),
    [activeMetricFilter, visibleItems]
  );

  const productionTotal = focusedVisibleItems.length;
  const productionPages = Math.max(1, Math.ceil(productionTotal / productionPageSize));
  const productionVisibleFrom = productionTotal > 0 ? ((productionPage - 1) * productionPageSize) + 1 : 0;
  const productionVisibleTo = productionTotal > 0 ? Math.min(productionTotal, productionVisibleFrom + productionPageSize - 1) : 0;
  const productionPagerItems = useMemo(
    () => buildPaginationItems(productionPage, productionPages),
    [productionPage, productionPages]
  );
  const paginatedProductionItems = useMemo(() => {
    const start = (productionPage - 1) * productionPageSize;
    return focusedVisibleItems.slice(start, start + productionPageSize);
  }, [focusedVisibleItems, productionPage, productionPageSize]);

  useEffect(() => {
    setProductionPage(1);
  }, [activeMetricFilter, busquedaGeneral, fecha, estadosFiltro, soloMisAsignados, productionPageSize, setProductionPage]);

  useEffect(() => {
    if (productionPage > productionPages) {
      setProductionPage(productionPages);
    }
  }, [productionPage, productionPages, setProductionPage]);

  const focusMetric = useCallback(metricKey => {
    setSubmenu("pedidos");
    setBusquedaGeneral("");
    setActiveMetricFilter(current => {
      const nextMetric = current === metricKey ? null : metricKey;
      if (!nextMetric) {
        setFecha(todayIsoDate());
        setEstadosFiltro(ESTADOS_FILTRO_DEFAULT);
        return null;
      }
      setFecha(nextMetric === "pendientesHoy" ? todayIsoDate() : "");
      setEstadosFiltro(["Pendiente"]);
      return nextMetric;
    });
    window.requestAnimationFrame(() => {
      productionListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [productionListRef, setActiveMetricFilter, setBusquedaGeneral, setEstadosFiltro, setFecha, setSubmenu]);

  const toggleEstadoFiltro = useCallback((estadoItem) => {
    setActiveMetricFilter(null);
    setEstadosFiltro([estadoItem]);
  }, [setActiveMetricFilter, setEstadosFiltro]);

  const selectAllProductionStatuses = useCallback(() => {
    setActiveMetricFilter(null);
    setEstadosFiltro(ESTADOS_UI);
  }, [setActiveMetricFilter, setEstadosFiltro]);

  return {
    activeMetricMeta,
    focusedVisibleItems,
    focusMetric,
    metrics,
    paginatedProductionItems,
    productionPages,
    productionPagerItems,
    productionTotal,
    productionVisibleFrom,
    productionVisibleTo,
    selectAllProductionStatuses,
    selectedStatusKey,
    toggleEstadoFiltro,
    visibleItems,
  };
}
