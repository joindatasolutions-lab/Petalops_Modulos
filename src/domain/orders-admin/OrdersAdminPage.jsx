import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { formatearCOP, normalizeStatus, splitDateTimeParts, toIsoDateEnd, toIsoDateStart } from "../../shared/utils.js";
import { useDebouncedValue } from "../../shared/useDebouncedValue.js";

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  CREADO: "is-pendiente",
  APROBADO: "is-aprobado",
  CANCELADO: "is-rechazado",
};

const initialFilters = {
  q: "",
  estado: "",
  fechaDesde: "",
  fechaHasta: "",
  page: 1,
  pageSize: 20
};

export function OrdersAdminPage({ session, canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewInventario, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoInventario, onGoClientes, onGoUsuarios }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
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
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [isDuplicatingDetail, setIsDuplicatingDetail] = useState(false);
  const [detailEditFilterText, setDetailEditFilterText] = useState("");
  const [detailEditCatalog, setDetailEditCatalog] = useState([]);
  const [detailEditCatalogLoading, setDetailEditCatalogLoading] = useState(false);
  const [detailEditProductoID, setDetailEditProductoID] = useState("");
  const [detailEditNombreArreglo, setDetailEditNombreArreglo] = useState("");
  const [detailEditProductoCodigo, setDetailEditProductoCodigo] = useState("");
  const [detailEditProductoObservaciones, setDetailEditProductoObservaciones] = useState("");
  const [detailEditPrecio, setDetailEditPrecio] = useState(null);
  const [detailEditFechaEntrega, setDetailEditFechaEntrega] = useState("");
  const [detailEditHoraEntrega, setDetailEditHoraEntrega] = useState("");
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
  const [detailEditCanalFlora, setDetailEditCanalFlora] = useState("");
  const [detailEditSaving, setDetailEditSaving] = useState(false);
  const [detailEditError, setDetailEditError] = useState("");
  const [detailEditDropdownOpen, setDetailEditDropdownOpen] = useState(false);

  const api = useMemo(() => createApiClient(tenantConfig), []);
  const debouncedQuery = useDebouncedValue(filters.q, 300);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const pedidoMenuFields = useMemo(
    () => (Array.isArray(detalle?.camposEmpresa?.pedidoDetalle) ? detalle.camposEmpresa.pedidoDetalle : []),
    [detalle]
  );
  const paymentFieldConfig = useMemo(
    () => pedidoMenuFields.find(field => field?.codigo === "pedido_metodos_pago" && field?.activo),
    [pedidoMenuFields]
  );
  const salesChannelFieldConfig = useMemo(
    () => pedidoMenuFields.find(field => field?.codigo === "pedido_canal_venta" && field?.activo),
    [pedidoMenuFields]
  );

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
        fechaDesde: toIsoDateStart(filters.fechaDesde),
        fechaHasta: toIsoDateEnd(filters.fechaHasta),
        page: filters.page,
        pageSize: filters.pageSize
      });

      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setError("");
    } catch (nextError) {
      console.error("Error cargando pedidos:", nextError);
      setItems([]);
      setTotal(0);
      setError("No fue posible cargar pedidos.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, debouncedQuery, filters.estado, filters.fechaDesde, filters.fechaHasta, filters.page, filters.pageSize, empresaId, sucursalId]);

  useEffect(() => {
    loadOrders(false);
  }, [loadOrders]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) {
        setSidebarMobileOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
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
      setDetailEditProductoID("");
      setDetailEditNombreArreglo("");
      setDetailEditProductoCodigo("");
      setDetailEditProductoObservaciones("");
      setDetailEditPrecio(null);
      setDetailEditFechaEntrega("");
      setDetailEditHoraEntrega("");
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
      setDetailEditCanalFlora("");
      setDetailEditError("");
      setDetailEditDropdownOpen(false);
      setIsDuplicatingDetail(false);
      return;
    }

    const firstProduct = Array.isArray(detalle.productos) && detalle.productos.length > 0
      ? detalle.productos[0]
      : null;
    const productoId = getProductoId(firstProduct);
    const productoCodigo = firstProduct
      ? String(firstProduct.codigoProducto || firstProduct.codigo || "").trim()
      : "";
    const productoNombre = firstProduct
      ? String(firstProduct.nombreProducto || firstProduct.nombre || "").trim()
      : "";
    const productoObservaciones = firstProduct
      ? String(firstProduct.observaciones || firstProduct.descripcion || "").trim()
      : "";
    const productoPrecio = firstProduct ? Number(firstProduct.precioUnitario || firstProduct.precio || firstProduct.subtotal || 0) : null;

    setDetailEditProductoID(productoId != null ? String(productoId) : "");
    setDetailEditProductoCodigo(productoCodigo);
    setDetailEditNombreArreglo(productoNombre);
    setDetailEditProductoObservaciones(productoObservaciones);
    setDetailEditPrecio(productoPrecio);
    setDetailEditFechaEntrega(toDateInput(detalle.destinatario?.fechaEntrega));
    setDetailEditHoraEntrega(normalizeTime(detalle.destinatario?.horaEntrega));
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
    setDetailEditMetodosPago(Array.isArray(detalle.financiero?.metodosPago) ? detalle.financiero.metodosPago.map(item => String(item)) : []);
    setDetailEditCanalFlora(String(detalle.financiero?.canalFlora || ""));

    const initialCatalog = (Array.isArray(detalle.productos) ? detalle.productos : [])
      .map(item => normalizeCatalogItem(item))
      .filter(Boolean);
    setDetailEditCatalog(dedupeCatalogItems(initialCatalog));
    setDetailEditError("");
  }, [detalle]);

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

  const optimisticStatusPatch = (pedidoId, nextStatus) => {
    setItems(current => current.map(item => Number(item.pedidoID) === Number(pedidoId)
      ? { ...item, estado: nextStatus }
      : item));

    setDetalle(current => {
      if (!current || Number(selectedPedidoId) !== Number(pedidoId)) return current;
      return { ...current, estado: nextStatus };
    });
  };

  const approveOrder = async pedidoId => {
    const item = items.find(current => Number(current.pedidoID) === Number(pedidoId));
    if (item?.puedeAprobar === false) {
      globalThis.alert(item.motivoBloqueoAprobacion || "Completa la información requerida antes de aprobar.");
      return;
    }

    const ok = globalThis.confirm("¿Aprobar este pedido?");
    if (!ok) return;

    try {
      const response = await api.aprobarPedido(pedidoId);
      optimisticStatusPatch(pedidoId, response.estado || "APROBADO");
    } catch (nextError) {
      console.error("Error aprobando pedido:", nextError);
      globalThis.alert("No fue posible aprobar el pedido.");
    }
  };

  const rejectOrder = async pedidoId => {
    const motivo = String(globalThis.prompt("Motivo de rechazo", "") || "").trim();
    if (!motivo) {
      globalThis.alert("Debes ingresar un motivo de rechazo.");
      return;
    }

    try {
      const response = await api.rechazarPedido(pedidoId, motivo);
      optimisticStatusPatch(pedidoId, response.estado || "RECHAZADO");
    } catch (nextError) {
      console.error("Error rechazando pedido:", nextError);
      globalThis.alert("No fue posible rechazar el pedido.");
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

  const filteredBarrioOptions = useMemo(() => {
    const q = String(detailEditBarrioQuery || "").trim().toLowerCase();
    if (!q) return detailEditBarrios;
    return detailEditBarrios.filter(item => String(item?.nombre || "").toLowerCase().includes(q));
  }, [detailEditBarrioQuery, detailEditBarrios]);

  const onSearchCatalog = async () => {
    const q = String(detailEditFilterText || "").trim();
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
      return next;
    });
  };

  const onStartDuplicateDetail = () => {
    if (!detalle || detalle.error || detailEditSaving) return;
    setDetailEditError("");
    setIsDuplicatingDetail(true);
    setIsEditingDetail(true);
  };

  const normalizeDuplicateMetodosPago = () => (
    Array.isArray(detailEditMetodosPago)
      ? detailEditMetodosPago.map(item => String(item || "").trim()).filter(Boolean)
      : []
  );

  const normalizeDuplicateCanalFlora = () => {
    const value = String(detailEditCanalFlora || "").trim();
    return value || null;
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
        cantidad: Number(item.cantidad || 1),
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
      if (isDuplicatingDetail) {
        const created = await api.crearPedidoCheckout(buildDuplicateCheckoutPayload());
        const duplicateMetodosPago = paymentFieldConfig ? normalizeDuplicateMetodosPago() : null;
        const duplicateCanalFlora = salesChannelFieldConfig ? normalizeDuplicateCanalFlora() : null;
        await api.actualizarDetallePedidoPipeline({
          pedidoId: created.pedidoID,
          productoID: detailEditProductoID ? Number(detailEditProductoID) : null,
          productoObservaciones: detailEditProductoObservaciones,
          fechaEntrega: detailEditFechaEntrega,
          horaEntrega: detailEditHoraEntrega,
          clienteTipoIdent: detailEditClienteTipoIdent,
          clienteIdentificacion: detailEditClienteIdentificacion,
          destinatarioNombre: detailEditDestinatarioNombre,
          telefonoDestino: detailEditTelefonoDestino,
          direccion: detailEditDireccion,
          barrioNombre: detailEditBarrioNombre,
          firma: detailEditFirma,
          mensajeTarjeta: detailEditMensajeTarjeta,
          observacionGeneral: detailEditObservacionGeneral,
          metodosPago: duplicateMetodosPago,
          canalFlora: duplicateCanalFlora,
        });
        await loadOrders(true);
        await openDetail(created.pedidoID);
        setIsDuplicatingDetail(false);
      } else {
        await api.actualizarDetallePedidoPipeline({
          pedidoId: selectedPedidoId,
          productoID: detailEditProductoID ? Number(detailEditProductoID) : null,
          productoObservaciones: detailEditProductoObservaciones,
          fechaEntrega: detailEditFechaEntrega,
          horaEntrega: detailEditHoraEntrega,
          clienteTipoIdent: detailEditClienteTipoIdent,
          clienteIdentificacion: detailEditClienteIdentificacion,
          destinatarioNombre: detailEditDestinatarioNombre,
          telefonoDestino: detailEditTelefonoDestino,
          direccion: detailEditDireccion,
          barrioNombre: detailEditBarrioNombre,
          firma: detailEditFirma,
          mensajeTarjeta: detailEditMensajeTarjeta,
          observacionGeneral: detailEditObservacionGeneral,
          metodosPago: paymentFieldConfig ? detailEditMetodosPago : null,
          canalFlora: salesChannelFieldConfig ? detailEditCanalFlora : null,
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

  const reloadDrawer = async () => {
    if (!selectedPedidoId) return;
    await openDetail(selectedPedidoId);
    await loadOrders(true);
  };

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }

    setSidebarPinned(current => !current);
  };

  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 20);
  const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));

  return (
    <>
      <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
            <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
          </div>

          <nav className="sidebar-nav" aria-label="Módulos">
            {canViewPipeline ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Pipeline"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoPipeline();
                }}
              >
                <span className="sidebar-nav-icon">▦</span>
                <span className="sidebar-nav-text">Pipeline</span>
              </button>
            ) : null}
            {canViewPedidos ? (
              <button
                type="button"
                className="sidebar-nav-btn is-active"
                title="Pedidos"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoPedidos();
                }}
              >
                <span className="sidebar-nav-icon">🧾</span>
                <span className="sidebar-nav-text">Pedidos</span>
              </button>
            ) : null}
            {canViewProduccion ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Producción"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoProduccion();
                }}
              >
                <span className="sidebar-nav-icon">🏭</span>
                <span className="sidebar-nav-text">Producción</span>
              </button>
            ) : null}
            {canViewDomicilios ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Domicilios"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoDomicilios();
                }}
              >
                <span className="sidebar-nav-icon">🛵</span>
                <span className="sidebar-nav-text">Domicilios</span>
              </button>
            ) : null}
            {canViewInventario ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Inventario"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoInventario();
                }}
              >
                <span className="sidebar-nav-icon">📦</span>
                <span className="sidebar-nav-text">Inventario</span>
              </button>
            ) : null}
            {canViewClientesPanel ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Clientes"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoClientes();
                }}
              >
                <span className="sidebar-nav-icon">💐</span>
                <span className="sidebar-nav-text">Clientes</span>
              </button>
            ) : null}
            {canViewUsuariosPanel ? (
              <button
                type="button"
                className="sidebar-nav-btn"
                title="Gestión Usuarios"
                onClick={() => {
                  setSidebarMobileOpen(false);
                  onGoUsuarios();
                }}
              >
                <span className="sidebar-nav-icon">👥</span>
                <span className="sidebar-nav-text">Gestión Usuarios</span>
              </button>
            ) : null}
          </nav>

          <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
            <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
            <span className="sidebar-logout-text">Cerrar sesión</span>
          </button>

          <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar} title={sidebarPinned ? "Contraer menú" : "Expandir menú"}>
            {sidebarPinned ? "←" : "→"}
          </button>

          <p className="sidebar-caption">Escalable para nuevos módulos</p>
        </aside>

        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setSidebarMobileOpen(false)}
        />

        <main className="orders-admin-view">
          <header className="orders-admin-header">
            <div>
              <button type="button" className="sidebar-trigger" onClick={toggleSidebar} title="Abrir o cerrar menú">☰ Menú</button>
              <h1>Gestión de Pedidos</h1>
              <p className="orders-admin-subtitle">Panel operativo para administrar pedidos de tus floristerías</p>
            </div>
            <button type="button" className="btn-primary" onClick={refresh} title="Actualizar pedidos">Actualizar</button>
          </header>

          <section className="orders-filters">
            <input
              type="text"
              placeholder="Buscar pedido, cliente, destinatario..."
              value={filters.q}
              onChange={event => applyFilterValue("q", event.target.value)}
            />
            <select value={filters.estado} onChange={event => applyFilterValue("estado", event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="CREADO">Creado</option>
              <option value="APROBADO">Aprobado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <input
              type="date"
              value={filters.fechaDesde}
              onChange={event => applyFilterValue("fechaDesde", event.target.value)}
            />
            <input
              type="date"
              value={filters.fechaHasta}
              onChange={event => applyFilterValue("fechaHasta", event.target.value)}
            />
          </section>

          {error && <p className="orders-message">{error}</p>}
          {loading && <p className="orders-message">Cargando pedidos...</p>}
          {!loading && !error && items.length === 0 && (
            <p className="orders-message">No hay pedidos para los filtros seleccionados.</p>
          )}

          <section className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Fecha Pedido</th>
                  <th>Hora Pedido</th>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Destinatario</th>
                  <th>Fecha Entrega</th>
                  <th>Hora Entrega</th>
                  <th>Producto(s)</th>
                  <th>Total</th>
                  <th>Método pago</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const statusClass = statusBadgeClass(item.estado);
                  const productText = (item.productos || []).slice(0, 2).join(", ");
                  const waPhone = String(item.telefonoCompleto || item.telefono || "").trim().replace(/\+/g, "");
                  const canAct = isPendingStatus(item.estado);
                  const approvalBlockedByTenant = canAct && item?.puedeAprobar === false;
                  const approveDisabled = !canAct || approvalBlockedByTenant;
                  const approveTitle = approvalBlockedByTenant
                    ? (item.motivoBloqueoAprobacion || "Completa la información requerida antes de aprobar")
                    : "Aprobar pedido";
                  const canDownloadInvoice = canInvoiceStatus(item.estado);
                  const canViewMessageCard = canMessageCardStatus(item.estado);
                  const pedidoId = Number(item.pedidoID);
                  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(item.fechaPedido || item.fecha);
                  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(item.fechaEntrega);

                  return (
                    <tr key={pedidoId || `${item.numeroPedido}-${item.fecha}`}>
                      <td data-label="Fecha Pedido">{fechaPedido || "-"}</td>
                      <td data-label="Hora Pedido">{item.horaPedido || horaPedido || "-"}</td>
                      <td data-label="Número">{item.numeroPedido || "-"}</td>
                      <td data-label="Cliente">{item.cliente || "-"}</td>
                      <td data-label="Destinatario">{item.destinatario || "-"}</td>
                      <td data-label="Fecha Entrega">{fechaEntrega || "-"}</td>
                      <td data-label="Hora Entrega">{item.horaEntrega || horaEntrega || "-"}</td>
                      <td data-label="Producto(s)" title={(item.productos || []).join(", ")}>{productText || "-"}</td>
                      <td data-label="Total">${formatearCOP(Number(item.total || 0))}</td>
                      <td data-label="Método pago">{item.metodoPago || "-"}</td>
                      <td data-label="Estado"><span className={`order-badge ${statusClass}`}>{item.estado || "-"}</span></td>
                      <td data-label="Acciones">
                        <div className="order-actions">
                          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="order-icon" title="WhatsApp">💬</a>
                          <button type="button" className="order-icon" onClick={() => openDetail(pedidoId)} title="Ver detalle">👁</button>
                          <button type="button" className="order-icon" onClick={() => approveOrder(pedidoId)} disabled={approveDisabled} title={approveTitle}>✔</button>
                          <button type="button" className="order-icon" onClick={() => rejectOrder(pedidoId)} disabled={!canAct} title="Rechazar pedido">✖</button>
                          {canDownloadInvoice && (
                            <button type="button" className="order-icon" onClick={() => downloadInvoice(pedidoId)} title="Descargar factura">🧾</button>
                          )}
                          {canViewMessageCard && (
                            <button
                              type="button"
                              className="btn-outline order-message-btn"
                              onClick={() => openMessageCard(item)}
                              title="Ver mensaje e imprimir tarjeta"
                            >
                              Ver mensaje / Imprimir tarjeta
                            </button>
                          )}
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

      <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>Detalle pedido</strong>
          <div className="orders-drawer-head-main-actions">
            {!detalle?.error && detalle ? (
              <button type="button" className="btn-outline" onClick={onToggleDetailEdit} title="Editar arreglo y entrega">
                {isEditingDetail ? "Cancelar edición" : "Editar"}
              </button>
            ) : null}
            {!detalle?.error && detalle ? (
              <button type="button" className="btn-outline" onClick={onStartDuplicateDetail} title="Duplicar pedido usando este detalle como base">
                Duplicar
              </button>
            ) : null}
            {canInvoiceStatus(detalle?.estado) && selectedPedidoId && (
              <button type="button" className="btn-outline" onClick={() => downloadInvoice(selectedPedidoId)} title="Descargar factura en PDF">Descargar factura</button>
            )}
            <button type="button" className="btn-outline" onClick={reloadDrawer} title="Recargar detalle del pedido">Recargar</button>
          </div>
          <div className="orders-drawer-head-close">
            <button type="button" className="icon-btn" onClick={closeDrawer} title="Cerrar detalle">✕</button>
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
                        type="text"
                        value={Number(detalle?.productos?.[0]?.cantidad || 0)}
                        readOnly
                        className="order-detail-edit-readonly"
                      />
                    </label>
                  </div>

                  {detailEditPrecio != null ? (
                    <div className="order-detail-edit-label">
                      <span>Precio arreglo</span>
                      <input
                        type="text"
                        value={`$${formatearCOP(detailEditPrecio)}`}
                        readOnly
                        className="order-detail-edit-readonly"
                      />
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
                        <span>{detailEditProductoID
                          ? buildProductoLabel(detailEditCatalog.find(i => String(i.id) === detailEditProductoID) || {})
                          : "— Selecciona un arreglo —"}
                        </span>
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
                                setDetailEditProductoObservaciones(String(item.descripcion || ""));
                                setDetailEditPrecio(item.precio != null ? Number(item.precio) : null);
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

                  <div className="order-detail-edit-grid">
                    <label className="order-detail-edit-label">
                      Tipo documento cliente
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
                      Cédula / NIT cliente
                      <input
                        type="text"
                        value={detailEditClienteIdentificacion}
                        onChange={event => setDetailEditClienteIdentificacion(event.target.value)}
                        placeholder="Número de documento"
                      />
                    </label>
                  </div>

                  <p className="order-detail-edit-hint">
                    Si corriges el documento a NIT, el pedido recalcula IVA con la configuración fiscal disponible.
                  </p>

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
                    Observaciones del arreglo
                    <textarea
                      rows={4}
                      value={detailEditProductoObservaciones}
                      onChange={event => setDetailEditProductoObservaciones(event.target.value)}
                      placeholder="Observaciones del arreglo personalizable"
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
                    Observación
                    <textarea
                      rows={3}
                      value={detailEditObservacionGeneral}
                      onChange={event => setDetailEditObservacionGeneral(event.target.value)}
                      placeholder="Observación general para Domicilio"
                    />
                  </label>

                  {paymentFieldConfig || salesChannelFieldConfig ? (
                    <>
                      {paymentFieldConfig ? (
                        <div className="order-detail-edit-label">
                          <span>{paymentFieldConfig.titulo || "Métodos de pago"}</span>
                          <div className="order-detail-edit-checklist">
                            {(Array.isArray(paymentFieldConfig.opciones) ? paymentFieldConfig.opciones : []).map(option => (
                            <label key={option} className="order-detail-edit-checkitem">
                              <input
                                type="checkbox"
                                checked={detailEditMetodosPago.includes(option)}
                                onChange={() => {
                                  setDetailEditMetodosPago(current => current.includes(option)
                                    ? current.filter(item => item !== option)
                                    : [...current, option]);
                                }}
                              />
                              <span>{option}</span>
                            </label>
                            ))}
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
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Times New Roman', serif">Times New Roman</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                    <option value="'Courier New', monospace">Courier New</option>
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
                  Alineación
                  <select value={cardTextAlign} onChange={event => setCardTextAlign(event.target.value)}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
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
                  {messageCardOrder?.numeroPedido || messageCardOrder?.pedidoID || "-"}
                </p>
                <p className="message-card-meta message-card-date">
                  {formatFechaEntregaTarjeta(messageCardData?.fechaEntrega || messageCardOrder?.fechaEntrega)}
                </p>
                <div className="message-card-message-row">
                  <span className="message-card-message-label">Mensaje:</span>
                  <p
                    className="message-card-message"
                    style={{
                      fontFamily: cardFontFamily,
                      fontSize: `${cardFontSize}px`,
                      color: cardTextColor,
                    }}
                  >
                    {String(messageCardDraft || "Sin mensaje")}
                  </p>
                </div>
                <p className="message-card-closing">Con mucho cariño</p>
                <p className="message-card-meta message-card-signature">
                  {resolveFirmaTarjeta(messageCardData?.firma)}
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function statusBadgeClass(status) {
  const key = normalizeStatus(status);
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

function extractIndicativo(phone) {
  const raw = String(phone || "").trim();
  const match = raw.match(/^(\+\d{1,4})/);
  return match ? match[1] : null;
}

function OrderDetail({ detalle, paymentTitle = "Método de pago", salesChannelTitle = "Celular Flora" }) {
  const productos = Array.isArray(detalle.productos) ? detalle.productos : [];
  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(detalle.fechaPedido || detalle.fecha);
  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(detalle.destinatario?.fechaEntrega);
  const tipoDocumentoCliente = formatClienteTipoDocumento(detalle.cliente);
  const numeroDocumentoCliente = formatClienteNumeroDocumento(detalle.cliente);

  return (
    <>
      <section className="order-block">
        <h4>📦 Información General</h4>
        <p><strong>Número:</strong> {detalle.numeroPedido || "-"}</p>
        <p><strong>Fecha Pedido:</strong> {fechaPedido || "-"}</p>
        <p><strong>Hora Pedido:</strong> {detalle.horaPedido || horaPedido || "-"}</p>
        <p><strong>Estado:</strong> {detalle.estado || "-"}</p>
        {detalle.motivoRechazo && <p><strong>Motivo rechazo:</strong> {detalle.motivoRechazo}</p>}
      </section>

      <section className="order-block">
        <h4>👤 Cliente</h4>
        <p><strong>Nombre:</strong> {detalle.cliente?.nombre || "-"}</p>
        <p><strong>Teléfono:</strong> {detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono || "-"}</p>
        <p><strong>Email:</strong> {detalle.cliente?.email || "-"}</p>
        <p><strong>Tipo documento:</strong> {tipoDocumentoCliente}</p>
        <p><strong>N documento:</strong> {numeroDocumentoCliente}</p>
      </section>

      <section className="order-block">
        <h4>🎁 Destinatario</h4>
        <p><strong>Nombre:</strong> {detalle.destinatario?.nombre || "-"}</p>
        <p><strong>Teléfono:</strong> {detalle.destinatario?.telefono || "-"}</p>
        <p><strong>Dirección:</strong> {detalle.destinatario?.direccion || "-"}</p>
        <p><strong>Barrio:</strong> {detalle.destinatario?.barrio || "-"}</p>
        <p><strong>Fecha entrega:</strong> {fechaEntrega || "-"}</p>
        <p><strong>Hora entrega:</strong> {detalle.destinatario?.horaEntrega || horaEntrega || "-"}</p>
        <p><strong>Firma:</strong> {detalle.destinatario?.firma || "-"}</p>
        <p><strong>Mensaje:</strong> {detalle.destinatario?.mensajeTarjeta || "-"}</p>
        <p><strong>Observación entrega:</strong> {detalle.destinatario?.observacionGeneral || "-"}</p>
      </section>

      <section className="order-block">
        <h4>💰 Resumen financiero</h4>
        <p><strong>Subtotal:</strong> ${formatearCOP(Number(detalle.financiero?.subtotal || 0))}</p>
        <p><strong>IVA:</strong> ${formatearCOP(Number(detalle.financiero?.iva || 0))}</p>
        <p><strong>Domicilio:</strong> ${formatearCOP(Number(detalle.financiero?.domicilio || 0))}</p>
        <p><strong>Total:</strong> ${formatearCOP(Number(detalle.financiero?.total || 0))}</p>
        <p><strong>Estado pago:</strong> {detalle.financiero?.estadoPago || "-"}</p>
        <p><strong>{paymentTitle}:</strong> {formatMetodoPago(detalle.financiero)}</p>
        <p><strong>Cuenta bancaria:</strong> {detalle.financiero?.cuentaBancaria || "-"}</p>
        <p><strong>{salesChannelTitle}:</strong> {detalle.financiero?.canalFlora || "-"}</p>
      </section>

      <section className="order-block">
        <h4>🧾 Productos</h4>
        {productos.length === 0 ? (
          <p>Sin productos</p>
        ) : (
          productos.map((producto, index) => (
            <div key={`${producto.productoID || producto.nombreProducto}-${index}`} className="order-block looker-block">
              <p><strong>Código de arreglo:</strong> {producto.codigoProducto || "-"}</p>
              <p><strong>Nombre del arreglo:</strong> {producto.nombreProducto || "-"}</p>
              <p><strong>Cantidad:</strong> {Number(producto.cantidad || 0)}</p>
              <p><strong>Observación personalizados:</strong> {producto.observaciones || "-"}</p>
              <p><strong>Subtotal:</strong> ${formatearCOP(Number(producto.subtotal || 0))}</p>
            </div>
          ))
        )}
      </section>
    </>
  );
}

function normalizeCatalogItem(raw) {
  const id = getProductoId(raw);
  if (id == null) return null;
  const precio = raw?.precio != null
    ? Number(raw.precio)
    : raw?.precioUnitario != null
      ? Number(raw.precioUnitario)
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
  return {
    id: Number.isNaN(id) ? null : id,
    nombre,
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





