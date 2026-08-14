import { shiftIsoDate, todayIsoDateBogota } from "../../shared/utils.js";
export const CLIENTS_VIEWS = [
  { key: "clientes", label: "Clientes" },
  { key: "metricas", label: "Metricas" },
];
export const CUSTOMER_SEGMENTS = [
  { key: "AT_RISK", label: "En riesgo" },
  { key: "VIP", label: "VIP" },
  { key: "RECURRING", label: "Recurrentes" },
  { key: "ACTIVE", label: "Activos" },
  { key: "NEW", label: "Nuevos" },
  { key: "INACTIVE", label: "Inactivos" },
  { key: "HIGH_VALUE", label: "Alto valor" },
];
export const CUSTOMER_PRIORITY_CODES = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
export const CUSTOMER_ATTENTION_PRIORITIES = ["P0", "P1", "P2", "P3", "P4", "P5"];
export const CUSTOMER_MAIN_ATTENTION_PRIORITIES = ["P0", "P1", "P2"];
export const CUSTOMER_PRIORITY_LABELS = {
  P0: "VIP en riesgo",
  P1: "Alto valor en riesgo",
  P2: "Cliente en riesgo",
  P3: "VIP inactivo",
  P4: "Alto valor inactivo",
  P5: "Cliente inactivo",
  P6: "Cliente nuevo",
  P7: "Cliente recurrente",
  P8: "Cliente activo",
};
export const CUSTOMER_PRIORITY_TONES = {
  P0: "is-critical",
  P1: "is-very-high",
  P2: "is-high",
  P3: "is-high",
  P4: "is-medium-high",
  P5: "is-medium",
  P6: "is-medium",
  P7: "is-normal",
  P8: "is-normal",
};
export const COMMERCIAL_CALENDAR = [
  {
    month: 2,
    code: "VALENTINES_DAY",
    label: "San Valentín",
    focus: "P0/P1/P2",
    description: "Campaña de recuperación premium.",
  },
  {
    month: 5,
    code: "MOTHERS_MONTH",
    label: "Mes de las Madres",
    focus: "P6/P7/P8",
    description: "Campaña masiva para clientes activos, recurrentes y nuevos.",
  },
  {
    month: 9,
    code: "LOVE_AND_FRIENDSHIP",
    label: "Amor y Amistad",
    focus: "VIP/HIGH_VALUE",
    description: "Campaña de arreglos premium.",
  },
];
export const CUSTOMER_METRICS_DATE_PRESETS = [
  { key: "30D", label: "30 días" },
  { key: "90D", label: "90 días" },
  { key: "YEAR", label: "Año actual" },
  { key: "12M", label: "12 meses" },
  { key: "ALL", label: "Histórico" },
];
export const CUSTOMER_ACTIONS = [
  { key: "REACTIVATE", label: "Reactivar" },
  { key: "VIP_CARE", label: "Cuidar VIP" },
  { key: "REORDER_FAVORITE", label: "Reorden favorito" },
  { key: "WELCOME_SECOND_PURCHASE", label: "Segunda compra" },
  { key: "SPECIAL_DATE_CAMPAIGN", label: "Fecha especial" },
  { key: "ACQUIRE_FIRST_PURCHASE", label: "Primera compra" },
  { key: "NURTURE", label: "Nutrir" },
];
export const DEFAULT_CUSTOMER_METRICS_RANGE = {
  preset: "YEAR",
  ...buildCustomerMetricsDateRange("YEAR"),
};

export function buildCustomerMetricsDateRange(preset = "YEAR", customRange = {}, currentDate = todayIsoDateBogota()) {
  if (preset === "30D") return { startDate: shiftIsoDate(currentDate, -29), endDate: currentDate };
  if (preset === "90D") return { startDate: shiftIsoDate(currentDate, -89), endDate: currentDate };
  if (preset === "12M") return { startDate: shiftIsoDate(currentDate, -365), endDate: currentDate };
  if (preset === "ALL") return { startDate: "", endDate: "" };
  if (preset === "CUSTOM") {
    return {
      startDate: customRange.startDate || "",
      endDate: customRange.endDate || currentDate,
    };
  }
  return { startDate: `${currentDate.slice(0, 4)}-01-01`, endDate: currentDate };
}
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
    "Compras": item.metrics?.purchase_count ?? item.metrics?.purchaseCount ?? "",
    "Total comprado": item.metrics?.total_spent ?? item.metrics?.totalSpent ?? "",
    "Ticket promedio": item.metrics?.average_order_value ?? item.metrics?.averageOrderValue ?? "",
    "Ultima compra": item.metrics?.last_purchase_at ?? item.metrics?.lastPurchaseAt ?? "",
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
    priorities: normalizePrioritySummary({}),
  };
}

