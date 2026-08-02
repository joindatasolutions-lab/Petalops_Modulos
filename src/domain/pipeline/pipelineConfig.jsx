import {
  BadgeCheck,
  CheckCircle,
  ClipboardList,
  History,
  PackagePlus,
  PackageSearch,
  Timer,
  Truck,
  XCircle,
} from "lucide-react";
import { todayIsoDateBogota } from "../../shared/utils.js";

export const PIPELINE_STAGES = ["creado", "aprobado", "pendiente_produccion", "en_produccion", "listo", "en_camino", "entregado", "cancelado"];
export const PIPELINE_COLUMNS = [
  { key: "pedido_inicial", title: "Creado / Aprobado", stages: ["creado", "aprobado"], dropStage: "aprobado" },
  { key: "produccion_base", title: "Pendiente / En produccion", stages: ["pendiente_produccion", "en_produccion"], dropStage: "en_produccion" },
  { key: "listo", title: "Listo", stages: ["listo"], dropStage: "listo" },
  { key: "en_camino", title: "En camino", stages: ["en_camino"], dropStage: "en_camino" },
  { key: "entregado", title: "Entregado", stages: ["entregado"], dropStage: "entregado" },
  { key: "cancelado", title: "Cancelado", stages: ["cancelado"], dropStage: "cancelado" },
];
export const STAGE_TO_ESTADO_ID = { creado: 1, aprobado: 2, cancelado: 6 };
export const PIPELINE_TABS = [
  { key: "pipeline", label: "Pipeline", icon: ClipboardList },
  { key: "historial", label: "Historial reasignaciones", icon: History },
  { key: "pedidos", label: "Historial pedidos", icon: PackageSearch },
];
export const INITIAL_FILTERS = {
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
export const PIPELINE_STATE_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "creado", label: "Creado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "pendiente_produccion", label: "Pendiente produccion" },
  { value: "en_produccion", label: "En produccion" },
  { value: "listo", label: "Listo" },
  { value: "en_camino", label: "En camino" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "atrasados", label: "Solo atrasados" },
  { value: "produccion", label: "Pendiente / En produccion" },
];
export const COLUMN_CONFIG = {
  pedido_inicial: { tone: "is-created", accentColor: "#e91e72" },
  produccion_base: { tone: "is-production", accentColor: "#2563eb" },
  listo: { tone: "is-ready", accentColor: "#15803d" },
  en_camino: { tone: "is-route", accentColor: "#d97706" },
  entregado: { tone: "is-delivered", accentColor: "#15803d" },
  cancelado: { tone: "is-cancelled", accentColor: "#dc2626" },
};
export const EMPTY_CONTENT = {
  pedido_inicial: { Icon: PackagePlus, title: "Sin pedidos nuevos", subtitle: "Los pedidos creados o aprobados apareceran aqui" },
  produccion_base: { Icon: Timer, title: "Sin pedidos en produccion", subtitle: "Los pedidos asignados a floristas apareceran aqui" },
  listo: { Icon: BadgeCheck, title: "Nada listo aun", subtitle: "Los arreglos terminados apareceran aqui" },
  en_camino: { Icon: Truck, title: "Sin pedidos en camino", subtitle: "Los pedidos despachados apareceran aqui" },
  entregado: { Icon: CheckCircle, title: "Sin entregas hoy", subtitle: "Las entregas completadas apareceran aqui" },
  cancelado: { Icon: XCircle, title: "Sin pedidos cancelados", subtitle: "Los pedidos cancelados apareceran aqui" },
};
