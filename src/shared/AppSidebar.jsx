import {
  ClientesMenuIcon,
  ContabilidadMenuIcon,
  DomiciliosMenuIcon,
  InventarioMenuIcon,
  PedidosMenuIcon,
  PipelineMenuIcon,
  ProduccionMenuIcon,
  TrazabilidadMenuIcon,
  UsuariosMenuIcon,
} from "./MenuIcons.jsx";

const SIDEBAR_SECTIONS = [
  {
    key: "ventas",
    label: "VENTAS",
    items: [
      { key: "pipeline", label: "Pipeline", Icon: PipelineMenuIcon, canViewKey: "pipeline", goKey: "pipeline" },
      { key: "pedidos", label: "Pedidos", Icon: PedidosMenuIcon, canViewKey: "pedidos", goKey: "pedidos" },
    ],
  },
  {
    key: "operaciones",
    label: "OPERACIONES",
    items: [
      { key: "produccion", label: "Producción", Icon: ProduccionMenuIcon, canViewKey: "produccion", goKey: "produccion" },
      { key: "domicilios", label: "Domicilios", Icon: DomiciliosMenuIcon, canViewKey: "domicilios", goKey: "domicilios" },
      { key: "inventario", label: "Inventario", Icon: InventarioMenuIcon, canViewKey: "inventario", goKey: "inventario" },
    ],
  },
  {
    key: "administracion",
    label: "ADMINISTRACIÓN",
    items: [
      { key: "contabilidad", label: "Contabilidad", Icon: ContabilidadMenuIcon, canViewKey: "contabilidad", goKey: "contabilidad" },
      { key: "trazabilidad", label: "Trazabilidad", Icon: TrazabilidadMenuIcon, canViewKey: "trazabilidad", goKey: "trazabilidad" },
      { key: "clientes", label: "Clientes", Icon: ClientesMenuIcon, canViewKey: "clientes", goKey: "clientes" },
      { key: "usuarios", label: "Gestión usuarios", Icon: UsuariosMenuIcon, canViewKey: "usuarios", goKey: "usuarios" },
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
}) {
  const renderNavItem = item => {
    if (!permissions?.[item.canViewKey]) return null;
    const isActive = activeKey === item.key;
    const count = Number(badges?.[item.key]);
    const hasBadge = Number.isFinite(count) && count > 0;

    return (
      <button
        key={item.key}
        type="button"
        className={`sidebar-nav-btn${isActive ? " is-active" : ""}`}
        onClick={() => {
          closeSidebarMobile?.();
          navigation?.[item.goKey]?.();
        }}
        title={item.label}
      >
        <span className="sidebar-nav-icon"><item.Icon /></span>
        <span className="sidebar-nav-text">{item.label}</span>
        {hasBadge ? <span className="sidebar-nav-badge">{count}</span> : null}
      </button>
    );
  };

  return (
    <>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
          <p className="sidebar-brand-subtitle">Gestión floral</p>
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
          <button type="button" className="sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
            <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
            <span className="sidebar-logout-text">Cerrar sesión</span>
          </button>
          <button
            type="button"
            className="sidebar-pin-btn"
            onClick={toggleSidebar}
            title={sidebarPinned ? "Contraer menú" : "Expandir menú"}
          >
            {sidebarPinned ? "←" : "→"}
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="sidebar-mobile-fab"
        aria-label={sidebarMobileOpen ? "Cerrar menú" : "Abrir menú"}
        onClick={toggleSidebar}
      >
        ☰
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
