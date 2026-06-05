import { Bike, Building2, Calendar, Filter, Flower2, Search } from "lucide-react";

export function PipelineFilters({ filters, onChange }) {
  const estadoFiltro = filters.soloAtrasados
    ? "atrasados"
    : filters.soloEnProduccion
    ? "produccion"
    : "";

  const onEstadoChange = value => {
    onChange("soloAtrasados",    value === "atrasados");
    onChange("soloEnProduccion", value === "produccion");
  };

  return (
    <section className="orders-filters orders-page-filters pipeline-filters-bar">

      {/* Buscar */}
      <label className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Search size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="# Pedido, cliente..."
            value={filters.numeroPedido}
            onChange={e => onChange("numeroPedido", e.target.value)}
          />
        </div>
      </label>

      {/* Fecha */}
      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Calendar size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="date"
            value={filters.fecha}
            onChange={e => onChange("fecha", e.target.value)}
          />
        </div>
      </div>

      {/* Sucursal */}
      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Building2 size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="number"
            placeholder="ID sucursal"
            value={filters.sucursalID ?? ""}
            onChange={e => onChange("sucursalID", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      {/* Florista */}
      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            placeholder="Nombre o ID"
            value={filters.floristaID ?? ""}
            onChange={e => onChange("floristaID", e.target.value)}
          />
        </div>
      </div>

      {/* Domiciliario */}
      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Bike size={17} strokeWidth={2} aria-hidden="true" />
          <input
            type="text"
            placeholder="Nombre o ID"
            value={filters.domiciliarioID ?? ""}
            onChange={e => onChange("domiciliarioID", e.target.value)}
          />
        </div>
      </div>

      {/* Estado — select en lugar de toggles */}
      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Filter size={17} strokeWidth={2} aria-hidden="true" />
          <select value={estadoFiltro} onChange={e => onEstadoChange(e.target.value)}>
            <option value="">Todos</option>
            <option value="atrasados">Solo atrasados</option>
            <option value="produccion">En producción</option>
          </select>
        </div>
      </div>

    </section>
  );
}
