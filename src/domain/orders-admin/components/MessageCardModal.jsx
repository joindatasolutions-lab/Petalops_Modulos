import { MESSAGE_CARD_FONT_OPTIONS } from "../ordersAdminConstants.js";
import { formatFechaEntregaTarjeta, resolveFirmaTarjeta } from "../orderDateFormatters.js";

/**
 * Modal imprimible de tarjeta floral.
 *
 * Componente controlado: recibe valores, setters y acciones desde la pagina. No
 * guarda datos ni llama al API; solo renderiza controles y previsualizacion.
 */

export function MessageCardModal({
  data,
  order,
  draft,
  saving,
  error,
  fontFamily,
  fontSize,
  textColor,
  textAlign,
  signatureAlign,
  onDraftChange,
  onFontFamilyChange,
  onFontSizeChange,
  onTextColorChange,
  onTextAlignChange,
  onSignatureAlignChange,
  onSave,
  onClose,
}) {
  return (
    <div className="message-card-overlay" role="dialog" aria-modal="true" aria-label="Tarjeta de mensaje floral">
      <div className="message-card-panel">
        <div className="message-card-toolbar no-print-card">
          <h3>Tarjeta de mensaje floral</h3>
          <div className="message-card-controls">
            <label>
              Fuente
              <select value={fontFamily} onChange={event => onFontFamilyChange(event.target.value)}>
                {MESSAGE_CARD_FONT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tamano
              <input
                type="range"
                min={14}
                max={48}
                step={1}
                value={fontSize}
                onChange={event => onFontSizeChange(Number(event.target.value))}
              />
            </label>
            <label>
              Color
              <input type="color" value={textColor} onChange={event => onTextColorChange(event.target.value)} />
            </label>
            <label>
              Alineacion mensaje
              <select value={textAlign} onChange={event => onTextAlignChange(event.target.value)}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="justify">Justificado</option>
              </select>
            </label>
            <label>
              Alineacion firma
              <select value={signatureAlign} onChange={event => onSignatureAlignChange(event.target.value)}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </label>
            <label className="message-card-message-editor">
              Mensaje
              <textarea
                rows={4}
                value={draft}
                onChange={event => onDraftChange(event.target.value)}
                placeholder="Escribe o corrige el mensaje"
              />
            </label>
          </div>
          {error ? <p className="orders-message">{error}</p> : null}
          <div className="message-card-actions">
            <button type="button" className="btn-outline" onClick={onSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar mensaje"}
            </button>
            <button type="button" className="btn-primary" onClick={() => globalThis.print()}>Imprimir tarjeta</button>
            <button type="button" className="btn-outline" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <section className="message-card-canvas" aria-label="Tarjeta imprimible">
          <div className="message-card-content">
            <p className="message-card-order-number">
              {order?.numeroPedido ?? "-"}
            </p>
            <p className="message-card-meta message-card-date">
              {formatFechaEntregaTarjeta(data?.fechaEntrega || order?.fechaEntrega)}
            </p>
            <div className="message-card-message-row">
              <p
                className="message-card-message"
                style={{
                  fontFamily,
                  fontSize: `${fontSize}px`,
                  color: textColor,
                  textAlign,
                }}
              >
                {String(draft || "Sin mensaje")}
              </p>
            </div>
            <p className="message-card-meta message-card-signature">
              <span
                style={{
                  fontFamily,
                  textAlign: signatureAlign
                }}
              >
                {resolveFirmaTarjeta(data?.firma)}
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
