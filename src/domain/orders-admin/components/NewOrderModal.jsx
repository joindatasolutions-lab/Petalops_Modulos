import { IconX } from "@tabler/icons-react";

import { formatearCOP } from "../../../shared/utils.js";
import { displayProductCode, sanitizeWholePesoInput } from "../ordersDomain.js";

/**
 * Modal de creacion manual de pedido.
 *
 * Componente controlado por `OrdersAdminPage`: renderiza campos, comboboxes y
 * acciones, pero no construye payloads ni llama al API.
 */

export function NewOrderModal({
  empresaId,
  form,
  productQuery,
  productsLoading,
  productDropdownOpen,
  filteredProducts,
  barrioQuery,
  barrioDropdownOpen,
  filteredBarrios,
  saving,
  error,
  paymentFieldConfig,
  paymentFieldOptions,
  salesChannelFieldConfig,
  buildProductoLabel,
  normalizeDeliveryType,
  onClose,
  onSave,
  onUpdateForm,
  onSetForm,
  onSetProductQuery,
  onSetProductDropdownOpen,
  onSearchProducts,
  onSetBarrioQuery,
  onSetBarrioDropdownOpen,
  onLoadBarrios,
  onLookupClientByPhone,
}) {
  const newOrderForm = form;
  const newOrderProductQuery = productQuery;
  const newOrderProductsLoading = productsLoading;
  const newOrderProductDropdownOpen = productDropdownOpen;
  const filteredNewOrderProducts = filteredProducts;
  const newOrderBarrioQuery = barrioQuery;
  const newOrderBarrioDropdownOpen = barrioDropdownOpen;
  const filteredNewOrderBarrios = filteredBarrios;
  const newOrderSaving = saving;
  const newOrderError = error;
  const isStorePickup = normalizeDeliveryType(newOrderForm.barrioNombre) === "recogida_en_tienda";
  const closeNewOrderModal = onClose;
  const onSaveNewOrder = onSave;
  const updateNewOrderForm = onUpdateForm;
  const setNewOrderForm = onSetForm;
  const setNewOrderProductQuery = onSetProductQuery;
  const setNewOrderProductDropdownOpen = onSetProductDropdownOpen;
  const onSearchNewOrderProducts = onSearchProducts;
  const setNewOrderBarrioQuery = onSetBarrioQuery;
  const setNewOrderBarrioDropdownOpen = onSetBarrioDropdownOpen;
  const loadBarrioOptions = onLoadBarrios;
  const addedProducts = Array.isArray(newOrderForm.productos) ? newOrderForm.productos : [];
  const currentProductId = Number(newOrderForm.productoID || 0);
  const hasCurrentProduct = currentProductId > 0;
  const selectedBarrio = (Array.isArray(filteredNewOrderBarrios) ? filteredNewOrderBarrios : [])
    .find(item => item?.nombre === newOrderForm.barrioNombre);
  const selectedDeliveryCost = Number(selectedBarrio?.costoDomicilio ?? newOrderForm.barrioCostoDomicilio ?? 0);

  const addCurrentProduct = () => {
    if (!hasCurrentProduct) return;
    setNewOrderForm(current => {
      const currentProducts = Array.isArray(current.productos) ? current.productos : [];
      const nextProduct = {
        productoID: Number(current.productoID),
        productoCodigo: current.productoCodigo,
        productoNombre: current.productoNombre,
        cantidad: Math.max(1, Number(current.cantidad || 1)),
        precio: current.precio || "",
      };
      return {
        ...current,
        productos: [...currentProducts, nextProduct],
        productoID: "",
        productoCodigo: "",
        productoNombre: "",
        cantidad: 1,
        precio: "",
      };
    });
    setNewOrderProductQuery("");
  };

  const removeProduct = index => {
    setNewOrderForm(current => ({
      ...current,
      productos: (Array.isArray(current.productos) ? current.productos : []).filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const selectProduct = item => {
    setNewOrderProductDropdownOpen(false);
    setNewOrderForm(current => ({
      ...current,
      productoID: String(item.id),
      productoCodigo: displayProductCode(item, empresaId),
      productoNombre: buildProductoLabel(item, empresaId),
      precio: item.precio != null ? String(item.precio) : current.precio,
    }));
  };

  const selectBarrio = item => {
    setNewOrderBarrioDropdownOpen(false);
    setNewOrderForm(current => ({
      ...current,
      barrioNombre: item.nombre,
      barrioCostoDomicilio: item.costoDomicilio != null ? Number(item.costoDomicilio) : null,
      direccion: normalizeDeliveryType(item.nombre) === "recogida_en_tienda" ? "Recoger En Tienda" : current.direccion,
      domicilioObsequiado: normalizeDeliveryType(item.nombre) === "recogida_en_tienda" ? false : current.domicilioObsequiado,
    }));
  };

  return (
        <div className="orders-modal-backdrop" role="presentation">
          <section className="orders-new-order-modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title">
            <header className="orders-new-order-head">
              <div>
                <span>Atencion directa</span>
                <h2 id="new-order-title">Nuevo pedido</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeNewOrderModal} title="Cerrar">
                <IconX size={18} stroke={2} />
              </button>
            </header>

            <div className="orders-new-order-body">
              <section className="orders-new-order-section">
                <h3>Producto</h3>
                <label className="order-detail-edit-label">
                  Arreglo
                  <div className="order-combobox">
                    <button
                      type="button"
                      className="order-combobox-trigger"
                      onClick={() => setNewOrderProductDropdownOpen(open => !open)}
                    >
                      <span>{newOrderForm.productoNombre || "Seleccionar arreglo"}</span>
                      <span className="order-combobox-arrow">{newOrderProductDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {newOrderProductDropdownOpen ? (
                      <div className="order-combobox-panel">
                        <div className="order-combobox-search-row">
                          <input
                            autoFocus
                            type="text"
                            value={newOrderProductQuery}
                            onChange={event => setNewOrderProductQuery(event.target.value)}
                            onKeyDown={event => { if (event.key === "Enter") onSearchNewOrderProducts(newOrderProductQuery); }}
                            placeholder="Buscar por codigo o nombre..."
                            className="order-combobox-search"
                          />
                          <button
                            type="button"
                            className="btn-outline order-detail-search-btn"
                            onClick={() => onSearchNewOrderProducts(newOrderProductQuery)}
                            disabled={newOrderProductsLoading}
                          >
                            {newOrderProductsLoading ? "..." : "Buscar"}
                          </button>
                        </div>
                        <ul className="order-combobox-list">
                          {filteredNewOrderProducts.length === 0 ? (
                            <li className="order-combobox-empty">Sin resultados</li>
                          ) : filteredNewOrderProducts.map(item => (
                            <li
                              key={`new-${item.id}`}
                              className={`order-combobox-option${String(item.id) === String(newOrderForm.productoID) ? " is-selected" : ""}`}
                              onMouseDown={event => {
                                event.preventDefault();
                                selectProduct(item);
                              }}
                              onClick={() => selectProduct(item)}
                            >
                              {buildProductoLabel(item, empresaId)}
                              {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </label>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Cantidad
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newOrderForm.cantidad}
                      onChange={event => {
                        const value = event.target.value;
                        updateNewOrderForm("cantidad", value === "" ? "" : Math.max(1, Number(value)));
                      }}
                      onBlur={() => {
                        if (!Number(newOrderForm.cantidad || 0)) {
                          updateNewOrderForm("cantidad", 1);
                        }
                      }}
                    />
                  </label>
                  <label className="order-detail-edit-label">
                    Precio manual
                    <input type="text" inputMode="numeric" value={newOrderForm.precio} onChange={event => updateNewOrderForm("precio", sanitizeWholePesoInput(event.target.value) ?? "")} placeholder="Opcional" />
                  </label>
                </div>
                <div className="orders-new-order-product-actions">
                  <button type="button" className="btn-outline" onClick={addCurrentProduct} disabled={!hasCurrentProduct}>
                    Agregar arreglo
                  </button>
                  <span>{addedProducts.length} agregado{addedProducts.length === 1 ? "" : "s"}</span>
                </div>
                {addedProducts.length > 0 ? (
                  <ul className="orders-new-order-products">
                    {addedProducts.map((item, index) => (
                      <li key={`added-product-${item.productoID}-${index}`}>
                        <div>
                          <strong>{item.productoNombre || item.productoCodigo || `Producto ${item.productoID}`}</strong>
                          <span>
                            {(() => {
                              const quantity = Math.max(1, Number(item.cantidad || 1));
                              const unitPrice = Number(item.precio || 0);
                              if (!unitPrice) return `Cant. ${quantity}`;
                              return `Cant. ${quantity} - Total $${formatearCOP(quantity * unitPrice)}`;
                            })()}
                          </span>
                        </div>
                        <button type="button" className="icon-btn" onClick={() => removeProduct(index)} title="Quitar arreglo">
                          <IconX size={15} stroke={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section className="orders-new-order-section">
                <h3>Cliente</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Nombre cliente
                    <input type="text" value={newOrderForm.clienteNombre} onChange={event => updateNewOrderForm("clienteNombre", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Celular
                    <input
                      type="tel"
                      value={newOrderForm.clienteTelefono}
                      onChange={event => updateNewOrderForm("clienteTelefono", event.target.value)}
                      onBlur={event => onLookupClientByPhone?.(event.target.value)}
                    />
                  </label>
                  <label className="order-detail-edit-label">
                    Email
                    <input type="email" value={newOrderForm.clienteEmail} onChange={event => updateNewOrderForm("clienteEmail", event.target.value)} placeholder="Opcional" />
                  </label>
                  <label className="order-detail-edit-label">
                    Numero de identificacion
                    <input type="text" value={newOrderForm.clienteIdentificacion} onChange={event => updateNewOrderForm("clienteIdentificacion", event.target.value)} />
                  </label>
                </div>
              </section>

              <section className="orders-new-order-section">
                <h3>Entrega</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Destinatario
                    <input type="text" value={newOrderForm.destinatarioNombre} onChange={event => updateNewOrderForm("destinatarioNombre", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Telefono destinatario
                    <input type="tel" value={newOrderForm.telefonoDestino} onChange={event => updateNewOrderForm("telefonoDestino", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Fecha
                    <input type="date" value={newOrderForm.fechaEntrega} onChange={event => updateNewOrderForm("fechaEntrega", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Hora
                    <input type="time" value={newOrderForm.horaEntrega} onChange={event => updateNewOrderForm("horaEntrega", event.target.value)} />
                  </label>
                </div>
                <label className="order-detail-edit-label">
                  Direccion
                  <input type="text" value={newOrderForm.direccion} onChange={event => updateNewOrderForm("direccion", event.target.value)} placeholder="Direccion o referencia" />
                </label>
                <label className="order-detail-edit-label">
                  Barrio / tipo entrega
                  <div className="order-combobox">
                    <button type="button" className="order-combobox-trigger" onClick={() => setNewOrderBarrioDropdownOpen(open => !open)}>
                      <span>{newOrderForm.barrioNombre || "Seleccionar barrio"}</span>
                      <span className="order-combobox-arrow">{newOrderBarrioDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {newOrderBarrioDropdownOpen ? (
                      <div className="order-combobox-panel">
                        <div className="order-combobox-search-row">
                          <input
                            autoFocus
                            type="text"
                            value={newOrderBarrioQuery}
                            onChange={event => setNewOrderBarrioQuery(event.target.value)}
                            onKeyDown={event => { if (event.key === "Enter") loadBarrioOptions(newOrderBarrioQuery); }}
                            placeholder="Buscar barrio..."
                            className="order-combobox-search"
                          />
                          <button type="button" className="btn-outline order-detail-search-btn" onClick={() => loadBarrioOptions(newOrderBarrioQuery)}>
                            Buscar
                          </button>
                        </div>
                        <ul className="order-combobox-list">
                          {filteredNewOrderBarrios.length === 0 ? (
                            <li className="order-combobox-empty">Sin barrios disponibles</li>
                          ) : filteredNewOrderBarrios.map(item => (
                            <li
                              key={`new-barrio-${item.nombre}`}
                              className={`order-combobox-option${item.nombre === newOrderForm.barrioNombre ? " is-selected" : ""}`}
                              onMouseDown={event => {
                                event.preventDefault();
                                selectBarrio(item);
                              }}
                              onClick={() => selectBarrio(item)}
                            >
                              {item.nombre}
                              {item.costoDomicilio != null ? <span className="order-combobox-price">${formatearCOP(item.costoDomicilio)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </label>
                {newOrderForm.barrioNombre ? (
                  <p className="orders-new-order-delivery-cost">
                    {isStorePickup
                      ? "Domicilio: $0 - Recoger en tienda"
                      : newOrderForm.domicilioObsequiado
                        ? `Domicilio: $0 - Obsequiado${selectedDeliveryCost ? ` (valor barrio $${formatearCOP(selectedDeliveryCost)})` : ""}`
                        : `Domicilio: $${formatearCOP(selectedDeliveryCost)}`}
                  </p>
                ) : null}
                <label className="order-detail-edit-check">
                  <input
                    type="checkbox"
                    checked={Boolean(newOrderForm.domicilioObsequiado) && !isStorePickup}
                    disabled={isStorePickup}
                    onChange={event => updateNewOrderForm("domicilioObsequiado", event.target.checked)}
                  />
                  <span>Domicilio obsequiado</span>
                </label>
              </section>

              <section className="orders-new-order-section">
                <h3>Mensaje</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Firma
                    <input type="text" value={newOrderForm.firma} onChange={event => updateNewOrderForm("firma", event.target.value)} placeholder="De parte de..." />
                  </label>
                  {salesChannelFieldConfig ? (
                    <label className="order-detail-edit-label">
                      {salesChannelFieldConfig.titulo || "Canal"}
                      <select value={newOrderForm.canalFlora} onChange={event => updateNewOrderForm("canalFlora", event.target.value)}>
                        <option value="">Seleccionar</option>
                        {(Array.isArray(salesChannelFieldConfig.opciones) ? salesChannelFieldConfig.opciones : []).map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                <label className="order-detail-edit-label">
                  Mensaje tarjeta
                  <textarea value={newOrderForm.mensajeTarjeta} onChange={event => updateNewOrderForm("mensajeTarjeta", event.target.value)} rows={3} />
                </label>
                <label className="order-detail-edit-label">
                  Observacion interna
                  <textarea value={newOrderForm.observacionGeneral} onChange={event => updateNewOrderForm("observacionGeneral", event.target.value)} rows={2} />
                </label>
              </section>

              {newOrderError ? <p className="orders-message">{newOrderError}</p> : null}
            </div>

            <footer className="orders-new-order-actions">
              <button type="button" className="btn-outline" onClick={closeNewOrderModal} disabled={newOrderSaving}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={onSaveNewOrder} disabled={newOrderSaving}>
                {newOrderSaving ? "Guardando..." : "Guardar pedido"}
              </button>
            </footer>
          </section>
        </div>
  );
}
