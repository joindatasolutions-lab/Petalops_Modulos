import { Building2, X } from "lucide-react";

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
