import {
  IconBuildingFactory,
  IconClipboardData,
  IconEyeCog,
  IconNumbers,
  IconPackages,
  IconShoppingCartCopy,
  IconTimelineEventExclamation,
  IconTruckDelivery,
  IconUsers,
} from "@tabler/icons-react";

export function PedidosMenuIcon() {
  return <IconShoppingCartCopy stroke={2.1} size={20} color="currentColor" />;
}

export function PipelineMenuIcon() {
  return <IconTimelineEventExclamation stroke={2} size={20} color="currentColor" />;
}

export function ProduccionMenuIcon() {
  return <IconBuildingFactory stroke={2} size={20} color="currentColor" />;
}

export function DomiciliosMenuIcon() {
  return <IconTruckDelivery stroke={2} size={20} color="currentColor" />;
}

export function InventarioMenuIcon() {
  return <IconPackages stroke={2} size={20} color="currentColor" />;
}

export function ClientesMenuIcon() {
  return <IconUsers stroke={2} size={20} color="currentColor" />;
}

export function UsuariosMenuIcon() {
  return <IconEyeCog stroke={2} size={20} color="currentColor" />;
}

export function ContabilidadMenuIcon() {
  return <IconNumbers stroke={2} size={20} color="currentColor" />;
}

export function TrazabilidadMenuIcon() {
  return <IconClipboardData stroke={2} size={20} color="currentColor" />;
}
