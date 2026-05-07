import { useCallback, useEffect, useMemo, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
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
  fecha: new Date().toISOString().slice(0, 10),
  domiciliarioID: "",
  floristaID: "",
  numeroPedido: "",
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
  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [processingPedidoIds, setProcessingPedidoIds] = useState([]);

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
      globalThis.alert("Este pedido ya se está actualizando. Espera un momento.");
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
            <p className="orders-admin-subtitle">Centro de control de pedidos, producción y entrega</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary pipeline-header-refresh" onClick={loadBoard}>
              <IconRefresh size={15} stroke={2} />
              <span>Actualizar</span>
            </button>
          </div>
        </header>

        <PipelineFilters filters={filters} onChange={onChangeFilter} />

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
