import { todayIsoDateBogota } from "../../shared/utils.js";
export const CLIENTS_VIEWS = [
  { key: "clientes", label: "Clientes" },
  { key: "metricas", label: "Metricas" },
];
export const INITIAL_CLIENT_FORM = {
  tipoIdent: "CC",
  identificacion: "",
  indicativo: "+57",
  nombreCompleto: "",
  telefono: "",
  telefonoCompleto: "",
  email: "",
  fechaCumpleanos: "",
  fechaAniversario: "",
  activo: true,
};
export function normalizePhoneComplete(indicativo, telefono) {
  const prefix = String(indicativo || "").trim();
  const number = String(telefono || "").trim();
  if (!prefix && !number) return "";
  if (!prefix) return number;
  if (!number) return prefix;
  return `${prefix}${number}`;
}
export function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return Boolean(session?.esGlobalJoin) || role === "admin" || role === "empresa_admin";
}
export function initialsFromName(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CL";
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}
export function clientToForm(item = {}) {
  return {
    tipoIdent: item.tipoIdent || "CC",
    identificacion: item.identificacion || "",
    indicativo: item.indicativo || "+57",
    nombreCompleto: item.nombreCompleto || "",
    telefono: item.telefono || "",
    telefonoCompleto: item.telefonoCompleto || "",
    email: item.email || "",
    fechaCumpleanos: item.fechaCumpleanos || "",
    fechaAniversario: item.fechaAniversario || "",
    activo: Boolean(item.activo),
  };
}
export function buildClientPayload(form, empresaId) {
  return {
    empresaID: empresaId,
    tipoIdent: String(form.tipoIdent || "").trim() || null,
    identificacion: String(form.identificacion || "").trim() || null,
    indicativo: String(form.indicativo || "").trim() || null,
    nombreCompleto: String(form.nombreCompleto || "").trim(),
    telefono: String(form.telefono || "").trim() || null,
    telefonoCompleto: normalizePhoneComplete(form.indicativo, form.telefono) || null,
    email: String(form.email || "").trim() || null,
    fechaCumpleanos: form.fechaCumpleanos || null,
    fechaAniversario: form.fechaAniversario || null,
    activo: Boolean(form.activo),
  };
}
export function buildClientsExportRows(items) {
  return items.map(item => ({
    "ID": item.clienteID,
    "Tipo documento": item.tipoIdent || "",
    "Documento": item.identificacion || "",
    "Nombre completo": item.nombreCompleto || "",
    "Indicativo": item.indicativo || "",
    "Telefono": item.telefono || "",
    "Telefono completo": item.telefonoCompleto || "",
    "Email": item.email || "",
    "Cumpleanos": item.fechaCumpleanos || "",
    "Aniversario": item.fechaAniversario || "",
    "Estado": item.activo ? "Activo" : "Inactivo",
  }));
}
export function buildClientMetricsExportSheets(clientsIntelligence) {
  const ci = clientsIntelligence;
  return {
    resumen: [
      { "Indicador": "Total clientes", "Valor": ci.total },
      { "Indicador": "Clientes activos", "Valor": ci.activos },
      { "Indicador": "Clientes inactivos", "Valor": ci.inactivos },
      { "Indicador": "Con telefono", "Valor": ci.conTelefono },
      { "Indicador": "Con email", "Valor": ci.conEmail },
      { "Indicador": "Con documento", "Valor": ci.conDocumento },
      { "Indicador": "Ficha completa", "Valor": ci.completos },
      { "Indicador": "Cumpleanos este mes", "Valor": ci.cumpleMes },
      { "Indicador": "Aniversarios este mes", "Valor": ci.aniversarioMes },
      { "Indicador": "% Activos", "Valor": `${ci.activosPct}%` },
      { "Indicador": "% Contactabilidad", "Valor": `${ci.contactabilidadPct}%` },
      { "Indicador": "% Ficha completa", "Valor": `${ci.completitudPct}%` },
    ],
    calidad: ci.qualityRows.map(row => ({ "Campo": row.label, "Clientes": row.value, "Porcentaje": `${row.pct}%` })),
    documentos: ci.documentRows.map(row => ({ "Tipo documento": row.label, "Clientes": row.value, "Porcentaje": `${row.pct}%` })),
    indicativos: ci.indicativeRows.map(row => ({ "Indicativo": row.label, "Clientes": row.value, "Porcentaje": `${row.pct}%` })),
  };
}
export function buildClientsIntelligence(items, currentDate = todayIsoDateBogota()) {
  const currentMonth = currentDate.slice(5, 7);
  const total = items.length;
  const activos = items.filter(item => Boolean(item.activo)).length;
  const inactivos = Math.max(total - activos, 0);
  const conTelefono = items.filter(item => hasValue(item.telefonoCompleto || item.telefono)).length;
  const conEmail = items.filter(item => hasValue(item.email)).length;
  const conDocumento = items.filter(item => hasValue(item.identificacion)).length;
  const cumpleMes = items.filter(item => monthFromDate(item.fechaCumpleanos) === currentMonth).length;
  const aniversarioMes = items.filter(item => monthFromDate(item.fechaAniversario) === currentMonth).length;
  const completos = items.filter(item => (
    hasValue(item.nombreCompleto) && hasValue(item.telefonoCompleto || item.telefono) && hasValue(item.email) && hasValue(item.identificacion)
  )).length;
  const documentRows = countRows(items, item => String(item.tipoIdent || "Sin tipo").trim() || "Sin tipo");
  const indicativeRows = countRows(items, item => String(item.indicativo || "Sin indicativo").trim() || "Sin indicativo").slice(0, 6);
  const qualityRows = [
    { key: "telefono", label: "Telefono", value: conTelefono, pct: percentValue(conTelefono, total), color: "#16a34a" },
    { key: "email", label: "Email", value: conEmail, pct: percentValue(conEmail, total), color: "#2563eb" },
    { key: "documento", label: "Documento", value: conDocumento, pct: percentValue(conDocumento, total), color: "#7c3aed" },
    { key: "completos", label: "Ficha completa", value: completos, pct: percentValue(completos, total), color: "#e91e72" },
  ];
  const topMissing = [
    { label: "Sin telefono", value: total - conTelefono, color: "#ea580c" },
    { label: "Sin email", value: total - conEmail, color: "#dc2626" },
    { label: "Sin documento", value: total - conDocumento, color: "#d97706" },
  ].sort((a, b) => b.value - a.value)[0];
  return {
    total,
    activos,
    inactivos,
    conTelefono,
    conEmail,
    conDocumento,
    cumpleMes,
    aniversarioMes,
    completos,
    activosPct: percentValue(activos, total),
    contactabilidadPct: percentValue(conTelefono, total),
    emailPct: percentValue(conEmail, total),
    completitudPct: percentValue(completos, total),
    documentRows,
    indicativeRows,
    qualityRows,
    topMissing,
    destacados: items.slice(0, 5),
  };
}
function countRows(items, getKey) {
  const counter = items.reduce((map, item) => {
    const key = getKey(item);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  return Array.from(counter.entries())
    .map(([label, value]) => ({ key: label, label, value, pct: percentValue(value, items.length) }))
    .sort((a, b) => b.value - a.value);
}
function hasValue(value) {
  return Boolean(String(value || "").trim());
}
function monthFromDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parts = text.slice(0, 10).split("-");
  return parts.length >= 2 ? parts[1] : "";
}
function percentValue(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
}
