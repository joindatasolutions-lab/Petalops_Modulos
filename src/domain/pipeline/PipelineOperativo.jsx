import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListChecks, RotateCw, Timer, Truck } from "lucide-react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { PipelineColumn } from "./PipelineColumn.jsx";
import { PipelineFilters } from "./PipelineFilters.jsx";
import { PedidoModal } from "./PedidoModal.jsx";
import { INITIAL_FILTERS, PIPELINE_COLUMNS, STAGE_TO_ESTADO_ID } from "./pipelineConfig.jsx";
import { buildColumnItems as buildPipelineColumnItems, buildPipelineMetrics, normalizePipelineBoard } from "./pipelineDomain.js";


export function PipelineOperativo({
  session,
  canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewBarrios,
  canViewInventario, canViewContabilidad,
  canViewClientesPanel, canViewUsuariosPanel, canViewTenantMonitoring,
  onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario,
  onGoContabilidad, onGoClientes, onGoUsuarios, onGoTenantMonitoring, onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [board, setBoard] = useState(() => normalizePipelineBoard());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [processingPedidoIds, setProcessingPedidoIds] = useState([]);

  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalFromSession = session?.sucursalID != null ? Number(session.sucursalID) : null;
  const displayUserName = String(session?.nombre || session?.login || "Usuario").trim() || "Usuario";
  const mobileSessionLabel = displayUserName.replace(/\s+Empresa\s+/i, " · ");
  const activeSucursalId = filters.sucursalID ?? sucursalFromSession;

  const pipelineMetrics = useMemo(() => buildPipelineMetrics(board), [board]);

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

  const onDragStart = (event, item) => event.dataTransfer.setData("pedidoId", String(item.id_pedido));

  const onDropCard = async (pedidoId, stage) => {
    const estadoId = STAGE_TO_ESTADO_ID[stage];
    if (!estadoId) {
      globalThis.alert("Este movimiento se gestiona desde Produccion o Domicilios para mantener la trazabilidad operativa.");
      return;
    }
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
      setProcessingPedidoIds(current => current.filter(id => id !== Number(pedidoId)));
    }
  };

  const selectedStage = String(filters.estadoStage || "").trim();

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="pipeline"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{ pipeline: canViewPipeline, pedidos: canViewPedidos, produccion: canViewProduccion, domicilios: canViewDomicilios, barrios: canViewBarrios, inventario: canViewInventario, contabilidad: canViewContabilidad, clientes: canViewClientesPanel, seguimiento: canViewTenantMonitoring, usuarios: canViewUsuariosPanel }}
        navigation={{ pipeline: onGoPipeline, pedidos: onGoPedidos, produccion: onGoProduccion, domicilios: onGoDomicilios, barrios: onGoBarrios, inventario: onGoInventario, contabilidad: onGoContabilidad, clientes: onGoClientes, seguimiento: onGoTenantMonitoring, usuarios: onGoUsuarios }}
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
            <span className="pipeline-mobile-session-label">{mobileSessionLabel}</span>
          </div>
          <button
            type="button"
            className="btn-primary pipeline-mobile-refresh-button"
            title="Actualizar pipeline"
            aria-label="Actualizar pipeline"
            onClick={loadBoard}
          >
            <RotateCw size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="orders-header-side">
            <div className="header-actions">
              <button
                type="button"
                className="btn-primary orders-header-refresh pipeline-mobile-refresh-action"
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

        {loading ? <p className="orders-message">Cargando pipeline...</p> : null}
        {error ? <p className="orders-message">{error}</p> : null}

        <section className="pipeline-board">
          {PIPELINE_COLUMNS.map(column => (
            <PipelineColumn
              key={column.key}
              dropStageKey={column.dropStage}
              title={column.title}
              items={buildPipelineColumnItems(board, column.stages, selectedStage)}
              onOpen={onOpen}
              onDropCard={onDropCard}
              onDragStart={onDragStart}
            />
          ))}
        </section>
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
