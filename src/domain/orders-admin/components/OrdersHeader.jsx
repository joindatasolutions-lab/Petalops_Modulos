import { IconWallet } from "@tabler/icons-react";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gift,
  FileText,
  Plus,
  Receipt,
  RotateCw,
  Search,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";

import { formatearCOP } from "../../../shared/utils.js";
import "./OrdersHeader.css";
import { todayIsoDate } from "../ordersDomain.js";

export function ordersMetricPeriod(filters) {
  if (String(filters.q || "").trim()) return "Todas las fechas · búsqueda activa";
  const from = filters.fechaDesde;
  const to = filters.fechaHasta;
  const format = value => value.split("T")[0].split("-").reverse().join("/");
  if (filters.soloEntregasHoy || (from === todayIsoDate() && to === from)) return "Hoy";
  if (from && to && from === to) return format(from);
  if (from && to) return `${format(from)} – ${format(to)}`;
  if (from) return `Desde ${format(from)}`;
  if (to) return `Hasta ${format(to)}`;
  return "Todas las fechas";
}

const metricOrder = ["hoy", "pendientes", "facturas", "aprobados", "cancelados"];
const metricHints = { hoy: "Ver creados hoy", pendientes: "Requieren revisión", facturas: "Por imprimir", aprobados: "Ver aprobados", cancelados: "Ver cancelados" };
const formatCount = value => Number(value || 0).toLocaleString("es-CO");

/**
 * Encabezado operativo del modulo Pedidos.
 *
 * Agrupa titulo, buscador, acciones principales y tarjetas metricas. Recibe
 * callbacks desde el contenedor para mantener este componente libre de efectos
 * secundarios.
 */

