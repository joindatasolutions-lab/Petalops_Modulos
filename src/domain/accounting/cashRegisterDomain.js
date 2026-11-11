import { roundMoney } from "./accountingDomain.js";

export const CASH_DENOMINATIONS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

export function calculateCashCount(counts) {
  if (counts == null) return null;
  return CASH_DENOMINATIONS.reduce((sum, value) => {
    const quantity = Number(counts[value] || 0);
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Las cantidades deben ser enteros mayores o iguales a cero.");
    return sum + value * quantity;
  }, 0);
}

export function calculateCashBalance({ base = 0, efectivo = 0, gasto = 0, guardado = 0, contado = null }) {
  const esperado = roundMoney(Number(base) + Number(efectivo) - Number(gasto));
  const diferencia = contado == null ? null : roundMoney(contado - esperado);
  return {
    esperado, diferencia,
    sobrante: diferencia == null ? null : Math.max(0, diferencia),
    faltante: diferencia == null ? null : Math.max(0, -diferencia),
    nuevaBase: roundMoney((contado == null ? esperado : contado) - Number(guardado)),
  };
}
