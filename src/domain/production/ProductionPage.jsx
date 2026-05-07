import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatDateOnly, formatDateTimeCompact, normalizeStatus } from "../../shared/utils.js";
import {
  IconAdjustments,
  IconCalendarPlus,
  IconRefresh,
  IconReload,
  IconX,
} from "@tabler/icons-react";

const ESTADOS_UI = ["Pendiente", "EnProduccion", "ParaEntrega", "Cancelado"];
const ESTADOS_FILTRO_DEFAULT = ["Pendiente", "EnProduccion"];
const ESTADOS_FLORISTA = ["Activo", "Inactivo", "Incapacidad"];
const ESTADOS_FLORISTA_BASICOS = ["Activo", "Inactivo"];
const DEFAULT_USER = "admin.demo";
const LOOKER_STUDIO_URL = "https://lookerstudio.google.com/embed/reporting/d08a04af-ed8e-4dde-a83c-90888bfde39d/page/p_mp7qxa6dzd";
const SUBMENU_OPTIONS = [
  { key: "pedidos", label: "Pedidos" },
  { key: "historial", label: "Historial reasignaciones" },
  { key: "disponibilidad", label: "Disponibilidad florista" },
  { key: "incapacidad", label: "Gestión incapacidad" },
  { key: "looker", label: "Looker" }
];

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

function hasAssignedFlorista(item) {
  if (item?.floristaID != null && item?.floristaID !== "") return true;
  return String(item?.floristaAsignado || "").trim().length > 0;
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

function sanitizeHistoryText(value) {
  return String(value || "")
    .replaceAll("Â·", "-")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã", "Á")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã", "Í")
    .replaceAll("Ã“", "Ó")
    .replaceAll("Ãš", "Ú")
    .trim();
}

function formatHistoryActor(value) {
  const raw = sanitizeHistoryText(value);
  if (!raw) return "-";
  return raw.replace(/\./g, " · ");
}

function formatHistoryReason(value) {
  return sanitizeHistoryText(value) || "-";
}

function resolveHistoryTypeLabel(motivo, actor) {
  const reason = sanitizeHistoryText(motivo).toLowerCase();
  const who = sanitizeHistoryText(actor).toLowerCase();
  if (reason.includes("auto") || reason.includes("autom")) return "Auto";
  if (who.includes("admin") || reason.includes("admin")) return "Admin";
  return "Reasignación";
}

