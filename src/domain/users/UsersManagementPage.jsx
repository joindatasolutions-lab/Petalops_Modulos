import { Building2, RefreshCw, UserPlus, UsersRound } from "lucide-react";

import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { CompanyModulesPanel } from "./components/CompanyModulesPanel.jsx";
import { CompanyModulesSummaryTable } from "./components/CompanyModulesSummaryTable.jsx";
import { CreateUserModal, EditUserModal } from "./components/UserModals.jsx";
import { TenantCreatePanel } from "./components/TenantCreatePanel.jsx";
import { UsersFilters } from "./components/UsersFilters.jsx";
import { UsersTable } from "./components/UsersTable.jsx";
import { useUsersManagementController } from "./hooks/useUsersManagementController.js";
import { filterVisibleRoles as domainFilterVisibleRoles } from "./usersDomain.js";

export const filterVisibleRoles = domainFilterVisibleRoles;

export function UsersManagementPage({
  session,
  canViewUsuariosGlobal,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewBarrios,
  canViewInventario,
  canViewContabilidad,
  canViewTrazabilidad,
  canViewClientesPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
  onGoInventario,
  onGoContabilidad,
  onGoTrazabilidad,
  onGoClientes,
  onGoUsuarios,
  onLogout,
}) {
  const users = useUsersManagementController({ session, canViewUsuariosGlobal });
  const sidebarPermissions = {
    pipeline: canViewPipeline,
    pedidos: canViewPedidos,
    produccion: canViewProduccion,
    domicilios: canViewDomicilios,
    barrios: canViewBarrios,
    inventario: canViewInventario,
    contabilidad: canViewContabilidad,
    trazabilidad: canViewTrazabilidad,
    clientes: canViewClientesPanel,
    usuarios: true,
  };
  const sidebarNavigation = {
    pipeline: onGoPipeline,
    pedidos: onGoPedidos,
    produccion: onGoProduccion,
    domicilios: onGoDomicilios,
    barrios: onGoBarrios,
    inventario: onGoInventario,
    contabilidad: onGoContabilidad,
    trazabilidad: onGoTrazabilidad,
    clientes: onGoClientes,
    usuarios: onGoUsuarios,
  };
  const isTenantsPanel = canViewUsuariosGlobal && users.activePanel === "tenants";
  const isUsuariosPanel = !canViewUsuariosGlobal || users.activePanel === "usuarios";

  return (
    <div className={`app-shell ${users.sidebarPinned ? "is-sidebar-pinned" : ""} ${users.sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="usuarios"
        sidebarPinned={users.sidebarPinned}
        sidebarMobileOpen={users.sidebarMobileOpen}
        toggleSidebar={users.toggleSidebar}
        closeSidebarMobile={() => users.setSidebarMobileOpen(false)}
        onLogout={onLogout}
        permissions={sidebarPermissions}
        navigation={sidebarNavigation}
      />

      <main className="orders-admin-view users-page-view">
        <header className="orders-admin-header orders-page-header users-page-header">
          <div>
            <button type="button" className="sidebar-trigger" onClick={users.toggleSidebar}>Menu</button>
            <h1>Gestion de usuarios</h1>
            <p className="orders-admin-subtitle">Usuario: {users.displayUserName}</p>
          </div>
          <div className="header-actions">
            {canViewUsuariosGlobal && isUsuariosPanel ? (
              <button type="button" className="btn-secondary users-create-open-btn" onClick={() => users.setActivePanel("tenants")}>
                <Building2 size={18} strokeWidth={2} aria-hidden="true" />
                Nuevo tenant
              </button>
            ) : null}
            {isUsuariosPanel ? (
              <button type="button" className="btn-primary users-create-open-btn" onClick={() => users.setShowCreateModal(true)}>
                <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
                Crear usuario
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary orders-header-refresh"
              onClick={isTenantsPanel ? users.loadEmpresasModuloResumen : users.loadUsers}
              disabled={users.loading || users.empresasModulesLoading}
            >
              <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
              {users.loading || users.empresasModulesLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        {canViewUsuariosGlobal ? (
          <nav className="users-section-tabs" aria-label="Secciones de gestion">
            <button type="button" className={isTenantsPanel ? "is-active" : ""} onClick={() => users.setActivePanel("tenants")}>
              <Building2 size={16} strokeWidth={2} aria-hidden="true" />
              Tenants
            </button>
            <button type="button" className={isUsuariosPanel ? "is-active" : ""} onClick={() => users.setActivePanel("usuarios")}>
              <UsersRound size={16} strokeWidth={2} aria-hidden="true" />
              Usuarios
            </button>
          </nav>
        ) : null}

        {isUsuariosPanel ? (
          <UsersFilters
            canViewUsuariosGlobal={canViewUsuariosGlobal}
            empresaID={users.empresaID}
            setEmpresaID={users.setEmpresaID}
            empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
            empresas={users.empresas}
            sucursalID={users.sucursalID}
            setSucursalID={users.setSucursalID}
            sucursales={users.sucursales}
            estadoFiltro={users.estadoFiltro}
            setEstadoFiltro={users.setEstadoFiltro}
            q={users.q}
            setQ={users.setQ}
          />
        ) : null}

        {users.error ? <p className="orders-message">{users.error}</p> : null}
        {users.info ? <p className="orders-message">{users.info}</p> : null}
        {users.loading && isUsuariosPanel ? <p className="orders-message">Cargando usuarios...</p> : null}

        {isTenantsPanel ? (
          <section className="users-tenants-layout">
            <TenantCreatePanel
              form={users.tenantForm}
              setForm={users.setTenantForm}
              saving={users.saving}
              onSubmit={users.submitCreateTenant}
            />

            <CompanyModulesPanel
              empresaID={users.empresaID}
              empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
              empresas={users.empresas}
              setEmpresaID={users.setEmpresaID}
              modulesLoading={users.modulesLoading}
              moduleItems={users.moduleItems}
              onToggleModule={users.toggleModule}
              showAdvancedModules={users.showAdvancedModules}
              setShowAdvancedModules={users.setShowAdvancedModules}
              newModulo={users.newModulo}
              setNewModulo={users.setNewModulo}
              onAddModulo={users.addModulo}
              modulesSaving={users.modulesSaving}
              onSaveModules={users.saveModules}
            />

            <CompanyModulesSummaryTable loading={users.empresasModulesLoading} items={users.empresasModuloResumen} />
          </section>
        ) : (
          <section className="users-grid-layout">
            {canViewUsuariosGlobal ? (
              <CompanyModulesPanel
                empresaID={users.empresaID}
                empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
                empresas={users.empresas}
                setEmpresaID={users.setEmpresaID}
                modulesLoading={users.modulesLoading}
                moduleItems={users.moduleItems}
                onToggleModule={users.toggleModule}
                showAdvancedModules={users.showAdvancedModules}
                setShowAdvancedModules={users.setShowAdvancedModules}
                newModulo={users.newModulo}
                setNewModulo={users.setNewModulo}
                onAddModulo={users.addModulo}
                modulesSaving={users.modulesSaving}
                onSaveModules={users.saveModules}
              />
            ) : null}

            <UsersTable
              items={users.items}
              canViewUsuariosGlobal={canViewUsuariosGlobal}
              sessionUserID={session?.userID}
              onEdit={users.startEditUser}
              onToggleEstado={users.toggleEstado}
              onDelete={users.deleteUser}
            />

            {canViewUsuariosGlobal ? (
              <CompanyModulesSummaryTable loading={users.empresasModulesLoading} items={users.empresasModuloResumen} />
            ) : null}
          </section>
        )}
      </main>

      {users.showCreateModal ? (
        <CreateUserModal
          empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
          empresaID={users.empresaID}
          canViewUsuariosGlobal={canViewUsuariosGlobal}
          onClose={users.closeCreateModal}
          formProps={users.createFormProps}
        />
      ) : null}

      {users.showEditDrawer ? (
        <EditUserModal
          editingUserId={users.editingUserId}
          editForm={users.editForm}
          empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
          empresaID={users.empresaID}
          onClose={users.closeEditDrawer}
          formProps={users.editFormProps}
        />
      ) : null}
    </div>
  );
}
