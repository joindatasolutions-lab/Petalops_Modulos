export function createApiClient(config) {
  const baseUrl = config.apiBaseUrl;

  const toHttpError = async response => {
    let detail = "";
    try {
      const payload = await response.json();
      if (payload?.error?.message) {
        detail = String(payload.error.message || "").trim();
      } else {
        detail = String(payload?.detail || "").trim();
      }
    } catch {
      detail = "";
    }

    const error = new Error(detail || `HTTP ${response.status}`);
    error.status = response.status;
    error.detail = detail;
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

    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  };

  const requestJson = async (path, options = {}) => {
    const response = await authFetch(path, options);
    if (!response.ok) throw await toHttpError(response);
    return response.json();
  };

  return {
    async login({ login, password }) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login, password }),
      });    

      if (!response.ok) throw await toHttpError(response);     

      const data = await response.json();    

      localStorage.setItem("petalops_access_token", data.accessToken);     

      return data;
    },

    async me() {
      return requestJson("/auth/me");
    },

    async crearUsuario({ nombre, login, password, email, rolID, sucursalID, estado = "Activo" }) {
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

    async crearUsuarioGestion({ empresaID, nombre, login, password, email, rolID, sucursalID, estado = "Activo", modulosAcceso = null }) {
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

    async actualizarUsuarioGestion({ userId, nombre, login, password = "", email, rolID, sucursalID, estado = "Activo", modulosAcceso = null }) {
      const payload = {
        nombre,
        login,
        email,
        rolID,
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

    async listarClientes({ empresaId, q = "", soloActivos = false }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (q) params.set("q", String(q));
      if (soloActivos) params.set("soloActivos", "true");
      return requestJson(`/clientes?${params.toString()}`);
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

    async crearEmpresaGestion({ nombreComercial, planID, estado = "Activo" }) {
      return requestJson("/auth/usuarios/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nombreComercial,
          planID,
          estado,
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

    async listarPedidos({ empresaId, sucursalId, q, estado, fechaDesde, fechaHasta, page, pageSize }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (q) params.set("q", String(q));
      if (estado) params.set("estado", String(estado));
      if (fechaDesde) params.set("fechaDesde", String(fechaDesde));
      if (fechaHasta) params.set("fechaHasta", String(fechaHasta));
      params.set("page", String(page || 1));
      params.set("pageSize", String(pageSize || 20));

      return requestJson(`/pedidos?${params.toString()}`);
    },

    async listarPipelinePedidos({
      empresaId,
      sucursalId,
      fecha,
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

    async actualizarDetallePedidoPipeline({
      pedidoId,
      detalleID,
      productoID,
      cantidad,
      productoObservaciones,
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
      descuentoPct,
      canalFlora,
    }) {
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
          productoPrecio: productoPrecio != null ? Number(productoPrecio) : null,
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
          descuentoPct: descuentoPct != null ? Number(descuentoPct) : null,
          canalFlora: canalFlora ?? null,
        })
      });
    },

    async agregarDetallePedidoPipeline({
      pedidoId,
      productoID,
      cantidad,
      productoObservaciones,
      productoPrecio,
    }) {
      return requestJson(`/pedido/${pedidoId}/detalle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productoID: productoID != null ? Number(productoID) : null,
          cantidad: cantidad != null ? Number(cantidad) : 1,
          productoObservaciones: productoObservaciones ?? null,
          productoPrecio: productoPrecio != null ? Number(productoPrecio) : null,
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
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename=([^;]+)/i);
      const filename = match ? match[1].replace(/"/g, "").trim() : `factura_pedido_${pedidoId}.pdf`;
      const blob = await response.blob();
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

    async listarProduccion({ empresaId, sucursalId, fecha, estado, incluirCancelado = false }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fecha) params.set("fecha", String(fecha));
      if (estado) params.set("estado", String(estado));
      params.set("incluirCancelado", incluirCancelado ? "true" : "false");

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

    async cambiarEstadoProduccion({ produccionId, nuevoEstado, observacionesInternas }) {
      return requestJson(`/produccion/${produccionId}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nuevoEstado,
          observacionesInternas: observacionesInternas || null
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

    async obtenerTrazabilidadProduccionUsuarios({ empresaId, sucursalId, fechaDesde, fechaHasta }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("fechaDesde", String(fechaDesde));
      params.set("fechaHasta", String(fechaHasta));
      return requestJson(`/produccion/trazabilidad/usuarios?${params.toString()}`);
    },

    async listarDomiciliarios({ empresaId, sucursalId, soloActivos = true }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("soloActivos", soloActivos ? "true" : "false");
      return requestJson(`/domicilios/domiciliarios?${params.toString()}`);
    },

    async listarDomiciliosAdmin({ empresaId, sucursalId, filtro = "hoy", fecha }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      params.set("filtro", String(filtro));
      if (fecha) params.set("fecha", String(fecha));
      return requestJson(`/domicilios?${params.toString()}`);
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

    async listarPedidosDisponibles({ empresaId, sucursalId, fecha, latitud, longitud }) {
      const params = new URLSearchParams();
      params.set("empresaID", String(empresaId));
      if (sucursalId != null) params.set("sucursalID", String(sucursalId));
      if (fecha) params.set("fecha", String(fecha));
      if (latitud != null) params.set("latitud", String(latitud));
      if (longitud != null) params.set("longitud", String(longitud));
      return requestJson(`/domicilios/pedidos-disponibles?${params.toString()}`);
    },

    async tomarEntrega({ entregaId, usuarioCambio }) {
      return requestJson(`/domicilios/${entregaId}/tomar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ usuarioCambio })
      });
    },

    async asignarDomiciliarioEntrega({ entregaId, domiciliarioID, usuarioCambio }) {
      return requestJson(`/domicilios/${entregaId}/asignar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domiciliarioID,
          usuarioCambio
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
      form.append("latitudEntrega", String(latitudEntrega));
      form.append("longitudEntrega", String(longitudEntrega));
      form.append("observaciones", observaciones || "");

      return requestJson(`/domicilios/${entregaId}/entregado`, {
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
