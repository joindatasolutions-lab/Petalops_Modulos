import { useOrderEditActions } from "./hooks/useOrderEditActions.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { useRef } from "react";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP } from "../../shared/utils.js";
import { useDebouncedValue } from "../../shared/useDebouncedValue.js";
import { MessageCardModal } from "./components/MessageCardModal.jsx";
import { NewOrderModal } from "./components/NewOrderModal.jsx";
import { OrderDetailDrawer } from "./components/OrderDetailDrawer.jsx";
import { OrderNotification } from "./components/OrderNotification.jsx";
import { ORDER_METRIC_ICONS, OrdersHeader } from "./components/OrdersHeader.jsx";
import { OrdersFilters } from "./components/OrdersFilters.jsx";
import { OrdersListSection } from "./components/OrdersListSection.jsx";
import { OrdersPager } from "./components/OrdersPager.jsx";

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
import { AUTO_REFRESH_INTERVAL_MS, DEFAULT_NEW_ORDER_FORM, VOICE_ALERTS_LAST_AUDIT_STORAGE_PREFIX, VOICE_ALERTS_LAST_PEDIDO_STORAGE_PREFIX, VOICE_ALERTS_INTERVAL_MS, VOICE_ALERTS_STORAGE_KEY, initialFilters } from "./ordersAdminConstants.js";
import {
  detailEditBarrioNombreOrFallback,
  normalizeDeliveryType,
} from "./orderDeliveryType.js";
import {
  normalizeIdentType,
} from "./orderDetailFormatters.js";
import { buildDetailUpdatePayload, buildDuplicateCheckoutPayload as buildDuplicateCheckoutPayloadData, buildNewOrderCheckoutPayload as buildNewOrderManualPayloadData } from "./orderPayloadBuilders.js";
import { useMessageCardController } from "./hooks/useMessageCardController.js";
import { useOrderDetailEditor } from "./hooks/useOrderDetailEditor.js";
import { useNewOrderClientLookup } from "./hooks/useNewOrderClientLookup.js";
import { useNewOrderCreation } from "./hooks/useNewOrderCreation.js";
import { useOrderActions } from "./hooks/useOrderActions.js";
import { useOrdersAdminData } from "./hooks/useOrdersAdminData.js";
import { useOrdersCatalogs } from "./hooks/useOrdersCatalogs.js";
import { applyDeliveryGiftOverrideToDetail } from "./deliveryGiftOverrides.js";

import { buildCatalogProductIndex, customArrangementPreTaxTotal, buildEditedOrderFinancialBase, buildOrderFinancialPreview, buildPaginationItems, displayProductCode, extractPaymentAmounts, isCashPaymentMethod, isCustomArrangement, isEmpresaAdminRole, isDeliveryGifted, isValidPaymentBreakdownTotal, isLinkPaymentMethod, normalizePedidosViewStatus, normalizePaymentMethods, normalizeWholePeso, patchOrderItemFromDetail, resolveCatalogProduct, roundCurrency, todayIsoDate, toggleTodayDeliveriesFilters } from "./ordersDomain.js";

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

function extractActiveCatalogNames(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .filter(item => item?.activo !== false)
    .map(item => String(item?.nombre || "").trim())
    .filter(Boolean);
}

function normalizeIdentificationTypeOptions(payload) {
  const rows = Array.isArray(payload?.items) ? payload.items : [];
  const seen = new Set();
  const options = rows
    .map(item => {
      const codigo = normalizeIdentType(item?.codigo || item?.code || item?.value || "").slice(0, 30);
      if (!codigo || seen.has(codigo)) return null;
      seen.add(codigo);
      return {
        codigo,
        nombre: String(item?.nombre || item?.label || codigo).trim() || codigo,
      };
    })
    .filter(Boolean);

  if (!seen.has("CC")) options.unshift({ codigo: "CC", nombre: "Cedula" });
  if (!seen.has("NIT")) options.push({ codigo: "NIT", nombre: "NIT" });
  return options;
}

const SPANISH_FEMALE_VOICE_HINTS = [
  "sabina",
  "helena",
  "elvira",
  "laura",
  "paulina",
  "dalia",
  "paloma",
  "maria",
  "sofia",
  "luciana",
  "catalina",
  "monica",
  "google espanol",
  "google español",
  "spanish latin american",
];

