import { Boxes, ClipboardList, Flower2, Gift, Layers, Truck, UtensilsCrossed } from "lucide-react";
export const MODULES = [
  {
    key: "flores",
    label: "Flores",
    categoria: "Flores",
    icon: Flower2,
    subcategorias: ["Rosas", "Follajes", "Tropicales", "Hortensias", "Lirios", "Orquideas", "Otro"],
    unidades: ["Tallo", "Paquete", "Ramo", "Unidad"],
  },
  {
    key: "bases",
    label: "Bases",
    categoria: "Bases",
    icon: Boxes,
    subcategorias: ["Box", "Madera", "Vidrio", "Ceramica", "Canasta", "Florero", "Otros"],
    unidades: ["Unidad", "Caja", "Paquete"],
  },
  {
    key: "materiales",
    label: "Materiales",
    categoria: "Materiales",
    icon: Layers,
    subcategorias: ["Cintas", "Papel", "Celofan", "Monos", "Yute", "Oasis", "Plastico", "Frascos", "Etiquetas", "Tarjetas", "Insumos operativos", "Otros"],
    unidades: ["Metro", "Rollo", "Unidad", "Paquete", "Caja", "Bolsa", "Frasco", "Kilogramo"],
  },
  {
    key: "adicionales",
    label: "Adicionales",
    categoria: "Adicionales",
    icon: Gift,
    subcategorias: ["Chocolates", "Peluche", "Vino", "Topper", "Otro"],
    unidades: ["Unidad", "Caja", "Paquete", "Botella", "Bolsa", "Kit"],
  },
  {
    key: "arreglos",
    label: "Arreglos",
    categoria: null,
    icon: UtensilsCrossed,
    subcategorias: [],
    unidades: [],
  },
  {
    key: "movimientos",
    label: "Movimientos",
    categoria: null,
    icon: ClipboardList,
    subcategorias: [],
    unidades: [],
  },
  {
    key: "proveedores",
    label: "Proveedores",
    categoria: null,
    icon: Truck,
    subcategorias: [],
    unidades: [],
  },
];
export const initialProveedorForm = {
  nombre: "",
  codigoProveedor: "",
  telefono: "",
  email: "",
  direccion: "",
  activo: true,
};
export const COLOR_OPTIONS = [
  "", "Rojo", "Rosado", "Blanco", "Amarillo", "Naranja",
  "Lila", "Morado", "Azul", "Verde", "Dorado", "Plateado", "Multicolor",
  "Beige", "Cafe", "Gris", "Negro", "Transparente",
];
export const MOVIMIENTO_TIPO_OPTIONS = ["Compra", "Entrada", "Salida", "Ajuste", "Daño", "Pérdida"];
export const INVENTORY_STATUS_CLASS = {
  DISPONIBLE: "is-entregado",
  BAJO_STOCK: "is-pendiente",
  AGOTADO: "is-rechazado",
  INACTIVO: "is-cancelado",
};
export const MOTIVOS_DANO_BY_MODULE = {
  flores: ["Marchita", "Mal estado al recibir", "Daño por transporte", "Daño en produccion", "Plaga", "Regalo", "Otro"],
  bases: ["Rota", "Quebrada", "Golpe transporte", "Defecto de fabrica", "Otro"],
  materiales: ["Mojado", "Roto", "Manchado", "Deteriorado", "Quebrado", "Dañado"],
  adicionales: ["Vencimiento", "Chocolate vencido", "Botella rota", "Peluche manchado", "Otro"],
};

export const MOTIVOS_SALIDA = ["Venta", "Produccion", "Muestra", "Consumo interno", "Regalo"];
export const MOTIVOS_AJUSTE = ["Conteo fisico", "Error anterior", "Producto encontrado", "Producto extraviado"];
