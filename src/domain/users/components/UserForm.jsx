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
  modulesPicker,
  saving,
  onToggleRole,
  onSubmit,
  onCancel,
}) {
  const isEdit = mode === "edit";

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
          <input
            type={passwordVisible ? "text" : "password"}
            placeholder="Nueva contrasena (opcional)"
            value={form.password}
            name="edit-user-new-password"
            autoComplete="new-password"
            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn-outline" onClick={onTogglePasswordVisible}>
              {passwordVisible ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
            </button>
            <span className="orders-admin-subtitle">La contraseña actual no se puede ver porque se guarda cifrada; aquí solo puedes escribir y revisar una nueva.</span>
          </div>
        </div>
      ) : (
        <input
          type="password"
          placeholder="Contrasena"
          value={form.password}
          name="new-user-password"
            autoComplete="new-password"
            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
          required
        />
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
          {isEdit ? "Cancelar edición" : "Cancelar"}
        </button>
        <button type="submit" className="btn-primary" disabled={saving || visibleRoles.length === 0}>
          {saving ? "Guardando..." : (isEdit ? "Guardar cambios" : "Crear usuario")}
        </button>
      </div>
    </form>
  );
}
