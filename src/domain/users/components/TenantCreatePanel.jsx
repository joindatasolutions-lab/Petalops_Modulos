import { useEffect, useState } from "react";
import { AtSign, BriefcaseBusiness, Building2, Eye, EyeOff, Image, KeyRound, Link, Mail, MapPin, Phone, Store, UserCog, X } from "lucide-react";

import { TENANT_LOGO_ACCEPT, buildSlug, normalizeTenantSlug } from "../usersDomain.js";

function OptionalHint() {
  return <em className="users-tenant-optional">Opcional</em>;
}

function FieldError({ message }) {
  return message ? <small className="users-tenant-field-error">{message}</small> : null;
}

export function TenantCreatePanel({ form, setForm, saving, onSubmit, onCancel, fieldErrors = {}, mode = "create" }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const isEdit = mode === "edit";
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const errorFor = field => fieldErrors?.[field] || "";
  const fieldClass = field => errorFor(field) ? "users-tenant-field-invalid" : "";
  const updateNombreComercial = value => {
    setForm(current => {
      const previousSuggestedSlug = buildSlug(current.nombreComercial);
      const shouldSuggestSlug = !current.slug || current.slug === previousSuggestedSlug;
      const shouldSuggestRazonSocial = !current.nombreEmpresa || current.nombreEmpresa === current.nombreComercial;
      return {
        ...current,
        nombreComercial: value,
        nombreEmpresa: shouldSuggestRazonSocial ? value : current.nombreEmpresa,
        slug: shouldSuggestSlug ? buildSlug(value) : current.slug,
      };
    });
  };
  const updateLogoFile = file => update("logoFile", file || null);

  useEffect(() => {
    if (!form.logoFile) {
      setLogoPreviewUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(form.logoFile);
    setLogoPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [form.logoFile]);

  return (
    <article className="order-block users-create-block users-top-panel users-tenant-create-panel">
      <div className="users-panel-heading">
        <span className="users-panel-icon" aria-hidden="true"><Building2 size={18} strokeWidth={2} /></span>
        <div>
          <h4>{isEdit ? "Editar empresa" : "Crear empresa"}</h4>
          <p className="orders-admin-subtitle">
            {isEdit
              ? "Actualiza la informacion comercial, responsable y recepcion de pedidos de la empresa."
              : "Registra la empresa, su contacto, la operacion inicial y la cuenta de acceso."}
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            className="users-tenant-close"
            onClick={onCancel}
            aria-label={isEdit ? "Cerrar editar empresa" : "Cerrar crear empresa"}
            title="Cerrar"
          >
            <X size={16} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <form className="users-create-form users-tenant-form" onSubmit={onSubmit}>
        <fieldset className="users-tenant-section">
          <legend>1. Empresa</legend>
          <label>
            <span>Nombre comercial</span>
            <input className={fieldClass("nombreComercial")} value={form.nombreComercial} onChange={event => updateNombreComercial(event.target.value)} placeholder="La Fiore Casa de Flores" required minLength={3} aria-invalid={Boolean(errorFor("nombreComercial"))} />
            <FieldError message={errorFor("nombreComercial")} />
          </label>
          <label>
            <span>Razon social</span>
            <input className={fieldClass("nombreEmpresa")} value={form.nombreEmpresa} onChange={event => update("nombreEmpresa", event.target.value)} placeholder="La Fiore S.A.S." required minLength={3} aria-invalid={Boolean(errorFor("nombreEmpresa"))} />
            <FieldError message={errorFor("nombreEmpresa")} />
          </label>
          <label>
            <span>NIT / Identificacion <OptionalHint /></span>
            <input value={form.nit || ""} onChange={event => update("nit", event.target.value)} placeholder="900123456-7" />
          </label>
          <label>
            <span><MapPin size={14} strokeWidth={2} aria-hidden="true" /> Ciudad</span>
            <input className={fieldClass("ciudad")} value={form.ciudad} onChange={event => update("ciudad", event.target.value)} placeholder="Barranquilla" required aria-invalid={Boolean(errorFor("ciudad"))} />
            <FieldError message={errorFor("ciudad")} />
          </label>
          <label className="users-tenant-wide">
            <span>Direccion del negocio</span>
            <input className={fieldClass("direccion")} value={form.direccion} onChange={event => update("direccion", event.target.value)} placeholder="Calle 84 # 52 - 18" required aria-invalid={Boolean(errorFor("direccion"))} />
            <FieldError message={errorFor("direccion")} />
          </label>
        </fieldset>

        <fieldset className="users-tenant-section users-tenant-section-responsible">
          <legend>2. Contacto principal</legend>
          <label>
            <span><UserCog size={14} strokeWidth={2} aria-hidden="true" /> Nombre del contacto</span>
            <input className={fieldClass("nombreResponsable")} value={form.nombreResponsable} onChange={event => update("nombreResponsable", event.target.value)} placeholder="Maria Perez" required aria-invalid={Boolean(errorFor("nombreResponsable"))} />
            <FieldError message={errorFor("nombreResponsable")} />
          </label>
          <label>
            <span><BriefcaseBusiness size={14} strokeWidth={2} aria-hidden="true" /> Cargo <OptionalHint /></span>
            <input value={form.cargoResponsable} onChange={event => update("cargoResponsable", event.target.value)} placeholder="Gerente" />
          </label>
          <label>
            <span><Mail size={14} strokeWidth={2} aria-hidden="true" /> Correo electronico</span>
            <input className={fieldClass("correoResponsable")} type="email" value={form.correoResponsable} onChange={event => update("correoResponsable", event.target.value)} placeholder="responsable@empresa.com" required aria-invalid={Boolean(errorFor("correoResponsable"))} />
            <FieldError message={errorFor("correoResponsable")} />
          </label>
          <label>
            <span><Phone size={14} strokeWidth={2} aria-hidden="true" /> Celular del contacto</span>
            <input className={fieldClass("celularResponsable")} type="tel" value={form.celularResponsable} onChange={event => update("celularResponsable", event.target.value)} placeholder="3001234567" required aria-invalid={Boolean(errorFor("celularResponsable"))} />
            <FieldError message={errorFor("celularResponsable")} />
          </label>
        </fieldset>

        <fieldset className="users-tenant-section users-tenant-section-orders">
          <legend>3. Operacion inicial</legend>
          <label className="users-tenant-wide">
            <span><Phone size={14} strokeWidth={2} aria-hidden="true" /> Celular para recepcion de pedidos</span>
            <input className={fieldClass("celular")} type="tel" value={form.celular} onChange={event => update("celular", event.target.value)} placeholder="3017654321" required aria-invalid={Boolean(errorFor("celular"))} />
            <small>Este es el numero que utilizara la tienda para recibir pedidos.</small>
            <FieldError message={errorFor("celular")} />
          </label>
          {!isEdit ? (
            <label className="users-tenant-wide users-tenant-main-branch">
              <span><Store size={14} strokeWidth={2} aria-hidden="true" /> Sucursal principal <OptionalHint /></span>
              <input value={form.sucursalNombre} onChange={event => update("sucursalNombre", event.target.value)} placeholder="Principal" />
              <small>Nombre de la primera sede desde donde operara la empresa. Si lo dejas vacio se usara la sucursal principal por defecto.</small>
            </label>
          ) : null}
        </fieldset>

        <fieldset className="users-tenant-section users-tenant-section-config">
          <legend>4. Cuenta PetalOps</legend>
          <label className="users-tenant-wide">
            <span><Link size={14} strokeWidth={2} aria-hidden="true" /> URL del catalogo</span>
            <input
              className={fieldClass("slug")}
              value={form.slug}
              onChange={event => update("slug", buildSlug(event.target.value))}
              onBlur={event => update("slug", normalizeTenantSlug(event.target.value))}
              placeholder="la-fiore-casa-de-flores"
              required
              minLength={3}
              maxLength={80}
              title="Usa solo letras minusculas, numeros y guiones; sin espacios. Longitud de 3 a 80 caracteres."
              aria-invalid={Boolean(errorFor("slug"))}
            />
            <small>Se autogenera desde el nombre comercial y puedes editarla antes de crear la empresa.</small>
            <FieldError message={errorFor("slug")} />
          </label>
          {!isEdit ? (
            <label className="users-tenant-wide users-tenant-logo-field">
              <span><Image size={14} strokeWidth={2} aria-hidden="true" /> Logo de la empresa <OptionalHint /></span>
              <div className={`users-tenant-logo-upload ${errorFor("logoFile") ? "is-invalid" : ""}`}>
                <div className="users-tenant-logo-preview">
                  {logoPreviewUrl ? <img src={logoPreviewUrl} alt="" /> : <Image size={22} strokeWidth={2} aria-hidden="true" />}
                </div>
                <div className="users-tenant-logo-copy">
                  <input
                    key={form.logoFile ? "logo-selected" : "logo-empty"}
                    type="file"
                    accept={TENANT_LOGO_ACCEPT}
                    onChange={event => updateLogoFile(event.target.files?.[0] || null)}
                    aria-invalid={Boolean(errorFor("logoFile"))}
                  />
                  <small>Formatos JPG, PNG, WebP, HEIC o HEIF, maximo 15 MB.</small>
                  {form.logoFile ? (
                    <button type="button" className="users-tenant-logo-remove" onClick={() => updateLogoFile(null)}>
                      Quitar logo
                    </button>
                  ) : null}
                </div>
              </div>
              <FieldError message={errorFor("logoFile")} />
            </label>
          ) : null}
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
            <FieldError message={errorFor("estado")} />
          </label>
        </fieldset>

        {!isEdit ? (
        <fieldset className="users-tenant-section users-tenant-section-admin">
          <legend>5. Administrador inicial</legend>
          <label>
            <span><AtSign size={14} strokeWidth={2} aria-hidden="true" /> Email del administrador <OptionalHint /></span>
            <input className={fieldClass("adminEmail")} type="email" value={form.adminEmail} onChange={event => update("adminEmail", event.target.value)} placeholder="admin@empresa.com" aria-invalid={Boolean(errorFor("adminEmail"))} />
            <small>Se mostrara en la confirmacion para entregar el acceso.</small>
            <FieldError message={errorFor("adminEmail")} />
          </label>
          <label>
            <span><UserCog size={14} strokeWidth={2} aria-hidden="true" /> Usuario <OptionalHint /></span>
            <input className={fieldClass("adminLogin")} value={form.adminLogin} onChange={event => update("adminLogin", event.target.value)} placeholder="lafiore.admin" minLength={3} aria-invalid={Boolean(errorFor("adminLogin"))} />
            <FieldError message={errorFor("adminLogin")} />
          </label>
          <label>
            <span><KeyRound size={14} strokeWidth={2} aria-hidden="true" /> Contrasena temporal <OptionalHint /></span>
            <div className="users-password-field">
              <input
                className={fieldClass("adminPassword")}
                type={passwordVisible ? "text" : "password"}
                value={form.adminPassword}
                onChange={event => update("adminPassword", event.target.value)}
                placeholder="Minimo 6 caracteres"
                minLength={6}
                autoComplete="new-password"
                aria-invalid={Boolean(errorFor("adminPassword"))}
              />
              <button
                type="button"
                className="users-password-toggle"
                onClick={() => setPasswordVisible(current => !current)}
                aria-label={passwordVisible ? "Ocultar contrasena inicial" : "Mostrar contrasena inicial"}
                title={passwordVisible ? "Ocultar contrasena inicial" : "Mostrar contrasena inicial"}
              >
                {passwordVisible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>
            <small>Solo es necesaria si vas a crear el usuario administrador ahora.</small>
            <FieldError message={errorFor("adminPassword")} />
          </label>
        </fieldset>
        ) : null}
        <div className="users-tenant-actions">
          {onCancel ? (
            <button type="button" className="btn-outline" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="btn-primary users-tenant-submit" disabled={saving} aria-busy={saving}>
            <Building2 size={18} strokeWidth={2} aria-hidden="true" />
            {saving ? (isEdit ? "Guardando empresa..." : "Creando empresa...") : (isEdit ? "Guardar empresa" : "Crear empresa")}
          </button>
        </div>
      </form>
    </article>
  );
}
