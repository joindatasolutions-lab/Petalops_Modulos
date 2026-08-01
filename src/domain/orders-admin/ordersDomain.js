import { normalizeStatus, splitDateTimeParts, todayIsoDateBogota } from "../../shared/utils.js";

/**
 * Funciones puras de dominio para Pedidos.
 *
 * Este archivo no debe tener efectos secundarios ni llamadas al API. Su papel es
 * normalizar payloads del backend, resolver identificadores, calcular totales y
 * aplicar filtros locales que la UI necesita cuando el backend no entrega una
 * forma exacta para todos los casos.
 *
 * Secciones principales:
 * - Fechas y paginacion.
 * - Estados y reglas de facturacion.
 * - Productos y catalogo.
 * - Metricas y filtros del listado.
 * - Metodos de pago y totales financieros.
 * - Extraccion de items/totales desde payloads flexibles.
 */

const LINK_PAYMENT_METHODS = new Set(["link bold", "link payu", "link wompi"]);

function isPendingStatus(status) {
  const key = normalizeStatus(status);
  return key === "PENDIENTE" || key === "CREADO";
}

function canInvoiceStatus(status) {
  return normalizeStatus(status) === "APROBADO";
}

function getProductoId(raw) {
  return raw?.productoID ?? raw?.productoId ?? raw?.producto_id ?? raw?.idProducto ?? raw?.id_producto ?? raw?.id ?? null;
}

