import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { useRef } from "react";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus, shiftIsoDate, splitDateTimeParts, todayIsoDateBogota } from "../../shared/utils.js";
import { useDebouncedValue } from "../../shared/useDebouncedValue.js";
import {
  IconCheck,
  IconFileText,
  IconInfoCircle,
  IconUser,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import {
  CalendarDays,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Filter,
  Gift,
  Mail,
  MessageCircle,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  RotateCw,
  Search,
  Truck,
  UserCircle,
  XCircle,
} from "lucide-react";

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  CREADO: "is-pendiente",
  APROBADO: "is-aprobado",
  CANCELADO: "is-rechazado",
};
const LINK_PAYMENT_METHODS = new Set(["link bold", "link payu", "link wompi"]);
const AUTO_REFRESH_INTERVAL_MS = 15000;
const ORDERS_FILTER_CACHE_LIMIT = 8;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const CANCELADO_PEDIDO_ESTADO_ID = 6;

function todayIsoDate() {
  return todayIsoDateBogota();
}

function formatIsoDateFromLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateStartParam(dateValue) {
  const value = String(dateValue || "").trim().slice(0, 10);
  return value ? `${value} 00:00:00` : "";
}

export function localDateEndParam(dateValue) {
  const value = String(dateValue || "").trim().slice(0, 10);
  return value ? `${value} 23:59:59` : "";
}

function isoDateFromParts(year, month, day) {
  return formatIsoDateFromLocalDate(new Date(year, month, day));
}

function currentBogotaDateParts() {
  const [year, month, day] = todayIsoDate().split("-").map(Number);
  return { year, month: month - 1, day };
}

function thisWeekRangeIso() {
  const { year, month, day } = currentBogotaDateParts();
  const current = new Date(year, month, day);
  const dayOfWeek = current.getDay() || 7;
  const start = new Date(current);
  start.setDate(current.getDate() - dayOfWeek + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    fechaDesde: formatIsoDateFromLocalDate(start),
    fechaHasta: formatIsoDateFromLocalDate(end),
  };
}

function thisMonthRangeIso() {
  const { year, month } = currentBogotaDateParts();
  return {
    fechaDesde: isoDateFromParts(year, month, 1),
    fechaHasta: isoDateFromParts(year, month + 1, 0),
  };
}

function buildPaginationItems(page, pages) {
  const currentPage = Math.max(1, Math.min(Number(page || 1), Number(pages || 1)));
  const totalPages = Math.max(1, Number(pages || 1));
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  if (currentPage >= totalPages - 3) return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
}

function orderDeliveryDate(item) {
  return splitDateTimeParts(item?.fechaEntrega).date;
}

function orderCreatedDate(item) {
  return splitDateTimeParts(item?.fecha_pedido || item?.fechaPedido || item?.fecha || item?.createdAt || item?.created_at).date;
}

function isTodaySalesOrder(item, targetDate) {
  const createdDate = orderCreatedDate(item);
  const deliveryDate = orderDeliveryDate(item);
  return createdDate === targetDate || deliveryDate === targetDate;
}

function isCountableSalesOrder(item) {
  return normalizeStatus(item?.estado) === "APROBADO";
}

function calculateTodaySalesTotal(items, targetDate = todayIsoDate()) {
  return (Array.isArray(items) ? items : [])
    .filter(item => isTodaySalesOrder(item, targetDate) && isCountableSalesOrder(item))
    .reduce((sum, item) => sum + resolveOrderListTotal(item), 0);
}

function isPendingOutsideToday(item) {
  const status = normalizeStatus(item?.estado);
  if (status !== "PENDIENTE") return false;
  const deliveryDate = orderDeliveryDate(item);
  return Boolean(deliveryDate) && deliveryDate !== todayIsoDate();
}

function extractIndicativo(phone) {
  const raw = String(phone || "").trim();
  const match = raw.match(/^(\+\d{1,4})/);
  return match ? match[1] : null;
}

function normalizePaymentMethods(methods) {
  return Array.isArray(methods)
    ? methods.map(item => String(item || "").trim()).filter(Boolean)
    : [];
}

function isCashPaymentMethod(method) {
  return String(method || "").trim().toLowerCase().includes("efectivo");
}

function isLinkPaymentMethod(method) {
  return LINK_PAYMENT_METHODS.has(String(method || "").trim().toLowerCase());
}

function isCustomArrangement(producto) {
  const text = [
    producto?.codigo,
    producto?.nombre,
    producto?.observaciones,
  ]
    .map(value => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  return text.includes("personalizado") || text.includes("personalizada");
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function initialsFromName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "CL";
  return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function resolveDisplayOrderNumber(item) {
  const candidates = [
    item?.numeroPedido,
    item?.numero_pedido,
    item?.codigoPedido,
    item?.codigo_pedido,
    item?.pedido?.numeroPedido,
    item?.pedido?.numero_pedido,
    item?.pedido?.codigoPedido,
    item?.pedido?.codigo_pedido,
    item?.data?.numeroPedido,
    item?.data?.numero_pedido,
    item?.data?.codigoPedido,
    item?.data?.codigo_pedido,
  ];

  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "-";
}

function resolveOrderId(item) {
  const candidates = [
    item?.pedidoID,
    item?.pedidoId,
    item?.pedido_id,
    item?.idPedido,
    item?.id_pedido,
    item?.id,
    item?.pedido?.pedidoID,
    item?.pedido?.pedidoId,
    item?.pedido?.pedido_id,
    item?.pedido?.idPedido,
    item?.pedido?.id_pedido,
    item?.pedido?.id,
    item?.data?.pedidoID,
    item?.data?.pedidoId,
    item?.data?.pedido_id,
    item?.data?.idPedido,
    item?.data?.id_pedido,
    item?.data?.id,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const displayNumber = Number(resolveDisplayOrderNumber(item));
  if (Number.isFinite(displayNumber) && displayNumber > 0) return displayNumber;

  return null;
}

function resolveAssignedOrderNumber(...sources) {
  for (const source of sources) {
    const displayNumber = resolveDisplayOrderNumber(source);
    if (displayNumber && displayNumber !== "-") return displayNumber;
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
    value.image_url,
    value.fotoUrl,
    value.foto_url,
    value.urlImagen,
    value.url_imagen,
    value.productoImagenUrl,
    value.producto_imagen_url,
    value.imagenProducto,
    value.imagen_producto,
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

function normalizeOrderProducts(item) {
  const sources = [
    item?.productosDetalle,
    item?.productos_detalle,
    item?.detalles,
    item?.detalleProductos,
    item?.productos,
  ];
  const source = sources.find(Array.isArray) || [];

  return source
    .map((product, index) => {
      if (product && typeof product === "object") {
        return {
          key: String(product.detalleID || product.productoID || product.id || product.codigoProducto || index),
          productId: getProductoId(product),
          name: String(product.nombreProducto || product.nombre || product.producto || product.descripcion || "").trim(),
          code: String(product.codigoProducto || product.codigo || product.sku || "").trim(),
          codigoProducto: String(product.codigoProducto || product.codigo_producto || product.codigo || product.sku || "").trim(),
          codigoCatalogo: String(product.codigoCatalogo || product.codigo_catalogo || product.catalogCode || "").trim(),
          nombreProducto: String(product.nombreProducto || product.nombre || product.producto || product.descripcion || "").trim(),
          imageUrl: resolveProductImageUrl(product),
        };
      }
      return {
        key: String(index),
        productId: null,
        name: String(product || "").trim(),
        code: "",
        imageUrl: "",
      };
    })
    .filter(product => product.name || product.code || product.imageUrl);
}

function displayProductCode(product, empresaId = null) {
  const productEmpresaId = Number(product?.empresaID || product?.empresaId || product?.empresa_id || empresaId);
  const isEmpresaCatalogCode = productEmpresaId === 3;
  const catalogCode = String(product?.codigoCatalogo || product?.codigo_catalogo || product?.catalogCode || product?.codigo_catalogo_producto || "").trim();
  const productCode = String(product?.codigoProducto || product?.codigo_producto || product?.codigo || product?.code || "").trim();
  return isEmpresaCatalogCode ? (catalogCode || productCode) : productCode;
}

function orderProductLabel(product, empresaId = null) {
  if (typeof product === "string") return product.trim();
  const code = displayProductCode(product, empresaId);
  const name = String(product?.nombreProducto || product?.name || "").trim();
  if (code && name) return `${code} - ${name}`;
  return name || code;
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
    if (item.id != null) index.set(`id:${item.id}`, item);
    const codeKeys = [
      item.codigo,
      item.codigoProducto,
      item.codigoCatalogo,
      item.code,
    ]
      .map(productLookupKey)
      .filter(Boolean);
    const nameKey = productLookupKey(item.nombre);
    for (const codeKey of codeKeys) {
      index.set(`code:${codeKey}`, item);
    }
    if (nameKey) index.set(`name:${nameKey}`, item);
  }
  return index;
}

function resolveCatalogProduct(product, catalogIndex) {
  if (!catalogIndex || catalogIndex.size === 0) return null;
  if (product?.productId != null) {
    const byId = catalogIndex.get(`id:${product.productId}`);
    if (byId) return byId;
  }
  const codeKeys = [
    product?.code,
    product?.codigo,
    product?.codigoProducto,
    product?.codigoCatalogo,
  ]
    .map(productLookupKey)
    .filter(Boolean);
  for (const codeKey of codeKeys) {
    const byCode = catalogIndex.get(`code:${codeKey}`);
    if (byCode) return byCode;
  }
  const nameKey = productLookupKey(product?.name || product?.nombre || product?.nombreProducto);
  return nameKey ? catalogIndex.get(`name:${nameKey}`) || null : null;
}

function resolveOrderProductSummary(item, catalogIndex = new Map(), empresaId = null) {
  const products = normalizeOrderProducts(item).map(product => {
    if (product.imageUrl) return product;
    const catalogProduct = resolveCatalogProduct(product, catalogIndex);
    return catalogProduct?.imageUrl ? { ...product, imageUrl: catalogProduct.imageUrl } : product;
  });
  const names = products.map(product => orderProductLabel(product, empresaId ?? item?.empresaID ?? item?.empresaId)).filter(Boolean);
  return {
    products,
    productText: names.slice(0, 2).join(", "),
    title: names.join(", "),
  };
}

function textFromValue(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(
      value.nombreCompleto ||
      value.nombre_completo ||
      value.nombre ||
      value.name ||
      value.label ||
      ""
    ).trim();
  }
  return String(value).trim();
}

function resolveFloristaName(item) {
  const candidates = [
    item?.floristaAsignado,
    item?.florista_asignado,
    item?.floristaNombre,
    item?.nombreFlorista,
    item?.nombre_florista,
    item?.florista,
    item?.empleadoFlorista,
    item?.nombreEmpleadoFlorista,
    item?.produccion?.floristaAsignado,
    item?.produccion?.florista_asignado,
    item?.produccion?.floristaNombre,
    item?.produccion?.nombreFlorista,
    item?.produccion?.florista,
    item?.produccion?.empleado,
    item?.asignacionProduccion?.florista,
    item?.asignacionProduccion?.floristaAsignado,
  ];

  for (const value of candidates) {
    const text = textFromValue(value);
    if (text) return text;
  }

  const productionRows = [
    ...(Array.isArray(item?.producciones) ? item.producciones : []),
    ...(Array.isArray(item?.produccionItems) ? item.produccionItems : []),
    ...(Array.isArray(item?.detallesProduccion) ? item.detallesProduccion : []),
  ];
  const names = Array.from(new Set(productionRows.map(resolveFloristaName).filter(name => name && name !== "Sin asignar")));
  if (names.length > 0) return names.join(", ");

  return "Sin asignar";
}

export function buildOrdersMetrics(items, facturasPendientesImpresion = 0, targetDate = todayIsoDate()) {
  const rows = Array.isArray(items) ? items : [];
  const facturasNoImpresasVisibles = rows.filter(shouldShowPendingInvoiceAlert).length;
  const facturasNoImpresas = rows.length > 0
    ? facturasNoImpresasVisibles
    : Number(facturasPendientesImpresion || 0);
  return {
    total: rows.length,
    hoy: rows.filter(item => {
      const { date: fechaPedido } = splitDateTimeParts(item.fechaPedido || item.fecha);
      const entrega = orderDeliveryDate(item);
      return fechaPedido === targetDate || entrega === targetDate;
    }).length,
    aprobados: rows.filter(item => normalizeStatus(item.estado) === "APROBADO").length,
    pendientes: rows.filter(item => isPendingStatus(item.estado) || normalizeStatus(item.estado) === "CREADO").length,
    cancelados: rows.filter(item => ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item.estado))).length,
    facturasNoImpresas,
  };
}

export function shouldShowPendingInvoiceAlert(item) {
  return Boolean(item) && canInvoiceStatus(item.estado) && !item.facturaImpresa;
}

export function filterOrdersByStatus(items, estado) {
  const rows = Array.isArray(items) ? items : [];
  const normalizedFilter = normalizeStatus(estado);
  if (!normalizedFilter) return rows;

  return rows.filter(item => {
    const status = normalizeStatus(item?.estado);
    if (normalizedFilter === "APROBADO") return status === "APROBADO";
    if (normalizedFilter === "CREADO") return status === "CREADO" || isPendingStatus(status);
    if (normalizedFilter === "CANCELADO") return status === "CANCELADO" || status === "RECHAZADO";
    return status === normalizedFilter;
  });
}

export function filterOrdersByCreatedDateRange(items, fechaDesde, fechaHasta) {
  const rows = Array.isArray(items) ? items : [];
  const from = String(fechaDesde || "").slice(0, 10);
  const to = String(fechaHasta || fechaDesde || "").slice(0, 10);
  if (!from && !to) return rows;

  return rows.filter(item => {
    const createdDate = orderCreatedDate(item);
    if (!createdDate) return true;
    if (from && createdDate < from) return false;
    if (to && createdDate > to) return false;
    return true;
  });
}

function normalizeOrderSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isStorePickupOrder(item) {
  if (!item || typeof item !== "object") return false;
  if (item.soloTienda === true || item.entregaEnTienda === true || item.recogerEnTienda === true) return true;
  if (item.solo_tienda === true || item.entrega_en_tienda === true || item.recoger_en_tienda === true) return true;

  const text = [
    item?.tipoEntrega,
    item?.tipo_entrega,
    item?.entregaTipo,
    item?.entrega_tipo,
    item?.tipoEntregaNombre,
    item?.tipo_entrega_nombre,
    item?.modalidadEntrega,
    item?.modalidad_entrega,
    item?.barrio,
    item?.barrioNombre,
    item?.barrio_nombre,
    item?.direccion,
    item?.direccionEntrega,
    item?.direccion_entrega,
    item?.direccionDestino,
    item?.direccion_destino,
    item?.destinatario?.tipoEntrega,
    item?.destinatario?.tipo_entrega,
    item?.destinatario?.barrio,
    item?.destinatario?.barrioNombre,
    item?.destinatario?.direccion,
    item?.destinatario?.direccionEntrega,
    item?.destinatario?.direccion_entrega,
    item?.entrega?.tipoEntrega,
    item?.entrega?.tipo_entrega,
    item?.entrega?.barrio,
    item?.entrega?.barrioNombre,
    item?.entrega?.direccion,
    item?.entrega?.direccionEntrega,
    item?.entrega?.direccion_entrega,
    item?.entrega?.direccionDestino,
    item?.entrega?.direccion_destino,
  ].map(normalizeOrderSearchText).filter(Boolean).join(" ");

  const compact = text.replace(/[^a-z0-9]+/g, "");
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

function filterStorePickupOrders(items) {
  return (Array.isArray(items) ? items : []).filter(isStorePickupOrder);
}

function paymentMethodSearchValues(item) {
  const financiero = item?.financiero || item?.financial || {};
  const directValues = [
    item?.metodoPago,
    item?.metodo_pago,
    item?.medioPago,
    item?.medio_pago,
    financiero?.metodoPago,
    financiero?.metodo_pago,
    financiero?.medioPago,
    financiero?.medio_pago,
    financiero?.cuentaBancaria,
  ];
  const arraySources = [
    item?.metodosPago,
    item?.metodos_pago,
    financiero?.metodosPago,
    financiero?.metodos_pago,
    item?.detallePago,
    item?.desglosePago,
    financiero?.detallePago,
    financiero?.desglosePago,
    financiero?.metodosPagoDetalle,
    financiero?.paymentBreakdown,
  ];

  return [
    ...directValues,
    ...arraySources.flatMap(source => {
      if (!Array.isArray(source)) return [];
      return source.map(value => {
        if (value && typeof value === "object") {
          return value.metodo || value.metodoPago || value.nombre || value.cuenta || value.label || "";
        }
        return value;
      });
    }),
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function isPaymentSearchTerm(value) {
  const search = normalizeOrderSearchText(value);
  if (!search) return false;
  const paymentKeywords = [
    "efectivo",
    "link",
    "bold",
    "payu",
    "wompi",
    "transferencia",
    "tarjeta",
    "nequi",
    "daviplata",
    "bancolombia",
    "rappi",
    "datafono",
    "credito",
    "debito",
  ];
  return paymentKeywords.some(keyword => keyword.includes(search) || search.includes(keyword));
}

function orderNumberSearchValues(item) {
  return [
    resolveDisplayOrderNumber(item),
    item?.pedidoID,
    item?.pedidoId,
    item?.pedido_id,
    item?.numeroPedido,
    item?.numero_pedido,
    item?.codigoPedido,
    item?.codigo_pedido,
    item?.pedido?.pedidoID,
    item?.pedido?.pedidoId,
    item?.pedido?.pedido_id,
    item?.pedido?.numeroPedido,
    item?.pedido?.numero_pedido,
    item?.pedido?.codigoPedido,
    item?.pedido?.codigo_pedido,
    item?.data?.pedidoID,
    item?.data?.pedidoId,
    item?.data?.pedido_id,
    item?.data?.numeroPedido,
    item?.data?.numero_pedido,
    item?.data?.codigoPedido,
    item?.data?.codigo_pedido,
  ]
    .map(value => String(value ?? "").trim())
    .filter(value => value && value !== "-");
}

function orderMatchesNumberSearch(item, search) {
  return orderNumberSearchValues(item).some(value => normalizeOrderSearchText(value).includes(search));
}

function isOrderNumberSearchTerm(value) {
  const text = String(value || "").trim();
  return /^#?\d{1,8}$/.test(text);
}

export function filterOrdersBySearch(items, searchValue, empresaId = null) {
  const search = normalizeOrderSearchText(searchValue);
  const rows = Array.isArray(items) ? items : [];
  if (!search) return rows;

  const orderNumberMatches = rows.filter(item => orderMatchesNumberSearch(item, search));
  if (orderNumberMatches.length > 0) return orderNumberMatches;

  return rows.filter(item => {
    const productSummary = resolveOrderProductSummary(item, new Map(), empresaId);
    const values = [
      item?.cliente,
      item?.clienteNombre,
      item?.cliente_nombre,
      item?.destinatario,
      item?.destinatarioNombre,
      item?.destinatario_nombre,
      item?.telefono,
      item?.telefonoCompleto,
      item?.celular,
      item?.email,
      productSummary.productText,
      productSummary.title,
      ...paymentMethodSearchValues(item),
    ];
    return values.some(value => normalizeOrderSearchText(value).includes(search));
  });
}

export function filterOrdersByPaymentMethod(items, paymentMethod) {
  const search = normalizeOrderSearchText(paymentMethod);
  const rows = Array.isArray(items) ? items : [];
  if (!search) return rows;
  return rows.filter(item => paymentMethodSearchValues(item).some(value => normalizeOrderSearchText(value).includes(search)));
}

function normalizeWholePeso(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function sanitizeWholePesoInput(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return normalizeWholePeso(digits);
}

function clampPercentage(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, roundCurrency(parsed)));
}

function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return Boolean(session?.esGlobalJoin) || role === "admin" || role === "empresa_admin";
}

function ensureRappiOption(options) {
  const normalized = Array.isArray(options)
    ? options.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  return normalized.includes("RAPPI") ? normalized : [...normalized, "RAPPI"];
}

function buildOrderFinancialPreview(
  financiero,
  methods = [],
  omitirRecargoLink = false,
  descuentoMontoInput = 0,
  saldoFavorMontoInput = 0
) {
  const subtotal = roundCurrency(financiero?.subtotal ?? 0);
  const iva = roundCurrency(financiero?.iva ?? 0);
  const domicilio = roundCurrency(financiero?.domicilio ?? 0);
  const baseTotal = roundCurrency(subtotal + iva + domicilio);
  const hasLinkPayment = normalizePaymentMethods(methods).some(isLinkPaymentMethod);
  const recargoPct = hasLinkPayment && !omitirRecargoLink ? 5 : 0;
  const recargoMonto = roundCurrency((baseTotal * recargoPct) / 100);
  const totalAntesDescuento = roundCurrency(baseTotal + recargoMonto);
  const descuentoMonto = Math.max(0, Math.min(totalAntesDescuento, normalizeWholePeso(descuentoMontoInput) ?? 0));
  const totalDespuesDescuento = roundCurrency(totalAntesDescuento - descuentoMonto);
  const saldoFavorMonto = Math.max(0, normalizeWholePeso(saldoFavorMontoInput) ?? 0);
  const total = roundCurrency(totalDespuesDescuento + saldoFavorMonto);
  return {
    subtotal,
    iva,
    domicilio,
    baseTotal,
    hasLinkPayment,
    recargoPct,
    recargoMonto,
    descuentoMonto,
    saldoFavorMonto,
    total,
  };
}

function getOrderFinancialTotal(financiero) {
  const storedTotal = roundCurrency(financiero?.total ?? 0);
  const hasFinancialParts = [
    "subtotal",
    "iva",
    "domicilio",
    "recargoLinkMonto",
    "descuentoMonto",
    "saldoFavorMonto",
  ].some(key => financiero?.[key] != null);

  if (!hasFinancialParts) return storedTotal;

  const subtotal = roundCurrency(financiero?.subtotal ?? 0);
  const iva = roundCurrency(financiero?.iva ?? 0);
  const domicilio = roundCurrency(financiero?.domicilio ?? 0);
  const recargo = roundCurrency(financiero?.recargoLinkMonto ?? 0);
  const descuento = roundCurrency(financiero?.descuentoMonto ?? 0);
  const saldoFavor = roundCurrency(financiero?.saldoFavorMonto ?? 0);
  return roundCurrency(subtotal + iva + domicilio + recargo - descuento + saldoFavor);
}

function resolveOrderListTotal(item) {
  const financiero = item?.financiero || item?.financial || item;
  const storedTotal = roundCurrency(item?.total ?? item?.valorTotal ?? item?.totalPedido ?? financiero?.total ?? 0);
  const hasFinancialParts = [
    "subtotal",
    "iva",
    "domicilio",
    "costoDomicilio",
    "costo_domicilio",
    "recargoLinkMonto",
    "descuentoMonto",
    "saldoFavorMonto",
  ].some(key => financiero?.[key] != null || item?.[key] != null);

  if (!hasFinancialParts) return storedTotal;

  const subtotal = roundCurrency(financiero?.subtotal ?? item?.subtotal ?? 0);
  const iva = roundCurrency(financiero?.iva ?? item?.iva ?? 0);
  const domicilio = roundCurrency(
    financiero?.domicilio ??
    financiero?.costoDomicilio ??
    financiero?.costo_domicilio ??
    item?.domicilio ??
    item?.costoDomicilio ??
    item?.costo_domicilio ??
    0
  );
  const recargo = roundCurrency(financiero?.recargoLinkMonto ?? item?.recargoLinkMonto ?? 0);
  const descuento = roundCurrency(financiero?.descuentoMonto ?? item?.descuentoMonto ?? 0);
  const saldoFavor = roundCurrency(financiero?.saldoFavorMonto ?? item?.saldoFavorMonto ?? 0);
  return roundCurrency(subtotal + iva + domicilio + recargo - descuento + saldoFavor);
}

export function extractOrdersPayloadItems(payload) {
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
    payload?.data?.pedido,
    payload?.data?.orders,
    payload?.data?.rows,
    payload?.result,
    payload?.result?.items,
    payload?.result?.pedidos,
    payload?.result?.orders,
    payload?.result?.rows,
    payload?.resultados,
    payload?.resultados?.items,
    payload?.resultados?.pedidos,
  ];
  return candidates.find(Array.isArray) || [];
}

function hasOrdersPayloadTotal(payload) {
  const candidates = [
    payload?.total,
    payload?.totalItems,
    payload?.totalRegistros,
    payload?.total_registros,
    payload?.totalRows,
    payload?.total_rows,
    payload?.count,
    payload?.data?.total,
    payload?.data?.totalItems,
    payload?.data?.totalRegistros,
    payload?.data?.total_registros,
    payload?.data?.count,
    payload?.result?.total,
    payload?.result?.totalItems,
    payload?.result?.totalRegistros,
    payload?.result?.count,
  ];
  return candidates.some(item => item != null && item !== "" && Number.isFinite(Number(item)));
}

export function resolveOrdersPayloadTotal(payload, fallbackItems) {
  const candidates = [
    payload?.total,
    payload?.totalItems,
    payload?.totalRegistros,
    payload?.total_registros,
    payload?.totalRows,
    payload?.total_rows,
    payload?.count,
    payload?.data?.total,
    payload?.data?.totalItems,
    payload?.data?.totalRegistros,
    payload?.data?.total_registros,
    payload?.data?.count,
    payload?.result?.total,
    payload?.result?.totalItems,
    payload?.result?.totalRegistros,
    payload?.result?.count,
  ];
  const value = candidates.find(item => item != null && item !== "");
  const total = Number(value);
  return Number.isFinite(total) ? total : fallbackItems.length;
}

function extractPaymentBreakdown(financiero) {
  const sources = [
    financiero?.detallePago,
    financiero?.desglosePago,
    financiero?.metodosPagoDetalle,
    financiero?.paymentBreakdown,
  ];
  const rawItems = sources.find(Array.isArray) || [];
  return rawItems
    .map(item => {
      const metodo = String(item?.metodo || item?.metodoPago || item?.nombre || "").trim();
      const monto = Number(item?.monto ?? item?.valor ?? item?.amount);
      if (!metodo || !Number.isFinite(monto)) return null;
      return {
        metodo,
        monto: roundCurrency(monto),
      };
    })
    .filter(Boolean);
}

function normalizePaymentBreakdownForTotal(paymentBreakdown, totalPedido) {
  if (!Array.isArray(paymentBreakdown) || paymentBreakdown.length !== 1) return paymentBreakdown;
  const total = roundCurrency(totalPedido);
  if (total <= 0) return paymentBreakdown;
  return paymentBreakdown.map(item => ({
    ...item,
    monto: total,
  }));
}

function extractPaymentAmounts(financiero, paymentMethods = []) {
  const amounts = {};
  for (const item of extractPaymentBreakdown(financiero)) {
    amounts[item.metodo] = String(item.monto);
  }

  const normalizedMethods = normalizePaymentMethods(paymentMethods);
  if (normalizedMethods.length === 1 && isCashPaymentMethod(normalizedMethods[0])) {
    const efectivoMonto = Number(financiero?.montoEfectivo ?? financiero?.efectivoMonto);
    if (Number.isFinite(efectivoMonto) && efectivoMonto > 0) {
      amounts[normalizedMethods[0]] = String(roundCurrency(efectivoMonto));
    }
  }

  return amounts;
}

const initialFilters = {
  q: "",
  estado: "",
  sinImprimir: false,
  soloTienda: false,
  metodoPago: "",
  fechaDesde: todayIsoDateBogota(),
  fechaHasta: todayIsoDateBogota(),
  page: 1,
  pageSize: 10
};

const DEFAULT_ORDERS_KPIS = {
  ventaHoy: 0,
  pedidosHoy: 0,
  aprobados: 0,
  pendientes: 0,
  cancelados: 0,
  sinImprimir: 0,
};

const DEFAULT_NEW_ORDER_FORM = {
  productoID: "",
  productoCodigo: "",
  productoNombre: "",
  cantidad: 1,
  precio: "",
  clienteNombre: "",
  clienteTelefono: "",
  clienteEmail: "",
  clienteTipoIdent: "",
  clienteIdentificacion: "",
  destinatarioNombre: "",
  telefonoDestino: "",
  direccion: "",
  barrioNombre: "",
  fechaEntrega: todayIsoDateBogota(),
  horaEntrega: "08:00",
  mensajeTarjeta: "",
  firma: "",
  observacionGeneral: "",
  metodoPago: "",
  canalFlora: "",
};

function normalizeOrdersKpis(value, fallbackFacturasPendientesImpresion = 0) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ventaHoy: Number(source.ventaHoy || 0),
    pedidosHoy: Number(source.pedidosHoy || 0),
    aprobados: Number(source.aprobados || 0),
    pendientes: Number(source.pendientes || 0),
    cancelados: Number(source.cancelados || 0),
    sinImprimir: Number(source.sinImprimir ?? fallbackFacturasPendientesImpresion ?? 0),
  };
}

