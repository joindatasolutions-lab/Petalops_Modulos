import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus } from "../../shared/utils.js";

const INVENTORY_STATUS_CLASS = {
  DISPONIBLE: "is-entregado",
  BAJO_STOCK: "is-pendiente",
  AGOTADO: "is-rechazado",
  INACTIVO: "is-cancelado",
};

const INVENTORY_SUBMENU_OPTIONS = [
  { key: "general", label: "Inventario General" },
  { key: "crear", label: "Crear Item" },
  { key: "ajustar", label: "Ajustar Stock" },
  { key: "proveedores", label: "Proveedores" },
];

const INVENTORY_TYPE_OPTIONS = [
  "Flor",
  "Follaje",
  "Base floral",
  "Empaque",
  "Cinta",
  "Accesorio",
  "Espuma floral",
  "Tarjeta",
  "Herramienta",
  "Otro",
];

const COLOR_OPTIONS = [
  "",
  "Rojo",
  "Rosado",
  "Blanco",
  "Amarillo",
  "Naranja",
  "Lila",
  "Morado",
  "Azul",
  "Verde",
  "Dorado",
  "Plateado",
  "Multicolor",
];

const initialCreateForm = {
  codigo: "",
  nombre: "",
  categoria: "Flor",
  color: "",
  proveedorID: "",
  stockActual: "0",
  stockMinimo: "5",
  valorUnitario: "0",
};

const initialStockForm = {
  inventarioID: "",
  tipoMovimiento: "Entrada",
  cantidad: "1",
  stockObjetivo: "",
  motivo: "",
};

const initialProveedorForm = {
  nombre: "",
  codigoProveedor: "",
  activo: true,
};

function statusClass(estadoStock) {
  const key = normalizeStatus(estadoStock);
  return INVENTORY_STATUS_CLASS[key] || "is-pendiente";
}

