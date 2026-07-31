import { resolveOrderId } from "./ordersDomain.js";

const STORAGE_KEY = "petalops_delivery_gift_overrides_v1";

function readOverrides() {
  if (typeof globalThis.localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  if (typeof globalThis.localStorage === "undefined") return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function rememberDeliveryGiftOverride(pedidoId, financiero = {}) {
  const id = Number(pedidoId);
  if (!Number.isFinite(id) || id <= 0) return;

  const overrides = readOverrides();
  overrides[String(id)] = {
    domicilioObsequiado: true,
    omitirCostoDomicilio: true,
    subtotal: financiero.subtotal,
    iva: financiero.iva,
    domicilio: financiero.domicilio,
    domicilioOriginal: financiero.domicilioOriginal,
    descuentoDomicilio: financiero.descuentoDomicilio,
    recargoLinkMonto: financiero.recargoLinkMonto,
    descuentoMonto: financiero.descuentoMonto,
    saldoFavorMonto: financiero.saldoFavorMonto,
    total: financiero.total,
    updatedAt: new Date().toISOString(),
  };
  writeOverrides(overrides);
}

export function forgetDeliveryGiftOverride(pedidoId) {
  const id = Number(pedidoId);
  if (!Number.isFinite(id) || id <= 0) return;

  const overrides = readOverrides();
  delete overrides[String(id)];
  writeOverrides(overrides);
}

export function applyDeliveryGiftOverrideToItem(item) {
  const pedidoId = resolveOrderId(item);
  if (!pedidoId) return item;

  const override = readOverrides()[String(pedidoId)];
  if (!override?.domicilioObsequiado) return item;

  const financiero = item?.financiero && typeof item.financiero === "object" ? item.financiero : {};
  const entrega = item?.entrega && typeof item.entrega === "object" ? item.entrega : null;
  const destinatario = item?.destinatario && typeof item.destinatario === "object" ? item.destinatario : null;
  const nextFinanciero = {
    ...financiero,
    subtotal: override.subtotal ?? financiero.subtotal,
    iva: override.iva ?? financiero.iva,
    domicilio: override.domicilio ?? financiero.domicilio ?? item?.domicilio,
    domicilioOriginal: override.domicilioOriginal ?? financiero.domicilioOriginal ?? financiero.domicilio ?? item?.domicilio,
    descuentoDomicilio: override.descuentoDomicilio ?? financiero.descuentoDomicilio,
    recargoLinkMonto: override.recargoLinkMonto ?? financiero.recargoLinkMonto,
    descuentoMonto: override.descuentoMonto ?? financiero.descuentoMonto,
    saldoFavorMonto: override.saldoFavorMonto ?? financiero.saldoFavorMonto,
    total: override.total ?? financiero.total,
    domicilioObsequiado: true,
    omitirCostoDomicilio: true,
  };

  return {
    ...item,
    subtotal: override.subtotal ?? item?.subtotal,
    iva: override.iva ?? item?.iva,
    domicilio: override.domicilio ?? item?.domicilio,
    domicilioOriginal: override.domicilioOriginal ?? item?.domicilioOriginal ?? item?.domicilio,
    descuentoDomicilio: override.descuentoDomicilio ?? item?.descuentoDomicilio,
    recargoLinkMonto: override.recargoLinkMonto ?? item?.recargoLinkMonto,
    descuentoMonto: override.descuentoMonto ?? item?.descuentoMonto,
    saldoFavorMonto: override.saldoFavorMonto ?? item?.saldoFavorMonto,
    total: override.total ?? item?.total,
    valorTotal: override.total ?? item?.valorTotal,
    totalPedido: override.total ?? item?.totalPedido,
    domicilioObsequiado: true,
    omitirCostoDomicilio: true,
    ...(entrega ? {
      entrega: {
        ...entrega,
        domicilio: override.domicilio ?? entrega.domicilio,
        domicilioOriginal: override.domicilioOriginal ?? entrega.domicilioOriginal ?? entrega.domicilio,
        domicilioObsequiado: true,
        omitirCostoDomicilio: true,
      },
    } : {}),
    ...(destinatario ? {
      destinatario: {
        ...destinatario,
        domicilioObsequiado: true,
        omitirCostoDomicilio: true,
      },
    } : {}),
    financiero: nextFinanciero,
  };
}

export function applyDeliveryGiftOverrideToDetail(pedidoId, detail) {
  if (!detail || detail.error) return detail;
  return applyDeliveryGiftOverrideToItem({
    ...detail,
    pedidoID: pedidoId ?? detail.pedidoID,
  });
}
