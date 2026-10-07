export function extractActiveCatalogNames(payload) {
  return (Array.isArray(payload?.items) ? payload.items : [])
    .filter(item => item?.activo !== false && item?.activo !== 0)
    .map(item => String(item?.nombre || "").trim())
    .filter(Boolean);
}

export async function loadOrderPaymentCatalogs(api, empresaId) {
  const results = await Promise.allSettled([
    api.listarMenuPedidoEmpresa({ empresaId }),
    api.listarMetodosPagoEmpresa({ empresaId }),
    api.listarCanalesVentaEmpresa({ empresaId }),
  ]);
  const [menu, payment, channel] = results;
  return {
    fields: menu.status === "fulfilled" && Array.isArray(menu.value?.items) ? menu.value.items : [],
    // null means unavailable; an authorized empty catalog must stay empty.
    paymentOptions: payment.status === "fulfilled" ? extractActiveCatalogNames(payment.value) : null,
    channelOptions: channel.status === "fulfilled" ? extractActiveCatalogNames(channel.value) : null,
    errors: results.filter(result => result.status === "rejected").map(result => result.reason),
  };
}

export function mergeOrderPaymentCatalogs(fields, catalog) {
  return fields.map(field => {
    const options = field?.codigo === "pedido_metodos_pago" ? catalog?.paymentOptions
      : field?.codigo === "pedido_canal_venta" ? catalog?.channelOptions : null;
    return options == null ? field : { ...field, opciones: options };
  });
}
