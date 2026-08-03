import { Building2, Filter, Search, Store } from "lucide-react";

export function UsersFilters({
  canViewUsuariosGlobal,
  empresaID,
  setEmpresaID,
  empresaSeleccionadaNombre,
  empresas,
  sucursalID,
  setSucursalID,
  sucursales,
  estadoFiltro,
  setEstadoFiltro,
  q,
  setQ,
}) {
  return (
    <section className="orders-filters orders-page-filters users-filters">
      {canViewUsuariosGlobal ? (
        <div className="filter-field orders-filter-field">
          <div className="orders-filter-control">
            <Building2 size={17} strokeWidth={2} aria-hidden="true" />
            <select value={empresaID} onChange={event => setEmpresaID(Number(event.target.value))}>
              {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.empresaSlug ? `${item.nombre} (ID ${item.empresaID} - ${item.empresaSlug})` : `${item.nombre} (ID ${item.empresaID})`}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="filter-field orders-filter-field">
          <div className="orders-filter-control">
            <Building2 size={17} strokeWidth={2} aria-hidden="true" />
            <input
              type="text"
              value={empresaSeleccionadaNombre}
              readOnly
              title="Tu alcance esta limitado a tu empresa"
            />
          </div>
        </div>
      )}

      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Store size={17} strokeWidth={2} aria-hidden="true" />
          <select value={sucursalID} onChange={event => setSucursalID(event.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(item => <option key={item.sucursalID} value={item.sucursalID}>Sucursal {item.sucursalID}</option>)}
          </select>
        </div>
      </div>

      <div className="filter-field orders-filter-field">
        <div className="orders-filter-control">
          <Filter size={17} strokeWidth={2} aria-hidden="true" />
          <select value={estadoFiltro} onChange={event => setEstadoFiltro(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="filter-field orders-filter-field users-search-filter">
        <div className="orders-filter-control">
          <Search size={17} strokeWidth={2} aria-hidden="true" />
          <input type="text" placeholder="Buscar por nombre o login" value={q} onChange={event => setQ(event.target.value)} />
        </div>
      </div>
    </section>
  );
}
