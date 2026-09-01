import { normalizeStatus, todayIsoDateBogota } from "../../shared/utils.js";
import { INVENTORY_STATUS_CLASS } from "./inventoryConfig.jsx";
export function statusClass(estadoStock) {
  const key = normalizeStatus(estadoStock);
  return INVENTORY_STATUS_CLASS[key] || "is-pendiente";
}
export function inventoryRowClass(item) {
  const status = normalizeStatus(item?.estadoStock);
  return [
    "inventory-row-card",
    status === "DISPONIBLE" ? "inventory-row-available" : "",
    status === "BAJO_STOCK" ? "inventory-row-warning" : "",
    status === "AGOTADO" ? "inventory-row-danger" : "",
    status === "INACTIVO" || item?.activo === false ? "inventory-row-muted" : "",
  ].filter(Boolean).join(" ");
}
export function todayIsoDate() { return todayIsoDateBogota(); }
export function isTodayDate(value) { return String(value || "").slice(0, 10) === todayIsoDate(); }
export function isSameMonthAsToday(value) { return String(value || "").slice(0, 7) === todayIsoDate().slice(0, 7); }
export function stockLevel(item) {
  const stock = Number(item?.stockActual || 0);
  const minimum = Math.max(Number(item?.stockMinimo || 0), 1);
  if (stock <= 0) return { key: "out", label: "Sin stock", percent: 8, className: "is-critical", alert: "Bloquear salidas y comprar" };
  if (stock <= minimum) return { key: "low", label: "Stock bajo", percent: 34, className: "is-medium", alert: "Generar compra" };
  return { key: "high", label: "Stock alto", percent: 92, className: "is-healthy", alert: "Sin alerta" };
}
export function rotationLevel(item) {
  const stock = Number(item?.stockActual || 0);
  const minimum = Math.max(Number(item?.stockMinimo || 0), 1);
  if (stock <= minimum) return { label: "Alta", className: "is-high" };
  if (stock <= minimum * 2.5) return { label: "Media", className: "is-medium" };
  return { label: "Baja", className: "is-low" };
}
export function relativeMovementLabel(dateValue) {
  const raw = String(dateValue || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "-";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 0) return "Hoy";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return minutes <= 1 ? "Hace 1 min" : `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Hace 1 día" : `Hace ${days} días`;
}
export function isNearExpiry(fechaVencimiento) {
  if (!fechaVencimiento) return false;
  const diff = new Date(fechaVencimiento).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}
export function isExpired(fechaVencimiento) {
  if (!fechaVencimiento) return false;
  return new Date(fechaVencimiento).getTime() < Date.now();
}
export function filterInventoryItems(items, { stockFiltro = "", subcategoriaFiltro = "", metricFilter = "" } = {}) {
  return (Array.isArray(items) ? items : []).filter(item => {
    const level = stockLevel(item);
    if (stockFiltro && level.key !== stockFiltro) return false;
    if (subcategoriaFiltro && String(item.subcategoria || "").toLowerCase() !== subcategoriaFiltro.toLowerCase()) return false;
    if (metricFilter === "bajoStock" && level.key !== "low") return false;
    if (metricFilter === "agotados" && level.key !== "out") return false;
    if (metricFilter === "porVencer" && !(isExpired(item.fechaVencimiento) || isNearExpiry(item.fechaVencimiento))) return false;
    return true;
  });
}
export function buildInventoryMetrics(items, movimientos) {
  return {
    stockTotal: items.reduce((sum, item) => sum + Number(item.stockActual || 0), 0),
    valorInventario: items.reduce((sum, item) => sum + (Number(item.stockActual || 0) * Number(item.valorUnitario || 0)), 0),
    entradasHoy: movimientos.filter(m => isTodayDate(m.fecha) && normalizeStatus(m.tipoMovimiento) === "ENTRADA").length,
    salidasHoy: movimientos.filter(m => isTodayDate(m.fecha) && normalizeStatus(m.tipoMovimiento) === "SALIDA").length,
    bajoStock: items.filter(item => stockLevel(item).key === "low").length,
    agotados: items.filter(item => stockLevel(item).key === "out").length,
    porVencer: items.filter(item => item.fechaVencimiento && (isExpired(item.fechaVencimiento) || isNearExpiry(item.fechaVencimiento))).length,
  };
}
export function buildBasesMetrics(items, movimientos, proveedores) {
  const basesInventarioIds = new Set(items.map(item => item.inventarioID));
  const proveedorIdsEnBases = new Set(items.map(item => item.proveedorID).filter(id => id != null));
  return {
    totalBases: items.length,
    stockBajo: items.filter(item => stockLevel(item).key === "low").length,
    agotadas: items.filter(item => stockLevel(item).key === "out").length,
    comprasEsteMes: movimientos.filter(mov => normalizeStatus(mov?.tipoMovimiento) === "ENTRADA" && basesInventarioIds.has(mov?.inventarioID) && isSameMonthAsToday(mov?.fecha)).length,
    proveedoresActivos: proveedores.filter(p => proveedorIdsEnBases.has(p.idProveedor) && p.activo).length,
  };
}
export function buildCategorySummary(items) {
  const totalStock = Math.max(items.reduce((sum, item) => sum + Number(item.stockActual || 0), 0), 1);
  const byKey = new Map();
  items.forEach(item => {
    const key = String(item.subcategoria || item.categoria || "Sin categoria").trim() || "Sin categoria";
    byKey.set(key, (byKey.get(key) || 0) + Number(item.stockActual || 0));
  });
  return Array.from(byKey.entries()).map(([label, cantidad]) => ({ label, cantidad, percent: Math.round((cantidad / totalStock) * 100) })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 6);
}
export function buildCriticalItems(items) {
  return items.filter(item => ["out", "low"].includes(stockLevel(item).key)).sort((a, b) => Number(a.stockActual || 0) - Number(b.stockActual || 0)).slice(0, 5);
}
export function buildExpiryAlerts(items) {
  return items.filter(item => item.fechaVencimiento && (isExpired(item.fechaVencimiento) || isNearExpiry(item.fechaVencimiento)));
}
export function buildTopSellers(items, movimientos) {
  const salidasPorInventarioId = new Map();
  movimientos.forEach(mov => {
    if (normalizeStatus(mov?.tipoMovimiento) !== "SALIDA") return;
    const id = mov?.inventarioID;
    if (id == null) return;
    salidasPorInventarioId.set(id, (salidasPorInventarioId.get(id) || 0) + Number(mov?.cantidad || 0));
  });
  return items.map(item => ({ item, vendidos: salidasPorInventarioId.get(item.inventarioID) || 0 })).filter(entry => entry.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos).slice(0, 5);
}
export function buildLastMovementByItem(movimientos) {
  const map = new Map();
  movimientos.forEach(movement => {
    const keys = [String(movement.codigo || "").trim(), String(movement.nombre || "").trim().toLowerCase()].filter(Boolean);
    keys.forEach(key => {
      const current = map.get(key);
      const currentTime = current ? new Date(current.fecha || 0).getTime() : 0;
      const nextTime = new Date(movement.fecha || 0).getTime();
      if (!current || nextTime > currentTime) map.set(key, movement);
    });
  });
  return map;
}
export function lastMovementLabelForItem(item, lastMovementByItem) {
  const byCode = lastMovementByItem.get(String(item?.codigo || "").trim());
  if (byCode) return relativeMovementLabel(byCode.fecha);
  const byName = lastMovementByItem.get(String(item?.nombre || "").trim().toLowerCase());
  return relativeMovementLabel(byName?.fecha);
}
export function buildRecetaResumen(recetaDetalle, allItems) {
  const detalles = recetaDetalle?.detalles;
  if (!Array.isArray(detalles) || detalles.length === 0) return null;
  let costoTotal = 0;
  let capacidadAuto = Infinity;
  let limitante = null;
  const ingredientes = detalles.map(det => {
    const item = allItems.find(i => i.inventarioID === det.inventarioID);
    const stock = Number(item?.stockActual || 0);
    const cantidadReq = Number(det.cantidad || 0);
    costoTotal += Number(item?.valorUnitario || 0) * cantidadReq;
    const posibles = cantidadReq > 0 ? Math.floor(stock / cantidadReq) : Infinity;
    if (posibles < capacidadAuto) { capacidadAuto = posibles; limitante = det; }
    return { det, stock, cantidadReq, posibles };
  });
  capacidadAuto = Number.isFinite(capacidadAuto) ? capacidadAuto : 0;
  const tieneManual = recetaDetalle?.capacidadManual != null && recetaDetalle.capacidadManual !== "";
  const capacidad = tieneManual ? Number(recetaDetalle.capacidadManual) : capacidadAuto;
  const precioVenta = recetaDetalle?.precioVenta != null ? Number(recetaDetalle.precioVenta) : null;
  const utilidad = precioVenta != null ? precioVenta - costoTotal : null;
  const reservados = Number(recetaDetalle?.reservados || 0);
  return { costoTotal, capacidadAuto, capacidad, capacidadEsManual: tieneManual, limitante, ingredientes, precioVenta, utilidad, reservados, vendidosHoy: Number(recetaDetalle?.vendidosHoy || 0), disponibles: Math.max(0, capacidad - reservados) };
}
export function buildSimulacionPedido(recetaResumen, simuladorCantidad) {
  if (!recetaResumen) return null;
  const cantidad = Number(simuladorCantidad || 0);
  if (!cantidad || cantidad <= 0) return null;
  const detalle = recetaResumen.ingredientes.map(({ det, stock }) => {
    const necesario = Number(det.cantidad || 0) * cantidad;
    const faltante = Math.max(0, necesario - stock);
    return { nombre: det.nombre, codigo: det.codigo, necesario, disponible: stock, faltante, ok: faltante === 0 };
  });
  return { cantidad, permitido: detalle.every(d => d.ok), detalle };
}
export function buildCreateItemPayload(createForm, empresaId, moduloActivo) {
  return {
    empresaID: empresaId,
    codigo: String(createForm.codigo || "").trim(),
    nombre: String(createForm.nombre || "").trim(),
    categoria: String(createForm.categoria || "").trim(),
    subcategoria: String(createForm.subcategoria || "").trim() || null,
    color: String(createForm.color || "").trim() || null,
    descripcion: String(createForm.descripcion || "").trim() || null,
    tamano: String(createForm.tamano || "").trim() || null,
    unidadMedida: String(createForm.unidadMedida || "Unidad").trim(),
    fechaVencimiento: createForm.fechaVencimiento || null,
    marca: String(createForm.marca || "").trim() || null,
    precioVenta: moduloActivo === "adicionales" ? Number(createForm.precioVenta || 0) : null,
    proveedorID: createForm.proveedorID ? Number(createForm.proveedorID) : null,
    stockActual: Number(createForm.stockActual || 0),
    stockMinimo: Number(createForm.stockMinimo || 0),
    valorUnitario: Number(createForm.valorUnitario || 0),
    activo: true,
  };
}
export function buildProveedorForm(item) {
  return { nombre: item.nombre || "", codigoProveedor: item.codigoProveedor || "", telefono: item.telefono || "", email: item.email || "", direccion: item.direccion || "", activo: Boolean(item.activo) };
}
export function buildProveedorPayload(proveedorForm, empresaId) {
  return { empresaId, nombre: String(proveedorForm.nombre || "").trim(), codigoProveedor: String(proveedorForm.codigoProveedor || "").trim() || null, telefono: String(proveedorForm.telefono || "").trim() || null, email: String(proveedorForm.email || "").trim() || null, direccion: String(proveedorForm.direccion || "").trim() || null, activo: Boolean(proveedorForm.activo) };
}