export function extractClientItems(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.items,
    payload?.clientes,
    payload?.customers,
    payload?.data,
    payload?.data?.items,
    payload?.data?.clientes,
    payload?.data?.customers,
    payload?.result,
    payload?.result?.items,
    payload?.result?.customers,
  ];
  return candidates.find(Array.isArray) || [];
}

export function extractPayloadTotal(payload, fallbackItems = []) {
  const candidates = [
    payload?.total,
    payload?.totalItems,
    payload?.totalRegistros,
    payload?.count,
    payload?.data?.total,
    payload?.data?.count,
    payload?.result?.total,
    payload?.result?.count,
  ];
  const value = candidates.find(item => item != null && item !== "");
  const total = Number(value);
  return Number.isFinite(total) ? total : fallbackItems.length;
}

export function segmentLabel(segment) {
  const normalized = String(segment || "").trim().toUpperCase();
  return CUSTOMER_SEGMENTS.find(item => item.key === normalized)?.label || String(segment || "");
}

export function formatSegmentLabels(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return "";
  return segments.map(segmentLabel).filter(Boolean).join(", ");
}

export function priorityLabel(priority) {
  const code = normalizePriorityCode(priority);
  return CUSTOMER_PRIORITY_LABELS[code] || code || "";
}

export function priorityTone(priority) {
  return CUSTOMER_PRIORITY_TONES[normalizePriorityCode(priority)] || "is-normal";
}

export function normalizePriorityCode(priority) {
  const raw = typeof priority === "object"
    ? priority?.code ?? priority?.priority ?? priority?.level ?? priority?.key
    : priority;
  return String(raw || "").trim().toUpperCase();
}

export function normalizePrioritySummary(payload = {}) {
  const source = payload.priorities
    || payload.priority_summary
    || payload.prioritySummary
    || payload.commercial_priorities
    || payload.commercialPriorities
    || payload.intelligence?.priorities
    || payload.intelligence?.priority_summary
    || [];

  const rows = Array.isArray(source)
    ? source
    : Object.entries(source || {}).map(([code, value]) => (
      typeof value === "object" && value !== null ? { code, ...value } : { code, count: value }
    ));

  const byCode = rows.reduce((map, row) => {
    const code = normalizePriorityCode(row);
    if (!code) return map;
    map[code] = normalizePriorityItem({ ...row, code });
    return map;
  }, {});

  return CUSTOMER_PRIORITY_CODES.map(code => byCode[code] || normalizePriorityItem({ code }));
}

export function normalizePriorityItem(item = {}) {
  const code = normalizePriorityCode(item);
  const count = Number(item.count ?? item.customers ?? item.customer_count ?? item.total ?? item.value ?? 0);
  const historicalValue = Number(
    item.historical_value
      ?? item.historicalValue
      ?? item.lifetime_value
      ?? item.lifetimeValue
      ?? item.total_spent
      ?? item.totalSpent
      ?? item.revenue
      ?? 0
  );
  return {
    code,
    label: item.label || item.name || priorityLabel(code),
    count,
    historicalValue,
    description: item.description || item.summary || "",
    tone: priorityTone(code),
    raw: item,
  };
}

