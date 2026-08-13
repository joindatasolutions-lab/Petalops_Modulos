import { BarChart3, CreditCard, ListChecks, Receipt, Users, Wallet } from "lucide-react";

export const ACCOUNTING_VIEWS = [
  { key: "ventas", label: "Ventas" },
  { key: "detalle", label: "Saldos/Desc." },
  { key: "arreglos", label: "Metricas por arreglo" },
  { key: "personal", label: "Personal" },
  { key: "cuentas", label: "Cuentas de pago" },
  { key: "caja", label: "Caja" },
];

export const ACCOUNTING_VIEW_ICONS = {
  ventas: Receipt,
  detalle: ListChecks,
  arreglos: BarChart3,
  personal: Users,
  cuentas: CreditCard,
  caja: Wallet,
};

export const initialFilters = {
  fechaDesde: "",
  fechaHasta: "",
};

export const initialCashForm = {
  fecha: "",
  base: "",
  efectivo: "",
  gasto: "",
  guardado: "",
  totalEfectivo: "",
  observacion: "",
};
