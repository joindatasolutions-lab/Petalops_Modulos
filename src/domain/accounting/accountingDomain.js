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