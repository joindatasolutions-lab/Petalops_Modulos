import { todayIsoDateBogota } from "../../shared/utils.js";

/**
 * Constantes de configuracion del modulo Pedidos.
 *
 * Agrupa valores iniciales y opciones compartidas para evitar que el contenedor
 * principal mezcle configuracion estatica con logica de pantalla.
 */

export const AUTO_REFRESH_INTERVAL_MS = 15000;
export const ORDERS_FILTER_CACHE_LIMIT = 8;
export const PAGE_SIZE_OPTIONS = [10, 20, 50];
export const CANCELADO_PEDIDO_ESTADO_ID = 6;

export const initialFilters = {
  q: "",
  estado: "",
  sinImprimir: false,
  soloTienda: false,
  metodoPago: "",
  fechaDesde: todayIsoDateBogota(),
  fechaHasta: todayIsoDateBogota(),
  page: 1,
  pageSize: 10
};

export const DEFAULT_ORDERS_KPIS = {
  ventaHoy: 0,
  pedidosHoy: 0,
  aprobados: 0,
  pendientes: 0,
  cancelados: 0,
  sinImprimir: 0,
};

export const DEFAULT_NEW_ORDER_FORM = {
  productoID: "",
  productoCodigo: "",
  productoNombre: "",
  cantidad: 1,
  precio: "",
  clienteNombre: "",
  clienteTelefono: "",
  clienteEmail: "",
  clienteID: null,
  clienteTipoIdent: "",
  clienteIdentificacion: "",
  destinatarioNombre: "",
  telefonoDestino: "",
  direccion: "",
  barrioNombre: "",
  domicilioObsequiado: false,
  fechaEntrega: todayIsoDateBogota(),
  horaEntrega: "08:00",
  mensajeTarjeta: "",
  firma: "",
  observacionGeneral: "",
  metodoPago: "",
  canalFlora: "",
};

export const MESSAGE_CARD_FONT_OPTIONS = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond" },
  { value: "'EB Garamond', serif", label: "EB Garamond" },
  { value: "'Libre Baskerville', serif", label: "Libre Baskerville" },
  { value: "'Crimson Text', serif", label: "Crimson Text" },
  { value: "'Great Vibes', cursive", label: "Great Vibes" }
];
