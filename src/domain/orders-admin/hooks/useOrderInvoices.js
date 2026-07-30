import { useCallback } from "react";

export function useOrderInvoices({
  items,
  detalle,
  selectedPedidoId,
  setItems,
  setDetalle,
  setFacturasPendientesImpresion,
  setMetricFacturasPendientesImpresion,
  setOrdersKpis,
  setLocalPendingInvoiceIds,
  resolveOrderId,
  shouldShowPendingInvoiceAlert,
  canInvoiceStatus,
}) {
  const patchOrderInvoicePrinted = useCallback((pedidoId, facturaImpresa) => {
    setItems(current => current.map(item => {
      if (Number(resolveOrderId(item)) !== Number(pedidoId)) return item;
      const financiero = item.financiero && typeof item.financiero === "object"
        ? { ...item.financiero, facturaImpresa }
        : item.financiero;
      return { ...item, facturaImpresa, ...(financiero ? { financiero } : {}) };
    }));

    setDetalle(current => {
      if (!current || Number(selectedPedidoId) !== Number(pedidoId)) return current;
      const financiero = current.financiero && typeof current.financiero === "object"
        ? { ...current.financiero, facturaImpresa }
        : current.financiero;
      return { ...current, facturaImpresa, ...(financiero ? { financiero } : {}) };
    });
  }, [resolveOrderId, selectedPedidoId, setDetalle, setItems]);

  const applyPendingInvoiceDelta = useCallback(delta => {
    const nextCount = value => Math.max(0, Number(value || 0) + delta);
    setFacturasPendientesImpresion(current => nextCount(current));
    setMetricFacturasPendientesImpresion(current => nextCount(current));
    setOrdersKpis(current => ({
      ...current,
      sinImprimir: nextCount(current?.sinImprimir),
    }));
  }, [setFacturasPendientesImpresion, setMetricFacturasPendientesImpresion, setOrdersKpis]);

  const isInvoicePendingForOrder = useCallback(pedidoId => {
    const item = items.find(current => Number(resolveOrderId(current)) === Number(pedidoId));
    if (shouldShowPendingInvoiceAlert(item)) return true;
    if (!detalle || Number(selectedPedidoId) !== Number(pedidoId)) return false;
    return canInvoiceStatus(detalle.estado) && !detalle.financiero?.facturaImpresa;
  }, [canInvoiceStatus, detalle, items, resolveOrderId, selectedPedidoId, shouldShowPendingInvoiceAlert]);

  const markInvoiceDownloaded = useCallback((pedidoId, { wasPendingInvoice = false } = {}) => {
    setLocalPendingInvoiceIds(current => {
      const next = new Set(current);
      next.delete(Number(pedidoId));
      return next;
    });
    patchOrderInvoicePrinted(pedidoId, true);
    if (wasPendingInvoice) {
      applyPendingInvoiceDelta(-1);
    }
  }, [applyPendingInvoiceDelta, patchOrderInvoicePrinted, setLocalPendingInvoiceIds]);

  const markInvoiceGenerated = useCallback((pedidoId, { wasPendingInvoice = false } = {}) => {
    setLocalPendingInvoiceIds(current => {
      const next = new Set(current);
      next.add(Number(pedidoId));
      return next;
    });
    patchOrderInvoicePrinted(pedidoId, false);
    if (!wasPendingInvoice) {
      applyPendingInvoiceDelta(1);
    }
  }, [applyPendingInvoiceDelta, patchOrderInvoicePrinted, setLocalPendingInvoiceIds]);

  return {
    isInvoicePendingForOrder,
    markInvoiceGenerated,
    markInvoiceDownloaded,
  };
}
