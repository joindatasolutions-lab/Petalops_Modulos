import { useRef, useState } from "react";
import { canInvoiceStatus } from "../ordersUiRules.js";
import { CANCELADO_PEDIDO_ESTADO_ID } from "../ordersAdminConstants.js";
import { resolveOrderId, resolveFloristaName, resolveAssignedOrderNumber, shouldAutoGenerateInvoiceForCompany } from "../ordersDomain.js";
import { getDeliveryFinancialOverride } from "../deliveryGiftOverrides.js";

export function useOrderActions({ api, items, empresaId, selectedPedidoId, setItems, setDetalle, setOrderNotification, clearOrdersCache, refreshAfterMutation, reloadDrawer }) {
  const [approvingPedidoIds, setApprovingPedidoIds] = useState([]);
  const [finalizingPedidoIds, setFinalizingPedidoIds] = useState([]);
  const [finalizedPickupPedidoIds, setFinalizedPickupPedidoIds] = useState([]);
  const busy = useRef(new Set());
  const exclusive = action => async (pedidoId, ...args) => {
    const key = Number(pedidoId);
    if (busy.current.has(key)) return;
    busy.current.add(key);
    try { return await action(pedidoId, ...args); }
    finally { busy.current.delete(key); }
  };
  const optimisticStatusPatch = (pedidoId, nextStatus, motivoRechazo = null, extraPatch = {}) => {
    setItems(current => current.map(item => Number(resolveOrderId(item)) === Number(pedidoId)
      ? { ...item, estado: nextStatus, ...extraPatch, ...(motivoRechazo !== null ? { motivoRechazo } : {}) }
      : item));

    setDetalle(current => {
      if (!current || Number(selectedPedidoId) !== Number(pedidoId)) return current;
      return { ...current, estado: nextStatus, ...extraPatch, ...(motivoRechazo !== null ? { motivoRechazo } : {}) };
    });
  };

  const approveOrder = async pedidoId => {
    const item = items.find(current => Number(resolveOrderId(current)) === Number(pedidoId));
    if (item?.puedeAprobar === false) {
      globalThis.alert(item.motivoBloqueoAprobacion || "Completa la información requerida antes de aprobar.");
      return;
    }
    if (approvingPedidoIds.includes(Number(pedidoId))) {
      globalThis.alert("Este pedido ya se está aprobando. Espera un momento.");
      return;
    }

    setApprovingPedidoIds(current => [...current, Number(pedidoId)]);
    try {
      const response = await api.aprobarPedido(pedidoId);
      const floristaAsignado = resolveFloristaName(response);
      optimisticStatusPatch(
        pedidoId,
        response.estado || "APROBADO",
        null,
        floristaAsignado !== "Sin asignar" ? { floristaAsignado } : {}
      );
      const refreshed = await refreshAfterMutation();
      const refreshedItem = (Array.isArray(refreshed?.items) ? refreshed.items : [])
        .find(current => Number(resolveOrderId(current)) === Number(pedidoId));
      const assignedOrderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, refreshedItem);
      if (shouldAutoGenerateInvoiceForCompany(empresaId)) {
        await downloadInvoice(pedidoId, { refreshAfter: false });
      }
      setOrderNotification({
        tone: "success",
        title: "Pedido aprobado",
        message: assignedOrderNumber
          ? `El pedido #${assignedOrderNumber} fue creado correctamente y ya quedó aprobado.`
          : "El pedido quedó aprobado correctamente. El número se asignará en unos momentos.",
      });
    } catch (nextError) {
      if (nextError?.status === 409) await refreshAfterMutation();
      console.error("Error aprobando pedido:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible aprobar el pedido.");
    } finally {
      setApprovingPedidoIds(current => current.filter(currentId => currentId !== Number(pedidoId)));
    }
  };

  const rejectOrder = async pedidoId => {
    const item = items.find(current => Number(resolveOrderId(current)) === Number(pedidoId));
    const isCancellation = canInvoiceStatus(item?.estado);
    const actionLabel = isCancellation ? "cancelación" : "rechazo";
    const motivo = String(globalThis.prompt(`Motivo de ${actionLabel}`, "") || "").trim();
    if (!motivo) {
      globalThis.alert(`Debes ingresar un motivo de ${actionLabel}.`);
      return;
    }

    try {
      const response = isCancellation
        ? await api.cambiarEstadoPedidoPipeline({ pedidoId, nuevoEstadoId: CANCELADO_PEDIDO_ESTADO_ID })
        : await api.rechazarPedido(pedidoId, motivo);

      if (isCancellation) {
        console.info("Respuesta cancelación pedido:", response);
        clearOrdersCache();
        const refreshed = await refreshAfterMutation();
        if (Number(selectedPedidoId) === Number(pedidoId)) {
          await reloadDrawer();
        }
        const refreshedItem = (Array.isArray(refreshed?.items) ? refreshed.items : [])
          .find(current => Number(resolveOrderId(current)) === Number(pedidoId));
        const orderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, refreshedItem, item);
        setOrderNotification({
          tone: "danger",
          title: "Pedido cancelado",
          message: orderNumber
            ? `El pedido #${orderNumber} fue cancelado correctamente.`
            : "El pedido fue cancelado correctamente.",
        });
        return;
      }

      const nextStatus = response.estado || "RECHAZADO";
      const orderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, item);
      optimisticStatusPatch(pedidoId, nextStatus, response.motivo || motivo);
      clearOrdersCache();
      await refreshAfterMutation();
      setOrderNotification({
        tone: "danger",
        title: "Pedido rechazado",
        message: orderNumber
          ? `El pedido #${orderNumber} fue rechazado correctamente.`
          : "El pedido fue rechazado correctamente.",
      });
    } catch (nextError) {
      if (nextError?.status === 409) await refreshAfterMutation();
      console.error("Error rechazando pedido:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || `No fue posible completar la ${actionLabel}.`);
    }
  };

  const finalizeOrder = async pedidoId => {
    if (finalizingPedidoIds.includes(Number(pedidoId))) {
      return;
    }

    const item = items.find(current => Number(resolveOrderId(current)) === Number(pedidoId));
    const fallbackNumber = resolveAssignedOrderNumber(null, null, null, item);
    setFinalizingPedidoIds(current => [...current, Number(pedidoId)]);
    try {
      const response = await api.finalizarPedidoRecogidaTienda(pedidoId);
      setFinalizedPickupPedidoIds(current => Array.from(new Set([...current, Number(pedidoId)])));
      clearOrdersCache();
      const refreshed = await refreshAfterMutation();
      if (Number(selectedPedidoId) === Number(pedidoId)) {
        await reloadDrawer();
      }
      const refreshedItem = (Array.isArray(refreshed?.items) ? refreshed.items : [])
        .find(current => Number(resolveOrderId(current)) === Number(pedidoId));
      const orderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, refreshedItem, item) || fallbackNumber;
      setOrderNotification({
        tone: "success",
        title: "Pedido finalizado",
        message: orderNumber
          ? `El pedido #${orderNumber} quedo finalizado y ya se vera como entregado en el pipeline.`
          : "El pedido quedo finalizado y ya se vera como entregado en el pipeline.",
      });
    } catch (nextError) {
      if (nextError?.status === 409) await refreshAfterMutation();
      console.error("Error finalizando pedido:", nextError);
      setOrderNotification({
        tone: "danger",
        title: "No se puede finalizar",
        message: nextError?.detail || nextError?.message || "Para finalizar este pedido, produccion debe estar en estado ParaEntrega.",
      });
    } finally {
      setFinalizingPedidoIds(current => current.filter(currentId => currentId !== Number(pedidoId)));
    }
  };

  const downloadInvoice = async (pedidoId, options = {}) => {
    const { refreshAfter = true } = options;
    if (!pedidoId) {
      globalThis.alert("No fue posible descargar la factura: el pedido no tiene un identificador válido.");
      return false;
    }

    try {
      const financialOverride = getDeliveryFinancialOverride(pedidoId);
      if (financialOverride && typeof api.actualizarFinanzasPedidoPipeline === "function") {
        await api.actualizarFinanzasPedidoPipeline({
          pedidoId,
          ...financialOverride,
          costoDomicilio: financialOverride.domicilio,
        });
      }
      const { blob, filename } = await api.descargarFacturaPedido(pedidoId);
      clearOrdersCache();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `factura_pedido_${pedidoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (refreshAfter) {
        await refreshAfterMutation();
      }
      if (refreshAfter && Number(selectedPedidoId) === Number(pedidoId)) {
        await reloadDrawer();
      }
      return true;
    } catch (nextError) {
      if (nextError?.status === 409) await refreshAfterMutation();
      console.error("Error descargando factura:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible descargar la factura del pedido.");
      return false;
    }
  };
  return {
    approvingPedidoIds, finalizingPedidoIds, finalizedPickupPedidoIds,
    approveOrder: exclusive(approveOrder), rejectOrder: exclusive(rejectOrder),
    finalizeOrder: exclusive(finalizeOrder), downloadInvoice: exclusive(downloadInvoice),
  };
}
