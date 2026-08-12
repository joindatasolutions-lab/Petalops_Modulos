import { normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
export function getAdjustmentNoteItems(row) {
  const items = [];
  const saldoNota = String(row?.saldoFavorNota || "").trim();
  const descuentoNota = String(row?.descuentoNota || "").trim();
  if (saldoNota) {
    items.push({
      label: "Saldo a favor",
      value: Number(row?.saldoFavorMonto || 0),
      note: saldoNota,
    });
  }
  if (descuentoNota) {
    items.push({
      label: "Descuento",
      value: Number(row?.descuentoMonto || 0),
      note: descuentoNota,
    });
  }
  return items;
}
export function filterAccountingDetailRows(rows, detailFilter = "todos") {
  return (Array.isArray(rows) ? rows : []).filter(row => {
    if (detailFilter === "descuento") return Number(row.descuentoMonto || 0) > 0;
    if (detailFilter === "saldo") return Number(row.saldoFavorMonto || 0) > 0;
    if (detailFilter === "cancelados") return Boolean(row.cancelado) || ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(row.estado));
    if (detailFilter === "conNotas") return getAdjustmentNoteItems(row).length > 0;
    return true;
  });
}
export function formatAdjustmentNotesForExport(row) {
  const items = getAdjustmentNoteItems(row);
  if (items.length === 0) return "";
  return items.map(item => item.note).join(" | ");
}
export async function fetchOrdersForAccounting({ api, empresaId, sucursalId, fechaDesde, fechaHasta }) {
  const pageSize = 100;
  let page = 1;
  let rows = [];
  let total = 0;
  do {
    const data = await api.listarPedidos({
      empresaId,
      sucursalId,
      q: "",
      estado: "",
      fechaDesde: toIsoDateStart(fechaDesde),
      fechaHasta: toIsoDateEnd(fechaHasta),
      page,
      pageSize,
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    total = Number(data?.total || items.length);
    rows = rows.concat(items);
    page += 1;
  } while (rows.length < total);
  return rows;
}
export function buildAccountingRows(items) {
  const grouped = new Map();
  for (const item of items) {
    const fecha = splitDateTimeParts(item?.order?.fechaPedido || item?.order?.fecha).date || "Sin fecha";
    const current = grouped.get(fecha) || {
      fecha,
      cantidadPedidos: 0,
      pedidosCancelados: 0,
      totalArreglos: 0,
      totalDomicilios: 0,
      totalRecargos: 0,
      totalDescuentos: 0,
      totalSaldoFavor: 0,
      totalVenta: 0,
      totalEfectivo: 0,
    };
    const financiero = item?.detail?.financiero || {};
    const domicilio = roundMoney(financiero?.domicilio);
    const total = roundMoney(financiero?.total ?? item?.order?.total);
    const arreglos = roundMoney((financiero?.subtotal ?? 0) + (financiero?.iva ?? 0));
    const recargos = roundMoney(financiero?.recargoLinkMonto ?? 0);
    const descuentos = roundMoney(financiero?.descuentoMonto ?? 0);
    const saldoFavor = roundMoney(financiero?.saldoFavorMonto ?? financiero?.saldoFavor ?? financiero?.saldoAFavor ?? 0);
    const status = normalizeStatus(item?.order?.estado || item?.detail?.estado);
    if (status === "APROBADO") current.cantidadPedidos += 1;
    if (status === "CANCELADO" || status === "RECHAZADO") current.pedidosCancelados += 1;
    current.totalArreglos += arreglos;
    current.totalDomicilios += domicilio;
    current.totalRecargos += recargos;
    current.totalDescuentos += descuentos;
    current.totalSaldoFavor += saldoFavor;
    current.totalVenta += total;
    current.totalEfectivo += extractCashAmount(financiero, total);
    grouped.set(fecha, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
export function buildArrangementRows(items) {
  const grouped = new Map();
  for (const item of items) {
    const pedidoId = Number(item?.order?.pedidoID || item?.detail?.pedidoID || 0);
    const productos = Array.isArray(item?.detail?.productos) ? item.detail.productos : [];
    for (const producto of productos) {
      const codigo = String(producto?.codigoProducto || "").trim();
      const nombre = String(producto?.nombreProducto || "Arreglo").trim() || "Arreglo";
      const productoId = Number(producto?.productoID || 0);
      const key = `${productoId || "na"}::${codigo || "sin-codigo"}::${nombre}`;
      const current = grouped.get(key) || {
        key,
        productoId: productoId || null,
        codigo: codigo || null,
        nombre,
        unidades: 0,
        pedidosIds: new Set(),
        totalVendido: 0,
      };
      current.unidades += Number(producto?.cantidad || 0);
      if (pedidoId) current.pedidosIds.add(pedidoId);
      current.totalVendido += Number(producto?.subtotal || 0);
      grouped.set(key, current);
    }
  }
  return Array.from(grouped.values())
    .map(item => ({
      key: item.key,
      productoId: item.productoId,
      codigo: item.codigo,
      nombre: item.nombre,
      unidades: roundMoney(item.unidades),
      pedidos: item.pedidosIds.size,
      pedidoIDs: Array.from(item.pedidosIds),
      totalVendido: roundMoney(item.totalVendido),
    }))
    .sort((a, b) => {
      if (b.unidades !== a.unidades) return b.unidades - a.unidades;
      if (b.totalVendido !== a.totalVendido) return b.totalVendido - a.totalVendido;
      return a.nombre.localeCompare(b.nombre);
    });
}
export function buildPaymentAccountRows(items) {
  const grouped = new Map();
  let totalGlobal = 0;
  for (const item of items) {
    const pedidoId = Number(item?.order?.pedidoID || item?.detail?.pedidoID || 0);
    const fecha = splitDateTimeParts(item?.order?.fechaPedido || item?.order?.fecha).date || "";
    const financiero = item?.detail?.financiero || {};
    const entries = extractPaymentEntries(financiero);
    for (const entry of entries) {
      const cuenta = entry.cuenta;
      const key = cuenta.toLowerCase();
      const current = grouped.get(key) || {
        key,
        cuenta,
        pedidosSet: new Set(),
        metodosSet: new Set(),
        totalRecaudado: 0,
        ultimoMovimiento: "",
      };
      if (pedidoId) current.pedidosSet.add(pedidoId);
      if (entry.metodo) current.metodosSet.add(entry.metodo);
      current.totalRecaudado += Number(entry.monto || 0);
      if (fecha && (!current.ultimoMovimiento || fecha > current.ultimoMovimiento)) current.ultimoMovimiento = fecha;
      grouped.set(key, current);
      totalGlobal += Number(entry.monto || 0);
    }
  }
  return Array.from(grouped.values())
    .map(item => {
      const pedidos = item.pedidosSet.size;
      return {
        key: item.key,
        cuenta: item.cuenta,
        pedidos,
        metodos: Array.from(item.metodosSet),
        totalRecaudado: roundMoney(item.totalRecaudado),
        promedioPedido: pedidos > 0 ? roundMoney(item.totalRecaudado / pedidos) : 0,
        participacionPct: totalGlobal > 0 ? roundMoney((item.totalRecaudado / totalGlobal) * 100) : 0,
        ultimoMovimiento: item.ultimoMovimiento || "-",
      };
    })
    .sort((a, b) => {
      if (b.totalRecaudado !== a.totalRecaudado) return b.totalRecaudado - a.totalRecaudado;
      if (b.pedidos !== a.pedidos) return b.pedidos - a.pedidos;
      return a.cuenta.localeCompare(b.cuenta);
    });
}
function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}
function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}
function uniqueCount(values) {
  return new Set(values.filter(Boolean).map(value => String(value))).size;
}
function normalizeLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
function statusBucket(value, fallbackCancelado = false) {
  const status = normalizeStatus(value);
  if (fallbackCancelado || status === "CANCELADO" || status === "RECHAZADO") return "cancelados";
  if (["LISTO", "ENTREGADO", "COMPLETADO", "FINALIZADO", "APROBADO"].includes(status)) return "completados";
  if (["EN_PROCESO", "EN_PRODUCCION", "EN_RUTA", "ASIGNADO"].includes(status)) return "enProceso";
  return "pendientes";
}
export function normalizePersonnelMetricRow(raw, type = "florista") {
  if (!raw || typeof raw !== "object") return null;
  const isFlorist = type === "florista";
  const id = firstNumber(
    raw.id,
    raw.empleadoID,
    raw.empleadoId,
    raw.empleado_id,
    isFlorist ? raw.floristaID : raw.domiciliarioID,
    isFlorist ? raw.floristaId : raw.domiciliarioId,
    isFlorist ? raw.florista_id : raw.domiciliario_id
  );
  const nombre = firstText(
    raw.nombre,
    raw.nombreEmpleado,
    raw.nombre_empleado,
    raw.empleado,
    isFlorist ? raw.florista : raw.domiciliario,
    isFlorist ? raw.nombreFlorista : raw.nombreDomiciliario,
    isFlorist ? raw.floristaNombre : raw.domiciliarioNombre
  ) || (isFlorist ? "Sin florista" : "Sin domiciliario");
  const pedidos = Number(raw.pedidos ?? raw.cantidadPedidos ?? raw.cantidad_pedidos ?? raw.total ?? raw.asignados ?? 0);
  const arreglos = Number(raw.arreglos ?? raw.unidades ?? raw.unidadesVendidas ?? raw.producciones ?? 0);
  const entregas = Number(raw.entregas ?? raw.cantidadEntregas ?? raw.cantidad_entregas ?? raw.total ?? raw.asignados ?? raw.entregados ?? 0);
  const completados = Number(raw.completados ?? raw.listo ?? raw.listos ?? raw.entregadas ?? raw.entregados ?? 0);
  const pendientes = Number(raw.pendientes ?? raw.pendiente ?? 0);
  const enProceso = Number(raw.enProceso ?? raw.en_proceso ?? raw.enRuta ?? raw.en_ruta ?? 0);
  const cancelados = Number(raw.cancelados ?? raw.cancelado ?? raw.noEntregadas ?? raw.noEntregados ?? raw.no_entregadas ?? raw.no_entregados ?? 0);
  const reprogramadas = Number(raw.reprogramadas ?? raw.reprogramados ?? 0);
  const reasignaciones = Number(raw.reasignaciones ?? raw.reasignados ?? 0);
  const totalVendido = roundMoney(raw.totalVendido ?? raw.total_vendido ?? raw.venta ?? raw.totalVenta ?? raw.total_venta ?? 0);
  const totalDomicilios = roundMoney(raw.totalDomicilios ?? raw.total_domicilios ?? raw.domicilios ?? raw.totalDomicilio ?? raw.costoDomicilioTotal ?? raw.costo_domicilio_total ?? raw.costoTotal ?? 0);
  const tiempoPromedioMin = roundMoney(raw.tiempoPromedioMin ?? raw.tiempo_promedio_min ?? raw.tiempoPromedio ?? 0);
  const tipo = firstText(raw.tipo, raw.tipoEmpleado, raw.tipo_empleado, raw.categoria, raw.modalidad) || "Sin tipo";
  const promedio = isFlorist
    ? (arreglos > 0 ? roundMoney(totalVendido / arreglos) : 0)
    : (entregas > 0 ? roundMoney(totalDomicilios / entregas) : 0);
  return {
    key: `${type}-${id || nombre.toLowerCase()}`,
    id: id || null,
    nombre,
    pedidos,
    arreglos,
    entregas,
    completados,
    pendientes,
    enProceso,
    cancelados,
    reprogramadas,
    reasignaciones,
    totalVendido,
    totalDomicilios,
    tiempoPromedioMin,
    promedio,
    tipo,
    barrios: Array.isArray(raw.barrios) ? raw.barrios : [],
  };
}
export function buildFloristMetricRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => normalizePersonnelMetricRow(row, "florista"))
    .filter(Boolean)
    .sort((a, b) => b.totalVendido - a.totalVendido || b.arreglos - a.arreglos || a.nombre.localeCompare(b.nombre));
}
export function buildFloristMetricRowsFromProductionItems(rows) {
  const grouped = new Map();
  for (const item of Array.isArray(rows) ? rows : []) {
    const id = firstNumber(
      item?.floristaID,
      item?.floristaId,
      item?.florista_id,
      item?.empleadoID,
      item?.empleadoId,
      item?.empleado_id,
      item?.idFlorista,
      item?.florista?.idFlorista,
      item?.florista?.id,
      item?.empleado?.id
    );
    const nombre = firstText(
      item?.floristaAsignado,
      item?.floristaNombre,
      item?.nombreFlorista,
      item?.florista,
      item?.nombre_florista,
      item?.empleado,
      item?.florista?.nombre,
      item?.empleado?.nombre
    );
    if (!id && !nombre) continue;
    const key = `florista-${id || normalizeLookupKey(nombre)}`;
    const current = grouped.get(key) || {
      key,
      id: id || null,
      nombre: nombre || "Sin florista",
      pedidoIds: [],
      arreglos: 0,
      totalVendido: 0,
      completados: 0,
      pendientes: 0,
      enProceso: 0,
      cancelados: 0,
      tiempoTotalMin: 0,
      tiempoConteo: 0,
      reasignaciones: 0,
      tipo: firstText(item?.tipoFlorista, item?.floristaTipo, item?.florista?.tipo) || "Sin tipo",
    };
    current.id = current.id || id || null;
    current.nombre = current.nombre === "Sin florista" && nombre ? nombre : current.nombre;
    current.pedidoIds.push(firstText(item?.pedidoID, item?.pedidoId, item?.idPedido, item?.numeroPedido, item?.codigoPedido));
    current.arreglos += Number(item?.cantidad ?? item?.unidades ?? item?.cantidadProductos ?? 1);
    current.totalVendido += Number(item?.totalVendido ?? item?.totalVenta ?? item?.subtotal ?? item?.valor ?? item?.precio ?? 0);
    current[statusBucket(item?.estadoProduccion || item?.estado_produccion || item?.estado)] += 1;
    const tiempo = Number(item?.tiempoRealMin ?? item?.tiempo_real_min ?? item?.tiempoProduccionMin ?? item?.tiempo_produccion_min ?? 0);
    if (Number.isFinite(tiempo) && tiempo > 0) {
      current.tiempoTotalMin += tiempo;
      current.tiempoConteo += 1;
    }
    current.reasignaciones += Number(item?.reasignaciones ?? item?.reasignados ?? 0);
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).map(item => ({
    key: item.key,
    id: item.id,
    nombre: item.nombre,
    pedidos: uniqueCount(item.pedidoIds),
    arreglos: roundMoney(item.arreglos),
    totalVendido: roundMoney(item.totalVendido),
    completados: item.completados,
    pendientes: item.pendientes,
    enProceso: item.enProceso,
    cancelados: item.cancelados,
    reasignaciones: item.reasignaciones,
    tiempoPromedioMin: item.tiempoConteo > 0 ? roundMoney(item.tiempoTotalMin / item.tiempoConteo) : 0,
    promedio: item.arreglos > 0 ? roundMoney(item.totalVendido / item.arreglos) : 0,
    tipo: item.tipo,
  })).sort((a, b) => b.arreglos - a.arreglos || b.totalVendido - a.totalVendido || a.nombre.localeCompare(b.nombre));
}
export function enrichFloristMetricRowsWithDirectory(metricRows, directoryRows) {
  const byId = new Map();
  const byName = new Map();
  for (const item of Array.isArray(directoryRows) ? directoryRows : []) {
    const id = firstNumber(
      item?.id,
      item?.idFlorista,
      item?.floristaID,
      item?.floristaId,
      item?.florista_id,
      item?.empleadoID,
      item?.empleadoId,
      item?.empleado_id
    );
    const name = firstText(item?.nombre, item?.nombreFlorista, item?.nombre_florista, item?.nombreEmpleado, item?.nombre_empleado);
    const tipo = firstText(item?.tipo, item?.tipoFlorista, item?.tipo_florista, item?.origen, item?.modalidad);
    const estado = firstText(item?.estado, item?.estadoFlorista, item?.estado_florista);
    const normalized = {
      id: id || null,
      tipo: tipo ? (tipo.toLowerCase().includes("extern") ? "Externo" : tipo.toLowerCase().includes("intern") ? "Interno" : tipo) : "Sin tipo",
      estado,
    };
    if (id) byId.set(Number(id), normalized);
    const nameKey = normalizeLookupKey(name);
    if (nameKey) byName.set(nameKey, normalized);
  }
  return (Array.isArray(metricRows) ? metricRows : []).map(row => {
    const match = (row?.id != null ? byId.get(Number(row.id)) : null) || byName.get(normalizeLookupKey(row?.nombre));
    if (!match) return row;
    return {
      ...row,
      id: row?.id ?? match.id,
      tipo: row?.tipo && row.tipo !== "Sin tipo" ? row.tipo : match.tipo,
      estado: row?.estado || match.estado,
    };
  });
}
export function buildDeliveryPersonMetricRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => normalizePersonnelMetricRow(row, "domiciliario"))
    .filter(Boolean)
    .sort((a, b) => b.totalDomicilios - a.totalDomicilios || b.entregas - a.entregas || a.nombre.localeCompare(b.nombre));
}
export function enrichDeliveryPersonMetricRowsWithDirectory(metricRows, directoryRows) {
  const byId = new Map();
  const byName = new Map();
  for (const item of Array.isArray(directoryRows) ? directoryRows : []) {
    const id = firstNumber(
      item?.id,
      item?.idDomiciliario,
      item?.domiciliarioID,
      item?.domiciliarioId,
      item?.domiciliarioid,
      item?.domiciliario_id,
      item?.id_domiciliario,
      item?.empleadoID,
      item?.empleadoId,
      item?.empleado_id
    );
    const name = firstText(item?.nombre, item?.nombreDomiciliario, item?.nombre_domiciliario, item?.nombreEmpleado, item?.nombre_empleado);
    const tipo = firstText(item?.tipo, item?.tipoDomiciliario, item?.tipo_domiciliario, item?.origen, item?.modalidad);
    if (!tipo) continue;
    const normalized = {
      id: id || null,
      tipo: tipo.toLowerCase().includes("extern") ? "Externo" : tipo.toLowerCase().includes("intern") ? "Interno" : tipo,
    };
    if (id) byId.set(Number(id), normalized);
    const nameKey = normalizeLookupKey(name);
    if (nameKey) byName.set(nameKey, normalized);
  }
  return (Array.isArray(metricRows) ? metricRows : []).map(row => {
    if (row?.tipo && row.tipo !== "Sin tipo") return row;
    const match = (row?.id != null ? byId.get(Number(row.id)) : null) || byName.get(normalizeLookupKey(row?.nombre));
    return match ? { ...row, id: row?.id ?? match.id, tipo: match.tipo } : row;
  });
}
export function buildPersonnelMetricsFromAccountingDetails(rows) {
  const florists = new Map();
  const deliveryPeople = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const pedidoId = firstText(row.pedidoID, row.pedidoId, row.idPedido, row.numeroPedido, row.codigoPedido);
    const isCanceled = Boolean(row.cancelado) || ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(row.estado));
    const totalVenta = roundMoney(row.totalVenta ?? row.total_venta ?? row.total ?? 0);
    const totalArreglos = roundMoney(row.totalArreglos ?? row.total_arreglos ?? row.subtotalArreglos ?? row.subtotal ?? totalVenta);
    const totalDomicilios = roundMoney(row.totalDomicilios ?? row.total_domicilios ?? row.domicilio ?? row.costoDomicilio ?? 0);

    const floristaId = firstNumber(row.floristaID, row.floristaId, row.florista_id, row.empleadoFloristaID, row.produccion?.floristaID, row.produccion?.empleado_id);
    const floristaNombre = firstText(row.floristaAsignado, row.floristaNombre, row.nombreFlorista, row.florista, row.produccion?.floristaAsignado, row.produccion?.nombreFlorista, row.produccion?.empleado);
    if (floristaId || floristaNombre) {
      const key = `florista-${floristaId || floristaNombre.toLowerCase()}`;
      const current = florists.get(key) || {
        key,
        id: floristaId || null,
        nombre: floristaNombre || "Sin florista",
        pedidoIds: [],
        arreglos: 0,
        totalVendido: 0,
        completados: 0,
        pendientes: 0,
        enProceso: 0,
        cancelados: 0,
        tiempoTotalMin: 0,
        tiempoConteo: 0,
        reasignaciones: 0,
        tipo: firstText(row.tipoFlorista, row.floristaTipo, row.produccion?.tipoFlorista, row.produccion?.tipo) || "Sin tipo",
      };
      current.pedidoIds.push(pedidoId);
      current.arreglos += Number(row.arreglos ?? row.unidades ?? row.cantidadProductos ?? 1);
      current.totalVendido += totalArreglos;
      current[statusBucket(row.estadoProduccion || row.estado_produccion || row.produccion?.estado || row.estado, isCanceled)] += 1;
      const tiempo = Number(row.tiempoRealMin ?? row.tiempo_real_min ?? row.produccion?.tiempoRealMin ?? row.produccion?.tiempo_real_min ?? 0);
      if (Number.isFinite(tiempo) && tiempo > 0) {
        current.tiempoTotalMin += tiempo;
        current.tiempoConteo += 1;
      }
      current.reasignaciones += Number(row.reasignaciones ?? row.produccion?.reasignaciones ?? 0);
      florists.set(key, current);
    }

    const domiciliarioId = firstNumber(row.domiciliarioID, row.domiciliarioId, row.domiciliario_id, row.entrega?.domiciliarioID, row.entrega?.domiciliarioid);
    const domiciliarioNombre = firstText(row.domiciliarioNombre, row.nombreDomiciliario, row.domiciliario, row.entrega?.domiciliarioNombre, row.entrega?.domiciliario);
    if (domiciliarioId || domiciliarioNombre) {
      const key = `domiciliario-${domiciliarioId || domiciliarioNombre.toLowerCase()}`;
      const current = deliveryPeople.get(key) || {
        key,
        id: domiciliarioId || null,
        nombre: domiciliarioNombre || "Sin domiciliario",
        pedidoIds: [],
        entregas: 0,
        totalDomicilios: 0,
        completados: 0,
        pendientes: 0,
        enProceso: 0,
        cancelados: 0,
        reprogramadas: 0,
        tipo: firstText(row.tipoDomiciliario, row.domiciliarioTipo, row.entrega?.tipoDomiciliario, row.entrega?.tipoDomiciliarioNombre, row.entrega?.tipo) || "Sin tipo",
        barriosMap: new Map(),
      };
      current.pedidoIds.push(pedidoId);
      current.entregas += 1;
      current.totalDomicilios += totalDomicilios;
      current[statusBucket(row.estadoEntrega || row.estado_entrega || row.entrega?.estado || row.estado, isCanceled)] += 1;
      current.reprogramadas += Number(row.reprogramadas ?? row.entrega?.reprogramadas ?? (row.reprogramadaPara || row.entrega?.reprogramadaPara ? 1 : 0));
      const barrio = firstText(row.barrio, row.barrioNombre, row.entrega?.barrio, row.entrega?.barrioNombre);
      if (barrio) current.barriosMap.set(barrio, (current.barriosMap.get(barrio) || 0) + 1);
      deliveryPeople.set(key, current);
    }
  }

  const floristaRows = Array.from(florists.values()).map(item => ({
    key: item.key,
    id: item.id,
    nombre: item.nombre,
    pedidos: uniqueCount(item.pedidoIds),
    arreglos: roundMoney(item.arreglos),
    totalVendido: roundMoney(item.totalVendido),
    completados: item.completados,
    pendientes: item.pendientes,
    enProceso: item.enProceso,
    cancelados: item.cancelados,
    reasignaciones: item.reasignaciones,
    tiempoPromedioMin: item.tiempoConteo > 0 ? roundMoney(item.tiempoTotalMin / item.tiempoConteo) : 0,
    promedio: item.arreglos > 0 ? roundMoney(item.totalVendido / item.arreglos) : 0,
    tipo: item.tipo,
  })).sort((a, b) => b.totalVendido - a.totalVendido || b.arreglos - a.arreglos || a.nombre.localeCompare(b.nombre));

  const domiciliarioRows = Array.from(deliveryPeople.values()).map(item => ({
    key: item.key,
    id: item.id,
    nombre: item.nombre,
    pedidos: uniqueCount(item.pedidoIds),
    entregas: item.entregas,
    totalDomicilios: roundMoney(item.totalDomicilios),
    completados: item.completados,
    pendientes: item.pendientes,
    enProceso: item.enProceso,
    cancelados: item.cancelados,
    reprogramadas: item.reprogramadas,
    promedio: item.entregas > 0 ? roundMoney(item.totalDomicilios / item.entregas) : 0,
    tipo: item.tipo,
    barrios: Array.from(item.barriosMap.entries()).map(([nombre, entregas]) => ({ nombre, entregas })).sort((a, b) => b.entregas - a.entregas),
  })).sort((a, b) => b.totalDomicilios - a.totalDomicilios || b.entregas - a.entregas || a.nombre.localeCompare(b.nombre));

  return { floristaRows, domiciliarioRows };
}
export function extractPaymentEntries(financiero) {
  const breakdownCandidates = [
    financiero?.detallePago,
    financiero?.desglosePago,
    financiero?.metodosPagoDetalle,
    financiero?.paymentBreakdown,
  ];
  const breakdown = breakdownCandidates.find(Array.isArray) || [];
  if (breakdown.length > 0) {
    return breakdown.map(item => ({
      cuenta: String(item?.metodo || item?.metodoPago || item?.nombre || "Sin especificar").trim() || "Sin especificar",
      metodo: String(item?.metodo || item?.metodoPago || item?.nombre || "Sin especificar").trim() || "Sin especificar",
      monto: Number(item?.monto ?? item?.valor ?? item?.amount ?? 0),
    }));
  }
  const methods = Array.isArray(financiero?.metodosPago)
    ? financiero.metodosPago.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  const total = Number(financiero?.total || 0);
  if (methods.length === 1) {
    return [{
      cuenta: methods[0],
      metodo: methods[0],
      monto: methods[0].toLowerCase().includes("efectivo")
        ? Number(financiero?.montoEfectivo ?? financiero?.efectivoMonto ?? total)
        : total,
    }];
  }
  const metodoPago = String(financiero?.metodoPago || "").trim();
  if (metodoPago) {
    return [{
      cuenta: metodoPago,
      metodo: metodoPago,
      monto: metodoPago.toLowerCase().includes("efectivo")
        ? Number(financiero?.montoEfectivo ?? financiero?.efectivoMonto ?? total)
        : total,
    }];
  }
  return [];
}
export function extractCashAmount(financiero) {
  const entries = extractPaymentEntries(financiero);
  if (entries.length > 0) {
    return roundMoney(entries.reduce((sum, item) => {
      if (!String(item?.metodo || "").trim().toLowerCase().includes("efectivo")) return sum;
      return sum + Number(item?.monto || 0);
    }, 0));
  }
  return 0;
}
export function parseMoneyInput(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
export function formatAccountingLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function getAccountingPeriodRange(preset) {
  const today = new Date();
  const end = formatAccountingLocalDate(today);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    const date = formatAccountingLocalDate(start);
    return { fechaDesde: date, fechaHasta: date };
  }
  if (preset === "7days") start.setDate(start.getDate() - 6);
  if (preset === "30days") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  return {
    fechaDesde: preset === "today" ? end : formatAccountingLocalDate(start),
    fechaHasta: end,
  };
}
export function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
export function normalizeCashSummaryRow(raw, fallbackFecha = "") {
  const rows = Array.isArray(raw?.orderRows)
    ? raw.orderRows
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object"
          ? [raw]
          : [];
  const targetFecha = String(fallbackFecha || "").slice(0, 10);
  const source = rows.find(row => {
    const rowFecha = String(row?.fecha || row?.fechaOperacion || row?.fecha_operacion || "").slice(0, 10);
    return targetFecha && rowFecha === targetFecha;
  }) || (rows.length === 1 ? rows[0] : null);
  if (!source || typeof source !== "object") return null;
  const fecha = String(source.fecha || source.fechaOperacion || source.fecha_operacion || fallbackFecha || "").slice(0, 10);
  const efectivo = roundMoney(
    source.efectivo
    ?? source.efectivoVentas
    ?? source.efectivo_ventas
    ?? source.totalEfectivoVentas
    ?? source.total_efectivo_ventas
    ?? source.totalEfectivo
    ?? source.total_efectivo
  );
  return fecha ? { fecha, efectivo } : null;
}
export function getCashClosingSource(raw) {
  return raw?.item || raw?.data || (Array.isArray(raw?.items) ? raw.items[0] : null) || raw;
}
export function hasCashClosingData(raw) {
  const source = getCashClosingSource(raw);
  if (!source || typeof source !== "object") return false;
  return [
    "base",
    "baseInicial",
    "base_inicial",
    "efectivo",
    "efectivoVentas",
    "efectivo_ventas",
    "gasto",
    "gastos",
    "totalGastos",
    "total_gastos",
    "guardado",
    "montoGuardado",
    "monto_guardado",
    "nuevaBase",
    "nueva_base",
  ].some(key => Object.prototype.hasOwnProperty.call(source, key));
}
export function normalizeCashClosingRow(raw, fallbackFecha = "") {
  const source = getCashClosingSource(raw);
  if (!source || typeof source !== "object") return null;
  const fecha = String(source.fecha || source.fechaOperacion || source.fecha_operacion || fallbackFecha || "").slice(0, 10);
  if (!fecha) return null;
  const base = roundMoney(source.base ?? source.baseInicial ?? source.base_inicial);
  const efectivo = roundMoney(
    source.efectivo
    ?? source.efectivoVentas
    ?? source.efectivo_ventas
    ?? source.totalEfectivoVentas
    ?? source.total_efectivo_ventas
  );
  const gasto = roundMoney(source.gasto ?? source.gastos ?? source.totalGastos ?? source.total_gastos);
  const totalEfectivo = roundMoney(source.totalEfectivo ?? source.total_efectivo ?? (base + efectivo - gasto));
  const guardado = roundMoney(source.guardado ?? source.montoGuardado ?? source.monto_guardado);
  const nuevaBase = roundMoney(source.nuevaBase ?? source.nueva_base);
  const observacion = String(source.observacion ?? "").trim();
  return {
    fecha,
    base,
    efectivo,
    gasto,
    totalEfectivo,
    guardado,
    nuevaBase,
    observacion,
  };
}
