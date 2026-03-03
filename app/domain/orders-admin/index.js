import * as dom from "../../shared/dom.js";
import { escaparHtml, formatearCOP } from "../../shared/utils.js";

const BADGE_CLASS_BY_STATUS = {
  PENDIENTE: "is-pendiente",
  CREADO: "is-pendiente",
  APROBADO: "is-aprobado",
  PAGADO: "is-aprobado",
  RECHAZADO: "is-rechazado",
  CANCELADO: "is-rechazado",
  EN_PRODUCCION: "is-produccion",
  LISTO: "is-entrega",
  EN_ENTREGA: "is-entrega",
  ENTREGADO: "is-entregado"
};

export function initOrdersAdminModule({ store, api, config }) {
  bindFilters({ store, api, config });
  bindTableActions({ store, api });
  bindDrawer({ store, api, config });

  store.subscribe(next => {
    renderOrdersTable(next.ordersAdmin);
    renderDrawer(next.ordersAdmin);
    renderPager(next.ordersAdmin);
  }, ["ordersAdmin"]);

  loadOrders({ store, api, config });
}

function bindFilters({ store, api, config }) {
  const search = dom.getById("ordersSearch");
  const estado = dom.getById("ordersEstado");
  const fechaDesde = dom.getById("ordersFechaDesde");
  const fechaHasta = dom.getById("ordersFechaHasta");
  const refresh = dom.getById("ordersRefresh");
  const prev = dom.getById("ordersPrev");
  const next = dom.getById("ordersNext");

  const applyFilters = () => {
    const current = store.getState();
    store.setState({
      ordersAdmin: {
        filters: {
          ...current.ordersAdmin.filters,
          q: dom.getValue(search),
          estado: dom.getValue(estado),
          fechaDesde: dom.getValue(fechaDesde),
          fechaHasta: dom.getValue(fechaHasta),
          page: 1
        }
      }
    }, ["ordersAdmin"]);

    loadOrders({ store, api, config });
  };

  dom.on(search, "input", debounce(applyFilters, 300), "boundOrdersSearch");
  dom.on(estado, "change", applyFilters, "boundOrdersEstado");
  dom.on(fechaDesde, "change", applyFilters, "boundOrdersFechaDesde");
  dom.on(fechaHasta, "change", applyFilters, "boundOrdersFechaHasta");
  dom.on(refresh, "click", () => loadOrders({ store, api, config }), "boundOrdersRefresh");

  dom.on(prev, "click", () => {
    const current = store.getState();
    const page = Math.max(1, Number(current.ordersAdmin.filters.page || 1) - 1);
    store.setState({ ordersAdmin: { filters: { ...current.ordersAdmin.filters, page } } }, ["ordersAdmin"]);
    loadOrders({ store, api, config });
  }, "boundOrdersPrev");

  dom.on(next, "click", () => {
    const current = store.getState();
    const filters = current.ordersAdmin.filters;
    const page = Number(filters.page || 1) + 1;
    store.setState({ ordersAdmin: { filters: { ...filters, page } } }, ["ordersAdmin"]);
    loadOrders({ store, api, config });
  }, "boundOrdersNext");
}

function bindTableActions({ store, api }) {
  const tbody = dom.getById("ordersTableBody");
  if (!tbody) return;

  dom.on(tbody, "click", async event => {
    const actionBtn = event.target.closest("button[data-action][data-id]");
    const link = event.target.closest("a[data-action][data-id]");
    const node = actionBtn || link;
    if (!node) return;

    const pedidoId = Number(node.dataset.id);
    if (!Number.isFinite(pedidoId)) return;

    const action = String(node.dataset.action || "");

    if (action === "detalle") {
      await openDetail({ store, api, pedidoId });
      return;
    }

    if (action === "aprobar") {
      const ok = globalThis.confirm("¿Aprobar este pedido?");
      if (!ok) return;
      await approveOrder({ store, api, pedidoId });
      return;
    }

    if (action === "rechazar") {
      const motivo = String(globalThis.prompt("Motivo de rechazo", "") || "").trim();
      if (!motivo) {
        globalThis.alert("Debes ingresar un motivo de rechazo.");
        return;
      }
      await rejectOrder({ store, api, pedidoId, motivo });
    }
  }, "boundOrdersTableActions");
}

