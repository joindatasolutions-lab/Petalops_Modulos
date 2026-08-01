/*
 * Vista principal de pedidos de produccion.
 * Renderiza version movil, filtros, tabla, paginacion, capsulas y acciones por item.
 */
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Eye,
  RotateCw,
  Search,
  User,
} from "lucide-react";
import { formatDateOnly, normalizeStatus } from "../../../shared/utils.js";
import {
  productInitials,
  resolveImageSrc,
  resolveProductionDisplayImageUrl,
  resolveProductionProduct,
} from "../productionCatalogImages.js";
import { PAGE_SIZE_OPTIONS } from "../productionConstants.js";
import {
  deliveryTimingStatus,
  ESTADOS_UI,
  formatDateTimeBogotaFromUtc,
  hasAssignedFlorista,
  initialsFromName,
  isEmpresaCatalogCode,
  isFloristaActivo,
  isProductionReadyForDelivery,
  nextFloristaLabel,
  nextFloristaStatus,
  productionHeaderDateLabel,
  productionStateActionClass,
  productionStatusBadgeClass,
  productionStatusChipClass,
  resolveProgrammedDate,
  shouldShowFloristaStateAction,
  shouldUseCatalogCodeForProduction,
  todayIsoDate,
} from "../productionDomain.js";

function productPreviewFor(item, catalogProductIndex, empresaId) {
  return resolveProductionProduct(item, catalogProductIndex, {
    preferCatalogCode: shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId),
    allowDirectImage: true,
  });
}

function productImageFor(item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl) {
  return resolveImageSrc(
    resolveProductionDisplayImageUrl(item, catalogProductIndex, productionProductImages, empresaId),
    apiBaseUrl
  );
}

function ProductionItemActions({
  item,
  canManageProductionActions,
  canFloristaQuickState,
  canUseQuickProductionState,
  canChangeOwnProductionState,
  onOpenActionsDrawer,
  onOpenAssignmentDrawer,
  onCambiarEstadoFloristaRapido,
  compact = false,
}) {
  return (
    <div className="production-row-actions production-row-actions--florista" aria-label="Acciones de producción">
      {canUseQuickProductionState && (canChangeOwnProductionState(item) || isProductionReadyForDelivery(item.estado)) && shouldShowFloristaStateAction(item.estado) ? (
        <button
          type="button"
          className={`production-icon-action production-icon-action--state ${productionStateActionClass(item.estado)}`}
          title={nextFloristaStatus(item.estado) ? "Actualizar estado de producción" : "Pedido listo para entrega"}
          aria-label={nextFloristaLabel(item.estado) || "Pedido listo para entrega"}
          onClick={nextFloristaStatus(item.estado) ? () => onCambiarEstadoFloristaRapido(item) : undefined}
          disabled={!nextFloristaStatus(item.estado)}
        >
          <CirclePlay size={18} strokeWidth={2} aria-hidden="true" />
          {!compact ? <span className="production-action-label">{nextFloristaLabel(item.estado) || "Listo"}</span> : null}
        </button>
      ) : null}
      <button
        type="button"
        className="production-icon-action production-icon-action--detail"
        title="Ver detalle del arreglo"
        aria-label="Ver detalle del arreglo"
        onClick={() => onOpenActionsDrawer(item)}
      >
        <Eye size={18} strokeWidth={2} aria-hidden="true" />
        {!compact ? <span className="production-action-label">Ver detalle</span> : null}
      </button>
      {canManageProductionActions || canFloristaQuickState ? (
        <button
          type="button"
          className="production-icon-action production-icon-action--assign"
          title="Asignar / reasignar florista"
          aria-label="Asignar / reasignar florista"
          onClick={() => onOpenAssignmentDrawer(item)}
        >
          <User size={18} strokeWidth={2} aria-hidden="true" />
          {!compact ? <span className="production-action-label">Asignar</span> : null}
        </button>
      ) : null}
    </div>
  );
}

