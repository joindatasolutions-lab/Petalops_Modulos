import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AccountingCashView } from "../../src/domain/accounting/components/views/AccountingCashView.jsx";
import { calculateCashBalance, calculateCashCount } from "../../src/domain/accounting/cashRegisterDomain.js";
function Fixture() {
  const [cashForm, setCashForm] = useState({ fecha: "2026-10-22", base: "88200", guardado: "0", observacion: "", arqueo: null });
  const totalContadoValue = calculateCashCount(cashForm.arqueo);
  const cashBalance = calculateCashBalance({ base: Number(cashForm.base), efectivo: 88000, guardado: Number(cashForm.guardado), contado: totalContadoValue });
  return <AccountingCashView activeView="caja" cashForm={cashForm} setCashForm={setCashForm}
    baseValue={Number(cashForm.base)} efectivoValue={88000} gastoValue={0} guardadoValue={Number(cashForm.guardado)}
    totalEfectivoCaja={cashBalance.esperado} totalContadoValue={totalContadoValue} cashBalance={cashBalance}
    nuevaBaseValue={cashBalance.nuevaBase} cashHistoryRows={[]} cashLoading={false} canEditCashClosing
    todayCashDate="2026-10-23" saving={false} saveCashClosing={() => {}} addCashExpense={async () => false} />;
}
createRoot(document.getElementById("root")).render(<Fixture />);
