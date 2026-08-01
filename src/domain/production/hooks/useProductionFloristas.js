/*
 * Hook de floristas para produccion.
 * Carga floristas/disponibilidad y deriva el florista actual y permisos
 * de cambio de estado para usuarios floristas.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { inferCurrentFloristaId } from "../productionDomain.js";

export function useProductionFloristas({
  api,
  canFloristaQuickState,
  empresaId,
  session,
  sucursalId,
}) {
  const [floristas, setFloristas] = useState([]);
  const [floristasDisponibilidad, setFloristasDisponibilidad] = useState([]);

  const allFloristas = useMemo(() => {
    const byId = new Map();
    [...floristasDisponibilidad, ...floristas].forEach(item => {
      const floristaId = item.idFlorista;
      if (floristaId == null || floristaId === "") return;
      byId.set(Number(floristaId), item);
    });
    return Array.from(byId.values()).sort((left, right) =>
      String(left.nombre || "").localeCompare(String(right.nombre || ""), "es", { sensitivity: "base" })
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
    return Number(item.floristaID) === Number(currentFloristaId);
  }, [canFloristaQuickState, currentFloristaId]);

  const loadFloristaData = useCallback(async () => {
    try {
      const [floristasData, disponibilidadData] = await Promise.all([
        api.listarFloristas({
          empresaId,
          sucursalId,
          soloActivos: false,
        }),
        api.listarFloristas({
          empresaId,
          sucursalId,
          soloActivos: false,
          incluirExternos: true,
        }),
      ]);
      const nextFloristas = Array.isArray(floristasData.items) ? floristasData.items : [];
      const nextFloristasDisponibilidad = Array.isArray(disponibilidadData.items) ? disponibilidadData.items : [];
      setFloristas(nextFloristas);
      setFloristasDisponibilidad(nextFloristasDisponibilidad);
    } catch (nextError) {
      console.error("Error cargando floristas:", nextError);
      setFloristas([]);
      setFloristasDisponibilidad([]);
    }
  }, [api, empresaId, sucursalId]);

  useEffect(() => {
    void loadFloristaData();
  }, [loadFloristaData]);

  return {
    canChangeOwnProductionState,
    currentFloristaId,
    floristas,
    floristasDisponibilidad,
    loadFloristaData,
    ownFloristaDisponibilidad,
  };
}
