const orderNumber = item => String(item?.numeroPedido ?? item?.numero_pedido ?? item?.codigoPedido ?? item?.codigo_pedido ?? "").trim().replace(/^[A-Za-z]+[-_\s]*(?=\d)/, "");

export function deliveryEvidenceErrorMessage(error) {
  switch (Number(error?.status)) {
    case 401: return "Tu sesión no es válida. Inicia sesión nuevamente para consultar las evidencias.";
    case 403: return "No tienes permisos para consultar las evidencias de este pedido.";
    case 404: return "Pedido no encontrado en la empresa y sucursal actuales.";
    case 500: return "Error al consultar las evidencias. Intenta nuevamente.";
    default: return error?.message || "No se pudieron consultar las evidencias. Intenta nuevamente.";
  }
}

export async function loadDeliveryEvidence(api, item, { empresaId, sucursalId }) {
  const number = orderNumber(item);
  if (!/^\d+$/.test(number)) throw new Error("Falta el número del pedido para consultar sus evidencias.");
  const pedido = await api.obtenerEvidenciasDomicilio({ empresaId, sucursalId, numeroPedido: number });
  if (!pedido || typeof pedido !== "object" || Array.isArray(pedido) || String(pedido.numero_pedido) !== number) {
    throw new Error("La respuesta de evidencias no corresponde al pedido solicitado.");
  }
  for (const field of ["evidencia_entrega_url", "evidencia_firma_url"]) {
    if (!(field in pedido) || (pedido[field] != null && typeof pedido[field] !== "string")) {
      throw new Error("La consulta no devolvió los campos de evidencias esperados.");
    }
  }
  return pedido;
}
