import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
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
  Clock3,
  Copy,
  Eye,
  Filter,
  Gift,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function orderDeliveryDate(item) {
  return splitDateTimeParts(item?.fechaEntrega).date;
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
  const saldoFavorMonto = Math.max(0, Math.min(totalDespuesDescuento, normalizeWholePeso(saldoFavorMontoInput) ?? 0));
  const total = roundCurrency(totalDespuesDescuento - saldoFavorMonto);
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
  fechaDesde: new Date().toISOString().slice(0, 10),
  fechaHasta: new Date().toISOString().slice(0, 10),
  page: 1,
  pageSize: 20
};

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
export function OrdersAdminPage({ session, canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewInventario, canViewContabilidad, canViewTrazabilidad, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoInventario, onGoContabilidad, onGoTrazabilidad, onGoClientes, onGoUsuarios }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [facturasPendientesImpresion, setFacturasPendientesImpresion] = useState(0);
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

  const api = useMemo(() => createApiClient(tenantConfig), []);
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
  const detailProducts = useMemo(
    () => (Array.isArray(detalle?.productos) ? detalle.productos : []),
    [detalle]
  );
  const detailEditSelectedProductLabel = useMemo(() => {
    const selected = detailEditCatalog.find(item => String(item.id) === detailEditProductoID);
    if (selected) {
      return buildProductoLabel(selected);
    }
    if (detailEditNombreArreglo || detailEditProductoCodigo) {
      return buildProductoLabel({
        codigo: detailEditProductoCodigo,
        nombre: detailEditNombreArreglo,
      });
    }
    return "— Selecciona un arreglo —";
  }, [detailEditCatalog, detailEditNombreArreglo, detailEditProductoCodigo, detailEditProductoID]);
  const detailAddIsCustomArrangement = useMemo(
    () => isCustomArrangement({
      codigo: detailAddProductoCodigo,
      nombre: detailAddNombreArreglo,
      observaciones: "",
    }),
    [detailAddNombreArreglo, detailAddProductoCodigo]
  );
  const detailAddSelectedProductLabel = useMemo(() => {
    const selected = detailEditCatalog.find(item => String(item.id) === String(detailAddProductoID));
    if (selected) {
      return buildProductoLabel(selected);
    }
    if (detailAddNombreArreglo || detailAddProductoCodigo) {
      return buildProductoLabel({
        codigo: detailAddProductoCodigo,
        nombre: detailAddNombreArreglo,
      });
    }
    return "— Selecciona un arreglo —";
  }, [detailAddNombreArreglo, detailAddProductoCodigo, detailAddProductoID, detailEditCatalog]);

  const applySelectedDetailProduct = useCallback((product, nextDetalleId = null) => {
    if (!product) return;
    const detalleId = nextDetalleId ?? (product?.detalleID != null ? Number(product.detalleID) : null);
    const productoId = getProductoId(product);
    const productoCodigo = String(product?.codigoProducto || product?.codigo || "").trim();
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
  }, []);

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
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const data = await api.listarPedidos({
        empresaId,
        sucursalId,
        q: debouncedQuery,
        estado: filters.estado,
        sinImprimir: filters.sinImprimir,
        soloTienda: filters.soloTienda,
        fechaDesde: toIsoDateStart(filters.fechaDesde),
        fechaHasta: toIsoDateEnd(filters.fechaHasta),
        page: filters.page,
        pageSize: filters.pageSize
      });

      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setFacturasPendientesImpresion(Number(data.facturasPendientesImpresion || 0));
      setError("");
    } catch (nextError) {
      console.error("Error cargando pedidos:", nextError);
      setItems([]);
      setTotal(0);
      setFacturasPendientesImpresion(0);
      setError("No fue posible cargar pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, debouncedQuery, filters.estado, filters.sinImprimir, filters.soloTienda, filters.fechaDesde, filters.fechaHasta, filters.page, filters.pageSize, empresaId, sucursalId]);

  useEffect(() => {
    loadOrders(false);
  }, [loadOrders]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      if (document?.hidden) return;
      loadOrders(true);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => globalThis.clearInterval(intervalId);
  }, [loadOrders]);


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
    setFilters(current => ({
      ...current,
      [name]: value,
      page: 1
    }));
  };

  const openDetail = async pedidoId => {
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

  const optimisticStatusPatch = (pedidoId, nextStatus, motivoRechazo = null) => {
    setItems(current => current.map(item => Number(item.pedidoID) === Number(pedidoId)
      ? { ...item, estado: nextStatus, ...(motivoRechazo !== null ? { motivoRechazo } : {}) }
      : item));

    setDetalle(current => {
      if (!current || Number(selectedPedidoId) !== Number(pedidoId)) return current;
      return { ...current, estado: nextStatus, ...(motivoRechazo !== null ? { motivoRechazo } : {}) };
    });
  };

  const approveOrder = async pedidoId => {
    const item = items.find(current => Number(current.pedidoID) === Number(pedidoId));
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
      optimisticStatusPatch(pedidoId, response.estado || "APROBADO");
      await loadOrders(true);
    } catch (nextError) {
      console.error("Error aprobando pedido:", nextError);
      globalThis.alert(nextError?.detail || nextError?.message || "No fue posible aprobar el pedido.");
    } finally {
      setApprovingPedidoIds(current => current.filter(currentId => currentId !== Number(pedidoId)));
    }
  };

  const rejectOrder = async pedidoId => {
    const item = items.find(current => Number(current.pedidoID) === Number(pedidoId));
    const actionLabel = canInvoiceStatus(item?.estado) ? "cancelación" : "rechazo";
    const motivo = String(globalThis.prompt(`Motivo de ${actionLabel}`, "") || "").trim();
    if (!motivo) {
      globalThis.alert(`Debes ingresar un motivo de ${actionLabel}.`);
      return;
    }

    try {
      const response = await api.rechazarPedido(pedidoId, motivo);
      optimisticStatusPatch(pedidoId, response.estado || "RECHAZADO", response.motivo || motivo);
    } catch (nextError) {
      console.error("Error rechazando pedido:", nextError);
      globalThis.alert(`No fue posible completar la ${actionLabel}.`);
    }
  };

  const downloadInvoice = async pedidoId => {
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
      await loadOrders(true);
      if (Number(selectedPedidoId) === Number(pedidoId)) {
        await reloadDrawer();
      }
    } catch (nextError) {
      console.error("Error descargando factura:", nextError);
      globalThis.alert("No fue posible descargar la factura del pedido.");
    }
  };

  const openMessageCard = async item => {
    const pedidoId = Number(item?.pedidoID);
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
    const pedidoId = Number(messageCardOrder?.pedidoID || selectedPedidoId || 0);
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

  const refresh = () => loadOrders(false);

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
      const nombre = String(item.nombre || "").toLowerCase();
      return codigo.includes(q) || nombre.includes(q);
    });
  }, [detailEditCatalog, detailEditFilterText]);
  const filteredAddDetailCatalog = useMemo(() => {
    const q = String(detailAddFilterText || "").trim().toLowerCase();
    if (!q) return detailEditCatalog;
    return detailEditCatalog.filter(item => {
      const codigo = String(item.codigo || "").toLowerCase();
      const nombre = String(item.nombre || "").toLowerCase();
      return codigo.includes(q) || nombre.includes(q);
    });
  }, [detailAddFilterText, detailEditCatalog]);

  const filteredBarrioOptions = useMemo(() => {
    const q = String(detailEditBarrioQuery || "").trim().toLowerCase();
    if (!q) return detailEditBarrios;
    return detailEditBarrios.filter(item => String(item?.nombre || "").toLowerCase().includes(q));
  }, [detailEditBarrioQuery, detailEditBarrios]);

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
  };

  const toggleStoreDeliveries = () => {
    applyFilterValue("soloTienda", !filters.soloTienda);
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
  const pageSize = Number(filters.pageSize || 20);
  const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));
  const activeOrderMetric = useMemo(() => {
    const today = todayIsoDate();
    if (filters.sinImprimir) return "facturas";
    if (filters.estado === "APROBADO") return "aprobados";
    if (filters.estado === "CREADO") return "pendientes";
    if (filters.estado === "CANCELADO") return "cancelados";
    if (!filters.estado && filters.fechaDesde === today && filters.fechaHasta === today) return "hoy";
    return "";
  }, [filters.estado, filters.fechaDesde, filters.fechaHasta, filters.sinImprimir]);
  const ordersMetrics = useMemo(() => {
    const today = todayIsoDate();
    const facturasNoImpresasVisibles = items.filter(item => canInvoiceStatus(item.estado) && !item.facturaImpresa).length;
    return {
      total: items.length,
      hoy: items.filter(item => {
        const { date: fechaPedido } = splitDateTimeParts(item.fechaPedido || item.fecha);
        const entrega = orderDeliveryDate(item);
        return fechaPedido === today || entrega === today;
      }).length,
      aprobados: items.filter(item => normalizeStatus(item.estado) === "APROBADO").length,
      pendientes: items.filter(item => isPendingStatus(item.estado) || normalizeStatus(item.estado) === "CREADO").length,
      cancelados: items.filter(item => ["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item.estado))).length,
      facturasNoImpresas: Number(facturasPendientesImpresion || facturasNoImpresasVisibles || 0),
    };
  }, [facturasPendientesImpresion, items]);
  const orderMetricCards = useMemo(() => {
    const baseCards = [
      { key: "hoy", label: "Pedidos hoy", shortLabel: "Hoy", value: Number(ordersMetrics.hoy || 0), tone: "is-primary", Icon: CalendarCheck2 },
      { key: "aprobados", label: "Aprobados", shortLabel: "Aprobados", value: Number(ordersMetrics.aprobados || 0), tone: "is-green", Icon: CheckCircle2 },
      { key: "pendientes", label: "Pendientes", shortLabel: "Pendientes", value: Number(ordersMetrics.pendientes || 0), tone: "is-blue", Icon: Clock3 },
      { key: "cancelados", label: "Cancelados", shortLabel: "Cancelados", value: Number(ordersMetrics.cancelados || 0), tone: "is-orange", Icon: XCircle },
      { key: "facturas", label: "Facturas no impresas", shortLabel: "Sin imprimir", value: Number(ordersMetrics.facturasNoImpresas || 0), tone: "is-purple", Icon: Receipt },
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
      return {
        ...card,
        className: `${card.tone} ${weightClass}${attentionClass ? ` ${attentionClass}` : ""}`,
      };
    });
  }, [ordersMetrics]);
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
            inventario: onGoInventario,
            contabilidad: onGoContabilidad,
            trazabilidad: onGoTrazabilidad,
            clientes: onGoClientes,
            usuarios: onGoUsuarios,
          }}
          badges={{ pedidos: total }}
        />

        <main className="orders-admin-view orders-page-view">
          <header className="orders-admin-header orders-page-header">
            <div className="orders-page-heading">
              <div className="orders-page-title-group">
                <h1>Pedidos</h1>
              </div>
              <p className="orders-admin-subtitle">Usuario: {displayUserName}</p>
            </div>
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
            </div>
          </header>

          <section className="orders-metrics-grid orders-bi-grid" aria-label="Indicadores de pedidos">
            {orderMetricCards.map(card => {
              const Icon = card.Icon;
              const isActive = activeOrderMetric === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  className={`orders-bi-card ${card.className}${isActive ? " is-active" : ""}`}
                  onClick={() => focusOrderMetric(card.key)}
                  aria-pressed={isActive}
                  aria-label={`${card.label}: ${card.value}`}
                >
                  <span className="orders-bi-icon-shell" aria-hidden="true">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="orders-bi-label">{card.shortLabel}</span>
                  <strong className="orders-bi-value">{card.value}</strong>
                </button>
              );
            })}
          </section>

          <section className="orders-filters orders-filters--four-col orders-page-filters">
            <div className="filter-field orders-filter-field">
              <div className="orders-filter-control">
                <Search size={17} strokeWidth={2} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Buscar pedido, barrio, mensaje, pago, cuenta, celular, firma..."
                  value={filters.q}
                  onChange={event => applyFilterValue("q", event.target.value)}
                />
              </div>
            </div>
            <div className="filter-field orders-filter-field">
              <div className="orders-filter-control">
                <CalendarDays size={17} strokeWidth={2} aria-hidden="true" />
                <input
                  type="date"
                  value={filters.fechaDesde}
                  onChange={event => applyFilterValue("fechaDesde", event.target.value)}
                />
              </div>
            </div>
            <div className="filter-field orders-filter-field">
              <div className="orders-filter-control">
                <CalendarDays size={17} strokeWidth={2} aria-hidden="true" />
                <input
                  type="date"
                  value={filters.fechaHasta}
                  onChange={event => applyFilterValue("fechaHasta", event.target.value)}
                />
              </div>
            </div>
            <label className="filter-field orders-filter-field orders-status-filter">
              <details className="estado-filtro-dropdown">
                <summary className="estado-filtro-summary">
                  <Filter size={17} strokeWidth={2} aria-hidden="true" />
                  Estados
                </summary>
                <div className="estado-filtro-panel">
                  <div className="estado-filtro-list">
                    {[
                      { value: "", label: "Todos" },
                      { value: "CREADO", label: "Creado" },
                      { value: "APROBADO", label: "Aprobado" },
                      { value: "CANCELADO", label: "Cancelado" },
                    ].map(item => (
                      <label key={item.value || "todos"} className="estado-filtro-item">
                        <input
                          type="radio"
                          name="ordersEstadoFiltro"
                          checked={filters.estado === item.value}
                          onChange={() => applyFilterValue("estado", item.value)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            </label>
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
          {loading && <p className="orders-message">Cargando pedidos...</p>}
          {!loading && !error && items.length === 0 && (
            <p className="orders-message">No hay pedidos para los filtros seleccionados.</p>
          )}

          <section className="orders-table-wrap orders-page-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>ID Pedido</th>
                  <th>Producto / Cliente</th>
                  <th>Cliente · Destinatario</th>
                  <th>Fecha entrega</th>
                  <th>Florista</th>
                  <th>Método pago</th>
                  <th>Estado</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const statusClass = statusBadgeClass(item.estado, item);
                  const productText = (item.productos || []).slice(0, 2).join(", ");
                  const waPhone = String(item.telefonoCompleto || item.telefono || "").trim().replace(/\+/g, "");
                  const pedidoId = Number(item.pedidoID);
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
                  const canDownloadInvoice = canInvoiceStatus(item.estado);
                  const canViewMessageCard = canMessageCardStatus(item.estado);
                  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(item.fechaEntrega);
                  const normalizedStatus = normalizeStatus(item.estado);
                  const rowClass = [
                    selectedPedidoId === pedidoId && drawerOpen ? "is-active" : "",
                    "orders-row-card",
                    normalizedStatus === "APROBADO" ? "orders-row-approved" : "",
                    normalizedStatus === "CANCELADO" || normalizedStatus === "RECHAZADO" ? "orders-row-cancelled" : "",
                    isPendingStatus(item.estado) || normalizedStatus === "CREADO" ? "orders-row-pending" : "",
                  ].filter(Boolean).join(" ");
                  const floristaName = item.floristaAsignado || item.florista || item.nombreFlorista || "Sin asignar";

                  return (
                    <tr
                      key={pedidoId || `${item.numeroPedido}-${item.fecha}`}
                      className={rowClass}
                    >
                      <td data-label="ID Pedido">
                        <span className="orders-order-badge">{item.numeroPedido ?? pedidoId ?? "-"}</span>
                      </td>
                      <td data-label="Producto" title={(item.productos || []).join(", ")}>
                        <div className="orders-product-cell">
                          <strong>{productText || "-"}</strong>
                          <span className="orders-product-client-line">
                            <span className="orders-client-avatar" aria-hidden="true">{initialsFromName(item.cliente)}</span>
                            <span>
                              <b>{item.cliente || "-"}</b>
                              <small>Destinatario: {item.destinatario || "-"}</small>
                            </span>
                          </span>
                        </div>
                      </td>
                      <td data-label="Cliente · Destinatario" className="orders-client-column">
                        <div className="orders-client-cell">
                          <span className="orders-client-avatar" aria-hidden="true">{initialsFromName(item.cliente)}</span>
                          <div className="orders-cell-stack">
                            <strong>{item.cliente || "-"}</strong>
                            <span>Destinatario: {item.destinatario || "-"}</span>
                          </div>
                        </div>
                      </td>
                      <td data-label="Fecha entrega">
                        <div className="orders-cell-stack orders-cell-stack--delivery">
                          <span><CalendarDays size={14} strokeWidth={2} /> {fechaEntrega || "-"}</span>
                          <span className="orders-delivery-pill"><Clock3 size={14} strokeWidth={2} /> {item.horaEntrega || horaEntrega || "-"}</span>
                        </div>
                      </td>
                      <td data-label="Florista">
                        <div className={`orders-florist-cell${floristaName === "Sin asignar" ? " is-unassigned" : ""}`}>
                          <span className="orders-client-avatar orders-florist-avatar" aria-hidden="true">
                            {floristaName === "Sin asignar" ? <UserCircle size={18} strokeWidth={2} /> : initialsFromName(floristaName)}
                          </span>
                          <span>{floristaName}</span>
                        </div>
                      </td>
                      <td data-label="Método pago">{item.metodoPago || "-"}</td>
                      <td data-label="Estado">
                        <div className="orders-cell-stack">
                          <span className={`order-badge ${statusClass}`}>
                            <span className="orders-status-icon" aria-hidden="true" />
                            {item.estado || "-"}
                          </span>
                          {canDownloadInvoice && !item.facturaImpresa ? (
                            <span className="orders-inline-alert">Factura pendiente</span>
                          ) : null}
                          {["CANCELADO", "RECHAZADO"].includes(normalizeStatus(item.estado)) && item.motivoRechazo ? (
                            <span className="orders-inline-alert" title={item.motivoRechazo}>Nota: {item.motivoRechazo}</span>
                          ) : null}
                        </div>
                      </td>
                      <td data-label="Valor">
                        <span className="orders-total-value">${formatearCOP(Number(item.total || 0))}</span>
                      </td>
                      <td data-label="Acciones">
                        <div className="order-actions">
                          <button type="button" className="order-icon order-icon-view" onClick={() => openDetail(pedidoId)} title="Ver detalle" aria-label="Ver detalle"><Eye size={17} strokeWidth={2} /></button>
                          <details className="orders-row-menu">
                            <summary className="order-icon orders-row-menu-trigger" title="Más acciones" aria-label="Más acciones">
                              <MoreHorizontal size={17} strokeWidth={2} />
                            </summary>
                            <div className="orders-row-menu-panel">
                              <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="orders-row-menu-item">
                                <MessageCircle size={16} strokeWidth={2} />
                                <span>WhatsApp</span>
                              </a>
                              <button type="button" className="orders-row-menu-item" onClick={() => approveOrder(pedidoId)} disabled={approveDisabled} title={approveTitle}>
                                <IconCheck size={16} stroke={2.1} />
                                <span>Aprobar</span>
                              </button>
                              <button type="button" className="orders-row-menu-item" onClick={() => rejectOrder(pedidoId)} disabled={!canCancelAction} title={canInvoiceStatus(item.estado) ? "Cancelar pedido aprobado" : "Rechazar pedido"}>
                                <IconX size={16} stroke={2.1} />
                                <span>{canInvoiceStatus(item.estado) ? "Cancelar" : "Rechazar"}</span>
                              </button>
                              {canDownloadInvoice && (
                                <button type="button" className="orders-row-menu-item" onClick={() => downloadInvoice(pedidoId)} title="Descargar factura">
                                  <Receipt size={16} strokeWidth={2} />
                                  <span>Factura</span>
                                </button>
                              )}
                              {canViewMessageCard && (
                                <button type="button" className="orders-row-menu-item" onClick={() => openMessageCard(item)} title="Ver mensaje e imprimir tarjeta">
                                  <MessageCircle size={16} strokeWidth={2} />
                                  <span>Mensaje / tarjeta</span>
                                </button>
                              )}
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <footer className="orders-pager">
            <button
              type="button"
              className="btn-outline"
              title="Ir a la página anterior"
              onClick={() => setFilters(current => ({ ...current, page: Math.max(1, Number(current.page || 1) - 1) }))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>Página {page} de {pages} · {total} pedidos</span>
            <button
              type="button"
              className="btn-outline"
              title="Ir a la página siguiente"
              onClick={() => setFilters(current => ({ ...current, page: Number(current.page || 1) + 1 }))}
              disabled={page >= pages}
            >
              Siguiente
            </button>
          </footer>
        </main>
      </div>

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
                <span>${formatearCOP(Number(detalle.financiero?.total || 0))}</span>
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
                                {producto.codigoProducto || `Arreglo ${index + 1}`}
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
                                    setDetailAddProductoCodigo(String(item.codigo || ""));
                                    setDetailAddNombreArreglo(String(item.nombre || ""));
                                    setDetailAddCantidad(1);
                                    setDetailAddPrecio(item.precio != null ? normalizeWholePeso(item.precio) : null);
                                    setDetailAddDropdownOpen(false);
                                    setDetailAddFilterText("");
                                  }}
                                >
                                  {buildProductoLabel(item)}
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
                            value={detailAddProductoCodigo}
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
                        value={detailEditProductoCodigo}
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
                                  setDetailEditProductoCodigo(String(item.codigo || ""));
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
                                {buildProductoLabel(item)}
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
                                <span>Saldo a favor: -${formatearCOP(detailEditFinancialPreview.saldoFavorMonto)}</span>
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

function OrderDetail({ detalle, paymentTitle = "Método de pago", salesChannelTitle = "Celular Flora" }) {
  const productos = Array.isArray(detalle.productos) ? detalle.productos : [];
  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(detalle.fechaPedido || detalle.fecha);
  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(detalle.destinatario?.fechaEntrega);
  const tipoDocumentoCliente = formatClienteTipoDocumento(detalle.cliente);
  const numeroDocumentoCliente = formatClienteNumeroDocumento(detalle.cliente);
  const paymentBreakdown = extractPaymentBreakdown(detalle.financiero);
  const totalPedido = Number(detalle.financiero?.total || 0);
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
          {detailRow("Factura", detalle.financiero?.facturaImpresa ? "Impresa" : "Pendiente")}
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
                  <strong>{producto.nombreProducto || `Arreglo ${index + 1}`}</strong>
                  <span>Código {producto.codigoProducto || "-"}</span>
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
          {Number(detalle.financiero?.saldoFavorMonto || 0) > 0 ? detailRow("Saldo a favor", `-$${formatearCOP(Number(detalle.financiero?.saldoFavorMonto || 0))}`) : null}
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
    nombre: String(raw?.nombreProducto || raw?.nombre || raw?.descripcion || "").trim(),
    descripcion: String(raw?.descripcion || raw?.observaciones || "").trim(),
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

function buildProductoLabel(producto) {
  const codigo = String(producto?.codigo || "").trim();
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






