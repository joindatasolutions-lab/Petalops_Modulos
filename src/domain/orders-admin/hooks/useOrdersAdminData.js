import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createOrdersDataController } from "../ordersDataController.js";
import { normalizeOrdersQuery } from "../ordersDataLoader.js";

export function useOrdersAdminData({ api, empresaId, sucursalId, filters, debouncedQuery }) {
  // Tenant changes get a fresh snapshot, without retaining another business's rows.
  const controller = useMemo(() => createOrdersDataController(api), [api, empresaId, sucursalId]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => () => controller.cancel(), [controller]);
  const query = normalizeOrdersQuery(filters.q ?? debouncedQuery);
  const settledQuery = normalizeOrdersQuery(debouncedQuery);
  const searchPending = query !== settledQuery;
  const loadOrders = useCallback((silent = false) => {
    if (searchPending) {
      controller.cancel();
      return Promise.resolve(undefined);
    }
    return controller.loadWhenSettled({ ...filters, q: query, empresaId, sucursalId }, settledQuery, { silent });
  }, [controller, empresaId, sucursalId, query, settledQuery, searchPending, filters.estado,
    filters.fechaDesde, filters.fechaHasta, filters.filtrarPorEntrega, filters.metodoPago,
    filters.page, filters.pageSize, filters.sinImprimir, filters.soloEntregasHoy, filters.soloTienda]);
  return {
    ...snapshot, loading: snapshot.loading || searchPending,
    ordersKpis: snapshot.kpis, resultPage: snapshot.page, resultPageSize: snapshot.pageSize,
    setItems: controller.setItems, loadOrders, clearOrdersCache: controller.invalidate,
  };
}
