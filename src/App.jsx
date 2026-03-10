import { OrdersAdminPage } from "./domain/orders-admin/OrdersAdminPage.jsx";
import { ProductionPage } from "./domain/production/ProductionPage.jsx";
import { DeliveryPage } from "./domain/delivery/DeliveryPage.jsx";
import { InventoryPage } from "./domain/inventory/InventoryPage.jsx";
import { UsersManagementPage } from "./domain/users/UsersManagementPage.jsx";
import { LoginPage } from "./domain/auth/LoginPage.jsx";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "./infrastructure/apiClient.js";
import { tenantConfig } from "./config/tenantConfig.js";

const TOKEN_KEY = "petalops_access_token";

function hasModuleAccess(session, modulo) {
  const name = String(modulo || "").toLowerCase();
  if (!session) return false;
  const modulosPlan = new Set(session.modulosActivosPlan || []);
  if (!modulosPlan.has(name)) return false;

  const permiso = (session.permisos || []).find(item => String(item.modulo || "").toLowerCase() === name);
  return Boolean(permiso?.puedeVer);
}

function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return role === "admin" || role === "empresa_admin";
}

export default function App() {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState("pedidos");

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

  const canPedidos = hasModuleAccess(session, "pedidos");
  const canProduccion = hasModuleAccess(session, "produccion");
  const canDomicilios = hasModuleAccess(session, "domicilios");
  const canInventario = hasModuleAccess(session, "inventario");
  const canUsuariosGlobal = Boolean(session?.esGlobalJoin);
  const canUsuariosPanel = Boolean(canUsuariosGlobal || isEmpresaAdminRole(session));

  useEffect(() => {
    if (!session) return;
    if (view === "pedidos" && !canPedidos) {
      if (canProduccion) {
        setView("produccion");
      } else if (canDomicilios) {
        setView("domicilios");
      }
      return;
    }
    if (view === "produccion" && !canProduccion) {
      if (canPedidos) {
        setView("pedidos");
      } else if (canDomicilios) {
        setView("domicilios");
      }
      return;
    }
    if (view === "domicilios" && !canDomicilios) {
      if (canPedidos) {
        setView("pedidos");
      } else if (canProduccion) {
        setView("produccion");
      } else if (canInventario) {
        setView("inventario");
      } else if (canUsuariosPanel) {
        setView("usuarios");
      }
    }
    if (view === "inventario" && !canInventario) {
      if (canPedidos) {
        setView("pedidos");
      } else if (canProduccion) {
        setView("produccion");
      } else if (canDomicilios) {
        setView("domicilios");
      } else if (canUsuariosPanel) {
        setView("usuarios");
      }
    }
    if (view === "usuarios" && !canUsuariosPanel) {
      if (canPedidos) {
        setView("pedidos");
      } else if (canProduccion) {
        setView("produccion");
      } else if (canDomicilios) {
        setView("domicilios");
      }
    }
  }, [session, view, canPedidos, canProduccion, canDomicilios, canInventario, canUsuariosPanel]);

  const handleLogin = async ({ login, password }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await api.login({ login, password });
      globalThis.localStorage?.setItem(TOKEN_KEY, response.accessToken);
      setSession(response.user);
      if (!hasModuleAccess(response.user, "pedidos") && hasModuleAccess(response.user, "produccion")) {
        setView("produccion");
      } else if (!hasModuleAccess(response.user, "pedidos") && !hasModuleAccess(response.user, "produccion") && hasModuleAccess(response.user, "domicilios")) {
        setView("domicilios");
      } else if (!hasModuleAccess(response.user, "pedidos") && !hasModuleAccess(response.user, "produccion") && !hasModuleAccess(response.user, "domicilios") && hasModuleAccess(response.user, "inventario")) {
        setView("inventario");
      } else if (response.user?.esGlobalJoin || isEmpresaAdminRole(response.user)) {
        setView("usuarios");
      } else {
        setView("pedidos");
      }
    } catch (error) {
      const message = error?.message;
      setAuthError(
        typeof message === "string" && message.trim()
          ? message
            : "No fue posible iniciar sesion. Verifica usuario y contrasena."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    setSession(null);
    setView("pedidos");
  };

  if (authLoading && !session) {
    return <LoginPage onSubmit={handleLogin} loading error={authError} />;
  }

  if (!session) {
    return <LoginPage onSubmit={handleLogin} loading={authLoading} error={authError} />;
  }

  if (!canPedidos && !canProduccion && !canDomicilios && !canInventario && !canUsuariosPanel) {
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

  return view === "pedidos"
    ? (
      <OrdersAdminPage
        session={session}
        canViewPedidos={canPedidos}
        canViewProduccion={canProduccion}
        canViewDomicilios={canDomicilios}
        canViewInventario={canInventario}
        canViewUsuariosPanel={canUsuariosPanel}
        onLogout={handleLogout}
        onGoPedidos={() => canPedidos && setView("pedidos")}
        onGoProduccion={() => canProduccion && setView("produccion")}
        onGoDomicilios={() => canDomicilios && setView("domicilios")}
        onGoInventario={() => canInventario && setView("inventario")}
        onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
      />
    )
    : view === "produccion"
      ? (
      <ProductionPage
        session={session}
        canViewPedidos={canPedidos}
        canViewProduccion={canProduccion}
        canViewDomicilios={canDomicilios}
        canViewInventario={canInventario}
        canViewUsuariosPanel={canUsuariosPanel}
        onLogout={handleLogout}
        onGoPedidos={() => canPedidos && setView("pedidos")}
        onGoProduccion={() => canProduccion && setView("produccion")}
        onGoDomicilios={() => canDomicilios && setView("domicilios")}
        onGoInventario={() => canInventario && setView("inventario")}
        onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
      />
      )
      : view === "domicilios"
        ? (
        <DeliveryPage
          session={session}
          canViewPedidos={canPedidos}
          canViewProduccion={canProduccion}
          canViewDomicilios={canDomicilios}
          canViewInventario={canInventario}
          canViewUsuariosPanel={canUsuariosPanel}
          onLogout={handleLogout}
          onGoPedidos={() => canPedidos && setView("pedidos")}
          onGoProduccion={() => canProduccion && setView("produccion")}
          onGoDomicilios={() => canDomicilios && setView("domicilios")}
          onGoInventario={() => canInventario && setView("inventario")}
          onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
        />
        )
        : view === "inventario"
          ? (
          <InventoryPage
            session={session}
            canViewPedidos={canPedidos}
            canViewProduccion={canProduccion}
            canViewDomicilios={canDomicilios}
            canViewInventario={canInventario}
            canViewUsuariosPanel={canUsuariosPanel}
            onGoPedidos={() => canPedidos && setView("pedidos")}
            onGoProduccion={() => canProduccion && setView("produccion")}
            onGoDomicilios={() => canDomicilios && setView("domicilios")}
            onGoInventario={() => canInventario && setView("inventario")}
            onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
            onLogout={handleLogout}
          />
          )
        : (
          <UsersManagementPage
            session={session}
            canViewPedidos={canPedidos}
            canViewProduccion={canProduccion}
            canViewDomicilios={canDomicilios}
            canViewInventario={canInventario}
            canViewUsuariosGlobal={canUsuariosGlobal}
            onGoPedidos={() => canPedidos && setView("pedidos")}
            onGoProduccion={() => canProduccion && setView("produccion")}
            onGoDomicilios={() => canDomicilios && setView("domicilios")}
            onGoInventario={() => canInventario && setView("inventario")}
            onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
            onLogout={handleLogout}
          />
        );
}
