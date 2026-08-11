import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatDateOnly, formatDateTimeCompact, normalizeStatus, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
import {
  IconCalendarPlus,
  IconX,
} from "@tabler/icons-react";
import {
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ClipboardList,
  Eye,
  FileText,
  Flower2,
  ListChecks,
  RotateCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
  User,
  UserX,
} from "lucide-react";

export const ESTADOS_UI = ["Pendiente", "EnProduccion", "ParaEntrega", "Cancelado"];
const ESTADOS_FILTRO_DEFAULT = ESTADOS_UI;
const ESTADOS_FLORISTA = ["Activo", "Inactivo", "Incapacidad"];
const ESTADOS_FLORISTA_BASICOS = ["Activo", "Inactivo"];
const DEFAULT_USER = "admin.demo";
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const LOOKER_STUDIO_URL = "https://lookerstudio.google.com/embed/reporting/d08a04af-ed8e-4dde-a83c-90888bfde39d/page/p_mp7qxa6dzd";
const SUBMENU_OPTIONS = [
  { key: "pedidos", label: "Pedidos" },
  { key: "disponibilidad", label: "Disponibilidad florista" },
  { key: "incapacidad", label: "Gestión incapacidad" },
  { key: "looker", label: "Looker" }
];

const PRODUCTION_SUBMENU_ICONS = {
  pedidos: ClipboardList,
  disponibilidad: Users,
  incapacidad: ShieldCheck,
  looker: BarChart3,
};

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  ENPRODUCCION: "is-produccion",
  PARAENTREGA: "is-entrega",
  ENTREGADO: "is-entregado",
  CANCELADO: "is-rechazado",
  RECHAZADO: "is-rechazado"
};
const COLOMBIA_UTC_OFFSET_MINUTES = -5 * 60;
const PRODUCTION_STATUS_CHIP_CLASS = {
  PENDIENTE: "is-pending",
  ENPRODUCCION: "is-production",
  PARAENTREGA: "is-delivery",
  CANCELADO: "is-cancelled",
};

function todayIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function productionHeaderDateLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date()).replace(".", "");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function initialsFromName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "SA";
  return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function toIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function resolveProgrammedDate(item) {
  return toIsoDate(item?.fechaProgramadaProduccion || item?.fechaEntrega);
}

