export function noveltyDeliveryId(row) {
  return row?.item?.idEntrega || row?.item?.id_entrega || row?.raw?.idEntrega || row?.raw?.id_entrega;
}

export function buildNoveltyResolution(row, form, usuarioCambio) {
  const entregaId = noveltyDeliveryId(row);
  if (!entregaId) throw new Error("No fue posible identificar la entrega para resolver la novedad.");
  if (!["entregar", "nuevo_intento", "devolver_disponibles"].includes(form.accion)) throw new Error("Esta acción todavía no está disponible. No se guardaron cambios.");
  const observaciones = String(form.observacion || "").trim();
  if (!observaciones) throw new Error("Debes diligenciar la observación para resolver la novedad.");
  const reprogramarPara = form.accion !== "entregar" && form.reprogramarPara
    ? `${form.reprogramarPara}:00-05:00` : undefined;
  if (reprogramarPara && !Number.isFinite(Date.parse(reprogramarPara))) throw new Error("La fecha de reprogramación no es válida.");
  return {
    entregaId,
    accion: form.accion,
    ...(reprogramarPara ? { reprogramarPara } : {}),
    usuarioCambio,
    observaciones,
    ...(form.accion === "entregar" ? {
      firmaNombre: String(form.recibidoNombre || "").trim(),
      firmaDocumento: String(form.recibidoDocumento || "").trim(),
    } : {}),
  };
}
