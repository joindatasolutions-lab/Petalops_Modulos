import { describe, expect, it } from "vitest";

import { buildCreateItemPayload, filterRecipeIngredientItems } from "../domain/inventory/inventoryDomain.js";

const items = [
  { inventarioID: 1, nombre: "Rosa Freedom", codigo: "FLO-001", categoria: "Flores", subcategoria: "Rosas" },
  { inventarioID: 2, nombre: "Eucalipto", codigo: "FOL-002", categoria: "Flores", subcategoria: "Follajes" },
  { inventarioID: 3, nombre: "Base cerámica", codigo: "BAS-003", categoria: "Bases", subcategoria: "Cerámica" },
];

describe("buscador de ingredientes de recetas", () => {
  it("busca por nombre sin depender de mayusculas o tildes", () => {
    expect(filterRecipeIngredientItems(items, "CERAMICA")).toEqual([items[2]]);
    expect(filterRecipeIngredientItems(items, "rosa freedom")).toEqual([items[0]]);
  });

  it("busca tambien por codigo y subcategoria", () => {
    expect(filterRecipeIngredientItems(items, "FOL-002")).toEqual([items[1]]);
    expect(filterRecipeIngredientItems(items, "follajes")).toEqual([items[1]]);
  });

  it("conserva todos los insumos cuando no hay busqueda", () => {
    expect(filterRecipeIngredientItems(items, "")).toEqual(items);
  });
});

describe("datos del formulario de producto", () => {
  it("conserva vida util, observaciones y estado", () => {
    const payload = buildCreateItemPayload({
      codigo: "FLO-001",
      nombre: "Rosa Freedom",
      categoria: "Flores",
      unidadMedida: "Tallo",
      diasVidaUtil: "7",
      observaciones: "Mantener refrigerada",
      activo: false,
    }, 3, "flores");

    expect(payload).toMatchObject({
      empresaID: 3,
      diasVidaUtil: 7,
      observaciones: "Mantener refrigerada",
      activo: false,
    });
  });

  it("envia costos por paquete y precios publicos de flores", () => {
    const payload = buildCreateItemPayload({
      codigo: "FLO-002",
      nombre: "Rosa Explorer",
      categoria: "Flores",
      unidadMedida: "Tallo",
      valorUnitario: "2500",
      costoPaquete: "30000",
      precioVenta: "4000",
      precioVentaPaquete: "45000",
      activo: true,
    }, 3, "flores");

    expect(payload).toMatchObject({
      valorUnitario: 2500,
      costoPaquete: 30000,
      precioVenta: 4000,
      precioVentaPaquete: 45000,
    });
  });

  it("no envia precio de venta por paquete fuera de flores", () => {
    const payload = buildCreateItemPayload({
      codigo: "BAS-001",
      nombre: "Base cilindrica",
      categoria: "Bases",
      unidadMedida: "Unidad",
      costoPaquete: "80000",
      precioVentaPaquete: "120000",
      activo: true,
    }, 3, "bases");

    expect(payload.costoPaquete).toBe(80000);
    expect(payload.precioVentaPaquete).toBeNull();
  });
});
