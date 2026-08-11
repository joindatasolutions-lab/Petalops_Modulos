import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { useRef } from "react";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, shiftIsoDate } from "../../shared/utils.js";
import { useDebouncedValue } from "../../shared/useDebouncedValue.js";
import { MessageCardModal } from "./components/MessageCardModal.jsx";
import { NewOrderModal } from "./components/NewOrderModal.jsx";
import { OrderDetailDrawer } from "./components/OrderDetailDrawer.jsx";
import { OrderNotification } from "./components/OrderNotification.jsx";
import { ORDER_METRIC_ICONS, OrdersHeader } from "./components/OrdersHeader.jsx";
import { OrdersFilters } from "./components/OrdersFilters.jsx";
import { OrdersListSection } from "./components/OrdersListSection.jsx";
import { OrdersPager } from "./components/OrdersPager.jsx";
import { canInvoiceStatus } from "./ordersUiRules.js";
import {
  buildProductoLabel,
  dedupeBarrioItems,
  dedupeCatalogItems,
  extractBarrioItems,
  getProductoId,
  normalizeBarrioItem,
  normalizeCatalogItem,
} from "./orderCatalogAdapters.js";
import {
  normalizeTime,
  toDateInput,
} from "./orderDateFormatters.js";
import {
  AUTO_REFRESH_INTERVAL_MS,
  CANCELADO_PEDIDO_ESTADO_ID,
  DEFAULT_NEW_ORDER_FORM,
  initialFilters,
} from "./ordersAdminConstants.js";
import {
  detailEditBarrioNombreOrFallback,
  normalizeDeliveryType,
} from "./orderDeliveryType.js";
import {
  normalizeIdentType,
} from "./orderDetailFormatters.js";
import {
  buildAddDetailProductPayload,
  buildDetailUpdatePayload,
  buildDuplicateCheckoutPayload as buildDuplicateCheckoutPayloadData,
  buildNewOrderCheckoutPayload as buildNewOrderManualPayloadData,
} from "./orderPayloadBuilders.js";
import { useMessageCardController } from "./hooks/useMessageCardController.js";
import { useOrderDetailEditor } from "./hooks/useOrderDetailEditor.js";
import { useOrdersAdminData } from "./hooks/useOrdersAdminData.js";
import { useOrdersCatalogs } from "./hooks/useOrdersCatalogs.js";
import {
  applyDeliveryGiftOverrideToDetail,
  forgetDeliveryGiftOverride,
  getDeliveryFinancialOverride,
  rememberDeliveryGiftOverride,
} from "./deliveryGiftOverrides.js";

import {
  buildCatalogProductIndex,
  buildEditedOrderFinancialBase,
  buildOrderFinancialPreview,
  buildOrdersMetrics,
  buildPaginationItems,
  clampPercentage,
  displayProductCode,
  ensureRappiOption,
  extractOrdersPayloadItems,
  extractPaymentAmounts,
  filterOrdersByCreatedDateRange,
  filterOrdersByPaymentMethod,
  filterOrdersBySearch,
  filterOrdersByStatus,
  filterStorePickupOrders,
  getOrderFinancialTotal,
  isCashPaymentMethod,
  isCustomArrangement,
  isEmpresaAdminRole,
  isDeliveryGifted,
  isLinkPaymentMethod,
  isOrderNumberSearchTerm,
  isStorePickupOrder,
  localDateEndParam,
  localDateStartParam,
  normalizeOrderProducts,
  normalizePaymentMethods,
  normalizeWholePeso,
  resolveAssignedOrderNumber,
  resolveCatalogProduct,
  resolveFloristaName,
  resolveOrderId,
  resolveOrderListTotal,
  resolveOrderProductSummary,
  resolveOrdersPayloadTotal,
  roundCurrency,
  sanitizeWholePesoInput,
  shouldAutoGenerateInvoiceForCompany,
  shouldShowPendingInvoiceAlert,
  thisMonthRangeIso,
  thisWeekRangeIso,
  todayIsoDate,
} from "./ordersDomain.js";

/**
 * Pagina principal del modulo Pedidos.
 *
 * Responsabilidad:
 * - Coordinar estado React, llamadas al API y acciones de usuario.
 * - Delegar UI repetible a componentes en `components/`.
 * - Delegar reglas puras a helpers de dominio/adaptadores.
 *
 * Nota de mantenimiento:
 * Si una funcion no depende de hooks o setters de React, preferir moverla a un
 * helper probado para que este archivo siga siendo un orquestador.
 */
export {
  buildOrdersMetrics,
  extractOrdersPayloadItems,
  filterOrdersByCreatedDateRange,
  filterOrdersByPaymentMethod,
  filterOrdersBySearch,
  filterOrdersByStatus,
  isStorePickupOrder,
  localDateEndParam,
  localDateStartParam,
  resolveOrdersPayloadTotal,
  shouldAutoGenerateInvoiceForCompany,
  shouldShowPendingInvoiceAlert,
} from "./ordersDomain.js";