function bindDrawer({ store, api, config }) {
  const close = dom.getById("ordersDrawerClose");
  const reload = dom.getById("ordersDrawerReload");

  dom.on(close, "click", () => {
    store.setState({ ordersAdmin: { drawerOpen: false, selectedPedidoId: null } }, ["ordersAdmin"]);
  }, "boundOrdersDrawerClose");

  dom.on(reload, "click", async () => {
    const current = store.getState();
    const pedidoId = Number(current.ordersAdmin.selectedPedidoId);
    if (!pedidoId) return;
    await openDetail({ store, api, pedidoId });
    await loadOrders({ store, api, config, silent: true });
  }, "boundOrdersDrawerReload");
}

async function loadOrders({ store, api, config, silent = false }) {
  const current = store.getState();
  const filters = current.ordersAdmin.filters;

  if (!silent) {
    store.setState({ ordersAdmin: { loading: true, error: null } }, ["ordersAdmin"]);
  }

  try {
    const data = await api.listarPedidos({
      empresaId: config.tenant.empresaId,
      sucursalId: config.tenant.sucursalId,
      q: filters.q,
      estado: filters.estado,
      fechaDesde: toIsoDateStart(filters.fechaDesde),
      fechaHasta: toIsoDateEnd(filters.fechaHasta),
      page: filters.page,
      pageSize: filters.pageSize
    });

    store.setState({
      ordersAdmin: {
        loading: false,
        error: null,
        items: Array.isArray(data.items) ? data.items : [],
        total: Number(data.total || 0)
      }
    }, ["ordersAdmin"]);
  } catch (error) {
    console.error("Error cargando pedidos:", error);
    store.setState({
      ordersAdmin: {
        loading: false,
        error: "No fue posible cargar pedidos.",
        items: [],
        total: 0
      }
    }, ["ordersAdmin"]);
  }
}

async function openDetail({ store, api, pedidoId }) {
  const current = store.getState();
  store.setState({
    ordersAdmin: {
      ...current.ordersAdmin,
      drawerOpen: true,
      selectedPedidoId: pedidoId,
      detalle: null
    }
  }, ["ordersAdmin"]);

  try {
    const detalle = await api.obtenerDetallePedido(pedidoId);
    store.setState({ ordersAdmin: { detalle } }, ["ordersAdmin"]);
  } catch (error) {
    console.error("Error obteniendo detalle:", error);
    store.setState({ ordersAdmin: { detalle: { error: true } } }, ["ordersAdmin"]);
  }
}

async function approveOrder({ store, api, pedidoId }) {
  try {
    const response = await api.aprobarPedido(pedidoId);
    optimisticStatusPatch(store, pedidoId, response.estado || "APROBADO");
  } catch (error) {
    console.error("Error aprobando pedido:", error);
    globalThis.alert("No fue posible aprobar el pedido.");
  }
}

async function rejectOrder({ store, api, pedidoId, motivo }) {
  try {
    const response = await api.rechazarPedido(pedidoId, motivo);
    optimisticStatusPatch(store, pedidoId, response.estado || "RECHAZADO");
  } catch (error) {
    console.error("Error rechazando pedido:", error);
    globalThis.alert("No fue posible rechazar el pedido.");
  }
}

function optimisticStatusPatch(store, pedidoId, nextStatus) {
  const current = store.getState();
  const items = current.ordersAdmin.items.map(item => Number(item.pedidoID) === Number(pedidoId)
    ? { ...item, estado: nextStatus }
    : item);

  const detailPatch = current.ordersAdmin.selectedPedidoId === pedidoId && current.ordersAdmin.detalle
    ? { ...current.ordersAdmin.detalle, estado: nextStatus }
    : current.ordersAdmin.detalle;

  store.setState({ ordersAdmin: { items, detalle: detailPatch } }, ["ordersAdmin"]);
}

