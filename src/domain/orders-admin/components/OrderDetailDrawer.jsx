import { OrderDrawerHeader } from "./OrderDrawerHeader.jsx";
import { OrderDetail } from "./OrderDetail.jsx";
import { OrderDetailErrorBoundary } from "./OrderDetailErrorBoundary.jsx";
import {
  OrderDetailAddProductForm,
  OrderDetailCustomerSection,
  OrderDetailDeliverySection,
  OrderDetailEditActions,
  OrderDetailNotesSection,
  OrderDetailPaymentSection,
  OrderDetailProductEditSection,
  OrderDetailProductSwitcher,
  OrderDetailScheduleSection,
} from "./OrderDetailEditorParts.jsx";

/**
 * Drawer de detalle del pedido.
 *
 * Responsabilidad:
 * - Componer el panel lateral y las secciones del editor.
 * - Mantener fuera de `OrdersAdminPage` el arbol JSX de detalle.
 * - Recibir grupos de props ya preparados por la pagina/hook.
 */
export function OrderDetailDrawer({
  drawerOpen,
  detalle,
  selectedPedidoId,
  empresaId,
  header = {},
  editor = {},
  addEditor = {},
  catalogs = {},
  payment = {},
  actions = {},
  detailTitles = {},
}) {
  return (
    <>
      <div
        className={`orders-drawer-backdrop${drawerOpen ? " open" : ""}`}
        aria-hidden="true"
        onClick={header.onClose}
      />

      <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
        <OrderDrawerHeader
          detalle={detalle}
          selectedPedidoId={selectedPedidoId}
          isEditing={editor.isEditing}
          isDuplicating={editor.isDuplicating}
          onToggleEdit={actions.onToggleEdit}
          onStartDuplicate={actions.onStartDuplicate}
          onRefresh={actions.onRefresh}
          onClose={header.onClose}
        />

        <div className="orders-drawer-body">
          {!drawerOpen ? null : !detalle ? (
            <p className="order-drawer-empty">Cargando detalle...</p>
          ) : detalle.error ? (
            <p className="order-drawer-empty">No fue posible cargar el detalle.</p>
          ) : (
            <OrderDetailErrorBoundary resetKey={`${selectedPedidoId || ""}-${drawerOpen ? "open" : "closed"}`}>
              {editor.isEditing ? (
                <section className="order-block order-detail-edit-box">
                  <h4>{editor.isDuplicating ? "Duplicar pedido" : "Editar pedido"}</h4>
                  <div className="order-detail-subnav">
                    <button
                      type="button"
                      className={`order-detail-subnav-tab${editor.subview === "edit" ? " is-active" : ""}`}
                      onClick={() => editor.setSubview("edit")}
                    >
                      Editar arreglo
                    </button>
                    <button
                      type="button"
                      className={`order-detail-subnav-tab${editor.subview === "add" ? " is-active" : ""}`}
                      onClick={() => editor.setSubview("add")}
                    >
                      Agregar arreglo
                    </button>
                  </div>

                  <OrderDetailProductSwitcher
                    products={editor.products}
                    selectedDetailId={editor.detalleId}
                    empresaId={empresaId}
                    deletingDetailId={editor.deletingDetailId}
                    onSelectDetail={editor.onSelectDetail}
                    onDeleteDetail={actions.onDeleteDetailProduct}
                  />

                  {editor.subview === "add" ? (
                    <OrderDetailAddProductForm
                      selectedProductLabel={addEditor.selectedProductLabel}
                      dropdownOpen={addEditor.dropdownOpen}
                      filterText={addEditor.filterText}
                      catalogLoading={catalogs.catalogLoading}
                      filteredCatalog={catalogs.filteredAddCatalog}
                      selectedProductId={addEditor.productoId}
                      empresaId={editor.empresaId}
                      quantity={addEditor.cantidad}
                      isCustomArrangement={addEditor.isCustomArrangement}
                      price={addEditor.precio}
                      displayProductCodeValue={addEditor.displayProductoCodigo}
                      saving={addEditor.saving}
                      onToggleDropdown={addEditor.onToggleDropdown}
                      onFilterTextChange={addEditor.onFilterTextChange}
                      onSearchCatalog={catalogs.onSearchCatalog}
                      onSelectProduct={addEditor.onSelectProduct}
                      onQuantityChange={addEditor.onQuantityChange}
                      onPriceChange={addEditor.onPriceChange}
                      onAddProduct={actions.onAddDetailProduct}
                    />
                  ) : null}

                  {editor.subview === "edit" ? (
                    <>
                      <OrderDetailProductEditSection {...editor.productSection} />
                      <OrderDetailScheduleSection {...editor.scheduleSection} />
                      <OrderDetailCustomerSection {...editor.customerSection} />
                      <OrderDetailDeliverySection {...editor.deliverySection} />
                      <OrderDetailNotesSection {...editor.notesSection} />
                      <OrderDetailPaymentSection {...payment} />
                      <OrderDetailEditActions
                        error={editor.error}
                        saving={editor.saving}
                        isDuplicating={editor.isDuplicating}
                        onSave={actions.onSave}
                      />
                    </>
                  ) : null}
                </section>
              ) : null}

              <OrderDetail
                detalle={detalle}
                empresaId={empresaId}
                paymentTitle={detailTitles.paymentTitle || "Metodo de pago"}
                salesChannelTitle={detailTitles.salesChannelTitle || "Celular Flora"}
                financialPreview={editor.isEditing ? payment.financialPreview : null}
              />
            </OrderDetailErrorBoundary>
          )}
        </div>
      </aside>
    </>
  );
}
