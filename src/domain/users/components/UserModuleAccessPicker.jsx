export function UserModuleAccessPicker({
  summary,
  isOpen,
  onToggleOpen,
  modulesLoading,
  configuredModules,
  activeModules,
  compatibleModules,
  selectedModules,
  allSelected,
  onToggleAll,
  onToggleModule,
}) {
  const hasConfiguredModules = configuredModules.length > 0;

  return (
    <div className="users-user-module-picker">
      <p className="users-modulo-company-label">Modulos de acceso para este usuario</p>
      {modulesLoading ? <p className="orders-admin-subtitle">Cargando modulos disponibles...</p> : null}
      {!modulesLoading && !hasConfiguredModules ? <p className="orders-admin-subtitle">No hay modulos configurados para esta empresa.</p> : null}
      {!modulesLoading && activeModules.length > 0 && compatibleModules.length === 0 ? <p className="orders-admin-subtitle">No hay modulos activos disponibles para asignar.</p> : null}

      <button
        type="button"
        className={`users-module-dropdown-trigger ${isOpen ? "is-open" : ""}`}
        onClick={onToggleOpen}
        disabled={modulesLoading || !hasConfiguredModules}
      >
        <span>{summary}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {isOpen && hasConfiguredModules ? (
        <div className="users-module-dropdown-panel">
          <label className="users-user-module-item users-user-module-item-all">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={compatibleModules.length === 0}
              onChange={onToggleAll}
            />
            <span>{allSelected ? "Quitar todas las selecciones" : "Seleccionar todos los modulos permitidos"}</span>
          </label>
          <div className="users-user-module-grid">
            {configuredModules.map(modulo => {
              const checked = selectedModules.includes(modulo);
              const activeForEmpresa = activeModules.includes(modulo);
              return (
                <label
                  key={modulo}
                  className={`users-user-module-item ${checked ? "is-selected" : ""} ${activeForEmpresa ? "" : "is-disabled"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!activeForEmpresa}
                    onChange={() => onToggleModule(modulo)}
                  />
                  <span>{modulo}{!activeForEmpresa ? " (inactivo en la empresa)" : ""}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
