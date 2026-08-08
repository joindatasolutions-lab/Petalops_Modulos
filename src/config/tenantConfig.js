const cloudRunApiBaseUrl = "https://join-flower-708265049038.us-central1.run.app";
const configuredApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const configuredAdminProductsUrl = String(import.meta.env.VITE_ADMIN_PRODUCTS_URL || "").trim();

// Dev defaults to the same API used in production because this frontend repo
// does not include a local backend. Set VITE_API_BASE_URL=/api only when a
// local server is running behind Vite's proxy.
const apiBaseUrl = import.meta.env.DEV
  ? configuredApiBaseUrl || cloudRunApiBaseUrl
  : configuredApiBaseUrl && configuredApiBaseUrl !== "/api"
    ? configuredApiBaseUrl
    : cloudRunApiBaseUrl;

export const tenantConfig = {
  empresaId: 1,
  sucursalId: 1,
  apiBaseUrl,
  adminProductsUrl: configuredAdminProductsUrl || "https://adminpetalops.joindata.com.co/",
};
