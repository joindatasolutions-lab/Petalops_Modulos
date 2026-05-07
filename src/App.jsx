import { useEffect, useMemo, useState } from "react";

import { LoginPage } from "./domain/auth/LoginPage.jsx";
import { AccountingPage } from "./domain/accounting/AccountingPage.jsx";
import { ClientsPage } from "./domain/clients/ClientsPage.jsx";
import { DeliveryPage } from "./domain/delivery/DeliveryPage.jsx";
import { InventoryPage } from "./domain/inventory/InventoryPage.jsx";
import { OrdersAdminPage } from "./domain/orders-admin/OrdersAdminPage.jsx";
import { PipelineOperativo } from "./domain/pipeline/PipelineOperativo.jsx";
import { ProductionPage } from "./domain/production/ProductionPage.jsx";
import { TraceabilityPage } from "./domain/traceability/TraceabilityPage.jsx";
import { UsersManagementPage } from "./domain/users/UsersManagementPage.jsx";
import { tenantConfig } from "./config/tenantConfig.js";
import { createApiClient } from "./infrastructure/apiClient.js";

const TOKEN_KEY = "petalops_access_token";
const VIEW_KEY = "petalops_active_view";

function hasModuleAccess(session, modulo) {
  const name = String(modulo || "").toLowerCase();
  if (!session) return false;
  if (Boolean(session?.esGlobalJoin)) return true;
  const modulosPlan = new Set(session.modulosActivosPlan || []);
  if (!modulosPlan.has(name)) return false;

  const permiso = (session.permisos || []).find(item => String(item.modulo || "").toLowerCase() === name);
  return Boolean(permiso?.puedeVer);
}

function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return role === "admin" || role === "empresa_admin";
}

function canAccessPipeline(session) {
  return Boolean(session?.esGlobalJoin || isEmpresaAdminRole(session));
}

function resolveDefaultView(session) {
  if (!session) return "pipeline";
  if (canAccessPipeline(session)) return "pipeline";
  if (hasModuleAccess(session, "pedidos")) return "pedidos";
  if (hasModuleAccess(session, "produccion")) return "produccion";
  if (hasModuleAccess(session, "domicilios")) return "domicilios";
  if (hasModuleAccess(session, "inventario")) return "inventario";
  if (hasModuleAccess(session, "contabilidad")) return "contabilidad";
  if (hasModuleAccess(session, "trazabilidad")) return "trazabilidad";
  if (hasModuleAccess(session, "clientes")) return "clientes";
  if (session?.esGlobalJoin || isEmpresaAdminRole(session)) return "usuarios";
  return "pedidos";
}

function readStoredView() {
  try {
    return String(globalThis.localStorage?.getItem(VIEW_KEY) || "").trim() || "pipeline";
  } catch {
    return "pipeline";
  }
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
  const canProduccion = hasModuleAccess(session, "produccion");
  const canDomicilios = hasModuleAccess(session, "domicilios");
  const canInventario = hasModuleAccess(session, "inventario");
  const canContabilidad = hasModuleAccess(session, "contabilidad");
  const canTrazabilidad = hasModuleAccess(session, "trazabilidad");
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
    if (view === "inventario" && !canInventario) return redirectTo(fallbackView);
    if (view === "contabilidad" && !canContabilidad) return redirectTo(fallbackView);
    if (view === "trazabilidad" && !canTrazabilidad) return redirectTo(fallbackView);
    if (view === "clientes" && !canClientes) return redirectTo(fallbackView);
    if (view === "usuarios" && !canUsuariosPanel) return redirectTo(fallbackView);
  }, [
    session,
    view,
    canPipeline,
    canPedidos,
    canProduccion,
    canDomicilios,
    canInventario,
    canContabilidad,
    canTrazabilidad,
    canClientes,
    canUsuariosPanel,
  ]);

  const handleLogin = async ({ login, password }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await api.login({ login, password });
      globalThis.localStorage?.setItem(TOKEN_KEY, response.accessToken);
      setSession(response.user);
      const storedView = readStoredView();
      setView(storedView || resolveDefaultView(response.user));
    } catch (error) {
      const message = error?.message;
      setAuthError(
        typeof message === "string" && message.trim()
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

  if (!canPedidos && !canProduccion && !canDomicilios && !canInventario && !canContabilidad && !canTrazabilidad && !canClientes && !canUsuariosPanel) {
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
    canViewProduccion: canProduccion,
    canViewDomicilios: canDomicilios,
    canViewInventario: canInventario,
    canViewContabilidad: canContabilidad,
    canViewTrazabilidad: canTrazabilidad,
    canViewClientesPanel: canClientes,
    canViewUsuariosPanel: canUsuariosPanel,
    onGoPipeline: () => canPipeline && setView("pipeline"),
    onGoPedidos: () => canPedidos && setView("pedidos"),
    onGoProduccion: () => canProduccion && setView("produccion"),
    onGoDomicilios: () => canDomicilios && setView("domicilios"),
    onGoInventario: () => canInventario && setView("inventario"),
    onGoContabilidad: () => canContabilidad && setView("contabilidad"),
    onGoTrazabilidad: () => canTrazabilidad && setView("trazabilidad"),
    onGoClientes: () => canClientes && setView("clientes"),
    onGoUsuarios: () => canUsuariosPanel && setView("usuarios"),
    onLogout: handleLogout,
  };

  if (view === "pipeline") return <PipelineOperativo {...pageProps} />;
  if (view === "pedidos") return <OrdersAdminPage {...pageProps} />;
  if (view === "produccion") return <ProductionPage {...pageProps} />;
  if (view === "domicilios") return <DeliveryPage {...pageProps} />;
  if (view === "inventario") return <InventoryPage {...pageProps} />;
  if (view === "contabilidad") return <AccountingPage {...pageProps} />;
  if (view === "trazabilidad") return <TraceabilityPage {...pageProps} />;
  if (view === "clientes") return <ClientsPage {...pageProps} />;

  return (
    <UsersManagementPage
      {...pageProps}
      canViewUsuariosGlobal={canUsuariosGlobal}
    />
  );
}
