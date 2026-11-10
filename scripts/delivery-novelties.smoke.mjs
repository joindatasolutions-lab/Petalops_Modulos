import { chromium, expect } from "@playwright/test";

const origin = process.env.DELIVERY_DEMO_URL || "http://127.0.0.1:5178";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let resolved = false;
let expectedAction = "entregar";
let writes = 0;
await page.addInitScript(() => {
  localStorage.setItem("petalops_access_token", "local-test-token");
  localStorage.setItem("petalops_active_view", "domicilios");
});
await page.route("**/*", async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (!["fetch", "xhr"].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
  let data = { items: [] };
  if (url.pathname.endsWith("/auth/me")) data = { userID: 1001, empresaID: 1, sucursalID: 1, rol: "empresa_admin", nombre: "Admin prueba", modulosActivosPlan: ["domicilios"], permisos: [{ modulo: "domicilios", puedeVer: true, puedeEditar: true }] };
  else if (url.pathname.endsWith("/domicilios/novedades")) {
    const item = { idNovedad: 71, pedidoID: 20, idEntrega: 10, domiciliarioID: 48, estado: resolved ? "resuelta" : "abierta", motivo: "Cliente ausente", observaciones: "No contesta", reportadaEn: "2026-11-10T09:00:00", observacionResolucion: resolved ? "Cliente confirmó disponibilidad" : null };
    const filter = url.searchParams.get("estado");
    const items = !filter || filter === item.estado ? [item] : [];
    data = { items, abiertas: resolved ? 0 : 1, resueltas: resolved ? 1 : 0, total: items.length };
  } else if (url.pathname.endsWith("/pedido/20/detalle")) {
    data = { cliente: { nombre: "Cliente completo", telefono: "3001112233", email: "cliente@example.test" }, destinatario: { nombre: "Destinataria completa", telefono: "3004445566", direccion: "Calle 50 # 20-10", barrio: "Centro", fechaEntrega: "2026-11-11", horaEntrega: "09:00", mensaje: "Feliz día", firma: "Tu familia", observacionGeneral: "Llamar al llegar" } };
  } else if (url.pathname.endsWith("/domicilios/10")) {
    data = { idEntrega: 10, idPedido: 20, numeroPedido: 100706, destinatario: "Cliente prueba" };
  } else if (url.pathname.endsWith("/10/resolver-novedad")) {
    expect(request.method()).toBe("PUT");
    expect(request.headers()["content-type"]).toContain("multipart/form-data");
    expect(request.postData()).toContain(`name="accion"\r\n\r\n${expectedAction}`);
    if (expectedAction !== "entregar") expect(request.postData()).toContain("2026-11-11T09:00:00-05:00");
    writes++;
    resolved = true;
    data = { status: "ok", idEntrega: expectedAction === "nuevo_intento" ? 123 : 10, estado: "Asignado" };
  } else if (request.method() !== "GET") return route.abort();
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
});
try {
  for (const [action, label] of [["entregar", "Entregar pedido"], ["nuevo_intento", "Reintentar entrega"], ["devolver_disponibles", "Devolver a disponibles"]]) {
    expectedAction = action;
    resolved = false;
    await page.goto(origin);
    await page.locator(".inventory-header-tabs").getByRole("button", { name: "Novedades", exact: true }).click();
    await expect(page.locator(".delivery-novelty-row")).toContainText("100706");
    await page.getByRole("button", { name: "Ver detalle", exact: true }).click();
    const drawer = page.locator(".orders-drawer.open");
    for (const text of ["Cliente completo", "Destinataria completa", "3001112233", "3004445566", "Calle 50 # 20-10", "Llamar al llegar"]) await expect(drawer).toContainText(text);
    await drawer.getByTitle("Cerrar barra lateral").click();
    await page.getByRole("button", { name: "Resolver", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Resolver novedad" });
    await dialog.getByRole("button", { name: new RegExp(label) }).click();
    if (action !== "entregar") await dialog.locator('input[type="datetime-local"]').fill("2026-11-11T09:00");
    await dialog.locator("textarea").fill("Cliente confirmó disponibilidad");
    await dialog.locator(".delivery-novelty-resolve-actions .btn-primary").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".delivery-novelty-row")).toContainText("Resuelta");
    await page.reload();
    await page.locator(".inventory-header-tabs").getByRole("button", { name: "Novedades", exact: true }).click();
    await page.locator(".delivery-novelties-tabs").getByRole("button", { name: "Resueltas", exact: true }).click();
    await expect(page.locator(".delivery-novelty-row")).toContainText("Cliente confirmó disponibilidad");
    console.log(`PASS: ${action}, multipart, historial persistente y filtro Resueltas.`);
  }
  expect(writes).toBe(3);
  expect(errors).toEqual([]);
} finally { await browser.close(); }
