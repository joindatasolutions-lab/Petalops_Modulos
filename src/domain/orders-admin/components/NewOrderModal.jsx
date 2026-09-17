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
  quickSaleInventoryItems,
  quickSaleInventoryLoading,
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
  const quickSaleItems = Array.isArray(quickSaleInventoryItems) ? quickSaleInventoryItems : [];
  const newOrderSaving = saving;
  const newOrderError = error;
  const isQuickSale = Boolean(newOrderForm.ventaRapida);
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
  const addedQuickSaleItems = Array.isArray(newOrderForm.ventaRapidaItems) ? newOrderForm.ventaRapidaItems : [];
  const currentProductId = Number(newOrderForm.productoID || 0);
  const hasCurrentProduct = currentProductId > 0;
  const selectedQuickSaleItem = quickSaleItems.find(item => String(item.inventarioID) === String(newOrderForm.ventaRapidaInventarioID));
  const hasQuickSaleSelection = Boolean(selectedQuickSaleItem);
  const showPaymentSection = Boolean(paymentFieldConfig || salesChannelFieldConfig);
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
    const nextIsStorePickup = normalizeDeliveryType(item.nombre) === "recogida_en_tienda";
    setNewOrderForm(current => ({
      ...current,
      barrioNombre: item.nombre,
      barrioCostoDomicilio: item.costoDomicilio != null ? Number(item.costoDomicilio) : null,
      direccion: nextIsStorePickup
        ? "Recoger En Tienda"
        : (String(current.direccion || "").trim().toLowerCase() === "recoger en tienda" ? "" : current.direccion),
      domicilioObsequiado: nextIsStorePickup ? false : current.domicilioObsequiado,
    }));
  };

  const addQuickSaleItem = () => {
    if (!selectedQuickSaleItem) return;
    const quantity = Math.max(1, Number(newOrderForm.ventaRapidaCantidad || 1));
    const unitPrice = Number(sanitizeWholePesoInput(newOrderForm.ventaRapidaPrecio) || selectedQuickSaleItem.precioVenta || 0);
    if (!unitPrice) return;
    setNewOrderForm(current => {
      const currentItems = Array.isArray(current.ventaRapidaItems) ? current.ventaRapidaItems : [];
      const existingIndex = currentItems.findIndex(item => String(item.inventarioID) === String(selectedQuickSaleItem.inventarioID));
      const nextItem = {
        inventarioID: selectedQuickSaleItem.inventarioID,
        codigo: selectedQuickSaleItem.codigo || "",
        nombre: selectedQuickSaleItem.nombre,
        unidadMedida: selectedQuickSaleItem.unidadMedida || "Unidad",
        stockActual: selectedQuickSaleItem.stockActual,
        cantidad: quantity,
        precioUnitario: unitPrice,
      };
      const nextItems = existingIndex >= 0
        ? currentItems.map((item, index) => index === existingIndex ? { ...nextItem, cantidad: Number(item.cantidad || 0) + quantity } : item)
        : [...currentItems, nextItem];
      return {
        ...current,
        ventaRapidaItems: nextItems,
        ventaRapidaInventarioID: "",
        ventaRapidaCantidad: 1,
        ventaRapidaPrecio: "",
      };
    });
  };

  const removeQuickSaleItem = index => {
    setNewOrderForm(current => ({
      ...current,
      ventaRapidaItems: (Array.isArray(current.ventaRapidaItems) ? current.ventaRapidaItems : []).filter((_, currentIndex) => currentIndex !== index),
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
                <label className="order-detail-edit-check">
                  <input
                    type="checkbox"
                    checked={isQuickSale}
                    onChange={event => {
                      const checked = event.target.checked;
                      setNewOrderForm(current => ({
                        ...current,
                        ventaRapida: checked,
                        barrioNombre: checked ? "Recoger en tienda" : current.barrioNombre,
                        barrioCostoDomicilio: checked ? 0 : current.barrioCostoDomicilio,
                        direccion: checked ? "Recoger En Tienda" : current.direccion,
                        domicilioObsequiado: checked ? false : current.domicilioObsequiado,
                      }));
                    }}
                  />
                  <span>Venta rapida por unidad</span>
                </label>
              </section>

              {isQuickSale ? (
                <section className="orders-new-order-section">
                  <h3>Flores por unidad</h3>
                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Flor vendible
                      <select
                        value={newOrderForm.ventaRapidaInventarioID}
                        onChange={event => {
                          const inventarioID = event.target.value;
                          const item = quickSaleItems.find(row => String(row.inventarioID) === String(inventarioID));
                          setNewOrderForm(current => ({
                            ...current,
                            ventaRapidaInventarioID: inventarioID,
                            ventaRapidaPrecio: item?.precioVenta ? String(item.precioVenta) : current.ventaRapidaPrecio,
                          }));
                        }}
                        disabled={quickSaleInventoryLoading}
                      >
                        <option value="">{quickSaleInventoryLoading ? "Cargando flores..." : "Seleccionar flor"}</option>
                        {quickSaleItems.map(item => (
                          <option key={`quick-sale-${item.inventarioID}`} value={item.inventarioID}>
                            {item.nombre}{item.codigo ? ` (${item.codigo})` : ""} - Stock {item.stockActual}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="order-detail-edit-label">
                      Cantidad
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={newOrderForm.ventaRapidaCantidad}
                        onChange={event => updateNewOrderForm("ventaRapidaCantidad", event.target.value === "" ? "" : Math.max(1, Number(event.target.value)))}
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Precio unitario
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newOrderForm.ventaRapidaPrecio}
                        onChange={event => updateNewOrderForm("ventaRapidaPrecio", sanitizeWholePesoInput(event.target.value) ?? "")}
                        placeholder="Precio de venta"
                      />
                    </label>
                  </div>
                  <div className="orders-new-order-product-actions">
                    <button type="button" className="btn-outline" onClick={addQuickSaleItem} disabled={!hasQuickSaleSelection}>
                      Agregar flor
                    </button>
                    <span>{addedQuickSaleItems.length} item{addedQuickSaleItems.length === 1 ? "" : "s"}</span>
                  </div>
                  {addedQuickSaleItems.length > 0 ? (
                    <ul className="orders-new-order-products">
                      {addedQuickSaleItems.map((item, index) => (
                        <li key={`quick-sale-added-${item.inventarioID}-${index}`}>
                          <div>
                            <strong>{item.nombre || `Inventario ${item.inventarioID}`}</strong>
                            <span>
                              Cant. {Number(item.cantidad || 0)} - Total ${formatearCOP(Number(item.cantidad || 0) * Number(item.precioUnitario || 0))}
                            </span>
                          </div>
                          <button type="button" className="icon-btn" onClick={() => removeQuickSaleItem(index)} title="Quitar flor">
                            <IconX size={15} stroke={2} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {!isQuickSale ? (
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
              ) : null}

              <section className="orders-new-order-section">
                <h3>Cliente</h3>
                {isQuickSale ? (
                  <label className="order-detail-edit-check">
                    <input
                      type="checkbox"
                      checked={Boolean(newOrderForm.registrarClienteVentaRapida)}
                      onChange={event => updateNewOrderForm("registrarClienteVentaRapida", event.target.checked)}
                    />
                    <span>Registrar datos del cliente</span>
                  </label>
                ) : null}
                {(!isQuickSale || newOrderForm.registrarClienteVentaRapida) ? (
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Nombre cliente
                    <input
                      type="text"
                      value={newOrderForm.clienteNombre}
                      onChange={event => {
                        const nextNombre = event.target.value;
                        setNewOrderForm(current => ({
                          ...current,
                          clienteNombre: nextNombre,
                          clienteID: null,
                          clienteIdentificacion: "",
                        }));
                      }}
                    />
                  </label>
                  <label className="order-detail-edit-label">
                    Celular
                    <input
                      type="tel"
                      value={newOrderForm.clienteTelefono}
                      onChange={event => {
                        const nextTelefono = event.target.value;
                        // Si el telefono cambia, cualquier clienteID/identificacion que haya
                        // quedado de una busqueda anterior (por ej. de un pedido previo en la
                        // misma sesion) deja de ser valido para ESTE telefono nuevo. Sin este
                        // reset, ese ID viejo puede terminar sobrescribiendo a otro cliente
                        // real cuando se guarda el pedido -- ver incidente Daniela/Rodrigo
                        // Colon en Maria C Floristeria (2026-09-16).
                        setNewOrderForm(current => ({
                          ...current,
                          clienteTelefono: nextTelefono,
                          clienteID: null,
                          clienteIdentificacion: "",
                        }));
                      }}
                      onBlur={event => onLookupClientByPhone?.(event.target.value)}
                    />
                  </label>
                  <label className="order-detail-edit-label">
                    Email
                    <input type="email" value={newOrderForm.clienteEmail} onChange={event => updateNewOrderForm("clienteEmail", event.target.value)} placeholder="Opcional" />
                  </label>
                  <label className="order-detail-edit-label">
                    Numero de identificacion
                    <input
                      type="text"
                      maxLength={50}
                      value={newOrderForm.clienteIdentificacion}
                      onChange={event => updateNewOrderForm("clienteIdentificacion", event.target.value.slice(0, 50))}
                    />
                  </label>
                </div>
                ) : (
                  <p className="orders-new-order-delivery-cost">Se registrara como Cliente mostrador.</p>
                )}
              </section>

              {!isQuickSale ? (
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
                <label className="order-detail-edit-label">
                  Direccion
                  <input
                    type="text"
                    value={isStorePickup ? "Recoger En Tienda" : newOrderForm.direccion}
                    onChange={event => updateNewOrderForm("direccion", event.target.value)}
                    placeholder={isStorePickup ? "No aplica para recoger en tienda" : "Direccion o referencia"}
                    disabled={isStorePickup}
                  />
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
              ) : null}

              {showPaymentSection ? (
                <section className="orders-new-order-section">
                  <h3>Pago</h3>
                  <div className="order-detail-edit-grid">
                    {paymentFieldConfig ? (
                      <label className="order-detail-edit-label">
                        {paymentFieldConfig.titulo || "Metodo de pago"}
                        <select
                          required
                          value={newOrderForm.metodoPago}
                          onChange={event => updateNewOrderForm("metodoPago", event.target.value)}
                        >
                          <option value="">Seleccionar</option>
                          {(Array.isArray(paymentFieldOptions) ? paymentFieldOptions : []).map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    ) : null}
                    {salesChannelFieldConfig ? (
                      <label className="order-detail-edit-label">
                        {salesChannelFieldConfig.titulo || "Canal de venta"}
                        <select
                          required
                          value={newOrderForm.canalFlora}
                          onChange={event => updateNewOrderForm("canalFlora", event.target.value)}
                        >
                          <option value="">Seleccionar</option>
                          {(Array.isArray(salesChannelFieldConfig.opciones) ? salesChannelFieldConfig.opciones : []).map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {!isQuickSale ? (
              <section className="orders-new-order-section">
                <h3>Mensaje</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Firma
                    <input type="text" value={newOrderForm.firma} onChange={event => updateNewOrderForm("firma", event.target.value)} placeholder="De parte de..." />
                  </label>
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
              ) : null}

              {newOrderError ? <p className="orders-message">{newOrderError}</p> : null}
            </div>

            <footer className="orders-new-order-actions">
              <button type="button" className="btn-outline" onClick={closeNewOrderModal} disabled={newOrderSaving}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={onSaveNewOrder} disabled={newOrderSaving}>
                {newOrderSaving ? "Guardando..." : isQuickSale ? "Guardar y entregar" : "Guardar pedido"}
              </button>
            </footer>
          </section>
        </div>
  );
}
