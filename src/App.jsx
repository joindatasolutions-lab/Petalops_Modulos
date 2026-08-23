import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import { LoginPage } from "./domain/auth/LoginPage.jsx";
import { tenantConfig } from "./config/tenantConfig.js";
import { createApiClient } from "./infrastructure/apiClient.js";

const TOKEN_KEY = "petalops_access_token";
const VIEW_KEY = "petalops_active_view";
const DEFAULT_VIEW = "pipeline";

const AccountingPage = lazy(() => import("./domain/accounting/AccountingPage.jsx").then(module => ({ default: module.AccountingPage })));
const ClientsPage = lazy(() => import("./domain/clients/ClientsPage.jsx").then(module => ({ default: module.ClientsPage })));
const DeliveryPage = lazy(() => import("./domain/delivery/DeliveryPage.jsx").then(module => ({ default: module.DeliveryPage })));
const NeighborhoodsPage = lazy(() => import("./domain/neighborhoods/NeighborhoodsPage.jsx").then(module => ({ default: module.NeighborhoodsPage })));
const InventoryPage = lazy(() => import("./domain/inventory/InventoryPage.jsx").then(module => ({ default: module.InventoryPage })));
const OrdersAdminPage = lazy(() => import("./domain/orders-admin/OrdersAdminPage.jsx").then(module => ({ default: module.OrdersAdminPage })));
const PipelineOperativo = lazy(() => import("./domain/pipeline/PipelineOperativo.jsx").then(module => ({ default: module.PipelineOperativo })));
const ProductionPage = lazy(() => import("./domain/production/ProductionPage.jsx").then(module => ({ default: module.ProductionPage })));
const UsersManagementPage = lazy(() => import("./domain/users/UsersManagementPage.jsx").then(module => ({ default: module.UsersManagementPage })));

export function hasModuleAccess(session, modulo) {
  const name = String(modulo || "").toLowerCase();
  if (!session) return false;
  if (Boolean(session?.esGlobalJoin)) return true;
  const modulosPlan = new Set((session.modulosActivosPlan || []).map(item => String(item || "").toLowerCase()));
  if (!modulosPlan.has(name)) return false;

  const permiso = (session.permisos || []).find(item => String(item.modulo || "").toLowerCase() === name);
  return Boolean(permiso?.puedeVer);
}

function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return role === "admin" || role === "empresa_admin";
}

export function canAccessPipeline(session) {
  return Boolean(hasModuleAccess(session, "pipeline") || isEmpresaAdminRole(session));
}

function canAccessView(session, view) {
  if (!session) return false;
  if (view === "pipeline") return canAccessPipeline(session);
  if (view === "pedidos") return hasModuleAccess(session, "pedidos");
  if (view === "produccion") return hasModuleAccess(session, "produccion");
  if (view === "domicilios") return hasModuleAccess(session, "domicilios");
  if (view === "barrios") return hasModuleAccess(session, "barrios") || hasModuleAccess(session, "domicilios");
  if (view === "inventario") return hasModuleAccess(session, "inventario");
  if (view === "contabilidad") return hasModuleAccess(session, "contabilidad");
  if (view === "clientes") return hasModuleAccess(session, "clientes");
  if (view === "usuarios") return Boolean(session?.esGlobalJoin || isEmpresaAdminRole(session));
  return false;
}

function resolveDefaultView(session) {
  if (!session) return "pipeline";
  if (canAccessPipeline(session)) return "pipeline";
  if (hasModuleAccess(session, "pedidos")) return "pedidos";
  if (hasModuleAccess(session, "produccion")) return "produccion";
  if (hasModuleAccess(session, "domicilios")) return "domicilios";
  if (hasModuleAccess(session, "barrios") || hasModuleAccess(session, "domicilios")) return "barrios";
  if (hasModuleAccess(session, "inventario")) return "inventario";
  if (hasModuleAccess(session, "contabilidad")) return "contabilidad";
  if (hasModuleAccess(session, "clientes")) return "clientes";
  if (session?.esGlobalJoin || isEmpresaAdminRole(session)) return "usuarios";
  return "pedidos";
}

function resolveSessionView(session, preferredView) {
  const fallbackView = resolveDefaultView(session);
  const normalizedPreferredView = String(preferredView || "").trim() || fallbackView;
  return canAccessView(session, normalizedPreferredView) ? normalizedPreferredView : fallbackView;
}

