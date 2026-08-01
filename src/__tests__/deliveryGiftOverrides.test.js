import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyDeliveryGiftOverrideToItem,
  forgetDeliveryGiftOverride,
  rememberDeliveryGiftOverride,
} from "../domain/orders-admin/deliveryGiftOverrides.js";
import { resolveOrderListTotal } from "../domain/orders-admin/ordersDomain.js";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: vi.fn(key => store.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn(key => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("delivery financial overrides", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
    forgetDeliveryGiftOverride(77);
  });

  it("mantiene el total recalculado del listado cuando se quita domicilio obsequiado", () => {
    rememberDeliveryGiftOverride(77, {
      subtotal: 350000,
      iva: 0,
      domicilio: 8000,
      domicilioOriginal: 8000,
      descuentoDomicilio: 0,
      recargoLinkMonto: 0,
      descuentoMonto: 0,
      saldoFavorMonto: 0,
      total: 358000,
      domicilioObsequiado: false,
      omitirCostoDomicilio: false,
    });

    const item = applyDeliveryGiftOverrideToItem({
      pedidoID: 77,
      total: 350000,
      financiero: {
        subtotal: 350000,
        iva: 0,
        domicilio: 0,
        total: 350000,
      },
    });

    expect(resolveOrderListTotal(item)).toBe(358000);
    expect(item.total).toBe(358000);
    expect(item.domicilioObsequiado).toBe(false);
  });
});
