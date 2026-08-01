/*
 * Drawers laterales del modulo de produccion.
 * Renderiza detalle operativo, asignacion/reasignacion, cambio de estado y recalculo.
 */
import { IconX } from "@tabler/icons-react";
import { CalendarDays, FileText, Flower2, User } from "lucide-react";
import { formatDateOnly, normalizeStatus } from "../../../shared/utils.js";
import {
  productInitials,
  resolveImageSrc,
  resolveProductionDisplayImageUrl,
  resolveProductionProduct,
} from "../productionCatalogImages.js";
import { ESTADOS_UI } from "../productionDomain.js";
import {
  arregloCodeLabel,
  initialsFromName,
  isEmpresaCatalogCode,
  isFloristaActivo,
  productionSelectionKey,
  productionStatusBadgeClass,
  shouldUseCatalogCodeForProduction,
} from "../productionDomain.js";

function ProductionAssignmentCard({
  item,
  floristas,
  selectedFloristaById,
  onSelectedFloristaChange,
  onAsignar,
  onReasignar,
  showAsignarButton = false,
  selectPlaceholder = "Selecciona florista",
}) {
  return (
    <section className="order-block production-action-card production-assignment-card">
      <div className="production-detail-section-title">
        <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
        <strong>Asignación de florista</strong>
      </div>
      <div className="production-assignment-profile">
        <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(item.floristaAsignado)}</span>
        <div>
          <strong>{item.floristaAsignado || "Sin asignar"}</strong>
          <span>{item.floristaAsignado ? "Asignado" : "Pendiente de asignación"}</span>
        </div>
      </div>
      <div className="order-actions production-drawer-actions">
        <select
          value={selectedFloristaById[productionSelectionKey(item)] || ""}
          onChange={event => onSelectedFloristaChange(item, event.target.value)}
          title="Seleccionar florista"
        >
          <option value="">{selectPlaceholder}</option>
          {floristas.map(florista => (
            <option
              key={florista.idFlorista}
              value={florista.idFlorista}
              disabled={!isFloristaActivo(florista)}
            >
              {florista.nombre}{isFloristaActivo(florista) ? "" : " (Inactivo)"}
            </option>
          ))}
        </select>
        {showAsignarButton ? (
          <button type="button" className="btn-primary" title="Asignar florista" onClick={() => onAsignar(item)}>Asignar</button>
        ) : null}
        <button type="button" className="btn-outline" title={showAsignarButton ? "Reasignar florista" : "Asignar o reasignar florista"} onClick={() => onReasignar(item)}>
          {showAsignarButton ? "Reasignar" : "Asignar / reasignar"}
        </button>
      </div>
    </section>
  );
}

