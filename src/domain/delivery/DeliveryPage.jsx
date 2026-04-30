import { useCallback, useEffect, useMemo, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { formatDateOnly, formatTimeOnly, normalizeStatus } from "../../shared/utils.js";

const FILTROS = [
  { value: "hoy", label: "Hoy" },
  { value: "manana", label: "Manana" },
  { value: "pendientes", label: "Pendientes" },
  { value: "enruta", label: "En ruta" },
  { value: "noentregado", label: "No entregado" },
];

const DELIVERY_VIEWS = [
  { value: "admin", label: "Vista Admin" },
  { value: "disponibles", label: "Pedidos disponibles" },
  { value: "mis-pedidos", label: "Mis pedidos" },
  { value: "barrios", label: "Barrios" },
];

const DEFAULT_DELIVERY_FORM = {
  firmaNombre: "",
  firmaDocumento: "",
  firmaImagenFile: null,
  evidenciaFotoFile: null,
  observaciones: "",
  noEntregadoMotivo: "",
  reprogramarPara: "",
};

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
    const candidateUserId = Number(item?.usuarioID || item?.userID || item?.idUsuario || 0);
    if (sessionUserId > 0 && candidateUserId > 0 && candidateUserId === sessionUserId) return true;

    const candidateLogin = normalizeSearchText(item?.login || item?.usuario);
    if (sessionLogin && candidateLogin && candidateLogin === sessionLogin) return true;

    const candidateEmail = normalizeSearchText(item?.email);
    if (sessionEmail && candidateEmail && candidateEmail === sessionEmail) return true;

    const candidateName = normalizeSearchText(item?.nombre || item?.nombreDomiciliario || item?.nombre_empleado);
    return sessionName && candidateName && candidateName === sessionName;
  });

  return found?.idDomiciliario != null ? Number(found.idDomiciliario) : null;
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
  return "is-pendiente";
}

