import { Download, Search } from "lucide-react";
import { formatearCOP } from "../../shared/utils.js";

export function ClientsTableView({ canManageClients, items, q, onEdit, onExport, onSearchChange }) {
  return (
    <>
      <section className="clients-table-toolbar" aria-label="Busqueda de clientes">
        <div className="clients-table-toolbar-copy">
          <span className="clients-table-toolbar-label">Detalle de clientes</span>
          <strong>Busca al cliente sin salir de la tabla</strong>
        </div>
        <div className="clients-table-toolbar-actions">
          <div className="orders-filter-control clients-search-control">
            <Search size={17} strokeWidth={2} aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento, telefono o email"
              value={q}
              onChange={event => onSearchChange(event.target.value)}
            />
          </div>
          <button type="button" className="btn-outline clients-download-btn" onClick={onExport} disabled={items.length === 0}>
            <Download size={17} strokeWidth={2} aria-hidden="true" />
            <span>Descargar Excel</span>
          </button>
        </div>
      </section>
      <section className="orders-table-wrap clients-table-wrap">
        <table className="orders-table users-table clients-table">
          <thead>
            <tr>
              <th>ID</th><th>Tipo Doc</th><th>Documento</th><th>Nombre</th><th>Telefono</th>
              <th>Email</th><th>Compras</th><th>Total comprado</th><th>Ultima compra</th><th>Cumpleanos</th><th>Aniversario</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={13}>No hay clientes registrados.</td></tr>
            ) : items.map(item => <ClientRow key={item.clienteID} item={item} canManageClients={canManageClients} onEdit={onEdit} />)}
          </tbody>
        </table>
      </section>
    </>
  );
}
function ClientRow({ canManageClients, item, onEdit }) {
  const metrics = item.metrics || {};
  return (
    <tr>
      <td data-label="ID">{item.clienteID}</td>
      <td data-label="Tipo Doc">{item.tipoIdent || "-"}</td>
      <td data-label="Documento">{item.identificacion || "-"}</td>
      <td data-label="Nombre">{item.nombreCompleto || "-"}</td>
      <td data-label="Telefono">{item.telefono || "-"}</td>
      <td data-label="Email">{item.email || "-"}</td>
      <td data-label="Compras">{metrics.purchase_count ?? metrics.purchaseCount ?? "-"}</td>
      <td data-label="Total comprado">{metrics.total_spent != null ? `$${formatearCOP(metrics.total_spent)}` : "-"}</td>
      <td data-label="Ultima compra">{metrics.last_purchase_at || metrics.lastPurchaseAt || "-"}</td>
      <td data-label="Cumpleanos">{item.fechaCumpleanos || "-"}</td>
      <td data-label="Aniversario">{item.fechaAniversario || "-"}</td>
      <td data-label="Estado"><span className={`order-badge ${item.activo ? "is-entregado" : "is-cancelado"}`}>{item.activo ? "Activo" : "Inactivo"}</span></td>
      <td data-label="Acciones">
        <button type="button" className="btn-outline" onClick={() => onEdit(item)} disabled={!canManageClients} title={canManageClients ? "Editar cliente" : "Solo administradores pueden editar clientes"}>Editar</button>
      </td>
    </tr>
  );
}
