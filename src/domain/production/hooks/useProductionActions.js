/*
 * Hook de acciones de produccion.
 * Agrupa mutaciones contra API: asignar, reasignar, cambiar estado, recalcular,
 * actualizar floristas y abrir/cerrar drawers coordinando el refresco de datos.
 */
import { useCallback } from "react";
import {
  buildVisibleProductionItems,
  hasAssignedFlorista,
  isFloristaActivo,
  nextFloristaStatus,
  productionSelectionKey,
  resolveProgrammedDate,
  todayIsoDate,
} from "../productionDomain.js";

function productionQuickStateTargets(item) {
  const groupedItems = Array.isArray(item?.produccionItemsAgrupados) && item.produccionItemsAgrupados.length > 0
    ? item.produccionItemsAgrupados
    : [item];
  return groupedItems
    .map(productionItem => ({
      produccionId: productionItem?.idProduccion,
      nuevoEstado: nextFloristaStatus(productionItem?.estado),
    }))
    .filter(target => target.produccionId != null && target.nuevoEstado);
}

function productionStateErrorMessage(error) {
  if (error?.status === 403) {
    return "El backend rechazó el cambio de estado para este rol. Debe habilitarse el permiso del rol en el endpoint de producción.";
  }
  return "No fue posible cambiar el estado.";
}

