import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { DeliveryPage } from "../domain/delivery/DeliveryPage.jsx";
import "../../styles.css";

// This entry is served by Vite development only and is not an input of the
// production build. It never logs in, stores tokens, or calls a remote API.
if (!import.meta.env.DEV) throw new Error("La demo solo está disponible en desarrollo.");

const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const couriers = [
  { idDomiciliario: 101, nombre: "Juan Pérez", estado: "Activo", activo: true },
  { idDomiciliario: 102, nombre: "Camila Rojas", estado: "Activo", activo: true },
  { idDomiciliario: 103, nombre: "Andrés Mora", estado: "Inactivo", activo: false },
];
const names = ["Laura Gómez", "Carlos Ruiz", "Ana Torres", "Diana López", "Pedro Díaz", "Sofía Pérez", "Natalia Castro", "Luis Ríos"];
let failAssignment = false;
let items = names.map((nombre, index) => ({
  idEntrega: 201 + index, idPedido: 301 + index,
  numeroPedido: [98047, 98051, 98056, 98060, 98063, 98068, 98070, 98071][index],
  destinatario: nombre, cliente: `Cliente ${index + 1}`, telefonoDestino: "3000000000",
  direccion: `Calle ${63 + index * 3} # 15-20`, barrio: index < 3 ? "Chapinero" : "Chicó",
  fechaEntrega: date, fechaEntregaProgramada: `${date}T${11 + Math.floor(index / 4)}:${String((index % 4) * 15).padStart(2, "0")}:00-05:00`,
  horaEntrega: `${11 + Math.floor(index / 4)}:${String((index % 4) * 15).padStart(2, "0")}`,
  estado: index < 6 ? "Pendiente" : "Asignado",
  estadoEntregaCodigo: index < 6 ? "PENDIENTE" : "ASIGNADO",
  estadoEntregaNombre: index < 6 ? "Pendiente" : "Asignado",
  estadoProduccion: "ParaEntrega", estadoPedido: "Aprobado", tipoEntrega: "domicilio",
  nombreArreglo: "Ramo Primavera", domiciliarioID: index < 6 ? null : 101,
  domiciliario: index < 6 ? "" : "Juan Pérez",
}));
const copy = value => structuredClone(value);
const api = {
  listarDomiciliarios: async () => ({ items: copy(couriers) }),
  listarDomiciliosAdmin: async ({ filtro, fecha, q }) => {
    let rows = items.filter(item => !fecha || item.fechaEntrega === fecha);
    const states = { pendientes: "PENDIENTE", asignado: "ASIGNADO", enruta: "ENRUTA", entregado: "ENTREGADO", noentregado: "NOENTREGADO", reprogramado: "REPROGRAMADO" };
    if (states[filtro]) rows = rows.filter(item => item.estadoEntregaCodigo === states[filtro]);
    if (q) rows = rows.filter(item => String(item.numeroPedido).includes(q));
    return { items: copy(rows) };
  },
  asignarDomiciliarioEntrega: async ({ entregaId, domiciliarioID }) => {
    await new Promise(resolve => setTimeout(resolve, 180));
    const item = items.find(row => row.idEntrega === entregaId);
    if (failAssignment && item.numeroPedido === 98051) throw new Error("Fallo simulado: no se guardó la asignación.");
    if (item.domiciliarioID) throw new Error("Este pedido ya fue asignado por otro administrador.");
    const courier = couriers.find(row => row.idDomiciliario === domiciliarioID && row.activo);
    if (!courier) throw new Error("Domiciliario no disponible.");
    Object.assign(item, { domiciliarioID, domiciliario: courier.nombre, estado: "Asignado", estadoEntregaCodigo: "ASIGNADO", estadoEntregaNombre: "Asignado" });
    return { ok: true };
  },
  buscarArreglosCatalogo: async () => ({ items: [] }),
  obtenerDetallePedido: async id => ({ ...copy(items.find(item => item.idPedido === id) || {}), productos: [{ nombreProducto: "Ramo Primavera" }] }),
  listarMisPedidos: async () => ({ items: [] }),
  obtenerMetricasDomicilios: async () => ({ resumen: {}, items: [], porDomiciliario: [] }),
  listarPedidosDisponiblesPorFecha: async () => ({ items: [] }),
};

function Demo() {
  const [fail, setFail] = useState(false);
  const [conflict, setConflict] = useState(false);
  return <>
    <div className="delivery-demo-banner">
      <strong>Demo local · datos ficticios · sin conexión al backend.</strong>{" "}
      <label><input type="checkbox" checked={fail} onChange={event => { failAssignment = event.target.checked; setFail(failAssignment); }} /> Simular fallo en #98051</label>{" "}
      <button type="button" disabled={conflict} onClick={() => {
        Object.assign(items[0], { domiciliarioID: 102, domiciliario: "Camila Rojas", estadoEntregaCodigo: "ASIGNADO", estadoEntregaNombre: "Asignado" });
        setConflict(true);
      }}>Simular asignación externa de #98047</button>{" "}
      <button type="button" onClick={() => window.location.reload()}>Reiniciar demo</button>
    </div>
    <DeliveryPage apiClient={api} session={{ rol: "empresa_admin", empresaID: 1, sucursalID: 1, nombre: "Administrador demo" }} canViewDomicilios onGoDomicilios={() => {}} onLogout={() => window.location.reload()} />
  </>;
}

createRoot(document.getElementById("root")).render(<Demo />);
