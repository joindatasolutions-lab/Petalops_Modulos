import { describe, expect, it, vi } from "vitest";
import { assignDeliveryBatch } from "../domain/delivery/deliveryBatchAssignment.js";
import { createApiClient } from "../infrastructure/apiClient.js";
import { isBatchEligible, isBatchReassignEligible, deliveryAssignmentUnchanged } from "../domain/delivery/DeliveryPage.jsx";

const items = [{ idEntrega: 1 }, { idEntrega: 2 }, { idEntrega: 3 }];
const isEligible = item => !item.domiciliarioID;

describe("asignación administrativa por lote", () => {
  it("permite reasignar solo entregas asignadas con responsable", () => {
    const assigned = { idEntrega: 1, estado: "Asignado", domiciliarioID: 42 };
    expect(isBatchReassignEligible(assigned)).toBe(true);
    expect(isBatchReassignEligible({ id_entrega: 1, estado_entrega_codigo: "ASIGNADO", domiciliario_id: 42 })).toBe(true);
    for (const estado of ["Pendiente", "Entregado", "EnRuta", "NoEntregado", "Cancelado"]) {
      expect(isBatchReassignEligible({ ...assigned, estado })).toBe(false);
    }
    expect(isBatchReassignEligible({ ...assigned, domiciliarioID: null })).toBe(false);
    expect(isBatchReassignEligible({ ...assigned, tipoEntrega: "recogida_en_tienda" })).toBe(false);
  });

  it("reasigna varias entregas y omite cambios de responsable o estado", async () => {
    const selected = [1, 2, 3, 4].map(idEntrega => ({ idEntrega, estado: "Asignado", domiciliarioID: 42 }));
    const freshItems = selected.map(item => item.idEntrega === 2 ? { ...item, domiciliarioID: 99 }
      : item.idEntrega === 3 ? { ...item, estado: "EnRuta" } : item);
    const assign = vi.fn().mockResolvedValue({});
    const results = await assignDeliveryBatch({ items: selected, freshItems, isEligible: isBatchReassignEligible,
      isUnchanged: deliveryAssignmentUnchanged, reassign: true, assign });
    expect(assign.mock.calls.map(([item]) => item.idEntrega)).toEqual([1, 4]);
    expect(results.map(item => item.status)).toEqual(["success", "conflict", "conflict", "success"]);
    expect(results[0].message).toBe("Reasignado correctamente.");
  });

  it("solo selecciona entregas listas, identificadas y sin responsable", () => {
    expect(isBatchEligible({ idEntrega: 1, estado: "Pendiente", estadoProduccion: "ParaEntrega" })).toBe(true);
    expect(isBatchEligible({ id_entrega: 1, estado_entrega_codigo: "PENDIENTE" })).toBe(true);
    expect(isBatchEligible({ idEntrega: 1, estado: "ParaEntrega" })).toBe(true);
    expect(isBatchEligible({ idEntrega: 1, estado: "Pendiente", domiciliario_id: 42 })).toBe(false);
    expect(isBatchEligible({ idEntrega: 1, estado: "Pendiente", estadoProduccion: "EnProduccion" })).toBe(false);
    expect(isBatchEligible({ idEntrega: 1, estado: "Pendiente", tipoEntrega: "recogida_en_tienda" })).toBe(false);
    expect(isBatchEligible({ idEntrega: 1, estado: "Entregado" })).toBe(false);
    expect(isBatchEligible({ idEntrega: 1 })).toBe(false);
    expect(isBatchEligible({ estado: "Pendiente" })).toBe(false);
  });
  it("asigna una vez cada entrega y conserva el orden", async () => {
    const assign = vi.fn().mockResolvedValue({});
    const results = await assignDeliveryBatch({ items: [...items, items[0]], freshItems: items, isEligible, assign });
    expect(assign.mock.calls.map(([item]) => item.idEntrega)).toEqual([1, 2, 3]);
    expect(results.map(item => item.status)).toEqual(["success", "success", "success"]);
  });

  it("no asigna pedidos desaparecidos o asignados por otro administrador", async () => {
    const assign = vi.fn().mockResolvedValue({});
    const results = await assignDeliveryBatch({ items, freshItems: [{ idEntrega: 1, domiciliarioID: 99 }, items[2]], isEligible, assign });
    expect(assign).toHaveBeenCalledExactlyOnceWith(items[2]);
    expect(results.map(item => item.status)).toEqual(["conflict", "conflict", "success"]);
  });

  it("continúa después de un fallo y no reintenta automáticamente", async () => {
    const assign = vi.fn(async item => { if (item.idEntrega === 2) throw new Error("Sin conexión"); });
    const results = await assignDeliveryBatch({ items, freshItems: items, isEligible, assign });
    expect(assign).toHaveBeenCalledTimes(3);
    expect(results.map(item => item.status)).toEqual(["success", "error", "success"]);
    expect(results[1].message).toBe("Sin conexión");
  });

  it("conserva como conflicto un HTTP 409 ocurrido después de la consulta previa", async () => {
    const assign = vi.fn(async item => {
      if (item.idEntrega === 2) throw Object.assign(new Error("Ya fue asignado"), { status: 409 });
    });
    const results = await assignDeliveryBatch({ items, freshItems: items, isEligible, assign });
    expect(results.map(item => item.status)).toEqual(["success", "conflict", "success"]);
    expect(assign).toHaveBeenCalledTimes(3);
  });

  it("envía el mismo domiciliario sin forzar sobrecupo cuando se solicita", async () => {
    const original = globalThis.fetch;
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetch;
    try {
      await createApiClient({ apiBaseUrl: "https://api.test" }).asignarDomiciliarioEntrega({ entregaId: 1, domiciliarioID: 42, usuarioCambio: "admin", permitirSobrecupo: false });
      const [url, options] = fetch.mock.calls[0];
      expect(url).toContain("permitirSobrecupo=false");
      expect(JSON.parse(options.body)).toMatchObject({ domiciliarioID: 42, permitirSobrecupo: false, forzarSobrecupo: false });
    } finally { globalThis.fetch = original; }
  });
});
