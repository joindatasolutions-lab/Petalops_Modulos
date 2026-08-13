import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CircleAlert, CircleCheck, Columns3, CreditCard, Download, Package, Search, Sparkles, Tag, Truck, Users, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatearCOP } from "../../../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "../../accountingDomain.js";
import { AccountingRanking, AccountingSalesTooltip, renderBarChartRows } from "../../AccountingViewParts.jsx";
export function AccountingCashView({
  activeExportAction,
  activePeriodPreset,
  activeView,
  accountingMenuOpen,
  accountingMenuRef,
  applyFilter,
  applyPeriodPreset,
  arrangementChartRows,
  arrangementRows,
  arrangementSummary,
  baseValue,
  canEditCashClosing,
  cashDashboardTotals,
  cashForm,
  cashHistoryRows,
  cashLoading,
  clearAllArrangements,
  deliveryPersonMetricRows,
  detailChartRows,
  detailFilter,
  detailInsight,
  displayUserName,
  efectivoValue,
  error,
  exportArreglos,
  exportCaja,
  exportCuentas,
  exportDetalleVentas,
  exportPersonal,
  exportVentas,
  filteredAccountingDetailRows,
  filters,
  floristMetricRows,
  gastoValue,
  guardadoValue,
  info,
  loadAccountingData,
  loading,
  moneyMapRows,
  monthlySalesRows,
  nuevaBaseValue,
  orderRows,
  paymentAccountRows,
  paymentSummary,
  personnelDashboardRows,
  personnelDashboardSummary,
  personnelMode,
  personnelSearch,
  personnelSummary,
  personnelTypeFilter,
  personnelTypeOptions,
  salesTrendRows,
  saveCashClosing,
  saving,
  selectAllArrangements,
  selectedAccountingCase,
  selectedArrangementKeys,
  selectedArrangementRows,
  setAccountingMenuOpen,
  setActiveView,
  setCashForm,
  setDetailFilter,
  setPersonnelMode,
  setPersonnelSearch,
  setPersonnelTypeFilter,
  setSelectedAccountingCase,
  showAccountingDetail,
  summaryTotals,
  todayCashDate,
  toggleArrangementSelection,
  topArrangementBySales,
  topArrangementByUnits,
  topPaymentAccount,
  totalEfectivoCaja,}) {
  return (
    <>
      {activeView === "caja" ? (
          <section className="order-block accounting-cash-panel">
            <div className="looker-header">
              <div>
                <h4>Caja</h4>
                <p className="orders-admin-subtitle">Cierre de efectivo por fecha. Los datos se consultan y guardan en base de datos.</p>
              </div>
            </div>

            <section className="accounting-analytics-panel accounting-cash-dashboard">
              <div className="accounting-panel-head">
                <div>
                  <span>Dashboard de caja</span>
                  <h3>{cashDashboardTotals.source === "period" ? "Balance financiero del periodo" : "Balance financiero del cierre"}</h3>
                </div>
                <Wallet size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-cash-kpis">
                {[
                  ["Caja inicial", cashDashboardTotals.base],
                  ["Ingresos efectivo", cashDashboardTotals.efectivo],
                  ["Gastos", cashDashboardTotals.gasto],
                  ["Caja final", cashDashboardTotals.totalEfectivo],
                  ["Guardado", cashDashboardTotals.guardado],
                  ["Nueva base", cashDashboardTotals.nuevaBase],
                ].map(([label, value]) => (
                  <article key={label} className="accounting-cash-kpi">
                    <span>{label}</span>
                    <strong>${formatearCOP(value)}</strong>
                  </article>
                ))}
              </div>
              <div className={`accounting-cash-balance ${cashDashboardTotals.nuevaBase >= 0 ? "is-ok" : "is-risk"}`}>
                {cashDashboardTotals.nuevaBase >= 0 ? <CircleCheck size={18} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />}
                <span>{cashDashboardTotals.nuevaBase >= 0 ? "Cuadre correcto" : "Diferencia encontrada"}</span>
                <strong>${formatearCOP(Math.abs(cashDashboardTotals.nuevaBase))}</strong>
              </div>
            </section>

            <div className="accounting-cash-grid">
              <label className="order-detail-edit-label">
                Fecha
                <input type="date" max={todayCashDate} value={cashForm.fecha} onChange={event => setCashForm(current => ({ ...current, fecha: event.target.value }))} />
              </label>
              <label className="order-detail-edit-label">
                Base
                <input type="number" min="0" step="0.01" value={cashForm.base} onChange={event => setCashForm(current => ({ ...current, base: event.target.value }))} placeholder="0.00" disabled={!canEditCashClosing} />
              </label>
              <label className="order-detail-edit-label">
                Efectivo
                <input type="text" value={`$${formatearCOP(efectivoValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Gasto
                <input type="number" min="0" step="0.01" value={cashForm.gasto} onChange={event => setCashForm(current => ({ ...current, gasto: event.target.value }))} placeholder="0.00" disabled={!canEditCashClosing} />
              </label>
              <label className="order-detail-edit-label">
                T. Efectivo
                <input type="text" value={`$${formatearCOP(totalEfectivoCaja)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Guardado
                <input type="number" min="0" step="0.01" value={cashForm.guardado} onChange={event => setCashForm(current => ({ ...current, guardado: event.target.value }))} placeholder="0.00" disabled={!canEditCashClosing} />
              </label>
              <label className="order-detail-edit-label">
                Nueva Base
                <input type="text" value={`$${formatearCOP(nuevaBaseValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Observación
                <input type="text" value={cashForm.observacion} onChange={event => setCashForm(current => ({ ...current, observacion: event.target.value }))} placeholder="Observación del cierre" disabled={!canEditCashClosing} />
              </label>
            </div>

            <div className="order-detail-edit-actions">
              <button type="button" className="btn-primary" onClick={saveCashClosing} disabled={saving || !canEditCashClosing}>
                {saving ? "Guardando..." : "Guardar cierre"}
              </button>
              <button type="button" className="btn-outline" onClick={exportCaja} disabled={cashHistoryRows.length === 0}>
                Descargar Excel
              </button>
            </div>

            <section className="orders-table-wrap accounting-cash-history">
              <div className="accounting-cash-history-head">
                <div>
                  <h4>Dias cerrados</h4>
                  <p className="orders-admin-subtitle">Historial de cierres guardados para esta empresa y sucursal.</p>
                </div>
                <span>{cashHistoryRows.length} cierres</span>
              </div>
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Dia cerrado</th>
                    <th>Base</th>
                    <th>Efectivo</th>
                    <th>Gasto</th>
                    <th>Total_Efectivo</th>
                    <th>Guardado</th>
                    <th>Nueva_Base</th>
                    <th>Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  {cashHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>{cashLoading ? "Cargando cierres de caja..." : "No hay cierres de caja guardados en base de datos para el rango filtrado."}</td>
                    </tr>
                  ) : cashHistoryRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>${formatearCOP(row.base)}</td>
                      <td>${formatearCOP(row.efectivo)}</td>
                      <td>${formatearCOP(row.gasto)}</td>
                      <td>${formatearCOP(row.totalEfectivo)}</td>
                      <td>${formatearCOP(row.guardado)}</td>
                      <td>${formatearCOP(row.nuevaBase)}</td>
                      <td>{row.observacion || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}
    </>
  );
}