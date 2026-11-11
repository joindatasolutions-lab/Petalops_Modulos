import { describe, expect, it } from "vitest";

import {
  normalizeInventoryExcelHeader,
  parseInventoryExcelNumber,
  parseInventoryWorksheetRows,
} from "../domain/inventory/inventoryImport.js";

describe("importación Excel de inventario", () => {
  it("ignora mayúsculas, tildes y el encabezado PROVEDOR del archivo de Flora", () => {
    const parsed = parseInventoryWorksheetRows([{
      CÓDIGO: "FL-001",
      PRODUCTO: "Rosa roja",
      SUBCATEGORÍA: "Rosas",
      COLOR: "Rojo",
      "TAMAÑO": 20,
      UNIDAD: "Paquete",
      PROVEDOR: "Flores Áurea",
      "STOCK INICIAL": 5,
      "STOCK MÍNIMO": 2,
      "COSTO X UNIDAD": 750,
      "COSTO X PAQUETE": 15000,
      "PRECIO DE VENTA POR UNIDAD": 3000,
      "PRECIO DE VENTA POR PAQUETE": 18000,
    }]);

    expect(parsed.errors).toEqual([]);
    expect(parsed.items[0]).toMatchObject({
      codigo: "FL-001",
      nombre: "Rosa roja",
      proveedor: "Flores Áurea",
      tamano: "20",
      stockActual: 5,
      stockMinimo: 2,
      valorUnitario: 750,
      costoPaquete: 15000,
      precioVenta: 3000,
      precioVentaPaquete: 18000,
    });
  });

  it("reconoce el encabezado TAMA�O y separa códigos repetidos", () => {
    const parsed = parseInventoryWorksheetRows([
      { CODIGO: "FL-01", PRODUCTO: "Rosa", "TAMA�O ": "Grande" },
      { codigo: "fl-01", producto: "Otra rosa", "TAMA�O ": "Pequeña" },
    ]);

    expect(parsed.items).toEqual([]);
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors.every(error => error.mensaje.includes("repetido"))).toBe(true);
  });

  it("normaliza valores monetarios colombianos", () => {
    expect(parseInventoryExcelNumber("$ 15.000")).toBe(15000);
    expect(parseInventoryExcelNumber("1.250,50")).toBe(1250.5);
    expect(normalizeInventoryExcelHeader("SUBCATEGORÍA ")).toBe("subcategoria");
  });
});
