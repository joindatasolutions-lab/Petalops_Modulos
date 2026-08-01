/*
 * Reglas puras del dominio de produccion.
 * Normaliza estados, fechas, busquedas, codigos, metricas y clases derivadas.
 * No debe depender de React ni ejecutar llamadas a API.
 */
import { formatDateOnly, formatDateTimeCompact, normalizeStatus } from "../../shared/utils.js";

export const ESTADOS_UI = ["Pendiente", "EnProduccion", "ParaEntrega", "Cancelado"];

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  ENPRODUCCION: "is-produccion",
  PARAENTREGA: "is-entrega",
  ENTREGADO: "is-entregado",
  CANCELADO: "is-rechazado",
  RECHAZADO: "is-rechazado",
};

const COLOMBIA_UTC_OFFSET_MINUTES = -5 * 60;

const PRODUCTION_STATUS_CHIP_CLASS = {
  PENDIENTE: "is-pending",
  ENPRODUCCION: "is-production",
  PARAENTREGA: "is-delivery",
  CANCELADO: "is-cancelled",
};

export function todayIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function productionHeaderDateLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date()).replace(".", "");
}

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeProductionStatusKey(status) {
  return normalizeSearchText(status).replace(/[^a-z0-9]/g, "").toUpperCase();
}

export function initialsFromName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "SA";
  return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export function toIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export function resolveProgrammedDate(item) {
  return toIsoDate(item.fechaProgramadaProduccion || item.fechaEntrega);
}