function buildOrdersCacheKey({ empresaId, sucursalId, q, estado, sinImprimir, soloTienda, metodoPago, fechaDesde, fechaHasta, page, pageSize }) {
  return [
    empresaId,
    sucursalId,
    q || "",
    estado || "",
    sinImprimir ? "1" : "0",
    soloTienda ? "1" : "0",
    metodoPago || "",
    fechaDesde || "",
    fechaHasta || "",
    page || 1,
    pageSize || 50,
  ].join("|");
}

function rememberOrdersCache(cache, key, value) {
  if (!cache || !key) return;
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > ORDERS_FILTER_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

const MESSAGE_CARD_FONT_OPTIONS = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond" },
  { value: "'EB Garamond', serif", label: "EB Garamond" },
  { value: "'Libre Baskerville', serif", label: "Libre Baskerville" },
  { value: "'Crimson Text', serif", label: "Crimson Text" },
  { value: "'Great Vibes', cursive", label: "Great Vibes" }
];
export function OrdersAdminPage({ session, canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewBarrios, canViewInventario, canViewContabilidad, canViewTrazabilidad, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario, onGoContabilidad, onGoTrazabilidad, onGoClientes, onGoUsuarios }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facturasPendientesImpresion, setFacturasPendientesImpresion] = useState(0);
  const [ordersKpis, setOrdersKpis] = useState(DEFAULT_ORDERS_KPIS);
  const [metricItems, setMetricItems] = useState([]);
  const [metricFacturasPendientesImpresion, setMetricFacturasPendientesImpresion] = useState(0);
  const [yesterdayMetrics, setYesterdayMetrics] = useState(() => buildOrdersMetrics([], 0, shiftIsoDate(todayIsoDate(), -1)));
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPedidoId, setSelectedPedidoId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [messageCardOpen, setMessageCardOpen] = useState(false);
  const [messageCardData, setMessageCardData] = useState(null);
  const [messageCardOrder, setMessageCardOrder] = useState(null);
  const [messageCardDraft, setMessageCardDraft] = useState("");
  const [messageCardSaving, setMessageCardSaving] = useState(false);
  const [messageCardError, setMessageCardError] = useState("");
  const [cardFontFamily, setCardFontFamily] = useState("Georgia, serif");
  const [cardFontSize, setCardFontSize] = useState(24);
  const [cardTextColor, setCardTextColor] = useState("#1f2937");
  const [cardTextAlign, setCardTextAlign] = useState("center");
  const [cardSignatureAlign, setCardSignatureAlign] = useState("right");
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [isDuplicatingDetail, setIsDuplicatingDetail] = useState(false);
  const [detailEditFilterText, setDetailEditFilterText] = useState("");
  const [detailEditCatalog, setDetailEditCatalog] = useState([]);
  const [detailEditCatalogLoading, setDetailEditCatalogLoading] = useState(false);
  const [detailEditDetalleID, setDetailEditDetalleID] = useState("");
  const [detailEditProductoID, setDetailEditProductoID] = useState("");
  const [detailEditNombreArreglo, setDetailEditNombreArreglo] = useState("");
  const [detailEditProductoCodigo, setDetailEditProductoCodigo] = useState("");
  const [detailEditCantidad, setDetailEditCantidad] = useState(1);
  const [detailEditProductoObservaciones, setDetailEditProductoObservaciones] = useState("");
  const [detailEditPrecio, setDetailEditPrecio] = useState(null);
  const [detailEditCustomPriceEnabled, setDetailEditCustomPriceEnabled] = useState(false);
  const [detailEditFechaEntrega, setDetailEditFechaEntrega] = useState("");
  const [detailEditHoraEntrega, setDetailEditHoraEntrega] = useState("");
  const [detailEditClienteNombre, setDetailEditClienteNombre] = useState("");
  const [detailEditClienteTelefono, setDetailEditClienteTelefono] = useState("");
  const [detailEditClienteEmail, setDetailEditClienteEmail] = useState("");
  const [detailEditClienteTipoIdent, setDetailEditClienteTipoIdent] = useState("");
  const [detailEditClienteIdentificacion, setDetailEditClienteIdentificacion] = useState("");
  const [detailEditDestinatarioNombre, setDetailEditDestinatarioNombre] = useState("");
  const [detailEditTelefonoDestino, setDetailEditTelefonoDestino] = useState("");
  const [detailEditDireccion, setDetailEditDireccion] = useState("");
  const [detailEditBarrioNombre, setDetailEditBarrioNombre] = useState("");
  const [detailEditBarrioQuery, setDetailEditBarrioQuery] = useState("");
  const [detailEditBarrios, setDetailEditBarrios] = useState([]);
  const [detailEditBarriosLoading, setDetailEditBarriosLoading] = useState(false);
  const [detailEditBarrioDropdownOpen, setDetailEditBarrioDropdownOpen] = useState(false);
  const [detailEditFirma, setDetailEditFirma] = useState("");
  const [detailEditMensajeTarjeta, setDetailEditMensajeTarjeta] = useState("");
  const [detailEditObservacionGeneral, setDetailEditObservacionGeneral] = useState("");
  const [detailEditMetodosPago, setDetailEditMetodosPago] = useState([]);
  const [detailEditPaymentAmounts, setDetailEditPaymentAmounts] = useState({});
  const [detailEditOmitirRecargoLink, setDetailEditOmitirRecargoLink] = useState(false);
  const [detailEditDescuentoMonto, setDetailEditDescuentoMonto] = useState("");
  const [detailEditDescuentoNota, setDetailEditDescuentoNota] = useState("");
  const [detailEditSaldoFavorMonto, setDetailEditSaldoFavorMonto] = useState("");
  const [detailEditSaldoFavorNota, setDetailEditSaldoFavorNota] = useState("");
  const [detailEditCanalFlora, setDetailEditCanalFlora] = useState("");
  const [detailEditSaving, setDetailEditSaving] = useState(false);
  const [detailEditError, setDetailEditError] = useState("");
  const [detailEditDropdownOpen, setDetailEditDropdownOpen] = useState(false);
  const [detailEditDeletingDetailId, setDetailEditDeletingDetailId] = useState(null);
  const [detailEditSubview, setDetailEditSubview] = useState("edit");
  const [detailAddDropdownOpen, setDetailAddDropdownOpen] = useState(false);
  const [detailAddFilterText, setDetailAddFilterText] = useState("");
  const [detailAddProductoID, setDetailAddProductoID] = useState("");
  const [detailAddProductoCodigo, setDetailAddProductoCodigo] = useState("");
  const [detailAddNombreArreglo, setDetailAddNombreArreglo] = useState("");
  const [detailAddCantidad, setDetailAddCantidad] = useState(1);
  const [detailAddPrecio, setDetailAddPrecio] = useState(null);
  const [detailAddSaving, setDetailAddSaving] = useState(false);
  const [approvingPedidoIds, setApprovingPedidoIds] = useState([]);
  const [openOrderActionsId, setOpenOrderActionsId] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [orderNotification, setOrderNotification] = useState(null);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState(DEFAULT_NEW_ORDER_FORM);
  const [newOrderProductQuery, setNewOrderProductQuery] = useState("");
  const [newOrderProducts, setNewOrderProducts] = useState([]);
  const [newOrderProductsLoading, setNewOrderProductsLoading] = useState(false);
  const [newOrderProductDropdownOpen, setNewOrderProductDropdownOpen] = useState(false);
  const [newOrderBarrioQuery, setNewOrderBarrioQuery] = useState("");
  const [newOrderBarrios, setNewOrderBarrios] = useState([]);
  const [newOrderBarrioDropdownOpen, setNewOrderBarrioDropdownOpen] = useState(false);
  const [newOrderSaving, setNewOrderSaving] = useState(false);
  const [newOrderError, setNewOrderError] = useState("");

  const api = useMemo(() => createApiClient(tenantConfig), []);
  const ordersRequestTracker = useMemo(() => ({ current: 0 }), []);
  const visibleOrdersLoadingRequest = useRef(0);
  const loadOrdersRef = useRef(null);
  const loadTodaySalesSummaryRef = useRef(null);
  const ordersFilterCache = useMemo(() => new Map(), []);
  const debouncedQuery = useDebouncedValue(filters.q, 300);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );
  const pedidoMenuFields = useMemo(
    () => (Array.isArray(detalle?.camposEmpresa?.pedidoDetalle) ? detalle.camposEmpresa.pedidoDetalle : []),
    [detalle]
  );
  const paymentFieldConfig = useMemo(
    () => pedidoMenuFields.find(field => field?.codigo === "pedido_metodos_pago" && field?.activo),
    [pedidoMenuFields]
  );
  const paymentFieldOptions = useMemo(
    () => ensureRappiOption(paymentFieldConfig?.opciones),
    [paymentFieldConfig]
  );
  const salesChannelFieldConfig = useMemo(
    () => pedidoMenuFields.find(field => field?.codigo === "pedido_canal_venta" && field?.activo),
    [pedidoMenuFields]
  );
  const canEditClientIdentity = useMemo(() => isEmpresaAdminRole(session), [session]);
  const catalogProductIndex = useMemo(
    () => buildCatalogProductIndex(catalogProducts),
    [catalogProducts]
  );
  const detailEmpresaId = useMemo(
    () => Number(detalle?.empresaID || detalle?.empresaId || empresaId),
    [detalle, empresaId]
  );
  const detailEditCatalogProduct = useMemo(() => {
    const selected = detailEditCatalog.find(item => String(item.id) === String(detailEditProductoID));
    if (selected) return selected;
    if (detailEditProductoID) {
      const byId = catalogProductIndex.get(`id:${detailEditProductoID}`);
      if (byId) return byId;
    }
    return resolveCatalogProduct({
      code: detailEditProductoCodigo,
      codigoProducto: detailEditProductoCodigo,
      name: detailEditNombreArreglo,
      nombre: detailEditNombreArreglo,
    }, catalogProductIndex);
  }, [catalogProductIndex, detailEditCatalog, detailEditNombreArreglo, detailEditProductoCodigo, detailEditProductoID]);
  const detailAddCatalogProduct = useMemo(() => {
    const selected = detailEditCatalog.find(item => String(item.id) === String(detailAddProductoID));
    if (selected) return selected;
    if (detailAddProductoID) {
      const byId = catalogProductIndex.get(`id:${detailAddProductoID}`);
      if (byId) return byId;
    }
    return resolveCatalogProduct({
      code: detailAddProductoCodigo,
      codigoProducto: detailAddProductoCodigo,
      name: detailAddNombreArreglo,
      nombre: detailAddNombreArreglo,
    }, catalogProductIndex);
  }, [catalogProductIndex, detailAddNombreArreglo, detailAddProductoCodigo, detailAddProductoID, detailEditCatalog]);
  const detailProducts = useMemo(
    () => (Array.isArray(detalle?.productos) ? detalle.productos : []),
    [detalle]
  );
  const detailSelectedProduct = useMemo(() => {
    if (detailProducts.length === 0) return null;
    if (detailEditDetalleID) {
      const byDetailId = detailProducts.find(product => String(product?.detalleID ?? "") === String(detailEditDetalleID));
      if (byDetailId) return byDetailId;
    }
    if (detailEditProductoID) {
      const byProductId = detailProducts.find(product => String(getProductoId(product) ?? "") === String(detailEditProductoID));
      if (byProductId) return byProductId;
    }
    return detailProducts[0];
  }, [detailEditDetalleID, detailEditProductoID, detailProducts]);
  const detailEditDisplayProductoCodigo = useMemo(() => (
    displayProductCode(
      detailSelectedProduct || detailEditCatalogProduct || {
        codigo: detailEditProductoCodigo,
        codigoProducto: detailEditProductoCodigo,
      },
      detailEmpresaId
    ) || detailEditProductoCodigo
  ), [detailEditCatalogProduct, detailEditProductoCodigo, detailEmpresaId, detailSelectedProduct]);
  const detailAddDisplayProductoCodigo = useMemo(() => (
    displayProductCode(
      detailAddCatalogProduct || {
        codigo: detailAddProductoCodigo,
        codigoProducto: detailAddProductoCodigo,
      },
      detailEmpresaId
    ) || detailAddProductoCodigo
  ), [detailAddCatalogProduct, detailAddProductoCodigo, detailEmpresaId]);
  const detailEditSelectedPaymentMethods = useMemo(
    () => normalizePaymentMethods(detailEditMetodosPago),
    [detailEditMetodosPago]
  );
  const detailEditIsCustomArrangement = useMemo(
    () => isCustomArrangement({
      codigo: detailEditProductoCodigo,
      nombre: detailEditNombreArreglo,
      observaciones: detailEditProductoObservaciones,
    }),
    [detailEditNombreArreglo, detailEditProductoCodigo, detailEditProductoObservaciones]
  );
  const detailEditHasCashPayment = useMemo(
    () => detailEditSelectedPaymentMethods.some(method => isCashPaymentMethod(method)),
    [detailEditSelectedPaymentMethods]
  );
  const detailEditHasLinkPayment = useMemo(
    () => detailEditSelectedPaymentMethods.some(method => isLinkPaymentMethod(method)),
    [detailEditSelectedPaymentMethods]
  );
  const detailEditRequiresPaymentBreakdown = useMemo(
    () => detailEditSelectedPaymentMethods.length > 1,
    [detailEditSelectedPaymentMethods]
  );
  const detailEditSelectedBarrio = useMemo(() => {
    const normalizedSelected = String(detailEditBarrioNombre || "").trim().toLowerCase();
    if (!normalizedSelected) return null;
    return detailEditBarrios.find(item => String(item?.nombre || "").trim().toLowerCase() === normalizedSelected) || null;
  }, [detailEditBarrioNombre, detailEditBarrios]);
  const detailEditFinancialPreview = useMemo(
    () => {
      const baseFinancial = {
        ...(detalle?.financiero || {}),
      };
      const normalizedDeliveryType = normalizeDeliveryType(detailEditBarrioNombreOrFallback(
        detailEditBarrioNombre,
        detalle?.destinatario?.barrio
      ));
      if (normalizedDeliveryType === "recogida_en_tienda") {
        baseFinancial.domicilio = 0;
      } else if (detailEditSelectedBarrio?.costoDomicilio != null) {
        baseFinancial.domicilio = Number(detailEditSelectedBarrio.costoDomicilio || 0);
      }
      return buildOrderFinancialPreview(
        baseFinancial,
        detailEditSelectedPaymentMethods,
        detailEditOmitirRecargoLink,
        detailEditDescuentoMonto,
        detailEditSaldoFavorMonto
      );
    },
    [detalle, detailEditBarrioNombre, detailEditSelectedBarrio, detailEditSelectedPaymentMethods, detailEditOmitirRecargoLink, detailEditDescuentoMonto, detailEditSaldoFavorMonto]
  );
  const detailEditShowPriceField = detailEditCustomPriceEnabled || detailEditPrecio != null;
  const detailEditSelectedProductLabel = useMemo(() => {
    const selected = detailSelectedProduct || detailEditCatalogProduct;
    if (selected) {
      return buildProductoLabel(selected, detailEmpresaId);
    }
    if (detailEditNombreArreglo || detailEditProductoCodigo) {
      return buildProductoLabel({
        codigo: detailEditProductoCodigo,
        codigoProducto: detailEditProductoCodigo,
        nombre: detailEditNombreArreglo,
      }, detailEmpresaId);
    }
    return "— Selecciona un arreglo —";
  }, [detailEditCatalogProduct, detailEditNombreArreglo, detailEditProductoCodigo, detailEmpresaId, detailSelectedProduct]);
  const detailAddIsCustomArrangement = useMemo(
    () => isCustomArrangement({
      codigo: detailAddProductoCodigo,
      nombre: detailAddNombreArreglo,
      observaciones: "",
    }),
    [detailAddNombreArreglo, detailAddProductoCodigo]
  );
  const detailAddSelectedProductLabel = useMemo(() => {
    if (detailAddCatalogProduct) {
      return buildProductoLabel(detailAddCatalogProduct, detailEmpresaId);
    }
    if (detailAddNombreArreglo || detailAddProductoCodigo) {
      return buildProductoLabel({
        codigo: detailAddProductoCodigo,
        codigoProducto: detailAddProductoCodigo,
        nombre: detailAddNombreArreglo,
      }, detailEmpresaId);
    }
    return "— Selecciona un arreglo —";
  }, [detailAddCatalogProduct, detailAddNombreArreglo, detailAddProductoCodigo, detailEmpresaId]);

  const applySelectedDetailProduct = useCallback((product, nextDetalleId = null) => {
    if (!product) return;
    const detalleId = nextDetalleId ?? (product?.detalleID != null ? Number(product.detalleID) : null);
    const productoId = getProductoId(product);
    const productoCodigo = displayProductCode(product, detailEmpresaId);
    const productoNombre = String(product?.nombreProducto || product?.nombre || "").trim();
    const productoObservaciones = String(product?.observaciones || "").trim();
    const productoPrecio = normalizeWholePeso(product?.precioUnitario ?? product?.precio ?? product?.subtotal ?? 0);

    setDetailEditDetalleID(detalleId != null ? String(detalleId) : "");
    setDetailEditProductoID(productoId != null ? String(productoId) : "");
    setDetailEditProductoCodigo(productoCodigo);
    setDetailEditCantidad(Number(product?.cantidad || 1));
    setDetailEditNombreArreglo(productoNombre);
    setDetailEditProductoObservaciones(productoObservaciones);
    setDetailEditPrecio(productoPrecio);
    setDetailEditCustomPriceEnabled(isCustomArrangement({
      codigo: productoCodigo,
      nombre: productoNombre,
      observaciones: productoObservaciones,
    }));
  }, [detailEmpresaId]);

  const loadBarrioOptions = useCallback(async (query = "") => {
    const text = String(query || "").trim();
    setDetailEditBarriosLoading(true);
    try {
      const payload = await api.buscarBarrios({ empresaId, sucursalId, q: text });
      const rows = Array.isArray(payload) ? payload : [];
      const loaded = rows.map(item => normalizeBarrioItem(item)).filter(Boolean);
      setDetailEditBarrios(current => dedupeBarrioItems([
        normalizeBarrioItem({ nombreBarrio: "Recoger en tienda" }),
        normalizeBarrioItem({ nombreBarrio: detailEditBarrioNombre }),
        ...current,
        ...loaded,
      ].filter(Boolean)));
    } catch {
      setDetailEditBarrios(current => dedupeBarrioItems([
        normalizeBarrioItem({ nombreBarrio: "Recoger en tienda" }),
        normalizeBarrioItem({ nombreBarrio: detailEditBarrioNombre }),
        ...current,
      ].filter(Boolean)));
    } finally {
      setDetailEditBarriosLoading(false);
    }
  }, [api, detailEditBarrioNombre, empresaId, sucursalId]);

  const loadOrders = useCallback(async (silent = false) => {
    if (silent && visibleOrdersLoadingRequest.current) return;

    const requestId = silent ? ordersRequestTracker.current : ordersRequestTracker.current + 1;
    if (!silent) {
      ordersRequestTracker.current = requestId;
    }
    const requestFilters = {
      empresaId,
      sucursalId,
      q: debouncedQuery,
      backendQ: isPaymentSearchTerm(debouncedQuery) ? "" : debouncedQuery,
      estado: filters.estado,
      sinImprimir: filters.sinImprimir,
      soloTienda: filters.soloTienda,
      metodoPago: filters.metodoPago,
      fechaDesde: filters.fechaDesde,
      fechaHasta: filters.fechaHasta,
      page: filters.page,
      pageSize: filters.pageSize,
    };
    const searchByOrderNumber = !requestFilters.soloTienda && isOrderNumberSearchTerm(requestFilters.q);
    const requestFechaDesde = searchByOrderNumber ? "" : requestFilters.fechaDesde;
    const requestFechaHasta = searchByOrderNumber ? "" : requestFilters.fechaHasta;
    const cacheKey = buildOrdersCacheKey({
      ...requestFilters,
      fechaDesde: requestFechaDesde,
      fechaHasta: requestFechaHasta,
    });
    const cached = !silent ? ordersFilterCache.get(cacheKey) : null;

    if (cached) {
      const cachedItems = requestFilters.soloTienda
        ? cached.items
        : filterOrdersByCreatedDateRange(cached.items, requestFechaDesde, requestFechaHasta);
      const cachedMetricItems = requestFilters.soloTienda
        ? cached.metricItems
        : filterOrdersByCreatedDateRange(cached.metricItems, requestFechaDesde, requestFechaHasta);
      const cachedHadOutOfRangeItems = cachedItems.length !== (Array.isArray(cached.items) ? cached.items.length : 0);
      setItems(cachedItems);
      setTotal(cachedHadOutOfRangeItems ? cachedItems.length : cached.total);
      setFacturasPendientesImpresion(cached.facturasPendientesImpresion);
      setOrdersKpis(cached.kpis || DEFAULT_ORDERS_KPIS);
      setMetricItems(cachedMetricItems);
      setMetricFacturasPendientesImpresion(cached.metricFacturasPendientesImpresion);
      setError("");
      if (!silent) {
        visibleOrdersLoadingRequest.current = 0;
        setLoading(false);
      }
    }

    if (!silent && !cached) {
      visibleOrdersLoadingRequest.current = requestId;
      setLoading(true);
      setError("");
    }

    try {
      const data = await api.listarPedidos({
        empresaId: requestFilters.empresaId,
        sucursalId: requestFilters.sucursalId,
        q: requestFilters.backendQ,
        estado: requestFilters.estado,
        sinImprimir: requestFilters.sinImprimir,
        soloTienda: requestFilters.soloTienda,
        fechaDesde: localDateStartParam(requestFechaDesde),
        fechaHasta: localDateEndParam(requestFechaHasta),
        page: requestFilters.page,
        pageSize: requestFilters.pageSize
      });

      if (!silent && requestId !== ordersRequestTracker.current) return;
      if (silent && (requestId !== ordersRequestTracker.current || visibleOrdersLoadingRequest.current)) return;

      const loadedItems = extractOrdersPayloadItems(data);
      const dateItems = requestFilters.soloTienda
        ? loadedItems
        : filterOrdersByCreatedDateRange(loadedItems, requestFechaDesde, requestFechaHasta);
      const storeItems = dateItems;
      const statusItems = filterOrdersByStatus(storeItems, requestFilters.estado);
      const paymentItems = filterOrdersByPaymentMethod(statusItems, requestFilters.metodoPago);
      const visibleItems = filterOrdersBySearch(paymentItems, requestFilters.q, requestFilters.empresaId);
      const backendReturnedOutOfRangeItems = dateItems.length !== loadedItems.length;
      const nextTotal = requestFilters.estado || backendReturnedOutOfRangeItems
        ? visibleItems.length
        : resolveOrdersPayloadTotal(data, visibleItems);
      const nextFacturasPendientesImpresion = Number(data.facturasPendientesImpresion || 0);
      const nextKpis = normalizeOrdersKpis(data?.kpis, nextFacturasPendientesImpresion);
      const nextCacheValue = {
        items: visibleItems,
        total: nextTotal,
        facturasPendientesImpresion: nextFacturasPendientesImpresion,
        kpis: nextKpis,
        metricItems: visibleItems,
        metricFacturasPendientesImpresion: nextFacturasPendientesImpresion,
      };
      rememberOrdersCache(ordersFilterCache, cacheKey, nextCacheValue);
      setItems(visibleItems);
      setTotal(nextTotal);
      setFacturasPendientesImpresion(nextFacturasPendientesImpresion);
      setOrdersKpis(nextKpis);
      setMetricItems(visibleItems);
      setMetricFacturasPendientesImpresion(nextFacturasPendientesImpresion);
      setError("");
      return nextCacheValue;
    } catch (nextError) {
      if (!silent && requestId !== ordersRequestTracker.current) return;
      if (silent && (requestId !== ordersRequestTracker.current || visibleOrdersLoadingRequest.current)) return;
      if (cached) {
        setError("");
        return cached;
      }
      console.error("Error cargando pedidos:", nextError);
      setItems([]);
      setTotal(0);
      setFacturasPendientesImpresion(0);
      setOrdersKpis(DEFAULT_ORDERS_KPIS);
      setMetricItems([]);
      setMetricFacturasPendientesImpresion(0);
      setError("No fue posible cargar pedidos.");
    } finally {
      if (!silent && visibleOrdersLoadingRequest.current === requestId) {
        visibleOrdersLoadingRequest.current = 0;
        setLoading(false);
      }
    }
  }, [api, debouncedQuery, filters.estado, filters.sinImprimir, filters.soloTienda, filters.metodoPago, filters.fechaDesde, filters.fechaHasta, filters.page, filters.pageSize, empresaId, ordersFilterCache, ordersRequestTracker, sucursalId]);

  const loadYesterdayMetrics = useCallback(async () => {
    setYesterdayMetrics(buildOrdersMetrics([], 0, shiftIsoDate(todayIsoDate(), -1)));
    return;

    const yesterday = shiftIsoDate(todayIsoDate(), -1);
    try {
      const data = await api.listarPedidos({
        empresaId,
        sucursalId,
        q: "",
        estado: "",
        sinImprimir: false,
        soloTienda: filters.soloTienda,
        fechaDesde: localDateStartParam(yesterday),
        fechaHasta: localDateEndParam(yesterday),
        page: 1,
        pageSize: 50,
      });
      setYesterdayMetrics(buildOrdersMetrics(
        extractOrdersPayloadItems(data),
        Number(data.facturasPendientesImpresion || 0),
        yesterday
      ));
    } catch {
      setYesterdayMetrics(buildOrdersMetrics([], 0, yesterday));
    }
  }, [api, empresaId, filters.soloTienda, sucursalId]);

  const loadTodaySalesSummary = useCallback(async () => {
    setTodaySalesTotal(0);
    return;

    const today = todayIsoDate();
    const pageSize = 300;
    const dateRequestVariants = [
      { fechaDesde: localDateStartParam(today), fechaHasta: localDateEndParam(today), stopOnPreviousDays: false },
      { fechaDesde: "", fechaHasta: "", stopOnPreviousDays: true },
    ];

    try {
      for (const requestVariant of dateRequestVariants) {
        const rowsByKey = new Map();

        for (let pageIndex = 1; pageIndex <= 25; pageIndex += 1) {
          const data = await api.listarPedidos({
            empresaId,
            sucursalId,
            q: "",
            estado: "",
            sinImprimir: false,
            soloTienda: false,
            fechaDesde: requestVariant.fechaDesde,
            fechaHasta: requestVariant.fechaHasta,
            page: pageIndex,
            pageSize,
          });

          const rows = extractOrdersPayloadItems(data);
          rows.forEach((item, index) => {
            const displayNumber = String(resolveDisplayOrderNumber(item) || "").trim();
            const key = item?.pedidoID != null
              ? `pedido:${item.pedidoID}`
              : item?.id != null
                ? `id:${item.id}`
                : displayNumber && displayNumber !== "-"
                  ? `numero:${displayNumber}`
                  : `row:${pageIndex}-${index}`;
            rowsByKey.set(key, item);
          });

          const payloadHasTotal = hasOrdersPayloadTotal(data);
          const totalRows = resolveOrdersPayloadTotal(data, rows);
          const datedRows = rows.map(orderCreatedDate).filter(Boolean);
          const reachedPreviousDays = requestVariant.stopOnPreviousDays && datedRows.length > 0 && datedRows.every(date => date < today);
          if (!Array.isArray(rows) || rows.length < pageSize || (payloadHasTotal && rowsByKey.size >= totalRows) || reachedPreviousDays) break;
        }

        const totalSales = calculateTodaySalesTotal(Array.from(rowsByKey.values()), today);
        if (totalSales > 0 || rowsByKey.size > 0) {
          setTodaySalesTotal(totalSales);
          return;
        }
      }

      setTodaySalesTotal(0);
    } catch (nextError) {
      console.error("Error cargando venta del día:", nextError);
    }
  }, [api, empresaId, sucursalId]);

  useEffect(() => {
    loadOrders(false);
  }, [loadOrders]);

  useEffect(() => {
    loadOrdersRef.current = loadOrders;
  }, [loadOrders]);

  useEffect(() => {
    loadTodaySalesSummaryRef.current = loadTodaySalesSummary;
  }, [loadTodaySalesSummary]);

  useEffect(() => {
    loadYesterdayMetrics();
  }, [loadYesterdayMetrics]);

  useEffect(() => {
    loadTodaySalesSummary();
  }, [loadTodaySalesSummary]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      if (globalThis.document?.hidden) return;
      loadOrdersRef.current?.(true);
      loadTodaySalesSummaryRef.current?.();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => globalThis.clearInterval(intervalId);
  }, []);


  useEffect(() => {
    const body = document.body;
    if (!body) return undefined;

    if (messageCardOpen) {
      body.classList.add("print-message-card-mode");
    } else {
      body.classList.remove("print-message-card-mode");
    }

    return () => body.classList.remove("print-message-card-mode");
  }, [messageCardOpen]);

  useEffect(() => {
    if (!detalle || detalle.error) {
      setIsEditingDetail(false);
      setDetailEditFilterText("");
      setDetailEditCatalog([]);
      setDetailEditDetalleID("");
      setDetailEditProductoID("");
      setDetailEditNombreArreglo("");
      setDetailEditProductoCodigo("");
      setDetailEditCantidad(1);
      setDetailEditProductoObservaciones("");
      setDetailEditPrecio(null);
      setDetailEditCustomPriceEnabled(false);
      setDetailEditFechaEntrega("");
      setDetailEditHoraEntrega("");
      setDetailEditClienteNombre("");
      setDetailEditClienteTelefono("");
      setDetailEditClienteEmail("");
      setDetailEditClienteTipoIdent("");
      setDetailEditClienteIdentificacion("");
      setDetailEditDestinatarioNombre("");
      setDetailEditTelefonoDestino("");
      setDetailEditDireccion("");
      setDetailEditBarrioNombre("");
      setDetailEditBarrioQuery("");
      setDetailEditBarrios([]);
      setDetailEditBarriosLoading(false);
      setDetailEditBarrioDropdownOpen(false);
      setDetailEditFirma("");
      setDetailEditMensajeTarjeta("");
      setDetailEditObservacionGeneral("");
      setDetailEditMetodosPago([]);
      setDetailEditOmitirRecargoLink(false);
      setDetailEditDescuentoMonto("");
      setDetailEditDescuentoNota("");
      setDetailEditSaldoFavorMonto("");
      setDetailEditSaldoFavorNota("");
      setDetailEditCanalFlora("");
      setDetailEditError("");
      setDetailEditDropdownOpen(false);
      setDetailEditSubview("edit");
      setDetailAddDropdownOpen(false);
      setDetailAddFilterText("");
      setDetailAddProductoID("");
      setDetailAddProductoCodigo("");
      setDetailAddNombreArreglo("");
      setDetailAddCantidad(1);
      setDetailAddPrecio(null);
      setDetailAddSaving(false);
      setIsDuplicatingDetail(false);
      return;
    }

    const firstProduct = Array.isArray(detalle.productos) && detalle.productos.length > 0
      ? detalle.productos[0]
      : null;
    applySelectedDetailProduct(firstProduct);
    setDetailEditFechaEntrega(toDateInput(detalle.destinatario?.fechaEntrega));
    setDetailEditHoraEntrega(normalizeTime(detalle.destinatario?.horaEntrega));
    setDetailEditClienteNombre(String(detalle.cliente?.nombre || ""));
    setDetailEditClienteTelefono(String(detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono || ""));
    setDetailEditClienteEmail(String(detalle.cliente?.email || ""));
    setDetailEditClienteTipoIdent(normalizeIdentType(detalle.cliente?.tipoIdent));
    setDetailEditClienteIdentificacion(String(detalle.cliente?.identificacion || ""));
    setDetailEditDestinatarioNombre(String(detalle.destinatario?.nombre || ""));
    setDetailEditTelefonoDestino(String(detalle.destinatario?.telefono || ""));
    setDetailEditDireccion(String(detalle.destinatario?.direccion || ""));
    setDetailEditBarrioNombre(String(detalle.destinatario?.barrio || ""));
    setDetailEditBarrioQuery("");
    setDetailEditBarrios(dedupeBarrioItems([
      normalizeBarrioItem({ nombreBarrio: "Recoger en tienda" }),
      normalizeBarrioItem({ nombreBarrio: detalle.destinatario?.barrio }),
    ].filter(Boolean)));
    setDetailEditBarrioDropdownOpen(false);
    setDetailEditFirma(String(detalle.destinatario?.firma || ""));
    setDetailEditMensajeTarjeta(String(detalle.destinatario?.mensajeTarjeta || ""));
    setDetailEditObservacionGeneral(String(detalle.destinatario?.observacionGeneral || ""));
    const initialPaymentMethods = Array.isArray(detalle.financiero?.metodosPago)
      ? detalle.financiero.metodosPago.map(item => String(item))
      : [];
    setDetailEditMetodosPago(initialPaymentMethods);
    setDetailEditPaymentAmounts(extractPaymentAmounts(detalle.financiero, initialPaymentMethods));
    setDetailEditOmitirRecargoLink(Boolean(detalle.financiero?.omitirRecargoLink));
    setDetailEditDescuentoMonto(
      Number(detalle.financiero?.descuentoMonto || 0) > 0
        ? String(Math.round(Number(detalle.financiero?.descuentoMonto || 0)))
        : ""
    );
    setDetailEditDescuentoNota(String(detalle.financiero?.descuentoNota || ""));
    setDetailEditSaldoFavorMonto(
      Number(detalle.financiero?.saldoFavorMonto || 0) > 0
        ? String(Math.round(Number(detalle.financiero?.saldoFavorMonto || 0)))
        : ""
    );
    setDetailEditSaldoFavorNota(String(detalle.financiero?.saldoFavorNota || ""));
    setDetailEditCanalFlora(String(detalle.financiero?.canalFlora || ""));
    setDetailEditSubview("edit");
    setDetailAddDropdownOpen(false);
    setDetailAddFilterText("");
    setDetailAddProductoID("");
    setDetailAddProductoCodigo("");
    setDetailAddNombreArreglo("");
    setDetailAddCantidad(1);
    setDetailAddPrecio(null);
    setDetailAddSaving(false);

    const initialCatalog = (Array.isArray(detalle.productos) ? detalle.productos : [])
      .map(item => normalizeCatalogItem(item))
      .filter(Boolean);
    setDetailEditCatalog(dedupeCatalogItems(initialCatalog));
    setDetailEditError("");
  }, [applySelectedDetailProduct, detalle]);

  useEffect(() => {
    if (!detalle || detalle.error) return;
    const productos = Array.isArray(detalle.productos) ? detalle.productos : [];
    if (productos.length === 0) return;
    const selectedProduct = productos.find(item => String(item?.detalleID ?? "") === String(detailEditDetalleID))
      || productos[0];
    const detalleId = selectedProduct?.detalleID != null ? Number(selectedProduct.detalleID) : null;

    if (detalleId != null && String(detalleId) !== String(detailEditDetalleID || "")) {
      setDetailEditDetalleID(String(detalleId));
      return;
    }

    applySelectedDetailProduct(selectedProduct, detalleId);
  }, [applySelectedDetailProduct, detalle, detailEditDetalleID]);

  useEffect(() => {
    if (!drawerOpen) {
      setIsEditingDetail(false);
      setIsDuplicatingDetail(false);
      setDetailEditError("");
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!orderNotification) return undefined;
    const timeoutId = globalThis.setTimeout(() => setOrderNotification(null), 5200);
    return () => globalThis.clearTimeout(timeoutId);
  }, [orderNotification]);

  useEffect(() => {
    if (!newOrderOpen) return;
    setNewOrderBarrios(current => dedupeBarrioItems([
      normalizeBarrioItem({ nombreBarrio: "Recoger en tienda" }),
      ...current,
      ...detailEditBarrios,
    ].filter(Boolean)));
  }, [detailEditBarrios, newOrderOpen]);

  useEffect(() => {
    if (!isEditingDetail) return;
    // Carga el catálogo completo al abrir modo edición.
    let disposed = false;
    setDetailEditCatalogLoading(true);
    api.buscarArreglosCatalogo({ empresaId, sucursalId, q: "" })
      .then(payload => {
        if (disposed) return;
        const rows = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];
        const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
        setDetailEditCatalog(current => dedupeCatalogItems([...current, ...loaded]));
      })
      .catch(() => {})
      .finally(() => { if (!disposed) setDetailEditCatalogLoading(false); });

    return () => { disposed = true; };
  }, [api, empresaId, isEditingDetail, sucursalId]);

  useEffect(() => {
    if (!isEditingDetail) return;
    const query = String(detailEditBarrioQuery || "").trim();
    Promise.resolve(loadBarrioOptions(query)).catch(() => {});
  }, [detailEditBarrioQuery, isEditingDetail, loadBarrioOptions]);

  const applyFilterValue = (name, value) => {
    setFilters(current => {
      if (current[name] === value && Number(current.page || 1) === 1) return current;
      return {
        ...current,
        [name]: value,
        page: 1
      };
    });
  };

  const openDetail = async pedidoId => {
    setOpenOrderActionsId(null);
    setDrawerOpen(true);
    setSelectedPedidoId(pedidoId);
    setDetalle(null);

    try {
      const detail = await api.obtenerDetallePedido(pedidoId);
      setDetalle(detail);
    } catch (nextError) {
      console.error("Error obteniendo detalle:", nextError);
      setDetalle({ error: true });
    }
  };

  const optimisticStatusPatch = (pedidoId, nextStatus, motivoRechazo = null, extraPatch = {}) => {
    setItems(current => current.map(item => Number(resolveOrderId(item)) === Number(pedidoId)
      ? { ...item, estado: nextStatus, ...extraPatch, ...(motivoRechazo !== null ? { motivoRechazo } : {}) }
      : item));

    setDetalle(current => {
      if (!current || Number(selectedPedidoId) !== Number(pedidoId)) return current;
      return { ...current, estado: nextStatus, ...extraPatch, ...(motivoRechazo !== null ? { motivoRechazo } : {}) };
    });
  };

  const approveOrder = async pedidoId => {
    const item = items.find(current => Number(resolveOrderId(current)) === Number(pedidoId));
    if (item?.puedeAprobar === false) {
      globalThis.alert(item.motivoBloqueoAprobacion || "Completa la información requerida antes de aprobar.");
      return;
    }
    if (approvingPedidoIds.includes(Number(pedidoId))) {
      globalThis.alert("Este pedido ya se está aprobando. Espera un momento.");
      return;
    }

    setApprovingPedidoIds(current => [...current, Number(pedidoId)]);
    try {
      const response = await api.aprobarPedido(pedidoId);
      const floristaAsignado = resolveFloristaName(response);
      optimisticStatusPatch(
        pedidoId,
        response.estado || "APROBADO",
        null,
        floristaAsignado !== "Sin asignar" ? { floristaAsignado } : {}
      );
      const refreshed = await loadOrders(true);
      await loadTodaySalesSummary();
      const refreshedItem = (Array.isArray(refreshed?.items) ? refreshed.items : [])
        .find(current => Number(resolveOrderId(current)) === Number(pedidoId));
      const assignedOrderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, refreshedItem);
      await downloadInvoice(pedidoId, { refreshAfter: false });
      setOrderNotification({
        tone: "success",
        title: "Pedido aprobado",
        message: assignedOrderNumber
          ? `El pedido #${assignedOrderNumber} fue creado correctamente y ya quedó aprobado.`
          : "El pedido quedó aprobado correctamente. El número se asignará en unos momentos.",
      });
    } catch (nextError) {
      console.error("Error aprobando pedido:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible aprobar el pedido.");
    } finally {
      setApprovingPedidoIds(current => current.filter(currentId => currentId !== Number(pedidoId)));
    }
  };

  const rejectOrder = async pedidoId => {
    const item = items.find(current => Number(resolveOrderId(current)) === Number(pedidoId));
    const isCancellation = canInvoiceStatus(item?.estado);
    const actionLabel = isCancellation ? "cancelación" : "rechazo";
    const motivo = String(globalThis.prompt(`Motivo de ${actionLabel}`, "") || "").trim();
    if (!motivo) {
      globalThis.alert(`Debes ingresar un motivo de ${actionLabel}.`);
      return;
    }

    try {
      const response = isCancellation
        ? await api.cambiarEstadoPedidoPipeline({ pedidoId, nuevoEstadoId: CANCELADO_PEDIDO_ESTADO_ID })
        : await api.rechazarPedido(pedidoId, motivo);

      if (isCancellation) {
        console.info("Respuesta cancelación pedido:", response);
        ordersFilterCache.clear();
        const refreshed = await loadOrders(true);
        await loadTodaySalesSummary();
        if (Number(selectedPedidoId) === Number(pedidoId)) {
          await reloadDrawer();
        }
        const refreshedItem = (Array.isArray(refreshed?.items) ? refreshed.items : [])
          .find(current => Number(resolveOrderId(current)) === Number(pedidoId));
        const orderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, refreshedItem, item);
        setOrderNotification({
          tone: "danger",
          title: "Pedido cancelado",
          message: orderNumber
            ? `El pedido #${orderNumber} fue cancelado correctamente.`
            : "El pedido fue cancelado correctamente.",
        });
        return;
      }

      const nextStatus = response.estado || "RECHAZADO";
      const orderNumber = resolveAssignedOrderNumber(response, response?.pedido, response?.data, item);
      optimisticStatusPatch(pedidoId, nextStatus, response.motivo || motivo);
      ordersFilterCache.clear();
      await loadOrders(true);
      await loadTodaySalesSummary();
      setOrderNotification({
        tone: "danger",
        title: "Pedido rechazado",
        message: orderNumber
          ? `El pedido #${orderNumber} fue rechazado correctamente.`
          : "El pedido fue rechazado correctamente.",
      });
    } catch (nextError) {
      console.error("Error rechazando pedido:", nextError);
      globalThis.alert(`No fue posible completar la ${actionLabel}.`);
    }
  };

  const downloadInvoice = async (pedidoId, options = {}) => {
    const { refreshAfter = true } = options;
    if (!pedidoId) {
      globalThis.alert("No fue posible descargar la factura: el pedido no tiene un identificador válido.");
      return false;
    }

    try {
      const { blob, filename } = await api.descargarFacturaPedido(pedidoId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `factura_pedido_${pedidoId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      if (refreshAfter) {
        await loadOrders(true);
      }
      if (refreshAfter && Number(selectedPedidoId) === Number(pedidoId)) {
        await reloadDrawer();
      }
      return true;
    } catch (nextError) {
      console.error("Error descargando factura:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible descargar la factura del pedido.");
      return false;
    }
  };

  const openMessageCard = async item => {
    const pedidoId = resolveOrderId(item);
    if (!pedidoId) {
      globalThis.alert("No fue posible generar el mensaje: el pedido no tiene un identificador válido.");
      return;
    }

    setMessageCardOrder(item || null);
    try {
      const payload = await api.obtenerMensajeTarjeta(pedidoId);
      setMessageCardData(payload);
      setMessageCardDraft(String(payload?.mensaje || ""));
      setMessageCardError("");
      setMessageCardOpen(true);
    } catch (nextError) {
      console.error("Error obteniendo mensaje de tarjeta:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible consultar el mensaje del pedido.");
    }
  };

  const closeMessageCard = () => {
    setMessageCardOpen(false);
    setMessageCardDraft("");
    setMessageCardSaving(false);
    setMessageCardError("");
  };

  const saveMessageCard = async () => {
    const pedidoId = Number(resolveOrderId(messageCardOrder) || selectedPedidoId || 0);
    if (!pedidoId || messageCardSaving) return;
    setMessageCardSaving(true);
    setMessageCardError("");
    try {
      await api.actualizarDetallePedidoPipeline({
        pedidoId,
        mensajeTarjeta: messageCardDraft,
      });
      setMessageCardData(current => ({
        ...(current || {}),
        mensaje: messageCardDraft,
      }));
      if (Number(selectedPedidoId) === pedidoId) {
        setDetalle(current => current ? ({
          ...current,
          destinatario: {
            ...(current.destinatario || {}),
            mensajeTarjeta: messageCardDraft,
          },
        }) : current);
      }
      await loadOrders(true);
    } catch (nextError) {
      setMessageCardError(nextError?.message || "No fue posible guardar el mensaje.");
    } finally {
      setMessageCardSaving(false);
    }
  };

  const refresh = () => {
    loadOrders(false);
    loadTodaySalesSummary();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedPedidoId(null);
    setIsDuplicatingDetail(false);
  };

  const filteredDetailCatalog = useMemo(() => {
    const q = String(detailEditFilterText || "").trim().toLowerCase();
    if (!q) return detailEditCatalog;
    return detailEditCatalog.filter(item => {
      const codigo = String(item.codigo || "").toLowerCase();
      const codigoProducto = String(item.codigoProducto || "").toLowerCase();
      const codigoCatalogo = String(item.codigoCatalogo || "").toLowerCase();
      const nombre = String(item.nombre || "").toLowerCase();
      return codigo.includes(q) || codigoProducto.includes(q) || codigoCatalogo.includes(q) || nombre.includes(q);
    });
  }, [detailEditCatalog, detailEditFilterText]);
  const filteredAddDetailCatalog = useMemo(() => {
    const q = String(detailAddFilterText || "").trim().toLowerCase();
    if (!q) return detailEditCatalog;
    return detailEditCatalog.filter(item => {
      const codigo = String(item.codigo || "").toLowerCase();
      const codigoProducto = String(item.codigoProducto || "").toLowerCase();
      const codigoCatalogo = String(item.codigoCatalogo || "").toLowerCase();
      const nombre = String(item.nombre || "").toLowerCase();
      return codigo.includes(q) || codigoProducto.includes(q) || codigoCatalogo.includes(q) || nombre.includes(q);
    });
  }, [detailAddFilterText, detailEditCatalog]);
  const filteredNewOrderProducts = useMemo(() => {
    const q = String(newOrderProductQuery || "").trim().toLowerCase();
    const source = newOrderProducts.length > 0 ? newOrderProducts : detailEditCatalog;
    if (!q) return source;
    return source.filter(item => {
      const codigo = String(item.codigo || "").toLowerCase();
      const codigoProducto = String(item.codigoProducto || "").toLowerCase();
      const codigoCatalogo = String(item.codigoCatalogo || "").toLowerCase();
      const nombre = String(item.nombre || "").toLowerCase();
      return codigo.includes(q) || codigoProducto.includes(q) || codigoCatalogo.includes(q) || nombre.includes(q);
    });
  }, [detailEditCatalog, newOrderProductQuery, newOrderProducts]);

  const filteredBarrioOptions = useMemo(() => {
    const q = String(detailEditBarrioQuery || "").trim().toLowerCase();
    if (!q) return detailEditBarrios;
    return detailEditBarrios.filter(item => String(item?.nombre || "").toLowerCase().includes(q));
  }, [detailEditBarrioQuery, detailEditBarrios]);
  const filteredNewOrderBarrios = useMemo(() => {
    const q = String(newOrderBarrioQuery || "").trim().toLowerCase();
    if (!q) return newOrderBarrios;
    return newOrderBarrios.filter(item => String(item?.nombre || "").toLowerCase().includes(q));
  }, [newOrderBarrioQuery, newOrderBarrios]);

  const onSearchCatalog = async searchText => {
    const q = String((searchText ?? detailEditFilterText) || "").trim();
    if (!q) return;
    setDetailEditCatalogLoading(true);
    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
      setDetailEditCatalog(current => dedupeCatalogItems([...current, ...loaded]));
    } catch {
      // Silencioso.
    } finally {
      setDetailEditCatalogLoading(false);
    }
  };

  const onSearchNewOrderProducts = async searchText => {
    const q = String((searchText ?? newOrderProductQuery) || "").trim();
    if (!q) return;
    setNewOrderProductsLoading(true);
    try {
      const payload = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q });
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
      setNewOrderProducts(current => dedupeCatalogItems([...current, ...loaded]));
      setDetailEditCatalog(current => dedupeCatalogItems([...current, ...loaded]));
    } catch {
      setNewOrderError("No fue posible buscar arreglos.");
    } finally {
      setNewOrderProductsLoading(false);
    }
  };

  const openNewOrderModal = () => {
    setNewOrderForm({ ...DEFAULT_NEW_ORDER_FORM, fechaEntrega: todayIsoDate() });
    setNewOrderError("");
    setNewOrderProductQuery("");
    setNewOrderBarrioQuery("");
    setNewOrderProductDropdownOpen(false);
    setNewOrderBarrioDropdownOpen(false);
    setNewOrderOpen(true);
    if (detailEditCatalog.length === 0) {
      setNewOrderProductsLoading(true);
      api.buscarArreglosCatalogo({ empresaId, sucursalId, q: "" })
        .then(payload => {
          const rows = Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload)
              ? payload
              : [];
          const loaded = rows.map(item => normalizeCatalogItem(item)).filter(Boolean);
          setNewOrderProducts(loaded);
          setDetailEditCatalog(current => dedupeCatalogItems([...current, ...loaded]));
        })
        .catch(() => {})
        .finally(() => setNewOrderProductsLoading(false));
    }
    if (newOrderBarrios.length === 0) {
      loadBarrioOptions("").then(() => {
        setNewOrderBarrios(current => current.length > 0 ? current : detailEditBarrios);
      }).catch(() => {});
      setNewOrderBarrios(current => dedupeBarrioItems([
        normalizeBarrioItem({ nombreBarrio: "Recoger en tienda" }),
        ...current,
        ...detailEditBarrios,
      ].filter(Boolean)));
    }
  };

  const closeNewOrderModal = () => {
    if (newOrderSaving) return;
    setNewOrderOpen(false);
    setNewOrderError("");
  };

  const updateNewOrderForm = (name, value) => {
    setNewOrderForm(current => ({ ...current, [name]: value }));
  };

  const buildNewOrderCheckoutPayload = () => {
    const productoID = Number(newOrderForm.productoID || 0);
    if (!productoID) throw new Error("Selecciona un arreglo para el pedido.");
    if (!String(newOrderForm.clienteNombre || "").trim()) throw new Error("Ingresa el nombre del cliente.");
    if (!String(newOrderForm.destinatarioNombre || "").trim()) throw new Error("Ingresa el destinatario.");
    if (!newOrderForm.fechaEntrega) throw new Error("Selecciona la fecha de entrega.");

    const barrioSeleccionado = String(newOrderForm.barrioNombre || "").trim() || null;
    const tipoEntrega = normalizeDeliveryType(barrioSeleccionado);
    if (tipoEntrega !== "recogida_en_tienda" && !String(newOrderForm.direccion || "").trim()) {
      throw new Error("Ingresa la direccion de entrega o selecciona Recoger en tienda.");
    }

    const horaEntrega = normalizeTime(newOrderForm.horaEntrega) || "08:00";
    const producto = {
      productoID,
      cantidad: Number(newOrderForm.cantidad || 1),
    };
    const precio = normalizeWholePeso(newOrderForm.precio);
    if (Number.isFinite(precio) && precio > 0) {
      producto.productoPrecio = precio;
    }

    return {
      empresaID: empresaId,
      sucursalID: sucursalId,
      productos: [producto],
      cliente: {
        tipoIdent: newOrderForm.clienteTipoIdent || null,
        identificacion: newOrderForm.clienteIdentificacion || null,
        nombreCompleto: String(newOrderForm.clienteNombre || "").trim(),
        telefono: String(newOrderForm.clienteTelefono || "").trim(),
        email: newOrderForm.clienteEmail || null,
      },
      entrega: {
        tipoEntrega,
        destinatario: String(newOrderForm.destinatarioNombre || "").trim(),
        telefonoDestino: String(newOrderForm.telefonoDestino || "").trim() || String(newOrderForm.clienteTelefono || "").trim() || null,
        direccion: tipoEntrega === "recogida_en_tienda" ? "Recoger En Tienda" : String(newOrderForm.direccion || "").trim(),
        barrioNombre: barrioSeleccionado,
        fechaEntrega: `${newOrderForm.fechaEntrega}T${horaEntrega}:00`,
        rangoHora: horaEntrega,
        mensaje: newOrderForm.mensajeTarjeta || null,
        firma: newOrderForm.firma || null,
        observacionGeneral: newOrderForm.observacionGeneral || null,
      },
      financiero: {
        metodosPago: newOrderForm.metodoPago ? [newOrderForm.metodoPago] : null,
        canalFlora: newOrderForm.canalFlora || null,
      },
    };
  };

  const onSaveNewOrder = async () => {
    if (newOrderSaving) return;
    setNewOrderError("");
    setNewOrderSaving(true);
    try {
      const created = await api.crearPedidoCheckout(buildNewOrderCheckoutPayload());
      setNewOrderOpen(false);
      setOrderNotification({
        type: "success",
        title: "Pedido creado",
        message: `Pedido #${created?.numeroPedido || created?.pedidoID || ""} registrado correctamente.`,
      });
      await loadOrders(false);
      if (created?.pedidoID) await openDetail(created.pedidoID);
    } catch (nextError) {
      setNewOrderError(nextError?.detail || nextError?.message || "No fue posible crear el pedido.");
    } finally {
      setNewOrderSaving(false);
    }
  };

  const onToggleDetailEdit = () => {
    if (detailEditSaving) return;
    setDetailEditError("");
    setIsEditingDetail(current => {
      const next = !current;
      if (!next) setIsDuplicatingDetail(false);
      if (next) setDetailEditSubview("edit");
      return next;
    });
  };

  const onStartDuplicateDetail = () => {
    if (!detalle || detalle.error || detailEditSaving) return;
    setDetailEditError("");
    setIsDuplicatingDetail(true);
    setIsEditingDetail(true);
    setDetailEditSubview("edit");
  };

  const normalizeDuplicateMetodosPago = () => (
    normalizePaymentMethods(detailEditMetodosPago)
  );

  const normalizeDuplicateCanalFlora = () => {
    const value = String(detailEditCanalFlora || "").trim();
    return value || null;
  };

  const validateSalesChannel = () => {
    if (!salesChannelFieldConfig) {
      return null;
    }
    const value = String(detailEditCanalFlora || "").trim();
    if (!value) {
      throw new Error(`${salesChannelFieldConfig.titulo || "Celular Flora"} es obligatorio.`);
    }
    return value;
  };

  const totalPedido = Number(
    detailEditFinancialPreview?.total ?? detalle?.financiero?.total ?? 0
  );

  const validatePaymentMethods = () => {
    if (!paymentFieldConfig) {
      return {
        methods: null,
        paymentBreakdown: null,
        cashAmount: null,
      };
    }

    const methods = normalizePaymentMethods(detailEditMetodosPago);
    if (!methods.length) {
      throw new Error(`${paymentFieldConfig?.titulo || "Método de pago"} es obligatorio.`);
    }

    const requiresBreakdown = methods.length > 1;
    if (!requiresBreakdown) {
      const isCash = methods.length === 1 && isCashPaymentMethod(methods[0]);
      return {
        methods,
        paymentBreakdown: null,
        cashAmount: isCash ? totalPedido : null,
      };
    }

    const paymentBreakdown = [];
    let breakdownTotal = 0;
    let cashAmount = null;

    for (const method of methods) {
      const rawValue = detailEditPaymentAmounts?.[method];
      const value = Number.parseFloat(String(rawValue ?? "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Debes indicar el monto correspondiente para ${method}.`);
      }

      const roundedValue = roundCurrency(value);
      breakdownTotal += roundedValue;
      paymentBreakdown.push({
        metodo: method,
        monto: roundedValue,
      });

      if (isCashPaymentMethod(method)) {
        cashAmount = roundedValue;
      }
    }

    const roundedBreakdownTotal = roundCurrency(breakdownTotal);
    const roundedOrderTotal = roundCurrency(totalPedido);
    if (roundedOrderTotal > 0 && roundedBreakdownTotal !== roundedOrderTotal) {
      throw new Error(`La suma de los montos por método de pago debe ser igual al total del pedido ($${formatearCOP(roundedOrderTotal)}).`);
    }

    return {
      methods,
      paymentBreakdown,
      cashAmount,
    };
  };

  const buildDuplicateCheckoutPayload = () => {
    const productos = Array.isArray(detalle?.productos) ? detalle.productos : [];
    if (!productos.length) {
      throw new Error("El pedido original no tiene productos para duplicar.");
    }

    const fechaEntrega = detailEditFechaEntrega || toDateInput(detalle?.destinatario?.fechaEntrega);
    if (!fechaEntrega) {
      throw new Error("Debes definir la fecha de entrega antes de duplicar.");
    }

    const horaEntrega = normalizeTime(detailEditHoraEntrega || detalle?.destinatario?.horaEntrega) || "00:00";
    const barrioSeleccionado = String(detailEditBarrioNombre || detalle?.destinatario?.barrio || "").trim() || null;
    const tipoEntrega = normalizeDeliveryType(barrioSeleccionado);

    return {
      empresaID: empresaId,
      sucursalID: Number(detalle?.sucursalID || sucursalId),
      productos: productos.map((item, index) => ({
        productoID: index === 0 && detailEditProductoID ? Number(detailEditProductoID) : Number(item.productoID),
        cantidad: index === 0 ? Number(detailEditCantidad || item.cantidad || 1) : Number(item.cantidad || 1),
      })),
      cliente: {
        tipoIdent: detailEditClienteTipoIdent || null,
        identificacion: detailEditClienteIdentificacion || null,
        indicativo: extractIndicativo(detalle?.cliente?.telefonoCompleto),
        nombreCompleto: String(detalle?.cliente?.nombre || "").trim(),
        telefono: String(detalle?.cliente?.telefono || "").trim(),
        email: detalle?.cliente?.email || null,
      },
      entrega: {
        tipoEntrega,
        destinatario: detailEditDestinatarioNombre || detalle?.destinatario?.nombre || null,
        telefonoDestino: detailEditTelefonoDestino || detalle?.destinatario?.telefono || null,
        direccion: detailEditDireccion || detalle?.destinatario?.direccion || "",
        barrioNombre: barrioSeleccionado,
        latitudDestino: detalle?.destinatario?.latitudDestino ?? null,
        longitudDestino: detalle?.destinatario?.longitudDestino ?? null,
        fechaEntrega: `${fechaEntrega}T${horaEntrega}:00`,
        rangoHora: detailEditHoraEntrega || null,
        mensaje: detailEditMensajeTarjeta || null,
        firma: detailEditFirma || null,
        observacionGeneral: detailEditObservacionGeneral || null,
      },
    };
  };

  const onSaveDetailEdit = async () => {
    if (!selectedPedidoId || detailEditSaving) return;
    setDetailEditError("");
    setDetailEditSaving(true);
    try {
      if (detailEditIsCustomArrangement) {
        const customPrice = normalizeWholePeso(detailEditPrecio);
        if (!Number.isFinite(customPrice) || customPrice <= 0) {
          throw new Error("Debes indicar un precio válido para el arreglo personalizado.");
        }
      }
      const paymentValidation = validatePaymentMethods();
      const validatedCanalFlora = validateSalesChannel();
      if (isDuplicatingDetail) {
        const created = await api.crearPedidoCheckout(buildDuplicateCheckoutPayload());
        await api.actualizarDetallePedidoPipeline({
          pedidoId: created.pedidoID,
          detalleID: null,
          productoID: detailEditProductoID ? Number(detailEditProductoID) : null,
          cantidad: Number(detailEditCantidad || 1),
          productoObservaciones: detailEditProductoObservaciones,
          productoPrecio: detailEditIsCustomArrangement ? normalizeWholePeso(detailEditPrecio) : null,
          fechaEntrega: detailEditFechaEntrega,
          horaEntrega: detailEditHoraEntrega,
          clienteNombre: canEditClientIdentity ? detailEditClienteNombre : null,
          clienteTelefono: canEditClientIdentity ? detailEditClienteTelefono : null,
          clienteEmail: detailEditClienteEmail,
          clienteTipoIdent: detailEditClienteTipoIdent,
          clienteIdentificacion: detailEditClienteIdentificacion,
          destinatarioNombre: detailEditDestinatarioNombre,
          telefonoDestino: detailEditTelefonoDestino,
          direccion: detailEditDireccion,
          barrioNombre: detailEditBarrioNombre,
          latitudDestino: detalle?.destinatario?.latitudDestino ?? null,
          longitudDestino: detalle?.destinatario?.longitudDestino ?? null,
          firma: detailEditFirma,
          mensajeTarjeta: detailEditMensajeTarjeta,
          observacionGeneral: detailEditObservacionGeneral,
          metodosPago: paymentValidation.methods,
          detallePago: paymentValidation.paymentBreakdown,
          montoEfectivo: paymentValidation.cashAmount,
          omitirRecargoLink: detailEditOmitirRecargoLink,
          descuentoMonto: normalizeWholePeso(detailEditDescuentoMonto) ?? 0,
          descuentoNota: detailEditDescuentoNota || null,
          saldoFavorMonto: normalizeWholePeso(detailEditSaldoFavorMonto) ?? 0,
          saldoFavorNota: detailEditSaldoFavorNota || null,
          canalFlora: validatedCanalFlora,
        });
        await loadOrders(true);
        await loadTodaySalesSummary();
        await openDetail(created.pedidoID);
        setIsDuplicatingDetail(false);
      } else {
        await api.actualizarDetallePedidoPipeline({
          pedidoId: selectedPedidoId,
          detalleID: detailEditDetalleID ? Number(detailEditDetalleID) : null,
          productoID: detailEditProductoID ? Number(detailEditProductoID) : null,
          cantidad: Number(detailEditCantidad || 1),
          productoObservaciones: detailEditProductoObservaciones,
          productoPrecio: detailEditIsCustomArrangement ? normalizeWholePeso(detailEditPrecio) : null,
          fechaEntrega: detailEditFechaEntrega,
          horaEntrega: detailEditHoraEntrega,
          clienteNombre: canEditClientIdentity ? detailEditClienteNombre : null,
          clienteTelefono: canEditClientIdentity ? detailEditClienteTelefono : null,
          clienteEmail: detailEditClienteEmail,
          clienteTipoIdent: detailEditClienteTipoIdent,
          clienteIdentificacion: detailEditClienteIdentificacion,
          destinatarioNombre: detailEditDestinatarioNombre,
          telefonoDestino: detailEditTelefonoDestino,
          direccion: detailEditDireccion,
          barrioNombre: detailEditBarrioNombre,
          latitudDestino: detalle?.destinatario?.latitudDestino ?? null,
          longitudDestino: detalle?.destinatario?.longitudDestino ?? null,
          firma: detailEditFirma,
          mensajeTarjeta: detailEditMensajeTarjeta,
          observacionGeneral: detailEditObservacionGeneral,
          metodosPago: paymentValidation.methods,
          detallePago: paymentValidation.paymentBreakdown,
          montoEfectivo: paymentValidation.cashAmount,
          omitirRecargoLink: detailEditOmitirRecargoLink,
          descuentoMonto: normalizeWholePeso(detailEditDescuentoMonto) ?? 0,
          descuentoNota: detailEditDescuentoNota || null,
          saldoFavorMonto: normalizeWholePeso(detailEditSaldoFavorMonto) ?? 0,
          saldoFavorNota: detailEditSaldoFavorNota || null,
          canalFlora: validatedCanalFlora,
        });
        await reloadDrawer();
      }
      const hasCashPayment = Number.isFinite(paymentValidation.cashAmount) && paymentValidation.cashAmount > 0;
      if (hasCashPayment && typeof window !== "undefined") {
        window.dispatchEvent(new Event("pedidoGuardadoEfectivo"));
      }
      setIsEditingDetail(false);
    } catch (nextError) {
      setDetailEditError(nextError?.message || (isDuplicatingDetail
        ? "No fue posible crear el pedido duplicado."
        : "No fue posible guardar la edición del pedido."));
    } finally {
      setDetailEditSaving(false);
    }
  };

  const onAddDetailProduct = async () => {
    if (!selectedPedidoId || detailAddSaving) return;
    setDetailEditError("");
    const currentDetalleId = String(detailEditDetalleID || "").trim();

    if (!detailAddProductoID) {
      setDetailEditError("Debes seleccionar el arreglo que quieres agregar.");
      return;
    }

    if (detailAddIsCustomArrangement) {
      const customPrice = normalizeWholePeso(detailAddPrecio);
      if (!Number.isFinite(customPrice) || customPrice <= 0) {
        setDetailEditError("Debes indicar un precio válido para el arreglo personalizado.");
        return;
      }
    }

    setDetailAddSaving(true);
    try {
      const response = await api.agregarDetallePedidoPipeline({
        pedidoId: selectedPedidoId,
        productoID: Number(detailAddProductoID),
        cantidad: Number(detailAddCantidad || 1),
        productoPrecio: detailAddIsCustomArrangement ? normalizeWholePeso(detailAddPrecio) : null,
      });
      await reloadDrawer();
      if (currentDetalleId) {
        setDetailEditDetalleID(currentDetalleId);
      } else if (response?.detalleID != null) {
        setDetailEditDetalleID(String(response.detalleID));
      }
      setDetailEditSubview("edit");
      setDetailAddDropdownOpen(false);
      setDetailAddFilterText("");
      setDetailAddProductoID("");
      setDetailAddProductoCodigo("");
      setDetailAddNombreArreglo("");
      setDetailAddCantidad(1);
      setDetailAddPrecio(null);
    } catch (nextError) {
      setDetailEditError(nextError?.detail || nextError?.message || "No fue posible agregar el arreglo al pedido.");
    } finally {
      setDetailAddSaving(false);
    }
  };

  const onDeleteDetailProduct = async detalleId => {
    if (!selectedPedidoId || !detalleId || detailEditDeletingDetailId != null) return;
    const confirmed = globalThis.confirm("¿Eliminar este arreglo del pedido?");
    if (!confirmed) return;
    setDetailEditError("");
    setDetailEditDeletingDetailId(Number(detalleId));
    let previousDetalle = null;
    try {
      setDetalle(current => {
        if (!current || current.error || !Array.isArray(current.productos)) return current;
        previousDetalle = current;
        const nextProducts = current.productos.filter(
          item => String(item?.detalleID ?? "") !== String(detalleId)
        );
        if (nextProducts.length === 0) {
          return current;
        }
        const currentSelected = String(detailEditDetalleID || "");
        const fallbackProduct = nextProducts.find(
          item => String(item?.detalleID ?? "") !== String(detalleId)
        ) || nextProducts[0];
        if (currentSelected === String(detalleId) && fallbackProduct) {
          applySelectedDetailProduct(fallbackProduct);
        }
        return {
          ...current,
          productos: nextProducts,
        };
      });
      await api.eliminarDetallePedidoPipeline({
        pedidoId: selectedPedidoId,
        detalleID: Number(detalleId),
      });
      await loadOrders(true);
      await loadTodaySalesSummary();
    } catch (nextError) {
      if (previousDetalle) {
        setDetalle(previousDetalle);
      }
      setDetailEditError(nextError?.detail || nextError?.message || "No fue posible eliminar el arreglo.");
    } finally {
      setDetailEditDeletingDetailId(null);
    }
  };

  const reloadDrawer = async () => {
    if (!selectedPedidoId) return;
    await openDetail(selectedPedidoId);
    await loadOrders(true);
    await loadTodaySalesSummary();
  };

  const toggleStoreDeliveries = () => {
    applyFilterValue("soloTienda", !filters.soloTienda);
  };

  const applyDatePreset = preset => {
    const today = todayIsoDate();
    const ranges = {
      hoy: { fechaDesde: today, fechaHasta: today },
      ayer: { fechaDesde: shiftIsoDate(today, -1), fechaHasta: shiftIsoDate(today, -1) },
      manana: { fechaDesde: shiftIsoDate(today, 1), fechaHasta: shiftIsoDate(today, 1) },
      semana: thisWeekRangeIso(),
      mes: thisMonthRangeIso(),
    };
    const range = ranges[preset] || ranges.hoy;
    setFilters(current => {
      if (current.fechaDesde === range.fechaDesde && current.fechaHasta === range.fechaHasta && Number(current.page || 1) === 1) {
        return current;
      }
      return { ...current, ...range, page: 1 };
    });
  };

  const clearOrderFilters = () => {
    const today = todayIsoDate();
    setFilters(current => ({
      ...current,
      q: "",
      estado: "",
      sinImprimir: false,
      soloTienda: false,
      metodoPago: "",
      fechaDesde: today,
      fechaHasta: today,
      page: 1,
    }));
  };

  const focusOrderMetric = metric => {
    const today = todayIsoDate();
    setFilters(current => {
      const base = {
        ...current,
        estado: "",
        sinImprimir: false,
        page: 1,
      };

      if (metric === "hoy") {
        return { ...base, fechaDesde: today, fechaHasta: today };
      }
      if (metric === "aprobados") {
        return { ...base, estado: "APROBADO" };
      }
      if (metric === "pendientes") {
        return { ...base, estado: "CREADO" };
      }
      if (metric === "cancelados") {
        return { ...base, estado: "CANCELADO" };
      }
      if (metric === "facturas") {
        return { ...base, estado: "APROBADO", sinImprimir: true };
      }
      return base;
    });
  };

  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 50);
  const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));
  const visibleFrom = items.length > 0 ? ((page - 1) * pageSize) + 1 : 0;
  const visibleTo = items.length > 0 ? Math.min(Number(total || 0), ((page - 1) * pageSize) + items.length) : 0;
  const pagerItems = buildPaginationItems(page, pages);
  const activeOrderMetric = useMemo(() => {
    const today = todayIsoDate();
    if (filters.sinImprimir) return "facturas";
    if (filters.estado === "APROBADO") return "aprobados";
    if (filters.estado === "CREADO") return "pendientes";
    if (filters.estado === "CANCELADO") return "cancelados";
    if (!filters.estado && filters.fechaDesde === today && filters.fechaHasta === today) return "hoy";
    return "";
  }, [filters.estado, filters.fechaDesde, filters.fechaHasta, filters.sinImprimir]);
  const activeDatePreset = useMemo(() => {
    const today = todayIsoDate();
    const yesterday = shiftIsoDate(today, -1);
    const tomorrow = shiftIsoDate(today, 1);
    const week = thisWeekRangeIso();
    const month = thisMonthRangeIso();
    if (filters.fechaDesde === today && filters.fechaHasta === today) return "hoy";
    if (filters.fechaDesde === yesterday && filters.fechaHasta === yesterday) return "ayer";
    if (filters.fechaDesde === tomorrow && filters.fechaHasta === tomorrow) return "manana";
    if (filters.fechaDesde === week.fechaDesde && filters.fechaHasta === week.fechaHasta) return "semana";
    if (filters.fechaDesde === month.fechaDesde && filters.fechaHasta === month.fechaHasta) return "mes";
    return "";
  }, [filters.fechaDesde, filters.fechaHasta]);
  const ordersMetrics = ordersKpis;
  const headerSalesSummary = Number(ordersKpis.ventaHoy || 0);
  const orderMetricCards = useMemo(() => {
    const baseCards = [
      { key: "hoy", label: "Pedidos hoy", shortLabel: "Pedidos hoy", value: Number(ordersMetrics.pedidosHoy || 0), tone: "is-primary", Icon: CalendarCheck2, helperText: "Operacion diaria" },
      { key: "aprobados", label: "Aprobados", shortLabel: "Aprobados", value: Number(ordersMetrics.aprobados || 0), tone: "is-green", Icon: CheckCircle2, helperText: "Ultimos 7 dias" },
      { key: "pendientes", label: "Pendientes", shortLabel: "Pendientes", value: Number(ordersMetrics.pendientes || 0), tone: "is-blue", Icon: Clock3, helperText: "Requieren atencion" },
      { key: "cancelados", label: "Cancelados", shortLabel: "Cancelados", value: Number(ordersMetrics.cancelados || 0), tone: "is-orange", Icon: XCircle, helperText: "Ultimos 7 dias" },
      { key: "facturas", label: "Facturas no impresas", shortLabel: "Sin imprimir", value: Number(ordersMetrics.sinImprimir || 0), tone: "is-purple", Icon: Receipt, helperText: "Por imprimir" },
    ];
    const maxValue = Math.max(...baseCards.map(card => card.value), 1);
    return baseCards.map(card => {
      const ratio = card.value / maxValue;
      const weightClass = card.value === 0
        ? "is-zero"
        : ratio >= 0.82
          ? "is-dominant"
          : ratio >= 0.42
            ? "is-elevated"
            : "is-soft";
      const attentionClass = card.key === "facturas"
        ? card.value >= 25
          ? "is-critical"
          : card.value > 0
            ? "is-alert"
            : ""
        : card.key === "pendientes"
          ? card.value >= 10
            ? "is-alert"
            : ""
          : "";
      const previousValue = Number(yesterdayMetrics?.[card.key === "facturas" ? "facturasNoImpresas" : card.key] || 0);
      const delta = card.value - previousValue;
      const comparisonClass = delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat";
      const comparisonLabel = delta === 0
        ? "Igual que ayer"
        : `${delta > 0 ? "+" : "-"}${Math.abs(delta)} vs ayer`;
      return {
        ...card,
        trendRatio: ratio,
        previousValue,
        comparisonClass,
        comparisonLabel,
        className: `${card.tone} ${weightClass}${attentionClass ? ` ${attentionClass}` : ""}`,
      };
    });
  }, [ordersMetrics, yesterdayMetrics]);
  return (
    <>
      <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
        <AppSidebar
          activeKey="pedidos"
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
          badges={{ pedidos: total }}
          sessionLabel={`Sesion activa: ${displayUserName}`}
        />

        <main className="orders-admin-view orders-page-view">
          {orderNotification ? (
            <aside className={`orders-approval-notification${orderNotification.tone === "danger" ? " is-danger" : ""}`} role="status" aria-live="polite">
              <span className="orders-approval-notification-icon" aria-hidden="true">
                {orderNotification.tone === "danger" ? (
                  <XCircle size={21} strokeWidth={2.4} />
                ) : (
                  <CheckCircle2 size={21} strokeWidth={2.4} />
                )}
              </span>
              <div>
                <strong>{orderNotification.title}</strong>
                <p>{orderNotification.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setOrderNotification(null)}
                title="Cerrar notificación"
                aria-label="Cerrar notificación"
              >
                <IconX size={16} stroke={2.2} />
              </button>
            </aside>
          ) : null}

          <header className="orders-admin-header orders-page-header">
            <div className="orders-page-heading">
              <div className="orders-page-breadcrumb" aria-label="Ruta">
                <span>Operaciones</span>
                <span>/</span>
                <strong>Pedidos</strong>
              </div>
              <div className="orders-page-title-row">
                <img src="/logo.png" alt="PetalOps" className="orders-mobile-brand-logo" />
                <h1>Pedidos</h1>
              </div>
              <p className="orders-admin-subtitle orders-page-description">Consulta pedidos, revisa estados y gestiona la operacion diaria.</p>
            </div>
            <label className="orders-header-search" aria-label="Buscar pedidos">
              <Search size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={filters.q}
                onChange={event => applyFilterValue("q", event.target.value)}
                placeholder="Buscar pedido, cliente, destinatario, ..."
              />
            </label>
            <div className="orders-header-side">
              <div className="header-actions">
                <button
                  type="button"
                  className={`btn-primary orders-header-refresh orders-store-toggle${filters.soloTienda ? " is-active" : ""}`}
                  onClick={toggleStoreDeliveries}
                  title={filters.soloTienda ? "Ver todos los pedidos" : "Ver entregas en tienda"}
                >
                  <Gift size={18} strokeWidth={2} />
                  <span>{filters.soloTienda ? "Todos los pedidos" : "Entregas en tienda"}</span>
                </button>
                <button type="button" className="btn-primary orders-header-refresh" onClick={refresh} title="Actualizar pedidos">
                  <RotateCw size={18} strokeWidth={2} />
                  <span>Actualizar</span>
                </button>
                <button type="button" className="btn-primary orders-new-order-btn" onClick={openNewOrderModal} title="Nuevo pedido">
                  <Plus size={18} strokeWidth={2.2} />
                  <span>Nuevo pedido</span>
                  <ChevronDown size={15} strokeWidth={2.2} />
                </button>
              </div>
              <div className="orders-header-metrics" aria-label="Resumen de pedidos">
                <article className="orders-header-metric-card is-sale">
                  <span className="orders-header-metric-icon" aria-hidden="true">
                    <IconWallet size={17} stroke={2.2} />
                  </span>
                  <strong>${formatearCOP(headerSalesSummary)}</strong>
                  <span>Venta hoy</span>
                </article>
                {orderMetricCards.map(card => {
                  const Icon = card.Icon;
                  const isActive = activeOrderMetric === card.key;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      className={`orders-header-metric-card ${card.className}${isActive ? " is-active" : ""}`}
                      onClick={() => focusOrderMetric(card.key)}
                      aria-pressed={isActive}
                      aria-label={`${card.label}: ${card.value}`}
                    >
                      <span className="orders-header-metric-icon" aria-hidden="true">
                        <Icon size={17} strokeWidth={2.2} />
                      </span>
                      <strong>{card.value}</strong>
                      <span>{card.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <section className="orders-filter-section" aria-label="Filtros de pedidos">
            <header className="orders-filter-section-head">
              <Filter size={15} strokeWidth={2.2} aria-hidden="true" />
              <h2>Filtros</h2>
            </header>

            <div className="orders-filter-ribbon">
              <div className="orders-date-presets" aria-label="Rangos rápidos">
                {[
                  ["hoy", "Hoy"],
                  ["ayer", "Ayer"],
                  ["manana", "Mañana"],
                  ["semana", "Esta semana"],
                  ["mes", "Este mes"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`orders-date-preset${activeDatePreset === key ? " is-active" : ""}`}
                    onClick={() => applyDatePreset(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="orders-filter-date-range">
                <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
                <input type="date" value={filters.fechaDesde} onChange={event => applyFilterValue("fechaDesde", event.target.value)} />
                <span aria-hidden="true">→</span>
                <input type="date" value={filters.fechaHasta} onChange={event => applyFilterValue("fechaHasta", event.target.value)} />
              </label>

              <button type="button" className="orders-filter-link" onClick={clearOrderFilters}>
                <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          </section>

          {filters.soloTienda ? (
            <section className="orders-store-submenu" aria-live="polite">
              <div className="orders-store-submenu-icon">
                <Gift size={18} strokeWidth={2} />
              </div>
              <div className="orders-store-submenu-copy">
                <strong>Entregas en tienda</strong>
                <span>{total} arreglo{total === 1 ? "" : "s"} marcado{total === 1 ? "" : "s"} como recoger en tienda con los filtros actuales.</span>
              </div>
              <button type="button" className="btn-outline orders-store-submenu-clear" onClick={toggleStoreDeliveries}>
                Ver todos
              </button>
            </section>
          ) : null}

          {error && <p className="orders-message">{error}</p>}
          {loading && (
            <div className="orders-loading-card" role="status" aria-live="polite">
              <span className="orders-loading-orbit" aria-hidden="true">
                <Search size={16} strokeWidth={2.2} />
              </span>
              <div className="orders-loading-copy">
                <strong>Buscando pedidos</strong>
                <span>Aplicando filtros y actualizando resultados</span>
              </div>
              <span className="orders-loading-track" aria-hidden="true">
                <span />
              </span>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="orders-message">No hay pedidos para los filtros seleccionados.</p>
          )}

          <section className="orders-page-section">
            <h2 className="orders-section-title">Listado de pedidos</h2>
            <div className="orders-table-wrap orders-page-table-wrap">
              <table className="orders-table orders-list-table">
                <colgroup>
                  <col className="orders-list-col-number" />
                  <col className="orders-list-col-created" />
                  <col className="orders-list-col-client" />
                  <col className="orders-list-col-delivery" />
                  <col className="orders-list-col-products" />
                  <col className="orders-list-col-total" />
                  <col className="orders-list-col-payment" />
                  <col className="orders-list-col-status" />
                  <col className="orders-list-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha / Hora</th>
                    <th>Cliente · Destinatario</th>
                    <th>Entrega</th>
                    <th>Producto(s)</th>
                    <th>Total</th>
                    <th>Método pago</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                {items.map(item => {
                  const statusClass = statusBadgeClass(item.estado, item);
                  const productSummary = resolveOrderProductSummary(item, new Map(), empresaId);
                  const waPhone = String(item.telefonoCompleto || item.telefono || "").trim().replace(/\+/g, "");
                  const pedidoId = resolveOrderId(item);
                  const displayOrderNumber = resolveDisplayOrderNumber(item);
                  const canApproveAction = isPendingStatus(item.estado);
                  const canCancelAction = canApproveAction || (isEmpresaAdminRole(session) && canInvoiceStatus(item.estado));
                  const isApproving = approvingPedidoIds.includes(Number(pedidoId));
                  const approvalBlockedByTenant = canApproveAction && item?.puedeAprobar === false;
                  const approveDisabled = !canApproveAction || approvalBlockedByTenant || isApproving;
                  const approveTitle = isApproving
                    ? "Otro usuario o esta sesión está aprobando este pedido"
                    : approvalBlockedByTenant
                    ? (item.motivoBloqueoAprobacion || "Completa la información requerida antes de aprobar")
                    : "Aprobar pedido";
                  const canDownloadInvoice = Boolean(pedidoId) && canInvoiceStatus(item.estado);
                  const canViewMessageCard = canMessageCardStatus(item.estado);
                  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(item.fecha_pedido || item.fechaPedido);
                  const { time: horaCreacion } = splitDateTimeParts(item.created_at || item.createdAt);
                  const horaRegistroPedido = horaPedido || item.horaPedido || item.hora_pedido || item.hora || horaCreacion;
                  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(item.fechaEntrega);
                  const primaryProduct = productSummary.products?.[0] || null;
                  const primaryProductLabel = orderProductLabel(primaryProduct, empresaId) || productSummary.productText || "-";
                  const normalizedStatus = normalizeStatus(item.estado);
                  const rowClass = [
                    selectedPedidoId === pedidoId && drawerOpen ? "is-active" : "",
                    "orders-row-card",
                    normalizedStatus === "APROBADO" ? "orders-row-approved" : "",
                    normalizedStatus === "CANCELADO" || normalizedStatus === "RECHAZADO" ? "orders-row-cancelled" : "",
                    isPendingStatus(item.estado) || normalizedStatus === "CREADO" ? "orders-row-pending" : "",
                  ].filter(Boolean).join(" ");

                  return (
                    <tr
                      key={pedidoId || `${item.numeroPedido}-${item.fecha}`}
                      className={rowClass}
                    >
                      <td className="orders-mobile-card-cell" colSpan={9}>
                        <article className="orders-mobile-card">
                          <header className="orders-mobile-card-head">
                            <span className={`orders-order-badge ${statusClass}`}>{displayOrderNumber}</span>
                            <span className={`order-badge ${statusClass}`}>
                              <span className="orders-status-icon" aria-hidden="true" />
                              {item.estado || "-"}
                            </span>
                          </header>

                          <div className="orders-mobile-card-grid">
                            <section className="orders-mobile-card-block orders-mobile-product-block">
                              <span className="orders-mobile-label">Producto</span>
                              <div className="orders-mobile-product">
                                <strong>{primaryProductLabel}</strong>
                              </div>
                            </section>

                            <section className="orders-mobile-card-block">
                              <span className="orders-mobile-label">Cliente</span>
                              <strong>{item.cliente || "-"}</strong>
                            </section>

                            <section className="orders-mobile-card-block">
                              <span className="orders-mobile-label">Fecha entrega</span>
                              <strong>{fechaEntrega || "-"}</strong>
                            </section>

                            <section className="orders-mobile-card-block">
                              <span className="orders-mobile-label">Hora entrega</span>
                              <strong>{item.horaEntrega || horaEntrega || "-"}</strong>
                            </section>

                            <section className="orders-mobile-card-block">
                              <span className="orders-mobile-label">Destinatario</span>
                              <strong>{item.destinatario || "-"}</strong>
                            </section>

                            <section className="orders-mobile-card-block">
                              <span className="orders-mobile-label">Total</span>
                              <strong>${formatearCOP(resolveOrderListTotal(item))}</strong>
                            </section>
                          </div>

                          <footer className="orders-mobile-card-actions">
                            <button type="button" className="order-icon order-icon-view" onClick={() => openDetail(pedidoId)} title="Ver detalle" aria-label="Ver detalle"><Eye size={17} strokeWidth={2} /></button>
                            <div className="order-actions-menu">
                              <button
                                type="button"
                                className="order-icon order-icon-more"
                                onClick={() => setOpenOrderActionsId(current => current === pedidoId ? null : pedidoId)}
                                title="Más acciones"
                                aria-label="Más acciones"
                                aria-expanded={openOrderActionsId === pedidoId}
                              >
                                <MoreVertical size={17} strokeWidth={2} />
                              </button>
                              {openOrderActionsId === pedidoId ? (
                                <div className={`order-actions-popover ${items.length <= 2 ? "order-actions-popover--open-down" : ""}`} role="menu">
                                  <button type="button" role="menuitem" onClick={() => { setOpenOrderActionsId(null); openDetail(pedidoId); }}>
                                    <Eye size={14} strokeWidth={2} />
                                    <span>Ver detalle</span>
                                  </button>
                                  <button type="button" role="menuitem" className="is-approve" onClick={() => { setOpenOrderActionsId(null); approveOrder(pedidoId); }} disabled={approveDisabled} title={approveTitle}>
                                    <IconCheck size={14} stroke={2.1} />
                                    <span>Aprobar</span>
                                  </button>
                                  <button type="button" role="menuitem" className="is-cancel" onClick={() => { setOpenOrderActionsId(null); rejectOrder(pedidoId); }} disabled={!canCancelAction} title={canInvoiceStatus(item.estado) ? "Cancelar pedido aprobado" : "Rechazar pedido"}>
                                    <IconX size={14} stroke={2.1} />
                                    <span>Cancelar</span>
                                  </button>
                                  <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" role="menuitem" className="is-whatsapp" onClick={() => setOpenOrderActionsId(null)}>
                                    <MessageCircle size={14} strokeWidth={2} />
                                    <span>Enviar WhatsApp</span>
                                  </a>
                                  {canDownloadInvoice && (
                                    <button type="button" role="menuitem" className="is-invoice" onClick={() => { setOpenOrderActionsId(null); downloadInvoice(pedidoId); }}>
                                      <Receipt size={14} strokeWidth={2} />
                                      <span>Generar factura</span>
                                    </button>
                                  )}
                                  {canViewMessageCard && (
                                    <button type="button" role="menuitem" className="is-card" onClick={() => { setOpenOrderActionsId(null); openMessageCard(item); }}>
                                      <Mail size={14} strokeWidth={2} />
                                      <span>Mensaje</span>
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </footer>
                        </article>
                      </td>
                      <td data-label="Número">
                        <span className={`orders-order-badge ${statusClass}`}>{displayOrderNumber}</span>
                      </td>
                      <td data-label="Fecha/Hora">
                        <div className="orders-cell-stack">
                          <strong>{fechaPedido || "-"}</strong>
                          <small>{horaRegistroPedido || "-"}</small>
                        </div>
                      </td>
                      <td data-label="Cliente · Destinatario">
                        <div className="orders-cell-stack orders-client-destination-cell">
                          <strong>{item.cliente || "-"}</strong>
                          <small>→ {item.destinatario || "-"}</small>
                        </div>
                      </td>
                      <td data-label="Entrega">
                        <div className="orders-cell-stack orders-cell-stack--delivery">
                          <span className="orders-delivery-pill"><Clock3 size={14} strokeWidth={2} /> {item.horaEntrega || horaEntrega || "-"}</span>
                          <span>{fechaEntrega || "-"}</span>
                        </div>
                      </td>
                      <td data-label="Producto(s)" title={productSummary.title}>
                        <span className="orders-products-inline">{productSummary.productText || "-"}</span>
                      </td>
                      <td data-label="Total">
                        <span className="orders-total-value">${formatearCOP(resolveOrderListTotal(item))}</span>
                      </td>
                      <td data-label="Método pago">{item.metodoPago || "-"}</td>
                      <td data-label="Estado">
                        <div className="orders-cell-stack">
                          <span className={`order-badge ${statusClass}`}>
                            <span className="orders-status-icon" aria-hidden="true" />
                            {item.estado || "-"}
                          </span>
                          {shouldShowPendingInvoiceAlert(item) ? (
                            <span className="orders-inline-alert">Factura pendiente</span>
                          ) : null}
                          {["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item.estado)) && item.motivoRechazo ? (
                            <span className="orders-inline-alert" title={item.motivoRechazo}>Nota: {item.motivoRechazo}</span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Acciones">
                        <div className="order-actions">
                          <button type="button" className="order-icon order-icon-view" onClick={() => openDetail(pedidoId)} title="Ver detalle" aria-label="Ver detalle"><Eye size={17} strokeWidth={2} /></button>
                          <div className="order-actions-menu">
                            <button
                              type="button"
                              className="order-icon order-icon-more"
                              onClick={() => setOpenOrderActionsId(current => current === pedidoId ? null : pedidoId)}
                              title="Más acciones"
                              aria-label="Más acciones"
                              aria-expanded={openOrderActionsId === pedidoId}
                            >
                              <MoreVertical size={17} strokeWidth={2} />
                            </button>
                            {openOrderActionsId === pedidoId ? (
                              <div className={`order-actions-popover ${items.length <= 2 ? "order-actions-popover--open-down" : ""}`} role="menu">
                                <button type="button" role="menuitem" onClick={() => { setOpenOrderActionsId(null); openDetail(pedidoId); }}>
                                  <Eye size={14} strokeWidth={2} />
                                  <span>Ver detalle</span>
                                </button>
                                <button type="button" role="menuitem" className="is-approve" onClick={() => { setOpenOrderActionsId(null); approveOrder(pedidoId); }} disabled={approveDisabled} title={approveTitle}>
                                  <IconCheck size={14} stroke={2.1} />
                                  <span>Aprobar</span>
                                </button>
                                <button type="button" role="menuitem" className="is-cancel" onClick={() => { setOpenOrderActionsId(null); rejectOrder(pedidoId); }} disabled={!canCancelAction} title={canInvoiceStatus(item.estado) ? "Cancelar pedido aprobado" : "Rechazar pedido"}>
                                  <IconX size={14} stroke={2.1} />
                                  <span>Cancelar</span>
                                </button>
                                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" role="menuitem" className="is-whatsapp" onClick={() => setOpenOrderActionsId(null)}>
                                  <MessageCircle size={14} strokeWidth={2} />
                                  <span>Enviar WhatsApp</span>
                                </a>
                                {canDownloadInvoice && (
                                  <button type="button" role="menuitem" className="is-invoice" onClick={() => { setOpenOrderActionsId(null); downloadInvoice(pedidoId); }}>
                                    <Receipt size={14} strokeWidth={2} />
                                    <span>Generar factura</span>
                                  </button>
                                )}
                                {canViewMessageCard && (
                                  <button type="button" role="menuitem" className="is-card" onClick={() => { setOpenOrderActionsId(null); openMessageCard(item); }}>
                                    <Mail size={14} strokeWidth={2} />
                                    <span>Mensaje</span>
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="records-pager orders-records-pager" aria-label="Paginación de pedidos">
            <p>Mostrando {visibleFrom} a {visibleTo} de {total} pedidos</p>
            <nav className="records-pager-pages" aria-label="Páginas de pedidos">
              <button
                type="button"
                className="records-pager-arrow"
                title="Ir a la página anterior"
                onClick={() => setFilters(current => ({ ...current, page: Math.max(1, Number(current.page || 1) - 1) }))}
                disabled={page <= 1}
              >
                <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
              {pagerItems.map(item => (
                typeof item === "number" ? (
                  <button
                    key={item}
                    type="button"
                    className={`records-pager-page${item === page ? " is-active" : ""}`}
                    onClick={() => setFilters(current => ({ ...current, page: item }))}
                    aria-current={item === page ? "page" : undefined}
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
                onClick={() => setFilters(current => ({ ...current, page: Math.min(pages, Number(current.page || 1) + 1) }))}
                disabled={page >= pages}
              >
                <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </nav>
            <label className="records-pager-size">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={event => setFilters(current => ({ ...current, page: 1, pageSize: Number(event.target.value) }))}
                title="Registros por página"
              >
                {PAGE_SIZE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span>por página</span>
            </label>
          </footer>
        </main>
      </div>

      {newOrderOpen ? (
        <div className="orders-modal-backdrop" role="presentation">
          <section className="orders-new-order-modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title">
            <header className="orders-new-order-head">
              <div>
                <span>Atencion directa</span>
                <h2 id="new-order-title">Nuevo pedido</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeNewOrderModal} title="Cerrar">
                <IconX size={18} stroke={2} />
              </button>
            </header>

            <div className="orders-new-order-body">
              <section className="orders-new-order-section">
                <h3>Producto</h3>
                <label className="order-detail-edit-label">
                  Arreglo
                  <div className="order-combobox">
                    <button
                      type="button"
                      className="order-combobox-trigger"
                      onClick={() => setNewOrderProductDropdownOpen(open => !open)}
                    >
                      <span>{newOrderForm.productoNombre || "Seleccionar arreglo"}</span>
                      <span className="order-combobox-arrow">{newOrderProductDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {newOrderProductDropdownOpen ? (
                      <div className="order-combobox-panel">
                        <div className="order-combobox-search-row">
                          <input
                            autoFocus
                            type="text"
                            value={newOrderProductQuery}
                            onChange={event => setNewOrderProductQuery(event.target.value)}
                            onKeyDown={event => { if (event.key === "Enter") onSearchNewOrderProducts(newOrderProductQuery); }}
                            placeholder="Buscar por codigo o nombre..."
                            className="order-combobox-search"
                          />
                          <button
                            type="button"
                            className="btn-outline order-detail-search-btn"
                            onClick={() => onSearchNewOrderProducts(newOrderProductQuery)}
                            disabled={newOrderProductsLoading}
                          >
                            {newOrderProductsLoading ? "..." : "Buscar"}
                          </button>
                        </div>
                        <ul className="order-combobox-list">
                          {filteredNewOrderProducts.length === 0 ? (
                            <li className="order-combobox-empty">Sin resultados</li>
                          ) : filteredNewOrderProducts.map(item => (
                            <li
                              key={`new-${item.id}`}
                              className={`order-combobox-option${String(item.id) === String(newOrderForm.productoID) ? " is-selected" : ""}`}
                              onClick={() => {
                                setNewOrderForm(current => ({
                                  ...current,
                                  productoID: String(item.id),
                                  productoCodigo: displayProductCode(item, empresaId),
                                  productoNombre: buildProductoLabel(item, empresaId),
                                  precio: item.precio != null ? String(item.precio) : current.precio,
                                }));
                                setNewOrderProductDropdownOpen(false);
                              }}
                            >
                              {buildProductoLabel(item, empresaId)}
                              {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </label>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Cantidad
                    <input type="number" min="1" step="1" value={newOrderForm.cantidad} onChange={event => updateNewOrderForm("cantidad", Math.max(1, Number(event.target.value || 1)))} />
                  </label>
                  <label className="order-detail-edit-label">
                    Precio manual
                    <input type="text" inputMode="numeric" value={newOrderForm.precio} onChange={event => updateNewOrderForm("precio", sanitizeWholePesoInput(event.target.value) ?? "")} placeholder="Opcional" />
                  </label>
                </div>
              </section>

              <section className="orders-new-order-section">
                <h3>Cliente</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Nombre cliente
                    <input type="text" value={newOrderForm.clienteNombre} onChange={event => updateNewOrderForm("clienteNombre", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Telefono
                    <input type="tel" value={newOrderForm.clienteTelefono} onChange={event => updateNewOrderForm("clienteTelefono", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Email
                    <input type="email" value={newOrderForm.clienteEmail} onChange={event => updateNewOrderForm("clienteEmail", event.target.value)} placeholder="Opcional" />
                  </label>
                  <label className="order-detail-edit-label">
                    Documento
                    <input type="text" value={newOrderForm.clienteIdentificacion} onChange={event => updateNewOrderForm("clienteIdentificacion", event.target.value)} placeholder="Opcional" />
                  </label>
                </div>
              </section>

              <section className="orders-new-order-section">
                <h3>Entrega</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Destinatario
                    <input type="text" value={newOrderForm.destinatarioNombre} onChange={event => updateNewOrderForm("destinatarioNombre", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Telefono destinatario
                    <input type="tel" value={newOrderForm.telefonoDestino} onChange={event => updateNewOrderForm("telefonoDestino", event.target.value)} placeholder="Si es diferente" />
                  </label>
                  <label className="order-detail-edit-label">
                    Fecha
                    <input type="date" value={newOrderForm.fechaEntrega} onChange={event => updateNewOrderForm("fechaEntrega", event.target.value)} />
                  </label>
                  <label className="order-detail-edit-label">
                    Hora
                    <input type="time" value={newOrderForm.horaEntrega} onChange={event => updateNewOrderForm("horaEntrega", event.target.value)} />
                  </label>
                </div>
                <label className="order-detail-edit-label">
                  Direccion
                  <input type="text" value={newOrderForm.direccion} onChange={event => updateNewOrderForm("direccion", event.target.value)} placeholder="Direccion o referencia" />
                </label>
                <label className="order-detail-edit-label">
                  Barrio / tipo entrega
                  <div className="order-combobox">
                    <button type="button" className="order-combobox-trigger" onClick={() => setNewOrderBarrioDropdownOpen(open => !open)}>
                      <span>{newOrderForm.barrioNombre || "Seleccionar barrio"}</span>
                      <span className="order-combobox-arrow">{newOrderBarrioDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {newOrderBarrioDropdownOpen ? (
                      <div className="order-combobox-panel">
                        <div className="order-combobox-search-row">
                          <input
                            autoFocus
                            type="text"
                            value={newOrderBarrioQuery}
                            onChange={event => setNewOrderBarrioQuery(event.target.value)}
                            onKeyDown={event => { if (event.key === "Enter") loadBarrioOptions(newOrderBarrioQuery); }}
                            placeholder="Buscar barrio..."
                            className="order-combobox-search"
                          />
                          <button type="button" className="btn-outline order-detail-search-btn" onClick={() => loadBarrioOptions(newOrderBarrioQuery)}>
                            Buscar
                          </button>
                        </div>
                        <ul className="order-combobox-list">
                          {filteredNewOrderBarrios.length === 0 ? (
                            <li className="order-combobox-empty">Sin barrios disponibles</li>
                          ) : filteredNewOrderBarrios.map(item => (
                            <li
                              key={`new-barrio-${item.nombre}`}
                              className={`order-combobox-option${item.nombre === newOrderForm.barrioNombre ? " is-selected" : ""}`}
                              onClick={() => {
                                updateNewOrderForm("barrioNombre", item.nombre);
                                if (normalizeDeliveryType(item.nombre) === "recogida_en_tienda") {
                                  updateNewOrderForm("direccion", "Recoger En Tienda");
                                }
                                setNewOrderBarrioDropdownOpen(false);
                              }}
                            >
                              {item.nombre}
                              {item.costoDomicilio != null ? <span className="order-combobox-price">${formatearCOP(item.costoDomicilio)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </label>
              </section>

              <section className="orders-new-order-section">
                <h3>Mensaje y pago</h3>
                <div className="order-detail-edit-grid">
                  <label className="order-detail-edit-label">
                    Firma
                    <input type="text" value={newOrderForm.firma} onChange={event => updateNewOrderForm("firma", event.target.value)} placeholder="De parte de..." />
                  </label>
                  {paymentFieldConfig ? (
                    <label className="order-detail-edit-label">
                      {paymentFieldConfig.titulo || "Metodo de pago"}
                      <select value={newOrderForm.metodoPago} onChange={event => updateNewOrderForm("metodoPago", event.target.value)}>
                        <option value="">Seleccionar</option>
                        {paymentFieldOptions.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {salesChannelFieldConfig ? (
                    <label className="order-detail-edit-label">
                      {salesChannelFieldConfig.titulo || "Canal"}
                      <select value={newOrderForm.canalFlora} onChange={event => updateNewOrderForm("canalFlora", event.target.value)}>
                        <option value="">Seleccionar</option>
                        {(Array.isArray(salesChannelFieldConfig.opciones) ? salesChannelFieldConfig.opciones : []).map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                <label className="order-detail-edit-label">
                  Mensaje tarjeta
                  <textarea value={newOrderForm.mensajeTarjeta} onChange={event => updateNewOrderForm("mensajeTarjeta", event.target.value)} rows={3} />
                </label>
                <label className="order-detail-edit-label">
                  Observacion interna
                  <textarea value={newOrderForm.observacionGeneral} onChange={event => updateNewOrderForm("observacionGeneral", event.target.value)} rows={2} />
                </label>
              </section>

              {newOrderError ? <p className="orders-message">{newOrderError}</p> : null}
            </div>

            <footer className="orders-new-order-actions">
              <button type="button" className="btn-outline" onClick={closeNewOrderModal} disabled={newOrderSaving}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={onSaveNewOrder} disabled={newOrderSaving}>
                {newOrderSaving ? "Guardando..." : "Guardar pedido"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <div className={`orders-drawer-backdrop${drawerOpen ? " open" : ""}`} aria-hidden="true" />

      <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head orders-detail-premium-head">
          <div className="orders-detail-head-copy">
            <span className="orders-detail-eyebrow">Detalle pedido</span>
            <strong className="orders-drawer-title">
              Pedido #{detalle && !detalle.error ? (detalle.numeroPedido ?? selectedPedidoId ?? "-") : (selectedPedidoId ?? "-")}
            </strong>
            {detalle && !detalle.error ? (
              <div className="orders-detail-head-meta">
                <span className={`order-badge ${statusBadgeClass(detalle.estado)}`}>{detalle.estado || "-"}</span>
                <span>{formatDisplayDate(detalle.destinatario?.fechaEntrega)}</span>
                <span>${formatearCOP(getOrderFinancialTotal(detalle.financiero))}</span>
              </div>
            ) : null}
          </div>
          <div className="orders-drawer-head-main-actions">
            {!detalle?.error && detalle ? (
              <button type="button" className="btn-primary orders-detail-action-primary" onClick={onToggleDetailEdit} title="Editar arreglo y entrega">
                <Pencil size={17} strokeWidth={2} />
                <span>{isEditingDetail ? "Cancelar edición" : "Editar"}</span>
              </button>
            ) : null}
            {!detalle?.error && detalle ? (
              <button type="button" className="btn-outline" onClick={onStartDuplicateDetail} title="Duplicar pedido usando este detalle como base">
                <Copy size={17} strokeWidth={2} />
                <span>Duplicar</span>
              </button>
            ) : null}
            <button type="button" className="btn-outline orders-detail-action-ghost" onClick={reloadDrawer} title="Recargar detalle del pedido">
              <RefreshCw size={17} strokeWidth={2} />
              <span>Recargar</span>
            </button>
          </div>
          <div className="orders-drawer-head-close">
            <button type="button" className="icon-btn" onClick={closeDrawer} title="Cerrar detalle">
              <IconX size={18} stroke={2} />
            </button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!drawerOpen ? null : !detalle ? (
            <p className="order-drawer-empty">Cargando detalle...</p>
          ) : detalle.error ? (
            <p className="order-drawer-empty">No fue posible cargar el detalle.</p>
          ) : (
            <>
              {isEditingDetail ? (
                <section className="order-block order-detail-edit-box">
                  <h4>{isDuplicatingDetail ? "Duplicar pedido" : "Editar pedido"}</h4>
                  <div className="order-detail-subnav">
                    <button
                      type="button"
                      className={`order-detail-subnav-tab${detailEditSubview === "edit" ? " is-active" : ""}`}
                      onClick={() => setDetailEditSubview("edit")}
                    >
                      Editar arreglo
                    </button>
                    <button
                      type="button"
                      className={`order-detail-subnav-tab${detailEditSubview === "add" ? " is-active" : ""}`}
                      onClick={() => setDetailEditSubview("add")}
                    >
                      Agregar arreglo
                    </button>
                  </div>

                  {detailProducts.length > 1 ? (
                    <div className="order-detail-product-switcher">
                      <span className="order-detail-product-switcher-title">Arreglos del pedido</span>
                      <div className="order-detail-product-switcher-list">
                        {detailProducts.map((producto, index) => {
                          const detalleId = producto?.detalleID != null ? String(producto.detalleID) : `${index}`;
                          const isActive = String(detailEditDetalleID || "") === detalleId;
                          return (
                            <div
                              key={detalleId}
                              className={`order-detail-product-chip${isActive ? " is-active" : ""}`}
                            >
                              <button
                                type="button"
                                className="order-detail-product-chip-main"
                                onClick={() => setDetailEditDetalleID(detalleId)}
                              >
                                {displayProductCode(producto, empresaId) || `Arreglo ${index + 1}`}
                              </button>
                              <button
                                type="button"
                                className="order-detail-product-chip-remove"
                                title="Eliminar arreglo"
                                onClick={() => onDeleteDetailProduct(detalleId)}
                                disabled={detailEditDeletingDetailId === Number(detalleId)}
                              >
                                <IconX size={12} stroke={2.2} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {detailEditSubview === "add" ? (
                  <div className="order-detail-add-box">
                    <div className="order-detail-add-box-head">
                      <span className="order-detail-product-switcher-title">Agregar arreglo</span>
                      <span className="order-detail-edit-hint">Cuando lo agregues, se suma al pedido y se actualiza el total.</span>
                    </div>
                    <div className="order-detail-edit-label">
                      Buscar arreglo para agregar
                      <div className="order-combobox">
                        <button
                          type="button"
                          className="order-combobox-trigger"
                          onClick={() => setDetailAddDropdownOpen(open => !open)}
                        >
                          <span>{detailAddSelectedProductLabel}</span>
                          <span className="order-combobox-arrow">{detailAddDropdownOpen ? "▲" : "▼"}</span>
                        </button>

                        {detailAddDropdownOpen ? (
                          <div className="order-combobox-panel">
                            <div className="order-combobox-search-row">
                              <input
                                autoFocus
                                type="text"
                                value={detailAddFilterText}
                                onChange={event => setDetailAddFilterText(event.target.value)}
                                onKeyDown={event => { if (event.key === "Enter") onSearchCatalog(detailAddFilterText); }}
                                placeholder="Buscar por código o nombre..."
                                className="order-combobox-search"
                              />
                              <button
                                type="button"
                                className="btn-outline order-detail-search-btn"
                                onClick={() => onSearchCatalog(detailAddFilterText)}
                                disabled={detailEditCatalogLoading}
                              >
                                {detailEditCatalogLoading ? "..." : "Buscar"}
                              </button>
                            </div>
                            <ul className="order-combobox-list">
                              {filteredAddDetailCatalog.length === 0 ? (
                                <li className="order-combobox-empty">Sin resultados</li>
                              ) : filteredAddDetailCatalog.map(item => (
                                <li
                                  key={`add-${item.id}`}
                                  className={`order-combobox-option${String(item.id) === detailAddProductoID ? " is-selected" : ""}`}
                                  onClick={() => {
                                    setDetailAddProductoID(String(item.id));
                                    setDetailAddProductoCodigo(displayProductCode(item, detailEmpresaId));
                                    setDetailAddNombreArreglo(String(item.nombre || ""));
                                    setDetailAddCantidad(1);
                                    setDetailAddPrecio(item.precio != null ? normalizeWholePeso(item.precio) : null);
                                    setDetailAddDropdownOpen(false);
                                    setDetailAddFilterText("");
                                  }}
                                >
                                  {buildProductoLabel(item, detailEmpresaId)}
                                  {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="order-detail-edit-grid">
                      <label className="order-detail-edit-label">
                        Cantidad a agregar
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={detailAddCantidad}
                          onChange={event => setDetailAddCantidad(Math.max(1, Number(event.target.value || 1)))}
                        />
                      </label>
                      {detailAddIsCustomArrangement ? (
                        <label className="order-detail-edit-label">
                          Precio personalizado
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={detailAddPrecio ?? ""}
                            onChange={event => setDetailAddPrecio(sanitizeWholePesoInput(event.target.value))}
                          />
                        </label>
                      ) : (
                        <label className="order-detail-edit-label">
                          Código
                          <input
                            type="text"
                            value={detailAddDisplayProductoCodigo}
                            readOnly
                            className="order-detail-edit-readonly"
                          />
                        </label>
                      )}
                    </div>

                    <div className="order-detail-add-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={onAddDetailProduct}
                        disabled={detailAddSaving}
                      >
                        {detailAddSaving ? "Agregando..." : "Agregar arreglo"}
                      </button>
                    </div>
                  </div>
                  ) : null}

                  {detailEditSubview === "edit" ? (
                  <>
                  <div className="order-detail-edit-label">
                    <span>Arreglo actual</span>
                    <input
                      type="text"
                      value={detailEditNombreArreglo || "(sin arreglo)"}
                      readOnly
                      className="order-detail-edit-readonly"
                    />
                  </div>

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Código de arreglo
                      <input
                        type="text"
                        value={detailEditDisplayProductoCodigo}
                        readOnly
                        className="order-detail-edit-readonly"
                      />
                    </label>
                      <label className="order-detail-edit-label">
                        Cantidad
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={detailEditCantidad}
                          onChange={event => setDetailEditCantidad(Math.max(1, Number(event.target.value || 1)))}
                        />
                      </label>
                  </div>

                  {detailEditShowPriceField ? (
                    <div className="order-detail-edit-label">
                      <span>Precio arreglo</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={detailEditPrecio ?? ""}
                        onChange={event => setDetailEditPrecio(sanitizeWholePesoInput(event.target.value))}
                        readOnly={!detailEditIsCustomArrangement}
                        className={detailEditIsCustomArrangement ? "" : "order-detail-edit-readonly"}
                      />
                      <span className="order-detail-edit-hint">
                        {detailEditIsCustomArrangement
                          ? "Puedes ajustar el precio porque el arreglo es personalizado."
                          : "El precio solo se puede cambiar cuando el arreglo es personalizado."}
                      </span>
                    </div>
                  ) : null}

                  <div className="order-detail-edit-label">
                    Cambiar arreglo
                    <div className="order-combobox">
                      <button
                        type="button"
                        className="order-combobox-trigger"
                        onClick={() => setDetailEditDropdownOpen(open => !open)}
                      >
                        <span>{detailEditSelectedProductLabel}</span>
                        <span className="order-combobox-arrow">{detailEditDropdownOpen ? "▲" : "▼"}</span>
                      </button>

                      {detailEditDropdownOpen ? (
                        <div className="order-combobox-panel">
                          <div className="order-combobox-search-row">
                            <input
                              autoFocus
                              type="text"
                              value={detailEditFilterText}
                              onChange={event => setDetailEditFilterText(event.target.value)}
                              onKeyDown={event => { if (event.key === "Enter") onSearchCatalog(); }}
                              placeholder="Buscar por código o nombre..."
                              className="order-combobox-search"
                            />
                            <button
                              type="button"
                              className="btn-outline order-detail-search-btn"
                              onClick={onSearchCatalog}
                              disabled={detailEditCatalogLoading}
                            >
                              {detailEditCatalogLoading ? "..." : "Buscar"}
                            </button>
                          </div>
                          <ul className="order-combobox-list">
                            {filteredDetailCatalog.length === 0 ? (
                              <li className="order-combobox-empty">Sin resultados</li>
                            ) : filteredDetailCatalog.map(item => (
                              <li
                                key={item.id}
                                className={`order-combobox-option${String(item.id) === detailEditProductoID ? " is-selected" : ""}`}
                                onClick={() => {
                                  setDetailEditProductoID(String(item.id));
                                  setDetailEditProductoCodigo(displayProductCode(item, detailEmpresaId));
                                  setDetailEditNombreArreglo(String(item.nombre || ""));
                                  setDetailEditCantidad(Number(detalle?.productos?.[0]?.cantidad || 1));
                                  setDetailEditProductoObservaciones("");
                                  setDetailEditPrecio(item.precio != null ? normalizeWholePeso(item.precio) : null);
                                  setDetailEditCustomPriceEnabled(isCustomArrangement({
                                    codigo: item.codigo,
                                    nombre: item.nombre,
                                    observaciones: item.descripcion,
                                  }));
                                  setDetailEditDropdownOpen(false);
                                setDetailEditFilterText("");
                                }}
                              >
                                {buildProductoLabel(item, detailEmpresaId)}
                                {item.precio != null ? <span className="order-combobox-price">${formatearCOP(Number(item.precio))}</span> : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Fecha entrega
                      <input
                        type="date"
                        value={detailEditFechaEntrega}
                        onChange={event => setDetailEditFechaEntrega(event.target.value)}
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Hora entrega
                      <input
                        type="time"
                        value={detailEditHoraEntrega}
                        onChange={event => setDetailEditHoraEntrega(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="order-detail-edit-section">
                    <span className="order-detail-edit-section-title">Datos cliente</span>
                    <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Nombre
                      <input
                        type="text"
                        value={detailEditClienteNombre}
                        onChange={event => setDetailEditClienteNombre(event.target.value)}
                        placeholder="Nombre del cliente"
                        disabled={!canEditClientIdentity}
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Teléfono
                      <input
                        type="text"
                        value={detailEditClienteTelefono}
                        onChange={event => setDetailEditClienteTelefono(event.target.value)}
                        placeholder="Teléfono del cliente"
                        disabled={!canEditClientIdentity}
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Email
                      <input
                        type="email"
                        value={detailEditClienteEmail}
                        onChange={event => setDetailEditClienteEmail(event.target.value)}
                        placeholder="Correo del cliente"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Tipo documento
                      <select
                        value={detailEditClienteTipoIdent}
                        onChange={event => setDetailEditClienteTipoIdent(event.target.value)}
                      >
                        <option value="">Selecciona una opción</option>
                        <option value="CC">Cédula</option>
                        <option value="NIT">NIT</option>
                      </select>
                    </label>
                    <label className="order-detail-edit-label">
                      N documento
                      <input
                        type="text"
                        value={detailEditClienteIdentificacion}
                        onChange={event => setDetailEditClienteIdentificacion(event.target.value)}
                        placeholder="Número de documento"
                      />
                    </label>
                    </div>
                  </div>

                  <p className="order-detail-edit-hint">
                    Si corriges el documento a NIT, el pedido recalcula IVA con la configuración fiscal disponible.
                  </p>
                  {!canEditClientIdentity ? (
                    <p className="order-detail-edit-hint">
                      Solo un usuario administrador puede cambiar nombre o teléfono del cliente.
                    </p>
                  ) : null}

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Nombre destinatario
                      <input
                        type="text"
                        value={detailEditDestinatarioNombre}
                        onChange={event => setDetailEditDestinatarioNombre(event.target.value)}
                        placeholder="Nombre de quien recibe"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Teléfono destinatario
                      <input
                        type="text"
                        value={detailEditTelefonoDestino}
                        onChange={event => setDetailEditTelefonoDestino(event.target.value)}
                        placeholder="Teléfono de contacto"
                      />
                    </label>
                  </div>

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Dirección
                      <input
                        type="text"
                        value={detailEditDireccion}
                        onChange={event => setDetailEditDireccion(event.target.value)}
                        placeholder="Dirección de entrega"
                      />
                    </label>
                    <label className="order-detail-edit-label">
                      Barrio
                      <div className="order-combobox">
                        <button
                          type="button"
                          className="order-combobox-trigger"
                          onClick={() => {
                            const nextOpen = !detailEditBarrioDropdownOpen;
                            setDetailEditBarrioDropdownOpen(nextOpen);
                            if (nextOpen) {
                              void loadBarrioOptions(detailEditBarrioQuery);
                            }
                          }}
                        >
                          <span>{detailEditBarrioNombre || "— Selecciona un barrio —"}</span>
                          <span className="order-combobox-arrow">{detailEditBarrioDropdownOpen ? "▲" : "▼"}</span>
                        </button>

                        {detailEditBarrioDropdownOpen ? (
                          <div className="order-combobox-panel">
                            <div className="order-combobox-search-row">
                              <input
                                autoFocus
                                type="text"
                                value={detailEditBarrioQuery}
                                onChange={event => setDetailEditBarrioQuery(event.target.value)}
                                placeholder="Busca un barrio..."
                                className="order-combobox-search"
                              />
                              <button
                                type="button"
                                className="btn-outline order-detail-search-btn"
                                onClick={() => setDetailEditBarrioDropdownOpen(false)}
                              >
                                Cerrar
                              </button>
                            </div>
                            <ul className="order-combobox-list">
                              {filteredBarrioOptions.length === 0 ? (
                                <li className="order-combobox-empty">
                                  {detailEditBarriosLoading ? "Buscando..." : "Sin barrios disponibles"}
                                </li>
                              ) : filteredBarrioOptions.map(item => (
                                <li
                                  key={`${item.id || "manual"}-${item.nombre}`}
                                  className={`order-combobox-option${item.nombre === detailEditBarrioNombre ? " is-selected" : ""}`}
                                  onClick={() => {
                                    setDetailEditBarrioNombre(item.nombre);
                                    setDetailEditBarrioDropdownOpen(false);
                                    setDetailEditBarrioQuery("");
                                  }}
                                >
                                  {item.nombre}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </label>
                  </div>

                  <label className="order-detail-edit-label">
                    Notas Producción
                    <textarea
                      rows={4}
                      value={detailEditProductoObservaciones}
                      onChange={event => setDetailEditProductoObservaciones(event.target.value)}
                      placeholder="Notas del arreglo para producción"
                    />
                  </label>

                  <label className="order-detail-edit-label">
                    Firma tarjeta
                    <input
                      type="text"
                      value={detailEditFirma}
                      onChange={event => setDetailEditFirma(event.target.value)}
                      placeholder="Ej: Con cariño, Flora"
                    />
                  </label>

                  <label className="order-detail-edit-label">
                    Mensaje tarjeta
                    <textarea
                      rows={3}
                      value={detailEditMensajeTarjeta}
                      onChange={event => setDetailEditMensajeTarjeta(event.target.value)}
                      placeholder="Mensaje para la tarjeta floral"
                    />
                  </label>

                  <label className="order-detail-edit-label">
                    Observaciones personalizados
                    <textarea
                      rows={3}
                      value={detailEditObservacionGeneral}
                      onChange={event => setDetailEditObservacionGeneral(event.target.value)}
                      placeholder="Observaciones personalizados para entrega"
                    />
                  </label>

                  {paymentFieldConfig || salesChannelFieldConfig ? (
                    <>
                      {paymentFieldConfig ? (
                        <div className="order-detail-edit-label">
                          <span>{paymentFieldConfig.titulo || "Métodos de pago"}</span>
                          <div className="order-detail-edit-checklist">
                            {paymentFieldOptions.map(option => (
                            <label key={option} className="order-detail-edit-checkitem">
                              <input
                                type="checkbox"
                                checked={detailEditMetodosPago.includes(option)}
                                onChange={() => {
                                  const isSelected = detailEditMetodosPago.includes(option);
                                  setDetailEditMetodosPago(current => isSelected
                                    ? current.filter(item => item !== option)
                                    : [...current, option]);
                                  setDetailEditPaymentAmounts(current => {
                                    if (isSelected) {
                                      const next = { ...current };
                                      delete next[option];
                                      return next;
                                    }
                                    return current;
                                  });
                                }}
                              />
                              <span>{option}</span>
                            </label>
                            ))}
                          </div>
                          {detailEditRequiresPaymentBreakdown ? (
                            <div className="order-detail-edit-payment-grid">
                              {detailEditSelectedPaymentMethods.map(method => (
                                <label key={method} className="order-detail-edit-label">
                                  {isCashPaymentMethod(method) ? "Monto recibido en efectivo" : `Monto para ${method}`}
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={detailEditPaymentAmounts[method] ?? ""}
                                    onChange={event => {
                                      const nextValue = event.target.value;
                                      setDetailEditPaymentAmounts(current => ({
                                        ...current,
                                        [method]: nextValue,
                                      }));
                                    }}
                                    placeholder="0.00"
                                    required
                                  />
                                </label>
                              ))}
                              <p className="order-detail-edit-hint">
                                La suma de los montos debe coincidir con el total del pedido: ${formatearCOP(totalPedido)}.
                              </p>
                            </div>
                          ) : null}
                          {detailEditHasLinkPayment ? (
                            <label className="order-detail-edit-inline-check">
                              <input
                                type="checkbox"
                                checked={detailEditOmitirRecargoLink}
                                onChange={event => setDetailEditOmitirRecargoLink(event.target.checked)}
                              />
                              <span>Quitar recargo del 5% por link</span>
                            </label>
                          ) : null}
                          <div className="order-detail-edit-payment-grid compact">
                            <label className="order-detail-edit-label">
                              Descuento
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                value={detailEditDescuentoMonto}
                                onChange={event => setDetailEditDescuentoMonto(sanitizeWholePesoInput(event.target.value) ?? "")}
                                placeholder="0"
                              />
                            </label>
                            <label className="order-detail-edit-label">
                              Nota descuento
                              <textarea
                                rows={2}
                                value={detailEditDescuentoNota}
                                onChange={event => setDetailEditDescuentoNota(event.target.value)}
                                placeholder="Razón del descuento"
                              />
                            </label>
                            <label className="order-detail-edit-label">
                              Saldo a favor
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                value={detailEditSaldoFavorMonto}
                                onChange={event => setDetailEditSaldoFavorMonto(sanitizeWholePesoInput(event.target.value) ?? "")}
                                placeholder="0"
                              />
                            </label>
                            <label className="order-detail-edit-label">
                              Nota saldo a favor
                              <textarea
                                rows={2}
                                value={detailEditSaldoFavorNota}
                                onChange={event => setDetailEditSaldoFavorNota(event.target.value)}
                                placeholder="Razón del saldo a favor"
                              />
                            </label>
                            <div className="order-detail-edit-adjustment-summary">
                              <span>Total base + domicilio: ${formatearCOP(detailEditFinancialPreview.baseTotal)}</span>
                              {detailEditFinancialPreview.recargoMonto > 0 ? (
                                <span>Recargo link ({detailEditFinancialPreview.recargoPct}%): +${formatearCOP(detailEditFinancialPreview.recargoMonto)}</span>
                              ) : null}
                              {detailEditFinancialPreview.descuentoMonto > 0 ? (
                                <span>Descuento: -${formatearCOP(detailEditFinancialPreview.descuentoMonto)}</span>
                              ) : null}
                              {detailEditFinancialPreview.saldoFavorMonto > 0 ? (
                                <span>Saldo a favor: ${formatearCOP(detailEditFinancialPreview.saldoFavorMonto)}</span>
                              ) : null}
                              <strong>Total ajustado: ${formatearCOP(detailEditFinancialPreview.total)}</strong>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {salesChannelFieldConfig ? (
                        <label className="order-detail-edit-label">
                          {salesChannelFieldConfig.titulo || "Canal"}
                          <select value={detailEditCanalFlora} onChange={event => setDetailEditCanalFlora(event.target.value)}>
                            <option value="">Selecciona una opción</option>
                            {(Array.isArray(salesChannelFieldConfig.opciones) ? salesChannelFieldConfig.opciones : []).map(option => (
                            <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </>
                  ) : null}

                  {detailEditError ? <p className="orders-message">{detailEditError}</p> : null}

                  <div className="order-detail-edit-actions">
                    <button type="button" className="btn-primary" onClick={onSaveDetailEdit} disabled={detailEditSaving}>
                      {detailEditSaving ? (isDuplicatingDetail ? "Creando..." : "Guardando...") : (isDuplicatingDetail ? "Crear duplicado" : "Guardar cambios")}
                    </button>
                  </div>
                  </>
                  ) : null}
                </section>
              ) : null}

              <OrderDetail
                detalle={detalle}
                empresaId={empresaId}
                paymentTitle={paymentFieldConfig?.titulo || "Método de pago"}
                salesChannelTitle={salesChannelFieldConfig?.titulo || "Celular Flora"}
              />
            </>
          )}
        </div>
      </aside>

      {messageCardOpen && (
        <div className="message-card-overlay" role="dialog" aria-modal="true" aria-label="Tarjeta de mensaje floral">
          <div className="message-card-panel">
            <div className="message-card-toolbar no-print-card">
              <h3>Tarjeta de mensaje floral</h3>
              <div className="message-card-controls">
                <label>
                  Fuente
                  <select value={cardFontFamily} onChange={event => setCardFontFamily(event.target.value)}>
                    {MESSAGE_CARD_FONT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tamaño
                  <input
                    type="range"
                    min={14}
                    max={48}
                    step={1}
                    value={cardFontSize}
                    onChange={event => setCardFontSize(Number(event.target.value))}
                  />
                </label>
                <label>
                  Color
                  <input type="color" value={cardTextColor} onChange={event => setCardTextColor(event.target.value)} />
                </label>
                <label>
                  Alineación mensaje
                  <select value={cardTextAlign} onChange={event => setCardTextAlign(event.target.value)}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="justify">Justificado</option>
                  </select>
                </label>
                <label>
                  Alineación firma
                  <select value={cardSignatureAlign} onChange={event => setCardSignatureAlign(event.target.value)}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
                <label className="message-card-message-editor">
                  Mensaje
                  <textarea
                    rows={4}
                    value={messageCardDraft}
                    onChange={event => setMessageCardDraft(event.target.value)}
                    placeholder="Escribe o corrige el mensaje"
                  />
                </label>
              </div>
              {messageCardError ? <p className="orders-message">{messageCardError}</p> : null}
              <div className="message-card-actions">
                <button type="button" className="btn-outline" onClick={saveMessageCard} disabled={messageCardSaving}>
                  {messageCardSaving ? "Guardando..." : "Guardar mensaje"}
                </button>
                <button type="button" className="btn-primary" onClick={() => globalThis.print()}>Imprimir tarjeta</button>
                <button type="button" className="btn-outline" onClick={closeMessageCard}>Cerrar</button>
              </div>
            </div>

            <section className="message-card-canvas" aria-label="Tarjeta imprimible">
              <div className="message-card-content">
                <p className="message-card-order-number">
                  {messageCardOrder?.numeroPedido ?? "-"}
                </p>
                <p className="message-card-meta message-card-date">
                  {formatFechaEntregaTarjeta(messageCardData?.fechaEntrega || messageCardOrder?.fechaEntrega)}
                </p>
                <div className="message-card-message-row">
                  <p
                    className="message-card-message"
                    style={{
                      fontFamily: cardFontFamily,
                      fontSize: `${cardFontSize}px`,
                      color: cardTextColor,
                      textAlign: cardTextAlign,
                    }}
                  >
                    {String(messageCardDraft || "Sin mensaje")}
                  </p>
                </div>
                <p className="message-card-meta message-card-signature">
                  <span
                    style={{
                      fontFamily: cardFontFamily,
                      textAlign: cardSignatureAlign
                    }}
                  >
                    {resolveFirmaTarjeta(messageCardData?.firma)}
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function statusBadgeClass(status, item = null) {
  const key = normalizeStatus(status);
  if (key === "PENDIENTE" && item && isPendingOutsideToday(item)) {
    return "is-pendiente-other-date";
  }
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

function isPendingStatus(status) {
  const key = normalizeStatus(status);
  return key === "PENDIENTE" || key === "CREADO";
}

function canInvoiceStatus(status) {
  const key = normalizeStatus(status);
  return key === "APROBADO";
}

function canMessageCardStatus(status) {
  const key = normalizeStatus(status);
  return key === "APROBADO";
}

function detailEditBarrioNombreOrFallback(currentValue, originalValue) {
  return String(currentValue || originalValue || "").trim() || null;
}

function normalizeDeliveryType(barrioNombre) {
  const value = String(barrioNombre || "").trim().toLowerCase();
  return value === "recoger en tienda" ? "recogida_en_tienda" : "domicilio";
}

function formatDisplayDate(value) {
  const date = splitDateTimeParts(value).date || String(value || "").slice(0, 10);
  if (!date) return "-";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function OrderDetailAccordion({ title, icon, children, defaultOpen = false, className = "" }) {
  return (
    <details className={`order-detail-accordion${className ? ` ${className}` : ""}`} open={defaultOpen}>
      <summary>
        <span className="order-detail-accordion-icon">{icon}</span>
        <span>{title}</span>
      </summary>
      <div className="order-detail-accordion-body">
        {children}
      </div>
    </details>
  );
}

function OrderDetail({ detalle, empresaId = null, paymentTitle = "Método de pago", salesChannelTitle = "Celular Flora" }) {
  const productos = Array.isArray(detalle.productos) ? detalle.productos : [];
  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(detalle.fechaPedido || detalle.fecha);
  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(detalle.destinatario?.fechaEntrega);
  const tipoDocumentoCliente = formatClienteTipoDocumento(detalle.cliente);
  const numeroDocumentoCliente = formatClienteNumeroDocumento(detalle.cliente);
  const totalPedido = getOrderFinancialTotal(detalle.financiero);
  const paymentBreakdown = normalizePaymentBreakdownForTotal(
    extractPaymentBreakdown(detalle.financiero),
    totalPedido
  );
  const detailRow = (label, value, extraClass = "") => (
    <div className={`order-detail-row${extraClass ? ` ${extraClass}` : ""}`}>
      <span className="order-detail-label">{label}</span>
      <span className="order-detail-value">{value || "-"}</span>
    </div>
  );

  return (
    <div className="orders-detail-premium">
      <section className="orders-detail-kpis" aria-label="Resumen del pedido">
        <div>
          <span>Cliente</span>
          <strong>{detalle.cliente?.nombre || "-"}</strong>
        </div>
        <div>
          <span>Destinatario</span>
          <strong>{detalle.destinatario?.nombre || "-"}</strong>
        </div>
        <div>
          <span>Valor</span>
          <strong>${formatearCOP(totalPedido)}</strong>
        </div>
        <div>
          <span>Entrega</span>
          <strong>{formatDisplayDate(detalle.destinatario?.fechaEntrega)}</strong>
        </div>
      </section>

      <OrderDetailAccordion title="Info general" icon={<IconInfoCircle size={17} stroke={2} />} defaultOpen>
        <div className="orders-detail-data-grid">
          {detailRow("Pedido", detalle.numeroPedido ?? detalle.pedidoID ?? "-")}
          {detailRow("Estado", detalle.estado || "-")}
          {detailRow("Fecha", formatDisplayDate(fechaPedido))}
          {detailRow("Hora", detalle.horaPedido || horaPedido || "-")}
          {detailRow("Factura", canInvoiceStatus(detalle.estado) ? (detalle.financiero?.facturaImpresa ? "Impresa" : "Pendiente") : "No aplica")}
          {detalle.motivoRechazo ? detailRow("Motivo", detalle.motivoRechazo) : null}
        </div>
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Cliente" icon={<IconUser size={17} stroke={2} />}>
        <div className="orders-detail-person-card">
          <span className="orders-client-avatar">{initialsFromName(detalle.cliente?.nombre)}</span>
          <div>
            <strong>{detalle.cliente?.nombre || "-"}</strong>
            <a href={detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono ? `tel:${detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono}` : undefined}>
              {detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono || "-"}
            </a>
            <a href={detalle.cliente?.email ? `mailto:${detalle.cliente.email}` : undefined}>
              {detalle.cliente?.email || "-"}
            </a>
            <small>{[tipoDocumentoCliente, numeroDocumentoCliente].filter(Boolean).join(" ") || "Sin documento"}</small>
          </div>
        </div>
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Destinatario" icon={<Gift size={17} strokeWidth={2} />}>
        <div className="orders-detail-destination-card">
          <strong>{detalle.destinatario?.nombre || "-"}</strong>
          <p><Truck size={15} strokeWidth={2} /> {detalle.destinatario?.direccion || "-"}</p>
          <p><Filter size={15} strokeWidth={2} /> {detalle.destinatario?.barrio || "-"}</p>
          <p><CalendarDays size={15} strokeWidth={2} /> {formatDisplayDate(fechaEntrega)} · {detalle.destinatario?.horaEntrega || horaEntrega || "-"}</p>
          <p><Mail size={15} strokeWidth={2} /> {detalle.destinatario?.mensajeTarjeta || "Sin mensaje"}</p>
          <p><Pencil size={15} strokeWidth={2} /> {detalle.destinatario?.firma || "Sin firma"}</p>
          {detalle.destinatario?.observacionGeneral ? <small>{detalle.destinatario.observacionGeneral}</small> : null}
        </div>
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Productos" icon={<IconFileText size={17} stroke={2} />} className="orders-detail-products-accordion">
        {productos.length === 0 ? (
          <p className="orders-detail-empty">Sin productos</p>
        ) : (
          <div className="orders-detail-product-list">
            {productos.map((producto, index) => (
              <article key={`${producto.detalleID || producto.productoID || producto.nombreProducto}-${index}`} className="orders-detail-product-card">
                <div className="orders-detail-product-card-head">
                  <strong>{orderProductLabel(producto, empresaId) || `Arreglo ${index + 1}`}</strong>
                </div>
                <div className="orders-detail-product-meta">
                  <span>Cantidad <strong>{Number(producto.cantidad || 0)}</strong></span>
                  <span>Subtotal <strong>${formatearCOP(Number(producto.subtotal || 0))}</strong></span>
                </div>
                {producto.observaciones ? <p>{producto.observaciones}</p> : null}
              </article>
            ))}
          </div>
        )}
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Resumen financiero" icon={<IconWallet size={17} stroke={2} />}>
        <div className="orders-detail-financial-total">
          <span>Total</span>
          <strong>${formatearCOP(totalPedido)}</strong>
        </div>
        <div className="orders-detail-data-grid orders-detail-financial-grid">
          {detailRow("Subtotal", `$${formatearCOP(Number(detalle.financiero?.subtotal || 0))}`)}
          {detailRow("IVA", `$${formatearCOP(Number(detalle.financiero?.iva || 0))}`)}
          {detailRow("Domicilio", `$${formatearCOP(Number(detalle.financiero?.domicilio || 0))}`)}
          {Number(detalle.financiero?.recargoLinkMonto || 0) > 0 ? detailRow("Recargo link", `+$${formatearCOP(Number(detalle.financiero?.recargoLinkMonto || 0))}`) : null}
          {Number(detalle.financiero?.descuentoMonto || 0) > 0 ? detailRow("Descuento", `-$${formatearCOP(Number(detalle.financiero?.descuentoMonto || 0))}`) : null}
          {Number(detalle.financiero?.saldoFavorMonto || 0) > 0 ? detailRow("Saldo a favor", `$${formatearCOP(Number(detalle.financiero?.saldoFavorMonto || 0))}`) : null}
          {detailRow("Estado pago", detalle.financiero?.estadoPago || "-")}
          {detailRow(paymentTitle, formatMetodoPago(detalle.financiero))}
          {paymentBreakdown.length > 0 ? detailRow("Desglose pagos", paymentBreakdown.map(item => `${item.metodo}: $${formatearCOP(item.monto)}`).join(" · ")) : null}
          {detailRow("Cuenta bancaria", detalle.financiero?.cuentaBancaria || "-")}
          {detailRow(salesChannelTitle, detalle.financiero?.canalFlora || "-")}
        </div>
      </OrderDetailAccordion>
    </div>
  );
}

function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  const precio = raw?.precio != null
    ? normalizeWholePeso(raw.precio)
    : raw?.precioUnitario != null
      ? normalizeWholePeso(raw.precioUnitario)
      : null;
  return {
    id,
    codigo: String(raw?.codigoProducto || raw?.codigo || raw?.sku || "").trim(),
    codigoProducto: String(raw?.codigoProducto || raw?.codigo_producto || raw?.codigo || raw?.sku || "").trim(),
    codigoCatalogo: String(raw?.codigoCatalogo || raw?.codigo_catalogo || raw?.catalogCode || "").trim(),
    nombre: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    nombreProducto: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    descripcion: String(raw?.descripcion || raw?.observaciones || "").trim(),
    imageUrl: resolveProductImageUrl(raw),
    precio,
  };
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

function dedupeCatalogItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item || item.id == null) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

function buildProductoLabel(producto, empresaId = null) {
  const codigo = displayProductCode(producto, empresaId);
  const nombre = String(producto?.nombre || "").trim();
  if (codigo && nombre) return `${codigo} - ${nombre}`;
  if (nombre) return nombre;
  if (codigo) return codigo;
  return "Producto sin nombre";
}

function normalizeIdentType(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "CC" || raw === "CEDULA" || raw === "CÉDULA") return "CC";
  if (raw === "NIT") return "NIT";
  return raw;
}

function formatClienteTipoDocumento(cliente) {
  const tipo = normalizeIdentType(cliente?.tipoIdent);
  if (tipo === "NIT") return "NIT";
  if (tipo === "CC") return "Cédula";
  return tipo || "-";
}

function formatClienteNumeroDocumento(cliente) {
  const numero = String(cliente?.identificacion || "").trim();
  return numero || "-";
}

function formatMetodoPago(financiero) {
  const methods = Array.isArray(financiero?.metodosPago)
    ? financiero.metodosPago.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  if (methods.length > 0) return methods.join(", ");
  return financiero?.metodoPago || "-";
}

function normalizeBarrioItem(raw) {
  const nombre = String(raw?.nombreBarrio || raw?.nombre || "").trim();
  if (!nombre) return null;
  const idValue = raw?.idBarrio ?? raw?.id ?? null;
  const id = idValue == null || idValue === "" ? null : Number(idValue);
  const costoRaw = raw?.costoDomicilio ?? raw?.costo ?? null;
  const costo = costoRaw == null || costoRaw === "" ? null : Number(costoRaw);
  return {
    id: Number.isNaN(id) ? null : id,
    nombre,
    costoDomicilio: Number.isNaN(costo) ? null : costo,
  };
}

function dedupeBarrioItems(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.nombre) continue;
    map.set(item.nombre.toLowerCase(), item);
  }
  return Array.from(map.values());
}

function toDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : "";
}


function formatFechaEntregaTarjeta(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function resolveFirmaTarjeta(value) {
  return String(value || "").trim();
}






