import { useEffect, useMemo, useRef, useState } from "react";
import "./deliveryDispatchBoard.css";
import { DeliveryActionMenu, DeliveryDialog } from "./DeliveryActionMenu.jsx";

export function DeliveryDispatchBoard({ rows, couriers, contextKey, busy, loading, offline, canAssign, onOpen, onMap, onEvidence, onNovelty, onStatus, onAssign, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [courierId, setCourierId] = useState("");
  const [review, setReview] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState("");
  const previousContext = useRef(contextKey);
  const submitting = useRef(false);
  const selectAll = useRef(null);
  const eligible = rows.filter(row => row.eligible);
  const selected = useMemo(() => rows.filter(row => row.eligible && selectedIds.includes(String(row.id))), [rows, selectedIds]);
  const courier = couriers.find(item => String(item.id) === courierId && item.available);
  const locked = busy || loading || offline;
  const allSelected = eligible.length > 0 && eligible.every(row => selectedIds.includes(String(row.id)));

  useEffect(() => {
    if (previousContext.current === contextKey) return;
    previousContext.current = contextKey;
    if (selectedIds.length) setSelectionNotice("Selección descartada al cambiar los filtros. Selecciona los pedidos de esta vista.");
    setSelectedIds([]);
    setReview(false);
    setAssignmentOpen(false);
    setError("");
  }, [contextKey]);
  useEffect(() => {
    if (loading) return;
    const availableIds = new Set(rows.filter(row => row.eligible).map(row => String(row.id)));
    setSelectedIds(current => {
      const next = current.filter(id => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [rows, loading]);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selected.length > 0 && !allSelected;
  }, [selected.length, allSelected]);
  useEffect(() => { setReview(false); }, [selected.map(row => row.id).join(","), courierId]);

  const changeSelection = ids => { setSelectedIds(ids); setReview(false); setSelectionNotice(""); setError(""); };
  const confirm = async () => {
    if (submitting.current || locked || !canAssign || !review || !courier || !selected.length) return;
    submitting.current = true;
    setError("");
    try {
      const outcome = await onAssign(selected.map(row => row.item), courier.id);
      setResults(outcome);
      // Failures require an explicit refresh and a new selection. A timeout
      // may have committed on the server even when its response was lost.
      setSelectedIds([]);
      setReview(false);
      setAssignmentOpen(false);
    } catch (nextError) {
      setError(nextError?.message || "No se pudo comprobar la disponibilidad. No se inició el lote.");
      setReview(false);
    } finally { submitting.current = false; }
  };

  return (
    <section className="dispatch-workspace" aria-label="Tablero de despacho">
      <div className="dispatch-table-panel">
        <div className="dispatch-table-heading">
          <div><h2>Pedidos para despacho</h2><span>{rows.length} pedidos · {eligible.length} sin asignar</span></div>
          {canAssign && selected.length > 0 && <div className="dispatch-selection-bar" aria-label="Acciones de selección">
            <strong>{selected.length} seleccionados</strong>
            <button type="button" disabled={locked} onClick={() => changeSelection([])}>Limpiar selección ({selected.length})</button>
            <button type="button" className="dispatch-primary" disabled={locked} onClick={() => { setReview(false); setAssignmentOpen(true); }}>Asignar domiciliario</button>
          </div>}
        </div>
        {selectionNotice && <p role="status" className="dispatch-table-note">{selectionNotice}</p>}
        <div className="dispatch-table-scroll">
          <table className="dispatch-table">
            <thead><tr>
              {canAssign && <th><input ref={selectAll} type="checkbox" aria-label="Seleccionar todos los pedidos elegibles visibles" checked={allSelected} disabled={locked || !eligible.length} onChange={event => changeSelection(event.target.checked ? eligible.map(row => String(row.id)) : [])} /></th>}
              <th>Pedido</th><th>Hora</th><th>Destinatario / Dirección</th><th>Zona</th><th>Domiciliario</th><th>Estado</th><th>Acciones</th>
            </tr></thead>
            <tbody>{rows.map(row => (
              <tr key={row.id} className={`${selectedIds.includes(String(row.id)) && row.eligible ? "is-batch-selected" : ""} ${row.late ? "is-late" : ""}`}>
                {canAssign && <td><input type="checkbox" aria-label={`Seleccionar pedido ${row.code}`} checked={row.eligible && selectedIds.includes(String(row.id))} disabled={locked || !row.eligible} onChange={event => changeSelection(event.target.checked ? [...selectedIds, String(row.id)] : selectedIds.filter(id => id !== String(row.id)))} title={row.eligible ? "Incluir en el lote" : "Solo se pueden seleccionar entregas pendientes y sin asignar"} /></td>}
                <td><button type="button" className="dispatch-order-link" onClick={() => onOpen(row.item)}>#{row.code}</button>{row.late && <small className="dispatch-warning">Atrasado</small>}</td>
                <td className="dispatch-time" title={row.date}>{row.time}</td>
                <td className="dispatch-destination"><strong>{row.recipient}</strong><span title={row.address}>{row.address}</span>{row.surprise && <small className="dispatch-warning">Es sorpresa · verifica a quién contactar</small>}</td>
                <td>{row.neighborhood}</td><td>{row.courier}</td>
                <td><span className={`dispatch-status is-${row.tone}`}>{row.status}</span></td>
                <td><DeliveryActionMenu row={row} busy={busy} onOpen={onOpen} onMap={onMap} onEvidence={onEvidence} onNovelty={onNovelty} onStatus={onStatus} /></td>
              </tr>
            ))}</tbody>
          </table>
          {!rows.length && <p className="dispatch-empty">{loading ? "Cargando pedidos…" : "No hay pedidos para estos filtros. Cambia la fecha o limpia la búsqueda."}</p>}
        </div>
        <p className="dispatch-table-note">{canAssign ? "Selecciona pedidos sin asignar para agruparlos en un solo despacho." : "Consulta el detalle para supervisar cada entrega."}</p>
      </div>

      {canAssign && assignmentOpen && <DeliveryDialog title="Asignar domiciliario" locked={busy} onClose={() => { setAssignmentOpen(false); setReview(false); }}>
        <div className="dispatch-batch-panel">
        <h2>{review ? "Revisar asignación" : "Asignar lote"}</h2>
        <p aria-live="polite">{selected.length ? `${selected.length} pedidos seleccionados` : "Selecciona pedidos en la lista para empezar."}</p>
        <label>Domiciliario<select aria-label="Domiciliario del lote" value={courierId} disabled={locked} onChange={event => { setCourierId(event.target.value); setReview(false); }}>
          <option value="">Seleccionar domiciliario</option>
          {couriers.map(item => <option key={item.id} value={item.id} disabled={!item.available}>{item.name}{item.available ? ` · ${item.visibleLoad} activos en esta vista` : " · No disponible"}</option>)}
        </select></label>
        {courier && <div className="dispatch-load"><strong>{courier.name}</strong><span>Activos en esta vista: {courier.visibleLoad}</span><span>Después del lote, en esta vista: {courier.visibleLoad + selected.length}</span><small>Conteo limitado a los filtros actuales; no representa todas sus entregas.</small></div>}
        {review && <div className="dispatch-review"><strong>Asignar a {courier?.name}</strong><ul>{selected.map(row => <li key={row.id}>#{row.code} · {row.neighborhood} · {row.time}</li>)}</ul><p>Se comprobará que sigan disponibles antes de asignar.</p></div>}
        <p className="dispatch-batch-note">La asignación puede completarse parcialmente. Verás el resultado de cada pedido.</p>
        {offline && <p role="alert">Sin internet. Reconecta antes de asignar.</p>}
        {error && <p role="alert" className="dispatch-warning">{error}</p>}
        <button type="button" className="dispatch-primary" disabled={locked || !courier || !selected.length} onClick={review ? confirm : () => setReview(true)}>{busy ? "Asignando…" : review ? `Confirmar asignación (${selected.length})` : `Revisar asignación (${selected.length})`}</button>
        {review && <button type="button" disabled={locked} onClick={() => setReview(false)}>Volver a selección</button>}
        <button type="button" disabled={busy} onClick={() => { setAssignmentOpen(false); setReview(false); }}>Cancelar</button>
        </div>
      </DeliveryDialog>}
        {results.length > 0 && <section className="dispatch-results" aria-label="Resultado del lote" aria-live="polite">
          <h3>{results.filter(item => item.status === "success").length} de {results.length} asignados</h3>
          <ul>{results.map(result => <li key={result.item.idEntrega} className={result.status === "success" ? "is-success" : "dispatch-warning"}><strong>#{result.item.numeroPedido || result.item.idEntrega}</strong> {result.message}</li>)}</ul>
          {results.some(item => item.status !== "success") && <><p>Actualiza y vuelve a seleccionar solo los pedidos que sigan sin asignar.</p><button type="button" disabled={busy || loading} onClick={onRefresh}>Actualizar pedidos</button></>}
        </section>}
    </section>
  );
}
