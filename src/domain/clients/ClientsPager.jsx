import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paginador del listado de clientes (paginacion en cliente sobre la lista ya cargada).
 * Reutiliza los mismos estilos "records-pager" que ya usa OrdersPager.
 */

export function ClientsPager({ total, visibleFrom, visibleTo, page, pages, pagerItems, onPageChange }) {
  if (total <= 0 || pages <= 1) return null;

  return (
    <footer className="records-pager clients-records-pager" aria-label="Paginacion de clientes">
      <p>Mostrando {visibleFrom} a {visibleTo} de {total} clientes</p>
      <nav className="records-pager-pages" aria-label="Paginas de clientes">
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
    </footer>
  );
}
