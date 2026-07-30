import { todayIsoDateBogota } from "../../shared/utils.js";
import { PIPELINE_STAGES } from "./pipelineConfig.jsx";

export const PRIORITY_CONFIG = {
  BAJA: { label: "Baja", className: "is-low" },
  MEDIA: { label: "Media", className: "is-medium" },
  ALTA: { label: "Alta", className: "is-high" },
  URGENTE: { label: "Urgente", className: "is-urgent" },
  CRITICA: { label: "Critica", className: "is-urgent" },
};
export function normalizePipelineBoard(payload) {
  return PIPELINE_STAGES.reduce((board, stage) => ({ ...board, [stage]: Array.isArray(payload?.[stage]) ? payload[stage] : [] }), {});
}
export function todayIsoDate() { return todayIsoDateBogota(); }
export function sanitizeUiText(value) {
  return String(value || "")
    .replaceAll("MÃƒÂ³dulo", "Modulo")
    .replaceAll("ÃƒÂ¡", "a").replaceAll("ÃƒÂ©", "e")
    .replaceAll("ÃƒÂ­", "i").replaceAll("ÃƒÂ³", "o")
    .replaceAll("ÃƒÂº", "u").replaceAll("ÃƒÂ±", "n").replaceAll("Ãƒ'", "N")
    .trim();
}
export function formatHistoryActor(value) {
  const raw = sanitizeUiText(value);
  return raw ? raw.replace(/\./g, " Â· ") : "-";
}
export function formatHistoryReason(value) { return sanitizeUiText(value) || "-"; }
export function resolveHistoryTypeLabel(tipoMovimiento) {
  const type = String(tipoMovimiento || "").trim().toUpperCase();
  if (type === "ASIGNACION_MANUAL") return "Asignacion";
  if (type === "REASIGNACION_MANUAL") return "Reasignacion";
  if (type === "DESASIGNACION_MANUAL") return "Desasignacion";
  return "Movimiento";
}
export function resolveHistoryTypeClass(tipoMovimiento) {
  const label = resolveHistoryTypeLabel(tipoMovimiento);
  if (label === "Asignacion") return "is-admin";
  if (label === "Desasignacion") return "is-auto";
  return "is-reassignment";
}
export function formatApprovalAuditError(error) {
  const message = sanitizeUiText(error?.message || error?.detail || "");
  if (message.toLowerCase().includes("modulo 'trazabilidad' no disponible en el plan")) {
    return "El historial de pedidos no esta disponible en este ambiente porque el backend publicado aun responde con la regla anterior de Trazabilidad.";
  }
  return message || "No fue posible cargar el historial de pedidos.";
}
export function formatApprovalAction(value) {
  const action = String(value || "").trim().toUpperCase();
  if (action === "APROBAR_PEDIDO" || action === "APROBAR_PEDIDO_PIPELINE") return "Aprobo pedido";
  if (action === "GUARDAR_PEDIDO") return "Guardo edicion";
  return action || "-";
}
export function buildPipelineMetrics(board) {
  return {
    activos: [...board.creado, ...board.aprobado, ...board.pendiente_produccion, ...board.en_produccion, ...board.listo, ...board.en_camino].length,
    enProduccion: [...board.pendiente_produccion, ...board.en_produccion].length,
    enCamino: board.en_camino.length,
    entregados: board.entregado.length,
  };
}
export function buildColumnItems(board, stages, selectedStage) {
  const visibleStages = selectedStage ? stages.filter(stage => stage === selectedStage) : stages;
  return visibleStages.flatMap(stage => Array.isArray(board?.[stage]) ? board[stage] : []);
}
export function resolveEstadoFiltro(filters) {
  if (filters.soloAtrasados) return "atrasados";
  if (filters.soloEnProduccion) return "produccion";
  return filters.estadoStage || "";
}
export function applyEstadoFilterValue(value, onChange) {
  onChange("estadoStage", "");
  onChange("soloAtrasados", value === "atrasados");
  onChange("soloEnProduccion", value === "produccion");
  if (value !== "atrasados" && value !== "produccion") onChange("estadoStage", value);
}
export function getTimeStatus(tiempoRestante) {
  const remaining = Number(tiempoRestante);
  if (!Number.isFinite(remaining)) return { label: "-", className: "is-unknown", icon: null };
  if (remaining < 0) return { label: `Retrasado ${Math.round(Math.abs(remaining))} min`, className: "is-late", icon: "alert" };
  if (remaining <= 30) return { label: `${Math.round(remaining)} min restantes`, className: "is-soon", icon: "warn" };
  return { label: "A tiempo", className: "is-ontime", icon: "ok" };
}
export function formatProgress(progress) { return Math.max(0, Math.min(100, Number(progress || 0))); }
export function isPickupOrder(item) {
  const tipoEntrega = String(item?.tipo_entrega || "").toLowerCase();
  return tipoEntrega.includes("recog") || tipoEntrega.includes("tienda");
}
export function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  return { id, codigo: getProductoCodigo(raw), nombre: getProductoNombre(raw) };
}
export function getProductoId(raw) {
  if (!raw || typeof raw !== "object") return null;
  for (const value of [raw.productoID, raw.productoId, raw.id_producto, raw.idProducto, raw.id]) {
    if (value == null || value === "") continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}
export function getProductoCodigo(raw) {
  if (!raw || typeof raw !== "object") return "";
  return String(raw.codigoProducto || raw.codigo || raw.sku || "").trim();
}
export function getProductoNombre(raw) {
  if (!raw || typeof raw !== "object") return "";
  return String(raw.nombreProducto || raw.nombre || raw.descripcion || "").trim();
}
export function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) if (item?.id != null) map.set(String(item.id), item);
  return Array.from(map.values());
}
export function buildProductoLabel(producto) {
  const codigo = String(producto?.codigo || "").trim();
  const nombre = String(producto?.nombre || "").trim();
  if (codigo && nombre) return `${codigo} - ${nombre}`;
  return nombre || codigo || "Producto sin nombre";
}
export function toDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export function normalizeTime(value) {
  const match = String(value || "").trim().match(/^(\d{2}:\d{2})/);
  return match ? match[1] : "";
}
