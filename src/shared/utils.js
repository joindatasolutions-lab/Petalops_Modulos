export function formatearCOP(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(number);
}

export function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function splitDateTimeParts(value) {
  const text = String(value || "").trim();
  if (!text) return { date: "", time: "" };

  if (text.includes("T")) {
    const [datePart, timePart = ""] = text.split("T");
    return { date: datePart || "", time: timePart.slice(0, 8) };
  }

  if (text.includes(" ")) {
    const [datePart, timePart = ""] = text.split(" ");
    return { date: datePart || "", time: timePart.slice(0, 8) };
  }

  return { date: text, time: "" };
}

export const COLOMBIA_TIME_ZONE = "America/Bogota";

export function todayIsoDateBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftIsoDate(dateValue, days) {
  const raw = String(dateValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day + Number(days || 0), 12, 0, 0));
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
}

export function formatDateOnly(value) {
  return splitDateTimeParts(value).date || "";
}

export function formatTimeOnly(value) {
  return splitDateTimeParts(value).time || "";
}

export function formatDateTimeCompact(value) {
  const { date, time } = splitDateTimeParts(value);
  return [date, time.slice(0, 5)].filter(Boolean).join(" ").trim();
}

export function toIsoDateStart(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T00:00:00-05:00`;
}

export function toIsoDateEnd(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T23:59:59-05:00`;
}
