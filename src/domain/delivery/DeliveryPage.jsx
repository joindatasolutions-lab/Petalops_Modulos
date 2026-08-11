import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { COLOMBIA_TIME_ZONE, formatDateOnly, formatTimeOnly, normalizeStatus } from "../../shared/utils.js";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  Pencil,
  Plus,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  Route,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const FILTROS = [
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Manana" },
  { value: "pendientes", label: "Pendientes" },
  { value: "enruta", label: "En ruta" },
  { value: "noentregado", label: "No entregado" },
];
const DELIVERY_STATUS_BACKEND_FILTER = {
  pendiente: "pendientes",
  asignado: "asignado",
  "en-camino": "enruta",
  entregado: "entregado",
  "no-entregado": "noentregado",
  reprogramado: "reprogramado",
};
const DELIVERY_SEARCH_BACKEND_FILTERS = ["hoy", "manana", "pendientes", "asignado", "enruta", "entregado", "noentregado", "reprogramado"];

export function buildDeliveryAdminQueryPlan({ filtro = "hoy", statusFilter = "todos", fechaFiltro = "", deliverySearch = "" } = {}) {
  const backendStatusFilter = DELIVERY_STATUS_BACKEND_FILTER[statusFilter] || null;
  const filtroConsulta = backendStatusFilter || filtro;
  const searchTerm = String(deliverySearch || "").trim();
  const searchByOrderNumber = /^#?\d{1,10}$/.test(searchTerm);
  return {
    fecha: searchByOrderNumber ? null : fechaFiltro,
    q: searchByOrderNumber ? searchTerm : "",
    filtersToFetch: searchByOrderNumber && statusFilter === "todos"
      ? DELIVERY_SEARCH_BACKEND_FILTERS
      : [filtroConsulta],
  };
}

const DELIVERY_VIEWS = [
  { value: "admin", label: "Pedidos" },
  { value: "novedades", label: "Novedades" },
  { value: "metricas", label: "Métricas" },
  { value: "domiciliarios", label: "Domiciliarios" },
];
const DELIVERY_SUPPORTED_MODES = new Set([...DELIVERY_VIEWS.map(item => item.value), "disponibles", "mis-pedidos"]);

const DELIVERY_STATUS_FILTERS = [
  { key: "todos", label: "Todos", icon: Truck },
  { key: "pendiente", label: "Pendientes", icon: Clock3 },
  { key: "asignado", label: "Asignados", icon: UserRound },
  { key: "en-camino", label: "En camino", icon: Truck },
  { key: "entregado", label: "Entregados", icon: CheckCircle2 },
  { key: "no-entregado", label: "No entregados", icon: AlertTriangle },
  { key: "reprogramado", label: "Reprogramados", icon: Clock3 },
];
const DELIVERY_METRIC_GROUPS = [
  { value: "dia", label: "Día" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
  { value: "domiciliario", label: "Domiciliario" },
  { value: "estadoEntrega", label: "Estado entrega" },
  { value: "estadoPedido", label: "Estado pedido" },
  { value: "novedad", label: "Novedad" },
  { value: "barrio", label: "Barrio" },
  { value: "zona", label: "Zona" },
];
const DELIVERY_METRIC_RANGE_PRESETS = [
  { value: "hoy", label: "Hoy" },
  { value: "7dias", label: "Últimos 7 días" },
  { value: "mes", label: "Mes actual" },
  { value: "anio", label: "Año actual" },
  { value: "personalizado", label: "Personalizado" },
];
const DELIVERY_NOVELTY_TYPES = [
  { key: "cliente-no-responde", label: "Cliente no responde", tone: "pink", Icon: Phone },
  { key: "direccion-incorrecta", label: "Direccion incorrecta", tone: "orange", Icon: MapPin },
  { key: "entregado-porteria", label: "Entregado a porteria", tone: "green", Icon: CheckCircle2 },
  { key: "retraso", label: "Retraso", tone: "blue", Icon: Clock3 },
  { key: "rechazo", label: "Rechazo de entrega", tone: "red", Icon: AlertTriangle },
  { key: "destinatario-ausente", label: "Destinatario ausente", tone: "purple", Icon: UserRound },
  { key: "cambio-direccion", label: "Cambio de direccion", tone: "teal", Icon: Route },
  { key: "otra", label: "Otra novedad", tone: "slate", Icon: MessageCircle },
];
const DELIVERY_PERFORMANCE_SORTS = [
  { value: "entregados", label: "Entregas completadas" },
  { value: "tasaEntrega", label: "Tasa de entrega" },
  { value: "tiempoPromedio", label: "Tiempo promedio" },
  { value: "menosNovedades", label: "Menos novedades" },
  { value: "menosReasignaciones", label: "Menos reasignaciones" },
];
const MAX_ENTREGAS_ACTIVAS_DOMICILIARIO = 15;
const DELIVERY_SYNC_PAGE_SIZE = 100;
const DEFAULT_DELIVERY_METRICS_SUMMARY = {
  total: 0,
  pendientes: 0,
  asignados: 0,
  enRuta: 0,
  entregados: 0,
  noEntregados: 0,
  cancelados: 0,
  novedades: 0,
  tasaEntrega: 0,
  tiempoPromedioEntregaMin: null,
  costoDomicilioTotal: 0,
  costoDomicilioPromedio: 0,
};
const DEFAULT_DELIVERY_METRICS_RESPONSE = {
  empresaID: null,
  sucursalID: null,
  fechaDesde: "",
  fechaHasta: "",
  agruparPor: "dia",
  resumen: DEFAULT_DELIVERY_METRICS_SUMMARY,
  items: [],
  porDomiciliario: [],
  porEstadoEntrega: [],
  porEstadoPedido: [],
  porBarrio: [],
  porZona: [],
  novedades: [],
};
const DELIVERY_METRIC_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const DEFAULT_DELIVERY_FORM = {
  firmaNombre: "",
  firmaDocumento: "",
  firmaImagenFile: null,
  evidenciaFotoFile: null,
  observaciones: "",
  noEntregadoMotivo: "",
  reprogramarPara: "",
};

const DEFAULT_STATUS_FORM = {
  estado: "en-ruta",
  firmaNombre: "",
  firmaDocumento: "",
  firmaImagenFile: null,
  evidenciaFotoFile: null,
  motivo: "",
  reprogramarPara: "",
  observaciones: "",
};

const DEFAULT_COURIER_FORM = {
  nombre: "",
  telefono: "",
  tipo: "Interno",
  vehiculoTipo: "Moto",
  vehiculoPlaca: "",
  vehiculoDetalle: "",
  activo: true,
};

const DEFAULT_COURIER_EDIT_FORM = {
  nombre: "",
  telefono: "",
  tipo: "Interno",
  estado: "Activo",
  vehiculo: "",
  activo: true,
};

function isPedidosRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase();
  return role.includes("pedido") || role.includes("ventas") || role.includes("comercial");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  return todayIso().slice(0, 8) + "01";
}

function yearStartIso() {
  return `${todayIso().slice(0, 4)}-01-01`;
}

function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function inferCurrentDomiciliarioId(session, domiciliarioItems) {
  const sessionUserId = Number(session?.userID || session?.usuarioID || session?.idUsuario || 0);
  const sessionLogin = normalizeSearchText(session?.login);
  const sessionEmail = normalizeSearchText(session?.email);
  const sessionName = normalizeSearchText(session?.nombre);

  const found = domiciliarioItems.find(item => {
    const candidateUserId = Number(item?.usuarioID || item?.usuarioId || item?.usuario_id || item?.userID || item?.userId || item?.idUsuario || 0);
    if (sessionUserId > 0 && candidateUserId > 0 && candidateUserId === sessionUserId) return true;

    const candidateLogin = normalizeSearchText(item?.login || item?.usuario);
    if (sessionLogin && candidateLogin && candidateLogin === sessionLogin) return true;

    const candidateEmail = normalizeSearchText(item?.email);
    if (sessionEmail && candidateEmail && candidateEmail === sessionEmail) return true;

    const candidateName = normalizeSearchText(item?.nombre || item?.nombreDomiciliario || item?.nombre_empleado);
    return sessionName && candidateName && candidateName === sessionName;
  });

  return courierIdValue(found);
}

function formatDistanceKm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sin distancia";
  return `${number.toFixed(number < 10 ? 1 : 0)} km`;
}

