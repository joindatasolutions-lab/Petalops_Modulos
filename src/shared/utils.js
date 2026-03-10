export function formatearCOP(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CO").format(number);
}

export function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function toIsoDateStart(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T00:00:00`;
}

export function toIsoDateEnd(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T23:59:59`;
}
