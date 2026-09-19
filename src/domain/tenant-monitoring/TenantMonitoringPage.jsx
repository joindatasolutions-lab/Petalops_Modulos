import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";

const FILTER_ALL = "all";
const FILTER_WITH_TODAY = "withToday";
const FILTER_WITHOUT_TODAY = "withoutToday";
const FILTER_INACTIVE = "inactive";
const DEFAULT_SORT = "monthDesc";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveEmpresaId(item) {
  return Number(item?.empresaID ?? item?.empresaId ?? item?.empresa_id ?? item?.id ?? 0);
}

function resolveEmpresaName(item) {
  return String(item?.nombre || item?.nombreComercial || item?.nombre_comercial || item?.nombreEmpresa || item?.nombre_empresa || "").trim();
}

function resolveEmpresaSlug(item) {
  return String(item?.empresaSlug || item?.slug || item?.catalogoSlug || item?.catalogo_slug || "").trim();
}

function normalizeStatus(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const status = normalizeText(raw);
  if (status === "1" || status === "activo" || status === "activa") return "Activo";
  if (status === "0" || status === "inactivo" || status === "inactiva" || status === "inactive" || status === "desactivado" || status === "desactivada") return "Inactivo";
  return raw;
}

function isInactiveStatus(value) {
  return normalizeText(value) === "inactivo";
}

function resolveLogoUrl(value) {
  const logoUrl = String(value || "").trim();
  const markdownLink = logoUrl.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i);
  return markdownLink ? markdownLink[1].replace(/\\_/g, "_") : logoUrl;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-CO").format(Number(value || 0));
}

function formatAverage(value) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatLastUpdated(date) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function buildMonitoringRows(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const id = resolveEmpresaId(item);
      const slug = resolveEmpresaSlug(item);
      const pedidosHoy = Number(item?.pedidosHoy ?? item?.pedidos_hoy ?? 0);
      const pedidosMes = Number(item?.pedidosMes ?? item?.pedidos_mes ?? 0);
      const tarifa = Number(item?.tarifa ?? 0);
      const totalHoy = Number(item?.totalHoy ?? item?.total_hoy ?? 0);
      const totalMes = Number(item?.totalMes ?? item?.total_mes ?? 0);
      const estado = normalizeStatus(item?.estado);
      return {
        id,
        nombre: resolveEmpresaName(item) || `Empresa ${id}`,
        slug,
        logoUrl: resolveLogoUrl(item?.logoUrl || item?.logo_url),
        estado,
        pedidosHoy,
        pedidosMes,
        tarifa,
        totalHoy,
        totalMes,
      };
    })
    .filter(item => item.id > 0);
}

export function buildMonitoringTotals(summary = {}) {
  const empresas = Number(summary?.tenants ?? summary?.empresas ?? 0);
  const pedidosHoy = Number(summary?.pedidosHoy ?? summary?.pedidos_hoy ?? 0);
  const pedidosMes = Number(summary?.pedidosMes ?? summary?.pedidos_mes ?? 0);
  const totalHoy = Number(summary?.totalHoy ?? summary?.total_hoy ?? 0);
  const totalMes = Number(summary?.totalMes ?? summary?.total_mes ?? 0);
  return {
    empresas,
    pedidosHoy,
    pedidosMes,
    totalHoy,
    totalMes,
    promedioMensual: empresas > 0 ? pedidosMes / empresas : 0,
  };
}

export function filterAndSortMonitoringRows(rows, { filter = FILTER_ALL, query = "", sort = DEFAULT_SORT } = {}) {
  const normalizedQuery = normalizeText(query).replace(/\s+/g, " ");
  const filtered = rows.filter(row => {
    if (filter === FILTER_WITH_TODAY && row.pedidosHoy <= 0) return false;
    if (filter === FILTER_WITHOUT_TODAY && row.pedidosHoy !== 0) return false;
    if (filter === FILTER_INACTIVE && !isInactiveStatus(row.estado)) return false;
    if (!normalizedQuery) return true;

    return [
      row.nombre,
      row.id,
      row.slug,
    ].some(value => normalizeText(value).includes(normalizedQuery));
  });

  return [...filtered].sort((a, b) => {
    if (sort === "todayDesc") return b.pedidosHoy - a.pedidosHoy || a.nombre.localeCompare(b.nombre, "es");
    if (sort === "todayAsc") return a.pedidosHoy - b.pedidosHoy || a.nombre.localeCompare(b.nombre, "es");
    if (sort === "monthAsc") return a.pedidosMes - b.pedidosMes || a.nombre.localeCompare(b.nombre, "es");
    if (sort === "nameAsc") return a.nombre.localeCompare(b.nombre, "es");
    if (sort === "nameDesc") return b.nombre.localeCompare(a.nombre, "es");
    return b.pedidosMes - a.pedidosMes || a.nombre.localeCompare(b.nombre, "es");
  });
}

