export const DEFAULT_BARRIO_FORM = { zonaID: "", nombreBarrio: "", costoDomicilio: "", activo: true };
export const DEFAULT_EDIT_FORM = { zonaID: "", nombreBarrio: "", costoDomicilio: "" };
export function normalizeSearchText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
export function formatCurrency(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString("es-CO")}`;
}
export function resolveZoneLabel(item) {
  const zonaID = item?.zonaID ?? item?.zonaId ?? item?.idZona;
  return zonaID != null && zonaID !== "" ? String(zonaID) : "Sin zona";
}
export function sortNeighborhoods(items, sortOrder) {
  const rows = [...items];
  rows.sort((a, b) => {
    if (sortOrder === "costo_desc") return Number(b?.costoDomicilio || 0) - Number(a?.costoDomicilio || 0);
    if (sortOrder === "costo_asc") return Number(a?.costoDomicilio || 0) - Number(b?.costoDomicilio || 0);
    const nameA = String(a?.nombreBarrio || "").localeCompare(String(b?.nombreBarrio || ""), "es", { sensitivity: "base" });
    return sortOrder === "nombre_desc" ? -nameA : nameA;
  });
  return rows;
}
export function filterNeighborhoodItems(items, { search = "", estadoFilter = "todos", zonaFilter = "todas", costFilter = "todos" } = {}) {
  const term = normalizeSearchText(search);
  const rows = Array.isArray(items) ? items : [];
  const costs = rows.map(item => Number(item?.costoDomicilio || 0)).filter(Number.isFinite);
  const averageCost = costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : 0;
  return rows.filter(item => {
    const zoneLabel = resolveZoneLabel(item);
    const cost = Number(item?.costoDomicilio || 0);
    if (estadoFilter === "activos" && item?.activo === false) return false;
    if (estadoFilter === "inactivos" && item?.activo !== false) return false;
    if (zonaFilter !== "todas" && zoneLabel !== zonaFilter) return false;
    if (costFilter === "sin_costo" && cost > 0) return false;
    if (costFilter === "bajo_promedio" && cost > averageCost) return false;
    if (costFilter === "alto_promedio" && cost < averageCost) return false;
    if (!term) return true;
    const zona = String(item?.zonaID ?? zoneLabel).trim();
    const nombre = String(item?.nombreBarrio || "").trim();
    const costo = String(item?.costoDomicilio ?? "").trim();
    return [zona, zoneLabel, nombre, costo].some(value => normalizeSearchText(value).includes(term));
  });
}
export function buildNeighborhoodMetrics(items) {
  const costs = items.map(item => Number(item?.costoDomicilio || 0)).filter(Number.isFinite);
  const totalCost = costs.reduce((sum, value) => sum + value, 0);
  return {
    total: items.length,
    average: costs.length ? totalCost / costs.length : 0,
    highest: costs.length ? Math.max(...costs) : 0,
    lowest: costs.length ? Math.min(...costs) : 0,
  };
}
export function buildZoneOptions(items) {
  return Array.from(new Set(items.map(resolveZoneLabel))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}
export function buildPagination({ page, pageSize, totalItems }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);
  return { totalPages, currentPage, pageStart: start, pageEnd: end };
}
export function barrioToEditForm(item) {
  return {
    zonaID: String(item?.zonaID ?? ""),
    nombreBarrio: String(item?.nombreBarrio || ""),
    costoDomicilio: String(item?.costoDomicilio ?? ""),
  };
}
export function buildCreateBarrioPayload(form, sucursalId) {
  return {
    sucursalID: sucursalId,
    zonaID: Number(form.zonaID || 0),
    nombreBarrio: form.nombreBarrio,
    costoDomicilio: Number(form.costoDomicilio || 0),
    activo: Boolean(form.activo),
  };
}
export function buildUpdateBarrioPayload(item, overrides, sucursalId) {
  return {
    barrioId: Number(item.idBarrio),
    sucursalID: sucursalId,
    zonaID: Number(overrides.zonaID ?? item.zonaID ?? 0),
    nombreBarrio: String(overrides.nombreBarrio ?? item.nombreBarrio ?? "").trim(),
    costoDomicilio: Number(overrides.costoDomicilio ?? item.costoDomicilio ?? 0),
  };
}
export function buildNeighborhoodExportRows(items) {
  return items.map(item => ({
    "Barrio": item.nombreBarrio || "",
    "Zona": resolveZoneLabel(item),
    "Zona ID": item.zonaID ?? "",
    "Costo domicilio": Number(item.costoDomicilio || 0),
    "Estado": item.activo === false ? "Inactivo" : "Activo",
  }));
}
export function parseNeighborhoodImportRow(row) {
  const nombreBarrio = String(row.Barrio || row["Nombre barrio"] || row.nombreBarrio || "").trim();
  if (!nombreBarrio) return null;
  const zonaID = Number(row["Zona ID"] ?? row.zonaID ?? row.ZonaID ?? 0);
  const costoDomicilio = Number(row["Costo domicilio"] ?? row.Costo ?? row.costoDomicilio ?? 0);
  const activoText = String(row.Estado ?? row.Activo ?? "Activo").trim().toLowerCase();
  return { zonaID, nombreBarrio, costoDomicilio, activo: !["inactivo", "no", "false", "0"].includes(activoText) };
}