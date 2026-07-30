/**
 * Reglas de tipo de entrega.
 *
 * Centraliza la traduccion entre el texto visible de barrio/tipo de entrega y
 * el valor tecnico que espera el checkout.
 */

export function detailEditBarrioNombreOrFallback(currentValue, originalValue) {
  return String(currentValue || originalValue || "").trim() || null;
}

export function normalizeDeliveryType(barrioNombre) {
  const value = String(barrioNombre || "").trim().toLowerCase();
  return value === "recoger en tienda" ? "recogida_en_tienda" : "domicilio";
}
