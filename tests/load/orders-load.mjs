// Local, synthetic controller load test. No HTTP, credentials or database access.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createOrdersDataController } from '../../src/domain/orders-admin/ordersDataController.js';
import { initialFilters } from '../../src/domain/orders-admin/ordersAdminConstants.js';

const sizes = [100, 500, 1000, 5000, 10000];
const results = [];
const percent = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];
const round = value => Math.round(value * 100) / 100;
async function scenario(size, tenants, employeesPerTenant, payment, delayMs) {
  const data = new Map(Array.from({ length: tenants }, (_, i) => [i + 1,
    Array.from({ length: size }, (_, j) => ({ pedidoID: j + 1, numeroPedido: j + 1,
      empresaID: i + 1, estado: 'APROBADO', metodoPago: 'Efectivo' }))]));
  let requests = 0, bytes = 0, active = 0, peak = 0;
  const api = { listarPedidos: async ({ empresaId, page, pageSize, signal }) => {
    signal.throwIfAborted(); requests++; active++; peak = Math.max(peak, active);
    try {
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, delayMs);
        signal.addEventListener('abort', abort, { once: true });
      });
      const payload = { items: data.get(empresaId).slice((page - 1) * pageSize, page * pageSize), total: size };
      bytes += Buffer.byteLength(JSON.stringify(payload));
      return payload;
    } finally { active--; }
  } };
  const clients = Array.from({ length: tenants * employeesPerTenant }, (_, i) => ({
    controller: createOrdersDataController(api),
    filters: { ...initialFilters, empresaId: Math.floor(i / employeesPerTenant) + 1, sucursalId: 1, metodoPago: payment ? 'Efectivo' : '' },
  }));
  const times = [];
  const start = performance.now();
  await Promise.all(clients.map(async ({ controller, filters }) => {
    const t = performance.now();
    const first = controller.load(filters);
    // Two simultaneous polling attempts must share the same operation.
    assert.equal(controller.load(filters, { silent: true }), first);
    assert.equal(controller.load(filters, { silent: true }), first);
    await first;
    times.push(performance.now() - t);
    const state = controller.getSnapshot();
    assert.equal(state.error, ''); assert.equal(state.items.length, 10); assert.equal(state.total, size);
    assert(state.items.every(row => row.empresaID === filters.empresaId));
  }));
  const coldRequests = requests;
  await Promise.all(clients.map(({ controller, filters }) => controller.load(filters)));
  assert.equal(requests, coldRequests, 'fresh cache should require no requests');
  assert.equal(requests, clients.length * (payment ? Math.ceil(size / 100) : 1));
  clients.forEach(({ controller }) => controller.cancel());
  return { sizePerTenant: size, tenants, employeesPerTenant, clients: clients.length,
    mode: payment ? 'payment' : 'normal', injectedDelayMs: delayMs, requests,
    warmAdditionalRequests: requests - coldRequests, syntheticJsonBytes: bytes, peakMockRequests: peak,
    localWallMs: round(performance.now() - start), localCompletionP50Ms: round(percent(times, .5)),
    localCompletionP95Ms: round(percent(times, .95)), localCompletionP99Ms: round(percent(times, .99)), samples: times.length };
}

for (const size of sizes) {
  for (const [tenants, employees] of [[1, 1], [1, 5], [3, 5], [3, 20]]) {
    for (const payment of [false, true]) results.push(await scenario(size, tenants, employees, payment, 2));
  }
  console.log(`Completed ${size} orders per tenant`);
}
// Slow responses, still entirely simulated.
results.push(await scenario(1000, 3, 5, true, 50));
const report = {
  generatedAt: new Date().toISOString(), node: process.version,
  scope: 'Controller only, in one Node process; mock API. No browser, HTTP, database or backend capacity measurement.',
  baseline: { source: 'Recorded pre-phase-1 in-memory audit, 2026-09-26', sizes,
    normalRequestsPerClient: [1, 1, 1, 1, 1], paymentRequestsPerClient: [1, 5, 10, 50, 100] },
  results,
};
await writeFile(new URL('./orders-load-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ scenarios: results.length, assertions: 'passed', largest: results.findLast(r => r.clients === 60 && r.mode === 'payment') }));
