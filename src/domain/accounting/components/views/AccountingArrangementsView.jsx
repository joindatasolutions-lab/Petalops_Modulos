import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CircleAlert, CircleCheck, Columns3, CreditCard, Download, Package, Search, Sparkles, Tag, Truck, Users, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatearCOP } from "../../../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "../../accountingDomain.js";
import { AccountingRanking, AccountingSalesTooltip, renderBarChartRows } from "../../AccountingViewParts.jsx";
export function AccountingArrangementsView({
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
      {activeView === "arreglos" ? (
          <section className="order-block accounting-arrangements-panel">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>Métricas por arreglos</h4>
                <p className="orders-admin-subtitle">Cuántas unidades se han vendido por arreglo, con filtro masivo y detalle visual.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={exportArreglos} disabled={selectedArrangementRows.length === 0}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <section className="accounting-analytics-panel accounting-arrangements-ranking-panel">
              <div className="accounting-panel-head">
                <div>
                  <span>Top de arreglos</span>
                  <h3>Ventas, unidades y concentracion</h3>
                </div>
                <BarChart3 size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-ranking-grid">
                <AccountingRanking title="Top arreglos por ventas" rows={arrangementRows.slice().sort((a, b) => Number(b.totalVendido || 0) - Number(a.totalVendido || 0)).slice(0, 5)} valueField="totalVendido" labelField="nombre" isMoney />
                <AccountingRanking title="Top arreglos por unidades" rows={arrangementRows.slice(0, 5)} valueField="unidades" labelField="nombre" />
              </div>
            </section>

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
    </>
  );
}