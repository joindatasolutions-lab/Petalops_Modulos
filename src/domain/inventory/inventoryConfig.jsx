import { Boxes, ClipboardList, Flower2, Gift, Layers, Truck, UtensilsCrossed } from "lucide-react";
export const MODULES = [
  {
    key: "flores",
    label: "Flores",
    categoria: "Flores",
    icon: Flower2,
    subcategorias: ["Rosas", "Girasoles", "Hortensias", "Claveles", "Follaje", "Otras"],
    unidades: ["Tallo", "Paquete", "Unidad"],
  },
  {
    key: "bases",
    label: "Bases",
    categoria: "Bases",
    icon: Boxes,
    subcategorias: ["Box", "Madera", "Vidrio", "Cerámica", "Otros"],
    unidades: ["Unidad"],
  },
  {
    key: "materiales",
    label: "Materiales",
    categoria: "Materiales",
    icon: Layers,
    subcategorias: ["Cintas", "Papeles", "Celofán", "Moños", "Yute", "Oasis", "Plástico", "Frascos", "Insumos Operativos", "Otros"],
    unidades: ["Rollo", "Unidad", "Paquete", "Pliego", "Caja", "Bloque"],
  },
  {
    key: "adicionales",
    label: "Adicionales",
    categoria: "Adicionales",
    icon: Gift,
    subcategorias: ["Chocolates", "Vinos", "Peluches", "Toppers", "Otros"],
    unidades: ["Unidad", "Caja"],
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
  "Beige", "Café", "Gris", "Negro", "Transparente",
];
export const MOVIMIENTO_TIPO_OPTIONS = ["Entrada", "Salida", "Ajuste", "Pérdida"];
export const INVENTORY_STATUS_CLASS = {
  DISPONIBLE: "is-entregado",
  BAJO_STOCK: "is-pendiente",
  AGOTADO: "is-rechazado",
  INACTIVO: "is-cancelado",
};