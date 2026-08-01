/*
 * Utilidades de catalogo e imagenes para produccion.
 * Resuelve productos, coincidencias de catalogo, imagenes desde pedidos/pipeline
 * y llaves de cache usadas por la vista.
 */
import { tenantConfig } from "../../config/tenantConfig.js";
import {
  catalogCodeCandidates,
  extractListPayloadItems,
  extractOrderProducts,
  flattenPipelineCards,
  getProductoId,
  isEmpresaCatalogCode,
  productCodeCandidates,
  resolveProductImageUrl,
  shouldUseCatalogCodeForProduction,
} from "./productionDomain.js";

export function normalizeCatalogItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = getProductoId(raw);
  const codigos = Array.from(new Set(productCodeCandidates(raw)));
  const explicitCatalogCodes = catalogCodeCandidates(raw);
  const codigosCatalogo = explicitCatalogCodes.length > 0
    ? Array.from(new Set(explicitCatalogCodes))
    : codigos;
  const codigo = codigos[0] || "";
  const nombre = String(raw.nombreProducto || raw.nombre_producto || raw.nombreArreglo || raw.nombre_arreglo || raw.nombre || raw.descripcion || raw.titulo || "").trim();
  const imageUrl = resolveProductImageUrl(raw);
  if (id == null && !codigo && !nombre) return null;
  return { id, codigo, codigos, codigosCatalogo, nombre, imageUrl };
}

export function extractCatalogRows(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.productos)) return payload.productos;
  if (Array.isArray(payload.catalogo)) return payload.catalogo;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.productos)) return payload.data.productos;
  if (Array.isArray(payload.data?.catalogo)) return payload.data.catalogo;
  if (Array.isArray(payload.result?.items)) return payload.result.items;
  if (Array.isArray(payload.result?.productos)) return payload.result.productos;
  if (Array.isArray(payload.resultados)) return payload.resultados;
  return [];
}

export function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item) continue;
    const key = item.id != null
      ? `id:${item.id}`
      : item.codigo
        ? `code:${productLookupKey(item.codigo)}`
        : `name:${productLookupKey(item.nombre)}:${item.imageUrl || ""}`;
    map.set(key, item);
  }
  return Array.from(map.values());
}

function productLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function productNamesCompatible(left, right) {
  const leftKey = productLookupKey(firstProductToken(left));
  const rightKey = productLookupKey(firstProductToken(right));
  return Boolean(leftKey && rightKey && (leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey)));
}

function catalogIndexEntries(catalogIndex, key) {
  const value = catalogIndex.get(key);
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function addCatalogIndexEntry(index, key, item) {
  if (!key || !item.imageUrl) return;
  const current = index.get(key);
  if (!current) {
    index.set(key, [item]);
    return;
  }
  const next = Array.isArray(current) ? current : [current];
  if (!next.some(candidate => candidate === item || (candidate.id != null && item.id != null && Number(candidate.id) === Number(item.id)))) {
    next.push(item);
  }
  index.set(key, next);
}

function findCatalogMatchByName(catalogIndex, name) {
  const nameKey = productLookupKey(name);
  const firstNameKey = productLookupKey(firstProductToken(name));
  return [
    ...catalogIndexEntries(catalogIndex, `name:${nameKey}`),
    ...catalogIndexEntries(catalogIndex, `name:${firstNameKey}`),
  ].find(product => product.imageUrl && productNamesCompatible(name, product.nombre));
}

function findCatalogMatchByCodes(catalogIndex, codes, keyPrefix, name = "") {
  const codeKeys = Array.from(new Set(codes.flatMap(candidate => [candidate, firstProductToken(candidate)]).map(productLookupKey).filter(Boolean)));
  const matches = codeKeys.flatMap(codeKey => catalogIndexEntries(catalogIndex, `${keyPrefix}:${codeKey}`));
  if (!matches.length) return null;
  if (name) {
    const compatible = matches.find(product => product.imageUrl && productNamesCompatible(name, product.nombre));
    if (compatible) return compatible;
    const exactName = findCatalogMatchByName(catalogIndex, name);
    if (exactName) return exactName;
  }
  return matches.find(product => product.imageUrl) || null;
}

export function buildCatalogProductIndex(items) {
  const index = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item.imageUrl) continue;
    if (item.id != null) addCatalogIndexEntry(index, `id:${item.id}`, item);
    const codeKeys = Array.from(new Set([item.codigo, ...(Array.isArray(item.codigos) ? item.codigos : [])].map(productLookupKey).filter(Boolean)));
    const catalogCodeKeys = Array.from(new Set((Array.isArray(item.codigosCatalogo) ? item.codigosCatalogo : []).map(productLookupKey).filter(Boolean)));
    const nameKey = productLookupKey(item.nombre);
    for (const codeKey of codeKeys) addCatalogIndexEntry(index, `code:${codeKey}`, item);
    for (const catalogCodeKey of catalogCodeKeys) addCatalogIndexEntry(index, `catalog-code:${catalogCodeKey}`, item);
    if (nameKey) addCatalogIndexEntry(index, `name:${nameKey}`, item);
  }
  return index;
}

