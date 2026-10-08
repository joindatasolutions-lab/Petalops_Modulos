// The current API assigns one delivery at a time. Preserve each result so a
// retry never silently repeats successful assignments.
export async function assignDeliveryBatch({ items, freshItems, isEligible, assign }) {
  const current = new Map(freshItems.map(item => [String(item.idEntrega), item]));
  const results = [];
  const seen = new Set();
  for (const item of items) {
    const id = String(item.idEntrega);
    if (seen.has(id)) continue;
    seen.add(id);
    const fresh = current.get(id);
    if (!fresh || !isEligible(fresh)) {
      results.push({ item, status: "conflict", message: "Ya no está disponible para asignar. Actualiza la lista." });
      continue;
    }
    try {
      await assign(fresh);
      results.push({ item, status: "success", message: "Asignado correctamente." });
    } catch (error) {
      results.push({ item, status: "error", message: error?.detail || error?.message || "No fue posible asignar. Actualiza antes de reintentar." });
    }
  }
  return results;
}
