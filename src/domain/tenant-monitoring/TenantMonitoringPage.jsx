import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronRight,
  Gauge,
  RefreshCw,
  ShoppingCart,
  UsersRound,
} from "lucide-react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveTenantId(item) {
  return Number(item?.empresaID ?? item?.empresaId ?? item?.empresa_id ?? item?.id ?? 0);
}

function resolveTenantName(item) {
  return String(item?.nombre || item?.nombreComercial || item?.nombre_comercial || item?.nombreEmpresa || item?.nombre_empresa || "").trim();
}

function tenantSlug(item) {
  return String(item?.empresaSlug || item?.slug || item?.catalogoSlug || item?.catalogo_slug || "").trim();
}

function isDemoTenant(item) {
  const name = normalizeText(resolveTenantName(item)).replace(/\s+/g, "");
  const slug = normalizeText(tenantSlug(item)).replace(/[\s_-]+/g, "");
  return name === "joindata" || name === "petalops" || slug === "joindata" || slug === "petalops";
}

function tenantStatus(value) {
  const status = normalizeText(value);
  if (status === "1" || status === "activo") return "Activo";
  if (status === "0" || status === "inactivo") return "Inactivo";
  return String(value || "-").trim() || "-";
}

function tenantLogoUrl(value) {
  const logoUrl = String(value || "").trim();
  const markdownLink = logoUrl.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
  return markdownLink ? markdownLink[1].replace(/\\_/g, "_") : logoUrl;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CO").format(Number(value || 0));
}

function averageLabel(value) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

export function buildMonitoringRows(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => !isDemoTenant(item))
    .map(item => {
      const id = resolveTenantId(item);
      const slug = tenantSlug(item);
      const pedidosHoy = Number(item?.pedidosHoy ?? item?.pedidos_hoy ?? 0);
      const pedidosMes = Number(item?.pedidosMes ?? item?.pedidos_mes ?? 0);
      const estado = tenantStatus(item?.estado);
      return {
        id,
        nombre: resolveTenantName(item) || `Empresa ${id}`,
        slug,
        logoUrl: tenantLogoUrl(item?.logoUrl || item?.logo_url),
        estado,
        pedidosHoy,
        pedidosMes,
        needsAttention: normalizeText(estado) !== "activo" || pedidosHoy === 0,
      };
    })
    .filter(item => item.id > 0);
}

function buildTotals(rows) {
  const pedidosMes = rows.reduce((sum, row) => sum + row.pedidosMes, 0);
  return {
    tenants: rows.length,
    pedidosHoy: rows.reduce((sum, row) => sum + row.pedidosHoy, 0),
    pedidosMes,
    promedioMes: rows.length ? Math.round((pedidosMes / rows.length) * 10) / 10 : 0,
  };
}

