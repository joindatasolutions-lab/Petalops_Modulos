import { Banknote, CalendarDays, ChevronDown, FileSpreadsheet, FileText, Filter, ListChecks, MoreHorizontal, Package, Receipt, RefreshCw, ShoppingCart, XCircle } from "lucide-react";
import { formatearCOP } from "../../../shared/utils.js";
import { ACCOUNTING_VIEWS, ACCOUNTING_VIEW_ICONS } from "../accountingConstants.js";
import { AccountingArrangementsView, AccountingCashView, AccountingDetailView, AccountingPaymentAccountsView, AccountingPersonnelView, AccountingSalesView } from "./AccountingViews.jsx";

export function AccountingContent(contentProps) {
  const {
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
  totalEfectivoCaja,
  } = contentProps;
  return (
      <main className={`orders-admin-view accounting-view accounting-page-view ${activeView === "personal" ? "is-personal-view" : ""}`}>
        <header className="orders-admin-header orders-page-header accounting-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-breadcrumb" aria-label="Ruta">
              <span>Finanzas</span>
              <span>/</span>
              <strong>Contabilidad</strong>
            </div>
            <div className="orders-page-title-row">
              <h1>Contabilidad</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">
              Controla ventas, recaudos, descuentos, saldos a favor y cierres de caja por periodo.
            </p>
            <span className="orders-user-pill">
              <span aria-hidden="true" />
              Sesion activa: {displayUserName}
            </span>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
              <div className="accounting-menu-dropdown" ref={accountingMenuRef}>
                <button
                  type="button"
                  className={`btn-outline accounting-menu-trigger${accountingMenuOpen ? " is-open" : ""}`}
                  onClick={() => setAccountingMenuOpen(current => !current)}
                  aria-expanded={accountingMenuOpen}
                  aria-haspopup="menu"
                >
                  {(() => {
                    const activeOption = ACCOUNTING_VIEWS.find(item => item.key === activeView) || ACCOUNTING_VIEWS[0];
                    const ActiveIcon = ACCOUNTING_VIEW_ICONS[activeOption.key] || ListChecks;
                    return (
                      <>
                        <ActiveIcon size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{activeOption.label}</span>
                        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
                      </>
                    );
                  })()}
                </button>
                {accountingMenuOpen ? (
                  <div className="accounting-menu-panel" role="menu">
                    {ACCOUNTING_VIEWS.map(item => {
                      const Icon = ACCOUNTING_VIEW_ICONS[item.key] || ListChecks;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          className={activeView === item.key ? "is-active" : ""}
                          onClick={() => {
                            setActiveView(item.key);
                            setAccountingMenuOpen(false);
                          }}
                        >
                          <Icon size={16} strokeWidth={2} aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn-primary orders-header-refresh" onClick={loadAccountingData} disabled={loading}>
                <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
                {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
          {activeView !== "personal" ? (
          <div className="orders-header-metrics accounting-header-metrics" aria-label="Resumen contabilidad">
            <article className="orders-header-metric-card is-primary">
                <span className="orders-header-metric-icon" aria-hidden="true"><ShoppingCart size={20} strokeWidth={2} /></span>
                <strong>${formatearCOP(summaryTotals.totalVenta)}</strong>
                <span>Total venta</span>
              </article>
              <article className="orders-header-metric-card is-success">
                <span className="orders-header-metric-icon" aria-hidden="true"><Banknote size={20} strokeWidth={2} /></span>
                <strong>${formatearCOP(summaryTotals.totalEfectivo)}</strong>
                <span>Efectivo</span>
              </article>
              <article className="orders-header-metric-card is-info">
                <span className="orders-header-metric-icon" aria-hidden="true"><Package size={20} strokeWidth={2} /></span>
                <strong>{summaryTotals.cantidadPedidos}</strong>
                <span>Pedidos aprobados</span>
              </article>
              <article className="orders-header-metric-card is-danger">
                <span className="orders-header-metric-icon" aria-hidden="true"><XCircle size={20} strokeWidth={2} /></span>
                <strong>{summaryTotals.pedidosCancelados}</strong>
                <span>Cancelados</span>
              </article>
              <article className="orders-header-metric-card is-warning">
                <span className="orders-header-metric-icon" aria-hidden="true"><Receipt size={20} strokeWidth={2} /></span>
                <strong>${formatearCOP(executiveMetrics.ticketPromedio)}</strong>
                <span>Ticket prom.</span>
              </article>
            </div>
          ) : null}
          </div>
        </header>

        <section className="orders-filters orders-page-filters accounting-filters">
          <div className="accounting-date-range-control">
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
            <input type="date" value={filters.fechaDesde} onChange={event => applyFilter("fechaDesde", event.target.value)} />
            <span>-</span>
            <input type="date" value={filters.fechaHasta} onChange={event => applyFilter("fechaHasta", event.target.value)} />
            <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="accounting-period-tabs" aria-label="Atajos de periodo">
            <button type="button" className={activePeriodPreset === "today" ? "is-active" : ""} onClick={() => applyPeriodPreset("today")}>Hoy</button>
            <button type="button" className={activePeriodPreset === "yesterday" ? "is-active" : ""} onClick={() => applyPeriodPreset("yesterday")}>Ayer</button>
            <button type="button" className={activePeriodPreset === "7days" ? "is-active" : ""} onClick={() => applyPeriodPreset("7days")}>7 dias</button>
            <button type="button" className={activePeriodPreset === "30days" ? "is-active" : ""} onClick={() => applyPeriodPreset("30days")}>30 dias</button>
            <button type="button" className={activePeriodPreset === "month" ? "is-active" : ""} onClick={() => applyPeriodPreset("month")}>Este mes</button>
          </div>
          <button type="button" className="accounting-filter-chip">
            <Filter size={15} strokeWidth={2} aria-hidden="true" />
            <span>Filtros</span>
          </button>
          {activeView === "arreglos" ? (
            <details className="accounting-arrangements-filter">
              <summary>
                <ListChecks size={17} strokeWidth={2} aria-hidden="true" />
                <span>Arreglos incluidos</span>
                <strong>{selectedArrangementKeys.length}/{arrangementRows.length}</strong>
                <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
              </summary>
              <div className="accounting-arrangements-filter-panel">
                <div className="accounting-arrangements-filter-actions">
                  <button type="button" onClick={selectAllArrangements} disabled={arrangementRows.length === 0}>
                    Seleccionar todo
                  </button>
                  <button type="button" onClick={clearAllArrangements} disabled={arrangementRows.length === 0}>
                    Borrar todo
                  </button>
                </div>
                <div className="accounting-arrangements-filter-list">
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
                        <small>{item.codigo || "Sin codigo"} · {item.unidades} und.</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
          <div className="accounting-filter-actions">
            <button type="button" className="btn-outline accounting-export-btn" onClick={activeExportAction.onClick} disabled={activeExportAction.disabled}>
              <FileSpreadsheet size={15} strokeWidth={2} aria-hidden="true" />
              Exportar Excel
            </button>
            <button type="button" className="btn-outline accounting-export-btn">
              <FileText size={15} strokeWidth={2} aria-hidden="true" />
              Exportar PDF
            </button>
            <button type="button" className="btn-outline accounting-more-btn" title="Mas acciones">
              <MoreHorizontal size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}

        <AccountingSalesView {...contentProps} />

        <AccountingDetailView {...contentProps} />

        <AccountingArrangementsView {...contentProps} />

        <AccountingPersonnelView {...contentProps} />

        {false && activeView === "personal" ? (
          <section className="order-block accounting-arrangements-panel accounting-personnel-panel">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>MÃ©tricas por personal</h4>
                <p className="orders-admin-subtitle">Ventas asociadas a floristas y domicilios asociados a domiciliarios en el periodo filtrado.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={exportPersonal} disabled={floristMetricRows.length === 0 && deliveryPersonMetricRows.length === 0}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <section className="accounting-summary-cards accounting-summary-cards--personnel">
              <article className="order-block accounting-stat-card">
                <span>Floristas activos</span>
                <strong>{personnelSummary.floristas.personas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Arreglos producidos</span>
                <strong>{personnelSummary.floristas.arreglos}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Venta por floristas</span>
                <strong>${formatearCOP(personnelSummary.floristas.totalVendido)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Domiciliarios activos</span>
                <strong>{personnelSummary.domiciliarios.personas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Entregas gestionadas</span>
                <strong>{personnelSummary.domiciliarios.entregas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Domicilios asociados</span>
                <strong>${formatearCOP(personnelSummary.domiciliarios.totalDomicilios)}</strong>
              </article>
            </section>

            <section className="accounting-analytics-panel accounting-personnel-ranking-panel">
              <div className="accounting-panel-head">
                <div>
                  <span>Ranking operativo-contable</span>
                  <h3>Productividad y dinero asociado</h3>
                </div>
                <Users size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-ranking-grid">
                <AccountingRanking title="Floristas por venta" rows={floristMetricRows.slice(0, 5)} valueField="totalVendido" labelField="nombre" isMoney />
                <AccountingRanking title="Domiciliarios por domicilio" rows={deliveryPersonMetricRows.slice(0, 5)} valueField="totalDomicilios" labelField="nombre" isMoney />
              </div>
            </section>

            <div className="accounting-chart-grid accounting-personnel-grid">
              <article className="accounting-chart-card">
                <div className="accounting-personnel-section-head">
                  <div>
                    <span>Floristas</span>
                    <h5>Arreglos, pedidos y ventas</h5>
                  </div>
                  <Users size={20} strokeWidth={2} aria-hidden="true" />
                </div>
                {floristMetricRows.length === 0 ? (
                  <p className="accounting-empty-state">No hay datos de floristas para este rango. El backend debe enviar floristaID/nombre en el resumen o detalle contable.</p>
                ) : (
                  <div className="accounting-bar-list">
                    {renderBarChartRows(floristMetricRows.slice(0, 8), "totalVendido", true, "nombre")}
                  </div>
                )}
              </article>
              <article className="accounting-chart-card">
                <div className="accounting-personnel-section-head">
                  <div>
                    <span>Domiciliarios</span>
                    <h5>Entregas y recaudo domicilio</h5>
                  </div>
                  <Truck size={20} strokeWidth={2} aria-hidden="true" />
                </div>
                {deliveryPersonMetricRows.length === 0 ? (
                  <p className="accounting-empty-state">No hay datos de domiciliarios para este rango. El backend debe enviar domiciliarioID/nombre en el resumen o detalle contable.</p>
                ) : (
                  <div className="accounting-bar-list">
                    {renderBarChartRows(deliveryPersonMetricRows.slice(0, 8), "totalDomicilios", true, "nombre")}
                  </div>
                )}
              </article>
            </div>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table accounting-personnel-table">
                <thead>
                  <tr>
                    <th>Florista</th>
                    <th>Pedidos</th>
                    <th>Arreglos</th>
                    <th>Total vendido</th>
                    <th>Promedio arreglo</th>
                    <th>Listos</th>
                    <th>En proceso</th>
                    <th>Pendientes</th>
                    <th>Cancelados</th>
                    <th>Tiempo prom.</th>
                    <th>Reasign.</th>
                  </tr>
                </thead>
                <tbody>
                  {floristMetricRows.length === 0 ? (
                    <tr>
                      <td colSpan={11}>No hay mÃ©tricas por florista para mostrar.</td>
                    </tr>
                  ) : floristMetricRows.map(item => (
                    <tr key={item.key}>
                      <td>{item.nombre}</td>
                      <td>{item.pedidos}</td>
                      <td>{item.arreglos}</td>
                      <td>${formatearCOP(item.totalVendido)}</td>
                      <td>${formatearCOP(item.promedio)}</td>
                      <td>{item.completados}</td>
                      <td>{item.enProceso}</td>
                      <td>{item.pendientes}</td>
                      <td>{item.cancelados}</td>
                      <td>{item.tiempoPromedioMin ? `${item.tiempoPromedioMin} min` : "-"}</td>
                      <td>{item.reasignaciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table accounting-personnel-table">
                <thead>
                  <tr>
                    <th>Domiciliario</th>
                    <th>Pedidos</th>
                    <th>Entregas</th>
                    <th>Total domicilios</th>
                    <th>Promedio entrega</th>
                    <th>Entregadas</th>
                    <th>En ruta/asignadas</th>
                    <th>Pendientes</th>
                    <th>No entregadas</th>
                    <th>Reprogramadas</th>
                    <th>Barrios principales</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryPersonMetricRows.length === 0 ? (
                    <tr>
                      <td colSpan={11}>No hay mÃ©tricas por domiciliario para mostrar.</td>
                    </tr>
                  ) : deliveryPersonMetricRows.map(item => (
                    <tr key={item.key}>
                      <td>{item.nombre}</td>
                      <td>{item.pedidos}</td>
                      <td>{item.entregas}</td>
                      <td>${formatearCOP(item.totalDomicilios)}</td>
                      <td>${formatearCOP(item.promedio)}</td>
                      <td>{item.completados}</td>
                      <td>{item.enProceso}</td>
                      <td>{item.pendientes}</td>
                      <td>{item.cancelados}</td>
                      <td>{item.reprogramadas}</td>
                      <td>{Array.isArray(item.barrios) && item.barrios.length > 0 ? item.barrios.slice(0, 3).map(barrio => `${barrio.nombre} (${barrio.entregas})`).join(", ") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}

        <AccountingPaymentAccountsView {...contentProps} />

        <AccountingCashView {...contentProps} />
      </main>
  );
}
