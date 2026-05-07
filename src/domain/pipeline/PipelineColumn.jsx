import {
  IconCircleCheck,
  IconClockExclamation,
  IconPackageExport,
  IconPackageImport,
  IconRosetteDiscountCheck,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";
import { PedidoCard } from "./PedidoCard.jsx";

const COLUMN_TONE = {
  pedido_inicial: "is-created",
  produccion_base: "is-production",
  listo: "is-ready",
  en_camino: "is-route",
  entregado: "is-delivered",
  cancelado: "is-cancelled",
};

const EMPTY_ICON_BY_COLUMN = {
  pedido_inicial: IconPackageImport,
  produccion_base: IconClockExclamation,
  listo: IconRosetteDiscountCheck,
  en_camino: IconTruckDelivery,
  entregado: IconCircleCheck,
  cancelado: IconX,
};

export function PipelineColumn({ dropStageKey, title, items, onOpen, onDropCard, onDragStart }) {
  const EmptyIcon = EMPTY_ICON_BY_COLUMN[dropStageKey] || IconPackageExport;
  const toneClass = COLUMN_TONE[dropStageKey] || "is-created";

  const onDragOver = event => {
    event.preventDefault();
  };

  const onDrop = event => {
    event.preventDefault();
    const pedidoId = Number(event.dataTransfer.getData("pedidoId"));
    if (!pedidoId) return;
    onDropCard(pedidoId, dropStageKey);
  };

  return (
    <section className="pipeline-column" onDragOver={onDragOver} onDrop={onDrop}>
      <header className="pipeline-column-head">
        <h3>{title}</h3>
        <span className={`pipeline-column-count ${toneClass}`}>{items.length}</span>
      </header>

      <div className={`pipeline-column-body${items.length === 0 ? " is-empty" : ""}`}>
        {items.length === 0 ? (
          <div className="pipeline-empty-state">
            <EmptyIcon size={22} stroke={1.8} />
            <span>Sin pedidos</span>
          </div>
        ) : items.map(item => (
          <PedidoCard
            key={item.id_pedido}
            item={item}
            onOpen={onOpen}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </section>
  );
}
