import { useRef, useState } from "react";
import { CalendarDays, Truck, Filter, RotateCw, ChevronDown, X, ListFilter } from "lucide-react";
import { todayIsoDate } from "../ordersDomain.js";
import { OrdersDatePicker, OrdersFilterPopover } from "./OrdersFilterPopover.jsx";
import "./OrdersFilters.css";

const STATES = [["", "Todos los estados"], ["CREADO", "Creados"], ["APROBADO", "Aprobados"], ["CANCELADO", "Cancelados / rechazados"]];
const dateText = value => value ? value.split("-").reverse().join("/") : "…";

export function OrdersFilters({ filters, onApplyDatePreset, onApplyDateRange, onFilterChange, onClearFilters, onClearDateRange, paymentOptions = [], total = 0, loading = false }) {
  const [popover, setPopover] = useState(null);
  const dateButton = useRef(null);
  const additionalButton = useRef(null);
  const searching = Boolean(String(filters.q || "").trim());
  const hasDates = Boolean(filters.fechaDesde || filters.fechaHasta);
  const isToday = filters.soloEntregasHoy || (filters.fechaDesde === todayIsoDate() && filters.fechaHasta === filters.fechaDesde && filters.datePeriod !== "custom");
  const period = isToday ? "hoy" : hasDates ? "custom" : "todos";
  const byDelivery = Boolean(filters.filtrarPorEntrega || filters.soloEntregasHoy);
  const dateSubject = byDelivery ? "Pedidos con entrega programada" : "Pedidos creados";
  const dateSummary = searching ? "Filtro de fecha en pausa mientras buscas." : period === "todos" ? "Sin límite de fecha." : period === "hoy" ? `${dateSubject} para hoy.` :
    filters.fechaDesde === filters.fechaHasta ? `${dateSubject} el ${dateText(filters.fechaDesde)}.` :
    !filters.fechaDesde ? `${dateSubject} hasta el ${dateText(filters.fechaHasta)}.` :
    !filters.fechaHasta ? `${dateSubject} desde el ${dateText(filters.fechaDesde)}.` :
    `${dateSubject} del ${dateText(filters.fechaDesde)} al ${dateText(filters.fechaHasta)}.`;
  const additionalCount = [filters.estado, filters.metodoPago, filters.soloTienda, filters.sinImprimir].filter(Boolean).length;
  const stateLabel = STATES.find(([value]) => value === filters.estado)?.[1];
  const rangeLabel = filters.fechaDesde === filters.fechaHasta ? dateText(filters.fechaDesde) : `${dateText(filters.fechaDesde)} – ${dateText(filters.fechaHasta)}`;
  const chips = [
    ...(filters.estado ? [{ label: `Estado: ${stateLabel}`, clear: () => onFilterChange("estado", "") }] : []),
    ...(filters.metodoPago ? [{ label: `Pago: ${filters.metodoPago}`, clear: () => onFilterChange("metodoPago", "") }] : []),
    ...(filters.soloTienda ? [{ label: "Recogida en tienda", clear: () => onFilterChange("soloTienda", false) }] : []),
    ...(filters.sinImprimir ? [{ label: "Sin imprimir", clear: () => onFilterChange("sinImprimir", false) }] : []),
  ];
  return <section className="orders-filter-panel" aria-label="Filtros de pedidos">
    <div className="of-bar">
      <div className="of-date-group">
        <span className="of-group-label">Buscar pedidos por</span>
        <div className="of-date-type" role="group" aria-label="Tipo de fecha: buscar pedidos por">
          {[[false, "Fecha de creación", CalendarDays], [true, "Fecha de entrega", Truck]].map(([value, label, Icon]) => <button key={label} type="button" aria-pressed={byDelivery === value} onClick={() => onFilterChange("filtrarPorEntrega", value)}><Icon size={14} aria-hidden="true" />{label}</button>)}
        </div>
      </div>
      <div className="of-period-group">
      <span className="of-group-label">Período</span>
      <div className="of-period-buttons" role="group" aria-label="Período">
        <button type="button" aria-pressed={period === "hoy"} onClick={() => onApplyDatePreset("hoy")}>Hoy</button>
        <button type="button" aria-pressed={period === "todos"} onClick={onClearDateRange}>Todas las fechas</button>
        <button ref={dateButton} type="button" aria-label={period === "custom" ? `Elegir fechas: ${rangeLabel}` : "Elegir fechas"} aria-pressed={period === "custom"} aria-haspopup="dialog" aria-expanded={popover === "dates"} onClick={() => setPopover("dates")}><CalendarDays size={14} /><span className="of-range-label">{period === "custom" ? rangeLabel : "Elegir fechas"}</span><ChevronDown size={12} /></button>
      </div>
      </div>
      <button ref={additionalButton} type="button" className="of-toggle" aria-haspopup="dialog" aria-expanded={popover === "additional"} onClick={() => setPopover("additional")}><Filter size={14} />Filtros adicionales{additionalCount > 0 && <span className="of-count">{additionalCount}</span>}<ChevronDown size={12} /></button>
      <div className="of-result-actions">
      <span className="of-results" aria-live="polite"><ListFilter size={14} />{loading ? "Buscando…" : `${total} pedidos encontrados`}</span>
      <button type="button" className="of-reset" onClick={onClearFilters}><RotateCw size={14} />Restablecer filtros</button>
      </div>
    </div>
    <p className="of-date-summary" aria-live="polite">{dateSummary}</p>
    {(chips.length > 0 || searching) && <div className="of-active">
      {chips.map(chip => <button type="button" key={chip.label} onClick={chip.clear} aria-label={`Quitar ${chip.label}`}>{chip.label}<X size={12} /></button>)}
      {searching && <span className="of-search-note">La búsqueda tiene prioridad sobre todos los filtros. Al borrar el texto, se aplicarán nuevamente.</span>}
    </div>}
    {popover === "dates" && <OrdersFilterPopover anchor={dateButton} title="Elegir fechas" onClose={() => setPopover(null)}><OrdersDatePicker filters={filters} onClose={() => setPopover(null)} onApply={(start, end) => { onApplyDateRange(start, end); setPopover(null); }} /></OrdersFilterPopover>}
    {popover === "additional" && <OrdersFilterPopover anchor={additionalButton} title="Filtros adicionales" onClose={() => setPopover(null)}>
      <div className="of-additional">
        <label>Estado del pedido<select value={filters.estado} onChange={event => onFilterChange("estado", event.target.value)}>{STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Método de pago<select value={filters.metodoPago} onChange={event => onFilterChange("metodoPago", event.target.value)}><option value="">Todos los métodos</option>{[...new Set(paymentOptions.filter(Boolean))].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Tipo de entrega<select value={filters.soloTienda ? "tienda" : ""} onChange={event => onFilterChange("soloTienda", event.target.value === "tienda")}><option value="">Todas las entregas</option><option value="tienda">Recogida en tienda</option></select></label>
        <label>Impresión de factura<select value={filters.sinImprimir ? "pendiente" : ""} onChange={event => onFilterChange("sinImprimir", event.target.value === "pendiente")}><option value="">Todas las facturas</option><option value="pendiente">Sin imprimir</option></select></label>
      </div>
      <div className="of-popover-footer"><button type="button" onClick={() => setPopover(null)}>Cerrar filtros</button></div>
    </OrdersFilterPopover>}
  </section>;
}
