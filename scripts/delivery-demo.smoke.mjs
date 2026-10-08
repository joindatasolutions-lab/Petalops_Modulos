import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/*", route => {
  const url = new URL(route.request().url());
  return url.hostname === "127.0.0.1" || url.hostname === "localhost" ? route.continue() : route.abort();
});
const select = async codes => {
  for (const code of codes) await page.getByRole("checkbox", { name: `Seleccionar pedido ${code}`, exact: true }).check();
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
  await select([98047, 98051, 98056]);
  await expect(page.getByRole("checkbox", { name: "Seleccionar todos los pedidos elegibles visibles" })).toHaveJSProperty("indeterminate", true);
  await expect(page.getByLabel("Domiciliario del lote").locator('option[value="103"]')).toHaveJSProperty("disabled", true);
  await page.screenshot({ path: "/tmp/domicilios-lote-local.png", fullPage: true });
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
  await page.getByRole("button", { name: "Simular asignación externa de #98047" }).click();
  await confirm(2);
  await expect(page.getByRole("heading", { name: "1 de 2 asignados" })).toBeVisible();
  await expect(page.getByText("Ya no está disponible para asignar. Actualiza la lista.", { exact: false })).toBeVisible();
  console.log("PASS: conflicto con otro administrador sin sobrescribir la asignación.");

  await reset();
  await select([98047]);
  await page.getByRole("button", { name: "Revisar asignación (1)", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar domicilio por pedido, cliente, destinatario o direccion" }).fill("98051");
  await expect(page.getByRole("button", { name: "Revisar asignación (0)", exact: true })).toBeDisabled();
  console.log("PASS: cambiar filtros descarta la selección y la confirmación anterior.");
  await reset();
  await page.getByLabel("Filtrar domicilios por barrio").selectOption("Chapinero");
  await expect(page.locator(".dispatch-table tbody tr")).toHaveCount(3);
  await page.getByRole("checkbox", { name: "Seleccionar todos los pedidos elegibles visibles" }).check();
  await expect(page.getByRole("button", { name: "Limpiar selección (3)", exact: true })).toBeEnabled();
  await page.getByLabel("Filtrar domicilios por barrio").selectOption("Chicó");
  await expect(page.getByRole("button", { name: "Limpiar selección (0)", exact: true })).toBeDisabled();
  console.log("PASS: agrupación por barrio y selección de todos los elegibles visibles.");
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole("heading", { name: "Asignar lote", exact: true })).toBeVisible();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("PASS: escritorio/tablet sin errores de JavaScript.");
} finally {
  await browser.close();
}
