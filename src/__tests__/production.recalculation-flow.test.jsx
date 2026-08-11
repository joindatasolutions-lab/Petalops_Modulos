import { describe, expect, it, vi, beforeEach } from "vitest";
import * as React from "react";

const mockApi = {
  listarProduccion: vi.fn(async () => ({ items: [] })),
  listarPipelinePedidos: vi.fn(async () => ({ creado: [], aprobado: [], pendiente_produccion: [], en_produccion: [], listo: [], en_camino: [], entregado: [], cancelado: [] })),
  listarPedidos: vi.fn(async () => ({ items: [] })),
  listarFloristas: vi.fn(async () => []),
  buscarArreglosCatalogo: vi.fn(async () => ({ items: [] })),
  obtenerDetallePedido: vi.fn(async () => ({ productos: [] })),
  asignarProduccion: vi.fn(async () => ({})),
  reasignarProduccion: vi.fn(async () => ({})),
  cambiarEstadoProduccion: vi.fn(async () => ({})),
  actualizarEstadoFlorista: vi.fn(async () => ({})),
  generarProduccionDesdePedidos: vi.fn(async () => ({})),
  recalcularProduccionPedido: vi.fn(async () => ({})),
};

vi.mock("../infrastructure/apiClient.js", () => ({
  createApiClient: () => mockApi,
}));

vi.mock("../shared/useSidebarState.js", () => ({
  useSidebarState: () => ({
    sidebarPinned: true,
    sidebarMobileOpen: false,
    setSidebarMobileOpen: vi.fn(),
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCallback: callback => callback,
    useEffect: () => {},
    useMemo: factory => factory(),
    useRef: initialValue => ({ current: initialValue }),
    useState: vi.fn(),
  };
});

const selectedProductionItem = {
  pedidoID: 96657,
  numeroPedido: 96657,
  idProduccion: 123,
  produccionIds: [123],
  estado: "Pendiente",
  nombreArreglo: "Ramo prueba",
  producto: "Ramo prueba",
  clienteNombre: "Cliente QA",
  destinatarioNombre: "Destinatario QA",
  fechaEntrega: "2026-07-14",
  horaEntrega: "14:00",
  floristaAsignado: "Florista QA",
};

const session = {
  usuarioID: 1,
  empresaID: 1,
  sucursalID: 1,
  nombre: "Admin QA",
  email: "admin.qa@petalops.test",
  login: "admin.qa",
  rol: "super_admin",
  esGlobalJoin: true,
};

function configureProductionState() {
  let stateCall = 0;
  vi.mocked(React.useState).mockImplementation(initialValue => {
    stateCall += 1;
    const resolved = typeof initialValue === "function" ? initialValue() : initialValue;
    const valueByCall = {
      5: [selectedProductionItem],
      13: selectedProductionItem,
      14: true,
      18: "Ajuste QA",
    };
    return [Object.prototype.hasOwnProperty.call(valueByCall, stateCall) ? valueByCall[stateCall] : resolved, vi.fn()];
  });
}

function findButtonByText(element, text) {
  if (!element || typeof element !== "object") return null;
  const children = element.props?.children;
  if (element.type === "button") {
    const flatText = flattenText(children);
    if (flatText.includes(text)) return element;
  }
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    const match = findButtonByText(child, text);
    if (match) return match;
  }
  return null;
}

function flattenText(value) {
  if (value == null || typeof value === "boolean") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join("");
  if (typeof value === "object") return flattenText(value.props?.children);
  return "";
}

describe("ProductionPage recalculo de produccion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureProductionState();
    globalThis.alert = vi.fn();
  });

  it("ejecuta recalcularProduccionPedido con los argumentos del pedido seleccionado", async () => {
    const { ProductionPage } = await import("../domain/production/ProductionPage.jsx");
    const tree = ProductionPage({
      session,
      canViewPipeline: true,
      canViewPedidos: true,
      canViewCatalogo: true,
      canViewProduccion: true,
      canViewDomicilios: true,
      canViewBarrios: true,
      canViewInventario: true,
      canViewContabilidad: true,
      canViewClientesPanel: true,
      canViewUsuariosPanel: true,
      onLogout: vi.fn(),
      onGoPipeline: vi.fn(),
      onGoPedidos: vi.fn(),
      onGoProduccion: vi.fn(),
      onGoDomicilios: vi.fn(),
      onGoBarrios: vi.fn(),
      onGoInventario: vi.fn(),
      onGoContabilidad: vi.fn(),
      onGoClientes: vi.fn(),
      onGoUsuarios: vi.fn(),
    });

    const recalculateButton = findButtonByText(tree, "Recalcular producción");
    expect(recalculateButton).toBeTruthy();

    await recalculateButton.props.onClick();

    expect(mockApi.recalcularProduccionPedido).toHaveBeenCalledTimes(1);
    expect(mockApi.recalcularProduccionPedido).toHaveBeenCalledWith({
      pedidoId: selectedProductionItem.pedidoID,
      usuarioCambio: session.email,
      motivo: "Ajuste QA",
      productoEstructuralCambiado: false,
      forceCancelarYCrearNueva: false,
    });
  });

  it("permite a rol admin cambiar estado desde el drawer administrativo", async () => {
    const { ProductionPage } = await import("../domain/production/ProductionPage.jsx");
    const adminSession = {
      ...session,
      rol: "admin",
      esGlobalJoin: false,
      email: "admin.empresa@petalops.test",
    };
    const tree = ProductionPage({
      session: adminSession,
      canViewPipeline: true,
      canViewPedidos: true,
      canViewCatalogo: true,
      canViewProduccion: true,
      canViewDomicilios: true,
      canViewBarrios: true,
      canViewInventario: true,
      canViewContabilidad: true,
      canViewClientesPanel: true,
      canViewUsuariosPanel: true,
      onLogout: vi.fn(),
      onGoPipeline: vi.fn(),
      onGoPedidos: vi.fn(),
      onGoProduccion: vi.fn(),
      onGoDomicilios: vi.fn(),
      onGoBarrios: vi.fn(),
      onGoInventario: vi.fn(),
      onGoContabilidad: vi.fn(),
      onGoClientes: vi.fn(),
      onGoUsuarios: vi.fn(),
    });

    const changeStateButton = findButtonByText(tree, "Cambiar estado");
    const quickStateButton = findButtonByText(tree, "Iniciar");
    const recalculateButton = findButtonByText(tree, "Recalcular producciÃ³n");
    expect(changeStateButton).toBeTruthy();
    expect(quickStateButton).toBeTruthy();
    expect(recalculateButton).toBeNull();

    await quickStateButton.props.onClick();

    expect(mockApi.cambiarEstadoProduccion).toHaveBeenCalledWith({
      produccionId: selectedProductionItem.idProduccion,
      nuevoEstado: "EnProduccion",
      observacionesInternas: expect.stringContaining("panel administrativo"),
      usuarioCambio: adminSession.email,
      origenCambio: "panel_produccion_admin_rapido",
      cambioAdministrativo: true,
    });
  });
});
