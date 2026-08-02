import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { todayIsoDateBogota } from "../../shared/utils.js";
import { ClientDrawer } from "./ClientDrawer.jsx";
import { ClientsHeader } from "./ClientsHeader.jsx";
import { ClientsMetricsView } from "./ClientsMetricsView.jsx";
import { ClientsTableView } from "./ClientsTableView.jsx";
import {
  INITIAL_CLIENT_FORM,
  buildClientMetricsExportSheets,
  buildClientPayload,
  buildClientsExportRows,
  buildClientsIntelligence,
  clientToForm,
  isEmpresaAdminRole,
} from "./clientsDomain.js";

export function ClientsPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewBarrios,
  canViewInventario,
  canViewContabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
  onGoInventario,
  onGoContabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const canManageClients = isEmpresaAdminRole(session);
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  const [activeView, setActiveView] = useState("clientes");
  const [clientsMenuOpen, setClientsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [form, setForm] = useState(INITIAL_CLIENT_FORM);
  const clientsMenuRef = useRef(null);
  const clientsIntelligence = useMemo(() => buildClientsIntelligence(items), [items]);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarClientes({ empresaId, q, soloActivos: false });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando clientes:", nextError);
      setItems([]);
      setError(nextError?.message || "No fue posible cargar clientes.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, q]);

  useEffect(() => {
    loadClientes().catch(() => {});
  }, [loadClientes]);

  useEffect(() => {
    if (!clientsMenuOpen) return undefined;
    const handlePointerDown = event => {
      if (clientsMenuRef.current && !clientsMenuRef.current.contains(event.target)) setClientsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [clientsMenuOpen]);

  const clearMessages = () => {
    setError("");
    setInfo("");
  };

  const openCreate = () => {
    setEditingClienteId(null);
    setForm(INITIAL_CLIENT_FORM);
    setDrawerOpen(true);
    clearMessages();
  };

  const openEdit = item => {
    if (!canManageClients) {
      setError("Solo administradores pueden editar clientes.");
      return;
    }
    setEditingClienteId(item.clienteID);
    setForm(clientToForm(item));
    setDrawerOpen(true);
    clearMessages();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingClienteId(null);
    setForm(INITIAL_CLIENT_FORM);
  };

  const onChangeForm = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const onSelectView = view => {
    setActiveView(view);
    setClientsMenuOpen(false);
  };

  const exportClientesExcel = async () => {
    if (items.length === 0) return;
    clearMessages();
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(buildClientsExportRows(items));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
      XLSX.writeFile(workbook, `clientes-${todayIsoDateBogota()}.xlsx`);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible exportar los clientes.");
    }
  };

  const exportMetricasExcel = async () => {
    if (items.length === 0) return;
    clearMessages();
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const sheets = buildClientMetricsExportSheets(clientsIntelligence);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheets.resumen), "Resumen");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheets.calidad), "Calidad directorio");
      if (sheets.documentos.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheets.documentos), "Tipos de documento");
      if (sheets.indicativos.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheets.indicativos), "Indicativos");
      XLSX.writeFile(workbook, `metricas-clientes-${todayIsoDateBogota()}.xlsx`);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible exportar las metricas.");
    }
  };

  const onSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    clearMessages();
    try {
      const payload = buildClientPayload(form, empresaId);
      if (editingClienteId != null) {
        await api.actualizarCliente({ clienteId: editingClienteId, ...payload });
        setInfo("Cliente actualizado correctamente.");
      } else {
        await api.crearCliente(payload);
        setInfo("Cliente creado correctamente.");
      }
      closeDrawer();
      await loadClientes();
    } catch (nextError) {
      console.error("Error guardando cliente:", nextError);
      setError(nextError?.message || "No fue posible guardar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="clientes"
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
          usuarios: onGoUsuarios,
        }}
      />

      <main className="orders-admin-view clients-page-view">
        <ClientsHeader
          activeView={activeView}
          clientsIntelligence={clientsIntelligence}
          clientsMenuOpen={clientsMenuOpen}
          clientsMenuRef={clientsMenuRef}
          loading={loading}
          onCreate={openCreate}
          onRefresh={() => loadClientes()}
          onSelectView={onSelectView}
          onToggleMenu={() => setClientsMenuOpen(current => !current)}
        />

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}
        {loading ? <p className="orders-message">Cargando clientes...</p> : null}

        {activeView === "metricas" ? (
          <ClientsMetricsView clientsIntelligence={clientsIntelligence} itemsCount={items.length} loading={loading} onExport={exportMetricasExcel} />
        ) : (
          <ClientsTableView canManageClients={canManageClients} items={items} q={q} onEdit={openEdit} onExport={exportClientesExcel} onSearchChange={setQ} />
        )}
      </main>

      <ClientDrawer
        drawerOpen={drawerOpen}
        editingClienteId={editingClienteId}
        form={form}
        saving={saving}
        onChangeForm={onChangeForm}
        onClose={closeDrawer}
        onSubmit={onSubmit}
      />
    </div>
  );
}