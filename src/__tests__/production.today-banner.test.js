import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/apiClient.js", () => ({
  createApiClient: () => ({}),
}));

vi.mock("../shared/useSidebarState.js", () => ({
  useSidebarState: () => ({
    sidebarPinned: true,
    sidebarMobileOpen: false,
    setSidebarMobileOpen: vi.fn(),
    toggleSidebar: vi.fn(),
  }),
}));

describe("banner de pedidos pendientes de hoy y atrasados en produccion", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cuenta pedidos vencidos hasta hoy sin duplicar productos del mismo pedido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T15:00:00Z"));
    const { countDueUnfinishedProductionOrders } = await import("../domain/production/ProductionPage.jsx");

    const esalgadoItems = [
      { pedidoID: 9, idProduccion: 100, fechaEntrega: "2026-08-21", estado: "Pendiente" },
      { pedidoID: 10, idProduccion: 101, fechaEntrega: "2026-08-22", estado: "Pendiente" },
      { pedidoID: 10, idProduccion: 102, fechaEntrega: "2026-08-22", estado: "EnProduccion" },
      { pedidoID: 15, idProduccion: 107, fechaEntrega: "2026-08-21", estado: "EnProduccion" },
      { pedidoID: 11, idProduccion: 103, fechaEntrega: "2026-08-22", estado: "ParaEntrega" },
      { pedidoID: 12, idProduccion: 104, fechaEntrega: "2026-08-22", estado: "Cancelado" },
      { pedidoID: 13, idProduccion: 105, fechaEntrega: "2026-08-23", estado: "Pendiente" },
      { pedidoID: 14, idProduccion: 106, fechaEntrega: "2026-08-22", estado: "EnProduccion" },
    ];

    expect(countDueUnfinishedProductionOrders(esalgadoItems)).toBe(4);
  });

  it("agrupa productos del mismo pedido en una sola fila aunque tengan estados diferentes", async () => {
    const { buildVisibleProductionItems } = await import("../domain/production/ProductionPage.jsx");

    const visibleItems = buildVisibleProductionItems([
      {
        pedidoID: 98232,
        idProduccion: 201,
        numeroPedido: 98232,
        nombreArreglo: "Canasto Mediano Sweet",
        producto: "Canasto Mediano Sweet",
        estado: "EnProduccion",
        floristaID: 7,
        floristaAsignado: "James de la Cruz",
      },
      {
        pedidoID: 98232,
        idProduccion: 202,
        numeroPedido: 98232,
        nombreArreglo: "Topper Welcome Baby",
        producto: "Topper Welcome Baby",
        estado: "Pendiente",
        floristaID: 7,
        floristaAsignado: "James de la Cruz",
      },
    ], 7, "", true, true, "James de la Cruz");

    expect(visibleItems).toHaveLength(1);
    expect(visibleItems[0].nombreArreglo).toBe("Canasto Mediano Sweet + Topper Welcome Baby");
    expect(visibleItems[0].produccionIds).toEqual([201, 202]);
    expect(visibleItems[0].estado).toBe("Pendiente");
  });
});