function TenantLogo({ logoUrl, empresaName }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !imageFailed;

  return (
    <span className="tenant-monitoring-avatar" aria-hidden={showImage ? undefined : "true"}>
      {showImage ? (
        <img
          src={logoUrl}
          alt={`Logo de ${empresaName}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Building2 size={18} strokeWidth={2} aria-hidden="true" />
      )}
    </span>
  );
}

function MetricSkeleton() {
  return (
    <article className="tenant-monitoring-summary-card is-skeleton" aria-hidden="true">
      <span />
      <strong />
      <small />
    </article>
  );
}

function TableSkeleton() {
  return (
    <section className="tenant-monitoring-table-wrap tenant-monitoring-skeleton-table" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="tenant-monitoring-skeleton-row">
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </section>
  );
}

function EmptyState({ title, subtitle, action }) {
  return (
    <section className="tenant-monitoring-empty">
      <Store size={28} strokeWidth={1.8} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{subtitle}</span>
      {action}
    </section>
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
  const requestInFlightRef = useRef(false);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState(DEFAULT_SORT);
  const displayUserName = String(session?.nombre || session?.login || "joinadmin").trim() || "joinadmin";

  const loadData = useCallback(async () => {
    if (!canViewTenantMonitoring || requestInFlightRef.current) return;
    const hasCurrentData = Boolean(payload);
    requestInFlightRef.current = true;
    setLoading(true);
    setError("");
    setRefreshNotice("");
    try {
      const nextPayload = await api.listarSeguimientoTenants({ limit: 100 });
      setPayload(nextPayload || null);
      setForbidden(false);
      setLastUpdatedAt(formatLastUpdated(new Date()));
    } catch (nextError) {
      if (Number(nextError?.status) === 403) {
        setForbidden(true);
        setPayload(null);
        setError("");
        return;
      }

      if (hasCurrentData) {
        setRefreshNotice("No se pudieron actualizar los datos.");
      } else {
        setError("No pudimos cargar el seguimiento.");
      }
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [api, canViewTenantMonitoring, payload]);

  useEffect(() => {
    if (!payload && !loading && !error && !forbidden) void loadData();
  }, [error, forbidden, loadData, loading, payload]);

  const rows = useMemo(() => buildMonitoringRows(payload?.items), [payload]);
  const totals = useMemo(() => buildMonitoringTotals(payload?.resumen), [payload]);
  const filterCounts = useMemo(() => {
    const withoutToday = rows.filter(row => row.pedidosHoy === 0).length;
    const inactive = rows.filter(row => isInactiveStatus(row.estado)).length;
    return {
      all: rows.length,
      withToday: rows.filter(row => row.pedidosHoy > 0).length,
      withoutToday,
      inactive,
    };
  }, [rows]);
  const filteredRows = useMemo(
    () => filterAndSortMonitoringRows(rows, { filter: activeFilter, query: searchTerm, sort: sortBy }),
    [activeFilter, rows, searchTerm, sortBy]
  );
  const chartRows = useMemo(
    () => [...filteredRows]
      .sort((a, b) => b.pedidosMes - a.pedidosMes || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 8),
    [filteredRows]
  );
  const isInitialLoading = loading && !payload && !error && !forbidden;
  const hasNoCompanies = !isInitialLoading && !error && !forbidden && (totals.empresas === 0 || rows.length === 0);
  const hasFilteredEmpty = !hasNoCompanies && rows.length > 0 && filteredRows.length === 0;
  const fechaLabel = formatDateLabel(payload?.fechaHoy);
  const allWithActivity = rows.length > 0 && rows.every(row => row.pedidosHoy > 0);

  const clearFilters = () => {
    setActiveFilter(FILTER_ALL);
    setSearchTerm("");
    setSortBy(DEFAULT_SORT);
  };

  if (!canViewTenantMonitoring || forbidden) {
    return (
      <main className="auth-view">
        <section className="auth-card">
          <h1>Acceso restringido</h1>
          <p>No tienes permisos para acceder a Seguimiento PetalOps.</p>
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
              Vista de control para monitorear la actividad de todas las empresas.
            </p>
          </div>
          <div className="tenant-monitoring-header-actions">
            <span>{lastUpdatedAt ? `Ultima actualizacion: ${lastUpdatedAt}` : "Sin actualizacion registrada"}</span>
            <button type="button" className="btn-primary orders-header-refresh" onClick={loadData} disabled={loading}>
              <RefreshCw className={loading ? "is-spinning" : ""} size={18} strokeWidth={2} aria-hidden="true" />
              <span>{loading ? "Actualizando" : "Actualizar"}</span>
            </button>
          </div>
        </header>

        <section className="tenant-monitoring-summary" aria-label="Resumen de empresas">
          {isInitialLoading ? (
            <>
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
              <MetricSkeleton />
            </>
          ) : (
            <>
              <article className="tenant-monitoring-summary-card is-primary">
                <span className="tenant-monitoring-summary-icon" aria-hidden="true"><Building2 size={19} strokeWidth={2} /></span>
                <strong>{formatNumber(totals.empresas)}</strong>
                <small>Empresas</small>
              </article>
              <article className="tenant-monitoring-summary-card is-cart">
                <span className="tenant-monitoring-summary-icon" aria-hidden="true"><ShoppingCart size={19} strokeWidth={2} /></span>
                <strong>{formatNumber(totals.pedidosHoy)}</strong>
                <small>Pedidos hoy</small>
              </article>
              <article className="tenant-monitoring-summary-card is-calendar">
                <span className="tenant-monitoring-summary-icon" aria-hidden="true"><CalendarDays size={19} strokeWidth={2} /></span>
                <strong>{formatNumber(totals.pedidosMes)}</strong>
                <small>Pedidos del mes</small>
              </article>
              <article className="tenant-monitoring-summary-card is-average">
                <span className="tenant-monitoring-summary-icon" aria-hidden="true"><BarChart3 size={19} strokeWidth={2} /></span>
                <strong>{formatAverage(totals.promedioMensual)}</strong>
                <small>Promedio mensual por empresa</small>
              </article>
            </>
          )}
        </section>

        {isInitialLoading ? (
          <section className="tenant-monitoring-status is-skeleton" aria-hidden="true">
            <span />
            <div><strong /><small /></div>
          </section>
        ) : payload && !hasNoCompanies ? (
          <section className={`tenant-monitoring-status ${allWithActivity ? "is-positive" : "is-neutral"}`} aria-label="Estado de actividad">
            <CheckCircle2 size={20} strokeWidth={2.2} aria-hidden="true" />
            <div>
              <strong>{allWithActivity ? "Actividad registrada" : "Actividad de hoy"}</strong>
              <span>
                {allWithActivity
                  ? "Todas las empresas mostradas registran pedidos hoy."
                  : `${filterCounts.withoutToday} de ${rows.length} empresas aun no registran pedidos hoy.`}
              </span>
            </div>
            {fechaLabel ? <small>Datos del {fechaLabel}</small> : null}
          </section>
        ) : null}

        {refreshNotice ? <p className="tenant-monitoring-notice" role="status">{refreshNotice}</p> : null}

        {error ? (
          <section className="tenant-monitoring-error">
            <strong>{error}</strong>
            <button type="button" className="btn-outline" onClick={loadData} disabled={loading}>Intentar nuevamente</button>
          </section>
        ) : null}

        {!error && !isInitialLoading && !hasNoCompanies ? (
          <section className="tenant-monitoring-controls" aria-label="Filtros de empresas">
            <div className="tenant-monitoring-filter-chips" role="group" aria-label="Filtros rapidos">
              {[
                { key: FILTER_ALL, label: "Todos", count: filterCounts.all },
                { key: FILTER_WITH_TODAY, label: "Con pedidos hoy", count: filterCounts.withToday },
                { key: FILTER_WITHOUT_TODAY, label: "Sin pedidos hoy", count: filterCounts.withoutToday },
                ...(filterCounts.inactive > 0 ? [{ key: FILTER_INACTIVE, label: "Inactivas", count: filterCounts.inactive }] : []),
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`tenant-monitoring-filter-chip ${activeFilter === item.key ? "is-active" : ""}`}
                  onClick={() => setActiveFilter(item.key)}
                >
                  {item.label} ({formatNumber(item.count)})
                </button>
              ))}
            </div>

            <label className="tenant-monitoring-search">
              <span className="sr-only">Buscar empresa por nombre o ID</span>
              <Search size={17} strokeWidth={2} aria-hidden="true" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar empresa por nombre o ID..."
              />
            </label>

            <label className="tenant-monitoring-sort">
              <span>Ordenar por</span>
              <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
              <select value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="todayDesc">Pedidos hoy: mayor a menor</option>
                <option value="todayAsc">Pedidos hoy: menor a mayor</option>
                <option value="monthDesc">Pedidos del mes: mayor a menor</option>
                <option value="monthAsc">Pedidos del mes: menor a mayor</option>
                <option value="nameAsc">Nombre: A-Z</option>
                <option value="nameDesc">Nombre: Z-A</option>
              </select>
            </label>
          </section>
        ) : null}

        {isInitialLoading ? <TableSkeleton /> : null}

        {hasNoCompanies ? (
          <EmptyState
            title="No hay empresas para mostrar."
            subtitle="No se encontraron empresas disponibles para este periodo."
          />
        ) : null}

        {hasFilteredEmpty ? (
          <EmptyState
            title="No encontramos empresas con estos filtros."
            subtitle="Ajusta la busqueda o vuelve a la vista completa."
            action={<button type="button" className="btn-outline" onClick={clearFilters}>Limpiar filtros</button>}
          />
        ) : null}

        {!isInitialLoading && !error && !hasNoCompanies && !hasFilteredEmpty ? (
          <section className="tenant-monitoring-content-grid">
            <div className="tenant-monitoring-list-panel">
              <section className="orders-table-wrap orders-page-table-wrap tenant-monitoring-table-wrap">
                <table className="orders-table tenant-monitoring-table">
                  <colgroup>
                    <col className="tenant-monitoring-col-company" />
                    <col className="tenant-monitoring-col-status" />
                    <col className="tenant-monitoring-col-number" />
                    <col className="tenant-monitoring-col-number" />
                    <col className="tenant-monitoring-col-money" />
                    <col className="tenant-monitoring-col-money" />
                    <col className="tenant-monitoring-col-money is-total-month" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="tenant-monitoring-col-company">Empresa</th>
                      <th className="tenant-monitoring-col-status">Estado</th>
                      <th className="tenant-monitoring-col-number">Pedidos hoy</th>
                      <th className="tenant-monitoring-col-number">Pedidos del mes</th>
                      <th className="tenant-monitoring-col-money">Tarifa</th>
                      <th className="tenant-monitoring-col-money">Total hoy</th>
                      <th className="tenant-monitoring-col-money">Total mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr key={row.id} className="tenant-monitoring-row">
                        <td className="tenant-monitoring-col-company" data-label="Empresa">
                          <div className="tenant-monitoring-company-cell">
                            <TenantLogo logoUrl={row.logoUrl} empresaName={row.nombre} />
                            <strong>{row.nombre}</strong>
                            <small>ID {row.id}{row.slug ? ` - ${row.slug}` : ""}</small>
                          </div>
                        </td>
                        <td className="tenant-monitoring-col-status" data-label="Estado">
                          {row.estado ? (
                            <span className={`tenant-monitoring-status-badge ${normalizeText(row.estado) === "activo" ? "is-active" : ""}`}>
                              {row.estado}
                            </span>
                          ) : (
                            <span className="tenant-monitoring-muted">-</span>
                          )}
                        </td>
                        <td className="tenant-monitoring-col-number" data-label="Pedidos hoy">
                          <strong>{formatNumber(row.pedidosHoy)}</strong>
                        </td>
                        <td className="tenant-monitoring-col-number" data-label="Pedidos del mes">
                          <strong>{formatNumber(row.pedidosMes)}</strong>
                        </td>
                        <td className="tenant-monitoring-col-money" data-label="Tarifa">
                          <strong>{formatCurrency(row.tarifa)}</strong>
                        </td>
                        <td className="tenant-monitoring-col-money" data-label="Total hoy">
                          <strong>{formatCurrency(row.totalHoy)}</strong>
                        </td>
                        <td className="tenant-monitoring-col-money" data-label="Total mes">
                          <strong>{formatCurrency(row.totalMes)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <p className="tenant-monitoring-count">
                Mostrando {formatNumber(filteredRows.length)} de {formatNumber(rows.length)} empresas
              </p>
            </div>

            <aside className="tenant-monitoring-chart" aria-labelledby="tenant-monitoring-chart-title">
              <header>
                <div>
                  <h2 id="tenant-monitoring-chart-title">Pedidos del mes</h2>
                  <p>Empresas con mayor actividad</p>
                </div>
                <BarChart3 size={20} strokeWidth={2} aria-hidden="true" />
              </header>
              <div className="tenant-monitoring-chart-canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#eef2f7" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" width={104} axisLine={false} tickLine={false} tick={{ fill: "#334155", fontSize: 11 }} />
                    <Tooltip formatter={value => [formatNumber(value), "Pedidos"]} cursor={{ fill: "#fff5fa" }} />
                    <Bar dataKey="pedidosMes" fill="#e91e72" radius={[0, 5, 5, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </aside>
          </section>
        ) : null}
      </main>
    </div>
  );
}
