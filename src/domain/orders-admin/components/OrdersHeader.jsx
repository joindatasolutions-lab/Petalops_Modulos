import { IconWallet } from "@tabler/icons-react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Gift,
  FileText,
  Plus,
  Receipt,
  RotateCw,
  Search,
  XCircle,
} from "lucide-react";

import { formatearCOP } from "../../../shared/utils.js";

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
  onFilterChange,
  onToggleStoreDeliveries,
  onRefresh,
  onNewOrder,
  onFocusMetric,
}) {
  return (
    <header className="orders-admin-header orders-page-header">
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
              className={`btn-primary orders-header-refresh orders-catalog-link${catalogUrl ? "" : " is-disabled"}`}
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
            onClick={onNewOrder}
            title="Nuevo pedido"
            aria-label="Nuevo pedido"
            data-tooltip="Nuevo pedido"
          >
            <Plus size={18} strokeWidth={2.2} />
            <span>Nuevo pedido</span>
            <ChevronDown size={15} strokeWidth={2.2} />
          </button>
        </div>
        <div className="orders-header-metrics" aria-label="Resumen de pedidos">
          <article className="orders-header-metric-card is-sale">
            <span className="orders-header-metric-icon" aria-hidden="true">
              <IconWallet size={17} stroke={2.2} />
            </span>
            <strong>${formatearCOP(headerSalesSummary)}</strong>
            <span>Venta hoy</span>
          </article>
          {metricCards.map(card => {
            const Icon = card.Icon;
            const isActive = activeMetric === card.key;
            return (
              <button
                key={card.key}
                type="button"
                className={`orders-header-metric-card ${card.className}${isActive ? " is-active" : ""}`}
                onClick={() => onFocusMetric(card.key)}
                aria-pressed={isActive}
                aria-label={`${card.label}: ${card.value}`}
              >
                <span className="orders-header-metric-icon" aria-hidden="true">
                  <Icon size={17} strokeWidth={2.2} />
                </span>
                <strong>{card.value}</strong>
                <span>{card.shortLabel}</span>
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
