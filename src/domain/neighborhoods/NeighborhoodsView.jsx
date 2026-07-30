import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CircleAlert, Download, MapPin, MoreVertical, Pencil, Plus, Search, TrendingUp, Upload } from "lucide-react";
import { formatCurrency, resolveZoneLabel } from "./neighborhoodsDomain.js";
export function NeighborhoodsHeader({ displayUserName, onExport, onToggleCreate, toggleSidebar }) {
  return (
    <header className="neighborhoods-hero">
      <div><button type="button" className="sidebar-trigger" onClick={toggleSidebar}>Menu</button><h1>Barrios</h1><p>Administra los costos de domicilio por barrio y zona.</p><span className="orders-user-pill"><span aria-hidden="true" /> Sesion activa: {displayUserName}</span></div>
      <div className="neighborhoods-hero-actions">
        <button type="button" className="btn-outline" onClick={onExport}><Download size={17} strokeWidth={2} />Exportar Excel</button>
        <button type="button" className="btn-primary" onClick={onToggleCreate}><Plus size={18} strokeWidth={2} />Nuevo barrio</button>
      </div>
    </header>
  );
}
export function NeighborhoodsMetrics({ metrics }) {
  const cards = [
    { key: "total", tone: "is-pink", Icon: MapPin, value: metrics.total, label: "Barrios configurados" },
    { key: "average", tone: "is-green", Icon: TrendingUp, value: formatCurrency(metrics.average), label: "Costo promedio" },
    { key: "highest", tone: "is-purple", Icon: ArrowUp, value: formatCurrency(metrics.highest), label: "Costo mas alto" },
    { key: "lowest", tone: "is-orange", Icon: ArrowDown, value: formatCurrency(metrics.lowest), label: "Costo mas bajo" },
  ];
  return <section className="neighborhoods-metrics" aria-label="Resumen barrios">{cards.map(({ key, tone, Icon, value, label }) => <article key={key}><span className={tone}><Icon size={24} strokeWidth={2} /></span><div><strong>{value}</strong><small>{label}</small></div></article>)}</section>;
}
export function NeighborhoodCreatePanel({ form, saving, onChangeForm, onCreate }) {
  return (
    <section className="neighborhoods-create-panel">
      <div className="delivery-section-head"><h4>Crear barrio</h4><span><Plus size={15} strokeWidth={2} aria-hidden="true" /> Nuevo registro</span></div>
      <div className="neighborhoods-create-grid">
        <label>Zona ID<input type="number" min="0" value={form.zonaID} onChange={event => onChangeForm("zonaID", event.target.value)} placeholder="Ej: 1" /></label>
        <label>Nombre barrio<input type="text" value={form.nombreBarrio} onChange={event => onChangeForm("nombreBarrio", event.target.value)} placeholder="Nombre del barrio" /></label>
        <label>Costo domicilio<input type="number" min="0" step="0.01" value={form.costoDomicilio} onChange={event => onChangeForm("costoDomicilio", event.target.value)} placeholder="0" /></label>
        <label>Activo<select value={form.activo ? "1" : "0"} onChange={event => onChangeForm("activo", event.target.value === "1")}><option value="1">Si</option><option value="0">No</option></select></label>
        <button type="button" className="btn-primary" onClick={onCreate} disabled={saving}>{saving ? "Guardando..." : "Crear barrio"}</button>
      </div>
    </section>
  );
}
export function NeighborhoodsBoard({ costFilter, editForm, editingId, estadoFilter, page, pageEnd, pageItems, pageSize, pageStart, saving, search, sortOrder, sortedCount, totalPages, zonaFilter, zoneOptions, onCancelEdit, onDelete, onQuickCostSave, onSaveEdit, onStartEdit, setCostFilter, setEditForm, setEstadoFilter, setPage, setPageSize, setSearch, setSortOrder, setZonaFilter }) {
  const resetPage = setter => event => { setter(event.target.value); setPage(1); };
  return (
    <section className="neighborhoods-board">
      <div className="neighborhoods-toolbar">
        <label className="neighborhoods-search"><Search size={18} strokeWidth={2} /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar barrio..." /></label>
        <select value={estadoFilter} onChange={resetPage(setEstadoFilter)}><option value="todos">Estado: Todos</option><option value="activos">Estado: Activos</option><option value="inactivos">Estado: Inactivos</option></select>
        <select value={zonaFilter} onChange={resetPage(setZonaFilter)}><option value="todas">Zona: Todas</option>{zoneOptions.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select>
        <select value={costFilter} onChange={resetPage(setCostFilter)}><option value="todos">Costo: Todos</option><option value="bajo_promedio">Costo: Bajo/promedio</option><option value="alto_promedio">Costo: Alto/promedio</option><option value="sin_costo">Costo: Sin costo</option></select>
        <select value={sortOrder} onChange={event => setSortOrder(event.target.value)}><option value="nombre_asc">Ordenar por: Barrio A-Z</option><option value="nombre_desc">Ordenar por: Barrio Z-A</option><option value="costo_desc">Costo mayor a menor</option><option value="costo_asc">Costo menor a mayor</option></select>
      </div>
      <div className="neighborhoods-table-shell"><table className="neighborhoods-table"><thead><tr><th>Barrio</th><th>Zona</th><th>Costo domicilio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{pageItems.length === 0 ? <tr><td colSpan={5}>No hay barrios para el filtro seleccionado.</td></tr> : pageItems.map(item => <NeighborhoodRow key={item.idBarrio} item={item} editingId={editingId} editForm={editForm} saving={saving} onStartEdit={onStartEdit} onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} onDelete={onDelete} onQuickCostSave={onQuickCostSave} setEditForm={setEditForm} />)}</tbody></table></div>
      <NeighborhoodsPager page={page} pageEnd={pageEnd} pageSize={pageSize} pageStart={pageStart} sortedCount={sortedCount} totalPages={totalPages} setPage={setPage} setPageSize={setPageSize} />
    </section>
  );
}
function NeighborhoodsPager({ page, pageEnd, pageSize, pageStart, sortedCount, totalPages, setPage, setPageSize }) {
  return (
    <footer className="neighborhoods-pager"><span>Mostrando {pageStart} a {pageEnd} de {sortedCount} barrios</span><div><button type="button" className="btn-outline" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft size={16} strokeWidth={2} /></button>{Array.from({ length: Math.min(totalPages, 5) }, (_, index) => { const value = index + 1; return <button key={value} type="button" className={`btn-outline${page === value ? " is-selected" : ""}`} onClick={() => setPage(value)}>{value}</button>; })}{totalPages > 5 ? <span>...</span> : null}{totalPages > 5 ? <button type="button" className="btn-outline" onClick={() => setPage(totalPages)}>{totalPages}</button> : null}<button type="button" className="btn-outline" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}><ChevronRight size={16} strokeWidth={2} /></button></div><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10 por pagina</option><option value={25}>25 por pagina</option><option value={50}>50 por pagina</option></select></footer>
  );
}
function NeighborhoodRow({ item, editingId, editForm, saving, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onQuickCostSave, setEditForm }) {
  const [isCostEditing, setIsCostEditing] = useState(false);
  const [draftCost, setDraftCost] = useState(String(Number(item.costoDomicilio || 0)));
  const isEditingRow = editingId === item.idBarrio;
  useEffect(() => { setDraftCost(String(Number(item.costoDomicilio || 0))); }, [item.costoDomicilio]);
  const commitCost = () => { setIsCostEditing(false); onQuickCostSave(item, draftCost); };
  return (
    <tr className="neighborhoods-data-row">
      <td data-label="Barrio">{isEditingRow ? <input value={editForm.nombreBarrio} onChange={event => setEditForm(current => ({ ...current, nombreBarrio: event.target.value }))} /> : item.nombreBarrio || "-"}</td>
      <td data-label="Zona">{isEditingRow ? <input type="number" min="0" value={editForm.zonaID} onChange={event => setEditForm(current => ({ ...current, zonaID: event.target.value }))} /> : resolveZoneLabel(item)}</td>
      <td data-label="Costo domicilio">{isEditingRow ? <input type="number" min="0" value={editForm.costoDomicilio} onChange={event => setEditForm(current => ({ ...current, costoDomicilio: event.target.value }))} /> : isCostEditing ? <span className="neighborhoods-cost-input is-editing"><input type="number" min="0" value={draftCost} autoFocus onChange={event => setDraftCost(event.target.value)} onBlur={commitCost} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraftCost(String(Number(item.costoDomicilio || 0))); setIsCostEditing(false); } }} /><Pencil size={14} strokeWidth={2} /></span> : <button type="button" className="neighborhoods-cost-display" onClick={() => setIsCostEditing(true)}><strong>{formatCurrency(item.costoDomicilio)}</strong><Pencil size={14} strokeWidth={2} /></button>}</td>
      <td data-label="Estado"><span className={`neighborhoods-status ${item.activo === false ? "is-inactive" : "is-active"}`}>{item.activo === false ? "Inactivo" : "Activo"}</span></td>
      <td data-label="Acciones"><div className="neighborhoods-row-actions">{isEditingRow ? <><button type="button" className="btn-primary" onClick={() => onSaveEdit(item)} disabled={saving}>Guardar</button><button type="button" className="btn-outline" onClick={onCancelEdit} disabled={saving}>Cancelar</button></> : <details className="neighborhoods-context-menu"><summary aria-label={`Acciones para ${item.nombreBarrio || "barrio"}`}><MoreVertical size={18} strokeWidth={2} /></summary><div><button type="button" onClick={() => onStartEdit(item)}>Editar barrio</button><button type="button" onClick={() => setIsCostEditing(true)}>Editar costo</button><button type="button" className="is-danger" onClick={() => onDelete(item.idBarrio)} disabled={saving}>Borrar</button></div></details>}</div></td>
    </tr>
  );
}
export function NeighborhoodsTip({ importInputRef, onImport }) {
  return (
    <section className="neighborhoods-tip"><CircleAlert size={24} strokeWidth={2} /><div><strong>Sabias que?</strong><span>Puedes editar el costo directamente haciendo clic sobre el valor en la columna de costo domicilio.</span></div><button type="button" className="btn-outline"><input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="neighborhoods-import-input" onChange={onImport} /><span onClick={() => importInputRef.current?.click()}><Upload size={17} strokeWidth={2} />Importar Excel</span></button></section>
  );
}