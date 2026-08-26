export function UsersTable({
  items,
  canViewUsuariosGlobal,
  sessionUserID,
  onEdit,
  onToggleEstado,
  onDelete,
}) {
  const roleLabel = item => {
    const roles = Array.isArray(item.roles) && item.roles.length > 0 ? item.roles : [];
    if (!roles.length) return item.rol;
    return roles.map(role => role.nombreRol).filter(Boolean).join(", ") || item.rol;
  };

  return (
    <article className="orders-table-wrap users-table-wrap users-table-panel">
      <table className="orders-table users-table">
        <thead>
          <tr>
            <th>ID</th>
            {canViewUsuariosGlobal ? <th>Empresa</th> : null}
            <th>Sucursal</th>
            <th>Nombre</th>
            <th>Login</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.userID}>
              <td data-label="ID">{item.userID}</td>
              {canViewUsuariosGlobal ? <td data-label="Empresa">{item.empresaID}</td> : null}
              <td data-label="Sucursal">{item.sucursalID}</td>
              <td data-label="Nombre">{item.nombre}</td>
              <td data-label="Login">{item.login}</td>
              <td data-label="Rol">{roleLabel(item)}</td>
              <td data-label="Estado">
                <span className={`order-badge ${String(item.estado).toLowerCase() === "activo" ? "is-entregado" : "is-rechazado"}`}>{item.estado}</span>
              </td>
              <td data-label="Accion">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn-outline" onClick={() => onEdit(item)}>
                    Editar
                  </button>
                  <button type="button" className="btn-outline" onClick={() => onToggleEstado(item)}>
                    {String(item.estado).toLowerCase() === "activo" ? "Inactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => onDelete(item)}
                    disabled={Number(item.userID) === Number(sessionUserID)}
                    title={Number(item.userID) === Number(sessionUserID) ? "No puedes eliminar tu propio usuario" : "Eliminar usuario"}
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