function renderOrdersTable(ordersState) {
  const tbody = dom.getById("ordersTableBody");
  const loading = dom.getById("ordersLoading");
  const empty = dom.getById("ordersEmpty");
  const error = dom.getById("ordersError");

  if (!tbody) return;

  dom.setText(error, ordersState.error || "");
  dom.toggleClass(error, "hidden", !ordersState.error);
  dom.toggleClass(loading, "hidden", !ordersState.loading);

  if (!ordersState.loading && !ordersState.error && ordersState.items.length === 0) {
    dom.toggleClass(empty, "hidden", false);
    dom.setHtml(tbody, "");
    return;
  }

  dom.toggleClass(empty, "hidden", true);

  const html = ordersState.items.map(item => {
    const statusClass = statusBadgeClass(item.estado);
    const productText = (item.productos || []).slice(0, 2).join(", ");
    const phone = String(item.telefonoCompleto || item.telefono || "").trim();
    const waPhone = phone.replace(/\+/g, "");
    const canAct = isPendingStatus(item.estado);

    return `
      <tr>
        <td>${escaparHtml(item.fecha || "-")}</td>
        <td>${escaparHtml(item.numeroPedido || "-")}</td>
        <td>${escaparHtml(item.cliente || "-")}</td>
        <td>${escaparHtml(item.destinatario || "-")}</td>
        <td title="${escaparHtml((item.productos || []).join(", "))}">${escaparHtml(productText || "-")}</td>
        <td>$${formatearCOP(Number(item.total || 0))}</td>
        <td>${escaparHtml(item.metodoPago || "-")}</td>
        <td><span class="order-badge ${statusClass}">${escaparHtml(item.estado || "-")}</span></td>
        <td>
          <div class="order-actions">
            <a data-action="llamar" data-id="${Number(item.pedidoID)}" href="tel:${escaparHtml(phone)}" class="order-icon">📞</a>
            <a data-action="whatsapp" data-id="${Number(item.pedidoID)}" href="https://wa.me/${escaparHtml(waPhone)}" target="_blank" rel="noreferrer" class="order-icon">💬</a>
            <button type="button" data-action="detalle" data-id="${Number(item.pedidoID)}" class="order-icon">👁</button>
            <button type="button" data-action="aprobar" data-id="${Number(item.pedidoID)}" class="order-icon" ${canAct ? "" : "disabled"}>✔</button>
            <button type="button" data-action="rechazar" data-id="${Number(item.pedidoID)}" class="order-icon" ${canAct ? "" : "disabled"}>✖</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  dom.setHtml(tbody, html);
}

function renderPager(ordersState) {
  const pager = dom.getById("ordersPagerInfo");
  const prev = dom.getById("ordersPrev");
  const next = dom.getById("ordersNext");
  if (!pager) return;

  const page = Number(ordersState.filters.page || 1);
  const pageSize = Number(ordersState.filters.pageSize || 20);
  const total = Number(ordersState.total || 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  dom.setText(pager, `Página ${page} de ${pages} · ${total} pedidos`);
  dom.setDisabled(prev, page <= 1);
  dom.setDisabled(next, page >= pages);
}

function renderDrawer(ordersState) {
  const panel = dom.getById("ordersDrawer");
  const body = dom.getById("ordersDrawerBody");
  if (!panel || !body) return;

  dom.toggleClass(panel, "open", Boolean(ordersState.drawerOpen));

  if (!ordersState.drawerOpen) return;

  if (!ordersState.detalle) {
    dom.setHtml(body, '<p class="order-drawer-empty">Cargando detalle...</p>');
    return;
  }

  if (ordersState.detalle.error) {
    dom.setHtml(body, '<p class="order-drawer-empty">No fue posible cargar el detalle.</p>');
    return;
  }

  const detalle = ordersState.detalle;
  const productos = Array.isArray(detalle.productos) ? detalle.productos : [];

  const productsHtml = productos.map(producto => `
    <li>
      <span>${escaparHtml(producto.nombreProducto)} x${Number(producto.cantidad || 0)}</span>
      <strong>$${formatearCOP(Number(producto.subtotal || 0))}</strong>
    </li>
  `).join("");

  dom.setHtml(body, `
    <section class="order-block">
      <h4>📦 Información General</h4>
      <p><strong>Número:</strong> ${escaparHtml(detalle.numeroPedido || "-")}</p>
      <p><strong>Fecha:</strong> ${escaparHtml(detalle.fecha || "-")}</p>
      <p><strong>Estado:</strong> ${escaparHtml(detalle.estado || "-")}</p>
      <p><strong>Empresa:</strong> ${escaparHtml(String(detalle.empresaID || "-"))}</p>
      <p><strong>Sucursal:</strong> ${escaparHtml(String(detalle.sucursalID || "-"))}</p>
      ${detalle.motivoRechazo ? `<p><strong>Motivo rechazo:</strong> ${escaparHtml(detalle.motivoRechazo)}</p>` : ""}
    </section>

    <section class="order-block">
      <h4>👤 Cliente</h4>
      <p><strong>Nombre:</strong> ${escaparHtml(detalle.cliente?.nombre || "-")}</p>
      <p><strong>Teléfono:</strong> ${escaparHtml(detalle.cliente?.telefonoCompleto || detalle.cliente?.telefono || "-")}</p>
      <p><strong>Email:</strong> ${escaparHtml(detalle.cliente?.email || "-")}</p>
    </section>

    <section class="order-block">
      <h4>🎁 Destinatario</h4>
      <p><strong>Nombre:</strong> ${escaparHtml(detalle.destinatario?.nombre || "-")}</p>
      <p><strong>Teléfono:</strong> ${escaparHtml(detalle.destinatario?.telefono || "-")}</p>
      <p><strong>Dirección:</strong> ${escaparHtml(detalle.destinatario?.direccion || "-")}</p>
      <p><strong>Barrio:</strong> ${escaparHtml(detalle.destinatario?.barrio || "-")}</p>
      <p><strong>Fecha entrega:</strong> ${escaparHtml(detalle.destinatario?.fechaEntrega || "-")}</p>
      <p><strong>Hora entrega:</strong> ${escaparHtml(detalle.destinatario?.horaEntrega || "-")}</p>
      <p><strong>Mensaje:</strong> ${escaparHtml(detalle.destinatario?.mensajeTarjeta || "-")}</p>
    </section>

    <section class="order-block">
      <h4>💰 Resumen financiero</h4>
      <p><strong>Subtotal:</strong> $${formatearCOP(Number(detalle.financiero?.subtotal || 0))}</p>
      <p><strong>IVA:</strong> $${formatearCOP(Number(detalle.financiero?.iva || 0))}</p>
      <p><strong>Domicilio:</strong> $${formatearCOP(Number(detalle.financiero?.domicilio || 0))}</p>
      <p><strong>Total:</strong> $${formatearCOP(Number(detalle.financiero?.total || 0))}</p>
      <p><strong>Estado pago:</strong> ${escaparHtml(detalle.financiero?.estadoPago || "-")}</p>
      <p><strong>Cuenta bancaria:</strong> ${escaparHtml(detalle.financiero?.cuentaBancaria || "-")}</p>
    </section>

    <section class="order-block">
      <h4>🧾 Productos</h4>
      <ul class="order-products-list">${productsHtml || "<li>Sin productos</li>"}</ul>
    </section>
  `);
}

function statusBadgeClass(status) {
  const key = normalizeStatus(status);
  return BADGE_CLASS_BY_STATUS[key] || "is-pendiente";
}

function isPendingStatus(status) {
  const key = normalizeStatus(status);
  return key === "PENDIENTE" || key === "CREADO";
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function toIsoDateStart(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T00:00:00`;
}

function toIsoDateEnd(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return "";
  return `${value}T23:59:59`;
}

function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = globalThis.setTimeout(() => fn(...args), wait);
  };
}
