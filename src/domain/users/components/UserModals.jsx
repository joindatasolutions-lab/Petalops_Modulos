import { Building2, CreditCard, X } from "lucide-react";

import { UserForm } from "./UserForm.jsx";

export function CreateUserModal({
  empresaSeleccionadaNombre,
  empresaID,
  empresas = [],
  setEmpresaID,
  canViewUsuariosGlobal,
  onClose,
  formProps,
}) {
  return (
    <div className="users-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="users-modal-panel users-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="users-create-modal-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="users-modal-head">
          <div>
            <p className="orders-admin-subtitle">Crear usuario</p>
            <h3 id="users-create-modal-title">Nuevo usuario</h3>
            <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
            {canViewUsuariosGlobal ? <p className="orders-admin-subtitle">Esta pantalla crea usuarios, no empresas nuevas.</p> : null}
            {canViewUsuariosGlobal ? (
              <label className="users-modal-tenant-picker">
                <span><Building2 size={15} strokeWidth={2} aria-hidden="true" /> Tenant para el nuevo usuario</span>
                <select value={empresaID} onChange={event => setEmpresaID?.(Number(event.target.value))}>
                  {empresas.map(item => (
                    <option key={item.empresaID} value={item.empresaID}>
                      {item.empresaSlug ? `${item.nombre} (ID ${item.empresaID} - ${item.empresaSlug})` : `${item.nombre} (ID ${item.empresaID})`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button type="button" className="users-modal-close" onClick={onClose} aria-label="Cerrar crear usuario">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <UserForm mode="create" canViewUsuariosGlobal={canViewUsuariosGlobal} onCancel={onClose} {...formProps} />
      </section>
    </div>
  );
}

export function PaymentMethodModal({
  empresaSeleccionadaNombre,
  empresaID,
  empresas = [],
  setEmpresaID,
  canViewUsuariosGlobal,
  editingItem,
  form,
  setForm,
  saving,
  onSubmit,
  onClose,
}) {
  const isEdit = Boolean(editingItem);

  return (
    <div className="users-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="users-modal-panel users-payment-method-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="users-payment-method-modal-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="users-modal-head">
          <div>
            <p className="orders-admin-subtitle">Metodos de pago</p>
            <h3 id="users-payment-method-modal-title">{isEdit ? "Editar metodo de pago" : "Crear metodo de pago"}</h3>
            <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
            {canViewUsuariosGlobal && !isEdit ? (
              <label className="users-modal-tenant-picker">
                <span><Building2 size={15} strokeWidth={2} aria-hidden="true" /> Tenant para el metodo de pago</span>
                <select value={empresaID} onChange={event => setEmpresaID?.(Number(event.target.value))}>
                  {empresas.map(item => (
                    <option key={item.empresaID} value={item.empresaID}>
                      {item.empresaSlug ? `${item.nombre} (ID ${item.empresaID} - ${item.empresaSlug})` : `${item.nombre} (ID ${item.empresaID})`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <button type="button" className="users-modal-close" onClick={onClose} aria-label="Cerrar crear metodo de pago">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <form className="users-create-form users-payment-method-form" onSubmit={onSubmit} autoComplete="off">
          <label className="users-payment-method-field">
            <span>Nombre del metodo</span>
            <input
              type="text"
              name="new-payment-method-name"
              placeholder="Ej. Nequi, Daviplata, Transferencia"
              value={form.nombre}
              autoComplete="off"
              onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))}
              required
              autoFocus
            />
          </label>

          <section className="users-payment-transfer-box" aria-label="Datos para transferir catalogo">
            <div className="users-payment-transfer-head">
              <div>
                <h4>Datos para transferir catalogo</h4>
                <p>Banco o cuenta y numero que puede consumir el catalogo cuando este activo.</p>
              </div>
              <label className="users-switch" title={form.activasCuentasCatalogo ? "Desactivar en catalogo" : "Activar en catalogo"}>
                <input
                  type="checkbox"
                  checked={Boolean(form.activasCuentasCatalogo)}
                  disabled={saving}
                  onChange={event => setForm(current => ({ ...current, activasCuentasCatalogo: event.target.checked }))}
                />
                <span className="users-switch-slider" />
              </label>
            </div>

            <div className="users-payment-transfer-grid">
              <label className="users-payment-method-field">
                <span>Banco o cuenta</span>
                <input
                  type="text"
                  name="payment-method-transfer-account"
                  placeholder="Ej. Nequi, Daviplata, Bancolombia"
                  value={form.cuenta || ""}
                  autoComplete="off"
                  onChange={event => setForm(current => ({ ...current, cuenta: event.target.value }))}
                />
              </label>

              <label className="users-payment-method-field">
                <span>Numero de cuenta</span>
                <input
                  type="text"
                  inputMode="text"
                  name="payment-method-transfer-number"
                  placeholder="Ej. 3001720582"
                  value={form.numeroCuenta || ""}
                  autoComplete="off"
                  onChange={event => setForm(current => ({ ...current, numeroCuenta: event.target.value }))}
                />
              </label>
            </div>
          </section>

          <div className="users-payment-method-note">
            <CreditCard size={18} strokeWidth={2} aria-hidden="true" />
            <p>El metodo queda disponible para pedidos. Los datos de transferencia solo salen al catalogo cuando el interruptor esta activo.</p>
          </div>

          <div className="users-modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Guardando..." : (isEdit ? "Guardar cambios" : "Crear metodo de pago")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function EditUserModal({
  editingUserId,
  editForm,
  empresaSeleccionadaNombre,
  empresaID,
  onClose,
  formProps,
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Cerrar edicion de usuario"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(64, 31, 52, 0.28)",
          border: "none",
          padding: 0,
          margin: 0,
          zIndex: 80,
          cursor: "pointer",
        }}
      />
      <section
        aria-label="Panel de edicion de usuario"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(720px, calc(100vw - 24px))",
          maxHeight: "min(88vh, 920px)",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(14px)",
          borderRadius: "28px",
          border: "1px solid rgba(206, 164, 183, 0.45)",
          boxShadow: "0 28px 80px rgba(110, 49, 77, 0.20)",
          zIndex: 81,
          overflowY: "auto",
          padding: "24px 20px 28px",
          display: "grid",
          alignContent: "start",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div>
            <p className="orders-admin-subtitle" style={{ marginBottom: 6 }}>Editar usuario</p>
            <h3 style={{ margin: 0 }}>#{editingUserId} {editForm.nombre || editForm.login || "Usuario"}</h3>
            <p className="orders-admin-subtitle" style={{ marginTop: 8 }}>Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>Cerrar</button>
        </div>

        <UserForm mode="edit" canViewUsuariosGlobal={formProps.canViewUsuariosGlobal} onCancel={onClose} {...formProps} />
      </section>
    </>
  );
}
