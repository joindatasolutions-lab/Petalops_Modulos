import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { formatearCOP } from "../../shared/utils.js";
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
import { COLOR_OPTIONS, MODULES, MOTIVOS_AJUSTE, MOTIVOS_DANO_BY_MODULE, MOTIVOS_SALIDA, MOVIMIENTO_TIPO_OPTIONS, initialProveedorForm } from "./inventoryConfig.jsx";
import { buildBasesMetrics, buildCategorySummary, buildCreateItemPayload, buildCriticalItems, buildExpiryAlerts, buildInventoryMetrics, buildLastMovementByItem, buildProveedorForm, buildProveedorPayload, buildRecetaResumen, buildSimulacionPedido, buildTopSellers, filterInventoryItems, inventoryRowClass, isExpired, isNearExpiry, lastMovementLabelForItem, rotationLevel, statusClass, stockLevel } from "./inventoryDomain.js";
export { filterInventoryItems } from "./inventoryDomain.js";

// ─── Configuración de módulos ────────────────────────────────────────────────

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
  const [moduloMovimientoFiltro, setModuloMovimientoFiltro] = useState("");
  const [fechaMovimientoDesde, setFechaMovimientoDesde] = useState("");
  const [fechaMovimientoHasta, setFechaMovimientoHasta] = useState("");
  const [estadoMovimientoFiltro, setEstadoMovimientoFiltro] = useState("Registrado");
  const [serverMetrics, setServerMetrics] = useState(null);
  const [movementMetrics, setMovementMetrics] = useState(null);

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
  const initialStockForm = useMemo(() => ({
    inventarioID: "",
    tipoMovimiento: "Compra",
    cantidad: "1",
    stockObjetivo: "",
    motivo: "",
    fecha: "",
    proveedorID: "",
    numeroFactura: "",
    responsable: displayUserName,
    unidad: moduloConfig?.unidades?.[0] || "Unidad",
    precioUnitario: "",
    fechaVencimiento: "",
    evidenciaUrl: "",
    pedidoReferencia: "",
    observaciones: "",
  }), [displayUserName, moduloConfig]);
  const [stockForm, setStockForm] = useState(initialStockForm);
  const stockItemsForSelector = moduloActivo === "movimientos" ? allItems : items;
  const selectedStockItem = useMemo(() => stockItemsForSelector.find(item => String(item.inventarioID) === String(stockForm.inventarioID)) || null, [stockItemsForSelector, stockForm.inventarioID]);
  const selectedStockModuleKey = useMemo(() => {
    const categoria = String(selectedStockItem?.categoria || moduloConfig?.categoria || "").toLowerCase();
    return MODULES.find(mod => mod.categoria && mod.categoria.toLowerCase() === categoria)?.key || moduloActivo;
  }, [moduloActivo, moduloConfig, selectedStockItem]);
  const currentMovementMotivos = useMemo(() => {
    if (stockForm.tipoMovimiento === "Daño" || stockForm.tipoMovimiento === "Pérdida") return MOTIVOS_DANO_BY_MODULE[selectedStockModuleKey] || MOTIVOS_DANO_BY_MODULE.flores;
    if (stockForm.tipoMovimiento === "Salida") return MOTIVOS_SALIDA;
    if (stockForm.tipoMovimiento === "Ajuste") return MOTIVOS_AJUSTE;
    return [];
  }, [selectedStockModuleKey, stockForm.tipoMovimiento]);
  const startStockMovement = useCallback((item = null, tipoMovimiento = "Compra") => {
    setOpenInventoryMenuId(null);
    setStockForm({
      ...initialStockForm,
      inventarioID: item?.inventarioID ? String(item.inventarioID) : "",
      tipoMovimiento,
      cantidad: "1",
      unidad: item?.unidadMedida || initialStockForm.unidad,
      proveedorID: item?.proveedorID ? String(item.proveedorID) : "",
      precioUnitario: item?.valorUnitario != null ? String(item.valorUnitario) : "",
    });
    setVistaActiva("ajustar");
  }, [initialStockForm]);
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

  const localInventoryMetrics = useMemo(() => buildInventoryMetrics(items, movimientos), [items, movimientos]);

  const inventoryMetrics = useMemo(() => ({
    stockTotal: serverMetrics?.totalReferencias ?? localInventoryMetrics.stockTotal,
    valorInventario: serverMetrics?.valorInventario ?? localInventoryMetrics.valorInventario,
    entradasHoy: movementMetrics?.entradas ?? localInventoryMetrics.entradasHoy,
    salidasHoy: movementMetrics?.salidas ?? localInventoryMetrics.salidasHoy,
    bajoStock: serverMetrics?.stockBajo ?? localInventoryMetrics.bajoStock,
    agotados: serverMetrics?.agotados ?? localInventoryMetrics.agotados,
    porVencer: serverMetrics?.porVencer ?? 0,
  }), [localInventoryMetrics, movementMetrics, serverMetrics]);

  const basesMetrics = useMemo(() => buildBasesMetrics(items, movimientos, proveedores), [items, movimientos, proveedores]);

  const visibleItems = useMemo(() => filterInventoryItems(items, { stockFiltro, subcategoriaFiltro }), [items, stockFiltro, subcategoriaFiltro]);

  const categorySummary = useMemo(() => buildCategorySummary(items), [items]);

  const criticalItems = useMemo(() => buildCriticalItems(items), [items]);

  const expiryAlerts = useMemo(() => buildExpiryAlerts(items), [items]);

  const topSellers = useMemo(() => buildTopSellers(items, movimientos), [items, movimientos]);

  const lastMovementByItem = useMemo(() => buildLastMovementByItem(movimientos), [movimientos]);

  const lastMovementForItem = useCallback(item => lastMovementLabelForItem(item, lastMovementByItem), [lastMovementByItem]);

  const movimientosFiltrados = useMemo(() => movimientos, [movimientos]);

  // ── Arreglos: costo de producción, capacidad de fabricación y componente
  // limitante, calculados en el navegador cruzando la receta con el stock
  // actual (allItems). Precio de venta / vendidos hoy / reservados vienen del
  // backend (via el producto del catálogo vinculado a la receta). ──
  const recetaResumen = useMemo(() => buildRecetaResumen(recetaDetalle, allItems), [recetaDetalle, allItems]);

  const simulacionPedido = useMemo(() => buildSimulacionPedido(recetaResumen, simuladorCantidad), [recetaResumen, simuladorCantidad]);

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

  const loadInventarioMetricas = useCallback(async () => {
    const cat = MODULES.find(m => m.key === moduloActivo)?.categoria;
    if (!cat) { setServerMetrics(null); return; }
    try {
      const data = await api.obtenerMetricasInventario({ empresaId, categoria: cat, diasVencimiento: 7 });
      setServerMetrics(data || null);
    } catch { setServerMetrics(null); }
  }, [api, empresaId, moduloActivo]);

  const loadMovimientosMetricas = useCallback(async () => {
    try {
      const data = await api.obtenerMetricasMovimientosInventario({
        empresaId,
        modulo: moduloMovimientoFiltro || null,
        fechaDesde: fechaMovimientoDesde || null,
        fechaHasta: fechaMovimientoHasta || null,
      });
      setMovementMetrics(data || null);
    } catch { setMovementMetrics(null); }
  }, [api, empresaId, fechaMovimientoDesde, fechaMovimientoHasta, moduloMovimientoFiltro]);

  const loadMovimientos = useCallback(async () => {
    try {
      const data = await api.listarMovimientosInventario({
        empresaId,
        tipo: tipoMovimientoFiltro || null,
        modulo: moduloActivo === "movimientos" ? (moduloMovimientoFiltro || null) : null,
        fechaDesde: moduloActivo === "movimientos" ? (fechaMovimientoDesde || null) : null,
        fechaHasta: moduloActivo === "movimientos" ? (fechaMovimientoHasta || null) : null,
        estado: moduloActivo === "movimientos" ? (estadoMovimientoFiltro || null) : null,
        q: moduloActivo === "movimientos" ? (q || null) : null,
      });
      setMovimientos(Array.isArray(data.items) ? data.items : []);
    } catch { setMovimientos([]); }
  }, [api, empresaId, estadoMovimientoFiltro, fechaMovimientoDesde, fechaMovimientoHasta, moduloActivo, moduloMovimientoFiltro, q, tipoMovimientoFiltro]);

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
  useEffect(() => { loadInventarioMetricas().catch(() => {}); }, [loadInventarioMetricas]);
  useEffect(() => { loadMovimientos().catch(() => {}); }, [loadMovimientos]);
  useEffect(() => { loadMovimientosMetricas().catch(() => {}); }, [loadMovimientosMetricas]);

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
    loadInventarioMetricas().catch(() => {});
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
      await api.crearItemInventario(buildCreateItemPayload(createForm, empresaId, moduloActivo));
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
    setProveedorForm(buildProveedorForm(item));
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
      const payload = buildProveedorPayload(proveedorForm, empresaId);
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
    const cantidad = Number(stockForm.cantidad || 0);
    const motivo = String(stockForm.motivo || stockForm.observaciones || "").trim();
    const fechaMovimiento = stockForm.fecha ? `${stockForm.fecha}T00:00:00` : null;
    if (stockForm.tipoMovimiento !== "Ajuste" && cantidad <= 0) { setError("Indica una cantidad mayor a cero."); return; }
    if (["Salida", "Ajuste", "Daño", "Pérdida"].includes(stockForm.tipoMovimiento) && !motivo) { setError("Indica el motivo del movimiento."); return; }
    setSavingStock(true);
    setError("");
    setInfo("");
    try {
      if (stockForm.tipoMovimiento === "Compra") {
        await api.registrarCompraInventario({
          inventarioID: Number(stockForm.inventarioID),
          cantidad,
          fecha: fechaMovimiento,
          proveedorID: stockForm.proveedorID ? Number(stockForm.proveedorID) : null,
          numeroFactura: String(stockForm.numeroFactura || "").trim() || null,
          responsable: String(stockForm.responsable || "").trim() || null,
          unidad: String(stockForm.unidad || selectedStockItem?.unidadMedida || "").trim() || null,
          precioUnitario: stockForm.precioUnitario !== "" ? Number(stockForm.precioUnitario) : null,
          fechaVencimiento: stockForm.fechaVencimiento || null,
          observaciones: String(stockForm.observaciones || "").trim() || null,
        });
      } else if (stockForm.tipoMovimiento === "Daño" || stockForm.tipoMovimiento === "Pérdida") {
        await api.registrarDanoInventario({
          inventarioID: Number(stockForm.inventarioID),
          cantidad,
          fecha: fechaMovimiento,
          motivo,
          responsable: String(stockForm.responsable || "").trim() || null,
          unidad: String(stockForm.unidad || selectedStockItem?.unidadMedida || "").trim() || null,
          evidenciaUrl: String(stockForm.evidenciaUrl || "").trim() || null,
          pedidoReferencia: String(stockForm.pedidoReferencia || "").trim() || null,
          observaciones: String(stockForm.observaciones || "").trim() || null,
        });
      } else {
        await api.ajustarStockInventario({
          inventarioId: Number(stockForm.inventarioID),
          payload: {
            tipoMovimiento: stockForm.tipoMovimiento,
            cantidad,
            stockObjetivo: stockForm.tipoMovimiento === "Ajuste" ? Number(stockForm.stockObjetivo || 0) : null,
            motivo,
          },
        });
      }
      setStockForm(initialStockForm);
      if (moduloActivo === "movimientos") {
        await loadAllItems();
      } else {
        await loadInventario();
      }
      await loadInventarioMetricas();
      await loadMovimientos();
      await loadMovimientosMetricas();
      setInfo("Movimiento registrado.");
      setVistaActiva("lista");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible registrar movimiento.");
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

  const descargarMovimientoPdf = async item => {
    try {
      const blob = await api.descargarMovimientoInventarioPdf({ movimientoId: item.movimientoID });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible abrir el PDF del movimiento.");
    }
  };

  const anularMovimiento = async item => {
    if (item.estado === "Anulado") return;
    const motivo = window.prompt(`Motivo de anulacion para ${item.referencia || `MOV-${item.movimientoID}`}`);
    if (!motivo || !motivo.trim()) return;
    try {
      await api.anularMovimientoInventario({ movimientoId: item.movimientoID, motivo: motivo.trim() });
      await loadInventario();
      await loadAllItems();
      await loadMovimientos();
      await loadMovimientosMetricas();
      setInfo("Movimiento anulado y stock reversado.");
    } catch (nextError) {
      setError(nextError?.message || "No fue posible anular el movimiento.");
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
                                  <button type="button" onClick={() => startStockMovement(item, "Compra")}><Truck size={15} strokeWidth={2} /> Registrar compra</button>
                                  <button type="button" onClick={() => startStockMovement(item, "Salida")}><ArrowUpFromLine size={15} strokeWidth={2} /> Registrar salida</button>
                                  <button type="button" onClick={() => startStockMovement(item, "Daño")}><CircleX size={15} strokeWidth={2} /> Registrar daño</button>
                                  <button type="button" onClick={() => startStockMovement(item, "Ajuste")}><RotateCcw size={15} strokeWidth={2} /> Ajustar stock</button>
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
              <h4>{stockForm.tipoMovimiento === "Compra" ? "Registrar compra" : stockForm.tipoMovimiento === "Daño" ? "Registrar daño" : stockForm.tipoMovimiento === "Salida" ? "Registrar salida" : stockForm.tipoMovimiento === "Ajuste" ? "Ajustar stock" : "Registrar movimiento"}</h4>
              <form className="users-create-form inventory-movement-form" onSubmit={submitStock}>
                <label className="inventory-field inventory-field-wide">
                  <span>Insumo</span>
                  <select value={stockForm.inventarioID} onChange={e => setStockForm(f => {
                    const item = stockItemsForSelector.find(option => String(option.inventarioID) === String(e.target.value));
                    return { ...f, inventarioID: e.target.value, unidad: item?.unidadMedida || f.unidad, proveedorID: item?.proveedorID ? String(item.proveedorID) : f.proveedorID, precioUnitario: item?.valorUnitario != null ? String(item.valorUnitario) : f.precioUnitario };
                  })} required>
                    <option value="">Selecciona item</option>
                    {moduloActivo === "movimientos" ? (
                      MODULES.filter(mod => mod.categoria).map(mod => (
                        <optgroup key={mod.key} label={mod.label}>
                          {allItems
                            .filter(item => String(item.categoria || "").toLowerCase() === mod.categoria.toLowerCase())
                            .map(item => <option key={item.inventarioID} value={item.inventarioID}>{item.codigo} - {item.nombre}</option>)}
                        </optgroup>
                      ))
                    ) : (
                      items.map(item => <option key={item.inventarioID} value={item.inventarioID}>{item.codigo} - {item.nombre}</option>)
                    )}
                  </select>
                </label>
                <label className="inventory-field"><span>Tipo de movimiento</span><select value={stockForm.tipoMovimiento} onChange={e => setStockForm(f => ({ ...f, tipoMovimiento: e.target.value, motivo: "" }))}>{MOVIMIENTO_TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
                <label className="inventory-field"><span>Fecha</span><input type="date" value={stockForm.fecha} onChange={e => setStockForm(f => ({ ...f, fecha: e.target.value }))} /></label>
                <label className="inventory-field"><span>Responsable</span><input value={stockForm.responsable} onChange={e => setStockForm(f => ({ ...f, responsable: e.target.value }))} /></label>
                <label className="inventory-field"><span>Unidad</span><input value={stockForm.unidad} onChange={e => setStockForm(f => ({ ...f, unidad: e.target.value }))} /></label>
                {stockForm.tipoMovimiento === "Ajuste" ? (
                  <label className="inventory-field"><span>Stock objetivo</span><input type="number" min="0" step="0.01" value={stockForm.stockObjetivo} onChange={e => setStockForm(f => ({ ...f, stockObjetivo: e.target.value }))} required /></label>
                ) : (
                  <label className="inventory-field"><span>Cantidad</span><input type="number" min="0.01" step="0.01" value={stockForm.cantidad} onChange={e => setStockForm(f => ({ ...f, cantidad: e.target.value }))} required /></label>
                )}
                {stockForm.tipoMovimiento === "Compra" ? (
                  <>
                    <label className="inventory-field"><span>Proveedor</span><select value={stockForm.proveedorID} onChange={e => setStockForm(f => ({ ...f, proveedorID: e.target.value }))}><option value="">Sin proveedor</option>{proveedores.map(proveedor => <option key={proveedor.idProveedor} value={proveedor.idProveedor}>{proveedor.codigoProveedor ? `${proveedor.codigoProveedor} - ` : ""}{proveedor.nombre}</option>)}</select></label>
                    <label className="inventory-field"><span>Factura</span><input value={stockForm.numeroFactura} onChange={e => setStockForm(f => ({ ...f, numeroFactura: e.target.value }))} /></label>
                    <label className="inventory-field"><span>Precio unitario</span><input type="number" min="0" step="0.01" value={stockForm.precioUnitario} onChange={e => setStockForm(f => ({ ...f, precioUnitario: e.target.value }))} /></label>
                    <label className="inventory-field"><span>Vencimiento</span><input type="date" value={stockForm.fechaVencimiento} onChange={e => setStockForm(f => ({ ...f, fechaVencimiento: e.target.value }))} /></label>
                  </>
                ) : null}
                {currentMovementMotivos.length ? (
                  <label className="inventory-field"><span>Motivo</span><select value={stockForm.motivo} onChange={e => setStockForm(f => ({ ...f, motivo: e.target.value }))} required><option value="">Selecciona motivo</option>{currentMovementMotivos.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}</select></label>
                ) : null}
                {(stockForm.tipoMovimiento === "Daño" || stockForm.tipoMovimiento === "Pérdida") ? (
                  <>
                    <label className="inventory-field"><span>Evidencia URL</span><input value={stockForm.evidenciaUrl} onChange={e => setStockForm(f => ({ ...f, evidenciaUrl: e.target.value }))} /></label>
                    <label className="inventory-field"><span>Pedido/ref.</span><input value={stockForm.pedidoReferencia} onChange={e => setStockForm(f => ({ ...f, pedidoReferencia: e.target.value }))} /></label>
                  </>
                ) : null}
                <label className="inventory-field inventory-field-wide"><span>Observaciones</span><textarea className="inventory-textarea" placeholder="Detalle del movimiento" value={stockForm.observaciones} onChange={e => setStockForm(f => ({ ...f, observaciones: e.target.value }))} /></label>
                <div className="order-actions inventory-field-wide"><button type="submit" className="btn-primary" disabled={savingStock}>{savingStock ? "Aplicando..." : "Guardar movimiento"}</button><button type="button" className="btn-outline" onClick={() => { setStockForm(initialStockForm); setVistaActiva("lista"); }}>Cancelar</button></div>
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
                  <button type="button" className="btn-outline inventory-movement-quick-btn is-entrada" onClick={() => startStockMovement(null, "Compra")}>
                    <Truck size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar compra</span>
                  </button>
                  <button type="button" className="btn-outline inventory-movement-quick-btn is-salida" onClick={() => startStockMovement(null, "Salida")}>
                    <ArrowUpFromLine size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar salida</span>
                  </button>
                  <button type="button" className="btn-outline inventory-movement-quick-btn is-ajuste" onClick={() => startStockMovement(null, "Ajuste")}>
                    <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar ajuste</span>
                  </button>
                  <button type="button" className="btn-outline inventory-movement-quick-btn is-dano" onClick={() => startStockMovement(null, "Daño")}>
                    <CircleX size={15} strokeWidth={2} aria-hidden="true" />
                    <span>Registrar daño</span>
                  </button>
                </div>
                <div className="inventory-movements-filters">
                  <select value={moduloMovimientoFiltro} onChange={e => setModuloMovimientoFiltro(e.target.value)} className="inventory-movement-type-select">
                    <option value="">Todos los módulos</option>
                    {MODULES.filter(mod => mod.categoria).map(mod => <option key={mod.key} value={mod.key}>{mod.label}</option>)}
                  </select>
                  <select value={tipoMovimientoFiltro} onChange={e => setTipoMovimientoFiltro(e.target.value)} className="inventory-movement-type-select">
                    <option value="">Todos los tipos</option>
                    {MOVIMIENTO_TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="date" value={fechaMovimientoDesde} onChange={e => setFechaMovimientoDesde(e.target.value)} aria-label="Fecha desde" />
                  <input type="date" value={fechaMovimientoHasta} onChange={e => setFechaMovimientoHasta(e.target.value)} aria-label="Fecha hasta" />
                  <select value={estadoMovimientoFiltro} onChange={e => setEstadoMovimientoFiltro(e.target.value)} className="inventory-movement-type-select">
                    <option value="Registrado">Registrados</option>
                    <option value="">Todos los estados</option>
                    <option value="Anulado">Anulados</option>
                  </select>
                </div>
              </div>
              <table className="orders-table users-table inventory-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Motivo</th>
                    <th>Referencia</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map(item => {
                    const movimientoTipo = String(item.tipoMovimiento || "");
                    const badgeClass = movimientoTipo === "Entrada" || movimientoTipo === "Compra" ? "is-entregado" : movimientoTipo === "Salida" ? "is-pendiente" : movimientoTipo === "Daño" || movimientoTipo === "Pérdida" ? "is-rechazado" : "is-cancelado";
                    return (
                      <tr key={item.movimientoID}>
                        <td data-label="Fecha">{String(item.fecha || "").replace("T", " ").slice(0, 16)}</td>
                        <td data-label="Producto"><div className="inventory-product-cell"><strong>{item.nombre}</strong><span>{item.codigo}</span></div></td>
                        <td data-label="Categoría">{item.categoria || "-"}</td>
                        <td data-label="Tipo"><span className={`order-badge ${badgeClass}`}>{item.tipoMovimiento}</span></td>
                        <td data-label="Cantidad">{Number(item.cantidad || 0)}</td>
                        <td data-label="Unidad">{item.unidadMedida || "-"}</td>
                        <td data-label="Motivo">{item.motivo || "-"}</td>
                        <td data-label="Referencia">{item.referencia || "-"}</td>
                        <td data-label="Estado"><span className={`order-badge ${item.estado === "Anulado" ? "is-cancelado" : "is-entregado"}`}>{item.estado || "Registrado"}</span></td>
                        <td data-label="Usuario">{item.usuarioID || "-"}</td>
                        <td data-label="Acciones">
                          <div className="inventory-row-actions">
                            <button type="button" className="btn-outline inventory-icon-action" title="Imprimir movimiento" onClick={() => descargarMovimientoPdf(item)}>
                              <Eye size={14} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <button type="button" className="btn-outline inventory-icon-action" title="Anular movimiento" disabled={item.estado === "Anulado"} onClick={() => anularMovimiento(item)}>
                              <CircleX size={14} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {movimientosFiltrados.length === 0 ? (
                    <tr><td colSpan="11" className="inventory-empty-note">Sin movimientos.</td></tr>
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
