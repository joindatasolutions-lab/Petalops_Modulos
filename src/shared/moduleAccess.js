export function hasModuleAccess(session, modulo) {
  const name = String(modulo || "").toLowerCase();
  if (!session) return false;
  if (Boolean(session?.esGlobalJoin)) return true;
  const modulosPlan = new Set((session.modulosActivosPlan || []).map(item => String(item || "").toLowerCase()));
  if (!modulosPlan.has(name)) return false;

  const permiso = (session.permisos || []).find(item => String(item.modulo || "").toLowerCase() === name);
  return Boolean(permiso?.puedeVer);
}