function selectPreferredSpanishVoice(synth) {
  const voices = typeof synth?.getVoices === "function" ? synth.getVoices() : [];
  const spanishVoices = voices.filter(voice => String(voice?.lang || "").toLowerCase().startsWith("es"));
  if (!spanishVoices.length) return null;

  return spanishVoices
    .map(voice => {
      const lang = String(voice.lang || "").toLowerCase();
      const name = String(voice.name || "").toLowerCase();
      let score = 0;
      if (lang === "es-co") score += 90;
      else if (["es-419", "es-mx", "es-us", "es-es"].includes(lang)) score += 70;
      else score += 40;
      if (SPANISH_FEMALE_VOICE_HINTS.some(hint => name.includes(hint))) score += 35;
      if (name.includes("natural") || name.includes("online") || name.includes("premium")) score += 15;
      if (name.includes("microsoft") || name.includes("google")) score += 10;
      if (["pablo", "jorge", "carlos", "diego", "miguel"].some(hint => name.includes(hint))) score -= 20;
      return { voice, score };
    })
    .sort((left, right) => right.score - left.score)[0]?.voice || null;
}

export function OrdersAdminPage({ session, canViewPipeline, canViewPedidos, canViewCatalogo, canViewProduccion, canViewDomicilios, canViewBarrios, canViewInventario, canViewContabilidad, canViewClientesPanel, canViewUsuariosPanel, canViewTenantMonitoring, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario, onGoContabilidad, onGoClientes, onGoUsuarios, onGoTenantMonitoring }) {
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
  const [quickSaleInventoryItems, setQuickSaleInventoryItems] = useState([]);
  const [quickSaleInventoryLoading, setQuickSaleInventoryLoading] = useState(false);
  const [newOrderBarrioQuery, setNewOrderBarrioQuery] = useState("");
  const [newOrderBarrios, setNewOrderBarrios] = useState([]);
  const [newOrderBarrioDropdownOpen, setNewOrderBarrioDropdownOpen] = useState(false);
  const [newOrderSaving, setNewOrderSaving] = useState(false);
  const [newOrderError, setNewOrderError] = useState("");
  const [configuredPedidoMenuFields, setConfiguredPedidoMenuFields] = useState([]);
  const [paymentCatalog, setPaymentCatalog] = useState(null);
  const [identificationTypeOptions, setIdentificationTypeOptions] = useState([
    { codigo: "CC", nombre: "Cedula" },
    { codigo: "NIT", nombre: "NIT" },
  ]);
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(() => (
    globalThis.localStorage?.getItem(VOICE_ALERTS_STORAGE_KEY) === "1"
  ));

  const api = useMemo(() => createApiClient(tenantConfig), []);
  const loadOrdersRef = useRef(null);
  const detailRequestSeqRef = useRef(0);
  const voiceAlertsPrimedRef = useRef(false);
  const voiceAlertsPollingRef = useRef(false);
  const voiceLastAuditIdRef = useRef(0);
  const voiceLastPedidoIdRef = useRef(0);
  const debouncedQuery = useDebouncedValue(filters.q, 300);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const voiceAlertsStorageScopeKey = useMemo(
    () => `${VOICE_ALERTS_LAST_AUDIT_STORAGE_PREFIX}:${empresaId || "0"}:${sucursalId || "all"}`,
    [empresaId, sucursalId]
  );
  const voiceAlertsPedidoStorageScopeKey = useMemo(
    () => `${VOICE_ALERTS_LAST_PEDIDO_STORAGE_PREFIX}:${empresaId || "0"}:${sucursalId || "all"}`,
    [empresaId, sucursalId]
  );
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
    ordersKpis,
    loadOrders,
    clearOrdersCache,
    resultPage, resultPageSize, hasLoaded, updatedAt,
  } = useOrdersAdminData({
    api,
    empresaId,
    sucursalId,
    filters,
    debouncedQuery,
  });
  const refreshAfterMutation = useCallback(() => {
    clearOrdersCache();
    return loadOrdersRef.current?.(true);
  }, [clearOrdersCache]);

  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );
  const speakVoiceAlert = useCallback((message) => {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof globalThis.SpeechSynthesisUtterance !== "function") return false;
    const utterance = new globalThis.SpeechSynthesisUtterance(message);
    const voice = selectPreferredSpanishVoice(synth);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "es-CO";
    } else {
      utterance.lang = "es-CO";
    }
    utterance.rate = 0.92;
    utterance.pitch = 1.08;
    synth.cancel();
    synth.speak(utterance);
    return true;
  }, []);
  const requestDesktopNotificationPermission = useCallback(async () => {
    if (!("Notification" in globalThis)) return "unsupported";
    if (globalThis.Notification.permission === "granted") return "granted";
    if (globalThis.Notification.permission === "denied") return "denied";
    try {
      return await globalThis.Notification.requestPermission();
    } catch {
      return "default";
    }
  }, []);
  const showDesktopOrderNotification = useCallback((title, message) => {
    if (!("Notification" in globalThis) || globalThis.Notification.permission !== "granted") return false;
    try {
      const notification = new globalThis.Notification(title, {
        body: message,
        icon: "/logo.png",
        tag: "petalops-new-order-created",
        renotify: true,
      });
      notification.onclick = () => {
        globalThis.focus?.();
        notification.close();
      };
      return true;
    } catch {
      return false;
    }
  }, []);
  const orderVoiceLabel = useCallback((order) => {
    const code = String(order?.codigoPedido || "").trim();
    if (code) return code;
    const number = Number(order?.numeroPedido || 0);
    if (number > 0) return `numero ${number}`;
    return `ID ${order?.pedidoID || ""}`.trim();
  }, []);
  const pollVoiceOrderAlerts = useCallback(async ({ speak = true } = {}) => {
    if (!voiceAlertsEnabled || !empresaId || voiceAlertsPollingRef.current) return;
    voiceAlertsPollingRef.current = true;
    try {
      const response = await api.listarAlertasPedidosNuevosCreados({
        empresaId,
        sucursalId,
        sinceAuditId: voiceLastAuditIdRef.current,
        sincePedidoId: voiceLastPedidoIdRef.current,
        limit: 10,
      });
      const rows = Array.isArray(response?.items) ? response.items : [];
      const responseLatestAuditId = Number(response?.latestAuditID || 0);
      const responseLatestPedidoId = Number(response?.latestPedidoID || 0);
      const latestAuditId = Math.max(
        responseLatestAuditId,
        ...rows.map(item => Number(item?.auditID || 0))
      );
      const latestPedidoId = Math.max(
        responseLatestPedidoId,
        ...rows.map(item => Number(item?.pedidoID || item?.cursorID || 0))
      );

      if (!voiceAlertsPrimedRef.current && voiceLastPedidoIdRef.current <= 0) {
        voiceAlertsPrimedRef.current = true;
        if (latestAuditId > 0) {
          voiceLastAuditIdRef.current = latestAuditId;
          globalThis.localStorage?.setItem(voiceAlertsStorageScopeKey, String(latestAuditId));
        }
        if (latestPedidoId > 0) {
          voiceLastPedidoIdRef.current = latestPedidoId;
          globalThis.localStorage?.setItem(voiceAlertsPedidoStorageScopeKey, String(latestPedidoId));
        }
        return;
      }

      voiceAlertsPrimedRef.current = true;
      if (latestAuditId > voiceLastAuditIdRef.current) {
        voiceLastAuditIdRef.current = latestAuditId;
        globalThis.localStorage?.setItem(voiceAlertsStorageScopeKey, String(latestAuditId));
      }
      if (latestPedidoId > voiceLastPedidoIdRef.current) {
        voiceLastPedidoIdRef.current = latestPedidoId;
        globalThis.localStorage?.setItem(voiceAlertsPedidoStorageScopeKey, String(latestPedidoId));
      }

      if (!rows.length || !speak) return;

      const lastOrder = rows[rows.length - 1];
      const title = rows.length === 1 ? "Nuevo pedido recibido" : "Nuevos pedidos recibidos";
      const message = rows.length === 1
        ? `Pedido ${orderVoiceLabel(lastOrder)} llego en estado creado.`
        : `${rows.length} pedidos nuevos llegaron en estado creado.`;
      setOrderNotification({ title, message });
      showDesktopOrderNotification(title, message);
      speakVoiceAlert("Nuevo Pedido");
      loadOrdersRef.current?.(true);
    } catch (nextError) {
      console.error("Error consultando alertas de pedidos nuevos:", nextError);
    } finally {
      voiceAlertsPollingRef.current = false;
    }
  }, [api, empresaId, sucursalId, orderVoiceLabel, showDesktopOrderNotification, speakVoiceAlert, voiceAlertsEnabled, voiceAlertsPedidoStorageScopeKey, voiceAlertsStorageScopeKey]);
  const toggleVoiceAlerts = useCallback(async () => {
    if (!empresaId) return;
    const nextEnabled = !voiceAlertsEnabled;
    setVoiceAlertsEnabled(nextEnabled);
    globalThis.localStorage?.setItem(VOICE_ALERTS_STORAGE_KEY, nextEnabled ? "1" : "0");

    try {
      if (nextEnabled) {
        await requestDesktopNotificationPermission();
        speakVoiceAlert("Alertas de voz activadas.");
      } else {
        globalThis.speechSynthesis?.cancel?.();
      }

      const data = await api.actualizarConfiguracionVozPedidos({
        empresaId,
        vozPedidosActiva: nextEnabled,
      });
      const savedValue = Boolean(data?.vozPedidosActiva);
      setVoiceAlertsEnabled(savedValue);
      globalThis.localStorage?.setItem(VOICE_ALERTS_STORAGE_KEY, savedValue ? "1" : "0");
      setOrderNotification(nextEnabled ? {
        title: "Alertas de voz activadas",
        message: "La preferencia quedo guardada para esta empresa.",
      } : {
        title: "Alertas de voz desactivadas",
        message: "La preferencia quedo guardada para esta empresa.",
      });
    } catch (nextError) {
      console.error("Error actualizando alertas de voz:", nextError);
      setVoiceAlertsEnabled(voiceAlertsEnabled);
      globalThis.localStorage?.setItem(VOICE_ALERTS_STORAGE_KEY, voiceAlertsEnabled ? "1" : "0");
      setOrderNotification({
        tone: "danger",
        title: "No se pudo guardar voz pedidos",
        message: nextError?.detail || nextError?.message || "Intenta nuevamente en unos segundos.",
      });
    }
  }, [api, empresaId, requestDesktopNotificationPermission, speakVoiceAlert, voiceAlertsEnabled]);
  const detailPedidoMenuFields = useMemo(
    () => (Array.isArray(detalle?.camposEmpresa?.pedidoDetalle) ? detalle.camposEmpresa.pedidoDetalle : []),
    [detalle]
  );
  const pedidoMenuFields = useMemo(
    () => (configuredPedidoMenuFields.length ? configuredPedidoMenuFields : detailPedidoMenuFields),
    [configuredPedidoMenuFields, detailPedidoMenuFields]
  );
  const paymentFieldConfig = useMemo(
    () => pedidoMenuFields.find(field => field?.codigo === "pedido_metodos_pago" && field?.activo),
    [pedidoMenuFields]
  );
  const paymentFieldOptions = useMemo(
    () => paymentCatalog && paymentCatalog.empresaId === empresaId ? paymentCatalog.options : [],
    [paymentCatalog, empresaId]
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
    loadOrders: refreshAfterMutation,
  });
  const messageCardOpen = messageCard.open;
  const openMessageCard = messageCard.openMessageCard;
  const closeMessageCard = messageCard.closeMessageCard;
  const saveMessageCard = messageCard.saveMessageCard;

  useEffect(() => {
    let disposed = false;
    loadOrders(false).then(result => {
      if (!disposed && result && result.page !== Number(filters.page || 1)) {
        setFilters(current => ({ ...current, page: result.page }));
      }
    });
    return () => { disposed = true; };
  }, [loadOrders]);

  useEffect(() => {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof synth.getVoices !== "function") return undefined;
    synth.getVoices();
    const loadVoices = () => synth.getVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => synth.removeEventListener?.("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    loadOrdersRef.current = loadOrders;
  }, [loadOrders]);


  useEffect(() => {
    voiceAlertsPrimedRef.current = false;
    voiceAlertsPollingRef.current = false;
    voiceLastAuditIdRef.current = Number(globalThis.localStorage?.getItem(voiceAlertsStorageScopeKey) || 0);
    voiceLastPedidoIdRef.current = Number(globalThis.localStorage?.getItem(voiceAlertsPedidoStorageScopeKey) || 0);
  }, [voiceAlertsPedidoStorageScopeKey, voiceAlertsStorageScopeKey]);

  useEffect(() => {
    if (!empresaId) return undefined;
    let disposed = false;
    api.obtenerConfiguracionAsignacion({ empresaId })
      .then(data => {
        if (disposed) return;
        const enabled = Boolean(data?.vozPedidosActiva);
        setVoiceAlertsEnabled(enabled);
        globalThis.localStorage?.setItem(VOICE_ALERTS_STORAGE_KEY, enabled ? "1" : "0");
      })
      .catch(nextError => {
        console.error("Error cargando configuracion de voz pedidos:", nextError);
      });
    return () => {
      disposed = true;
    };
  }, [api, empresaId]);

  useEffect(() => {
    if (!voiceAlertsEnabled || !empresaId) return undefined;

    pollVoiceOrderAlerts({ speak: voiceLastPedidoIdRef.current > 0 });
    const intervalId = globalThis.setInterval(() => {
      pollVoiceOrderAlerts({ speak: true });
    }, VOICE_ALERTS_INTERVAL_MS);

    return () => globalThis.clearInterval(intervalId);
  }, [empresaId, pollVoiceOrderAlerts, voiceAlertsEnabled]);



  useEffect(() => {
    let isCurrent = true;

    async function loadPedidoMenuFields() {
      setPaymentCatalog(null);
      if (!empresaId) {
        setConfiguredPedidoMenuFields([]);
        return;
      }

      try {
        const [menuResponse, paymentResponse, channelResponse] = await Promise.all([
          api.listarMenuPedidoEmpresa({ empresaId }),
          api.listarMetodosPagoEmpresa({ empresaId }),
          api.listarCanalesVentaEmpresa({ empresaId }),
        ]);
        if (!isCurrent) return;

        const paymentOptions = extractActiveCatalogNames(paymentResponse);
        setPaymentCatalog({ empresaId, options: paymentOptions });
        const channelOptions = extractActiveCatalogNames(channelResponse);
        const menuItems = Array.isArray(menuResponse?.items) ? menuResponse.items : [];
        setConfiguredPedidoMenuFields(menuItems.map(field => {
          if (field?.codigo === "pedido_metodos_pago") {
            return { ...field, opciones: paymentOptions };
          }
          if (field?.codigo === "pedido_canal_venta") {
            return { ...field, opciones: channelOptions };
          }
          return field;
        }));
      } catch (error) {
        console.error("Error cargando configuracion de pago del pedido:", error);
        if (isCurrent) setConfiguredPedidoMenuFields([]);
      }
    }

    loadPedidoMenuFields();
    return () => {
      isCurrent = false;
    };
  }, [api, empresaId]);

  useEffect(() => {
    if (!empresaId) return undefined;
    let disposed = false;

    api.listarTiposIdentificacionPedidos({ empresaId })
      .then(payload => {
        if (disposed) return;
        setIdentificationTypeOptions(normalizeIdentificationTypeOptions(payload));
      })
      .catch(error => {
        console.error("Error cargando tipos de identificacion:", error);
        if (!disposed) {
          setIdentificationTypeOptions([
            { codigo: "CC", nombre: "Cedula" },
            { codigo: "NIT", nombre: "NIT" },
          ]);
        }
      });

    return () => {
      disposed = true;
    };
  }, [api, empresaId]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      if (globalThis.document?.hidden) return;
      loadOrdersRef.current?.(true);
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
      if (current[name] === value && Number(current.page || 1) === 1 && !(name === "estado" && value && value !== "APROBADO" && current.sinImprimir) && !(name === "filtrarPorEntrega" && current.soloEntregasHoy)) return current;
      return {
        ...current,
        [name]: value,
        ...(name === "filtrarPorEntrega" && current.soloEntregasHoy ? { fechaDesde: todayIsoDate(), fechaHasta: todayIsoDate(), datePeriod: "hoy" } : {}),
        ...(name === "estado" && value && value !== "APROBADO" ? { sinImprimir: false } : {}),
        ...(name === "sinImprimir" && value ? { estado: "APROBADO" } : {}),
        ...(["fechaDesde", "fechaHasta", "filtrarPorEntrega"].includes(name) ? { soloEntregasHoy: false } : {}),
        page: 1
      };
    });
  };

  const applyDateRange = (fechaDesde, fechaHasta) => {
    if (!fechaDesde || !fechaHasta || fechaHasta < fechaDesde) return;
    setFilters(current => {
      if (current.fechaDesde === fechaDesde && current.fechaHasta === fechaHasta && !current.soloEntregasHoy && current.datePeriod === "custom" && Number(current.page || 1) === 1) return current;
      return { ...current, fechaDesde, fechaHasta, datePeriod: "custom", soloEntregasHoy: false, page: 1 };
    });
  };

  const clearDateRange = () => setFilters(current => {
    if (!current.fechaDesde && !current.fechaHasta && !current.soloEntregasHoy && Number(current.page || 1) === 1) return current;
    return { ...current, fechaDesde: "", fechaHasta: "", datePeriod: "todos", soloEntregasHoy: false, page: 1 };
  });

  const openDetail = async (pedidoId, detailPatch = null) => {
    const requestedPedidoId = Number(pedidoId || 0);
    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;
    setOpenOrderActionsId(null);
    setDrawerOpen(true);
    setSelectedPedidoId(requestedPedidoId || pedidoId);
    setDetalle(null);

    try {
      const rawDetail = normalizePedidosViewStatus(applyDeliveryGiftOverrideToDetail(pedidoId, await api.obtenerDetallePedido(pedidoId)));
      if (requestSeq !== detailRequestSeqRef.current) return null;
      const responsePedidoId = Number(rawDetail?.pedidoID || rawDetail?.pedidoId || rawDetail?.idPedido || rawDetail?.id_pedido || 0);
      if (requestedPedidoId && responsePedidoId && responsePedidoId !== requestedPedidoId) {
        throw new Error("El detalle recibido no corresponde al pedido seleccionado. Vuelve a abrir el pedido.");
      }
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
      if (requestSeq !== detailRequestSeqRef.current) return null;
      console.error("Error obteniendo detalle:", nextError);
      setDetalle({ error: true });
      return null;
    }
  };

  const { approveOrder, rejectOrder, finalizeOrder, downloadInvoice,
    approvingPedidoIds, finalizingPedidoIds, finalizedPickupPedidoIds } = useOrderActions({
    api, items, empresaId, selectedPedidoId, setItems, setDetalle, setOrderNotification,
    clearOrdersCache, refreshAfterMutation, reloadDrawer: (...args) => reloadDrawer(...args),
  });
  const refresh = () => {
    clearOrdersCache();
    loadOrders(false);
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

  const normalizeQuickSaleInventoryItem = item => {
    const inventarioID = Number(item?.inventarioID ?? item?.inventarioId ?? item?.idInventario ?? item?.id_inventario ?? item?.id ?? 0);
    if (!inventarioID) return null;
    return {
      inventarioID,
      codigo: item?.codigo || item?.codigoBarra || item?.codigo_barra || "",
      nombre: item?.nombre || item?.nombreInsumo || item?.nombre_insumo || `Item ${inventarioID}`,
      categoria: item?.categoria || "",
      stockActual: Number(item?.stockActual ?? item?.stock_actual ?? 0),
      unidadMedida: item?.unidadMedida || item?.unidad_medida || "Unidad",
      precioVenta: Number(item?.precioVenta ?? item?.precio_venta ?? 0),
    };
  };

  const loadQuickSaleInventoryItems = async () => {
    if (!empresaId) return;
    setQuickSaleInventoryLoading(true);
    try {
      const payload = await api.listarInventario({
        empresaId,
        sucursalId,
        categoria: "Flores",
        soloVendibles: true,
      });
      const rows = [
        payload?.items,
        payload?.data?.items,
        payload?.rows,
        payload,
      ].find(Array.isArray) || [];
      setQuickSaleInventoryItems(rows.map(normalizeQuickSaleInventoryItem).filter(Boolean));
    } catch (nextError) {
      console.error("Error cargando flores vendibles:", nextError);
      setQuickSaleInventoryItems([]);
    } finally {
      setQuickSaleInventoryLoading(false);
    }
  };
const openNewOrderModal = () => {
    const defaultTipoIdent = identificationTypeOptions[0]?.codigo || DEFAULT_NEW_ORDER_FORM.clienteTipoIdent || "CC";
    setNewOrderForm({
      ...DEFAULT_NEW_ORDER_FORM,
      clienteTipoIdent: defaultTipoIdent,
      fechaEntrega: todayIsoDate(),
    });
    setNewOrderError("");
    setNewOrderProductQuery("");
    setNewOrderBarrioQuery("");
    setNewOrderProductDropdownOpen(false);
    setNewOrderBarrioDropdownOpen(false);
    setNewOrderOpen(true);
    if (quickSaleInventoryItems.length === 0) {
      void loadQuickSaleInventoryItems();
    }
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
    setItems(current => current.map(item => patchOrderItemFromDetail(item, pedidoId, detail)));
  };

  const updateNewOrderForm = (name, value) => {
    if (name === "ventaRapida" && value && quickSaleInventoryItems.length === 0 && !quickSaleInventoryLoading) {
      void loadQuickSaleInventoryItems();
    }
    setNewOrderForm(current => ({ ...current, [name]: value }));
  };

  const hydrateNewOrderClientByPhone = useNewOrderClientLookup({
    api, empresaId, open: newOrderOpen, form: newOrderForm, setForm: setNewOrderForm,
  });

  const buildNewOrderManualPayload = (form = newOrderForm) => buildNewOrderManualPayloadData({
    form,
    empresaId,
    sucursalId,
    productoID: Number(form.productoID || 0),
  });

  const onSaveNewOrder = useNewOrderCreation({
    api, empresaId, sucursalId, newOrderForm, paymentFieldConfig, salesChannelFieldConfig, hydrateNewOrderClientByPhone, buildNewOrderManualPayload, setNewOrderOpen, setOrderNotification, loadQuickSaleInventoryItems, refreshAfterMutation, openDetail, setNewOrderSaving, setNewOrderError
  });

  const onToggleDetailEdit = () => {
    if (detailEditSaving) return;
    setDetailEditError("");
    setIsEditingDetail(current => {
      const next = !current;
      if (!next) setIsDuplicatingDetail(false);
      if (next) {
        setDetailEditSubview("edit");
        void loadBarrioOptions(detailEditBarrioNombre);
      }
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
    const acceptedPreTaxTotal = customArrangementPreTaxTotal({
      isCustomArrangement: detailEditIsCustomArrangement,
      clienteTipoIdent: detailEditClienteTipoIdent,
      precio: detailEditPrecio,
      cantidad: detailEditCantidad,
    });
    if (!isValidPaymentBreakdownTotal({ breakdownTotal: roundedBreakdownTotal, orderTotal: roundedOrderTotal, acceptedPreTaxTotal })) {
      const expectedTotals = acceptedPreTaxTotal
        ? `$${formatearCOP(roundedOrderTotal)} o la base antes de IVA ($${formatearCOP(acceptedPreTaxTotal)})`
        : `$${formatearCOP(roundedOrderTotal)}`;
      throw new Error(`La suma de los montos por metodo de pago debe ser igual al total del pedido (${expectedTotals}).`);
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

  const { onSaveDetailEdit, onAddDetailProduct, onDeleteDetailProduct } = useOrderEditActions({
    selectedPedidoId,
    detailEditSaving,
    setDetailEditError,
    setDetailEditSaving,
    detalle,
    isDuplicatingDetail,
    detailEditIsCustomArrangement,
    detailEditPrecio,
    validatePaymentMethods,
    validateSalesChannel,
    api,
    buildDuplicateCheckoutPayload,
    getDetailEditPayloadState,
    canEditClientIdentity,
    refreshAfterMutation,
    openDetail,
    setIsDuplicatingDetail,
    buildDetailEditApiPayload,
    reloadDrawer: (...args) => reloadDrawer(...args),
    setIsEditingDetail,
    detailAddSaving,
    detailEditDetalleID,
    detailAddProductoID,
    detailAddIsCustomArrangement,
    detailAddPrecio,
    setDetailAddSaving,
    detailAddCantidad,
    setDetailEditDetalleID,
    setDetailEditSubview,
    setDetailAddDropdownOpen,
    setDetailAddFilterText,
    setDetailAddProductoID,
    setDetailAddProductoCodigo,
    setDetailAddNombreArreglo,
    setDetailAddCantidad,
    setDetailAddPrecio,
    detailEditDeletingDetailId,
    setDetailEditDeletingDetailId,
    setDetalle,
    applySelectedDetailProduct
  });

  const reloadDrawer = async (detailPatch = null) => {
    if (!selectedPedidoId) return;
    clearOrdersCache();
    const detail = await openDetail(selectedPedidoId, detailPatch);
    await refreshAfterMutation();
    patchOrderListItemFromDetail(selectedPedidoId, detail);
  };

  const toggleTodayDeliveries = () => {
    const nextSoloEntregasHoy = !filters.soloEntregasHoy;
    const today = todayIsoDate();
    setFilters(current => ({ ...toggleTodayDeliveriesFilters(current, today), datePeriod: "hoy" }));
    setOrderNotification({
      tone: nextSoloEntregasHoy ? "success" : "info",
      title: nextSoloEntregasHoy ? "Entregas hoy" : "Todos los pedidos",
      message: nextSoloEntregasHoy
        ? "Mostrando pedidos cuya entrega esta programada para hoy."
        : "Mostrando los pedidos registrados hoy.",
    });
  };

  const toggleStoreDeliveries = () => {
    const nextSoloTienda = !filters.soloTienda;
    setFilters(current => ({
      ...current,
      soloTienda: nextSoloTienda,
      soloEntregasHoy: false,
      page: 1,
    }));
    setOrderNotification({
      tone: nextSoloTienda ? "success" : "info",
      title: nextSoloTienda ? "Entregas en tienda" : "Todos los pedidos",
      message: nextSoloTienda
        ? "Mostrando pedidos marcados como recoger en tienda."
        : "Mostrando todos los pedidos con los filtros actuales.",
    });
  };

  const applyDatePreset = () => {
    const today = todayIsoDate();
    setFilters(current => {
      if (current.fechaDesde === today && current.fechaHasta === today && !current.soloEntregasHoy && current.datePeriod !== "custom" && Number(current.page || 1) === 1) return current;
      return { ...current, fechaDesde: today, fechaHasta: today, datePeriod: "hoy", soloEntregasHoy: false, page: 1 };
    });
  };

  const clearOrderFilters = () => {
    setFilters(current => ({
      ...current,
      q: "",
      estado: "",
      sinImprimir: false,
      soloTienda: false,
      soloEntregasHoy: false,
      metodoPago: "",
      fechaDesde: "",
      fechaHasta: "",
      datePeriod: "todos",
      filtrarPorEntrega: false,
      page: 1,
    }));
  };

  const focusOrderMetric = metric => {
    const today = todayIsoDate();
    setFilters(current => {
      const base = {
        ...current,
        q: "",
        estado: "",
        sinImprimir: false,
        soloEntregasHoy: false,

        page: 1,
      };

      if (metric === "hoy") {
        return { ...base, soloEntregasHoy: current.soloEntregasHoy };
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

  const page = hasLoaded ? resultPage : Number(filters.page || 1);
  const pageSize = hasLoaded ? resultPageSize : Number(filters.pageSize || 10);
  const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));
  const visibleFrom = items.length > 0 ? ((page - 1) * pageSize) + 1 : 0;
  const visibleTo = items.length > 0 ? Math.min(Number(total || 0), ((page - 1) * pageSize) + items.length) : 0;
  const pagerItems = buildPaginationItems(page, pages);
  const activeOrderMetric = useMemo(() => {
    const today = todayIsoDate();
    if (String(filters.q || "").trim()) return "";
    if (filters.sinImprimir) return "facturas";
    if (filters.estado === "APROBADO") return "aprobados";
    if (filters.estado === "CREADO") return "pendientes";
    if (filters.estado === "CANCELADO") return "cancelados";
    if (!filters.filtrarPorEntrega && !filters.soloEntregasHoy && !filters.estado && filters.fechaDesde === today && filters.fechaHasta === today) return "hoy";
    return "";
  }, [filters.q, filters.filtrarPorEntrega, filters.soloEntregasHoy, filters.estado, filters.fechaDesde, filters.fechaHasta, filters.sinImprimir]);
  const ordersMetrics = ordersKpis;
  const headerSalesSummary = Number(ordersKpis.ventaHoy || 0);
  const orderMetricCards = useMemo(() => {
    const baseCards = [
      { key: "hoy", label: "Creados hoy", shortLabel: "Creados hoy", value: Number(ordersMetrics.pedidosHoy || 0), tone: "is-primary", Icon: ORDER_METRIC_ICONS.hoy, helperText: "Operacion diaria" },
      { key: "aprobados", label: "Aprobados", shortLabel: "Aprobados", value: Number(ordersMetrics.aprobados || 0), tone: "is-green", Icon: ORDER_METRIC_ICONS.aprobados, helperText: "Ultimos 7 dias" },
      { key: "pendientes", label: "Creados", shortLabel: "Creados", value: Number(ordersMetrics.pendientes || 0), tone: "is-blue", Icon: ORDER_METRIC_ICONS.pendientes, helperText: "Requieren atencion" },
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
      return {
        ...card,
        trendRatio: ratio,
        className: `${card.tone} ${weightClass}${attentionClass ? ` ${attentionClass}` : ""}`,
      };
    });
  }, [ordersMetrics]);
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
            clientes: canViewClientesPanel,
            seguimiento: canViewTenantMonitoring,
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
            clientes: onGoClientes,
            seguimiento: onGoTenantMonitoring,
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
            voiceAlertsEnabled={voiceAlertsEnabled}
            onFilterChange={applyFilterValue}
            onToggleTodayDeliveries={toggleTodayDeliveries}
            onToggleStoreDeliveries={toggleStoreDeliveries}
            onToggleVoiceAlerts={toggleVoiceAlerts}
            onRefresh={refresh}
            onNewOrder={openNewOrderModal}
            onFocusMetric={focusOrderMetric}
          />

          <OrdersFilters
            total={total}
            loading={loading}
            paymentOptions={paymentFieldOptions}
            filters={filters}
            onApplyDatePreset={applyDatePreset}
            onApplyDateRange={applyDateRange}
            onFilterChange={applyFilterValue}
            onClearFilters={clearOrderFilters}
            onClearDateRange={clearDateRange}
          />

          <OrdersListSection
            error={error}
            onRetry={refresh}
            hasLoaded={hasLoaded}
            updatedAt={updatedAt}
            loading={loading}
            items={items}
            empresaId={empresaId}
            session={session}
            approvingPedidoIds={approvingPedidoIds}
            finalizingPedidoIds={finalizingPedidoIds}
            finalizedPickupPedidoIds={finalizedPickupPedidoIds}
            selectedPedidoId={selectedPedidoId}
            drawerOpen={drawerOpen}
            openOrderActionsId={openOrderActionsId}
            setOpenOrderActionsId={setOpenOrderActionsId}
            openDetail={openDetail}
            approveOrder={approveOrder}
            rejectOrder={rejectOrder}
            finalizeOrder={finalizeOrder}
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
          quickSaleInventoryItems={quickSaleInventoryItems}
          quickSaleInventoryLoading={quickSaleInventoryLoading}
          saving={newOrderSaving}
          error={newOrderError}
          paymentFieldConfig={paymentFieldConfig}
          paymentFieldOptions={paymentFieldOptions}
          salesChannelFieldConfig={salesChannelFieldConfig}
          identificationTypeOptions={identificationTypeOptions}
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
