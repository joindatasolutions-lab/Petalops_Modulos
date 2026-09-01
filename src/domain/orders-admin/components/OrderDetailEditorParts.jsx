import { IconX } from "@tabler/icons-react";

import { formatearCOP } from "../../../shared/utils.js";
import { buildProductoLabel } from "../orderCatalogAdapters.js";
import { normalizeDeliveryType } from "../orderDeliveryType.js";
import {
  displayProductCode,
  isCashPaymentMethod,
  sanitizeWholePesoInput,
} from "../ordersDomain.js";

/**
 * Piezas reutilizables del editor de detalle.
 *
 * Estos componentes son presentacionales y reciben setters/callbacks desde
 * `OrdersAdminPage`. El siguiente paso natural es envolverlos en un hook de
 * edicion para reducir la cantidad de props.
 */

function FinancialPreviewSummary({ financialPreview, className = "" }) {
  if (!financialPreview) return null;

  return (
    <div className={`order-detail-edit-adjustment-summary${className ? ` ${className}` : ""}`}>
      <span><span>Subtotal</span><strong>${formatearCOP(financialPreview.subtotal)}</strong></span>
      <span><span>IVA</span><strong>${formatearCOP(financialPreview.iva)}</strong></span>
      <span>
        <span>Domicilio</span>
        <strong>${formatearCOP(financialPreview.domicilio)}</strong>
      </span>
      {financialPreview.domicilioObsequiado && financialPreview.domicilioOriginal > 0 ? (
        <span><span>Domicilio obsequiado</span><strong>-${formatearCOP(financialPreview.domicilioOriginal)}</strong></span>
      ) : null}
      <span><span>Base</span><strong>${formatearCOP(financialPreview.baseTotal)}</strong></span>
      {financialPreview.recargoMonto > 0 ? (
        <span><span>Recargo link ({financialPreview.recargoPct}%)</span><strong>+${formatearCOP(financialPreview.recargoMonto)}</strong></span>
      ) : null}
      {financialPreview.descuentoMonto > 0 ? (
        <span><span>Descuento</span><strong>-${formatearCOP(financialPreview.descuentoMonto)}</strong></span>
      ) : null}
      {financialPreview.saldoFavorMonto > 0 ? (
        <span><span>Saldo a favor</span><strong>${formatearCOP(financialPreview.saldoFavorMonto)}</strong></span>
      ) : null}
      <span className="is-total"><span>Total ajustado</span><strong>${formatearCOP(financialPreview.total)}</strong></span>
    </div>
  );
}

