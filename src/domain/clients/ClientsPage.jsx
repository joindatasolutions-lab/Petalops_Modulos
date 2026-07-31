import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { tenantConfig } from "../../config/tenantConfig.js";
import { createApiClient } from "../../infrastructure/apiClient.js";
import { AppSidebar } from "../../shared/AppSidebar.jsx";
import { useSidebarState } from "../../shared/useSidebarState.js";
import { todayIsoDateBogota } from "../../shared/utils.js";
import { BadgeCheck, BarChart3, Cake, ChevronDown, Download, MailCheck, Plus, RefreshCw, Search, Sparkles, TrendingUp, UserCheck, UsersRound } from "lucide-react";

const CLIENTS_VIEWS = [
  { key: "clientes", label: "Clientes" },
  { key: "metricas", label: "Métricas" },
];

const CLIENTS_VIEW_ICONS = {
  clientes: UsersRound,
  metricas: BarChart3,
};

const initialForm = {
  tipoIdent: "CC",
  identificacion: "",
  indicativo: "+57",
  nombreCompleto: "",
  telefono: "",
  telefonoCompleto: "",
  email: "",
  fechaCumpleanos: "",
  fechaAniversario: "",
  activo: true,
};

function normalizePhoneComplete(indicativo, telefono) {
  const prefix = String(indicativo || "").trim();
  const number = String(telefono || "").trim();
  if (!prefix && !number) return "";
  if (!prefix) return number;
  if (!number) return prefix;
  return `${prefix}${number}`;
}

function isEmpresaAdminRole(session) {
  const role = String(session?.rol || "").trim().toLowerCase().replace(/\s+/g, "_");
  return Boolean(session?.esGlobalJoin) || role === "admin" || role === "empresa_admin";
}

function monthFromDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const parts = text.slice(0, 10).split("-");
  if (parts.length >= 2) return parts[1];
  return "";
}

function percentValue(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 1)) * 100);
}