function priorityTone(priority) {
  const key = String(priority || "").trim().toUpperCase();
  if (key === "ALTA" || key === "URGENTE") return "is-rechazado";
  if (key === "MEDIA") return "is-entrega";
  return "is-pendiente";
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
      const status = normalizeStatus(item?.estado);
      if (status === "ENRUTA" || status === "EN_CAMINO") {
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
  canViewInventario,
  canViewContabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onLogout,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoContabilidad,
  onGoClientes,
  onGoUsuarios,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const usuarioCambio = String(session?.email || session?.nombre || "admin");

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isOffline, setIsOffline] = useState(() => globalThis.navigator ? !globalThis.navigator.onLine : false);

  const [adminItems, setAdminItems] = useState([]);
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [selectedDomiciliarioByEntrega, setSelectedDomiciliarioByEntrega] = useState({});
  const [filtro, setFiltro] = useState("hoy");
  const [fechaFiltro, setFechaFiltro] = useState(todayIso());

  const [modo, setModo] = useState("admin");
  const [domiciliarioId, setDomiciliarioId] = useState("");
  const [soloMisAsignados, setSoloMisAsignados] = useState(true);
  const [availableItems, setAvailableItems] = useState([]);
  const [myOrdersItems, setMyOrdersItems] = useState([]);
  const [availableCoords, setAvailableCoords] = useState(null);

  const [selectedDeliveryItem, setSelectedDeliveryItem] = useState(null);
  const [deliveryDrawerOpen, setDeliveryDrawerOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState(DEFAULT_DELIVERY_FORM);

  const [barriosItems, setBarriosItems] = useState([]);
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

  const myOrdersGrouped = useMemo(() => partitionMyOrders(myOrdersItems), [myOrdersItems]);
  const selectedDeliveryState = normalizeStatus(selectedDeliveryItem?.estado);
  const currentDomiciliarioId = useMemo(
    () => inferCurrentDomiciliarioId(session, domiciliarios),
    [session, domiciliarios]
  );
  const visibleAdminItems = useMemo(() => {
    if (!soloMisAsignados || currentDomiciliarioId == null) return adminItems;
    return adminItems.filter(item => Number(item?.domiciliarioID) === Number(currentDomiciliarioId));
  }, [adminItems, soloMisAsignados, currentDomiciliarioId]);

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
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

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
      setDomiciliarioId(String(rows[0].idDomiciliario));
    }
  }, [api, empresaId, sucursalId, domiciliarioId]);

  const loadAdmin = useCallback(async () => {
    const data = await api.listarDomiciliosAdmin({
      empresaId,
      sucursalId,
      filtro,
      fecha: fechaFiltro,
    });
    setAdminItems(Array.isArray(data.items) ? data.items : []);
  }, [api, empresaId, sucursalId, filtro, fechaFiltro]);

  const loadAvailableOrders = useCallback(async coords => {
    const data = await api.listarPedidosDisponibles({
      empresaId,
      sucursalId,
      fecha: fechaFiltro,
      latitud: coords?.lat,
      longitud: coords?.lng,
    });
    setAvailableItems(Array.isArray(data.items) ? data.items : []);
  }, [api, empresaId, sucursalId, fechaFiltro]);

  const loadMyOrders = useCallback(async () => {
    const data = await api.listarMisPedidos({
      empresaId,
      sucursalId,
      fecha: fechaFiltro,
    });
    setMyOrdersItems(Array.isArray(data.items) ? data.items : []);
  }, [api, empresaId, sucursalId, fechaFiltro]);

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
    if (modo === "barrios") {
      runLoad(loadBarrios).catch(() => {});
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
      throw new Error("Sin conexión. Revisa internet antes de continuar.");
    }

    const coords = await requestCurrentCoords();
    setAvailableCoords(coords);
    setFeedback(`Ubicación confirmada para ${actionLabel}.`);
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
      setError(nextError?.message || "No fue posible obtener tu ubicación.");
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
      } else if (modo === "barrios") {
        await loadBarrios();
      } else {
        await loadMyOrders();
      }
    });
  };

  const onChangeSoloMisAsignados = checked => {
    setSoloMisAsignados(checked);
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

  const onAsignar = async item => {
    const domiciliarioValue = selectedDomiciliarioByEntrega[item.idEntrega] || item.domiciliarioID || "";
    setBusy(`asignar-${item.idEntrega}`);
    try {
      await api.asignarDomiciliarioEntrega({
        entregaId: item.idEntrega,
        domiciliarioID: domiciliarioValue ? Number(domiciliarioValue) : null,
        usuarioCambio,
      });
      setFeedback("Domiciliario asignado correctamente.");
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

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>

        <nav className="sidebar-nav" aria-label="Módulos">
          {canViewPipeline ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPipeline(); }}>
              <span className="sidebar-nav-icon">▦</span>
              <span className="sidebar-nav-text">Pipeline</span>
            </button>
          ) : null}
          {canViewPedidos ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPedidos(); }}>
              <span className="sidebar-nav-icon">🧾</span>
              <span className="sidebar-nav-text">Pedidos</span>
            </button>
          ) : null}
          {canViewProduccion ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoProduccion(); }}>
              <span className="sidebar-nav-icon">🏭</span>
              <span className="sidebar-nav-text">Producción</span>
            </button>
          ) : null}
          {canViewDomicilios ? (
            <button type="button" className="sidebar-nav-btn is-active" onClick={() => { setSidebarMobileOpen(false); onGoDomicilios(); }}>
              <span className="sidebar-nav-icon">🛵</span>
              <span className="sidebar-nav-text">Domicilios</span>
            </button>
          ) : null}
          {canViewInventario ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoInventario(); }}>
              <span className="sidebar-nav-icon">📦</span>
              <span className="sidebar-nav-text">Inventario</span>
            </button>
          ) : null}
          {canViewContabilidad ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoContabilidad(); }}>
              <span className="sidebar-nav-icon">📊</span>
              <span className="sidebar-nav-text">Contabilidad</span>
            </button>
          ) : null}
          {canViewClientesPanel ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoClientes(); }}>
              <span className="sidebar-nav-icon">💐</span>
              <span className="sidebar-nav-text">Clientes</span>
            </button>
          ) : null}
          {canViewUsuariosPanel ? (
            <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoUsuarios(); }}>
              <span className="sidebar-nav-icon">👥</span>
              <span className="sidebar-nav-text">Gestión Usuarios</span>
            </button>
          ) : null}
        </nav>

        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesión</span>
        </button>

        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar}>{sidebarPinned ? "←" : "→"}</button>
        <p className="sidebar-caption">Última milla simple y trazable</p>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebarMobileOpen(false)} />

      <main className="orders-admin-view">
        <header className="orders-admin-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menú</button>
            <h1>Domicilios</h1>
            <p className="orders-admin-subtitle">Pedidos listos para entrega, toma segura y cierre con evidencia reutilizando el flujo actual.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary" onClick={refreshAll} disabled={loading || Boolean(actionKey)}>
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <section className="inventory-header-tabs" aria-label="Submenu domicilios">
          {DELIVERY_VIEWS.map(item => (
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

        {modo !== "barrios" ? (
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
                {domiciliarios.map(item => <option key={item.idDomiciliario} value={item.idDomiciliario}>{item.nombre}</option>)}
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

        {feedback ? <p className="orders-message delivery-feedback">{feedback}</p> : null}
        {error ? <p className="orders-message delivery-error">{error}</p> : null}
        {loading ? <p className="orders-message">Cargando domicilios...</p> : null}

        {modo === "admin" ? (
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
                        value={selectedDomiciliarioByEntrega[item.idEntrega] ?? (item.domiciliarioID || "")}
                        onChange={event => setSelectedDomiciliarioByEntrega(current => ({ ...current, [item.idEntrega]: event.target.value }))}
                      >
                        <option value="">Sin asignar</option>
                        {domiciliarios.map(dom => <option key={dom.idDomiciliario} value={dom.idDomiciliario}>{dom.nombre}</option>)}
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
                        <button type="button" className="btn-outline" onClick={() => openMaps(item)}>Ver ubicación</button>
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
                    <strong>Pedido #{item.numeroPedido || "-"}</strong>
                    <span className={`order-badge ${priorityTone(item.prioridad)}`}>{item.prioridad || "MEDIA"}</span>
                  </div>

                  <p className="delivery-address">{item.direccion || "Sin dirección"}</p>
                  <p className="delivery-meta">
                    {item.barrio || "Barrio sin definir"}
                    {` · ${formatDistanceKm(getDistanceValue(item))}`}
                    {item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)
                      ? ` · ${item.horaEntrega || formatTimeOnly(item.fechaEntregaProgramada)}`
                      : ""}
                  </p>

                  <div className="delivery-detail-list">
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
                      <strong>Pedido #{item.numeroPedido || "-"}</strong>
                      <span className={`order-badge ${stateBadgeClass(item.estado)}`}>{item.estado || "EnRuta"}</span>
                    </div>
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
                      <button type="button" className="btn-primary" onClick={() => openDeliveryDetail(item)}>Cerrar entrega</button>
                    </div>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : (
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
                    <option value="1">Sí</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <button type="button" className="btn-primary" onClick={onCrearBarrio} disabled={barrioSaving}>
                  {barrioSaving ? "Guardando..." : "Crear barrio"}
                </button>
              </div>
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
                    {barriosItems.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No hay barrios cargados para esta sucursal.</td>
                      </tr>
                    ) : barriosItems.map(item => (
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
                        <td>{item.activo ? "Sí" : "No"}</td>
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
            <button type="button" className="icon-btn" onClick={closeDeliveryDetail} title="Cerrar barra lateral">✕</button>
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
                  <p><span>Número del pedido</span><strong>{selectedDeliveryItem.numeroPedido || "-"}</strong></p>
                  <p><span>Cliente</span><strong>{selectedDeliveryItem.cliente || selectedDeliveryItem.destinatario || "-"}</strong></p>
                  <p><span>Destinatario</span><strong>{selectedDeliveryItem.destinatario || "-"}</strong></p>
                  <p><span>Dirección</span><strong>{selectedDeliveryItem.direccion || "-"}</strong></p>
                  <p><span>Barrio</span><strong>{selectedDeliveryItem.barrio || "-"}</strong></p>
                  <p><span>Fecha entrega</span><strong>{formatDateOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</strong></p>
                  <p><span>Hora entrega</span><strong>{selectedDeliveryItem.horaEntrega || formatTimeOnly(selectedDeliveryItem.fechaEntregaProgramada) || "-"}</strong></p>
                  <p><span>Estado</span><strong>{selectedDeliveryItem.estado || "-"}</strong></p>
                  <p><span>Domiciliario</span><strong>{selectedDeliveryItem.domiciliario || "-"}</strong></p>
                  <p><span>Teléfono</span><strong>{selectedDeliveryItem.telefonoDestino || "-"}</strong></p>
                  <p><span>Mensaje</span><strong>{selectedDeliveryItem.mensaje || "-"}</strong></p>
                  <p><span>Observación</span><strong>{selectedDeliveryItem.observacion || "-"}</strong></p>
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
