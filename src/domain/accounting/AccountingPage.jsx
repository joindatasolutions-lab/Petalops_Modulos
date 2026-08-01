import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
import { Activity, BadgeDollarSign, Banknote, BarChart3, Brain, CalendarDays, ChevronDown, CircleAlert, CircleCheck, Columns3, CreditCard, Download, FileSpreadsheet, FileText, Filter, ListChecks, MoreHorizontal, Package, Receipt, RefreshCw, Search, ShoppingCart, Sparkles, Tag, Wallet, XCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  efectivo: "",
  gasto: "",
  guardado: "",
  totalEfectivo: "",
  observacion: "",
};

function getAdjustmentNoteItems(row) {
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

function AccountingSalesTooltip({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="accounting-sales-tooltip">
      <strong>{label}</strong>
      <span>${formatearCOP(row.value || 0)}</span>
      <small>{Number(row.pedidos || 0)} pedidos</small>
    </div>
  );
}

function formatAdjustmentNotesForExport(row) {
  const items = getAdjustmentNoteItems(row);
  if (items.length === 0) return "";
  return items.map(item => item.note).join(" | ");
}

export function AccountingPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewBarrios,
  canViewInventario,
  canViewContabilidad,
  canViewTrazabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
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
  const [selectedAccountingCase, setSelectedAccountingCase] = useState(null);
  const [selectedArrangementKeys, setSelectedArrangementKeys] = useState([]);
  const [cashHistoryRows, setCashHistoryRows] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);

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

  const loadCashClosings = useCallback(async () => {
    setCashLoading(true);
    try {
      const fechaDesde = filters.fechaDesde || getAccountingPeriodRange("month").fechaDesde;
      const fechaHasta = filters.fechaHasta || getAccountingPeriodRange("month").fechaHasta;
      const payload = await api.listarCierresCaja({
        empresaId,
        sucursalId,
        fechaDesde,
        fechaHasta,
      });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      setCashHistoryRows(rows
        .map(row => normalizeCashClosingRow(row))
        .filter(row => row && row.fecha >= fechaDesde && row.fecha <= fechaHasta)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)));
    } catch (nextError) {
      setCashHistoryRows([]);
      if (nextError?.status === 404) {
        setError("");
        return;
      }
      setError(nextError?.detail || nextError?.message || "No fue posible cargar los cierres de caja desde la base de datos.");
    } finally {
      setCashLoading(false);
    }
  }, [api, empresaId, sucursalId, filters.fechaDesde, filters.fechaHasta]);

  const loadCashClosingForDate = useCallback(async fecha => {
    const targetFecha = String(fecha || "").slice(0, 10);
    if (!targetFecha) return null;
    const payload = await api.listarCierresCaja({
      empresaId,
      sucursalId,
      fechaDesde: targetFecha,
      fechaHasta: targetFecha,
    });
    const rows = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];
    return rows
      .map(row => normalizeCashClosingRow(row, targetFecha))
      .filter(Boolean)
      .find(row => row.fecha === targetFecha) || null;
  }, [api, empresaId, sucursalId]);

  const loadCashDayFromAccountingSummary = useCallback(async () => {
    const payload = await api.obtenerResumenContabilidad({
      empresaId,
      sucursalId,
      fechaDesde: cashForm.fecha,
      fechaHasta: cashForm.fecha,
    });
    const row = normalizeCashSummaryRow(payload, cashForm.fecha);
    setCashForm(current => ({
      ...current,
      fecha: row?.fecha || current.fecha,
      efectivo: row?.efectivo ?? "",
      totalEfectivo: "",
    }));
    return row;
  }, [api, cashForm.fecha, empresaId, sucursalId]);

  const loadCashDay = useCallback(async () => {
    if (!cashForm.fecha || !empresaId || !sucursalId) return;
    setCashLoading(true);
    try {
      let savedClosing = null;
      try {
        savedClosing = await loadCashClosingForDate(cashForm.fecha);
      } catch (closingError) {
        if (closingError?.status !== 404) throw closingError;
      }
      if (savedClosing) {
        setCashForm(current => ({
          ...current,
          fecha: savedClosing.fecha || current.fecha,
          base: savedClosing.base ?? "",
          efectivo: savedClosing.efectivo ?? "",
          gasto: savedClosing.gasto ?? "",
          guardado: savedClosing.guardado ?? "",
          totalEfectivo: savedClosing.totalEfectivo ?? "",
          observacion: savedClosing.observacion ?? "",
        }));
        setError("");
        setInfo("");
        return;
      }

      const payload = await api.obtenerCierreCajaDia({
        empresaId,
        sucursalId,
        fecha: cashForm.fecha,
      });
      const row = normalizeCashClosingRow(payload, cashForm.fecha);
      setCashForm(current => ({
        ...current,
        fecha: row?.fecha || current.fecha,
        base: row?.base ?? "",
        efectivo: row?.efectivo ?? "",
        gasto: row?.gasto ?? "",
        guardado: row?.guardado ?? "",
        totalEfectivo: row?.totalEfectivo ?? "",
        observacion: row?.observacion ?? "",
      }));
      setError("");
      setInfo("");
    } catch (nextError) {
      if (nextError?.status === 404) {
        try {
          const row = await loadCashDayFromAccountingSummary();
          setError("");
          setInfo(row
            ? "Efectivo cargado desde el resumen contable. Los endpoints de cierre de caja no estan publicados."
            : "No hay efectivo registrado para esa fecha. Los endpoints de cierre de caja no estan publicados.");
        } catch (summaryError) {
          setError(summaryError?.detail || summaryError?.message || "No fue posible consultar el efectivo desde el resumen contable.");
        }
        return;
      }
      setCashForm(current => ({
        ...current,
        base: "",
        efectivo: "",
        gasto: "",
        guardado: "",
        totalEfectivo: "",
        observacion: "",
      }));
      setError(nextError?.detail || nextError?.message || "No fue posible consultar la caja del día.");
    } finally {
      setCashLoading(false);
    }
  }, [api, cashForm.fecha, empresaId, sucursalId, loadCashClosingForDate, loadCashDayFromAccountingSummary]);

  useEffect(() => {
    loadCashClosings();
  }, [loadCashClosings]);

  useEffect(() => {
    loadCashDay();
  }, [loadCashDay]);

  useEffect(() => {
    if (activeView !== "caja") return;
    loadCashDay();
  }, [activeView, loadCashDay]);

  useEffect(() => {
    const handleCashOrderSaved = () => {
      void loadCashDay();
    };
    window.addEventListener("pedidoGuardadoEfectivo", handleCashOrderSaved);
    return () => window.removeEventListener("pedidoGuardadoEfectivo", handleCashOrderSaved);
  }, [loadCashDay]);

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

    const pedidosAprobados = accountingDetailRows.filter(row => (
      normalizeStatus(row.estado) === "APROBADO" && !row.cancelado
    )).length;
    const pedidosCancelados = accountingDetailRows.filter(row => (
      Boolean(row.cancelado) || ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(row.estado))
    )).length;

    return {
      ...totals,
      cantidadPedidos: pedidosAprobados,
      pedidosCancelados,
    };
  }, [orderRows, accountingDetailRows]);

  const filteredAccountingDetailRows = useMemo(() => {
    return filterAccountingDetailRows(accountingDetailRows, detailFilter);
  }, [accountingDetailRows, detailFilter]);

  const detailInsight = useMemo(() => {
    const pedidosConDescuento = accountingDetailRows.filter(row => Number(row.descuentoMonto || 0) > 0);
    const pedidosConSaldo = accountingDetailRows.filter(row => Number(row.saldoFavorMonto || 0) > 0);
    const pedidosConNotas = accountingDetailRows.filter(row =>
      getAdjustmentNoteItems(row).length > 0
    );
    const cancelados = accountingDetailRows.filter(row => Boolean(row.cancelado) || ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(row.estado)));
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
    const totalPedidosConEstadoFinal = summaryTotals.cantidadPedidos + summaryTotals.pedidosCancelados;
    const cancelacionesPct = totalPedidosConEstadoFinal > 0
      ? roundMoney((summaryTotals.pedidosCancelados / totalPedidosConEstadoFinal) * 100)
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
    const rowsWithSales = orderRows.filter(row => Number(row.totalVenta || 0) > 0);
    const maxValue = Math.max(...rowsWithSales.map(row => Number(row.totalVenta || 0)), 0);
    return rowsWithSales.map(row => ({
      key: row.fecha,
      label: row.fecha,
      shortLabel: String(row.fecha || "").slice(5),
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
  const efectivoValue = parseMoneyInput(cashForm.efectivo);
  const gastoValue = parseMoneyInput(cashForm.gasto);
  const guardadoInputValue = parseMoneyInput(cashForm.guardado);
  const totalEfectivoCaja = roundMoney(baseValue + efectivoValue - gastoValue);
  const guardadoValue = roundMoney(guardadoInputValue);
  const nuevaBaseValue = roundMoney(totalEfectivoCaja - guardadoValue);
  const cashDashboardTotals = useMemo(() => {
    if (cashHistoryRows.length === 0) {
      return {
        base: baseValue,
        efectivo: efectivoValue,
        gasto: gastoValue,
        totalEfectivo: totalEfectivoCaja,
        guardado: guardadoValue,
        nuevaBase: nuevaBaseValue,
        source: "day",
      };
    }

    const totals = cashHistoryRows.reduce((acc, row) => ({
      base: acc.base + Number(row.base || 0),
      efectivo: acc.efectivo + Number(row.efectivo || 0),
      gasto: acc.gasto + Number(row.gasto || 0),
      totalEfectivo: acc.totalEfectivo + Number(row.totalEfectivo || 0),
      guardado: acc.guardado + Number(row.guardado || 0),
      nuevaBase: acc.nuevaBase + Number(row.nuevaBase || 0),
    }), {
      base: 0,
      efectivo: 0,
      gasto: 0,
      totalEfectivo: 0,
      guardado: 0,
      nuevaBase: 0,
    });

    return {
      base: roundMoney(totals.base),
      efectivo: roundMoney(totals.efectivo),
      gasto: roundMoney(totals.gasto),
      totalEfectivo: roundMoney(totals.totalEfectivo),
      guardado: roundMoney(totals.guardado),
      nuevaBase: roundMoney(totals.nuevaBase),
      source: "period",
    };
  }, [baseValue, cashHistoryRows, efectivoValue, gastoValue, guardadoValue, nuevaBaseValue, totalEfectivoCaja]);
  const todayCashDate = formatAccountingLocalDate(new Date());
  const selectedCashDate = String(cashForm.fecha || "").slice(0, 10);
  const selectedCashClosingExists = cashHistoryRows.some(row => row.fecha === selectedCashDate);
  const isPastCashDate = Boolean(selectedCashDate) && selectedCashDate < todayCashDate;
  const isFutureCashDate = Boolean(selectedCashDate) && selectedCashDate > todayCashDate;
  const isLockedPastCashClosing = isPastCashDate && selectedCashClosingExists;
  const canEditCashClosing = !isFutureCashDate;
  const activePeriodPreset = useMemo(() => {
    const presets = ["today", "yesterday", "7days", "30days", "month"];
    const match = presets.find(preset => {
      const range = getAccountingPeriodRange(preset);
      return filters.fechaDesde === range.fechaDesde && filters.fechaHasta === range.fechaHasta;
    });
    if (match) return match;
    return "";
  }, [filters.fechaDesde, filters.fechaHasta]);

  const applyFilter = (field, value) => {
    setFilters(current => ({ ...current, [field]: value }));
  };

  const applyPeriodPreset = preset => {
    const nextRange = getAccountingPeriodRange(preset);
    setFilters(current => ({ ...current, ...nextRange }));
  };

  const showAccountingDetail = filterKey => {
    setActiveView("detalle");
    setDetailFilter(filterKey);
    setSelectedAccountingCase(null);
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

  const saveCashClosing = async () => {
    if (!cashForm.fecha) {
      setInfo("Selecciona una fecha para guardar el cierre.");
      return;
    }
    if (!empresaId || !sucursalId) {
      setInfo("Empresa y sucursal son obligatorias para guardar caja.");
      return;
    }
    if (isFutureCashDate) {
      setInfo("No se puede operar una caja futura.");
      return;
    }
    const values = [baseValue, efectivoValue, gastoValue, totalEfectivoCaja, guardadoValue, nuevaBaseValue];
    if (values.some(value => !Number.isFinite(value) || value < 0)) {
      setInfo("Todos los valores de caja deben ser números mayores o iguales a cero.");
      return;
    }

    setSaving(true);
    try {
      const savedPayload = await api.guardarCierreCaja({
        empresaId,
        sucursalId,
        fecha: cashForm.fecha,
        base: baseValue,
        efectivo: efectivoValue,
        gasto: gastoValue,
        totalEfectivo: totalEfectivoCaja,
        guardado: guardadoValue,
        nuevaBase: nuevaBaseValue,
        observacion: cashForm.observacion || "",
        usuarioId: session?.userID || session?.usuarioID || session?.idUsuario || null,
      });
      const savedRow = hasCashClosingData(savedPayload)
        ? normalizeCashClosingRow(savedPayload, cashForm.fecha)
        : null;
      if (savedRow) {
        setCashForm(current => ({
          ...current,
          fecha: savedRow.fecha || current.fecha,
          base: savedRow.base ?? current.base,
          efectivo: savedRow.efectivo ?? current.efectivo,
          gasto: savedRow.gasto ?? current.gasto,
          guardado: savedRow.guardado ?? current.guardado,
          totalEfectivo: savedRow.totalEfectivo ?? current.totalEfectivo,
          observacion: savedRow.observacion ?? current.observacion,
        }));
      }
      await loadCashDay();
      await loadCashClosings();
      setInfo(`Cierre guardado en base de datos para ${cashForm.fecha}.`);
    } catch (nextError) {
      setError(nextError?.status === 404
        ? "El endpoint para guardar cierres de caja no esta publicado en el backend."
        : nextError?.detail || nextError?.message || "No fue posible guardar el cierre de caja en la base de datos.");
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
        "Pedidos aprobados": row.cantidadPedidos,
        "Pedidos cancelados": row.pedidosCancelados,
        "Total arreglos": row.totalArreglos,
        "Total domicilios": row.totalDomicilios,
        "Recargos link": row.totalRecargos,
        Descuentos: row.totalDescuentos,
        "Saldo a favor": Number(row.totalSaldoFavor || 0),
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
        Estado: row.cancelado ? "Cancelado" : row.estado || "",
        "Saldo a favor": Number(row.saldoFavorMonto || 0),
        "Nota saldo a favor": row.saldoFavorNota || "",
        "Descuento aplicado": row.descuentoMonto || 0,
        "Nota descuento": row.descuentoNota || "",
        "Notas descuentos/saldos a favor": formatAdjustmentNotesForExport(row),
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
        Guardado: row.guardado,
        NuevaBase: row.nuevaBase,
        Observacion: row.observacion,
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
          barrios: canViewBarrios,
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
          barrios: onGoBarrios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
      />

      <main className="orders-admin-view accounting-view accounting-page-view">
        <header className="orders-admin-header orders-page-header accounting-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-breadcrumb" aria-label="Ruta">
              <span>Finanzas</span>
              <span>/</span>
              <strong>Contabilidad</strong>
            </div>
            <div className="orders-page-title-row">
              <h1>Contabilidad</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">
              Controla ventas, recaudos, descuentos, saldos a favor y cierres de caja por periodo.
            </p>
            <span className="orders-user-pill">
              <span aria-hidden="true" />
              Sesion activa: {displayUserName}
            </span>
          </div>
          <div className="orders-header-side">
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
          <div className="orders-header-metrics accounting-header-metrics" aria-label="Resumen contabilidad">
            <article className="orders-header-metric-card is-primary">
                <span className="orders-header-metric-icon" aria-hidden="true"><ShoppingCart size={20} strokeWidth={2} /></span>
                <strong>${formatearCOP(summaryTotals.totalVenta)}</strong>
                <span>Total venta</span>
              </article>
              <article className="orders-header-metric-card is-success">
                <span className="orders-header-metric-icon" aria-hidden="true"><Banknote size={20} strokeWidth={2} /></span>
                <strong>${formatearCOP(summaryTotals.totalEfectivo)}</strong>
                <span>Efectivo</span>
              </article>
              <article className="orders-header-metric-card is-info">
                <span className="orders-header-metric-icon" aria-hidden="true"><Package size={20} strokeWidth={2} /></span>
                <strong>{summaryTotals.cantidadPedidos}</strong>
                <span>Pedidos aprobados</span>
              </article>
              <article className="orders-header-metric-card is-danger">
                <span className="orders-header-metric-icon" aria-hidden="true"><XCircle size={20} strokeWidth={2} /></span>
                <strong>{summaryTotals.pedidosCancelados}</strong>
                <span>Cancelados</span>
              </article>
              <article className="orders-header-metric-card is-warning">
                <span className="orders-header-metric-icon" aria-hidden="true"><Receipt size={20} strokeWidth={2} /></span>
                <strong>${formatearCOP(executiveMetrics.ticketPromedio)}</strong>
                <span>Ticket prom.</span>
              </article>
            </div>
          </div>
        </header>

        <section className="orders-filters orders-page-filters accounting-filters">
          <div className="accounting-date-range-control">
            <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
            <input type="date" value={filters.fechaDesde} onChange={event => applyFilter("fechaDesde", event.target.value)} />
            <span>-</span>
            <input type="date" value={filters.fechaHasta} onChange={event => applyFilter("fechaHasta", event.target.value)} />
            <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="accounting-period-tabs" aria-label="Atajos de periodo">
            <button type="button" className={activePeriodPreset === "today" ? "is-active" : ""} onClick={() => applyPeriodPreset("today")}>Hoy</button>
            <button type="button" className={activePeriodPreset === "yesterday" ? "is-active" : ""} onClick={() => applyPeriodPreset("yesterday")}>Ayer</button>
            <button type="button" className={activePeriodPreset === "7days" ? "is-active" : ""} onClick={() => applyPeriodPreset("7days")}>7 dias</button>
            <button type="button" className={activePeriodPreset === "30days" ? "is-active" : ""} onClick={() => applyPeriodPreset("30days")}>30 dias</button>
            <button type="button" className={activePeriodPreset === "month" ? "is-active" : ""} onClick={() => applyPeriodPreset("month")}>Este mes</button>
          </div>
          <button type="button" className="accounting-filter-chip">
            <Filter size={15} strokeWidth={2} aria-hidden="true" />
            <span>Filtros</span>
          </button>
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
            <button type="button" className="btn-outline accounting-export-btn" onClick={exportVentas} disabled={orderRows.length === 0}>
              <FileSpreadsheet size={15} strokeWidth={2} aria-hidden="true" />
              Exportar Excel
            </button>
            <button type="button" className="btn-outline accounting-export-btn">
              <FileText size={15} strokeWidth={2} aria-hidden="true" />
              Exportar PDF
            </button>
            <button type="button" className="btn-outline accounting-more-btn" title="Mas acciones">
              <MoreHorizontal size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </section>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}

        {activeView === "ventas" ? (
          <>
            <section className="accounting-reference-main">
              <article className="accounting-reference-panel accounting-reference-financial">
                <div className="accounting-reference-panel-head">
                  <div>
                    <h3>Resumen financiero</h3>
                    <span>Las cifras incluyen impuestos y movimientos registrados en el periodo.</span>
                  </div>
                  <CircleAlert size={15} strokeWidth={2} aria-hidden="true" />
                </div>
            <section className="accounting-summary-cards accounting-summary-cards--top">
              <article className="order-block accounting-stat-card">
                <span>Ventas brutas</span>
                <strong>${formatearCOP(summaryTotals.totalArreglos + summaryTotals.totalDomicilios + summaryTotals.totalRecargos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Descuentos</span>
                <strong>-${formatearCOP(summaryTotals.totalDescuentos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Saldo a favor</span>
                <strong>${formatearCOP(Number(summaryTotals.totalSaldoFavor || 0))}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Ventas netas</span>
                <strong>${formatearCOP(summaryTotals.totalVenta)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Ajustes / cancelaciones</span>
                <strong>{summaryTotals.pedidosCancelados}</strong>
              </article>
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
                  ) : (
                    <ResponsiveContainer width="100%" height={248}>
                      <AreaChart data={salesTrendRows} margin={{ top: 12, right: 18, left: 4, bottom: 6 }}>
                        <defs>
                          <linearGradient id="accountingSalesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d9367a" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#d9367a" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#eef2f7" vertical={false} />
                        <XAxis
                          dataKey="shortLabel"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }}
                          tickFormatter={value => `$${formatearCOP(value)}`}
                          width={76}
                        />
                        <Tooltip content={<AccountingSalesTooltip />} cursor={{ stroke: "#d9367a", strokeOpacity: 0.18 }} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name="Ventas"
                          stroke="#d9367a"
                          strokeWidth={3}
                          fill="url(#accountingSalesGradient)"
                          activeDot={{ r: 6, strokeWidth: 3, stroke: "#ffffff", fill: "#d9367a" }}
                          dot={{ r: 4, strokeWidth: 2, stroke: "#ffffff", fill: "#d9367a" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
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
              </article>

              <article className="accounting-reference-panel accounting-reference-cash">
                <div className="accounting-reference-panel-head">
                  <div>
                    <h3>Conciliacion y caja</h3>
                    <span>Sigue los pasos para validar el cuadre correcto.</span>
                  </div>
                  <CircleAlert size={15} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="accounting-cash-guide-note">
                  <CircleCheck size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Sigue los pasos para cerrar tu caja y asegurar el cuadre correcto.</span>
                </div>
                <div className="accounting-cash-steps">
                  {[
                    ["Base inicial", baseValue],
                    ["Ingresos en efectivo", efectivoValue],
                    ["Gastos en efectivo", gastoValue],
                    ["Guardado (retiros)", guardadoValue],
                  ].map(([label, value], index) => (
                    <div key={label} className="accounting-cash-step">
                      <span>{index + 1}</span>
                      <strong>{label}</strong>
                      <em>${formatearCOP(value)}</em>
                    </div>
                  ))}
                </div>
                <div className="accounting-cash-result">
                  <p><span>Nueva base (esperada)</span><strong>${formatearCOP(nuevaBaseValue)}</strong></p>
                  <p><span>Nueva base (contada)</span><strong>${formatearCOP(nuevaBaseValue)}</strong></p>
                </div>
                <div className="accounting-cash-ok-card">
                  <CircleCheck size={18} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <strong>Cuadre correcto</strong>
                    <span>La caja esta cuadrada.</span>
                  </div>
                  <em>Diferencia<br /><b>$0</b></em>
                </div>
              </article>
            </section>

            <section className="accounting-reference-alerts" aria-label="Alertas financieras">
              <article className="accounting-reference-alert is-discount">
                <span><Tag size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p>Descuentos aplicados</p>
                  <strong>${formatearCOP(detailInsight.totalDescuentos)}</strong>
                  <small>{summaryTotals.totalVenta > 0 ? `${roundMoney((detailInsight.totalDescuentos / summaryTotals.totalVenta) * 100)}% de las ventas` : "0% de las ventas"}</small>
                </div>
                <button type="button" onClick={() => showAccountingDetail("descuento")}>Ver detalle</button>
              </article>
              <article className="accounting-reference-alert is-balance">
                <span><BadgeDollarSign size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p>Saldo a favor</p>
                  <strong>${formatearCOP(detailInsight.totalSaldoFavor)}</strong>
                  <small>{detailInsight.pedidosConSaldo} pedidos</small>
                </div>
                <button type="button" onClick={() => showAccountingDetail("saldo")}>Ver detalle</button>
              </article>
              <article className="accounting-reference-alert is-cancel">
                <span><XCircle size={18} strokeWidth={2} aria-hidden="true" /></span>
                <div>
                  <p>Pedidos cancelados</p>
                  <strong>{detailInsight.cancelados}</strong>
                  <small>{summaryTotals.cantidadPedidos > 0 ? `${executiveMetrics.cancelacionesPct}% del total` : "0% del total"}</small>
                </div>
                <button type="button" onClick={() => showAccountingDetail("cancelados")}>Ver detalle</button>
              </article>
            </section>

            <div className="accounting-table-actions">
              <div>
                <h3>Auditoria de pedidos</h3>
                <span>Mostrando resumen financiero por dia del periodo.</span>
              </div>
              <div className="accounting-table-tools">
                <label>
                  <Search size={15} strokeWidth={2} aria-hidden="true" />
                  <input type="search" placeholder="Buscar pedido, cliente o usuario..." />
                </label>
                <button type="button" className="btn-outline"><Columns3 size={15} strokeWidth={2} aria-hidden="true" /> Columnas</button>
                <button type="button" className="btn-outline"><Download size={15} strokeWidth={2} aria-hidden="true" /></button>
              </div>
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
                      <td>${formatearCOP(Number(row.totalSaldoFavor || 0))}</td>
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
                      <th>${formatearCOP(Number(summaryTotals.totalSaldoFavor || 0))}</th>
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
                <p className="orders-admin-subtitle">Control de descuentos aplicados por saldo a favor o descuento comercial, saldos a favor por pagos excedidos, notas operativas y cancelaciones del periodo.</p>
              </div>
              <div className="accounting-arrangements-actions">
                <button type="button" className="btn-outline" onClick={exportDetalleVentas} disabled={filteredAccountingDetailRows.length === 0}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <section className="accounting-summary-cards accounting-summary-cards--detail">
              <article className="order-block accounting-stat-card">
                <span>Descuento</span>
                <strong>${formatearCOP(detailInsight.totalDescuentos)}</strong>
              </article>
              <article className="order-block accounting-stat-card">
                <span>Saldo a favor</span>
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
                  detailInsight.totalDescuentos > 0 ? `Hay $${formatearCOP(detailInsight.totalDescuentos)} en descuentos aplicados por saldo a favor o descuento comercial.` : "No hay descuentos aplicados en el periodo.",
                  detailInsight.totalSaldoFavor > 0 ? `El saldo a favor por pagos excedidos acumulado es $${formatearCOP(detailInsight.totalSaldoFavor)}.` : "No hay saldos a favor pendientes.",
                  detailInsight.pedidosConNotas > 0 ? `${detailInsight.pedidosConNotas} pedidos tienen notas de descuentos o saldos a favor.` : "No hay notas de descuentos o saldos a favor.",
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
                    <span>Mayor descuento aplicado</span>
                    <strong>{detailInsight.topDescuento ? `#${detailInsight.topDescuento.numeroPedido || detailInsight.topDescuento.pedidoID}` : "-"}</strong>
                    <small>{detailInsight.topDescuento ? `$${formatearCOP(detailInsight.topDescuento.descuentoMonto)}` : "Sin descuentos"}</small>
                  </p>
                  <p>
                    <span>Mayor saldo a favor</span>
                    <strong>{detailInsight.topSaldo ? `#${detailInsight.topSaldo.numeroPedido || detailInsight.topSaldo.pedidoID}` : "-"}</strong>
                    <small>{detailInsight.topSaldo ? `$${formatearCOP(Number(detailInsight.topSaldo.saldoFavorMonto || 0))}` : "Sin saldos"}</small>
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
                ["descuento", "Con descuento aplicado"],
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

            {selectedAccountingCase ? (
              <section className="accounting-case-detail-card" aria-label="Detalle del caso contable">
                <div>
                  <span>Pedido</span>
                  <strong>#{selectedAccountingCase.numeroPedido || selectedAccountingCase.codigoPedido || selectedAccountingCase.pedidoID}</strong>
                </div>
                <div>
                  <span>Cliente</span>
                  <strong>{selectedAccountingCase.cliente || "-"}</strong>
                  <small>{selectedAccountingCase.telefono || selectedAccountingCase.telefonoCliente || selectedAccountingCase.celular || "-"}</small>
                </div>
                <div>
                  <span>Cuenta pago</span>
                  <strong>{selectedAccountingCase.cuentaPago || "-"}</strong>
                </div>
                <div>
                  <span>Descuento aplicado</span>
                  <strong>${formatearCOP(selectedAccountingCase.descuentoMonto || 0)}</strong>
                  <small>{selectedAccountingCase.descuentoNota || "Sin nota"}</small>
                </div>
                <div>
                  <span>Saldo a favor</span>
                  <strong>${formatearCOP(Number(selectedAccountingCase.saldoFavorMonto || 0))}</strong>
                  <small>{selectedAccountingCase.saldoFavorNota || "Sin nota"}</small>
                </div>
                <button type="button" className="btn-outline" onClick={() => setSelectedAccountingCase(null)}>Cerrar</button>
              </section>
            ) : null}

            <section className="orders-table-wrap">
              <table className="orders-table accounting-table accounting-detail-table">
                <thead>
                  <tr>
                    <th># Pedido</th>
                    <th>Usuario sistema</th>
                    <th>Cliente</th>
                    <th>Cuenta pago</th>
                    <th>Saldo a favor</th>
                    <th>Descuento aplicado</th>
                    <th>Notas descuentos/saldos a favor</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccountingDetailRows.length === 0 ? (
                    <tr>
                      <td colSpan={9}>{loading ? "Cargando detalle..." : "No hay pedidos para el filtro seleccionado."}</td>
                    </tr>
                  ) : filteredAccountingDetailRows.map(row => {
                    const adjustmentNotes = getAdjustmentNoteItems(row);
                    return (
                    <tr key={`${row.pedidoID}-${row.numeroPedido}`}>
                      <td>{row.numeroPedido || row.codigoPedido || row.pedidoID}</td>
                      <td>{row.usuarioSistema || "-"}</td>
                      <td>
                        <strong>{row.cliente || "-"}</strong>
                        <span>{row.telefono || row.telefonoCliente || row.celular || "-"}</span>
                      </td>
                      <td>{row.cuentaPago || "-"}</td>
                      <td>
                        <strong>${formatearCOP(Number(row.saldoFavorMonto || 0))}</strong>
                      </td>
                      <td>
                        <strong>${formatearCOP(row.descuentoMonto || 0)}</strong>
                      </td>
                      <td>
                        {adjustmentNotes.length > 0 ? (
                          <div className="accounting-adjustment-notes">
                            {adjustmentNotes.map(item => (
                              <span key={`${item.label}-${item.note}`}>
                                {item.note}
                              </span>
                            ))}
                          </div>
                        ) : "-"}
                      </td>
                      <td>
                        <span className={`order-badge ${row.cancelado ? "is-cancelado" : "is-aprobado"}`}>
                          {row.cancelado ? "Cancelado" : row.estado || "Activo"}
                        </span>
                        {row.notaCancelacion ? <small>{row.notaCancelacion}</small> : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-outline accounting-row-detail-btn"
                          title="Ver informacion del caso"
                          onClick={() => setSelectedAccountingCase(row)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                    );
                  })}
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
                <p className="orders-admin-subtitle">Cierre de efectivo por fecha. Los datos se consultan y guardan en base de datos.</p>
              </div>
            </div>

            <section className="accounting-analytics-panel accounting-cash-dashboard">
              <div className="accounting-panel-head">
                <div>
                  <span>Dashboard de caja</span>
                  <h3>{cashDashboardTotals.source === "period" ? "Balance financiero del periodo" : "Balance financiero del cierre"}</h3>
                </div>
                <Wallet size={22} strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="accounting-cash-kpis">
                {[
                  ["Caja inicial", cashDashboardTotals.base],
                  ["Ingresos efectivo", cashDashboardTotals.efectivo],
                  ["Gastos", cashDashboardTotals.gasto],
                  ["Caja final", cashDashboardTotals.totalEfectivo],
                  ["Guardado", cashDashboardTotals.guardado],
                  ["Nueva base", cashDashboardTotals.nuevaBase],
                ].map(([label, value]) => (
                  <article key={label} className="accounting-cash-kpi">
                    <span>{label}</span>
                    <strong>${formatearCOP(value)}</strong>
                  </article>
                ))}
              </div>
              <div className={`accounting-cash-balance ${cashDashboardTotals.nuevaBase >= 0 ? "is-ok" : "is-risk"}`}>
                {cashDashboardTotals.nuevaBase >= 0 ? <CircleCheck size={18} strokeWidth={2} aria-hidden="true" /> : <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />}
                <span>{cashDashboardTotals.nuevaBase >= 0 ? "Cuadre correcto" : "Diferencia encontrada"}</span>
                <strong>${formatearCOP(Math.abs(cashDashboardTotals.nuevaBase))}</strong>
              </div>
            </section>

            <div className="accounting-cash-grid">
              <label className="order-detail-edit-label">
                Fecha
                <input type="date" max={todayCashDate} value={cashForm.fecha} onChange={event => setCashForm(current => ({ ...current, fecha: event.target.value }))} />
              </label>
              <label className="order-detail-edit-label">
                Base
                <input type="number" min="0" step="0.01" value={cashForm.base} onChange={event => setCashForm(current => ({ ...current, base: event.target.value }))} placeholder="0.00" disabled={!canEditCashClosing} />
              </label>
              <label className="order-detail-edit-label">
                Efectivo
                <input type="text" value={`$${formatearCOP(efectivoValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Gasto
                <input type="number" min="0" step="0.01" value={cashForm.gasto} onChange={event => setCashForm(current => ({ ...current, gasto: event.target.value }))} placeholder="0.00" disabled={!canEditCashClosing} />
              </label>
              <label className="order-detail-edit-label">
                T. Efectivo
                <input type="text" value={`$${formatearCOP(totalEfectivoCaja)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Guardado
                <input type="number" min="0" step="0.01" value={cashForm.guardado} onChange={event => setCashForm(current => ({ ...current, guardado: event.target.value }))} placeholder="0.00" disabled={!canEditCashClosing} />
              </label>
              <label className="order-detail-edit-label">
                Nueva Base
                <input type="text" value={`$${formatearCOP(nuevaBaseValue)}`} readOnly className="order-detail-edit-readonly" />
              </label>
              <label className="order-detail-edit-label">
                Observación
                <input type="text" value={cashForm.observacion} onChange={event => setCashForm(current => ({ ...current, observacion: event.target.value }))} placeholder="Observación del cierre" disabled={!canEditCashClosing} />
              </label>
            </div>

            <div className="order-detail-edit-actions">
              <button type="button" className="btn-primary" onClick={saveCashClosing} disabled={saving || !canEditCashClosing}>
                {saving ? "Guardando..." : "Guardar cierre"}
              </button>
              <button type="button" className="btn-outline" onClick={exportCaja} disabled={cashHistoryRows.length === 0}>
                Descargar Excel
              </button>
            </div>

            <section className="orders-table-wrap accounting-cash-history">
              <div className="accounting-cash-history-head">
                <div>
                  <h4>Dias cerrados</h4>
                  <p className="orders-admin-subtitle">Historial de cierres guardados para esta empresa y sucursal.</p>
                </div>
                <span>{cashHistoryRows.length} cierres</span>
              </div>
              <table className="orders-table accounting-table">
                <thead>
                  <tr>
                    <th>Dia cerrado</th>
                    <th>Base</th>
                    <th>Efectivo</th>
                    <th>Gasto</th>
                    <th>Total_Efectivo</th>
                    <th>Guardado</th>
                    <th>Nueva_Base</th>
                    <th>Observacion</th>
                  </tr>
                </thead>
                <tbody>
                  {cashHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>{cashLoading ? "Cargando cierres de caja..." : "No hay cierres de caja guardados en base de datos para el rango filtrado."}</td>
                    </tr>
                  ) : cashHistoryRows.map(row => (
                    <tr key={row.fecha}>
                      <td>{row.fecha}</td>
                      <td>${formatearCOP(row.base)}</td>
                      <td>${formatearCOP(row.efectivo)}</td>
                      <td>${formatearCOP(row.gasto)}</td>
                      <td>${formatearCOP(row.totalEfectivo)}</td>
                      <td>${formatearCOP(row.guardado)}</td>
                      <td>${formatearCOP(row.nuevaBase)}</td>
                      <td>{row.observacion || "-"}</td>
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

function formatAccountingLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAccountingPeriodRange(preset) {
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

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeCashSummaryRow(raw, fallbackFecha = "") {
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

function getCashClosingSource(raw) {
  return raw?.item || raw?.data || (Array.isArray(raw?.items) ? raw.items[0] : null) || raw;
}

function hasCashClosingData(raw) {
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

function normalizeCashClosingRow(raw, fallbackFecha = "") {
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
