import { roleTypeLabel } from "../usersDomain.js";

export function UserRolePicker({ roles, value, selectedRoleIDs, onChange }) {
  const selectedSet = new Set((selectedRoleIDs || []).map(item => String(item)));

  return (
    <fieldset className="users-role-picker">
      <legend>Roles del usuario</legend>
      <div className="users-role-options">
        {roles.map(item => {
          const roleID = String(item.rolID);
          const selected = selectedSet.has(roleID);
          const principal = roleID === String(value);
          const typeLabel = roleTypeLabel(item.nombreRol);

          return (
            <label key={item.rolID} className={`users-role-option ${selected ? "is-selected" : ""}`}>
              <input
                type="checkbox"
                name="usuario-roles"
                value={roleID}
                checked={selected}
                onChange={() => onChange(roleID)}
              />
              <span>
                <strong>{typeLabel}{principal ? " principal" : ""}</strong>
                <small>{item.nombreRol}</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
