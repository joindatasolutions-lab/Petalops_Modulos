import { describe, expect, it } from "vitest";

import { buildMonitoringRows } from "../domain/tenant-monitoring/TenantMonitoringPage.jsx";

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

  it("excluye las empresas demo Join Data y Petalops por nombre o slug", () => {
    const rows = buildMonitoringRows([
      { empresaID: 1, nombre: "Join Data", slug: "join-data", estado: "Activo" },
      { empresaID: 2, nombre: "PetalOps", slug: "petalops-demo", estado: "Activo" },
      { empresaID: 3, nombre: "Flora", slug: "flora", estado: "Activo" },
      { empresaID: 4, nombre: "Empresa interna", slug: "petalops", estado: "Activo" },
    ]);

    expect(rows.map(row => row.nombre)).toEqual(["Flora"]);
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
      },
    ]);

    expect(rows[0]).toEqual(expect.objectContaining({
      estado: "Activo",
      logoUrl: "https://cdn.test/logo_lafiore.PNG",
      pedidosHoy: 15,
      pedidosMes: 62,
      needsAttention: false,
    }));
  });
});
