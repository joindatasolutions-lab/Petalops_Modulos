import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP, normalizeStatus, todayIsoDateBogota } from "../../shared/utils.js";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Calculator,
  CheckCircle2,
  ChevronDown,
  CircleX,
  ClipboardList,
  DollarSign,
  EllipsisVertical,
  Eye,
  Flower2,
  Gauge,
  Gift,
  Layers,
  ListChecks,
  PackagePlus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  TriangleAlert,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";

// ─── Configuración de módulos ────────────────────────────────────────────────

const MODULES = [
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

const initialProveedorForm = {
  nombre: "",
  codigoProveedor: "",
  telefono: "",
  email: "",
  direccion: "",
  activo: true,
};

const COLOR_OPTIONS = [
  "", "Rojo", "Rosado", "Blanco", "Amarillo", "Naranja",
  "Lila", "Morado", "Azul", "Verde", "Dorado", "Plateado", "Multicolor",
  "Beige", "Café", "Gris", "Negro", "Transparente",
];

const MOVIMIENTO_TIPO_OPTIONS = ["Entrada", "Salida", "Ajuste", "Pérdida"];

const INVENTORY_STATUS_CLASS = {
  DISPONIBLE: "is-entregado",
  BAJO_STOCK: "is-pendiente",
  AGOTADO: "is-rechazado",
  INACTIVO: "is-cancelado",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusClass(estadoStock) {
  const key = normalizeStatus(estadoStock);
  return INVENTORY_STATUS_CLASS[key] || "is-pendiente";
}

function inventoryRowClass(item) {
  const status = normalizeStatus(item?.estadoStock);
  return [
    "inventory-row-card",
    status === "DISPONIBLE" ? "inventory-row-available" : "",
    status === "BAJO_STOCK" ? "inventory-row-warning" : "",
    status === "AGOTADO" ? "inventory-row-danger" : "",
    status === "INACTIVO" || item?.activo === false ? "inventory-row-muted" : "",
  ].filter(Boolean).join(" ");
}

function todayIsoDate() { return todayIsoDateBogota(); }
function isTodayDate(value) { return String(value || "").slice(0, 10) === todayIsoDate(); }
function isSameMonthAsToday(value) { return String(value || "").slice(0, 7) === todayIsoDate().slice(0, 7); }

function stockLevel(item) {
  const stock = Number(item?.stockActual || 0);
  const minimum = Math.max(Number(item?.stockMinimo || 0), 1);
  if (stock <= 0) return { key: "critical", label: "Crítico", percent: 8, className: "is-critical" };
  if (stock <= minimum) return { key: "critical", label: "Crítico", percent: 18, className: "is-critical" };
  if (stock <= minimum * 2.5) return { key: "medium", label: "Medio", percent: 52, className: "is-medium" };
  return { key: "healthy", label: "Saludable", percent: 92, className: "is-healthy" };
}

function rotationLevel(item) {
  const stock = Number(item?.stockActual || 0);
  const minimum = Math.max(Number(item?.stockMinimo || 0), 1);
  if (stock <= minimum) return { label: "Alta", className: "is-high" };
  if (stock <= minimum * 2.5) return { label: "Media", className: "is-medium" };
  return { label: "Baja", className: "is-low" };
}

function relativeMovementLabel(dateValue) {
  const raw = String(dateValue || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "-";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 0) return "Hoy";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return minutes <= 1 ? "Hace 1 min" : `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Hace 1 día" : `Hace ${days} días`;
}

function isNearExpiry(fechaVencimiento) {
  if (!fechaVencimiento) return false;
  const diff = new Date(fechaVencimiento).getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function isExpired(fechaVencimiento) {
  if (!fechaVencimiento) return false;
  return new Date(fechaVencimiento).getTime() < Date.now();
}

export function filterInventoryItems(items, { stockFiltro = "", subcategoriaFiltro = "" } = {}) {
  return (Array.isArray(items) ? items : []).filter(item => {
    if (stockFiltro && stockLevel(item).key !== stockFiltro) return false;
    if (subcategoriaFiltro && String(item.subcategoria || "").toLowerCase() !== subcategoriaFiltro.toLowerCase()) return false;
    return true;
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function InventoryPage({
  session,
  canViewPipeline, canViewPedidos, canViewProduccion, canViewDomicilios, canViewBarrios,
  canViewInventario, canViewContabilidad,
  canViewClientesPanel, canViewUsuariosPanel,
  onGoPipeline, onGoPedidos, onGoProduccion, onGoDomicilios, onGoBarrios, onGoInventario,
  onGoContabilidad, onGoClientes, onGoUsuarios, onLogout,
}) {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const sucursalId = Number(session?.sucursalID || tenantConfig.sucursalId);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();

  // ── Estado principal ──
  const [moduloActivo, setModuloActivo] = useState("flores");
  const [vistaActiva, setVistaActiva] = useState("lista"); // "lista" | "crear" | "ajustar"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [openInventoryMenuId, setOpenInventoryMenuId] = useState(null);

  // ── Datos ──
  const inventarioRequestIdRef = useRef(0);
  const catalogoRequestIdRef = useRef(0);
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [recetaDetalle, setRecetaDetalle] = useState(null);

  // ── Filtros ──
  const [q, setQ] = useState("");
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [proveedorFiltro, setProveedorFiltro] = useState("");
  const [stockFiltro, setStockFiltro] = useState("");
  const [tipoMovimientoFiltro, setTipoMovimientoFiltro] = useState("");

  // ── Formularios ──
  const moduloConfig = useMemo(() => MODULES.find(m => m.key === moduloActivo), [moduloActivo]);

  const initialCreateForm = useMemo(() => ({
    codigo: "",
    nombre: "",
    categoria: moduloConfig?.categoria || "Flores",
    subcategoria: "",
    color: "",
    descripcion: "",
    tamano: "",
    unidadMedida: moduloConfig?.unidades[0] || "Unidad",
    fechaVencimiento: "",
    marca: "",
    precioVenta: "0",
    proveedorID: "",
    stockActual: "0",
    stockMinimo: "5",
    valorUnitario: "0",
  }), [moduloConfig]);

  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [stockForm, setStockForm] = useState({ inventarioID: "", tipoMovimiento: "Entrada", cantidad: "1", stockObjetivo: "", motivo: "" });
  const initialRecetaForm = {
    nombre: "",
    descripcion: "",
    capacidadManual: "",
    productoModo: "nuevo", // "nuevo" (crea producto en catalogo) | "vincular" (usa uno existente) | "ninguno"
    productoID: "",
    precioVenta: "",
    imagenUrl: "",
  };
  const [recetaForm, setRecetaForm] = useState(initialRecetaForm);
  const [recetaProductoSeleccionado, setRecetaProductoSeleccionado] = useState(null);
  const [catalogoQuery, setCatalogoQuery] = useState("");
  const [catalogoResultados, setCatalogoResultados] = useState([]);
  const [catalogoBuscando, setCatalogoBuscando] = useState(false);
  const [ingredienteForm, setIngredienteForm] = useState({ inventarioID: "", cantidad: "1" });
  const [simuladorCantidad, setSimuladorCantidad] = useState("1");

  const [creating, setCreating] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [savingReceta, setSavingReceta] = useState(false);
  const [savingIngrediente, setSavingIngrediente] = useState(false);
  const [proveedorForm, setProveedorForm] = useState(initialProveedorForm);
  const [savingProveedor, setSavingProveedor] = useState(false);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [editingProveedorId, setEditingProveedorId] = useState(null);

  // ── Cambiar módulo ──
  const cambiarModulo = useCallback(key => {
    setModuloActivo(key);
    setVistaActiva("lista");
    setQ("");
    setSubcategoriaFiltro("");
    setEstadoFiltro("");
    setProveedorFiltro("");
    setStockFiltro("");
    setTipoMovimientoFiltro("");
    setError("");
    setInfo("");
    setOpenInventoryMenuId(null);
    setRecetaDetalle(null);
  }, []);

  // Sync create form category when module changes
  useEffect(() => {
    setCreateForm(f => ({
      ...f,
      categoria: moduloConfig?.categoria || "Flores",
      subcategoria: "",
      unidadMedida: moduloConfig?.unidades[0] || "Unidad",
    }));
  }, [moduloConfig]);

  // ── Métricas generales (todos los items cargados) ──
  const inventoryMetrics = useMemo(() => {
    const stockTotal = items.reduce((sum, item) => sum + Number(item.stockActual || 0), 0);
    const valorInventario = items.reduce((sum, item) => sum + (Number(item.stockActual || 0) * Number(item.valorUnitario || 0)), 0);
    const entradasHoy = movimientos.filter(m => isTodayDate(m.fecha) && normalizeStatus(m.tipoMovimiento) === "ENTRADA").length;
    const salidasHoy = movimientos.filter(m => isTodayDate(m.fecha) && normalizeStatus(m.tipoMovimiento) === "SALIDA").length;
    const bajoStock = items.filter(item => normalizeStatus(item?.estadoStock) === "BAJO_STOCK").length;
    const agotados = items.filter(item => normalizeStatus(item?.estadoStock) === "AGOTADO").length;
    return { valorInventario, stockTotal, entradasHoy, salidasHoy, bajoStock, agotados };
  }, [items, movimientos]);

  // ── Métricas especificas del submenu Bases (items ya viene filtrado por
  // categoria="Bases" via la API cuando moduloActivo === "bases") ──
  const basesMetrics = useMemo(() => {
    const totalBases = items.length;
    const stockBajo = items.filter(item => normalizeStatus(item?.estadoStock) === "BAJO_STOCK").length;
    const agotadas = items.filter(item => normalizeStatus(item?.estadoStock) === "AGOTADO").length;
    const basesInventarioIds = new Set(items.map(item => item.inventarioID));
    const comprasEsteMes = movimientos.filter(mov =>
      normalizeStatus(mov?.tipoMovimiento) === "ENTRADA"
      && basesInventarioIds.has(mov?.inventarioID)
      && isSameMonthAsToday(mov?.fecha)
    ).length;
    const proveedorIdsEnBases = new Set(
      items.map(item => item.proveedorID).filter(id => id != null)
    );
    const proveedoresActivos = proveedores.filter(p => proveedorIdsEnBases.has(p.idProveedor) && p.activo).length;
    return { totalBases, stockBajo, agotadas, comprasEsteMes, proveedoresActivos };
  }, [items, movimientos, proveedores]);

  // ── Items filtrados en vista ──
  const visibleItems = useMemo(() => {
    return filterInventoryItems(items, { stockFiltro, subcategoriaFiltro });
  }, [items, stockFiltro, subcategoriaFiltro]);

  // ── Panel de categorías: muestra subcategorías del módulo activo ──
  const categorySummary = useMemo(() => {
    const totalStock = Math.max(items.reduce((sum, item) => sum + Number(item.stockActual || 0), 0), 1);
    const byKey = new Map();
    items.forEach(item => {
      const key = String(item.subcategoria || item.categoria || "Sin categoría").trim() || "Sin categoría";
      byKey.set(key, (byKey.get(key) || 0) + Number(item.stockActual || 0));
    });
    return Array.from(byKey.entries())
      .map(([label, cantidad]) => ({ label, cantidad, percent: Math.round((cantidad / totalStock) * 100) }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
  }, [items]);

  const criticalItems = useMemo(
    () => items
      .filter(item => ["critical", "medium"].includes(stockLevel(item).key))
      .sort((a, b) => Number(a.stockActual || 0) - Number(b.stockActual || 0))
      .slice(0, 5),
    [items]
  );

  const expiryAlerts = useMemo(
    () => items.filter(item => item.fechaVencimiento && (isExpired(item.fechaVencimiento) || isNearExpiry(item.fechaVencimiento))),
    [items]
  );

  // ── Más vendidos: suma de "Salida" por item, dentro del módulo activo ──
  const topSellers = useMemo(() => {
    const salidasPorInventarioId = new Map();
    movimientos.forEach(mov => {
      if (normalizeStatus(mov?.tipoMovimiento) !== "SALIDA") return;
      const id = mov?.inventarioID;
      if (id == null) return;
      salidasPorInventarioId.set(id, (salidasPorInventarioId.get(id) || 0) + Number(mov?.cantidad || 0));
    });
    return items
      .map(item => ({ item, vendidos: salidasPorInventarioId.get(item.inventarioID) || 0 }))
      .filter(entry => entry.vendidos > 0)
      .sort((a, b) => b.vendidos - a.vendidos)
      .slice(0, 5);
  }, [items, movimientos]);

  const lastMovementByItem = useMemo(() => {
    const map = new Map();
    movimientos.forEach(movement => {
      const keys = [String(movement.codigo || "").trim(), String(movement.nombre || "").trim().toLowerCase()].filter(Boolean);
      keys.forEach(key => {
        const current = map.get(key);
        const currentTime = current ? new Date(current.fecha || 0).getTime() : 0;
        const nextTime = new Date(movement.fecha || 0).getTime();
        if (!current || nextTime > currentTime) map.set(key, movement);
      });
    });
    return map;
  }, [movimientos]);

  const lastMovementForItem = useCallback(item => {
    const byCode = lastMovementByItem.get(String(item?.codigo || "").trim());
    if (byCode) return relativeMovementLabel(byCode.fecha);
    const byName = lastMovementByItem.get(String(item?.nombre || "").trim().toLowerCase());
    return relativeMovementLabel(byName?.fecha);
  }, [lastMovementByItem]);

  const movimientosFiltrados = useMemo(() => {
    if (!tipoMovimientoFiltro) return movimientos;
    return movimientos.filter(m => m.tipoMovimiento === tipoMovimientoFiltro);
  }, [movimientos, tipoMovimientoFiltro]);

  // ── Arreglos: costo de producción, capacidad de fabricación y componente
  // limitante, calculados en el navegador cruzando la receta con el stock
  // actual (allItems). Precio de venta / vendidos hoy / reservados vienen del
  // backend (via el producto del catálogo vinculado a la receta). ──
  const recetaResumen = useMemo(() => {
    const detalles = recetaDetalle?.detalles;
    if (!Array.isArray(detalles) || detalles.length === 0) return null;
    let costoTotal = 0;
    let capacidadAuto = Infinity;
    let limitante = null;
    const ingredientes = detalles.map(det => {
      const item = allItems.find(i => i.inventarioID === det.inventarioID);
      const stock = Number(item?.stockActual || 0);
      const cantidadReq = Number(det.cantidad || 0);
      const costoUnitario = Number(item?.valorUnitario || 0);
      costoTotal += costoUnitario * cantidadReq;
      const posibles = cantidadReq > 0 ? Math.floor(stock / cantidadReq) : Infinity;
      if (posibles < capacidadAuto) {
        capacidadAuto = posibles;
        limitante = det;
      }
      return { det, stock, cantidadReq, posibles };
    });
    capacidadAuto = Number.isFinite(capacidadAuto) ? capacidadAuto : 0;
    const tieneManual = recetaDetalle?.capacidadManual != null && recetaDetalle.capacidadManual !== "";
    const capacidad = tieneManual ? Number(recetaDetalle.capacidadManual) : capacidadAuto;
    const precioVenta = recetaDetalle?.precioVenta != null ? Number(recetaDetalle.precioVenta) : null;
    const utilidad = precioVenta != null ? precioVenta - costoTotal : null;
    const reservados = Number(recetaDetalle?.reservados || 0);
    const vendidosHoy = Number(recetaDetalle?.vendidosHoy || 0);
    const disponibles = Math.max(0, capacidad - reservados);
    return {
      costoTotal,
      capacidadAuto,
      capacidad,
      capacidadEsManual: tieneManual,
      limitante,
      ingredientes,
      precioVenta,
      utilidad,
      reservados,
      vendidosHoy,
      disponibles,
    };
  }, [recetaDetalle, allItems]);

  const simulacionPedido = useMemo(() => {
    if (!recetaResumen) return null;
    const cantidad = Number(simuladorCantidad || 0);
    if (!cantidad || cantidad <= 0) return null;
    const detalle = recetaResumen.ingredientes.map(({ det, stock }) => {
      const necesario = Number(det.cantidad || 0) * cantidad;
      const faltante = Math.max(0, necesario - stock);
      return { nombre: det.nombre, codigo: det.codigo, necesario, disponible: stock, faltante, ok: faltante === 0 };
    });
    return { cantidad, permitido: detalle.every(d => d.ok), detalle };
  }, [recetaResumen, simuladorCantidad]);

  // ── Loaders ──
  const loadProveedores = useCallback(async () => {
    try {
      const data = await api.listarProveedoresInventario({ empresaId });
      setProveedores(Array.isArray(data.items) ? data.items : []);
    } catch { setProveedores([]); }
  }, [api, empresaId]);

  const loadInventario = useCallback(async () => {
    const cat = MODULES.find(m => m.key === moduloActivo)?.categoria;
    if (!cat) { setItems([]); return; }
    // Evita que una respuesta vieja (p.ej. de un modulo/pestaña anterior que
    // tarda mas en responder) sobreescriba el resultado de una peticion mas
    // reciente al llegar fuera de orden.
    const requestId = ++inventarioRequestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await api.listarInventario({
        empresaId,
        categoria: cat,
        estado: estadoFiltro || null,
        proveedorId: proveedorFiltro ? Number(proveedorFiltro) : null,
        q: q || null,
      });
      if (requestId !== inventarioRequestIdRef.current) return;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      if (requestId !== inventarioRequestIdRef.current) return;
      setItems([]);
      setError(nextError?.message || "No fue posible cargar inventario.");
    } finally {
      if (requestId === inventarioRequestIdRef.current) setLoading(false);
    }
  }, [api, empresaId, moduloActivo, estadoFiltro, proveedorFiltro, q]);

  // Lista completa (todas las categorías) para el selector del registro
  // rápido de movimientos desde la pestaña Movimientos.
  const loadAllItems = useCallback(async () => {
    try {
      const data = await api.listarInventario({ empresaId });
      setAllItems(Array.isArray(data.items) ? data.items : []);
    } catch { setAllItems([]); }
  }, [api, empresaId]);

  const loadMovimientos = useCallback(async () => {
    try {
      const data = await api.listarMovimientosInventario({ empresaId });
      setMovimientos(Array.isArray(data.items) ? data.items : []);
    } catch { setMovimientos([]); }
  }, [api, empresaId]);

  const loadRecetas = useCallback(async () => {
    try {
      const data = await api.listarRecetas({ empresaId, soloActivos: false });
      setRecetas(Array.isArray(data.items) ? data.items : []);
    } catch { setRecetas([]); }
  }, [api, empresaId]);

  const loadRecetaDetalle = useCallback(async recetaId => {
    try {
      const data = await api.obtenerReceta({ recetaId });
      setRecetaDetalle(data);
      setSimuladorCantidad("1");
    } catch { setRecetaDetalle(null); }
  }, [api]);

  // Busca productos del catalogo de ventas para vincular un Arreglo existente
  // (reutiliza precio/imagen ya definidos ahi, en vez de duplicarlos). Usa un
  // contador de peticiones para que una busqueda vieja (p.ej. la carga inicial
  // sin filtro, que trae mas filas y puede tardar mas) no sobreescriba el
  // resultado de una busqueda mas reciente al llegar fuera de orden.
  const buscarProductoCatalogo = useCallback(async query => {
    const requestId = ++catalogoRequestIdRef.current;
    setCatalogoBuscando(true);
    try {
      const data = await api.buscarArreglosCatalogo({ empresaId, sucursalId, q: query });
      if (requestId !== catalogoRequestIdRef.current) return;
      setCatalogoResultados(Array.isArray(data) ? data : []);
    } catch {
      if (requestId !== catalogoRequestIdRef.current) return;
      setCatalogoResultados([]);
    } finally {
      if (requestId === catalogoRequestIdRef.current) setCatalogoBuscando(false);
    }
  }, [api, empresaId, sucursalId]);

  useEffect(() => { loadProveedores().catch(() => {}); }, [loadProveedores]);
  useEffect(() => { loadMovimientos().catch(() => {}); }, [loadMovimientos]);

  useEffect(() => {
    if (moduloActivo !== "arreglos" || vistaActiva !== "crear" || recetaForm.productoModo !== "vincular") return undefined;
    // Sin texto todavia se trae el catalogo completo (para poder explorarlo),
    // el contador de peticiones (catalogoRequestIdRef) evita que esa carga
    // inicial, al tardar mas por traer mas filas, pise una busqueda posterior
    // mas especifica que llegue primero.
    const timeoutId = setTimeout(() => { buscarProductoCatalogo(catalogoQuery).catch(() => {}); }, 350);
    return () => clearTimeout(timeoutId);
  }, [moduloActivo, vistaActiva, recetaForm.productoModo, catalogoQuery, buscarProductoCatalogo]);

  useEffect(() => {
    if (moduloActivo === "arreglos") { loadRecetas().catch(() => {}); loadAllItems().catch(() => {}); }
    else if (moduloActivo === "movimientos") { loadAllItems().catch(() => {}); }
    else { loadInventario().catch(() => {}); }
  }, [moduloActivo, loadInventario, loadRecetas, loadAllItems]);

  const refreshAll = () => {
    loadInventario().catch(() => {});
    loadMovimientos().catch(() => {});
    if (moduloActivo === "arreglos") { loadRecetas().catch(() => {}); loadAllItems().catch(() => {}); }
    if (moduloActivo === "movimientos") loadAllItems().catch(() => {});
  };

  // ── Submit crear item ──
  const submitCreate = async event => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setInfo("");
    try {
      await api.crearItemInventario({
        empresaID: empresaId,
        codigo: String(createForm.codigo || "").trim(),
        nombre: String(createForm.nombre || "").trim(),
        categoria: String(createForm.categoria || "").trim(),
        subcategoria: String(createForm.subcategoria || "").trim() || null,
        color: String(createForm.color || "").trim() || null,
        descripcion: String(createForm.descripcion || "").trim() || null,
        tamano: String(createForm.tamano || "").trim() || null,
        unidadMedida: String(createForm.unidadMedida || "Unidad").trim(),
        fechaVencimiento: createForm.fechaVencimiento || null,
        marca: String(createForm.marca || "").trim() || null,
        precioVenta: moduloActivo === "adicionales" ? Number(createForm.precioVenta || 0) : null,
        proveedorID: createForm.proveedorID ? Number(createForm.proveedorID) : null,
        stockActual: Number(createForm.stockActual || 0),
        stockMinimo: Number(createForm.stockMinimo || 0),
        valorUnitario: Number(createForm.valorUnitario || 0),
        activo: true,
      });
      setCreateForm(initialCreateForm);
      await loadInventario();
      await loadMovimientos();
      setInfo("Item creado correctamente.");
      setVistaActiva("lista");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible crear item.");
    } finally {
      setCreating(false);
    }
  };

  // ── Modal proveedor ──
  const openCreateProveedorModal = () => {
    setEditingProveedorId(null);
    setProveedorForm(initialProveedorForm);
    setError("");
    setInfo("");
    setShowProveedorModal(true);
  };

  const openEditProveedorModal = item => {
    setEditingProveedorId(item.idProveedor);
    setProveedorForm({
      nombre: item.nombre || "",
      codigoProveedor: item.codigoProveedor || "",
      telefono: item.telefono || "",
      email: item.email || "",
      direccion: item.direccion || "",
      activo: Boolean(item.activo),
    });
    setError("");
    setInfo("");
    setShowProveedorModal(true);
  };

  const closeProveedorModal = () => {
    setShowProveedorModal(false);
    setEditingProveedorId(null);
    setProveedorForm(initialProveedorForm);
  };

  // ── Submit proveedor ──
  const submitProveedor = async event => {
    event.preventDefault();
    setSavingProveedor(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        empresaId,
        nombre: String(proveedorForm.nombre || "").trim(),
        codigoProveedor: String(proveedorForm.codigoProveedor || "").trim() || null,
        telefono: String(proveedorForm.telefono || "").trim() || null,
        email: String(proveedorForm.email || "").trim() || null,
        direccion: String(proveedorForm.direccion || "").trim() || null,
        activo: Boolean(proveedorForm.activo),
      };
      if (editingProveedorId) {
        await api.actualizarProveedorInventario({ ...payload, proveedorId: editingProveedorId });
      } else {
        await api.crearProveedorInventario(payload);
      }
      await loadProveedores();
      setInfo(editingProveedorId ? "Proveedor actualizado correctamente." : "Proveedor creado correctamente.");
      closeProveedorModal();
    } catch (nextError) {
      setError(nextError?.message || "No fue posible guardar proveedor.");
    } finally {
      setSavingProveedor(false);
    }
  };

  // ── Submit ajustar stock ──
  const submitStock = async event => {
    event.preventDefault();
    if (!stockForm.inventarioID) { setError("Selecciona un item."); return; }
    setSavingStock(true);
    setError("");
    setInfo("");
    try {
      await api.ajustarStockInventario({
        inventarioId: Number(stockForm.inventarioID),
        payload: {
          tipoMovimiento: stockForm.tipoMovimiento,
          cantidad: Number(stockForm.cantidad || 0),
          stockObjetivo: stockForm.tipoMovimiento === "Ajuste" ? Number(stockForm.stockObjetivo || 0) : null,
          motivo: String(stockForm.motivo || "").trim(),
        },
      });
      setStockForm({ inventarioID: "", tipoMovimiento: "Entrada", cantidad: "1", stockObjetivo: "", motivo: "" });
      if (moduloActivo === "movimientos") {
        await loadAllItems();
      } else {
        await loadInventario();
      }
      await loadMovimientos();
      setInfo("Movimiento registrado.");
      setVistaActiva("lista");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible ajustar stock.");
    } finally {
      setSavingStock(false);
    }
  };

  const toggleActivo = async item => {
    try {
      await api.actualizarActivoInventario({ inventarioId: item.inventarioID, activo: !item.activo });
      await loadInventario();
      setInfo(`${item.nombre} ${item.activo ? "desactivado" : "activado"}.`);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible actualizar estado.");
    }
  };

  // ── Submit receta ──
  const submitReceta = async event => {
    event.preventDefault();
    if (recetaForm.productoModo === "nuevo" && !String(recetaForm.precioVenta).trim()) {
      setError("Indica el precio de venta o vincula un producto existente.");
      return;
    }
    if (recetaForm.productoModo === "vincular" && !recetaForm.productoID) {
      setError("Selecciona el producto del catálogo a vincular.");
      return;
    }
    // Al vincular un producto existente, el arreglo toma nombre/descripción
    // de ese producto — no se piden de nuevo (serían el mismo dato repetido).
    const nombre = recetaForm.productoModo === "vincular"
      ? String(recetaProductoSeleccionado?.nombreProducto || "").trim()
      : recetaForm.nombre.trim();
    const descripcion = recetaForm.productoModo === "vincular"
      ? (String(recetaProductoSeleccionado?.descripcion || "").trim() || null)
      : (recetaForm.descripcion.trim() || null);

    setSavingReceta(true);
    setError("");
    try {
      await api.crearReceta({
        empresaId,
        nombre,
        descripcion,
        productoID: recetaForm.productoModo === "vincular" ? Number(recetaForm.productoID) : null,
        precioVenta: recetaForm.productoModo === "nuevo" ? recetaForm.precioVenta : null,
        imagenUrl: recetaForm.productoModo === "nuevo" ? (recetaForm.imagenUrl.trim() || null) : null,
        capacidadManual: recetaForm.capacidadManual.trim() ? recetaForm.capacidadManual : null,
      });
      setRecetaForm(initialRecetaForm);
      setRecetaProductoSeleccionado(null);
      setCatalogoQuery("");
      setCatalogoResultados([]);
      await loadRecetas();
      setInfo("Arreglo creado.");
      setVistaActiva("lista");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible crear arreglo.");
    } finally {
      setSavingReceta(false);
    }
  };

  const submitIngrediente = async (recetaId, event) => {
    event.preventDefault();
    if (!ingredienteForm.inventarioID) { setError("Selecciona un insumo."); return; }
    setSavingIngrediente(true);
    try {
      await api.agregarIngredienteReceta({ recetaId, inventarioID: Number(ingredienteForm.inventarioID), cantidad: Number(ingredienteForm.cantidad || 1) });
      setIngredienteForm({ inventarioID: "", cantidad: "1" });
      await loadRecetaDetalle(recetaId);
      setInfo("Ingrediente agregado.");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible agregar ingrediente.");
    } finally {
      setSavingIngrediente(false);
    }
  };

  const eliminarIngrediente = async (recetaId, detalleId) => {
    try {
      await api.eliminarIngredienteReceta({ recetaId, detalleId });
      await loadRecetaDetalle(recetaId);
      setInfo("Ingrediente eliminado.");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible eliminar ingrediente.");
    }
  };

  const toggleRecetaActivo = async rec => {
    try {
      await api.actualizarReceta({
        recetaId: rec.idReceta,
        nombre: rec.nombre,
        descripcion: rec.descripcion || "",
        productoID: rec.productoID || null,
        capacidadManual: rec.capacidadManual ?? null,
        activo: !rec.activo,
      });
      await loadRecetas();
      setInfo(`${rec.nombre} ${rec.activo ? "desactivado" : "activado"}.`);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible actualizar el estado del arreglo.");
    }
  };

  // ── Helpers de label ──
  const moduloLabel = useMemo(() => moduloConfig?.label || "", [moduloConfig]);
  const subcategoriasModulo = useMemo(() => moduloConfig?.subcategorias || [], [moduloConfig]);
  const unidadesModulo = useMemo(() => moduloConfig?.unidades || [], [moduloConfig]);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="inventario"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={{ pipeline: canViewPipeline, pedidos: canViewPedidos, produccion: canViewProduccion, domicilios: canViewDomicilios, barrios: canViewBarrios, inventario: canViewInventario, contabilidad: canViewContabilidad, clientes: canViewClientesPanel, usuarios: canViewUsuariosPanel }}
        navigation={{ pipeline: onGoPipeline, pedidos: onGoPedidos, produccion: onGoProduccion, domicilios: onGoDomicilios, barrios: onGoBarrios, inventario: onGoInventario, contabilidad: onGoContabilidad, clientes: onGoClientes, usuarios: onGoUsuarios }}
      />

      <main className="orders-admin-view orders-page-view inventory-page-view">

        {/* ── HEADER (mismo sistema visual que Producción) ── */}
        <header className="orders-admin-header orders-page-header inventory-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-title-row">
              <button type="button" className="sidebar-trigger" onClick={toggleSidebar}>☰ Menú</button>
              <h1>Inventario</h1>
            </div>
            <p className="orders-admin-subtitle orders-page-description">
              Controla flores, bases, materiales, adicionales y arreglos por sucursal.
            </p>
            <span className="orders-user-pill">
              <span aria-hidden="true" />
              Usuario: {displayUserName}
            </span>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
              <label className="inventory-header-search" aria-label="Buscar en inventario">
                <Search size={17} strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={`Buscar en ${moduloLabel.toLowerCase()}...`}
                />
              </label>
              {moduloActivo !== "movimientos" && moduloActivo !== "proveedores" && vistaActiva === "lista" ? (
                <button type="button" className="btn-outline inventory-header-action" onClick={() => setVistaActiva("crear")}>
                  <PackagePlus size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Nuevo {moduloLabel === "Arreglos" ? "Arreglo" : moduloLabel === "Flores" ? "Flor" : moduloLabel === "Bases" ? "Base" : moduloLabel === "Materiales" ? "Material" : moduloLabel === "Adicionales" ? "Adicional" : ""}</span>
                </button>
              ) : null}
              {moduloActivo === "proveedores" ? (
                <button type="button" className="btn-outline inventory-header-action" onClick={openCreateProveedorModal}>
                  <PackagePlus size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Nuevo proveedor</span>
                </button>
              ) : null}
              {vistaActiva !== "lista" ? (
                <button type="button" className="btn-outline inventory-header-action" onClick={() => { setVistaActiva("lista"); setError(""); }}>
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                  <span>Cancelar</span>
                </button>
              ) : null}
              <button type="button" className="btn-primary inventory-refresh-btn" onClick={refreshAll}>
                <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
                <span>Actualizar</span>
              </button>
            </div>
          </div>
          {moduloActivo === "bases" ? (
            <div className="orders-header-metrics inventory-header-metrics" aria-label="Indicadores de bases">
              <article className="orders-header-metric-card is-primary">
                <span className="orders-header-metric-icon" aria-hidden="true"><Boxes size={18} strokeWidth={2} /></span>
                <strong>{basesMetrics.totalBases}</strong>
                <span>Total bases</span>
              </article>
              <article className="orders-header-metric-card is-orange">
                <span className="orders-header-metric-icon" aria-hidden="true"><TriangleAlert size={18} strokeWidth={2} /></span>
                <strong>{basesMetrics.stockBajo}</strong>
                <span>Stock bajo</span>
              </article>
              <article className="orders-header-metric-card is-purple">
                <span className="orders-header-metric-icon" aria-hidden="true"><CircleX size={18} strokeWidth={2} /></span>
                <strong>{basesMetrics.agotadas}</strong>
                <span>Agotadas</span>
              </article>
              <article className="orders-header-metric-card is-green">
                <span className="orders-header-metric-icon" aria-hidden="true"><ArrowDownToLine size={18} strokeWidth={2} /></span>
                <strong>{basesMetrics.comprasEsteMes}</strong>
                <span>Compras este mes</span>
              </article>
              <article className="orders-header-metric-card is-blue">
                <span className="orders-header-metric-icon" aria-hidden="true"><Truck size={18} strokeWidth={2} /></span>
                <strong>{basesMetrics.proveedoresActivos}</strong>
                <span>Proveedores activos</span>
              </article>
            </div>
          ) : (
            <div className="orders-header-metrics inventory-header-metrics" aria-label="Indicadores de inventario">
              <article className="orders-header-metric-card is-primary">
                <span className="orders-header-metric-icon" aria-hidden="true"><DollarSign size={18} strokeWidth={2} /></span>
                <strong>${formatearCOP(inventoryMetrics.valorInventario)}</strong>
                <span>Valor inventario</span>
              </article>
              <article className="orders-header-metric-card is-teal">
                <span className="orders-header-metric-icon" aria-hidden="true"><Boxes size={18} strokeWidth={2} /></span>
                <strong>{inventoryMetrics.stockTotal}</strong>
                <span>Stock total</span>
              </article>
              <article className="orders-header-metric-card is-green">
                <span className="orders-header-metric-icon" aria-hidden="true"><ArrowDownToLine size={18} strokeWidth={2} /></span>
                <strong>{inventoryMetrics.entradasHoy}</strong>
                <span>Entradas hoy</span>
              </article>
              <article className="orders-header-metric-card is-purple">
                <span className="orders-header-metric-icon" aria-hidden="true"><ArrowUpFromLine size={18} strokeWidth={2} /></span>
                <strong>{inventoryMetrics.salidasHoy}</strong>
                <span>Salidas hoy</span>
              </article>
              <article className="orders-header-metric-card is-blue">
                <span className="orders-header-metric-icon" aria-hidden="true"><TriangleAlert size={18} strokeWidth={2} /></span>
                <strong>{inventoryMetrics.bajoStock}</strong>
                <span>Bajo stock</span>
              </article>
              <article className="orders-header-metric-card is-orange">
                <span className="orders-header-metric-icon" aria-hidden="true"><CircleX size={18} strokeWidth={2} /></span>
                <strong>{inventoryMetrics.agotados}</strong>
                <span>Agotados</span>
              </article>
            </div>
          )}
        </header>

        {/* ── MENSAJES ── */}
        {error ? <p className="orders-message orders-message--error">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}
        {loading ? <p className="orders-message">Cargando...</p> : null}

        {/* ── TABS DE MÓDULO ── */}
        <div className="inventory-module-tabs" role="tablist">
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.key}
                type="button"
                role="tab"
                aria-selected={moduloActivo === mod.key}
                className={`inventory-module-tab${moduloActivo === mod.key ? " is-active" : ""}`}
                onClick={() => cambiarModulo(mod.key)}
              >
                <Icon size={15} strokeWidth={2} aria-hidden="true" />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════════════
            MÓDULO: FLORES / BASES / MATERIALES / ADICIONALES
        ════════════════════════════════════════════════════ */}
        {moduloConfig?.categoria && vistaActiva === "lista" ? (
          <>
            {/* Filtros del módulo */}
            <section className="orders-filters inventory-filters">
              {subcategoriasModulo.length > 0 ? (
                <div className="filter-field">
                  <span>{moduloActivo === "materiales" ? "Categoría" : "Subcategoría"}</span>
                  <div className="orders-filter-control inventory-filter-control">
                    <Layers size={17} strokeWidth={2} />
                    <select value={subcategoriaFiltro} onChange={e => setSubcategoriaFiltro(e.target.value)}>
                      <option value="">Todas</option>
                      {subcategoriasModulo.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </div>
                </div>
              ) : null}
              <div className="filter-field">
                <span>Estado</span>
                <div className="orders-filter-control inventory-filter-control">
                  <SlidersHorizontal size={17} strokeWidth={2} />
                  <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="Disponible">Disponible</option>
                    <option value="Bajo Stock">Bajo Stock</option>
                    <option value="Agotado">Agotado</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="filter-field">
                <span>Proveedor</span>
                <div className="orders-filter-control inventory-filter-control">
                  <Truck size={17} strokeWidth={2} />
                  <select value={proveedorFiltro} onChange={e => setProveedorFiltro(e.target.value)}>
                    <option value="">Todos</option>
                    {proveedores.map(p => <option key={p.idProveedor} value={p.idProveedor}>{p.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="filter-field">
                <span>Stock</span>
                <div className="orders-filter-control inventory-filter-control">
                  <SlidersHorizontal size={17} strokeWidth={2} />
                  <select value={stockFiltro} onChange={e => setStockFiltro(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="healthy">Saludable</option>
                    <option value="medium">Medio</option>
                    <option value="critical">Crítico</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Tabla del módulo */}
            <section className="inventory-grid-layout">
              <article className="orders-table-wrap users-table-wrap users-table-panel inventory-table-outer">
                <div className="inventory-table-scroll">
                  <table className="orders-table users-table inventory-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>{(moduloActivo === "bases" || moduloActivo === "materiales") ? "Producto" : "Nombre"}</th>
                        {moduloActivo !== "flores" ? <th>Categoría</th> : null}
                        {moduloActivo === "materiales" ? <th>Subcategoría</th> : null}
                        {(moduloActivo === "bases" || moduloActivo === "materiales") ? <th>Tamaño</th> : null}
                        {moduloActivo !== "adicionales" ? <th>Color</th> : null}
                        {moduloActivo === "adicionales" ? <th>Marca</th> : null}
                        {moduloActivo === "materiales" ? <th>Unidad</th> : null}
                        <th>Stock</th>
                        <th>Estado</th>
                        {moduloActivo !== "bases" && moduloActivo !== "materiales" ? <th>Vence</th> : <th>Último mov.</th>}
                        {moduloActivo === "adicionales" ? <><th>Costo</th><th>P. Venta</th><th>Utilidad</th></> : <th>Valor</th>}
                        <th>Proveedor</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map(item => {
                        const level = stockLevel(item);
                        const rotation = rotationLevel(item);
                        const expired = isExpired(item.fechaVencimiento);
                        const nearExpiry = isNearExpiry(item.fechaVencimiento);
                        const costo = Number(item.valorUnitario || 0);
                        const pventa = Number(item.precioVenta || 0);
                        const utilidad = pventa - costo;
                        return (
                          <tr key={item.inventarioID} className={inventoryRowClass(item)}>
                            <td data-label="Código">{item.codigo}</td>
                            <td data-label={(moduloActivo === "bases" || moduloActivo === "materiales") ? "Producto" : "Nombre"}>
                              <div className="inventory-product-cell">
                                <strong>{item.nombre}</strong>
                                {item.subcategoria ? <span className="inventory-subcategoria-badge">{item.subcategoria}</span> : null}
                              </div>
                            </td>
                            {moduloActivo !== "flores" ? (
                              <td data-label="Categoría">{item.subcategoria || item.categoria || "-"}</td>
                            ) : null}
                            {moduloActivo === "materiales" ? (
                              <td data-label="Subcategoría">{item.descripcion || "-"}</td>
                            ) : null}
                            {(moduloActivo === "bases" || moduloActivo === "materiales") ? (
                              <td data-label="Tamaño">{item.tamano || "-"}</td>
                            ) : null}
                            {moduloActivo !== "adicionales" ? (
                              <td data-label="Color">{item.color || "-"}</td>
                            ) : null}
                            {moduloActivo === "adicionales" ? (
                              <td data-label="Marca">{item.marca || "-"}</td>
                            ) : null}
                            {moduloActivo === "materiales" ? (
                              <td data-label="Unidad">{item.unidadMedida || "-"}</td>
                            ) : null}
                            <td data-label="Stock">
                              <div className={`inventory-stock-cell ${level.className}`}>
                                <span className="inventory-stock-bar"><i style={{ width: `${level.percent}%` }} /></span>
                                <strong>{Number(item.stockActual || 0)}</strong>
                                <small>{level.label}</small>
                              </div>
                            </td>
                            <td data-label="Estado">
                              <span className={`order-badge ${statusClass(item.estadoStock)}`}>{item.estadoStock}</span>
                            </td>
                            {moduloActivo !== "bases" && moduloActivo !== "materiales" ? (
                              <td data-label="Vence">
                                {item.fechaVencimiento ? (
                                  <span className={`inventory-expiry-badge ${expired ? "is-expired" : nearExpiry ? "is-near-expiry" : ""}`}>
                                    {String(item.fechaVencimiento).slice(0, 10)}
                                  </span>
                                ) : <span className="inventory-expiry-badge">-</span>}
                              </td>
                            ) : (
                              <td data-label="Último mov."><span className="inventory-last-movement">{lastMovementForItem(item)}</span></td>
                            )}
                            {moduloActivo === "adicionales" ? (
                              <>
                                <td data-label="Costo"><strong className="inventory-value-cell">${formatearCOP(costo)}</strong></td>
                                <td data-label="P. Venta"><strong className="inventory-value-cell">${formatearCOP(pventa)}</strong></td>
                                <td data-label="Utilidad">
                                  <span className={`inventory-utilidad-badge ${utilidad > 0 ? "is-positive" : "is-zero"}`}>
                                    ${formatearCOP(utilidad)}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td data-label="Valor"><strong className="inventory-value-cell">${formatearCOP(item.valorUnitario)}</strong></td>
                            )}
                            <td data-label="Proveedor">{item.proveedor || "-"}</td>
                            <td data-label="Acción">
                              <details className="inventory-row-menu" open={openInventoryMenuId === item.inventarioID}>
                                <summary
                                  aria-label="Más acciones"
                                  onClick={event => {
                                    event.preventDefault();
                                    setOpenInventoryMenuId(current => current === item.inventarioID ? null : item.inventarioID);
                                  }}
                                >
                                  <EllipsisVertical size={18} strokeWidth={2} />
                                </summary>
                                <div className="inventory-row-menu-panel">
                                  <button type="button" onClick={() => { setOpenInventoryMenuId(null); setInfo(`${item.nombre} | Código: ${item.codigo} | Cat: ${item.categoria}${item.subcategoria ? ` / ${item.subcategoria}` : ""}`); }}><Eye size={15} strokeWidth={2} /> Ver detalle</button>
                                  <button type="button" onClick={() => { setOpenInventoryMenuId(null); setInfo(`Edición próximamente: ${item.nombre}`); }}><Pencil size={15} strokeWidth={2} /> Editar</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenInventoryMenuId(null);
                                      setStockForm(f => ({ ...f, inventarioID: String(item.inventarioID) }));
                                      setVistaActiva("ajustar");
                                    }}
                                  ><RotateCcw size={15} strokeWidth={2} /> Ajustar stock</button>
                                  <button type="button" onClick={() => { setOpenInventoryMenuId(null); cambiarModulo("movimientos"); }}><Archive size={15} strokeWidth={2} /> Ver movimientos</button>
                                  <button type="button" onClick={() => { setOpenInventoryMenuId(null); toggleActivo(item); }}><CircleX size={15} strokeWidth={2} /> {item.activo ? "Desactivar" : "Activar"}</button>
                                </div>
                              </details>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleItems.length === 0 && !loading ? (
                        <tr><td colSpan="15" className="inventory-empty-note">Sin items en {moduloLabel}.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

            {/* ── EXECUTIVE PANELS (debajo de la tabla, para no tapar los filtros) ── */}
            <section className="inventory-executive-grid">
              <article className="inventory-strategy-panel">
                <div className="inventory-panel-heading">
                  <div className="inventory-panel-heading-left">
                    <Archive size={15} strokeWidth={2.5} />
                    <strong>{moduloLabel} por subcategoría</strong>
                  </div>
                  <span className="inventory-panel-count">{categorySummary.length}</span>
                </div>
                <div className="inventory-category-list">
                  {categorySummary.length === 0 ? (
                    <p className="inventory-empty-note">Sin datos para los filtros actuales.</p>
                  ) : categorySummary.map(item => (
                    <button
                      key={item.label}
                      type="button"
                      className={`inventory-category-card${subcategoriaFiltro === item.label ? " is-active" : ""}`}
                      onClick={() => setSubcategoriaFiltro(subcategoriaFiltro === item.label ? "" : item.label)}
                    >
                      <div className="inventory-category-card-info">
                        <strong>{item.label}</strong>
                        <span>{item.cantidad} und.</span>
                      </div>
                      <span className="inventory-category-card-pct">{item.percent}%</span>
                      <span className="inventory-category-card-bar"><i style={{ "--category-percent": `${Math.max(item.percent, 4)}%` }} /></span>
                    </button>
                  ))}
                </div>
              </article>
              <article className="inventory-strategy-panel inventory-alert-panel">
                <div className="inventory-panel-heading">
                  <div className="inventory-panel-heading-left">
                    <TriangleAlert size={15} strokeWidth={2.5} />
                    <strong>Alertas de reposición</strong>
                  </div>
                  <span className="inventory-panel-count">{criticalItems.length} críticos</span>
                </div>
                <div className="inventory-alert-list">
                  {criticalItems.length === 0 ? (
                    <p className="inventory-empty-note">Sin productos críticos.</p>
                  ) : criticalItems.map(item => {
                    const level = stockLevel(item);
                    return (
                      <div key={item.inventarioID} className={`inventory-alert-item ${level.className}`}>
                        <div className="inventory-alert-item-info">
                          <strong>{item.nombre}</strong>
                          <span>{Number(item.stockActual || 0)} uds · {item.proveedor || "Sin proveedor"}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-outline inventory-alert-restock-btn"
                          onClick={() => { setStockForm(f => ({ ...f, inventarioID: String(item.inventarioID), tipoMovimiento: "Entrada" })); setVistaActiva("ajustar"); }}
                        >
                          Reabastecer
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
              <article className="inventory-strategy-panel inventory-top-sellers-panel">
                <div className="inventory-panel-heading">
                  <div className="inventory-panel-heading-left">
                    <TrendingUp size={15} strokeWidth={2.5} />
                    <strong>Más vendidos</strong>
                  </div>
                  <span className="inventory-panel-count">{topSellers.length}</span>
                </div>
                <div className="inventory-category-list">
                  {topSellers.length === 0 ? (
                    <p className="inventory-empty-note">Sin salidas registradas todavía.</p>
                  ) : topSellers.map(({ item, vendidos }, index) => (
                    <div key={item.inventarioID} className="inventory-top-seller-item">
                      <span className="inventory-top-seller-rank">{index + 1}</span>
                      <div className="inventory-top-seller-info">
                        <strong>{item.nombre}</strong>
                        <span>{item.codigo}</span>
                      </div>
                      <span className="inventory-top-seller-count">{vendidos} vendidos</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            {/* ── Alertas de vencimiento ── */}
            {(moduloActivo === "flores" || moduloActivo === "adicionales") && expiryAlerts.length > 0 ? (
              <section className="inventory-expiry-alerts">
                <div className="inventory-panel-heading">
                  <div className="inventory-panel-heading-left"><TriangleAlert size={15} strokeWidth={2.5} /><strong>Alertas de vencimiento</strong></div>
                  <span className="inventory-panel-count">{expiryAlerts.length}</span>
                </div>
                <div className="inventory-alert-list">
                  {expiryAlerts.map(item => (
                    <div key={item.inventarioID} className={`inventory-alert-item ${isExpired(item.fechaVencimiento) ? "is-critical" : "is-medium"}`}>
                      <div className="inventory-alert-item-info">
                        <strong>{item.nombre}</strong>
                        <span>{isExpired(item.fechaVencimiento) ? "Vencido" : "Por vencer"} · {String(item.fechaVencimiento).slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {/* ════════ VISTA CREAR ════════ */}
        {moduloConfig?.categoria && vistaActiva === "crear" ? (
          <section className="inventory-grid-layout inventory-single-layout">
            <article className="order-block inventory-panel inventory-form-panel">
              <h4><PackagePlus size={18} strokeWidth={2} /> Nuevo {moduloLabel === "Flores" ? "Flor / Follaje" : moduloLabel}</h4>
              <form className="users-create-form" onSubmit={submitCreate}>
                <div className="inventory-two-cols">
                  <label className="inventory-field">
                    <span>Código interno</span>
                    <input type="text" placeholder="Ej: FLO-ROSA-001" value={createForm.codigo} onChange={e => setCreateForm(f => ({ ...f, codigo: e.target.value }))} required />
                  </label>
                  <label className="inventory-field">
                    <span>{(moduloActivo === "bases" || moduloActivo === "materiales") ? "Producto" : "Nombre"}</span>
                    <input type="text" placeholder={moduloActivo === "bases" ? "Ej: Florero cerámico blanco" : moduloActivo === "materiales" ? "Ej: Cinta flora" : `Nombre del ${moduloLabel.toLowerCase()}`} value={createForm.nombre} onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))} required />
                  </label>
                </div>
                {subcategoriasModulo.length > 0 ? (
                  <label className="inventory-field">
                    <span>{moduloActivo === "materiales" ? "Categoría" : "Subcategoría"}</span>
                    <select value={createForm.subcategoria} onChange={e => setCreateForm(f => ({ ...f, subcategoria: e.target.value }))}>
                      <option value="">{moduloActivo === "materiales" ? "Sin categoría" : "Sin subcategoría"}</option>
                      {subcategoriasModulo.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                    </select>
                  </label>
                ) : null}
                <div className="inventory-two-cols">
                  {moduloActivo !== "adicionales" ? (
                    <label className="inventory-field">
                      <span>Color</span>
                      <select value={createForm.color} onChange={e => setCreateForm(f => ({ ...f, color: e.target.value }))}>
                        <option value="">Sin color</option>
                        {COLOR_OPTIONS.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="inventory-field">
                      <span>Marca</span>
                      <input type="text" placeholder="Ej: Ferrero, Jumbo" value={createForm.marca} onChange={e => setCreateForm(f => ({ ...f, marca: e.target.value }))} />
                    </label>
                  )}
                  {unidadesModulo.length > 1 ? (
                    <label className="inventory-field">
                      <span>Unidad</span>
                      <select value={createForm.unidadMedida} onChange={e => setCreateForm(f => ({ ...f, unidadMedida: e.target.value }))}>
                        {unidadesModulo.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </label>
                  ) : null}
                </div>
                {(moduloActivo === "bases" || moduloActivo === "materiales") ? (
                  <label className="inventory-field">
                    <span>Tamaño</span>
                    <input type="text" placeholder="Ej: Grande, 5cm, XL" value={createForm.tamano} onChange={e => setCreateForm(f => ({ ...f, tamano: e.target.value }))} />
                  </label>
                ) : null}
                {(moduloActivo === "flores" || moduloActivo === "adicionales") ? (
                  <label className="inventory-field">
                    <span>Fecha de vencimiento</span>
                    <input type="date" value={createForm.fechaVencimiento} onChange={e => setCreateForm(f => ({ ...f, fechaVencimiento: e.target.value }))} />
                  </label>
                ) : null}
                <label className="inventory-field">
                  <span>{moduloActivo === "materiales" ? "Subcategoría" : "Descripción"}</span>
                  <input
                    type="text"
                    placeholder={moduloActivo === "materiales" ? "Ej: Satinada, Ladrillo, Transparente" : "Descripción opcional"}
                    value={createForm.descripcion}
                    onChange={e => setCreateForm(f => ({ ...f, descripcion: e.target.value }))}
                  />
                </label>
                <label className="inventory-field">
                  <span>Proveedor</span>
                  <select value={createForm.proveedorID} onChange={e => setCreateForm(f => ({ ...f, proveedorID: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.idProveedor} value={p.idProveedor}>{p.nombre}{p.codigoProveedor ? ` (${p.codigoProveedor})` : ""}</option>)}
                  </select>
                </label>
                <div className="inventory-two-cols">
                  <label className="inventory-field">
                    <span>{(moduloActivo === "bases" || moduloActivo === "materiales") ? "Cantidad" : "Stock inicial"}</span>
                    <input type="number" min="0" step="0.01" value={createForm.stockActual} onChange={e => setCreateForm(f => ({ ...f, stockActual: e.target.value }))} required />
                  </label>
                  <label className="inventory-field">
                    <span>Stock mínimo</span>
                    <input type="number" min="0" step="0.01" value={createForm.stockMinimo} onChange={e => setCreateForm(f => ({ ...f, stockMinimo: e.target.value }))} required />
                  </label>
                </div>
                <div className="inventory-two-cols">
                  <label className="inventory-field">
                    <span>Costo unitario</span>
                    <input type="number" min="0" step="0.01" value={createForm.valorUnitario} onChange={e => setCreateForm(f => ({ ...f, valorUnitario: e.target.value }))} required />
                  </label>
                  {moduloActivo === "adicionales" ? (
                    <label className="inventory-field">
                      <span>Precio de venta</span>
                      <input type="number" min="0" step="0.01" value={createForm.precioVenta} onChange={e => setCreateForm(f => ({ ...f, precioVenta: e.target.value }))} />
                    </label>
                  ) : null}
                </div>
                <div className="order-actions">
                  <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Guardando..." : `Crear ${moduloLabel}`}</button>
                  <button type="button" className="btn-outline" onClick={() => setVistaActiva("lista")} disabled={creating}>Cancelar</button>
                </div>
              </form>
            </article>
          </section>
        ) : null}

        {/* ════════ VISTA AJUSTAR STOCK / REGISTRAR MOVIMIENTO ════════ */}
        {(moduloConfig?.categoria || moduloActivo === "movimientos") && vistaActiva === "ajustar" ? (
          <section className="inventory-grid-layout inventory-single-layout">
            <article className="order-block inventory-panel inventory-form-panel">
              <h4>{moduloActivo === "movimientos" ? "Registrar movimiento" : `Ajustar stock — ${moduloLabel}`}</h4>
              <form className="users-create-form" onSubmit={submitStock}>
                <label className="inventory-field">
                  <span>Insumo</span>
                  <select value={stockForm.inventarioID} onChange={e => setStockForm(f => ({ ...f, inventarioID: e.target.value }))} required>
                    <option value="">Selecciona item</option>
                    {moduloActivo === "movimientos" ? (
                      MODULES.filter(mod => mod.categoria).map(mod => (
                        <optgroup key={mod.key} label={mod.label}>
                          {allItems
                            .filter(item => String(item.categoria || "").toLowerCase() === mod.categoria.toLowerCase())
                            .map(item => <option key={item.inventarioID} value={item.inventarioID}>{item.codigo} — {item.nombre}</option>)}
                        </optgroup>
                      ))
                    ) : (
                      items.map(item => <option key={item.inventarioID} value={item.inventarioID}>{item.codigo} — {item.nombre}</option>)
                    )}
                  </select>
                </label>
                <label className="inventory-field">
                  <span>Tipo de movimiento</span>
                  <select value={stockForm.tipoMovimiento} onChange={e => setStockForm(f => ({ ...f, tipoMovimiento: e.target.value }))}>
                    {MOVIMIENTO_TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                {stockForm.tipoMovimiento === "Ajuste" ? (
                  <label className="inventory-field">
                    <span>Stock objetivo</span>
                    <input type="number" min="0" step="0.01" value={stockForm.stockObjetivo} onChange={e => setStockForm(f => ({ ...f, stockObjetivo: e.target.value }))} required />
                  </label>
                ) : (
                  <label className="inventory-field">
                    <span>Cantidad</span>
                    <input type="number" min="0.01" step="0.01" value={stockForm.cantidad} onChange={e => setStockForm(f => ({ ...f, cantidad: e.target.value }))} required />
                  </label>
                )}
                <label className="inventory-field">
                  <span>Motivo</span>
                  <textarea className="inventory-textarea" placeholder="Motivo del movimiento" value={stockForm.motivo} onChange={e => setStockForm(f => ({ ...f, motivo: e.target.value }))} required />
                </label>
                <div className="order-actions">
                  <button type="submit" className="btn-primary" disabled={savingStock}>{savingStock ? "Aplicando..." : "Guardar movimiento"}</button>
                  <button type="button" className="btn-outline" onClick={() => setVistaActiva("lista")}>Cancelar</button>
                </div>
              </form>
            </article>
          </section>
        ) : null}

        {/* ════════════════════════════
            MÓDULO: ARREGLOS / RECETAS
        ════════════════════════════ */}
        {moduloActivo === "arreglos" && vistaActiva === "lista" ? (
          <section className="inventory-grid-layout inventory-arreglos-layout">
            <article className="orders-table-wrap users-table-wrap users-table-panel inventory-arreglos-panel">
              <div className="inventory-section-title">
                <h4>Arreglos registrados</h4>
                <p>{recetas.length} arreglos en el catálogo</p>
              </div>
              <div className="inventory-recetas-list">
                {recetas.length === 0 ? (
                  <p className="inventory-empty-note">Sin arreglos. Crea el primero.</p>
                ) : recetas.map(rec => (
                  <div key={rec.idReceta} className={`inventory-receta-card${rec.activo ? "" : " is-inactive"}`}>
                    <div className="inventory-receta-header">
                      {rec.imagenUrl ? (
                        <img className="inventory-receta-thumb" src={rec.imagenUrl} alt={rec.nombre} />
                      ) : null}
                      <div>
                        <strong>{rec.nombre}</strong>
                        {rec.descripcion ? <p>{rec.descripcion}</p> : null}
                        {rec.precioVenta != null ? (
                          <span className="inventory-receta-precio">${formatearCOP(Number(rec.precioVenta))}</span>
                        ) : null}
                      </div>
                      <div className="inventory-receta-meta">
                        <span className={`order-badge ${rec.activo ? "is-entregado" : "is-cancelado"}`}>{rec.activo ? "Activo" : "Inactivo"}</span>
                        <span className="inventory-receta-badge">{rec.totalIngredientes} ing.</span>
                        <button type="button" className="btn-outline inventory-receta-toggle" onClick={() => toggleRecetaActivo(rec)}>
                          {rec.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className="btn-outline inventory-receta-toggle"
                          onClick={() => recetaDetalle?.idReceta === rec.idReceta ? setRecetaDetalle(null) : loadRecetaDetalle(rec.idReceta)}
                        >
                          {recetaDetalle?.idReceta === rec.idReceta ? "Cerrar" : "Ver"}
                        </button>
                      </div>
                    </div>
                    {recetaDetalle?.idReceta === rec.idReceta ? (
                      <div className="inventory-receta-detail">
                        <table className="orders-table users-table inventory-table inventory-receta-table">
                          <thead>
                            <tr><th>Insumo</th><th>Categoría</th><th>Cant.</th><th></th></tr>
                          </thead>
                          <tbody>
                            {recetaDetalle.detalles.map(det => (
                              <tr key={det.idRecetaDetalle}>
                                <td data-label="Insumo"><div className="inventory-product-cell"><strong>{det.nombre}</strong><span>{det.codigo}</span></div></td>
                                <td data-label="Categoría">{det.categoria || "-"}</td>
                                <td data-label="Cant.">{Number(det.cantidad)}</td>
                                <td data-label="Acción"><button type="button" className="btn-outline inventory-ingredient-remove" onClick={() => eliminarIngrediente(rec.idReceta, det.idRecetaDetalle)}><CircleX size={13} strokeWidth={2} /></button></td>
                              </tr>
                            ))}
                            {recetaDetalle.detalles.length === 0 ? <tr><td colSpan="4" className="inventory-empty-note">Sin ingredientes aún.</td></tr> : null}
                          </tbody>
                        </table>
                        <form className="inventory-add-ingredient-form" onSubmit={e => submitIngrediente(rec.idReceta, e)}>
                          <select value={ingredienteForm.inventarioID} onChange={e => setIngredienteForm(f => ({ ...f, inventarioID: e.target.value }))} required>
                            <option value="">Selecciona insumo…</option>
                            {["flores", "bases", "materiales", "adicionales"].map(cat => {
                              const catLabel = MODULES.find(m => m.key === cat)?.label;
                              return (
                                <optgroup key={cat} label={catLabel}>
                                  {allItems.filter(i => i.categoria?.toLowerCase() === cat).map(i => (
                                    <option key={i.inventarioID} value={i.inventarioID}>{i.codigo} — {i.nombre}</option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                          <input type="number" min="0.01" step="0.01" placeholder="Cant." value={ingredienteForm.cantidad} onChange={e => setIngredienteForm(f => ({ ...f, cantidad: e.target.value }))} required />
                          <button type="submit" className="btn-primary" disabled={savingIngrediente}>{savingIngrediente ? "..." : "+ Agregar"}</button>
                        </form>

                        {recetaResumen && recetaDetalle.detalles.length > 0 ? (
                          <div className="inventory-receta-summary">
                            {recetaResumen.precioVenta != null ? (
                              <div className="inventory-receta-summary-item">
                                <span className="inventory-receta-summary-icon"><Tag size={16} strokeWidth={2} /></span>
                                <div>
                                  <strong>${formatearCOP(recetaResumen.precioVenta)}</strong>
                                  <span>Precio de venta</span>
                                </div>
                              </div>
                            ) : null}
                            <div className="inventory-receta-summary-item">
                              <span className="inventory-receta-summary-icon"><DollarSign size={16} strokeWidth={2} /></span>
                              <div>
                                <strong>${formatearCOP(recetaResumen.costoTotal)}</strong>
                                <span>Costo de producción</span>
                              </div>
                            </div>
                            {recetaResumen.utilidad != null ? (
                              <div className="inventory-receta-summary-item">
                                <span className="inventory-receta-summary-icon"><TrendingUp size={16} strokeWidth={2} /></span>
                                <div>
                                  <strong>${formatearCOP(recetaResumen.utilidad)}</strong>
                                  <span>Utilidad</span>
                                </div>
                              </div>
                            ) : null}
                            <div className="inventory-receta-summary-item">
                              <span className="inventory-receta-summary-icon"><Gauge size={16} strokeWidth={2} /></span>
                              <div>
                                <strong>{recetaResumen.capacidad}{recetaResumen.capacidadEsManual ? " *" : ""}</strong>
                                <span>Capacidad de fabricación{recetaResumen.capacidadEsManual ? " (manual)" : ""}</span>
                              </div>
                            </div>
                            <div className="inventory-receta-summary-item">
                              <span className="inventory-receta-summary-icon"><TriangleAlert size={16} strokeWidth={2} /></span>
                              <div>
                                <strong>{recetaResumen.limitante?.nombre || "-"}</strong>
                                <span>Componente limitante</span>
                              </div>
                            </div>
                            <div className="inventory-receta-summary-item">
                              <span className="inventory-receta-summary-icon"><CheckCircle2 size={16} strokeWidth={2} /></span>
                              <div>
                                <strong>{recetaResumen.disponibles}</strong>
                                <span>Disponibles</span>
                              </div>
                            </div>
                            <div className="inventory-receta-summary-item">
                              <span className="inventory-receta-summary-icon"><ClipboardList size={16} strokeWidth={2} /></span>
                              <div>
                                <strong>{recetaResumen.reservados}</strong>
                                <span>Reservados</span>
                              </div>
                            </div>
                            <div className="inventory-receta-summary-item">
                              <span className="inventory-receta-summary-icon"><ShoppingCart size={16} strokeWidth={2} /></span>
                              <div>
                                <strong>{recetaResumen.vendidosHoy}</strong>
                                <span>Vendidos hoy</span>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {recetaResumen && recetaDetalle.detalles.length > 0 ? (
                          <div className="inventory-simulator">
                            <div className="inventory-simulator-heading">
                              <Calculator size={15} strokeWidth={2.5} />
                              <strong>Simulador de pedido</strong>
                            </div>
                            <p className="inventory-form-help">Verifica si hay inventario suficiente antes de confirmar la venta de varias unidades de este arreglo.</p>
                            <div className="inventory-simulator-form">
                              <label className="inventory-field">
                                <span>Cantidad a fabricar</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={simuladorCantidad}
                                  onChange={e => setSimuladorCantidad(e.target.value)}
                                />
                              </label>
                            </div>
                            {simulacionPedido ? (
                              <div className={`inventory-simulator-result ${simulacionPedido.permitido ? "is-ok" : "is-blocked"}`}>
                                <div className="inventory-simulator-verdict">
                                  {simulacionPedido.permitido ? <CheckCircle2 size={16} strokeWidth={2} /> : <CircleX size={16} strokeWidth={2} />}
                                  <strong>{simulacionPedido.permitido ? "Pedido permitido" : "Inventario insuficiente"}</strong>
                                </div>
                                <table className="orders-table users-table inventory-table inventory-simulator-table">
                                  <thead>
                                    <tr><th>Insumo</th><th>Necesario</th><th>Disponible</th><th>Faltante</th></tr>
                                  </thead>
                                  <tbody>
                                    {simulacionPedido.detalle.map(d => (
                                      <tr key={d.codigo} className={d.ok ? "" : "inventory-simulator-row-short"}>
                                        <td data-label="Insumo"><div className="inventory-product-cell"><strong>{d.nombre}</strong><span>{d.codigo}</span></div></td>
                                        <td data-label="Necesario">{d.necesario}</td>
                                        <td data-label="Disponible">{d.disponible}</td>
                                        <td data-label="Faltante">{d.faltante > 0 ? `-${d.faltante}` : "-"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {/* ════════ CREAR ARREGLO ════════ */}
        {moduloActivo === "arreglos" && vistaActiva === "crear" ? (
          <section className="inventory-grid-layout inventory-single-layout">
            <article className="order-block inventory-panel inventory-form-panel">
              <h4><UtensilsCrossed size={18} strokeWidth={2} /> Nuevo Arreglo</h4>
              <p className="inventory-form-help">
                {recetaForm.productoModo === "vincular"
                  ? "Busca el producto del catálogo que representa este arreglo — el arreglo toma su nombre, descripción, precio e imagen directamente de ahí. Luego agrega los ingredientes (la receta) desde la lista."
                  : "Define el producto floral: nombre, descripción, precio e imagen. Luego agrega los ingredientes (la receta) desde la lista."}
              </p>
              <form className="users-create-form" onSubmit={submitReceta}>
                <div className="inventory-producto-modo-toggle">
                  <button
                    type="button"
                    className={`btn-outline${recetaForm.productoModo === "nuevo" ? " is-active" : ""}`}
                    onClick={() => { setRecetaForm(f => ({ ...f, productoModo: "nuevo", productoID: "" })); setRecetaProductoSeleccionado(null); setCatalogoQuery(""); setCatalogoResultados([]); }}
                  >
                    Crear producto nuevo
                  </button>
                  <button
                    type="button"
                    className={`btn-outline${recetaForm.productoModo === "vincular" ? " is-active" : ""}`}
                    onClick={() => { setRecetaForm(f => ({ ...f, productoModo: "vincular" })); setCatalogoBuscando(true); }}
                  >
                    Vincular producto existente
                  </button>
                </div>

                {recetaForm.productoModo === "nuevo" ? (
                  <>
                    <label className="inventory-field">
                      <span>Nombre del arreglo</span>
                      <input type="text" placeholder="Ej: Box Romántico 24 Rosas" value={recetaForm.nombre} onChange={e => setRecetaForm(f => ({ ...f, nombre: e.target.value }))} required />
                    </label>
                    <label className="inventory-field">
                      <span>Descripción</span>
                      <input type="text" placeholder="Descripción opcional" value={recetaForm.descripcion} onChange={e => setRecetaForm(f => ({ ...f, descripcion: e.target.value }))} />
                    </label>
                    <div className="inventory-two-cols">
                      <label className="inventory-field">
                        <span>Precio de venta</span>
                        <input type="number" min="0" step="0.01" placeholder="Ej: 85000" value={recetaForm.precioVenta} onChange={e => setRecetaForm(f => ({ ...f, precioVenta: e.target.value }))} required />
                      </label>
                      <label className="inventory-field">
                        <span>Imagen (URL)</span>
                        <input type="text" placeholder="https://…" value={recetaForm.imagenUrl} onChange={e => setRecetaForm(f => ({ ...f, imagenUrl: e.target.value }))} />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="inventory-field inventory-producto-picker">
                    <span>Buscar producto del catálogo</span>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código…"
                      value={catalogoQuery}
                      onChange={e => { setCatalogoQuery(e.target.value); setRecetaProductoSeleccionado(null); setRecetaForm(f => ({ ...f, productoID: "" })); }}
                    />
                    {catalogoBuscando ? <p className="inventory-form-help">Buscando…</p> : null}
                    {recetaProductoSeleccionado ? (
                      <div className="inventory-producto-picker-selected">
                        {recetaProductoSeleccionado.imagenUrl ? <img src={recetaProductoSeleccionado.imagenUrl} alt="" /> : null}
                        <div>
                          <strong>{recetaProductoSeleccionado.nombreProducto}</strong>
                          <span>${formatearCOP(recetaProductoSeleccionado.precio)} · {recetaProductoSeleccionado.codigoProducto}</span>
                          {recetaProductoSeleccionado.descripcion ? <small>{recetaProductoSeleccionado.descripcion}</small> : null}
                        </div>
                        <button
                          type="button"
                          className="btn-outline inventory-producto-picker-clear"
                          onClick={() => { setRecetaProductoSeleccionado(null); setRecetaForm(f => ({ ...f, productoID: "" })); setCatalogoQuery(""); }}
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : catalogoResultados.length > 0 ? (
                      <div className="inventory-producto-picker-results">
                        {catalogoResultados.map(p => (
                          <button
                            key={p.idProducto}
                            type="button"
                            onClick={() => {
                              setRecetaProductoSeleccionado(p);
                              setRecetaForm(f => ({ ...f, productoID: String(p.idProducto) }));
                              setCatalogoResultados([]);
                            }}
                          >
                            {p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : <span className="inventory-producto-picker-noimg"><Tag size={14} strokeWidth={2} /></span>}
                            <div>
                              <strong>{p.nombreProducto}</strong>
                              <span>${formatearCOP(p.precio)} · {p.codigoProducto}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : !catalogoBuscando ? (
                      <p className="inventory-form-help">
                        {catalogoQuery.trim() ? "Sin productos que coincidan con la búsqueda." : "No hay productos en el catálogo para esta sucursal."}
                      </p>
                    ) : null}
                  </div>
                )}

                <label className="inventory-field">
                  <span>Capacidad de fabricación manual (opcional)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Déjalo vacío para calcularla automáticamente según el inventario"
                    value={recetaForm.capacidadManual}
                    onChange={e => setRecetaForm(f => ({ ...f, capacidadManual: e.target.value }))}
                  />
                </label>

                <div className="order-actions">
                  <button type="submit" className="btn-primary" disabled={savingReceta}>{savingReceta ? "Guardando..." : "Crear Arreglo"}</button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => { setVistaActiva("lista"); setRecetaForm(initialRecetaForm); setRecetaProductoSeleccionado(null); setCatalogoQuery(""); setCatalogoResultados([]); }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </article>
          </section>
        ) : null}

        {/* ════════════════════════════
            MÓDULO: MOVIMIENTOS
        ════════════════════════════ */}
        {moduloActivo === "movimientos" && vistaActiva === "lista" ? (
          <section className="inventory-grid-layout">
            <article className="orders-table-wrap users-table-wrap users-table-panel inventory-movements-drawer">
              <div className="inventory-movements-head">
                <div>
                  <strong>Movimientos de inventario</strong>
                  <span>{movimientosFiltrados.length} registros</span>
                </div>
                <div className="inventory-movements-actions">
                  <button
                    type="button"
                    className="btn-outline inventory-movement-quick-btn is-entrada"
                    onClick={() => { setStockForm(f => ({ ...f, inventarioID: "", tipoMovimiento: "Entrada", cantidad: "1", stockObjetivo: "", motivo: "" })); setVistaActiva("ajustar"); }}
                  >
                    <ArrowDownToLine size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar entrada</span>
                  </button>
                  <button
                    type="button"
                    className="btn-outline inventory-movement-quick-btn is-salida"
                    onClick={() => { setStockForm(f => ({ ...f, inventarioID: "", tipoMovimiento: "Salida", cantidad: "1", stockObjetivo: "", motivo: "" })); setVistaActiva("ajustar"); }}
                  >
                    <ArrowUpFromLine size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar salida</span>
                  </button>
                  <button
                    type="button"
                    className="btn-outline inventory-movement-quick-btn is-ajuste"
                    onClick={() => { setStockForm(f => ({ ...f, inventarioID: "", tipoMovimiento: "Ajuste", cantidad: "1", stockObjetivo: "", motivo: "" })); setVistaActiva("ajustar"); }}
                  >
                    <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar ajuste</span>
                  </button>
                </div>
                <div className="inventory-movements-filters">
                  <select value={tipoMovimientoFiltro} onChange={e => setTipoMovimientoFiltro(e.target.value)} className="inventory-movement-type-select">
                    <option value="">Todos los tipos</option>
                    {MOVIMIENTO_TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <table className="orders-table users-table inventory-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map(item => (
                    <tr key={item.movimientoID}>
                      <td data-label="Fecha">{String(item.fecha || "").replace("T", " ").slice(0, 16)}</td>
                      <td data-label="Producto">
                        <div className="inventory-product-cell">
                          <strong>{item.nombre}</strong>
                          <span>{item.codigo}</span>
                        </div>
                      </td>
                      <td data-label="Tipo">
                        <span className={`order-badge ${item.tipoMovimiento === "Entrada" ? "is-entregado" : item.tipoMovimiento === "Salida" ? "is-pendiente" : item.tipoMovimiento === "Pérdida" ? "is-rechazado" : "is-cancelado"}`}>
                          {item.tipoMovimiento}
                        </span>
                      </td>
                      <td data-label="Cantidad">{Number(item.cantidad || 0)}</td>
                      <td data-label="Motivo">{item.motivo || "-"}</td>
                      <td data-label="Usuario">{item.usuarioID || "-"}</td>
                    </tr>
                  ))}
                  {movimientosFiltrados.length === 0 ? (
                    <tr><td colSpan="6" className="inventory-empty-note">Sin movimientos.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </article>
          </section>
        ) : null}

        {/* ════════════════════════════════════════════════════
            MÓDULO: PROVEEDORES
        ════════════════════════════════════════════════════ */}
        {moduloActivo === "proveedores" ? (
          <section className="inventory-grid-layout inventory-single-layout inventory-provider-layout">
            <article className="orders-table-wrap users-table-wrap users-table-panel inventory-provider-table-panel">
              <div className="inventory-section-title">
                <h4>Proveedores registrados</h4>
                <p>Nombre, código, contacto y estado usados por el selector de <strong>Proveedor</strong> en inventario.</p>
              </div>
              <div className="inventory-table-scroll">
                <table className="orders-table users-table inventory-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Teléfono</th>
                      <th>Email</th>
                      <th>Dirección</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedores.map(item => (
                      <tr key={item.idProveedor}>
                        <td data-label="ID">{item.idProveedor}</td>
                        <td data-label="Nombre">{item.nombre}</td>
                        <td data-label="Código">{item.codigoProveedor || "-"}</td>
                        <td data-label="Teléfono">{item.telefono || "-"}</td>
                        <td data-label="Email">{item.email || "-"}</td>
                        <td data-label="Dirección">{item.direccion || "-"}</td>
                        <td data-label="Estado">
                          <span className={`order-badge ${item.activo ? "is-entregado" : "is-cancelado"}`}>
                            {item.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td data-label="Acciones">
                          <button type="button" className="btn-outline inventory-table-action" onClick={() => openEditProveedorModal(item)}>
                            <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                            <span>Editar</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {proveedores.length === 0 ? (
                      <tr><td colSpan="8" className="inventory-empty-note">Sin proveedores registrados.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : null}

        {showProveedorModal ? (
          <div
            className="inventory-provider-modal-overlay"
            role="presentation"
            onClick={closeProveedorModal}
          >
            <section
              className="inventory-provider-modal"
              role="dialog"
              aria-modal="true"
              aria-label={editingProveedorId ? "Editar proveedor" : "Crear proveedor"}
              onClick={event => event.stopPropagation()}
            >
              <div className="inventory-provider-modal-head">
                <h4>{editingProveedorId ? "Editar proveedor" : "Crear proveedor"}</h4>
                <button
                  type="button"
                  className="btn-outline inventory-provider-modal-close"
                  onClick={closeProveedorModal}
                  aria-label="Cerrar"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              <form className="users-create-form inventory-provider-form" onSubmit={submitProveedor}>
                <label className="inventory-field">
                  <span>Nombre proveedor</span>
                  <input
                    type="text"
                    placeholder="Ej: Flores de la Sabana"
                    value={proveedorForm.nombre}
                    onChange={event => setProveedorForm(current => ({ ...current, nombre: event.target.value }))}
                    required
                  />
                </label>
                <label className="inventory-field">
                  <span>Código proveedor</span>
                  <small className="inventory-field-hint">Opcional. Consecutivo interno para identificar al proveedor.</small>
                  <input
                    type="text"
                    placeholder="Ej: PROV-FLO-003"
                    value={proveedorForm.codigoProveedor}
                    onChange={event => setProveedorForm(current => ({ ...current, codigoProveedor: event.target.value }))}
                  />
                </label>
                <label className="inventory-field">
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    placeholder="Ej: 3001234567"
                    value={proveedorForm.telefono}
                    onChange={event => setProveedorForm(current => ({ ...current, telefono: event.target.value }))}
                  />
                </label>
                <label className="inventory-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="Ej: contacto@proveedor.com"
                    value={proveedorForm.email}
                    onChange={event => setProveedorForm(current => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label className="inventory-field">
                  <span>Dirección</span>
                  <input
                    type="text"
                    placeholder="Ej: Cra 10 # 20-30, Bogotá"
                    value={proveedorForm.direccion}
                    onChange={event => setProveedorForm(current => ({ ...current, direccion: event.target.value }))}
                  />
                </label>
                <label className="inventory-field inventory-checkbox-field">
                  <input
                    type="checkbox"
                    checked={proveedorForm.activo}
                    onChange={event => setProveedorForm(current => ({ ...current, activo: event.target.checked }))}
                  />
                  <span>Dejar proveedor activo</span>
                </label>
                <div className="order-actions inventory-provider-actions">
                  <button type="submit" className="btn-primary" disabled={savingProveedor}>
                    {savingProveedor ? "Guardando..." : editingProveedorId ? "Guardar cambios" : "Crear proveedor"}
                  </button>
                  <button type="button" className="btn-outline" disabled={savingProveedor} onClick={closeProveedorModal}>
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

      </main>
    </div>
  );
}