function formatDateTimeBogotaFromUtc(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) return formatDateTimeCompact(value);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);
  const getPart = type => parts.find(part => part.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}`;
}

function normalizeDeliveryTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function deliveryTargetTimestamp(item) {
  const date = formatDateOnly(item?.fechaEntrega);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const fallbackTime = formatDateTimeCompact(item?.fechaEntrega).split(" ")[1];
  const time = normalizeDeliveryTime(item?.horaEntrega || fallbackTime);
  if (!time) return null;

  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(
    year,
    month - 1,
    day,
    time.hours,
    time.minutes - COLOMBIA_UTC_OFFSET_MINUTES,
    0,
    0
  );
}

function minutesUntilDelivery(item) {
  const targetTimestamp = deliveryTargetTimestamp(item);
  if (targetTimestamp == null || Number.isNaN(targetTimestamp)) return null;
  return Math.round((targetTimestamp - Date.now()) / 60000);
}

function formatDurationFromMinutes(totalMinutes) {
  if (typeof totalMinutes !== "number" || !Number.isFinite(totalMinutes)) return "-";
  const absMinutes = Math.abs(Math.round(totalMinutes));
  if (absMinutes < 60) return `${absMinutes} min`;
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function deliveryTimingStatus(item) {
  if (normalizeStatus(item?.estado).replace(/_/g, "") === "PARAENTREGA") {
    return { label: "Finalizado", className: "is-entrega", remainingLabel: "Finalizado" };
  }

  const remaining = minutesUntilDelivery(item);
  if (remaining == null) {
    return { label: "Sin hora", className: "is-neutral", remainingLabel: "-" };
  }
  if (remaining < 0) {
    return {
      label: `🔴 Retrasado ${formatDurationFromMinutes(remaining)}`,
      className: "is-late",
      remainingLabel: `Vencido hace ${formatDurationFromMinutes(remaining)}`,
    };
  }
  if (remaining <= 120) {
    return {
      label: "🟡 Próximo a vencer",
      className: "is-soon",
      remainingLabel: `Faltan ${formatDurationFromMinutes(remaining)}`,
    };
  }
  return {
    label: "🟢 A tiempo",
    className: "is-on-time",
    remainingLabel: `Faltan ${formatDurationFromMinutes(remaining)}`,
  };
}

function hasAssignedFlorista(item) {
  if (item?.floristaID != null && item?.floristaID !== "") return true;
  return String(item?.floristaAsignado || "").trim().length > 0;
}

function productionActionErrorMessage(error, fallback) {
  const detail = String(error?.detail || error?.message || "").trim();
  if (!detail) return fallback;
  const requestId = String(error?.requestId || "").trim();
  return requestId && !detail.includes(requestId) ? `${detail} (request_id ${requestId})` : detail;
}

function floristaNamesMatch(leftName, rightName) {
  const left = normalizeSearchText(leftName);
  const right = normalizeSearchText(rightName);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = right.split(/\s+/).filter(Boolean);
  const sharedTokens = rightTokens.filter(token => leftTokens.has(token));
  return sharedTokens.length >= 2;
}

function itemMatchesCurrentFlorista(item, currentFloristaId, currentFloristaName) {
  const itemFloristaId = item?.floristaID;
  if (currentFloristaId != null && itemFloristaId != null && itemFloristaId !== "") {
    return Number(itemFloristaId) === Number(currentFloristaId);
  }
  return floristaNamesMatch(item?.floristaAsignado, currentFloristaName);
}

function flattenPipelineCards(payload) {
  if (!payload || typeof payload !== "object") return [];
  const stages = ["creado", "aprobado", "pendiente_produccion", "en_produccion", "listo", "en_camino", "entregado", "cancelado"];
  return stages.flatMap(stage => (Array.isArray(payload?.[stage]) ? payload[stage] : []));
}

function extractListPayloadItems(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.items,
    payload?.pedidos,
    payload?.pedido,
    payload?.orders,
    payload?.rows,
    payload?.data,
    payload?.data?.items,
    payload?.data?.pedidos,
    payload?.data?.orders,
    payload?.result,
    payload?.result?.items,
    payload?.result?.pedidos,
    payload?.resultados,
  ];
  return candidates.find(Array.isArray) || [];
}

function extractOrderProducts(order) {
  const products = [
    order?.productosDetalle,
    order?.productos_detalle,
    order?.detalles,
    order?.detalle,
    order?.pedidoDetalles,
    order?.pedido_detalles,
    order?.detallesPedido,
    order?.detalles_pedido,
    order?.detalleProductos,
    order?.detalle_productos,
    order?.productos,
    order?.items,
  ].find(Array.isArray) || [];

  return products.length > 0 ? products : (order && typeof order === "object" ? [order] : []);
}

function productionSelectionKey(item) {
  const pedidoId = Number(item?.pedidoID || 0);
  if (pedidoId > 0) return `pedido-${pedidoId}`;
  return `produccion-${Number(item?.idProduccion || 0)}`;
}

export function productionItemMatchesSearch(item, searchValue) {
  const search = normalizeSearchText(searchValue);
  if (!search) return true;

  const searchableValues = [
    item?.floristaAsignado,
    item?.cliente,
    item?.numeroPedido,
    item?.numero_pedido,
    item?.nombreArreglo,
    item?.producto,
    item?.nombreProducto,
    item?.codigoArreglo,
    item?.codigo_arreglo,
    ...catalogCodeCandidates(item),
    ...productCodeCandidates(item),
  ];

  return searchableValues.some(value => normalizeSearchText(value).includes(search));
}

export function buildVisibleProductionItems(sourceItems, currentFloristaId, busquedaGeneral, soloMisAsignados, groupByPedido = true, currentFloristaName = "") {
  const search = normalizeSearchText(busquedaGeneral);
  const filtered = sourceItems.filter(item => {
    if (!search && soloMisAsignados && !itemMatchesCurrentFlorista(item, currentFloristaId, currentFloristaName)) {
      return false;
    }
    if (search && !productionItemMatchesSearch(item, search)) return false;
    return true;
  });

  if (!groupByPedido) {
    return [...filtered].sort((left, right) => {
      const numeroLeft = Number(left?.numeroPedido || 0);
      const numeroRight = Number(right?.numeroPedido || 0);
      if (numeroLeft !== numeroRight) return numeroLeft - numeroRight;
      return Number(left?.idProduccion || 0) - Number(right?.idProduccion || 0);
    });
  }

  const grouped = new Map();
  for (const item of filtered) {
    const key = String(item?.pedidoID || item?.idProduccion || "");
    if (!key) continue;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...item,
        produccionIds: [item.idProduccion],
        pedidoDetalleIds: item.pedidoDetalleID != null ? [item.pedidoDetalleID] : [],
        productosAgrupados: [item.nombreArreglo || item.producto].filter(Boolean),
        codigosAgrupados: productCodeCandidates(item),
        codigosCatalogoAgrupados: catalogCodeCandidates(item),
        cantidadProducciones: 1,
      });
      continue;
    }

    current.produccionIds.push(item.idProduccion);
    if (item.pedidoDetalleID != null) current.pedidoDetalleIds.push(item.pedidoDetalleID);
    if (item.nombreArreglo || item.producto) current.productosAgrupados.push(item.nombreArreglo || item.producto);
    current.cantidadProducciones += 1;
    if (!current.floristaID && item.floristaID) current.floristaID = item.floristaID;
    if (!current.floristaAsignado && item.floristaAsignado) current.floristaAsignado = item.floristaAsignado;
    if (!current.observacion && item.observacion) current.observacion = item.observacion;
    if (!current.notasProduccion && item.notasProduccion) current.notasProduccion = item.notasProduccion;
    if (!current.observacionesPersonalizados && item.observacionesPersonalizados) current.observacionesPersonalizados = item.observacionesPersonalizados;
    current.codigosAgrupados.push(...productCodeCandidates(item));
    current.codigosCatalogoAgrupados.push(...catalogCodeCandidates(item));
    if (!resolveProductImageUrl(current) && resolveProductImageUrl(item)) current.imageUrl = resolveProductImageUrl(item);
  }

  return Array.from(grouped.values()).map(item => {
    const productosUnicos = Array.from(new Set((item.productosAgrupados || []).filter(Boolean)));
    const codigosUnicos = Array.from(new Set((item.codigosAgrupados || []).filter(Boolean)));
    const codigosCatalogoUnicos = Array.from(new Set((item.codigosCatalogoAgrupados || []).filter(Boolean)));
    return {
      ...item,
      idProduccion: Number(item.produccionIds?.[0] || item.idProduccion),
      pedidoDetalleID: item.pedidoDetalleIds?.[0] ?? item.pedidoDetalleID ?? null,
      nombreArreglo: productosUnicos.join(" + "),
      producto: productosUnicos.join(" + "),
      codigoArreglo: codigosUnicos.join(" + "),
      codigoCatalogo: codigosCatalogoUnicos[0] || item.codigoCatalogo || item.codigo_catalogo || "",
      codigosCatalogo: codigosCatalogoUnicos,
      codigos: codigosUnicos,
    };
  }).sort((left, right) => {
    const numeroLeft = Number(left?.numeroPedido || 0);
    const numeroRight = Number(right?.numeroPedido || 0);
    if (numeroLeft !== numeroRight) return numeroLeft - numeroRight;
    return Number(left?.pedidoID || 0) - Number(right?.pedidoID || 0);
  });
}

function inferCurrentFloristaId(session, floristaItems) {
  const sessionUserId = Number(session?.userID || session?.usuarioID || session?.idUsuario || 0);
  const sessionLogin = normalizeSearchText(session?.login);
  const sessionEmail = normalizeSearchText(session?.email);
  const sessionName = normalizeSearchText(session?.nombre);

  const found = floristaItems.find(item => {
    const candidateUserId = Number(item?.usuarioID || item?.userID || item?.idUsuario || 0);
    if (sessionUserId > 0 && candidateUserId > 0 && candidateUserId === sessionUserId) return true;

    const candidateLogin = normalizeSearchText(item?.login || item?.usuario);
    if (sessionLogin && candidateLogin && candidateLogin === sessionLogin) return true;

    const candidateEmail = normalizeSearchText(item?.email);
    if (sessionEmail && candidateEmail && candidateEmail === sessionEmail) return true;

    const candidateName = normalizeSearchText(item?.nombre || item?.nombreFlorista || item?.nombre_empleado);
    return sessionName && candidateName && candidateName === sessionName;
  });

  return found?.idFlorista != null ? Number(found.idFlorista) : null;
}

function statusBadgeClass(status) {
  const key = normalizeStatus(status).replace(/_/g, "");
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

function isPendingOutsideToday(item) {
  const normalizedStatus = normalizeStatus(item?.estado).replace(/_/g, "");
  if (normalizedStatus !== "PENDIENTE") return false;
  const programmedDate = resolveProgrammedDate(item);
  return Boolean(programmedDate) && programmedDate !== todayIsoDate();
}

function isPendingOverdue(item) {
  const normalizedStatus = normalizeStatus(item?.estado).replace(/_/g, "");
  if (normalizedStatus !== "PENDIENTE") return false;
  const programmedDate = resolveProgrammedDate(item);
  if (!programmedDate) return false;
  return programmedDate < todayIsoDate();
}

function matchesProductionMetric(item, metricKey) {
  const normalizedStatus = normalizeStatus(item?.estado).replace(/_/g, "");
  if (metricKey === "pendientesHoy") return normalizedStatus === "PENDIENTE" && resolveProgrammedDate(item) === todayIsoDate();
  if (metricKey === "sinAsignar") return normalizedStatus === "PENDIENTE" && !hasAssignedFlorista(item);
  if (metricKey === "atrasados") return isPendingOverdue(item);
  if (metricKey === "pendientesFuturos") {
    const programmedDate = resolveProgrammedDate(item);
    return normalizedStatus === "PENDIENTE" && Boolean(programmedDate) && programmedDate > todayIsoDate();
  }
  return true;
}

function productionStatusBadgeClass(item) {
  const baseClass = statusBadgeClass(item?.estado);
  return isPendingOutsideToday(item) ? `${baseClass} is-pendiente-other-date` : baseClass;
}

function isCanceledProductionStatus(item) {
  return ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item?.estado));
}

function hasCanceledOrderStatus(item) {
  const candidates = [
    item?.estadoPedido,
    item?.estado_pedido,
    item?.pedidoEstado,
    item?.pedido_estado,
    item?.estadoPedidoCodigo,
    item?.estado_pedido_codigo,
    item?.codigoEstadoPedido,
    item?.codigo_estado_pedido,
    item?.pedido?.estado,
    item?.pedido?.estadoCodigo,
    item?.pedido?.estado_codigo,
  ];
  return candidates.some(value => ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(value)));
}

export function normalizeProductionItemStatus(item) {
  if (!item || typeof item !== "object") return item;
  if (!hasCanceledOrderStatus(item) && !isCanceledProductionStatus(item)) return item;
  return {
    ...item,
    estado: "Cancelado",
    estadoProduccionOriginal: item.estado,
  };
}

export function productionItemFromCanceledOrder(order) {
  if (!order || typeof order !== "object") return null;
  const pedidoID = order.pedidoID ?? order.pedidoId ?? order.idPedido ?? order.id_pedido ?? order.id;
  const numeroPedido = order.numeroPedido ?? order.numero_pedido ?? order.codigoPedido ?? order.codigo_pedido ?? pedidoID;
  const productSource = [
    order.productosDetalle,
    order.productos_detalle,
    order.detalles,
    order.detalleProductos,
    order.productos,
  ].find(Array.isArray)?.[0] || order;
  const productName = String(
    productSource?.nombreProducto ||
    productSource?.nombre_producto ||
    productSource?.nombreArreglo ||
    productSource?.nombre_arreglo ||
    productSource?.producto ||
    productSource?.nombre ||
    order.resumenProductos ||
    order.resumen_productos ||
    ""
  ).trim();
  const fechaEntrega = order.fechaEntrega || order.fecha_entrega || order.destinatario?.fechaEntrega || order.destinatario?.fecha_entrega || "";
  const horaEntrega = order.horaEntrega || order.hora_entrega || order.destinatario?.horaEntrega || order.destinatario?.hora_entrega || formatDateTimeCompact(fechaEntrega).split(" ")[1] || "";
  return normalizeProductionItemStatus({
    ...order,
    idProduccion: order.idProduccion ?? order.produccionID ?? pedidoID,
    pedidoID,
    numeroPedido,
    nombreArreglo: productName,
    producto: productName,
    codigoCatalogo: catalogCodeCandidates(productSource)[0] || catalogCodeCandidates(order)[0] || "",
    codigoProducto: productCodeCandidates(productSource)[0] || productCodeCandidates(order)[0] || "",
    cliente: order.cliente || order.clienteNombre || order.cliente_nombre || order.cliente?.nombreCompleto || order.cliente?.nombre || order.destinatario || order.destinatario?.nombre || "",
    fechaEntrega,
    horaEntrega,
    floristaID: order.floristaID ?? order.floristaId ?? null,
    floristaAsignado: order.floristaAsignado || order.florista_asignado || "",
    fechaAsignacion: order.fechaAsignacion || order.fecha_asignacion || "",
    estado: "Cancelado",
    estadoPedido: order.estado || order.estadoPedido || "Cancelado",
    imageUrl: resolveProductImageUrl(productSource) || resolveProductImageUrl(order),
  });
}

function mergeProductionItemsByOrder(items, extraItems) {
  const map = new Map();
  [...(Array.isArray(items) ? items : []), ...(Array.isArray(extraItems) ? extraItems : [])].forEach(item => {
    if (!item) return;
    const key = String(item?.pedidoID || item?.numeroPedido || item?.idProduccion || "");
    if (!key) return;
    map.set(key, item);
  });
  return Array.from(map.values());
}

export function shouldIncludeCanceledProduction(estadosFiltro) {
  return (Array.isArray(estadosFiltro) ? estadosFiltro : [])
    .some(estado => ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(estado)));
}

export function productionBackendStatusFilter(estadosFiltro) {
  const statuses = (Array.isArray(estadosFiltro) ? estadosFiltro : [])
    .map(status => String(status || "").trim())
    .filter(Boolean);
  if (statuses.length !== 1) return undefined;
  return statuses[0];
}

export function productionSelectedStatusKey(estadosFiltro) {
  const statuses = (Array.isArray(estadosFiltro) ? estadosFiltro : [])
    .map(status => String(status || "").trim())
    .filter(Boolean);
  if (statuses.length === ESTADOS_UI.length) return "todos";
  if (statuses.length === 1) return normalizeStatus(statuses[0]).replace(/_/g, "");
  return "custom";
}

function productionStatusChipClass(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  return PRODUCTION_STATUS_CHIP_CLASS[normalized] || "is-all";
}

export function nextFloristaStatus(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  if (normalized === "PENDIENTE") return "EnProduccion";
  if (normalized === "ENPRODUCCION") return "ParaEntrega";
  return null;
}

// Espeja las transiciones que el backend realmente permite
// (petalops.transicion_estado_produccion). El selector manual de "Cambiar
// estado" mostraba TODOS los estados menos el actual, incluyendo retrocesos
// invalidos (ej. ParaEntrega -> EnProduccion) que el backend rechaza con 400
// pero que confundian al usuario (parecia que el pedido "regresaba" de estado).
export function validNextStatesForManualChange(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  if (normalized === "PENDIENTE") return ["EnProduccion", "Cancelado"];
  if (normalized === "ENPRODUCCION") return ["ParaEntrega", "Cancelado"];
  return [];
}

function nextFloristaLabel(status) {
  const next = nextFloristaStatus(status);
  if (next === "EnProduccion") return "Iniciar producción";
  if (next === "ParaEntrega") return "Para entrega";
  return null;
}

export function shouldShowFloristaStateAction(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  return normalized === "PENDIENTE" || normalized === "ENPRODUCCION" || normalized === "PARAENTREGA";
}

export function isProductionReadyForDelivery(status) {
  return normalizeStatus(status).replace(/_/g, "") === "PARAENTREGA";
}

export function productionStateActionClass(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  if (normalized === "PENDIENTE") return "is-pendiente";
  if (normalized === "ENPRODUCCION") return "is-produccion";
  if (normalized === "PARAENTREGA") return "is-entrega";
  return "";
}

function arregloCodeLabel(item) {
  return item?.codigoCatalogo || item?.codigoArreglo || item?.codigoProducto || "-";
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function isFloristaActivo(item) {
  return String(item?.estado || "").trim().toLowerCase() === "activo" && Boolean(item?.activo);
}

function normalizeImageFieldKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function normalizeImageCandidate(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    if (!text || text === "[object Object]") return "";
    return text;
  }
  return "";
}

function looksLikeImageUrl(value) {
  const text = normalizeImageCandidate(value);
  if (!text) return false;
  return /^(https?:)?\/\//i.test(text)
    || /^(data|blob):/i.test(text)
    || text.startsWith("/")
    || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(text)
    || /(?:^|\/)(?:uploads|upload|media|images|imagenes|catalogo|productos|products)\//i.test(text);
}

function findNestedProductImageUrl(value, depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return "";
  seen.add(value);

  const imageKeys = new Set([
    "imagenurl",
    "imageurl",
    "image",
    "imagen",
    "imageurl",
    "fotourl",
    "urlfoto",
    "urlimagen",
    "productoimagen",
    "productoimagenurl",
    "imagenproducto",
    "imagenprincipal",
    "thumbnail",
    "thumbnailurl",
    "src",
  ]);

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);

  for (const [key, candidate] of entries) {
    const normalizedKey = normalizeImageFieldKey(key);
    if (!imageKeys.has(normalizedKey) && normalizedKey !== "url") continue;

    const directValue = normalizeImageCandidate(candidate);
    if (directValue && (normalizedKey !== "url" || looksLikeImageUrl(directValue))) return directValue;

    const nestedValue = findNestedProductImageUrl(candidate, depth + 1, seen);
    if (nestedValue) return nestedValue;
  }

  for (const [, candidate] of entries) {
    const nestedValue = findNestedProductImageUrl(candidate, depth + 1, seen);
    if (nestedValue) return nestedValue;
  }

  return "";
}

function resolveProductImageUrl(value) {
  if (!value || typeof value !== "object") return "";
  const candidates = [
    value.imagen_url,
    value.imagenUrl,
    value.imagen,
    value.imageUrl,
    value.imageurl,
    value.image_url,
    value.fotoUrl,
    value.foto_url,
    value.urlImagen,
    value.url_imagen,
    value.productoImagenUrl,
    value.productoImagen,
    value.producto_imagen,
    value.producto_imagen_url,
    value.imagenProducto,
    value.imagen_producto,
    value.imagenPrincipal,
    value.imagen_principal,
    value.url_foto,
    value.urlFoto,
    value.fotoProducto,
    value.foto_producto,
    value.thumbnail,
    value.thumbnailUrl,
    value.thumbnail_url,
    value.img,
    value.src,
    value.foto,
    value.url,
    value.archivo?.url,
    value.media?.url,
    value.imagenes?.[0]?.url,
    value.imagenes?.[0]?.imagenUrl,
    value.imagenes?.[0]?.imagen_url,
    value.images?.[0]?.url,
    value.images?.[0]?.imageUrl,
    value.images?.[0]?.imageurl,
    value.images?.[0]?.image_url,
    value.producto?.imagenUrl,
    value.producto?.imageUrl,
    value.producto?.imageurl,
    value.producto?.imagen_url,
    value.producto?.image_url,
  ];
  const direct = candidates.map(normalizeImageCandidate).find(Boolean);
  return direct || findNestedProductImageUrl(value);
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

function isEmpresaCatalogCode(empresaId) {
  return Number(empresaId) === 3;
}

function shouldUseCatalogCodeForProduction() {
  return false;
}

function normalizeCodeCandidates(candidates) {
  return Array.from(new Set(candidates
    .map(candidate => String(candidate || "").trim())
    .filter(Boolean)));
}

export function catalogCodeCandidates(value) {
  if (!value || typeof value !== "object") return [];
  const explicitCandidates = [
    value.codigoCatalogo,
    value.codigo_catalogo,
    value.catalogCode,
    value.codigo_catalogo_producto,
    value.producto?.codigoCatalogo,
    value.producto?.codigo_catalogo,
    value.producto?.catalogCode,
  ];
  const explicitCodes = normalizeCodeCandidates(explicitCandidates);
  if (explicitCodes.length > 0) return explicitCodes;

  const fallbackCandidates = [
    value.codigoArreglo,
    value.codigo_arreglo,
    value.producto?.codigoArreglo,
    value.producto?.codigo_arreglo,
    value.codigo,
    value.code,
    value.sku,
    value.producto?.codigo,
    value.producto?.sku,
  ];

  if (Array.isArray(value.codigosCatalogo)) fallbackCandidates.push(...value.codigosCatalogo);
  if (Array.isArray(value.codigos_catalogo)) fallbackCandidates.push(...value.codigos_catalogo);
  if (Array.isArray(value.codigoCatalogos)) fallbackCandidates.push(...value.codigoCatalogos);
  if (Array.isArray(value.catalogCodes)) fallbackCandidates.push(...value.catalogCodes);

  return normalizeCodeCandidates(fallbackCandidates);
}

export function productCodeCandidates(value) {
  if (!value || typeof value !== "object") return [];
  const candidates = [
    value.codigoProducto,
    value.codigo_producto,
    value.productoCodigo,
    value.producto_codigo,
    value.producto?.codigoProducto,
    value.producto?.codigo_producto,
    value.codigoArreglo,
    value.codigo_arreglo,
    value.producto?.codigoArreglo,
    value.producto?.codigo_arreglo,
    value.codigo,
    value.code,
    value.sku,
    value.referencia,
    value.ref,
    value.producto?.codigo,
    value.producto?.sku,
  ];

  if (Array.isArray(value.codigos)) candidates.push(...value.codigos);
  if (Array.isArray(value.codigoProductos)) candidates.push(...value.codigoProductos);
  if (Array.isArray(value.codigosProducto)) candidates.push(...value.codigosProducto);

  return normalizeCodeCandidates(candidates);
}

function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  const codigos = Array.from(new Set(productCodeCandidates(raw)));
  const explicitCatalogCodes = catalogCodeCandidates(raw);
  const codigosCatalogo = explicitCatalogCodes.length > 0
    ? Array.from(new Set(explicitCatalogCodes))
    : codigos;
  const codigo = codigos[0] || "";
  const nombre = String(raw?.nombreProducto || raw?.nombre_producto || raw?.nombreArreglo || raw?.nombre_arreglo || raw?.nombre || raw?.descripcion || raw?.titulo || "").trim();
  const imageUrl = resolveProductImageUrl(raw);
  if (id == null && !codigo && !nombre) return null;
  return { id, codigo, codigos, codigosCatalogo, nombre, imageUrl };
}

function extractCatalogRows(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.productos)) return payload.productos;
  if (Array.isArray(payload?.catalogo)) return payload.catalogo;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.productos)) return payload.data.productos;
  if (Array.isArray(payload?.data?.catalogo)) return payload.data.catalogo;
  if (Array.isArray(payload?.result?.items)) return payload.result.items;
  if (Array.isArray(payload?.result?.productos)) return payload.result.productos;
  if (Array.isArray(payload?.resultados)) return payload.resultados;
  if (Array.isArray(payload)) return payload;
  return [];
}

function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item) continue;
    const key = item.id != null
      ? `id:${item.id}`
      : item.codigo
        ? `code:${productLookupKey(item.codigo)}`
        : `name:${productLookupKey(item.nombre)}:${item.imageUrl || ""}`;
    map.set(key, item);
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

function productNamesCompatible(left, right) {
  const leftKey = productLookupKey(firstProductToken(left));
  const rightKey = productLookupKey(firstProductToken(right));
  return Boolean(leftKey && rightKey && (leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey)));
}

function catalogIndexEntries(catalogIndex, key) {
  const value = catalogIndex.get(key);
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function addCatalogIndexEntry(index, key, item) {
  if (!key || !item?.imageUrl) return;
  const current = index.get(key);
  if (!current) {
    index.set(key, [item]);
    return;
  }
  const next = Array.isArray(current) ? current : [current];
  if (!next.some(candidate => candidate === item || (candidate.id != null && item.id != null && Number(candidate.id) === Number(item.id)))) {
    next.push(item);
  }
  index.set(key, next);
}

function findCatalogMatchByName(catalogIndex, name) {
  const nameKey = productLookupKey(name);
  const firstNameKey = productLookupKey(firstProductToken(name));
  return [
    ...catalogIndexEntries(catalogIndex, `name:${nameKey}`),
    ...catalogIndexEntries(catalogIndex, `name:${firstNameKey}`),
  ].find(product => product?.imageUrl && productNamesCompatible(name, product.nombre));
}

function findCatalogMatchByCodes(catalogIndex, codes, keyPrefix, name = "") {
  const codeKeys = Array.from(new Set(codes.flatMap(candidate => [candidate, firstProductToken(candidate)]).map(productLookupKey).filter(Boolean)));
  const matches = codeKeys.flatMap(codeKey => catalogIndexEntries(catalogIndex, `${keyPrefix}:${codeKey}`));
  if (!matches.length) return null;
  if (name) {
    const compatible = matches.find(product => product?.imageUrl && productNamesCompatible(name, product.nombre));
    if (compatible) return compatible;
    const exactName = findCatalogMatchByName(catalogIndex, name);
    if (exactName) return exactName;
  }
  return matches.find(product => product?.imageUrl) || null;
}

function buildCatalogProductIndex(items) {
  const index = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.imageUrl) continue;
    if (item.id != null) addCatalogIndexEntry(index, `id:${item.id}`, item);
    const codeKeys = Array.from(new Set([item.codigo, ...(Array.isArray(item.codigos) ? item.codigos : [])].map(productLookupKey).filter(Boolean)));
    const catalogCodeKeys = Array.from(new Set((Array.isArray(item.codigosCatalogo) ? item.codigosCatalogo : []).map(productLookupKey).filter(Boolean)));
    const nameKey = productLookupKey(item.nombre);
    for (const codeKey of codeKeys) addCatalogIndexEntry(index, `code:${codeKey}`, item);
    for (const catalogCodeKey of catalogCodeKeys) addCatalogIndexEntry(index, `catalog-code:${catalogCodeKey}`, item);
    if (nameKey) addCatalogIndexEntry(index, `name:${nameKey}`, item);
  }
  return index;
}

function firstProductToken(value) {
  return String(value || "").split(/\s+\+\s+|,\s*/).map(part => part.trim()).find(Boolean) || "";
}

function catalogQueriesFromItems(items, preferCatalogCode = false) {
  const queries = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const product = String(item?.nombreArreglo || item?.producto || "").trim();
    const firstProduct = firstProductToken(product);
    const codes = preferCatalogCode ? catalogCodeCandidates(item) : productCodeCandidates(item);
    const firstCodes = codes.map(firstProductToken);
    const values = preferCatalogCode ? [...codes, ...firstCodes, product, firstProduct] : [...codes, ...firstCodes, product, firstProduct];
    values.forEach(value => {
      const query = String(value || "").trim();
      if (query && query.length > 1) queries.add(query);
    });
  }
  return Array.from(queries).slice(0, 16);
}

// Cuantos items de produccion se resuelven en paralelo como maximo. Cada item puede
// disparar varias llamadas al backend (catalogo, pedido, pipeline); resolverlos todos
// a la vez (antes hasta 20) saturaba la instancia de Cloud Run en rafagas de trafico.
const IMAGE_RESOLUTION_CONCURRENCY = 3;

async function mapWithConcurrencyLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        results[currentIndex] = { status: "fulfilled", value: await mapper(items[currentIndex], currentIndex) };
      } catch (error) {
        results[currentIndex] = { status: "rejected", reason: error };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function resolveCatalogImageByProductionCode(api, empresaId, sucursalId, item, catalogIndex = new Map()) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId);
  const queries = catalogQueriesFromItems([item], preferCatalogCode).slice(0, 6);
  const sourceNameKey = productLookupKey(firstProductToken(item?.nombreArreglo || item?.producto || item?.nombreProducto || item?.nombre || ""));
  for (const query of queries) {
    const lookupKey = productLookupKey(query);
    const indexedProduct = preferCatalogCode
      ? findCatalogMatchByCodes(catalogIndex, [query], "catalog-code", sourceNameKey)
      : findCatalogMatchByCodes(catalogIndex, [query], "code", sourceNameKey) || findCatalogMatchByName(catalogIndex, query);
    if (indexedProduct?.imageUrl) return indexedProduct.imageUrl;

    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q: query });
      const products = extractCatalogRows(payload)
        .map(raw => normalizeCatalogItem(raw))
        .filter(Boolean);
      const exactCodeMatches = products.filter(product => {
        const codesToMatch = preferCatalogCode
          ? product.codigosCatalogo
          : [product.codigo, ...(Array.isArray(product.codigos) ? product.codigos : [])];
        const codeMatches = (Array.isArray(codesToMatch) ? codesToMatch : [])
          .some(code => productLookupKey(code) === lookupKey);
        const nameMatches = !preferCatalogCode && productLookupKey(product.nombre) === lookupKey;
        return (codeMatches || nameMatches) && product.imageUrl;
      });
      const exactMatch = exactCodeMatches.find(product => {
        const productNameKey = productLookupKey(firstProductToken(product.nombre));
        return sourceNameKey && productNameKey && (sourceNameKey === productNameKey || sourceNameKey.includes(productNameKey) || productNameKey.includes(sourceNameKey));
      }) || exactCodeMatches[0];
      const withImage = exactMatch || (!preferCatalogCode ? products.find(product => product.imageUrl) : null);
      if (withImage?.imageUrl) return withImage.imageUrl;
    } catch (catalogError) {
      console.warn("No fue posible resolver imagen desde catálogo por código:", catalogError);
    }
  }
  return "";
}

function resolveImageSrc(imageUrl, apiBaseUrl) {
  const value = String(imageUrl || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
  const base = String(apiBaseUrl || "").replace(/\/+$/, "");
  if (!base || base === "/api") return `${base}${value.startsWith("/") ? value : `/${value}`}`;
  return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

export function resolveProductionProduct(item, catalogIndex = new Map(), options = {}) {
  const preferCatalogCode = Boolean(options.preferCatalogCode);
  const allowDirectImage = options.allowDirectImage !== false;
  const name = String(item?.nombreArreglo || item?.producto || item?.nombreProducto || item?.nombre || "").trim();
  const codes = preferCatalogCode ? catalogCodeCandidates(item) : productCodeCandidates(item);
  const code = codes[0] || "";
  const directImageUrl = resolveProductImageUrl(item);
  const productId = getProductoId(item);
  const byId = productId != null
    ? catalogIndexEntries(catalogIndex, `id:${productId}`).find(product => product?.imageUrl)
    : null;
  const byName = findCatalogMatchByName(catalogIndex, name);
  const byCatalogCode = findCatalogMatchByCodes(catalogIndex, catalogCodeCandidates(item), "catalog-code", name);
  const byProductCode = findCatalogMatchByCodes(catalogIndex, productCodeCandidates(item), "code", name);
  const catalogProduct = byId || byName || (preferCatalogCode ? byCatalogCode || byProductCode : byProductCode || byCatalogCode);
  const imageUrl = catalogProduct?.imageUrl || (allowDirectImage ? directImageUrl : "");

  return {
    name: name || catalogProduct?.nombre || "",
    code: code || catalogProduct?.codigo || "",
    imageUrl,
  };
}

function productionProductMatches(sourceItem, product, options = {}) {
  if (!sourceItem || !product) return false;
  const sourceDetailId = String(sourceItem?.pedidoDetalleID || sourceItem?.pedidoDetalleId || sourceItem?.detalleID || sourceItem?.detalleId || "").trim();
  const productDetailId = String(product?.pedidoDetalleID || product?.pedidoDetalleId || product?.detalleID || product?.detalleId || product?.idDetalle || product?.id_detalle || "").trim();
  if (sourceDetailId && productDetailId && sourceDetailId === productDetailId) return true;

  if (options.preferCatalogCode) {
    const sourceCatalogCodes = catalogCodeCandidates(sourceItem).map(productLookupKey).filter(Boolean);
    const productCatalogCodes = catalogCodeCandidates(product).map(productLookupKey).filter(Boolean);
    if (sourceCatalogCodes.length > 0) {
      return sourceCatalogCodes.some(sourceCode => productCatalogCodes.includes(sourceCode));
    }
  }

  const sourceProductId = getProductoId(sourceItem);
  const productId = getProductoId(product);
  if (sourceProductId != null && productId != null && Number(sourceProductId) === Number(productId)) return true;

  const sourceCodes = productCodeCandidates(sourceItem).map(productLookupKey).filter(Boolean);
  const productCodes = productCodeCandidates(product).map(productLookupKey).filter(Boolean);
  if (sourceCodes.some(sourceCode => productCodes.some(productCode => sourceCode === productCode || sourceCode.includes(productCode) || productCode.includes(sourceCode)))) return true;

  const sourceName = productLookupKey(firstProductToken(sourceItem?.nombreArreglo || sourceItem?.producto || ""));
  const productName = productLookupKey(product?.nombreArreglo || product?.nombreProducto || product?.producto || product?.nombre || product?.descripcion || "");
  return Boolean(sourceName && productName && (sourceName === productName || sourceName.includes(productName) || productName.includes(sourceName)));
}

function productionItemKey(item) {
  return String(item?.idProduccion || item?.pedidoDetalleID || item?.pedidoID || item?.numeroPedido || "").trim();
}

function productionPedidoId(item) {
  const candidates = [item?.pedidoID, item?.pedidoId, item?.pedido_id, item?.idPedido, item?.id_pedido];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function pipelinePedidoId(payload, sourceItem) {
  const cards = flattenPipelineCards(payload);
  const sourceOrder = String(sourceItem?.numeroPedido || sourceItem?.numero_pedido || "").trim();
  const matchingCard = cards.find(card => {
    const cardOrder = String(card?.numeroPedido || card?.numero_pedido || card?.numero_pedido_display || "").trim();
    if (sourceOrder && cardOrder && cardOrder !== sourceOrder) return false;
    return productionProductMatches(sourceItem, card) || !sourceOrder || cardOrder === sourceOrder;
  });
  const candidates = [
    matchingCard?.id_pedido,
    matchingCard?.idPedido,
    matchingCard?.pedidoID,
    matchingCard?.pedidoId,
    matchingCard?.pedido_id,
  ];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function resolveDetailProductionImageUrl(detail, catalogIndex = new Map(), sourceItem = null, empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId ?? sourceItem?.empresaID ?? sourceItem?.empresaId ?? sourceItem?.empresa_id);
  const products = Array.isArray(detail?.productos) ? detail.productos : [];
  const orderedProducts = sourceItem
    ? [
      ...products.filter(product => productionProductMatches(sourceItem, product, { preferCatalogCode })),
      ...products.filter(product => !productionProductMatches(sourceItem, product, { preferCatalogCode })),
    ]
    : products;
  for (const product of orderedProducts) {
    const imageUrl = resolveProductionProduct(product, catalogIndex, { preferCatalogCode, allowDirectImage: false }).imageUrl;
    if (imageUrl) return imageUrl;
  }
  const detailImageUrl = resolveProductImageUrl(detail);
  if (!preferCatalogCode && detailImageUrl) return detailImageUrl;
  return "";
}

export function resolvePipelineProductionImageUrl(payload, sourceItem, catalogIndex = new Map(), empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId ?? sourceItem?.empresaID ?? sourceItem?.empresaId ?? sourceItem?.empresa_id);
  const cards = flattenPipelineCards(payload);
  const sourceOrder = String(sourceItem?.numeroPedido || sourceItem?.numero_pedido || "").trim();
  const matchingCards = cards.filter(card => {
    const cardOrder = String(card?.numeroPedido || card?.numero_pedido || card?.pedidoID || "").trim();
    return !sourceOrder || cardOrder === sourceOrder;
  });
  const orderedCards = [
    ...matchingCards.filter(card => productionProductMatches(sourceItem, card, { preferCatalogCode })),
    ...matchingCards.filter(card => !productionProductMatches(sourceItem, card, { preferCatalogCode })),
  ];
  for (const card of orderedCards) {
    const imageUrl = resolveProductionProduct(card, catalogIndex, { preferCatalogCode, allowDirectImage: false }).imageUrl;
    if (imageUrl) return imageUrl;
  }
  return "";
}

export async function resolvePedidoListProductionImageUrl(api, empresaId, sucursalId, sourceItem, catalogIndex = new Map()) {
  const numeroPedido = String(sourceItem?.numeroPedido || sourceItem?.numero_pedido || "").trim();
  if (!numeroPedido) return "";

  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId ?? sourceItem?.empresaID ?? sourceItem?.empresaId ?? sourceItem?.empresa_id);
  const payload = await api.listarPedidos({
    empresaId,
    sucursalId,
    q: numeroPedido,
    sinImprimir: false,
    soloTienda: false,
    page: 1,
    pageSize: 10,
  });
  const orders = extractListPayloadItems(payload);
  const matchingOrder = orders.find(order => {
    const orderNumber = String(order?.numeroPedido || order?.numero_pedido || order?.codigoPedido || order?.codigo_pedido || "").trim();
    return orderNumber === numeroPedido;
  }) || orders[0];
  const products = extractOrderProducts(matchingOrder);

  const orderedProducts = [
    ...products.filter(product => productionProductMatches(sourceItem, product, { preferCatalogCode })),
    ...products.filter(product => !productionProductMatches(sourceItem, product, { preferCatalogCode })),
  ];

  const directMatchedImageUrl = orderedProducts
    .filter(product => productionProductMatches(sourceItem, product, { preferCatalogCode }))
    .map(resolveProductImageUrl)
    .find(Boolean);
  if (directMatchedImageUrl) return directMatchedImageUrl;

  for (const product of orderedProducts) {
    const indexedImageUrl = resolveProductionProduct(product, catalogIndex, { preferCatalogCode, allowDirectImage: !preferCatalogCode }).imageUrl;
    if (indexedImageUrl) return indexedImageUrl;

    const catalogImageUrl = await resolveCatalogImageByProductionCode(api, empresaId, sucursalId, product, catalogIndex);
    if (catalogImageUrl) return catalogImageUrl;
  }

  return "";
}

function productionImageCacheKeys(item, options = {}) {
  const preferCatalogCode = Boolean(options.preferCatalogCode);
  const itemKeys = [];
  const codeKeys = [];
  const nameKeys = [];
  const itemKey = productionItemKey(item);
  if (itemKey) itemKeys.push(`item:${itemKey}`);

  const codeCandidates = preferCatalogCode ? catalogCodeCandidates(item) : productCodeCandidates(item);
  codeCandidates.forEach(value => {
    const key = productLookupKey(value);
    if (key) codeKeys.push(`${preferCatalogCode ? "catalog-code" : "code"}:${key}`);
  });

  [
    item?.nombreArreglo,
    item?.nombre_arreglo,
    item?.producto,
    item?.nombreProducto,
    item?.nombre_producto,
    item?.nombre,
    firstProductToken(item?.nombreArreglo || item?.producto || item?.nombreProducto || item?.nombre),
  ].forEach(value => {
    const key = productLookupKey(value);
    if (key) nameKeys.push(`name:${key}`);
  });

  const keys = preferCatalogCode ? [...itemKeys, ...nameKeys, ...codeKeys] : [...itemKeys, ...codeKeys, ...nameKeys];

  return Array.from(new Set(keys));
}

function cachedProductionImageForItem(item, imageCache = {}, options = {}) {
  const preferCatalogCode = Boolean(options.preferCatalogCode);
  const keys = productionImageCacheKeys(item, options);
  for (const key of keys) {
    const imageUrl = imageCache[key];
    if (imageUrl) return imageUrl;
  }
  return "";
}

function catalogOrCachedProductionImageForItem(item, catalogIndex = new Map(), imageCache = {}, empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId ?? item?.empresaID ?? item?.empresaId ?? item?.empresa_id);
  const directImageUrl = resolveProductImageUrl(item);
  const catalogImageUrl = resolveProductionProduct(item, catalogIndex, {
    preferCatalogCode,
    allowDirectImage: false,
  }).imageUrl;
  if (catalogImageUrl) return catalogImageUrl;
  const cachedImageUrl = cachedProductionImageForItem(item, imageCache, { preferCatalogCode });
  if (preferCatalogCode && cachedImageUrl && cachedImageUrl === directImageUrl) return "";
  return cachedImageUrl;
}

function resolveProductionDisplayImageUrl(item, catalogIndex = new Map(), imageCache = {}, empresaId = null) {
  const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId ?? item?.empresaID ?? item?.empresaId ?? item?.empresa_id);
  const directImageUrl = resolveProductImageUrl(item);
  const trustedImageUrl = catalogOrCachedProductionImageForItem(item, catalogIndex, imageCache, empresaId);
  return trustedImageUrl || (!preferCatalogCode ? directImageUrl : "");
}

function productInitials(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PR";
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function buildPaginationItems(page, pages) {
  const currentPage = Math.max(1, Math.min(Number(page || 1), Number(pages || 1)));
  const totalPages = Math.max(1, Number(pages || 1));
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  if (currentPage >= totalPages - 3) return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
}

export function ProductionPage({ session, canViewPipeline, canViewPedidos, canViewCatalogo, canViewProduccion, canViewDomicilios, canViewBarrios, canViewInventario, canViewContabilidad, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario, onGoContabilidad, onGoClientes, onGoUsuarios }) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const normalizedRole = normalizeRole(session?.rol);
  const isSuperAdmin = Boolean(session?.esGlobalJoin) || ["super_admin", "join_superadmin"].includes(normalizedRole);
  const canManageProductionActions = Boolean(session?.esGlobalJoin) || ["admin", "empresa_admin"].includes(normalizedRole);
  const canManageStateActions = canManageProductionActions || isSuperAdmin;
  const canRecalculateProduction = isSuperAdmin;
  const canFloristaQuickState = !canManageProductionActions;
  const canResolveProductionImages = Boolean(canViewProduccion);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );
  const visibleSubmenuOptions = useMemo(
    () => (canViewProduccion ? SUBMENU_OPTIONS : [{ key: "pedidos", label: "Pedidos" }]),
    [canViewProduccion]
  );

  const [fecha, setFecha] = useState(todayIsoDate());
  const [estadosFiltro, setEstadosFiltro] = useState(ESTADOS_FILTRO_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [productionMetricas, setProductionMetricas] = useState({
    pendientesHoy: null,
    sinAsignar: null,
    atrasados: null,
    pendientesFuturos: 0,
  });
  const productionMetricasRef = useRef(productionMetricas);
  const [floristas, setFloristas] = useState([]);
  const [floristasDisponibilidad, setFloristasDisponibilidad] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productionProductImages, setProductionProductImages] = useState({});

  const [selectedFloristaById, setSelectedFloristaById] = useState({});
  const [selectedEstadoById, setSelectedEstadoById] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assignmentItem, setAssignmentItem] = useState(null);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false);

  const [usuarioCambio] = useState(() => String(session?.email || session?.nombre || DEFAULT_USER));
  const [motivoAccion, setMotivoAccion] = useState("");

  const [floristaGestionID, setFloristaGestionID] = useState("");
  const [floristaEstado, setFloristaEstado] = useState("Activo");
  const [fechaInicioIncapacidad, setFechaInicioIncapacidad] = useState(todayIsoDate());
  const [fechaFinIncapacidad, setFechaFinIncapacidad] = useState(todayIsoDate());

  const [submenu, setSubmenu] = useState("pedidos");
  const [productionMenuOpen, setProductionMenuOpen] = useState(false);
  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [soloMisAsignados, setSoloMisAsignados] = useState(!canManageProductionActions);
  const [activeMetricFilter, setActiveMetricFilter] = useState(null);
  const [productionPage, setProductionPage] = useState(1);
  const [productionPageSize, setProductionPageSize] = useState(10);
  const productionListRef = useRef(null);
  const productionMenuRef = useRef(null);

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  useEffect(() => {
    productionMetricasRef.current = productionMetricas;
  }, [productionMetricas]);

  useEffect(() => {
    if (!productionMenuOpen) return undefined;
    const handlePointerDown = event => {
      if (productionMenuRef.current?.contains(event.target)) return;
      setProductionMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [productionMenuOpen]);

  const currentFloristaDisponibilidad = useMemo(() => {
    if (!floristaGestionID) return null;
    return floristasDisponibilidad.find(item => Number(item.idFlorista) === Number(floristaGestionID)) || null;
  }, [floristaGestionID, floristasDisponibilidad]);

  const allFloristas = useMemo(() => {
    const byId = new Map();
    [...floristasDisponibilidad, ...floristas].forEach(item => {
      const floristaId = item?.idFlorista;
      if (floristaId == null || floristaId === "") return;
      byId.set(Number(floristaId), item);
    });
    return Array.from(byId.values()).sort((left, right) =>
      String(left?.nombre || "").localeCompare(String(right?.nombre || ""), "es", { sensitivity: "base" })
    );
  }, [floristas, floristasDisponibilidad]);

  const currentFloristaId = useMemo(
    () => inferCurrentFloristaId(session, allFloristas),
    [session, allFloristas]
  );
  const selectedStatusKey = useMemo(
    () => productionSelectedStatusKey(estadosFiltro),
    [estadosFiltro]
  );

  const ownFloristaDisponibilidad = useMemo(() => {
    if (currentFloristaId == null) return null;
    return floristasDisponibilidad.find(item => Number(item.idFlorista) === Number(currentFloristaId)) || null;
  }, [currentFloristaId, floristasDisponibilidad]);
  const currentFloristaName = useMemo(() => {
    if (ownFloristaDisponibilidad?.nombre) return ownFloristaDisponibilidad.nombre;
    if (currentFloristaId != null) {
      const found = allFloristas.find(item => Number(item?.idFlorista) === Number(currentFloristaId));
      if (found?.nombre) return found.nombre;
    }
    return session?.nombre || session?.name || "";
  }, [allFloristas, currentFloristaId, ownFloristaDisponibilidad, session]);
  const catalogProductIndex = useMemo(
    () => buildCatalogProductIndex(catalogProducts),
    [catalogProducts]
  );

  const canChangeOwnProductionState = useCallback((item) => {
    if (!canFloristaQuickState) return false;
    return itemMatchesCurrentFlorista(item, currentFloristaId, currentFloristaName);
  }, [canFloristaQuickState, currentFloristaId, currentFloristaName]);

  const visibleItems = useMemo(
    () => buildVisibleProductionItems(items, currentFloristaId, busquedaGeneral, activeMetricFilter ? false : soloMisAsignados, !activeMetricFilter, currentFloristaName),
    [items, currentFloristaId, currentFloristaName, busquedaGeneral, soloMisAsignados, activeMetricFilter]
  );
  const searchOverridesFilters = useMemo(
    () => normalizeSearchText(busquedaGeneral).length > 0,
    [busquedaGeneral]
  );
  const metrics = useMemo(() => {
    const total = visibleItems.length;
    const pendientes = visibleItems.filter(item => normalizeStatus(item?.estado).replace(/_/g, "") === "PENDIENTE");
    const enProduccion = visibleItems.filter(item => normalizeStatus(item?.estado).replace(/_/g, "") === "ENPRODUCCION");
    const sinAsignar = pendientes.filter(item => !hasAssignedFlorista(item));
    const pendientesHoy = pendientes.filter(item => resolveProgrammedDate(item) === todayIsoDate());
    const atrasados = pendientes.filter(item => isPendingOverdue(item));
    const criticos = pendientes
      .filter(item => isPendingOverdue(item) || !hasAssignedFlorista(item))
      .sort((left, right) => {
        const leftDate = resolveProgrammedDate(left) || "9999-12-31";
        const rightDate = resolveProgrammedDate(right) || "9999-12-31";
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return Number(left?.numeroPedido || 0) - Number(right?.numeroPedido || 0);
      })
      .slice(0, 5);

    return {
      total,
      pendientes: pendientes.length,
      pendientesHoy: productionMetricas?.pendientesHoy != null ? Number(productionMetricas.pendientesHoy) : pendientesHoy.length,
      enProduccion: enProduccion.length,
      sinAsignar: productionMetricas?.sinAsignar != null ? Number(productionMetricas.sinAsignar) : sinAsignar.length,
      atrasados: productionMetricas?.atrasados != null ? Number(productionMetricas.atrasados) : atrasados.length,
      criticos,
      pendientesFuturos: Number(productionMetricas?.pendientesFuturos || 0),
    };
  }, [visibleItems, productionMetricas]);

  const activeMetricMeta = useMemo(() => {
    const metaByKey = {
      pendientesHoy: {
        label: "Pendientes hoy",
        description: "Pedidos que deben resolverse en la jornada.",
      },
      sinAsignar: {
        label: "Pendientes sin asignar",
        description: "Pedidos pendientes que todavía no tienen florista.",
      },
      atrasados: {
        label: "Pendientes atrasados",
        description: "Pedidos pendientes con fecha programada vencida.",
      },
      pendientesFuturos: {
        label: "Pendientes futuros",
        description: "Pedidos pendientes programados para días posteriores.",
      },
    };
    return activeMetricFilter ? metaByKey[activeMetricFilter] || null : null;
  }, [activeMetricFilter]);

  const focusedVisibleItems = useMemo(() => {
    if (!activeMetricFilter) return visibleItems;
    return visibleItems.filter(item => matchesProductionMetric(item, activeMetricFilter));
  }, [activeMetricFilter, visibleItems]);
  const productionTotal = focusedVisibleItems.length;
  const productionPages = Math.max(1, Math.ceil(productionTotal / productionPageSize));
  const productionVisibleFrom = productionTotal > 0 ? ((productionPage - 1) * productionPageSize) + 1 : 0;
  const productionVisibleTo = productionTotal > 0 ? Math.min(productionTotal, productionVisibleFrom + productionPageSize - 1) : 0;
  const productionPagerItems = useMemo(
    () => buildPaginationItems(productionPage, productionPages),
    [productionPage, productionPages]
  );
  const paginatedProductionItems = useMemo(() => {
    const start = (productionPage - 1) * productionPageSize;
    return focusedVisibleItems.slice(start, start + productionPageSize);
  }, [focusedVisibleItems, productionPage, productionPageSize]);

  useEffect(() => {
    setProductionPage(1);
  }, [activeMetricFilter, busquedaGeneral, fecha, estadosFiltro, soloMisAsignados, productionPageSize]);

  useEffect(() => {
    if (productionPage > productionPages) {
      setProductionPage(productionPages);
    }
  }, [productionPage, productionPages]);

  const focusMetric = useCallback(metricKey => {
    setSubmenu("pedidos");
    setBusquedaGeneral("");
    setActiveMetricFilter(current => {
      const nextMetric = current === metricKey ? null : metricKey;
      if (!nextMetric) {
        setFecha(todayIsoDate());
        setEstadosFiltro(ESTADOS_FILTRO_DEFAULT);
        return null;
      }
      if (nextMetric === "pendientesHoy") {
        setFecha(todayIsoDate());
      } else {
        setFecha("");
      }
      setEstadosFiltro(["Pendiente"]);
      return nextMetric;
    });
    window.requestAnimationFrame(() => {
      productionListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const toggleEstadoFiltro = useCallback((estadoItem) => {
    setActiveMetricFilter(null);
    setEstadosFiltro([estadoItem]);
  }, []);

  const selectAllProductionStatuses = useCallback(() => {
    setActiveMetricFilter(null);
    setEstadosFiltro(ESTADOS_UI);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const shouldIncludeCanceled = shouldIncludeCanceledProduction(estadosFiltro);
      const backendStatusFilter = productionBackendStatusFilter(estadosFiltro);
      const expectedMetricCount = activeMetricFilter
        ? Number(productionMetricasRef.current?.[activeMetricFilter] || 0)
        : 0;
      const produccion = await api.listarProduccion({
        empresaId,
        sucursalId,
        fecha: searchOverridesFilters || activeMetricFilter ? undefined : fecha,
        estado: searchOverridesFilters || activeMetricFilter ? undefined : backendStatusFilter,
        q: searchOverridesFilters ? busquedaGeneral : undefined,
        metricFilter: searchOverridesFilters ? undefined : activeMetricFilter,
        todasFechas: !searchOverridesFilters && !activeMetricFilter && !fecha,
        incluirCancelado: shouldIncludeCanceled,
        autoAsignarPendientesHoy: !activeMetricFilter && !searchOverridesFilters,
      });
      let nextItemsRaw = (Array.isArray(produccion.items) ? produccion.items : []).map(normalizeProductionItemStatus);
      const responseMetricas = produccion?.metricas || {};
      const activeMetricCount = activeMetricFilter ? Number(responseMetricas?.[activeMetricFilter] || 0) : 0;
      if (activeMetricFilter && nextItemsRaw.length === 0 && Math.max(activeMetricCount, expectedMetricCount) > 0) {
        const fallbackResponse = await api.listarProduccion({
          empresaId,
          sucursalId,
          fecha: undefined,
          estado: undefined,
          metricFilter: undefined,
          todasFechas: true,
          incluirCancelado: shouldIncludeCanceled,
          autoAsignarPendientesHoy: false,
        });
        nextItemsRaw = (Array.isArray(fallbackResponse.items) ? fallbackResponse.items : [])
          .map(normalizeProductionItemStatus)
          .filter(item => matchesProductionMetric(item, activeMetricFilter));
      }
      if (searchOverridesFilters && nextItemsRaw.length === 0) {
        const pipelinePayload = await api.listarPipelinePedidos({
          empresaId,
          sucursalId,
          numeroPedido: String(busquedaGeneral || "").trim(),
          soloHoy: false,
          soloAtrasados: false,
          soloEnProduccion: false,
        });
        const pipelineMatches = flattenPipelineCards(pipelinePayload);
        const candidateDates = Array.from(
          new Set(
            pipelineMatches
              .map(item => toIsoDate(item?.fecha_entrega))
              .filter(Boolean)
          )
        );
        if (candidateDates.length > 0) {
          const fallbackResponses = await Promise.all(
            candidateDates.map(candidateDate =>
              api.listarProduccion({
                empresaId,
                sucursalId,
                fecha: candidateDate,
                estado: backendStatusFilter,
                incluirCancelado: shouldIncludeCanceled,
              })
            )
          );
          nextItemsRaw = fallbackResponses
            .flatMap(response => (Array.isArray(response?.items) ? response.items : []))
            .map(normalizeProductionItemStatus);
        }
      }
      if (searchOverridesFilters && nextItemsRaw.length === 0) {
        const fallbackResponse = await api.listarProduccion({
          empresaId,
          sucursalId,
          fecha: undefined,
          estado: backendStatusFilter,
          metricFilter: undefined,
          todasFechas: true,
          incluirCancelado: shouldIncludeCanceled,
          autoAsignarPendientesHoy: false,
        });
        nextItemsRaw = (Array.isArray(fallbackResponse.items) ? fallbackResponse.items : [])
          .map(normalizeProductionItemStatus)
          .filter(item => productionItemMatchesSearch(item, busquedaGeneral));
      }
      if (shouldIncludeCanceled && !activeMetricFilter) {
        try {
          const canceledOrdersPayload = await api.listarPedidos({
            empresaId,
            sucursalId,
            q: searchOverridesFilters ? busquedaGeneral : "",
            estado: "CANCELADO",
            sinImprimir: false,
            soloTienda: false,
            fechaDesde: searchOverridesFilters || !fecha ? undefined : toIsoDateStart(fecha),
            fechaHasta: searchOverridesFilters || !fecha ? undefined : toIsoDateEnd(fecha),
            page: 1,
            pageSize: 300,
          });
          const canceledProductionItems = extractListPayloadItems(canceledOrdersPayload)
            .map(productionItemFromCanceledOrder)
            .filter(Boolean);
          nextItemsRaw = mergeProductionItemsByOrder(nextItemsRaw, canceledProductionItems);
        } catch (canceledOrdersError) {
          console.warn("No fue posible cargar pedidos cancelados para producción:", canceledOrdersError);
        }
      }
      const nextItems = activeMetricFilter
        ? nextItemsRaw.filter(item => !isCanceledProductionStatus(item))
        : searchOverridesFilters
        ? nextItemsRaw.filter(item => productionItemMatchesSearch(item, busquedaGeneral))
        : nextItemsRaw.filter(item =>
          estadosFiltro.some(estadoItem => normalizeStatus(estadoItem) === normalizeStatus(item.estado))
        );

      setItems(nextItems);
      const metricas = responseMetricas;
      setProductionMetricas({
        pendientesHoy: Object.prototype.hasOwnProperty.call(metricas, "pendientesHoy") ? Number(metricas.pendientesHoy || 0) : null,
        sinAsignar: Object.prototype.hasOwnProperty.call(metricas, "sinAsignar") ? Number(metricas.sinAsignar || 0) : null,
        atrasados: Object.prototype.hasOwnProperty.call(metricas, "atrasados") ? Number(metricas.atrasados || 0) : null,
        pendientesFuturos: Number(metricas.pendientesFuturos || 0),
      });
      setError("");
      return nextItems;
    } catch (nextError) {
      console.error("Error cargando producción:", nextError);
      setItems([]);
      setProductionMetricas({ pendientesHoy: null, sinAsignar: null, atrasados: null, pendientesFuturos: 0 });
      setError("No fue posible cargar el módulo de producción.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [api, fecha, estadosFiltro, activeMetricFilter, empresaId, sucursalId, searchOverridesFilters, busquedaGeneral]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!canResolveProductionImages) return undefined;
    let disposed = false;
    api.buscarArreglosCatalogo({ empresaId, sucursalId, q: "" })
      .then(payload => {
        if (disposed) return;
        const rows = extractCatalogRows(payload);
        setCatalogProducts(dedupeCatalogItems(rows.map(item => normalizeCatalogItem(item)).filter(Boolean)));
      })
      .catch(catalogError => {
        console.warn("No fue posible cargar imágenes del catálogo en producción:", catalogError);
        if (!disposed) setCatalogProducts([]);
      });

    return () => { disposed = true; };
  }, [api, canResolveProductionImages, empresaId, sucursalId]);

  useEffect(() => {
    if (!canResolveProductionImages) return undefined;
    if (items.length === 0) return undefined;
    let disposed = false;
    const queries = catalogQueriesFromItems(items, shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId));
    if (queries.length === 0) return undefined;

    Promise.allSettled(
      queries.map(query => api.buscarArreglosCatalogo({ empresaId, sucursalId, q: query }))
    )
      .then(results => {
        if (disposed) return;
        const nextCatalogItems = results
          .filter(result => result.status === "fulfilled")
          .flatMap(result => extractCatalogRows(result.value))
          .map(item => normalizeCatalogItem(item))
          .filter(Boolean);
        if (nextCatalogItems.length === 0) return;
        setCatalogProducts(current => dedupeCatalogItems([...current, ...nextCatalogItems]));
      })
      .catch(catalogError => {
        console.warn("No fue posible buscar imágenes adicionales de producción:", catalogError);
      });

    return () => { disposed = true; };
  }, [api, canResolveProductionImages, empresaId, sucursalId, items]);

  useEffect(() => {
    if (!canResolveProductionImages) return undefined;
    const preferCatalogCode = shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId);
    const missingItems = focusedVisibleItems
      .filter(item => {
        const key = productionItemKey(item);
        return key && !catalogOrCachedProductionImageForItem(item, catalogProductIndex, productionProductImages, empresaId);
      })
      .slice(0, 20);

    if (missingItems.length === 0) return undefined;

    let disposed = false;
    // Resuelve de a IMAGE_RESOLUTION_CONCURRENCY items a la vez en vez de los 20 en paralelo:
    // cada item puede disparar varias llamadas al backend (catalogo, pedido, pipeline), y los
    // 20 en simultaneo saturaban la misma instancia justo cuando la lista se refresca
    // (ej. justo despues de cambiar el estado de un pedido).
    mapWithConcurrencyLimit(missingItems, IMAGE_RESOLUTION_CONCURRENCY, async item => {
      let imageUrl = await resolveCatalogImageByProductionCode(api, empresaId, sucursalId, item, catalogProductIndex);
      if (item?.numeroPedido) {
        try {
          imageUrl = imageUrl || await resolvePedidoListProductionImageUrl(api, empresaId, sucursalId, item, catalogProductIndex);
        } catch (ordersError) {
          console.warn("No fue posible resolver imagen desde pedidos:", ordersError);
        }
      }
      const pedidoId = productionPedidoId(item);
      if (!imageUrl && pedidoId != null) {
        try {
          const detail = await api.obtenerDetallePedido(pedidoId);
          imageUrl = resolveDetailProductionImageUrl(detail, catalogProductIndex, item, empresaId);
        } catch (detailError) {
          console.warn("No fue posible resolver imagen desde detalle de pedido:", detailError);
        }
      }
      if (!imageUrl && (canManageProductionActions || canViewPipeline) && item?.numeroPedido) {
        try {
          const pipelinePayload = await api.listarPipelinePedidos({
            empresaId,
            sucursalId,
            numeroPedido: String(item.numeroPedido || "").trim(),
            soloHoy: false,
            soloAtrasados: false,
            soloEnProduccion: false,
          });
          imageUrl = resolvePipelineProductionImageUrl(pipelinePayload, item, catalogProductIndex, empresaId);
          const pipelineRealPedidoId = pipelinePedidoId(pipelinePayload, item);
          if (!imageUrl && pipelineRealPedidoId != null) {
            const detail = await api.obtenerDetallePedido(pipelineRealPedidoId);
            imageUrl = resolveDetailProductionImageUrl(detail, catalogProductIndex, item, empresaId);
          }
        } catch (pipelineError) {
          console.warn("No fue posible resolver imagen desde pipeline:", pipelineError);
        }
      }
      if (!imageUrl) {
        imageUrl = await resolveCatalogImageByProductionCode(api, empresaId, sucursalId, item, catalogProductIndex);
      }
      return {
        key: productionItemKey(item),
        cacheKeys: productionImageCacheKeys(item, { preferCatalogCode }),
        imageUrl,
      };
    }).then(results => {
      if (disposed) return;
      setProductionProductImages(current => {
        const next = { ...current };
        let hasChanges = false;
        for (const result of results) {
          if (result.status !== "fulfilled" || !result.value?.key) continue;
          if (!result.value.imageUrl) continue;
          for (const cacheKey of result.value.cacheKeys || [`item:${result.value.key}`]) {
            next[cacheKey] = result.value.imageUrl;
          }
          hasChanges = true;
        }
        return hasChanges ? next : current;
      });
    });

    return () => { disposed = true; };
  }, [api, canManageProductionActions, canResolveProductionImages, canViewPipeline, catalogProductIndex, empresaId, focusedVisibleItems, productionProductImages, sucursalId]);

  const loadFloristaData = useCallback(async () => {
    try {
      const [floristasData, disponibilidadData] = await Promise.all([
        api.listarFloristas({
          empresaId,
          sucursalId,
          soloActivos: false
        }),
        api.listarFloristas({
          empresaId,
          sucursalId,
          soloActivos: false,
          incluirExternos: true,
        })
      ]);
      const nextFloristas = Array.isArray(floristasData.items) ? floristasData.items : [];
      const nextFloristasDisponibilidad = Array.isArray(disponibilidadData.items) ? disponibilidadData.items : [];
      setFloristas(nextFloristas);
      setFloristasDisponibilidad(nextFloristasDisponibilidad);
      if (!floristaGestionID && nextFloristas.length > 0) {
        setFloristaGestionID(String(nextFloristas[0].idFlorista));
      }
    } catch (nextError) {
      console.error("Error cargando floristas:", nextError);
      setFloristas([]);
      setFloristasDisponibilidad([]);
    }
  }, [api, empresaId, sucursalId, floristaGestionID]);

  useEffect(() => {
    void loadFloristaData();
  }, [loadFloristaData]);


  useEffect(() => {
    if (submenu !== "pedidos") {
      setDrawerOpen(false);
      setSelectedItem(null);
    }
  }, [submenu]);

  useEffect(() => {
    if (visibleSubmenuOptions.some(item => item.key === submenu)) return;
    setSubmenu("pedidos");
  }, [submenu, visibleSubmenuOptions]);

  useEffect(() => {
    if (canManageProductionActions) return;
    if (!currentFloristaId) {
      setSoloMisAsignados(false);
      return;
    }
    setSoloMisAsignados(true);
  }, [canManageProductionActions, currentFloristaId]);


  const refreshAll = async () => {
    await Promise.all([loadItems(), loadFloristaData()]);
  };

  const onChangeSoloMisAsignados = checked => {
    setSoloMisAsignados(checked);
  };

  const autoAsignarPedidosDeHoy = useCallback(async (sourceItems) => {
    const today = todayIsoDate();
    const candidates = sourceItems.filter(item =>
      resolveProgrammedDate(item) === today && !hasAssignedFlorista(item)
    );

    if (candidates.length === 0) {
      return { encontrados: 0, asignados: 0 };
    }

    const results = await Promise.allSettled(candidates.map(item => api.asignarProduccion({
      produccionId: item.idProduccion,
      floristaId: null,
      fechaProgramadaProduccion: item.fechaProgramadaProduccion || item.fechaEntrega || null
    })));

    return {
      encontrados: candidates.length,
      asignados: results.filter(item => item.status === "fulfilled").length
    };
  }, [api]);

  const generarDesdePedidos = async () => {
    try {
      await api.generarProduccionDesdePedidos({
        empresaId,
        sucursalId,
        diasAnticipacion: 1,
        autoAsignar: false
      });
      const nextItems = await loadItems();
      const autoAsignacion = await autoAsignarPedidosDeHoy(nextItems);
      await refreshAll();
      if (autoAsignacion.encontrados > 0) {
        globalThis.alert(`Producción sincronizada. Se autoasignaron ${autoAsignacion.asignados} de ${autoAsignacion.encontrados} arreglos programados para hoy. Los pedidos de otras fechas quedaron sin florista para asignación manual.`);
      }
    } catch (nextError) {
      console.error("Error generando producción desde pedidos:", nextError);
      globalThis.alert("No fue posible generar producción desde pedidos aprobados/pagados.");
    }
  };

  const openActionsDrawer = item => {
    if (!item) return;
    const itemKey = productionSelectionKey(item);
    setSelectedItem(item);
    setSelectedFloristaById(current => ({
      ...current,
      [itemKey]: current[itemKey] || (item.floristaID != null ? String(item.floristaID) : (!canManageProductionActions && currentFloristaId != null ? String(currentFloristaId) : "")),
    }));
    if (item.floristaID != null) {
      setFloristaGestionID(String(item.floristaID));
    }
    setDrawerOpen(true);
    setAssignmentDrawerOpen(false);
    setAssignmentItem(null);
    setMotivoAccion("");
  };

  const closeActionsDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  const openAssignmentDrawer = item => {
    if (!item) return;
    const itemKey = productionSelectionKey(item);
    setAssignmentItem(item);
    setSelectedFloristaById(current => ({
      ...current,
      [itemKey]: current[itemKey] || (item.floristaID != null ? String(item.floristaID) : (!canManageProductionActions && currentFloristaId != null ? String(currentFloristaId) : "")),
    }));
    setAssignmentDrawerOpen(true);
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  const closeAssignmentDrawer = () => {
    setAssignmentDrawerOpen(false);
    setAssignmentItem(null);
  };

  const refreshAndKeepSelection = async item => {
    const nextItems = await loadItems();
    const nextVisible = buildVisibleProductionItems(nextItems, currentFloristaId, busquedaGeneral, soloMisAsignados, true, currentFloristaName);
    const nextSelected = nextVisible.find(candidate => Number(candidate.pedidoID) === Number(item?.pedidoID));
    if (nextSelected) {
      if (assignmentDrawerOpen) {
        setAssignmentItem(nextSelected);
        return;
      }
      if (drawerOpen) {
        setSelectedItem(nextSelected);
        setDrawerOpen(true);
        return;
      }
      return;
    }
    closeActionsDrawer();
    closeAssignmentDrawer();
  };

  const asignar = async item => {
    const itemKey = productionSelectionKey(item);
    const floristaId = selectedFloristaById[itemKey];
    const produccionIds = Array.isArray(item?.produccionIds) && item.produccionIds.length > 0
      ? item.produccionIds
      : [item.idProduccion];

    try {
      await Promise.all(produccionIds.map(produccionId => api.asignarProduccion({
        produccionId,
        floristaId: floristaId ? Number(floristaId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion
      })));
      await refreshAndKeepSelection(item);
    } catch (nextError) {
      console.error("Error asignando producción:", nextError);
      globalThis.alert("No fue posible asignar el florista.");
    }
  };

  const reasignarAuditable = async item => {
    const itemKey = productionSelectionKey(item);
    const floristaNuevoId = selectedFloristaById[itemKey] || (!canManageProductionActions && currentFloristaId != null ? String(currentFloristaId) : null);
    const motivo = "Reasignación desde panel de producción";
    const produccionIds = Array.isArray(item?.produccionIds) && item.produccionIds.length > 0
      ? item.produccionIds
      : [item.idProduccion];
    if (!floristaNuevoId) {
      globalThis.alert("Selecciona un florista para reasignar.");
      return;
    }

    try {
      await Promise.all(produccionIds.map(produccionId => api.reasignarProduccion({
        produccionId,
        floristaNuevoId: floristaNuevoId ? Number(floristaNuevoId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion,
        motivo,
        usuarioCambio
      })));
      await refreshAndKeepSelection(item);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error reasignando florista:", nextError);
      globalThis.alert("No fue posible reasignar el florista.");
    }
  };

  const cambiarEstado = async item => {
    const itemKey = productionSelectionKey(item);
    const nuevoEstado = selectedEstadoById[itemKey];
    const produccionIds = Array.isArray(item?.produccionIds) && item.produccionIds.length > 0
      ? item.produccionIds
      : [item.idProduccion];
    if (!nuevoEstado) {
      globalThis.alert("Selecciona un estado.");
      return;
    }

    try {
      await Promise.all(produccionIds.map(produccionId => api.cambiarEstadoProduccion({
        produccionId,
        nuevoEstado,
        observacionesInternas: motivoAccion || null,
        usuarioCambio,
        origenCambio: "panel_produccion_admin",
        cambioAdministrativo: true
      })));
      await refreshAndKeepSelection(item);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error cambiando estado:", nextError);
      globalThis.alert(productionActionErrorMessage(nextError, "No fue posible cambiar el estado. Verifica transición válida."));
    }
  };

  const cambiarEstadoAdminRapido = async item => {
    const nuevoEstado = nextFloristaStatus(item?.estado);
    const produccionIds = Array.isArray(item?.produccionIds) && item.produccionIds.length > 0
      ? item.produccionIds
      : [item.idProduccion];
    if (!nuevoEstado) return;
    if (!hasAssignedFlorista(item)) {
      globalThis.alert("Asigna un florista antes de cambiar el estado de producción.");
      return;
    }

    try {
      await Promise.all(produccionIds.map(produccionId => api.cambiarEstadoProduccion({
        produccionId,
        nuevoEstado,
        observacionesInternas: "Cambio rápido de estado desde panel administrativo de producción",
        usuarioCambio,
        origenCambio: "panel_produccion_admin_rapido",
        cambioAdministrativo: true
      })));
      await refreshAndKeepSelection(item);
    } catch (nextError) {
      console.error("Error cambiando estado rápido de admin:", nextError);
      globalThis.alert(productionActionErrorMessage(nextError, "No fue posible cambiar el estado. Verifica transición válida."));
    }
  };

  const cambiarEstadoFloristaRapido = async item => {
    const nuevoEstado = nextFloristaStatus(item?.estado);
    const produccionIds = Array.isArray(item?.produccionIds) && item.produccionIds.length > 0
      ? item.produccionIds
      : [item.idProduccion];
    if (!nuevoEstado) return;
    if (!item?.floristaAsignado) {
      globalThis.alert("No puedes cambiar estado sin florista asignado.");
      return;
    }
    if (!canChangeOwnProductionState(item)) {
      globalThis.alert("Solo puedes cambiar el estado de tus propios pedidos asignados.");
      return;
    }

    try {
      await Promise.all(produccionIds.map(produccionId => api.cambiarEstadoProduccion({
        produccionId,
        nuevoEstado,
        observacionesInternas: "Cambio de estado desde panel florista",
        usuarioCambio,
        origenCambio: "panel_produccion_florista",
        cambioAdministrativo: false
      })));
      await loadItems();
    } catch (nextError) {
      console.error("Error cambiando estado rápido de florista:", nextError);
      globalThis.alert(productionActionErrorMessage(nextError, "No fue posible cambiar el estado."));
    }
  };

  const recalcularPedido = async item => {
    try {
      await api.recalcularProduccionPedido({
        pedidoId: item.pedidoID,
        usuarioCambio,
        motivo: motivoAccion || "Recalculo desde front",
        productoEstructuralCambiado: false,
        forceCancelarYCrearNueva: false
      });
      await refreshAndKeepSelection(item);
    } catch (nextError) {
      console.error("Error recalculando producción por pedido:", nextError);
      globalThis.alert("No fue posible recalcular la producción del pedido.");
    }
  };

  const actualizarEstadoFlorista = async () => {
    if (!floristaGestionID) {
      globalThis.alert("Selecciona un florista.");
      return;
    }

    try {
      await api.actualizarEstadoFlorista({
        floristaId: Number(floristaGestionID),
        estado: floristaEstado,
        fechaInicioIncapacidad: floristaEstado === "Incapacidad" ? fechaInicioIncapacidad : null,
        fechaFinIncapacidad: floristaEstado === "Incapacidad" ? fechaFinIncapacidad : null,
        motivo: motivoAccion || "Cambio de estado florista",
        usuarioCambio
      });
      await refreshAll();
      globalThis.alert("Estado del florista actualizado.");
    } catch (nextError) {
      console.error("Error actualizando estado del florista:", nextError);
      globalThis.alert("No fue posible actualizar el estado del florista.");
    }
  };

  const actualizarDisponibilidadFlorista = async (floristaId, estadoObjetivo) => {
    try {
      await api.actualizarEstadoFlorista({
        floristaId: Number(floristaId),
        estado: estadoObjetivo,
        fechaInicioIncapacidad: null,
        fechaFinIncapacidad: null,
        motivo: `Cambio rápido a ${estadoObjetivo} desde disponibilidad florista`,
        usuarioCambio
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error actualizando disponibilidad del florista:", nextError);
      globalThis.alert("No fue posible actualizar la disponibilidad del florista.");
    }
  };

  const toggleDisponibilidadFlorista = async item => {
    if (!item?.idFlorista) return;
    const estadoObjetivo = isFloristaActivo(item) ? "Inactivo" : "Activo";
    await actualizarDisponibilidadFlorista(item.idFlorista, estadoObjetivo);
  };

  const toggleEstadoFloristaPropio = async () => {
    if (currentFloristaId == null) {
      globalThis.alert("No fue posible identificar el florista.");
      return;
    }

    const estadoObjetivo = isFloristaActivo(ownFloristaDisponibilidad) ? "Inactivo" : "Activo";

    try {
      await api.actualizarEstadoFlorista({
        floristaId: Number(currentFloristaId),
        estado: estadoObjetivo,
        fechaInicioIncapacidad: null,
        fechaFinIncapacidad: null,
        motivo: `Cambio rápido a ${estadoObjetivo} desde panel florista`,
        usuarioCambio
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error alternando estado del florista:", nextError);
      globalThis.alert("No fue posible actualizar el estado del florista.");
    }
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="produccion"
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
          clientes: canViewClientesPanel,
          usuarios: canViewUsuariosPanel,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: () => {
            onGoProduccion();
            setSubmenu("pedidos");
          },
          domicilios: onGoDomicilios,
          barrios: onGoBarrios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
        sessionLabel={`Sesion activa: ${displayUserName}`}
      />

      <main className="orders-admin-view production-page-view">
        <header className="orders-admin-header orders-page-header production-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-title-row">
              <h1>Producción</h1>
            </div>
            <div className="production-header-meta" aria-label="Contexto de producción">
              <span className="production-header-date">
                <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
                Hoy, {productionHeaderDateLabel()}
              </span>
            </div>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
              <label className="production-header-search" aria-label="Buscar producción">
                <Search size={17} strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={busquedaGeneral}
                  onChange={event => {
                    setActiveMetricFilter(null);
                    setBusquedaGeneral(event.target.value);
                  }}
                  placeholder="Buscar florista, cliente o pedido..."
                  title="Buscar por florista, cliente o número de pedido"
                />
              </label>
              <div className="production-menu-dropdown" ref={productionMenuRef}>
                <button
                  type="button"
                  className={`btn-outline orders-header-refresh production-topbar-btn production-menu-trigger${productionMenuOpen ? " is-open" : ""}`}
                  onClick={() => setProductionMenuOpen(open => !open)}
                  aria-expanded={productionMenuOpen}
                  aria-haspopup="menu"
                  title="Cambiar vista de producción"
                >
                  {(() => {
                    const activeOption = visibleSubmenuOptions.find(item => item.key === submenu) || visibleSubmenuOptions[0] || SUBMENU_OPTIONS[0];
                    const ActiveIcon = PRODUCTION_SUBMENU_ICONS[activeOption.key] || ClipboardList;
                    return (
                      <>
                        <ActiveIcon size={18} strokeWidth={2} />
                        <span>{activeOption.label}</span>
                        <ChevronDown size={16} strokeWidth={2} className="production-menu-chevron" />
                      </>
                    );
                  })()}
                </button>

                {productionMenuOpen ? (
                  <div className="production-menu-panel" role="menu" onClick={() => setProductionMenuOpen(false)}>
                    {visibleSubmenuOptions.map(item => {
                      const ItemIcon = PRODUCTION_SUBMENU_ICONS[item.key] || ClipboardList;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`production-menu-option${submenu === item.key ? " is-active" : ""}`}
                          onClick={() => {
                            setSubmenu(item.key);
                            setProductionMenuOpen(false);
                          }}
                          role="menuitem"
                        >
                          <span className="production-menu-option-icon"><ItemIcon size={17} strokeWidth={2} /></span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn-primary orders-header-refresh production-topbar-btn production-topbar-btn-primary" title="Recargar vista" onClick={refreshAll}>
                <RotateCw size={18} strokeWidth={2} />
                <span>Actualizar</span>
              </button>
            </div>
            <div className="orders-header-metrics production-header-metrics" aria-label="Indicadores de producción">
              <button type="button" className="orders-header-metric-card is-primary" onClick={() => focusMetric(null)}>
                <span className="orders-header-metric-icon" aria-hidden="true"><ListChecks size={18} strokeWidth={2} /></span>
                <strong>{metrics.total}</strong>
                <span>Visibles</span>
              </button>
              <button type="button" className={`orders-header-metric-card is-green ${activeMetricFilter === "pendientesHoy" ? "is-active" : ""}`} onClick={() => focusMetric("pendientesHoy")}>
                <span className="orders-header-metric-icon" aria-hidden="true"><CalendarCheck2 size={18} strokeWidth={2} /></span>
                <strong>{metrics.pendientesHoy}</strong>
                <span>Pendientes hoy</span>
              </button>
              <button type="button" className={`orders-header-metric-card is-blue ${metrics.sinAsignar > 0 ? "is-warning" : ""} ${activeMetricFilter === "sinAsignar" ? "is-active" : ""}`} onClick={() => focusMetric("sinAsignar")}>
                <span className="orders-header-metric-icon" aria-hidden="true"><UserX size={18} strokeWidth={2} /></span>
                <strong>{metrics.sinAsignar}</strong>
                <span>Sin asignar</span>
              </button>
              <button type="button" className={`orders-header-metric-card is-orange ${metrics.atrasados > 0 ? "is-danger" : ""} ${activeMetricFilter === "atrasados" ? "is-active" : ""}`} onClick={() => focusMetric("atrasados")}>
                <span className="orders-header-metric-icon" aria-hidden="true"><TriangleAlert size={18} strokeWidth={2} /></span>
                <strong>{metrics.atrasados}</strong>
                <span>Atrasados</span>
              </button>
              <button type="button" className={`orders-header-metric-card is-purple ${metrics.pendientesFuturos > 0 ? "is-warning" : ""} ${activeMetricFilter === "pendientesFuturos" ? "is-active" : ""}`} onClick={() => focusMetric("pendientesFuturos")}>
                <span className="orders-header-metric-icon" aria-hidden="true"><CalendarClock size={18} strokeWidth={2} /></span>
                <strong>{metrics.pendientesFuturos}</strong>
                <span>Futuros</span>
              </button>
            </div>
          </div>
        </header>

        <span ref={productionListRef} className="production-list-anchor" aria-hidden="true" />

        {submenu === "pedidos" && (
          <>
            <section className="production-mobile-workspace" aria-label="Producción móvil">
              <div className="production-mobile-hero">
                <div className="production-mobile-title-block">
                  <h1>Producción</h1>
                  <span>
                    <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
                    Hoy, {productionHeaderDateLabel()}
                  </span>
                </div>
                <button type="button" className="production-mobile-refresh" title="Recargar vista" onClick={refreshAll}>
                  <RotateCw size={20} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>

              <label className="production-mobile-search" aria-label="Buscar producción">
                <Search size={19} strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={busquedaGeneral}
                  onChange={event => {
                    setActiveMetricFilter(null);
                    setBusquedaGeneral(event.target.value);
                  }}
                  placeholder="Buscar pedido, cliente..."
                  title="Buscar por florista, cliente o número de pedido"
                />
              </label>

              <div className="production-mobile-kpis" aria-label="Indicadores de producción">
                <button type="button" className={`production-mobile-kpi${activeMetricFilter == null ? " is-active" : ""}`} onClick={() => focusMetric(null)}>
                  <strong>{metrics.total}</strong>
                  <span>Visibles</span>
                </button>
                <button type="button" className={`production-mobile-kpi${activeMetricFilter === "pendientesHoy" ? " is-active" : ""}`} onClick={() => focusMetric("pendientesHoy")}>
                  <strong>{metrics.pendientesHoy}</strong>
                  <span>Pendientes</span>
                </button>
                <button type="button" className={`production-mobile-kpi${activeMetricFilter === "sinAsignar" ? " is-active" : ""}`} onClick={() => focusMetric("sinAsignar")}>
                  <strong>{metrics.sinAsignar}</strong>
                  <span>Sin asignar</span>
                </button>
              </div>

              <div className="production-mobile-status-tabs" aria-label="Filtrar por estado de producción">
                <button
                  type="button"
                  className={`production-mobile-status is-all${selectedStatusKey === "todos" ? " is-active" : ""}`}
                  onClick={selectAllProductionStatuses}
                >
                  Todos
                </button>
                {ESTADOS_UI.map(item => (
                  <button
                    key={item}
                    type="button"
                    className={`production-mobile-status ${productionStatusChipClass(item)}${selectedStatusKey === normalizeStatus(item).replace(/_/g, "") ? " is-active" : ""}`}
                    onClick={() => toggleEstadoFiltro(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="production-mobile-counts" aria-live="polite">
                <span><strong>{productionTotal}</strong> visibles</span>
                <span><strong>{metrics.pendientesHoy}</strong> pendientes</span>
                <span><strong>{metrics.sinAsignar}</strong> sin asignar</span>
              </div>

              {error ? <p className="production-mobile-message">{error}</p> : null}
              {loading ? <p className="production-mobile-message">Cargando producción...</p> : null}
              {!loading && !error && focusedVisibleItems.length === 0 ? (
                <p className="production-mobile-message">No hay arreglos que coincidan con los filtros seleccionados.</p>
              ) : null}

              {!loading && !error && paginatedProductionItems.length > 0 ? (
                <div className="production-mobile-list" aria-label="Pedidos de producción">
                  {paginatedProductionItems.map(item => {
                    const timing = deliveryTimingStatus(item);
                    const productPreview = resolveProductionProduct(item, catalogProductIndex, {
                      preferCatalogCode: shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId),
                      allowDirectImage: true,
                    });
                    const productImageSrc = resolveImageSrc(resolveProductionDisplayImageUrl(item, catalogProductIndex, productionProductImages, empresaId), tenantConfig.apiBaseUrl);
                    return (
                      <article key={`mobile-${item.idProduccion}`} className={`production-mobile-card ${!hasAssignedFlorista(item) ? "is-unassigned" : ""}`}>
                        <div className="production-mobile-card-top">
                          <strong>Pedido #{item.numeroPedido ?? "-"}</strong>
                          <span>{item.horaEntrega || "-"}</span>
                        </div>
                        <div className="production-mobile-card-body">
                          {productImageSrc ? (
                            <img src={productImageSrc} alt="" loading="lazy" />
                          ) : (
                            <span className="production-mobile-product-fallback">{productInitials(productPreview.name || item.producto)}</span>
                          )}
                          <div>
                            <strong>{item.cliente || "-"}</strong>
                            <span>{productPreview.name || item.producto || "-"} x {item.cantidadProducciones || 1}</span>
                            <small>{item.floristaAsignado || "Sin asignar"}</small>
                          </div>
                        </div>
                        <div className="production-mobile-card-meta">
                          <span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
                          <span className={`production-timing-badge ${timing.className}`}>{timing.label}</span>
                        </div>
                        <div className="production-mobile-card-actions">
                          {canManageProductionActions || canFloristaQuickState ? (
                            <button type="button" onClick={() => openAssignmentDrawer(item)}>Asignar</button>
                          ) : null}
                          <button type="button" onClick={() => openActionsDrawer(item)}>Ver detalle</button>
                          {canManageStateActions && shouldShowFloristaStateAction(item.estado) ? (
                            <button
                              type="button"
                              title={hasAssignedFlorista(item) ? "Actualizar estado de producción" : "Asigna un florista antes de cambiar estado"}
                              onClick={hasAssignedFlorista(item) && nextFloristaStatus(item.estado) ? () => cambiarEstadoAdminRapido(item) : undefined}
                              disabled={!hasAssignedFlorista(item) || !nextFloristaStatus(item.estado)}
                            >
                              {nextFloristaLabel(item.estado) || "Listo"}
                            </button>
                          ) : null}
                          {canFloristaQuickState && (canChangeOwnProductionState(item) || isProductionReadyForDelivery(item.estado)) && shouldShowFloristaStateAction(item.estado) ? (
                            <button
                              type="button"
                              onClick={nextFloristaStatus(item.estado) ? () => cambiarEstadoFloristaRapido(item) : undefined}
                              disabled={!nextFloristaStatus(item.estado)}
                            >
                              {nextFloristaLabel(item.estado) || "Listo"}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}

              <footer className="production-mobile-pager" aria-label="Paginación móvil de producción">
                <span>Mostrando {productionVisibleFrom} a {productionVisibleTo} de {productionTotal}</span>
                <div>
                  <button type="button" onClick={() => setProductionPage(current => Math.max(1, current - 1))} disabled={productionPage <= 1}>
                    <ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                  <strong>{productionPage}</strong>
                  <button type="button" onClick={() => setProductionPage(current => Math.min(productionPages, current + 1))} disabled={productionPage >= productionPages}>
                    <ChevronRight size={17} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </div>
              </footer>
            </section>

            <section className="orders-filters orders-filters--four-col production-filters-bar">
              <div className="filter-field production-filter-field">
                <span>Fecha Inicio</span>
                <div className="production-filter-control">
                  <CalendarDays size={17} strokeWidth={2} aria-hidden="true" />
                  <input
                    type="date"
                    value={fecha}
                    onChange={event => {
                      setActiveMetricFilter(null);
                      setFecha(event.target.value);
                    }}
                    title="Filtrar por fecha programada"
                  />
                </div>
              </div>
              <div className="filter-field production-filter-field production-status-filter">
                <span>Estado</span>
                <div className="orders-status-chips production-status-chips" aria-label="Filtrar por estado de producción">
                  <button
                    type="button"
                    className={`orders-status-chip production-status-chip is-all${selectedStatusKey === "todos" ? " is-active" : ""}`}
                    onClick={selectAllProductionStatuses}
                  >
                    <span aria-hidden="true" />
                    Todos
                  </button>
                  {ESTADOS_UI.map(item => (
                    <button
                      key={item}
                      type="button"
                      className={`orders-status-chip production-status-chip ${productionStatusChipClass(item)}${selectedStatusKey === normalizeStatus(item).replace(/_/g, "") ? " is-active" : ""}`}
                      onClick={() => toggleEstadoFiltro(item)}
                    >
                      <span aria-hidden="true" />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              {currentFloristaId != null ? (
                <label className="filter-field">
                  <span>Asignación propia</span>
                  <div className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={soloMisAsignados}
                      onChange={event => onChangeSoloMisAsignados(event.target.checked)}
                    />
                    <span>Solo mis pedidos asignados</span>
                  </div>
                </label>
              ) : null}
              {canFloristaQuickState ? (
                <div className="production-florista-inline" aria-label="Estado de florista">
                  <span>Estado de florista</span>
                  <button
                    type="button"
                    className={`production-florista-toggle ${isFloristaActivo(ownFloristaDisponibilidad) ? "is-active" : "is-inactive"}`}
                    onClick={toggleEstadoFloristaPropio}
                    aria-pressed={isFloristaActivo(ownFloristaDisponibilidad)}
                    title="Cambiar disponibilidad del florista"
                  >
                    <span aria-hidden="true" />
                    <strong>{isFloristaActivo(ownFloristaDisponibilidad) ? "Activo" : "Inactivo"}</strong>
                  </button>
                </div>
              ) : null}
            </section>

            {error && <p className="orders-message">{error}</p>}
            {loading && <p className="orders-message">Cargando producción...</p>}
            {!loading && !error && focusedVisibleItems.length === 0 ? <p className="orders-message">No hay arreglos que coincidan con los filtros seleccionados.</p> : null}

            <section className="orders-table-wrap production-table-wrap production-table-shell">
              <table className="orders-table production-orders-table">
                <thead>
                  <tr>
                    <th>N° Pedido</th>
                    <th>Producto · Cliente</th>
                    <th>Fecha + Hora entrega</th>
                    <th>Florista Asignado</th>
                    <th>Estado</th>
                    <th>Estado tiempo</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProductionItems.map(item => {
                    const timing = deliveryTimingStatus(item);
                    const productPreview = resolveProductionProduct(item, catalogProductIndex, {
                      preferCatalogCode: shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId),
                      allowDirectImage: true,
                    });
                    const productImageSrc = resolveImageSrc(resolveProductionDisplayImageUrl(item, catalogProductIndex, productionProductImages, empresaId), tenantConfig.apiBaseUrl);
                    const programmedDate = resolveProgrammedDate(item);
                    const rowStateClasses = [
                      "production-row-card",
                      !hasAssignedFlorista(item) ? "production-row-unassigned" : "",
                      timing.className === "is-late" ? "production-row-late" : "",
                      timing.className === "is-on-time" ? "production-row-on-time" : "",
                      programmedDate && programmedDate > todayIsoDate() ? "production-row-future" : "",
                    ].filter(Boolean).join(" ");
                    return (
                    <tr key={item.idProduccion} className={rowStateClasses}>
                      <td>
                        <span className="production-order-badge">#{item.numeroPedido ?? "-"}</span>
                      </td>
                      <td>
                        <div className="production-product-preview">
                          <span className="production-product-thumb" aria-hidden="true">
                            {productImageSrc ? (
                              <img src={productImageSrc} alt="" loading="lazy" />
                            ) : (
                              <span>{productInitials(productPreview.name || item.producto)}</span>
                            )}
                          </span>
                          <div className="production-product-customer">
                            <strong>
                              {productPreview.name || item.producto || "-"}
                              <span className="production-product-qty"> x {item.cantidadProducciones || 1}</span>
                            </strong>
                            <span>{item.cliente || "-"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="production-delivery-stack">
                          <strong>{formatDateOnly(item.fechaEntrega) || "-"}</strong>
                          <span>{item.horaEntrega || "-"}</span>
                        </div>
                      </td>
                      <td>
                        {item.floristaAsignado ? (
                          <span className="production-florista-name">
                            <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(item.floristaAsignado)}</span>
                            <span>{item.floristaAsignado}</span>
                          </span>
                        ) : (
                          <span className="production-florista-empty">
                            <span className="production-florista-avatar" aria-hidden="true">SA</span>
                            <span>Sin asignar</span>
                          </span>
                        )}
                      </td>
                      <td><span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span></td>
                      <td>
                        <div className="production-time-stack">
                          <span className={`production-timing-badge ${timing.className}`}>{timing.label}</span>
                        </div>
                      </td>
                      <td>
                        <div className="production-row-actions production-row-actions--florista" aria-label="Acciones de producción">
                          {canManageStateActions && shouldShowFloristaStateAction(item.estado) ? (
                            <button
                              type="button"
                              className={`production-icon-action production-icon-action--state ${productionStateActionClass(item.estado)}`}
                              title={hasAssignedFlorista(item) ? (nextFloristaStatus(item.estado) ? "Actualizar estado de producción" : "Pedido listo para entrega") : "Asigna un florista antes de cambiar estado"}
                              aria-label={nextFloristaLabel(item.estado) || "Pedido listo para entrega"}
                              onClick={hasAssignedFlorista(item) && nextFloristaStatus(item.estado) ? () => cambiarEstadoAdminRapido(item) : undefined}
                              disabled={!hasAssignedFlorista(item) || !nextFloristaStatus(item.estado)}
                            >
                              <CirclePlay size={18} strokeWidth={2} aria-hidden="true" />
                              <span className="production-action-label">{nextFloristaLabel(item.estado) || "Listo"}</span>
                            </button>
                          ) : null}
                          {canFloristaQuickState && (canChangeOwnProductionState(item) || isProductionReadyForDelivery(item.estado)) && shouldShowFloristaStateAction(item.estado) ? (
                            <button
                              type="button"
                              className={`production-icon-action production-icon-action--state ${productionStateActionClass(item.estado)}`}
                              title={nextFloristaStatus(item.estado) ? "Actualizar estado de producción" : "Pedido listo para entrega"}
                              aria-label={nextFloristaLabel(item.estado) || "Pedido listo para entrega"}
                              onClick={nextFloristaStatus(item.estado) ? () => cambiarEstadoFloristaRapido(item) : undefined}
                              disabled={!nextFloristaStatus(item.estado)}
                            >
                              <CirclePlay size={18} strokeWidth={2} aria-hidden="true" />
                              <span className="production-action-label">{nextFloristaLabel(item.estado) || "Listo"}</span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="production-icon-action production-icon-action--detail"
                            title="Ver detalle del arreglo"
                            aria-label="Ver detalle del arreglo"
                            onClick={() => openActionsDrawer(item)}
                          >
                            <Eye size={18} strokeWidth={2} aria-hidden="true" />
                            <span className="production-action-label">Ver detalle</span>
                          </button>
                          {canManageProductionActions || canFloristaQuickState ? (
                            <button
                              type="button"
                              className="production-icon-action production-icon-action--assign"
                              title="Asignar / reasignar florista"
                              aria-label="Asignar / reasignar florista"
                              onClick={() => openAssignmentDrawer(item)}
                            >
                              <User size={18} strokeWidth={2} aria-hidden="true" />
                              <span className="production-action-label">Asignar</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </section>

            <footer className="records-pager production-records-pager" aria-label="Paginación de producción">
              <p>Mostrando {productionVisibleFrom} a {productionVisibleTo} de {productionTotal} pedidos</p>
              <nav className="records-pager-pages" aria-label="Páginas de producción">
                <button
                  type="button"
                  className="records-pager-arrow"
                  title="Ir a la página anterior"
                  onClick={() => setProductionPage(current => Math.max(1, current - 1))}
                  disabled={productionPage <= 1}
                >
                  <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {productionPagerItems.map(item => (
                  typeof item === "number" ? (
                    <button
                      key={item}
                      type="button"
                      className={`records-pager-page${item === productionPage ? " is-active" : ""}`}
                      onClick={() => setProductionPage(item)}
                      aria-current={item === productionPage ? "page" : undefined}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="records-pager-ellipsis">...</span>
                  )
                ))}
                <button
                  type="button"
                  className="records-pager-arrow"
                  title="Ir a la página siguiente"
                  onClick={() => setProductionPage(current => Math.min(productionPages, current + 1))}
                  disabled={productionPage >= productionPages}
                >
                  <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </nav>
              <label className="records-pager-size">
                <span>Mostrar</span>
                <select
                  value={productionPageSize}
                  onChange={event => setProductionPageSize(Number(event.target.value))}
                  title="Registros por página"
                >
                  {PAGE_SIZE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <span>por página</span>
              </label>
            </footer>

            <section className="production-capsules" aria-label="Pedidos en cápsulas">
              {paginatedProductionItems.map(item => {
                const productPreview = resolveProductionProduct(item, catalogProductIndex, {
                  preferCatalogCode: shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId),
                  allowDirectImage: true,
                });
                const productImageSrc = resolveImageSrc(resolveProductionDisplayImageUrl(item, catalogProductIndex, productionProductImages, empresaId), tenantConfig.apiBaseUrl);
                const timing = deliveryTimingStatus(item);
                return (
                <article key={`cap-${item.idProduccion}`} className={`production-capsule ${!hasAssignedFlorista(item) ? "production-capsule-unassigned" : ""}`}>
                  <header className="production-capsule-head">
                    <strong>{item.numeroPedido ?? "-"}</strong>
                    <span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
                  </header>

                  <div className="production-capsule-grid">
                    <p className="production-capsule-product-row">
                      <span>Producto</span>
                      <strong className="production-product-preview">
                        <span className="production-product-thumb" aria-hidden="true">
                          {productImageSrc ? (
                            <img src={productImageSrc} alt="" loading="lazy" />
                          ) : (
                            <span>{productInitials(productPreview.name || item.producto)}</span>
                          )}
                        </span>
                        <span>{productPreview.name || item.producto || "-"}</span>
                      </strong>
                    </p>
                    <p><span>Cliente</span><strong>{item.cliente || "-"}</strong></p>
                    <p><span>Fecha entrega</span><strong>{formatDateOnly(item.fechaEntrega) || "-"}</strong></p>
                    <p><span>Hora entrega</span><strong>{item.horaEntrega || "-"}</strong></p>
                    <p>
                      <span>Florista</span>
                      <strong className="production-capsule-florista">
                        <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(item.floristaAsignado)}</span>
                        <span>{item.floristaAsignado || "Sin asignar"}</span>
                      </strong>
                    </p>
                    <p><span>Asignación</span><strong>{formatDateTimeBogotaFromUtc(item.fechaAsignacion) || "-"}</strong></p>
                    <p><span>Estado tiempo</span><strong><span className={`production-timing-badge ${timing.className}`}>{timing.label}</span></strong></p>
                  </div>

                  <div className="production-capsule-actions">
                    <div className="production-row-actions production-row-actions--florista" aria-label="Acciones de producción">
                      {canManageStateActions && shouldShowFloristaStateAction(item.estado) ? (
                        <button
                          type="button"
                          className={`production-icon-action production-icon-action--state ${productionStateActionClass(item.estado)}`}
                          title={hasAssignedFlorista(item) ? (nextFloristaStatus(item.estado) ? "Actualizar estado de producción" : "Pedido listo para entrega") : "Asigna un florista antes de cambiar estado"}
                          aria-label={nextFloristaLabel(item.estado) || "Pedido listo para entrega"}
                          onClick={hasAssignedFlorista(item) && nextFloristaStatus(item.estado) ? () => cambiarEstadoAdminRapido(item) : undefined}
                          disabled={!hasAssignedFlorista(item) || !nextFloristaStatus(item.estado)}
                        >
                          <CirclePlay size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      ) : null}
                      {canFloristaQuickState && (canChangeOwnProductionState(item) || isProductionReadyForDelivery(item.estado)) && shouldShowFloristaStateAction(item.estado) ? (
                        <button
                          type="button"
                          className={`production-icon-action production-icon-action--state ${productionStateActionClass(item.estado)}`}
                          title={nextFloristaStatus(item.estado) ? "Actualizar estado de producción" : "Pedido listo para entrega"}
                          aria-label={nextFloristaLabel(item.estado) || "Pedido listo para entrega"}
                          onClick={nextFloristaStatus(item.estado) ? () => cambiarEstadoFloristaRapido(item) : undefined}
                          disabled={!nextFloristaStatus(item.estado)}
                        >
                          <CirclePlay size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="production-icon-action production-icon-action--detail"
                        title="Ver detalle del arreglo"
                        aria-label="Ver detalle del arreglo"
                        onClick={() => openActionsDrawer(item)}
                      >
                        <Eye size={18} strokeWidth={2} aria-hidden="true" />
                      </button>
                      {canManageProductionActions || canFloristaQuickState ? (
                        <button
                          type="button"
                          className="production-icon-action production-icon-action--assign"
                          title="Asignar / reasignar florista"
                          aria-label="Asignar / reasignar florista"
                          onClick={() => openAssignmentDrawer(item)}
                        >
                          <User size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
              })}
            </section>
          </>
        )}

        {canViewProduccion && submenu === "disponibilidad" && (
          <section className="order-block production-section-card production-availability-panel">
            <div className="production-section-head production-section-head--stack">
              <div>
                <h4>Disponibilidad florista</h4>
                <p className="production-section-copy">Floristas internos numerados por la sucursal actual. Los demás aparecen como externos.</p>
              </div>
            </div>

            <div className="production-availability-grid production-availability-grid--compact floristas-grid">
              {floristasDisponibilidad.length === 0 ? (
                <p className="orders-message" style={{ marginBottom: 0 }}>No hay floristas disponibles para mostrar.</p>
              ) : floristasDisponibilidad.map(item => {
                const estaActivo = isFloristaActivo(item);
                const identificador = item.esExterno ? "Externo" : `#${item.numeroFlorista ?? "-"}`;
                const capacidad = Number(item.capacidadDiaria || 0);
                const carga = Number(item.arreglosHoy || 0);
                const capacidadPct = capacidad > 0 ? Math.min(100, Math.round((carga / capacidad) * 100)) : 0;
                return (
                  <article key={item.idFlorista} className={`production-availability-card ${item.esExterno ? "is-external" : ""}`}>
                    <div className="production-availability-head">
                      <div>
                        <p className="production-availability-id">{identificador}</p>
                        <strong>{item.nombre}</strong>
                      </div>
                      <span className={`production-availability-status ${estaActivo ? "is-active" : "is-inactive"}`}>
                        {estaActivo ? "Activo" : "Inactivo"}
                      </span>
                    </div>

                    <div className="production-availability-meta">
                      <p><span>Arreglos del día</span><strong>{item.arreglosHoy ?? 0}</strong></p>
                      <p><span>Capacidad diaria</span><strong>{item.capacidadDiaria ?? 0}</strong></p>
                      <p><span>Tipo</span><strong>{item.esExterno ? "Externo" : "Interno"}</strong></p>
                    </div>

                    <div className="production-capacity-block">
                      <div className="production-capacity-bar">
                        <div className="production-capacity-fill" style={{ width: `${capacidadPct}%` }} />
                      </div>
                      <span>{carga} / {capacidad || 0}</span>
                    </div>

                    <div className="production-inline-actions">
                      <button
                        type="button"
                        className={`btn-outline production-availability-toggle ${estaActivo ? "is-inactivate" : "is-activate"}`}
                        onClick={() => toggleDisponibilidadFlorista(item)}
                      >
                        {estaActivo ? "Inactivar" : "Activar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {canViewProduccion && submenu === "incapacidad" && (
          <section className="order-block production-section-card production-incapacity-panel">
            <div className="production-section-head">
              <div>
                <h4>Gestión incapacidad</h4>
                <p className="production-section-copy">Registra rangos de incapacidad y controla el estado operativo del florista.</p>
              </div>
              <button type="button" className="btn-primary production-register-btn" onClick={actualizarEstadoFlorista} title="Registrar incapacidad o aplicar cambio">
                <IconCalendarPlus size={15} stroke={2} />
                <span>Registrar incapacidad</span>
              </button>
            </div>

            <div className="production-incapacity-form">
              <select value={floristaGestionID} onChange={event => setFloristaGestionID(event.target.value)} title="Seleccionar florista">
                <option value="">Florista...</option>
                {floristas.map(f => <option key={f.idFlorista} value={f.idFlorista}>{f.nombre}</option>)}
              </select>
              <select value={floristaEstado} onChange={event => setFloristaEstado(event.target.value)} title="Estado del florista">
                {ESTADOS_FLORISTA.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <input type="date" value={fechaInicioIncapacidad} onChange={event => setFechaInicioIncapacidad(event.target.value)} title="Inicio incapacidad" />
              <input type="date" value={fechaFinIncapacidad} onChange={event => setFechaFinIncapacidad(event.target.value)} title="Fin incapacidad" />
              <input type="text" value={motivoAccion} onChange={event => setMotivoAccion(event.target.value)} placeholder="Motivo" title="Motivo de cambio" />
              <div className="production-incapacity-actions">
                <button type="button" className="btn-primary" onClick={actualizarEstadoFlorista} title="Guardar incapacidad o cambio de estado">Guardar</button>
                <button type="button" className="btn-outline" onClick={() => setMotivoAccion("")} title="Limpiar motivo">Cancelar</button>
              </div>
            </div>

            <div className="production-incapacity-list">
              {floristasDisponibilidad.map(item => {
                const inicio = formatDateOnly(item.fechaInicioIncapacidad || item.fecha_ini_incap) || "-";
                const fin = formatDateOnly(item.fechaFinIncapacidad || item.fecha_fin_incap) || "-";
                const estado = String(item.estado || "").toLowerCase() === "incapacidad" ? "Activa" : "Vencida";
                return (
                  <article key={`inc-${item.idFlorista}`} className="production-incapacity-item">
                    <div>
                      <strong>{item.nombre}</strong>
                      <p>{inicio} - {fin}</p>
                      <small>{item.motivoIncapacidad || item.motivo || "Sin motivo registrado"}</small>
                    </div>
                    <span className={`production-incapacity-badge ${estado === "Activa" ? "is-active" : "is-expired"}`}>{estado}</span>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {canViewProduccion && submenu === "looker" && (
          <section className="order-block looker-block" style={{ marginTop: 12 }}>
            <div className="looker-header">
              <h4> Looker Studio</h4>
              <a
                href={LOOKER_STUDIO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-outline looker-open-link"
                title="Abrir tablero en nueva pestaña"
              >
                Abrir en nueva pestaña
              </a>
            </div>

            <p className="orders-admin-subtitle looker-subtitle">
              Vista embebida del tablero operativo de Producción.
            </p>

            <div className="looker-frame-wrap">
              <iframe
                className="looker-frame"
                src={LOOKER_STUDIO_URL}
                title="Looker Studio - Producción"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                allowFullScreen
              />
            </div>
          </section>
        )}
      </main>

      <div className={`production-drawer-backdrop ${(drawerOpen || assignmentDrawerOpen) && submenu === "pedidos" ? "open" : ""}`} aria-hidden="true" />

      <aside className={`orders-drawer production-actions-drawer ${drawerOpen && submenu === "pedidos" ? "open" : ""}`}>
        <div className="orders-drawer-head production-detail-head">
          <div className="production-detail-head-copy">
            <span className="production-detail-eyebrow">Ficha operativa</span>
            <strong className="orders-drawer-title production-detail-title">
              Pedido #{selectedItem?.numeroPedido ?? "-"}
            </strong>
            {selectedItem ? (
              <span className={`order-badge production-detail-status ${productionStatusBadgeClass(selectedItem)}`}>{selectedItem.estado || "-"}</span>
            ) : null}
            {selectedItem ? (
              <p className="production-detail-product">{selectedItem.nombreArreglo || selectedItem.producto || "-"}</p>
            ) : null}
          </div>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeActionsDrawer} title="Cerrar barra lateral">
              <IconX size={18} stroke={2} />
            </button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!drawerOpen || !selectedItem ? (
            <p className="order-drawer-empty">Selecciona un pedido para ver acciones.</p>
          ) : (
            <>
              {(() => {
                const productPreview = resolveProductionProduct(selectedItem, catalogProductIndex, {
                  preferCatalogCode: shouldUseCatalogCodeForProduction() || isEmpresaCatalogCode(empresaId),
                  allowDirectImage: true,
                });
                const productImageSrc = resolveImageSrc(resolveProductionDisplayImageUrl(selectedItem, catalogProductIndex, productionProductImages, empresaId), tenantConfig.apiBaseUrl);
                return (
                  <section className="production-detail-product-hero" aria-label="Imagen del arreglo">
                    <div className="production-detail-product-photo">
                      {productImageSrc ? (
                        <img src={productImageSrc} alt="" loading="lazy" />
                      ) : (
                        <span>{productInitials(productPreview.name || selectedItem.producto)}</span>
                      )}
                    </div>
                    <div className="production-detail-product-hero-copy">
                      <span>Arreglo</span>
                      <strong>{productPreview.name || selectedItem.nombreArreglo || selectedItem.producto || "-"}</strong>
                      <small>{arregloCodeLabel(selectedItem)}</small>
                    </div>
                  </section>
                );
              })()}

              <section className="production-detail-grid" aria-label="Detalle operativo del pedido">
                <article className="production-detail-card">
                  <span className="production-detail-card-icon"><User size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <div>
                    <span className="production-detail-card-label">Cliente</span>
                    <strong>{selectedItem.cliente || "-"}</strong>
                  </div>
                </article>

                <article className="production-detail-card">
                  <span className="production-detail-card-icon"><CalendarDays size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <div>
                    <span className="production-detail-card-label">Entrega</span>
                    <strong>{formatDateOnly(selectedItem.fechaEntrega) || "-"}</strong>
                    <small>{selectedItem.horaEntrega || "-"}</small>
                  </div>
                </article>

                <article className="production-detail-card">
                  <span className="production-detail-card-icon"><Flower2 size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <div>
                    <span className="production-detail-card-label">Producción</span>
                    <strong>{selectedItem.estado || "-"}</strong>
                    <small>{selectedItem.floristaAsignado || "Sin asignar"}</small>
                  </div>
                </article>

                <article className="production-detail-card">
                  <span className="production-detail-card-icon"><FileText size={18} strokeWidth={2} aria-hidden="true" /></span>
                  <div>
                    <span className="production-detail-card-label">Código arreglo</span>
                    <strong>{arregloCodeLabel(selectedItem)}</strong>
                  </div>
                </article>
              </section>

              <section className="production-detail-notes-card">
                <div className="production-detail-section-title">
                  <FileText size={17} strokeWidth={2} aria-hidden="true" />
                  <strong>Observaciones</strong>
                </div>
                <p>{selectedItem.notasProduccion || selectedItem.observacion || "Sin notas de producción."}</p>
                <small>{selectedItem.observacionesPersonalizados || "Sin observaciones personalizadas."}</small>
              </section>

              {canManageProductionActions ? (
              <section className="order-block production-action-card production-assignment-card">
                <div className="production-detail-section-title">
                  <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
                  <strong>Asignación de florista</strong>
                </div>
                <div className="production-assignment-profile">
                  <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(selectedItem.floristaAsignado)}</span>
                  <div>
                    <strong>{selectedItem.floristaAsignado || "Sin asignar"}</strong>
                    <span>{selectedItem.floristaAsignado ? "Asignado" : "Pendiente de asignación"}</span>
                  </div>
                </div>
                <div className="order-actions production-drawer-actions">
                  <select
                    value={selectedFloristaById[productionSelectionKey(selectedItem)] || ""}
                    onChange={event => setSelectedFloristaById(current => ({ ...current, [productionSelectionKey(selectedItem)]: event.target.value }))}
                    title="Seleccionar florista"
                  >
                    <option value="">Auto</option>
                    {floristas.map(florista => (
                      <option
                        key={florista.idFlorista}
                        value={florista.idFlorista}
                        disabled={!isFloristaActivo(florista)}
                      >
                        {florista.nombre}{isFloristaActivo(florista) ? "" : " (Inactivo)"}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-primary" title="Asignar florista" onClick={() => asignar(selectedItem)}>Asignar</button>
                  <button type="button" className="btn-outline" title="Reasignar florista" onClick={() => reasignarAuditable(selectedItem)}>Reasignar</button>
                </div>
              </section>
              ) : null}

              {canManageStateActions || canRecalculateProduction ? (
                <>
                  {canManageStateActions ? (
                    <section className="order-block">
                      <h4> Estado</h4>
                      <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select
                          value={selectedEstadoById[productionSelectionKey(selectedItem)] || ""}
                          onChange={event => setSelectedEstadoById(current => ({ ...current, [productionSelectionKey(selectedItem)]: event.target.value }))}
                          title="Seleccionar nuevo estado"
                        >
                          <option value="">Estado...</option>
                          {validNextStatesForManualChange(selectedItem.estado).map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                        <button type="button" className="btn-outline" title="Aplicar cambio de estado" onClick={() => cambiarEstado(selectedItem)}>Cambiar estado</button>
                      </div>
                    </section>
                  ) : null}

                  {canRecalculateProduction ? (
                    <section className="order-block">
                      <h4>ï¸ Recalcular pedido</h4>
                      <button type="button" className="btn-outline" title="Recalcular impacto del pedido" onClick={() => recalcularPedido(selectedItem)}>
                        Recalcular producción
                      </button>
                    </section>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </aside>

      <aside className={`orders-drawer production-actions-drawer production-assignment-drawer ${assignmentDrawerOpen && submenu === "pedidos" ? "open" : ""}`}>
        <div className="orders-drawer-head production-detail-head">
          <div className="production-detail-head-copy">
            <span className="production-detail-eyebrow">Acción independiente</span>
            <strong className="orders-drawer-title production-detail-title">Asignar / reasignar florista</strong>
            {assignmentItem ? (
              <p className="production-detail-product">
                Pedido #{assignmentItem.numeroPedido ?? "-"} · {assignmentItem.nombreArreglo || assignmentItem.producto || "-"}
              </p>
            ) : null}
          </div>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeAssignmentDrawer} title="Cerrar asignación">
              <IconX size={18} stroke={2} />
            </button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!assignmentDrawerOpen || !assignmentItem ? (
            <p className="order-drawer-empty">Selecciona un pedido para asignar florista.</p>
          ) : (
            <section className="order-block production-action-card production-assignment-card">
              <div className="production-detail-section-title">
                <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
                <strong>Asignación de florista</strong>
              </div>
              <div className="production-assignment-profile">
                <span className="production-florista-avatar" aria-hidden="true">{initialsFromName(assignmentItem.floristaAsignado)}</span>
                <div>
                  <strong>{assignmentItem.floristaAsignado || "Sin asignar"}</strong>
                  <span>{assignmentItem.floristaAsignado ? "Asignado" : "Pendiente de asignación"}</span>
                </div>
              </div>
              <div className="order-actions production-drawer-actions">
                <select
                  value={selectedFloristaById[productionSelectionKey(assignmentItem)] || ""}
                  onChange={event => setSelectedFloristaById(current => ({ ...current, [productionSelectionKey(assignmentItem)]: event.target.value }))}
                  title="Seleccionar florista"
                >
                  <option value="">Selecciona florista</option>
                  {floristas.map(florista => (
                    <option
                      key={florista.idFlorista}
                      value={florista.idFlorista}
                      disabled={!isFloristaActivo(florista)}
                    >
                      {florista.nombre}{isFloristaActivo(florista) ? "" : " (Inactivo)"}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-outline" title="Asignar o reasignar florista" onClick={() => reasignarAuditable(assignmentItem)}>
                  Asignar / reasignar
                </button>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}



