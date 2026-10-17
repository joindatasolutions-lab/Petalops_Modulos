import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientsTableView } from "../domain/clients/ClientsTableView.jsx";
import { ClientsHeader } from "../domain/clients/ClientsHeader.jsx";

const client = { clienteID: 1, nombreCompleto: "Ana Flores", activo: true };
const render = props => renderToStaticMarkup(<ClientsTableView items={[]} q="" {...props} />);

describe("Estados de carga de Clientes", () => {
  it("mantiene encabezados y muestra cinco skeletons sin estado vacio", () => {
    const html = render({ loading: true, initialLoading: true });
    expect(html.match(/class="clients-skeleton-row"/g)).toHaveLength(5);
    expect(html).toContain("<th>Nombre</th>");
    expect(html).toContain("Cargando clientes...");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("No hay clientes");
  });

  it("conserva filas durante actualizacion sin skeletons", () => {
    const html = render({ loading: true, items: [client] });
    expect(html).toContain("Ana Flores");
    expect(html).toContain("Cargando clientes...");
    expect(html).not.toContain("clients-skeleton-row");
    expect(html).not.toContain("No hay clientes");
  });

  it("no muestra vacio al actualizar una consulta sin registros", () => {
    const html = render({ loading: true });
    expect(html).not.toContain("No hay clientes");
    expect(html).not.toContain("clients-skeleton-row");
  });

  it("distingue exito, vacio y error inicial", () => {
    expect(render({ items: [client] })).toContain("Ana Flores");
    expect(render({})).toContain("No hay clientes registrados.");
    const html = render({ loadError: "Error de red" });
    expect(html).toContain("Intenta actualizar.");
    expect(html).not.toContain("No hay clientes");
    expect(html).not.toContain("Cargando clientes...");
  });

  it("conserva filas cuando falla una actualizacion", () => {
    const html = render({ items: [client], loadError: "Error de red" });
    expect(html).toContain("Ana Flores");
    expect(html).not.toContain("No hay clientes");
  });

  it("mantiene Actualizar secundario y Agregar principal", () => {
    const html = renderToStaticMarkup(<ClientsHeader activeView="clientes" loading />);
    expect(html).toContain('class="btn-outline orders-header-refresh clients-refresh-btn"');
    expect(html).toContain('class="btn-primary orders-header-refresh clients-add-btn"');
    expect(html).toContain("<span>Actualizar</span>");
    expect(html).not.toContain("Actualizando...");
  });
});
