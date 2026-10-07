import { useRef } from "react";
import { buildQuickSaleOrderPayload } from "../orderPayloadBuilders.js";

export function useNewOrderCreation({ api, empresaId, sucursalId, newOrderForm, paymentFieldConfig, salesChannelFieldConfig, hydrateNewOrderClientByPhone, buildNewOrderManualPayload, setNewOrderOpen, setOrderNotification, loadQuickSaleInventoryItems, refreshAfterMutation, openDetail, setNewOrderSaving, setNewOrderError }) {
  const savingRef = useRef(false);
  const onSaveNewOrder = async () => {
    if (savingRef.current) return;
    setNewOrderError("");

    if (paymentFieldConfig && !String(newOrderForm.metodoPago || "").trim()) {
      setNewOrderError(`${paymentFieldConfig.titulo || "Metodo de pago"} es obligatorio.`);
      return;
    }
    if (salesChannelFieldConfig && !String(newOrderForm.canalFlora || "").trim()) {
      setNewOrderError(`${salesChannelFieldConfig.titulo || "Canal de venta"} es obligatorio.`);
      return;
    }

    savingRef.current = true;
    setNewOrderSaving(true);
    try {
      if (newOrderForm.ventaRapida) {
        const hydratedQuickSaleForm = newOrderForm.registrarClienteVentaRapida
          ? await hydrateNewOrderClientByPhone(newOrderForm.clienteTelefono)
          : null;
        const quickSalePayload = buildQuickSaleOrderPayload({
          form: hydratedQuickSaleForm || newOrderForm,
          empresaId,
          sucursalId,
        });
        const created = await api.crearPedidoVentaRapida(quickSalePayload);
        const createdPedidoId = created?.pedidoID || created?.pedidoId || created?.pedido_id || created?.idPedido || created?.id_pedido || created?.id;
        setNewOrderOpen(false);
        setOrderNotification({
          type: "success",
          title: "Venta rapida registrada",
          message: `Pedido #${created?.numeroPedido || created?.pedidoID || ""} guardado y entregado correctamente.`,
        });
        await refreshAfterMutation();
        await loadQuickSaleInventoryItems();
        if (createdPedidoId) await openDetail(createdPedidoId);
        return;
      }

      const hydratedForm = await hydrateNewOrderClientByPhone(newOrderForm.clienteTelefono);
      const manualPayload = buildNewOrderManualPayload(hydratedForm || newOrderForm);
      const created = await api.crearPedidoManual(manualPayload);
      const createdPedidoId = created?.pedidoID || created?.pedidoId || created?.pedido_id || created?.idPedido || created?.id_pedido || created?.id;
      setNewOrderOpen(false);
      setOrderNotification({
        type: "success",
        title: "Pedido creado",
        message: `Pedido #${created?.numeroPedido || created?.pedidoID || ""} registrado correctamente.`,
      });
      await refreshAfterMutation();
      if (createdPedidoId) await openDetail(createdPedidoId);
    } catch (nextError) {
      setNewOrderError(nextError?.detail || nextError?.message || "No fue posible crear el pedido.");
    } finally {
      savingRef.current = false;
      setNewOrderSaving(false);
    }
  };

  return onSaveNewOrder;
}
