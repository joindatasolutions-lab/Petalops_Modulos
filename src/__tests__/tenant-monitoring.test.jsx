import { describe, expect, it } from "vitest";

import {
  buildMonitoringRows,
  buildMonitoringTotals,
  filterAndSortMonitoringRows,
} from "../domain/tenant-monitoring/TenantMonitoringPage.jsx";

describe("TenantMonitoringPage", () => {
  it("normaliza logoUrl por empresa y permite fallback cuando viene null", () => {
    const rows = buildMonitoringRows([
      {
        empresaID: 3,
        nombre: "Flora",
        slug: "flora",
        logoUrl: "https://cdn.test/flora.png",
        estado: "Activo",
        pedidosHoy: 3,
        pedidosMes: 10,
      },
      {
        empresaID: 4,
        nombre: "Sin Logo",
        slug: "sin-logo",
        logoUrl: null,
        estado: "Activo",
        pedidosHoy: 0,
        pedidosMes: 2,
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 3,
        nombre: "Flora",
        slug: "flora",
        logoUrl: "https://cdn.test/flora.png",
        pedidosHoy: 3,
        pedidosMes: 10,
      }),
      expect.objectContaining({
        id: 4,
        nombre: "Sin Logo",
        slug: "sin-logo",
        logoUrl: "",
        pedidosHoy: 0,
        pedidosMes: 2,
      }),
    ]);
  });

  it("conserva todas las empresas entregadas por el endpoint", () => {
    const rows = buildMonitoringRows([
      { empresaID: 1, nombre: "Join Data", slug: "join-data", estado: "Activo" },
      { empresaID: 2, nombre: "PetalOps", slug: "petalops-demo", estado: "Activo" },
      { empresaID: 3, nombre: "Flora", slug: "flora", estado: "Activo" },
      { empresaID: 4, nombre: "Empresa interna", slug: "petalops", estado: "Activo" },
    ]);

    expect(rows.map(row => row.nombre)).toEqual(["Join Data", "PetalOps", "Flora", "Empresa interna"]);
  });

  it("adapta el estado numerico y los logos de la respuesta del endpoint", () => {
    const rows = buildMonitoringRows([
      {
        empresaID: 4,
        nombre: "La Fiore Casa de Flores",
        slug: "lafiore",
        logoUrl: "[https://cdn.test/logo_lafiore.PNG](https://cdn.test/logo_lafiore.PNG)",
        estado: "1",
        pedidosHoy: 15,
        pedidosMes: 62,
        tarifa: 1500,
        totalHoy: 22500,
        totalMes: 93000,
      },
    ]);

    expect(rows[0]).toEqual(expect.objectContaining({
      estado: "Activo",
      logoUrl: "https://cdn.test/logo_lafiore.PNG",
      pedidosHoy: 15,
      pedidosMes: 62,
      tarifa: 1500,
      totalHoy: 22500,
      totalMes: 93000,
    }));
  });

  it("calcula el promedio mensual desde el resumen del endpoint", () => {
    expect(buildMonitoringTotals({ tenants: 2, pedidosHoy: 5, pedidosMes: 43, totalHoy: 9500, totalMes: 90000 })).toEqual({
      empresas: 2,
      pedidosHoy: 5,
      pedidosMes: 43,
      totalHoy: 9500,
      totalMes: 90000,
      promedioMensual: 21.5,
    });

    expect(buildMonitoringTotals({ tenants: 0, pedidosHoy: 0, pedidosMes: 10 }).promedioMensual).toBe(0);
  });

  it("filtra localmente por pedidos, nombre, ID y slug", () => {
    const rows = buildMonitoringRows([
      { empresaID: 3, nombre: "Flora", slug: "flora", estado: "Activo", pedidosHoy: 3, pedidosMes: 30 },
      { empresaID: 8, nombre: "Casa Verde", slug: "verde", estado: null, pedidosHoy: 0, pedidosMes: 4 },
    ]);

    expect(filterAndSortMonitoringRows(rows, { filter: "withToday" }).map(row => row.nombre)).toEqual(["Flora"]);
    expect(filterAndSortMonitoringRows(rows, { filter: "withoutToday" }).map(row => row.nombre)).toEqual(["Casa Verde"]);
    expect(filterAndSortMonitoringRows(rows, { query: "  FLO  " }).map(row => row.nombre)).toEqual(["Flora"]);
    expect(filterAndSortMonitoringRows(rows, { query: "8" }).map(row => row.nombre)).toEqual(["Casa Verde"]);
    expect(filterAndSortMonitoringRows(rows, { query: "verde" }).map(row => row.nombre)).toEqual(["Casa Verde"]);
  });

  it("ordena localmente por pedidos del mes por defecto", () => {
    const rows = buildMonitoringRows([
      { empresaID: 1, nombre: "B", slug: "b", estado: "Activo", pedidosHoy: 4, pedidosMes: 3 },
      { empresaID: 2, nombre: "A", slug: "a", estado: "Activo", pedidosHoy: 1, pedidosMes: 10 },
    ]);

    expect(filterAndSortMonitoringRows(rows).map(row => row.nombre)).toEqual(["A", "B"]);
    expect(filterAndSortMonitoringRows(rows, { sort: "todayDesc" }).map(row => row.nombre)).toEqual(["B", "A"]);
    expect(filterAndSortMonitoringRows(rows, { sort: "nameAsc" }).map(row => row.nombre)).toEqual(["A", "B"]);
  });
});
