import { normalizeStatus, splitDateTimeParts } from "../../shared/utils.js";
import { getAdjustmentNoteItems, roundMoney } from "./accountingDomain.js";

function isApprovedOrder(row) {
  return normalizeStatus(row?.estado) === "APROBADO" && !row?.cancelado;
}

function getAccountingDetailDate(row) {
  const dateValue = row?.fecha || row?.fechaPedido || row?.fecha_pedido || row?.fechaOperacion || row?.fecha_operacion;
  return splitDateTimeParts(dateValue).date || String(dateValue || "").slice(0, 10);
}

export function applyApprovedOrderCountsToRows(orderRows, accountingDetailRows) {
  const rows = Array.isArray(orderRows) ? orderRows : [];
  const details = Array.isArray(accountingDetailRows) ? accountingDetailRows : [];
  if (details.length === 0) {
    return rows.map(row => ({
      ...row,
      cantidadPedidos: Math.max(0, Number(row.cantidadPedidos || 0) - Number(row.pedidosCancelados || 0)),
    }));
  }

  const approvedByDate = details.reduce((map, row) => {
    if (!isApprovedOrder(row)) return map;
    const fecha = getAccountingDetailDate(row);
    if (!fecha) return map;
    map.set(fecha, (map.get(fecha) || 0) + 1);
    return map;
  }, new Map());

  return rows.map(row => ({
    ...row,
    cantidadPedidos: approvedByDate.get(String(row.fecha || "").slice(0, 10)) || 0,
  }));
}

export function buildSummaryTotals(orderRows, accountingDetailRows) {
  const totals = orderRows.reduce((acc, row) => ({
    cantidadPedidos: acc.cantidadPedidos + Number(row.cantidadPedidos || 0),
    pedidosCancelados: acc.pedidosCancelados + Number(row.pedidosCancelados || 0),
    totalArreglos: acc.totalArreglos + Number(row.totalArreglos || 0),
    totalDomicilios: acc.totalDomicilios + Number(row.totalDomicilios || 0),
    totalVenta: acc.totalVenta + Number(row.totalVenta || 0),
    totalEfectivo: acc.totalEfectivo + Number(row.totalEfectivo || 0),
    totalRecargos: acc.totalRecargos + Number(row.totalRecargos || 0),
    totalDescuentos: acc.totalDescuentos + Number(row.totalDescuentos || 0),
    totalSaldoFavor: acc.totalSaldoFavor + Number(row.totalSaldoFavor || 0),
  }), {
    cantidadPedidos: 0,
    pedidosCancelados: 0,
    totalArreglos: 0,
    totalDomicilios: 0,
    totalVenta: 0,
    totalEfectivo: 0,
    totalRecargos: 0,
    totalDescuentos: 0,
    totalSaldoFavor: 0,
  });

  if (!accountingDetailRows.length) {
    return {
      ...totals,
      cantidadPedidos: Math.max(0, totals.cantidadPedidos - totals.pedidosCancelados),
    };
  }

  const pedidosAprobados = accountingDetailRows.filter(isApprovedOrder).length;
  const pedidosCancelados = accountingDetailRows.filter(row => (
    Boolean(row.cancelado) || ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(row.estado))
  )).length;

  return {
    ...totals,
    cantidadPedidos: pedidosAprobados,
    pedidosCancelados,
  };
}

export function buildDetailInsight(accountingDetailRows) {
  const pedidosConDescuento = accountingDetailRows.filter(row => Number(row.descuentoMonto || 0) > 0);
  const pedidosConSaldo = accountingDetailRows.filter(row => Number(row.saldoFavorMonto || 0) > 0);
  const pedidosConNotas = accountingDetailRows.filter(row => getAdjustmentNoteItems(row).length > 0);
  const cancelados = accountingDetailRows.filter(row => (
    Boolean(row.cancelado) || ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(row.estado))
  ));
  const cuentaRows = accountingDetailRows.reduce((map, row) => {
    const cuenta = String(row.cuentaPago || "Sin especificar").trim() || "Sin especificar";
    const current = map.get(cuenta) || { cuenta, pedidos: 0, totalVenta: 0 };
    current.pedidos += 1;
    current.totalVenta += Number(row.totalVenta || 0);
    map.set(cuenta, current);
    return map;
  }, new Map());
  const cuentasPago = Array.from(cuentaRows.values()).sort((a, b) => b.pedidos - a.pedidos || b.totalVenta - a.totalVenta);
  const totalDescuentos = pedidosConDescuento.reduce((sum, row) => sum + Number(row.descuentoMonto || 0), 0);
  const totalSaldoFavor = pedidosConSaldo.reduce((sum, row) => sum + Number(row.saldoFavorMonto || 0), 0);

  return {
    pedidosConDescuento: pedidosConDescuento.length,
    pedidosConSaldo: pedidosConSaldo.length,
    pedidosConNotas: pedidosConNotas.length,
    cancelados: cancelados.length,
    totalDescuentos: roundMoney(totalDescuentos),
    totalSaldoFavor: roundMoney(totalSaldoFavor),
    cuentasPago: cuentasPago.length,
    cuentaPrincipal: cuentasPago[0] || null,
    topDescuento: [...pedidosConDescuento].sort((a, b) => Number(b.descuentoMonto || 0) - Number(a.descuentoMonto || 0))[0] || null,
    topSaldo: [...pedidosConSaldo].sort((a, b) => Number(b.saldoFavorMonto || 0) - Number(a.saldoFavorMonto || 0))[0] || null,
  };
}