function initialsFromName(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CL";
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

export function ClientsPage({
  session,
  canViewPipeline,
  canViewPedidos,
  canViewProduccion,
  canViewDomicilios,
  canViewBarrios,
  canViewInventario,
  canViewContabilidad,
  canViewClientesPanel,
  canViewUsuariosPanel,
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
  const api = useMemo(() => createApiClient(tenantConfig), []);
  const empresaId = Number(session?.empresaID || tenantConfig.empresaId);
  const canManageClients = isEmpresaAdminRole(session);
  const displayUserName = useMemo(
    () => String(session?.nombre || session?.login || "Usuario").trim() || "Usuario",
    [session]
  );

  const { sidebarPinned, sidebarMobileOpen, setSidebarMobileOpen, toggleSidebar } = useSidebarState();
  const [activeView, setActiveView] = useState("clientes");
  const [clientsMenuOpen, setClientsMenuOpen] = useState(false);
  const clientsMenuRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const clientsIntelligence = useMemo(() => {
    const currentMonth = todayIsoDateBogota().slice(5, 7);
    const total = items.length;
    const activos = items.filter(item => Boolean(item.activo)).length;
    const inactivos = Math.max(total - activos, 0);
    const conTelefono = items.filter(item => String(item.telefonoCompleto || item.telefono || "").trim()).length;
    const conEmail = items.filter(item => String(item.email || "").trim()).length;
    const conDocumento = items.filter(item => String(item.identificacion || "").trim()).length;
    const cumpleMes = items.filter(item => monthFromDate(item.fechaCumpleanos) === currentMonth).length;
    const aniversarioMes = items.filter(item => monthFromDate(item.fechaAniversario) === currentMonth).length;
    const completos = items.filter(item =>
      String(item.nombreCompleto || "").trim() &&
      String(item.telefonoCompleto || item.telefono || "").trim() &&
      String(item.email || "").trim() &&
      String(item.identificacion || "").trim()
    ).length;

    const byDocument = items.reduce((map, item) => {
      const key = String(item.tipoIdent || "Sin tipo").trim() || "Sin tipo";
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());

    const byIndicative = items.reduce((map, item) => {
      const key = String(item.indicativo || "Sin indicativo").trim() || "Sin indicativo";
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());

    const documentRows = Array.from(byDocument.entries())
      .map(([label, value]) => ({ key: label, label, value, pct: percentValue(value, total) }))
      .sort((a, b) => b.value - a.value);

    const indicativeRows = Array.from(byIndicative.entries())
      .map(([label, value]) => ({ key: label, label, value, pct: percentValue(value, total) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const qualityRows = [
      { key: "telefono", label: "Telefono", value: conTelefono, pct: percentValue(conTelefono, total), color: "#16a34a" },
      { key: "email", label: "Email", value: conEmail, pct: percentValue(conEmail, total), color: "#2563eb" },
      { key: "documento", label: "Documento", value: conDocumento, pct: percentValue(conDocumento, total), color: "#7c3aed" },
      { key: "completos", label: "Ficha completa", value: completos, pct: percentValue(completos, total), color: "#e91e72" },
    ];

    const topMissing = [
      { label: "Sin telefono", value: total - conTelefono, color: "#ea580c" },
      { label: "Sin email", value: total - conEmail, color: "#dc2626" },
      { label: "Sin documento", value: total - conDocumento, color: "#d97706" },
    ].sort((a, b) => b.value - a.value)[0];

    return {
      total,
      activos,
      inactivos,
      conTelefono,
      conEmail,
      conDocumento,
      cumpleMes,
      aniversarioMes,
      completos,
      activosPct: percentValue(activos, total),
      contactabilidadPct: percentValue(conTelefono, total),
      emailPct: percentValue(conEmail, total),
      completitudPct: percentValue(completos, total),
      documentRows,
      indicativeRows,
      qualityRows,
      topMissing,
      destacados: items.slice(0, 5),
    };
  }, [items]);


  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listarClientes({ empresaId, q, soloActivos: false });
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (nextError) {
      console.error("Error cargando clientes:", nextError);
      setItems([]);
      setError(nextError?.message || "No fue posible cargar clientes.");
    } finally {
      setLoading(false);
    }
  }, [api, empresaId, q]);

  useEffect(() => {
    loadClientes().catch(() => {});
  }, [loadClientes]);

  useEffect(() => {
    if (!clientsMenuOpen) return undefined;
    const handlePointerDown = event => {
      if (clientsMenuRef.current && !clientsMenuRef.current.contains(event.target)) {
        setClientsMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [clientsMenuOpen]);


  const openCreate = () => {
    setEditingClienteId(null);
    setForm(initialForm);
    setDrawerOpen(true);
    setError("");
    setInfo("");
  };

  const openEdit = item => {
    if (!canManageClients) {
      setError("Solo administradores pueden editar clientes.");
      return;
    }
    setEditingClienteId(item.clienteID);
    setForm({
      tipoIdent: item.tipoIdent || "CC",
      identificacion: item.identificacion || "",
      indicativo: item.indicativo || "+57",
      nombreCompleto: item.nombreCompleto || "",
      telefono: item.telefono || "",
      telefonoCompleto: item.telefonoCompleto || "",
      email: item.email || "",
      fechaCumpleanos: item.fechaCumpleanos || "",
      fechaAniversario: item.fechaAniversario || "",
      activo: Boolean(item.activo),
    });
    setDrawerOpen(true);
    setError("");
    setInfo("");
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingClienteId(null);
    setForm(initialForm);
  };

  const onChangeForm = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const exportClientesExcel = async () => {
    if (items.length === 0) return;
    setError("");
    setInfo("");
    try {
      const rows = items.map(item => ({
        "ID": item.clienteID,
        "Tipo documento": item.tipoIdent || "",
        "Documento": item.identificacion || "",
        "Nombre completo": item.nombreCompleto || "",
        "Indicativo": item.indicativo || "",
        "Teléfono": item.telefono || "",
        "Teléfono completo": item.telefonoCompleto || "",
        "Email": item.email || "",
        "Cumpleaños": item.fechaCumpleanos || "",
        "Aniversario": item.fechaAniversario || "",
        "Estado": item.activo ? "Activo" : "Inactivo",
      }));
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
      XLSX.writeFile(workbook, `clientes-${todayIsoDateBogota()}.xlsx`);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible exportar los clientes.");
    }
  };

  const exportMetricasExcel = async () => {
    if (items.length === 0) return;
    setError("");
    setInfo("");
    try {
      const ci = clientsIntelligence;
      const resumen = [
        { "Indicador": "Total clientes", "Valor": ci.total },
        { "Indicador": "Clientes activos", "Valor": ci.activos },
        { "Indicador": "Clientes inactivos", "Valor": ci.inactivos },
        { "Indicador": "Con teléfono", "Valor": ci.conTelefono },
        { "Indicador": "Con email", "Valor": ci.conEmail },
        { "Indicador": "Con documento", "Valor": ci.conDocumento },
        { "Indicador": "Ficha completa", "Valor": ci.completos },
        { "Indicador": "Cumpleaños este mes", "Valor": ci.cumpleMes },
        { "Indicador": "Aniversarios este mes", "Valor": ci.aniversarioMes },
        { "Indicador": "% Activos", "Valor": `${ci.activosPct}%` },
        { "Indicador": "% Contactabilidad", "Valor": `${ci.contactabilidadPct}%` },
        { "Indicador": "% Ficha completa", "Valor": `${ci.completitudPct}%` },
      ];
      const calidad = ci.qualityRows.map(row => ({ "Campo": row.label, "Clientes": row.value, "Porcentaje": `${row.pct}%` }));
      const documentos = ci.documentRows.map(row => ({ "Tipo documento": row.label, "Clientes": row.value, "Porcentaje": `${row.pct}%` }));
      const indicativos = ci.indicativeRows.map(row => ({ "Indicativo": row.label, "Clientes": row.value, "Porcentaje": `${row.pct}%` }));
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumen), "Resumen");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(calidad), "Calidad directorio");
      if (documentos.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(documentos), "Tipos de documento");
      if (indicativos.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(indicativos), "Indicativos");
      XLSX.writeFile(workbook, `metricas-clientes-${todayIsoDateBogota()}.xlsx`);
    } catch (nextError) {
      setError(nextError?.message || "No fue posible exportar las métricas.");
    }
  };

  const onSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const payload = {
        empresaID: empresaId,
        tipoIdent: String(form.tipoIdent || "").trim() || null,
        identificacion: String(form.identificacion || "").trim() || null,
        indicativo: String(form.indicativo || "").trim() || null,
        nombreCompleto: String(form.nombreCompleto || "").trim(),
        telefono: String(form.telefono || "").trim() || null,
        telefonoCompleto: normalizePhoneComplete(form.indicativo, form.telefono) || null,
        email: String(form.email || "").trim() || null,
        fechaCumpleanos: form.fechaCumpleanos || null,
        fechaAniversario: form.fechaAniversario || null,
        activo: Boolean(form.activo),
      };
      if (editingClienteId != null) {
        await api.actualizarCliente({ clienteId: editingClienteId, ...payload });
        setInfo("Cliente actualizado correctamente.");
      } else {
        await api.crearCliente(payload);
        setInfo("Cliente creado correctamente.");
      }
      closeDrawer();
      await loadClientes();
    } catch (nextError) {
      console.error("Error guardando cliente:", nextError);
      setError(nextError?.message || "No fue posible guardar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`app-shell ${sidebarPinned ? "is-sidebar-pinned" : ""} ${sidebarMobileOpen ? "is-sidebar-mobile-open" : ""}`}>
      <AppSidebar
        activeKey="clientes"
        sidebarPinned={sidebarPinned}
        sidebarMobileOpen={sidebarMobileOpen}
        toggleSidebar={toggleSidebar}
        closeSidebarMobile={() => setSidebarMobileOpen(false)}
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
          usuarios: canViewUsuariosPanel,
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

      <main className="orders-admin-view clients-page-view">
        <header className="orders-admin-header orders-page-header clients-page-header">
          <div className="orders-page-heading">
            <div className="orders-page-title-row">
              <h1>Clientes</h1>
            </div>
          </div>
          <div className="orders-header-side">
            <div className="header-actions">
              <div className="accounting-menu-dropdown clients-menu-dropdown" ref={clientsMenuRef}>
                <button
                  type="button"
                  className={`btn-outline accounting-menu-trigger clients-menu-trigger${clientsMenuOpen ? " is-open" : ""}`}
                  onClick={() => setClientsMenuOpen(current => !current)}
                  aria-expanded={clientsMenuOpen}
                  aria-haspopup="menu"
                >
                  {(() => {
                    const activeOption = CLIENTS_VIEWS.find(item => item.key === activeView) || CLIENTS_VIEWS[0];
                    const ActiveIcon = CLIENTS_VIEW_ICONS[activeOption.key] || UsersRound;
                    return (
                      <>
                        <ActiveIcon size={18} strokeWidth={2} aria-hidden="true" />
                        <span>{activeOption.label}</span>
                        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
                      </>
                    );
                  })()}
                </button>
                {clientsMenuOpen ? (
                  <div className="accounting-menu-panel clients-menu-panel" role="menu">
                    {CLIENTS_VIEWS.map(item => {
                      const Icon = CLIENTS_VIEW_ICONS[item.key] || UsersRound;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          className={activeView === item.key ? "is-active" : ""}
                          onClick={() => {
                            setActiveView(item.key);
                            setClientsMenuOpen(false);
                          }}
                        >
                          <Icon size={16} strokeWidth={2} aria-hidden="true" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn-primary orders-header-refresh" onClick={() => loadClientes()} disabled={loading}>
                <RefreshCw size={18} strokeWidth={2} aria-hidden="true" />
                <span>{loading ? "Actualizando..." : "Actualizar"}</span>
              </button>
              <button type="button" className="btn-primary orders-header-refresh" onClick={openCreate}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                <span>Agregar</span>
              </button>
            </div>
            {activeView === "metricas" ? (
              <div className="orders-header-metrics clients-header-metrics" aria-label="Metricas de clientes">
                <article className="orders-header-metric-card is-primary">
                  <span className="orders-header-metric-icon" aria-hidden="true"><UsersRound size={16} strokeWidth={2} /></span>
                  <strong>{clientsIntelligence.total}</strong>
                  <span>Total clientes</span>
                </article>
                <article className="orders-header-metric-card is-green">
                  <span className="orders-header-metric-icon" aria-hidden="true"><UserCheck size={16} strokeWidth={2} /></span>
                  <strong>{clientsIntelligence.activos}</strong>
                  <span>Clientes activos</span>
                </article>
                <article className="orders-header-metric-card is-blue">
                  <span className="orders-header-metric-icon" aria-hidden="true"><MailCheck size={16} strokeWidth={2} /></span>
                  <strong>{clientsIntelligence.contactabilidadPct}%</strong>
                  <span>Contactabilidad</span>
                </article>
                <article className="orders-header-metric-card is-purple">
                  <span className="orders-header-metric-icon" aria-hidden="true"><BadgeCheck size={16} strokeWidth={2} /></span>
                  <strong>{clientsIntelligence.completitudPct}%</strong>
                  <span>Ficha completa</span>
                </article>
                <article className="orders-header-metric-card is-orange">
                  <span className="orders-header-metric-icon" aria-hidden="true"><Cake size={16} strokeWidth={2} /></span>
                  <strong>{clientsIntelligence.cumpleMes + clientsIntelligence.aniversarioMes}</strong>
                  <span>Fechas clave</span>
                </article>
              </div>
            ) : null}
          </div>
        </header>

        {error ? <p className="orders-message">{error}</p> : null}
        {info ? <p className="orders-message">{info}</p> : null}
        {loading ? <p className="orders-message">Cargando clientes...</p> : null}

        {activeView === "metricas" ? (
        <section className="clients-table-toolbar clients-metrics-toolbar" aria-label="Acciones de metricas">
          <div className="clients-table-toolbar-copy">
            <span className="clients-table-toolbar-label">Business intelligence</span>
            <strong>Descarga el resumen de metricas del directorio</strong>
          </div>
          <button
            type="button"
            className="btn-outline clients-download-btn"
            onClick={exportMetricasExcel}
            disabled={loading || items.length === 0}
          >
            <Download size={17} strokeWidth={2} aria-hidden="true" />
            <span>Descargar metricas</span>
          </button>
        </section>
        ) : null}

        {activeView === "metricas" ? (
        <section className="clients-intelligence-grid" aria-label="Business intelligence de clientes">
          <article className="clients-intelligence-panel clients-quality-panel">
            <div className="clients-panel-head">
              <div>
                <span>Calidad del directorio</span>
                <h3>Datos que si permiten accionar</h3>
              </div>
              <Sparkles size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="clients-quality-bars">
              {clientsIntelligence.qualityRows.map(row => (
                <div key={row.key} className="clients-quality-row" style={{ "--client-row-color": row.color }}>
                  <div>
                    <strong>{row.label}</strong>
                    <span>{row.value} clientes</span>
                  </div>
                  <i><b style={{ width: `${row.pct}%` }} /></i>
                  <em>{row.pct}%</em>
                </div>
              ))}
            </div>
          </article>

          <article className="clients-intelligence-panel clients-document-panel">
            <div className="clients-panel-head">
              <div>
                <span>Segmentacion</span>
                <h3>Tipos de documento</h3>
              </div>
              <TrendingUp size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="clients-donut-wrap">
              <div
                className="clients-donut"
                style={{
                  "--client-active": `${clientsIntelligence.activosPct}%`,
                  "--client-email": `${clientsIntelligence.emailPct}%`,
                }}
              >
                <strong>{clientsIntelligence.activosPct}%</strong>
                <span>activos</span>
              </div>
              <div className="clients-document-list">
                {clientsIntelligence.documentRows.length === 0 ? (
                  <p className="accounting-empty-state">No hay datos para segmentar.</p>
                ) : clientsIntelligence.documentRows.map(row => (
                  <div key={row.key} className="clients-document-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                    <i><b style={{ width: `${row.pct}%` }} /></i>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="clients-intelligence-panel clients-geo-panel">
            <div className="clients-panel-head">
              <div>
                <span>Origen telefonico</span>
                <h3>Indicativos mas usados</h3>
              </div>
              <UsersRound size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="clients-pills-chart">
              {clientsIntelligence.indicativeRows.length === 0 ? (
                <p className="accounting-empty-state">No hay telefonos registrados.</p>
              ) : clientsIntelligence.indicativeRows.map((row, index) => (
                <div key={row.key} className="clients-pill-row" style={{ "--client-index": index }}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <i style={{ width: `${Math.max(row.pct, 8)}%` }} />
                </div>
              ))}
            </div>
          </article>

          <article className="clients-intelligence-panel clients-insight-panel">
            <div className="clients-panel-head">
              <div>
                <span>Lectura rapida</span>
                <h3>Prioridad operativa</h3>
              </div>
              <BadgeCheck size={22} strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="clients-insight-copy">
              <strong>{clientsIntelligence.topMissing?.label || "Base equilibrada"}</strong>
              <p>
                {clientsIntelligence.topMissing?.value
                  ? `${clientsIntelligence.topMissing.value} clientes requieren completar este dato para mejorar campanas, confirmaciones y seguimiento.`
                  : "La base visible esta completa para los campos principales."}
              </p>
            </div>
            <div className="clients-mini-list">
              {clientsIntelligence.destacados.length === 0 ? (
                <p className="accounting-empty-state">No hay clientes visibles.</p>
              ) : clientsIntelligence.destacados.map(item => (
                <div key={item.clienteID} className="clients-mini-item">
                  <span>{initialsFromName(item.nombreCompleto)}</span>
                  <div>
                    <strong>{item.nombreCompleto || "Cliente sin nombre"}</strong>
                    <small>{item.telefonoCompleto || item.telefono || item.email || "Sin contacto"}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
        ) : null}

        {activeView === "clientes" ? (
        <>
        <section className="clients-table-toolbar" aria-label="Busqueda de clientes">
          <div className="clients-table-toolbar-copy">
            <span className="clients-table-toolbar-label">Detalle de clientes</span>
            <strong>Busca al cliente sin salir de la tabla</strong>
          </div>
          <div className="clients-table-toolbar-actions">
            <div className="orders-filter-control clients-search-control">
              <Search size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="text"
                placeholder="Buscar por nombre, documento, telefono o email"
                value={q}
                onChange={event => setQ(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-outline clients-download-btn"
              onClick={exportClientesExcel}
              disabled={items.length === 0}
            >
              <Download size={17} strokeWidth={2} aria-hidden="true" />
              <span>Descargar Excel</span>
            </button>
          </div>
        </section>

        <section className="orders-table-wrap clients-table-wrap">
          <table className="orders-table users-table clients-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo Doc</th>
                <th>Documento</th>
                <th>Nombre</th>
                <th>Indicativo</th>
                <th>Teléfono</th>
                <th>Teléfono completo</th>
                <th>Email</th>
                <th>Cumpleaños</th>
                <th>Aniversario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12}>No hay clientes registrados.</td>
                </tr>
              ) : items.map(item => (
                <tr key={item.clienteID}>
                  <td data-label="ID">{item.clienteID}</td>
                  <td data-label="Tipo Doc">{item.tipoIdent || "-"}</td>
                  <td data-label="Documento">{item.identificacion || "-"}</td>
                  <td data-label="Nombre">{item.nombreCompleto || "-"}</td>
                  <td data-label="Indicativo">{item.indicativo || "-"}</td>
                  <td data-label="Teléfono">{item.telefono || "-"}</td>
                  <td data-label="Teléfono completo">{item.telefonoCompleto || "-"}</td>
                  <td data-label="Email">{item.email || "-"}</td>
                  <td data-label="Cumpleaños">{item.fechaCumpleanos || "-"}</td>
                  <td data-label="Aniversario">{item.fechaAniversario || "-"}</td>
                  <td data-label="Estado">
                    <span className={`order-badge ${item.activo ? "is-entregado" : "is-cancelado"}`}>
                      {item.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <button type="button" className="btn-outline" onClick={() => openEdit(item)} disabled={!canManageClients} title={canManageClients ? "Editar cliente" : "Solo administradores pueden editar clientes"}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        </>
        ) : null}
      </main>

      <aside className={`orders-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="orders-drawer-head">
          <strong>{editingClienteId != null ? "Editar cliente" : "Agregar cliente"}</strong>
          <div className="orders-drawer-head-actions">
            <button type="button" className="icon-btn" onClick={closeDrawer} title="Cerrar barra lateral">✕</button>
          </div>
        </div>

        <div className="orders-drawer-body">
          {!drawerOpen ? (
            <p className="order-drawer-empty">Usa Agregar o Editar para administrar clientes.</p>
          ) : (
            <form className="users-create-form" onSubmit={onSubmit}>
              <label className="order-detail-edit-label">
                Tipo documento
                <select value={form.tipoIdent} onChange={event => onChangeForm("tipoIdent", event.target.value)}>
                  <option value="CC">CC</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">CE</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </label>
              <label className="order-detail-edit-label">
                Documento
                <input type="text" value={form.identificacion} onChange={event => onChangeForm("identificacion", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Nombre completo
                <input type="text" value={form.nombreCompleto} onChange={event => onChangeForm("nombreCompleto", event.target.value)} required />
              </label>
              <label className="order-detail-edit-label">
                Indicativo
                <input type="text" value={form.indicativo} onChange={event => onChangeForm("indicativo", event.target.value)} placeholder="+57" />
              </label>
              <label className="order-detail-edit-label">
                Teléfono
                <input type="text" value={form.telefono} onChange={event => onChangeForm("telefono", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Email
                <input type="email" value={form.email} onChange={event => onChangeForm("email", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Fecha cumpleaños
                <input type="date" value={form.fechaCumpleanos} onChange={event => onChangeForm("fechaCumpleanos", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Fecha aniversario
                <input type="date" value={form.fechaAniversario} onChange={event => onChangeForm("fechaAniversario", event.target.value)} />
              </label>
              <label className="order-detail-edit-label">
                Estado
                <select value={form.activo ? "1" : "0"} onChange={event => onChangeForm("activo", event.target.value === "1")}>
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </label>
              <div className="order-actions">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Guardando..." : editingClienteId != null ? "Editar" : "Agregar"}</button>
                <button type="button" className="btn-outline" onClick={closeDrawer} disabled={saving}>Cancelar</button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
