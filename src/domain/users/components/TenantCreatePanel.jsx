import { Building2, KeyRound, Store, UserCog } from "lucide-react";

import { buildSlug, normalizeTenantSlug } from "../usersDomain.js";

export function TenantCreatePanel({ form, setForm, saving, onSubmit }) {
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const updateNombreComercial = value => {
    setForm(current => {
      const previousSuggestedSlug = buildSlug(current.nombreComercial);
      const shouldSuggestSlug = !current.slug || current.slug === previousSuggestedSlug;
      return {
        ...current,
        nombreComercial: value,
        slug: shouldSuggestSlug ? buildSlug(value) : current.slug,
      };
    });
  };

  return (
    <article className="order-block users-create-block users-top-panel users-tenant-create-panel">
      <div className="users-panel-heading">
        <span className="users-panel-icon" aria-hidden="true"><Building2 size={18} strokeWidth={2} /></span>
        <div>
          <h4>Crear tenant</h4>
          <p className="orders-admin-subtitle">Crea la empresa, sucursal principal, roles, modulos base y usuario admin inicial.</p>
        </div>
      </div>

      <form className="users-create-form users-tenant-form" onSubmit={onSubmit}>
        <label>
          <span>Nombre comercial</span>
          <input value={form.nombreComercial} onChange={event => updateNombreComercial(event.target.value)} placeholder="La Fiore Casa de Flores" required minLength={3} />
        </label>
        <label>
          <span>Slug catalogo</span>
          <input
            value={form.slug}
            onChange={event => update("slug", buildSlug(event.target.value))}
            onBlur={event => update("slug", normalizeTenantSlug(event.target.value))}
            placeholder="flormar-caribe"
            required
            minLength={3}
            maxLength={80}
            title="Usa solo letras minusculas, numeros y guiones; sin espacios. Longitud de 3 a 80 caracteres."
          />
        </label>
        <label>
          <span>Plan</span>
          <select value={form.planID} onChange={event => update("planID", event.target.value)}>
            <option value="1">Plan 1</option>
            <option value="2">Plan 2</option>
            <option value="3">Plan 3</option>
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={form.estado} onChange={event => update("estado", event.target.value)}>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
        <label className="users-tenant-wide">
          <span><Store size={14} strokeWidth={2} aria-hidden="true" /> Sucursal principal</span>
          <input value={form.sucursalNombre} onChange={event => update("sucursalNombre", event.target.value)} placeholder="Principal La Fiore" />
        </label>
        <label>
          <span><UserCog size={14} strokeWidth={2} aria-hidden="true" /> Login admin</span>
          <input value={form.adminLogin} onChange={event => update("adminLogin", event.target.value)} placeholder="lafiore" required minLength={3} />
        </label>
        <label>
          <span><KeyRound size={14} strokeWidth={2} aria-hidden="true" /> Contrasena inicial</span>
          <input type="password" value={form.adminPassword} onChange={event => update("adminPassword", event.target.value)} placeholder="Minimo 6 caracteres" required minLength={6} />
        </label>
        <label className="users-tenant-wide">
          <span>Email admin (login)</span>
          <input type="email" value={form.adminEmail} onChange={event => update("adminEmail", event.target.value)} placeholder="admin@empresa.com" />
        </label>

        <p className="users-tenant-section-title">Datos comerciales de la empresa</p>

        <label>
          <span>NIT</span>
          <input value={form.nit} onChange={event => update("nit", event.target.value)} placeholder="Se autogenera si se deja vacio" />
        </label>
        <label>
          <span>Celular catalogo</span>
          <input value={form.celular} onChange={event => update("celular", event.target.value)} placeholder="Numero que ve el cliente en el catalogo" />
        </label>
        <label>
          <span>Ciudad</span>
          <input value={form.ciudad} onChange={event => update("ciudad", event.target.value)} placeholder="Bogota" />
        </label>
        <label className="users-tenant-wide">
          <span>Direccion</span>
          <input value={form.direccion} onChange={event => update("direccion", event.target.value)} placeholder="Calle 123 #45-67" />
        </label>

        <p className="users-tenant-section-title">Contacto / administrador responsable</p>

        <label>
          <span>Nombre del administrador</span>
          <input value={form.nombreResponsable} onChange={event => update("nombreResponsable", event.target.value)} placeholder="Nombre completo" />
        </label>
        <label>
          <span>Contacto (cargo)</span>
          <input value={form.cargoResponsable} onChange={event => update("cargoResponsable", event.target.value)} placeholder="Gerente, Encargado..." />
        </label>
        <label>
          <span>Celular</span>
          <input value={form.celularResponsable} onChange={event => update("celularResponsable", event.target.value)} placeholder="300 000 0000" />
        </label>
        <label>
          <span>Email de contacto</span>
          <input type="email" value={form.correoResponsable} onChange={event => update("correoResponsable", event.target.value)} placeholder="contacto@empresa.com" />
        </label>

        <button type="submit" className="btn-primary users-tenant-submit" disabled={saving}>
          <Building2 size={18} strokeWidth={2} aria-hidden="true" />
          {saving ? "Creando tenant..." : "Crear tenant"}
        </button>
      </form>
    </article>
  );
}
