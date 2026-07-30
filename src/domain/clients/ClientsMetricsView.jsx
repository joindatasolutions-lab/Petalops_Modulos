import { BadgeCheck, Download, Sparkles, TrendingUp, UsersRound } from "lucide-react";
import { initialsFromName } from "./clientsDomain.js";
export function ClientsMetricsView({ clientsIntelligence, itemsCount, loading, onExport }) {
  return (
    <>
      <section className="clients-table-toolbar clients-metrics-toolbar" aria-label="Acciones de metricas">
        <div className="clients-table-toolbar-copy">
          <span className="clients-table-toolbar-label">Business intelligence</span>
          <strong>Descarga el resumen de metricas del directorio</strong>
        </div>
        <button type="button" className="btn-outline clients-download-btn" onClick={onExport} disabled={loading || itemsCount === 0}>
          <Download size={17} strokeWidth={2} aria-hidden="true" />
          <span>Descargar metricas</span>
        </button>
      </section>
      <section className="clients-intelligence-grid" aria-label="Business intelligence de clientes">
        <ClientsQualityPanel rows={clientsIntelligence.qualityRows} />
        <ClientsDocumentPanel clientsIntelligence={clientsIntelligence} />
        <ClientsIndicativePanel rows={clientsIntelligence.indicativeRows} />
        <ClientsInsightPanel clientsIntelligence={clientsIntelligence} />
      </section>
    </>
  );
}
function ClientsQualityPanel({ rows }) {
  return (
    <article className="clients-intelligence-panel clients-quality-panel">
      <PanelHead eyebrow="Calidad del directorio" title="Datos que si permiten accionar" Icon={Sparkles} />
      <div className="clients-quality-bars">
        {rows.map(row => (
          <div key={row.key} className="clients-quality-row" style={{ "--client-row-color": row.color }}>
            <div><strong>{row.label}</strong><span>{row.value} clientes</span></div>
            <i><b style={{ width: `${row.pct}%` }} /></i>
            <em>{row.pct}%</em>
          </div>
        ))}
      </div>
    </article>
  );
}
function ClientsDocumentPanel({ clientsIntelligence }) {
  return (
    <article className="clients-intelligence-panel clients-document-panel">
      <PanelHead eyebrow="Segmentacion" title="Tipos de documento" Icon={TrendingUp} />
      <div className="clients-donut-wrap">
        <div className="clients-donut" style={{ "--client-active": `${clientsIntelligence.activosPct}%`, "--client-email": `${clientsIntelligence.emailPct}%` }}>
          <strong>{clientsIntelligence.activosPct}%</strong>
          <span>activos</span>
        </div>
        <div className="clients-document-list">
          {clientsIntelligence.documentRows.length === 0 ? (
            <p className="accounting-empty-state">No hay datos para segmentar.</p>
          ) : clientsIntelligence.documentRows.map(row => (
            <div key={row.key} className="clients-document-row">
              <span>{row.label}</span><strong>{row.value}</strong><i><b style={{ width: `${row.pct}%` }} /></i>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
function ClientsIndicativePanel({ rows }) {
  return (
    <article className="clients-intelligence-panel clients-geo-panel">
      <PanelHead eyebrow="Origen telefonico" title="Indicativos mas usados" Icon={UsersRound} />
      <div className="clients-pills-chart">
        {rows.length === 0 ? (
          <p className="accounting-empty-state">No hay telefonos registrados.</p>
        ) : rows.map((row, index) => (
          <div key={row.key} className="clients-pill-row" style={{ "--client-index": index }}>
            <span>{row.label}</span><strong>{row.value}</strong><i style={{ width: `${Math.max(row.pct, 8)}%` }} />
          </div>
        ))}
      </div>
    </article>
  );
}
function ClientsInsightPanel({ clientsIntelligence }) {
  return (
    <article className="clients-intelligence-panel clients-insight-panel">
      <PanelHead eyebrow="Lectura rapida" title="Prioridad operativa" Icon={BadgeCheck} />
      <div className="clients-insight-copy">
        <strong>{clientsIntelligence.topMissing?.label || "Base equilibrada"}</strong>
        <p>{clientsIntelligence.topMissing?.value
          ? `${clientsIntelligence.topMissing.value} clientes requieren completar este dato para mejorar campanas, confirmaciones y seguimiento.`
          : "La base visible esta completa para los campos principales."}</p>
      </div>
      <div className="clients-mini-list">
        {clientsIntelligence.destacados.length === 0 ? (
          <p className="accounting-empty-state">No hay clientes visibles.</p>
        ) : clientsIntelligence.destacados.map(item => (
          <div key={item.clienteID} className="clients-mini-item">
            <span>{initialsFromName(item.nombreCompleto)}</span>
            <div><strong>{item.nombreCompleto || "Cliente sin nombre"}</strong><small>{item.telefonoCompleto || item.telefono || item.email || "Sin contacto"}</small></div>
          </div>
        ))}
      </div>
    </article>
  );
}
function PanelHead({ eyebrow, title, Icon }) {
  return (
    <div className="clients-panel-head">
      <div><span>{eyebrow}</span><h3>{title}</h3></div>
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
    </div>
  );
}
