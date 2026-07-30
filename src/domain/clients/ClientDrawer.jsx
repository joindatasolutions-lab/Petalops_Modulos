export function ClientDrawer({ drawerOpen, editingClienteId, form, saving, onChangeForm, onClose, onSubmit }) {
  return (
    <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
      <div className="orders-drawer-head">
        <strong>{editingClienteId != null ? "Editar cliente" : "Agregar cliente"}</strong>
        <div className="orders-drawer-head-actions">
          <button type="button" className="icon-btn" onClick={onClose} title="Cerrar barra lateral">x</button>
        </div>
      </div>
      <div className="orders-drawer-body">
        {!drawerOpen ? (
          <p className="order-drawer-empty">Usa Agregar o Editar para administrar clientes.</p>
        ) : (
          <form className="users-create-form" onSubmit={onSubmit}>
            <ClientFormField label="Tipo documento">
              <select value={form.tipoIdent} onChange={event => onChangeForm("tipoIdent", event.target.value)}>
                <option value="CC">CC</option><option value="NIT">NIT</option><option value="CE">CE</option><option value="PASAPORTE">Pasaporte</option>
              </select>
            </ClientFormField>
            <ClientFormField label="Documento"><input type="text" value={form.identificacion} onChange={event => onChangeForm("identificacion", event.target.value)} /></ClientFormField>
            <ClientFormField label="Nombre completo"><input type="text" value={form.nombreCompleto} onChange={event => onChangeForm("nombreCompleto", event.target.value)} required /></ClientFormField>
            <ClientFormField label="Indicativo"><input type="text" value={form.indicativo} onChange={event => onChangeForm("indicativo", event.target.value)} placeholder="+57" /></ClientFormField>
            <ClientFormField label="Telefono"><input type="text" value={form.telefono} onChange={event => onChangeForm("telefono", event.target.value)} /></ClientFormField>
            <ClientFormField label="Email"><input type="email" value={form.email} onChange={event => onChangeForm("email", event.target.value)} /></ClientFormField>
            <ClientFormField label="Fecha cumpleanos"><input type="date" value={form.fechaCumpleanos} onChange={event => onChangeForm("fechaCumpleanos", event.target.value)} /></ClientFormField>
            <ClientFormField label="Fecha aniversario"><input type="date" value={form.fechaAniversario} onChange={event => onChangeForm("fechaAniversario", event.target.value)} /></ClientFormField>
            <ClientFormField label="Estado">
              <select value={form.activo ? "1" : "0"} onChange={event => onChangeForm("activo", event.target.value === "1")}>
                <option value="1">Activo</option><option value="0">Inactivo</option>
              </select>
            </ClientFormField>
            <div className="order-actions">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Guardando..." : editingClienteId != null ? "Editar" : "Agregar"}</button>
              <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
function ClientFormField({ children, label }) {
  return <label className="order-detail-edit-label">{label}{children}</label>;
}
