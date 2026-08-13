import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CircleAlert, CircleCheck, Columns3, CreditCard, Download, Package, Search, Sparkles, Tag, Truck, Users, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatearCOP } from "../../../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "../../accountingDomain.js";
import { AccountingRanking, AccountingSalesTooltip, renderBarChartRows } from "../../AccountingViewParts.jsx";
export function AccountingPaymentAccountsView({
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
                <div className="accounting-arrangements-actions">
                  <button type="button" className="btn-outline" onClick={exportCuentas} disabled={paymentAccountRows.length === 0}>
                    Descargar Excel
                  </button>
                </div>
              </div>

              <section className="accounting-analytics-panel accounting-payment-ranking-panel">
                <div className="accounting-panel-head">
                  <div>
                    <span>Ranking de pagos</span>
                    <h3>Medios y cuentas dominantes</h3>
                  </div>
                  <CreditCard size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-ranking-grid">
                  <AccountingRanking title="Medios por recaudo" rows={paymentAccountRows} valueField="totalRecaudado" labelField="cuenta" isMoney />
                  <AccountingRanking title="Medios por pedidos" rows={paymentAccountRows.slice().sort((a, b) => Number(b.pedidos || 0) - Number(a.pedidos || 0))} valueField="pedidos" labelField="cuenta" />
                </div>
              </section>

              <div className="accounting-chart-grid accounting-payment-hidden-charts" aria-hidden="true">
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
    </>
  );
}