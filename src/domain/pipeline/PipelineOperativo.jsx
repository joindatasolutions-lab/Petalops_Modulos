import { useCallback, useEffect, useMemo, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatDateTimeCompact } from "../../shared/utils.js";
import { PipelineColumn } from "./PipelineColumn.jsx";
import { PipelineFilters } from "./PipelineFilters.jsx";
import { PedidoModal } from "./PedidoModal.jsx";

const PIPELINE_COLUMNS = [
  { key: "pedido_inicial", title: "Creado / Aprobado", stages: ["creado", "aprobado"], dropStage: "aprobado" },
  { key: "produccion_base", title: "Pendiente / En produccion", stages: ["pendiente_produccion", "en_produccion"], dropStage: "en_produccion" },
  { key: "listo", title: "Listo", stages: ["listo"], dropStage: "listo" },
  { key: "en_camino", title: "En camino", stages: ["en_camino"], dropStage: "en_camino" },
  { key: "entregado", title: "Entregado", stages: ["entregado"], dropStage: "entregado" },
  { key: "cancelado", title: "Cancelado", stages: ["cancelado"], dropStage: "cancelado" }
];

const STAGE_TO_ESTADO_ID = {
  creado: 1,
  aprobado: 2,
  pendiente_produccion: 3,
  en_produccion: 4,
  listo: 5,
  en_camino: 5,
  entregado: 20,
  cancelado: 6
};

const PIPELINE_SUBMENU_OPTIONS = [
  { key: "pipeline", label: "Pipeline" },
  { key: "historial", label: "Historial reasignaciones" },
  { key: "pedidos", label: "Historial pedidos" }
];

