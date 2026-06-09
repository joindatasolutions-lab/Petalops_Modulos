import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatDateOnly, formatDateTimeCompact, normalizeStatus } from "../../shared/utils.js";
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
  ClipboardList,
  Eye,
  Filter,
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

const ESTADOS_UI = ["Pendiente", "EnProduccion", "ParaEntrega", "Cancelado"];
const ESTADOS_FILTRO_DEFAULT = ["Pendiente", "EnProduccion"];
const ESTADOS_FLORISTA = ["Activo", "Inactivo", "Incapacidad"];
const ESTADOS_FLORISTA_BASICOS = ["Activo", "Inactivo"];
const DEFAULT_USER = "admin.demo";
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
  CANCELADO: "is-rechazado"
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

function minutesUntilDelivery(item) {
  const raw = item?.fechaEntrega;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((parsed.getTime() - Date.now()) / 60000);
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

function deliveryTimingStatus(item) {
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

function flattenPipelineCards(payload) {
  if (!payload || typeof payload !== "object") return [];
  const stages = ["creado", "aprobado", "pendiente_produccion", "en_produccion", "listo", "en_camino", "entregado", "cancelado"];
  return stages.flatMap(stage => (Array.isArray(payload?.[stage]) ? payload[stage] : []));
}

function productionSelectionKey(item) {
  const pedidoId = Number(item?.pedidoID || 0);
  if (pedidoId > 0) return `pedido-${pedidoId}`;
  return `produccion-${Number(item?.idProduccion || 0)}`;
}

function buildVisibleProductionItems(sourceItems, currentFloristaId, busquedaGeneral, soloMisAsignados, groupByPedido = true) {
  const search = normalizeSearchText(busquedaGeneral);
  const filtered = sourceItems.filter(item => {
    if (!search && soloMisAsignados && currentFloristaId != null && Number(item?.floristaID) !== Number(currentFloristaId)) {
      return false;
    }
    if (search) {
      const matchesFlorista = normalizeSearchText(item?.floristaAsignado).includes(search);
      const matchesCliente = normalizeSearchText(item?.cliente).includes(search);
      const matchesPedido = normalizeSearchText(item?.numeroPedido).includes(search);
      if (!matchesFlorista && !matchesCliente && !matchesPedido) return false;
    }
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
        codigosAgrupados: [item.codigoArreglo].filter(Boolean),
        cantidadProducciones: 1,
      });
      continue;
    }

    current.produccionIds.push(item.idProduccion);
    if (item.pedidoDetalleID != null) current.pedidoDetalleIds.push(item.pedidoDetalleID);
    if (item.nombreArreglo || item.producto) current.productosAgrupados.push(item.nombreArreglo || item.producto);
    if (item.codigoArreglo) current.codigosAgrupados.push(item.codigoArreglo);
    current.cantidadProducciones += 1;
    if (!current.floristaID && item.floristaID) current.floristaID = item.floristaID;
    if (!current.floristaAsignado && item.floristaAsignado) current.floristaAsignado = item.floristaAsignado;
    if (!current.observacion && item.observacion) current.observacion = item.observacion;
    if (!current.notasProduccion && item.notasProduccion) current.notasProduccion = item.notasProduccion;
    if (!current.observacionesPersonalizados && item.observacionesPersonalizados) current.observacionesPersonalizados = item.observacionesPersonalizados;
  }

  return Array.from(grouped.values()).map(item => {
    const productosUnicos = Array.from(new Set((item.productosAgrupados || []).filter(Boolean)));
    const codigosUnicos = Array.from(new Set((item.codigosAgrupados || []).filter(Boolean)));
    return {
      ...item,
      idProduccion: Number(item.produccionIds?.[0] || item.idProduccion),
      pedidoDetalleID: item.pedidoDetalleIds?.[0] ?? item.pedidoDetalleID ?? null,
      nombreArreglo: productosUnicos.join(" + "),
      producto: productosUnicos.join(" + "),
      codigoArreglo: codigosUnicos.join(" + "),
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

function nextFloristaStatus(status) {
  const normalized = normalizeStatus(status).replace(/_/g, "");
  if (normalized === "PENDIENTE") return "EnProduccion";
  if (normalized === "ENPRODUCCION") return "ParaEntrega";
  return null;
}

function nextFloristaLabel(status) {
  const next = nextFloristaStatus(status);
  if (next === "EnProduccion") return "Iniciar producción";
  if (next === "ParaEntrega") return "Para entrega";
  return null;
}

function arregloCodeLabel(item) {
  return item?.codigoArreglo || "-";
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function isFloristaActivo(item) {
  return String(item?.estado || "").trim().toLowerCase() === "activo" && Boolean(item?.activo);
}

export function ProductionPage({ session, canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewInventario, canViewContabilidad, canViewTrazabilidad, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoInventario, onGoContabilidad, onGoTrazabilidad, onGoClientes, onGoUsuarios }) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const normalizedRole = normalizeRole(session?.rol);
  const isSuperAdmin = Boolean(session?.esGlobalJoin) || ["super_admin", "join_superadmin"].includes(normalizedRole);
  const canManageProductionActions = Boolean(session?.esGlobalJoin) || ["admin", "empresa_admin"].includes(normalizedRole);
  const canManageStateAndRecalculate = isSuperAdmin;
  const canFloristaQuickState = !canManageProductionActions;
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );
  const visibleSubmenuOptions = useMemo(
    () => (canManageProductionActions ? SUBMENU_OPTIONS : [{ key: "pedidos", label: "Pedidos" }]),
    [canManageProductionActions]
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

  const [selectedFloristaById, setSelectedFloristaById] = useState({});
  const [selectedEstadoById, setSelectedEstadoById] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const ownFloristaDisponibilidad = useMemo(() => {
    if (currentFloristaId == null) return null;
    return floristasDisponibilidad.find(item => Number(item.idFlorista) === Number(currentFloristaId)) || null;
  }, [currentFloristaId, floristasDisponibilidad]);

  const canChangeOwnProductionState = useCallback((item) => {
    if (!canFloristaQuickState || currentFloristaId == null) return false;
    return Number(item?.floristaID) === Number(currentFloristaId);
  }, [canFloristaQuickState, currentFloristaId]);

  const visibleItems = useMemo(
    () => buildVisibleProductionItems(items, currentFloristaId, busquedaGeneral, activeMetricFilter ? false : soloMisAsignados, !activeMetricFilter),
    [items, currentFloristaId, busquedaGeneral, soloMisAsignados, activeMetricFilter]
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
    setEstadosFiltro(current => {
      const exists = current.includes(estadoItem);
      if (exists) {
        // Mantener al menos un estado activo para evitar vista vacía accidental.
        if (current.length === 1) return current;
        return current.filter(item => item !== estadoItem);
      }
      return [...current, estadoItem];
    });
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const expectedMetricCount = activeMetricFilter
        ? Number(productionMetricasRef.current?.[activeMetricFilter] || 0)
        : 0;
      const produccion = await api.listarProduccion({
        empresaId,
        sucursalId,
        fecha: searchOverridesFilters || activeMetricFilter ? undefined : fecha,
        estado: undefined,
        q: searchOverridesFilters ? busquedaGeneral : undefined,
        metricFilter: searchOverridesFilters ? undefined : activeMetricFilter,
        todasFechas: !searchOverridesFilters && !activeMetricFilter && !fecha,
        incluirCancelado: false,
        autoAsignarPendientesHoy: !activeMetricFilter && !searchOverridesFilters,
      });
      let nextItemsRaw = Array.isArray(produccion.items) ? produccion.items : [];
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
          incluirCancelado: false,
          autoAsignarPendientesHoy: false,
        });
        nextItemsRaw = (Array.isArray(fallbackResponse.items) ? fallbackResponse.items : [])
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
                estado: undefined,
                incluirCancelado: false,
              })
            )
          );
          nextItemsRaw = fallbackResponses.flatMap(response => (Array.isArray(response?.items) ? response.items : []));
        }
      }
      const nextItems = activeMetricFilter
        ? nextItemsRaw
        : searchOverridesFilters
        ? nextItemsRaw.filter(item => {
          const search = normalizeSearchText(busquedaGeneral);
          const matchesFlorista = normalizeSearchText(item?.floristaAsignado).includes(search);
          const matchesCliente = normalizeSearchText(item?.cliente).includes(search);
          const matchesPedido = normalizeSearchText(item?.numeroPedido).includes(search);
          return matchesFlorista || matchesCliente || matchesPedido;
        })
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
    setMotivoAccion("");
  };

  const closeActionsDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  const refreshAndKeepSelection = async item => {
    const nextItems = await loadItems();
    const nextVisible = buildVisibleProductionItems(nextItems, currentFloristaId, busquedaGeneral, soloMisAsignados);
    const nextSelected = nextVisible.find(candidate => Number(candidate.pedidoID) === Number(item?.pedidoID));
    if (nextSelected) {
      setSelectedItem(nextSelected);
      setDrawerOpen(true);
      return;
    }
    closeActionsDrawer();
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
        observacionesInternas: motivoAccion || null
      })));
      await refreshAndKeepSelection(item);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error cambiando estado:", nextError);
      globalThis.alert("No fue posible cambiar el estado. Verifica transición válida.");
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
        observacionesInternas: "Cambio de estado desde panel florista"
      })));
      await loadItems();
    } catch (nextError) {
      console.error("Error cambiando estado rápido de florista:", nextError);
      globalThis.alert("No fue posible cambiar el estado.");
    }
  };

  const recalcularPedido = async item => {
    try {
      await api.recalcularProduccinPedido({
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
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          trazabilidad: canViewTrazabilidad,
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
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
      />

      <main className="orders-admin-view production-page-view">
        <header className="orders-admin-header orders-page-header production-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-breadcrumb" aria-label="Ruta">
              <span>Operaciones</span>
              <span>/</span>
              <strong>Producción</strong>
            </div>
            <div className="orders-page-title-row">
              <h1>Producción</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">
              Organiza asignaciones, estados y entregas de producción diaria.
            </p>
            <span className="orders-user-pill">
              <span aria-hidden="true" />
              Sesion activa: {displayUserName}
            </span>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
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

        {activeMetricMeta ? (
          <section className="production-alert-card production-ops-panel" ref={productionListRef} aria-label="Panel operativo de KPI seleccionado">
            <div className="production-alert-card-copy">
              <span className="production-alert-eyebrow">Centro operativo</span>
              <strong>{activeMetricMeta.label}</strong>
              <span>{focusedVisibleItems.length} pedido{focusedVisibleItems.length === 1 ? "" : "s"} afectado{focusedVisibleItems.length === 1 ? "" : "s"}</span>
            </div>
            <div className="production-alert-card-list">
              {focusedVisibleItems.length === 0 ? (
                <div className="production-alert-pill production-alert-pill-empty">
                  <span className="production-alert-icon" aria-hidden="true" />
                  <div className="production-alert-pill-copy">
                    <strong>Sin pedidos visibles</strong>
                    <span>No hay arreglos para este indicador.</span>
                    <small>Revisa filtros o fecha seleccionada.</small>
                  </div>
                </div>
              ) : focusedVisibleItems.slice(0, 8).map(item => (
                <div key={`metric-focus-${item.idProduccion}`} className="production-alert-pill">
                  <span className="production-alert-icon" aria-hidden="true" />
                  <div className="production-alert-pill-copy">
                    <strong>Pedido {item.numeroPedido}</strong>
                    <span>{item.cliente || "Cliente"}</span>
                    <small>{resolveProgrammedDate(item) || "-"}</small>
                  </div>
                  <span className={`order-badge production-alert-status ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
                </div>
              ))}
            </div>
          </section>
        ) : metrics.criticos.length > 0 ? (
          <section className="production-alert-card production-ops-panel" ref={productionListRef} aria-label="Alertas de pedidos críticos">
            <div className="production-alert-card-copy">
              <span className="production-alert-eyebrow">Centro operativo</span>
              <strong>Alertas de producción</strong>
              <span>{metrics.sinAsignar} sin asignar · {metrics.atrasados} atrasado{metrics.atrasados === 1 ? "" : "s"}</span>
            </div>
            <div className="production-alert-card-list">
              {metrics.criticos.map(item => (
                <div key={`metric-${item.idProduccion}`} className="production-alert-pill">
                  <span className="production-alert-icon" aria-hidden="true" />
                  <div className="production-alert-pill-copy">
                    <strong>Pedido {item.numeroPedido}</strong>
                    <span>{item.cliente || "Cliente"}</span>
                    <small>{resolveProgrammedDate(item) || "-"}</small>
                  </div>
                  <span className={`order-badge production-alert-status ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
                </div>
              ))}
            </div>
          </section>
        ) : <span ref={productionListRef} />}

        {submenu === "pedidos" && (
          <>
            <section className="orders-filters orders-filters--four-col production-filters-bar">
              <label className="filter-field production-filter-field production-filter-field-search">
                <span>Buscar</span>
                <div className="production-filter-control">
                  <Search size={17} strokeWidth={2} aria-hidden="true" />
                  <input
                    type="search"
                    value={busquedaGeneral}
                    onChange={event => {
                      setActiveMetricFilter(null);
                      setBusquedaGeneral(event.target.value);
                    }}
                    placeholder="Florista, cliente o pedido"
                    title="Buscar por florista, cliente o número de pedido"
                  />
                </div>
              </label>
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
              <label className="filter-field production-filter-field">
                <span>Estado</span>
                <details className="estado-filtro-dropdown">
                  <summary className="estado-filtro-summary">
                    <Filter size={17} strokeWidth={2} aria-hidden="true" />
                    Estados
                  </summary>
                  <div className="estado-filtro-panel">
                    <div className="estado-filtro-list">
                      {ESTADOS_UI.map(item => (
                        <label key={item} className="estado-filtro-item">
                          <input
                            type="checkbox"
                            checked={estadosFiltro.includes(item)}
                            onChange={() => toggleEstadoFiltro(item)}
                          />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </label>
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
                    <th>Fecha Asignación</th>
                    <th>Estado tiempo</th>
                    {canManageProductionActions ? <th>Acciones Domicilios</th> : null}
                    {canFloristaQuickState ? <th>Acción</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {focusedVisibleItems.map(item => {
                    const timing = deliveryTimingStatus(item);
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
                        <span className="production-order-badge">{item.numeroPedido ?? "-"}</span>
                      </td>
                      <td>
                        <div className="production-product-customer">
                          <strong>{item.producto || "-"}</strong>
                          <span>{item.cliente || "-"}</span>
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
                      <td>{formatDateTimeCompact(item.fechaAsignacion) || "-"}</td>
                      <td>
                        <div className="production-time-stack">
                          <span className={`production-timing-badge ${timing.className}`}>{timing.label}</span>
                          <strong className={timing.className === "is-late" ? "is-overdue" : ""}>{timing.remainingLabel}</strong>
                        </div>
                      </td>
                      {canManageProductionActions ? (
                        <td>
                          <div className="production-row-actions" aria-label="Acciones rápidas">
                            <button type="button" className="production-icon-action" title="Ver detalle" aria-label="Ver detalle" onClick={() => openActionsDrawer(item)}>
                              <Eye size={18} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                      {canFloristaQuickState ? (
                        <td>
                          <div className="production-inline-actions">
                            <button
                              type="button"
                              className="btn-outline"
                              title="Ver detalle del arreglo"
                              onClick={() => openActionsDrawer(item)}
                            >
                              Ver detalle
                            </button>
                            {canChangeOwnProductionState(item) && nextFloristaStatus(item.estado) ? (
                              <button
                                type="button"
                                className="btn-outline"
                                title="Actualizar estado de producción"
                                onClick={() => cambiarEstadoFloristaRapido(item)}
                              >
                                {nextFloristaLabel(item.estado)}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </section>

            <section className="production-capsules" aria-label="Pedidos en cápsulas">
              {focusedVisibleItems.map(item => (
                <article key={`cap-${item.idProduccion}`} className={`production-capsule ${!hasAssignedFlorista(item) ? "production-capsule-unassigned" : ""}`}>
                  <header className="production-capsule-head">
                    <strong>{item.numeroPedido ?? "-"}</strong>
                    <span className={`order-badge ${productionStatusBadgeClass(item)}`}>{item.estado || "-"}</span>
                  </header>

                  <div className="production-capsule-grid">
                    <p><span>Producto</span><strong>{item.producto || "-"}</strong></p>
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
                    <p><span>Asignación</span><strong>{formatDateTimeCompact(item.fechaAsignacion) || "-"}</strong></p>
                    <p><span>Estado tiempo</span><strong>{deliveryTimingStatus(item).label}</strong></p>
                  </div>

                  <div className="production-capsule-actions">
                      {canManageProductionActions ? (
                      <div className="production-row-actions" aria-label="Acciones rápidas">
                        <button type="button" className="production-icon-action" title="Ver detalle" aria-label="Ver detalle" onClick={() => openActionsDrawer(item)}>
                          <Eye size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                    {canFloristaQuickState ? (
                      <>
                        <button
                          type="button"
                          className="btn-outline"
                          title="Ver detalle del arreglo"
                          onClick={() => openActionsDrawer(item)}
                        >
                          Ver detalle
                        </button>
                        {canChangeOwnProductionState(item) && nextFloristaStatus(item.estado) ? (
                          <button
                            type="button"
                            className="btn-outline"
                            title="Actualizar estado de producción"
                            onClick={() => cambiarEstadoFloristaRapido(item)}
                          >
                            {nextFloristaLabel(item.estado)}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        {canManageProductionActions && submenu === "disponibilidad" && (
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

        {canManageProductionActions && submenu === "incapacidad" && (
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

        {canManageProductionActions && submenu === "looker" && (
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

      <div className={`production-drawer-backdrop ${drawerOpen && submenu === "pedidos" ? "open" : ""}`} aria-hidden="true" />

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

              {!canManageProductionActions ? (
              <section className="order-block production-action-card production-assignment-card">
                <div className="production-detail-section-title">
                  <Flower2 size={17} strokeWidth={2} aria-hidden="true" />
                  <strong>Asignar / reasignar florista</strong>
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
                  <button type="button" className="btn-outline" title="Asignar o reasignar florista" onClick={() => reasignarAuditable(selectedItem)}>
                    Asignar / reasignar
                  </button>
                </div>
              </section>
              ) : null}

              {!canManageProductionActions ? (
              <section className="order-block production-action-card">
                <div className="production-detail-section-title">
                  <User size={17} strokeWidth={2} aria-hidden="true" />
                  <strong>Estado de florista</strong>
                </div>
                <div className="order-actions production-drawer-actions">
                  <span className={`order-badge ${isFloristaActivo(ownFloristaDisponibilidad) ? "is-entregado" : "is-cancelado"}`}>
                    {isFloristaActivo(ownFloristaDisponibilidad) ? "Activo" : "Inactivo"}
                  </span>
                  <button type="button" className="btn-outline" onClick={toggleEstadoFloristaPropio} title="Cambiar disponibilidad del florista">
                    {isFloristaActivo(ownFloristaDisponibilidad) ? "Inactivar" : "Activar"}
                  </button>
                </div>
              </section>
              ) : null}

              {canManageStateAndRecalculate ? (
                <>
                  <section className="order-block">
                    <h4> Estado</h4>
                    <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <select
                        value={selectedEstadoById[productionSelectionKey(selectedItem)] || ""}
                        onChange={event => setSelectedEstadoById(current => ({ ...current, [productionSelectionKey(selectedItem)]: event.target.value }))}
                        title="Seleccionar nuevo estado"
                      >
                        <option value="">Estado...</option>
                        {ESTADOS_UI.filter(state => normalizeStatus(state) !== normalizeStatus(selectedItem.estado)).map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-outline" title="Aplicar cambio de estado" onClick={() => cambiarEstado(selectedItem)}>Cambiar estado</button>
                    </div>
                  </section>

                  <section className="order-block">
                    <h4>ï¸ Recalcular pedido</h4>
                    <button type="button" className="btn-outline" title="Recalcular impacto del pedido" onClick={() => recalcularPedido(selectedItem)}>
                      Recalcular producción
                    </button>
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



