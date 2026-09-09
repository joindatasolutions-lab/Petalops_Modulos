import { Factory, Truck } from "lucide-react";

function AsignacionToggleCard({ icon, title, description, checked, disabled, onToggle }) {
  return (
    <article className="order-block users-acciones-card">
      <div className="users-acciones-card-head">
        <span className="users-panel-icon" aria-hidden="true">{icon}</span>
        <div>
          <h5>{title}</h5>
          <p className="orders-admin-subtitle">{description}</p>
        </div>
      </div>
      <label className="users-switch" title={checked ? "Desactivar" : "Activar"}>
        <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={onToggle} />
        <span className="users-switch-slider" />
      </label>
    </article>
  );
}

export function AccionesPanel({
  empresaID,
  empresaSeleccionadaNombre,
  empresas,
  setEmpresaID,
  canViewUsuariosGlobal,
  loading,
  saving,
  asignacionProduccionActiva,
  asignacionDomicilioActiva,
  onToggleProduccion,
  onToggleDomicilio,
}) {
  return (
    <section className="users-payment-layout">
      <article className="order-block users-create-block users-top-panel">
        <div className="users-panel-heading">
          <div>
            <h4>Acciones</h4>
            <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
            <p className="orders-admin-subtitle">Controla si el boton de autoasignacion aparece para el florista en Produccion y para el domiciliario en Domicilios.</p>
          </div>
        </div>

        {canViewUsuariosGlobal ? (
          <div className="users-create-form users-modulos-form users-payment-company-form">
            <label className="users-modulo-company-label" htmlFor="empresa-acciones-target">Empresa a configurar</label>
            <select
              id="empresa-acciones-target"
              value={empresaID}
              onChange={event => setEmpresaID(Number(event.target.value))}
            >
              {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.nombre}</option>)}
            </select>
          </div>
        ) : null}
      </article>

      {loading ? <p className="orders-message">Cargando configuracion de asignacion...</p> : null}

      <div className="users-acciones-grid">
        <AsignacionToggleCard
          icon={<Factory size={18} strokeWidth={2} />}
          title="Produccion"
          description="Permite que el florista se autoasigne pedidos pendientes en el modulo de Produccion."
          checked={asignacionProduccionActiva}
          disabled={saving || loading}
          onToggle={onToggleProduccion}
        />
        <AsignacionToggleCard
          icon={<Truck size={18} strokeWidth={2} />}
          title="Domicilios"
          description="Permite que el domiciliario se autoasigne domicilios pendientes en el modulo de Domicilios."
          checked={asignacionDomicilioActiva}
          disabled={saving || loading}
          onToggle={onToggleDomicilio}
        />
      </div>
    </section>
  );
}
