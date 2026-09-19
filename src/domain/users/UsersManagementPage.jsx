import { Building2, KeyRound, Mail, RefreshCw, SlidersHorizontal, UserCog, UserPlus, UsersRound, X } from "lucide-react";

import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { AccionesPanel } from "./components/AccionesPanel.jsx";
import { CompanyModulesPanel } from "./components/CompanyModulesPanel.jsx";
import { CompanyModulesSummaryTable } from "./components/CompanyModulesSummaryTable.jsx";
import { CompanyProfilePanel } from "./components/CompanyProfilePanel.jsx";
import { CompanyThemePanel } from "./components/CompanyThemePanel.jsx";
import { CreateUserModal, EditUserModal } from "./components/UserModals.jsx";
import { TenantCreatePanel } from "./components/TenantCreatePanel.jsx";
import { UsersFilters } from "./components/UsersFilters.jsx";
import { UsersTable } from "./components/UsersTable.jsx";
import { useUsersManagementController } from "./hooks/useUsersManagementController.js";
import { filterVisibleRoles as domainFilterVisibleRoles } from "./usersDomain.js";

export const filterVisibleRoles = domainFilterVisibleRoles;

export function UsersManagementPage(props) {
  const {
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
  } = props;
  const users = useUsersManagementController({ session, canViewUsuariosGlobal });
  const isTenantsPanel = canViewUsuariosGlobal && users.activePanel === "tenants";
  const isAccionesPanel = canViewUsuariosGlobal && users.activePanel === "acciones";
  const isUsuariosPanel = !canViewUsuariosGlobal || users.activePanel === "usuarios";
  const isRefreshing = users.loading || users.empresasModulesLoading || users.asignacionLoading;

  const openTenantCreate = () => {
    users.setTenantSection("crear");
    users.setShowTenantEditPanel(false);
    users.setTenantFormErrors({});
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
        permissions={{
          pipeline: canViewPipeline,
          pedidos: canViewPedidos,
          produccion: canViewProduccion,
          domicilios: canViewDomicilios,
          barrios: canViewBarrios,
          inventario: canViewInventario,
          contabilidad: canViewContabilidad,
          clientes: canViewClientesPanel,
          usuarios: true,
        }}
        navigation={{
          pipeline: onGoPipeline,
          pedidos: onGoPedidos,
          produccion: onGoProduccion,
          domicilios: onGoDomicilios,
          barrios: onGoBarrios,
          inventario: onGoInventario,
          contabilidad: onGoContabilidad,
          clientes: onGoClientes,
          usuarios: onGoUsuarios,
        }}
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
              <button type="button" className="btn-primary users-create-open-btn" onClick={openTenantCreate}>
                <Building2 size={18} strokeWidth={2} aria-hidden="true" />
                Nueva empresa
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
              onClick={isTenantsPanel ? users.loadEmpresasModuloResumen : (isAccionesPanel ? users.loadAsignacionConfig : users.loadUsers)}
              disabled={isRefreshing}
            >
              <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </header>

        <nav className="users-section-tabs" aria-label="Secciones de gestion">
          {canViewUsuariosGlobal ? (
            <button type="button" className={isTenantsPanel ? "is-active" : ""} onClick={() => users.setActivePanel("tenants")}>
              <Building2 size={16} strokeWidth={2} aria-hidden="true" />
              Empresas
            </button>
          ) : null}
          <button type="button" className={isUsuariosPanel ? "is-active" : ""} onClick={() => users.setActivePanel("usuarios")}>
            <UsersRound size={16} strokeWidth={2} aria-hidden="true" />
            Usuarios
          </button>
          {canViewUsuariosGlobal ? (
            <>
              <button type="button" className={isAccionesPanel ? "is-active" : ""} onClick={() => users.setActivePanel("acciones")}>
                <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
                Acciones
              </button>
            </>
          ) : null}
        </nav>

        {isUsuariosPanel ? (
          <UsersFilters
            canViewUsuariosGlobal={canViewUsuariosGlobal}
            empresaID={users.usersEmpresaID}
            setEmpresaID={users.setUsersEmpresaID}
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

        {users.tenantCredentialsToast ? (
          <TenantCredentialsToast
            toast={users.tenantCredentialsToast}
            onClose={() => users.setTenantCredentialsToast(null)}
            onGo={() => {
              if (users.tenantCredentialsToast.empresaID) users.setEmpresaID(users.tenantCredentialsToast.empresaID);
              users.setTenantCredentialsToast(null);
              users.setActivePanel("tenants");
            }}
          />
        ) : null}

        {isTenantsPanel ? (
          <section className="users-tenants-layout">
            <nav className="users-section-tabs users-tenant-subtabs" aria-label="Secciones de empresas">
              <button type="button" className={users.tenantSection === "crear" ? "is-active" : ""} onClick={openTenantCreate}>
                <Building2 size={16} strokeWidth={2} aria-hidden="true" />
                Crear empresa
              </button>
              <button type="button" className={users.tenantSection === "perfil" ? "is-active" : ""} onClick={() => users.setTenantSection("perfil")}>Perfil de la empresa</button>
              <button type="button" className={users.tenantSection === "tema" ? "is-active" : ""} onClick={() => users.setTenantSection("tema")}>Tema visual (catalogo web)</button>
              <button type="button" className={users.tenantSection === "modulos" ? "is-active" : ""} onClick={() => users.setTenantSection("modulos")}>Habilitacion comercial de modulos</button>
              <button type="button" className={users.tenantSection === "resumen" ? "is-active" : ""} onClick={() => users.setTenantSection("resumen")}>Modulos por empresa</button>
            </nav>

            {users.tenantSection === "crear" ? (
              <TenantCreatePanel form={users.tenantForm} setForm={users.setTenantForm} saving={users.saving} onSubmit={users.submitCreateTenant} fieldErrors={users.tenantFormErrors} mode="create" />
            ) : null}

            {users.showTenantEditPanel ? (
              <TenantCreatePanel
                form={users.tenantEditForm}
                setForm={users.setTenantEditForm}
                saving={users.saving}
                onSubmit={users.submitEditTenant}
                onCancel={() => {
                  users.setTenantEditFormErrors({});
                  users.setShowTenantEditPanel(false);
                }}
                fieldErrors={users.tenantEditFormErrors}
                mode="edit"
              />
            ) : null}

            {users.tenantSection === "perfil" ? (
              <CompanyProfilePanel empresaID={users.empresaID} empresaSeleccionadaNombre={users.empresaSeleccionadaNombre} empresas={users.empresas} setEmpresaID={users.setEmpresaID} loading={users.companyProfileLoading} profileForm={users.companyProfileForm} setProfileForm={users.setCompanyProfileForm} profileSaving={users.companyProfileSaving} onSaveProfile={users.saveCompanyProfile} />
            ) : null}
            {users.tenantSection === "tema" ? (
              <CompanyThemePanel empresaID={users.empresaID} empresaSeleccionadaNombre={users.empresaSeleccionadaNombre} empresas={users.empresas} setEmpresaID={users.setEmpresaID} loading={users.companyProfileLoading} themeForm={users.companyThemeForm} setThemeForm={users.setCompanyThemeForm} themeSaving={users.companyThemeSaving} onSaveTheme={users.saveCompanyTheme} />
            ) : null}
            {users.tenantSection === "modulos" ? (
              <CompanyModulesPanel empresaID={users.empresaID} empresaSeleccionadaNombre={users.empresaSeleccionadaNombre} empresas={users.empresas} setEmpresaID={users.setEmpresaID} modulesLoading={users.modulesLoading} moduleItems={users.moduleItems} onToggleModule={users.toggleModule} showAdvancedModules={users.showAdvancedModules} setShowAdvancedModules={users.setShowAdvancedModules} newModulo={users.newModulo} setNewModulo={users.setNewModulo} onAddModulo={users.addModulo} modulesSaving={users.modulesSaving} onSaveModules={users.saveModules} onEditCompany={() => users.startEditTenant()} />
            ) : null}
            {users.tenantSection === "resumen" ? (
              <CompanyModulesSummaryTable loading={users.empresasModulesLoading} items={users.empresasModuloResumen} onEditCompany={users.startEditTenant} />
            ) : null}
          </section>
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
            notificacionesModuloActivo={users.moduleItems.some(
              item => String(item.modulo || "").trim().toLowerCase() === "notificaciones_whatsapp" && item.activo
            )}
            notificacionPedidoAceptadoActiva={users.asignacionConfig.notificacionPedidoAceptadoActiva}
            notificacionPedidoEntregadoActiva={users.asignacionConfig.notificacionPedidoEntregadoActiva}
            notificacionNuevoPedidoDomiciliarioActiva={users.asignacionConfig.notificacionNuevoPedidoDomiciliarioActiva}
            vozPedidosActiva={users.asignacionConfig.vozPedidosActiva}
            onToggleProduccion={users.toggleAsignacionProduccion}
            onToggleDomicilio={users.toggleAsignacionDomicilio}
            onToggleAutoAsignacionProduccion={users.toggleAutoAsignacionProduccion}
            onToggleNotificacionPedidoAceptado={users.toggleNotificacionPedidoAceptado}
            onToggleNotificacionPedidoEntregado={users.toggleNotificacionPedidoEntregado}
            onToggleNotificacionNuevoPedidoDomiciliario={users.toggleNotificacionNuevoPedidoDomiciliario}
            onToggleVozPedidos={users.toggleVozPedidos}
          />
        ) : (
          <section className="users-grid-layout users-list-layout">
            <UsersTable items={users.items} canViewUsuariosGlobal={canViewUsuariosGlobal} sessionUserID={session?.userID} onEdit={users.startEditUser} onToggleEstado={users.toggleEstado} onDelete={users.deleteUser} />
          </section>
        )}
      </main>

      {users.showCreateModal ? <CreateUserModal empresaSeleccionadaNombre={users.empresaSeleccionadaNombre} empresaID={users.empresaID} empresas={users.empresas} setEmpresaID={users.setEmpresaID} canViewUsuariosGlobal={canViewUsuariosGlobal} onClose={users.closeCreateModal} formProps={users.createFormProps} /> : null}
      {users.showEditDrawer ? <EditUserModal editingUserId={users.editingUserId} editForm={users.editForm} empresaSeleccionadaNombre={users.empresaSeleccionadaNombre} empresaID={users.empresaID} onClose={users.closeEditDrawer} formProps={users.editFormProps} /> : null}
    </div>
  );
}

function TenantCredentialsToast({ toast, onClose, onGo }) {
  return (
    <aside className="users-tenant-credentials-toast" role="status" aria-live="polite">
      <div className="users-tenant-credentials-head">
        <div>
          <strong>Empresa creada</strong>
          <span>{toast.tenant}</span>
        </div>
        <button type="button" className="users-tenant-credentials-close" onClick={onClose} aria-label="Cerrar credenciales" title="Cerrar">
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <dl className="users-tenant-credentials-list">
        <div>
          <dt><Building2 size={14} strokeWidth={2} aria-hidden="true" /> Empresa</dt>
          <dd>{toast.tenant}</dd>
        </div>
        <div>
          <dt>URL del catalogo</dt>
          <dd>{toast.catalogUrl ? <a href={toast.catalogUrl} target="_blank" rel="noreferrer">{toast.catalogUrl}</a> : "Pendiente"}</dd>
        </div>
        <div>
          <dt><Mail size={14} strokeWidth={2} aria-hidden="true" /> Email admin</dt>
          <dd>{toast.adminEmail || "No configurado"}</dd>
        </div>
        {toast.logoPending ? (
          <div>
            <dt>Logo</dt>
            <dd>Pendiente de carga</dd>
          </div>
        ) : null}
        <div>
          <dt><UserCog size={14} strokeWidth={2} aria-hidden="true" /> Usuario</dt>
          <dd>{toast.usuario || "No configurado"}</dd>
        </div>
        {toast.password ? (
          <div>
            <dt><KeyRound size={14} strokeWidth={2} aria-hidden="true" /> Contrasena</dt>
            <dd>{toast.password}</dd>
          </div>
        ) : null}
      </dl>
      <button type="button" className="btn-primary users-tenant-confirm-action" onClick={onGo}>
        <Building2 size={16} strokeWidth={2} aria-hidden="true" />
        Ir a la empresa
      </button>
    </aside>
  );
}
