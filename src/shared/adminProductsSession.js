import { tenantConfig } from "../config/tenantConfig.js";

const TOKEN_KEY = "petalops_access_token";
const ADMIN_PRODUCTS_SESSION_PATH = "/auth/admin-productos/session";

function normalizeBaseUrl(value) {
  const text = String(value || "").trim();
  return text ? text.replace(/\/+$/, "") : "";
}

function getAdminProductsUrl() {
  return normalizeBaseUrl(tenantConfig.adminProductsUrl) || "https://adminpetalops.joindata.com.co";
}

function resolveAdminProductsUrl(payload) {
  const baseUrl = getAdminProductsUrl();
  const baseOrigin = new URL(baseUrl).origin;
  const candidate = String(payload?.redirectUrl || payload?.url || baseUrl || "").trim();

  try {
    const target = new URL(candidate || baseUrl, baseUrl);
    if (target.origin !== baseOrigin) return baseUrl;

    for (const key of ["token", "access_token", "jwt", "id_token", "refresh_token"]) {
      target.searchParams.delete(key);
    }

    return target.toString();
  } catch {
    return baseUrl;
  }
}

function redirectToLogin() {
  try {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
  } catch {
    // Ignorar storage no disponible.
  }
  globalThis.location.assign("/login");
}

async function readOptionalJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function createAdminProductsSession() {
  const token = globalThis.localStorage?.getItem(TOKEN_KEY);
  if (!token) {
    redirectToLogin();
    return;
  }

  const response = await fetch(`${tenantConfig.apiBaseUrl}${ADMIN_PRODUCTS_SESSION_PATH}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    redirectToLogin();
    return;
  }

  const payload = await readOptionalJson(response);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || "No fue posible abrir el administrador de productos.");
  }

  globalThis.open(resolveAdminProductsUrl(payload), "_blank", "noopener,noreferrer");
}

export async function destroyAdminProductsSession() {
  const token = globalThis.localStorage?.getItem(TOKEN_KEY);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  await fetch(`${tenantConfig.apiBaseUrl}${ADMIN_PRODUCTS_SESSION_PATH}`, {
    method: "DELETE",
    credentials: "include",
    headers,
  }).catch(() => undefined);
}
