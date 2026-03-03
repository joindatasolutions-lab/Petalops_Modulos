export function escaparHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatearCOP(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-CO").format(number);
}
