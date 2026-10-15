import { chromium, expect } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/*", route => {
  const url = new URL(route.request().url());
  const demoOrigin = new URL(process.env.DELIVERY_DEMO_URL || "http://127.0.0.1:5173").origin;
  return url.origin === demoOrigin && !url.pathname.startsWith("/api") ? route.continue() : route.abort();
});
const select = async codes => {
  for (const code of codes) await page.getByRole("checkbox", { name: `Seleccionar pedido ${code}`, exact: true }).check();
  await page.getByRole("button", { name: "Asignar domiciliario", exact: true }).click();
  await page.getByLabel("Domiciliario del lote").selectOption("101");
};
const confirm = async count => {
  await page.getByRole("button", { name: `Revisar asignación (${count})`, exact: true }).click();
  await page.getByRole("button", { name: `Confirmar asignación (${count})`, exact: true }).click();
};
const reset = async () => {
  await page.goto(`${process.env.DELIVERY_DEMO_URL || "http://127.0.0.1:5173"}/dev/domicilios.html`);
  await expect(page.getByRole("checkbox", { name: "Seleccionar pedido 98047", exact: true })).toBeEnabled();
};

try {
  await reset();
  await expect(page.getByLabel("Domiciliario del lote")).toHaveCount(0);
  await select([98047, 98051, 98056]);
  await expect(page.getByRole("checkbox", { name: "Seleccionar todos los pedidos elegibles visibles" })).toHaveJSProperty("indeterminate", true);
  await expect(page.getByLabel("Domiciliario del lote").locator('option[value="103"]')).toHaveJSProperty("disabled", true);
  await page.screenshot({ path: join(tmpdir(), "domicilios-lote-local.png"), fullPage: true });
  await confirm(3);
  await expect(page.getByRole("heading", { name: "3 de 3 asignados" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Seleccionar pedido 98047", exact: true })).toBeDisabled();
  console.log("PASS: selección múltiple, carga visible, revisión y asignación exitosa.");

  await reset();
  await page.getByLabel("Simular fallo en #98051").check();
  await select([98047, 98051, 98056]);
  await confirm(3);
  await expect(page.getByRole("heading", { name: "2 de 3 asignados" })).toBeVisible();
  await expect(page.getByText("Fallo simulado: no se guardó la asignación.", { exact: false })).toBeVisible();
  await page.getByLabel("Simular fallo en #98051").uncheck();
  await page.getByRole("button", { name: "Actualizar pedidos", exact: true }).click();
  await select([98051]);
  await confirm(1);
  await expect(page.getByRole("heading", { name: "1 de 1 asignados" })).toBeVisible();
  console.log("PASS: fallo parcial y recuperación sin repetir los pedidos exitosos.");

  await reset();
  await select([98047, 98051]);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Simular asignación externa de #98047" }).click();
  await page.getByRole("button", { name: "Asignar domiciliario", exact: true }).click();
  await confirm(2);
  await expect(page.getByRole("heading", { name: "1 de 2 asignados" })).toBeVisible();
  await expect(page.getByText("Ya no está disponible para asignar. Actualiza la lista.", { exact: false })).toBeVisible();
  console.log("PASS: conflicto con otro administrador sin sobrescribir la asignación.");

  await reset();
  await select([98047]);
  await page.getByRole("button", { name: "Revisar asignación (1)", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar domicilio por pedido, cliente, destinatario o direccion" }).fill("98051");
  await expect(page.getByRole("button", { name: "Asignar domiciliario", exact: true })).toHaveCount(0);
  console.log("PASS: cambiar filtros descarta la selección y la confirmación anterior.");
  await reset();
  await page.getByLabel("Filtrar domicilios por barrio").selectOption("Chapinero");
  await expect(page.locator(".dispatch-table tbody tr")).toHaveCount(3);
  await page.getByRole("checkbox", { name: "Seleccionar todos los pedidos elegibles visibles" }).check();
  await expect(page.getByRole("button", { name: "Limpiar selección (3)", exact: true })).toBeEnabled();
  await page.getByLabel("Filtrar domicilios por barrio").selectOption("Chicó");
  await expect(page.getByRole("button", { name: "Asignar domiciliario", exact: true })).toHaveCount(0);
  console.log("PASS: agrupación por barrio y selección de todos los elegibles visibles.");
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole("heading", { name: "Pedidos para despacho", exact: true })).toBeVisible();
  await reset();
  const row = page.locator(".dispatch-table tbody tr").first();
  const before = await row.boundingBox();
  const trigger = page.getByRole("button", { name: "Acciones del pedido 98047", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Acciones del pedido 98047" })).toBeVisible();
  const after = await row.boundingBox();
  expect(after.height).toBe(before.height);
  await page.keyboard.press("End");
  await expect(page.getByRole("button", { name: "Cambiar estado", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("navigation", { name: "Vista operativa" }).getByRole("button", { name: "Finalizados", exact: true }).click();
  await expect(page.locator(".dispatch-table tbody tr")).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "Seleccionar pedido 98072", exact: true })).toBeDisabled();
  await page.getByRole("navigation", { name: "Vista operativa" }).getByRole("button", { name: "Todos", exact: true }).click();
  await expect(page.locator(".dispatch-table tbody tr")).toHaveCount(9);
  await page.screenshot({ path: join(tmpdir(), "domicilios-desktop-local.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const header = await page.locator(".delivery-page-header").boundingBox();
  expect(header.height).toBeLessThan(220);
  const headerButtons = await page.locator(".delivery-page-header .orders-header-refresh").evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().width));
  expect(headerButtons.every(width => width > 100)).toBe(true);
  await expect(page.getByRole("button", { name: "Filtros", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await expect(page.getByLabel("Filtrar domicilios por barrio")).toBeVisible();
  await page.locator(".dispatch-table-scroll").evaluate(element => { element.scrollLeft = 0; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), "domicilios-mobile-local.png"), fullPage: true });
  console.log("PASS: menú flotante accesible, vistas operativas y filtros móviles.");

  // Exercise the real App -> authenticated client -> DeliveryPage route.
  // Every API request is fulfilled in memory; writes are rejected, never sent.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem("petalops_access_token", "local-smoke-not-a-real-token");
    localStorage.setItem("petalops_active_view", "domicilios");
  });
  const apiCalls = [];
  await page.route("**/*", async route => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.fallback();
    apiCalls.push({ method: request.method(), url: request.url() });
    if (request.method() !== "GET") return route.abort();
    const url = new URL(request.url());
    const date = url.searchParams.get("fecha") || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    let data = { items: [] };
    if (url.pathname.endsWith("/auth/me")) data = {
      userID: 1001, empresaID: 1, sucursalID: 1, rol: "empresa_admin", nombre: "Admin prueba",
      modulosActivosPlan: ["domicilios"], permisos: [{ modulo: "domicilios", puedeVer: true, puedeEditar: true }],
    };
    else if (url.pathname.endsWith("/domicilios/domiciliarios")) data = { items: [{ idDomiciliario: 101, usuarioID: 1001, nombre: "Juan Pérez", activo: true, estado: "Activo" }] };
    else if (url.pathname.endsWith("/domicilios")) data = { items: [{
      idEntrega: 201, idPedido: 301, numeroPedido: 98047, destinatario: "Cliente ficticio", direccion: "Calle de prueba", barrio: "Chapinero",
      fechaEntrega: date, horaEntrega: "12:00", estado: "Pendiente", estadoEntregaCodigo: "PENDIENTE", estadoProduccion: "ParaEntrega", tipoEntrega: "domicilio", nombreArreglo: "Ramo prueba",
    }] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto(process.env.DELIVERY_DEMO_URL || "http://127.0.0.1:5173");
  await expect(page.getByRole("checkbox", { name: "Seleccionar pedido 98047", exact: true })).toBeEnabled();
  await select([98047]);
  await page.getByRole("button", { name: "Revisar asignación (1)", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirmar asignación (1)", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(apiCalls.some(call => call.url.includes("/auth/me"))).toBe(true);
  expect(apiCalls.every(call => call.method === "GET")).toBe(true);
  console.log("PASS: vista real de administrador integrada, API simulada y ninguna escritura real.");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("PASS: escritorio/tablet sin errores de JavaScript.");
} finally {
  await browser.close();
}
