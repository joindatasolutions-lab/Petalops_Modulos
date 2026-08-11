import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { LoginPage } from "../domain/auth/LoginPage.jsx";
import { AccountingPage } from "../domain/accounting/AccountingPage.jsx";
import { ClientsPage } from "../domain/clients/ClientsPage.jsx";
import { DeliveryPage } from "../domain/delivery/DeliveryPage.jsx";
import { InventoryPage } from "../domain/inventory/InventoryPage.jsx";
import { NeighborhoodsPage } from "../domain/neighborhoods/NeighborhoodsPage.jsx";
import { OrdersAdminPage } from "../domain/orders-admin/OrdersAdminPage.jsx";
import { PipelineOperativo } from "../domain/pipeline/PipelineOperativo.jsx";
import { ProductionPage } from "../domain/production/ProductionPage.jsx";
import { UsersManagementPage } from "../domain/users/UsersManagementPage.jsx";

const noop = () => {};

const session = {
  usuarioID: 1,
  idUsuario: 1,
  empresaID: 1,
  sucursalID: 1,
  nombre: "Usuario QA",
  login: "qa",
  rol: "empresa_admin",
  esGlobalJoin: true,
  modulosActivosPlan: [
    "pipeline",
    "pedidos",
    "produccion",
    "domicilios",
    "barrios",
    "inventario",
    "contabilidad",
    "clientes",
    "usuarios",
  ],
  permisos: [],
};

const pageProps = {
  session,
  canViewPipeline: true,
  canViewPedidos: true,
  canViewProduccion: true,
  canViewDomicilios: true,
  canViewBarrios: true,
  canViewInventario: true,
  canViewContabilidad: true,
  canViewClientesPanel: true,
  canViewUsuariosPanel: true,
  canViewUsuariosGlobal: true,
  onLogout: noop,
  onGoPipeline: noop,
  onGoPedidos: noop,
  onGoProduccion: noop,
  onGoDomicilios: noop,
  onGoBarrios: noop,
  onGoInventario: noop,
  onGoContabilidad: noop,
  onGoClientes: noop,
  onGoUsuarios: noop,
};

const views = [
  ["Login", <LoginPage onSubmit={noop} loading={false} error="" />],
  ["Pedidos", <OrdersAdminPage {...pageProps} />],
  ["Pipeline", <PipelineOperativo {...pageProps} />],
  ["Produccion", <ProductionPage {...pageProps} />],
  ["Domicilios", <DeliveryPage {...pageProps} />],
  ["Barrios", <NeighborhoodsPage {...pageProps} />],
  ["Inventario", <InventoryPage {...pageProps} />],
  ["Contabilidad", <AccountingPage {...pageProps} />],
  ["Clientes", <ClientsPage {...pageProps} />],
  ["Usuarios", <UsersManagementPage {...pageProps} />],
];

const productionOperatorWithoutFloristaProps = {
  ...pageProps,
  session: {
    ...session,
    esGlobalJoin: false,
    rol: "produccion",
    email: "operador.produccion@petalops.test",
  },
};

describe("vistas principales", () => {
  it.each(views)("renderiza la vista %s sin romper", (_name, element) => {
    const html = renderToStaticMarkup(element);

    expect(html).toContain("<");
    expect(html.length).toBeGreaterThan(500);
  });

  it("renderiza Produccion sin florista asociado sin romper", () => {
    const html = renderToStaticMarkup(<ProductionPage {...productionOperatorWithoutFloristaProps} />);

    expect(html).toContain("Producción");
    expect(html.length).toBeGreaterThan(500);
  });
});
