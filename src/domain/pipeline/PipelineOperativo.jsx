import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  ClipboardList,
  History,
  ListChecks,
  PackageSearch,
  RotateCw,
  Timer,
  Truck,
} from "lucide-react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatDateTimeCompact, todayIsoDateBogota } from "../../shared/utils.js";
import { PipelineColumn } from "./PipelineColumn.jsx";
import { PipelineFilters } from "./PipelineFilters.jsx";
import { PedidoModal } from "./PedidoModal.jsx";

const PIPELINE_STAGES = [
  "creado",
  "aprobado",
  "pendiente_produccion",
  "en_produccion",
  "listo",
  "en_camino",
  "entregado",
  "cancelado",
];

const PIPELINE_COLUMNS = [
  { key: "pedido_inicial",  title: "Creado / Aprobado",       stages: ["creado", "aprobado"],                    dropStage: "aprobado" },
  { key: "produccion_base", title: "Pendiente / En producción", stages: ["pendiente_produccion", "en_produccion"], dropStage: "en_produccion" },
  { key: "listo",           title: "Listo",                    stages: ["listo"],                                  dropStage: "listo" },
  { key: "en_camino",       title: "En camino",                stages: ["en_camino"],                              dropStage: "en_camino" },
  { key: "entregado",       title: "Entregado",                stages: ["entregado"],                              dropStage: "entregado" },
  { key: "cancelado",       title: "Cancelado",                stages: ["cancelado"],                              dropStage: "cancelado" },
];

const PIPELINE_TABS = [
  { key: "pipeline",  label: "Pipeline",               icon: ClipboardList },
  { key: "historial", label: "Historial reasignaciones", icon: History },
  { key: "pedidos",   label: "Historial pedidos",       icon: PackageSearch },
];

const INITIAL_FILTERS = {
  sucursalID: null,
  fechaDesde: todayIsoDateBogota(),
  fechaHasta: todayIsoDateBogota(),
  domiciliarioID: "",
  floristaID: "",
  numeroPedido: "",
  estadoStage: "",
  soloAtrasados: false,
  soloEnProduccion: false,
};

function normalizePipelineBoard(payload) {
  return PIPELINE_STAGES.reduce((board, stage) => ({
    ...board,
    [stage]: Array.isArray(payload?.[stage]) ? payload[stage] : [],
  }), {});
}

function todayIsoDate() { return todayIsoDateBogota(); }

function sanitizeUiText(value) {
  return String(value || "")
    .replaceAll("MÃ³dulo", "Modulo")
    .replaceAll("Ã¡", "a").replaceAll("Ã©", "e")
    .replaceAll("Ã­", "i").replaceAll("Ã³", "o")
    .replaceAll("Ãº", "u").replaceAll("Ã±", "n").replaceAll("Ã'", "N")
    .trim();
}

function formatHistoryActor(value) {
  const raw = sanitizeUiText(value);
  if (!raw) return "-";
  return raw.replace(/\./g, " · ");
}

function formatHistoryReason(value) { return sanitizeUiText(value) || "-"; }

function resolveHistoryTypeLabel(tipoMovimiento) {
  const type = String(tipoMovimiento || "").trim().toUpperCase();
  if (type === "ASIGNACION_MANUAL") return "Asignacion";
  if (type === "REASIGNACION_MANUAL") return "Reasignacion";
  if (type === "DESASIGNACION_MANUAL") return "Desasignacion";
  return "Movimiento";
}

function resolveHistoryTypeClass(tipoMovimiento) {
  const label = resolveHistoryTypeLabel(tipoMovimiento);
  if (label === "Asignacion") return "is-admin";
  if (label === "Desasignacion") return "is-auto";
  return "is-reassignment";
}

function formatApprovalAuditError(error) {
  const message = sanitizeUiText(error?.message || error?.detail || "");
  if (message.toLowerCase().includes("modulo 'trazabilidad' no disponible en el plan")) {
    return "El historial de pedidos no esta disponible en este ambiente porque el backend publicado aun responde con la regla anterior de Trazabilidad.";
  }
  return message || "No fue posible cargar el historial de pedidos.";
}

function formatApprovalAction(value) {
  const action = String(value || "").trim().toUpperCase();
  if (action === "APROBAR_PEDIDO" || action === "APROBAR_PEDIDO_PIPELINE") return "Aprobo pedido";
  if (action === "GUARDAR_PEDIDO") return "Guardo edicion";
  return action || "-";
}

