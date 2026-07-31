import { useState } from "react";

import { resolveOrderId } from "../ordersDomain.js";

/**
 * Controlador de la tarjeta de mensaje.
 *
 * Mantiene en un solo lugar el estado visual del modal, el borrador editable y
 * la sincronizacion con el detalle del pedido luego de guardar.
 */
export function useMessageCardController({
  api,
  selectedPedidoId,
  setDetalle,
  loadOrders,
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [order, setOrder] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fontFamily, setFontFamily] = useState("Georgia, serif");
  const [fontSize, setFontSize] = useState(24);
  const [textColor, setTextColor] = useState("#1f2937");
  const [textAlign, setTextAlign] = useState("center");
  const [signatureAlign, setSignatureAlign] = useState("right");

  const openMessageCard = async item => {
    const pedidoId = resolveOrderId(item);
    if (!pedidoId) {
      globalThis.alert("No fue posible generar el mensaje: el pedido no tiene un identificador valido.");
      return;
    }

    setOrder(item || null);
    try {
      const payload = await api.obtenerMensajeTarjeta(pedidoId);
      setData(payload);
      setDraft(String(payload?.mensaje || ""));
      setError("");
      setOpen(true);
    } catch (nextError) {
      console.error("Error obteniendo mensaje de tarjeta:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible consultar el mensaje del pedido.");
    }
  };

  const closeMessageCard = () => {
    setOpen(false);
    setDraft("");
    setSaving(false);
    setError("");
  };

  const saveMessageCard = async () => {
    const pedidoId = Number(resolveOrderId(order) || selectedPedidoId || 0);
    if (!pedidoId || saving) return;

    setSaving(true);
    setError("");
    try {
      await api.actualizarDetallePedidoPipeline({
        pedidoId,
        mensajeTarjeta: draft,
      });
      setData(current => ({
        ...(current || {}),
        mensaje: draft,
      }));
      if (Number(selectedPedidoId) === pedidoId) {
        setDetalle(current => current ? ({
          ...current,
          destinatario: {
            ...(current.destinatario || {}),
            mensajeTarjeta: draft,
          },
        }) : current);
      }
      await loadOrders(true);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible guardar el mensaje.");
    } finally {
      setSaving(false);
    }
  };

  return {
    open,
    data,
    order,
    draft,
    saving,
    error,
    fontFamily,
    fontSize,
    textColor,
    textAlign,
    signatureAlign,
    setDraft,
    setFontFamily,
    setFontSize,
    setTextColor,
    setTextAlign,
    setSignatureAlign,
    openMessageCard,
    closeMessageCard,
    saveMessageCard,
  };
}
