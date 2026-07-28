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
                              onClick={() => {
                                setNewOrderForm(current => ({
                                  ...current,
                                  productoID: String(item.id),
                                  productoCodigo: displayProductCode(item, empresaId),
                                  productoNombre: buildProductoLabel(item, empresaId),
                                  precio: item.precio != null ? String(item.precio) : current.precio,
                                }));
                                setNewOrderProductDropdownOpen(false);
                              }}
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
                    <input type="number" min="1" step="1" value={newOrderForm.cantidad} onChange={event => updateNewOrderForm("cantidad", Math.max(1, Number(event.target.value || 1)))} />
                  </label>
                  <label className="order-detail-edit-label">
                    Precio manual
                    <input type="text" inputMode="numeric" value={newOrderForm.precio} onChange={event => updateNewOrderForm("precio", sanitizeWholePesoInput(event.target.value) ?? "")} placeholder="Opcional" />
                  </label>
                </div>
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
                    Documento
                    <input type="text" value={newOrderForm.clienteIdentificacion} onChange={event => updateNewOrderForm("clienteIdentificacion", event.target.value)} placeholder="Opcional" />
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
                    <input type="tel" value={newOrderForm.telefonoDestino} onChange={event => updateNewOrderForm("telefonoDestino", event.target.value)} placeholder="Si es diferente" />
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
                              onClick={() => {
                                updateNewOrderForm("barrioNombre", item.nombre);
                                if (normalizeDeliveryType(item.nombre) === "recogida_en_tienda") {
                                  updateNewOrderForm("direccion", "Recoger En Tienda");
                                  updateNewOrderForm("domicilioObsequiado", false);
                                }
                                setNewOrderBarrioDropdownOpen(false);
                              }}
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
                <h3>Mensaje y pago</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Firma
                    <input type="text" value={newOrderForm.firma} onChange={event => updateNewOrderForm("firma", event.target.value)} placeholder="De parte de..." />
                  </label>
                  {paymentFieldConfig ? (
                    <label className="order-detail-edit-label">
                      {paymentFieldConfig.titulo || "Metodo de pago"}
                      <select value={newOrderForm.metodoPago} onChange={event => updateNewOrderForm("metodoPago", event.target.value)}>
                        <option value="">Seleccionar</option>
                        {paymentFieldOptions.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : null}
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
