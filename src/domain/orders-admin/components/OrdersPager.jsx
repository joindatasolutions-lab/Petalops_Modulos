import { ChevronLeft, ChevronRight } from "lucide-react";

import { PAGE_SIZE_OPTIONS } from "../ordersAdminConstants.js";

/**
 * Paginador del listado de pedidos.
 *
 * Recibe el estado de paginacion ya calculado y notifica cambios al contenedor.
 */

export function OrdersPager({
  total,
  visibleFrom,
  visibleTo,
  page,
  pages,
  pageSize,
  pagerItems,
  onPageChange,
  onPageSizeChange,
}) {
  if (total <= 0) return null;

  return (
    <footer className="records-pager orders-records-pager" aria-label="Paginacion de pedidos">
      <p>Mostrando {visibleFrom} a {visibleTo} de {total} pedidos</p>
      <nav className="records-pager-pages" aria-label="Paginas de pedidos">
        <button
          type="button"
          className="records-pager-arrow"
          title="Ir a la pagina anterior"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
        {pagerItems.map(item => (
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              className={`records-pager-page${item === page ? " is-active" : ""}`}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="records-pager-ellipsis">...</span>
          )
        ))}
        <button
          type="button"
          className="records-pager-arrow"
          title="Ir a la pagina siguiente"
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
        >
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </nav>
      <label className="records-pager-size">
        <span>Mostrar</span>
        <select
          value={pageSize}
          onChange={event => onPageSizeChange(Number(event.target.value))}
          title="Registros por pagina"
        >
          {PAGE_SIZE_OPTIONS.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <span>por pagina</span>
      </label>
    </footer>
  );
}
