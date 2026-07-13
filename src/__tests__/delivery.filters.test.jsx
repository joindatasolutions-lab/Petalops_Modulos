import { describe, expect, it } from "vitest";

import {
  deliveryArrangementName,
  deliveryMatchesSearch,
  isStorePickupDelivery,
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

  it("detecta entregas que son para tienda", () => {
    expect(isStorePickupDelivery({ tipo_entrega: "recogida_en_tienda" })).toBe(true);
    expect(isStorePickupDelivery({ tipoEntrega: "Entrega en tiendas" })).toBe(true);
    expect(isStorePickupDelivery({ tipoEntrega: "domicilio" })).toBe(false);
  });
});
