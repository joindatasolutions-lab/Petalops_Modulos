import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";

const CASH_CLOSING_STORAGE_KEY = "petalops_accounting_cash_closing";

const ACCOUNTING_VIEWS = [
  { key: "ventas", label: "Ventas" },
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
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoContabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
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
  const [orderRows, setOrderRows] = useState([]);
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

      setOrderRows(buildAccountingRows(details));
    } catch (nextError) {
      console.error("Error cargando contabilidad:", nextError);
      setOrderRows([]);
      setError(nextError?.message || "No fue posible cargar el módulo de contabilidad.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, filters.fechaDesde, filters.fechaHasta, sucursalId]);

  useEffect(() => {
    loadAccountingData();
  }, [loadAccountingData]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

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

  const summaryTotals = useMemo(() => {
    return orderRows.reduce((acc, row) => ({
      cantidadPedidos: acc.cantidadPedidos + Number(row.cantidadPedidos || 0),
      totalArreglos: acc.totalArreglos + Number(row.totalArreglos || 0),
      totalDomicilios: acc.totalDomicilios + Number(row.totalDomicilios || 0),
      totalVenta: acc.totalVenta + Number(row.totalVenta || 0),
      totalEfectivo: acc.totalEfectivo + Number(row.totalEfectivo || 0),
    }), {
      cantidadPedidos: 0,
      totalArreglos: 0,
      totalDomicilios: 0,
      totalVenta: 0,
      totalEfectivo: 0,
    });
  }, [orderRows]);

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

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

  const applyFilter = (field, value) => {
    setFilters(current => ({
      ...current,
      [field]: value,
    }));
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
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Modulos">
          {canViewPipeline ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPipeline(); }}><span className="sidebar-nav-icon">▦</span><span className="sidebar-nav-text">Pipeline</span></button> : null}
          {canViewPedidos ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPedidos(); }}><span className="sidebar-nav-icon">🧾</span><span className="sidebar-nav-text">Pedidos</span></button> : null}
          {canViewProduccion ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoProduccion(); }}><span className="sidebar-nav-icon">🏭</span><span className="sidebar-nav-text">Producción</span></button> : null}
          {canViewDomicilios ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoDomicilios(); }}><span className="sidebar-nav-icon">🛵</span><span className="sidebar-nav-text">Domicilios</span></button> : null}
          {canViewInventario ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoInventario(); }}><span className="sidebar-nav-icon">📦</span><span className="sidebar-nav-text">Inventario</span></button> : null}
          {canViewContabilidad ? <button type="button" className="sidebar-nav-btn is-active" onClick={() => { setSidebarMobileOpen(false); onGoContabilidad(); }}><span className="sidebar-nav-icon">📊</span><span className="sidebar-nav-text">Contabilidad</span></button> : null}
          {canViewClientesPanel ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoClientes(); }}><span className="sidebar-nav-icon">💐</span><span className="sidebar-nav-text">Clientes</span></button> : null}
          {canViewUsuariosPanel ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoUsuarios(); }}><span className="sidebar-nav-icon">👥</span><span className="sidebar-nav-text">Gestión Usuarios</span></button> : null}
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesión</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar} title={sidebarPinned ? "Contraer menú" : "Expandir menú"}>
          {sidebarPinned ? "←" : "→"}
        </button>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view accounting-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar} title="Abrir o cerrar menú">☰ Menú</button>
            <h1>Contabilidad</h1>
            <p className="orders-admin-subtitle">Resumen de ventas y cierre operativo por fecha.</p>
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

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}

        {activeView === "ventas" ? (
          <>
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
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cantidad de pedidos</th>
                    <th>Total $ en arreglos florales</th>
                    <th>Total $ en domicilios</th>
                    <th>Total de la venta</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>{loading ? "Cargando resumen..." : "No hay ventas para los filtros seleccionados."}</td>
                    </tr>
                  ) : orderRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>{row.cantidadPedidos}</td>
                      <td>${formatearCOP(row.totalArreglos)}</td>
                      <td>${formatearCOP(row.totalDomicilios)}</td>
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
                      <th>${formatearCOP(summaryTotals.totalVenta)}</th>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
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
                <input
                  type="date"
                  value={cashForm.fecha}
                  onChange={event => setCashForm(current => ({ ...current, fecha: event.target.value }))}
                />
              </label>
              <label className="order-detail-edit-label">
                Base
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashForm.base}
                  onChange={event => setCashForm(current => ({ ...current, base: event.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="order-detail-edit-label">
                Efectivo
                <input type="text" value={`$${formatearCOP(efectivoValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Gasto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashForm.gasto}
                  onChange={event => setCashForm(current => ({ ...current, gasto: event.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="order-detail-edit-label">
                T. Efectivo
                <input type="text" value={`$${formatearCOP(totalEfectivoCaja)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Guardado
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashForm.guardado}
                  onChange={event => setCashForm(current => ({ ...current, guardado: event.target.value }))}
                  placeholder="0.00"
                />
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
      totalVenta: 0,
      totalEfectivo: 0,
    };

    const financiero = item?.detail?.financiero || {};
    const domicilio = roundMoney(financiero?.domicilio);
    const total = roundMoney(financiero?.total ?? item?.order?.total);
    const arreglos = roundMoney((financiero?.subtotal ?? 0) + (financiero?.iva ?? 0));

    current.cantidadPedidos += 1;
    current.totalArreglos += arreglos;
    current.totalDomicilios += domicilio;
    current.totalVenta += total;
    current.totalEfectivo += extractCashAmount(financiero, total);

    grouped.set(fecha, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function extractCashAmount(financiero, fallbackTotal = 0) {
  const breakdownCandidates = [
    financiero?.detallePago,
    financiero?.desglosePago,
    financiero?.metodosPagoDetalle,
    financiero?.paymentBreakdown,
  ];
  const breakdown = breakdownCandidates.find(Array.isArray) || [];
  if (breakdown.length > 0) {
    return roundMoney(breakdown.reduce((sum, item) => {
      const metodo = String(item?.metodo || item?.metodoPago || item?.nombre || "").trim().toLowerCase();
      if (!metodo.includes("efectivo")) return sum;
      return sum + Number(item?.monto ?? item?.valor ?? item?.amount ?? 0);
    }, 0));
  }

  const methods = Array.isArray(financiero?.metodosPago)
    ? financiero.metodosPago.map(item => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (methods.length === 1 && methods[0].includes("efectivo")) {
    return roundMoney(financiero?.montoEfectivo ?? financiero?.efectivoMonto ?? fallbackTotal);
  }

  const metodoPago = String(financiero?.metodoPago || "").trim().toLowerCase();
  if (metodoPago.includes("efectivo")) {
    return roundMoney(financiero?.montoEfectivo ?? financiero?.efectivoMonto ?? fallbackTotal);
  }

  return 0;
}

function isSaleStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized !== "RECHAZADO" && normalized !== "CANCELADO";
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
