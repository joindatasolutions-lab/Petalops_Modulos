import { Eye, EyeOff } from "lucide-react";

import { UserModuleAccessPicker } from "./UserModuleAccessPicker.jsx";
import { UserRolePicker } from "./UserRolePicker.jsx";

export function UserForm({
  mode,
  form,
  setForm,
  visibleRoles,
  selectedRoleIDs,
  modulosActivosEmpresa,
  sucursales,
  canViewUsuariosGlobal,
  passwordVisible = false,
  onTogglePasswordVisible,
  storedPasswordVisible = false,
  storedPasswordLoading = false,
  storedPasswordValue = "",
  storedPasswordMessage = "",
  onRevealStoredPassword,
  onHideStoredPassword,
  modulesPicker,
  saving,
  onToggleRole,
  onSubmit,
  onCancel,
}) {
  const isEdit = mode === "edit";
  const passwordToggleLabel = isEdit
    ? (passwordVisible ? "Ocultar nueva contrasena" : "Mostrar nueva contrasena")
    : (passwordVisible ? "Ocultar contrasena" : "Mostrar contrasena");

  return (
    <form className="users-create-form users-create-user-form" onSubmit={onSubmit} autoComplete="off">
      <input
        type="text"
        placeholder="Nombre completo"
        value={form.nombre}
        name={isEdit ? "edit-user-name" : "new-user-name"}
        autoComplete="off"
        onChange={event => setForm(current => ({ ...current, nombre: event.target.value }))}
        required
        autoFocus={!isEdit}
      />
      <input
        type="text"
        placeholder="Login unico"
        value={form.login}
        name={isEdit ? "edit-user-login" : "new-user-login"}
        autoComplete="off"
        onChange={event => setForm(current => ({ ...current, login: event.target.value }))}
        required
      />

      {isEdit ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="users-password-field">
            <input
              type={passwordVisible ? "text" : "password"}
              placeholder="Nueva contrasena (opcional)"
              value={form.password}
              name="edit-user-new-password"
              autoComplete="new-password"
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
            />
            <button
              type="button"
              className="users-password-toggle"
              onClick={onTogglePasswordVisible}
              aria-label={passwordToggleLabel}
              title={passwordToggleLabel}
            >
              {passwordVisible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
          </div>
          <span className="orders-admin-subtitle">
            Escribe una nueva contrasena solo si necesitas restablecerla.
          </span>
          <div className="users-stored-password-box">
            <div className="users-stored-password-head">
              <span>Contrasena guardada</span>
              {storedPasswordVisible ? (
                <button type="button" className="btn-outline" onClick={onHideStoredPassword}>
                  <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
                  Ocultar
                </button>
              ) : (
                <button type="button" className="btn-outline" onClick={onRevealStoredPassword} disabled={storedPasswordLoading}>
                  <Eye size={16} strokeWidth={2} aria-hidden="true" />
                  {storedPasswordLoading ? "Consultando..." : "Ver contrasena"}
                </button>
              )}
            </div>
            {storedPasswordVisible ? (
              <input
                type="text"
                value={storedPasswordValue}
                name="stored-user-password"
                readOnly
                autoComplete="off"
              />
            ) : null}
            {storedPasswordMessage ? <p className="orders-admin-subtitle">{storedPasswordMessage}</p> : null}
          </div>
        </div>
      ) : (
        <div className="users-password-field">
          <input
            type={passwordVisible ? "text" : "password"}
            placeholder="Contrasena"
            value={form.password}
            name="new-user-password"
            autoComplete="new-password"
            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
            required
          />
          <button
            type="button"
            className="users-password-toggle"
            onClick={onTogglePasswordVisible}
            aria-label={passwordToggleLabel}
            title={passwordToggleLabel}
          >
            {passwordVisible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
          </button>
        </div>
      )}

      <UserRolePicker
        roles={visibleRoles}
        value={form.rolID}
        selectedRoleIDs={selectedRoleIDs}
        onChange={onToggleRole}
      />

      {!canViewUsuariosGlobal && visibleRoles.length === 0 ? (
        <p className="orders-message">No hay roles operativos disponibles para asignar en tu empresa.</p>
      ) : null}

      <select value={form.sucursalID} onChange={event => setForm(current => ({ ...current, sucursalID: event.target.value }))} required>
        {sucursales.map(item => <option key={item.sucursalID} value={item.sucursalID}>Sucursal {item.sucursalID}</option>)}
      </select>

      <select value={form.estado} onChange={event => setForm(current => ({ ...current, estado: event.target.value }))}>
        <option value="Activo">Activo</option>
        <option value="Inactivo">Inactivo</option>
      </select>

      <UserModuleAccessPicker {...modulesPicker} />

      <div className={isEdit ? "" : "users-modal-actions"} style={isEdit ? { display: "flex", gap: 10, flexWrap: "wrap" } : undefined}>
        <button type="button" className="btn-outline" onClick={onCancel}>
          {isEdit ? "Cancelar edicion" : "Cancelar"}
        </button>
        <button type="submit" className="btn-primary" disabled={saving || visibleRoles.length === 0}>
          {saving ? "Guardando..." : (isEdit ? "Guardar cambios" : "Crear usuario")}
        </button>
      </div>
    </form>
  );
}
