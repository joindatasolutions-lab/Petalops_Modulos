import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";

const CASH_CLOSING_STORAGE_KEY = "petalops_accounting_cash_closing";

const ACCOUNTING_VIEWS = [
  { key: "ventas", label: "Ventas" },
  { key: "arreglos", label: "Métricas por arreglo" },
  { key: "cuentas", label: "Cuentas de pago" },
  { key: "caja", label: "Caja" },
];

const initialFilters = {
  fechaDesde: "",
  fechaHasta: "",
};

const initialCashForm = {
  fecha: "",
  base: "",
  gasto: "",
  guardado: "",
};

export function AccountingPage({
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

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [activeView, setActiveView] = useState("ventas");
  const [filters, setFilters] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      ...initialFilters,
      fechaDesde: today,
      fechaHasta: today,
    };
  });
  const [cashForm, setCashForm] = useState(() => ({
    ...initialCashForm,
    fecha: new Date().toISOString().slice(0, 10),
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountingOrders, setAccountingOrders] = useState([]);
  const [orderRows, setOrderRows] = useState([]);
  const [selectedArrangementKeys, setSelectedArrangementKeys] = useState([]);
  const [cashHistoryVersion, setCashHistoryVersion] = useState(0);

  const loadAccountingData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const orders = await fetchOrdersForAccounting({
        api,
        empresaId,
        sucursalId,
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
      });

      const saleOrders = orders.filter(item => isSaleStatus(item.estado));
      const details = await Promise.all(
        saleOrders.map(async item => {
          try {
            const detail = await api.obtenerDetallePedido(Number(item.pedidoID));
            return { order: item, detail };
          } catch {
            return { order: item, detail: null };
          }
        })
      );

      setAccountingOrders(details);
      setOrderRows(buildAccountingRows(details));
    } catch (nextError) {
      console.error("Error cargando contabilidad:", nextError);
      setAccountingOrders([]);
      setOrderRows([]);
      setError(nextError?.message || "No fue posible cargar el módulo de contabilidad.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, sucursalId, filters.fechaDesde, filters.fechaHasta]);

  useEffect(() => {
    loadAccountingData();
  }, [loadAccountingData]);

  useEffect(() => {
    const saved = readCashClosing(empresaId, sucursalId, cashForm.fecha);
    setCashForm(current => ({
      ...current,
      base: saved?.base ?? "",
      gasto: saved?.gasto ?? "",
      guardado: saved?.guardado ?? "",
    }));
    setInfo("");
  }, [cashForm.fecha, empresaId, sucursalId, cashHistoryVersion]);

  const arrangementRows = useMemo(() => buildArrangementRows(accountingOrders), [accountingOrders]);
  const paymentAccountRows = useMemo(() => buildPaymentAccountRows(accountingOrders), [accountingOrders]);

  useEffect(() => {
    setSelectedArrangementKeys(arrangementRows.map(item => item.key));
  }, [arrangementRows]);

  const summaryTotals = useMemo(() => {
    return orderRows.reduce((acc, row) => ({
      cantidadPedidos: acc.cantidadPedidos + Number(row.cantidadPedidos || 0),
      totalArreglos: acc.totalArreglos + Number(row.totalArreglos || 0),
      totalDomicilios: acc.totalDomicilios + Number(row.totalDomicilios || 0),
      totalVenta: acc.totalVenta + Number(row.totalVenta || 0),
      totalEfectivo: acc.totalEfectivo + Number(row.totalEfectivo || 0),
      totalRecargos: acc.totalRecargos + Number(row.totalRecargos || 0),
      totalDescuentos: acc.totalDescuentos + Number(row.totalDescuentos || 0),
    }), {
      cantidadPedidos: 0,
      totalArreglos: 0,
      totalDomicilios: 0,
      totalVenta: 0,
      totalEfectivo: 0,
      totalRecargos: 0,
      totalDescuentos: 0,
    });
  }, [orderRows]);

  const selectedArrangementRows = useMemo(() => {
    const selected = new Set(selectedArrangementKeys);
    return arrangementRows.filter(item => selected.has(item.key));
  }, [arrangementRows, selectedArrangementKeys]);

  const arrangementSummary = useMemo(() => {
    const pedidos = new Set();
    const totals = selectedArrangementRows.reduce((acc, item) => {
      (Array.isArray(item.pedidoIDs) ? item.pedidoIDs : []).forEach(id => pedidos.add(id));
      return {
        arreglosSeleccionados: acc.arreglosSeleccionados + 1,
        unidadesVendidas: acc.unidadesVendidas + Number(item.unidades || 0),
        totalVendido: acc.totalVendido + Number(item.totalVendido || 0),
      };
    }, {
      arreglosSeleccionados: 0,
      unidadesVendidas: 0,
      totalVendido: 0,
    });
    return {
      ...totals,
      pedidosImpactados: pedidos.size,
    };
  }, [selectedArrangementRows]);

  const topArrangementByUnits = selectedArrangementRows[0] || null;
  const topArrangementBySales = useMemo(
    () => [...selectedArrangementRows].sort((a, b) => b.totalVendido - a.totalVendido)[0] || null,
    [selectedArrangementRows]
  );
  const arrangementChartRows = useMemo(() => selectedArrangementRows.slice(0, 8), [selectedArrangementRows]);

  const paymentSummary = useMemo(() => {
    return paymentAccountRows.reduce((acc, item) => ({
      cuentas: acc.cuentas + 1,
      pedidos: acc.pedidos + Number(item.pedidos || 0),
      recaudo: acc.recaudo + Number(item.totalRecaudado || 0),
    }), { cuentas: 0, pedidos: 0, recaudo: 0 });
  }, [paymentAccountRows]);
  const topPaymentAccount = paymentAccountRows[0] || null;

  const baseValue = parseMoneyInput(cashForm.base);
  const gastoValue = parseMoneyInput(cashForm.gasto);
  const guardadoInputValue = parseMoneyInput(cashForm.guardado);
  const efectivoValue = roundMoney(summaryTotals.totalEfectivo);
  const totalEfectivoCaja = roundMoney(baseValue + efectivoValue - gastoValue);
  const guardadoValue = roundMoney(guardadoInputValue);
  const nuevaBaseValue = roundMoney(totalEfectivoCaja - guardadoValue);
  const cashHistoryRows = useMemo(
    () => listCashClosings(empresaId, sucursalId),
    [empresaId, sucursalId, cashHistoryVersion]
  );

  const applyFilter = (field, value) => {
    setFilters(current => ({ ...current, [field]: value }));
  };

  const toggleArrangementSelection = arrangementKey => {
    setSelectedArrangementKeys(current => (
      current.includes(arrangementKey)
        ? current.filter(item => item !== arrangementKey)
        : [...current, arrangementKey]
    ));
  };

  const selectAllArrangements = () => {
    setSelectedArrangementKeys(arrangementRows.map(item => item.key));
  };

  const clearAllArrangements = () => {
    setSelectedArrangementKeys([]);
  };

  const saveCashClosing = () => {
    if (!cashForm.fecha) {
      setInfo("Selecciona una fecha para guardar el cierre.");
      return;
    }

    setSaving(true);
    try {
      writeCashClosing(empresaId, sucursalId, cashForm.fecha, {
        base: baseValue,
        efectivo: efectivoValue,
        gasto: gastoValue,
        totalEfectivo: totalEfectivoCaja,
        guardado: guardadoValue,
        nuevaBase: nuevaBaseValue,
      });
      setCashHistoryVersion(current => current + 1);
      setInfo(`Cierre guardado para ${cashForm.fecha}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="contabilidad"
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

      <main className="orders-admin-view accounting-view">
        <header className="orders-admin-header">
          <div>
            <h1>Contabilidad</h1>
            <p className="orders-admin-subtitle">Resumen de ventas, análisis por arreglo, cuentas de pago y cierre operativo por fecha.</p>
          </div>
          <div className="orders-admin-header-actions">
            <button type="button" className="btn-primary" onClick={loadAccountingData} disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <section className="accounting-subnav">
          {ACCOUNTING_VIEWS.map(item => (
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
            <input type="date" value={filters.fechaDesde} onChange={event => applyFilter("fechaDesde", event.target.value)} />
          </label>
          <label className="filter-field">
            <span>Fecha Fin</span>
            <input type="date" value={filters.fechaHasta} onChange={event => applyFilter("fechaHasta", event.target.value)} />
          </label>
          <div className="accounting-filter-actions">
            <button type="button" className="btn-primary" onClick={loadAccountingData} disabled={loading}>
              {loading ? "Cargando..." : "Actualizar resumen"}
            </button>
          </div>
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}

        {activeView === "ventas" ? (
          <>
            <section className="accounting-summary-cards">
              <article className="order-block accounting-stat-card">
                <span>Pedidos</span>
                <strong>{summaryTotals.cantidadPedidos}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Arreglos florales</span>
                <strong>${formatearCOP(summaryTotals.totalArreglos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Domicilios</span>
                <strong>${formatearCOP(summaryTotals.totalDomicilios)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Total venta</span>
                <strong>${formatearCOP(summaryTotals.totalVenta)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Recargos link</span>
                <strong>${formatearCOP(summaryTotals.totalRecargos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Descuentos</span>
                <strong>${formatearCOP(summaryTotals.totalDescuentos)}</strong>
              </article>
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cantidad de pedidos</th>
                    <th>Total $ en arreglos florales</th>
                    <th>Total $ en domicilios</th>
                    <th>Recargos link</th>
                    <th>Descuentos</th>
                    <th>Total de la venta</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{loading ? "Cargando resumen..." : "No hay ventas para los filtros seleccionados."}</td>
                    </tr>
                  ) : orderRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>{row.cantidadPedidos}</td>
                      <td>${formatearCOP(row.totalArreglos)}</td>
                      <td>${formatearCOP(row.totalDomicilios)}</td>
                      <td>${formatearCOP(row.totalRecargos)}</td>
                      <td>${formatearCOP(row.totalDescuentos)}</td>
                      <td>${formatearCOP(row.totalVenta)}</td>
                    </tr>
                  ))}
                </tbody>
                {orderRows.length > 0 ? (
                  <tfoot>
                    <tr>
                      <th>Totales</th>
                      <th>{summaryTotals.cantidadPedidos}</th>
                      <th>${formatearCOP(summaryTotals.totalArreglos)}</th>
                      <th>${formatearCOP(summaryTotals.totalDomicilios)}</th>
                      <th>${formatearCOP(summaryTotals.totalRecargos)}</th>
                      <th>${formatearCOP(summaryTotals.totalDescuentos)}</th>
                      <th>${formatearCOP(summaryTotals.totalVenta)}</th>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </section>
          </>
        ) : null}

        {activeView === "arreglos" ? (
          <section className="order-block accounting-arrangements-panel">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>Métricas por arreglos</h4>
                <p className="orders-admin-subtitle">Cuántas unidades se han vendido por arreglo, con filtro masivo y detalle visual.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={selectAllArrangements} disabled={arrangementRows.length === 0}>
                  Seleccionar todo
                </button>
                <button type="button" className="btn-outline" onClick={clearAllArrangements} disabled={arrangementRows.length === 0}>
                  Borrar todo
                </button>
              </div>
            </div>

            <section className="accounting-summary-cards accounting-summary-cards--arrangements">
              <article className="order-block accounting-stat-card">
                <span>Arreglos seleccionados</span>
                <strong>{arrangementSummary.arreglosSeleccionados}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Unidades vendidas</span>
                <strong>{arrangementSummary.unidadesVendidas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Total vendido</span>
                <strong>${formatearCOP(arrangementSummary.totalVendido)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos impactados</span>
                <strong>{arrangementSummary.pedidosImpactados}</strong>
              </article>
            </section>

            <div className="accounting-arrangements-grid">
              <section className="order-block accounting-arrangements-selector">
                <div className="accounting-arrangements-selector-head">
                  <strong>Arreglos incluidos</strong>
                  <span>{selectedArrangementKeys.length} / {arrangementRows.length}</span>
                </div>
                <div className="accounting-arrangements-checklist">
                  {arrangementRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay arreglos vendidos para este rango.</p>
                  ) : arrangementRows.map(item => (
                    <label key={item.key} className="accounting-arrangement-check">
                      <input
                        type="checkbox"
                        checked={selectedArrangementKeys.includes(item.key)}
                        onChange={() => toggleArrangementSelection(item.key)}
                      />
                      <span>
                        <strong>{item.nombre}</strong>
                        <small>{item.codigo || "Sin código"} · {item.unidades} und.</small>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="order-block accounting-arrangements-insights">
                <div className="accounting-insight-cards">
                  <article className="accounting-insight-card">
                    <span>Top por unidades</span>
                    <strong>{topArrangementByUnits?.nombre || "-"}</strong>
                    <small>{topArrangementByUnits ? `${topArrangementByUnits.unidades} unidades` : "Sin datos"}</small>
                  </article>
                  <article className="accounting-insight-card">
                    <span>Top por venta</span>
                    <strong>{topArrangementBySales?.nombre || "-"}</strong>
                    <small>{topArrangementBySales ? `$${formatearCOP(topArrangementBySales.totalVendido)}` : "Sin datos"}</small>
                  </article>
                </div>

                <div className="accounting-chart-grid">
                  <article className="accounting-chart-card">
                    <h5>Gráfica por unidades</h5>
                    {arrangementChartRows.length === 0 ? (
                      <p className="accounting-empty-state">Selecciona al menos un arreglo para ver la gráfica.</p>
                    ) : (
                      <div className="accounting-bar-list">
                        {renderBarChartRows(arrangementChartRows, "unidades")}
                      </div>
                    )}
                  </article>
                  <article className="accounting-chart-card">
                    <h5>Gráfica por total vendido</h5>
                    {arrangementChartRows.length === 0 ? (
                      <p className="accounting-empty-state">Selecciona al menos un arreglo para ver la gráfica.</p>
                    ) : (
                      <div className="accounting-bar-list">
                        {renderBarChartRows(arrangementChartRows, "totalVendido", true)}
                      </div>
                    )}
                  </article>
                </div>
              </section>
            </div>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Arreglo</th>
                    <th>Unidades vendidas</th>
                    <th>Pedidos</th>
                    <th>Total vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedArrangementRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No hay arreglos seleccionados para mostrar.</td>
                    </tr>
                  ) : selectedArrangementRows.map(item => (
                    <tr key={item.key}>
                      <td>{item.codigo || "-"}</td>
                      <td>{item.nombre}</td>
                      <td>{item.unidades}</td>
                      <td>{item.pedidos}</td>
                      <td>${formatearCOP(item.totalVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}

        {activeView === "cuentas" ? (
          <>
            <section className="accounting-summary-cards">
              <article className="order-block accounting-stat-card">
                <span>Cuentas activas</span>
                <strong>{paymentSummary.cuentas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos impactados</span>
                <strong>{paymentSummary.pedidos}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Recaudo total</span>
                <strong>${formatearCOP(paymentSummary.recaudo)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cuenta líder</span>
                <strong>{topPaymentAccount?.cuenta || "-"}</strong>
              </article>
            </section>

            <section className="order-block accounting-arrangements-panel">
              <div className="looker-header accounting-arrangements-head">
                <div>
                  <h4>Ventas por cuenta o medio de pago</h4>
                  <p className="orders-admin-subtitle">Mide número de pedidos, recaudo, participación y comportamiento por cada cuenta o medio de pago usado.</p>
                </div>
              </div>

              <div className="accounting-chart-grid">
                <article className="accounting-chart-card">
                  <h5>Participación por recaudo</h5>
                  {paymentAccountRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay movimientos de pago para este rango.</p>
                  ) : (
                    <div className="accounting-bar-list">
                      {renderBarChartRows(paymentAccountRows.slice(0, 8), "totalRecaudado", true, "cuenta")}
                    </div>
                  )}
                </article>
                <article className="accounting-chart-card">
                  <h5>Pedidos por cuenta</h5>
                  {paymentAccountRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay movimientos de pago para este rango.</p>
                  ) : (
                    <div className="accounting-bar-list">
                      {renderBarChartRows(paymentAccountRows.slice(0, 8), "pedidos", false, "cuenta")}
                    </div>
                  )}
                </article>
              </div>

              <section className="orders-table-wrap">
                <table className="orders-table accounting-table">
                  <thead>
                    <tr>
                      <th>Cuenta / Medio</th>
                      <th>Pedidos</th>
                      <th>Métodos usados</th>
                      <th>Total recaudado</th>
                      <th>Promedio por pedido</th>
                      <th>Participación</th>
                      <th>Último movimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentAccountRows.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No hay cuentas de pago para mostrar.</td>
                      </tr>
                    ) : paymentAccountRows.map(item => (
                      <tr key={item.key}>
                        <td>{item.cuenta}</td>
                        <td>{item.pedidos}</td>
                        <td>{item.metodos.join(", ") || "-"}</td>
                        <td>${formatearCOP(item.totalRecaudado)}</td>
                        <td>${formatearCOP(item.promedioPedido)}</td>
                        <td>{item.participacionPct}%</td>
                        <td>{item.ultimoMovimiento || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </section>
          </>
        ) : null}

        {activeView === "caja" ? (
          <section className="order-block accounting-cash-panel">
            <div className="looker-header">
              <div>
                <h4>Caja</h4>
                <p className="orders-admin-subtitle">Cierre de efectivo por fecha. El guardado se conserva localmente en este navegador.</p>
              </div>
            </div>

            <div className="accounting-cash-grid">
              <label className="order-detail-edit-label">
                Fecha
                <input type="date" value={cashForm.fecha} onChange={event => setCashForm(current => ({ ...current, fecha: event.target.value }))} />
              </label>
              <label className="order-detail-edit-label">
                Base
                <input type="number" min="0" step="0.01" value={cashForm.base} onChange={event => setCashForm(current => ({ ...current, base: event.target.value }))} placeholder="0.00" />
              </label>
              <label className="order-detail-edit-label">
                Efectivo
                <input type="text" value={`$${formatearCOP(efectivoValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Gasto
                <input type="number" min="0" step="0.01" value={cashForm.gasto} onChange={event => setCashForm(current => ({ ...current, gasto: event.target.value }))} placeholder="0.00" />
              </label>
              <label className="order-detail-edit-label">
                T. Efectivo
                <input type="text" value={`$${formatearCOP(totalEfectivoCaja)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Guardado
                <input type="number" min="0" step="0.01" value={cashForm.guardado} onChange={event => setCashForm(current => ({ ...current, guardado: event.target.value }))} placeholder="0.00" />
              </label>
              <label className="order-detail-edit-label">
                Nueva Base
                <input type="text" value={`$${formatearCOP(nuevaBaseValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
            </div>

            <div className="order-detail-edit-actions">
              <button type="button" className="btn-primary" onClick={saveCashClosing} disabled={saving}>
                {saving ? "Guardando..." : "Guardar cierre"}
              </button>
            </div>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Base</th>
                    <th>Efectivo</th>
                    <th>Gasto</th>
                    <th>Total_Efectivo</th>
                    <th>Nueva_Base</th>
                  </tr>
                </thead>
                <tbody>
                  {cashHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No hay cierres de caja guardados.</td>
                    </tr>
                  ) : cashHistoryRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>${formatearCOP(row.base)}</td>
                      <td>${formatearCOP(row.efectivo)}</td>
                      <td>${formatearCOP(row.gasto)}</td>
                      <td>${formatearCOP(row.totalEfectivo)}</td>
                      <td>${formatearCOP(row.nuevaBase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}
      </main>
    </div>
  );
}

async function fetchOrdersForAccounting({ api, empresaId, sucursalId, fechaDesde, fechaHasta }) {
  const pageSize = 100;
  let page = 1;
  let rows = [];
  let total = 0;

  do {
    const data = await api.listarPedidos({
      empresaId,
      sucursalId,
      q: "",
      estado: "",
      fechaDesde: toIsoDateStart(fechaDesde),
      fechaHasta: toIsoDateEnd(fechaHasta),
      page,
      pageSize,
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    total = Number(data?.total || items.length);
    rows = rows.concat(items);
    page += 1;
  } while (rows.length < total);

  return rows;
}

function buildAccountingRows(items) {
  const grouped = new Map();

  for (const item of items) {
    const fecha = splitDateTimeParts(item?.order?.fechaPedido || item?.order?.fecha).date || "Sin fecha";
    const current = grouped.get(fecha) || {
      fecha,
      cantidadPedidos: 0,
      totalArreglos: 0,
      totalDomicilios: 0,
      totalRecargos: 0,
      totalDescuentos: 0,
      totalVenta: 0,
      totalEfectivo: 0,
    };

    const financiero = item?.detail?.financiero || {};
    const domicilio = roundMoney(financiero?.domicilio);
    const total = roundMoney(financiero?.total ?? item?.order?.total);
    const arreglos = roundMoney((financiero?.subtotal ?? 0) + (financiero?.iva ?? 0));
    const recargos = roundMoney(financiero?.recargoLinkMonto ?? 0);
    const descuentos = roundMoney(financiero?.descuentoMonto ?? 0);

    current.cantidadPedidos += 1;
    current.totalArreglos += arreglos;
    current.totalDomicilios += domicilio;
    current.totalRecargos += recargos;
    current.totalDescuentos += descuentos;
    current.totalVenta += total;
    current.totalEfectivo += extractCashAmount(financiero, total);

    grouped.set(fecha, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function buildArrangementRows(items) {
  const grouped = new Map();

  for (const item of items) {
    const pedidoId = Number(item?.order?.pedidoID || item?.detail?.pedidoID || 0);
    const productos = Array.isArray(item?.detail?.productos) ? item.detail.productos : [];
    for (const producto of productos) {
      const codigo = String(producto?.codigoProducto || "").trim();
      const nombre = String(producto?.nombreProducto || "Arreglo").trim() || "Arreglo";
      const productoId = Number(producto?.productoID || 0);
      const key = `${productoId || "na"}::${codigo || "sin-codigo"}::${nombre}`;
      const current = grouped.get(key) || {
        key,
        productoId: productoId || null,
        codigo: codigo || null,
        nombre,
        unidades: 0,
        pedidosIds: new Set(),
        totalVendido: 0,
      };

      current.unidades += Number(producto?.cantidad || 0);
      if (pedidoId) current.pedidosIds.add(pedidoId);
      current.totalVendido += Number(producto?.subtotal || 0);
      grouped.set(key, current);
    }
  }

  return Array.from(grouped.values())
    .map(item => ({
      key: item.key,
      productoId: item.productoId,
      codigo: item.codigo,
      nombre: item.nombre,
      unidades: roundMoney(item.unidades),
      pedidos: item.pedidosIds.size,
      pedidoIDs: Array.from(item.pedidosIds),
      totalVendido: roundMoney(item.totalVendido),
    }))
    .sort((a, b) => {
      if (b.unidades !== a.unidades) return b.unidades - a.unidades;
      if (b.totalVendido !== a.totalVendido) return b.totalVendido - a.totalVendido;
      return a.nombre.localeCompare(b.nombre);
    });
}

function buildPaymentAccountRows(items) {
  const grouped = new Map();
  let totalGlobal = 0;

  for (const item of items) {
    const pedidoId = Number(item?.order?.pedidoID || item?.detail?.pedidoID || 0);
    const fecha = splitDateTimeParts(item?.order?.fechaPedido || item?.order?.fecha).date || "";
    const financiero = item?.detail?.financiero || {};
    const entries = extractPaymentEntries(financiero);
    for (const entry of entries) {
      const cuenta = entry.cuenta;
      const key = cuenta.toLowerCase();
      const current = grouped.get(key) || {
        key,
        cuenta,
        pedidosSet: new Set(),
        metodosSet: new Set(),
        totalRecaudado: 0,
        ultimoMovimiento: "",
      };
      if (pedidoId) current.pedidosSet.add(pedidoId);
      if (entry.metodo) current.metodosSet.add(entry.metodo);
      current.totalRecaudado += Number(entry.monto || 0);
      if (fecha && (!current.ultimoMovimiento || fecha > current.ultimoMovimiento)) current.ultimoMovimiento = fecha;
      grouped.set(key, current);
      totalGlobal += Number(entry.monto || 0);
    }
  }

  return Array.from(grouped.values())
    .map(item => {
      const pedidos = item.pedidosSet.size;
      return {
        key: item.key,
        cuenta: item.cuenta,
        pedidos,
        metodos: Array.from(item.metodosSet),
        totalRecaudado: roundMoney(item.totalRecaudado),
        promedioPedido: pedidos > 0 ? roundMoney(item.totalRecaudado / pedidos) : 0,
        participacionPct: totalGlobal > 0 ? roundMoney((item.totalRecaudado / totalGlobal) * 100) : 0,
        ultimoMovimiento: item.ultimoMovimiento || "-",
      };
    })
    .sort((a, b) => {
      if (b.totalRecaudado !== a.totalRecaudado) return b.totalRecaudado - a.totalRecaudado;
      if (b.pedidos !== a.pedidos) return b.pedidos - a.pedidos;
      return a.cuenta.localeCompare(b.cuenta);
    });
}

function extractPaymentEntries(financiero) {
  const breakdownCandidates = [
    financiero?.detallePago,
    financiero?.desglosePago,
    financiero?.metodosPagoDetalle,
    financiero?.paymentBreakdown,
  ];
  const breakdown = breakdownCandidates.find(Array.isArray) || [];
  if (breakdown.length > 0) {
    return breakdown.map(item => ({
      cuenta: String(item?.metodo || item?.metodoPago || item?.nombre || "Sin especificar").trim() || "Sin especificar",
      metodo: String(item?.metodo || item?.metodoPago || item?.nombre || "Sin especificar").trim() || "Sin especificar",
      monto: Number(item?.monto ?? item?.valor ?? item?.amount ?? 0),
    }));
  }

  const methods = Array.isArray(financiero?.metodosPago)
    ? financiero.metodosPago.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  const total = Number(financiero?.total || 0);
  if (methods.length === 1) {
    return [{
      cuenta: methods[0],
      metodo: methods[0],
      monto: methods[0].toLowerCase().includes("efectivo")
        ? Number(financiero?.montoEfectivo ?? financiero?.efectivoMonto ?? total)
        : total,
    }];
  }

  const metodoPago = String(financiero?.metodoPago || "").trim();
  if (metodoPago) {
    return [{
      cuenta: metodoPago,
      metodo: metodoPago,
      monto: metodoPago.toLowerCase().includes("efectivo")
        ? Number(financiero?.montoEfectivo ?? financiero?.efectivoMonto ?? total)
        : total,
    }];
  }

  return [];
}

function renderBarChartRows(rows, field, isMoney = false, labelField = "nombre") {
  const maxValue = Math.max(...rows.map(item => Number(item?.[field] || 0)), 0);

  return rows.map(item => {
    const value = Number(item?.[field] || 0);
    const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
    return (
      <div key={`${field}-${item.key}`} className="accounting-bar-row">
        <div className="accounting-bar-row-head">
          <strong>{item[labelField]}</strong>
          <span>{isMoney ? `$${formatearCOP(value)}` : value}</span>
        </div>
        <div className="accounting-bar-track">
          <div className="accounting-bar-fill" style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  });
}

function extractCashAmount(financiero, fallbackTotal = 0) {
  const entries = extractPaymentEntries(financiero);
  if (entries.length > 0) {
    return roundMoney(entries.reduce((sum, item) => {
      if (!String(item?.metodo || "").trim().toLowerCase().includes("efectivo")) return sum;
      return sum + Number(item?.monto || 0);
    }, 0));
  }
  return 0;
}

function isSaleStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "APROBADO";
}

function parseMoneyInput(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function storageKeyFor(empresaId, sucursalId, fecha) {
  return `${empresaId}:${sucursalId}:${fecha}`;
}

function readCashClosing(empresaId, sucursalId, fecha) {
  if (!fecha) return null;
  try {
    const raw = globalThis.localStorage?.getItem(CASH_CLOSING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.[storageKeyFor(empresaId, sucursalId, fecha)] || null;
  } catch {
    return null;
  }
}

function writeCashClosing(empresaId, sucursalId, fecha, value) {
  const raw = globalThis.localStorage?.getItem(CASH_CLOSING_STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  parsed[storageKeyFor(empresaId, sucursalId, fecha)] = value;
  globalThis.localStorage?.setItem(CASH_CLOSING_STORAGE_KEY, JSON.stringify(parsed));
}

function listCashClosings(empresaId, sucursalId) {
  try {
    const raw = globalThis.localStorage?.getItem(CASH_CLOSING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const prefix = `${empresaId}:${sucursalId}:`;

    return Object.entries(parsed)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        fecha: key.slice(prefix.length),
        base: roundMoney(value?.base),
        efectivo: roundMoney(value?.efectivo),
        gasto: roundMoney(value?.gasto),
        totalEfectivo: roundMoney(value?.totalEfectivo),
        nuevaBase: roundMoney(value?.nuevaBase),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch {
    return [];
  }
}