export function PipelineOperativo({
  session,
  canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewBarrios,
  canViewInventario, canViewContabilidad,
  canViewClientesPanel, canViewUsuariosPanel,
  onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario,
  onGoContabilidad, onGoClientes, onGoUsuarios, onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [board, setBoard] = useState(() => normalizePipelineBoard());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [submenu, setSubmenu] = useState("pipeline");
  const [metricasDesde, setMetricasDesde] = useState(todayIsoDate());
  const [metricasHasta, setMetricasHasta] = useState(todayIsoDate());
  const [historial, setHistorial] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [auditDesde, setAuditDesde] = useState(todayIsoDate());
  const [auditHasta, setAuditHasta] = useState(todayIsoDate());
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditData, setAuditData] = useState({ resumen: [], detalle: [], total: 0 });
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalFromSession = session?.sucursalID != null ? Number(session.sucursalID) : null;
  const displayUserName = String(session?.nombre || session?.login || "Usuario").trim() || "Usuario";
  const activeSucursalId = filters.sucursalID ?? sucursalFromSession;

  // ── Mini métricas del header ──────────────────────────────────────────────
  const pipelineMetrics = useMemo(() => ({
    activos: [
      ...board.creado, ...board.aprobado,
      ...board.pendiente_produccion, ...board.en_produccion,
      ...board.listo, ...board.en_camino,
    ].length,
    enProduccion: [...board.pendiente_produccion, ...board.en_produccion].length,
    enCamino: board.en_camino.length,
    entregados: board.entregado.length,
  }), [board]);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarPipelinePedidos({
        empresaId,
        sucursalId: activeSucursalId,
        fecha: filters.fechaDesde && filters.fechaDesde === filters.fechaHasta ? filters.fechaDesde : null,
        fechaDesde: filters.fechaDesde || null,
        fechaHasta: filters.fechaHasta || filters.fechaDesde || null,
        domiciliarioId: filters.domiciliarioID,
        floristaId: filters.floristaID,
        numeroPedido: filters.numeroPedido,
        soloAtrasados: filters.soloAtrasados,
        soloEnProduccion: filters.soloEnProduccion,
      });
      setBoard(normalizePipelineBoard(data));
    } catch (nextError) {
      setError(nextError?.message || "No fue posible cargar el pipeline.");
    } finally {
      setLoading(false);
    }
  }, [activeSucursalId, api, empresaId, filters]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const loadHistory = useCallback(async () => {
    if (!metricasDesde || !metricasHasta) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const payload = await api.obtenerHistorialReasignaciones({
        empresaId, sucursalId: activeSucursalId,
        fechaDesde: metricasDesde, fechaHasta: metricasHasta,
      });
      setHistorial(Array.isArray(payload?.items) ? payload.items : []);
    } catch (nextError) {
      setHistoryError(nextError?.detail || nextError?.message || "No fue posible cargar el historial.");
      setHistorial([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeSucursalId, api, empresaId, metricasDesde, metricasHasta]);

  useEffect(() => {
    if (submenu !== "historial") return;
    void loadHistory();
  }, [submenu, loadHistory]);

  const loadApprovalAudit = useCallback(async () => {
    if (!auditDesde || !auditHasta) return;
    setAuditLoading(true);
    setAuditError("");
    try {
      const payload = await api.obtenerTrazabilidadAprobacionesPedidos({
        empresaId, sucursalId: activeSucursalId,
        fechaDesde: auditDesde, fechaHasta: auditHasta,
      });
      setAuditData({
        resumen: Array.isArray(payload?.resumen) ? payload.resumen : [],
        detalle: Array.isArray(payload?.detalle) ? payload.detalle : [],
        total: Number(payload?.total || 0),
      });
    } catch (nextError) {
      setAuditError(formatApprovalAuditError(nextError));
      setAuditData({ resumen: [], detalle: [], total: 0 });
    } finally {
      setAuditLoading(false);
    }
  }, [activeSucursalId, api, auditDesde, auditHasta, empresaId]);

  useEffect(() => {
    if (submenu !== "pedidos") return;
    void loadApprovalAudit();
  }, [submenu, loadApprovalAudit]);

  const onChangeFilter = (name, value) => setFilters(current => ({ ...current, [name]: value }));

  const onOpen = async item => {
    setSelected(item);
    try {
      const detail = await api.obtenerDetallePedido(item.id_pedido);
      setSelectedDetail(detail);
    } catch { setSelectedDetail(null); }
  };

  const onCloseModal = () => { setSelected(null); setSelectedDetail(null); };

  const onSavePedidoEdit = async ({ pedidoId, productoID, fechaEntrega, horaEntrega }) => {
    await api.actualizarDetallePedidoPipeline({ pedidoId, productoID, fechaEntrega, horaEntrega });
    const [detail] = await Promise.all([api.obtenerDetallePedido(pedidoId), loadBoard()]);
    setSelectedDetail(detail);
    setSelected(current => {
      if (!current || Number(current.id_pedido) !== Number(pedidoId)) return current;
      return { ...current, hora_entrega: horaEntrega || current.hora_entrega };
    });
  };

  const buildColumnItems = stages => {
    const selectedStage = String(filters.estadoStage || "").trim();
    const visibleStages = selectedStage
      ? stages.filter(stage => stage === selectedStage)
      : stages;
    return visibleStages.flatMap(stage => Array.isArray(board?.[stage]) ? board[stage] : []);
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="pipeline"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{ pipeline: canViewPipeline, pedidos: canViewPedidos, produccion: canViewProduccion, domicilios: canViewDomicilios, barrios: canViewBarrios, inventario: canViewInventario, contabilidad: canViewContabilidad, clientes: canViewClientesPanel, usuarios: canViewUsuariosPanel }}
        navigation={{ pipeline: onGoPipeline, pedidos: onGoPedidos, produccion: onGoProduccion, domicilios: onGoDomicilios, barrios: onGoBarrios, inventario: onGoInventario, contabilidad: onGoContabilidad, clientes: onGoClientes, usuarios: onGoUsuarios }}
      />

      <main className="orders-admin-view pipeline-view">

        {/* ── HEADER — mismas clases que Pedidos y Producción ── */}
        <header className="orders-admin-header orders-page-header pipeline-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-breadcrumb" aria-label="Ruta">
              <span>Ventas</span>
              <span>/</span>
              <strong>Pipeline</strong>
            </div>
            <div className="orders-page-title-row">
              <h1>Pipeline</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">
              Visualiza y mueve pedidos entre etapas operativas.
            </p>
            <span className="orders-user-pill">
              <span aria-hidden="true" />
              Sesion activa: {displayUserName}
            </span>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
              <button
                type="button"
                className="btn-primary orders-header-refresh"
                title="Actualizar pipeline"
                onClick={loadBoard}
              >
                <RotateCw size={18} strokeWidth={2} />
                <span>Actualizar</span>
              </button>
            </div>
            <div className="orders-header-metrics pipeline-header-metrics" aria-label="Resumen pipeline">
              <article className="orders-header-metric-card is-primary">
                <span className="orders-header-metric-icon" aria-hidden="true"><ListChecks size={18} strokeWidth={2} /></span>
                <strong>{pipelineMetrics.activos}</strong>
                <span>Activos</span>
              </article>
              <article className="orders-header-metric-card is-warning">
                <span className="orders-header-metric-icon" aria-hidden="true"><Timer size={18} strokeWidth={2} /></span>
                <strong>{pipelineMetrics.enProduccion}</strong>
                <span>En produccion</span>
              </article>
              <article className="orders-header-metric-card is-info">
                <span className="orders-header-metric-icon" aria-hidden="true"><Truck size={18} strokeWidth={2} /></span>
                <strong>{pipelineMetrics.enCamino}</strong>
                <span>En camino</span>
              </article>
              <article className="orders-header-metric-card is-success">
                <span className="orders-header-metric-icon" aria-hidden="true"><CheckCircle2 size={18} strokeWidth={2} /></span>
                <strong>{pipelineMetrics.entregados}</strong>
                <span>Entregados</span>
              </article>
            </div>
          </div>
        </header>

        {/* ── FILTROS ── */}
        <PipelineFilters filters={filters} onChange={onChangeFilter} />

        {/* ── TABS ── */}
        <div className="pipeline-tabs" role="tablist">
          {PIPELINE_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={submenu === tab.key}
                className={`pipeline-tab${submenu === tab.key ? " is-active" : ""}`}
                onClick={() => setSubmenu(tab.key)}
              >
                <Icon size={14} strokeWidth={2} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? <p className="orders-message">Cargando pipeline...</p> : null}
        {error ? <p className="orders-message">{error}</p> : null}

        {/* ── HISTORIAL REASIGNACIONES ── */}
        {submenu === "historial" ? (
          <section className="order-block production-section-card production-history-panel">
            <div className="production-section-head">
              <h4>Historial de reasignaciones</h4>
              <div className="production-history-filters">
                <input type="date" value={metricasDesde} onChange={e => setMetricasDesde(e.target.value)} title="Desde" />
                <input type="date" value={metricasHasta} onChange={e => setMetricasHasta(e.target.value)} title="Hasta" />
                <button type="button" className="btn-primary" onClick={loadHistory}>Consultar</button>
              </div>
            </div>
            {historyError ? <p className="orders-message">{historyError}</p> : null}
            {historyLoading ? <p className="orders-message">Cargando historial...</p> : null}
            {!historyLoading && !historyError ? (
              <ul className="order-products-list production-history-list">
                {historial.length === 0 ? (
                  <li className="production-history-empty">Sin datos para el rango seleccionado</li>
                ) : historial.map((item, idx) => (
                  <li key={`${item.produccionID}-${item.fechaCambio}-${idx}`}>
                    <span className="production-history-copy">
                      <span className="production-history-line">
                        <strong>{item.numeroPedido ? `Pedido ${item.numeroPedido}` : `P${item.produccionID}`}</strong>
                        <span className={`production-history-tag ${resolveHistoryTypeClass(item.tipoMovimiento)}`}>{resolveHistoryTypeLabel(item.tipoMovimiento)}</span>
                      </span>
                      <small>{formatHistoryActor(item.usuarioCambio)}</small>
                      <em>
                        {item.floristaAnteriorNombre || "Sin florista"} {"→"} {item.floristaNuevoNombre || "Sin florista"}
                        {item.cliente ? ` — ${item.cliente}` : ""}
                      </em>
                      <small>{formatHistoryReason(item.motivo)}</small>
                    </span>
                    <strong className="production-history-date">{formatDateTimeCompact(item.fechaCambio) || "-"}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : submenu === "pedidos" ? (
          <section className="order-block production-section-card production-history-panel">
            <div className="production-section-head">
              <h4>Historial de pedidos</h4>
              <div className="production-history-filters">
                <input type="date" value={auditDesde} onChange={e => setAuditDesde(e.target.value)} title="Desde" />
                <input type="date" value={auditHasta} onChange={e => setAuditHasta(e.target.value)} title="Hasta" />
                <button type="button" className="btn-primary" onClick={loadApprovalAudit}>Consultar</button>
              </div>
            </div>
            {auditError ? <p className="orders-message">{auditError}</p> : null}
            {auditLoading ? <p className="orders-message">Cargando historial...</p> : null}
            {!auditLoading && !auditError ? (
              <>
                <div className="pipeline-audit-summary">
                  <article className="pipeline-audit-summary-card">
                    <span>Total acciones</span>
                    <strong>{auditData.total || 0}</strong>
                  </article>
                  <article className="pipeline-audit-summary-card">
                    <span>Usuarios</span>
                    <strong>{auditData.resumen.length}</strong>
                  </article>
                  <article className="pipeline-audit-summary-card">
                    <span>Pedidos impactados</span>
                    <strong>{auditData.resumen.reduce((sum, item) => sum + Number(item?.pedidosAprobados || 0), 0)}</strong>
                  </article>
                </div>
                <section className="orders-table-wrap orders-page-table-wrap" style={{ marginBottom: 16 }}>
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Usuario</th><th>Acciones</th><th>Pedidos</th>
                        <th>Valor total</th><th>Ultimo movimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.resumen.length === 0 ? (
                        <tr><td colSpan={5}>Sin movimientos para el rango seleccionado.</td></tr>
                      ) : auditData.resumen.map(item => (
                        <tr key={`audit-summary-${item.usuario}`}>
                          <td>{item.usuario || "-"}</td>
                          <td>{item.acciones || 0}</td>
                          <td>{item.pedidosAprobados || 0}</td>
                          <td>${Number(item.valorTotal || 0).toLocaleString("es-CO")}</td>
                          <td>{item.ultimoMovimiento ? formatDateTimeCompact(item.ultimoMovimiento) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <section className="orders-table-wrap orders-page-table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Fecha</th><th>Usuario</th><th>Accion</th>
                        <th>Pedido</th><th>Cliente</th><th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.detalle.length === 0 ? (
                        <tr><td colSpan={6}>Sin movimientos para el rango seleccionado.</td></tr>
                      ) : auditData.detalle.map((item, index) => (
                        <tr key={`audit-detail-${item.usuario}-${item.pedidoID}-${index}`}>
                          <td>{item.fechaAccion ? formatDateTimeCompact(item.fechaAccion) : "-"}</td>
                          <td>{item.usuario || "-"}</td>
                          <td>{formatApprovalAction(item.accion)}</td>
                          <td>{item.numeroPedido ?? item.pedidoID ?? "-"}</td>
                          <td>{item.cliente || "-"}</td>
                          <td>${Number(item.totalPedido || 0).toLocaleString("es-CO")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </>
            ) : null}
          </section>
        ) : (
          /* ── KANBAN BOARD ── */
          <section className="pipeline-board">
            {PIPELINE_COLUMNS.map(column => (
              <PipelineColumn
                key={column.key}
                dropStageKey={column.dropStage}
                title={column.title}
                items={buildColumnItems(column.stages)}
                onOpen={onOpen}
              />
            ))}
          </section>
        )}
      </main>

      <PedidoModal
        item={selected}
        detail={selectedDetail}
        onClose={onCloseModal}
        api={api}
        empresaId={empresaId}
        sucursalId={activeSucursalId}
        onSaveEdit={onSavePedidoEdit}
      />
    </div>
  );
}
