import React, { Profiler, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { OrdersAdminPage } from "../../src/domain/orders-admin/OrdersAdminPage.jsx";
import { useNewOrderClientLookup } from "../../src/domain/orders-admin/hooks/useNewOrderClientLookup.js";
const session = { usuarioID: 1, empresaID: 3, sucursalID: 1, nombre: "QA", login: "qa", rol: "empresa_admin", modulosActivosPlan: ["pedidos"], permisos: [] };
window.orderCommits = [];
function LookupReview() {
  const [form, setForm] = useState({ clienteTelefono: "", clienteNombre: "" });
  const [open, setOpen] = useState(true);
  const [api] = useState(() => ({ listarClientes: async ({ telefono }) => {
    await new Promise(resolve => setTimeout(resolve, telefono === "1111111" ? 1200 : 50));
    return { items: [{ clienteID: telefono, telefono, nombreCompleto: telefono }] };
  } }));
  useNewOrderClientLookup({ api, empresaId: 3, open, form, setForm });
  return <><input aria-label="Tel?fono prueba" value={form.clienteTelefono} onChange={e => setForm(f => ({ ...f, clienteTelefono: e.target.value }))} /><output>{form.clienteNombre}</output><button onClick={() => setOpen(v => !v)}>Abrir/cerrar</button></>;
}
createRoot(document.getElementById("root")).render(<StrictMode>{location.search.includes("lookup") ? <LookupReview /> : <Profiler id="orders" onRender={(id, phase, actualDuration) => window.orderCommits.push({ phase, actualDuration })}><OrdersAdminPage session={session} onLogout={() => {}} /></Profiler>}</StrictMode>);
