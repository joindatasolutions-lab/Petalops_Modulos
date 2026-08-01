/*
 * Hook de imagenes de produccion.
 * Carga catalogo, busca imagenes faltantes y mantiene la cache de imagenes
 * usada por cards, tabla, capsulas y drawers.
 */
import { useEffect, useMemo } from "react";
import {
  buildCatalogProductIndex,
  catalogOrCachedProductionImageForItem,
  catalogQueriesFromItems,
  dedupeCatalogItems,
  extractCatalogRows,
  normalizeCatalogItem,
  pipelinePedidoId,
  productionImageCacheKeys,
  productionItemKey,
  productionPedidoId,
  resolveCatalogImageByProductionCode,
  resolveDetailProductionImageUrl,
  resolvePedidoListProductionImageUrl,
  resolvePipelineProductionImageUrl,
} from "../productionCatalogImages.js";
import {
  isEmpresaCatalogCode,
  shouldUseCatalogCodeForProduction,
} from "../productionDomain.js";

export function useProductionImages({
  api,
  catalogProducts,
  canManageProductionActions,
  canResolveProductionImages,
  canViewCatalogo,
  canViewPedidos,
  canViewPipeline,
  empresaId,
  focusedVisibleItems,
  items,
  productionProductImages,
  setCatalogProducts,
  setProductionProductImages,
  sucursalId,
}) {
  const catalogProductIndex = useMemo(
    () => buildCatalogProductIndex(catalogProducts),
    [catalogProducts]
  );

  useEffect(() => {
    if (!canResolveProductionImages) return undefined;
    if (!canViewCatalogo) return undefined;
    let disposed = false;
    api.buscarArreglosCatalogo({ empresaId, sucursalId, q: "" })
      .then(payload => {
        if (disposed) return;
        const rows = extractCatalogRows(payload);
        setCatalogProducts(dedupeCatalogItems(rows.map(item => normalizeCatalogItem(item)).filter(Boolean)));
      })
      .catch(catalogError => {
        console.warn("No fue posible cargar imágenes del catálogo en producción:", catalogError);
        if (!disposed) setCatalogProducts([]);
      });

    return () => { disposed = true; };
  }, [api, canResolveProductionImages, canViewCatalogo, empresaId, sucursalId]);

  useEffect(() => {
    if (!canResolveProductionImages) return undefined;
    if (!canViewCatalogo) return undefined;
    if (items.length === 0) return undefined;
    let disposed = false;
    const queries = catalogQueriesFromItems(items, shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId));
    if (queries.length === 0) return undefined;

    Promise.allSettled(
      queries.map(query => api.buscarArreglosCatalogo({ empresaId, sucursalId, q: query }))
    )
      .then(results => {
        if (disposed) return;
        const nextCatalogItems = results
          .filter(result => result.status === "fulfilled")
          .flatMap(result => extractCatalogRows(result.value))
          .map(item => normalizeCatalogItem(item))
          .filter(Boolean);
        if (nextCatalogItems.length === 0) return;
        setCatalogProducts(current => dedupeCatalogItems([...current, ...nextCatalogItems]));
      })
      .catch(catalogError => {
        console.warn("No fue posible buscar imágenes adicionales de producción:", catalogError);
      });

    return () => { disposed = true; };
  }, [api, canResolveProductionImages, canViewCatalogo, empresaId, sucursalId, items]);

  useEffect(() => {
    if (!canResolveProductionImages) return undefined;
    const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId);
    const missingItems = focusedVisibleItems
      .filter(item => {
        const key = productionItemKey(item);
        return key && !catalogOrCachedProductionImageForItem(item, catalogProductIndex, productionProductImages, empresaId);
      })
      .slice(0, 20);

    if (missingItems.length === 0) return undefined;

    let disposed = false;
    Promise.allSettled(missingItems.map(async item => {
      let imageUrl = canViewCatalogo
        ? await resolveCatalogImageByProductionCode(api, empresaId, sucursalId, item, catalogProductIndex)
        : "";
      if (!imageUrl && canViewPedidos && item.numeroPedido) {
        try {
          imageUrl = await resolvePedidoListProductionImageUrl(api, empresaId, sucursalId, item, catalogProductIndex, {
            canUseCatalogApi: canViewCatalogo,
          });
        } catch (ordersError) {
          console.warn("No fue posible resolver imagen desde pedidos:", ordersError);
        }
      }
      const pedidoId = productionPedidoId(item);
      if (!imageUrl && pedidoId != null) {
        try {
          const detail = await api.obtenerDetallePedido(pedidoId);
          imageUrl = resolveDetailProductionImageUrl(detail, catalogProductIndex, item, empresaId);
        } catch (detailError) {
          console.warn("No fue posible resolver imagen desde detalle de pedido:", detailError);
        }
      }
      if (!imageUrl && (canManageProductionActions || canViewPipeline) && item.numeroPedido) {
        try {
          const pipelinePayload = await api.listarPipelinePedidos({
            empresaId,
            sucursalId,
            numeroPedido: String(item.numeroPedido || "").trim(),
            soloHoy: false,
            soloAtrasados: false,
            soloEnProduccion: false,
          });
          imageUrl = resolvePipelineProductionImageUrl(pipelinePayload, item, catalogProductIndex, empresaId);
          const pipelineRealPedidoId = pipelinePedidoId(pipelinePayload, item);
          if (!imageUrl && pipelineRealPedidoId != null) {
            const detail = await api.obtenerDetallePedido(pipelineRealPedidoId);
            imageUrl = resolveDetailProductionImageUrl(detail, catalogProductIndex, item, empresaId);
          }
        } catch (pipelineError) {
          console.warn("No fue posible resolver imagen desde pipeline:", pipelineError);
        }
      }
      if (!imageUrl && canViewCatalogo) {
        imageUrl = await resolveCatalogImageByProductionCode(api, empresaId, sucursalId, item, catalogProductIndex);
      }
      return {
        key: productionItemKey(item),
        cacheKeys: productionImageCacheKeys(item, { preferCatalogCode }),
        imageUrl,
      };
    })).then(results => {
      if (disposed) return;
      setProductionProductImages(current => {
        const next = { ...current };
        let hasChanges = false;
        for (const result of results) {
          if (result.status !== "fulfilled" || !result.value.key) continue;
          if (!result.value.imageUrl) continue;
          for (const cacheKey of result.value.cacheKeys || [`item:${result.value.key}`]) {
            next[cacheKey] = result.value.imageUrl;
          }
          hasChanges = true;
        }
        return hasChanges ? next : current;
      });
    });

    return () => { disposed = true; };
  }, [api, canManageProductionActions, canResolveProductionImages, canViewCatalogo, canViewPedidos, canViewPipeline, catalogProductIndex, empresaId, focusedVisibleItems, productionProductImages, sucursalId]);

  return {
    catalogProductIndex,
    productionProductImages,
  };
}