export function formatDateTimeBogotaFromUtc(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const hasTimezone = /(:Z|[+-]\d{2}:\d{2})$/i.test(raw);
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
  const getPart = type => parts.find(part => part.type === type).value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart("hour")}:${getPart("minute")}`;
}

function normalizeDeliveryTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(::\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function deliveryTargetTimestamp(item) {
  const date = formatDateOnly(item.fechaEntrega);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const fallbackTime = formatDateTimeCompact(item.fechaEntrega).split(" ")[1];
  const time = normalizeDeliveryTime(item.horaEntrega || fallbackTime);
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
  if (normalizeStatus(item.estado).replace(/_/g, "") === "PARAENTREGA") {
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

export function hasAssignedFlorista(item) {
  if (item.floristaID != null && item.floristaID !== "") return true;
  return String(item.floristaAsignado || "").trim().length > 0;
}

export function flattenPipelineCards(payload) {
  if (!payload || typeof payload !== "object") return [];
  const stages = ["creado", "aprobado", "pendiente_produccion", "en_produccion", "listo", "en_camino", "entregado", "cancelado"];
  return stages.flatMap(stage => (Array.isArray(payload?.[stage]) ? payload[stage] : []));
}

export function extractListPayloadItems(payload) {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload.items,
    payload.pedidos,
    payload.pedido,
    payload.orders,
    payload.rows,
    payload.data,
    payload.data?.items,
    payload.data?.pedidos,
    payload.data?.orders,
    payload.result,
    payload.result?.items,
    payload.result?.pedidos,
    payload.resultados,
  ];
  return candidates.find(Array.isArray) || [];
}

export function extractOrderProducts(order) {
  const products = [
    order.productosDetalle,
    order.productos_detalle,
    order.detalles,
    order.detalle,
    order.pedidoDetalles,
    order.pedido_detalles,
    order.detallesPedido,
    order.detalles_pedido,
    order.detalleProductos,
    order.detalle_productos,
    order.productos,
    order.items,
  ].find(Array.isArray) || [];

  return products.length > 0 ? products : (order && typeof order === "object" ? [order] : []);
}

export function productionSelectionKey(item) {
  const pedidoId = Number(item.pedidoID || 0);
  if (pedidoId > 0) return `pedido-${pedidoId}`;
  return `produccion-${Number(item.idProduccion || 0)}`;
}

export function productionItemMatchesSearch(item, searchValue) {
  const search = normalizeSearchText(searchValue);
  if (!search) return true;

  const searchableValues = [
    item.floristaAsignado,
    item.cliente,
    item.numeroPedido,
    item.numero_pedido,
    item.nombreArreglo,
    item.producto,
    item.nombreProducto,
    item.codigoArreglo,
    item.codigo_arreglo,
    ...catalogCodeCandidates(item),
    ...productCodeCandidates(item),
  ];

  return searchableValues.some(value => normalizeSearchText(value).includes(search));
}

function floristaNamesMatch(left, right) {
  const leftText = normalizeSearchText(left);
  const rightText = normalizeSearchText(right);
  if (!leftText || !rightText) return false;
  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) return true;
  const leftTokens = leftText.split(/\s+/).filter(token => token.length > 2);
  const rightTokens = new Set(rightText.split(/\s+/).filter(token => token.length > 2));
  return leftTokens.length > 0 && leftTokens.every(token => rightTokens.has(token));
}

function productionItemBelongsToFlorista(item, currentFloristaId, currentFloristaName) {
  if (item.floristaID != null && item.floristaID !== "" && currentFloristaId != null) {
    return Number(item.floristaID) === Number(currentFloristaId);
  }
  return floristaNamesMatch(item.floristaAsignado, currentFloristaName);
}

export function buildVisibleProductionItems(sourceItems, currentFloristaId, busquedaGeneral, soloMisAsignados, groupByPedido = true, currentFloristaName = "") {
  const search = normalizeSearchText(busquedaGeneral);
  const filtered = sourceItems.filter(item => {
    if (!search && soloMisAsignados && !productionItemBelongsToFlorista(item, currentFloristaId, currentFloristaName)) {
      return false;
    }
    if (search && !productionItemMatchesSearch(item, search)) return false;
    return true;
  });

  if (!groupByPedido) {
    return [...filtered].sort((left, right) => {
      const numeroLeft = Number(left.numeroPedido || 0);
      const numeroRight = Number(right.numeroPedido || 0);
      if (numeroLeft !== numeroRight) return numeroLeft - numeroRight;
      return Number(left.idProduccion || 0) - Number(right.idProduccion || 0);
    });
  }

  const grouped = new Map();
  for (const item of filtered) {
    const key = String(item.pedidoID || item.idProduccion || "");
    if (!key) continue;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...item,
        produccionIds: [item.idProduccion],
        produccionItemsAgrupados: [item],
        pedidoDetalleIds: item.pedidoDetalleID != null ? [item.pedidoDetalleID] : [],
        productosAgrupados: [item.nombreArreglo || item.producto].filter(Boolean),
        codigosAgrupados: productCodeCandidates(item),
        codigosCatalogoAgrupados: catalogCodeCandidates(item),
        cantidadProducciones: 1,
      });
      continue;
    }

    current.produccionIds.push(item.idProduccion);
    current.produccionItemsAgrupados.push(item);
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
      produccionItemsAgrupados: item.produccionItemsAgrupados || [],
      pedidoDetalleID: item.pedidoDetalleIds?.[0] || item.pedidoDetalleID || null,
      nombreArreglo: productosUnicos.join(" + "),
      producto: productosUnicos.join(" + "),
      codigoArreglo: codigosUnicos.join(" + "),
      codigoCatalogo: codigosCatalogoUnicos[0] || item.codigoCatalogo || item.codigo_catalogo || "",
      codigosCatalogo: codigosCatalogoUnicos,
      codigos: codigosUnicos,
    };
  }).sort((left, right) => {
    const numeroLeft = Number(left.numeroPedido || 0);
    const numeroRight = Number(right.numeroPedido || 0);
    if (numeroLeft !== numeroRight) return numeroLeft - numeroRight;
    return Number(left.pedidoID || 0) - Number(right.pedidoID || 0);
  });
}

export function inferCurrentFloristaId(session, floristaItems) {
  const sessionUserId = Number(session.userID || session.usuarioID || session.idUsuario || 0);
  const sessionLogin = normalizeSearchText(session.login);
  const sessionEmail = normalizeSearchText(session.email);
  const sessionName = normalizeSearchText(session.nombre);

  const found = floristaItems.find(item => {
    const candidateUserId = Number(item.usuarioID || item.userID || item.idUsuario || 0);
    if (sessionUserId > 0 && candidateUserId > 0 && candidateUserId === sessionUserId) return true;

    const candidateLogin = normalizeSearchText(item.login || item.usuario);
    if (sessionLogin && candidateLogin && candidateLogin === sessionLogin) return true;

    const candidateEmail = normalizeSearchText(item.email);
    if (sessionEmail && candidateEmail && candidateEmail === sessionEmail) return true;

    const candidateName = normalizeSearchText(item.nombre || item.nombreFlorista || item.nombre_empleado);
    return sessionName && candidateName && candidateName === sessionName;
  });

  return found?.idFlorista != null ? Number(found.idFlorista) : null;
}

export function statusBadgeClass(status) {
  const key = normalizeStatus(status).replace(/_/g, "");
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

export function isPendingOutsideToday(item) {
  const normalizedStatus = normalizeStatus(item.estado).replace(/_/g, "");
  if (normalizedStatus !== "PENDIENTE") return false;
  const programmedDate = resolveProgrammedDate(item);
  return Boolean(programmedDate) && programmedDate !== todayIsoDate();
}

export function isPendingOverdue(item) {
  const normalizedStatus = normalizeStatus(item.estado).replace(/_/g, "");
  if (normalizedStatus !== "PENDIENTE") return false;
  const programmedDate = resolveProgrammedDate(item);
  if (!programmedDate) return false;
  return programmedDate < todayIsoDate();
}

export function matchesProductionMetric(item, metricKey) {
  const normalizedStatus = normalizeStatus(item.estado).replace(/_/g, "");
  if (metricKey === "pendientesHoy") return normalizedStatus === "PENDIENTE" && resolveProgrammedDate(item) === todayIsoDate();
  if (metricKey === "sinAsignar") return normalizedStatus === "PENDIENTE" && !hasAssignedFlorista(item);
  if (metricKey === "atrasados") return isPendingOverdue(item);
  if (metricKey === "pendientesFuturos") {
    const programmedDate = resolveProgrammedDate(item);
    return normalizedStatus === "PENDIENTE" && Boolean(programmedDate) && programmedDate > todayIsoDate();
  }
  return true;
}

export function productionStatusBadgeClass(item) {
  const baseClass = statusBadgeClass(item.estado);
  return isPendingOutsideToday(item) ? `${baseClass} is-pendiente-other-date` : baseClass;
}

export function isCanceledProductionStatus(item) {
  return ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item.estado));
}

function hasCanceledOrderStatus(item) {
  const candidates = [
    item.estadoPedido,
    item.estado_pedido,
    item.pedidoEstado,
    item.pedido_estado,
    item.estadoPedidoCodigo,
    item.estado_pedido_codigo,
    item.codigoEstadoPedido,
    item.codigo_estado_pedido,
    item.pedido?.estado,
    item.pedido?.estadoCodigo,
    item.pedido?.estado_codigo,
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
  const pedidoID = order.pedidoID || order.pedidoId || order.idPedido || order.id_pedido || order.id;
  const numeroPedido = order.numeroPedido || order.numero_pedido || order.codigoPedido || order.codigo_pedido || pedidoID;
  const productSource = [
    order.productosDetalle,
    order.productos_detalle,
    order.detalles,
    order.detalleProductos,
    order.productos,
  ].find(Array.isArray)?.[0] || order;
  const productName = String(
    productSource.nombreProducto ||
    productSource.nombre_producto ||
    productSource.nombreArreglo ||
    productSource.nombre_arreglo ||
    productSource.producto ||
    productSource.nombre ||
    order.resumenProductos ||
    order.resumen_productos ||
    ""
  ).trim();
  const fechaEntrega = order.fechaEntrega || order.fecha_entrega || order.destinatario?.fechaEntrega || order.destinatario?.fecha_entrega || "";
  const horaEntrega = order.horaEntrega || order.hora_entrega || order.destinatario?.horaEntrega || order.destinatario?.hora_entrega || formatDateTimeCompact(fechaEntrega).split(" ")[1] || "";
  return normalizeProductionItemStatus({
    ...order,
    idProduccion: order.idProduccion || order.produccionID || pedidoID,
    pedidoID,
    numeroPedido,
    nombreArreglo: productName,
    producto: productName,
    codigoCatalogo: catalogCodeCandidates(productSource)[0] || catalogCodeCandidates(order)[0] || "",
    codigoProducto: productCodeCandidates(productSource)[0] || productCodeCandidates(order)[0] || "",
    cliente: order.cliente || order.clienteNombre || order.cliente_nombre || order.cliente?.nombreCompleto || order.cliente?.nombre || order.destinatario || order.destinatario?.nombre || "",
    fechaEntrega,
    horaEntrega,
    floristaID: order.floristaID || order.floristaId || null,
    floristaAsignado: order.floristaAsignado || order.florista_asignado || "",
    fechaAsignacion: order.fechaAsignacion || order.fecha_asignacion || "",
    estado: "Cancelado",
    estadoPedido: order.estado || order.estadoPedido || "Cancelado",
    imageUrl: resolveProductImageUrl(productSource) || resolveProductImageUrl(order),
  });
}

export function mergeProductionItemsByOrder(items, extraItems) {
  const map = new Map();
  [...(Array.isArray(items) ? items : []), ...(Array.isArray(extraItems) ? extraItems : [])].forEach(item => {
    if (!item) return;
    const key = String(item.pedidoID || item.numeroPedido || item.idProduccion || "");
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

export function productionStatusChipClass(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  return PRODUCTION_STATUS_CHIP_CLASS[normalized] || "is-all";
}

export function nextFloristaStatus(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  if (normalized === "PENDIENTE") return "EnProduccion";
  if (normalized === "ENPRODUCCION") return "ParaEntrega";
  return null;
}

export function nextFloristaLabel(status) {
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

export function arregloCodeLabel(item) {
  return catalogCodeCandidates(item)[0] || productCodeCandidates(item)[0] || item.codigoArreglo || item.codigo_arreglo || "-";
}

export function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function isFloristaActivo(item) {
  if (!item || typeof item !== "object") return false;
  return String(item.estado || "").toLowerCase() === "activo" || item.activo === true || item.activo === 1;
}

function normalizeImageFieldKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function normalizeImageCandidate(value) {
  const text = String(value || "").trim();
  if (!text || text === "[object Object]") return "";
  if (/^url\((.*)\)$/i.test(text)) {
    return text.replace(/^url\((.*)\)$/i, "$1").replace(/^['"]|['"]$/g, "").trim();
  }
  return text;
}

function looksLikeImageUrl(value) {
  const text = normalizeImageCandidate(value);
  if (!text) return false;
  if (/^(https:)\/\//i.test(text)) return true;
  if (/^(data|blob):/i.test(text)) return true;
  if (text.startsWith("/")) return true;
  if (/\.(png|jpeg|webp|gif|svg|avif)(\.*)$/i.test(text)) return true;
  return /^[\w./-]+\/[\w./-]+\.(png|jpeg|webp|gif|svg|avif)(\.*)$/i.test(text);
}

function findNestedProductImageUrl(value, depth = 0, seen = new WeakSet()) {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string") return looksLikeImageUrl(value) ? normalizeImageCandidate(value) : "";
  if (typeof value !== "object") return "";
  if (seen.has(value)) return "";
  seen.add(value);

  const priorityKeys = [
    "imagenUrl",
    "imagen_url",
    "imageUrl",
    "image_url",
    "fotoUrl",
    "foto_url",
    "urlImagen",
    "url_imagen",
    "imagen",
    "image",
    "foto",
    "thumbnail",
    "thumbnailUrl",
    "thumbnail_url",
  ];

  for (const key of priorityKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const direct = normalizeImageCandidate(value[key]);
    if (looksLikeImageUrl(direct)) return direct;
    const nested = findNestedProductImageUrl(value[key], depth + 1, seen);
    if (nested) return nested;
  }

  for (const [key, candidate] of Object.entries(value)) {
    const normalizedKey = normalizeImageFieldKey(key);
    if (!normalizedKey.includes("imagen") && !normalizedKey.includes("image") && !normalizedKey.includes("foto") && !normalizedKey.includes("thumbnail")) continue;
    const direct = normalizeImageCandidate(candidate);
    if (looksLikeImageUrl(direct)) return direct;
    const nested = findNestedProductImageUrl(candidate, depth + 1, seen);
    if (nested) return nested;
  }

  for (const key of ["producto", "productoSucursal", "producto_sucursal", "catalogo", "detalle", "arreglo"]) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const nested = findNestedProductImageUrl(value[key], depth + 1, seen);
    if (nested) return nested;
  }

  return "";
}

export function resolveProductImageUrl(value) {
  if (!value || typeof value !== "object") return "";
  const direct = findNestedProductImageUrl(value);
  if (direct) return direct;

  const candidateKeys = Object.keys(value)
    .filter(key => {
      const normalized = normalizeImageFieldKey(key);
      return normalized.includes("imagen") || normalized.includes("image") || normalized.includes("foto") || normalized.includes("thumbnail");
    })
    .sort((left, right) => {
      const leftNorm = normalizeImageFieldKey(left);
      const rightNorm = normalizeImageFieldKey(right);
      const score = key => {
        if (key === "imagenurl" || key === "imageurl") return 0;
        if (key.includes("url")) return 1;
        if (key.includes("imagen") || key.includes("image")) return 2;
        return 3;
      };
      return score(leftNorm) - score(rightNorm);
    });
  for (const key of candidateKeys) {
    const candidate = normalizeImageCandidate(value[key]);
    if (looksLikeImageUrl(candidate)) return candidate;
  }
  return "";
}

export function getProductoId(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const candidates = [
    raw.productoID,
    raw.productoId,
    raw.producto_id,
    raw.idProducto,
    raw.id_producto,
  ];
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function isEmpresaCatalogCode(empresaId) {
  return Number(empresaId) === 3;
}

export function shouldUseCatalogCodeForProduction() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("catalogCode") === "1";
}

function normalizeCodeCandidates(candidates) {
  return Array.from(new Set(candidates.map(value => String(value || "").trim()).filter(Boolean)));
}

export function catalogCodeCandidates(value = {}) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.codigosCatalogo) && value.codigosCatalogo.length > 0) {
    return normalizeCodeCandidates(value.codigosCatalogo);
  }
  return normalizeCodeCandidates([
    value.codigoCatalogo,
    value.codigo_catalogo,
    value.codigoCatalogoProducto,
    value.codigo_catalogo_producto,
    value.catalogoCodigo,
    value.catalogo_codigo,
    value.codigoArreglo,
    value.codigo_arreglo,
    value.producto?.codigoCatalogo,
    value.producto?.codigo_catalogo,
    value.productoSucursal?.codigoCatalogo,
    value.productoSucursal?.codigo_catalogo,
    value.producto_sucursal?.codigoCatalogo,
    value.producto_sucursal?.codigo_catalogo,
  ]);
}

export function productCodeCandidates(value = {}) {
  if (!value || typeof value !== "object") return [];
  return normalizeCodeCandidates([
    value.codigoProducto,
    value.codigo_producto,
    value.codigoInterno,
    value.codigo_interno,
    value.sku,
    value.referencia,
    value.productoCodigo,
    value.producto_codigo,
    value.producto?.codigoProducto,
    value.producto?.codigo_producto,
    value.producto?.codigoInterno,
    value.producto?.codigo_interno,
    value.producto?.sku,
    value.producto?.codigo,
    value.productoSucursal?.codigoProducto,
    value.productoSucursal?.codigo_producto,
    value.productoSucursal?.codigo,
    value.producto_sucursal?.codigoProducto,
    value.producto_sucursal?.codigo_producto,
    value.producto_sucursal?.codigo,
    value.codigo,
  ]);
}
