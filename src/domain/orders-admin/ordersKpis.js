/**
 * Normalizacion de KPIs de pedidos.
 *
 * Convierte payloads parciales del backend en un objeto completo para que las
 * tarjetas metricas no tengan que defenderse de `undefined`.
 */

export function normalizeOrdersKpis(value, fallbackFacturasPendientesImpresion = 0) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ventaHoy: Number(source.ventaHoy || 0),
    pedidosHoy: Number(source.pedidosHoy || 0),
    aprobados: Number(source.aprobados || 0),
    pendientes: Number(source.pendientes || 0),
    cancelados: Number(source.cancelados || 0),
    sinImprimir: Number(source.sinImprimir ?? fallbackFacturasPendientesImpresion ?? 0),
  };
}
