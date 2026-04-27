import { useCallback, useEffect, useMemo, useState } from "react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { PipelineColumn } from "./PipelineColumn.jsx";
import { PipelineFilters } from "./PipelineFilters.jsx";
import { PedidoModal } from "./PedidoModal.jsx";

const PIPELINE_COLUMNS = [
  { key: "pedido_inicial", title: "Creado / Aprobado", stages: ["creado", "aprobado"], dropStage: "aprobado" },
  { key: "produccion_base", title: "Pendiente / En producción", stages: ["pendiente_produccion", "en_produccion"], dropStage: "en_produccion" },
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

const INITIAL_FILTERS = {
  sucursalID: null,
  fecha: "",
  domiciliarioID: null,
  floristaID: null,
  numeroPedido: "",
  soloHoy: true,
  soloAtrasados: false,
  soloEnProduccion: false
};

export function PipelineOperativo({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewInventario,
  canViewClientesPanel,
  canViewUsuariosPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoInventario,
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
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalFromSession = session?.sucursalID != null ? Number(session.sucursalID) : null;

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarPipelinePedidos({
        empresaId,
        sucursalId: filters.sucursalID ?? sucursalFromSession,
        fecha: filters.fecha || null,
        domiciliarioId: filters.domiciliarioID,
        floristaId: filters.floristaID,
        numeroPedido: filters.numeroPedido,
        soloHoy: filters.soloHoy,
        soloAtrasados: filters.soloAtrasados,
        soloEnProduccion: filters.soloEnProduccion
      });
      setBoard(data);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible cargar el pipeline.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, filters, sucursalFromSession]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia("(max-width: 980px)");
    const handleChange = event => {
      if (!event.matches) setSidebarMobileOpen(false);
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleSidebar = () => {
    const isMobile = globalThis.matchMedia("(max-width: 980px)").matches;
    if (isMobile) {
      setSidebarMobileOpen(current => !current);
      return;
    }
    setSidebarPinned(current => !current);
  };

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
    try {
      await api.cambiarEstadoPedidoPipeline({ pedidoId, nuevoEstadoId: estadoId });
      await loadBoard();
    } catch (nextError) {
      setError(nextError?.message || "No fue posible mover el pedido.");
    }
  };

  const buildColumnItems = stages => stages.flatMap(stage => Array.isArray(board?.[stage]) ? board[stage] : []);

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/petalops-compact.png" alt="PetalOps" className="sidebar-brand-logo-compact" />
          <img src="/petalops-logo-full.png" alt="PetalOps" className="sidebar-brand-logo-full" />
        </div>
        <nav className="sidebar-nav" aria-label="Módulos">
          {canViewPipeline ? (
            <button type="button" className="sidebar-nav-btn is-active" onClick={() => { setSidebarMobileOpen(false); onGoPipeline?.(); }}>
              <span className="sidebar-nav-icon">▦</span>
              <span className="sidebar-nav-text">Pipeline</span>
            </button>
          ) : null}
          {canViewPedidos ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoPedidos(); }}><span className="sidebar-nav-icon">🧾</span><span className="sidebar-nav-text">Pedidos</span></button> : null}
          {canViewProduccion ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoProduccion(); }}><span className="sidebar-nav-icon">🏭</span><span className="sidebar-nav-text">Producción</span></button> : null}
          {canViewDomicilios ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoDomicilios(); }}><span className="sidebar-nav-icon">🛵</span><span className="sidebar-nav-text">Domicilios</span></button> : null}
          {canViewInventario ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoInventario(); }}><span className="sidebar-nav-icon">📦</span><span className="sidebar-nav-text">Inventario</span></button> : null}
          {canViewClientesPanel ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoClientes(); }}><span className="sidebar-nav-icon">💐</span><span className="sidebar-nav-text">Clientes</span></button> : null}
          {canViewUsuariosPanel ? <button type="button" className="sidebar-nav-btn" onClick={() => { setSidebarMobileOpen(false); onGoUsuarios(); }}><span className="sidebar-nav-icon">👥</span><span className="sidebar-nav-text">Usuarios</span></button> : null}
        </nav>
        <button type="button" className="btn-outline sidebar-logout-btn" onClick={onLogout} title="Cerrar sesión">
          <span className="sidebar-logout-icon" aria-hidden="true">⏻</span>
          <span className="sidebar-logout-text">Cerrar sesión</span>
        </button>
        <button type="button" className="sidebar-pin-btn" onClick={toggleSidebar} title={sidebarPinned ? "Contraer menú" : "Expandir menú"}>{sidebarPinned ? "←" : "→"}</button>
      </aside>

      <button type="button" className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setSidebarMobileOpen(false)} />

      <main className="pipeline-view">
        <header className="pipeline-header">
          <div className="pipeline-header-top">
            <button type="button" className="sidebar-trigger" onClick={toggleSidebar} title="Abrir o cerrar menú">☰ Menú</button>
          </div>
          <div>
            <h1>Pipeline Operativo</h1>
            <p>Centro de control de pedidos, producción y entrega</p>
          </div>
        </header>

        <PipelineFilters filters={filters} onChange={onChangeFilter} onRefresh={loadBoard} />

        {loading ? <p className="orders-message">Cargando pipeline...</p> : null}
        {error ? <p className="orders-message">{error}</p> : null}

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
      </main>

      <PedidoModal
        item={selected}
        detail={selectedDetail}
        onClose={onCloseModal}
        api={api}
        empresaId={empresaId}
        sucursalId={filters.sucursalID ?? sucursalFromSession}
        onSaveEdit={onSavePedidoEdit}
      />
    </div>
  );
}

