import { normalizeDeliveryType } from "./orderDeliveryType.js";
import { normalizeTime, toDateInput } from "./orderDateFormatters.js";
import {
  extractIndicativo,
  normalizeWholePeso,
} from "./ordersDomain.js";

/**
 * Constructores de payloads del modulo Pedidos.
 *
 * Estos helpers concentran la traduccion entre el estado de UI y el contrato
 * esperado por el API. La pagina decide cuando llamar al API; este archivo solo
 * arma datos y valida reglas propias del payload.
 */

function textOrNull(...values) {
  const text = values.map(value => String(value || "").trim()).find(Boolean);
  return text || null;
}

export function buildNewOrderCheckoutPayload({
  form,
  empresaId,
  sucursalId,
  productoID,
}) {
  if (!String(form.clienteNombre || "").trim()) throw new Error("Ingresa el nombre del cliente.");
  if (!String(form.clienteTelefono || "").trim()) throw new Error("Ingresa el telefono del cliente.");
  if (!String(form.destinatarioNombre || "").trim()) throw new Error("Ingresa el destinatario.");
  if (!form.fechaEntrega) throw new Error("Selecciona la fecha de entrega.");

  const barrioSeleccionado = String(form.barrioNombre || "").trim() || null;
  const tipoEntrega = normalizeDeliveryType(barrioSeleccionado);
  const domicilioObsequiado = tipoEntrega !== "recogida_en_tienda" && Boolean(form.domicilioObsequiado);
  const domicilioOriginal = tipoEntrega === "recogida_en_tienda"
    ? 0
    : normalizeWholePeso(form.barrioCostoDomicilio);
  const domicilioCobrado = tipoEntrega === "recogida_en_tienda"
    ? 0
    : domicilioObsequiado
      ? 0
      : domicilioOriginal;
  if (tipoEntrega !== "recogida_en_tienda" && !String(form.direccion || "").trim()) {
    throw new Error("Ingresa la direccion de entrega o selecciona Recoger en tienda.");
  }

  const horaEntrega = normalizeTime(form.horaEntrega) || "08:00";
  const notaProduccion = textOrNull(form.nota_produccion, form.notaProduccion, form.productoObservaciones, form.notas);
  const mensajeTarjeta = textOrNull(form.mensaje_tarjeta, form.mensajeTarjeta);
  const firmaTarjeta = textOrNull(form.firma_tarjeta, form.firma);
  const observacionesEntrega = textOrNull(form.observaciones_entrega, form.observacionGeneral);
  const lineItems = Array.isArray(form.productos) ? form.productos : [];
  const productos = lineItems
    .map(item => {
      const nextProductoID = Number(item?.productoID || 0);
      if (!nextProductoID) return null;
      const producto = {
        productoID: nextProductoID,
        cantidad: Number(item?.cantidad || 1),
      };
      const itemNotaProduccion = textOrNull(item?.nota_produccion, item?.notaProduccion, item?.productoObservaciones, item?.notas);
      if (itemNotaProduccion) {
        producto.nota_produccion = itemNotaProduccion;
      }
      const precio = normalizeWholePeso(item?.precio);
      if (Number.isFinite(precio) && precio > 0) {
        producto.productoPrecio = precio;
      }
      return producto;
    })
    .filter(Boolean);

  if (productoID && !productos.some(item => Number(item.productoID) === Number(productoID))) {
    const producto = {
      productoID,
      cantidad: Number(form.cantidad || 1),
    };
    const precio = normalizeWholePeso(form.precio);
    if (Number.isFinite(precio) && precio > 0) {
      producto.productoPrecio = precio;
    }
    productos.push(producto);
  }

  if (productos.length === 0) throw new Error("Agrega al menos un arreglo del catalogo.");

  return {
    empresaID: empresaId,
    sucursalID: sucursalId,
    productos,
    domicilio: domicilioCobrado,
    costoDomicilio: domicilioCobrado,
    domicilioOriginal,
    descuentoDomicilio: domicilioObsequiado ? domicilioOriginal : 0,
    domicilioObsequiado,
    domicilio_obsequiado: domicilioObsequiado,
    omitirCostoDomicilio: domicilioObsequiado,
    omitir_costo_domicilio: domicilioObsequiado,
    nota_produccion: notaProduccion,
    mensaje_tarjeta: mensajeTarjeta,
    firma_tarjeta: firmaTarjeta,
    observaciones_entrega: observacionesEntrega,
    cliente: {
      clienteID: form.clienteID != null ? Number(form.clienteID) : null,
      tipoIdent: form.clienteTipoIdent || null,
      identificacion: form.clienteIdentificacion || null,
      nombreCompleto: String(form.clienteNombre || "").trim(),
      telefono: String(form.clienteTelefono || "").trim(),
      email: form.clienteEmail || null,
    },
    entrega: {
      tipoEntrega,
      destinatario: String(form.destinatarioNombre || "").trim(),
      telefonoDestino: String(form.telefonoDestino || "").trim() || String(form.clienteTelefono || "").trim() || null,
      direccion: tipoEntrega === "recogida_en_tienda" ? "Recoger En Tienda" : String(form.direccion || "").trim(),
      barrioNombre: barrioSeleccionado,
      costoDomicilio: domicilioCobrado,
      domicilio: domicilioCobrado,
      domicilioOriginal,
      domicilioObsequiado,
      domicilio_obsequiado: domicilioObsequiado,
      omitirCostoDomicilio: domicilioObsequiado,
      omitir_costo_domicilio: domicilioObsequiado,
      fechaEntrega: `${form.fechaEntrega}T${horaEntrega}:00`,
      rangoHora: horaEntrega,
      mensaje: mensajeTarjeta,
      mensaje_tarjeta: mensajeTarjeta,
      firma: firmaTarjeta,
      firma_tarjeta: firmaTarjeta,
      observacionGeneral: observacionesEntrega,
      observaciones_entrega: observacionesEntrega,
    },
    financiero: {
      metodosPago: form.metodoPago ? [form.metodoPago] : null,
      metodoPago: form.metodoPago || null,
      canalFlora: form.canalFlora || null,
      domicilio: domicilioCobrado,
      domicilioOriginal,
      descuentoDomicilio: domicilioObsequiado ? domicilioOriginal : 0,
      domicilioObsequiado,
      domicilio_obsequiado: domicilioObsequiado,
      omitirCostoDomicilio: domicilioObsequiado,
      omitir_costo_domicilio: domicilioObsequiado,
    },
  };
}

