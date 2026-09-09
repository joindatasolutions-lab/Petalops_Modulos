import { Building2 } from "lucide-react";

export function CompanyProfilePanel({
  empresaID,
  empresaSeleccionadaNombre,
  empresas,
  setEmpresaID,
  loading,
  profileForm,
  setProfileForm,
  profileSaving,
  onSaveProfile,
}) {
  const updateProfile = (field, value) => setProfileForm(current => ({ ...current, [field]: value }));

  return (
    <article className="order-block users-create-block users-top-panel users-company-profile-panel">
      <div className="users-panel-heading">
        <span className="users-panel-icon" aria-hidden="true"><Building2 size={18} strokeWidth={2} /></span>
        <div>
          <h4>Perfil de la empresa</h4>
          <p className="orders-admin-subtitle">Empresa objetivo: <strong>{empresaSeleccionadaNombre}</strong> (ID {empresaID}).</p>
        </div>
      </div>

      <div className="users-create-form users-modulos-form" style={{ gap: 10 }}>
        <label className="users-modulo-company-label" htmlFor="empresa-perfil-target">Empresa a editar</label>
        <select
          id="empresa-perfil-target"
          value={empresaID}
          onChange={event => setEmpresaID(Number(event.target.value))}
        >
          {empresas.map(item => <option key={item.empresaID} value={item.empresaID}>{item.nombre}</option>)}
        </select>
      </div>

      {loading ? <p className="orders-message">Cargando datos de la empresa...</p> : null}

      <form className="users-create-form users-tenant-form" onSubmit={onSaveProfile}>
        <label>
          <span>Nombre comercial</span>
          <input value={profileForm.nombreComercial} onChange={event => updateProfile("nombreComercial", event.target.value)} minLength={3} required />
        </label>
        <label>
          <span>Estado</span>
          <select value={profileForm.estado} onChange={event => updateProfile("estado", event.target.value)}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
        <label>
          <span>NIT</span>
          <input value={profileForm.nit} onChange={event => updateProfile("nit", event.target.value)} />
        </label>
        <label>
          <span>Celular catalogo</span>
          <input value={profileForm.celular} onChange={event => updateProfile("celular", event.target.value)} />
        </label>
        <label>
          <span>Ciudad</span>
          <input value={profileForm.ciudad} onChange={event => updateProfile("ciudad", event.target.value)} />
        </label>
        <label className="users-tenant-wide">
          <span>Direccion</span>
          <input value={profileForm.direccion} onChange={event => updateProfile("direccion", event.target.value)} />
        </label>

        <p className="users-tenant-section-title">Contacto / administrador responsable</p>

        <label>
          <span>Nombre del administrador</span>
          <input value={profileForm.nombreResponsable} onChange={event => updateProfile("nombreResponsable", event.target.value)} />
        </label>
        <label>
          <span>Contacto (cargo)</span>
          <input value={profileForm.cargoResponsable} onChange={event => updateProfile("cargoResponsable", event.target.value)} />
        </label>
        <label>
          <span>Celular</span>
          <input value={profileForm.celularResponsable} onChange={event => updateProfile("celularResponsable", event.target.value)} />
        </label>
        <label>
          <span>Email de contacto</span>
          <input type="email" value={profileForm.correoResponsable} onChange={event => updateProfile("correoResponsable", event.target.value)} />
        </label>

        <button type="submit" className="btn-primary users-tenant-submit" disabled={profileSaving || loading}>
          {profileSaving ? "Guardando..." : `Guardar datos de ${empresaSeleccionadaNombre}`}
        </button>
      </form>
    </article>
  );
}
