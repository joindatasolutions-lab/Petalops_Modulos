import { CreditCard, Pencil, Plus } from "lucide-react";

export function PaymentMethodsPanel({
  empresaID,
  empresaSeleccionadaNombre,
  empresas,
  setEmpresaID,
  canViewUsuariosGlobal,
  loading,
  items,
  saving,
  onCreate,
  onEdit,
  onToggleActive,
}) {
  return (
    <section className="users-payment-layout">
      <article className="order-block users-create-block users-top-panel">
        <div className="users-payment-panel-head">
          <div>
            <h4>Metodos de pago</h4>
            <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
            <p className="orders-admin-subtitle">Administra las opciones que aparecen al registrar o editar pedidos.</p>
          </div>
          <button type="button" className="btn-primary users-create-open-btn" onClick={onCreate}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            Crear metodo de pago
          </button>
        </div>

        {canViewUsuariosGlobal ? (
          <div className="users-create-form users-modulos-form users-payment-company-form">
            <label className="users-modulo-company-label" htmlFor="empresa-payment-methods-target">Empresa a configurar</label>
            <select
              id="empresa-payment-methods-target"
              value={empresaID}
              onChange={event => setEmpresaID(Number(event.target.value))}
            >
              {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.nombre}</option>)}
            </select>
          </div>
        ) : null}
      </article>

      <article className="orders-table-wrap users-table-wrap users-table-panel">
        <table className="orders-table users-table users-payment-methods-table">
          <thead>
            <tr>
              <th>Metodo</th>
              <th>Codigo</th>
              <th>Orden</th>
              <th>Estado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Cargando metodos de pago...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>No hay metodos de pago configurados para esta empresa.</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td data-label="Metodo">
                  <div className="users-payment-method-name">
                    <CreditCard size={17} strokeWidth={2} aria-hidden="true" />
                    <strong>{item.nombre}</strong>
                  </div>
                </td>
                <td data-label="Codigo">{item.codigo || "-"}</td>
                <td data-label="Orden">{item.orden ?? "-"}</td>
                <td data-label="Estado">
                  <span className={`users-module-chip ${item.activo ? "is-active" : "is-inactive"}`}>
                    {item.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td data-label="Accion">
                  <div className="users-payment-method-actions">
                    <button type="button" className="btn-outline" onClick={() => onEdit(item)}>
                      <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                      Editar
                    </button>
                    <label className="users-switch" title={`${item.activo ? "Inactivar" : "Activar"} ${item.nombre}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(item.activo)}
                        disabled={saving}
                        onChange={() => onToggleActive(item)}
                      />
                      <span className="users-switch-slider" />
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
