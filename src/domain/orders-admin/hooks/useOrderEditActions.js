import { useRef } from "react";
import { normalizeWholePeso } from "../ordersDomain.js";
import { buildDetailUpdatePayload } from "../orderPayloadBuilders.js";
import { buildAddDetailProductPayload } from "../orderPayloadBuilders.js";
import { forgetDeliveryGiftOverride } from "../deliveryGiftOverrides.js";

export function useOrderEditActions({
  selectedPedidoId,
  detailEditSaving,
  setDetailEditError,
  setDetailEditSaving,
  detalle,
  isDuplicatingDetail,
  detailEditIsCustomArrangement,
  detailEditPrecio,
  validatePaymentMethods,
  validateSalesChannel,
  api,
  buildDuplicateCheckoutPayload,
  getDetailEditPayloadState,
  canEditClientIdentity,
  refreshAfterMutation,
  openDetail,
  setIsDuplicatingDetail,
  buildDetailEditApiPayload,
  reloadDrawer,
  setIsEditingDetail,
  detailAddSaving,
  detailEditDetalleID,
  detailAddProductoID,
  detailAddIsCustomArrangement,
  detailAddPrecio,
  setDetailAddSaving,
  detailAddCantidad,
  setDetailEditDetalleID,
  setDetailEditSubview,
  setDetailAddDropdownOpen,
  setDetailAddFilterText,
  setDetailAddProductoID,
  setDetailAddProductoCodigo,
  setDetailAddNombreArreglo,
  setDetailAddCantidad,
  setDetailAddPrecio,
  detailEditDeletingDetailId,
  setDetailEditDeletingDetailId,
  setDetalle,
  applySelectedDetailProduct
}) {
  const busy = useRef(false);
  const exclusive = action => async (...args) => {
    if (busy.current) return;
    busy.current = true;
    try { return await action(...args); } finally { busy.current = false; }
  };
  const onSaveDetailEdit = async () => {
    if (!selectedPedidoId || detailEditSaving) return;
    setDetailEditError("");
    setDetailEditSaving(true);
    try {
      const detallePedidoId = Number(detalle?.pedidoID || detalle?.pedidoId || detalle?.idPedido || detalle?.id_pedido || 0);
      if (!isDuplicatingDetail && detallePedidoId && Number(selectedPedidoId) !== detallePedidoId) {
        throw new Error("El detalle abierto no corresponde al pedido seleccionado. Cierra y vuelve a abrir el pedido antes de guardar.");
      }
      if (detailEditIsCustomArrangement) {
        const customPrice = normalizeWholePeso(detailEditPrecio);
        if (!Number.isFinite(customPrice) || customPrice <= 0) {
          throw new Error("Debes indicar un precio válido para el arreglo personalizado.");
        }
      }
      const paymentValidation = validatePaymentMethods();
      const validatedCanalFlora = validateSalesChannel();
      if (isDuplicatingDetail) {
        const created = await api.crearPedidoCheckout(buildDuplicateCheckoutPayload());
        await api.actualizarDetallePedidoPipeline(buildDetailUpdatePayload({
          pedidoId: created.pedidoID,
          detalle,
          edit: {
            ...getDetailEditPayloadState(),
            detalleID: null,
          },
          paymentValidation,
          canalFlora: validatedCanalFlora,
          canEditClientIdentity,
        }));
        await refreshAfterMutation();
        await openDetail(created.pedidoID);
        setIsDuplicatingDetail(false);
      } else {
        await api.actualizarDetallePedidoPipeline(buildDetailEditApiPayload(selectedPedidoId));
        forgetDeliveryGiftOverride(selectedPedidoId);
        await reloadDrawer();
      }
      const hasCashPayment = Number.isFinite(paymentValidation.cashAmount) && paymentValidation.cashAmount > 0;
      if (hasCashPayment && typeof window !== "undefined") {
        window.dispatchEvent(new Event("pedidoGuardadoEfectivo"));
      }
      setIsEditingDetail(false);
    } catch (nextError) {
      setDetailEditError(nextError?.message || (isDuplicatingDetail
        ? "No fue posible crear el pedido duplicado."
        : "No fue posible guardar la edición del pedido."));
    } finally {
      setDetailEditSaving(false);
    }
  };

  const onAddDetailProduct = async () => {
    if (!selectedPedidoId || detailAddSaving) return;
    setDetailEditError("");
    const currentDetalleId = String(detailEditDetalleID || "").trim();

    if (!detailAddProductoID) {
      setDetailEditError("Debes seleccionar el arreglo que quieres agregar.");
      return;
    }

    if (detailAddIsCustomArrangement) {
      const customPrice = normalizeWholePeso(detailAddPrecio);
      if (!Number.isFinite(customPrice) || customPrice <= 0) {
        setDetailEditError("Debes indicar un precio válido para el arreglo personalizado.");
        return;
      }
    }

    setDetailAddSaving(true);
    try {
      const response = await api.agregarDetallePedidoPipeline(buildAddDetailProductPayload({
        pedidoId: selectedPedidoId,
        productoID: detailAddProductoID,
        cantidad: detailAddCantidad,
        isCustomArrangement: detailAddIsCustomArrangement,
        precio: detailAddPrecio,
      }));
      await reloadDrawer();
      if (currentDetalleId) {
        setDetailEditDetalleID(currentDetalleId);
      } else if (response?.detalleID != null) {
        setDetailEditDetalleID(String(response.detalleID));
      }
      setDetailEditSubview("edit");
      setDetailAddDropdownOpen(false);
      setDetailAddFilterText("");
      setDetailAddProductoID("");
      setDetailAddProductoCodigo("");
      setDetailAddNombreArreglo("");
      setDetailAddCantidad(1);
      setDetailAddPrecio(null);
    } catch (nextError) {
      setDetailEditError(nextError?.detail || nextError?.message || "No fue posible agregar el arreglo al pedido.");
    } finally {
      setDetailAddSaving(false);
    }
  };

  const onDeleteDetailProduct = async detalleId => {
    if (!selectedPedidoId || !detalleId || detailEditDeletingDetailId != null) return;
    const confirmed = globalThis.confirm("¿Eliminar este arreglo del pedido?");
    if (!confirmed) return;
    setDetailEditError("");
    setDetailEditDeletingDetailId(Number(detalleId));
    let previousDetalle = null;
    try {
      setDetalle(current => {
        if (!current || current.error || !Array.isArray(current.productos)) return current;
        previousDetalle = current;
        const nextProducts = current.productos.filter(
          item => String(item?.detalleID ?? "") !== String(detalleId)
        );
        if (nextProducts.length === 0) {
          return current;
        }
        const currentSelected = String(detailEditDetalleID || "");
        const fallbackProduct = nextProducts.find(
          item => String(item?.detalleID ?? "") !== String(detalleId)
        ) || nextProducts[0];
        if (currentSelected === String(detalleId) && fallbackProduct) {
          applySelectedDetailProduct(fallbackProduct);
        }
        return {
          ...current,
          productos: nextProducts,
        };
      });
      await api.eliminarDetallePedidoPipeline({
        pedidoId: selectedPedidoId,
        detalleID: Number(detalleId),
      });
      await refreshAfterMutation();
    } catch (nextError) {
      if (previousDetalle) {
        setDetalle(previousDetalle);
      }
      setDetailEditError(nextError?.detail || nextError?.message || "No fue posible eliminar el arreglo.");
    } finally {
      setDetailEditDeletingDetailId(null);
    }
  };

  return { onSaveDetailEdit: exclusive(onSaveDetailEdit), onAddDetailProduct: exclusive(onAddDetailProduct), onDeleteDetailProduct: exclusive(onDeleteDetailProduct) };
}
