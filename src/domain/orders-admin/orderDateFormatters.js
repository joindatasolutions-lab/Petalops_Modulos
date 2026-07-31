/**
 * Utilidades de fecha y hora especificas del modulo Pedidos.
 *
 * Mantener aqui solo transformaciones puras usadas por formularios o vistas del
 * modulo. Las reglas globales de zona horaria viven en `shared/utils.js`.
 */

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
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

export function formatFechaEntregaTarjeta(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

export function resolveFirmaTarjeta(value) {
  return String(value || "").trim();
}