function getDistanceValue(item) {
  const candidates = [
    item?.distanciaKm,
    item?.distancia_km,
    item?.distancia,
    item?.distanceKm,
    item?.distance_km,
  ];

  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

function stateBadgeClass(estado) {
  const key = normalizeStatus(estado).replace(/_/g, "");
  if (key === "PENDIENTE" || key === "DISPONIBLE") return "is-pendiente";
  if (key === "ASIGNADO" || key === "PARAENTREGA") return "is-entrega";
  if (key === "ENRUTA" || key === "ENCAMINO") return "is-produccion";
  if (key === "ENTREGADO") return "is-entregado";
  if (key === "NOENTREGADO" || key === "CANCELADO") return "is-rechazado";
  if (key === "REPROGRAMADO") return "is-entrega";
  return "is-pendiente";
}

function priorityTone(priority) {
  const key = String(priority || "").trim().toUpperCase();
  if (key === "ALTA" || key === "URGENTE") return "is-rechazado";
  if (key === "MEDIA") return "is-entrega";
  return "is-pendiente";
}

function compactStatusValue(value) {
  return normalizeStatus(value).replace(/[^A-Z0-9]+/g, "");
}

function deliveryRawStatus(item) {
  const code = item?.estadoEntregaCodigo
    || item?.estado_entrega_codigo
    || item?.codigoEstadoEntrega
    || item?.codigo_estado_entrega
    || item?.estadoEntrega
    || item?.estado_entrega
    || item?.estadoCodigo
    || item?.estado_codigo
    || item?.estado;
  const name = item?.estadoEntregaNombre
    || item?.estado_entrega_nombre
    || item?.nombreEstadoEntrega
    || item?.nombre_estado_entrega
    || item?.estadoEntrega
    || item?.estado_entrega
    || item?.estadoNombre
    || item?.estado_nombre
    || item?.estado;
  return { code, name };
}

function deliveryStatusMeta(item) {
  const { code, name } = deliveryRawStatus(item);
  const status = compactStatusValue(code || name);
  const label = String(name || code || "Pendiente").trim();

  if (status === "ENTREGADO") return { key: "entregado", label: label || "Entregado", tone: "done" };
  if (status === "ENRUTA" || status === "ENCAMINO") return { key: "en-camino", label: label || "En ruta", tone: "route" };
  if (status === "ASIGNADO" || status === "PARAENTREGA") return { key: "asignado", label: label || "Asignado", tone: "assigned" };
  if (status === "NOENTREGADO") return { key: "no-entregado", label: label || "No entregado", tone: "failed" };
  if (status === "REPROGRAMADO") return { key: "reprogramado", label: label || "Reprogramado", tone: "rescheduled" };
  return { key: "pendiente", label: label || "Pendiente", tone: "pending" };
}

function hasExplicitDeliveryStatus(item) {
  const { code, name } = deliveryRawStatus(item);
  const status = compactStatusValue(code || name);
  return ["ENTREGADO", "ENRUTA", "ENCAMINO", "ASIGNADO", "PARAENTREGA", "NOENTREGADO", "REPROGRAMADO", "CANCELADO", "RECHAZADO"].includes(status);
}

function isCanceledDeliveryStatus(item) {
  const { code, name } = deliveryRawStatus(item);
  const status = compactStatusValue(code || name);
  return status === "CANCELADO" || status === "RECHAZADO";
}

function isDeliveryAllowedPedidoStatus(item) {
  const raw = item?.estadoPedido
    || item?.estado_pedido
    || item?.estadoPedidoNombre
    || item?.estado_pedido_nombre
    || item?.nombreEstadoPedido
    || item?.nombre_estado_pedido;
  const status = normalizeStatus(raw).replace(/_/g, "");
  if (!status) return true;
  return status !== "CREADO";
}

function deliveryProductionStatusValues(item) {
  const candidates = [
    item?.estadoProduccion,
    item?.estado_produccion,
    item?.estadoProduccionCodigo,
    item?.estado_produccion_codigo,
    item?.codigoEstadoProduccion,
    item?.codigo_estado_produccion,
    item?.estadoProduccionNombre,
    item?.estado_produccion_nombre,
    item?.nombreEstadoProduccion,
    item?.nombre_estado_produccion,
    item?.produccion?.estado,
    item?.produccion?.estadoProduccion,
    item?.produccion?.estado_produccion,
    item?.produccion?.estadoProduccionCodigo,
    item?.produccion?.estado_produccion_codigo,
  ];

  const nestedProductions = [
    item?.producciones,
    item?.produccionItems,
    item?.produccion_items,
    item?.itemsProduccion,
    item?.items_produccion,
  ];

  for (const list of nestedProductions) {
    if (!Array.isArray(list)) continue;
    for (const production of list) {
      candidates.push(
        production?.estado,
        production?.estadoProduccion,
        production?.estado_produccion,
        production?.estadoProduccionCodigo,
        production?.estado_produccion_codigo,
        production?.codigoEstadoProduccion,
        production?.codigo_estado_produccion,
        production?.estadoProduccionNombre,
        production?.estado_produccion_nombre,
        production?.nombreEstadoProduccion,
        production?.nombre_estado_produccion
      );
    }
  }

  return candidates
    .map(value => compactStatusValue(value))
    .filter(Boolean);
}

export function isDeliveryAllowedProductionStatus(item) {
  const statuses = deliveryProductionStatusValues(item);
  if (statuses.length === 0) return true;
  return statuses.every(status => status === "PARAENTREGA");
}

function isDeliveryTimeLate(item) {
  if (deliveryStatusMeta(item).key === "entregado") return false;
  const scheduledTime = deliveryScheduledBogotaTime(item);
  if (scheduledTime != null) return scheduledTime < currentBogotaTime();
  const remaining = Number(item?.tiempoRestanteHoras);
  return Number.isFinite(remaining) && remaining < 0;
}

function deliveryAddressParts(item) {
  const address = String(item?.direccion || item?.direccionDestino || "Sin direccion").trim();
  const neighborhood = String(item?.barrio || item?.zona || item?.ciudad || item?.municipio || "").trim();
  return {
    primary: address || "Sin direccion",
    secondary: neighborhood || "Sin zona registrada",
  };
}

function deliveryPhone(item) {
  return String(item?.telefonoDestino || item?.telefono || item?.celular || item?.telefonoCliente || "").trim();
}

function deliveryPaymentMeta(item) {
  const raw = String(item?.estadoPago || item?.pagoEstado || item?.pago || item?.metodoPago || "").trim();
  const normalized = normalizeSearchText(raw);
  const paid = normalized.includes("pag") || normalized.includes("aprob") || normalized.includes("transfer");
  const pending = normalized.includes("pend") || normalized.includes("contra") || normalized.includes("efectivo");
  if (paid) return { label: "Pagado", tone: "paid" };
  if (pending) return { label: raw || "Pendiente", tone: "pending" };
  return { label: raw || "Sin dato", tone: "neutral" };
}

function normalizeDeliveryClock(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return "";
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = String(match[3] || "").toLowerCase();
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return "";
  if (meridiem.startsWith("p") && hours < 12) hours += 12;
  if (meridiem.startsWith("a") && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function bogotaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = key => Number(parts.find(part => part.type === key)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function currentBogotaTime() {
  const parts = bogotaDateParts();
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function deliveryScheduledBogotaTime(item) {
  const rawDate = item?.fechaEntrega
    || item?.fecha_entrega
    || item?.fechaEntregaProgramada
    || item?.fecha_entrega_programada
    || item?.fechaProgramada
    || item?.fecha_programada;
  const date = formatDateOnly(rawDate);
  if (!date) return null;

  const rawTime = item?.horaEntrega
    || item?.hora_entrega
    || item?.hora
    || formatTimeOnly(item?.fechaEntregaProgramada)
    || formatTimeOnly(rawDate);
  const time = normalizeDeliveryClock(rawTime) || "23:59";
  const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = time.match(/^(\d{2}):(\d{2})$/);
  if (!dateParts || !timeParts) return null;
  return Date.UTC(
    Number(dateParts[1]),
    Number(dateParts[2]) - 1,
    Number(dateParts[3]),
    Number(timeParts[1]),
    Number(timeParts[2]),
    0
  );
}

function formatDeliveryDuration(totalMinutes) {
  const minutes = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h${m > 0 ? ` ${m} m` : ""}` : `${m} m`;
}

function deliveryRemainingLabel(item) {
  if (deliveryStatusMeta(item).key === "entregado") return "Entregado";
  const scheduledTime = deliveryScheduledBogotaTime(item);
  if (scheduledTime != null) {
    const diffMinutes = (scheduledTime - currentBogotaTime()) / 60000;
    const value = formatDeliveryDuration(diffMinutes);
    return diffMinutes < 0 ? `Retraso ${value}` : "";
  }
  const hours = Number(item?.tiempoRestanteHoras);
  if (!Number.isFinite(hours)) return "Sin ETA";
  const value = formatDeliveryDuration(hours * 60);
  return hours < 0 ? `Retraso ${value}` : "";
}

function formatMetricPercent(value, total) {
  const numerator = Number(value);
  const denominator = Number(total);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatMetricRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
}

function formatMetricOneDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
}

function formatMetricMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "$0";
  return `$${number.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

function formatMetricMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (number < 60) return `${Math.round(number)} min`;
  const hours = Math.floor(number / 60);
  const minutes = Math.round(number % 60);
  return `${hours} h${minutes ? ` ${minutes} min` : ""}`;
}

function metricGroupLabel(item) {
  return String(
    item?.grupo
    || item?.periodo
    || item?.domiciliario
    || item?.estadoEntrega
    || item?.estadoPedido
    || item?.novedad
    || item?.barrio
    || item?.zona
    || "-"
  );
}

function metricNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function metricIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function metricDateRangeDays(fechaDesde, fechaHasta) {
  const start = parseMetricDate(fechaDesde);
  const end = parseMetricDate(fechaHasta);
  if (!start || !end) return [];

  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const limit = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const dates = [];

  while (cursor <= limit) {
    dates.push(metricIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates.filter(Boolean);
}

function countPedidosDisponiblesPayload(data) {
  const directTotal = [
    data?.total,
    data?.count,
    data?.cantidad,
    data?.totalItems,
    data?.total_items,
    data?.totalPedidos,
    data?.total_pedidos,
  ].map(Number).find(value => Number.isFinite(value) && value >= 0);
  if (directTotal != null) return directTotal;
  return normalizeDeliveryItemsPayload(data).length;
}

function performanceDeliveredOrderFromItem(item, index = 0) {
  const deliveredAt = item?.fechaEntregaReal
    || item?.fecha_entrega_real
    || item?.fechaEntrega
    || item?.fecha_entrega
    || item?.fecha
    || item?.fechaEntregaProgramada
    || item?.fecha_entrega_programada;
  return {
    key: item?.idEntrega || item?.id_entrega || item?.idPedido || item?.id_pedido || `${deliveryOrderCodeLabel(item)}-${index}`,
    raw: item,
    courierId: deliveryCourierIdValue(item) != null ? String(deliveryCourierIdValue(item)) : "",
    courierName: String(item?.domiciliario || item?.nombreDomiciliario || item?.nombre_domiciliario || item?.repartidor || "").trim(),
    orderCode: deliveryOrderCodeLabel(item) || "-",
    client: String(item?.cliente || item?.nombreCliente || item?.nombre_cliente || item?.destinatario || item?.nombreDestinatario || item?.nombre_destinatario || "Cliente sin nombre").trim(),
    phone: String(item?.telefono || item?.telefonoCliente || item?.telefono_cliente || item?.telefonoDestino || item?.telefono_destino || item?.celular || "").trim(),
    address: String(item?.direccion || item?.direccionEntrega || item?.direccion_entrega || item?.direccionDestino || item?.direccion_destino || item?.barrio || "").trim(),
    date: formatDateOnly(deliveredAt),
    time: item?.horaEntrega || item?.hora_entrega || item?.hora || formatTimeOnly(deliveredAt),
    observation: String(item?.observaciones || item?.observacion || item?.nota || "").trim(),
  };
}

function performanceCourierIdValue(item) {
  const candidates = [
    courierIdValue(item),
    deliveryCourierIdValue(item),
    item?.grupoId,
    item?.grupoID,
    item?.idGrupo,
    item?.domiciliario_id,
    item?.domiciliario?.id,
    item?.domiciliario?.idDomiciliario,
    item?.domiciliario?.domiciliarioID,
    item?.domiciliario?.domiciliarioId,
  ];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function performanceOrderMatchesCourier(order, courier) {
  if (!order || !courier) return false;
  const courierId = performanceCourierIdValue(courier);
  const orderId = performanceCourierIdValue(order.raw || order) ?? (order.courierId ? Number(order.courierId) : null);
  if (courierId != null) return orderId != null && Number(orderId) === Number(courierId);

  const courierNameKey = normalizeSearchText(courier.nombre);
  const orderCourierName = normalizeSearchText(order.courierName);
  return Boolean(courierNameKey && orderCourierName) && orderCourierName === courierNameKey;
}

function parseMetricDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (slashMatch) {
    const year = Number(slashMatch[3] || todayIso().slice(0, 4));
    const date = new Date(year, Number(slashMatch[2]) - 1, Number(slashMatch[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatMetricDay(date, withYear = false) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = DELIVERY_METRIC_MONTHS[date.getMonth()] || "";
  return withYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

function formatMetricMonth(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${DELIVERY_METRIC_MONTHS[date.getMonth()] || ""} ${date.getFullYear()}`;
}

function formatMetricPeriodLabel(item, groupBy, { tooltip = false } = {}) {
  const raw = String(item?.periodo || item?.grupo || "").trim();
  const normalizedGroup = normalizeSearchText(groupBy);
  const date = parseMetricDate(raw);
  if (normalizedGroup === "mes" && date) return formatMetricMonth(date);
  if (normalizedGroup === "semana") {
    const endDate = parseMetricDate(item?.fechaHasta || item?.periodoHasta || item?.hasta);
    if (date && endDate) {
      if (date.getMonth() === endDate.getMonth() && date.getFullYear() === endDate.getFullYear()) {
        return `${String(date.getDate()).padStart(2, "0")}\u2013${formatMetricDay(endDate)}`;
      }
      return `${formatMetricDay(date)}\u2013${formatMetricDay(endDate)}`;
    }
    if (raw.includes("-") || raw.includes("–")) return raw.replace(/\s+/g, " ");
  }
  if (date) return formatMetricDay(date, tooltip);
  return raw || metricGroupLabel(item);
}

function metricGroupBadgeLabel(groupBy) {
  const normalizedGroup = normalizeSearchText(groupBy);
  if (normalizedGroup === "mes") return "Agrupado por mes";
  if (normalizedGroup === "semana") return "Agrupado por semana";
  return "Agrupado por día";
}

function DeliveryHistoryTooltip({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const value = metricNumber(payload[0]?.value);
  const tooltipLabel = payload[0]?.payload?.tooltipLabel || label;
  return (
    <div className="delivery-history-tooltip">
      <strong>{tooltipLabel}</strong>
      <span>{value} pedidos</span>
    </div>
  );
}

function deliveryAdminStateDescription(label) {
  const normalized = normalizeSearchText(label);
  if (normalized.includes("aprob")) return "Pedido validado y listo para gestion.";
  if (normalized.includes("cread")) return "Pedido creado, pendiente de validacion.";
  if (normalized.includes("cancel")) return "Pedido cancelado antes de la entrega.";
  return "Estado administrativo registrado en el flujo.";
}

function metricRatio(value, total) {
  const numerator = metricNumber(value);
  const denominator = metricNumber(total);
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function formatDeliveryNoveltyLabel(value) {
  const text = String(value || "").trim();
  const normalized = normalizeSearchText(text);
  if (normalized === "arreglo danado") return "Arreglo dañado";
  return text;
}

function deliveryNoveltyTypeMeta(value) {
  const normalized = normalizeSearchText(value);
  const found = DELIVERY_NOVELTY_TYPES.find(item => {
    const itemLabel = normalizeSearchText(item.label);
    return normalized === item.key || normalized === itemLabel || itemLabel.includes(normalized) || normalized.includes(itemLabel);
  });
  if (found) return found;
  if (normalized.includes("direccion")) return DELIVERY_NOVELTY_TYPES[1];
  if (normalized.includes("porteria")) return DELIVERY_NOVELTY_TYPES[2];
  if (normalized.includes("retras")) return DELIVERY_NOVELTY_TYPES[3];
  if (normalized.includes("rechaz")) return DELIVERY_NOVELTY_TYPES[4];
  if (normalized.includes("ausente")) return DELIVERY_NOVELTY_TYPES[5];
  if (normalized.includes("cambio")) return DELIVERY_NOVELTY_TYPES[6];
  if (normalized.includes("no responde") || normalized.includes("llamada")) return DELIVERY_NOVELTY_TYPES[0];
  return DELIVERY_NOVELTY_TYPES[7];
}

function deliveryNoveltyRawLabel(item) {
  return String(
    item?.novedad
    || item?.tipoNovedad
    || item?.tipo_novedad
    || item?.motivoNoEntregado
    || item?.noEntregadoMotivo
    || item?.motivo_no_entregado
    || item?.motivo
    || ""
  ).trim();
}

function deliveryNoveltyObservation(item) {
  return String(
    item?.observacionNovedad
    || item?.observacion_novedad
    || item?.observacion
    || item?.observaciones
    || item?.notas
    || item?.mensaje
    || "Sin observacion registrada."
  ).trim();
}

function deliveryNoveltyStatusMeta(item) {
  const status = deliveryStatusMeta(item);
  if (status.key === "entregado") return { label: "Resuelta", tone: "resolved" };
  if (status.key === "en-camino" || status.key === "asignado") return { label: "En seguimiento", tone: "tracking" };
  return { label: "Pendiente", tone: "pending" };
}

function isOpenDeliveryNovelty(item) {
  if (!hasExplicitDeliveryStatus(item)) return true;
  return deliveryStatusMeta(item).key === "no-entregado";
}

function deliveryNoveltyLabelForItem(item, index = 0) {
  const raw = deliveryNoveltyRawLabel(item);
  if (raw) return formatDeliveryNoveltyLabel(raw);
  if (isDeliveryTimeLate(item)) return "Retraso";
  if (deliveryStatusMeta(item).key === "no-entregado") {
    const fallbacks = ["Cliente no responde", "Direccion incorrecta", "Destinatario ausente", "Rechazo de entrega"];
    return fallbacks[index % fallbacks.length];
  }
  return "";
}

function deliveryFirstText(...values) {
  return values.map(value => String(value || "").trim()).find(Boolean) || "";
}

function normalizeDeliveryAssetUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:)?\/\//i.test(text) || text.startsWith("data:") || text.startsWith("blob:")) return text;
  const base = String(tenantConfig.apiBaseUrl || "").replace(/\/+$/, "");
  const path = text.startsWith("/") ? text : `/${text}`;
  return base ? `${base}${path}` : path;
}

function deliveryEvidenceUrlFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return normalizeDeliveryAssetUrl(value);
  return normalizeDeliveryAssetUrl(
    value.url
    || value.urlEvidencia
    || value.url_evidencia
    || value.evidenciaUrl
    || value.evidencia_url
    || value.imagenUrl
    || value.imagen_url
    || value.fotoUrl
    || value.foto_url
    || value.archivoUrl
    || value.archivo_url
    || value.fileUrl
    || value.file_url
  );
}

function deliveryEvidenceLabelFrom(value, fallback = "Evidencia") {
  if (!value || typeof value !== "object") return fallback;
  return deliveryFirstText(
    value.tipo,
    value.tipoEvidencia,
    value.tipo_evidencia,
    value.nombre,
    value.titulo,
    fallback
  );
}

function deliveryEvidenceDateFrom(value) {
  if (!value || typeof value !== "object") return "";
  const raw = value.fecha
    || value.fechaCreacion
    || value.fecha_creacion
    || value.createdAt
    || value.created_at
    || value.fechaEntrega
    || value.fecha_entrega;
  return [formatDateOnly(raw), formatTimeOnly(raw)].filter(Boolean).join(" · ");
}

function buildDeliveryEvidenceRecords(item) {
  const records = [];
  const directEvidence = [
    ["Firma", item?.firmaImagenUrl || item?.firma_imagen_url || item?.firmaimagenurl || item?.firma || item?.firmaUrl || item?.firma_url],
    ["Foto de entrega", item?.evidenciaFotoUrl || item?.evidencia_foto_url || item?.fotoEntregaUrl || item?.foto_entrega_url || item?.fotoEvidenciaUrl || item?.foto_evidencia_url],
    ["Foto", item?.fotoUrl || item?.foto_url || item?.urlFoto || item?.url_foto || item?.foto],
  ];

  directEvidence.forEach(([label, rawUrl]) => {
    const url = deliveryEvidenceUrlFrom(rawUrl);
    if (!url) return;
    records.push({
      key: `${label}-${url}`,
      label,
      url,
      date: deliveryDateTimeLabel(item),
      note: label === "Firma" ? deliveryFirstText(item?.firmaNombre, item?.firma_nombre, item?.recibidoPor, item?.recibido_por) : "",
    });
  });

  const nestedSources = [
    item?.evidencias,
    item?.evidenciasEntrega,
    item?.evidencias_entrega,
    item?.evidenciaFotos,
    item?.evidencia_fotos,
    item?.archivosEvidencia,
    item?.archivos_evidencia,
  ];

  nestedSources.forEach(source => {
    if (!Array.isArray(source)) return;
    source.forEach((evidence, index) => {
      const url = deliveryEvidenceUrlFrom(evidence);
      if (!url) return;
      records.push({
        key: `${url}-${index}`,
        label: deliveryEvidenceLabelFrom(evidence, `Evidencia ${index + 1}`),
        url,
        date: deliveryEvidenceDateFrom(evidence),
        note: deliveryFirstText(evidence?.observacion, evidence?.observaciones, evidence?.nota, evidence?.descripcion),
      });
    });
  });

  const unique = new Map();
  records.forEach(record => {
    if (!record.url) return;
    unique.set(`${record.label}-${record.url}`, record);
  });
  return Array.from(unique.values());
}

function buildDeliveryNoveltyRecords(item) {
  const rows = [];
  const nestedSources = [
    item?.novedades,
    item?.novedadesEntrega,
    item?.novedades_entrega,
    item?.historialNovedades,
    item?.historial_novedades,
  ];

  nestedSources.forEach(source => {
    if (!Array.isArray(source)) return;
    source.forEach((novelty, index) => {
      const label = formatDeliveryNoveltyLabel(deliveryNoveltyRawLabel(novelty) || novelty?.tipo || novelty?.titulo || "Novedad");
      const eventDate = novelty?.fecha || novelty?.fechaNovedad || novelty?.fecha_novedad || novelty?.createdAt || novelty?.created_at;
      rows.push({
        key: novelty?.idNovedad || novelty?.id_novedad || `${label}-${index}`,
        label,
        status: deliveryFirstText(novelty?.estadoNovedad, novelty?.estado_novedad, novelty?.estado, deliveryNoveltyStatusMeta(item).label),
        observation: deliveryNoveltyObservation(novelty),
        time: [formatDateOnly(eventDate), formatTimeOnly(eventDate)].filter(Boolean).join(" · "),
      });
    });
  });

  const directLabel = deliveryNoveltyLabelForItem(item);
  if (directLabel) {
    rows.unshift({
      key: `actual-${deliveryItemKey(item) || directLabel}`,
      label: directLabel,
      status: deliveryNoveltyStatusMeta(item).label,
      observation: deliveryNoveltyObservation(item),
      time: deliveryDateTimeLabel(item),
    });
  }

  return rows;
}

function buildDeliveryEvidenceSummary(item) {
  return {
    order: deliveryOrderCodeLabel(item),
    arrangement: deliveryArrangementName(item) || "Arreglo sin nombre",
    client: item?.cliente || item?.destinatario || item?.nombreCliente || item?.nombre_cliente || "Cliente sin nombre",
    courier: courierName(item),
    status: deliveryStatusMeta(item).label,
    receivedBy: deliveryFirstText(item?.firmaNombre, item?.firma_nombre, item?.recibidoPor, item?.recibido_por, item?.nombreRecibe, item?.nombre_recibe),
    receivedDocument: deliveryFirstText(item?.firmaDocumento, item?.firma_documento, item?.documentoRecibe, item?.documento_recibe),
    observations: deliveryFirstText(item?.observaciones, item?.observacion, item?.notas, item?.mensaje),
    evidences: buildDeliveryEvidenceRecords(item),
    novelties: buildDeliveryNoveltyRecords(item),
  };
}

function courierInitials(name) {
  const parts = String(name || "D").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  return parts.slice(0, 2).map(part => part.slice(0, 1).toUpperCase()).join("");
}

function normalizeCourierPhotoUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:)?\/\//i.test(text) || text.startsWith("data:") || text.startsWith("blob:")) return text;
  const base = String(tenantConfig.apiBaseUrl || "").replace(/\/+$/, "");
  const path = text.startsWith("/") ? text : `/${text}`;
  return base ? `${base}${path}` : path;
}

function courierPhotoUrl(item) {
  const value = item?.fotoUrl
    || item?.domiciliarioImagenUrl
    || item?.domiciliario_imagen_url
    || item?.fotoURL
    || item?.foto_url
    || item?.urlFoto
    || item?.url_foto
    || item?.avatarUrl
    || item?.avatar_url
    || item?.imagenUrl
    || item?.imagen_url
    || item?.imageUrl
    || item?.image_url
    || item?.foto
    || item?.avatar
    || item?.imagen
    || item?.usuario?.fotoUrl
    || item?.usuario?.foto_url
    || item?.usuario?.avatarUrl
    || item?.usuario?.avatar_url;
  return normalizeCourierPhotoUrl(value);
}

function performanceDurationLabel(minutes) {
  if (minutes == null) return "Sin datos";
  const number = Number(minutes);
  if (!Number.isFinite(number) || number < 0) return "Sin datos";
  return formatMetricMinutes(number);
}

function deliveryPerformanceStatus({ courier, row }) {
  if (courier?.activo === false || normalizeStatus(courierBackendStatus(courier)) === "INACTIVO") {
    return { label: "Inactivo", tone: "is-inactive" };
  }
  if (metricNumber(row?.enRuta) > 0) return { label: "En ruta", tone: "is-route" };
  if (metricNumber(row?.total) <= 0) return { label: "Sin pedidos", tone: "is-idle" };
  return { label: "Disponible", tone: "is-available" };
}

function deliveryMetricRangeForPreset(preset) {
  const today = todayIso();
  if (preset === "hoy") return { fechaDesde: today, fechaHasta: today, agruparPor: "dia" };
  if (preset === "7dias") return { fechaDesde: daysAgoIso(6), fechaHasta: today, agruparPor: "dia" };
  if (preset === "anio") return { fechaDesde: yearStartIso(), fechaHasta: today, agruparPor: "mes" };
  return { fechaDesde: monthStartIso(), fechaHasta: today, agruparPor: "dia" };
}

function isSurpriseDelivery(item) {
  const text = normalizeSearchText(`${item?.tipoEntrega || ""} ${item?.observacion || ""} ${item?.notas || ""}`);
  return Boolean(item?.esSorpresa || item?.sorpresa || text.includes("sorpresa"));
}

export function isStorePickupDelivery(item) {
  if (!item || typeof item !== "object") return false;
  if (item.entregaEnTienda === true || item.entrega_en_tienda === true || item.recogerEnTienda === true || item.recoger_en_tienda === true) {
    return true;
  }

  const deliveryTypeText = [
    item.tipoEntrega,
    item.tipo_entrega,
    item.entregaTipo,
    item.entrega_tipo,
    item.tipoEntregaNombre,
    item.tipo_entrega_nombre,
    item.modalidadEntrega,
    item.modalidad_entrega,
    item.metodoEntrega,
    item.metodo_entrega,
    item.entrega?.tipoEntrega,
    item.entrega?.tipo_entrega,
    item.direccion,
    item.direccionDestino,
    item.direccion_destino,
    item.direccionEntrega,
    item.direccion_entrega,
    item.entrega?.direccion,
    item.entrega?.direccionDestino,
    item.entrega?.direccion_destino,
  ].map(normalizeSearchText).filter(Boolean).join(" ");

  if (!deliveryTypeText) return false;
  const compact = deliveryTypeText.replace(/[^a-z0-9]+/g, "");
  return compact.includes("tienda")
    && (
      compact.includes("recoger")
      || compact.includes("recogida")
      || compact.includes("retiro")
      || compact.includes("retirar")
      || compact.includes("entregaentienda")
      || compact.includes("entregasentienda")
    );
}

function filterDomicilioItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => (
    !isStorePickupDelivery(item)
    && isDeliveryAllowedPedidoStatus(item)
    && isDeliveryAllowedProductionStatus(item)
  ));
}

export function deliveryArrangementName(item) {
  const directCandidates = [
    item?.nombreArreglo,
    item?.nombre_arreglo,
    item?.arregloNombre,
    item?.arreglo_nombre,
    item?.producto,
    item?.nombreProducto,
    item?.nombre_producto,
    item?.productoNombre,
    item?.producto_nombre,
    item?.resumenProductos,
    item?.resumen_productos,
    item?.descripcionProducto,
    item?.descripcion_producto,
  ];
  const direct = directCandidates.map(value => String(value || "").trim()).find(Boolean);
  if (direct) return direct;

  const products = Array.isArray(item?.productos)
    ? item.productos
    : Array.isArray(item?.detail?.productos)
      ? item.detail.productos
      : [];
  const productNames = products
    .map(product => String(product?.nombreArreglo || product?.nombreProducto || product?.nombre || product?.descripcion || "").trim())
    .filter(Boolean);
  return productNames.join(" + ");
}

function deliveryImageUrl(item) {
  return item?.imagenUrl || item?.imagen || item?.fotoProducto || item?.productoImagen || item?.imageUrl || "";
}

function resolveProductImageUrl(value) {
  if (!value || typeof value !== "object") return "";
  const candidates = [
    value.imagenUrl,
    value.imagen_url,
    value.imagen,
    value.imageUrl,
    value.image_url,
    value.fotoProducto,
    value.productoImagen,
    value.productoImagenUrl,
    value.producto_imagen_url,
    value.urlImagen,
    value.url_imagen,
    value.imagenPrincipal,
    value.imagen_principal,
    value.foto,
    value.url,
    value.imagenes?.[0]?.url,
    value.imagenes?.[0]?.imagenUrl,
    value.imagenes?.[0]?.imagen_url,
    value.images?.[0]?.url,
    value.images?.[0]?.imageUrl,
    value.producto?.imagenUrl,
    value.producto?.imagen_url,
  ];
  return String(candidates.find(candidate => String(candidate || "").trim()) || "").trim();
}

function getProductoId(raw) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [raw.productoID, raw.productoId, raw.id_producto, raw.idProducto, raw.id];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  return {
    id,
    codigo: String(raw?.codigoProducto || raw?.codigo || raw?.sku || "").trim(),
    nombre: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    imageUrl: resolveProductImageUrl(raw),
  };
}

function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item || item.id == null) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

function productLookupKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildCatalogProductIndex(items) {
  const index = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.imageUrl) continue;
    if (item.id != null) index.set(`id:${item.id}`, item);
    const codeKey = productLookupKey(item.codigo);
    const nameKey = productLookupKey(item.nombre);
    if (codeKey) index.set(`code:${codeKey}`, item);
    if (nameKey) index.set(`name:${nameKey}`, item);
  }
  return index;
}

function firstProductToken(value) {
  return String(value || "").split(/\s+\+\s+|,\s*/).map(part => part.trim()).find(Boolean) || "";
}

function resolveDeliveryImageUrl(item, catalogIndex = new Map()) {
  const direct = deliveryImageUrl(item) || resolveProductImageUrl(item);
  if (direct) return direct;

  const productId = getProductoId(item);
  const code = String(item?.codigoArreglo || item?.codigoProducto || item?.codigo || item?.sku || "").trim();
  const name = String(item?.nombreArreglo || item?.producto || item?.nombreProducto || item?.resumenProductos || item?.resumen_productos || "").trim();
  const byId = productId != null ? catalogIndex.get(`id:${productId}`) : null;
  const codeKey = productLookupKey(code);
  const firstCodeKey = productLookupKey(firstProductToken(code));
  const nameKey = productLookupKey(name);
  const firstNameKey = productLookupKey(firstProductToken(name));
  const catalogProduct = byId
    || (codeKey ? catalogIndex.get(`code:${codeKey}`) : null)
    || (firstCodeKey ? catalogIndex.get(`code:${firstCodeKey}`) : null)
    || (nameKey ? catalogIndex.get(`name:${nameKey}`) : null)
    || (firstNameKey ? catalogIndex.get(`name:${firstNameKey}`) : null);

  return catalogProduct?.imageUrl || "";
}

function deliveryItemKey(item) {
  return String(item?.idEntrega || item?.pedidoID || item?.pedidoId || item?.idPedido || item?.numeroPedido || "").trim();
}

function normalizeDeliveryItemsPayload(data) {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.items,
    data?.data,
    data?.results,
    data?.rows,
    data?.pedidos,
    data?.entregas,
    data?.domicilios,
  ];

  return candidates.find(Array.isArray) || [];
}

function dedupeDeliveryItems(items) {
  const deduped = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = deliveryItemKey(item);
    if (!key) continue;
    deduped.set(key, item);
  }
  return Array.from(deduped.values());
}

function isUnassignedDelivery(item) {
  return !deliveryCourierIdValue(item) && !isCanceledDeliveryStatus(item);
}

function mergeDeliveryItem(baseItem, nextItem) {
  return {
    ...baseItem,
    ...Object.fromEntries(
      Object.entries(nextItem || {}).filter(([, value]) => value != null && value !== "")
    ),
  };
}

function mergeDeliveryItemsByKey(primaryItems, secondaryItems) {
  const merged = new Map();
  for (const item of Array.isArray(primaryItems) ? primaryItems : []) {
    const key = deliveryItemKey(item);
    if (!key) continue;
    merged.set(key, item);
  }
  for (const item of Array.isArray(secondaryItems) ? secondaryItems : []) {
    const key = deliveryItemKey(item);
    if (!key) continue;
    merged.set(key, merged.has(key) ? mergeDeliveryItem(merged.get(key), item) : item);
  }
  return Array.from(merged.values());
}

function normalizeDeliverySearchValue(value) {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deliverySearchValues(item) {
  const address = deliveryAddressParts(item);
  return [
    item?.numeroPedido,
    item?.numero_pedido,
    item?.codigoPedido,
    item?.codigo_pedido,
    item?.pedidoID,
    item?.pedidoId,
    item?.pedido_id,
    item?.idPedido,
    item?.id_pedido,
    item?.idEntrega,
    item?.id_entrega,
    item?.cliente,
    item?.nombreCliente,
    item?.nombre_cliente,
    item?.clienteNombre,
    item?.cliente_nombre,
    item?.destinatario,
    item?.nombreDestinatario,
    item?.nombre_destinatario,
    item?.recibe,
    item?.cliente?.nombre,
    item?.cliente?.nombreCompleto,
    item?.cliente?.telefono,
    item?.cliente?.telefonoCompleto,
    item?.destinatario?.nombre,
    item?.destinatario?.telefono,
    item?.direccion,
    item?.direccionDestino,
    item?.direccion_destino,
    item?.direccionEntrega,
    item?.direccion_entrega,
    item?.destinatario?.direccion,
    item?.destinatario?.direccionDestino,
    item?.entrega?.direccion,
    item?.entrega?.direccionDestino,
    address.primary,
    address.secondary,
    item?.barrio,
    item?.barrioNombre,
    item?.barrio_nombre,
    item?.destinatario?.barrio,
    item?.entrega?.barrio,
    item?.zona,
    item?.ciudad,
    item?.municipio,
    item?.telefonoDestino,
    item?.telefono_destino,
    item?.telefono,
    item?.telefonoCliente,
    item?.telefono_cliente,
    item?.celular,
    item?.domiciliario,
    item?.nombreDomiciliario,
    item?.nombre_domiciliario,
    item?.repartidor,
    item?.mensajero,
    item?.courierName,
    item?.courier?.nombre,
    item?.domiciliarioInfo?.nombre,
    item?.estado,
    item?.estadoEntrega,
    item?.estado_entrega,
    item?.estadoEntregaNombre,
    item?.estado_entrega_nombre,
    deliveryStatusMeta(item).label,
    deliveryStatusMeta(item).key,
    item?.prioridad,
    item?.metodoPago,
    item?.metodo_pago,
    item?.estadoPago,
    item?.mensaje,
    item?.observacion,
    item?.notas,
    item?.producto,
    item?.nombreProducto,
    item?.nombre_producto,
    item?.nombreArreglo,
    item?.nombre_arreglo,
    item?.arregloNombre,
    item?.arreglo_nombre,
    item?.resumenProductos,
    item?.resumen_productos,
    deliveryArrangementName(item),
  ];
}

export function deliveryOrderCodeLabel(itemOrValue) {
  const raw = itemOrValue && typeof itemOrValue === "object"
    ? itemOrValue.numeroPedido
      ?? itemOrValue.numero_pedido
      ?? itemOrValue.codigoPedido
      ?? itemOrValue.codigo_pedido
      ?? ""
    : itemOrValue;
  const text = String(raw || "").trim();
  if (!text) return "-";
  return text.replace(/^[A-Za-z]+[-_\s]*(?=\d)/, "") || text;
}

export function deliveryMatchesSearch(item, search) {
  const query = normalizeDeliverySearchValue(search);
  if (!query) return true;

  const terms = query.split(" ").filter(Boolean);
  const values = deliverySearchValues(item).map(normalizeDeliverySearchValue).filter(Boolean);
  const haystack = values.join(" ");
  const compactDigits = values.map(value => value.replace(/\D/g, "")).filter(Boolean).join(" ");

  if (haystack.includes(query)) return true;
  return terms.every(term => {
    if (haystack.includes(term)) return true;
    const digits = term.replace(/\D/g, "");
    return digits ? compactDigits.includes(digits) : false;
  });
}

function deliveryPedidoId(item) {
  const candidates = [item?.pedidoID, item?.pedidoId, item?.pedido_id, item?.idPedido, item?.id_pedido, item?.numeroPedido, item?.numero_pedido];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(deliveryOrderCodeLabel(value));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function resolveDetailProductImageUrl(detail, catalogIndex = new Map()) {
  const products = Array.isArray(detail?.productos) ? detail.productos : [];
  for (const product of products) {
    const imageUrl = resolveDeliveryImageUrl(product, catalogIndex);
    if (imageUrl) return imageUrl;
  }
  return "";
}

export function resolveDetailArrangementName(detail) {
  const products = Array.isArray(detail?.productos)
    ? detail.productos
    : Array.isArray(detail?.data?.productos)
      ? detail.data.productos
      : Array.isArray(detail?.items)
        ? detail.items
        : [];
  const names = products
    .map(product => deliveryArrangementName(product))
    .filter(Boolean);
  return names.join(" + ");
}

function orderValue(item) {
  const value = Number(item?.total || item?.valor || item?.valorPedido || 0);
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `$${value.toLocaleString("es-CO")}`;
}

function deliveryTimeLabel(item) {
  return item?.horaEntrega || formatTimeOnly(item?.fechaEntregaProgramada) || "-";
}

function deliveryDateLabel(item) {
  const value = item?.fechaEntrega
    || item?.fecha_entrega
    || item?.fechaEntregaProgramada
    || item?.fecha_entrega_programada
    || item?.fechaProgramada
    || item?.fecha_programada;
  return formatDateOnly(value) || "";
}

function deliveryDateTimeLabel(item) {
  const date = deliveryDateLabel(item);
  const time = deliveryTimeLabel(item);
  return [date, time && time !== "-" ? time : ""].filter(Boolean).join(" · ") || "-";
}

function deliverySearchIgnoresDate(deliverySearch) {
  return /^#?\d{1,10}$/.test(String(deliverySearch || "").trim());
}

function deliveryMatchesSelectedDate(item, fechaFiltro, deliverySearch) {
  if (!fechaFiltro || deliverySearchIgnoresDate(deliverySearch)) return true;
  const date = deliveryDateLabel(item);
  return !date || date === fechaFiltro;
}

function courierName(item) {
  return item?.domiciliario || item?.nombreDomiciliario || item?.nombre_domiciliario || "Sin asignar";
}

function courierType(item) {
  const raw = String(item?.tipo || item?.tipoDomiciliario || item?.tipo_domiciliario || item?.origen || "").trim().toLowerCase();
  if (raw.includes("extern")) return "Externo";
  return "Interno";
}

function courierIdLabel(item, index) {
  const id = item?.codigo || item?.codigoDomiciliario || item?.idDomiciliario || item?.id || index + 1;
  const text = String(id).padStart(3, "0");
  return text.startsWith("DM-") ? text : `DM-${text}`;
}

function courierVehicle(item) {
  const type = item?.vehiculoTipo || item?.tipoVehiculo || item?.vehiculo || item?.vehicleType || "";
  const plate = item?.vehiculoPlaca || item?.placa || item?.plate || "";
  const detail = item?.detalleVehiculo || item?.detalle_vehiculo || item?.vehiculoDetalle || item?.modeloVehiculo || item?.modelo || item?.vehicleModel || "";
  return {
    type: String(type || "Sin vehiculo").trim(),
    plate: String(plate || "-").trim(),
    detail: String(detail || "").trim(),
  };
}

function courierBackendStatus(item) {
  const raw = String(item?.estado || "").trim();
  if (raw) return raw;
  return item?.activo === false ? "Inactivo" : "Activo";
}

function isDeletedCourier(item) {
  return normalizeStatus(courierBackendStatus(item)) === "ELIMINADO";
}

function courierEditFormFromItem(item) {
  const vehicle = courierVehicle(item);
  const vehiculo = String(item?.vehiculo || [vehicle.type, vehicle.plate !== "-" ? vehicle.plate : "", vehicle.detail].filter(Boolean).join(" ")).trim();
  const estado = courierBackendStatus(item);
  return {
    nombre: String(item?.nombre || item?.nombreDomiciliario || "").trim(),
    telefono: String(item?.telefono || item?.celular || item?.phone || "").trim(),
    tipo: courierType(item),
    estado,
    vehiculo,
    activo: estado === "Activo" && item?.activo !== false,
  };
}

function courierLogin(item) {
  return item?.login || item?.usuario || item?.email || normalizeSearchText(item?.nombre || item?.nombreDomiciliario || "domiciliario");
}

function courierIdValue(item) {
  const candidates = [
    item?.idDomiciliario,
    item?.domiciliarioID,
    item?.domiciliarioId,
    item?.domiciliarioid,
    item?.domiciliario_id,
    item?.id_domiciliario,
    item?.empleadoID,
    item?.empleadoId,
    item?.empleado_id,
    item?.idEmpleado,
    item?.id_empleado,
    item?.id,
  ];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function deliveryCourierIdValue(item) {
  const candidates = [
    item?.domiciliarioID,
    item?.domiciliarioId,
    item?.domiciliarioid,
    item?.domiciliario_id,
    item?.idDomiciliario,
    item?.id_domiciliario,
    item?.empleadoID,
    item?.empleadoId,
    item?.empleado_id,
    item?.idEmpleado,
    item?.id_empleado,
  ];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function courierStatus(index) {
  const options = ["Disponible", "Ocupado", "En ruta", "Fuera de servicio"];
  return options[index % options.length];
}

function courierActiveOrders(dom, items) {
  const id = courierIdValue(dom);
  if (id == null) return 0;
  return items.filter(item => deliveryCourierIdValue(item) === id).length;
}

function buildActionErrorMessage(error, fallback) {
  const detail = String(error?.detail || error?.message || "").trim();
  if (!detail) return fallback;
  if (/taken|tomad|asignad|ocupad|ya/i.test(detail)) {
    return "Este pedido ya fue tomado por otro domiciliario.";
  }
  if (/location|ubicaci|gps/i.test(detail)) {
    return "No fue posible validar la ubicación actual.";
  }
  return detail;
}

function clearBrowserTextSelection() {
  globalThis.getSelection?.()?.removeAllRanges?.();
}

async function requestCurrentCoords() {
  if (!globalThis.navigator?.geolocation) {
    throw new Error("Este dispositivo no soporta geolocalización.");
  }

  return new Promise((resolve, reject) => {
    globalThis.navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        });
      },
      error => {
        if (error?.code === 1) {
          reject(new Error("Debes permitir la ubicación para continuar."));
          return;
        }
        if (error?.code === 2) {
          reject(new Error("No fue posible obtener tu ubicación actual."));
          return;
        }
        reject(new Error("La ubicación tardó demasiado. Intenta de nuevo."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function toReprogramarIso(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function partitionMyOrders(items) {
  return items.reduce(
    (acc, item) => {
      const statusKey = deliveryStatusMeta(item).key;
      if (statusKey === "en-camino") {
        acc.enRuta.push(item);
      } else {
        acc.asignados.push(item);
      }
      return acc;
    },
    { asignados: [], enRuta: [] }
  );
}

export function DeliveryPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewBarrios,
  canViewInventario,
  canViewContabilidad,
  canViewTrazabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onLogout,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
  onGoInventario,
  onGoContabilidad,
  onGoTrazabilidad,
  onGoClientes,
  onGoUsuarios,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const usuarioCambio = String(session?.email || session?.nombre || "admin");
  const pedidosRole = isPedidosRole(session);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isOffline, setIsOffline] = useState(() => globalThis.navigator ? !globalThis.navigator.onLine : false);

  const [adminItems, setAdminItems] = useState([]);
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [courierDirectoryItems, setCourierDirectoryItems] = useState([]);
  const [selectedDomiciliarioByEntrega, setSelectedDomiciliarioByEntrega] = useState({});
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [deliveryProductImages, setDeliveryProductImages] = useState({});
  const [deliveryProductNames, setDeliveryProductNames] = useState({});
  const [filtro, setFiltro] = useState("hoy");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [fechaFiltro, setFechaFiltro] = useState(todayIso());
  const [metricsRangePreset, setMetricsRangePreset] = useState("mes");
  const [metricsFechaDesde, setMetricsFechaDesde] = useState(monthStartIso());
  const [metricsFechaHasta, setMetricsFechaHasta] = useState(todayIso());
  const [metricsGroupBy, setMetricsGroupBy] = useState("dia");
  const [metricsDomiciliarioId, setMetricsDomiciliarioId] = useState("");
  const [metricsPayload, setMetricsPayload] = useState(DEFAULT_DELIVERY_METRICS_RESPONSE);
  const [performanceUnassignedCount, setPerformanceUnassignedCount] = useState(0);
  const [performanceSort, setPerformanceSort] = useState("entregados");
  const [selectedPerformanceCourier, setSelectedPerformanceCourier] = useState(null);
  const [performanceOrderSearch, setPerformanceOrderSearch] = useState("");
  const [performanceOrdersLoading, setPerformanceOrdersLoading] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [noveltySearch, setNoveltySearch] = useState("");
  const [noveltyStatusFilter, setNoveltyStatusFilter] = useState("novedades");
  const [noveltyTypeFilter, setNoveltyTypeFilter] = useState("todas");
  const [noveltyDraft, setNoveltyDraft] = useState({ pedidoId: "", tipo: "", observacion: "" });
  const [resolvedNoveltyKeys, setResolvedNoveltyKeys] = useState([]);
  const [resolvedNoveltyObservations, setResolvedNoveltyObservations] = useState({});
  const [resolvingNoveltyRow, setResolvingNoveltyRow] = useState(null);
  const [noveltyResolveForm, setNoveltyResolveForm] = useState({
    accion: "entregar",
    recibidoNombre: "",
    recibidoDocumento: "",
    observacion: "",
  });
  const [noveltyResolveError, setNoveltyResolveError] = useState("");
  const [courierSearch, setCourierSearch] = useState("");
  const [openDeliveryActionsKey, setOpenDeliveryActionsKey] = useState("");
  const [evidenceModalItem, setEvidenceModalItem] = useState(null);
  const [noveltiesModalItem, setNoveltiesModalItem] = useState(null);
  const [statusModalItem, setStatusModalItem] = useState(null);
  const [statusForm, setStatusForm] = useState(DEFAULT_STATUS_FORM);

  const [modo, setModo] = useState("admin");
  const [domiciliarioId, setDomiciliarioId] = useState("");
  const [soloMisAsignados, setSoloMisAsignados] = useState(true);
  const [availableItems, setAvailableItems] = useState([]);
  const [myOrdersItems, setMyOrdersItems] = useState([]);
  const [availableCoords, setAvailableCoords] = useState(null);

  const [selectedDeliveryItem, setSelectedDeliveryItem] = useState(null);
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(DEFAULT_DELIVERY_FORM);
  const [courierForm, setCourierForm] = useState(DEFAULT_COURIER_FORM);
  const [courierEditForm, setCourierEditForm] = useState(DEFAULT_COURIER_EDIT_FORM);
  const [editingCourierId, setEditingCourierId] = useState(null);
  const [viewingCourierItem, setViewingCourierItem] = useState(null);
  const [courierSaving, setCourierSaving] = useState(false);
  const [courierCreateOpen, setCourierCreateOpen] = useState(false);
  const [courierStatusFilter, setCourierStatusFilter] = useState("todos");

  const [barriosItems, setBarriosItems] = useState([]);
  const [barriosSearch, setBarriosSearch] = useState("");
  const [barrioForm, setBarrioForm] = useState({
    zonaID: "",
    nombreBarrio: "",
    costoDomicilio: "",
    activo: true,
  });
  const [barrioSaving, setBarrioSaving] = useState(false);
  const [editingBarrioId, setEditingBarrioId] = useState(null);
  const [barrioEditForm, setBarrioEditForm] = useState({
    zonaID: "",
    nombreBarrio: "",
    costoDomicilio: "",
  });
  const catalogProductIndex = useMemo(
    () => buildCatalogProductIndex(catalogProducts),
    [catalogProducts]
  );

  const myOrdersGrouped = useMemo(() => partitionMyOrders(myOrdersItems), [myOrdersItems]);
  const evidenceModalSummary = useMemo(
    () => evidenceModalItem ? buildDeliveryEvidenceSummary(evidenceModalItem) : null,
    [evidenceModalItem]
  );
  const noveltiesModalSummary = useMemo(
    () => noveltiesModalItem ? buildDeliveryEvidenceSummary(noveltiesModalItem) : null,
    [noveltiesModalItem]
  );
  const statusModalSummary = useMemo(
    () => statusModalItem ? buildDeliveryEvidenceSummary(statusModalItem) : null,
    [statusModalItem]
  );
  const selectedPerformanceOrders = useMemo(() => {
    const orders = Array.isArray(selectedPerformanceCourier?.deliveredOrders)
      ? selectedPerformanceCourier.deliveredOrders
      : [];
    const term = normalizeSearchText(performanceOrderSearch);
    if (!term) return orders;
    return orders.filter(order => normalizeSearchText([
      order.orderCode,
      order.client,
      order.phone,
      order.address,
      order.date,
      order.time,
    ].filter(Boolean).join(" ")).includes(term));
  }, [selectedPerformanceCourier, performanceOrderSearch]);
  const selectedDeliveryRawStatus = deliveryRawStatus(selectedDeliveryItem);
  const selectedDeliveryState = normalizeStatus(selectedDeliveryRawStatus.code || selectedDeliveryRawStatus.name);
  const currentDomiciliarioId = useMemo(
    () => inferCurrentDomiciliarioId(session, domiciliarios),
    [session, domiciliarios]
  );
  const visibleAdminItems = useMemo(() => {
    if (!soloMisAsignados || currentDomiciliarioId == null) return adminItems;
    return adminItems.filter(item => deliveryCourierIdValue(item) === Number(currentDomiciliarioId));
  }, [adminItems, soloMisAsignados, currentDomiciliarioId]);
  const visibleDeliveryViews = useMemo(() => DELIVERY_VIEWS, []);

  useEffect(() => {
    setOpenDeliveryActionsKey("");
  }, [deliverySearch, filtro, modo, statusFilter]);

  useEffect(() => {
    setPerformanceOrderSearch("");
  }, [selectedPerformanceCourier?.key]);

  const filteredBarriosItems = useMemo(() => {
    const term = normalizeSearchText(barriosSearch);
    if (!term) return barriosItems;
    return barriosItems.filter(item => {
      const zona = String(item?.zonaID ?? "").trim();
      const nombre = String(item?.nombreBarrio || "").trim();
      const costo = String(item?.costoDomicilio ?? "").trim();
      return [zona, nombre, costo].some(value => normalizeSearchText(value).includes(term));
    });
  }, [barriosItems, barriosSearch]);

  useEffect(() => {
    if (currentDomiciliarioId == null) {
      setSoloMisAsignados(false);
      return;
    }
    setSoloMisAsignados(true);
  }, [currentDomiciliarioId]);

  useEffect(() => {
    setDeliveryForm(DEFAULT_DELIVERY_FORM);
  }, [selectedDeliveryItem?.idEntrega]);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    globalThis.addEventListener?.("online", goOnline);
    globalThis.addEventListener?.("offline", goOffline);

    return () => {
      globalThis.removeEventListener?.("online", goOnline);
      globalThis.removeEventListener?.("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = globalThis.setTimeout(() => setFeedback(""), 4500);
    return () => globalThis.clearTimeout(timer);
  }, [feedback]);

  const setBusy = key => {
    setActionKey(key);
    setError("");
    setFeedback("");
  };

  const clearBusy = () => {
    setActionKey("");
  };

  const loadDomiciliarios = useCallback(async () => {
    const data = await api.listarDomiciliarios({ empresaId, sucursalId, soloActivos: false });
    const rows = (Array.isArray(data.items) ? data.items : []).filter(item => !isDeletedCourier(item));
    setDomiciliarios(rows);
    if (!domiciliarioId && rows.length > 0) {
      const firstId = courierIdValue(rows[0]);
      if (firstId != null) setDomiciliarioId(String(firstId));
    }
  }, [api, empresaId, sucursalId, domiciliarioId]);

  const loadCourierDirectory = useCallback(async () => {
    const data = await api.listarDomiciliarios({
      empresaId,
      sucursalId,
      soloActivos: false,
      estado: courierStatusFilter,
      q: courierSearch.trim(),
    });
    setCourierDirectoryItems((Array.isArray(data.items) ? data.items : []).filter(item => !isDeletedCourier(item)));
  }, [api, empresaId, sucursalId, courierSearch, courierStatusFilter]);

  const loadPerformanceUnassignedCount = useCallback(async () => {
    const dates = metricDateRangeDays(metricsFechaDesde, metricsFechaHasta);
    if (dates.length === 0) return 0;

    const results = await Promise.allSettled(
      dates.map(fecha => api.listarPedidosDisponiblesPorFecha({ fecha }))
    );

    return results.reduce((acc, result) => (
      result.status === "fulfilled"
        ? acc + countPedidosDisponiblesPayload(result.value)
        : acc
    ), 0);
  }, [api, metricsFechaDesde, metricsFechaHasta]);

  const loadDeliveryMetrics = useCallback(async () => {
    const [metricsResult, unassignedResult] = await Promise.allSettled([
      api.obtenerMetricasDomicilios({
        empresaId,
        sucursalId,
        fechaDesde: metricsFechaDesde,
        fechaHasta: metricsFechaHasta,
        domiciliarioID: metricsDomiciliarioId ? Number(metricsDomiciliarioId) : null,
        agruparPor: modo === "novedades" ? "novedad" : metricsGroupBy,
      }),
      loadPerformanceUnassignedCount(),
    ]);

    if (metricsResult.status !== "fulfilled") throw metricsResult.reason;

    const data = metricsResult.value;
    setPerformanceUnassignedCount(unassignedResult.status === "fulfilled" ? unassignedResult.value : 0);
    setMetricsPayload({
      ...DEFAULT_DELIVERY_METRICS_RESPONSE,
      ...(data || {}),
      resumen: {
        ...DEFAULT_DELIVERY_METRICS_SUMMARY,
        ...(data?.resumen || {}),
      },
      items: Array.isArray(data?.items) ? data.items : [],
      porDomiciliario: Array.isArray(data?.porDomiciliario) ? data.porDomiciliario : [],
      porEstadoEntrega: Array.isArray(data?.porEstadoEntrega) ? data.porEstadoEntrega : [],
      porEstadoPedido: Array.isArray(data?.porEstadoPedido) ? data.porEstadoPedido : [],
      porBarrio: Array.isArray(data?.porBarrio) ? data.porBarrio : [],
      porZona: Array.isArray(data?.porZona) ? data.porZona : [],
      novedades: Array.isArray(data?.novedades) ? data.novedades : [],
    });
  }, [api, empresaId, sucursalId, metricsFechaDesde, metricsFechaHasta, metricsDomiciliarioId, metricsGroupBy, modo, loadPerformanceUnassignedCount]);

  const loadNoveltyDeliveries = useCallback(async () => {
    const data = await api.listarDomiciliosAdmin({
      empresaId,
      sucursalId,
      filtro: "noentregado",
    });
    setAdminItems(filterDomicilioItems(normalizeDeliveryItemsPayload(data)).filter(item => !isCanceledDeliveryStatus(item)));
  }, [api, empresaId, sucursalId]);

  const loadAdmin = useCallback(async () => {
    const queryPlan = buildDeliveryAdminQueryPlan({ filtro, statusFilter, fechaFiltro, deliverySearch });
    const baseParams = {
      empresaId,
      sucursalId,
      fecha: queryPlan.fecha,
      q: queryPlan.q,
    };

    const results = await Promise.allSettled(
      queryPlan.filtersToFetch.map(nextFilter => api.listarDomiciliosAdmin({ ...baseParams, filtro: nextFilter }))
    );
    const deduped = new Map();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const data = result.value;
      for (const item of Array.isArray(data.items) ? data.items : []) {
        const key = String(item?.idEntrega || item?.id_entrega || item?.pedidoID || item?.pedidoId || item?.idPedido || item?.numeroPedido || item?.numero_pedido || "");
        if (!key) continue;
        deduped.set(key, item);
      }
    }
    setAdminItems(filterDomicilioItems(Array.from(deduped.values())).filter(item => !isCanceledDeliveryStatus(item)));
  }, [api, empresaId, sucursalId, filtro, fechaFiltro, statusFilter, deliverySearch]);

  const loadAvailableOrders = useCallback(async coords => {
    const [snapshotResult, availableResult] = await Promise.allSettled([
      api.listarDomiciliosAdmin({
        empresaId,
        sucursalId,
        filtro: "hoy",
        fecha: fechaFiltro,
      }),
      api.listarPedidosDisponibles({
        empresaId,
        sucursalId,
        fecha: fechaFiltro,
        latitud: coords?.lat,
        longitud: coords?.lng,
        pageSize: DELIVERY_SYNC_PAGE_SIZE,
        limit: DELIVERY_SYNC_PAGE_SIZE,
      }),
    ]);

    if (snapshotResult.status !== "fulfilled" && availableResult.status !== "fulfilled") {
      throw snapshotResult.reason || availableResult.reason;
    }

    const snapshotRows = snapshotResult.status === "fulfilled"
      ? filterDomicilioItems(normalizeDeliveryItemsPayload(snapshotResult.value)).filter(isUnassignedDelivery)
      : [];
    const availableRows = availableResult.status === "fulfilled"
      ? filterDomicilioItems(normalizeDeliveryItemsPayload(availableResult.value)).filter(isUnassignedDelivery)
      : [];

    setAvailableItems(filterDomicilioItems(mergeDeliveryItemsByKey(availableRows, snapshotRows)));
  }, [api, empresaId, sucursalId, fechaFiltro]);

  const loadMyOrders = useCallback(async () => {
    const [snapshotResult, myOrdersResult] = await Promise.allSettled([
      api.listarDomiciliosAdmin({
        empresaId,
        sucursalId,
        filtro: "hoy",
        fecha: fechaFiltro,
      }),
      api.listarMisPedidos({
        empresaId,
        sucursalId,
        fecha: fechaFiltro,
      }),
    ]);

    if (snapshotResult.status !== "fulfilled" && myOrdersResult.status !== "fulfilled") {
      throw snapshotResult.reason || myOrdersResult.reason;
    }

    const snapshotRows = snapshotResult.status === "fulfilled" && currentDomiciliarioId != null
      ? filterDomicilioItems(normalizeDeliveryItemsPayload(snapshotResult.value)).filter(item => (
        !isCanceledDeliveryStatus(item)
        && deliveryCourierIdValue(item) === Number(currentDomiciliarioId)
      ))
      : [];
    const myOrdersRows = myOrdersResult.status === "fulfilled"
      ? filterDomicilioItems(normalizeDeliveryItemsPayload(myOrdersResult.value)).filter(item => !isCanceledDeliveryStatus(item))
      : [];

    setMyOrdersItems(filterDomicilioItems(snapshotRows.length > 0
      ? mergeDeliveryItemsByKey(myOrdersRows, snapshotRows)
      : myOrdersRows));
  }, [api, empresaId, sucursalId, fechaFiltro, currentDomiciliarioId]);

  useEffect(() => {
    let disposed = false;
    api.buscarArreglosCatalogo({ empresaId, sucursalId, q: "" })
      .then(payload => {
        if (disposed) return;
        const rows = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];
        setCatalogProducts(dedupeCatalogItems(rows.map(item => normalizeCatalogItem(item)).filter(Boolean)));
      })
      .catch(catalogError => {
        console.warn("No fue posible cargar imágenes del catálogo en domicilios:", catalogError);
        if (!disposed) setCatalogProducts([]);
      });

    return () => { disposed = true; };
  }, [api, empresaId, sucursalId]);

  const loadBarrios = useCallback(async () => {
    const data = await api.listarBarriosDomicilios({ sucursalId });
    setBarriosItems(Array.isArray(data.items) ? data.items : []);
  }, [api, sucursalId]);

  const runLoad = useCallback(async loader => {
    setLoading(true);
    setError("");

    try {
      await loader();
    } catch (nextError) {
      console.error("Error en módulo de domicilios:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible cargar domicilios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runLoad(loadDomiciliarios).catch(() => {});
  }, [loadDomiciliarios, runLoad]);

  useEffect(() => {
    if (modo === "admin") {
      runLoad(loadAdmin).catch(() => {});
      return;
    }
    if (modo === "domiciliarios") {
      runLoad(async () => {
        await Promise.all([loadDomiciliarios(), loadCourierDirectory()]);
      }).catch(() => {});
      return;
    }
    if (modo === "metricas" || modo === "novedades") {
      runLoad(async () => {
        await Promise.all([
          loadDomiciliarios(),
          loadDeliveryMetrics(),
          ...(modo === "novedades" ? [loadNoveltyDeliveries()] : []),
        ]);
      }).catch(() => {});
      return;
    }
    if (modo === "disponibles") {
      runLoad(() => loadAvailableOrders(availableCoords)).catch(() => {});
      return;
    }
    runLoad(loadMyOrders).catch(() => {});
  }, [modo, runLoad, loadAdmin, loadAvailableOrders, loadMyOrders, loadDomiciliarios, loadCourierDirectory, loadDeliveryMetrics, loadNoveltyDeliveries, availableCoords]);

  const withCoords = async actionLabel => {
    if (isOffline) {
      throw new Error("Sin conexión. Revisa internet antes de continuar.");
    }

    const coords = await requestCurrentCoords();
    setAvailableCoords(coords);
    setFeedback(`Ubicación confirmada para ${actionLabel}.`);
    return coords;
  };

  const optionalCoords = async () => {
    if (isOffline) {
      throw new Error("Sin conexión. Revisa internet antes de continuar.");
    }

    try {
      const coords = await requestCurrentCoords();
      setAvailableCoords(coords);
      return coords;
    } catch {
      setAvailableCoords(null);
      return null;
    }
  };

  const handleModeChange = async nextMode => {
    setError("");
    setFeedback("");

    const safeMode = DELIVERY_SUPPORTED_MODES.has(nextMode) ? nextMode : "admin";

    if (safeMode !== "disponibles") {
      setModo(safeMode);
      return;
    }

    try {
      const coords = await withCoords("consultar pedidos disponibles");
      setModo(safeMode);
      setLoading(true);
      await loadAvailableOrders(coords);
    } catch (nextError) {
      setModo(safeMode);
      setAvailableCoords(null);
      setError(nextError?.message || "No fue posible obtener tu ubicación.");
    } finally {
      setLoading(false);
    }
  };

  const onChangeMetricsRangePreset = value => {
    setMetricsRangePreset(value);
    if (value === "personalizado") return;
    const nextRange = deliveryMetricRangeForPreset(value);
    setMetricsFechaDesde(nextRange.fechaDesde);
    setMetricsFechaHasta(nextRange.fechaHasta);
    setMetricsGroupBy(nextRange.agruparPor);
  };

  const onClearMetricsFilters = () => {
    const nextRange = deliveryMetricRangeForPreset("mes");
    setMetricsRangePreset("mes");
    setMetricsFechaDesde(nextRange.fechaDesde);
    setMetricsFechaHasta(nextRange.fechaHasta);
    setMetricsGroupBy(nextRange.agruparPor);
    setMetricsDomiciliarioId("");
  };

  const onViewPendingDeliveries = () => {
    setModo("admin");
    setStatusFilter("pendiente");
    setFiltro("pendientes");
    setDeliverySearch("");
  };

  const refreshAll = async () => {
    if (modo === "disponibles") {
      setLoading(true);
      setError("");
      try {
        const coords = await withCoords("actualizar distancias");
        await Promise.all([loadDomiciliarios(), loadAvailableOrders(coords)]);
      } catch (nextError) {
        setError(nextError?.message || "No fue posible actualizar pedidos disponibles.");
      } finally {
        setLoading(false);
      }
      return;
    }

    await runLoad(async () => {
      await loadDomiciliarios();
      if (modo === "admin") {
        await loadAdmin();
      } else if (modo === "metricas" || modo === "novedades") {
        await Promise.all([
          loadDomiciliarios(),
          loadDeliveryMetrics(),
          ...(modo === "novedades" ? [loadNoveltyDeliveries()] : []),
        ]);
      } else if (modo === "domiciliarios") {
        await loadCourierDirectory();
      } else {
        await loadMyOrders();
      }
    });
  };

  const onChangeSoloMisAsignados = checked => {
    setSoloMisAsignados(checked);
  };

  const onCrearDomiciliario = async () => {
    if (courierSaving) return;
    const nombre = courierForm.nombre.trim();
    if (!nombre) {
      setError("Ingresa el nombre del domiciliario.");
      return;
    }

    setCourierSaving(true);
    setError("");
    setFeedback("");
    try {
      const createdCourier = await api.crearDomiciliario({
        empresaId,
        nombre,
        telefono: courierForm.telefono.trim(),
        tipo: courierForm.tipo,
        vehiculo: courierForm.vehiculoTipo,
        placa: courierForm.vehiculoPlaca.trim(),
        detalleVehiculo: courierForm.vehiculoDetalle.trim(),
        activo: courierForm.activo,
      });
      const credentialParts = [
        createdCourier?.login ? `Usuario: ${createdCourier.login}` : "",
        createdCourier?.passwordTemporal ? `Clave temporal: ${createdCourier.passwordTemporal}` : "",
      ].filter(Boolean);
      setFeedback(credentialParts.length
        ? `Domiciliario creado correctamente. ${credentialParts.join(" - ")}`
        : "Domiciliario creado correctamente.");
      setCourierForm(DEFAULT_COURIER_FORM);
      setCourierCreateOpen(false);
      await Promise.all([loadDomiciliarios(), loadCourierDirectory()]);
    } catch (nextError) {
      console.error("Error creando domiciliario:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible crear el domiciliario.");
    } finally {
      setCourierSaving(false);
    }
  };

  const onStartEditCourier = item => {
    const domId = courierIdValue(item);
    if (domId == null) return;
    setViewingCourierItem(null);
    setEditingCourierId(domId);
    setCourierEditForm(courierEditFormFromItem(item));
    setError("");
    setFeedback("");
  };

  const onViewCourier = item => {
    if (!item) return;
    setEditingCourierId(null);
    setViewingCourierItem(item);
    setError("");
    setFeedback("");
  };

  const onCancelEditCourier = () => {
    setEditingCourierId(null);
    setCourierEditForm(DEFAULT_COURIER_EDIT_FORM);
  };

  const onSaveEditCourier = async idDomiciliario => {
    if (courierSaving) return;
    const nombre = courierEditForm.nombre.trim();
    const telefono = courierEditForm.telefono.trim();
    const tipo = courierEditForm.tipo.trim();
    const vehiculo = courierEditForm.vehiculo.trim();
    if (nombre.length < 3) {
      setError("El nombre del domiciliario debe tener al menos 3 caracteres.");
      return;
    }
    if (telefono.length > 40) {
      setError("El telefono no puede superar 40 caracteres.");
      return;
    }
    if (tipo.length > 80 || vehiculo.length > 80) {
      setError("Tipo y vehiculo no pueden superar 80 caracteres.");
      return;
    }

    setCourierSaving(true);
    setError("");
    setFeedback("");
    try {
      await api.actualizarDomiciliario({
        idDomiciliario,
        empresaId,
        nombre,
        telefono,
        tipo,
        estado: courierEditForm.estado,
        vehiculo,
        activo: courierEditForm.estado === "Activo",
      });
      setFeedback("Domiciliario actualizado correctamente.");
      onCancelEditCourier();
      await Promise.all([loadDomiciliarios(), loadCourierDirectory()]);
    } catch (nextError) {
      console.error("Error actualizando domiciliario:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar el domiciliario.");
    } finally {
      setCourierSaving(false);
    }
  };

  const onDeleteCourier = async item => {
    if (courierSaving) return;
    const idDomiciliario = courierIdValue(item);
    if (idDomiciliario == null) return;
    const confirmed = globalThis.confirm("Seguro que deseas eliminar este domiciliario?");
    if (!confirmed) return;

    setCourierSaving(true);
    setError("");
    setFeedback("");
    try {
      await api.eliminarDomiciliario({ idDomiciliario, empresaId });
      setFeedback("Domiciliario eliminado correctamente.");
      if (editingCourierId === idDomiciliario) onCancelEditCourier();
      await Promise.all([loadDomiciliarios(), loadCourierDirectory()]);
    } catch (nextError) {
      console.error("Error eliminando domiciliario:", nextError);
      const message = nextError?.status === 409
        ? "No se puede eliminar un domiciliario con pedidos activos."
        : nextError?.detail || nextError?.message || "No fue posible eliminar el domiciliario.";
      setError(message);
    } finally {
      setCourierSaving(false);
    }
  };

  const loadPerformanceCourierDeliveredOrders = useCallback(async courier => {
    const dates = metricDateRangeDays(metricsFechaDesde, metricsFechaHasta);
    if (!courier || dates.length === 0) return [];
    const courierIdValueForRequest = performanceCourierIdValue(courier);
    const courierId = courierIdValueForRequest != null ? String(courierIdValueForRequest) : "";

    const results = await Promise.allSettled(
      dates.map(fecha => api.listarDomiciliosAdmin({
        empresaId,
        sucursalId,
        filtro: "entregado",
        fecha,
        domiciliarioID: courierId || null,
        q: courierId ? "" : courier.nombre,
      }))
    );

    const rows = results.flatMap(result => (
      result.status === "fulfilled"
        ? filterDomicilioItems(normalizeDeliveryItemsPayload(result.value)).filter(item => deliveryStatusMeta(item).key === "entregado")
        : []
    ));

    return dedupeDeliveryItems(rows)
      .map((item, index) => performanceDeliveredOrderFromItem(item, index))
      .filter(order => performanceOrderMatchesCourier(order, courier));
  }, [api, empresaId, sucursalId, metricsFechaDesde, metricsFechaHasta]);

  const openPerformanceCourierDetail = async courier => {
    if (!courier) return;
    setSelectedPerformanceCourier({ ...courier, deliveredOrders: [] });
    setPerformanceOrdersLoading(true);
    try {
      const deliveredOrders = await loadPerformanceCourierDeliveredOrders(courier);
      const safeDeliveredOrders = deliveredOrders.length > Number(courier.entregados || 0)
        ? []
        : deliveredOrders;
      setSelectedPerformanceCourier(current => (
        current?.key === courier.key ? { ...current, deliveredOrders: safeDeliveredOrders } : current
      ));
    } catch (nextError) {
      console.error("Error cargando pedidos entregados del domiciliario:", nextError);
      setSelectedPerformanceCourier(current => (
        current?.key === courier.key ? { ...current, deliveredOrders: [] } : current
      ));
    } finally {
      setPerformanceOrdersLoading(false);
    }
  };

  const openDeliveryDetail = item => {
    if (!item) return;
    setSelectedDeliveryItem(item);
    setDeliveryDrawerOpen(true);
  };

  const closeDeliveryDetail = () => {
    setDeliveryDrawerOpen(false);
    setSelectedDeliveryItem(null);
  };

  const openMaps = item => {
    const address = encodeURIComponent(`${item?.direccion || ""} ${item?.barrio || ""}`.trim());
    globalThis.open(`https://www.google.com/maps/search/?api=1&query=${address}`, "_blank", "noreferrer");
  };

  const openWhatsApp = item => {
    const phone = String(item?.telefonoDestino || "").replace(/\+/g, "").trim();
    if (!phone) {
      setError("Este pedido no tiene teléfono registrado.");
      return;
    }
    const msg = encodeURIComponent(item?.mensaje || "Hola, vamos en camino con tu pedido.");
    globalThis.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noreferrer");
  };

  const openStatusModal = item => {
    if (!item) return;
    setError("");
    setStatusModalItem(item);
    setStatusForm(DEFAULT_STATUS_FORM);
  };

  const closeStatusModal = () => {
    setStatusModalItem(null);
    setStatusForm(DEFAULT_STATUS_FORM);
  };

  const refreshDeliveryListsAfterStatusChange = async () => {
    await Promise.allSettled([
      loadAdmin(),
      loadMyOrders(),
    ]);
  };

  const onSaveStatusChange = async () => {
    if (!statusModalItem?.idEntrega) {
      setError("No fue posible identificar la entrega para cambiar el estado.");
      return;
    }

    const entregaId = statusModalItem.idEntrega;
    const nextStatus = statusForm.estado;
    setError("");
    setBusy(`estado-${entregaId}`);

    try {
      if (nextStatus === "en-ruta") {
        await api.marcarEntregaEnRuta({ entregaId, usuarioCambio });
        setFeedback("Pedido marcado como en ruta.");
      } else if (nextStatus === "entregado") {
        const coords = await optionalCoords();
        await api.marcarEntregaEntregado({
          entregaId,
          usuarioCambio,
          firmaNombre: statusForm.firmaNombre.trim(),
          firmaDocumento: statusForm.firmaDocumento.trim(),
          firmaImagenFile: statusForm.firmaImagenFile,
          evidenciaFotoFile: statusForm.evidenciaFotoFile,
          latitudEntrega: coords?.lat,
          longitudEntrega: coords?.lng,
          observaciones: statusForm.observaciones.trim(),
        });
        setFeedback("Pedido marcado como entregado.");
      } else if (nextStatus === "no-entregado") {
        if (!statusForm.motivo.trim()) {
          setError("Registra el motivo para marcar no entregado.");
          return;
        }
        await api.marcarEntregaNoEntregado({
          entregaId,
          usuarioCambio,
          motivo: statusForm.motivo.trim(),
          reprogramarPara: toReprogramarIso(statusForm.reprogramarPara),
          observaciones: statusForm.observaciones.trim(),
        });
        setFeedback("Pedido marcado como no entregado.");
      }

      closeStatusModal();
      await refreshDeliveryListsAfterStatusChange();
    } catch (nextError) {
      console.error("Error cambiando estado de entrega:", nextError);
      setError(buildActionErrorMessage(nextError, "No fue posible cambiar el estado del pedido."));
    } finally {
      clearBusy();
    }
  };

  const onSaveNoveltyDraft = () => {
    if (!noveltyDraft.pedidoId || !noveltyDraft.tipo || !noveltyDraft.observacion.trim()) {
      setError("Completa pedido, tipo y observacion para registrar la novedad.");
      return;
    }
    setError("");
    setFeedback("Novedad lista para registrar cuando se conecte el endpoint.");
  };

  const onOpenResolveNovelty = row => {
    setError("");
    setNoveltyResolveError("");
    setResolvingNoveltyRow(row);
    setNoveltyResolveForm({
      accion: "entregar",
      recibidoNombre: "",
      recibidoDocumento: "",
      observacion: "",
    });
  };

  const onCloseResolveNovelty = () => {
    setResolvingNoveltyRow(null);
    setNoveltyResolveError("");
    setNoveltyResolveForm({
      accion: "entregar",
      recibidoNombre: "",
      recibidoDocumento: "",
      observacion: "",
    });
  };

  const removeNoveltyFromMetrics = useCallback(entregaId => {
    const targetId = String(entregaId || "").trim();
    if (!targetId) return;
    const detailKeys = [
      "novedadesDetalle",
      "detalleNovedades",
      "pedidosConNovedad",
      "pedidosNovedades",
      "novedadesPedidos",
      "novedadesPorPedido",
    ];

    setMetricsPayload(current => detailKeys.reduce((nextPayload, key) => {
      if (!Array.isArray(nextPayload?.[key])) return nextPayload;
      return {
        ...nextPayload,
        [key]: nextPayload[key].filter(item => String(item?.idEntrega || item?.id_entrega || "").trim() !== targetId),
      };
    }, current));
  }, []);

  const onSaveResolveNovelty = async () => {
    if (!resolvingNoveltyRow) return;
    const entregaId = resolvingNoveltyRow.item?.idEntrega || resolvingNoveltyRow.raw?.idEntrega;
    if (!entregaId) {
      setNoveltyResolveError("No fue posible identificar la entrega para resolver la novedad.");
      return;
    }
    if (!noveltyResolveForm.observacion.trim()) {
      setNoveltyResolveError("Debes diligenciar la observacion para resolver la novedad.");
      return;
    }

    setNoveltyResolveError("");
    setBusy(`resolver-novedad-${entregaId}`);
    try {
      await api.resolverNovedadEntrega({
        entregaId,
        usuarioCambio,
        observaciones: noveltyResolveForm.observacion.trim(),
        firmaNombre: noveltyResolveForm.recibidoNombre.trim(),
        firmaDocumento: noveltyResolveForm.recibidoDocumento.trim(),
      });
      const nextResolvedKeys = [
        entregaId,
        resolvingNoveltyRow.raw?.idNovedad,
        resolvingNoveltyRow.raw?.id_novedad,
        resolvingNoveltyRow.raw?.idPedido,
        resolvingNoveltyRow.raw?.id_pedido,
        resolvingNoveltyRow.orderCode,
      ].filter(value => value != null && String(value).trim()).map(value => String(value).trim());
      const resolutionObservation = noveltyResolveForm.observacion.trim();
      setResolvedNoveltyKeys(prev => Array.from(new Set([...prev, ...nextResolvedKeys])));
      setResolvedNoveltyObservations(prev => nextResolvedKeys.reduce((acc, key) => ({
        ...acc,
        [key]: resolutionObservation,
      }), prev));
      setFeedback(`Novedad resuelta para el pedido ${resolvingNoveltyRow.orderCode}.`);
      onCloseResolveNovelty();
      removeNoveltyFromMetrics(entregaId);
      await refreshAll();
    } catch (nextError) {
      console.error("Error resolviendo novedad:", nextError);
      setNoveltyResolveError(buildActionErrorMessage(nextError, "No fue posible resolver la novedad."));
    } finally {
      clearBusy();
    }
  };

  const onAsignar = async (item, nextDomiciliarioId) => {
    const domiciliarioValue = nextDomiciliarioId ?? selectedDomiciliarioByEntrega[item.idEntrega] ?? deliveryCourierIdValue(item) ?? "";
    setBusy(`asignar-${item.idEntrega}`);
    try {
      await api.asignarDomiciliarioEntrega({
        entregaId: item.idEntrega,
        domiciliarioID: domiciliarioValue ? Number(domiciliarioValue) : null,
        usuarioCambio,
        limiteEntregasActivas: MAX_ENTREGAS_ACTIVAS_DOMICILIARIO,
      });
      setFeedback("Domiciliario asignado correctamente.");
      clearBrowserTextSelection();
      await refreshAll();
    } catch (nextError) {
      console.error("Error asignando domiciliario:", nextError);
      setError(buildActionErrorMessage(nextError, "No fue posible asignar domiciliario."));
    } finally {
      clearBusy();
    }
  };

  const onTomar = async item => {
    setBusy(`tomar-${item.idEntrega}`);
    try {
      const coords = await withCoords("tomar el pedido");
      await api.tomarEntrega({
        entregaId: item.idEntrega,
        usuarioCambio,
        limiteEntregasActivas: MAX_ENTREGAS_ACTIVAS_DOMICILIARIO,
      });
      setFeedback("Pedido tomado correctamente.");
      await Promise.all([loadMyOrders(), loadAvailableOrders(coords)]);
    } catch (nextError) {
      console.error("Error tomando entrega:", nextError);
      setError(buildActionErrorMessage(nextError, "No fue posible tomar la entrega."));
    } finally {
      clearBusy();
    }
  };

  const onEnRuta = async item => {
    const entregaId = item?.idEntrega;
    if (!entregaId) return;

    setBusy(`enruta-${entregaId}`);
    try {
      await api.marcarEntregaEnRuta({ entregaId, usuarioCambio });
      setFeedback("Pedido marcado como en camino.");
      await loadMyOrders();
      if (selectedDeliveryItem?.idEntrega === entregaId) {
        setSelectedDeliveryItem(current => current ? { ...current, estado: "EnRuta" } : current);
      }
    } catch (nextError) {
      console.error("Error marcando en ruta:", nextError);
      setError(buildActionErrorMessage(nextError, "No fue posible iniciar la entrega."));
    } finally {
      clearBusy();
    }
  };

  const onEntregado = async item => {
    const entregaId = item?.idEntrega;
    if (!entregaId) return;

    setBusy(`entregar-${entregaId}`);
    try {
      const coords = await optionalCoords();
      await api.marcarEntregaEntregado({
        entregaId,
        usuarioCambio,
        firmaNombre: deliveryForm.firmaNombre.trim(),
        firmaDocumento: deliveryForm.firmaDocumento.trim(),
        firmaImagenFile: deliveryForm.firmaImagenFile,
        evidenciaFotoFile: deliveryForm.evidenciaFotoFile,
        latitudEntrega: coords?.lat,
        longitudEntrega: coords?.lng,
        observaciones: deliveryForm.observaciones.trim(),
      });
      setFeedback("Entrega confirmada con evidencia.");
      closeDeliveryDetail();
      await loadMyOrders();
    } catch (nextError) {
      console.error("Error marcando entregado:", nextError);
      setError(buildActionErrorMessage(nextError, "No fue posible marcar entregado."));
    } finally {
      clearBusy();
    }
  };

  const onNoEntregado = async item => {
    const entregaId = item?.idEntrega;
    if (!entregaId) return;
    if (!deliveryForm.noEntregadoMotivo.trim()) {
      setError("Debes registrar el motivo de no entrega.");
      return;
    }

    setBusy(`noentregado-${entregaId}`);
    try {
      await api.marcarEntregaNoEntregado({
        entregaId,
        usuarioCambio,
        motivo: deliveryForm.noEntregadoMotivo.trim(),
        reprogramarPara: toReprogramarIso(deliveryForm.reprogramarPara),
        observaciones: deliveryForm.observaciones.trim(),
      });
      setFeedback("Pedido marcado como no entregado.");
      closeDeliveryDetail();
      await loadMyOrders();
    } catch (nextError) {
      console.error("Error marcando no entregado:", nextError);
      setError(buildActionErrorMessage(nextError, "No fue posible marcar no entregado."));
    } finally {
      clearBusy();
    }
  };

  const onChangeBarrioForm = (field, value) => {
    setBarrioForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const onCrearBarrio = async () => {
    if (barrioSaving) return;
    setBarrioSaving(true);
    setError("");
    try {
      await api.crearBarrioDomicilios({
        sucursalID: sucursalId,
        zonaID: Number(barrioForm.zonaID || 0),
        nombreBarrio: barrioForm.nombreBarrio,
        costoDomicilio: Number(barrioForm.costoDomicilio || 0),
        activo: Boolean(barrioForm.activo),
      });
      setFeedback("Barrio creado correctamente.");
      setBarrioForm({
        zonaID: "",
        nombreBarrio: "",
        costoDomicilio: "",
        activo: true,
      });
      await loadBarrios();
    } catch (nextError) {
      console.error("Error creando barrio:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible crear el barrio.");
    } finally {
      setBarrioSaving(false);
    }
  };

  const onStartEditBarrio = item => {
    setEditingBarrioId(item?.idBarrio ?? null);
    setBarrioEditForm({
      zonaID: String(item?.zonaID ?? ""),
      nombreBarrio: String(item?.nombreBarrio || ""),
      costoDomicilio: String(item?.costoDomicilio ?? ""),
    });
    setError("");
  };

  const onCancelEditBarrio = () => {
    setEditingBarrioId(null);
    setBarrioEditForm({
      zonaID: "",
      nombreBarrio: "",
      costoDomicilio: "",
    });
  };

  const onSaveEditBarrio = async barrioId => {
    if (barrioSaving) return;
    setBarrioSaving(true);
    setError("");
    try {
      await api.actualizarBarrioDomicilios({
        barrioId: Number(barrioId),
        sucursalID: sucursalId,
        zonaID: Number(barrioEditForm.zonaID || 0),
        nombreBarrio: String(barrioEditForm.nombreBarrio || "").trim(),
        costoDomicilio: Number(barrioEditForm.costoDomicilio || 0),
      });
      setFeedback("Barrio actualizado.");
      onCancelEditBarrio();
      await loadBarrios();
    } catch (nextError) {
      console.error("Error actualizando barrio:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar el barrio.");
    } finally {
      setBarrioSaving(false);
    }
  };

  const onDeleteBarrio = async barrioId => {
    if (barrioSaving) return;
    const confirmed = globalThis.confirm("¿Seguro que deseas borrar este barrio?");
    if (!confirmed) return;
    setBarrioSaving(true);
    setError("");
    try {
      await api.borrarBarrioDomicilios({
        barrioId: Number(barrioId),
        sucursalID: sucursalId,
      });
      setFeedback("Barrio eliminado.");
      if (editingBarrioId === barrioId) {
        onCancelEditBarrio();
      }
      await loadBarrios();
    } catch (nextError) {
      console.error("Error borrando barrio:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible borrar el barrio.");
    } finally {
      setBarrioSaving(false);
    }
  };

  const availableSummary = availableItems.length
    ? `${availableItems.length} pedidos listos para domicilios`
    : "No hay pedidos disponibles para tomar";

  const dispatchItems = useMemo(() => {
    if (modo === "disponibles") return availableItems;
    if (modo === "mis-pedidos") return myOrdersItems;
    return visibleAdminItems;
  }, [modo, availableItems, myOrdersItems, visibleAdminItems]);

  const dispatchFilteredBaseItems = useMemo(() => (
    dispatchItems.filter(item => (
      deliveryMatchesSelectedDate(item, fechaFiltro, deliverySearch)
      && deliveryMatchesSearch(item, deliverySearch)
    ))
  ), [deliverySearch, dispatchItems, fechaFiltro]);

  const filteredDispatchItems = useMemo(() => {
    const byStatus = statusFilter === "todos"
      ? dispatchFilteredBaseItems
      : dispatchFilteredBaseItems.filter(item => deliveryStatusMeta(item).key === statusFilter);

    return byStatus;
  }, [dispatchFilteredBaseItems, statusFilter]);

  useEffect(() => {
    const missingItems = filteredDispatchItems
      .filter(item => {
        const key = deliveryItemKey(item);
        if (!key || deliveryPedidoId(item) == null) return false;
        const missingImage = !resolveDeliveryImageUrl(item, catalogProductIndex) && deliveryProductImages[key] == null;
        const missingName = !deliveryArrangementName(item) && deliveryProductNames[key] == null;
        return missingImage || missingName;
      })
      .slice(0, 20);

    if (missingItems.length === 0) return undefined;

    let disposed = false;
    Promise.allSettled(missingItems.map(async item => {
      const detail = await api.obtenerDetallePedido(deliveryPedidoId(item));
      return {
        key: deliveryItemKey(item),
        imageUrl: resolveDetailProductImageUrl(detail, catalogProductIndex),
        productName: resolveDetailArrangementName(detail),
      };
    })).then(results => {
      if (disposed) return;
      setDeliveryProductImages(current => {
        const next = { ...current };
        for (const result of results) {
          if (result.status !== "fulfilled" || !result.value?.key) continue;
          next[result.value.key] = result.value.imageUrl || "";
        }
        return next;
      });
      setDeliveryProductNames(current => {
        const next = { ...current };
        for (const result of results) {
          if (result.status !== "fulfilled" || !result.value?.key) continue;
          next[result.value.key] = result.value.productName || "";
        }
        return next;
      });
    });

    return () => { disposed = true; };
  }, [api, catalogProductIndex, deliveryProductImages, deliveryProductNames, filteredDispatchItems]);

  const selectedDispatchItem = selectedDeliveryItem || filteredDispatchItems[0] || null;
  const courierSearchTerm = normalizeSearchText(courierSearch);
  const filteredDomiciliarios = useMemo(() => {
    if (!courierSearchTerm) return domiciliarios;
    return domiciliarios.filter(item => normalizeSearchText(item?.nombre || item?.nombreDomiciliario || item?.login).includes(courierSearchTerm));
  }, [domiciliarios, courierSearchTerm]);
  const courierDirectoryRows = courierDirectoryItems;
  const dispatchKpis = useMemo(() => {
    const base = { pendiente: 0, asignado: 0, "en-camino": 0, entregado: 0, "no-entregado": 0, reprogramado: 0 };
    dispatchFilteredBaseItems.forEach(item => {
      const key = deliveryStatusMeta(item).key;
      base[key] = (base[key] || 0) + 1;
    });
    return base;
  }, [dispatchFilteredBaseItems]);
  const deliveryMetrics = useMemo(() => {
    const resumen = {
      ...DEFAULT_DELIVERY_METRICS_SUMMARY,
      ...(metricsPayload?.resumen || {}),
    };
    return {
      resumen,
      items: Array.isArray(metricsPayload?.items) ? metricsPayload.items : [],
      porDomiciliario: Array.isArray(metricsPayload?.porDomiciliario) ? metricsPayload.porDomiciliario : [],
      porEstadoEntrega: Array.isArray(metricsPayload?.porEstadoEntrega) ? metricsPayload.porEstadoEntrega : [],
      porEstadoPedido: Array.isArray(metricsPayload?.porEstadoPedido) ? metricsPayload.porEstadoPedido : [],
      porBarrio: Array.isArray(metricsPayload?.porBarrio) ? metricsPayload.porBarrio : [],
      porZona: Array.isArray(metricsPayload?.porZona) ? metricsPayload.porZona : [],
      novedades: Array.isArray(metricsPayload?.novedades) ? metricsPayload.novedades : [],
      fechaDesde: metricsPayload?.fechaDesde || metricsFechaDesde,
      fechaHasta: metricsPayload?.fechaHasta || metricsFechaHasta,
      agruparPor: metricsPayload?.agruparPor || metricsGroupBy,
    };
  }, [metricsPayload, metricsFechaDesde, metricsFechaHasta, metricsGroupBy]);
  const deliveryMetricsChart = useMemo(() => {
    const historicalItems = deliveryMetrics.items
      .map((item, index) => {
        const total = metricNumber(item?.total);
        const label = formatMetricPeriodLabel(item, deliveryMetrics.agruparPor);
        const tooltipLabel = formatMetricPeriodLabel(item, deliveryMetrics.agruparPor, { tooltip: true });
        if (!label || total < 0) return null;
        return {
          ...item,
          chartKey: `${label}-${index}`,
          label,
          tooltipLabel,
          total,
        };
      })
      .filter(Boolean);
    const historicalTotal = historicalItems.reduce((acc, item) => acc + item.total, 0);
    const historicalAverage = historicalItems.length > 0 ? historicalTotal / historicalItems.length : 0;
    const historicalMax = historicalItems.reduce((acc, item) => Math.max(acc, item.total), 0);
    return {
      historicalItems,
      historicalTotal,
      historicalAverage,
      historicalMax,
      historicalMinWidth: Math.max(700, historicalItems.length * 58),
      historicalXAxisInterval: historicalItems.length > 12 ? Math.ceil(historicalItems.length / 12) - 1 : 0,
      topCouriers: deliveryMetrics.porDomiciliario.slice(0, 5),
      topBarrios: deliveryMetrics.porBarrio.slice(0, 5),
      topZonas: deliveryMetrics.porZona.slice(0, 5),
      topNovedades: deliveryMetrics.novedades.slice(0, 5),
    };
  }, [deliveryMetrics]);
  const deliveryNoveltyInsights = useMemo(() => {
    const rows = deliveryMetrics.novedades
      .map((item, index) => {
        const rawLabel = String(item?.novedad || item?.grupo || "").trim();
        const label = formatDeliveryNoveltyLabel(rawLabel) || "Sin novedad";
        const total = metricNumber(item?.total ?? item?.novedades);
        const noEntregados = metricNumber(item?.noEntregados ?? item?.no_entregados);
        const entregados = metricNumber(item?.entregados);
        return {
          key: `${label}-${index}`,
          label,
          rawLabel,
          total,
          noEntregados,
          entregados,
          rate: metricRatio(noEntregados, total),
          raw: item,
        };
      })
      .filter(item => {
        const normalizedLabel = normalizeSearchText(item.rawLabel);
        const hasRealNovelty = normalizedLabel && normalizedLabel !== "sin novedad" && normalizedLabel !== "sin novedades";
        return hasRealNovelty && (item.total > 0 || item.noEntregados > 0);
      })
      .sort((a, b) => b.total - a.total || b.noEntregados - a.noEntregados || a.label.localeCompare(b.label));

    const totalNovedades = rows.reduce((acc, item) => acc + item.total, 0);
    const totalNoEntregados = rows.reduce((acc, item) => acc + item.noEntregados, 0);
    const totalPedidos = metricNumber(deliveryMetrics.resumen.total);
    const top = rows[0] || null;

    return {
      rows,
      totalNovedades,
      totalNoEntregados,
      totalPedidos,
      tipos: rows.length,
      top,
      novedadesPercent: metricRatio(totalNovedades, totalPedidos),
      noEntregadosPercent: metricRatio(totalNoEntregados, totalNovedades),
    };
  }, [deliveryMetrics]);
  const deliveryNoveltyBoard = useMemo(() => {
    const searchTerm = normalizeSearchText(noveltySearch);
    const detailSource = [
      metricsPayload?.novedadesDetalle,
      metricsPayload?.detalleNovedades,
      metricsPayload?.pedidosConNovedad,
      metricsPayload?.pedidosNovedades,
      metricsPayload?.novedadesPedidos,
      metricsPayload?.novedadesPorPedido,
      adminItems,
    ].find(source => Array.isArray(source) && source.length > 0) || [];
    const allRows = detailSource
      .map((raw, index) => {
        const label = formatDeliveryNoveltyLabel(
          raw?.novedad
          || raw?.tipoNovedad
          || raw?.tipo_novedad
          || raw?.motivo
          || raw?.grupo
          || "Otra novedad"
        );
        const type = deliveryNoveltyTypeMeta(label);
        const noveltyStatusText = normalizeSearchText(
          raw?.estadoNovedad
          || raw?.estado_novedad
          || raw?.estado_novedad_nombre
          || raw?.estadoNovedadNombre
          || raw?.estadoResolucion
          || raw?.estado_resolucion
          || ""
        );
        const orderCode = String(raw?.pedido || raw?.numeroPedido || raw?.numero_pedido || raw?.pedidoNumero || raw?.codigoPedido || raw?.idPedido || raw?.idEntrega || "-").trim();
        const localResolutionKeys = [
          raw?.idNovedad,
          raw?.id_novedad,
          raw?.idEntrega,
          raw?.id_entrega,
          raw?.idPedido,
          raw?.id_pedido,
          orderCode,
        ].filter(value => value != null && String(value).trim()).map(value => String(value).trim());
        const noveltyResolved = raw?.novedadResuelta === true
          || raw?.resuelta === true
          || raw?.resuelto === true
          || raw?.fechaResolucion
          || raw?.fecha_resolucion
          || localResolutionKeys.some(key => resolvedNoveltyKeys.includes(key));
        const localResolutionObservation = localResolutionKeys
          .map(key => resolvedNoveltyObservations[key])
          .find(Boolean);
        const status = noveltyResolved || noveltyStatusText.includes("resuelt") || noveltyStatusText.includes("cerrad") || noveltyStatusText.includes("solucion")
          ? { label: "Resuelta", tone: "resolved" }
          : noveltyStatusText.includes("seguimiento")
            ? { label: "En seguimiento", tone: "tracking" }
            : { label: "Abierta", tone: "pending" };
        const client = String(raw?.cliente || raw?.nombreCliente || raw?.destinatario || raw?.nombreDestinatario || "Cliente sin nombre").trim();
        const phone = String(raw?.telefono || raw?.telefonoCliente || raw?.telefonoDestino || raw?.celular || "").trim();
        const courier = String(raw?.domiciliario || raw?.nombreDomiciliario || raw?.repartidor || "Sin asignar").trim();
        const observation = String(
          localResolutionObservation
          || raw?.observacionResolucion
          || raw?.observacion_resolucion
          || raw?.observacionesResolucion
          || raw?.observaciones_resolucion
          || raw?.observacionCierre
          || raw?.observacion_cierre
          || raw?.observacion
          || raw?.observaciones
          || raw?.detalle
          || raw?.nota
          || raw?.mensaje
          || "Sin observacion registrada."
        ).trim();
        const eventDate = raw?.fecha || raw?.fechaEntrega || raw?.fechaNovedad || raw?.fecha_novedad;
        const eventTime = raw?.hora || raw?.horaEntrega || formatTimeOnly(eventDate);
        const time = [formatDateOnly(eventDate), eventTime].filter(Boolean).join(" · ") || "-";
        const searchable = normalizeSearchText(`${orderCode} ${client} ${phone} ${courier} ${label} ${observation} ${status.label}`);
        const item = {
          ...raw,
          estado: raw?.estado || raw?.estadoEntrega || raw?.estado_entrega || raw?.estadoPedido || raw?.estado_pedido || status.label,
          estadoEntrega: raw?.estadoEntrega || raw?.estado_entrega || raw?.estado || status.label,
          estadoEntregaNombre: raw?.estadoEntregaNombre || raw?.estadoEntrega || raw?.estado_entrega || raw?.estado || status.label,
          cliente: raw?.cliente || raw?.nombreCliente || client,
          destinatario: raw?.destinatario || raw?.nombreDestinatario || client,
          telefonoDestino: raw?.telefonoDestino || raw?.telefono || raw?.telefonoCliente || phone,
          domiciliario: raw?.domiciliario || raw?.nombreDomiciliario || courier,
          fechaEntregaProgramada: raw?.fechaEntregaProgramada || raw?.fechaEntrega || raw?.fecha || raw?.fechaNovedad,
          horaEntrega: raw?.horaEntrega || raw?.hora || formatTimeOnly(eventDate),
        };
        return {
          key: raw?.idNovedad || raw?.idEntrega || raw?.idPedido || `${orderCode}-${label}-${index}`,
          item,
          raw,
          orderCode,
          client,
          phone,
          courier,
          label,
          typeKey: normalizeSearchText(label),
          type,
          status,
          observation,
          time,
          total: 1,
          noEntregados: status.tone === "resolved" ? 0 : 1,
          entregados: status.tone === "resolved" ? 1 : 0,
          rate: status.tone === "resolved" ? 0 : 100,
          searchable,
        };
      })
      .filter(item => (item.orderCode !== "-" || item.label) && isOpenDeliveryNovelty(item.raw) && item.status.tone !== "resolved");

    const filteredRows = allRows.filter(row => {
      if (searchTerm && !row.searchable.includes(searchTerm)) return false;
      if (noveltyTypeFilter !== "todas" && row.typeKey !== noveltyTypeFilter) return false;
      if (noveltyStatusFilter !== "todos" && noveltyStatusFilter !== "novedades" && row.status.tone !== noveltyStatusFilter) return false;
      return true;
    });

    const hasPedidoDetail = detailSource.length > 0;
    const statusCounts = hasPedidoDetail ? allRows.reduce(
      (acc, row) => {
        acc[row.status.tone] = (acc[row.status.tone] || 0) + row.total;
        return acc;
      },
      { pending: 0, tracking: 0, resolved: 0 }
    ) : {
      pending: deliveryNoveltyInsights.totalNoEntregados,
      tracking: 0,
      resolved: Math.max(deliveryNoveltyInsights.totalNovedades - deliveryNoveltyInsights.totalNoEntregados, 0),
    };
    const typeCounts = hasPedidoDetail
      ? Array.from(allRows.reduce((map, row) => {
        const current = map.get(row.typeKey) || {
          ...row.type,
          key: row.typeKey,
          label: row.label,
          count: 0,
        };
        current.count += row.total;
        map.set(row.typeKey, current);
        return map;
      }, new Map()).values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      : deliveryNoveltyInsights.rows.map(row => ({
        ...deliveryNoveltyTypeMeta(row.label),
        key: normalizeSearchText(row.label),
        label: row.label,
        count: row.total,
      }));
    const criticalSource = hasPedidoDetail ? allRows : deliveryNoveltyInsights.rows.map(row => ({
      ...row,
      type: deliveryNoveltyTypeMeta(row.label),
    }));

    return {
      rows: filteredRows,
      allRows,
      statusCounts,
      typeCounts,
      hasPedidoDetail,
      total: hasPedidoDetail ? allRows.length : deliveryNoveltyInsights.totalNovedades,
      critical: criticalSource
        .filter(row => ["cliente-no-responde", "direccion-incorrecta", "rechazo"].includes(row.type?.key))
        .reduce((acc, row) => acc + (row.total || 1), 0),
    };
  }, [adminItems, deliveryNoveltyInsights, metricsPayload, noveltySearch, noveltyStatusFilter, noveltyTypeFilter, resolvedNoveltyKeys, resolvedNoveltyObservations]);
  const deliveryMetricStates = useMemo(() => {
    const deliveryRows = [
      { key: "entregados", label: "Entregados", value: metricNumber(deliveryMetrics.resumen.entregados), tone: "is-success", Icon: CheckCircle2 },
      { key: "pendientes", label: "Pendientes", value: metricNumber(deliveryMetrics.resumen.pendientes), tone: "is-warning", Icon: Clock3 },
      { key: "en-ruta", label: "En ruta", value: metricNumber(deliveryMetrics.resumen.enRuta), tone: "is-info", Icon: Route },
      { key: "cancelados", label: "Cancelados", value: metricNumber(deliveryMetrics.resumen.cancelados), tone: "is-danger", Icon: AlertTriangle },
    ];
    const totalPedidos = deliveryRows.reduce((acc, item) => acc + item.value, 0);
    const rowsWithPercent = deliveryRows.map(item => {
      const percent = totalPedidos > 0 ? (item.value / totalPedidos) * 100 : 0;
      return {
        ...item,
        percent,
        percentLabel: formatMetricOneDecimal(percent),
      };
    });
    const adminRows = deliveryMetrics.porEstadoPedido
      .map((item, index) => {
        const label = String(item?.estadoPedido || item?.grupo || "Sin estado").trim();
        const normalized = normalizeSearchText(label);
        const value = metricNumber(item?.total);
        const priority = normalized.includes("aprob")
          ? 1
          : normalized.includes("cread")
            ? 2
            : normalized.includes("cancel")
              ? 3
              : 10 + index;
        const tone = normalized.includes("aprob")
          ? "is-success"
          : normalized.includes("cread")
            ? "is-info"
            : normalized.includes("cancel")
              ? "is-danger"
              : "is-neutral";
        const Icon = normalized.includes("aprob")
          ? CheckCircle2
          : normalized.includes("cread")
            ? Plus
            : normalized.includes("cancel")
              ? AlertTriangle
              : Truck;
        return {
          key: `${label}-${index}`,
          label,
          value,
          description: deliveryAdminStateDescription(label),
          tone,
          Icon,
          priority,
        };
      })
      .filter(item => item.label);
    adminRows.sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
    return {
      deliveryRows: rowsWithPercent,
      totalPedidos,
      pedidosPorAtender: metricNumber(deliveryMetrics.resumen.pendientes) + metricNumber(deliveryMetrics.resumen.enRuta),
      adminRows,
    };
  }, [deliveryMetrics]);
  const deliveryPerformance = useMemo(() => {
    const courierById = new Map();
    const courierByName = new Map();
    domiciliarios.forEach(item => {
      const id = courierIdValue(item);
      if (id != null) courierById.set(Number(id), item);
      const nameKey = normalizeSearchText(item?.nombre || item?.nombreDomiciliario || item?.nombre_domiciliario);
      if (nameKey) courierByName.set(nameKey, item);
    });
    const detailSources = [
      metricsPayload?.items,
      metricsPayload?.entregasDetalle,
      metricsPayload?.detalleEntregas,
      metricsPayload?.pedidosDetalle,
      metricsPayload?.detallePedidos,
      metricsPayload?.pedidos,
      metricsPayload?.entregas,
      metricsPayload?.domicilios,
      metricsPayload?.pedidosEntregados,
      metricsPayload?.entregasEntregadas,
    ].filter(Array.isArray);
    const detailRows = detailSources.flat();
    const metricDeliveredRows = detailRows
      .filter(item => {
        const status = normalizeStatus(
          item?.estadoEntrega
          || item?.estado_entrega
          || item?.estadoEntregaNombre
          || item?.estado_entrega_nombre
          || item?.estado
          || item?.estadoPedido
          || item?.estado_pedido
        );
        return status === "ENTREGADO" || item?.entregado === true || item?.entregada === true;
      })
      .map((item, index) => performanceDeliveredOrderFromItem(item, index));
    const deliveredByKey = new Map();
    metricDeliveredRows.forEach(item => {
      if (!item?.key) return;
      deliveredByKey.set(String(item.key), item);
    });
    const deliveredDetailRows = Array.from(deliveredByKey.values());
    const performanceEntries = deliveryMetrics.porDomiciliario
      .map((item, index) => {
        const rawId = performanceCourierIdValue(item);
        const rawNombre = String(item?.domiciliario || item?.grupo || item?.nombre || item?.nombreDomiciliario || "Sin domiciliario").trim();
        const matchedCourier = rawId != null
          ? courierById.get(Number(rawId))
          : courierByName.get(normalizeSearchText(rawNombre));
        const id = rawId ?? courierIdValue(matchedCourier);
        const courier = matchedCourier || (id != null ? courierById.get(Number(id)) : null);
        const nombre = String(rawNombre || courier?.nombre || courier?.nombreDomiciliario || "Sin domiciliario").trim();
        const photoUrl = courierPhotoUrl(courier) || courierPhotoUrl(item);
        const entregados = metricNumber(item?.entregados);
        const cancelados = metricNumber(item?.cancelados);
        const noEntregados = metricNumber(item?.noEntregados);
        const asignados = Math.max(metricNumber(item?.total || item?.asignados) - cancelados, 0);
        const finalizados = entregados + noEntregados;
        const tasaEntrega = asignados > 0 ? (entregados / asignados) * 100 : metricNumber(item?.tasaEntrega);
        const novedades = metricNumber(item?.novedades);
        const reasignados = metricNumber(item?.reasignados ?? item?.reasignaciones ?? item?.pedidosReasignados);
        const tiempoPromedio = Number(item?.tiempoPromedioEntregaMin);
        const safeTiempoPromedio = Number.isFinite(tiempoPromedio) && tiempoPromedio >= 0 ? tiempoPromedio : null;
        const pedidosGestionados = asignados > 0 ? asignados : finalizados;
        const tasaNovedades = metricRatio(novedades, pedidosGestionados);
        const tasaReasignacion = metricRatio(reasignados, asignados);
        const status = deliveryPerformanceStatus({ courier, row: item });
        const performanceCourier = { id, nombre };
        const deliveredOrders = deliveredDetailRows.filter(order => performanceOrderMatchesCourier(order, performanceCourier));
        return {
          key: `${id ?? nombre}-${index}`,
          id,
          internalId: id != null ? `DM-${id}` : courier ? courierIdLabel(courier, index) : "",
          nombre,
          initials: courierInitials(nombre),
          photoUrl,
          entregados,
          cancelados,
          noEntregados,
          asignados,
          finalizados,
          tasaEntrega,
          tasaEntregaLabel: formatMetricOneDecimal(tasaEntrega),
          novedades,
          tasaNovedades,
          tasaNovedadesLabel: formatMetricOneDecimal(tasaNovedades),
          reasignados,
          tasaReasignacion,
          tasaReasignacionLabel: formatMetricOneDecimal(tasaReasignacion),
          tiempoPromedio: safeTiempoPromedio,
          tiempoPromedioLabel: performanceDurationLabel(safeTiempoPromedio),
          pedidosActivos: metricNumber(courier?.pedidosActivos),
          deliveredOrders,
          status,
          raw: item,
        };
      })
      .filter(item => item.asignados > 0 || item.entregados > 0 || item.noEntregados > 0 || item.novedades > 0 || item.reasignados > 0);
    const isUnassignedPerformanceRow = item => item.id == null && normalizeSearchText(item.nombre).includes("sin domiciliario");
    const unassignedRows = performanceEntries.filter(isUnassignedPerformanceRow);
    const rows = performanceEntries.filter(item => !isUnassignedPerformanceRow(item));

    const sortedRows = [...rows].sort((a, b) => {
      const deliveredDiff = b.entregados - a.entregados;
      if (deliveredDiff !== 0) return deliveredDiff;
      if (performanceSort === "entregados") return b.tasaEntrega - a.tasaEntrega;
      if (performanceSort === "tiempoPromedio") {
        const aTime = Number.isFinite(a.tiempoPromedio) ? a.tiempoPromedio : Number.POSITIVE_INFINITY;
        const bTime = Number.isFinite(b.tiempoPromedio) ? b.tiempoPromedio : Number.POSITIVE_INFINITY;
        return aTime - bTime || b.tasaEntrega - a.tasaEntrega;
      }
      if (performanceSort === "menosNovedades") return a.tasaNovedades - b.tasaNovedades || b.tasaEntrega - a.tasaEntrega;
      if (performanceSort === "menosReasignaciones") return a.tasaReasignacion - b.tasaReasignacion || b.tasaEntrega - a.tasaEntrega;
      return b.tasaEntrega - a.tasaEntrega;
    });

    const totalAsignados = rows.reduce((acc, item) => acc + item.asignados, 0);
    const totalEntregados = rows.reduce((acc, item) => acc + item.entregados, 0);
    const totalNovedades = rows.reduce((acc, item) => acc + item.novedades, 0);
    const totalReasignados = rows.reduce((acc, item) => acc + item.reasignados, 0);
    const unassignedSummary = unassignedRows.reduce((acc, item) => ({
      asignados: acc.asignados + item.asignados,
      entregados: acc.entregados + item.entregados,
      noEntregados: acc.noEntregados + item.noEntregados,
      novedades: acc.novedades + item.novedades,
      reasignados: acc.reasignados + item.reasignados,
    }), {
      asignados: 0,
      entregados: 0,
      noEntregados: 0,
      novedades: 0,
      reasignados: 0,
    });
    unassignedSummary.asignados = performanceUnassignedCount;
    const validTimes = rows.map(item => item.tiempoPromedio).filter(value => Number.isFinite(value));
    const averageTime = validTimes.length > 0
      ? validTimes.reduce((acc, value) => acc + value, 0) / validTimes.length
      : null;

    return {
      rows: sortedRows,
      unassignedSummary,
      summary: {
        activos: rows.filter(item => item.asignados > 0 || item.entregados > 0).length,
        totalAsignados,
        totalEntregados,
        totalNovedades,
        totalReasignados,
        averageTime,
        entregaPercent: metricRatio(totalEntregados, totalAsignados),
        novedadesPercent: metricRatio(totalNovedades, totalAsignados),
        reasignadosPercent: metricRatio(totalReasignados, totalAsignados),
      },
    };
  }, [deliveryMetrics, domiciliarios, metricsPayload, performanceSort, performanceUnassignedCount]);
  const activeModeLabel = visibleDeliveryViews.find(item => item.value === modo)?.label || "Dispatch";

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="domicilios"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{
          pipeline: canViewPipeline,
          pedidos: canViewPedidos,
          produccion: canViewProduccion,
          domicilios: canViewDomicilios,
          barrios: canViewBarrios,
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          trazabilidad: canViewTrazabilidad,
          clientes: canViewClientesPanel,
          usuarios: canViewUsuariosPanel,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: onGoProduccion,
          domicilios: onGoDomicilios,
          barrios: onGoBarrios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
        badges={{ domicilios: visibleAdminItems.length }}
      />

      <main className="orders-admin-view orders-page-view delivery-page-view">
        {feedback ? (
          <div className="delivery-feedback-modal-backdrop" role="presentation">
            <article className="delivery-feedback-modal" role="status" aria-live="polite">
              <CheckCircle2 size={34} strokeWidth={2.4} />
              <strong>{feedback}</strong>
            </article>
          </div>
        ) : null}

        <header className="orders-admin-header orders-page-header delivery-page-header">
          <div className="orders-page-heading">
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>{"\u2630 Men\u00fa"}</button>
            <div className="orders-page-breadcrumb" aria-label="Ruta">
              <span>Operacion</span>
              <span>/</span>
              <strong>Domicilios</strong>
            </div>
            <div className="orders-page-title-row">
              <h1>Domicilios</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">Pedidos listos para entrega, toma segura y cierre con evidencia reutilizando el flujo actual.</p>
            <span className="orders-user-pill">
              <span aria-hidden="true" />
              Sesion activa: {displayUserName}
            </span>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
              <button type="button" className="btn-primary orders-header-refresh" onClick={refreshAll} disabled={loading || Boolean(actionKey)}>
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </header>

        <section className="inventory-header-tabs" aria-label="Submenu domicilios">
          {visibleDeliveryViews.map(item => (
            <button
              key={item.value}
              type="button"
              className={`btn-outline inventory-tab-btn ${modo === item.value ? "is-active" : ""}`}
              onClick={() => handleModeChange(item.value)}
              disabled={loading || Boolean(actionKey)}
            >
              {item.label}
            </button>
          ))}
        </section>

        {modo === "admin" ? (
          <>
            {error ? <p className="orders-message delivery-error">{error}</p> : null}
            {loading ? <p className="orders-message">Cargando domicilios...</p> : null}

            <section className="delivery-current-panel-title" aria-label="Panel actual">
              <h2>Mis pedidos</h2>
            </section>

            <section className="delivery-dispatch-controls">
              <label className="filter-field delivery-dispatch-search">
                <span>Buscar</span>
                <div className="delivery-dispatch-search-control">
                  <Search size={17} strokeWidth={2} />
                  <input
                    type="search"
                    value={deliverySearch}
                    onChange={event => setDeliverySearch(event.target.value)}
                    placeholder="Pedido, cliente, destinatario o direccion"
                    aria-label="Buscar domicilio por pedido, cliente, destinatario o direccion"
                  />
                </div>
              </label>
              <div className="filter-field">
                <span>Operacion</span>
                <strong>{activeModeLabel}</strong>
              </div>
              <div className="filter-field">
                <span>Filtro</span>
                <select
                  value={filtro}
                  onChange={event => {
                    setFiltro(event.target.value);
                    setStatusFilter("todos");
                  }}
                >
                  {FILTROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="filter-field">
                <span>Fecha</span>
                <input
                  type="date"
                  value={fechaFiltro}
                  onChange={event => setFechaFiltro(event.target.value)}
                />
              </div>
              {modo === "admin" && currentDomiciliarioId != null ? (
                <label className="delivery-dispatch-toggle">
                  <input
                    type="checkbox"
                    checked={soloMisAsignados}
                    onChange={event => onChangeSoloMisAsignados(event.target.checked)}
                  />
                  <span>Solo mis asignados</span>
                </label>
              ) : null}
              <div className={`delivery-signal ${isOffline ? "is-offline" : "is-online"}`}>
                {isOffline ? "Sin internet" : availableCoords ? "GPS activo" : "Operacion en linea"}
              </div>
            </section>

            <div className="orders-header-metrics delivery-header-metrics delivery-status-filters" aria-label="Filtros por estado de domicilios">
              {DELIVERY_STATUS_FILTERS.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`orders-header-metric-card delivery-status-filter is-${item.key} ${statusFilter === item.key ? "is-active" : ""}`}
                    onClick={() => setStatusFilter(item.key)}
                    aria-pressed={statusFilter === item.key}
                  >
                    <span className="orders-header-metric-icon" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>
                    <strong>{item.key === "todos" ? dispatchFilteredBaseItems.length : (dispatchKpis[item.key] || 0)}</strong>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <section className="delivery-dispatch-board">
              <aside className="delivery-dispatch-list-panel">
                <div className="delivery-active-summary">
                  <strong>{filteredDispatchItems.length} pedidos activos</strong>
                  <span>{DELIVERY_STATUS_FILTERS.find(item => item.key === statusFilter)?.label || availableSummary}</span>
                </div>

                <div className="delivery-dispatch-list">
                  {filteredDispatchItems.length === 0 ? (
                    <p className="orders-message">No hay domicilios para los filtros seleccionados.</p>
                  ) : filteredDispatchItems.map(item => {
                    const meta = deliveryStatusMeta(item);
                    const timeLate = isDeliveryTimeLate(item);
                    const selected = selectedDispatchItem?.idEntrega === item.idEntrega;
                    const address = deliveryAddressParts(item);
                    const payment = deliveryPaymentMeta(item);
                    const itemKey = deliveryItemKey(item);
                    const imageUrl = resolveDeliveryImageUrl(item, catalogProductIndex) || deliveryProductImages[itemKey] || "";
                    const arrangementName = deliveryArrangementName(item) || deliveryProductNames[itemKey] || "";
                    return (
                      <article
                        key={item.idEntrega || item.numeroPedido}
                        className={`delivery-dispatch-card is-${meta.tone}${timeLate ? " is-late" : ""}${selected ? " is-selected" : ""}`}
                        onClick={() => openDeliveryDetail(item)}
                      >
                        <div className="delivery-card-order">
                          <div className="delivery-card-topline">
                            <strong>#{deliveryOrderCodeLabel(item)}</strong>
                            {isSurpriseDelivery(item) ? <span className="delivery-urgent-pill">Es sorpresa</span> : null}
                          </div>
                          <strong className="delivery-card-product-name">{arrangementName || "Producto sin nombre"}</strong>
                          <span className="delivery-card-time"><Clock3 size={14} /> {deliveryDateTimeLabel(item)}</span>
                          <div className="delivery-product-thumb" aria-hidden="true">
                            {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <span />}
                          </div>
                        </div>

                        <div className="delivery-card-section delivery-card-client">
                          <span>Cliente</span>
                          <strong>{item.cliente || item.destinatario || "Cliente sin nombre"}</strong>
                          <p><Phone size={14} /> {deliveryPhone(item) || "Sin telefono"}</p>
                          {isSurpriseDelivery(item) ? <button type="button" className="delivery-soft-chip" onClick={event => event.stopPropagation()}>Es sorpresa</button> : null}
                        </div>

                        <div className="delivery-card-section delivery-card-recipient">
                          <span>Destinatario</span>
                          <strong>{item.destinatario || item.nombreDestinatario || item.recibe || "Sin destinatario"}</strong>
                          <p><Phone size={14} /> {item.telefonoDestino || item.telefonoDestinatario || item.telefonoRecibe || "Sin telefono"}</p>
                        </div>

                        <div className="delivery-card-section delivery-card-address-block">
                          <span>Direccion</span>
                          <strong>{address.primary}</strong>
                          <p>{address.secondary}</p>
                          <button type="button" className="delivery-soft-chip" onClick={event => { event.stopPropagation(); openMaps(item); }}>
                            <MapPin size={14} /> Mapa
                          </button>
                        </div>

                        <div className="delivery-card-section delivery-card-courier">
                          <span>Domiciliario</span>
                          <strong>{courierName(item)}</strong>
                          <span className={`delivery-payment-pill is-${payment.tone}`}>{payment.label}</span>
                        </div>

                        <div className="delivery-card-section delivery-card-state">
                          <span>Estado</span>
                          <span className={`delivery-status-pill is-${meta.tone}`}>{meta.label}</span>
                          {timeLate ? (
                            <>
                              <p>Retraso</p>
                              <strong className="delivery-time-left is-late">{deliveryRemainingLabel(item)}</strong>
                            </>
                          ) : null}
                        </div>

                        <div className="delivery-card-actions" onClick={event => event.stopPropagation()}>
                          <select
                            className="delivery-assign-select"
                            value=""
                            onChange={event => {
                              const nextDomiciliarioId = event.target.value;
                              if (!nextDomiciliarioId) return;
                              onAsignar(item, nextDomiciliarioId);
                            }}
                            disabled={actionKey === `asignar-${item.idEntrega}` || domiciliarios.length === 0}
                            aria-label={deliveryCourierIdValue(item) ? "Reasignar domiciliario" : "Asignar domiciliario"}
                          >
                            <option value="">
                              {actionKey === `asignar-${item.idEntrega}`
                                ? "Guardando..."
                                : deliveryCourierIdValue(item)
                                  ? "Reasignar"
                                  : "Asignar"}
                            </option>
                            {domiciliarios.map(dom => {
                              const domId = courierIdValue(dom);
                              if (domId == null) return null;
                              const activeCount = courierActiveOrders(dom, adminItems);
                              return (
                                <option key={domId} value={domId}>
                                  {dom.nombre || dom.nombreDomiciliario || "Domiciliario"} ({activeCount} activos)
                                </option>
                              );
                            })}
                          </select>
                          <div className="delivery-actions-menu">
                            <button
                              type="button"
                              className="delivery-actions-menu-trigger"
                              title="Mas opciones"
                              aria-label="Mas opciones"
                              aria-expanded={openDeliveryActionsKey === itemKey}
                              onClick={() => setOpenDeliveryActionsKey(current => current === itemKey ? "" : itemKey)}
                            >
                              <MoreVertical size={17} />
                            </button>
                            {openDeliveryActionsKey === itemKey ? (
                              <div className="orders-row-menu-panel delivery-actions-menu-panel">
                                <button type="button" className="orders-row-menu-item" onClick={() => { setOpenDeliveryActionsKey(""); setEvidenceModalItem(item); }}>
                                  <Eye size={15} /> Evidencias
                                </button>
                                <button type="button" className="orders-row-menu-item" onClick={() => { setOpenDeliveryActionsKey(""); setNoveltiesModalItem(item); }}>
                                  <MessageCircle size={15} /> Novedades
                                </button>
                                <button type="button" className="orders-row-menu-item" onClick={() => { setOpenDeliveryActionsKey(""); openStatusModal(item); }}>
                                  <Pencil size={15} /> Estados
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </aside>

            </section>
          </>
        ) : null}

        {false && modo !== "barrios" ? (
          <section className="orders-filters">
            <div className="filter-field">
              <span>Filtro</span>
              <select value={filtro} onChange={event => setFiltro(event.target.value)}>
                {FILTROS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="filter-field">
              <span>Fecha</span>
              <input type="date" value={fechaFiltro} onChange={event => setFechaFiltro(event.target.value)} />
            </div>
            <div className="filter-field">
              <span>Domiciliario</span>
              <select value={domiciliarioId} onChange={event => setDomiciliarioId(event.target.value)}>
                <option value="">Domiciliario...</option>
                {domiciliarios.map(item => {
                  const domId = courierIdValue(item);
                  if (domId == null) return null;
                  return <option key={domId} value={domId}>{item.nombre || item.nombreDomiciliario || "Domiciliario"}</option>;
                })}
              </select>
            </div>
            {modo === "admin" && currentDomiciliarioId != null ? (
              <div className="filter-field">
                <span>Asignación propia</span>
                <div className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={soloMisAsignados}
                    onChange={event => onChangeSoloMisAsignados(event.target.checked)}
                  />
                  <span>Solo mis pedidos asignados</span>
                </div>
              </div>
            ) : null}
            <div className="delivery-filter-hint">
              {isOffline ? "Sin internet" : modo === "admin" ? "Vista administrativa" : "Vista domiciliario"}
            </div>
          </section>
        ) : null}

        {(modo === "barrios" || modo === "crear-barrio") && error ? <p className="orders-message delivery-error">{error}</p> : null}
        {(modo === "barrios" || modo === "crear-barrio") && loading ? <p className="orders-message">Cargando domicilios...</p> : null}
        {modo === "domiciliarios" && error ? <p className="orders-message delivery-error">{error}</p> : null}
        {modo === "domiciliarios" && loading ? <p className="orders-message">Cargando domiciliarios...</p> : null}

        {modo === "domiciliarios" ? (
          <section className="delivery-couriers-view">
            <div className="delivery-couriers-toolbar">
              <label className="delivery-couriers-search">
                <Search size={17} strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={courierSearch}
                  onChange={event => setCourierSearch(event.target.value)}
                  placeholder="Buscar domiciliario..."
                />
              </label>
              <select
                className="delivery-couriers-status-select"
                value={courierStatusFilter}
                onChange={event => setCourierStatusFilter(event.target.value)}
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
              <button type="button" className="btn-primary delivery-new-courier-btn" onClick={() => setCourierCreateOpen(true)}>
                <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                Nuevo domiciliario
              </button>
            </div>

            {courierCreateOpen ? (
              <div className="delivery-modal-backdrop" role="presentation" onMouseDown={() => setCourierCreateOpen(false)}>
                <article
                  className="order-block delivery-courier-create delivery-courier-create-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="delivery-create-courier-title"
                  onMouseDown={event => event.stopPropagation()}
                >
                  <div className="delivery-section-head">
                    <h4 id="delivery-create-courier-title">Nuevo domiciliario</h4>
                    <div className="delivery-modal-head-actions">
                      <span>{courierDirectoryItems.length} registrados</span>
                      <button
                        type="button"
                        className="delivery-modal-close"
                        onClick={() => setCourierCreateOpen(false)}
                        aria-label="Cerrar formulario"
                      >
                        <X size={18} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                  <div className="delivery-courier-form">
                    <label className="order-detail-edit-label">
                      Nombre
                      <input
                        type="text"
                        value={courierForm.nombre}
                        onChange={event => setCourierForm(current => ({ ...current, nombre: event.target.value }))}
                        placeholder="Nombre del domiciliario"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Telefono
                      <input
                        type="tel"
                        value={courierForm.telefono}
                        onChange={event => setCourierForm(current => ({ ...current, telefono: event.target.value }))}
                        placeholder="Telefono"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Tipo
                      <select
                        value={courierForm.tipo}
                        onChange={event => setCourierForm(current => ({ ...current, tipo: event.target.value }))}
                      >
                        <option value="Interno">Interno</option>
                        <option value="Externo">Externo</option>
                      </select>
                    </label>
                    <label className="order-detail-edit-label">
                      Vehiculo
                      <select
                        value={courierForm.vehiculoTipo}
                        onChange={event => setCourierForm(current => ({ ...current, vehiculoTipo: event.target.value }))}
                      >
                        <option value="Moto">Moto</option>
                        <option value="Carro">Carro</option>
                        <option value="Bicicleta">Bicicleta</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </label>
                    <label className="order-detail-edit-label">
                      Placa
                      <input
                        type="text"
                        value={courierForm.vehiculoPlaca}
                        onChange={event => setCourierForm(current => ({ ...current, vehiculoPlaca: event.target.value }))}
                        placeholder="ABC123"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Detalle vehiculo
                      <input
                        type="text"
                        value={courierForm.vehiculoDetalle}
                        onChange={event => setCourierForm(current => ({ ...current, vehiculoDetalle: event.target.value }))}
                        placeholder="Yamaha 2022"
                      />
                    </label>
                    <label className="delivery-dispatch-toggle">
                      <input
                        type="checkbox"
                        checked={courierForm.activo}
                        onChange={event => setCourierForm(current => ({ ...current, activo: event.target.checked }))}
                      />
                      <span>Activo</span>
                    </label>
                    <button type="button" className="btn-primary" onClick={onCrearDomiciliario} disabled={courierSaving}>
                      {courierSaving ? "Creando..." : "Crear domiciliario"}
                    </button>
                  </div>
                </article>
              </div>
            ) : null}

            {viewingCourierItem ? (() => {
              const vehicle = courierVehicle(viewingCourierItem);
              const activeCount = Number.isFinite(Number(viewingCourierItem?.pedidosActivos))
                ? Number(viewingCourierItem.pedidosActivos)
                : courierActiveOrders(viewingCourierItem, adminItems);
              return (
                <div className="delivery-modal-backdrop" role="presentation" onMouseDown={() => setViewingCourierItem(null)}>
                  <article
                    className="order-block delivery-courier-create delivery-courier-view-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delivery-view-courier-title"
                    onMouseDown={event => event.stopPropagation()}
                  >
                    <div className="delivery-section-head">
                      <h4 id="delivery-view-courier-title">Detalle domiciliario</h4>
                      <div className="delivery-modal-head-actions">
                        <span>{courierIdLabel(viewingCourierItem, 0)}</span>
                        <button
                          type="button"
                          className="delivery-modal-close"
                          onClick={() => setViewingCourierItem(null)}
                          aria-label="Cerrar detalle"
                        >
                          <X size={18} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                    <div className="delivery-courier-profile">
                      <span className="delivery-courier-avatar delivery-courier-profile-avatar">
                        {String(viewingCourierItem.nombre || viewingCourierItem.nombreDomiciliario || "D").slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>{viewingCourierItem.nombre || viewingCourierItem.nombreDomiciliario || "Domiciliario"}</strong>
                        <span>{courierLogin(viewingCourierItem)}</span>
                      </div>
                    </div>
                    <div className="delivery-courier-detail-grid">
                      <p><span>Telefono</span><strong>{viewingCourierItem.telefono || viewingCourierItem.celular || viewingCourierItem.phone || "-"}</strong></p>
                      <p><span>Tipo</span><strong>{courierType(viewingCourierItem)}</strong></p>
                      <p><span>Estado</span><strong>{courierBackendStatus(viewingCourierItem)}</strong></p>
                      <p><span>Vehiculo</span><strong>{vehicle.type}</strong></p>
                      <p><span>Placa</span><strong>{vehicle.plate}</strong></p>
                      <p><span>Detalle</span><strong>{vehicle.detail || "-"}</strong></p>
                      <p><span>Pedidos activos</span><strong>{activeCount}</strong></p>
                      <p><span>Usuario ID</span><strong>{viewingCourierItem.usuarioID ?? "-"}</strong></p>
                    </div>
                    <div className="delivery-courier-modal-actions">
                      <button type="button" className="btn-outline" onClick={() => setViewingCourierItem(null)}>
                        Cerrar
                      </button>
                      <button type="button" className="btn-primary" onClick={() => onStartEditCourier(viewingCourierItem)}>
                        Editar domiciliario
                      </button>
                    </div>
                  </article>
                </div>
              );
            })() : null}

            {editingCourierId != null ? (
              <div className="delivery-modal-backdrop" role="presentation" onMouseDown={onCancelEditCourier}>
                <article
                  className="order-block delivery-courier-create delivery-courier-create-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="delivery-edit-courier-title"
                  onMouseDown={event => event.stopPropagation()}
                >
                  <div className="delivery-section-head">
                    <h4 id="delivery-edit-courier-title">Editar domiciliario</h4>
                    <div className="delivery-modal-head-actions">
                      <span>DM-{String(editingCourierId).padStart(3, "0")}</span>
                      <button
                        type="button"
                        className="delivery-modal-close"
                        onClick={onCancelEditCourier}
                        aria-label="Cerrar formulario"
                      >
                        <X size={18} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                  <div className="delivery-courier-form">
                    <label className="order-detail-edit-label">
                      Nombre
                      <input
                        type="text"
                        value={courierEditForm.nombre}
                        onChange={event => setCourierEditForm(current => ({ ...current, nombre: event.target.value }))}
                        placeholder="Nombre del domiciliario"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Telefono
                      <input
                        type="tel"
                        value={courierEditForm.telefono}
                        onChange={event => setCourierEditForm(current => ({ ...current, telefono: event.target.value }))}
                        placeholder="Telefono"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Tipo
                      <select
                        value={courierEditForm.tipo}
                        onChange={event => setCourierEditForm(current => ({ ...current, tipo: event.target.value }))}
                      >
                        <option value="Interno">Interno</option>
                        <option value="Externo">Externo</option>
                      </select>
                    </label>
                    <label className="order-detail-edit-label">
                      Vehiculo
                      <input
                        type="text"
                        value={courierEditForm.vehiculo}
                        onChange={event => setCourierEditForm(current => ({ ...current, vehiculo: event.target.value }))}
                        placeholder="Moto ABC123"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Estado
                      <select
                        value={courierEditForm.estado}
                        onChange={event => setCourierEditForm(current => ({
                          ...current,
                          estado: event.target.value,
                          activo: event.target.value === "Activo",
                        }))}
                      >
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="Eliminado">Eliminado</option>
                      </select>
                    </label>
                    <button type="button" className="btn-primary" onClick={() => onSaveEditCourier(editingCourierId)} disabled={courierSaving}>
                      {courierSaving ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button type="button" className="btn-outline" onClick={onCancelEditCourier} disabled={courierSaving}>
                      Cancelar
                    </button>
                  </div>
                </article>
              </div>
            ) : null}

            <article className="delivery-couriers-directory">
              <div className="delivery-couriers-table-scroll">
                <table className="delivery-couriers-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Domiciliario</th>
                      <th>Telefono</th>
                      <th>Tipo</th>
                      <th>Vehiculo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courierDirectoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No hay domiciliarios para los filtros seleccionados.</td>
                      </tr>
                    ) : courierDirectoryRows.map((item, index) => {
                      const vehicle = courierVehicle(item);
                      const domId = courierIdValue(item) ?? index;
                      const activeCount = Number.isFinite(Number(item?.pedidosActivos))
                        ? Number(item.pedidosActivos)
                        : courierActiveOrders(item, adminItems);
                      return (
                        <tr key={domId}>
                          <td data-label="ID">
                            <span className="delivery-courier-id">{courierIdLabel(item, index)}</span>
                          </td>
                          <td data-label="Domiciliario">
                            <div className="delivery-courier-person">
                              <span className="delivery-courier-avatar">{String(item.nombre || item.nombreDomiciliario || "D").slice(0, 1).toUpperCase()}</span>
                              <span>
                                <strong>{item.nombre || item.nombreDomiciliario || "Domiciliario"}</strong>
                                <small>{courierLogin(item)} · {activeCount} pedidos activos</small>
                              </span>
                            </div>
                          </td>
                          <td data-label="Telefono">
                            <span className="delivery-courier-phone">{item.telefono || item.celular || item.phone || "-"}</span>
                          </td>
                          <td data-label="Tipo">
                            <span className={`delivery-courier-type is-${courierType(item).toLowerCase()}`}>{courierType(item)}</span>
                          </td>
                          <td data-label="Vehiculo">
                            <div className="delivery-courier-vehicle">
                              <strong>{vehicle.type}</strong>
                              <span>{vehicle.plate}</span>
                              <small>{vehicle.detail || "-"}</small>
                            </div>
                          </td>
                          <td data-label="Estado">
                            <span className={`delivery-courier-status ${item.activo === false ? "is-inactive" : "is-active"}`}>
                              {courierBackendStatus(item)}
                            </span>
                          </td>
                          <td data-label="Acciones">
                            <div className="delivery-courier-action-buttons">
                              <button
                                type="button"
                                className="delivery-courier-action-button is-view"
                                title="Ver detalle"
                                aria-label="Ver detalle del domiciliario"
                                onClick={() => onViewCourier(item)}
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                className="delivery-courier-action-button is-edit"
                                title="Editar"
                                aria-label="Editar domiciliario"
                                onClick={() => onStartEditCourier(item)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="delivery-courier-action-button is-delete"
                                title="Eliminar"
                                aria-label="Eliminar domiciliario"
                                onClick={() => onDeleteCourier(item)}
                                disabled={courierSaving}
                              >
                                <AlertTriangle size={17} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : false ? (
          <section className="orders-table-wrap">
            <table className="orders-table delivery-admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Dirección</th>
                  <th>Barrio</th>
                  <th>Hora entrega</th>
                  <th>Domiciliario</th>
                  <th>Estado</th>
                  <th>Tiempo restante</th>
                  <th>Prioridad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleAdminItems.map(item => (
                  <tr key={item.idEntrega}>
                    <td data-label="Pedido">{deliveryOrderCodeLabel(item)}</td>
                    <td data-label="Cliente">{item.cliente || "-"}</td>
                    <td data-label="Dirección">{item.direccion || "-"}</td>
                    <td data-label="Barrio">{item.barrio || "-"}</td>
                    <td data-label="Hora entrega">{item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada) || "-"}</td>
                    <td data-label="Domiciliario">
                      <select
                        value={selectedDomiciliarioByEntrega[item.idEntrega] ?? (deliveryCourierIdValue(item) || "")}
                        onChange={event => setSelectedDomiciliarioByEntrega(current => ({ ...current, [item.idEntrega]: event.target.value }))}
                      >
                        <option value="">Sin asignar</option>
                        {domiciliarios.map(dom => {
                          const domId = courierIdValue(dom);
                          if (domId == null) return null;
                          const activeCount = courierActiveOrders(dom, adminItems);
                          return <option key={domId} value={domId}>{dom.nombre || dom.nombreDomiciliario || "Domiciliario"} ({activeCount} activos)</option>;
                        })}
                      </select>
                    </td>
                    <td data-label="Estado"><span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado}</span></td>
                    <td data-label="Tiempo restante">{isDeliveryTimeLate(item) ? deliveryRemainingLabel(item) : "-"}</td>
                    <td data-label="Prioridad"><span className={`order-badge ${priorityTone(item.prioridad)}`}>{item.prioridad || "MEDIA"}</span></td>
                    <td data-label="Acciones">
                      <div className="order-actions">
                        <button type="button" className="btn-outline" onClick={() => onAsignar(item)} disabled={actionKey === `asignar-${item.idEntrega}`}>
                          {actionKey === `asignar-${item.idEntrega}` ? "Asignando..." : "Asignar"}
                        </button>
                        <button type="button" className="btn-outline" onClick={() => onEnRuta(item)} disabled={actionKey === `enruta-${item.idEntrega}`}>
                          {actionKey === `enruta-${item.idEntrega}` ? "En proceso..." : "En camino"}
                        </button>
                        <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(item)}>Ver detalle</button>
                        <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Ver ubicación</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : modo === "novedades" ? (
          <section className="delivery-metrics-view delivery-novelties-view">
            {error ? <p className="orders-message delivery-error">{error}</p> : null}
            {loading ? <p className="orders-message">Cargando novedades...</p> : null}

            <section className="delivery-novelties-topbar" aria-label="Acciones de novedades">
              <div>
                <h2>Novedades de domicilios</h2>
                <span>Gestion por pedido, cliente y domiciliario</span>
              </div>
              <button type="button" className="btn-primary delivery-novelty-register-top">
                <Plus size={16} /> Registrar novedad
              </button>
            </section>

            <section className="delivery-novelties-summary" aria-label="Resumen de novedades">
              <article className="delivery-novelty-summary-card is-total">
                <span className="delivery-novelty-summary-icon"><AlertTriangle size={21} /></span>
                <div>
                  <span>Abiertas</span>
                  <strong>{deliveryNoveltyBoard.total}</strong>
                </div>
              </article>
              <article className="delivery-novelty-summary-card is-warning">
                <span className="delivery-novelty-summary-icon"><Clock3 size={21} /></span>
                <div>
                  <span>Sin resolver</span>
                  <strong>{deliveryNoveltyBoard.statusCounts.pending}</strong>
                </div>
              </article>
              <article className="delivery-novelty-summary-card is-resolved">
                <span className="delivery-novelty-summary-icon"><CheckCircle2 size={21} /></span>
                <div>
                  <span>Resueltas</span>
                  <strong>{deliveryNoveltyBoard.statusCounts.resolved}</strong>
                </div>
              </article>
              <article className="delivery-novelty-summary-card is-critical">
                <span className="delivery-novelty-summary-icon"><AlertTriangle size={21} /></span>
                <div>
                  <span>Criticas</span>
                  <strong>{deliveryNoveltyBoard.critical}</strong>
                </div>
              </article>
            </section>

            <section className="delivery-novelties-shell">
              <article className="delivery-novelties-main">
                <div className="delivery-novelties-tabs" role="tablist" aria-label="Estados de novedades">
                  {[
                    { key: "todos", label: "Todos" },
                    { key: "pending", label: "Sin resolver" },
                    { key: "tracking", label: "En seguimiento" },
                    { key: "resolved", label: "Resueltas" },
                    { key: "novedades", label: "Novedades" },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.key}
                      className={noveltyStatusFilter === item.key ? "is-active" : ""}
                      onClick={() => setNoveltyStatusFilter(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="delivery-novelties-filters">
                  <label className="delivery-novelties-search">
                    <Search size={16} />
                    <input
                      type="search"
                      value={noveltySearch}
                      onChange={event => setNoveltySearch(event.target.value)}
                      placeholder="Buscar pedido, cliente o novedad..."
                    />
                  </label>
                  <label>
                    <Clock3 size={15} />
                    <select
                      value={metricsRangePreset}
                      onChange={event => onChangeMetricsRangePreset(event.target.value)}
                    >
                      {DELIVERY_METRIC_RANGE_PRESETS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <MessageCircle size={15} />
                    <select value={noveltyTypeFilter} onChange={event => setNoveltyTypeFilter(event.target.value)}>
                      <option value="todas">Todas las novedades</option>
                      {deliveryNoveltyBoard.typeCounts.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <UserRound size={15} />
                    <select value={metricsDomiciliarioId} onChange={event => setMetricsDomiciliarioId(event.target.value)}>
                      <option value="">Todos los domiciliarios</option>
                      {domiciliarios.map(item => {
                        const domId = courierIdValue(item);
                        if (domId == null) return null;
                        return <option key={domId} value={domId}>{item.nombre || item.nombreDomiciliario || "Domiciliario"}</option>;
                      })}
                    </select>
                  </label>
                  <label>
                    <CheckCircle2 size={15} />
                    <select value={noveltyStatusFilter} onChange={event => setNoveltyStatusFilter(event.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="pending">Pendientes</option>
                      <option value="tracking">En seguimiento</option>
                      <option value="resolved">Resueltas</option>
                    </select>
                  </label>
                </div>

                <div className="delivery-novelties-list">
                  {deliveryNoveltyBoard.rows.length === 0 ? (
                    <p className="orders-message delivery-performance-empty">
                      {deliveryNoveltyBoard.hasPedidoDetail
                        ? "No hay novedades por pedido para los filtros seleccionados."
                        : "El endpoint de metricas no envio detalle por pedido para novedades."}
                    </p>
                  ) : deliveryNoveltyBoard.rows.map(row => {
                    const Icon = row.type.Icon;
                    return (
                      <article key={row.key} className={`delivery-novelty-row is-${row.status.tone === "resolved" ? "resolved" : row.type.tone}`}>
                        <div className="delivery-novelty-icon"><Icon size={19} /></div>
                        <div className="delivery-novelty-order">
                          <strong>{row.label}</strong>
                          <span>Pedido <b>{row.orderCode}</b></span>
                          <small><Clock3 size={12} /> {row.time}</small>
                        </div>
                        <div className="delivery-novelty-cell">
                          <span>Cliente</span>
                          <strong>{row.client}</strong>
                          <small><Phone size={12} /> {row.phone || "-"}</small>
                        </div>
                        <div className="delivery-novelty-cell">
                          <span>Domiciliario</span>
                          <strong>{row.courier}</strong>
                        </div>
                        <div className="delivery-novelty-cell delivery-novelty-observation">
                          <span>Observacion</span>
                          <strong>{row.observation}</strong>
                        </div>
                        <div className="delivery-novelty-actions">
                          <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(row.item)}>
                            <Eye size={14} /> Ver detalle
                          </button>
                          {row.status.tone === "resolved" ? (
                            <button type="button" className="btn-primary is-resolved">
                              <CheckCircle2 size={14} /> Resuelta
                            </button>
                          ) : (
                            <button type="button" className="btn-primary" onClick={() => onOpenResolveNovelty(row)}>
                              <CheckCircle2 size={14} /> Resolver
                            </button>
                          )}
                        </div>
                        <button type="button" className="delivery-novelty-more" aria-label="Mas acciones">
                          <MoreVertical size={17} />
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="delivery-novelties-footer">
                  <span>Mostrando {deliveryNoveltyBoard.rows.length === 0 ? 0 : 1} a {deliveryNoveltyBoard.rows.length} de {deliveryNoveltyBoard.allRows.length} novedades</span>
                  <div className="delivery-novelties-pagination">
                    <button type="button" className="btn-outline">{"<"}</button>
                    <button type="button" className="is-active">1</button>
                    <button type="button">2</button>
                    <button type="button">3</button>
                    <button type="button">{">"}</button>
                  </div>
                  <select aria-label="Novedades por pagina" defaultValue="5">
                    <option value="5">5 por pagina</option>
                    <option value="10">10 por pagina</option>
                  </select>
                </div>
              </article>

              <aside className="delivery-novelties-side">
                <article className="delivery-novelty-side-card">
                  <h4>Tipos de novedades</h4>
                  <div className="delivery-novelty-type-list">
                    {deliveryNoveltyBoard.typeCounts.map(item => {
                      const Icon = item.Icon;
                      return (
                        <button type="button" key={item.key} onClick={() => setNoveltyTypeFilter(item.key)}>
                          <span className={`is-${item.tone}`}><Icon size={14} /></span>
                          <strong>{item.label}</strong>
                          <b>{item.count}</b>
                        </button>
                      );
                    })}
                  </div>
                </article>

                <article className="delivery-novelty-side-card">
                  <h4>Registrar novedad</h4>
                  <label>
                    <span>Pedido *</span>
                    <select
                      value={noveltyDraft.pedidoId}
                      onChange={event => setNoveltyDraft(current => ({ ...current, pedidoId: event.target.value }))}
                    >
                      <option value="">Seleccionar pedido</option>
                      {adminItems.slice(0, 40).map(item => <option key={item.idEntrega} value={item.idEntrega}>{deliveryOrderCodeLabel(item)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Tipo de novedad *</span>
                    <select
                      value={noveltyDraft.tipo}
                      onChange={event => setNoveltyDraft(current => ({ ...current, tipo: event.target.value }))}
                    >
                      <option value="">Seleccionar tipo</option>
                      {DELIVERY_NOVELTY_TYPES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Observacion *</span>
                    <textarea
                      rows="4"
                      value={noveltyDraft.observacion}
                      onChange={event => setNoveltyDraft(current => ({ ...current, observacion: event.target.value }))}
                      placeholder="Describe la novedad..."
                    />
                  </label>
                  <label>
                    <span>Foto (opcional)</span>
                    <button type="button" className="delivery-novelty-upload">
                      <Plus size={16} /> Subir foto
                      <small>JPG, PNG max. 5MB</small>
                    </button>
                  </label>
                  <div className="delivery-novelty-form-actions">
                    <button type="button" className="btn-outline" onClick={() => setNoveltyDraft({ pedidoId: "", tipo: "", observacion: "" })}>Cancelar</button>
                    <button type="button" className="btn-primary" onClick={onSaveNoveltyDraft}>Guardar</button>
                  </div>
                </article>
              </aside>
            </section>
          </section>
        ) : modo === "metricas" ? (
          <section className="delivery-metrics-view">
            {error ? <p className="orders-message delivery-error">{error}</p> : null}
            {loading ? <p className="orders-message">Cargando métricas...</p> : null}

            <section className="delivery-current-panel-title" aria-label="Panel actual">
              <h2>Métricas de domicilios</h2>
            </section>

            <section className="delivery-metrics-toolbar">
              <label className="filter-field">
                <span>Rango de fechas</span>
                <select
                  value={metricsRangePreset}
                  onChange={event => onChangeMetricsRangePreset(event.target.value)}
                >
                  {DELIVERY_METRIC_RANGE_PRESETS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label className="filter-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={metricsFechaDesde}
                  onChange={event => {
                    setMetricsRangePreset("personalizado");
                    setMetricsFechaDesde(event.target.value);
                  }}
                />
              </label>
              <label className="filter-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={metricsFechaHasta}
                  onChange={event => {
                    setMetricsRangePreset("personalizado");
                    setMetricsFechaHasta(event.target.value);
                  }}
                />
              </label>
              <label className="filter-field">
                <span>Domiciliario</span>
                <select
                  value={metricsDomiciliarioId}
                  onChange={event => setMetricsDomiciliarioId(event.target.value)}
                >
                  <option value="">Todos</option>
                  {domiciliarios.map(item => {
                    const domId = courierIdValue(item);
                    if (domId == null) return null;
                    return <option key={domId} value={domId}>{item.nombre || item.nombreDomiciliario || "Domiciliario"}</option>;
                  })}
                </select>
              </label>
              <label className="filter-field">
                <span>Agrupar</span>
                <select
                  value={metricsGroupBy}
                  onChange={event => setMetricsGroupBy(event.target.value)}
                >
                  {DELIVERY_METRIC_GROUPS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <button type="button" className="btn-outline delivery-metrics-clear" onClick={onClearMetricsFilters}>
                Limpiar filtros
              </button>
            </section>

            <section className="order-block delivery-metrics-panel delivery-performance-panel">
              <div className="delivery-performance-head">
                <div>
                  <h4>Rendimiento de domiciliarios</h4>
                  <span>Comparativo del periodo seleccionado</span>
                </div>
                <label className="delivery-performance-sort">
                  <span>Ordenar por</span>
                  <select value={performanceSort} onChange={event => setPerformanceSort(event.target.value)}>
                    {DELIVERY_PERFORMANCE_SORTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>

              {loading ? (
                <div className="delivery-performance-skeleton" aria-label="Cargando rendimiento de domiciliarios">
                  <span />
                  <span />
                  <span />
                </div>
              ) : deliveryPerformance.rows.length === 0 && deliveryPerformance.unassignedSummary.asignados === 0 ? (
                <p className="orders-message delivery-performance-empty">No hay datos de domiciliarios para el periodo seleccionado.</p>
              ) : (
                <>
                  <div className="delivery-performance-summary" aria-label="Resumen de rendimiento de domiciliarios">
                    <p><span>Domiciliarios activos</span><strong>{deliveryPerformance.summary.activos}</strong></p>
                    <p><span>Entregas completadas</span><strong>{deliveryPerformance.summary.totalEntregados}</strong></p>
                    <p><span>Tiempo promedio</span><strong>{performanceDurationLabel(deliveryPerformance.summary.averageTime)}</strong></p>
                    <p><span>Novedades</span><strong>{deliveryPerformance.summary.totalNovedades}</strong></p>
                    <p><span>Reasignados</span><strong>{deliveryPerformance.summary.totalReasignados}</strong></p>
                    <p className="is-unassigned"><span>Pedidos sin asignacion</span><strong>{deliveryPerformance.unassignedSummary.asignados}</strong></p>
                  </div>

                  {deliveryPerformance.rows.length > 0 ? (
                  <div className="delivery-performance-table-wrap">
                    <table className="delivery-performance-table">
                      <thead>
                        <tr>
                          <th>Posición</th>
                          <th>Domiciliario</th>
                          <th>Entregados</th>
                          <th>Tasa de entrega</th>
                          <th>Tiempo promedio</th>
                          <th>Novedades</th>
                          <th>Reasignados</th>
                          <th>Estado</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryPerformance.rows.map((item, index) => (
                          <tr key={item.key}>
                            <td data-label="Posición"><strong className="delivery-performance-rank">#{index + 1}</strong></td>
                            <td data-label="Domiciliario">
                              <div className="delivery-performance-person">
                                <span aria-hidden="true">
                                  {item.photoUrl ? <img src={item.photoUrl} alt="" loading="lazy" /> : item.initials}
                                </span>
                                <div>
                                  <strong>{item.nombre}</strong>
                                </div>
                              </div>
                            </td>
                            <td data-label="Entregados">
                              <strong>{item.entregados}</strong>
                              <small>{item.entregados} de {item.asignados} asignados</small>
                            </td>
                            <td data-label="Tasa de entrega">
                              <div className="delivery-performance-rate">
                                <strong>{item.tasaEntregaLabel}</strong>
                                <span aria-hidden="true"><i style={{ width: `${Math.min(Math.max(item.tasaEntrega, 0), 100)}%` }} /></span>
                              </div>
                            </td>
                            <td data-label="Tiempo promedio"><strong>{item.tiempoPromedioLabel}</strong><small>por entrega</small></td>
                            <td data-label="Novedades"><strong>{item.novedades}</strong><small>{item.tasaNovedadesLabel}</small></td>
                            <td data-label="Reasignados"><strong>{item.reasignados}</strong><small>{item.tasaReasignacionLabel}</small></td>
                            <td data-label="Estado"><span className={`delivery-performance-status ${item.status.tone}`}>{item.status.label}</span></td>
                            <td data-label="Acción">
                              <button
                                type="button"
                                className="btn-outline delivery-performance-detail"
                                onClick={() => openPerformanceCourierDetail(item)}
                                aria-label={`Ver detalle de ${item.nombre}`}
                              >
                                Ver detalle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : null}

                  {deliveryPerformance.rows.length > 0 ? (
                  <div className="delivery-performance-cards" aria-label="Rendimiento de domiciliarios en tarjetas">
                    {deliveryPerformance.rows.map(item => (
                      <article key={`card-${item.key}`} className="delivery-performance-card">
                        <div className="delivery-performance-card-head">
                          <div className="delivery-performance-person">
                            <span aria-hidden="true">
                              {item.photoUrl ? <img src={item.photoUrl} alt="" loading="lazy" /> : item.initials}
                            </span>
                            <div>
                              <strong>{item.nombre}</strong>
                            </div>
                          </div>
                          <span className={`delivery-performance-status ${item.status.tone}`}>{item.status.label}</span>
                        </div>
                        <p><span>Entregados</span><strong>{item.entregados} de {item.asignados}</strong></p>
                        <p><span>Tasa de entrega</span><strong>{item.tasaEntregaLabel}</strong></p>
                        <p><span>Tiempo promedio</span><strong>{item.tiempoPromedioLabel}</strong></p>
                        <p><span>Novedades</span><strong>{item.novedades} · {item.reasignados} reasignados</strong></p>
                        <button
                          type="button"
                          className="btn-outline delivery-performance-detail"
                          onClick={() => openPerformanceCourierDetail(item)}
                          aria-label={`Ver detalle de ${item.nombre}`}
                        >
                          Ver detalle
                        </button>
                      </article>
                    ))}
                  </div>
                  ) : null}

                  <div className="delivery-performance-note">
                    <p><strong>Tasa de entrega:</strong> entregas completadas / pedidos asignados.</p>
                    <p><strong>Tiempo promedio:</strong> tiempo desde asignación hasta entrega.</p>
                    <p><strong>Novedades:</strong> pedidos con novedad / pedidos gestionados.</p>
                    <p><strong>Reasignados:</strong> pedidos reasignados / pedidos asignados.</p>
                  </div>
                </>
              )}
            </section>

            {selectedPerformanceCourier ? (
              <div className="delivery-modal-backdrop" role="presentation" onMouseDown={() => setSelectedPerformanceCourier(null)}>
                <article className="order-block delivery-performance-modal" role="dialog" aria-modal="true" aria-label={`Detalle de ${selectedPerformanceCourier.nombre}`} onMouseDown={event => event.stopPropagation()}>
                  <div className="delivery-section-head">
                    <h4>{selectedPerformanceCourier.nombre}</h4>
                    <button type="button" className="delivery-modal-close" onClick={() => setSelectedPerformanceCourier(null)} aria-label="Cerrar detalle">×</button>
                  </div>
                  <div className="delivery-performance-modal-profile">
                    <span aria-hidden="true">
                      {selectedPerformanceCourier.photoUrl ? <img src={selectedPerformanceCourier.photoUrl} alt="" loading="lazy" /> : selectedPerformanceCourier.initials}
                    </span>
                    <div>
                      <strong>{selectedPerformanceCourier.nombre}</strong>
                    </div>
                  </div>
                  <div className="delivery-courier-detail-grid">
                    <p><span>Total asignados</span><strong>{selectedPerformanceCourier.asignados}</strong></p>
                    <p><span>Entregados</span><strong>{selectedPerformanceCourier.entregados}</strong></p>
                    <p><span>No entregados</span><strong>{selectedPerformanceCourier.noEntregados}</strong></p>
                    <p><span>Tasa de entrega</span><strong>{selectedPerformanceCourier.tasaEntregaLabel}</strong></p>
                    <p><span>Tiempo promedio</span><strong>{selectedPerformanceCourier.tiempoPromedioLabel}</strong></p>
                    <p><span>Novedades</span><strong>{selectedPerformanceCourier.novedades}</strong></p>
                    <p><span>Reasignaciones</span><strong>{selectedPerformanceCourier.reasignados}</strong></p>
                    <p><span>Pedidos activos</span><strong>{selectedPerformanceCourier.pedidosActivos}</strong></p>
                  </div>
                  <section className="delivery-performance-orders" aria-label={`Pedidos entregados por ${selectedPerformanceCourier.nombre}`}>
                    <div className="delivery-performance-orders-head">
                      <h5>Pedidos entregados por domiciliario</h5>
                      <span>{performanceOrdersLoading ? "Cargando" : `${selectedPerformanceOrders.length} de ${selectedPerformanceCourier.deliveredOrders.length || selectedPerformanceCourier.entregados}`}</span>
                    </div>
                    <label className="delivery-performance-orders-search">
                      <Search size={15} aria-hidden="true" />
                      <input
                        type="search"
                        value={performanceOrderSearch}
                        onChange={event => setPerformanceOrderSearch(event.target.value)}
                        placeholder="Buscar pedido, cliente, telefono o direccion"
                      />
                    </label>
                    {performanceOrdersLoading ? (
                      <p className="delivery-performance-modal-note">Cargando pedidos entregados del domiciliario...</p>
                    ) : selectedPerformanceCourier.deliveredOrders.length === 0 ? (
                      <p className="delivery-performance-modal-note">No se recibio un listado filtrable de pedidos entregados para este domiciliario.</p>
                    ) : selectedPerformanceOrders.length === 0 ? (
                      <p className="delivery-performance-modal-note">No hay pedidos entregados que coincidan con la busqueda.</p>
                    ) : (
                      <div className="delivery-performance-orders-list">
                        {selectedPerformanceOrders.map(order => (
                          <article key={order.key} className="delivery-performance-order">
                            <div>
                              <strong>Pedido {order.orderCode}</strong>
                              <span>{order.client}</span>
                              <span>{[order.date, order.time].filter(Boolean).join(" - ") || "-"}</span>
                            </div>
                            <div>
                              {order.phone ? <span>{order.phone}</span> : null}
                              <span>{order.address || "Sin direccion registrada"}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </article>
              </div>
            ) : null}

            <section className="delivery-metrics-grid">
              <article className="order-block delivery-metrics-panel delivery-history-panel">
                <div className="delivery-history-head">
                  <div>
                    <h4>Histórico de pedidos</h4>
                    <span>Comportamiento del periodo seleccionado</span>
                  </div>
                  <strong>{metricGroupBadgeLabel(deliveryMetrics.agruparPor)}</strong>
                </div>
                {deliveryMetricsChart.historicalItems.length === 0 ? (
                  <p className="orders-message delivery-history-empty">No hay datos para el periodo seleccionado.</p>
                ) : (
                  <>
                    <div className="delivery-history-summary" aria-label="Resumen histórico">
                      <p><span>Total</span><strong>{deliveryMetricsChart.historicalTotal}</strong></p>
                      <p><span>Promedio</span><strong>{deliveryMetricsChart.historicalAverage.toFixed(1)}</strong></p>
                      <p><span>Máximo</span><strong>{deliveryMetricsChart.historicalMax}</strong></p>
                    </div>
                    <div className="delivery-history-chart-scroll">
                      <div
                        className="delivery-history-chart"
                        style={{ minWidth: `${deliveryMetricsChart.historicalMinWidth}px` }}
                      >
                        <ResponsiveContainer width="100%" height={310}>
                          <BarChart
                            data={deliveryMetricsChart.historicalItems}
                            margin={{ top: 14, right: 18, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid stroke="#eef2f7" vertical={false} />
                            <XAxis
                              dataKey="label"
                              interval={deliveryMetricsChart.historicalXAxisInterval}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }}
                            />
                            <YAxis
                              allowDecimals={false}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 800 }}
                              width={42}
                            />
                            <Tooltip cursor={{ fill: "rgba(233, 30, 114, 0.08)" }} content={<DeliveryHistoryTooltip />} />
                            <Bar dataKey="total" fill="#e91e72" radius={[8, 8, 0, 0]} maxBarSize={34} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </article>

              <article className="order-block delivery-metrics-panel delivery-state-panel">
                <div className="delivery-state-head">
                  <div>
                    <h4>Estados de entrega</h4>
                    <span>Resumen del periodo seleccionado</span>
                  </div>
                  <strong>4 estados</strong>
                </div>
                <div className="delivery-state-kpi-grid" aria-label="Indicadores de estados de entrega">
                  {deliveryMetricStates.deliveryRows.map(item => {
                    const Icon = item.Icon;
                    return (
                      <article key={item.key} className={`delivery-state-kpi ${item.tone}`}>
                        <span className="delivery-state-kpi-icon" aria-hidden="true"><Icon size={16} /></span>
                        <strong>{item.value}</strong>
                        <span>{item.label}</span>
                        <small>{item.percentLabel}</small>
                      </article>
                    );
                  })}
                  <article className="delivery-state-kpi is-brand">
                    <span className="delivery-state-kpi-icon" aria-hidden="true"><Truck size={16} /></span>
                    <strong>{deliveryMetricStates.totalPedidos}</strong>
                    <span>Total pedidos</span>
                    <small>Total del periodo</small>
                  </article>
                </div>
                <div className="delivery-state-distribution">
                  <div className="delivery-state-distribution-head">
                    <h5>Distribucion de estados</h5>
                    <span>100% del total de pedidos</span>
                  </div>
                  <div className="delivery-state-stack" aria-label="Distribucion porcentual de estados de entrega">
                    {deliveryMetricStates.deliveryRows.map(item => (
                      item.value > 0 ? (
                        <span
                          key={item.key}
                          className={item.tone}
                          style={{ flexBasis: `${item.percent}%` }}
                          title={`${item.label}: ${item.value} pedidos (${item.percentLabel})`}
                          aria-label={`${item.label}: ${item.value} pedidos, ${item.percentLabel}`}
                        />
                      ) : null
                    ))}
                    {deliveryMetricStates.totalPedidos === 0 ? <span className="is-empty" aria-label="Sin pedidos en el periodo" /> : null}
                  </div>
                  <div className="delivery-state-legend">
                    {deliveryMetricStates.deliveryRows.map(item => (
                      <p key={`legend-${item.key}`} className={item.tone}>
                        <i aria-hidden="true" />
                        <span>{item.label}</span>
                        <strong>{item.percentLabel}</strong>
                      </p>
                    ))}
                  </div>
                </div>
                <div className={`delivery-state-operational ${deliveryMetricStates.pedidosPorAtender > 0 ? "has-work" : "is-clear"}`}>
                  <p>{deliveryMetricStates.pedidosPorAtender > 0
                    ? `Hay ${deliveryMetricStates.pedidosPorAtender} pedidos por atender entre pendientes y en ruta.`
                    : "No hay pedidos pendientes por atender."}</p>
                  {deliveryMetricStates.pedidosPorAtender > 0 ? (
                    <button type="button" className="btn-outline" onClick={onViewPendingDeliveries} aria-label="Ver pedidos pendientes">
                      Ver pendientes
                    </button>
                  ) : null}
                </div>
              </article>
            </section>

          </section>
        ) : modo === "disponibles" ? (
          <>
            <section className="delivery-summary-grid">
              <article className="order-block delivery-summary-card">
                <strong>{availableSummary}</strong>
                <span>{availableCoords ? "Distancias ordenadas por ubicación actual" : "Activa ubicación para calcular distancias"}</span>
              </article>
              <article className="order-block delivery-summary-card">
                <strong>{availableCoords ? "Ubicación lista" : "Ubicación pendiente"}</strong>
                <span>{availableCoords ? `${availableCoords.lat.toFixed(4)}, ${availableCoords.lng.toFixed(4)}` : "Se solicitará al tomar o refrescar disponibles"}</span>
              </article>
            </section>

            <section className="delivery-courier-cards">
              {availableItems.length === 0 ? (
                <p className="orders-message">No hay pedidos disponibles con los filtros seleccionados.</p>
              ) : availableItems.map(item => (
                <article key={item.idEntrega || item.numeroPedido} className="delivery-courier-card">
                  <div className="delivery-courier-head">
                    <strong>Pedido #{deliveryOrderCodeLabel(item)}</strong>
                    <span className={`order-badge ${priorityTone(item.prioridad)}`}>{item.prioridad || "MEDIA"}</span>
                  </div>
                  <p className="delivery-address">{deliveryArrangementName(item) || "Arreglo sin nombre"}</p>

                  <p className="delivery-address">{item.direccion || "Sin dirección"}</p>
                  <p className="delivery-meta">
                    {item.barrio || "Barrio sin definir"}
                    {` · ${formatDistanceKm(getDistanceValue(item))}`}
                    {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                      ? ` · ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
                      : ""}
                  </p>

                  <div className="delivery-detail-list">
                    <p><span>Arreglo</span><strong>{deliveryArrangementName(item) || "-"}</strong></p>
                    <p><span>Cliente</span><strong>{item.cliente || item.destinatario || "-"}</strong></p>
                    <p><span>Estado</span><strong>{item.estado || "ParaEntrega"}</strong></p>
                  </div>

                  <div className="delivery-courier-actions">
                    <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(item)}>Ver detalle</button>
                    <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Abrir Maps</button>
                    <button type="button" className="btn-primary" onClick={() => onTomar(item)} disabled={actionKey === `tomar-${item.idEntrega}`}>
                      {actionKey === `tomar-${item.idEntrega}` ? "Tomando..." : "Tomar pedido"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : modo === "mis-pedidos" ? (
          <section className="delivery-sections">
            <article className="order-block">
              <div className="delivery-section-head">
                <h4>Asignados</h4>
                <span>{myOrdersGrouped.asignados.length}</span>
              </div>
              <div className="delivery-courier-cards">
                {myOrdersGrouped.asignados.length === 0 ? (
                  <p className="orders-message">No tienes pedidos asignados pendientes por iniciar.</p>
                ) : myOrdersGrouped.asignados.map(item => (
                  <article key={item.idEntrega} className="delivery-courier-card">
                    <div className="delivery-courier-head">
                      <strong>Pedido #{deliveryOrderCodeLabel(item)}</strong>
                      <span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado || "Asignado"}</span>
                    </div>
                    <p className="delivery-address">{deliveryArrangementName(item) || "Arreglo sin nombre"}</p>
                    <p className="delivery-address">{item.direccion || "Sin dirección"}</p>
                    <p className="delivery-meta">
                      {item.barrio || "Barrio sin definir"}
                      {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                        ? ` · ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
                        : ""}
                    </p>
                    <div className="delivery-courier-actions">
                      <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(item)}>Ver detalle</button>
                      <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Abrir Maps</button>
                      <button type="button" className="btn-primary" onClick={() => onEnRuta(item)} disabled={actionKey === `enruta-${item.idEntrega}`}>
                        {actionKey === `enruta-${item.idEntrega}` ? "Iniciando..." : "Iniciar entrega"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </article>

            <article className="order-block">
              <div className="delivery-section-head">
                <h4>En camino</h4>
                <span>{myOrdersGrouped.enRuta.length}</span>
              </div>
              <div className="delivery-courier-cards">
                {myOrdersGrouped.enRuta.length === 0 ? (
                  <p className="orders-message">No tienes pedidos en camino en este momento.</p>
                ) : myOrdersGrouped.enRuta.map(item => (
                  <article key={item.idEntrega} className="delivery-courier-card">
                    <div className="delivery-courier-head">
                      <strong>Pedido #{deliveryOrderCodeLabel(item)}</strong>
                      <span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado || "EnRuta"}</span>
                    </div>
                    <p className="delivery-address">{deliveryArrangementName(item) || "Arreglo sin nombre"}</p>
                    <p className="delivery-address">{item.direccion || "Sin dirección"}</p>
                    <p className="delivery-meta">
                      {item.barrio || "Barrio sin definir"}
                      {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                        ? ` · ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
                        : ""}
                    </p>
                    <div className="delivery-courier-actions">
                      <button type="button" className="btn-outline" onClick={() => openDeliveryDetail(item)}>Ver detalle</button>
                      <button type="button" className="btn-outline" onClick={() => openWhatsApp(item)}>Mensaje</button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {evidenceModalItem && evidenceModalSummary ? (
          <div className="delivery-modal-backdrop" role="presentation" onMouseDown={() => setEvidenceModalItem(null)}>
            <article className="delivery-evidence-modal" role="dialog" aria-modal="true" aria-label={`Evidencias del pedido ${evidenceModalSummary.order}`} onMouseDown={event => event.stopPropagation()}>
              <div className="delivery-evidence-modal-head">
                <div>
                  <span>Pedido #{evidenceModalSummary.order}</span>
                  <h4>Evidencias</h4>
                  <p>{evidenceModalSummary.arrangement}</p>
                </div>
                <button type="button" className="delivery-modal-close" onClick={() => setEvidenceModalItem(null)} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="delivery-evidence-summary">
                <p><span>Cliente</span><strong>{evidenceModalSummary.client}</strong></p>
                <p><span>Domiciliario</span><strong>{evidenceModalSummary.courier}</strong></p>
                <p><span>Estado</span><strong>{evidenceModalSummary.status}</strong></p>
                <p><span>Recibe</span><strong>{evidenceModalSummary.receivedBy || "-"}</strong></p>
                <p><span>Documento</span><strong>{evidenceModalSummary.receivedDocument || "-"}</strong></p>
                <p><span>Observaciones</span><strong>{evidenceModalSummary.observations || "-"}</strong></p>
              </div>

              <section className="delivery-evidence-section">
                <div className="delivery-evidence-section-title">
                  <h5>Evidencias</h5>
                  <span>{evidenceModalSummary.evidences.length}</span>
                </div>
                {evidenceModalSummary.evidences.length === 0 ? (
                  <p className="delivery-evidence-empty">No hay evidencias registradas para este pedido.</p>
                ) : (
                  <div className="delivery-evidence-list">
                    {evidenceModalSummary.evidences.map(record => (
                      <a key={record.key} className="delivery-evidence-item" href={record.url} target="_blank" rel="noreferrer">
                        <span className="delivery-evidence-thumb">
                          <img src={record.url} alt="" loading="lazy" />
                        </span>
                        <span>
                          <strong>{record.label}</strong>
                          <small>{record.date || "Sin fecha"}</small>
                          {record.note ? <em>{record.note}</em> : null}
                        </span>
                        <Eye size={16} />
                      </a>
                    ))}
                  </div>
                )}
              </section>

            </article>
          </div>
        ) : null}

        {noveltiesModalItem && noveltiesModalSummary ? (
          <div className="delivery-modal-backdrop" role="presentation" onMouseDown={() => setNoveltiesModalItem(null)}>
            <article className="delivery-evidence-modal" role="dialog" aria-modal="true" aria-label={`Novedades del pedido ${noveltiesModalSummary.order}`} onMouseDown={event => event.stopPropagation()}>
              <div className="delivery-evidence-modal-head">
                <div>
                  <span>Pedido #{noveltiesModalSummary.order}</span>
                  <h4>Novedades</h4>
                  <p>{noveltiesModalSummary.arrangement}</p>
                </div>
                <button type="button" className="delivery-modal-close" onClick={() => setNoveltiesModalItem(null)} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="delivery-evidence-summary">
                <p><span>Cliente</span><strong>{noveltiesModalSummary.client}</strong></p>
                <p><span>Domiciliario</span><strong>{noveltiesModalSummary.courier}</strong></p>
                <p><span>Estado</span><strong>{noveltiesModalSummary.status}</strong></p>
                <p><span>Recibe</span><strong>{noveltiesModalSummary.receivedBy || "-"}</strong></p>
                <p><span>Documento</span><strong>{noveltiesModalSummary.receivedDocument || "-"}</strong></p>
                <p><span>Observaciones</span><strong>{noveltiesModalSummary.observations || "-"}</strong></p>
              </div>

              <section className="delivery-evidence-section">
                <div className="delivery-evidence-section-title">
                  <h5>Novedades</h5>
                  <span>{noveltiesModalSummary.novelties.length}</span>
                </div>
                {noveltiesModalSummary.novelties.length === 0 ? (
                  <p className="delivery-evidence-empty">No hay novedades registradas para este pedido.</p>
                ) : (
                  <div className="delivery-novelty-mini-list">
                    {noveltiesModalSummary.novelties.map(record => (
                      <article key={record.key} className="delivery-novelty-mini-item">
                        <div>
                          <strong>{record.label}</strong>
                          <span>{record.status || "Sin estado"}</span>
                        </div>
                        <p>{record.observation}</p>
                        <small>{record.time || "Sin fecha"}</small>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </article>
          </div>
        ) : null}

        {statusModalItem && statusModalSummary ? (
          <div className="delivery-modal-backdrop" role="presentation" onMouseDown={closeStatusModal}>
            <article className="delivery-evidence-modal delivery-status-modal" role="dialog" aria-modal="true" aria-label={`Cambiar estado del pedido ${statusModalSummary.order}`} onMouseDown={event => event.stopPropagation()}>
              <div className="delivery-evidence-modal-head">
                <div>
                  <span>Pedido #{statusModalSummary.order}</span>
                  <h4>Estados</h4>
                  <p>{statusModalSummary.arrangement}</p>
                </div>
                <button type="button" className="delivery-modal-close" onClick={closeStatusModal} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="delivery-evidence-summary">
                <p><span>Cliente</span><strong>{statusModalSummary.client}</strong></p>
                <p><span>Domiciliario</span><strong>{statusModalSummary.courier}</strong></p>
                <p><span>Estado actual</span><strong>{statusModalSummary.status}</strong></p>
              </div>

              <div className="delivery-status-options" role="radiogroup" aria-label="Nuevo estado del pedido">
                {[
                  { key: "en-ruta", label: "En ruta", Icon: Route },
                  { key: "entregado", label: "Entregado", Icon: CheckCircle2 },
                  { key: "no-entregado", label: "No entregado", Icon: AlertTriangle },
                ].map(option => {
                  const Icon = option.Icon;
                  const active = statusForm.estado === option.key;
                  return (
                    <button
                      type="button"
                      key={option.key}
                      className={active ? "is-active" : ""}
                      onClick={() => setStatusForm(current => ({ ...current, estado: option.key }))}
                      aria-pressed={active}
                    >
                      <Icon size={17} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              {statusForm.estado === "entregado" ? (
                <div className="delivery-status-form">
                  <label>
                    <span>Nombre quien recibe</span>
                    <input
                      type="text"
                      value={statusForm.firmaNombre}
                      onChange={event => setStatusForm(current => ({ ...current, firmaNombre: event.target.value }))}
                      placeholder="Nombre completo"
                    />
                  </label>
                  <label>
                    <span>Documento quien recibe</span>
                    <input
                      type="text"
                      value={statusForm.firmaDocumento}
                      onChange={event => setStatusForm(current => ({ ...current, firmaDocumento: event.target.value }))}
                      placeholder="Documento"
                    />
                  </label>
                  <label>
                    <span>Evidencia de firma</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={event => setStatusForm(current => ({ ...current, firmaImagenFile: event.target.files?.[0] ?? null }))}
                    />
                  </label>
                  <label>
                    <span>Foto entrega</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={event => setStatusForm(current => ({ ...current, evidenciaFotoFile: event.target.files?.[0] ?? null }))}
                    />
                  </label>
                </div>
              ) : null}

              {statusForm.estado === "no-entregado" ? (
                <div className="delivery-status-form">
                  <label className="is-full">
                    <span>Motivo *</span>
                    <textarea
                      rows="3"
                      value={statusForm.motivo}
                      onChange={event => setStatusForm(current => ({ ...current, motivo: event.target.value }))}
                      placeholder="Describe por que no se pudo entregar"
                    />
                  </label>
                  <label className="is-full">
                    <span>Reprogramar para</span>
                    <input
                      type="datetime-local"
                      value={statusForm.reprogramarPara}
                      onChange={event => setStatusForm(current => ({ ...current, reprogramarPara: event.target.value }))}
                    />
                  </label>
                </div>
              ) : null}

              <label className="delivery-status-observation">
                <span>Observaciones</span>
                <textarea
                  rows="3"
                  value={statusForm.observaciones}
                  onChange={event => setStatusForm(current => ({ ...current, observaciones: event.target.value }))}
                  placeholder="Notas internas del cambio"
                />
              </label>

              <div className="delivery-novelty-resolve-actions">
                <button type="button" className="btn-outline" onClick={closeStatusModal}>Cancelar</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onSaveStatusChange}
                  disabled={actionKey === `estado-${statusModalItem.idEntrega}`}
                >
                  {actionKey === `estado-${statusModalItem.idEntrega}` ? "Guardando..." : "Guardar estado"}
                </button>
              </div>
            </article>
          </div>
        ) : null}

        {resolvingNoveltyRow ? (
          <div className="delivery-modal-backdrop" role="presentation" onMouseDown={onCloseResolveNovelty}>
            <article className="delivery-novelty-resolve-modal" role="dialog" aria-modal="true" aria-label="Resolver novedad" onMouseDown={event => event.stopPropagation()}>
              <div className="delivery-novelty-resolve-card">
                <div className="delivery-novelty-resolve-thumb">
                  {resolveDeliveryImageUrl(resolvingNoveltyRow.item, catalogProductIndex) || deliveryProductImages[deliveryItemKey(resolvingNoveltyRow.item)] ? (
                    <img src={resolveDeliveryImageUrl(resolvingNoveltyRow.item, catalogProductIndex) || deliveryProductImages[deliveryItemKey(resolvingNoveltyRow.item)]} alt="" />
                  ) : (
                    <Truck size={24} />
                  )}
                </div>
                <div>
                  <strong>#{resolvingNoveltyRow.orderCode}</strong>
                  <span>{resolvingNoveltyRow.label}</span>
                </div>
                <b>Abierta</b>
              </div>

              <div className="delivery-novelty-resolve-head">
                <h4>Que paso despues de la novedad</h4>
                <button type="button" className="delivery-modal-close" onClick={onCloseResolveNovelty} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="delivery-novelty-resolution-options" role="radiogroup" aria-label="Resultado de la novedad">
                {[
                  {
                    key: "entregar",
                    icon: CheckCircle2,
                    title: "Entregar pedido",
                    copy: "Cierra la novedad y marca el pedido como entregado.",
                  },
                  {
                    key: "reintentar",
                    icon: Route,
                    title: "Reintentar entrega",
                    copy: "El pedido vuelve a Mis pedidos para continuar la ruta.",
                  },
                  {
                    key: "disponibles",
                    icon: Truck,
                    title: "Devolver a disponibles",
                    copy: "El pedido vuelve a la bolsa de pedidos disponibles.",
                  },
                ].map(option => {
                  const Icon = option.icon;
                  const active = noveltyResolveForm.accion === option.key;
                  return (
                    <button
                      type="button"
                      key={option.key}
                      className={active ? "is-active" : ""}
                      onClick={() => {
                        setNoveltyResolveError("");
                        setNoveltyResolveForm(current => ({ ...current, accion: option.key }));
                      }}
                      aria-pressed={active}
                    >
                      <Icon size={18} />
                      <span>
                        <strong>{option.title}</strong>
                        <small>{option.copy}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="delivery-novelty-resolution-form">
                <label>
                  <span>Nombre de quien recibe (opcional)</span>
                  <input
                    type="text"
                    value={noveltyResolveForm.recibidoNombre}
                    onChange={event => setNoveltyResolveForm(current => ({ ...current, recibidoNombre: event.target.value }))}
                    placeholder="Nombre del recibido"
                  />
                </label>
                <label>
                  <span>Documento (opcional)</span>
                  <input
                    type="text"
                    value={noveltyResolveForm.recibidoDocumento}
                    onChange={event => setNoveltyResolveForm(current => ({ ...current, recibidoDocumento: event.target.value }))}
                    placeholder="Documento de quien recibe"
                  />
                </label>
                <label>
                  <span>Observaciones *</span>
                  <textarea
                    rows="4"
                    value={noveltyResolveForm.observacion}
                    onChange={event => setNoveltyResolveForm(current => ({ ...current, observacion: event.target.value }))}
                    placeholder="Notas internas"
                  />
                </label>
              </div>

              {noveltyResolveError ? <p className="delivery-novelty-resolve-error">{noveltyResolveError}</p> : null}

              <div className="delivery-novelty-resolve-actions">
                <button type="button" className="btn-outline" onClick={onCloseResolveNovelty}>Cancelar</button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onSaveResolveNovelty}
                  disabled={actionKey === `resolver-novedad-${resolvingNoveltyRow.item?.idEntrega || resolvingNoveltyRow.raw?.idEntrega}`}
                >
                  {actionKey === `resolver-novedad-${resolvingNoveltyRow.item?.idEntrega || resolvingNoveltyRow.raw?.idEntrega}` ? "Guardando..." : "Guardar resolucion"}
                </button>
              </div>
            </article>
          </div>
        ) : null}
      </main>

      <aside className={`orders-drawer ${deliveryDrawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>Detalle Domicilio</strong>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeDeliveryDetail} title="Cerrar barra lateral">×</button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!deliveryDrawerOpen || !selectedDeliveryItem ? (
            <p className="order-drawer-empty">Selecciona un pedido para ver detalle.</p>
          ) : (
            <>
              <section className="order-block">
                <h4>Detalle del pedido</h4>
                <div className="delivery-detail-list">
                  <p><span>Número del pedido</span><strong>{deliveryOrderCodeLabel(selectedDeliveryItem)}</strong></p>
                  <p><span>Arreglo</span><strong>{deliveryArrangementName(selectedDeliveryItem) || "-"}</strong></p>
                  <p><span>Cliente</span><strong>{selectedDeliveryItem.cliente || selectedDeliveryItem.destinatario || "-"}</strong></p>
                  <p><span>Destinatario</span><strong>{selectedDeliveryItem.destinatario || "-"}</strong></p>
                  <p><span>Dirección</span><strong>{selectedDeliveryItem.direccion || "-"}</strong></p>
                  <p><span>Barrio</span><strong>{selectedDeliveryItem.barrio || "-"}</strong></p>
                  <p><span>Fecha entrega</span><strong>{formatDateOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</strong></p>
                  <p><span>Hora entrega</span><strong>{selectedDeliveryItem.horaEntrega || formatTimeOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</strong></p>
                  <p><span>Estado</span><strong>{deliveryStatusMeta(selectedDeliveryItem).label || "-"}</strong></p>
                  <p><span>Domiciliario</span><strong>{selectedDeliveryItem.domiciliario || "-"}</strong></p>
                  <p><span>Teléfono</span><strong>{selectedDeliveryItem.telefonoDestino || "-"}</strong></p>
                  <p><span>Mensaje</span><strong>{selectedDeliveryItem.mensaje || "-"}</strong></p>
                  <p><span>Observaciones personalizados</span><strong>{selectedDeliveryItem.observacion || "-"}</strong></p>
                </div>

                <div className="delivery-courier-actions">
                  <button type="button" className="btn-outline" onClick={() => openMaps(selectedDeliveryItem)}>Abrir en Google Maps</button>
                  <button type="button" className="btn-outline" onClick={() => openWhatsApp(selectedDeliveryItem)}>WhatsApp</button>
                  {modo === "disponibles" ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onTomar(selectedDeliveryItem)}
                      disabled={actionKey === `tomar-${selectedDeliveryItem.idEntrega}`}
                    >
                      {actionKey === `tomar-${selectedDeliveryItem.idEntrega}` ? "Tomando..." : "Tomar pedido"}
                    </button>
                  ) : null}
                  {selectedDeliveryState === "ASIGNADO" ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onEnRuta(selectedDeliveryItem)}
                      disabled={actionKey === `enruta-${selectedDeliveryItem.idEntrega}`}
                    >
                      {actionKey === `enruta-${selectedDeliveryItem.idEntrega}` ? "Iniciando..." : "Iniciar entrega"}
                    </button>
                  ) : null}
                </div>
              </section>

              {modo === "admin" ? (
                <section className="order-block delivery-drawer-assignment">
                  <h4>{deliveryCourierIdValue(selectedDeliveryItem) ? "Reasignar domiciliario" : "Asignar domiciliario"}</h4>
                  <label className="order-detail-edit-label">
                    Domiciliario
                    <select
                      value={selectedDomiciliarioByEntrega[selectedDeliveryItem.idEntrega] ?? (deliveryCourierIdValue(selectedDeliveryItem) || "")}
                      onChange={event => setSelectedDomiciliarioByEntrega(current => ({
                        ...current,
                        [selectedDeliveryItem.idEntrega]: event.target.value,
                      }))}
                    >
                      <option value="">Sin asignar</option>
                      {domiciliarios.map(dom => {
                        const domId = courierIdValue(dom);
                        if (domId == null) return null;
                        const activeCount = courierActiveOrders(dom, adminItems);
                        return (
                          <option key={domId} value={domId}>
                            {dom.nombre || dom.nombreDomiciliario || "Domiciliario"} ({activeCount} activos)
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <div className="delivery-courier-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onAsignar(selectedDeliveryItem)}
                      disabled={actionKey === `asignar-${selectedDeliveryItem.idEntrega}`}
                    >
                      {actionKey === `asignar-${selectedDeliveryItem.idEntrega}`
                        ? "Guardando..."
                        : deliveryCourierIdValue(selectedDeliveryItem)
                          ? "Reasignar"
                          : "Asignar"}
                    </button>
                  </div>
                </section>
              ) : null}

              {(selectedDeliveryState === "ENRUTA" || selectedDeliveryState === "EN_CAMINO") ? (
                <>
                  <section className="order-block">
                    <h4>Confirmar entrega</h4>
                    <div className="delivery-form-grid">
                      <label className="order-detail-edit-label">
                        Nombre quien recibe
                        <input
                          type="text"
                          value={deliveryForm.firmaNombre}
                          onChange={event => setDeliveryForm(current => ({ ...current, firmaNombre: event.target.value }))}
                          placeholder="Nombre completo"
                        />
                      </label>
                      <label className="order-detail-edit-label">
                        Documento quien recibe
                        <input
                          type="text"
                          value={deliveryForm.firmaDocumento}
                          onChange={event => setDeliveryForm(current => ({ ...current, firmaDocumento: event.target.value }))}
                          placeholder="Documento"
                        />
                      </label>
                      <label className="order-detail-edit-label">
                        Evidencia de firma
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={event => setDeliveryForm(current => ({ ...current, firmaImagenFile: event.target.files?.[0] ?? null }))}
                        />
                      </label>
                      <label className="order-detail-edit-label">
                        Foto entrega (opcional)
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={event => setDeliveryForm(current => ({ ...current, evidenciaFotoFile: event.target.files?.[0] ?? null }))}
                        />
                      </label>
                      <label className="order-detail-edit-label delivery-form-grid--full">
                        Observaciones
                        <textarea
                          rows="3"
                          value={deliveryForm.observaciones}
                          onChange={event => setDeliveryForm(current => ({ ...current, observaciones: event.target.value }))}
                          placeholder="Detalle adicional de la entrega"
                        />
                      </label>
                    </div>
                    <div className="delivery-courier-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onEntregado(selectedDeliveryItem)}
                        disabled={actionKey === `entregar-${selectedDeliveryItem.idEntrega}`}
                      >
                        {actionKey === `entregar-${selectedDeliveryItem.idEntrega}` ? "Guardando..." : "Entregar pedido"}
                      </button>
                    </div>
                  </section>

                  <section className="order-block">
                    <h4>No entregado</h4>
                    <div className="delivery-form-grid">
                      <label className="order-detail-edit-label delivery-form-grid--full">
                        Motivo
                        <textarea
                          rows="3"
                          value={deliveryForm.noEntregadoMotivo}
                          onChange={event => setDeliveryForm(current => ({ ...current, noEntregadoMotivo: event.target.value }))}
                          placeholder="Describe por qué no se pudo entregar"
                        />
                      </label>
                      <label className="order-detail-edit-label">
                        Reprogramar para (opcional)
                        <input
                          type="datetime-local"
                          value={deliveryForm.reprogramarPara}
                          onChange={event => setDeliveryForm(current => ({ ...current, reprogramarPara: event.target.value }))}
                        />
                      </label>
                    </div>
                    <div className="delivery-courier-actions">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => onNoEntregado(selectedDeliveryItem)}
                        disabled={actionKey === `noentregado-${selectedDeliveryItem.idEntrega}`}
                      >
                        {actionKey === `noentregado-${selectedDeliveryItem.idEntrega}` ? "Guardando..." : "Marcar no entregado"}
                      </button>
                    </div>
                  </section>
                </>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