const INITIAL_FILTERS = {
  sucursalID: null,
  fecha: new Date().toISOString().slice(0, 10),
  domiciliarioID: "",
  floristaID: "",
  numeroPedido: "",
  soloAtrasados: false,
  soloEnProduccion: false
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeUiText(value) {
  return String(value || "")
    .replaceAll("MÃ³dulo", "Modulo")
    .replaceAll("Ã¡", "a")
    .replaceAll("Ã©", "e")
    .replaceAll("Ã­", "i")
    .replaceAll("Ã³", "o")
    .replaceAll("Ãº", "u")
    .replaceAll("Ã±", "n")
    .replaceAll("Ã‘", "N")
    .trim();
}

function formatHistoryActor(value) {
  const raw = sanitizeUiText(value);
  if (!raw) return "-";
  return raw.replace(/\./g, " · ");
}

function formatHistoryReason(value) {
  return sanitizeUiText(value) || "-";
}

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
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewContabilidad,
  canViewTrazabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
  onGoContabilidad,
  onGoTrazabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [board, setBoard] = useState({
    creado: [],
    aprobado: [],
    pendiente_produccion: [],
    en_produccion: [],
    listo: [],
    en_camino: [],
    entregado: [],
    cancelado: []
  });
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
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [processingPedidoIds, setProcessingPedidoIds] = useState([]);

  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalFromSession = session?.sucursalID != null ? Number(session.sucursalID) : null;
  const activeSucursalId = filters.sucursalID ?? sucursalFromSession;

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarPipelinePedidos({
        empresaId,
        sucursalId: activeSucursalId,
        fecha: filters.fecha || null,
        domiciliarioId: filters.domiciliarioID,
        floristaId: filters.floristaID,
        numeroPedido: filters.numeroPedido,
        soloAtrasados: filters.soloAtrasados,
        soloEnProduccion: filters.soloEnProduccion
      });
      setBoard(data);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible cargar el pipeline.");
    } finally {
      setLoading(false);
    }
  }, [activeSucursalId, api, empresaId, filters]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const loadHistory = useCallback(async () => {
    if (!metricasDesde || !metricasHasta) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const payload = await api.obtenerHistorialReasignaciones({
        empresaId,
        sucursalId: activeSucursalId,
        fechaDesde: metricasDesde,
        fechaHasta: metricasHasta
      });
      setHistorial(Array.isArray(payload?.items) ? payload.items : []);
    } catch (nextError) {
      setHistoryError(nextError?.detail || nextError?.message || "No fue posible cargar el historial de reasignaciones.");
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
        empresaId,
        sucursalId: activeSucursalId,
        fechaDesde: auditDesde,
        fechaHasta: auditHasta,
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

  const onChangeFilter = (name, value) => {
    setFilters(current => ({ ...current, [name]: value }));
  };

  const onOpen = async item => {
    setSelected(item);
    try {
      const detail = await api.obtenerDetallePedido(item.id_pedido);
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    }
  };

  const onCloseModal = () => {
    setSelected(null);
    setSelectedDetail(null);
  };

  const onSavePedidoEdit = async ({ pedidoId, productoID, fechaEntrega, horaEntrega }) => {
    await api.actualizarDetallePedidoPipeline({
      pedidoId,
      productoID,
      fechaEntrega,
      horaEntrega,
    });

    const [detail] = await Promise.all([
      api.obtenerDetallePedido(pedidoId),
      loadBoard(),
    ]);

    setSelectedDetail(detail);
    setSelected(current => {
      if (!current || Number(current.id_pedido) !== Number(pedidoId)) return current;
      return {
        ...current,
        hora_entrega: horaEntrega || current.hora_entrega,
      };
    });
  };

  const onDragStart = (event, item) => {
    event.dataTransfer.setData("pedidoId", String(item.id_pedido));
  };

  const onDropCard = async (pedidoId, stage) => {
    const estadoId = STAGE_TO_ESTADO_ID[stage];
    if (!estadoId) return;
    if (processingPedidoIds.includes(Number(pedidoId))) {
      globalThis.alert("Este pedido ya se esta actualizando. Espera un momento.");
      return;
    }
    setProcessingPedidoIds(current => [...current, Number(pedidoId)]);
    try {
      await api.cambiarEstadoPedidoPipeline({ pedidoId, nuevoEstadoId: estadoId });
      await loadBoard();
    } catch (nextError) {
      const message = nextError?.detail || nextError?.message || "No fue posible mover el pedido.";
      setError(message);
      globalThis.alert(message);
    } finally {
      setProcessingPedidoIds(current => current.filter(currentId => currentId !== Number(pedidoId)));
    }
  };

  const buildColumnItems = stages => stages.flatMap(stage => Array.isArray(board?.[stage]) ? board[stage] : []);

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="pipeline"
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
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          trazabilidad: canViewTrazabilidad,
          clientes: canViewClientesPanel,
          usuarios: canViewUsuariosPanel,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: onGoProduccion,
          domicilios: onGoDomicilios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          trazabilidad: onGoTrazabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
      />

      <main className="pipeline-view">
        <header className="orders-admin-header pipeline-page-header">
          <div>
            <h1>Pipeline</h1>
            <p className="orders-admin-subtitle">Centro de control de pedidos, produccion y entrega</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary pipeline-header-refresh" onClick={loadBoard}>
              <IconRefresh size={15} stroke={2} />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <PipelineFilters filters={filters} onChange={onChangeFilter} />
        <section className="orders-submenu">
          {PIPELINE_SUBMENU_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              className={`orders-submenu-chip${submenu === option.key ? " is-active" : ""}`}
              onClick={() => setSubmenu(option.key)}
            >
              {option.label}
            </button>
          ))}
        </section>

        {loading ? <p className="orders-message">Cargando pipeline...</p> : null}
        {error ? <p className="orders-message">{error}</p> : null}

        {submenu === "historial" ? (
          <section className="order-block production-section-card production-history-panel">
            <div className="production-section-head">
              <h4>Historial de reasignaciones</h4>
              <div className="production-history-filters">
                <input type="date" value={metricasDesde} onChange={event => setMetricasDesde(event.target.value)} title="Desde" />
                <input type="date" value={metricasHasta} onChange={event => setMetricasHasta(event.target.value)} title="Hasta" />
                <button type="button" className="btn-primary" onClick={loadHistory} title="Consultar">Consultar</button>
              </div>
            </div>
            {historyError ? <p className="orders-message">{historyError}</p> : null}
            {historyLoading ? <p className="orders-message">Cargando historial...</p> : null}
            {!historyLoading && !historyError ? (
              <ul className="order-products-list production-history-list">
                {historial.length === 0 ? <li className="production-history-empty">Sin datos</li> : historial.map((item, idx) => (
                  <li key={`${item.produccionID}-${item.fechaCambio}-${idx}`}>
                    <span className="production-history-copy">
                      <span className="production-history-line">
                        <strong>{item.numeroPedido ? `Pedido ${item.numeroPedido}` : `P${item.produccionID}`}</strong>
                        <span className={`production-history-tag ${resolveHistoryTypeClass(item.tipoMovimiento)}`}>{resolveHistoryTypeLabel(item.tipoMovimiento)}</span>
                      </span>
                      <small>{formatHistoryActor(item.usuarioCambio)}</small>
                      <em>
                        {item.floristaAnteriorNombre || "Sin florista"} {"->"} {item.floristaNuevoNombre || "Sin florista"}
                        {item.cliente ? ` - ${item.cliente}` : ""}
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
                <input type="date" value={auditDesde} onChange={event => setAuditDesde(event.target.value)} title="Desde" />
                <input type="date" value={auditHasta} onChange={event => setAuditHasta(event.target.value)} title="Hasta" />
                <button type="button" className="btn-primary" onClick={loadApprovalAudit} title="Consultar">Consultar</button>
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
                        <th>Usuario</th>
                        <th>Acciones</th>
                        <th>Pedidos</th>
                        <th>Valor total</th>
                        <th>Ultimo movimiento</th>
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
                        <th>Fecha</th>
                        <th>Usuario</th>
                        <th>Accion</th>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Total</th>
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
          <section className="pipeline-board">
            {PIPELINE_COLUMNS.map(column => (
              <PipelineColumn
                key={column.key}
                dropStageKey={column.dropStage}
                title={column.title}
                items={buildColumnItems(column.stages)}
                onOpen={onOpen}
                onDropCard={onDropCard}
                onDragStart={onDragStart}
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
