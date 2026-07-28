import { describe, expect, it } from "vitest";

import { filterAccountingDetailRows } from "../domain/accounting/AccountingPage.jsx";
import { buildDeliveryAdminQueryPlan, deliveryMatchesSearch } from "../domain/delivery/DeliveryPage.jsx";
import { filterInventoryItems } from "../domain/inventory/InventoryPage.jsx";
import { filterNeighborhoodItems, sortNeighborhoods } from "../domain/neighborhoods/NeighborhoodsPage.jsx";
import { buildOrdersMetrics, extractOrdersPayloadItems, filterOrdersByCreatedDateRange, filterOrdersBySearch, filterOrdersByStatus, isStorePickupOrder, localDateEndParam, localDateStartParam, resolveOrdersPayloadTotal, shouldShowPendingInvoiceAlert } from "../domain/orders-admin/OrdersAdminPage.jsx";
import { buildNewOrderCheckoutPayload } from "../domain/orders-admin/orderPayloadBuilders.js";
import { buildOrderFinancialPreview } from "../domain/orders-admin/ordersDomain.js";
import {
  buildVisibleProductionItems,
  catalogCodeCandidates,
  deliveryTimingStatus,
  ESTADOS_UI,
  isProductionReadyForDelivery,
  nextFloristaStatus,
  normalizeProductionItemStatus,
  productionBackendStatusFilter,
  productionItemFromCanceledOrder,
  productionSelectedStatusKey,
  productionStateActionClass,
  productionItemMatchesSearch,
  productCodeCandidates,
  resolveDetailProductionImageUrl,
  resolvePedidoListProductionImageUrl,
  resolvePipelineProductionImageUrl,
  resolveProductionProduct,
  shouldIncludeCanceledProduction,
  shouldShowFloristaStateAction,
} from "../domain/production/ProductionPage.jsx";
import { filterByUserText } from "../domain/traceability/TraceabilityPage.jsx";
import { filterVisibleRoles } from "../domain/users/UsersManagementPage.jsx";

