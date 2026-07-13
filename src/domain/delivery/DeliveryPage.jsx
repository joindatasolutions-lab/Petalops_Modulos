import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatDateOnly, formatTimeOnly, normalizeStatus } from "../../shared/utils.js";
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
} from "lucide-react";

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
  const searchByOrderNumber = /\d/.test(searchTerm);
  return {
    fecha: searchByOrderNumber ? null : fechaFiltro,
    q: searchTerm,
    filtersToFetch: searchByOrderNumber && statusFilter === "todos"
      ? DELIVERY_SEARCH_BACKEND_FILTERS
      : [filtroConsulta],
  };
}

const DELIVERY_VIEWS = [
  { value: "admin", label: "Pedidos" },
  { value: "disponibles", label: "Disponibles" },
  { value: "domiciliarios", label: "Domiciliarios" },
  { value: "mis-pedidos", label: "Mis pedidos" },
];

const DELIVERY_STATUS_FILTERS = [
  { key: "todos", label: "Todos", icon: Truck },
  { key: "pendiente", label: "Pendientes", icon: Clock3 },
  { key: "asignado", label: "Asignados", icon: UserRound },
  { key: "en-camino", label: "En camino", icon: Truck },
  { key: "entregado", label: "Entregados", icon: CheckCircle2 },
  { key: "no-entregado", label: "No entregados", icon: AlertTriangle },
  { key: "reprogramado", label: "Reprogramados", icon: Clock3 },
];
const MAX_ENTREGAS_ACTIVAS_DOMICILIARIO = 15;
const DELIVERY_SYNC_PAGE_SIZE = 100;

const DEFAULT_DELIVERY_FORM = {
  firmaNombre: "",
  firmaDocumento: "",
  firmaImagenFile: null,
  evidenciaFotoFile: null,
  observaciones: "",
  noEntregadoMotivo: "",
  reprogramarPara: "",
};

const DEFAULT_COURIER_FORM = {
  nombre: "",
  telefono: "",
  tipo: "interno",
  vehiculoTipo: "moto",
  vehiculoPlaca: "",
  vehiculoDetalle: "",
  activo: true,
};

function isPedidosRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase();
  return role.includes("pedido") || role.includes("ventas") || role.includes("comercial");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function deliveryRawStatus(item) {
  const code = item?.estadoEntregaCodigo
    || item?.estado_entrega_codigo
    || item?.codigoEstadoEntrega
    || item?.codigo_estado_entrega
    || item?.estadoCodigo
    || item?.estado_codigo
    || item?.estado;
  const name = item?.estadoEntregaNombre
    || item?.estado_entrega_nombre
    || item?.nombreEstadoEntrega
    || item?.nombre_estado_entrega
    || item?.estadoNombre
    || item?.estado_nombre
    || item?.estado;
  return { code, name };
}

function deliveryStatusMeta(item) {
  const { code, name } = deliveryRawStatus(item);
  const status = normalizeStatus(code || name).replace(/_/g, "");
  const label = String(name || code || "Pendiente").trim();

  if (status === "ENTREGADO") return { key: "entregado", label: label || "Entregado", tone: "done" };
  if (status === "ENRUTA" || status === "ENCAMINO") return { key: "en-camino", label: label || "En ruta", tone: "route" };
  if (status === "ASIGNADO" || status === "PARAENTREGA") return { key: "asignado", label: label || "Asignado", tone: "assigned" };
  if (status === "NOENTREGADO") return { key: "no-entregado", label: label || "No entregado", tone: "failed" };
  if (status === "REPROGRAMADO") return { key: "reprogramado", label: label || "Reprogramado", tone: "rescheduled" };
  return { key: "pendiente", label: label || "Pendiente", tone: "pending" };
}

function isCanceledDeliveryStatus(item) {
  const { code, name } = deliveryRawStatus(item);
  const status = normalizeStatus(code || name).replace(/_/g, "");
  return status === "CANCELADO" || status === "RECHAZADO";
}

