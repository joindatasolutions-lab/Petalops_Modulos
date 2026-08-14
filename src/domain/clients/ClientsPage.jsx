import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { todayIsoDateBogota } from "../../shared/utils.js";
import { buildPaginationItems } from "../orders-admin/ordersDomain.js";
import { ClientDrawer } from "./ClientDrawer.jsx";
import { ClientsHeader } from "./ClientsHeader.jsx";
import { ClientsMetricsView } from "./ClientsMetricsView.jsx";
import { ClientsPager } from "./ClientsPager.jsx";
import { ClientsTableView } from "./ClientsTableView.jsx";
import {
  DEFAULT_CUSTOMER_METRICS_RANGE,
  INITIAL_CLIENT_FORM,
  buildCustomerMetricsDateRange,
  buildClientMetricsExportSheets,
  buildClientPayload,
  buildClientsExportRows,
  clientToForm,
  extractClientItems,
  extractPayloadTotal,
  normalizeCustomerMetricItem,
  normalizeDashboardMetrics,
  isEmpresaAdminRole,
} from "./clientsDomain.js";

const CLIENTS_PAGE_SIZE = 50;
const CLIENTS_SEGMENT_PAGE_SIZE = 10;

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
  const [customerMetrics, setCustomerMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsDatePreset, setMetricsDatePreset] = useState(DEFAULT_CUSTOMER_METRICS_RANGE.preset);
  const [metricsDateRange, setMetricsDateRange] = useState({
    startDate: DEFAULT_CUSTOMER_METRICS_RANGE.startDate,
    endDate: DEFAULT_CUSTOMER_METRICS_RANGE.endDate,
  });
  const [selectedSegment, setSelectedSegment] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState(false);
  const [segmentItems, setSegmentItems] = useState([]);
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [segmentPage, setSegmentPage] = useState(1);
  const [segmentTotal, setSegmentTotal] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [form, setForm] = useState(INITIAL_CLIENT_FORM);
  const clientsMenuRef = useRef(null);
  const clientsIntelligence = useMemo(
    () => normalizeDashboardMetrics(customerMetrics, items),
    [customerMetrics, items]
  );

  // Paginacion en cliente sobre la lista ya cargada (items completo sigue intacto
  // para busqueda, metricas y exportacion a Excel).
  const totalPages = Math.max(1, Math.ceil(items.length / CLIENTS_PAGE_SIZE));
  const pagerItems = useMemo(() => buildPaginationItems(page, totalPages), [page, totalPages]);
  const pagedItems = useMemo(
    () => items.slice((page - 1) * CLIENTS_PAGE_SIZE, page * CLIENTS_PAGE_SIZE),
    [items, page]
  );
  const visibleFrom = items.length > 0 ? (page - 1) * CLIENTS_PAGE_SIZE + 1 : 0;
  const visibleTo = items.length > 0 ? Math.min(items.length, (page - 1) * CLIENTS_PAGE_SIZE + pagedItems.length) : 0;
  const segmentTotalPages = Math.max(1, Math.ceil(segmentTotal / CLIENTS_SEGMENT_PAGE_SIZE));
  const segmentPagerItems = useMemo(
    () => buildPaginationItems(segmentPage, segmentTotalPages),
    [segmentPage, segmentTotalPages]
  );
  const segmentVisibleFrom = segmentTotal > 0 ? (segmentPage - 1) * CLIENTS_SEGMENT_PAGE_SIZE + 1 : 0;
  const segmentVisibleTo = segmentTotal > 0
    ? Math.min(segmentTotal, (segmentPage - 1) * CLIENTS_SEGMENT_PAGE_SIZE + segmentItems.length)
    : 0;

  useEffect(() => {
    setPage(1);
  }, [items]);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarClientes({ empresaId, q, soloActivos: false, includeMetrics: true, page: 1, pageSize: 300 });
      setItems(extractClientItems(data));
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

  const loadCustomerMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setError("");
    try {
      const data = await api.obtenerMetricasClientes({
        tenantId: empresaId,
        startDate: metricsDateRange.startDate,
        endDate: metricsDateRange.endDate,
        comparison: true,
      });
      setCustomerMetrics(data);
    } catch (nextError) {
      console.error("Error cargando metricas de clientes:", nextError);
      setCustomerMetrics(null);
      setError(nextError?.message || "No fue posible cargar metricas de clientes.");
    } finally {
      setMetricsLoading(false);
    }
  }, [api, empresaId, metricsDateRange.endDate, metricsDateRange.startDate]);

  const loadSegment = useCallback(async ({ segment = selectedSegment, priority = selectedPriority, nextPage = segmentPage } = {}) => {
    setSegmentLoading(true);
    setError("");
    try {
      const data = priority
        ? await api.listarPrioridadClientes({
          tenantId: empresaId,
          priority,
          page: nextPage,
          limit: CLIENTS_SEGMENT_PAGE_SIZE,
          sort: "commercial_priority",
          order: "asc",
          startDate: metricsDateRange.startDate,
          endDate: metricsDateRange.endDate,
        })
        : await api.listarSegmentoClientes({
          tenantId: empresaId,
          segment,
          page: nextPage,
          limit: CLIENTS_SEGMENT_PAGE_SIZE,
          sort: "purchase_count",
          order: "desc",
        });
      const nextItems = extractClientItems(data);
      setSegmentItems(nextItems.map(normalizeCustomerMetricItem));
      setSegmentTotal(extractPayloadTotal(data, nextItems));
    } catch (nextError) {
      console.error("Error cargando segmento de clientes:", nextError);
      setSegmentItems([]);
      setSegmentTotal(0);
      setError(nextError?.message || "No fue posible cargar el segmento de clientes.");
    } finally {
      setSegmentLoading(false);
    }
  }, [api, empresaId, metricsDateRange.endDate, metricsDateRange.startDate, selectedPriority, selectedSegment, segmentPage]);

  const loadOpportunities = useCallback(async (nextPage = segmentPage) => {
    setSegmentLoading(true);
    setError("");
    try {
      const data = await api.listarOportunidadesClientes({
        tenantId: empresaId,
        days: 30,
        page: nextPage,
        limit: CLIENTS_SEGMENT_PAGE_SIZE,
      });
      const nextItems = extractClientItems(data);
      setSegmentItems(nextItems.map(normalizeCustomerMetricItem));
      setSegmentTotal(extractPayloadTotal(data, nextItems));
    } catch (nextError) {
      console.error("Error cargando oportunidades de clientes:", nextError);
      setSegmentItems([]);
      setSegmentTotal(0);
      setError(nextError?.message || "No fue posible cargar oportunidades de clientes.");
    } finally {
      setSegmentLoading(false);
    }
  }, [api, empresaId, segmentPage]);

  useEffect(() => {
    if (activeView !== "metricas") return;
    loadCustomerMetrics().catch(() => {});
    if (selectedSegment || selectedPriority) {
      loadSegment({ segment: selectedSegment, priority: selectedPriority, nextPage: segmentPage }).catch(() => {});
    }
    if (selectedOpportunity) loadOpportunities(segmentPage).catch(() => {});
  }, [activeView, loadCustomerMetrics, loadOpportunities, loadSegment, selectedOpportunity, selectedPriority, selectedSegment, segmentPage]);

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

  const onSelectSegment = segment => {
    setSelectedSegment(segment);
    setSelectedPriority("");
    setSelectedOpportunity(false);
    setSegmentPage(1);
  };

  const onSelectPriority = priority => {
    setSelectedPriority(priority);
    setSelectedSegment("");
    setSelectedOpportunity(false);
    setSegmentPage(1);
  };

  const onSelectOpportunities = () => {
    setSelectedOpportunity(true);
    setSelectedPriority("");
    setSelectedSegment("");
    setSegmentPage(1);
  };

  const onSelectMetricsDatePreset = preset => {
    setMetricsDatePreset(preset);
    setMetricsDateRange(buildCustomerMetricsDateRange(preset, metricsDateRange));
    setSegmentPage(1);
  };

  const onChangeMetricsDateRange = (field, value) => {
    setMetricsDatePreset("CUSTOM");
    setMetricsDateRange(current => ({ ...current, [field]: value }));
    setSegmentPage(1);
  };

  const refreshMetricsView = useCallback(async () => {
    const requests = [
      loadClientes(),
      loadCustomerMetrics(),
    ];
    if (selectedSegment || selectedPriority) {
      requests.push(loadSegment({ segment: selectedSegment, priority: selectedPriority, nextPage: segmentPage }));
    }
    if (selectedOpportunity) requests.push(loadOpportunities(segmentPage));
    await Promise.all(requests);
  }, [loadClientes, loadCustomerMetrics, loadOpportunities, loadSegment, selectedOpportunity, selectedPriority, selectedSegment, segmentPage]);

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
          <ClientsMetricsView
            clientsIntelligence={clientsIntelligence}
            itemsCount={items.length}
            loading={loading}
            metricsDatePreset={metricsDatePreset}
            metricsDateRange={metricsDateRange}
            metricsLoading={metricsLoading}
            segmentLoading={segmentLoading}
            segmentPage={segmentPage}
            segmentPages={segmentTotalPages}
            segmentPagerItems={segmentPagerItems}
            segmentTotal={segmentTotal}
            segmentVisibleFrom={segmentVisibleFrom}
            segmentVisibleTo={segmentVisibleTo}
            selectedOpportunity={selectedOpportunity}
            selectedPriority={selectedPriority}
            selectedSegment={selectedSegment}
            segmentItems={segmentItems}
            onExport={exportMetricasExcel}
            onChangeMetricsDateRange={onChangeMetricsDateRange}
            onSegmentPageChange={setSegmentPage}
            onSelectMetricsDatePreset={onSelectMetricsDatePreset}
            onSelectOpportunities={onSelectOpportunities}
            onSelectPriority={onSelectPriority}
            onRefresh={refreshMetricsView}
            onShowDirectory={() => setActiveView("clientes")}
            onSelectSegment={onSelectSegment}
            onViewClient={openEdit}
          />
        ) : (
          <>
            <ClientsTableView canManageClients={canManageClients} items={pagedItems} q={q} onEdit={openEdit} onExport={exportClientesExcel} onSearchChange={setQ} />
            <ClientsPager
              total={items.length}
              visibleFrom={visibleFrom}
              visibleTo={visibleTo}
              page={page}
              pages={totalPages}
              pagerItems={pagerItems}
              onPageChange={setPage}
            />
          </>
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
