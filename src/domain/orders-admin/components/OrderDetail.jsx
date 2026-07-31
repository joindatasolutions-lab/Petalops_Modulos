import {
  IconFileText,
  IconInfoCircle,
  IconUser,
  IconWallet,
} from "@tabler/icons-react";
import { CalendarDays, Filter, Gift, Mail, Pencil, Truck } from "lucide-react";

import { formatearCOP, splitDateTimeParts } from "../../../shared/utils.js";
import {
  getOrderFinancialTotal,
  initialsFromName,
  isDeliveryGifted,
  normalizePaymentBreakdownForTotal,
  orderProductLabel,
} from "../ordersDomain.js";
import { canInvoiceStatus } from "../ordersUiRules.js";
import {
  formatClienteNumeroDocumento,
  formatClienteTipoDocumento,
  formatDisplayDate,
  formatMetodoPago,
} from "../orderDetailFormatters.js";
import { extractPaymentBreakdown } from "../paymentBreakdown.js";

/**
 * Drawer de lectura del detalle de pedido.
 *
 * Renderiza secciones informativas y usa helpers puros para formato. No modifica
 * estado ni ejecuta acciones de negocio.
 */

function OrderDetailAccordion({ title, icon, children, defaultOpen = false, className = "" }) {
  return (
    <details className={`order-detail-accordion${className ? ` ${className}` : ""}`} open={defaultOpen}>
      <summary>
        <span className="order-detail-accordion-icon">{icon}</span>
        <span>{title}</span>
      </summary>
      <div className="order-detail-accordion-body">
        {children}
      </div>
    </details>
  );
}

