export function PipelineFilters({ filters, onChange }) {
  return (
    <section className="pipeline-filters">
      <label className="pipeline-filter-field">
        <span>Número pedido</span>
        <input
          className="pipeline-filter-search"
          type="text"
          placeholder="Buscar # pedido..."
          value={filters.numeroPedido}
          onChange={event => onChange("numeroPedido", event.target.value)}
        />
      </label>
      <label className="pipeline-filter-field">
        <span>Fecha</span>
        <input
          className="pipeline-filter-date"
          type="date"
          value={filters.fecha}
          onChange={event => onChange("fecha", event.target.value)}
        />
      </label>
      <label className="pipeline-filter-field">
        <span>Sucursal</span>
        <input
          className="pipeline-filter-sucursal"
          type="number"
          placeholder="Sucursal"
          value={filters.sucursalID ?? ""}
          onChange={event => onChange("sucursalID", event.target.value ? Number(event.target.value) : null)}
        />
      </label>
      <label className="pipeline-filter-field">
        <span>Domiciliario</span>
        <input
          className="pipeline-filter-domiciliario"
          type="text"
          placeholder="Nombre o ID domiciliario"
          value={filters.domiciliarioID ?? ""}
          onChange={event => onChange("domiciliarioID", event.target.value)}
        />
      </label>
      <label className="pipeline-filter-field">
        <span>Florista</span>
        <input
          className="pipeline-filter-florista"
          type="text"
          placeholder="Nombre o ID florista"
          value={filters.floristaID ?? ""}
          onChange={event => onChange("floristaID", event.target.value)}
        />
      </label>
      <div className="pipeline-filter-toggles">
        <label className="pipeline-filter-check">
          <input
            type="checkbox"
            checked={filters.soloAtrasados}
            onChange={event => onChange("soloAtrasados", event.target.checked)}
          />
          <span>Atrasados</span>
        </label>
        <label className="pipeline-filter-check">
          <input
            type="checkbox"
            checked={filters.soloEnProduccion}
            onChange={event => onChange("soloEnProduccion", event.target.checked)}
          />
          <span>En producción</span>
        </label>
      </div>
    </section>
  );
}
