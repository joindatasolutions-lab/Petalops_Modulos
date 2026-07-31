import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  TrendingUp,
  Upload,
} from "lucide-react";

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatCurrency(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString("es-CO")}`;
}

function resolveZoneLabel(item) {
  const zonaID = item?.zonaID ?? item?.zonaId ?? item?.idZona;
  return zonaID != null && zonaID !== "" ? String(zonaID) : "Sin zona";
}

export function sortNeighborhoods(items, sortOrder) {
  const rows = [...items];
  rows.sort((a, b) => {
    if (sortOrder === "costo_desc") return Number(b?.costoDomicilio || 0) - Number(a?.costoDomicilio || 0);
    if (sortOrder === "costo_asc") return Number(a?.costoDomicilio || 0) - Number(b?.costoDomicilio || 0);
    const nameA = String(a?.nombreBarrio || "").localeCompare(String(b?.nombreBarrio || ""), "es", { sensitivity: "base" });
    return sortOrder === "nombre_desc" ? -nameA : nameA;
  });
  return rows;
}

export function filterNeighborhoodItems(items, { search = "", estadoFilter = "todos", zonaFilter = "todas", costFilter = "todos" } = {}) {
  const term = normalizeSearchText(search);
  const rows = Array.isArray(items) ? items : [];
  const costs = rows.map(item => Number(item?.costoDomicilio || 0)).filter(value => Number.isFinite(value));
  const averageCost = costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : 0;
  return rows.filter(item => {
    const zoneLabel = resolveZoneLabel(item);
    const cost = Number(item?.costoDomicilio || 0);
    if (estadoFilter === "activos" && item?.activo === false) return false;
    if (estadoFilter === "inactivos" && item?.activo !== false) return false;
    if (zonaFilter !== "todas" && zoneLabel !== zonaFilter) return false;
    if (costFilter === "sin_costo" && cost > 0) return false;
    if (costFilter === "bajo_promedio" && cost > averageCost) return false;
    if (costFilter === "alto_promedio" && cost < averageCost) return false;
    if (!term) return true;

    const zona = String(item?.zonaID ?? zoneLabel).trim();
    const nombre = String(item?.nombreBarrio || "").trim();
    const costo = String(item?.costoDomicilio ?? "").trim();
    return [zona, zoneLabel, nombre, costo].some(value => normalizeSearchText(value).includes(term));
  });
}

const DEFAULT_BARRIO_FORM = {
  zonaID: "",
  nombreBarrio: "",
  costoDomicilio: "",
  activo: true,
};

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
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

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
  const importInputRef = useRef(null);
  const [editForm, setEditForm] = useState({
    zonaID: "",
    nombreBarrio: "",
    costoDomicilio: "",
  });

  const zoneOptions = useMemo(() => (
    Array.from(new Set(items.map(resolveZoneLabel))).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
  ), [items]);

  const filteredItems = useMemo(() => {
    return filterNeighborhoodItems(items, { search, estadoFilter, zonaFilter, costFilter });
  }, [costFilter, estadoFilter, items, search, zonaFilter]);

  const sortedItems = useMemo(() => sortNeighborhoods(filteredItems, sortOrder), [filteredItems, sortOrder]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const pageItems = useMemo(() => {
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [page, pageSize, sortedItems, totalPages]);

  const metrics = useMemo(() => {
    const costs = items.map(item => Number(item?.costoDomicilio || 0)).filter(value => Number.isFinite(value));
    const total = costs.reduce((sum, value) => sum + value, 0);
    return {
      total: items.length,
      average: costs.length ? total / costs.length : 0,
      highest: costs.length ? Math.max(...costs) : 0,
      lowest: costs.length ? Math.min(...costs) : 0,
      active: items.filter(item => item.activo !== false).length,
    };
  }, [items]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  useEffect(() => {
    loadBarrios();
  }, [loadBarrios]);

  const onChangeForm = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const onCrearBarrio = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      await api.crearBarrioDomicilios({
        sucursalID: sucursalId,
        zonaID: Number(form.zonaID || 0),
        nombreBarrio: form.nombreBarrio,
        costoDomicilio: Number(form.costoDomicilio || 0),
        activo: Boolean(form.activo),
      });
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

  const onStartEdit = item => {
    setEditingId(item?.idBarrio ?? null);
    setEditForm({
      zonaID: String(item?.zonaID ?? ""),
      nombreBarrio: String(item?.nombreBarrio || ""),
      costoDomicilio: String(item?.costoDomicilio ?? ""),
    });
    setError("");
    setFeedback("");
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setEditForm({
      zonaID: "",
      nombreBarrio: "",
      costoDomicilio: "",
    });
  };

  const saveNeighborhood = async (item, overrides) => {
    await api.actualizarBarrioDomicilios({
      barrioId: Number(item.idBarrio),
      sucursalID: sucursalId,
      zonaID: Number(overrides.zonaID ?? item.zonaID ?? 0),
      nombreBarrio: String(overrides.nombreBarrio ?? item.nombreBarrio ?? "").trim(),
      costoDomicilio: Number(overrides.costoDomicilio ?? item.costoDomicilio ?? 0),
    });
  };

  const onSaveEdit = async item => {
    if (saving) return;
    setSaving(true);
    setError("");
    setFeedback("");
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
    setSaving(true);
    setError("");
    setFeedback("");
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
    if (saving) return;
    const confirmed = globalThis.confirm("¿Seguro que deseas borrar este barrio?");
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      await api.borrarBarrioDomicilios({
        barrioId: Number(barrioId),
        sucursalID: sucursalId,
      });
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
    const rows = sortedItems.map(item => ({
      "Barrio": item.nombreBarrio || "",
      "Zona": resolveZoneLabel(item),
      "Zona ID": item.zonaID ?? "",
      "Costo domicilio": Number(item.costoDomicilio || 0),
      "Estado": item.activo === false ? "Inactivo" : "Activo",
    }));
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Barrios");
    XLSX.writeFile(workbook, "barrios-petalops.xlsx");
  };

  const importExcel = async event => {
    const file = event.target.files?.[0];
    if (!file || saving) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      const existingByName = new Map(items.map(item => [normalizeSearchText(item.nombreBarrio), item]));
      let created = 0;
      let updated = 0;

      for (const row of rows) {
        const nombreBarrio = String(row.Barrio || row["Nombre barrio"] || row.nombreBarrio || "").trim();
        if (!nombreBarrio) continue;
        const zonaID = Number(row["Zona ID"] ?? row.zonaID ?? row.ZonaID ?? 0);
        const costoDomicilio = Number(row["Costo domicilio"] ?? row.Costo ?? row.costoDomicilio ?? 0);
        const activoText = String(row.Estado ?? row.Activo ?? "Activo").trim().toLowerCase();
        const activo = !["inactivo", "no", "false", "0"].includes(activoText);
        const existing = existingByName.get(normalizeSearchText(nombreBarrio));

        if (existing) {
          await saveNeighborhood(existing, { zonaID, nombreBarrio, costoDomicilio });
          updated += 1;
        } else {
          await api.crearBarrioDomicilios({
            sucursalID: sucursalId,
            zonaID,
            nombreBarrio,
            costoDomicilio,
            activo,
          });
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

  const pageStart = sortedItems.length === 0 ? 0 : (Math.min(page, totalPages) - 1) * pageSize + 1;
  const pageEnd = Math.min(sortedItems.length, Math.min(page, totalPages) * pageSize);

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="barrios"
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
        badges={{ barrios: items.length }}
      />

      <main className="orders-admin-view neighborhoods-page-view">
        <header className="neighborhoods-hero">
          <div>
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>Menu</button>
            <h1>Barrios</h1>
            <p>Administra los costos de domicilio por barrio y zona.</p>
            <span className="orders-user-pill"><span aria-hidden="true" /> Sesion activa: {displayUserName}</span>
          </div>
          <div className="neighborhoods-hero-actions">
            <button type="button" className="btn-outline" onClick={exportExcel}>
              <Download size={17} strokeWidth={2} />
              Exportar Excel
            </button>
            <button type="button" className="btn-primary" onClick={() => setShowCreatePanel(current => !current)}>
              <Plus size={18} strokeWidth={2} />
              Nuevo barrio
            </button>
          </div>
        </header>

        <section className="neighborhoods-metrics" aria-label="Resumen barrios">
          <article>
            <span className="is-pink"><MapPin size={24} strokeWidth={2} /></span>
            <div><strong>{metrics.total}</strong><small>Barrios configurados</small></div>
          </article>
          <article>
            <span className="is-green"><TrendingUp size={24} strokeWidth={2} /></span>
            <div><strong>{formatCurrency(metrics.average)}</strong><small>Costo promedio</small></div>
          </article>
          <article>
            <span className="is-purple"><ArrowUp size={24} strokeWidth={2} /></span>
            <div><strong>{formatCurrency(metrics.highest)}</strong><small>Costo mas alto</small></div>
          </article>
          <article>
            <span className="is-orange"><ArrowDown size={24} strokeWidth={2} /></span>
            <div><strong>{formatCurrency(metrics.lowest)}</strong><small>Costo mas bajo</small></div>
          </article>
        </section>

        {feedback ? <p className="orders-message delivery-feedback">{feedback}</p> : null}
        {error ? <p className="orders-message delivery-error">{error}</p> : null}
        {loading ? <p className="orders-message">Cargando barrios...</p> : null}

        {showCreatePanel ? (
          <section className="neighborhoods-create-panel">
            <div className="delivery-section-head">
              <h4>Crear barrio</h4>
              <span><Plus size={15} strokeWidth={2} aria-hidden="true" /> Nuevo registro</span>
            </div>
            <div className="neighborhoods-create-grid">
              <label>
                Zona ID
                <input type="number" min="0" value={form.zonaID} onChange={event => onChangeForm("zonaID", event.target.value)} placeholder="Ej: 1" />
              </label>
              <label>
                Nombre barrio
                <input type="text" value={form.nombreBarrio} onChange={event => onChangeForm("nombreBarrio", event.target.value)} placeholder="Nombre del barrio" />
              </label>
              <label>
                Costo domicilio
                <input type="number" min="0" step="0.01" value={form.costoDomicilio} onChange={event => onChangeForm("costoDomicilio", event.target.value)} placeholder="0" />
              </label>
              <label>
                Activo
                <select value={form.activo ? "1" : "0"} onChange={event => onChangeForm("activo", event.target.value === "1")}>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </label>
              <button type="button" className="btn-primary" onClick={onCrearBarrio} disabled={saving}>
                {saving ? "Guardando..." : "Crear barrio"}
              </button>
            </div>
          </section>
        ) : null}

        <section className="neighborhoods-board">
          <div className="neighborhoods-toolbar">
            <label className="neighborhoods-search">
              <Search size={18} strokeWidth={2} />
              <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar barrio..." />
            </label>
            <select value={estadoFilter} onChange={event => { setEstadoFilter(event.target.value); setPage(1); }}>
              <option value="todos">Estado: Todos</option>
              <option value="activos">Estado: Activos</option>
              <option value="inactivos">Estado: Inactivos</option>
            </select>
            <select value={zonaFilter} onChange={event => { setZonaFilter(event.target.value); setPage(1); }}>
              <option value="todas">Zona: Todas</option>
              {zoneOptions.map(zone => <option key={zone} value={zone}>{zone}</option>)}
            </select>
            <select value={costFilter} onChange={event => { setCostFilter(event.target.value); setPage(1); }}>
              <option value="todos">Costo: Todos</option>
              <option value="bajo_promedio">Costo: Bajo/promedio</option>
              <option value="alto_promedio">Costo: Alto/promedio</option>
              <option value="sin_costo">Costo: Sin costo</option>
            </select>
            <select value={sortOrder} onChange={event => setSortOrder(event.target.value)}>
              <option value="nombre_asc">Ordenar por: Barrio A-Z</option>
              <option value="nombre_desc">Ordenar por: Barrio Z-A</option>
              <option value="costo_desc">Costo mayor a menor</option>
              <option value="costo_asc">Costo menor a mayor</option>
            </select>
          </div>

          <div className="neighborhoods-table-shell">
            <table className="neighborhoods-table">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Zona</th>
                  <th>Costo domicilio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr><td colSpan={5}>No hay barrios para el filtro seleccionado.</td></tr>
                ) : pageItems.map(item => (
                    <NeighborhoodRow
                      key={item.idBarrio}
                      item={item}
                      editingId={editingId}
                      editForm={editForm}
                      saving={saving}
                      onStartEdit={onStartEdit}
                      onSaveEdit={onSaveEdit}
                      onCancelEdit={onCancelEdit}
                      onDelete={onDelete}
                      onQuickCostSave={onQuickCostSave}
                      setEditForm={setEditForm}
                    />
                ))}
              </tbody>
            </table>

          </div>

          <footer className="neighborhoods-pager">
            <span>Mostrando {pageStart} a {pageEnd} de {sortedItems.length} barrios</span>
            <div>
              <button type="button" className="btn-outline" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}>
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                const value = index + 1;
                return <button key={value} type="button" className={`btn-outline${page === value ? " is-selected" : ""}`} onClick={() => setPage(value)}>{value}</button>;
              })}
              {totalPages > 5 ? <span>...</span> : null}
              {totalPages > 5 ? <button type="button" className="btn-outline" onClick={() => setPage(totalPages)}>{totalPages}</button> : null}
              <button type="button" className="btn-outline" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
            <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={10}>10 por pagina</option>
              <option value={25}>25 por pagina</option>
              <option value={50}>50 por pagina</option>
            </select>
          </footer>
        </section>


        <section className="neighborhoods-tip">
          <CircleAlert size={24} strokeWidth={2} />
          <div>
            <strong>¿Sabias que?</strong>
            <span>Puedes editar el costo directamente haciendo clic sobre el valor en la columna de costo domicilio.</span>
          </div>
          <button type="button" className="btn-outline">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="neighborhoods-import-input"
              onChange={importExcel}
            />
            <span onClick={() => importInputRef.current?.click()}>
              <Upload size={17} strokeWidth={2} />
              Importar Excel
            </span>
          </button>
        </section>
      </main>
    </div>
  );
}

function NeighborhoodRow({
  item,
  editingId,
  editForm,
  saving,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onQuickCostSave,
  setEditForm,
}) {
  const [isCostEditing, setIsCostEditing] = useState(false);
  const [draftCost, setDraftCost] = useState(String(Number(item.costoDomicilio || 0)));
  const isEditingRow = editingId === item.idBarrio;

  useEffect(() => {
    setDraftCost(String(Number(item.costoDomicilio || 0)));
  }, [item.costoDomicilio]);

  const commitCost = () => {
    setIsCostEditing(false);
    onQuickCostSave(item, draftCost);
  };

  return (
    <tr className="neighborhoods-data-row">
      <td data-label="Barrio">
        {isEditingRow ? (
          <input value={editForm.nombreBarrio} onChange={event => setEditForm(current => ({ ...current, nombreBarrio: event.target.value }))} />
        ) : item.nombreBarrio || "-"}
      </td>
      <td data-label="Zona">
        {isEditingRow ? (
          <input type="number" min="0" value={editForm.zonaID} onChange={event => setEditForm(current => ({ ...current, zonaID: event.target.value }))} />
        ) : resolveZoneLabel(item)}
      </td>
      <td data-label="Costo domicilio">
        {isEditingRow ? (
          <input type="number" min="0" value={editForm.costoDomicilio} onChange={event => setEditForm(current => ({ ...current, costoDomicilio: event.target.value }))} />
        ) : isCostEditing ? (
          <span className="neighborhoods-cost-input is-editing">
            <input
              type="number"
              min="0"
              value={draftCost}
              autoFocus
              onChange={event => setDraftCost(event.target.value)}
              onBlur={commitCost}
              onKeyDown={event => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setDraftCost(String(Number(item.costoDomicilio || 0)));
                  setIsCostEditing(false);
                }
              }}
            />
            <Pencil size={14} strokeWidth={2} />
          </span>
        ) : (
          <button type="button" className="neighborhoods-cost-display" onClick={() => setIsCostEditing(true)}>
            <strong>{formatCurrency(item.costoDomicilio)}</strong>
            <Pencil size={14} strokeWidth={2} />
          </button>
        )}
      </td>
      <td data-label="Estado">
        <span className={`neighborhoods-status ${item.activo === false ? "is-inactive" : "is-active"}`}>
          {item.activo === false ? "Inactivo" : "Activo"}
        </span>
      </td>
      <td data-label="Acciones">
        <div className="neighborhoods-row-actions">
          {isEditingRow ? (
            <>
              <button type="button" className="btn-primary" onClick={() => onSaveEdit(item)} disabled={saving}>Guardar</button>
              <button type="button" className="btn-outline" onClick={onCancelEdit} disabled={saving}>Cancelar</button>
            </>
          ) : (
            <details className="neighborhoods-context-menu">
              <summary aria-label={`Acciones para ${item.nombreBarrio || "barrio"}`}>
                <MoreVertical size={18} strokeWidth={2} />
              </summary>
              <div>
                <button type="button" onClick={() => onStartEdit(item)}>Editar barrio</button>
                <button type="button" onClick={() => setIsCostEditing(true)}>Editar costo</button>
                <button type="button" className="is-danger" onClick={() => onDelete(item.idBarrio)} disabled={saving}>Borrar</button>
              </div>
            </details>
          )}
        </div>
      </td>
    </tr>
  );
}
