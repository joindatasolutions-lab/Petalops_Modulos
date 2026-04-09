import { PedidoCard } from "./PedidoCard.jsx";

export function PipelineColumn({ dropStageKey, title, items, onOpen, onDropCard, onDragStart }) {
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
        <span>{items.length}</span>
      </header>

      <div className="pipeline-column-body">
        {items.map(item => (
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
