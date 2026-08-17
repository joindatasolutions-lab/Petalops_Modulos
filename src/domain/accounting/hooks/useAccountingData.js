import { useCallback, useEffect, useState } from "react";

import {
  buildDeliveryPersonMetricRows,
  buildFloristMetricRows,
  buildPersonnelMetricsFromAccountingDetails,
  enrichDeliveryPersonMetricRowsWithDirectory,
} from "../accountingDomain.js";
import { applyApprovedOrderCountsToRows } from "../accountingSelectors.js";

function readArrayPayload(payload, keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return Array.isArray(payload) ? payload : [];
}

export function useAccountingData({ api, empresaId, sucursalId, selectedSucursalId, filters }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderRows, setOrderRows] = useState([]);
  const [orderTotals, setOrderTotals] = useState(null);
  const [arrangementRows, setArrangementRows] = useState([]);
  const [paymentAccountRows, setPaymentAccountRows] = useState([]);
  const [floristMetricRows, setFloristMetricRows] = useState([]);
  const [deliveryPersonMetricRows, setDeliveryPersonMetricRows] = useState([]);
  const [accountingDetailRows, setAccountingDetailRows] = useState([]);

  const loadAccountingData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = { empresaId, sucursalId, fechaDesde: filters.fechaDesde, fechaHasta: filters.fechaHasta };
      const payload = await api.obtenerResumenContabilidad(query);
      const nextDetailRows = Array.isArray(payload?.accountingDetailRows) ? payload.accountingDetailRows : [];
      let ventasDiarioPayload = null;
      try {
        ventasDiarioPayload = await api.obtenerVentasDiarioContabilidad(query);
      } catch (ventasError) {
        if (ventasError?.status !== 404) throw ventasError;
        console.warn("Resumen diario de ventas no disponible, usando resumen contable existente:", ventasError);
      }
      const nextOrderRows = Array.isArray(ventasDiarioPayload?.orderRows) ? ventasDiarioPayload.orderRows : [];
      const nextOrderTotals = ventasDiarioPayload?.totals && typeof ventasDiarioPayload.totals === "object"
        ? ventasDiarioPayload.totals
        : null;
      const derivedPersonnelRows = buildPersonnelMetricsFromAccountingDetails(nextDetailRows);
      const summaryDeliveryRows = readArrayPayload(payload, ["deliveryPersonRows", "domiciliarioRows", "domiciliarios"]);
      const nextDeliveryRows = buildDeliveryPersonMetricRows(summaryDeliveryRows);
      let resolvedFloristRows = [];
      let resolvedDeliveryRows = nextDeliveryRows.length > 0 ? nextDeliveryRows : derivedPersonnelRows.domiciliarioRows;

      try {
        const floristPayload = await api.obtenerResumenFloristasContabilidad({
          empresaId,
          sucursalId: Number.isFinite(selectedSucursalId) ? selectedSucursalId : null,
          fechaDesde: filters.fechaDesde,
          fechaHasta: filters.fechaHasta,
        });
        const floristRows = Array.isArray(floristPayload?.floristRows) ? floristPayload.floristRows
          : Array.isArray(floristPayload?.data?.floristRows) ? floristPayload.data.floristRows
            : [];
        resolvedFloristRows = buildFloristMetricRows(floristRows);
      } catch (personnelError) {
        if (personnelError?.status !== 404) console.warn("Resumen de floristas de contabilidad no disponible:", personnelError);
      }

      if (resolvedDeliveryRows.length === 0) {
        try {
          const deliveryPayload = await api.obtenerMetricasDomicilios({
            empresaId,
            sucursalId,
            fechaDesde: filters.fechaDesde,
            fechaHasta: filters.fechaHasta,
            agruparPor: "domiciliario",
          });
          const deliveryRows = readArrayPayload(deliveryPayload, ["porDomiciliario", "domiciliarios", "domiciliarioRows", "items"]);
          resolvedDeliveryRows = buildDeliveryPersonMetricRows(deliveryRows);
        } catch (personnelError) {
          if (personnelError?.status !== 404) console.warn("Metricas de domiciliarios no disponibles para contabilidad:", personnelError);
        }
      }

      if (resolvedDeliveryRows.length > 0) {
        try {
          const courierPayload = await api.listarDomiciliarios({
            empresaId,
            sucursalId,
            soloActivos: false,
          });
          const courierRows = readArrayPayload(courierPayload, ["items", "domiciliarios"]);
          resolvedDeliveryRows = enrichDeliveryPersonMetricRowsWithDirectory(resolvedDeliveryRows, courierRows);
        } catch (personnelError) {
          if (personnelError?.status !== 404) console.warn("Directorio de domiciliarios no disponible para contabilidad:", personnelError);
        }
      }

      setOrderRows(nextOrderRows.length > 0 ? nextOrderRows : applyApprovedOrderCountsToRows(payload?.orderRows, nextDetailRows));
      setOrderTotals(nextOrderTotals);
      setArrangementRows(Array.isArray(payload?.arrangementRows) ? payload.arrangementRows : []);
      setPaymentAccountRows(Array.isArray(payload?.paymentAccountRows) ? payload.paymentAccountRows : []);
      setAccountingDetailRows(nextDetailRows);
      setFloristMetricRows(resolvedFloristRows.filter(row => row?.id != null || (row?.nombre && row.nombre !== "Sin florista")));
      setDeliveryPersonMetricRows(resolvedDeliveryRows.filter(row => row?.id != null));
    } catch (nextError) {
      console.error("Error cargando contabilidad:", nextError);
      setOrderRows([]);
      setOrderTotals(null);
      setArrangementRows([]);
      setPaymentAccountRows([]);
      setFloristMetricRows([]);
      setDeliveryPersonMetricRows([]);
      setAccountingDetailRows([]);
      setError(nextError?.message || "No fue posible cargar el modulo de contabilidad.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, selectedSucursalId, sucursalId, filters.fechaDesde, filters.fechaHasta]);

  useEffect(() => {
    loadAccountingData();
  }, [loadAccountingData]);

  return {
    loading,
    error,
    setError,
    orderRows,
    orderTotals,
    arrangementRows,
    paymentAccountRows,
    floristMetricRows,
    deliveryPersonMetricRows,
    accountingDetailRows,
    loadAccountingData,
  };
}
