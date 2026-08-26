const PEDIDOS_MAX_PAGE_SIZE = 300;
const LOGIN_TIMEOUT_MS = 30000;
const NETWORK_ERROR_MESSAGE = "Sin conexión con el servidor. Verifica tu red e intenta de nuevo.";
const NETWORK_RETRY_DELAYS_MS = [500, 1200];

function isNetworkError(error) {
  return error instanceof TypeError;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toNetworkError(originalError) {
  const error = new Error(NETWORK_ERROR_MESSAGE);
  error.detail = NETWORK_ERROR_MESSAGE;
  error.isNetworkError = true;
  error.cause = originalError;
  return error;
}
const PRODUCTION_STATUS_CODE_BY_UI = {
  Pendiente: "PENDIENTE",
  EnProduccion: "EN_PROCESO",
  ParaEntrega: "LISTO",
  Cancelado: "CANCELADO",
};

function normalizePedidosDateParam(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text;
}

function normalizePedidosPageSize(value) {
  const parsed = Number(value || 20);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), PEDIDOS_MAX_PAGE_SIZE);
}

export function createApiClient(config) {
  const baseUrl = config.apiBaseUrl;

  const toHttpError = async response => {
    let detail = "";
    let code = "";
    let module = "";
    let requestId = "";
    try {
      const payload = await response.json();
      if (payload?.error?.message) {
        detail = String(payload.error.message || "").trim();
        code = String(payload.error.code || "").trim();
        module = String(payload.error.module || "").trim();
        requestId = String(payload.error.request_id || payload.error.requestId || "").trim();
      } else {
        detail = String(payload?.detail || "").trim();
      }
    } catch {
      detail = "";
    }

    const contextParts = [code, module ? `modulo ${module}` : "", requestId ? `request_id ${requestId}` : ""].filter(Boolean);
    const message = contextParts.length
      ? `${detail || `HTTP ${response.status}`} (${contextParts.join(" · ")})`
      : detail || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    error.code = code;
    error.module = module;
    error.requestId = requestId;
    return error;
  };

  const authFetch = async (path, options = {}) => {
    const token = globalThis.localStorage?.getItem("petalops_access_token");
    const headers = {
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const method = String(options.method || "GET").toUpperCase();
    const isRetryableRead = method === "GET";
    const attempts = isRetryableRead ? NETWORK_RETRY_DELAYS_MS.length + 1 : 1;

    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await fetch(`${baseUrl}${path}`, {
          ...options,
          headers,
        });
      } catch (error) {
        lastError = error;
        if (!isNetworkError(error) || attempt === attempts - 1) break;
        await delay(NETWORK_RETRY_DELAYS_MS[attempt]);
      }
    }

    throw isNetworkError(lastError) ? toNetworkError(lastError) : lastError;
  };

  const requestJson = async (path, options = {}) => {
    const response = await authFetch(path, options);
    if (!response.ok) throw await toHttpError(response);
    return response.json();
  };

  return {
    async login({ login, password }) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
      let response;

      try {
        response = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ login, password }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("No fue posible iniciar sesión. Verifica usuario y contraseña.");
        }
        throw isNetworkError(error) ? toNetworkError(error) : error;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) throw await toHttpError(response);     

      const data = await response.json();    

      localStorage.setItem("petalops_access_token", data.accessToken);     

      return data;
    },

    async me() {
      return requestJson("/auth/me");
    },

    async crearUsuario({ nombre, login, password, email, rolID, rolesIDs = null, sucursalID, estado = "Activo" }) {
      return requestJson("/auth/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID: null,
          nombre,
          login,
          password,
          email,
          rolID,
          rolesIDs,
          sucursalID,
          estado,
        })
      });
    },

    async listarUsuariosGestion({ empresaId, sucursalId, estado, q }) {
      const params = new URLSearchParams();
      if (empresaId != null) params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (estado) params.set("estado", String(estado));
      if (q) params.set("q", String(q));
      return requestJson(`/auth/usuarios?${params.toString()}`);
    },

    async crearUsuarioGestion({ empresaID, nombre, login, password, email, rolID, rolesIDs = null, sucursalID, estado = "Activo", modulosAcceso = null }) {
      return requestJson("/auth/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID,
          nombre,
          login,
          password,
          email,
          rolID,
          rolesIDs,
          sucursalID,
          estado,
          modulosAcceso,
        })
      });
    },

    async actualizarEstadoUsuario({ userId, estado }) {
      return requestJson(`/auth/usuarios/${userId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ estado })
      });
    },

    async obtenerUsuarioGestion({ userId }) {
      return requestJson(`/auth/usuarios/id/${userId}`);
    },

    async actualizarUsuarioGestion({ userId, nombre, login, password = "", email, rolID, rolesIDs = null, sucursalID, estado = "Activo", modulosAcceso = null }) {
      const payload = {
        nombre,
        login,
        email,
        rolID,
        rolesIDs,
        sucursalID,
        estado,
        modulosAcceso,
      };
      if (password && String(password).trim()) {
        payload.password = password;
      }
      return requestJson(`/auth/usuarios/id/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async eliminarUsuarioGestion({ userId }) {
      return requestJson(`/auth/usuarios/id/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
      });
    },

    async listarRolesEmpresa({ empresaId }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/auth/usuarios/roles?${params.toString()}`);
    },

    async listarSucursalesEmpresa({ empresaId }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/auth/usuarios/sucursales?${params.toString()}`);
    },

    async listarEmpresasGestion() {
      return requestJson("/auth/usuarios/empresas");
    },

    async listarClientes({ empresaId, q = "", celular = "", telefono = "", soloActivos = false, includeMetrics = false, page = null, pageSize = null }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (q) params.set("q", String(q));
      if (celular) params.set("celular", String(celular));
      if (telefono) params.set("telefono", String(telefono));
      if (soloActivos) params.set("soloActivos", "true");
      if (includeMetrics) params.set("includeMetrics", "true");
      if (page != null) params.set("page", String(page));
      if (pageSize != null) params.set("pageSize", String(pageSize));
      return requestJson(`/clientes?${params.toString()}`);
    },

    async obtenerMetricasClientes({ tenantId, startDate, endDate, comparison = true }) {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", String(startDate));
      if (endDate) params.set("end_date", String(endDate));
      if (comparison != null) params.set("comparison", comparison ? "true" : "false");
      return requestJson(`/tenants/${tenantId}/customers/metrics?${params.toString()}`);
    },

    async listarSegmentoClientes({ tenantId, segment = "AT_RISK", page = 1, limit = 10, sort = "purchase_count", order = "desc" }) {
      const params = new URLSearchParams();
      if (segment) params.set("segment", String(segment));
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", String(sort));
      params.set("order", String(order));
      return requestJson(`/tenants/${tenantId}/customers/segments?${params.toString()}`);
    },

    async listarPrioridadClientes({ tenantId, priority = "P0", page = 1, limit = 10, search = "", sort = "commercial_priority", order = "asc", startDate = "", endDate = "" }) {
      const params = new URLSearchParams();
      if (priority) params.set("priority", String(priority));
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", String(search));
      if (sort) params.set("sort", String(sort));
      if (order) params.set("order", String(order));
      if (startDate) params.set("start_date", String(startDate));
      if (endDate) params.set("end_date", String(endDate));
      return requestJson(`/tenants/${tenantId}/customers/priorities?${params.toString()}`);
    },

    async listarOportunidadesClientes({ tenantId, days = 30, page = 1, limit = 50, occasion = "" }) {
      const params = new URLSearchParams();
      params.set("days", String(days));
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (occasion) params.set("occasion", String(occasion));
      return requestJson(`/tenants/${tenantId}/customers/opportunities?${params.toString()}`);
    },

    async obtenerMetricasCliente({ tenantId, customerId }) {
      return requestJson(`/tenants/${tenantId}/customers/${customerId}/metrics`);
    },

    async listarInteligenciaClientes({ tenantId, action = "REACTIVATE", risk = "", minHealthScore = null, maxHealthScore = null, page = 1, limit = 50, sort = "customer_health_score", order = "asc" }) {
      const params = new URLSearchParams();
      params.set("action", String(action));
      if (risk) params.set("risk", String(risk));
      if (minHealthScore != null) params.set("min_health_score", String(minHealthScore));
      if (maxHealthScore != null) params.set("max_health_score", String(maxHealthScore));
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", String(sort));
      params.set("order", String(order));
      return requestJson(`/tenants/${tenantId}/customers/intelligence?${params.toString()}`);
    },

    async crearCliente({ empresaID, tipoIdent, identificacion, indicativo, nombreCompleto, telefono, telefonoCompleto, email, fechaCumpleanos, fechaAniversario, activo = true }) {
      return requestJson("/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID,
          tipoIdent,
          identificacion,
          indicativo,
          nombreCompleto,
          telefono,
          telefonoCompleto,
          email,
          fechaCumpleanos,
          fechaAniversario,
          activo,
        })
      });
    },

    async actualizarCliente({ clienteId, empresaID, tipoIdent, identificacion, indicativo, nombreCompleto, telefono, telefonoCompleto, email, fechaCumpleanos, fechaAniversario, activo = true }) {
      return requestJson(`/clientes/${clienteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID,
          tipoIdent,
          identificacion,
          indicativo,
          nombreCompleto,
          telefono,
          telefonoCompleto,
          email,
          fechaCumpleanos,
          fechaAniversario,
          activo,
        })
      });
    },

    async listarEmpresasModulosGestion() {
      return requestJson("/auth/usuarios/empresas/modulos");
    },

    async crearEmpresaGestion({ nombreComercial, planID, estado = "Activo", slug = "", adminLogin = "", adminPassword = "", adminEmail = "", sucursalNombre = "" }) {
      return requestJson("/auth/usuarios/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombreComercial,
          planID,
          estado,
          slug,
          adminLogin,
          adminPassword,
          adminEmail,
          sucursalNombre,
        })
      });
    },

    async listarModulosEmpresaGestion({ empresaId }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/auth/usuarios/modulos?${params.toString()}`);
    },

    async actualizarModulosEmpresaGestion({ empresaID, items }) {
      return requestJson("/auth/usuarios/modulos", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID,
          items,
        })
      });
    },

    async listarInventario({ empresaId, categoria, estado, proveedorId, q, soloCriticos = false }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (categoria) params.set("categoria", String(categoria));
      if (estado) params.set("estado", String(estado));
      if (proveedorId != null) params.set("proveedorID", String(proveedorId));
      if (q) params.set("q", String(q));
      params.set("soloCriticos", soloCriticos ? "true" : "false");
      return requestJson(`/inventario?${params.toString()}`);
    },

    async crearItemInventario(payload) {
      return requestJson("/inventario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async actualizarItemInventario({ inventarioId, payload }) {
      return requestJson(`/inventario/${inventarioId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async ajustarStockInventario({ inventarioId, payload }) {
      return requestJson(`/inventario/${inventarioId}/stock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async actualizarActivoInventario({ inventarioId, activo }) {
      return requestJson(`/inventario/${inventarioId}/activo`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ activo })
      });
    },

    async listarMovimientosInventario({ empresaId, inventarioId, tipo, q }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (inventarioId != null) params.set("inventarioID", String(inventarioId));
      if (tipo) params.set("tipo", String(tipo));
      if (q) params.set("q", String(q));
      return requestJson(`/inventario/movimientos?${params.toString()}`);
    },

    async listarProveedoresInventario({ empresaId, q }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (q) params.set("q", String(q));
      return requestJson(`/inventario/proveedores?${params.toString()}`);
    },

    async crearProveedorInventario({ empresaId, nombre, codigoProveedor, activo = true }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/inventario/proveedores?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombre,
          codigoProveedor,
          activo,
        })
      });
    },

    async listarRecetas({ empresaId, q, soloActivos = true }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (q) params.set("q", String(q));
      params.set("soloActivos", soloActivos ? "true" : "false");
      return requestJson(`/inventario/recetas?${params.toString()}`);
    },

    async obtenerReceta({ recetaId }) {
      return requestJson(`/inventario/recetas/${recetaId}`);
    },

    async crearReceta({ empresaId, nombre, descripcion }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/inventario/recetas?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion }),
      });
    },

    async actualizarReceta({ recetaId, nombre, descripcion, activo = true }) {
      return requestJson(`/inventario/recetas/${recetaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion, activo }),
      });
    },

    async eliminarReceta({ recetaId }) {
      return requestJson(`/inventario/recetas/${recetaId}`, {
        method: "DELETE",
      });
    },

    async agregarIngredienteReceta({ recetaId, inventarioID, cantidad }) {
      return requestJson(`/inventario/recetas/${recetaId}/ingredientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventarioID, cantidad }),
      });
    },

    async actualizarIngredienteReceta({ recetaId, detalleId, cantidad }) {
      return requestJson(`/inventario/recetas/${recetaId}/ingredientes/${detalleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad }),
      });
    },

    async eliminarIngredienteReceta({ recetaId, detalleId }) {
      return requestJson(`/inventario/recetas/${recetaId}/ingredientes/${detalleId}`, {
        method: "DELETE",
      });
    },

    async listarPedidos({ empresaId, sucursalId, q, estado, fechaDesde, fechaHasta, sinImprimir, soloTienda, page, pageSize }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (q) params.set("q", String(q));
      if (estado) params.set("estado", String(estado));
      const normalizedFechaDesde = normalizePedidosDateParam(fechaDesde);
      const normalizedFechaHasta = normalizePedidosDateParam(fechaHasta);
      if (normalizedFechaDesde) params.set("fechaDesde", normalizedFechaDesde);
      if (normalizedFechaHasta) params.set("fechaHasta", normalizedFechaHasta);
      params.set("sinImprimir", sinImprimir ? "true" : "false");
      if (soloTienda) params.set("soloTienda", "true");
      params.set("page", String(page || 1));
      params.set("pageSize", String(normalizePedidosPageSize(pageSize)));

      return requestJson(`/pedidos?${params.toString()}`);
    },

    async listarPipelinePedidos({
      empresaId,
      sucursalId,
      fecha,
      fechaDesde,
      fechaHasta,
      domiciliarioId,
      floristaId,
      numeroPedido,
      soloHoy = false,
      soloAtrasados = false,
      soloEnProduccion = false,
    }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fecha) params.set("fecha", String(fecha));
      if (fechaDesde) params.set("fechaDesde", String(fechaDesde));
      if (fechaHasta) params.set("fechaHasta", String(fechaHasta));
      if (domiciliarioId != null && String(domiciliarioId).trim()) params.set("domiciliarioID", String(domiciliarioId).trim());
      if (floristaId != null && String(floristaId).trim()) params.set("floristaID", String(floristaId).trim());
      if (numeroPedido) params.set("numeroPedido", String(numeroPedido));
      params.set("soloHoy", soloHoy ? "true" : "false");
      params.set("soloAtrasados", soloAtrasados ? "true" : "false");
      params.set("soloEnProduccion", soloEnProduccion ? "true" : "false");
      return requestJson(`/pipeline/pedidos?${params.toString()}`);
    },

    async cambiarEstadoPedidoPipeline({ pedidoId, nuevoEstadoId }) {
      return requestJson(`/pedido/${pedidoId}/estado/${nuevoEstadoId}`, {
        method: "PUT"
      });
    },

    async obtenerDetallePedido(pedidoId) {
      return requestJson(`/pedido/${pedidoId}/detalle`);
    },

    async buscarArreglosCatalogo({ empresaId, sucursalId, q = "" }) {
      const params = new URLSearchParams();
      if (sucursalId != null) params.set("sucursalId", String(sucursalId));
      if (q) params.set("q", q);
      return requestJson(`/catalogo/${empresaId}${params.toString() ? `?${params.toString()}` : ""}`);
    },

    async buscarBarrios({ empresaId, sucursalId, q }) {
      const params = new URLSearchParams();
      params.set("empresa_id", String(empresaId));
      params.set("sucursal_id", String(sucursalId));
      params.set("q", String(q || ""));
      return requestJson(`/barrios/search?${params.toString()}`);
    },

    async listarBarriosDomicilios({ sucursalId }) {
      const params = new URLSearchParams();
      params.set("sucursalID", String(sucursalId));
      return requestJson(`/barrios?${params.toString()}`);
    },

    async crearBarrioDomicilios({ sucursalID, zonaID, nombreBarrio, costoDomicilio, activo }) {
      return requestJson("/barrios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sucursalID,
          zonaID,
          nombreBarrio,
          costoDomicilio,
          activo,
        })
      });
    },

    async actualizarBarrioDomicilios({ barrioId, sucursalID, zonaID, nombreBarrio, costoDomicilio }) {
      return requestJson(`/barrios/${barrioId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sucursalID,
          zonaID,
          nombreBarrio,
          costoDomicilio,
        })
      });
    },

    async borrarBarrioDomicilios({ barrioId, sucursalID }) {
      const params = new URLSearchParams();
      params.set("sucursalID", String(sucursalID));
      return requestJson(`/barrios/${barrioId}?${params.toString()}`, {
        method: "DELETE",
      });
    },

    async crearPedidoCheckout(payload) {
      return requestJson("/pedido/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async crearPedidoManual(payload) {
      return requestJson("/pedido/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async actualizarDetallePedidoPipeline({
      pedidoId,
      detalleID,
      productoID,
      cantidad,
      productoObservaciones,
      precioUnitario,
      productoPrecio,
      fechaEntrega,
      horaEntrega,
      clienteNombre,
      clienteTelefono,
      clienteEmail,
      clienteTipoIdent,
      clienteIdentificacion,
      destinatarioNombre,
      telefonoDestino,
      direccion,
      barrioNombre,
      latitudDestino,
      longitudDestino,
      firma,
      mensajeTarjeta,
      observacionGeneral,
      metodosPago,
      detallePago,
      montoEfectivo,
      omitirRecargoLink,
      domicilio,
      costoDomicilio,
      domicilioOriginal,
      descuentoDomicilio,
      domicilioObsequiado,
      omitirCostoDomicilio,
      forzarRecalculoFinanciero,
      descuentoMonto,
      descuentoNota,
      saldoFavorMonto,
      saldoFavorNota,
      canalFlora,
    }) {
      const unitPrice = precioUnitario ?? productoPrecio;
      return requestJson(`/pedido/${pedidoId}/detalle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          detalleID: detalleID != null ? Number(detalleID) : null,
          productoID: productoID != null ? Number(productoID) : null,
          cantidad: cantidad != null ? Number(cantidad) : null,
          productoObservaciones: productoObservaciones ?? null,
          precioUnitario: unitPrice != null ? Number(unitPrice) : null,
          productoPrecio: unitPrice != null ? Number(unitPrice) : null,
          fechaEntrega: fechaEntrega || null,
          horaEntrega: horaEntrega || null,
          clienteNombre: clienteNombre ?? null,
          clienteTelefono: clienteTelefono ?? null,
          clienteEmail: clienteEmail ?? null,
          clienteTipoIdent: clienteTipoIdent ?? null,
          clienteIdentificacion: clienteIdentificacion ?? null,
          destinatarioNombre: destinatarioNombre ?? null,
          telefonoDestino: telefonoDestino ?? null,
          direccion: direccion ?? null,
          barrioNombre: barrioNombre ?? null,
          latitudDestino: latitudDestino != null ? Number(latitudDestino) : null,
          longitudDestino: longitudDestino != null ? Number(longitudDestino) : null,
          firma: firma ?? null,
          mensajeTarjeta: mensajeTarjeta ?? null,
          observacionGeneral: observacionGeneral ?? null,
          metodosPago: Array.isArray(metodosPago) ? metodosPago : null,
          detallePago: Array.isArray(detallePago) ? detallePago : null,
          montoEfectivo: montoEfectivo != null ? Number(montoEfectivo) : null,
          omitirRecargoLink: omitirRecargoLink != null ? Boolean(omitirRecargoLink) : null,
          domicilio: domicilio != null ? Number(domicilio) : null,
          costoDomicilio: (costoDomicilio ?? domicilio) != null ? Number(costoDomicilio ?? domicilio) : null,
          costo_domicilio: (costoDomicilio ?? domicilio) != null ? Number(costoDomicilio ?? domicilio) : null,
          domicilioOriginal: domicilioOriginal != null ? Number(domicilioOriginal) : null,
          descuentoDomicilio: descuentoDomicilio != null ? Number(descuentoDomicilio) : null,
          domicilioObsequiado: domicilioObsequiado != null ? Boolean(domicilioObsequiado) : null,
          domicilio_obsequiado: domicilioObsequiado != null ? Boolean(domicilioObsequiado) : null,
          domicilioObsequio: domicilioObsequiado != null ? Boolean(domicilioObsequiado) : null,
          domicilioGratis: domicilioObsequiado != null ? Boolean(domicilioObsequiado) : null,
          omitirCostoDomicilio: omitirCostoDomicilio != null ? Boolean(omitirCostoDomicilio) : null,
          omitir_costo_domicilio: omitirCostoDomicilio != null ? Boolean(omitirCostoDomicilio) : null,
          forzarRecalculoFinanciero: forzarRecalculoFinanciero != null ? Boolean(forzarRecalculoFinanciero) : null,
          descuentoMonto: descuentoMonto != null ? Number(descuentoMonto) : null,
          descuentoNota: descuentoNota ?? null,
          saldoFavorMonto: saldoFavorMonto != null ? Number(saldoFavorMonto) : null,
          saldoFavorNota: saldoFavorNota ?? null,
          canalFlora: canalFlora ?? null,
        })
      });
    },

    async actualizarFinanzasPedidoPipeline({
      pedidoId,
      subtotal,
      iva,
      domicilio,
      costoDomicilio,
      domicilioOriginal,
      descuentoDomicilio,
      recargoLinkMonto,
      descuentoMonto,
      saldoFavorMonto,
      total,
      domicilioObsequiado,
      omitirCostoDomicilio,
    }) {
      const domicilioValue = domicilio != null ? Number(domicilio) : null;
      const costoDomicilioValue = (costoDomicilio ?? domicilio) != null ? Number(costoDomicilio ?? domicilio) : null;
      const flagValue = domicilioObsequiado != null ? Boolean(domicilioObsequiado) : null;
      const omitValue = omitirCostoDomicilio != null ? Boolean(omitirCostoDomicilio) : null;
      return requestJson(`/pedido/${pedidoId}/detalle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subtotal: subtotal != null ? Number(subtotal) : null,
          iva: iva != null ? Number(iva) : null,
          domicilio: domicilioValue,
          costoDomicilio: costoDomicilioValue,
          costo_domicilio: costoDomicilioValue,
          domicilioOriginal: domicilioOriginal != null ? Number(domicilioOriginal) : null,
          descuentoDomicilio: descuentoDomicilio != null ? Number(descuentoDomicilio) : null,
          recargoLinkMonto: recargoLinkMonto != null ? Number(recargoLinkMonto) : null,
          descuentoMonto: descuentoMonto != null ? Number(descuentoMonto) : null,
          saldoFavorMonto: saldoFavorMonto != null ? Number(saldoFavorMonto) : null,
          total: total != null ? Number(total) : null,
          domicilioObsequiado: flagValue,
          domicilio_obsequiado: flagValue,
          domicilioObsequio: flagValue,
          domicilioGratis: flagValue,
          omitirCostoDomicilio: omitValue,
          omitir_costo_domicilio: omitValue,
          forzarRecalculoFinanciero: true,
        })
      });
    },

    async agregarDetallePedidoPipeline({
      pedidoId,
      productoID,
      cantidad,
      productoObservaciones,
      precioUnitario,
      productoPrecio,
    }) {
      const unitPrice = precioUnitario ?? productoPrecio;
      return requestJson(`/pedido/${pedidoId}/detalle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productoID: productoID != null ? Number(productoID) : null,
          cantidad: cantidad != null ? Number(cantidad) : 1,
          productoObservaciones: productoObservaciones ?? null,
          precioUnitario: unitPrice != null ? Number(unitPrice) : null,
          productoPrecio: unitPrice != null ? Number(unitPrice) : null,
        })
      });
    },

    async eliminarDetallePedidoPipeline({ pedidoId, detalleID }) {
      return requestJson(`/pedido/${pedidoId}/detalle/${detalleID}`, {
        method: "DELETE",
      });
    },

    async obtenerMensajeTarjeta(pedidoId) {
      return requestJson(`/entregas/pedido/${pedidoId}/mensaje`);
    },

    async aprobarPedido(pedidoId) {
      return requestJson(`/pedido/${pedidoId}/aprobar`, {
        method: "PUT"
      });
    },

    async rechazarPedido(pedidoId, motivo) {
      return requestJson(`/pedido/${pedidoId}/rechazar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ motivo })
      });
    },

    async descargarFacturaPedido(pedidoId) {
      const response = await authFetch(`/pedido/${pedidoId}/factura`);
      if (!response.ok) throw await toHttpError(response);
      const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
      if (contentType.includes("application/json")) {
        throw await toHttpError(response);
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename=([^;]+)/i);
      const filename = encodedMatch
        ? decodeURIComponent(encodedMatch[1].replace(/"/g, "").trim())
        : plainMatch
          ? plainMatch[1].replace(/"/g, "").trim()
          : `factura_pedido_${pedidoId}.pdf`;
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("La factura no tiene contenido para descargar.");
      }
      return { blob, filename };
    },

    async generarProduccionDesdePedidos({ empresaId, sucursalId, diasAnticipacion = 0, autoAsignar = true }) {
      return requestJson(`/produccion/generar-desde-pedidos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID: empresaId,
          sucursalID: sucursalId,
          diasAnticipacion,
          autoAsignar
        })
      });
    },

    async listarProduccion({ empresaId, sucursalId, fecha, estado, q, metricFilter, todasFechas = false, incluirCancelado = false, autoAsignarPendientesHoy = true }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fecha) params.set("fecha", String(fecha));
      if (estado) params.set("estado", String(estado));
      if (q) params.set("q", String(q));
      if (metricFilter) params.set("metricFilter", String(metricFilter));
      if (todasFechas) params.set("todasFechas", "true");
      params.set("incluirCancelado", incluirCancelado ? "true" : "false");
      params.set("autoAsignarPendientesHoy", autoAsignarPendientesHoy ? "true" : "false");

      return requestJson(`/produccion?${params.toString()}`);
    },

    async listarFloristas({ empresaId, sucursalId, soloActivos = true, incluirExternos = false }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("soloActivos", soloActivos ? "true" : "false");
      params.set("incluirExternos", incluirExternos ? "true" : "false");

      return requestJson(`/produccion/floristas?${params.toString()}`);
    },

    async actualizarEstadoFlorista({ floristaId, estado, fechaInicioIncapacidad, fechaFinIncapacidad, motivo, usuarioCambio }) {
      return requestJson(`/produccion/floristas/${floristaId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          estado,
          fechaInicioIncapacidad: fechaInicioIncapacidad || null,
          fechaFinIncapacidad: fechaFinIncapacidad || null,
          motivo: motivo || null,
          usuarioCambio
        })
      });
    },

    async asignarProduccion({ produccionId, floristaId, fechaProgramadaProduccion }) {
      return requestJson(`/produccion/${produccionId}/asignar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          floristaID: floristaId ?? null,
          fechaProgramadaProduccion: fechaProgramadaProduccion || null
        })
      });
    },

    async reasignarProduccion({ produccionId, floristaNuevoId, fechaProgramadaProduccion, motivo, usuarioCambio }) {
      return requestJson(`/produccion/${produccionId}/reasignar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          floristaNuevoID: floristaNuevoId ?? null,
          fechaProgramadaProduccion: fechaProgramadaProduccion || null,
          motivo,
          usuarioCambio
        })
      });
    },

    async cambiarEstadoProduccion({ produccionId, nuevoEstado, observacionesInternas, usuarioCambio, origenCambio, cambioAdministrativo = false }) {
      const nuevoEstadoCodigo = PRODUCTION_STATUS_CODE_BY_UI[nuevoEstado] || String(nuevoEstado || "").trim().toUpperCase();
      return requestJson(`/produccion/${produccionId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nuevoEstado,
          nuevoEstadoCodigo,
          codigoEstadoProduccion: nuevoEstadoCodigo,
          observacionesInternas: observacionesInternas || null,
          usuarioCambio: usuarioCambio || null,
          origenCambio: origenCambio || null,
          cambioAdministrativo: Boolean(cambioAdministrativo),
          cambio_administrativo: Boolean(cambioAdministrativo)
        })
      });
    },

    async recalcularProduccionPedido({ pedidoId, usuarioCambio, motivo, productoEstructuralCambiado = false, forceCancelarYCrearNueva = false }) {
      return requestJson(`/produccion/pedido/${pedidoId}/recalcular`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuarioCambio,
          motivo: motivo || null,
          productoEstructuralCambiado,
          forceCancelarYCrearNueva
        })
      });
    },

    async obtenerHistorialReasignaciones({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));

      return requestJson(`/produccion/historial/reasignaciones?${params.toString()}`);
    },

    async obtenerMetricasProductividad({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));

      return requestJson(`/produccion/metricas/productividad?${params.toString()}`);
    },

    async obtenerMetricasOperacion({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));

      return requestJson(`/produccion/metricas/operacion?${params.toString()}`);
    },

    async obtenerTrazabilidadAprobacionesPedidos({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));
      return requestJson(`/pedidos/trazabilidad/aprobaciones?${params.toString()}`);
    },

    async obtenerResumenContabilidad({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));
      return requestJson(`/contabilidad/resumen?${params.toString()}`);
    },

    async obtenerVentasDiarioContabilidad({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));
      return requestJson(`/pedidos/contabilidad/ventas-diario?${params.toString()}`);
    },

    async obtenerResumenFloristasContabilidad({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null && Number.isFinite(Number(sucursalId))) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));
      return requestJson(`/contabilidad/floristas/resumen?${params.toString()}`);
    },

    async obtenerPedidosDomiciliarioContabilidad({ empresaId, sucursalId, domiciliarioID, fechaDesde, fechaHasta, estadoEntrega }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));
      if (estadoEntrega) params.set("estadoEntrega", String(estadoEntrega));
      return requestJson(`/contabilidad/domiciliarios/${domiciliarioID}/pedidos?${params.toString()}`);
    },

    async listarCierresCaja({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fechaDesde) params.set("fechaDesde", String(fechaDesde));
      if (fechaHasta) params.set("fechaHasta", String(fechaHasta));
      return requestJson(`/contabilidad/caja?${params.toString()}`);
    },

    async obtenerCierreCajaDia({ empresaId, sucursalId, fecha }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fecha", String(fecha));
      return requestJson(`/contabilidad/caja/efectivo?${params.toString()}`);
    },

    async guardarCierreCaja({ empresaId, sucursalId, fecha, base, efectivo, gasto, totalEfectivo, guardado, nuevaBase, observacion, usuarioId }) {
      return requestJson("/contabilidad/caja/cierre", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          empresaID: empresaId,
          sucursalID: sucursalId,
          fecha,
          base,
          efectivo,
          gasto,
          totalEfectivo,
          guardado,
          nuevaBase,
          observacion: observacion || "",
          usuarioID: usuarioId ?? null,
        })
      });
    },

    async listarDomiciliarios({ empresaId, sucursalId, soloActivos = true, estado, q }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("soloActivos", soloActivos ? "true" : "false");
      if (estado) params.set("estado", String(estado));
      if (q) params.set("q", String(q));
      return requestJson(`/domicilios/domiciliarios?${params.toString()}`);
    },

    async crearDomiciliario({ empresaId, nombre, telefono, tipo, vehiculo, placa, detalleVehiculo, activo = true }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/domicilios/domiciliarios?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombre,
          telefono,
          tipo,
          vehiculo,
          placa,
          detalleVehiculo,
          activo: Boolean(activo)
        })
      });
    },

    async actualizarDomiciliario({ idDomiciliario, empresaId, nombre, sucursalID, telefono, tipo, estado, vehiculo, activo }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      const payload = {};
      if (nombre !== undefined) payload.nombre = nombre;
      if (sucursalID !== undefined) payload.sucursalID = sucursalID;
      if (telefono !== undefined) payload.telefono = telefono;
      if (tipo !== undefined) payload.tipo = tipo;
      if (estado !== undefined) payload.estado = estado;
      if (vehiculo !== undefined) payload.vehiculo = vehiculo;
      if (activo !== undefined) payload.activo = activo;

      return requestJson(`/domicilios/domiciliarios/${idDomiciliario}?${params.toString()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    },

    async eliminarDomiciliario({ idDomiciliario, empresaId }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      return requestJson(`/domicilios/domiciliarios/${idDomiciliario}?${params.toString()}`, {
        method: "DELETE",
      });
    },

    async listarDomiciliosAdmin({ empresaId, sucursalId, filtro = "hoy", fecha, q, domiciliarioID, incluirCancelado = false }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("filtro", String(filtro));
      if (fecha) params.set("fecha", String(fecha));
      if (q) params.set("q", String(q));
      if (domiciliarioID != null && String(domiciliarioID).trim()) {
        params.set("domiciliarioID", String(domiciliarioID));
        params.set("domiciliarioId", String(domiciliarioID));
        params.set("domiciliarioid", String(domiciliarioID));
        params.set("idDomiciliario", String(domiciliarioID));
        params.set("id_domiciliario", String(domiciliarioID));
      }
      params.set("incluirCancelado", incluirCancelado ? "true" : "false");
      return requestJson(`/domicilios?${params.toString()}`);
    },

    async obtenerMetricasDomicilios({ empresaId, sucursalId, fechaDesde, fechaHasta, anio, mes, dia, domiciliarioID, agruparPor = "dia" }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fechaDesde) params.set("fechaDesde", String(fechaDesde));
      if (fechaHasta) params.set("fechaHasta", String(fechaHasta));
      if (anio != null) params.set("anio", String(anio));
      if (mes != null) params.set("mes", String(mes));
      if (dia != null) params.set("dia", String(dia));
      if (domiciliarioID != null && String(domiciliarioID).trim()) params.set("domiciliarioID", String(domiciliarioID));
      if (agruparPor) params.set("agruparPor", String(agruparPor));
      return requestJson(`/domicilios/metricas?${params.toString()}`);
    },

    async listarMisEntregasDomiciliario({ empresaId, sucursalId, domiciliarioId, fecha }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("domiciliarioID", String(domiciliarioId));
      if (fecha) params.set("fecha", String(fecha));
      return requestJson(`/domicilios/mis-entregas?${params.toString()}`);
    },

    async listarMisPedidos({ empresaId, sucursalId, fecha }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fecha) params.set("fecha", String(fecha));
      return requestJson(`/domicilios/mis-pedidos?${params.toString()}`);
    },

    async listarPedidosDisponibles({ empresaId, sucursalId, fecha, latitud, longitud, pageSize = 100, limit = 100 }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fecha) params.set("fecha", String(fecha));
      if (latitud != null) params.set("latitud", String(latitud));
      if (longitud != null) params.set("longitud", String(longitud));
      params.set("page", "1");
      params.set("pageSize", String(pageSize));
      params.set("limit", String(limit));
      params.set("limite", String(limit));
      params.set("soloSinAsignar", "true");
      return requestJson(`/domicilios/pedidos-disponibles?${params.toString()}`);
    },

    async listarPedidosDisponiblesPorFecha({ fecha }) {
      const params = new URLSearchParams();
      params.set("fecha", String(fecha));
      return requestJson(`/pedidos/disponibles?${params.toString()}`);
    },

    async tomarEntrega({ entregaId, usuarioCambio, limiteEntregasActivas = 15 }) {
      const params = new URLSearchParams();
      params.set("limiteEntregasActivas", String(limiteEntregasActivas));
      params.set("maxEntregasActivas", String(limiteEntregasActivas));
      params.set("limite_activas", String(limiteEntregasActivas));
      params.set("limite", String(limiteEntregasActivas));
      params.set("permitirMultiplesAsignaciones", "true");
      params.set("permitirSobrecupo", "true");

      return requestJson(`/domicilios/${entregaId}/tomar?${params.toString()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuarioCambio,
          limiteEntregasActivas,
          maxEntregasActivas: limiteEntregasActivas,
          limite_activas: limiteEntregasActivas,
          limite: limiteEntregasActivas,
          max_activos: limiteEntregasActivas,
          capacidadMaxima: limiteEntregasActivas,
          permitirMultiplesAsignaciones: true,
          permitirSobrecupo: true,
          forzarSobrecupo: true
        })
      });
    },

    async asignarDomiciliarioEntrega({ entregaId, domiciliarioID, usuarioCambio, limiteEntregasActivas = 15 }) {
      const params = new URLSearchParams();
      params.set("limiteEntregasActivas", String(limiteEntregasActivas));
      params.set("maxEntregasActivas", String(limiteEntregasActivas));
      params.set("limite_activas", String(limiteEntregasActivas));
      params.set("limite", String(limiteEntregasActivas));
      params.set("permitirMultiplesAsignaciones", "true");
      params.set("permitirSobrecupo", "true");

      return requestJson(`/domicilios/${entregaId}/asignar?${params.toString()}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domiciliarioID,
          usuarioCambio,
          limiteEntregasActivas,
          maxEntregasActivas: limiteEntregasActivas,
          limite_activas: limiteEntregasActivas,
          limite: limiteEntregasActivas,
          max_activos: limiteEntregasActivas,
          capacidadMaxima: limiteEntregasActivas,
          permitirMultiplesAsignaciones: true,
          permitirSobrecupo: true,
          forzarSobrecupo: true
        })
      });
    },

    async marcarEntregaEnRuta({ entregaId, usuarioCambio }) {
      return requestJson(`/domicilios/${entregaId}/en-ruta`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ usuarioCambio })
      });
    },

    async marcarEntregaEntregado({
      entregaId,
      usuarioCambio,
      firmaNombre,
      firmaDocumento,
      firmaImagenFile,
      firmaImagenUrl,
      evidenciaFotoFile,
      evidenciaFotoUrl,
      latitudEntrega,
      longitudEntrega,
      observaciones,
    }) {
      const form = new FormData();
      form.append("usuarioCambio", usuarioCambio);
      form.append("firmaNombre", firmaNombre);
      form.append("firmaDocumento", firmaDocumento);
      if (firmaImagenFile) {
        form.append("firmaImagen", firmaImagenFile);
      } else if (firmaImagenUrl) {
        form.append("firmaImagenUrl", firmaImagenUrl);
      }
      if (evidenciaFotoFile) {
        form.append("evidenciaFoto", evidenciaFotoFile);
      } else if (evidenciaFotoUrl) {
        form.append("evidenciaFotoUrl", evidenciaFotoUrl);
      }
      form.append("latitudEntrega", String(latitudEntrega ?? 0));
      form.append("longitudEntrega", String(longitudEntrega ?? 0));
      form.append("observaciones", observaciones || "");

      return requestJson(`/domicilios/${entregaId}/entregado`, {
        method: "PUT",
        body: form,
      });
    },

    async resolverNovedadEntrega({
      entregaId,
      usuarioCambio,
      observaciones,
      evidenciaFotoUrl,
      latitudEntrega,
      longitudEntrega,
      firmaNombre,
      firmaDocumento,
      firmaImagenUrl,
      firmaImagenFile,
      evidenciaFotoFile,
    }) {
      const form = new FormData();
      form.append("usuarioCambio", usuarioCambio);
      form.append("observaciones", observaciones || "");
      if (evidenciaFotoUrl) form.append("evidenciaFotoUrl", evidenciaFotoUrl);
      if (latitudEntrega != null) form.append("latitudEntrega", String(latitudEntrega));
      if (longitudEntrega != null) form.append("longitudEntrega", String(longitudEntrega));
      if (firmaNombre) form.append("firmaNombre", firmaNombre);
      if (firmaDocumento) form.append("firmaDocumento", firmaDocumento);
      if (firmaImagenUrl) form.append("firmaImagenUrl", firmaImagenUrl);
      if (firmaImagenFile) form.append("firmaImagen", firmaImagenFile);
      if (evidenciaFotoFile) form.append("evidenciaFoto", evidenciaFotoFile);

      return requestJson(`/domicilios/${entregaId}/resolver-novedad`, {
        method: "PUT",
        body: form,
      });
    },

    async marcarEntregaNoEntregado({ entregaId, usuarioCambio, motivo, reprogramarPara, observaciones }) {
      return requestJson(`/domicilios/${entregaId}/no-entregado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usuarioCambio,
          motivo,
          reprogramarPara: reprogramarPara || null,
          observaciones: observaciones || null,
        })
      });
    }
  };
}
