import { Bike, Building2, Calendar, Filter, Flower2, Search, SlidersHorizontal, X } from "lucide-react";

import { PIPELINE_STATE_OPTIONS } from "./pipelineConfig.jsx";
import { applyEstadoFilterValue, resolveEstadoFiltro, todayIsoDate } from "./pipelineDomain.js";

export function PipelineFilters({ filters, onChange }) {
  const estadoFiltro = resolveEstadoFiltro(filters);
  const advancedFiltersCount = [
    filters.fechaDesde && filters.fechaDesde !== todayIsoDate() ? filters.fechaDesde : "",
    filters.fechaHasta && filters.fechaHasta !== todayIsoDate() ? filters.fechaHasta : "",
    filters.sucursalID,
    filters.floristaID,
    filters.domiciliarioID,
    estadoFiltro,
  ].filter(value => String(value ?? "").trim()).length;

  const onEstadoChange = value => applyEstadoFilterValue(value, onChange);
  const applyTodayFilter = () => {
    const today = todayIsoDate();
    onChange("fechaDesde", today);
    onChange("fechaHasta", today);
  };
  const clearMobileFilters = () => {
    applyTodayFilter();
    onChange("sucursalID", null);
    onChange("floristaID", "");
    onChange("domiciliarioID", "");
    onEstadoChange("");
  };

  const onFechaDesdeChange = value => {
    onChange("fechaDesde", value);
    if (value && filters.fechaHasta && value > filters.fechaHasta) {
      onChange("fechaHasta", value);
    }
  };

  return (
    <section className="orders-filters orders-page-filters pipeline-filters-bar">
      <label className="filter-field orders-filter-field pipeline-filter-search">
        <div className="orders-filter-control">
          <Search size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="# Pedido, cliente..."
            value={filters.numeroPedido}
            onChange={event => onChange("numeroPedido", event.target.value)}
          />
        </div>
      </label>

      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Calendar size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="date"
            value={filters.fechaDesde}
            onChange={event => onFechaDesdeChange(event.target.value)}
            aria-label="Fecha desde"
            title="Fecha desde"
          />
        </div>
      </div>

      <div className="filter-field orders-filter-field pipeline-filter-until">
        <div className="orders-filter-control">
          <Calendar size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="date"
            value={filters.fechaHasta}
            min={filters.fechaDesde || undefined}
            onChange={event => onChange("fechaHasta", event.target.value)}
            aria-label="Fecha hasta"
            title="Fecha hasta"
          />
        </div>
      </div>

      <div className="filter-field orders-filter-field pipeline-desktop-advanced-field">
        <div className="orders-filter-control">
          <Building2 size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="number"
            placeholder="ID sucursal"
            value={filters.sucursalID ?? ""}
            onChange={event => onChange("sucursalID", event.target.value ? Number(event.target.value) : null)}
          />
        </div>
      </div>

      <div className="filter-field orders-filter-field pipeline-desktop-advanced-field">
        <div className="orders-filter-control">
          <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            placeholder="Florista"
            value={filters.floristaID ?? ""}
            onChange={event => onChange("floristaID", event.target.value)}
          />
        </div>
      </div>

      <div className="filter-field orders-filter-field pipeline-desktop-advanced-field">
        <div className="orders-filter-control">
          <Bike size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            placeholder="Domiciliario"
            value={filters.domiciliarioID ?? ""}
            onChange={event => onChange("domiciliarioID", event.target.value)}
          />
        </div>
      </div>

      <div className="filter-field orders-filter-field pipeline-filter-state">
        <div className="orders-filter-control">
          <Filter size={17} strokeWidth={2} aria-hidden="true" />
          <select value={estadoFiltro} onChange={event => onEstadoChange(event.target.value)}>
            {PIPELINE_STATE_OPTIONS.map(option => (
              <option key={option.value || "todos"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="pipeline-mobile-quick-filters" aria-label="Filtros rapidos del pipeline">
        <button
          type="button"
          className={`btn-outline pipeline-mobile-today${filters.fechaDesde === todayIsoDate() && filters.fechaHasta === todayIsoDate() ? " is-active" : ""}`}
          onClick={applyTodayFilter}
        >
          Hoy
        </button>
        <label className="pipeline-mobile-sucursal">
          <Building2 size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="number"
            placeholder="Sucursal"
            value={filters.sucursalID ?? ""}
            onChange={event => onChange("sucursalID", event.target.value ? Number(event.target.value) : null)}
            aria-label="Sucursal"
          />
        </label>
      </div>

      <details className="pipeline-mobile-advanced-filters">
        <summary>
          <SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" />
          <span>Filtros</span>
          {advancedFiltersCount > 0 ? <strong>{advancedFiltersCount}</strong> : null}
        </summary>

        <div className="pipeline-mobile-advanced-filters-panel">
          <div className="pipeline-mobile-sheet-head">
            <div>
              <strong>Filtros</strong>
              <span>Refina el pipeline sin perder la vista de pedidos.</span>
            </div>
            <button
              type="button"
              className="pipeline-mobile-sheet-close"
              aria-label="Cerrar filtros"
              onClick={event => {
                event.currentTarget.closest("details").open = false;
              }}
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="filter-field orders-filter-field">
            <span>Fecha desde</span>
            <div className="orders-filter-control">
              <Calendar size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="date"
                value={filters.fechaDesde}
                onChange={event => onFechaDesdeChange(event.target.value)}
                aria-label="Fecha desde"
              />
            </div>
          </div>

          <div className="filter-field orders-filter-field">
            <span>Fecha hasta</span>
            <div className="orders-filter-control">
              <Calendar size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="date"
                value={filters.fechaHasta}
                min={filters.fechaDesde || undefined}
                onChange={event => onChange("fechaHasta", event.target.value)}
                aria-label="Fecha hasta"
              />
            </div>
          </div>

          <div className="filter-field orders-filter-field">
            <span>Sucursal</span>
            <div className="orders-filter-control">
              <Building2 size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="number"
                placeholder="ID sucursal"
                value={filters.sucursalID ?? ""}
                onChange={event => onChange("sucursalID", event.target.value ? Number(event.target.value) : null)}
              />
            </div>
          </div>

          <div className="filter-field orders-filter-field">
            <span>Estado</span>
            <div className="orders-filter-control">
              <Filter size={17} strokeWidth={2} aria-hidden="true" />
              <select value={estadoFiltro} onChange={event => onEstadoChange(event.target.value)}>
                {PIPELINE_STATE_OPTIONS.map(option => (
                  <option key={`mobile-${option.value || "todos"}`} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-field orders-filter-field">
            <span>Florista</span>
            <div className="orders-filter-control">
              <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="text"
                placeholder="Florista"
                value={filters.floristaID ?? ""}
                onChange={event => onChange("floristaID", event.target.value)}
              />
            </div>
          </div>

          <div className="filter-field orders-filter-field">
            <span>Domiciliario</span>
            <div className="orders-filter-control">
              <Bike size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="text"
                placeholder="Domiciliario"
                value={filters.domiciliarioID ?? ""}
                onChange={event => onChange("domiciliarioID", event.target.value)}
              />
            </div>
          </div>

          {advancedFiltersCount > 0 ? (
            <button type="button" className="btn-outline pipeline-clear-advanced" onClick={clearMobileFilters}>
              <X size={16} strokeWidth={2} aria-hidden="true" />
              <span>Limpiar filtros</span>
            </button>
          ) : null}

          <button
            type="button"
            className="btn-primary pipeline-mobile-sheet-done"
            onClick={event => {
              event.currentTarget.closest("details").open = false;
            }}
          >
            Ver resultados
          </button>
        </div>
      </details>
    </section>
  );
}
