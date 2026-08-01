/*
 * Paneles secundarios de produccion.
 * Contiene disponibilidad de floristas, gestion de incapacidad y vista Looker.
 */
import { IconCalendarPlus } from "@tabler/icons-react";
import { formatDateOnly } from "../../../shared/utils.js";
import { ESTADOS_FLORISTA, LOOKER_STUDIO_URL } from "../productionConstants.js";
import { isFloristaActivo } from "../productionDomain.js";

export function ProductionAvailabilityPanel({ floristasDisponibilidad, onToggleDisponibilidadFlorista }) {
  return (
    <section className="order-block production-section-card production-availability-panel">
      <div className="production-section-head production-section-head--stack">
        <div>
          <h4>Disponibilidad florista</h4>
          <p className="production-section-copy">Floristas internos numerados por la sucursal actual. Los demás aparecen como externos.</p>
        </div>
      </div>

      <div className="production-availability-grid production-availability-grid--compact floristas-grid">
        {floristasDisponibilidad.length === 0 ? (
          <p className="orders-message" style={{ marginBottom: 0 }}>No hay floristas disponibles para mostrar.</p>
        ) : floristasDisponibilidad.map(item => {
          const estaActivo = isFloristaActivo(item);
          const identificador = item.esExterno ? "Externo" : `#${item.numeroFlorista || "-"}`;
          const capacidad = Number(item.capacidadDiaria || 0);
          const carga = Number(item.arreglosHoy || 0);
          const capacidadPct = capacidad > 0 ? Math.min(100, Math.round((carga / capacidad) * 100)) : 0;
          return (
            <article key={item.idFlorista} className={`production-availability-card ${item.esExterno ? "is-external" : ""}`}>
              <div className="production-availability-head">
                <div>
                  <p className="production-availability-id">{identificador}</p>
                  <strong>{item.nombre}</strong>
                </div>
                <span className={`production-availability-status ${estaActivo ? "is-active" : "is-inactive"}`}>
                  {estaActivo ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="production-availability-meta">
                <p><span>Arreglos del día</span><strong>{item.arreglosHoy || 0}</strong></p>
                <p><span>Capacidad diaria</span><strong>{item.capacidadDiaria || 0}</strong></p>
                <p><span>Tipo</span><strong>{item.esExterno ? "Externo" : "Interno"}</strong></p>
              </div>

              <div className="production-capacity-block">
                <div className="production-capacity-bar">
                  <div className="production-capacity-fill" style={{ width: `${capacidadPct}%` }} />
                </div>
                <span>{carga} / {capacidad || 0}</span>
              </div>

              <div className="production-inline-actions">
                <button
                  type="button"
                  className={`btn-outline production-availability-toggle ${estaActivo ? "is-inactivate" : "is-activate"}`}
                  onClick={() => onToggleDisponibilidadFlorista(item)}
                >
                  {estaActivo ? "Inactivar" : "Activar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ProductionIncapacityPanel({
  floristas,
  floristasDisponibilidad,
  floristaGestionID,
  floristaEstado,
  fechaInicioIncapacidad,
  fechaFinIncapacidad,
  motivoAccion,
  onActualizarEstadoFlorista,
  onFloristaGestionChange,
  onFloristaEstadoChange,
  onFechaInicioChange,
  onFechaFinChange,
  onMotivoChange,
  onClearMotivo,
}) {
  return (
    <section className="order-block production-section-card production-incapacity-panel">
      <div className="production-section-head">
        <div>
          <h4>Gestión incapacidad</h4>
          <p className="production-section-copy">Registra rangos de incapacidad y controla el estado operativo del florista.</p>
        </div>
        <button type="button" className="btn-primary production-register-btn" onClick={onActualizarEstadoFlorista} title="Registrar incapacidad o aplicar cambio">
          <IconCalendarPlus size={15} stroke={2} />
          <span>Registrar incapacidad</span>
        </button>
      </div>

      <div className="production-incapacity-form">
        <select value={floristaGestionID} onChange={event => onFloristaGestionChange(event.target.value)} title="Seleccionar florista">
          <option value="">Florista...</option>
          {floristas.map(f => <option key={f.idFlorista} value={f.idFlorista}>{f.nombre}</option>)}
        </select>
        <select value={floristaEstado} onChange={event => onFloristaEstadoChange(event.target.value)} title="Estado del florista">
          {ESTADOS_FLORISTA.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input type="date" value={fechaInicioIncapacidad} onChange={event => onFechaInicioChange(event.target.value)} title="Inicio incapacidad" />
        <input type="date" value={fechaFinIncapacidad} onChange={event => onFechaFinChange(event.target.value)} title="Fin incapacidad" />
        <input type="text" value={motivoAccion} onChange={event => onMotivoChange(event.target.value)} placeholder="Motivo" title="Motivo de cambio" />
        <div className="production-incapacity-actions">
          <button type="button" className="btn-primary" onClick={onActualizarEstadoFlorista} title="Guardar incapacidad o cambio de estado">Guardar</button>
          <button type="button" className="btn-outline" onClick={onClearMotivo} title="Limpiar motivo">Cancelar</button>
        </div>
      </div>

      <div className="production-incapacity-list">
        {floristasDisponibilidad.map(item => {
          const inicio = formatDateOnly(item.fechaInicioIncapacidad || item.fecha_ini_incap) || "-";
          const fin = formatDateOnly(item.fechaFinIncapacidad || item.fecha_fin_incap) || "-";
          const estado = String(item.estado || "").toLowerCase() === "incapacidad" ? "Activa" : "Vencida";
          return (
            <article key={`inc-${item.idFlorista}`} className="production-incapacity-item">
              <div>
                <strong>{item.nombre}</strong>
                <p>{inicio} - {fin}</p>
                <small>{item.motivoIncapacidad || item.motivo || "Sin motivo registrado"}</small>
              </div>
              <span className={`production-incapacity-badge ${estado === "Activa" ? "is-active" : "is-expired"}`}>{estado}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ProductionLookerPanel() {
  return (
    <section className="order-block looker-block" style={{ marginTop: 12 }}>
      <div className="looker-header">
        <h4> Looker Studio</h4>
        <a
          href={LOOKER_STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          className="btn-outline looker-open-link"
          title="Abrir tablero en nueva pestaña"
        >
          Abrir en nueva pestaña
        </a>
      </div>

      <p className="orders-admin-subtitle looker-subtitle">
        Vista embebida del tablero operativo de Producción.
      </p>

      <div className="looker-frame-wrap">
        <iframe
          className="looker-frame"
          src={LOOKER_STUDIO_URL}
          title="Looker Studio - Producción"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allowFullScreen
        />
      </div>
    </section>
  );
}
