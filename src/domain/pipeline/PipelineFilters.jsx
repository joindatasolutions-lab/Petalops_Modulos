import { Calendar, Filter, Search } from "lucide-react";

import { PIPELINE_STATE_OPTIONS } from "./pipelineConfig.jsx";
import { applyEstadoFilterValue, resolveEstadoFiltro } from "./pipelineDomain.js";

export function PipelineFilters({ filters, onChange }) {
  const estadoFiltro = resolveEstadoFiltro(filters);
  const onEstadoChange = value => applyEstadoFilterValue(value, onChange);
  const onDateChange = value => {
    onChange("fechaDesde", value);
    onChange("fechaHasta", value);
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
            aria-label="Buscar pedido o cliente"
          />
        </div>
      </label>

      <div className="filter-field orders-filter-field pipeline-filter-date">
        <div className="orders-filter-control">
          <Calendar size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="date"
            value={filters.fechaDesde || ""}
            onChange={event => onDateChange(event.target.value)}
            aria-label="Fecha"
            title="Fecha"
          />
        </div>
      </div>

      <div className="filter-field orders-filter-field pipeline-filter-state">
        <div className="orders-filter-control">
          <Filter size={17} strokeWidth={2} aria-hidden="true" />
          <select value={estadoFiltro} onChange={event => onEstadoChange(event.target.value)} aria-label="Estado">
            {PIPELINE_STATE_OPTIONS.map(option => (
              <option key={option.value || "todos"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
