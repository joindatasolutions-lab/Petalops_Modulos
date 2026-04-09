export const tenantConfig = {
  empresaId: 1,
  sucursalId: 1,
  apiBaseUrl: import.meta.env.DEV
    ? "/api"
    : import.meta.env.VITE_API_BASE_URL || "https://join-flower-708265049038.us-central1.run.app"
};