function firstProductToken(value) {
  return String(value || "").split(/\s+\+\s+|,\s*/).map(part => part.trim()).find(Boolean) || "";
}

export function catalogQueriesFromItems(items, preferCatalogCode = false) {
  const queries = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const product = String(item.nombreArreglo || item.producto || "").trim();
    const firstProduct = firstProductToken(product);
    const codes = preferCatalogCode ? catalogCodeCandidates(item) : productCodeCandidates(item);
    const firstCodes = codes.map(firstProductToken);
    const values = preferCatalogCode ? [...codes, ...firstCodes, product, firstProduct] : [...codes, ...firstCodes, product, firstProduct];
    values.forEach(value => {
      const query = String(value || "").trim();
      if (query && query.length > 1) queries.add(query);
    });
  }
  return Array.from(queries).slice(0, 16);
}

export async function resolveCatalogImageByProductionCode(api, empresaId, sucursalId, item, catalogIndex = new Map()) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId);
  const queries = catalogQueriesFromItems([item], preferCatalogCode).slice(0, 6);
  const sourceNameKey = productLookupKey(firstProductToken(item.nombreArreglo || item.producto || item.nombreProducto || item.nombre || ""));
  for (const query of queries) {
    const lookupKey = productLookupKey(query);
    const indexedProduct = preferCatalogCode
      ? findCatalogMatchByCodes(catalogIndex, [query], "catalog-code", sourceNameKey)
      : findCatalogMatchByCodes(catalogIndex, [query], "code", sourceNameKey) || findCatalogMatchByName(catalogIndex, query);
    if (indexedProduct?.imageUrl) return indexedProduct.imageUrl;

    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q: query });
      const products = extractCatalogRows(payload)
        .map(raw => normalizeCatalogItem(raw))
        .filter(Boolean);
      const exactCodeMatches = products.filter(product => {
        const codesToMatch = preferCatalogCode
          ? product.codigosCatalogo
          : [product.codigo, ...(Array.isArray(product.codigos) ? product.codigos : [])];
        const codeMatches = (Array.isArray(codesToMatch) ? codesToMatch : [])
          .some(code => productLookupKey(code) === lookupKey);
        const nameMatches = !preferCatalogCode && productLookupKey(product.nombre) === lookupKey;
        return (codeMatches || nameMatches) && product.imageUrl;
      });
      const exactMatch = exactCodeMatches.find(product => {
        const productNameKey = productLookupKey(firstProductToken(product.nombre));
        return sourceNameKey && productNameKey && (sourceNameKey === productNameKey || sourceNameKey.includes(productNameKey) || productNameKey.includes(sourceNameKey));
      }) || exactCodeMatches[0];
      const withImage = exactMatch || (!preferCatalogCode ? products.find(product => product.imageUrl) : null);
      if (withImage?.imageUrl) return withImage.imageUrl;
    } catch (catalogError) {
      console.warn("No fue posible resolver imagen desde catálogo por código:", catalogError);
    }
  }
  return "";
}

