import { describe, expect, it } from "vitest";

import {
  buildRegularizeDeliveryPayload,
  deliveryArrangementName,
  isDeliveryAllowedProductionStatus,
  deliveryMatchesSearch,
  deliveryOrderCodeLabel,
  isStorePickupDelivery,
  resolveDetailArrangementName,
} from "../domain/delivery/DeliveryPage.jsx";

describe("filtros de domicilios", () => {
  it("encuentra pedidos entregados cuando el backend responde campos snake_case", () => {
    const deliveredOrder = {
      estado_entrega_codigo: "ENTREGADO",
      numero_pedido: 96456,
      codigo_pedido: "FL-96456",
      id_pedido: 123,
      id_entrega: 456,
      cliente_nombre: "Cliente prueba",
      telefono_destino: "3001234567",
      direccion_destino: "Calle 123",
      resumen_productos: "Ramo",
    };

    expect(deliveryMatchesSearch(deliveredOrder, "96456")).toBe(true);
    expect(deliveryMatchesSearch(deliveredOrder, "FL-96456")).toBe(true);
    expect(deliveryMatchesSearch(deliveredOrder, "Cliente prueba")).toBe(true);
  });

  it("incluye el nombre del arreglo en los valores de busqueda", () => {
    const order = {
      numeroPedido: 123,
      nombre_arreglo: "Ramo Primavera",
    };

    expect(deliveryArrangementName(order)).toBe("Ramo Primavera");
    expect(deliveryMatchesSearch(order, "primavera")).toBe(true);
  });

  it("muestra el numero de pedido sin prefijo FLR", () => {
    expect(deliveryOrderCodeLabel({ numeroPedido: "FLR-54678" })).toBe("54678");
    expect(deliveryOrderCodeLabel({ numero_pedido: "54679" })).toBe("54679");
  });

  it("resuelve el nombre del producto desde el detalle del pedido", () => {
    const detail = {
      data: {
        productos: [
          { nombreProducto: "Personalizado 0096" },
        ],
      },
    };

    expect(resolveDetailArrangementName(detail)).toBe("Personalizado 0096");
  });

  it("detecta entregas que son para tienda", () => {
    expect(isStorePickupDelivery({ tipo_entrega: "recogida_en_tienda" })).toBe(true);
    expect(isStorePickupDelivery({ tipoEntrega: "Entrega en tiendas" })).toBe(true);
    expect(isStorePickupDelivery({ direccion: "Recoger En Tienda" })).toBe(true);
    expect(isStorePickupDelivery({ tipoEntrega: "domicilio" })).toBe(false);
  });

  it("solo permite domicilios con produccion en ParaEntrega cuando el backend envia ese estado", () => {
    expect(isDeliveryAllowedProductionStatus({ estadoProduccion: "ParaEntrega" })).toBe(true);
    expect(isDeliveryAllowedProductionStatus({ estado_produccion: "PARA_ENTREGA" })).toBe(true);
    expect(isDeliveryAllowedProductionStatus({ estadoProduccion: "EnProduccion" })).toBe(false);
    expect(isDeliveryAllowedProductionStatus({ estadoProduccion: "Pendiente" })).toBe(false);
  });

  it("valida todas las producciones del pedido antes de mostrarlo en domicilios", () => {
    expect(isDeliveryAllowedProductionStatus({
      producciones: [
        { estado: "ParaEntrega" },
        { estadoProduccion: "PARA_ENTREGA" },
      ],
    })).toBe(true);

    expect(isDeliveryAllowedProductionStatus({
      producciones: [
        { estado: "ParaEntrega" },
        { estadoProduccion: "EnProduccion" },
      ],
    })).toBe(false);
  });

  it("arma el payload masivo para regularizar entregas", () => {
    expect(buildRegularizeDeliveryPayload({
      fechaEntrega: "2026-08-17",
      domiciliarioId: "123",
      motivo: "Pedido entregado fisicamente pero no asignado en el sistema",
      pedidosText: "98047 10:15\n98051,10:30",
    })).toEqual({
      fecha_entrega: "2026-08-17",
      domiciliario_id: 123,
      motivo: "Pedido entregado fisicamente pero no asignado en el sistema",
      pedidos: [
        { pedido_id: 98047, hora_entrega: "10:15" },
        { pedido_id: 98051, hora_entrega: "10:30" },
      ],
    });
  });

  it("valida motivo y hora al regularizar entregas", () => {
    expect(() => buildRegularizeDeliveryPayload({
      fechaEntrega: "2026-08-17",
      domiciliarioId: "123",
      motivo: "corto",
      pedidosText: "98047 10:15",
    })).toThrow(/minimo 10/);

    expect(() => buildRegularizeDeliveryPayload({
      fechaEntrega: "2026-08-17",
      domiciliarioId: "123",
      motivo: "Pedido entregado fisicamente",
      pedidosText: "98047 25:99",
    })).toThrow(/HH:MM/);
  });
});
