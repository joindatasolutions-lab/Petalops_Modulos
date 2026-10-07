import { describe, expect, it, vi } from "vitest";
import { useOrderEditActions } from "../domain/orders-admin/hooks/useOrderEditActions.js";

vi.mock("react", () => ({ useRef: value => ({ current: value }) }));

describe("acciones de edición", () => {
  it("evita guardar o agregar simultáneamente y libera el bloqueo al terminar", async () => {
    let resolve;
    const update = new Promise(done => { resolve = done; });
    const api = { actualizarDetallePedidoPipeline: vi.fn(() => update), agregarDetallePedidoPipeline: vi.fn() };
    const reloadDrawer = vi.fn();
    const actions = useOrderEditActions({
      api, selectedPedidoId: 12, detalle: { pedidoID: 12 },
      setDetailEditError: vi.fn(), setDetailEditSaving: vi.fn(), setIsEditingDetail: vi.fn(),
      validatePaymentMethods: () => ({}), validateSalesChannel: () => "",
      buildDetailEditApiPayload: id => ({ pedidoId: id }), reloadDrawer,
    });
    const first = actions.onSaveDetailEdit();
    await actions.onSaveDetailEdit();
    await actions.onAddDetailProduct();
    expect(api.actualizarDetallePedidoPipeline).toHaveBeenCalledTimes(1);
    expect(api.agregarDetallePedidoPipeline).not.toHaveBeenCalled();
    resolve(); await first;
    expect(reloadDrawer).toHaveBeenCalledTimes(1);
    await actions.onSaveDetailEdit();
    expect(api.actualizarDetallePedidoPipeline).toHaveBeenCalledTimes(2);
  });
});