describe("estabilidad de filtros por vista", () => {
  it("Pedidos: normaliza filtros de estado sin perder variantes equivalentes", () => {
    const rows = [
      { estado: "CREADO" },
      { estado: "Pendiente" },
      { estado: "APROBADO" },
      { estado: "RECHAZADO" },
      { estado: "CANCELADO" },
    ];

    expect(filterOrdersByStatus(rows, "CREADO")).toHaveLength(2);
    expect(filterOrdersByStatus(rows, "CANCELADO")).toHaveLength(2);
    expect(buildOrdersMetrics(rows, 0, "2026-06-25").pendientes).toBe(2);
  });

  it("Pedidos: solo cuenta facturas pendientes en pedidos aprobados", () => {
    const rows = [
      { estado: "CREADO", facturaImpresa: false },
      { estado: "APROBADO", facturaImpresa: false },
      { estado: "APROBADO", facturaImpresa: true },
    ];

    expect(buildOrdersMetrics(rows, 99, "2026-06-25").facturasNoImpresas).toBe(1);
    expect(shouldShowPendingInvoiceAlert(rows[0])).toBe(false);
    expect(shouldShowPendingInvoiceAlert(rows[1])).toBe(true);
  });

  it("Pedidos: detecta pedidos para recoger en tienda", () => {
    expect(isStorePickupOrder({ tipoEntrega: "recogida_en_tienda" })).toBe(true);
    expect(isStorePickupOrder({ destinatario: { barrio: "Recoger en tienda" } })).toBe(true);
    expect(isStorePickupOrder({ entrega: { tipo_entrega: "domicilio" }, barrio: "Riomar" })).toBe(false);
  });

  it("Pedidos: busca por pedido, cliente o nombre de producto", () => {
    const rows = [
      {
        numeroPedido: 96657,
        cliente: "Verena Jimenez",
        productosDetalle: [{ nombreProducto: "Personalizado 0096", codigoCatalogo: "0096" }],
      },
      {
        numeroPedido: 96658,
        cliente: "Maria Bolaño",
        productosDetalle: [{ nombreProducto: "Corazón Mini Surtido", codigoCatalogo: "0101" }],
      },
    ];

    expect(filterOrdersBySearch(rows, "96657", 3)).toEqual([rows[0]]);
    expect(filterOrdersBySearch(rows, "verena", 3)).toEqual([rows[0]]);
    expect(filterOrdersBySearch(rows, "mini surtido", 3)).toEqual([rows[1]]);
  });

  it("Pedidos: prioriza coincidencias por numero de pedido", () => {
    const rows = [
      { numeroPedido: 96657, cliente: "Verena Jimenez" },
      { numeroPedido: 97000, cliente: "Cliente 96657" },
    ];

    expect(filterOrdersBySearch(rows, "96657", 3)).toEqual([rows[0]]);
  });

  it("Pedidos: busca por metodo de pago visible o desglose financiero", () => {
    const rows = [
      {
        numeroPedido: 96657,
        cliente: "Verena Jimenez",
        metodoPago: "Efectivo",
      },
      {
        numeroPedido: 96658,
        cliente: "Maria Bolaño",
        financiero: {
          metodosPago: ["Link Bold", "Transferencia"],
        },
      },
      {
        numeroPedido: 96659,
        cliente: "Ana Perez",
        financiero: {
          detallePago: [{ metodo: "Nequi", monto: 25000 }],
        },
      },
    ];

    expect(filterOrdersBySearch(rows, "efectivo", 3)).toEqual([rows[0]]);
    expect(filterOrdersBySearch(rows, "link", 3)).toEqual([rows[1]]);
    expect(filterOrdersBySearch(rows, "nequi", 3)).toEqual([rows[2]]);
  });

  it("Pedidos: respeta localmente el rango visible de fecha de pedido", () => {
    const rows = [
      { numeroPedido: 1, fecha_pedido: "2026-07-15 23:59:59" },
      { numeroPedido: 2, fecha_pedido: "2026-07-16 00:09:19", fechaEntrega: "2026-07-16" },
    ];

    expect(filterOrdersByCreatedDateRange(rows, "2026-07-15", "2026-07-15")).toEqual([rows[0]]);
    expect(filterOrdersByCreatedDateRange(rows, "2026-07-16", "2026-07-16")).toEqual([rows[1]]);
  });

  it("Pedidos: envia rangos locales al backend sin UTC ni zona horaria", () => {
    expect(localDateStartParam("2026-07-16")).toBe("2026-07-16 00:00:00");
    expect(localDateEndParam("2026-07-16")).toBe("2026-07-16 23:59:59");
    expect(localDateStartParam("2026-07-16T12:30:00Z")).toBe("2026-07-16 00:00:00");
  });

  it("Pedidos: acepta payloads anidados del backend", () => {
    const rows = [{ numeroPedido: 96657 }, { numeroPedido: 96658 }];
    const payload = {
      data: {
        items: rows,
        totalRegistros: 2,
      },
    };

    expect(extractOrdersPayloadItems(payload)).toEqual(rows);
    expect(resolveOrdersPayloadTotal(payload, [])).toBe(2);
  });

  it("Pedidos: domicilio obsequiado cobra cero sin perder el valor original", () => {
    const preview = buildOrderFinancialPreview(
      { subtotal: 100000, iva: 0, domicilio: 12000 },
      [],
      false,
      0,
      0,
      true
    );

    expect(preview.domicilio).toBe(0);
    expect(preview.domicilioOriginal).toBe(12000);
    expect(preview.domicilioObsequiado).toBe(true);
    expect(preview.total).toBe(100000);
  });

  it("Pedidos: checkout manual conserva cliente identificado por telefono", () => {
    const payload = buildNewOrderCheckoutPayload({
      empresaId: 3,
      sucursalId: 1,
      productoID: 99,
      form: {
        clienteID: 55,
        clienteNombre: "Prueba Join",
        clienteTelefono: "3001234567",
        clienteEmail: "joindatasolutions@gmail.com",
        clienteTipoIdent: "CC",
        clienteIdentificacion: "1062397422",
        destinatarioNombre: "Prueba Join",
        telefonoDestino: "",
        direccion: "Calle 1",
        barrioNombre: "Centro",
        domicilioObsequiado: false,
        fechaEntrega: "2026-07-27",
        horaEntrega: "08:00",
        cantidad: 1,
        precio: "",
        mensajeTarjeta: "",
        firma: "",
        observacionGeneral: "",
        metodoPago: "Efectivo",
        canalFlora: "WhatsApp",
      },
    });

    expect(payload.cliente.clienteID).toBe(55);
    expect(payload.cliente.identificacion).toBe("1062397422");
    expect(payload.cliente.email).toBe("joindatasolutions@gmail.com");
  });

  it("Produccion: empresa 3 resuelve imagen por codigo_catalogo antes que codigo_producto", () => {
    const catalogIndex = new Map([
      ["catalog-code:0066", { codigo: "0066", nombre: "Virgen Guadalupe", imageUrl: "/catalogo-0066.png" }],
      ["code:PRD-999", { codigo: "PRD-999", nombre: "Producto interno", imageUrl: "/producto-incorrecto.png" }],
      ["name:virgen guadalupe o milagrosa grande", { codigo: "NOMBRE", nombre: "Nombre parecido", imageUrl: "/nombre-incorrecto.png" }],
    ]);

    const product = resolveProductionProduct(
      {
        codigoCatalogo: "0066",
        codigoProducto: "PRD-999",
        nombreArreglo: "Virgen Guadalupe o Milagrosa Grande",
        imagenUrl: "/directa-incorrecta.png",
      },
      catalogIndex,
      { preferCatalogCode: true, allowDirectImage: false }
    );

    expect(catalogCodeCandidates({ codigoCatalogo: "0066", codigoProducto: "PRD-999" })).toEqual(["0066"]);
    expect(product.imageUrl).toBe("/catalogo-0066.png");
  });

  it("Produccion florista: conserva codigo_catalogo al agrupar y renderiza imagen por catalogo", () => {
    const [grouped] = buildVisibleProductionItems([
      {
        pedidoID: 10,
        idProduccion: 100,
        numeroPedido: 96610,
        floristaID: 7,
        codigoCatalogo: "0066",
        codigoProducto: "PRD-999",
        nombreArreglo: "Virgen Guadalupe",
      },
    ], 7, "", true, true);

    const catalogIndex = new Map([
      ["catalog-code:0066", { codigo: "0066", nombre: "Virgen Guadalupe", imageUrl: "/catalogo-0066.png" }],
      ["code:prd-999", { codigo: "PRD-999", nombre: "Producto interno", imageUrl: "/producto-incorrecto.png" }],
    ]);
    const product = resolveProductionProduct(grouped, catalogIndex, {
      preferCatalogCode: true,
      allowDirectImage: false,
    });

    expect(grouped.codigoCatalogo).toBe("0066");
    expect(catalogCodeCandidates(grouped)).toEqual(["0066"]);
    expect(product.imageUrl).toBe("/catalogo-0066.png");
  });

  it("Produccion empresa 3: si codigo_catalogo apunta a otro arreglo, resuelve por nombre exacto", () => {
    const catalogIndex = new Map([
      ["catalog-code:0057", { codigo: "0057", nombre: "Corazón Mini Rosas", imageUrl: "/corazon-mini-rosas.png" }],
      ["name:corazon mini surtido", { codigo: "0058", nombre: "Corazón Mini Surtido", imageUrl: "/corazon-mini-surtido.png" }],
    ]);

    const product = resolveProductionProduct(
      {
        codigoCatalogo: "0057",
        codigoProducto: "0058",
        nombreArreglo: "Corazón Mini Surtido",
      },
      catalogIndex,
      { preferCatalogCode: true, allowDirectImage: false }
    );

    expect(product.imageUrl).toBe("/corazon-mini-surtido.png");
  });

  it("Produccion empresa 3: acepta aliases reales del backend para codigo_catalogo", () => {
    const catalogIndex = new Map([
      ["catalog-code:fb-01", { codigo: "FB-01", nombre: "Flora Box Mediana Aire", imageUrl: "/flora-box.png" }],
    ]);
    const product = resolveProductionProduct(
      {
        codigoArreglo: "FB-01",
        nombreArreglo: "Flora Box Mediana Aire",
      },
      catalogIndex,
      { preferCatalogCode: true, allowDirectImage: false }
    );

    expect(catalogCodeCandidates({ codigoArreglo: "FB-01" })).toEqual(["FB-01"]);
    expect(product.imageUrl).toBe("/flora-box.png");
  });

  it("Produccion: empresas distintas de 3 resuelven imagen por codigo_producto", () => {
    const catalogIndex = new Map([
      ["catalog-code:0066", { codigo: "0066", nombre: "Catalogo", imageUrl: "/catalogo-incorrecto.png" }],
      ["code:prd-999", { codigo: "PRD-999", nombre: "Producto interno", imageUrl: "/producto-correcto.png" }],
    ]);

    const item = {
      codigoCatalogo: "0066",
      codigoProducto: "PRD-999",
      nombreArreglo: "Virgen Guadalupe",
    };
    const product = resolveProductionProduct(item, catalogIndex, {
      preferCatalogCode: false,
      allowDirectImage: false,
    });

    expect(catalogCodeCandidates(item)).toEqual(["0066"]);
    expect(productCodeCandidates(item)).toEqual(["PRD-999"]);
    expect(product.imageUrl).toBe("/producto-correcto.png");
  });

  it("Produccion: detalle y pipeline respetan codigo_catalogo solo para empresa 3", () => {
    const catalogIndex = new Map([
      ["catalog-code:0066", { codigo: "0066", nombre: "Catalogo", imageUrl: "/catalogo-correcto.png" }],
      ["code:prd-999", { codigo: "PRD-999", nombre: "Producto interno", imageUrl: "/producto-correcto.png" }],
    ]);
    const sourceItem = {
      numeroPedido: 96610,
      codigoCatalogo: "0066",
      codigoProducto: "PRD-999",
    };
    const detail = {
      productos: [{
        codigoCatalogo: "0066",
        codigoProducto: "PRD-999",
        imagenUrl: "/directa-incorrecta.png",
      }],
    };
    const pipelinePayload = {
      en_produccion: [{
        numeroPedido: 96610,
        codigoCatalogo: "0066",
        codigoProducto: "PRD-999",
        imagenUrl: "/directa-incorrecta.png",
      }],
    };

    expect(resolveDetailProductionImageUrl(detail, catalogIndex, sourceItem, 3)).toBe("/catalogo-correcto.png");
    expect(resolvePipelineProductionImageUrl(pipelinePayload, sourceItem, catalogIndex, 3)).toBe("/catalogo-correcto.png");
    expect(resolveDetailProductionImageUrl(detail, catalogIndex, sourceItem, 4)).toBe("/producto-correcto.png");
    expect(resolvePipelineProductionImageUrl(pipelinePayload, sourceItem, catalogIndex, 4)).toBe("/producto-correcto.png");
  });

  it("Produccion empresa 3: personalizado resuelve imagen desde pedido por codigoCatalogo", async () => {
    const api = {
      async listarPedidos() {
        return {
          items: [{
            numeroPedido: 96595,
            productosDetalle: [{
              nombreProducto: "Personalizado",
              codigoCatalogo: "0096",
            }],
          }],
        };
      },
      async buscarArreglosCatalogo() {
        return {
          items: [{
            nombreProducto: "Personalizado",
            codigoCatalogo: "0096",
            codigoProducto: "P-INT",
            imagenUrl: "/catalogo-0096.png",
          }],
        };
      },
    };

    await expect(resolvePedidoListProductionImageUrl(
      api,
      3,
      1,
      { numeroPedido: 96595, nombreArreglo: "Personalizado" },
      new Map()
    )).resolves.toBe("/catalogo-0096.png");
  });

  it("Produccion empresa 3: usa imagen_url del producto encontrado por numero de pedido", async () => {
    const api = {
      async listarPedidos() {
        return {
          items: [{
            numeroPedido: 94915,
            productosDetalle: [
              {
                nombreProducto: "Otro arreglo",
                codigoCatalogo: "0001",
                imagenUrl: "/otro.png",
              },
              {
                nombreProducto: "Marquito Girasol",
                codigoCatalogo: "0065",
                codigoProducto: "PRD-INTERNO",
                imagenUrl: "/pedido-marquito-girasol.png",
              },
            ],
          }],
        };
      },
      async buscarArreglosCatalogo() {
        return {
          items: [{
            nombreProducto: "Marquito Girasol",
            codigoCatalogo: "0065",
            imagenUrl: "/catalogo-fallback.png",
          }],
        };
      },
    };

    await expect(resolvePedidoListProductionImageUrl(
      api,
      3,
      1,
      {
        numeroPedido: 94915,
        nombreArreglo: "Marquito Girasol",
        codigoCatalogo: "0065",
      },
      new Map([
        ["catalog-code:0065", { codigo: "0065", nombre: "Marquito Girasol", imageUrl: "/catalogo-cache.png" }],
      ])
    )).resolves.toBe("/pedido-marquito-girasol.png");
  });

  it("Produccion empresa 3: personalizado soporta variantes del payload de pedidos", async () => {
    const api = {
      async listarPedidos() {
        return {
          data: {
            items: [{
              numeroPedido: 96595,
              detallesPedido: [{
                nombreProducto: "Personalizado",
                codigoCatalogo: "0096",
              }],
            }],
          },
        };
      },
      async buscarArreglosCatalogo() {
        return {
          data: {
            productos: [{
              nombreProducto: "Personalizado",
              codigoCatalogo: "0096",
              codigoProducto: "P-INT",
              imagenUrl: "/catalogo-0096.png",
            }],
          },
        };
      },
    };

    await expect(resolvePedidoListProductionImageUrl(
      api,
      3,
      1,
      { numeroPedido: 96595, nombreArreglo: "Personalizado" },
      new Map()
    )).resolves.toBe("/catalogo-0096.png");
  });

  it("Produccion: busqueda por pedido o codigo no depende solo del nombre visible", () => {
    const item = {
      numeroPedido: 96610,
      cliente: "issettMarino",
      codigoCatalogo: "0066",
      codigoProducto: "PRD-999",
      nombreArreglo: "Virgen Guadalupe",
    };

    expect(productionItemMatchesSearch(item, "96610")).toBe(true);
    expect(productionItemMatchesSearch(item, "0066")).toBe(true);
    expect(productionItemMatchesSearch(item, "issett")).toBe(true);
  });

  it("Produccion: ParaEntrega muestra indicador verde sin siguiente accion", () => {
    expect(shouldShowFloristaStateAction("ParaEntrega")).toBe(true);
    expect(isProductionReadyForDelivery("ParaEntrega")).toBe(true);
    expect(productionStateActionClass("ParaEntrega")).toBe("is-entrega");
    expect(nextFloristaStatus("ParaEntrega")).toBeNull();
  });

  it("Produccion: ParaEntrega muestra Estado tiempo Finalizado", () => {
    expect(deliveryTimingStatus({
      estado: "ParaEntrega",
      fechaEntrega: "2020-01-01",
      horaEntrega: "08:00",
    })).toMatchObject({
      label: "Finalizado",
      className: "is-entrega",
    });
  });

  it("Produccion: solo permite Pendiente, EnProduccion, ParaEntrega y Cancelado", () => {
    expect(ESTADOS_UI).toEqual(["Pendiente", "EnProduccion", "ParaEntrega", "Cancelado"]);
    expect(ESTADOS_UI).not.toContain("Entregado");
    expect(shouldIncludeCanceledProduction(["Pendiente"])).toBe(false);
    expect(shouldIncludeCanceledProduction(["Cancelado"])).toBe(true);
    expect(productionBackendStatusFilter(["Cancelado"])).toBe("Cancelado");
    expect(productionBackendStatusFilter(ESTADOS_UI)).toBeUndefined();
    expect(productionSelectedStatusKey(ESTADOS_UI)).toBe("todos");
    expect(productionSelectedStatusKey(["ParaEntrega"])).toBe("PARAENTREGA");
  });

  it("Produccion: pedido padre cancelado se muestra como Cancelado", () => {
    const item = normalizeProductionItemStatus({
      estado: "ParaEntrega",
      estadoPedido: "Cancelado",
      numeroPedido: 96571,
    });

    expect(item.estado).toBe("Cancelado");
    expect(item.estadoProduccionOriginal).toBe("ParaEntrega");
    expect(productionItemMatchesSearch(item, "96571")).toBe(true);
  });

  it("Produccion: adapta pedidos cancelados como filas visibles", () => {
    const item = productionItemFromCanceledOrder({
      pedidoID: 33,
      numeroPedido: 96479,
      estado: "CANCELADO",
      cliente: "Cliente demo",
      fechaEntrega: "2026-06-25T08:00:00",
      productos: [{ nombreProducto: "Ramo cancelado", codigoCatalogo: "0099" }],
    });

    expect(item.estado).toBe("Cancelado");
    expect(item.numeroPedido).toBe(96479);
    expect(item.nombreArreglo).toBe("Ramo cancelado");
    expect(item.codigoCatalogo).toBe("0099");
    expect(productionItemMatchesSearch(item, "96479")).toBe(true);
  });

  it("Domicilios: buscar numero de pedido ignora fecha y consulta varios estados", () => {
    const queryPlan = buildDeliveryAdminQueryPlan({
      filtro: "hoy",
      statusFilter: "todos",
      fechaFiltro: "2026-06-25",
      deliverySearch: "96610",
    });

    expect(queryPlan.fecha).toBeNull();
    expect(queryPlan.filtersToFetch).toContain("pendientes");
    expect(queryPlan.filtersToFetch).toContain("enruta");
  });

  it("Domicilios: sin busqueda numerica conserva fecha y estado seleccionado", () => {
    const queryPlan = buildDeliveryAdminQueryPlan({
      filtro: "hoy",
      statusFilter: "no-entregado",
      fechaFiltro: "2026-06-25",
      deliverySearch: "cliente prueba",
    });

    expect(queryPlan.fecha).toBe("2026-06-25");
    expect(queryPlan.filtersToFetch).toEqual(["noentregado"]);
    expect(deliveryMatchesSearch({ numero_pedido: 96610, cliente_nombre: "Cliente prueba" }, "cliente")).toBe(true);
  });

  it("Inventario: combina filtro de stock y subcategoria", () => {
    const rows = [
      { nombre: "Rosa", subcategoria: "Flores", stockActual: 0, stockMinimo: 5 },
      { nombre: "Cinta", subcategoria: "Empaque", stockActual: 20, stockMinimo: 5 },
    ];

    expect(filterInventoryItems(rows, { stockFiltro: "critical", subcategoriaFiltro: "Flores" })).toEqual([rows[0]]);
    expect(filterInventoryItems(rows, { subcategoriaFiltro: "Empaque" })).toEqual([rows[1]]);
  });

  it("Contabilidad: filtra detalle por ajustes, saldos y cancelados", () => {
    const rows = [
      { pedidoID: 1, descuentoMonto: 1000, saldoFavorMonto: 0, estado: "APROBADO" },
      { pedidoID: 2, descuentoMonto: 0, saldoFavorMonto: 5000, estado: "APROBADO" },
      { pedidoID: 3, descuentoMonto: 0, saldoFavorMonto: 0, estado: "RECHAZADO" },
      { pedidoID: 4, descuentoNota: "Ajuste manual", descuentoMonto: 0, estado: "APROBADO" },
    ];

    expect(filterAccountingDetailRows(rows, "descuento").map(row => row.pedidoID)).toEqual([1]);
    expect(filterAccountingDetailRows(rows, "saldo").map(row => row.pedidoID)).toEqual([2]);
    expect(filterAccountingDetailRows(rows, "cancelados").map(row => row.pedidoID)).toEqual([3]);
    expect(filterAccountingDetailRows(rows, "conNotas").map(row => row.pedidoID)).toEqual([4]);
  });

  it("Trazabilidad: filtra por usuario, cliente o pedido", () => {
    const rows = [
      { usuario: "florista.demo", cliente: "Ana", pedidoID: 96610 },
      { usuario: "admin", cliente: "Beatriz", pedidoID: 100 },
    ];

    expect(filterByUserText(rows, "florista")).toEqual([rows[0]]);
    expect(filterByUserText(rows, "Beatriz")).toEqual([rows[1]]);
    expect(filterByUserText(rows, "96610")).toEqual([rows[0]]);
  });

  it("Barrios: combina estado, zona, costo y busqueda", () => {
    const rows = [
      { nombreBarrio: "Centro", zonaID: 1, costoDomicilio: 0, activo: true },
      { nombreBarrio: "Norte", zonaID: 2, costoDomicilio: 12000, activo: false },
      { nombreBarrio: "Sur", zonaID: 1, costoDomicilio: 8000, activo: true },
    ];

    expect(filterNeighborhoodItems(rows, { estadoFilter: "activos", zonaFilter: "1" })).toHaveLength(2);
    expect(filterNeighborhoodItems(rows, { costFilter: "sin_costo" })).toEqual([rows[0]]);
    expect(sortNeighborhoods(rows, "costo_desc")[0]).toBe(rows[1]);
  });

  it("Usuarios: oculta roles estructurales cuando no es vista global", () => {
    const roles = [
      { nombreRol: "empresa_admin" },
      { nombreRol: "florista" },
      { nombreRol: "domiciliario" },
    ];

    expect(filterVisibleRoles(roles, false)).toEqual([roles[1], roles[2]]);
    expect(filterVisibleRoles(roles, true)).toEqual(roles);
  });
});
