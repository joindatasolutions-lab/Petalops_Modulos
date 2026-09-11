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
  datosTransferenciaCatalogoActivo,
  onCreate,
  onEdit,
  onToggleActive,
  onToggleCatalogAccount,
  onToggleCatalogTransfer,
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
              <th>Datos catalogo</th>
              <th>Catalogo</th>
              <th>Orden</th>
              <th>Estado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>Cargando metodos de pago...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7}>No hay metodos de pago configurados para esta empresa.</td>
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
                <td data-label="Datos catalogo">
                  <div className="users-payment-transfer-cell">
                    <strong>{item.cuenta || "-"}</strong>
                    <span>{item.numeroCuenta || item.numero_cuenta || "Sin numero"}</span>
                  </div>
                </td>
                <td data-label="Catalogo">
                  <label className="users-switch" title={`${(item.activasCuentasCatalogo ?? item.activas_cuentas_catalogo) ? "Ocultar" : "Mostrar"} datos para transferir en catalogo`}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.activasCuentasCatalogo ?? item.activas_cuentas_catalogo)}
                      disabled={saving}
                      onChange={() => onToggleCatalogAccount?.(item)}
                    />
                    <span className="users-switch-slider" />
                  </label>
                </td>
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

      <article className="order-block users-payment-catalog-panel">
        <div className="users-payment-catalog-head">
          <div>
            <h4>Datos para transferir catalogo</h4>
            <p className="orders-admin-subtitle">Configura banco o cuenta, numero y visibilidad para el catalogo de {empresaSeleccionadaNombre}.</p>
          </div>
          <div className="users-payment-catalog-master">
            <span>{datosTransferenciaCatalogoActivo ? "Activo en catalogo" : "Inactivo en catalogo"}</span>
            <label className="users-switch" title={datosTransferenciaCatalogoActivo ? "Ocultar bloque en catalogo" : "Mostrar bloque en catalogo"}>
              <input
                type="checkbox"
                checked={Boolean(datosTransferenciaCatalogoActivo)}
                disabled={saving || loading}
                onChange={() => onToggleCatalogTransfer?.()}
              />
              <span className="users-switch-slider" />
            </label>
          </div>
        </div>

        <div className={`users-payment-catalog-status ${datosTransferenciaCatalogoActivo ? "is-active" : "is-inactive"}`}>
          {datosTransferenciaCatalogoActivo
            ? "El catalogo puede mostrar el bloque Datos para transferir usando las cuentas activas."
            : "El bloque Datos para transferir no se mostrara en el catalogo hasta activar este interruptor."}
        </div>

        {loading ? (
          <p className="orders-message">Cargando datos de transferencia...</p>
        ) : items.length === 0 ? (
          <p className="orders-message">Primero crea un metodo de pago para agregar datos de transferencia.</p>
        ) : (
          <div className="users-payment-catalog-grid">
            {items.map(item => {
              const numeroCuenta = item.numeroCuenta || item.numero_cuenta || "";
              const catalogActive = Boolean(item.activasCuentasCatalogo ?? item.activas_cuentas_catalogo);
              return (
                <div className="users-payment-catalog-card" key={`catalog-${item.id}`}>
                  <div className="users-payment-catalog-card-main">
                    <div className="users-payment-method-name">
                      <CreditCard size={17} strokeWidth={2} aria-hidden="true" />
                      <strong>{item.nombre}</strong>
                    </div>
                    <div className="users-payment-catalog-data">
                      <span>{item.cuenta || "Banco o cuenta pendiente"}</span>
                      <strong>{numeroCuenta || "Numero de cuenta pendiente"}</strong>
                    </div>
                  </div>

                  <div className="users-payment-catalog-actions">
                    <label className="users-switch" title={`${catalogActive ? "Ocultar" : "Mostrar"} datos para transferir en catalogo`}>
                      <input
                        type="checkbox"
                        checked={catalogActive}
                        disabled={saving}
                        onChange={() => onToggleCatalogAccount?.(item)}
                      />
                      <span className="users-switch-slider" />
                    </label>
                    <button type="button" className="btn-outline" onClick={() => onEdit(item)}>
                      <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                      Editar datos
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