export function resolveImageSrc(imageUrl, apiBaseUrl) {
  const value = String(imageUrl || "").trim();
  if (!value) return "";
  if (/^(https:)\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
  const base = String(apiBaseUrl || "").replace(/\/+$/, "");
  if (!base || base === "/api") return `${base}${value.startsWith("/") ? value : `/${value}`}`;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

export function resolveProductionProduct(item, catalogIndex = new Map(), options = {}) {
  const preferCatalogCode = Boolean(options.preferCatalogCode);
  const allowDirectImage = options.allowDirectImage !== false;
  const name = String(item.nombreArreglo || item.producto || item.nombreProducto || item.nombre || "").trim();
  const codes = preferCatalogCode ? catalogCodeCandidates(item) : productCodeCandidates(item);
  const code = codes[0] || "";
  const directImageUrl = resolveProductImageUrl(item);
  const productId = getProductoId(item);
  const byId = productId != null
    ? catalogIndexEntries(catalogIndex, `id:${productId}`).find(product => product.imageUrl)
    : null;
  const byName = findCatalogMatchByName(catalogIndex, name);
  const byCatalogCode = findCatalogMatchByCodes(catalogIndex, catalogCodeCandidates(item), "catalog-code", name);
  const byProductCode = findCatalogMatchByCodes(catalogIndex, productCodeCandidates(item), "code", name);
  const catalogProduct = byId || byName || (preferCatalogCode ? byCatalogCode || byProductCode : byProductCode || byCatalogCode);
  const imageUrl = catalogProduct?.imageUrl || (allowDirectImage ? directImageUrl : "");

  return {
    name: name || catalogProduct?.nombre || "",
    code: code || catalogProduct?.codigo || "",
    imageUrl,
  };
}

function productionProductMatches(sourceItem, product, options = {}) {
  if (!sourceItem || !product) return false;
  const sourceDetailId = String(sourceItem.pedidoDetalleID || sourceItem.pedidoDetalleId || sourceItem.detalleID || sourceItem.detalleId || "").trim();
  const productDetailId = String(product.pedidoDetalleID || product.pedidoDetalleId || product.detalleID || product.detalleId || product.idDetalle || product.id_detalle || "").trim();
  if (sourceDetailId && productDetailId && sourceDetailId === productDetailId) return true;

  if (options.preferCatalogCode) {
    const sourceCatalogCodes = catalogCodeCandidates(sourceItem).map(productLookupKey).filter(Boolean);
    const productCatalogCodes = catalogCodeCandidates(product).map(productLookupKey).filter(Boolean);
    if (sourceCatalogCodes.length > 0) {
      return sourceCatalogCodes.some(sourceCode => productCatalogCodes.includes(sourceCode));
    }
  }

  const sourceProductId = getProductoId(sourceItem);
  const productId = getProductoId(product);
  if (sourceProductId != null && productId != null && Number(sourceProductId) === Number(productId)) return true;

  const sourceCodes = productCodeCandidates(sourceItem).map(productLookupKey).filter(Boolean);
  const productCodes = productCodeCandidates(product).map(productLookupKey).filter(Boolean);
  if (sourceCodes.some(sourceCode => productCodes.some(productCode => sourceCode === productCode || sourceCode.includes(productCode) || productCode.includes(sourceCode)))) return true;

  const sourceName = productLookupKey(firstProductToken(sourceItem.nombreArreglo || sourceItem.producto || ""));
  const productName = productLookupKey(product.nombreArreglo || product.nombreProducto || product.producto || product.nombre || product.descripcion || "");
  return Boolean(sourceName && productName && (sourceName === productName || sourceName.includes(productName) || productName.includes(sourceName)));
}

export function productionItemKey(item) {
  return String(item.idProduccion || item.pedidoDetalleID || item.pedidoID || item.numeroPedido || "").trim();
}

export function productionPedidoId(item) {
  const candidates = [item.pedidoID, item.pedidoId, item.pedido_id, item.idPedido, item.id_pedido];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function pipelinePedidoId(payload, sourceItem) {
  const cards = flattenPipelineCards(payload);
  const sourceOrder = String(sourceItem.numeroPedido || sourceItem.numero_pedido || "").trim();
  const matchingCard = cards.find(card => {
    const cardOrder = String(card.numeroPedido || card.numero_pedido || card.numero_pedido_display || "").trim();
    if (sourceOrder && cardOrder && cardOrder !== sourceOrder) return false;
    return productionProductMatches(sourceItem, card) || !sourceOrder || cardOrder === sourceOrder;
  });
  const candidates = [
    matchingCard?.id_pedido,
    matchingCard?.idPedido,
    matchingCard?.pedidoID,
    matchingCard?.pedidoId,
    matchingCard?.pedido_id,
  ];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function resolveDetailProductionImageUrl(detail, catalogIndex = new Map(), sourceItem = null, empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId || sourceItem?.empresaID || sourceItem?.empresaId || sourceItem?.empresa_id);
  const products = Array.isArray(detail.productos) ? detail.productos : [];
  const orderedProducts = sourceItem
    ? [
      ...products.filter(product => productionProductMatches(sourceItem, product, { preferCatalogCode })),
      ...products.filter(product => !productionProductMatches(sourceItem, product, { preferCatalogCode })),
    ]
    : products;
  for (const product of orderedProducts) {
    const imageUrl = resolveProductionProduct(product, catalogIndex, { preferCatalogCode, allowDirectImage: false }).imageUrl;
    if (imageUrl) return imageUrl;
  }
  const detailImageUrl = resolveProductImageUrl(detail);
  if (!preferCatalogCode && detailImageUrl) return detailImageUrl;
  return "";
}

export function resolvePipelineProductionImageUrl(payload, sourceItem, catalogIndex = new Map(), empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId || sourceItem?.empresaID || sourceItem?.empresaId || sourceItem?.empresa_id);
  const cards = flattenPipelineCards(payload);
  const sourceOrder = String(sourceItem.numeroPedido || sourceItem.numero_pedido || "").trim();
  const matchingCards = cards.filter(card => {
    const cardOrder = String(card.numeroPedido || card.numero_pedido || card.pedidoID || "").trim();
    return !sourceOrder || cardOrder === sourceOrder;
  });
  const orderedCards = [
    ...matchingCards.filter(card => productionProductMatches(sourceItem, card, { preferCatalogCode })),
    ...matchingCards.filter(card => !productionProductMatches(sourceItem, card, { preferCatalogCode })),
  ];
  for (const card of orderedCards) {
    const imageUrl = resolveProductionProduct(card, catalogIndex, { preferCatalogCode, allowDirectImage: false }).imageUrl;
    if (imageUrl) return imageUrl;
  }
  return "";
}

export async function resolvePedidoListProductionImageUrl(api, empresaId, sucursalId, sourceItem, catalogIndex = new Map(), options = {}) {
  const numeroPedido = String(sourceItem.numeroPedido || sourceItem.numero_pedido || "").trim();
  if (!numeroPedido) return "";

  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId || sourceItem?.empresaID || sourceItem?.empresaId || sourceItem?.empresa_id);
  const payload = await api.listarPedidos({
    empresaId,
    sucursalId,
    q: numeroPedido,
    sinImprimir: false,
    soloTienda: false,
    page: 1,
    pageSize: 10,
  });
  const orders = extractListPayloadItems(payload);
  const matchingOrder = orders.find(order => {
    const orderNumber = String(order.numeroPedido || order.numero_pedido || order.codigoPedido || order.codigo_pedido || "").trim();
    return orderNumber === numeroPedido;
  }) || orders[0];
  const products = extractOrderProducts(matchingOrder);

  const orderedProducts = [
    ...products.filter(product => productionProductMatches(sourceItem, product, { preferCatalogCode })),
    ...products.filter(product => !productionProductMatches(sourceItem, product, { preferCatalogCode })),
  ];

  const directMatchedImageUrl = orderedProducts
    .filter(product => productionProductMatches(sourceItem, product, { preferCatalogCode }))
    .map(resolveProductImageUrl)
    .find(Boolean);
  if (directMatchedImageUrl) return directMatchedImageUrl;

  for (const product of orderedProducts) {
    const indexedImageUrl = resolveProductionProduct(product, catalogIndex, { preferCatalogCode, allowDirectImage: !preferCatalogCode }).imageUrl;
    if (indexedImageUrl) return indexedImageUrl;

    if (options.canUseCatalogApi !== false) {
      const catalogImageUrl = await resolveCatalogImageByProductionCode(api, empresaId, sucursalId, product, catalogIndex);
      if (catalogImageUrl) return catalogImageUrl;
    }
  }

  return "";
}

export function productionImageCacheKeys(item, options = {}) {
  const preferCatalogCode = Boolean(options.preferCatalogCode);
  const itemKeys = [];
  const codeKeys = [];
  const nameKeys = [];
  const itemKey = productionItemKey(item);
  if (itemKey) itemKeys.push(`item:${itemKey}`);

  const codeCandidates = preferCatalogCode ? catalogCodeCandidates(item) : productCodeCandidates(item);
  codeCandidates.forEach(value => {
    const key = productLookupKey(value);
    if (key) codeKeys.push(`${preferCatalogCode ? "catalog-code" : "code"}:${key}`);
  });

  [
    item.nombreArreglo,
    item.nombre_arreglo,
    item.producto,
    item.nombreProducto,
    item.nombre_producto,
    item.nombre,
    firstProductToken(item.nombreArreglo || item.producto || item.nombreProducto || item.nombre),
  ].forEach(value => {
    const key = productLookupKey(value);
    if (key) nameKeys.push(`name:${key}`);
  });

  const keys = preferCatalogCode ? [...itemKeys, ...nameKeys, ...codeKeys] : [...itemKeys, ...codeKeys, ...nameKeys];

  return Array.from(new Set(keys));
}

function cachedProductionImageForItem(item, imageCache = {}, options = {}) {
  const preferCatalogCode = Boolean(options.preferCatalogCode);
  const keys = productionImageCacheKeys(item, options);
  for (const key of keys) {
    const imageUrl = imageCache[key];
    if (imageUrl) return imageUrl;
  }
  return "";
}

export function catalogOrCachedProductionImageForItem(item, catalogIndex = new Map(), imageCache = {}, empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId || item?.empresaID || item?.empresaId || item?.empresa_id);
  const directImageUrl = resolveProductImageUrl(item);
  const catalogImageUrl = resolveProductionProduct(item, catalogIndex, {
    preferCatalogCode,
    allowDirectImage: false,
  }).imageUrl;
  if (catalogImageUrl) return catalogImageUrl;
  const cachedImageUrl = cachedProductionImageForItem(item, imageCache, { preferCatalogCode });
  if (preferCatalogCode && cachedImageUrl && cachedImageUrl === directImageUrl) return "";
  return cachedImageUrl;
}

export function resolveProductionDisplayImageUrl(item, catalogIndex = new Map(), imageCache = {}, empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId || item?.empresaID || item?.empresaId || item?.empresa_id);
  const directImageUrl = resolveProductImageUrl(item);
  const trustedImageUrl = catalogOrCachedProductionImageForItem(item, catalogIndex, imageCache, empresaId);
  return trustedImageUrl || (!preferCatalogCode ? directImageUrl : "");
}

export function productInitials(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PR";
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

export function buildPaginationItems(page, pages) {
  const currentPage = Math.max(1, Math.min(Number(page || 1), Number(pages || 1)));
  const totalPages = Math.max(1, Number(pages || 1));
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  if (currentPage >= totalPages - 3) return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
}
