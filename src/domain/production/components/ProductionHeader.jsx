/*
 * Encabezado visual del modulo de produccion.
 * Renderiza titulo, fecha, busqueda, selector de vista y metricas superiores.
 */
import {
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  ListChecks,
  RotateCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
  UserX,
} from "lucide-react";
import { SUBMENU_OPTIONS } from "../productionConstants.js";
import { productionHeaderDateLabel } from "../productionDomain.js";

const PRODUCTION_SUBMENU_ICONS = {
  pedidos: ClipboardList,
  disponibilidad: Users,
  incapacidad: ShieldCheck,
  looker: BarChart3,
};

export function ProductionHeader({
  activeMetricFilter,
  busquedaGeneral,
  metrics,
  productionMenuOpen,
  productionMenuRef,
  submenu,
  visibleSubmenuOptions,
  onFocusMetric,
  onRefreshAll,
  onSearchChange,
  onSubmenuChange,
  onToggleProductionMenu,
}) {
  const activeOption = visibleSubmenuOptions.find(item => item.key === submenu) || visibleSubmenuOptions[0] || SUBMENU_OPTIONS[0];
  const ActiveIcon = PRODUCTION_SUBMENU_ICONS[activeOption.key] || ClipboardList;

  return (
    <header className="orders-admin-header orders-page-header production-page-header">
      <div className="orders-page-heading">
        <div className="orders-page-title-row">
          <h1>Producción</h1>
        </div>
        <div className="production-header-meta" aria-label="Contexto de producción">
          <span className="production-header-date">
            <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
            Hoy, {productionHeaderDateLabel()}
          </span>
        </div>
      </div>
      <div className="orders-header-side">
        <div className="header-actions">
          <label className="production-header-search" aria-label="Buscar producción">
            <Search size={17} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={busquedaGeneral}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Buscar florista, cliente o pedido..."
              title="Buscar por florista, cliente o número de pedido"
            />
          </label>
          <div className="production-menu-dropdown" ref={productionMenuRef}>
            <button
              type="button"
              className={`btn-outline orders-header-refresh production-topbar-btn production-menu-trigger${productionMenuOpen ? " is-open" : ""}`}
              onClick={onToggleProductionMenu}
              aria-expanded={productionMenuOpen}
              aria-haspopup="menu"
              title="Cambiar vista de producción"
            >
              <ActiveIcon size={18} strokeWidth={2} />
              <span>{activeOption.label}</span>
              <ChevronDown size={16} strokeWidth={2} className="production-menu-chevron" />
            </button>

            {productionMenuOpen ? (
              <div className="production-menu-panel" role="menu" onClick={() => onToggleProductionMenu(false)}>
                {visibleSubmenuOptions.map(item => {
                  const ItemIcon = PRODUCTION_SUBMENU_ICONS[item.key] || ClipboardList;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`production-menu-option${submenu === item.key ? " is-active" : ""}`}
                      onClick={() => onSubmenuChange(item.key)}
                      role="menuitem"
                    >
                      <span className="production-menu-option-icon"><ItemIcon size={17} strokeWidth={2} /></span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <button type="button" className="btn-primary orders-header-refresh production-topbar-btn production-topbar-btn-primary" title="Recargar vista" onClick={onRefreshAll}>
            <RotateCw size={18} strokeWidth={2} />
            <span>Actualizar</span>
          </button>
        </div>
        <ProductionHeaderMetrics
          activeMetricFilter={activeMetricFilter}
          metrics={metrics}
          onFocusMetric={onFocusMetric}
        />
      </div>
    </header>
  );
}

function ProductionHeaderMetrics({ activeMetricFilter, metrics, onFocusMetric }) {
  return (
    <div className="orders-header-metrics production-header-metrics" aria-label="Indicadores de producción">
      <button type="button" className="orders-header-metric-card is-primary" onClick={() => onFocusMetric(null)}>
        <span className="orders-header-metric-icon" aria-hidden="true"><ListChecks size={18} strokeWidth={2} /></span>
        <strong>{metrics.total}</strong>
        <span>Visibles</span>
      </button>
      <button type="button" className={`orders-header-metric-card is-green ${activeMetricFilter === "pendientesHoy" ? "is-active" : ""}`} onClick={() => onFocusMetric("pendientesHoy")}>
        <span className="orders-header-metric-icon" aria-hidden="true"><CalendarCheck2 size={18} strokeWidth={2} /></span>
        <strong>{metrics.pendientesHoy}</strong>
        <span>Pendientes hoy</span>
      </button>
      <button type="button" className={`orders-header-metric-card is-blue ${metrics.sinAsignar > 0 ? "is-warning" : ""} ${activeMetricFilter === "sinAsignar" ? "is-active" : ""}`} onClick={() => onFocusMetric("sinAsignar")}>
        <span className="orders-header-metric-icon" aria-hidden="true"><UserX size={18} strokeWidth={2} /></span>
        <strong>{metrics.sinAsignar}</strong>
        <span>Sin asignar</span>
      </button>
      <button type="button" className={`orders-header-metric-card is-orange ${metrics.atrasados > 0 ? "is-danger" : ""} ${activeMetricFilter === "atrasados" ? "is-active" : ""}`} onClick={() => onFocusMetric("atrasados")}>
        <span className="orders-header-metric-icon" aria-hidden="true"><TriangleAlert size={18} strokeWidth={2} /></span>
        <strong>{metrics.atrasados}</strong>
        <span>Atrasados</span>
      </button>
      <button type="button" className={`orders-header-metric-card is-purple ${metrics.pendientesFuturos > 0 ? "is-warning" : ""} ${activeMetricFilter === "pendientesFuturos" ? "is-active" : ""}`} onClick={() => onFocusMetric("pendientesFuturos")}>
        <span className="orders-header-metric-icon" aria-hidden="true"><CalendarClock size={18} strokeWidth={2} /></span>
        <strong>{metrics.pendientesFuturos}</strong>
        <span>Futuros</span>
      </button>
    </div>
  );
}
