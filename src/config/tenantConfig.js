const cloudRunApiBaseUrl = "https://join-flower-708265049038.us-central1.run.app";
const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();

// In dev we use Vite's proxy. In production, avoid leaking a local "/api"
// value from .env.local because static hosting won't proxy it automatically.
const apiBaseUrl = import.meta.env.DEV
  ? configuredApiBaseUrl || "/api"
  : configuredApiBaseUrl && configuredApiBaseUrl !== "/api"
    ? configuredApiBaseUrl
    : cloudRunApiBaseUrl;

export const tenantConfig = {
  empresaId: 1,
  sucursalId: 1,
  apiBaseUrl,
};
