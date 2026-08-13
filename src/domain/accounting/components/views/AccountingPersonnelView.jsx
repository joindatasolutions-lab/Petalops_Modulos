import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CircleAlert, CircleCheck, Columns3, CreditCard, Download, Package, Search, Sparkles, Tag, Truck, Users, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatearCOP } from "../../../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "../../accountingDomain.js";
import { AccountingRanking, AccountingSalesTooltip, renderBarChartRows } from "../../AccountingViewParts.jsx";

function formatDeliveryOrderNumber(item) {
  const value = item?.numeroPedido || item?.pedidoID || "";
  return String(value).replace(/^FLR-/i, "") || "-";
}

function normalizeDeliveryStatus(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function formatDeliveryStatus(value) {
  const status = normalizeDeliveryStatus(value);
  if (status === "NO_ENTREGADO" || status === "NO_ENTREGADA") return "No entregado";
  if (status === "ENTREGADO" || status === "ENTREGADA") return "Entregado";
  if (status === "REPROGRAMADO" || status === "REPROGRAMADA") return "Reprogramado";
  return value || "-";
}

function getDeliveryStatusBadgeClass(value) {
  const status = normalizeDeliveryStatus(value);
  if (status === "NO_ENTREGADO" || status === "NO_ENTREGADA") return "order-badge is-cancelado";
  return "order-badge is-aprobado";
}

export function AccountingPersonnelView({
  activeDeliveryPersonOrdersStatus,
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
  clearDeliveryPersonOrdersDetail,
  deliveryPersonMetricRows,
  deliveryPersonOrdersDetail,
  detailChartRows,
  detailFilter,
  detailInsight,
  displayUserName,
  efectivoValue,
  error,
  exportArreglos,
  exportCaja,
  exportCuentas,
  exportDeliveryPersonOrdersDetail,
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
  loadDeliveryPersonOrdersDetail,
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
  const deliveryOrderStatusOptions = [
    ["", "Todos"],
    ["entregado", "Entregados"],
    ["no_entregado", "No entregados"],
  ];

  return (
    <>
      {activeView === "personal" ? (
          <section className="accounting-personnel-dashboard">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>{personnelMode === "floristas" ? "Metricas de Floristas" : "Metricas de Domiciliarios"}</h4>
                <p className="orders-admin-subtitle">Control operativo y contable por persona en el periodo filtrado.</p>
              </div>
            </div>

            <section className="accounting-personnel-toolbar">
              <div className="accounting-personnel-segment" aria-label="Tipo de metrica">
                <button type="button" className={personnelMode === "domiciliarios" ? "is-active" : ""} onClick={() => setPersonnelMode("domiciliarios")}>
                  <Truck size={16} strokeWidth={2} aria-hidden="true" />
                  Domiciliarios
                </button>
                <button type="button" className={personnelMode === "floristas" ? "is-active" : ""} onClick={() => setPersonnelMode("floristas")}>
                  <Users size={16} strokeWidth={2} aria-hidden="true" />
                  Floristas
                </button>
              </div>
              <label>
                Tipo
                <select value={personnelTypeFilter} onChange={event => setPersonnelTypeFilter(event.target.value)}>
                  <option value="todos">Todos</option>
                  {personnelTypeOptions.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </label>
              <label>
                {personnelMode === "floristas" ? "Florista" : "Domiciliario"}
                <input
                  type="search"
                  value={personnelSearch}
                  onChange={event => setPersonnelSearch(event.target.value)}
                  placeholder={personnelMode === "floristas" ? "Buscar florista" : "Buscar domiciliario"}
                />
              </label>
              <button type="button" className="btn-outline" onClick={() => { setPersonnelTypeFilter("todos"); setPersonnelSearch(""); }}>
                Limpiar
              </button>
            </section>

            <section className="accounting-personnel-kpis">
              {[
                [personnelMode === "floristas" ? "Total de arreglos" : "Total de domicilios", personnelDashboardSummary.unidades, personnelMode === "floristas" ? "Arreglos realizados" : "Domicilios realizados", personnelMode === "floristas" ? Users : Truck],
                [personnelMode === "floristas" ? "Pedidos trabajados" : "Pedidos entregados", personnelDashboardSummary.pedidos, "Total de pedidos", Package],
                [personnelMode === "floristas" ? "Total vendido" : "Total costo en domicilios", `$${formatearCOP(personnelDashboardSummary.total)}`, personnelMode === "floristas" ? "Venta asociada" : "Costo total", Wallet],
                [personnelMode === "floristas" ? "Promedio por arreglo" : "Costo promedio", `$${formatearCOP(personnelDashboardSummary.promedio)}`, personnelMode === "floristas" ? "Por arreglo" : "Por domicilio", Banknote],
                [personnelMode === "floristas" ? "Floristas utilizados" : "Domiciliarios utilizados", personnelDashboardSummary.personas, personnelMode === "floristas" ? "Floristas activos" : "Domiciliarios activos", Users],
              ].map(([label, value, helper, Icon]) => (
                <article key={label} className="accounting-personnel-kpi">
                  <span className="accounting-personnel-kpi-icon"><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
                  <div>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{helper}</small>
                  </div>
                </article>
              ))}
            </section>

            <section className="orders-table-wrap accounting-personnel-list">
              <div className="accounting-cash-history-head">
                <div>
                  <h4>{personnelMode === "floristas" ? "Listado de Floristas" : "Listado de Domicilios"}</h4>
                  <p className="orders-admin-subtitle">{personnelDashboardRows.length} registros filtrados.</p>
                </div>
              </div>
              <table className="orders-table accounting-table accounting-personnel-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{personnelMode === "floristas" ? "Florista" : "Domiciliario"}</th>
                    <th>Tipo</th>
                    {personnelMode === "floristas" ? <th>Pedidos</th> : null}
                    <th>{personnelMode === "floristas" ? "Arreglos" : "Entregas"}</th>
                    <th>{personnelMode === "floristas" ? "Venta asociada" : "Costo domicilio"}</th>
                    <th>Promedio</th>
                    <th>Completados</th>
                    <th>En proceso</th>
                    <th>Pendientes</th>
                    <th>{personnelMode === "floristas" ? "Cancelados" : "No entregados"}</th>
                    {personnelMode === "domiciliarios" ? <th>Acciones</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {personnelDashboardRows.length === 0 ? (
                    <tr>
                      <td colSpan={personnelMode === "domiciliarios" ? 12 : 11}>No hay metricas para mostrar con estos filtros.</td>
                    </tr>
                  ) : personnelDashboardRows.map(item => (
                    <tr key={item.key}>
                      <td>{item.id || "-"}</td>
                      <td><strong>{item.nombre}</strong></td>
                      <td><span className="order-badge is-aprobado">{item.tipo || "Sin tipo"}</span></td>
                      {personnelMode === "floristas" ? <td>{item.pedidos}</td> : null}
                      <td>{personnelMode === "floristas" ? item.arreglos : item.entregas}</td>
                      <td>${formatearCOP(personnelMode === "floristas" ? item.totalVendido : item.totalDomicilios)}</td>
                      <td>${formatearCOP(item.promedio)}</td>
                      <td>{item.completados}</td>
                      <td>{item.enProceso}</td>
                      <td>{item.pendientes}</td>
                      <td>{item.cancelados}</td>
                      {personnelMode === "domiciliarios" ? (
                        <td>
                          <button
                            type="button"
                            className="btn-outline accounting-row-detail-btn"
                            onClick={() => loadDeliveryPersonOrdersDetail(item)}
                            disabled={!item.id || deliveryPersonOrdersDetail.loading}
                          >
                            {deliveryPersonOrdersDetail.loading && deliveryPersonOrdersDetail.selectedRow?.id === item.id ? "Cargando..." : "Ver pedidos"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {personnelMode === "domiciliarios" && (deliveryPersonOrdersDetail.payload || deliveryPersonOrdersDetail.error || deliveryPersonOrdersDetail.loading) ? (
              <section className="order-block accounting-arrangements-panel accounting-delivery-detail-panel">
                <div className="looker-header accounting-arrangements-head accounting-delivery-detail-head">
                  <div className="accounting-delivery-detail-title">
                    <span>Pedidos por domiciliario</span>
                    <h3>{deliveryPersonOrdersDetail.selectedRow?.nombre || deliveryPersonOrdersDetail.payload?.domiciliario?.nombre || "Domiciliario"}</h3>
                    <p className="orders-admin-subtitle">{filters.fechaDesde} a {filters.fechaHasta}</p>
                  </div>
                  <div className="accounting-delivery-detail-actions">
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={exportDeliveryPersonOrdersDetail}
                      disabled={
                        deliveryPersonOrdersDetail.loading ||
                        deliveryPersonOrdersDetail.error ||
                        !Array.isArray(deliveryPersonOrdersDetail.payload?.items) ||
                        deliveryPersonOrdersDetail.payload.items.length === 0
                      }
                    >
                      <Download size={15} strokeWidth={2} aria-hidden="true" />
                      Descargar Excel
                    </button>
                    <button type="button" className="btn-outline" onClick={clearDeliveryPersonOrdersDetail}>
                      Cerrar
                    </button>
                  </div>
                </div>

                {deliveryPersonOrdersDetail.error ? (
                  <p className="orders-message">{deliveryPersonOrdersDetail.error}</p>
                ) : null}

                {deliveryPersonOrdersDetail.payload?.resumen ? (
                  <section className="accounting-delivery-detail-kpis">
                    {[
                      ["Pedidos", deliveryPersonOrdersDetail.payload.resumen.pedidos],
                      ["Entregados", deliveryPersonOrdersDetail.payload.resumen.entregados],
                      ["No entregados", deliveryPersonOrdersDetail.payload.resumen.noEntregados],
                      ["Total domicilios", `$${formatearCOP(deliveryPersonOrdersDetail.payload.resumen.totalDomicilios)}`],
                      ["Promedio", `$${formatearCOP(deliveryPersonOrdersDetail.payload.resumen.promedioDomicilio)}`],
                    ].map(([label, value]) => (
                      <article key={label} className="accounting-delivery-detail-kpi">
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </article>
                    ))}
                  </section>
                ) : null}

                {deliveryPersonOrdersDetail.payload || deliveryPersonOrdersDetail.loading ? (
                  <div className="accounting-delivery-detail-filters" aria-label="Filtrar pedidos por estado de entrega">
                    {deliveryOrderStatusOptions.map(([status, label]) => (
                      <button
                        key={status || "todos"}
                        type="button"
                        className={activeDeliveryPersonOrdersStatus === status ? "is-active" : ""}
                        onClick={() => loadDeliveryPersonOrdersDetail(
                          deliveryPersonOrdersDetail.selectedRow || deliveryPersonOrdersDetail.payload?.domiciliario,
                          status
                        )}
                        disabled={deliveryPersonOrdersDetail.loading}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <section className="orders-table-wrap">
                  {!deliveryPersonOrdersDetail.error ? (
                    <table className="orders-table accounting-table accounting-personnel-table">
                      <thead>
                        <tr>
                          <th>Pedido</th>
                          <th>Fecha entrega</th>
                          <th>Cliente</th>
                          <th>Telefono</th>
                          <th>Barrio</th>
                          <th>Estado entrega</th>
                          <th>Valor domicilio</th>
                          <th>Total pedido</th>
                          <th>Hora entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryPersonOrdersDetail.loading ? (
                          <tr>
                            <td colSpan={9}>Cargando pedidos del domiciliario...</td>
                          </tr>
                        ) : !Array.isArray(deliveryPersonOrdersDetail.payload?.items) || deliveryPersonOrdersDetail.payload.items.length === 0 ? (
                          <tr>
                            <td colSpan={9}>No hay pedidos para este domiciliario en el periodo.</td>
                          </tr>
                        ) : deliveryPersonOrdersDetail.payload.items.map(item => (
                          <tr key={`${item.pedidoID}-${item.numeroPedido}`}>
                            <td>{formatDeliveryOrderNumber(item)}</td>
                            <td>{item.fechaEntrega || "-"}</td>
                            <td><strong>{item.cliente || "-"}</strong></td>
                            <td>{item.telefono || "-"}</td>
                            <td>{item.barrio || "-"}</td>
                            <td>
                              <span className={getDeliveryStatusBadgeClass(item.estadoEntrega)}>
                                {formatDeliveryStatus(item.estadoEntrega)}
                              </span>
                            </td>
                            <td>${formatearCOP(item.valorDomicilio)}</td>
                            <td>${formatearCOP(item.totalPedido)}</td>
                            <td>{item.horaEntrega || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </section>
              </section>
            ) : null}

            <section className="accounting-personnel-bottom-grid">
              <article className="accounting-chart-card accounting-personnel-totals">
                <h5>Totales del periodo</h5>
                <p><span>Pedidos</span><strong>{personnelDashboardSummary.pedidos}</strong></p>
                <p><span>{personnelMode === "floristas" ? "Arreglos" : "Domicilios"}</span><strong>{personnelDashboardSummary.unidades}</strong></p>
                <p><span>{personnelMode === "floristas" ? "Venta asociada" : "Total domicilio"}</span><strong>${formatearCOP(personnelDashboardSummary.total)}</strong></p>
              </article>
              <article className="accounting-chart-card">
                <h5>{personnelMode === "floristas" ? "Floristas por tipo" : "Domicilios por tipo"}</h5>
                {personnelDashboardSummary.typeRows.length === 0 ? <p className="accounting-empty-state">Sin datos.</p> : (
                  <div className="accounting-bar-list">
                    {renderBarChartRows(personnelDashboardSummary.typeRows, "value", false, "label")}
                  </div>
                )}
              </article>
              <article className="accounting-chart-card">
                <h5>{personnelMode === "floristas" ? "Venta por florista" : "Costo por domiciliario"}</h5>
                {personnelDashboardRows.length === 0 ? <p className="accounting-empty-state">Sin datos.</p> : (
                  <div className="accounting-bar-list">
                    {renderBarChartRows(personnelDashboardRows.slice(0, 6), personnelMode === "floristas" ? "totalVendido" : "totalDomicilios", true, "nombre")}
                  </div>
                )}
              </article>
              <article className="accounting-chart-card accounting-personnel-indicators">
                <h5>Indicadores clave</h5>
                <p><span>Cumplimiento</span><strong>{personnelDashboardSummary.cumplimientoPct}%</strong></p>
                <p><span>{personnelMode === "floristas" ? "Lider por venta" : "Mayor costo acumulado"}</span><strong>{personnelDashboardSummary.leader?.nombre || "-"}</strong></p>
                <p><span>{personnelMode === "floristas" ? "Tiempo promedio" : "Reprogramadas"}</span><strong>{personnelMode === "floristas" ? `${personnelDashboardSummary.tiempoPromedioMin} min` : personnelDashboardSummary.reprogramadas}</strong></p>
              </article>
            </section>
          </section>
        ) : null}
    </>
  );
}