export function ProductionDetailDrawer({
  open,
  item,
  visible,
  apiBaseUrl,
  catalogProductIndex,
  productionProductImages,
  empresaId,
  floristas,
  selectedFloristaById,
  selectedEstadoById,
  canManageProductionActions,
  canManageStateAndRecalculate,
  onClose,
  onSelectedFloristaChange,
  onSelectedEstadoChange,
  onAsignar,
  onReasignar,
  onCambiarEstado,
  onRecalcularPedido,
}) {
  return (
    <aside className={`orders-drawer production-actions-drawer ${open && visible ? "open" : ""}`}>
      <div className="orders-drawer-head production-detail-head">
        <div className="production-detail-head-copy">
          <span className="production-detail-eyebrow">Ficha operativa</span>
          <strong className="orders-drawer-title production-detail-title">
            Pedido #{item?.numeroPedido || "-"}
          </strong>
          {item ? (
            <span className={`order-badge production-detail-status ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
          ) : null}
          {item ? (
            <p className="production-detail-product">{item.nombreArreglo || item.producto || "-"}</p>
          ) : null}
        </div>
        <div className="orders-drawer-head-actions">
          <button type="button" className="icon-btn" onClick={onClose} title="Cerrar barra lateral">
            <IconX size={18} stroke={2} />
          </button>
        </div>
      </div>

      <div className="orders-drawer-body">
        {!open || !item ? (
          <p className="order-drawer-empty">Selecciona un pedido para ver acciones.</p>
        ) : (
          <>
            <ProductionDrawerProductHero
              item={item}
              apiBaseUrl={apiBaseUrl}
              catalogProductIndex={catalogProductIndex}
              productionProductImages={productionProductImages}
              empresaId={empresaId}
            />

            <section className="production-detail-grid" aria-label="Detalle operativo del pedido">
              <article className="production-detail-card">
                <span className="production-detail-card-icon"><User size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <span className="production-detail-card-label">Cliente</span>
                  <strong>{item.cliente || "-"}</strong>
                </div>
              </article>

              <article className="production-detail-card">
                <span className="production-detail-card-icon"><CalendarDays size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <span className="production-detail-card-label">Entrega</span>
                  <strong>{formatDateOnly(item.fechaEntrega) || "-"}</strong>
                  <small>{item.horaEntrega || "-"}</small>
                </div>
              </article>

              <article className="production-detail-card">
                <span className="production-detail-card-icon"><Flower2 size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <span className="production-detail-card-label">Producción</span>
                  <strong>{item.estado || "-"}</strong>
                  <small>{item.floristaAsignado || "Sin asignar"}</small>
                </div>
              </article>

              <article className="production-detail-card">
                <span className="production-detail-card-icon"><FileText size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <span className="production-detail-card-label">Código arreglo</span>
                  <strong>{arregloCodeLabel(item)}</strong>
                </div>
              </article>
            </section>

            <section className="production-detail-notes-card">
              <div className="production-detail-section-title">
                <FileText size={17} strokeWidth={2} aria-hidden="true" />
                <strong>Observaciones</strong>
              </div>
              <p>{item.notasProduccion || item.observacion || "Sin notas de producción."}</p>
              <small>{item.observacionesPersonalizados || "Sin observaciones personalizadas."}</small>
            </section>

            {canManageProductionActions ? (
              <ProductionAssignmentCard
                item={item}
                floristas={floristas}
                selectedFloristaById={selectedFloristaById}
                onSelectedFloristaChange={onSelectedFloristaChange}
                onAsignar={onAsignar}
                onReasignar={onReasignar}
                showAsignarButton
                selectPlaceholder="Auto"
              />
            ) : null}

            {canManageStateAndRecalculate ? (
              <>
                <section className="order-block">
                  <h4> Estado</h4>
                  <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={selectedEstadoById[productionSelectionKey(item)] || ""}
                      onChange={event => onSelectedEstadoChange(item, event.target.value)}
                      title="Seleccionar nuevo estado"
                    >
                      <option value="">Estado...</option>
                      {ESTADOS_UI.filter(state => normalizeStatus(state) !== normalizeStatus(item.estado)).map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-outline" title="Aplicar cambio de estado" onClick={() => onCambiarEstado(item)}>Cambiar estado</button>
                  </div>
                </section>

                <section className="order-block">
                  <h4>Recalcular pedido</h4>
                  <button type="button" className="btn-outline" title="Recalcular impacto del pedido" onClick={() => onRecalcularPedido(item)}>
                    Recalcular producción
                  </button>
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

export function ProductionAssignmentDrawer({
  open,
  item,
  visible,
  floristas,
  selectedFloristaById,
  onClose,
  onSelectedFloristaChange,
  onReasignar,
}) {
  return (
    <aside className={`orders-drawer production-actions-drawer production-assignment-drawer ${open && visible ? "open" : ""}`}>
      <div className="orders-drawer-head production-detail-head">
        <div className="production-detail-head-copy">
          <span className="production-detail-eyebrow">Acción independiente</span>
          <strong className="orders-drawer-title production-detail-title">Asignar / reasignar florista</strong>
          {item ? (
            <p className="production-detail-product">
              Pedido #{item.numeroPedido || "-"} · {item.nombreArreglo || item.producto || "-"}
            </p>
          ) : null}
        </div>
        <div className="orders-drawer-head-actions">
          <button type="button" className="icon-btn" onClick={onClose} title="Cerrar asignación">
            <IconX size={18} stroke={2} />
          </button>
        </div>
      </div>

      <div className="orders-drawer-body">
        {!open || !item ? (
          <p className="order-drawer-empty">Selecciona un pedido para asignar florista.</p>
        ) : (
          <ProductionAssignmentCard
            item={item}
            floristas={floristas}
            selectedFloristaById={selectedFloristaById}
            onSelectedFloristaChange={onSelectedFloristaChange}
            onReasignar={onReasignar}
          />
        )}
      </div>
    </aside>
  );
}

function ProductionDrawerProductHero({
  item,
  apiBaseUrl,
  catalogProductIndex,
  productionProductImages,
  empresaId,
}) {
  const productPreview = resolveProductionProduct(item, catalogProductIndex, {
    preferCatalogCode: shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId),
    allowDirectImage: true,
  });
  const productImageSrc = resolveImageSrc(
    resolveProductionDisplayImageUrl(item, catalogProductIndex, productionProductImages, empresaId),
    apiBaseUrl
  );

  return (
    <section className="production-detail-product-hero" aria-label="Imagen del arreglo">
      <div className="production-detail-product-photo">
        {productImageSrc ? (
          <img src={productImageSrc} alt="" loading="lazy" />
        ) : (
          <span>{productInitials(productPreview.name || item.producto)}</span>
        )}
      </div>
      <div className="production-detail-product-hero-copy">
        <span>Arreglo</span>
        <strong>{productPreview.name || item.nombreArreglo || item.producto || "-"}</strong>
        <small>{arregloCodeLabel(item)}</small>
      </div>
    </section>
  );
}