function TenantLogo({ logoUrl, tenantName }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !imageFailed;

  return (
    <span className="tenant-monitoring-avatar">
      {showImage ? (
        <img
          src={logoUrl}
          alt={`Logo de ${tenantName}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Building2 size={18} strokeWidth={2} aria-hidden="true" />
      )}
    </span>
  );
}

export function TenantMonitoringPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewBarrios,
  canViewInventario,
  canViewContabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  canViewTenantMonitoring,
  onLogout,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
  onGoInventario,
  onGoContabilidad,
  onGoClientes,
  onGoUsuarios,
  onGoTenantMonitoring,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const displayUserName = String(session?.nombre || session?.login || "joinadmin").trim() || "joinadmin";

  const loadData = useCallback(async () => {
    if (!canViewTenantMonitoring) return;
    setLoading(true);
    setError("");
    try {
      const nextPayload = await api.listarSeguimientoTenants();
      setPayload(nextPayload || null);
      setLastUpdatedAt(new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date()));
    } catch (nextError) {
      console.error("Error cargando seguimiento de tenants:", nextError);
      setPayload(null);
      setError(nextError?.message || "No fue posible cargar el seguimiento de tenants.");
    } finally {
      setLoading(false);
    }
  }, [api, canViewTenantMonitoring]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(() => buildMonitoringRows(payload?.items), [payload]);
  const totals = useMemo(() => buildTotals(rows), [rows]);
  const attention = useMemo(() => {
    const inactive = rows.filter(row => normalizeText(row.estado) !== "activo").length;
    const withoutToday = rows.filter(row => normalizeText(row.estado) === "activo" && row.pedidosHoy === 0).length;
    return {
      total: inactive + withoutToday,
      inactive,
      withoutToday,
    };
  }, [rows]);
  if (!canViewTenantMonitoring) {
    return (
      <main className="auth-view">
        <section className="auth-card">
          <h1>Acceso restringido</h1>
          <p>Este tablero solo esta disponible para la sesion joinadmin.</p>
          <button type="button" className="btn-outline" onClick={onLogout}>Cerrar sesion</button>
        </section>
      </main>
    );
  }

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="seguimiento"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{
          pipeline: canViewPipeline,
          pedidos: canViewPedidos,
          produccion: canViewProduccion,
          domicilios: canViewDomicilios,
          barrios: canViewBarrios,
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          clientes: canViewClientesPanel,
          usuarios: canViewUsuariosPanel,
          seguimiento: canViewTenantMonitoring,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: onGoProduccion,
          domicilios: onGoDomicilios,
          barrios: onGoBarrios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
          seguimiento: onGoTenantMonitoring,
        }}
        sessionLabel={`Sesion activa: ${displayUserName}`}
      />

      <main className="orders-admin-view tenant-monitoring-view">
        <header className="orders-admin-header orders-page-header tenant-monitoring-header">
          <div className="orders-page-heading">
            <div className="orders-page-breadcrumb" aria-label="Ruta">
              <span className="tenant-monitoring-brand">PetalOps</span>
              <span>Join Admin</span>
            </div>
            <div className="orders-page-title-row">
              <h1>Seguimiento PetalOps</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">
              Vista de control para revisar tenants activos, pedidos del dia y acumulado mensual.
            </p>
          </div>
          <div className="tenant-monitoring-header-actions">
            <span>{lastUpdatedAt ? `Actualizado ${lastUpdatedAt}` : "Actualizando datos"}</span>
            <button type="button" className="btn-primary orders-header-refresh" onClick={loadData} disabled={loading}>
              <RefreshCw size={18} strokeWidth={2} />
              <span>{loading ? "Actualizando" : "Actualizar"}</span>
            </button>
          </div>
        </header>

        <section className="orders-header-metrics tenant-monitoring-metrics" aria-label="Resumen tenants">
          <article className="orders-header-metric-card is-primary">
            <span className="orders-header-metric-icon" aria-hidden="true"><UsersRound size={18} strokeWidth={2} /></span>
            <strong>{formatNumber(totals.tenants)}</strong>
            <span>Tenants activos</span>
            <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
          </article>
          <article className="orders-header-metric-card is-success">
            <span className="orders-header-metric-icon" aria-hidden="true"><ShoppingCart size={18} strokeWidth={2} /></span>
            <strong>{formatNumber(totals.pedidosHoy)}</strong>
            <span>Pedidos hoy</span>
            <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
          </article>
          <article className="orders-header-metric-card is-info">
            <span className="orders-header-metric-icon" aria-hidden="true"><CalendarDays size={18} strokeWidth={2} /></span>
            <strong>{formatNumber(totals.pedidosMes)}</strong>
            <span>Pedidos del mes</span>
            <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
          </article>
          <article className="orders-header-metric-card is-warning">
            <span className="orders-header-metric-icon" aria-hidden="true"><Gauge size={18} strokeWidth={2} /></span>
            <strong>{averageLabel(totals.promedioMes)}</strong>
            <span>Promedio mensual por tenant</span>
            <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
          </article>
        </section>

        {attention.total > 0 ? (
          <section className="tenant-monitoring-alert" aria-label="Tenants requieren atencion">
            <div>
              <AlertTriangle size={18} strokeWidth={2.2} aria-hidden="true" />
                      <strong>{attention.total} tenants requieren atencion</strong>
              {attention.withoutToday > 0 ? <span>{attention.withoutToday} sin pedidos hoy</span> : null}
              {attention.inactive > 0 ? <span>{attention.inactive} inactivo</span> : null}
            </div>
          </section>
        ) : null}

        {error ? <p className="orders-message">{error}</p> : null}
        {loading ? <p className="orders-message">Cargando seguimiento de tenants...</p> : null}

        <section className="orders-table-wrap orders-page-table-wrap tenant-monitoring-table-wrap">
          <table className="orders-table tenant-monitoring-table">
            <thead>
              <tr>
                <th className="tenant-monitoring-col-tenant">Tenant</th>
                <th className="tenant-monitoring-col-orders">Pedidos hoy</th>
                <th className="tenant-monitoring-col-orders">Pedidos del mes</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr><td colSpan={3}>No hay tenants disponibles.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className={row.needsAttention ? "tenant-monitoring-row-attention" : ""}>
                  <td className="tenant-monitoring-col-tenant" data-label="Tenant">
                    <div className="tenant-monitoring-tenant-cell">
                      <TenantLogo logoUrl={row.logoUrl} tenantName={row.nombre} />
                      <strong>{row.nombre}</strong>
                      <small>ID {row.id}{row.slug ? ` - ${row.slug}` : ""}</small>
                    </div>
                  </td>
                  <td className="tenant-monitoring-col-orders" data-label="Pedidos hoy"><strong>{formatNumber(row.pedidosHoy)}</strong></td>
                  <td className="tenant-monitoring-col-orders" data-label="Pedidos del mes"><strong>{formatNumber(row.pedidosMes)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