export function InventoryPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewContabilidad,
  canViewTrazabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoContabilidad,
  onGoTrazabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [items, setItems] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [proveedorFiltro, setProveedorFiltro] = useState("");
  const [q, setQ] = useState("");

  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [stockForm, setStockForm] = useState(initialStockForm);
  const [proveedorForm, setProveedorForm] = useState(initialProveedorForm);
  const [creating, setCreating] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [savingProveedor, setSavingProveedor] = useState(false);

  const [showMovimientos, setShowMovimientos] = useState(false);
  const [submenu, setSubmenu] = useState("general");

  const categorias = useMemo(() => {
    const values = Array.from(new Set(items.map(item => String(item.categoria || "").trim()).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const loadProveedores = useCallback(async () => {
    try {
      const data = await api.listarProveedoresInventario({ empresaId });
      setProveedores(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando proveedores:", nextError);
      setProveedores([]);
    }
  }, [api, empresaId]);

  const loadInventario = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarInventario({
        empresaId,
        categoria: categoriaFiltro || null,
        estado: estadoFiltro || null,
        proveedorId: proveedorFiltro ? Number(proveedorFiltro) : null,
        q: q || null,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando inventario:", nextError);
      setItems([]);
      setError(nextError?.message || "No fue posible cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, categoriaFiltro, estadoFiltro, proveedorFiltro, q]);

  const loadMovimientos = useCallback(async () => {
    if (!showMovimientos) return;
    try {
      const data = await api.listarMovimientosInventario({ empresaId, q: q || null });
      setMovimientos(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando movimientos:", nextError);
      setMovimientos([]);
    }
  }, [api, empresaId, q, showMovimientos]);

  useEffect(() => {
    loadProveedores().catch(() => {});
  }, [loadProveedores]);

  useEffect(() => {
    loadInventario().catch(() => {});
  }, [loadInventario]);

  useEffect(() => {
    loadMovimientos().catch(() => {});
  }, [loadMovimientos]);



  const cancelCreate = () => {
    setCreateForm(initialCreateForm);
    setError("");
    setInfo("");
    setSubmenu("general");
  };

  const submitCreate = async event => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setInfo("");
    try {
      await api.crearItemInventario({
        empresaID: empresaId,
        codigo: String(createForm.codigo || "").trim(),
        nombre: String(createForm.nombre || "").trim(),
        categoria: String(createForm.categoria || "").trim(),
        color: String(createForm.color || "").trim() || null,
        proveedorID: createForm.proveedorID ? Number(createForm.proveedorID) : null,
        stockActual: Number(createForm.stockActual || 0),
        stockMinimo: Number(createForm.stockMinimo || 0),
        valorUnitario: Number(createForm.valorUnitario || 0),
        activo: true,
      });
      setCreateForm(initialCreateForm);
      await loadInventario();
      await loadMovimientos();
      setInfo("Item de inventario creado.");
    } catch (nextError) {
      console.error("Error creando item:", nextError);
      setError(nextError?.message || "No fue posible crear item.");
    } finally {
      setCreating(false);
    }
  };

  const submitStock = async event => {
    event.preventDefault();
    if (!stockForm.inventarioID) {
      setError("Selecciona un item para ajustar stock.");
      return;
    }
    setSavingStock(true);
    setError("");
    setInfo("");
    try {
      await api.ajustarStockInventario({
        inventarioId: Number(stockForm.inventarioID),
        payload: {
          tipoMovimiento: stockForm.tipoMovimiento,
          cantidad: Number(stockForm.cantidad || 0),
          stockObjetivo: stockForm.tipoMovimiento === "Ajuste" ? Number(stockForm.stockObjetivo || 0) : null,
          motivo: String(stockForm.motivo || "").trim(),
        },
      });
      setStockForm(initialStockForm);
      await loadInventario();
      await loadMovimientos();
      setInfo("Stock actualizado y movimiento registrado.");
    } catch (nextError) {
      console.error("Error ajustando stock:", nextError);
      setError(nextError?.message || "No fue posible ajustar stock.");
    } finally {
      setSavingStock(false);
    }
  };

  const submitProveedor = async event => {
    event.preventDefault();
    setSavingProveedor(true);
    setError("");
    setInfo("");
    try {
      await api.crearProveedorInventario({
        empresaId,
        nombre: String(proveedorForm.nombre || "").trim(),
        codigoProveedor: String(proveedorForm.codigoProveedor || "").trim() || null,
        activo: Boolean(proveedorForm.activo),
      });
      setProveedorForm(initialProveedorForm);
      await loadProveedores();
      setInfo("Proveedor creado correctamente.");
    } catch (nextError) {
      console.error("Error creando proveedor:", nextError);
      setError(nextError?.message || "No fue posible crear proveedor.");
    } finally {
      setSavingProveedor(false);
    }
  };

  const toggleActivo = async item => {
    try {
      await api.actualizarActivoInventario({ inventarioId: item.inventarioID, activo: !item.activo });
      await loadInventario();
      setInfo(`Estado actualizado para ${item.nombre}.`);
    } catch (nextError) {
      console.error("Error actualizando estado:", nextError);
      setError(nextError?.message || "No fue posible actualizar estado.");
    }
  };

  const refreshAll = async () => {
    await loadInventario();
    await loadMovimientos();
  };

  const movimientosTable = showMovimientos ? (
    <article className="orders-table-wrap users-table-wrap users-table-panel">
      <table className="orders-table users-table inventory-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Codigo</th>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Motivo</th>
            <th>Usuario</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map(item => (
            <tr key={item.movimientoID}>
              <td data-label="Fecha">{String(item.fecha || "").replace("T", " ").slice(0, 16)}</td>
              <td data-label="Codigo">{item.codigo}</td>
              <td data-label="Nombre">{item.nombre}</td>
              <td data-label="Tipo">{item.tipoMovimiento}</td>
              <td data-label="Cantidad">{Number(item.cantidad || 0)}</td>
              <td data-label="Motivo">{item.motivo || "-"}</td>
              <td data-label="Usuario">{item.usuarioID || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  ) : null;

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="inventario"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{
          pipeline: canViewPipeline,
          pedidos: canViewPedidos,
          produccion: canViewProduccion,
          domicilios: canViewDomicilios,
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          trazabilidad: canViewTrazabilidad,
          clientes: canViewClientesPanel,
          usuarios: canViewUsuariosPanel,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: onGoProduccion,
          domicilios: onGoDomicilios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
      />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menú</button>
            <h1>Inventario</h1>
            <p className="orders-admin-subtitle">Control de flores e insumos con estados inteligentes y trazabilidad por movimientos.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary" onClick={refreshAll}>Actualizar</button>
          </div>
        </header>

        <section className="inventory-header-tabs" aria-label="Submenu inventario">
          {INVENTORY_SUBMENU_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              className={`btn-outline inventory-tab-btn ${submenu === option.key ? "is-active" : ""}`}
              onClick={() => setSubmenu(option.key)}
            >
              {option.label}
            </button>
          ))}
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}
        {loading ? <p className="orders-message">Cargando inventario...</p> : null}

        {submenu === "general" ? (
          <>
            <section className="orders-filters inventory-filters">
              <div className="filter-field">
                <span>Búsqueda</span>
                <input type="text" placeholder="Buscar por codigo, nombre, color o proveedor" value={q} onChange={event => setQ(event.target.value)} />
              </div>
              <div className="filter-field">
                <span>Categoría</span>
                <select value={categoriaFiltro} onChange={event => setCategoriaFiltro(event.target.value)}>
                  <option value="">Todas las categorias</option>
                  {categorias.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <span>Estado</span>
                <select value={estadoFiltro} onChange={event => setEstadoFiltro(event.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="Disponible">Disponible</option>
                  <option value="Bajo Stock">Bajo Stock</option>
                  <option value="Agotado">Agotado</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
              <div className="filter-field">
                <span>Proveedor</span>
                <select value={proveedorFiltro} onChange={event => setProveedorFiltro(event.target.value)}>
                  <option value="">Todos los proveedores</option>
                  {proveedores.map(item => <option key={item.idProveedor} value={item.idProveedor}>{item.nombre}</option>)}
                </select>
              </div>
            </section>

            <section className="inventory-grid-layout">
              <article className="orders-table-wrap users-table-wrap users-table-panel">
                <table className="orders-table users-table inventory-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Categoria</th>
                      <th>Color</th>
                      <th>Stock</th>
                      <th>Estado</th>
                      <th>Proveedor</th>
                      <th>Valor</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.inventarioID}>
                        <td data-label="Codigo">{item.codigo}</td>
                        <td data-label="Nombre">{item.nombre}</td>
                        <td data-label="Categoria">{item.categoria}</td>
                        <td data-label="Color">{item.color || "-"}</td>
                        <td data-label="Stock">{Number(item.stockActual || 0)}</td>
                        <td data-label="Estado"><span className={`order-badge ${statusClass(item.estadoStock)}`}>{item.estadoStock}</span></td>
                        <td data-label="Proveedor">{item.proveedor || "-"}</td>
                        <td data-label="Valor">${formatearCOP(item.valorUnitario)}</td>
                        <td data-label="Accion">
                          <button type="button" className="btn-outline" onClick={() => toggleActivo(item)}>
                            {item.activo ? "Inactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="order-block inventory-panel">
                <h4>Auditoria de movimientos</h4>
                <div className="inventory-sub-actions">
                  <button type="button" className="btn-outline" onClick={() => setShowMovimientos(current => !current)}>
                    {showMovimientos ? "Ocultar movimientos" : "Ver movimientos"}
                  </button>
                </div>
              </article>

              {movimientosTable}
            </section>
          </>
        ) : null}

        {submenu === "crear" ? (
          <section className="inventory-grid-layout inventory-single-layout">
            <article className="order-block inventory-panel inventory-form-panel">
              <h4>Crear item</h4>
              <p className="inventory-form-help">
                Usa este formulario para registrar un nuevo insumo. "Flor" se refiere al tipo de insumo.
              </p>
              <form className="users-create-form" onSubmit={submitCreate}>
                <label className="inventory-field">
                  <span>Código interno</span>
                  <input type="text" placeholder="Ej: ROSA-ROJA-001" value={createForm.codigo} onChange={event => setCreateForm(current => ({ ...current, codigo: event.target.value }))} required />
                </label>
                <label className="inventory-field">
                  <span>Nombre del insumo</span>
                  <input type="text" placeholder="Ej: Rosa roja premium" value={createForm.nombre} onChange={event => setCreateForm(current => ({ ...current, nombre: event.target.value }))} required />
                </label>
                <label className="inventory-field">
                  <span>Tipo de insumo</span>
                  <select value={createForm.categoria} onChange={event => setCreateForm(current => ({ ...current, categoria: event.target.value }))} required>
                    {INVENTORY_TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="inventory-field">
                  <span>Color principal</span>
                  <select value={createForm.color} onChange={event => setCreateForm(current => ({ ...current, color: event.target.value }))}>
                    <option value="">Sin color especifico</option>
                    {COLOR_OPTIONS.filter(Boolean).map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="inventory-field">
                  <span>Proveedor</span>
                <select value={createForm.proveedorID} onChange={event => setCreateForm(current => ({ ...current, proveedorID: event.target.value }))}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(item => <option key={item.idProveedor} value={item.idProveedor}>{item.nombre}{item.codigoProveedor ? ` - ${item.codigoProveedor}` : ""}</option>)}
                </select>
                </label>
                <div className="inventory-two-cols">
                  <label className="inventory-field">
                    <span>Stock inicial</span>
                    <input type="number" min="0" step="0.01" placeholder="Cantidad con la que entra al inventario" value={createForm.stockActual} onChange={event => setCreateForm(current => ({ ...current, stockActual: event.target.value }))} required />
                  </label>
                  <label className="inventory-field">
                    <span>Stock mínimo</span>
                    <input type="number" min="0" step="0.01" placeholder="Cantidad para alerta de reposición" value={createForm.stockMinimo} onChange={event => setCreateForm(current => ({ ...current, stockMinimo: event.target.value }))} required />
                  </label>
                </div>
                <label className="inventory-field">
                  <span>Costo unitario</span>
                  <input type="number" min="0" step="0.01" placeholder="Valor de compra por unidad" value={createForm.valorUnitario} onChange={event => setCreateForm(current => ({ ...current, valorUnitario: event.target.value }))} required />
                </label>
                <div className="order-actions">
                  <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Guardando..." : "Crear item"}</button>
                  <button type="button" className="btn-outline" onClick={cancelCreate} disabled={creating}>Cancelar</button>
                </div>
              </form>
            </article>
          </section>
        ) : null}

        {submenu === "ajustar" ? (
          <section className="inventory-grid-layout inventory-single-layout">
            <article className="order-block inventory-panel inventory-form-panel">
              <h4>Ajustar stock</h4>
              <form className="users-create-form" onSubmit={submitStock}>
                <select value={stockForm.inventarioID} onChange={event => setStockForm(current => ({ ...current, inventarioID: event.target.value }))} required>
                  <option value="">Selecciona item</option>
                  {items.map(item => <option key={item.inventarioID} value={item.inventarioID}>{item.codigo} - {item.nombre}</option>)}
                </select>

                <select value={stockForm.tipoMovimiento} onChange={event => setStockForm(current => ({ ...current, tipoMovimiento: event.target.value }))}>
                  <option value="Entrada">Entrada</option>
                  <option value="Salida">Salida</option>
                  <option value="Ajuste">Ajuste</option>
                </select>

                {stockForm.tipoMovimiento === "Ajuste" ? (
                  <input type="number" min="0" step="0.01" placeholder="Stock objetivo" value={stockForm.stockObjetivo} onChange={event => setStockForm(current => ({ ...current, stockObjetivo: event.target.value }))} required />
                ) : (
                  <input type="number" min="0.01" step="0.01" placeholder="Cantidad" value={stockForm.cantidad} onChange={event => setStockForm(current => ({ ...current, cantidad: event.target.value }))} required />
                )}

                <textarea className="inventory-textarea" placeholder="Motivo del movimiento" value={stockForm.motivo} onChange={event => setStockForm(current => ({ ...current, motivo: event.target.value }))} required />
                <button type="submit" className="btn-primary" disabled={savingStock}>{savingStock ? "Aplicando..." : "Guardar movimiento"}</button>
              </form>

              <div className="inventory-sub-actions">
                <button type="button" className="btn-outline" onClick={() => setShowMovimientos(current => !current)}>
                  {showMovimientos ? "Ocultar movimientos" : "Ver movimientos"}
                </button>
              </div>
            </article>

            {movimientosTable}
          </section>
        ) : null}

        {submenu === "proveedores" ? (
          <section className="inventory-grid-layout inventory-single-layout inventory-provider-layout">
            <article className="order-block inventory-panel inventory-form-panel inventory-provider-panel">
              <h4>Administrar proveedores</h4>
              <p className="inventory-form-help">
                Este formulario solo guarda los campos que hoy existen en la tabla <code>petalops.proveedor</code>:
                nombre, codigo y estado activo. Al crear uno nuevo, queda disponible de inmediato en
                <strong> Crear item</strong>.
              </p>
              <form className="users-create-form inventory-provider-form" onSubmit={submitProveedor}>
                <label className="inventory-field">
                  <span>Nombre proveedor</span>
                  <small className="inventory-field-hint">Nombre visible en inventario y en el selector de proveedores.</small>
                  <input
                    type="text"
                    placeholder="Ej: Flores de la Sabana"
                    value={proveedorForm.nombre}
                    onChange={event => setProveedorForm(current => ({ ...current, nombre: event.target.value }))}
                    required
                  />
                </label>
                <label className="inventory-field">
                  <span>Código proveedor</span>
                  <small className="inventory-field-hint">Opcional. Sirve para identificar al proveedor con un consecutivo interno.</small>
                  <input
                    type="text"
                    placeholder="Ej: PROV-FLO-003"
                    value={proveedorForm.codigoProveedor}
                    onChange={event => setProveedorForm(current => ({ ...current, codigoProveedor: event.target.value }))}
                  />
                </label>
                <label className="inventory-field inventory-checkbox-field">
                  <input
                    type="checkbox"
                    checked={proveedorForm.activo}
                    onChange={event => setProveedorForm(current => ({ ...current, activo: event.target.checked }))}
                  />
                  <span>Dejar proveedor activo</span>
                </label>
                <div className="order-actions inventory-provider-actions">
                  <button type="submit" className="btn-primary" disabled={savingProveedor}>
                    {savingProveedor ? "Guardando..." : "Crear proveedor"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={savingProveedor}
                    onClick={() => {
                      setProveedorForm(initialProveedorForm);
                      setError("");
                      setInfo("");
                    }}
                  >
                    Limpiar
                  </button>
                </div>
              </form>
            </article>

            <article className="orders-table-wrap users-table-wrap users-table-panel inventory-provider-table-panel">
              <div className="inventory-section-title">
                <h4>Proveedores registrados</h4>
                <p>Lista base usada por el formulario de inventario para asociar items a un proveedor.</p>
              </div>
              <table className="orders-table users-table inventory-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map(item => (
                    <tr key={item.idProveedor}>
                      <td data-label="ID">{item.idProveedor}</td>
                      <td data-label="Nombre">{item.nombre}</td>
                      <td data-label="Código">{item.codigoProveedor || "-"}</td>
                      <td data-label="Estado">
                        <span className={`order-badge ${item.activo ? "is-entregado" : "is-cancelado"}`}>
                          {item.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}