export function buildDetailChartRows(detailInsight) {
  return [
    { key: "descuentos", label: "Descuentos", value: detailInsight.totalDescuentos },
    { key: "saldo", label: "Saldo a favor", value: detailInsight.totalSaldoFavor },
    { key: "cancelados", label: "Cancelados", value: detailInsight.cancelados },
    { key: "notas", label: "Con notas", value: detailInsight.pedidosConNotas },
  ];
}

export function buildArrangementSummary(selectedArrangementRows) {
  const pedidos = new Set();
  const totals = selectedArrangementRows.reduce((acc, item) => {
    (Array.isArray(item.pedidoIDs) ? item.pedidoIDs : []).forEach(id => pedidos.add(id));
    return {
      arreglosSeleccionados: acc.arreglosSeleccionados + 1,
      unidadesVendidas: acc.unidadesVendidas + Number(item.unidades || 0),
      totalVendido: acc.totalVendido + Number(item.totalVendido || 0),
    };
  }, {
    arreglosSeleccionados: 0,
    unidadesVendidas: 0,
    totalVendido: 0,
  });
  return {
    ...totals,
    pedidosImpactados: pedidos.size,
  };
}

export function buildPaymentSummary(paymentAccountRows) {
  return paymentAccountRows.reduce((acc, item) => ({
    cuentas: acc.cuentas + 1,
    pedidos: acc.pedidos + Number(item.pedidos || 0),
    recaudo: acc.recaudo + Number(item.totalRecaudado || 0),
  }), { cuentas: 0, pedidos: 0, recaudo: 0 });
}

export function buildPersonnelSummary(floristMetricRows, deliveryPersonMetricRows) {
  const floristTotals = floristMetricRows.reduce((acc, item) => ({
    personas: acc.personas + 1,
    pedidos: acc.pedidos + Number(item.pedidos || 0),
    arreglos: acc.arreglos + Number(item.arreglos || 0),
    totalVendido: acc.totalVendido + Number(item.totalVendido || 0),
    completados: acc.completados + Number(item.completados || 0),
    cancelados: acc.cancelados + Number(item.cancelados || 0),
  }), { personas: 0, pedidos: 0, arreglos: 0, totalVendido: 0, completados: 0, cancelados: 0 });
  const deliveryTotals = deliveryPersonMetricRows.reduce((acc, item) => ({
    personas: acc.personas + 1,
    pedidos: acc.pedidos + Number(item.pedidos || 0),
    entregas: acc.entregas + Number(item.entregas || 0),
    totalDomicilios: acc.totalDomicilios + Number(item.totalDomicilios || 0),
    completados: acc.completados + Number(item.completados || 0),
    cancelados: acc.cancelados + Number(item.cancelados || 0),
    reprogramadas: acc.reprogramadas + Number(item.reprogramadas || 0),
  }), { personas: 0, pedidos: 0, entregas: 0, totalDomicilios: 0, completados: 0, cancelados: 0, reprogramadas: 0 });

  return {
    floristas: {
      ...floristTotals,
      totalVendido: roundMoney(floristTotals.totalVendido),
      promedioArreglo: floristTotals.arreglos > 0 ? roundMoney(floristTotals.totalVendido / floristTotals.arreglos) : 0,
      lider: floristMetricRows[0] || null,
    },
    domiciliarios: {
      ...deliveryTotals,
      totalDomicilios: roundMoney(deliveryTotals.totalDomicilios),
      promedioEntrega: deliveryTotals.entregas > 0 ? roundMoney(deliveryTotals.totalDomicilios / deliveryTotals.entregas) : 0,
      lider: deliveryPersonMetricRows[0] || null,
    },
  };
}
