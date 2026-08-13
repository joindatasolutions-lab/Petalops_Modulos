import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CircleAlert, CircleCheck, Columns3, CreditCard, Download, Package, Search, Sparkles, Tag, Truck, Users, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatearCOP } from "../../../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "../../accountingDomain.js";
import { AccountingRanking, AccountingSalesTooltip, renderBarChartRows } from "../../AccountingViewParts.jsx";
export function AccountingDetailView({
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
      {activeView === "detalle" ? (
          <section className="order-block accounting-detail-panel">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>Detalle de ventas por pedido</h4>
                <p className="orders-admin-subtitle">Control de descuentos aplicados por saldo a favor o descuento comercial, saldos a favor por pagos excedidos, notas operativas y cancelaciones del periodo.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={exportDetalleVentas} disabled={filteredAccountingDetailRows.length === 0}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <section className="accounting-summary-cards accounting-summary-cards--detail">
              <article className="order-block accounting-stat-card">
                <span>Descuento</span>
                <strong>${formatearCOP(detailInsight.totalDescuentos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Saldo a favor</span>
                <strong>${formatearCOP(detailInsight.totalSaldoFavor)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos con notas</span>
                <strong>{detailInsight.pedidosConNotas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cancelados</span>
                <strong>{detailInsight.cancelados}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cuentas usadas</span>
                <strong>{detailInsight.cuentasPago}</strong>
              </article>
            </section>

            <section className="accounting-analytics-panel accounting-insight-panel">
              <div className="accounting-panel-head">
                <div>
                  <span>Inteligencia Saldos/Desc.</span>
                  <h3>Problemas y ajustes del periodo</h3>
                </div>
                <Brain size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-smart-insights">
                {[
                  detailInsight.totalDescuentos > 0 ? `Hay $${formatearCOP(detailInsight.totalDescuentos)} en descuentos aplicados por saldo a favor o descuento comercial.` : "No hay descuentos aplicados en el periodo.",
                  detailInsight.totalSaldoFavor > 0 ? `El saldo a favor por pagos excedidos acumulado es $${formatearCOP(detailInsight.totalSaldoFavor)}.` : "No hay saldos a favor pendientes.",
                  detailInsight.pedidosConNotas > 0 ? `${detailInsight.pedidosConNotas} pedidos tienen notas de descuentos o saldos a favor.` : "No hay notas de descuentos o saldos a favor.",
                  detailInsight.cancelados > 0 ? `${detailInsight.cancelados} pedidos fueron cancelados.` : "No existen cancelaciones en el periodo.",
                ].map((item, index) => (
                  <div key={`detail-insight-${index}`} className="accounting-smart-card">
                    <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="accounting-detail-layout">
              <article className="accounting-chart-card">
                <h5>Vision general de ajustes</h5>
                <div className="accounting-bar-list">
                  {renderBarChartRows(detailChartRows, "value", true, "label")}
                </div>
              </article>
              <article className="accounting-chart-card accounting-detail-highlight">
                <h5>Pedidos destacados</h5>
                <div className="accounting-detail-highlight-grid">
                  <p>
                    <span>Mayor descuento aplicado</span>
                    <strong>{detailInsight.topDescuento ? `#${detailInsight.topDescuento.numeroPedido || detailInsight.topDescuento.pedidoID}` : "-"}</strong>
                    <small>{detailInsight.topDescuento ? `$${formatearCOP(detailInsight.topDescuento.descuentoMonto)}` : "Sin descuentos"}</small>
                  </p>
                  <p>
                    <span>Mayor saldo a favor</span>
                    <strong>{detailInsight.topSaldo ? `#${detailInsight.topSaldo.numeroPedido || detailInsight.topSaldo.pedidoID}` : "-"}</strong>
                    <small>{detailInsight.topSaldo ? `$${formatearCOP(Number(detailInsight.topSaldo.saldoFavorMonto || 0))}` : "Sin saldos"}</small>
                  </p>
                  <p>
                    <span>Cuenta más usada</span>
                    <strong>{detailInsight.cuentaPrincipal?.cuenta || "-"}</strong>
                    <small>{detailInsight.cuentaPrincipal ? `${detailInsight.cuentaPrincipal.pedidos} pedidos` : "Sin pagos"}</small>
                  </p>
                </div>
              </article>
            </section>

            <section className="accounting-detail-filters" aria-label="Filtros detalle de ventas">
              {[
                ["todos", "Todos"],
                ["descuento", "Con descuento aplicado"],
                ["saldo", "Con saldo a favor"],
                ["cancelados", "Cancelados"],
                ["conNotas", "Con notas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn-outline${detailFilter === key ? " is-selected" : ""}`}
                  onClick={() => setDetailFilter(key)}
                >
                  {label}
                </button>
              ))}
            </section>

            {selectedAccountingCase ? (
              <section className="accounting-case-detail-card" aria-label="Detalle del caso contable">
                <div>
                  <span>Pedido</span>
                  <strong>#{selectedAccountingCase.numeroPedido || selectedAccountingCase.codigoPedido || selectedAccountingCase.pedidoID}</strong>
                </div>
                <div>
                  <span>Cliente</span>
                  <strong>{selectedAccountingCase.cliente || "-"}</strong>
                  <small>{selectedAccountingCase.telefono || selectedAccountingCase.telefonoCliente || selectedAccountingCase.celular || "-"}</small>
                </div>
                <div>
                  <span>Cuenta pago</span>
                  <strong>{selectedAccountingCase.cuentaPago || "-"}</strong>
                </div>
                <div>
                  <span>Descuento aplicado</span>
                  <strong>${formatearCOP(selectedAccountingCase.descuentoMonto || 0)}</strong>
                  <small>{selectedAccountingCase.descuentoNota || "Sin nota"}</small>
                </div>
                <div>
                  <span>Saldo a favor</span>
                  <strong>${formatearCOP(Number(selectedAccountingCase.saldoFavorMonto || 0))}</strong>
                  <small>{selectedAccountingCase.saldoFavorNota || "Sin nota"}</small>
                </div>
                <button type="button" className="btn-outline" onClick={() => setSelectedAccountingCase(null)}>Cerrar</button>
              </section>
            ) : null}

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table accounting-detail-table">
                <thead>
                  <tr>
                    <th># Pedido</th>
                    <th>Usuario sistema</th>
                    <th>Cliente</th>
                    <th>Cuenta pago</th>
                    <th>Saldo a favor</th>
                    <th>Descuento aplicado</th>
                    <th>Notas descuentos/saldos a favor</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccountingDetailRows.length === 0 ? (
                    <tr>
                      <td colSpan={9}>{loading ? "Cargando detalle..." : "No hay pedidos para el filtro seleccionado."}</td>
                    </tr>
                  ) : filteredAccountingDetailRows.map(row => {
                    const adjustmentNotes = getAdjustmentNoteItems(row);
                    return (
                    <tr key={`${row.pedidoID}-${row.numeroPedido}`}>
                      <td>{row.numeroPedido || row.codigoPedido || row.pedidoID}</td>
                      <td>{row.usuarioSistema || "-"}</td>
                      <td>
                        <strong>{row.cliente || "-"}</strong>
                        <span>{row.telefono || row.telefonoCliente || row.celular || "-"}</span>
                      </td>
                      <td>{row.cuentaPago || "-"}</td>
                      <td>
                        <strong>${formatearCOP(Number(row.saldoFavorMonto || 0))}</strong>
                      </td>
                      <td>
                        <strong>${formatearCOP(row.descuentoMonto || 0)}</strong>
                      </td>
                      <td>
                        {adjustmentNotes.length > 0 ? (
                          <div className="accounting-adjustment-notes">
                            {adjustmentNotes.map(item => (
                              <span key={`${item.label}-${item.note}`}>
                                {item.note}
                              </span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td>
                        <span className={`order-badge ${row.cancelado ? "is-cancelado" : "is-aprobado"}`}>
                          {row.cancelado ? "Cancelado" : row.estado || "Activo"}
                        </span>
                        {row.notaCancelacion ? <small>{row.notaCancelacion}</small> : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-outline accounting-row-detail-btn"
                          title="Ver informacion del caso"
                          onClick={() => setSelectedAccountingCase(row)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}
    </>
  );
}