export function buildDuplicateCheckoutPayload({
  detalle,
  empresaId,
  sucursalId,
  edit,
}) {
  const productos = Array.isArray(detalle?.productos) ? detalle.productos : [];
  if (!productos.length) {
    throw new Error("El pedido original no tiene productos para duplicar.");
  }

  const fechaEntrega = edit.fechaEntrega || toDateInput(detalle?.destinatario?.fechaEntrega);
  if (!fechaEntrega) {
    throw new Error("Debes definir la fecha de entrega antes de duplicar.");
  }

  const horaEntrega = normalizeTime(edit.horaEntrega || detalle?.destinatario?.horaEntrega) || "00:00";
  const barrioSeleccionado = String(edit.barrioNombre || detalle?.destinatario?.barrio || "").trim() || null;
  const tipoEntrega = normalizeDeliveryType(barrioSeleccionado);
  const domicilioObsequiado = tipoEntrega !== "recogida_en_tienda" && Boolean(edit.domicilioObsequiado);
  const notaProduccion = textOrNull(
    edit.nota_produccion,
    edit.notaProduccion,
    edit.productoObservaciones,
    detalle?.nota_produccion,
    detalle?.notaProduccion,
    detalle?.observacionesinternas,
    detalle?.produccion?.observacionesinternas
  );
  const mensajeTarjeta = textOrNull(edit.mensaje_tarjeta, edit.mensajeTarjeta);
  const firmaTarjeta = textOrNull(edit.firma_tarjeta, edit.firma);
  const observacionesEntrega = textOrNull(edit.observaciones_entrega, edit.observacionGeneral);

  return {
    empresaID: empresaId,
    sucursalID: Number(detalle?.sucursalID || sucursalId),
    productos: productos.map((item, index) => ({
      productoID: index === 0 && edit.productoID ? Number(edit.productoID) : Number(item.productoID),
      cantidad: index === 0 ? Number(edit.cantidad || item.cantidad || 1) : Number(item.cantidad || 1),
      nota_produccion: index === 0 ? notaProduccion : textOrNull(item?.nota_produccion, item?.notaProduccion, item?.observacionesinternas, item?.produccion?.observacionesinternas, item?.notas),
    })),
    nota_produccion: notaProduccion,
    mensaje_tarjeta: mensajeTarjeta,
    firma_tarjeta: firmaTarjeta,
    observaciones_entrega: observacionesEntrega,
    cliente: {
      tipoIdent: edit.clienteTipoIdent || null,
      identificacion: edit.clienteIdentificacion || null,
      indicativo: extractIndicativo(detalle?.cliente?.telefonoCompleto),
      nombreCompleto: String(detalle?.cliente?.nombre || "").trim(),
      telefono: String(detalle?.cliente?.telefono || "").trim(),
      email: detalle?.cliente?.email || null,
    },
    entrega: {
      tipoEntrega,
      destinatario: edit.destinatarioNombre || detalle?.destinatario?.nombre || null,
      telefonoDestino: edit.telefonoDestino || detalle?.destinatario?.telefono || null,
      direccion: edit.direccion || detalle?.destinatario?.direccion || "",
      barrioNombre: barrioSeleccionado,
      domicilioObsequiado,
      omitirCostoDomicilio: domicilioObsequiado,
      latitudDestino: detalle?.destinatario?.latitudDestino ?? null,
      longitudDestino: detalle?.destinatario?.longitudDestino ?? null,
      fechaEntrega: `${fechaEntrega}T${horaEntrega}:00`,
      rangoHora: edit.horaEntrega || null,
      mensaje: mensajeTarjeta,
      mensaje_tarjeta: mensajeTarjeta,
      firma: firmaTarjeta,
      firma_tarjeta: firmaTarjeta,
      observacionGeneral: observacionesEntrega,
      observaciones_entrega: observacionesEntrega,
    },
    financiero: {
      domicilio: domicilioObsequiado ? 0 : null,
      domicilioObsequiado,
      omitirCostoDomicilio: domicilioObsequiado,
    },
  };
}