function resolveHistoryTypeClass(motivo, actor) {
  const label = resolveHistoryTypeLabel(motivo, actor);
  if (label === "Auto") return "is-auto";
  if (label === "Admin") return "is-admin";
  return "is-reassignment";
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
  const visibleSubmenuOptions = useMemo(
    () => (canManageProductionActions ? SUBMENU_OPTIONS : [{ key: "pedidos", label: "Pedidos" }]),
    [canManageProductionActions]
  );

  const [fecha, setFecha] = useState("");
  const [estadosFiltro, setEstadosFiltro] = useState(ESTADOS_FILTRO_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
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

  const [metricasDesde, setMetricasDesde] = useState(todayIsoDate());
  const [metricasHasta, setMetricasHasta] = useState(todayIsoDate());
  const [historial, setHistorial] = useState([]);
  const [submenu, setSubmenu] = useState("pedidos");
  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [soloMisAsignados, setSoloMisAsignados] = useState(!canManageProductionActions);

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

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

  const visibleItems = useMemo(() => {
    const search = normalizeSearchText(busquedaGeneral);
    return items.filter(item => {
      if (soloMisAsignados && currentFloristaId != null && Number(item?.floristaID) !== Number(currentFloristaId)) {
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
  }, [items, currentFloristaId, busquedaGeneral, soloMisAsignados]);

  const toggleEstadoFiltro = useCallback((estadoItem) => {
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [produccion, floristasData, disponibilidadData] = await Promise.all([
        api.listarProduccion({
          empresaId,
          sucursalId,
          fecha,
          estado: undefined,
          incluirCancelado: false
        }),
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

      const nextItemsRaw = Array.isArray(produccion.items) ? produccion.items : [];
      const nextItems = nextItemsRaw.filter(item =>
        estadosFiltro.some(estadoItem => normalizeStatus(estadoItem) === normalizeStatus(item.estado))
      );
      const nextFloristas = Array.isArray(floristasData.items) ? floristasData.items : [];
      const nextFloristasDisponibilidad = Array.isArray(disponibilidadData.items) ? disponibilidadData.items : [];

      setItems(nextItems);
      setFloristas(nextFloristas);
      setFloristasDisponibilidad(nextFloristasDisponibilidad);
      if (!floristaGestionID && nextFloristas.length > 0) {
        setFloristaGestionID(String(nextFloristas[0].idFlorista));
      }
      setError("");
      return nextItems;
    } catch (nextError) {
      console.error("Error cargando producción:", nextError);
      setItems([]);
      setFloristas([]);
      setFloristasDisponibilidad([]);
      setError("No fue posible cargar el módulo de producción.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [api, fecha, estadosFiltro, floristaGestionID, empresaId, sucursalId]);

  const loadInsights = useCallback(async () => {
    try {
      const hist = await api.obtenerHistorialReasignaciones({
        empresaId,
        sucursalId,
        fechaDesde: metricasDesde,
        fechaHasta: metricasHasta
      });

      setHistorial(Array.isArray(hist.items) ? hist.items : []);
    } catch (nextError) {
      console.error("Error cargando insights de producción:", nextError);
    }
  }, [api, metricasDesde, metricasHasta, empresaId, sucursalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);


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
    await loadData();
    await loadInsights();
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
      const nextItems = await loadData();
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
    setSelectedItem(item);
    setSelectedFloristaById(current => ({
      ...current,
      [item.idProduccion]: current[item.idProduccion] || (item.floristaID != null ? String(item.floristaID) : ""),
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

  const refreshAndKeepSelection = async produccionId => {
    const nextItems = await loadData();
    await loadInsights();
    const nextSelected = nextItems.find(item => Number(item.idProduccion) === Number(produccionId));
    if (nextSelected) {
      setSelectedItem(nextSelected);
      setDrawerOpen(true);
      return;
    }
    closeActionsDrawer();
  };

  const asignar = async item => {
    const floristaId = selectedFloristaById[item.idProduccion];

    try {
      await api.asignarProduccion({
        produccionId: item.idProduccion,
        floristaId: floristaId ? Number(floristaId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion
      });
      await refreshAndKeepSelection(item.idProduccion);
    } catch (nextError) {
      console.error("Error asignando producción:", nextError);
      globalThis.alert("No fue posible asignar el florista.");
    }
  };

  const reasignarAuditable = async item => {
    const floristaNuevoId = selectedFloristaById[item.idProduccion] || null;
    const motivo = String(motivoAccion || "").trim() || "Reasignación desde panel florista";
    if (!floristaNuevoId) {
      globalThis.alert("Selecciona un florista para reasignar.");
      return;
    }
    if (canManageProductionActions && !String(motivoAccion || "").trim()) {
      globalThis.alert("Debes escribir un motivo para la reasignación auditada.");
      return;
    }

    try {
      await api.reasignarProduccion({
        produccionId: item.idProduccion,
        floristaNuevoId: floristaNuevoId ? Number(floristaNuevoId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion,
        motivo,
        usuarioCambio
      });
      await refreshAndKeepSelection(item.idProduccion);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error en reasignación auditada:", nextError);
      globalThis.alert("No fue posible realizar la reasignación auditada.");
    }
  };

  const cambiarEstado = async item => {
    const nuevoEstado = selectedEstadoById[item.idProduccion];
    if (!nuevoEstado) {
      globalThis.alert("Selecciona un estado.");
      return;
    }

    try {
      await api.cambiarEstadoProduccion({
        produccionId: item.idProduccion,
        nuevoEstado,
        observacionesInternas: motivoAccion || null
      });
      await refreshAndKeepSelection(item.idProduccion);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error cambiando estado:", nextError);
      globalThis.alert("No fue posible cambiar el estado. Verifica transición válida.");
    }
  };

  const cambiarEstadoFloristaRapido = async item => {
    const nuevoEstado = nextFloristaStatus(item?.estado);
    if (!nuevoEstado) return;
    if (!item?.floristaAsignado) {
      globalThis.alert("No puedes cambiar estado sin florista asignado.");
      return;
    }

    try {
      await api.cambiarEstadoProduccion({
        produccionId: item.idProduccion,
        nuevoEstado,
        observacionesInternas: "Cambio de estado desde panel florista"
      });
      await loadData();
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
      await refreshAndKeepSelection(item.idProduccion);
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
    if (!floristaGestionID) {
      globalThis.alert("No fue posible identificar el florista.");
      return;
    }

    const estadoObjetivo = isFloristaActivo(currentFloristaDisponibilidad) ? "Inactivo" : "Activo";

    try {
      await api.actualizarEstadoFlorista({
        floristaId: Number(floristaGestionID),
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
        <div className="production-topbar">
          <div className="production-topbar-left">
            <span className="production-topbar-title">Producción</span>
            <p className="production-topbar-description">
              {canManageProductionActions
                ? "Asignación inteligente, carga equitativa y control por fecha programada."
                : "Consulta operativa de tus pedidos asignados y su estado actual."}
            </p>
          </div>
          <div className="production-topbar-actions">
            {canManageProductionActions ? (
              <button type="button" className="btn-outline production-topbar-btn" title="Crear tareas desde pedidos aprobados/pagados" onClick={generarDesdePedidos}>
                <IconReload size={15} stroke={2} />
                <span>Sincronizar pedidos</span>
              </button>
            ) : null}
            <button type="button" className="btn-primary production-topbar-btn production-topbar-btn-primary" title="Recargar vista" onClick={refreshAll}>
              <IconRefresh size={15} stroke={2} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {canManageProductionActions ? (
          <section className="production-subtabs" aria-label="Submenu producción">
            {visibleSubmenuOptions.map(item => (
              <button
                key={item.key}
                type="button"
                className={`production-subtab ${submenu === item.key ? "is-active" : ""}`}
                onClick={() => setSubmenu(item.key)}
              >
                {item.label}
              </button>
            ))}
          </section>
        ) : null}

        {submenu === "pedidos" && (
          <>
            <section className="orders-filters orders-filters--four-col production-filters-bar">
              <label className="filter-field">
                <span>Buscar</span>
                <input
                  type="search"
                  value={busquedaGeneral}
                  onChange={event => setBusquedaGeneral(event.target.value)}
                  placeholder="Florista, cliente o pedido"
                  title="Buscar por florista, cliente o número de pedido"
                />
              </label>
              <div className="filter-field">
                <span>Fecha Inicio</span>
                <input type="date" value={fecha} onChange={event => setFecha(event.target.value)} title="Filtrar por fecha programada" />
              </div>
              <label className="filter-field">
                <span>Estado</span>
                <details className="estado-filtro-dropdown">
                  <summary className="estado-filtro-summary">
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
            {!loading && !error && visibleItems.length === 0 ? <p className="orders-message">No hay arreglos que coincidan con los filtros seleccionados.</p> : null}

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
                    <th>Tiempo restante</th>
                    <th>Estimado/Real (min)</th>
                    <th>Prioridad</th>
                    {canManageProductionActions ? <th>Acciones Domicilios</th> : null}
                    {canFloristaQuickState ? <th>Acción</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map(item => (
                    <tr key={item.idProduccion}>
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
                          <span className="production-florista-name">{item.floristaAsignado}</span>
                        ) : (
                          <span className="production-florista-empty">Sin asignar</span>
                        )}
                      </td>
                      <td><span className={`order-badge ${statusBadgeClass(item.estado)}`}>{item.estado || "-"}</span></td>
                      <td>{formatDateTimeCompact(item.fechaAsignacion) || "-"}</td>
                      <td className={typeof item.tiempoRestanteHoras === "number" && item.tiempoRestanteHoras < 0 ? "is-overdue" : ""}>
                        {typeof item.tiempoRestanteHoras === "number" ? `${item.tiempoRestanteHoras} h` : "-"}
                      </td>
                      <td>{`${item.tiempoEstimadoMin ?? "-"} / ${item.tiempoRealMin ?? "-"}`}</td>
                      <td>{item.prioridad || "MEDIA"}</td>
                      {canManageProductionActions ? (
                        <td>
                          <button type="button" className="btn-outline production-actions-btn" title="Abrir barra lateral de acciones" onClick={() => openActionsDrawer(item)}>
                            Ver acciones
                          </button>
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
                            {nextFloristaStatus(item.estado) ? (
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
                  ))}
                </tbody>
              </table>
            </section>

            <section className="production-capsules" aria-label="Pedidos en cápsulas">
              {visibleItems.map(item => (
                <article key={`cap-${item.idProduccion}`} className="production-capsule">
                  <header className="production-capsule-head">
                    <strong>{item.numeroPedido ?? "-"}</strong>
                    <span className={`order-badge ${statusBadgeClass(item.estado)}`}>{item.estado || "-"}</span>
                  </header>

                  <div className="production-capsule-grid">
                    <p><span>Producto</span><strong>{item.producto || "-"}</strong></p>
                    <p><span>Cliente</span><strong>{item.cliente || "-"}</strong></p>
                    <p><span>Fecha entrega</span><strong>{formatDateOnly(item.fechaEntrega) || "-"}</strong></p>
                    <p><span>Hora entrega</span><strong>{item.horaEntrega || "-"}</strong></p>
                    <p><span>Florista</span><strong>{item.floristaAsignado || "Sin asignar"}</strong></p>
                    <p><span>Asignación</span><strong>{formatDateTimeCompact(item.fechaAsignacion) || "-"}</strong></p>
                    <p><span>Tiempo</span><strong>{typeof item.tiempoRestanteHoras === "number" ? `${item.tiempoRestanteHoras} h` : "-"}</strong></p>
                    <p><span>Estimado/Real</span><strong>{`${item.tiempoEstimadoMin ?? "-"} / ${item.tiempoRealMin ?? "-"}`}</strong></p>
                    <p><span>Prioridad</span><strong>{item.prioridad || "MEDIA"}</strong></p>
                  </div>

                  <div className="production-capsule-actions">
                      {canManageProductionActions ? (
                      <button type="button" className="btn-outline production-actions-btn" title="Abrir barra lateral de acciones" onClick={() => openActionsDrawer(item)}>
                        Ver acciones
                      </button>
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
                        {nextFloristaStatus(item.estado) ? (
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


        {canManageProductionActions && submenu === "historial" && (
          <section className="order-block production-section-card production-history-panel">
            <div className="production-section-head">
              <h4>Historial de reasignaciones</h4>
              <div className="production-history-filters">
                <input type="date" value={metricasDesde} onChange={event => setMetricasDesde(event.target.value)} title="Desde" />
                <input type="date" value={metricasHasta} onChange={event => setMetricasHasta(event.target.value)} title="Hasta" />
                <button type="button" className="btn-primary" onClick={loadInsights} title="Consultar">Consultar</button>
              </div>
            </div>
            <ul className="order-products-list production-history-list">
              {historial.length === 0 ? <li className="production-history-empty">Sin datos</li> : historial.map((item, idx) => (
                <li key={`${item.produccionID}-${item.fechaCambio}-${idx}`}>
                  <span className="production-history-copy">
                    <span className="production-history-line">
                      <strong>P{item.produccionID}</strong>
                      <span className={`production-history-tag ${resolveHistoryTypeClass(item.motivo, item.usuarioCambio)}`}>{resolveHistoryTypeLabel(item.motivo, item.usuarioCambio)}</span>
                    </span>
                    <small>{formatHistoryActor(item.usuarioCambio)}</small>
                    <em>{formatHistoryReason(item.motivo)}</em>
                  </span>
                  <strong className="production-history-date">{formatDateTimeCompact(item.fechaCambio) || "-"}</strong>
                </li>
              ))}
            </ul>
          </section>
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

      <aside className={`orders-drawer production-actions-drawer ${drawerOpen && submenu === "pedidos" ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong className="orders-drawer-title">
            <IconAdjustments size={17} stroke={2} />
            <span>{canManageProductionActions ? "Acciones Producción" : "Detalle Producción"}</span>
          </strong>
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
              <section className="order-block production-action-card">
                <h4>Ver detalle</h4>
                <p><strong>Número del pedido:</strong> {selectedItem.numeroPedido ?? "-"}</p>
                <p><strong>Cliente:</strong> {selectedItem.cliente || "-"}</p>
                <p><strong>Código o número del arreglo:</strong> {arregloCodeLabel(selectedItem)}</p>
                <p><strong>Nombre del arreglo:</strong> {selectedItem.nombreArreglo || selectedItem.producto || "-"}</p>
                <p><strong>Fecha Entrega:</strong> {formatDateOnly(selectedItem.fechaEntrega) || "-"}</p>
                <p><strong>Hora Entrega:</strong> {selectedItem.horaEntrega || "-"}</p>
                <p><strong>Estado del arreglo:</strong> {selectedItem.estado || "-"}</p>
                <p><strong>Notas Producción:</strong> {selectedItem.notasProduccion || selectedItem.observacion || "-"}</p>
                <p><strong>Observaciones personalizados:</strong> {selectedItem.observacionesPersonalizados || "-"}</p>
                <p><strong>Florista asignado:</strong> {selectedItem.floristaAsignado || "Sin asignar"}</p>
              </section>

              {canManageProductionActions ? (
              <section className="order-block production-action-card">
                <h4>Auditoría acción</h4>
                <textarea
                  value={motivoAccion}
                  onChange={event => setMotivoAccion(event.target.value)}
                  placeholder="Motivo de acción (recomendado/obligatorio para reasignar)"
                  title="Motivo"
                  rows={4}
                />
              </section>
              ) : null}

              {canManageProductionActions ? (
              <section className="order-block production-action-card">
                <h4>Asignación</h4>
                <div className="order-actions production-drawer-actions">
                  <select
                    value={selectedFloristaById[selectedItem.idProduccion] || ""}
                    onChange={event => setSelectedFloristaById(current => ({ ...current, [selectedItem.idProduccion]: event.target.value }))}
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
                  <button type="button" className="btn-outline" title="Reasignación auditada" onClick={() => reasignarAuditable(selectedItem)}>Reasignar auditado</button>
                </div>
              </section>
              ) : null}

              {!canManageProductionActions ? (
              <section className="order-block">
                <h4>👩‍🎨 Reasignar florista</h4>
                <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={selectedFloristaById[selectedItem.idProduccion] || ""}
                    onChange={event => setSelectedFloristaById(current => ({ ...current, [selectedItem.idProduccion]: event.target.value }))}
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
                  <button type="button" className="btn-outline" title="Reasignar florista" onClick={() => reasignarAuditable(selectedItem)}>
                    Reasignar florista
                  </button>
                </div>
              </section>
              ) : null}

              {!canManageProductionActions ? (
              <section className="order-block">
                <h4>Estado de florista</h4>
                <div className="order-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className={`order-badge ${isFloristaActivo(currentFloristaDisponibilidad) ? "is-entregado" : "is-cancelado"}`}>
                    {isFloristaActivo(currentFloristaDisponibilidad) ? "Activo" : "Inactivo"}
                  </span>
                  <button type="button" className="btn-outline" onClick={toggleEstadoFloristaPropio} title="Cambiar disponibilidad del florista">
                    {isFloristaActivo(currentFloristaDisponibilidad) ? "Inactivar" : "Activar"}
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
                        value={selectedEstadoById[selectedItem.idProduccion] || ""}
                        onChange={event => setSelectedEstadoById(current => ({ ...current, [selectedItem.idProduccion]: event.target.value }))}
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



