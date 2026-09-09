import { Building2, CreditCard, RefreshCw, SlidersHorizontal, UserPlus, UsersRound } from "lucide-react";

import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { AccionesPanel } from "./components/AccionesPanel.jsx";
import { CompanyModulesPanel } from "./components/CompanyModulesPanel.jsx";
import { CompanyModulesSummaryTable } from "./components/CompanyModulesSummaryTable.jsx";
import { CompanyProfilePanel } from "./components/CompanyProfilePanel.jsx";
import { CompanyThemePanel } from "./components/CompanyThemePanel.jsx";
import { PaymentMethodsPanel } from "./components/PaymentMethodsPanel.jsx";
import { CreateUserModal, EditUserModal, PaymentMethodModal } from "./components/UserModals.jsx";
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
  canViewClientesPanel,
  onGoPipeline,
  onGoPedidos,
  onGoProduccion,
  onGoDomicilios,
  onGoBarrios,
  onGoInventario,
  onGoContabilidad,
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
    clientes: onGoClientes,
    usuarios: onGoUsuarios,
  };
  const isTenantsPanel = canViewUsuariosGlobal && users.activePanel === "tenants";
  const isPaymentMethodsPanel = users.activePanel === "paymentMethods";
  const isAccionesPanel = users.activePanel === "acciones";
  const isUsuariosPanel = !isPaymentMethodsPanel && !isAccionesPanel && (!canViewUsuariosGlobal || users.activePanel === "usuarios");

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
            {isTenantsPanel ? (
              <button type="button" className="btn-primary users-create-open-btn" onClick={() => users.setTenantSection("crear")}>
                <Building2 size={18} strokeWidth={2} aria-hidden="true" />
                Nuevo tenant
              </button>
            ) : null}
            {isUsuariosPanel ? (
              <button type="button" className="btn-primary users-create-open-btn" onClick={users.openCreateModal}>
                <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
                Crear usuario
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary orders-header-refresh"
              onClick={isTenantsPanel ? users.loadEmpresasModuloResumen : (isPaymentMethodsPanel ? users.loadPaymentMethods : (isAccionesPanel ? users.loadAsignacionConfig : users.loadUsers))}
              disabled={users.loading || users.empresasModulesLoading || users.paymentMethodsLoading || users.asignacionLoading}
            >
              <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
              {users.loading || users.empresasModulesLoading || users.paymentMethodsLoading || users.asignacionLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <nav className="users-section-tabs" aria-label="Secciones de gestion">
          {canViewUsuariosGlobal ? (
            <button type="button" className={isTenantsPanel ? "is-active" : ""} onClick={() => users.setActivePanel("tenants")}>
              <Building2 size={16} strokeWidth={2} aria-hidden="true" />
              Empresas / tenants
            </button>
          ) : null}
          <button type="button" className={isUsuariosPanel ? "is-active" : ""} onClick={() => users.setActivePanel("usuarios")}>
            <UsersRound size={16} strokeWidth={2} aria-hidden="true" />
            Usuarios
          </button>
          <button type="button" className={isPaymentMethodsPanel ? "is-active" : ""} onClick={() => users.setActivePanel("paymentMethods")}>
            <CreditCard size={16} strokeWidth={2} aria-hidden="true" />
            Metodos de pago
          </button>
          <button type="button" className={isAccionesPanel ? "is-active" : ""} onClick={() => users.setActivePanel("acciones")}>
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
            Acciones
          </button>
        </nav>

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
            <nav className="users-section-tabs users-tenant-subtabs" aria-label="Secciones de empresas">
              <button type="button" className={users.tenantSection === "crear" ? "is-active" : ""} onClick={() => users.setTenantSection("crear")}>
                <Building2 size={16} strokeWidth={2} aria-hidden="true" />
                Crear tenant
              </button>
              <button type="button" className={users.tenantSection === "perfil" ? "is-active" : ""} onClick={() => users.setTenantSection("perfil")}>
                Perfil de la empresa
              </button>
              <button type="button" className={users.tenantSection === "tema" ? "is-active" : ""} onClick={() => users.setTenantSection("tema")}>
                Tema visual (catalogo web)
              </button>
              <button type="button" className={users.tenantSection === "modulos" ? "is-active" : ""} onClick={() => users.setTenantSection("modulos")}>
                Habilitacion comercial de modulos
              </button>
              <button type="button" className={users.tenantSection === "resumen" ? "is-active" : ""} onClick={() => users.setTenantSection("resumen")}>
                Modulos por empresa
              </button>
            </nav>

            {users.tenantSection === "crear" ? (
              <TenantCreatePanel
                form={users.tenantForm}
                setForm={users.setTenantForm}
                saving={users.saving}
                onSubmit={users.submitCreateTenant}
              />
            ) : null}

            {users.tenantSection === "perfil" ? (
              <CompanyProfilePanel
                empresaID={users.empresaID}
                empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
                empresas={users.empresas}
                setEmpresaID={users.setEmpresaID}
                loading={users.companyProfileLoading}
                profileForm={users.companyProfileForm}
                setProfileForm={users.setCompanyProfileForm}
                profileSaving={users.companyProfileSaving}
                onSaveProfile={users.saveCompanyProfile}
              />
            ) : null}

            {users.tenantSection === "tema" ? (
              <CompanyThemePanel
                empresaID={users.empresaID}
                empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
                empresas={users.empresas}
                setEmpresaID={users.setEmpresaID}
                loading={users.companyProfileLoading}
                themeForm={users.companyThemeForm}
                setThemeForm={users.setCompanyThemeForm}
                themeSaving={users.companyThemeSaving}
                onSaveTheme={users.saveCompanyTheme}
              />
            ) : null}

            {users.tenantSection === "modulos" ? (
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

            {users.tenantSection === "resumen" ? (
              <CompanyModulesSummaryTable loading={users.empresasModulesLoading} items={users.empresasModuloResumen} />
            ) : null}
          </section>
        ) : isPaymentMethodsPanel ? (
          <PaymentMethodsPanel
            empresaID={users.empresaID}
            empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
            empresas={users.empresas}
            setEmpresaID={users.setEmpresaID}
            canViewUsuariosGlobal={canViewUsuariosGlobal}
            loading={users.paymentMethodsLoading}
            items={users.paymentMethods}
            saving={users.paymentMethodSaving}
            onCreate={users.openPaymentMethodModal}
            onEdit={users.editPaymentMethod}
            onToggleActive={users.togglePaymentMethodActive}
          />
        ) : isAccionesPanel ? (
          <AccionesPanel
            empresaID={users.empresaID}
            empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
            empresas={users.empresas}
            setEmpresaID={users.setEmpresaID}
            canViewUsuariosGlobal={canViewUsuariosGlobal}
            loading={users.asignacionLoading}
            saving={users.asignacionSaving}
            asignacionProduccionActiva={users.asignacionConfig.asignacionProduccionActiva}
            asignacionDomicilioActiva={users.asignacionConfig.asignacionDomicilioActiva}
            autoAsignacionProduccionActiva={users.asignacionConfig.autoAsignacionProduccionActiva}
            onToggleProduccion={users.toggleAsignacionProduccion}
            onToggleDomicilio={users.toggleAsignacionDomicilio}
            onToggleAutoAsignacionProduccion={users.toggleAutoAsignacionProduccion}
          />
        ) : (
          <section className="users-grid-layout users-list-layout">
            <UsersTable
              items={users.items}
              canViewUsuariosGlobal={canViewUsuariosGlobal}
              sessionUserID={session?.userID}
              onEdit={users.startEditUser}
              onToggleEstado={users.toggleEstado}
              onDelete={users.deleteUser}
            />
          </section>
        )}
      </main>

      {users.showCreateModal ? (
        <CreateUserModal
          empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
          empresaID={users.empresaID}
          empresas={users.empresas}
          setEmpresaID={users.setEmpresaID}
          canViewUsuariosGlobal={canViewUsuariosGlobal}
          onClose={users.closeCreateModal}
          formProps={users.createFormProps}
        />
      ) : null}

      {users.showPaymentMethodModal ? (
        <PaymentMethodModal
          empresaSeleccionadaNombre={users.empresaSeleccionadaNombre}
          empresaID={users.empresaID}
          empresas={users.empresas}
          setEmpresaID={users.setEmpresaID}
          canViewUsuariosGlobal={canViewUsuariosGlobal}
          editingItem={users.paymentMethodEditing}
          form={users.paymentMethodForm}
          setForm={users.setPaymentMethodForm}
          saving={users.paymentMethodSaving}
          onSubmit={users.submitCreatePaymentMethod}
          onClose={users.closePaymentMethodModal}
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