export function buildDetailUpdatePayload({
  pedidoId,
  detalle,
  edit,
  paymentValidation,
  canalFlora,
  canEditClientIdentity,
}) {
  const tipoEntrega = normalizeDeliveryType(edit.barrioNombre);
  const domicilioObsequiado = tipoEntrega !== "recogida_en_tienda" && Boolean(edit.domicilioObsequiado);
  const domicilioOriginal = tipoEntrega === "recogida_en_tienda"
    ? 0
    : normalizeWholePeso(edit.domicilioOriginal ?? edit.costoDomicilio ?? edit.domicilio);
  const notaProduccion = textOrNull(edit.nota_produccion, edit.notaProduccion, edit.productoObservaciones);
  const mensajeTarjeta = textOrNull(edit.mensaje_tarjeta, edit.mensajeTarjeta);
  const firmaTarjeta = textOrNull(edit.firma_tarjeta, edit.firma);
  const observacionesEntrega = textOrNull(edit.observaciones_entrega, edit.observacionGeneral);
  const precioUnitario = edit.isCustomArrangement ? normalizeWholePeso(edit.precio) : null;

  return {
    pedidoId,
    detalleID: edit.detalleID ? Number(edit.detalleID) : null,
    productoID: edit.productoID ? Number(edit.productoID) : null,
    cantidad: Number(edit.cantidad || 1),
    productoObservaciones: notaProduccion,
    nota_produccion: notaProduccion,
    notaProduccion: notaProduccion,
    precioUnitario,
    productoPrecio: precioUnitario,
    fechaEntrega: edit.fechaEntrega,
    horaEntrega: edit.horaEntrega,
    clienteNombre: canEditClientIdentity ? edit.clienteNombre : null,
    clienteTelefono: canEditClientIdentity ? edit.clienteTelefono : null,
    clienteEmail: edit.clienteEmail,
    clienteTipoIdent: edit.clienteTipoIdent,
    clienteIdentificacion: edit.clienteIdentificacion,
    destinatarioNombre: edit.destinatarioNombre,
    telefonoDestino: edit.telefonoDestino,
    direccion: edit.direccion,
    barrioNombre: edit.barrioNombre,
    latitudDestino: detalle?.destinatario?.latitudDestino ?? null,
    longitudDestino: detalle?.destinatario?.longitudDestino ?? null,
    firma: firmaTarjeta,
    firma_tarjeta: firmaTarjeta,
    mensajeTarjeta: mensajeTarjeta,
    mensaje_tarjeta: mensajeTarjeta,
    observacionGeneral: observacionesEntrega,
    observaciones_entrega: observacionesEntrega,
    metodosPago: paymentValidation.methods,
    detallePago: paymentValidation.paymentBreakdown,
    montoEfectivo: paymentValidation.cashAmount,
    omitirRecargoLink: edit.omitirRecargoLink,
    domicilio: domicilioObsequiado ? 0 : domicilioOriginal,
    costoDomicilio: domicilioObsequiado ? 0 : domicilioOriginal,
    domicilioOriginal,
    descuentoDomicilio: domicilioObsequiado ? (domicilioOriginal ?? 0) : 0,
    domicilioObsequiado,
    omitirCostoDomicilio: domicilioObsequiado,
    forzarRecalculoFinanciero: true,
    descuentoMonto: normalizeWholePeso(edit.descuentoMonto) ?? 0,
    descuentoNota: edit.descuentoNota || null,
    saldoFavorMonto: normalizeWholePeso(edit.saldoFavorMonto) ?? 0,
    saldoFavorNota: edit.saldoFavorNota || null,
    canalFlora,
  };
}

export function buildAddDetailProductPayload({
  pedidoId,
  productoID,
  cantidad,
  isCustomArrangement,
  precio,
}) {
  const precioUnitario = isCustomArrangement ? normalizeWholePeso(precio) : null;
  return {
    pedidoId,
    productoID: Number(productoID),
    cantidad: Number(cantidad || 1),
    precioUnitario,
    productoPrecio: precioUnitario,
  };
}