function ProductionMobileCard(props) {
  const { item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl } = props;
  const timing = deliveryTimingStatus(item);
  const productPreview = productPreviewFor(item, catalogProductIndex, empresaId);
  const productImageSrc = productImageFor(item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl);

  return (
    <article key={`mobile-${item.idProduccion}`} className={`production-mobile-card ${!hasAssignedFlorista(item) ? "is-unassigned" : ""}`}>
      <div className="production-mobile-card-top">
        <strong>Pedido #{item.numeroPedido || "-"}</strong>
        <span>{item.horaEntrega || "-"}</span>
      </div>
      <div className="production-mobile-card-body">
        {productImageSrc ? (
          <img src={productImageSrc} alt="" loading="lazy" />
        ) : (
          <span className="production-mobile-product-fallback">{productInitials(productPreview.name || item.producto)}</span>
        )}
        <div>
          <strong>{item.cliente || "-"}</strong>
          <span>{productPreview.name || item.producto || "-"} x {item.cantidadProducciones || 1}</span>
          <small>{item.floristaAsignado || "Sin asignar"}</small>
        </div>
      </div>
      <div className="production-mobile-card-meta">
        <span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
        <span className={`production-timing-badge ${timing.className}`}>{timing.label}</span>
      </div>
      <div className="production-mobile-card-actions">
        {props.canManageProductionActions || props.canFloristaQuickState ? (
          <button type="button" onClick={() => props.onOpenAssignmentDrawer(item)}>Asignar</button>
        ) : null}
        <button type="button" onClick={() => props.onOpenActionsDrawer(item)}>Ver detalle</button>
        {props.canUseQuickProductionState && (props.canChangeOwnProductionState(item) || isProductionReadyForDelivery(item.estado)) && shouldShowFloristaStateAction(item.estado) ? (
          <button
            type="button"
            onClick={nextFloristaStatus(item.estado) ? () => props.onCambiarEstadoFloristaRapido(item) : undefined}
            disabled={!nextFloristaStatus(item.estado)}
          >
            {nextFloristaLabel(item.estado) || "Listo"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ProductionTableRow(props) {
  const { item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl } = props;
  const timing = deliveryTimingStatus(item);
  const productPreview = productPreviewFor(item, catalogProductIndex, empresaId);
  const productImageSrc = productImageFor(item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl);
  const programmedDate = resolveProgrammedDate(item);
  const rowStateClasses = [
    "production-row-card",
    !hasAssignedFlorista(item) ? "production-row-unassigned" : "",
    timing.className === "is-late" ? "production-row-late" : "",
    timing.className === "is-on-time" ? "production-row-on-time" : "",
    programmedDate && programmedDate > todayIsoDate() ? "production-row-future" : "",
  ].filter(Boolean).join(" ");

  return (
    <tr key={item.idProduccion} className={rowStateClasses}>
      <td><span className="production-order-badge">#{item.numeroPedido || "-"}</span></td>
      <td>
        <div className="production-product-preview">
          <span className="production-product-thumb" aria-hidden="true">
            {productImageSrc ? <img src={productImageSrc} alt="" loading="lazy" /> : <span>{productInitials(productPreview.name || item.producto)}</span>}
          </span>
          <div className="production-product-customer">
            <strong>{productPreview.name || item.producto || "-"}<span className="production-product-qty"> x {item.cantidadProducciones || 1}</span></strong>
            <span>{item.cliente || "-"}</span>
          </div>
        </div>
      </td>
      <td>
        <div className="production-delivery-stack">
          <strong>{formatDateOnly(item.fechaEntrega) || "-"}</strong>
          <span>{item.horaEntrega || "-"}</span>
        </div>
      </td>
      <td>
        {item.floristaAsignado ? (
          <span className="production-florista-name">
            <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(item.floristaAsignado)}</span>
            <span>{item.floristaAsignado}</span>
          </span>
        ) : (
          <span className="production-florista-empty">
            <span className="production-florista-avatar" aria-hidden="true">SA</span>
            <span>Sin asignar</span>
          </span>
        )}
      </td>
      <td><span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span></td>
      <td><div className="production-time-stack"><span className={`production-timing-badge ${timing.className}`}>{timing.label}</span></div></td>
      <td><ProductionItemActions item={item} {...props} /></td>
    </tr>
  );
}

function ProductionCapsule(props) {
  const { item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl } = props;
  const productPreview = productPreviewFor(item, catalogProductIndex, empresaId);
  const productImageSrc = productImageFor(item, catalogProductIndex, productionProductImages, empresaId, apiBaseUrl);
  const timing = deliveryTimingStatus(item);

  return (
    <article key={`cap-${item.idProduccion}`} className={`production-capsule ${!hasAssignedFlorista(item) ? "production-capsule-unassigned" : ""}`}>
      <header className="production-capsule-head">
        <strong>{item.numeroPedido || "-"}</strong>
        <span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
      </header>

      <div className="production-capsule-grid">
        <p className="production-capsule-product-row">
          <span>Producto</span>
          <strong className="production-product-preview">
            <span className="production-product-thumb" aria-hidden="true">
              {productImageSrc ? <img src={productImageSrc} alt="" loading="lazy" /> : <span>{productInitials(productPreview.name || item.producto)}</span>}
            </span>
            <span>{productPreview.name || item.producto || "-"}</span>
          </strong>
        </p>
        <p><span>Cliente</span><strong>{item.cliente || "-"}</strong></p>
        <p><span>Fecha entrega</span><strong>{formatDateOnly(item.fechaEntrega) || "-"}</strong></p>
        <p><span>Hora entrega</span><strong>{item.horaEntrega || "-"}</strong></p>
        <p>
          <span>Florista</span>
          <strong className="production-capsule-florista">
            <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(item.floristaAsignado)}</span>
            <span>{item.floristaAsignado || "Sin asignar"}</span>
          </strong>
        </p>
        <p><span>Asignación</span><strong>{formatDateTimeBogotaFromUtc(item.fechaAsignacion) || "-"}</strong></p>
        <p><span>Estado tiempo</span><strong><span className={`production-timing-badge ${timing.className}`}>{timing.label}</span></strong></p>
      </div>

      <div className="production-capsule-actions">
        <ProductionItemActions item={item} compact {...props} />
      </div>
    </article>
  );
}

export function ProductionOrdersView({
  apiBaseUrl,
  activeMetricFilter,
  busquedaGeneral,
  canChangeOwnProductionState,
  canFloristaQuickState,
  canUseQuickProductionState,
  canManageProductionActions,
  catalogProductIndex,
  currentFloristaId,
  empresaId,
  error,
  fecha,
  focusedVisibleItems,
  loading,
  metrics,
  ownFloristaDisponibilidad,
  paginatedProductionItems,
  productionPage,
  productionPageSize,
  productionPages,
  productionPagerItems,
  productionProductImages,
  productionTotal,
  productionVisibleFrom,
  productionVisibleTo,
  selectedStatusKey,
  soloMisAsignados,
  onCambiarEstadoFloristaRapido,
  onChangeFecha,
  onChangePage,
  onChangePageSize,
  onChangeSearch,
  onChangeSoloMisAsignados,
  onFocusMetric,
  onOpenActionsDrawer,
  onOpenAssignmentDrawer,
  onRefreshAll,
  onSelectAllProductionStatuses,
  onToggleEstadoFiltro,
  onToggleEstadoFloristaPropio,
}) {
  const itemProps = {
    apiBaseUrl,
    canChangeOwnProductionState,
    canFloristaQuickState,
    canUseQuickProductionState,
    canManageProductionActions,
    catalogProductIndex,
    empresaId,
    onCambiarEstadoFloristaRapido,
    onOpenActionsDrawer,
    onOpenAssignmentDrawer,
    productionProductImages,
  };

  return (
    <>
      <section className="production-mobile-workspace" aria-label="Producción móvil">
        <div className="production-mobile-hero">
          <div className="production-mobile-title-block">
            <h1>Producción</h1>
            <span><CalendarDays size={14} strokeWidth={2} aria-hidden="true" />Hoy, {productionHeaderDateLabel()}</span>
          </div>
          <button type="button" className="production-mobile-refresh" title="Recargar vista" onClick={onRefreshAll}>
            <RotateCw size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <label className="production-mobile-search" aria-label="Buscar producción">
          <Search size={19} strokeWidth={2} aria-hidden="true" />
          <input type="search" value={busquedaGeneral} onChange={event => onChangeSearch(event.target.value)} placeholder="Buscar pedido, cliente..." title="Buscar por florista, cliente o número de pedido" />
        </label>

        <div className="production-mobile-kpis" aria-label="Indicadores de producción">
          <button type="button" className={`production-mobile-kpi${activeMetricFilter == null ? " is-active" : ""}`} onClick={() => onFocusMetric(null)}><strong>{metrics.total}</strong><span>Visibles</span></button>
          <button type="button" className={`production-mobile-kpi${activeMetricFilter === "pendientesHoy" ? " is-active" : ""}`} onClick={() => onFocusMetric("pendientesHoy")}><strong>{metrics.pendientesHoy}</strong><span>Pendientes</span></button>
          <button type="button" className={`production-mobile-kpi${activeMetricFilter === "sinAsignar" ? " is-active" : ""}`} onClick={() => onFocusMetric("sinAsignar")}><strong>{metrics.sinAsignar}</strong><span>Sin asignar</span></button>
        </div>

        <ProductionStatusTabs selectedStatusKey={selectedStatusKey} onSelectAll={onSelectAllProductionStatuses} onToggleEstado={onToggleEstadoFiltro} mobile />

        <div className="production-mobile-counts" aria-live="polite">
          <span><strong>{productionTotal}</strong> visibles</span>
          <span><strong>{metrics.pendientesHoy}</strong> pendientes</span>
          <span><strong>{metrics.sinAsignar}</strong> sin asignar</span>
        </div>

        {error ? <p className="production-mobile-message">{error}</p> : null}
        {loading ? <p className="production-mobile-message">Cargando producción...</p> : null}
        {!loading && !error && focusedVisibleItems.length === 0 ? <p className="production-mobile-message">No hay arreglos que coincidan con los filtros seleccionados.</p> : null}

        {!loading && !error && paginatedProductionItems.length > 0 ? (
          <div className="production-mobile-list" aria-label="Pedidos de producción">
            {paginatedProductionItems.map(item => <ProductionMobileCard key={`mobile-${item.idProduccion}`} item={item} {...itemProps} />)}
          </div>
        ) : null}

        <footer className="production-mobile-pager" aria-label="Paginación móvil de producción">
          <span>Mostrando {productionVisibleFrom} a {productionVisibleTo} de {productionTotal}</span>
          <div>
            <button type="button" onClick={() => onChangePage(Math.max(1, productionPage - 1))} disabled={productionPage <= 1}><ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" /></button>
            <strong>{productionPage}</strong>
            <button type="button" onClick={() => onChangePage(Math.min(productionPages, productionPage + 1))} disabled={productionPage >= productionPages}><ChevronRight size={17} strokeWidth={2.4} aria-hidden="true" /></button>
          </div>
        </footer>
      </section>

      <section className="orders-filters orders-filters--four-col production-filters-bar">
        <div className="filter-field production-filter-field">
          <span>Fecha Inicio</span>
          <div className="production-filter-control">
            <CalendarDays size={17} strokeWidth={2} aria-hidden="true" />
            <input type="date" value={fecha} onChange={event => onChangeFecha(event.target.value)} title="Filtrar por fecha programada" />
          </div>
        </div>
        <div className="filter-field production-filter-field production-status-filter">
          <span>Estado</span>
          <ProductionStatusTabs selectedStatusKey={selectedStatusKey} onSelectAll={onSelectAllProductionStatuses} onToggleEstado={onToggleEstadoFiltro} />
        </div>
        {currentFloristaId != null ? (
          <label className="filter-field">
            <span>Asignación propia</span>
            <div className="filter-checkbox">
              <input type="checkbox" checked={soloMisAsignados} onChange={event => onChangeSoloMisAsignados(event.target.checked)} />
              <span>Solo mis pedidos asignados</span>
            </div>
          </label>
        ) : null}
        {canFloristaQuickState ? (
          <div className="production-florista-inline" aria-label="Estado de florista">
            <span>Estado de florista</span>
            <button type="button" className={`production-florista-toggle ${isFloristaActivo(ownFloristaDisponibilidad) ? "is-active" : "is-inactive"}`} onClick={onToggleEstadoFloristaPropio} aria-pressed={isFloristaActivo(ownFloristaDisponibilidad)} title="Cambiar disponibilidad del florista">
              <span aria-hidden="true" />
              <strong>{isFloristaActivo(ownFloristaDisponibilidad) ? "Activo" : "Inactivo"}</strong>
            </button>
          </div>
        ) : null}
      </section>

      {error && <p className="orders-message">{error}</p>}
      {loading && <p className="orders-message">Cargando producción...</p>}
      {!loading && !error && focusedVisibleItems.length === 0 ? <p className="orders-message">No hay arreglos que coincidan con los filtros seleccionados.</p> : null}

      <section className="orders-table-wrap production-table-wrap production-table-shell">
        <table className="orders-table production-orders-table">
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Producto · Cliente</th>
              <th>Fecha + Hora entrega</th>
              <th>Florista Asignado</th>
              <th>Estado</th>
              <th>Estado tiempo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>{paginatedProductionItems.map(item => <ProductionTableRow key={item.idProduccion} item={item} {...itemProps} />)}</tbody>
        </table>
      </section>

      <footer className="records-pager production-records-pager" aria-label="Paginación de producción">
        <p>Mostrando {productionVisibleFrom} a {productionVisibleTo} de {productionTotal} pedidos</p>
        <nav className="records-pager-pages" aria-label="Páginas de producción">
          <button type="button" className="records-pager-arrow" title="Ir a la página anterior" onClick={() => onChangePage(Math.max(1, productionPage - 1))} disabled={productionPage <= 1}><ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" /></button>
          {productionPagerItems.map(item => (
            typeof item === "number" ? (
              <button key={item} type="button" className={`records-pager-page${item === productionPage ? " is-active" : ""}`} onClick={() => onChangePage(item)} aria-current={item === productionPage ? "page" : undefined}>{item}</button>
            ) : <span key={item} className="records-pager-ellipsis">...</span>
          ))}
          <button type="button" className="records-pager-arrow" title="Ir a la página siguiente" onClick={() => onChangePage(Math.min(productionPages, productionPage + 1))} disabled={productionPage >= productionPages}><ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" /></button>
        </nav>
        <label className="records-pager-size">
          <span>Mostrar</span>
          <select value={productionPageSize} onChange={event => onChangePageSize(Number(event.target.value))} title="Registros por página">
            {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <span>por página</span>
        </label>
      </footer>

      <section className="production-capsules" aria-label="Pedidos en cápsulas">
        {paginatedProductionItems.map(item => <ProductionCapsule key={`cap-${item.idProduccion}`} item={item} {...itemProps} />)}
      </section>
    </>
  );
}

function ProductionStatusTabs({ selectedStatusKey, onSelectAll, onToggleEstado, mobile = false }) {
  const wrapperClass = mobile ? "production-mobile-status-tabs" : "orders-status-chips production-status-chips";
  const buttonClass = mobile ? "production-mobile-status" : "orders-status-chip production-status-chip";
  return (
    <div className={wrapperClass} aria-label="Filtrar por estado de producción">
      <button type="button" className={`${buttonClass} is-all${selectedStatusKey === "todos" ? " is-active" : ""}`} onClick={onSelectAll}>
        {!mobile ? <span aria-hidden="true" /> : null}
        Todos
      </button>
      {ESTADOS_UI.map(item => (
        <button key={item} type="button" className={`${buttonClass} ${productionStatusChipClass(item)}${selectedStatusKey === normalizeStatus(item).replace(/_/g, "") ? " is-active" : ""}`} onClick={() => onToggleEstado(item)}>
          {!mobile ? <span aria-hidden="true" /> : null}
          {item}
        </button>
      ))}
    </div>
  );
}
