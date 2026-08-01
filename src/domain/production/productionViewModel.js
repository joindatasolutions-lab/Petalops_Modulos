/*
 * View model de produccion.
 * Calcula datos derivados para pantalla: metricas, filtros activos y listas visibles.
 */
import { normalizeStatus } from "../../shared/utils.js";
import {
  hasAssignedFlorista,
  isPendingOverdue,
  matchesProductionMetric,
  resolveProgrammedDate,
  todayIsoDate,
} from "./productionDomain.js";

export const PRODUCTION_METRIC_META = {
  pendientesHoy: {
    label: "Pendientes hoy",
    description: "Pedidos que deben resolverse en la jornada.",
  },
  sinAsignar: {
    label: "Pendientes sin asignar",
    description: "Pedidos pendientes que todavia no tienen florista.",
  },
  atrasados: {
    label: "Pendientes atrasados",
    description: "Pedidos pendientes con fecha programada vencida.",
  },
  pendientesFuturos: {
    label: "Pendientes futuros",
    description: "Pedidos pendientes programados para dias posteriores.",
  },
};

export function calculateProductionMetrics(visibleItems, productionMetricas = {}) {
  const total = visibleItems.length;
  const pendientes = visibleItems.filter(item => normalizeStatus(item.estado).replace(/_/g, "") === "PENDIENTE");
  const enProduccion = visibleItems.filter(item => normalizeStatus(item.estado).replace(/_/g, "") === "ENPRODUCCION");
  const sinAsignar = pendientes.filter(item => !hasAssignedFlorista(item));
  const pendientesHoy = pendientes.filter(item => resolveProgrammedDate(item) === todayIsoDate());
  const atrasados = pendientes.filter(item => isPendingOverdue(item));
  const criticos = pendientes
    .filter(item => isPendingOverdue(item) || !hasAssignedFlorista(item))
    .sort((left, right) => {
      const leftDate = resolveProgrammedDate(left) || "9999-12-31";
      const rightDate = resolveProgrammedDate(right) || "9999-12-31";
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      return Number(left.numeroPedido || 0) - Number(right.numeroPedido || 0);
    })
    .slice(0, 5);

  return {
    total,
    pendientes: pendientes.length,
    pendientesHoy: productionMetricas.pendientesHoy != null ? Number(productionMetricas.pendientesHoy) : pendientesHoy.length,
    enProduccion: enProduccion.length,
    sinAsignar: productionMetricas.sinAsignar != null ? Number(productionMetricas.sinAsignar) : sinAsignar.length,
    atrasados: productionMetricas.atrasados != null ? Number(productionMetricas.atrasados) : atrasados.length,
    criticos,
    pendientesFuturos: Number(productionMetricas.pendientesFuturos || 0),
  };
}

export function productionMetricMeta(metricKey) {
  return metricKey ? PRODUCTION_METRIC_META[metricKey] || null : null;
}

export function filterProductionItemsByMetric(visibleItems, activeMetricFilter) {
  if (!activeMetricFilter) return visibleItems;
  return visibleItems.filter(item => matchesProductionMetric(item, activeMetricFilter));
}
