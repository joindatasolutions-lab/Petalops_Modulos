import { Bike, Building2, Calendar, Filter, Flower2, Search } from "lucide-react";

const PIPELINE_STATE_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "creado", label: "Creado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "pendiente_produccion", label: "Pendiente produccion" },
  { value: "en_produccion", label: "En produccion" },
  { value: "listo", label: "Listo" },
  { value: "en_camino", label: "En camino" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "atrasados", label: "Solo atrasados" },
  { value: "produccion", label: "Pendiente / En produccion" },
];

export function PipelineFilters({ filters, onChange }) {
  const estadoFiltro = filters.soloAtrasados
    ? "atrasados"
    : filters.soloEnProduccion
    ? "produccion"
    : filters.estadoStage || "";

  const onEstadoChange = value => {
    onChange("estadoStage", "");
    onChange("soloAtrasados", value === "atrasados");
    onChange("soloEnProduccion", value === "produccion");
    if (value !== "atrasados" && value !== "produccion") {
      onChange("estadoStage", value);
    }
  };

  const onFechaDesdeChange = value => {
    onChange("fechaDesde", value);
    if (value && filters.fechaHasta && value > filters.fechaHasta) {
      onChange("fechaHasta", value);
    }
  };

  return (
    <section className="orders-filters orders-page-filters pipeline-filters-bar">
      <label className="filter-field orders-filter-field">
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

      <div className="filter-field orders-filter-field">
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

      <div className="filter-field orders-filter-field">
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

      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Filter size={17} strokeWidth={2} aria-hidden="true" />
          <select value={estadoFiltro} onChange={event => onEstadoChange(event.target.value)}>
            {PIPELINE_STATE_OPTIONS.map(option => (
              <option key={option.value || "todos"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
