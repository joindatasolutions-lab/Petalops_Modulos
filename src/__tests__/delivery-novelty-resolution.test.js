import { describe, expect, it } from "vitest";
import { buildNoveltyResolution } from "../domain/delivery/deliveryNoveltyResolution.js";

const form = { accion: "entregar", observacion: " Entregado al destinatario ", recibidoNombre: " Ana ", recibidoDocumento: " 123 " };

describe("resolución de novedades de domicilios", () => {
  it.each([
    { item: { idEntrega: 42 } },
    { item: { id_entrega: 42 } },
    { raw: { idEntrega: 42 } },
    { raw: { id_entrega: 42 } },
  ])("identifica la entrega en los formatos de la API: %j", row => {
    expect(buildNoveltyResolution(row, form, "admin")).toEqual({ entregaId: 42, accion: "entregar", usuarioCambio: "admin", observaciones: "Entregado al destinatario", firmaNombre: "Ana", firmaDocumento: "123" });
  });
  it("no confunde el pedido con la entrega", () => {
    expect(() => buildNoveltyResolution({ raw: { idPedido: 42 } }, form, "admin")).toThrow("identificar la entrega");
  });
  it("requiere observaciones", () => {
    expect(() => buildNoveltyResolution({ item: { idEntrega: 42 } }, { ...form, observacion: "  " }, "admin")).toThrow("observación");
  });
  it.each(["reintentar", "disponibles"])("impide marcar como entregado al elegir %s", accion => {
    expect(() => buildNoveltyResolution({ item: { idEntrega: 42 } }, { ...form, accion }, "admin")).toThrow("todavía no está disponible");
  });
  it.each(["nuevo_intento", "devolver_disponibles"])("envía %s con hora de Colombia y sin evidencia de entrega", accion => {
    const payload = buildNoveltyResolution({ raw: { idEntrega: 42 } }, { ...form, accion, reprogramarPara: "2026-11-11T09:00" }, "admin");
    expect(payload.accion).toBe(accion);
    expect(payload.reprogramarPara).toBe("2026-11-11T09:00:00-05:00");
    expect(payload).not.toHaveProperty("firmaNombre");
  });
});
