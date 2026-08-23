import { Save, X } from "lucide-react";

export function ClientDrawer({ drawerOpen, editingClienteId, form, saving, onChangeForm, onClose, onSubmit }) {
  const submitLabel = editingClienteId != null ? "Guardar cambios" : "Crear cliente";
  return (
    <>
      <button
        type="button"
        className={`clients-drawer-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={onClose}
        aria-label="Cerrar editor de cliente"
        tabIndex={drawerOpen ? 0 : -1}
      />
      <aside className={`orders-drawer clients-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <div className="clients-drawer-title">
            <strong>{editingClienteId != null ? "Editar cliente" : "Agregar cliente"}</strong>
            <span>{editingClienteId != null ? "Actualiza la ficha y datos de contacto." : "Completa los datos principales del cliente."}</span>
          </div>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={onClose} title="Cerrar barra lateral">
              <X size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="orders-drawer-body">
          {!drawerOpen ? (
            <p className="order-drawer-empty">Usa Agregar o Editar para administrar clientes.</p>
          ) : (
            <form className="clients-drawer-form" onSubmit={onSubmit}>
            <section className="clients-form-section">
              <h3>Identificacion</h3>
              <div className="clients-form-grid">
                <ClientFormField label="Tipo documento">
                  <select value={form.tipoIdent} onChange={event => onChangeForm("tipoIdent", event.target.value)}>
                    <option value="CC">CC</option><option value="NIT">NIT</option><option value="CE">CE</option><option value="PASAPORTE">Pasaporte</option>
                  </select>
                </ClientFormField>
                <ClientFormField label="Documento">
                  <input type="text" value={form.identificacion} onChange={event => onChangeForm("identificacion", event.target.value)} />
                </ClientFormField>
                <ClientFormField label="Nombre completo" wide>
                  <input type="text" value={form.nombreCompleto} onChange={event => onChangeForm("nombreCompleto", event.target.value)} required />
                </ClientFormField>
              </div>
            </section>

            <section className="clients-form-section">
              <h3>Contacto</h3>
              <div className="clients-phone-row">
                <ClientFormField label="Indicativo">
                  <input type="text" value={form.indicativo} onChange={event => onChangeForm("indicativo", event.target.value)} placeholder="+57" />
                </ClientFormField>
                <ClientFormField label="Telefono">
                  <input type="text" value={form.telefono} onChange={event => onChangeForm("telefono", event.target.value)} />
                </ClientFormField>
              </div>
              <ClientFormField label="Email">
                <input type="email" value={form.email} onChange={event => onChangeForm("email", event.target.value)} />
              </ClientFormField>
            </section>

            <section className="clients-form-section">
              <h3>Fechas y estado</h3>
              <div className="clients-form-grid">
                <ClientFormField label="Fecha cumpleanos">
                  <input type="date" value={form.fechaCumpleanos} onChange={event => onChangeForm("fechaCumpleanos", event.target.value)} />
                </ClientFormField>
                <ClientFormField label="Fecha aniversario">
                  <input type="date" value={form.fechaAniversario} onChange={event => onChangeForm("fechaAniversario", event.target.value)} />
                </ClientFormField>
              </div>
              <label className="clients-status-toggle">
                <input type="checkbox" checked={form.activo} onChange={event => onChangeForm("activo", event.target.checked)} />
                <span />
                <strong>{form.activo ? "Cliente activo" : "Cliente inactivo"}</strong>
              </label>
            </section>

            <div className="clients-drawer-actions">
              <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>{saving ? "Guardando..." : submitLabel}</span>
              </button>
            </div>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
function ClientFormField({ children, label, wide = false }) {
  return <label className={`clients-form-field${wide ? " is-wide" : ""}`}>{label}{children}</label>;
}