function resolveCatalogTenantSlug(session) {
  return String(session?.empresaSlug || "").trim();
}

export function OrdersAdminPage({ session, canViewPipeline, canViewPedidos, canViewCatalogo, canViewProduccion, canViewDomicilios, canViewBarrios, canViewInventario, canViewContabilidad, canViewTrazabilidad, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario, onGoContabilidad, onGoTrazabilidad, onGoClientes, onGoUsuarios }) {
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPedidoId, setSelectedPedidoId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
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
  const [detailEditDomicilioObsequiado, setDetailEditDomicilioObsequiado] = useState(false);
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
  const [mobileHeaderScrolled, setMobileHeaderScrolled] = useState(false);
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
  const loadOrdersRef = useRef(null);
  const loadTodaySalesSummaryRef = useRef(null);
  const newOrderLookupPhoneRef = useRef("");
  const debouncedQuery = useDebouncedValue(filters.q, 300);
  const debouncedNewOrderPhone = useDebouncedValue(newOrderForm.clienteTelefono, 500);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const catalogTenantSlug = resolveCatalogTenantSlug(session);
  const catalogUrl = useMemo(
    () => catalogTenantSlug
      ? `https://catalogo-web.joindata.com.co/catalogo/${encodeURIComponent(catalogTenantSlug)}`
      : "",
    [catalogTenantSlug]
  );
  const {
    loading,
    error,
    items,
    setItems,
    total,
    facturasPendientesImpresion,
    ordersKpis,
    metricItems,
    metricFacturasPendientesImpresion,
    yesterdayMetrics,
    todaySalesTotal,
    loadOrders,
    loadYesterdayMetrics,
    loadTodaySalesSummary,
    clearOrdersCache,
  } = useOrdersAdminData({
    api,
    empresaId,
    sucursalId,
    filters,
    debouncedQuery,
  });
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
    if (detailEditProductoID) {
      const byProductId = detailProducts.find(product => String(getProductoId(product) ?? "") === String(detailEditProductoID));
      if (byProductId) return byProductId;
    }
    if (detailEditDetalleID) {
      const byDetailId = detailProducts.find(product => String(product?.detalleID ?? "") === String(detailEditDetalleID));
      if (byDetailId) return byDetailId;
    }
    return detailProducts[0];
  }, [detailEditDetalleID, detailEditProductoID, detailProducts]);
  const detailEditDisplayProductoCodigo = useMemo(() => (
    displayProductCode(
      detailEditCatalogProduct || detailSelectedProduct || {
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
    () => detailEditCustomPriceEnabled || isCustomArrangement({
      codigo: detailEditProductoCodigo,
      nombre: detailEditNombreArreglo,
      observaciones: [
        detailEditProductoObservaciones,
        detailEditCatalogProduct?.descripcion,
      ].filter(Boolean).join(" "),
    }),
    [detailEditCatalogProduct, detailEditCustomPriceEnabled, detailEditNombreArreglo, detailEditProductoCodigo, detailEditProductoObservaciones]
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
      const baseFinancial = buildEditedOrderFinancialBase({
        detalle,
        detalleID: detailEditDetalleID,
        cantidad: detailEditCantidad,
        precio: detailEditPrecio,
        selectedCatalogProduct: detailEditCatalogProduct,
      });
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
        detailEditSaldoFavorMonto,
        normalizedDeliveryType !== "recogida_en_tienda" && detailEditDomicilioObsequiado
      );
    },
    [detalle, detailEditBarrioNombre, detailEditCantidad, detailEditCatalogProduct, detailEditDetalleID, detailEditDomicilioObsequiado, detailEditPrecio, detailEditSelectedBarrio, detailEditSelectedPaymentMethods, detailEditOmitirRecargoLink, detailEditDescuentoMonto, detailEditSaldoFavorMonto]
  );
  const detailEditShowPriceField = detailEditCustomPriceEnabled || detailEditPrecio != null;
  const detailEditSelectedProductLabel = useMemo(() => {
    const selected = detailEditCatalogProduct || detailSelectedProduct;
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
      observaciones: detailAddCatalogProduct?.descripcion,
    }),
    [detailAddCatalogProduct, detailAddNombreArreglo, detailAddProductoCodigo]
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
    const productoNotaProduccion = String(
      product?.notaProduccion
      || product?.nota_produccion
      || product?.notasProduccion
      || product?.notas_produccion
      || product?.observacionesInternasProduccion
      || product?.observaciones_internas_produccion
      || product?.observacionesinternas
      || product?.produccion?.observacionesinternas
      || product?.produccion?.observacionesInternasProduccion
      || product?.produccion?.observaciones_internas_produccion
      || product?.notas
      || product?.observaciones
      || ""
    ).trim();
    const pedidoNotaProduccion = String(
      detalle?.notaProduccion
      || detalle?.nota_produccion
      || detalle?.notasProduccion
      || detalle?.notas_produccion
      || detalle?.observacionesInternasProduccion
      || detalle?.observaciones_internas_produccion
      || detalle?.observacionesinternas
      || detalle?.produccion?.observacionesinternas
      || detalle?.produccion?.observacionesInternasProduccion
      || detalle?.produccion?.observaciones_internas_produccion
      || detalle?.pedido?.notaProduccion
      || detalle?.pedido?.nota_produccion
      || detalle?.pedido?.notas
      || detalle?.notas
      || ""
    ).trim();
    const productoObservaciones = productoNotaProduccion || pedidoNotaProduccion;
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
  }, [detailEmpresaId, detalle]);

  const loadBarrioOptions = useCallback(async (query = "") => {
    const text = String(query || "").trim();
    setDetailEditBarriosLoading(true);
    try {
      const payload = await api.buscarBarrios({ empresaId, sucursalId, q: text });
      const loaded = extractBarrioItems(payload);
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
const messageCard = useMessageCardController({
    api,
    selectedPedidoId,
    setDetalle,
    loadOrders,
  });
  const messageCardOpen = messageCard.open;
  const openMessageCard = messageCard.openMessageCard;
  const closeMessageCard = messageCard.closeMessageCard;
  const saveMessageCard = messageCard.saveMessageCard;

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
      setDetailEditDomicilioObsequiado(false);
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
    setDetailEditDomicilioObsequiado(isDeliveryGifted(detalle.financiero, detalle.entrega, detalle.destinatario));
    setDetailEditBarrioQuery("");
    setDetailEditBarrios(dedupeBarrioItems([
      normalizeBarrioItem({ nombreBarrio: "Recoger en tienda" }),
      normalizeBarrioItem({ nombreBarrio: detalle.destinatario?.barrio }),
    ].filter(Boolean)));
    setDetailEditBarrioDropdownOpen(false);
    setDetailEditFirma(String(detalle.destinatario?.firma_tarjeta || detalle.destinatario?.firmaTarjeta || detalle.destinatario?.firma || ""));
    setDetailEditMensajeTarjeta(String(detalle.destinatario?.mensaje_tarjeta || detalle.destinatario?.mensajeTarjeta || detalle.destinatario?.mensaje || ""));
    setDetailEditObservacionGeneral(String(detalle.destinatario?.observaciones_entrega || detalle.destinatario?.observacionesEntrega || detalle.destinatario?.observacionGeneral || ""));
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
    const hasOverlay = drawerOpen || newOrderOpen || messageCardOpen || Boolean(orderNotification);
    document.body.classList.toggle("orders-mobile-overlay-open", hasOverlay);
    return () => document.body.classList.remove("orders-mobile-overlay-open");
  }, [drawerOpen, messageCardOpen, newOrderOpen, orderNotification]);

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

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setMobileHeaderScrolled(scrollTop > 10);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const applySingleDateFilter = value => {
    setFilters(current => {
      if (current.fechaDesde === value && current.fechaHasta === value && Number(current.page || 1) === 1) return current;
      return {
        ...current,
        fechaDesde: value,
        fechaHasta: value,
        page: 1
      };
    });
  };

  const openDetail = async (pedidoId, detailPatch = null) => {
    setOpenOrderActionsId(null);
    setDrawerOpen(true);
    setSelectedPedidoId(pedidoId);
    setDetalle(null);

    try {
      const rawDetail = applyDeliveryGiftOverrideToDetail(pedidoId, await api.obtenerDetallePedido(pedidoId));
      const detail = detailPatch && typeof detailPatch === "object"
        ? {
            ...rawDetail,
            ...detailPatch,
            financiero: {
              ...(rawDetail?.financiero || {}),
              ...(detailPatch.financiero || {}),
            },
            entrega: {
              ...(rawDetail?.entrega || {}),
              ...(detailPatch.entrega || {}),
            },
            destinatario: {
              ...(rawDetail?.destinatario || {}),
              ...(detailPatch.destinatario || {}),
            },
          }
        : rawDetail;
      setDetalle(detail);
      patchOrderListItemFromDetail(pedidoId, detail);
      return detail;
    } catch (nextError) {
      console.error("Error obteniendo detalle:", nextError);
      setDetalle({ error: true });
      return null;
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
      if (shouldAutoGenerateInvoiceForCompany(empresaId)) {
        await downloadInvoice(pedidoId, { refreshAfter: false });
      }
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
        clearOrdersCache();
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
      clearOrdersCache();
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
      const financialOverride = getDeliveryFinancialOverride(pedidoId);
      if (financialOverride && typeof api.actualizarFinanzasPedidoPipeline === "function") {
        await api.actualizarFinanzasPedidoPipeline({
          pedidoId,
          ...financialOverride,
          costoDomicilio: financialOverride.domicilio,
        });
      }
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
  const refresh = () => {
    loadOrders(false);
    loadTodaySalesSummary();
  };

  const closeDrawer = () => {
    setOpenOrderActionsId(null);
    setDrawerOpen(false);
    setSelectedPedidoId(null);
    setIsDuplicatingDetail(false);
  };
  const {
    filteredDetailCatalog,
    filteredAddDetailCatalog,
    filteredNewOrderProducts,
    filteredBarrioOptions,
    filteredNewOrderBarrios,
    onSearchCatalog,
    onSearchNewOrderProducts,
  } = useOrdersCatalogs({
    api,
    empresaId,
    sucursalId,
    detailCatalog: detailEditCatalog,
    setDetailCatalog: setDetailEditCatalog,
    detailFilterText: detailEditFilterText,
    addFilterText: detailAddFilterText,
    newOrderProductQuery,
    newOrderProducts,
    setNewOrderProducts,
    detailBarrios: detailEditBarrios,
    detailBarrioQuery: detailEditBarrioQuery,
    newOrderBarrios,
    newOrderBarrioQuery,
    setDetailCatalogLoading: setDetailEditCatalogLoading,
    setNewOrderProductsLoading,
    setNewOrderError,
  });
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

  const patchOrderListItemFromDetail = (pedidoId, detail) => {
    if (!pedidoId || !detail || detail.error) return;

    setItems(current => current.map(item => {
      if (Number(resolveOrderId(item)) !== Number(pedidoId)) return item;
      const financiero = detail.financiero && typeof detail.financiero === "object" ? detail.financiero : {};
      const detailTotal = getOrderFinancialTotal(financiero);
      const nextTotal = detailTotal > 0 ? detailTotal : financiero.total;
      return {
        ...item,
        total: nextTotal ?? item.total,
        valorTotal: nextTotal ?? item.valorTotal,
        totalPedido: nextTotal ?? item.totalPedido,
        subtotal: financiero.subtotal ?? item.subtotal,
        iva: financiero.iva ?? item.iva,
        domicilio: financiero.domicilio ?? item.domicilio,
        recargoLinkMonto: financiero.recargoLinkMonto ?? item.recargoLinkMonto,
        descuentoMonto: financiero.descuentoMonto ?? item.descuentoMonto,
        saldoFavorMonto: financiero.saldoFavorMonto ?? item.saldoFavorMonto,
        domicilioObsequiado: financiero.domicilioObsequiado ?? detail.entrega?.domicilioObsequiado ?? detail.destinatario?.domicilioObsequiado ?? item.domicilioObsequiado,
        omitirCostoDomicilio: financiero.omitirCostoDomicilio ?? detail.entrega?.omitirCostoDomicilio ?? detail.destinatario?.omitirCostoDomicilio ?? item.omitirCostoDomicilio,
        financiero: {
          ...(item.financiero || {}),
          ...financiero,
        },
      };
    }));
  };

  const updateNewOrderForm = (name, value) => {
    setNewOrderForm(current => ({ ...current, [name]: value }));
  };

  const normalizePhoneDigits = value => String(value || "").replace(/\D/g, "");

  const resolveClientName = client => (
    String(client?.nombreCompleto || client?.nombre_completo || client?.nombre || client?.cliente || "").trim()
  );

  const findClientByPhone = async phone => {
    const digits = normalizePhoneDigits(phone);
    if (digits.length < 7) return null;

    const payload = await api.listarClientes({
      empresaId,
      celular: digits,
      telefono: digits,
      q: digits,
      soloActivos: false,
    });
    const rows = [
      payload?.items,
      payload?.data?.items,
      payload?.data?.clientes,
      payload?.data?.rows,
      payload?.clientes,
      payload?.rows,
      payload,
    ].find(Array.isArray) || [];

    return rows.find(client => {
      const phones = [
        client?.telefono,
        client?.telefonoCompleto,
        client?.telefono_completo,
        client?.celular,
        client?.celularCompleto,
        client?.celular_completo,
      ].map(normalizePhoneDigits).filter(Boolean);
      return phones.some(candidate => candidate === digits || candidate.endsWith(digits) || digits.endsWith(candidate));
    }) || rows[0] || null;
  };

  const hydrateNewOrderClientByPhone = async phone => {
    const digits = normalizePhoneDigits(phone);
    if (digits.length < 7) return null;

    try {
      const client = await findClientByPhone(digits);
      if (!client) return null;

      let hydratedForm = null;
      setNewOrderForm(current => {
        hydratedForm = {
          ...current,
          clienteID: client.clienteID ?? client.clienteId ?? client.idCliente ?? client.id_cliente ?? client.id ?? current.clienteID,
          clienteNombre: resolveClientName(client) || current.clienteNombre,
          clienteTelefono: phone || client.telefonoCompleto || client.telefono || current.clienteTelefono,
          clienteEmail: client.email || "",
          clienteTipoIdent: normalizeIdentType(client.tipoIdent || client.tipo_ident || ""),
          clienteIdentificacion: client.identificacion || client.numeroIdentificacion || client.numero_identificacion || client.documento || "",
        };
        return hydratedForm;
      });
      return hydratedForm;
    } catch (nextError) {
      console.error("Error buscando cliente por telefono:", nextError);
      return null;
    }
  };

  useEffect(() => {
    if (!newOrderOpen) {
      newOrderLookupPhoneRef.current = "";
      return;
    }

    const digits = normalizePhoneDigits(debouncedNewOrderPhone);
    if (digits.length < 7) {
      newOrderLookupPhoneRef.current = "";
      return;
    }
    if (newOrderLookupPhoneRef.current === digits) return;

    newOrderLookupPhoneRef.current = digits;
    hydrateNewOrderClientByPhone(digits);
  }, [debouncedNewOrderPhone, newOrderOpen]);

  const buildNewOrderManualPayload = (form = newOrderForm) => buildNewOrderManualPayloadData({
    form,
    empresaId,
    sucursalId,
    productoID: Number(form.productoID || 0),
  });

  const onSaveNewOrder = async () => {
    if (newOrderSaving) return;
    setNewOrderError("");
    setNewOrderSaving(true);
    try {
      const hydratedForm = await hydrateNewOrderClientByPhone(newOrderForm.clienteTelefono);
      const manualPayload = buildNewOrderManualPayload(hydratedForm || newOrderForm);
      const created = await api.crearPedidoManual(manualPayload);
      const createdPedidoId = created?.pedidoID || created?.pedidoId || created?.pedido_id || created?.idPedido || created?.id_pedido || created?.id;
      setNewOrderOpen(false);
      setOrderNotification({
        type: "success",
        title: "Pedido creado",
        message: `Pedido #${created?.numeroPedido || created?.pedidoID || ""} registrado correctamente.`,
      });
      await loadOrders(false);
      if (createdPedidoId) await openDetail(createdPedidoId);
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
  const getDetailEditPayloadState = () => ({
    detalleID: detailEditDetalleID,
    productoID: detailEditProductoID,
    cantidad: detailEditCantidad,
    productoObservaciones: detailEditProductoObservaciones,
    precio: detailEditPrecio,
    isCustomArrangement: detailEditIsCustomArrangement,
    fechaEntrega: detailEditFechaEntrega,
    horaEntrega: detailEditHoraEntrega,
    clienteNombre: detailEditClienteNombre,
    clienteTelefono: detailEditClienteTelefono,
    clienteEmail: detailEditClienteEmail,
    clienteTipoIdent: detailEditClienteTipoIdent,
    clienteIdentificacion: detailEditClienteIdentificacion,
    destinatarioNombre: detailEditDestinatarioNombre,
    telefonoDestino: detailEditTelefonoDestino,
    direccion: detailEditDireccion,
    barrioNombre: detailEditBarrioNombre,
    domicilioObsequiado: detailEditDomicilioObsequiado,
    domicilioOriginal: detailEditFinancialPreview?.domicilioOriginal,
    costoDomicilio: detailEditFinancialPreview?.domicilioOriginal ?? detailEditFinancialPreview?.domicilio ?? null,
    firma: detailEditFirma,
    mensajeTarjeta: detailEditMensajeTarjeta,
    observacionGeneral: detailEditObservacionGeneral,
    omitirRecargoLink: detailEditOmitirRecargoLink,
    descuentoMonto: detailEditDescuentoMonto,
    descuentoNota: detailEditDescuentoNota,
    saldoFavorMonto: detailEditSaldoFavorMonto,
    saldoFavorNota: detailEditSaldoFavorNota,
  });

  const buildDuplicateCheckoutPayload = () => buildDuplicateCheckoutPayloadData({
    detalle,
    empresaId,
    sucursalId,
    edit: getDetailEditPayloadState(),
  });

  const buildDetailEditApiPayload = pedidoId => buildDetailUpdatePayload({
    pedidoId,
    detalle,
    edit: getDetailEditPayloadState(),
    paymentValidation: validatePaymentMethods(),
    canalFlora: validateSalesChannel(),
    canEditClientIdentity,
  });

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
        await api.actualizarDetallePedidoPipeline(buildDetailUpdatePayload({
          pedidoId: created.pedidoID,
          detalle,
          edit: {
            ...getDetailEditPayloadState(),
            detalleID: null,
          },
          paymentValidation,
          canalFlora: validatedCanalFlora,
          canEditClientIdentity,
        }));
        await loadOrders(true);
        await loadTodaySalesSummary();
        await openDetail(created.pedidoID);
        setIsDuplicatingDetail(false);
      } else {
        await api.actualizarDetallePedidoPipeline(buildDetailEditApiPayload(selectedPedidoId));
        const keepGiftedDelivery = normalizeDeliveryType(detailEditBarrioNombre) !== "recogida_en_tienda" && Boolean(detailEditDomicilioObsequiado);
        const deliveryFinancialPatch = detailEditFinancialPreview
          ? {
              subtotal: detailEditFinancialPreview.subtotal,
              iva: detailEditFinancialPreview.iva,
              domicilio: keepGiftedDelivery ? detailEditFinancialPreview.domicilioOriginal : detailEditFinancialPreview.domicilio,
              domicilioOriginal: detailEditFinancialPreview.domicilioOriginal,
              descuentoDomicilio: keepGiftedDelivery ? detailEditFinancialPreview.domicilioOriginal : 0,
              recargoLinkMonto: detailEditFinancialPreview.recargoMonto,
              descuentoMonto: detailEditFinancialPreview.descuentoMonto,
              saldoFavorMonto: detailEditFinancialPreview.saldoFavorMonto,
              total: detailEditFinancialPreview.total,
              domicilioObsequiado: keepGiftedDelivery,
              omitirCostoDomicilio: keepGiftedDelivery,
            }
          : null;
        if (deliveryFinancialPatch) {
          rememberDeliveryGiftOverride(selectedPedidoId, deliveryFinancialPatch);
        } else {
          forgetDeliveryGiftOverride(selectedPedidoId);
        }
        await reloadDrawer({
          financiero: deliveryFinancialPatch || {
            domicilioObsequiado: false,
            omitirCostoDomicilio: false,
          },
          entrega: {
            domicilioObsequiado: keepGiftedDelivery,
            omitirCostoDomicilio: keepGiftedDelivery,
          },
          destinatario: {
            domicilioObsequiado: keepGiftedDelivery,
            omitirCostoDomicilio: keepGiftedDelivery,
          },
        });
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
      const response = await api.agregarDetallePedidoPipeline(buildAddDetailProductPayload({
        pedidoId: selectedPedidoId,
        productoID: detailAddProductoID,
        cantidad: detailAddCantidad,
        isCustomArrangement: detailAddIsCustomArrangement,
        precio: detailAddPrecio,
      }));
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

  const reloadDrawer = async (detailPatch = null) => {
    if (!selectedPedidoId) return;
    const detail = await openDetail(selectedPedidoId, detailPatch);
    await loadOrders(true);
    patchOrderListItemFromDetail(selectedPedidoId, detail);
    await loadTodaySalesSummary();
  };

  const toggleStoreDeliveries = () => {
    const nextSoloTienda = !filters.soloTienda;
    applyFilterValue("soloTienda", nextSoloTienda);
    setOrderNotification({
      tone: nextSoloTienda ? "success" : "info",
      title: nextSoloTienda ? "Entregas en tienda" : "Todos los pedidos",
      message: nextSoloTienda
        ? "Mostrando pedidos marcados como recoger en tienda."
        : "Mostrando todos los pedidos con los filtros actuales.",
    });
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
      { key: "hoy", label: "Pedidos hoy", shortLabel: "Pedidos hoy", value: Number(ordersMetrics.pedidosHoy || 0), tone: "is-primary", Icon: ORDER_METRIC_ICONS.hoy, helperText: "Operacion diaria" },
      { key: "aprobados", label: "Aprobados", shortLabel: "Aprobados", value: Number(ordersMetrics.aprobados || 0), tone: "is-green", Icon: ORDER_METRIC_ICONS.aprobados, helperText: "Ultimos 7 dias" },
      { key: "pendientes", label: "Pendientes", shortLabel: "Pendientes", value: Number(ordersMetrics.pendientes || 0), tone: "is-blue", Icon: ORDER_METRIC_ICONS.pendientes, helperText: "Requieren atencion" },
      { key: "cancelados", label: "Cancelados", shortLabel: "Cancelados", value: Number(ordersMetrics.cancelados || 0), tone: "is-orange", Icon: ORDER_METRIC_ICONS.cancelados, helperText: "Ultimos 7 dias" },
      { key: "facturas", label: "Facturas no impresas", shortLabel: "Sin imprimir", value: Number(ordersMetrics.sinImprimir || 0), tone: "is-purple", Icon: ORDER_METRIC_ICONS.facturas, helperText: "Por imprimir" },
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
  const {
    detailEditorProps,
    detailAddEditorProps,
    detailCatalogProps,
    detailPaymentProps,
    detailDrawerActions,
  } = useOrderDetailEditor({
    detalle,
    empresaId,
    detailEmpresaId,
    canEditClientIdentity,
    detailProducts,
    filteredDetailCatalog,
    filteredAddDetailCatalog,
    filteredBarrioOptions,
    totalPedido,
    paymentFieldConfig,
    salesChannelFieldConfig,
    paymentFieldOptions,
    onSearchCatalog,
    loadBarrioOptions,
    onToggleDetailEdit,
    onStartDuplicateDetail,
    reloadDrawer,
    onDeleteDetailProduct,
    onAddDetailProduct,
    onSaveDetailEdit,
    state: {
      isEditingDetail,
      isDuplicatingDetail,
      detailEditSubview,
      detailEditDetalleID,
      detailEditDeletingDetailId,
      detailEditError,
      detailEditSaving,
      detailEditNombreArreglo,
      detailEditDisplayProductoCodigo,
      detailEditCantidad,
      detailEditShowPriceField,
      detailEditPrecio,
      detailEditIsCustomArrangement,
      detailEditSelectedProductLabel,
      detailEditDropdownOpen,
      detailEditFilterText,
      detailEditCatalogLoading,
      detailEditProductoID,
      detailEditFechaEntrega,
      detailEditHoraEntrega,
      detailEditClienteNombre,
      detailEditClienteTelefono,
      detailEditClienteEmail,
      detailEditClienteTipoIdent,
      detailEditClienteIdentificacion,
      detailEditDestinatarioNombre,
      detailEditTelefonoDestino,
      detailEditDireccion,
      detailEditBarrioNombre,
      detailEditBarrioQuery,
      detailEditBarrioDropdownOpen,
      detailEditBarriosLoading,
      detailEditDomicilioObsequiado,
      detailEditProductoObservaciones,
      detailEditFirma,
      detailEditMensajeTarjeta,
      detailEditObservacionGeneral,
      detailAddSelectedProductLabel,
      detailAddDropdownOpen,
      detailAddFilterText,
      detailAddProductoID,
      detailAddCantidad,
      detailAddIsCustomArrangement,
      detailAddPrecio,
      detailAddDisplayProductoCodigo,
      detailAddSaving,
      detailEditSelectedPaymentMethods,
      detailEditPaymentAmounts,
      detailEditMetodosPago,
      detailEditRequiresPaymentBreakdown,
      detailEditHasLinkPayment,
      detailEditOmitirRecargoLink,
      detailEditDescuentoMonto,
      detailEditDescuentoNota,
      detailEditSaldoFavorMonto,
      detailEditSaldoFavorNota,
      detailEditFinancialPreview,
      detailEditCanalFlora,
    },
    setters: {
      setDetailEditSubview,
      setDetailEditDetalleID,
      setDetailEditCantidad,
      setDetailEditPrecio,
      setDetailEditDropdownOpen,
      setDetailEditFilterText,
      setDetailEditProductoID,
      setDetailEditProductoCodigo,
      setDetailEditNombreArreglo,
      setDetailEditProductoObservaciones,
      setDetailEditCustomPriceEnabled,
      setDetailEditFechaEntrega,
      setDetailEditHoraEntrega,
      setDetailEditClienteNombre,
      setDetailEditClienteTelefono,
      setDetailEditClienteEmail,
      setDetailEditClienteTipoIdent,
      setDetailEditClienteIdentificacion,
      setDetailEditDestinatarioNombre,
      setDetailEditTelefonoDestino,
      setDetailEditDireccion,
      setDetailEditBarrioNombre,
      setDetailEditBarrioQuery,
      setDetailEditBarrioDropdownOpen,
      setDetailEditDomicilioObsequiado,
      setDetailEditFirma,
      setDetailEditMensajeTarjeta,
      setDetailEditObservacionGeneral,
      setDetailAddDropdownOpen,
      setDetailAddFilterText,
      setDetailAddProductoID,
      setDetailAddProductoCodigo,
      setDetailAddNombreArreglo,
      setDetailAddCantidad,
      setDetailAddPrecio,
      setDetailEditMetodosPago,
      setDetailEditPaymentAmounts,
      setDetailEditOmitirRecargoLink,
      setDetailEditDescuentoMonto,
      setDetailEditDescuentoNota,
      setDetailEditSaldoFavorMonto,
      setDetailEditSaldoFavorNota,
      setDetailEditCanalFlora,
    },
  });
const ordersOverlayOpen = drawerOpen || newOrderOpen || messageCardOpen || Boolean(orderNotification);
  return (
    <>
      <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""} ${drawerOpen ? "is-orders-drawer-open" : ""} ${ordersOverlayOpen ? "is-orders-overlay-open" : ""} ${mobileHeaderScrolled ? "is-mobile-header-scrolled" : ""}`}>
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
          <OrderNotification
            notification={orderNotification}
            onClose={() => setOrderNotification(null)}
          />
          <OrdersHeader
            filters={filters}
            metricCards={orderMetricCards}
            activeMetric={activeOrderMetric}
            headerSalesSummary={headerSalesSummary}
            canViewCatalogo={canViewCatalogo}
            catalogUrl={catalogUrl}
            onFilterChange={applyFilterValue}
            onToggleStoreDeliveries={toggleStoreDeliveries}
            onRefresh={refresh}
            onNewOrder={openNewOrderModal}
            onFocusMetric={focusOrderMetric}
          />

          <OrdersFilters
            filters={filters}
            activeDatePreset={activeDatePreset}
            onApplyDatePreset={applyDatePreset}
            onApplySingleDateFilter={applySingleDateFilter}
            onFilterChange={applyFilterValue}
            onClearFilters={clearOrderFilters}
          />

          <OrdersListSection
            error={error}
            loading={loading}
            items={items}
            empresaId={empresaId}
            session={session}
            approvingPedidoIds={approvingPedidoIds}
            selectedPedidoId={selectedPedidoId}
            drawerOpen={drawerOpen}
            openOrderActionsId={openOrderActionsId}
            setOpenOrderActionsId={setOpenOrderActionsId}
            openDetail={openDetail}
            approveOrder={approveOrder}
            rejectOrder={rejectOrder}
            downloadInvoice={downloadInvoice}
            openMessageCard={openMessageCard}
          />

          <OrdersPager
            total={total}
            visibleFrom={visibleFrom}
            visibleTo={visibleTo}
            page={page}
            pages={pages}
            pageSize={pageSize}
            pagerItems={pagerItems}
            onPageChange={nextPage => setFilters(current => ({ ...current, page: nextPage }))}
            onPageSizeChange={nextPageSize => setFilters(current => ({ ...current, page: 1, pageSize: nextPageSize }))}
          />
        </main>
      </div>

      {newOrderOpen ? (
        <NewOrderModal
          empresaId={empresaId}
          form={newOrderForm}
          productQuery={newOrderProductQuery}
          productsLoading={newOrderProductsLoading}
          productDropdownOpen={newOrderProductDropdownOpen}
          filteredProducts={filteredNewOrderProducts}
          barrioQuery={newOrderBarrioQuery}
          barrioDropdownOpen={newOrderBarrioDropdownOpen}
          filteredBarrios={filteredNewOrderBarrios}
          saving={newOrderSaving}
          error={newOrderError}
          paymentFieldConfig={paymentFieldConfig}
          paymentFieldOptions={paymentFieldOptions}
          salesChannelFieldConfig={salesChannelFieldConfig}
          buildProductoLabel={buildProductoLabel}
          normalizeDeliveryType={normalizeDeliveryType}
          onClose={closeNewOrderModal}
          onSave={onSaveNewOrder}
          onUpdateForm={updateNewOrderForm}
          onSetForm={setNewOrderForm}
          onSetProductQuery={setNewOrderProductQuery}
          onSetProductDropdownOpen={setNewOrderProductDropdownOpen}
          onSearchProducts={onSearchNewOrderProducts}
          onSetBarrioQuery={setNewOrderBarrioQuery}
          onSetBarrioDropdownOpen={setNewOrderBarrioDropdownOpen}
          onLoadBarrios={loadBarrioOptions}
          onLookupClientByPhone={hydrateNewOrderClientByPhone}
        />
      ) : null}
      <OrderDetailDrawer
        drawerOpen={drawerOpen}
        detalle={detalle}
        selectedPedidoId={selectedPedidoId}
        empresaId={empresaId}
        header={{ onClose: closeDrawer }}
        editor={detailEditorProps}
        addEditor={detailAddEditorProps}
        catalogs={detailCatalogProps}
        payment={detailPaymentProps}
        actions={detailDrawerActions}
        detailTitles={{
          paymentTitle: paymentFieldConfig?.titulo || "Metodo de pago",
          salesChannelTitle: salesChannelFieldConfig?.titulo || "Celular Flora",
        }}
      />

      {messageCardOpen && (
        <MessageCardModal
          data={messageCard.data}
          order={messageCard.order}
          draft={messageCard.draft}
          saving={messageCard.saving}
          error={messageCard.error}
          fontFamily={messageCard.fontFamily}
          fontSize={messageCard.fontSize}
          textColor={messageCard.textColor}
          textAlign={messageCard.textAlign}
          signatureAlign={messageCard.signatureAlign}
          onDraftChange={messageCard.setDraft}
          onFontFamilyChange={messageCard.setFontFamily}
          onFontSizeChange={messageCard.setFontSize}
          onTextColorChange={messageCard.setTextColor}
          onTextAlignChange={messageCard.setTextAlign}
          onSignatureAlignChange={messageCard.setSignatureAlign}
          onSave={saveMessageCard}
          onClose={closeMessageCard}
        />
      )}
    </>
  );
}
