import { useCallback, useEffect, useRef } from "react";
import { normalizeIdentType } from "../orderDetailFormatters.js";

export const phoneDigits = value => String(value || "").replace(/\D/g, "");
const nameKey = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

export function hydrateClientForm(form, client) {
  const name = String(client.nombreCompleto || client.nombre_completo || client.nombre || client.cliente || "").trim();
  if (nameKey(form.clienteNombre) && nameKey(name) && nameKey(form.clienteNombre) !== nameKey(name)) {
    return { ...form, clienteID: null, clienteIdentificacion: "" };
  }
  return {
    ...form,
    clienteID: client.clienteID ?? client.clienteId ?? client.idCliente ?? client.id_cliente ?? client.id ?? form.clienteID,
    clienteNombre: name || form.clienteNombre,
    clienteEmail: client.email || "",
    clienteTipoIdent: normalizeIdentType(client.tipoIdent || client.tipo_ident || ""),
    clienteIdentificacion: client.identificacion || client.numeroIdentificacion || client.numero_identificacion || client.documento || "",
  };
}

// Do not overwrite fields the employee edited while the lookup was in flight.
export function mergeClientLookup(current, requested, client) {
  const hydrated = hydrateClientForm(current, client);
  for (const field of ["clienteNombre", "clienteEmail", "clienteTipoIdent", "clienteIdentificacion"]) {
    if (current[field] !== requested[field]) hydrated[field] = current[field];
  }
  if (current.clienteNombre !== requested.clienteNombre || current.clienteIdentificacion !== requested.clienteIdentificacion) {
    hydrated.clienteID = null;
  }
  return hydrated;
}

export function useNewOrderClientLookup({ api, empresaId, open, form, setForm }) {
  const latest = useRef({ open, form });
  latest.current = { open, form };
  const active = useRef(null);
  const hydrate = useCallback(async phone => {
    const digits = phoneDigits(phone);
    if (digits.length < 7 || !latest.current.open) return null;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const requestedForm = latest.current.form;
    try {
      const payload = await api.listarClientes({ empresaId, celular: digits, telefono: digits, q: digits, soloActivos: false, signal: controller.signal });
      if (controller.signal.aborted || !latest.current.open || phoneDigits(latest.current.form.clienteTelefono) !== digits) return null;
      const rows = [payload?.items, payload?.data?.items, payload?.data?.clientes, payload?.data?.rows, payload?.clientes, payload?.rows, payload].find(Array.isArray) || [];
      const client = rows.find(item => [item.telefono, item.telefonoCompleto, item.telefono_completo, item.celular, item.celularCompleto, item.celular_completo]
        .map(phoneDigits).filter(Boolean).some(value => value === digits || value.endsWith(digits) || digits.endsWith(value)));
      if (!client) return null;
      const hydrated = mergeClientLookup(latest.current.form, requestedForm, client);
      setForm(current => !controller.signal.aborted && latest.current.open && phoneDigits(current.clienteTelefono) === digits
        ? mergeClientLookup(current, requestedForm, client) : current);
      return hydrated;
    } catch (error) {
      if (!controller.signal.aborted) console.error("Error buscando cliente por teléfono:", error);
      return null;
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [api, empresaId, setForm]);
  useEffect(() => {
    const timer = open && phoneDigits(form.clienteTelefono).length >= 7
      ? setTimeout(() => { void hydrate(form.clienteTelefono); }, 500) : null;
    return () => { clearTimeout(timer); active.current?.abort(); };
  }, [open, form.clienteTelefono, hydrate]);
  return hydrate;
}
