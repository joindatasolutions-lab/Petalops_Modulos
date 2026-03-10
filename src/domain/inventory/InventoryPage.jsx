import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
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
];

const initialCreateForm = {
  codigo: "",
  nombre: "",
  categoria: "Flor",
  subcategoria: "",
  color: "",
  descripcion: "",
  proveedorID: "",
  codigoProveedor: "",
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

function statusClass(estadoStock) {
  const key = normalizeStatus(estadoStock);
  return INVENTORY_STATUS_CLASS[key] || "is-pendiente";
}

export function InventoryPage({
  session,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewUsuariosPanel,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

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
  const [soloCriticos, setSoloCriticos] = useState(false);

  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [stockForm, setStockForm] = useState(initialStockForm);
  const [creating, setCreating] = useState(false);
  const [savingStock, setSavingStock] = useState(false);

  const [showMovimientos, setShowMovimientos] = useState(false);
  const [submenu, setSubmenu] = useState("general");
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const submenuRef = useRef(null);

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
        soloCriticos,
      });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando inventario:", nextError);
      setItems([]);
      setError(nextError?.message || "No fue posible cargar inventario.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, categoriaFiltro, estadoFiltro, proveedorFiltro, q, soloCriticos]);

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

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleDocumentClick = event => {
      if (!submenuOpen) return;
      const submenuNode = submenuRef.current;
      if (!submenuNode) return;
      if (!submenuNode.contains(event.target)) {
        setSubmenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [submenuOpen]);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
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
        subcategoria: String(createForm.subcategoria || "").trim() || null,
        color: String(createForm.color || "").trim() || null,
        descripcion: String(createForm.descripcion || "").trim() || null,
        proveedorID: createForm.proveedorID ? Number(createForm.proveedorID) : null,
        codigoProveedor: String(createForm.codigoProveedor || "").trim() || null,
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
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/PetalOps.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/PetalOps%20Logo.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Modulos">
          {canViewPedidos ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => {
              setSidebarMobileOpen(false);
              setSubmenuOpen(false);
              onGoPedidos();
            }}>
              <span className="sidebar-nav-icon">🧾</span><span className="sidebar-nav-text">Pedidos</span>
            </button>
          ) : null}
          {canViewProduccion ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => {
              setSidebarMobileOpen(false);
              setSubmenuOpen(false);
              onGoProduccion();
            }}>
              <span className="sidebar-nav-icon">🏭</span><span className="sidebar-nav-text">Produccion</span>
            </button>
          ) : null}
          {canViewDomicilios ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => {
              setSidebarMobileOpen(false);
              setSubmenuOpen(false);
              onGoDomicilios();
            }}>
              <span className="sidebar-nav-icon">🛵</span><span className="sidebar-nav-text">Domicilios</span>
            </button>
          ) : null}
          {canViewInventario ? (
            <div ref={submenuRef} className="sidebar-submenu-wrap">
              <button
                type="button"
                className="sidebar-nav-btn is-active"
                onClick={() => {
                  onGoInventario();
                  setSubmenuOpen(current => !current);
                }}
              >
                <span className="sidebar-nav-icon">📦</span><span className="sidebar-nav-text">Inventario {submenuOpen ? "▾" : "▸"}</span>
              </button>

              {submenuOpen ? (
                <div className="sidebar-submenu-panel">
                  {INVENTORY_SUBMENU_OPTIONS.map(option => (
                    <button
                      key={option.key}
                      type="button"
                      className={`sidebar-submenu-btn ${submenu === option.key ? "is-active" : ""}`}
                      onClick={() => {
                        setSubmenu(option.key);
                        setSubmenuOpen(false);
                        setSidebarMobileOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {canViewUsuariosPanel ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => {
              setSidebarMobileOpen(false);
              setSubmenuOpen(false);
              onGoUsuarios();
            }}>
              <span className="sidebar-nav-icon">👥</span><span className="sidebar-nav-text">Gestion Usuarios</span>
            </button>
          ) : null}
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesion">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesion</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar}>{sidebarPinned ? "←" : "→"}</button>
        <p className="sidebar-caption">Control de inventario por empresa</p>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menu" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menu</button>
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
              <select value={categoriaFiltro} onChange={event => setCategoriaFiltro(event.target.value)}>
                <option value="">Todas las categorias</option>
                {categorias.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
              <select value={estadoFiltro} onChange={event => setEstadoFiltro(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="Disponible">Disponible</option>
                <option value="Bajo Stock">Bajo Stock</option>
                <option value="Agotado">Agotado</option>
                <option value="Inactivo">Inactivo</option>
              </select>
              <select value={proveedorFiltro} onChange={event => setProveedorFiltro(event.target.value)}>
                <option value="">Todos los proveedores</option>
                {proveedores.map(item => <option key={item.idProveedor} value={item.idProveedor}>{item.nombre}</option>)}
              </select>
              <input type="text" placeholder="Buscar por codigo, nombre, color o proveedor" value={q} onChange={event => setQ(event.target.value)} />
              <button type="button" className={`btn-outline ${soloCriticos ? "is-selected" : ""}`} onClick={() => setSoloCriticos(current => !current)}>
                {soloCriticos ? "Mostrando criticos" : "Solo criticos"}
              </button>
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
              <form className="users-create-form" onSubmit={submitCreate}>
                <input type="text" placeholder="Codigo" value={createForm.codigo} onChange={event => setCreateForm(current => ({ ...current, codigo: event.target.value }))} required />
                <input type="text" placeholder="Nombre" value={createForm.nombre} onChange={event => setCreateForm(current => ({ ...current, nombre: event.target.value }))} required />
                <input type="text" placeholder="Categoria" value={createForm.categoria} onChange={event => setCreateForm(current => ({ ...current, categoria: event.target.value }))} required />
                <input type="text" placeholder="Subcategoria" value={createForm.subcategoria} onChange={event => setCreateForm(current => ({ ...current, subcategoria: event.target.value }))} />
                <input type="text" placeholder="Color" value={createForm.color} onChange={event => setCreateForm(current => ({ ...current, color: event.target.value }))} />
                <textarea className="inventory-textarea" placeholder="Descripcion" value={createForm.descripcion} onChange={event => setCreateForm(current => ({ ...current, descripcion: event.target.value }))} />
                <select value={createForm.proveedorID} onChange={event => setCreateForm(current => ({ ...current, proveedorID: event.target.value }))}>
                  <option value="">Sin proveedor</option>
                  {proveedores.map(item => <option key={item.idProveedor} value={item.idProveedor}>{item.nombre}</option>)}
                </select>
                <input type="text" placeholder="Codigo proveedor" value={createForm.codigoProveedor} onChange={event => setCreateForm(current => ({ ...current, codigoProveedor: event.target.value }))} />
                <div className="inventory-two-cols">
                  <input type="number" min="0" step="0.01" placeholder="Stock actual" value={createForm.stockActual} onChange={event => setCreateForm(current => ({ ...current, stockActual: event.target.value }))} required />
                  <input type="number" min="0" step="0.01" placeholder="Stock minimo" value={createForm.stockMinimo} onChange={event => setCreateForm(current => ({ ...current, stockMinimo: event.target.value }))} required />
                </div>
                <input type="number" min="0" step="0.01" placeholder="Valor unitario" value={createForm.valorUnitario} onChange={event => setCreateForm(current => ({ ...current, valorUnitario: event.target.value }))} required />
                <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Guardando..." : "Crear item"}</button>
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
      </main>
    </div>
  );
}
