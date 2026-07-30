import { PedidoCard } from "./PedidoCard.jsx";

import { COLUMN_CONFIG, EMPTY_CONTENT } from "./pipelineConfig.jsx";
export function PipelineColumn({ dropStageKey, title, items, onOpen, onDropCard, onDragStart }) {
  const config = COLUMN_CONFIG[dropStageKey] || COLUMN_CONFIG.pedido_inicial;
  const emptyContent = EMPTY_CONTENT[dropStageKey] || EMPTY_CONTENT.pedido_inicial;
  const EmptyIcon = emptyContent.Icon;

  const onDragOver = event => event.preventDefault();

  const onDrop = event => {
    event.preventDefault();
    const pedidoId = Number(event.dataTransfer.getData("pedidoId"));
    if (!pedidoId) return;
    onDropCard(pedidoId, dropStageKey);
  };

  return (
    <section className="pipeline-column" onDragOver={onDragOver} onDrop={onDrop}>
      <header className={`pipeline-column-head ${config.tone}`}>
        <h3 className="pipeline-column-title">{title}</h3>
        <span className={`pipeline-column-count ${config.tone}`}>{items.length}</span>
      </header>

      <div className={`pipeline-column-body${items.length === 0 ? " is-empty" : ""}`}
        style={{ "--column-accent": config.accentColor }}>
        {items.length === 0 ? (
          <div className="pipeline-empty-state">
            <span className="pipeline-empty-icon" style={{ color: config.accentColor }}>
              <EmptyIcon size={28} strokeWidth={1.5} />
            </span>
            <strong className="pipeline-empty-title">{emptyContent.title}</strong>
            <span className="pipeline-empty-subtitle">{emptyContent.subtitle}</span>
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