function readStoredView() {
  try {
    const requestedView = String(new URLSearchParams(globalThis.location?.search || "").get("view") || "").trim();
    if (requestedView) return requestedView;
    return String(globalThis.localStorage?.getItem(VIEW_KEY) || "").trim() || DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

function ModuleLoadingFallback() {
  return (
    <main className="auth-view">
      <section className="auth-card">
        <p className="orders-message">Cargando modulo...</p>
      </section>
    </main>
  );
}

export default function App() {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState(() => readStoredView());

  useEffect(() => {
    const bootstrap = async () => {
      const token = globalThis.localStorage?.getItem(TOKEN_KEY);
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const me = await api.me();
        setView(resolveSessionView(me, readStoredView()));
        setSession(me);
      } catch {
        globalThis.localStorage?.removeItem(TOKEN_KEY);
      } finally {
        setAuthLoading(false);
      }
    };

    bootstrap();
  }, [api]);

  useEffect(() => {
    if (!session) return;
    try {
      globalThis.localStorage?.setItem(VIEW_KEY, view);
    } catch {
      // Ignorar storage no disponible.
    }
  }, [session, view]);

  const canPedidos = hasModuleAccess(session, "pedidos");
  const canCatalogo = hasModuleAccess(session, "catalogo");
  const canProduccion = hasModuleAccess(session, "produccion");
  const canDomicilios = hasModuleAccess(session, "domicilios");
  const canBarrios = hasModuleAccess(session, "barrios") || canDomicilios;
  const canInventario = hasModuleAccess(session, "inventario");
  const canContabilidad = hasModuleAccess(session, "contabilidad");
  const canClientes = hasModuleAccess(session, "clientes");
  const canPipeline = canAccessPipeline(session);
  const canUsuariosGlobal = Boolean(session?.esGlobalJoin);
  const canUsuariosPanel = Boolean(canUsuariosGlobal || isEmpresaAdminRole(session));

  useEffect(() => {
    if (!session) return;
    const fallbackView = resolveDefaultView(session);
    const redirectTo = nextView => {
      setView(nextView || fallbackView);
    };

    if (view === "pipeline" && !canPipeline) return redirectTo(fallbackView);
    if (view === "pedidos" && !canPedidos) return redirectTo(fallbackView);
    if (view === "produccion" && !canProduccion) return redirectTo(fallbackView);
    if (view === "domicilios" && !canDomicilios) return redirectTo(fallbackView);
    if (view === "barrios" && !canBarrios) return redirectTo(fallbackView);
    if (view === "inventario" && !canInventario) return redirectTo(fallbackView);
    if (view === "contabilidad" && !canContabilidad) return redirectTo(fallbackView);
    if (view === "clientes" && !canClientes) return redirectTo(fallbackView);
    if (view === "usuarios" && !canUsuariosPanel) return redirectTo(fallbackView);
  }, [
    session,
    view,
    canPipeline,
    canPedidos,
    canProduccion,
    canDomicilios,
    canBarrios,
    canInventario,
    canContabilidad,
    canClientes,
    canUsuariosPanel,
  ]);

  const handleLogin = async ({ login, password }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await api.login({ login, password });
      const nextSession = response.user;
      globalThis.localStorage?.setItem(TOKEN_KEY, response.accessToken);
      setView(resolveSessionView(nextSession, readStoredView()));
      setSession(nextSession);
    } catch (error) {
      const message = error?.message;
      const isInvalidCredentials = Number(error?.status) === 401 || Number(error?.status) === 403;
      setAuthError(
        isInvalidCredentials
          ? "Usuario o contraseña incorrectos. Verifica tus datos e intenta nuevamente."
          : typeof message === "string" && message.trim()
          ? message
          : "No fue posible iniciar sesión. Verifica usuario y contraseña."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    globalThis.localStorage?.removeItem(VIEW_KEY);
    setSession(null);
    setView("pipeline");
  };

  if (authLoading && !session) {
    return <LoginPage onSubmit={handleLogin} loading error={authError} />;
  }

  if (!session) {
    return <LoginPage onSubmit={handleLogin} loading={authLoading} error={authError} />;
  }

  if (!canPipeline && !canPedidos && !canProduccion && !canDomicilios && !canBarrios && !canInventario && !canContabilidad && !canClientes && !canUsuariosPanel) {
    return (
      <main className="auth-view">
        <section className="auth-card">
          <h1>Sin acceso a módulos</h1>
          <p>Tu rol no tiene permisos activos para visualizar módulos en este plan.</p>
          <button type="button" className="btn-outline" onClick={handleLogout}>Cerrar sesión</button>
        </section>
      </main>
    );
  }

  const pageProps = {
    session,
    canViewPipeline: canPipeline,
    canViewPedidos: canPedidos,
    canViewCatalogo: canCatalogo,
    canViewProduccion: canProduccion,
    canViewDomicilios: canDomicilios,
    canViewBarrios: canBarrios,
    canViewInventario: canInventario,
    canViewContabilidad: canContabilidad,
    canViewClientesPanel: canClientes,
    canViewUsuariosPanel: canUsuariosPanel,
    onGoPipeline: () => canPipeline && setView("pipeline"),
    onGoPedidos: () => canPedidos && setView("pedidos"),
    onGoProduccion: () => canProduccion && setView("produccion"),
    onGoDomicilios: () => canDomicilios && setView("domicilios"),
    onGoBarrios: () => canBarrios && setView("barrios"),
    onGoInventario: () => canInventario && setView("inventario"),
    onGoContabilidad: () => canContabilidad && setView("contabilidad"),
    onGoClientes: () => canClientes && setView("clientes"),
    onGoUsuarios: () => canUsuariosPanel && setView("usuarios"),
    onLogout: handleLogout,
  };

  const activePage = (() => {
    if (view === "pipeline") return <PipelineOperativo {...pageProps} />;
    if (view === "pedidos") return <OrdersAdminPage {...pageProps} />;
    if (view === "produccion") return <ProductionPage {...pageProps} />;
    if (view === "domicilios") return <DeliveryPage {...pageProps} />;
    if (view === "barrios") return <NeighborhoodsPage {...pageProps} />;
    if (view === "inventario") return <InventoryPage {...pageProps} />;
    if (view === "contabilidad") return <AccountingPage {...pageProps} />;
    if (view === "clientes") return <ClientsPage {...pageProps} />;

    return (
      <UsersManagementPage
        {...pageProps}
        canViewUsuariosGlobal={canUsuariosGlobal}
      />
    );
  })();

  return (
    <Suspense fallback={<ModuleLoadingFallback />}>
      <div className="app-fullscreen-lock" role="alert" aria-live="assertive">
        <div className="app-fullscreen-lock-panel">
          <strong>Pantalla completa requerida</strong>
          <span>Amplia la ventana para operar PetalOps.</span>
        </div>
      </div>
      {activePage}
    </Suspense>
  );
}
