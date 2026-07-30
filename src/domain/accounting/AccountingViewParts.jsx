import { formatearCOP } from "../../shared/utils.js";
export function AccountingSalesTooltip({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="accounting-sales-tooltip">
      <strong>{label}</strong>
      <span>${formatearCOP(row.value || 0)}</span>
      <small>{Number(row.pedidos || 0)} pedidos</small>
    </div>
  );
}
export function AccountingRanking({ title, rows, valueField, labelField, isMoney = false }) {
  const maxValue = Math.max(...rows.map(row => Number(row?.[valueField] || 0)), 0);
  return (
    <section className="accounting-ranking-card">
      <h4>{title}</h4>
      <div className="accounting-ranking-list">
        {rows.length === 0 ? (
          <p className="accounting-empty-state">Sin datos.</p>
        ) : rows.map((row, index) => {
          const value = Number(row?.[valueField] || 0);
          const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 8) : 0;
          const label = String(row?.[labelField] || "Sin nombre");
          return (
            <article key={`${title}-${row.key || label}-${index}`} className="accounting-ranking-item">
              <span className="accounting-ranking-avatar">{label.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{index + 1}. {label}</strong>
                <i><b style={{ width: `${width}%` }} /></i>
              </div>
              <small>{isMoney ? `$${formatearCOP(value)}` : value}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function renderBarChartRows(rows, field, isMoney = false, labelField = "nombre") {
  const maxValue = Math.max(...rows.map(item => Number(item?.[field] || 0)), 0);
  return rows.map(item => {
    const value = Number(item?.[field] || 0);
    const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
    return (
      <div key={`${field}-${item.key}`} className="accounting-bar-row">
        <div className="accounting-bar-row-head">
          <strong>{item[labelField]}</strong>
          <span>{isMoney ? `$${formatearCOP(value)}` : value}</span>
        </div>
        <div className="accounting-bar-track">
          <div className="accounting-bar-fill" style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  });
}