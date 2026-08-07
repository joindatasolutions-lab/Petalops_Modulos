import {
  displayProductCode,
  normalizeWholePeso,
  resolveProductImageUrl,
} from "./ordersDomain.js";

/**
 * Adaptadores de catalogo y barrios para Pedidos.
 *
 * El backend puede responder productos/barrios con nombres de campos distintos
 * segun el endpoint. Estas funciones convierten esas variantes al shape estable
 * que consumen los comboboxes y formularios del modulo.
 */

export function getProductoId(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.productoID, raw.productoId, raw.id_producto, raw.idProducto, raw.id];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

export function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  const precio = raw?.precio != null
    ? normalizeWholePeso(raw.precio)
    : raw?.precioUnitario != null
      ? normalizeWholePeso(raw.precioUnitario)
      : null;
  return {
    id,
    codigo: String(raw?.codigoProducto || raw?.codigo || raw?.sku || "").trim(),
    codigoProducto: String(raw?.codigoProducto || raw?.codigo_producto || raw?.codigo || raw?.sku || "").trim(),
    codigoCatalogo: String(raw?.codigoCatalogo || raw?.codigo_catalogo || raw?.catalogCode || "").trim(),
    nombre: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    nombreProducto: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    descripcion: String(raw?.descripcion || raw?.observaciones || "").trim(),
    imageUrl: resolveProductImageUrl(raw),
    precio,
  };
}

export function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item || item.id == null) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

export function buildProductoLabel(producto, empresaId = null) {
  const codigo = displayProductCode(producto, empresaId);
  const nombre = String(producto?.nombre || "").trim();
  if (codigo && nombre) return `${codigo} - ${nombre}`;
  if (nombre) return nombre;
  if (codigo) return codigo;
  return "Producto sin nombre";
}

export function normalizeBarrioItem(raw) {
  const nombre = String(raw?.nombreBarrio || raw?.nombre || "").trim();
  if (!nombre) return null;
  const idValue = raw?.idBarrio ?? raw?.id ?? null;
  const id = idValue == null || idValue === "" ? null : Number(idValue);
  const costoRaw = raw?.costoDomicilio ?? raw?.costo ?? null;
  const costo = costoRaw == null || costoRaw === "" ? null : Number(costoRaw);
  return {
    id: Number.isNaN(id) ? null : id,
    nombre,
    costoDomicilio: Number.isNaN(costo) ? null : costo,
  };
}

export function extractBarrioItems(payload) {
  const candidates = [
    payload,
    payload?.items,
    payload?.barrios,
    payload?.data,
    payload?.data?.items,
    payload?.data?.barrios,
    payload?.result,
    payload?.result?.items,
    payload?.result?.barrios,
  ];
  const rows = candidates.find(Array.isArray) || [];
  return rows.map(item => normalizeBarrioItem(item)).filter(Boolean);
}

export function dedupeBarrioItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.nombre) continue;
    map.set(item.nombre.toLowerCase(), item);
  }
  return Array.from(map.values());
}
