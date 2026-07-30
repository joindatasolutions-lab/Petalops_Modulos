import { roleTypeLabel } from "../usersDomain.js";

export function UserRolePicker({ roles, value, onChange }) {
  return (
    <fieldset className="users-role-picker">
      <legend>Tipo de usuario (rol)</legend>
      <div className="users-role-options">
        {roles.map(item => {
          const roleID = String(item.rolID);
          const selected = roleID === String(value);
          const typeLabel = roleTypeLabel(item.nombreRol);

          return (
            <label key={item.rolID} className={`users-role-option ${selected ? "is-selected" : ""}`}>
              <input
                type="radio"
                name="usuario-rol"
                value={roleID}
                checked={selected}
                onChange={() => onChange(roleID)}
                required
              />
              <span>
                <strong>{typeLabel}</strong>
                <small>{item.nombreRol}</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
