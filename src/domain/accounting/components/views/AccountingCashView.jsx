import { useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Banknote, Calculator, CheckCircle2, CircleAlert, Coins,
  Eye, Landmark, ListChecks, LockKeyhole, Plus, Receipt, Save, Trash2, WalletCards, X,
} from "lucide-react";

import { formatearCOP } from "../../../../shared/utils.js";
import { parseMoneyInput, roundMoney } from "../../accountingDomain.js";

const CASH_DENOMINATIONS = [
  { value: 100000, label: "Billete de $100.000", kind: "note" },
  { value: 50000, label: "Billete de $50.000", kind: "note" },
  { value: 20000, label: "Billete de $20.000", kind: "note" },
  { value: 10000, label: "Billete de $10.000", kind: "note" },
  { value: 5000, label: "Billete de $5.000", kind: "note" },
  { value: 2000, label: "Billete de $2.000", kind: "note" },
  { value: 1000, label: "Moneda de $1.000", kind: "coin" },
  { value: 500, label: "Moneda de $500", kind: "coin" },
  { value: 200, label: "Moneda de $200", kind: "coin" },
  { value: 100, label: "Moneda de $100", kind: "coin" },
  { value: 50, label: "Moneda de $50", kind: "coin" },
];

function formatCashDate(value) {
  if (!value) return "la fecha seleccionada";
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

function CashKpi({ icon: Icon, label, value, tone }) {
  return (
    <article className={`cash-workspace-kpi is-${tone}`}>
      <span className="cash-workspace-kpi-icon" aria-hidden="true"><Icon size={22} strokeWidth={2.2} /></span>
      <span><small>{label}</small><strong>${formatearCOP(value)}</strong></span>
    </article>
  );
}

export function AccountingCashView({
  activeView, canEditCashClosing, cashDashboardTotals, cashExpenses, cashExpensesLoading,
  cashExpenseSaving, cashForm, cashHistoryRows, cashLoading, createCashExpense,
  efectivoValue, exportCaja, nuevaBaseValue, saveCashClosing, saving, setCashForm,
  todayCashDate, totalEfectivoCaja,
}) {
  const [denominationCounts, setDenominationCounts] = useState({});
  const [activeSection, setActiveSection] = useState("cierre");
  const [expandedHistoryDate, setExpandedHistoryDate] = useState("");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ concepto: "", descripcion: "", monto: "" });
  const closeRef = useRef(null);
  const countRef = useRef(null);
  const historyRef = useRef(null);
  const expensesRef = useRef(null);
  const pettyCashRef = useRef(null);

  const totalContadoValue = parseMoneyInput(cashForm.totalContado);
  const hasTotalContado = String(cashForm.totalContado ?? "").trim() !== "";
  const diferenciaCaja = hasTotalContado ? roundMoney(totalContadoValue - totalEfectivoCaja) : 0;
  const sobranteValue = Math.max(diferenciaCaja, 0);
  const faltanteValue = Math.max(-diferenciaCaja, 0);
  const balanceDifference = cashDashboardTotals.sobrante || -cashDashboardTotals.faltante || 0;

  const denominationTotal = useMemo(() => CASH_DENOMINATIONS.reduce(
    (total, item) => total + item.value * Number(denominationCounts[item.value] || 0), 0,
  ), [denominationCounts]);

  const updateDenomination = (value, rawQuantity) => {
    const quantity = Math.max(0, Math.trunc(Number(rawQuantity) || 0));
    const nextCounts = { ...denominationCounts, [value]: quantity };
    const nextTotal = CASH_DENOMINATIONS.reduce(
      (total, item) => total + item.value * Number(nextCounts[item.value] || 0), 0,
    );
    setDenominationCounts(nextCounts);
    setCashForm(current => ({ ...current, totalContado: String(nextTotal) }));
  };

  const clearCount = () => {
    setDenominationCounts({});
    setCashForm(current => ({ ...current, totalContado: "" }));
  };

  const navigateTo = (section) => {
    const refs = { cierre: closeRef, movimientos: expensesRef, arqueo: countRef, cajaMenor: pettyCashRef };
    setActiveSection(section);
    refs[section]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitExpense = async event => {
    event.preventDefault();
    const saved = await createCashExpense(expenseForm);
    if (!saved) return;
    setExpenseForm({ concepto: "", descripcion: "", monto: "" });
    setExpenseModalOpen(false);
  };

  if (activeView !== "caja") return null;

  return (
    <section className="cash-workspace">
      <section className="cash-balance-card">
        <div className="cash-balance-head">
          <div><h2>Balance del dia</h2><p>Resumen de la caja al {formatCashDate(cashForm.fecha)}</p></div>
          <div className={`cash-balance-status ${balanceDifference === 0 ? "is-ok" : "is-risk"}`}>
            {balanceDifference === 0 ? <CheckCircle2 size={20} aria-hidden="true" /> : <CircleAlert size={20} aria-hidden="true" />}
            <strong>{balanceDifference === 0 ? "Cuadre correcto" : balanceDifference > 0 ? "Sobrante" : "Faltante"}</strong>
            <span>Diferencia</span><b>${formatearCOP(Math.abs(balanceDifference))}</b>
          </div>
        </div>
        <div className="cash-workspace-kpis">
          <CashKpi icon={WalletCards} label="Base inicial" value={cashDashboardTotals.base} tone="pink" />
          <CashKpi icon={ArrowUp} label="Ingresos en efectivo" value={cashDashboardTotals.efectivo} tone="green" />
          <CashKpi icon={ArrowDown} label="Gastos en efectivo" value={cashDashboardTotals.gasto} tone="red" />
          <CashKpi icon={Calculator} label="Total efectivo esperado" value={cashDashboardTotals.totalEfectivo} tone="blue" />
          <CashKpi icon={Coins} label="Total contado (arqueo)" value={cashDashboardTotals.totalContado} tone="purple" />
        </div>
      </section>

      <nav className="cash-section-tabs" aria-label="Secciones de caja">
        <button type="button" className={activeSection === "cierre" ? "is-active" : ""} onClick={() => navigateTo("cierre")}><LockKeyhole size={17} />Cierre de caja</button>
        <button type="button" className={activeSection === "movimientos" ? "is-active" : ""} onClick={() => navigateTo("movimientos")}><ListChecks size={17} />Movimientos</button>
        <button type="button" className={activeSection === "arqueo" ? "is-active" : ""} onClick={() => navigateTo("arqueo")}><Coins size={17} />Arqueo de efectivo</button>
        <button type="button" className={activeSection === "cajaMenor" ? "is-active" : ""} onClick={() => navigateTo("cajaMenor")}><Landmark size={17} />Caja menor</button>
      </nav>

      <div className="cash-closing-layout">
        <section className="cash-closing-form" ref={closeRef}>
          <div className="cash-form-grid">
            <label>Fecha de cierre<input type="date" max={todayCashDate} value={cashForm.fecha} onChange={event => setCashForm(current => ({ ...current, fecha: event.target.value }))} /></label>
            <label>Total efectivo esperado<input type="text" value={`$ ${formatearCOP(totalEfectivoCaja)}`} readOnly /></label>
            <label>Base inicial<input type="number" min="0" step="0.01" value={cashForm.base} onChange={event => setCashForm(current => ({ ...current, base: event.target.value }))} disabled={!canEditCashClosing} /></label>
            <label>Total contado (arqueo)<input type="text" value={hasTotalContado ? `$ ${formatearCOP(totalContadoValue)}` : "Pendiente de conteo"} readOnly /></label>
            <label>Ingresos en efectivo<input type="text" value={`$ ${formatearCOP(efectivoValue)}`} readOnly /></label>
            <label>Diferencia<input className={diferenciaCaja === 0 ? "is-balanced" : "is-difference"} type="text" value={`${diferenciaCaja < 0 ? "-" : ""}$ ${formatearCOP(Math.abs(diferenciaCaja))}`} readOnly /></label>
            <label>Gastos en efectivo<span className="cash-expense-input-row"><input type="text" value={`$ ${formatearCOP(parseMoneyInput(cashForm.gasto))}`} readOnly /><button type="button" className="btn-outline" onClick={() => setExpenseModalOpen(true)} disabled={!canEditCashClosing}><Plus size={16} />Agregar gasto</button></span></label>
            <label ref={pettyCashRef}>Caja menor<input type="number" min="0" step="0.01" value={cashForm.guardado} onChange={event => setCashForm(current => ({ ...current, guardado: event.target.value }))} disabled={!canEditCashClosing} /></label>
            <label>Nueva base<input type="text" value={`$ ${formatearCOP(nuevaBaseValue)}`} readOnly /></label>
            <label>Resultado del arqueo<input type="text" value={faltanteValue > 0 ? `Faltante: $ ${formatearCOP(faltanteValue)}` : sobranteValue > 0 ? `Sobrante: $ ${formatearCOP(sobranteValue)}` : "Caja cuadrada"} readOnly /></label>
            <label className="cash-observation-field">Observacion del cierre<textarea value={cashForm.observacion} onChange={event => setCashForm(current => ({ ...current, observacion: event.target.value }))} placeholder="Observacion del cierre" disabled={!canEditCashClosing} /></label>
          </div>
          <div className="cash-form-actions"><button type="button" className="btn-primary" onClick={saveCashClosing} disabled={saving || !canEditCashClosing}><Save size={17} aria-hidden="true" />{saving ? "Guardando..." : "Guardar cierre"}</button></div>
        </section>

        <aside className="cash-count-panel" ref={countRef}>
          <div className="cash-count-head"><div><h3>Arqueo de billetes y monedas</h3><p>Ingrese la cantidad fisica contada.</p></div><Banknote size={22} aria-hidden="true" /></div>
          <div className="cash-count-table-head"><span>Denominacion</span><span>Cantidad</span><span>Subtotal</span></div>
          <div className="cash-denomination-list">
            {CASH_DENOMINATIONS.map(item => {
              const quantity = Number(denominationCounts[item.value] || 0);
              return (
                <label key={item.value} className="cash-denomination-row">
                  <span className={`cash-denomination-icon is-${item.kind}`} aria-hidden="true">{item.kind === "coin" ? <Coins size={17} /> : <Banknote size={18} />}</span>
                  <span>{item.label}</span>
                  <input type="number" min="0" step="1" inputMode="numeric" value={quantity} onChange={event => updateDenomination(item.value, event.target.value)} disabled={!canEditCashClosing} aria-label={`Cantidad de ${item.label}`} />
                  <strong>$ {formatearCOP(item.value * quantity)}</strong>
                </label>
              );
            })}
          </div>
          <div className="cash-count-total"><span>Total contado</span><strong>$ {formatearCOP(denominationTotal || totalContadoValue)}</strong></div>
          <button type="button" className="btn-outline cash-clear-count" onClick={clearCount} disabled={!canEditCashClosing || (!hasTotalContado && denominationTotal === 0)}><Trash2 size={16} />Limpiar conteo</button>
        </aside>
      </div>

      <section className="cash-expenses-card" ref={expensesRef}>
        <div className="cash-history-head">
          <div><h3>Movimientos de gastos</h3><p>Gastos pagados en efectivo para el {formatCashDate(cashForm.fecha)}.</p></div>
          <button type="button" className="btn-outline" onClick={() => setExpenseModalOpen(true)} disabled={!canEditCashClosing}><Plus size={16} />Agregar gasto</button>
        </div>
        <div className="cash-expense-list">
          {cashExpensesLoading ? <p>Cargando gastos...</p> : cashExpenses.length === 0 ? <p>No hay gastos registrados para esta fecha.</p> : cashExpenses.map(item => (
            <article key={item.id} className="cash-expense-item">
              <span className="cash-expense-icon" aria-hidden="true"><Receipt size={18} /></span>
              <span><strong>{item.concepto}</strong><small>{item.descripcion || "Sin descripcion"}</small></span>
              <time>{item.fecha}</time>
              <b>$ {formatearCOP(item.monto)}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="cash-history-card" ref={historyRef}>
        <div className="cash-history-head">
          <div><h3>Historial de cierres</h3><p>Cierres guardados para esta empresa y sucursal.</p></div>
          <div className="cash-history-actions"><span>{cashHistoryRows.length} {cashHistoryRows.length === 1 ? "cierre" : "cierres"}</span><button type="button" className="btn-outline" onClick={exportCaja} disabled={cashHistoryRows.length === 0}>Exportar Excel</button></div>
        </div>
        <div className="cash-history-scroll">
          <table className="orders-table accounting-table cash-history-table">
            <thead><tr><th>Fecha</th><th>Base</th><th>Ingresos</th><th>Gastos</th><th>Total esperado</th><th>Total contado</th><th>Diferencia</th><th>Caja menor</th><th>Nueva base</th><th>Observacion</th><th>Acciones</th></tr></thead>
            <tbody>
              {cashHistoryRows.length === 0 ? <tr><td colSpan={11}>{cashLoading ? "Cargando cierres de caja..." : "No hay cierres de caja guardados para el rango filtrado."}</td></tr> : cashHistoryRows.map(row => {
                const rowDifference = Number(row.sobrante || 0) - Number(row.faltante || 0);
                const expanded = expandedHistoryDate === row.fecha;
                return [
                  <tr key={row.fecha}>
                    <td>{row.fecha}</td><td>$ {formatearCOP(row.base)}</td><td>$ {formatearCOP(row.efectivo)}</td><td>$ {formatearCOP(row.gasto)}</td><td>$ {formatearCOP(row.totalEfectivo)}</td>
                    <td>{row.totalContado == null ? "Sin arqueo" : `$ ${formatearCOP(row.totalContado)}`}</td><td><span className={`cash-difference-pill ${rowDifference === 0 ? "is-ok" : "is-risk"}`}>{rowDifference < 0 ? "-" : rowDifference > 0 ? "+" : ""}$ {formatearCOP(Math.abs(rowDifference))}</span></td>
                    <td>$ {formatearCOP(row.guardado)}</td><td>$ {formatearCOP(row.nuevaBase)}</td><td>{row.observacion || "-"}</td>
                    <td><button type="button" className="cash-icon-button" onClick={() => setExpandedHistoryDate(expanded ? "" : row.fecha)} title={expanded ? "Ocultar detalle" : "Ver detalle"} aria-expanded={expanded}><Eye size={18} /></button></td>
                  </tr>,
                  expanded ? <tr key={`${row.fecha}-detail`} className="cash-history-detail"><td colSpan={11}>Sobrante: <strong>$ {formatearCOP(row.sobrante)}</strong><span />Faltante: <strong>$ {formatearCOP(row.faltante)}</strong><span />Estado: <strong>{row.totalContado == null ? "Historico sin arqueo" : "Arqueo registrado"}</strong></td></tr> : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      {expenseModalOpen ? (
        <div className="cash-expense-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !cashExpenseSaving && setExpenseModalOpen(false)}>
          <section className="cash-expense-modal" role="dialog" aria-modal="true" aria-labelledby="cash-expense-title">
            <header>
              <span className="cash-expense-modal-icon" aria-hidden="true"><WalletCards size={25} /></span>
              <div><h2 id="cash-expense-title">Agregar gasto</h2><p>Registrar un gasto pagado en efectivo</p></div>
              <button type="button" className="cash-modal-close" onClick={() => setExpenseModalOpen(false)} disabled={cashExpenseSaving} title="Cerrar"><X size={20} /></button>
            </header>
            <form onSubmit={submitExpense}>
              <label>Fecha<input type="date" value={cashForm.fecha} readOnly /></label>
              <label>Concepto<select value={expenseForm.concepto} onChange={event => setExpenseForm(current => ({ ...current, concepto: event.target.value }))} required><option value="">Seleccione un concepto</option><option>Insumos</option><option>Transporte</option><option>Servicios</option><option>Alimentacion</option><option>Mantenimiento</option><option>Otros</option></select></label>
              <label>Descripcion (opcional)<textarea value={expenseForm.descripcion} onChange={event => setExpenseForm(current => ({ ...current, descripcion: event.target.value }))} placeholder="Detalle del gasto" maxLength={500} /></label>
              <label>Valor<span className="cash-expense-value"><b>$</b><input type="number" min="1" step="0.01" value={expenseForm.monto} onChange={event => setExpenseForm(current => ({ ...current, monto: event.target.value }))} required /></span></label>
              <footer><button type="button" className="btn-outline" onClick={() => setExpenseModalOpen(false)} disabled={cashExpenseSaving}>Cancelar</button><button type="submit" className="btn-primary" disabled={cashExpenseSaving}><LockKeyhole size={16} />{cashExpenseSaving ? "Guardando..." : "Guardar gasto"}</button></footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
