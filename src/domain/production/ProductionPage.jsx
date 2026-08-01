/*
 * Orquestador del modulo de produccion.
 * Conecta permisos, estado raiz, hooks de datos/acciones y componentes visuales.
 * La logica pesada vive en hooks, helpers de dominio y componentes del mismo modulo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { useProductionItems } from "./hooks/useProductionItems.js";
import { useProductionImages } from "./hooks/useProductionImages.js";
import { useProductionFloristas } from "./hooks/useProductionFloristas.js";
import { useProductionListView } from "./hooks/useProductionListView.js";
import { useProductionActions } from "./hooks/useProductionActions.js";
import {
  DEFAULT_PRODUCTION_USER,
  ESTADOS_FILTRO_DEFAULT,
  SUBMENU_OPTIONS,
} from "./productionConstants.js";
import {
  ProductionAvailabilityPanel,
  ProductionIncapacityPanel,
  ProductionLookerPanel,
} from "./components/ProductionSecondaryPanels.jsx";
import { ProductionHeader } from "./components/ProductionHeader.jsx";
import { ProductionOrdersView } from "./components/ProductionOrdersView.jsx";
import {
  ProductionAssignmentDrawer,
  ProductionDetailDrawer,
} from "./components/ProductionDrawers.jsx";
import {
  extractListPayloadItems,
  flattenPipelineCards,
  isCanceledProductionStatus,
  matchesProductionMetric,
  mergeProductionItemsByOrder,
  normalizeProductionItemStatus,
  normalizeProductionStatusKey,
  normalizeRole,
  normalizeSearchText,
  productionBackendStatusFilter,
  productionItemFromCanceledOrder,
  productionItemMatchesSearch,
  shouldIncludeCanceledProduction,
  todayIsoDate,
  toIsoDate,
} from "./productionDomain.js";
export {
  resolveDetailProductionImageUrl,
  resolvePedidoListProductionImageUrl,
  resolvePipelineProductionImageUrl,
  resolveProductionProduct,
} from "./productionCatalogImages.js";
export {
  buildVisibleProductionItems,
  catalogCodeCandidates,
  deliveryTimingStatus,
  ESTADOS_UI,
  isProductionReadyForDelivery,
  nextFloristaStatus,
  normalizeProductionItemStatus,
  productCodeCandidates,
  productionBackendStatusFilter,
  productionItemFromCanceledOrder,
  productionItemMatchesSearch,
  productionSelectedStatusKey,
  productionStateActionClass,
  shouldIncludeCanceledProduction,
  shouldShowFloristaStateAction,
} from "./productionDomain.js";
export function ProductionPage({ session, canViewPipeline, canViewPedidos, canViewCatalogo, canViewProduccion, canViewDomicilios, canViewBarrios, canViewInventario, canViewContabilidad, canViewTrazabilidad, canViewClientesPanel, canViewUsuariosPanel, onLogout, onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario, onGoContabilidad, onGoTrazabilidad, onGoClientes, onGoUsuarios }) {
  const safeSession = session || {};
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(safeSession.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(safeSession.sucursalID || tenantConfig.sucursalId);
  const normalizedRole = normalizeRole(safeSession.rol);
  const isSuperAdmin = Boolean(safeSession.esGlobalJoin) || ["super_admin", "join_superadmin"].includes(normalizedRole);
  const canManageProductionActions = Boolean(safeSession.esGlobalJoin) || ["admin", "empresa_admin"].includes(normalizedRole);
  const canManageStateAndRecalculate = isSuperAdmin;
  const canFloristaQuickState = !canManageProductionActions;
  const canUseQuickProductionState = canManageProductionActions || canFloristaQuickState;
  const canResolveProductionImages = Boolean(canViewProduccion);
  const displayUserName = useMemo(
    () => String(safeSession.nombre || safeSession.login || "Usuario").trim() || "Usuario",
    [safeSession]
  );
  const visibleSubmenuOptions = useMemo(
    () => (canManageProductionActions ? SUBMENU_OPTIONS : [{ key: "pedidos", label: "Pedidos" }]),
    [canManageProductionActions]
  );

  const [fecha, setFecha] = useState(todayIsoDate());
  const [estadosFiltro, setEstadosFiltro] = useState(ESTADOS_FILTRO_DEFAULT);
  const {
    canChangeOwnProductionState,
    currentFloristaId,
    floristas,
    floristasDisponibilidad,
    loadFloristaData,
    ownFloristaDisponibilidad,
  } = useProductionFloristas({
    api,
    canFloristaQuickState,
    empresaId,
    session: safeSession,
    sucursalId,
  });
  const canChangeProductionState = useCallback(
    item => canManageProductionActions || canChangeOwnProductionState(item),
    [canChangeOwnProductionState, canManageProductionActions]
  );
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productionProductImages, setProductionProductImages] = useState({});
  const [selectedFloristaById, setSelectedFloristaById] = useState({});
  const [selectedEstadoById, setSelectedEstadoById] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assignmentItem, setAssignmentItem] = useState(null);
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false);

  const [usuarioCambio] = useState(() => String(safeSession.email || safeSession.nombre || DEFAULT_PRODUCTION_USER));
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
  const [productionPage, setProductionPage] = useState(1);
  const [productionPageSize, setProductionPageSize] = useState(10);
  const productionListRef = useRef(null);
  const productionMenuRef = useRef(null);

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  useEffect(() => {
    if (!productionMenuOpen) return undefined;
    const handlePointerDown = event => {
      if (productionMenuRef.current.contains(event.target)) return;
      setProductionMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [productionMenuOpen]);

  const searchOverridesFilters = useMemo(
    () => normalizeSearchText(busquedaGeneral).length > 0,
    [busquedaGeneral]
  );
  const productionLoadRules = useMemo(() => ({
    extractListPayloadItems,
    flattenPipelineCards,
    isCanceledProductionStatus,
    matchesProductionMetric,
    mergeProductionItemsByOrder,
    normalizeProductionItemStatus,
    normalizeProductionStatusKey,
    productionBackendStatusFilter,
    productionItemFromCanceledOrder,
    productionItemMatchesSearch,
    shouldIncludeCanceledProduction,
    toIsoDate,
  }), []);
  const {
    items,
    loading,
    error,
    productionMetricas,
    loadItems,
  } = useProductionItems({
    api,
    empresaId,
    sucursalId,
    fecha,
    estadosFiltro,
    activeMetricFilter,
    searchOverridesFilters,
    busquedaGeneral,
    canLoadCanceledOrders: Boolean(canViewPedidos),
    rules: productionLoadRules,
  });
  const {
    activeMetricMeta,
    focusedVisibleItems,
    focusMetric,
    metrics,
    paginatedProductionItems,
    productionPages,
    productionPagerItems,
    productionTotal,
    productionVisibleFrom,
    productionVisibleTo,
    selectAllProductionStatuses,
    selectedStatusKey,
    toggleEstadoFiltro,
    visibleItems,
  } = useProductionListView({
    activeMetricFilter,
    busquedaGeneral,
    currentFloristaId,
    currentFloristaName: ownFloristaDisponibilidad?.nombre || displayUserName,
    estadosFiltro,
    fecha,
    items,
    productionListRef,
    productionMetricas,
    productionPage,
    productionPageSize,
    setActiveMetricFilter,
    setBusquedaGeneral,
    setEstadosFiltro,
    setFecha,
    setProductionPage,
    setSubmenu,
    soloMisAsignados,
  });

  const { catalogProductIndex } = useProductionImages({
    api,
    catalogProducts,
    canManageProductionActions,
    canResolveProductionImages,
    canViewCatalogo,
    canViewPedidos,
    canViewPipeline,
    empresaId,
    focusedVisibleItems,
    items,
    productionProductImages,
    setCatalogProducts,
    setProductionProductImages,
    sucursalId,
  });

  const changeProductionSearch = useCallback(value => {
    setActiveMetricFilter(null);
    setBusquedaGeneral(value);
  }, []);

  const toggleProductionMenu = useCallback(nextOpen => {
    setProductionMenuOpen(current => typeof nextOpen === "boolean" ? nextOpen : !current);
  }, []);

  const changeSubmenu = useCallback(nextSubmenu => {
    setSubmenu(nextSubmenu);
    setProductionMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!floristaGestionID && floristas.length > 0) {
      setFloristaGestionID(String(floristas[0].idFlorista));
    }
  }, [floristaGestionID, floristas]);

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


  const {
    actualizarEstadoFlorista,
    asignar,
    cambiarEstado,
    cambiarEstadoFloristaRapido,
    closeActionsDrawer,
    closeAssignmentDrawer,
    onChangeSoloMisAsignados,
    openActionsDrawer,
    openAssignmentDrawer,
    reasignarAuditable,
    recalcularPedido,
    refreshAll,
    toggleDisponibilidadFlorista,
    toggleEstadoFloristaPropio,
    updateSelectedEstado,
    updateSelectedFlorista,
  } = useProductionActions({
    api,
    assignmentDrawerOpen,
    busquedaGeneral,
    canChangeOwnProductionState: canChangeProductionState,
    canManageProductionActions,
    currentFloristaId,
    currentFloristaName: ownFloristaDisponibilidad?.nombre || displayUserName,
    drawerOpen,
    empresaId,
    fechaFinIncapacidad,
    fechaInicioIncapacidad,
    floristaEstado,
    floristaGestionID,
    loadFloristaData,
    loadItems,
    motivoAccion,
    ownFloristaDisponibilidad,
    selectedEstadoById,
    selectedFloristaById,
    setAssignmentDrawerOpen,
    setAssignmentItem,
    setDrawerOpen,
    setFloristaGestionID,
    setMotivoAccion,
    setSelectedEstadoById,
    setSelectedFloristaById,
    setSelectedItem,
    setSoloMisAsignados,
    soloMisAsignados,
    sucursalId,
    usuarioCambio,
  });

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
          produccion: () => {
            onGoProduccion();
            setSubmenu("pedidos");
          },
          domicilios: onGoDomicilios,
          barrios: onGoBarrios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
        sessionLabel={`Sesión activa: ${displayUserName}`}
      />

      <main className="orders-admin-view production-page-view">
        <ProductionHeader
          activeMetricFilter={activeMetricFilter}
          busquedaGeneral={busquedaGeneral}
          metrics={metrics}
          productionMenuOpen={productionMenuOpen}
          productionMenuRef={productionMenuRef}
          submenu={submenu}
          visibleSubmenuOptions={visibleSubmenuOptions}
          onFocusMetric={focusMetric}
          onRefreshAll={refreshAll}
          onSearchChange={changeProductionSearch}
          onSubmenuChange={changeSubmenu}
          onToggleProductionMenu={toggleProductionMenu}
        />

        <span ref={productionListRef} className="production-list-anchor" aria-hidden="true" />

        {submenu === "pedidos" && (
          <ProductionOrdersView
            apiBaseUrl={tenantConfig.apiBaseUrl}
            activeMetricFilter={activeMetricFilter}
            busquedaGeneral={busquedaGeneral}
            canChangeOwnProductionState={canChangeProductionState}
            canFloristaQuickState={canFloristaQuickState}
            canUseQuickProductionState={canUseQuickProductionState}
            canManageProductionActions={canManageProductionActions}
            catalogProductIndex={catalogProductIndex}
            currentFloristaId={currentFloristaId}
            empresaId={empresaId}
            error={error}
            fecha={fecha}
            focusedVisibleItems={focusedVisibleItems}
            loading={loading}
            metrics={metrics}
            ownFloristaDisponibilidad={ownFloristaDisponibilidad}
            paginatedProductionItems={paginatedProductionItems}
            productionPage={productionPage}
            productionPageSize={productionPageSize}
            productionPages={productionPages}
            productionPagerItems={productionPagerItems}
            productionProductImages={productionProductImages}
            productionTotal={productionTotal}
            productionVisibleFrom={productionVisibleFrom}
            productionVisibleTo={productionVisibleTo}
            selectedStatusKey={selectedStatusKey}
            soloMisAsignados={soloMisAsignados}
            onCambiarEstadoFloristaRapido={cambiarEstadoFloristaRapido}
            onChangeFecha={value => {
              setActiveMetricFilter(null);
              setFecha(value);
            }}
            onChangePage={setProductionPage}
            onChangePageSize={setProductionPageSize}
            onChangeSearch={value => {
              setActiveMetricFilter(null);
              setBusquedaGeneral(value);
            }}
            onChangeSoloMisAsignados={onChangeSoloMisAsignados}
            onFocusMetric={focusMetric}
            onOpenActionsDrawer={openActionsDrawer}
            onOpenAssignmentDrawer={openAssignmentDrawer}
            onRefreshAll={refreshAll}
            onSelectAllProductionStatuses={selectAllProductionStatuses}
            onToggleEstadoFiltro={toggleEstadoFiltro}
            onToggleEstadoFloristaPropio={toggleEstadoFloristaPropio}
          />
        )}

        {canManageProductionActions && submenu === "disponibilidad" && (
          <ProductionAvailabilityPanel
            floristasDisponibilidad={floristasDisponibilidad}
            onToggleDisponibilidadFlorista={toggleDisponibilidadFlorista}
          />
        )}

        {canManageProductionActions && submenu === "incapacidad" && (
          <ProductionIncapacityPanel
            floristas={floristas}
            floristasDisponibilidad={floristasDisponibilidad}
            floristaGestionID={floristaGestionID}
            floristaEstado={floristaEstado}
            fechaInicioIncapacidad={fechaInicioIncapacidad}
            fechaFinIncapacidad={fechaFinIncapacidad}
            motivoAccion={motivoAccion}
            onActualizarEstadoFlorista={actualizarEstadoFlorista}
            onFloristaGestionChange={setFloristaGestionID}
            onFloristaEstadoChange={setFloristaEstado}
            onFechaInicioChange={setFechaInicioIncapacidad}
            onFechaFinChange={setFechaFinIncapacidad}
            onMotivoChange={setMotivoAccion}
            onClearMotivo={() => setMotivoAccion("")}
          />
        )}

        {canManageProductionActions && submenu === "looker" && (
          <ProductionLookerPanel />
        )}
      </main>

      <div className={`production-drawer-backdrop ${(drawerOpen || assignmentDrawerOpen) && submenu === "pedidos" ? "open" : ""}`} aria-hidden="true" />

      {ProductionDetailDrawer({
        open: drawerOpen,
        item: selectedItem,
        visible: submenu === "pedidos",
        apiBaseUrl: tenantConfig.apiBaseUrl,
        catalogProductIndex,
        productionProductImages,
        empresaId,
        floristas,
        selectedFloristaById,
        selectedEstadoById,
        canManageProductionActions,
        canManageStateAndRecalculate,
        onClose: closeActionsDrawer,
        onSelectedFloristaChange: updateSelectedFlorista,
        onSelectedEstadoChange: updateSelectedEstado,
        onAsignar: asignar,
        onReasignar: reasignarAuditable,
        onCambiarEstado: cambiarEstado,
        onRecalcularPedido: recalcularPedido,
      })}

      {ProductionAssignmentDrawer({
        open: assignmentDrawerOpen,
        item: assignmentItem,
        visible: submenu === "pedidos",
        floristas,
        selectedFloristaById,
        onClose: closeAssignmentDrawer,
        onSelectedFloristaChange: updateSelectedFlorista,
        onReasignar: reasignarAuditable,
      })}
    </div>
  );
}



