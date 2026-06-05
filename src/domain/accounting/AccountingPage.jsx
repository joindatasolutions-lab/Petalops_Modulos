import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
import { Activity, BadgeDollarSign, BarChart3, Brain, CalendarDays, ChevronDown, CircleAlert, CircleCheck, CreditCard, ListChecks, RefreshCw, Receipt, Sparkles, Wallet } from "lucide-react";

const CASH_CLOSING_STORAGE_KEY = "petalops_accounting_cash_closing";

const ACCOUNTING_VIEWS = [
  { key: "ventas", label: "Ventas" },
  { key: "detalle", label: "Saldos/Desc." },
  { key: "arreglos", label: "Métricas por arreglo" },
  { key: "cuentas", label: "Cuentas de pago" },
  { key: "caja", label: "Caja" },
];

const ACCOUNTING_VIEW_ICONS = {
  ventas: Receipt,
  detalle: ListChecks,
  arreglos: BarChart3,
  cuentas: CreditCard,
  caja: Wallet,
};

const initialFilters = {
  fechaDesde: "",
  fechaHasta: "",
};

const initialCashForm = {
  fecha: "",
  base: "",
  gasto: "",
  guardado: "",
};

export function AccountingPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewContabilidad,
  canViewTrazabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoContabilidad,
  onGoTrazabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [activeView, setActiveView] = useState("ventas");
  const [accountingMenuOpen, setAccountingMenuOpen] = useState(false);
  const accountingMenuRef = useRef(null);
  const [filters, setFilters] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      ...initialFilters,
      fechaDesde: today,
      fechaHasta: today,
    };
  });
  const [cashForm, setCashForm] = useState(() => ({
    ...initialCashForm,
    fecha: new Date().toISOString().slice(0, 10),
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [orderRows, setOrderRows] = useState([]);
  const [arrangementRows, setArrangementRows] = useState([]);
  const [paymentAccountRows, setPaymentAccountRows] = useState([]);
  const [accountingDetailRows, setAccountingDetailRows] = useState([]);
  const [detailFilter, setDetailFilter] = useState("todos");
  const [selectedArrangementKeys, setSelectedArrangementKeys] = useState([]);
  const [cashHistoryVersion, setCashHistoryVersion] = useState(0);

  const loadAccountingData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.obtenerResumenContabilidad({
        empresaId,
        sucursalId,
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
      });
      setOrderRows(Array.isArray(payload?.orderRows) ? payload.orderRows : []);
      setArrangementRows(Array.isArray(payload?.arrangementRows) ? payload.arrangementRows : []);
      setPaymentAccountRows(Array.isArray(payload?.paymentAccountRows) ? payload.paymentAccountRows : []);
      setAccountingDetailRows(Array.isArray(payload?.accountingDetailRows) ? payload.accountingDetailRows : []);
    } catch (nextError) {
      console.error("Error cargando contabilidad:", nextError);
      setOrderRows([]);
      setArrangementRows([]);
      setPaymentAccountRows([]);
      setAccountingDetailRows([]);
      setError(nextError?.message || "No fue posible cargar el modulo de contabilidad.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, sucursalId, filters.fechaDesde, filters.fechaHasta]);

  useEffect(() => {
    loadAccountingData();
  }, [loadAccountingData]);

  useEffect(() => {
    const saved = readCashClosing(empresaId, sucursalId, cashForm.fecha);
    setCashForm(current => ({
      ...current,
      base: saved?.base ?? "",
      gasto: saved?.gasto ?? "",
      guardado: saved?.guardado ?? "",
    }));
    setInfo("");
  }, [cashForm.fecha, empresaId, sucursalId, cashHistoryVersion]);

  useEffect(() => {
    setSelectedArrangementKeys(arrangementRows.map(item => item.key));
  }, [arrangementRows]);

  useEffect(() => {
    if (!accountingMenuOpen) return undefined;
    const handlePointerDown = event => {
      if (accountingMenuRef.current && !accountingMenuRef.current.contains(event.target)) {
        setAccountingMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountingMenuOpen]);

  const summaryTotals = useMemo(() => {
    return orderRows.reduce((acc, row) => ({
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
  }, [orderRows]);

  const filteredAccountingDetailRows = useMemo(() => {
    return accountingDetailRows.filter(row => {
      if (detailFilter === "descuento") return Number(row.descuentoMonto || 0) > 0;
      if (detailFilter === "saldo") return Number(row.saldoFavorMonto || 0) > 0;
      if (detailFilter === "cancelados") return Boolean(row.cancelado);
      if (detailFilter === "conNotas") {
        return Boolean(String(row.descuentoNota || row.saldoFavorNota || row.observaciones || row.notaCancelacion || "").trim());
      }
      return true;
    });
  }, [accountingDetailRows, detailFilter]);

  const detailInsight = useMemo(() => {
    const pedidosConDescuento = accountingDetailRows.filter(row => Number(row.descuentoMonto || 0) > 0);
    const pedidosConSaldo = accountingDetailRows.filter(row => Number(row.saldoFavorMonto || 0) > 0);
    const pedidosConNotas = accountingDetailRows.filter(row =>
      String(row.descuentoNota || row.saldoFavorNota || row.observaciones || row.notaCancelacion || "").trim()
    );
    const cancelados = accountingDetailRows.filter(row => Boolean(row.cancelado));
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
  }, [accountingDetailRows]);

  const detailChartRows = useMemo(() => ([
    { key: "descuentos", label: "Descuentos", value: detailInsight.totalDescuentos },
    { key: "saldo", label: "Saldo a favor", value: detailInsight.totalSaldoFavor },
    { key: "cancelados", label: "Cancelados", value: detailInsight.cancelados },
    { key: "notas", label: "Con notas", value: detailInsight.pedidosConNotas },
  ]), [detailInsight]);

  const selectedArrangementRows = useMemo(() => {
    const selected = new Set(selectedArrangementKeys);
    return arrangementRows.filter(item => selected.has(item.key));
  }, [arrangementRows, selectedArrangementKeys]);

  const arrangementSummary = useMemo(() => {
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
  }, [selectedArrangementRows]);

  const topArrangementByUnits = selectedArrangementRows[0] || null;
  const topArrangementBySales = useMemo(
    () => [...selectedArrangementRows].sort((a, b) => b.totalVendido - a.totalVendido)[0] || null,
    [selectedArrangementRows]
  );
  const arrangementChartRows = useMemo(() => selectedArrangementRows.slice(0, 8), [selectedArrangementRows]);

  const paymentSummary = useMemo(() => {
    return paymentAccountRows.reduce((acc, item) => ({
      cuentas: acc.cuentas + 1,
      pedidos: acc.pedidos + Number(item.pedidos || 0),
      recaudo: acc.recaudo + Number(item.totalRecaudado || 0),
    }), { cuentas: 0, pedidos: 0, recaudo: 0 });
  }, [paymentAccountRows]);
  const topPaymentAccount = paymentAccountRows[0] || null;

  const executiveMetrics = useMemo(() => {
    const ticketPromedio = summaryTotals.cantidadPedidos > 0
      ? roundMoney(summaryTotals.totalVenta / summaryTotals.cantidadPedidos)
      : 0;
    const cancelacionesPct = summaryTotals.cantidadPedidos > 0
      ? roundMoney((summaryTotals.pedidosCancelados / summaryTotals.cantidadPedidos) * 100)
      : 0;
    return {
      ticketPromedio,
      cancelacionesPct,
      pedidosConDescuento: detailInsight.pedidosConDescuento,
      saldoPendiente: detailInsight.totalSaldoFavor,
      variacionLabel: orderRows.length > 1 ? "Periodo activo" : "Sin comparativo",
      variacionPct: orderRows.length > 1 ? roundMoney((summaryTotals.totalVenta / Math.max(summaryTotals.totalVenta - summaryTotals.totalDescuentos, 1)) * 100 - 100) : 0,
    };
  }, [summaryTotals, detailInsight, orderRows.length]);

  const salesTrendRows = useMemo(() => {
    const maxValue = Math.max(...orderRows.map(row => Number(row.totalVenta || 0)), 0);
    return orderRows.map(row => ({
      key: row.fecha,
      label: row.fecha,
      value: Number(row.totalVenta || 0),
      pedidos: Number(row.cantidadPedidos || 0),
      height: maxValue > 0 ? Math.max((Number(row.totalVenta || 0) / maxValue) * 100, 8) : 0,
    }));
  }, [orderRows]);

  const monthlySalesRows = useMemo(() => {
    const grouped = new Map();
    orderRows.forEach(row => {
      const month = String(row.fecha || "").slice(0, 7) || "Sin mes";
      const current = grouped.get(month) || { key: month, label: month, value: 0, pedidos: 0 };
      current.value += Number(row.totalVenta || 0);
      current.pedidos += Number(row.cantidadPedidos || 0);
      grouped.set(month, current);
    });
    const rows = Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
    const maxValue = Math.max(...rows.map(row => row.value), 0);
    return rows.map(row => ({
      ...row,
      height: maxValue > 0 ? Math.max((row.value / maxValue) * 100, 10) : 0,
    }));
  }, [orderRows]);

  const moneyMapRows = useMemo(() => {
    const rows = [
      { key: "arreglos", label: "Ventas arreglos", value: summaryTotals.totalArreglos, tone: "is-primary" },
      { key: "domicilios", label: "Domicilios", value: summaryTotals.totalDomicilios, tone: "is-blue" },
      { key: "recargos", label: "Recargos", value: summaryTotals.totalRecargos, tone: "is-green" },
      { key: "descuentos", label: "Descuentos", value: summaryTotals.totalDescuentos, tone: "is-orange" },
      { key: "saldo", label: "Saldo a favor", value: summaryTotals.totalSaldoFavor, tone: "is-red" },
    ];
    const total = Math.max(rows.reduce((sum, row) => sum + Math.abs(Number(row.value || 0)), 0), 1);
    return rows.map(row => ({
      ...row,
      pct: roundMoney((Math.abs(Number(row.value || 0)) / total) * 100),
    }));
  }, [summaryTotals]);

  const topClientsRows = useMemo(() => {
    const map = new Map();
    accountingDetailRows.forEach(row => {
      const cliente = String(row.cliente || "Sin cliente").trim() || "Sin cliente";
      const current = map.get(cliente) || { key: cliente, label: cliente, value: 0, pedidos: 0 };
      current.value += Number(row.totalVenta || 0);
      current.pedidos += 1;
      map.set(cliente, current);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value || b.pedidos - a.pedidos).slice(0, 5);
  }, [accountingDetailRows]);

  const topOperatorsRows = useMemo(() => {
    const map = new Map();
    accountingDetailRows.forEach(row => {
      const user = String(row.usuarioSistema || "Sin usuario").trim() || "Sin usuario";
      const current = map.get(user) || { key: user, label: user, value: 0, pedidos: 0 };
      current.value += Number(row.totalVenta || 0);
      current.pedidos += 1;
      map.set(user, current);
    });
    return Array.from(map.values()).sort((a, b) => b.pedidos - a.pedidos || b.value - a.value).slice(0, 5);
  }, [accountingDetailRows]);

  const businessHealthRows = useMemo(() => {
    const cashRatio = summaryTotals.totalVenta > 0 ? (summaryTotals.totalEfectivo / summaryTotals.totalVenta) * 100 : 0;
    const paymentDependency = topPaymentAccount?.participacionPct || 0;
    return [
      { key: "rentabilidad", label: "Rentabilidad", status: summaryTotals.totalVenta >= summaryTotals.totalDescuentos ? "good" : "risk", value: "Controlada" },
      { key: "caja", label: "Flujo de caja", status: cashRatio >= 0 ? "good" : "risk", value: `$${formatearCOP(summaryTotals.totalEfectivo)}` },
      { key: "conversion", label: "Conversion pedidos", status: executiveMetrics.cancelacionesPct <= 5 ? "good" : "warn", value: `${Math.max(0, roundMoney(100 - executiveMetrics.cancelacionesPct))}%` },
      { key: "pagos", label: "Dependencia pago", status: paymentDependency > 60 ? "warn" : "good", value: topPaymentAccount ? `${paymentDependency}%` : "-" },
      { key: "riesgo", label: "Riesgos operativos", status: detailInsight.cancelados > 0 || detailInsight.pedidosConNotas > 0 ? "warn" : "good", value: `${detailInsight.cancelados} canc.` },
    ];
  }, [summaryTotals, topPaymentAccount, executiveMetrics.cancelacionesPct, detailInsight]);

  const autoInsights = useMemo(() => {
    const topArrangement = [...arrangementRows].sort((a, b) => Number(b.totalVendido || 0) - Number(a.totalVendido || 0))[0];
    const arrangementPct = topArrangement && summaryTotals.totalVenta > 0
      ? roundMoney((Number(topArrangement.totalVendido || 0) / summaryTotals.totalVenta) * 100)
      : 0;
    const topAccountPct = topPaymentAccount?.participacionPct || 0;
    const concentrationRows = [...arrangementRows].sort((a, b) => Number(b.totalVendido || 0) - Number(a.totalVendido || 0)).slice(0, 4);
    const concentration = summaryTotals.totalVenta > 0
      ? roundMoney((concentrationRows.reduce((sum, row) => sum + Number(row.totalVendido || 0), 0) / summaryTotals.totalVenta) * 100)
      : 0;
    return [
      topArrangement ? `El arreglo ${topArrangement.nombre} genera el ${arrangementPct}% de las ventas.` : "Aun no hay arreglos vendidos en el periodo.",
      topPaymentAccount ? `${topPaymentAccount.cuenta} representa el ${topAccountPct}% del recaudo.` : "Aun no hay medios de pago dominantes.",
      executiveMetrics.ticketPromedio > 0 ? `El ticket promedio del periodo es $${formatearCOP(executiveMetrics.ticketPromedio)}.` : "Sin ticket promedio disponible.",
      detailInsight.cancelados === 0 ? "No existen cancelaciones en el periodo." : `${detailInsight.cancelados} pedidos presentan cancelacion.`,
      concentration > 0 ? `El ${concentration}% de los ingresos proviene de ${concentrationRows.length} arreglos.` : "Sin concentracion de ingresos para analizar.",
    ];
  }, [arrangementRows, summaryTotals.totalVenta, topPaymentAccount, executiveMetrics.ticketPromedio, detailInsight.cancelados]);

  const baseValue = parseMoneyInput(cashForm.base);
  const gastoValue = parseMoneyInput(cashForm.gasto);
  const guardadoInputValue = parseMoneyInput(cashForm.guardado);
  const efectivoValue = roundMoney(summaryTotals.totalEfectivo);
  const totalEfectivoCaja = roundMoney(baseValue + efectivoValue - gastoValue);
  const guardadoValue = roundMoney(guardadoInputValue);
  const nuevaBaseValue = roundMoney(totalEfectivoCaja - guardadoValue);
  const cashHistoryRows = useMemo(
    () => listCashClosings(empresaId, sucursalId),
    [empresaId, sucursalId, cashHistoryVersion]
  );

  const applyFilter = (field, value) => {
    setFilters(current => ({ ...current, [field]: value }));
  };

  const toggleArrangementSelection = arrangementKey => {
    setSelectedArrangementKeys(current => (
      current.includes(arrangementKey)
        ? current.filter(item => item !== arrangementKey)
        : [...current, arrangementKey]
    ));
  };

  const selectAllArrangements = () => {
    setSelectedArrangementKeys(arrangementRows.map(item => item.key));
  };

  const clearAllArrangements = () => {
    setSelectedArrangementKeys([]);
  };

  const saveCashClosing = () => {
    if (!cashForm.fecha) {
      setInfo("Selecciona una fecha para guardar el cierre.");
      return;
    }

    setSaving(true);
    try {
      writeCashClosing(empresaId, sucursalId, cashForm.fecha, {
        base: baseValue,
        efectivo: efectivoValue,
        gasto: gastoValue,
        totalEfectivo: totalEfectivoCaja,
        guardado: guardadoValue,
        nuevaBase: nuevaBaseValue,
      });
      setCashHistoryVersion(current => current + 1);
      setInfo(`Cierre guardado para ${cashForm.fecha}.`);
    } finally {
      setSaving(false);
    }
  };

  const exportRowsToExcel = useCallback(async (rows, filename, sheetName) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      setInfo("No hay datos para exportar.");
      return;
    }
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
  }, []);

  const exportVentas = () => {
    exportRowsToExcel(
      orderRows.map(row => ({
        Fecha: row.fecha,
        "Cantidad de pedidos": row.cantidadPedidos,
        "Pedidos cancelados": row.pedidosCancelados,
        "Total arreglos": row.totalArreglos,
        "Total domicilios": row.totalDomicilios,
        "Recargos link": row.totalRecargos,
        Descuentos: row.totalDescuentos,
        "Saldo a favor": row.totalSaldoFavor,
        "Total venta": row.totalVenta,
      })),
      `contabilidad-ventas-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Ventas"
    );
  };

  const exportDetalleVentas = () => {
    exportRowsToExcel(
      filteredAccountingDetailRows.map(row => ({
        Pedido: row.numeroPedido || row.pedidoID,
        "Usuario sistema": row.usuarioSistema || "",
        Cliente: row.cliente || "",
        "Cuenta de pago": row.cuentaPago || "",
        Estado: row.estado || "",
        "Saldo a favor": row.saldoFavorMonto || 0,
        "Nota saldo a favor": row.saldoFavorNota || "",
        "Descuento aplicado": row.descuentoMonto || 0,
        "Nota descuento": row.descuentoNota || "",
        "Notas / observaciones": row.observaciones || "",
        Cancelado: row.cancelado ? "Si" : "No",
        "Nota cancelacion": row.notaCancelacion || "",
      })),
      `contabilidad-detalle-ventas-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Detalle ventas"
    );
  };

  const exportArreglos = () => {
    exportRowsToExcel(
      selectedArrangementRows.map(item => ({
        Codigo: item.codigo || "",
        Arreglo: item.nombre,
        "Unidades vendidas": item.unidades,
        Pedidos: item.pedidos,
        "Total vendido": item.totalVendido,
      })),
      `contabilidad-arreglos-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Arreglos"
    );
  };

  const exportCuentas = () => {
    exportRowsToExcel(
      paymentAccountRows.map(item => ({
        "Cuenta o medio": item.cuenta,
        Pedidos: item.pedidos,
        "Metodos usados": Array.isArray(item.metodos) ? item.metodos.join(", ") : "",
        "Total recaudado": item.totalRecaudado,
        "Promedio por pedido": item.promedioPedido,
        "Participacion %": item.participacionPct,
        "Ultimo movimiento": item.ultimoMovimiento,
      })),
      `contabilidad-cuentas-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Cuentas"
    );
  };

  const exportCaja = () => {
    exportRowsToExcel(
      cashHistoryRows.map(row => ({
        Fecha: row.fecha,
        Base: row.base,
        Efectivo: row.efectivo,
        Gasto: row.gasto,
        TotalEfectivo: row.totalEfectivo,
        NuevaBase: row.nuevaBase,
      })),
      `contabilidad-caja-${cashForm.fecha || filters.fechaHasta}.xlsx`,
      "Caja"
    );
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="contabilidad"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{
          pipeline: canViewPipeline,
          pedidos: canViewPedidos,
          produccion: canViewProduccion,
          domicilios: canViewDomicilios,
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          trazabilidad: canViewTrazabilidad,
          clientes: canViewClientesPanel,
          usuarios: canViewUsuariosPanel,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: onGoProduccion,
          domicilios: onGoDomicilios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
      />

      <main className="orders-admin-view accounting-view accounting-page-view">
        <header className="orders-admin-header orders-page-header accounting-page-header">
          <div>
            <h1>Contabilidad</h1>
            <p className="orders-admin-subtitle">Usuario: {displayUserName}</p>
          </div>
          <div className="header-actions">
            <div className="accounting-menu-dropdown" ref={accountingMenuRef}>
              <button
                type="button"
                className={`btn-outline accounting-menu-trigger${accountingMenuOpen ? " is-open" : ""}`}
                onClick={() => setAccountingMenuOpen(current => !current)}
                aria-expanded={accountingMenuOpen}
                aria-haspopup="menu"
              >
                {(() => {
                  const activeOption = ACCOUNTING_VIEWS.find(item => item.key === activeView) || ACCOUNTING_VIEWS[0];
                  const ActiveIcon = ACCOUNTING_VIEW_ICONS[activeOption.key] || ListChecks;
                  return (
                    <>
                      <ActiveIcon size={18} strokeWidth={2} aria-hidden="true" />
                      <span>{activeOption.label}</span>
                      <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
                    </>
                  );
                })()}
              </button>
              {accountingMenuOpen ? (
                <div className="accounting-menu-panel" role="menu">
                  {ACCOUNTING_VIEWS.map(item => {
                    const Icon = ACCOUNTING_VIEW_ICONS[item.key] || ListChecks;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        className={activeView === item.key ? "is-active" : ""}
                        onClick={() => {
                          setActiveView(item.key);
                          setAccountingMenuOpen(false);
                        }}
                      >
                        <Icon size={16} strokeWidth={2} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <button type="button" className="btn-primary orders-header-refresh" onClick={loadAccountingData} disabled={loading}>
              <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <section className="orders-filters orders-page-filters accounting-filters">
          <label className="filter-field orders-filter-field">
            <div className="orders-filter-control">
              <CalendarDays size={17} strokeWidth={2} aria-hidden="true" />
              <input type="date" value={filters.fechaDesde} onChange={event => applyFilter("fechaDesde", event.target.value)} />
            </div>
          </label>
          <label className="filter-field orders-filter-field">
            <div className="orders-filter-control">
              <CalendarDays size={17} strokeWidth={2} aria-hidden="true" />
              <input type="date" value={filters.fechaHasta} onChange={event => applyFilter("fechaHasta", event.target.value)} />
            </div>
          </label>
          {activeView === "arreglos" ? (
            <details className="accounting-arrangements-filter">
              <summary>
                <ListChecks size={17} strokeWidth={2} aria-hidden="true" />
                <span>Arreglos incluidos</span>
                <strong>{selectedArrangementKeys.length}/{arrangementRows.length}</strong>
                <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
              </summary>
              <div className="accounting-arrangements-filter-panel">
                <div className="accounting-arrangements-filter-actions">
                  <button type="button" onClick={selectAllArrangements} disabled={arrangementRows.length === 0}>
                    Seleccionar todo
                  </button>
                  <button type="button" onClick={clearAllArrangements} disabled={arrangementRows.length === 0}>
                    Borrar todo
                  </button>
                </div>
                <div className="accounting-arrangements-filter-list">
                  {arrangementRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay arreglos vendidos para este rango.</p>
                  ) : arrangementRows.map(item => (
                    <label key={item.key} className="accounting-arrangement-check">
                      <input
                        type="checkbox"
                        checked={selectedArrangementKeys.includes(item.key)}
                        onChange={() => toggleArrangementSelection(item.key)}
                      />
                      <span>
                        <strong>{item.nombre}</strong>
                        <small>{item.codigo || "Sin codigo"} · {item.unidades} und.</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
          <div className="accounting-filter-actions">
            <button type="button" className="btn-primary" onClick={loadAccountingData} disabled={loading}>
              <RefreshCw size={17} strokeWidth={2} aria-hidden="true" />
              {loading ? "Cargando..." : "Actualizar resumen"}
            </button>
          </div>
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}

        {activeView === "ventas" ? (
          <>
            <section className="accounting-summary-cards accounting-summary-cards--top">
              <article className="order-block accounting-stat-card">
                <span>Pedidos</span>
                <strong>{summaryTotals.cantidadPedidos}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cancelados</span>
                <strong>{summaryTotals.pedidosCancelados}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Arreglos florales</span>
                <strong>${formatearCOP(summaryTotals.totalArreglos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Domicilios</span>
                <strong>${formatearCOP(summaryTotals.totalDomicilios)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Total venta</span>
                <strong>${formatearCOP(summaryTotals.totalVenta)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Recargos link</span>
                <strong>${formatearCOP(summaryTotals.totalRecargos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Descuentos</span>
                <strong>${formatearCOP(summaryTotals.totalDescuentos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Saldo a favor</span>
                <strong>${formatearCOP(summaryTotals.totalSaldoFavor)}</strong>
              </article>
            </section>

            <section className="accounting-health-strip" aria-label="Salud del negocio">
              {businessHealthRows.map(item => (
                <article key={item.key} className={`accounting-health-pill is-${item.status}`}>
                  {item.status === "good" ? <CircleCheck size={17} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={17} strokeWidth={2} aria-hidden="true" />}
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </section>

            <section className="accounting-intelligence-grid">
              <article className="accounting-analytics-panel accounting-sales-panel">
                <div className="accounting-panel-head">
                  <div>
                    <span>Analisis de ventas</span>
                    <h3>Ventas por dia</h3>
                  </div>
                  <BadgeDollarSign size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-line-chart" aria-label="Grafico de ventas por dia">
                  {salesTrendRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay ventas para graficar.</p>
                  ) : salesTrendRows.map(row => (
                    <div key={row.key} className="accounting-line-column" title={`${row.label}: $${formatearCOP(row.value)}`}>
                      <span style={{ height: `${row.height}%` }} />
                      <small>{String(row.label).slice(5)}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="accounting-analytics-panel accounting-month-panel">
                <div className="accounting-panel-head">
                  <div>
                    <span>Vista mensual</span>
                    <h3>Ventas mes a mes</h3>
                  </div>
                  <Activity size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-month-bars">
                  {monthlySalesRows.length === 0 ? (
                    <p className="accounting-empty-state">Sin ventas mensuales.</p>
                  ) : monthlySalesRows.map(row => (
                    <div key={row.key} className="accounting-month-row">
                      <span>{row.label}</span>
                      <div><i style={{ width: `${row.height}%` }} /></div>
                      <strong>${formatearCOP(row.value)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="accounting-analytics-panel accounting-money-map">
              <div className="accounting-panel-head">
                <div>
                  <span>Mapa de dinero</span>
                  <h3>Distribucion visual del periodo</h3>
                </div>
                <Wallet size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-money-map-grid">
                <div className="accounting-donut" style={{ "--donut-value": `${Math.min(100, Math.max(0, moneyMapRows[0]?.pct || 0))}%` }}>
                  <strong>{moneyMapRows[0]?.pct || 0}%</strong>
                  <span>Arreglos</span>
                </div>
                <div className="accounting-money-bars">
                  {moneyMapRows.map(item => (
                    <div key={item.key} className={`accounting-money-row ${item.tone}`}>
                      <div>
                        <span>{item.label}</span>
                        <strong>${formatearCOP(item.value)}</strong>
                      </div>
                      <i><b style={{ width: `${item.pct}%` }} /></i>
                      <small>{item.pct}%</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="accounting-table-actions">
              <button type="button" className="btn-outline" onClick={exportVentas} disabled={orderRows.length === 0}>
                Descargar Excel
              </button>
            </div>
            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cantidad de pedidos</th>
                    <th>Cancelados</th>
                    <th>Total $ en arreglos florales</th>
                    <th>Total $ en domicilios</th>
                    <th>Recargos link</th>
                    <th>Descuentos</th>
                    <th>Saldo a favor</th>
                    <th>Total de la venta</th>
                  </tr>
                </thead>
                <tbody>
                  {orderRows.length === 0 ? (
                    <tr>
                      <td colSpan={9}>{loading ? "Cargando resumen..." : "No hay ventas para los filtros seleccionados."}</td>
                    </tr>
                  ) : orderRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>{row.cantidadPedidos}</td>
                      <td>{row.pedidosCancelados}</td>
                      <td>${formatearCOP(row.totalArreglos)}</td>
                      <td>${formatearCOP(row.totalDomicilios)}</td>
                      <td>${formatearCOP(row.totalRecargos)}</td>
                      <td>${formatearCOP(row.totalDescuentos)}</td>
                      <td>${formatearCOP(row.totalSaldoFavor)}</td>
                      <td>${formatearCOP(row.totalVenta)}</td>
                    </tr>
                  ))}
                </tbody>
                {orderRows.length > 0 ? (
                  <tfoot>
                    <tr>
                      <th>Totales</th>
                      <th>{summaryTotals.cantidadPedidos}</th>
                      <th>{summaryTotals.pedidosCancelados}</th>
                      <th>${formatearCOP(summaryTotals.totalArreglos)}</th>
                      <th>${formatearCOP(summaryTotals.totalDomicilios)}</th>
                      <th>${formatearCOP(summaryTotals.totalRecargos)}</th>
                      <th>${formatearCOP(summaryTotals.totalDescuentos)}</th>
                      <th>${formatearCOP(summaryTotals.totalSaldoFavor)}</th>
                      <th>${formatearCOP(summaryTotals.totalVenta)}</th>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </section>
          </>
        ) : null}

        {activeView === "detalle" ? (
          <section className="order-block accounting-detail-panel">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>Detalle de ventas por pedido</h4>
                <p className="orders-admin-subtitle">Control de descuentos, saldo a favor, notas operativas y cancelaciones del periodo.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={exportDetalleVentas} disabled={filteredAccountingDetailRows.length === 0}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <section className="accounting-summary-cards accounting-summary-cards--detail">
              <article className="order-block accounting-stat-card">
                <span>Total descuentos</span>
                <strong>${formatearCOP(detailInsight.totalDescuentos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Total saldo a favor</span>
                <strong>${formatearCOP(detailInsight.totalSaldoFavor)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos con notas</span>
                <strong>{detailInsight.pedidosConNotas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cancelados</span>
                <strong>{detailInsight.cancelados}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cuentas usadas</span>
                <strong>{detailInsight.cuentasPago}</strong>
              </article>
            </section>

            <section className="accounting-analytics-panel accounting-insight-panel">
              <div className="accounting-panel-head">
                <div>
                  <span>Inteligencia Saldos/Desc.</span>
                  <h3>Problemas y ajustes del periodo</h3>
                </div>
                <Brain size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-smart-insights">
                {[
                  detailInsight.totalDescuentos > 0 ? `Hay $${formatearCOP(detailInsight.totalDescuentos)} en descuentos aplicados.` : "No hay descuentos aplicados en el periodo.",
                  detailInsight.totalSaldoFavor > 0 ? `El saldo a favor acumulado es $${formatearCOP(detailInsight.totalSaldoFavor)}.` : "No hay saldos a favor pendientes.",
                  detailInsight.pedidosConNotas > 0 ? `${detailInsight.pedidosConNotas} pedidos tienen notas u observaciones.` : "No hay notas operativas relevantes.",
                  detailInsight.cancelados > 0 ? `${detailInsight.cancelados} pedidos fueron cancelados.` : "No existen cancelaciones en el periodo.",
                ].map((item, index) => (
                  <div key={`detail-insight-${index}`} className="accounting-smart-card">
                    <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="accounting-detail-layout">
              <article className="accounting-chart-card">
                <h5>Vision general de ajustes</h5>
                <div className="accounting-bar-list">
                  {renderBarChartRows(detailChartRows, "value", true, "label")}
                </div>
              </article>
              <article className="accounting-chart-card accounting-detail-highlight">
                <h5>Pedidos destacados</h5>
                <div className="accounting-detail-highlight-grid">
                  <p>
                    <span>Mayor descuento</span>
                    <strong>{detailInsight.topDescuento ? `#${detailInsight.topDescuento.numeroPedido || detailInsight.topDescuento.pedidoID}` : "-"}</strong>
                    <small>{detailInsight.topDescuento ? `$${formatearCOP(detailInsight.topDescuento.descuentoMonto)}` : "Sin descuentos"}</small>
                  </p>
                  <p>
                    <span>Mayor saldo a favor</span>
                    <strong>{detailInsight.topSaldo ? `#${detailInsight.topSaldo.numeroPedido || detailInsight.topSaldo.pedidoID}` : "-"}</strong>
                    <small>{detailInsight.topSaldo ? `$${formatearCOP(detailInsight.topSaldo.saldoFavorMonto)}` : "Sin saldos"}</small>
                  </p>
                  <p>
                    <span>Cuenta más usada</span>
                    <strong>{detailInsight.cuentaPrincipal?.cuenta || "-"}</strong>
                    <small>{detailInsight.cuentaPrincipal ? `${detailInsight.cuentaPrincipal.pedidos} pedidos` : "Sin pagos"}</small>
                  </p>
                </div>
              </article>
            </section>

            <section className="accounting-detail-filters" aria-label="Filtros detalle de ventas">
              {[
                ["todos", "Todos"],
                ["descuento", "Con descuento"],
                ["saldo", "Con saldo a favor"],
                ["cancelados", "Cancelados"],
                ["conNotas", "Con notas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`btn-outline${detailFilter === key ? " is-selected" : ""}`}
                  onClick={() => setDetailFilter(key)}
                >
                  {label}
                </button>
              ))}
            </section>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table accounting-detail-table">
                <thead>
                  <tr>
                    <th># Pedido</th>
                    <th>Usuario sistema</th>
                    <th>Cliente</th>
                    <th>Cuenta pago</th>
                    <th>Saldo a favor</th>
                    <th>Descuento</th>
                    <th>Notas / observaciones</th>
                    <th>Cancelado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccountingDetailRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>{loading ? "Cargando detalle..." : "No hay pedidos para el filtro seleccionado."}</td>
                    </tr>
                  ) : filteredAccountingDetailRows.map(row => (
                    <tr key={`${row.pedidoID}-${row.numeroPedido}`}>
                      <td>{row.numeroPedido || row.codigoPedido || row.pedidoID}</td>
                      <td>{row.usuarioSistema || "-"}</td>
                      <td>{row.cliente || "-"}</td>
                      <td>{row.cuentaPago || "-"}</td>
                      <td>
                        <strong>${formatearCOP(row.saldoFavorMonto || 0)}</strong>
                        <span>{row.saldoFavorNota || "-"}</span>
                      </td>
                      <td>
                        <strong>${formatearCOP(row.descuentoMonto || 0)}</strong>
                        <span>{row.descuentoNota || "-"}</span>
                      </td>
                      <td>{row.observaciones || "-"}</td>
                      <td>
                        <span className={`order-badge ${row.cancelado ? "is-cancelado" : "is-aprobado"}`}>
                          {row.cancelado ? "Cancelado" : row.estado || "Activo"}
                        </span>
                        {row.notaCancelacion ? <small>{row.notaCancelacion}</small> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}

        {activeView === "arreglos" ? (
          <section className="order-block accounting-arrangements-panel">
            <div className="looker-header accounting-arrangements-head">
              <div>
                <h4>Métricas por arreglos</h4>
                <p className="orders-admin-subtitle">Cuántas unidades se han vendido por arreglo, con filtro masivo y detalle visual.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={exportArreglos} disabled={selectedArrangementRows.length === 0}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <section className="accounting-analytics-panel accounting-arrangements-ranking-panel">
              <div className="accounting-panel-head">
                <div>
                  <span>Top de arreglos</span>
                  <h3>Ventas, unidades y concentracion</h3>
                </div>
                <BarChart3 size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-ranking-grid">
                <AccountingRanking title="Top arreglos por ventas" rows={arrangementRows.slice().sort((a, b) => Number(b.totalVendido || 0) - Number(a.totalVendido || 0)).slice(0, 5)} valueField="totalVendido" labelField="nombre" isMoney />
                <AccountingRanking title="Top arreglos por unidades" rows={arrangementRows.slice(0, 5)} valueField="unidades" labelField="nombre" />
              </div>
            </section>

            <section className="accounting-summary-cards accounting-summary-cards--arrangements">
              <article className="order-block accounting-stat-card">
                <span>Arreglos seleccionados</span>
                <strong>{arrangementSummary.arreglosSeleccionados}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Unidades vendidas</span>
                <strong>{arrangementSummary.unidadesVendidas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Total vendido</span>
                <strong>${formatearCOP(arrangementSummary.totalVendido)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos impactados</span>
                <strong>{arrangementSummary.pedidosImpactados}</strong>
              </article>
            </section>

            <div className="accounting-arrangements-grid">
              <section className="order-block accounting-arrangements-selector">
                <div className="accounting-arrangements-selector-head">
                  <strong>Arreglos incluidos</strong>
                  <span>{selectedArrangementKeys.length} / {arrangementRows.length}</span>
                </div>
                <div className="accounting-arrangements-checklist">
                  {arrangementRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay arreglos vendidos para este rango.</p>
                  ) : arrangementRows.map(item => (
                    <label key={item.key} className="accounting-arrangement-check">
                      <input
                        type="checkbox"
                        checked={selectedArrangementKeys.includes(item.key)}
                        onChange={() => toggleArrangementSelection(item.key)}
                      />
                      <span>
                        <strong>{item.nombre}</strong>
                        <small>{item.codigo || "Sin código"} · {item.unidades} und.</small>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="order-block accounting-arrangements-insights">
                <div className="accounting-insight-cards">
                  <article className="accounting-insight-card">
                    <span>Top por unidades</span>
                    <strong>{topArrangementByUnits?.nombre || "-"}</strong>
                    <small>{topArrangementByUnits ? `${topArrangementByUnits.unidades} unidades` : "Sin datos"}</small>
                  </article>
                  <article className="accounting-insight-card">
                    <span>Top por venta</span>
                    <strong>{topArrangementBySales?.nombre || "-"}</strong>
                    <small>{topArrangementBySales ? `$${formatearCOP(topArrangementBySales.totalVendido)}` : "Sin datos"}</small>
                  </article>
                </div>

                <div className="accounting-chart-grid">
                  <article className="accounting-chart-card">
                    <h5>Gráfica por unidades</h5>
                    {arrangementChartRows.length === 0 ? (
                      <p className="accounting-empty-state">Selecciona al menos un arreglo para ver la gráfica.</p>
                    ) : (
                      <div className="accounting-bar-list">
                        {renderBarChartRows(arrangementChartRows, "unidades")}
                      </div>
                    )}
                  </article>
                  <article className="accounting-chart-card">
                    <h5>Gráfica por total vendido</h5>
                    {arrangementChartRows.length === 0 ? (
                      <p className="accounting-empty-state">Selecciona al menos un arreglo para ver la gráfica.</p>
                    ) : (
                      <div className="accounting-bar-list">
                        {renderBarChartRows(arrangementChartRows, "totalVendido", true)}
                      </div>
                    )}
                  </article>
                </div>
              </section>
            </div>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Arreglo</th>
                    <th>Unidades vendidas</th>
                    <th>Pedidos</th>
                    <th>Total vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedArrangementRows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No hay arreglos seleccionados para mostrar.</td>
                    </tr>
                  ) : selectedArrangementRows.map(item => (
                    <tr key={item.key}>
                      <td>{item.codigo || "-"}</td>
                      <td>{item.nombre}</td>
                      <td>{item.unidades}</td>
                      <td>{item.pedidos}</td>
                      <td>${formatearCOP(item.totalVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}

        {activeView === "cuentas" ? (
          <>
            <section className="accounting-summary-cards">
              <article className="order-block accounting-stat-card">
                <span>Cuentas activas</span>
                <strong>{paymentSummary.cuentas}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Pedidos impactados</span>
                <strong>{paymentSummary.pedidos}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Recaudo total</span>
                <strong>${formatearCOP(paymentSummary.recaudo)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Cuenta líder</span>
                <strong>{topPaymentAccount?.cuenta || "-"}</strong>
              </article>
            </section>

            <section className="order-block accounting-arrangements-panel">
              <div className="looker-header accounting-arrangements-head">
                <div>
                  <h4>Ventas por cuenta o medio de pago</h4>
                  <p className="orders-admin-subtitle">Mide número de pedidos, recaudo, participación y comportamiento por cada cuenta o medio de pago usado.</p>
                </div>
                <div className="accounting-arrangements-actions">
                  <button type="button" className="btn-outline" onClick={exportCuentas} disabled={paymentAccountRows.length === 0}>
                    Descargar Excel
                  </button>
                </div>
              </div>

              <section className="accounting-analytics-panel accounting-payment-ranking-panel">
                <div className="accounting-panel-head">
                  <div>
                    <span>Ranking de pagos</span>
                    <h3>Medios y cuentas dominantes</h3>
                  </div>
                  <CreditCard size={22} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-ranking-grid">
                  <AccountingRanking title="Medios por recaudo" rows={paymentAccountRows} valueField="totalRecaudado" labelField="cuenta" isMoney />
                  <AccountingRanking title="Medios por pedidos" rows={paymentAccountRows.slice().sort((a, b) => Number(b.pedidos || 0) - Number(a.pedidos || 0))} valueField="pedidos" labelField="cuenta" />
                </div>
              </section>

              <div className="accounting-chart-grid accounting-payment-hidden-charts" aria-hidden="true">
                <article className="accounting-chart-card">
                  <h5>Participación por recaudo</h5>
                  {paymentAccountRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay movimientos de pago para este rango.</p>
                  ) : (
                    <div className="accounting-bar-list">
                      {renderBarChartRows(paymentAccountRows.slice(0, 8), "totalRecaudado", true, "cuenta")}
                    </div>
                  )}
                </article>
                <article className="accounting-chart-card">
                  <h5>Pedidos por cuenta</h5>
                  {paymentAccountRows.length === 0 ? (
                    <p className="accounting-empty-state">No hay movimientos de pago para este rango.</p>
                  ) : (
                    <div className="accounting-bar-list">
                      {renderBarChartRows(paymentAccountRows.slice(0, 8), "pedidos", false, "cuenta")}
                    </div>
                  )}
                </article>
              </div>

              <section className="orders-table-wrap">
                <table className="orders-table accounting-table">
                  <thead>
                    <tr>
                      <th>Cuenta / Medio</th>
                      <th>Pedidos</th>
                      <th>Métodos usados</th>
                      <th>Total recaudado</th>
                      <th>Promedio por pedido</th>
                      <th>Participación</th>
                      <th>Último movimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentAccountRows.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No hay cuentas de pago para mostrar.</td>
                      </tr>
                    ) : paymentAccountRows.map(item => (
                      <tr key={item.key}>
                        <td>{item.cuenta}</td>
                        <td>{item.pedidos}</td>
                        <td>{item.metodos.join(", ") || "-"}</td>
                        <td>${formatearCOP(item.totalRecaudado)}</td>
                        <td>${formatearCOP(item.promedioPedido)}</td>
                        <td>{item.participacionPct}%</td>
                        <td>{item.ultimoMovimiento || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </section>
          </>
        ) : null}

        {activeView === "caja" ? (
          <section className="order-block accounting-cash-panel">
            <div className="looker-header">
              <div>
                <h4>Caja</h4>
                <p className="orders-admin-subtitle">Cierre de efectivo por fecha. El guardado se conserva localmente en este navegador.</p>
              </div>
            </div>

            <section className="accounting-analytics-panel accounting-cash-dashboard">
              <div className="accounting-panel-head">
                <div>
                  <span>Dashboard de caja</span>
                  <h3>Balance financiero del cierre</h3>
                </div>
                <Wallet size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-cash-kpis">
                {[
                  ["Caja inicial", baseValue],
                  ["Ingresos efectivo", efectivoValue],
                  ["Gastos", gastoValue],
                  ["Caja final", totalEfectivoCaja],
                  ["Guardado", guardadoValue],
                  ["Nueva base", nuevaBaseValue],
                ].map(([label, value]) => (
                  <article key={label} className="accounting-cash-kpi">
                    <span>{label}</span>
                    <strong>${formatearCOP(value)}</strong>
                  </article>
                ))}
              </div>
              <div className={`accounting-cash-balance ${nuevaBaseValue >= 0 ? "is-ok" : "is-risk"}`}>
                {nuevaBaseValue >= 0 ? <CircleCheck size={18} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />}
                <span>{nuevaBaseValue >= 0 ? "Cuadre correcto" : "Diferencia encontrada"}</span>
                <strong>${formatearCOP(Math.abs(nuevaBaseValue))}</strong>
              </div>
            </section>

            <div className="accounting-cash-grid">
              <label className="order-detail-edit-label">
                Fecha
                <input type="date" value={cashForm.fecha} onChange={event => setCashForm(current => ({ ...current, fecha: event.target.value }))} />
              </label>
              <label className="order-detail-edit-label">
                Base
                <input type="number" min="0" step="0.01" value={cashForm.base} onChange={event => setCashForm(current => ({ ...current, base: event.target.value }))} placeholder="0.00" />
              </label>
              <label className="order-detail-edit-label">
                Efectivo
                <input type="text" value={`$${formatearCOP(efectivoValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Gasto
                <input type="number" min="0" step="0.01" value={cashForm.gasto} onChange={event => setCashForm(current => ({ ...current, gasto: event.target.value }))} placeholder="0.00" />
              </label>
              <label className="order-detail-edit-label">
                T. Efectivo
                <input type="text" value={`$${formatearCOP(totalEfectivoCaja)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Guardado
                <input type="number" min="0" step="0.01" value={cashForm.guardado} onChange={event => setCashForm(current => ({ ...current, guardado: event.target.value }))} placeholder="0.00" />
              </label>
              <label className="order-detail-edit-label">
                Nueva Base
                <input type="text" value={`$${formatearCOP(nuevaBaseValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
            </div>

            <div className="order-detail-edit-actions">
              <button type="button" className="btn-primary" onClick={saveCashClosing} disabled={saving}>
                {saving ? "Guardando..." : "Guardar cierre"}
              </button>
              <button type="button" className="btn-outline" onClick={exportCaja} disabled={cashHistoryRows.length === 0}>
                Descargar Excel
              </button>
            </div>

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Base</th>
                    <th>Efectivo</th>
                    <th>Gasto</th>
                    <th>Total_Efectivo</th>
                    <th>Nueva_Base</th>
                  </tr>
                </thead>
                <tbody>
                  {cashHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No hay cierres de caja guardados.</td>
                    </tr>
                  ) : cashHistoryRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>${formatearCOP(row.base)}</td>
                      <td>${formatearCOP(row.efectivo)}</td>
                      <td>${formatearCOP(row.gasto)}</td>
                      <td>${formatearCOP(row.totalEfectivo)}</td>
                      <td>${formatearCOP(row.nuevaBase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function AccountingRanking({ title, rows, valueField, labelField, isMoney = false }) {
  const maxValue = Math.max(...rows.map(row => Number(row?.[valueField] || 0)), 0);
  return (
    <section className="accounting-ranking-card">
      <h4>{title}</h4>
      <div className="accounting-ranking-list">
        {rows.length === 0 ? (
          <p className="accounting-empty-state">Sin datos.</p>
        ) : rows.map((row, index) => {
          const value = Number(row?.[valueField] || 0);
          const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 8) : 0;
          const label = String(row?.[labelField] || "Sin nombre");
          return (
            <article key={`${title}-${row.key || label}-${index}`} className="accounting-ranking-item">
              <span className="accounting-ranking-avatar">{label.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{index + 1}. {label}</strong>
                <i><b style={{ width: `${width}%` }} /></i>
              </div>
              <small>{isMoney ? `$${formatearCOP(value)}` : value}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

async function fetchOrdersForAccounting({ api, empresaId, sucursalId, fechaDesde, fechaHasta }) {
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

function buildAccountingRows(items) {
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
      totalVenta: 0,
      totalEfectivo: 0,
    };

    const financiero = item?.detail?.financiero || {};
    const domicilio = roundMoney(financiero?.domicilio);
    const total = roundMoney(financiero?.total ?? item?.order?.total);
    const arreglos = roundMoney((financiero?.subtotal ?? 0) + (financiero?.iva ?? 0));
    const recargos = roundMoney(financiero?.recargoLinkMonto ?? 0);
    const descuentos = roundMoney(financiero?.descuentoMonto ?? 0);
    const status = normalizeStatus(item?.order?.estado || item?.detail?.estado);

    current.cantidadPedidos += 1;
    if (status === "CANCELADO" || status === "RECHAZADO") current.pedidosCancelados += 1;
    current.totalArreglos += arreglos;
    current.totalDomicilios += domicilio;
    current.totalRecargos += recargos;
    current.totalDescuentos += descuentos;
    current.totalVenta += total;
    current.totalEfectivo += extractCashAmount(financiero, total);

    grouped.set(fecha, current);
  }

  return Array.from(grouped.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function buildArrangementRows(items) {
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

function buildPaymentAccountRows(items) {
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

function extractPaymentEntries(financiero) {
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

function renderBarChartRows(rows, field, isMoney = false, labelField = "nombre") {
  const maxValue = Math.max(...rows.map(item => Number(item?.[field] || 0)), 0);

  return rows.map(item => {
    const value = Number(item?.[field] || 0);
    const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
    return (
      <div key={`${field}-${item.key}`} className="accounting-bar-row">
        <div className="accounting-bar-row-head">
          <strong>{item[labelField]}</strong>
          <span>{isMoney ? `$${formatearCOP(value)}` : value}</span>
        </div>
        <div className="accounting-bar-track">
          <div className="accounting-bar-fill" style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  });
}

function extractCashAmount(financiero, fallbackTotal = 0) {
  const entries = extractPaymentEntries(financiero);
  if (entries.length > 0) {
    return roundMoney(entries.reduce((sum, item) => {
      if (!String(item?.metodo || "").trim().toLowerCase().includes("efectivo")) return sum;
      return sum + Number(item?.monto || 0);
    }, 0));
  }
  return 0;
}

function isSaleStatus(status) {
  const normalized = normalizeStatus(status);
  return normalized === "APROBADO";
}

function parseMoneyInput(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function storageKeyFor(empresaId, sucursalId, fecha) {
  return `${empresaId}:${sucursalId}:${fecha}`;
}

function readCashClosing(empresaId, sucursalId, fecha) {
  if (!fecha) return null;
  try {
    const raw = globalThis.localStorage?.getItem(CASH_CLOSING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.[storageKeyFor(empresaId, sucursalId, fecha)] || null;
  } catch {
    return null;
  }
}

function writeCashClosing(empresaId, sucursalId, fecha, value) {
  const raw = globalThis.localStorage?.getItem(CASH_CLOSING_STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  parsed[storageKeyFor(empresaId, sucursalId, fecha)] = value;
  globalThis.localStorage?.setItem(CASH_CLOSING_STORAGE_KEY, JSON.stringify(parsed));
}

function listCashClosings(empresaId, sucursalId) {
  try {
    const raw = globalThis.localStorage?.getItem(CASH_CLOSING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const prefix = `${empresaId}:${sucursalId}:`;

    return Object.entries(parsed)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        fecha: key.slice(prefix.length),
        base: roundMoney(value?.base),
        efectivo: roundMoney(value?.efectivo),
        gasto: roundMoney(value?.gasto),
        totalEfectivo: roundMoney(value?.totalEfectivo),
        nuevaBase: roundMoney(value?.nuevaBase),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch {
    return [];
  }
}