export function todayIsoDate() {
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

export function thisWeekRangeIso() {
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

export function thisMonthRangeIso() {
  const { year, month } = currentBogotaDateParts();
  return {
    fechaDesde: isoDateFromParts(year, month, 1),
    fechaHasta: isoDateFromParts(year, month + 1, 0),
  };
}

export function buildPaginationItems(page, pages) {
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

export function orderCreatedDate(item) {
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

export function calculateTodaySalesTotal(items, targetDate = todayIsoDate()) {
  return (Array.isArray(items) ? items : [])
    .filter(item => isTodaySalesOrder(item, targetDate) && isCountableSalesOrder(item))
    .reduce((sum, item) => sum + resolveOrderListTotal(item), 0);
}

export function isPendingOutsideToday(item) {
  const status = normalizeStatus(item?.estado);
  if (status !== "PENDIENTE") return false;
  const deliveryDate = orderDeliveryDate(item);
  return Boolean(deliveryDate) && deliveryDate !== todayIsoDate();
}

export function extractIndicativo(phone) {
  const raw = String(phone || "").trim();
  const match = raw.match(/^(\+\d{1,4})/);
  return match ? match[1] : null;
}

export function normalizePaymentMethods(methods) {
  return Array.isArray(methods)
    ? methods.map(item => String(item || "").trim()).filter(Boolean)
    : [];
}

export function isCashPaymentMethod(method) {
  return String(method || "").trim().toLowerCase().includes("efectivo");
}

export function isLinkPaymentMethod(method) {
  return LINK_PAYMENT_METHODS.has(String(method || "").trim().toLowerCase());
}

export function isCustomArrangement(producto) {
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

export function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isTruthyFlag(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "si", "sí", "yes", "y"].includes(normalized);
}

export function isDeliveryGifted(...sources) {
  return sources.some(source => isTruthyFlag(source?.domicilioObsequiado)
    || isTruthyFlag(source?.domicilio_obsequiado)
    || isTruthyFlag(source?.domicilioGratis)
    || isTruthyFlag(source?.domicilio_gratis)
    || isTruthyFlag(source?.envioGratis)
    || isTruthyFlag(source?.envio_gratis)
    || isTruthyFlag(source?.omitirCostoDomicilio)
    || isTruthyFlag(source?.omitir_costo_domicilio));
}

export function initialsFromName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "CL";
  return parts.slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export function resolveDisplayOrderNumber(item) {
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

export function resolveOrderId(item) {
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

export function resolveAssignedOrderNumber(...sources) {
  for (const source of sources) {
    const displayNumber = resolveDisplayOrderNumber(source);
    if (displayNumber && displayNumber !== "-") return displayNumber;
  }
  return "";
}

export function resolveProductImageUrl(value) {
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

export function normalizeOrderProducts(item) {
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

export function displayProductCode(product, empresaId = null) {
  const productEmpresaId = Number(product?.empresaID || product?.empresaId || product?.empresa_id || empresaId);
  const isEmpresaCatalogCode = productEmpresaId === 3;
  const catalogCode = String(product?.codigoCatalogo || product?.codigo_catalogo || product?.catalogCode || product?.codigo_catalogo_producto || "").trim();
  const productCode = String(product?.codigoProducto || product?.codigo_producto || product?.codigo || product?.code || "").trim();
  return isEmpresaCatalogCode ? (catalogCode || productCode) : productCode;
}

export function orderProductLabel(product, empresaId = null) {
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

export function buildCatalogProductIndex(items) {
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

export function resolveCatalogProduct(product, catalogIndex) {
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

export function resolveOrderProductSummary(item, catalogIndex = new Map(), empresaId = null) {
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

export function resolveFloristaName(item) {
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

export function filterStorePickupOrders(items) {
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

export function isPaymentSearchTerm(value) {
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

export function isOrderNumberSearchTerm(value) {
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

export function normalizeWholePeso(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export function sanitizeWholePesoInput(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return normalizeWholePeso(digits);
}

export function clampPercentage(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, roundCurrency(parsed)));
}

export function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return Boolean(session?.esGlobalJoin) || role === "admin" || role === "empresa_admin";
}

export function ensureRappiOption(options) {
  const normalized = Array.isArray(options)
    ? options.map(item => String(item || "").trim()).filter(Boolean)
    : [];
  return normalized.includes("RAPPI") ? normalized : [...normalized, "RAPPI"];
}

export function buildOrderFinancialPreview(
  financiero,
  methods = [],
  omitirRecargoLink = false,
  descuentoMontoInput = 0,
  saldoFavorMontoInput = 0,
  domicilioObsequiado = false
) {
  const subtotal = roundCurrency(financiero?.subtotal ?? 0);
  const iva = roundCurrency(financiero?.iva ?? 0);
  const domicilioOriginal = roundCurrency(financiero?.domicilioOriginal ?? financiero?.domicilio ?? 0);
  const domicilio = domicilioObsequiado ? 0 : domicilioOriginal;
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
    domicilioOriginal,
    domicilioObsequiado: Boolean(domicilioObsequiado),
    baseTotal,
    hasLinkPayment,
    recargoPct,
    recargoMonto,
    descuentoMonto,
    saldoFavorMonto,
    total,
  };
}

function productUnitPrice(product) {
  const explicitPrice = normalizeWholePeso(product?.precioUnitario ?? product?.precio ?? product?.productoPrecio);
  if (Number.isFinite(explicitPrice) && explicitPrice > 0) return explicitPrice;

  const quantity = Number(product?.cantidad || 1);
  const subtotal = normalizeWholePeso(product?.subtotal);
  if (Number.isFinite(subtotal) && subtotal > 0 && quantity > 0) {
    return Math.round(subtotal / quantity);
  }

  return null;
}

function productLineSubtotal(product) {
  const quantity = Math.max(1, Number(product?.cantidad || 1));
  const unitPrice = productUnitPrice(product);
  if (Number.isFinite(unitPrice) && unitPrice > 0) {
    return roundCurrency(unitPrice * quantity);
  }
  return roundCurrency(product?.subtotal ?? 0);
}

export function buildEditedOrderFinancialBase({
  detalle,
  detalleID,
  cantidad,
  precio,
  selectedCatalogProduct = null,
}) {
  const financiero = detalle?.financiero && typeof detalle.financiero === "object" ? detalle.financiero : {};
  const products = Array.isArray(detalle?.productos) ? detalle.productos : [];
  const selectedDetailId = String(detalleID || "");
  const selectedProduct = products.find(product => String(product?.detalleID ?? "") === selectedDetailId) || products[0] || null;
  const currentProductsSubtotal = products.reduce((sum, product) => sum + productLineSubtotal(product), 0);
  const storedSubtotal = roundCurrency(financiero.subtotal ?? currentProductsSubtotal);

  if (!selectedProduct) {
    return { ...financiero, subtotal: storedSubtotal };
  }

  const previousLineSubtotal = productLineSubtotal(selectedProduct);
  const nextQuantity = Math.max(1, Number(cantidad || selectedProduct.cantidad || 1));
  const nextUnitPrice = productUnitPrice({
    precioUnitario: precio,
  }) || productUnitPrice(selectedCatalogProduct) || productUnitPrice(selectedProduct) || 0;
  const nextLineSubtotal = roundCurrency(nextUnitPrice * nextQuantity);
  const subtotalBase = currentProductsSubtotal > 0 ? currentProductsSubtotal : storedSubtotal;
  const subtotal = roundCurrency(Math.max(0, subtotalBase - previousLineSubtotal + nextLineSubtotal));
  const ivaRate = storedSubtotal > 0 ? roundCurrency((Number(financiero.iva || 0) / storedSubtotal) * 100) / 100 : 0;
  const iva = ivaRate > 0 ? roundCurrency(subtotal * ivaRate) : roundCurrency(financiero.iva ?? 0);

  return {
    ...financiero,
    subtotal,
    iva,
  };
}

export function getOrderFinancialTotal(financiero) {
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
  const domicilio = isDeliveryGifted(financiero) ? 0 : roundCurrency(financiero?.domicilio ?? 0);
  const recargo = roundCurrency(financiero?.recargoLinkMonto ?? 0);
  const descuento = roundCurrency(financiero?.descuentoMonto ?? 0);
  const saldoFavor = roundCurrency(financiero?.saldoFavorMonto ?? 0);
  return roundCurrency(subtotal + iva + domicilio + recargo - descuento + saldoFavor);
}

export function resolveOrderListTotal(item) {
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
  const domicilioOriginal = roundCurrency(
    financiero?.domicilio ??
    financiero?.costoDomicilio ??
    financiero?.costo_domicilio ??
    item?.domicilio ??
    item?.costoDomicilio ??
    item?.costo_domicilio ??
    0
  );
  const domicilio = isDeliveryGifted(financiero, item, item?.entrega, item?.destinatario) ? 0 : domicilioOriginal;
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

export function hasOrdersPayloadTotal(payload) {
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

export function normalizePaymentBreakdownForTotal(paymentBreakdown, totalPedido) {
  if (!Array.isArray(paymentBreakdown) || paymentBreakdown.length !== 1) return paymentBreakdown;
  const total = roundCurrency(totalPedido);
  if (total <= 0) return paymentBreakdown;
  return paymentBreakdown.map(item => ({
    ...item,
    monto: total,
  }));
}

export function extractPaymentAmounts(financiero, paymentMethods = []) {
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