export function OrdersHeader({
  filters,
  metricCards,
  activeMetric,
  headerSalesSummary,
  canViewCatalogo = false,
  catalogUrl = "",
  voiceAlertsEnabled = false,
  onFilterChange,
  onToggleTodayDeliveries,
  onToggleStoreDeliveries,
  onToggleVoiceAlerts,
  onRefresh,
  onNewOrder,
  onFocusMetric,
}) {
  const metricPeriod = ordersMetricPeriod(filters);
  const salesLabel = "Ventas hoy";
  const ordersLabel = "Pedidos hoy";
  return (
    <header className="orders-admin-header orders-page-header orders-kpi-header">
      <div className="orders-page-heading">
        <div className="orders-page-breadcrumb" aria-label="Ruta">
          <span>Operaciones</span>
          <span>/</span>
          <strong>Pedidos</strong>
        </div>
        <div className="orders-page-title-row">
          <img src="/logo.png" alt="PetalOps" className="orders-mobile-brand-logo" />
          <h1>Pedidos</h1>
        </div>
        <p className="orders-admin-subtitle orders-page-description">Consulta pedidos, revisa estados y gestiona la operacion diaria.</p>
      </div>
      <label className="orders-header-search" aria-label="Buscar pedidos">
        <Search size={17} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={filters.q}
          onChange={event => onFilterChange("q", event.target.value)}
          placeholder="Buscar pedido, cliente, destinatario, ..."
        />
      </label>
      <div className="orders-header-side">
        <div className="header-actions">
          <button
            type="button"
            className={`btn-primary orders-header-refresh orders-store-toggle orders-today-toggle${filters.soloEntregasHoy ? " is-active" : ""}`}
            onClick={onToggleTodayDeliveries}
            title={filters.soloEntregasHoy ? "Ver todos los pedidos" : "Ver entregas de hoy"}
            aria-label={filters.soloEntregasHoy ? "Ver todos los pedidos" : "Ver entregas de hoy"}
            data-tooltip={filters.soloEntregasHoy ? "Ver todos los pedidos" : "Ver entregas de hoy"}
          >
            <CalendarCheck2 size={18} strokeWidth={2} />
            <span>{filters.soloEntregasHoy ? "Todos los pedidos" : "Entregas hoy"}</span>
          </button>
          <button
            type="button"
            className={`btn-primary orders-header-refresh orders-store-toggle${filters.soloTienda ? " is-active" : ""}`}
            onClick={onToggleStoreDeliveries}
            title={filters.soloTienda ? "Ver todos los pedidos" : "Ver entregas en tienda"}
            aria-label={filters.soloTienda ? "Ver todos los pedidos" : "Ver entregas en tienda"}
            data-tooltip={filters.soloTienda ? "Ver todos los pedidos" : "Ver entregas en tienda"}
          >
            <Gift size={18} strokeWidth={2} />
            <span>{filters.soloTienda ? "Todos los pedidos" : "Entregas en tienda"}</span>
          </button>
          <button
            type="button"
            className={`btn-primary orders-header-refresh orders-store-toggle${voiceAlertsEnabled ? " is-active" : ""}`}
            onClick={onToggleVoiceAlerts}
            title={voiceAlertsEnabled ? "Desactivar alertas de voz" : "Activar alertas de voz"}
            aria-label={voiceAlertsEnabled ? "Desactivar alertas de voz" : "Activar alertas de voz"}
            aria-pressed={voiceAlertsEnabled}
            data-tooltip={voiceAlertsEnabled ? "Desactivar alertas de voz" : "Activar alertas de voz"}
          >
            {voiceAlertsEnabled ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
            <span>Voz pedidos</span>
          </button>
          <button
            type="button"
            className="btn-primary orders-header-refresh"
            onClick={onRefresh}
            title="Actualizar pedidos"
            aria-label="Actualizar pedidos"
            data-tooltip="Actualizar pedidos"
          >
            <RotateCw size={18} strokeWidth={2} />
            <span>Actualizar</span>
          </button>
          {canViewCatalogo ? (
            <a
              className={`btn-primary orders-catalog-link${catalogUrl ? "" : " is-disabled"}`}
              href={catalogUrl || undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!catalogUrl}
              aria-label="Abrir catalogo"
              data-tooltip="Abrir catalogo"
              title={catalogUrl ? "Abrir catalogo" : "Catalogo no disponible: falta el slug de la empresa"}
              onClick={event => {
                if (!catalogUrl) {
                  event.preventDefault();
                  globalThis.alert("No fue posible abrir el catalogo: falta el slug de la empresa.");
                }
              }}
            >
              <FileText size={18} strokeWidth={2.1} />
              <span>Catalogo</span>
            </a>
          ) : null}
          <button
            type="button"
            className="btn-primary orders-new-order-btn"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              onNewOrder?.();
            }}
            title="Nuevo pedido"
            aria-label="Nuevo pedido"
            data-tooltip="Nuevo pedido"
          >
            <Plus size={18} strokeWidth={2.2} />
            <span>Nuevo pedido</span>
            <ChevronDown size={15} strokeWidth={2.2} />
          </button>
        </div>
        <div className="orders-header-metrics orders-kpi-grid" aria-label="Resumen de pedidos">
          <p className="orders-kpi-scope">Resumen de pedidos · {metricPeriod}. Ventas y pedidos de hoy corresponden al día actual dentro de esta consulta.</p>
          <article className="orders-header-metric-card is-sale">
            <span className="orders-header-metric-icon" aria-hidden="true">
              <IconWallet size={17} stroke={2.2} />
            </span>
            <strong>${formatearCOP(headerSalesSummary)}</strong>
            <span>{salesLabel}</span>
            <small>Hoy · COP</small>
          </article>
          {[...metricCards].sort((a, b) => metricOrder.indexOf(a.key) - metricOrder.indexOf(b.key)).map(card => {
            const Icon = card.Icon;
            const isActive = activeMetric === card.key;
            return (
              <button
                key={card.key}
                type="button"
                className={`orders-header-metric-card ${card.className}${isActive ? " is-active" : ""}`}
                onClick={() => onFocusMetric(card.key)}
                aria-pressed={isActive}
                aria-label={`${card.key === "hoy" ? ordersLabel : card.label}: ${card.value}. ${card.key === "hoy" ? "Hoy" : metricPeriod}`}
                data-metric={card.key}
                title={card.key === "hoy" ? "Ver pedidos de hoy" : metricHints[card.key]}
              >
                <span className="orders-header-metric-icon" aria-hidden="true">
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <strong>{formatCount(card.value)}</strong>
                <span>{card.key === "hoy" ? ordersLabel : card.shortLabel}</span>
                <small>{card.key === "hoy" ? "Creados hoy" : isActive ? "Filtro activo" : metricHints[card.key]}</small>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export const ORDER_METRIC_ICONS = {
  hoy: CheckCircle2,
  aprobados: CheckCircle2,
  pendientes: Clock3,
  cancelados: XCircle,
  facturas: Receipt,
};
