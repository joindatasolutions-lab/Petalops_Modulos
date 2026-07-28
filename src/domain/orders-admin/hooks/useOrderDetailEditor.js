import { useMemo } from "react";

import {
  displayProductCode,
  isCustomArrangement,
  normalizeWholePeso,
} from "../ordersDomain.js";

/**
 * View model del editor de detalle.
 *
 * Agrupa el estado plano de `OrdersAdminPage` en objetos orientados a secciones
 * del drawer. Asi los componentes reciben contratos por responsabilidad y la
 * pagina deja de construir props de UI en medio del render.
 */
export function useOrderDetailEditor({
  detalle,
  empresaId,
  detailEmpresaId,
  canEditClientIdentity,
  detailProducts,
  filteredDetailCatalog,
  filteredAddDetailCatalog,
  filteredBarrioOptions,
  totalPedido,
  paymentFieldConfig,
  salesChannelFieldConfig,
  paymentFieldOptions,
  onSearchCatalog,
  loadBarrioOptions,
  onToggleDetailEdit,
  onStartDuplicateDetail,
  reloadDrawer,
  onDeleteDetailProduct,
  onAddDetailProduct,
  onSaveDetailEdit,
  state,
  setters,
}) {
  return useMemo(() => {
    const detailEditorProps = {
      isEditing: state.isEditingDetail,
      isDuplicating: state.isDuplicatingDetail,
      subview: state.detailEditSubview,
      setSubview: setters.setDetailEditSubview,
      products: detailProducts,
      detalleId: state.detailEditDetalleID,
      empresaId: detailEmpresaId,
      deletingDetailId: state.detailEditDeletingDetailId,
      onSelectDetail: setters.setDetailEditDetalleID,
      error: state.detailEditError,
      saving: state.detailEditSaving,
      productSection: {
        currentName: state.detailEditNombreArreglo,
        displayCode: state.detailEditDisplayProductoCodigo,
        quantity: state.detailEditCantidad,
        showPriceField: state.detailEditShowPriceField,
        price: state.detailEditPrecio,
        isCustomArrangement: state.detailEditIsCustomArrangement,
        selectedProductLabel: state.detailEditSelectedProductLabel,
        dropdownOpen: state.detailEditDropdownOpen,
        filterText: state.detailEditFilterText,
        catalogLoading: state.detailEditCatalogLoading,
        filteredCatalog: filteredDetailCatalog,
        selectedProductId: state.detailEditProductoID,
        empresaId: detailEmpresaId,
        onQuantityChange: setters.setDetailEditCantidad,
        onPriceChange: setters.setDetailEditPrecio,
        onToggleDropdown: () => setters.setDetailEditDropdownOpen(open => !open),
        onFilterTextChange: setters.setDetailEditFilterText,
        onSearchCatalog,
        onSelectProduct: item => {
          setters.setDetailEditProductoID(String(item.id));
          setters.setDetailEditProductoCodigo(displayProductCode(item, detailEmpresaId));
          setters.setDetailEditNombreArreglo(String(item.nombre || ""));
          setters.setDetailEditCantidad(Number(detalle?.productos?.[0]?.cantidad || 1));
          setters.setDetailEditProductoObservaciones("");
          setters.setDetailEditPrecio(item.precio != null ? normalizeWholePeso(item.precio) : null);
          setters.setDetailEditCustomPriceEnabled(isCustomArrangement({
            codigo: item.codigo,
            nombre: item.nombre,
            observaciones: item.descripcion,
          }));
          setters.setDetailEditDropdownOpen(false);
          setters.setDetailEditFilterText("");
        },
      },
      scheduleSection: {
        fechaEntrega: state.detailEditFechaEntrega,
        horaEntrega: state.detailEditHoraEntrega,
        onFechaEntregaChange: setters.setDetailEditFechaEntrega,
        onHoraEntregaChange: setters.setDetailEditHoraEntrega,
      },
      customerSection: {
        nombre: state.detailEditClienteNombre,
        telefono: state.detailEditClienteTelefono,
        email: state.detailEditClienteEmail,
        tipoIdentificacion: state.detailEditClienteTipoIdent,
        identificacion: state.detailEditClienteIdentificacion,
        canEditClientIdentity,
        onNombreChange: setters.setDetailEditClienteNombre,
        onTelefonoChange: setters.setDetailEditClienteTelefono,
        onEmailChange: setters.setDetailEditClienteEmail,
        onTipoIdentificacionChange: setters.setDetailEditClienteTipoIdent,
        onIdentificacionChange: setters.setDetailEditClienteIdentificacion,
      },
      deliverySection: {
        destinatarioNombre: state.detailEditDestinatarioNombre,
        telefonoDestino: state.detailEditTelefonoDestino,
        direccion: state.detailEditDireccion,
        barrioNombre: state.detailEditBarrioNombre,
        barrioQuery: state.detailEditBarrioQuery,
        barrioDropdownOpen: state.detailEditBarrioDropdownOpen,
        barriosLoading: state.detailEditBarriosLoading,
        filteredBarrioOptions,
        domicilioObsequiado: state.detailEditDomicilioObsequiado,
        onDestinatarioNombreChange: setters.setDetailEditDestinatarioNombre,
        onTelefonoDestinoChange: setters.setDetailEditTelefonoDestino,
        onDireccionChange: setters.setDetailEditDireccion,
        onBarrioNombreChange: setters.setDetailEditBarrioNombre,
        onBarrioQueryChange: setters.setDetailEditBarrioQuery,
        onBarrioDropdownOpenChange: setters.setDetailEditBarrioDropdownOpen,
        onDomicilioObsequiadoChange: setters.setDetailEditDomicilioObsequiado,
        onLoadBarrioOptions: loadBarrioOptions,
      },
      notesSection: {
        productoObservaciones: state.detailEditProductoObservaciones,
        firma: state.detailEditFirma,
        mensajeTarjeta: state.detailEditMensajeTarjeta,
        observacionGeneral: state.detailEditObservacionGeneral,
        onProductoObservacionesChange: setters.setDetailEditProductoObservaciones,
        onFirmaChange: setters.setDetailEditFirma,
        onMensajeTarjetaChange: setters.setDetailEditMensajeTarjeta,
        onObservacionGeneralChange: setters.setDetailEditObservacionGeneral,
      },
    };

    const detailAddEditorProps = {
      selectedProductLabel: state.detailAddSelectedProductLabel,
      dropdownOpen: state.detailAddDropdownOpen,
      filterText: state.detailAddFilterText,
      productoId: state.detailAddProductoID,
      cantidad: state.detailAddCantidad,
      isCustomArrangement: state.detailAddIsCustomArrangement,
      precio: state.detailAddPrecio,
      displayProductoCodigo: state.detailAddDisplayProductoCodigo,
      saving: state.detailAddSaving,
      onToggleDropdown: () => setters.setDetailAddDropdownOpen(open => !open),
      onFilterTextChange: setters.setDetailAddFilterText,
      onSelectProduct: item => {
        setters.setDetailAddProductoID(String(item.id));
        setters.setDetailAddProductoCodigo(displayProductCode(item, detailEmpresaId));
        setters.setDetailAddNombreArreglo(String(item.nombre || ""));
        setters.setDetailAddCantidad(1);
        setters.setDetailAddPrecio(item.precio != null ? normalizeWholePeso(item.precio) : null);
        setters.setDetailAddDropdownOpen(false);
        setters.setDetailAddFilterText("");
      },
      onQuantityChange: setters.setDetailAddCantidad,
      onPriceChange: setters.setDetailAddPrecio,
    };

    const detailCatalogProps = {
      catalogLoading: state.detailEditCatalogLoading,
      filteredAddCatalog: filteredAddDetailCatalog,
      onSearchCatalog,
    };

    const detailPaymentProps = {
      paymentFieldConfig,
      salesChannelFieldConfig,
      paymentFieldOptions,
      selectedPaymentMethods: state.detailEditSelectedPaymentMethods,
      paymentAmounts: state.detailEditPaymentAmounts,
      metodosPago: state.detailEditMetodosPago,
      requiresPaymentBreakdown: state.detailEditRequiresPaymentBreakdown,
      hasLinkPayment: state.detailEditHasLinkPayment,
      omitirRecargoLink: state.detailEditOmitirRecargoLink,
      descuentoMonto: state.detailEditDescuentoMonto,
      descuentoNota: state.detailEditDescuentoNota,
      saldoFavorMonto: state.detailEditSaldoFavorMonto,
      saldoFavorNota: state.detailEditSaldoFavorNota,
      financialPreview: state.detailEditFinancialPreview,
      totalPedido,
      canalFlora: state.detailEditCanalFlora,
      onMetodosPagoChange: setters.setDetailEditMetodosPago,
      onPaymentAmountsChange: setters.setDetailEditPaymentAmounts,
      onOmitirRecargoLinkChange: setters.setDetailEditOmitirRecargoLink,
      onDescuentoMontoChange: setters.setDetailEditDescuentoMonto,
      onDescuentoNotaChange: setters.setDetailEditDescuentoNota,
      onSaldoFavorMontoChange: setters.setDetailEditSaldoFavorMonto,
      onSaldoFavorNotaChange: setters.setDetailEditSaldoFavorNota,
      onCanalFloraChange: setters.setDetailEditCanalFlora,
    };

    const detailDrawerActions = {
      onToggleEdit: onToggleDetailEdit,
      onStartDuplicate: onStartDuplicateDetail,
      onRefresh: reloadDrawer,
      onDeleteDetailProduct,
      onAddDetailProduct,
      onSave: onSaveDetailEdit,
    };

    return {
      detailEditorProps,
      detailAddEditorProps,
      detailCatalogProps,
      detailPaymentProps,
      detailDrawerActions,
    };
  }, [
    canEditClientIdentity,
    detalle,
    detailEmpresaId,
    detailProducts,
    empresaId,
    filteredAddDetailCatalog,
    filteredBarrioOptions,
    filteredDetailCatalog,
    loadBarrioOptions,
    onAddDetailProduct,
    onDeleteDetailProduct,
    onSaveDetailEdit,
    onSearchCatalog,
    onStartDuplicateDetail,
    onToggleDetailEdit,
    paymentFieldConfig,
    paymentFieldOptions,
    reloadDrawer,
    salesChannelFieldConfig,
    setters,
    state,
    totalPedido,
  ]);
}
