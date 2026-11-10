import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:5189/tests/browser/cash-register.html");
  await page.getByText("Arqueo pendiente", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Guardar cierre", exact: true }).isDisabled(), true);
  for (const [value, count] of [[100000, 1], [50000, 1], [20000, 1], [5000, 1], [200, 6]]) {
    await page.getByRole("spinbutton", { name: `Cantidad de ${value}`, exact: true }).fill(String(count));
  }
  await page.getByText("Cuadre correcto", { exact: true }).waitFor();
  assert.match(await page.locator(".cash-count-total").innerText(), /176.200/);
  await page.getByRole("spinbutton", { name: "Cantidad de 200", exact: true }).fill("0");
  await page.locator(".cash-status").getByText("Faltante", { exact: true }).waitFor();
  await page.getByRole("spinbutton", { name: "Cantidad de 200", exact: true }).fill("6");
  await page.screenshot({ path: "tests/browser/cash-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: "tests/browser/cash-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Limpiar conteo" }).click();
  await page.getByText("Arqueo pendiente", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Movimientos", exact: true }).click();
  await page.getByText("Movimientos del día").waitFor();
  assert.deepEqual(errors, []);
  console.log("Caja: conteo, diferencia, limpieza, navegación y responsive verificados.");
} finally { await browser.close(); }
