import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CircleAlert, CircleCheck, Columns3, CreditCard, Download, Package, Search, Sparkles, Tag, Truck, Users, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatearCOP } from "../../../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "../../accountingDomain.js";
import { AccountingRanking, AccountingSalesTooltip, renderBarChartRows } from "../../AccountingViewParts.jsx";
export function AccountingSalesView({
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
  executiveMetrics,
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
  salesTableTotals,
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
      {activeView === "ventas" ? (
          <>
            <section className="accounting-reference-main">
              <article className="accounting-reference-panel accounting-reference-financial">
                <div className="accounting-reference-panel-head">
                  <div>
                    <h3>Resumen financiero</h3>
                    <span>Las cifras incluyen impuestos y movimientos registrados en el periodo.</span>
                  </div>
                  <CircleAlert size={15} strokeWidth={2} aria-hidden="true" />
                </div>
            <section className="accounting-summary-cards accounting-summary-cards--top">
              <article className="order-block accounting-stat-card">
                <span>Ventas brutas</span>
                <strong>${formatearCOP(summaryTotals.totalArreglos + summaryTotals.totalDomicilios + summaryTotals.totalRecargos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Descuentos</span>
                <strong>-${formatearCOP(summaryTotals.totalDescuentos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Saldo a favor</span>
                <strong>${formatearCOP(Number(summaryTotals.totalSaldoFavor || 0))}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Ventas netas</span>
                <strong>${formatearCOP(summaryTotals.totalVenta)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Ajustes / cancelaciones</span>
                <strong>{summaryTotals.pedidosCancelados}</strong>
              </article>
            </section>

            <section className="accounting-intelligence-grid">
              <article className="accounting-analytics-panel accounting-sales-panel">
                <div className="accounting-panel-head">
                  <div>
                    <span>Analisis de ventas</span>
                    <h3>Ventas por dia</h3>
                  </div>
                  <BadgeDollarSign size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-line-chart" aria-label="Grafico de ventas por dia">
                  {salesTrendRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay ventas para graficar.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={248}>
                      <AreaChart data={salesTrendRows} margin={{ top: 12, right: 18, left: 4, bottom: 6 }}>
                        <defs>
                          <linearGradient id="accountingSalesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d9367a" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#d9367a" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#eef2f7" vertical={false} />
                        <XAxis
                          dataKey="shortLabel"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }}
                          tickFormatter={value => `$${formatearCOP(value)}`}
                          width={76}
                        />
                        <Tooltip content={<AccountingSalesTooltip />} cursor={{ stroke: "#d9367a", strokeOpacity: 0.18 }} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name="Ventas"
                          stroke="#d9367a"
                          strokeWidth={3}
                          fill="url(#accountingSalesGradient)"
                          activeDot={{ r: 6, strokeWidth: 3, stroke: "#ffffff", fill: "#d9367a" }}
                          dot={{ r: 4, strokeWidth: 2, stroke: "#ffffff", fill: "#d9367a" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </article>

              <article className="accounting-analytics-panel accounting-month-panel">
                <div className="accounting-panel-head">
                  <div>
                    <span>Vista mensual</span>
                    <h3>Ventas mes a mes</h3>
                  </div>
                  <Activity size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-month-bars">
                  {monthlySalesRows.length === 0 ? (
                    <p className="accounting-empty-state">Sin ventas mensuales.</p>
                  ) : monthlySalesRows.map(row => (
                    <div key={row.key} className="accounting-month-row">
                      <span>{row.label}</span>
                      <div><i style={{ width: `${row.height}%` }} /></div>
                      <strong>${formatearCOP(row.value)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="accounting-analytics-panel accounting-money-map">
              <div className="accounting-panel-head">
                <div>
                  <span>Mapa de dinero</span>
                  <h3>Distribucion visual del periodo</h3>
                </div>
                <Wallet size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-money-map-grid">
                <div className="accounting-donut" style={{ "--donut-value": `${Math.min(100, Math.max(0, moneyMapRows[0]?.pct || 0))}%` }}>
                  <strong>{moneyMapRows[0]?.pct || 0}%</strong>
                  <span>Arreglos</span>
                </div>
                <div className="accounting-money-bars">
                  {moneyMapRows.map(item => (
                    <div key={item.key} className={`accounting-money-row ${item.tone}`}>
                      <div>
                        <span>{item.label}</span>
                        <strong>${formatearCOP(item.value)}</strong>
                      </div>
                      <i><b style={{ width: `${item.pct}%` }} /></i>
                      <small>{item.pct}%</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
              </article>

              <article className="accounting-reference-panel accounting-reference-cash">
                <div className="accounting-reference-panel-head">
                  <div>
                    <h3>Conciliacion y caja</h3>
                    <span>Sigue los pasos para validar el cuadre correcto.</span>
                  </div>
                  <CircleAlert size={15} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-cash-guide-note">
                  <CircleCheck size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Sigue los pasos para cerrar tu caja y asegurar el cuadre correcto.</span>
                </div>
                <div className="accounting-cash-steps">
                  {[
                    ["Base inicial", baseValue],
                    ["Ingresos en efectivo", efectivoValue],
                    ["Gastos en efectivo", gastoValue],
                    ["Guardado (retiros)", guardadoValue],
                  ].map(([label, value], index) => (
                    <div key={label} className="accounting-cash-step">
                      <span>{index + 1}</span>
                      <strong>{label}</strong>
                      <em>${formatearCOP(value)}</em>
                    </div>
                  ))}
                </div>
                <div className="accounting-cash-result">
                  <p><span>Nueva base (esperada)</span><strong>${formatearCOP(nuevaBaseValue)}</strong></p>
                  <p><span>Nueva base (contada)</span><strong>${formatearCOP(nuevaBaseValue)}</strong></p>
                </div>
                <div className="accounting-cash-ok-card">
                  <CircleCheck size={18} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <strong>Cuadre correcto</strong>
                    <span>La caja esta cuadrada.</span>
                  </div>
                  <em>Diferencia<br /><b>$0</b></em>
                </div>
              </article>
            </section>

            <section className="accounting-reference-alerts" aria-label="Alertas financieras">
              <article className="accounting-reference-alert is-discount">
                <span><Tag size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p>Descuentos aplicados</p>
                  <strong>${formatearCOP(detailInsight.totalDescuentos)}</strong>
                  <small>{summaryTotals.totalVenta > 0 ? `${roundMoney((detailInsight.totalDescuentos / summaryTotals.totalVenta) * 100)}% de las ventas` : "0% de las ventas"}</small>
                </div>
                <button type="button" onClick={() => showAccountingDetail("descuento")}>Ver detalle</button>
              </article>
              <article className="accounting-reference-alert is-balance">
                <span><BadgeDollarSign size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p>Saldo a favor</p>
                  <strong>${formatearCOP(detailInsight.totalSaldoFavor)}</strong>
                  <small>{detailInsight.pedidosConSaldo} pedidos</small>
                </div>
                <button type="button" onClick={() => showAccountingDetail("saldo")}>Ver detalle</button>
              </article>
              <article className="accounting-reference-alert is-cancel">
                <span><XCircle size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p>Pedidos cancelados</p>
                  <strong>{detailInsight.cancelados}</strong>
                  <small>{summaryTotals.cantidadPedidos > 0 ? `${executiveMetrics.cancelacionesPct}% del total` : "0% del total"}</small>
                </div>
                <button type="button" onClick={() => showAccountingDetail("cancelados")}>Ver detalle</button>
              </article>
            </section>

            <div className="accounting-table-actions">
              <div>
                <h3>Auditoria de pedidos</h3>
                <span>Mostrando resumen financiero por dia del periodo.</span>
              </div>
              <div className="accounting-table-tools">
                <label>
                  <Search size={15} strokeWidth={2} aria-hidden="true" />
                  <input type="search" placeholder="Buscar pedido, cliente o usuario..." />
                </label>
                <button type="button" className="btn-outline"><Columns3 size={15} strokeWidth={2} aria-hidden="true" /> Columnas</button>
                <button type="button" className="btn-outline"><Download size={15} strokeWidth={2} aria-hidden="true" /></button>
              </div>
              <button type="button" className="btn-outline" onClick={exportVentas} disabled={orderRows.length === 0}>
                Descargar Excel
              </button>
            </div>
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
                    <th>Saldo a favor</th>
                    <th>Total de la venta</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>{loading ? "Cargando resumen..." : "No hay ventas para los filtros seleccionados."}</td>
                    </tr>
                  ) : orderRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>{row.cantidadPedidos}</td>
                      <td>${formatearCOP(row.totalArreglos)}</td>
                      <td>${formatearCOP(row.totalDomicilios)}</td>
                      <td>${formatearCOP(row.totalRecargos)}</td>
                      <td>${formatearCOP(row.totalDescuentos)}</td>
                      <td>${formatearCOP(Number(row.totalSaldoFavor || 0))}</td>
                      <td>${formatearCOP(row.totalVenta)}</td>
                    </tr>
                  ))}
                </tbody>
                {orderRows.length > 0 && salesTableTotals ? (
                  <tfoot>
                    <tr>
                      <th>{salesTableTotals.fecha || "Totales"}</th>
                      <th>{salesTableTotals.cantidadPedidos}</th>
                      <th>${formatearCOP(salesTableTotals.totalArreglos)}</th>
                      <th>${formatearCOP(salesTableTotals.totalDomicilios)}</th>
                      <th>${formatearCOP(salesTableTotals.totalRecargos)}</th>
                      <th>${formatearCOP(salesTableTotals.totalDescuentos)}</th>
                      <th>${formatearCOP(Number(salesTableTotals.totalSaldoFavor || 0))}</th>
                      <th>${formatearCOP(salesTableTotals.totalVenta)}</th>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </section>
          </>
        ) : null}
    </>
  );
}
