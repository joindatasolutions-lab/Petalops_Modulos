import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  Download,
  Gift,
  Percent,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { formatearCOP } from "../../shared/utils.js";
import {
  CUSTOMER_ATTENTION_PRIORITIES,
  CUSTOMER_MAIN_ATTENTION_PRIORITIES,
  CUSTOMER_SEGMENTS,
  COMMERCIAL_CALENDAR,
  CUSTOMER_METRICS_DATE_PRESETS,
  initialsFromName,
  priorityLabel,
  priorityTone,
  segmentLabel,
} from "./clientsDomain.js";

export function ClientsMetricsView({
  clientsIntelligence,
  itemsCount,
  loading,
  metricsDatePreset = "YEAR",
  metricsDateRange = { startDate: "", endDate: "" },
  metricsLoading = false,
  segmentLoading = false,
  segmentPage = 1,
  segmentPages = 1,
  segmentPagerItems = [],
  segmentTotal = 0,
  segmentVisibleFrom = 0,
  segmentVisibleTo = 0,
  selectedOpportunity = false,
  selectedPriority = "",
  selectedSegment = "",
  segmentItems = [],
  onExport,
  onChangeMetricsDateRange,
  onSegmentPageChange,
  onRefresh,
  onSelectMetricsDatePreset,
  onSelectOpportunities,
  onShowDirectory,
  onSelectPriority,
  onSelectSegment,
  onViewClient,
}) {
  const requestSegmentDetail = segment => {
    onSelectSegment(segment);
    window.setTimeout(() => {
      document.getElementById("clientes-segmentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const requestPriorityDetail = priority => {
    onSelectPriority(priority);
    window.setTimeout(() => {
      document.getElementById("clientes-segmentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const requestOpportunitiesDetail = () => {
    onSelectOpportunities();
    window.setTimeout(() => {
      document.getElementById("clientes-segmentos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const showSegmentsDetail = () => {
    document.getElementById("clientes-segmentos-resumen")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section className="clients-metrics-nav" aria-label="Vistas de metricas">
        <button type="button" className="is-active">Resumen</button>
        <button type="button" onClick={onShowDirectory}>Directorio</button>
        <button type="button" onClick={showSegmentsDetail}>Segmentos</button>
      </section>

      <section className="clients-table-toolbar clients-metrics-toolbar" aria-label="Acciones de metricas">
        <div className="clients-date-filters" aria-label="Filtros de fechas de metricas">
          <div className="clients-period-control">
            <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
            <div className="clients-date-presets">
              {CUSTOMER_METRICS_DATE_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  className={metricsDatePreset === preset.key ? "is-active" : ""}
                  onClick={() => onSelectMetricsDatePreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="clients-custom-date-range">
            <label>
              <span>Desde</span>
              <input
                type="date"
                value={metricsDateRange.startDate || ""}
                onChange={event => onChangeMetricsDateRange("startDate", event.target.value)}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={metricsDateRange.endDate || ""}
                onChange={event => onChangeMetricsDateRange("endDate", event.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="clients-metrics-toolbar-actions">
          <button type="button" className="btn-outline clients-refresh-btn" onClick={onRefresh} disabled={loading || metricsLoading}>
            <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
            <span>{metricsLoading ? "Actualizando..." : "Actualizar"}</span>
          </button>
          <button type="button" className="btn-outline clients-download-btn" onClick={onExport} disabled={loading || itemsCount === 0}>
            <Download size={17} strokeWidth={2} aria-hidden="true" />
            <span>Descargar</span>
          </button>
        </div>
      </section>
      <ClientsKpiStrip metrics={clientsIntelligence} onSelectSegment={requestSegmentDetail} />
      <section className="clients-summary-layout" aria-label="Resumen de base e ingresos">
        <ClientsBasePanel metrics={clientsIntelligence} onSelectSegment={requestSegmentDetail} />
        <ClientsRecurringRevenuePanel metrics={clientsIntelligence} />
      </section>
      <ClientsAttentionPanel metrics={clientsIntelligence} onSelectPriority={requestPriorityDetail} />
      <section className="clients-bottom-layout" aria-label="Clientes VIP y oportunidades">
        <ClientsVipPanel
          metrics={clientsIntelligence}
          selectedSegment={selectedSegment}
          segmentItems={segmentItems}
          onSelectSegment={requestSegmentDetail}
        />
        <ClientsOpportunitiesPanel metrics={clientsIntelligence} onSelectOpportunities={requestOpportunitiesDetail} />
      </section>
      <ClientsSegmentsOverview metrics={clientsIntelligence} onSelectSegment={requestSegmentDetail} />
      {selectedSegment ? (
        <ClientsSegmentExplorer
          detailType="segment"
          selectedSegment={selectedSegment}
          selectedPriority=""
          loading={segmentLoading}
          items={segmentItems}
          page={segmentPage}
          pages={segmentPages}
          pagerItems={segmentPagerItems}
          total={segmentTotal}
          visibleFrom={segmentVisibleFrom}
          visibleTo={segmentVisibleTo}
          onPageChange={onSegmentPageChange}
          onSelectSegment={requestSegmentDetail}
          onViewClient={onViewClient}
        />
      ) : null}
      {selectedPriority ? (
        <ClientsSegmentExplorer
          detailType="priority"
          selectedSegment=""
          selectedPriority={selectedPriority}
          loading={segmentLoading}
          items={segmentItems}
          page={segmentPage}
          pages={segmentPages}
          pagerItems={segmentPagerItems}
          total={segmentTotal}
          visibleFrom={segmentVisibleFrom}
          visibleTo={segmentVisibleTo}
          onPageChange={onSegmentPageChange}
          onSelectSegment={requestSegmentDetail}
          onViewClient={onViewClient}
        />
      ) : null}
      {selectedOpportunity ? (
        <ClientsSegmentExplorer
          detailType="opportunity"
          selectedSegment=""
          selectedPriority=""
          loading={segmentLoading}
          items={segmentItems}
          page={segmentPage}
          pages={segmentPages}
          pagerItems={segmentPagerItems}
          total={segmentTotal}
          visibleFrom={segmentVisibleFrom}
          visibleTo={segmentVisibleTo}
          onPageChange={onSegmentPageChange}
          onSelectSegment={requestSegmentDetail}
          onViewClient={onViewClient}
        />
      ) : null}
      <section className="clients-intelligence-grid clients-directory-grid" aria-label="Calidad de directorio">
        <ClientsQualityPanel rows={clientsIntelligence.qualityRows} />
        <ClientsDocumentPanel clientsIntelligence={clientsIntelligence} />
        <ClientsIndicativePanel rows={clientsIntelligence.indicativeRows} />
        <ClientsInsightPanel clientsIntelligence={clientsIntelligence} />
      </section>
    </>
  );
}

function ClientsKpiStrip({ metrics, onSelectSegment }) {
  const cards = [
    { key: "customers", label: "Clientes", value: formatearCOP(metrics.total), tone: "is-primary", Icon: UsersRound, segment: "ACTIVE" },
    { key: "buyers", label: "Compradores", value: formatearCOP(metrics.buyers ?? 0), tone: "is-green", Icon: ShoppingCart, segment: "ACTIVE" },
    { key: "recurring", label: "Recurrentes", value: formatearCOP(metrics.recurrentes ?? 0), tone: "is-purple", Icon: RefreshCw, segment: "RECURRING" },
    { key: "repeat", label: "Tasa de recompra", value: `${metrics.repeatRate ?? 0}%`, tone: "is-blue", Icon: Percent, segment: "RECURRING" },
    { key: "aov", label: "Ticket promedio", value: `$${formatearCOP(metrics.averageOrderValue)}`, tone: "is-orange", Icon: Tag, segment: "HIGH_VALUE" },
    { key: "risk", label: "En riesgo", value: formatearCOP(metrics.highChurnRiskCustomers ?? metrics.atRisk ?? 0), tone: "is-danger", Icon: ShieldAlert, segment: "AT_RISK" },
  ];
  return (
    <section className="clients-kpi-strip" aria-label="Indicadores principales de clientes">
      {cards.map(card => (
        <article key={card.key} className={`clients-kpi-card ${card.tone}`}>
          <span className="clients-kpi-icon" aria-hidden="true"><card.Icon size={19} strokeWidth={2} /></span>
          <div>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <button type="button" onClick={() => onSelectSegment(card.segment)}>
              Ver clientes <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function ClientsBasePanel({ metrics, onSelectSegment }) {
  const total = Math.max(Number(metrics.total || 0), 1);
  const buyers = Number(metrics.buyers || 0);
  const recurring = Number(metrics.recurrentes || 0);
  const nonBuyers = Number(metrics.nonBuyers || Math.max(Number(metrics.total || 0) - buyers, 0));
  const rows = [
    { key: "total", label: "clientes", value: Number(metrics.total || 0), pct: 100, tone: "is-primary" },
    { key: "buyers", label: "compradores", value: buyers, pct: Math.round((buyers / total) * 100), tone: "is-green" },
    { key: "recurring", label: "recurrentes", value: recurring, pct: Math.round((recurring / total) * 100), tone: "is-purple" },
    { key: "nonBuyers", label: "sin compras", value: nonBuyers, pct: Math.round((nonBuyers / total) * 100), tone: "is-muted" },
  ];
  return (
    <article className="clients-dashboard-panel clients-base-panel">
      <PanelTitle title="Tu base de clientes" />
      <div className="clients-base-content">
        <div className="clients-base-total">
          <strong>{formatearCOP(metrics.total)}</strong>
          <span>clientes</span>
        </div>
        <div className="clients-base-bars">
          {rows.map(row => (
            <div key={row.key} className={`clients-base-row ${row.tone}`}>
              <span style={{ width: `${Math.max(row.pct, 7)}%` }}>
                <strong>{formatearCOP(row.value)}</strong>
                <em>{row.label}</em>
              </span>
              <b>{row.pct}%</b>
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="clients-panel-action" onClick={() => onSelectSegment("ACTIVE")}>
        Explorar base de clientes <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </article>
  );
}

function ClientsRecurringRevenuePanel({ metrics }) {
  const pct = Math.max(0, Math.min(100, Number(metrics.recurringRevenuePercentage || 0)));
  return (
    <article className="clients-dashboard-panel clients-revenue-panel">
      <PanelTitle title="Ingresos recurrentes" />
      <div className="clients-revenue-content">
        <div className="clients-revenue-ring" style={{ "--clients-ring": `${pct}%` }}>
          <strong>{pct}%</strong>
        </div>
        <div className="clients-revenue-copy">
          <p>de tus ventas vienen de clientes recurrentes</p>
          <span>Ingresos recurrentes</span>
          <strong>${formatearCOP(metrics.lifetimeRevenue || metrics.totalRevenue)}</strong>
        </div>
        <div className="clients-revenue-line" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => <i key={index} style={{ height: `${28 + ((index * 13) % 40)}%` }} />)}
        </div>
      </div>
      <button type="button" className="clients-panel-action is-purple">
        Ver analisis de ingresos <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </article>
  );
}

function ClientsAttentionPanel({ metrics, onSelectPriority }) {
  const priorities = Array.isArray(metrics.priorities) ? metrics.priorities : [];
  const byCode = priorities.reduce((map, item) => ({ ...map, [item.code]: item }), {});
  const mainCards = CUSTOMER_MAIN_ATTENTION_PRIORITIES.map(code => byCode[code] || { code, count: 0, historicalValue: 0, label: priorityLabel(code), tone: priorityTone(code) });
  const secondaryCards = CUSTOMER_ATTENTION_PRIORITIES
    .filter(code => !CUSTOMER_MAIN_ATTENTION_PRIORITIES.includes(code))
    .map(code => byCode[code] || { code, count: 0, historicalValue: 0, label: priorityLabel(code), tone: priorityTone(code) });
  const copyByCode = {
    P0: "Clientes de alto valor que podrían no volver.",
    P1: "Clientes de alto valor con señales de riesgo.",
    P2: "Su frecuencia de compra está empeorando.",
  };
  const titleByCode = {
    P0: "Prioridad crítica",
    P1: "Alta prioridad",
    P2: "En riesgo",
  };
  return (
    <section className="clients-dashboard-panel clients-attention-panel" aria-label="Clientes que requieren atencion">
      <PanelTitle title="Clientes que requieren atencion" />
      <div className="clients-attention-grid">
        {mainCards.map(card => (
          <article key={card.code} className={`clients-attention-card ${card.tone}`}>
            <ShieldAlert size={26} strokeWidth={2} aria-hidden="true" />
            <div>
              <strong>{titleByCode[card.code]}</strong>
              <span>{formatearCOP(card.count)} {card.label}</span>
              {card.historicalValue ? <b>${formatearCOP(card.historicalValue)} de valor histórico</b> : null}
              <p>{card.description || copyByCode[card.code]}</p>
              <button type="button" onClick={() => onSelectPriority(card.code)}>
                Ver clientes <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="clients-attention-secondary">
        {secondaryCards.map(card => (
          <button key={card.code} type="button" className={`clients-priority-mini ${card.tone}`} onClick={() => onSelectPriority(card.code)}>
            <span>{card.code}</span>
            <strong>{card.label}</strong>
            <em>{formatearCOP(card.count)} clientes</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function ClientsVipPanel({ metrics, selectedSegment, segmentItems, onSelectSegment }) {
  const rows = selectedSegment === "VIP" ? segmentItems.slice(0, 3) : [];
  return (
    <article className="clients-dashboard-panel clients-vip-panel">
      <PanelTitle title="Clientes VIP" />
      <div className="clients-vip-content">
        <div className="clients-vip-total">
          <Crown size={32} strokeWidth={2} aria-hidden="true" />
          <strong>{formatearCOP(metrics.vipCustomers || 0)}</strong>
          <span>clientes VIP</span>
        </div>
        {rows.length > 0 ? (
          <div className="clients-vip-list">
            {rows.map((item, index) => (
            <div key={`${item.customerId}-${index}`} className="clients-vip-row">
              <span>{index + 1}</span>
              <strong>{item.name}</strong>
              <b>${formatearCOP(item.totalSpent)}</b>
            </div>
            ))}
          </div>
        ) : (
          <p className="clients-vip-copy">Clientes marcados como VIP por historial de compra.</p>
        )}
      </div>
      <button type="button" className="clients-panel-action is-purple" onClick={() => onSelectSegment("VIP")}>
        Ver clientes VIP <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </article>
  );
}

function ClientsOpportunitiesPanel({ metrics, onSelectOpportunities }) {
  const next30 = Number(metrics.specialDatesNext30d || 0);
  return (
    <article className="clients-dashboard-panel clients-opportunities-panel">
      <PanelTitle title="Oportunidades por fechas especiales" />
      <div className="clients-opportunity-grid">
        <div className="is-pink"><Gift size={24} strokeWidth={2} aria-hidden="true" /><span>Proximos 30 dias</span><strong>{formatearCOP(next30)}</strong></div>
        <div className="is-purple"><CalendarDays size={24} strokeWidth={2} aria-hidden="true" /><span>Sin fecha especial</span><strong>{formatearCOP(Math.max(Number(metrics.total || 0) - next30, 0))}</strong></div>
      </div>
      <button type="button" className="clients-panel-action" onClick={onSelectOpportunities}>
        Ver oportunidades <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className="clients-commercial-calendar" aria-label="Calendario comercial fijo">
        {COMMERCIAL_CALENDAR.map(campaign => (
          <article key={campaign.code} className={`clients-commercial-calendar-card is-month-${campaign.month}`}>
            <span>{monthLabel(campaign.month)}</span>
            <strong>{campaign.label}</strong>
            <p>{campaign.description}</p>
            <em>{campaign.focus}</em>
          </article>
        ))}
      </div>
    </article>
  );
}

function monthLabel(month) {
  const labels = {
    2: "Febrero",
    5: "Mayo",
    9: "Septiembre",
  };
  return labels[month] || `Mes ${month}`;
}

function ClientsSegmentsOverview({ metrics, onSelectSegment }) {
  const cards = [
    { key: "NEW", name: "Nuevos", count: metrics.nuevos ?? 0, description: "Hicieron su primera compra en el periodo." },
    { key: "ACTIVE", name: "Activos", count: metrics.activos ?? 0, description: "Mantienen actividad reciente." },
    { key: "RECURRING", name: "Recurrentes", count: metrics.recurrentes ?? 0, description: "Compran más de una vez." },
    { key: "VIP", name: "VIP", count: metrics.vipCustomers ?? 0, description: "Marcados como VIP por historial de compra." },
    { key: "AT_RISK", name: "En riesgo", count: metrics.highChurnRiskCustomers ?? metrics.atRisk ?? 0, description: "Muestran señales de posible abandono." },
    { key: "INACTIVE", name: "Inactivos", count: metrics.inactivos ?? 0, description: "No han comprado recientemente." },
    { key: "HIGH_VALUE", name: "Alto valor", count: metrics.highValueCustomers ?? 0, description: "Tienen alto gasto acumulado." },
  ];
  return (
    <section id="clientes-segmentos-resumen" className="clients-dashboard-panel clients-segments-overview" aria-label="Vista de segmentos">
      <PanelTitle title="Segmentos" />
      <div className="clients-segments-card-grid">
        {cards.map(card => (
          <article key={card.key} className={`clients-segment-summary-card is-${card.key.toLowerCase().replace(/_/g, "-")}`}>
            <strong>{card.name}</strong>
            <span>{formatearCOP(card.count)}</span>
            <p>{card.description}</p>
            <button type="button" onClick={() => onSelectSegment(card.key)}>
              Ver clientes <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientsSegmentExplorer({
  detailType,
  selectedSegment,
  selectedPriority,
  loading,
  items,
  page,
  pages,
  pagerItems,
  total,
  visibleFrom,
  visibleTo,
  onPageChange,
  onSelectSegment,
  onViewClient,
}) {
  const title = detailType === "priority"
    ? `Clientes con prioridad ${selectedPriority}`
    : detailType === "opportunity"
      ? "Oportunidades por fechas especiales"
      : `Clientes ${segmentLabel(selectedSegment).toLowerCase()}`;
  return (
    <section id="clientes-segmentos" className="clients-segment-panel" aria-label="Clientes por segmento">
      <div className="clients-segment-panel-head">
        <div>
          <span>{detailType === "priority" ? "Prioridad comercial" : detailType === "opportunity" ? "Oportunidades" : "Segmento"}</span>
          <h3>{title}</h3>
        </div>
        {detailType === "priority" ? (
          <span className={`clients-priority-badge ${priorityTone(selectedPriority)}`}>{selectedPriority}</span>
        ) : null}
      </div>
      {detailType === "segment" ? (
        <div className="clients-segment-tabs">
          {CUSTOMER_SEGMENTS.map(segment => (
            <button
              key={segment.key}
              type="button"
              className={selectedSegment === segment.key ? "is-active" : ""}
              onClick={() => onSelectSegment(segment.key)}
            >
              {segment.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="clients-segment-table-wrap">
        <table className="orders-table clients-segment-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Segmentos</th>
              <th>Prioridad</th>
              <th>Última compra</th>
              <th>Días sin comprar</th>
              <th>Compras</th>
              <th>Total gastado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}>Cargando clientes...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8}>No hay clientes para este filtro.</td></tr>
            ) : items.map(item => (
              <tr key={`${item.customerId}-${item.name}`}>
                <td data-label="Cliente">{item.name}</td>
                <td data-label="Segmentos"><SegmentBadges segments={item.segments} /></td>
                <td data-label="Prioridad"><PriorityBadge priority={item.priority || selectedPriority} label={item.priorityLabel} /></td>
                <td data-label="Última compra">{formatClientDate(item.lastPurchaseAt) || "-"}</td>
                <td data-label="Días sin comprar">{item.daysSinceLastPurchase != null ? `${item.daysSinceLastPurchase} días` : "-"}</td>
                <td data-label="Compras">{item.purchaseCount}</td>
                <td data-label="Total gastado">${formatearCOP(item.totalSpent)}</td>
                <td data-label="Acción">
                  <button type="button" className="clients-table-action" onClick={() => onViewClient?.({ clienteID: item.clienteID, nombreCompleto: item.name })}>
                    Ver cliente
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SegmentPager
        total={total}
        visibleFrom={visibleFrom}
        visibleTo={visibleTo}
        page={page}
        pages={pages}
        pagerItems={pagerItems}
        onPageChange={onPageChange}
      />
    </section>
  );
}

function SegmentBadges({ segments }) {
  if (!Array.isArray(segments) || segments.length === 0) return <span>-</span>;
  return (
    <div className="clients-segment-badges">
      {segments.map(segment => (
        <span key={segment} className={`clients-segment-badge is-${String(segment).toLowerCase().replace(/_/g, "-")}`}>
          {segmentLabel(segment)}
        </span>
      ))}
    </div>
  );
}

function PriorityBadge({ priority, label }) {
  const code = String(priority || "").trim().toUpperCase();
  if (!code) return <span>-</span>;
  return (
    <span className={`clients-priority-badge ${priorityTone(code)}`}>
      <b>{code}</b>
      {label ? <em>{label}</em> : null}
    </span>
  );
}

function formatClientDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text.slice(0, 10);
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    .format(parsed)
    .replace(".", "");
}

function SegmentPager({ total, visibleFrom, visibleTo, page, pages, pagerItems, onPageChange }) {
  if (total <= 0 || pages <= 1) return null;

  return (
    <footer className="records-pager clients-segment-pager" aria-label="Paginacion de segmento de clientes">
      <p>Mostrando {visibleFrom} a {visibleTo} de {total} clientes</p>
      <nav className="records-pager-pages" aria-label="Paginas del segmento">
        <button
          type="button"
          className="records-pager-arrow"
          title="Ir a la pagina anterior"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
        {pagerItems.map(item => (
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              className={`records-pager-page${item === page ? " is-active" : ""}`}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="records-pager-ellipsis">...</span>
          )
        ))}
        <button
          type="button"
          className="records-pager-arrow"
          title="Ir a la pagina siguiente"
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page >= pages}
        >
          <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}

function PanelTitle({ title }) {
  return (
    <div className="clients-dashboard-panel-title">
      <h3>{title}</h3>
      <span aria-hidden="true">i</span>
    </div>
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
