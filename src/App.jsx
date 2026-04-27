import { OrdersAdminPage } from "./domain/orders-admin/OrdersAdminPage.jsx";
import { ProductionPage } from "./domain/production/ProductionPage.jsx";
import { DeliveryPage } from "./domain/delivery/DeliveryPage.jsx";
import { InventoryPage } from "./domain/inventory/InventoryPage.jsx";
import { ClientsPage } from "./domain/clients/ClientsPage.jsx";
import { UsersManagementPage } from "./domain/users/UsersManagementPage.jsx";
import { PipelineOperativo } from "./domain/pipeline/PipelineOperativo.jsx";
import { LoginPage } from "./domain/auth/LoginPage.jsx";
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "./infrastructure/apiClient.js";
import { tenantConfig } from "./config/tenantConfig.js";

const TOKEN_KEY = "petalops_access_token";

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
  if (hasModuleAccess(session, "pedidos")) return "clientes";
  if (session?.esGlobalJoin || isEmpresaAdminRole(session)) return "usuarios";
  return "pedidos";
}

export default function App() {
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState("pipeline");

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
  const canClientes = hasModuleAccess(session, "pedidos");
  const canPipeline = canAccessPipeline(session);
  const canUsuariosGlobal = Boolean(session?.esGlobalJoin);
  const canUsuariosPanel = Boolean(canUsuariosGlobal || isEmpresaAdminRole(session));

  useEffect(() => {
    if (!session) return;
    if (view === "pipeline" && !canPipeline) {
      setView(resolveDefaultView(session));
      return;
    }
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
    if (view === "clientes" && !canClientes) {
      if (canPedidos) {
        setView("pedidos");
      } else if (canProduccion) {
        setView("produccion");
      } else if (canDomicilios) {
        setView("domicilios");
      } else if (canInventario) {
        setView("inventario");
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
  }, [session, view, canPipeline, canPedidos, canProduccion, canDomicilios, canInventario, canClientes, canUsuariosPanel]);

  const handleLogin = async ({ login, password }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await api.login({ login, password });
      globalThis.localStorage?.setItem(TOKEN_KEY, response.accessToken);
      setSession(response.user);
      setView(resolveDefaultView(response.user));
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
    setView("pipeline");
  };

  if (authLoading && !session) {
    return <LoginPage onSubmit={handleLogin} loading error={authError} />;
  }

  if (!session) {
    return <LoginPage onSubmit={handleLogin} loading={authLoading} error={authError} />;
  }

  if (!canPedidos && !canProduccion && !canDomicilios && !canInventario && !canClientes && !canUsuariosPanel) {
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

  return view === "pipeline"
    ? (
      <PipelineOperativo
        session={session}
        canViewPipeline={canPipeline}
        canViewPedidos={canPedidos}
        canViewProduccion={canProduccion}
        canViewDomicilios={canDomicilios}
        canViewInventario={canInventario}
        canViewClientesPanel={canClientes}
        canViewUsuariosPanel={canUsuariosPanel}
        onLogout={handleLogout}
        onGoPipeline={() => canPipeline && setView("pipeline")}
        onGoPedidos={() => canPedidos && setView("pedidos")}
        onGoProduccion={() => canProduccion && setView("produccion")}
        onGoDomicilios={() => canDomicilios && setView("domicilios")}
        onGoInventario={() => canInventario && setView("inventario")}
        onGoClientes={() => canClientes && setView("clientes")}
        onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
      />
    )
    : view === "pedidos"
    ? (
      <OrdersAdminPage
        session={session}
        canViewPipeline={canPipeline}
        canViewPedidos={canPedidos}
        canViewProduccion={canProduccion}
        canViewDomicilios={canDomicilios}
        canViewInventario={canInventario}
        canViewClientesPanel={canClientes}
        canViewUsuariosPanel={canUsuariosPanel}
        onLogout={handleLogout}
        onGoPipeline={() => canPipeline && setView("pipeline")}
        onGoPedidos={() => canPedidos && setView("pedidos")}
        onGoProduccion={() => canProduccion && setView("produccion")}
        onGoDomicilios={() => canDomicilios && setView("domicilios")}
        onGoInventario={() => canInventario && setView("inventario")}
        onGoClientes={() => canClientes && setView("clientes")}
        onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
      />
    )
    : view === "produccion"
      ? (
      <ProductionPage
        session={session}
        canViewPipeline={canPipeline}
        canViewPedidos={canPedidos}
        canViewProduccion={canProduccion}
        canViewDomicilios={canDomicilios}
        canViewInventario={canInventario}
        canViewClientesPanel={canClientes}
        canViewUsuariosPanel={canUsuariosPanel}
        onLogout={handleLogout}
        onGoPipeline={() => canPipeline && setView("pipeline")}
        onGoPedidos={() => canPedidos && setView("pedidos")}
        onGoProduccion={() => canProduccion && setView("produccion")}
        onGoDomicilios={() => canDomicilios && setView("domicilios")}
        onGoInventario={() => canInventario && setView("inventario")}
        onGoClientes={() => canClientes && setView("clientes")}
        onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
      />
      )
      : view === "domicilios"
        ? (
        <DeliveryPage
          session={session}
          canViewPipeline={canPipeline}
          canViewPedidos={canPedidos}
          canViewProduccion={canProduccion}
          canViewDomicilios={canDomicilios}
          canViewInventario={canInventario}
          canViewClientesPanel={canClientes}
          canViewUsuariosPanel={canUsuariosPanel}
          onLogout={handleLogout}
          onGoPipeline={() => canPipeline && setView("pipeline")}
          onGoPedidos={() => canPedidos && setView("pedidos")}
          onGoProduccion={() => canProduccion && setView("produccion")}
          onGoDomicilios={() => canDomicilios && setView("domicilios")}
          onGoInventario={() => canInventario && setView("inventario")}
          onGoClientes={() => canClientes && setView("clientes")}
          onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
        />
        )
        : view === "inventario"
          ? (
          <InventoryPage
            session={session}
            canViewPipeline={canPipeline}
            canViewPedidos={canPedidos}
            canViewProduccion={canProduccion}
            canViewDomicilios={canDomicilios}
            canViewInventario={canInventario}
            canViewClientesPanel={canClientes}
            canViewUsuariosPanel={canUsuariosPanel}
            onGoPipeline={() => canPipeline && setView("pipeline")}
            onGoPedidos={() => canPedidos && setView("pedidos")}
            onGoProduccion={() => canProduccion && setView("produccion")}
            onGoDomicilios={() => canDomicilios && setView("domicilios")}
            onGoInventario={() => canInventario && setView("inventario")}
            onGoClientes={() => canClientes && setView("clientes")}
            onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
            onLogout={handleLogout}
          />
          )
        : view === "clientes"
          ? (
          <ClientsPage
            session={session}
            canViewPipeline={canPipeline}
            canViewPedidos={canPedidos}
            canViewProduccion={canProduccion}
            canViewDomicilios={canDomicilios}
            canViewInventario={canInventario}
            canViewClientesPanel={canClientes}
            canViewUsuariosPanel={canUsuariosPanel}
            onGoPipeline={() => canPipeline && setView("pipeline")}
            onGoPedidos={() => canPedidos && setView("pedidos")}
            onGoProduccion={() => canProduccion && setView("produccion")}
            onGoDomicilios={() => canDomicilios && setView("domicilios")}
            onGoInventario={() => canInventario && setView("inventario")}
            onGoClientes={() => canClientes && setView("clientes")}
            onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
            onLogout={handleLogout}
          />
          )
        : (
          <UsersManagementPage
            session={session}
            canViewPipeline={canPipeline}
            canViewPedidos={canPedidos}
            canViewProduccion={canProduccion}
            canViewDomicilios={canDomicilios}
            canViewInventario={canInventario}
            canViewClientesPanel={canClientes}
            canViewUsuariosGlobal={canUsuariosGlobal}
            onGoPipeline={() => canPipeline && setView("pipeline")}
            onGoPedidos={() => canPedidos && setView("pedidos")}
            onGoProduccion={() => canProduccion && setView("produccion")}
            onGoDomicilios={() => canDomicilios && setView("domicilios")}
            onGoInventario={() => canInventario && setView("inventario")}
            onGoClientes={() => canClientes && setView("clientes")}
            onGoUsuarios={() => canUsuariosPanel && setView("usuarios")}
            onLogout={handleLogout}
          />
        );
}