export function OrderDetail({ detalle, empresaId = null, paymentTitle = "Metodo de pago", salesChannelTitle = "Celular Flora", financialPreview = null }) {
  const safeDetalle = detalle && typeof detalle === "object" ? detalle : {};
  const cliente = safeDetalle.cliente && typeof safeDetalle.cliente === "object" ? safeDetalle.cliente : {};
  const destinatario = safeDetalle.destinatario && typeof safeDetalle.destinatario === "object" ? safeDetalle.destinatario : {};
  const financiero = safeDetalle.financiero && typeof safeDetalle.financiero === "object" ? safeDetalle.financiero : {};
  const productos = Array.isArray(safeDetalle.productos) ? safeDetalle.productos : [];
  const { date: fechaPedido, time: horaPedido } = splitDateTimeParts(safeDetalle.fechaPedido || safeDetalle.fecha);
  const { date: fechaEntrega, time: horaEntrega } = splitDateTimeParts(destinatario.fechaEntrega);
  const tipoDocumentoCliente = formatClienteTipoDocumento(cliente);
  const numeroDocumentoCliente = formatClienteNumeroDocumento(cliente);
  const hasFinancialPreview = financialPreview && typeof financialPreview === "object";
  const totalPedido = hasFinancialPreview
    ? Number(financialPreview.total || 0)
    : getOrderFinancialTotal(financiero);
  const subtotalPedido = hasFinancialPreview ? Number(financialPreview.subtotal || 0) : Number(financiero.subtotal || 0);
  const ivaPedido = hasFinancialPreview ? Number(financialPreview.iva || 0) : Number(financiero.iva || 0);
  const storedDomicilioObsequiado = isDeliveryGifted(financiero, safeDetalle.entrega, safeDetalle.destinatario);
  const domicilioPedido = hasFinancialPreview
    ? Number(financialPreview.domicilio || 0)
    : (storedDomicilioObsequiado ? 0 : Number(financiero.domicilio || 0));
  const domicilioOriginal = hasFinancialPreview ? Number(financialPreview.domicilioOriginal || 0) : Number(financiero.domicilio || 0);
  const domicilioObsequiado = Boolean(
    domicilioOriginal > 0 && (
      (hasFinancialPreview && financialPreview.domicilioObsequiado) ||
      (!hasFinancialPreview && storedDomicilioObsequiado)
    )
  );
  const recargoLinkMonto = hasFinancialPreview ? Number(financialPreview.recargoMonto || 0) : Number(financiero.recargoLinkMonto || 0);
  const descuentoMonto = hasFinancialPreview ? Number(financialPreview.descuentoMonto || 0) : Number(financiero.descuentoMonto || 0);
  const saldoFavorMonto = hasFinancialPreview ? Number(financialPreview.saldoFavorMonto || 0) : Number(financiero.saldoFavorMonto || 0);
  const paymentBreakdown = normalizePaymentBreakdownForTotal(
    extractPaymentBreakdown(financiero),
    totalPedido
  );
  const detailRow = (label, value, extraClass = "") => (
    <div className={`order-detail-row${extraClass ? ` ${extraClass}` : ""}`}>
      <span className="order-detail-label">{label}</span>
      <span className="order-detail-value">{value || "-"}</span>
    </div>
  );

  return (
    <div className="orders-detail-premium">
      <section className="orders-detail-kpis" aria-label="Resumen del pedido">
        <div>
          <span>Cliente</span>
          <strong>{cliente.nombre || "-"}</strong>
        </div>
        <div>
          <span>Destinatario</span>
          <strong>{destinatario.nombre || "-"}</strong>
        </div>
        <div>
          <span>Valor</span>
          <strong>${formatearCOP(totalPedido)}</strong>
        </div>
        <div>
          <span>Entrega</span>
          <strong>{formatDisplayDate(destinatario.fechaEntrega)}</strong>
        </div>
      </section>

      <OrderDetailAccordion title="Info general" icon={<IconInfoCircle size={17} stroke={2} />} defaultOpen>
        <div className="orders-detail-data-grid">
          {detailRow("Pedido", safeDetalle.numeroPedido ?? safeDetalle.pedidoID ?? "-")}
          {detailRow("Estado", safeDetalle.estado || "-")}
          {detailRow("Fecha", formatDisplayDate(fechaPedido))}
          {detailRow("Hora", safeDetalle.horaPedido || horaPedido || "-")}
          {detailRow("Factura", canInvoiceStatus(safeDetalle.estado) ? (financiero.facturaImpresa ? "Impresa" : "Pendiente") : "No aplica")}
          {safeDetalle.motivoRechazo ? detailRow("Motivo", safeDetalle.motivoRechazo) : null}
        </div>
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Cliente" icon={<IconUser size={17} stroke={2} />}>
        <div className="orders-detail-person-card">
          <span className="orders-client-avatar">{initialsFromName(cliente.nombre)}</span>
          <div>
            <strong>{cliente.nombre || "-"}</strong>
            <a href={cliente.telefonoCompleto || cliente.telefono ? `tel:${cliente.telefonoCompleto || cliente.telefono}` : undefined}>
              {cliente.telefonoCompleto || cliente.telefono || "-"}
            </a>
            <a href={cliente.email ? `mailto:${cliente.email}` : undefined}>
              {cliente.email || "-"}
            </a>
            <small>{[tipoDocumentoCliente, numeroDocumentoCliente].filter(Boolean).join(" ") || "Sin documento"}</small>
          </div>
        </div>
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Destinatario" icon={<Gift size={17} strokeWidth={2} />}>
        <div className="orders-detail-destination-card">
          <strong>{destinatario.nombre || "-"}</strong>
          <p><Truck size={15} strokeWidth={2} /> {destinatario.direccion || "-"}</p>
          <p><Filter size={15} strokeWidth={2} /> {destinatario.barrio || "-"}</p>
          <p><CalendarDays size={15} strokeWidth={2} /> {formatDisplayDate(fechaEntrega)} / {destinatario.horaEntrega || horaEntrega || "-"}</p>
          <p><Mail size={15} strokeWidth={2} /> {destinatario.mensajeTarjeta || "Sin mensaje"}</p>
          <p><Pencil size={15} strokeWidth={2} /> {destinatario.firma || "Sin firma"}</p>
          {destinatario.observacionGeneral ? <small>{destinatario.observacionGeneral}</small> : null}
        </div>
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Productos" icon={<IconFileText size={17} stroke={2} />} className="orders-detail-products-accordion">
        {productos.length === 0 ? (
          <p className="orders-detail-empty">Sin productos</p>
        ) : (
          <div className="orders-detail-product-list">
            {productos.map((producto, index) => (
              <article key={`${producto.detalleID || producto.productoID || producto.nombreProducto}-${index}`} className="orders-detail-product-card">
                <div className="orders-detail-product-card-head">
                  <strong>{orderProductLabel(producto, empresaId) || `Arreglo ${index + 1}`}</strong>
                </div>
                <div className="orders-detail-product-meta">
                  <span>Cantidad <strong>{Number(producto.cantidad || 0)}</strong></span>
                  <span>Subtotal <strong>${formatearCOP(Number(producto.subtotal || 0))}</strong></span>
                </div>
                {producto.observaciones ? <p>{producto.observaciones}</p> : null}
              </article>
            ))}
          </div>
        )}
      </OrderDetailAccordion>

      <OrderDetailAccordion title="Resumen financiero" icon={<IconWallet size={17} stroke={2} />}>
        <div className="orders-detail-financial-total">
          <span>Total</span>
          <strong>${formatearCOP(totalPedido)}</strong>
        </div>
        <div className="orders-detail-data-grid orders-detail-financial-grid">
          {detailRow("Subtotal", `$${formatearCOP(subtotalPedido)}`)}
          {detailRow("IVA", `$${formatearCOP(ivaPedido)}`)}
          {detailRow("Domicilio", `$${formatearCOP(domicilioPedido)}`)}
          {domicilioObsequiado ? detailRow("Domicilio obsequiado", `-$${formatearCOP(domicilioOriginal)}`) : null}
          {recargoLinkMonto > 0 ? detailRow("Recargo link", `+$${formatearCOP(recargoLinkMonto)}`) : null}
          {descuentoMonto > 0 ? detailRow("Descuento", `-$${formatearCOP(descuentoMonto)}`) : null}
          {saldoFavorMonto > 0 ? detailRow("Saldo a favor", `$${formatearCOP(saldoFavorMonto)}`) : null}
          {detailRow("Estado pago", financiero.estadoPago || "-")}
          {detailRow(paymentTitle, formatMetodoPago(financiero))}
          {paymentBreakdown.length > 0 ? detailRow("Desglose pagos", paymentBreakdown.map(item => `${item.metodo}: $${formatearCOP(item.monto)}`).join(" / ")) : null}
          {detailRow("Cuenta bancaria", financiero.cuentaBancaria || "-")}
          {detailRow(salesChannelTitle, financiero.canalFlora || "-")}
        </div>
      </OrderDetailAccordion>
    </div>
  );
}
