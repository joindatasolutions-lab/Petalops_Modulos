export function mergeNoveltyOrderDetail(item, detail) {
  const client = detail?.cliente || {};
  const recipient = detail?.destinatario || {};
  return {
    ...item,
    cliente: client.nombre || client.nombreCompleto || item.cliente,
    telefonoCliente: client.telefonoCompleto || client.telefono || item.telefonoCliente,
    emailCliente: client.email || item.emailCliente,
    destinatario: recipient.nombre || item.destinatario,
    telefonoDestino: recipient.telefono || item.telefonoDestino,
    direccion: recipient.direccion || item.direccion,
    barrio: recipient.barrio || item.barrio,
    fechaEntregaProgramada: recipient.fechaEntrega || item.fechaEntregaProgramada,
    horaEntrega: recipient.horaEntrega || item.horaEntrega,
    mensaje: recipient.mensaje_tarjeta || recipient.mensajeTarjeta || recipient.mensaje || item.customerMessage || item.mensaje,
    firmaTarjeta: recipient.firma_tarjeta || recipient.firmaTarjeta || recipient.firma || item.firmaTarjeta,
    observacion: recipient.observaciones_entrega || recipient.observacionesEntrega || recipient.observacionGeneral || item.observacion,
  };
}
