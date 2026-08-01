/*
 * Constantes compartidas del modulo de produccion.
 * Centraliza estados, opciones de paginacion, submenu y valores fallback.
 */
import { ESTADOS_UI } from "./productionDomain.js";

export const ESTADOS_FILTRO_DEFAULT = ESTADOS_UI;
export const ESTADOS_FLORISTA = ["Activo", "Inactivo", "Incapacidad"];
export const DEFAULT_PRODUCTION_USER = "admin.demo";
export const PAGE_SIZE_OPTIONS = [10, 20, 50];
export const LOOKER_STUDIO_URL = "https://lookerstudio.google.com/embed/reporting/d08a04af-ed8e-4dde-a83c-90888bfde39d/page/p_mp7qxa6dzd";

export const SUBMENU_OPTIONS = [
  { key: "pedidos", label: "Pedidos" },
  { key: "disponibilidad", label: "Disponibilidad florista" },
  { key: "incapacidad", label: "Gestión incapacidad" },
  { key: "looker", label: "Looker" },
];