function isDeliveryTimeLate(item) {
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

function deliveryRemainingLabel(item) {
  const hours = Number(item?.tiempoRestanteHoras);
  if (!Number.isFinite(hours)) return "Sin ETA";
  const totalMinutes = Math.abs(Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const value = h > 0
    ? `${h} h${m > 0 ? ` ${m} m` : ""}`
    : `${m} m`;
  return hours < 0 ? `Retraso ${value}` : `${value} restantes`;
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
  return (Array.isArray(items) ? items : []).filter(item => !isStorePickupDelivery(item));
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
    item?.direccion,
    item?.direccionDestino,
    item?.direccion_destino,
    item?.direccionEntrega,
    item?.direccion_entrega,
    address.primary,
    address.secondary,
    item?.barrio,
    item?.zona,
    item?.ciudad,
    item?.municipio,
    item?.telefonoDestino,
    item?.telefono_destino,
    item?.telefono,
    item?.telefonoCliente,
    item?.telefono_cliente,
    item?.celular,
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
    const parsed = Number(value);
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

function orderValue(item) {
  const value = Number(item?.total || item?.valor || item?.valorPedido || 0);
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `$${value.toLocaleString("es-CO")}`;
}

function deliveryTimeLabel(item) {
  return item?.horaEntrega || formatTimeOnly(item?.fechaEntregaProgramada) || "-";
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
  const detail = item?.vehiculoDetalle || item?.modeloVehiculo || item?.modelo || item?.vehicleModel || "";
  return {
    type: String(type || "Sin vehiculo").trim(),
    plate: String(plate || "-").trim(),
    detail: String(detail || "").trim(),
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
    return "No fue posible validar la ubicaciÃ³n actual.";
  }
  return detail;
}

function clearBrowserTextSelection() {
  globalThis.getSelection?.()?.removeAllRanges?.();
}

async function requestCurrentCoords() {
  if (!globalThis.navigator?.geolocation) {
    throw new Error("Este dispositivo no soporta geolocalizaciÃ³n.");
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
          reject(new Error("Debes permitir la ubicaciÃ³n para continuar."));
          return;
        }
        if (error?.code === 2) {
          reject(new Error("No fue posible obtener tu ubicaciÃ³n actual."));
          return;
        }
        reject(new Error("La ubicaciÃ³n tardÃ³ demasiado. Intenta de nuevo."));
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
  const [selectedDomiciliarioByEntrega, setSelectedDomiciliarioByEntrega] = useState({});
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [deliveryProductImages, setDeliveryProductImages] = useState({});
  const [filtro, setFiltro] = useState("hoy");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [fechaFiltro, setFechaFiltro] = useState(todayIso());
  const [deliverySearch, setDeliverySearch] = useState("");
  const [courierSearch, setCourierSearch] = useState("");

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
    const rows = Array.isArray(data.items) ? data.items : [];
    setDomiciliarios(rows);
    if (!domiciliarioId && rows.length > 0) {
      const firstId = courierIdValue(rows[0]);
      if (firstId != null) setDomiciliarioId(String(firstId));
    }
  }, [api, empresaId, sucursalId, domiciliarioId]);

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
      console.error("Error en mÃ³dulo de domicilios:", nextError);
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
    if (modo === "barrios" || modo === "crear-barrio") {
      runLoad(loadBarrios).catch(() => {});
      return;
    }
    if (modo === "domiciliarios") {
      runLoad(loadDomiciliarios).catch(() => {});
      return;
    }
    if (modo === "disponibles") {
      runLoad(() => loadAvailableOrders(availableCoords)).catch(() => {});
      return;
    }
    runLoad(loadMyOrders).catch(() => {});
  }, [modo, runLoad, loadAdmin, loadBarrios, loadAvailableOrders, loadMyOrders, availableCoords]);

  const withCoords = async actionLabel => {
    if (isOffline) {
      throw new Error("Sin conexiÃ³n. Revisa internet antes de continuar.");
    }

    const coords = await requestCurrentCoords();
    setAvailableCoords(coords);
    setFeedback(`UbicaciÃ³n confirmada para ${actionLabel}.`);
    return coords;
  };

  const handleModeChange = async nextMode => {
    setError("");
    setFeedback("");

    if (nextMode !== "disponibles") {
      setModo(nextMode);
      return;
    }

    try {
      const coords = await withCoords("consultar pedidos disponibles");
      setModo(nextMode);
      setLoading(true);
      await loadAvailableOrders(coords);
    } catch (nextError) {
      setModo(nextMode);
      setAvailableCoords(null);
      setError(nextError?.message || "No fue posible obtener tu ubicaciÃ³n.");
    } finally {
      setLoading(false);
    }
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
      } else if (modo === "domiciliarios") {
        await loadDomiciliarios();
      } else if (modo === "barrios" || modo === "crear-barrio") {
        await loadBarrios();
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
      await api.crearDomiciliario({
        empresaId,
        sucursalId,
        nombre,
        telefono: courierForm.telefono.trim(),
        tipo: courierForm.tipo,
        vehiculoTipo: courierForm.vehiculoTipo,
        vehiculoPlaca: courierForm.vehiculoPlaca.trim(),
        vehiculoDetalle: courierForm.vehiculoDetalle.trim(),
        activo: courierForm.activo,
      });
      setFeedback("Domiciliario creado correctamente.");
      setCourierForm(DEFAULT_COURIER_FORM);
      setCourierCreateOpen(false);
      await loadDomiciliarios();
    } catch (nextError) {
      console.error("Error creando domiciliario:", nextError);
      setError(nextError?.detail || nextError?.message || "No fue posible crear el domiciliario.");
    } finally {
      setCourierSaving(false);
    }
  };

  const openDeliveryDetail = item => {
    if (!item) return;
    setSelectedDeliveryItem(item);
    setDeliveryDrawerOpen(false);
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
      setError("Este pedido no tiene telÃ©fono registrado.");
      return;
    }
    const msg = encodeURIComponent(item?.mensaje || "Hola, vamos en camino con tu pedido.");
    globalThis.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noreferrer");
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
    if (!deliveryForm.firmaNombre.trim() || !deliveryForm.firmaDocumento.trim()) {
      setError("Debes completar nombre y documento de quien recibe.");
      return;
    }
    if (!deliveryForm.firmaImagenFile) {
      setError("Debes adjuntar la evidencia de firma.");
      return;
    }

    setBusy(`entregar-${entregaId}`);
    try {
      const coords = await withCoords("confirmar la entrega");
      await api.marcarEntregaEntregado({
        entregaId,
        usuarioCambio,
        firmaNombre: deliveryForm.firmaNombre.trim(),
        firmaDocumento: deliveryForm.firmaDocumento.trim(),
        firmaImagenFile: deliveryForm.firmaImagenFile,
        evidenciaFotoFile: deliveryForm.evidenciaFotoFile,
        latitudEntrega: coords.lat,
        longitudEntrega: coords.lng,
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
    const confirmed = globalThis.confirm("Â¿Seguro que deseas borrar este barrio?");
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

  const filteredDispatchItems = useMemo(() => {
    const byStatus = statusFilter === "todos"
      ? dispatchItems
      : dispatchItems.filter(item => deliveryStatusMeta(item).key === statusFilter);

    return byStatus.filter(item => deliveryMatchesSearch(item, deliverySearch));
  }, [deliverySearch, dispatchItems, statusFilter]);

  useEffect(() => {
    const missingItems = filteredDispatchItems
      .filter(item => !resolveDeliveryImageUrl(item, catalogProductIndex))
      .filter(item => {
        const key = deliveryItemKey(item);
        return key && deliveryProductImages[key] == null && deliveryPedidoId(item) != null;
      })
      .slice(0, 20);

    if (missingItems.length === 0) return undefined;

    let disposed = false;
    Promise.allSettled(missingItems.map(async item => {
      const detail = await api.obtenerDetallePedido(deliveryPedidoId(item));
      return {
        key: deliveryItemKey(item),
        imageUrl: resolveDetailProductImageUrl(detail, catalogProductIndex),
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
    });

    return () => { disposed = true; };
  }, [api, catalogProductIndex, deliveryProductImages, filteredDispatchItems]);

  const selectedDispatchItem = selectedDeliveryItem || filteredDispatchItems[0] || null;
  const courierSearchTerm = normalizeSearchText(courierSearch);
  const filteredDomiciliarios = useMemo(() => {
    if (!courierSearchTerm) return domiciliarios;
    return domiciliarios.filter(item => normalizeSearchText(item?.nombre || item?.nombreDomiciliario || item?.login).includes(courierSearchTerm));
  }, [domiciliarios, courierSearchTerm]);
  const courierDirectoryRows = useMemo(() => (
    domiciliarios.filter(item => {
      const statusMatches = courierStatusFilter === "todos"
        || (courierStatusFilter === "activo" && item.activo !== false)
        || (courierStatusFilter === "inactivo" && item.activo === false);
      if (!statusMatches) return false;
      if (!courierSearchTerm) return true;
      const vehicle = courierVehicle(item);
      const haystack = [
        item?.nombre,
        item?.nombreDomiciliario,
        item?.login,
        item?.usuario,
        item?.telefono,
        item?.celular,
        courierType(item),
        vehicle.type,
        vehicle.plate,
        vehicle.detail,
      ].join(" ");
      return normalizeSearchText(haystack).includes(courierSearchTerm);
    })
  ), [domiciliarios, courierSearchTerm, courierStatusFilter]);
  const dispatchKpis = useMemo(() => {
    const base = { pendiente: 0, asignado: 0, "en-camino": 0, entregado: 0, "no-entregado": 0, reprogramado: 0 };
    dispatchItems.forEach(item => {
      const key = deliveryStatusMeta(item).key;
      base[key] = (base[key] || 0) + 1;
    });
    return base;
  }, [dispatchItems]);
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
            {feedback ? <p className="orders-message delivery-feedback">{feedback}</p> : null}
            {error ? <p className="orders-message delivery-error">{error}</p> : null}
            {loading ? <p className="orders-message">Cargando domicilios...</p> : null}

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
                    <strong>{item.key === "todos" ? dispatchItems.length : (dispatchKpis[item.key] || 0)}</strong>
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
                    const imageUrl = resolveDeliveryImageUrl(item, catalogProductIndex) || deliveryProductImages[deliveryItemKey(item)] || "";
                    const arrangementName = deliveryArrangementName(item);
                    return (
                      <article
                        key={item.idEntrega || item.numeroPedido}
                        className={`delivery-dispatch-card is-${meta.tone}${timeLate ? " is-late" : ""}${selected ? " is-selected" : ""}`}
                        onClick={() => openDeliveryDetail(item)}
                      >
                        <div className="delivery-card-order">
                          <div className="delivery-card-topline">
                            <strong>#{item.numeroPedido || "-"}</strong>
                            {isSurpriseDelivery(item) ? <span className="delivery-urgent-pill">Es sorpresa</span> : null}
                          </div>
                          <strong className="delivery-card-product-name">{arrangementName || "Producto sin nombre"}</strong>
                          <span className="delivery-card-time"><Clock3 size={14} /> {deliveryTimeLabel(item)}</span>
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
                          <p>Tiempo restante</p>
                          <strong className={`delivery-time-left ${timeLate ? "is-late" : ""}`}>{deliveryRemainingLabel(item)}</strong>
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
                          <button type="button" className="delivery-icon-btn" title="Abrir ruta" aria-label="Abrir ruta" onClick={() => openMaps(item)}><Route size={16} /></button>
                          <button type="button" className="delivery-icon-btn" title="WhatsApp cliente" aria-label="WhatsApp cliente" onClick={() => openWhatsApp(item)}><MessageCircle size={16} /></button>
                          <button type="button" className="delivery-icon-btn" title="Mas opciones" aria-label="Mas opciones" onClick={() => openDeliveryDetail(item)}><MoreVertical size={17} /></button>
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
                <span>AsignaciÃ³n propia</span>
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

        {(modo === "barrios" || modo === "crear-barrio") && feedback ? <p className="orders-message delivery-feedback">{feedback}</p> : null}
        {(modo === "barrios" || modo === "crear-barrio") && error ? <p className="orders-message delivery-error">{error}</p> : null}
        {(modo === "barrios" || modo === "crear-barrio") && loading ? <p className="orders-message">Cargando domicilios...</p> : null}

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
              <button type="button" className="btn-primary delivery-new-courier-btn" onClick={() => setCourierCreateOpen(current => !current)}>
                <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
                Nuevo domiciliario
              </button>
            </div>

            {courierCreateOpen ? (
              <article className="order-block delivery-courier-create">
                <div className="delivery-section-head">
                  <h4>Nuevo domiciliario</h4>
                  <span>{domiciliarios.length} registrados</span>
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
                      <option value="interno">Interno</option>
                      <option value="externo">Externo</option>
                    </select>
                  </label>
                  <label className="order-detail-edit-label">
                    Vehiculo
                    <select
                      value={courierForm.vehiculoTipo}
                      onChange={event => setCourierForm(current => ({ ...current, vehiculoTipo: event.target.value }))}
                    >
                      <option value="moto">Moto</option>
                      <option value="carro">Carro</option>
                      <option value="bicicleta">Bicicleta</option>
                      <option value="otro">Otro</option>
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
                      const activeCount = courierActiveOrders(item, adminItems);
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
                              {item.activo === false ? "Inactivo" : "Activo"}
                            </span>
                          </td>
                          <td data-label="Acciones">
                            <div className="delivery-courier-action-buttons">
                              <button type="button" title="Ver" aria-label="Ver domiciliario"><Eye size={16} /></button>
                              <button type="button" title="Editar" aria-label="Editar domiciliario"><Pencil size={16} /></button>
                              <button type="button" title="Mas acciones" aria-label="Mas acciones"><MoreVertical size={17} /></button>
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
        ) : modo === "admin" ? null : modo === "disponibles" ? null : modo === "mis-pedidos" ? null : false ? (
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
                    <td data-label="Pedido">{item.numeroPedido}</td>
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
                    <td data-label="Tiempo restante">{typeof item.tiempoRestanteHoras === "number" ? `${item.tiempoRestanteHoras} h` : "-"}</td>
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
                        <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Ver ubicaciÃ³n</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : modo === "disponibles" ? (
          <>
            <section className="delivery-summary-grid">
              <article className="order-block delivery-summary-card">
                <strong>{availableSummary}</strong>
                <span>{availableCoords ? "Distancias ordenadas por ubicaciÃ³n actual" : "Activa ubicaciÃ³n para calcular distancias"}</span>
              </article>
              <article className="order-block delivery-summary-card">
                <strong>{availableCoords ? "UbicaciÃ³n lista" : "UbicaciÃ³n pendiente"}</strong>
                <span>{availableCoords ? `${availableCoords.lat.toFixed(4)}, ${availableCoords.lng.toFixed(4)}` : "Se solicitarÃ¡ al tomar o refrescar disponibles"}</span>
              </article>
            </section>

            <section className="delivery-courier-cards">
              {availableItems.length === 0 ? (
                <p className="orders-message">No hay pedidos disponibles con los filtros seleccionados.</p>
              ) : availableItems.map(item => (
                <article key={item.idEntrega || item.numeroPedido} className="delivery-courier-card">
                  <div className="delivery-courier-head">
                    <strong>Pedido #{item.numeroPedido || "-"}</strong>
                    <span className={`order-badge ${priorityTone(item.prioridad)}`}>{item.prioridad || "MEDIA"}</span>
                  </div>
                  <p className="delivery-address">{deliveryArrangementName(item) || "Arreglo sin nombre"}</p>

                  <p className="delivery-address">{item.direccion || "Sin direcciÃ³n"}</p>
                  <p className="delivery-meta">
                    {item.barrio || "Barrio sin definir"}
                    {` Â· ${formatDistanceKm(getDistanceValue(item))}`}
                    {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                      ? ` Â· ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
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
                      <strong>Pedido #{item.numeroPedido || "-"}</strong>
                      <span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado || "Asignado"}</span>
                    </div>
                    <p className="delivery-address">{deliveryArrangementName(item) || "Arreglo sin nombre"}</p>
                    <p className="delivery-address">{item.direccion || "Sin direcciÃ³n"}</p>
                    <p className="delivery-meta">
                      {item.barrio || "Barrio sin definir"}
                      {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                        ? ` Â· ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
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
                      <strong>Pedido #{item.numeroPedido || "-"}</strong>
                      <span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado || "EnRuta"}</span>
                    </div>
                    <p className="delivery-address">{deliveryArrangementName(item) || "Arreglo sin nombre"}</p>
                    <p className="delivery-address">{item.direccion || "Sin direcciÃ³n"}</p>
                    <p className="delivery-meta">
                      {item.barrio || "Barrio sin definir"}
                      {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                        ? ` Â· ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
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
        ) : modo === "crear-barrio" ? (
          <section className="delivery-barrios-layout">
            <article className="order-block users-top-panel delivery-barrios-form-panel">
              <h4>Crear barrio</h4>
              <div className="users-create-user-form">
                <label className="order-detail-edit-label">
                  Zona ID
                  <input
                    type="number"
                    min="0"
                    value={barrioForm.zonaID}
                    onChange={event => onChangeBarrioForm("zonaID", event.target.value)}
                    placeholder="Ej: 1"
                  />
                </label>
                <label className="order-detail-edit-label">
                  Nombre barrio
                  <input
                    type="text"
                    value={barrioForm.nombreBarrio}
                    onChange={event => onChangeBarrioForm("nombreBarrio", event.target.value)}
                    placeholder="Nombre del barrio"
                  />
                </label>
                <label className="order-detail-edit-label">
                  Costo domicilio
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={barrioForm.costoDomicilio}
                    onChange={event => onChangeBarrioForm("costoDomicilio", event.target.value)}
                    placeholder="0"
                  />
                </label>
                <label className="order-detail-edit-label">
                  Activo
                  <select
                    value={barrioForm.activo ? "1" : "0"}
                    onChange={event => onChangeBarrioForm("activo", event.target.value === "1")}
                  >
                    <option value="1">S?</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <button type="button" className="btn-primary" onClick={onCrearBarrio} disabled={barrioSaving}>
                  {barrioSaving ? "Guardando..." : "Crear barrio"}
                </button>
              </div>
            </article>
          </section>
        ) : (
          <section className="delivery-barrios-layout">
            <article className="order-block delivery-barrios-search-panel">
              <label className="order-detail-edit-label">
                Buscar barrio
                <input
                  type="text"
                  value={barriosSearch}
                  onChange={event => setBarriosSearch(event.target.value)}
                  placeholder="Busca por zona, barrio o costo"
                />
              </label>
            </article>
            <article className="order-block users-table-panel delivery-barrios-table-panel">
              <h4>Barrios registrados</h4>
              <div className="orders-table-wrap">
                <table className="orders-table delivery-admin-table">
                  <thead>
                    <tr>
                      <th>Zona ID</th>
                      <th>Nombre barrio</th>
                      <th>Costo domicilio</th>
                      <th>Activo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBarriosItems.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No hay barrios para el filtro seleccionado.</td>
                      </tr>
                    ) : filteredBarriosItems.map(item => (
                      <tr key={item.idBarrio}>
                        <td>
                          {editingBarrioId === item.idBarrio ? (
                            <input
                              type="number"
                              min="0"
                              value={barrioEditForm.zonaID}
                              onChange={event => setBarrioEditForm(current => ({ ...current, zonaID: event.target.value }))}
                              placeholder="Zona"
                            />
                          ) : (
                            item.zonaID ?? "-"
                          )}
                        </td>
                        <td>
                          {editingBarrioId === item.idBarrio ? (
                            <input
                              type="text"
                              value={barrioEditForm.nombreBarrio}
                              onChange={event => setBarrioEditForm(current => ({ ...current, nombreBarrio: event.target.value }))}
                              placeholder="Nombre del barrio"
                            />
                          ) : (
                            item.nombreBarrio || "-"
                          )}
                        </td>
                        <td>
                          {editingBarrioId === item.idBarrio ? (
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={barrioEditForm.costoDomicilio}
                              onChange={event => setBarrioEditForm(current => ({ ...current, costoDomicilio: event.target.value }))}
                              placeholder="0"
                            />
                          ) : (
                            Number(item.costoDomicilio || 0)
                          )}
                        </td>
                        <td>{item.activo ? "S?" : "No"}</td>
                        <td>
                          <div className="order-actions">
                            {editingBarrioId === item.idBarrio ? (
                              <>
                                <button type="button" className="btn-primary" onClick={() => onSaveEditBarrio(item.idBarrio)} disabled={barrioSaving}>
                                  {barrioSaving ? "Guardando..." : "Guardar"}
                                </button>
                                <button type="button" className="btn-outline" onClick={onCancelEditBarrio} disabled={barrioSaving}>
                                  Cancelar
                                </button>
                                <button type="button" className="btn-outline" onClick={() => onDeleteBarrio(item.idBarrio)} disabled={barrioSaving}>
                                  Borrar
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="btn-outline" onClick={() => onStartEditBarrio(item)}>
                                  Editar
                                </button>
                                <button type="button" className="btn-outline" onClick={() => onDeleteBarrio(item.idBarrio)} disabled={barrioSaving}>
                                  Borrar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}
      </main>

      <aside className={`orders-drawer ${deliveryDrawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>Detalle Domicilio</strong>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeDeliveryDetail} title="Cerrar barra lateral">âœ•</button>
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
                  <p><span>NÃºmero del pedido</span><strong>{selectedDeliveryItem.numeroPedido || "-"}</strong></p>
                  <p><span>Arreglo</span><strong>{deliveryArrangementName(selectedDeliveryItem) || "-"}</strong></p>
                  <p><span>Cliente</span><strong>{selectedDeliveryItem.cliente || selectedDeliveryItem.destinatario || "-"}</strong></p>
                  <p><span>Destinatario</span><strong>{selectedDeliveryItem.destinatario || "-"}</strong></p>
                  <p><span>Dirección</span><strong>{selectedDeliveryItem.direccion || "-"}</strong></p>
                  <p><span>Barrio</span><strong>{selectedDeliveryItem.barrio || "-"}</strong></p>
                  <p><span>Fecha entrega</span><strong>{formatDateOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</strong></p>
                  <p><span>Hora entrega</span><strong>{selectedDeliveryItem.horaEntrega || formatTimeOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</strong></p>
                  <p><span>Estado</span><strong>{selectedDeliveryItem.estado || "-"}</strong></p>
                  <p><span>Domiciliario</span><strong>{selectedDeliveryItem.domiciliario || "-"}</strong></p>
                  <p><span>TelÃ©fono</span><strong>{selectedDeliveryItem.telefonoDestino || "-"}</strong></p>
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
                          placeholder="Describe por quÃ© no se pudo entregar"
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
