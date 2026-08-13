import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../../config/tenantConfig.js";
import { createApiClient } from "../../../infrastructure/apiClient.js";
import { formatearCOP } from "../../../shared/utils.js";
import { initialCashForm, initialFilters } from "../accountingConstants.js";
import { buildArrangementExportRows, buildCashExportRows, buildDeliveryPersonOrdersExportRows, buildPaymentAccountExportRows, buildPersonnelExportRows, buildSalesDetailExportRows, buildSalesExportRows, exportRowsToExcel } from "../accountingExports.js";
import { buildArrangementSummary, buildDetailChartRows, buildDetailInsight, buildPaymentSummary, buildPersonnelSummary, buildSummaryTotals } from "../accountingSelectors.js";
import { filterAccountingDetailRows, formatAccountingLocalDate, getAccountingPeriodRange, hasCashClosingData, normalizeCashClosingRow, normalizeCashSummaryRow, parseMoneyInput, roundMoney } from "../accountingDomain.js";
import { useAccountingData } from "./useAccountingData.js";

export function useAccountingController({ session }) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sessionSucursalValue = session?.sucursalID ?? session?.sucursalId ?? session?.sucursal_id;
  const selectedSucursalId = sessionSucursalValue != null && String(sessionSucursalValue).trim() !== ""
    ? Number(sessionSucursalValue)
    : null;
  const sucursalId = Number.isFinite(selectedSucursalId) ? selectedSucursalId : Number(tenantConfig.sucursalId);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

  const [activeView, setActiveView] = useState("ventas");
  const [personnelMode, setPersonnelMode] = useState("domiciliarios");
  const [personnelTypeFilter, setPersonnelTypeFilter] = useState("todos");
  const [personnelSearch, setPersonnelSearch] = useState("");
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
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailFilter, setDetailFilter] = useState("todos");
  const [selectedAccountingCase, setSelectedAccountingCase] = useState(null);
  const [selectedArrangementKeys, setSelectedArrangementKeys] = useState([]);
  const [deliveryPersonOrdersDetail, setDeliveryPersonOrdersDetail] = useState({
    loading: false,
    error: "",
    payload: null,
    selectedRow: null,
  });
  const [activeDeliveryPersonOrdersStatus, setActiveDeliveryPersonOrdersStatus] = useState("");
  const [cashHistoryRows, setCashHistoryRows] = useState([]);
  const [cashLoading, setCashLoading] = useState(false);
  const {
    loading,
    error,
    setError,
    orderRows,
    arrangementRows,
    paymentAccountRows,
    floristMetricRows,
    deliveryPersonMetricRows,
    accountingDetailRows,
    loadAccountingData,
  } = useAccountingData({ api, empresaId, sucursalId, selectedSucursalId, filters });
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

  const summaryTotals = useMemo(() => buildSummaryTotals(orderRows, accountingDetailRows), [orderRows, accountingDetailRows]);

  const filteredAccountingDetailRows = useMemo(() => {
    return filterAccountingDetailRows(accountingDetailRows, detailFilter);
  }, [accountingDetailRows, detailFilter]);

  const detailInsight = useMemo(() => buildDetailInsight(accountingDetailRows), [accountingDetailRows]);

  const detailChartRows = useMemo(() => buildDetailChartRows(detailInsight), [detailInsight]);

  const selectedArrangementRows = useMemo(() => {
    const selected = new Set(selectedArrangementKeys);
    return arrangementRows.filter(item => selected.has(item.key));
  }, [arrangementRows, selectedArrangementKeys]);

  const arrangementSummary = useMemo(() => buildArrangementSummary(selectedArrangementRows), [selectedArrangementRows]);

  const topArrangementByUnits = selectedArrangementRows[0] || null;
  const topArrangementBySales = useMemo(
    () => [...selectedArrangementRows].sort((a, b) => b.totalVendido - a.totalVendido)[0] || null,
    [selectedArrangementRows]
  );
  const arrangementChartRows = useMemo(() => selectedArrangementRows.slice(0, 8), [selectedArrangementRows]);

  const paymentSummary = useMemo(() => buildPaymentSummary(paymentAccountRows), [paymentAccountRows]);
  const topPaymentAccount = paymentAccountRows[0] || null;

  const personnelSummary = useMemo(() => buildPersonnelSummary(floristMetricRows, deliveryPersonMetricRows), [floristMetricRows, deliveryPersonMetricRows]);

  const personnelDashboardRows = useMemo(() => {
    const sourceRows = personnelMode === "floristas" ? floristMetricRows : deliveryPersonMetricRows;
    const search = personnelSearch.trim().toLowerCase();
    return sourceRows.filter(item => {
      const matchesType = personnelTypeFilter === "todos" || String(item.tipo || "Sin tipo") === personnelTypeFilter;
      const searchable = [
        item.nombre,
        item.tipo,
        item.id,
        ...(Array.isArray(item.barrios) ? item.barrios.map(barrio => barrio.nombre) : []),
      ].join(" ").toLowerCase();
      return matchesType && (!search || searchable.includes(search));
    });
  }, [deliveryPersonMetricRows, floristMetricRows, personnelMode, personnelSearch, personnelTypeFilter]);

  const personnelTypeOptions = useMemo(() => {
    const sourceRows = personnelMode === "floristas" ? floristMetricRows : deliveryPersonMetricRows;
    return Array.from(new Set(sourceRows.map(item => String(item.tipo || "Sin tipo").trim() || "Sin tipo"))).sort((a, b) => a.localeCompare(b));
  }, [deliveryPersonMetricRows, floristMetricRows, personnelMode]);

  useEffect(() => {
    if (personnelTypeFilter === "todos") return;
    if (!personnelTypeOptions.includes(personnelTypeFilter)) setPersonnelTypeFilter("todos");
  }, [personnelTypeFilter, personnelTypeOptions]);

  const personnelDashboardSummary = useMemo(() => {
    const totalRows = personnelMode === "floristas" ? floristMetricRows : deliveryPersonMetricRows;
    const totals = personnelDashboardRows.reduce((acc, item) => ({
      personas: acc.personas + 1,
      pedidos: acc.pedidos + Number(item.pedidos || 0),
      unidades: acc.unidades + Number(personnelMode === "floristas" ? item.arreglos || 0 : item.entregas || 0),
      total: acc.total + Number(personnelMode === "floristas" ? item.totalVendido || 0 : item.totalDomicilios || 0),
      completados: acc.completados + Number(item.completados || 0),
      enProceso: acc.enProceso + Number(item.enProceso || 0),
      pendientes: acc.pendientes + Number(item.pendientes || 0),
      cancelados: acc.cancelados + Number(item.cancelados || 0),
      reprogramadas: acc.reprogramadas + Number(item.reprogramadas || 0),
      tiempoTotal: acc.tiempoTotal + Number(item.tiempoPromedioMin || 0),
      tiempoConteo: acc.tiempoConteo + (Number(item.tiempoPromedioMin || 0) > 0 ? 1 : 0),
    }), {
      personas: 0,
      pedidos: 0,
      unidades: 0,
      total: 0,
      completados: 0,
      enProceso: 0,
      pendientes: 0,
      cancelados: 0,
      reprogramadas: 0,
      tiempoTotal: 0,
      tiempoConteo: 0,
    });
    const typeRows = Array.from(personnelDashboardRows.reduce((map, item) => {
      const tipo = String(item.tipo || "Sin tipo").trim() || "Sin tipo";
      const current = map.get(tipo) || { key: tipo, label: tipo, value: 0, total: 0 };
      current.value += Number(personnelMode === "floristas" ? item.arreglos || 0 : item.entregas || 0);
      current.total += Number(personnelMode === "floristas" ? item.totalVendido || 0 : item.totalDomicilios || 0);
      map.set(tipo, current);
      return map;
    }, new Map()).values()).sort((a, b) => b.value - a.value || b.total - a.total);
    const dayRows = orderRows.map(row => ({
      key: row.fecha,
      label: row.fecha,
      shortLabel: String(row.fecha || "").slice(5),
      value: Number(row.cantidadPedidos || 0),
    })).filter(row => row.value > 0);
    const leader = [...personnelDashboardRows].sort((a, b) => {
      const totalA = Number(personnelMode === "floristas" ? a.totalVendido || 0 : a.totalDomicilios || 0);
      const totalB = Number(personnelMode === "floristas" ? b.totalVendido || 0 : b.totalDomicilios || 0);
      return totalB - totalA;
    })[0] || null;
    return {
      ...totals,
      personasDisponibles: totalRows.length,
      total: roundMoney(totals.total),
      promedio: totals.unidades > 0 ? roundMoney(totals.total / totals.unidades) : 0,
      cumplimientoPct: totals.unidades > 0 ? roundMoney((totals.completados / totals.unidades) * 100) : 0,
      tiempoPromedioMin: totals.tiempoConteo > 0 ? roundMoney(totals.tiempoTotal / totals.tiempoConteo) : 0,
      typeRows,
      dayRows,
      leader,
    };
  }, [deliveryPersonMetricRows, floristMetricRows, orderRows, personnelDashboardRows, personnelMode]);

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

  const clearDeliveryPersonOrdersDetail = () => {
    setActiveDeliveryPersonOrdersStatus("");
    setDeliveryPersonOrdersDetail({
      loading: false,
      error: "",
      payload: null,
      selectedRow: null,
    });
  };

  const loadDeliveryPersonOrdersDetail = async (row, estadoEntrega = "") => {
    const domiciliarioID = Number(row?.id || 0);
    if (!domiciliarioID) {
      setDeliveryPersonOrdersDetail({
        loading: false,
        error: "No se encontro el ID del domiciliario para consultar pedidos.",
        payload: null,
        selectedRow: row || null,
      });
      return;
    }

    setDeliveryPersonOrdersDetail({
      loading: true,
      error: "",
      payload: null,
      selectedRow: row,
    });

    try {
      setActiveDeliveryPersonOrdersStatus(estadoEntrega);
      const payload = await api.obtenerPedidosDomiciliarioContabilidad({
        empresaId,
        sucursalId,
        domiciliarioID,
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        estadoEntrega,
      });
      setDeliveryPersonOrdersDetail({
        loading: false,
        error: "",
        payload,
        selectedRow: row,
      });
    } catch (nextError) {
      setDeliveryPersonOrdersDetail({
        loading: false,
        error: nextError?.status === 500
          ? "El backend respondio con error interno al consultar los pedidos del domiciliario. Revisa que el endpoint nuevo este publicado y acepte empresaID, sucursalID, fechaDesde y fechaHasta."
          : nextError?.detail || nextError?.message || "No fue posible cargar los pedidos del domiciliario.",
        payload: null,
        selectedRow: row,
      });
    }
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

  const exportToExcel = useCallback((rows, filename, sheetName) => {
    return exportRowsToExcel(rows, filename, sheetName, () => setInfo("No hay datos para exportar."));
  }, []);

  const exportVentas = () => {
    exportToExcel(
      buildSalesExportRows(orderRows),
      `contabilidad-ventas-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Ventas"
    );
  };

  const exportDetalleVentas = () => {
    exportToExcel(
      buildSalesDetailExportRows(filteredAccountingDetailRows),
      `contabilidad-detalle-ventas-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Detalle ventas"
    );
  };

  const exportArreglos = () => {
    exportToExcel(
      buildArrangementExportRows(selectedArrangementRows),
      `contabilidad-arreglos-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Arreglos"
    );
  };

  const exportCuentas = () => {
    exportToExcel(
      buildPaymentAccountExportRows(paymentAccountRows),
      `contabilidad-cuentas-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Cuentas"
    );
  };

  const exportPersonal = () => {
    exportToExcel(
      buildPersonnelExportRows(floristMetricRows, deliveryPersonMetricRows),
      `contabilidad-personal-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Personal"
    );
  };

  const exportCaja = () => {
    exportToExcel(
      buildCashExportRows(cashHistoryRows),
      `contabilidad-caja-${cashForm.fecha || filters.fechaHasta}.xlsx`,
      "Caja"
    );
  };

  const exportDeliveryPersonOrdersDetail = () => {
    const items = Array.isArray(deliveryPersonOrdersDetail.payload?.items)
      ? deliveryPersonOrdersDetail.payload.items
      : [];
    const deliveryPersonName = String(
      deliveryPersonOrdersDetail.selectedRow?.nombre ||
      deliveryPersonOrdersDetail.payload?.domiciliario?.nombre ||
      "domiciliario"
    )
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "domiciliario";

    exportToExcel(
      buildDeliveryPersonOrdersExportRows(items),
      `contabilidad-domiciliario-${deliveryPersonName}-${filters.fechaDesde}-${filters.fechaHasta}.xlsx`,
      "Pedidos domiciliario"
    );
  };

  const activeExportAction = (() => {
    if (activeView === "detalle") return { onClick: exportDetalleVentas, disabled: filteredAccountingDetailRows.length === 0 };
    if (activeView === "arreglos") return { onClick: exportArreglos, disabled: selectedArrangementRows.length === 0 };
    if (activeView === "personal") return { onClick: exportPersonal, disabled: floristMetricRows.length === 0 && deliveryPersonMetricRows.length === 0 };
    if (activeView === "cuentas") return { onClick: exportCuentas, disabled: paymentAccountRows.length === 0 };
    if (activeView === "caja") return { onClick: exportCaja, disabled: cashHistoryRows.length === 0 };
    return { onClick: exportVentas, disabled: orderRows.length === 0 };
  })();
  return {
    activeDeliveryPersonOrdersStatus,
    activeExportAction,
    activePeriodPreset,
    activeView,
    accountingMenuOpen,
    accountingMenuRef,
    applyFilter,
    applyPeriodPreset,
    arrangementChartRows,
    arrangementRows,
    arrangementSummary,
    baseValue,
    canEditCashClosing,
    cashDashboardTotals,
    cashForm,
    cashHistoryRows,
    cashLoading,
    clearAllArrangements,
    clearDeliveryPersonOrdersDetail,
    deliveryPersonMetricRows,
    deliveryPersonOrdersDetail,
    detailChartRows,
    detailFilter,
    detailInsight,
    displayUserName,
    efectivoValue,
    executiveMetrics,
    error,
    exportArreglos,
    exportCaja,
    exportCuentas,
    exportDeliveryPersonOrdersDetail,
    exportDetalleVentas,
    exportPersonal,
    exportVentas,
    filteredAccountingDetailRows,
    filters,
    floristMetricRows,
    gastoValue,
    guardadoValue,
    info,
    loadAccountingData,
    loadDeliveryPersonOrdersDetail,
    loading,
    moneyMapRows,
    monthlySalesRows,
    nuevaBaseValue,
    orderRows,
    paymentAccountRows,
    paymentSummary,
    personnelDashboardRows,
    personnelDashboardSummary,
    personnelMode,
    personnelSearch,
    personnelSummary,
    personnelTypeFilter,
    personnelTypeOptions,
    salesTrendRows,
    saveCashClosing,
    saving,
    selectAllArrangements,
    selectedAccountingCase,
    selectedArrangementKeys,
    selectedArrangementRows,
    setAccountingMenuOpen,
    setActiveView,
    setCashForm,
    setDetailFilter,
    setPersonnelMode,
    setPersonnelSearch,
    setPersonnelTypeFilter,
    setSelectedAccountingCase,
    showAccountingDetail,
    summaryTotals,
    todayCashDate,
    toggleArrangementSelection,
    topArrangementBySales,
    topArrangementByUnits,
    topPaymentAccount,
    totalEfectivoCaja,
  };}
