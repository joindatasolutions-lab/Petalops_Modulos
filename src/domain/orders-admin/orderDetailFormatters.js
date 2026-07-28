import { splitDateTimeParts } from "../../shared/utils.js";

/**
 * Formateadores para el detalle de pedido.
 *
 * Estas funciones convierten valores crudos del detalle en textos estables para
 * el drawer. No deben conocer estado React ni hacer llamadas externas.
 */

export function formatDisplayDate(value) {
  const date = splitDateTimeParts(value).date || String(value || "").slice(0, 10);
  if (!date) return "-";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export function normalizeIdentType(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "CC" || raw === "CEDULA" || raw === "CEDULA") return "CC";
  if (raw === "NIT") return "NIT";
  return raw;
}

export function formatClienteTipoDocumento(cliente) {
  const tipo = normalizeIdentType(cliente?.tipoIdent);
  if (tipo === "NIT") return "NIT";
  if (tipo === "CC") return "Cedula";
  return tipo || "-";
}

export function formatClienteNumeroDocumento(cliente) {
  const numero = String(cliente?.identificacion || "").trim();
  return numero || "-";
}

export function formatMetodoPago(financiero) {
  const methods = Array.isArray(financiero?.metodosPago)
    ? financiero.metodosPago.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  if (methods.length > 0) return methods.join(", ");
  return financiero?.metodoPago || "-";
}
