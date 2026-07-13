import {
  ClipboardList,
  Flower2,
  LogOut,
  MapPin,
  Menu,
  Package2,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShieldUser,
  Truck,
  UsersRound,
  Workflow,
} from "lucide-react";

const SIDEBAR_SECTIONS = [
  {
    key: "ventas",
    label: "VENTAS",
    items: [
      { key: "pipeline", label: "Pipeline", Icon: Workflow, canViewKey: "pipeline", goKey: "pipeline" },
      { key: "pedidos", label: "Pedidos", Icon: ClipboardList, canViewKey: "pedidos", goKey: "pedidos" },
    ],
  },
  {
    key: "operaciones",
    label: "OPERACIONES",
    items: [
      { key: "produccion", label: "Producción", Icon: Flower2, canViewKey: "produccion", goKey: "produccion" },
      { key: "domicilios", label: "Domicilios", Icon: Truck, canViewKey: "domicilios", goKey: "domicilios" },
      { key: "barrios", label: "Barrios", Icon: MapPin, canViewKey: "barrios", goKey: "barrios" },
      { key: "inventario", label: "Inventario", Icon: Package2, canViewKey: "inventario", goKey: "inventario" },
    ],
  },
  {
    key: "administracion",
    label: "ADMINISTRACIÓN",
    items: [
      { key: "contabilidad", label: "Contabilidad", Icon: Receipt, canViewKey: "contabilidad", goKey: "contabilidad" },
      { key: "trazabilidad", label: "Trazabilidad", Icon: Workflow, canViewKey: "trazabilidad", goKey: "trazabilidad" },
      { key: "clientes", label: "Clientes", Icon: UsersRound, canViewKey: "clientes", goKey: "clientes" },
      { key: "usuarios", label: "Gestión usuarios", Icon: ShieldUser, canViewKey: "usuarios", goKey: "usuarios" },
    ],
  },
];

export function AppSidebar({
  activeKey,
  sidebarPinned,
  sidebarMobileOpen,
  toggleSidebar,
  closeSidebarMobile,
  onLogout,
  permissions,
  navigation,
  badges = {},
  sessionLabel = "",
}) {
  const renderNavItem = item => {
    if (!permissions?.[item.canViewKey]) return null;
    const isActive = activeKey === item.key;
    const count = Number(badges?.[item.key]);
    const hasBadge = Number.isFinite(count) && count > 0;
    const Icon = item.Icon;

    return (
      <button
        key={item.key}
        type="button"
        className={`sidebar-nav-btn${isActive ? " is-active" : ""}`}
        data-label={item.label}
        onClick={() => {
          closeSidebarMobile?.();
          navigation?.[item.goKey]?.();
        }}
        title={item.label}
      >
        <span className="sidebar-nav-icon"><Icon size={20} strokeWidth={2} /></span>
        <span className="sidebar-nav-text">{item.label}</span>
        {hasBadge ? <span className="sidebar-nav-badge">{count}</span> : null}
      </button>
    );
  };

  return (
    <>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/logo.png" alt="" className="sidebar-brand-logo-full" />
          <div className="sidebar-brand-wordmark">
            <strong>PetalOps</strong>
            <span>GESTION OPERATIVA</span>
          </div>
          {sessionLabel ? (
            <span className="sidebar-session-pill">
              <span className="sidebar-session-dot" aria-hidden="true" />
              <span className="sidebar-session-text">{sessionLabel}</span>
            </span>
          ) : null}
        </div>

        <nav className="sidebar-nav" aria-label="Módulos">
          {SIDEBAR_SECTIONS.map(section => {
            const sectionItems = section.items.map(renderNavItem).filter(Boolean);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.key} className="sidebar-nav-section">
                <p className="sidebar-section-label">{section.label}</p>
                <div className="sidebar-nav-group">
                  {sectionItems}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <hr className="sidebar-divider" />
          <button type="button" className="sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión" data-label="Cerrar sesión">
            <span className="sidebar-logout-icon" aria-hidden="true"><LogOut size={20} strokeWidth={2} /></span>
            <span className="sidebar-logout-text">Cerrar sesión</span>
          </button>
          <button
            type="button"
            className="sidebar-pin-btn"
            onClick={toggleSidebar}
            title={sidebarPinned ? "Contraer menú" : "Expandir menú"}
            data-label={sidebarPinned ? "Contraer menú" : "Expandir menú"}
          >
            {sidebarPinned ? <PanelLeftClose size={20} strokeWidth={2} /> : <PanelLeftOpen size={20} strokeWidth={2} />}
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="sidebar-mobile-fab"
        aria-label={sidebarMobileOpen ? "Cerrar menú" : "Abrir menú"}
        onClick={toggleSidebar}
      >
        {sidebarMobileOpen ? <PanelLeftClose size={21} strokeWidth={2} /> : <Menu size={21} strokeWidth={2} />}
      </button>

      <button
        type="button"
        className="sidebar-overlay"
        aria-label="Cerrar menú"
        onClick={closeSidebarMobile}
      />
    </>
  );
}
