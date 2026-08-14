import { BarChart3, ChevronDown, Plus, RefreshCw, UsersRound } from "lucide-react";
import { CLIENTS_VIEWS } from "./clientsDomain.js";
const CLIENTS_VIEW_ICONS = {
  clientes: UsersRound,
  metricas: BarChart3,
};
export function ClientsHeader({
  activeView,
  clientsMenuOpen,
  clientsMenuRef,
  loading,
  onCreate,
  onRefresh,
  onSelectView,
  onToggleMenu,
}) {
  const activeOption = CLIENTS_VIEWS.find(item => item.key === activeView) || CLIENTS_VIEWS[0];
  const ActiveIcon = CLIENTS_VIEW_ICONS[activeOption.key] || UsersRound;
  return (
    <header className="orders-admin-header orders-page-header clients-page-header">
      <div className="orders-page-heading">
        <div className="orders-page-title-row">
          <h1>Clientes</h1>
        </div>
      </div>
      <div className="orders-header-side">
        <div className="header-actions">
          <div className="accounting-menu-dropdown clients-menu-dropdown" ref={clientsMenuRef}>
            <button
              type="button"
              className={`btn-outline accounting-menu-trigger clients-menu-trigger${clientsMenuOpen ? " is-open" : ""}`}
              onClick={onToggleMenu}
              aria-expanded={clientsMenuOpen}
              aria-haspopup="menu"
            >
              <ActiveIcon size={18} strokeWidth={2} aria-hidden="true" />
              <span>{activeOption.label}</span>
              <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            {clientsMenuOpen ? <ClientsViewMenu activeView={activeView} onSelectView={onSelectView} /> : null}
          </div>
          <button type="button" className="btn-primary orders-header-refresh" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
            <span>{loading ? "Actualizando..." : "Actualizar"}</span>
          </button>
          <button type="button" className="btn-primary orders-header-refresh" onClick={onCreate}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            <span>Agregar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
function ClientsViewMenu({ activeView, onSelectView }) {
  return (
    <div className="accounting-menu-panel clients-menu-panel" role="menu">
      {CLIENTS_VIEWS.map(item => {
        const Icon = CLIENTS_VIEW_ICONS[item.key] || UsersRound;
        return (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            className={activeView === item.key ? "is-active" : ""}
            onClick={() => onSelectView(item.key)}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
