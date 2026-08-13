import { formatAdjustmentNotesForExport } from "./accountingDomain.js";

export async function exportRowsToExcel(rows, filename, sheetName, onEmpty) {
  if (!Array.isArray(rows) || rows.length === 0) {
    if (typeof onEmpty === "function") onEmpty();
    return;
  }
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function buildSalesExportRows(orderRows) {
  return orderRows.map(row => ({
    Fecha: row.fecha,
    "Pedidos aprobados": row.cantidadPedidos,
    "Pedidos cancelados": row.pedidosCancelados,
    "Total arreglos": row.totalArreglos,
    "Total domicilios": row.totalDomicilios,
    "Recargos link": row.totalRecargos,
    Descuentos: row.totalDescuentos,
    "Saldo a favor": Number(row.totalSaldoFavor || 0),
    "Total venta": row.totalVenta,
  }));
}

export function buildSalesDetailExportRows(rows) {
  return rows.map(row => ({
    Pedido: row.numeroPedido || row.pedidoID,
    "Usuario sistema": row.usuarioSistema || "",
    Cliente: row.cliente || "",
    "Cuenta de pago": row.cuentaPago || "",
    Estado: row.cancelado ? "Cancelado" : row.estado || "",
    "Saldo a favor": Number(row.saldoFavorMonto || 0),
    "Nota saldo a favor": row.saldoFavorNota || "",
    "Descuento aplicado": row.descuentoMonto || 0,
    "Nota descuento": row.descuentoNota || "",
    "Notas descuentos/saldos a favor": formatAdjustmentNotesForExport(row),
    "Nota cancelacion": row.notaCancelacion || "",
  }));
}

export function buildArrangementExportRows(rows) {
  return rows.map(item => ({
    Codigo: item.codigo || "",
    Arreglo: item.nombre,
    "Unidades vendidas": item.unidades,
    Pedidos: item.pedidos,
    "Total vendido": item.totalVendido,
  }));
}

export function buildPaymentAccountExportRows(rows) {
  return rows.map(item => ({
    "Cuenta o medio": item.cuenta,
    Pedidos: item.pedidos,
    "Metodos usados": Array.isArray(item.metodos) ? item.metodos.join(", ") : "",
    "Total recaudado": item.totalRecaudado,
    "Promedio por pedido": item.promedioPedido,
    "Participacion %": item.participacionPct,
    "Ultimo movimiento": item.ultimoMovimiento,
  }));
}

export function buildPersonnelExportRows(floristMetricRows, deliveryPersonMetricRows) {
  return [
    ...floristMetricRows.map(item => ({
      Tipo: "Florista",
      Nombre: item.nombre,
      Pedidos: item.pedidos,
      Arreglos: item.arreglos,
      Entregas: "",
      "Total asociado": item.totalVendido,
      Promedio: item.promedio,
      Completados: item.completados,
      "En proceso": item.enProceso,
      Pendientes: item.pendientes,
      Cancelados: item.cancelados,
      Reprogramadas: "",
      "Tiempo promedio min": item.tiempoPromedioMin,
      Reasignaciones: item.reasignaciones,
      Barrios: "",
    })),
    ...deliveryPersonMetricRows.map(item => ({
      Tipo: "Domiciliario",
      Nombre: item.nombre,
      Pedidos: item.pedidos,
      Arreglos: "",
      Entregas: item.entregas,
      "Total asociado": item.totalDomicilios,
      Promedio: item.promedio,
      Completados: item.completados,
      "En proceso": item.enProceso,
      Pendientes: item.pendientes,
      Cancelados: item.cancelados,
      Reprogramadas: item.reprogramadas,
      "Tiempo promedio min": "",
      Reasignaciones: "",
      Barrios: Array.isArray(item.barrios) ? item.barrios.map(barrio => `${barrio.nombre} (${barrio.entregas})`).join(", ") : "",
    })),
  ];
}

export function buildCashExportRows(rows) {
  return rows.map(row => ({
    Fecha: row.fecha,
    Base: row.base,
    Efectivo: row.efectivo,
    Gasto: row.gasto,
    TotalEfectivo: row.totalEfectivo,
    Guardado: row.guardado,
    NuevaBase: row.nuevaBase,
    Observacion: row.observacion,
  }));
}

function formatDeliveryOrderNumberForExport(item) {
  const value = item?.numeroPedido || item?.pedidoID || "";
  return String(value).replace(/^FLR-/i, "") || "";
}

function formatDeliveryStatusForExport(value) {
  const status = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (status === "NO_ENTREGADO" || status === "NO_ENTREGADA") return "No entregado";
  if (status === "ENTREGADO" || status === "ENTREGADA") return "Entregado";
  if (status === "REPROGRAMADO" || status === "REPROGRAMADA") return "Reprogramado";
  return value || "";
}

export function buildDeliveryPersonOrdersExportRows(rows) {
  return rows.map(item => ({
    Pedido: formatDeliveryOrderNumberForExport(item),
    "Fecha entrega": item.fechaEntrega || "",
    Cliente: item.cliente || "",
    Telefono: item.telefono || "",
    Barrio: item.barrio || "",
    Zona: item.zona || "",
    "Estado pedido": item.estadoPedido || "",
    "Estado entrega": formatDeliveryStatusForExport(item.estadoEntrega),
    "Valor domicilio": Number(item.valorDomicilio || 0),
    "Total pedido": Number(item.totalPedido || 0),
    "Medio pago": item.medioPago || "",
    "Cuenta pago": item.cuentaPago || "",
    "Hora asignacion": item.horaAsignacion || "",
    "Hora en ruta": item.horaEnRuta || "",
    "Hora entrega": item.horaEntrega || "",
    "Tiempo entrega min": item.tiempoEntregaMin ?? "",
    Observaciones: item.observaciones || "",
  }));
}