export function normalizeDashboardMetrics(payload, fallbackItems = []) {
  const local = buildClientsIntelligence(fallbackItems);
  if (!payload || typeof payload !== "object") return local;

  const customers = payload.customers || {};
  const activity = payload.activity || {};
  const value = payload.value || {};
  const specialDates = payload.special_dates || {};
  const intelligence = payload.intelligence || {};

  const total = Number(customers.total ?? local.total ?? 0);
  const buyers = Number(customers.buyers ?? 0);
  const active = Number(activity.active_90d ?? activity.active_60d ?? activity.active_30d ?? local.activos ?? 0);
  const inactive = Number(activity.inactive ?? Math.max(total - active, 0));

  return {
    ...local,
    source: "backend",
    raw: payload,
    total,
    activos: active,
    inactivos: inactive,
    buyers,
    nonBuyers: Number(customers.non_buyers ?? Math.max(total - buyers, 0)),
    nuevos: Number(customers.new ?? 0),
    recurrentes: Number(customers.recurring ?? 0),
    repeatRate: Number(customers.repeat_rate ?? 0),
    active30d: Number(activity.active_30d ?? 0),
    active60d: Number(activity.active_60d ?? 0),
    active90d: Number(activity.active_90d ?? 0),
    atRisk: Number(activity.at_risk ?? 0),
    totalRevenue: Number(value.total_revenue ?? 0),
    lifetimeRevenue: Number(value.lifetime_revenue ?? 0),
    averageOrderValue: Number(value.average_order_value ?? 0),
    averageCustomerValue: Number(value.average_customer_value ?? 0),
    averageLifetimeValue: Number(value.average_lifetime_value ?? 0),
    vipCustomers: Number(value.vip_customers ?? 0),
    highValueCustomers: Number(value.high_value_customers ?? intelligence.high_value_customers ?? 0),
    recurringRevenuePercentage: Number(value.recurring_revenue_percentage ?? 0),
    specialDatesNext30d: Number(specialDates.special_dates_next_30d ?? 0),
    highChurnRiskCustomers: Number(intelligence.high_churn_risk_customers ?? 0),
    priorities: normalizePrioritySummary(payload),
    insights: Array.isArray(payload.insights) ? payload.insights : [],
    comparison: payload.comparison || null,
    activosPct: percentValue(active, total),
    contactabilidadPct: local.contactabilidadPct,
    completitudPct: local.completitudPct,
    cumpleMes: Number(specialDates.special_dates_next_30d ?? local.cumpleMes ?? 0),
    aniversarioMes: local.aniversarioMes,
  };
}

export function normalizeCustomerMetricItem(item = {}) {
  const metrics = item.metrics || item.intelligence || {};
  const priority = normalizePriorityCode(
    item.priority
      ?? item.commercial_priority
      ?? item.commercialPriority
      ?? item.priority_code
      ?? item.priorityCode
      ?? metrics.priority
      ?? metrics.commercial_priority
      ?? metrics.priority_code
  );
  return {
    customerId: item.customer_id ?? item.clienteID ?? item.clienteId ?? item.id,
    clienteID: item.clienteID ?? item.customer_id ?? item.clienteId ?? item.id,
    name: item.name || item.nombreCompleto || item.nombre || "Cliente sin nombre",
    purchaseCount: Number(item.purchase_count ?? metrics.purchase_count ?? 0),
    totalSpent: Number(item.total_spent ?? metrics.total_spent ?? 0),
    lifetimeValue: Number(item.lifetime_value ?? metrics.lifetime_value ?? 0),
    averageOrderValue: Number(item.average_order_value ?? metrics.average_order_value ?? 0),
    lastPurchaseAt: item.last_purchase_at ?? metrics.last_purchase_at ?? "",
    daysSinceLastPurchase: item.days_since_last_purchase ?? metrics.days_since_last_purchase ?? null,
    segments: Array.isArray(item.segments) ? item.segments : [],
    priority,
    priorityLabel: item.commercial_priority_label ?? item.priority_label ?? metrics.commercial_priority_label ?? metrics.priority_label ?? priorityLabel(priority),
    priorityTone: priorityTone(priority),
    telefono: item.telefono || "",
    telefonoCompleto: item.telefonoCompleto || item.telefono_completo || "",
    email: item.email || "",
    favoriteProduct: item.favorite_product || "",
    favoriteCategory: item.favorite_category || "",
    preferredChannel: item.preferred_channel || "",
    preferredOccasion: item.preferred_occasion ?? null,
    intelligence: item.intelligence || metrics || null,
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
