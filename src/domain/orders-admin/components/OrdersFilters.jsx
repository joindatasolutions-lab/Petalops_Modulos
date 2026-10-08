import { CalendarDays, Filter, RotateCw } from "lucide-react";

/**
 * Filtros superiores del listado de pedidos.
 *
 * Renderiza presets de fecha, rango manual y acciones mobile. La logica de
 * aplicar filtros vive en el contenedor.
 */

export function OrdersFilters({
  filters,
  activeDatePreset,
  onApplyDatePreset,
  onApplySingleDateFilter,
  onFilterChange,
  onClearFilters,
}) {
  return (
    <section className="orders-filter-section" aria-label="Filtros de pedidos">
      <header className="orders-filter-section-head">
        <Filter size={15} strokeWidth={2.2} aria-hidden="true" />
        <h2>Filtros</h2>
      </header>

      <div className="orders-filter-ribbon">
        <div className="orders-date-presets" aria-label="Rangos rapidos">
          {[
            ["hoy", "Hoy"],
            ["ayer", "Ayer"],
            ["manana", "Manana"],
            ["semana", "Esta semana"],
            ["mes", "Este mes"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`orders-date-preset${activeDatePreset === key ? " is-active" : ""}`}
              onClick={() => onApplyDatePreset(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="orders-filter-date-range">
          <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
          <input type="date" value={filters.fechaDesde} onChange={event => onFilterChange("fechaDesde", event.target.value)} />
          <span aria-hidden="true">→</span>
          <input type="date" value={filters.fechaHasta} onChange={event => onFilterChange("fechaHasta", event.target.value)} />
        </label>

        <div className="orders-mobile-date-actions">
          <label className="orders-mobile-date-filter">
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
            <input
              type="date"
              value={filters.fechaDesde || filters.fechaHasta}
              onChange={event => onApplySingleDateFilter(event.target.value)}
            />
          </label>

          <button type="button" className="orders-mobile-clear-filter" onClick={onClearFilters}>
            <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
            <span>Limpiar</span>
          </button>
        </div>

        <button type="button" className="orders-filter-link" onClick={onClearFilters}>
          <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
          <span>Limpiar filtros</span>
        </button>
      </div>
    </section>
  );
}
