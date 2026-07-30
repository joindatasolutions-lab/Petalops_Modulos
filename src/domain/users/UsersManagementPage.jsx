import { RefreshCw, UserPlus } from "lucide-react";

import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { CompanyModulesPanel } from "./components/CompanyModulesPanel.jsx";
import { CompanyModulesSummaryTable } from "./components/CompanyModulesSummaryTable.jsx";
import { CreateUserModal, EditUserModal } from "./components/UserModals.jsx";
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
            <button type="button" className="sidebar-trigger" onClick={users.toggleSidebar}>☰ Menú</button>
            <h1>Usuarios</h1>
            <p className="orders-admin-subtitle">Usuario: {users.displayUserName}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary users-create-open-btn" onClick={() => users.setShowCreateModal(true)}>
              <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
              Crear usuario
            </button>
            <button type="button" className="btn-primary orders-header-refresh" onClick={users.loadUsers} disabled={users.loading}>
              <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
              {users.loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

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

        {users.error ? <p className="orders-message">{users.error}</p> : null}
        {users.info ? <p className="orders-message">{users.info}</p> : null}
        {users.loading ? <p className="orders-message">Cargando usuarios...</p> : null}

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
