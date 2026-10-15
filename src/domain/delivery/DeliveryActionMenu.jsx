import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Native dialogs supply focus containment and live above overflow containers.
export function DeliveryDialog({ title, onClose, locked = false, children, className = "", anchor }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const position = () => {
      if (!anchor?.current) return;
      const rect = anchor.current.getBoundingClientRect();
      dialog.style.left = `${Math.max(8, Math.min(rect.right - dialog.offsetWidth, innerWidth - dialog.offsetWidth - 8))}px`;
      dialog.style.top = `${Math.max(8, Math.min(rect.bottom + 4, innerHeight - dialog.offsetHeight - 8))}px`;
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [anchor]);
  return createPortal(<dialog ref={ref} className={`dispatch-dialog ${className}`} aria-label={title}
    onCancel={event => { event.preventDefault(); if (!locked) close.current(); }}
    onClick={event => {
      if (locked || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close.current();
    }}>{children}</dialog>, document.body);
}

export function DeliveryActionMenu({ row, busy, onOpen, onMap, onEvidence, onNovelty, onStatus }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const actions = [["Ver detalle", onOpen], ["Ver mapa", onMap], ["Evidencias", onEvidence], ["Novedades", onNovelty], ["Cambiar estado", onStatus]];
  return <>
    <button ref={anchor} type="button" className="dispatch-more" aria-label={`Acciones del pedido ${row.code}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>•••</button>
    {open && <DeliveryDialog title={`Acciones del pedido ${row.code}`} anchor={anchor} className="dispatch-action-popover" onClose={() => setOpen(false)}>
      <div className="dispatch-action-list" onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
        {actions.map(([label, action]) => <button key={label} type="button" disabled={label === "Cambiar estado" && busy} onClick={() => { setOpen(false); action(row.item); }}>{label}</button>)}
      </div>
    </DeliveryDialog>}
  </>;
}
