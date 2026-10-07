import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { todayIsoDate } from "../ordersDomain.js";

// Native dialog provides focus containment, Escape and focus restoration.
export function OrdersFilterPopover({ anchor, title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const position = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = dialog.offsetWidth;
      const height = dialog.offsetHeight;
      dialog.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
      dialog.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - height - 8))}px`;
    };
    position();
    window.addEventListener("resize", position);
    return () => { window.removeEventListener("resize", position); dialog.close(); anchor.current?.focus(); };
  }, [anchor]);
  return createPortal(
    <dialog ref={ref} className="orders-filter-popover" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
      <div className="of-popover-head"><strong>{title}</strong><button type="button" aria-label={`Cerrar ${title}`} onClick={onClose}><X size={16} /></button></div>
      {children}
    </dialog>, document.body
  );
}

const isoDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function OrdersDatePicker({ filters, onApply, onClose }) {
  const today = todayIsoDate();
  const [start, setStart] = useState(filters.fechaDesde || "");
  const [end, setEnd] = useState(filters.fechaHasta || "");
  const [range, setRange] = useState(Boolean(filters.fechaHasta && filters.fechaHasta !== filters.fechaDesde));
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [month, setMonth] = useState(() => new Date(`${filters.fechaDesde || today}T12:00:00`));
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const valid = Boolean(start && (!range || (end && end >= start)));
  const selectDay = value => {
    if (!range || !selectingEnd) { setStart(value); setEnd(value); setSelectingEnd(range); }
    else { setStart(value < start ? value : start); setEnd(value < start ? start : value); setSelectingEnd(false); }
  };
  return <div className="of-calendar">
    <div className="of-segments" role="group" aria-label="Selección de fechas">
      <button type="button" aria-pressed={!range} onClick={() => { setRange(false); setEnd(start); setSelectingEnd(false); }}>Una fecha</button>
      <button type="button" aria-pressed={range} onClick={() => { setRange(true); setSelectingEnd(false); }}>Un rango</button>
    </div>
    <div className="of-month-nav">
      <button type="button" aria-label="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}><ChevronLeft size={16} /></button>
      <strong aria-live="polite">{month.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}</strong>
      <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}><ChevronRight size={16} /></button>
    </div>
    <div className="of-calendar-grid" role="group" aria-label="Calendario">
      {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => <span key={`weekday-${index}`} aria-hidden="true">{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: dayCount }, (_, index) => {
        const date = new Date(month.getFullYear(), month.getMonth(), index + 1, 12);
        const value = isoDate(date);
        return <button type="button" key={value} aria-label={date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })} aria-pressed={value === start || value === end} aria-current={value === today ? "date" : undefined} className={start && end && value > start && value < end ? "of-in-range" : ""} onClick={() => selectDay(value)}>{index + 1}</button>;
      })}
    </div>
    <div className="of-date-inputs">
      <label>Desde<input type="date" value={start} onChange={event => { setStart(event.target.value); if (!range) setEnd(event.target.value); setSelectingEnd(false); }} /></label>
      {range && <label>Hasta<input type="date" value={end} min={start || undefined} onChange={event => { setEnd(event.target.value); setSelectingEnd(false); }} /></label>}
    </div>
    {range && start && end && end < start && <p role="alert">La fecha final debe ser igual o posterior a la inicial.</p>}
    <div className="of-popover-footer"><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="of-apply" disabled={!valid} onClick={() => onApply(start, range ? end : start)}>Aplicar fechas</button></div>
  </div>;
}
