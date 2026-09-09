import { Building2, Palette, Type } from "lucide-react";

import { FONT_OPTIONS } from "../usersDomain.js";

function ColorField({ label, value, onChange }) {
  return (
    <label className="users-color-field">
      <span>{label}</span>
      <div className="users-color-field-row">
        <input
          type="color"
          value={value}
          onChange={event => onChange(event.target.value)}
          aria-label={`Selector de paleta para ${label}`}
        />
        <input
          type="text"
          value={value}
          onChange={event => onChange(event.target.value)}
          maxLength={7}
          pattern="^#[0-9a-fA-F]{6}$"
          className="users-color-hex-input"
        />
        <span className="users-color-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
      </div>
    </label>
  );
}

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
  themeForm,
  setThemeForm,
  themeSaving,
  onSaveTheme,
}) {
  const updateProfile = (field, value) => setProfileForm(current => ({ ...current, [field]: value }));
  const updateTheme = (field, value) => setThemeForm(current => ({ ...current, [field]: value }));

  return (
    <article className="order-block users-create-block users-top-panel users-company-profile-panel">
      <div className="users-panel-heading">
        <span className="users-panel-icon" aria-hidden="true"><Building2 size={18} strokeWidth={2} /></span>
        <div>
          <h4>Perfil y tema de la empresa</h4>
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

      <div className="users-theme-divider" />

      <div className="users-panel-heading">
        <span className="users-panel-icon" aria-hidden="true"><Palette size={18} strokeWidth={2} /></span>
        <div>
          <h4>Tema visual (catalogo web)</h4>
          <p className="orders-admin-subtitle">Color primario, color secundario y tipo de letra que usa el catalogo de esta empresa.</p>
        </div>
      </div>

      <form className="users-create-form users-theme-form" onSubmit={onSaveTheme}>
        <ColorField label="Color primario" value={themeForm.colorPrimario} onChange={value => updateTheme("colorPrimario", value)} />
        <ColorField label="Color secundario" value={themeForm.colorSecundario} onChange={value => updateTheme("colorSecundario", value)} />

        <label className="users-tenant-wide">
          <span><Type size={14} strokeWidth={2} aria-hidden="true" /> Tipo de letra</span>
          <select
            value={themeForm.fuenteFamilia}
            onChange={event => updateTheme("fuenteFamilia", event.target.value)}
            style={{ fontFamily: themeForm.fuenteFamilia }}
          >
            {FONT_OPTIONS.map(option => (
              <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="users-theme-preview" style={{ fontFamily: themeForm.fuenteFamilia }}>
          <p className="users-theme-preview-label">Vista previa</p>
          <div className="users-theme-preview-card" style={{ borderColor: themeForm.colorPrimario }}>
            <span className="users-theme-preview-badge" style={{ backgroundColor: themeForm.colorPrimario }}>Boton principal</span>
            <span className="users-theme-preview-badge users-theme-preview-badge-secondary" style={{ backgroundColor: themeForm.colorSecundario }}>Boton secundario</span>
            <p style={{ fontFamily: themeForm.fuenteFamilia }}>{empresaSeleccionadaNombre} — Bouquet de Rosas Premium $120.000</p>
          </div>
        </div>

        <button type="submit" className="btn-primary users-tenant-submit" disabled={themeSaving || loading}>
          {themeSaving ? "Guardando..." : "Guardar tema"}
        </button>
      </form>
    </article>
  );
}