export function OrderDetailProductSwitcher({
  products,
  selectedDetailId,
  empresaId,
  deletingDetailId,
  onSelectDetail,
  onDeleteDetail,
}) {
  if (!Array.isArray(products) || products.length <= 1) return null;

  return (
    <div className="order-detail-product-switcher">
      <span className="order-detail-product-switcher-title">Arreglos del pedido</span>
      <div className="order-detail-product-switcher-list">
        {products.map((producto, index) => {
          const detalleId = producto?.detalleID != null ? String(producto.detalleID) : `${index}`;
          const isActive = String(selectedDetailId || "") === detalleId;
          return (
            <div
              key={detalleId}
              className={`order-detail-product-chip${isActive ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="order-detail-product-chip-main"
                onClick={() => onSelectDetail(detalleId)}
              >
                {displayProductCode(producto, empresaId) || `Arreglo ${index + 1}`}
              </button>
              <button
                type="button"
                className="order-detail-product-chip-remove"
                title="Eliminar arreglo"
                onClick={() => onDeleteDetail(detalleId)}
                disabled={deletingDetailId === Number(detalleId)}
              >
                <IconX size={12} stroke={2.2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OrderDetailProductEditSection({
  currentName,
  displayCode,
  quantity,
  showPriceField,
  price,
  isCustomArrangement,
  selectedProductLabel,
  dropdownOpen,
  filterText,
  catalogLoading,
  filteredCatalog,
  selectedProductId,
  empresaId,
  onQuantityChange,
  onPriceChange,
  onToggleDropdown,
  onFilterTextChange,
  onSearchCatalog,
  onSelectProduct,
}) {
  return (
    <>
      <div className="order-detail-edit-label">
        <span>Arreglo actual</span>
        <input
          type="text"
          value={currentName || "(sin arreglo)"}
          readOnly
          className="order-detail-edit-readonly"
        />
      </div>

      <div className="order-detail-edit-grid">
        <label className="order-detail-edit-label">
          Codigo de arreglo
          <input
            type="text"
            value={displayCode}
            readOnly
            className="order-detail-edit-readonly"
          />
        </label>
        <label className="order-detail-edit-label">
          Cantidad
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={event => onQuantityChange(Math.max(1, Number(event.target.value || 1)))}
          />
        </label>
      </div>

      {showPriceField ? (
        <div className="order-detail-edit-label">
          <span>Precio arreglo</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={price ?? ""}
            onChange={event => onPriceChange(sanitizeWholePesoInput(event.target.value))}
            readOnly={!isCustomArrangement}
            className={isCustomArrangement ? "" : "order-detail-edit-readonly"}
          />
          <span className="order-detail-edit-hint">
            {isCustomArrangement
              ? "Puedes ajustar el precio porque el arreglo es personalizado."
              : "El precio solo se puede cambiar cuando el arreglo es personalizado."}
          </span>
        </div>
      ) : null}

      <div className="order-detail-edit-label">
        Cambiar arreglo
        <div className="order-combobox">
          <button
            type="button"
            className="order-combobox-trigger"
            onClick={onToggleDropdown}
          >
            <span>{selectedProductLabel}</span>
            <span className="order-combobox-arrow">{dropdownOpen ? "^" : "v"}</span>
          </button>

          {dropdownOpen ? (
            <div className="order-combobox-panel">
              <div className="order-combobox-search-row">
                <input
                  autoFocus
                  type="text"
                  value={filterText}
                  onChange={event => onFilterTextChange(event.target.value)}
                  onKeyDown={event => { if (event.key === "Enter") onSearchCatalog(); }}
                  placeholder="Buscar por codigo o nombre..."
                  className="order-combobox-search"
                />
                <button
                  type="button"
                  className="btn-outline order-detail-search-btn"
                  onClick={onSearchCatalog}
                  disabled={catalogLoading}
                >
                  {catalogLoading ? "..." : "Buscar"}
                </button>
              </div>
              <ul className="order-combobox-list">
                {filteredCatalog.length === 0 ? (
                  <li className="order-combobox-empty">Sin resultados</li>
                ) : filteredCatalog.map(item => (
                  <li
                    key={item.id}
                    className={`order-combobox-option${String(item.id) === selectedProductId ? " is-selected" : ""}`}
                    onClick={() => onSelectProduct(item)}
                  >
                    {buildProductoLabel(item, empresaId)}
                    {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function OrderDetailScheduleSection({
  fechaEntrega,
  horaEntrega,
  onFechaEntregaChange,
  onHoraEntregaChange,
}) {
  return (
    <div className="order-detail-edit-grid">
      <label className="order-detail-edit-label">
        Fecha entrega
        <input
          type="date"
          value={fechaEntrega}
          onChange={event => onFechaEntregaChange(event.target.value)}
        />
      </label>
      <label className="order-detail-edit-label">
        Hora entrega
        <input
          type="time"
          value={horaEntrega}
          onChange={event => onHoraEntregaChange(event.target.value)}
        />
      </label>
    </div>
  );
}

export function OrderDetailCustomerSection({
  nombre,
  telefono,
  email,
  tipoIdentificacion,
  identificacion,
  canEditClientIdentity,
  onNombreChange,
  onTelefonoChange,
  onEmailChange,
  onTipoIdentificacionChange,
  onIdentificacionChange,
}) {
  return (
    <>
      <div className="order-detail-edit-section">
        <span className="order-detail-edit-section-title">Datos cliente</span>
        <div className="order-detail-edit-grid">
          <label className="order-detail-edit-label">
            Nombre
            <input
              type="text"
              value={nombre}
              onChange={event => onNombreChange(event.target.value)}
              placeholder="Nombre del cliente"
              disabled={!canEditClientIdentity}
            />
          </label>
          <label className="order-detail-edit-label">
            Telefono
            <input
              type="text"
              value={telefono}
              onChange={event => onTelefonoChange(event.target.value)}
              placeholder="Telefono del cliente"
              disabled={!canEditClientIdentity}
            />
          </label>
          <label className="order-detail-edit-label">
            Email
            <input
              type="email"
              value={email}
              onChange={event => onEmailChange(event.target.value)}
              placeholder="Correo del cliente"
            />
          </label>
          <label className="order-detail-edit-label">
            Tipo documento
            <select
              value={tipoIdentificacion}
              onChange={event => onTipoIdentificacionChange(event.target.value)}
            >
              <option value="">Selecciona una opcion</option>
              <option value="CC">Cedula</option>
              <option value="NIT">NIT</option>
            </select>
          </label>
          <label className="order-detail-edit-label">
            N documento
            <input
              type="text"
              value={identificacion}
              onChange={event => onIdentificacionChange(event.target.value)}
              placeholder="Numero de documento"
            />
          </label>
        </div>
      </div>

      <p className="order-detail-edit-hint">
        Si corriges el documento a NIT, el pedido recalcula IVA con la configuracion fiscal disponible.
      </p>
      {!canEditClientIdentity ? (
        <p className="order-detail-edit-hint">
          Solo un usuario administrador puede cambiar nombre o telefono del cliente.
        </p>
      ) : null}
    </>
  );
}

export function OrderDetailDeliverySection({
  destinatarioNombre,
  telefonoDestino,
  direccion,
  barrioNombre,
  barrioQuery,
  barrioDropdownOpen,
  barriosLoading,
  filteredBarrioOptions,
  domicilioObsequiado,
  financialPreview,
  onDestinatarioNombreChange,
  onTelefonoDestinoChange,
  onDireccionChange,
  onBarrioNombreChange,
  onBarrioQueryChange,
  onBarrioDropdownOpenChange,
  onDomicilioObsequiadoChange,
  onLoadBarrioOptions,
}) {
  const isStorePickup = normalizeDeliveryType(barrioNombre) === "recogida_en_tienda";

  return (
    <>
      <div className="order-detail-edit-grid">
        <label className="order-detail-edit-label">
          Nombre destinatario
          <input
            type="text"
            value={destinatarioNombre}
            onChange={event => onDestinatarioNombreChange(event.target.value)}
            placeholder="Nombre de quien recibe"
          />
        </label>
        <label className="order-detail-edit-label">
          Telefono destinatario
          <input
            type="text"
            value={telefonoDestino}
            onChange={event => onTelefonoDestinoChange(event.target.value)}
            placeholder="Telefono de contacto"
          />
        </label>
      </div>

      <div className="order-detail-edit-grid">
        <label className="order-detail-edit-label">
          Direccion
          <input
            type="text"
            value={direccion}
            onChange={event => onDireccionChange(event.target.value)}
            placeholder="Direccion de entrega"
          />
        </label>
        <label className="order-detail-edit-label">
          Barrio
          <div className="order-combobox">
            <button
              type="button"
              className="order-combobox-trigger"
              onClick={() => {
                const nextOpen = !barrioDropdownOpen;
                onBarrioDropdownOpenChange(nextOpen);
                if (nextOpen) {
                  void onLoadBarrioOptions(barrioQuery);
                }
              }}
            >
              <span>{barrioNombre || "-- Selecciona un barrio --"}</span>
              <span className="order-combobox-arrow">{barrioDropdownOpen ? "^" : "v"}</span>
            </button>

            {barrioDropdownOpen ? (
              <div className="order-combobox-panel">
                <div className="order-combobox-search-row">
                  <input
                    autoFocus
                    type="text"
                    value={barrioQuery}
                    onChange={event => onBarrioQueryChange(event.target.value)}
                    placeholder="Busca un barrio..."
                    className="order-combobox-search"
                  />
                  <button
                    type="button"
                    className="btn-outline order-detail-search-btn"
                    onClick={() => onBarrioDropdownOpenChange(false)}
                  >
                    Cerrar
                  </button>
                </div>
                <ul className="order-combobox-list">
                  {filteredBarrioOptions.length === 0 ? (
                    <li className="order-combobox-empty">
                      {barriosLoading ? "Buscando..." : "Sin barrios disponibles"}
                    </li>
                  ) : filteredBarrioOptions.map(item => (
                    <li
                      key={`${item.id || "manual"}-${item.nombre}`}
                      className={`order-combobox-option${item.nombre === barrioNombre ? " is-selected" : ""}`}
                      onClick={() => {
                        onBarrioNombreChange(item.nombre);
                        if (normalizeDeliveryType(item.nombre) === "recogida_en_tienda") {
                          onDomicilioObsequiadoChange(false);
                        }
                        onBarrioDropdownOpenChange(false);
                        onBarrioQueryChange("");
                      }}
                    >
                      {item.nombre}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </label>
      </div>

      <label className="order-detail-edit-check">
        <input
          type="checkbox"
          checked={domicilioObsequiado && !isStorePickup}
          disabled={isStorePickup}
          onChange={event => onDomicilioObsequiadoChange(event.target.checked)}
        />
        <span>Domicilio obsequiado</span>
      </label>

    </>
  );
}

export function OrderDetailNotesSection({
  productoObservaciones,
  firma,
  mensajeTarjeta,
  observacionGeneral,
  onProductoObservacionesChange,
  onFirmaChange,
  onMensajeTarjetaChange,
  onObservacionGeneralChange,
}) {
  return (
    <>
      <label className="order-detail-edit-label">
        Notas Produccion
        <textarea
          rows={4}
          value={productoObservaciones}
          onChange={event => onProductoObservacionesChange(event.target.value)}
          placeholder="Notas del arreglo para produccion"
        />
      </label>

      <label className="order-detail-edit-label">
        Firma tarjeta
        <input
          type="text"
          value={firma}
          onChange={event => onFirmaChange(event.target.value)}
          placeholder="Ej: Con carino, Flora"
        />
      </label>

      <label className="order-detail-edit-label">
        Mensaje tarjeta
        <textarea
          rows={3}
          value={mensajeTarjeta}
          onChange={event => onMensajeTarjetaChange(event.target.value)}
          placeholder="Mensaje para la tarjeta floral"
        />
      </label>

      <label className="order-detail-edit-label">
        Observaciones personalizados
        <textarea
          rows={3}
          value={observacionGeneral}
          onChange={event => onObservacionGeneralChange(event.target.value)}
          placeholder="Observaciones personalizados para entrega"
        />
      </label>
    </>
  );
}

export function OrderDetailPaymentSection({
  paymentFieldConfig,
  salesChannelFieldConfig,
  paymentFieldOptions,
  selectedPaymentMethods,
  paymentAmounts,
  metodosPago,
  requiresPaymentBreakdown,
  hasLinkPayment,
  omitirRecargoLink,
  descuentoMonto,
  descuentoNota,
  saldoFavorMonto,
  saldoFavorNota,
  financialPreview,
  totalPedido,
  canalFlora,
  onMetodosPagoChange,
  onPaymentAmountsChange,
  onOmitirRecargoLinkChange,
  onDescuentoMontoChange,
  onDescuentoNotaChange,
  onSaldoFavorMontoChange,
  onSaldoFavorNotaChange,
  onCanalFloraChange,
}) {
  if (!paymentFieldConfig && !salesChannelFieldConfig) return null;

  return (
    <>
      {paymentFieldConfig ? (
        <div className="order-detail-edit-label">
          <span>{paymentFieldConfig.titulo || "Metodos de pago"}</span>
          <div className="order-detail-edit-checklist">
            {paymentFieldOptions.map(option => (
              <label key={option} className="order-detail-edit-checkitem">
                <input
                  type="checkbox"
                  checked={metodosPago.includes(option)}
                  onChange={() => {
                    const isSelected = metodosPago.includes(option);
                    onMetodosPagoChange(current => isSelected
                      ? current.filter(item => item !== option)
                      : [...current, option]);
                    onPaymentAmountsChange(current => {
                      if (isSelected) {
                        const next = { ...current };
                        delete next[option];
                        return next;
                      }
                      return current;
                    });
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          {requiresPaymentBreakdown ? (
            <div className="order-detail-edit-payment-grid">
              {selectedPaymentMethods.map(method => (
                <label key={method} className="order-detail-edit-label">
                  {isCashPaymentMethod(method) ? "Monto recibido en efectivo" : `Monto para ${method}`}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmounts[method] ?? ""}
                    onChange={event => {
                      const nextValue = event.target.value;
                      onPaymentAmountsChange(current => ({
                        ...current,
                        [method]: nextValue,
                      }));
                    }}
                    placeholder="0.00"
                    required
                  />
                </label>
              ))}
              <p className="order-detail-edit-hint">
                La suma de los montos debe coincidir con el total del pedido: ${formatearCOP(totalPedido)}.
              </p>
            </div>
          ) : null}

          {hasLinkPayment ? (
            <label className="order-detail-edit-inline-check">
              <input
                type="checkbox"
                checked={omitirRecargoLink}
                onChange={event => onOmitirRecargoLinkChange(event.target.checked)}
              />
              <span>Quitar recargo del 5% por link</span>
            </label>
          ) : null}

          <div className="order-detail-edit-payment-grid compact">
            <label className="order-detail-edit-label order-detail-edit-money-field">
              Descuento
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={descuentoMonto}
                onChange={event => onDescuentoMontoChange(sanitizeWholePesoInput(event.target.value) ?? "")}
                placeholder="0"
              />
            </label>
            <label className="order-detail-edit-label order-detail-edit-note-field">
              Nota descuento
              <textarea
                rows={2}
                value={descuentoNota}
                onChange={event => onDescuentoNotaChange(event.target.value)}
                placeholder="Razon del descuento"
              />
            </label>
            <label className="order-detail-edit-label order-detail-edit-money-field">
              Saldo a favor
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={saldoFavorMonto}
                onChange={event => onSaldoFavorMontoChange(sanitizeWholePesoInput(event.target.value) ?? "")}
                placeholder="0"
              />
            </label>
            <label className="order-detail-edit-label order-detail-edit-note-field">
              Nota saldo a favor
              <textarea
                rows={2}
                value={saldoFavorNota}
                onChange={event => onSaldoFavorNotaChange(event.target.value)}
                placeholder="Razon del saldo a favor"
              />
            </label>
            <FinancialPreviewSummary financialPreview={financialPreview} className="order-detail-edit-financial-preview" />
          </div>
        </div>
      ) : null}

      {salesChannelFieldConfig ? (
        <label className="order-detail-edit-label">
          {salesChannelFieldConfig.titulo || "Canal"}
          <select value={canalFlora} onChange={event => onCanalFloraChange(event.target.value)}>
            <option value="">Selecciona una opcion</option>
            {(Array.isArray(salesChannelFieldConfig.opciones) ? salesChannelFieldConfig.opciones : []).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

export function OrderDetailEditActions({
  error,
  saving,
  isDuplicating,
  onSave,
}) {
  return (
    <>
      {error ? <p className="orders-message">{error}</p> : null}

      <div className="order-detail-edit-actions">
        <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? (isDuplicating ? "Creando..." : "Guardando...") : (isDuplicating ? "Crear duplicado" : "Guardar cambios")}
        </button>
      </div>
    </>
  );
}

export function OrderDetailAddProductForm({
  selectedProductLabel,
  dropdownOpen,
  filterText,
  catalogLoading,
  filteredCatalog,
  selectedProductId,
  empresaId,
  quantity,
  isCustomArrangement,
  price,
  displayProductCodeValue,
  saving,
  onToggleDropdown,
  onFilterTextChange,
  onSearchCatalog,
  onSelectProduct,
  onQuantityChange,
  onPriceChange,
  onAddProduct,
}) {
  return (
    <div className="order-detail-add-box">
      <div className="order-detail-add-box-head">
        <span className="order-detail-product-switcher-title">Agregar arreglo</span>
        <span className="order-detail-edit-hint">Cuando lo agregues, se suma al pedido y se actualiza el total.</span>
      </div>
      <div className="order-detail-edit-label">
        Buscar arreglo para agregar
        <div className="order-combobox">
          <button
            type="button"
            className="order-combobox-trigger"
            onClick={onToggleDropdown}
          >
            <span>{selectedProductLabel}</span>
            <span className="order-combobox-arrow">{dropdownOpen ? "^" : "v"}</span>
          </button>

          {dropdownOpen ? (
            <div className="order-combobox-panel">
              <div className="order-combobox-search-row">
                <input
                  autoFocus
                  type="text"
                  value={filterText}
                  onChange={event => onFilterTextChange(event.target.value)}
                  onKeyDown={event => { if (event.key === "Enter") onSearchCatalog(filterText); }}
                  placeholder="Buscar por codigo o nombre..."
                  className="order-combobox-search"
                />
                <button
                  type="button"
                  className="btn-outline order-detail-search-btn"
                  onClick={() => onSearchCatalog(filterText)}
                  disabled={catalogLoading}
                >
                  {catalogLoading ? "..." : "Buscar"}
                </button>
              </div>
              <ul className="order-combobox-list">
                {filteredCatalog.length === 0 ? (
                  <li className="order-combobox-empty">Sin resultados</li>
                ) : filteredCatalog.map(item => (
                  <li
                    key={`add-${item.id}`}
                    className={`order-combobox-option${String(item.id) === selectedProductId ? " is-selected" : ""}`}
                    onClick={() => onSelectProduct(item)}
                  >
                    {buildProductoLabel(item, empresaId)}
                    {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="order-detail-edit-grid">
        <label className="order-detail-edit-label">
          Cantidad a agregar
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={event => onQuantityChange(Math.max(1, Number(event.target.value || 1)))}
          />
        </label>
        {isCustomArrangement ? (
          <label className="order-detail-edit-label">
            Precio personalizado
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={price ?? ""}
              onChange={event => onPriceChange(sanitizeWholePesoInput(event.target.value))}
            />
          </label>
        ) : (
          <label className="order-detail-edit-label">
            Codigo
            <input
              type="text"
              value={displayProductCodeValue}
              readOnly
              className="order-detail-edit-readonly"
            />
          </label>
        )}
      </div>

      <div className="order-detail-add-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onAddProduct}
          disabled={saving}
        >
          {saving ? "Agregando..." : "Agregar arreglo"}
        </button>
      </div>
    </div>
  );
}
