import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, formatDateTimeCompact } from "../../shared/utils.js";

const TRACEABILITY_VIEWS = [
  { key: "pedidos", label: "Pedidos" },
  { key: "produccion", label: "Producción" },
];

export function TraceabilityPage({
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
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const today = new Date().toISOString().slice(0, 10);

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [activeView, setActiveView] = useState("pedidos");
  const [filters, setFilters] = useState({
    fechaDesde: today,
    fechaHasta: today,
    q: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pedidosData, setPedidosData] = useState({ resumen: [], detalle: [], total: 0 });
  const [produccionData, setProduccionData] = useState({ resumen: [], detalle: [], total: 0 });

  const loadTraceability = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pedidos, produccion] = await Promise.all([
        api.obtenerTrazabilidadAprobacionesPedidos({
          empresaId,
          sucursalId,
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
        }),
        api.obtenerTrazabilidadProduccionUsuarios({
          empresaId,
          sucursalId,
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
        }),
      ]);
      setPedidosData(normalizeTraceabilityPayload(pedidos));
      setProduccionData(normalizeTraceabilityPayload(produccion));
    } catch (nextError) {
      console.error("Error cargando trazabilidad:", nextError);
      setPedidosData({ resumen: [], detalle: [], total: 0 });
      setProduccionData({ resumen: [], detalle: [], total: 0 });
      setError(nextError?.message || "No fue posible cargar la trazabilidad operativa.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, sucursalId, filters.fechaDesde, filters.fechaHasta]);

  useEffect(() => {
    loadTraceability();
  }, [loadTraceability]);

  const visiblePedidosSummary = useMemo(
    () => filterByUserText(pedidosData.resumen, filters.q),
    [pedidosData.resumen, filters.q]
  );
  const visiblePedidosDetail = useMemo(
    () => filterByUserText(pedidosData.detalle, filters.q),
    [pedidosData.detalle, filters.q]
  );
  const visibleProduccionSummary = useMemo(
    () => filterByUserText(produccionData.resumen, filters.q),
    [produccionData.resumen, filters.q]
  );
  const visibleProduccionDetail = useMemo(
    () => filterByUserText(produccionData.detalle, filters.q),
    [produccionData.detalle, filters.q]
  );

  const pedidosSummaryTotals = useMemo(
    () => visiblePedidosSummary.reduce((acc, item) => ({
      usuarios: acc.usuarios + 1,
      pedidos: acc.pedidos + Number(item.pedidosAprobados || 0),
      valor: acc.valor + Number(item.valorTotal || 0),
    }), { usuarios: 0, pedidos: 0, valor: 0 }),
    [visiblePedidosSummary]
  );

  const produccionSummaryTotals = useMemo(
    () => visibleProduccionSummary.reduce((acc, item) => ({
      usuarios: acc.usuarios + 1,
      acciones: acc.acciones + Number(item.accionesRegistradas || 0),
      pedidos: acc.pedidos + Number(item.pedidosImpactados || 0),
    }), { usuarios: 0, acciones: 0, pedidos: 0 }),
    [visibleProduccionSummary]
  );

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="trazabilidad"
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

      <main className="orders-admin-view accounting-view traceability-view">
        <header className="orders-admin-header">
          <div>
            <h1>Trazabilidad</h1>
            <p className="orders-admin-subtitle">Seguimiento por usuario de aprobaciones en pedidos y movimientos auditados en producción.</p>
          </div>
          <div className="orders-admin-header-actions">
            <button type="button" className="btn-primary" onClick={loadTraceability} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <section className="accounting-subnav">
          {TRACEABILITY_VIEWS.map(item => (
            <button
              key={item.key}
              type="button"
              className={`btn-outline${activeView === item.key ? " is-selected" : ""}`}
              onClick={() => setActiveView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </section>

        <section className="orders-filters accounting-filters">
          <label className="filter-field">
            <span>Fecha Inicio</span>
            <input type="date" value={filters.fechaDesde} onChange={event => setFilters(current => ({ ...current, fechaDesde: event.target.value }))} />
          </label>
          <label className="filter-field">
            <span>Fecha Fin</span>
            <input type="date" value={filters.fechaHasta} onChange={event => setFilters(current => ({ ...current, fechaHasta: event.target.value }))} />
          </label>
          <label className="filter-field filter-field--wide">
            <span>Buscar usuario</span>
            <input type="search" value={filters.q} onChange={event => setFilters(current => ({ ...current, q: event.target.value }))} placeholder="Login, actor o usuario" />
          </label>
        </section>

        {error ? <p className="orders-message">{error}</p> : null}

        {activeView === "pedidos" ? (
          <>
            <section className="accounting-summary-cards">
              <article className="order-block accounting-stat-card">
                <span>Usuarios</span>
                <strong>{pedidosSummaryTotals.usuarios}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos aprobados</span>
                <strong>{pedidosSummaryTotals.pedidos}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Valor aprobado</span>
                <strong>${formatearCOP(pedidosSummaryTotals.valor)}</strong>
              </article>
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Pedidos aprobados</th>
                    <th>Valor total</th>
                    <th>Última aprobación</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePedidosSummary.length === 0 ? (
                    <tr><td colSpan={4}>{loading ? "Cargando trazabilidad..." : "No hay aprobaciones para este rango."}</td></tr>
                  ) : visiblePedidosSummary.map(item => (
                    <tr key={`pedidos-${item.usuario}`}>
                      <td>{item.usuario}</td>
                      <td>{item.pedidosAprobados}</td>
                      <td>${formatearCOP(item.valorTotal)}</td>
                      <td>{formatDateTimeCompact(item.ultimoMovimiento) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>ID Pedido</th>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Fecha acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePedidosDetail.length === 0 ? (
                    <tr><td colSpan={6}>No hay detalle de aprobaciones para mostrar.</td></tr>
                  ) : visiblePedidosDetail.map((item, index) => (
                    <tr key={`pedidos-detail-${item.usuario}-${item.pedidoID}-${index}`}>
                      <td>{item.usuario}</td>
                      <td>{item.pedidoID}</td>
                      <td>{item.numeroPedido || item.codigoPedido || "-"}</td>
                      <td>{item.cliente || "-"}</td>
                      <td>${formatearCOP(item.totalPedido)}</td>
                      <td>{formatDateTimeCompact(item.fechaAccion) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}

        {activeView === "produccion" ? (
          <>
            <section className="accounting-summary-cards">
              <article className="order-block accounting-stat-card">
                <span>Usuarios</span>
                <strong>{produccionSummaryTotals.usuarios}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Acciones auditadas</span>
                <strong>{produccionSummaryTotals.acciones}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos impactados</span>
                <strong>{produccionSummaryTotals.pedidos}</strong>
              </article>
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Acciones</th>
                    <th>Producciones impactadas</th>
                    <th>Pedidos impactados</th>
                    <th>Último movimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProduccionSummary.length === 0 ? (
                    <tr><td colSpan={5}>{loading ? "Cargando trazabilidad..." : "No hay acciones de producción para este rango."}</td></tr>
                  ) : visibleProduccionSummary.map(item => (
                    <tr key={`produccion-${item.usuario}`}>
                      <td>{item.usuario}</td>
                      <td>{item.accionesRegistradas}</td>
                      <td>{item.produccionesImpactadas}</td>
                      <td>{item.pedidosImpactados}</td>
                      <td>{formatDateTimeCompact(item.ultimoMovimiento) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>ID Producción</th>
                    <th>ID Pedido</th>
                    <th>Cliente</th>
                    <th>Motivo</th>
                    <th>Fecha acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProduccionDetail.length === 0 ? (
                    <tr><td colSpan={6}>No hay detalle de producción para mostrar.</td></tr>
                  ) : visibleProduccionDetail.map((item, index) => (
                    <tr key={`produccion-detail-${item.usuario}-${item.produccionID}-${index}`}>
                      <td>{item.usuario}</td>
                      <td>{item.produccionID}</td>
                      <td>{item.pedidoID || item.numeroPedido || item.codigoPedido || "-"}</td>
                      <td>{item.cliente || "-"}</td>
                      <td>{item.motivo || "-"}</td>
                      <td>{formatDateTimeCompact(item.fechaAccion) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function normalizeTraceabilityPayload(payload) {
  return {
    resumen: Array.isArray(payload?.resumen) ? payload.resumen : [],
    detalle: Array.isArray(payload?.detalle) ? payload.detalle : [],
    total: Number(payload?.total || 0),
  };
}

function filterByUserText(items, q) {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return items;
  return items.filter(item => {
    const usuario = String(item?.usuario || "").toLowerCase();
    const cliente = String(item?.cliente || "").toLowerCase();
    const pedido = String(item?.pedidoID || item?.numeroPedido || item?.codigoPedido || "").toLowerCase();
    return usuario.includes(query) || cliente.includes(query) || pedido.includes(query);
  });
}
