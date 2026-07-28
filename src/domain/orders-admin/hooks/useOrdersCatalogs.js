import { useMemo } from "react";

import {
  dedupeCatalogItems,
  normalizeCatalogItem,
} from "../orderCatalogAdapters.js";

function filterProductsByQuery(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;

  return items.filter(item => {
    const codigo = String(item.codigo || "").toLowerCase();
    const codigoProducto = String(item.codigoProducto || "").toLowerCase();
    const codigoCatalogo = String(item.codigoCatalogo || "").toLowerCase();
    const nombre = String(item.nombre || "").toLowerCase();
    return codigo.includes(q) || codigoProducto.includes(q) || codigoCatalogo.includes(q) || nombre.includes(q);
  });
}

function filterBarriosByQuery(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter(item => String(item?.nombre || "").toLowerCase().includes(q));
}

/**
 * Hook de catalogos del modulo Pedidos.
 *
 * Centraliza busqueda y filtros en memoria para que la pagina no repita la
 * misma logica de catalogo para editar, agregar y crear pedidos.
 */
export function useOrdersCatalogs({
  api,
  empresaId,
  sucursalId,
  detailCatalog,
  setDetailCatalog,
  detailFilterText,
  addFilterText,
  newOrderProductQuery,
  newOrderProducts,
  setNewOrderProducts,
  detailBarrios,
  detailBarrioQuery,
  newOrderBarrios,
  newOrderBarrioQuery,
  setDetailCatalogLoading,
  setNewOrderProductsLoading,
  setNewOrderError,
}) {
  const filteredDetailCatalog = useMemo(
    () => filterProductsByQuery(detailCatalog, detailFilterText),
    [detailCatalog, detailFilterText]
  );

  const filteredAddDetailCatalog = useMemo(
    () => filterProductsByQuery(detailCatalog, addFilterText),
    [addFilterText, detailCatalog]
  );

  const filteredNewOrderProducts = useMemo(() => {
    const source = newOrderProducts.length > 0 ? newOrderProducts : detailCatalog;
    return filterProductsByQuery(source, newOrderProductQuery);
  }, [detailCatalog, newOrderProductQuery, newOrderProducts]);

  const filteredBarrioOptions = useMemo(
    () => filterBarriosByQuery(detailBarrios, detailBarrioQuery),
    [detailBarrioQuery, detailBarrios]
  );

  const filteredNewOrderBarrios = useMemo(
    () => filterBarriosByQuery(newOrderBarrios, newOrderBarrioQuery),
    [newOrderBarrioQuery, newOrderBarrios]
  );

  const onSearchCatalog = async searchText => {
    const q = String((searchText ?? detailFilterText) || "").trim();
    if (!q) return;
    setDetailCatalogLoading(true);
    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
      setDetailCatalog(current => dedupeCatalogItems([...current, ...loaded]));
    } catch {
      // La busqueda de apoyo no bloquea el flujo de edicion.
    } finally {
      setDetailCatalogLoading(false);
    }
  };

  const onSearchNewOrderProducts = async searchText => {
    const q = String((searchText ?? newOrderProductQuery) || "").trim();
    if (!q) return;
    setNewOrderProductsLoading(true);
    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
      setNewOrderProducts(current => dedupeCatalogItems([...current, ...loaded]));
      setDetailCatalog(current => dedupeCatalogItems([...current, ...loaded]));
    } catch {
      setNewOrderError("No fue posible buscar arreglos.");
    } finally {
      setNewOrderProductsLoading(false);
    }
  };

  return {
    filteredDetailCatalog,
    filteredAddDetailCatalog,
    filteredNewOrderProducts,
    filteredBarrioOptions,
    filteredNewOrderBarrios,
    onSearchCatalog,
    onSearchNewOrderProducts,
  };
}
