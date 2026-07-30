export function CompanyModulesSummaryTable({ loading, items }) {
  return (
    <article className="orders-table-wrap users-table-wrap users-table-panel">
      <table className="orders-table users-table users-company-modules-table">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Plan</th>
            <th>Estado</th>
            <th>Modulos Activos</th>
            <th>Modulos Inactivos</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5}>Cargando resumen de modulos...</td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={5}>No hay empresas para mostrar.</td>
            </tr>
          ) : items.map(item => {
            const active = (item.items || []).filter(module => Boolean(module.activo)).map(module => module.modulo);
            const inactive = (item.items || []).filter(module => !Boolean(module.activo)).map(module => module.modulo);
            return (
              <tr key={item.empresaID}>
                <td data-label="Empresa">{item.nombre} (ID {item.empresaID})</td>
                <td data-label="Plan">{item.planID != null ? item.planID : "-"}</td>
                <td data-label="Estado">{item.estado || "-"}</td>
                <td data-label="Modulos Activos">
                  <div className="users-module-chip-wrap">
                    {active.length === 0 ? <span className="users-module-chip is-inactive">Ninguno</span> : active.map(module => <span key={`${item.empresaID}-a-${module}`} className="users-module-chip is-active">{module}</span>)}
                  </div>
                </td>
                <td data-label="Modulos Inactivos">
                  <div className="users-module-chip-wrap">
                    {inactive.length === 0 ? <span className="users-module-chip is-active">Ninguno</span> : inactive.map(module => <span key={`${item.empresaID}-i-${module}`} className="users-module-chip is-inactive">{module}</span>)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}
