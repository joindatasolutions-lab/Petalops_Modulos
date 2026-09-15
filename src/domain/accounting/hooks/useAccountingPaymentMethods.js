import { useCallback, useEffect, useMemo, useState } from "react";

export function useAccountingPaymentMethods({ api, session, canViewUsuariosGlobal, enabled = false }) {
  const initialEmpresaID = Number(session?.empresaID || 1);
  const [empresaID, setEmpresaID] = useState(initialEmpresaID);
  const [empresas, setEmpresas] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodSaving, setPaymentMethodSaving] = useState(false);
  const [paymentMethodEditing, setPaymentMethodEditing] = useState(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({ nombre: "" });
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [paymentMethodError, setPaymentMethodError] = useState("");
  const [paymentMethodInfo, setPaymentMethodInfo] = useState("");

  const empresaSeleccionadaNombre = useMemo(() => {
    const found = empresas.find(item => Number(item.empresaID) === Number(empresaID));
    return found?.nombre || session?.empresaNombre || `Empresa ${empresaID}`;
  }, [empresaID, empresas, session?.empresaNombre]);

  const loadEmpresas = useCallback(async () => {
    if (!canViewUsuariosGlobal) {
      setEmpresas([{
        empresaID: Number(initialEmpresaID),
        nombre: session?.empresaNombre || `Empresa ${initialEmpresaID}`,
      }]);
      setEmpresaID(Number(initialEmpresaID));
      return;
    }

    const data = await api.listarEmpresasGestion();
    const next = Array.isArray(data.items) ? data.items : [];
    setEmpresas(next);
    if (next.length > 0) {
      setEmpresaID(current => {
        const exists = next.some(item => Number(item.empresaID) === Number(current));
        return exists ? current : Number(next[0].empresaID);
      });
    }
  }, [api, canViewUsuariosGlobal, initialEmpresaID, session?.empresaNombre]);

  const loadPaymentMethods = useCallback(async () => {
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) {
      setPaymentMethods([]);
      return;
    }
    setPaymentMethodsLoading(true);
    setPaymentMethodError("");
    try {
      const data = await api.listarMetodosPagoEmpresa({ empresaId: targetEmpresaID });
      setPaymentMethods(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando metodos de pago desde contabilidad:", nextError);
      setPaymentMethods([]);
      setPaymentMethodError(nextError?.message || "No fue posible cargar metodos de pago.");
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, [api, empresaID]);

  const openPaymentMethodModal = useCallback(() => {
    setPaymentMethodEditing(null);
    setPaymentMethodForm({ nombre: "" });
    setShowPaymentMethodModal(true);
  }, []);

  const closePaymentMethodModal = useCallback(() => {
    setShowPaymentMethodModal(false);
    setPaymentMethodEditing(null);
    setPaymentMethodForm({ nombre: "" });
  }, []);

  const editPaymentMethod = item => {
    setPaymentMethodEditing(item);
    setPaymentMethodForm({ nombre: item?.nombre || "" });
    setShowPaymentMethodModal(true);
  };

  const submitPaymentMethod = async event => {
    event.preventDefault();
    const nombre = String(paymentMethodForm.nombre || "").trim();
    const targetEmpresaID = Number(empresaID);
    if (!Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) {
      setPaymentMethodError("Selecciona una empresa valida para crear el metodo de pago.");
      return;
    }
    if (nombre.length < 2) {
      setPaymentMethodError("El metodo de pago debe tener al menos 2 caracteres.");
      return;
    }

    setPaymentMethodSaving(true);
    setPaymentMethodError("");
    setPaymentMethodInfo("");
    try {
      const response = paymentMethodEditing
        ? await api.actualizarMetodoPagoEmpresa({
            empresaId: targetEmpresaID,
            itemId: paymentMethodEditing.id,
            nombre,
          })
        : await api.crearMetodoPagoEmpresa({
            empresaId: targetEmpresaID,
            nombre,
          });
      closePaymentMethodModal();
      await loadPaymentMethods();
      setPaymentMethodInfo(`Metodo de pago ${response?.nombre || nombre} ${paymentMethodEditing ? "actualizado" : "creado"} para ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error guardando metodo de pago desde contabilidad:", nextError);
      setPaymentMethodError(nextError?.message || "No fue posible guardar el metodo de pago.");
    } finally {
      setPaymentMethodSaving(false);
    }
  };

  const togglePaymentMethodActive = async item => {
    const targetEmpresaID = Number(empresaID);
    if (!item?.id || !Number.isFinite(targetEmpresaID) || targetEmpresaID <= 0) return;

    setPaymentMethodSaving(true);
    setPaymentMethodError("");
    setPaymentMethodInfo("");
    try {
      await api.actualizarMetodoPagoEmpresa({
        empresaId: targetEmpresaID,
        itemId: item.id,
        activo: !Boolean(item.activo),
      });
      await loadPaymentMethods();
      setPaymentMethodInfo(`Metodo de pago ${item.nombre} ${item.activo ? "inactivado" : "activado"} para ${empresaSeleccionadaNombre}.`);
    } catch (nextError) {
      console.error("Error actualizando metodo de pago desde contabilidad:", nextError);
      setPaymentMethodError(nextError?.message || "No fue posible actualizar el metodo de pago.");
    } finally {
      setPaymentMethodSaving(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    loadEmpresas().catch(nextError => {
      console.error("Error cargando empresas para metodos de pago:", nextError);
      setEmpresas([]);
      setPaymentMethodError(nextError?.message || "No fue posible cargar empresas.");
    });
  }, [enabled, loadEmpresas]);

  useEffect(() => {
    if (!enabled) return;
    loadPaymentMethods().catch(() => {});
  }, [enabled, loadPaymentMethods]);

  useEffect(() => {
    if (!showPaymentMethodModal) return undefined;
    const onKeyDown = event => {
      if (event.key === "Escape") closePaymentMethodModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePaymentMethodModal, showPaymentMethodModal]);

  return {
    paymentMethodsEmpresaID: empresaID,
    setPaymentMethodsEmpresaID: setEmpresaID,
    paymentMethodsEmpresaNombre: empresaSeleccionadaNombre,
    paymentMethodsEmpresas: empresas,
    paymentMethods,
    paymentMethodsLoading,
    paymentMethodSaving,
    paymentMethodEditing,
    paymentMethodForm,
    setPaymentMethodForm,
    showPaymentMethodModal,
    paymentMethodError,
    paymentMethodInfo,
    canViewUsuariosGlobal,
    loadPaymentMethods,
    openPaymentMethodModal,
    closePaymentMethodModal,
    editPaymentMethod,
    submitPaymentMethod,
    togglePaymentMethodActive,
  };
}