export function useProductionActions({
  api,
  assignmentDrawerOpen,
  busquedaGeneral,
  canChangeOwnProductionState,
  canManageProductionActions,
  currentFloristaId,
  currentFloristaName,
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
}) {
  const refreshAll = useCallback(async () => {
    await Promise.all([loadItems(), loadFloristaData()]);
  }, [loadItems, loadFloristaData]);

  const onChangeSoloMisAsignados = useCallback(checked => {
    setSoloMisAsignados(checked);
  }, [setSoloMisAsignados]);

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
      fechaProgramadaProduccion: item.fechaProgramadaProduccion || item.fechaEntrega || null,
    })));

    return {
      encontrados: candidates.length,
      asignados: results.filter(item => item.status === "fulfilled").length,
    };
  }, [api]);

  const generarDesdePedidos = useCallback(async () => {
    try {
      await api.generarProduccionDesdePedidos({
        empresaId,
        sucursalId,
        diasAnticipacion: 1,
        autoAsignar: false,
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
  }, [api, empresaId, sucursalId, loadItems, autoAsignarPedidosDeHoy, refreshAll]);

  const openActionsDrawer = useCallback(item => {
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
    setAssignmentDrawerOpen(false);
    setAssignmentItem(null);
    setMotivoAccion("");
  }, [canManageProductionActions, currentFloristaId, setAssignmentDrawerOpen, setAssignmentItem, setDrawerOpen, setFloristaGestionID, setMotivoAccion, setSelectedFloristaById, setSelectedItem]);

  const closeActionsDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedItem(null);
  }, [setDrawerOpen, setSelectedItem]);

  const openAssignmentDrawer = useCallback(item => {
    if (!item) return;
    const itemKey = productionSelectionKey(item);
    setAssignmentItem(item);
    setSelectedFloristaById(current => ({
      ...current,
      [itemKey]: current[itemKey] || (item.floristaID != null ? String(item.floristaID) : (!canManageProductionActions && currentFloristaId != null ? String(currentFloristaId) : "")),
    }));
    setAssignmentDrawerOpen(true);
    setDrawerOpen(false);
    setSelectedItem(null);
  }, [canManageProductionActions, currentFloristaId, setAssignmentDrawerOpen, setAssignmentItem, setDrawerOpen, setSelectedFloristaById, setSelectedItem]);

  const closeAssignmentDrawer = useCallback(() => {
    setAssignmentDrawerOpen(false);
    setAssignmentItem(null);
  }, [setAssignmentDrawerOpen, setAssignmentItem]);

  const updateSelectedFlorista = useCallback((item, floristaId) => {
    setSelectedFloristaById(current => ({
      ...current,
      [productionSelectionKey(item)]: floristaId,
    }));
  }, [setSelectedFloristaById]);

  const updateSelectedEstado = useCallback((item, estado) => {
    setSelectedEstadoById(current => ({
      ...current,
      [productionSelectionKey(item)]: estado,
    }));
  }, [setSelectedEstadoById]);

  const refreshAndKeepSelection = useCallback(async item => {
    const nextItems = await loadItems();
    const nextVisible = buildVisibleProductionItems(nextItems, currentFloristaId, busquedaGeneral, soloMisAsignados, true, currentFloristaName);
    const nextSelected = nextVisible.find(candidate => Number(candidate.pedidoID) === Number(item.pedidoID));
    if (nextSelected) {
      if (assignmentDrawerOpen) {
        setAssignmentItem(nextSelected);
        return;
      }
      if (drawerOpen) {
        setSelectedItem(nextSelected);
        setDrawerOpen(true);
        return;
      }
      return;
    }
    closeActionsDrawer();
    closeAssignmentDrawer();
  }, [assignmentDrawerOpen, busquedaGeneral, closeActionsDrawer, closeAssignmentDrawer, currentFloristaId, currentFloristaName, drawerOpen, loadItems, setAssignmentItem, setDrawerOpen, setSelectedItem, soloMisAsignados]);

  const asignar = useCallback(async item => {
    const itemKey = productionSelectionKey(item);
    const floristaId = selectedFloristaById[itemKey];
    const produccionIds = Array.isArray(item.produccionIds) && item.produccionIds.length > 0
      ? item.produccionIds
      : [item.idProduccion];

    try {
      await Promise.all(produccionIds.map(produccionId => api.asignarProduccion({
        produccionId,
        floristaId: floristaId ? Number(floristaId) : null,
        fechaProgramadaProduccion: item.fechaProgramadaProduccion,
      })));
      await refreshAndKeepSelection(item);
    } catch (nextError) {
      console.error("Error asignando producción:", nextError);
      globalThis.alert("No fue posible asignar el florista.");
    }
  }, [api, refreshAndKeepSelection, selectedFloristaById]);

  const reasignarAuditable = useCallback(async item => {
    const itemKey = productionSelectionKey(item);
    const floristaNuevoId = selectedFloristaById[itemKey] || (!canManageProductionActions && currentFloristaId != null ? String(currentFloristaId) : null);
    const motivo = "Reasignación desde panel de producción";
    const produccionIds = Array.isArray(item.produccionIds) && item.produccionIds.length > 0
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
        usuarioCambio,
      })));
      await refreshAndKeepSelection(item);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error reasignando florista:", nextError);
      globalThis.alert("No fue posible reasignar el florista.");
    }
  }, [api, canManageProductionActions, currentFloristaId, refreshAndKeepSelection, selectedFloristaById, setMotivoAccion, usuarioCambio]);

  const cambiarEstado = useCallback(async item => {
    const itemKey = productionSelectionKey(item);
    const nuevoEstado = selectedEstadoById[itemKey];
    const produccionIds = Array.isArray(item.produccionIds) && item.produccionIds.length > 0
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
        observacionesInternas: motivoAccion || null,
        usuarioCambio,
        origenCambio: canManageProductionActions ? "administrador" : "panel_estado",
        cambioAdministrativo: canManageProductionActions,
      })));
      await refreshAndKeepSelection(item);
      setMotivoAccion("");
    } catch (nextError) {
      console.error("Error cambiando estado:", nextError);
      globalThis.alert(productionStateErrorMessage(nextError));
    }
  }, [api, canManageProductionActions, motivoAccion, refreshAndKeepSelection, selectedEstadoById, setMotivoAccion, usuarioCambio]);

  const cambiarEstadoFloristaRapido = useCallback(async item => {
    const targets = productionQuickStateTargets(item);
    if (targets.length === 0) return;
    if (!canManageProductionActions && !item.floristaAsignado) {
      globalThis.alert("No puedes cambiar estado sin florista asignado.");
      return;
    }
    if (!canChangeOwnProductionState(item)) {
      globalThis.alert("Solo puedes cambiar el estado de tus propios pedidos asignados.");
      return;
    }

    try {
      await Promise.all(targets.map(target => api.cambiarEstadoProduccion({
        produccionId: target.produccionId,
        nuevoEstado: target.nuevoEstado,
        observacionesInternas: canManageProductionActions
          ? "Cambio de estado desde panel administrador"
          : "Cambio de estado desde panel florista",
        usuarioCambio,
        origenCambio: canManageProductionActions ? "administrador" : "florista",
        cambioAdministrativo: canManageProductionActions,
      })));
      await refreshAndKeepSelection(item);
    } catch (nextError) {
      console.error("Error cambiando estado rápido de florista:", nextError);
      globalThis.alert(productionStateErrorMessage(nextError));
    }
  }, [api, canChangeOwnProductionState, canManageProductionActions, refreshAndKeepSelection, usuarioCambio]);

  const recalcularPedido = useCallback(async item => {
    try {
      await api.recalcularProduccionPedido({
        pedidoId: item.pedidoID,
        usuarioCambio,
        motivo: motivoAccion || "Recalculo desde front",
        productoEstructuralCambiado: false,
        forceCancelarYCrearNueva: false,
      });
      await refreshAndKeepSelection(item);
    } catch (nextError) {
      console.error("Error recalculando producción por pedido:", nextError);
      globalThis.alert("No fue posible recalcular la producción del pedido.");
    }
  }, [api, motivoAccion, refreshAndKeepSelection, usuarioCambio]);

  const actualizarEstadoFlorista = useCallback(async () => {
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
        usuarioCambio,
      });
      await refreshAll();
      globalThis.alert("Estado del florista actualizado.");
    } catch (nextError) {
      console.error("Error actualizando estado del florista:", nextError);
      globalThis.alert("No fue posible actualizar el estado del florista.");
    }
  }, [api, fechaFinIncapacidad, fechaInicioIncapacidad, floristaEstado, floristaGestionID, motivoAccion, refreshAll, usuarioCambio]);

  const actualizarDisponibilidadFlorista = useCallback(async (floristaId, estadoObjetivo) => {
    try {
      await api.actualizarEstadoFlorista({
        floristaId: Number(floristaId),
        estado: estadoObjetivo,
        fechaInicioIncapacidad: null,
        fechaFinIncapacidad: null,
        motivo: `Cambio rápido a ${estadoObjetivo} desde disponibilidad florista`,
        usuarioCambio,
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error actualizando disponibilidad del florista:", nextError);
      globalThis.alert("No fue posible actualizar la disponibilidad del florista.");
    }
  }, [api, refreshAll, usuarioCambio]);

  const toggleDisponibilidadFlorista = useCallback(async item => {
    if (!item.idFlorista) return;
    const estadoObjetivo = isFloristaActivo(item) ? "Inactivo" : "Activo";
    await actualizarDisponibilidadFlorista(item.idFlorista, estadoObjetivo);
  }, [actualizarDisponibilidadFlorista]);

  const toggleEstadoFloristaPropio = useCallback(async () => {
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
        usuarioCambio,
      });
      await refreshAll();
    } catch (nextError) {
      console.error("Error alternando estado del florista:", nextError);
      globalThis.alert("No fue posible actualizar el estado del florista.");
    }
  }, [api, currentFloristaId, ownFloristaDisponibilidad, refreshAll, usuarioCambio]);

  return {
    actualizarEstadoFlorista,
    asignar,
    cambiarEstado,
    cambiarEstadoFloristaRapido,
    closeActionsDrawer,
    closeAssignmentDrawer,
    generarDesdePedidos,
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
  };
}
