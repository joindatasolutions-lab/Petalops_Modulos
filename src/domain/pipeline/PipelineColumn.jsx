import {
  BadgeCheck,
  CheckCircle,
  PackagePlus,
  Timer,
  Truck,
  XCircle,
} from "lucide-react";
import { PedidoCard } from "./PedidoCard.jsx";

const COLUMN_CONFIG = {
  pedido_inicial:  { tone: "is-created",    accentColor: "#e91e72" },
  produccion_base: { tone: "is-production",  accentColor: "#2563eb" },
  listo:           { tone: "is-ready",       accentColor: "#15803d" },
  en_camino:       { tone: "is-route",       accentColor: "#d97706" },
  entregado:       { tone: "is-delivered",   accentColor: "#15803d" },
  cancelado:       { tone: "is-cancelled",   accentColor: "#dc2626" },
};

const EMPTY_CONTENT = {
  pedido_inicial:  { Icon: PackagePlus, title: "Sin pedidos nuevos",     subtitle: "Los pedidos creados o aprobados aparecerán aquí" },
  produccion_base: { Icon: Timer,       title: "Sin pedidos en producción", subtitle: "Los pedidos asignados a floristas aparecerán aquí" },
  listo:           { Icon: BadgeCheck,  title: "Nada listo aún",         subtitle: "Los arreglos terminados aparecerán aquí" },
  en_camino:       { Icon: Truck,       title: "Sin pedidos en camino",  subtitle: "Los pedidos despachados aparecerán aquí" },
  entregado:       { Icon: CheckCircle, title: "Sin entregas hoy",       subtitle: "Las entregas completadas aparecerán aquí" },
  cancelado:       { Icon: XCircle,     title: "Sin pedidos cancelados", subtitle: "Los pedidos cancelados aparecerán aquí" },
};

export function PipelineColumn({ dropStageKey, title, items, onOpen }) {
  const config = COLUMN_CONFIG[dropStageKey] || COLUMN_CONFIG.pedido_inicial;
  const emptyContent = EMPTY_CONTENT[dropStageKey] || EMPTY_CONTENT.pedido_inicial;
  const EmptyIcon = emptyContent.Icon;

  return (
    <section className="pipeline-column">
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
            stage={dropStageKey}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}
