export function PipelineFilters({ filters, onChange, onRefresh }) {
  return (
    <section className="pipeline-filters">
      <label className="pipeline-filter-field">
        <span>Búsqueda</span>
        <input
          className="pipeline-filter-search"
          type="text"
          placeholder="Buscar # pedido..."
          value={filters.numeroPedido}
          onChange={event => onChange("numeroPedido", event.target.value)}
        />
      </label>
      <label className="pipeline-filter-field">
        <span>Fecha Inicio</span>
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
          type="number"
          placeholder="Domiciliario"
          value={filters.domiciliarioID ?? ""}
          onChange={event => onChange("domiciliarioID", event.target.value ? Number(event.target.value) : null)}
        />
      </label>
      <label className="pipeline-filter-field">
        <span>Florista</span>
        <input
          className="pipeline-filter-florista"
          type="number"
          placeholder="Florista"
          value={filters.floristaID ?? ""}
          onChange={event => onChange("floristaID", event.target.value ? Number(event.target.value) : null)}
        />
      </label>
      <div className="pipeline-filter-toggles">
        <label className="pipeline-filter-check">
          <input
            type="checkbox"
            checked={filters.soloHoy}
            onChange={event => onChange("soloHoy", event.target.checked)}
          />
          Solo hoy
        </label>
        <label className="pipeline-filter-check">
          <input
            type="checkbox"
            checked={filters.soloAtrasados}
            onChange={event => onChange("soloAtrasados", event.target.checked)}
          />
          Atrasados
        </label>
        <label className="pipeline-filter-check">
          <input
            type="checkbox"
            checked={filters.soloEnProduccion}
            onChange={event => onChange("soloEnProduccion", event.target.checked)}
          />
          En produccion
        </label>
      </div>
      <button type="button" className="btn-primary pipeline-filter-refresh" onClick={onRefresh}>Actualizar</button>
    </section>
  );
}


