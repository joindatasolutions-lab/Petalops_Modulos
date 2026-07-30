import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { NeighborhoodCreatePanel, NeighborhoodsBoard, NeighborhoodsHeader, NeighborhoodsMetrics, NeighborhoodsTip } from "./NeighborhoodsView.jsx";
import {
  DEFAULT_BARRIO_FORM,
  DEFAULT_EDIT_FORM,
  barrioToEditForm,
  buildCreateBarrioPayload,
  buildNeighborhoodExportRows,
  buildNeighborhoodMetrics,
  buildPagination,
  buildUpdateBarrioPayload,
  buildZoneOptions,
  filterNeighborhoodItems,
  normalizeSearchText,
  parseNeighborhoodImportRow,
  sortNeighborhoods,
} from "./neighborhoodsDomain.js";
export { filterNeighborhoodItems, sortNeighborhoods } from "./neighborhoodsDomain.js";
export function NeighborhoodsPage({
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
  onLogout,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
  onGoInventario,
  onGoContabilidad,
  onGoClientes,
  onGoUsuarios,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const displayUserName = useMemo(() => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario", [session]);
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [zonaFilter, setZonaFilter] = useState("todas");
  const [costFilter, setCostFilter] = useState("todos");
  const [sortOrder, setSortOrder] = useState("nombre_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState(DEFAULT_BARRIO_FORM);
  const [saving, setSaving] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const importInputRef = useRef(null);
  const zoneOptions = useMemo(() => buildZoneOptions(items), [items]);
  const filteredItems = useMemo(() => filterNeighborhoodItems(items, { search, estadoFilter, zonaFilter, costFilter }), [costFilter, estadoFilter, items, search, zonaFilter]);
  const sortedItems = useMemo(() => sortNeighborhoods(filteredItems, sortOrder), [filteredItems, sortOrder]);
  const metrics = useMemo(() => buildNeighborhoodMetrics(items), [items]);
  const pagination = useMemo(() => buildPagination({ page, pageSize, totalItems: sortedItems.length }), [page, pageSize, sortedItems.length]);
  const pageItems = useMemo(() => {
    const start = (pagination.currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [pageSize, pagination.currentPage, sortedItems]);
  useEffect(() => { if (page > pagination.totalPages) setPage(pagination.totalPages); }, [page, pagination.totalPages]);
  const clearMessages = () => { setError(""); setFeedback(""); };
  const loadBarrios = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarBarriosDomicilios({ sucursalId });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      setError(nextError?.detail || nextError?.message || "No fue posible cargar barrios.");
    } finally {
      setLoading(false);
    }
  }, [api, sucursalId]);
  useEffect(() => { loadBarrios(); }, [loadBarrios]);
  const onChangeForm = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const onCrearBarrio = async () => {
    if (saving) return;
    setSaving(true); clearMessages();
    try {
      await api.crearBarrioDomicilios(buildCreateBarrioPayload(form, sucursalId));
      setFeedback("Barrio creado correctamente.");
      setForm(DEFAULT_BARRIO_FORM);
      setShowCreatePanel(false);
      await loadBarrios();
    } catch (nextError) {
      setError(nextError?.detail || nextError?.message || "No fue posible crear el barrio.");
    } finally {
      setSaving(false);
    }
  };
  const onStartEdit = item => { setEditingId(item?.idBarrio ?? null); setEditForm(barrioToEditForm(item)); clearMessages(); };
  const onCancelEdit = () => { setEditingId(null); setEditForm(DEFAULT_EDIT_FORM); };
  const saveNeighborhood = async (item, overrides) => api.actualizarBarrioDomicilios(buildUpdateBarrioPayload(item, overrides, sucursalId));
  const onSaveEdit = async item => {
    if (saving) return;
    setSaving(true); clearMessages();
    try {
      await saveNeighborhood(item, editForm);
      setFeedback("Barrio actualizado.");
      onCancelEdit();
      await loadBarrios();
    } catch (nextError) {
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar el barrio.");
    } finally {
      setSaving(false);
    }
  };
  const onQuickCostSave = async (item, value) => {
    const nextCost = Number(value || 0);
    if (!Number.isFinite(nextCost) || Number(item?.costoDomicilio || 0) === nextCost) return;
    setSaving(true); clearMessages();
    try {
      await saveNeighborhood(item, { costoDomicilio: nextCost });
      setFeedback(`Costo actualizado para ${item.nombreBarrio}.`);
      await loadBarrios();
    } catch (nextError) {
      setError(nextError?.detail || nextError?.message || "No fue posible actualizar el costo.");
    } finally {
      setSaving(false);
    }
  };
  const onDelete = async barrioId => {
    if (saving || !globalThis.confirm("Seguro que deseas borrar este barrio?")) return;
    setSaving(true); clearMessages();
    try {
      await api.borrarBarrioDomicilios({ barrioId: Number(barrioId), sucursalID: sucursalId });
      setFeedback("Barrio eliminado.");
      if (editingId === barrioId) onCancelEdit();
      await loadBarrios();
    } catch (nextError) {
      setError(nextError?.detail || nextError?.message || "No fue posible borrar el barrio.");
    } finally {
      setSaving(false);
    }
  };
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(buildNeighborhoodExportRows(sortedItems));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Barrios");
    XLSX.writeFile(workbook, "barrios-petalops.xlsx");
  };
  const importExcel = async event => {
    const file = event.target.files?.[0];
    if (!file || saving) return;
    setSaving(true); clearMessages();
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      const existingByName = new Map(items.map(item => [normalizeSearchText(item.nombreBarrio), item]));
      let created = 0;
      let updated = 0;
      for (const row of rows) {
        const parsed = parseNeighborhoodImportRow(row);
        if (!parsed) continue;
        const existing = existingByName.get(normalizeSearchText(parsed.nombreBarrio));
        if (existing) {
          await saveNeighborhood(existing, parsed);
          updated += 1;
        } else {
          await api.crearBarrioDomicilios({ sucursalID: sucursalId, ...parsed });
          created += 1;
        }
      }
      setFeedback(`Importacion lista. Creados: ${created}. Actualizados: ${updated}.`);
      await loadBarrios();
    } catch (nextError) {
      setError(nextError?.detail || nextError?.message || "No fue posible importar el archivo.");
    } finally {
      event.target.value = "";
      setSaving(false);
    }
  };
  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar activeKey="barrios" sidebarPinned={sidebarPinned} sidebarMobileOpen={sidebarMobileOpen} toggleSidebar={toggleSidebar} closeSidebarMobile={() => setSidebarMobileOpen(false)} onLogout={onLogout} permissions={{ pipeline: canViewPipeline, pedidos: canViewPedidos, produccion: canViewProduccion, domicilios: canViewDomicilios, barrios: canViewBarrios, inventario: canViewInventario, contabilidad: canViewContabilidad, clientes: canViewClientesPanel, usuarios: canViewUsuariosPanel }} navigation={{ pipeline: onGoPipeline, pedidos: onGoPedidos, produccion: onGoProduccion, domicilios: onGoDomicilios, barrios: onGoBarrios, inventario: onGoInventario, contabilidad: onGoContabilidad, clientes: onGoClientes, usuarios: onGoUsuarios }} badges={{ barrios: items.length }} />
      <main className="orders-admin-view neighborhoods-page-view">
        <NeighborhoodsHeader displayUserName={displayUserName} onExport={exportExcel} onToggleCreate={() => setShowCreatePanel(current => !current)} toggleSidebar={toggleSidebar} />
        <NeighborhoodsMetrics metrics={metrics} />
        {feedback ? <p className="orders-message delivery-feedback">{feedback}</p> : null}
        {error ? <p className="orders-message delivery-error">{error}</p> : null}
        {loading ? <p className="orders-message">Cargando barrios...</p> : null}
        {showCreatePanel ? <NeighborhoodCreatePanel form={form} saving={saving} onChangeForm={onChangeForm} onCreate={onCrearBarrio} /> : null}
        <NeighborhoodsBoard costFilter={costFilter} editForm={editForm} editingId={editingId} estadoFilter={estadoFilter} page={page} pageEnd={pagination.pageEnd} pageItems={pageItems} pageSize={pageSize} pageStart={pagination.pageStart} saving={saving} search={search} sortOrder={sortOrder} sortedCount={sortedItems.length} totalPages={pagination.totalPages} zonaFilter={zonaFilter} zoneOptions={zoneOptions} onCancelEdit={onCancelEdit} onDelete={onDelete} onQuickCostSave={onQuickCostSave} onSaveEdit={onSaveEdit} onStartEdit={onStartEdit} setCostFilter={setCostFilter} setEditForm={setEditForm} setEstadoFilter={setEstadoFilter} setPage={setPage} setPageSize={setPageSize} setSearch={setSearch} setSortOrder={setSortOrder} setZonaFilter={setZonaFilter} />
        <NeighborhoodsTip importInputRef={importInputRef} onImport={importExcel} />
      </main>
    </div>
  );
}