export function formatearCOP(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CO").format(number);
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
  return `${value}T00:00:00`;
}

export function toIsoDateEnd(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T23:59:59`;
}
