import { MODULE_HELP } from "../usersDomain.js";

export function CompanyModulesPanel({
  empresaID,
  empresaSeleccionadaNombre,
  empresas,
  setEmpresaID,
  modulesLoading,
  moduleItems,
  onToggleModule,
  showAdvancedModules,
  setShowAdvancedModules,
  newModulo,
  setNewModulo,
  onAddModulo,
  modulesSaving,
  onSaveModules,
}) {
  return (
    <article className="order-block users-create-block users-top-panel">
      <h4>Habilitacion comercial de modulos</h4>
      <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
      <p className="orders-admin-subtitle">Activa o desactiva modulos segun lo contratado para esta empresa.</p>

      <div className="users-create-form users-modulos-form" style={{ gap: 10 }}>
        <label className="users-modulo-company-label" htmlFor="empresa-modulos-target">Empresa a configurar</label>
        <select
          id="empresa-modulos-target"
          value={empresaID}
          onChange={event => setEmpresaID(Number(event.target.value))}
        >
          {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.nombre}</option>)}
        </select>
      </div>

      {modulesLoading ? <p className="orders-message">Cargando modulos...</p> : null}
      {!modulesLoading && moduleItems.length === 0 ? <p className="orders-message">No hay modulos configurables.</p> : null}
      <div className="users-create-form users-modulos-form" style={{ gap: 10 }}>
        {moduleItems.map(item => (
          <div key={item.modulo} className="users-modulo-item">
            <div className="users-modulo-head">
              <div>
                <strong>{item.modulo}</strong>
                <p className="users-modulo-help">{MODULE_HELP[item.modulo] || "Modulo personalizado para habilitacion comercial."}</p>
              </div>
              <label className="users-switch" title={`Activar o desactivar ${item.modulo}`}>
                <input
                  type="checkbox"
                  checked={Boolean(item.activo)}
                  onChange={() => onToggleModule(item.modulo)}
                />
                <span className="users-switch-slider" />
              </label>
            </div>
          </div>
        ))}

        <button type="button" className="btn-outline" onClick={() => setShowAdvancedModules(current => !current)}>
          {showAdvancedModules ? "Ocultar configuracion avanzada" : "Mostrar configuracion avanzada"}
        </button>

        {showAdvancedModules ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Nuevo modulo (ej: marketing)"
              value={newModulo}
              onChange={event => setNewModulo(event.target.value)}
            />
            <button type="button" className="btn-outline" onClick={onAddModulo}>Adicionar</button>
          </div>
        ) : null}

        <button type="button" className="btn-primary" onClick={onSaveModules} disabled={modulesSaving || modulesLoading || moduleItems.length === 0}>
          {modulesSaving ? "Guardando..." : `Guardar modulos en ${empresaSeleccionadaNombre}`}
        </button>
      </div>
    </article>
  );
}
