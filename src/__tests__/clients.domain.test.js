import { describe, expect, it, vi } from "vitest";

import { canEditClients, loadAllClientPages } from "../domain/clients/clientsDomain.js";

describe("dominio de clientes", () => {
  it("carga todas las paginas cuando el backend reporta mas clientes que el pageSize", async () => {
    const api = {
      listarClientes: vi.fn(async ({ page }) => ({
        items: Array.from({ length: page < 3 ? 300 : 125 }, (_, index) => ({
          clienteID: ((page - 1) * 300) + index + 1,
        })),
        total: 725,
      })),
    };

    const items = await loadAllClientPages(
      api,
      { empresaId: 3, q: "", soloActivos: false, includeMetrics: true },
      { pageSize: 300 }
    );

    expect(items).toHaveLength(725);
    expect(api.listarClientes).toHaveBeenCalledTimes(3);
    expect(api.listarClientes).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, pageSize: 300 }));
    expect(api.listarClientes).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, pageSize: 300 }));
    expect(api.listarClientes).toHaveBeenNthCalledWith(3, expect.objectContaining({ page: 3, pageSize: 300 }));
  });

  it("sigue cargando paginas sin total hasta que recibe una pagina parcial", async () => {
    const api = {
      listarClientes: vi.fn(async ({ page }) => ({
        items: Array.from({ length: page < 3 ? 2 : 1 }, (_, index) => ({
          clienteID: ((page - 1) * 2) + index + 1,
        })),
      })),
    };

    const items = await loadAllClientPages(api, { empresaId: 3 }, { pageSize: 2 });

    expect(items).toHaveLength(5);
    expect(api.listarClientes).toHaveBeenCalledTimes(3);
  });

  it("permite editar a quien tiene Clientes asignado con permiso de edicion", () => {
    const session = {
      rol: "Pedidos",
      modulosActivosPlan: ["pedidos", "clientes"],
      permisos: [
        { modulo: "pedidos", puedeVer: true, puedeEditar: true },
        { modulo: "clientes", puedeVer: true, puedeEditar: true },
      ],
    };

    expect(canEditClients(session)).toBe(true);
  });

  it("no permite editar si Clientes no esta asignado o no tiene puedeEditar", () => {
    expect(canEditClients({
      rol: "Pedidos",
      modulosActivosPlan: ["pedidos"],
      permisos: [{ modulo: "clientes", puedeVer: true, puedeEditar: true }],
    })).toBe(false);

    expect(canEditClients({
      rol: "Pedidos",
      modulosActivosPlan: ["clientes"],
      permisos: [{ modulo: "clientes", puedeVer: true, puedeEditar: false }],
    })).toBe(false);
  });
});
